// =====================================================================
// MOTOR — generación de pisos y matemáticas de combate. Puro: sin DOM, todo el azar viene del rng.
// =====================================================================
import { EOS_GROWTH, EOS_GROWTH_OF, EOS_ASLEEP } from './eos.js';
import { learnEntries } from './data.js';
import { rollLoot, CFG, SPECIES, MOVES, ITEMS, STATUS, MINIBOSS_POOL, MD_POOL, MD_RARE_POOL, SHOP_IN_DUNGEON, SHOP_FIXED, SHOP_ROTATING, SHOP_HELD, WEATHER, weatherFor, shopPrice, megaStoneFor, effectiveness, floorKind, canCrossTerrain, eraFor } from './data.js';

export const T = { WALL: 0, FLOOR: 1, STAIRS: 2, WATER: 3, LAVA: 4 };
export const isSolid = t => t === T.WALL;
export const isGround = t => t === T.FLOOR || t === T.STAIRS;

// Estadísticas REALES de Exploradores del Cielo: base a nivel 1 + incrementos de cada nivel (datos de la ROM).
// Las especies que no están en ese juego (guardianes Mega, legendarios posteriores) usan la aproximación calibrada.
const growthCache = {};
function eosStats(sp, L) {
  const gi = EOS_GROWTH_OF[sp]; if (gi === undefined) return null;
  const key = sp + ':' + L; if (growthCache[key]) return growthCache[key];
  const [base, inc] = EOS_GROWTH[gi], s = [...base];
  for (let lv = 2; lv <= Math.min(100, L); lv++) for (let k = 0; k < 5; k++) s[k] += parseInt(inc[(lv - 2) * 5 + k], 36);
  return (growthCache[key] = s);
}
export function computeStats(mon) {
  const L = mon.level, k = mon.statMult || 1, real = eosStats(mon.species, L);
  if (real) {
    const [hp, atk, def, spa, spd] = real;
    mon.maxHp = Math.min(999, Math.max(1, Math.round(hp * k)));
    mon.atk = Math.max(1, Math.round(atk * k)); mon.def = Math.max(1, Math.round(def * k));
    mon.spa = Math.max(1, Math.round(spa * k)); mon.spd = Math.max(1, Math.round(spd * k));
    if (mon.bonus?.hp) mon.maxHp += mon.bonus.hp;   // Semilla Vida (permanente)
    return mon;
  }
  const [hp, atk, def, spa, spd] = SPECIES[mon.species].base;
  const hpCurve = L <= 30 ? 22 + 2.65 * (L - 1) : 99 + (L <= 50 ? 1.55 : 1.0) * (L - 30) + (L > 50 ? 11 : 0);
  const stCurve = L <= 20 ? 3 + 1.85 * (L - 1) : 38 + 0.9 * (L - 20);
  const hpF = 0.7 + 0.3 * Math.min(2.4, hp / 50), stF = b => 0.7 + 0.3 * Math.min(2.4, b / 50);
  mon.maxHp = Math.max(1, Math.round(hpCurve * hpF * k));
  mon.atk = Math.max(1, Math.round(stCurve * stF(atk) * k)); mon.def = Math.max(1, Math.round(stCurve * stF(def) * k));
  mon.spa = Math.max(1, Math.round(stCurve * stF(spa) * k)); mon.spd = Math.max(1, Math.round(stCurve * stF(spd) * k));
  return mon;
  if (mon.bonus?.hp) mon.maxHp += mon.bonus.hp;   // Semilla Vida (permanente)
}

