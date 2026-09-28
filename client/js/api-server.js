import { API_URL } from './config.js';

let token = localStorage.getItem('mm_token');
export const setToken = t => { token = t; t ? localStorage.setItem('mm_token', t) : localStorage.removeItem('mm_token'); };
export const hasToken = () => !!token;

// Los servidores gratuitos se duermen: la primera petición puede tardar ~1 min. onWaking avisa al usuario.
export async function api(path, body, { onWaking } = {}) {
  const ctrl = new AbortController();
  const wakeTimer = setTimeout(() => onWaking?.(), 2500);
  try {
    const res = await fetch(API_URL + path, {
      method: body !== undefined ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { if (res.status === 401) setToken(null); throw new ApiError(data.error || `Error ${res.status}`, res.status); }
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('No se puede hablar con el servidor. ¿Está despierto?', 0);
  } finally { clearTimeout(wakeTimer); }
}
export class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
