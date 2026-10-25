# SysEx: cómo habla la GUI con el ESP

La GUI (Web MIDI) y el firmware se hablan por SysEx sobre el mismo puerto USB-MIDI que usan los pots y las barras. Sirve para leer, aplicar y guardar la config, y para pedirle al ESP que entre en modo bootloader (ver `bootloader.md`).

## Trama

    F0 7D 50 <cmd> <seq> <payload...> F7

- `7D` es el ID de fabricante para uso no comercial y `50` ("P") identifica a este controlador.
- `seq` (0-127) lo pone quien pregunta. Toda respuesta lo devuelve en el mismo lugar, así la GUI sabe a qué petición corresponde.
- Todos los bytes son de 7 bits. El JSON de la config va en ASCII (lo no ASCII se escapa como `\uXXXX`).
- En USB-MIDI la trama viaja en paquetes de 4 bytes. El firmware la rearma según el CIN del paquete: `4` continúa, `5`, `6` y `7` terminan con 1, 2 o 3 bytes.

## Comandos

| cmd | nombre | sentido | payload |
|---|---|---|---|
| `01` | PING | GUI → ESP | vacío. Responde PONG |
| `41` | PONG | ESP → GUI | versión en ASCII, por ejemplo `0.1.0` |
| `02` | GET_CONFIG | GUI → ESP | vacío. Responde con CONFIG_CHUNK, o ACK `05` si no hay nada guardado |
| `03` | CONFIG_CHUNK | ambos | `<idx> <total>` y un trozo del JSON (máx. 200 bytes) |
| `04` | APPLY | GUI → ESP | vacío. Aplica lo recibido, sin guardarlo (vista previa) |
| `05` | SAVE | GUI → ESP | vacío. Guarda en la flash la última config aplicada |
| `06` | RESET_DEFAULTS | GUI → ESP | vacío. Borra lo guardado y vuelve a los valores de fábrica |
| `07` | ENTER_BOOTLOADER | GUI → ESP | vacío. Responde ACK y reinicia en modo descarga |
| `7F` | ACK | ESP → GUI | `<seq echo> <estado>` |

Estados del ACK: `00` ok, `01` comando inválido, `02` chunk fuera de orden, `03` config demasiado grande (máx. 6144 bytes), `04` el ESP no pudo interpretar la config, `05` nada que aplicar o nada guardado, `06` falló la escritura en la flash.

## Flujo de escritura

1. La GUI envía CONFIG_CHUNK `0..total-1`, esperando el ACK de cada uno.
2. APPLY: el ESP interpreta el JSON y, solo si es válido, reemplaza la config activa (las barras y los pots cambian al instante).
3. SAVE: guarda esa config en la flash (NVS, clave `cfg`). Sin SAVE, al reiniciar vuelve lo anterior.

La GUI no marca "guardado" hasta recibir el ACK `00` de SAVE. Con una respuesta que no llega en 2 s, muestra "El ESP no respondió".

## La config (JSON)

El ESP guarda el JSON tal cual. Solo interpreta `pots` y `leds`; `targets` y `buttons` los guarda para la GUI y el Remote Script.

| clave | campos |
|---|---|
| `pots[i]` | `cc`, `ch` (1-16, solo afecta a los CC que envía), `enabled` (false = no lee el pin ni envía CC; para pots sin conectar, que leen ruido; si falta, true), `invert`, `min`, `max` (0-127), `smooth` (0-1) |
| `leds[i]` | `color` (`#rrggbb`), `brightness` (0-100, donde 100 % = valor crudo 40), `segments` (1-4), `mode` (`bar`, `dot`, `center`) |
| `targets[i]` | `{type:"macro", name}` o `{type:"send", send:"A".."F", tracks:[n,...]}`. Un tipo por pot |
| `buttons[i]` | `note`, `ch`, `fn` (`monitor`, `channel-left`, `channel-right`, `midi-only`), `states` (`IN-AUTO` o `IN-AUTO-OFF`), `tracks` |

Los números de pista son los de Live, desde 1, sin pistas de retorno ni master. Si falta la config o no se puede leer, el ESP usa los valores por defecto, que equivalen al comportamiento original: CC1 en adelante, canal 1, invertido, naranja, brillo 40, 4 píxeles por pot.

La entrada de las barras no es configurable: CC20 en adelante, canal 1.

## Probar a mano

Cierra antes la pestaña de la GUI, porque retiene el puerto (`amidi` daría "Device or resource busy").

    amidi -l                                           # busca el puerto, por ejemplo hw:3,0,0
    amidi -p hw:3,0,0 -S 'F0 7D 50 01 01 F7' -d        # PING -> F0 7D 50 41 01 30 2E 31 2E 30 F7
    amidi -p hw:3,0,0 -S 'F0 7D 50 02 02 F7' -d        # GET -> ACK 05 si la flash está vacía

Los pots sin cablear mandan CC ruidosos y llenan la salida: filtra las líneas que empiezan por `F0` y usa siempre `timeout`.

## Dónde está en el código

- Firmware: `esp-midi-phere.ino`, secciones "SysEx" y "Config apply / persistence".
- GUI: `app.js`, funciones `req`, `onSysex`, `sendConfig`, `applyConfig`.
