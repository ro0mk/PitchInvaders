#!/usr/bin/env bash
# Compila o Jogar.exe (lançador para Windows) com MinGW-w64.
#   Ubuntu/Debian: sudo apt install gcc-mingw-w64-x86-64
#   Uso: scripts/build-launcher.sh [saida.exe]
set -euo pipefail
cd "$(dirname "$0")/.."
CC="${CC:-x86_64-w64-mingw32-gcc}"
WINDRES="${WINDRES:-x86_64-w64-mingw32-windres}"
OUT="${1:-Jogar.exe}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
"$WINDRES" -I launcher launcher/jogar.rc -O coff -o "$tmp/res.o"
"$CC" -Os -s -municode -mwindows -Wall -Wextra -Werror \
  -Wl,--no-insert-timestamp \
  -o "$OUT" launcher/jogar.c "$tmp/res.o" -lshell32 -ladvapi32
echo "✔ $OUT ($(wc -c < "$OUT") bytes)"
