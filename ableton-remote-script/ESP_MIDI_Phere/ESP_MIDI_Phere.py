import json
import Live
from _Framework.ControlSurface import ControlSurface
from _Framework.EncoderElement import EncoderElement
from _Framework.InputControlElement import MIDI_CC_TYPE

# Generic version: the pot -> Macro mapping comes from the controller's own config
# (stored in the ESP, edited with phere-gui), read once over SysEx when Live starts.
# See docs/remote-script.md and docs/sysex.md.
VERSION = 'v2'

# CC (LED_CC_BASE + pot index) drives that pot's LED bar, always on channel 1.
# Fixed on both sides: it is not part of the config (see esp-midi-phere.ino).
LED_CC_BASE = 20
LED_STATUS = 0xB0  # CC, channel 1

# SysEx framing, see docs/sysex.md. The GUI is closed while Live runs, so any seq works.
SYSEX_HEAD = (0x7D, 0x50)
CMD_GET, CMD_CHUNK, CMD_ACK = 0x02, 0x03, 0x7F
ACK_NOTHING_STORED = 0x05
REQUEST_SEQ = 0x7E

# One schedule_message "tick" is ~0.1 s (measured under Wine: 6 ticks = 0.64 s), but the very first
# callback only fires ~0.9 s after the script loads. The first request waits for the MIDI port to be
# open; the ESP normally answers in ~70 ms.
FIRST_REQUEST_TICKS = 2
RETRY_TICKS = 10     # ~1.1 s before asking again
MAX_ATTEMPTS = 3     # then fall back to the default config (~4 s after load)

# Periodic re-scan of the whole song (ticks): catches a Macro being renamed, deleted or
# created, none of which fire an event we could listen to directly.
RESCAN_INTERVAL_TICKS = 20

LED_LOG_LIMIT = 6  # log the first LED sends so the output can be checked without bars attached


