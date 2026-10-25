// Interactive 3D wiring diagram of the v7 box (see enclosure/esp-midi-phere-top-template-v7.scad).
// Axes: x = panel x (mm, left -> right), z = panel y (mm, top edge -> bottom edge), y = depth
// (0 = panel front face, -3 = panel back, -30 = top of the box floor). Everything hangs below the panel.
// Heights and the ESP/mux pin order are approximate; they are meant to show topology and what goes where.
import * as THREE from 'three';
import { OrbitControls } from './assets/vendor/three/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from './assets/vendor/three/CSS2DRenderer.js';
import { STLLoader } from './assets/vendor/three/STLLoader.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PW = 200, PH = 130, PT = 3, DEPTH = 30;

// ---- geometry (panel-local mm = page coords of the .scad minus its 5 mm margin)
const POT_X = [31.125, 56.675, 92.225, 117.775, 153.325, 178.875].map((x) => x - 5);
const POT_Z = [32, 74];
const POTS = POT_Z.flatMap((z) => POT_X.map((x) => [x, z]));
const LED_W = 51.1, LED_H = 10.2;
const LEDS = [13.35, 74.45, 135.55].flatMap((x) => [12.05, 54.05].map((z) => [x, z]))
  .sort((a, b) => a[1] - b[1] || a[0] - b[0]);          // L1..L3 top row, L4..L6 bottom row
const LED7 = [74.45, 91.9];
const BTN_X0 = [31.78, 47.02, 62.26, 77.5, 120, 135.24, 150.48, 165.72].map((x) => x - 5), BTN_Z0 = 112.75, BTN_W = 12.5;
const BOARDS = [{ cx: 55.89 }, { cx: 144.11 }].map((b) => ({ ...b, w: 70, z0: 97, d: 30 }));
const STANDOFFS = [[23.89, 119], [87.89, 119], [112.11, 119], [176.11, 119]];
const POSTS = [[7, 7], [193, 7], [7, 123], [193, 123]];

// protoboard (48 x 62 mm, measure yours) with the ESP32-S3-Zero + HW-178 mux, inset from the top-right corner.
// OX/OZ move the whole board block; the USB-C extender sits on the top wall in line with the ESP's port.
// These numbers mirror shell_extras() in enclosure/esp-midi-phere-top-template-v7.scad.
const OX = -8, OZ = 22;
const PB = { x0: 140 + OX, x1: 188 + OX, z0: 4 + OZ, z1: 66 + OZ, top: -25.9 };
const ESP = { x0: 152 + OX, x1: 170 + OX, z0: 4.5 + OZ, z1: 29 + OZ, y: -22.8 };
const MUX = { x0: 150 + OX, x1: 183 + OX, z0: 38 + OZ, z1: 60 + OZ, y: -22.8 };
const RAIL = { gnd: 142.5 + OX, v33: 145 + OX, v5: 147.5 + OX, y: -25.7 };
const EXT = { x: 45, y: -24.5, spacing: 20, cutW: 12.6, cutH: 6.8, bodyW: 14, bodyH: 9, bodyD: 35 };
const PLUG_Y = -20.7;                                 // height of the ESP's port
const PLUG_X = 153;                                   // x of the ESP's USB-C port (where the extender's plug ends up)
const espL = (k) => V(151.6 + OX, -23.2, 7.6 + OZ + 2.54 * k), espR = (k) => V(170.4 + OX, -23.2, 7.6 + OZ + 2.54 * k);
const espB = (k) => V(157 + OX + 2.5 * k, -23.2, 28.8 + OZ);
const muxCtl = (k) => V(154.5 + OX + 2.54 * k, -23.0, 38.8 + OZ);       // VCC GND SIG S0 S1 S2 S3 EN
const muxC = (n) => V(154.5 + OX + 2.54 * n, -23.0, 59.2 + OZ);
const ESP_LEFT = ['5V', 'GND', '3V3', 'GP13', 'GP12', 'GP11', 'GP10', 'GP9', 'GP8'];
const ESP_RIGHT = ['TX', 'RX', 'GP1', 'GP2', 'GP3', 'GP4', 'GP5', 'GP6', 'GP7'];
const MUX_CTL = ['VCC', 'GND', 'SIG', 'S0', 'S1', 'S2', 'S3', 'EN'];
// pots 1-10 -> GPIO1-10, pots 11-12 -> GPIO12-13 (README / firmware); k = header position on that side
const potPin = (i) => {
  const [side, k] = i < 7 ? ['R', i + 2] : i < 10 ? ['L', 8 - (i - 7)] : i === 10 ? ['L', 4] : ['L', 3];
  return { p: side === 'R' ? espR(k) : espL(k), name: (side === 'R' ? ESP_RIGHT : ESP_LEFT)[k], side, k };
};
// ESP bottom pads GP14-18 -> HW-178 pins (matches tests/buttons_test: S0=14, SIG=15, S1=16, S2=17, S3=18)
const SEL = [[0, 3], [1, 2], [2, 4], [3, 5], [4, 6]];

// rails on the lid's back face: channel interiors [x0, z0, x1, z1] (mirror of lid_channels in the .scad)
const RIB_T = 1.0, ARCH_PITCH = 35, WIRE_OD = 0.8, WIRE_ROOM = WIRE_OD + 0.6, STRAP_T = 1.0;   // gap between panel and strap = wire + 0.6 mm
const LID_CH = [
  [9.9, 4.2, 133.2, 11.0],     // A: along the top wall (LED feed)
  [9.9, 4.2, 13.2, 22.0],      // drop to L1's pads
  [127.4, 4.2, 133.2, 34.2],   // V2: gap between L2 and L3 down toward the board
  [127.4, 34.2, 140.0, 40.2], [127.4, 40.2, 145.2, 43.6],   // link to the board rails
  [161.2, 28.4, 163.6, 51.6],  // D: ESP TX pin -> corridor B
  [9.9, 44.0, 191.3, 51.6],    // B: corridor between pot row 1 and L4-L6
  [187.5, 12.5, 191.3, 51.6],  // right margin, from L3's pads
  [9.9, 44.0, 13.2, 63.5],     // left margin, down to L4's pads
  [65.5, 44.0, 72.9, 101.0],   // V1: gap between L1/L4 and L2/L5, down to L7
  [36.0, 84.0, 126.5, 88.2, 2],   // button wires, north of L7: 4 lanes, wires stacked in pairs (5th entry 2 = two layers)
  [126.5, 84.0, 172.0, 88.2, 2],
  [126.5, 90.8, 180.0, 94.0],     // GND / 3V3 links of row 2 and the perfboards' GND
];

// ---- nets
const NETS = {
  gnd: { name: 'GND', color: '#0b0c0f', layer: 'wgnd' },
  v33: { name: '3V3', color: '#ef4444', layer: 'wv33' },
  v5: { name: '5V (pad 5V del ESP)', color: '#f59e0b', layer: 'wv5' },
  led: { name: 'Datos barras LED (GP11)', color: '#22c55e', layer: 'wled' },
  stat: { name: 'Datos barra de estado (GPIO por definir)', color: '#14b8a6', layer: 'wled' },
  btn: { name: 'Botones → MUX', color: '#a855f7', layer: 'wbtn' },
  sel: { name: 'MUX: selección y SIG', color: '#eab308', layer: 'wbtn' },
};
POTS.forEach((_, i) => { NETS['pot' + i] = { name: `Pot ${i + 1} (cursor) → ${potPin(i).name}`, color: `hsl(${205 + i * 9},85%,58%)`, layer: 'wpot' }; });
const LAYERS = [
  ['panel', 'Panel'], ['shell', 'Caja'], ['support', 'Soportes impresos'], ['rails', 'Rieles de la tapa'], ['leds', 'Barras LED'], ['pots', 'Pots'], ['knobs', 'Perillas'],
  ['btns', 'Botones'], ['board', 'Placa ESP + MUX'], ['usb', 'USB-C extensor'],
  ['wpot', 'Cables: pots'], ['wled', 'Cables: datos LED'], ['wbtn', 'Cables: botones/MUX'], ['wgnd', 'Cables: GND'], ['wv33', 'Cables: 3V3'], ['wv5', 'Cables: 5V'],
  ['labels', 'Etiquetas'], ['print', 'Piezas a imprimir'],
];
const GROUP_NAMES = { leds: 'LEDs', pots: 'Pots', btns: 'Botones', power: 'Alimentación del ESP' };

