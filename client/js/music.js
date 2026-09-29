// =====================================================================
// MÚSICA: bucles sin cortes (Web Audio) y transiciones suaves entre zonas.
// Las pistas se cortan en compases enteros; al decodificar se recorta el silencio que añaden
// los MP3 al principio y al final, para que el empalme del bucle no se note.
// =====================================================================
import { asset } from './ui.js';

// qué suena en cada sitio (las zonas sin pista propia usan la de la plaza)
// loop = duración musical exacta (compases × pulsos × 60 / BPM): así el empalme cae siempre en su sitio,
// aunque el navegador añada silencio al decodificar el MP3 (Safari lo hace)
// Pistas propias (sintetizadas por código). Etiquetas para localizarlas si hay que quitarlas o cambiarlas:
//   set: 'base' → menú, test y aldea (0.3–0.4) · 'B' → tanda de la 0.5.0 · 'antigua' → primer tema del menú
//   approved: true si ya está dada por buena; false si está pendiente de revisar
const TRACKS = {
  menu:    { url: 'client/assets/music/menu.mp3', loop: 16 * 4 * 60 / 88, set: 'base', approved: true },        // menú principal
  quiz:    { url: 'client/assets/music/quiz.mp3', loop: 16 * 4 * 60 / 72, set: 'base', approved: true },        // test de personalidad y escenas de entrada
  village: { url: 'client/assets/music/village.mp3', loop: 32 * 4 * 60 / 113, set: 'base', approved: true },   // aldea (plaza, gremio, mercado, casas)
  rest:    { url: 'client/assets/music/rest.mp3', loop: 12 * 4 * 60 / 64, set: 'B', approved: false },         // zona de descanso (nana)
  sad:     { url: 'client/assets/music/sad.mp3', set: 'antigua', approved: false },                            // escena triste: despertar tras caer
  // mazmorras
  bosque:  { url: 'client/assets/music/bosque.mp3', loop: 16 * 4 * 60 / 108, set: 'B', approved: false },      // Bosque Frondoso y Campo de Entrenamiento
  cueva:   { url: 'client/assets/music/cueva.mp3', loop: 16 * 4 * 60 / 90, set: 'B', approved: false },
  monte:   { url: 'client/assets/music/monte.mp3', loop: 16 * 4 * 60 / 120, set: 'B', approved: false },
  ruinas:  { url: 'client/assets/music/ruinas.mp3', loop: 16 * 4 * 60 / 82, set: 'B', approved: false },
  tiempo:  { url: 'client/assets/music/tiempo.mp3', loop: 16 * 4 * 60 / 126, set: 'B', approved: false },
  suenos:  { url: 'client/assets/music/suenos.mp3', loop: 16 * 4 * 60 / 74, set: 'B', approved: false },
  boss:    { url: 'client/assets/music/boss.mp3', loop: 16 * 4 * 60 / 150, set: 'B', approved: false },        // jefe
  mega:    { url: 'client/assets/music/mega.mp3', loop: 16 * 4 * 60 / 140, set: 'B', approved: false },        // guardián Mega
  monster_house: { url: 'client/assets/music/monster_house.mp3', loop: 8 * 4 * 60 / 160, set: 'B', approved: false },
  shop:    { url: 'client/assets/music/shop.mp3', loop: 8 * 4 * 60 / 112, set: 'B', approved: false },         // tienda de Kecleon (en la mazmorra)
  // fanfarrias (una sola vez, sin bucle)
  clear:   { url: 'client/assets/music/clear.mp3', once: true, set: 'B', approved: false },
  defeat:  { url: 'client/assets/music/defeat.mp3', once: true, set: 'B', approved: false },
};
// Lista de pistas con sus etiquetas (para consultarla desde la consola: window.__mmTracks())
if (typeof window !== 'undefined') window.__mmTracks = () => Object.entries(TRACKS).map(([k, t]) => ({ pista: k, set: t.set, aprobada: t.approved }));
const ZONE_TRACK = { plaza: 'village', gremio: 'village', descanso: 'rest', mercado: 'village', aldea: 'village', fuente: 'quiz' };   // la fuente: el tema del test («conócete primero»)
const FADE = 1.2; // segundos de transición

