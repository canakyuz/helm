# helm-mobile - iOS build + TestFlight. VARSAYILAN YEREL.
# Requires: macOS, Xcode, bun, eas-cli, Apple team AZPJSKX9C9
#
# NEDEN YEREL: EAS cloud build ucretsiz kuyrukta 5-6 saat bekliyor ve
# non-interactive calisinca EXPO_TOKEN istiyor. Ayni build bu Mac'te 15-20 dk.
# Cloud hedefleri yalnizca CLOUD=1 ile calisir; kullanici acikca istemedikce
# kullanilmaz.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# HAT (EAS_PROFILE) BILEREK VARSAYILANSIZ: her build'de secilir.
# NEDEN: eskiden `?= preview` idi. preview `distribution: internal` = AdHoc imza,
# TestFlight'a YUKLENEMEZ (dogrulandi 2026-09-14: dist/helm-ios-preview.ipa
# profili "[expo] com.canakyuz.helmmobile AdHoc", ProvisionedDevices dolu) ve
# kurulu build'ler production kanalini dinliyor. Sessiz varsayilan iki kez yanlis
# hatta gonderdi; secimi zorunlu kilmak tek satirlik bir soru.
PROFILES    := production preview development
DIST        ?= ./dist
IPA         ?= $(DIST)/helm-ios-$(EAS_PROFILE).ipa

# CocoaPods 1.16 + Ruby 4 bu makinede bos locale ile pod install'da
# Encoding::CompatibilityError veriyor; yerel build pod install calistirir.
export LANG   := en_US.UTF-8
export LC_ALL := en_US.UTF-8

PROFILED := ios-local-build ios-submit ios-local-release ios-cloud-build ios-cloud-release

.PHONY: help check require-profile require-store-profile require-cloud install ios-prebuild pod-install ios-codegen ios-device clean-dist $(PROFILED)

help:
	@echo "helm-mobile - iOS Makefile (yerel build + yerel IPA submit, hat her seferinde secilir)"
	@echo ""
	@echo "  make ios-local-release    Bu Mac'te IPA uret + TestFlight'a gonder (kuyruk yok)"
	@echo "  make ios-local-build      Sadece yerel IPA → $(DIST)/helm-ios-<hat>.ipa"
	@echo "  make ios-submit           Yerel IPA'yi gonder (IPA=yol ile degistir)"
	@echo "  make ios-prebuild         expo prebuild -p ios --clean + helm plugins"
	@echo "  make pod-install          pod install + pod:fix (prebuild sonrasi)"
	@echo "  make ios-codegen          ios/build silindiyse ReactCodegen'i yeniden uret"
	@echo "  make ios-device           Bagli iPhone'a debug kurulum"
	@echo "  CLOUD=1 make ios-cloud-build   EAS cloud (saatlerce kuyruk, sadece istenirse)"
	@echo ""
	@echo "  Hat: EAS_PROFILE=production|preview|development make <hedef>  (yoksa sorulur)"
	@echo "    production  → TestFlight + production kanali"
	@echo "    preview     → AdHoc IPA, sadece kayitli cihaz; TestFlight'a GIDEMEZ"
	@echo "  Once app.config.ts ios.buildNumber'i artir: TestFlight ayni numarayi reddeder."

ifndef EAS_PROFILE
# Hat verilmedi: terminaldeysen sor ve ayni hedefi secilen hatla yeniden calistir;
# terminal yoksa (CI, agent) sessizce varsayma, dur.
$(PROFILED):
	@if [ ! -t 0 ]; then \
		echo "HATA: hat secilmedi. Kullaniciya sor, sonra:"; \
		echo "  EAS_PROFILE=production|preview|development make $@"; \
		exit 1; \
	fi; \
	read -rp "Hangi hat? [production/preview/development]: " p; \
	$(MAKE) --no-print-directory $@ EAS_PROFILE="$$p"
else

ios-local-build: require-profile check
	@mkdir -p "$(DIST)"
	@echo "→ eas build --local profile=$(EAS_PROFILE) output=$(IPA)"
	eas build -p ios --profile "$(EAS_PROFILE)" --local --non-interactive --output "$(IPA)"
	@echo "→ IPA: $(IPA)"

# --path: yerelde uretilen IPA'yi gonderir. --latest KULLANMA - EAS'teki son
# CLOUD build'i secer, yerel build'i hic gormez.
ios-submit: require-store-profile check
	@test -f "$(IPA)" || (echo "IPA not found: $(IPA)" && exit 1)
	@echo "→ eas submit profile=$(EAS_PROFILE) path=$(IPA)"
	eas submit -p ios --profile "$(EAS_PROFILE)" --path "$(IPA)" --non-interactive

ios-local-release: require-store-profile ios-local-build ios-submit
	@echo "→ Done. Check App Store Connect / TestFlight for processing."

ios-cloud-build: require-cloud require-profile check
	eas build -p ios --profile "$(EAS_PROFILE)" --non-interactive

ios-cloud-release: require-cloud require-store-profile check
	eas build -p ios --profile "$(EAS_PROFILE)" --auto-submit --non-interactive

endif

require-profile:
	@case " $(PROFILES) " in *" $(EAS_PROFILE) "*) ;; *) \
		echo "HATA: bilinmeyen hat '$(EAS_PROFILE)'. Secenekler: $(PROFILES)"; exit 1;; esac

# Build'den ONCE durdur: 20 dk sonra AdHoc IPA'nin reddedildigini gormek pahali.
require-store-profile: require-profile
	@test "$(EAS_PROFILE)" = production || { \
		echo "HATA: '$(EAS_PROFILE)' hatti TestFlight'a gidemez (AdHoc/dev imza)."; \
		echo "TestFlight icin: EAS_PROFILE=production make ios-local-release"; \
		echo "Sadece cihaza kurulacak IPA icin: EAS_PROFILE=$(EAS_PROFILE) make ios-local-build"; \
		exit 1; }

require-cloud:
	@test "$(CLOUD)" = 1 || { \
		echo "HATA: cloud build kapali - ucretsiz kuyruk 5-6 saat, EXPO_TOKEN ister."; \
		echo "Yerel: make ios-local-release (15-20 dk)"; \
		echo "Yine de cloud istiyorsan: CLOUD=1 make <hedef>"; \
		exit 1; }

check:
	@command -v bun >/dev/null || (echo "bun missing" && exit 1)
	@command -v eas >/dev/null || (echo "eas-cli missing: bun add -g eas-cli" && exit 1)
	@eas whoami >/dev/null || (echo "run: eas login" && exit 1)
	@echo "ok: bun + eas ($(shell eas whoami 2>/dev/null | head -1))"

install:
	bun install

ios-prebuild:
	bun run prebuild:ios

pod-install:
	@test -d ios || (echo "run: make ios-prebuild" && exit 1)
	cd ios && pod install
	bun run pod:fix

ios-codegen:
	bun run ios:codegen

ios-device:
	bun run ios -- --device

clean-dist:
	rm -rf "$(DIST)"
