/*
  hc4067_button_test - bench prototype adding an HW-178 (CD74HC4067) analog
  mux to the existing led_bar_test 2-pot/1-stick setup, replacing the
  PCF8574 I2C approach after it caused an unresolved reset loop.
  Board: Waveshare ESP32-S3-Zero

  Scope: same 2 pots + 1 NeoPixel Stick MIDI loop as led_bar_test, plus one
  button read through channel C0 of the mux. Only S0 is driven for now (one
  channel wired); S1-S3 and EN are hardwired to GND on the module itself.
  The stick's last pixel (index 7) is repurposed as a button status LED
  instead of a VU segment, so pot 2's bar is 3 segments instead of 4.

  Wiring:
    Pot 1: wiper -> GPIO1, outer legs -> 3V3 / GND
    Pot 2: wiper -> GPIO2, outer legs -> 3V3 / GND
    NeoPixel Stick DIN -> GPIO11
    NeoPixel Stick 5V/GND -> board's 5V pad (USB VBUS) / GND, NOT 3V3
    ~1000uF capacitor across 5V/GND right at the stick's power input

    HW-178 VCC -> 3V3, GND -> GND
    HW-178 EN -> GND (tied on the module, always enabled)
    HW-178 S0 -> GPIO14
    HW-178 S1, S2, S3 -> GND (tied on the module, channel fixed to C0 for now)
    HW-178 SIG -> GPIO15 (INPUT_PULLUP)
    Test button: one leg -> HW-178 C0, other leg -> GND

  Verify:
    - Board enumerates as a MIDI device named "esp-midi-phere-test".
    - Pot 1/2 CC out and CC20/21 bar-in behavior matches led_bar_test.
    - Pressing the test button lights pixel 7 green and prints "button
      pressed" once over Serial; releasing turns it off and prints "button
      released". No repeated prints while held (state-change only).
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

const uint8_t ledDataPin = 11;      // NeoPixel Stick data line
const uint16_t numPixels = 8;
const uint8_t barBase[numPots] = { 0, 4 };      // pot i's bar starts at this pixel
const uint8_t barSegments[numPots] = { 4, 3 };  // pot 2's bar gives up 1 segment to the status LED
const uint8_t buttonStatusPixel = 7;
const uint8_t ledBrightnessCap = 40;  // global brightness cap (0-255), keeps current draw sane
const uint8_t ledCcBase = 20;         // pot i's bar level arrives on CC (ledCcBase + i)

const uint8_t muxS0Pin = 14;  // S1-S3 tied to GND on the module -- channel fixed to C0
const uint8_t muxSigPin = 15;

Adafruit_NeoPixel strip(numPixels, ledDataPin, NEO_GRB + NEO_KHZ800);

const uint32_t buttonDebounceMs = 20;  // raw reading must hold steady this long before it counts

float filtered[numPots];
float lastSentMidi[numPots];  // continuous MIDI-unit position of the last value sent
bool everSent[numPots];
uint32_t lastScan = 0;
bool buttonPressed = false;
bool buttonRaw = false;
uint32_t lastButtonEdge = 0;

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
// discrete segments would alone.
const uint8_t orangeR = 255;
const uint8_t orangeG = 140;

uint32_t scaledOrange(float fraction) {
  if (fraction < 0) fraction = 0;
  if (fraction > 1) fraction = 1;
  return strip.Color((uint8_t)(orangeR * fraction), (uint8_t)(orangeG * fraction), 0);
}

void setBarLevel(uint8_t potIndex, uint8_t value) {
  uint8_t segments = barSegments[potIndex];
  float position = (float)value / 127.0f * segments;  // 0..segments
  if (position > segments) {
    position = segments;
  }
  uint8_t fullSegments = (uint8_t)position;
  float fraction = position - fullSegments;  // brightness of the one edge segment, 0..1
  if (fullSegments >= segments) {
    fullSegments = segments;
    fraction = 0.0f;
  }

  uint16_t base = barBase[potIndex];
  Serial.printf("setBarLevel: potIndex=%u value=%u fullSegments=%u fraction=%.2f base=%u\n",
                potIndex, value, fullSegments, fraction, base);
  for (uint8_t s = 0; s < segments; s++) {
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

void checkButton() {
  digitalWrite(muxS0Pin, LOW);  // selects C0 (S1-S3 fixed low on the module)
  bool raw = (digitalRead(muxSigPin) == LOW);
  uint32_t now = millis();

  if (raw != buttonRaw) {
    buttonRaw = raw;
    lastButtonEdge = now;
  }

  if (buttonRaw == buttonPressed || (now - lastButtonEdge) < buttonDebounceMs) {
    return;
  }
  buttonPressed = buttonRaw;
  strip.setPixelColor(buttonStatusPixel, buttonPressed ? strip.Color(0, 255, 0) : 0);
  strip.show();
  Serial.printf("button %s\n", buttonPressed ? "pressed" : "released");
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

  pinMode(muxS0Pin, OUTPUT);
  pinMode(muxSigPin, INPUT_PULLUP);

  MIDI.begin();
  USB.begin();
}

void loop() {
  // Drain incoming MIDI immediately, independent of the pot scan interval below.
  midiEventPacket_t rx;
  while (MIDI.readPacket(&rx)) {
    handleMidiIn(rx);
  }

  checkButton();

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
