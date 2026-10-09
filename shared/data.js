// =====================================================================
// DATOS DEL JUEGO — compartidos entre cliente y servidor (ESM puro, sin DOM)
// =====================================================================
export const CFG = {
  tile: 24, view: { w: 25, h: 17 }, map: { w: 64, h: 36 }, cells: { cols: 4, rows: 3 },
  roomMin: 4, roomMax: 9, enemiesPerFloor: [4, 8], bellyEveryTurns: 10, bellySlowDungeons: { tiempo: 2 }, sightRadius: 6, corridorSight: 2, turnLimit: 1000, windWarnings: [250, 150, 50], spawnEvery: 36, spawnCap: 15, regenSpeed: 200, // valores de Exploradores del Cielo: barriga −1 cada 10 turnos, viento a los 1000 turnos, un enemigo nuevo cada 36
  startLevel: 5, minibossEvery: 10, legendaryEvery: 20, bigLegendaryEvery: 50, checkpointEvery: 10, bagSize: 12,
  pokeFloorMult: 0.15,
  monsterHouse: { min: 0.02, max: 0.12, rampFloors: 30, enemies: [6, 10], items: [2, 4] },
  teamMax: 4, bondFloors: 5, storageSize: 500, leaderChoiceRank: 4, // elegir líder sólo desde Diamante
  jirachiFloor: 100, terrainChance: 0.3,
};

// Estados alterados: duración en turnos y qué hacen (la lógica vive en el cliente/motor)
export const STATUS = {
  // duraciones [mín, máx] y daños reales de Exploradores del Cielo (pmdsky-debug / descompilación)
  poison:    { name: 'Envenenado', turns: [9999, 9999], tick: { dmg: 2, every: 20 }, noRegen: true }, // 9999 = hasta curarse
  burn:      { name: 'Quemado',    turns: [9999, 9999], tick: { dmg: 6, every: 50 } },
  paralysis: { name: 'Paralizado', turns: [2, 2],   skip: 1 },   // no puede actuar durante 2 turnos
  sleep:     { name: 'Dormido',    turns: [3, 6],   skip: 1, wakeOnHit: false }, // el sueño provocado por un movimiento no se rompe con los golpes
  confusion: { name: 'Confuso',    turns: [6, 11],  randomMove: 0.5 },
  freeze:    { name: 'Congelado',  turns: [3, 4],   skip: 1, wakeOnHit: true },
};
export const TACTICS = { seguir: 'Sígueme', atacar: 'Ataca sin cuartel', esperar: 'Espera aquí', evitar: 'Evita peleas' };

// Clima por piso. mult(type): factor al daño de un movimiento de ese tipo. sight: radio de visión. tick: daño por turno salvo a los tipos inmunes.
export const WEATHER = {
  none:  { name: 'Despejado' },
  sun:   { name: 'Sol', color: '#ffd24a', mult: t => t === 'Fuego' ? 1.5 : t === 'Agua' ? 0.5 : 1 },
  rain:  { name: 'Lluvia', color: '#5aa0e0', mult: t => t === 'Agua' ? 1.5 : t === 'Fuego' ? 0.5 : 1 },
  fog:   { name: 'Niebla', color: '#b8c0cc', sight: 1 }, // la niebla reduce la visión en los pasillos
  sand:  { name: 'Tormenta de arena', color: '#c9a25a', tick: 0.03, immune: ['Roca', 'Tierra', 'Acero'] },
  hail:  { name: 'Granizo', color: '#a8d8f0', tick: 0.03, immune: ['Hielo'] },
};
// Clima posible en cada mazmorra (el de la del Tiempo y la de los Sueños lo pone la era en la que estés)
export const WEATHER_BY_DUNGEON = {
  bosque: ['rain', 'fog'],             // lluvia y niebla entre los árboles
  cueva:  ['fog', 'hail'],             // niebla y granizo (corrientes frías)
  sierra: ['sun'],                     // sol abrasador
  gelida: ['hail', 'fog'],             // granizo y niebla helada
  monte:  ['rain', 'fog'],             // tormenta: lluvia y niebla (el monte de Zapdos)
  ruinas: ['sand', 'sun', 'fog'],
};
export const WEATHER_START_FLOOR = 4;  // los primeros pisos siempre despejados
// Clima determinista por piso (mismo en cliente y servidor). Probabilidad: 0 % hasta el piso 3, luego 8 % y +1 % por piso, máx. 25 %.
export function weatherFor(runSeed, floor, dungeonId = 'bosque') {
  const opts = WEATHER_BY_DUNGEON[dungeonId]; if (!opts || floor < WEATHER_START_FLOOR) return 'none';
  let v = (Math.imul(runSeed ^ 0x7f4a, 0x9E3779B1) + Math.imul(floor + 1, 0xC2B2AE35)) >>> 0; v = Math.imul(v ^ (v >>> 13), 0x85EBCA6B) >>> 0; v = (v ^ (v >>> 16)) >>> 0;
  const chance = Math.min(25, 8 + (floor - WEATHER_START_FLOOR));
  if (v % 100 >= chance) return 'none';
  return opts[(v >>> 8) % opts.length];
}

