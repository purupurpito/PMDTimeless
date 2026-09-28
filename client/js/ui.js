// =====================================================================
// INTERFAZ ESTILO PMD (DOM) para las escenas previas al juego:
// cuadro de diálogo con texto letra a letra, menú con cursor ▸ y teclado en pantalla.
// Todo se maneja igual con teclado (flechas, Z/Enter = aceptar, X = atrás), ratón o pantalla táctil.
// =====================================================================

// ---- un único enrutador de teclas para las escenas ----
let handler = null;
export const setKeyHandler = fn => { handler = fn; };
const KEYMAP = { arrowup: 'UP', arrowdown: 'DOWN', arrowleft: 'LEFT', arrowright: 'RIGHT', z: 'A', enter: 'START', ' ': 'A', x: 'B', escape: 'B', backspace: 'B' }; // Enter = Start: en diálogos y menús equivale a A; en el teclado de nombre, confirma
window.addEventListener('keydown', ev => {
  if (!handler) return;
  const typing = document.activeElement?.tagName === 'INPUT';
  const k = ev.key.toLowerCase();
  // escribiendo en un campo de texto: sólo Enter (aceptar) y Escape (salir del campo) los gestiona la escena
  if (typing && k !== 'enter' && k !== 'escape') return;
  const btn = KEYMAP[k]; if (!btn) return;
  ev.preventDefault();
  handler(btn, ev);
});

