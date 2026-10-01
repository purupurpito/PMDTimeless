// Efectos visuales de los movimientos, en el estilo de Mundo Misterioso: sprites pequeños de pixel art (contorno
// oscuro, pocos colores, nada difuminado) animados fotograma a fotograma. Los sprites son propios, dibujados aquí
// con cadenas de texto (cada carácter es un píxel) y coloreados con la paleta del tipo del movimiento.
// spawnMoveFx() devuelve cuándo llega el golpe a cada objetivo, para que el daño, el gesto de dolor y el sonido
// salgan en el impacto.

const now = () => performance.now();
const FRAME = 66;   // ~15 fotogramas por segundo, como los efectos del original
const fxs = [];
let busyUntil = 0, shake = null;
export const fxEndTime = () => busyUntil;
export const fxActive = () => fxs.length > 0;
// temblor de pantalla (Terremoto, golpes muy fuertes): desplazamiento de la cámara de la mazmorra
export function fxShake() {
  if (!shake) return [0, 0]; const k = (now() - shake.t0) / shake.ms; if (k < 0) return [0, 0]; if (k >= 1) { shake = null; return [0, 0]; }
  const a = shake.amp * (1 - k) * (Math.floor(now() / 40) % 2 ? 1 : -1); return [Math.round(a), Math.round(a * 0.4)];
}

// ---------- paletas por tipo: contorno, oscuro, medio, claro, brillo ----------
const PAL = {
  'Normal':    ['#3a3020', '#b0a888', '#e8e0c8', '#fff8e8', '#ffffff'],
  'Fuego':     ['#5a1808', '#d03010', '#f87818', '#ffd040', '#fff8c0'],
  'Agua':      ['#102a68', '#2860d0', '#58a8f8', '#b0e0ff', '#ffffff'],
  'Planta':    ['#103a10', '#2a8a28', '#58c840', '#a8e870', '#e8ffd0'],
  'Eléctrico': ['#5a4000', '#d8a000', '#f8e030', '#fff890', '#ffffff'],
  'Hielo':     ['#18486a', '#3898c8', '#80d8f8', '#c8f4ff', '#ffffff'],
  'Lucha':     ['#5a2008', '#c05020', '#f09040', '#ffd090', '#ffffff'],
  'Veneno':    ['#300a48', '#7028a0', '#a858d8', '#d8a0f8', '#f8e8ff'],
  'Tierra':    ['#3a2408', '#8a5a20', '#c89048', '#e8c888', '#fff0d0'],
  'Volador':   ['#2a3a58', '#7898c0', '#b8d0f0', '#e8f4ff', '#ffffff'],
  'Psíquico':  ['#580a38', '#c02880', '#f060b0', '#ffb0e0', '#ffffff'],
  'Bicho':     ['#283a08', '#5a8a10', '#98c828', '#d0f070', '#f8ffd0'],
  'Roca':      ['#2a2418', '#6a5a40', '#a89878', '#d8ccb0', '#f8f0e0'],
  'Fantasma':  ['#1a0a38', '#4a2a8a', '#8060d8', '#c0a8f8', '#f0e8ff'],
  'Dragón':    ['#100a48', '#3028b0', '#6070f0', '#a8b8ff', '#ffffff'],
  'Siniestro': ['#080408', '#2a1830', '#584068', '#9878b0', '#e0d0f0'],
  'Acero':     ['#283038', '#6a7888', '#a8b8c8', '#dce8f4', '#ffffff'],
  'Hada':      ['#581838', '#d05898', '#f898c8', '#ffd0e8', '#ffffff'],
};
const HIT = ['#3a2a08', '#e0a020', '#f8e050', '#fff8b0', '#ffffff'];   // el destello de golpe (amarillo y blanco)

