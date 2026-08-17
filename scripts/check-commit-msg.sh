#!/usr/bin/env bash
# Commit mesajı kapısı: `type(scope): WES-XXX ne değişti`, tek satır.
#
# NEDEN VAR: bu format CONTRIBUTING.md'de yazılıydı ama hiçbir şey denetlemiyordu.
# Yazılı olup denetlenmeyen kural, kural değil tavsiyedir — history'de üç farklı
# stil birikir ve `git log --grep` işe yaramaz hale gelir.
set -uo pipefail

MSG_FILE="${1:?commit mesajı dosyası bekleniyor}"
TYPES='feat|fix|refactor|chore|docs|style|perf|test|ci|build'

# Yorum ve boş satırları at. `mapfile` bilerek kullanılmıyor — bash 4+ ister,
# macOS'un varsayılan bash'i 3.2 ve hook sessizce çalışmaz hale gelirdi.
content=$(grep -v '^#' "$MSG_FILE" | sed '/^[[:space:]]*$/d')
subject=$(printf '%s\n' "$content" | head -1)
line_count=$(printf '%s' "$content" | grep -c '' || true)

die() {
  printf '\n\033[31m✗ Commit mesajı reddedildi\033[0m\n\n  %s\n\n' "$1"
  printf 'Beklenen:  \033[36mtype(scope): WES-XXX ne değişti\033[0m\n'
  printf 'Örnek:     fix(ingest): WES-000 stop dropping rows when currency is null\n\n'
  printf 'type:      %s\n' "$TYPES"
  printf 'scope:     etkilenen alan — mobile, web, domain, ingest, root\n'
  printf 'WES-XXX:   issue no yoksa WES-000\n\n'
  printf '\033[33m--no-verify KULLANMA.\033[0m Kural yanlışsa scripts/check-commit-msg.sh düzeltilir.\n\n'
  exit 1
}

# Merge ve revert commit'leri git üretir, formatı bizim elimizde değil.
case "$subject" in
  Merge\ *|Revert\ *) exit 0 ;;
esac

[ -n "$subject" ] || die "Mesaj boş."

if ! printf '%s' "$subject" | grep -qE "^($TYPES)\([a-z0-9-]+\): WES-[0-9]+ .+"; then
  die "Konu satırı formata uymuyor:
  \"$subject\""
fi

# Tek satır kuralı: gövde yazmak yerine mesajı kısa ve NEDEN odaklı tut.
if [ "$line_count" -gt 1 ]; then
  die "Çok satırlı mesaj. Tek satır bekleniyor — $line_count satır var."
fi

# Ajan imzası history'ye girmez.
if grep -qi '^Co-Authored-By:' "$MSG_FILE"; then
  die "Co-Authored-By trailer'ı kaldır."
fi

exit 0
