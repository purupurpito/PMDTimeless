import { API_URL } from './config.js';

let token = localStorage.getItem('mm_token');
export const setToken = t => { token = t; t ? localStorage.setItem('mm_token', t) : localStorage.removeItem('mm_token'); };
export const hasToken = () => !!token;

// Estado de la conexión para el aviso de la pantalla: 'waking' (esperando), 'retry' (reintentando), 'down' (sin conexión), 'ok'
let netListener = null;
export const onNetStatus = fn => { netListener = fn; };
const notify = (s, n) => { try { netListener?.(s, n); } catch {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Cada petición tiene tiempo límite y se reintenta si falla la conexión (no si el servidor responde con un error).
// Los servidores gratuitos se duermen: la primera petición puede tardar ~1 min, así que el primer intento espera más.
// X-Request-Id es el mismo en todos los intentos: si una petición llegó pero se perdió la respuesta, el servidor
// devuelve la misma respuesta en vez de aplicarla dos veces (nada se cobra ni se cierra dos veces).
const FIRST_TIMEOUT = 90000, RETRY_TIMEOUT = 25000, TRIES = 3;
export const newRequestId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
// rid: identificador propio (para reenviar más tarde la misma petición); keepalive: se completa aunque se cierre la pestaña
export async function api(path, body, { onWaking, rid = newRequestId(), keepalive = false } = {}) {
  for (let attempt = 1; ; attempt++) {
    const ctrl = new AbortController();
    const wakeTimer = setTimeout(() => { onWaking?.(); notify('waking'); }, 2500);
    const killTimer = setTimeout(() => ctrl.abort(), window.__mmNetTimeout || (attempt === 1 ? FIRST_TIMEOUT : RETRY_TIMEOUT));   // __mmNetTimeout: solo para pruebas
    try {
      const res = await fetch(API_URL + path, {
        method: body !== undefined ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': rid, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal, keepalive,
      });
      const data = await res.json().catch(() => ({}));
      notify('ok');
      if (!res.ok) { if (res.status === 401) setToken(null); throw new ApiError(data.error || `Error ${res.status}`, res.status); }
      return data;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (attempt >= TRIES || keepalive) { notify('down'); throw new ApiError('No se puede hablar con el servidor. Revisa tu conexión e inténtalo de nuevo.', 0); }
      notify('retry', attempt); await sleep(1500 * attempt);
    } finally { clearTimeout(wakeTimer); clearTimeout(killTimer); }
  }
}
export class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