export function createMon(species, level, extra = {}) {
  const sp = SPECIES[species];
  const mon = { species, name: sp.name, level, exp: 0, moves: [], facing: [0, 1], status: null, ...extra };
  const all = learnEntries(species);
  let learned = all.filter(([lv]) => +lv <= level).map(([, m]) => m);
  if (!learned.length) learned = all.filter(([lv]) => +lv > level).map(([, m]) => m).slice(0, 1); // como en el juego: puede empezar con un solo movimiento; solo si no tendría ninguno se toma el primero que aprendería
  learned = [...new Set(learned)]; if (!learned.length) learned.push('Placaje');
  mon.moves = learned.slice(-4).map(m => ({ name: m, pp: MOVES[m].pp, permanent: false }));
  computeStats(mon); mon.hp = mon.maxHp;
  return mon;
}
// Bonos planos de los objetos equipados (Pañuelo Poder/Cinta Especial +12, Bufanda Defensa/Cinta Zinc +8)
// Habilidades: se definen en abilities.js; aquí solo los ganchos que usa el motor
import { abilityBlocksStatus, abilityBlocksDrop, abilityDamageMods, abilityAccMods, sniperCrit, scrappy, has as hasAbility } from './abilities.js';
// suma a una estadística: objeto equipado + exclusivos de la bolsa (exBoost) + vitaminas permanentes (bonus)
const heldAdd = (mon, stat) => ((mon.held && ITEMS[mon.held]?.[stat + 'Add']) || 0) + (mon.exBoost?.[stat] || 0) + (mon.bonus?.[stat] || 0);
// Tablas reales de estadios 0-20 (10 = normal), del código del juego (pmdsky-debug), en punto fijo /256
// reglas fijas del juego para algunas formas: Giratina Modificada −2 ataque/+2 defensa; Deoxys Ataque +2/−2; Defensa −2/+2; Velocidad −2/−2
const FORM_STAGES = { giratina: { off: -2, def: 2 }, deoxys_attack: { off: 2, def: -2 }, deoxys_defense: { off: -2, def: 2 }, deoxys_speed: { off: -2, def: -2 } };
const stageOf = (mon, stat) => (SPECIES[mon.species]?.buffs?.[stat] || 0) + (mon.stages?.[stat] || 0) + (FORM_STAGES[mon.species]?.[stat === 'atk' || stat === 'spa' ? 'off' : 'def'] || 0);
const stageIdx = s => Math.max(0, Math.min(20, 10 + s));
export const pmdPower = corePower => Math.max(1, Math.round(corePower / 5));
// Eficacia por cada tipo del defensor: muy eficaz ×1,4 · poco eficaz ×1/√2 · inmune ×0,5 (en Mundo Misterioso nada es inmune del todo)
function pmdEffect(moveType, types) {
  let m = 1, core = 1;
  for (const t of types) { const e = effectiveness(moveType, [t]); core *= e; m *= e === 0 ? 0.5 : e > 1 ? 1.4 : e < 1 ? Math.SQRT1_2 : 1; }
  return { m, core };
}
// Acierto como en el juego: dos tiradas (precisión 1 y 2 del movimiento), cada una × precisión del atacante × evasión del
// defensor según sus estadios (tablas reales; el estadio neutro de evasión vale 263/256). >100 = acierto seguro.
const ACC_STAGE = [84, 89, 94, 102, 110, 115, 140, 153, 179, 204, 256, 320, 384, 409, 422, 435, 448, 460, 473, 486, 512];
const EVA_STAGE = [512, 486, 473, 460, 448, 435, 422, 409, 384, 345, 263, 204, 179, 153, 128, 102, 89, 76, 64, 51, 38];
export function hitCheck(rng, move, attacker, defender, weather = 'none') {
  const ab = attacker && defender ? abilityAccMods(attacker, defender, weather, move) : { always: false, accMult: 1, accStages: 0, evaStages: 0 };
  if (ab.always) return true;   // Indefenso, Ataque Certero
  const a = stageIdx((attacker?.stages?.acc || 0) + (ITEMS[attacker?.held]?.accStage || 0) + ab.accStages), ev = stageIdx((defender?.stages?.eva || 0) + (ITEMS[defender?.held]?.evaStage || 0) + ab.evaStages);   // + gafas, bandas, habilidades, IQ
  const roll = acc => acc > 100 || rng.random() * 100 < Math.floor(Math.floor(acc * ab.accMult * ACC_STAGE[a] * EVA_STAGE[ev] / 256) / 256);
  return roll(move.acc1 ?? 100) && roll(move.acc2 ?? move.acc ?? 100);
}
// Cambios de estadísticas (estadios −10…+10 sobre el neutro), con los mensajes del juego. La velocidad aún no se aplica.
const STAT_NAMES = { atk: 'el Ataque', def: 'la Defensa', spa: 'el At. Esp.', spd: 'la Def. Esp.', acc: 'la Precisión', eva: 'la Evasión' };
// Ganchos para el juego: cambios de estadística y estados aplicados (flechas, iconos, sonidos)
export const hooks = { onStage: null, onStatus: null };
export function applyStages(mon, changes) {
  const msgs = [];
  for (const [stat, n] of changes) {
    if (!STAT_NAMES[stat]) continue;
    if (n < 0 && (ITEMS[mon.held]?.noStatDrop || abilityBlocksDrop(mon, stat))) { msgs.push(`¡${mon.name} no deja que le bajen ${STAT_NAMES[stat]}!`); continue; }   // Banda Giro / habilidad
    mon.stages ||= {};
    const cur = mon.stages[stat] || 0, nv = Math.max(-10, Math.min(10, cur + n));
    if (nv === cur) { msgs.push(`${STAT_NAMES[stat][0].toUpperCase() + STAT_NAMES[stat].slice(1)} de ${mon.name} no puede ${n > 0 ? 'subir' : 'bajar'} más.`); continue; }
    mon.stages[stat] = nv;
    const d = nv - cur;
    msgs.push(`¡${STAT_NAMES[stat][0].toUpperCase() + STAT_NAMES[stat].slice(1)} de ${mon.name} ${d > 0 ? 'sube' : 'baja'}${Math.abs(d) >= 2 ? ' mucho' : ''}!`);
    hooks.onStage?.(mon, stat, d);
  }
  return msgs;
}
// Daño: fórmula del código de Exploradores del Cielo, con su aritmética de punto fijo (16 bits fraccionarios,
// constantes de 8 bits y logaritmo por tabla), para dar exactamente el mismo número que la consola.
const FX = 65536;
const fmul = (a, b) => Math.sign(a) * Math.sign(b) * Math.floor(Math.abs(a) * Math.abs(b) / FX);
const fdiv = (a, b) => Math.sign(a) * Math.sign(b) * Math.floor(Math.abs(a) * FX / Math.abs(b));
const fround = a => Math.floor((a + FX / 2) / FX);
const fxLn = x => Math.floor(Math.log(Math.max(1, Math.min(2047, x))) * 4096) * 16; // tabla LOG_VALUE_TABLE del juego
const FX_SUPER = (256 + 0x66) * 256, FX_NOTVERY = 0xB5 * 256, FX_IMMUNE = 0x80 * 256, FX_1_5 = 3 * FX / 2, FX_0_5 = FX / 2, FX_BURN = 0xCC * 256, FX_ENEMY = (256 + 0x54) * 256;
const OFF_RAW = [128, 133, 138, 143, 148, 153, 161, 171, 179, 204, 256, 307, 332, 358, 384, 409, 422, 435, 448, 460, 473];
const DEF_RAW = [7, 12, 25, 38, 51, 64, 76, 102, 128, 179, 256, 332, 409, 486, 537, 588, 640, 691, 742, 793, 844];
export function damage(rng, attacker, defender, move, weather = 'none') {
  if (move.cat === 'status' || !move.power) return { dmg: 0, eff: 1, crit: false };
  const phys = move.cat === 'phys';
  // un aliado con la barriga vacía solo hace 1 de daño
  if (!attacker.isEnemy && !attacker.isLeader && attacker.belly === 0) return { dmg: 1, eff: 1, crit: false };
  const aStage = stageIdx(stageOf(attacker, phys ? 'atk' : 'spa')), dStage = stageIdx(stageOf(defender, phys ? 'def' : 'spd'));
  const A = Math.min(999, Math.floor((phys ? attacker.atk : attacker.spa) * OFF_RAW[aStage] / 256) + heldAdd(attacker, phys ? 'atk' : 'spa'));
  const D = Math.floor((phys ? defender.def : defender.spd) * DEF_RAW[dStage] / 256) + heldAdd(defender, phys ? 'def' : 'spd');
  const P = move.pmdPower ?? pmdPower(move.power);
  const power = P * OFF_RAW[aStage] * 256;                          // potencia × estadio (punto fijo)
  const flv = attacker.level * FX + fdiv((A - D) * FX, 8 * FX);
  const lnArg = fround((flv + 50 * FX) * 10);
  let base = fmul(D * FX, -FX_0_5) + fmul(power + A * FX, 153 * 256) + fxLn(lnArg) * 50 - 311 * FX;
  if (attacker.isEnemy) base = fdiv(base, FX_ENEMY);                 // los enemigos pegan menos (÷ 85/64)
  base = Math.max(FX, Math.min(999 * FX, base));
  // multiplicadores: tipo por cada tipo del defensor, STAB, clima, quemadura, crítico
  const typeless = move.typeless;                                    // el ataque normal no tiene tipo
  let mult = FX, effCore = 1;
  if (!typeless) for (const t of SPECIES[defender.species].types) {
    let ef = effectiveness(move.type, [t]);
    if (ef === 0 && t === 'Fantasma' && (move.type === 'Normal' || move.type === 'Lucha') && scrappy(attacker)) ef = 1;   // Intrépido
    effCore *= ef;
    if (ef === 0) mult = fmul(mult, FX_IMMUNE); else if (ef > 1) mult = fmul(mult, FX_SUPER); else if (ef < 1) mult = fmul(mult, FX_NOTVERY);
  }
  const stab = !typeless && SPECIES[attacker.species].types.includes(move.type);
  if (stab) mult = fmul(mult, FX_1_5);
  // habilidades e IQ: inmunidades, absorciones, multiplicadores y críticos
  const am = abilityDamageMods({ attacker, defender, move, eff: effCore, weather, phys, stab });
  if (am.immune) return { dmg: 0, eff: 0, crit: false, note: am.note };
  if (am.absorb) return { dmg: 0, eff: 1, crit: false, absorbed: true, note: am.note };
  if (am.mult !== 1) mult = fmul(mult, Math.round(am.mult * FX));
  const wx = WEATHER[weather]?.mult ? WEATHER[weather].mult(move.type) : 1;
  if (wx !== 1) mult = fmul(mult, Math.round(wx * FX));
  if (attacker.status?.kind === 'burn' && phys) mult = fmul(mult, FX_BURN);
  const critChance = Math.floor((move.crit ?? 8) * 1.5 * (ITEMS[attacker.held]?.crit || 1) * am.critMult);   // crítico del movimiento (+50 %); Periscopio, Afortunado, IQ
  const critRoll = rng.random() * 100, crit = !am.noCrit && critChance > 0 && critRoll < critChance;
  if (crit) mult = fmul(mult, Math.round(FX_1_5 * sniperCrit(attacker)));   // Francotirador: aún más
  base = fmul(base, mult);
  if (typeless) base = fmul(base, FX_0_5);                            // el ataque normal hace la mitad
  base = fmul(base, 0xE000 + Math.floor(rng.random() * 0x4000));    // variación de 0,875 a 1,1249
  return { dmg: Math.max(0, fround(base)), eff: effCore, crit }; // en el juego un golpe puede llegar a hacer 0
}

