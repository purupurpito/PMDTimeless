// =====================================================================
// ICONOS DE TIPO — diseño propio: insignia redondeada del color del tipo con un símbolo sencillo en blanco.
// (No son los iconos oficiales.) Sirven para HTML (<img>) y para el canvas (Image cacheada).
// =====================================================================
export const TYPE_COLORS = {
  Normal: '#9a9a78', Fuego: '#e8742a', Agua: '#4f86e8', 'Eléctrico': '#e6b81c', Planta: '#5fae3c', Hielo: '#5cc2c0',
  Lucha: '#b8322b', Veneno: '#9546a0', Tierra: '#c89a42', Volador: '#8a7ae0', 'Psíquico': '#e8507f', Bicho: '#93a51c',
  Roca: '#a48f3a', Fantasma: '#6a5596', 'Dragón': '#5f3ae0', Siniestro: '#5e4a3f', Acero: '#8e9ab0', Hada: '#d677b0',
};
// estrella de 8 puntas (impacto) para Lucha
const burst = (() => { const p = []; for (let i = 0; i < 16; i++) { const r = i % 2 ? 3.6 : 8.2, a = Math.PI * i / 8 - Math.PI / 2; p.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`); } return p.join(' '); })();
const W = 'fill="#fff"', S = 'fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
const GLYPHS = {
  Normal: `<circle cx="12" cy="12" r="5.6" ${S}/>`,
  Fuego: `<path ${W} d="M12 3.5c1.2 3 4.6 4.8 4.6 9a4.6 4.6 0 0 1-9.2 0c0-2.2 1.3-3.4 2.2-4.6.3 1.6 1.1 2.4 1.9 2.8-.5-2.6.1-5 .5-7.2z"/>`,
  Agua: `<path ${W} d="M12 3.8c3 4.3 5.3 7.2 5.3 10.2a5.3 5.3 0 0 1-10.6 0c0-3 2.3-5.9 5.3-10.2z"/>`,
  'Eléctrico': `<path ${W} d="M13.6 3 6.4 13.4h4.9L10 21l7.6-10.6h-5z"/>`,
  Planta: `<path ${W} d="M5 18.8C5 10.2 10.4 5 19 5c0 8.6-5.2 13.8-14 13.8z"/><path d="M6.4 17.6 15.2 8.8" fill="none" stroke="{C}" stroke-width="1.6" stroke-linecap="round"/>`,
  Hielo: `<path ${S} d="M12 4.2v15.6M5.2 8.1l13.6 7.8M5.2 15.9l13.6-7.8"/>`,
  Lucha: `<polygon ${W} points="${burst}"/>`,
  Veneno: `<circle ${W} cx="9" cy="14.5" r="3.7"/><circle ${W} cx="15.4" cy="12.4" r="3"/><circle ${W} cx="12.2" cy="7.2" r="2.2"/>`,
  Tierra: `<path ${S} d="M4.5 17.5h15M7 13.2h10M9.6 8.9h4.8"/>`,
  Volador: `<path ${W} d="M4 15.2c4.2-1 7.2-4.2 9.2-9.2 1 4.1 0 7.1-2 9.1 2.6 0 5.1-1 8.6-3-1.6 4.1-5.6 6.6-11.2 6.6-2 0-3.6-1.5-4.6-3.5z"/>`,
  'Psíquico': `<ellipse cx="12" cy="12" rx="7.4" ry="4.6" ${S}/><circle ${W} cx="12" cy="12" r="2.3"/>`,
  Bicho: `<ellipse ${W} cx="12" cy="13.6" rx="5" ry="5.9"/><circle ${W} cx="12" cy="6.1" r="2.3"/><path d="M12 8.6v10.6" fill="none" stroke="{C}" stroke-width="1.5"/>`,
  Roca: `<polygon ${W} points="6,17.6 4.4,11.2 9,5.4 15.6,5.9 19.6,11.6 17,17.8"/>`,
  Fantasma: `<path ${W} d="M6.5 19.2V11a5.5 5.5 0 0 1 11 0v8.2l-2.2-1.7-2.1 1.7-2.1-1.7-2.1 1.7z"/><circle cx="10" cy="10.6" r="1.3" fill="{C}"/><circle cx="14" cy="10.6" r="1.3" fill="{C}"/>`,
  'Dragón': `<path ${S} d="M6 17.5 12 6.5M10 18.5 16 7.5M14.2 19.2 19 10.6"/>`,
  Siniestro: `<path ${W} d="M15.6 4.4a7.6 7.6 0 1 0 4 12.8A6.1 6.1 0 0 1 15.6 4.4z"/>`,
  Acero: `<polygon ${W} points="12,4.2 18.8,8.1 18.8,15.9 12,19.8 5.2,15.9 5.2,8.1"/><circle cx="12" cy="12" r="2.8" fill="{C}"/>`,
  Hada: `<path ${W} d="M12 3.5 13.9 10.1 20.5 12 13.9 13.9 12 20.5 10.1 13.9 3.5 12 10.1 10.1z"/>`,
};
export function typeIconSVG(type) {
  const c = TYPE_COLORS[type] || '#777';
  const g = (GLYPHS[type] || '').replaceAll('{C}', c);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="5.5" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>${g}</svg>`;
}
const urls = {};
export const typeIconURL = type => (urls[type] ||= 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(typeIconSVG(type)));
export const typeIconHTML = (type, cls = 'ti') => `<img class="${cls}" src="${typeIconURL(type)}" alt="${type}" title="${type}">`;
const imgs = {};
export function typeIconImg(type) {
  if (imgs[type]) return imgs[type];
  const im = new Image(); im.src = typeIconURL(type); imgs[type] = im; return im;
}