export const TYPE_CHART = {
  Normal:   { Roca: .5, Fantasma: 0, Acero: .5 },
  Fuego:    { Fuego: .5, Agua: .5, Planta: 2, Hielo: 2, Bicho: 2, Roca: .5, Dragón: .5, Acero: 2 },
  Agua:     { Fuego: 2, Agua: .5, Planta: .5, Tierra: 2, Roca: 2, Dragón: .5 },
  Eléctrico:{ Agua: 2, Eléctrico: .5, Planta: .5, Tierra: 0, Volador: 2, Dragón: .5 },
  Planta:   { Fuego: .5, Agua: 2, Planta: .5, Veneno: .5, Tierra: 2, Volador: .5, Bicho: .5, Roca: 2, Dragón: .5, Acero: .5 },
  Hielo:    { Fuego: .5, Agua: .5, Planta: 2, Hielo: .5, Tierra: 2, Volador: 2, Dragón: 2, Acero: .5 },
  Lucha:    { Normal: 2, Hielo: 2, Veneno: .5, Volador: .5, Psíquico: .5, Bicho: .5, Roca: 2, Fantasma: 0, Siniestro: 2, Acero: 2, Hada: .5 },
  Veneno:   { Planta: 2, Veneno: .5, Tierra: .5, Roca: .5, Fantasma: .5, Acero: 0, Hada: 2 },
  Tierra:   { Fuego: 2, Eléctrico: 2, Planta: .5, Veneno: 2, Volador: 0, Bicho: .5, Roca: 2, Acero: 2 },
  Volador:  { Eléctrico: .5, Planta: 2, Lucha: 2, Bicho: 2, Roca: .5, Acero: .5 },
  Psíquico: { Lucha: 2, Veneno: 2, Psíquico: .5, Siniestro: 0, Acero: .5 },
  Bicho:    { Fuego: .5, Planta: 2, Lucha: .5, Veneno: .5, Volador: .5, Psíquico: 2, Fantasma: .5, Siniestro: 2, Acero: .5, Hada: .5 },
  Roca:     { Fuego: 2, Hielo: 2, Lucha: .5, Tierra: .5, Volador: 2, Bicho: 2, Acero: .5 },
  Fantasma: { Normal: 0, Psíquico: 2, Fantasma: 2, Siniestro: .5 },
  Dragón:   { Dragón: 2, Acero: .5, Hada: 0 },
  Siniestro:{ Lucha: .5, Psíquico: 2, Fantasma: 2, Siniestro: .5, Hada: .5 },
  Acero:    { Fuego: .5, Agua: .5, Eléctrico: .5, Hielo: 2, Roca: 2, Acero: .5, Hada: 2 },
  Hada:     { Fuego: .5, Lucha: 2, Veneno: .5, Dragón: 2, Siniestro: 2, Acero: .5 },
};

import { POKEDEX, MOVES_DB } from './pokedex.js';
import { EOS_EXP, EOS_YIELD, EOS_MOVES, EOS_RECRUIT, EOS_LEARN, EOS_EXTRA_MOVES, EOS_TM } from './eos.js';
import { ITEMS_FULL, EXCLUSIVES, TM_ALL } from './items-full.js';
import { applyMoveNames, fixMoveName } from './move-names.js';
// nombres de movimientos de la época de Exploradores del Cielo (antes de construir nada con ellos)
applyMoveNames({ moveTables: [MOVES_DB, EOS_MOVES, EOS_EXTRA_MOVES], learnsetsBySpecies: [POKEDEX], lists: [TM_ALL, ...Object.values(EOS_TM)], learnPairs: [EOS_LEARN] });
export { fixMoveName };

