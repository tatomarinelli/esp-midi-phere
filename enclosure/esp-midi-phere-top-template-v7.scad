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
//
// SHELL ADDITIONS (2026-10-23; the panel is untouched, so the .svg/.pdf stay valid):
//   - Protoboard socket for the ESP32-S3-Zero + HW-178 board: 4 standoffs with
//     screw pilots plus L-shaped corner lips. The board is NOT against the wall.
//   - USB-C panel-mount extender on the top wall, in line with the ESP's port:
//     rectangular cutout, 2 M3 holes with nut traps, and a guide with two
//     cradles so the cable/plug stays aligned up to the board.
//   - Cable cradles ("peines"): U-notched plates on the floor that hold the
//     wire bundles at the height the 3D wiring view (gui/wiring.js) routes them.
//   Every number in the "shell additions" block mirrors gui/wiring.js; keep both in sync.
//   - Measure the real protoboard and the real USB-C extender (hole spacing, body
//     size) and edit proto_* / ext_* below before printing.

// ---- shell additions: parameters (view coords: x as the panel, z_view = distance
// from the panel's top edge, y_view = depth, 0 at the panel front, -3 at its back)
proto_w = 48;  proto_d = 62;           // protoboard size -- measure yours
proto_x0 = 132; proto_z0 = 26;         // its top-left corner (x, z_view)
standoff_h = 2.5;  standoff_d = 5;  standoff_inset = 3;
lip_len = 9;  lip_t = 1.8;  lip_clear = 0.4;

ext_x = 45;                            // USB-C extender centre on the top wall (its body is 35 mm deep, so it goes far from the board)
plug_x = 153;                          // x of the ESP's USB-C port, where the cable's plug ends up
ext_y = -24.5;                         // height of the extender's connector (y_view): low, under the wires hanging from the lid
plug_y = -20.7;                        // height of the ESP's port, where the right-angle plug ends up
ext_body_w = 14;  ext_body_h = 9;  ext_body_d = 35;   // body behind the flange (flange is 25 mm wide) -- measure the cross-section
// YINGAYOU USB-C panel extender: it already brings its own screw holes, so nothing is added for them. It sits right at the
// edge of the top wall with its flange outside (connector and screws exposed); only the opening for its body is cut.
ext_hole_spacing = 20;                 // (kept for reference: flange 25 mm wide)
ext_cut_w = 12.6;  ext_cut_h = 6.8;    // opening for the connector body behind the flange -- measure the cross-section

// rails on the back of the lid: open channels with ribs, for thin wires glued against the panel.
// Channel interiors [x0, z0, x1, z1] in view coords (z from the top edge); mirrors gui/wiring.js.
rib_t = 1.0;
lid_channels = [
  [9.9, 4.2, 133.2, 11.0],  [9.9, 4.2, 13.2, 22.0],
  [127.4, 4.2, 133.2, 34.2], [127.4, 34.2, 140.0, 40.2], [127.4, 40.2, 145.2, 43.6],
  [161.2, 28.4, 163.6, 51.6],
  [9.9, 44.0, 191.3, 51.6],  [187.5, 12.5, 191.3, 51.6],  [9.9, 44.0, 13.2, 63.5],
  [65.5, 44.0, 72.9, 101.0],
  [36.0, 84.0, 126.5, 88.2, 2],   // button wires, north of L7: 4 lanes with the wires stacked in pairs (a 5th entry of 2 = two layers)
  [126.5, 84.0, 172.0, 88.2, 2],
  [126.5, 90.8, 180.0, 94.0]      // the GND / 3V3 links of row 2 and the perfboards' GND, where L7 is not there
];

cradle_t = 2.4;

part = "preview"; // "shell" | "panel" | "panel_print" (panel flipped for printing)  | "preview" (both, panel ghosted)

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


