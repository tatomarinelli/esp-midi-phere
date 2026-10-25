'use strict';
const NUM_POTS = 12, NUM_BTNS = 8;
const SYX = { MFR: 0x7d, ID: 0x50, PING: 1, GET: 2, CHUNK: 3, APPLY: 4, SAVE: 5, RESET: 6, BOOT: 7, PONG: 0x41, ACK: 0x7f };
const BTN_FNS = ['monitor', 'channel-left', 'channel-right', 'midi-only'];
const MONITOR_STATES = ['IN-AUTO', 'IN-AUTO-OFF'];
const LED_MODES = ['bar', 'dot', 'center'];

const defaultConfig = () => ({
  version: 1,
  pots: Array.from({ length: NUM_POTS }, (_, i) => ({ cc: i + 1, ch: 1, enabled: true, invert: true, min: 0, max: 127, smooth: 0.3 })),
  leds: Array.from({ length: NUM_POTS }, () => ({ color: '#ff8c00', brightness: 100, segments: 4, mode: 'bar' })),
  targets: Array.from({ length: NUM_POTS }, (_, i) => ({ type: 'macro', name: `POT${Math.floor(i / 2) + 1}-${(i % 2) + 1}`, send: 'A', tracks: [] })),
  buttons: Array.from({ length: NUM_BTNS }, (_, i) => ({ note: 36 + i, ch: 1, fn: 'monitor', states: 'IN-AUTO-OFF', tracks: [] })),
});
// Configs saved before `enabled` existed have no such field: treat them as enabled.
function mergeConfig(j) {
  const c = { ...defaultConfig(), ...j };
  c.pots = c.pots.map((p) => ({ enabled: true, ...p }));
  return c;
}
let cfg = defaultConfig(), baseline = null, midi = null, input = null, output = null, seq = 0, rx = [];
const clone = (o) => JSON.parse(JSON.stringify(o));
const $ = (id) => document.getElementById(id);
let toastTimer;
// Last result stays in the rail; a toast on the content side makes it noticeable. kind: 'ok' | 'err' | undefined
const log = (m, kind) => {
  $('log').textContent = m;
  const t = $('toast');
  t.textContent = m;
  t.className = 'show ' + (kind || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, kind === 'err' ? 6000 : 3000);
};

// ---- tabs
const TABS = { monitor: 'Monitor', pots: 'Pots', leds: 'Barras LED', targets: 'Destinos', buttons: 'Botones', firmware: 'Firmware', preview: 'Preview', wiring: 'Cableado' };
function showTab(id) {
  document.querySelectorAll('section').forEach((s) => s.classList.toggle('on', s.id === 'sec-' + id));
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === id));
  if (id === 'preview') renderPreview();
  if (id === 'wiring') import('./wiring.js').then((m) => m.show($('wiringHost'))).catch((e) => { $('wiringHost').textContent = 'No se pudo cargar la vista 3D: ' + e.message; });
  try { localStorage.setItem('tab', id); } catch (e) {}
}
const TAB_GROUPS = [['En vivo', ['monitor']], ['Configuración', ['pots', 'leds', 'targets', 'buttons']], ['Dispositivo', ['firmware']], ['Resumen', ['preview', 'wiring']]];
for (const [group, ids] of TAB_GROUPS) {
  const g = document.createElement('div'); g.className = 'tabgroup'; g.textContent = group; $('tabs').append(g);
  for (const id of ids) {
    const b = document.createElement('button'); b.textContent = TABS[id]; b.dataset.t = id;
    b.onclick = () => showTab(id); $('tabs').append(b);
  }
}

// ---- monitor
const meters = [];
for (let i = 0; i < NUM_POTS; i++) {
  const c = document.createElement('div'); c.className = 'card';
  c.innerHTML = `<div class="chead"><b>Pot ${i + 1}</b><span class="cc">CC${i + 1}</span><span class="v">\u2013</span></div><div class="meter"><i></i></div>
    <input type="range" min="0" max="127" value="0" style="width:100%" title="Probar barra LED (CC${20 + i})">`;
  c.querySelector('input').oninput = (e) => sendCC(20 + i, +e.target.value);
  $('meters').append(c); meters.push(c);
}
const lastCC = Array(NUM_POTS).fill(64);
let previewQueued = false;
function onCC(cc, v) {
  const i = cc - 1;
  if (i < 0 || i >= NUM_POTS) return;
  lastCC[i] = v;
  if (!previewQueued && $('sec-preview').classList.contains('on')) {
    previewQueued = true;
    requestAnimationFrame(() => { previewQueued = false; renderPreview(); });
  }
  meters[i].querySelector('i').style.width = (v / 127 * 100) + '%';
  meters[i].querySelector('.v').textContent = v;
}