// Movimientos: la base viene de PokeAPI (tools/build-pokedex.mjs); aquí sólo ajustes propios.
export const MOVES = { ...MOVES_DB };
// Datos reales de Exploradores del Cielo: potencia PMD, PP, precisión y alcance de cada movimiento
for (const [name, m] of Object.entries(EOS_MOVES)) if (MOVES[name]) Object.assign(MOVES[name], m);
// movimientos de daño de las listas reales que aún no existían (con sus datos del juego)
for (const [name, m] of Object.entries(EOS_EXTRA_MOVES)) if (!MOVES[name]) MOVES[name] = { ...m, fromRom: true };   // fromRom: el importador no los toma por «ya existentes»
// ¿funciona en nuestro motor? los de daño y los que causan un estado; los que cambian estadísticas aún no están programados
// funciona: daño, causar un estado, curar o cambiar estadísticas (la velocidad aún no está programada)
const statWorks = m => !!m.statFx?.changes.some(([s]) => s !== 'spe');
export const moveWorks = n => !!MOVES[n] && (MOVES[n].cat !== 'status' ? (MOVES[n].pmdPower ?? 1) > 0 || !!MOVES[n].effect : !!MOVES[n].effect || !!MOVES[n].heal || statWorks(MOVES[n]));
// Movimientos "oscuros" de Pokémon Colosseum/XD: no existen en Mundo Misterioso y nadie los aprende
for (const n of ['Carga Oscura', 'Soplo Oscuro', 'Vigor Oscuro', 'Rayo Oscuro', 'Brío Oscuro', 'Hielo Oscuro', 'Fin Oscuro', 'Fuego Oscuro', 'Rabia Oscura', 'Tifón Oscuro', 'Onda Oscura']) delete MOVES[n];
MOVES['Deseo Oculto'] = { ...MOVES['Deseo Oculto'], range: 'room' }; // firma de Jirachi: golpea toda la sala
export const BASIC = { name: 'Ataque', type: 'Normal', typeless: true, cat: 'phys', power: 25, pmdPower: 1, acc1: 125, acc2: 93, crit: 0, range: 'front' }; // ataque normal real: potencia 1, acierta el 93 %, nunca es crítico
export const TM_POOL = TM_ALL.filter(m => MOVES[m]);   // todas las MT del juego cuyo movimiento funciona aquí
export const MD_POOL = ['Lanzallamas', 'Rayo', 'Surf', 'Rayo Hielo', 'Psíquico', 'Hiperrayo', 'Pulso Dragón'].filter(m => MOVES[m]);
export const MD_RARE_POOL = ['Terremoto', 'Ventisca', 'Chispazo', 'Onda Ígnea', 'Rapidez'].filter(m => MOVES[m]); // los de sala: sólo grandes legendarios

// Especies: Kanto + Johto + legendarios (generado). Se añade la marca de minijefe.
export const SPECIES = {};
for (const [id, p] of Object.entries(POKEDEX)) SPECIES[id] = { ...p, boss: !p.legendary && p.total >= 480 };
// Kecleon: tendero de las mazmorras. Si le robas, se convierte en el enemigo más fuerte del juego.
SPECIES.kecleon = { dex: 352, name: 'Kecleon', types: ['Normal'], base: [60, 90, 70, 60, 120], speed: 40, total: 440, gen: 3, stage: 1, pokes: 600, recruit: -49, legendary: false, mythical: false,
  learnset: { 1: 'Placaje', 5: 'Cuchillada', 10: 'Golpe Cuerpo', 15: 'Rayo', 20: 'Lanzallamas' } };
// Guardianes Mega de las megapiedras: stats de la megaevolución oficial ×1.25. Aparecen en el piso de su piedra.
// Charizard X (Bosque), Gyarados (Cueva), Camerupt (Monte), Sableye… aquí Gengar (Ruinas) como guardián psíquico-fantasma.
// Guardianes Mega: usan sus stats mega base (sin multiplicador). El poder extra viene de 'buffs' de combate.
// buffs: { atk|def|spa|spd|spe: stages } — cada stage aplica el escalado de la saga (subida ×1.5 por stage) sobre ese stat.
const megaGuardian = (name, types, megaBase, buffs = {}) => ({ name: 'Mega ' + name, types, base: megaBase.slice(), speed: 100, total: megaBase.reduce((a, b) => a + b, 0), gen: 3, stage: 3, pokes: 2000, recruit: -60, legendary: false, mythical: false, boss: true, mega: true, buffs,
  learnset: { 1: 'Cuchillada', 5: 'Golpe Cuerpo', 10: 'Lanzallamas', 15: 'Terremoto' } });
