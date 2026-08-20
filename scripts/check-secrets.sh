#!/usr/bin/env bash
# Sır tarayıcı. Placeholder'ları elemek için iki aşamalı: önce yüksek-sinyal
# format eşleşmesi, sonra "bu gerçek mi?" filtresi. Amaç sıfır false-positive -
# gürültü yapan hook, --no-verify'a davetiyedir.
#
#   ./scripts/check-secrets.sh staged    # sadece stage'lenmiş içerik (pre-commit)
#   ./scripts/check-secrets.sh tree      # tracked dosyaların tamamı (CI)
#   ./scripts/check-secrets.sh history   # tüm git history - yavaş, denetim için
set -uo pipefail

MODE="${1:-staged}"
SELF="scripts/check-secrets.sh"

# Gerçek credential formatları. Her biri yeterince uzun ki rastgele metin eşleşmesin.
PATTERNS='eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}
AKIA[0-9A-Z]{16}
ASIA[0-9A-Z]{16}
sk_live_[A-Za-z0-9]{20,}
rk_live_[A-Za-z0-9]{20,}
sk-ant-[A-Za-z0-9_-]{24,}
gh[pousr]_[A-Za-z0-9]{36}
github_pat_[A-Za-z0-9_]{50,}
xox[baprs]-[A-Za-z0-9-]{20,}
AIza[0-9A-Za-z_-]{35}
sbp_[a-f0-9]{40}
sb_secret_[A-Za-z0-9_-]{20,}
sntrys_[A-Za-z0-9+/=]{40,}
glpat-[A-Za-z0-9_-]{20}
dop_v1_[a-f0-9]{64}
shpat_[a-f0-9]{32}
SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}
npm_[A-Za-z0-9]{36}
https://[0-9a-f]{32}@[a-zA-Z0-9.-]+/[0-9]+
-----BEGIN [A-Z ]*PRIVATE KEY-----[[:space:]]+[A-Za-z0-9+/]{40}
[A-Z0-9_]*(PASSWORD|PASSWD|SECRET)[A-Z0-9_]*[=:][[:space:]]*"?[A-Za-z0-9!@#%^&*_+-]{12,}'

# Şablon/örnek değerler - eşleşse bile sır değil.
PLACEHOLDER='\.\.\.|<[a-z-]+>|\{\{|\$\{|your[-_]|YOUR_|xxxx|XXXX|placeholder|PLACEHOLDER|example|EXAMPLE|changeme|CHANGEME|process\.env|Deno\.env|import\.meta\.env'

RE=$(printf '%s' "$PATTERNS" | paste -sd'|' -)
found=0

report() { # path, matches
  printf '\n\033[31m✗ %s\033[0m\n' "$1"
  printf '%s\n' "$2" | sed 's/^/    /' | cut -c1-160
  found=1
}

scan_stdin() { grep -aInE "$RE" | grep -avE "$PLACEHOLDER" | head -5; }

case "$MODE" in
  staged)
    while IFS= read -r f; do
      [ "$f" = "$SELF" ] && continue
      m=$(git show ":$f" 2>/dev/null | scan_stdin)
      [ -n "$m" ] && report "$f" "$m"
    done < <(git diff --cached --name-only --diff-filter=ACM)
    ;;
  tree)
    while IFS= read -r f; do
      [ "$f" = "$SELF" ] && continue
      m=$(scan_stdin < "$f" 2>/dev/null)
      [ -n "$m" ] && report "$f" "$m"
    done < <(git ls-files)
    ;;
  history)
    # Tüm ref'lerdeki her blob. 2MB üstü binary atlanır.
    # NOT: while'a pipe ile beslemek onu subshell'e sokar ve `found` kaybolur -
    # tarama bulgu yazdırıp exit 0 döner. Process substitution şart.
    objects=$(mktemp); trap 'rm -f "$objects"' EXIT
    git rev-list --objects --all > "$objects"
    while IFS= read -r sha; do
      m=$(git cat-file blob "$sha" 2>/dev/null | scan_stdin)
      [ -n "$m" ] || continue
      p=$(grep -m1 "^$sha " "$objects" | cut -d' ' -f2-)
      [ "$p" = "$SELF" ] && continue
      report "$p  (blob $sha)" "$m"
    done < <(awk '{print $1}' "$objects" \
      | git cat-file --batch-check='%(objectname) %(objecttype) %(objectsize)' 2>/dev/null \
      | awk '$2=="blob" && $3<2000000 {print $1}')
    ;;
  *)
    echo "kullanım: $0 [staged|tree|history]" >&2; exit 2 ;;
esac

if [ "$found" -ne 0 ]; then
  printf '\n\033[31mSır tespit edildi - commit durduruldu.\033[0m\n'
  printf 'Gerçekse: değeri .env'"'"'e taşı, .env.example'"'"'e placeholder koy.\n'
  printf 'Yanlış alarmsa: pattern'"'"'ı %s içinde daralt. --no-verify KULLANMA.\n' "$SELF"
  exit 1
fi
printf '\033[32m✓ sır bulunamadı (%s)\033[0m\n' "$MODE"
