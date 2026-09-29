// ===== SERVIDOR LOCAL: el juego funciona sin servidor y guarda la partida en este navegador (localStorage) =====
import { DELIVERY_ITEMS, bagSizeFor } from '../../shared/data.js';
import { deliverMail, letterById } from '../../shared/story.js';
import { expToNext, CFG, DUNGEONS, SPECIES, ITEMS, SHOP_FIXED, SHOP_ROTATING, SHOP_HELD, RANKS, MISSION_TYPES, MEGA_STONES, KECLEON_DISCOUNT, dungeonById, rankOf } from '../../shared/data.js';
import { publicQuiz, scoreQuiz, NATURES } from '../../server/quiz.js';

export class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
let token = null;
export const setToken = t => { token = t; };
export const hasToken = () => !!token;

const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const SAVE_KEY = 'pmdt_save';
const DB = (() => { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && 'user' in s) return { user: s.user, runs: s.runs || [] }; } catch { /* partida dañada o inexistente */ } return { user: null, runs: [] }; })();
const saveDB = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(DB)); } catch { /* sin espacio o navegación privada */ } };
// el código secreto nunca se guarda tal cual (FNV-1a de 32 bits: basta para una partida local)
const hashPass = s => { let h = 0x811c9dc5; for (const c of 'pmdt:' + String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
const norm = s => String(s || '').trim().toLowerCase();
const defaultMeta = starter => ({ pokes: 800, rankPts: 0, starters: [starter], bag: ['Baya Aranja', 'Baya Aranja', 'Manzana'], storage: [], movepool: {}, cleared: [], active: [], board: [], bonds: {}, legendaries: [], shop: [], tutorialDone: false, lostRecruits: [], gifts: [], stats: { runs: 0, floors: 0, deaths: 0, monsterHouses: 0, recruited: 0, kecleonRobs: 0, itemsSold: 0, deepest: 0 }, badges: [], stones: [], story: 'none', dreamUnlocked: false, progress: {} });
const poolOf = def => def.eras ? [...new Set(def.eras.flatMap(id => dungeonById(id).pool))] : def.pool;
function generateMission(meta) {
  const rank = rankOf(meta.rankPts), pool = DUNGEONS.filter(d => d.rank <= rank && (meta.cleared || []).includes(d.id)); if (!pool.length) return null; const dungeon = pick(pool); // solo mazmorras completadas
  const maxFloor = Math.min(dungeon.floors === Infinity ? 30 : dungeon.floors - 1, 10 + rank * 10);
  const type = pick(Object.keys(MISSION_TYPES));
  let floor = 2 + rnd(Math.max(2, maxFloor - 1));
  if (type === 'rescatar') floor = Math.max(10, Math.floor(floor / 10) * 10) + 1;
  if (dungeon.floors !== Infinity && floor >= dungeon.floors) floor = dungeon.floors - 1;
  const target = MISSION_TYPES[type].needsTarget ? pick(poolOf(dungeon)) : null;
  const diff = Math.ceil(floor / 5) * (type === 'rescatar' ? 2 : type === 'forajido' ? 2.5 : type === 'entregar' ? 1.3 : type === 'explorar' ? 0.7 : 1);
  const item = type === 'entregar' ? pick(DELIVERY_ITEMS) : undefined;
  return { id: Math.random().toString(36).slice(2, 8), type, dungeonId: dungeon.id, floor, target, ...(item ? { item } : {}), pokes: Math.round(150 * diff) + rnd(51), rankPts: Math.round(20 * diff) };
}
const refreshBoard = m => { m.board = m.board.filter(b => (m.cleared || []).includes(b.dungeonId)); while (m.board.length < 4) { const mm = generateMission(m); if (!mm) break; m.board.push(mm); } };
const rotateShop = m => { const pk = (a, n) => [...a].sort(() => Math.random() - .5).slice(0, n); m.shop = [...SHOP_FIXED, ...pk(SHOP_ROTATING, 2), ...pk(SHOP_HELD, 1 + (rankOf(m.rankPts) >= 2 ? 1 : 0))]; };
const activeRun = () => DB.runs.find(r => r.status === 'active' || r.status === 'paused');
const publicUser = () => ({ id: 1, name: DB.user.name, nature: DB.user.nature, natureText: NATURES[DB.user.nature]?.text, meta: DB.user.meta });
const runInfo = r => ({ id: r.id, dungeonId: r.dungeonId, seed: r.seed, starter: r.starter, status: r.status, state: r.state, flags: { jirachiUnlocked: DB.user.meta.legendaries.includes('jirachi'), megaNeeded: DB.user.meta.story !== 'quest' ? [] : MEGA_STONES.filter(s => s.dungeonId === r.dungeonId && !DB.user.meta.stones.includes(s.id)).map(s => s.id) } });
const fail = (msg, code = 400) => { throw new ApiError(msg, code); };

// cada llamada se guarda en el navegador; al registrarse se apunta el código secreto (cifrado)
export async function api(path, body) {
  const r = await localApi(path, body);
  if (path === '/auth/register' && DB.user) DB.user.pass = hashPass(body?.password);
  saveDB(); return r;
}
async function localApi(path, body) {
  await new Promise(r => setTimeout(r, 30));
  const m = DB.user?.meta;
  switch (path) {
    case '/quiz': return { questions: publicQuiz() };
    case '/dev/cheat': {   // truco PURUPURPITO: en la versión de prueba siempre disponible
      const meta = defaultMeta('pidgeot'); meta.pokes = 9999999; meta.progress = { pidgeot: { level: 99, exp: 0 } }; meta.tutorialDone = true; rotateShop(meta);
      DB.user = { name: 'Purupurpito', nature: 'valiente', meta }; token = 'demo'; return { token, user: publicUser() };
    }
    case '/quiz/preview': return scoreQuiz(body.answers);
    case '/auth/register': { const res = scoreQuiz(body.answers); const meta = defaultMeta(res.starter); refreshBoard(meta); rotateShop(meta); DB.user = { name: String(body.name || 'Explorador').trim(), nature: res.nature, meta }; token = 'demo'; return { token, user: publicUser(), result: res }; }
    case '/auth/login':
      if (!DB.user) fail('No hay ninguna partida guardada en este navegador. Empieza una nueva.', 401);
      if (norm(body.name) !== norm(DB.user.name) || (DB.user.pass && hashPass(body.password) !== DB.user.pass)) fail('Nombre o código secreto incorrectos.', 401);
      token = 'local'; return { token, user: publicUser() };
    case '/auth/logout': token = null; return { ok: true };
    case '/me': { if (!DB.user) fail('Sin sesión', 401); refreshBoard(m); deliverMail(m);
      const today = new Date().toISOString().slice(0, 10), mailNews = (m.mail || []).some(x => !x.read && letterById(x.id)) && m.mailDay !== today; if (mailNews) m.mailDay = today;
      const r = activeRun(); return { mailNews, user: publicUser(), run: r ? runInfo(r) : null }; }
    case '/mail/read': { const x = (m.mail || []).find(l => l.id === body.id); if (!x) fail('Esa carta no está en tu buzón.', 404); x.read = true; return { mail: m.mail }; }
    case '/shop/buy': { if (activeRun()) fail('Tienes una run en curso.', 409); if (!m.shop.includes(body.item)) fail('Kecleon verde no vende eso ahora mismo.'); const isK = body.leader === 'kecleon' && m.starters.includes('kecleon'); const price = Math.round(ITEMS[body.item].buy * (isK ? KECLEON_DISCOUNT : 1)); if (m.pokes < price) fail('Kecleon verde: "Ejem… no te llega."'); if (m.bag.length >= bagSizeFor(m.rankPts)) fail('Tienes la bolsa llena.'); m.pokes -= price; m.bag.push(body.item); return { meta: m, price }; }
    case '/shop/sell': { if (body.keep) return { meta: m }; let gained = 0; if (body.all) m.bag = m.bag.filter(n => { if (ITEMS[n]?.sell) { gained += ITEMS[n].sell; return false; } return true; }); else { const n = m.bag[body.index]; if (!n || !ITEMS[n]?.sell) fail('Eso no se puede vender.'); gained = ITEMS[n].sell; m.bag.splice(body.index, 1); } m.pokes += gained; return { meta: m, gained }; }
    case '/missions/accept': { const i = m.board.findIndex(x => x.id === body.id); if (i < 0) fail('Esa misión ya no está.'); if (m.active.length >= 2) fail('Ya llevas dos misiones.'); m.active.push(m.board.splice(i, 1)[0]); refreshBoard(m); return { meta: m }; }
    case '/missions/abandon': m.active = m.active.filter(x => x.id !== body.id); return { meta: m };
    case '/storage/deposit': { const n = m.bag[body.index]; if (!n) fail('No hay nada ahí.'); if (m.storage.length >= CFG.storageSize) fail('Almacén lleno.'); m.bag.splice(body.index, 1); m.storage.push(n); return { meta: m }; }
    case '/storage/withdraw': { const n = m.storage[body.index]; if (!n) fail('No hay nada ahí.'); if (m.bag.length >= bagSizeFor(m.rankPts)) fail('Bolsa llena.'); m.storage.splice(body.index, 1); m.bag.push(n); return { meta: m }; }
    case '/tutorial/done': m.tutorialDone = true; return { ok: true };
    case '/hub/gift': { if (ITEMS[body.item] && !m.gifts.includes('wob') && m.bag.length < bagSizeFor(m.rankPts)) { m.bag.push(body.item); m.gifts.push('wob'); } return { meta: m }; }
    case '/hub/today': return { special: null, claimed: false, stats: m.stats, badges: m.badges };
    case '/pidgeot': return { open: rankOf(m.rankPts) >= 4, story: m.story, stones: m.stones, allStones: MEGA_STONES, dreamUnlocked: m.dreamUnlocked };
    case '/pidgeot/advance': { if (m.story === 'none') { m.story = 'quest'; return { meta: m, story: 'quest' }; } if (m.story === 'quest' && m.stones.length >= MEGA_STONES.length) { m.story = 'dream'; m.dreamUnlocked = true; return { meta: m, story: 'dream', message: 'La Mazmorra de los Sueños se revela.' }; } return { meta: m, story: m.story }; }
    case '/run/start': { if (activeRun()) fail('Ya tienes una run en curso.', 409); const def = dungeonById(body.dungeonId); if (!def) fail('Mazmorra desconocida.'); if (def.id !== 'suenos' && def.rank > rankOf(m.rankPts)) fail(`Necesitas rango ${RANKS[def.rank].name}.`, 403); const bag = m.bag; m.bag = []; const run = { id: DB.runs.length + 1, dungeonId: def.id, seed: 1 + rnd(2 ** 31 - 2), starter: body.starter, status: 'active', state: null }; DB.runs.push(run); return { run: runInfo(run), bag, missions: m.active, movepool: m.movepool[body.starter] || [], meta: m }; }
    case '/run/pause': { const r = activeRun(); if (!r) fail('No hay run.'); r.status = 'paused'; r.state = body.state; return { ok: true }; }
    case '/run/save': { const r = activeRun(); if (!r) fail('No hay run.', 404); if ((body.rev || 0) > (r.rev || 0)) { r.state = body.state; r.rev = body.rev; } return { ok: true, rev: r.rev }; }   // guardado automático
    case '/run/resume': { const r = activeRun(); if (!r || !(r.status === 'paused' || r.state)) fail('No hay run pausada.'); r.status = 'active'; return { run: { ...runInfo(r), rev: r.rev || 0 } }; }
    case '/run/abandon': { const r = activeRun(); if (r) r.status = 'ended'; return { meta: m }; }
    case '/run/end': {
      const r = activeRun(); if (!r) fail('No hay run.'); const def = dungeonById(r.dungeonId), f = Number(body.floor) || 1, msgs = [];
      if (body.outcome !== 'death') {
        m.pokes += Math.max(0, Number(body.runPokes) || 0); msgs.push(`Vuelves al gremio con ${body.runPokes} Pokés.`);
        m.bag = (body.inventory || []).slice(0, bagSizeFor(m.rankPts)); if (body.held && m.bag.length < bagSizeFor(m.rankPts)) m.bag.push(body.held);
        for (const mv of (body.mdToStorage || [])) { m.storage.push(`MD: ${mv}`); msgs.push(`La MD ${mv} está en el depósito de Kangaskhan.`); }
        m.movepool[r.starter] = m.movepool[r.starter] || []; for (const md of body.earnedMD || []) if (!m.movepool[r.starter].includes(md)) { m.movepool[r.starter].push(md); msgs.push(`${md} pasa al movepool permanente de ${SPECIES[r.starter].name}.`); }
        let rank = 0; for (const id of body.missionsDone || []) { const i = m.active.findIndex(x => x.id === id); if (i < 0) continue; const mis = m.active[i]; m.pokes += mis.pokes; rank += mis.rankPts; m.active.splice(i, 1); msgs.push(`Misión cumplida: +${mis.pokes} Pokés.`); }
        if (body.outcome === 'clear') { const tut = def.id === 'entrenamiento';   // el Campo de Entrenamiento es un tutorial: no da rango ni desbloquea nada
      if (!m.cleared.includes(def.id)) { m.cleared.push(def.id); if (!tut) rank += 100; } else if (!tut) rank += 20; msgs.push(`¡Has completado ${def.name}!`); }
        for (const b of (rankOf(m.rankPts) >= 2 ? body.bonds || [] : [])) if ((b.floors | 0) >= CFG.bondFloors && SPECIES[b.species] && typeof b.nick === 'string' && b.nick.trim()) (m.nicknames ||= {})[b.species] = b.nick.replace(/[<>&"'`\\]/g, '').trim().slice(0, 10);
        for (const b of (rankOf(m.rankPts) >= 2 ? body.bonds || [] : [])) if ((b.floors | 0) >= CFG.bondFloors && SPECIES[b.species] && !m.starters.includes(b.species)) { m.starters.push(b.species); msgs.push(`¡${SPECIES[b.species].name} se une a tus iniciales!`); }
        for (const id of body.stonesFound || []) { const st = MEGA_STONES.find(x => x.id === id); if (st && !m.stones.includes(id)) { m.stones.push(id); msgs.push(`Has recuperado la ${st.name}. Llévasela al maestro Pidgeot.`); } }
        for (const sp of body.legendaries || []) if (SPECIES[sp]?.legendary && !m.legendaries.includes(sp)) { m.legendaries.push(sp); msgs.push(`¡${SPECIES[sp].name} se une al gremio!`); }
        const before = rankOf(m.rankPts); m.rankPts += rank; if (rankOf(m.rankPts) > before) { msgs.push(`¡Subes a rango ${RANKS[rankOf(m.rankPts)].name}!`); for (const dg of DUNGEONS.filter(x => x.rank > before && x.rank <= rankOf(m.rankPts))) msgs.push(`Nueva mazmorra disponible: ${dg.name}.`); }
      } else {
        // al caer, como en Exploradores del Cielo: mitad de los Pokés, la mitad (o más) de la bolsa al azar y casi siempre el objeto equipado
        const items = (body.inventory || []).slice(0, bagSizeFor(m.rankPts)), kept = [...items], lost = [];
        for (let k = 0; k < Math.ceil(items.length / 2); k++) lost.push(kept.splice(Math.floor(Math.random() * kept.length), 1)[0]);
        const pokes = Math.max(0, Number(body.runPokes) || 0), pokesKept = Math.floor(pokes / 2), held = body.held || null, heldLost = !!held && Math.random() < 0.9;
        m.pokes += pokesKept; m.bag = [...kept, ...(held && !heldLost ? [held] : [])].slice(0, bagSizeFor(m.rankPts));
        var penalty = { carried: { pokes, items, held }, lost: { pokes: pokes - pokesKept, items: lost, held: heldLost ? held : null }, kept: { pokes: pokesKept, items: kept, held: held && !heldLost ? held : null } };
      }
      // nivel y experiencia se conservan siempre (también al caer), con el mismo tope que el servidor real
      const keep = (species, mon, fresh) => { if (!SPECIES[species] || !mon) return; const old = m.progress[species]?.level ?? (fresh ? null : CFG.startLevel); const lv = Math.floor(Number(mon.level) || 0);
        const seeds = Math.max(0, Math.min(6, Math.floor(Number(mon.seedLevels) || 0)));
        const cap = old === null ? Math.min(100, (def.lvl || 1) + Math.ceil(f * 0.5) + 10 + seeds) : Math.min(100, old + Math.ceil(f * 1.5) + 3 + seeds);
        const level = Math.max(old ?? 1, Math.min(lv, cap)); const prev = m.progress[species] || {};
        const bonus = { ...(mon.bonus || prev.bonus || {}) }; if (mon.toughApplied) bonus.hp = (bonus.hp || 0) - 10;
        m.progress[species] = { level, exp: Math.max(0, Math.min(Math.floor(Number(mon.exp) || 0), expToNext(species, level) - 1)), iq: Math.min(999, Math.max(prev.iq || 0, Math.floor(Number(mon.iq) || 0))), bonus }; };
      keep(r.starter, body.player, false);
      for (const t of (body.team || [])) if (t && t.species !== r.starter && m.starters.includes(t.species)) keep(t.species, t, !m.progress[t.species]);
      (m.stats.deepestBy ||= {})[def.id] = Math.max(m.stats.deepestBy[def.id] || 0, f);
      const st = body.diary || {}; m.stats.runs++; m.stats.floors += Math.max(0, f - 1); m.stats.deaths += body.outcome === 'death' ? 1 : 0; m.stats.monsterHouses += st.monsterHouses | 0; m.stats.recruited += st.recruited | 0; m.stats.kecleonRobs += st.kecleonRobs | 0; m.stats.deepest = Math.max(m.stats.deepest, f);
      m.lostRecruits = body.lostRecruits || []; rotateShop(m); refreshBoard(m); r.status = 'ended'; r.state = { floor: f, player: body.player };
      const newMail = deliverMail(m); return { newMail,  meta: m, messages: msgs, canRescue: false, result: { outcome: body.outcome, floor: f, penalty: typeof penalty !== 'undefined' ? penalty : null } };
    }
    case '/rescue/list': return { rescues: [] };
    case '/rescue/mine': case '/rescue/status': return { rescued: false, rescues: [], waiting: [] };
    case '/rescue/request': return { rescue: { code: 'DEMO0000' } };
    case '/rescue/accept': case '/rescue/complete': fail('El rescate entre jugadores necesita el servidor real.');
  }
  fail('Endpoint no disponible en la demo: ' + path, 404);
}

// sin servidor no hay conexión que vigilar
export const onNetStatus = () => {};
export const newRequestId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