SPECIES.mega_absol     = { ...megaGuardian('Absol', ['Siniestro'], [65, 150, 60, 115, 115], { atk: 2 }), learnset: { 1: 'Cuchillada', 5: 'Mordisco', 10: 'Avalancha', 15: 'Golpe Cuerpo' } };          // dos Danza Espada
SPECIES.mega_steelix   = { ...megaGuardian('Steelix', ['Acero', 'Tierra'], [75, 125, 230, 55, 95], { def: 1, spd: 1 }), learnset: { 1: 'Placaje', 5: 'Lanzarrocas', 10: 'Terremoto', 15: 'Ala de Acero' } };   // +1 a cada defensa
SPECIES.mega_camerupt  = { ...megaGuardian('Camerupt', ['Fuego', 'Tierra'], [70, 120, 100, 145, 105], { spa: 2 }), learnset: { 1: 'Ascuas', 5: 'Terremoto', 10: 'Lanzallamas', 15: 'Avalancha' } };        // dos Maquinación
SPECIES.mega_manectric = { ...megaGuardian('Manectric', ['Eléctrico'], [70, 75, 80, 135, 135], { spe: 2 }), learnset: { 1: 'Impactrueno', 5: 'Rayo', 10: 'Descarga', 15: 'Mordisco' } };                  // dos Agilidad
export const MINIBOSS_POOL = Object.keys(SPECIES).filter(id => SPECIES[id].boss && !SPECIES[id].mega);
export const SHOP_IN_DUNGEON = { chance: 0.12, minFloor: 2, items: [3, 6], level: 80, statMult: 1.0, guards: 2 };   // robar: casi imposible (nivel 80), pero no imposible // tienda de Kecleon en la mazmorra
export const KECLEON_DISCOUNT = 0.8; // siendo Kecleon, los Kecleon te hacen un 20 % en todas sus tiendas
export const shopPrice = (name, leader) => Math.round((ITEMS[name]?.buy || (ITEMS[name]?.sell || 100) * 2) * (leader === 'kecleon' ? KECLEON_DISCOUNT : 1));
// Pool de iniciales posibles (BST 280-350, forma base, con evolución). El test asigna uno según la naturaleza.
// Chatot (4.ª generación, fuera de nuestra Pokédex): solo como jefe del Campo de Entrenamiento
SPECIES.chatot ||= { dex: 441, name: 'Chatot', types: ['Normal', 'Volador'], base: [76, 65, 45, 92, 42], speed: 91, total: 411, gen: 4, stage: 1, pokes: 20, recruit: -100, legendary: false, mythical: false, boss: true, learnset: { 1: ['Picotazo', 'Placaje'] } };
// Movimientos por nivel reales de Exploradores del Cielo (solo los que funcionan en el juego); varios por nivel → array
for (const [sp, list] of Object.entries(EOS_LEARN)) {
  if (!SPECIES[sp]) continue;
  const ls = {};
  for (const [lv, m] of list) if (moveWorks(m)) (ls[lv] ||= []).push(m);
  if (Object.keys(ls).length) SPECIES[sp].learnset = ls;
}
// ¿Puede aprender esa máquina (MT/MD)? Compatibilidad real de Exploradores del Cielo; también si lo aprende por nivel.
// Las especies sin datos del juego (formas Mega, legendarios posteriores) pueden aprender cualquiera.
export const canLearnMachine = (sp, move) => !EOS_TM[sp] || EOS_TM[sp].includes(move) || Object.values(SPECIES[sp]?.learnset || {}).flat().includes(move);
// lista plana [[nivel, movimiento], …] admitiendo uno o varios movimientos por nivel
export const learnEntries = sp => Object.entries(SPECIES[sp]?.learnset || {}).flatMap(([lv, m]) => (Array.isArray(m) ? m : [m]).map(x => [+lv, x])).sort((a, b) => a[0] - b[0]);
export const STARTERS = ['bulbasaur', 'charmander', 'squirtle', 'pikachu', 'chikorita', 'cyndaquil', 'totodile', 'meowth', 'vulpix', 'psyduck', 'eevee', 'phanpy',
  // ampliación equilibrada: rinden como los iniciales originales a nivel 5 con sus movimientos reales de Exploradores
  'machop', 'oddish', 'geodude', 'mareep', 'magby', 'seel', 'tentacool', 'sunkern', 'elekid', 'smoochum', 'chinchou',
  'ekans', 'spinarak', 'voltorb', 'nidoran_f', 'swinub', 'slugma', 'drowzee', 'ledyba', 'pineco'];
// Pool de salvajes por mazmorra: por tipo y potencia, sólo especies de Kanto/Johto no legendarias
const wildPool = (types, maxTotal, minTotal = 0) => Object.keys(SPECIES).filter(id => { const p = SPECIES[id]; return !p.legendary && !p.boss && p.gen <= 2 && p.total <= maxTotal && p.total >= minTotal && !STARTERS.includes(id) && p.types.some(t => types.includes(t)); });

