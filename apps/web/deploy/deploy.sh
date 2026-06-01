#!/usr/bin/env bash
# helm web → wesan sunucusu. Build edip dist/'i rsync'ler.
# Kullanım:  HOST=user@1.2.3.4 ./deploy.sh   (ya da ssh config host adı)
set -euo pipefail

HOST="${HOST:-wesan}"                        # ssh hedefi (config host ya da user@ip)
REMOTE_DIR="${REMOTE_DIR:-/var/www/helm/dist}"

cd "$(dirname "$0")/.."                       # apps/web

echo "→ build (VITE_* anahtarları .env'den gömülür; SERVICE_ROLE gömülmez)"
bun install
bun run build

echo "→ rsync dist/ → $HOST:$REMOTE_DIR"
ssh "$HOST" "mkdir -p '$REMOTE_DIR'"
rsync -avz --delete dist/ "$HOST:$REMOTE_DIR/"

echo "✓ deploy bitti → https://helm.wesan.co"
