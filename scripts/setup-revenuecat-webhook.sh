#!/usr/bin/env bash
# RevenueCat webhook kurulumu — tek komut.
#
# NE YAPAR (bu sirayla, sira onemli):
#   1. Rastgele bir sir uretir
#   2. Sirri Supabase edge function secret'i olarak tanimlar
#   3. helm-revenuecat-webhook fonksiyonunu deploy eder
#   4. RevenueCat'teki webhook kaydini API'den yeni adrese cevirir
#
# NEDEN BU SIRA: once yonlendirip sonra deploy edersek, aradaki surede gelen
# satin alma olaylari 404'e gider ve KAYBOLUR. RevenueCat basarisiz teslimati
# bir sure tekrar dener ama sonsuza kadar degil.
#
# NEDEN URL'DE SIR: RevenueCat v2 API'si webhook kaydinda authorization BASLIGI
# ayarlamaya izin vermiyor; baslik yalnizca panelden girilebiliyor. Sir URL'de
# tasininca kurulum tamamen API'den yapilabiliyor, panele hic girilmiyor.
#
# Calistirmadan once: supabase login  (CLI'nin proje yetkisi olmali)

set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
set -a; . ./.env; set +a

: "${HELM_SUPABASE_PROJECT_ID:?HELM_SUPABASE_PROJECT_ID .env'de tanimli degil}"
: "${HELM_DB_URL:?HELM_DB_URL .env'de tanimli degil}"

FN=helm-revenuecat-webhook
URL_BASE="https://${HELM_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${FN}"

echo "▸ Sir uretiliyor…"
SECRET="$(openssl rand -hex 32)"

echo "▸ Supabase secret tanimlaniyor…"
supabase secrets set "RC_WEBHOOK_SECRET=${SECRET}" --project-ref "${HELM_SUPABASE_PROJECT_ID}" >/dev/null

echo "▸ Fonksiyon deploy ediliyor (${FN})…"
# --no-verify-jwt SART: RevenueCat Supabase JWT'si gondermez. Bu bayrak olmadan
# ag gecidi her teslimati 401 ile reddeder — mevcut revenuecat-webhook'ta tam
# olarak bu olmus olabilir.
supabase functions deploy "${FN}" \
  --project-ref "${HELM_SUPABASE_PROJECT_ID}" \
  --no-verify-jwt >/dev/null

echo "▸ Uc dogrulaniyor…"
CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${URL_BASE}?k=${SECRET}" \
  -H 'Content-Type: application/json' -d '{}' --max-time 20)"
if [ "$CODE" != "400" ]; then
  echo "  ✗ Beklenen 400 (bos govde), gelen ${CODE}."
  echo "    401 ise sir gecmiyor, 404 ise deploy olmamis. Yonlendirme YAPILMADI."
  exit 1
fi
echo "  ✓ Uc ayakta ve sirri kabul ediyor"

echo "▸ RevenueCat kaydi guncelleniyor…"
python3 - "$SECRET" "$URL_BASE" <<'PY'
import json, os, sys, urllib.request, urllib.error
import psycopg

secret, url_base = sys.argv[1], sys.argv[2]
with psycopg.connect(os.environ["HELM_DB_URL"]) as conn, conn.cursor() as cur:
    cur.execute("select config from project_integrations where provider='revenuecat' and enabled limit 1")
    row = cur.fetchone()
if row is None:
    sys.exit("RevenueCat entegrasyonu bulunamadi")
cfg = row[0]
key, proj = cfg["api_key"], cfg["rc_project_id"]
target = f"{url_base}?k={secret}"

def call(method, path, payload=None):
    req = urllib.request.Request(
        f"https://api.revenuecat.com/v2{path}",
        method=method,
        data=json.dumps(payload).encode() if payload else None,
        headers={
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            **({"Content-Type": "application/json"} if payload else {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]

st, listing = call("GET", f"/projects/{proj}/integrations/webhooks")
if st != 200:
    sys.exit(f"Webhook listesi alinamadi: {st} {listing}")

items = listing.get("items", [])
existing = next((w for w in items if "supabase.co/functions" in (w.get("url") or "")), None)

if existing:
    st, res = call("POST", f"/projects/{proj}/integrations/webhooks/{existing['id']}",
                   {"url": target})
    action = f"guncellendi ({existing['id']})"
else:
    st, res = call("POST", f"/projects/{proj}/integrations/webhooks",
                   {"name": "helm", "url": target})
    action = "olusturuldu"

if st not in (200, 201):
    # 403 = API anahtarinin integrations yazma yetkisi yok. Kurulumun geri kalani
    # tamam; geriye yalnizca URL'i girmek kaliyor. Adresi basiyoruz ki elle
    # yapistirilabilsin — sir zaten URL'in icinde.
    print(f"  ! RevenueCat kaydi API'den guncellenemedi: {st}")
    if "integrations:read_write" in str(res):
        print("    Sebep: RC API anahtarinda project_configuration:integrations:read_write yetkisi yok.")
    print()
    print("    ELLE GIR — RevenueCat > Project > Integrations > Webhooks:")
    print(f"    {target}")
    print()
    print("    (Alternatif: RC panelinden API anahtarina yukaridaki yetkiyi ver, betigi tekrar calistir.)")
    sys.exit(0)

print(f"  ✓ Webhook {action}")
print(f"    hedef: {url_base}?k=***")
PY

echo
echo "✓ Kurulum tamam. Bir test satin almasi yapip su sorguyla dogrula:"
echo "    select count(*), max(occurred_at) from revenue_events;"
