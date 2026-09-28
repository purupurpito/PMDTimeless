// Habilidades (de la especie) y habilidades IQ (se desbloquean con el IQ que dan las gominolas).
// Datos de la ROM en iq-abil-data.js; aquí los nombres en castellano y los efectos que usa el motor.
import { SPECIES_ABILITIES, SPECIES_IQ_GROUP, IQ_GROUPS } from './iq-abil-data.js';
// Especies añadidas que no existen en Exploradores del Cielo (sin datos de la ROM): habilidad e IQ asignados a mano
Object.assign(SPECIES_ABILITIES, { rowlet: ['OVERGROW'] });   // Espesura, como los demás iniciales de tipo Planta
Object.assign(SPECIES_IQ_GROUP, { rowlet: SPECIES_IQ_GROUP.chikorita });

export const ABILITY_ES = {
  ADAPTABILITY: 'Adaptable', AIR_LOCK: 'Esclusa de Aire', ANGER_POINT: 'Irascible', ARENA_TRAP: 'Trampa Arena', BAD_DREAMS: 'Mal Sueño',
  BATTLE_ARMOR: 'Armadura Batalla', BLAZE: 'Mar Llamas', CHLOROPHYLL: 'Clorofila', CLEAR_BODY: 'Cuerpo Puro', CLOUD_NINE: 'Aclimatación',
  COMPOUNDEYES: 'Ojo Compuesto', CUTE_CHARM: 'Gran Encanto', DAMP: 'Humedad', DOWNLOAD: 'Descarga', DRIZZLE: 'Llovizna', DROUGHT: 'Sequía',
  DRY_SKIN: 'Piel Seca', EARLY_BIRD: 'Madrugar', EFFECT_SPORE: 'Efecto Espora', FLAME_BODY: 'Cuerpo Llama', FLASH_FIRE: 'Absorbe Fuego',
  FOREWARN: 'Alerta', FRISK: 'Cacheo', GLUTTONY: 'Gula', GUTS: 'Agallas', HUGE_POWER: 'Potencia', HUSTLE: 'Entusiasmo', HYDRATION: 'Hidratación',
  HYPER_CUTTER: 'Corte Fuerte', ILLUMINATE: 'Iluminación', IMMUNITY: 'Inmunidad', INNER_FOCUS: 'Foco Interno', INSOMNIA: 'Insomnio',
  INTIMIDATE: 'Intimidación', IRON_FIST: 'Puño Férreo', KEEN_EYE: 'Vista Lince', LEAF_GUARD: 'Defensa Hoja', LEVITATE: 'Levitación',
  LIGHTNINGROD: 'Pararrayos', LIMBER: 'Flexibilidad', LIQUID_OOZE: 'Lodo Líquido', MAGIC_GUARD: 'Muro Mágico', MAGMA_ARMOR: 'Escudo Magma',
  MAGNET_PULL: 'Imán', MOLD_BREAKER: 'Rompemoldes', NATURAL_CURE: 'Cura Natural', NO_GUARD: 'Indefenso', OBLIVIOUS: 'Despiste',
  OVERGROW: 'Espesura', OWN_TEMPO: 'Ritmo Propio', PICKUP: 'Recogida', POISON_POINT: 'Punto Tóxico', PRESSURE: 'Presión', QUICK_FEET: 'Pies Rápidos',
  RECKLESS: 'Audaz', RIVALRY: 'Rivalidad', ROCK_HEAD: 'Cabeza Roca', RUN_AWAY: 'Fuga', SAND_STREAM: 'Chorro Arena', SAND_VEIL: 'Velo Arena',
  SCRAPPY: 'Intrépido', SERENE_GRACE: 'Dicha', SHADOW_TAG: 'Sombra Trampa', SHED_SKIN: 'Mudar', SHELL_ARMOR: 'Caparazón', SHIELD_DUST: 'Polvo Escudo',
  SKILL_LINK: 'Encadenado', SLOW_START: 'Inicio Lento', SNIPER: 'Francotirador', SNOW_CLOAK: 'Manto Níveo', SOLAR_POWER: 'Poder Solar',
  SOUNDPROOF: 'Insonorizar', SPEED_BOOST: 'Impulso', STATIC: 'Elec. Estática', STEADFAST: 'Impasible', STENCH: 'Hedor', STICKY_HOLD: 'Viscosidad',
  STURDY: 'Robustez', SUCTION_CUPS: 'Ventosas', SUPER_LUCK: 'Afortunado', SWARM: 'Enjambre', SWIFT_SWIM: 'Nado Rápido', SYNCHRONIZE: 'Sincronía',
  TANGLED_FEET: 'Tumbos', TECHNICIAN: 'Experto', THICK_FAT: 'Sebo', TINTED_LENS: 'Cromolente', TORRENT: 'Torrente', TRACE: 'Calco',
  VITAL_SPIRIT: 'Espíritu Vital', VOLT_ABSORB: 'Absorbe Elec', WATER_ABSORB: 'Absorbe Agua', WATER_VEIL: 'Velo Agua',
};
// Qué hace cada una aquí (las que no aparecen aún no tienen efecto)
export const ABILITY_DESC = {
  BLAZE: 'Con poca vida, potencia los ataques de tipo Fuego.', TORRENT: 'Con poca vida, potencia los ataques de tipo Agua.',
  OVERGROW: 'Con poca vida, potencia los ataques de tipo Planta.', SWARM: 'Con poca vida, potencia los ataques de tipo Bicho.',
  ADAPTABILITY: 'Potencia aún más los ataques de su propio tipo.', HUGE_POWER: 'Aumenta mucho el daño de los ataques físicos.',
  GUTS: 'Con un problema de estado, pega más fuerte.', HUSTLE: 'Pega más fuerte, pero con menos precisión.', IRON_FIST: 'Potencia los ataques de puño.',
  TECHNICIAN: 'Potencia los ataques débiles.', TINTED_LENS: 'Los ataques poco eficaces hacen el doble.', SNIPER: 'Los golpes críticos hacen aún más daño.',
  SOLAR_POWER: 'Con sol, sube el At. Esp.', SCRAPPY: 'Sus ataques Normal y Lucha alcanzan a los Fantasma.', MOLD_BREAKER: 'Ignora las habilidades del rival.',
  THICK_FAT: 'Recibe la mitad de daño de Fuego y Hielo.', LEVITATE: 'Inmune a los ataques de tipo Tierra.', FLASH_FIRE: 'Absorbe el Fuego y se potencia.',
  WATER_ABSORB: 'Los ataques de Agua le curan.', VOLT_ABSORB: 'Los ataques Eléctricos le curan.', DRY_SKIN: 'El Agua le cura; el Fuego le hace más daño.',
  LIGHTNINGROD: 'Inmune a los ataques Eléctricos.', BATTLE_ARMOR: 'No recibe golpes críticos.', SHELL_ARMOR: 'No recibe golpes críticos.',
  SUPER_LUCK: 'Más golpes críticos.', COMPOUNDEYES: 'Más precisión.', NO_GUARD: 'Todos los ataques, suyos y contra él, aciertan.',
  SAND_VEIL: 'Más evasión con tormenta de arena.', SNOW_CLOAK: 'Más evasión con granizo.', TANGLED_FEET: 'Más evasión si está confuso.',
  INSOMNIA: 'No puede dormirse.', VITAL_SPIRIT: 'No puede dormirse.', IMMUNITY: 'No puede envenenarse.', LIMBER: 'No puede paralizarse.',
  OWN_TEMPO: 'No puede confundirse.', WATER_VEIL: 'No puede quemarse.', MAGMA_ARMOR: 'No puede congelarse.', LEAF_GUARD: 'Con sol, sin problemas de estado.',
  CLEAR_BODY: 'No le pueden bajar las estadísticas.', HYPER_CUTTER: 'No le pueden bajar el Ataque.', KEEN_EYE: 'No le pueden bajar la Precisión.',
  STATIC: 'Quien le golpea de cerca puede quedar paralizado.', POISON_POINT: 'Quien le golpea de cerca puede envenenarse.',
  FLAME_BODY: 'Quien le golpea de cerca puede quemarse.', EFFECT_SPORE: 'Quien le golpea de cerca puede dormirse, envenenarse o paralizarse.',
  SHED_SKIN: 'A veces se cura solo de sus problemas de estado.', NATURAL_CURE: 'Se cura de sus problemas de estado al cambiar de piso.',
  HYDRATION: 'Con lluvia, se cura de sus problemas de estado.', EARLY_BIRD: 'Se despierta antes.', PICKUP: 'A veces encuentra objetos al cambiar de piso.',
  DRIZZLE: 'Hace que llueva en el piso.', DROUGHT: 'Hace que brille el sol en el piso.', SAND_STREAM: 'Levanta una tormenta de arena en el piso.',
  CLOUD_NINE: 'Anula los efectos del clima.', AIR_LOCK: 'Anula los efectos del clima.', MAGIC_GUARD: 'Solo recibe daño de los ataques.',
};
export const abilitiesOf = sp => SPECIES_ABILITIES[sp] || [];
export const has = (mon, ab) => !!mon && abilitiesOf(mon.species).includes(ab);
const hasIQ = (mon, s) => !!mon?.iqSkills?.includes(s);

