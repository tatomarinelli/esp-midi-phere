// TIMESHARE -- standalone enclosure for the analog FX-loop switcher
// (guitar + Arturia MicroFreak sharing one Strymon TimeLine send/return).
// OpenSCAD (openscad.org, free, all platforms). Every dimension below is a
// variable -- correct the ones marked TODO once you've measured real parts,
// then re-render (F5). No install/build step beyond OpenSCAD itself.
//
// This is a DEDICATED box for this circuit only -- it does NOT share the
// esp-midi-phere MIDI controller's enclosure (see esp-midi-phere-enclosure-
// v4.scad, where this same I/O row was previously modeled on that box's rear
// wall). Pulled out into its own file because the two circuits are already
// electrically independent (this one is fully passive, no power supply, no
// connection to the ESP32/USB-MIDI side) -- now they're physically
// independent too. Nothing here references the MIDI controller's geometry.
//
// Contents: 10 jacks + 1 switch, split across three faces instead of one
// long row -- a single-row version of this (all 11 on one wall) works but
// forces a 215mm-long enclosure. The split follows how the box actually
// gets used, not just an even head-count:
//   TOP (lid)        -- SWITCH: the one thing operated by hand mid-session.
//                        Top-mounted instead of on a side wall so it's
//                        reachable/visible without turning the box around --
//                        same reasoning as a stompbox's footswitch living on
//                        the lid while its jacks live on the sides.
//   FRONT (y=0)      -- IN-G, IN-MF: plugged in each session, alongside the
//                        switch you're also reaching for.
//   REAR (y=panel_h) -- SEND-A/B, RETURN-A/B, OUT-GL/GR/MFL/MFR: patch
//                        cables to TimeLine and the interface, set once
//                        and left alone.
// All 10 audio jacks assumed standard 1/4" (6.35mm) panel-mount TS (mono).
// The switch is a 4PDT mini panel-mount toggle, ON-ON, 6mm bushing -- one
// switch is genuinely enough here: a single 4PDT throw already reassigns
// all 4 signal paths at once (see the pole table in the TIMESHARE spec
// sheet), there's no scenario in this design that needs a second one.
//
// Geometry follows the same primitives the esp-midi-phere enclosures already
// validated as manifold (cylinder-through-wall for round holes, offset+
// linear_extrude for the rounded-rect shell) -- same approach, new box.
//
// Verified: not yet rendered/exported (new file). Run a normal manifold/
// export check (F6 render, then Edit > check for errors; export STL; before
// printing, slice-preview for any red/non-manifold warnings) before
// fabricating -- this hasn't been done yet.

part = "preview"; // "shell" | "panel" | "preview" (both, panel ghosted)

/* ============================================================
   PARAMETERS
   ============================================================ */

// --- Audio switcher I/O -- TS 1/4" (6.35mm) panel-mount jacks. Same
// confirmed/TODO values as the shared v4 enclosure -- these are properties
// of the jacks/switch themselves, not of which box they're mounted in.
audio_jack_hole_d = 10;   // TODO confirm against your actual jacks (10mm
                           // fits most open-frame panel jacks with clearance
                           // for the mounting nut/washer; some brands want
                           // as little as 9.5mm)
audio_jack_depth  = 20;   // TODO confirm -- typical open-frame 1/4" jack
                           // protrusion behind the panel; must clear
                           // enclosure_depth's internal wiring space
switch_hole_d     = 6.5;  // 4PDT mini panel toggle bushing, TODO confirm
switch_depth      = 20;   // TODO confirm

// --- Enclosure shell -- sized just for this circuit's footprint, not
// inherited from the MIDI controller box.
wall             = 3;
corner_r         = 4;
panel_w          = 160;   // length of each I/O wall (x-axis) -- sized to the
                           // busier rear wall (8 items); the front wall's 3
                           // items fit with room to spare at the same width
panel_h          = 55;    // front-to-back depth. Both walls now carry
                           // protruding jacks pointed at each other, so this
                           // has to clear audio_jack_depth (20mm) from BOTH
                           // sides plus wall thickness, not just one --
                           // 20+20+2*wall+~7mm wiring clearance -- rather
                           // than the 38mm a single-sided row needed
enclosure_depth  = 34;    // box height (z-axis) -- jacks/switch sit at
                           // mid-height (audio_z), 17mm clearance above and
                           // below inside the hollow shell
screw_boss_d     = 5;     // M2.5-ish self-tapper boss, matches esp-midi-
                           // phere's shrunk hardware (v3/v4)
screw_pilot_d    = 2.2;
screw_inset      = 7;     // boss center inset from each corner

/* ============================================================
   LAYOUT
   ============================================================ */

// 14mm pitch within a functional group (10mm hole + 4mm of plastic between
// adjacent jacks -- the shared v4 rear wall used 11mm/1mm here, which read
// fine on paper but rendered as touching, impossible-to-print holes once
// modeled). Groups are separated by a 22mm gap measured from the LAST jack
// of one group to the FIRST jack of the next (not group-start-to-group-
// start -- an earlier draft of this file made that mistake, which silently
// put two holes 4mm into each other despite looking fine as bare numbers).
// margin=18 keeps every hole clear of the corner screw bosses (boss d=5 at
// screw_inset=7 -> boss edge at x=9.5 from the left corner; first jack hole
// at x=18 with d=10 -> hole edge at x=13, ~3.5mm clear -- TODO test-fit
// before committing to a full print).
audio_z          = enclosure_depth / 2;   // mid-wall height on both walls,
                                           // clear of the lid and floor

