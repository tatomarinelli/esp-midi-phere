# Caja

Diseño vigente: `esp-midi-phere-top-template-v7` (`.scad` es la fuente; `.svg` y `.pdf` tienen que quedar en sincronía exacta con él).

- Panel de 200 x 130 mm; caja de 30 mm de alto (33 mm con tapa) con 4 postes de esquina M1-M4, a 7 mm de ambos bordes.
- 12 pots en 6 pares de barras LED, en 2 filas. Cada bloque LED + pot mide unos 23,7 mm de alto. Separación entre barras de una fila: 10 mm.
- 8 botones de canal (B1-B8): Omron B3F-4055 en dos perfboards de 70 mm, paso de 15,24 mm entre botones. Los agujeros de tornillo S1-S4 de la perfboard se perforan a mano.
- Barra LED de estado (L7).

Sin resolver:
- La perfboard de 70 x 30 mm puede chocar en X/Y con L7; depende de la profundidad Z, que no está modelada.
- Nunca se midió el cuerpo real del pote contra el bloque de 23,7 mm. Medir antes de imprimir.
- No hay STL de v7. Generar con `openscad -o out.stl -D 'part="shell|panel|preview"' esp-midi-phere-top-template-v7.scad`. El `openscad` local falló por una librería faltante (`libboost_program_options.so.1.92.0`) la última vez que se probó.

`timeshare-enclosure.scad` es otra caja, independiente: el switcher analógico de audio (ver `../README.md`).