// ---- config tables
function table(el, head, rows) {
  el.innerHTML = '<table></table>';
  const t = el.firstChild;
  const hr = t.insertRow();
  head.forEach((h) => { const th = document.createElement('th'); th.append(h); hr.append(th); });
  rows.forEach((cells) => { const tr = t.insertRow(); cells.forEach((c) => tr.insertCell().append(c)); });
}
function field(obj, key, type, opts) {
  let e;
  if (opts) { e = document.createElement('select'); opts.forEach((o) => e.add(new Option(o, o))); e.value = obj[key]; e.onchange = () => { obj[key] = e.value; }; }
  else if (type === 'checkbox') { e = document.createElement('input'); e.type = type; e.checked = obj[key]; e.onchange = () => { obj[key] = e.checked; }; }
  else {
    e = document.createElement('input'); e.type = type; e.value = obj[key];
    if (type === 'number') e.step = 'any';
    e.oninput = () => { obj[key] = type === 'number' ? +e.value : e.value; };
  }
  return e;
}
const lbl = (t) => document.createTextNode(t);
// Header cell with a value control + "Todos" button that writes that value to
// every row's `key` in `list`. spec: {type:'number',min,max,step} | {type:'checkbox'}
// | {type:'color'} | {type:'select',opts}.
function applyAllHead(label, list, key, spec) {
  const w = document.createElement('span');
  w.className = 'ah';
  let inp;
  if (spec.type === 'select') {
    inp = document.createElement('select'); spec.opts.forEach((o) => inp.add(new Option(o, o)));
  } else {
    inp = document.createElement('input'); inp.type = spec.type;
    if (spec.type === 'number') { inp.min = spec.min; inp.max = spec.max; inp.step = spec.step || 1; inp.style.width = '64px'; }
  }
  const read = () => {
    if (spec.type === 'checkbox') return inp.checked;
    if (spec.type === 'number') return Math.max(spec.min, Math.min(spec.max, +inp.value || spec.min));
    return inp.value;
  };
  if (spec.type === 'checkbox') inp.checked = !!list[0][key]; else inp.value = list[0][key];
  const btn = document.createElement('button');
  btn.textContent = 'Todos'; btn.title = `Aplicar este valor de "${label}" a todas las filas`;
  btn.onclick = () => { const v = read(); list.forEach((r) => { r[key] = v; }); renderConfig(); };
  w.append(label + ' ', inp, btn);
  return w;
}
// Re-render everything that shows the config, so no tab needs to be re-opened to refresh.
function refreshAll() { renderConfig(); renderPreview(); updateDirty(); }
// The save button lights up (with a count) while the config differs from what the ESP has.
function updateDirty() {
  const n = baseline ? diffCfg().length : 0;
  $('save').classList.toggle('dirty', n > 0);
  $('dirty').hidden = n === 0;
  $('dirty').textContent = n;
}
function renderConfig() {
  table($('potsTbl'), ['Pot', applyAllHead('Activo', cfg.pots, 'enabled', { type: 'checkbox' }), 'CC', applyAllHead('Canal', cfg.pots, 'ch', { type: 'number', min: 1, max: 16 }), applyAllHead('Invertir', cfg.pots, 'invert', { type: 'checkbox' }), applyAllHead('Min', cfg.pots, 'min', { type: 'number', min: 0, max: 127 }), applyAllHead('Max', cfg.pots, 'max', { type: 'number', min: 0, max: 127 }), applyAllHead('Suavizado', cfg.pots, 'smooth', { type: 'number', min: 0, max: 1, step: 0.05 })],
    cfg.pots.map((p, i) => [lbl(i + 1), field(p, 'enabled', 'checkbox'), field(p, 'cc', 'number'), field(p, 'ch', 'number'), field(p, 'invert', 'checkbox'), field(p, 'min', 'number'), field(p, 'max', 'number'), field(p, 'smooth', 'number')]));
  table($('ledsTbl'), ['Barra', applyAllHead('Color', cfg.leds, 'color', { type: 'color' }), applyAllHead('Brillo (%)', cfg.leds, 'brightness', { type: 'number', min: 0, max: 100 }), applyAllHead('Segmentos', cfg.leds, 'segments', { type: 'number', min: 1, max: 4 }), applyAllHead('Modo', cfg.leds, 'mode', { type: 'select', opts: LED_MODES })],
    cfg.leds.map((l, i) => [lbl(i + 1), field(l, 'color', 'color'), (() => { const e = field(l, 'brightness', 'number'); e.min = 0; e.max = 100; e.step = 1; e.title = '100 % = tope seguro del firmware (raw 40)'; e.addEventListener('change', () => { l.brightness = Math.max(0, Math.min(100, Math.round(l.brightness) || 0)); e.value = l.brightness; }); return e; })(), (() => { const e = field(l, 'segments', 'number'); e.min = 1; e.max = 4; e.step = 1; e.title = 'Cada pot tiene 4 píxeles'; e.addEventListener('change', () => { l.segments = Math.max(1, Math.min(4, Math.round(l.segments) || 1)); e.value = l.segments; }); return e; })(), field(l, 'mode', 'text', LED_MODES)]));
  table($('targetsTbl'), ['Pot', applyAllHead('Tipo', cfg.targets, 'type', { type: 'select', opts: ['macro', 'send'] }), 'Macro (nombre)', applyAllHead('Send', cfg.targets, 'send', { type: 'select', opts: 'ABCDEF'.split('') }), 'Pistas de Live'],
    cfg.targets.map((t, i) => {
      const type = field(t, 'type', 'text', ['macro', 'send']);
      const name = field(t, 'name', 'text');
      const send = field(t, 'send', 'text', 'ABCDEF'.split(''));
      const tracks = document.createElement('input');
      tracks.type = 'text'; tracks.placeholder = 'ej: 1,3'; tracks.value = (t.tracks || []).join(',');
      tracks.oninput = () => { t.tracks = tracks.value.split(',').map((x) => parseInt(x, 10)).filter((n) => n >= 1); };
      const sync = () => {
        const m = t.type === 'macro';
        name.disabled = !m; send.disabled = tracks.disabled = m;
        name.title = m ? '' : 'Solo para tipo "macro"';
        send.title = m ? 'Solo para tipo "send"' : '';
        tracks.title = m ? 'Solo para tipo "send"' : 'Números de pista de Live separados por coma, por ejemplo 1,3';
      };
      type.addEventListener('change', sync); sync();
      return [lbl(i + 1), type, name, send, tracks];
    }));
  table($('btnsTbl'), ['Botón', 'Nota', applyAllHead('Canal', cfg.buttons, 'ch', { type: 'number', min: 1, max: 16 }), applyAllHead('Función', cfg.buttons, 'fn', { type: 'select', opts: BTN_FNS }), applyAllHead('Estados', cfg.buttons, 'states', { type: 'select', opts: MONITOR_STATES }), 'Pistas de Live'],
    cfg.buttons.map((b, i) => {
      const states = field(b, 'states', 'text', MONITOR_STATES);
      const fn = field(b, 'fn', 'text', BTN_FNS);
      const tracks = document.createElement('input');
      tracks.type = 'text'; tracks.placeholder = 'ej: 1,2'; tracks.setAttribute('aria-label', 'Números de pista de Live separados por coma'); tracks.value = (b.tracks || []).join(',');
      tracks.oninput = () => { b.tracks = tracks.value.split(',').map((t) => parseInt(t, 10)).filter((n) => n >= 1); };
      const sync = () => {
        states.disabled = tracks.disabled = b.fn !== 'monitor';
        states.title = states.disabled ? 'Solo aplica a la función "monitor"' : '';
        tracks.title = states.disabled ? 'Solo aplica a la función "monitor"' : 'Números de pista de Live separados por coma, por ejemplo 1,3';
      };
      fn.addEventListener('change', sync); sync();
      return [lbl(i + 1), field(b, 'note', 'number'), field(b, 'ch', 'number'), fn, states, tracks];
    }));
}

