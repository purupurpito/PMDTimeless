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
  { id: 'sneasel-nota', when: m => (m.scenes || []).includes('recien-llegado'), from: 'Sneasel', sp: 'sneasel', title: 'Una nota arrugada', pages: [
    'Soy Sneasel. El de la manzana. Sé que nadie te lo ha dicho, pero yo no fui.',
    'Si algún día necesitas a alguien que sepa moverse sin hacer ruido… ya sabes dónde estoy. Mercado, junto a la roca.',
    'P. D.: La manzana era mía. De casa. DE CASA.' ] },
  { id: 'convocatoria', when: m => (m.scenes || []).includes('smeargle-vuelve'), from: 'Chatot', sp: 'chatot', title: 'Copia de la convocatoria', pages: [
    'A todos los equipos exploradores del continente: regresen al gremio de inmediato. Es URGENTE.',
    'Y sí, esto va por ti también, Machamp.',
    'P. D.: Murkrow, la dirección va al dorso. AL DORSO.' ] },
  { id: 'smeargle-gracias', when: m => (m.scenes || []).includes('smeargle-vuelve'), from: 'Smeargle', sp: 'smeargle', title: 'Un papel con manchas de pintura', pages: [
    'Me han dicho que fuiste el primero en verme tirado en la plaza. Gracias. No recuerdo mucho: solo barro, plumas y la voz de Chatot gritando.',
    'Cuando me recupere te dibujaré un retrato. Todavía no sé si saldrás con orejas.' ] },
  { id: 'heracross-savia', when: m => (m.scenes || []).includes('veteranos'), from: 'Heracross', sp: 'heracross', title: 'Una nota escrita con mucha prisa', pages: [
    '¡NOVATO! Mañana, al amanecer, a la cueva. ¡Trae SAVIA! ¡No manzanas! ¡SAVIA!',
    'Si no hay savia, me conformo con miel. Si no hay miel… con manzanas. Pero SAVIA.' ] },
  { id: 'machamp-nota', when: m => (m.scenes || []).includes('veteranos'), from: 'Machamp', sp: 'machamp', title: 'Una nota breve y bien escrita', pages: [
    'Amanecer, en la plaza. No llegues tarde. Trae bayas y calzado seco.',
    'Una cueva no perdona los pies mojados. Ni los despistes.' ] },
  { id: 'normas-47', chapter: 2, from: 'Chatot', sp: 'chatot', title: 'Normas del gremio (revisión 47)', pages: [
    'Uno: no se corre por los pasillos. Dos: no se toca la rejilla. Tres: lo que se entrega al maestro se deja en la bandeja de la puerta. Cuando vuelva a haber bandeja.',
    'Cuatro: NADIE toca lo que no es suyo. Y esto va por quien ya sabe. Cinco: las normas no se discuten.' ] },
];
export const letterById = id => LETTERS.find(l => l.id === id);
// entrega las cartas que tocan (devuelve cuántas nuevas); meta.mail = [{ id, at, read }]
export function deliverMail(m, now = Date.now()) {
  const ch = chapterOf(m), have = new Set((m.mail ||= []).map(x => x.id)); let n = 0;
  for (const l of LETTERS) if ((l.chapter ?? 0) <= ch && (!l.when || l.when(m)) && !have.has(l.id)) { m.mail.push({ id: l.id, at: now, read: false }); n++; }
  return n;
}

// ---------- frases nuevas: al empezar un capítulo, estos personajes dicen algo nuevo una sola vez ----------
// Clave: la de su conversación (la misma que en el juego). then: false = no sigue con su conversación de siempre.
// Frases de Sableye (el tasador). La de tasador se usará cuando abra el Café de Spinda.
export const SABLEYE_LINES = {
  helpingGulpin: '¡Hola! Tú eres nuevo, ¿verdad? Estoy echando una mano a Gulpin con su cabaña. La tasación, cerrada por un tiempo. ¡Je!',
  appraiser: '¡Bienvenido! Soy Sableye, tasador de cofres. Llevo aquí más años que la mitad del gremio, ¡je! Si te sale un cofre en alguna mazmorra, tráemelo y te lo abro sin romper nada de dentro. ¡Palabra de tasador!',
};
const afterWake = m => (m.scenes || []).includes('despertar');   // la mañana en que Chatot descubre que falta la bandeja
export const STORY_LINES = {
  chatot: {   // el día del robo: mejor no molestarle (Mawile ya te lo avisó)
    1: { when: afterWake, then: false, pages: [
      { text: '¡Ahora no, Novato! ¿No ves que estoy OCUPADO?', mood: 'Angry' },
      { text: 'La bandeja de las entregas. Desaparecida. ¡DESAPARECIDA! Con todo lo que había dentro.', mood: 'Shouting' },
      { text: '… Como el maestro se entere de que la he perdido yo… No. No la he perdido yo. Ha sido Gulpin. Seguro.', mood: 'Worried' }] },
    3: [   // Bronce: el segundo robo
      { text: '¡Mi pluma de escribir! ¡DESAPARECIDA! Primero la bandeja, luego una baya de Kangaskhan… y ahora mi pluma.', mood: 'Shouting' },
      { text: 'Y no pienso mirar a nadie. Todavía.', mood: 'Angry' }],
  },
  gulpin: {
    1: { when: afterWake, pages: [   // el primer sospechoso
      { text: 'Gulp… Chatot dice que me he comido la bandeja. Yo no como bandejas. … Creo.', mood: 'Sad' },
      { text: 'Todo el mundo me mira raro. Yo solo como comida. Casi siempre.', mood: 'Worried' }] },
    3: [{ text: '¡Gulp! Sableye ya se ha ido. Me ayudó a construir… y después a reparar mi cabaña. Es muy buena persona. Ahora está en el Café de Spinda… haciendo de tasador.', mood: 'Happy' },
        { text: '… Por cierto, ¿qué es un tasador? Gulp.', mood: 'Normal' }],
  },
  storage: {   // Kangaskhan: no es solo la bandeja
    2: [{ text: 'Qué raro, cielo… Juraría que tenía una Baya Aranja más. Seguro que me he equivocado al contar.', mood: 'Worried' }],
  },
  murkrow: {   // el rumor (y luego resulta que el sospechoso es él)
    3: [{ text: '¡Crrraaa! Dicen por ahí que Gulpin se lo come todo, ¡hasta lo que no es comida! Yo no digo nada. Pero lo digo.', mood: 'Happy' }],
  },
  shop: {   // Kecleon desconfía
    3: [{ text: 'Por si acaso, a los nuevos os cobramos por adelantado. No es nada personal. Es que últimamente… desaparecen cosas.', mood: 'Worried' }],
  },
};
// La frase de capítulo pendiente para un personaje (o null). seen: conjunto de «personaje:capítulo» ya dichos.
export function storyLineFor(key, m, seen) {
  const byCh = STORY_LINES[key]; if (!byCh) return null;
  const ch = chapterOf(m);
  for (let c = ch; c >= 1; c--) {
    const e = byCh[c]; if (!e) continue;
    const pages = Array.isArray(e) ? e : e.pages; if (!Array.isArray(e) && e.when && !e.when(m)) continue;   // aún no toca: mira capítulos anteriores
    if (seen.has(`${key}:${c}`)) return null;
    return { chapter: c, pages, then: (Array.isArray(e) ? byCh.then : (e.then ?? byCh.then)) !== false };
  }
  return null;
}