// Intenta aplicar un estado. Devuelve true si se aplicó.
export function applyStatus(rng, target, kind, chance = 1) {
  if (target.status || !STATUS[kind]) return false;
  if (ITEMS[target.held]?.immune?.includes(kind) || abilityBlocksStatus(target, kind)) return false;   // objeto o habilidad que lo impide
  const resist = target.held && ITEMS[target.held]?.statusResist || 1;
  if (rng.random() >= chance * resist) return false;
  const [lo, hi] = STATUS[kind].turns;
  let turns = rng.int(lo, hi);
  if ((kind === 'sleep' && hasAbility(target, 'EARLY_BIRD')) || target.iqSkills?.includes('Self Curer') || target.iqSkills?.includes('Self-Curer') || ITEMS[target.held]?.statusShort) turns = Math.max(1, Math.ceil(turns / 2));
  target.status = { kind, turns };
  hooks.onStatus?.(target, kind);
  return true;
}
// Efecto de estado al inicio del turno del afectado. Devuelve { skip, randomMove, dmg, cured }
// Estados como en el juego: el veneno y la quemadura duran hasta curarse y hacen daño periódico (veneno 2 PS cada 20 turnos,
// veneno grave 6 cada 5, quemadura 6 cada 50); ese daño despierta al que duerme.
export function tickStatus(rng, mon, turn) {
  const st = mon.status; if (!st) return { skip: false };
  const def = STATUS[st.kind], out = { skip: false, randomMove: false, dmg: 0, cured: false };
  if (def.tick) {
    st.cd = (st.cd ?? def.tick.every) - 1;
    if (st.cd <= 0) { st.cd = def.tick.every; out.dmg = def.tick.dmg; mon.hp = Math.max(0, mon.hp - out.dmg); }
  }
  if (def.skip && rng.random() < def.skip) out.skip = true;
  if (def.randomMove && rng.random() < def.randomMove) out.randomMove = true;
  if (st.turns < 9999 && --st.turns <= 0) { mon.status = null; out.cured = true; } // 9999 = dura hasta curarse
  return out;
}
export function wakeOnHit(mon) { if (mon.status && STATUS[mon.status.kind].wakeOnHit) { mon.status = null; return true; } return false; }

