// Efectos visuales de los movimientos (como en Mundo Misterioso): cada TIPO tiene su estilo (burbujas, llamas, hojas,
// rayos…) y cada ALCANCE su forma (impacto de frente, proyectil o rayo en línea, onda en la sala, anillo alrededor,
// aura sobre uno mismo). Se dibujan con partículas en el lienzo de la mazmorra, en coordenadas de casilla.
// spawnMoveFx() devuelve cuándo llega el golpe a cada objetivo, para que el daño, el gesto de dolor y el sonido
// salgan en el momento del impacto y no al pulsar.

const now = () => performance.now();
const fxs = [];
let busyUntil = 0;
export const fxEndTime = () => busyUntil;
export const fxActive = () => fxs.length > 0;

// ---------- estilos por tipo: colores y forma de las partículas ----------
const STYLE = {
  'Normal':    { c: ['#ffffff', '#fff6d8', '#c8c0a8'], p: 'star' },
  'Fuego':     { c: ['#ff7a1a', '#ffd34a', '#c22a10'], p: 'flame' },
  'Agua':      { c: ['#5ab4ff', '#d8f2ff', '#2a6ad0'], p: 'bubble' },
  'Planta':    { c: ['#5ad04a', '#c8f5a0', '#2a8a2a'], p: 'leaf' },
  'Eléctrico': { c: ['#ffe23a', '#fffbd0', '#e0a000'], p: 'bolt' },
  'Hielo':     { c: ['#9fe8ff', '#ffffff', '#4ab0e0'], p: 'shard' },
  'Lucha':     { c: ['#ff9a4a', '#ffe0b0', '#c04a20'], p: 'star' },
  'Veneno':    { c: ['#b25ae0', '#e8b8ff', '#6a2a90'], p: 'bubble' },
  'Tierra':    { c: ['#c8964a', '#ecd2a0', '#7a5220'], p: 'rock' },
  'Volador':   { c: ['#e8f4ff', '#ffffff', '#8ab8e0'], p: 'wind' },
  'Psíquico':  { c: ['#ff6ac0', '#ffd0ec', '#c0308a'], p: 'ring' },
  'Bicho':     { c: ['#a8d02a', '#e8f8a0', '#5a8a10'], p: 'needle' },
  'Roca':      { c: ['#a89878', '#e0d4b8', '#6a5a40'], p: 'rock' },
  'Fantasma':  { c: ['#8a6ae0', '#d8c8ff', '#4a2a8a'], p: 'wisp' },
  'Dragón':    { c: ['#6a7aff', '#c8d0ff', '#3a2ab0'], p: 'swirl' },
  'Siniestro': { c: ['#4a3a5a', '#a890c0', '#1a1020'], p: 'slash' },
  'Acero':     { c: ['#c8d4e0', '#ffffff', '#7a8a9a'], p: 'glint' },
  'Hada':      { c: ['#ff9ad8', '#fff0fa', '#e05aa8'], p: 'sparkle' },
};
const styleOf = type => STYLE[type] || STYLE.Normal;

