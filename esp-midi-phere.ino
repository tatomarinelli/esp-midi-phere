/*
  esp-midi-phere - USB-MIDI pot controller with per-pot LED level meters
  Board: Waveshare ESP32-S3-Zero

  Arduino IDE setup (Tools menu):
    Board:            "ESP32S3 Dev Module"
    USB Mode:         "USB-OTG (TinyUSB)"   <- required for native USB-MIDI
    USB CDC On Boot:  "Enabled"             <- optional, gives Serial over the same USB port

  Requires:
    - Arduino-ESP32 core 3.x (Boards Manager: "esp32" by Espressif Systems)
    - "Adafruit NeoPixel" library (Library Manager)

  Wiring (B10K pots, wiper to GPIO, outer legs to 3V3 and GND):
    Pot 1: wiper -> GPIO1  (ADC1_CH0)
    Pot 2: wiper -> GPIO2  (ADC1_CH1)
    Pot 3: wiper -> GPIO3  (ADC1_CH2)
    Pot 4: wiper -> GPIO4  (ADC1_CH3)
    Pot 5: wiper -> GPIO5  (ADC1_CH4)
    Pot 6: wiper -> GPIO6  (ADC1_CH5)
    Pot 7: wiper -> GPIO7  (ADC1_CH6)
    Pot 8: wiper -> GPIO8  (ADC1_CH7)
    Pot 9: wiper -> GPIO9  (ADC1_CH8)
    Pot 10: wiper -> GPIO10 (ADC1_CH9)
  All pots share the same 3V3 and GND rails.

  LED meters: 5x Adafruit NeoPixel Stick (8 x SK6812/WS2812 5050), each stick
  shared by 2 adjacent pots (4 segments each), chained data-out -> data-in,
  single data wire -> GPIO11. Chain power (5V/GND) comes from the board's 5V
  pad (USB VBUS), NOT the 3V3 pin -- the onboard 3.3V regulator is rated
  800mA and also has to run the ESP32-S3 itself. GND is shared with the board.
  Since pixels are individually addressable, "2 pots per stick" needs no
  special-case firmware -- pixel order in the chain already maps cleanly onto
  4 pixels per pot as long as wiring order matches pot order (stick 1 =
  pots 1+2, stick 2 = pots 3+4, ... stick 5 = pots 9+10).

  Onboard WS2812 (GPIO21) is just a dim "alive" indicator once USB-MIDI is up.

  MIDI in: CC20-CC29 on channel 1 set pot 1-10's bar level (0-127). This input
  mapping is fixed (not configurable). Ableton's Remote Script sends these,
  reflecting the real Macro value in Live (not just the pot's own raw
  position).
  The device shows up in your DAW as "esp-midi-phere".

  Configuration (phere-gui, see gui/docs/sysex.md): the GUI talks to this
  firmware over SysEx (manufacturer 7D, id 50). The config is a JSON document
  stored verbatim as an NVS blob; the firmware only interprets "pots" and
  "leds" (the rest -- targets, buttons -- is kept for the Remote Script / GUI).
  With nothing stored (or an unparsable blob) the built-in defaults below apply,
  which equal the pre-GUI hardcoded behaviour (CC1.. on channel 1, inverted,
  orange, brightness cap 40, 4 pixels per pot).
  ENTER_BOOTLOADER reboots into the ROM download mode so the board can be
  re-flashed without holding BOOT.
*/

#if ARDUINO_USB_MODE
#warning "This sketch needs USB Mode set to 'USB-OTG (TinyUSB)' in the Tools menu"
void setup() {}
void loop() {}
#else

#include "USB.h"
#include "USBMIDI.h"
#include <Adafruit_NeoPixel.h>
#include <Preferences.h>

#define FW_VERSION "0.1.0"

USBMIDI MIDI("esp-midi-phere");
Preferences prefs;

// One entry per pot.
const uint8_t potPins[] = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 };
const uint8_t numPots = sizeof(potPins) / sizeof(potPins[0]);

const uint16_t adcMax = 4095;       // 12-bit ADC
const uint8_t oversampleCount = 8;  // ADC reads averaged per scan, cuts raw noise variance
const float sendThreshold = 0.6f;   // MIDI-unit hysteresis before a new value is sent
const uint16_t scanIntervalMs = 2;  // how often the pots are read

