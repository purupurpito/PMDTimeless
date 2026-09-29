// =====================================================================
// HISTORIA: capítulos, frases nuevas de los personajes y cartas de Murkrow.
// Todo el texto de la historia vive aquí, para poder revisarlo sin tocar el código del juego.
//
// Trasfondo (no se cuenta de golpe): hace muchos años, Pidgeot (entonces un Pidgey) y Rowlet formaban un equipo
// de exploración con un tercer miembro. Llegaron más hondo que nadie en la Mazmorra del Tiempo, y allí el tercero se
// quedó atrás, atrapado entre épocas. Pidgeot fundó el gremio; Rowlet se quedó en la fuente y nunca quiso
// evolucionar (si cambiaba, su amigo no la reconocería al volver). Las cartas sin remitente son páginas del diario
// de ese tercer miembro, que llegan a manos de Murkrow sin que nadie sepa cómo.
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
// from: quién firma (si es un personaje, sale su retrato: sp). murkrow: lo que comenta Murkrow después de leerla.
export const LETTERS = [
  { id: 'bienvenida', chapter: 1, from: 'Pidgeot, maestro del gremio', sp: 'pidgeot', title: 'Bienvenida al gremio', pages: [
    'Bienvenido al gremio. Chatot me ha contado que has superado el entrenamiento sin despeinarte. Bueno, casi.',
    'Aquí nadie explora solo. Esa es la única norma que de verdad importa. Las demás se las inventa Chatot.',
    'Nos vemos en las mazmorras. — P.' ] },
  { id: 'normas', chapter: 2, from: 'Chatot', sp: 'chatot', title: 'Normas del gremio (actualizadas)', pages: [
    'Normas del gremio, revisión número cuarenta y siete: uno, no se corre por los pasillos. Dos, no se toca la rejilla. Tres, no se le pregunta al maestro por el pasado.',
    'La tercera es nueva. No preguntes por qué. Precisamente de eso va la norma.' ] },
  { id: 'diario-1', chapter: 2, from: 'Sin remitente', title: 'Una página suelta', pages: [
    'Día 1. Hoy hemos fundado el equipo. P. dice que seremos los primeros en llegar al fondo de todo.',
    'R. no ha dicho nada. Se ha quedado mirando el agua de la fuente toda la tarde. Creo que le gusta verse reflejada.',
    'Yo solo sé que no quiero que esto se acabe nunca.' ],
    murkrow: '¡Crrraaa…! Esta carta no tiene remitente. Y el sello… es de hace muchísimos años. Yo no recuerdo haberla recogido. ¿O sí?' },
  { id: 'diario-2', chapter: 3, from: 'Sin remitente', title: 'Otra página suelta', pages: [
    'Día 40. La Cueva nos ha dado un buen susto. R. me ha curado con una baya que llevaba guardada desde hacía semanas.',
    'Dice que no le gusta cambiar las cosas de sitio. Ni las bayas, ni los caminos, ni a sí misma.' ] },
  { id: 'diario-3', chapter: 4, from: 'Sin remitente', title: 'Una página arrugada', pages: [
    'Día 112. P. ha evolucionado. Ahora es un Pidgeotto y no deja de presumir de alas.',
    'R. dice que ella no piensa evolucionar nunca. Yo creo que tiene miedo de no reconocerse en el agua.',
    'Le he prometido que, cambie lo que cambie, yo sí la reconoceré.' ] },
  { id: 'diario-4', chapter: 5, from: 'Sin remitente', title: 'Una página manchada', pages: [
    'Hemos encontrado una mazmorra que no sale en ningún mapa. Cada piso parece de una época distinta.',
    'Hoy he visto a alguien cruzar una sala a lo lejos. Andaba igual que yo. No se lo he contado a nadie.' ] },
  { id: 'diario-5', chapter: 6, from: 'Sin remitente', title: 'Una página con un emblema', pages: [
    'Mañana bajamos al piso cien. P. ha dibujado un emblema para el equipo: tres plumas juntas.',
    'Le he pedido a un Murkrow muy joven que guarde estas páginas y las reparta cuando llegue el momento. Ha dicho que sí sin preguntar qué momento. Me cae bien.' ],
    murkrow: '¿Un Murkrow muy joven…? ¡Crrraaa! ¿Esa carta habla de… mí?' },
  { id: 'diario-6', chapter: 7, from: 'Sin remitente', title: 'Una página que huele a lluvia', pages: [
    'No sé cuánto tiempo llevo aquí abajo. Aquí el tiempo no pasa: se amontona.',
    'A veces oigo a P. llamándome desde muy arriba. Si alguien encuentra estas páginas, decidle a R. que no hace falta que me espere igual. Que puede cambiar.' ] },
  { id: 'diario-7', chapter: 8, from: 'Sin remitente', title: 'La última página', pages: [
    'Sé que estás cerca. Te he visto en los ecos.',
    'Tienes una forma de andar que conozco.' ] },
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
export const STORY_LINES = {
  chatot: {
    3: [{ text: '¿Has visto a Murkrow? Dice que le llegan cartas que nadie ha enviado. ¡Tonterías de cartero!', mood: 'Angry' }],
    5: [{ text: 'Si encuentras algo… raro en las Ruinas, un emblema o algo así, tráemelo a mí primero. A mí. No al maestro.', mood: 'Worried' }],
    6: [{ text: 'El maestro te ha hablado del equipo, ¿verdad? En todos estos años, nunca se lo había contado a nadie.', mood: 'Sad' }],
    7: [{ text: 'Últimamente el maestro no duerme. Se queda en el tejado mirando hacia la Mazmorra del Tiempo.', mood: 'Worried' }],
  },
  diglett: {
    2: [{ text: 'Mi padre dice que hay huellas que no se borran nunca. Y otras que parecen de otro tiempo.', mood: 'Normal' }],
    7: [{ text: 'Hoy he visto tu huella en la entrada… junto a otra igualita. Pero tú no habías salido. ¿Eh?', mood: 'Surprised' }],
  },
  murkrow: {
    3: [{ text: '¡Crrraaa! Últimamente reparto cartas que no sé quién escribe. El sello es antiquísimo. Me dan escalofríos.', mood: 'Worried' }],
    6: [{ text: '¿Sabes? Tengo el recuerdo borroso de alguien que me pidió, hace mucho, que guardara unas páginas. ¡Crrraaa! No me acuerdo de su cara.', mood: 'Sad' }],
  },
  rowlet: {
    4: [{ text: 'Hubo un tiempo en que éramos tres… No me hagas caso.', mood: 'Sad' }], then: false,
    6: [{ text: 'Pidgeot te ha hablado de mí, ¿verdad? …¿Sigue igual de gruñón?', mood: 'Happy' }],
    7: [{ text: 'Cuando llegues al fondo, si ves algo que te resulte familiar… no tengas miedo.', mood: 'Worried' }],
  },
  chansey: {
    5: [{ text: '¿Sabías que el maestro también descansaba aquí, de joven? Siempre pedía la cama de al lado de la ventana. Y siempre sobraban dos camas.', mood: 'Normal' }],
  },
};
// La frase de capítulo pendiente para un personaje (o null). seen: conjunto de «personaje:capítulo» ya dichos.
export function storyLineFor(key, m, seen) {
  const byCh = STORY_LINES[key]; if (!byCh) return null;
  const ch = chapterOf(m);
  for (let c = ch; c >= 1; c--) if (byCh[c]) return seen.has(`${key}:${c}`) ? null : { chapter: c, pages: byCh[c], then: byCh.then !== false };
  return null;
}
