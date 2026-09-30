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

// ---------------------------------------------------------------------
// Escenas (docs/ESCENAS.md): guiones que reproduce client/js/scenes.js. `when(meta)` dice cuándo toca; se ven una vez.
// ---------------------------------------------------------------------
export const SCENES = [
  {
    id: 'acto1-bandeja', when: m => chapterOf(m) >= 3,   // al llegar a Bronce: la noche en que desaparece la bandeja
    area: 'plaza', night: true, hidePlayer: true, hideNpcs: true, cam: { x: 84, y: 40 }, music: 'tension',
    lights: [{ x: 384, y: 172, r: 70 }],
    actors: { chatot: { sp: 'chatot', x: 384, y: 172, dir: 'down', hidden: true }, sombra: { sp: 'sombra', x: 384, y: 575, dir: 'up' } },
    objects: { bandeja: { kind: 'tray', x: 432, y: 196 } },
    steps: [
      { do: 'narration', text: 'Mientras tanto…', ms: 2400 },
      { do: 'fade', to: 'in', ms: 800 },
      { do: 'wait', ms: 800 },
      { do: 'move', who: 'sombra', to: [[384, 330], [396, 262], [418, 218]], speed: 0.55 },   // despacio, con cautela
      { do: 'emote', who: 'sombra', fx: 'dots' },
      { do: 'wait', ms: 600 },
      { do: 'object', id: 'bandeja', action: 'flicker-hide', ms: 500 },
      { do: 'move', who: 'sombra', to: [[396, 262], [384, 330], [384, 575]], speed: 2.4 },   // y se va deprisa
      { do: 'fade', to: 'out', ms: 800 },
      { do: 'set', night: false },
      { do: 'narration', text: 'A la mañana siguiente…', ms: 2400 },
      { do: 'show', who: 'chatot' },
      { do: 'fade', to: 'in', ms: 800 },
      { do: 'move', who: 'chatot', to: [[384, 206], [406, 206]], speed: 1 },   // baja y gira a la derecha, hasta el hueco
      { do: 'turn', who: 'chatot', dir: 'right' },
      { at: [{ do: 'emote', who: 'chatot', fx: 'shock', se: 'shock', nowait: true }, { do: 'anim', who: 'chatot', anim: 'Charge', hold: true }] },
      { do: 'wait', ms: 700 },
      { do: 'say', who: 'chatot', mood: 'Surprised', text: '¡¿Dónde está la bandeja de las entregas?! ¡Anoche estaba aquí, aquí mismo!' },
      { do: 'anim', who: 'chatot', anim: 'Idle' },
      { do: 'emote', who: 'chatot', fx: 'anger', hold: true },
      { do: 'say', who: 'chatot', mood: 'Angry', text: '… Gulpin. Tiene que haber sido Gulpin. ¡Ese se lo come todo!' },
      { do: 'emote', who: 'chatot', fx: 'none' },
      { do: 'fade', to: 'out', ms: 600 },
    ],
  },
  {
    // La primera vez que vas a las mazmorras, Chatot llega corriendo… porque él es el jefe del Campo de Entrenamiento
    id: 'chatot-mazmorras', trigger: 'dungeon-exit', when: m => !(m.cleared || []).includes('entrenamiento'),
    area: 'aldea', startDark: false,
    actors: { chatot: { sp: 'chatot', x: 384, y: -40, dir: 'down' } },
    steps: [
      { do: 'move', who: 'chatot', to: [[384, 212], [454, 256]], speed: 2.4 },   // llega corriendo por el camino y rodea la fuente (ruta sacada del mapa de colisiones)
      { at: [{ do: 'move', who: 'chatot', to: [[454, 334], [384, 392]], speed: 2.4 }, { do: 'turn', who: 'player', dir: 'up' }, { do: 'emote', who: 'player', fx: 'exclaim', nowait: true }] },
      { do: 'anim', who: 'chatot', anim: 'Hop', ms: 450 },
      { do: 'say', who: 'chatot', mood: 'Happy', text: '¡Hey, Recluta! ¿Vas ya hacia las mazmorras?' },
      { do: 'turn', who: 'chatot', dir: 'right' },
      { do: 'emote', who: 'chatot', fx: 'sweat' },
      { do: 'say', who: 'chatot', mood: 'Worried', text: 'Qué casualidad. Yo también iba…' },
      { do: 'turn', who: 'chatot', dir: 'down' },
      { do: 'anim', who: 'chatot', anim: 'Pose', hold: true },
      { do: 'say', who: 'chatot', mood: 'Inspired', text: 'Bueno, mucha suerte ahí dentro.' },
      { do: 'say', who: 'chatot', mood: 'Inspired', text: 'Espero que no te encuentres ningún jefe demasiado poderoso, carismático, apuesto, que cante bien…' },
      { do: 'anim', who: 'chatot', anim: 'Appeal', hold: true },   // y sigue, y sigue…
      { do: 'say', who: 'chatot', mood: 'Joyous', auto: 2800, text: '…que baile de maravilla, con un plumaje precioso, una voz privilegiada, un porte de lo más elegante, una memoria prodigiosa para las normas del gremio, una puntualidad…' },
      { do: 'emote', who: 'player', fx: 'dots' },
      { do: 'wait', ms: 900 },
      { at: [{ do: 'anim', who: 'chatot', anim: 'Hop', ms: 450 }, { do: 'emote', who: 'chatot', fx: 'shock', se: 'shock' }] },   // se da cuenta de que lleva un buen rato hablando
      { do: 'anim', who: 'chatot', anim: 'Idle' },
      { do: 'say', who: 'chatot', mood: 'Shouting', text: '¡Bueno, no tengo mucho tiempo para seguir escuchándote! Me voy, que tengo prisa.' },
      { at: [{ do: 'move', who: 'chatot', to: [[408, 452], [408, 488], [384, 504], [384, 560]], speed: 3 }, { do: 'turn', who: 'player', dir: 'down' }] },   // y se va corriendo por tu lado… hacia las mazmorras (ruta comprobada con el mapa de colisiones)
      { do: 'hide', who: 'chatot' },
      { do: 'emote', who: 'player', fx: 'question' },
      { do: 'wait', ms: 500 },
    ],
  },
  {
    // Rango Plata: la sombra de un pájaro cruza muy alto, cae un cartel de «SE BUSCA» delante del gremio… y Murkrow,
    // desde su buzón, jura que esa carta no la ha repartido él. (A los Murkrow les gustan las cosas brillantes.)
    id: 'se-busca', when: m => chapterOf(m) >= 4,
    area: 'plaza', player: { x: 384, y: 330, dir: 'up' }, keepPlayer: true, hideNpcIds: ['murkrow'],
    actors: { murkrow: { sp: 'murkrow', x: 315, y: 152, dir: 'down', still: true } },   // en su buzón, quieto
    objects: { carta: { kind: 'paper', x: 392, y: 248, y0: 60, hidden: true } },
    steps: [
      { do: 'fade', to: 'in', ms: 600 },
      { do: 'wait', ms: 800 },
      { do: 'bird', ms: 1100, nowait: true },                                        // una sombra cruza la plaza…
      { do: 'wait', ms: 450 },
      { at: [{ do: 'turn', who: 'player', dir: 'up' }, { do: 'emote', who: 'player', fx: 'question', nowait: true }] },
      { do: 'wait', ms: 900 },
      { do: 'object', id: 'carta', action: 'fall', ms: 2600 },                        // …y cae un papel del cielo
      { do: 'emote', who: 'player', fx: 'exclaim' },
      { do: 'move', who: 'player', to: [[392, 272]], speed: 1 },                      // te acercas y lo recoges
      { do: 'object', id: 'carta', action: 'hide' },
      { do: 'wait', ms: 300 },
      { do: 'poster', kind: 'wanted' },
      { do: 'wait', ms: 400 },
      { do: 'emote', who: 'murkrow', fx: 'shock', se: 'shock' },
      { do: 'say', who: 'murkrow', mood: 'Surprised', text: '¡Crrraaa! ¿Una carta? ¡Esa no la he repartido yo!' },
      { do: 'turn', who: 'player', dir: 'up-left' },
      { do: 'wait', ms: 500 },
      { do: 'emote', who: 'player', fx: 'dots' },                                     // le miras…
      { do: 'wait', ms: 900 },
      { do: 'emote', who: 'murkrow', fx: 'sweat' },
      { do: 'say', who: 'murkrow', mood: 'Worried', text: '¿Qué? ¿Por qué me miras así? … Vale, sí, me gustan las cosas brillantes.' },
      { do: 'say', who: 'murkrow', mood: 'Worried', text: '¡Pero no tanto!' },
      { do: 'emote', who: 'murkrow', fx: 'anger', hold: true },
      { do: 'say', who: 'murkrow', mood: 'Angry', text: '¡Crrraaa! ¡Yo solo reparto el correo!' },
      { do: 'emote', who: 'murkrow', fx: 'none' },
    ],
  },
];
// trigger: 'hub' (al entrar en la aldea) o 'dungeon-exit' (al ir hacia las mazmorras)
export const pendingScene = (m, trigger = 'hub') => SCENES.find(sc => (sc.trigger || 'hub') === trigger && !(m.scenes || []).includes(sc.id) && sc.when(m)) || null;