const uint8_t rgbLedPin = 21;  // onboard WS2812, "alive" indicator only

// --- Per-pot LED bar meters ---
const uint8_t ledDataPin = 11;         // NeoPixel Stick chain data line
const uint8_t segmentsPerBar = 4;      // pixels owned by each pot (stick shared by 2 pots)
const uint16_t numPixels = (uint16_t)numPots * segmentsPerBar;
const uint8_t ledBrightnessCap = 40;   // raw brightness at 100 % (keeps current draw sane)
const uint8_t ledCcBase = 20;          // pot i's bar level arrives on CC (ledCcBase + i)
const uint8_t ledInChannel = 1;        // LED-in listen channel, fixed (pot "ch" only affects outgoing CCs)

Adafruit_NeoPixel strip(numPixels, ledDataPin, NEO_GRB + NEO_KHZ800);

// --- Runtime config (the part of the JSON the firmware interprets) ---
enum LedMode : uint8_t { MODE_BAR, MODE_DOT, MODE_CENTER };

struct PotCfg {
  uint8_t cc;
  uint8_t ch;  // 1-16
  bool enabled;  // false = pin not read, no CCs (unconnected pots float and read noise)
  bool invert;
  uint8_t minV, maxV;
  float smooth;  // EMA alpha
};
struct LedCfg {
  uint8_t r, g, b;
  uint8_t brightPct;  // 0-100, 100 = ledBrightnessCap
  uint8_t segments;   // 1..segmentsPerBar
  LedMode mode;
};

PotCfg potCfg[numPots];
LedCfg ledCfg[numPots];
uint8_t barLevel[numPots];  // last LED-in value per pot, re-rendered when the config changes

const size_t MAX_CFG = 6144;     // NVS-friendly cap; the GUI default config is ~3 KB
char activeJson[MAX_CFG + 1];    // last successfully applied (and what SAVE persists)
char stageJson[MAX_CFG + 1];     // being received via CONFIG_CHUNK
size_t stageLen = 0;
uint8_t stageNext = 0;           // next expected chunk index
bool stageComplete = false;

float filtered[numPots];
float lastSentMidi[numPots];  // continuous MIDI-unit position of the last value sent
bool everSent[numPots];
uint32_t lastScan = 0;

void fillDefaults(PotCfg *pots, LedCfg *leds) {
  for (uint8_t i = 0; i < numPots; i++) {
    pots[i] = { (uint8_t)(i + 1), 1, true, true, 0, 127, 0.3f };
    leds[i] = { 255, 140, 0, 100, segmentsPerBar, MODE_BAR };
  }
}
void setDefaults() { fillDefaults(potCfg, ledCfg); }

// ---------------------------------------------------------------------------
// Minimal JSON field extraction. The GUI emits compact JSON.stringify() output
// (no spaces) and the "pots"/"leds" objects are flat, so a tiny scanner is
// enough and avoids an extra library dependency.
// ---------------------------------------------------------------------------
const char *findField(const char *obj, const char *key) {
  char pat[24];
  snprintf(pat, sizeof(pat), "\"%s\":", key);
  const char *q = strstr(obj, pat);
  return q ? q + strlen(pat) : nullptr;
}
bool fieldNum(const char *obj, const char *key, float *out) {
  const char *q = findField(obj, key);
  if (!q) return false;
  *out = atof(q);
  return true;
}
bool fieldBool(const char *obj, const char *key, bool *out) {
  const char *q = findField(obj, key);
  if (!q) return false;
  *out = (*q == 't');
  return true;
}
bool fieldColor(const char *obj, const char *key, uint8_t *r, uint8_t *g, uint8_t *b) {
  const char *q = findField(obj, key);
  if (!q || q[0] != '"' || q[1] != '#') return false;
  char hex[7];
  memcpy(hex, q + 2, 6);
  hex[6] = 0;
  char *end;
  uint32_t v = strtoul(hex, &end, 16);
  if (end != hex + 6) return false;
  *r = v >> 16;
  *g = v >> 8;
  *b = v;
  return true;
}
bool fieldMode(const char *obj, const char *key, LedMode *out) {
  const char *q = findField(obj, key);
  if (!q || *q != '"') return false;
  if (!strncmp(q + 1, "bar\"", 4)) *out = MODE_BAR;
  else if (!strncmp(q + 1, "dot\"", 4)) *out = MODE_DOT;
  else if (!strncmp(q + 1, "center\"", 7)) *out = MODE_CENTER;
  else return false;
  return true;
}
float clampf(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }

// Copies the next flat {...} object of the array starting at *p into obj.
// Returns false at end of array or on error (also if the object is too big).
bool nextObject(const char **p, char *obj, size_t objSize) {
  const char *s = *p;
  while (*s == ',' || *s == ' ') s++;
  if (*s != '{') return false;
  const char *e = strchr(s, '}');
  if (!e || (size_t)(e - s + 1) >= objSize) return false;
  memcpy(obj, s, e - s + 1);
  obj[e - s + 1] = 0;
  *p = e + 1;
  return true;
}

// Parses json into the out arrays (pre-filled with defaults). Missing fields
// keep their default; malformed structure fails the whole parse.
bool parseConfig(const char *json, PotCfg *pots, LedCfg *leds) {
  const char *arr = strstr(json, "\"pots\":[");
  if (!arr) return false;
  arr += 8;
  char obj[200];
  for (uint8_t i = 0; i < numPots; i++) {
    if (!nextObject(&arr, obj, sizeof(obj))) break;
    float v;
    bool b;
    if (fieldNum(obj, "cc", &v)) pots[i].cc = (uint8_t)clampf(v, 0, 127);
    if (fieldNum(obj, "ch", &v)) pots[i].ch = (uint8_t)clampf(v, 1, 16);
    if (fieldBool(obj, "enabled", &b)) pots[i].enabled = b;
    if (fieldBool(obj, "invert", &b)) pots[i].invert = b;
    if (fieldNum(obj, "min", &v)) pots[i].minV = (uint8_t)clampf(v, 0, 127);
    if (fieldNum(obj, "max", &v)) pots[i].maxV = (uint8_t)clampf(v, 0, 127);
    if (fieldNum(obj, "smooth", &v)) pots[i].smooth = clampf(v, 0.02f, 1.0f);
    if (pots[i].maxV <= pots[i].minV) { pots[i].minV = 0; pots[i].maxV = 127; }
  }
  arr = strstr(json, "\"leds\":[");
  if (!arr) return false;
  arr += 8;
  for (uint8_t i = 0; i < numPots; i++) {
    if (!nextObject(&arr, obj, sizeof(obj))) break;
    float v;
    fieldColor(obj, "color", &leds[i].r, &leds[i].g, &leds[i].b);
    if (fieldNum(obj, "brightness", &v)) leds[i].brightPct = (uint8_t)clampf(v, 0, 100);
    if (fieldNum(obj, "segments", &v)) leds[i].segments = (uint8_t)clampf(v, 1, segmentsPerBar);
    fieldMode(obj, "mode", &leds[i].mode);
  }
  return true;
}

// ---------------------------------------------------------------------------
// LED bars
// ---------------------------------------------------------------------------
// Coverage-based rendering: position p (0..segments) is where the value sits.
//   bar:    lit from 0 up to p        (edge segment ramps -> smooth resolution)
//   center: lit from the middle to p  (grows left or right of center)
//   dot:    a single soft dot at p
// Brightness is applied per bar here (global strip brightness stays 255),
// capped at ledBrightnessCap when brightness is 100 %.
void renderBar(uint8_t i) {
  const LedCfg &l = ledCfg[i];
  float segs = l.segments;
  float p = barLevel[i] / 127.0f * segs;
  float c = (l.mode == MODE_CENTER) ? segs / 2.0f : 0.0f;
  float lo = min(c, p), hi = max(c, p);
  float rawBright = l.brightPct / 100.0f * ledBrightnessCap;

  uint16_t base = (uint16_t)i * segmentsPerBar;
  for (uint8_t s = 0; s < segmentsPerBar; s++) {
    float f = 0;
    if (s < l.segments) {
      if (l.mode == MODE_DOT) f = clampf(1.0f - fabsf(p - (s + 0.5f)), 0, 1);
      else f = clampf(min((float)(s + 1), hi) - max((float)s, lo), 0, 1);
    }
    float k = f * rawBright / 255.0f;
    strip.setPixelColor(base + s, (uint8_t)(l.r * k + 0.5f), (uint8_t)(l.g * k + 0.5f), (uint8_t)(l.b * k + 0.5f));
  }
}
void renderAllBars() {
  for (uint8_t i = 0; i < numPots; i++) renderBar(i);
  strip.show();
}