// Wire grips hanging from the lid's back face: a pillar with a small closed hole sized to the wires it carries (the wires are
// threaded through; the roof of the hole is a short bridge in print). They hang far enough from the lid to thread the wires. The panel prints
// front-face down, so the pillars grow upward and need no supports. z_scad = y_view + plate_t.
// holes = [[z_view centre, width, y_view centre, height], ...]; small holes, 3 wires or fewer per hole, closed all round.
module lid_eyelets_x(cx, zv0, zv1, holes) {
  zt = min([for (hh = holes) hh[2] - hh[3]/2]) - 1.5 + plate_t;   // free end, 1.5 mm below the lowest hole
  difference() {
    translate([cx - cradle_t/2, panel_h - zv1, zt]) cube([cradle_t, zv1 - zv0, -zt + 0.01]);
    for (hh = holes) translate([cx, panel_h - hh[0], hh[2] + plate_t]) cube([cradle_t*2, hh[1], hh[3]], center = true);
  }
}
module lid_grips() {
  // Each pot row has two grips in the gaps between pots, with 3 holes: the row's 3V3 bus, the pot wipers (all of the row's wipers
  // stacked in one tall hole: they run along the row at the lug line and are stacked at different heights) and the GND bus.
  // Nothing hangs in the gap between L5 and L6 (the LED jumpers are soldered there).
  for (x = [70, 123.6]) lid_eyelets_x(x, 24.5, 39.5, [[27.5, 1.6, -14.8, 1.6], [32, 1.6, -17.4, 4.0], [36.5, 1.6, -14.8, 1.6]]);
  for (x = [61, 130]) lid_eyelets_x(x, 66.5, 81.5, [[69.5, 1.6, -14.8, 1.6], [74, 1.6, -17.4, 4.0], [78.5, 1.6, -14.8, 1.6]]);
  // (the button wires ride the lid corridor north of L7, so they need no hanging grips)
}

// A few closed arches instead of continuous channels (saves plastic and print time). Every arch_pitch mm along each corridor, two
// short legs and a thin strap leave a gap of `wire_room` between the panel and the strap: the wires lie flat against the panel and
// are threaded through. The gap is sized to the wires: wire_od + 0.6 leaves just enough to thread them without letting them dance.
// wire_od = insulated diameter of your wire (0.8 is a start for AWG 30 / 0.25 mm; measure yours). Arches are skipped near junctions.
wire_od = 0.8;  wire_room = wire_od + 0.6;
arch_pitch = 35;  arch_leg = 2.0;  strap_t = 1.0;
function in_rect(c, x, z, m) = x > c[0] - m && x < c[2] + m && z > c[1] - m && z < c[3] + m;
function junction(i, x, z) = len([for (j = [0 : len(lid_channels) - 1]) if (j != i && in_rect(lid_channels[j], x, z, 2.5)) 1]) > 0;
function room(c) = (len(c) > 4 && c[4] == 2) ? 2*wire_od + 0.7 : wire_room;   // two stacked layers need two wires of height
module arch_x(x, c) {   // corridor along x
  h = room(c) + strap_t;
  translate([x - arch_leg/2, panel_h - c[1], -h]) cube([arch_leg, rib_t, h + 0.01]);
  translate([x - arch_leg/2, panel_h - c[3] - rib_t, -h]) cube([arch_leg, rib_t, h + 0.01]);
  translate([x - arch_leg/2, panel_h - c[3] - rib_t, -h]) cube([arch_leg, c[3] - c[1] + 2*rib_t, strap_t]);
}
module arch_z(z, c) {   // corridor along z
  h = room(c) + strap_t;
  translate([c[0] - rib_t, panel_h - z - arch_leg/2, -h]) cube([rib_t, arch_leg, h + 0.01]);
  translate([c[2], panel_h - z - arch_leg/2, -h]) cube([rib_t, arch_leg, h + 0.01]);
  translate([c[0] - rib_t, panel_h - z - arch_leg/2, -h]) cube([c[2] - c[0] + 2*rib_t, arch_leg, strap_t]);
}
module lid_arches() {
  for (i = [0 : len(lid_channels) - 1]) {
    c = lid_channels[i];
    xc = (c[0] + c[2]) / 2;  zc = (c[1] + c[3]) / 2;
    if (c[2] - c[0] >= c[3] - c[1]) {
      for (x = [c[0] + 6 : arch_pitch : c[2] - 4]) if (!junction(i, x, zc)) arch_x(x, c);
    } else {
      for (z = [c[1] + 6 : arch_pitch : c[3] - 4]) if (!junction(i, xc, z)) arch_z(z, c);
    }
  }
}

