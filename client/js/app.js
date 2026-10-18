// Pantallas de acceso: elección, login, registro (quiz → resultado → cuenta). Luego arranca el juego.
import { api, setToken, hasToken, ApiError, onNetStatus } from './api.js';
import { track } from './telemetry.js';
import { API_URL } from './config.js';
// Despierta al servidor nada más abrir la página, mientras el jugador aún está en la pantalla de inicio
try { if (API_URL) fetch(API_URL + '/health', { cache: 'no-store', mode: 'no-cors' }).catch(() => {}); } catch {}
import { startGame } from './game.js';
import './gamepad.js';   // mando (Gamepad API): sus botones pulsan las teclas del juego
import { SPECIES } from '../../shared/data.js';
import { publicQuiz, scoreQuiz, quizText } from '../../server/quiz.js';   // el test se hace entero en el navegador (el servidor lo recalcula al crear la cuenta)
import { dialog, menu, keyboard, writeText, loadManifest, portraitOf, portraitURL, asset } from './ui.js';
import { initTouchControls } from './touch.js';
import { playTrack, stopMusic } from './music.js';
import { VERSION_LABEL } from '../../shared/version.js';
import { applyDomText, t, nm, getLang } from '../../shared/i18n.js';

const $ = s => document.querySelector(s);
const show = id => { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); $(id).classList.remove('hidden'); document.body.classList.toggle('in-game', id === '#screen-game'); if (id === '#screen-auth') playTrack('menu'); }; // música del menú (suena tras la primera pulsación, como exige el navegador)
const msg = (el, text, ok = false) => { el.textContent = text; el.classList.toggle('ok', ok); };
async function puruNotice() {
  const card = document.querySelector('#screen-auth .card'), choice = document.getElementById('auth-choice');
  const wrap = document.createElement('div'); wrap.className = 'puru-notice';
  wrap.innerHTML = '<div class="pmd-portrait"><img alt=""></div><div class="pmd-box"><p class="pmd-text"></p><span class="pmd-next hidden">▼</span></div>';
  choice.classList.add('hidden'); card.appendChild(wrap);
  await dialog(wrap.querySelector('.pmd-box'), [
    { who: 'Puru', text: '¡Hemos añadido una BASE DE DATOS (y la parte del servidor) al juego!!', portrait: await portraitURL('pidgeot', 'Joyous') },
    { who: 'Puru', text: 'Tu partida anterior no sirve, ¡lo siento! Tendrás que empezar de nuevo.', portrait: await portraitURL('pidgeot', 'Worried') },
  ], { portraitEl: wrap.querySelector('.pmd-portrait') });
  try { localStorage.removeItem('pmdt_save'); localStorage.removeItem('mm_known'); } catch {}
  wrap.remove(); choice.classList.remove('hidden');
}
let toastTimer;
export function toast(text, ms = 2500) { const el = $('#toast'); el.textContent = text; el.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), ms); }
// Aviso de conexión (arriba de la pantalla): mientras se espera al servidor, si se corta y se reintenta, o si no hay conexión
const netBanner = (() => { const el = document.createElement('div'); el.id = 'net-banner'; el.className = 'net-banner hidden'; document.body.appendChild(el); return el; })();
let netHide = null;
onNetStatus((s, n) => {
  clearTimeout(netHide);
  const txt = { waking: t('red.despertando'), retry: t('red.reintentando', { n: n ?? 1 }), down: t('red.caida') }[s];
  if (!txt) { netHide = setTimeout(() => netBanner.classList.add('hidden'), 400); return; }
  netBanner.textContent = txt; netBanner.dataset.kind = s; netBanner.classList.remove('hidden');
  if (s === 'down') netHide = setTimeout(() => netBanner.classList.add('hidden'), 7000);
  if (s === 'down') track('net_down');   // telemetría: problemas de conexión
});
const waking = () => toast(t('red.kecleon'), 8000);

// ---- elección / login / registro ----
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
  const to = b.dataset.go;
  if (to === 'login' && hasToken() && !b.dataset.force) return enterGame();   // sesión guardada: se entra directamente («Cambiar de cuenta» sí abre el formulario)
  ['choice', 'login'].forEach(k => $(`#auth-${k}`)?.classList.toggle('hidden', k !== to && !(to === 'quiz' && k === 'choice')));
  msg($('#auth-msg'), '');
  if (to === 'quiz') startQuiz();
}));