export const ITEMS = {
  'Baya Aranja':  { kind: 'heal', value: 100, buy: 50,  sell: 15 },
  'Manzana':      { kind: 'belly', value: 50, buy: 60,  sell: 20 },
  'Semilla Revivir': { kind: 'revive', buy: 600, sell: 150 },
  'Baya Zidra':   { kind: 'cure', buy: 80, sell: 25 },
  'Semilla Dormir': { kind: 'throw_sleep', buy: 120, sell: 30 }, // se come: duerme al que tienes delante
  'Orbe Cura':    { kind: 'orb', orb: 'heal', buy: 400, sell: 100 },
  'Orbe Sueño':   { kind: 'orb', orb: 'sleep', buy: 350, sell: 90 },
  'Orbe Reinicio': { kind: 'orb', orb: 'restart', buy: 500, sell: 120 },
  'Objeto perdido': { kind: 'quest', sell: 0 },
  // Equipables (el líder lleva uno)
  'Lazo Amigo':   { kind: 'held', buy: 1500, sell: 400, recruit: 5 },
  'Pañuelo Poder': { kind: 'held', buy: 1200, sell: 300, atkAdd: 12 },
  'Bufanda Defensa': { kind: 'held', buy: 1200, sell: 300, defAdd: 8 },
  'Pañuelo Especial': { kind: 'held', buy: 1200, sell: 300, spaAdd: 12 },
  'Bufanda Zen':  { kind: 'held', buy: 1000, sell: 250, statusResist: 0.5 },
  'Perla':        { kind: 'sell', sell: 200,  minFloor: 1 },
  'Perla Grande': { kind: 'sell', sell: 800,  minFloor: 10 },
  'Pepita':       { kind: 'sell', sell: 2000, minFloor: 20 },
  'Diamante':     { kind: 'sell', sell: 6000, minFloor: 999 },
};
// Catálogo completo de Exploradores del Cielo (tools/import-items.py): se une a los objetos existentes sin cambiar estos
for (const [name, it] of Object.entries(ITEMS_FULL)) ITEMS[name] = { ...it, ...(ITEMS[name] || {}), desc: it.desc, weight: it.weight, minFloor: ITEMS[name]?.kind === 'sell' ? ITEMS[name].minFloor : it.minFloor, id: it.id };
for (const [name, it] of Object.entries(EXCLUSIVES)) ITEMS[name] = { ...it, weight: 0.03 };   // exclusivos: rarísimos en el suelo (en el original salen de los cofres)
// Botín del suelo: objeto al azar según su rareza (peso) y el piso mínimo en que puede aparecer; a veces una MT
export function rollLoot(rng, floor, { noSell = false } = {}) {
  if (floor >= 4 && rng.random() < 0.03) return `MT: ${rng.pick(TM_POOL)}`;
  const pool = Object.entries(ITEMS).filter(([n, it]) => it.weight && (it.minFloor || 1) <= floor && it.kind !== 'quest' && !(noSell && it.kind === 'sell'));
  let total = pool.reduce((s, [, it]) => s + it.weight, 0), r = rng.random() * total;
  for (const [n, it] of pool) { r -= it.weight; if (r < 0) return n; }
  return 'Manzana';
}
// Catálogo de Kecleon: fijo (consumibles básicos) + rotación por run (el servidor elige)
export const SHOP_FIXED = ['Baya Aranja', 'Manzana', 'Baya Zidra'];
export const SHOP_ROTATING = ['Semilla Revivir', 'Semilla Dormir', 'Orbe Cura', 'Orbe Sueño', 'Orbe Reinicio', 'Orbe Escape', 'Orbe Luminoso', 'Elixir Máximo', 'Semilla Cura', 'Semilla Explosiva', 'Manzana Grande', 'Púa Hierro', 'Guijarro Geo', 'Baya Meloc', 'Baya Zreza', 'Baya Atania', 'Baya Safre', 'Semilla Teletransporte', 'Orbe Red', 'Orbe Radar', 'Orbe Escáner', 'Gominola Blanca', 'Gominola Roja', 'Gominola Azul', 'Gominola Hierba'];
export const SHOP_HELD = ['Lazo Amigo', 'Pañuelo Poder', 'Bufanda Defensa', 'Pañuelo Especial', 'Bufanda Zen', 'Periscopio', 'Banda Aguante', 'Pañuelo Meloc', 'Banda Caquic', 'Insomnioscopio', 'Lazo Cura', 'Banda Giro', 'Gafas Blanco', 'Banda Detector', 'Gafas Protectoras', 'Cinto Glotón'];
export const MISSION_TYPES = {
  derrotar: { label: 'Derrota a', needsTarget: true },
  explorar: { label: 'Explora hasta', needsTarget: false },
  encontrar: { label: 'Encuentra un objeto perdido en', needsTarget: false },
  rescatar: { label: 'Rescata a', needsTarget: true, floorMultipleOf: 10 },
  entregar: { label: 'Entrega', needsTarget: true },          // lleva un objeto al cliente, que espera en ese piso
  forajido: { label: 'Captura al forajido', needsTarget: true }, // un enemigo más fuerte de lo normal
};
// objetos que piden en las misiones de entrega
export const DELIVERY_ITEMS = ['Manzana', 'Baya Aranja', 'Baya Zidra', 'Semilla Dormir', 'Perla'];