export function randomFloorIn(rng, room, tiles) {
  for (let t = 0; t < 60; t++) {
    const x = rng.int(room.x, room.x + room.w - 1), y = rng.int(room.y, room.y + room.h - 1);
    if (tiles[y][x] === T.FLOOR) return { x, y };
  }
  for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) if (tiles[y][x] === T.FLOOR) return { x, y };
  return { x: room.x, y: room.y };
}

// Mancha de terreno (agua/lava) dentro de una sala, dejando un anillo de suelo de 1 casilla
function paintTerrain(rng, room, tiles, tile) {
  if (room.w < 5 || room.h < 5) return;
  const cx = room.x + room.w / 2, cy = room.y + room.h / 2, rx = rng.int(1, Math.floor(room.w / 2) - 1), ry = rng.int(1, Math.floor(room.h / 2) - 1);
  for (let y = room.y + 1; y < room.y + room.h - 1; y++) for (let x = room.x + 1; x < room.x + room.w - 1; x++)
    if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 && rng.random() < 0.9) tiles[y][x] = tile;
}

export function generateDungeon(rng, def = {}) {
  const { w, h } = CFG.map;
  const tiles = Array.from({ length: h }, () => new Array(w).fill(T.WALL));
  const cellW = Math.floor(w / CFG.cells.cols), cellH = Math.floor(h / CFG.cells.rows);
  const rooms = [];
  for (let cy = 0; cy < CFG.cells.rows; cy++) for (let cx = 0; cx < CFG.cells.cols; cx++) {
    const isRoom = rng.random() > 0.25 || rooms.length === 0;
    const rw = isRoom ? rng.int(CFG.roomMin, Math.min(CFG.roomMax, cellW - 3)) : 1;
    const rh = isRoom ? rng.int(CFG.roomMin, Math.min(CFG.roomMax, cellH - 3)) : 1;
    const x = cx * cellW + rng.int(1, cellW - rw - 2), y = cy * cellH + rng.int(1, cellH - rh - 2);
    rooms.push({ x, y, w: rw, h: rh, cx, cy, isRoom });
    for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) tiles[j][i] = T.FLOOR;
  }
  const byCell = (cx, cy) => rooms.find(r => r.cx === cx && r.cy === cy);
  const center = r => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });
  const carve = (a, b) => {
    let { x, y } = a;
    const stepX = () => { while (x !== b.x) { x += Math.sign(b.x - x); if (tiles[y][x] === T.WALL) tiles[y][x] = T.FLOOR; } };
    const stepY = () => { while (y !== b.y) { y += Math.sign(b.y - y); if (tiles[y][x] === T.WALL) tiles[y][x] = T.FLOOR; } };
    rng.random() < 0.5 ? (stepX(), stepY()) : (stepY(), stepX());
  };
  for (const r of rooms) {
    const right = byCell(r.cx + 1, r.cy); if (right) carve(center(r), center(right));
    const down = byCell(r.cx, r.cy + 1); if (down && rng.random() < 0.6) carve(center(r), center(down));
  }
  for (let cy = 0; cy < CFG.cells.rows - 1; cy++) { const a = byCell(rng.int(0, CFG.cells.cols - 1), cy); carve(center(a), center(byCell(a.cx, cy + 1))); }
  // Paredes macizas: toda casilla de pared debe pertenecer a algún bloque 2×2 de pared. Los pelos y esquinas
  // sueltas (que se ven como piezas de tetris) pasan a suelo. Se repite hasta que no cambie nada.
  const isWall = (x, y) => x < 0 || y < 0 || x >= w || y >= h || tiles[y][x] === T.WALL;
  const inBlock = (x, y) => [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([ox, oy]) => isWall(x + ox, y + oy) && isWall(x + ox + 1, y + oy) && isWall(x + ox, y + oy + 1) && isWall(x + ox + 1, y + oy + 1));
  for (let changed = true, guard = 0; changed && guard < 8; guard++) {
    changed = false;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (tiles[y][x] === T.WALL && !inBlock(x, y)) { tiles[y][x] = T.FLOOR; changed = true; }
  }
  const realRooms = rooms.filter(r => r.isRoom);
  // terreno: manchas de agua/lava en algunas salas (después de los pasillos, para no cortarlos)
  const terrain = def.terrain || [];
  if (terrain.length) for (const r of realRooms) if (rng.random() < CFG.terrainChance) paintTerrain(rng, r, tiles, rng.pick(terrain) === 'lava' ? T.LAVA : T.WATER);
  const start = rng.pick(realRooms);
  let end = rng.pick(realRooms); while (end === start && realRooms.length > 1) end = rng.pick(realRooms);
  const stairs = randomFloorIn(rng, end, tiles); tiles[stairs.y][stairs.x] = T.STAIRS;
  return { tiles, rooms: realRooms, start: randomFloorIn(rng, start, tiles), stairs, stairsRoom: end, arena: false };
}