let ctx = null, master = null, current = null; // current = { key, src, gain }
const buffers = {}, loading = {};
// posición de la barra (0…1) guardada; el volumen real sigue una curva percibida (el oído es logarítmico):
// la mitad de la barra suena a «mitad de fuerte» y el extremo izquierdo es silencio total
const prefVol = () => { try { const v = localStorage.getItem('mm_music_pos'); return v === null ? 0.6 : +v; } catch { return 0.6; } };
const gainOf = pos => pos <= 0 ? 0 : Math.pow(pos, 2.2);

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = gainOf(prefVol()); master.connect(ctx.destination);
  return ctx;
}
// los navegadores solo dejan sonar audio tras una interacción: se desbloquea con la primera tecla o toque
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { ensureCtx(); if (ctx?.state === 'suspended') ctx.resume(); }, { passive: true }));

async function load(key) {
  if (buffers[key]) return buffers[key];
  if (loading[key]) return loading[key];
  loading[key] = (async () => {
    const url = asset('music_' + key, TRACKS[key].url);
    // audio incrustado (data:…;base64): se decodifica aquí mismo, sin fetch, porque las páginas publicadas
    // bloquean las peticiones de red; los archivos normales del proyecto sí se piden con fetch
    const data = url.startsWith('data:')
      ? Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), c => c.charCodeAt(0)).buffer
      : await (await fetch(url)).arrayBuffer();
    const buf = await ensureCtx().decodeAudioData(data);
    // recortar el silencio de relleno del MP3 (inicio y final) para un bucle limpio
    const ch = buf.getChannelData(0), thr = 0.0015;
    let a = 0, b = ch.length - 1;
    while (a < ch.length && Math.abs(ch[a]) < thr) a++;
    while (b > a && Math.abs(ch[b]) < thr) b--;
    const loopStart = a / buf.sampleRate;
    const loopEnd = Math.min(buf.duration, TRACKS[key].loop ? loopStart + TRACKS[key].loop : (b + 1) / buf.sampleRate);
    buffers[key] = { buf, loopStart, loopEnd };
    return buffers[key];
  })().catch(() => null);
  return loading[key];
}

let sting = null, pendingKey = undefined;   // fanfarria en curso y música que espera a que termine
export async function playOnce(key) {
  if (!ensureCtx()) return;
  const t = await load(key); if (!t) return;
  const now = ctx.currentTime;
  if (current?.gain) { current.gain.gain.cancelScheduledValues(now); current.gain.gain.setValueAtTime(current.gain.gain.value, now); current.gain.gain.linearRampToValueAtTime(0, now + 0.25); current.src.stop(now + 0.3); }
  current = null; pendingKey = undefined;
  const src = ctx.createBufferSource(), gain = ctx.createGain(); src.buffer = t.buf; gain.gain.value = 1; src.connect(gain); gain.connect(master);
  sting = src; src.start(ctx.currentTime + 0.05, t.loopStart);
  await new Promise(res => { src.onended = res; });
  if (sting === src) { sting = null; const k = pendingKey; pendingKey = undefined; if (k !== undefined) playTrack(k); }
}
export async function playZone(zone) { return playTrack(ZONE_TRACK[zone] || null); }
export async function playTrack(key) {
  if (sting) { pendingKey = key; return; }            // una fanfarria está sonando: esta música empezará después
  if (current?.key === key) return;
  const prev = current; current = key ? { key } : null;
  if (!ensureCtx()) return;
  const now = ctx.currentTime;
  if (prev?.gain) { prev.gain.gain.cancelScheduledValues(now); prev.gain.gain.setValueAtTime(prev.gain.gain.value, now); prev.gain.gain.linearRampToValueAtTime(0, now + FADE); prev.src.stop(now + FADE + 0.05); }
  if (!key) return;
  const t = await load(key); if (!t || current?.key !== key) return;
  const src = ctx.createBufferSource(), gain = ctx.createGain();
  src.buffer = t.buf; src.loop = true; src.loopStart = t.loopStart; src.loopEnd = t.loopEnd;
  gain.gain.value = 0; src.connect(gain); gain.connect(master);
  const t0 = ctx.currentTime; src.start(t0, t.loopStart); gain.gain.linearRampToValueAtTime(1, t0 + FADE);
  current = { key, src, gain };
}
export const stopMusic = () => playTrack(null);
export function setVolume(pos) { try { localStorage.setItem('mm_music_pos', String(pos)); } catch {} if (master) master.gain.setTargetAtTime(gainOf(pos), ctx.currentTime, 0.02); }
export const getVolume = prefVol;
// al empezar solo se precargan las pistas de fuera de las mazmorras; las demás se descargan al necesitarlas
export const preload = (keys = ['menu', 'quiz', 'village', 'rest']) => keys.forEach(k => ensureCtx() && load(k));
// depuración (pruebas automáticas): qué pista suena y datos del bucle
window.__mmMusic = () => ({ playing: current?.key || null, sting: !!sting, pending: pendingKey, ctx: ctx?.state || 'sin iniciar', loaded: Object.fromEntries(Object.entries(buffers).map(([k, b]) => [k, b && { dur: +b.buf.duration.toFixed(2), loopStart: +b.loopStart.toFixed(3), loopEnd: +b.loopEnd.toFixed(3) }])) });

