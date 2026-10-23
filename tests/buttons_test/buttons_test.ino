/*
  buttons_test - bench test for the 8 buttons read through an HW-178
  (CD74HC4067) analog mux. Board: Waveshare ESP32-S3-Zero (same Arduino IDE
  setup as esp-midi-phere.ino).

  Wiring (PROPOSED pins, confirm they are broken out on the board):
    HW-178 VCC -> 3V3, GND -> GND, EN -> GND
    HW-178 S0 -> GPIO14, S1 -> GPIO16, S2 -> GPIO17, S3 -> GPIO18
    HW-178 SIG -> GPIO15 (INPUT_PULLUP)
    Button N (N = 1-8): one leg -> HW-178 C(N-1), other leg -> GND

  Verify:
    - Device shows up as MIDI "esp-midi-phere-test".
    - Pressing button N sends Note On (note 35+N, velocity 127, channel 1),
      releasing sends Note Off. One message per edge, nothing while held, no
      bounce. Serial (115200) prints "button N pressed/released".
*/

#if ARDUINO_USB_MODE
#warning "Set USB Mode to 'USB-OTG (TinyUSB)' in the Tools menu"
void setup() {}
void loop() {}
#else

#include "USB.h"
#include "USBMIDI.h"

USBMIDI MIDI("esp-midi-phere-test");

const uint8_t muxSelPins[4] = { 14, 16, 17, 18 };  // S0..S3
const uint8_t muxSigPin = 15;
const uint8_t numButtons = 8;
const uint8_t noteBase = 36;  // button N -> note 35+N
const uint8_t midiChannel = 1;
const uint32_t debounceMs = 20;  // raw reading must hold steady this long
const uint16_t muxSettleUs = 5;  // after changing the channel, before reading SIG

bool pressed[numButtons];
bool raw[numButtons];
uint32_t lastEdge[numButtons];

void setup() {
  Serial.begin(115200);
  for (uint8_t i = 0; i < 4; i++) pinMode(muxSelPins[i], OUTPUT);
  pinMode(muxSigPin, INPUT_PULLUP);
  MIDI.begin();
  USB.begin();
}

void loop() {
  uint32_t now = millis();
  for (uint8_t ch = 0; ch < numButtons; ch++) {
    for (uint8_t b = 0; b < 4; b++) digitalWrite(muxSelPins[b], (ch >> b) & 1);
    delayMicroseconds(muxSettleUs);
    bool r = digitalRead(muxSigPin) == LOW;
    if (r != raw[ch]) {
      raw[ch] = r;
      lastEdge[ch] = now;
    }
    if (raw[ch] == pressed[ch] || now - lastEdge[ch] < debounceMs) continue;
    pressed[ch] = raw[ch];
    if (pressed[ch]) MIDI.noteOn(noteBase + ch, 127, midiChannel);
    else MIDI.noteOff(noteBase + ch, 0, midiChannel);
    Serial.printf("button %u %s\n", ch + 1, pressed[ch] ? "pressed" : "released");
  }
}

#endif