// FRONT wall (y=0) -- IN-G, IN-MF only now (switch moved to the lid, below)
front_in_x       = [18, 32];              // IN-G, IN-MF

// REAR wall (y=panel_h) -- SEND-A/B, RETURN-A/B, OUT-GL/GR/MFL/MFR
rear_send_x      = [18, 32];              // SEND-A, SEND-B
rear_ret_x       = [54, 68];              // RETURN-A, RETURN-B
rear_out_x       = [90, 104, 118, 132];   // OUT-GL, OUT-GR, OUT-MFL, OUT-MFR

// TOP (lid) -- the switch. Placed toward the front edge, roughly above the
// gap between the two input jacks, so it reads as grouped with them (the
// "things you touch" cluster) rather than floating in the middle of the
// lid. x centered on the box; y=20 keeps it clear of the front wall's jack
// bosses/wiring below while still landing in the front half of the lid.
switch_lid_x     = panel_w / 2;
switch_lid_y     = 20;

/* ============================================================
   CUTOUT PRIMITIVES
   ============================================================ */

// bores a round hole through the y=panel_h (rear) wall at a given x (panel
// plane) and z (height off the floor). Same "cylinder through a wall"
// pattern the shared enclosure already validated as manifold.
module rear_wall_hole(x, z, d) {
  translate([x, panel_h - wall/2, z])
    rotate([90, 0, 0])
      cylinder(h = wall * 3, d = d, center = true, $fn = 32);
}

// same, through the y=0 (front) wall.
module front_wall_hole(x, z, d) {
  translate([x, wall/2, z])
    rotate([90, 0, 0])
      cylinder(h = wall * 3, d = d, center = true, $fn = 32);
}

// vertical hole straight through the lid, same "cylinder through a wall"
// pattern rotated to bore along z instead of y -- same primitive the
// esp-midi-phere front panel already uses for its pot holes.
module lid_hole(x, y, d) {
  translate([x, y, wall/2])
    cylinder(h = wall * 3, d = d, center = true, $fn = 32);
}

/* ============================================================
   LID
   ============================================================ */

// Lid carries the one hand-operated control (the switch) plus screw
// clearance. Everything else in this design lives on the front/rear walls.
// Add text()/engraving here later if you want panel labels modeled.
module lid() {
  difference() {
    linear_extrude(height = wall)
      offset(r = corner_r)
        offset(delta = -corner_r)
          square([panel_w, panel_h]);

    for (p = corner_positions())
      translate([p[0], p[1], wall/2])
        cylinder(h = wall * 3, d = screw_pilot_d + 1, center = true, $fn = 24);

    lid_hole(switch_lid_x, switch_lid_y, switch_hole_d);
  }
}

/* ============================================================
   ENCLOSURE SHELL
   ============================================================ */

function corner_positions() = [
  [screw_inset, screw_inset],
  [panel_w - screw_inset, screw_inset],
  [screw_inset, panel_h - screw_inset],
  [panel_w - screw_inset, panel_h - screw_inset]
];

// solid post only -- no pilot hole yet (drilled separately, see screw_pilot_holes())
module screw_boss_solid(h) {
  for (p = corner_positions())
    translate([p[0], p[1], 0])
      cylinder(h = h, d = screw_boss_d, $fn = 32);
}

module screw_pilot_holes(h) {
  for (p = corner_positions())
    translate([p[0], p[1], -1])
      cylinder(h = h + 2, d = screw_pilot_d, $fn = 24);
}

module shell() {
  difference() {
    union() {
      difference() {
        // outer box
        linear_extrude(height = enclosure_depth)
          offset(r = corner_r)
            offset(delta = -corner_r)
              square([panel_w, panel_h]);
        // hollow interior, leaving the base (wall) and side walls (wall) intact
        translate([wall, wall, wall])
          linear_extrude(height = enclosure_depth)
            offset(r = corner_r - wall)
              offset(delta = -(corner_r - wall))
                square([panel_w - 2*wall, panel_h - 2*wall]);
      }
      // bosses stand solid inside the now-hollow cavity, base to lid height
      screw_boss_solid(enclosure_depth);
    }
    // pilot holes drilled last, through the bosses only
    screw_pilot_holes(enclosure_depth);

    // FRONT wall (y=0) -- 2 mono in, the "every session" side. The switch
    // that used to sit here is now on the lid, see lid().
    for (x = front_in_x)     front_wall_hole(x, audio_z, audio_jack_hole_d);

    // REAR wall (y=panel_h) -- send + stereo return, 4 stereo out, the
    // "patched once" side.
    for (x = rear_send_x)    rear_wall_hole(x, audio_z, audio_jack_hole_d);
    for (x = rear_ret_x)     rear_wall_hole(x, audio_z, audio_jack_hole_d);
    for (x = rear_out_x)     rear_wall_hole(x, audio_z, audio_jack_hole_d);
  }
}

/* ============================================================
   OUTPUT
   ============================================================ */

if (part == "shell") {
  shell();
} else if (part == "panel") {
  lid();
} else { // "preview" -- assembled, lid ghosted so interior is visible
  shell();
  translate([0, 0, enclosure_depth])
    color([0.8, 0.8, 0.85, 0.35])
      lid();
}
