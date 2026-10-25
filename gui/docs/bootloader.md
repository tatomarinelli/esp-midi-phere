# Bootloader por software

El botón **Bootloader** de la GUI reinicia el ESP en su modo de descarga (ROM) para poder flashearlo sin mantener BOOT. Así la placa puede quedar dentro de la caja cerrada.

## Cómo funciona

1. La GUI manda el comando SysEx `07` (ver `sysex.md`) tras pedir confirmación.
2. El firmware responde ACK `00`, espera 150 ms para que la respuesta salga por USB y llama a `usb_persist_restart(RESTART_BOOTLOADER)` (core Arduino-ESP32 3.x).
3. El chip reinicia directo en el bootloader de la ROM. El MIDI desaparece y la placa pasa a verse como `303a:1001 Espressif USB JTAG/serial debug unit`, con un `/dev/ttyACM0`.

Desde la GUI no hay forma de volver: en ese modo el ESP ya no habla MIDI.

## Cómo distinguir los modos

| Modo | `lsusb` | MIDI (`amidi -l`) |
|---|---|---|
| App normal (placa Waveshare) | `303a:822b Waveshare ESP32-S3-Zero` | `ESP32-S3-Zero MIDI 1` |
| Modo descarga | `303a:1001 Espressif USB JTAG/serial debug unit` | no hay |

Si se compila como "ESP32S3 Dev Module", la app sale como `303a:1001 ESP32S3_DEV`. Ese PID es el mismo del modo descarga y solo se distinguen por el nombre. Por eso se compila con la placa Waveshare.

## Flashear

    arduino-cli compile -u -p /dev/ttyACM0 \
      --fqbn esp32:esp32:waveshare_esp32_s3_zero:USBMode=default <carpeta del sketch>

- `USBMode=default` es el modo USB-OTG (TinyUSB), imprescindible para el MIDI.
- En esa placa `CDCOnBoot=cdc` significa "desactivado" (los valores están invertidos respecto a otras placas): mira `arduino-cli board details`.
- La carpeta del sketch debe llamarse igual que el `.ino`.
- La config guardada en la flash (NVS) se conserva al reflashear.

## Volver al modo normal

| Forma | Estado |
|---|---|
| Reflashear | Probado, siempre funciona |
| `esptool --chip esp32s3 --port /dev/ttyACM0 --after hard_reset chip_id` | Probado: vuelve a la app sin reflashear |
| Botón RESET, o desenchufar y volver a enchufar sin BOOT | Sin probar en físico; debería funcionar |

El `esptool` que trae Arduino está en `~/.arduino15/packages/esp32/tools/esptool_py/<versión>/esptool`.

## Cuándo sí hace falta BOOT

- El primer flasheo de un firmware que aún no tiene SysEx.
- Si la app se cuelga y no responde al comando.

Se entra manteniendo BOOT al enchufar el USB.

## Detalles que muerden

- Mientras la pestaña de la GUI está conectada, retiene el puerto. Ciérrala o recárgala antes de usar `amidi`.
- Tras cambiar "USB Mode" o "USB CDC On Boot" en el IDE, revisa que ambos sigan bien: uno puede resetear al otro y dejar la placa sin MIDI.

## Dónde está en el código

- Firmware: `esp-midi-phere.ino`, `case CMD_BOOT`.
- GUI: botón `#boot` en `index.html` y su manejador en `app.js`.
