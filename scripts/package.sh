#!/usr/bin/env bash
# Gera PitchInvaders.zip: a pasta pronta a jogar (Jogar.exe, Jogar-Mac-Linux.command,
# LEIA-ME.txt e dist/PitchInvaders.html) que o README liga para download.
# Corre depois de alterar o jogo ou o lançador:  npm run pacote
#   Uso: scripts/package.sh [saida.zip]
set -euo pipefail
ORIG="${INIT_CWD:-$PWD}"
cd "$(dirname "$0")/.."
if [ $# -ge 1 ]; then
  case "$1" in /*) OUT="$1" ;; *) OUT="$ORIG/$1" ;; esac
else
  OUT="$PWD/PitchInvaders.zip"
fi

node scripts/build.mjs

# O Jogar.exe é recompilado sempre que houver MinGW (o resultado é determinístico).
# Sem MinGW, aceita-se o Jogar.exe do repositório se nem ele nem o código do lançador
# tiverem alterações locais (o CI garante que o exe do commit corresponde ao código).
LAUNCHER_SRC=(launcher/jogar.c launcher/jogar.rc launcher/jogar.manifest launcher/icon.ico scripts/build-launcher.sh)
if command -v "${MINGW_CC:-x86_64-w64-mingw32-gcc}" >/dev/null 2>&1; then
  bash scripts/build-launcher.sh
elif [ -f Jogar.exe ] && git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
     && git diff --quiet HEAD -- Jogar.exe "${LAUNCHER_SRC[@]}" 2>/dev/null; then
  echo "ℹ MinGW-w64 não encontrado: uso o Jogar.exe do repositório (o lançador não mudou)."
else
  echo "✖ O Jogar.exe tem de ser recompilado (o lançador mudou), mas o MinGW-w64 não está instalado." >&2
  echo "  Ubuntu/Debian: sudo apt install gcc-mingw-w64-x86-64" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/dist"
cp Jogar.exe Jogar-Mac-Linux.command "$tmp/"
cp dist/PitchInvaders.html "$tmp/dist/"
# UTF-8 com BOM e quebras de linha do Windows, para o Bloco de Notas mostrar bem os acentos.
{ printf '\xEF\xBB\xBF'; tr -d '\r' < launcher/LEIA-ME.txt | awk '{ printf "%s\r\n", $0 }'; } > "$tmp/LEIA-ME.txt"
chmod 755 "$tmp/Jogar-Mac-Linux.command" "$tmp/dist"
chmod 644 "$tmp/Jogar.exe" "$tmp/dist/PitchInvaders.html" "$tmp/LEIA-ME.txt"
# Datas fixas (em UTC) para o ZIP só mudar quando o conteúdo muda.
find "$tmp" -exec env TZ=UTC touch -h -t 202601011200.00 {} +
rm -f "$OUT"
(cd "$tmp" && TZ=UTC zip -q -X -9 -r "$OUT" Jogar.exe Jogar-Mac-Linux.command LEIA-ME.txt dist)
echo "✔ $OUT ($(wc -c < "$OUT") bytes)"
