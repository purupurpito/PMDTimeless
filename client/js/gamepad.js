// Mando (Gamepad API): cada botón del mando «pulsa» la tecla del botón lógico del juego (como un emulador), así funciona igual
// en la aldea, las mazmorras, los menús y las escenas, sin tocar el teclado ni el táctil.
// Colocación de Nintendo: el botón de la derecha es A y el de abajo B (en un mando de Xbox: B → A, A → B, Y → X, X → Y).
// Índices del mapa estándar: 0 abajo · 1 derecha · 2 izquierda · 3 arriba · 4 L · 5 R · 8 Select · 9 Start · 12-15 cruceta.
const MAP = { 1: 'z', 0: 'x', 3: 's', 2: 'a', 4: 'q', 5: 'w', 6: 'q', 7: 'w', 9: 'Enter', 8: 'Tab', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const REPEAT_FIRST = 260, REPEAT_EVERY = 120, DEAD = 0.5;   // al mantener una dirección, se repite como el teclado
const down = new Map();   // tecla → instante de la última pulsación
const fire = (type, key, repeat = false) => {
  const code = key.length === 1 ? 'Key' + key.toUpperCase() : key;
  (document.activeElement && document.activeElement !== document.body ? document.activeElement : window).dispatchEvent(new KeyboardEvent(type, { key, code, repeat, bubbles: true, cancelable: true }));
};
function poll() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const want = new Set();
  for (const p of pads) {
    p.buttons.forEach((b, i) => { if ((b.pressed || b.value > 0.5) && MAP[i]) want.add(MAP[i]); });
    const [ax, ay] = [p.axes[0] || 0, p.axes[1] || 0];   // la palanca izquierda, como la cruceta
    if (ax < -DEAD) want.add('ArrowLeft'); if (ax > DEAD) want.add('ArrowRight'); if (ay < -DEAD) want.add('ArrowUp'); if (ay > DEAD) want.add('ArrowDown');
  }
  const now = performance.now();
  for (const k of want) {
    if (!down.has(k)) { down.set(k, { t0: now, last: now }); fire('keydown', k); }
    else if (ARROWS.has(k)) { const d = down.get(k); if (now - d.t0 > REPEAT_FIRST && now - d.last > REPEAT_EVERY) { d.last = now; fire('keydown', k, true); } }
  }
  for (const k of [...down.keys()]) if (!want.has(k)) { down.delete(k); fire('keyup', k); }
  if (pads.length || down.size) requestAnimationFrame(poll); else running = false;
}
let running = false;
const start = () => { if (!running) { running = true; requestAnimationFrame(poll); } };
window.addEventListener('gamepadconnected', start);
if (navigator.getGamepads && [...navigator.getGamepads()].some(Boolean)) start();
