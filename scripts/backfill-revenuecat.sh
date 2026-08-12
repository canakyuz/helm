#!/usr/bin/env bash
# RevenueCat gelir olaylarini REST API'sinden geri doldurur.
#
# NE ZAMAN CALISTIRILIR: webhook bir sure calismadiysa. RevenueCat gecmis
# olaylari GERI GONDERMEZ — webhook yanlis adrese bakarken gelen her satin alma
# kalicı olarak kaybolur. Bu betik onlari REST'ten kurtarir.
#
# NEDEN CIFT SAYIM OLMAZ: her satir txn_key ile yazilir (migration 0038) —
# <store>:<original_txn_id>:<odeme_ani>. Webhook ayni anahtari uretir. Betigi
# iki kez calistirmak, ya da webhook'un ayni odemeyi yazmis olmasi, sessizce
# yutulur.
#
# KULLANIM:
#   scripts/backfill-revenuecat.sh              # tum musteriler (~3.5k, ~3 dk)
#   scripts/backfill-revenuecat.sh --days 30    # son 30 gunde gorulmus olanlar
#   scripts/backfill-revenuecat.sh --dry-run    # yazmadan ne bulacagini goster

set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
set -a; . ./.env; set +a
# Apostrof YOK: bash, ${VAR:?mesaj} icindeki ' karakterini tirnak acilisi sayar
# ve dosyanin geri kalanini yanlis ayristirir (heredoc dahil).
: "${HELM_DB_URL:?HELM_DB_URL .env dosyasinda tanimli degil}"

python3 - "$@" <<'PY'
import json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
import psycopg

args = sys.argv[1:]
dry = "--dry-run" in args
days = None
if "--days" in args:
    days = int(args[args.index("--days") + 1])

with psycopg.connect(os.environ["HELM_DB_URL"]) as conn, conn.cursor() as cur:
    cur.execute(
        "select project_id, config from project_integrations "
        "where provider='revenuecat' and enabled limit 1"
    )
    row = cur.fetchone()
if row is None:
    sys.exit("RevenueCat entegrasyonu bulunamadi")
project_id, cfg = row
key, proj = cfg["api_key"], cfg["rc_project_id"]
H = {"Authorization": f"Bearer {key}", "Accept": "application/json"}


def get(url, tries=4):
    """RC 429 doner; ustel geri cekilme ile tekrar dene."""
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=H)
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and i < tries - 1:
                time.sleep(2 ** i)
                continue
            raise
    return {}


# RC REST'i urunun IC kimligini dondurur (prod96947ab4bf); webhook ise MAGAZA
# kimligini (pro_monthly). Cevirmezsek ayni urun iki farkli adla listelenir ve
# ekranda okunmaz bir kimlik gorunur. Tek istekle harita kuruluyor.
print("▸ Urun haritasi aliniyor…")
products = {}
purl = f"https://api.revenuecat.com/v2/projects/{proj}/products?limit=100"
while purl:
    d = get(purl)
    for p in d["items"]:
        products[p["id"]] = {
            "store_identifier": p.get("store_identifier"),
            "display_name": p.get("display_name"),
        }
    purl = d.get("next_page")
print(f"  {len(products)} urun")


def product_of(internal_id):
    """(magaza kimligi, gosterim adi) — bilinmeyen id ham haliyle gecer."""
    p = products.get(internal_id) or {}
    return p.get("store_identifier") or internal_id, p.get("display_name")


print("▸ Musteriler listeleniyor…")
customers, url = [], f"https://api.revenuecat.com/v2/projects/{proj}/customers?limit=1000"
while url:
    d = get(url)
    customers += d["items"]
    url = d.get("next_page")

if days is not None:
    cutoff = (time.time() - days * 86400) * 1000
    before = len(customers)
    customers = [c for c in customers if (c.get("last_seen_at") or 0) >= cutoff]
    # Kirpilan sayiyi YAZDIRIYORUZ: sessiz kirpma "hepsini taradik" gibi okunur,
    # oysa penceredisi bir yenileme atlanmis olabilir.
    print(f"  {before} musteriden {len(customers)} tanesi son {days} gun icinde goruldu "
          f"({before - len(customers)} atlandi)")
else:
    print(f"  {len(customers)} musteri")

BASE = f"https://api.revenuecat.com/v2/projects/{proj}/customers"


def fetch(c):
    cid = c["id"]
    return (
        cid,
        get(f"{BASE}/{cid}/purchases?limit=50").get("items", []),
        get(f"{BASE}/{cid}/subscriptions?limit=50").get("items", []),
    )


print("▸ Satin almalar taraniyor…")
rows, unknown_amount, sandbox, done = [], 0, 0, 0


