#!/usr/bin/env bash
# Gera PitchInvaders.zip: a pasta pronta a jogar (Jogar.exe, Jogar-Mac-Linux.command,
# LEIA-ME.txt e dist/PitchInvaders.html) que o README liga para download.
# Corre depois de alterar o jogo ou o lançador:  npm run pacote
#   Uso: scripts/package.sh [saida.zip]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-PitchInvaders.zip}"
case "$OUT" in /*) ;; *) OUT="$PWD/$OUT" ;; esac

node scripts/build.mjs

# O Jogar.exe é recompilado sempre que houver MinGW (o resultado é determinístico).
# Sem MinGW, só se aceita o Jogar.exe existente se for mais recente do que o código.
if command -v "${CC:-x86_64-w64-mingw32-gcc}" >/dev/null 2>&1; then
  bash scripts/build-launcher.sh
else
  for src in launcher/jogar.c launcher/jogar.rc launcher/jogar.manifest launcher/icon.ico scripts/build-launcher.sh; do
    if [ ! -f Jogar.exe ] || [ "$src" -nt Jogar.exe ]; then
      echo "✖ O Jogar.exe tem de ser recompilado ($src mudou), mas o MinGW-w64 não está instalado." >&2
      echo "  Ubuntu/Debian: sudo apt install gcc-mingw-w64-x86-64" >&2
      exit 1
    fi
  done
  echo "ℹ MinGW-w64 não encontrado: uso o Jogar.exe existente (está atualizado)."
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/dist"
cp Jogar.exe Jogar-Mac-Linux.command "$tmp/"
cp dist/PitchInvaders.html "$tmp/dist/"
# UTF-8 com BOM e quebras de linha do Windows, para o Bloco de Notas mostrar bem os acentos.
{ printf '\xEF\xBB\xBF'; sed 's/$/\r/' launcher/LEIA-ME.txt; } > "$tmp/LEIA-ME.txt"
chmod 755 "$tmp/Jogar-Mac-Linux.command" "$tmp/dist"
chmod 644 "$tmp/Jogar.exe" "$tmp/dist/PitchInvaders.html" "$tmp/LEIA-ME.txt"
# Datas fixas (em UTC) para o ZIP só mudar quando o conteúdo muda.
find "$tmp" -exec env TZ=UTC touch -h -d '2026-01-01 12:00:00' {} +
rm -f "$OUT"
(cd "$tmp" && TZ=UTC zip -q -X -9 -r "$OUT" Jogar.exe Jogar-Mac-Linux.command LEIA-ME.txt dist)
echo "✔ $(basename "$OUT") ($(wc -c < "$OUT") bytes)"