// ---------------- IQ ----------------
export const IQ_ES = {
  'Absolute Mover': 'Todoterreno Total', 'Acute Sniffer': 'Olfato Fino', 'Aggressor': 'Agresor', 'All-Terrain Hiker': 'Todoterreno', 'Bodyguard': 'Guardaespaldas',
  'Brick-Tough': 'Duro como un Ladrillo', 'Cheerleader': 'Animador', 'Clutch Performer': 'Crecido en Apuros', 'Coin Watcher': 'Ojo al Dinero', 'Collector': 'Coleccionista',
  'Concentrator': 'Concentrado', 'Counter Basher': 'Contragolpe', 'Counter Hitter': 'Contraatacante', 'Course Checker': 'Comprobador de Rutas', 'Critical Dodger': 'Esquiva Crítica',
  'Dedicated Traveler': 'Viajero Entregado', 'Deep Breather': 'Respiración Profunda', 'Defender': 'Defensor', 'Efficiency Expert': 'Experto en Eficiencia',
  'Energy Saver': 'Ahorrador de Energía', 'Erratic Player': 'Jugador Errático', 'Escapist': 'Escapista', 'Exclusive Move-User': 'Solo Movimientos', 'Exp. Elite': 'Élite de Experiencia',
  'Exp. Go-Getter': 'Cazaexperiencia', 'Extra Striker': 'Golpe Extra', 'Fast Friend': 'Amigo Rápido', 'Gap Prober': 'Rastreador de Huecos', 'Haggler': 'Regateador',
  'Hit-and-Runner': 'Golpea y Huye', 'House Avoider': 'Evita Casas', 'Intimidator': 'Intimidador', 'Item Catcher': 'Atrapaobjetos', 'Item Master': 'Maestro de Objetos',
  'Lava Evader': 'Evita la Lava', 'Map Surveyor': 'Topógrafo', 'Multi talent': 'Multitalento', 'Multitalent': 'Multitalento', 'Nature Gifter': 'Regalo Natural',
  'Nature Giver': 'Regalo Natural', 'No-Charger': 'Sin Carga', 'Nonsleeper': 'Insomne', 'Nontraitor': 'Leal', 'PP Saver': 'Ahorrador de PP', 'Pierce Hurler': 'Lanzador Perforante',
  'Power Pitcher': 'Lanzador Potente', 'Practice Swinger': 'Aprende del Fallo', 'Quick Dodger': 'Esquiva Rápida', 'Quick Healer': 'Curación Rápida', 'Quick Striker': 'Golpe Rápido',
  'Self Curer': 'Autocuración', 'Self-Curer': 'Autocuración', 'Sharp Shooter': 'Francotirador', 'Sharpshooter': 'Francotirador', 'Stair Sensor': 'Detector de Escaleras',
  'Status Checker': 'Comprobador de Estados', 'Status Cheker': 'Comprobador de Estados', 'Sure-Hit Attacker': 'Ataque Certero', 'Survivalist': 'Superviviente',
  'Time Tripper': 'Viajero del Tiempo', 'Trap Avoider': 'Evita Trampas', 'Trap Buster': 'Rompetrampas', 'Trap Seer': 'Ve Trampas', 'Type-Advantage Master': 'Maestro del Tipo',
  'Wary Fighter': 'Luchador Prudente', 'Weak-Type Picker': 'Busca Debilidades', 'Weak-Type picker': 'Busca Debilidades', 'Wise Healer': 'Sanador Sabio',
};
export const IQ_WORKS = new Set(['Sure-Hit Attacker', 'Sharpshooter', 'Sharp Shooter', 'Type-Advantage Master', 'Critical Dodger', 'Quick Dodger', 'Clutch Performer',
  'Concentrator', 'Aggressor', 'Defender', 'Counter Hitter', 'Brick-Tough', 'Energy Saver', 'Survivalist', 'Wise Healer', 'Self Curer', 'Self-Curer', 'Nonsleeper',
  'Exp. Elite', 'Fast Friend', 'Map Surveyor', 'Stair Sensor', 'Acute Sniffer', 'Deep Breather', 'PP Saver', 'Power Pitcher', 'All-Terrain Hiker', 'Absolute Mover', 'Quick Healer']);