$('#auth-login').addEventListener('submit', async ev => {
  ev.preventDefault();
  const f = new FormData(ev.target), btn = ev.target.querySelector('button[type=submit]');
  btn.disabled = true; msg($('#auth-msg'), '');
  try {
    const r = await api('/auth/login', { name: f.get('name'), password: f.get('password') }, { onWaking: waking });
    setToken(r.token); await enterGame();
  } catch (e) { msg($('#auth-msg'), e.message); }
  finally { btn.disabled = false; }
});

// ---- fondo ondulante del quiz (dibujado por código, sin imagen) ----
const quizBg = { raf: null };
function startQuizBg() {
  const cv = $('#quiz-bg'), ctx = cv.getContext('2d');
  const resize = () => { cv.width = cv.clientWidth / 2; cv.height = cv.clientHeight / 2; }; // media resolución: más suave y más barato
  resize(); window.addEventListener('resize', resize);
  const draw = t => {
    const W = cv.width, H = cv.height, img = ctx.createImageData(W, H), d = img.data, s = t / 1000;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = x / W - 0.5, ny = y / H - 0.5;
      const v = Math.sin(nx * 9 + s) + Math.sin(ny * 7 - s * 0.8) + Math.sin((nx + ny) * 6 + s * 0.6) + Math.sin(Math.hypot(nx, ny) * 14 - s * 1.4);
      const k = (v + 4) / 8, i = (y * W + x) * 4; // 0..1
      d[i] = 40 + 90 * k; d[i + 1] = 30 + 60 * (1 - k); d[i + 2] = 110 + 120 * k; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    quizBg.raf = requestAnimationFrame(draw);
  };
  cancelAnimationFrame(quizBg.raf); quizBg.raf = requestAnimationFrame(draw);
}
function stopQuizBg() { cancelAnimationFrame(quizBg.raf); }

// ---- quiz ----
// La Voz (entidad sin nombre) despierta al jugador, le hace el test y le dice su naturaleza sin revelar el Pokémon.
const quiz = { questions: [], answers: [] };
// El progreso del test se guarda en el navegador: si la página se recarga (p. ej. en el móvil al cambiar de app),
// se sigue por la misma pregunta. Se borra al registrarse.
const QUIZ_KEY = 'pmdt_quiz';
const savedQuiz = () => { try { const s = JSON.parse(localStorage.getItem(QUIZ_KEY)); return s?.questions?.length && Date.now() - s.t < 3 * 864e5 ? s : null; } catch { return null; } };
const saveQuiz = () => { try { localStorage.setItem(QUIZ_KEY, JSON.stringify({ questions: quiz.questions, answers: quiz.answers, t: Date.now() })); } catch {} };
const clearQuiz = () => { try { localStorage.removeItem(QUIZ_KEY); } catch {} };
async function startQuiz() {
  show('#screen-quiz'); startQuizBg();
  playTrack('quiz'); // suena durante el test y las escenas de Diglett y Chatot; en la aldea se funde con su música
  const box = $('#quiz-box'), prog = $('#quiz-progress');
  prog.textContent = '';
  const resume = savedQuiz();
  if (resume) {   // se había quedado a medias: seguir por la misma pregunta
    quiz.questions = resume.questions; quiz.answers = resume.answers || [];
    await dialog(box, [{ text: t('prologo.vuelto1') }, { text: t('prologo.vuelto2') }]);
  } else {
  const loading = Promise.resolve({ questions: publicQuiz() });   // las preguntas, al instante: sin esperar al servidor
  // antes de las preguntas (de la 4.ª frase en adelante): explicar al jugador por qué se las hacemos
  await dialog(box, [1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ text: t('prologo.hola' + n) })));
  try { quiz.questions = (await loading).questions; } catch (e) { writeText(box, e.message);  return; }
  quiz.answers = []; saveQuiz();
  }
  for (let i = quiz.answers.length; i < quiz.questions.length; i++) {
    const qu = quiz.questions[i];
    // la pregunta se distingue: pestaña «Pregunta N de 12» y texto más grande; las respuestas, en su propio panel
    box.classList.add('asking'); $('#quiz-tab').textContent = t('prologo.pregunta', { n: i + 1, total: quiz.questions.length }); $('#quiz-tab').classList.remove('hidden');
    writeText(box, quizText(qu.id, null, getLang()) || qu.q);   // por su número: así sale en el idioma del jugador (también al retomarlo)
    const pick = await menu($('#quiz-answers'), qu.a.map(x => quizText(qu.id, x.k, getLang()) || x.t));
    quiz.answers[i] = { id: qu.id, a: qu.a[pick].k }; // la pregunta y la respuesta real (las respuestas vienen barajadas)
    saveQuiz();
  }
  box.classList.remove('asking'); $('#quiz-tab').classList.add('hidden');
  let result;
  const quizT0 = quiz.t0 || Date.now();
  try { result = scoreQuiz(quiz.answers);   // el resultado, al instante (el servidor lo vuelve a calcular al registrarte)
 track('quiz_done', { nature: result.nature, starter: result.starter, answers: quiz.answers.length }); }
  catch (e) {   // sin conexión: las respuestas están guardadas; al volver a «Nueva aventura» se retoma aquí
    writeText(box, e.message); await new Promise(r => setTimeout(r, 2500)); stopQuizBg();
    show('#screen-auth'); msg($('#auth-msg'), e.status === 0 ? t('inicio.sinRed') : e.message); return;
  }
  const nat = (getLang() === 'en' && result.en) || result;   // la naturaleza, en el idioma del jugador
  await dialog(box, [
    { text: t('prologo.yaVeo') },
    { text: t('prologo.naturaleza', { nat: getLang() === 'en' ? nat.name : nat.name.toLowerCase() }) },
    { text: nat.text },
    { text: t('prologo.ve') },
  ]);
  stopQuizBg();
  stopMusic(); // la música del test termina al llegar a la escena de Diglett
  await diglettScene(result);
  await chatotScene();
}