// generador pseudoaleatorio fijo por efecto (las partículas no parpadean de un fotograma a otro)
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------- cada partícula, según su forma ----------
function particle(ctx, kind, x, y, r, rot, st, a = 1) {
  const [main, light, dark] = st.c;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= a;
  switch (kind) {
    case 'bubble': {   // burbuja: borde, relleno translúcido y brillo
      ctx.fillStyle = main + '55'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.strokeStyle = light; ctx.lineWidth = Math.max(1, r * 0.22); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.28, 0, 7); ctx.fill(); break;
    }
    case 'flame': {   // llama: gota que apunta hacia arriba, con núcleo claro
      const g = ctx.createRadialGradient(0, r * 0.3, 0, 0, 0, r * 1.3); g.addColorStop(0, light); g.addColorStop(0.45, main); g.addColorStop(1, dark + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -r * 1.5); ctx.quadraticCurveTo(r * 1.1, -r * 0.1, 0, r); ctx.quadraticCurveTo(-r * 1.1, -r * 0.1, 0, -r * 1.5); ctx.fill(); break;
    }
    case 'leaf': {   // hoja: dos arcos y el nervio
      ctx.fillStyle = main; ctx.beginPath(); ctx.moveTo(-r * 1.3, 0); ctx.quadraticCurveTo(0, -r, r * 1.3, 0); ctx.quadraticCurveTo(0, r, -r * 1.3, 0); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r * 1.1, 0); ctx.lineTo(r * 1.1, 0); ctx.stroke(); break;
    }
    case 'bolt': case 'glint': case 'sparkle': case 'star': {   // estrella de cuatro puntas (chispa, destello, brillo)
      const k = kind === 'star' ? 0.42 : 0.28;
      ctx.fillStyle = kind === 'glint' ? light : main; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4, rr = i % 2 ? r * k : r * 1.35; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
      ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, 7); ctx.fill(); break;
    }
    case 'shard': {   // esquirla de hielo
      ctx.fillStyle = main; ctx.beginPath(); ctx.moveTo(0, -r * 1.6); ctx.lineTo(r * 0.55, 0); ctx.lineTo(0, r * 1.6); ctx.lineTo(-r * 0.55, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(0, -r * 1.4); ctx.lineTo(r * 0.25, 0); ctx.lineTo(0, r * 0.4); ctx.closePath(); ctx.fill(); break;
    }
    case 'rock': {   // piedra o terrón
      ctx.fillStyle = dark; ctx.beginPath(); for (let i = 0; i < 6; i++) { const ang = i / 6 * Math.PI * 2, rr = r * (0.8 + ((i * 37) % 5) * 0.08); ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = main; ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.15, r * 0.6, 0, 7); ctx.fill(); break;
    }
    case 'wind': {   // ráfaga: arco blanco
      ctx.strokeStyle = light; ctx.lineWidth = Math.max(1.5, r * 0.35); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r * 1.4, -0.9, 0.9); ctx.stroke(); break;
    }
    case 'needle': {   // aguja o púa
      ctx.strokeStyle = main; ctx.lineWidth = Math.max(1.5, r * 0.4); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 1.4, 0); ctx.lineTo(r * 1.4, 0); ctx.stroke();
      ctx.fillStyle = light; ctx.beginPath(); ctx.arc(r * 1.4, 0, r * 0.3, 0, 7); ctx.fill(); break;
    }
    case 'wisp': {   // espectro: llama fría que ondula
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.5); g.addColorStop(0, light); g.addColorStop(0.5, main + 'cc'); g.addColorStop(1, dark + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 1.5, 0, 0, 7); ctx.fill(); break;
    }
    case 'slash': {   // tajo oscuro
      ctx.strokeStyle = dark; ctx.lineWidth = Math.max(2, r * 0.5); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r * 1.6, -2.4, -0.7); ctx.stroke();
      ctx.strokeStyle = light; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r * 1.6, -2.3, -0.8); ctx.stroke(); break;
    }
    case 'swirl': case 'ring': {   // remolino o anillo
      ctx.strokeStyle = main; ctx.lineWidth = Math.max(1.5, r * 0.3); ctx.beginPath(); ctx.arc(0, 0, r, 0, kind === 'swirl' ? 4.6 : 7); ctx.stroke();
      ctx.strokeStyle = light; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, kind === 'swirl' ? 4.6 : 7); ctx.stroke(); break;
    }
    default: ctx.fillStyle = main; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function glow(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, color.slice(0, 7) + '00');
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
}
// rayo eléctrico: zigzag entre dos puntos (cambia de forma a cada instante)
function zigzag(ctx, x0, y0, x1, y1, color, w, seed) {
  const R = rng(seed + Math.floor(now() / 45)), n = 7, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0);
  for (let i = 1; i < n; i++) { const k = i / n, off = (R() - 0.5) * Math.min(14, L * 0.25); ctx.lineTo(x0 + dx * k + nx * off, y0 + dy * k + ny * off); }
  ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
}

