#!/usr/bin/env bash
# Helm web'i lokal olarak build eder ve yalnız dist/ çıktısını sunucuya gönderir.
set -euo pipefail

DEPLOY_CONFIG="$(dirname "$0")/.env.deploy"
SITE_URL="https://helm.wesan.co/login"

if [[ ! -f "$DEPLOY_CONFIG" ]]; then
  echo "Hata: deploy/.env.deploy dosyası bulunamadı. README'deki yerel ayarı oluştur."
  exit 1
fi

# Bu dosya gitignored'dır; sunucu adresi tracked scriptte tutulmaz.
# shellcheck disable=SC1090
source "$DEPLOY_CONFIG"

SERVER_IP="${SERVER_IP:-}"
SERVER_USER="${SERVER_USER:-canakyuz}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/helm/dist}"

if [[ -z "$SERVER_IP" || "$SERVER_IP" == *[[:space:]]* ]]; then
  echo "Hata: deploy/.env.deploy içindeki SERVER_IP alanını doldur."
  exit 1
fi

if [[ "$REMOTE_DIR" != /* || "$REMOTE_DIR" == "/" ]]; then
  echo "Hata: REMOTE_DIR güvenli ve mutlak bir dist yolu olmalı."
  exit 1
fi

for command_name in bun ssh rsync; do
  command -v "$command_name" >/dev/null || {
    echo "Hata: $command_name komutu bulunamadı."
    exit 1
  }
done

cd "$(dirname "$0")/.."

if [[ ! -f .env && ( -z "${VITE_HELM_SUPABASE_URL:-}" || -z "${VITE_HELM_SUPABASE_ANON_KEY:-}" ) ]]; then
  echo "Hata: apps/web/.env veya gerekli VITE_HELM_SUPABASE_* değişkenleri eksik."
  exit 1
fi

SSH_TARGET="${SERVER_USER}@${SERVER_IP}"

echo "→ build (VITE_* anahtarları .env'den gömülür; SERVICE_ROLE gömülmez)"
bun install --frozen-lockfile
bun run build

FIRST_ASSET="$(find dist/assets -type f -print -quit 2>/dev/null || true)"
if [[ ! -s dist/index.html || -z "$FIRST_ASSET" ]]; then
  echo "Hata: build çıktısı eksik; boş dist ile deploy reddedildi."
  exit 1
fi

echo "→ hedef klasör ve yazma izni kontrol ediliyor"
ssh "$SSH_TARGET" "test -d '$REMOTE_DIR' && test -w '$REMOTE_DIR'"

echo "→ rsync dist/ → $SSH_TARGET:$REMOTE_DIR"
rsync -avz --delete -- dist/ "$SSH_TARGET:$REMOTE_DIR/"

echo "✓ deploy bitti → $SITE_URL"
