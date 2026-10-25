# Estado del proyecto (actualizado 2026-10-20)

Documentación técnica en `docs/`: `sysex.md` (protocolo y config), `bootloader.md` (modo descarga, flasheo, cómo volver) y `remote-script.md` (script de Ableton). Al cambiar el comportamiento de alguna de esas piezas, actualizar su doc.

## Piezas

| Pieza | Dónde | Estado |
|---|---|---|
| Firmware | `../esp-midi-phere.ino` (v0.1.0) | Probado en hardware: SysEx, NVS, bootloader por software. Versión previa a SysEx recuperable del commit inicial de git |
| GUI web | este repo (`index.html`, `app.js`, `style.css`) | Funciona; probada con el ESP real desde Chrome (confirmado por el usuario 2026-10-23) |
| Remote Script | `../ableton-remote-script/ESP_MIDI_Phere/` | `v2` genérica: lee la config del ESP por SysEx al cargar y mapea Macros por nombre (probada en Live bajo Wine); sends y botones pendientes. Script anterior recuperable del commit inicial de git. Copiado a `Documents/Ableton/User Library/Remote Scripts/` y a la carpeta interna de Live (prefijo Wine `/mnt/plexdata/ableton/wineprefix-d2d1`). Paso 1 hecho; ver `docs/remote-script.md` |
| Pruebas | `../tests/` | `pots_test`, `led_bars_test`, `buttons_test`: sketches sueltos para flashear y verificar una pieza. Compilan; sin probar en hardware. Prototipos viejos eliminados (recuperables del commit inicial de git) |
| Caja | `../enclosure/*v7*` | Render cenital en `assets/box-v7-top.png` |

Pestaña **Cableado** (`wiring.js`, three.js local en `assets/vendor/three/`, carga perezosa): esquema 3D interactivo de la caja v7 con capas, corte en profundidad, presets de cámara y clic en un cable/componente para ver su red. Las alturas y el orden físico de pines del ESP y del HW-178 son aproximados (verificar contra la placa); el pin de datos de L7 es provisorio (GP43). Vistas fijas (Cableado LEDs / pots / botones) con tabla de pines, capas separadas con «solo», los soportes impresos de la caja los rieles de la tapa para cables finos y la vista «Piezas a imprimir» (STL reales en `assets/models/`, regenerables con `enclosure/export-stl.sh`). Verificada solo con capturas de Chromium headless, sin probar a mano el clic/arrastre. Si cambia el layout de `enclosure/*v7*`, actualizar las constantes de geometría al inicio de `wiring.js`.

Servir la GUI: `python3 -m http.server 8000` y abrir `http://localhost:8000` en Chrome/Edge (`/#preview` abre la pestaña Preview).

## Diseño de la GUI

Sin header: todo lo operativo vive en la **barra lateral izquierda** ("tira del dispositivo", grafito oscuro como las ventanas LED del panel): estado y mensaje, puertos MIDI + Conectar, secciones, Leer/Aplicar/Guardar, Exportar/Importar y Bootloader. El contenido es claro (u oscuro según el sistema) con hojas translúcidas; cada sección tiene título y una línea que explica qué se configura. Los resultados de cada acción salen además como aviso abajo a la derecha. Tipografía Barlow local (`assets/fonts/`, funciona offline). El ámbar LED solo se enciende para estados vivos: conexión, sección activa, **Guardar con cambios sin guardar** (con contador) y carga (barra de 4 segmentos + spinner, acciones bloqueadas, contenido en esqueleto). Al **Conectar** o **Leer** se carga la config del ESP y se refrescan todas las vistas; si el ESP no tiene config guardada se muestran los valores por defecto. En pantallas estrechas la barra pasa arriba y las secciones se desplazan en horizontal.

## Decisiones tomadas