// ---------- sprites: '.' vacío · o contorno · d oscuro · m medio · l claro · w brillo · f relleno translúcido ----------
const SPR = {
  bubble: [[
    '..oooo..',
    '.offffo.',
    'ofwwfffo',
    'ofwffffo',
    'offffflo',
    'offfffmo',
    '.offmmo.',
    '..oooo..']],
  flame: [[
    '...o....',
    '..olo...',
    '..olmo..',
    '.omlwmo.',
    '.omwwlmo',
    'omlwwwlo',
    'omwwwwmo',
    'odmlwmdo',
    '.oddmdo.',
    '..oooo..'], [
    '....o...',
    '...olo..',
    '..omlo..',
    '.omwlmo.',
    'omlwwmo.',
    'omwwwlmo',
    'omwwwwmo',
    'odmwlmdo',
    '.odmddo.',
    '..oooo..'], [
    '...o....',
    '..oo.o..',
    '..olmlo.',
    '.omlwmo.',
    '.omwwlmo',
    'omlwwwmo',
    'omwwwwlo',
    'odmlwmdo',
    '.oddmdo.',
    '..oooo..']],
  leaf: [[
    '...oooo.',
    '..ollmmo',
    '.olmmmdo',
    'olmmmddo',
    'odmmddo.',
    'oddddo..',
    '.oooo...']],
  shard: [[
    '..o..',
    '.olo.',
    '.owo.',
    'olwmo',
    'olwmo',
    'olmmo',
    '.omo.',
    '.odo.',
    '..o..']],
  orb: [[
    '...oooo...',
    '..ommmmo..',
    '.omllmmdo.',
    'omlwwlmmdo',
    'omlwlmmmdo',
    'ommlmmmddo',
    'ommmmmmddo',
    '.ommmmddo.',
    '..odddo...',
    '...ooo....']],
  rock: [[
    '..oooo.',
    '.ollmmo',
    'olmmmdo',
    'ommmddo',
    'odmddo.',
    '.oooo..']],
  dust: [[
    '..ooo...',
    '.olllo..',
    'olllllo.',
    'ollmlllo',
    '.ommmmlo',
    '..ooooo.'], [
    '.ooo.ooo.',
    'olllolllo',
    'ollllmllo',
    '.ommmmmo.',
    '..ooooo..']],
  sparkle: [[
    '..o..',
    '..w..',
    'owlwo',
    '..w..',
    '..o..'], [
    '.....',
    '..l..',
    '.lwl.',
    '..l..',
    '.....']],
  wind: [[
    '.......oooo',
    '....oollll.',
    '..oollw....',
    '.olw.......',
    'olo........']],
  needle: [[
    '.........oo',
    '......ooloo',
    '...oollwo..',
    'oollmmoo...',
    'oddoo......']],
  slash: [[
    '..........o',
    '........oll',
    '......olwo.',
    '....olwo...',
    '..olmo.....',
    'oddo.......']],
  // chispa de descarga eléctrica (Impactrueno): un zigzag corto
  spark: [[
    '..oo.',
    '.owo.',
    '.ow..',
    'owwo.',
    '.owo.',
    '..ow.',
    '..o..'], [
    '.oo..',
    '.owo.',
    '..wo.',
    '.owwo',
    '.owo.',
    'ow...',
    'o....']],
  // la Bola Sombra: núcleo negro, borde morado y jirones (dos fotogramas, gira)
  shadowball: [[
    '....oooo....',
    '..oomllmoo..',
    '.omldddddmo.',
    '.oldddddddlo',
    'omdddoodddmo',
    'oldddoowddlo',
    'olddddoodd.o',
    'omdddddddmo.',
    '.oldddddddlo',
    '.omldddddmo.',
    '..oomllmoo..',
    '....oooo....'], [
    '....oooo....',
    '..oomllmoo..',
    '.omdddddlmo.',
    'oldddddddlo.',
    'omdddoodddmo',
    'olddwoodddlo',
    'olddoodddmlo',
    '.omdddddddmo',
    'oldddddddlo.',
    '.omdddddlmo.',
    '..oomllmoo..',
    '....oooo....']],
  // el destello de golpe clásico: estrella que se abre y se apaga
  hit: [[
    '.....',
    '..w..',
    '.wlw.',
    '..w..',
    '.....'], [
    '....o....',
    '....w....',
    '...owo...',
    '.oolwloo.',
    'owwwwwwwo',
    '.oolwloo.',
    '...owo...',
    '....w....',
    '....o....'], [
    'o.......o',
    '.o..w..o.',
    '..o.l.o..',
    '...lwl...',
    '.wlw.wlw.',
    '...lwl...',
    '..o.l.o..',
    '.o..w..o.',
    'o.......o'], [
    'l.......l',
    '.........',
    '....m....',
    '.........',
    '.m.....m.',
    '.........',
    '....m....',
    '.........',
    'l.......l']],
};
// el rayo (Impactrueno, Trueno…): un segmento en zigzag; se apilan varios
const BOLT = [
  '...ooo',
  '..owlo',
  '..owo.',
  '.owlo.',
  '.owwwo',
  'ooolwo',
  '..owo.',
  '.owlo.',
  '.owo..',
  'owlo..',
  'owwwoo',
  '.olwo.',
  '.owo..',
  'owo...',
  'oo....'];

