// bar3_test - basic test for 3 NeoPixel Sticks (8 pixels each) chained in series.
// Board: ESP32-S3-Zero. Data -> GPIO11, 5V/GND from the board's 5V pad.
// Phase 1: each stick lit in its own color (R, G, B) -> checks chain order/wiring.
// Phase 2: single white pixel chasing across all 24 -> checks every pixel.
// Phase 3: rainbow. Then loops. Onboard RGB LED is intentionally not used (RMT conflict).
#include <Arduino.h>
#include <Adafruit_NeoPixel.h>

const uint8_t dataPin = 11;
const uint8_t numBars = 3;
const uint8_t pixelsPerBar = 8;
const uint16_t numPixels = numBars * pixelsPerBar;
const uint8_t brightness = 30;  // 0-255, keep low on USB power

Adafruit_NeoPixel strip(numPixels, dataPin, NEO_GRB + NEO_KHZ800);

void setup() {
  strip.begin();
  strip.setBrightness(brightness);
  strip.clear();
  strip.show();
}

void barColors() {
  const uint32_t colors[numBars] = { strip.Color(255, 0, 0), strip.Color(0, 255, 0), strip.Color(0, 0, 255) };
  for (uint16_t i = 0; i < numPixels; i++) strip.setPixelColor(i, colors[i / pixelsPerBar]);
  strip.show();
  delay(2500);
}

void chase() {
  for (uint16_t i = 0; i < numPixels; i++) {
    strip.clear();
    strip.setPixelColor(i, strip.Color(255, 255, 255));
    strip.show();
    delay(80);
  }
}

void rainbow() {
  for (uint16_t j = 0; j < 256 * 2; j += 4) {
    for (uint16_t i = 0; i < numPixels; i++) {
      strip.setPixelColor(i, strip.gamma32(strip.ColorHSV((i * 65536L / numPixels + j * 256) & 0xFFFF)));
    }
    strip.show();
    delay(15);
  }
}

void loop() {
  barColors();
  chase();
  rainbow();
}