// ---------- crear el efecto de un movimiento ----------
// user y targets en casillas ({x, y}); devuelve { impactDelay(target) } en milisegundos
export function spawnMoveFx(move, user, targets) {
  const st = styleOf(move.type), t0 = now(), seed = (Math.random() * 1e9) | 0;
  const cat = move.cat, range = move.range || 'front', power = move.power || 0;
  const add = fx => { fxs.push({ st, t0, seed, ...fx }); busyUntil = Math.max(busyUntil, t0 + fx.dur); };
  const dist = t => Math.max(Math.abs(t.x - user.x), Math.abs(t.y - user.y));
  const delays = new Map();
  if (range === 'self' || range === 'team') {   // aura que sube (subir estadísticas, curarse…)
    const who = range === 'team' && targets.length ? targets : [user];
    for (const w of who) { add({ kind: 'aura', at: { x: w.x, y: w.y }, dur: 900 }); delays.set(w, 250); }
  } else if (range === 'room') {   // onda que recorre la sala
    add({ kind: 'wave', at: { x: user.x, y: user.y }, dur: 900, reach: 7 });
    for (const t of targets) { const d = 140 + dist(t) * 85; delays.set(t, d); add({ kind: 'impact', at: { x: t.x, y: t.y }, dur: 420, delay: d, phys: cat === 'phys' }); }
  } else if (range === 'around') {   // anillo alrededor del usuario
    add({ kind: 'ring', at: { x: user.x, y: user.y }, dur: 520 });
    for (const t of targets) { delays.set(t, 160); add({ kind: 'impact', at: { x: t.x, y: t.y }, dur: 400, delay: 160, phys: cat === 'phys' }); }
  } else {
    // de frente o en línea: contacto (impacto), proyectil o rayo (los especiales potentes)
    const reach = range === 'line' ? Math.min(6, move.dist || 6) : 1, fx0 = user.facing?.[0] ?? 0, fy0 = user.facing?.[1] ?? 1;   // sin objetivo: hacia donde mira (los de frente, la casilla de delante)
    const tgt = targets[0] || { x: user.x + fx0 * reach, y: user.y + fy0 * reach };
    const far = dist(tgt) > 1 || range === 'line', ranged = cat === 'spec' || range === 'line';
    if (cat === 'status' && power === 0) {   // de estado sobre el rival: un hechizo que lo envuelve
      const d = far ? Math.min(420, 120 + dist(tgt) * 70) : 120;
      if (far) add({ kind: 'projectile', from: { x: user.x, y: user.y }, to: { x: tgt.x, y: tgt.y }, dur: d, small: true });
      add({ kind: 'hex', at: { x: tgt.x, y: tgt.y }, dur: 750, delay: d });
      for (const t of targets) delays.set(t, d + 150);
    } else if (ranged && (far || cat === 'spec')) {
      const travel = Math.min(520, Math.max(240, dist(tgt) * 80));
      const beam = cat === 'spec' && power >= 80 && range === 'line';
      add({ kind: beam ? 'beam' : 'projectile', from: { x: user.x, y: user.y }, to: { x: tgt.x, y: tgt.y }, dur: beam ? travel + 380 : travel });
      for (const t of targets) { delays.set(t, travel); add({ kind: 'impact', at: { x: t.x, y: t.y }, dur: 420, delay: travel, phys: false, big: power >= 80 }); }
    } else {   // contacto: el golpe llega cuando el atacante se lanza
      for (const t of targets) { delays.set(t, 150); add({ kind: 'impact', at: { x: t.x, y: t.y }, dur: 430, delay: 150, phys: true, big: power >= 80 }); }
    }
  }
  return { impactDelay: t => delays.get(t) ?? 0 };
}

