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
const delay = ms => new Promise(r => { const t0 = now(); const t = () => (fast() || now() - t0 >= ms) ? r() : setTimeout(t, 40); t(); });   // se acorta si se salta la escena
const now = () => performance.now();

// ---------- reproducir un guion ----------
// ---------- fundidos de pantalla entre la aldea y las escenas (nada aparece ni desaparece de golpe) ----------
const isBlack = () => !!D.state.screenFade && D.state.screenFade.to === 1;
function screenFade(from, to, ms) {
  const S = D.state; if (fast()) { S.screenFade = to ? { from: 1, to: 1, t0: 0, ms: 1 } : null; return Promise.resolve(); }
  S.screenFade = { from, to, t0: now(), ms };
  const mine = S.screenFade;   // si otro fundido lo sustituye (p. ej. empieza la escena siguiente), esta espera termina sin fallar
  return new Promise(res => { const t = () => { const f = S.screenFade; if (f !== mine || !f || now() - f.t0 >= ms) { if (to === 0 && f === mine) S.screenFade = null; res(); } else setTimeout(t, 30); }; t(); });
}
export const releaseBlack = () => isBlack() ? screenFade(1, 0, 700) : Promise.resolve();   // tras las escenas, la aldea vuelve con un fundido
export function drawScreenFade(ctx, W, H) {
  const f = D?.state?.screenFade; if (!f) return;
  const k = Math.min(1, (now() - f.t0) / f.ms), a = f.from + (f.to - f.from) * k;
  if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); }
}
export async function playScene(scene) {
  const S = D.state, h = S.hub;
  if (S.cut || S.scene !== 'hub') return { skipped: false, aborted: true };   // solo en la aldea
  const dark = scene.startDark !== false;
  if (dark && !isBlack()) { S.busy = true; try { await screenFade(0, 1, 650); } finally { S.busy = false; } }   // lo que se veía se funde a negro antes de empezar
  if (S.cut || S.scene !== 'hub') { await releaseBlack(); return { skipped: false, aborted: true }; }
  const saved = { area: h.area, x: h.x, y: h.y, facing: h.facing, menu: S.menu, dialog: S.dialog };
  S.menu = null; S.dialog = null;
  if (scene.area && scene.area !== h.area) h.area = scene.area;
  if (scene.player) { h.x = scene.player.x; h.y = scene.player.y; h.facing = DIRS[scene.player.dir || 'down']; }
  const c = S.cut = {
    id: scene.id, skip: false, night: !!scene.night, lights: scene.lights || [], hidePlayer: !!scene.hidePlayer, hideNpcs: !!scene.hideNpcs, hideNpcIds: scene.hideNpcIds || [], bird: null, poster: null,
    fade: scene.startDark === false ? 0 : 1,   // (si venimos de un fundido a negro, sigue en negro) narration: null, cam: scene.cam ? { ...scene.cam } : null,
    actors: {}, objects: {}, moving: [], lastSpeaker: null, seq: 0, music: scene.music || null, tint: scene.tint || null,
  };
  if (dark) S.screenFade = null;   // el fundido de la propia escena (que empieza en negro) toma el relevo
  for (const [id, a] of Object.entries(scene.actors || {})) c.actors[id] = { id, sp: a.sp, x: a.x, y: a.y, facing: DIRS[a.dir || 'down'], hidden: !!a.hidden, anim: null, still: !!a.still, fixedStill: !!a.still, emotes: [], form: a.sp === 'sombra', ...Object.fromEntries(['scale', 'alpha', 'hover', 'flyAnim', 'item', 'itemScale', 'idle', 'noShadow', 'name', 'pensive', 'noLook', 'track'].filter(k => k in a).map(k => [k, a[k]])) };
  for (const [id, o] of Object.entries(scene.objects || {})) c.objects[id] = { id, ...o, alpha: 1 };
  c.actors.player = { id: 'player', isPlayer: true, emotes: [], get x() { return D.state.hub.x; }, get y() { return D.state.hub.y; }, get facing() { return D.state.hub.facing; }, set facing(v) { D.state.hub.facing = v; }, set x(v) { D.state.hub.x = v; }, set y(v) { D.state.hub.y = v; }, set movedAt(v) { D.state.hub.movedAt = v; } };
  if (scene.music) D.music?.(scene.music);
  D.render();
  // las frases que van seguidas del mismo Pokémon: se le mira desde la primera
  { const S = scene.steps; for (let i = 0; i < S.length; i++) { const s = S[i]; if (s.do !== 'say' || !s.who) continue; for (let j = i + 1; j < S.length; j++) if (S[j].do === 'say') { if (S[j].who === s.who) s.multi = true; break; } } }
  try { for (const step of scene.steps) { if (c.skip) break; await runStep(step, c); } }
  catch (e) { console.error('escena', scene.id, e); }
  const skipped = c.skip, endedDark = c.fade >= 0.99;
  // al acabar: se apaga todo lo que se mantenía y se vuelve a la aldea
  if (endedDark || dark) S.screenFade = endedDark ? { from: 1, to: 1, t0: 0, ms: 1 } : S.screenFade;   // acaba en negro: se queda en negro hasta…
  S.cut = null; if (!scene.keepPlayer) { h.area = saved.area; h.x = saved.x; h.y = saved.y; h.facing = saved.facing; }
  if (scene.music) D.music?.(null);
  D.render();
  if (!S.sceneChain) await releaseBlack();   // …que no haya más escenas seguidas: entonces vuelve la aldea con un fundido
  return { skipped };
}
export const skipScene = () => { const c = cut(); if (c) { c.skip = true; if (D.state.dialog) { D.state.dialog = null; c.dialogResolve?.(); } c.poster?.close(); } };