// ---- MIDI
function sendCC(cc, v, ch = 0) { if (output) output.send([0xb0 | ch, cc, v]); }
const pending = new Map();
let fwVersion = '';
const ST_TEXT = { 0: 'OK', 1: 'Comando inválido', 2: 'Chunk fuera de orden', 3: 'Config demasiado grande', 4: 'El ESP no pudo interpretar la config', 5: 'Nada que aplicar (o el ESP no tiene config guardada)', 6: 'Error al escribir en la flash', '-1': 'Conecta el dispositivo primero', '-2': 'El ESP no respondió (¿firmware con SysEx?)' };
const stText = (st) => ST_TEXT[st] || 'Error ' + st;
// Sends one SysEx request and resolves with the device status (0 = ok, -1 = not connected, -2 = timeout).
function req(cmd, payload = [], timeout = 2000) {
  if (!output) return Promise.resolve(-1);
  seq = (seq + 1) & 0x7f;
  const s = seq;
  return new Promise((resolve) => {
    const t = setTimeout(() => { pending.delete(s); resolve(-2); }, timeout);
    pending.set(s, (st) => { clearTimeout(t); pending.delete(s); resolve(st); });
    output.send([0xf0, SYX.MFR, SYX.ID, cmd, s, ...payload, 0xf7]);
  });
}
const settle = (s, st) => { const f = pending.get(s); if (f) f(st); };
function onMessage(ev) {
  const d = ev.data;
  if (d[0] === 0xf0) return onSysex(d);
  if ((d[0] & 0xf0) === 0xb0) onCC(d[1], d[2]);
}
function onSysex(d) {
  if (d[1] !== SYX.MFR || d[2] !== SYX.ID) return;
  const cmd = d[3], rseq = d[4], body = d.slice(5, d.length - 1);
  if (cmd === SYX.PONG) { fwVersion = String.fromCharCode(...body); settle(rseq, 0); }
  else if (cmd === SYX.CHUNK) {
    const [idx, total] = body; rx[idx] = String.fromCharCode(...body.slice(2));
    if (rx.filter(Boolean).length === total) {
      let st = 0;
      try { cfg = mergeConfig(JSON.parse(rx.join(''))); baseline = clone(cfg); refreshAll(); }
      catch (e) { log('Config inválida: ' + e.message, 'err'); st = 4; }
      rx = [];
      settle(rseq, st);
    }
  } else if (cmd === SYX.ACK) settle(body[0], body[1]);
}
async function sendConfig() {
  const json = JSON.stringify(cfg).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  const CH = 200, total = Math.ceil(json.length / CH);
  for (let i = 0; i < total; i++) {
    const st = await req(SYX.CHUNK, [i, total, ...[...json.slice(i * CH, (i + 1) * CH)].map((c) => c.charCodeAt(0))]);
    if (st !== 0) return st;
  }
  return 0;
}
async function applyConfig() {
  let st = await sendConfig();
  return st === 0 ? req(SYX.APPLY) : st;
}
// Runs one device action: locks the toolbar, shows a spinner on the pressed button and a
// progress bar, dims the content while reading, then reports the result.
let busy = false;
const LOCKED = ['connect', 'read', 'apply', 'save', 'ping', 'reset', 'boot', 'export', 'import'];
function setBusy(on, btn, dim) {
  busy = on;
  document.body.classList.toggle('busy', on);
  document.querySelector('main').classList.toggle('loading', on && !!dim);
  LOCKED.forEach((id) => { const e = $(id); if (e) e.disabled = on; });
  if (btn) btn.classList.toggle('loading', on);
}
async function run(label, fn, btn, dim) {
  if (busy) return -3;
  setBusy(true, btn, dim);
  log(label + '\u2026');
  let st;
  try { st = await fn(); } finally { setBusy(false, btn, dim); }
  log(st === 0 ? label + ': OK' : label + ': ' + stText(st), st === 0 ? 'ok' : 'err');
  return st;
}
// Reads the config from the ESP and refreshes every view. Nothing stored = the ESP runs on
// defaults, so the GUI shows the defaults instead of keeping stale values.
async function readFromDevice(btn) {
  rx = [];
  const st = await run('Leer', () => req(SYX.GET, [], 4000), btn, true);
  if (st === 5) { cfg = defaultConfig(); baseline = clone(cfg); refreshAll(); log('El ESP no tiene config guardada: se muestran los valores por defecto'); }
  return st;
}
function fillPorts() {
  for (const [sel, ports] of [[$('inSel'), midi.inputs], [$('outSel'), midi.outputs]]) {
    const prev = sel.value; sel.innerHTML = '';
    ports.forEach((p) => sel.add(new Option(p.name, p.id)));
    if (prev) sel.value = prev;
    const guess = [...sel.options].find((o) => /esp32|phere/i.test(o.text));
    if (!prev && guess) sel.value = guess.value;
  }
}
async function init() {
  try { midi = await navigator.requestMIDIAccess({ sysex: true }); }
  catch (e) { $('status').textContent = 'Web MIDI no disponible (usa Chrome/Edge): ' + e.message; return; }
  midi.onstatechange = fillPorts; fillPorts();
  $('status').textContent = 'Sin conexión';
  $('status').classList.remove('on');
}
$('connect').onclick = async () => {
  if (!midi || busy) return;
  if (input) input.onmidimessage = null;
  input = midi.inputs.get($('inSel').value); output = midi.outputs.get($('outSel').value);
  if (!input || !output) return ($('status').textContent = 'Elige puertos de entrada y salida');
  input.onmidimessage = onMessage;
  $('status').textContent = 'Conectado: ' + output.name;
  $('status').classList.add('on');
  await readFromDevice($('connect'));  // load the ESP's config right away
};
$('ping').onclick = async () => { if (await run('Probar conexión', () => req(SYX.PING), $('ping')) === 0) log('El ESP responde (firmware ' + fwVersion + ')', 'ok'); };
$('read').onclick = () => readFromDevice($('read'));
$('apply').onclick = () => run('Aplicar', applyConfig, $('apply'));
$('save').onclick = () => run('Guardar', async () => {
  let st = await applyConfig();
  if (st === 0) st = await req(SYX.SAVE);
  if (st === 0) { baseline = clone(cfg); refreshAll(); }
  return st;
}, $('save'));
$('boot').onclick = () => confirm('¿Reiniciar el ESP en modo bootloader?') && run('Bootloader', () => req(SYX.BOOT), $('boot'));
$('reset').onclick = () => confirm('¿Restaurar valores de fábrica?') && run('Valores de fábrica', () => req(SYX.RESET), $('reset'));
$('export').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' }));
  a.download = 'phere-config.json'; a.click();
};
$('import').onclick = () => $('file').click();
$('file').onchange = async (e) => {
  try { const j = JSON.parse(await e.target.files[0].text());
    if (j.macros && !j.targets) j.targets = j.macros.map((name) => ({ type: 'macro', name, send: 'A', tracks: [] }));
    cfg = mergeConfig(j); refreshAll(); log('Config importada'); }
  catch (err) { log('JSON inválido: ' + err.message, 'err'); }
};