// cada sprite, coloreado con la paleta, se dibuja una vez en un lienzo pequeño y se reutiliza
const cache = new Map();
function sprite(name, pal, frame = 0) {
  const frames = name === 'bolt' ? [BOLT] : SPR[name] || SPR.hit, rows = frames[frame % frames.length];
  const key = name + '|' + pal.join() + '|' + (frame % frames.length); if (cache.has(key)) return cache.get(key);
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), col = { o: pal[0], d: pal[1], m: pal[2], l: pal[3], w: pal[4], f: pal[3] };
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.' || !col[ch]) return; g.globalAlpha = ch === 'f' ? 0.38 : 1; g.fillStyle = col[ch]; g.fillRect(x, y, 1, 1); }));
  cache.set(key, c); return c;
}
// dibujar un sprite centrado, a escala de píxel entera (nítido), girado o volteado si hace falta
function blit(ctx, name, pal, frame, x, y, ps, rot = 0, flip = false) {
  const c = sprite(name, pal, frame); ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(Math.round(x), Math.round(y));
  if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(c, -Math.round(c.width * ps / 2), -Math.round(c.height * ps / 2), c.width * ps, c.height * ps); ctx.restore();
}

// qué sprite usa cada tipo para viajar y para estallar
const LOOK = {
  'Normal': ['hit', 'hit'], 'Fuego': ['flame', 'flame'], 'Agua': ['bubble', 'bubble'], 'Planta': ['leaf', 'leaf'],
  'Eléctrico': ['sparkle', 'sparkle'], 'Hielo': ['shard', 'shard'], 'Lucha': ['hit', 'hit'], 'Veneno': ['bubble', 'bubble'],
  'Tierra': ['rock', 'dust'], 'Volador': ['wind', 'wind'], 'Psíquico': ['orb', 'sparkle'], 'Bicho': ['needle', 'needle'],
  'Roca': ['rock', 'rock'], 'Fantasma': ['orb', 'orb'], 'Dragón': ['orb', 'sparkle'], 'Siniestro': ['slash', 'slash'],
  'Acero': ['sparkle', 'sparkle'], 'Hada': ['sparkle', 'sparkle'],
};
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------- crear el efecto de un movimiento (user y targets en casillas) → { impactDelay(target) } ----------
export function spawnMoveFx(move, user, targets) {
  const type = PAL[move.type] ? move.type : 'Normal', t0 = now(), seed = (Math.random() * 1e9) | 0;
  const cat = move.cat, range = move.range || 'front', power = move.power || 0;
  const add = fx => { fxs.push({ type, t0, seed, ...fx }); busyUntil = Math.max(busyUntil, t0 + (fx.delay || 0) + fx.dur); };
  const dist = t => Math.max(Math.abs(t.x - user.x), Math.abs(t.y - user.y));
  const delays = new Map();
  const SIGNATURE = { 'Impactrueno': 'crackle', 'Chispa': 'crackle', 'Rayo': 'crackle', 'Trueno': 'thunder', 'Bola Sombra': 'shadowball', 'Psíquico': 'psywave', 'Confusión': 'psywave', 'Psicorrayo': 'psywave' };
  const sig = SIGNATURE[move.name];
  if (sig && range !== 'self' && range !== 'team') {
    const fx0 = user.facing?.[0] ?? 0, fy0 = user.facing?.[1] ?? 1, tg = targets.length ? targets : [{ x: user.x + fx0, y: user.y + fy0 }];
    if (sig === 'crackle') {   // descarga sobre el objetivo: chispas que saltan a su alrededor, con destello
      for (const t of tg) { add({ kind: 'crackle', at: { x: t.x, y: t.y }, dur: 700 }); delays.set(t, 140); }
    } else if (sig === 'thunder') {   // ¡el rayo cae del cielo!
      for (const t of tg) { add({ kind: 'strike', at: { x: t.x, y: t.y }, dur: 460 }); add({ kind: 'crackle', at: { x: t.x, y: t.y }, dur: 380, delay: 200 }); delays.set(t, 200); }
    } else if (sig === 'shadowball') {   // se carga delante del usuario, viaja despacio y estalla en sombra
      const t = tg[0], travel = Math.max(320, dist(t) * 120);
      add({ kind: 'shadowball', from: { x: user.x, y: user.y }, to: { x: t.x, y: t.y }, dur: 300 + travel, charge: 300 });
      for (const tt of targets) { delays.set(tt, 300 + travel); add({ kind: 'darkburst', at: { x: tt.x, y: tt.y }, dur: 460, delay: 300 + travel }); }
    } else if (sig === 'psywave') {   // el objetivo queda envuelto en ondas psíquicas que laten
      for (const t of tg) { add({ kind: 'psywave', at: { x: t.x, y: t.y }, dur: 760 }); delays.set(t, 260); }
    }
    return { impactDelay: t => delays.get(t) ?? 0 };
  }
  if (range === 'self' || range === 'team') {   // sube algo: chispas que ascienden alrededor
    const who = range === 'team' && targets.length ? targets : [user];
    for (const w of who) { add({ kind: 'rise', at: { x: w.x, y: w.y }, dur: 800 }); delays.set(w, 300); }
  } else if (range === 'room') {   // a toda la sala: temblor y polvo (Terremoto) o el tipo esparcido, y golpe en cada uno
    if (type === 'Tierra' || type === 'Roca') shake = { t0, ms: 700, amp: 4 };
    for (const t of targets) { const d = 120 + dist(t) * 50; delays.set(t, d); add({ kind: 'burst', at: { x: t.x, y: t.y }, dur: 460, delay: d, phys: cat === 'phys' }); }
    add({ kind: 'scatter', at: { x: user.x, y: user.y }, dur: 700 });
  } else if (range === 'around') {
    add({ kind: 'scatter', at: { x: user.x, y: user.y }, dur: 500, near: true });
    for (const t of targets) { delays.set(t, 150); add({ kind: 'burst', at: { x: t.x, y: t.y }, dur: 420, delay: 150, phys: cat === 'phys' }); }
  } else {
    const reach = range === 'line' ? Math.min(6, move.dist || 6) : 1, fx0 = user.facing?.[0] ?? 0, fy0 = user.facing?.[1] ?? 1;
    const tgt = targets[0] || { x: user.x + fx0 * reach, y: user.y + fy0 * reach };
    if (cat === 'status' && power === 0) {   // de estado sobre el rival: anillos del tipo que viajan hasta él
      const d = Math.max(260, dist(tgt) * 90);
      add({ kind: 'rings', from: { x: user.x, y: user.y }, to: { x: tgt.x, y: tgt.y }, dur: d + 300 });
      for (const t of targets) delays.set(t, d + 100);
    } else if (type === 'Eléctrico' && cat === 'spec') {   // eléctricos: el rayo cae del cielo sobre el objetivo
      for (const t of targets.length ? targets : [tgt]) { delays.set(t, 180); add({ kind: 'strike', at: { x: t.x, y: t.y }, dur: 420 }); add({ kind: 'burst', at: { x: t.x, y: t.y }, dur: 380, delay: 180 }); }
    } else if (cat === 'spec' || range === 'line') {   // proyectil (o chorro de partículas, si es potente)
      const travel = Math.max(220, dist(tgt) * 80), stream = power >= 80 && LOOK[type][0] !== 'orb';   // las bolas (Bola Sombra…) viajan solas
      add({ kind: stream ? 'stream' : 'shot', from: { x: user.x, y: user.y }, to: { x: tgt.x, y: tgt.y }, dur: travel + (stream ? 260 : 0) });
      for (const t of targets) { delays.set(t, travel); add({ kind: 'burst', at: { x: t.x, y: t.y }, dur: 420, delay: travel, big: stream }); }
    } else {   // contacto: el destello de golpe en el objetivo
      if (power >= 90) shake = { t0: t0 + 150, ms: 280, amp: 3 };
      for (const t of targets) { delays.set(t, 150); add({ kind: 'burst', at: { x: t.x, y: t.y }, dur: 330, delay: 150, phys: true }); }
    }
  }
  return { impactDelay: t => delays.get(t) ?? 0 };
}

