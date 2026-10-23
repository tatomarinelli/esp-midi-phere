// esp-midi-phere -- v7 3D model for the 12-pot/8-button enclosure
// (matches esp-midi-phere-top-template-v7.svg/.pdf exactly -- edit both
// together if either changes). Supersedes v6.
//
// Box + lid in one file, selected via the `part` variable below. wall=3mm,
// enclosure_depth=30mm is the OUTER extrusion height of the box walls -- the
// panel sits ON TOP as the lid, so overall stack height is
// enclosure_depth + plate_t = 33mm, not 30mm.
//
// v7 change: v6 was built on a mistaken premise -- the user thought the
// panel had 3 rows of LED-bar+pot blocks and re-measured against that,
// which is why v6 blew the panel out to 201x180mm. There are actually only
// 2 rows (v5 had it right). v7 is v5's layout unchanged except:
//   - panel_w: 180 -> 200mm
//   - horizontal gap between adjacent LED bars in the same row: 7.35 ->
//     10mm (was the only real ask). led_w (51.1mm), block height (23.7mm),
//     panel_h (130mm), and everything vertical is untouched from v5.
// The extra 20mm of width all goes into the left/right margins and the
// pot-pair horizontal spread (each LED bar's pot pair re-centered under its
// now-more-spread-out bar) plus the button groups being re-centered with
// wider side margins -- same proportional layout as v5, just wider.
//
// v6 (201x180mm, led_w=60) is now superseded/abandoned -- do not resurrect
// its numbers, they were based on the wrong row count.
//
// STILL OPEN, not resolved by this geometry (carried over from v5/v6):
//   - S1-S4 (perfboard mounting holes) are hand-drilled into the 70x30mm
//     perfboard yourself, positioned 3mm outside the outermost button's
//     edge in X (same margin v5 used), y=11 (panel-local), clear of both
//     the button windows and the corner mount posts.
//   - The perfboard's vertical (Y) extent likely overlaps L7's (status LED
//     strip) footprint in X/Y when both are projected onto the panel plane.
//     Whether they physically collide depends on Z-depth (how far back
//     behind the panel each is mounted) -- not decided, not modeled.
//   - Any wall cutout (USB-C, audio jacks, power) -- still not decided.

part = "preview"; // "shell" | "panel" | "preview" (both, panel ghosted)

panel_w   = 200;
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

mount_boss_d   = 5;     // M2.5-ish corner post
mount_pilot_d  = 2.2;
// M1-M4 corner mounting posts, in panel-local (y-up) coords -- standard
// 7mm-from-both-edges inset, all 4 literal corners.
mount_posts = [
  [7, panel_h - 7], [panel_w - 7, panel_h - 7],   // M1 top-left, M2 top-right
  [7, 7],           [panel_w - 7, 7]              // M3 bottom-left, M4 bottom-right
];

// pot centers (P1-P12), in SVG crosshair coordinates (y grows downward from
// the top edge; converted to OpenSCAD's y-up via to_scad() below). Y values
// unchanged from v5 (37/79) -- only X re-centered for the 200mm-wide panel
// and the wider (10mm) LED-bar gap.
pot_centers_svg = [
  [31.125, 37.0], [56.675, 37.0], [92.225, 37.0], [117.775, 37.0], [153.325, 37.0], [178.875, 37.0],
  [31.125, 79.0], [56.675, 79.0], [92.225, 79.0], [117.775, 79.0], [153.325, 79.0], [178.875, 79.0]
];

// LED bar windows L1-L6 (top-left corner in SVG coords -> converted below).
// Y unchanged from v5 (17.05/59.05); X re-centered so adjacent bars in a
// row sit exactly 10mm apart (was 7.35mm in v5).
led_origins_svg = [
  [18.35, 17.050], [79.45, 17.050], [140.55, 17.050],
  [18.35, 59.050], [79.45, 59.050], [140.55, 59.050]
];

// L7 status bar, centered alone (unchanged Y from v5, X re-centered on the
// new panel width -- happens to land exactly under L2/L5's left edge).
led7_origin_svg = [79.45, 96.900];

// B1-B8 button windows, top-left corner in SVG coords -- 15.24mm pitch
// within each group of 4 (unchanged from v5), both groups re-centered with
// wider side margins for the 200mm panel, same 30mm center gap as v5.
btn_origins_svg = [
  [31.78, 117.750], [47.02, 117.750], [62.26, 117.750], [77.50, 117.750],
  [120.00, 117.750], [135.24, 117.750], [150.48, 117.750], [165.72, 117.750]
];

// S1-S4 perfboard mounting holes, centers in SVG coords -- flank each
// 70x30mm perfboard (board 1 under B1-B4, board 2 under B5-B8), hand-drill
// into the board yourself. Re-centered for the new button group positions,
// same 3mm-outside-the-outermost-button offset v5 used.
screw_centers_svg = [
  [28.89, 124.000], [92.89, 124.000], [117.11, 124.000], [181.11, 124.000]
];

// SVG coordinates above are absolute page coordinates (the panel rect sits
// at x=5,y=5 on the page). Subtract that 5mm margin, then flip y (SVG grows
// down, OpenSCAD needs y-up) to land in panel-local space.
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
