#!/usr/bin/env bash
# Pitch Invaders — lançador para macOS e Linux.
#
# Abre o jogo numa janela própria, sem barra de endereço (Chrome, Edge, Brave ou
# Chromium em modo "app"). Se nenhum existir, abre no browser predefinido.
#   macOS: duplo clique (na primeira vez o Mac pede autorização em
#          Definições do Sistema → Privacidade e segurança → Abrir na mesma).
#   Linux: ./Jogar-Mac-Linux.command

DIR="$(cd "$(dirname "$0")" && pwd)"
GAME="$DIR/dist/PitchInvaders.html"
[ -f "$GAME" ] || GAME="$DIR/PitchInvaders.html"

fail() {
  echo "$1" >&2
  if [ "$(uname)" = "Darwin" ]; then
    osascript -e 'on run argv' -e 'display dialog (item 1 of argv) with title "Pitch Invaders" buttons {"OK"} with icon caution' -e 'end run' "$1" >/dev/null 2>&1
  elif command -v zenity >/dev/null 2>&1; then
    zenity --warning --title="Pitch Invaders" --text="$1" >/dev/null 2>&1
  fi
  exit 1
}

[ -f "$GAME" ] || fail "Não encontrei o ficheiro do jogo (dist/PitchInvaders.html). Se descarregaste o jogo em ZIP, extrai primeiro a pasta toda e abre o Jogar-Mac-Linux.command que está dentro dela."

# Caminho -> URL file:// (UTF-8 com percent-encoding). Usa "od" para ler os bytes,
# o que funciona igual em qualquer locale e no bash 3.2 do macOS.
urlencode() {
  local out="" b
  for b in $(printf '%s' "$1" | od -An -v -tx1); do
    case "$b" in
      2d|2e|2f|5f|7e|3[0-9]|4[1-9a-f]|5[0-9a]|6[1-9a-f]|7[0-9a]) out="$out$(printf "\\x$b")" ;;
      *) out="$out%$(printf '%s' "$b" | tr 'a-f' 'A-F')" ;;
    esac
  done
  printf '%s' "$out"
}
URL="file://$(urlencode "$GAME")"
FLAGS=(--app="$URL" --start-maximized --no-first-run --no-default-browser-check)

if [ "$(uname)" = "Darwin" ]; then
  for app in "Google Chrome" "Microsoft Edge" "Brave Browser" "Chromium"; do
    open -na "$app" --args "${FLAGS[@]}" >/dev/null 2>&1 && exit 0
  done
  open "$GAME" && exit 0
else
  # Ignorar SIGHUP: se o script for o próprio processo do terminal ("Executar no
  # terminal"), o terminal fecha ao sair e não pode levar o browser consigo.
  trap '' HUP
  for b in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge microsoft-edge-stable brave-browser; do
    if command -v "$b" >/dev/null 2>&1; then
      nohup "$b" "${FLAGS[@]}" >/dev/null 2>&1 &
      exit 0
    fi
  done
  if command -v xdg-open >/dev/null 2>&1; then
    nohup xdg-open "$GAME" >/dev/null 2>&1 &
    exit 0
  fi
fi

fail "Não consegui abrir um browser. Abre manualmente o ficheiro dist/PitchInvaders.html."
