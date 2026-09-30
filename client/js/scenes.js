// =====================================================================
// Motor de escenas: reproduce guiones (docs/ESCENAS.md) sobre la aldea, con las mismas piezas que el original:
// narración sobre negro, fundidos, actores que andan y giran, poses, efectos sobre la cabeza, diálogos con retrato,
// noche, cámara fija y acciones en paralelo. El jugador puede estar oculto («Mientras tanto…»). Start la salta.
// =====================================================================
import { drawEmote, EMOTE_LEN, EMOTE_HOLD } from './emotes.js';

const DIRS = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0], 'down-right': [1, 1], 'down-left': [-1, 1], 'up-right': [1, -1], 'up-left': [-1, -1] };
const FORM_SPECIES = ['meowth', 'cubone', 'smoochum', 'machop', 'charmander', 'clefairy', 'magby', 'teddiursa', 'totodile'];   // la silueta cambiante

let D = null;   // dependencias del juego (estado, render, diálogos, sprites…), las pasa game.js
export function initScenes(deps) { D = deps; }

const cut = () => D.state.cut;
const fast = () => !!(window.__mmFast || cut()?.skip);
const delay = ms => fast() ? Promise.resolve() : new Promise(r => setTimeout(r, ms));
const now = () => performance.now();

// ---------- reproducir un guion ----------
export async function playScene(scene) {
  const S = D.state, h = S.hub;
  if (S.cut) return;
  const saved = { area: h.area, x: h.x, y: h.y, facing: h.facing, menu: S.menu, dialog: S.dialog };
  S.menu = null; S.dialog = null;
  if (scene.area && scene.area !== h.area) h.area = scene.area;
  const c = S.cut = {
    id: scene.id, skip: false, night: !!scene.night, lights: scene.lights || [], hidePlayer: !!scene.hidePlayer, hideNpcs: !!scene.hideNpcs,
    fade: scene.startDark === false ? 0 : 1, narration: null, cam: scene.cam ? { ...scene.cam } : null,
    actors: {}, objects: {}, moving: [], lastSpeaker: null, seq: 0,
  };
  for (const [id, a] of Object.entries(scene.actors || {})) c.actors[id] = { id, sp: a.sp, x: a.x, y: a.y, facing: DIRS[a.dir || 'down'], hidden: !!a.hidden, anim: null, still: false, emotes: [], form: a.sp === 'sombra' };
  for (const [id, o] of Object.entries(scene.objects || {})) c.objects[id] = { id, ...o, alpha: 1 };
  c.actors.player = { id: 'player', isPlayer: true, emotes: [], get x() { return D.state.hub.x; }, get y() { return D.state.hub.y; }, get facing() { return D.state.hub.facing; }, set facing(v) { D.state.hub.facing = v; } };
  if (scene.music) D.music?.(scene.music);
  D.render();
  try { for (const step of scene.steps) { if (c.skip) break; await runStep(step, c); } }
  catch (e) { console.error('escena', scene.id, e); }
  // al acabar: se apaga todo lo que se mantenía y se vuelve a la aldea
  S.cut = null; h.area = saved.area; h.x = saved.x; h.y = saved.y; h.facing = saved.facing;
  if (scene.music) D.music?.(null);
  D.render();
}
export const skipScene = () => { const c = cut(); if (c) { c.skip = true; if (D.state.dialog) { D.state.dialog = null; c.dialogResolve?.(); } } };

async function runStep(step, c) {
  if (step.at) { await Promise.all(step.at.map(s => runStep(s, c))); return; }
  const who = step.who ? c.actors[step.who] : null;
  switch (step.do) {
    case 'wait': if (step.for) await waitActor(c.actors[step.for]); else await delay(step.ms || 0); return;
    case 'narration': return narration(c, step.text, step.ms || 2400);
    case 'fade': return fade(c, step.to, step.ms || 700);
    case 'set': if ('night' in step) c.night = !!step.night; if (step.cam) c.cam = { ...step.cam }; D.render(); return;
    case 'show': if (who) who.hidden = false; return;
    case 'hide': if (who) who.hidden = true; return;
    case 'turn': if (who) { who.facing = step.toward ? dirToward(who, c.actors[step.toward]) : DIRS[step.dir] || who.facing; D.render(); } return;
    case 'move': return move(c, who, step);
    case 'anim': return anim(who, step);
    case 'emote': return emote(c, who, step);
    case 'say': return say(c, who, step);
    case 'object': return object(c, c.objects[step.id], step.action, step.ms);
    case 'camera': c.cam = { x: step.x, y: step.y }; D.render(); return;
    case 'se': D.sfx?.(step.name); return;
    case 'music': D.music?.(step.track || null); return;
    case 'flag': D.flag?.(step); return;
    case 'end': c.skip = true; return;
    default: console.warn('paso desconocido', step);
  }
}

