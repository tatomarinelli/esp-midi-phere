/*
  pots_test - bench test for the 10 pots. Flash it alone, check, then the
  same pin/filter values are already in esp-midi-phere.ino.
  Board: Waveshare ESP32-S3-Zero (same Arduino IDE setup as esp-midi-phere.ino)

  Wiring (must match esp-midi-phere.ino): pot N wiper -> GPIO N (1-10),
  outer legs -> 3V3 / GND.

  Verify:
    - Device shows up as MIDI "esp-midi-phere-test".
    - Turning pot N sends CC N (channel 1), 0-127, no flicker at rest, no
      skipped values. Serial (115200) prints every value sent.
    - Pots not wired: set their entry in potEnabled[] to false. A floating
      ADC pin reads noise and would spam CCs.
*/

#if ARDUINO_USB_MODE
#warning "Set USB Mode to 'USB-OTG (TinyUSB)' in the Tools menu"
void setup() {}
void loop() {}
#else

#include "USB.h"
#include "USBMIDI.h"

USBMIDI MIDI("esp-midi-phere-test");

const uint8_t potPins[] = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 };
const uint8_t numPots = sizeof(potPins) / sizeof(potPins[0]);
const bool potEnabled[numPots] = { true, true, true, true, true, true, true, true, true, true };
const uint8_t midiChannel = 1;

const uint16_t adcMax = 4095;
const uint8_t oversampleCount = 8;
const float emaAlpha = 0.3f;
const float sendThreshold = 0.6f;
const uint16_t scanIntervalMs = 2;
const bool invert = true;  // same as the firmware default

float filtered[numPots];
float lastSentMidi[numPots];
bool everSent[numPots];
uint32_t lastScan = 0;

int readPotRaw(uint8_t pin) {
  uint32_t sum = 0;
  for (uint8_t s = 0; s < oversampleCount; s++) sum += analogRead(pin);
  return sum / oversampleCount;
}

void setup() {
  Serial.begin(115200);
  for (uint8_t i = 0; i < numPots; i++) {
    pinMode(potPins[i], INPUT);
    filtered[i] = readPotRaw(potPins[i]);
  }
  MIDI.begin();
  USB.begin();
}

void loop() {
  uint32_t now = millis();
  if (now - lastScan < scanIntervalMs) return;
  lastScan = now;

  for (uint8_t i = 0; i < numPots; i++) {
    if (!potEnabled[i]) continue;
    filtered[i] += (readPotRaw(potPins[i]) - filtered[i]) * emaAlpha;
    float v = filtered[i] / adcMax * 127.0f;
    if (invert) v = 127.0f - v;
    if (v < 0) v = 0;
    if (v > 127) v = 127;
    if (!everSent[i] || fabsf(v - lastSentMidi[i]) >= sendThreshold) {
      uint8_t value = (uint8_t)(v + 0.5f);
      MIDI.controlChange(i + 1, value, midiChannel);
      Serial.printf("pot %u -> CC%u = %u\n", i + 1, i + 1, value);
      lastSentMidi[i] = v;
      everSent[i] = true;
    }
  }
}

#endif