export function generateArena() {
  const { w, h } = CFG.map;
  const tiles = Array.from({ length: h }, () => new Array(w).fill(T.WALL));
  const room = { x: Math.floor(w / 2) - 5, y: Math.floor(h / 2) - 4, w: 11, h: 8, isRoom: true };
  for (let j = room.y; j < room.y + room.h; j++) for (let i = room.x; i < room.x + room.w; i++) tiles[j][i] = T.FLOOR;
  const cx = room.x + Math.floor(room.w / 2);
  // sin pasillo: apareces dentro de la sala, abajo, frente al jefe. Sin escalera: vencer al jefe final completa la mazmorra
  // (en las mazmorras sin fin, la escalera aparece en este punto al vencerlo)
  const start = { x: cx, y: room.y + room.h - 1 };
  const stairs = { x: cx, y: room.y };
  return { tiles, rooms: [room], start, stairs, stairsRoom: room, arena: true };
}

// Fases del evento de Jirachi (piso 100 de la infinita): tres bestias debilitadas y luego Jirachi entero
export const JIRACHI_PHASES = [
  { species: 'entei', statMult: 0.7 }, { species: 'suicune', statMult: 0.7 }, { species: 'raikou', statMult: 0.7 }, { species: 'jirachi', statMult: 1 },
];

