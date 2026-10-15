// =====================================================================
// IDIOMAS — textos del juego en español (por defecto) e inglés.
// t('clave', { dato }) devuelve el texto en el idioma activo; si falta en ese idioma, el español; si tampoco
// existe, la propia clave (así un olvido se ve enseguida en pantalla). Los datos van entre llaves: «{nombre}».
// En el navegador el idioma se guarda en localStorage (mm_lang) y en la cuenta (meta.lang); en el servidor, cada
// respuesta usa el de la cuenta (o el que manda el navegador en la cabecera X-Lang si aún no hay sesión).
// =====================================================================
import { SPECIES_EN, TYPE_EN, MOVE_EN, ABILITY_EN, ITEM_EN } from './names-en.js';

export const LANGS = { es: 'Español', en: 'English' };
export const DEFAULT_LANG = 'es';
export const validLang = l => Object.hasOwn(LANGS, l) ? l : DEFAULT_LANG;

export const DICT = {
  es: {
    'opciones.idioma': 'Idioma',
    'opciones.marco': 'Color del marco',
    'opciones.titulo': 'Opciones',
    'opciones.musica': 'Música',
    'opciones.efectos': 'Efectos',
    'opciones.silencio': 'Silencio',
    'opciones.tamano': 'Tamaño de pantalla',
    'opciones.ajustar': 'Ajustar',
    'opciones.datos': 'Enviar datos de juego (beta)',
    'opciones.mando': 'Mando en pantalla',
    'opciones.vista': 'Vista de mazmorra',
    'opciones.vista.cercana': 'Cercana',
    'opciones.vista.amplia': 'Amplia',
    'opciones.buzon': 'Enviar un comentario o un fallo',
    'opciones.info': 'Información',
    'opciones.mensajes': 'Mensajes',
    'opciones.dentro': 'Dentro',
    'opciones.fuera': 'Fuera',
    'opciones.oculta': 'Oculta',
    'opciones.color.azul': 'Azul',
    'opciones.color.rojo': 'Rojo',
    'opciones.color.verde': 'Verde',
    'opciones.color.morado': 'Morado',
    'opciones.color.dorado': 'Dorado',
    'opciones.color.gris': 'Gris',
    'buzon.gracias': '¡Gracias! Lo hemos recibido.',
    'buzon.aria': 'Comentario o fallo',
    'buzon.titulo': 'Cuéntanos qué ha pasado',
    'buzon.tipo': 'Tipo',
    'buzon.fallo': 'Un fallo',
    'buzon.idea': 'Una idea',
    'buzon.otro': 'Otra cosa',
    'buzon.ph': 'Qué estabas haciendo, qué esperabas que pasara y qué pasó…',
    'buzon.cancelar': 'Cancelar',
    'buzon.enviar': 'Enviar',
    'buzon.error': 'No se ha podido enviar. Prueba otra vez.',
    'err.login': '¿Tú también te has olvidado del código secreto?',
    'err.feedback.corto': 'Cuéntanos un poco más (al menos unas palabras).',
    'hud.explorador': "Explorador",
    'hud.lugar': "Lugar",
    'hud.barriga': "Barriga",
    'hud.experiencia': "Experiencia",
    'hud.pokes': "Pokés",
    'hud.banco': "Pokés (banco)",
    'hud.rango': "Rango",
    'hud.salir': "Salir",
    'hud.gremio': "Gremio",
    'hud.debes': "debes {n}",
    'hud.eco': "eco de {d}",
    'hud.nv': "Nv {n}",
    'hud.rapido': "Rápido",
    'hud.lento': "Lento",
    'panel.movimientos': "Movimientos",
    'panel.estadisticas': "Estadísticas",
    'panel.equipo': "Equipo",
    'panel.misiones': "Misiones activas",
    'panel.bolsa': "Bolsa",
    'panel.usar': "Usar (o {k})",
    'panel.potencia': "potencia {n}",
    'panel.estado': "estado",
    'panel.linea': "en línea",
    'panel.hasta': "hasta {n} casillas",
    'panel.sala': "toda la sala",
    'panel.alrededor': "a tu alrededor",
    'panel.frente': "de frente",
    'panel.ataque': "Ataque {a} · Defensa {d}",
    'panel.especial': "At. Esp. {a} · Def. Esp. {d}",
    'panel.equipado': "Equipado: {o}",
    'panel.solitario': "En solitario",
    'panel.ninguna': "Ninguna",
    'panel.nada': "Nada",
    'panel.nvEquipo': "Nv{n}",
    'mision.derrotar': "Derrota a",
    'mision.explorar': "Explora hasta",
    'mision.encontrar': "Encuentra un objeto perdido en",
    'mision.rescatar': "Rescata a",
    'mision.entregar': "Entrega",
    'mision.forajido': "Captura al forajido",
    'rango.0': "Novato",
    'rango.1': "Bronce",
    'rango.2': "Plata",
    'rango.3': "Oro",
    'rango.4': "Diamante",
    'rango.5': "Maestro",
    'estado.poison': "Envenenado",
    'estado.burn': "Quemado",
    'estado.paralysis': "Paralizado",
    'estado.sleep': "Dormido",
    'estado.confusion': "Confuso",
    'estado.freeze': "Congelado",
    'clima.none': "Despejado",
    'clima.sun': "Sol",
    'clima.rain': "Lluvia",
    'clima.fog': "Niebla",
    'clima.sand': "Tormenta de arena",
    'clima.hail': "Granizo",
  },
  en: {
    'opciones.idioma': 'Language',
    'opciones.marco': 'Frame colour',
    'opciones.titulo': 'Options',
    'opciones.musica': 'Music',
    'opciones.efectos': 'Sounds',
    'opciones.silencio': 'Off',
    'opciones.tamano': 'Screen size',
    'opciones.ajustar': 'Fit',
    'opciones.datos': 'Send gameplay data (beta)',
    'opciones.mando': 'On-screen controls',
    'opciones.vista': 'Dungeon view',
    'opciones.vista.cercana': 'Close',
    'opciones.vista.amplia': 'Wide',
    'opciones.buzon': 'Send feedback or report a bug',
    'opciones.info': 'Info panel',
    'opciones.mensajes': 'Messages',
    'opciones.dentro': 'Inside',
    'opciones.fuera': 'Outside',
    'opciones.oculta': 'Hidden',
    'opciones.color.azul': 'Blue',
    'opciones.color.rojo': 'Red',
    'opciones.color.verde': 'Green',
    'opciones.color.morado': 'Purple',
    'opciones.color.dorado': 'Gold',
    'opciones.color.gris': 'Grey',
    'buzon.gracias': 'Thank you! We got it.',
    'buzon.aria': 'Feedback or bug',
    'buzon.titulo': 'Tell us what happened',
    'buzon.tipo': 'Type',
    'buzon.fallo': 'A bug',
    'buzon.idea': 'An idea',
    'buzon.otro': 'Something else',
    'buzon.ph': 'What were you doing, what did you expect to happen, and what happened instead…',
    'buzon.cancelar': 'Cancel',
    'buzon.enviar': 'Send',
    'buzon.error': "Couldn't send it. Please try again.",
    'err.login': 'Did you forget your secret code too?',
    'err.feedback.corto': 'Tell us a little more (at least a few words).',
    'hud.explorador': "Explorer",
    'hud.lugar': "Location",
    'hud.barriga': "Belly",
    'hud.experiencia': "Experience",
    'hud.pokes': "Poké",
    'hud.banco': "Poké (bank)",
    'hud.rango': "Rank",
    'hud.salir': "Log out",
    'hud.gremio': "Guild",
    'hud.debes': "owe {n}",
    'hud.eco': "echo of {d}",
    'hud.nv': "Lv. {n}",
    'hud.rapido': "Fast",
    'hud.lento': "Slow",
    'panel.movimientos': "Moves",
    'panel.estadisticas': "Stats",
    'panel.equipo': "Team",
    'panel.misiones': "Active jobs",
    'panel.bolsa': "Bag",
    'panel.usar': "Use (or {k})",
    'panel.potencia': "power {n}",
    'panel.estado': "status",
    'panel.linea': "straight line",
    'panel.hasta': "up to {n} tiles",
    'panel.sala': "whole room",
    'panel.alrededor': "all around",
    'panel.frente': "in front",
    'panel.ataque': "Attack {a} · Defence {d}",
    'panel.especial': "Sp. Atk {a} · Sp. Def {d}",
    'panel.equipado': "Held: {o}",
    'panel.solitario': "On your own",
    'panel.ninguna': "None",
    'panel.nada': "Nothing",
    'panel.nvEquipo': "Lv.{n}",
    'mision.derrotar': "Defeat",
    'mision.explorar': "Explore to",
    'mision.encontrar': "Find a lost item in",
    'mision.rescatar': "Rescue",
    'mision.entregar': "Deliver to",
    'mision.forajido': "Catch the outlaw",
    'rango.0': "Novice",
    'rango.1': "Bronze",
    'rango.2': "Silver",
    'rango.3': "Gold",
    'rango.4': "Diamond",
    'rango.5': "Master",
    'estado.poison': "Poisoned",
    'estado.burn': "Burned",
    'estado.paralysis': "Paralysed",
    'estado.sleep': "Asleep",
    'estado.confusion': "Confused",
    'estado.freeze': "Frozen",
    'clima.none': "Clear",
    'clima.sun': "Sunny",
    'clima.rain': "Rain",
    'clima.fog': "Fog",
    'clima.sand': "Sandstorm",
    'clima.hail': "Hail",
  },
};