// ---- preview: schematic of the v7 panel (200x130mm, coordinates = page coords in
// enclosure/esp-midi-phere-top-template-v7.scad) + diff against the last
// config read from / saved to the ESP (or the defaults if never connected).
const GEO = {
  pots: [[31.125, 37], [56.675, 37], [92.225, 37], [117.775, 37], [153.325, 37], [178.875, 37],
         [31.125, 79], [56.675, 79], [92.225, 79], [117.775, 79], [153.325, 79], [178.875, 79]],
  leds: [[18.35, 17.05], [79.45, 17.05], [140.55, 17.05], [18.35, 59.05], [79.45, 59.05], [140.55, 59.05]],
  led7: [79.45, 96.9], ledW: 51.1, ledH: 10.2, btnW: 12.5, potR: 3.75,
  btns: [[31.78, 117.75], [47.02, 117.75], [62.26, 117.75], [77.5, 117.75], [120, 117.75], [135.24, 117.75], [150.48, 117.75], [165.72, 117.75]],
};
const BTN_GLYPH = { monitor: 'MON', 'channel-left': '\u25c0', 'channel-right': '\u25b6', 'midi-only': 'MIDI' };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function diffCfg() {
  const out = [], names = { pots: 'Pot', leds: 'Barra', targets: 'Destino pot', buttons: 'Botón' };
  for (const [sec, label] of Object.entries(names)) {
    (cfg[sec] || []).forEach((row, i) => {
      const was = (baseline[sec] || [])[i] || {};
      const ch = Object.keys(row).filter((k) => JSON.stringify(row[k]) !== JSON.stringify(was[k]))
        .map((k) => `${k}: ${esc(JSON.stringify(was[k]))} \u2192 ${esc(JSON.stringify(row[k]))}`);
      if (ch.length) out.push({ sec, i, text: `<b>${label} ${i + 1}</b> \u2014 ${ch.join(', ')}` });
    });
  }
  return out;
}