// ---------------------------------------------------------------------------
// Config apply / persistence
// ---------------------------------------------------------------------------
// Parses on top of fresh defaults (so fields removed from the JSON don't linger)
// and only swaps the live config in if the whole parse succeeded.
bool applyJson(const char *json) {
  PotCfg newPots[numPots];
  LedCfg newLeds[numPots];
  fillDefaults(newPots, newLeds);
  if (!parseConfig(json, newPots, newLeds)) return false;
  memcpy(potCfg, newPots, sizeof(newPots));
  memcpy(ledCfg, newLeds, sizeof(newLeds));
  for (uint8_t i = 0; i < numPots; i++) everSent[i] = false;  // re-announce positions with the new mapping
  renderAllBars();
  return true;
}

void loadConfig() {
  setDefaults();
  activeJson[0] = 0;
  prefs.begin("phere", true);
  size_t len = prefs.getBytesLength("cfg");
  if (len > 0 && len <= MAX_CFG) {
    prefs.getBytes("cfg", activeJson, len);
    activeJson[len] = 0;
  }
  prefs.end();
  if (activeJson[0] && !applyJson(activeJson)) {
    activeJson[0] = 0;  // never brick on a bad blob
    setDefaults();
  }
}

bool saveConfig() {
  size_t len = strlen(activeJson);
  if (len == 0) return false;
  bool ok = prefs.begin("phere", false);
  if (ok) ok = prefs.putBytes("cfg", activeJson, len) == len;
  prefs.end();
  return ok;
}

// ---------------------------------------------------------------------------
// SysEx (frame: F0 7D 50 <cmd> <seq> <payload...> F7)
// ---------------------------------------------------------------------------
const uint8_t SX_MFR = 0x7D, SX_ID = 0x50;
enum : uint8_t {
  CMD_PING = 0x01, CMD_GET = 0x02, CMD_CHUNK = 0x03, CMD_APPLY = 0x04,
  CMD_SAVE = 0x05, CMD_RESET = 0x06, CMD_BOOT = 0x07,
  CMD_PONG = 0x41, CMD_ACK = 0x7F
};
enum : uint8_t { ST_OK = 0, ST_BAD = 1, ST_ORDER = 2, ST_TOO_BIG = 3, ST_PARSE = 4, ST_NONE = 5, ST_NVS = 6 };
const uint16_t CHUNK_TEXT = 200;  // matches the GUI's chunk size
const size_t SX_MAX = 256;

uint8_t sx[SX_MAX];
size_t sxLen = 0;
bool inSx = false;

// Packetise a whole frame into USB-MIDI event packets (CIN 4 = continue, 5/6/7 = end with 1/2/3 bytes).
void sendFrame(uint8_t cmd, uint8_t seq, const uint8_t *payload, size_t plen) {
  uint8_t f[SX_MAX + 8];
  size_t n = 0;
  f[n++] = 0xF0;
  f[n++] = SX_MFR;
  f[n++] = SX_ID;
  f[n++] = cmd;
  f[n++] = seq;
  for (size_t i = 0; i < plen && n < sizeof(f) - 1; i++) f[n++] = payload[i] & 0x7F;
  f[n++] = 0xF7;
  for (size_t i = 0; i < n; i += 3) {
    size_t left = n - i;
    midiEventPacket_t pk = { 0, 0, 0, 0 };
    pk.header = (left > 3) ? 0x4 : (left == 3 ? 0x7 : (left == 2 ? 0x6 : 0x5));
    pk.byte1 = f[i];
    pk.byte2 = left > 1 ? f[i + 1] : 0;
    pk.byte3 = left > 2 ? f[i + 2] : 0;
    for (uint8_t tries = 0; tries < 50 && !MIDI.writePacket(&pk); tries++) delay(1);
  }
}
void sendAck(uint8_t seq, uint8_t status) {
  uint8_t p[2] = { seq, status };
  sendFrame(CMD_ACK, seq, p, 2);
}

