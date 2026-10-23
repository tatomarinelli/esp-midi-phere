/*
  led_bar_test - 2-pot bench prototype of the full esp-midi-phere MIDI loop.
  Board: Waveshare ESP32-S3-Zero

  Scope: 2 pots + 1 NeoPixel Stick (8 x SK6812/WS2812), matching "stick 1 =
  pots 1+2" from the full esp-midi-phere design. Unlike a self-echo test,
  this uses the real USB-MIDI path in both directions, same as the final
  firmware:
    - Turning pot 1/2 sends CC1/CC2 (channel 1) out over USB-MIDI.
    - Incoming CC20/CC21 (channel 1) set bar 1/bar 2's lit segment count.
  So this is the actual thing you're validating: your computer (or a MIDI
  monitor/sender tool, or the Ableton remote script) receives the pot's CC,
  and whatever you send back on CC20/21 is what lights the bar -- not an
  automatic echo of the pot's own position. That's the real end-to-end path
  the full 10-pot design relies on.

  Wiring:
    Pot 1: wiper -> GPIO1, outer legs -> 3V3 / GND
    Pot 2: wiper -> GPIO2, outer legs -> 3V3 / GND
    NeoPixel Stick DIN -> GPIO11 (through 
    
    NeoPixel Stick 5V/GND -> board's 5V pad (USB VBUS) / GND, NOT 3V3
    ~1000uF capacitor across 5V/GND right at the stick's power input

  Arduino IDE setup (Tools menu):
    Board:            "ESP32S3 Dev Module"
    USB Mode:         "USB-OTG (TinyUSB)"   <- required for native USB-MIDI
    USB CDC On Boot:  "Enabled"             <- optional, Serial debug over same port

  Verify:
    - Board enumerates as a MIDI device named "esp-midi-phere-test".
    - Turning pot 1/2 sends CC1/CC2 smoothly 0-127, visible in any MIDI
      monitor, with no flicker at rest and no skipped values while sweeping.
    - Sending CC20 (0-127) sets bar 1's level: solid orange fills 0-4 segments,
      with the leading edge segment fading in proportionally for smoother
      in-between resolution. CC21 does the same for bar 2.
*/

#include "USB.h"
#include "USBMIDI.h"
#include <Adafruit_NeoPixel.h>

USBMIDI MIDI("esp-midi-phere-test");

const uint8_t potPins[] = { 1, 2 };
const uint8_t ccNumbers[] = { 1, 2 };
const uint8_t midiChannel = 1;
const uint8_t numPots = sizeof(potPins) / sizeof(potPins[0]);

const uint16_t adcMax = 4095;       // 12-bit ADC
const uint8_t oversampleCount = 8;  // ADC reads averaged per scan, cuts raw noise variance
const float emaAlpha = 0.3f;        // smoothing: higher = more responsive, lower = smoother
const float sendThreshold = 0.6f;   // MIDI-unit hysteresis before a new value is sent
const uint16_t scanIntervalMs = 2;  // how often the pots are read

const uint8_t ledDataPin = 11;         // NeoPixel Stick data line
const uint8_t segmentsPerBar = 4;      // half a NeoPixel Stick per pot
const uint16_t numPixels = (uint16_t)numPots * segmentsPerBar;
const uint8_t ledBrightnessCap = 40;   // global brightness cap (0-255), keeps current draw sane
const uint8_t ledCcBase = 20;          // pot i's bar level arrives on CC (ledCcBase + i)

Adafruit_NeoPixel strip(numPixels, ledDataPin, NEO_GRB + NEO_KHZ800);

float filtered[numPots];
float lastSentMidi[numPots];  // continuous MIDI-unit position of the last value sent
bool everSent[numPots];
uint32_t lastScan = 0;

int readPotRaw(uint8_t pin) {
  uint32_t sum = 0;
  for (uint8_t s = 0; s < oversampleCount; s++) {
    sum += analogRead(pin);
  }
  return sum / oversampleCount;
}