// ---- escena de la puerta: Diglett reconoce (o no) la huella sobre la rejilla ----
// huellas dibujadas que hay en client/assets/footprints (las demás se muestran como «?»)
const FOOTPRINTS = ['charmander'];
const imageExists = src => new Promise(res => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = src; });
async function diglettScene(result) {
  await loadManifest();
  show('#screen-scene');
  // Vista de Diglett desde el túnel (scene_diglett.png) si existe; si no, la puerta del gremio vista desde fuera
  const below = await imageExists(asset('scene_diglett', 'client/assets/hub/scene_diglett.png'));
  $('#scene-bg').src = below ? asset('scene_diglett', 'client/assets/hub/scene_diglett.png') : asset('scene_gate', 'client/assets/hub/scene_gate.png');
  const layer = $('#scene-layer'), box = $('#scene-box'), portraitEl = $('#scene-portrait');
  layer.innerHTML = '';
  const name = nm('species', result.starter, SPECIES[result.starter].name);
  // cada frase con su cara: [texto, emoción]
  const say = async pages => dialog(box, await Promise.all(pages.map(async ([text, mood]) => ({ who: 'Diglett', text, portrait: await portraitURL('diglett', mood) }))), { portraitEl });
  await say([[t('prologo.diglett1'), 'Shouting'], [t('prologo.diglett2'), 'Surprised']]);
  const src = asset('fp_' + result.starter, `client/assets/footprints/${result.starter}.png`);
  const known = FOOTPRINTS.includes(result.starter);   // sin intentar descargarla: así no hay errores 404 en la consola
  const fp = document.createElement('div'); fp.className = below ? 'footprint-on-gate from-below' : 'footprint-on-gate';
  fp.innerHTML = known ? `<img src="${src}" alt="">` : '<span>?</span>';
  layer.appendChild(fp);
  await say([
    [t(known ? 'prologo.huellaConocida' : 'prologo.huellaNueva', { especie: name }), known ? 'Happy' : 'Surprised'],
    [t('prologo.pasa'), 'Joyous'],
  ]);
}

// ---- escena del gremio: Chatot inscribe al recién llegado ----
async function chatotScene() {
  $('#scene-bg').src = asset('scene_guild', 'client/assets/hub/scene_guild.png');
  $('#scene-layer').innerHTML = '';
  const box = $('#scene-box'), portraitEl = $('#scene-portrait'), kb = $('#scene-kb');
  const say = async (text, mood = 'Normal') => dialog(box, [{ who: 'Chatot', text, portrait: await portraitURL('chatot', mood) }], { portraitEl });
  const hideNext = () => box.querySelector('.pmd-next').classList.add('hidden');
  await say(t('prologo.chatot1'), 'Happy');
  for (;;) {
    hideNext();
    const name = await keyboard(kb, { label: t('inicio.nombre'), max: 20, min: 2, validate: v => /^[\p{L}\p{N} _.-]{2,20}$/u.test(v) ? null : t('teclado.caracteres') });
    await say(t('prologo.chatot2'));
    hideNext();
    const password = await keyboard(kb, { label: t('inicio.codigo'), max: 32, min: 4, masked: true });
    try {
      const r = await api('/auth/register', { name, password, answers: quiz.answers }, { onWaking: waking });   // el servidor puede estar despertando
      setToken(r.token); clearQuiz(); await enterGame(); return;
    } catch (e) {
      // ¿ya existe? Puede ser tu propia cuenta, si el registro llegó pero se perdió la respuesta: se prueba a entrar
      if (e.status === 409) { try { const r = await api('/auth/login', { name, password }); setToken(r.token); clearQuiz(); await enterGame(); return; } catch { /* es de otro */ } }
      await say(e.status === 409 ? t('prologo.nombreOcupado') : e.status === 0 ? t('prologo.sinRed') : e.message, 'Surprised');
    }
  }
}

