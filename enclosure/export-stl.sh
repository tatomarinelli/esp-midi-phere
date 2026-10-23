#!/bin/sh
# Regenera los STL a imprimir y los deja donde los lee la pestaña Cableado de la GUI (vista "Piezas a imprimir").
# Uso: ./export-stl.sh   (desde enclosure/; necesita openscad)
set -e
cd "$(dirname "$0")"
SCAD=esp-midi-phere-top-template-v7.scad
OUT=../gui/assets/models
mkdir -p "$OUT"
openscad -o "$OUT/panel_print.stl" --export-format binstl -D 'part="panel_print"' "$SCAD"
openscad -o "$OUT/shell.stl" --export-format binstl -D 'part="shell"' "$SCAD"
ls -l "$OUT"
