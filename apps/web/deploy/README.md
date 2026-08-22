# helm web deploy → helm.wesan.co

Statik Vite SPA (`apps/web` → `dist/`). Backend zaten hosted Supabase. Tek kullanıcı + RLS permissive → **uygulamayı public'e açma, auth duvarının arkasına koy.**

## 1. DNS
`helm.wesan.co` → wesan sunucu IP'si (A kaydı). Cloudflare arkasındaysa proxy açık olabilir.

## 2. Auth duvarı şifresi (tek kullanıcı)
```bash
# Caddy:
caddy hash-password            # → bcrypt hash, Caddyfile'daki <BCRYPT_HASH>'e koy
# nginx:
htpasswd -c /etc/nginx/.htpasswd-helm can
```

## 3. Web server config
- **Caddy (önerilen, auto-TLS):** `deploy/Caddyfile` → `/etc/caddy/Caddyfile`, `<BCRYPT_HASH>` doldur, `systemctl reload caddy`.
- **nginx:** `deploy/nginx.conf` → `/etc/nginx/sites-available/helm`, symlink + `certbot --nginx -d helm.wesan.co`, `nginx -s reload`.

## 4. Deploy

Git tarafından izlenmeyen `deploy/.env.deploy` dosyasını oluştur:

```bash
cat > deploy/.env.deploy <<'EOF'
SERVER_IP="SUNUCU_IP_VEYA_SSH_HOST"
SERVER_USER="canakyuz"
REMOTE_DIR="/var/www/helm/dist"
EOF
```

Bu dosya `.gitignore` kapsamındadır; sunucu adresi commit'e girmez.

```bash
./deploy/deploy.sh
```

Build lokal yapılır, hedef klasörün varlığı/yazma izni doğrulanır ve `dist/`
`rsync --delete` ile senkronlanır. `apps/web/.env`'de
`VITE_HELM_SUPABASE_URL` + `VITE_HELM_SUPABASE_ANON_KEY` dolu olmalı (bunlar
dist'e gömülür - public anon key, RLS korumalı).

## 5. Supabase kilidi (kuşak+askı)
- Supabase Dashboard → Auth → **public signup KAPALI**, sadece kendi email'ine magic link.
- Frontend yalnız anon key taşır; `SERVICE_ROLE_KEY` `VITE_` prefix'siz olduğu için **dist'e girmez** (doğrulandı). Provider key'leri edge'de.

## 6. (Opsiyonel, en güvenli) Tailscale
Sunucuyu Tailscale'e al, helm'i sadece private network'te serve et → public'e hiç çıkma, auth duvarı bile gereksizleşir.

## Güncelleme
Her değişiklikte `./deploy/deploy.sh` tekrar (build + rsync). OTA gerekmez, statik.
