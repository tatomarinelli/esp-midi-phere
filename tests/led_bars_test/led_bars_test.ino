/*
  led_bars_test - bench test for the NeoPixel bars (5 sticks, 2 pots each).
  Board: Waveshare ESP32-S3-Zero (same Arduino IDE setup as esp-midi-phere.ino)

  Wiring (must match esp-midi-phere.ino): chain DIN -> GPIO11 (through ~300R),
  sticks' 5V/GND -> board 5V pad / GND (NOT 3V3), ~1000uF across 5V/GND at
  the first stick. Chain order = pot order (stick 1 = pots 1+2, ...).

  Verify:
    - On boot every bar fills 0 -> max one after another (wrong order or a dead
      pixel shows up here). Serial (115200) says which bar is running.
    - After that, CC20-29 (channel 1) set bar 1-10 from 0 to 127: fully lit
      segments plus one edge segment that fades in. Send them from any MIDI
      tool or `amidi`. Device shows up as MIDI "esp-midi-phere-test".
*/

#if ARDUINO_USB_MODE
#warning "Set USB Mode to 'USB-OTG (TinyUSB)' in the Tools menu"
void setup() {}
void loop() {}
#else

#include "USB.h"
#include "USBMIDI.h"
#include <Adafruit_NeoPixel.h>

USBMIDI MIDI("esp-midi-phere-test");

const uint8_t numBars = 10;
const uint8_t ledDataPin = 11;
const uint8_t segmentsPerBar = 4;
const uint16_t numPixels = (uint16_t)numBars * segmentsPerBar;
const uint8_t ledBrightnessCap = 40;  // raw brightness, keeps USB current sane
const uint8_t ledCcBase = 20;
const uint8_t ledInChannel = 1;
const uint8_t colorR = 255, colorG = 140, colorB = 0;

Adafruit_NeoPixel strip(numPixels, ledDataPin, NEO_GRB + NEO_KHZ800);

void setBar(uint8_t bar, uint8_t value) {
  float p = value / 127.0f * segmentsPerBar;
  for (uint8_t s = 0; s < segmentsPerBar; s++) {
    float f = p - s;
    if (f < 0) f = 0;
    if (f > 1) f = 1;
    float k = f * ledBrightnessCap / 255.0f;
    strip.setPixelColor(bar * segmentsPerBar + s, (uint8_t)(colorR * k + 0.5f), (uint8_t)(colorG * k + 0.5f), (uint8_t)(colorB * k + 0.5f));
  }
}

void setup() {
  Serial.begin(115200);
  strip.begin();
  strip.setBrightness(255);
  strip.clear();
  strip.show();
  MIDI.begin();
  USB.begin();

  for (uint8_t bar = 0; bar < numBars; bar++) {
    Serial.printf("bar %u\n", bar + 1);
    for (uint8_t v = 0; v <= 127; v += 4) {
      setBar(bar, v);
      strip.show();
      delay(8);
    }
    delay(150);
  }
  strip.clear();
  strip.show();
}

void loop() {
  midiEventPacket_t rx;
  while (MIDI.readPacket(&rx)) {
    if ((rx.byte1 & 0xF0) != 0xB0 || (rx.byte1 & 0x0F) + 1 != ledInChannel) continue;
    uint8_t cc = rx.byte2;
    if (cc < ledCcBase || cc >= ledCcBase + numBars) continue;
    Serial.printf("CC%u = %u -> bar %u\n", cc, rx.byte3, cc - ledCcBase + 1);
    setBar(cc - ledCcBase, rx.byte3);
    strip.show();
  }
}

#endif
