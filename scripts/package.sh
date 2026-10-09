#!/usr/bin/env bash
# Gera PitchInvaders.zip: a pasta pronta a jogar (Jogar.exe, Jogar.command,
# dist/PitchInvaders.html e LEIA-ME.txt) que o README liga para download.
# Corre depois de alterar o jogo:  npm run pacote
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/build.mjs
[ -f Jogar.exe ] || bash scripts/build-launcher.sh
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/dist"
cp Jogar.exe Jogar.command "$tmp/"
cp dist/PitchInvaders.html "$tmp/dist/"
{ printf '\xEF\xBB\xBF'; sed 's/$/\r/' launcher/LEIA-ME.txt; } > "$tmp/LEIA-ME.txt"   # UTF-8 com BOM e quebras de linha do Windows
chmod 755 "$tmp/Jogar.command" "$tmp/dist"
chmod 644 "$tmp/Jogar.exe" "$tmp/dist/PitchInvaders.html" "$tmp/LEIA-ME.txt"
# Datas fixas para o ZIP só mudar quando o conteúdo muda.
find "$tmp" -exec touch -h -d '2026-01-01 12:00:00' {} +
rm -f PitchInvaders.zip
(cd "$tmp" && TZ=UTC zip -q -X -9 -r "$OLDPWD/PitchInvaders.zip" Jogar.exe Jogar.command LEIA-ME.txt dist)
echo "✔ PitchInvaders.zip ($(wc -c < PitchInvaders.zip) bytes)"