// ---------- dibujar (en el lienzo de la mazmorra; toScreen(x, y) da el centro de esa casilla) ----------
export function drawMoveFx(ctx, toScreen, tile) {
  const t = now();
  for (let i = fxs.length - 1; i >= 0; i--) if (t - fxs[i].t0 - (fxs[i].delay || 0) > fxs[i].dur) fxs.splice(i, 1);
  for (const fx of fxs) {
    const el = t - fx.t0 - (fx.delay || 0); if (el < 0) continue;
    const k = Math.min(1, el / fx.dur), st = fx.st, R = rng(fx.seed), u = tile / 24;
    ctx.save();
    if (fx.kind === 'projectile' || fx.kind === 'beam') {
      const [x0, y0] = toScreen(fx.from.x, fx.from.y), [x1, y1] = toScreen(fx.to.x, fx.to.y);
      if (fx.kind === 'beam') {   // rayo: crece hasta el objetivo, se mantiene y se apaga
        const grow = Math.min(1, el / (fx.dur - 380)), fadeK = Math.max(0, (el - (fx.dur - 380)) / 380), hx = x0 + (x1 - x0) * grow, hy = y0 + (y1 - y0) * grow;
        const w = (6 + Math.sin(t / 40) * 1.5) * u * (1 - fadeK * 0.8);
        ctx.globalAlpha = 1 - fadeK;
        if (st.p === 'bolt') zigzag(ctx, x0, y0, hx, hy, st.c[0], 4 * u, fx.seed);
        else { ctx.lineCap = 'round'; ctx.strokeStyle = st.c[2] + 'aa'; ctx.lineWidth = w * 1.7; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(hx, hy); ctx.stroke();
               ctx.strokeStyle = st.c[0]; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(hx, hy); ctx.stroke();
               ctx.strokeStyle = st.c[1]; ctx.lineWidth = w * 0.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(hx, hy); ctx.stroke(); }
        for (let j = 0; j < 10; j++) { const q = (R() + t / 900) % 1; if (q > grow) continue; particle(ctx, st.p, x0 + (x1 - x0) * q + (R() - 0.5) * 10 * u, y0 + (y1 - y0) * q + (R() - 0.5) * 10 * u, (2 + R() * 2) * u, R() * 6 + t / 200, st, 0.9); }
        glow(ctx, hx, hy, 14 * u, st.c[1], 0.8 * (1 - fadeK));
      } else {   // proyectil: un racimo de partículas con estela
        const hx = x0 + (x1 - x0) * k, hy = y0 + (y1 - y0) * k, ang = Math.atan2(y1 - y0, x1 - x0);
        if (st.p === 'bolt') zigzag(ctx, x0 + (x1 - x0) * Math.max(0, k - 0.35), y0 + (y1 - y0) * Math.max(0, k - 0.35), hx, hy, st.c[0], 3 * u, fx.seed);
        const n = fx.small ? 3 : 6;
        for (let j = 0; j < n; j++) {
          const lag = j * 0.05, kk = Math.max(0, k - lag), px = x0 + (x1 - x0) * kk + Math.sin(t / 70 + j * 1.7) * 3 * u, py = y0 + (y1 - y0) * kk + Math.cos(t / 80 + j) * 3 * u - (st.p === 'bubble' ? Math.sin(kk * Math.PI) * 6 * u : 0);
          particle(ctx, st.p, px, py, (fx.small ? 2.6 : 4.8 - j * 0.4) * u, ang + (st.p === 'leaf' || st.p === 'shard' || st.p === 'rock' ? t / 90 + j : 0), st, 1 - j * 0.1);
        }
        glow(ctx, hx, hy, 18 * u, st.c[1], 0.7); glow(ctx, hx, hy, 10 * u, '#ffffff', 0.5);
      }
    } else {
      const [cx, cy] = toScreen(fx.at.x, fx.at.y);
      if (fx.kind === 'impact') {   // impacto: destello, partículas que salen disparadas y, si es de contacto, unas líneas de golpe
        const big = fx.big ? 1.35 : 1;
        if (st.p === 'bolt' && k < 0.55) {   // ¡rayo! cae del cielo sobre el objetivo
          const a = 1 - k / 0.55; ctx.globalAlpha = a;
          zigzag(ctx, cx + 4 * u, cy - tile * 3.2, cx, cy, st.c[2], 6 * u, fx.seed); zigzag(ctx, cx + 4 * u, cy - tile * 3.2, cx, cy, st.c[0], 3.5 * u, fx.seed); zigzag(ctx, cx + 4 * u, cy - tile * 3.2, cx, cy, '#ffffff', 1.4 * u, fx.seed);
          glow(ctx, cx, cy, 26 * u, st.c[1], a * 0.8); ctx.globalAlpha = 1;
        }
        glow(ctx, cx, cy, (10 + 16 * k) * u * big, st.c[1], (1 - k) * 0.9);
        if (fx.phys) { ctx.strokeStyle = st.c[1]; ctx.globalAlpha = 1 - k; ctx.lineWidth = 2 * u; ctx.lineCap = 'round';
          for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2 + 0.3, r0 = (4 + 10 * k) * u * big, r1 = (9 + 16 * k) * u * big; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke(); }
          ctx.globalAlpha = 1; }
        const n = fx.big ? 10 : 7;
        for (let j = 0; j < n; j++) { const a = R() * Math.PI * 2, sp = (10 + R() * 14) * u * big, px = cx + Math.cos(a) * sp * k, py = cy + Math.sin(a) * sp * k - (st.p === 'flame' ? 6 * k * u : 0);
          particle(ctx, st.p, px, py, (2.6 + R() * 2) * u * (1 - k * 0.5), a + t / 150, st, 1 - k); }
      } else if (fx.kind === 'wave' || fx.kind === 'ring') {   // onda que se expande (sala) o anillo (alrededor)
        const reach = (fx.kind === 'wave' ? fx.reach : 1.6) * tile, r = reach * k;
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = st.c[0]; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
        ctx.strokeStyle = st.c[1]; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
        const n = fx.kind === 'wave' ? 18 : 10;
        for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2 + R() * 0.3; particle(ctx, st.p, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3 * u, a + t / 200, st, 1 - k); }
      } else if (fx.kind === 'aura') {   // aura: partículas que suben y un brillo a los pies
        const pulse = Math.sin(k * Math.PI);
        glow(ctx, cx, cy, 22 * u, st.c[0], pulse * 0.75); glow(ctx, cx, cy, 12 * u, st.c[1], pulse * 0.6);
        ctx.globalAlpha = pulse * 0.9; ctx.strokeStyle = st.c[1]; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.ellipse(cx, cy + 10 * u - k * 26 * u, 14 * u, 5 * u, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;   // un anillo que sube
        for (let j = 0; j < 14; j++) { const ph = (k * 1.6 + R()) % 1, px = cx + (R() - 0.5) * 26 * u, py = cy + 12 * u - ph * 34 * u;
          particle(ctx, st.p === 'bolt' || st.p === 'flame' || st.p === 'bubble' || st.p === 'leaf' ? st.p : 'sparkle', px, py, (2.6 + R()) * u, t / 300, st, Math.sin(ph * Math.PI) * (1 - k * 0.4)); }
      } else if (fx.kind === 'hex') {   // hechizo de estado: partículas que giran alrededor del objetivo y se cierran
        const r = (16 - 10 * k) * u;
        for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2 + t / 160; particle(ctx, st.p === 'bolt' ? 'sparkle' : st.p, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6, 2.4 * u, a, st, Math.sin(k * Math.PI)); }
        glow(ctx, cx, cy, 14 * u, st.c[1], Math.sin(k * Math.PI) * 0.5);
      }
    }
    ctx.restore();
  }
  return fxs.length > 0;
}
