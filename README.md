# esp-midi-phere

USB-MIDI pot controller with per-pot LED level meters, on a Waveshare ESP32-S3-Zero. Firmware targets the full 10-pot design; wire up as many as you have.

## Wiring — pots

| Pot | Wiper (center) | Outer legs |
|---|---|---|
| 1 | GPIO1 | 3V3 / GND |
| 2 | GPIO2 | 3V3 / GND |
| 3 | GPIO3 | 3V3 / GND |
| 4 | GPIO4 | 3V3 / GND |
| 5 | GPIO5 | 3V3 / GND |
| 6 | GPIO6 | 3V3 / GND |
| 7 | GPIO7 | 3V3 / GND |
| 8 | GPIO8 | 3V3 / GND |
| 9 | GPIO9 | 3V3 / GND |
| 10 | GPIO10 | 3V3 / GND |

Use B10K linear pots, powered from 3V3 (not 5V — the ADC reference is 3.3V). All pots share the same 3V3/GND rails.

## Wiring — LED meters

5x [Adafruit NeoPixel Stick](https://www.adafruit.com/product/1426) (8 x SK6812/WS2812 5050), **each stick shared by 2 adjacent pots** (4 segments per pot) — this halves the part count and physical footprint versus one stick per pot, with no firmware complexity added since the pixels are individually addressable: pixel order in the chain already maps cleanly onto "4 pixels per pot" as long as wiring order matches pot order.

- Stick 1 = pots 1+2 (pixels 0-3 = pot 1, pixels 4-7 = pot 2)
- Stick 2 = pots 3+4
- Stick 3 = pots 5+6
- Stick 4 = pots 7+8
- Stick 5 = pots 9+10

- Chain them data-out → data-in, stick to stick, **in that pot order** (see "Order matters" below).
- First stick's data-in → **GPIO11**.
- All sticks' power/GND → the board's **5V pad** (USB VBUS), **not** the 3V3 pin. The onboard 3.3V regulator is only rated 800mA and also has to run the ESP32-S3 itself.
- Common GND between the LED chain and the board.

As of April 2023 this product actually ships with SK6812 chips internally (Adafruit kept the "WS2812" name), which is why no logic-level shifter is needed even though the ESP32-S3's GPIO is 3.3V — SK6812 is 3.3V-logic-safe.

Brightness is capped in firmware (`ledBrightnessCap`) to keep current draw sane — worst case (all 40 pixels lit) stays comfortably under typical USB power budgets at that cap.

The onboard WS2812 (GPIO21) needs no extra wiring — it's just a dim "alive" indicator once USB-MIDI comes up.

### Connecting the chain, step by step

**Power (once, from the board):**
- Board's **5V pad** → Stick 1's `5V`/`PWR` pad
- Board's **GND** → Stick 1's `GND` pad
- Add a **~1000µF capacitor** across 5V/GND right where it enters Stick 1 — absorbs the power-on inrush spike addressable LEDs cause, protects the first pixel.

**Data (once, from the board):**
- Board's **GPIO11** → (through a ~300Ω resistor) → Stick 1's `DIN` pad

**Chaining the rest (repeat identically for all 5 sticks):**
- Stick *N*'s `DOUT` → Stick *N+1*'s `DIN`
- Stick *N*'s `5V`/`GND` pass-through pads → Stick *N+1*'s `5V`/`GND` pads

Each stick has pads at both ends for exactly this — solder wires end-to-end down the line. Power and ground ride along the same chain (the sticks bus 5V/GND straight through); only the data line is truly serial (each stick's driver reads its own 8 pixels off the stream, then passes the rest through to `DOUT`).

**Order matters**: whichever stick is wired first in the chain becomes pixels 0-7, which the code treats as **pots 1 and 2's** bars (pixels 0-3 and 4-7). Second stick in the chain = pots 3 and 4, and so on down the table above. Chain order must match your physical panel layout, not just be soldered in arbitrary order, or the bars will light up next to the wrong pots.

**Troubleshooting voltage sag**: if the last stick or two look dim or slightly off-color once everything is wired and running, that's voltage drop along the chain. Fix by injecting a second 5V+GND connection from the board partway down the chain (e.g. at stick 3). Unlikely to matter at this scale (5 sticks, short wire runs, capped brightness) but worth knowing if it happens.

## Arduino IDE setup

1. Boards Manager: install **esp32 by Espressif Systems** (core 3.x).
2. Library Manager: install **Adafruit NeoPixel**.
3. Tools menu:
   - Board: **ESP32S3 Dev Module**
   - USB Mode: **USB-OTG (TinyUSB)** — required for the board to enumerate as a MIDI device
   - USB CDC On Boot: **Enabled** (optional, gives you `Serial` over the same USB port for debugging)
4. To flash: hold the **BOOT** button while plugging in the Type-C cable (the S3-Zero has no separate USB-serial chip), then upload.

## Verify

- After flashing, the board should show up as a MIDI device named **esp-midi-phere** on your computer.
- Turning each wired pot should send its CC (1-10, channel 1) values 0-127 smoothly, with no flicker when idle and no skipped values while sweeping.
- The onboard LED should light dim white once the sketch finishes `setup()`.

## LED meters (MIDI in)

CC20-CC29 on channel 1 set pot 1-10's bar level respectively (0-127 mapped to 0-4 lit segments, solid orange). The leading edge segment's brightness ramps proportionally with the value's fractional position between segments, giving smoother in-between resolution than a hard 4-step jump would alone. These are meant to be driven by Ableton reflecting the *actual* Macro value in Live — not just an echo of the pot's own position — so the meter stays correct even if a Macro changes from something other than the physical pot (mouse, automation, preset recall).

### Ableton Remote Script

The included script (`ableton-remote-script/ESP_MIDI_Phere/`) currently two-way binds two named Macros, as a test before wiring up all 10 Macros. It searches **the whole song** (every track, return track, and the master track) for parameters named exactly `POT1-1` and `POT1-2` (set via `POT_PARAMETER_NAMES` in `ESP_MIDI_Phere.py`) — rename the target Macros in your Audio Effect Rack's UI to those for this to find them. Once found, each match gets bound **both ways**:
- **Pot → Macro**: the pot's own CC (CC1/CC2, straight from the ESP) is bound to drive the Macro's value, via Live's standard `EncoderElement.connect_to()` — the same mechanism Ctrl+M MIDI-Map mode sets up by hand, just done automatically by name instead of manually per Live Set.
- **Macro → LED**: the Macro's value is forwarded to CC20/CC21 to drive that pot's LED bar, same as before.

This binding is **fixed**, not tied to Live's track selection — pot 1/2 always control the same Macros no matter what you're currently looking at in Live. If no match is found anywhere in the song, neither binding is made, and it logs a message to Live's `Log.txt` instead of failing.

A periodic re-scan (every `RESCAN_INTERVAL_TICKS`, a few seconds) is the only rebind trigger, since none of the ways a binding can go stale — a macro renamed away, a device/track deleted, a new match appearing after a rack is built — fire an event we could listen to directly.

That periodic re-scan used to compare the freshly-found parameter to the previously-bound one by Python object identity (`is`), which caused continuous, never-stopping MIDI output — Live's API doesn't guarantee returning the same Python object for the same macro across separate lookups, so the identity check spuriously read "changed" on almost every cycle and resent MIDI even when nothing had. It now instead checks a stable property (the parameter's name) and only re-binds/resends when the match genuinely breaks.

**Earlier design note (resolved)**: an earlier version of this script followed whatever track was *selected* in Live instead of scanning the whole song — simpler for quick testing (no renaming needed, just click the track you want), but it meant the pot did nothing and the LED went stale the instant you clicked a different track. That didn't match the original goal of fixed, simultaneous control regardless of what's selected in Live, so it was replaced with the whole-song scan described above.

This is a stepping stone to the full design: once confirmed working, extending it to all 10 Macros (2 per channel, across up to 5 channels, named `POT<channel>-<macroIndex>`) and forwarding each to its corresponding CC20-29 is the next step — same lookup pattern, just repeated per parameter/CC pair (each pair is its own explicit `subject_slot`-decorated method, since that decorator is a class-level descriptor and can't be generated dynamically in a loop).

Install steps:

1. Copy the `ESP_MIDI_Phere` folder into Ableton's user Remote Scripts directory:
   - macOS: `~/Music/Ableton/User Library/Remote Scripts/`
   - Windows: `Documents\Ableton\User Library\Remote Scripts\`
   - (Create the `Remote Scripts` folder inside `User Library` if it doesn't exist yet.)
2. Restart Live.
3. Preferences → Link, Tempo & MIDI → under Control Surface, choose **ESP_MIDI_Phere**. Set both Input and Output to the **esp-midi-phere** (or **esp-midi-phere-test**, if still running the bench-test sketch) USB MIDI port.
4. Rename two Macros to `POT1-1` and `POT1-2` in the Audio Effect Rack's UI. Turning the physical pots should now move the Macros directly (no manual Ctrl+M mapping needed), and each Macro's value drives its matching LED bar — try moving the Macro by mouse too, the bar should follow that just as well.

If the script fails to load, Live logs the traceback to its `Log.txt` (Help → Show Log Files). Share that traceback if something breaks — I can't run Live myself to test this directly.

## Planned expansion (not yet wired/implemented)

Design discussion for the next round of hardware, captured here so it can be picked up later.

### 12 pots / 6 LED bars

Same design as today, just one more pot pair and one more VU stick:

- Pots 11-12 wire to **GPIO12/GPIO13** (ADC2 channels, since ADC1 — GPIO1-10 — is fully used by pots 1-10).
- ADC2 works fine here because this sketch never enables WiFi/BT (ADC2's only real limitation is contention with the WiFi radio). If WiFi is ever added to this sketch, that would conflict.
- GPIO19/20 (ADC2 channels 8/9) are **not usable** — they're the native USB D-/D+ lines this project depends on for USB-MIDI.
- 6th NeoPixel Stick added to the existing GPIO11 chain, same "2 pots per stick, 4 segments each" pattern (stick 6 = pots 11+12). No firmware architecture change, just extending `potPins`/`ccNumbers`/stick count.
- Current draw scales roughly proportionally (48 pixels vs. 40) and stays comfortably under USB power budgets at the existing brightness cap.

### Bottom control row: per-channel IN / AUTO / OFF

Separate hardware from the pots/VU bars (those stay untouched). One button + one status LED per **channel**, where a channel = one VU-stick pair (6 channels total, matching the 6 bars).

- **Behavior**: button press cycles that channel's Ableton-side state IN → AUTO → OFF → IN... `IN` = the physical pot actively drives the mapped macro (live control). `AUTO` = the Remote Script stops forwarding pot CC for that channel so Live's own automation/playback can drive the macro without the pot fighting it. `OFF` = channel fully detached (no forwarding, no automation binding). This logic lives entirely in the Ableton Remote Script's per-channel state machine, not in the ESP32 firmware.
- **Status LED**: a 6-pixel segment **cut from a standard WS2812B/SK6812 strip reel** (not an Adafruit NeoPixel Stick — those are fixed-length 8-pixel boards and can't be cut to 6). Cut only at the marked scissor lines between pixels; feed the GPIO into the segment's **DIN** end (check the printed direction arrows), not DOUT. Runs as its own independent chain on one new data GPIO, same pattern as the existing VU bars.
- **Buttons**: 6 momentary buttons, `INPUT_PULLUP` to GND, no external resistors needed.

**Open decision — how to wire the 6 buttons:**

| Option | Pins needed | Notes |
|---|---|---|
| **HC4067 analog mux (chosen, 8 buttons)** | 5 pins (S0-S3 + SIG) | See `tests/buttons_test`. |
| Direct GPIO | 6 native GPIOs | Likely candidates: GPIO14-18 (confirmed free ADC2 pins) + one more from GPIO38/43/44 (should be free since `Serial` runs over native USB-CDC here, not the physical UART pins) — **but not yet confirmed these are physically broken out on the ESP32-S3-Zero's compact header.** Verify against the board before wiring. |
| PCF8574 I2C GPIO expander (abandoned: reset loop, see `archive/`) | 2 pins (SDA/SCL) | Sidesteps the uncertain higher-numbered pins entirely, leaves headroom for future buttons, ~$2 part. |

### Pin budget as of this plan

- Used: GPIO1-10 (pots 1-10, ADC1), GPIO12-13 (pots 11-12, ADC2), GPIO11 (VU bar chain data), GPIO21 (onboard alive LED).
- Reserved/unusable: GPIO19-20 (USB D-/D+), GPIO0 (BOOT strap — avoid, already dual-purposed for flashing).
- Needed for the control row: 1 GPIO (status-strip data) + 6 GPIOs or 2 GPIOs (buttons, depending on direct-wire vs. I2C expander choice above).
- Free ADC2 pins available for the above: GPIO14-18 (5 pins) — assuming physically broken out on this board (not yet confirmed).

Next steps when resuming: confirm GPIO14-18 (and 38/43/44 if going direct-wire) are actually broken out on the physical board, decide direct-wire vs. I2C expander for the buttons, then update firmware (pot arrays, second NeoPixel strip object, button reading, MIDI note mapping for button presses) and extend the Remote Script with the per-channel IN/AUTO/OFF state machine.

## Analog audio switcher (Strymon TimeLine send/return, standalone enclosure)

Fully analog, fully separate circuit from the ESP32/MIDI electronics above. It originally shared the MIDI controller's box (an earlier `esp-midi-phere-enclosure-v4.scad` put this section's 10 jacks + 1 switch on that box's rear wall), but that whole enclosure lineage was abandoned in favor of the current 12-pot/8-button panel (`enclosure/esp-midi-phere-top-template-v4.scad/.svg/.pdf`), which has no rear-wall I/O. This circuit now lives in its own dedicated box instead — `enclosure/timeshare-enclosure.scad` — fully independent physically as well as electrically.

**Goal**: run a guitar and an Arturia MicroFreak into a single Strymon TimeLine, then out to a 4-channel audio interface (guitar → interface ch 1/2, MicroFreak → ch 3/4), with a quick switch for whether the MicroFreak or the guitar is the one currently going through TimeLine.

**Key hardware fact (confirmed by you)**: TimeLine's input is always mono, Left channel only — there's no second, independent input to dedicate to the second instrument. Its output is genuine stereo (L+R). That means TimeLine can only process **one** of the two instruments at a time — this isn't two simultaneous effects sends, it's one shared effect that the switch hands between the two instruments.

### Where this sits in your actual rig

`IN-G` isn't a raw guitar signal — it's the tail end of your existing board: **guitar → wah → JHS Pulp N Peel V4 → TS9 → Tonex One → Polytune (buffered) → Flanger → `IN-G`**. By that point the signal has already been buffered multiple times over (Tonex One's output stage, and the Polytune explicitly), so it's low-impedance, not a raw passive pickup signal — this is what makes the tone-suck note below a non-issue rather than just a small one.

Practically, this switcher **replaces your current direct `Flanger → TimeLine → Interface` cabling** — TimeLine gets re-patched to live inside this box instead of wired straight into your board:
- Old: `Flanger OUT → TimeLine IN`, `TimeLine OUT → Interface`
- New: `Flanger OUT → IN-G`, `SEND-A (switch common) → TimeLine IN`, `TimeLine OUT → RETURN-A`, `OUT-GL/OUT-GR (switch throw) → Interface`

Confirmed with you — this is the intended setup, not an accidental side effect of the design.

### Signal flow

**Mode 1 — "MF direct" (default)**: TimeLine is free, so guitar uses it. No conflict — both instruments fully live at once.

```
Guitar IN ──► SEND-A ──► TimeLine IN (mono) ──► TimeLine OUT L/R ──► OUT-GL / OUT-GR   (wet, true stereo)
MF IN     ─────────────────────────────────────────────────────────► OUT-MFL / OUT-MFR (dry, duplicated mono)
```

**Mode 2 — "MF through TimeLine"**: now MicroFreak occupies TimeLine, so guitar can't have it — guitar falls back to dry (your call: dry, not silent) on OUT-GL/OUT-GR.

```
MF IN     ──► SEND-B ──► TimeLine IN (mono) ──► TimeLine OUT L/R ──► OUT-MFL / OUT-MFR  (wet — collapsed to mono, see note below)
Guitar IN ─────────────────────────────────────────────────────────► OUT-GL / OUT-GR    (dry, duplicated mono, fallback)
```

### The switch: 4PDT, on-on, fully passive

One 4-pole toggle does the whole swap — still "1 switch," still no power supply, matches "completely analog":

| Pole | Common | Mode 1 throw ("MF direct") | Mode 2 throw ("MF via TimeLine") |
|---|---|---|---|
| 1 | TimeLine IN | Guitar IN | MF IN |
| 2 | OUT-GL | TimeLine OUT-L | Guitar IN (dry) |
| 3 | OUT-GR | TimeLine OUT-R | Guitar IN (dry, same tap as pole 2) |
| 4 | OUT-MFL **and** OUT-MFR (tied together) | MF IN (dry) | TimeLine OUT-L only |

**Trade-off baked into pole 4** — genuine stereo from TimeLine only comes through on guitar's output (poles 2+3 keep L and R separate). MicroFreak's wet signal (Mode 2) collapses to mono because there's only 1 pole left to give it. Confirmed this is the right place to spend the scarce pole, for two independent reasons:
- MicroFreak's own output, while physically stereo (2 jacks on the synth), is functionally mono content for your patches — its L and R aren't meaningfully different signals, so feeding just one side into `IN-MF` and later collapsing its wet path to mono loses nothing that wasn't already true going in.
- Usage is asymmetric: guitar-wet/MF-dry (Mode 1) is the ~90% case, MF-wet (Mode 2) the ~10% case — so it's the rare mode's signal that gets the mono trade-off, not the common one.

Net effect either way (dry or wet, either mode): whichever signal is mono gets **paralleled onto both L and R jack tips** at the switch (not left on one side and silent on the other), so the interface always reads an identical, centered L=R signal on that pair — same as a synth's "L/Mono" jack feeding two inputs.

### The "2 sends" vs. TimeLine's 1 physical input

`SEND-A` and `SEND-B` are breakout taps on *this* box (Guitar IN and MF IN respectively, landing on pole 1's two throws) — they were never meant to be cabled to TimeLine simultaneously. Only pole 1's **common** terminal ever gets a physical cable to TimeLine's one input jack. In other words: wire a single cable from the switch's pole-1 common to TimeLine IN; `SEND-A`/`SEND-B` themselves don't need cables out to TimeLine at all unless you want them as extra patch/test points.

### Before wiring this, confirm on the real hardware

- [ ] **Input level matching (MicroFreak)** — TimeLine's input is calibrated for instrument-level guitar. MicroFreak's line-level output usually runs hotter and may clip it. Check MicroFreak's output level against TimeLine's input trim; a resistive pad inline on `SEND-B` may be needed.
- [x] **Input level matching (guitar side)** — confirmed: Tonex One is set to **Instrument** output level, matching what TimeLine's input expects. No pad needed on the guitar side.
- [x] **MicroFreak wet output is mono, not stereo** (pole 4 trade-off above) — confirmed fine: MicroFreak's stereo output is functionally mono content anyway, and Mode 2 (MF wet) is the rare ~10% case vs. guitar-wet's ~90%.
- [ ] **Passive output splitting** — no buffer on the dry-duplicated paths (guitar's Mode 2 fallback, MicroFreak's Mode 1 dry, MicroFreak's Mode 2 mono-wet). Splitting to 2 jacks halves the load impedance at that junction; negligible into a typical high-Z (250kΩ+) interface input, but the thing to listen for once built.
- [x] **4PDT switch physically fits** the `switch_hole_d = 6.5mm` cutout already cut into v4 — confirmed: standard 4PDT mini toggles (the common 12-pin MTS-402/403 style) use the same 6mm bushing as regular SPDT/DPDT mini toggles, not a larger one as originally assumed. No CAD change needed.

**Level/tone risk is low by design, but worth knowing where it lives:**
- *Tone suck* (high-frequency rolloff from cable capacitance + load impedance) is only a risk for a raw, unbuffered passive-pickup signal — and `IN-G` never carries one. It's already been through Tonex One's active output stage and your buffered Polytune before it ever reaches this box (see "Where this sits in your actual rig" above), so it's low-impedance the entire time it's inside the switcher, regardless of splitting or switch-contact hops. MicroFreak's output is already active/buffered too, so neither signal is exposed to this.
- *Level drop* from passive splitting (above) is negligible into a real interface input.
- *Actual signal dropout* (crackling, intermittent contact) is a switch-quality issue, not a topology issue. Correction from an earlier note here: gold-plated contacts aren't really a stock option at the 4PDT mini-toggle price point (that spec shows up on premium 3PDT footswitches, not generic 4PDT toggles) — a standard, well-reviewed 4PDT (Parts Express / Tayda / name-brand over unbranded) is what DIY pedal switchers actually use in practice, and is fine here.

### Shopping list

Amazon and MercadoLibre block automated price scraping, so links below are verified real listings (via search) rather than live prices — check current price/stock by clicking through. Alibaba proper is wholesale-only (100+ unit MOQs on these parts) and not worth it at this quantity; AliExpress is its retail-quantity equivalent.

| Qty | Part | Sourcing options |
|---|---|---|
| 10 | 1/4" (6.35mm) mono TS panel-mount jack, open-frame, 10mm hole (matches `audio_jack_hole_d`) | **Confirmed best pick: [Neutrik NYS229 — smashsoluciones.com.ar](https://smashsoluciones.com.ar/product/conector-jack-ts-hembra-a-chasis-neutrik/)** — pro-audio-grade brand, panel cutout verified at exactly 10mm (matches `audio_jack_hole_d`, no CAD change needed), $2.980 ARS (21 in stock as of checking), local AR retailer so no import/customs risk. Buy 12 (10 + 2 spares). Backups: Amazon [Switchcraft #11 2-pack](https://www.amazon.com/SWITCHCRAFT-11-Female-Panel-Mount/dp/B0CPZCXMK7) · Tayda [6.35mm Mono Chassis Socket](https://www.taydaelectronics.com/6-35mm-1-4-mono-chassis-socket-jack.html) (cheapest, ships internationally) · amazon.es [Adaptout 2-pack](https://www.amazon.es/Conector-Hembra-6-35mm-Bloqueo-Chasis/dp/B084M53YC8) if traveling. |
| 1 | 4PDT mini toggle switch, ON-ON, 12-pin, 6mm bushing (fits `switch_hole_d = 6.5mm` as-is) | Parts Express: [4PDT Mini Toggle Switch](https://www.parts-express.com/4PDT-Mini-Toggle-Switch-060-524) (the DIY-pedal-world standard part) · Tayda: [1M Series 4PDT On-On](https://www.taydaelectronics.com/mini-toggle-switch-1m-series-4pdt-on-on.html) · Amazon: [Parts Express 4PDT](https://www.amazon.com/Parts-Express-4PDT-Toggle-Switch/dp/B001TJ2VHG), [uxcell 12-pin 4PDT](https://www.amazon.com/uxcell-Panel-Position-Toggle-Switch/dp/B00NQCFW5C) · MercadoLibre CO: [5-pack 4PDT](https://www.mercadolibre.com.co/5pcs-red-onon-mini-toggle-switch-12-pin-4pdt-length-35mm/p/MCO2012513616) (spares included) |
| ~1.5m | Shielded mono instrument cable, for internal wiring | Amazon: [Mogami WG2524, sold per foot](https://www.amazon.com/Mogami-WG2524-Instrument-Cable-Black/dp/B00B7LRIEC) (premium, likely overkill for a few short hops) · MercadoLibre AR: [Cable Audio Mono Por Metro](https://electronica.mercadolibre.com.ar/cable-audio-mono-por-metro) · or reuse an offcut of shielded pedal cable if you already have one — 1.5m total across short internal runs doesn't need much. Shielding matters more than usual here since this circuit shares an enclosure with the ESP32/USB-MIDI electronics; keep audio ground separate from digital ground to avoid noise pickup. |
| — | Solder, heat-shrink | For jack/switch terminations. |
| 1 (optional) | Resistive pad or trim pot | Only if MicroFreak's line-level output needs attenuating before TimeLine's input — TBD, see the level-matching check above. |
| 1 (optional) | TL072-based unity-gain buffer | Only if passive output splitting causes audible loading — skip for a first build. |