// Construye un piso completo (mapa + habitantes) de forma determinista a partir del rng.
export function buildFloor(rng, def, floor, missions = [], flags = {}, runSeed = 0) {
  const kind = floorKind(def, floor, flags);
  const isArena = ['legendary', 'bigLegendary', 'jirachi'].includes(kind);
  const era = eraFor(def, floor, runSeed); // en la Mazmorra del Tiempo: bioma y salvajes de una mazmorra antigua
  const dungeon = isArena ? generateArena() : generateDungeon(rng, era);
  dungeon.eraId = era.id;
  const weather = isArena ? 'none' : weatherFor(runSeed, floor, era.id);
  const { rooms, tiles, start, stairs } = dungeon;
  const enemies = [], groundItems = [], npcs = [], messages = [];
  let monsterHouse = null, boss = null;
  const wildLevel = () => Math.max(1, Math.round(def.lvl + floor * 0.5 + rng.int(-1, 1)));
  const occupied = (x, y) => enemies.some(e => e.x === x && e.y === y) || (start.x === x && start.y === y);
  const sellable = Object.keys(ITEMS).filter(k => ITEMS[k].kind === 'sell' && ITEMS[k].minFloor <= floor);

  if (kind === 'jirachi') {
    const ph = JIRACHI_PHASES[0];
    boss = createMon(ph.species, wildLevel() + 5, { statMult: ph.statMult, x: stairs.x, y: stairs.y + 1, asleep: false, isBoss: true, isLegendary: true, phase: 0, jirachiEvent: true });
    computeStats(boss); boss.hp = boss.maxHp; enemies.push(boss);
    return { dungeon, enemies, groundItems, npcs, monsterHouse, kind, boss, messages, weather };
  }
  if (isArena) {
    const big = kind === 'bigLegendary', isFinal = floor === def.floors;
    const species = isFinal ? def.finalBoss : rng.pick(def.legendaries);
    const md = isFinal ? def.md : rng.pick(big && rng.random() < 0.7 ? MD_RARE_POOL : MD_POOL);
    boss = createMon(species, isFinal && def.finalBossLevel ? def.finalBossLevel : wildLevel() + (big ? 8 : 5), { x: stairs.x, y: stairs.y + 1, asleep: false, isBoss: true, isLegendary: true, md, big, noRecruit: isFinal && !!def.finalBossNoRecruit });
    if (isFinal && def.finalBossMoves) boss.moves = def.finalBossMoves.map(n => ({ name: n, pp: MOVES[n]?.pp ?? 20 }));   // p. ej. Chatot del entrenamiento: solo Placaje
    enemies.push(boss);
    if (big) for (let i = 0; i < 4; i++) { const p = randomFloorIn(rng, rooms[0], tiles); if (!occupied(p.x, p.y)) enemies.push(createMon(rng.pick(MINIBOSS_POOL), wildLevel() + 1, { ...p, asleep: false, minion: true })); }
    return { dungeon, enemies, groundItems, npcs, monsterHouse, kind, boss, messages, weather };
  }

  for (let i = 0, n = rng.int(...CFG.enemiesPerFloor); i < n; i++) {
    const p = randomFloorIn(rng, rng.pick(rooms), tiles);
    if (!occupied(p.x, p.y)) { const sp = rng.pick(era.pool); enemies.push(createMon(sp, wildLevel(), { ...p, asleep: rng.random() * 100 < (EOS_ASLEEP[sp] ?? 8) })); } // % de dormir propio de la especie (casi siempre 8 %)
  }
  for (const m of missions) if (!m.done && m.dungeonId === def.id && m.floor === floor) {
    const p = randomFloorIn(rng, rng.pick(rooms), tiles);
    if (m.type === 'derrotar') { enemies.push(createMon(m.target, wildLevel() + 2, { ...p, asleep: false, missionId: m.id })); messages.push(`Tu objetivo, ${SPECIES[m.target].name}, está en este piso.`); }
    else if (m.type === 'encontrar') { groundItems.push({ ...p, name: 'Objeto perdido', missionId: m.id }); messages.push('El objeto perdido debería estar en este piso.'); }
    else if (m.type === 'rescatar') { npcs.push({ ...p, species: m.target, name: SPECIES[m.target].name, missionId: m.id, facing: [0, 1] }); messages.push(`${SPECIES[m.target].name} espera ser rescatado en este piso.`); }
    else if (m.type === 'entregar') { npcs.push({ ...p, species: m.target, name: SPECIES[m.target].name, missionId: m.id, wants: m.item, facing: [0, 1] }); messages.push(`${SPECIES[m.target].name} espera en este piso: necesita ${m.item}.`); }
    else if (m.type === 'forajido') { const o = createMon(m.target, wildLevel() + 5, { ...p, asleep: false, missionId: m.id, outlaw: true, statMult: 1.2, fleeOutlaw: rng.random() < 0.35 }); o.name = `${SPECIES[m.target].name} (forajido)`; enemies.push(o); messages.push(`¡El forajido ${SPECIES[m.target].name} se esconde en este piso!`); }
  }
  for (let i = 0, n = rng.int(1, 3); i < n; i++) {
    const p = randomFloorIn(rng, rng.pick(rooms), tiles);
    const roll = rng.random();
    const name = roll < 0.25 ? rng.pick(sellable) : rollLoot(rng, floor);   // botín completo por rareza y piso
    if (tiles[p.y][p.x] === T.FLOOR) groundItems.push({ ...p, name });
  }
  // Guardián Mega: si la misión está activa y aún no tienes la piedra, sustituye al jefe/minijefe de este piso.
  const stone = megaStoneFor(def.id, floor);
  const hasMega = stone && flags.megaNeeded && flags.megaNeeded.includes(stone.id) && SPECIES[stone.guardian];
  const mh = CFG.monsterHouse, mhChance = mh.min + (mh.max - mh.min) * Math.min(1, floor / mh.rampFloors);
  const startRoom = rooms.find(r => start.x >= r.x && start.x < r.x + r.w && start.y >= r.y && start.y < r.y + r.h);
  const candidates = rooms.filter(r => r !== startRoom && r.w * r.h >= 20);
  if (kind === 'normal' && !hasMega && candidates.length && rng.random() < mhChance) monsterHouse = { room: rng.pick(candidates), triggered: false };
  if (hasMega) {
    // se planta sobre las escaleras y las sella, como un minijefe, pero es la Mega guardiana
    boss = createMon(stone.guardian, wildLevel() + 8, { x: stairs.x, y: stairs.y, asleep: false, isBoss: true, sealsStairs: true, mega: true, megaStone: stone.id, dropsStone: stone });
    enemies.push(boss);
    messages.push(`Una presencia inmensa sella las escaleras… ${SPECIES[stone.guardian].name} custodia la ${stone.name}.`);
  } else if (kind === 'miniboss') { boss = createMon(rng.pick(MINIBOSS_POOL), wildLevel() + 3, { x: stairs.x, y: stairs.y, asleep: false, isBoss: true, sealsStairs: true }); enemies.push(boss); }
  // Tienda de Kecleon: una sala (ni la inicial ni la de las escaleras) con alfombra de objetos y el tendero
  let shop = null;
  const shopRooms = rooms.filter(r => r !== startRoom && r !== dungeon.stairsRoom && r.w >= 5 && r.h >= 4 && (!monsterHouse || r !== monsterHouse.room));
  if (kind === 'normal' && floor >= SHOP_IN_DUNGEON.minFloor && shopRooms.length && rng.random() < SHOP_IN_DUNGEON.chance) {
    const room = rng.pick(shopRooms), cx = room.x + Math.floor(room.w / 2), cy = room.y + Math.floor(room.h / 2);
    const carpet = []; for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 2; x++) if (tiles[y]?.[x] === T.FLOOR) carpet.push({ x, y });
    const stock = [...SHOP_FIXED, ...SHOP_ROTATING, ...SHOP_HELD];
    const spots = carpet.filter(c => !(c.x === cx && c.y === cy));
    for (let i = 0, n = rng.int(...SHOP_IN_DUNGEON.items); i < n && spots.length; i++) { const p = spots.splice(rng.int(0, spots.length - 1), 1)[0]; const name = rng.pick(stock); groundItems.push({ ...p, name, price: shopPrice(name), shop: true }); }
    npcs.push({ x: cx, y: cy, species: 'kecleon', name: 'Kecleon', keeper: true, facing: [0, 1] });
    // no queremos salvajes dormidos dentro de la tienda
    for (let i = enemies.length - 1; i >= 0; i--) if (carpet.some(c => c.x === enemies[i].x && c.y === enemies[i].y)) enemies.splice(i, 1);
    shop = { room, carpet, keeper: { x: cx, y: cy } };
    messages.push('Huele a incienso… hay una tienda de Kecleon en este piso.');
  }
  return { dungeon, enemies, groundItems, npcs, monsterHouse, kind, boss, messages, shop, weather };
}