// ---------------------------------------------------------------------
// Escenas (docs/ESCENAS.md): guiones que reproduce client/js/scenes.js. `when(meta)` dice cuándo toca; se ven una vez.
// ---------------------------------------------------------------------
export const SCENES = [
  {
    id: 'acto1-bandeja', when: m => (m.scenes || []).includes('primera-noche'),   // esa misma noche: la sombra se lleva la bandeja
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
      { do: 'wait', ms: 500 },
      { do: 'move', who: 'chatot', to: [[384, 206], [384, 172]], speed: 1.2 },   // y vuelve dentro del gremio, hecho una furia
      { do: 'hide', who: 'chatot' },
      { do: 'wait', ms: 500 },
      { do: 'fade', to: 'out', ms: 600 },
    ],
  },
  {
    // La primera vez que vas a las mazmorras, Chatot llega corriendo… porque él es el jefe del Campo de Entrenamiento
    id: 'chatot-mazmorras', trigger: 'dungeon-exit', when: m => !(m.cleared || []).includes('entrenamiento'),
    area: 'aldea', startDark: false,
    actors: { chatot: { sp: 'chatot', x: 384, y: -40, dir: 'down' } },
    steps: [
      { do: 'move', who: 'chatot', to: [[384, 212], [454, 256], [454, 334], [384, 392]], speed: 2.4 },   // llega corriendo y rodea la fuente (ruta sacada del mapa de colisiones)
      { do: 'turn', who: 'chatot', dir: 'down' },                                        // se para mirándote de frente
      { do: 'wait', ms: 350 },
      { do: 'turn', who: 'player', dir: 'up' },                                          // y cuando se para, te giras…
      { do: 'emote', who: 'player', fx: 'exclaim' },
      { do: 'wait', ms: 500 },
      { do: 'anim', who: 'chatot', anim: 'Hop', ms: 450 },
      { do: 'say', who: 'chatot', mood: 'Happy', text: '¡Hey, Recluta! ¿Vas ya hacia las mazmorras?' },
      { do: 'turn', who: 'chatot', dir: 'right' },
      { do: 'wait', ms: 300 },
      { do: 'emote', who: 'chatot', fx: 'sweat' },
      { do: 'say', who: 'chatot', mood: 'Worried', text: 'Qué casualidad. Yo también iba…' },
      { do: 'turn', who: 'chatot', dir: 'down' },
      { do: 'anim', who: 'chatot', anim: 'Pose', hold: true },
      { do: 'say', who: 'chatot', mood: 'Inspired', text: 'Bueno, mucha suerte ahí dentro.' },
      { do: 'say', who: 'chatot', mood: 'Inspired', text: 'Espero que no te encuentres ningún jefe demasiado poderoso, carismático, apuesto, que cante bien…' },
      { do: 'anim', who: 'chatot', anim: 'Appeal', hold: true },   // y sigue, y sigue…
      { do: 'say', who: 'chatot', mood: 'Joyous', auto: 900, text: '…que baile de maravilla, con un plumaje precioso, una voz privilegiada, un porte elegantísimo… bla, bla, bla…' },
      { do: 'wait', ms: 300 },
      { do: 'emote', who: 'player', fx: 'dots' },
      { do: 'wait', ms: 1300 },
      { at: [{ do: 'anim', who: 'chatot', anim: 'Hop', ms: 450 }, { do: 'emote', who: 'chatot', fx: 'shock', se: 'shock' }] },   // se da cuenta de que lleva un buen rato hablando
      { do: 'anim', who: 'chatot', anim: 'Idle' },
      { do: 'wait', ms: 400 },
      { do: 'say', who: 'chatot', mood: 'Shouting', text: '¡Bueno, no tengo mucho tiempo para seguir escuchándote! Me voy, que tengo prisa.' },
      { at: [{ do: 'move', who: 'chatot', to: [[408, 452], [408, 488], [384, 504], [384, 560]], speed: 3 }, { do: 'turn', who: 'player', dir: 'down' }] },   // y se va corriendo por tu lado… hacia las mazmorras (ruta comprobada con el mapa de colisiones)
      { do: 'hide', who: 'chatot' },
      { do: 'wait', ms: 400 },
      { do: 'emote', who: 'player', fx: 'question' },
      { do: 'wait', ms: 900 },
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
      { do: 'wait', ms: 520 },                                                        // (justo cuando pasa por encima de ti)
      { do: 'turn', who: 'player', dir: 'up' },
      { do: 'emote', who: 'player', fx: 'exclaim' },
      { do: 'wait', ms: 1000 },                                                       // …pasa, y un momento después…
      { do: 'object', id: 'carta', action: 'fall', ms: 2600 },                        // …cae un papel del cielo
      { do: 'wait', ms: 600 },
      { do: 'emote', who: 'player', fx: 'question' },                                 // ¿qué es esto?
      { do: 'wait', ms: 700 },
      { do: 'move', who: 'player', to: [[392, 272]], speed: 1 },                      // te acercas y lo recoges
      { do: 'object', id: 'carta', action: 'hide' },
      { do: 'wait', ms: 300 },
      { do: 'poster', kind: 'wanted' },
      { do: 'wait', ms: 800 },
      { do: 'emote', who: 'murkrow', fx: 'shock', se: 'shock' },
      { do: 'wait', ms: 300 },
      { do: 'say', who: 'murkrow', mood: 'Surprised', text: '¡Crrraaa! ¿Una carta? ¡Esa no la he repartido yo!' },
      { do: 'wait', ms: 400 },
      { do: 'turn', who: 'player', dir: 'up-left' },
      { do: 'wait', ms: 600 },
      { do: 'emote', who: 'player', fx: 'dots' },                                     // le miras…
      { do: 'wait', ms: 1300 },
      { do: 'emote', who: 'murkrow', fx: 'sweat' },
      { do: 'wait', ms: 300 },
      { do: 'say', who: 'murkrow', mood: 'Worried', text: '¿Qué? ¿Por qué me miras así? … Vale, sí, me gustan las cosas brillantes.' },
      { do: 'say', who: 'murkrow', mood: 'Worried', text: '¡Pero no tanto!' },
      { do: 'emote', who: 'murkrow', fx: 'anger', hold: true },
      { do: 'wait', ms: 400 },
      { do: 'say', who: 'murkrow', mood: 'Angry', text: '¡Crrraaa! ¡Yo solo reparto el correo!' },
      { do: 'emote', who: 'murkrow', fx: 'none' },
    ],
  },
  {
    // Al volver del Campo de Entrenamiento: la primera noche en el gremio. Solo estáis Chatot, Mawile y tú.
    id: 'primera-noche', when: m => (m.cleared || []).includes('entrenamiento'),
    area: 'descanso', night: true, lights: [{ x: 462, y: 84, r: 110, a: 0.3 }], hideNpcIds: ['chansey'], cam: { x: 84, y: 60 },   // toda la habitación a la vista
    player: { x: 350, y: 392, dir: 'up-right' }, keepPlayer: true,
    actors: { chatot: { sp: 'chatot', x: 400, y: 332, dir: 'down' }, mawile: { sp: 'mawile', x: 455, y: 372, dir: 'left' } },
    steps: [
      { do: 'narration', text: 'Esa noche, en el gremio…', ms: 2400 },
      { do: 'fade', to: 'in', ms: 800 },
      { do: 'wait', ms: 600 },
      { do: 'say', who: 'chatot', mood: 'Normal', text: 'Hoy dormimos aquí nosotros tres. El resto de miembros están en una exploración continua; no sabemos cuánto tardarán en volver.' },
      { do: 'turn', who: 'chatot', toward: 'player' },
      { do: 'wait', ms: 400 },
      { do: 'emote', who: 'chatot', fx: 'sweat' },
      { do: 'say', who: 'chatot', mood: 'Angry', text: 'Cuando vuelvan… Ni se te ocurra hablar de lo de hoy, Novato.' },
      { do: 'wait', ms: 500 },
      { do: 'turn', who: 'mawile', dir: 'left' },
      { do: 'say', who: 'mawile', mood: 'Happy', text: 'Ji, ji, ji…' },                          // se ríe en voz baja…
      { do: 'wait', ms: 300 },
      { do: 'move', who: 'mawile', to: [[545, 362], [650, 326]], speed: 1 },               // …y se va a dormir
      { do: 'anim', who: 'mawile', anim: 'Sleep', hold: true },
      { do: 'wait', ms: 900 },
      { do: 'say', who: 'chatot', mood: 'Sigh', text: 'Haaah…' },                           // Chatot suspira…
      { do: 'move', who: 'chatot', to: [[520, 432], [614, 434]], speed: 1 },               // …y se va a dormir
      { do: 'anim', who: 'chatot', anim: 'Sleep', hold: true },
      { do: 'wait', ms: 900 },
      { do: 'move', who: 'player', to: [[230, 372], [116, 326]], speed: 1 },               // y tú, a tu cama
      { do: 'bed', bed: 0 },
      { do: 'wait', ms: 700 },
      { do: 'emote', who: 'player', fx: 'dots' },
      { do: 'wait', ms: 1300 },
      { do: 'emote', who: 'player', fx: 'dots' },
      { do: 'wait', ms: 1800 },
      { do: 'fade', to: 'out', ms: 1000 },
    ],
  },
  {
    // A la mañana siguiente: alguien grita desde abajo. (Chatot acaba de descubrir que falta la bandeja.)
    id: 'despertar', when: m => (m.scenes || []).includes('acto1-bandeja'),
    area: 'descanso', keepPlayer: true, cam: { x: 84, y: 60 },
    steps: [
      { do: 'bed', bed: 0 },
      { do: 'fade', to: 'in', ms: 900 },
      { do: 'wait', ms: 1200 },
      { do: 'shake', ms: 900, amp: 5 },
      { do: 'say', unknown: true, name: '', text: '«¡¡¿Y SE PUEDE SABER QUIÉN HA SIDO?!! ¡Esa bandeja no se ha ido volando sola!»' },
      { do: 'wait', ms: 300 },
      { do: 'bed', up: true, to: [150, 348], dir: 'down' },                                // te despiertas de golpe
      { do: 'emote', who: 'player', fx: 'shock' },
      { do: 'wait', ms: 600 },
      { do: 'emote', who: 'player', fx: 'question' },
      { do: 'wait', ms: 1200 },
    ],
  },
  {
    // Al bajar al gremio esa mañana: Mawile te sale al paso (sin que le hables)
    id: 'mawile-aviso', trigger: 'area:gremio', when: m => (m.scenes || []).includes('despertar'),
    area: 'gremio', startDark: false, keepPlayer: true, hideNpcIds: ['mawile', 'chatot'],
    actors: { mawile: { sp: 'mawile', x: 546, y: 256, dir: 'left' }, chatot: { sp: 'chatot', x: 440, y: 206, dir: 'down' } },
    steps: [
      { do: 'emote', who: 'chatot', fx: 'anger', hold: true },                             // al fondo, Chatot echa humo
      { do: 'wait', ms: 500 },
      { do: 'emote', who: 'mawile', fx: 'exclaim' },
      { do: 'move', who: 'mawile', to: [[400, 262], [262, 262]], speed: 1.2 },             // Mawile se acerca
      { do: 'turn', who: 'player', toward: 'mawile' },
      { do: 'wait', ms: 300 },
      { do: 'say', who: 'mawile', mood: 'Worried', text: '¡Buenos días! Oye… ¿Has oído los gritos?' },
      { do: 'say', who: 'mawile', mood: 'Worried', text: 'Chatot está muy, muy enfadado. Mejor no molestarle hoy, ¿vale?' },
      { do: 'wait', ms: 300 },
      { do: 'move', who: 'mawile', to: [[400, 262], [546, 256]], speed: 1.2 },             // y vuelve a su puesto
      { do: 'turn', who: 'mawile', dir: 'down-left' },
      { do: 'wait', ms: 300 },
    ],
  },
  {
    // La mañana del robo, al salir a la plaza: Sneasel, con su manzana (¡de casa!), quiere inscribirse… y Chatot ata cabos (mal)
    id: 'recien-llegado', trigger: 'area:plaza', when: m => (m.scenes || []).includes('mawile-aviso'),
    area: 'plaza', startDark: false, keepPlayer: true, hideNpcIds: ['chatot'], cam: { x: 84, y: 40 }, music: 'comedy',
    actors: { sneasel: { sp: 'sneasel', x: 474, y: 238, dir: 'left', item: 'Manzana' },
              chatot: { sp: 'chatot', x: 384, y: 176, dir: 'down', hidden: true } },
    steps: [
      { do: 'jump', who: 'sneasel', to: [474, 238], ms: 200, h: 3 },                    // ñam
      { do: 'wait', ms: 400 },
      { do: 'move', who: 'player', to: [[366, 238]], speed: 1 },
      { do: 'turn', who: 'player', dir: 'right' },
      { do: 'wait', ms: 300 },
      { do: 'emote', who: 'player', fx: 'question' },
      { do: 'wait', ms: 600 },
      { do: 'say', who: 'sneasel', mood: 'Normal', text: '¿Qué miras? Es mi desayuno. La traigo de casa.' },
      { do: 'say', who: 'sneasel', mood: 'Happy', text: 'Llegué anoche. Quiero apuntarme al gremio.' },
      { do: 'say', who: 'sneasel', mood: 'Normal', text: 'Era tarde y no quise despertar a nadie, así que dormí aquí mismo, junto a la puerta.' },
      { do: 'wait', ms: 300 },
      { do: 'emote', who: 'player', fx: 'exclaim' },                                  // junto a la puerta… donde estaba la bandeja
      { do: 'wait', ms: 500 },
      { do: 'show', who: 'chatot' },
      { do: 'move', who: 'chatot', to: [[384, 198], [396, 204], [414, 212]], speed: 3 },   // sale disparado
      { do: 'turn', who: 'chatot', dir: 'right' },
      { do: 'anim', who: 'chatot', anim: 'Charge', hold: true },
      { at: [{ do: 'emote', who: 'chatot', fx: 'shock', se: 'shock', nowait: true }, { do: 'emote', who: 'sneasel', fx: 'shock', nowait: true }] },
      { do: 'wait', ms: 600 },
      { do: 'say', who: 'chatot', mood: 'Shouting', text: '¡¿JUNTO A LA PUERTA?! ¡¿ESTA NOCHE?!' },
      { do: 'anim', who: 'chatot', anim: 'Idle' },
      { do: 'emote', who: 'chatot', fx: 'anger' },
      { do: 'say', who: 'chatot', mood: 'Angry', text: '¡La misma noche que desaparece mi bandeja, aparece un Sneasel durmiendo al lado! ¡Ja!' },
      { do: 'emote', who: 'sneasel', fx: 'sweat' },
      { do: 'say', who: 'sneasel', mood: 'Surprised', text: '¿Bandeja? ¿Qué bandeja? ¡Yo solo traía mi manzana!' },
      { do: 'anim', who: 'chatot', anim: 'Pose', hold: true },
      { do: 'say', who: 'chatot', mood: 'Determined', text: 'Aquí no se inscribe nadie que duerma junto a las bandejas que desaparecen. ¡Por ahora, NO!' },
      { do: 'anim', who: 'chatot', anim: 'Idle' },
      { do: 'move', who: 'chatot', to: [[396, 204], [384, 198], [384, 176]], speed: 2 },   // y vuelve dentro, muy digno
      { do: 'hide', who: 'chatot' },
      { do: 'wait', ms: 800 },
      { do: 'turn', who: 'sneasel', dir: 'down' },
      { do: 'emote', who: 'sneasel', fx: 'dots' },
      { do: 'wait', ms: 1200 },
      { do: 'say', who: 'sneasel', mood: 'Sad', text: '… Pero si es verdad. La manzana es de casa.' },
      { do: 'jump', who: 'sneasel', to: [474, 238], ms: 200, h: 3 },                    // otro mordisco, con rabia
      { do: 'prop', who: 'sneasel', set: { itemScale: 0.75 } },
      { do: 'turn', who: 'sneasel', dir: 'left' },
      { do: 'say', who: 'sneasel', mood: 'Determined', text: 'Me quedo por aquí. Ya verán.' },
      { do: 'prop', who: 'sneasel', set: { item: null } },
      { do: 'move', who: 'sneasel', to: [[228, 258], [40, 262]], speed: 1.6 },         // hacia el mercado
      { do: 'hide', who: 'sneasel' },
      { do: 'emote', who: 'player', fx: 'dots' },
      { do: 'wait', ms: 1300 },
    ],
  },
  {
    // A la vuelta de la siguiente exploración, esa noche: Rowlet viene volando a la ventana y cuenta lo que vio
    id: 'el-testigo', trigger: 'return', when: m => (m.scenes || []).includes('recien-llegado'),
    area: 'descanso', night: true, lights: [{ x: 462, y: 84, r: 110, a: 0.3 }], hideNpcIds: ['chansey'], keepPlayer: true, cam: { x: 84, y: 60 },
    actors: { chatot: { sp: 'chatot', x: 614, y: 434, dir: 'down' }, mawile: { sp: 'mawile', x: 650, y: 326, dir: 'down' },
              rowlet: { sp: 'rowlet', name: '???', x: 214, y: 128, dir: 'down', hidden: true, scale: 0.15, alpha: 0, hover: true, flyAnim: 'Charge', noShadow: true } },
    steps: [
      { do: 'bed', bed: 0 },
      { do: 'anim', who: 'chatot', anim: 'Sleep', hold: true },
      { do: 'anim', who: 'mawile', anim: 'Sleep', hold: true },
      { do: 'narration', text: 'Esa noche…', ms: 2200 },
      { do: 'fade', to: 'in', ms: 900 },
      { do: 'wait', ms: 1000 },
      { do: 'show', who: 'rowlet' },                                                  // a lo lejos, algo se acerca volando…
      { at: [{ do: 'move', who: 'rowlet', to: [[204, 150], [196, 186]], speed: 0.55 }, { do: 'tween', who: 'rowlet', set: { scale: 1, alpha: 1 }, ms: 2600 }] },
      { do: 'prop', who: 'rowlet', set: { hover: false, noShadow: false } },          // …y se posa en el alféizar
      { do: 'wait', ms: 500 },
      { do: 'jump', who: 'rowlet', to: [196, 186], ms: 180, h: 4 },
      { do: 'wait', ms: 140 },
      { do: 'jump', who: 'rowlet', to: [196, 186], ms: 180, h: 4 },
      { do: 'say', unknown: true, name: '', text: '(Uuh… uuh… Un ululato suave, desde la ventana.)' },
      { do: 'wait', ms: 400 },
      { do: 'emote', who: 'player', fx: 'exclaim' },
      { do: 'wait', ms: 600 },
      { do: 'bed', up: true },
      { do: 'jump', who: 'player', to: [150, 348], ms: 380, h: 14 },                   // te levantas de un saltito
      { do: 'turn', who: 'player', dir: 'up' },
      { do: 'wait', ms: 300 },
      { do: 'emote', who: 'player', fx: 'question' },
      { do: 'wait', ms: 900 },
      { do: 'say', who: 'rowlet', mood: 'Happy', text: '¡Psst! Uuh. ¿Estás despierto?' },
      { do: 'move', who: 'player', to: [[152, 270]], speed: 1 },
      { do: 'turn', who: 'player', dir: 'up-right' },
      { do: 'wait', ms: 300 },
      { do: 'say', who: 'rowlet', mood: 'Worried', text: 'Soy yo, la Rowlet que vive junto a la Fuente. ¿Te acuerdas de mí? No suelo venir hasta aquí… pero esto no podía esperar.' },
      { do: 'say', who: 'rowlet', mood: 'Normal', text: 'Chatot no me escucharía. Y el maestro nunca sale de su despacho. Tú eres nuevo: aún no sospechas de nadie.' },
      { do: 'wait', ms: 300 },
      { do: 'emote', who: 'player', fx: 'question' },
      { do: 'wait', ms: 1000 },
      { do: 'say', who: 'rowlet', mood: 'Normal', text: 'Yo de noche no duermo. Nunca. Y la noche de la bandeja… vi algo.' },
      { do: 'fade', to: 'out', ms: 600 },                                             // el recuerdo
      { do: 'area', area: 'plaza', cam: { x: 84, y: 40 }, hidePlayer: true, hideActors: true, memory: [[384, 560], [384, 330], [396, 262], [420, 214]] },
      { do: 'fade', to: 'in', ms: 700 },
      { do: 'light', phase: 'up', ms: 3200 },
      { do: 'wait', ms: 1400 },
      { do: 'say', who: 'rowlet', mood: 'Normal', text: 'Una lucecita. Una sola. De colores, como el agua de la Fuente cuando le da la luna.' },
      { do: 'light', phase: 'stop' },
      { do: 'say', who: 'rowlet', mood: 'Worried', text: 'Iba a ras de suelo. Subió hasta la puerta del gremio… y se quedó quieta un momento.' },
      { do: 'light', phase: 'down', ms: 1500, wait: true },
      { do: 'wait', ms: 400 },
      { do: 'say', who: 'rowlet', mood: 'Worried', text: 'Luego bajó, deprisa. Y ya no la vi más.' },
      { do: 'fade', to: 'out', ms: 600 },
      { do: 'area', area: 'descanso', cam: { x: 84, y: 60 }, hidePlayer: false, showActors: true },
      { do: 'fade', to: 'in', ms: 600 },
      { do: 'wait', ms: 500 },
      { do: 'say', who: 'chatot', mood: 'Normal', text: 'Zzz… mi bandeja… Gulpin… ¡devuélvemela!… zzz…' },   // Chatot habla en sueños
      { at: [{ do: 'emote', who: 'rowlet', fx: 'sweat', nowait: true }, { do: 'emote', who: 'player', fx: 'sweat', nowait: true }] },
      { do: 'wait', ms: 1000 },
      { do: 'say', who: 'rowlet', mood: 'Determined', text: 'Las luces que se mueven de noche no siempre son luciérnagas. Ten los ojos abiertos, nuevo.' },
      { do: 'say', who: 'rowlet', mood: 'Happy', text: 'Uuh. Me voy antes de que se despierte. ¡Y ni una palabra a Chatot!' },
      { do: 'prop', who: 'rowlet', set: { hover: true, noShadow: true } },             // y se aleja volando por la ventana
      { at: [{ do: 'move', who: 'rowlet', to: [[204, 150], [214, 128]], speed: 0.6 }, { do: 'tween', who: 'rowlet', set: { scale: 0.15, alpha: 0 }, ms: 2000 }] },
      { do: 'hide', who: 'rowlet' },
      { do: 'wait', ms: 500 },
      { do: 'emote', who: 'player', fx: 'dots' },
      { do: 'wait', ms: 1500 },
      { do: 'move', who: 'player', to: [[150, 348]], speed: 1 },
      { do: 'jump', who: 'player', to: [116, 326], ms: 380, h: 14 },                   // de un saltito, a la cama
      { do: 'bed', bed: 0 },
      { do: 'wait', ms: 800 },
      { do: 'fade', to: 'out', ms: 1100 },
    ],
  },
  {
    // Y a la vuelta de la siguiente: mientras tanto, en el mercado… Gulpin tiene coartada (y Sableye, un momento a solas)
    id: 'coartada', trigger: 'return', when: m => (m.scenes || []).includes('el-testigo'),
    area: 'mercado', hidePlayer: true, cam: { x: 150, y: 100 }, hideNpcIds: ['gulpin', 'sableye', 'kecleon_green', 'kangaskhan', 'sneasel'],
    actors: { gulpin: { sp: 'gulpin', x: 546, y: 392, dir: 'down-left' }, sableye: { sp: 'sableye', x: 452, y: 418, dir: 'right', idle: true },
              kecleon: { sp: 'kecleon', x: 246, y: 313, dir: 'down-right' }, kangaskhan: { sp: 'kangaskhan', x: 540, y: 236, dir: 'down' } },
    steps: [
      { do: 'narration', text: 'Mientras tanto, en el mercado…', ms: 2200 },
      { do: 'fade', to: 'in', ms: 700 },
      { do: 'wait', ms: 700 },
      { do: 'say', who: 'kecleon', mood: 'Joyous', text: '¡Eh, Gulpin! ¿Hoy qué has desayunado? ¿Una mesa?' },
      { do: 'wait', ms: 300 },
      { do: 'emote', who: 'gulpin', fx: 'anger' },
      { do: 'jump', who: 'gulpin', to: [522, 424], ms: 520, h: 30 },                  // ¡sale de un salto!
      { do: 'turn', who: 'gulpin', dir: 'left' },
      { do: 'shake', ms: 500, amp: 6 },
      { do: 'say', who: 'gulpin', mood: 'Shouting', text: '¡¡GULP!!' },
      { do: 'emote', who: 'kecleon', fx: 'shock' },
      { do: 'say', who: 'gulpin', mood: 'Angry', text: '¡Yo no me comí la bandeja! ¡Esa noche estaba durmiendo!' },
      { do: 'say', who: 'kecleon', mood: 'Normal', text: '¿Y quién lo dice? ¿Tú?' },
      { do: 'wait', ms: 400 },
      { do: 'move', who: 'kangaskhan', to: [[534, 234], [420, 324], [440, 344]], speed: 1.4 },   // sale de su almacén
      { do: 'turn', who: 'kangaskhan', dir: 'down-right' },
      { do: 'say', who: 'kangaskhan', mood: 'Normal', text: 'Lo digo yo, cielo.' },
      { do: 'say', who: 'kangaskhan', mood: 'Sigh', text: 'Gulpin estuvo roncando TODA la noche. Mi almacén está pegado a su cabaña… ¡y no pegué ojo!' },
      { do: 'say', who: 'kangaskhan', mood: 'Normal', text: 'Así, mira: Zzz… Zzz…' },
      { do: 'shake', ms: 900, amp: 7 },
      { at: [{ do: 'emote', who: 'kecleon', fx: 'shock', nowait: true }, { do: 'emote', who: 'gulpin', fx: 'shock', nowait: true }, { do: 'jump', who: 'kangaskhan', to: [440, 344], ms: 300, h: 8, nowait: true }] },
      { do: 'say', who: 'kangaskhan', mood: 'Shouting', text: '¡¡¡GRRROOOOAAAR!!!' },
      { do: 'say', who: 'kangaskhan', mood: 'Sigh', text: '… Zzz… ¡Así toda la noche, cielo! TODA.' },
      { do: 'emote', who: 'gulpin', fx: 'none' },
      { do: 'emote', who: 'gulpin', fx: 'sweat' },
      { do: 'turn', who: 'gulpin', dir: 'up-left' },
      { do: 'say', who: 'gulpin', mood: 'Stunned', text: '¿Ronco? … ¿Así? … Gulp.' },
      { do: 'emote', who: 'kecleon', fx: 'sweat' },
      { do: 'say', who: 'kecleon', mood: 'Worried', text: 'Vale, vale… Pues igual no fue él.' },
      { do: 'turn', who: 'gulpin', dir: 'left' },
      { do: 'jump', who: 'sableye', to: [452, 418], ms: 260, h: 6, nowait: true },
      { do: 'say', who: 'sableye', mood: 'Joyous', text: '¡Je, je, je!' },
      { do: 'say', who: 'sableye', mood: 'Happy', text: '¿Ves, Gulpin? Nadie que te conozca de verdad pensaría eso.' },
      { do: 'say', who: 'gulpin', mood: 'Teary-Eyed', text: 'Gracias, Sableye…' },
      { do: 'emote', who: 'gulpin', fx: 'heart' },
      { do: 'say', who: 'sableye', mood: 'Joyous', text: 'Palabra de tasador. ¡Je!' },
      { do: 'wait', ms: 600 },
      { do: 'jump', who: 'gulpin', to: [546, 392], ms: 520, h: 30 },                  // cada uno a lo suyo: primero Gulpin…
      { do: 'turn', who: 'gulpin', dir: 'down-left' },
      { do: 'wait', ms: 400 },
      { do: 'move', who: 'kangaskhan', to: [[420, 324], [534, 234], [540, 236]], speed: 1.4 },   // …luego Kangaskhan
      { do: 'turn', who: 'kangaskhan', dir: 'down' },
      { do: 'wait', ms: 1200 },
      { do: 'say', who: 'gulpin', mood: 'Normal', text: 'Zzz… Zzz…' },                    // el remate: Gulpin se ha quedado dormido…
      { do: 'shake', ms: 1000, amp: 7 },
      { at: [{ do: 'emote', who: 'kecleon', fx: 'shock', nowait: true }, { do: 'emote', who: 'sableye', fx: 'shock', nowait: true }] },
      { do: 'say', who: 'gulpin', mood: 'Shouting', text: '¡¡¡GRRROOOOAAAR!!!' },
      { do: 'emote', who: 'kangaskhan', fx: 'anger' },
      { do: 'jump', who: 'kangaskhan', to: [540, 236], ms: 280, h: 8 },
      { do: 'say', who: 'kangaskhan', mood: 'Shouting', text: '¡¡GULPIN!! ¡QUE ES MEDIODÍA!' },
      { do: 'emote', who: 'kangaskhan', fx: 'none' },
      { do: 'emote', who: 'kecleon', fx: 'sweat' },
      { do: 'say', who: 'kecleon', mood: 'Happy', text: 'Je… Bueno, al menos ya sabemos dónde está cada noche.' },
      { do: 'wait', ms: 1000 },
      { do: 'prop', who: 'sableye', set: { idle: false } },                           // …y Sableye, solo, se gira hacia el gremio
      { do: 'turn', who: 'sableye', dir: 'up-right' },
      { do: 'wait', ms: 1600 },
      { do: 'say', who: 'sableye', mood: 'Normal', text: '… ¡Je!' },
      { do: 'wait', ms: 1000 },
      { do: 'fade', to: 'out', ms: 1400 },
    ],
  },
  {
    // Al caer la tarde: Smeargle (del equipo de exploración que salió) vuelve solo y herido. Chatot moviliza a otros equipos… y Murkrow no sabe adónde
    id: 'smeargle-vuelve', trigger: 'return', when: m => (m.scenes || []).includes('coartada'),
    area: 'plaza', player: { x: 262, y: 240, dir: 'up-right' }, cam: { x: 84, y: 40 }, tint: 'rgba(255, 120, 40, .22)', music: 'dusk', hideNpcIds: ['murkrow'],   // en el buzón, preguntando por el correo
    actors: { smeargle: { sp: 'smeargle', x: 384, y: 505, dir: 'up', hidden: true }, chatot: { sp: 'chatot', x: 384, y: 176, dir: 'down', hidden: true },
              mawile: { sp: 'mawile', x: 384, y: 176, dir: 'down', hidden: true }, murkrow: { sp: 'murkrow', x: 315, y: 152, dir: 'down' } },
    steps: [
      { do: 'narration', text: 'Al caer la tarde…', ms: 2200 },
      { do: 'fade', to: 'in', ms: 900 },
      { do: 'wait', ms: 600 },
      { do: 'say', who: 'murkrow', mood: 'Normal', text: '¡Crrraa! A ver, a ver… Una carta para… ¡Gulpin! No, esa no es tuya.' },
      { do: 'say', who: 'murkrow', mood: 'Happy', text: 'Para ti no hay nada hoy. Crrr. ¡Vuelve mañana!' },
      { do: 'wait', ms: 700 },
      { do: 'show', who: 'smeargle' },
      { do: 'prop', who: 'player', set: { track: 'smeargle' } },   // le sigues con la mirada
      { do: 'move', who: 'smeargle', to: [[384, 430]], speed: 0.5 },
      { do: 'turn', who: 'player', toward: 'smeargle' },
      { do: 'turn', who: 'murkrow', toward: 'smeargle' },
      { do: 'emote', who: 'player', fx: 'question' },
      { do: 'wait', ms: 700 },
      { do: 'anim', who: 'smeargle', anim: 'LostBalance', ms: 1100 },
      { do: 'move', who: 'smeargle', to: [[384, 342]], speed: 0.45 },
      { do: 'emote', who: 'player', fx: 'exclaim' },
      { do: 'wait', ms: 700 },
      { do: 'say', who: 'smeargle', mood: 'Pain', text: '… Chatot… tengo que… decírselo a Chatot…' },
      { do: 'anim', who: 'smeargle', anim: 'Faint', ms: 700 },
      { do: 'anim', who: 'smeargle', anim: 'Sleep', hold: true },
      { do: 'shake', ms: 300, amp: 3 },
      { do: 'prop', who: 'player', set: { track: null } },
      { do: 'emote', who: 'player', fx: 'shock' },
      { do: 'wait', ms: 800 },
      { do: 'emote', who: 'murkrow', fx: 'exclaim' },
      { do: 'say', who: 'murkrow', mood: 'Shouting', text: '¡¡CRRRAAAA!! ¡¡CHATOT!! ¡¡HAY ALGUIEN TIRADO EN LA PLAZA!!' },
      { do: 'show', who: 'chatot' },
      { do: 'move', who: 'chatot', to: [[392, 318]], speed: 3 },
      { do: 'turn', who: 'chatot', toward: 'smeargle' },
      { do: 'emote', who: 'chatot', fx: 'shock' },
      { do: 'wait', ms: 500 },
      { do: 'say', who: 'chatot', mood: 'Shouting', text: '¡¡SMEARGLE!!' },
      { do: 'show', who: 'mawile' },
      { do: 'move', who: 'mawile', to: [[352, 318]], speed: 2.6 },
      { do: 'turn', who: 'mawile', toward: 'smeargle' },
      { do: 'say', who: 'mawile', mood: 'Worried', text: '¡Chatot! ¿Qué ha pasado? ¡Está lleno de barro!' },
      { do: 'anim', who: 'smeargle', anim: 'Laying', hold: true },
      { do: 'wait', ms: 500 },
      { do: 'say', who: 'smeargle', mood: 'Pain', text: 'Chatot… la Cueva Húmeda… el agua subió de golpe.' },
      { do: 'say', who: 'smeargle', mood: 'Worried', text: 'Nos separamos… en lo más hondo. Los demás… no sé dónde están.' },
      { do: 'emote', who: 'chatot', fx: 'sweat' },
      { do: 'wait', ms: 600 },
      { do: 'say', who: 'chatot', mood: 'Worried', text: 'Tranquilo. Has hecho bien en volver.' },
      { do: 'say', who: 'smeargle', mood: 'Sad', text: 'Los mapas… los dibujé todos… y se los llevó el agua. Tenía el camino… en la cabeza…' },
      { do: 'say', who: 'chatot', mood: 'Sad', text: 'Los mapas no importan. Ahora no hables.' },
      { do: 'anim', who: 'smeargle', anim: 'Sleep', hold: true },
      { do: 'turn', who: 'chatot', toward: 'mawile' },
      { do: 'say', who: 'chatot', mood: 'Determined', text: '¡Mawile! ¡A Chansey! ¡Ya!' },
      { do: 'move', who: 'chatot', to: [[428, 330]], speed: 1.3 },   // se aparta para dejarle sitio
      { do: 'turn', who: 'chatot', toward: 'smeargle' },
      { do: 'move', who: 'mawile', to: [[384, 320]], speed: 1.3 },
      { do: 'turn', who: 'mawile', dir: 'down' },   // se pone delante de él, mirándolo
      { do: 'wait', ms: 300 },
      { do: 'say', who: 'mawile', mood: 'Determined', text: '¡Ya lo llevo! Pobrecito… ¡Uf, cómo pesa!' },
      { do: 'prop', who: 'player', set: { track: 'smeargle' } },
      { at: [{ do: 'move', who: 'mawile', to: [[384, 176]], speed: 0.9, keepFacing: true }, { do: 'move', who: 'smeargle', to: [[384, 198]], speed: 0.9, keepAnim: true, keepFacing: true }] },   // de espaldas, tirando de él
      { do: 'hide', who: 'mawile' },
      { do: 'move', who: 'smeargle', to: [[384, 180]], speed: 0.9, keepAnim: true, keepFacing: true },
      { do: 'hide', who: 'smeargle' },
      { do: 'prop', who: 'player', set: { track: null } },
      { do: 'wait', ms: 800 },
      { do: 'turn', who: 'chatot', toward: 'player' },
      { do: 'wait', ms: 400 },
      { do: 'say', who: 'chatot', mood: 'Worried', text: 'Un equipo entero… perdido en la Cueva Húmeda.' },
      { do: 'say', who: 'chatot', mood: 'Sigh', text: 'Y en el gremio no queda nadie que pueda ir a buscarlos.' },
      { do: 'wait', ms: 300 },
      { do: 'emote', who: 'player', fx: 'dots' },
      { do: 'wait', ms: 700 },
      { do: 'say', who: 'chatot', mood: 'Sigh', text: '… Tú aún eres un Novato. No.' },
      { do: 'turn', who: 'chatot', dir: 'up' },
      { do: 'anim', who: 'chatot', anim: 'Pose', hold: true },
      { do: 'wait', ms: 400 },
      { do: 'say', who: 'chatot', mood: 'Determined', text: 'Escribiré a todos los equipos que están fuera. ¡Que vuelvan! ¡TODOS!' },
      { do: 'anim', who: 'chatot', anim: 'Idle' },
      { do: 'turn', who: 'chatot', toward: 'murkrow' },
      { do: 'wait', ms: 300 },
      { do: 'say', who: 'chatot', mood: 'Shouting', text: '¡¡MURKROW!! ¡¡CARTAS URGENTES!!' },
      { do: 'emote', who: 'murkrow', fx: 'shock' },
      { do: 'wait', ms: 500 },
      { do: 'say', who: 'murkrow', mood: 'Surprised', text: '¡C-crrraaa! ¿Todas?' },
      { do: 'say', who: 'chatot', mood: 'Shouting', text: '¡TODAS!' },
      { do: 'say', who: 'murkrow', mood: 'Determined', text: '¡Crraaa! ¡El correo no espera!' },
      { do: 'jump', who: 'murkrow', to: [320, 208], ms: 360, h: 12 },
      { do: 'move', who: 'murkrow', to: [[324, 210], [330, 216], [384, 204], [384, 176]], speed: 1.7 },
      { do: 'hide', who: 'murkrow' },
      { do: 'wait', ms: 400 },
      { do: 'turn', who: 'chatot', toward: 'player' },
      { do: 'say', who: 'chatot', mood: 'Sigh', text: '… Y que no sea tarde.' },
      { do: 'prop', who: 'player', set: { track: 'chatot' } },   // le sigues con la vista
      { do: 'move', who: 'chatot', to: [[384, 176]], speed: 1.7 },
      { do: 'hide', who: 'chatot' },
      { do: 'prop', who: 'player', set: { track: null } },
      { do: 'wait', ms: 1400 },
      { do: 'prop', who: 'murkrow', set: { x: 384, y: 176 } },
      { do: 'show', who: 'murkrow' },
      { do: 'move', who: 'murkrow', to: [[372, 204], [350, 214]], speed: 1.7 },
      { do: 'turn', who: 'murkrow', dir: 'down' },
      { do: 'wait', ms: 700 },
      { do: 'say', who: 'murkrow', mood: 'Worried', text: 'Crrr… Un momento. ¿A QUIÉN le llevo las cartas?' },
      { do: 'emote', who: 'murkrow', fx: 'sweat' },
      { do: 'wait', ms: 700 },
      { do: 'say', who: 'murkrow', mood: 'Worried', text: 'No me lo ha dicho. ¡No me ha dicho a quién!' },
      { do: 'wait', ms: 300 },
      { do: 'emote', who: 'murkrow', fx: 'dots' },   // se lo piensa…
      { do: 'wait', ms: 1500 },
      { do: 'turn', who: 'murkrow', toward: 'player' },
      { do: 'turn', who: 'player', toward: 'murkrow' },
      { do: 'say', who: 'murkrow', mood: 'Normal', text: '… Oye, tú. ¿Tú sabes dónde viven los equipos?' },
      { do: 'emote', who: 'player', fx: 'sweat' },
      { do: 'wait', ms: 1500 },
      { do: 'fade', to: 'out', ms: 1200 },
    ],
  },
  {
    // Tras superar el Bosque Frondoso: llegan Machamp y Heracross, de otros equipos, respondiendo a las cartas de Chatot
    id: 'veteranos', trigger: 'return', when: m => (m.scenes || []).includes('smeargle-vuelve') && (m.cleared || []).includes('bosque'),
    area: 'plaza', player: { x: 40, y: 262, dir: 'right' }, cam: { x: 84, y: 40 }, hideNpcIds: [],   // vuelves del mercado
    actors: { chatot: { sp: 'chatot', x: 384, y: 176, dir: 'down', hidden: true }, mawile: { sp: 'mawile', x: 384, y: 176, dir: 'down', hidden: true, noLook: true },   // mira en diagonal hacia el grupo
              machamp: { sp: 'machamp', x: 384, y: 505, dir: 'up', hidden: true }, ampharos: { sp: 'ampharos', x: 384, y: 505, dir: 'up', hidden: true },
              heracross: { sp: 'heracross', x: 720, y: 300, dir: 'left', hidden: true } },
    steps: [
      { do: 'narration', text: 'Unos días después…', ms: 2200 },
      { do: 'fade', to: 'in', ms: 900 },
      { do: 'wait', ms: 700 },
      { do: 'show', who: 'chatot' },
      { do: 'show', who: 'mawile' },
      { at: [{ do: 'move', who: 'chatot', to: [[400, 282]], speed: 2 }, { do: 'move', who: 'mawile', to: [[350, 264]], speed: 1.8 }] },
      { do: 'turn', who: 'chatot', dir: 'down' },
      { do: 'turn', who: 'mawile', dir: 'down-right' },
      { do: 'wait', ms: 500 },
      { do: 'move', who: 'player', to: [[312, 312]], speed: 1.6 },   // llegas del mercado; estáis charlando
      { do: 'turn', who: 'player', toward: 'chatot' },
      { do: 'turn', who: 'chatot', toward: 'player' },
      { do: 'turn', who: 'mawile', toward: 'player' },
      { do: 'say', who: 'chatot', mood: 'Normal', text: 'Ah, {jugador}. ¿Has comprado las bayas que te pedí?' },
      { do: 'jump', who: 'player', to: [312, 312], ms: 220, h: 4 },
      { do: 'wait', ms: 300 },
      { do: 'say', who: 'mawile', mood: 'Happy', text: '¡Seguro que Kecleon le ha cobrado por adelantado! Ji, ji.' },
      { do: 'say', who: 'chatot', mood: 'Sigh', text: 'Eso fue idea mía. Con tanto robo, mejor prevenir…' },
      { do: 'turn', who: 'mawile', dir: 'down-right' },
      { do: 'wait', ms: 500 },
      { do: 'show', who: 'heracross' },
      { do: 'anim', who: 'heracross', anim: 'Hop', hold: true },
      { do: 'jump', who: 'heracross', to: [472, 318], ms: 950, h: 95 },   // ¡llega de un salto enorme!
      { do: 'anim', who: 'heracross', anim: 'Idle' },
      { do: 'turn', who: 'heracross', dir: 'left' },
      { do: 'shake', ms: 700, amp: 6 },
      { at: [{ do: 'emote', who: 'chatot', fx: 'shock', nowait: true }, { do: 'emote', who: 'mawile', fx: 'shock', nowait: true }, { do: 'emote', who: 'player', fx: 'shock', nowait: true },   // ¡los tres pegan un bote!
             { do: 'jump', who: 'chatot', to: [400, 282], ms: 300, h: 10, nowait: true }, { do: 'jump', who: 'mawile', to: [350, 264], ms: 300, h: 10, nowait: true }, { do: 'jump', who: 'player', to: [312, 312], ms: 300, h: 10, nowait: true }] },
      { do: 'wait', ms: 500 },
      { do: 'turn', who: 'chatot', toward: 'heracross' },
      { do: 'turn', who: 'mawile', toward: 'heracross' },
      { do: 'turn', who: 'player', toward: 'heracross' },
      { do: 'turn', who: 'mawile', dir: 'down-right' },
      { do: 'wait', ms: 900 },
      { do: 'say', who: 'heracross', mood: 'Shouting', text: '¡¡CHATOT!! ¿¡Dónde está el desayuno!? ¡Vengo volando desde anoche!' },
      { do: 'say', who: 'chatot', mood: 'Happy', text: '¡Heracross! ¡Has llegado!' },
      { do: 'say', who: 'heracross', mood: 'Angry', text: 'Tu cuervo me tiró la carta en la cabeza. ¡En PLENO cortejo de un cerezo!' },
      { do: 'wait', ms: 500 },
      { do: 'show', who: 'machamp' },
      { at: [{ do: 'move', who: 'machamp', to: [[392, 356]], speed: 0.9 },   // la novedad: todos le miran
             { do: 'turn', who: 'chatot', toward: 'machamp' }, { do: 'turn', who: 'mawile', toward: 'machamp' }, { do: 'turn', who: 'player', toward: 'machamp' }, { do: 'turn', who: 'heracross', toward: 'machamp' }] },
      { do: 'turn', who: 'machamp', toward: 'chatot' },
      { do: 'say', who: 'machamp', mood: 'Normal', text: 'Perdonad la tardanza. Un puente se había caído por el camino.' },
      { do: 'say', who: 'machamp', mood: 'Normal', text: 'Lo he… recolocado.' },
      { do: 'say', who: 'heracross', mood: 'Normal', text: '¡Yo pasé por encima volando!' },
      { do: 'say', who: 'machamp', mood: 'Normal', text: 'Ya lo he visto. Me has salpicado de barro.' },
      { do: 'emote', who: 'heracross', fx: 'sweat' },
      { do: 'wait', ms: 800 },
      { do: 'turn', who: 'chatot', toward: 'machamp' },
      { do: 'say', who: 'chatot', mood: 'Normal', text: '¿Y Ampharos?' },
      { do: 'say', who: 'machamp', mood: 'Normal', text: 'Viene detrás. Se ha parado a mirar unas flores.' },
      { do: 'say', who: 'heracross', mood: 'Sigh', text: '¡Siempre igual!' },
      { do: 'wait', ms: 500 },
      { do: 'show', who: 'ampharos' },
      { at: [{ do: 'move', who: 'ampharos', to: [[414, 384], [426, 372], [462, 354], [468, 354], [470, 360]], speed: 0.75 },   // la novedad: todos la miran
             { do: 'turn', who: 'chatot', toward: 'ampharos' }, { do: 'turn', who: 'mawile', toward: 'ampharos' }, { do: 'turn', who: 'player', toward: 'ampharos' }, { do: 'turn', who: 'heracross', toward: 'ampharos' }, { do: 'turn', who: 'machamp', toward: 'ampharos' }] },
      { do: 'turn', who: 'ampharos', toward: 'chatot' },
      { do: 'say', who: 'ampharos', mood: 'Happy', text: 'Perdón, perdón… Había unas flores preciosas junto al camino.' },
      { do: 'turn', who: 'mawile', dir: 'down-right' },
      { do: 'turn', who: 'machamp', toward: 'chatot' },
      { do: 'turn', who: 'heracross', toward: 'chatot' },
      { do: 'say', who: 'chatot', mood: 'Happy', text: '¡Os lo agradezco a los tres! Smeargle volvió herido. Su equipo sigue en la Cueva Húmeda.' },
      { do: 'say', who: 'machamp', mood: 'Normal', text: 'Cuéntamelo todo, desde el principio.' },
      { do: 'say', who: 'chatot', mood: 'Worried', text: 'Una crecida. Se separaron en lo más hondo. No sabemos quién está en peligro.' },
      { do: 'say', who: 'heracross', mood: 'Determined', text: '¡Entonces vamos ya! ¡A tumbar paredes a cornadas!' },
      { do: 'turn', who: 'heracross', dir: 'down-left' },
      { do: 'move', who: 'heracross', to: [[420, 340]], speed: 1.8 },
      { do: 'move', who: 'machamp', to: [[418, 352]], speed: 1.6 },
      { do: 'turn', who: 'machamp', dir: 'right' },
      { do: 'emote', who: 'heracross', fx: 'shock' },
      { do: 'jump', who: 'heracross', to: [420, 340], ms: 260, h: 6 },
      { do: 'wait', ms: 300 },
      { do: 'say', who: 'machamp', mood: 'Normal', text: 'Con calma. Una cueva que se inunda se traga a quien entra sin plan.' },
      { do: 'say', who: 'heracross', mood: 'Sad', text: '… Vale.' },
      { do: 'wait', ms: 400 },
      { do: 'turn', who: 'heracross', toward: 'player' },   // se fija en ti… y entonces se acerca
      { do: 'emote', who: 'heracross', fx: 'notice' },
      { do: 'wait', ms: 800 },
      { do: 'move', who: 'heracross', to: [[352, 318]], speed: 1.2 },
      { do: 'turn', who: 'heracross', dir: 'left' },
      { do: 'say', who: 'heracross', mood: 'Surprised', text: '¿Y este renacuajo?' },
      { do: 'say', who: 'chatot', mood: 'Normal', text: 'Es {jugador}. Superó el Bosque Frondoso.' },
      { do: 'say', who: 'heracross', mood: 'Surprised', text: '¿Él solo?' },
      { do: 'turn', who: 'heracross', toward: 'player' },
      { do: 'anim', who: 'heracross', anim: 'Strike', ms: 300 },
      { do: 'say', who: 'heracross', mood: 'Determined', text: '¡A ver si es verdad!' },
      { do: 'emote', who: 'player', fx: 'shock' },
      { do: 'jump', who: 'player', to: [312, 312], ms: 900, h: 52 },
      { do: 'shake', ms: 250, amp: 3 },
      { do: 'wait', ms: 300 },
      { do: 'prop', who: 'heracross', set: { noLook: true } },   // tarda un momento en girarse
      { do: 'say', who: 'chatot', mood: 'Shouting', text: '¡¡HERACROSS!!' },
      { do: 'prop', who: 'heracross', set: { noLook: false } },
      { do: 'turn', who: 'heracross', toward: 'chatot' },
      { do: 'emote', who: 'player', fx: 'dots' },
      { do: 'wait', ms: 700 },
      { do: 'turn', who: 'heracross', toward: 'player' },   // vuelve a mirarte
      { do: 'say', who: 'heracross', mood: 'Joyous', text: '¡Jajá! Ni un quejido. ¡Me gusta este!' },
      { do: 'move', who: 'heracross', to: [[456, 304]], speed: 1.4 },   // y se une al corro
      { do: 'turn', who: 'heracross', toward: 'chatot' },
      { do: 'turn', who: 'mawile', dir: 'down-right' },
      { do: 'say', who: 'machamp', mood: 'Normal', text: 'A un explorador se le mide por lo que tarda en rendirse.' },
      { do: 'wait', ms: 400 },
      { do: 'say', who: 'machamp', mood: 'Normal', text: 'Saldremos a la cueva al amanecer. Y el Novato vendrá con nosotros.' },
      { do: 'emote', who: 'chatot', fx: 'shock' },
      { do: 'wait', ms: 600 },
      { do: 'say', who: 'chatot', mood: 'Stunned', text: '¿¡El Novato!?' },
      { do: 'say', who: 'machamp', mood: 'Normal', text: 'Ojos nuevos ven caminos nuevos.' },
      { do: 'say', who: 'chatot', mood: 'Worried', text: '… Está bien. Pero ni un rasguño. ¿Entendido?' },
      { do: 'say', who: 'heracross', mood: 'Normal', text: '… Oye, Chatot. ¿Hay savia?' },
      { do: 'emote', who: 'chatot', fx: 'anger' },
      { do: 'wait', ms: 400 },
      { do: 'say', who: 'chatot', mood: 'Angry', text: '¡¡NO HAY SAVIA!!' },
      { do: 'emote', who: 'chatot', fx: 'none' },
      { do: 'prop', who: 'chatot', set: { item: 'Manzana' } },
      { do: 'wait', ms: 500 },
      { do: 'say', who: 'chatot', mood: 'Sigh', text: '… Hay manzanas.' },
      { do: 'move', who: 'heracross', to: [[428, 286]], speed: 3.2 },   // ¡corre a por ella!
      { do: 'turn', who: 'heracross', toward: 'chatot' },
      { do: 'prop', who: 'chatot', set: { item: null } },   // se la coge de las manos
      { do: 'prop', who: 'heracross', set: { item: 'Manzana' } },
      { do: 'jump', who: 'heracross', to: [428, 286], ms: 240, h: 5 },
      { do: 'move', who: 'heracross', to: [[456, 304]], speed: 2 },
      { do: 'turn', who: 'heracross', toward: 'chatot' },
      { do: 'wait', ms: 700 },
      { do: 'say', who: 'heracross', mood: 'Joyous', text: '¡Sirve!' },
      { do: 'say', who: 'machamp', mood: 'Normal', text: 'Gracias por la hospitalidad.' },
      { do: 'turn', who: 'chatot', dir: 'left' },
      { do: 'wait', ms: 400 },
      { do: 'say', who: 'chatot', mood: 'Determined', text: 'Prepárate, Novato. La Cueva Húmeda no es el Bosque.' },
      { do: 'emote', who: 'player', fx: 'dots' },
      { do: 'wait', ms: 1500 },
      { do: 'fade', to: 'out', ms: 1200 },
    ],
  },
];
// trigger: 'hub' (al entrar en la aldea) o 'dungeon-exit' (al ir hacia las mazmorras)
export const pendingScene = (m, trigger = 'hub') => SCENES.find(sc => (sc.trigger || 'hub') === trigger && !(m.scenes || []).includes(sc.id) && sc.when(m)) || null;