// Most common value (ties -> lowest), used to flag channels that differ from the rest.
function majority(vals) {
  const n = {};
  vals.forEach((v) => { n[v] = (n[v] || 0) + 1; });
  return +Object.keys(n).sort((x, y) => n[y] - n[x] || x - y)[0];
}

// Fixed palette (the backdrop render is light gray regardless of theme): one ink colour for
// all text, blue ring = changed since last read/save, red = channel differs from the rest.
const INK = '#23262d', CHANGED = '#2563eb', WARN = '#b91c1c';

function renderPreview() {
  const changes = diffCfg(), mark = (sec, i) => changes.some((c) => c.sec === sec && c.i === i);
  const potMaj = majority(cfg.pots.map((p) => p.ch)), btnMaj = majority(cfg.buttons.map((b) => b.ch));
  const G = GEO;
  // Depth: soft drop shadows, knob and keycap gradients, recessed LED windows, glowing lit segments.
  const defs = `<defs>
    <clipPath id="panelClip"><rect x="5" y="5" width="200" height="130" rx="4"/></clipPath>
    <filter id="boxShadow" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="#000" flood-opacity=".38"/></filter>
    <filter id="partShadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy=".7" stdDeviation=".55" flood-color="#000" flood-opacity=".5"/></filter>
    <filter id="glow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation=".7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <radialGradient id="knobG" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#5a6070"/><stop offset=".55" stop-color="#2c3039"/><stop offset="1" stop-color="#16181d"/></radialGradient>
    <linearGradient id="capG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfbfc"/><stop offset="1" stop-color="#cfd3da"/></linearGradient>
    <linearGradient id="recessG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".7"/><stop offset=".45" stop-color="#000" stop-opacity="0"/></linearGradient>
  </defs>`;
  let svg = `<svg viewBox="0 0 210 140" role="img" aria-label="Panel">${defs}<image href="assets/box-v7-top.png" x="5" y="5" width="200" height="130" preserveAspectRatio="none" clip-path="url(#panelClip)" filter="url(#boxShadow)"/>`;
  const ring = (x, y, w, h, r, color, dash) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${color}" stroke-width="0.7"${dash ? ' stroke-dasharray="1.6 1"' : ''}/>`;
  const T = (x, y, size, txt, weight, fill) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight || 400}" fill="${fill || INK}">${txt}</text>`;
  const recess = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${INK}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="url(#recessG)"/><rect x="${x + .2}" y="${y + .2}" width="${w - .4}" height="${h - .4}" rx="1.3" fill="none" stroke="rgba(255,255,255,.22)" stroke-width=".35"/>`;

  G.leds.forEach(([x, y], k) => {
    svg += recess(x, y, G.ledW, G.ledH);
    [2 * k, 2 * k + 1].forEach((pi, half) => {
      const l = cfg.leds[pi], n = Math.max(1, Math.min(4, l.segments | 0)), pad = 1.2, w = G.ledW / 2 - 2 * pad, sw = w / n;
      for (let s = 0; s < n; s++) {
        const lit = l.mode === 'dot' ? s === n - 1 : l.mode === 'center' ? Math.abs(s - (n - 1) / 2) <= (n - 1) / 4 + 0.5 : true;
        const op = lit ? 0.3 + 0.7 * l.brightness / 100 : 0.15;
        svg += `<rect x="${x + half * G.ledW / 2 + pad + s * sw + 0.3}" y="${y + 1.4}" width="${sw - 0.6}" height="${G.ledH - 2.8}" rx="0.6" fill="${esc(l.color)}" opacity="${op}"${lit ? ' filter="url(#glow)"' : ''}/>`;
      }
      if (mark('leds', pi)) svg += ring(x + half * G.ledW / 2 + 0.3, y + 0.3, G.ledW / 2 - 0.6, G.ledH - 0.6, 1.2, CHANGED);
    });
  });
  svg += recess(G.led7[0], G.led7[1], G.ledW, G.ledH) + T(G.led7[0] + G.ledW / 2, G.led7[1] + 6.2, 3, 'estado', 400, '#c5c9d1');

  G.pots.forEach(([x, y], i) => {
    const t = cfg.targets[i], p = cfg.pots[i], odd = p.ch !== potMaj;
    const label = t.type === 'macro' ? t.name : `Send ${t.send} \u00b7 ${(t.tracks || []).join(',') || '\u2014'}`;
    const angle = -135 + (lastCC[i] / 127) * 270;  // knob indicator follows the live pot value
    if (mark('pots', i) || mark('targets', i)) svg += `<circle cx="${x}" cy="${y}" r="${G.potR + 2.6}" fill="none" stroke="${CHANGED}" stroke-width="0.7"/>`;
    if (odd) svg += `<circle cx="${x}" cy="${y}" r="${G.potR + 4}" fill="none" stroke="${WARN}" stroke-width="0.6" stroke-dasharray="1.6 1"/>`;
    svg += `<g filter="url(#partShadow)"${p.enabled === false ? ' opacity=".35"' : ''}><circle cx="${x}" cy="${y}" r="5.3" fill="url(#knobG)"/></g>`
      + `<circle cx="${x}" cy="${y}" r="4.2" fill="none" stroke="rgba(255,255,255,.16)" stroke-width=".3"/>`
      + `<line x1="${x}" y1="${y - 1.3}" x2="${x}" y2="${y - 4.2}" stroke="#eef0f4" stroke-width=".75" stroke-linecap="round" transform="rotate(${angle.toFixed(1)} ${x} ${y})"/>`
      + T(x, y + 10.3, 2.9, `<tspan font-weight="700">${i + 1}</tspan>  ${esc(label)}`)
      + T(x, y + 13.5, 2.6, `CC${p.cc} \u00b7 ch${p.ch}`, odd ? 700 : 400, odd ? WARN : INK);
  });
  G.btns.forEach(([x, y], i) => {
    const b = cfg.buttons[i], cx = x + G.btnW / 2, odd = b.ch !== btnMaj;
    if (mark('buttons', i)) svg += ring(x - 0.8, y - 0.8, G.btnW + 1.6, G.btnW + 1.6, 1.8, CHANGED);
    if (odd) svg += ring(x - 1.6, y - 1.6, G.btnW + 3.2, G.btnW + 3.2, 2.2, WARN, true);
    svg += `<g filter="url(#partShadow)"><rect x="${x + .5}" y="${y + .3}" width="${G.btnW - 1}" height="${G.btnW - 1}" rx="1.6" fill="url(#capG)" stroke="rgba(0,0,0,.3)" stroke-width=".3"/></g>`
      + T(cx, y + 5.4, 3.2, BTN_GLYPH[b.fn] || esc(b.fn), 700) + T(cx, y + 9.2, 2.3, `N${b.note} \u00b7 ch${b.ch}`, odd ? 700 : 400, odd ? WARN : INK);
  });
  $('panelSvg').innerHTML = svg + '</svg>';

  const notes = [];
  cfg.pots.forEach((p, i) => { if (p.ch !== potMaj) notes.push(`<b>Pot ${i + 1}</b> usa ch${p.ch}; el resto de los pots usa ch${potMaj}`); });
  cfg.buttons.forEach((b, i) => { if (b.ch !== btnMaj) notes.push(`<b>Bot\u00f3n ${i + 1}</b> usa ch${b.ch}; el resto de los botones usa ch${btnMaj}`); });
  $('chanNotes').innerHTML = notes.length ? notes.map((n) => `<li class="warn">${n}</li>`).join('')
    : `<li class="none">Todos los pots en ch${potMaj} y todos los botones en ch${btnMaj}.</li>`;
  $('changeCount').textContent = changes.length ? `(${changes.length})` : '';
  $('changes').innerHTML = changes.length ? changes.map((c) => `<li>${c.text}</li>`).join('') : '<li class="none">Sin cambios respecto a la \u00faltima config le\u00edda o guardada.</li>';
}

// ---- header text never wraps; show the full text as a tooltip instead
['status', 'log'].forEach((id) => {
  const el = $(id);
  new MutationObserver(() => { el.title = el.textContent; }).observe(el, { childList: true, characterData: true, subtree: true });
});

document.addEventListener('input', updateDirty);
document.addEventListener('change', updateDirty);

// ---- startup (kept last so every const above is initialized)
baseline = clone(cfg);
refreshAll();
let tab = 'monitor'; try { tab = localStorage.getItem('tab') || tab; } catch (e) {}
const hashTab = location.hash.slice(1);
showTab(TABS[hashTab] ? hashTab : TABS[tab] ? tab : 'monitor');
init();
// opening with #tab matches a section id and makes the browser scroll the page; undo that
window.addEventListener('load', () => window.scrollTo(0, 0));