module panel() {
  union() {
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
  lid_arches();
  lid_grips();
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

// view -> OpenSCAD: z_view (from the top edge, y-down) -> y; y_view (0 = panel front) -> z
function sy(zv) = panel_h - zv;
function sz(yv) = yv + enclosure_depth + plate_t;

// Slot profile (u across, v up, v = 0 at the open top). With lip > 0 the mouth narrows by `lip` per side through a
// 45 degree underside (prints without supports), so thin wires snap in from above and stay put; the mouth flares
// out again to guide them in.
module slot2d(w, d, lip = 0) {
  wt = w/2 - lip;
  polygon([[-w/2, -d], [w/2, -d], [w/2, -1 - lip], [wt, -1], [wt, -0.4], [wt + 0.4, 0.01],
           [-wt - 0.4, 0.01], [-wt, -0.4], [-wt, -1], [-w/2, -1 - lip]]);
}

// Plate across a bundle that runs along X (plate thin in x), with one slot
module cradle_x(cx, zv0, zv1, zc, w, ytop, depth, lip = 0, th = cradle_t) {
  zt = sz(ytop);
  difference() {
    translate([cx - th/2, sy(zv1), wall - 0.01]) cube([th, zv1 - zv0, zt - wall + 0.01]);
    translate([cx, sy(zc), zt]) rotate([90, 0, 90]) linear_extrude(height = th*2, center = true) slot2d(w, depth, lip);
  }
}
// Same for a bundle that runs along Z (plate thin in z), with one slot per entry of xs (comb)
module comb_z(xv0, xv1, xs, zv, w, ytop, depth, lip = 0) {
  zt = sz(ytop);
  difference() {
    translate([xv0, sy(zv) - cradle_t/2, wall - 0.01]) cube([xv1 - xv0, cradle_t, zt - wall + 0.01]);
    for (x = xs) translate([x, sy(zv), zt]) rotate([90, 0, 0]) linear_extrude(height = cradle_t*2, center = true) slot2d(w, depth, lip);
  }
}
module cradle_z(xv0, xv1, xc, zv, w, ytop, depth, lip = 0) { comb_z(xv0, xv1, [xc], zv, w, ytop, depth, lip); }

module corner_lips(cx, cy, sx, sy_, h) {
  xa = cx - sx*lip_len;  xb = cx + sx*(lip_clear + lip_t);
  translate([min(xa, xb), min(cy + sy_*lip_clear, cy + sy_*(lip_clear + lip_t)), wall - 0.01])
    cube([abs(xa - xb), lip_t, h]);
  ya = cy - sy_*lip_len;  yb = cy + sy_*(lip_clear + lip_t);
  translate([min(cx + sx*lip_clear, cx + sx*(lip_clear + lip_t)), min(ya, yb), wall - 0.01])
    cube([lip_t, abs(ya - yb), h]);
}

proto_x1 = proto_x0 + proto_w;
proto_y0 = panel_h - (proto_z0 + proto_d);
proto_y1 = panel_h - proto_z0;
proto_posts = [[proto_x0 + standoff_inset, proto_y0 + standoff_inset], [proto_x1 - standoff_inset, proto_y0 + standoff_inset],
               [proto_x0 + standoff_inset, proto_y1 - standoff_inset], [proto_x1 - standoff_inset, proto_y1 - standoff_inset]];

module shell_extras() {
  // protoboard socket
  for (p = proto_posts) translate([p[0], p[1], wall - 0.01]) cylinder(h = standoff_h + 0.01, d = standoff_d, $fn = 32);
  lip_h = standoff_h + 1.6 + 2.5;
  corner_lips(proto_x0, proto_y0, -1, -1, lip_h);
  corner_lips(proto_x1, proto_y0,  1, -1, lip_h);
  corner_lips(proto_x0, proto_y1, -1,  1, lip_h);
  corner_lips(proto_x1, proto_y1,  1,  1, lip_h);
  // USB-C extender: no pads or screw holes (the connector has its own)
  // the right-angle plug (12 x 6.4 x 20 mm) rests in an open cradle: the ESP's port holds it, so no clip is needed
  cradle_z(plug_x - 10, plug_x + 10, plug_x, 18, 13.5, plug_y - 3.2 + 4, 4);
  // (no guides for the USB cable yet: to be iterated)
  // (no wire grips on the floor: the wires live near the lid so they come with it when it is opened)
}
module shell_cuts() {
  for (p = proto_posts) translate([p[0], p[1], wall + standoff_h - 4]) cylinder(h = 4.01, d = mount_pilot_d, $fn = 24);
  // USB-C extender: opening for the connector body
  translate([ext_x - ext_cut_w/2, panel_h - wall - 1, sz(ext_y) - ext_cut_h/2]) cube([ext_cut_w, wall + 2, ext_cut_h]);
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
      shell_extras();
    }
    mount_pilot_holes(enclosure_depth);
    shell_cuts();
  }
}

