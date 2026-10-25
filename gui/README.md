# phere-gui

Web GUI to configure the esp-midi-phere controller over Web MIDI (SysEx).
Chrome/Edge only. Web MIDI needs a secure context, so serve it locally:

    python3 -m http.server 8000   # then open http://localhost:8000

Works today (no firmware changes): connect, live pot monitor (CC1-12), LED bar
test (CC20+). Config read/write/save needs the SysEx handler in the firmware,
see `docs/sysex.md`. Roadmap: protocol -> firmware NVS+SysEx -> GUI -> buttons ->
generic Remote Script -> in-browser flashing (esptool-js).

Docs: `docs/` (SysEx, bootloader por software, Remote Script). Estado y pendientes: `STATUS.md`.
