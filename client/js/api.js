// Web (GitHub Pages): el juego usa el servidor (cuentas en la nube). Si el servidor no responde, se puede jugar
// sin conexión con el servidor local (api-local.js), que guarda la partida en este navegador.
// En la web publicada este archivo sustituye a api.js; el cliente del servidor pasa a ser api-server.js.
import * as remote from './api-server.js';
import * as local from './api-local.js';

const MODE_KEY = 'pmdt_mode';
const isLocal = () => { try { return localStorage.getItem(MODE_KEY) === 'local'; } catch { return false; } };
const backend = () => isLocal() ? local : remote;

export const ApiError = remote.ApiError;
export const onNetStatus = fn => remote.onNetStatus(fn);
export const newRequestId = () => remote.newRequestId();   // el aviso de conexión (sin conexión no hace falta)
export const setToken = t => backend().setToken(t);
export const hasToken = () => backend().hasToken();
export async function api(path, body, opts) {
  try { return await backend().api(path, body, opts); }
  catch (e) { throw e instanceof remote.ApiError ? e : new remote.ApiError(e.message, e.status ?? 0); }   // mismos errores en los dos modos
}
// para la pantalla de inicio: saber el modo y cambiarlo
window.__netMode = {
  current: () => isLocal() ? 'local' : 'server',
  setLocal: () => { try { localStorage.setItem(MODE_KEY, 'local'); } catch {} location.reload(); },
  setServer: () => { try { localStorage.removeItem(MODE_KEY); } catch {} location.reload(); },
};