// ---------- dibujar (lienzo de la mazmorra; toScreen(x, y) = centro de esa casilla en pantalla) ----------
export function drawMoveFx(ctx, toScreen, tile) {
  const t = now();
  for (let i = fxs.length - 1; i >= 0; i--) if (t - fxs[i].t0 - (fxs[i].delay || 0) > fxs[i].dur) fxs.splice(i, 1);
  const ps = Math.max(1, Math.round(tile / 24));   // cada píxel del efecto, del tamaño de un píxel del sprite del Pokémon (como en el original)
  for (const fx of fxs) {
    const el = t - fx.t0 - (fx.delay || 0); if (el < 0) continue;
    const k = Math.min(1, el / fx.dur), pal = PAL[fx.type], [move, burst] = LOOK[fx.type], R = rng(fx.seed), fr = Math.floor(el / FRAME);
    if (fx.kind === 'shot' || fx.kind === 'stream' || fx.kind === 'rings') {
      const [x0, y0] = toScreen(fx.from.x, fx.from.y), [x1, y1] = toScreen(fx.to.x, fx.to.y), ang = Math.atan2(y1 - y0, x1 - x0);
      const spin = move === 'leaf' || move === 'rock' || move === 'shard' ? fr * (Math.PI / 4) : (move === 'wind' || move === 'needle' || move === 'slash' ? ang : 0);
      if (fx.kind === 'shot') {   // tres sprites que viajan juntos, con un leve vaivén
        const n = move === 'orb' ? 1 : 2;
        for (let j = 0; j < n; j++) { const q = Math.max(0, k - j * 0.08), wob = Math.sin(el / 60 + j * 2) * 2 * ps;
          blit(ctx, move, pal, fr + j, x0 + (x1 - x0) * q - Math.sin(ang) * wob, y0 + (y1 - y0) * q + Math.cos(ang) * wob, ps, spin); }
      } else if (fx.kind === 'stream') {   // chorro (Lanzallamas, Rayo Hielo, Hidrobomba…): sprites en fila que avanzan
        const grow = Math.min(1, el / Math.max(1, fx.dur - 260)), L = Math.hypot(x1 - x0, y1 - y0) || 1, step = 9 * ps, off = (el / 12) % step;
        for (let s = off; s < L * grow; s += step) { const q = s / L, wob = Math.sin(s / 9 + el / 70) * 1.5 * ps; blit(ctx, move, pal, fr + Math.floor(s / step), x0 + (x1 - x0) * q - Math.sin(ang) * wob, y0 + (y1 - y0) * q + Math.cos(ang) * wob, ps, spin); }
      } else {   // anillos (Hipnosis, Látigo…): círculos de píxeles que viajan hasta el objetivo
        const travel = fx.dur - 300;
        for (let j = 0; j < 3; j++) { if (el - j * 80 < 0) continue; const q = Math.min(1, (el - j * 80) / travel);
          pixelRing(ctx, x0 + (x1 - x0) * q, y0 + (y1 - y0) * q - 4 * ps, (3 + j) * ps, ps, pal, q >= 1 ? Math.max(0, 1 - (el - travel) / 300) : 1); }
      }
    } else {
      const [cx, cy] = fx.at ? toScreen(fx.at.x, fx.at.y) : [0, 0];   // (la Bola Sombra no tiene sitio fijo: viaja)
      if (fx.kind === 'burst') {   // impacto: sprites del tipo que salen hacia fuera y, si es de contacto, el destello de golpe
        if (fx.phys || burst === 'hit') blit(ctx, 'hit', HIT, Math.min(3, Math.floor(el / 70)), cx, cy - 2 * ps, ps);
        if (burst !== 'hit') { const n = fx.big ? 4 : 3;
          for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2 + R() * 0.6, sp = (4 + 9 * k) * ps; if (k > 0.85 && fr % 2) continue;
            blit(ctx, burst, pal, fr + j, cx + Math.cos(a) * sp, cy + Math.sin(a) * sp * 0.75 - (burst === 'flame' || burst === 'dust' ? 3 * k * ps : 0), ps, burst === 'leaf' || burst === 'rock' || burst === 'shard' ? fr * 0.8 + j : 0); } }
      } else if (fx.kind === 'crackle') {   // Impactrueno: chispas en zigzag que saltan alrededor del objetivo y un destello blanco
        if (fr < 3) blit(ctx, 'hit', pal, fr, cx, cy - 3 * ps, ps + 1);   // destello amarillo
        // crepita sin parar (cada fotograma, chispas nuevas)
        for (let j = 0; j < (k < 0.7 ? 8 : 4); j++) { const a = j / 8 * Math.PI * 2 + fr * 0.9 + R(), d = (4 + R() * 8) * ps;
          blit(ctx, 'spark', pal, fr + j, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8 - 3 * ps, ps + 1, (R() - 0.5) * 1.4, R() < 0.5); }
      } else if (fx.kind === 'shadowball') {   // la Bola Sombra: crece delante del usuario, viaja despacio con estela de jirones
        const [x0, y0] = toScreen(fx.from.x, fx.from.y), [x1, y1] = toScreen(fx.to.x, fx.to.y), L = Math.hypot(x1 - x0, y1 - y0) || 1;
        const ux = (x1 - x0) / L, uy = (y1 - y0) / L, startX = x0 + ux * 8 * ps, startY = y0 + uy * 8 * ps - 4 * ps;
        if (el < fx.charge) {   // la carga: una bola pequeña que crece y unos jirones que se juntan
          const g = el / fx.charge, sc = Math.max(1, Math.round(ps * (0.4 + 0.6 * g)));
          for (let j = 0; j < 4; j++) { const a = j / 4 * Math.PI * 2 + el / 90, d = (1 - g) * 12 * ps; blit(ctx, 'orb', PAL['Fantasma'], fr, startX + Math.cos(a) * d, startY + Math.sin(a) * d, Math.max(1, ps - 1)); }
          blit(ctx, 'shadowball', pal, fr, startX, startY, sc);
        } else {
          const q = Math.min(1, (el - fx.charge) / (fx.dur - fx.charge)), bx = startX + (x1 - startX) * q, by = startY + (y1 - 4 * ps - startY) * q;
          for (let j = 1; j <= 3; j++) blit(ctx, 'orb', PAL['Fantasma'], fr + j, bx - ux * j * 6 * ps, by - uy * j * 6 * ps, Math.max(1, ps - 1));   // estela
          blit(ctx, 'shadowball', pal, fr, bx, by, ps);
        }
      } else if (fx.kind === 'darkburst') {   // estalla en sombra: un anillo oscuro que se abre y jirones que salen
        pixelRing(ctx, cx, cy - 3 * ps, (3 + 9 * k) * ps, ps, pal, 1 - k);
        for (let j = 0; j < 5; j++) { const a = j / 5 * Math.PI * 2 + R(), d = (2 + 10 * k) * ps; if (k > 0.8 && fr % 2) continue; blit(ctx, 'orb', PAL['Fantasma'], fr + j, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75 - 3 * ps, Math.max(1, ps - 1)); }
      } else if (fx.kind === 'psywave') {   // Psíquico: anillos rosas que salen del objetivo y laten (el aire se deforma)
        for (let j = 0; j < 3; j++) { const ph = ((el / 260) + j / 3) % 1; if (el < j * 120) continue;
          lightRing(ctx, cx, cy - 4 * ps, (2 + ph * 12) * ps, ps, pal, (1 - ph * 0.7) * (1 - Math.max(0, (k - 0.75) / 0.25))); }
        if (fr % 2 === 0 && k < 0.8) blit(ctx, 'sparkle', pal, fr, cx + Math.sin(el / 50) * 5 * ps, cy - 8 * ps, ps);
      } else if (fx.kind === 'strike') {   // el rayo cae del cielo: segmentos en zigzag apilados, que parpadean
        if (k < 0.7 && fr % 3 !== 2) { const seg = BOLT.length * ps;
          for (let j = 0; j < 3; j++) blit(ctx, 'bolt', pal, 0, cx + (j % 2 ? 2 : -2) * ps, cy - seg * (j + 0.5), ps, 0, j % 2 === 1); }
      } else if (fx.kind === 'rise') {   // sube una estadística: chispas que ascienden alrededor
        for (let j = 0; j < 5; j++) { const ph = (el / fx.dur * 1.3 + R()) % 1, px = cx + (R() - 0.5) * 14 * ps, py = cy + 6 * ps - ph * 20 * ps;
          if ((fr + j) % 4 === 3) continue; blit(ctx, move === 'flame' || move === 'bubble' || move === 'leaf' ? move : 'sparkle', pal, fr + j, px, py, ps); }
      } else if (fx.kind === 'scatter') {   // por toda la zona (Terremoto: polvo; otros: sprites del tipo)
        const n = fx.near ? 5 : 9, reach = (fx.near ? 1.3 : 4.5) * tile;
        for (let j = 0; j < n; j++) { const a = R() * Math.PI * 2, d = R() * reach, ph = el / fx.dur + R() * 0.5;
          if (ph > 1 || (fr + j) % 3 === 2) continue; blit(ctx, burst, pal, fr + j, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7 - ph * 6 * ps, ps); }
      }
    }
  }
  return fxs.length > 0 || !!shake;
}
// un anillo de píxeles (sin difuminar), con contorno
function lightRing(ctx, cx, cy, r, ps, pal, a) {
  ctx.save(); const R = Math.max(2, Math.round(r / ps)), n = Math.max(16, R * 5);
  for (let i = 0; i < n; i++) { const ang = i / n * Math.PI * 2, x = Math.round(Math.cos(ang) * R) * ps, y = Math.round(Math.sin(ang) * R * 0.7) * ps;
    ctx.globalAlpha = a * 0.55; ctx.fillStyle = pal[2]; ctx.fillRect(Math.round(cx + x - ps), Math.round(cy + y - ps), ps * 2, ps * 2);
    ctx.globalAlpha = a; ctx.fillStyle = i % 3 ? pal[3] : pal[4]; ctx.fillRect(Math.round(cx + x), Math.round(cy + y), ps, ps); }
  ctx.restore();
}
function pixelRing(ctx, cx, cy, r, ps, pal, a) {
  ctx.save(); ctx.globalAlpha = a; const R = Math.round(r / ps);
  for (let i = 0; i < 24; i++) { const ang = i / 24 * Math.PI * 2, x = Math.round(Math.cos(ang) * R) * ps, y = Math.round(Math.sin(ang) * R * 0.75) * ps;
    ctx.fillStyle = pal[0]; ctx.fillRect(Math.round(cx + x - ps), Math.round(cy + y - ps), ps * 3, ps * 3); ctx.fillStyle = i % 2 ? pal[2] : pal[3]; ctx.fillRect(Math.round(cx + x), Math.round(cy + y), ps, ps); }
  ctx.restore();
}