// ---- juego ----
async function enterGame() {
  const loading = $('#loading'); loading.classList.remove('hidden');   // pantalla de carga hasta que la aldea esté lista
  try {
    const me = await api('/me', undefined, { onWaking: waking });
    try { localStorage.setItem('mm_known', '1'); } catch {}
    show('#screen-game');
    await startGame(me);
  } catch (e) {
    setToken(null); show('#screen-auth'); msg($('#auth-msg'), e.message);
  } finally { loading.classList.add('hidden'); }
}
$('#logout').addEventListener('click', async () => { try { await api('/auth/logout', {}); } catch {} setToken(null); location.reload(); });

applyDomText();   // textos de la página en el idioma guardado en este navegador
initTouchControls();
// ni arrastrar imágenes ni seleccionar con doble clic fuera de los campos de texto
document.addEventListener('contextmenu', ev => { if (!ev.target.closest('input, textarea')) ev.preventDefault(); }); // el clic derecho no hace nada
document.addEventListener('dragstart', ev => { if (ev.target.tagName === 'IMG') ev.preventDefault(); });
document.addEventListener('mousedown', ev => { if (ev.detail > 1 && !ev.target.closest('input, textarea')) ev.preventDefault(); });
{ const v = $('#version-tag'); if (v) v.textContent = VERSION_LABEL; } // «Beta 0.1.0» bajo el logo
// logo: client/assets/logo.png sustituye al título en texto si existe
{ const img = $('#title-logo'), src = window.__ASSETS?.logo || 'client/assets/logo.png';
  if (img) { img.onload = () => { img.classList.remove('hidden'); $('#title-text')?.classList.add('hidden'); }; img.src = src; }
  const hdr = $('#hdr-logo');
  if (hdr) { hdr.onload = () => { hdr.classList.remove('hidden'); $('#hdr-title')?.classList.add('hidden'); }; hdr.src = src; } }
// Truco de pruebas: escribir PURUPURPITO en el menú principal carga una partida con Pidgeot nivel 99 y 9.999.999 Pokés
// (en el servidor real solo funciona con DEV_CHEATS=1)
{
  const CODE = 'purupurpito'; let typed = '';
  window.addEventListener('keydown', async ev => {
    if ($('#screen-auth').classList.contains('hidden') || ev.target.closest?.('input, textarea')) return;
    if (ev.key.length !== 1) return;
    typed = (typed + ev.key.toLowerCase()).slice(-CODE.length);
    if (typed !== CODE) return;
    typed = '';
    try {
      const r = await api('/dev/cheat', {});
      setToken(r.token); try { localStorage.setItem('mm_known', '1'); } catch {}
      stopMusic(); await enterGame();
    } catch (e) { msg($('#auth-msg'), t('inicio.truco')); }
  });
}
// "Continuar" solo tiene sentido si ya jugaste en este dispositivo
// «Continuar» siempre disponible: la cuenta vive en el servidor, así que puede existir aunque este navegador no lo sepa
show('#screen-auth');
// Con sesión guardada: la tarjeta «Continuar mi aventura» con lo que se guardó la última vez, y «Cambiar de cuenta»
(async () => {
  if (!hasToken()) return;
  let last = null; try { last = JSON.parse(localStorage.getItem('mm_last') || 'null'); } catch {}
  $('#btn-switch').classList.remove('hidden');
  if (!last) return;
  $('#session-info').innerHTML = `<b>${String(last.name).replace(/[<>&]/g, '')}</b><br>${t('inicio.sesion', { especie: nm('species', last.species, last.speciesName), n: last.level, p: last.pokes })}`;
  $('#session-card').classList.remove('hidden'); $('#btn-continue').classList.add('hidden');
  try {   // el sprite: el primer fotograma de reposo de su Pokémon
    const m = await loadManifest(), e = m[last.species]; if (!e?.idle) return;
    const img = new Image(); img.onload = () => { const cv = $('#session-sprite'), g = cv.getContext('2d'); g.imageSmoothingEnabled = false; const [fw, fh] = e.idleFrame; cv.width = fw * 2; cv.height = fh * 2; g.drawImage(img, 0, 0, fw, fh, 0, 0, fw * 2, fh * 2); }; img.src = e.idle;
  } catch {}
})();
