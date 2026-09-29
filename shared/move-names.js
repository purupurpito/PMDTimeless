// Nombres de movimientos de la época de Exploradores del Cielo. Los datos (PokeAPI) traen los nombres actuales en
// castellano; aquí se devuelven los de antes (según el historial de PKHeX). Los recortados por el límite de letras de
// la época se escriben completos.
export const MOVE_RENAME = {
  'Saña': 'Golpe', 'Agitacola': 'Látigo', 'Sísmico': 'Movimiento Sísmico', 'Espejo': 'Movimiento Espejo', 'Meteoros': 'Rapidez',
  'Ovocuración': 'Amortiguador', 'Comesueños': 'Come Sueños', 'Bombardeo': 'Presa', 'Forcejeo': 'Combate', 'Conversión 2': 'Conversión2',
  'Rodar': 'Desenrollar', 'Falso Tortazo': 'Falsotortazo', 'Cascabel Cura': 'Campana Cura', 'Llave Vital': 'Tiro Vital', 'Fotosíntesis': 'Síntesis',
  'Autosugestión': 'Más Psique', 'Sellar': 'Cerca', 'Luminicola': 'Ráfaga', 'Rayo Señal': 'Doble Rayo', 'Semilladora': 'Recurrente',
  'Cambiafuerza': 'Cambia Fuerza', 'Cambiadefensa': 'Cambia Defensa', 'Cambiaalmas': 'Cambia Almas', 'Gigaimpacto': 'Giga Impacto',
  'Esquirla Helada': 'Canto Helado', 'Cañón Resplandor': 'Foco Resplandor', 'Lanzamugre': 'Lanza Mugre', 'Fulgor Semilla': 'Fogonazo',
};
export const fixMoveName = n => MOVE_RENAME[n] || n;
const renameKeys = obj => { for (const [a, b] of Object.entries(MOVE_RENAME)) if (obj[a] !== undefined && obj[b] === undefined) { obj[b] = obj[a]; delete obj[a]; } };
// Renombra en su sitio todas las tablas que usan nombres de movimientos
export function applyMoveNames({ moveTables = [], learnsetsBySpecies = [], lists = [], learnPairs = [] }) {
  moveTables.forEach(renameKeys);
  for (const table of learnsetsBySpecies) for (const sp of Object.values(table)) {
    const ls = sp?.learnset; if (!ls) continue;
    for (const lv of Object.keys(ls)) ls[lv] = Array.isArray(ls[lv]) ? ls[lv].map(fixMoveName) : fixMoveName(ls[lv]);
  }
  for (const list of lists) for (let i = 0; i < list.length; i++) list[i] = fixMoveName(list[i]);
  for (const table of learnPairs) for (const arr of Object.values(table)) for (const pair of arr) if (Array.isArray(pair)) pair[1] = fixMoveName(pair[1]); else if (typeof pair === 'string') arr[arr.indexOf(pair)] = fixMoveName(pair);
}