// =====================================================================
// EFECTOS DE SONIDO — sintetizados al momento (Web Audio), sin archivos. Volumen propio (opciones: «Efectos»).
// =====================================================================
let sfxGain = null, sfxVol = (() => { try { const v = parseFloat(localStorage.getItem('mm_sfx')); return isNaN(v) ? 0.7 : v; } catch { return 0.7; } })();
let noiseBuf = null;
function sfxOut() {
  if (!ensureCtx()) return null;
  if (!sfxGain) { sfxGain = ctx.createGain(); sfxGain.gain.value = sfxVol * sfxVol; sfxGain.connect(ctx.destination); }
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return sfxGain;
}
export function setSfxVolume(v) { sfxVol = Math.max(0, Math.min(1, v)); try { localStorage.setItem('mm_sfx', String(sfxVol)); } catch {} if (sfxGain) sfxGain.gain.value = sfxVol * sfxVol; }
export const getSfxVolume = () => sfxVol;
// piezas básicas: tono con envolvente y glissando, y ruido filtrado
function tone(t0, { f = 440, f2 = null, dur = 0.12, type = 'square', vol = 0.25, attack = 0.004, release = null }) {
  const out = sfxOut(); if (!out) return;
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + (release ?? dur));
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + (release ?? dur) + 0.02);
}
function noise(t0, { dur = 0.15, vol = 0.3, freq = 1200, q = 1, type = 'bandpass', freq2 = null }) {
  const out = sfxOut(); if (!out) return;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf;
  f.type = type; f.frequency.setValueAtTime(freq, t0); if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t0 + dur); f.Q.value = q;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(out); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}
