// =====================================================================
// IDIOMAS — textos del juego en español (por defecto) e inglés.
// t('clave', { dato }) devuelve el texto en el idioma activo; si falta en ese idioma, el español; si tampoco
// existe, la propia clave (así un olvido se ve enseguida en pantalla). Los datos van entre llaves: «{nombre}».
// En el navegador el idioma se guarda en localStorage (mm_lang) y en la cuenta (meta.lang); en el servidor, cada
// respuesta usa el de la cuenta (o el que manda el navegador en la cabecera X-Lang si aún no hay sesión).
// =====================================================================
export const LANGS = { es: 'Español', en: 'English' };
export const DEFAULT_LANG = 'es';
export const validLang = l => Object.hasOwn(LANGS, l) ? l : DEFAULT_LANG;

export const DICT = {
  es: {
    'opciones.idioma': 'Idioma',
    'opciones.marco': 'Color del marco',
    'buzon.gracias': '¡Gracias! Lo hemos recibido.',
    'err.login': '¿Tú también te has olvidado del código secreto?',
    'err.feedback.corto': 'Cuéntanos un poco más (al menos unas palabras).',
  },
  en: {
    'opciones.idioma': 'Language',
    'opciones.marco': 'Frame colour',
    'buzon.gracias': 'Thank you! We got it.',
    'err.login': 'Did you forget your secret code too?',
    'err.feedback.corto': 'Tell us a little more (at least a few words).',
  },
};

const fill = (s, data) => data ? s.replace(/\{(\w+)\}/g, (m, k) => k in data ? String(data[k]) : m) : s;
// Texto en un idioma concreto (el servidor lo usa con el de cada cuenta)
export const tr = (lang, key, data) => fill(DICT[validLang(lang)][key] ?? DICT[DEFAULT_LANG][key] ?? key, data);

// Idioma activo (navegador)
const store = typeof localStorage !== 'undefined' ? localStorage : null;
let current = (() => { try { return validLang(store?.getItem('mm_lang')); } catch { return DEFAULT_LANG; } })();
const listeners = new Set();
export const getLang = () => current;
export const t = (key, data) => tr(current, key, data);
export function setLang(lang) {
  lang = validLang(lang);
  try { store?.setItem('mm_lang', lang); } catch { /* navegación privada */ }
  if (lang === current) return;
  current = lang;
  for (const fn of listeners) { try { fn(lang); } catch { /* que un fallo no corte a los demás */ } }
}
export const onLangChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };

// Textos fijos de la página: los elementos con data-i18n="clave" se rellenan (y se vuelven a rellenar al cambiar de idioma)
export function applyDomText(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return;
  if (root.documentElement) root.documentElement.lang = current;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
}