void handleSysex(const uint8_t *d, size_t n) {
  if (n < 4 || d[0] != SX_MFR || d[1] != SX_ID) return;
  uint8_t cmd = d[2], seq = d[3];
  const uint8_t *pl = d + 4;
  size_t plen = n - 4;

  switch (cmd) {
    case CMD_PING:
      sendFrame(CMD_PONG, seq, (const uint8_t *)FW_VERSION, strlen(FW_VERSION));
      break;

    case CMD_GET: {
      size_t len = strlen(activeJson);
      if (len == 0) {
        sendAck(seq, ST_NONE);  // nothing stored: the GUI keeps its own (default) config
        break;
      }
      uint8_t total = (len + CHUNK_TEXT - 1) / CHUNK_TEXT;
      for (uint8_t i = 0; i < total; i++) {
        uint8_t buf[CHUNK_TEXT + 2];
        size_t off = (size_t)i * CHUNK_TEXT, cl = min((size_t)CHUNK_TEXT, len - off);
        buf[0] = i;
        buf[1] = total;
        memcpy(buf + 2, activeJson + off, cl);
        sendFrame(CMD_CHUNK, seq, buf, cl + 2);
      }
      break;
    }

    case CMD_CHUNK: {
      if (plen < 2) { sendAck(seq, ST_BAD); break; }
      uint8_t idx = pl[0], total = pl[1];
      if (idx == 0) { stageLen = 0; stageNext = 0; stageComplete = false; }
      if (idx != stageNext) { stageLen = 0; stageNext = 0; stageComplete = false; sendAck(seq, ST_ORDER); break; }
      size_t cl = plen - 2;
      if (stageLen + cl > MAX_CFG) { stageLen = 0; stageNext = 0; stageComplete = false; sendAck(seq, ST_TOO_BIG); break; }
      memcpy(stageJson + stageLen, pl + 2, cl);
      stageLen += cl;
      stageNext++;
      if (stageNext == total) {
        stageJson[stageLen] = 0;
        stageComplete = true;
      }
      sendAck(seq, ST_OK);
      break;
    }

    case CMD_APPLY:
      if (!stageComplete) { sendAck(seq, ST_NONE); break; }
      if (!applyJson(stageJson)) { sendAck(seq, ST_PARSE); break; }
      memcpy(activeJson, stageJson, stageLen + 1);
      stageComplete = false;
      sendAck(seq, ST_OK);
      break;

    case CMD_SAVE:
      sendAck(seq, saveConfig() ? ST_OK : ST_NVS);
      break;

    case CMD_RESET:
      prefs.begin("phere", false);
      prefs.remove("cfg");
      prefs.end();
      activeJson[0] = 0;
      setDefaults();
      for (uint8_t i = 0; i < numPots; i++) everSent[i] = false;
      renderAllBars();
      sendAck(seq, ST_OK);
      break;

    case CMD_BOOT:
      sendAck(seq, ST_OK);
      delay(150);  // let the ACK leave before the USB device disappears
      usb_persist_restart(RESTART_BOOTLOADER);
      break;

    default:
      sendAck(seq, ST_BAD);
  }
}

void sxFeed(uint8_t b) {
  if (b == 0xF0) { sxLen = 0; inSx = true; return; }
  if (!inSx) return;
  if (b == 0xF7) { inSx = false; handleSysex(sx, sxLen); return; }
  if (b & 0x80) {
    if (b < 0xF8) inSx = false;  // any other status aborts; realtime bytes may interleave
    return;
  }
  if (sxLen < SX_MAX) sx[sxLen++] = b;
  else inSx = false;
}