// ---------- pasos ----------
async function narration(c, text, ms) {
  c.narration = { text, t0: now() }; c.fade = 1; D.render();
  await delay(ms); c.narration = null; D.render();
}
async function fade(c, to, ms) {
  const from = c.fade, target = to === 'in' ? 0 : 1, t0 = now();
  if (fast()) { c.fade = target; D.render(); return; }
  await new Promise(res => { const tick = () => { const k = Math.min(1, (now() - t0) / ms); c.fade = from + (target - from) * k; D.render(); if (k < 1 && !c.skip) requestAnimationFrame(tick); else { c.fade = target; res(); } }; tick(); });
}
function dirToward(a, b) { if (!b) return a.facing; const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y); return dx || dy ? [dx, dy] : a.facing; }
async function move(c, who, step) {
  if (!who) return;
  const pts = (step.to || []).map(p => ({ x: p[0], y: p[1] })), speed = (step.speed || 1) * 1.6;   // px por fotograma a 60 fps
  if (fast()) { const last = pts[pts.length - 1]; if (last) { who.x = last.x; who.y = last.y; } return; }
  who.hidden = false; who.anim = null;
  await new Promise(res => { who.path = { pts, speed, slide: !!step.slide, res }; });
}
// avanza los actores que andan (lo llama el bucle de la aldea)
export function tickScenes() {
  const c = cut(); if (!c) return;
  for (const a of Object.values(c.actors)) {
    if (a.isPlayer) continue;
    const p = a.path; if (!p) continue;
    const step = p.speed * (D.dtFrames?.() || 1);
    let left = step;
    while (left > 0 && p.pts.length) {
      const t = p.pts[0], dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy);
      if (!p.slide && (dx || dy)) a.facing = [Math.abs(dx) > d * 0.38 ? Math.sign(dx) : 0, Math.abs(dy) > d * 0.38 ? Math.sign(dy) : 0];
      if (d <= left) { a.x = t.x; a.y = t.y; left -= d; p.pts.shift(); }
      else { a.x += dx / d * left; a.y += dy / d * left; left = 0; }
    }
    if (!p.slide) a.movedAt = now();
    if (!p.pts.length) { a.path = null; p.res(); }
    if (c.skip && a.path) { const last = p.pts[p.pts.length - 1]; a.x = last.x; a.y = last.y; a.path = null; p.res(); }
  }
}
const waitActor = a => new Promise(res => { const t = () => (!a?.path || cut()?.skip ? res() : requestAnimationFrame(t)); t(); });
async function anim(who, step) {
  if (!who) return;
  if (!step.anim || step.anim === 'Idle') { who.anim = null; return; }
  who.anim = { name: step.anim, t0: now(), dur: step.hold ? Infinity : (step.ms || 1200), loop: !!(step.hold || step.loop) };
  if (!step.hold && !step.at) await delay(step.ms || 600);
}
async function emote(c, who, step) {
  if (!who) return;
  if (step.fx === 'none') { who.emotes = []; return; }
  if (step.se) D.sfx?.(step.se);
  const e = { fx: step.fx, t0: now(), hold: !!step.hold || EMOTE_HOLD.has(step.fx) && step.hold !== false };
  who.emotes = who.emotes.filter(x => x.hold && x.fx !== e.fx).concat(e);
  if (!e.hold && !step.nowait) await delay(Math.min(900, (EMOTE_LEN[step.fx] || 1) * 1000 * 0.75));
}
async function say(c, who, step) {
  if (fast()) return;
  const page = { who: step.name ?? (who ? D.speciesName(who.sp) : ''), sp: step.unknown ? null : who?.sp, mood: step.mood || 'Normal', text: step.text, think: !!step.think };
  if (step.unknown || who?.form) { page.who = step.name || '???'; page.sp = null; }
  // el retrato se voltea a la derecha para el segundo interlocutor (como en el original)
  page.side = c.lastSpeaker && c.lastSpeaker !== (who?.id || page.who) ? 'right' : 'left'; c.lastSpeaker = who?.id || page.who;
  if (who) { who.still = true; c.speaking = who; }
  await new Promise(res => {
    c.dialogResolve = res; D.openDialog([page], () => { c.dialogResolve = null; res(); });
    if (step.auto) { const d0 = D.state.dialog; setTimeout(() => { if (D.state.dialog === d0) { D.state.dialog = null; c.dialogResolve = null; D.render(); res(); } }, step.auto); }   // se corta sola a media frase
  });
  if (who) who.still = false; c.speaking = null;
  await delay(150);   // la micro-pausa del original al cerrar el cuadro
}
async function object(c, o, action, ms = 600) {
  if (!o) return;
  if (action === 'show') { o.hidden = false; o.alpha = 1; return; }
  if (action === 'hide') { o.hidden = true; return; }
  if (action === 'flicker-hide') {
    if (fast()) { o.hidden = true; return; }
    const t0 = now(); await new Promise(res => { const t = () => { const k = (now() - t0) / ms; o.alpha = Math.floor(k * 12) % 2 ? 0.2 : 0.9; D.render(); if (k < 1 && !c.skip) requestAnimationFrame(t); else { o.hidden = true; res(); } }; t(); });
  }
}

