// =====================================================================
// HISTORIA: capítulos, frases nuevas de los personajes y cartas de Murkrow.
// Todo el texto de la historia vive aquí, para poder revisarlo sin tocar el código del juego.
// (El trasfondo NO se escribe aquí: este archivo es público. Está en DESIGN.md, en el repositorio privado.)
// =====================================================================
import { rankOf } from './data.js';
// Capítulo actual, a partir de hitos que ya existen (no se guarda aparte)
export function chapterOf(m) {
  const cleared = m?.cleared || [], rank = rankOf(m?.rankPts || 0), deep = m?.stats?.deepestBy?.tiempo || 0;
  if (deep >= 100) return 8;   // el fondo de la Mazmorra del Tiempo
  if (deep >= 50) return 7;    // los ecos empiezan a reconocerte
  if (rank >= 4) return 6;     // Diamante: el despacho de Pidgeot
  if (rank >= 3) return 5;     // Oro
  if (rank >= 2) return 4;     // Plata
  if (rank >= 1) return 3;     // Bronce
  if (cleared.includes('bosque')) return 2;   // se abre la Fuente
  if (m?.tutorialDone || cleared.includes('entrenamiento')) return 1;
  return 0;
}

// ---------- cartas: el servidor las entrega al llegar a su capítulo; se leen en el buzón de la plaza ----------
// from: quién firma (si es un personaje, sale su retrato: sp). murkrow: lo que comenta Murkrow la primera vez que se lee.
export const LETTERS = [
  { id: 'bienvenida', chapter: 1, from: 'Pidgeot', sp: 'pidgeot', title: 'Una nota del maestro', pages: [
    'Chatot insiste en que te escriba unas palabras de bienvenida.',
    'Bienvenido.' ] },
  { id: 'normas-47', chapter: 2, from: 'Chatot', sp: 'chatot', title: 'Normas del gremio (revisión 47)', pages: [
    'Uno: no se corre por los pasillos. Dos: no se toca la rejilla. Tres: lo que se entrega al maestro se deja en la bandeja de la puerta, no en el suelo. Ya van dos cosas que se pierden.',
    'Cuatro: las normas no se discuten.' ] },
];
export const letterById = id => LETTERS.find(l => l.id === id);
// entrega las cartas que tocan (devuelve cuántas nuevas); meta.mail = [{ id, at, read }]
export function deliverMail(m, now = Date.now()) {
  const ch = chapterOf(m), have = new Set((m.mail ||= []).map(x => x.id)); let n = 0;
  for (const l of LETTERS) if (l.chapter <= ch && !have.has(l.id)) { m.mail.push({ id: l.id, at: now, read: false }); n++; }
  return n;
}

// ---------- frases nuevas: al empezar un capítulo, estos personajes dicen algo nuevo una sola vez ----------
// Clave: la de su conversación (la misma que en el juego). then: false = no sigue con su conversación de siempre.
// Frases de Sableye (el tasador). La de tasador se usará cuando abra el Café de Spinda.
export const SABLEYE_LINES = {
  helpingGulpin: '¡Hola! Tú eres nuevo, ¿verdad? Estoy echando una mano a Gulpin con su cabaña. La tasación, cerrada por un tiempo. ¡Je!',
  appraiser: '¡Bienvenido! Soy Sableye, tasador de cofres. Llevo aquí más años que la mitad del gremio, ¡je! Si te sale un cofre en alguna mazmorra, tráemelo y te lo abro sin romper nada de dentro. ¡Palabra de tasador!',
};
export const STORY_LINES = {
  gulpin: {   // al llegar a Bronce, Sableye se ha ido del mercado
    3: [{ text: '¡Gulp! Sableye ya se ha ido. Me ayudó a construir… y después a reparar mi cabaña. Es muy buena persona. Ahora está en el Café de Spinda… haciendo de tasador.', mood: 'Happy' },
        { text: '… Por cierto, ¿qué es un tasador? Gulp.', mood: 'Normal' }],
  },
};
// La frase de capítulo pendiente para un personaje (o null). seen: conjunto de «personaje:capítulo» ya dichos.
export function storyLineFor(key, m, seen) {
  const byCh = STORY_LINES[key]; if (!byCh) return null;
  const ch = chapterOf(m);
  for (let c = ch; c >= 1; c--) if (byCh[c]) return seen.has(`${key}:${c}`) ? null : { chapter: c, pages: byCh[c], then: byCh.then !== false };
  return null;
}
