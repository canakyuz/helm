#!/usr/bin/env bash
# AdMob format kirilimini (metrics_format) REST API'sinden geri doldurur.
#
# NE ZAMAN CALISTIRILIR:
#   - helm-ingest'in FORMAT boyutlu surumu HENUZ DEPLOY EDILMEDIYSE (bugunku
#     durum: deploy yetkisi yok), tablo bos kalir ve ekrandaki "Reklam
#     ekonomisi" karti hic gorunmez. Bu betik boslugu kapatir.
#   - Ingest bir sure calismadiysa.
#
# NEDEN GUVENLI TEKRAR CALISTIRILIR: metrics_format PK'si
# (project_id, date, source, metric, format) — upsert idempotent, ayni gun iki
# kez yazilirsa ikincisi birinciyi gunceller, toplam sismez.
#
# NEDEN ORAN YAZILMIYOR: yalnizca SAYIM (gelir, gosterim, istek, eslesen,
# tiklama) saklanir. eCPM ve doluluk okuma tarafinda toplanmis sayimlardan
# turetilir; onceden hesaplanmis oranlari gunler boyunca toplamak yanlis
# sonuc verir (oranlarin ortalamasi oran degildir).
#
# KULLANIM:
#   scripts/backfill-admob-formats.sh              # son 90 gun
#   scripts/backfill-admob-formats.sh --days 30
#   scripts/backfill-admob-formats.sh --dry-run

set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
set -a; . ./.env; set +a
# Apostrof YOK: bash, ${VAR:?mesaj} icindeki ' karakterini tirnak acilisi sayar
# ve dosyanin geri kalanini (heredoc dahil) yanlis ayristirir.
: "${HELM_DB_URL:?HELM_DB_URL .env dosyasinda tanimli degil}"

python3 - "$@" <<'PY'
import json, os, sys, time, urllib.error, urllib.parse, urllib.request
import psycopg

args = sys.argv[1:]
dry = "--dry-run" in args
days = int(args[args.index("--days") + 1]) if "--days" in args else 90

# AdMob FORMAT metrikleri → metrics_format.metric adlari. Connector ile AYNI
# esleme (admob.ts): ikisi ayrisirsa ayni veri iki farkli isimle iki satir olur.
METRIC_OF = {
    "ESTIMATED_EARNINGS": "ad_revenue",
    "IMPRESSIONS": "ad_impressions",
    "AD_REQUESTS": "ad_requests",
    "MATCHED_REQUESTS": "ad_matched_requests",
    "CLICKS": "ad_clicks",
}

with psycopg.connect(os.environ["HELM_DB_URL"]) as conn, conn.cursor() as cur:
    cur.execute(
        "select project_id, config from project_integrations "
        "where provider='admob' and enabled"
    )
    integrations = cur.fetchall()
if not integrations:
    sys.exit("Etkin AdMob entegrasyonu yok")


def token(cfg):
    body = urllib.parse.urlencode({
        "client_id": cfg["client_id"], "client_secret": cfg["client_secret"],
        "refresh_token": cfg["refresh_token"], "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token", data=body, method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())["access_token"]


def ymd(ts):
    t = time.gmtime(ts)
    return {"year": t.tm_year, "month": t.tm_mon, "day": t.tm_mday}


rows = []
for project_id, cfg in integrations:
    at = token(cfg)
    # Bitis UTC YARIN: AdMob hesabin saat diliminde raporlar (bizde UTC+3), UTC
    # bugune sabitlenirse gunun ilk ~3 saati hic istenmez. Olmayan gun zararsiz.
    body = {"reportSpec": {
        "dateRange": {"startDate": ymd(time.time() - days * 86400),
                      "endDate": ymd(time.time() + 86400)},
        "dimensions": ["DATE", "APP", "FORMAT"],
        "metrics": list(METRIC_OF),
    }}
    req = urllib.request.Request(
        f"https://admob.googleapis.com/v1/accounts/{cfg['publisher_id']}/networkReport:generate",
        data=json.dumps(body).encode(), method="POST",
        headers={"Authorization": f"Bearer {at}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            items = json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"AdMob rapor {e.code}: {e.read().decode()[:400]}")

    # app_id virgulle ayrilmis liste: AdMob'da iOS ve Android AYRI uygulama
    # kayitlaridir, tek oyun iki app_id tasir. Tek deger yazilirsa digerinin
    # geliri sessizce elenir — dogru gorunumlu, yanlis rakam.
    raw = cfg.get("app_id")
    ids = {s.strip() for s in raw.split(",")} - {""} if isinstance(raw, str) else set()

    agg = {}  # (date, format) -> {metric: value}
    for item in items:
        row = item.get("row")
        if not row:
            continue
        dv = row.get("dimensionValues", {})
        if ids and dv.get("APP", {}).get("value") not in ids:
            continue
        d = dv.get("DATE", {}).get("value", "")
        fmt = dv.get("FORMAT", {}).get("value")
        if len(d) != 8 or not fmt:
            continue
        date = f"{d[:4]}-{d[4:6]}-{d[6:8]}"
        acc = agg.setdefault((date, fmt), {})
        for api_name, metric in METRIC_OF.items():
            mv = row.get("metricValues", {}).get(api_name, {})
            v = (int(mv["microsValue"]) / 1e6 if "microsValue" in mv
                 else int(mv.get("integerValue", 0)))
            acc[metric] = acc.get(metric, 0) + v

    if ids and not agg:
        sys.exit(f"AdMob app_id ({', '.join(ids)}) hicbir satirla eslesmedi — "
                 f"AdMob uygulama kimligi (ca-app-pub-XXXX~YYYY) bekleniyor.")

    currency = cfg.get("currency") or "USD"
    for (date, fmt), metrics in agg.items():
        for metric, value in metrics.items():
            rows.append((project_id, date, "admob", metric, fmt, value, currency))

print(f"▸ {len(rows)} satir hazir ({len(integrations)} entegrasyon, {days} gun)")

if dry:
    seen = {}
    for _, date, _, metric, fmt, value, _ in rows:
        if metric == "ad_revenue":
            seen[fmt] = seen.get(fmt, 0) + value
    print("\n  format basina toplam gelir:")
    for fmt, v in sorted(seen.items(), key=lambda x: -x[1]):
        print(f"    {fmt:<16}{v:>10.2f}")
    print("\n(--dry-run: hicbir sey yazilmadi)")
    sys.exit(0)

with psycopg.connect(os.environ["HELM_DB_URL"]) as conn, conn.cursor() as cur:
    cur.executemany(
        """
        insert into public.metrics_format
          (project_id, date, source, metric, format, value, currency)
        values (%s, %s, %s, %s, %s, %s, %s)
        on conflict (project_id, date, source, metric, format)
        do update set value = excluded.value,
                      currency = excluded.currency,
                      ingested_at = now()
        """,
        rows,
    )
    conn.commit()

print(f"✓ {len(rows)} satir yazildi")
PY
