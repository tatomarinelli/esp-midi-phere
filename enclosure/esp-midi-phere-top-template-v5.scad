// esp-midi-phere -- FINAL 3D model for the 12-pot/8-button enclosure
// (matches esp-midi-phere-top-template-v5.svg/.pdf exactly -- edit both
// together if either changes). This is the only enclosure design for this
// project; the earlier 6-channel esp-midi-phere-enclosure-vN.scad lineage
// was abandoned and deleted 2026-07-27 in favor of this one.
//
// Box + lid in one file, selected via the `part` variable below. wall=3mm,
// enclosure_depth=30mm is the OUTER extrusion height of the box walls -- the
// panel sits ON TOP as the lid, so overall stack height is
// enclosure_depth + plate_t = 33mm, not 30mm. Say so if 30mm was meant as
// the total.
//
// v5 change: button pitch within each 4-button group tightened from 20mm to
// 15.24mm (6 x 2.54mm, lands on standard perfboard grid) -- driven by the
// user's real perfboard being only 70mm long, which a 20mm pitch didn't fit
// (needed ~72-74mm for 4 switches + pin footprint). Both button groups were
// re-centered around the panel's horizontal middle as a result (group
// window spans x=16.78-75.0 and x=105.0-163.22, was x=6.75-79.25 and
// x=100.75-173.25 in v4).
//
// This shrink incidentally solved a v4 problem: M3/M4 (the two bottom lid
// posts) used to have to dodge the B1/B8 button windows by sitting at
// y=22 instead of the literal corner. With B1/B8 now further from the
// corner (window starts at x=16.78, was x=6.75), the literal 7mm-inset
// corner clears B1/B8 with ~7.3mm to spare -- M1-M4 are back to the
// standard 4-corner pattern, no special case.
//
// STILL OPEN, not resolved by this geometry:
//   - S1-S4 (perfboard mounting holes) are now at x=13.9/77.9 (board 1,
//     under B1-B4) and x=102.1/166.1 (board 2, under B5-B8) -- hand-drill
//     these into the 70x30mm perfboard yourself; they don't rely on
//     whatever corner holes the board ships with. Board footprint (70mm
//     centered on each button group) clears the M3/M4 corner posts by
//     ~1.4mm -- workable but not generous, double-check before drilling.
//   - The perfboard is 30mm tall; the button row's fixed Y position (from
//     the already-finalized panel) means the board occupies roughly
//     y=3-33, which overlaps L7's status-LED-strip footprint (y=27.9-38.1)
//     in X/Y. Whether they actually collide depends on Z-depth (how far
//     back each is mounted behind the panel) -- not decided yet, so not
//     modeled. Plan the LED strip's standoff depth vs. the button board's
//     before finalizing either mount.
//   - Any wall cutout (USB-C, audio jacks, power) -- this layout hasn't had
//     its ESP32/wiring placement decided yet.

part = "preview"; // "shell" | "panel" | "preview" (both, panel ghosted)

panel_w   = 180;
panel_h   = 130;
plate_t   = 3;      // panel thickness, not yet confirmed
corner_r  = 4;

wall             = 3;
enclosure_depth  = 30;   // outer wall height; panel sits on top (see header)

pot_hole_d   = 7.5;
led_w        = 51.1;
led_h        = 10.2;
led_r        = 1.5;
btn_w        = 12.5;   // B3F-4055 12x12mm cap window, 0.5mm/side clearance
btn_r        = 1.2;
screw_d      = 3.2;

mount_boss_d   = 5;     // M2.5-ish corner post, matches enclosure-v4.scad
mount_pilot_d  = 2.2;
// M1-M4 corner mounting posts, in panel-local (y-up) coords -- standard
// 7mm-from-both-edges inset, all 4 literal corners (see v5 header note).
mount_posts = [
  [7, 123], [panel_w - 7, 123],   // M1 top-left, M2 top-right
  [7, 7],   [panel_w - 7, 7]      // M3 bottom-left, M4 bottom-right
];

// pot centers (P1-P12), in SVG crosshair coordinates (y grows downward from
// the top edge; converted to OpenSCAD's y-up via to_scad() below, same as
// every other element on this panel).
pot_centers_svg = [
  [23.775, 37.0], [49.325, 37.0], [82.225, 37.0], [107.775, 37.0], [140.675, 37.0], [166.225, 37.0],
  [23.775, 79.0], [49.325, 79.0], [82.225, 79.0], [107.775, 79.0], [140.675, 79.0], [166.225, 79.0]
];

