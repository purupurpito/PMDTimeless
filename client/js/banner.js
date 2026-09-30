// =====================================================================
// Cartel de capítulo («Acto 1 · La bienvenida»), como el de Exploradores del Cielo al empezar cada capítulo:
// un panel con los colores del logo, colgado del logo de PMD: Timeless como si fuera un pin. Cae desde arriba, se
// balancea hasta quedarse quieto, se mantiene y sube para irse.
// drawChapterBanner(ctx, W, H, t, { act, title }, logoImg) → false cuando ha terminado. t en segundos.
// =====================================================================
export const BANNER_LEN = 4.6;
const C = { gold: '#edcb4f', goldDark: '#b8891c', orange: '#de601d', navy: '#050a1e', blueTop: '#1d4b96', blueBot: '#0a1a42', cyan: '#63c4f5', cream: '#fdf6e3', leaf: '#3aa845', leafDark: '#1f6b2a' };

const easeOutBack = k => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function leaf(ctx, x, y, len, ang) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = C.leafDark; ctx.beginPath(); ctx.ellipse(0, 0, len / 2 + 1.5, len / 4.4 + 1.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = C.leaf; ctx.beginPath(); ctx.ellipse(0, 0, len / 2, len / 4.4, 0, 0, 7); ctx.fill(); ctx.strokeStyle = C.leafDark; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-len / 2 + 2, 0); ctx.lineTo(len / 2 - 2, 0); ctx.stroke(); ctx.restore(); }
function paw(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = C.goldDark;
  ctx.beginPath(); ctx.ellipse(0, 2 * s, 4.2 * s, 3.4 * s, 0, 0, 7); ctx.fill();
  for (const [dx, dy] of [[-4.2, -2.6], [-1.4, -4.8], [1.8, -4.8], [4.5, -2.4]]) { ctx.beginPath(); ctx.arc(dx * s, dy * s, 1.5 * s, 0, 7); ctx.fill(); }
  ctx.restore();
}
function gear(ctx, x, y, r) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = C.gold; ctx.strokeStyle = C.navy; ctx.lineWidth = 1.5;
  ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr = i % 2 ? r : r * 1.3; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.blueBot; ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, 7); ctx.fill(); ctx.restore();
}
function fitText(ctx, text, maxW, size, weight = 'bold') { let s = size; do { ctx.font = `${weight} ${s}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`; s -= 1; } while (ctx.measureText(text).width > maxW && s > 10); return s + 1; }

let shadowCache = null;
function shadowOf(img) {   // silueta oscura del logo, para su sombra
  if (shadowCache?.src === img) return shadowCache.cv;
  const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight; const g = cv.getContext('2d');
  g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  shadowCache = { src: img, cv }; return cv;
}
export function drawChapterBanner(ctx, W, H, t, { act, title }, logo) {
  if (t < 0 || t > BANNER_LEN) return false;
  const inT = 0.6, outT = BANNER_LEN - 0.5;
  // la escena se oscurece por detrás
  const dim = Math.min(1, t / 0.35, (BANNER_LEN - t) / 0.35);
  ctx.save(); ctx.fillStyle = `rgba(3, 6, 20, ${0.58 * dim})`; ctx.fillRect(0, 0, W, H);
  const pw = Math.min(W * 0.74, 440), ph = Math.min(H * 0.42, 158), cx = W / 2, pinY = H * 0.46 - ph / 2;
  // cae desde arriba (con un pequeño rebote), se balancea colgando del pin y, al final, sube
  const drop = t < inT ? easeOutBack(t / inT) : 1, rise = t > outT ? (t - outT) / 0.5 : 0;
  const y0 = -ph - 40 + (pinY + ph + 40) * drop - rise * (pinY + ph + 60);
  const swing = t < inT ? 0 : 0.085 * Math.exp(-2.6 * (t - inT)) * Math.sin(8.5 * (t - inT));
  ctx.globalAlpha = 1 - rise;
  ctx.translate(cx, y0); ctx.rotate(swing);
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,.4)'; roundRect(ctx, -pw / 2 + 5, 8, pw, ph, 12); ctx.fill();
  // marco: azul muy oscuro, dorado y un filete naranja (los colores del logo)
  ctx.fillStyle = C.navy; roundRect(ctx, -pw / 2 - 2, -2, pw + 4, ph + 4, 13); ctx.fill();
  ctx.fillStyle = C.gold; roundRect(ctx, -pw / 2 + 1, 1, pw - 2, ph - 2, 11); ctx.fill();
  const g = ctx.createLinearGradient(0, 6, 0, ph - 6); g.addColorStop(0, C.blueTop); g.addColorStop(1, C.blueBot);
  ctx.fillStyle = g; roundRect(ctx, -pw / 2 + 6, 6, pw - 12, ph - 12, 8); ctx.fill();
  ctx.strokeStyle = C.orange; ctx.lineWidth = 1.5; roundRect(ctx, -pw / 2 + 9.5, 9.5, pw - 19, ph - 19, 6); ctx.stroke();
  ctx.strokeStyle = 'rgba(99,196,245,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-pw / 2 + 20, 14); ctx.lineTo(pw / 2 - 20, 14); ctx.stroke();   // brillo de arriba
  // adornos: hojas abajo a la derecha, huella abajo a la izquierda
  leaf(ctx, pw / 2 - 20, ph - 16, 20, -0.9); leaf(ctx, pw / 2 - 33, ph - 11, 16, -0.25); leaf(ctx, pw / 2 - 12, ph - 30, 14, -1.5);
  paw(ctx, -pw / 2 + 24, ph - 20, 1.3);
  // textos: «Acto N» en dorado, separador con engranaje, y el título grande
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const s1 = fitText(ctx, act, pw * 0.6, Math.round(ph * 0.17));
  ctx.lineWidth = 5; ctx.strokeStyle = C.navy; ctx.strokeText(act, 0, ph * 0.33); ctx.fillStyle = C.gold; ctx.fillText(act, 0, ph * 0.33);
  const sepY = ph * 0.49, sepW = Math.min(pw * 0.46, 170);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-sepW / 2, sepY); ctx.lineTo(-10, sepY); ctx.moveTo(10, sepY); ctx.lineTo(sepW / 2, sepY); ctx.stroke();
  gear(ctx, 0, sepY, 5);
  fitText(ctx, title, pw * 0.84, Math.round(ph * 0.25));
  ctx.lineWidth = 6; ctx.strokeStyle = C.navy; ctx.strokeText(title, 0, ph * 0.7);
  ctx.fillStyle = '#2a7fd0'; ctx.fillText(title, 0, ph * 0.7 + 2);   // sombra azul
  ctx.fillStyle = C.cream; ctx.fillText(title, 0, ph * 0.7);
  ctx.rotate(-swing);   // el pin (el logo) no gira: es el punto del que cuelga el cartel
  if (logo?.complete && logo.naturalWidth) {
    const lw = Math.min(pw * 0.3, 118), lh = lw * logo.naturalHeight / logo.naturalWidth;
    ctx.globalAlpha = (1 - rise) * 0.45; ctx.drawImage(shadowOf(logo), -lw / 2 + 3, -lh * 0.62 + 5, lw, lh);   // sombra del pin
    ctx.globalAlpha = 1 - rise; ctx.drawImage(logo, -lw / 2, -lh * 0.62, lw, lh);
  }
  ctx.restore();
  return true;
}
