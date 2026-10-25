# Remote Script de Ableton

`ableton-remote-script/ESP_MIDI_Phere/` hace que Live y el controlador se hablen: los pots mueven Macros y el valor real del Macro se muestra en las barras LED. Desde la versión `v2` no tiene nada fijo: lee su configuración del ESP.

## Qué hace

1. **Al cargar** pide la config al ESP por SysEx (`GET`, ver `sysex.md`, con `seq` `7E`). La primera petición sale ~1 s después de cargar, para que el puerto ya esté abierto.
2. **Reintenta** hasta 3 veces, cada ~1,1 s. Si el ESP no responde, o responde "nada guardado" (ACK `05`) o un error, usa los valores por defecto: 12 pots, CC1 al CC12, canal 1, Macros `POT1-1`, `POT1-2`, `POT2-1`… (los mismos que la GUI y el firmware). Cada camino queda anotado en el log.
3. **Crea un `EncoderElement` por pot** con el CC y el canal de la config (el canal de Live va de 0 a 15). Es el mismo mecanismo que el mapeo manual con Ctrl+M, pero automático.
4. **Busca cada Macro por nombre** en toda la sesión: pistas, retornos y master. No depende de la pista seleccionada.
5. **Devuelve el valor del Macro a la barra LED** por CC20 + índice del pot, canal 1 (fijo, no es parte de la config). Por eso la barra refleja el Macro real, también si lo mueves con el mouse, con automatización o con un preset.
6. **Re-escanea** la sesión cada ~2 s (20 ticks) y solo vuelve a asociar un Macro si el que tenía ya no existe o ya no se llama igual. Así detecta renombrados, borrados o Macros nuevos.

La config se lee **una sola vez por sesión**. Para aplicar un cambio con Live abierto hay que apagar y volver a elegir el Control Surface (o reiniciar Live). Lo que aún no soporta: los destinos de tipo `send` se omiten y se anotan en el log ("not supported yet"), y los botones no hacen nada.

Los listeners de valor se agregan y quitan a mano (`add_value_listener`), uno por pot, y se limpian al desconectar. Así el número de pots no depende de cuántos métodos escribas.

## Flujo de uso

1. Conectar el controlador y abrir la GUI.
2. Editar la config y guardarla en el ESP.
3. **Cerrar o recargar la pestaña de la GUI**, porque retiene el puerto MIDI y Ableton lo necesita.
4. Abrir Ableton y usar.

**El ESP tiene que estar conectado cuando Live carga el script.** Si arranca sin él, el script usa los valores por defecto y no vuelve a preguntar: conecta el ESP y refresca el script.

## Instalación (Live bajo Wine)

Live corre con el prefijo Wine `/mnt/plexdata/ableton/wineprefix-d2d1`, cuyo `Documents` apunta a `/home/tato/Documentos`. El script se copia a dos sitios:

- `/home/tato/Documentos/Ableton/User Library/Remote Scripts/ESP_MIDI_Phere/`
- `<prefijo>/drive_c/ProgramData/Ableton/Live 12 Trial/Resources/MIDI Remote Scripts/ESP_MIDI_Phere/`

Hay que volver a copiar cada vez que se edita el script del repo. Después, apaga y vuelve a elegir el Control Surface en Preferencias → Link/Tempo/MIDI, con el ESP como entrada y salida. Los puertos se listan al arrancar Live. Si la GUI está conectada, ciérrala antes, porque retiene el puerto.

## Depurar

El script escribe con `log_message`. En `<prefijo>/drive_c/users/tato/AppData/Roaming/Ableton/Live 12.4.6/Preferences/Log.txt` busca `(ESP_MIDI_Phere)`: la versión cargada, `config: ...` (qué camino usó), una línea por pot (`pot 3: CC77 ch5 -> POT1-1`) y las primeras 6 salidas a las barras (`LED: CC22 = 78 (POT1-1)`).

Bajo Wine un tick de `schedule_message` dura ~0,1 s, pero el primero tarda ~0,9 s tras cargar el script.

## Probado

Con Live 12 bajo Wine y el ESP real:
- SysEx en las dos direcciones, con los 14 trozos de unos 210 bytes y respuesta en ~30 a 100 ms.
- La config del ESP gobierna el mapeo: con el pot 3 en `CC77 ch5 → POT1-1`, el Macro `POT1-1` se movió y la barra salió por CC22 (el script viejo habría usado CC20).
- ACK `05` (nada guardado) usa los valores por defecto, con la barra de `POT1-1` en CC20.
- Sin el ESP conectado al cargar, tras 3 intentos usa los valores por defecto.

También hay un conjunto de 18 pruebas en el PC con un Live simulado (config válida, ACK, timeout, `seq` ajeno, JSON dañado, `send` omitido, desconexión).

**Sin ver en hardware:** las barras LED, porque no hay ninguna conectada. La salida solo se comprobó en el log.

## Qué viene

2. **Sends** de una o varias pistas (`targets` con `type: "send"`). Sin verificar aún que `EncoderElement` reciba CC cuando el destino es un send; si falla, el script leerá y escribirá los parámetros directamente.
3. **Botones de monitoreo** IN/AUTO/OFF sobre las pistas indicadas (`buttons`). Necesita que el ESP envíe las notas de los botones, que aún no tiene hardware.