def default_config():
    """Same defaults as the GUI and the firmware: CC i+1, channel 1, Macros POT<ch>-<n>."""
    return {
        'pots': [{'cc': i + 1, 'ch': 1} for i in range(12)],
        'targets': [{'type': 'macro', 'name': 'POT%d-%d' % (i // 2 + 1, i % 2 + 1)} for i in range(12)],
    }


class ESP_MIDI_Phere(ControlSurface):
    __module__ = __name__
    __doc__ = "Two-way binds Macros anywhere in the song to the esp-midi-phere controller using the config stored in the controller: pot CC drives the Macro, and the Macro's value drives that pot's LED bar CC. Binding is fixed, independent of Live's track selection."

    def __init__(self, c_instance):
        super(ESP_MIDI_Phere, self).__init__(c_instance)
        self._disconnected = False
        self._configured = False
        self._attempts = 0
        self._chunks = {}
        self._chunk_total = None
        self._names = []       # Macro name per pot (None = not a macro / unsupported target)
        self._encoders = []
        self._parameters = []
        self._listeners = []   # (parameter, callback) per pot, kept to remove them again
        self._led_logged = 0
        self.log_message('ESP_MIDI_Phere %s loaded' % VERSION)
        self.schedule_message(FIRST_REQUEST_TICKS, self._request_config)

    # ------------------------------------------------------------------
    # Config over SysEx
    # ------------------------------------------------------------------
    def _request_config(self):
        if self._disconnected or self._configured:
            return
        self._attempts += 1
        self._chunks = {}
        self._chunk_total = None
        self.log_message('config: request %d/%d' % (self._attempts, MAX_ATTEMPTS))
        self._send_midi((0xF0,) + SYSEX_HEAD + (CMD_GET, REQUEST_SEQ, 0xF7))
        self.schedule_message(RETRY_TICKS, self._check_config)

    def _check_config(self):
        if self._disconnected or self._configured:
            return
        if self._attempts < MAX_ATTEMPTS:
            self._request_config()
        else:
            self.log_message('config: no answer from the controller, using defaults')
            self._apply_config(default_config(), 'defaults (timeout)')

    def handle_sysex(self, midi_bytes):
        if self._disconnected or self._configured:
            return
        if len(midi_bytes) < 6 or tuple(midi_bytes[1:3]) != SYSEX_HEAD or midi_bytes[4] != REQUEST_SEQ:
            return
        cmd = midi_bytes[3]
        if cmd == CMD_ACK:
            status = midi_bytes[6] if len(midi_bytes) > 6 else -1
            if status == ACK_NOTHING_STORED:
                self.log_message('config: nothing stored in the controller, using defaults')
                self._apply_config(default_config(), 'defaults (nothing stored)')
            else:
                self.log_message('config: controller answered status %d, using defaults' % status)
                self._apply_config(default_config(), 'defaults (error %d)' % status)
        elif cmd == CMD_CHUNK and len(midi_bytes) > 8:
            idx, total = midi_bytes[5], midi_bytes[6]
            self._chunk_total = total
            self._chunks[idx] = bytes(midi_bytes[7:-1]).decode('ascii', 'replace')
            if len(self._chunks) == total:
                self._finish_chunks()

    def _finish_chunks(self):
        try:
            text = ''.join(self._chunks[i] for i in range(self._chunk_total))
            config = json.loads(text)
        except (KeyError, ValueError) as e:
            self.log_message('config: could not read the received config (%s), using defaults' % e)
            self._apply_config(default_config(), 'defaults (unreadable)')
            return
        self._apply_config(config, 'controller (%d bytes)' % len(text))

    # ------------------------------------------------------------------
    # Applying the config: one encoder per pot, bound to its CC and channel
    # ------------------------------------------------------------------
    def _apply_config(self, config, source):
        if self._disconnected or self._configured:
            return
        self._configured = True
        pots = config.get('pots') or default_config()['pots']
        targets = config.get('targets') or default_config()['targets']
        count = min(len(pots), len(targets), 12)
        self.log_message('config: using %s, %d pots' % (source, count))

        with self.component_guard():
            for i in range(count):
                pot, target = pots[i], targets[i]
                try:
                    cc, ch = int(pot.get('cc', i + 1)), int(pot.get('ch', 1))
                except (TypeError, ValueError):
                    cc, ch = i + 1, 1
                if target.get('type') == 'macro' and target.get('name'):
                    name = target['name']
                else:
                    name = None
                    self.log_message('pot %d: target type %r not supported yet, left unbound' % (i + 1, target.get('type')))
                # EncoderElement takes a 0-indexed channel; connect_to()/release_parameter() is the
                # same mechanism as Ctrl+M MIDI-Map, done automatically by name.
                self._encoders.append(EncoderElement(MIDI_CC_TYPE, max(0, min(15, ch - 1)), cc, Live.MidiMap.MapMode.absolute))
                self._names.append(name)
                self._parameters.append(None)
                self._listeners.append(None)
                self.log_message('pot %d: CC%d ch%d -> %s' % (i + 1, cc, ch, name))
            self._refresh_all(force=True)
            self.request_rebuild_midi_map()
        self.schedule_message(RESCAN_INTERVAL_TICKS, self._periodic_rescan)

    # ------------------------------------------------------------------
    # Finding and binding the Macros
    # ------------------------------------------------------------------
    def _all_tracks(self):
        song = self.song()
        return tuple(song.tracks) + tuple(song.return_tracks) + (song.master_track,)

    def _find_parameter_anywhere(self, name):
        for track in self._all_tracks():
            for device in track.devices:
                for parameter in device.parameters:
                    if parameter.name == name:
                        return parameter
        return None

    # Live's API doesn't guarantee the same Python object back from repeated
    # device.parameters lookups, even for the exact same macro, so identity can't tell
    # "unchanged" from "changed" -- the stable name is checked instead.
    def _current_parameter_still_matches(self, index):
        parameter = self._parameters[index]
        if parameter is None:
            return False
        try:
            return parameter.name == self._names[index]
        except RuntimeError:
            return False  # underlying Live object was deleted

    def _periodic_rescan(self):
        if self._disconnected:
            return
        self._refresh_all(force=False)
        self.schedule_message(RESCAN_INTERVAL_TICKS, self._periodic_rescan)

    def _refresh_all(self, force):
        for index in range(len(self._names)):
            self._refresh_parameter(index, force)

    # force=True: always re-search and re-bind, used once at startup so the initial state is
    # pushed even though nothing has "changed" yet.
    # force=False (periodic rescan): only re-search if the parameter we have is gone or renamed.
    def _refresh_parameter(self, index, force):
        name = self._names[index]
        if name is None or (not force and self._current_parameter_still_matches(index)):
            return
        found = self._find_parameter_anywhere(name)
        self._remove_listener(index)
        # connect_to(None) releases any existing binding on its own, so this covers both
        # "rebind to a new match" and "nothing found, unbind".
        self._encoders[index].connect_to(found)
        self._parameters[index] = found
        if found is not None:
            callback = lambda i=index: self._send_led(i)
            found.add_value_listener(callback)
            self._listeners[index] = (found, callback)
            self._send_led(index)

    def _remove_listener(self, index):
        entry = self._listeners[index]
        self._listeners[index] = None
        if entry is None:
            return
        parameter, callback = entry
        try:
            if parameter.value_has_listener(callback):
                parameter.remove_value_listener(callback)
        except RuntimeError:
            pass  # the parameter was deleted together with its device

    # ------------------------------------------------------------------
    # Macro value -> LED bar
    # ------------------------------------------------------------------
    def _send_led(self, index):
        if self._disconnected:
            return
        parameter = self._parameters[index]
        try:
            value_range = parameter.max - parameter.min
            normalized = (parameter.value - parameter.min) / value_range if value_range > 0 else 0.0
        except RuntimeError:
            return
        normalized = max(0.0, min(1.0, normalized))
        midi_value = int(round(normalized * 127))
        self._send_midi((LED_STATUS, LED_CC_BASE + index, midi_value))
        if self._led_logged < LED_LOG_LIMIT:
            self._led_logged += 1
            self.log_message('LED: CC%d = %d (%s)' % (LED_CC_BASE + index, midi_value, self._names[index]))

    def disconnect(self):
        self._disconnected = True
        for index in range(len(self._listeners)):
            self._remove_listener(index)
        for encoder in self._encoders:
            encoder.release_parameter()
        super(ESP_MIDI_Phere, self).disconnect()