async function runStep(step, c) {
  if (step.at) { await Promise.all(step.at.map(s => runStep(s, c))); return; }
  if (step.seq) { for (const s2 of step.seq) await runStep(s2, c); return; }   // una secuencia (dentro de un «at»)
  if (step.delay && !fast()) await delay(step.delay);   // (dentro de un «at»: empezar un poco más tarde que los demás)
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
    case 'bird': c.bird = { t0: now(), ms: step.ms || 1100, from: step.from || [824, 190], to: step.to || [-96, 400] }; if (!step.nowait) await delay(step.ms || 1100); return;
    case 'poster': return poster(c, step.kind || 'wanted');
    case 'prop': if (who) Object.assign(who, step.set || {}); D.render(); return;   // cambiar algo de un actor (volar, tamaño, objeto en las manos…)
    case 'tween': { const p = tween(who, step.set || {}, step.ms || 600); if (!step.nowait) await p; return; }
    case 'jump': { const p = jumpTo(who, step.to || [who.x, who.y], step.ms || 420, step.h ?? 14); if (!step.nowait) await p; return; }
    case 'area': {   // cambiar de zona a mitad de escena (un recuerdo en otro sitio), con la cámara que se indique
      if (step.area) D.state.hub.area = step.area; if (step.cam) c.cam = { ...step.cam };
      if ('hidePlayer' in step) c.hidePlayer = !!step.hidePlayer; if ('night' in step) c.night = !!step.night;
      if (step.hideActors) { c.hiddenByArea = Object.values(c.actors).filter(a => !a.hidden && !a.isPlayer); c.hiddenByArea.forEach(a => a.hidden = true); }
      if (step.showActors && c.hiddenByArea) { c.hiddenByArea.forEach(a => a.hidden = false); c.hiddenByArea = null; }
      c.memory = step.memory ? { path: step.memory, light: null } : null; D.render(); return;
    }
    case 'light': if (c.memory) c.memory.light = { phase: step.phase, t0: now(), ms: step.ms || 1 }; if (step.wait) await delay(step.ms || 0); return;
    case 'bed': {   // meter al jugador en una cama (tumbado, como al despertar tras caer) o levantarlo
      const h = D.state.hub;
      if (step.up) { h.inBed = null; h.movedAt = now(); if (step.to) { h.x = step.to[0]; h.y = step.to[1]; } h.facing = DIRS[step.dir || 'down']; }
      else { const bed = D.beds?.()[step.bed ?? 0]; if (bed) { h.inBed = bed; h.x = bed.x; h.y = bed.y; h.facing = [0, 1]; } }
      D.render(); return;
    }
    case 'shake': c.shake = { t0: now(), ms: step.ms || 700, amp: step.amp || 4 }; if (step.wait) await delay(step.ms || 700); return;
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
function dirToward(a, b) {   // hacia dónde mirar para ver a b: las 4 cardinales salvo que esté claramente en diagonal
  if (!b) return a.facing; const dx = b.x - a.x, dy = b.y - a.y, ax = Math.abs(dx), ay = Math.abs(dy); if (!ax && !ay) return a.facing;
  const diag = Math.min(ax, ay) > Math.max(ax, ay) * 0.75; return [diag || ax >= ay ? Math.sign(dx) : 0, diag || ay > ax ? Math.sign(dy) : 0];
}
const octant = (x, y) => ((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8;   // 0..7 (8 direcciones)
async function move(c, who, step) {
  if (!who) return;
  const pts = (step.to || []).map(p => ({ x: p[0], y: p[1] })), speed = (step.speed || 1) * 1.6;   // px por fotograma a 60 fps
  if (fast()) { const last = pts[pts.length - 1]; if (last) { who.x = last.x; who.y = last.y; } return; }
  who.hidden = false; if (!step.keepAnim) who.anim = null;   // (keepAnim: se mueve sin cambiar de pose, p. ej. alguien arrastrado)
  await new Promise(res => { who.path = { pts, speed, slide: !!step.slide, keepFacing: !!step.keepFacing, res }; });   // keepFacing: anda de espaldas
}
// avanza los actores que andan (lo llama el bucle de la aldea)
export function tickScenes() {
  const c = cut(); if (!c) return;
  for (const a of Object.values(c.actors)) { const t = a.track && c.actors[a.track]; if (t && !t.hidden && !a.path) { const f = dirToward(a, t); if (f) a.facing = f; } }   // seguir con la mirada (track: id)
  for (const a of Object.values(c.actors)) {
    const p = a.path; if (!p) continue;
    const step = p.speed * (D.dtFrames?.() || 1);
    let left = step;
    while (left > 0 && p.pts.length) {
      const t = p.pts[0], dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy);
      if (!p.slide && !p.keepFacing && (dx || dy)) a.facing = [Math.abs(dx) > d * 0.38 ? Math.sign(dx) : 0, Math.abs(dy) > d * 0.38 ? Math.sign(dy) : 0];
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
  // todos los que escuchan miran a quien habla (salvo dormidos, en pose, volando o «pensativos»)
  // solo se gira quien tiene a quien habla a 90° o más (8 direcciones: la misma o la de al lado no cuentan)
  if (who && !who.hidden) for (const a of Object.values(c.actors)) {
    if (a === who || a.hidden || a.anim || a.hover || a.pensive || a.noLook || (a.isPlayer && D.state.hub.inBed)) continue;
    const [fx, fy] = a.facing || [0, 1], d = Math.abs(octant(fx, fy) - octant(who.x - a.x, who.y - a.y)), diff = Math.min(d, 8 - d);
    if (diff >= 2 || step.multi || c.prevSayWho === who) { const f = dirToward(a, who); if (f) a.facing = f; }   // (si va a decir varias frases seguidas, se le mira)
  }
  c.prevSayWho = who;
  const page = { who: step.name ?? who?.name ?? (who ? D.speciesName(who.sp) : ''), sp: step.unknown ? null : who?.sp, mood: step.mood || 'Normal', text: (step.text || '').replace(/\{jugador\}/g, D.playerName?.() || 'Novato'), think: !!step.think };
  if (step.unknown || who?.form) { page.who = step.name ?? '???'; page.sp = null; }   // name: '' = una voz sin nombre (desde fuera de plano)
  // el retrato se voltea a la derecha para el segundo interlocutor (como en el original)
  page.side = c.lastSpeaker && c.lastSpeaker !== (who?.id || page.who) ? 'right' : 'left'; c.lastSpeaker = who?.id || page.who;
  if (who) { who.still = true; c.speaking = who; }
  await new Promise(res => {
    c.dialogResolve = res; D.openDialog([page], () => { c.dialogResolve = null; res(); });
    if (step.auto) {   // se cierra sola: cuando la frase está escrita entera y ha pasado «auto» ms (para leerla)
      const d0 = D.state.dialog; let doneAt = 0;
      const check = () => { if (D.state.dialog !== d0) return; if (d0.done && !doneAt) doneAt = now(); if (doneAt && now() - doneAt >= step.auto) { D.state.dialog = null; c.dialogResolve = null; D.render(); res(); } else setTimeout(check, 50); };
      check();
    }
  });
  if (who) who.still = !!who.fixedStill; c.speaking = null;
  await delay(150);   // la micro-pausa del original al cerrar el cuadro
}
async function poster(c, kind) {   // cartel a pantalla completa: espera a que lo cierres (A)
  if (fast()) return;
  await new Promise(res => { c.poster = { kind, t0: now(), close: () => { c.poster = null; D.render(); res(); } }; D.render(); });
  await delay(250);
}
// ¿Consume la escena esta pulsación de A? (p. ej. para cerrar el cartel)
export function sceneTap() {
  const c = cut(); if (!c?.poster) return false;
  if (now() - c.poster.t0 > 500) c.poster.close(); return true;
}
async function object(c, o, action, ms = 600) {
  if (!o) return;
  if (action === 'fall') {   // cae del cielo balanceándose y se queda en el suelo
    o.hidden = false; o.fall = { t0: now(), ms, x: o.x, y0: o.y0 ?? o.y - 200, y1: o.y };
    if (!fast()) await delay(ms); o.fall.done = true; return;
  }
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
  if (c.bird) ents.push({ kind: 'sceneobj', x: 0, y: -1e9, draw: (ctx, sx) => drawBird(ctx, c, -sx) });   // la sombra, por el suelo: debajo de todo
  for (const o of Object.values(c.objects)) if (!o.hidden) {
    let oy = o.y;
    if (o.fall && !o.fall.done) { const k = Math.min(1, (now() - o.fall.t0) / o.fall.ms); oy = o.fall.y0 + (o.fall.y1 - o.fall.y0) * k; }
    ents.push({ kind: 'sceneobj', x: o.x, y: o.fall && !o.fall.done ? 1e9 : oy, draw: (ctx, sx, sy) => drawObject(ctx, o, sx, o.fall && !o.fall.done ? sy - (o.fall.y1 * 0 + 1e9 - oy) : sy), obj: o });   // mientras cae, por encima de todo
  }
  for (const a of Object.values(c.actors)) if (!a.hidden && !a.isPlayer) ents.push({ kind: 'actor', actor: a, x: a.x, y: a.y, species: a.sp, facing: a.facing, movedAt: a.movedAt, anim: a.anim, still: a.still });
  return ents;
}
export function drawSceneActor(ctx, e, sx, sy, scale, drawMon) {
  const a = e.actor;
  const t0 = now(), sc = a.scale ?? 1, lift = (a.hover ? 10 + Math.sin(t0 / 220) * 3 : 0) + liftOf(a);
  ctx.save(); ctx.globalAlpha = a.alpha ?? 1;
  if (a.form) drawForm(ctx, a, sx, sy, scale);
  else {
    // al volar, su animación de vuelo (más tranquila); si no, la pose que tenga; quieto salvo que esté haciendo algo (idle)
    const anim = a.hover && a.flyAnim ? (a._fly ||= { name: a.flyAnim, t0: now(), dur: Infinity, loop: true, slow: 3 }) : a.anim;
    const size = scale * 24 * sc;
    drawMon(ctx, { species: a.sp, facing: a.facing, movedAt: a.movedAt, anim, still: a.still || (!a.idle && !anim) }, sx - size / 2, sy - size - lift, size);
    if (a.item && D.drawItem) { const is = 26 * (a.itemScale ?? 1), right = (a.facing?.[0] ?? 0) >= 0; D.drawItem(ctx, a.item, Math.round(sx + (right ? 8 : -8 - is)), Math.round(sy - 34 - lift), Math.round(is)); }
  }
  ctx.restore();
  // efectos sobre la cabeza
  const t = now(); a.emotes = a.emotes.filter(em => em.hold || (t - em.t0) / 1000 <= (EMOTE_LEN[em.fx] || 1));
  for (const em of a.emotes) { const tt = em.hold ? ((t - em.t0) / 1000) % (EMOTE_LEN[em.fx] || 1) : (t - em.t0) / 1000; drawEmote(ctx, em.fx, sx + (a.facing?.[0] || 0) * 3 * scale, sy - scale * 26 - lift, tt, 2); }
}
// saltos en arco (también el jugador: se le aplica la altura en el dibujo de la aldea)
const liftOf = a => { const j = a.jumpArc; if (!j) return 0; const k = (now() - j.t0) / j.ms; if (k >= 1) { a.jumpArc = null; return 0; } return Math.sin(Math.PI * k) * j.h; };
async function jumpTo(a, to, ms, h) {
  if (!a) return; const from = [a.x, a.y], t0 = now(), isP = a.isPlayer, hub = D.state.hub;
  if (isP) hub.jumpArc = { t0, ms, h }; else a.jumpArc = { t0, ms, h };
  for (;;) { const k = fast() ? 1 : Math.min(1, (now() - t0) / ms); a.x = from[0] + (to[0] - from[0]) * k; a.y = from[1] + (to[1] - from[1]) * k; D.render(); if (k >= 1) break; await delay(16); }
  if (isP) hub.jumpArc = null;
}
async function tween(a, props, ms) {   // tamaño, transparencia… poco a poco
  if (!a) return; const from = Object.fromEntries(Object.keys(props).map(k => [k, a[k] ?? 1])), t0 = now();
  for (;;) { const k = fast() ? 1 : Math.min(1, (now() - t0) / ms); for (const p in props) a[p] = from[p] + (props[p] - from[p]) * k; D.render(); if (k >= 1) break; await delay(16); }
}
// el recuerdo: un tinte de memoria y una lucecita que recorre el camino que se indique (sube, se para, baja)
function drawMemory(ctx, W, H, cam, c) {
  ctx.fillStyle = 'rgba(40, 30, 70, .22)'; ctx.fillRect(0, 0, W, H);
  const g0 = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); g0.addColorStop(0, 'rgba(0,0,0,0)'); g0.addColorStop(1, 'rgba(0,0,0,.65)'); ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
  const L = c.memory.light, P = c.memory.path; if (!L || !P?.length) return;
  const along = k => { const segs = P.length - 1, f = Math.min(segs - 1e-6, Math.max(0, k) * segs), i = Math.floor(f), r = f - i; return [P[i][0] + (P[i + 1][0] - P[i][0]) * r, P[i][1] + (P[i + 1][1] - P[i][1]) * r]; };
  const k = Math.min(1, (now() - L.t0) / L.ms); if (L.phase === 'down' && k >= 1) return;
  const [x, y] = L.phase === 'up' ? along(k) : L.phase === 'stop' ? along(1) : along(1 - k);
  const sx = x - cam.x, sy = y - cam.y - 26 + Math.sin(now() / 160) * 1.5, hue = (now() / 12) % 360;
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 16); g.addColorStop(0, `hsla(${hue}, 90%, 80%, .95)`); g.addColorStop(0.35, `hsla(${hue}, 90%, 60%, .45)`); g.addColorStop(1, `hsla(${hue}, 90%, 50%, 0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 16, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 2, 2);
}
export const drawSceneObjectAt = (ctx, kind, sx, sy) => drawObject(ctx, { kind, alpha: 1 }, sx, sy);   // (la bandeja de la plaza, antes del robo)
function drawObject(ctx, o, sx, sy) {
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
  if (o.kind === 'paper') {   // un papel doblado; mientras cae, se balancea y gira
    let sway = 0, rot = 0.15, squash = 1;
    if (o.fall && !o.fall.done) { const k = Math.min(1, (now() - o.fall.t0) / o.fall.ms); sway = Math.sin(k * 11) * 26 * (1 - k * 0.7); rot = Math.sin(k * 11 + 1) * 0.6; squash = 0.55 + 0.45 * Math.abs(Math.cos(k * 11)); }
    else { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(sx, sy + 6, 12, 3, 0, 0, 7); ctx.fill(); }
    ctx.translate(sx + sway, sy); ctx.rotate(rot); ctx.scale(1, squash);
    ctx.fillStyle = '#5a4020'; ctx.fillRect(-11, -8, 22, 16); ctx.fillStyle = '#f1e0b8'; ctx.fillRect(-10, -7, 20, 14);
    ctx.fillStyle = '#8a2a1a'; ctx.fillRect(-7, -4, 14, 2); ctx.fillStyle = '#6a5230'; ctx.fillRect(-7, 0, 10, 1); ctx.fillRect(-7, 3, 12, 1);
    ctx.fillStyle = '#c0282a'; ctx.beginPath(); ctx.arc(0, -7, 2, 0, 7); ctx.fill();
  }
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
    for (const em of p.emotes) { const tt = em.hold ? ((t - em.t0) / 1000) % (EMOTE_LEN[em.fx] || 1) : (t - em.t0) / 1000; drawEmote(ctx, em.fx, p.x - cam.x + (D.state.hub.facing?.[0] || 0) * 6, -(D.state.hub.jumpArc ? Math.sin(Math.PI * Math.min(1, (now() - D.state.hub.jumpArc.t0) / D.state.hub.jumpArc.ms)) * D.state.hub.jumpArc.h : 0) + p.y - cam.y - 52, tt, 2); }
  }
  if (c.night) {
    ctx.fillStyle = 'rgba(8, 12, 40, 0.62)'; ctx.fillRect(0, 0, W, H);
    for (const l of c.lights) { const g = ctx.createRadialGradient(l.x - cam.x, l.y - cam.y, 4, l.x - cam.x, l.y - cam.y, l.r || 70); g.addColorStop(0, `rgba(255, 205, 120, ${l.a ?? 0.22})`); g.addColorStop(1, 'rgba(255, 205, 120, 0)'); ctx.fillStyle = g; ctx.fillRect(l.x - cam.x - 120, l.y - cam.y - 120, 240, 240); }
  }
  if (c.tint) { ctx.fillStyle = c.tint; ctx.fillRect(0, 0, W, H); }   // la luz de la tarde, etc.
  if (c.memory) drawMemory(ctx, W, H, cam, c);   // un recuerdo: tinte de memoria y la lucecita
  if (c.poster) drawWantedPoster(ctx, W, H, c.poster.t0);
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

// ---------- la sombra de un pájaro que cruza muy alto (nadie ve quién es) ----------
function drawBird(ctx, c, camX) {
  const b = c.bird, k = (now() - b.t0) / b.ms; if (k >= 1) { c.bird = null; return; }
  const cam = { x: camX, y: D.state.dlgCam?.y ?? 0 };
  const [x0, y0] = b.from, [x1, y1] = b.to, x = x0 + (x1 - x0) * k - cam.x, y = y0 + (y1 - y0) * k - cam.y;
  const flap = Math.sin(now() / 70), span = 46 * (0.72 + 0.28 * Math.abs(flap)), sweep = 6 * flap;
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(y1 - y0, x1 - x0)); ctx.scale(1.06, 1.06); ctx.filter = 'blur(1.8px)'; ctx.fillStyle = 'rgba(8, 10, 22, .32)';
  ctx.beginPath(); ctx.ellipse(0, 0, 17, 6, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(17, 0, 5, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(22, -2); ctx.lineTo(29, 0); ctx.lineTo(22, 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(-30, -11); ctx.lineTo(-27, -4); ctx.lineTo(-31, 0); ctx.lineTo(-27, 4); ctx.lineTo(-30, 11); ctx.lineTo(-12, 4); ctx.fill();
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(8, s * 3);
    ctx.quadraticCurveTo(10, s * span * 0.55, 2 - sweep, s * span);
    ctx.lineTo(-4 - sweep, s * (span - 3)); ctx.lineTo(-3 - sweep, s * (span - 9));
    ctx.lineTo(-10 - sweep, s * (span - 7)); ctx.lineTo(-8 - sweep, s * (span - 14));
    ctx.lineTo(-15 - sweep, s * (span - 13)); ctx.lineTo(-12 - sweep, s * (span - 20));
    ctx.quadraticCurveTo(-14, s * span * 0.35, -8, s * 4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// ---------- el cartel de «SE BUSCA» (a pantalla completa) ----------
function drawWantedPoster(ctx, W, H, t0) {
  const k = Math.min(1, (now() - t0) / 260), s = 0.85 + 0.15 * (1 - Math.pow(1 - k, 3));
  ctx.fillStyle = `rgba(3,5,15,${0.7 * k})`; ctx.fillRect(0, 0, W, H);
  const pw = 300, ph = 388; ctx.save(); ctx.translate(W / 2, H / 2 + 4); ctx.scale(s * 0.98, s * 0.98); ctx.rotate(-0.012); ctx.globalAlpha = k;
  // papel envejecido, con los bordes irregulares
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-pw / 2 + 7, -ph / 2 + 9, pw, ph);
  ctx.beginPath(); const jag = (i, n, a, b) => a + (b - a) * i / n + ((i * 37) % 5 - 2);
  ctx.moveTo(-pw / 2, -ph / 2); for (let i = 0; i <= 20; i++) ctx.lineTo(jag(i, 20, -pw / 2, pw / 2), -ph / 2 + ((i * 13) % 3));
  for (let i = 0; i <= 26; i++) ctx.lineTo(pw / 2 - ((i * 11) % 3), jag(i, 26, -ph / 2, ph / 2));
  for (let i = 0; i <= 20; i++) ctx.lineTo(jag(i, 20, pw / 2, -pw / 2), ph / 2 - ((i * 7) % 3));
  for (let i = 0; i <= 26; i++) ctx.lineTo(-pw / 2 + ((i * 17) % 3), jag(i, 26, ph / 2, -ph / 2)); ctx.closePath();
  const g = ctx.createRadialGradient(0, 0, 40, 0, 0, 260); g.addColorStop(0, '#f6e8c4'); g.addColorStop(0.75, '#e6cf9c'); g.addColorStop(1, '#bf9d62'); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(107,74,34,.5)'; ctx.lineWidth = 1; ctx.strokeRect(-pw / 2 + 12, -ph / 2 + 22, pw - 24, ph - 34);
  // chincheta
  ctx.fillStyle = '#7a1010'; ctx.beginPath(); ctx.arc(0, -ph / 2 + 9, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#d83030'; ctx.beginPath(); ctx.arc(-1, -ph / 2 + 8, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#ff9090'; ctx.beginPath(); ctx.arc(-3, -ph / 2 + 6, 2, 0, 7); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a2418'; ctx.font = 'bold 13px Georgia, serif'; ctx.fillText('— ATENCIÓN, EXPLORADORES —', 0, -ph / 2 + 36);
  ctx.fillStyle = '#3a2410'; ctx.font = 'bold 44px Georgia, serif'; ctx.fillText('SE BUSCA', 0, -ph / 2 + 72);
  // retrato: una silueta que nadie ha visto bien
  const T = -ph / 2, fw = 132, fh = 84, fx = -fw / 2, fy = T + 94;
  ctx.fillStyle = '#6b4a22'; ctx.fillRect(fx - 4, fy - 4, fw + 8, fh + 8); ctx.fillStyle = '#d9c28f'; ctx.fillRect(fx, fy, fw, fh);
  // retrato robot fallido: los testigos dibujaron a los sospechosos de siempre… y los tacharon
  ctx.save(); ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pencil = (w, a = 0.75) => { ctx.strokeStyle = `rgba(60, 48, 36, ${a})`; ctx.lineWidth = w; };
  // un bicho redondo y tripón, con una bocaza y una pluma en la cabeza (se parece sospechosamente a alguien)
  pencil(1.7); const gx = fx + 34, gy = fy + 50;
  ctx.beginPath(); ctx.ellipse(gx, gy, 24, 22, 0, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(gx - 16, gy + 4); ctx.quadraticCurveTo(gx, gy + 16, gx + 16, gy + 4); ctx.quadraticCurveTo(gx, gy + 8, gx - 16, gy + 4); ctx.stroke();   // la bocaza
  ctx.beginPath(); ctx.moveTo(gx - 8, gy - 8); ctx.lineTo(gx - 3, gy - 6); ctx.moveTo(gx + 3, gy - 6); ctx.lineTo(gx + 8, gy - 8); ctx.stroke();   // ojos entornados
  ctx.beginPath(); ctx.moveTo(gx - 2, gy - 22); ctx.quadraticCurveTo(gx - 8, gy - 34, gx + 2, gy - 36); ctx.stroke();   // la pluma
  ctx.beginPath(); ctx.moveTo(gx - 5, gy + 22); ctx.lineTo(gx, gy + 16); ctx.lineTo(gx + 5, gy + 22); ctx.stroke();   // el rombo
  // un pájaro con pico y sombrero de ala ancha (también sospechosamente conocido)
  pencil(1.7); const mx = fx + 98, my = fy + 52;
  ctx.beginPath(); ctx.ellipse(mx, my, 16, 18, 0, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx - 26, my - 14); ctx.quadraticCurveTo(mx, my - 20, mx + 26, my - 14); ctx.stroke();   // ala del sombrero
  ctx.beginPath(); ctx.moveTo(mx - 14, my - 16); ctx.quadraticCurveTo(mx - 4, my - 42, mx + 18, my - 36); ctx.quadraticCurveTo(mx + 8, my - 28, mx + 12, my - 16); ctx.stroke();   // copa doblada
  ctx.beginPath(); ctx.moveTo(mx - 6, my - 2); ctx.lineTo(mx - 20, my + 4); ctx.lineTo(mx - 6, my + 7); ctx.stroke();   // el pico
  ctx.beginPath(); ctx.arc(mx + 3, my - 5, 2, 0, 7); ctx.stroke();
  // tachados de un solo trazo (que se vea a quién)
  pencil(2.6, 0.85);
  ctx.beginPath(); ctx.moveTo(gx - 26, gy - 26); ctx.lineTo(gx + 26, gy + 26); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx + 24, my - 30); ctx.lineTo(mx - 24, my + 22); ctx.stroke();
  ctx.restore();
  // y encima, un gran «?» en lápiz rojo
  ctx.save(); ctx.translate(2, fy + 30); ctx.rotate(0.1); ctx.fillStyle = 'rgba(176, 34, 28, .92)'; ctx.font = 'bold 40px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 0); ctx.restore();
  // sello «LADRÓN», cruzando la esquina del retrato
  ctx.save(); ctx.translate(66, fy + 78); ctx.rotate(-0.18); ctx.strokeStyle = 'rgba(180,30,30,.85)'; ctx.lineWidth = 3; ctx.strokeRect(-44, -13, 88, 26); ctx.lineWidth = 1; ctx.strokeRect(-40, -9, 80, 18);
  ctx.fillStyle = 'rgba(180,30,30,.9)'; ctx.font = 'bold 16px Georgia, serif'; ctx.fillText('LADRÓN', 0, 1); ctx.restore();
  // ficha: etiqueta a la izquierda, valor alineado a la derecha de todas las etiquetas
  const L = -pw / 2 + 28, V = L + 86, rows = [['Especie', ['Desconocida']], ['Visto', ['Plaza del gremio, de noche']], ['Botín', ['La bandeja de las entregas,', 'una Baya Aranja y la pluma', 'de escribir de Chatot']], ['Peligro', ['¿?']]];
  ctx.textAlign = 'left'; let ry = fy + fh + 22;
  for (const [a, vals] of rows) {
    ctx.fillStyle = '#5a3a18'; ctx.font = 'bold 12px Georgia, serif'; ctx.fillText(a + ':', L, ry);
    ctx.fillStyle = '#2a1a0a'; ctx.font = '12px Georgia, serif'; for (const v of vals) { ctx.fillText(v, V, ry); ry += 15; }
    ry += 2;
  }
  // recompensa
  ctx.strokeStyle = 'rgba(107,74,34,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-pw / 2 + 30, ry + 2); ctx.lineTo(pw / 2 - 30, ry + 2); ctx.stroke();
  ry += 16; ctx.textAlign = 'center';
  ctx.fillStyle = '#8a2418'; ctx.font = 'bold 12px Georgia, serif'; ctx.fillText('RECOMPENSA', 0, ry); ry += 22;
  ctx.fillStyle = '#b8891c'; ctx.beginPath(); ctx.arc(-78, ry, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(-78, ry, 7, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a2410'; ctx.font = 'bold 24px Georgia, serif'; ctx.fillText('3.000 Pokés', 6, ry + 1); ry += 24;
  ctx.fillStyle = '#4a3014'; ctx.font = 'italic 11px Georgia, serif'; ctx.fillText('Cualquier pista, comunicádsela a Chatot.', -16, ry); ctx.fillText('¡No actuéis por vuestra cuenta!', -16, ry + 13);
  // firma y sello de lacre del gremio, abajo
  const sy = ph / 2 - 30;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8a1a1a'; ctx.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = i % 2 ? 16 : 18; ctx.lineTo(pw / 2 - 36 + Math.cos(a) * r, sy + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b83030'; ctx.beginPath(); ctx.arc(pw / 2 - 36, sy, 11, 0, 7); ctx.fill(); ctx.fillStyle = '#f3d7a0'; ctx.font = 'bold 12px Georgia, serif'; ctx.fillText('G', pw / 2 - 36, sy + 1);
  ctx.restore(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
}

// desplazamiento de la cámara por el temblor (lo usa renderHub)
export function sceneShake() {
  const c = cut(), sh = c?.shake; if (!sh) return [0, 0];
  const k = (now() - sh.t0) / sh.ms; if (k >= 1) { c.shake = null; return [0, 0]; }
  const a = sh.amp * (1 - k); return [Math.round((Math.random() * 2 - 1) * a), Math.round((Math.random() * 2 - 1) * a)];
}