export const RANKS = [
  { name: 'Novato', pts: 0 }, { name: 'Bronce', pts: 100 }, { name: 'Plata', pts: 300 },
  { name: 'Oro', pts: 700 }, { name: 'Diamante', pts: 1500 }, { name: 'Maestro', pts: 3000 },
];
export const DUNGEONS = [
  // Campo de Entrenamiento: 5 pisos con los Pokémon más débiles; el jefe es Chatot (nivel 5, solo Placaje), que entrega la MD Fachada
  { id: 'entrenamiento', name: 'Campo de Entrenamiento', floors: 5, rank: 0, lvl: 1, pool: ['pidgey', 'bellsprout', 'poliwag', 'pichu', 'cleffa', 'shellder', 'exeggcute', 'staryu'],
    finalBoss: 'chatot', finalBossLevel: 5, finalBossMoves: ['Placaje'], finalBossNoRecruit: true, md: 'Fachada', terrain: [] },
  { id: 'bosque', name: 'Bosque Frondoso', floors: 10, rank: 0, lvl: 1, pool: wildPool(['Planta', 'Bicho', 'Normal', 'Volador'], 330), finalBoss: 'celebi', md: 'Psíquico', terrain: ['water'] },
  { id: 'cueva',  name: 'Cueva Húmeda', requires: 'bosque', floors: 20, rank: 1, lvl: 4, pool: wildPool(['Roca', 'Tierra', 'Veneno', 'Agua'], 400), finalBoss: 'suicune', md: 'Surf', terrain: ['water'] },
  // Huerto de Spinda: el huerto de donde Spinda saca la fruta para sus zumos; un Snorlax enorme se lo está comiendo todo. Tras la Cueva Húmeda.
  { id: 'huerto', name: 'Huerto de Spinda', requires: 'cueva', floors: 8, rank: 1, lvl: 6, pool: wildPool(['Planta', 'Hada', 'Normal', 'Bicho'], 420), finalBoss: 'snorlax', finalBossNoRecruit: true, md: 'Descanso', terrain: ['water'] },
  // Las montañas de los tres pájaros legendarios (cada uno guarda una Pluma Sagrada; Scyther se las está llevando).
  // Sierra Ígnea (Moltres): en los últimos 5 pisos la Barriga baja al doble. Montaña Gélida (Articuno): el frío te deja a la mitad de velocidad.
  { id: 'sierra', name: 'Sierra Ígnea', requires: 'huerto', floors: 20, rank: 1, lvl: 7, pool: wildPool(['Fuego', 'Roca', 'Tierra', 'Lucha'], 440), finalBoss: 'moltres', md: 'Lanzallamas', terrain: ['lava'], hungerLastFloors: 5 },
  { id: 'gelida', name: 'Montaña Gélida', requires: 'sierra', floors: 20, rank: 2, lvl: 8, pool: wildPool(['Hielo', 'Agua', 'Volador', 'Normal'], 450), finalBoss: 'articuno', md: 'Rayo Hielo', terrain: ['water'], coldSlow: true },
  // Monte Eléctrico (Zapdos): rayos ocultos en el suelo (como trampas). Más adelante habrá otras mazmorras entre la Montaña Gélida y él.
  { id: 'monte',  name: 'Monte Eléctrico', requires: 'gelida', thunderTraps: true, floors: 30, rank: 2, lvl: 9, pool: wildPool(['Fuego', 'Lucha', 'Acero', 'Roca', 'Eléctrico'], 460, 280), finalBoss: 'zapdos', md: 'Rayo', terrain: ['water'] },
  { id: 'ruinas', name: 'Ruinas Olvidadas', floors: 40, rank: 3, lvl: 14, pool: wildPool(['Fantasma', 'Psíquico', 'Siniestro', 'Hielo', 'Hada'], 500, 300), finalBoss: 'mew', md: 'Terremoto', terrain: ['water', 'lava'] },
  { id: 'tiempo', name: 'Mazmorra del Tiempo', floors: Infinity, rank: 4, lvl: 18, pool: wildPool(['Normal', 'Fuego', 'Agua', 'Planta', 'Eléctrico', 'Psíquico', 'Lucha', 'Tierra', 'Roca', 'Bicho', 'Veneno', 'Volador', 'Fantasma', 'Hielo', 'Dragón', 'Siniestro', 'Acero', 'Hada'], 520, 340), legendaries: ['dialga', 'palkia', 'mew', 'mewtwo', 'zapdos', 'articuno', 'moltres', 'suicune', 'entei', 'raikou', 'celebi', 'lugia', 'ho_oh'], terrain: ['water', 'lava'], eras: ['bosque', 'cueva', 'monte', 'ruinas'], eraEvery: 5 },
];
// Megapiedras: el maestro Pidgeot encarga buscar una por mazmorra finita, en un piso fijo.
// Con las cuatro se revela la Mazmorra de los Sueños (donde se usan los legendarios reclutados).
export const MEGA_STONES = [
  { id: 'stone-bosque', name: 'Absolita', dungeonId: 'bosque', floor: 7,  guardian: 'mega_absol' },
  { id: 'stone-cueva',  name: 'Steelixita', dungeonId: 'cueva',  floor: 13, guardian: 'mega_steelix' },
  { id: 'stone-monte',  name: 'Cameruptita', dungeonId: 'monte',  floor: 22, guardian: 'mega_camerupt' },
  { id: 'stone-ruinas', name: 'Manectricita', dungeonId: 'ruinas', floor: 31, guardian: 'mega_manectric' },
];
// Carácter y voz de cada guardián Mega. intro: al toparte con él. defeat: al caer. attackAfter: turnos hasta que ataca solo.
export const MEGA_DIALOG = {
  mega_absol: {
    font: "'Georgia', 'Times New Roman', serif", color: '#cfd6e6',
    intro: ['No he venido a luchar. Percibo una desgracia en tu futuro… y aun así avanzas.'],
    flee: ['No quiero hacerte dano. Aléjate, por favor.'],   // mientras huye/se protege
    yield: ['Que así sea…'],                                  // justo antes de rendirse y atacar
    defeat: ['Has vencido. Toma la piedra… y ojala te proteja de lo que se avecina.'],
    behavior: 'flee',
  },
  mega_steelix: {
    font: "'Impact', 'Arial Black', sans-serif", color: '#b8c4d0',
    intro: ['Alto.', 'Este suelo es mio.', 'Demuestralo. O vete.'],
    defeat: ['Eres fuerte. La piedra es tuya. Punto.'],
    attackAfter: 1,
  },
  mega_camerupt: {
    font: "'Comic Sans MS', 'Chalkboard', cursive", color: '#ff9a4a',
    intro: ['¡¡¡RAAAAAAAAAAAAH!!! ¡¿QUIEN OSA ENTRAR AQUI?!', '¡¡VAIS A SUFRIR LAS CONSECUENCIAS DE VENIR!!'],
    defeat: ['…', '…', '… *ronquidos*'],
    behavior: 'mad',
  },
  mega_manectric: {
    font: "'Courier New', monospace", color: '#f2d24a',
    intro: ['…¿Quien anda ahi? No, no te acerques. No confio en ti.', 'Pero que quede claro: soy más rápido que tú. Mucho más. No tienes nada que hacer.'],
    defeat: ['Imposible… ¿más rápido que yo? Bah. Coge la piedra y desaparece.'],
    attackAfter: 2,
  },
};
export const megaStoneFor = (dungeonId, floor) => MEGA_STONES.find(s => s.dungeonId === dungeonId && s.floor === floor);
export const DREAM_DUNGEON = { id: 'suenos', name: 'Mazmorra de los Sueños', floors: Infinity, rank: 5, lvl: 30,
  pool: ['pidgey', 'rattata', 'zubat', 'geodude', 'machop', 'oddish', 'pikachu'],
  legendaries: ['dialga', 'mew', 'zapdos', 'suicune', 'entei', 'raikou', 'celebi', 'jirachi'],
  eras: ['bosque', 'cueva', 'monte', 'ruinas'], eraEvery: 5, terrain: ['water', 'lava'], legendaryOnly: true };

