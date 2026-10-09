#!/usr/bin/env bash
# Compila o Jogar.exe (lançador para Windows) com MinGW-w64.
#   Ubuntu/Debian: sudo apt install gcc-mingw-w64-x86-64
#   Uso: scripts/build-launcher.sh [saida.exe]
# (MINGW_CC e MINGW_WINDRES permitem escolher outro compilador.)
set -euo pipefail
ORIG="${INIT_CWD:-$PWD}"
cd "$(dirname "$0")/.."
CC="${MINGW_CC:-x86_64-w64-mingw32-gcc}"
WINDRES="${MINGW_WINDRES:-x86_64-w64-mingw32-windres}"
if [ $# -ge 1 ]; then
  case "$1" in /*) OUT="$1" ;; *) OUT="$ORIG/$1" ;; esac
else
  OUT="$PWD/Jogar.exe"
fi
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
"$WINDRES" -I launcher launcher/jogar.rc -O coff -o "$tmp/res.o"
"$CC" -Os -s -municode -mwindows -Wall -Wextra -Werror \
  -Wl,--no-insert-timestamp \
  -o "$OUT" launcher/jogar.c "$tmp/res.o" -lshell32 -ladvapi32
echo "✔ $OUT ($(wc -c < "$OUT") bytes)"