// ---------- dibujo (lo llama renderHub) ----------
export function sceneEntities(area) {
  const c = cut(); if (!c) return [];
  const ents = [];
  for (const o of Object.values(c.objects)) if (!o.hidden) ents.push({ kind: 'sceneobj', x: o.x, y: o.y, draw: (ctx, sx, sy) => drawObject(ctx, o, sx, sy), obj: o });
  for (const a of Object.values(c.actors)) if (!a.hidden && !a.isPlayer) ents.push({ kind: 'actor', actor: a, x: a.x, y: a.y, species: a.sp, facing: a.facing, movedAt: a.movedAt, anim: a.anim, still: a.still });
  return ents;
}
export function drawSceneActor(ctx, e, sx, sy, scale, drawMon) {
  const a = e.actor;
  if (a.form) drawForm(ctx, a, sx, sy, scale);
  else drawMon(ctx, { species: a.sp, facing: a.facing, movedAt: a.movedAt, anim: a.anim, still: a.still }, sx - scale * 12, sy - scale * 24, scale * 24);
  // efectos sobre la cabeza
  const t = now(); a.emotes = a.emotes.filter(em => em.hold || (t - em.t0) / 1000 <= (EMOTE_LEN[em.fx] || 1));
  for (const em of a.emotes) { const tt = em.hold ? ((t - em.t0) / 1000) % (EMOTE_LEN[em.fx] || 1) : (t - em.t0) / 1000; drawEmote(ctx, em.fx, sx, sy - scale * 26, tt, 2); }
}
function drawObject(ctx, o, sx, sy) {
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
  if (o.kind === 'tray') {   // la bandeja de las entregas: tabla con una carta y una manzana
    const s = 1.6; ctx.translate(sx, sy); ctx.scale(s, s);
    ctx.fillStyle = '#3a2210'; ctx.fillRect(-17, -5, 34, 12); ctx.fillStyle = '#9a6030'; ctx.fillRect(-15, -3, 30, 8); ctx.fillStyle = '#c08048'; ctx.fillRect(-15, -3, 30, 2);
    ctx.fillStyle = '#f2ead8'; ctx.fillRect(-11, -6, 12, 8); ctx.fillStyle = '#b0a58a'; ctx.fillRect(-11, -6, 12, 1);
    ctx.fillStyle = '#c83030'; ctx.beginPath(); ctx.arc(7, -2, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#6a3a18'; ctx.fillRect(7, -8, 1, 3);
  }
  ctx.restore();
}
// capa de encima: noche (con luces), narración y fundido
export function drawSceneOverlay(ctx, W, H, cam) {
  const c = cut(); if (!c) return;
  const p = c.actors.player;   // los efectos del jugador (él no es un actor de la escena: lo dibuja la aldea)
  if (p && !c.hidePlayer && p.emotes.length) {
    const t = now(); p.emotes = p.emotes.filter(em => em.hold || (t - em.t0) / 1000 <= (EMOTE_LEN[em.fx] || 1));
    for (const em of p.emotes) { const tt = em.hold ? ((t - em.t0) / 1000) % (EMOTE_LEN[em.fx] || 1) : (t - em.t0) / 1000; drawEmote(ctx, em.fx, p.x - cam.x, p.y - cam.y - 52, tt, 2); }
  }
  if (c.night) {
    ctx.fillStyle = 'rgba(8, 12, 40, 0.62)'; ctx.fillRect(0, 0, W, H);
    for (const l of c.lights) { const g = ctx.createRadialGradient(l.x - cam.x, l.y - cam.y, 4, l.x - cam.x, l.y - cam.y, l.r || 70); g.addColorStop(0, `rgba(255, 205, 120, ${l.a ?? 0.22})`); g.addColorStop(1, 'rgba(255, 205, 120, 0)'); ctx.fillStyle = g; ctx.fillRect(l.x - cam.x - 120, l.y - cam.y - 120, 240, 240); }
  }
  if (c.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${c.fade})`; ctx.fillRect(0, 0, W, H); }
  if (c.narration) {
    const k = Math.min(1, (now() - c.narration.t0) / 500); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = k; ctx.fillStyle = '#f0f0f0'; ctx.font = `italic ${Math.round(22 * (D.uis?.() || 1))}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText(c.narration.text, W / 2, H / 2 + 8); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
}

// ---------- la silueta que cambia de forma (anclada por los pies) ----------
const silCache = new Map(), anchorCache = new Map();
function silFrame(sp, row, col) {
  const key = `${sp}:${row}:${col}`; if (silCache.has(key)) return silCache.get(key);
  const m = D.sprites.mons[sp]; if (!m?.sheetImg) { D.sprites.ensure?.(m); return null; }
  const [fw, fh] = m.frame, cv = document.createElement('canvas'); cv.width = fw + 4; cv.height = fh + 4; const g = cv.getContext('2d');
  const draw = (dx, dy, color) => { g.save(); g.globalCompositeOperation = 'source-over'; const tmp = document.createElement('canvas'); tmp.width = fw; tmp.height = fh; const tg = tmp.getContext('2d'); tg.drawImage(m.sheetImg, col * fw, row * fh, fw, fh, 0, 0, fw, fh); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = color; tg.fillRect(0, 0, fw, fh); g.drawImage(tmp, 2 + dx, 2 + dy); g.restore(); };
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) draw(dx, dy, 'rgba(120, 84, 170, 0.6)');   // contorno violeta tenue
  draw(0, 0, 'rgba(8, 5, 14, 0.96)');
  silCache.set(key, cv); return cv;
}
function feetOf(sp, row) {   // dónde están los pies en esa fila (para anclar todas las formas igual)
  const key = `${sp}:${row}`; if (anchorCache.has(key)) return anchorCache.get(key);
  const m = D.sprites.mons[sp]; if (!m?.sheetImg) return null;
  const [fw, fh] = m.frame, cv = document.createElement('canvas'); cv.width = fw * m.frames; cv.height = fh; const g = cv.getContext('2d');
  g.drawImage(m.sheetImg, 0, row * fh, fw * m.frames, fh, 0, 0, fw * m.frames, fh);
  const d = g.getImageData(0, 0, cv.width, fh).data; let bottom = 0, minx = fw, maxx = 0;
  for (let y = 0; y < fh; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 40) { bottom = Math.max(bottom, y); const cx = x % fw; minx = Math.min(minx, cx); maxx = Math.max(maxx, cx); }
  const r = { ay: bottom + 1, ax: (minx + maxx) / 2 }; anchorCache.set(key, r); return r;
}
function drawForm(ctx, a, sx, sy, scale) {
  const t = now(), period = 520, i = Math.floor(t / period), k = (t % period) / period, moving = a.movedAt && t - a.movedAt < 250;
  const row = ({ '0,1': 0, '1,1': 1, '1,0': 2, '1,-1': 3, '0,-1': 4, '-1,-1': 5, '-1,0': 6, '-1,1': 7 })[`${a.facing[0]},${a.facing[1]}`] ?? 0;
  const one = (sp, alpha) => {
    const m = D.sprites.mons[sp]; if (!m) return; const col = moving ? Math.floor(t / 110) % m.frames : 0;
    const fr = silFrame(sp, row, col), an = feetOf(sp, row); if (!fr || !an) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fr, Math.round(sx - (an.ax + 2) * scale), Math.round(sy - (an.ay + 2) * scale + 2), fr.width * scale, fr.height * scale); ctx.restore();
  };
  const cur = FORM_SPECIES[i % FORM_SPECIES.length], next = FORM_SPECIES[(i + 1) % FORM_SPECIES.length];
  for (const sp of FORM_SPECIES) { const m = D.sprites.mons[sp]; if (m && !m.sheetImg) D.sprites.ensure?.(m); }
  if (k < 0.8) one(cur, 0.96); else { const c2 = (k - 0.8) / 0.2; one(cur, 0.96 * (1 - c2)); one(next, 0.96 * c2); }
}
