// =====================================================================
// Efectos sobre la cabeza, como en el original (sobresalto, duda, «!», «…», gota, vena, corazón, destello).
// drawEmote(ctx, tipo, x, y, t, s): x, y = encima de la cabeza; t = segundos desde que empezó; s = tamaño del píxel.
// Devuelve false cuando ha terminado. Los que «se mantienen» (anger, joyous) se repiten mientras el guion no los apague.
// =====================================================================
export const EMOTE_LEN = { shock: 0.9, question: 1.4, notice: 0.55, sweat: 1.2, anger: 1.2, exclaim: 1.0, dots: 1.6, heart: 1.3 };
export const EMOTE_HOLD = new Set(['anger', 'joyous', 'laughing']);   // se mantienen hasta apagarlos
function pxl(c, x, y, s, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), s, s); }
export function drawEmote(c, type, x, y, t, s = 2) {
  if (t < 0 || t > EMOTE_LEN[type]) return false;
  c.save(); c.imageSmoothingEnabled = false;
  if (type === 'shock') {   // tres rayas amarillas que salen disparadas alrededor de la cabeza (dos pulsos)
    const pulse = t < 0.42 ? t : t - 0.45; if (pulse < 0) { c.restore(); return true; }
    const r = (6 + Math.min(1, pulse / 0.12) * 6) * s, len = 10 * s;
    for (const ang of [-2.3, -1.45, -0.6]) {
      const cx = x + Math.cos(ang) * r, cy = y + Math.sin(ang) * r;
      c.save(); c.translate(cx, cy); c.rotate(ang + Math.PI / 2);
      c.fillStyle = '#b89000'; c.beginPath(); c.moveTo(0, -len / 2 - s); c.lineTo(2.2 * s, 0); c.lineTo(0, len / 2 + s); c.lineTo(-2.2 * s, 0); c.fill();
      c.fillStyle = '#f8e030'; c.beginPath(); c.moveTo(0, -len / 2); c.lineTo(1.5 * s, 0); c.lineTo(0, len / 2); c.lineTo(-1.5 * s, 0); c.fill();
      c.fillStyle = '#fffbc0'; c.fillRect(-0.5 * s, -len / 4, s, len / 2); c.restore();
    }
  } else if (type === 'question') {   // interrogante azul que aparece y se balancea
    const k = Math.min(1, t / 0.12), fade = Math.min(1, (EMOTE_LEN.question - t) / 0.25);
    c.globalAlpha = fade; c.translate(x, y - 6 * s + Math.sin(t * 5) * s); c.rotate(Math.sin(t * 6) * 0.18); c.scale(k, k);
    c.font = `bold ${13 * s}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 2.5 * s / 2 + 1; c.strokeStyle = '#123a78'; c.strokeText('?', 0, 0); c.fillStyle = '#7cc8f8'; c.fillText('?', 0, 0);
    c.fillStyle = '#d8f0ff'; c.fillRect(-2 * s, -5 * s, s, s);
  } else if (type === 'notice') {   // destello en media luna junto a la cabeza (darse cuenta)
    const sweep = Math.min(1, t / 0.14), fade = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.25;
    c.globalAlpha = Math.max(0, fade); c.lineCap = 'round';
    const cx = x - 9 * s, cy = y + 4 * s, R = 9 * s, a0 = -2.6, a1 = a0 + 1.9 * sweep;
    c.strokeStyle = '#f8e030'; c.lineWidth = 4 * s; c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 2 * s; c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
  } else if (type === 'sweat') {   // gota de sudor que resbala por un lado de la cabeza
    const fall = Math.min(1, t / 0.9) * 6 * s, a = Math.min(1, (EMOTE_LEN.sweat - t) / 0.25);
    c.globalAlpha = a; const dx = x + 9 * s, dy = y + 2 * s + fall;
    c.fillStyle = '#1a3c80'; c.beginPath(); c.moveTo(dx, dy - 5 * s); c.quadraticCurveTo(dx + 4 * s, dy + s, dx, dy + 3 * s); c.quadraticCurveTo(dx - 4 * s, dy + s, dx, dy - 5 * s); c.fill();
    c.fillStyle = '#8ad0ff'; c.beginPath(); c.moveTo(dx, dy - 3.5 * s); c.quadraticCurveTo(dx + 2.6 * s, dy + s, dx, dy + 2 * s); c.quadraticCurveTo(dx - 2.6 * s, dy + s, dx, dy - 3.5 * s); c.fill();
    pxl(c, dx - s, dy - s, s, '#ffffff');
  } else if (type === 'anger') {   // vena de enfado que late
    const beat = 1 + 0.18 * Math.max(0, Math.sin(t * 14)), a = Math.min(1, (EMOTE_LEN.anger - t) / 0.2);
    c.globalAlpha = a; c.translate(x + 8 * s, y - 2 * s); c.scale(beat * Math.min(1, t / 0.1), beat * Math.min(1, t / 0.1));
    c.strokeStyle = '#7a0010'; c.lineWidth = 3.4 * s; c.lineCap = 'round';
    for (let q = 0; q < 4; q++) { c.save(); c.rotate(q * Math.PI / 2); c.beginPath(); c.arc(3 * s, 3 * s, 2.4 * s, Math.PI, Math.PI * 1.5); c.stroke(); c.restore(); }
    c.strokeStyle = '#f03040'; c.lineWidth = 1.8 * s;
    for (let q = 0; q < 4; q++) { c.save(); c.rotate(q * Math.PI / 2); c.beginPath(); c.arc(3 * s, 3 * s, 2.4 * s, Math.PI, Math.PI * 1.5); c.stroke(); c.restore(); }
  } else if (type === 'exclaim') {   // exclamación que salta
    const k = Math.min(1, t / 0.1), hop = t < 0.3 ? -Math.sin(t / 0.3 * Math.PI) * 4 * s : 0, a = Math.min(1, (EMOTE_LEN.exclaim - t) / 0.2);
    c.globalAlpha = a; c.translate(x, y - 6 * s + hop); c.scale(k, k);
    c.fillStyle = '#6a1000'; c.fillRect(-2.5 * s, -9 * s, 5 * s, 10 * s); c.fillRect(-2.5 * s, 2 * s, 5 * s, 4 * s);
    c.fillStyle = '#f8d020'; c.fillRect(-1.5 * s, -8 * s, 3 * s, 8 * s); c.fillRect(-1.5 * s, 3 * s, 3 * s, 2 * s);
  } else if (type === 'dots') {   // puntos suspensivos, uno a uno
    const n = Math.min(3, Math.floor(t / 0.3) + 1), a = Math.min(1, (EMOTE_LEN.dots - t) / 0.2); c.globalAlpha = a;
    for (let i = 0; i < n; i++) { c.fillStyle = '#202020'; c.fillRect(x - 7 * s + i * 5 * s - s, y - 5 * s - s, 4 * s, 4 * s); c.fillStyle = '#f0f0f0'; c.fillRect(x - 7 * s + i * 5 * s, y - 5 * s, 2 * s, 2 * s); }
  } else if (type === 'heart') {   // corazón que sube y se desvanece
    const up = t * 10 * s, a = Math.min(1, (EMOTE_LEN.heart - t) / 0.4), k = Math.min(1, t / 0.12);
    c.globalAlpha = a; c.translate(x + 6 * s, y - 4 * s - up); c.scale(k, k);
    c.fillStyle = '#801030'; c.beginPath(); c.moveTo(0, 4 * s); c.bezierCurveTo(-7 * s, -1 * s, -3 * s, -7 * s, 0, -3 * s); c.bezierCurveTo(3 * s, -7 * s, 7 * s, -1 * s, 0, 4 * s); c.fill();
    c.fillStyle = '#f85888'; c.beginPath(); c.moveTo(0, 2.6 * s); c.bezierCurveTo(-5 * s, -1 * s, -2.4 * s, -5 * s, 0, -2 * s); c.bezierCurveTo(2.4 * s, -5 * s, 5 * s, -1 * s, 0, 2.6 * s); c.fill();
  }
  c.restore(); return true;
}