/* ============================================================
   OUTPUT
   ============================================================ */

if (part == "shell") {
  color([0.75, 0.76, 0.78, 1]) shell();
} else if (part == "test_lid") {
  // test print 1: the top-left 100 x 45 mm of the real panel (M1 post hole, L1 window, pots 1-2, the top corridor with its arches, the
  // pot-row grip with its 3 holes, the L1 drop). Same orientation as panel_print: front face on the bed.
  translate([0, panel_h, plate_t]) rotate([180, 0, 0]) intersection() {
    panel();
    translate([-1, panel_h - 45, -30]) cube([101, 46, 40]);
  }
} else if (part == "test_holes") {
  // test print 2 (10 min): the three pot hole sizes and the three button window sizes, to see which one your parts fit
  difference() {
    union() { cube([70, 36, plate_t]); }
    for (i = [0 : 2]) translate([12 + i * 20, 10, -1]) cylinder(h = plate_t + 2, d = pot_hole_d - 0.2 + i * 0.2, $fn = 48);   // 7.3 7.5 7.7
    for (i = [0 : 2]) translate([5 + i * 21, 20, -1]) cube([btn_w - 0.2 + i * 0.2, btn_w - 0.2 + i * 0.2, plate_t + 2]);          // 12.3 12.5 12.7
  }
} else if (part == "test_socket") {
  // test print 3: the floor with the protoboard socket (4 standoffs + corner lips); put your board on it
  intersection() {
    shell();
    translate([proto_x0 - 4, panel_h - (proto_z0 + proto_d) - 4, 0]) cube([proto_w + 8, proto_d + 8, 12]);
  }
} else if (part == "test_usbcut") {
  // test print 4: the corner of the top wall with the USB-C extender opening, to try the connector body in it
  intersection() {
    shell();
    translate([ext_x - 20, panel_h - 24, 0]) cube([40, 25, 16]);
  }
} else if (part == "panel_print") {
  // front face on the bed: ribs, lips and grips grow upward (no supports)
  color([0.8, 0.8, 0.85, 1]) translate([0, panel_h, plate_t]) rotate([180, 0, 0]) panel();
} else if (part == "panel") {
  color([0.75, 0.76, 0.78, 1]) panel();
} else { // "preview"
  color([0.75, 0.76, 0.78, 1]) shell();
  translate([0, 0, enclosure_depth])
    color([0.8, 0.8, 0.85, 0.55])
      panel();
}