def is_production(o):
    """Sandbox/test satin almalari gercek gelir DEGIL. RC bunlari environment
    alaninda isaretler; store da 'test_store' olabilir. Ikisini de eliyoruz —
    bir kokpitte 'gelir' rakamina test parasi karisirsa rakam yalan olur."""
    return o.get("environment") == "production" and o.get("store") != "test_store"
with ThreadPoolExecutor(max_workers=10) as ex:
    for cid, purchases, subs in ex.map(fetch, customers):
        done += 1
        if done % 500 == 0:
            print(f"  {done}/{len(customers)}")

        for p in purchases:
            if not is_production(p):
                sandbox += 1
                continue
            txn = p.get("store_purchase_identifier")
            at = p.get("purchased_at")
            if at is None:
                continue
            rev = p.get("revenue_in_usd") or {}
            store_pid, display = product_of(p.get("product_id"))
            rows.append({
                "project_id": project_id,
                "txn_key": f"{p.get('store','unknown')}:{txn}:{at}" if txn else f"rcp:{p['id']}",
                "event_id": None,
                "event_type": "NON_RENEWING_PURCHASE",
                "store": p.get("store"),
                "product_id": store_pid,
                "app_user_id": p.get("customer_id"),
                "country_code": p.get("country"),
                "amount": rev.get("gross"),
                "currency": rev.get("currency") or "USD",
                "occurred_at": at,
                "raw": {"source": "rest_backfill", "display_name": display, "purchase": p},
            })

        for s in subs:
            if not is_production(s):
                sandbox += 1
                continue
            txn = s.get("store_subscription_identifier")
            at = s.get("current_period_starts_at") or s.get("starts_at")
            if at is None:
                continue
            rev = s.get("total_revenue_in_usd") or {}
            # total_revenue_in_usd OMUR BOYU toplamdir, donem basi degil. Yalnizca
            # ILK donemdeyse (starts_at == donem baslangici) toplam tek odemeye
            # esittir ve para olarak yazilabilir. Yenilenmis abonelikte donem
            # fiyatini bolerek TAHMIN etmiyoruz — para rakamina tahmin konmaz;
            # satir amount=null yazilir, resmi rakam Apple gunluk raporundan gelir.
            first_period = s.get("starts_at") == s.get("current_period_starts_at")
            amount = rev.get("gross") if first_period else None
            if amount is None:
                unknown_amount += 1
            store_pid, display = product_of(s.get("product_id"))
            rows.append({
                "project_id": project_id,
                "txn_key": f"{s.get('store','unknown')}:{txn}:{at}" if txn else f"rcs:{s['id']}:{at}",
                "event_id": None,
                "event_type": "INITIAL_PURCHASE" if first_period else "RENEWAL",
                "store": s.get("store"),
                "product_id": store_pid,
                "app_user_id": s.get("customer_id"),
                "country_code": s.get("country"),
                "amount": amount,
                "currency": rev.get("currency") or "USD",
                "occurred_at": at,
                "raw": {"source": "rest_backfill", "display_name": display, "subscription": s},
            })

print(f"\n▸ {len(rows)} odeme bulundu")
if sandbox:
    print(f"  {sandbox} sandbox/test satin almasi elendi")
if unknown_amount:
    print(f"  ! {unknown_amount} yenilenmis abonelikte donem tutari REST'ten "
          f"turetilemedi — satir yazilir, tutar bos kalir.")

if not rows:
    sys.exit(0)

if dry:
    for r in sorted(rows, key=lambda x: x["occurred_at"], reverse=True)[:20]:
        ts = time.strftime("%Y-%m-%d %H:%M", time.localtime(r["occurred_at"] / 1000))
        print(f"  {ts}  {r['event_type']:<22} {r['store']:<10} "
              f"{r['amount'] if r['amount'] is not None else '—':>7} {r['currency']}")
    print("\n(--dry-run: hicbir sey yazilmadi)")
    sys.exit(0)

print("▸ Yaziliyor…")
with psycopg.connect(os.environ["HELM_DB_URL"]) as conn, conn.cursor() as cur:
    cur.executemany(
        """
        insert into public.revenue_events
          (project_id, txn_key, event_id, event_type, store, product_id,
           app_user_id, country_code, amount, currency, occurred_at, raw)
        values (%(project_id)s, %(txn_key)s, %(event_id)s, %(event_type)s,
                %(store)s, %(product_id)s, %(app_user_id)s, %(country_code)s,
                %(amount)s, %(currency)s, to_timestamp(%(occurred_at)s / 1000.0),
                %(raw)s)
        on conflict (txn_key) do nothing
        """,
        [{**r, "raw": json.dumps(r["raw"])} for r in rows],
    )
    written = cur.rowcount
    conn.commit()

print(f"✓ {written} yeni satir yazildi ({len(rows) - max(written, 0)} zaten vardi)")
PY