export function spawnMonsterHouse(rng, def, floor, room, tiles, occupied, pool = def.pool) {
  const enemies = [], groundItems = [], free = [];
  const wildLevel = () => Math.max(1, Math.round(def.lvl + floor * 0.5 + rng.int(-1, 1)));
  for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) if (tiles[y][x] === T.FLOOR && !occupied(x, y)) free.push({ x, y });
  for (let i = 0, n = rng.int(...CFG.monsterHouse.enemies); i < n && free.length; i++) enemies.push(createMon(rng.pick(pool), wildLevel(), { ...free.splice(rng.int(0, free.length - 1), 1)[0], asleep: false }));
  const sellable = Object.keys(ITEMS).filter(k => ITEMS[k].kind === 'sell' && ITEMS[k].minFloor <= floor);
  for (let i = 0, n = rng.int(...CFG.monsterHouse.items); i < n && free.length; i++) groundItems.push({ ...free.splice(rng.int(0, free.length - 1), 1)[0], name: rng.random() < 0.6 ? rng.pick(sellable) : rng.pick(['Baya Aranja', 'Manzana', 'Semilla Revivir', 'Orbe Cura']) });
  return { enemies, groundItems };
}

// Cota de Pokés por pisos alcanzados (validación del servidor)
export function maxPokesByFloor(def, floorReached) {
  let total = 0;
  const maxWild = Math.max(...def.pool.map(s => SPECIES[s].pokes));
  const maxBoss = Math.max(...MINIBOSS_POOL.map(s => SPECIES[s].pokes));
  const maxLeg = Math.max(...Object.values(SPECIES).filter(s => s.legendary).map(s => s.pokes));
  for (let f = 1; f <= floorReached; f++) {
    const mult = 1 + f * CFG.pokeFloorMult, kind = floorKind(def, f);
    if (kind === 'normal') total += (CFG.enemiesPerFloor[1] + CFG.monsterHouse.enemies[1] + 2) * maxWild * mult;
    else if (kind === 'miniboss') total += (CFG.enemiesPerFloor[1] + 2) * maxWild * mult + maxBoss * mult;
    else total += 4 * maxLeg * mult + 4 * maxBoss * mult;
  }
  return Math.ceil(total);
}
