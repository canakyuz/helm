# helm-mobile - local iOS release (EAS cloud quota bypass)
# Requires: macOS, Xcode, bun, eas-cli, Apple team AZPJSKX9C9

SHELL := /bin/bash
.DEFAULT_GOAL := help

EAS_PROFILE ?= preview
DIST        ?= ./dist
IPA         ?= $(DIST)/helm-ios-$(EAS_PROFILE).ipa

.PHONY: help check install ios-prebuild pod-install ios-codegen ios-local-build ios-submit ios-local-release ios-cloud-build ios-device clean-dist

help:
	@echo "helm-mobile - iOS Makefile"
	@echo ""
	@echo "  make ios-local-release    Build IPA on this Mac + submit TestFlight (no cloud slot)"
	@echo "  make ios-local-build      Local EAS build only → $(IPA)"
	@echo "  make ios-submit           Submit IPA (set IPA=path if not default)"
	@echo "  make ios-prebuild         expo prebuild -p ios --clean + helm plugins"
	@echo "  make pod-install          pod install + pod:fix (after prebuild)"
	@echo "  make ios-codegen          Regenerate ReactCodegen if ios/build was deleted"
	@echo "  make ios-device           Debug install on connected iPhone"
	@echo "  make ios-cloud-build      EAS cloud build (uses monthly quota)"
	@echo ""
	@echo "  EAS_PROFILE=production make ios-local-release"
	@echo "  IPA=./my.ipa make ios-submit"

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

# Local EAS build - does not consume Expo cloud build quota
ios-local-build: check
	@mkdir -p "$(DIST)"
	@echo "→ eas build --local profile=$(EAS_PROFILE) output=$(IPA)"
	eas build -p ios --profile "$(EAS_PROFILE)" --local --output "$(IPA)"
	@echo "→ IPA: $(IPA)"

ios-submit: check
	@test -f "$(IPA)" || (echo "IPA not found: $(IPA)" && exit 1)
	@echo "→ eas submit profile=$(EAS_PROFILE) path=$(IPA)"
	eas submit -p ios --profile "$(EAS_PROFILE)" --path "$(IPA)" --non-interactive

ios-local-release: ios-local-build ios-submit
	@echo "→ Done. Check App Store Connect / TestFlight for processing."

# Cloud build (when free quota available)
ios-cloud-build: check
	eas build -p ios --profile "$(EAS_PROFILE)" --non-interactive

ios-cloud-release: check
	eas build -p ios --profile "$(EAS_PROFILE)" --auto-submit --non-interactive

ios-device:
	bun run ios -- --device

clean-dist:
	rm -rf "$(DIST)"