// habilidades IQ de un Pokémon según su grupo y su IQ: [{ id, name, iq, works }]
export function iqSkillsFor(mon) {
  const g = SPECIES_IQ_GROUP[mon.species]; const list = IQ_GROUPS[g] || [];
  const seen = new Set(), out = [];
  for (const [iq, id] of list) { const name = IQ_ES[id] || id; if (seen.has(name)) continue; seen.add(name); out.push({ id, name, iq, works: IQ_WORKS.has(id) }); }
  return out;
}
export const activeIQ = mon => iqSkillsFor(mon).filter(s => s.iq <= (mon.iq || 0)).map(s => s.id);

// ---------------- ganchos del motor ----------------
const STATUS_BLOCK = { INSOMNIA: ['sleep'], VITAL_SPIRIT: ['sleep'], IMMUNITY: ['poison', 'toxic'], LIMBER: ['paralysis'], OWN_TEMPO: ['confusion'], WATER_VEIL: ['burn'], MAGMA_ARMOR: ['freeze'] };
export function abilityBlocksStatus(mon, kind) {
  for (const [ab, list] of Object.entries(STATUS_BLOCK)) if (has(mon, ab) && list.includes(kind)) return true;
  if (kind === 'sleep' && hasIQ(mon, 'Nonsleeper')) return true;
  return false;
}
export function abilityBlocksDrop(mon, stat) {
  if (has(mon, 'CLEAR_BODY')) return true;
  return (stat === 'atk' && has(mon, 'HYPER_CUTTER')) || (stat === 'acc' && has(mon, 'KEEN_EYE'));
}
const noWeather = mons => mons.some(m => has(m, 'CLOUD_NINE') || has(m, 'AIR_LOCK'));
// Multiplicadores de daño: { immune, absorb, mult, critMult, noCrit, note }
export function abilityDamageMods({ attacker, defender, move, eff, weather, phys, stab }) {
  const r = { immune: false, absorb: false, mult: 1, critMult: 1, noCrit: false, note: null };
  const ignore = has(attacker, 'MOLD_BREAKER');
  const low = attacker.hp <= attacker.maxHp / 4, t = move.typeless ? null : move.type;
  if (t && !ignore) {
    if (t === 'Tierra' && has(defender, 'LEVITATE')) return { ...r, immune: true, note: 'Levitación' };
    if (t === 'Eléctrico' && has(defender, 'LIGHTNINGROD')) return { ...r, immune: true, note: 'Pararrayos' };
    if (t === 'Fuego' && has(defender, 'FLASH_FIRE')) { defender.flashFire = true; return { ...r, immune: true, note: 'Absorbe Fuego' }; }
    if (t === 'Agua' && (has(defender, 'WATER_ABSORB') || has(defender, 'DRY_SKIN'))) return { ...r, absorb: true, note: ABILITY_ES[has(defender, 'DRY_SKIN') ? 'DRY_SKIN' : 'WATER_ABSORB'] };
    if (t === 'Eléctrico' && has(defender, 'VOLT_ABSORB')) return { ...r, absorb: true, note: 'Absorbe Elec' };
    if ((t === 'Fuego' || t === 'Hielo') && has(defender, 'THICK_FAT')) r.mult *= 0.5;
    if (t === 'Fuego' && has(defender, 'DRY_SKIN')) r.mult *= 1.25;
  }
  if (low && ((t === 'Fuego' && has(attacker, 'BLAZE')) || (t === 'Agua' && has(attacker, 'TORRENT')) || (t === 'Planta' && has(attacker, 'OVERGROW')) || (t === 'Bicho' && has(attacker, 'SWARM')))) r.mult *= 1.5;
  if (t === 'Fuego' && attacker.flashFire) r.mult *= 1.5;
  if (stab && has(attacker, 'ADAPTABILITY')) r.mult *= 4 / 3;
  if (phys && has(attacker, 'HUGE_POWER')) r.mult *= 1.5;
  if (phys && has(attacker, 'GUTS') && attacker.status) r.mult *= 1.5;
  if (phys && has(attacker, 'HUSTLE')) r.mult *= 1.3;
  if (has(attacker, 'IRON_FIST') && /Puño/.test(move.name || '')) r.mult *= 1.2;
  if (has(attacker, 'TECHNICIAN') && (move.power || 0) <= 60) r.mult *= 1.5;
  if (has(attacker, 'TINTED_LENS') && eff > 0 && eff < 1) r.mult *= 2;
  if (!phys && has(attacker, 'SOLAR_POWER') && weather === 'sun') r.mult *= 1.5;
  if (hasIQ(attacker, 'Aggressor')) r.mult *= 1.25; if (hasIQ(defender, 'Aggressor')) r.mult *= 1.25;
  if (hasIQ(attacker, 'Defender')) r.mult *= 0.8; if (hasIQ(defender, 'Defender')) r.mult *= 0.8;
  if (has(attacker, 'SUPER_LUCK')) r.critMult *= 2;
  if (hasIQ(attacker, 'Sharpshooter') || hasIQ(attacker, 'Sharp Shooter')) r.critMult *= 2;
  if (hasIQ(attacker, 'Type-Advantage Master') && eff > 1) r.critMult *= 3;
  if (!ignore && (has(defender, 'BATTLE_ARMOR') || has(defender, 'SHELL_ARMOR'))) r.noCrit = true;
  if (hasIQ(defender, 'Critical Dodger')) r.noCrit = true;
  return r;
}
export const sniperCrit = mon => has(mon, 'SNIPER') ? 1.5 : 1;
export const scrappy = mon => has(mon, 'SCRAPPY');
// Precisión: { always, accMult, accStages, evaStages }
export function abilityAccMods(attacker, defender, weather, move) {
  const r = { always: false, accMult: 1, accStages: 0, evaStages: 0 };
  if (has(attacker, 'NO_GUARD') || has(defender, 'NO_GUARD')) r.always = true;
  if (move?.typeless && hasIQ(attacker, 'Sure-Hit Attacker')) r.always = true;
  if (has(attacker, 'COMPOUNDEYES')) r.accMult *= 1.3;
  if (has(attacker, 'HUSTLE') && move?.cat === 'phys') r.accMult *= 0.8;
  if (weather === 'sand' && has(defender, 'SAND_VEIL')) r.evaStages += 1;
  if (weather === 'hail' && has(defender, 'SNOW_CLOAK')) r.evaStages += 1;
  if (defender?.status?.kind === 'confusion' && has(defender, 'TANGLED_FEET')) r.evaStages += 1;
  if (hasIQ(attacker, 'Concentrator')) r.accStages += 1;
  if (hasIQ(defender, 'Concentrator')) r.evaStages -= 1;
  if (hasIQ(defender, 'Quick Dodger')) r.evaStages += 1;
  if (hasIQ(defender, 'Clutch Performer') && defender.hp < defender.maxHp / 4) r.evaStages += 2;
  return r;
}
// Estado por contacto (quien golpea de cerca con un ataque físico): devuelve el estado para el atacante, o null
export function contactStatus(rng, attacker, defender, move) {
  if (move.cat !== 'phys' || rng.random() >= 0.12) return null;
  if (has(defender, 'STATIC')) return 'paralysis';
  if (has(defender, 'POISON_POINT')) return 'poison';
  if (has(defender, 'FLAME_BODY')) return 'burn';
  if (has(defender, 'EFFECT_SPORE')) return rng.pick(['sleep', 'poison', 'paralysis']);
  return null;
}
// Clima que impone alguien del piso al empezar (Llovizna, Sequía, Chorro Arena); 'none' si alguien lo anula
export function floorWeather(mons) {
  if (noWeather(mons)) return 'none';
  if (mons.some(m => has(m, 'DRIZZLE'))) return 'rain';
  if (mons.some(m => has(m, 'DROUGHT'))) return 'sun';
  if (mons.some(m => has(m, 'SAND_STREAM'))) return 'sand';
  return null;
}