const notes = (t0, seq, opts = {}) => seq.forEach(([f, at, d]) => tone(t0 + at, { f, dur: d, type: opts.type || 'square', vol: opts.vol ?? 0.16, release: d }));
const N = n => 440 * Math.pow(2, (n - 69) / 12);   // nota MIDI → Hz
const SFX = {
  // combate
  hit: t => { noise(t, { dur: 0.09, vol: 0.45, freq: 900, freq2: 300, q: 0.8 }); tone(t, { f: 180, f2: 70, dur: 0.1, type: 'triangle', vol: 0.4 }); },
  hitSuper: t => { noise(t, { dur: 0.14, vol: 0.55, freq: 1600, freq2: 400, q: 0.7 }); tone(t, { f: 260, f2: 60, dur: 0.16, type: 'sawtooth', vol: 0.3 }); tone(t + 0.05, { f: 520, f2: 180, dur: 0.1, type: 'square', vol: 0.15 }); },
  hitWeak: t => { noise(t, { dur: 0.07, vol: 0.25, freq: 600, freq2: 250, q: 1.2 }); tone(t, { f: 140, f2: 90, dur: 0.07, type: 'triangle', vol: 0.25 }); },
  crit: t => { SFX.hitSuper(t); tone(t + 0.02, { f: 1800, f2: 900, dur: 0.12, type: 'square', vol: 0.12 }); },
  miss: t => { noise(t, { dur: 0.16, vol: 0.18, freq: 2500, freq2: 700, q: 2, type: 'bandpass' }); },
  faint: t => { tone(t, { f: 520, f2: 90, dur: 0.45, type: 'square', vol: 0.18 }); noise(t + 0.05, { dur: 0.3, vol: 0.15, freq: 500, freq2: 150 }); },
  hurt: t => { tone(t, { f: 300, f2: 120, dur: 0.12, type: 'square', vol: 0.2 }); noise(t, { dur: 0.08, vol: 0.35, freq: 700 }); },
  bump: t => { tone(t, { f: 110, f2: 70, dur: 0.07, type: 'triangle', vol: 0.3 }); },
  // objetos
  pickup: t => notes(t, [[N(84), 0, 0.07], [N(91), 0.06, 0.12]], { type: 'square', vol: 0.13 }),
  coin: t => notes(t, [[N(88), 0, 0.05], [N(93), 0.05, 0.18]], { type: 'square', vol: 0.12 }),
  eat: t => { for (let i = 0; i < 3; i++) noise(t + i * 0.09, { dur: 0.06, vol: 0.3, freq: 1800, q: 3 }); },
  drink: t => { for (let i = 0; i < 4; i++) tone(t + i * 0.07, { f: 500 + i * 90, f2: 800 + i * 90, dur: 0.06, type: 'sine', vol: 0.2 }); },
  heal: t => notes(t, [[N(72), 0, 0.1], [N(76), 0.08, 0.1], [N(79), 0.16, 0.1], [N(84), 0.24, 0.25]], { type: 'triangle', vol: 0.2 }),
  orb: t => { tone(t, { f: 300, f2: 1400, dur: 0.35, type: 'sine', vol: 0.22 }); tone(t + 0.1, { f: 600, f2: 2000, dur: 0.3, type: 'triangle', vol: 0.12 }); noise(t, { dur: 0.4, vol: 0.08, freq: 3000, q: 4 }); },
  throw: t => noise(t, { dur: 0.2, vol: 0.25, freq: 400, freq2: 2500, q: 1.5 }),
  drop: t => tone(t, { f: 260, f2: 160, dur: 0.08, type: 'triangle', vol: 0.25 }),
  // progreso
  levelup: t => { notes(t, [[N(72), 0, 0.12], [N(76), 0.12, 0.12], [N(79), 0.24, 0.12], [N(84), 0.36, 0.4]], { type: 'square', vol: 0.15 }); notes(t, [[N(60), 0, 0.36], [N(67), 0.36, 0.4]], { type: 'triangle', vol: 0.18 }); },
  learn: t => notes(t, [[N(79), 0, 0.1], [N(84), 0.1, 0.1], [N(88), 0.2, 0.3]], { type: 'square', vol: 0.14 }),
  recruit: t => { notes(t, [[N(76), 0, 0.12], [N(79), 0.12, 0.12], [N(84), 0.24, 0.12], [N(88), 0.36, 0.12], [N(91), 0.48, 0.45]], { type: 'square', vol: 0.14 }); notes(t, [[N(64), 0, 0.48], [N(67), 0.48, 0.45]], { type: 'triangle', vol: 0.16 }); },
  stairs: t => { for (let i = 0; i < 5; i++) tone(t + i * 0.07, { f: N(79 - i * 3), dur: 0.08, type: 'square', vol: 0.12 }); noise(t + 0.2, { dur: 0.35, vol: 0.12, freq: 800, freq2: 200 }); },
  // estadísticas y estados
  statUp: t => { for (let i = 0; i < 4; i++) tone(t + i * 0.05, { f: N(72 + i * 4), dur: 0.07, type: 'square', vol: 0.11 }); },
  statDown: t => { for (let i = 0; i < 4; i++) tone(t + i * 0.05, { f: N(84 - i * 4), dur: 0.07, type: 'square', vol: 0.11 }); },
  status: t => { tone(t, { f: 200, f2: 400, dur: 0.18, type: 'sawtooth', vol: 0.12 }); tone(t + 0.1, { f: 180, f2: 260, dur: 0.2, type: 'square', vol: 0.1 }); },
  // avisos
  hunger: t => { tone(t, { f: 180, f2: 120, dur: 0.18, type: 'triangle', vol: 0.3 }); tone(t + 0.22, { f: 160, f2: 100, dur: 0.22, type: 'triangle', vol: 0.3 }); },
  wind: t => noise(t, { dur: 1.2, vol: 0.2, freq: 500, freq2: 1400, q: 6 }),
  alarm: t => { for (let i = 0; i < 4; i++) { tone(t + i * 0.24, { f: 880, dur: 0.12, type: 'square', vol: 0.14 }); tone(t + i * 0.24 + 0.12, { f: 660, dur: 0.12, type: 'square', vol: 0.14 }); } },
  kecleon: t => notes(t, [[N(84), 0, 0.12], [N(79), 0.12, 0.2]], { type: 'triangle', vol: 0.2 }),
  // menús
  cursor: t => tone(t, { f: 1100, dur: 0.03, type: 'square', vol: 0.07 }),
  confirm: t => notes(t, [[N(88), 0, 0.04], [N(95), 0.04, 0.07]], { type: 'square', vol: 0.09 }),
  cancel: t => notes(t, [[N(83), 0, 0.04], [N(76), 0.04, 0.07]], { type: 'square', vol: 0.09 }),
};
const lastSfx = {};
export function playSfx(name) {
  if (!SFX[name] || sfxVol <= 0 || !ensureCtx()) return;
  const now = ctx.currentTime;
  if (lastSfx[name] && now - lastSfx[name] < 0.04) return;   // evita amontonar el mismo sonido
  lastSfx[name] = now; SFX[name](now + 0.005);
}
if (typeof window !== 'undefined') window.__mmSfx = n => playSfx(n);
