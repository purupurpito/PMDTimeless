// =====================================================================
// MANDO EN PANTALLA (móvil) — disposición de NDS: cruceta, A/B/X/Y, L/R, Start/Select.
// Cada botón envía la misma tecla que el teclado (Z=A, X=B, S=X, A=Y, Q=L, W=R, Enter=Start, Tab=Select),
// así el juego no necesita saber si juegas con teclado o con el dedo.
// Las esquinas de la cruceta son diagonales (mantienen R y pulsan dos direcciones, como en el juego).
// =====================================================================
const send = (type, key, repeat = false) => window.dispatchEvent(new KeyboardEvent(type, { key, repeat, bubbles: true }));

const DPAD = [
  ['ul', ['ArrowUp', 'ArrowLeft']], ['u', ['ArrowUp']], ['ur', ['ArrowUp', 'ArrowRight']],
  ['l', ['ArrowLeft']], ['c', []], ['r', ['ArrowRight']],
  ['dl', ['ArrowDown', 'ArrowLeft']], ['d', ['ArrowDown']], ['dr', ['ArrowDown', 'ArrowRight']],
];
const FACE = [['Y', 'a'], ['X', 's'], ['A', 'z'], ['B', 'x']];

export function initTouchControls() {
  const pad = document.createElement('div'); pad.id = 'touchpad'; pad.className = 'touchpad';
  pad.innerHTML = `
    <div class="tp-shoulders"><button data-key="q" class="tp-sh">L</button><div class="tp-mid"><button data-key="Tab" class="tp-sm">SELECT</button><button data-key="Enter" class="tp-sm">START</button></div><button data-key="w" class="tp-sh">R</button></div>
    <div class="tp-main">
      <div class="tp-dpad">${DPAD.map(([id]) => `<button class="tp-d tp-${id}" data-dir="${id}" ${id === 'c' ? 'tabindex="-1"' : ''}>${{ u: '▲', d: '▼', l: '◀', r: '▶' }[id] || ''}</button>`).join('')}</div>
      <div class="tp-face">${FACE.map(([label, key]) => `<button data-key="${key}" class="tp-f tp-${label}">${label}</button>`).join('')}</div>
    </div>`;
  document.body.appendChild(pad);

  const toggle = document.createElement('button'); toggle.id = 'touch-toggle'; toggle.className = 'touch-toggle'; toggle.textContent = '🎮';
  toggle.title = 'Mostrar/ocultar mando';
  toggle.addEventListener('click', () => setVisible(!document.body.classList.contains('touch-on')));
  document.body.appendChild(toggle);

  // botones simples: pulsar = keydown, soltar = keyup
  pad.querySelectorAll('[data-key]').forEach(b => {
    const key = b.dataset.key;
    b.addEventListener('pointerdown', ev => { ev.preventDefault(); try { b.setPointerCapture(ev.pointerId); } catch {} b.classList.add('down'); send('keydown', key); });
    const up = ev => { if (!b.classList.contains('down')) return; b.classList.remove('down'); send('keyup', key); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  });
  // cruceta: mantener pulsado repite el paso (como mantener una flecha)
  pad.querySelectorAll('[data-dir]').forEach(b => {
    const keys = DPAD.find(([id]) => id === b.dataset.dir)[1]; if (!keys.length) return;
    let timer = null, rep = null;
    const diag = keys.length === 2;
    b.addEventListener('pointerdown', ev => {
      ev.preventDefault(); try { b.setPointerCapture(ev.pointerId); } catch {} b.classList.add('down');
      if (diag) send('keydown', 'w');
      keys.forEach(k => send('keydown', k));
      timer = setTimeout(() => { rep = setInterval(() => keys.forEach(k => send('keydown', k, true)), 140); }, 320);
    });
    const up = () => {
      if (!b.classList.contains('down')) return; b.classList.remove('down');
      clearTimeout(timer); clearInterval(rep);
      keys.forEach(k => send('keyup', k)); if (diag) send('keyup', 'w');
    };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  });

  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  let saved = null; try { saved = localStorage.getItem('mm_touch'); } catch {}
  setVisible(saved ? saved === '1' : !!coarse);
}
function setVisible(on) {
  document.body.classList.toggle('touch-on', on);
  try { localStorage.setItem('mm_touch', on ? '1' : '0'); } catch {}
}