export const dungeonById = id => id === 'suenos' ? DREAM_DUNGEON : DUNGEONS.find(d => d.id === id);
// Recompensas al alcanzar cada rango (van al almacén de Kangaskhan; si no caben, en Pokés)
export const RANK_REWARDS = {
  1: { pokes: 500, items: ['Baya Aranja', 'Baya Aranja', 'Semilla Revivir'] },
  2: { pokes: 1000, items: ['Baya Zidra', 'Semilla Revivir', 'Orbe Escape'] },
  3: { pokes: 2000, items: ['Semilla Revivir', 'Semilla Revivir', 'Elixir Máximo', 'Manzana Grande'] },
  4: { pokes: 4000, items: ['Semilla Revivir', 'Semilla Revivir', 'Manzana Dorada', 'Orbe Luminoso'] },
  5: { pokes: 8000, items: ['Semilla Revivir', 'Semilla Revivir', 'Semilla Revivir', 'Manzana Dorada', 'Manzana Dorada', 'Elixir Máximo'] },
};
export const rankOf = pts => { let r = 0; RANKS.forEach((rk, i) => { if (pts >= rk.pts) r = i; }); return r; };
// La bolsa crece con el rango, como en el original: 12 huecos de Novato y 4 más por cada rango
export const bagSizeFor = rankPts => CFG.bagSize + 4 * rankOf(rankPts || 0);
// Experiencia como en Exploradores del Cielo: cada especie tiene su tabla (acumulada, niveles 1-100).
// Las especies que no están en el juego original usan la de Bulbasaur, que es la referencia de la mayoría.
const expTableOf = sp => EOS_EXP[sp] || EOS_EXP[String(sp).replace('mega_', '')] || EOS_EXP.bulbasaur;
// Experiencia para subir de nivel: la de Exploradores del Cielo ×3 (no hay tope de niveles por exploración)
export const EXP_MULT = 3;
export const expToNext = (sp, lv) => lv >= 100 ? Infinity : EXP_MULT * (expTableOf(sp)[lv] - expTableOf(sp)[lv - 1]);
export const expForLevel = lv => expToNext('bulbasaur', lv);
// Experiencia al derrotar: ⌊⌊Base × (Nv − 1) / 10⌋ + Base⌋ × bonus (×0,5 si solo se usaron ataques normales; ×1 si se usó algún movimiento)
export const expYieldOf = sp => EOS_YIELD[sp] ?? EOS_YIELD[String(sp).replace('mega_', '')] ?? Math.round((SPECIES[sp]?.total || 300) / 10);
export const expGained = (sp, lv, usedMove) => Math.floor((Math.floor(expYieldOf(sp) * (lv - 1) / 10) + expYieldOf(sp)) * (usedMove ? 1 : 0.5));
export const pokesFor = (species, floor) => Math.round(SPECIES[species].pokes * (1 + floor * CFG.pokeFloorMult));
export const effectiveness = (atkType, defTypes) => defTypes.reduce((m, t) => m * (TYPE_CHART[atkType]?.[t] ?? 1), 1);