let ctx = null;

function build(host) {
  host.innerHTML = `<div class="w3d"><div class="w3d-view"><div class="w3d-bar"><div class="w3d-views"></div><div class="w3d-cams"></div></div><div class="w3d-tip" hidden></div></div>
    <aside class="w3d-side"><div class="w3d-pins"></div><h3>Capas</h3><div class="w3d-layers"></div>
    <label class="w3d-op">Transparencia del panel <input type="range" min="0.05" max="1" step="0.05" value="0.3" id="w3dOp"></label>
    <label class="w3d-op">Corte en profundidad <span class="note" id="w3dCutV">sin corte</span><input type="range" min="-30" max="0" step="0.5" value="0" id="w3dCut"></label>
    <h3>Selección</h3><div class="w3d-info"><p class="note">Hacé clic en un cable o un componente para ver a qué se conecta. Clic en vacío para limpiar.</p></div>
    <h3>Notas</h3><ul class="w3d-notes">
      <li>Cada pote: pata izquierda 3V3, derecha GND (sentido por defecto, con <i>Invertir</i> activo), cursor al ESP. Si gira al revés, intercambiá 3V3 y GND de ese pote o cambiá <i>Invertir</i> en la GUI.</li>
      <li>Las barras LED forman una sola cadena de izquierda a derecha, fila 1 y luego fila 2; el cable largo L3→L4 cruza la caja. La barra de estado (L7) toma 5V/GND de L5.</li>
      <li>El orden físico de pines del ESP y del HW-178 está tomado de memoria: verificalo contra tu placa antes de soldar.</li>
      <li>El pin de datos de L7 aún no está definido; se dibuja en GP43 provisoriamente.</li>
      <li>El 1000 µF y la resistencia de 300 Ω van pegados a la entrada de L1.</li>
      <li>La placa va sobre separadores con esquineros, separada de la pared. El extensor USB-C (ficha de 25 mm de ancho y 35 mm de fondo) se monta en la pared superior, a baja altura y lejos de la placa; el sobrante de sus 24 cm de cable queda en un rulo suelto en el piso, recogido por un clip, y el plug en L de 20 mm llega al ESP. Entre la pared y el puerto del ESP hay 22 mm: el plug entra justo. Medí tu placa y tu extensor (separación de agujeros) y ajustá los parámetros <i>proto_*</i> y <i>ext_*</i> del .scad.</li>
      <li>Los rieles de la tapa llevan los cables finos pegados contra el panel por los pasillos libres (alimentación y datos de las barras, puente L3→L4, L7). Cada cable va a su propia altura para que los cruces no se toquen.</li>
      <li>Los cables de los pots y de los botones cuelgan de la tapa en agarres con muesca hacia abajo (se meten a presión en ranuras angostas, también después de soldar), así que todo sale con la tapa. Dejá unos 6–8 cm de sobrante entre el último agarre y la placa para poder abrirla sin desoldar.</li>
      <li>Los soportes impresos (peines con muesca) sujetan los haces de cables a la altura que dibuja este esquema.</li></ul></aside></div>`;
  const view = host.querySelector('.w3d-view'), tip = host.querySelector('.w3d-tip');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2f3541');
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  view.prepend(renderer.domElement);
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'w3d-labels';
  view.prepend(labelRenderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(120, 300, 80); scene.add(sun);
  const under = new THREE.DirectionalLight(0x9db4ff, 0.8); under.position.set(60, -200, 200); scene.add(under);

  const layers = {};
  for (const [id] of LAYERS) { layers[id] = new THREE.Group(); scene.add(layers[id]); }
  const pickables = [], wires = [], labelObjs = [];
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.15, ...o });

  function add(layer, geo, m, pos, ud) {
    const o = new THREE.Mesh(geo, m);
    o.position.copy(pos);
    if (ud) { o.userData = ud; pickables.push(o); }
    layers[layer].add(o);
    return o;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r, h, n = 24) => new THREE.CylinderGeometry(r, r, h, n);
  function label(text, pos, cls = '') {
    const d = document.createElement('div');
    d.className = 'wl ' + cls; d.textContent = text;
    const o = new CSS2DObject(d); o.position.copy(pos);
    o.userData.pin = cls.includes('wl-pin');
    layers.labels.add(o); labelObjs.push(o);
  }

  // ---- wires
  function rounded(pts, r = 1.5) {
    const p = pts.filter((q, i) => i === 0 || q.distanceTo(pts[i - 1]) > 1e-3);
    const out = [p[0]];
    for (let i = 1; i < p.length - 1; i++) {
      const a = p[i - 1], b = p[i], c = p[i + 1];
      const d1 = Math.min(r, a.distanceTo(b) / 2), d2 = Math.min(r, b.distanceTo(c) / 2);
      const s = b.clone().add(a.clone().sub(b).normalize().multiplyScalar(d1));
      const e = b.clone().add(c.clone().sub(b).normalize().multiplyScalar(d2));
      for (let t = 0; t <= 4; t++) {
        const u = t / 4;
        out.push(s.clone().multiplyScalar((1 - u) * (1 - u)).add(b.clone().multiplyScalar(2 * u * (1 - u))).add(e.clone().multiplyScalar(u * u)));
      }
    }
    out.push(p[p.length - 1]);
    return out;
  }
  let grp = 'leds';
  function wire(net, pts, text, radius = 0.42) {
    const dense = rounded(pts);
    const path = new THREE.CurvePath();
    for (let i = 1; i < dense.length; i++) if (dense[i].distanceTo(dense[i - 1]) > 1e-4) path.add(new THREE.LineCurve3(dense[i - 1], dense[i]));
    const segs = Math.min(900, Math.max(12, Math.ceil(path.getLength() / 0.8)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(path, segs, radius, 6, false), mat(NETS[net].color, { roughness: 0.4 }));
    m.userData = { type: 'wire', net, text, group: grp };
    layers[NETS[net].layer].add(m);
    pickables.push(m); wires.push(m);
  }
  // a goes down to lane y, runs along z to zq, along x to b.x, along z to b.z, then to b
  const route = (a, b, y, zq) => [a, V(a.x, y, a.z), V(a.x, y, zq), V(b.x, y, zq), V(b.x, y, b.z), b];
  const arc = (a, b, lift) => [a, V(a.x, a.y - lift, a.z), V(b.x, b.y - lift, b.z), b];
  const rail = (kind, z) => V(RAIL[kind], RAIL.y, z);

  // ---- panel and box
  const panelMat = mat('#cfd3db', { transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  {
    const s = new THREE.Shape(), r = 4;
    s.moveTo(r, 0); s.lineTo(PW - r, 0); s.quadraticCurveTo(PW, 0, PW, r); s.lineTo(PW, PH - r); s.quadraticCurveTo(PW, PH, PW - r, PH);
    s.lineTo(r, PH); s.quadraticCurveTo(0, PH, 0, PH - r); s.lineTo(0, r); s.quadraticCurveTo(0, 0, r, 0);
    const hole = (path) => s.holes.push(path);
    const circle = (x, z, rad) => { const h = new THREE.Path(); h.absarc(x, z, rad, 0, Math.PI * 2, true); hole(h); };
    const rect = (x, z, w, h) => { const p = new THREE.Path(); p.moveTo(x, z); p.lineTo(x, z + h); p.lineTo(x + w, z + h); p.lineTo(x + w, z); p.lineTo(x, z); hole(p); };
    POTS.forEach(([x, z]) => circle(x, z, 3.75));
    [...LEDS, LED7].forEach(([x, z]) => rect(x, z, LED_W, LED_H));
    BTN_X0.forEach((x) => rect(x, BTN_Z0, BTN_W, BTN_W));
    STANDOFFS.forEach(([x, z]) => circle(x, z, 1.6));
    POSTS.forEach(([x, z]) => circle(x, z, 1.6));
    const g = new THREE.ExtrudeGeometry(s, { depth: PT, bevelEnabled: false, curveSegments: 16 });
    g.rotateX(Math.PI / 2);                       // (x, z, t) -> (x, -t, z): front face at y = 0
    const o = new THREE.Mesh(g, panelMat); o.userData = { type: 'part', title: 'Panel (tapa)', desc: '200 × 130 × 3 mm, con las ventanas de las barras LED, los agujeros de los pots y las ventanas de los botones.' };
    layers.panel.add(o); pickables.push(o);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: '#aab2c0', transparent: true, opacity: 0.55 }));
    layers.panel.add(edges);
  }
  const shellMat = mat('#8b94a5', { transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  {
    const wallH = DEPTH - PT, yMid = -PT - wallH / 2, w = 3;
    const wall = (x0, x1, z0, z1, y0 = -DEPTH, y1 = -PT) => add('shell', box(x1 - x0, y1 - y0, z1 - z0), shellMat, V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    add('shell', box(PW, PT, PH), shellMat, V(PW / 2, -DEPTH - PT / 2, PH / 2));   // floor
    wall(0, w, 0, PH); wall(PW - w, PW, 0, PH); wall(w, PW - w, PH - w, PH);
    // top wall (z = 0..3) with the USB-C cutout over the ESP
    const ux0 = EXT.x - EXT.cutW / 2, ux1 = EXT.x + EXT.cutW / 2, uy0 = EXT.y - EXT.cutH / 2, uy1 = EXT.y + EXT.cutH / 2;
    wall(w, ux0, 0, w); wall(ux1, PW - w, 0, w);
    wall(ux0, ux1, 0, w, -DEPTH, uy0); wall(ux0, ux1, 0, w, uy1, -PT);
    POSTS.forEach(([x, z]) => add('shell', cyl(2.5, wallH), shellMat, V(x, yMid, z)));
    label('USB-C', V((ux0 + ux1) / 2, uy1 + 2.5, 0.5), 'wl-dim');
  }

  // ---- printed supports (mirror of shell_extras() in the .scad): protoboard socket, extender pads, cable cradles
  const supMat = mat('#c9a96e', { roughness: 0.75 });
  const sudUd = (title, desc) => ({ type: 'part', title, desc });
  const udRail0 = { type: 'part', title: 'Riel de la tapa', desc: 'Canal abierto con costillas en la cara interna de la tapa, por los pasillos libres entre barras, potes y pared. Los cables finos van dentro y se fijan con pegamento (termofusible o CA) o cinta Kapton.' };
  const sup = (x0, x1, y0, y1, z0, z1, ud) => add('support', box(x1 - x0, y1 - y0, z1 - z0), supMat, V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), ud);
  const FLOOR = -DEPTH - PT + 3;                                                    // top of the floor
  const udPost = sudUd('Separador de la placa', '2,5 mm de alto con piloto para tornillo (M2 o M2.5), uno por esquina de la placa.');
  const udLip = sudUd('Esquinero de la placa', 'Sujeta la placa en X/Y; la placa apoya en los separadores. Se presiona desde arriba.');
  [[PB.x0 + 3, PB.z0 + 3], [PB.x1 - 3, PB.z0 + 3], [PB.x0 + 3, PB.z1 - 3], [PB.x1 - 3, PB.z1 - 3]].forEach(([x, z]) => add('support', cyl(2.5, 2.5), supMat, V(x, FLOOR + 1.25, z), udPost));
  [[PB.x0, PB.z0, -1, -1], [PB.x1, PB.z0, 1, -1], [PB.x0, PB.z1, -1, 1], [PB.x1, PB.z1, 1, 1]].forEach(([cx, cz, sx, sz]) => {
    const L = 9, t = 1.8, c = 0.4, h = 2.5 + 1.6 + 2.5, ord = (a, b) => [Math.min(a, b), Math.max(a, b)];
    const [xa, xb] = ord(cx - sx * L, cx + sx * (c + t)), [za, zb] = ord(cz + sz * c, cz + sz * (c + t));
    sup(xa, xb, FLOOR, FLOOR + h, za, zb, udLip);
    const [xc, xd] = ord(cx + sx * c, cx + sx * (c + t)), [zc, zd] = ord(cz - sz * L, cz + sz * (c + t));
    sup(xc, xd, FLOOR, FLOOR + h, zc, zd, udLip);
  });
  const udCr = sudUd('Peine de cables', 'Placa con muesca en U que sujeta un haz de cables a la altura del esquema. Se apoya en el piso de la caja.');
  const cradleZ = (xv0, xv1, xc, zv, w, ytop, depth) => {      // plate thin in z, bundle runs along z
    sup(xv0, xc - w / 2, FLOOR, ytop, zv - 1.2, zv + 1.2, udCr); sup(xc + w / 2, xv1, FLOOR, ytop, zv - 1.2, zv + 1.2, udCr);
    sup(xc - w / 2, xc + w / 2, FLOOR, ytop - depth, zv - 1.2, zv + 1.2, udCr);
  };
  const yTopUsb = PLUG_Y - 3.5 + 6;
  cradleZ(PLUG_X - 10, PLUG_X + 10, PLUG_X, 18, 13.5, PLUG_Y - 3.2 + 4, 4);              // open cradle under the right-angle plug
  // wire grips hanging from the lid (mirror of lid_grips() in the .scad): wires snap in from below
  const udGrip = sudUd('Aro colgante de la tapa', 'Pilar que cuelga de la tapa con un agujero y una ranura angosta hasta el extremo: el cable se mete a presión con un poco de fuerza (también después de soldar) y queda cerca de la tapa. Se imprime con el panel boca abajo, sin soportes.');
  // plate hanging from the lid with several small closed holes; holes = [[zc, w, yc, h], ...] (mirror of lid_grips() in the .scad)
  const gripX = (cx, zv0, zv1, holes) => {
    const yEnd = Math.min(...holes.map(([, , yc, h]) => yc - h / 2)) - 1.5;
    const cuts = [...new Set([zv0, zv1, ...holes.flatMap(([zc, w]) => [zc - w / 2, zc + w / 2])])].sort((a, b) => a - b);
    for (let k = 0; k + 1 < cuts.length; k++) {
      const a = cuts[k], b = cuts[k + 1], zm = (a + b) / 2;
      let spans = [[yEnd, -PT]];
      holes.forEach(([zc, w, yc, h]) => {
        if (zm > zc - w / 2 && zm < zc + w / 2) spans = spans.flatMap(([lo, hi]) => {
          const hl = yc - h / 2, hh = yc + h / 2;
          if (hh <= lo || hl >= hi) return [[lo, hi]];
          return [[lo, Math.min(hl, hi)], [Math.max(hh, lo), hi]].filter(([x, y]) => y - x > 1e-6);
        });
      });
      spans.forEach(([lo, hi]) => add('rails', box(2.4, hi - lo, b - a), supMat, V(cx, (lo + hi) / 2, zm), udGrip));
    }
  };
  // two grips per pot row, 3 holes each: the row's 3V3 bus, all the row's wipers stacked in one tall hole, the GND bus
  [70, 123.6].forEach((x) => gripX(x, 24.5, 39.5, [[27.5, 1.6, -14.8, 1.6], [32, 1.6, -17.4, 4.0], [36.5, 1.6, -14.8, 1.6]]));
  [61, 130].forEach((x) => gripX(x, 66.5, 81.5, [[69.5, 1.6, -14.8, 1.6], [74, 1.6, -17.4, 4.0], [78.5, 1.6, -14.8, 1.6]]));
  // ---- rails on the back of the lid: open channels with 1 mm ribs, 3 mm tall (mirror of lid_channels in the .scad).
  // Thin wires lie in them against the panel and are fixed with hot glue / CA / Kapton tape.
  // closed arches instead of continuous channels (mirror of lid_arches() in the .scad): two short legs and a thin strap every
  // ARCH_PITCH mm; the gap between the panel and the strap is WIRE_ROOM (wire + 0.6 mm), so wires are threaded without dancing
  const inRect = (c, x, z, m) => x > c[0] - m && x < c[2] + m && z > c[1] - m && z < c[3] + m;
  const junction = (i, x, z) => LID_CH.some((c, j) => j !== i && inRect(c, x, z, 2.5));
  LID_CH.forEach((c, i) => {
    const archH = (c[4] === 2 ? 2 * WIRE_OD + 0.7 : WIRE_ROOM) + STRAP_T;       // two stacked layers need two wires of height
    const xc = (c[0] + c[2]) / 2, zc = (c[1] + c[3]) / 2, y = -PT - archH / 2;
    if (c[2] - c[0] >= c[3] - c[1]) {
      for (let x = c[0] + 6; x <= c[2] - 4 + 1e-6; x += ARCH_PITCH) if (!junction(i, x, zc)) {
        add('rails', box(2, archH, RIB_T), supMat, V(x, y, c[1] - RIB_T / 2), udRail0);
        add('rails', box(2, archH, RIB_T), supMat, V(x, y, c[3] + RIB_T / 2), udRail0);
        add('rails', box(2, STRAP_T, c[3] - c[1] + 2 * RIB_T), supMat, V(x, -PT - archH + STRAP_T / 2, zc), udRail0);
      }
    } else {
      for (let z = c[1] + 6; z <= c[3] - 4 + 1e-6; z += ARCH_PITCH) if (!junction(i, xc, z)) {
        add('rails', box(RIB_T, archH, 2), supMat, V(c[0] - RIB_T / 2, y, z), udRail0);
        add('rails', box(RIB_T, archH, 2), supMat, V(c[2] + RIB_T / 2, y, z), udRail0);
        add('rails', box(c[2] - c[0] + 2 * RIB_T, STRAP_T, 2), supMat, V(xc, -PT - archH + STRAP_T / 2, z), udRail0);
      }
    }
  });

  // ---- USB-C extender: flange outside the wall, female body inside; 30 cm cable wound on the reel; right-angle plug into the ESP
  {
    const ud = sudUd('Extensor USB-C', 'Hembra de panel que trae sus propios agujeros: se deja justo en el borde de la pared superior, con el conector y los tornillos a la vista, cable de 24 cm que queda en un rulo suelto en el piso y plug a 90° en el ESP32-S3-Zero. Medí el tuyo y ajustá ext_* en el .scad.');
    const dark = mat('#1a1d23');
    add('usb', box(25, 11, 2), mat('#9aa3b0', { metalness: 0.7, roughness: 0.4 }), V(EXT.x, EXT.y, -1), ud);                 // flange, outside the wall
    add('usb', box(EXT.bodyW, EXT.bodyH, EXT.bodyD), mat('#2a2f38'), V(EXT.x, EXT.y, 3 + EXT.bodyD / 2), ud);              // body, 35 mm into the box
    add('usb', box(12, 6.4, 20), dark, V(PLUG_X, PLUG_Y, 14.6), ud);                                                         // right-angle plug, 20 mm
    add('usb', box(8.4, 2.6, 2), mat('#c7ccd4', { metalness: 0.7 }), V(PLUG_X, PLUG_Y, 24.6), ud);
    // 24 cm of cable: out of the body, down to the floor, around the reel (280 degrees), then up to the plug's side
    // cable: out of the body, east along z = 41.5, one loose loop (a ring of 17-21 mm radius centred at
    // x = 100, z = 58.5, entered tangentially at its north point), east along z = 37.5, then up to the plug's side
    const yc = FLOOR + 1.9, zEnd = 3 + EXT.bodyD, cx = 100, cz = 58.5;
    const pts = [V(EXT.x, EXT.y, zEnd), V(EXT.x + 3, yc, zEnd + 3), V(50, yc, 41.5), V(54, yc, 41.5), V(70, yc, 41.5), V(84, yc, 41.5)];
    for (let a = 90; a >= -270; a -= 15) {                          // clockwise from the north point; radius grows 17 -> 21 (two strands 4 mm apart)
      const t = (a * Math.PI) / 180, r0 = 17 + 4 * ((90 - a) / 360);
      pts.push(V(cx + r0 * Math.cos(t), yc, cz - r0 * Math.sin(t)));
    }
    pts.push(V(108, yc, 37.5), V(114, yc, 37.5), V(120, yc, 37.5), V(130, yc, 28), V(PLUG_X - 20, yc, 12), V(PLUG_X - 16, yc, 9.5), V(140, yc, 9.5), V(PLUG_X - 8, PLUG_Y - 2, 8), V(PLUG_X - 6, PLUG_Y, 8));
    const path = new THREE.CurvePath();
    const dense = rounded(pts, 4);
    for (let k = 1; k < dense.length; k++) if (dense[k].distanceTo(dense[k - 1]) > 1e-4) path.add(new THREE.LineCurve3(dense[k - 1], dense[k]));
    const cable = new THREE.Mesh(new THREE.TubeGeometry(path, Math.min(900, Math.ceil(path.getLength() / 0.8)), 1.9, 8, false), dark);
    cable.userData = ud; layers.usb.add(cable); pickables.push(cable);
  }

  // ---- LED sticks (8 pixels each, pads for 5V / DIN-DOUT / GND at both ends)
  const stickMat = mat('#16191f'), padMat = mat('#d9b44a', { metalness: 0.8, roughness: 0.3 });
  const PAD_Y = -6.35, PAD_DZ = [-3.2, 0, 3.2];     // 5V, data, GND
  const stickPad = (i, end, k) => {
    const [x, z] = i === 6 ? LED7 : LEDS[i];
    return V(end === 'L' ? x + 1.5 : x + LED_W - 1.5, PAD_Y, z + LED_H / 2 + PAD_DZ[k]);
  };
  const stickName = (i) => (i === 6 ? 'L7 (estado)' : 'L' + (i + 1));
  [...LEDS, LED7].forEach(([x, z], i) => {
    const six = i === 6;
    add('leds', box(LED_W, 1.6, LED_H), stickMat, V(x + LED_W / 2, -5.4, z + LED_H / 2), {
      type: 'part', title: six ? 'Barra de estado L7' : `Barra LED ${i + 1}`,
      desc: six ? 'Tira de 6 píxeles WS2812B/SK6812 cortada de un rollo. Cadena propia.' : `NeoPixel Stick de 8 píxeles = pots ${2 * i + 1} y ${2 * i + 2} (4 píxeles cada uno).`,
      nets: six ? ['stat', 'v5', 'gnd'] : ['led', 'v5', 'gnd'],
    });
    const n = six ? 6 : 8, pitch = 6.35, x0 = x + (LED_W - (n - 1) * pitch) / 2;
    for (let k = 0; k < n; k++) add('leds', box(5, 1.6, 5), mat('#ffd9a0', { emissive: '#ff8c00', emissiveIntensity: 0.9 }), V(x0 + k * pitch, -3.8, z + LED_H / 2));
    for (const end of ['L', 'R']) for (let k = 0; k < 3; k++) add('leds', box(1.8, 0.2, 1.8), padMat, stickPad(i, end, k).setY(PAD_Y + 0.1));
    label(stickName(i), V(x + LED_W / 2, 1.2, z + LED_H / 2), 'wl-led');
  });

  // ---- pots: body behind the panel, 3 lugs (left = 3V3, middle = wiper, right = GND), knob in front
  const metal = mat('#9aa3b0', { metalness: 0.8, roughness: 0.35 });
  const lug = (i, k) => { const [x, z] = POTS[i]; return V(x + (k - 1) * 5, -14, z); };
  POTS.forEach(([x, z], i) => {
    const pin = potPin(i);
    const ud = { type: 'part', title: `Pot ${i + 1}`, desc: `B10K lineal. Cursor al ${pin.name}; patas exteriores a los buses 3V3 y GND de su fila.`, nets: ['pot' + i, 'gnd', 'v33'] };
    add('pots', cyl(8, 8), mat('#2c3340'), V(x, -7, z), ud);
    add('pots', cyl(3.4, 4), metal, V(x, -2, z), ud);
    add('knobs', cyl(6.5, 13), mat('#1a1d23', { roughness: 0.3 }), V(x, 6.5, z), ud);
    add('knobs', box(1.2, 0.3, 4.5), mat('#e8eaef'), V(x, 13.1, z - 2.4));
    for (let k = 0; k < 3; k++) add('pots', box(1, 3, 0.6), metal, V(x + (k - 1) * 5, -12.5, z), ud);
    label(String(i + 1), V(x, 14, z + 9), 'wl-pot');
  });

  // ---- perfboards with the buttons
  const perf = mat('#b08a4a', { roughness: 0.8 });
  const btnLeg = (b, side) => { // side 'sig' = top pair, 'gnd' = bottom pair
    const x = BTN_X0[b] + BTN_W / 2, z = BTN_Z0 + BTN_W / 2;
    return V(x + 5, -13.8, z + (side === 'sig' ? -6 : 6));
  };
  BOARDS.forEach((bd, n) => {
    add('btns', box(bd.w, 1.6, bd.d), perf, V(bd.cx, -11.8, bd.z0 + bd.d / 2), { type: 'part', title: `Perfboard ${n + 1} de botones`, desc: `70 × 30 mm, atornillada a separadores. Botones B${4 * n + 1} a B${4 * n + 4}.`, nets: ['gnd', 'btn'] });
  });
  STANDOFFS.forEach(([x, z]) => add('btns', cyl(2.5, 8), mat('#cfd3db'), V(x, -7, z)));
  BTN_X0.forEach((x0, b) => {
    const cx = x0 + BTN_W / 2, cz = BTN_Z0 + BTN_W / 2;
    const ud = { type: 'part', title: `Botón B${b + 1}`, desc: `Omron B3F-4055 con tapa. Un lado a GND, el otro al canal C${b} del MUX.`, nets: ['gnd', 'btn'] };
    add('btns', box(12, 3.4, 12), mat('#222831'), V(cx, -9.3, cz), ud);
    add('btns', cyl(3.6, 5.5), mat('#e5e7eb', { roughness: 0.4 }), V(cx, -5, cz), ud);
    for (const dx of [-5, 5]) for (const dz of [-6, 6]) add('btns', box(0.9, 1.6, 0.9), metal, V(cx + dx, -13, cz + dz));
    label(`B${b + 1}`, V(cx, 1.2, cz), 'wl-btn');
  });

  // ---- protoboard (ESP32-S3-Zero + HW-178)
  const pbW = PB.x1 - PB.x0, pbD = PB.z1 - PB.z0;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  { const c = cv.getContext('2d'); c.fillStyle = '#2f5d46'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#d9b44a';
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.beginPath(); c.arc(16 + i * 32, 16 + j * 32, 6, 0, 7); c.fill(); c.fillStyle = '#101a15'; c.beginPath(); c.arc(16 + i * 32, 16 + j * 32, 2.6, 0, 7); c.fill(); c.fillStyle = '#d9b44a'; } }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(pbW / 20.32, pbD / 20.32); tex.colorSpace = THREE.SRGBColorSpace;
  const pbBottom = PB.top - 1.6;
  add('board', box(pbW, 1.6, pbD), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), V((PB.x0 + PB.x1) / 2, PB.top - 0.8, (PB.z0 + PB.z1) / 2),
    { type: 'part', title: 'Placa de montaje (protoboard soldable)', desc: 'Lleva el ESP32-S3-Zero, el HW-178 y los rieles GND / 3V3 / 5V. Va sobre separadores con esquineros, separada de la pared para dejar sitio al extensor USB-C.', nets: ['gnd', 'v33', 'v5'] });
  [[PB.x0 + 3, PB.z0 + 3], [PB.x1 - 3, PB.z0 + 3], [PB.x0 + 3, PB.z1 - 3], [PB.x1 - 3, PB.z1 - 3]].forEach(([x, z]) => add('board', cyl(2.2, 2.4 + 2.6), mat('#cfd3db'), V(x, pbBottom - 1.2 - 0.1, z)));
  [['gnd', '#16181d', 'GND'], ['v33', '#ef4444', '3V3'], ['v5', '#f59e0b', '5V']].forEach(([k, c, t]) => {
    add('board', box(1.6, 0.2, 59), mat(c, { emissive: c, emissiveIntensity: k === 'gnd' ? 0 : 0.25 }), V(RAIL[k], PB.top + 0.1, 56.5), { type: 'part', title: `Riel ${t}`, desc: 'Tira de la placa a la que se sueldan todas las conexiones de esa red.', nets: [k] });
    label(t, V(RAIL[k], PB.top + 1, 4.2 + OZ), 'wl-dim');
  });
  // ESP
  {
    const cx = (ESP.x0 + ESP.x1) / 2, ud = { type: 'part', title: 'ESP32-S3-Zero', desc: 'Waveshare, con el USB-C hacia la pared superior, en línea con el extensor. Lee los 12 pots (ADC), manda los datos a las barras LED y selecciona el canal del MUX.', nets: ['led', 'sel', 'v5', 'v33', 'gnd'] };
    add('board', box(ESP.x1 - ESP.x0, 1.2, ESP.z1 - ESP.z0), mat('#171c26'), V(cx, ESP.y, (ESP.z0 + ESP.z1) / 2), ud);
    add('board', box(9, 3.2, 7.5), metal, V(cx, ESP.y + 2.1, ESP.z0 - 0.6), ud);
    add('board', box(11, 1.4, 11), mat('#c7ccd4', { metalness: 0.7 }), V(cx, ESP.y + 1.3, 17 + OZ), ud);
    for (let k = 0; k < 9; k++) {
      add('board', box(1.5, 0.3, 1.5), padMat, espL(k).setY(-23.3).setX(152.6 + OX));
      add('board', box(1.5, 0.3, 1.5), padMat, espR(k).setY(-23.3).setX(169.4 + OX));
      label(ESP_LEFT[k], espL(k).clone().setX(148.5 + OX).setY(-21), 'wl-pin wl-r');
      label(ESP_RIGHT[k], espR(k).clone().setX(173.5 + OX).setY(-21), 'wl-pin');
    }
    for (let k = 0; k < 5; k++) {
      add('board', box(1.5, 0.3, 1.5), padMat, espB(k).setY(-23.3).setZ(28.2 + OZ));
      label('GP' + (14 + k), espB(k).clone().setY(-21).setZ(31 + OZ), 'wl-pin');
    }
  }
  // HW-178
  {
    const cx = (MUX.x0 + MUX.x1) / 2, ud = { type: 'part', title: 'MUX HW-178 (CD74HC4067)', desc: '16 canales analógicos; se usan C0 a C7 para los botones B1 a B8. S0 a S3 eligen el canal y SIG vuelve al ESP.', nets: ['btn', 'sel', 'v33', 'gnd'] };
    add('board', box(MUX.x1 - MUX.x0, 1.2, MUX.z1 - MUX.z0), mat('#7a1f24'), V(cx, MUX.y, (MUX.z0 + MUX.z1) / 2), ud);
    add('board', box(15.4, 2, 7.5), mat('#101216'), V(cx + 4, MUX.y + 1.5, 49 + OZ), ud);
    for (let k = 0; k < 8; k++) {
      add('board', box(1.5, 0.3, 1.5), padMat, muxCtl(k).setY(-23.3));
      label(MUX_CTL[k], muxCtl(k).clone().setY(-21).setZ(36.2 + OZ), 'wl-pin');
      add('board', box(1.5, 0.3, 1.5), padMat, muxC(k).setY(-23.3));
      label('C' + k, muxC(k).clone().setY(-21).setZ(61.8 + OZ), 'wl-pin');
    }
  }
  // 300 ohm + 1000 uF at the entry of L1
  const r1 = V(100, -4.5, 7.7);
  add('leds', cyl(1.2, 6.3), mat('#c8a566'), r1, { type: 'part', title: 'R 300 Ω (en serie con el dato)', desc: 'Protege el primer píxel de L1. En serie con la línea de datos GP11, dentro del riel superior.', nets: ['led'] }).rotation.z = Math.PI / 2;
  add('leds', cyl(4.5, 16), mat('#1f3a8a'), V(8.5, -8, 34), { type: 'part', title: 'Capacitor 1000 µF / 10 V', desc: 'Entre 5V y GND, soldado en la entrada de L1. Absorbe el pico de encendido. Respetar la polaridad.', nets: ['v5', 'gnd'] }).rotation.x = Math.PI / 2;

  // ---- wiring ----------------------------------------------------------------
  grp = 'leds';
  // LED chain: feed from the board to L1 through the lid rails, jumpers inside each row, long jumper L3 -> L4
  const LVL = { v5: -3.5, led: -3.5, gnd: -3.5 };       // wires lie flat against the panel inside the rails (crossings overlap in this drawing; in the box they stack)
  const COL_L = { v5: 12.7, led: 11.7, gnd: 10.5 }, COL_R = { v5: 188.2, led: 189.4, gnd: 190.6 };
  const FEED_X = { v5: 131.4, led: 129.8, gnd: 128.2 }, FEED_Z = { v5: 5.9, led: 7.7, gnd: 9.5 };
  const BRIDGE_Z = { v5: 45.4, led: 47.0, gnd: 48.6 }, V1_X = { v5: 67.0, led: 69.2, gnd: 71.4 };
  const PADK = { v5: 0, led: 1, gnd: 2 };
  const intoPad = (colX, y, pad) => [V(colX, y, pad.z), V(colX, -7, pad.z), V(pad.x, -7, pad.z), pad];
  [['v5', 'Riel 5V → L1 5V', rail('v5', 14 + OZ)], ['led', 'GP11 → 300 Ω → L1 DIN', espL(5)], ['gnd', 'Riel GND → L1 GND', rail('gnd', 17.2 + OZ)]].forEach(([k, text, s0]) => {
    const y = LVL[k], pad = stickPad(0, 'L', PADK[k]);
    wire(k, [s0, V(s0.x, y, s0.z), V(FEED_X[k], y, s0.z), V(FEED_X[k], y, FEED_Z[k]), V(COL_L[k], y, FEED_Z[k]), ...intoPad(COL_L[k], y, pad)], text);
  });
  for (const [from, to] of [[0, 1], [1, 2], [3, 4], [4, 5]]) {
    [['v5', 0, '5V'], ['led', 1, 'DOUT → DIN'], ['gnd', 2, 'GND']].forEach(([net, k, nm]) =>
      wire(net, arc(stickPad(from, 'R', k), stickPad(to, 'L', k), 1.8 + k * 0.7), `${stickName(from)} → ${stickName(to)} ${nm}`));
  }
  ['v5', 'led', 'gnd'].forEach((k) => {
    const y = LVL[k], a = stickPad(2, 'R', PADK[k]), b = stickPad(3, 'L', PADK[k]);
    wire(k, [a, V(a.x, -7, a.z), V(COL_R[k], -7, a.z), V(COL_R[k], y, a.z), V(COL_R[k], y, BRIDGE_Z[k]), V(COL_L[k], y, BRIDGE_Z[k]), ...intoPad(COL_L[k], y, b)], `L3 → L4 ${k === 'led' ? 'DOUT → DIN' : k === 'v5' ? '5V' : 'GND'} (por el riel de la tapa)`);
  });
  // status bar L7: 5V/GND tapped from L5, data from the ESP (provisional GP43); both run down the gap between L1/L4 and L2/L5
  [['v5', 0], ['gnd', 2]].forEach(([k, idx]) => {
    const y = LVL[k], a = stickPad(4, 'L', idx), b = stickPad(6, 'L', idx);
    wire(k, [a, V(a.x, -7, a.z), V(V1_X[k], -7, a.z), V(V1_X[k], y, a.z), V(V1_X[k], y, b.z), V(V1_X[k], -7, b.z), V(b.x, -7, b.z), b], `L5 → L7 ${k === 'v5' ? '5V' : 'GND'}`);
  });
  {
    const a = espR(0), b = stickPad(6, 'L', 1), y = LVL.led;
    wire('stat', [a, V(a.x, y, a.z), V(a.x, y, 50.4), V(V1_X.led, y, 50.4), V(V1_X.led, y, b.z), V(V1_X.led, -7, b.z), V(b.x, -7, b.z), b], 'GP43 (provisorio) → L7 DIN');
  }

  grp = 'pots';
  // pots: wipers to the ESP, 3V3 / GND buses per row (3 wires per guide hole: same z, stacked 0.95 mm apart)
  // Wipers run along the pot row (at the lug line, z = 32 or 74) at heights -16 .. -18.75, west pots lowest so a wire never crosses the
  // drop of a pot it passes; then along an exit column to the ESP pin. They pass through the pot-row grips (no grip in the L5/L6 gap).
  const WY = [-18.75, -18.2, -17.65, -17.1, -16.55, -16.0, -18.75, -18.2, -17.65, -17.1, -16.0, -16.55];   // by pot index
  POTS.forEach(([x, z], i) => {
    const a = lug(i, 1), pin = potPin(i), y = WY[i], xe = pin.side === 'R' ? 164.2 + 0.55 * i : 140.6 + 0.5 * (i - 7);
    wire('pot' + i, [a, V(a.x, y, a.z), V(xe, y, a.z), V(xe, y, pin.p.z), V(pin.p.x, y, pin.p.z), pin.p], `Pot ${i + 1} cursor → ${pin.name} (${pin.side === 'R' ? 'der' : 'izq'})`, 0.4);
  });

  [[0, 27.5, 36.5], [1, 69.5, 78.5]].forEach(([row, zV, zG]) => {
    const z = POT_Z[row];
    const bus = (net, k, zb, text) => {
      wire(net, POT_X.map((x) => V(x + (k - 1) * 5, -14.8, zb)), text, 0.5);
      POT_X.forEach((x, n) => wire(net, [V(x + (k - 1) * 5, -14, z), V(x + (k - 1) * 5, -14.8, zb)], `Pot ${row * 6 + n + 1} → ${text}`, 0.4));
    };
    bus('v33', 0, zV, `Bus 3V3 fila ${row + 1}`);
    bus('gnd', 2, zG, `Bus GND fila ${row + 1}`);
  });
  // row buses to the rails (row 1 drops straight down at the bus height; row 2 goes around)
  wire('v33', [V(RAIL.v33, -14.8, 27.5), rail('v33', 27.5)], 'Bus 3V3 fila 1 → riel 3V3', 0.5);
  wire('gnd', [V(RAIL.gnd, -14.8, 36.5), rail('gnd', 36.5)], 'Bus GND fila 1 → riel GND', 0.5);
  // row 2's links climb to the lid corridor north of L7 (x >= 126.5, where it is wider) and come back down to the rails
  wire('v33', [V(POT_X[5] - 5, -14.8, 69.5), V(POT_X[5] - 5, -15.7, 69.5), V(POT_X[5] - 5, -15.7, 92.4), V(POT_X[5] - 5, -3.5, 92.4), V(RAIL.v33, -3.5, 92.4), V(RAIL.v33, -16.6, 92.4), V(RAIL.v33, -16.6, 52 + OZ), rail('v33', 52 + OZ)], 'Bus 3V3 fila 2 → riel 3V3 (por el pasillo de la tapa)', 0.5);
  wire('gnd', [V(POT_X[5] + 5, -14.8, 78.5), V(POT_X[5] + 5, -15.4, 78.5), V(POT_X[5] + 5, -15.4, 93.4), V(POT_X[5] + 5, -3.5, 93.4), V(RAIL.gnd, -3.5, 93.4), V(RAIL.gnd, -18.2, 93.4), V(RAIL.gnd, -18.2, 50 + OZ), rail('gnd', 50 + OZ)], 'Bus GND fila 2 → riel GND (por el pasillo de la tapa)', 0.5);
  grp = 'power';
  // ESP power pins to the rails
  [['v5', 0, 7.6 + OZ, '5V'], ['gnd', 1, 10.1 + OZ, 'GND'], ['v33', 2, 12.7 + OZ, '3V3']].forEach(([net, k, z, nm]) => {
    const a = espL(k), b = rail(net, z);
    wire(net, [a, V(a.x - 1, -24.4, z), V(b.x + 1, -24.4, z), b], `ESP ${nm} → riel ${nm}`);
  });

  grp = 'btns';
  // buttons: GND bus per perfboard (the two buses are tied together under the gap between the boards), one signal wire per button.
  // The signal wires leave from under the perfboard, rise to the lid corridor north of L7 (flat against the panel, like the LED
  // wires), run east to the column of their mux pin and drop onto it.
  const zbus = BTN_Z0 + BTN_W / 2 + 6, busX = [];
  BOARDS.forEach((bd, n) => {
    const idx = [0, 1, 2, 3].map((k) => 4 * n + k);
    const xs = idx.flatMap((b) => [BTN_X0[b] + BTN_W / 2 - 5, BTN_X0[b] + BTN_W / 2 + 5]);
    busX.push(xs);
    wire('gnd', xs.map((x) => V(x, -14.2, zbus)), `Bus GND perfboard ${n + 1}`, 0.5);
  });
  wire('gnd', [V(busX[0][7], -14.2, zbus), V(busX[1][0], -14.2, zbus)], 'GND perfboard 1 ↔ perfboard 2', 0.5);
  {
    const x2 = busX[1][7], zl = 91.4, rg = RAIL.gnd;
    wire('gnd', [V(x2, -14.2, zbus), V(x2, -14.2, zl), V(x2, -3.5, zl), V(rg, -3.5, zl), V(rg, -17.4, zl), V(rg, -17.4, 44 + OZ), rail('gnd', 44 + OZ)], 'GND perfboards → riel GND (por el pasillo de la tapa)', 0.5);
  }
  BTN_X0.forEach((_, b) => {
    // 4 lanes (2 wires each, stacked at y -3.5 and -4.35), 1 mm apart; the crossing of the wires happens below, in the air, at their own heights
    const leg = btnLeg(b, 'sig'), pin = muxC(b), zb = 84.6 + 1.0 * Math.floor(b / 2), yl = b % 2 ? -4.35 : -3.5, ya = -14.0 - 0.55 * b;
    const rx = leg.x > 64 && leg.x < 74.5 ? 75.5 : leg.x;                 // do not rise inside the L-feed corridor between L1/L4 and L2/L5
    wire('btn', [leg, V(leg.x, -14.2, leg.z), V(leg.x, -14.2, zb), V(rx, -14.2, zb), V(rx, yl, zb), V(pin.x, yl, zb), V(pin.x, ya, zb), V(pin.x, ya, pin.z), pin], `B${b + 1} → MUX C${b} (por el pasillo de la tapa)`, 0.4);
  });
  // mux: select lines from the ESP (GP14 S0, GP15 SIG, GP16 S1, GP17 S2, GP18 S3), power
  SEL.forEach(([k, m], n) => {
    const nm = MUX_CTL[m];
    wire('sel', route(espB(k), muxCtl(m), -21 - 0.3 * n, 33.2 + OZ + 0.7 * n), `GP${14 + k} → MUX ${nm}`, 0.4);
  });
  [['v33', 0, 40 + OZ, 'VCC'], ['gnd', 1, 40.2 + OZ, 'GND'], ['gnd', 7, 42 + OZ, 'EN']].forEach(([net, k, z, nm], n) => {
    wire(net, route(muxCtl(k), rail(net, z), -19.2 - 0.5 * n, 35.4 + OZ + n * 0.5), `MUX ${nm} → riel ${net === 'gnd' ? 'GND' : '3V3'}`);
  });

  // ---- interaction ------------------------------------------------------------
  const info = host.querySelector('.w3d-info');
  const defaultInfo = info.innerHTML;
  function applySelection(nets) {
    const on = nets && nets.length ? new Set(nets) : null;
    wires.forEach((w) => {
      const m = w.material, lit = !on || on.has(w.userData.net);
      m.transparent = !lit; m.opacity = lit ? 1 : 0.07; m.depthWrite = lit;
      m.emissive.set(on && lit ? m.color : '#000000'); m.emissiveIntensity = on && lit ? 0.45 : 0;
    });
  }
  function select(hit) {
    if (!hit) { applySelection(null); info.innerHTML = defaultInfo; return; }
    const ud = hit.userData;
    if (ud.type === 'wire') {
      applySelection([ud.net]);
      const rows = wires.filter((w) => w.userData.net === ud.net).map((w) => `<li>${w.userData.text}</li>`).join('');
      info.innerHTML = `<p><span class="sw" style="background:${NETS[ud.net].color}"></span><b>${NETS[ud.net].name}</b></p><ul>${rows}</ul>`;
    } else {
      applySelection(ud.nets || null);
      const names = (ud.nets || []).map((n) => `<li><span class="sw" style="background:${NETS[n].color}"></span>${NETS[n].name}</li>`).join('');
      info.innerHTML = `<p><b>${ud.title}</b></p><p class="note">${ud.desc}</p>${names ? `<ul>${names}</ul>` : ''}`;
    }
  }
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const visiblePicks = () => pickables.filter((o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return !(o.parent === layers.panel && panelMat.opacity < 0.1);
  });
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(visiblePicks(), false);
    const solid = hits.find((h) => h.object.material !== panelMat && h.object.material !== shellMat) || null;
    return solid ? solid.object : (hits[0] ? hits[0].object : null);
  }
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) select(pick(e));
    down = null;
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.buttons) { tip.hidden = true; return; }
    const o = pick(e);
    if (!o) { tip.hidden = true; renderer.domElement.style.cursor = ''; return; }
    const r = view.getBoundingClientRect();
    tip.textContent = o.userData.type === 'wire' ? o.userData.text : o.userData.title;
    tip.style.left = e.clientX - r.left + 14 + 'px'; tip.style.top = e.clientY - r.top + 12 + 'px';
    tip.hidden = false; renderer.domElement.style.cursor = 'pointer';
  });
  renderer.domElement.addEventListener('pointerleave', () => { tip.hidden = true; });

  // ---- layers
  layers.knobs.visible = false;
  layers.print.visible = false;
  const lbox = host.querySelector('.w3d-layers'), checks = {};
  const setLayer = (id, on) => { layers[id].visible = on; checks[id].checked = on; };
  for (const [id, text] of LAYERS) {
    const l = document.createElement('label');
    l.innerHTML = `<input type="checkbox"${layers[id].visible ? ' checked' : ''}> <span>${text}</span><button type="button" title="Mostrar solo esta capa">solo</button>`;
    checks[id] = l.firstElementChild;
    checks[id].onchange = (e) => { layers[id].visible = e.target.checked; };
    l.lastElementChild.onclick = () => { for (const [o] of LAYERS) setLayer(o, o === id); wires.forEach((w) => { w.visible = true; }); };
    lbox.append(l);
  }
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), cutEl = host.querySelector('#w3dCut'), opEl = host.querySelector('#w3dOp');
  const setCut = (v) => {
    cutEl.value = v; clip.constant = +v;
    renderer.clippingPlanes = +v < 0 ? [clip] : [];
    host.querySelector('#w3dCutV').textContent = +v < 0 ? `oculta lo que está a menos de ${-v} mm del panel` : 'sin corte';
  };
  const setPanelOp = (v) => { opEl.value = v; panelMat.opacity = +v; panelMat.depthWrite = +v > 0.6; };
  cutEl.oninput = (e) => setCut(e.target.value);
  opEl.oninput = (e) => setPanelOp(e.target.value);
  // ghost a layer (own cloned materials, so shared materials elsewhere are untouched)
  const ghost = (id, opacity) => layers[id].traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.matOrig) o.userData.matOrig = o.material;
    if (opacity == null) { o.material = o.userData.matOrig; return; }
    if (o.material === o.userData.matOrig) o.material = o.material.clone();
    o.material.transparent = true; o.material.opacity = opacity; o.material.depthWrite = false;
  });

  // ---- camera presets
  const TOP = [[100, 205, 135], [100, -12, 64]];
  const PRESETS = {
    'Arriba': TOP,
    'Isométrica': [[-55, 130, 215], [100, -12, 62]],
    'Frente': [[100, -12, 360], [100, -12, 62]],
    'Placa': [[185, 70, 125], [152, -22, 55], -13],
    'Perfboards': [[100, 80, 190], [100, -10, 112], 0],
  };
  let anim = null;
  const fly = (pos, tgt) => {
    const p0 = camera.position.clone(), t0 = controls.target.clone(), p1 = V(...pos), t1 = V(...tgt), start = performance.now();
    anim = (now) => {
      const u = Math.min(1, (now - start) / 650), e = u * u * (3 - 2 * u);
      camera.position.lerpVectors(p0, p1, e); controls.target.lerpVectors(t0, t1, e);
      if (u >= 1) anim = null;
    };
  };
  const camBox = host.querySelector('.w3d-cams');
  for (const [name, [pos, tgt, cut]] of Object.entries(PRESETS)) {
    const b = document.createElement('button'); b.textContent = name; b.onclick = () => { setCut(cut || 0); fly(pos, tgt); }; camBox.append(b);
  }

  // ---- printable parts: the real STL files, in print orientation, overhangs > 45 deg in red
  let printLoaded = false;
  function loadPrint() {
    if (printLoaded) return;
    printLoaded = true;
    const loader = new STLLoader();
    const bedMat = mat('#3b4250', { roughness: 0.9, metalness: 0 });
    [['shell.stl', 0, 'Base (caja) · 200 × 130 × 30 mm', 'piso sobre la cama'], ['panel_print.stl', 240, 'Tapa (panel) · 200 × 130 × 21 mm', 'cara frontal sobre la cama']].forEach(([file, dx, title, sub]) => {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(220, 2, 150), bedMat);
      bed.position.set(dx + 100, -1, -65); layers.print.add(bed);
      const tag = document.createElement('div'); tag.className = 'wl wl-led'; tag.innerHTML = `${title}<br><span style="font-weight:400">${sub}</span>`;
      const t = new CSS2DObject(tag); t.position.set(dx + 100, 4, 18); layers.print.add(t);
      loader.load('./assets/models/' + file, (geo) => {
        const n = geo.attributes.normal, pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
        const base = new THREE.Color('#c9ccd3'), warn = new THREE.Color('#ef4444');
        for (let i = 0; i < pos.count; i += 3) {
          const zmax = Math.max(pos.getZ(i), pos.getZ(i + 1), pos.getZ(i + 2));
          const bad = n.getZ(i) < -0.707 && zmax > 0.05;          // faces looking down that are not on the bed
          for (let k = 0; k < 3; k++) (bad ? warn : base).toArray(col, (i + k) * 3);
        }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.rotateX(-Math.PI / 2);                                 // OpenSCAD z (up) -> scene y
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05 }));
        m.position.set(dx, 0, 0); layers.print.add(m);
      });
    });
  }

  // ---- fixed views: one click shows only one group of wiring, with its pin table
  const hdr = (side, k) => `${side === 'L' ? 'izq.' : 'der.'} ${k + 1}`;
  const table = (title, rows) => `<h3>${title}</h3><table class="w3d-pt"><tr><th>Desde</th><th>Hacia</th></tr>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
  const PINS = {
    leds: table('Pines · cableado LEDs', [
      ['ESP GP11 (' + hdr('L', 5) + ')', 'resistencia 300 Ω → L1 DIN'],
      ['ESP 5V (' + hdr('L', 0) + ')', 'L1 5V (y capacitor 1000 µF)'],
      ['ESP GND (' + hdr('L', 1) + ')', 'L1 GND (y capacitor)'],
      ['L1 → L2 → L3', 'DOUT → DIN, 5V y GND en paralelo'],
      ['L3 → L4', 'puente largo por el riel de la tapa (3 hilos)'],
      ['L4 → L5 → L6', 'DOUT → DIN, 5V y GND en paralelo'],
      ['L5 5V / GND', 'L7 5V / GND'],
      ['ESP TX/GP43 (' + hdr('R', 0) + ')', 'L7 DIN (provisorio)'],
    ]),
    pots: table('Pines · cableado pots', [
      ...POTS.map((_, i) => { const q = potPin(i); return [`Pot ${i + 1} cursor`, `ESP ${q.name} (${hdr(q.side, q.k)})`]; }),
      ['Pata izq. de los 12 pots', 'bus 3V3 de su fila → riel 3V3'],
      ['Pata der. de los 12 pots', 'bus GND de su fila → riel GND'],
      ['ESP 3V3 (' + hdr('L', 2) + ') / GND (' + hdr('L', 1) + ')', 'rieles de la placa'],
    ]),
    btns: table('Pines · cableado botones', [
      ...BTN_X0.map((_, b) => [`B${b + 1} (pata de señal)`, `MUX C${b}`]),
      ['B1–B4 / B5–B8 (pata GND)', 'bus GND de cada perfboard → riel GND'],
      ...SEL.map(([k, m]) => [`ESP GP${14 + k} (inferior ${k + 1})`, `MUX ${MUX_CTL[m]} (pin ${m + 1})`]),
      ['MUX VCC', 'riel 3V3'], ['MUX GND y EN', 'riel GND'],
    ]),
  };
  const VIEWS = {
    all: { label: 'Todo' },
    print: { label: 'Piezas a imprimir', show: ['print'], groups: [], cam: [[225, 420, 300], [225, 0, -62]], cut: 0, op: 0.3, onShow: () => loadPrint() },
    leds: { label: 'Cableado LEDs', groups: ['leds', 'power'], show: ['panel', 'shell', 'support', 'rails', 'leds', 'board', 'usb', 'wled', 'wgnd', 'wv5', 'labels'], ghost: { leds: 0.3 }, cam: TOP, cut: 0, op: 0.1 },
    pots: { label: 'Cableado pots', groups: ['pots', 'power'], show: ['panel', 'shell', 'support', 'rails', 'pots', 'board', 'usb', 'wpot', 'wgnd', 'wv33', 'wv5', 'labels'], ghost: { pots: 0.3 }, cam: TOP, cut: 0, op: 0.1 },
    btns: { label: 'Cableado botones', groups: ['btns', 'power'], show: ['panel', 'shell', 'support', 'rails', 'btns', 'board', 'usb', 'wbtn', 'wgnd', 'wv33', 'wv5', 'labels'], ghost: { btns: 0.3 }, cam: [[110, 200, 165], [110, -16, 80]], cut: 0, op: 0.1 },
  };
  PINS.print = `<h3>Impresión</h3><ul class="w3d-pt-list">
    <li><b>Base:</b> 200 × 130 × 30 mm, el piso sobre la cama.</li>
    <li><b>Tapa:</b> 200 × 130 mm y unos 22 mm de alto, girada con la cara frontal sobre la cama (rieles, puentes y aros crecen hacia arriba).</li>
    <li><span class="sw" style="background:#ef4444"></span>Rojo = cara que mira hacia abajo con más de 45° (puentes cortos de los túneles y los aros, y los techos de los agujeros). Revísalos en el laminador; los puentes son de pocos milímetros.</li>
    <li>Sin soportes. PLA o PETG, capa de 0,2 mm, 3 perímetros.</li>
    <li>Regenerar los STL: <code>enclosure/export-stl.sh</code>.</li></ul>`;
  const viewBox = host.querySelector('.w3d-views'), pinsBox = host.querySelector('.w3d-pins'), vbtn = {};
  function setView(id) {
    const v = VIEWS[id];
    for (const [l] of LAYERS) ghost(l, v.ghost && v.ghost[l] != null ? v.ghost[l] : null);
    for (const [l] of LAYERS) setLayer(l, v.show ? v.show.includes(l) : l !== 'knobs' && l !== 'print');
    if (v.onShow) v.onShow();
    wires.forEach((w) => { w.visible = !v.groups || v.groups.includes(w.userData.group); });
    applySelection(null);
    info.innerHTML = defaultInfo;
    setPanelOp(v.op || 0.3); setCut(v.cut || 0);
    const [pos, tgt] = v.cam || PRESETS['Isométrica']; fly(pos, tgt);
    pinsBox.innerHTML = PINS[id] || '';
    Object.entries(vbtn).forEach(([k, b]) => b.classList.toggle('on', k === id));
  }
  for (const [id, v] of Object.entries(VIEWS)) {
    const b = document.createElement('button'); b.textContent = v.label; b.onclick = () => setView(id); viewBox.append(b); vbtn[id] = b;
  }
  const q = new URLSearchParams(location.search), first = PRESETS[q.get('view')] || PRESETS['Isométrica'];
  camera.position.set(...first[0]); controls.target.set(...first[1]); setCut(first[2] || 0);
  if (q.get('layers')) { const on = q.get('layers').split(','); for (const [l] of LAYERS) setLayer(l, on.includes(l)); }
  if (q.get('cam')) { const c = q.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); controls.target.set(c[3], c[4], c[5]); }
  if (VIEWS[q.get('v')]) { setView(q.get('v')); camera.position.set(...(VIEWS[q.get('v')].cam || first)[0]); controls.target.set(...(VIEWS[q.get('v')].cam || first)[1]); anim = null; }
  if (!VIEWS[q.get('v')]) vbtn.all.classList.add('on');

  function resize() {
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h); labelRenderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(view);
  (function loop(now) {
    requestAnimationFrame(loop);
    if (!view.offsetParent) return;
    if (anim) anim(now);
    controls.update();
    const near = camera.position.distanceTo(controls.target) < 170;
    for (const o of labelObjs) {                 // CSS2DRenderer ignores hidden parents, so fold them in here
      let on = !(o.userData.pin && !near);
      for (let p = o.parent; on && p; p = p.parent) if (!p.visible) on = false;
      o.visible = on;
    }
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  })(0);
  resize();
  return { resize };
}

export function show(host) {
  if (!ctx) ctx = build(host);
  ctx.resize();
}