// ---------------------------------------------------------------------------
// Incoming MIDI
// ---------------------------------------------------------------------------
void handleMidiIn(const midiEventPacket_t &packet) {
  uint8_t cin = packet.header & 0x0F;
  switch (cin) {
    case 0x4: sxFeed(packet.byte1); sxFeed(packet.byte2); sxFeed(packet.byte3); return;
    case 0x5: sxFeed(packet.byte1); return;
    case 0x6: sxFeed(packet.byte1); sxFeed(packet.byte2); return;
    case 0x7: sxFeed(packet.byte1); sxFeed(packet.byte2); sxFeed(packet.byte3); return;
  }
  if (cin < 0x8 || cin > 0xE) return;
  uint8_t status = packet.byte1 & 0xF0;
  uint8_t channel = (packet.byte1 & 0x0F) + 1;  // 1-indexed
  if (status == 0xB0 && channel == ledInChannel) {
    uint8_t cc = packet.byte2;
    if (cc >= ledCcBase && cc < ledCcBase + numPots) {
      uint8_t i = cc - ledCcBase;
      barLevel[i] = packet.byte3;
      renderBar(i);
      strip.show();
    }
  }
}

// ---------------------------------------------------------------------------
// Pots
// ---------------------------------------------------------------------------
// The ESP32 ADC has a few LSBs of inherent read noise. A single analogRead()
// per scan lets that noise flip the mapped MIDI value back and forth forever
// (e.g. 79/80/79/80...). Averaging several reads per scan removes most of it
// before the EMA filter and threshold check ever see it.
int readPotRaw(uint8_t pin) {
  uint32_t sum = 0;
  for (uint8_t s = 0; s < oversampleCount; s++) {
    sum += analogRead(pin);
  }
  return sum / oversampleCount;
}

float adcToMidiFloat(float raw, const PotCfg &p) {
  float v = (raw / adcMax) * 127.0f;
  if (p.invert) v = 127.0f - v;  // default: wiring has 0V/3V3 swapped vs. rotation direction
  v = p.minV + v / 127.0f * (p.maxV - p.minV);
  return clampf(v, 0, 127);
}

void setup() {
  Serial.begin(115200);

  for (uint8_t i = 0; i < numPots; i++) {
    pinMode(potPins[i], INPUT);
    filtered[i] = readPotRaw(potPins[i]);  // seed the filter so it doesn't ramp up from 0
    everSent[i] = false;
    barLevel[i] = 0;
  }

  strip.begin();
  strip.setBrightness(255);  // per-bar brightness is applied in renderBar()
  strip.clear();
  strip.show();

  loadConfig();

  rgbLedWrite(rgbLedPin, 0, 0, 0);

  MIDI.begin();
  USB.begin();

  rgbLedWrite(rgbLedPin, 8, 8, 8);  // dim "alive" indicator
}

void loop() {
  // Drain incoming MIDI immediately, independent of the pot scan interval below.
  midiEventPacket_t rx;
  while (MIDI.readPacket(&rx)) {
    handleMidiIn(rx);
  }

  uint32_t now = millis();
  if (now - lastScan < scanIntervalMs) {
    return;
  }
  lastScan = now;

  for (uint8_t i = 0; i < numPots; i++) {
    const PotCfg &p = potCfg[i];
    if (!p.enabled) {
      everSent[i] = false;  // on re-enable, re-seed the filter and send the position once
      continue;
    }
    int raw = readPotRaw(potPins[i]);
    if (!everSent[i]) filtered[i] = raw;
    filtered[i] += (raw - filtered[i]) * p.smooth;

    // Hysteresis is measured against the continuous position, not the rounded
    // MIDI value -- comparing rounded values with a >=2 threshold would only
    // accept every other step once the pot moves one step per scan, locking
    // onto odd or even values and silently losing half the range.
    float midiFloat = adcToMidiFloat(filtered[i], p);
    if (!everSent[i] || fabsf(midiFloat - lastSentMidi[i]) >= sendThreshold) {
      uint8_t value = (uint8_t)(midiFloat + 0.5f);
      MIDI.controlChange(p.cc, value, p.ch);
      lastSentMidi[i] = midiFloat;
      everSent[i] = true;
    }
  }
}

#endif /* ARDUINO_USB_MODE */