// LED bar windows L1-L6 (top-left corner in SVG coords -> converted below)
led_origins_svg = [
  [11.000, 17.050], [69.450, 17.050], [127.900, 17.050],
  [11.000, 59.050], [69.450, 59.050], [127.900, 59.050]
];

// L7 status bar, re-centered alone (v3)
led7_origin_svg = [69.450, 96.900];

// B1-B8 button windows, top-left corner in SVG coords -- 15.24mm pitch
// within each group of 4 (v5, was 20mm), both groups re-centered on the
// panel (see v5 header note).
btn_origins_svg = [
  [21.780, 117.750], [37.020, 117.750], [52.260, 117.750], [67.500, 117.750],
  [110.000, 117.750], [125.240, 117.750], [140.480, 117.750], [155.720, 117.750]
];

// S1-S4 perfboard mounting holes, centers in SVG coords -- flank each
// 70x30mm perfboard (board 1 under B1-B4, board 2 under B5-B8), hand-drill
// into the board yourself rather than relying on its stock corner holes.
screw_centers_svg = [
  [18.900, 124.000], [82.900, 124.000], [107.100, 124.000], [171.100, 124.000]
];

// SVG coordinates above are absolute page coordinates (the panel rect sits
// at x=5,y=5 on the page, per the v5 SVG). Subtract that 5mm margin, then
// flip y (SVG grows down, OpenSCAD needs y-up) to land in panel-local space.
page_margin = 5;
function to_scad(p) = [p[0] - page_margin, panel_h - (p[1] - page_margin)];

module pot_hole() {
  cylinder(h = plate_t * 3, d = pot_hole_d, center = true, $fn = 48);
}

module led_window(origin_svg, w, h) {
  p = to_scad(origin_svg);
  translate([p[0], p[1] - h, -plate_t])
    cube([w, h, plate_t * 3]);
}

module btn_window(origin_svg) {
  p = to_scad(origin_svg);
  translate([p[0], p[1] - btn_w, -plate_t])
    linear_extrude(height = plate_t * 3)
      offset(r = btn_r)
        offset(delta = -btn_r)
          square([btn_w, btn_w]);
}

module screw_hole(center_svg) {
  p = to_scad(center_svg);
  translate([p[0], p[1], 0])
    cylinder(h = plate_t * 3, d = screw_d, center = true, $fn = 24);
}

module mount_pilot_hole() {
  cylinder(h = plate_t * 3, d = mount_pilot_d + 1, center = true, $fn = 24);
}

module panel() {
  difference() {
    linear_extrude(height = plate_t)
      offset(r = corner_r)
        offset(delta = -corner_r)
          square([panel_w, panel_h]);

    for (c = pot_centers_svg) {
      p = to_scad(c);
      translate([p[0], p[1], plate_t/2]) pot_hole();
    }

    for (o = led_origins_svg) led_window(o, led_w, led_h);
    led_window(led7_origin_svg, led_w, led_h);

    for (o = btn_origins_svg) btn_window(o);

    for (c = screw_centers_svg) screw_hole(c);

    for (m = mount_posts)
      translate([m[0], m[1], plate_t/2]) mount_pilot_hole();
  }
}

/* ============================================================
   BOX
   ============================================================ */

module mount_boss_solid(h) {
  for (m = mount_posts)
    translate([m[0], m[1], 0])
      cylinder(h = h, d = mount_boss_d, $fn = 32);
}

module mount_pilot_holes(h) {
  for (m = mount_posts)
    translate([m[0], m[1], -1])
      cylinder(h = h + 2, d = mount_pilot_d, $fn = 24);
}

module shell() {
  difference() {
    union() {
      difference() {
        linear_extrude(height = enclosure_depth)
          offset(r = corner_r)
            offset(delta = -corner_r)
              square([panel_w, panel_h]);
        translate([wall, wall, wall])
          linear_extrude(height = enclosure_depth)
            offset(r = corner_r - wall)
              offset(delta = -(corner_r - wall))
                square([panel_w - 2*wall, panel_h - 2*wall]);
      }
      mount_boss_solid(enclosure_depth);
    }
    mount_pilot_holes(enclosure_depth);
  }
}

/* ============================================================
   OUTPUT
   ============================================================ */

if (part == "shell") {
  color([0.75, 0.76, 0.78, 1]) shell();
} else if (part == "panel") {
  color([0.75, 0.76, 0.78, 1]) panel();
} else { // "preview"
  color([0.75, 0.76, 0.78, 1]) shell();
  translate([0, 0, enclosure_depth])
    color([0.8, 0.8, 0.85, 0.55])
      panel();
}