// ---- recursos: la demo los inyecta como data URI; el proyecto los sirve como archivos ----
export const asset = (key, path) => window.__ASSETS?.[key] || path;
let manifest = null;
export async function loadManifest() {
  if (manifest) return manifest;
  if (window.__MANIFEST) return (manifest = window.__MANIFEST);
  try { manifest = await (await fetch('client/assets/manifest.json')).json(); } catch { manifest = {}; }
  if (manifest._font && !document.fonts.check('12px PMDFont')) {
    try { const f = new FontFace('PMDFont', `url(${manifest._font})`); await f.load(); document.fonts.add(f); } catch { /* sin fuente propia */ }
  }
  return manifest;
}
// Retrato provisional propio (recuadro de color con la inicial) mientras no haya sprite: ocupa el mismo sitio que el real
const hue = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
export const placeholderPortrait = name => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="4" fill="hsl(${hue(name)},45%,42%)"/><rect x="3" y="3" width="34" height="34" rx="3" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/><text x="20" y="27" text-anchor="middle" font-family="monospace" font-size="20" font-weight="700" fill="#fff">${name[0].toUpperCase()}</text></svg>`);
// Retrato con emoción desde el atlas de PMDCollab (→ data URL para <img>); si no hay, el de los sprites o la inicial
import { PORTRAIT, PORTRAIT_COLS } from './portraits.js';
let atlasP = null;
const loadAtlas = () => atlasP ||= new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = asset('portraits_atlas', 'client/assets/portraits/portraits.png'); });
export async function portraitURL(id, mood = 'Normal') {
  const set = PORTRAIT[id], im = set && await loadAtlas();
  if (!im) return portraitOf(id);
  const emo = [mood, 'Normal'].find(e => set[e] !== undefined) ?? Object.keys(set)[0], i = set[emo];
  const c = document.createElement('canvas'); c.width = c.height = 40;
  c.getContext('2d').drawImage(im, (i % PORTRAIT_COLS) * 40, Math.floor(i / PORTRAIT_COLS) * 40, 40, 40, 0, 0, 40, 40);
  return c.toDataURL();
}
export const portraitOf = (id, name = id) => manifest?.[id]?.portrait || manifest?.[id]?.portraits?.Normal || placeholderPortrait(name);

// ---- texto letra a letra ----
function typewriter(el, html, speed = 28) {
  el._tw?.cancel(); // si aún se escribía otro texto aquí (p. ej. se contestó rápido), se corta: nunca se solapan
  // html admite <b class="who">Nombre:</b> al principio; se escribe el texto visible manteniendo esa marca
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  const who = tmp.querySelector('.who')?.outerHTML || '';
  tmp.querySelector('.who')?.remove();
  const text = tmp.textContent;
  let i = 0, timer = null, done = false;
  const paint = () => { el.innerHTML = who + escapeHtml(text.slice(0, i)); };
  const finish = () => { clearInterval(timer); i = text.length; paint(); done = true; };
  paint();
  // las letras dependen del tiempo transcurrido, no de los tics: la velocidad es la misma en cualquier dispositivo
  const t0 = performance.now();
  timer = setInterval(() => { const n = Math.min(text.length, Math.floor((performance.now() - t0) / speed) + 1); if (n !== i) { i = n; paint(); } if (i >= text.length) finish(); }, Math.min(speed, 16));
  const tw = { get done() { return done; }, finish, cancel: () => { clearInterval(timer); done = true; } };
  el._tw = tw;
  return tw;
}
const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- escribir un texto en el cuadro sin esperar (p. ej. la pregunta mientras se muestra el menú) ----
export function writeText(box, text, who, speed) {
  box.classList.remove('hidden'); box.querySelector('.pmd-next').classList.add('hidden');
  return typewriter(box.querySelector('.pmd-text'), (who ? `<b class="who">${escapeHtml(who)}:</b> ` : '') + escapeHtml(text), speed ?? (box.id === 'quiz-box' ? 14 : 28)); // en el test, el doble de rápido
}

// ---- cuadro de diálogo: pages = [{ who, text, portrait }] → Promise al terminar ----
export function dialog(box, pages, { portraitEl } = {}) {
  const textEl = box.querySelector('.pmd-text'), nextEl = box.querySelector('.pmd-next');
  box.classList.remove('hidden');
  return new Promise(resolve => {
    let p = 0, tw = null;
    const showPage = () => {
      const pg = pages[p];
      if (portraitEl) {
        if (pg.portrait) { portraitEl.classList.remove('hidden'); portraitEl.querySelector('img').src = pg.portrait; }
        else portraitEl.classList.add('hidden');
      }
      nextEl.classList.add('hidden');
      tw = typewriter(textEl, (pg.who ? `<b class="who">${escapeHtml(pg.who)}:</b> ` : '') + escapeHtml(pg.text), box.id === 'quiz-box' ? 14 : 28); // en el test, el doble de rápido
      const watch = setInterval(() => { if (tw.done) { clearInterval(watch); nextEl.classList.remove('hidden'); } }, 50);
    };
    const advance = () => {
      if (!tw.done) return tw.finish();
      p++;
      if (p < pages.length) showPage();
      else { area.removeEventListener('click', onClick); setKeyHandler(null); resolve(); }
    };
    // un clic en cualquier parte de la pantalla avanza, como la Z (A); salvo en botones, menús o el teclado en pantalla
    const area = box.closest('.screen') || box;
    const onClick = ev => { if (ev.target.closest?.('button, input, .pmd-menu, .kb, .kb-key, a, select')) return; advance(); };
    area.addEventListener('click', onClick);
    setKeyHandler(btn => { if (btn === 'A' || btn === 'START') advance(); });
    showPage();
  });
}

// ---- menú con cursor ▸ : items = ['texto', …] → Promise<índice> ----
export function menu(el, items) {
  el.innerHTML = ''; el.classList.remove('hidden');
  let idx = 0;
  const rows = items.map((t, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.addEventListener('mousedown', ev => ev.preventDefault()); /* la tecla no se queda con el foco */ b.className = 'pmd-opt'; b.textContent = t;
    b.addEventListener('pointerenter', () => { idx = i; paint(); });
    el.appendChild(b); return b;
  });
  const paint = () => rows.forEach((r, i) => r.classList.toggle('on', i === idx));
  paint();
  return new Promise(resolve => {
    const pickIt = i => { setKeyHandler(null); el.classList.add('hidden'); resolve(i); };
    rows.forEach((r, i) => r.addEventListener('click', ev => { ev.stopPropagation(); pickIt(i); }));
    setKeyHandler(btn => {
      if (btn === 'UP') { idx = (idx - 1 + rows.length) % rows.length; paint(); }
      else if (btn === 'DOWN') { idx = (idx + 1) % rows.length; paint(); }
      else if (btn === 'A' || btn === 'START') pickIt(idx);
    });
  });
}

// ---- teclado en pantalla (como la pantalla de nombre de PMD) → Promise<texto> ----
// Se navega con flechas y X, se pulsa con el ratón/dedo, o se escribe directamente tocando el campo.
const UPPER = ['ABCDEFGHIJ', 'KLMNÑOPQRS', 'TUVWXYZ.-_', '0123456789'];
export function keyboard(el, { label, max = 20, min = 2, masked = false, initial = '', validate } = {}) {
  el.innerHTML = ''; el.classList.remove('hidden');
  let lower = false, row = 0, col = 0;
  const head = document.createElement('div'); head.className = 'kb-head';
  head.innerHTML = `<span class="kb-label">${escapeHtml(label)}</span>`;
  const input = document.createElement('input');
  input.type = masked ? 'password' : 'text'; input.maxLength = max; input.value = initial; input.autocomplete = 'off'; input.spellcheck = false;
  input.className = 'kb-input';
  const count = document.createElement('span'); count.className = 'kb-count';
  head.append(input, count);
  const grid = document.createElement('div'); grid.className = 'kb-grid';
  const err = document.createElement('p'); err.className = 'kb-err';
  el.append(head, grid, err);

  const ACTIONS = [{ k: 'case', t: 'Aa' }, { k: 'space', t: 'Espacio' }, { k: 'del', t: 'Borrar' }, { k: 'ok', t: 'OK' }];
  let cells = [];
  const layout = () => {
    grid.innerHTML = ''; cells = [];
    UPPER.forEach((line, r) => {
      const rowEl = document.createElement('div'); rowEl.className = 'kb-row'; cells[r] = [];
      [...line].forEach((ch, c) => {
        const t = lower && /[A-ZÑ]/.test(ch) ? ch.toLowerCase() : ch;
        const b = document.createElement('button'); b.type = 'button'; b.addEventListener('mousedown', ev => ev.preventDefault()); /* la tecla no se queda con el foco */ b.className = 'kb-key'; b.textContent = t;
        b.addEventListener('click', ev => { ev.stopPropagation(); row = r; col = c; press(); });
        rowEl.appendChild(b); cells[r].push({ el: b, ch: t });
      });
      grid.appendChild(rowEl);
    });
    const actEl = document.createElement('div'); actEl.className = 'kb-row kb-actions'; const r = UPPER.length; cells[r] = [];
    ACTIONS.forEach((a, c) => {
      const b = document.createElement('button'); b.type = 'button'; b.addEventListener('mousedown', ev => ev.preventDefault()); /* la tecla no se queda con el foco */ b.className = 'kb-key kb-act' + (a.k === 'ok' ? ' kb-ok' : ''); b.textContent = a.t;
      b.addEventListener('click', ev => { ev.stopPropagation(); row = r; col = c; press(); });
      actEl.appendChild(b); cells[r].push({ el: b, action: a.k });
    });
    grid.appendChild(actEl);
    paint();
  };
  const paint = () => {
    cells.forEach((rw, r) => rw.forEach((c, i) => c.el.classList.toggle('on', r === row && i === col)));
    count.textContent = `${input.value.length}/${max}`;
  };
  const type = ch => { if (input.value.length < max) input.value += ch; err.textContent = ''; paint(); };

  let resolveFn = null;
  const submit = () => {
    const v = masked ? input.value : input.value.trim();
    if (v.length < min) { err.textContent = `Mínimo ${min} caracteres.`; return; }
    const bad = validate?.(v); if (bad) { err.textContent = bad; return; }
    setKeyHandler(null); input.blur(); el.classList.add('hidden'); resolveFn(v);
  };
  function press() {
    const c = cells[row][col];
    if (c.ch) type(c.ch);
    else if (c.action === 'case') { lower = !lower; layout(); }
    else if (c.action === 'space') type(' ');
    else if (c.action === 'del') { input.value = input.value.slice(0, -1); paint(); }
    else if (c.action === 'ok') submit();
  }
  input.addEventListener('input', () => { err.textContent = ''; paint(); });
  input.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); submit(); } else if (ev.key === 'Escape') { input.blur(); } });
  return new Promise(resolve => {
    resolveFn = resolve;
    setKeyHandler(btn => {
      const rows = cells.length;
      if (btn === 'UP') { row = (row - 1 + rows) % rows; col = Math.min(col, cells[row].length - 1); }
      else if (btn === 'DOWN') { row = (row + 1) % rows; col = Math.min(col, cells[row].length - 1); }
      else if (btn === 'LEFT') col = (col - 1 + cells[row].length) % cells[row].length;
      else if (btn === 'RIGHT') col = (col + 1) % cells[row].length;
      else if (btn === 'A') press();
      else if (btn === 'B') { input.value = input.value.slice(0, -1); }
      else if (btn === 'START') { submit(); return; }   // Enter confirma aunque se haya escrito con el ratón
      paint();
    });
    layout();
  });
}
