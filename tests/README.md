# Módulos de prueba

Cada carpeta es un sketch independiente para flashear solo y verificar una pieza del hardware. Cuando pasa, ese código ya coincide con `../esp-midi-phere.ino` (mismos pines y constantes). Los pines están duplicados a propósito: cada sketch es autónomo.

| Sketch | Qué prueba | Pines |
|---|---|---|
| `pots_test` | 10 pots -> CC1-10 canal 1. `potEnabled[]` apaga los que no están conectados | GPIO1-10 |
| `led_bars_test` | 5 sticks NeoPixel: barrido al arrancar y CC20-29 canal 1 | GPIO11 |
| `buttons_test` | 8 botones por mux HC4067 -> Note On/Off 36-43 canal 1 | S0-S3 = 14, 16, 17, 18; SIG = 15 (propuestos, sin confirmar en la placa) |

Mismo ajuste del IDE que el firmware principal: USB Mode "USB-OTG (TinyUSB)". Con arduino-cli: `--fqbn esp32:esp32:waveshare_esp32_s3_zero:USBMode=default`. Aparecen como MIDI `esp-midi-phere-test`.

Estado: los tres compilan; ninguno probado en hardware (`buttons_test` y `led_bars_test` son nuevos).