const fill = (s, data) => data ? s.replace(/\{(\w+)\}/g, (m, k) => k in data ? String(data[k]) : m) : s;
// Texto en un idioma concreto (el servidor lo usa con el de cada cuenta)
export const tr = (lang, key, data) => fill(DICT[validLang(lang)][key] ?? DICT[DEFAULT_LANG][key] ?? key, data);

// Nombres oficiales (Pokémon, tipos, movimientos, habilidades, objetos). El juego los guarda siempre en castellano (son
// claves de sus tablas): solo se traducen al enseñarlos. nameIn('en', 'move', 'Lanzallamas') → 'Flamethrower'.
// Pokémon y habilidades van por su clave ('pikachu', 'STATIC'): `fallback` es el nombre en castellano que se enseña si no.
// Mazmorras y zonas de la aldea (propias del juego: sus nombres en inglés son nuestros), por su id.
export const DUNGEON_EN = {
  entrenamiento: 'Training Grounds', bosque: 'Lush Woods', cueva: 'Dripping Cave', huerto: "Spinda's Orchard", brumas: 'Misty Woods',
  sierra: 'Smoulder Ridge', gelida: 'Frostbite Peak', monte: 'Mt. Thunderclap', ruinas: 'Forgotten Ruins',
  tiempo: 'Dungeon of Time', suenos: 'Dungeon of Dreams',
};
export const AREA_EN = {
  plaza: 'Guild Square', gremio: "Pidgeot's Guild", descanso: 'Rest Area', mercado: 'Market', aldea: 'Village',
  fuente: 'Evolution Fountain', barrio: 'Neighbourhood', observatorio: 'Observatory', campamento: 'Expedition Camp',
};
const NAMES = { species: SPECIES_EN, type: TYPE_EN, move: MOVE_EN, ability: ABILITY_EN, item: ITEM_EN, dungeon: DUNGEON_EN, area: AREA_EN };
export const nameIn = (lang, kind, key, fallback = key) => (validLang(lang) !== DEFAULT_LANG && NAMES[kind]?.[key]) || fallback;
// Al revés: del nombre en inglés a la clave en castellano (para reconocer un objeto en un texto ya traducido)
const REVERSE = {};
export const nameKey = (kind, shown) => (REVERSE[kind] ??= Object.fromEntries(Object.entries(NAMES[kind] || {}).map(([k, v]) => [v, k])))[shown];

// Idioma activo (navegador)
const store = typeof localStorage !== 'undefined' ? localStorage : null;
let current = (() => { try { return validLang(store?.getItem('mm_lang')); } catch { return DEFAULT_LANG; } })();
const listeners = new Set();
export const getLang = () => current;
export const t = (key, data) => tr(current, key, data);
export const nm = (kind, key, fallback) => nameIn(current, kind, key, fallback);
export function setLang(lang) {
  lang = validLang(lang);
  try { store?.setItem('mm_lang', lang); } catch { /* navegación privada */ }
  if (lang === current) return;
  current = lang;
  for (const fn of listeners) { try { fn(lang); } catch { /* que un fallo no corte a los demás */ } }
}
export const onLangChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };

// Textos fijos de la página: los elementos con data-i18n="clave" se rellenan (y se vuelven a rellenar al cambiar de idioma);
// data-i18n-aria, su aria-label, y data-i18n-ph, su placeholder
export function applyDomText(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return;
  if (root.documentElement) root.documentElement.lang = current;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
}
