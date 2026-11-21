#!/usr/bin/env bash
# Installiert die Ansicht "material" als Unterordner in ein vorhandenes
# Smart-Home-Dashboard. Sie nutzt dessen Controller, Store und Texte (../js/).
#
#   sudo ./install.sh [Ordner des Dashboards]
#
# Ohne Ordner: /etc/openhab/html/dashboard (openHAB als Paket installiert).
set -euo pipefail
NAME="material"
ZIEL="${1:-/etc/openhab/html/dashboard}"
HIER="$(cd "$(dirname "$0")" && pwd)"

[ -f "$ZIEL/config.js" ] || {
  echo "Kein Dashboard in $ZIEL (config.js fehlt)." >&2; exit 1; }
[ -f "$ZIEL/js/controller.js" ] || {
  echo "Das Dashboard in $ZIEL ist zu alt (js/controller.js fehlt)." >&2
  echo "Bitte zuerst Smart-Home-Dashboard aktualisieren." >&2; exit 1; }

rm -rf "$ZIEL/$NAME"
cp -r "$HIER/$NAME" "$ZIEL/$NAME"
chmod -R a+rX "$ZIEL/$NAME"
echo "Ansicht $NAME installiert in $ZIEL/$NAME"
echo "Aufruf: http://<openhab>:8080/static/dashboard/$NAME/"