- **GUI web** (Web MIDI + SysEx), config **guardada en el ESP** (NVS) y respaldo JSON exportable. Empaquetado (PWA/Electron) pospuesto.
- **Botones:** cada botón tiene una función: `monitor` (IN-AUTO o IN-AUTO-OFF), `channel-left`, `channel-right`, `midi-only`. Más `note` y `ch` MIDI. El monitoreo actúa sobre las **pistas de Live indicadas por número** (1-based, sin retornos ni master).
- **Pots:** un destino por pot, sin mezclar tipos: `macro` (por nombre) o `send` (letra A-F + pistas). Con varias pistas todas saltan al mismo valor (sin pickup); la barra LED sigue al **primer** destino.
- **Brillo LED:** 0-100 %, donde 100 % = valor crudo 40 (tope seguro por consumo USB).
- **Segmentos:** máximo 4 por pot (cada stick de 8 píxeles lo comparten 2 pots).
- **Canal MIDI de pots:** solo afecta los CC de salida; la entrada de LEDs queda fija en CC20+ canal 1.
- Botón "Todos" en los encabezados de las columnas donde tiene sentido (no en CC, nombre de Macro ni pistas).
- Botón **Bootloader** siempre visible en el header.

## Esquema de config (JSON)

Ver `docs/sysex.md`. Claves: `pots[]`, `leds[]`, `targets[]`, `buttons[]`. El firmware solo interpreta `pots` y `leds`; guarda el resto tal cual para la GUI y el Remote Script.

## Probado en hardware (firmware 0.1.0)

PING, GET con flash vacía, 14 chunks + APPLY, mapeo en vivo (CC77/ch5), SAVE + reenchufe (config idéntica byte a byte), RESET, ENTER_BOOTLOADER, flasheo **sin BOOT** de vuelta a `303a:822b`.

## Sin probar

- Barras LED con la config nueva (color, brillo, segmentos, modo centro) y el barrido CC20-25 contra el script actual: no había barras conectadas.
- Reenchufe desde modo descarga sin reflashear (riesgo de caja "atascada").
- El resaltado de cambios de la pestaña Preview con ediciones reales.

## Pendiente / siguiente

1. **Remote Script genérico** (en partes): ~~(a) leer la config por SysEx al arrancar~~ hecho y probado; (b) sends, (c) botones de monitoreo. Flujo de uso: editar en la GUI, cerrar la pestaña, abrir Ableton; la config no se cambia en caliente (ver `docs/remote-script.md`). Confirmado: Live entrega SysEx al script. Plataforma objetivo: Windows (Linux/Wine no es prioridad). Un solo código para N pots (hoy hay un método por pot por límite de `subject_slot`).
2. Firmware: leer botones por mux HC4067 (S0-S3 = GPIO14/16/17/18, SIG = 15, propuestos; primero validar con `tests/buttons_test`, luego sumar al firmware), pots 11-12 (ADC2), LEDs de estado, enviar notas de botones.
3. Fase 5: actualizar firmware desde el navegador (esptool-js).
4. Opcional, baja prioridad: que la GUI solo acepte trozos de config que respondan a sus propias peticiones; actualizar solo el ángulo de las perillas en la Preview en vez de redibujar todo el SVG.
5. `channel-left/right`: mueven el canal (pista) activo, igual que las flechas del teclado en Live. Duda abierta: cuántos botones por canal.
6. Pots sin conectar (pin flotante = ruido): campo `enabled` por pot implementado en firmware, GUI y `docs/sysex.md` (2026-10-23), **sin compilar ni probar en hardware**. Respaldo opcional: 100 kΩ a GND en pines vacíos.

## Cómo flashear

Placa: `esp32:esp32:waveshare_esp32_s3_zero:USBMode=default` (mantiene PID `822b`). Con la app corriendo, el botón Bootloader de la GUI (o SysEx `F0 7D 50 07 <seq> F7`) pone el ESP en modo descarga sin tocar BOOT. Solo hace falta BOOT para el primer flasheo de un firmware sin SysEx o si la app está colgada.