export function floorKind(def, floor, flags = {}) {
  if (floor === def.floors) return 'legendary';
  if (def.floors === Infinity && floor === CFG.jirachiFloor && !flags.jirachiUnlocked) return 'jirachi';
  if (def.floors === Infinity && floor % CFG.bigLegendaryEvery === 0) return 'bigLegendary';
  if (def.floors === Infinity && floor % CFG.legendaryEvery === 0) return 'legendary';
  if (flags.rescue && def.id === 'cueva' && floor === CFG.minibossEvery) return 'rescue';   // la primera bajada a la Cueva: el piso de los rehenes (Quagsire y los Wooper)
  if (floor % CFG.minibossEvery === 0) return 'miniboss';
  return 'normal';
}

// Reclutamiento: tasa base + 2 % por nivel del líder por encima del salvaje + objeto equipado. Se recluta si rng < chance/100.
export const RECRUIT_MIN_RANK = 2; // hasta rango Plata no se puede reclutar
// reclutar se desbloquea al superar la Cueva Húmeda (con Machamp, Heracross y Ampharos de invitados: el «tutorial» de llevar equipo)
export const canRecruit = m => (m?.scenes || []).includes('scyther-cueva') || (m?.cleared || []).includes('cueva');   // con la escena de Scyther, al superar la Cueva entera (o la Cueva ya superada: los jugadores de antes no la pierden)
export function recruitChance(leader, target, alreadyOnTeam = false) {
  // tasa real de la especie (Exploradores del Cielo); las que no están en ese juego usan la aproximación anterior
  let rate = EOS_RECRUIT[target.species] ?? EOS_RECRUIT[String(target.species).replace('mega_', '')];
  if (rate === undefined || rate === null) { const raw = SPECIES[target.species].recruit ?? 0; rate = raw > 0 ? raw * 0.6 : raw; }
  if (rate > 0 && alreadyOnTeam) rate /= 2;                                // si ya está en tu equipo, la mitad
  const lvlBonus = leader.level >= 50 ? 12.5 : leader.level >= 40 ? 7.5 : leader.level >= 30 ? 5 : 0; // tabla del juego por nivel del líder
  const held = leader.held && ITEMS[leader.held]?.recruit || 0;
  return rate + lvlBonus + held;
}
export const isFlying = mon => SPECIES[mon.species].types.includes('Volador');
export function canCrossTerrain(mon, tile) {
  const types = SPECIES[mon.species].types;
  if (tile === 3) return types.includes('Agua') || types.includes('Volador');  // agua
  if (tile === 4) return types.includes('Fuego') || types.includes('Volador'); // lava
  return true;
}

// Mazmorra del Tiempo: cada `eraEvery` pisos "viaja" a una de las mazmorras antiguas (bioma, terreno y salvajes).
// Determinista por semilla de run y bloque de pisos, así el cliente y el servidor coinciden.
export function eraFor(def, floor, runSeed) {
  if (!def.eras) return def;
  const block = Math.floor((floor - 1) / def.eraEvery);
  let v = (Math.imul(runSeed ^ 0x51ed27, 0x9E3779B1) + Math.imul(block + 1, 0x85EBCA77)) >>> 0; v = Math.imul(v ^ (v >>> 15), 0x2C1B3C6D) >>> 0; v = (v ^ (v >>> 12)) >>> 0;
  return dungeonById(def.eras[v % def.eras.length]);
}

// Nombres antiguos de objetos → nombre actual (partidas guardadas con el nombre de antes)
export const ITEM_ALIASES = { 'Semilla Reviver': 'Semilla Revivir', 'Semilla Reviser': 'Semilla Rever' };
export const fixItemName = n => ITEM_ALIASES[n] || n;

// Orbe Pavor: asusta a los enemigos de la sala (huyen), como en el original
if (ITEMS['Orbe Pavor']) Object.assign(ITEMS['Orbe Pavor'], { fx: 'terrify', desc: 'Asusta a los enemigos de la sala: huyen de ti durante un rato.' });

// Velocidad (como en el original): la Semilla Rápida y los orbes Rápido y Lento cambian la velocidad, no la evasión
if (ITEMS['Semilla Rápida']) ITEMS['Semilla Rápida'].desc = 'Te mueves más rápido durante un rato.';
if (ITEMS['Orbe Rápido']) Object.assign(ITEMS['Orbe Rápido'], { stat: 'spe', n: 1, desc: 'Tu equipo se mueve más rápido durante un rato.' });
if (ITEMS['Orbe Lento']) Object.assign(ITEMS['Orbe Lento'], { stat: 'spe', n: -1, desc: 'Los enemigos de la sala se vuelven más lentos durante un rato.' });
