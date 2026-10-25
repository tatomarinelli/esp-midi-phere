# Caja

Diseño vigente: `esp-midi-phere-top-template-v7` (`.scad` es la fuente; `.svg` y `.pdf` tienen que quedar en sincronía exacta con él).

- Panel de 200 x 130 mm; caja de 30 mm de alto (33 mm con tapa) con 4 postes de esquina M1-M4, a 7 mm de ambos bordes.
- 12 pots en 6 pares de barras LED, en 2 filas. Cada bloque LED + pot mide unos 23,7 mm de alto. Separación entre barras de una fila: 10 mm.
- 8 botones de canal (B1-B8): Omron B3F-4055 en dos perfboards de 70 mm, paso de 15,24 mm entre botones. Los agujeros de tornillo S1-S4 de la perfboard se perforan a mano.
- Barra LED de estado (L7).

Añadido a la caja (2026-10-23; el panel no cambió, así que el .svg/.pdf siguen válidos). Todo es paramétrico al principio del `.scad` y replica `gui/wiring.js`:
- **Placa soldable** (`proto_*`, 48 x 62 mm supuestos) con 4 separadores de 2,5 mm con piloto y esquineros, separada de la pared.
- **Extensor USB-C** (`ext_*`) en la pared superior, a baja altura y lejos de la placa (su ficha mide 25 mm de ancho y 35 mm de fondo): solo el corte para el cuerpo del conector (la ficha trae sus agujeros y se deja en el borde, con el conector y los tornillos a la vista), un soporte abierto bajo el plug en L, por ahora ninguna guía para el cable USB (se itera más adelante); el cable apoya suelto en el piso. Modelo comprado: YINGAYOU USB-C hembra de panel a macho en ángulo de 90°, 30 cm. La brida va por fuera de la pared. La separación de agujeros (20 mm) está estimada de la foto: medila.
- **Arcos en la tapa** (`lid_channels`, `arch_pitch`, `wire_od`): en vez de canales continuos, dos patas cortas y una tira de 1 mm cada 35 mm por los pasillos libres entre barras, potes y pared (alimentación y datos de las barras, puente L3-L4, L7, y los cables de los botones, que suben desde abajo de la perfboard y corren contra el panel por un pasillo angosto (4,2 mm) al norte de L7, apilados de a dos, junto con los puentes de GND y 3V3 de la fila 2 de potes). Entre el panel y la tira queda una luz de `wire_od + 0,6` mm (1,4 mm con el cable supuesto de 0,8 mm): alcanza para pasar los cables finos y no los deja bailar. Los cables se pasan por los arcos antes de soldar el otro extremo.
- **Agarres colgantes** (`lid_grips`): 4 pilares que cuelgan de la tapa en los huecos entre potes, 2 por fila, cada uno con 3 agujeros cerrados: el bus de 3V3, los cursores de esa fila (apilados en un agujero alto: corren por la línea de las patas, a alturas distintas) y el bus de GND. Los cables se pasan por dentro. No hay ninguna guía en el hueco entre L5 y L6 (ahí van los puentes soldados de las barras) ni en el piso. La placa queda en el piso y se deja 6-8 cm de cable de sobra para abrir sin desoldar.
- **Peines del USB** (los únicos en el piso, porque el cable USB queda en la base): placas con muesca en U que sujetan los haces (alimentación de LED junto a la pared superior, puente largo L3-L4, haz de cursores de los pots).

**Cómo se imprime** (la vista «Piezas a imprimir» de la pestaña Cableado de la GUI muestra estas dos piezas en su orientación, con los voladizos de más de 45° en rojo; `export-stl.sh` regenera los STL en `gui/assets/models/`) (2 piezas, sin soportes; todo en PLA o PETG, capa de 0,2 mm, 3 perímetros):
1. **Panel (tapa)**, pieza única de 200 x 130 mm con rieles, labios y agarres: `openscad -o panel.stl -D 'part="panel_print"' esp-midi-phere-top-template-v7.scad`. Sale ya girado, con la cara frontal sobre la cama; altura total unos 22 mm. Necesita una cama de al menos 200 x 130 mm.
2. **Caja (base)**, pieza única de 200 x 130 x 30 mm con el piso sobre la cama: `-D 'part="shell"'`.
Las dos juntas dan la tapa y la base; lo demás (placa, perfboards, extensor) se compra. Los arcos (tira de 1 mm, hasta 8 mm de luz) y el techo de los agujeros de los agarres se imprimen como puentes cortos, sin soportes. Imprimí primero un trozo de prueba (un arco y un agarre) para comprobar que tus cables pasan y no bailan; si no, ajustá `wire_od`.

**Impresiones de prueba** (`test-prints/`, se regeneran con `export-stl.sh`; imprimir antes de la tapa y la base enteras):
1. `test_holes.stl` (~10 min): 3 agujeros de pote (7,3 / 7,5 / 7,7 mm) y 3 ventanas de botón (12,3 / 12,5 / 12,7 mm), de izquierda a derecha. Probá tus potes y tus botones.
2. `test_usbcut.stl` (~8 min): la esquina de la pared superior con la abertura del extensor USB-C; probá el cuerpo de la ficha.
3. `test_socket.stl` (~20 min): el piso con los 4 separadores y los esquineros de la placa; apoyá tu protoboard.
4. `test_lid.stl` (~30 min en PETG): los 100 × 45 mm de arriba a la izquierda de la tapa real (agujero M1, ventana de L1, potes 1 y 2, el pasillo superior con sus arcos, el agarre de la fila 1 con sus 3 agujeros). Es la prueba más importante: pasá tus cables por un arco y por los agujeros del agarre. Si no pasan o bailan, ajustá `wire_od` y los tamaños de agujero.

Sin resolver:
- Cable del extensor: 24 cm más un plug en L de 20 mm. Entre la pared y el puerto del ESP hay 22 mm, así que el plug entra justo. Confirmar la sección de la ficha detrás de la brida (se supuso 14 × 9 mm).
- La perfboard de 70 x 30 mm puede chocar en X/Y con L7; depende de la profundidad Z, que no está modelada.
- Nunca se midió el cuerpo real del pote contra el bloque de 23,7 mm. Medir antes de imprimir.
- No hay STL de v7. Generar con `openscad -o out.stl -D 'part="shell|panel|preview"' esp-midi-phere-top-template-v7.scad`. El `openscad` local (2021.01) funciona y la caja renderiza a un STL válido.

`timeshare-enclosure.scad` es otra caja, independiente: el switcher analógico de audio (ver `../README.md`).
