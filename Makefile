# Helm monorepo — kök Makefile (apps/web + apps/mobile + supabase)
# .env'den HELM_SUPABASE_PROJECT_ID okunur (gen-types için).
-include .env
export

SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help install hooks require-token scan-secrets audit-secrets dev-web dev-mobile typecheck build-web gen-types db-push fn-deploy ios-release ota clean

help: ## komutları listele
	@awk 'BEGIN{FS=":.*## "} /^[a-zA-Z_-]+:.*## /{printf "  \033[36m%-13s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## bağımlılıkları kur (bun workspace)
	bun install

hooks: ## git hook'larını aktifleştir (clone sonrası bir kez)
	bunx lefthook install
	@echo "✓ pre-commit sır + commit-msg format + pre-push typecheck aktif"

scan-secrets: ## tracked dosyalarda sır ara
	./scripts/check-secrets.sh tree

audit-secrets: ## tüm git history'de sır ara (yavaş)
	./scripts/check-secrets.sh history

dev-web: ## web cockpit (Refine/Vite)
	cd apps/web && bun run dev

dev-mobile: ## mobil (Expo, cache temiz)
	cd apps/mobile && bun run start -- -c

typecheck: ## tüm workspace'leri tsc et
	bun run typecheck

build-web: ## web prod build → apps/web/dist
	cd apps/web && bun run build

# Supabase CLI'ı helm hesabıyla doğrular.
#
# NEDEN BU GUARD VAR: token .env'de yoksa CLI sessizce makinedeki VARSAYILAN
# hesaba düşer ve "403 — account does not have the necessary privileges" der.
# O mesaj kimin adına konuşulduğunu söylemediği için yanlış yere baktırıyor.
# Token global export'tan bilerek çıkarıldı (bkz. ~/.zshrc notu); projeye ait
# token projenin kendi .env'inde durur.
require-token:
	@test -n "$(SUPABASE_ACCESS_TOKEN)" || { \
		echo "SUPABASE_ACCESS_TOKEN .env'de yok."; \
		echo ""; \
		echo "DIKKAT: bu makinedeki supabase CLI BASKA bir hesapta."; \
		echo "  gorunen projeler : begahome, empireinc"; \
		echo "  gereken proje    : $(HELM_SUPABASE_PROJECT_ID) (Helm Ops)"; \
		echo "Yani 'supabase login' yetmez — token HELM hesabindan alinmali."; \
		echo ""; \
		echo "1) Helm hesabiyla gir: supabase.com/dashboard/account/tokens"; \
		echo "2) .env'i EDITORLE ac ve satiri ekle."; \
		echo "   'echo ... >> .env' KULLANMA: .env son satiri newline ile"; \
		echo "   bitmiyorsa token onceki satirin sonuna yapisir ve iki komut"; \
		echo "   birden bozulur (yasandi)."; \
		exit 1; }

gen-types: require-token ## Supabase schema → packages/types/src/database.ts
	bun run gen:types

# --db-url ile: --project-ref tek başına DB şifresini interaktif sorar, bu da
# make içinde kilitlenme demek. HELM_DB_URL zaten .env'de.
#
# NEDEN require-token YOK: bu hedef Management API'ye hiç gitmiyor, doğrudan
# Postgres'e bağlanıyor. Token'ı şart koşmak, gereği olmayan bir engelde
# durdurup "yetki sorunu var" sanısı yaratıyordu. Kendi ön koşulu DB URL'i.
db-push: require-db-url ## migration'ları remote'a uygula
	supabase db push --db-url "$(HELM_DB_URL)"

require-db-url:
	@test -n "$(HELM_DB_URL)" || { \
		echo "HELM_DB_URL .env'de yok."; \
		echo "Supabase → Settings → Database → Connection string (pooler)."; \
		echo "DB şifresini yakın zamanda sıfırladıysan bu satırı da güncelle."; \
		exit 1; }

# --project-ref şart: repo'da supabase/.temp/project-ref link dosyası yok, CLI
# aksi halde "Cannot find project ref" der.
fn-deploy: require-token ## edge function deploy (tekil: make fn-deploy FN=helm-payouts)
	supabase functions deploy $(FN) --project-ref $(HELM_SUPABASE_PROJECT_ID)

ios-release: ## yerel IPA + TestFlight (apps/mobile/Makefile'a delege)
	$(MAKE) -C apps/mobile ios-local-release

clean: ## node_modules + build çıktıları temizle
	rm -rf node_modules apps/*/node_modules packages/*/node_modules apps/web/dist

# CHANNEL varsayilani production: EAS'teki TUM bitmis iOS build'leri
# `production` profiliyle uretilmis ve `production` kanalini dinliyor
# (dogrulama: eas build:list --platform ios).
#
# NEDEN NOT DUSULDU: bir ara varsayilan `preview` yapilmisti, cunku
# apps/mobile/Makefile'da `EAS_PROFILE ?= preview` yaziyor. O degisken yerel
# build komutunun varsayilani; cihazdaki build'in hangi kanali dinledigini
# SOYLEMEZ. Sonuc: `make ota` preview'a yayinladi, telefon production'i
# dinledigi icin guncelleme hic ulasmadi ve widget eski rakamda kaldi.
# Kanal sorusunun tek dogru kaynagi `eas build:list`.
CHANNEL ?= production

ota: ## OTA update (CHANNEL=production ile prod kanalina)
	cd apps/mobile && eas update --channel $(CHANNEL) --environment $(CHANNEL) --message "$$(git log -1 --pretty=%s)"

