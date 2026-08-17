# Helm monorepo — kök Makefile (apps/web + apps/mobile + supabase)
# .env'den HELM_SUPABASE_PROJECT_ID okunur (gen-types için).
-include .env
export

SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help install hooks scan-secrets audit-secrets dev-web dev-mobile typecheck build-web gen-types db-push fn-deploy ios-release clean

help: ## komutları listele
	@awk 'BEGIN{FS=":.*## "} /^[a-zA-Z_-]+:.*## /{printf "  \033[36m%-13s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## bağımlılıkları kur (bun workspace)
	bun install

hooks: ## git hook'larını aktifleştir (clone sonrası bir kez)
	git config core.hooksPath .githooks
	@echo "✓ pre-commit sır taraması aktif"

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

gen-types: ## Supabase schema → packages/types/src/database.ts
	bun run gen:types

db-push: ## migration'ları remote'a uygula
	bun run db:push

fn-deploy: ## edge function deploy (tekil: make fn-deploy FN=helm-payouts)
	supabase functions deploy $(FN)

ios-release: ## yerel IPA + TestFlight (apps/mobile/Makefile'a delege)
	$(MAKE) -C apps/mobile ios-local-release

clean: ## node_modules + build çıktıları temizle
	rm -rf node_modules apps/*/node_modules packages/*/node_modules apps/web/dist
