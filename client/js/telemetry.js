// =====================================================================
// Telemetría de la beta: el juego apunta lo que pasa (qué te mata, qué objetos usas, cuánto duras en cada piso,
// errores…) y lo envía al servidor en lotes. Solo datos de juego: nada personal. Se puede desactivar en el menú ☰.
// =====================================================================
import { api, hasToken } from './api.js';
import { VERSION } from '../../shared/version.js';

const OFF_KEY = 'pmdt_telemetry_off', MAX_QUEUE = 400;
const queue = [];
let timer = null, context = () => ({});

export const telemetryOn = () => { try { return localStorage.getItem(OFF_KEY) !== '1'; } catch { return true; } };
export const setTelemetry = on => { try { on ? localStorage.removeItem(OFF_KEY) : localStorage.setItem(OFF_KEY, '1'); } catch {} if (!on) queue.length = 0; };
// contexto que se añade a cada evento (dónde está el jugador, con qué Pokémon…)
export const setTelemetryContext = fn => { context = fn; };

// Apunta un evento. type: palabra corta (p. ej. 'death', 'item_use'); data: datos pequeños del evento.
export function track(type, data = {}) {
  if (!telemetryOn()) return;
  let ctx = {}; try { ctx = context() || {}; } catch {}
  queue.push({ type, t: Date.now(), data: { ...ctx, ...data } });
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);   // sin conexión mucho rato: se quedan los más recientes
  if (queue.length >= 40) flushTelemetry(); else if (!timer) timer = setTimeout(flushTelemetry, 30000);
}

// Envía lo apuntado. keepalive: al cerrar la pestaña (la petición se completa aunque la página se vaya).
export function flushTelemetry(keepalive = false) {
  clearTimeout(timer); timer = null;
  if (!queue.length || !hasToken()) return;   // sin sesión todavía (p. ej. durante el test): se envía al entrar
  const batch = queue.splice(0, 200);
  api('/telemetry', { v: VERSION, events: batch }, { keepalive }).catch(() => { if (!keepalive) queue.unshift(...batch); });
  if (queue.length) timer = setTimeout(flushTelemetry, 5000);
}

// Errores de programación: se apuntan (una vez cada uno por sesión) para poder arreglarlos
const seenErrors = new Set();
function reportError(message, where, stack) {
  const key = `${message}@${where}`; if (seenErrors.has(key) || seenErrors.size > 30) return; seenErrors.add(key);
  track('js_error', { message: String(message).slice(0, 200), where: String(where || '').replace(/\?.*$/, '').split('/').slice(-2).join('/').slice(0, 100), stack: String(stack || '').slice(0, 400) });
}
if (typeof window !== 'undefined') {
  window.addEventListener('error', e => reportError(e.message, `${e.filename}:${e.lineno}:${e.colno}`, e.error?.stack));
  window.addEventListener('unhandledrejection', e => reportError(e.reason?.message || e.reason, 'promesa', e.reason?.stack));
  window.addEventListener('pagehide', () => flushTelemetry(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushTelemetry(true); });
}

// Datos del dispositivo (sin nada que identifique a nadie): táctil o no, tamaño de pantalla, navegador y sistema
export function deviceInfo() {
  const ua = navigator.userAgent || '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Otro';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Otro';
  const touch = !!window.matchMedia?.('(pointer: coarse)').matches;
  return { device: touch ? 'móvil/tableta' : 'ordenador', browser, os, w: window.innerWidth, h: window.innerHeight, lang: (navigator.language || '').slice(0, 5) };
}