float adcToMidiFloat(float raw) {
  float v = 127.0f - (raw / adcMax) * 127.0f;  // inverted: wiring has 0V/3V3 swapped vs. rotation direction
  if (v < 0) {
    v = 0;
  }
  if (v > 127) {
    v = 127;
  }
  return v;
}

// Single-color (orange) meter: fully-lit segments up to the value's position,
// plus one "edge" segment whose brightness ramps with the fractional part --
// gives smoother, more analog-feeling resolution than a hard step between
// the 4 discrete segments would alone.
const uint8_t orangeR = 255;
const uint8_t orangeG = 140;

uint32_t scaledOrange(float fraction) {
  if (fraction < 0) fraction = 0;
  if (fraction > 1) fraction = 1;
  return strip.Color((uint8_t)(orangeR * fraction), (uint8_t)(orangeG * fraction), 0);
}

void setBarLevel(uint8_t potIndex, uint8_t value) {
  float position = (float)value / 127.0f * segmentsPerBar;  // 0..segmentsPerBar
  if (position > segmentsPerBar) {
    position = segmentsPerBar;
  }
  uint8_t fullSegments = (uint8_t)position;
  float fraction = position - fullSegments;  // brightness of the one edge segment, 0..1
  if (fullSegments >= segmentsPerBar) {
    fullSegments = segmentsPerBar;
    fraction = 0.0f;
  }

  uint16_t base = (uint16_t)potIndex * segmentsPerBar;
  Serial.printf("setBarLevel: potIndex=%u value=%u fullSegments=%u fraction=%.2f base=%u\n",
                potIndex, value, fullSegments, fraction, base);
  for (uint8_t s = 0; s < segmentsPerBar; s++) {
    if (s < fullSegments) {
      strip.setPixelColor(base + s, scaledOrange(1.0f));
    } else if (s == fullSegments && fraction > 0.0f) {
      strip.setPixelColor(base + s, scaledOrange(fraction));
    } else {
      strip.setPixelColor(base + s, 0);
    }
  }
  strip.show();
}

// Incoming CC -> per-pot bar level.
void handleMidiIn(const midiEventPacket_t &packet) {
  uint8_t status = packet.byte1 & 0xF0;
  uint8_t channel = (packet.byte1 & 0x0F) + 1;  // 1-indexed, matches controlChange()'s channel param
  Serial.printf("MIDI IN: header=%02X byte1=%02X byte2=%02X byte3=%02X (status=%02X channel=%u)\n",
                packet.header, packet.byte1, packet.byte2, packet.byte3, status, channel);
  if (status == 0xB0 && channel == midiChannel) {
    uint8_t cc = packet.byte2;
    if (cc >= ledCcBase && cc < ledCcBase + numPots) {
      setBarLevel(cc - ledCcBase, packet.byte3);
    } else {
      Serial.printf("  cc=%u out of LED range [%u,%u)\n", cc, ledCcBase, ledCcBase + numPots);
    }
  } else {
    Serial.println("  status/channel mismatch, ignored");
  }
}

void setup() {
  Serial.begin(115200);

  for (uint8_t i = 0; i < numPots; i++) {
    pinMode(potPins[i], INPUT);
    filtered[i] = readPotRaw(potPins[i]);  // seed the filter so it doesn't ramp up from 0
    everSent[i] = false;
  }

  strip.begin();
  strip.setBrightness(ledBrightnessCap);
  strip.clear();
  strip.show();

  MIDI.begin();
  USB.begin();
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
    int raw = readPotRaw(potPins[i]);
    filtered[i] += (raw - filtered[i]) * emaAlpha;

    float midiFloat = adcToMidiFloat(filtered[i]);
    if (!everSent[i] || fabsf(midiFloat - lastSentMidi[i]) >= sendThreshold) {
      uint8_t value = (uint8_t)(midiFloat + 0.5f);
      MIDI.controlChange(ccNumbers[i], value, midiChannel);
      lastSentMidi[i] = midiFloat;
      everSent[i] = true;
    }
  }
}
