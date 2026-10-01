import { setTouchVisible } from './touch.js';
// =====================================================================
// JUEGO — escenas Base y Mazmorra. Lo persistente pasa por la API; la mazmorra se juega en local con RNG sembrado.
// =====================================================================
import { rollLoot, WEATHER as WEATHER_ALL, CFG, SPECIES, MOVES, BASIC, TM_POOL, ITEMS, STATUS, TACTICS, RANKS, DUNGEONS, MISSION_TYPES, SHOP_IN_DUNGEON, KECLEON_DISCOUNT, RECRUIT_MIN_RANK, dungeonById, rankOf, expForLevel, expToNext, expGained, learnEntries, canLearnMachine, pokesFor, floorKind, recruitChance, canCrossTerrain, eraFor, shopPrice, bagSizeFor, fixItemName, fixMoveName } from '../../shared/data.js';
import { hooks as engineHooks, T, createMon, computeStats, damage, hitCheck, applyStages, applyStatus, tickStatus, wakeOnHit, buildFloor, spawnMonsterHouse, JIRACHI_PHASES, speedOf } from '../../shared/engine.js';
import { WEATHER, MEGA_STONES, DREAM_DUNGEON, MEGA_DIALOG } from '../../shared/data.js';
import { makeRng, floorSeed } from '../../shared/rng.js';
import { api, newRequestId } from './api.js';
import { track, flushTelemetry, setTelemetryContext, deviceInfo, telemetryOn, setTelemetry } from './telemetry.js';
import { storyLineFor, letterById, SABLEYE_LINES, pendingScene } from '../../shared/story.js';
import { initScenes, playScene, skipScene, tickScenes, sceneEntities, drawSceneActor, drawSceneOverlay, sceneTap, sceneShake, drawSceneObjectAt, drawScreenFade, releaseBlack } from './scenes.js';
import { drawEmote, EMOTE_LEN } from './emotes.js';
import { spawnMoveFx, drawMoveFx, fxEndTime, fxShake, spawnSuperEffective } from './vfx.js';
import { SCENES } from '../../shared/story.js';
const SCENES_ALL = () => SCENES;
import { HUB, VIEW } from './hub.js';
import { HUB_OBJECTS } from './hub-objects.js';
import { typeIconHTML, typeIconImg } from './typeicons.js';
import { playZone, playTrack, playOnce, stopMusic, setVolume, getVolume, preload as preloadMusic, playSfx, setSfxVolume, getSfxVolume } from './music.js';
import { VERSION_LABEL } from '../../shared/version.js';
import { asset } from './ui.js';
import { ITEM_ICON, MACHINE_ICON, MD_ICON, ICON_COLS } from './item-sprites.js';
import { PORTRAIT, PORTRAIT_COLS } from './portraits.js';
import { DTEF_SLOT, DUNGEON_TILESET } from './tilesets.js';
import { contactStatus, floorWeather, activeIQ, iqSkillsFor, ABILITY_ES, ABILITY_DESC, abilitiesOf, has as hasAbility } from '../../shared/abilities.js';

// ---------- sprites ----------
// client/assets/manifest.json: "clave": "ruta.png"  (imagen simple)
//   o "id": { sheet, frame:[w,h], frames, idle, idleFrame, idleFrames, portrait }  (hoja de SpriteCollab, 8 direcciones en filas)
// Orden de filas en SpriteCollab: abajo, abajo-dcha, dcha, arriba-dcha, arriba, arriba-izda, izda, abajo-izda
const DIR_ROW = { '0,1': 0, '1,1': 1, '1,0': 2, '1,-1': 3, '0,-1': 4, '-1,-1': 5, '-1,0': 6, '-1,1': 7 };
// Texturas de mazmorra del proyecto (suelo por tipo de mazmorra, pared, escalera, agua y lava)
const DUNGEON_TILES = Object.fromEntries([['floor', 'floor_bosque'], ['floor_bosque', 'floor_bosque'], ['floor_cueva', 'floor_cueva'], ['floor_monte', 'floor_monte'], ['floor_ruinas', 'floor_ruinas'],
  ['wall', 'wall_bosque'], ['stairs', 'stairs'], ['water', 'water'], ['lava', 'lava']].map(([k, f]) => [k, `client/assets/dungeon/${f}.png`]));
const Sprites = {
  images: {}, mons: {},
  // Carga bajo demanda: al empezar solo se lee el índice; la hoja de cada Pokémon se descarga la primera vez que aparece
  // (mientras llega, se ve el círculo de reserva). Fuentes, por orden: manifest completo (tools/fetch-sprites.mjs, con
  // animación de inactivo) → hojas recortadas incrustadas en la versión de prueba (window.__SPRITES) → hojas recortadas del proyecto.
  async load(url = 'client/assets/manifest.json') {
    await Hub.load();
    const loadImg = src => new Promise(res => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = src; });
    // índice: el incrustado de la versión de prueba (window.__MANIFEST) o el de tools/fetch-sprites.mjs
    let manifest = window.__MANIFEST || null;
    if (!manifest) { try { const r = await fetch(url); if (r.ok) manifest = await r.json(); } catch { /* sin manifest */ } }
    manifest = { ...DUNGEON_TILES, ...(manifest || {}) };   // texturas de mazmorra del proyecto (el índice puede sustituirlas)
    if (manifest._font) { try { const f = new FontFace('PMDFont', `url(${manifest._font})`); await f.load(); document.fonts.add(f); this.fontName = 'PMDFont'; } catch { /* sin fuente propia */ } }
    const imgs = [];
    for (const [key, val] of Object.entries(manifest)) {
      if (key.startsWith('_')) continue;
      if (typeof val === 'string') imgs.push(loadImg(val).then(img => { if (img) this.images[key] = img; }));   // texturas: pocas y ligeras, al empezar
      else if (val.sheet || val.idle) this.mons[key] = { ...val };                                             // sprites: bajo demanda
    }
    await Promise.all(imgs);
    if (Object.keys(this.mons).length) return;
    // sin hojas completas: las recortadas (incrustadas en la versión de prueba, o las del proyecto)
    let mini = window.__SPRITES;
    if (!mini) { try { const idx = await (await fetch('client/assets/sprites-min/index.json')).json(); mini = Object.fromEntries(Object.entries(idx).map(([k, v]) => [k, { ...v, sheet: `client/assets/sprites-min/${k}.png` }])); } catch { mini = null; } }
    if (mini) for (const [key, v] of Object.entries(mini)) this.mons[key] = { ...v };
  },
  lazyImages: {},
  // animaciones de combate (Attack, Shoot, Hurt, Sleep, Faint): se descargan la primera vez que se usan
  ensureAnim(m, name) {
    const a = m.anims?.[name]; if (!a || (m.animImg ||= {})[name] !== undefined) return;
    m.animImg[name] = null; const load = (tries = 0) => { const img = new Image(); img.onload = () => { m.animImg[name] = img; scheduleRender(); }; img.onerror = () => { if (tries < 4) setTimeout(() => load(tries + 1), [1500, 4000, 10000, 30000][tries]); }; img.src = a.sheet; }; load();
  },
  // descarga (una sola vez) las hojas de un Pokémon; al llegar, se vuelve a dibujar
  ensure(m) {
    if (m.requested) return; m.requested = true;
    const get = (src, field, tries = 0) => { if (!src) return; const img = new Image(); img.onload = () => { m[field] = img; scheduleRender(); }; img.onerror = () => { if (tries < 4) setTimeout(() => get(src, field, tries + 1), [1500, 4000, 10000, 30000][tries]); }; img.src = src; };   // si falla, se reintenta
    get(m.sheet, 'sheetImg'); get(m.idle, 'idleImg');
  },
  draw(ctx, key, x, y, w, h = w) {
    let img = this.images[key];
    if (!img && this.lazyImages[key]) { const src = this.lazyImages[key]; delete this.lazyImages[key]; const im = new Image(); im.onload = () => { this.images[key] = im; scheduleRender(); }; im.src = src; }
    if (img) { ctx.drawImage(img, x, y, w, h); return true; } return false;
  },
  // Dibuja un Pokémon centrado en su casilla; usa la animación de andar si se ha movido hace poco
  drawMon(ctx, mon, px, py, tile) {
    const m = this.mons[mon.species]; if (!m) return this.draw(ctx, mon.species, px, py, tile);
    if (!m.sheetImg && !m.idleImg) { this.ensure(m); return false; }   // aún descargando: círculo de reserva
    const now = performance.now(), act = mon.anim && now - mon.anim.t0 < mon.anim.dur ? mon.anim : null;
    const animName = act ? act.name : ((mon.asleep || mon.status?.kind === 'sleep') && m.anims?.Sleep ? 'Sleep' : null);
    if (animName && m.anims?.[animName]) {
      const a = m.anims[animName], aimg = m.animImg?.[animName];
      if (aimg) {
        const [fw, fh] = a.frame, rows = Math.max(1, Math.round(aimg.height / fh)), dur = a.durations?.length ? a.durations : [8];
        const total = dur.reduce((s, d) => s + d, 0), t0 = act ? act.t0 : 0;
        let f = (now - t0) / (1000 / 60) / (act?.slow || 1); f = act && !act.loop ? Math.min(f, total - 0.01) : f % total;   // una vez (golpes), o en bucle (dormir, poses mantenidas)
        let col = 0; for (let acc = 0; col < dur.length - 1 && (acc += dur[col]) <= f; col++);
        const row = rows === 1 ? 0 : (DIR_ROW[`${mon.facing?.[0] ?? 0},${mon.facing?.[1] ?? 1}`] ?? 0);
        const scale = tile / 24, feet = py + tile - 2 * scale;
        ctx.imageSmoothingEnabled = false; ctx.drawImage(aimg, col * fw, row * fh, fw, fh, px + tile / 2 - fw * scale / 2, feet - fh * scale * 0.62, fw * scale, fh * scale); ctx.imageSmoothingEnabled = true;
        return true;
      }
      this.ensureAnim(m, animName);
    }
    const moving = mon.movedAt && performance.now() - mon.movedAt < 250;
    const img = moving && m.sheetImg ? m.sheetImg : m.idleImg || m.sheetImg; if (!img) return false;
    const [fw, fh] = moving && m.sheetImg ? m.frame : m.idleFrame || m.frame;
    const frames = moving && m.sheetImg ? m.frames : m.idleImg ? (m.idleFrames || 1) : 1;   // sin animación de inactivo: primer fotograma de andar
    const row = DIR_ROW[`${mon.facing[0]},${mon.facing[1]}`] ?? 0;
    const col = mon.still && !moving ? 0 : Math.floor(performance.now() / (moving ? 90 : 220)) % frames;   // quien está hablando se queda quieto (como en el original)
    // Los frames de SpriteCollab llevan margen: los pies quedan hacia el 62 % de la altura del frame. Se anclan a la casilla.
    // Con hoja recortada (trim = [x0, y0, ancho y alto del fotograma original]) se coloca igual que el original.
    const scale = tile / 24, feet = py + tile - 2 * scale;
    const [tx, ty, ow, oh] = (img === m.sheetImg && m.trim) ? m.trim : [0, 0, fw, fh];
    const ox = px + tile / 2 - ow * scale / 2 + tx * scale, oy = feet - oh * scale * 0.62 + ty * scale;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(img, col * fw, row * fh, fw, fh, ox, oy, fw * scale, fh * scale); ctx.imageSmoothingEnabled = true;
    return true;
  },
  drawPortrait(ctx, key, x, y, size) {
    const m = this.mons[key]; if (m?.portraitImg) { ctx.drawImage(m.portraitImg, x, y, size, size); return true; }
    return this.draw(ctx, `portrait_${key}`, x, y, size);
  }
};

// Imágenes y máscaras de las zonas de la aldea (máscara: blanco = se puede andar)
const Hub = {
  areas: {},
  async load() {
    const loadImg = src => new Promise(res => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = src; });
    for (const [id, a] of Object.entries(HUB)) {
      const img = await loadImg(a.img), mask = await loadImg(a.mask);
      let walk = null;
      let debug = null;
      if (mask) {
        const c = document.createElement('canvas'); c.width = mask.width; c.height = mask.height; const cx = c.getContext('2d'); cx.drawImage(mask, 0, 0);
        const px = cx.getImageData(0, 0, c.width, c.height); walk = { w: c.width, h: c.height, data: px.data };
        // capa de depuración: rojo translúcido donde no se puede andar (tecla M en la aldea)
        const dbg = document.createElement('canvas'); dbg.width = c.width; dbg.height = c.height; const dx = dbg.getContext('2d'); const out = dx.createImageData(c.width, c.height);
        for (let i = 0; i < px.data.length; i += 4) if (px.data[i] < 128) { out.data[i] = 255; out.data[i + 3] = 110; }
        dx.putImageData(out, 0, 0); debug = dbg;
      }
      const objs = HUB_OBJECTS[id];
      const objImg = objs ? await loadImg(objs.img) : null;
      this.areas[id] = { img, walk, debug, objs: objImg ? objs.list : [], objImg };
      // versión alternativa de la zona (p. ej. la plaza con el camino a la Fuente, al completar el Bosque Frondoso)
      if (a.alt) { const ai = await loadImg(a.alt.img), am = await loadImg(a.alt.mask); if (ai && am) {
        const c = document.createElement('canvas'); c.width = am.width; c.height = am.height; const cx = c.getContext('2d'); cx.drawImage(am, 0, 0);
        const px = cx.getImageData(0, 0, c.width, c.height); this.areas[id].alt = { img: ai, walk: { w: c.width, h: c.height, data: px.data } };
      } }
    }
  },
  // la zona tal como se ve ahora: su versión alternativa si ya está desbloqueada
  view(id) { const a = this.areas[id], alt = HUB[id]?.alt; return a?.alt && alt && meta?.cleared?.includes(alt.unlock) ? { ...a, ...a.alt, debug: null } : a; },
  walkable(id, x, y) { const a = this.view(id); if (!a?.walk) return true; const { w, h, data } = a.walk; x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w || y >= h) return false; return data[(y * w + x) * 4] > 127; },
};

// ---------- tarjetas de transición (pantalla negra con texto, como al entrar en un piso en PMD) ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Ritmo de la mazmorra, como en el original: los pasos se deslizan (STEP_MS) y cada ataque se ve por separado.
// Las pruebas automáticas activan window.__mmFast para ir sin pausas.
const FAST = () => !!window.__mmFast;
const STEP_MS = () => FAST() ? 0 : 110;                 // deslizarse de una casilla a la siguiente
const ATTACK_PAUSE = () => FAST() ? 0 : Math.max(300, fxEndTime() - performance.now() + 80);   // (lo que dure la animación del movimiento)            // tras un ataque, antes de que actúe el siguiente
const pace = ms => FAST() || ms <= 0 ? Promise.resolve() : sleep(ms);
// posición visual (con decimales) de un Pokémon: se desliza de la casilla anterior a la actual
function vpos(e) {
  const now = performance.now(); let tw = e._tw;
  if (!tw || tw.tx !== e.x || tw.ty !== e.y) {
    const cur = tw ? twAt(tw, now) : { x: e.x, y: e.y };
    const far = Math.abs(cur.x - e.x) > 1.5 || Math.abs(cur.y - e.y) > 1.5;   // teletransporte o piso nuevo: sin deslizar
    tw = e._tw = { fx: far ? e.x : cur.x, fy: far ? e.y : cur.y, tx: e.x, ty: e.y, t0: now };
  }
  return twAt(tw, now);
}
function twAt(tw, now) {
  const d = STEP_MS(), k = d ? Math.min(1, (now - tw.t0) / d) : 1;
  if (k < 1) sliding = true;
  return { x: tw.fx + (tw.tx - tw.fx) * k, y: tw.fy + (tw.ty - tw.fy) * k };
}
let sliding = false, lastCam = null;
// espera a que terminen de caer los Pokémon derrotados (nadie pisa a uno que se está debilitando)
async function waitFading(max = 1000) {
  const t0 = performance.now();
  while (!FAST() && state.fading?.some(f => performance.now() < f.until) && performance.now() - t0 < max) await sleep(40);
}
async function showCard(title, sub = '', ms = 1400) {
  const card = document.getElementById('card'); if (!card) return;
  card.classList.remove('fast');
  card.querySelector('.card-title').textContent = title; card.querySelector('.card-sub').textContent = sub;
  state.busy = true; card.classList.add('show');
  await sleep(350 + ms);
  card.classList.remove('show'); await sleep(350);
  state.busy = false; render();
}
// fundido breve a negro al cambiar de zona en la aldea
async function blink() {
  const card = document.getElementById('card'); if (!card) return;
  card.querySelector('.card-title').textContent = ''; card.querySelector('.card-sub').textContent = '';
  card.classList.add('fast', 'show'); await sleep(160); card.classList.remove('show'); await sleep(160); card.classList.remove('fast');
}

// ---------- estado ----------
let meta = null, user = null;
const hubCounters = () => { try { return JSON.parse(localStorage.getItem('mm_hub') || '{}'); } catch { return {}; } };
const saveHubCounters = c => localStorage.setItem('mm_hub', JSON.stringify(c));
const state = {
  scene: 'hub', run: null, floor: 1, turn: 0, dungeon: null, dungeonDef: null, player: null, team: [], enemies: [], npcs: [], groundItems: [],
  seen: null, inRoom: null, monsterHouse: null, rng: null, log: [], inventory: [], runPokes: 0, missions: [], earnedMD: [], recruitedLegendaries: [],
  lostRecruits: [], bondedLost: [], effects: [], menu: null, dialog: null, dead: false, busy: false, pausedRun: null, flags: {},
  hub: { area: 'plaza', x: 384, y: 300, facing: [0, 1], wanderers: [], t: 0 },
};
const DIRS8 = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
// ¿el punto está dentro de un polígono? (salidas con forma diagonal, como el hueco de una escalera en perspectiva)
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [x1, y1] = P[i], [x2, y2] = P[j]; if ((y1 > y) !== (y2 > y) && x < x1 + (y - y1) * (x2 - x1) / (y2 - y1)) c = !c; } return c; };
const inExit = (ex, x, y) => ex.poly ? inPoly(x, y, ex.poly) : inRect(x, y, ex.rect);
const permanentMoves = species => meta.movepool?.[species] || [];
const knownPool = mon => [...new Set([...learnEntries(mon.species).filter(([lv]) => lv <= mon.level).map(([, m]) => m), ...permanentMoves(mon.species)])];
function createPlayer(species) {
  const saved = meta.progress?.[species];                      // nivel y experiencia guardados entre exploraciones
  const mon = createMon(species, saved?.level || CFG.startLevel, { belly: 100, maxBelly: 100, held: null });
  mon.runStartLevel = mon.level; // tope: +2 niveles por exploración
  if (saved?.exp) mon.exp = saved.exp;
  mon.iq = saved?.iq || 0; mon.bonus = { ...(saved?.bonus || {}) }; computeStats(mon); mon.hp = mon.maxHp;   // IQ (gominolas) y mejoras permanentes
  mon.name = meta.nicknames?.[species] || user.name; // tu inicial lleva tu nombre; los reclutas que se hicieron iniciales, su mote
  for (const m of permanentMoves(species)) if (mon.moves.length < 4 && !mon.moves.some(x => x.name === m)) mon.moves.push({ name: m, pp: MOVES[m].pp, permanent: true });
  mon.moves.forEach(m => m.permanent = permanentMoves(species).includes(m.name));
  return mon;
}
const missionText = m => {
  const d = dungeonById(m.dungeonId).name, t = MISSION_TYPES[m.type || 'derrotar'].label;
  const who = m.target ? `${SPECIES[m.target].name} ` : '';
  if (m.type === 'entregar') return `${t} ${m.item} a ${who}en B${m.floor}F de ${d}  (${m.pokes} P · +${m.rankPts} rango)`;
  return `${t} ${who}${m.type === 'explorar' || m.type === 'encontrar' ? '' : 'en '}B${m.floor}F de ${d}  (${m.pokes} P · +${m.rankPts} rango)`;
};
async function call(path, body) {
  state.busy = true; render();
  try { return await api(path, body); }
  catch (e) { say(e.message); return null; }
  finally { state.busy = false; render(); }
}
const canLeaderChoice = () => rankOf(meta.rankPts) >= CFG.leaderChoiceRank;

// =====================================================================
// ARRANQUE
// =====================================================================
export async function startGame(me) {
  window.__mmState = state; // referencia de depuración (pruebas automáticas)
  initScenes({ state, render, openDialog, beds: () => HUB.descanso.beds, drawItem: (c, name, x, y, size) => drawItemIcon(c, name, x, y, size), music: key => key ? playTrack(key) : playZone(state.hub.area), sprites: Sprites, speciesName: sp => SPECIES[sp]?.name || (sp ? sp[0].toUpperCase() + sp.slice(1) : sp), uis: UIS, sfx: n => { try { playSfx(n); } catch {} } });
  window.__mmPlayScene = id => { const sc = SCENES_ALL().find(s => s.id === id); return sc ? playScene(sc) : Promise.resolve(); };
  setupScaleSelector(); requestAnimationFrame(applyScale);
  window.__mmPause = () => pauseRun(); window.__mmResume = () => resumeRun();
  window.__mmHUB = HUB; window.__mmLastCam = () => lastCam; window.__mmOpenMain = () => openDungeonMainMenu(); window.__mmTalk = k => talkTo(k); window.__mmSees = (e, t) => enemySees(e, t); window.__mmEnemyTurn = e => enemyTurn(e); window.__mmCall = (p, b) => call(p, b); window.__mmTileAt = (x, y) => tileAtScreen(x, y); window.__mmSpecies = sp => SPECIES[sp]; window.__mmKeeper = () => openKeeperMenu(); window.__mmTmFor = sp => { const ok = TM_POOL.find(m => canLearnMachine(sp, m) && MOVES[m]?.power), no = TM_POOL.find(m => !canLearnMachine(sp, m)); return ok ? { ok, no } : null; }; window.__mmCFG = CFG; window.__mmShopCfg = SHOP_IN_DUNGEON; window.__mmTryRecruit = e => tryRecruit(e, state.player); window.__mmNewFloor = () => newFloor(); window.__mmOfferMove = (m, perm) => offerMove(m, perm); window.__mmStartRun = def => startRun(def); window.__mmDungeonById = id => dungeonById(id); window.__mmTilesetOf = () => currentTileset()?.set; window.__mmAbandon = () => endRun('exit'); window.__mmSprites = () => Sprites; window.__mmOpenDialog = (p, cb) => openDialog(p, cb); window.__mmStages = (m, c) => applyStages(m, c);
  window.__mmGainExp = (m, n) => gainExp(m, n); window.__mmExpToNext = expToNext; window.__mmBag = () => openBagMenu(); window.__mmIconOf = t => itemInText(t);
  window.__mmItems = ITEMS; window.__mmRefreshBag = () => refreshBagEffects(); window.__mmApplyStatus = (m, k) => applyStatus(state.rng, m, k, 1); window.__mmSummary = m => openSummary(m); window.__mmWalk = (x, y) => walkableFor(state.player, x, y) && !occupied(x, y);
  window.__mmLegFloor = () => CFG.legendaryEvery; window.__mmPickUp = gi => pickUp(gi); window.__mmCheckShop = () => checkShopExit(); window.__mmUpdateVis = () => updateVisibility(); window.__mmIsVisible = (x, y) => isVisibleNow(x, y); window.__mmCreate = (s, l) => createMon(s, l);
  window.__mmDefeat = (e, by) => defeatEnemy(e, by); window.__mmMoves = MOVES; window.__mmSlot = i => useMoveSlot(i); window.__mmAct = (k, dx, dy) => playerAction(k, dx, dy); window.__mmPath = (to) => dungeonPath(state.player, to); window.__mmUseItem = i => useItem(i); window.__mmDescend = () => descend(); window.__mmPassing = () => !!passTimer; window.__mmEndTurn = () => endTurn(false);
  window.__mmVisibleNpcs = () => HUB[state.hub.area].npcs.filter(n => npcShown(n) && !n.hidden).map(n => n.id); window.__mmHubPath = hubPath; window.__mmHubFree = hubFree; window.__mmGetMeta = () => meta; window.__mmEndRun = o => endRun(o); // pruebas automáticas
  window.__mmPending = t => pendingScene(meta, t)?.id || null;   // (pruebas: qué escena toca)
  window.__mmDebug = { defeat: () => downed(state.player), dungeons: () => openDungeonMenu(),
    // tienda de prueba: alfombra 3×3 alrededor del jugador y una Semilla Revivir a su derecha
    testShop: () => { const p = state.player, carpet = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { state.dungeon.tiles[p.y + dy][p.x + dx] = T.FLOOR; carpet.push({ x: p.x + dx, y: p.y + dy }); }
      state.dungeon.tiles[p.y][p.x + 2] = T.FLOOR; state.shop = { carpet, unpaid: [], keeper: { x: p.x, y: p.y - 1 }, room: roomOf(p) || { x: p.x - 1, y: p.y - 1, w: 3, h: 3 }, robbed: false };
      state.enemies = []; state.groundItems = [{ name: 'Semilla Revivir', x: p.x + 1, y: p.y, shop: true, price: 600 }]; render(); } };
  user = me.user; meta = me.user.meta; state.pausedRun = me.run;
  try {   // reinicio general: el navegador olvida también lo suyo (frases de la historia oídas, avisos, copias de seguridad)
    const ek = `pmdt_epoch_${user.name}`, ep = String(meta.epoch || 0);
    if (localStorage.getItem(ek) !== ep && meta.epoch) {
      for (const k of [`pmdt_story_${user.name}`, `pmdt_fuente_${user.name}`, 'mm_hub', 'pmdt_run_backup', 'pmdt_pending_end']) localStorage.removeItem(k);
    }
    localStorage.setItem(ek, ep);
  } catch {}
  sessionStart = Date.now(); track('session_start', { ...deviceInfo(), mode: 'servidor', rank: rankOf(meta.rankPts || 0), starter: meta.starters?.[0] }); flushTelemetry();
  state.waitingRescue = !!me.rescue;
  if (me.mailNews && !me.rescue) { const news = (tries = 0) => { if (state.scene === 'hub' && !state.dialog && !state.menu) openDialog([{ who: 'Murkrow', sp: 'murkrow', mood: 'Joyous', text: '¡Crrraaa! ¡Tienes correo! Pásate por el buzón de la plaza.' }]); else if (tries < 10) setTimeout(() => news(tries + 1), 1500); }; setTimeout(news, 1200); }
  if (me.rescue) setTimeout(() => showRescueWait(me.rescue), 300);   // tu equipo sigue esperando un rescate
  if (pendingEnd()) flushPendingEnd();   // un resultado que no llegó la última vez (se envía solo)
  document.getElementById('hud-user').textContent = user.name;
  saveLastSeen();   // para la tarjeta «Continuar mi aventura» de la pantalla de inicio
  await Sprites.load();
  bindInput();
  if (!meta.tutorialDone) { state.hub.area = 'plaza'; Object.assign(state.hub, { x: 404, y: 262, facing: [1, -1] }); state.hub.introChatot = true; }   // Chatot te espera en la entrada
  enterHub({ noScenes: true });
  if (!meta.tutorialDone) tutorial(); else say(`Bienvenido de nuevo, ${user.name}.`);
  await hubAssetsReady();   // la pantalla de carga se quita cuando la aldea y los sprites de la zona están descargados
  setTimeout(() => playPendingScenes(), 250);   // las escenas que toquen, ya con la aldea a la vista
}
// Lo que enseña la tarjeta de la pantalla de inicio (nombre, Pokémon, nivel y Pokés), guardado en el navegador
function saveLastSeen() {
  try { const sp = meta.starters?.[0]; localStorage.setItem('mm_last', JSON.stringify({ name: user.name, species: sp, speciesName: SPECIES[sp]?.name || sp, level: meta.progress?.[sp]?.level || CFG.startLevel, pokes: meta.pokes || 0 })); } catch {}
}
// ¿Están descargados la imagen de la zona y los sprites de tu personaje y de los vecinos a la vista? (máximo 8 s)
function hubAssetsReady() {
  const t0 = performance.now();
  const ready = () => {
    const area = Hub.view(state.hub.area), def = HUB[state.hub.area]; if (!area?.img?.complete) return false;
    const keys = [state.player?.species, ...(def?.npcs || []).filter(n => npcShown(n) && !n.hidden).map(n => n.id), ...(state.hub.wanderers || []).map(w => w.species)].filter(Boolean);
    return keys.every(k => { const m = Sprites.mons[k]; if (!m) return true; if (!m.requested) Sprites.ensure(m); return !!(m.sheetImg && (m.idleImg || !m.idle)); });
  };
  return new Promise(res => { const tick = () => { render(); if (ready() || performance.now() - t0 > 8000) res(); else setTimeout(tick, 100); }; tick(); });
}

// =====================================================================
// DIÁLOGOS (cuadro de texto estilo PMD en el canvas)
// =====================================================================
function openDialog(pages, onDone) { state.feed = []; state.dialog = { pages, i: 0, onDone }; state.tutorialFocus = pages[0]?.focus || null; render(); }
// Diálogo del guardián Mega: bloquea el combate hasta cerrarlo; tras N turnos-diálogo, o al cerrarlo, empieza a atacar.
function megaEncounter(e) {
  if (e.megaMet) return; e.megaMet = true;
  const dlg = MEGA_DIALOG[e.species]; if (!dlg) return;
  openDialog(dlg.intro.map(t => ({ who: e.name, text: t, font: dlg.font, color: dlg.color })), () => { if (dlg.behavior !== 'flee') e.megaHostile = true; });
}
// =====================================================================
// TUTORIAL: Chatot te lleva andando por el gremio y la aldea, parando en cada sitio, y acaba en la
// entrada a las mazmorras. Tú le sigues (control bloqueado en los trayectos). Start lo termina.
// =====================================================================
const FOOT = [[-6, 0], [6, 0], [0, 2]];
const hubFree = (area, x, y) => FOOT.every(([ox, oy]) => Hub.walkable(area, x + ox, y + oy));
// camino por el suelo transitable (búsqueda en anchura sobre una rejilla de 6 px)
// Coste del terreno en las zonas de exterior: los caminos de tierra cuestan poco y la hierba bastante más, para que
// quien anda por la aldea vaya por los caminos (como lo haría cualquiera) y solo ataje si ahorra mucho.
const PATH_AREAS = new Set(['plaza', 'mercado', 'aldea', 'fuente']), costGrids = new Map();
function costGrid(area) {
  if (!PATH_AREAS.has(area)) return null;
  if (costGrids.has(area)) return costGrids.get(area);
  const img = Hub.view(area)?.img; if (!img?.complete || !img.naturalWidth) return null;
  const S = 6, W = Math.floor(768 / S), H = Math.floor(515 / S), cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, cv.width, cv.height).data;
  const isPath = (x, y) => { const i = (y * cv.width + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2]; return r >= gg && r - b > 45 && r > 120; };   // tierra y arena
  const grid = new Uint8Array(W * H);
  for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
    let n = 0; for (const dx of [1, 3, 5]) for (const dy of [1, 3, 5]) { const x = cx * S + dx, y = cy * S + dy; if (x < cv.width && y < cv.height && isPath(x, y)) n++; }
    grid[cy * W + cx] = n >= 6 ? 1 : 2.5 * 2 | 0;   // hierba: algo más del doble que el camino (se ataja solo si compensa)
  }
  costGrids.set(area, grid); return grid;
}
// camino por el suelo transitable, sobre una rejilla de 6 px (con el coste del terreno: prefiere los caminos)
function hubPath(area, from, to) {
  const S = 6, W = Math.floor(768 / S), H = Math.floor(515 / S), key = (x, y) => y * W + x;
  const cell = p => [Math.round(p.x / S), Math.round(p.y / S)];
  const ok = (cx, cy) => cx >= 0 && cy >= 0 && cx < W && cy < H && hubFree(area, cx * S, cy * S);
  let [tx, ty] = cell(to);
  if (!ok(tx, ty)) { let best = null; for (let r = 1; r < 20 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) if (ok(tx + dx, ty + dy)) { best = [tx + dx, ty + dy]; break; } if (best) [tx, ty] = best; }
  const cost = costGrid(area), [sx, sy] = cell(from);
  const dist = new Float64Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-2), heap = [];   // Dijkstra con un montículo binario
  const push = (k, d) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const k0 = key(sx, sy), kt = key(tx, ty); dist[k0] = 0; prev[k0] = -1; push(k0, 0);
  while (heap.length) {
    const [d0, k] = pop(); if (d0 > dist[k]) continue; if (k === kt) break;
    const x = k % W, y = Math.floor(k / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy; if (!ok(nx, ny) || (dx && dy && (!ok(x + dx, y) || !ok(x, y + dy)))) continue;
      const nk = key(nx, ny), step = (dx && dy ? 1.414 : 1) * (cost ? cost[nk] : 1), nd = d0 + step;
      if (nd < dist[nk]) { dist[nk] = nd; prev[nk] = k; push(nk, nd); }
    }
  }
  if (prev[kt] === -2) return [{ x: to.x, y: to.y }];
  const path = []; for (let k = kt; k !== -1; k = prev[k]) path.push({ x: (k % W) * S, y: Math.floor(k / W) * S });
  path.reverse();
  // estirar en tramos rectos (los mínimos giros): un tramo recto solo vale si no pisa nada y no cuesta más (en terreno)
  // que el trozo de ruta que sustituye; así se ahorran giros sin salirse del camino
  const cAt = (x, y) => cost ? cost[Math.min(H - 1, Math.max(0, Math.round(y / S))) * W + Math.min(W - 1, Math.max(0, Math.round(x / S)))] : 1;
  const acc = [0]; for (let k = 1; k < path.length; k++) acc.push(acc[k - 1] + Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y) * cAt(path[k].x, path[k].y));
  const straight = (i, j) => { const p = path[i], q = path[j], L = Math.hypot(q.x - p.x, q.y - p.y), n = Math.max(2, Math.ceil(L / 3)); let c = 0;
    for (let k = 1; k <= n; k++) { const x = p.x + (q.x - p.x) * k / n, y = p.y + (q.y - p.y) * k / n; if (!hubFree(area, Math.round(x), Math.round(y))) return false; c += L / n * cAt(x, y); }
    return c <= (acc[j] - acc[i]) * 1.03 + 1; };
  const out = [path[0]]; let i = 0;
  while (i < path.length - 1) { let j = path.length - 1; while (j > i + 1 && !straight(i, j)) j--; out.push(path[j]); i = j; }
  return out;
}
const tourSkipped = () => !state.tour || state.tour.skip;
function tourSay(pages) { return new Promise(res => { if (tourSkipped()) return res(); openDialog(pages.map(p => typeof p === 'string' ? { who: 'Chatot', text: p } : p), res); }); }
// Chatot camina hasta un punto; tú le sigues por su rastro, unos pasos por detrás
function tourWalk(tx, ty) {
  return new Promise(res => {
    const t = state.tour, gd = t.guide, h = state.hub;
    if (tourSkipped()) return res();
    const path = hubPath(gd.area, gd, { x: tx, y: ty }); let i = 0, last = performance.now();
    const step = now => {
      if (tourSkipped()) return res();
      let budget = Math.min(60, now - last) * 0.12; last = now;          // ~120 px/s
      while (budget > 0 && i < path.length) {
        const p = path[i], dx = p.x - gd.x, dy = p.y - gd.y, d = Math.hypot(dx, dy);
        if (d <= budget) { gd.x = p.x; gd.y = p.y; budget -= d; i++; } else { gd.x += dx / d * budget; gd.y += dy / d * budget; budget = 0; }
        if (d > 0.01) gd.facing = [Math.sign(Math.round(dx)), Math.sign(Math.round(dy))];
      }
      gd.movedAt = now;
      t.trail.push({ x: gd.x, y: gd.y });                                 // el jugador pisa por donde pasó Chatot
      if (t.trail.length > 16) { const q = t.trail.shift(), mx = q.x - h.x, my = q.y - h.y; if (Math.hypot(mx, my) > 0.3) { h.facing = [Math.sign(Math.round(mx)), Math.sign(Math.round(my))]; h.movedAt = now; } h.x = q.x; h.y = q.y; }
      render();
      if (i >= path.length) return res();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
// cambio de zona durante el recorrido: fundido y los dos aparecen juntos
async function tourArea(to, playerAt, guideAt) {
  if (tourSkipped()) return;
  const t = state.tour, h = state.hub;
  blink(); await sleep(160);
  h.area = to; Object.assign(h, playerAt); spawnWanderers();
  Object.assign(t.guide, { area: to, ...guideAt }); t.trail = [];
  h.facing = [Math.sign(guideAt.x - playerAt.x), Math.sign(guideAt.y - playerAt.y)];
  render(); await sleep(220);
}
const tourFace = (fx, fy) => { const g = state.tour?.guide; if (g) { g.facing = [fx, fy]; render(); } };

async function tutorial(skipAsk = false) {
  const h = state.hub, fromDoor = h.area === 'plaza' && h.introChatot;
  const want = skipAsk || await new Promise(res => openDialog([{ who: 'Chatot', text: fromDoor ? `¡Bienvenido al Gremio de Pidgeot, ${user.name}! ¿Quieres que te enseñe las instalaciones?` : `¿Quieres que te enseñe otra vez las instalaciones, ${user.name}?` }],
    () => openMenu({ title: 'Chatot', items: ['¡Sí, por favor!', 'Ya lo conozco'], onSelect: i => res(i === 0), onCancel: () => res(false) })));
  if (!want) return tourDone(true);
  held.clear();
  if (fromDoor) {
    // Chatot, desde la entrada, te lleva andando dentro del gremio
    state.tour = { guide: { area: 'plaza', x: 446, y: 226, facing: [-1, 1] }, trail: [], skip: false };
    await tourSay([`¡Perfecto! Sígueme, ${user.name}. Y no te quedes atrás, que el gremio es muy grande.`]);
    await tourWalk(384, 196);
    await tourArea('gremio', { x: 405, y: 466 }, { x: 405, y: 440 });
  } else {
    if (h.area !== 'gremio') { blink(); await sleep(160); h.area = 'gremio'; Object.assign(h, { x: 405, y: 340 }); spawnWanderers(); }
    state.tour = { guide: { area: 'gremio', x: 440, y: 230, facing: [0, 1] }, trail: [], skip: false };
    await tourSay([`¡Muy bien! Sígueme, ${user.name}.`]);
  }
  h.introChatot = false; render();
  // 1) tablón
  await tourWalk(400, 226); tourFace(0, -1);
  await tourSay(['Este es el tablón de misiones. Aquí llegan peticiones de ayuda de toda la región.',
                 'Eso sí: solo verás las de mazmorras que ya hayas explorado. ¡Nada de ir a ciegas!']);
  // 2) despacho y Mawile
  await tourWalk(512, 286); tourFace(1, -1);
  await tourSay(['Y ese es el despacho del maestro Pidgeot. Mawile vigila la puerta.',
                 'Si algún día llegas a rango Diamante, quizá… QUIZÁ… el maestro te reciba. Está siempre muy ocupado.']);
  // 3) zona de descanso
  await tourSay(['Ahora subamos. Arriba, en el nido del gremio, es donde se descansa.']);
  await tourWalk(200, 214);
  await tourArea('descanso', { x: 372, y: 288 }, { x: 398, y: 304 });
  await tourWalk(522, 322); tourFace(0, -1);
  await tourSay([{ who: 'Chansey', text: '¡Hola! Yo me encargo de que los exploradores se recuperen. Si os pasa algo ahí fuera, aquí os espero.' },
                 'Aquí volverás después de cada expedición.',
                 'Y si caes en una mazmorra, alguien te traerá hasta aquí… y Chansey te pondrá en pie. ¡Mejor no tener que usarlo!']);
  await tourWalk(322, 266);
  await tourArea('gremio', { x: 200, y: 252 }, { x: 226, y: 270 });
  // 4) plaza y Diglett
  await tourSay(['Bajemos, que aún queda mucho por ver. ¡A la plaza!']);
  await tourWalk(405, 500);
  await tourArea('plaza', { x: 384, y: 226 }, { x: 384, y: 252 });
  tourFace(0, -1);
  await tourSay(['¿Ves esa bandeja junto a la puerta? Ahí se deja todo lo que sea para el maestro. Y NADIE la toca. Es mi bandeja.', 'Diglett vigila la entrada del gremio desde su túnel. Ya os conocéis, ¿verdad?',
                 { who: 'Diglett', text: '¡Huella registrada! ¡Bienvenido, bienvenido!' }]);
  // 5) mercado
  await tourSay(['Ahora, el mercado. ¡Por aquí!']);
  await tourWalk(12, 265);
  await tourArea('mercado', { x: 720, y: 290 }, { x: 694, y: 296 });
  await tourWalk(372, 292); tourFace(0, -1);
  await tourSay(['Este Kecleon te compra lo que traigas de las mazmorras. Perlas, pepitas… ¡todo lo que brille vale Pokés!']);
  await tourWalk(252, 366); tourFace(0, -1);
  await tourSay(['Y su hermano te vende bayas, semillas, orbes y objetos para equipar. Cambia el género a menudo, ¡pásate de vez en cuando!']);
  await tourWalk(540, 264); tourFace(0, -1);
  await tourSay(['Kangaskhan guarda tus objetos y tus Pokés. Lo que dejes aquí no se pierde aunque caigas en una mazmorra.']);
  await tourWalk(462, 414); tourFace(1, 0);
  await tourSay(['Y en esa cabaña vive Gulpin: te ayuda a recordar u olvidar movimientos. Algo tragón, pero de fiar.', { who: 'Gulpin', text: '…Gulp.' }]);
  // 6) aldea
  await tourSay(['Ahora, la aldea. ¡Sígueme!']);
  await tourWalk(758, 292);
  await tourArea('plaza', { x: 52, y: 266 }, { x: 78, y: 268 });
  await tourWalk(384, 500);
  await tourArea('aldea', { x: 384, y: 50 }, { x: 384, y: 76 });
  await tourWalk(300, 332); tourFace(-1, 0);
  await tourSay(['Ese es Wobbuffet. No te molestes en preguntarle nada.', { who: 'Wobbuffet', text: '¡Wobbuffet!' }, '…¿Lo ves?']);
  // 7) entrada a las mazmorras
  await tourWalk(384, 450); tourFace(0, 1);
  await tourSay(['Y aquí termina el recorrido. Por este sendero se sale a explorar las mazmorras.',
                 'Empieza por el Campo de Entrenamiento: es la mazmorra para los nuevos. Cinco pisos… y al final, una sorpresa. ¡Ejem!',
                 'Después vendrá el Bosque Frondoso. En las mazmorras largas, cada 10 pisos podrás decidir si sigues adelante o vuelves.',
                 `Si tienes dudas, búscame en el gremio, junto al tablón. ¡Espero mucho de ti, ${user.name}! ¡Por el honor del gremio!`]);
  // Chatot vuelve al gremio caminando
  if (state.tour && !state.tour.skip) { state.tour.trail = []; state.tour.follow = false; const g = state.tour.guide; state.tour.noFollow = true; await tourWalkAlone(384, 20); }
  tourDone(false);
}
// Chatot se marcha solo (el jugador ya no le sigue)
function tourWalkAlone(tx, ty) {
  return new Promise(res => {
    const gd = state.tour.guide, path = hubPath(gd.area, gd, { x: tx, y: ty }); let i = 0, last = performance.now();
    const step = now => {
      if (!state.tour) return res();
      let budget = Math.min(60, now - last) * 0.14; last = now;
      while (budget > 0 && i < path.length) { const p = path[i], dx = p.x - gd.x, dy = p.y - gd.y, d = Math.hypot(dx, dy); if (d <= budget) { gd.x = p.x; gd.y = p.y; budget -= d; i++; } else { gd.x += dx / d * budget; gd.y += dy / d * budget; budget = 0; } if (d > 0.01) gd.facing = [Math.sign(Math.round(dx)), Math.sign(Math.round(dy))]; }
      gd.movedAt = now; render();
      if (i >= path.length) return res();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
async function tourDone(declined) {
  const skipped = state.tour?.skip;
  if (!declined) state.hub.introChatot = false;   // tras el recorrido, Chatot ya está dentro
  state.tour = null; state.tutorialFocus = null; held.clear();
  if (declined) await new Promise(res => openDialog([{ who: 'Chatot', text: state.hub.introChatot ? '¡Como quieras! Estaré por aquí un rato… y luego dentro del gremio, junto al tablón.' : '¡Como quieras! Si cambias de idea, ya sabes dónde encontrarme.' }], res));
  else if (skipped) say('Recorrido terminado. Chatot vuelve al gremio.');
  if (!meta.tutorialDone) {
    meta.tutorialDone = true; const r = await call('/tutorial/done', {});
    if (r?.meta) meta = r.meta;
    if (r?.gift) await new Promise(res => openDialog([   // el regalo de Chatot (a escondidas del maestro)
      { who: 'Chatot', sp: 'chatot', mood: 'Normal', text: '¡Ah! Antes de que te vayas, Recluta…' },
      { who: 'Chatot', sp: 'chatot', mood: 'Happy', text: 'Toma. Una Manzana, recién salida de la despensa del gremio.' },
      { who: '', text: '¡Has recibido una Manzana!' },
      { who: 'Chatot', sp: 'chatot', mood: 'Worried', text: 'Pero ni una palabra al maestro Pidgeot, ¿eh? Esto no ha pasado.' },
      { who: 'Chatot', sp: 'chatot', mood: 'Inspired', text: 'Y ya que estamos… Nos ha llegado un cargamento de Bayas Aranja y, qué cosas, han sobrado dos.' },
      { who: '', text: '¡Has recibido dos Bayas Aranja!' },
      { who: 'Chatot', sp: 'chatot', mood: 'Normal', text: 'Las Bayas Aranja curan un poco de salud. ¡No las malgastes!' },
    ], res));
  }
  closeHub(); render();
}

// =====================================================================
// ESCENA: BASE
// =====================================================================
function enterHub(opts = {}) {
  state.scene = 'hub'; state.menu = null; state.dead = false; state.enemies = []; state.team = []; state.npcs = []; state.effects = []; state.run = null;
  if (!state.player) state.player = createPlayer(meta.starters[0]);
  const h = state.hub; if (!h.area) { h.area = 'plaza'; Object.assign(h, HUB.plaza.spawn); }
  spawnWanderers(); render(); hubLoop();
  if (opts.noScenes) hubExtras(); else playPendingScenes().then(hubExtras);   // (al volver de una mazmorra, las escenas esperan al informe)
}
// Las escenas de historia que toquen, una detrás de otra (la noche → la sombra → el despertar)
async function playPendingScenes(fromRun = false) {
  if (!user || state.tour) return;
  const nextOne = () => (fromRun && pendingScene(meta, 'return')) || pendingScene(meta);   // al volver de una mazmorra, también las de «a la vuelta»
  let next = nextOne(); if (!next) return;
  await whenIdle();   // nunca encima de un aviso o un menú abierto
  if (!user || state.tour || state.scene !== 'hub') return;
  state.sceneChain = true;   // varias seguidas: entre una y otra, la pantalla se queda en negro
  try { while (next && state.scene === 'hub' && !state.cut && !state.dcut) { await runScene(next); next = nextOne(); } }   // (si entras en una mazmorra, se queda para la próxima vez)
  finally { state.sceneChain = false; await releaseBlack(); }
}
const whenIdle = () => new Promise(res => { const t = () => (!state.dialog && !state.menu && !state.busy ? res() : setTimeout(t, 150)); t(); });
// escena de historia: se reproduce, se marca como vista en el servidor y se enseña una sola vez
async function runScene(sc) {
  let res = null; try { res = await playScene(sc); } catch (e) { console.error(e); }
  if (res?.aborted) return;   // no se ha llegado a ver: no se marca
  (meta.scenes ||= []).includes(sc.id) || meta.scenes.push(sc.id);
  try { const r = await api('/scene/seen', { id: sc.id }); if (r?.meta) meta = r.meta; } catch {}
  track('scene', { id: sc.id, skipped: !!res?.skipped });
}
function hubExtras() {
  checkSpecialDay(); checkMyRescue();
  setTimeout(() => { if (!state.dialog && !state.menu) fountainNews(); }, 700);
  if (state.mailArrived) { const news = (tries = 0) => { if (state.scene !== 'hub') return; if (!state.dialog && !state.menu && !document.querySelector('.penalty-report')) { state.mailArrived = false; openDialog([{ who: 'Murkrow', sp: 'murkrow', mood: 'Joyous', text: '¡Crrraaa! ¡Te ha llegado una carta mientras estabas fuera! Pásate por el buzón de la plaza.' }]); } else if (tries < 20) setTimeout(() => news(tries + 1), 1500); }; setTimeout(news, 1500); }
  if (state.pausedRun) openMenu({ title: `Tienes una exploración a medias en ${dungeonById(state.pausedRun.dungeonId).name}`, items: ['Continuar ahora', 'Más tarde'], onSelect: i => { if (i === 0) resumeRun(); } });
}

const closeHub = () => { state.menu = null; render(); };
// Menú general (S / Tab) — lo demás se hace hablando con cada PNJ
function openHubMenu() {
  const save = state.pausedRun;
  // elegir líder se hará hablando con el Pokémon en la aldea (como en Rojo/Azul), no desde este menú
  const items = save ? ['Continuar la exploración', 'Abandonar la exploración guardada', 'Rango y progreso', 'Registro de mensajes', 'Cerrar'] : ['Rango y progreso', 'Registro de mensajes', 'Cerrar'];
  openMenu({ title: 'Menú', items, onCancel: closeHub, onSelect: async i => {
    const key = items[i];
    if (key === 'Continuar la exploración') return resumeRun();
    if (key === 'Registro de mensajes') return openHistory();
    if (key.startsWith('Abandonar')) return openMenu({ title: '¿Abandonar la exploración? Perderás lo acumulado.', items: ['No', 'Sí, abandonar'], onCancel: closeHub, onSelect: async j => { if (j === 1) { const r = await call('/run/abandon', {}); if (r) { meta = r.meta; state.pausedRun = null; say('Run abandonada.'); } } closeHub(); } });
    if (key === 'Rango y progreso') return openRankMenu();
    if (key === 'Elegir líder') return openStarterMenu();
    closeHub();
  } });
}
// ---- movimiento libre por la aldea
let hubRaf = null;
function getUpFromBed() {   // te incorporas: dejas de estar tumbado y ya puedes andar desde la cama
  const h = state.hub; if (!h.inBed || state.menu || state.dialog || state.busy) return;
  h.inBed = null; h.movedAt = performance.now(); render();
}
function hubLoop() {
  cancelAnimationFrame(hubRaf);
  const step = () => {
    if (state.scene !== 'hub') return;
    const h = state.hub, area = HUB[h.area];
    if (h.inBed && [...held].some(k => ['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(k))) getUpFromBed();
    tickScenes();
    if (!state.menu && !state.dialog && !state.busy && !state.tour && !h.inBed && !state.cut) {   // durante el tutorial no te mueves tú: sigues a Chatot
      let dx = 0, dy = 0;
      if (held.has('UP')) dy -= 1; if (held.has('DOWN')) dy += 1; if (held.has('LEFT')) dx -= 1; if (held.has('RIGHT')) dx += 1;
      if (dx || dy) {
        h.facing = [dx, dy]; const run = held.has('B') ? 2 : 1, sp = (dx && dy ? 1.3 : 1.8) * run; // mantener B (X) = correr
        const tryMove = (mx, my) => { const nx = h.x + mx, ny = h.y + my; if ([[-6, 0], [6, 0], [0, 2]].every(([ox, oy]) => Hub.walkable(h.area, nx + ox, ny + oy)) && !npcAtHub(nx, ny)) { h.x = nx; h.y = ny; return true; } return false; };
        if (!tryMove(dx * sp, dy * sp)) { tryMove(dx * sp, 0) || tryMove(0, dy * sp); }
        h.movedAt = performance.now();
        for (const ex of area.exits) if (inExit(ex, h.x, h.y)) { held.clear(); if (ex.action === 'dungeons') { if (ex.back) Object.assign(h, ex.back); h.facing = [0, 1]; const sc = user && !state.tour && pendingScene(meta, 'dungeon-exit'); if (sc) runScene(sc).then(() => openDungeonMenu()); else openDungeonMenu(); } else { blink(); h.area = ex.to; Object.assign(h, ex.at); h.introChatot = false; spawnWanderers(); fountainNews(); const asc = user && !state.tour && pendingScene(meta, 'area:' + h.area); if (asc) setTimeout(() => runScene(asc), 350); } break; }   // al irte de la plaza, Chatot entra en el gremio
      }
    }
    h.t++; if (h.t % 2 === 0) moveWanderers();
    render();
    hubRaf = requestAnimationFrame(step);
  };
  hubRaf = requestAnimationFrame(step);
}
const inRect = (x, y, [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const npcShown = n => !(n.intro && !(state.hub.introChatot && !state.tour)) && !(state.tour && n.id === 'chatot')
  && !(n.untilRank !== undefined && rankOf(meta?.rankPts || 0) >= n.untilRank) && !(n.fromRank !== undefined && rankOf(meta?.rankPts || 0) < n.fromRank)
  && !(n.afterScene && !(meta?.scenes || []).includes(n.afterScene));   // personajes que llegan con una escena (Sneasel)   // personajes que solo están hasta (o desde) cierto rango
const npcAtHub = (x, y) => [...HUB[state.hub.area].npcs.filter(n => npcShown(n) && !n.hidden), ...state.hub.wanderers].some(n => Math.abs(n.x - x) < 14 && Math.abs(n.y - y) < 10);
function spawnWanderers() {
  const area = HUB[state.hub.area], h = state.hub; h.wanderers = [];
  if (!area.wanderers) return;
  const pool = ['pidgey', 'rattata', 'oddish', 'sentret', 'hoothoot', 'marill', 'wooper', 'eevee', 'pikachu', 'psyduck'].filter(s => SPECIES[s]);
  for (let i = 0; i < area.wanderers; i++) { for (let t = 0; t < 40; t++) { const x = 60 + Math.random() * 640, y = 60 + Math.random() * 400; if (Hub.walkable(h.area, x, y) && !inRect(x, y, [330, 0, 440, 515])) { h.wanderers.push({ species: pool[(Math.random() * pool.length) | 0], x, y, facing: [0, 1], wait: 0, dir: [0, 0] }); break; } } }
}
function moveWanderers() {
  const h = state.hub;
  for (const w of h.wanderers) {
    if (w.wait > 0) { w.wait--; continue; }
    if (!w.dir[0] && !w.dir[1] || Math.random() < 0.02) { w.dir = Math.random() < 0.35 ? [0, 0] : DIRS8[(Math.random() * 8) | 0]; w.wait = w.dir[0] || w.dir[1] ? 0 : 30 + Math.random() * 60; if (w.dir[0] || w.dir[1]) w.facing = w.dir; }
    const nx = w.x + w.dir[0], ny = w.y + w.dir[1];
    // por los caminos: si va por la tierra y el paso le saca a la hierba, casi siempre cambia de rumbo
    const cg = costGrid(h.area), cell = (x, y) => cg ? cg[Math.floor(y / 6) * Math.floor(768 / 6) + Math.floor(x / 6)] : 1;
    const leavesPath = cg && cell(w.x, w.y) === 1 && cell(nx, ny) > 1 && Math.random() < 0.9;
    if (!leavesPath && Hub.walkable(h.area, nx, ny) && Math.hypot(nx - h.x, ny - h.y) > 20) { w.x = nx; w.y = ny; w.movedAt = performance.now(); } else w.dir = [0, 0];
  }
}
// Interacción (A = Z): PNJ delante, carteles o zonas activas
// Frases de los tenderos al hablar con ellos (rotan por turnos), y después su menú
const KECLEON_GREEN_LINES = ['¡Bienvenido, bienvenido! Mira, mira: género fresco de esta misma mañana.', '¿Semillas? ¿Bayas? ¿Un orbe para salir del apuro? ¡Kecleon lo tiene todo!', 'Mi hermano compra, yo vendo. Somos un equipo… aunque yo trabajo más, no se lo digas.', '¡Un explorador prevenido vale por dos! ¿Qué te pongo?'];
const KECLEON_PURPLE_LINES = ['¿Qué me traes hoy? Perlas, pepitas, tesoros olvidados… ¡Todo lo que brilla vale Pokés!', 'Mi hermano habla demasiado. Yo prefiero que hablen los objetos. Enséñamelos.', 'Pago bien. No tanto como me gustaría a mí, ni tanto como te gustaría a ti. Un trato justo.', 'Si encuentras algo raro en una mazmorra, no lo tires. Tráemelo.'];
const KANGASKHAN_LINES = ['¡Hola, cielo! ¿Guardamos algo a buen recaudo?', 'Lo que dejes conmigo no se pierde ni aunque te pase algo ahí fuera. Palabra de madre.', 'Mi pequeño dice que quiere ser explorador como tú. Todavía no sabe ni abrir una semilla.', '¿Has comido bien? En las mazmorras se pasa hambre, hazme caso.'];
const GULPIN_LINES = ['…Gulp.', '¿Eh? Ah. Movimientos. Sí, sí… ¿qué querías?', '…Ñam. …¿Decías algo?'];
// Murkrow, el cartero del gremio (junto al buzón de la plaza). También firma los anuncios del juego en Discord.
const MURKROW_LINES = [
  '¡Crrraaa! Soy Murkrow, el cartero del gremio. Si te llega algo, lo guardo en este buzón hasta que pases a por ello.',
  '¡Crrraaa! Cuando tengas correo, serás el primero en saberlo. ¡Palabra de cartero!',
  'Las noticias vuelan, y yo con ellas. ¡Crrraaa! Si pasa algo en el gremio, me enteraré antes que nadie.',
  '¿Sabías que llevo las novedades del gremio a todos los rincones? ¡Crrraaa! Nadie reparte como yo.',
];
// Al completar el Bosque Frondoso se abre el camino a la Fuente: Murkrow da la noticia la primera vez que pasas por la plaza
function fountainNews() {
  if (state.hub?.area !== 'plaza' || !meta?.cleared?.includes('bosque')) return;
  const key = `pmdt_fuente_${user?.name}`; try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch { return; }
  openDialog([{ who: 'Murkrow', sp: 'murkrow', mood: 'Joyous', text: '¡Crrraaa! ¡Noticias frescas! Han abierto un camino a la derecha de la plaza…' },
    { who: 'Murkrow', sp: 'murkrow', mood: 'Normal', text: 'Dicen que lleva a una fuente muy antigua. Y que alguien espera allí desde hace muchísimo tiempo. ¡Crrraaa!' }]);
}
function npcGreeting(who, lines, key, next, sp) {
  const c = hubCounters(); c[key] = (c[key] || 0) + 1; saveHubCounters(c);
  const portrait = sp || who.toLowerCase();   // sin retrato indicado: el de su especie
  return openDialog([{ who, sp: portrait, text: lines[(c[key] - 1) % lines.length] }], next);
}
function hubInteract() {
  const h = state.hub, area = HUB[h.area], fx = h.x + h.facing[0] * 22, fy = h.y + h.facing[1] * 22;
  // de los que están al alcance, habla el que está más cerca de hacia donde miras (no el primero de la lista)
  const talkScore = n => Math.hypot(n.x - fx, n.y - fy) + (((n.x - h.x) * h.facing[0] + (n.y - h.y) * h.facing[1]) < 0 ? 1000 : 0);   // los que tienes a la espalda, al final
  const npc = [...area.npcs].filter(npcShown).filter(n => (!n.approach || inRect(h.x, h.y, n.approach)) && (Math.hypot(n.x - fx, n.y - fy) < (n.reach ? n.reach - 20 : 24) || Math.hypot(n.x - h.x, n.y - h.y) < (n.reach || 26))).sort((a, b) => talkScore(a) - talkScore(b))[0];
  if (npc) { if (!npc.fixedFacing) npc.facing = [-Math.sign(h.facing[0]), -Math.sign(h.facing[1])]; state.talkNpc = { x: npc.x, y: npc.y, area: h.area }; return talkTo(npc.talk); }
  const w = h.wanderers.find(n => Math.hypot(n.x - fx, n.y - fy) < 20); if (w) return openDialog([{ who: SPECIES[w.species].name, text: WANDER_LINES[(Math.random() * WANDER_LINES.length) | 0] }]);
  for (const s of area.signs || []) if (inRect(fx, fy, s.rect)) return openDialog([{ who: '', text: s.text }]);
  for (const hs of area.hotspots || []) if (inRect(fx, fy, hs.rect) || inRect(h.x, h.y, hs.rect)) return hotspotAction(hs);
  for (const ex of area.exits) if (ex.action === 'dungeons' && inRect(fx, fy, ex.rect)) return openDungeonMenu();
}
const WANDER_LINES = ['¡Buenos días! ¿Eres nuevo en el gremio?', 'Dicen que en el Bosque Frondoso hay un Pokémon verde muy raro.', 'Kecleon sube los precios cada vez que alguien vuelve con una pepita…', 'Mi primo se unió a un equipo de exploración y ya no escribe.', 'Cuidado con las Casas Monstruo. Yo perdí ahí a mi mejor amigo. Bueno, se hizo amigo de ellos.'];
const CHATOT_IDLE = ['Chatot: "Ser la mano derecha del maestro no es fácil, no señor."','Chatot: "El maestro Pidgeot lleva tres dias meditando. Yo creo que duerme."','Chatot: "Sabias que antes repartiamos correo? Otros tiempos."','Chatot: "No toques nada del despacho. Que no. Que no."','Chatot: "Un día me montan un número musical en condiciones."'];
async function checkMyRescue() {
  if (state.waitingRescue) return;   // la pantalla de espera se encarga (si no, se «comería» el aviso de rescate)
  try { const r = await api('/rescue/status'); if (r.rescued) { const me = await api('/me'); state.pausedRun = me.run; openDialog([{ who: '', text: '¡Buenas noticias! ' + r.by + ' te ha rescatado. Puedes continuar tu run desde donde caiste.' }]); } } catch {}
}
async function checkSpecialDay() {
  try { const r = await api('/hub/today'); if (r.special) { say('Hoy: ' + r.special.name + '. ' + r.special.desc); if (r.claimed) { const me = await api('/me'); meta = me.user.meta; } } state.stats = r.stats; state.badges = r.badges; } catch {}
}
function openDiaryMenu() {
  const s = state.stats || {};
  openMenu({ title: 'Diario de exploración', items: [
    'Runs: ' + (s.runs || 0),
    'Pisos explorados: ' + (s.floors || 0),
    'Piso más hondo: ' + (s.deepest || 0),
    'Muertes: ' + (s.deaths || 0),
    'Casas Monstruo vividas: ' + (s.monsterHouses || 0),
    'Pokemon reclutados: ' + (s.recruited || 0),
    'Robos a Kecleon: ' + (s.kecleonRobs || 0),
    'Bandanas: ' + ((state.badges || []).join(', ') || 'ninguna'),
    'Volver'], onCancel: closeHub, onSelect: closeHub });
}
// ---------- historia: frases nuevas al empezar cada capítulo (shared/story.js) ----------
const storySeenKey = () => `pmdt_story_${user?.name}`;
const storySeen = () => { try { return new Set(JSON.parse(localStorage.getItem(storySeenKey())) || []); } catch { return new Set(); } };
function talkTo(kind) {
  const s = storyLineFor(kind, meta, storySeen());
  if (s) {
    const seen = storySeen(); seen.add(`${kind}:${s.chapter}`); try { localStorage.setItem(storySeenKey(), JSON.stringify([...seen])); } catch {}
    const SPK = { shop: ['Kecleon', 'kecleon'], sell: ['Kecleon', 'kecleon_purple'], storage: ['Kangaskhan', 'kangaskhan'], rowlet: ['???', 'rowlet'] };
    const [who, sp] = SPK[kind] || [kind[0].toUpperCase() + kind.slice(1), kind];
    return openDialog(s.pages.map(p => ({ who, sp, mood: p.mood || 'Normal', text: p.text })), s.then ? () => talkToBase(kind) : undefined);
  }
  return talkToBase(kind);
}
// ---------- buzón de Murkrow: las cartas de la historia ----------
const unreadMail = () => (meta.mail || []).filter(x => !x.read && letterById(x.id)).length;   // las cartas que ya no existen no cuentan
function openMailbox() {
  track('ui', { what: 'buzón' });
  const list = [...(meta.mail || [])].filter(x => letterById(x.id)).reverse();   // las más nuevas, arriba
  if (!list.length) return openDialog([{ who: 'Murkrow', sp: 'murkrow', text: '¡Crrraaa! Tu buzón está vacío. Vuelve más tarde.' }]);
  openMenu({ title: `Buzón · ${unreadMail()} sin leer`, items: list.map(x => `${x.read ? '   ' : '✉ '}${letterById(x.id).title}`), onSelect: i => readLetter(list[i].id) });
}
function readLetter(id) {
  const l = letterById(id), x = (meta.mail || []).find(y => y.id === id);
  const pages = l.pages.map(t => ({ who: l.from, ...(l.sp ? { sp: l.sp } : {}), text: t }));
  if (l.murkrow && !x?.read) pages.push({ who: 'Murkrow', sp: 'murkrow', mood: 'Surprised', text: l.murkrow });   // su comentario, la primera vez
  if (x && !x.read) { x.read = true; api('/mail/read', { id }).then(r => { if (r?.mail) meta.mail = r.mail; }).catch(() => {}); }
  openDialog(pages, openMailbox);
}
function talkToBase(kind) {
  switch (kind) {
    case 'mawile':   // guarda la puerta del despacho: solo pasan los de rango Diamante o superior
      if (rankOf(meta.rankPts) < 4) return openDialog([{ who: 'Mawile', sp: 'mawile', mood: 'Worried', text: 'Lo siento, pero el jefe está ocupado. Por normas estipuladas del gremio, solamente gente de rango Diamante o superior pueden acceder de forma directa a su despacho.' }]);
      return openDialog([{ who: 'Mawile', sp: 'mawile', mood: 'Happy', text: `¡Rango Diamante! Adelante, ${user.name}. El jefe te recibirá.` }], () => openPidgeotOffice());
    case 'chatot_intro': return openDialog([{ who: 'Chatot', sp: 'chatot', mood: 'Happy', text: '¿Has cambiado de idea? ¡Estupendo!' }], () => tutorial(true));
    case 'sableye_gulpin': return openDialog([{ who: 'Sableye', sp: 'sableye', mood: 'Happy', text: SABLEYE_LINES.helpingGulpin }]);   // ayudando a Gulpin (hasta Bronce)
    case 'murkrow': {
      const n = unreadMail();
      return openMenu({ title: 'Murkrow', items: [n ? `Leer el correo (${n} sin leer)` : 'Leer el correo', 'Charlar', 'Nada, gracias'],
        onSelect: i => { if (i === 0) openMailbox(); else if (i === 1) npcGreeting('Murkrow', MURKROW_LINES, 'mk', undefined, 'murkrow'); } });
    }
    case 'rowlet': {   // «???»: una Rowlet que lleva en la fuente tanto tiempo como el maestro del gremio y nunca quiso evolucionar
      const r = (text, mood = 'Normal') => ({ who: '???', sp: 'rowlet', mood, text });
      if ((meta.stats?.deepestBy?.tiempo || 0) < 100) return openDialog([r('…'), r('Aún no sería bueno para ti evolucionar…', 'Worried'),
        r('Conócete primero, pelea contra tus debilidades… y cuando hayas logrado eso, entonces estarás listo para tu siguiente forma…', 'Determined'),
        r('Aunque puedas vivir sin ella.', 'Happy')]);
      return openDialog([r('…'), r('Has llegado muy lejos. Lo noto.', 'Happy'), r('La fuente aún duerme… Cuando despierte, vuelve a verme.', 'Normal')]);
    }
    case 'chansey': return openDialog([{ who: 'Chansey', sp: 'chansey', mood: 'Happy', text: '¡Bienvenidos a la zona de descanso! Aquí os recuperáis después de cada expedición. Descansad bien, que mañana será otro día de aventuras.' }]);
    case 'diglett': return openDialog([{ who: 'Diglett', sp: 'diglett', mood: 'Happy', text: '¡Huella reconocida! Pasa, pasa. Y no toques la rejilla.' }]);
    case 'chatot': return openDialog([{ who: 'Chatot', sp: 'chatot', text: `¿Dudas, ${user.name}? El tablón está justo ahí. El maestro Pidgeot está… ocupado. Siempre está ocupado.` }], () => openMenu({ title: 'Chatot', items: ['Rango y progreso', 'Diario de exploración', 'Repetir el tutorial', 'Nada, gracias'], onCancel: closeHub, onSelect: i => i === 0 ? openRankMenu() : i === 1 ? openDiaryMenu() : i === 2 ? tutorial() : closeHub() }));
    case 'shop': return npcGreeting('Kecleon', KECLEON_GREEN_LINES, 'kg', openShopMenu);
    case 'sell': return npcGreeting('Kecleon', KECLEON_PURPLE_LINES, 'kp', openSellMenu, 'kecleon_purple');   // el morado, con sus propios retratos
    case 'storage': return npcGreeting('Kangaskhan', KANGASKHAN_LINES, 'kk', openStorageMenu);
    case 'gulpin': return npcGreeting('Gulpin', GULPIN_LINES, 'gu', openGulpinMenu);
    case 'smeargle': return npcGreeting('Smeargle', (meta?.scenes || []).includes('veteranos')
      ? ['Me han dicho que vais a la cueva. Cuando volváis, os dibujaré a todos. ¡Con orejas!', 'El camino lo tengo en la cabeza. Si Machamp me deja, os lo pinto antes de salir.', 'Los mapas se los llevó el agua… pero los colores no se me olvidan. Azul para el agua, rojo para el peligro.']
      : ['…zzz… los mapas… el camino… zzz…', '(Smeargle duerme profundamente. Murmura algo sobre una cueva.)', '…zzz… ¿orejas?… ¿le dibujo orejas?… zzz…'], 'sm');
    case 'machamp': return npcGreeting('Machamp', ['Hmm.', 'Los puentes se arreglan. Los exploradores perdidos, se buscan.', 'No hables con el estómago vacío. Come primero.', 'Heracross es ruidoso. Pero en la cueva nadie vigila mejor que él.'], 'ma');
    case 'heracross': return npcGreeting('Heracross', ['¿Hay savia? … No. Bueno.', '¡Estoy entrenando! ¿Ves estos cuernos? ¡Aaah! … ¿Te asustan? ¡Pues a la cueva!', 'Te lancé por los aires y no te quejaste. ¡Respeto!', 'Machamp me da un poco de miedo. Pero no se lo digas.'], 'he');
    case 'sneasel': return npcGreeting('Sneasel', ['Algún día me dejarán entrar en el gremio. Ya verán.', 'La manzana era de casa. ¡DE CASA!', 'Mientras no me dejen entrar, entreno por mi cuenta. ¡Ja!', '¿Tú también crees que fui yo? … Ya. Nadie me cree.'], 'sn');
    case 'wobbuffet': {
      const c = hubCounters(); c.wob = (c.wob || 0) + 1; saveHubCounters(c);
      if (c.wob === 50 && !c.wobPrize) { c.wobPrize = true; saveHubCounters(c); return openDialog([{ who: 'Wobbuffet', sp: 'wobbuffet', mood: 'Joyous', text: 'Wobbuffet! (Le has hablado 50 veces. Conmovido, te da algo que guardaba.)' }], async () => { const r = await call('/hub/gift', { item: 'Semilla Revivir' }); if (r) meta = r.meta; }); }
      return openDialog([{ who: 'Wobbuffet', sp: 'wobbuffet', text: c.wob % 10 === 0 ? ('Wobbuffet! (Van ' + c.wob + '. Parece que le caes bien.)') : 'Wobbuffet!' }]);
    }
  }
}
function hotspotAction(hs) {
  if (hs.action === 'board') return openBoardMenu();
}
function openDungeonMenu() {
  const rank = rankOf(meta.rankPts);
  // solo las mazmorras desbloqueadas por rango; las demás aparecen al subir de rango
  const list = DUNGEONS.filter(d => d.rank <= rank); if (meta.dreamUnlocked) list.push(DREAM_DUNGEON);
  const items = list.map(d => d.id === 'suenos' ? `${d.name} — ∞ (solo legendarios)` : `${d.name} — ${d.floors === Infinity ? '∞' : d.floors} pisos${meta.cleared.includes(d.id) ? ' ✓' : ''}`);
  openMenu({ title: 'Mazmorras', items, onCancel: closeHub, onSelect: i => {
    const d = list[i]; if (!d) return closeHub();
    if (d.id === 'suenos') {
      const legends = meta.legendaries || [];
      if (!legends.length) { say('Necesitas un legendario para entrar en la Mazmorra de los Suenos.'); return openDungeonMenu(); }
      return openMenu({ title: 'Líder legendario', items: [...legends.map(s => SPECIES[s].name), 'Volver'], onCancel: openDungeonMenu, onSelect: j => { if (j >= legends.length) return openDungeonMenu(); state.player = createPlayer(legends[j]); startRun(d); } });
    }
    if (d.rank > rank) { say(`Necesitas rango ${RANKS[d.rank].name} para entrar en ${d.name}.`); return openDungeonMenu(); }
    openMenu({ title: `${d.name} con ${state.player.name} (${SPECIES[state.player.species].name})`, items: ['Entrar', 'Volver'], onCancel: openDungeonMenu, onSelect: j => j === 0 ? startRun(d) : openDungeonMenu() });
  } });
}
function openBoardMenu() {
  if (!meta.board.length && !meta.active.length) return openDialog([{ who: 'Tablón', text: 'No hay ninguna petición… Completa una mazmorra y empezarán a llegar peticiones de ayuda de ella.' }]);
  const items = [...meta.board.map(missionText), `Misiones activas: ${meta.active.length}/2`];
  openMenu({ title: 'Tablón', items, onCancel: closeHub, onSelect: async i => {
    if (i >= meta.board.length) return openActiveMenu();
    const r = await call('/missions/accept', { id: meta.board[i].id }); if (r) { meta = r.meta; say('Misión aceptada.'); }
    openBoardMenu();
  } });
}
function openActiveMenu() {
  if (!meta.active.length) { say('No tienes misiones activas.'); return openBoardMenu(); }
  openMenu({ title: 'Activas (Z para abandonar)', items: meta.active.map(missionText), onCancel: openBoardMenu, onSelect: async i => {
    const r = await call('/missions/abandon', { id: meta.active[i].id }); if (r) { meta = r.meta; say('Misión abandonada.'); }
    openBoardMenu();
  } });
}
function openShopMenu() {
  const kec = state.player?.species === 'kecleon', mult = kec ? KECLEON_DISCOUNT : 1;
  say(kec ? 'Kecleon verde: "¡Hermano! Para ti, todo un 20 % más barato."' : 'Kecleon verde: "¡Bienvenido! Hoy tengo esto."');
  const stock = meta.shop || [];
  const items = [...stock.map(n => `${n} — ${Math.round(ITEMS[n].buy * mult)} P${ITEMS[n].kind === 'held' ? ' (equipable)' : ''}`), `Bolsa: ${meta.bag.length}/${bagSizeFor(meta?.rankPts)}`];
  openMenu({ title: `Comprar (tienes ${meta.pokes} P)${kec ? ' · descuento Kecleon' : ''}`, items, onCancel: closeHub, onSelect: async i => {
    if (i < stock.length) { const r = await call('/shop/buy', { item: stock[i], leader: state.player.species }); if (r) { meta = r.meta; say(`Compras ${stock[i]} por ${r.price} P.`); } }
    openShopMenu();
  } });
}
function openSellMenu() {
  say('Kecleon morado: "¿Qué me traes hoy?"');
  const sellables = meta.bag.map((n, i) => ({ n, i })).filter(x => ITEMS[x.n]?.sell);
  if (!sellables.length) { say('Kecleon morado: "Vaya, nada que me interese."'); return closeHub(); }
  openMenu({ title: `Vender (tienes ${meta.pokes} P)`, items: [...sellables.map(x => `${x.n} — ${ITEMS[x.n].sell} P`), 'Vender todo lo vendible'], onCancel: closeHub, onSelect: async i => {
    const r = await call('/shop/sell', i >= sellables.length ? { all: true } : { index: sellables[i].i });
    if (r) { meta = r.meta; say(`Kecleon morado: "¡Trato hecho! ${r.gained} Pokés."`); }
    openSellMenu();
  } });
}
function openStorageMenu() {
  say('Kangaskhan: "Deja aquí lo que no quieras arriesgar, cielo."');
  openMenu({ title: `Almacén ${meta.storage.length}/${CFG.storageSize} · Banco ${meta.pokes} P`, items: ['Guardar de la bolsa', 'Sacar del almacén', 'Volver'], onCancel: closeHub, onSelect: i => {
    if (i === 2) return closeHub();
    const from = i === 0 ? meta.bag : meta.storage;
    if (!from.length) { say(i === 0 ? 'La bolsa está vacía.' : 'El almacén está vacío.'); return openStorageMenu(); }
    openMenu({ title: i === 0 ? 'Guardar' : 'Sacar', items: from, onCancel: openStorageMenu, onSelect: async j => { const r = await call(i === 0 ? '/storage/deposit' : '/storage/withdraw', { index: j }); if (r) meta = r.meta; openStorageMenu(); } });
  } });
}
function openStarterMenu() {
  if (!canLeaderChoice()) { say(`Chatot: "Hasta rango ${RANKS[CFG.leaderChoiceRank].name} sales con tu Pokémon. Tienes ${meta.starters.length} iniciales desbloqueados, guárdalos."`); return closeHub(); }
  openMenu({ title: 'Líder de la exploración', items: meta.starters.map(s => SPECIES[s].name), onCancel: closeHub, onSelect: i => { state.player = createPlayer(meta.starters[i]); say(`${SPECIES[state.player.species].name} será tu líder.`); closeHub(); } });
}
function openGulpinMenu() {
  const p = state.player, pool = knownPool(p);
  say('Gulpin: "¿Quieres recordar u olvidar algún movimiento?"');
  const slots = [0, 1, 2, 3].map(i => p.moves[i] ? `${i + 1}. ${p.moves[i].name}${p.moves[i].permanent ? ' ★' : ''}` : `${i + 1}. —`);
  openMenu({ title: `Movimientos de ${p.name}`, items: [...slots, 'Volver'], icons: [0, 1, 2, 3].map(i => p.moves[i] && MOVES[p.moves[i].name].type), onCancel: closeHub, onSelect: i => {
    if (i >= 4) return closeHub();
    const options = pool.filter(m => !p.moves.some((x, j) => x.name === m && j !== i));
    openMenu({ title: `Ranura ${i + 1}`, items: [...options.map(m => `${m}${permanentMoves(p.species).includes(m) ? ' ★' : ''}`), p.moves[i] ? 'Olvidar' : 'Dejar vacía'], icons: options.map(m => MOVES[m].type), onCancel: openGulpinMenu, onSelect: j => {
      if (j >= options.length) { if (p.moves[i]) { say(`${p.name} olvida ${p.moves[i].name}.`); p.moves.splice(i, 1); } }
      else { const m = options[j], entry = { name: m, pp: MOVES[m].pp, permanent: permanentMoves(p.species).includes(m) }; p.moves[i] ? p.moves[i] = entry : p.moves.push(entry); say(`${p.name} recuerda ${m}.`); }
      openGulpinMenu();
    } });
  } });
}
function openRankMenu() {
  const r = rankOf(meta.rankPts), next = RANKS[r + 1];
  openMenu({ title: 'Progreso', items: [
    `Rango ${RANKS[r].name} · ${meta.rankPts} pts${next ? ` · siguiente a ${next.pts}` : ' · máximo'}`,
    `Mazmorras completadas: ${meta.cleared.length}/${DUNGEONS.length - 1}`,
    `Iniciales: ${meta.starters.map(s => SPECIES[s].name).join(', ')}`,
    `Legendarios: ${meta.legendaries?.length ? meta.legendaries.map(s => SPECIES[s].name).join(', ') : 'ninguno'}`,
    `MD en movepools: ${Object.values(meta.movepool || {}).flat().length}`,
    'Volver'], onCancel: closeHub, onSelect: closeHub });
}

// =====================================================================
// RUN
// =====================================================================
async function startRun(def) {
  if (pendingEnd() && !(await flushPendingEnd(true))) return openDialog([{ who: '', text: 'Antes hay que enviar el resultado de tu última exploración, y ahora no hay conexión. Inténtalo de nuevo en un momento.' }]);
  if (!state.player) state.player = createPlayer(meta.starters[0]);   // por si la aldea aún no había terminado de cargar
  let r;
  state.busy = true; render();
  try { r = await api('/run/start', { dungeonId: def.id, starter: state.player.species }); }
  catch (e) { state.busy = false; closeHub(); return blockedStart(e); }
  finally { state.busy = false; }
  meta = r.meta;
  const moves = state.player.moves;
  state.player = createPlayer(r.run.starter); state.player.moves = moves;
  Object.assign(state, { run: r.run, flags: r.run.flags || {}, dungeonDef: def, inventory: [...r.bag], runPokes: 0, missions: r.missions.map(m => ({ ...m, done: false })), earnedMD: [], recruitedLegendaries: [], lostRecruits: [], bondedLost: [], team: [], floor: 1, turn: 0, dead: false, log: [], scene: 'dungeon', diary: { monsterHouses: 0, recruited: 0, kecleonRobs: 0, itemsSold: 0 }, stonesFound: [] });
  newFloor();
}
// No se ha podido entrar en la mazmorra: se explica por qué y se da la salida (antes el motivo iba al registro de
// mensajes, que en la aldea no se ve, y parecía que el botón no hacía nada)
async function blockedStart(e) {
  if (e.status === 409) {
    let me = null; try { me = await api('/me'); meta = me.user.meta; state.pausedRun = me.run; } catch {}
    if (me?.rescue) return showRescueWait(me.rescue);
    if (me?.run) {
      const name = dungeonById(me.run.dungeonId)?.name || 'una mazmorra';
      return openMenu({ title: `Tienes una exploración a medias en ${name}. Antes de empezar otra, hay que terminarla.`, items: ['Continuarla ahora', 'Abandonarla', 'Cerrar'], onCancel: closeHub, onSelect: async i => {
        if (i === 0) return resumeRun();
        if (i === 1) return openMenu({ title: '¿Abandonar la exploración? Perderás lo acumulado.', items: ['No', 'Sí, abandonar'], onCancel: closeHub, onSelect: async j => {
          if (j !== 1) return closeHub();
          try { await api('/run/abandon', {}); const m2 = await api('/me'); meta = m2.user.meta; state.pausedRun = m2.run; closeHub(); openDialog([{ who: '', text: 'Exploración abandonada. Ya puedes empezar otra.' }]); }
          catch (err) { closeHub(); openDialog([{ who: '', text: err.message }]); }
        } });
        closeHub();
      } });
    }
  }
  openDialog([{ who: '', text: e.status === 0 ? 'No se ha podido conectar con el servidor. Inténtalo de nuevo en un momento.' : e.message }]);
}
async function resumeRun() {
  const r = await call('/run/resume', {}); if (!r) return closeHub();
  let s = r.run.state;
  // nombres antiguos: objetos, MT/MD y movimientos del equipo
  const fixMachine = n => { const x = fixItemName(n); return /^(MT|MD): /.test(x) ? x.slice(0, 4) + fixMoveName(x.slice(4)) : x; };
  if (s?.inventory) s.inventory = s.inventory.map(fixMachine);
  for (const mon of [s?.player, ...(s?.team || [])]) if (mon?.moves) mon.moves.forEach(mv => { mv.name = fixMoveName(mv.name); });
  const local = localBackup(r.run.id);   // si la copia del navegador es más nueva (se cortó la conexión al guardar), manda ella
  if (local && local.rev > (r.run.rev || 0)) { s = local.state; r.run.rev = local.rev; api('/run/save', { state: s, rev: local.rev }).catch(() => {}); }
  Object.assign(state, { run: r.run, flags: r.run.flags || {}, dungeonDef: dungeonById(r.run.dungeonId), player: s.player, team: s.team || [], inventory: s.inventory, runPokes: s.runPokes, missions: s.missions, earnedMD: s.earnedMD || [], recruitedLegendaries: s.recruitedLegendaries || [], lostRecruits: s.lostRecruits || [], bondedLost: s.bondedLost || [], floor: s.floor, turn: s.turn, dead: false, log: [], scene: 'dungeon', pausedRun: null });
  state.scene = 'dungeon'; state.run.playMs = s.playMs || 0;   // el tiempo jugado sigue contando desde donde iba
  if (s.where?.dungeon?.tiles) restoreFloor(s.where); else newFloor();   // el mismo piso, tal como estaba (las fotos antiguas no lo traen)
}
// El piso tal como está (mapa, enemigos, objetos, lo explorado…), para continuar exactamente donde lo dejaste.
// Casillas y mapa explorado van como texto (un carácter por casilla) para que la foto pese poco.
const floorSnapshot = () => {
  if (state.scene !== 'dungeon' || !state.dungeon) return null;
  const clean = e => { const { _tw, anim, ...rest } = e; return rest; };   // lo que solo sirve para dibujar, fuera
  return { dungeon: { ...state.dungeon, tiles: state.dungeon.tiles.map(r => r.map(v => String.fromCharCode(48 + v)).join('')) },
    enemies: state.enemies.map(clean), groundItems: state.groundItems, npcs: (state.npcs || []).map(clean), monsterHouse: state.monsterHouse || null, shop: state.shop || null,
    seen: (state.seen || []).map(r => r.map(v => v ? '1' : '0').join('')), weather: state.weather, era: state.era, floorTurns: state.floorTurns || 0, arenaDone: !!state.arenaDone };
};
function restoreFloor(w) {
  const def = state.dungeonDef;
  state.arenaDone = !!w.arenaDone; state.feed = []; musicZone = null; state.floorTurns = w.floorTurns || 0;
  state.rng = makeRng((floorSeed(state.run.seed, state.floor) ^ Math.imul(state.floorTurns + 1, 2654435761)) >>> 0);
  state.dungeon = { ...w.dungeon, tiles: w.dungeon.tiles.map(r => [...r].map(c => c.charCodeAt(0) - 48)) };
  Object.assign(state, { enemies: w.enemies || [], groundItems: w.groundItems || [], npcs: w.npcs || [], monsterHouse: w.monsterHouse, shop: w.shop, weather: w.weather || 'none', era: w.era || def.id });
  state.seen = (w.seen || []).map(r => [...r].map(c => c === '1'));
  showCard(def.name, `B${state.floor}F`); setTimeout(updateDungeonMusic, 0); setTimeout(() => dungeonTips(), 1200);   // (tras el cartel del piso)
  updateVisibility(); render(); say('Continúas la exploración donde la dejaste.');
}
const runSnapshot = () => ({ where: floorSnapshot(), playMs: state.run?.playMs || 0, floor: state.floor, player: state.player, team: state.team, inventory: state.inventory, runPokes: state.runPokes, missions: state.missions, earnedMD: state.earnedMD, recruitedLegendaries: state.recruitedLegendaries, lostRecruits: state.lostRecruits, bondedLost: state.bondedLost, turn: state.turn });
// ---------- telemetría: contexto de cada evento y estadísticas de la exploración ----------
setTelemetryContext(() => state.scene === 'dungeon' && state.dungeonDef ? { at: 'mazmorra', dungeon: state.dungeonDef.id, floor: state.floor, sp: state.player?.species, lv: state.player?.level } : { at: state.hub?.area || state.scene });
const runStats = () => (state.run ? (state.run.tstats ||= { dealt: 0, taken: 0, kills: 0, moves: {}, items: 0 }) : { dealt: 0, taken: 0, kills: 0, moves: {}, items: 0 });
const onOurSide = m => m === state.player || state.team.includes(m);
const pct = m => m ? Math.round(m.hp / m.maxHp * 100) : null;
let sessionStart = Date.now();
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { if (user) { track('session_end', { min: Math.round((Date.now() - sessionStart) / 60000) }); flushTelemetry(true); } });
// ---------- tiempo jugado de verdad en la mazmorra (sin pestaña oculta, pausas ni pantalla de rescate) ----------
let playTick = performance.now();
setInterval(() => {
  const now = performance.now(), dt = Math.min(2000, now - playTick); playTick = now;
  if (state.scene === 'dungeon' && state.run && !state.dead && !state.run.ending && document.visibilityState === 'visible') state.run.playMs = (state.run.playMs || 0) + dt;
}, 1000);
// ---------- guardado automático (en cada piso, cada 10 turnos y al cerrar o esconder la pestaña) ----------
// La foto va al servidor con un número de versión y, además, a este navegador. Al volver se usa la más reciente.
const BACKUP_KEY = 'pmdt_run_backup';
function autosave(why) {
  if (!state.run || state.scene !== 'dungeon' || state.dead || !state.player || state.run.ending) return;
  const rev = (state.run.rev || 0) + 1; state.run.rev = rev;
  const snap = runSnapshot();
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ runId: state.run.id, user: user?.name, rev, state: snap })); } catch { /* sin espacio */ }
  api('/run/save', { state: snap, rev }, { keepalive: why === 'close' }).catch(() => { /* la copia local queda; se sube al volver */ });
}
const localBackup = runId => { try { const b = JSON.parse(localStorage.getItem(BACKUP_KEY)); return b && b.runId === runId && b.user === user?.name ? b : null; } catch { return null; } };
const clearBackup = () => { try { localStorage.removeItem(BACKUP_KEY); } catch {} };
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autosave('close'); });
  window.addEventListener('pagehide', () => autosave('close'));
}

// ---------- buzón de salida: el resultado final no se pierde aunque falle la conexión ----------
// Se guarda en el navegador con su identificador y se reenvía (el servidor no lo aplica dos veces) hasta que llega.
const PENDING_KEY = 'pmdt_pending_end';
const pendingEnd = () => { try { const p = JSON.parse(localStorage.getItem(PENDING_KEY)); return p && p.user === user?.name ? p : null; } catch { return null; } };
let flushTimer = null;
async function flushPendingEnd(quiet = false) {
  const p = pendingEnd(); if (!p) return true;
  clearTimeout(flushTimer);
  try {
    const r = await api('/run/end', p.body, { rid: p.rid });
    localStorage.removeItem(PENDING_KEY); clearBackup();
    meta = r.meta; state.pausedRun = null; (r.messages || []).forEach(say);
    if (!quiet) openDialog([{ who: '', text: `¡Conexión recuperada! Tu resultado en ${p.where} ya está registrado.` }]);
    render(); return true;
  } catch (e) {
    if (e.status === 0) { flushTimer = setTimeout(() => flushPendingEnd(), 20000); return false; }   // sin conexión: se reintenta más tarde
    localStorage.removeItem(PENDING_KEY);   // el servidor lo rechaza (p. ej. ya estaba registrado): nada que reenviar
    try { const me = await api('/me'); meta = me.user.meta; state.pausedRun = me.run; } catch {}
    render(); return true;
  }
}

// ---------- rescates: al caer, esperar a que otro explorador venga a buscarte (como en el original) ----------
// Solo con servidor (sin conexión nadie podría rescatarte). Mientras esperas no puedes jugar: pantalla de espera.
async function deathChoice() {
  if (state.dungeonDef?.id === 'entrenamiento') return endRun('death');   // el tutorial no tiene rescates
  const where = `${state.dungeonDef.name}, piso B${state.floor}F`;
  openMenu({ title: `Tu equipo ha caído en ${where}`, items: ['Esperar un rescate', 'Rendirse y volver al gremio'], sticky: true, onSelect: async i => {
    if (i === 1) return endRun('death');
    const snap = runSnapshot(); snap.player = { ...snap.player, hp: snap.player.maxHp, status: null };   // si te rescatan, vuelves con fuerzas
    const r = await call('/rescue/wait', { state: snap, x: state.player.x, y: state.player.y });
    if (!r?.rescue) return deathChoice();   // sin conexión: volver a preguntar
    if (state.run) state.run.ending = true; clearBackup();
    showRescueWait(r.rescue);
  } });
}
let rescuePoll = null;
function showRescueWait(rescue) {
  state.waitingRescue = true; state.dead = true; state.menu = null; state.dialog = null; stopMusic?.();
  document.getElementById('rescue-wait')?.remove();
  const d = dungeonById(rescue.dungeonId), el = document.createElement('div');
  el.id = 'rescue-wait'; el.className = 'rescue-wait';
  el.innerHTML = `<div class="rw-box">
    <h2>Esperando un rescate…</h2>
    <p>Tu equipo ha caído en <b>${d?.name || 'la mazmorra'}, piso B${rescue.floor}F</b>, y aguarda en la oscuridad a que alguien venga a buscarlo.</p>
    <p class="rw-label">Código de rescate</p>
    <p class="rw-code">${rescue.code}</p>
    <p>Compártelo con otros exploradores: pueden aceptarlo desde el tablón del gremio. Si te rescatan, seguirás la exploración desde este piso con todo lo que llevabas.</p>
    <p class="rw-status">Esperando…</p>
    <button type="button" class="btn rw-giveup">Rendirse y volver al gremio</button>
  </div>`;
  document.body.appendChild(el);
  const status = el.querySelector('.rw-status'), btn = el.querySelector('.rw-giveup');
  const check = async () => {
    try {
      const r = await api('/rescue/status');
      if (r.rescued) {
        clearInterval(rescuePoll);
        status.textContent = `¡${r.by} ha venido a rescatarte!`;
        btn.textContent = 'Continuar la exploración'; btn.onclick = async () => {
          btn.disabled = true; const me = await call('/me'); el.remove(); state.dead = false; state.waitingRescue = false;
          if (me) { meta = me.user.meta; state.pausedRun = me.run; }
          resumeRun();
        };
      } else status.textContent = 'Esperando… (se comprueba solo cada poco)';
    } catch { status.textContent = 'Sin conexión: se volverá a comprobar en un momento.'; }
  };
  clearInterval(rescuePoll); rescuePoll = setInterval(check, 15000); check();
  btn.onclick = async () => {
    if (!confirm('¿Seguro que quieres rendirte? Volverás al gremio y perderás parte de lo que llevabas.')) return;
    btn.disabled = true;
    let r; try { r = await api('/rescue/giveup', {}); } catch (e) { btn.disabled = false; status.textContent = e.message; return; }
    clearInterval(rescuePoll); el.remove(); state.waitingRescue = false;
    const run = r.run, s = run.state || {};
    Object.assign(state, { run, dungeonDef: dungeonById(run.dungeonId), player: s.player, team: s.team || [], inventory: s.inventory || [], runPokes: s.runPokes || 0,
      missions: s.missions || [], floor: s.floor || 1, bondedLost: s.bondedLost || [], lostRecruits: [], mdToStorage: s.mdToStorage || [], earnedMD: s.earnedMD || [] });
    state.dead = false; endRun('death');
  };
}

async function pauseRun() {
  const r = await call('/run/pause', { state: runSnapshot() }); if (!r) return;
  state.pausedRun = { dungeonId: state.run.dungeonId, state: runSnapshot() };
  state.player = null; say('Exploración guardada. Podrás continuarla desde el gremio.'); enterHub();
}
// ---------- despacho del maestro Pidgeot (se llega a través de Mawile, con rango Diamante) ----------
async function openPidgeotOffice() {
  const r = await call('/pidgeot', undefined);
  if (!r || !r.open) return;
  const done = r.stones.length, total = r.allStones.length;
  if (r.story === 'none') {
    return openDialog([
      { who: 'Pidgeot', text: `Así que tú eres ${user.name}. Yo antes repartía el correo para el gremio de Pelipper… hasta que encontré una Pidgeotita y megaevolucioné. Una sola vez. Me cambió la vida.` },
      { who: 'Pidgeot', text: 'Desde entonces investigo esas piedras. Hay cuatro fragmentos escondidos en las mazmorras. Tráemelos y te mostraré algo que nadie ha visto.' },
    ], async () => { const a = await call('/pidgeot/advance', {}); if (a) { meta = a.meta; say('Nueva misión del maestro: buscar las cuatro megapiedras.'); } });
  }
  if (r.story === 'quest' && !r.dreamUnlocked) {
    const lines = r.allStones.map(s => `${r.stones.includes(s.id) ? '✔' : '✖'} ${s.name} — ${dungeonById(s.dungeonId).name} B${s.floor}F`);
    return openMenu({ title: `Megapiedras: ${done}/${total}`, items: [...lines, 'Volver'], onCancel: closeHub, onSelect: closeHub });
  }
  return openDialog([{ who: 'Pidgeot', text: 'Las cuatro piedras juntas abren una grieta en el tiempo: la Mazmorra de los Sueños. Solo un legendario puede cruzarla. Ve cuando estés listo.' }], () => say('La Mazmorra de los Sueños está disponible al elegir mazmorra (con un legendario de líder).'));
}

// Pantalla de mazmorra completada: botín, equipo y logros (mismo estilo que el informe al caer)
function showClearReport(s) {
  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const group = list => { const c = {}; for (const n of list) c[n] = (c[n] || 0) + 1; return Object.entries(c).map(([n, k]) => `<li>${esc(n)}${k > 1 ? ` <b>×${k}</b>` : ''}</li>`).join('') || '<li class="none">—</li>'; };
  return reportScreen(`¡Mazmorra completada!`, `Has superado ${esc(s.dungeon)} (${s.floors} pisos).`, `
    <section class="rep-col kept"><h3>Botín</h3><p class="rep-pokes">${s.pokes} P</p><ul>${group(s.items)}</ul><p class="rep-held">Equipado: ${s.held ? esc(s.held) : '—'}</p></section>
    <section class="rep-col carried"><h3>Equipo</h3><p class="rep-pokes">${esc(s.leader)}</p><ul><li>Nivel ${s.lv0}${s.lv1 > s.lv0 ? ` → <b>${s.lv1}</b>` : ''}</li>${s.team.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>
    <section class="rep-col clear"><h3>Logros</h3><ul><li>${s.floors} pisos recorridos</li><li>${s.recruited} recluta${s.recruited === 1 ? '' : 's'}</li><li>${s.missions} misi${s.missions === 1 ? 'ón cumplida' : 'ones cumplidas'}</li></ul></section>`, 'report-clear');
}
// ventana de informe común (Z, Enter o clic para continuar)
function reportScreen(tab, where, cols, extraClass = '') {
  return new Promise(resolve => {
    const box = document.createElement('div'); box.className = 'penalty-report ' + extraClass;
    box.innerHTML = `<div class="rep-inner"><span class="pmd-tab">${tab}</span><p class="rep-where">${where}</p><div class="rep-cols">${cols}</div><p class="rep-foot">Pulsa Z o haz clic para continuar ▼</p></div>`;
    document.getElementById('screen-game').appendChild(box);
    const close = ev => {
      if (ev.type === 'keydown' && !['z', 'enter', ' ', 'x', 'escape'].includes(ev.key.toLowerCase())) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      window.removeEventListener('keydown', close, true); box.removeEventListener('click', close);
      box.remove(); state.busy = false; resolve();
    };
    state.busy = true;
    setTimeout(() => { window.addEventListener('keydown', close, true); box.addEventListener('click', close); }, 400);
  });
}

// Informe tras caer: lo que llevabas, lo que has perdido y lo que conservas (como en Exploradores del Cielo:
// se pierde la mitad de los Pokés, la mitad o más de la bolsa y casi siempre el objeto equipado)
function showPenaltyReport(p, where) {
  return new Promise(resolve => {
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const group = list => { const c = {}; for (const n of list) c[n] = (c[n] || 0) + 1; return Object.entries(c).map(([n, k]) => `<li>${esc(n)}${k > 1 ? ` <b>×${k}</b>` : ''}</li>`).join('') || '<li class="none">—</li>'; };
    const col = (title, cls, d) => `<section class="rep-col ${cls}"><h3>${title}</h3><p class="rep-pokes">${d.pokes} P</p><ul>${group(d.items)}</ul><p class="rep-held">Equipado: ${d.held ? esc(d.held) : '—'}</p></section>`;
    const box = document.createElement('div'); box.className = 'penalty-report';
    box.innerHTML = `<div class="rep-inner"><span class="pmd-tab">Informe de la expedición</span>
      <p class="rep-where">Caíste en ${esc(where)}.</p>
      <div class="rep-cols">${col('Llevabas', 'carried', p.carried)}${col('Has perdido', 'lost', p.lost)}${col('Conservas', 'kept', p.kept)}</div>
      <p class="rep-foot">Pulsa Z o haz clic para continuar ▼</p></div>`;
    document.getElementById('screen-game').appendChild(box);
    const close = ev => {
      if (ev.type === 'keydown' && !['z', 'enter', ' ', 'x', 'escape'].includes(ev.key.toLowerCase())) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      window.removeEventListener('keydown', close, true); box.removeEventListener('click', close);
      box.remove(); state.busy = false; resolve();
    };
    state.busy = true;
    setTimeout(() => { window.addEventListener('keydown', close, true); box.addEventListener('click', close); }, 400);   // evita cerrarlo sin querer con la última pulsación
  });
}

// Miembros de otros equipos de rescate que te traen de vuelta cuando caes (nombre, especie, artículo)
// Quien te trae de vuelta al caer: siempre Bruno, el Ursaring de otro equipo de rescate
const RESCUER = { name: 'Bruno', art: 'el', sp: 'Ursaring' };
async function endRun(outcome) {
  const bonds = [...state.team.map(a => ({ species: a.species, floors: a.floors, nick: a.nick })), ...state.bondedLost];
  const fell = { x: state.player.x, y: state.player.y };
  const fallen = `${state.dungeonDef.name}, piso B${state.floor}F`;   // para el mensaje de Chansey
  // resumen para la pantalla de «mazmorra completada» (antes de que se reinicie el estado)
  const summary = outcome === 'clear' ? { dungeon: state.dungeonDef.name, floors: state.floor, pokes: state.runPokes, items: [...state.inventory], held: state.player.held,
    leader: state.player.name, lv0: state.player.runStartLevel ?? state.player.level, lv1: state.player.level,
    team: state.team.map(a => `${a.name} Nv${a.level}`), recruited: state.diary?.recruited || 0, missions: (state.missions || []).filter(m => m.done).length } : null;
  if (state.run) state.run.ending = true;   // ya no se autoguarda
  { const st = runStats(), top = Object.entries(st.moves).sort((a, b) => b[1] - a[1]).slice(0, 8); track('run_summary', { outcome, floor: state.floor, dealt: st.dealt, taken: st.taken, kills: st.kills, items: st.items, moves: Object.fromEntries(top), min: Math.round((state.run?.playMs || 0) / 60000) }); }
  const endBody = { playMs: Math.round(state.run?.playMs || 0), outcome, floor: state.floor, runPokes: state.runPokes, inventory: state.inventory, mdToStorage: state.mdToStorage || [], held: state.player.held, player: state.player, team: state.team.map(a => ({ species: a.species, level: a.level, exp: a.exp })), earnedMD: state.earnedMD, missionsDone: state.missions.filter(m => m.done).map(m => m.id), bonds, legendaries: state.recruitedLegendaries, lostRecruits: state.lostRecruits, diary: state.diary, stonesFound: state.stonesFound || [] };
  const rid = state.run?.endRid || (state.run ? (state.run.endRid = newRequestId()) : newRequestId());
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ user: user?.name, rid, body: endBody, where: state.dungeonDef.name })); } catch {}
  let r = null, offline = false;
  state.busy = true; render();
  try { r = await api('/run/end', endBody, { rid }); } catch (e) { if (e.status === 0) offline = true; else say(e.message); }
  finally { state.busy = false; render(); }
  if (r) { try { localStorage.removeItem(PENDING_KEY); } catch {} clearBackup(); }
  if (r?.newMail) state.mailArrived = true;   // Murkrow avisa al volver al gremio
  // sin conexión: el resultado queda guardado y se envía solo cuando vuelva (no se pierde la exploración)
  if (!r && offline) { openMenu({ title: 'Sin conexión con el servidor', items: ['Reintentar ahora', 'Volver a la aldea (se enviará después)'], sticky: true, onSelect: async i => {
    if (i === 0) return endRun(outcome);
    state.player = null; state.run = null; state.pausedRun = null; enterHub();
    openDialog([{ who: '', text: 'Tu resultado está guardado en este dispositivo: se enviará solo en cuanto vuelva la conexión.' }]);
    flushTimer = setTimeout(() => flushPendingEnd(), 20000);
  } }); return; }
  if (!r) try { localStorage.removeItem(PENDING_KEY); } catch {}   // rechazado por el servidor: reenviarlo no serviría
  // si el servidor no responde, se reintenta; si rechaza el cierre, reintentar no sirve: se puede volver a la aldea
  if (!r) { openMenu({ title: 'No se pudo cerrar la exploración', items: ['Reintentar', 'Volver a la aldea'], sticky: true, onSelect: async i => {
    if (i === 0) return endRun(outcome);
    await call('/run/abandon', {}); const me = await call('/me');
    if (me) { meta = me.user.meta; state.pausedRun = me.run; }
    state.player = null; state.run = null; say('Vuelves a la aldea. Esa exploración no ha contado.'); enterHub();
  } }); return; }
  const canRescue = r.canRescue; const fellSpot = fell;
  const lost = state.lostRecruits.slice();
  meta = r.meta; state.player = null; state.pausedRun = null;
  // al volver de cualquier exploración apareces en la zona de descanso del gremio
  state.hub.area = 'descanso'; Object.assign(state.hub, HUB.descanso.spawn); state.hub.facing = [0, -1]; state.hub.inBed = null;
  if (outcome === 'death') { const bed = HUB.descanso.beds[Math.floor(Math.random() * HUB.descanso.beds.length)]; Object.assign(state.hub, { x: bed.x, y: bed.y, facing: [0, 1] }); state.hub.inBed = bed; }  // al caer, despiertas en una cama (las camas no chocan)
  enterHub({ noScenes: true }); saveLastSeen();
  if (outcome === 'death') { musicZone = 'descanso'; playTrack('sad'); }   // escena triste: despiertas tras caer (hasta que Chansey termina)
  if (outcome === 'death' && r.result?.penalty) await showPenaltyReport(r.result.penalty, fallen);   // qué llevabas, qué has perdido y qué conservas
  if (summary) await showClearReport(summary);   // pantalla de mazmorra completada, como en el original
  if (outcome === 'death') {
    const { name, art, sp } = RESCUER;
    openDialog([{ who: 'Chansey', text: `¡Por fin despertáis! Os ha traído ${name}, ${art} ${sp}. Habíais caído en ${fallen}, y os ha sacado de ahí.` },
                { who: 'Chansey', text: '¡Más cuidado la próxima vez!' }], () => playTrack('rest'));   // vuelve la nana de la zona de descanso
  }
  r.messages.forEach(say);
  // (el rescate se ofrece al caer, antes de volver al gremio: ver deathChoice)
  whenIdle().then(() => whenIdle()).then(() => playPendingScenes(true));   // las escenas, cuando ya se ha leído todo lo demás (también las de «a la vuelta»)
  if (lost.length) openDialog([{ who: lost.map(s => SPECIES[s].name).join(', '), text: `${lost.length > 1 ? '(Al unísono) ' : ''}Me había equivocado, pensaba que eras más fuerte…`, portraits: lost }]);
}

// =====================================================================
// MAZMORRA
// ---------- tutorial en la mazmorra: la voz de Chatot, desde algún lugar del Campo de Entrenamiento ----------
// Un consejo cada vez, en el momento justo y una sola vez por cuenta (se guardan con las escenas vistas).
function dungeonTips(retry = 0) {
  if (state.scene !== 'dungeon' || state.dungeonDef?.id !== 'entrenamiento' || !state.player || state.dead || window.__mmFast) return;
  if (state.dialog || state.menu || state.busy || state.resolving || state.dcut) { if (retry < 12) setTimeout(() => dungeonTips(retry + 1), 400); return; }   // ocupado (el cartel del piso…): en un momento
  const seen = new Set(meta.scenes || []), p = state.player, touch = document.body.classList.contains('touch-on');
  const K = touch ? { move: 'la cruceta', a: 'A', l: 'L', menu: 'X' } : { move: 'las flechas', a: 'Z', l: 'Q', menu: 'S' };
  const stairsSeen = () => { const s = state.dungeon.stairs; return s && state.seen?.[s.y]?.[s.x]; };
  const TIPS = [
    { id: 'tip-mover', when: () => state.floor === 1, pages: [
      { who: '', text: '(Se oye la voz de Chatot, desde algún lugar de la mazmorra…)' },
      { mood: 'Happy', text: `¡Recluta! ¿Me oyes? Muévete con ${K.move} y explora el piso hasta dar con la escalera.` },
      { mood: 'Normal', text: 'Cada piso es distinto. El mapa de la esquina se va dibujando a medida que exploras.' }] },
    { id: 'tip-enemigo', when: () => state.enemies.some(e => e.hp > 0 && isVisibleNow(e.x, e.y)), pages: [
      { mood: 'Surprised', text: '¡Un Pokémon salvaje! Ponte delante y pulsa ' + K.a + ' para darle un golpe normal.' },
      { mood: 'Inspired', text: `Tus movimientos son más fuertes: mantén ${K.l} y pulsa ${K.a}, B, X o Y (los tienes en el panel). Eso sí, gastan PP.` },
      { mood: 'Normal', text: 'Y cuidado: ¡ellos también atacan! Cada vez que haces algo, ellos hacen algo.' }] },
    { id: 'tip-escalera', when: () => stairsSeen(), pages: [
      { mood: 'Happy', text: '¡Esa es la escalera! Ponte encima y elige «Bajar» para pasar al siguiente piso.' }] },
    { id: 'tip-objeto', when: () => (state.inventory?.length || 0) > (state.tipsInv0 ?? Infinity), pages: [
      { mood: 'Happy', text: `¡Has recogido algo! Para usarlo, abre el menú con ${K.menu} y entra en «Bolsa».` }] },
    { id: 'tip-ps', when: () => p.hp <= p.maxHp / 2, pages: [
      { mood: 'Worried', text: '¡Cuidado, Recluta! Si te quedas sin PS, vuelves al gremio sin terminar la exploración.' },
      { mood: 'Normal', text: `Cómete una Baya Aranja: menú (${K.menu}) → Bolsa → Baya Aranja → Comer. ¿Ves? Para algo te las di.` }] },
    { id: 'tip-barriga', when: () => state.floor >= 2, pages: [
      { mood: 'Normal', text: 'Una cosa más: la barriga baja a medida que andas. Si se vacía, empezarás a perder PS.' },
      { mood: 'Happy', text: 'Las Manzanas la llenan. ¡No las desperdicies, que no crecen en los árboles! … Bueno, sí que crecen en los árboles.' }] },
  ];
  if (state.tipsInv0 == null || state.tipsFloor !== state.floor) { state.tipsInv0 = state.inventory?.length || 0; state.tipsFloor = state.floor; }
  const tip = TIPS.find(t => !seen.has(t.id) && t.when()); if (!tip) return;
  (meta.scenes ||= []).push(tip.id); api('/scene/seen', { id: tip.id }).catch(() => {});
  openDialog(tip.pages.map(pg => pg.who === '' ? pg : { who: 'Chatot', sp: 'chatot', mood: pg.mood || 'Normal', text: pg.text }), () => setTimeout(() => dungeonTips(10), 300));
}

// ---------- escenas en la mazmorra (el jefe del Campo de Entrenamiento) ----------
const dwait = ms => window.__mmFast ? Promise.resolve() : new Promise(r => setTimeout(r, ms));
const talk = pages => window.__mmFast ? Promise.resolve() : new Promise(res => openDialog(pages, res));   // (en modo rápido, sin diálogos)
const emoteOn = (m, fx) => { (m.emotes ||= []).push({ fx, t0: performance.now() }); render(); };
const poseOn = (m, name) => { m.anim = name ? { name, t0: performance.now(), dur: Infinity, loop: true } : null; render(); };
function drawFlash() {
  const f = state.flash; if (!f) return;
  const k = (performance.now() - f.t0) / f.ms; if (k >= 1) { state.flash = null; return; }
  ctx.fillStyle = `rgba(255,255,255,${k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7})`; ctx.fillRect(0, 0, LOG.w, LOG.h); scheduleRender();
}
const flash = ms => { state.flash = { t0: performance.now(), ms }; scheduleRender(); return dwait(ms * 0.35); };
const C = (mood, text) => ({ who: 'Chatot', sp: 'chatot', mood, text });
// Antes de la pelea: Chatot, de espaldas, canta para sí mismo… hasta que te ve
async function chatotBossIntro(boss) {
  const p = state.player, first = !(meta.scenes || []).includes('chatot-jefe');
  state.dcut = true;
  try {
    // colocarte a unos pasos de él, mirándole
    for (const dy of [3, 2, 4]) if (walkableFor(p, boss.x, boss.y + dy) && !occupied(boss.x, boss.y + dy)) { p.x = boss.x; p.y = boss.y + dy; break; }
    p.facing = [0, -1]; updateVisibility();
    if (!first) { boss.facing = [0, 1]; poseOn(boss, 'Charge'); await talk([C('Determined', '¡Otra vez tú! ¡Esta vez no me dejaré ganar! Digo… ¡no te dejaré ganar!')]); return; }
    boss.facing = [0, -1]; render(); await dwait(600);
    await talk([C('Joyous', '♪ Chatot, el más apuesto del gremio… ♪ Chatot, el que mejor canta… ♪')]);
    emoteOn(p, 'dots'); await dwait(1400);
    boss.facing = [0, 1]; poseOn(boss, 'Hop'); emoteOn(boss, 'shock'); playSfx('menu'); await dwait(500); poseOn(boss, null);
    await talk([C('Surprised', '¡¿Q-qué?! ¡¿Recluta?! ¿Tú aquí? ¡Qué… qué casualidad!')]);
    boss.facing = [1, 0]; emoteOn(boss, 'sweat'); render(); await dwait(500);
    await talk([C('Worried', 'Yo estaba… de paso. Inspeccionando la sala. Sí, eso.')]);
    boss.facing = [0, 1]; poseOn(boss, 'Pose');
    await talk([C('Inspired', '¡Pues bien! Para superar el Campo de Entrenamiento, tendrás que derrotar a su jefe…'), C('Joyous', '¡El más poderoso, carismático y apuesto del gremio!')]);
    poseOn(boss, 'Charge');
    await talk([C('Determined', '¡Yo! ¡En guardia, Recluta!')]);
    (meta.scenes ||= []).push('chatot-jefe'); api('/scene/seen', { id: 'chatot-jefe' }).catch(() => {});
  } finally { poseOn(boss, null); state.dcut = false; render(); }
}
// Después: pierde el equilibrio, reconoce tu victoria (a su manera) y se va con un Orbe Escape
async function chatotBowsOut(e, by) {
  const first = !(meta.scenes || []).includes('chatot-jefe-fin');
  state.dcut = true; e.hp = 1; e.bowedOut = true;
  try {
    await dwait(400);
    if (first) {
      poseOn(e, 'LostBalance'); emoteOn(e, 'sweat');
      await talk([C('Pain', '¡Aaay! ¡Mis plumas! ¡Mis preciosas plumas!')]);
      poseOn(e, null); e.facing = [0, 1];
      await talk([C('Sigh', '… Bien. Muy bien, Recluta. Has superado la prueba.')]);
      poseOn(e, 'Pose'); emoteOn(e, 'anger');
      await talk([C('Angry', '¡Pero que conste que me he dejado ganar! ¡Por… por pedagogía!')]);
      poseOn(e, null);
      await talk([C('Worried', 'Y ahora, si me disculpas, tengo asuntos muy importantes que atender. ¡Muy importantes!')]);
      (meta.scenes ||= []).push('chatot-jefe-fin'); api('/scene/seen', { id: 'chatot-jefe-fin' }).catch(() => {});
    } else {
      poseOn(e, 'LostBalance'); await talk([C('Angry', '¡Otra vez! ¡Esto no quedará así, Recluta!')]); poseOn(e, null);
    }
    say('¡Chatot usa un Orbe Escape!'); await flash(900);
    e.escaped = true; e.hp = 0;
  } finally { state.dcut = false; }
  defeatEnemy(e, by);   // la derrota de siempre: Pokés, experiencia, la MT… y la mazmorra se completa
}

// =====================================================================
// Sala del jefe despejada: si era el jefe final, la mazmorra se completa sola; en las mazmorras sin fin aparece la escalera.
// Espera a que se cierren los mensajes (entrega de la MD, reclutamiento…).
function arenaCleared() {
  if (!state.dungeon?.arena || state.arenaDone || state.enemies.some(e => e.isBoss && e.hp > 0)) return;
  state.arenaDone = true;
  const go = () => {
    if (state.dialog || state.menu || state.busy) return setTimeout(go, 200);
    const def = state.dungeonDef;
    if (def.floors !== Infinity && state.floor >= def.floors) { playOnce('clear'); endRun('clear'); }
    else { const c = state.dungeon.stairs; state.dungeon.tiles[c.y][c.x] = T.STAIRS; say('Aparece una escalera en el centro de la sala.'); render(); }
  };
  setTimeout(go, 700);
}
// Lo que dicen los jefes al llegar a su sala
const BOSS_LINES = {
  chatot: ['¡Alto ahí, recluta!', 'Antes de dejarte ir a mazmorras de verdad, tendrás que superar mi examen.', '¡En guardia! Y nada de llorar después, ¿eh?'],
  celebi: ['El bosque te ha visto crecer piso a piso…', 'Demuéstrame que mereces llegar hasta aquí.'],
  suicune: ['El agua de esta cueva no miente. Veamos si tu corazón es igual de claro.'],
  zapdos: ['¡Has escalado hasta la cima de la tormenta! Aquí mando yo.'],
  mew: ['Hihi… ¿Vienes a jugar? ¡Me encanta jugar!'],
  jirachi: ['Una luz suave llena la sala…', 'Si quieres mi deseo, demuestra que lo mereces.'],
};
// Sala de descanso de la mazmorra (como las de Exploradores del Cielo): sala cerrada con la estatua de Kangaskhan
// arriba y la escalera a la derecha. Sin enemigos, sin viento. La estatua ofrece guardar, volver o seguir.
function newRestArea() {
  const W = CFG.map.w, H = CFG.map.h, rw = 11, rh = 7, rx = Math.floor((W - rw) / 2), ry = Math.floor((H - rh) / 2);
  const tiles = Array.from({ length: H }, () => new Array(W).fill(T.WALL));
  for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) tiles[y][x] = T.FLOOR;
  const statue = { x: rx + Math.floor(rw / 2), y: ry }, stairs = { x: rx + rw - 2, y: ry + Math.floor(rh / 2) };
  tiles[statue.y][statue.x] = T.WALL; tiles[stairs.y][stairs.x] = T.STAIRS;
  const room = { x: rx, y: ry, w: rw, h: rh };
  musicZone = null; state.floorTurns = 0;
  for (const m of [state.player, ...state.team]) if (m) m.stages = {};
  const bossNext = ['legendary', 'bigLegendary', 'jirachi'].includes(floorKind(state.dungeonDef, state.floor, state.flags));
  showCard(state.dungeonDef.name, bossNext ? 'Antes del jefe' : 'Zona de descanso');
  Object.assign(state, { dungeon: { tiles, rooms: [room], start: { x: statue.x, y: ry + rh - 1 }, stairs, stairsRoom: room, restArea: true, statue },
    enemies: [], groundItems: [], npcs: [], monsterHouse: null, shop: null, weather: 'none' });
  const p = state.player; Object.assign(p, state.dungeon.start); p.facing = [0, -1];
  for (const a of state.team) { const spot = DIRS8.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).find(s => walkableFor(a, s.x, s.y) && !occupied(s.x, s.y)); Object.assign(a, spot || { x: p.x, y: p.y }); }
  state.seen = Array.from({ length: H }, () => new Array(W).fill(false));
  playTrack('rest'); updateVisibility(); render();
  say('Una estatua de Kangaskhan vigila la sala. Háblale (Z) para guardar, volver o seguir.');
}
// Dibujo de la sala de descanso: si hay imagen (dungeon_rest.png) cubre la sala y su borde;
// si no, se dibuja una estatua de piedra genérica sobre su casilla
let restImg; (() => { const src = window.__ASSETS?.dungeon_rest; if (!src) return; const im = new Image(); im.onload = () => { restImg = im; render(); }; im.src = src; })();   // solo si se ha añadido esa imagen
function drawRestArea(ox, oy, tile) {
  const r = state.dungeon.rooms[0], s = state.dungeon.statue;
  if (restImg) { ctx.drawImage(restImg, (r.x - 1 - ox) * tile, (r.y - 1 - oy) * tile, (r.w + 2) * tile, (r.h + 2) * tile); return; }
  const px = (s.x - ox) * tile, py = (s.y - oy) * tile;
  ctx.fillStyle = '#6b6258'; ctx.fillRect(px + 2, py + tile * 0.62, tile - 4, tile * 0.34);                      // pedestal
  ctx.fillStyle = '#8d857a'; ctx.beginPath(); ctx.ellipse(px + tile / 2, py + tile * 0.4, tile * 0.34, tile * 0.36, 0, 0, Math.PI * 2); ctx.fill();   // cuerpo de piedra
  ctx.fillStyle = '#a79f93'; ctx.beginPath(); ctx.ellipse(px + tile / 2, py + tile * 0.16, tile * 0.2, tile * 0.16, 0, 0, Math.PI * 2); ctx.fill();   // cabeza
  ctx.strokeStyle = '#4a433b'; ctx.lineWidth = 1; ctx.strokeRect(px + 2.5, py + tile * 0.62 + 0.5, tile - 5, tile * 0.34 - 1);
}
function openStatueMenu() {
  const boss = ['legendary', 'bigLegendary', 'jirachi'].includes(floorKind(state.dungeonDef, state.floor, state.flags));
  openMenu({ title: 'Estatua de Kangaskhan', items: [boss ? 'Seguir hacia el jefe' : 'Seguir explorando', 'Guardar y pausar', 'Volver al gremio y cobrar', 'Cancelar'],
    onCancel: () => { state.menu = null; render(); },
    onSelect: i => { state.menu = null; if (i === 0) say('La escalera de la derecha te lleva al siguiente piso.'); else if (i === 1) pauseRun(); else if (i === 2) endRun('exit'); render(); } });
}
function newFloor() {
  const def0 = state.dungeonDef;
  if (state.player) track('floor_enter', { next: state.floor, prevTurns: state.floorTurns || 0, hp: pct(state.player), belly: Math.round(state.player.belly ?? 0), bag: state.inventory?.length || 0, team: state.team.length });
  state.arenaDone = false; state.feed = [];
  musicZone = null;
  state.floorTurns = 0; // el viento cuenta los turnos de cada piso
  setTimeout(updateDungeonMusic, 0);   // tema del piso (tras montar la planta)
  for (const m of [state.player, ...state.team]) if (m) { m.stages = {}; m.speed = 0; m.speedTurns = 0; } // los cambios de estadísticas (y de velocidad) duran lo que dura el piso
  state.freeActs = 0;
  showCard(def0.name, `B${state.floor}F`); setTimeout(() => dungeonTips(), 1200);   // consejos del Campo de Entrenamiento (tras el cartel)
  state.rng = makeRng(floorSeed(state.run.seed, state.floor));
  const built = buildFloor(state.rng, state.dungeonDef, state.floor, state.missions, state.flags, state.run.seed);
  state.era = built.dungeon.eraId || state.dungeonDef.id; state.weather = built.weather || 'none';
  for (const e of [...built.enemies, ...(built.npcs || [])]) { const m = Sprites.mons[e.species]; if (m && !m.requested) Sprites.ensure(m); }   // se descargan ya, antes de que se vean
  Object.assign(state, { dungeon: built.dungeon, enemies: built.enemies, groundItems: built.groundItems, npcs: built.npcs, monsterHouse: built.monsterHouse, shop: built.shop ? { ...built.shop, unpaid: [], robbed: false } : null });
  const p = state.player, def = state.dungeonDef;
  Object.assign(p, state.dungeon.start); p.facing = [0, -1];
  // el equipo aparece alrededor del líder
  for (const a of state.team) { const spot = DIRS8.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).find(s => walkableFor(a, s.x, s.y) && !occupied(s.x, s.y)); Object.assign(a, spot || { x: p.x, y: p.y }); a.facing = [0, -1]; }
  state.seen = Array.from({ length: CFG.map.h }, () => new Array(CFG.map.w).fill(false));
  floorStartTraits(); updateVisibility(); render();
  (built.messages || []).forEach(say);
  for (const m of state.missions) if (!m.done && m.type === 'explorar' && m.dungeonId === def.id && state.floor >= m.floor) { m.done = true; say(`¡Misión de exploración cumplida: B${m.floor}F alcanzado!`); }
  if (built.kind === 'jirachi' || state.dungeon.arena) {
    // el jefe habla al llegar (la sala de descanso anterior ya ofrecía guardar o volver)
    if (def.id === 'entrenamiento' && built.boss?.species === 'chatot') { chatotBossIntro(built.boss); }
    else {
    const boss = built.boss, lines = BOSS_LINES[boss?.species] || [boss?.big ? `${boss.name} te espera con sus súbditos.` : `${boss?.name} aguarda al final de la sala. Su presencia llena el aire.`];
    openDialog(lines.map(t => ({ who: BOSS_LINES[boss?.species] ? boss.name : undefined, sp: BOSS_LINES[boss?.species] ? boss.species : undefined, mood: 'Determined', text: t })));
    }
  } else if (built.kind === 'miniboss') say(`B${state.floor}F. Un guardián bloquea las escaleras…`);
  else if (def.eras && (state.floor - 1) % def.eraEvery === 0) say(`B${state.floor}F. El tiempo se retuerce… estás en un eco de ${dungeonById(state.era).name}.`);
  else say(`${def.name} B${state.floor}F.`);
  if (state.weather && state.weather !== 'none') say(`El clima aquí es: ${WEATHER[state.weather].name}.`);
  autosave('floor');   // guardado automático al empezar cada piso
}

const tileAt = (x, y) => (y >= 0 && y < CFG.map.h && x >= 0 && x < CFG.map.w) ? state.dungeon.tiles[y][x] : T.WALL;
const passable = (x, y) => tileAt(x, y) !== T.WALL; // para proyectiles y línea de visión
const walkableFor = (mon, x, y) => passable(x, y) && (canCrossTerrain(mon, tileAt(x, y)) || ((mon === state.player || state.team?.includes(mon)) && (state.slip || mon.iqSkills?.includes('All-Terrain Hiker') || mon.iqSkills?.includes('Absolute Mover')) && [T.WATER, T.LAVA].includes(tileAt(x, y))));
const enemyAt = (x, y) => state.enemies.find(e => e.x === x && e.y === y);
const allyAt = (x, y) => (state.player.x === x && state.player.y === y) ? state.player : state.team.find(a => a.x === x && a.y === y);
const npcAt = (x, y) => state.npcs.find(n => n.x === x && n.y === y);
const occupied = (x, y) => !!enemyAt(x, y) || !!allyAt(x, y) || !!npcAt(x, y);
const isAlly = mon => mon === state.player || state.team.includes(mon);
function canMove(mon, dx, dy) {
  const nx = mon.x + dx, ny = mon.y + dy;
  if (!walkableFor(mon, nx, ny)) return false;
  if (dx && dy && (!passable(mon.x + dx, mon.y) || !passable(mon.x, mon.y + dy))) return false;
  return !occupied(nx, ny);
}
const roomOf = e => state.dungeon.rooms.find(rm => e.x >= rm.x && e.x < rm.x + rm.w && e.y >= rm.y && e.y < rm.y + rm.h);
const foesOf = mon => isAlly(mon) ? state.enemies : [state.player, ...state.team];
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
// ¿se puede atacar/pasar en diagonal? no, si una de las dos casillas de la esquina es pared
const cornerFree = (a, b) => { const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y); return !(dx && dy) || (passable(a.x + dx, a.y) && passable(a.x, a.y + dy)); };
function findTargets(userMon, move) {
  if (move.range === 'self') return [userMon];
  if (move.range === 'team') { const side = isAlly(userMon) ? [state.player, ...state.team] : state.enemies, room = roomOf(userMon); return side.filter(m => m === userMon || (room ? roomOf(m) === room : cheb(m, userMon) <= 1)); }
  const foes = foesOf(userMon);
  if (move.range === 'room') {
    const room = roomOf(userMon);
    return foes.filter(f => room ? f.x >= room.x - 1 && f.x <= room.x + room.w && f.y >= room.y - 1 && f.y <= room.y + room.h : cheb(f, userMon) <= 1);
  }
  if (move.range === 'around') return foes.filter(f => cheb(f, userMon) <= (move.dist || 1)); // todos los enemigos a tu alrededor
  const [dx, dy] = userMon.facing, dist = move.range === 'line' ? move.dist : 1;
  let x = userMon.x, y = userMon.y;
  for (let i = 0; i < dist; i++) {
    if (dx && dy && (!passable(x + dx, y) || !passable(x, y + dy))) return [];
    x += dx; y += dy;
    if (!passable(x, y)) return [];
    const f = foes.find(f => f.x === x && f.y === y); if (f) return [f];
    if (allyAt(x, y) || enemyAt(x, y)) return []; // alguien en medio bloquea
  }
  return [];
}
function useMove(userMon, move) {
  state.attacked = true;
  if (userMon === state.player && move?.name) { const st = runStats(); st.moves[move.name] = (st.moves[move.name] || 0) + 1; }   // el turno hará una pausa para que se vea
  playAnim(userMon, move.cat === 'spec' && Sprites.mons[userMon.species]?.anims?.Shoot ? 'Shoot' : 'Attack');   // animación de ataque
  const ally = isAlly(userMon), targets = findTargets(userMon, move), who = ally ? userMon.name : `${userMon.name} salvaje`;
  // la animación del movimiento (si se ve): lo que pasa en el impacto (dolor, sonido, número) llega cuando llega el golpe
  const seen = !FAST() && (isVisibleNow(userMon.x, userMon.y) || targets.some(t => isVisibleNow(t.x, t.y)));
  const fx = seen ? spawnMoveFx(move, userMon, targets) : null, at = t => (fx ? fx.impactDelay(t) : 0);
  const later = (ms, f) => (ms > 0 ? setTimeout(() => { f(); render(); }, ms) : f());
  if (!targets.length) { say(`${who} usa ${move.name}, pero no acierta a nadie.`); return; }
  if (targets.length > 1) say(`${who} usa ${move.name} contra ${targets.length} objetivos.`);
  const ownSide = move.range === 'self' || move.range === 'team';
  if (ownSide) say(`${who} usa ${move.name}.`);
  for (const target of targets) {
    if (ownSide) {                                                     // movimientos sobre uno mismo o el equipo: no fallan
      if (move.heal) { const h = Math.min(target.maxHp - target.hp, Math.floor(target.maxHp * move.heal / 100)); target.hp += h; say(`${target.name} recupera ${h} PS.`); }
      if (move.statFx) applyStages(target, move.statFx.changes).forEach(say);
      continue;
    }
    if (!hitCheck(state.rng, move, userMon, target, state.weather)) { say(`${who} usa ${move.name}, pero falla contra ${target.name}.`); if (isVisibleNow(target.x, target.y)) { later(at(target), () => playSfx('miss')); state.effects.push({ x: target.x, y: target.y, text: 'MISS', t: performance.now() + at(target), color: '#ffffff', miss: true }); } continue; } // acierto real: dos tiradas con estadios
    if (move.name !== BASIC.name) target.hitByMove = true;           // para la experiencia completa
    if (target.asleep) { target.asleep = false; say(`${target.name} se despierta.`); } // dormía de forma natural: se despierta al primer golpe
    // golpes múltiples (Doble Patada, Pin Misil…): cada golpe se calcula aparte
    const hits = Math.max(1, move.strikes || 1); let dmg = 0, eff = 1, crit = false;
    let abil = null;
    for (let h = 0; h < hits && target.hp - dmg > 0; h++) { const r = damage(state.rng, { ...userMon, isEnemy: !ally, isLeader: userMon === state.player }, target, move, state.weather); if (r.absorbed || r.note) abil = r; dmg += r.dmg; eff = r.eff; crit = crit || r.crit; }
    if (move.power && abil?.absorbed) { const h = Math.max(1, Math.floor(target.maxHp / 4)); target.hp = Math.min(target.maxHp, target.hp + h); say(`${who} usa ${move.name}, pero ${target.name} lo absorbe (${abil.note}) y recupera ${h} PS.`); continue; }
    if (move.power && abil?.note && dmg === 0) { say(`${who} usa ${move.name}, pero a ${target.name} no le afecta (${abil.note}).`); continue; }
    if (move.power && target.exAbsorb?.includes(move.type)) {   // objeto exclusivo: absorbe ese tipo y recupera PS
      target.hp = Math.min(target.maxHp, target.hp + dmg); say(`${target.name} absorbe ${move.name} y recupera ${dmg} PS.`);
      state.effects.push({ x: target.x, y: target.y, text: `+${dmg}`, t: performance.now(), color: '#7fd67f' }); continue;
    }
    if (move.power) {
      const sfx = !ally ? 'hurt' : crit ? 'crit' : eff > 1 ? 'hitSuper' : eff < 1 ? 'hitWeak' : 'hit', vis = isVisibleNow(target.x, target.y);
      later(at(target), () => { if (dmg > 0) playAnim(target, 'Hurt'); if (vis) playSfx(sfx); });   // dolor y sonido, en el impacto
      if (fx && eff > 1 && dmg > 0) spawnSuperEffective(target, at(target));   // ¡súper eficaz!: destello grande y temblor
      target.hp = Math.max(0, target.hp - dmg);
      if (onOurSide(target) && !onOurSide(userMon)) { target.lastHitBy = { sp: userMon.species, move: move.name || 'Ataque', lv: userMon.level, boss: !!userMon.isBoss }; runStats().taken += dmg; }
      else if (onOurSide(userMon) && !onOurSide(target)) runStats().dealt += dmg;
      const note = (crit ? ' ¡Golpe crítico!' : '') + (eff === 0 ? ' Apenas afecta.' : eff > 1 ? ' ¡Es muy eficaz!' : eff < 1 ? ' No es muy eficaz…' : '');
      if (targets.length === 1) say(`${who} usa ${move.name}: ${dmg} de daño a ${target.name}.${note}`);
      state.effects.push({ x: target.x, y: target.y, text: `-${dmg}`, t: performance.now() + at(target), color: ally ? '#e9e3d3' : '#c95c5c', crit, eff });   // el número, en el impacto
      if (wakeOnHit(target)) say(`${target.name} se despierta.`);
      if (move.drain) userMon.hp = Math.min(userMon.maxHp, userMon.hp + Math.floor(dmg * move.drain));
      if (dmg > 0 && cheb(userMon, target) <= 1) {
        if (hasAbility(target, 'STENCH') && state.rng.random() < 0.1) terrify(userMon, 5, `¡El hedor de ${target.name} asusta a ${userMon.name}!`);   // Hedor
        const cs = contactStatus(state.rng, userMon, target, move);   // Elec. Estática, Punto Tóxico, Cuerpo Llama, Efecto Espora
        if (cs && applyStatus(state.rng, userMon, cs, 1)) say(`¡${userMon.name} está ${STATUS[cs].name.toLowerCase()} por la habilidad de ${target.name}!`);
        if (target.iqSkills?.includes('Counter Hitter') && target.hp > 0 && state.rng.random() < 0.3) { const back = Math.max(1, Math.floor(dmg / 4)); userMon.hp = Math.max(0, userMon.hp - back); say(`¡${target.name} contraataca: ${back} de daño!`); if (userMon.hp <= 0) { ally ? downed(userMon) : defeatEnemy(userMon, target); } }
      }
    } else say(`${who} usa ${move.name}.`);
    if (move.effect && target.hp > 0 && applyStatus(state.rng, target, move.effect.status, move.effect.chance)) say(`${target.name} está ${STATUS[move.effect.status].name.toLowerCase()}.`);
    // cambios de estadísticas: los de estado siempre; los de daño, con su probabilidad (a ti si te suben algo, si no al rival)
    if (move.statFx && target.hp > 0 && (!move.power || state.rng.random() * 100 < move.statFx.chance)) applyStages(move.power && move.statFx.raiseSelf ? userMon : target, move.statFx.changes).forEach(say);
    if (target.hp <= 0) { ally ? defeatEnemy(target, userMon) : downed(target); if (state.dead) return; }
  }
}

// ---------- música de la mazmorra: tema de la mazmorra (según la era), jefe, guardián Mega, Casa Monstruo o tienda ----------
const DUNGEON_TRACK = { entrenamiento: 'bosque', bosque: 'bosque', cueva: 'cueva', monte: 'monte', ruinas: 'ruinas', tiempo: 'tiempo', suenos: 'suenos' };
function updateDungeonMusic() {
  if (state.scene !== 'dungeon' || !state.player) return;
  if (state.dungeon?.restArea) return playTrack('rest');
  const p = state.player, alive = state.enemies.filter(e => e.hp > 0);
  let key;
  if (alive.some(e => e.mega)) key = 'mega';
  else if (alive.some(e => e.isBoss && !e.shopkeeper) || state.dungeon.arena) key = 'boss';
  else if (state.monsterHouse?.triggered && alive.some(e => e.house)) key = 'monster_house';
  else if (state.shop && !state.shop.robbed && roomOf(p) && roomOf(p) === state.shop.room) key = 'shop';
  else key = DUNGEON_TRACK[dungeonById(state.era || state.dungeonDef.id)?.id] || DUNGEON_TRACK[state.dungeonDef.id] || 'bosque';
  playTrack(key);
}

// ---------- reloj del piso: regeneración, viento y aparición de enemigos (valores de Exploradores del Cielo) ----------
// Regeneración real: cada turno se acumula el PS máximo y por cada 200 acumulados se recupera 1 PS (≈ vida entera en 200 turnos).
function regen(mon) {
  if (mon.hp <= 0 || mon.hp >= mon.maxHp || (mon.status && STATUS[mon.status.kind]?.noRegen)) return;
  mon.regenAcc = (mon.regenAcc || 0) + mon.maxHp;
  while (mon.regenAcc >= CFG.regenSpeed && mon.hp < mon.maxHp) { mon.regenAcc -= CFG.regenSpeed; mon.hp++; }
}
// Devuelve false si el viento ha expulsado al equipo
function floorClock() {
  if (state.dungeon?.restArea) return true;   // sala de descanso: sin viento ni enemigos nuevos
  state.floorTurns = (state.floorTurns || 0) + 1;
  for (const e of state.enemies) regen(e);
  const left = CFG.turnLimit - state.floorTurns;
  const warn = { [CFG.windWarnings[0]]: 'Algo se agita…', [CFG.windWarnings[1]]: 'Algo se acerca…', [CFG.windWarnings[2]]: '¡Se está acercando!' }[left];
  if (warn) { stopPassing(); playSfx('wind'); say(`Sopla un viento extraño. ${warn}`); state.effects.push({ x: state.player.x, y: state.player.y, text: '〰', t: performance.now(), color: '#b8c0cc' }); openDialog([{ text: `Sopla un viento extraño… ${warn}` }, { text: 'Si te quedas mucho más en este piso, el viento te expulsará de la mazmorra.' }]); }
  if (left <= 0 && !state.dead) {
    state.dead = true; say('¡Está justo al lado! ¡Una ráfaga te arrastra fuera de la mazmorra!');
    (async () => { await sleep(600); await showCard('Una ráfaga misteriosa te expulsa…', `${state.dungeonDef.name} B${state.floor}F`, 2000); endRun('death'); })();
    return false;
  }
  // un enemigo nuevo cada 36 turnos, lejos de la vista, hasta un máximo de 15 en el piso
  const bossFloor = state.enemies.some(e => e.isBoss) || state.dungeon.arena;
  if (state.floorTurns % CFG.spawnEvery === 0 && state.enemies.length < CFG.spawnCap && !bossFloor) spawnWild();
  return true;
}
function spawnWild() {
  const def = state.dungeonDef, pool = dungeonById(state.era || def.id)?.pool || def.pool;
  for (let t = 0; t < 40; t++) {
    const rm = state.rng.pick(state.dungeon.rooms);
    const x = rm.x + state.rng.int(0, rm.w - 1), y = rm.y + state.rng.int(0, rm.h - 1);
    if (state.dungeon.tiles[y][x] !== T.FLOOR || occupied(x, y) || isVisibleNow(x, y)) continue;
    const lv = Math.max(1, Math.round((def.lvl || 1) + state.floor * 0.5 + state.rng.int(-1, 1)));
    const e = createMon(state.rng.pick(pool), lv, { x, y, asleep: false });
    state.enemies.push(e); return e;
  }
  return null;
}

// ---------- derrotas, experiencia, reclutamiento ----------
function defeatEnemy(e, by) {
  if (e.isBoss && !e.bowedOut && e.species === 'chatot' && state.dungeonDef?.id === 'entrenamiento') { chatotBowsOut(e, by); return; }   // se queda en pie para su escena
  if (by && onOurSide(by)) runStats().kills++;   // telemetría: enemigos derrotados en la exploración
  if (!e.escaped) { playSfx('faint'); addFading(e); }   // (Chatot se va con un Orbe Escape: sin desmayo)
  state.enemies = state.enemies.filter(x => x !== e);
  const p = e.shopkeeper ? 0 : pokesFor(e.species, state.floor); state.runPokes += p; if (p) setTimeout(() => playSfx('coin'), 180);
  say(e.shopkeeper ? `¡${e.name} derrotado! (Un Kecleon nunca lleva Pokés encima…)` : `¡${e.name} derrotado! +${p} Pokés.`);
  const exp = expGained(e.species, e.level, !!e.hitByMove); // ×0,5 si solo recibió ataques normales
  say(`+${exp} de experiencia.`);
  const xp = m => Math.round(exp * (m.iqSkills?.includes('Exp. Elite') ? 1.25 : 1));   // Élite de Experiencia
  gainExp(state.player, xp(state.player)); for (const a of state.team) gainExp(a, xp(a)); // en PMD cada miembro recibe la experiencia entera
  if (e.missionId) { const m = state.missions.find(m => m.id === e.missionId); if (m) { m.done = true; say('¡Objetivo de misión cumplido! Cobrarás al volver al gremio.'); } }
  if (e.jirachiEvent) { jirachiNextPhase(e); arenaCleared(); return; }   // tras la última fase, la sala queda despejada
  if (e.isLegendary) {
    if (state.inventory.length < bagSizeFor(meta?.rankPts)) { addItem(`MD: ${e.md}`); say(`¡${e.name} te entrega una Máquina Definitiva: ${e.md}! Úsala desde la bolsa para enseñársela a quien pueda aprenderla.`); }
    else { (state.mdToStorage ||= []).push(e.md); say(`¡${e.name} te entrega una Máquina Definitiva: ${e.md}! Tu bolsa está llena: la guardará Kangaskhan en su depósito.`); }
    if (e.big) { addItem('Diamante'); say('Entre sus restos brilla un Diamante.'); }
  } else if (e.dropsStone) {
    (state.stonesFound ||= []).push(e.dropsStone.id);
    const dlg = MEGA_DIALOG[e.species];
    if (dlg) openDialog(dlg.defeat.map(t => ({ who: e.name, text: t, font: dlg.font, color: dlg.color })), () => say(`Recoges la ${e.dropsStone.name}. No sabes usarla… llévasela al maestro Pidgeot.`));
    else say(`¡${e.name} suelta su ${e.dropsStone.name}!`);
  }
  else if (e.isBoss && !e.shopkeeper) { const move = state.rng.pick(TM_POOL); addItem(`MT: ${move}`); say(`${e.name} deja caer una MT: ${move}.`); }
  dropCarried(e);   // solo suelta lo que hubiera recogido, y al suelo (no a tu bolsa)
  tryRecruit(e, by);
  arenaCleared();   // ¿era el jefe de la sala?
}
function tryRecruit(e, by) {
  if (by !== state.player || cheb(e, state.player) > 1 || e.minion || e.mega || e.noRecruit) return; // golpe final del líder y adyacente (Kecleon incluido: tasa -49 %); los Mega guardianes no se reclutan
  if (state.team.length >= CFG.teamMax) return;
  if (rankOf(meta.rankPts) < RECRUIT_MIN_RANK) { if (!state.recruitHintShown) { state.recruitHintShown = true; say(`(Los Pokémon aún no confían en ti: podrás reclutar a partir de rango ${RANKS[RECRUIT_MIN_RANK].name}.)`); } return; }
  const chance = recruitChance(state.player, e, meta.starters.includes(e.species) || state.team.some(a => a.species === e.species)) + (state.player.iqSkills?.includes('Fast Friend') ? 1 : 0);
  if (chance <= 0 || state.rng.random() * 100 >= chance) return;
  const recruit = createMon(e.species, e.level, { x: e.x, y: e.y, tactic: 'seguir', floors: 1, held: null });   // el piso en que se une ya cuenta
  if (e.shopkeeper) say('Kecleon: "…Vale. Tienes agallas. Me apunto, pero de esto ni una palabra a mi hermano."');
  recruit.hp = Math.ceil(recruit.maxHp / 2);
  openMenu({ title: `¡${e.name} quiere unirse al equipo! (${chance.toFixed(0)} %)`, items: ['Aceptar', 'Rechazar'], onSelect: i => {
    if (i === 1) { say(`${e.name} se marcha cabizbajo.`); return; }
    playSfx('recruit'); recruit.runStartLevel = recruit.level; state.team.push(recruit); track('recruit', { species: recruit.species, level: recruit.level }); if (state.diary) state.diary.recruited++; say(`¡${e.name} se une al equipo!`);
    // mote, como en el original
    setTimeout(() => openMenu({ title: `¿Quieres ponerle un mote a ${recruit.name}?`, items: ['Sí', 'No'], onSelect: async k => {
      if (k !== 0) return;
      const nick = await askText(`Mote para ${SPECIES[recruit.species].name}`, 10);
      if (nick) { recruit.name = nick; recruit.nick = nick; say(`¡A partir de ahora, se llamará ${nick}!`); render(); }
    } }), 50);
    if (SPECIES[e.species].legendary) { state.recruitedLegendaries.push(e.species); say(`Un legendario… sólo podrá acompañarte en la Mazmorra de los Sueños.`); }
    render();
  } });
}
function jirachiNextPhase(e) {
  const next = JIRACHI_PHASES[e.phase + 1];
  if (!next) { // Jirachi derrotado: se une siempre, vínculo instantáneo
    say('Jirachi: "Has vencido a mis guardianes y a mí. Mi deseo es acompañarte."');
    const j = createMon('jirachi', e.level, { x: e.x, y: e.y, tactic: 'seguir', floors: CFG.bondFloors, held: null });
    j.runStartLevel = j.level; state.team.push(j); state.recruitedLegendaries.push('jirachi'); state.flags.jirachiUnlocked = true;
    say('¡Jirachi se une al equipo! Vínculo instantáneo.'); return;
  }
  const boss = createMon(next.species, e.level, { statMult: next.statMult, x: e.x, y: e.y, asleep: false, isBoss: true, isLegendary: true, phase: e.phase + 1, jirachiEvent: true });
  computeStats(boss); boss.hp = boss.maxHp; state.enemies.push(boss);
  say(next.species === 'jirachi' ? 'Jirachi: "Ahora, enfréntate a mí."' : `Jirachi invoca a ${boss.name}.`);
}
// dropIfFull: si la bolsa está llena, el objeto nuevo cae al suelo (botines). Al recoger uno del suelo NO se duplica: se queda donde estaba.
function addItem(name, dropIfFull = true) { if (state.inventory.length >= bagSizeFor(meta?.rankPts)) { say(dropIfFull ? `La bolsa está llena, ${name} se queda en el suelo.` : `La bolsa está llena: ${name} se queda en el suelo.`); if (dropIfFull) state.groundItems.push({ x: state.player.x, y: state.player.y, name }); return false; } state.inventory.push(name); return true; }
// Experiencia y subidas de nivel. Como en el original, cada subida se anuncia en un cuadro de diálogo con lo que
// ha subido cada estadística, y cada movimiento nuevo también ("¡X aprende Y!").
function levelDialog(pages, then) {
  if (!pages.length) return then?.();
  if (state.dialog) { const d = state.dialog, prev = d.onDone; d.pages.push(...pages); d.onDone = () => { prev?.(); then?.(); }; render(); }
  else openDialog(pages, then);
}
function gainExp(mon, n) {
  mon.exp += n;
  const pages = [], offers = [];
  while (mon.exp >= expToNext(mon.species, mon.level)) {
    mon.exp -= expToNext(mon.species, mon.level);
    const before = { hp: mon.maxHp, atk: mon.atk, def: mon.def, spa: mon.spa, spd: mon.spd };
    mon.level++; computeStats(mon); mon.hp += mon.maxHp - before.hp;
    const gains = [['PS', mon.maxHp - before.hp], ['Ataque', mon.atk - before.atk], ['Defensa', mon.def - before.def], ['At. Esp.', mon.spa - before.spa], ['Def. Esp.', mon.spd - before.spd]].filter(([, v]) => v > 0);
    say(`¡${mon.name} sube al nivel ${mon.level}!`); track('level_up', { species: mon.species, level: mon.level, leader: mon === state.player });
    pages.push({ who: mon.name, sp: mon.species, mood: 'Happy', text: `¡${mon.name} sube al nivel ${mon.level}!${gains.length ? '  ' + gains.map(([k, v]) => `${k} +${v}`).join(' · ') : ''}` });
    for (const m of [SPECIES[mon.species].learnset[mon.level]].flat().filter(Boolean)) {
      if (mon.moves.some(x => x.name === m) || !MOVES[m]) continue;
      if (mon === state.player) { if (mon.moves.length < 4) { mon.moves.push({ name: m, pp: MOVES[m].pp }); say(`¡${mon.name} aprende ${m}!`); pages.push({ who: mon.name, sp: mon.species, mood: 'Joyous', text: `¡${mon.name} aprende ${m}!` }); } else offers.push(m); continue; }
      const old = mon.moves.length >= 4 ? mon.moves.shift().name : null;   // compañeros: olvidan el más antiguo
      mon.moves.push({ name: m, pp: MOVES[m].pp }); say(old ? `${mon.name} olvida ${old} y aprende ${m}.` : `¡${mon.name} aprende ${m}!`);
      pages.push({ who: mon.name, sp: mon.species, mood: 'Joyous', text: old ? `${mon.name} olvida ${old}… ¡y aprende ${m}!` : `¡${mon.name} aprende ${m}!` });
    }
  }
  // tras los mensajes, el líder decide qué olvidar si ya tenía 4 movimientos
  const nextOffer = () => { const m = offers.shift(); if (m) offerMove(m, false, nextOffer); };
  if (pages.length) { playSfx(pages.some(pg => /sube al nivel/.test(pg.text)) ? 'levelup' : 'learn'); levelDialog(pages, nextOffer); }
}
function offerMove(name, permanent, then) {
  const p = state.player;
  if (p.moves.some(m => m.name === name)) { say(`${p.name} ya conoce ${name}.`); return then?.(); }
  const entry = { name, pp: MOVES[name].pp, permanent };
  if (p.moves.length < 4) { p.moves.push(entry); say(`¡${p.name} aprende ${name}!`); levelDialog([{ who: p.name, sp: p.species, mood: 'Joyous', text: `¡${p.name} aprende ${name}!` }], then); return; }
  openMenu({ title: `Aprender ${name}`, items: [...p.moves.map(m => m.name), 'No aprender'], icons: p.moves.map(m => MOVES[m.name].type), onCancel: () => { state.menu = null; say(`${p.name} no aprende ${name}.`); render(); then?.(); }, onSelect: i => { if (i < 4) { say(`${p.name} olvida ${p.moves[i].name} y aprende ${name}.`); p.moves[i] = entry; } else say(`${p.name} no aprende ${name}.`); state.menu = null; render(); then?.(); } });
}
function downed(mon) {
  playSfx('faint'); if (mon !== state.player) addFading(mon);
  if (mon === state.player) {
    const i = state.inventory.indexOf('Semilla Revivir');
    if (i >= 0) { state.inventory.splice(i, 1); mon.hp = mon.maxHp; mon.status = null; say('¡La Semilla Revivir te revive!'); return; }
    state.dead = true; say(`${mon.name} se ha quedado sin PS…`);
    track('death', { by: mon.lastHitBy || null, hunger: (mon.belly ?? 1) <= 0, turn: state.turn, floorTurns: state.floorTurns || 0, near: state.enemies.filter(e => e.hp > 0 && cheb(e, mon) <= 2).length, team: state.team.length, bag: state.inventory.length });
    const where = `${state.dungeonDef.name} B${state.floor}F`;
    playOnce('defeat');
    (async () => { await sleep(700); await showCard('Te han derrotado…', where, 2000); deathChoice(); })();
    return;
  }
  state.team = state.team.filter(a => a !== mon);
  if (mon.floors >= CFG.bondFloors) { state.bondedLost.push({ species: mon.species, floors: mon.floors, nick: mon.nick }); say(`${mon.name} cae, pero vuestro vínculo ya está forjado.`); }
  else { state.lostRecruits.push(mon.species); say(`${mon.name} cae… y se marcha.`); }
}

// ---------- máquinas (MT de los jefes, MD de los legendarios) ----------
// Son objetos de la bolsa: al usarlos eliges quién la aprende, y solo la aprenden los compatibles (datos del juego original).
const isMachine = name => name.startsWith('MT: ') || name.startsWith('MD: ');
function useMachine(index) {
  const name = state.inventory[index], move = name.slice(4), isMD = name.startsWith('MD: ');
  const who = [state.player, ...state.team];
  openMenu({ title: `¿Quién aprende ${move}?`, items: who.map(m => `${m.name} Nv${m.level}${canLearnMachine(m.species, move) ? '' : ' — no puede'}`), onCancel: () => { state.menu = null; render(); },
    onSelect: i => {
      const mon = who[i]; state.menu = null;
      if (!canLearnMachine(mon.species, move)) { say(`${mon.name} no puede aprender ${move}.`); render(); return; }
      if (mon.moves.some(x => x.name === move)) { say(`${mon.name} ya conoce ${move}.`); render(); return; }
      state.inventory.splice(state.inventory.indexOf(name), 1);
      if (mon === state.player) { if (isMD && !state.earnedMD.includes(move)) state.earnedMD.push(move); offerMove(move, isMD); }
      else {   // compañero: aprende directamente; si ya tiene 4, olvida el más antiguo
        const old = mon.moves.length >= 4 ? mon.moves.shift().name : null;
        mon.moves.push({ name: move, pp: MOVES[move].pp }); say(old ? `${mon.name} olvida ${old} y aprende ${move}.` : `${mon.name} aprende ${move}.`);
      }
      render();
    } });
}

// ---------- animaciones de combate ----------
function playAnim(mon, name) {
  const m = Sprites.mons[mon?.species], a = m?.anims?.[name]; if (!a) return false;
  Sprites.ensureAnim(m, name);
  mon.anim = { name, t0: performance.now(), dur: (a.durations?.length ? a.durations.reduce((s, d) => s + d, 0) : 24) * 1000 / 60 };
  return true;
}
// Pokémon que caen: se quedan un momento haciendo su animación (o desvaneciéndose) antes de desaparecer
function addFading(mon) {
  if (state.scene !== 'dungeon' || !isVisibleNow(mon.x, mon.y)) return;
  const f = { species: mon.species, x: mon.x, y: mon.y, facing: mon.facing, fading: performance.now() };
  if (!playAnim(f, 'Faint')) { playAnim(f, 'Hurt'); f.fadeOut = true; }
  f.until = performance.now() + Math.max(650, f.anim?.dur || 0) + 250;
  (state.fading ||= []).push(f); scheduleRender();
}

// ---------- tilesets de las mazmorras originales (formato DTEF, de PMDCollab/RawAsset) ----------
// Cada hoja (tileset_0/1/2 = variantes) lleva los tres terrenos lado a lado: paredes (columnas 0–5), agua o lava (6–11)
// y suelo (12–17), con 6×8 piezas de 24 px. La pieza se elige por qué vecinas son del mismo terreno (DTEF_SLOT).
const TILESETS = {};
function tileset(name) {
  if (TILESETS[name]) return TILESETS[name].ready ? TILESETS[name] : null;
  const ts = TILESETS[name] = { ready: false, img: [], empty: [] }; let left = 3;
  [0, 1, 2].forEach(v => {
    const im = new Image();
    im.onload = () => {
      ts.img[v] = im;
      if (v > 0) {   // qué piezas trae cada variante alternativa (las vacías se toman de la principal)
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const cx = c.getContext('2d'); cx.drawImage(im, 0, 0);
        const d = cx.getImageData(0, 0, im.width, im.height).data;
        ts.empty[v] = [...Array(18 * 8)].map((_, i) => { const X = (i % 18) * 24, Y = Math.floor(i / 18) * 24; for (let yy = 0; yy < 24; yy += 3) for (let xx = 0; xx < 24; xx += 3) if (d[((Y + yy) * im.width + X + xx) * 4 + 3] > 0) return false; return true; });
      }
      if (--left === 0) { ts.ready = true; scheduleRender(); }
    };
    im.onerror = () => { if (v === 0) ts.failed = true; else if (--left === 0) { ts.ready = !!ts.img[0]; scheduleRender(); } };
    im.src = asset(`tiles_${name}_${v}`, `client/assets/tilesets/${name}/tileset_${v}.png`);
  });
  return null;
}
const terrainOf = (x, y) => { if (y < 0 || x < 0 || y >= CFG.map.h || x >= CFG.map.w) return 'wall'; const t = state.dungeon.tiles[y][x]; return t === T.WALL ? 'wall' : t === T.WATER ? 'water' : t === T.LAVA ? 'lava' : 'floor'; };
const NB = [[0, 1, 0x01], [1, 1, 0x02], [1, 0, 0x04], [1, -1, 0x08], [0, -1, 0x10], [-1, -1, 0x20], [-1, 0, 0x40], [-1, 1, 0x80]];
// escenario del piso: las mazmorras sin fin viajan por las eras de las demás (su escenario); en las salas de jefe, el suyo propio
function currentTileset() {
  const own = DUNGEON_TILESET[state.dungeonDef?.id];
  return (state.dungeon?.arena && own) ? own : DUNGEON_TILESET[state.era || state.dungeonDef?.id];
}
function drawDtef(t, x, y, px, py, tile) {
  if (state.dungeon?.restArea) return false;
  const cfg = currentTileset(); if (!cfg) return false;
  const terr = terrainOf(x, y), setName = terr === 'lava' ? (cfg.lava || cfg.set) : cfg.set, ts = tileset(setName);
  if (!ts) return false;
  const same = terr === 'floor' ? (a => a !== 'wall') : (a => a === terr);   // el suelo casa con todo lo que no es pared
  let mask = 0; for (const [dx, dy, bit] of NB) if (same(terrainOf(x + dx, y + dy))) mask |= bit;
  const slot = DTEF_SLOT[mask], col0 = terr === 'wall' ? 0 : terr === 'floor' ? 12 : 6;
  const h = ((x * 73856093) ^ (y * 19349663)) >>> 0, cell = Math.floor(slot / 6) * 18 + col0 + slot % 6;
  let v = h % 9 === 0 ? 1 : h % 9 === 1 ? 2 : 0; if (v && (!ts.img[v] || ts.empty[v]?.[cell])) v = 0;   // de vez en cuando, una variante
  const prev = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ts.img[v], (col0 + slot % 6) * 24, Math.floor(slot / 6) * 24, 24, 24, px, py, tile + 0.75, tile + 0.75);   // un pelín más grande: sin huecos al escalar
  ctx.imageSmoothingEnabled = prev; return true;
}

// ---------- ganchos del motor: flechas de estadística (▲ verde / ▼ azul) y sonido de los estados ----------
engineHooks.onStage = (mon, stat, d) => {
  if (state.scene !== 'dungeon' || !isVisibleNow(mon.x, mon.y)) return;
  state.effects.push({ x: mon.x, y: mon.y, text: d > 0 ? '▲' : '▼', t: performance.now(), color: d > 0 ? '#58d068' : '#5aa0f0', big: Math.abs(d) >= 2 });
  playSfx(d > 0 ? 'statUp' : 'statDown');
};
engineHooks.onStatus = (mon) => { if (state.scene === 'dungeon' && mon.x != null && isVisibleNow(mon.x, mon.y)) playSfx('status'); };

// ---------- retratos con emociones (40×40, PMDCollab/SpriteCollab) ----------
const portraitAtlas = new Image(); portraitAtlas.src = asset('portraits_atlas', 'client/assets/portraits/portraits.png'); portraitAtlas.onload = () => { if (meta && (state.player || state.scene === 'hub')) render(); };
// emociones parecidas por si falta la pedida
const MOOD_FALLBACK = { Joyous: ['Happy'], Inspired: ['Happy', 'Determined'], Shouting: ['Angry', 'Determined'], Crying: ['Sad', 'Teary-Eyed', 'Worried'], 'Teary-Eyed': ['Sad', 'Worried'],
  Sigh: ['Worried', 'Sad'], Stunned: ['Surprised'], Dizzy: ['Pain', 'Worried'], Pain: ['Worried'], Determined: ['Angry'], Worried: ['Sad'], Surprised: ['Happy'] };
// Web completa: todas las emociones de cada especie en una tira (client/assets/portraits/full), bajo demanda.
// En la versión ligera ese índice no existe y se usa el atlas.
let PORTRAIT_FULL = null; const portraitStrips = {};
fetch('client/assets/portraits/full/index.json').then(r => r.ok ? r.json() : null).then(j => { PORTRAIT_FULL = j; }).catch(() => {});
function drawPortrait(c, sp, mood, x, y, size) {
  const list = PORTRAIT_FULL?.[sp];
  if (list) {
    let im = portraitStrips[sp];
    if (!im) { im = portraitStrips[sp] = new Image(); im.onload = () => scheduleRender(); im.src = `client/assets/portraits/full/${sp}.png`; }
    if (im.complete && im.naturalWidth) {
      const emo = [mood, ...(MOOD_FALLBACK[mood] || []), 'Normal'].find(e => list.includes(e)) ?? list[0], i = list.indexOf(emo);
      const prev = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false; c.drawImage(im, i * 40, 0, 40, 40, x, y, size, size); c.imageSmoothingEnabled = prev;
      return true;
    }   // mientras llega la tira, el atlas
  }
  const set = PORTRAIT[sp]; if (!set || !portraitAtlas.complete || !portraitAtlas.naturalWidth) return false;
  const emo = [mood, ...(MOOD_FALLBACK[mood] || []), 'Normal'].find(e => set[e] !== undefined); if (emo === undefined) return false;
  const i = set[emo], prev = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false;
  c.drawImage(portraitAtlas, (i % PORTRAIT_COLS) * 40, Math.floor(i / PORTRAIT_COLS) * 40, 40, 40, x, y, size, size);
  c.imageSmoothingEnabled = prev; return true;
}
// quién habla: la especie indicada, un personaje de la aldea, un jefe, o un Pokémon presente (tu equipo, la mazmorra)
const NPC_SPECIES = { Murkrow: 'murkrow', Chatot: 'chatot', Diglett: 'diglett', Dugtrio: 'dugtrio', Kecleon: 'kecleon', Kangaskhan: 'kangaskhan', Gulpin: 'gulpin', Wobbuffet: 'wobbuffet',
  'Kecleon morado': 'kecleon_purple', 'Kecleon verde': 'kecleon', Pidgeot: 'pidgeot', 'Maestro Pidgeot': 'pidgeot', Chansey: 'chansey', Mawile: 'mawile', Bruno: 'ursaring', Ursaring: 'ursaring' };
const SPECIES_BY_NAME = Object.fromEntries(Object.entries(SPECIES).map(([k, s]) => [s.name, k]));
function speakerSpecies(page) {
  if (page.sp) return page.sp;
  const who = page.who; if (!who) return null;
  if (NPC_SPECIES[who]) return NPC_SPECIES[who];
  const mons = [state.player, ...(state.team || []), ...(state.enemies || []), ...(state.npcs || [])].filter(Boolean);
  const m = mons.find(x => x.name === who || x.name === who.replace(/ \(forajido\)$/, '')); if (m) return m.species;
  return SPECIES_BY_NAME[who.replace(/^Mega /, '')] || null;
}
// la emoción, si la línea no la indica: se deduce del texto
function inferMood(page) {
  const t = page.text || '';
  if (/LADR|¡Alto|En guardia|ni se te ocurra|Fuera de aquí/i.test(t)) return 'Angry';
  if (/cuidado|lo siento|preocup|has caído|habíais caído|¿estás bien/i.test(t)) return 'Worried';
  if (/^…|\.\.\.$|…$/.test(t.trim()) && !/!/.test(t)) return 'Sigh';
  if (/gracias|bienvenid|perfecto|estupendo|genial|¡hola|enhorabuena|muy bien|¡por fin/i.test(t)) return 'Happy';
  if (/\?!|¿¡|¡¿|¡Qué/i.test(t)) return 'Surprised';
  if (['legendary', 'bigLegendary', 'jirachi'].includes(state.dungeon?.arena ? 'legendary' : '') && state.enemies?.some(e => e.isBoss && e.name === page.who)) return 'Determined';
  return 'Normal';
}

// ---------- iconos de objetos (16×16, atlas de PMDCollab: gráficos de Mundo Misterioso) ----------
const itemAtlas = new Image(); itemAtlas.src = asset('items_atlas', 'client/assets/items/items.png'); itemAtlas.onload = () => { if (meta && (state.player || state.scene === 'hub')) render(); };   // solo si ya estás jugando
function itemIconIndex(name) {
  if (!name) return null;
  if (name.startsWith('MT: ')) return MACHINE_ICON[MOVES[name.slice(4)]?.type] ?? MACHINE_ICON.Normal;
  if (name.startsWith('MD: ')) return MD_ICON;
  return ITEM_ICON[name] ?? null;
}
function drawItemIcon(c, name, x, y, size) {
  const i = itemIconIndex(name); if (i == null || !itemAtlas.complete || !itemAtlas.naturalWidth) return false;
  const prev = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false;
  c.drawImage(itemAtlas, (i % ICON_COLS) * 16, Math.floor(i / ICON_COLS) * 16, 16, 16, x, y, size, size);
  c.imageSmoothingEnabled = prev; return true;
}
// De un texto de menú («Manzana ×2», «Baya Aranja — 50 P», «💿 Fachada (MD)», «[Equipado] Periscopio — quitar») saca el objeto
function itemInText(t) {
  if (typeof t !== 'string') return null;
  const m = t.match(/^💿 (.+?) \((MT|MD)\)/); if (m) return `${m[2]}: ${m[1]}`;
  const s = t.replace(/^\[Equipado\] /, '').replace(/^(MT|MD): /, x => x);
  if (/^(MT|MD): /.test(s)) { const mv = s.slice(4).split(' — ')[0].split(' (')[0].trim(); if (MOVES[mv]) return s.slice(0, 4) + mv; }
  const w = s.split(/\s+/);
  for (let k = Math.min(6, w.length); k > 0; k--) { const cand = w.slice(0, k).join(' ').replace(/[,:—·]+$/, ''); if (ITEMS[cand]) return cand; }
  return null;
}

// ---------- efectos de objetos (catálogo completo) ----------
const frontFoe = () => { const p = state.player; return state.enemies.find(e => e.hp > 0 && e.x === p.x + p.facing[0] && e.y === p.y + p.facing[1]); };
const roomFoes = () => { const p = state.player, r = roomOf(p); return state.enemies.filter(e => e.hp > 0 && (r ? roomOf(e) === r : cheb(e, p) <= 2)); };
// daño directo de un objeto (púas, semillas, orbes): mismo camino que un ataque
function itemStrike(t, dmg) {
  t.hp = Math.max(0, t.hp - dmg); t.hitByMove = true;
  state.effects.push({ x: t.x, y: t.y, text: `-${dmg}`, t: performance.now(), color: '#c95c5c' });
  if (t.asleep) t.asleep = false; wakeOnHit(t);
  if (t.hp <= 0) defeatEnemy(t, state.player);
}
function randomFreeTile(nearStairs = false) {
  const T0 = state.dungeon.tiles, st = state.dungeon.stairs, cand = [];
  for (let y = 0; y < T0.length; y++) for (let x = 0; x < T0[0].length; x++) if (T0[y][x] === T.FLOOR && !occupied(x, y) && (!nearStairs || cheb({ x, y }, st) === 1)) cand.push({ x, y });
  return cand.length ? state.rng.pick(cand) : null;
}
const warpTo = (mon, spot) => { if (spot) { mon.x = spot.x; mon.y = spot.y; if (mon === state.player) updateVisibility(); } };
const revealFloor = () => { for (const row of state.seen) row.fill(true); };
function levelUpFree(mon, n) {   // subidas de nivel de objetos: no cuentan para el tope de la exploración
  for (let i = 0; i < n && mon.level < 100; i++) { mon.level++; mon.exp = 0; const old = mon.maxHp; computeStats(mon); mon.hp += mon.maxHp - old; }
  mon.seedLevels = (mon.seedLevels || 0) + n; mon.runStartLevel = (mon.runStartLevel ?? mon.level - n) + n;
  say(`¡${mon.name} sube al nivel ${mon.level}!`); levelDialog([{ who: mon.name, sp: mon.species, mood: 'Happy', text: `¡${mon.name} sube al nivel ${mon.level}!` }]);
}
// Gominolas: IQ +1..+8 según el tipo (Maravilla: +15 a todos); el Potenciador IQ lo multiplica
function eatGummi(mon, it) {
  const types = SPECIES[mon.species].types, match = it.type === '*' || types.includes(it.type);
  const gain = Math.round((it.type === '*' ? 15 : match ? 8 : 2) * (ITEMS[mon.held]?.iqBoost || 1));
  const before = mon.iq || 0; mon.iq = Math.min(999, before + gain); mon.iqGain = (mon.iqGain || 0) + gain;
  say(`${mon.name} come la gominola${match && it.type !== '*' ? ' (¡su favorita!)' : ''}. IQ +${gain} (${mon.iq}).`);
  for (const s of iqSkillsFor(mon)) if (s.iq > before && s.iq <= mon.iq) say(`¡${mon.name} aprende la habilidad IQ «${s.name}»!`);
}
function seedEffect(name, it) {
  const p = state.player, f = frontFoe(), need = () => { if (!f) { say(`Comes ${name}, pero no hay nadie delante.`); return false; } return true; };
  switch (it.fx) {
    case 'cureAll': p.status = null; say(`Comes ${name}. Todos los estados se curan.`); break;
    case 'blast': if (need()) { say(`¡${name} lanza una llamarada!`); itemStrike(f, it.dmg); } break;
    case 'stun': if (need() && applyStatus(state.rng, f, 'paralysis', 1)) say(`${f.name} queda paralizado.`); break;
    case 'totter': if (need() && applyStatus(state.rng, f, 'confusion', 1)) say(`${f.name} está confuso.`); break;
    case 'blinker': if (need()) applyStages(f, [['acc', -4]]).forEach(say); break;
    case 'doom': if (need()) { if (f.level > 1 && !f.isBoss) { f.level--; computeStats(f); f.hp = Math.min(f.hp, f.maxHp); say(`${f.name} baja al nivel ${f.level}.`); } else say('No le afecta.'); } break;
    case 'vile': if (need()) applyStages(f, [['def', -2], ['spd', -2]]).forEach(say); break;
    case 'violent': applyStages(p, [['atk', 2], ['spa', 2]]).forEach(say); break;
    case 'quick': applyStages(p, [['spe', 1]]).forEach(say); break;   // Semilla Rápida: más velocidad (como en el original)
    case 'vanish': applyStages(p, [['eva', 4]]).forEach(say); break;
    case 'blindSelf': applyStages(p, [['acc', -2]]).forEach(say); break;
    case 'confuseSelf': if (applyStatus(state.rng, p, 'confusion', 1)) say(`${p.name} está confuso.`); break;
    case 'warp': warpTo(p, randomFreeTile()); say(`${p.name} se teletransporta.`); break;
    case 'toStairs': warpTo(p, randomFreeTile(true)); say(`${p.name} aparece junto a la escalera.`); break;
    case 'nextFloor': say(`${p.name} atraviesa el suelo…`); setTimeout(() => descend(), 300); break;
    case 'reveal': revealFloor(); say('¡Ves todo el piso!'); break;
    case 'hunger': p.belly = 0; say('¡La barriga se vacía de golpe!'); break;
    case 'slip': state.slip = true; say('Ahora puedes andar sobre el agua en este piso.'); break;
    case 'levelUp': levelUpFree(p, 1); break;
    case 'levelUp3': levelUpFree(p, 3); break;
    case 'maxHp': p.bonus = { ...(p.bonus || {}), hp: (p.bonus?.hp || 0) + 10 }; computeStats(p); p.hp = Math.min(p.maxHp, p.hp + 10); say(`¡Los PS máximos de ${p.name} suben 10!`); break;
    case 'restorePP': for (const m of p.moves) m.pp = Math.min(MOVES[m.name]?.pp ?? m.pp, m.pp + 5); say('Los PP se recuperan un poco.'); break;
    default: say(`Comes ${name}. No pasa nada.`);
  }
}
function drinkEffect(name, it) {
  const p = state.player;
  if (it.fx === 'ppAll' || it.fx === 'ppMax') { for (const m of p.moves) m.pp = MOVES[m.name]?.pp ?? m.pp; say(`Bebes ${name}. ¡PP restaurados!`); }
  else if (it.fx === 'iq') eatGummi(p, { type: '*' });
  else if (it.fx === 'stat') { p.bonus = { ...(p.bonus || {}), [it.stat]: (p.bonus?.[it.stat] || 0) + it.n }; const nm = STAT_NAMES_DE[it.stat]; say(`Tomas ${name}. ¡Sube ${nm} de ${p.name} para siempre!`); }
}
// Objetos arrojadizos: en línea recta (hasta 10 casillas) o en arco (saltan por encima de lo que haya en medio)
function throwItem(name, it) {
  const p = state.player, [dx, dy] = p.facing;
  for (let k = 1; k <= 10; k++) {
    const x = p.x + dx * k, y = p.y + dy * k;
    if (!it.arc && tileAt(x, y) === T.WALL) break;
    const t = state.enemies.find(e => e.hp > 0 && e.x === x && e.y === y);
    if (t) { const d = Math.round(it.dmg * (!it.arc && p.iqSkills?.includes('Power Pitcher') ? 1.5 : 1)); say(`Lanzas ${name}: ${d} de daño a ${t.name}.`); itemStrike(t, d); if (t.hp > 0 && it.status && state.rng.random() < it.chance) applyStatus(state.rng, t, it.status, 1); return true; }
  }
  say(`Lanzas ${name}, pero no alcanza a nadie.`); return true;
}
function orbEffect(name, it) {
  playSfx('orb');
  const p = state.player, f = frontFoe(), foes = roomFoes(), team = [p, ...state.team];
  say(`¡Usas ${name}!`);
  switch (it.fx) {
    case 'escape': say('Una luz te envuelve… ¡sales de la mazmorra con todo lo que llevas!'); state.inventory.splice(state.inventory.indexOf(name), 1); setTimeout(() => endRun('exit'), 400); return 'consumed';
    case 'reveal': revealFloor(); say('¡El piso se ilumina!'); break;
    case 'rollcall': for (const a of state.team) { const s = DIRS8.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).find(s => walkableFor(a, s.x, s.y) && !occupied(s.x, s.y)); if (s) Object.assign(a, s); } say('Tu equipo se reúne a tu alrededor.'); break;
    case 'trawl': { let n = 0; for (const gi of [...state.groundItems]) if (!gi.shop && !gi.missionId && state.inventory.length < bagSizeFor(meta?.rankPts)) { state.groundItems.splice(state.groundItems.indexOf(gi), 1); state.inventory.push(gi.name); n++; } say(n ? `Atraes ${n} objeto${n > 1 ? 's' : ''} a la bolsa.` : 'No hay nada que atraer (o la bolsa está llena).'); break; }
    case 'roomStatus': { let n = 0; for (const e of foes) if (applyStatus(state.rng, e, it.status, 1)) { if (it.turns && e.status) e.status.turns = it.turns; n++; } say(n ? `${n} enemigo${n > 1 ? 's quedan' : ' queda'} ${STATUS[it.status].name.toLowerCase()}.` : 'No afecta a nadie.'); break; }
    case 'roomWarp': foes.forEach(e => warpTo(e, randomFreeTile())); say(foes.length ? 'Los enemigos desaparecen de la sala.' : 'No hay enemigos cerca.'); break;
    case 'terrify': { let n = 0; foes.forEach(e => { if (terrify(e, 10, '')) n++; }); say(n ? '¡Los enemigos se asustan y huyen!' : 'No hay enemigos cerca.'); break; }
    case 'frontWarp': if (f && !f.isBoss) { warpTo(f, randomFreeTile()); say(`${f.name} sale despedido lejos.`); } else say('No pasa nada.'); break;
    case 'swap': if (f && !f.isBoss) { const px = p.x, py = p.y; p.x = f.x; p.y = f.y; f.x = px; f.y = py; updateVisibility(); say(`Intercambias el sitio con ${f.name}.`); } else say('No pasa nada.'); break;
    case 'warp': warpTo(p, randomFreeTile()); say(`${p.name} se teletransporta.`); break;
    case 'toStairs': warpTo(p, randomFreeTile(true)); say(`${p.name} aparece junto a la escalera.`); break;
    case 'scanItems': state.scanItems = true; say('Los objetos del piso aparecen en el mapa.'); break;
    case 'scanFoes': state.scanFoes = true; say('Los enemigos del piso aparecen en el mapa.'); break;
    case 'teamStat': team.forEach(m => applyStages(m, [[it.stat, it.n]]).forEach(say)); break;
    case 'roomStat': foes.forEach(e => applyStages(e, [[it.stat, it.n]]).forEach(say)); if (!foes.length) say('No afecta a nadie.'); break;
    case 'cleanse': team.forEach(m => { m.status = null; }); say('Tu equipo se recupera de sus estados.'); break;
    case 'ppAll': team.forEach(m => m.moves.forEach(mv => { mv.pp = MOVES[mv.name]?.pp ?? mv.pp; })); say('¡Los PP de todo el equipo se restauran!'); break;
    case 'oneShot': if (f && !f.isBoss && state.rng.random() < 0.5) { say(`¡${f.name} cae de un solo golpe!`); itemStrike(f, f.hp); } else say('Falla…'); break;
    case 'twoEdge': foes.filter(e => !e.isBoss).forEach(e => { e.hp = Math.min(e.hp, 1); }); p.hp = Math.max(1, Math.floor(p.hp / 2)); say('¡Los enemigos quedan al límite… y tú también pagas el precio!'); break;
    case 'roomDamage': foes.forEach(e => { itemStrike(e, it.dmg); if (e.hp > 0 && it.status && state.rng.random() < 0.3) applyStatus(state.rng, e, it.status, 1); }); if (!foes.length) say('No afecta a nadie.'); break;
    case 'roomSeal': foes.forEach(e => { e.sealed = 8; }); say(foes.length ? 'Los enemigos no pueden usar sus movimientos.' : 'No afecta a nadie.'); break;
    case 'weather': state.weather = it.weather; say(`El tiempo cambia: ${WEATHER[it.weather]?.name || it.weather}.`); break;
    case 'drought': { const T0 = state.dungeon.tiles; let n = 0; T0.forEach((row, y) => row.forEach((t, x) => { if (t === T.WATER || t === T.LAVA) { T0[y][x] = T.FLOOR; n++; } })); say(n ? 'El agua y la lava del piso desaparecen.' : 'No hay nada que secar.'); break; }
    case 'mug': if (f) { const pk = 20 + state.rng.int(0, 80) * state.floor; state.runPokes += pk; say(`Le quitas ${pk} Pokés a ${f.name}.`); } else say('No hay nadie delante.'); break;
    case 'itemize': if (f && !f.isBoss) { state.enemies = state.enemies.filter(e => e !== f); state.groundItems.push({ x: f.x, y: f.y, name: rollLoot(state.rng, state.floor) }); say(`¡${f.name} se convierte en un objeto!`); } else say('No pasa nada.'); break;
    case 'transform': if (f && !f.isBoss) { const sp = state.rng.pick(dungeonById(state.era || state.dungeonDef.id).pool); const n2 = createMon(sp, f.level, { x: f.x, y: f.y, asleep: false }); Object.assign(f, n2); say(`¡Se transforma en ${n2.name}!`); } else say('No pasa nada.'); break;
    case 'decoy': foes.forEach(e => applyStatus(state.rng, e, 'confusion', 1)); say('Los enemigos se lían y atacan a lo loco.'); break;
    case 'blowback': if (f && !f.isBoss) { let k = 0; while (k < 10 && walkableFor(f, f.x + p.facing[0], f.y + p.facing[1]) && !occupied(f.x + p.facing[0], f.y + p.facing[1])) { f.x += p.facing[0]; f.y += p.facing[1]; k++; } say(`${f.name} sale volando.`); itemStrike(f, 10); } else say('No pasa nada.'); break;
    case 'pounce': { let k = 0; while (k < 20 && canMove(p, p.facing[0], p.facing[1])) { p.x += p.facing[0]; p.y += p.facing[1]; k++; } updateVisibility(); say(`${p.name} sale disparado hacia delante.`); break; }
    case 'slip': state.slip = true; say('Ahora puedes andar sobre el agua y la lava en este piso.'); break;
    default: say('No parece tener efecto aquí.');
  }
  render(); return true;
}
// efectos de la bolsa y del equipo: exclusivos (suben estadísticas o absorben un tipo) para las especies indicadas
// Rasgos de cada Pokémon: habilidades IQ activas (según su IQ) y Duro como un Ladrillo (+10 PS)
function refreshTraits() {
  for (const m of [state.player, ...state.team]) { if (!m) continue; m.iqSkills = activeIQ(m); const tough = m.iqSkills.includes('Brick-Tough'); if (!!m.toughApplied !== tough) { const old = m.maxHp; m.bonus = { ...(m.bonus || {}), hp: (m.bonus?.hp || 0) + (tough ? 10 : -10) }; m.toughApplied = tough; computeStats(m); m.hp = Math.max(1, m.hp + m.maxHp - old); } }
  refreshBagEffects();
}
// Al empezar un piso: habilidades y habilidades IQ que actúan una vez
function floorStartTraits() {
  refreshTraits();
  const p = state.player, team = [p, ...state.team], all = [...team, ...state.enemies];
  const wx = floorWeather(all); if (wx) { state.weather = wx; if (wx !== 'none') say(`El clima cambia por una habilidad: ${WEATHER_ALL[wx]?.name || wx}.`); }
  if (p.iqSkills.includes('Map Surveyor')) { for (let y = 0; y < state.dungeon.tiles.length; y++) for (let x = 0; x < state.dungeon.tiles[0].length; x++) if (state.dungeon.tiles[y][x] !== T.WALL) state.seen[y][x] = true; say('Topógrafo: conoces la forma del piso.'); }
  if (p.iqSkills.includes('Stair Sensor') && state.dungeon.stairs) { const s = state.dungeon.stairs; state.seen[s.y][s.x] = true; say('Detector de Escaleras: sabes dónde está la escalera.'); }
  if (p.iqSkills.includes('Acute Sniffer')) say(`Olfato Fino: hay ${state.groundItems.filter(i => !i.shop).length} objetos en este piso.`);
  for (const m of team) {
    if (m.iqSkills?.includes('Deep Breather')) { const mv = m.moves.filter(x => x.pp < (MOVES[x.name]?.pp ?? x.pp)); if (mv.length) state.rng.pick(mv).pp++; }
    if (m.status && hasAbility(m, 'NATURAL_CURE')) { m.status = null; say(`Cura Natural: ${m.name} se recupera.`); }
    if (hasAbility(m, 'PICKUP') && state.rng.random() < 0.1 && state.inventory.length < bagSizeFor(meta?.rankPts)) { const it = rollLoot(state.rng, state.floor, { noSell: true }); state.inventory.push(it); say(`Recogida: ${m.name} ha encontrado ${it}.`); }
  }
  state.scanItems = state.scanFoes = state.slip = false;
}
// Cada turno: Mudar, Hidratación, Pañuelo Teletransporte, Lazo Alegría
function turnTraits() {
  for (const m of [state.player, ...state.team]) {
    if (!m || m.hp <= 0) continue;
    if (m.status && ((hasAbility(m, 'SHED_SKIN') && state.rng.random() < 0.3) || (hasAbility(m, 'HYDRATION') && state.weather === 'rain'))) { m.status = null; say(`${m.name} se recupera de su estado gracias a su habilidad.`); }
  }
  const p = state.player, h = ITEMS[p.held];
  if (h?.warpChance && state.rng.random() < h.warpChance) { warpTo(p, randomFreeTile()); say(`¡${h ? p.held : ''} teletransporta a ${p.name}!`); }
  if (h?.expTick && state.turn % 10 === 0) gainExp(p, h.expTick * Math.max(1, Math.floor(p.level / 5)));
}
function refreshBagEffects() {
  const ex = state.inventory.map(n => ITEMS[n]).filter(it => it?.kind === 'exclusive');
  for (const m of [state.player, ...state.team]) {
    if (!m) continue;
    m.exBoost = {}; m.exAbsorb = [];
    for (const it of ex) if (it.species.includes(m.species)) { for (const [s, n] of it.boosts) m.exBoost[s] = (m.exBoost[s] || 0) + 2 * n; if (it.absorb) m.exAbsorb.push(it.absorb); }
  }
}

// ---------- objetos ----------
function useItem(index) {
  const name = state.inventory[index]; if (!name) return false;
  track('item_use', { item: name, hp: pct(state.player) }); runStats().items++;
  setTimeout(refreshBagEffects, 0);
  const p = state.player, it = ITEMS[name];
  if (isMachine(name)) { useMachine(index); return false; }
  if (!it) return false;
  const consume = () => state.inventory.splice(index, 1);
  switch (it.kind) {
    case 'heal': playSfx('heal'); p.hp = Math.min(p.maxHp, p.hp + Math.round(it.value * (p.iqSkills?.includes('Wise Healer') ? 1.5 : 1))); say(`Comes ${name}. PS restaurados.`); consume();
      if (it.bad && applyStatus(state.rng, p, it.bad, 1)) say(`¡Pero ${p.name} está confuso!`); return true;
    case 'belly':
      playSfx('eat');
      if (it.maxBelly) { p.maxBelly = Math.min(200, p.maxBelly + it.maxBelly); say(`¡La barriga de ${p.name} crece! (tope ${p.maxBelly})`); }
      p.belly = Math.min(p.maxBelly, p.belly + Math.round(it.value * (p.iqSkills?.includes('Survivalist') ? 1.5 : 1))); say(`Comes ${name}. ${p.belly >= p.maxBelly ? 'Barriga llena.' : 'Te sienta bien.'}`); consume();
      if (it.bad && state.rng.random() < 0.5) { const st = state.rng.pick(['poison', 'paralysis', 'confusion']); if (applyStatus(state.rng, p, st, 1)) say(`Uf… le ha sentado mal: ${STATUS[st].name.toLowerCase()}.`); }
      return true;
    case 'cure': if (!p.status) { say('No tienes ningún estado alterado.'); return false; } p.status = null; say(`Comes ${name}. Te sientes mejor.`); consume(); return true;
    case 'throw_sleep': { const [t] = findTargets(p, { range: 'front' }); if (!t) { say('No hay nadie delante.'); return false; } applyStatus(state.rng, t, 'sleep', 1); say(`Lanzas ${name}: ${t.name} se duerme.`); consume(); return true; }
    case 'orb':
      if (it.fx) { const r = orbEffect(name, it); if (r === 'keep') return false; if (r !== 'consumed') consume(); return true; }
      if (it.orb === 'heal') { for (const m of [p, ...state.team]) { m.hp = m.maxHp; m.status = null; } say('El Orbe Cura restaura a todo el equipo.'); }
      else if (it.orb === 'sleep') { const r = roomOf(p); const hit = state.enemies.filter(e => r ? roomOf(e) === r : cheb(e, p) <= 1); hit.forEach(e => { e.status = null; applyStatus(state.rng, e, 'sleep', 1); }); say(`El Orbe Sueño duerme a ${hit.length} enemigos.`); }
      else if (it.orb === 'restart') { consume(); say('El Orbe Reinicio te devuelve al primer piso con todo lo que llevas.'); state.floor = 1; newFloor(); return false; }
      consume(); return true;
    case 'held':
      playSfx('pickup'); if (p.held) state.inventory.push(p.held);
      p.held = name; consume(); say(`${p.name} se equipa ${name}.`); refreshBagEffects(); return false;
    case 'exclusive': say(`${name}: ${it.desc}`); return false;
    case 'gummi': { playSfx('eat'); consume(); p.belly = Math.min(p.maxBelly, p.belly + 10); eatGummi(p, it); return true; }
    case 'berry': playSfx('eat'); consume(); p.belly = Math.min(p.maxBelly, p.belly + 5);
      if (p.status?.kind === it.cure) { p.status = null; say(`Comes ${name}. ¡Se te pasa!`); } else say(`Comes ${name}. Está rica, pero no tiene efecto ahora.`); return true;
    case 'seed': playSfx('eat'); consume(); p.belly = Math.min(p.maxBelly, p.belly + 2); seedEffect(name, it); return true;
    case 'drink': playSfx('drink'); consume(); if (it.belly) p.belly = Math.min(p.maxBelly, p.belly + it.belly); drinkEffect(name, it); return true;
    case 'throw': { playSfx('throw'); const ok = throwItem(name, it); if (ok) consume(); return ok; }
    case 'sell': say(`${name}: sólo sirve para vendérselo a Kecleon.`); return false;
    case 'revive': say('Se activa sola cuando caes.'); return false;
    case 'quest': say('Es el objeto perdido de una misión. Llévalo al gremio.'); return false;
  }
  return false;
}

// ---------- acciones del jugador ----------
function preTurn(mon) { // estados al empezar a actuar. Devuelve { skip, randomMove }
  const r = tickStatus(state.rng, mon, state.turn);
  if (r.dmg) { say(`${mon.name} sufre ${r.dmg} de daño por estar ${STATUS[mon.status?.kind || 'poison'].name.toLowerCase()}.`); state.effects.push({ x: mon.x, y: mon.y, text: `-${r.dmg}`, t: performance.now(), color: '#b48ead' }); }
  if (r.cured) say(`${mon.name} se recupera.`);
  if (mon.hp <= 0) { isAlly(mon) ? downed(mon) : defeatEnemy(mon, null); return { skip: true }; }
  return r;
}
function playerAction(kind, dx = 0, dy = 0, extra) {
  const p = state.player;
  if (['move', 'attack', 'skill'].includes(kind)) {
    const st = preTurn(p);
    if (state.dead) return;
    if (st.skip) { say(`${p.name} no puede moverse (${STATUS[p.status?.kind]?.name.toLowerCase() || 'aturdido'}).`); endTurn(true); return; }
    if (st.randomMove) { [dx, dy] = state.rng.pick(DIRS8); kind = 'move'; say(`${p.name} está confuso y tropieza.`); }
  }
  if (kind === 'move') {
    p.facing = [dx, dy];
    const npc = npcAt(p.x + dx, p.y + dy);
    if (npc?.fallen) { tryRescueComplete(); return; }
    if (npc?.keeper) { openKeeperMenu(); return; }
    if (npc?.wants) {   // misión de entrega: si llevas lo que pide, se lo das
      const m = state.missions.find(m => m.id === npc.missionId), i = state.inventory.indexOf(npc.wants);
      if (m && i >= 0) { state.inventory.splice(i, 1); m.done = true; state.npcs = state.npcs.filter(n => n !== npc); say(`${npc.name}: "¡${npc.wants}! ¡Muchísimas gracias!" Cobrarás al volver al gremio.`); }
      else say(`${npc.name}: "¿Me traes ${npc.wants}? Lo necesito de verdad…"`);
      endTurn(true); return;
    }
    if (npc) { const m = state.missions.find(m => m.id === npc.missionId); if (m) { m.done = true; state.npcs = state.npcs.filter(n => n !== npc); say(`¡${npc.name}: "¡Gracias por rescatarme!" Volverá contigo al gremio.`); } endTurn(true); return; }
    if (!canMove(p, dx, dy)) { if (!state.enemies.some(e => e.x === p.x + dx && e.y === p.y + dy)) playSfx('bump'); render(); return; } // chocar (con un enemigo o una pared) solo te gira hacia allí; se ataca con A
    p.x += dx; p.y += dy; p.movedAt = performance.now();
    const gi = state.groundItems.findIndex(g => g.x === p.x && g.y === p.y);
    if (gi >= 0 && state.groundItems[gi].shop) { const g = state.groundItems[gi]; say(`Kecleon: "${g.name}, ${shopPriceFor(g)} Pokés." (Menú → Suelo para cogerlo)`); }
    else if (gi >= 0) { const g = state.groundItems[gi]; if (g.megaStone) { state.groundItems.splice(gi, 1); (state.stonesFound ||= []).push(g.megaStone); say('¡Has encontrado la ' + g.name + '! Llevala al maestro Pidgeot.'); } else if (addItem(g.name, false)) { playSfx('pickup'); state.groundItems.splice(gi, 1); if (g.shop) { const price = Math.round(g.price * (state.player.species === 'kecleon' ? KECLEON_DISCOUNT : 1)); state.shop.unpaid.push({ name: g.name, price }); say(`Coges ${g.name} (${price} P). Kecleon: ${state.player.species === 'kecleon' ? '"Para ti con descuento, hermano. Pero paga."' : '"¡Paga antes de irte!"'}`); } else say(`Recoges ${g.name}.`); if (g.missionId) { const m = state.missions.find(m => m.id === g.missionId); if (m) { m.done = true; say('¡Es el objeto de la misión!'); } } } }
    checkShopExit();
    if (tileAt(p.x, p.y) === T.STAIRS) { endTurn(true); askStairs(); return; }
  } else if (kind === 'face') { p.facing = [dx, dy]; render(); return; } // girar no gasta turno
  else if (kind === 'attack' && state.dungeon?.restArea && p.x + p.facing[0] === state.dungeon.statue.x && p.y + p.facing[1] === state.dungeon.statue.y) return openStatueMenu();   // la estatua de Kangaskhan
  else if (kind === 'attack') useMove(p, BASIC);
  else if (kind === 'skill') { const mv = p.moves[extra]; if (!mv) return; if (mv.pp <= 0) { say(`${mv.name} no tiene PP.`); return; } useMove(p, { ...MOVES[mv.name], name: mv.name }); if (!(p.iqSkills?.includes('PP Saver') && state.rng.random() < 0.25)) mv.pp--; }
  else if (kind === 'useItem') { if (!useItem(extra)) { render(); return; } }
  endTurn(true);
}

// ---------- rescate asíncrono (cliente) ----------
async function openRescueBoard() {
  const r = await call('/rescue/list', undefined);
  const list = r?.rescues || [];
  if (!list.length) { say('No hay peticiones de rescate ahora mismo.'); return openBoardMenu(); }
  openMenu({ title: 'Rescates disponibles', items: [...list.map(x => `${x.victim} (${SPECIES[x.species]?.name || x.species}) — ${dungeonById(x.dungeonId).name} B${x.floor}F`), 'Volver'], onCancel: openBoardMenu, onSelect: i => {
    if (i >= list.length) return openBoardMenu();
    startRescue(list[i]);
  } });
}
function openRescueCode() {
  // pedimos el código con un prompt del navegador (simple y suficiente para amigos)
  const code = (typeof prompt === 'function') ? prompt('Codigo de rescate:') : '';
  if (!code) return openBoardMenu();
  call('/rescue/accept', { code: code.trim() }).then(r => { if (r?.mission) startRescue(r.mission); });
}
async function startRescue(mission) {
  // entrar en la mazmorra con la MISMA semilla y bajar directo al piso del caido
  let r;
  try { r = await api('/run/start', { dungeonId: mission.dungeonId, starter: state.player.species }); }
  catch (e) { closeHub(); return blockedStart(e); }
  meta = r.meta;
  const moves = state.player.moves;
  state.player = createPlayer(r.run.starter); state.player.moves = moves;
  Object.assign(state, { run: { ...r.run, seed: mission.seed }, flags: r.run.flags || {}, dungeonDef: dungeonById(mission.dungeonId), inventory: [...r.bag], runPokes: 0, missions: [], earnedMD: [], recruitedLegendaries: [], lostRecruits: [], bondedLost: [], team: [], floor: mission.floor, turn: 0, dead: false, log: [], scene: 'dungeon', diary: { monsterHouses: 0, recruited: 0, kecleonRobs: 0, itemsSold: 0 }, rescue: mission });
  say(`Misión de rescate: encuentra a ${mission.victim} en B${mission.floor}F.`);
  newFloor();
  // colocar el "cuerpo" del caido en su casilla
  state.npcs.push({ x: mission.fell.x, y: mission.fell.y, species: mission.species, name: mission.victim, fallen: true, facing: [0, 1] });
}
async function tryRescueComplete() {
  const rescue = state.rescue; if (!rescue) return false;
  const p = state.player;
  if (Math.abs(p.x - rescue.fell.x) > 1 || Math.abs(p.y - rescue.fell.y) > 1) return false;
  const r = await call('/rescue/complete', { code: rescue.code, x: p.x, y: p.y });
  if (r?.reward) {
    meta = r.meta; state.rescue = null;
    openDialog([{ who: rescue.victim, text: `¡Me has salvado! Gracias de corazon.` }], () => { say(`Rescate completado. +${r.reward.pokes} Pokes y la bandana "Heroe".`); state.player = null; enterHub(); });
  }
  return true;
}

// ---------- tienda de Kecleon en la mazmorra ----------
const unpaidTotal = () => (state.shop?.unpaid || []).reduce((s, u) => s + u.price, 0);
const onCarpet = (x, y) => !!state.shop?.carpet.some(c => c.x === x && c.y === y);
function openKeeperMenu() {
  const due = unpaidTotal();
  const sellable = state.inventory.map((n, i) => ({ n, i })).filter(x => ITEMS[x.n]?.sell && !state.shop.unpaid.some(u => u.name === x.n));
  const items = [due ? `Pagar lo que debes (${due} P)` : 'No debes nada', ...(sellable.length ? ['Vender objetos'] : []), 'Nada, gracias'];
  playSfx('kecleon'); say(due ? `Kecleon: "Son ${due} Pokés. Tienes ${state.runPokes}."` : 'Kecleon: "¡Bienvenido! Coge lo que quieras de la alfombra y paga aquí."');
  openMenu({ title: 'Kecleon', items, onSelect: i => {
    if (i === 0 && due) { if (state.runPokes >= due) { state.runPokes -= due; state.shop.unpaid = []; say('Kecleon: "¡Gracias por su compra!"'); } else say('Kecleon: "Ejem… no te llega. Devuelve algo o consigue Pokés."'); }
    else if (items[i] === 'Vender objetos') openMenu({ title: 'Vender (precio de mazmorra)', items: sellable.map(x => `${x.n} — ${Math.floor(ITEMS[x.n].sell * 0.8)} P`), onSelect: j => { const x = sellable[j], p = Math.floor(ITEMS[x.n].sell * 0.8); state.inventory.splice(x.i, 1); state.runPokes += p; say(`Vendes ${x.n} por ${p} P.`); render(); } });
    render();
  } });
}
// Salir de la alfombra debiendo = robo. Kecleon se transforma y llama a los suyos.
function checkShopExit() {
  const s = state.shop, p = state.player; if (!s || s.robbed || !s.unpaid.length) return;
  if (onCarpet(p.x, p.y) || Math.max(Math.abs(p.x - s.keeper.x), Math.abs(p.y - s.keeper.y)) <= 1) return;
  s.robbed = true; s.unpaid = [];
  const keeper = state.npcs.find(n => n.keeper); if (keeper) state.npcs = state.npcs.filter(n => n !== keeper);
  const mk = (x, y) => { const k = createMon('kecleon', SHOP_IN_DUNGEON.level, { statMult: SHOP_IN_DUNGEON.statMult, x, y, asleep: false, isBoss: true, shopkeeper: true }); computeStats(k); k.hp = k.maxHp; return k; };
  // el tendero se queda en su sitio y los refuerzos llegan desde otras salas, lejos de ti; todos tardan 2 turnos en reaccionar
  const keeperMon = mk(s.keeper.x, s.keeper.y); keeperMon.delay = 2; state.enemies.push(keeperMon);
  const far = state.dungeon.rooms.filter(r => r !== s.room).sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y));
  for (let i = 0; i < SHOP_IN_DUNGEON.guards && i < far.length; i++) {
    const r = far[i], q = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
    if (walkableFor({ species: 'kecleon' }, q.x, q.y) && !occupied(q.x, q.y)) { const k = mk(q.x, q.y); k.delay = 2; state.enemies.push(k); }
  }
  if (state.diary) state.diary.kecleonRobs++;
  playSfx('alarm'); say('Kecleon: "¡¡LADRÓN!!" Los Kecleon de todo el piso vienen a por ti.');
  state.effects.push({ x: p.x, y: p.y, text: '!!!', t: performance.now(), color: '#c95c5c' });
}
function descend() {
  playSfx('stairs');
  const def = state.dungeonDef;
  if (state.dungeon?.restArea) return newFloor();   // desde la sala de descanso se sigue al piso que tocaba (no es un piso nuevo)
  if (state.floor >= def.floors) { playOnce('clear'); return endRun('clear'); }
  // los compañeros cuentan pisos solo al bajar de verdad (antes, salir de cada sala de descanso sumaba uno de más,
  // y en mazmorras largas el servidor rechazaba el vínculo por tener más pisos juntos que la propia mazmorra)
  for (const a of state.team) { a.floors++; if (a.floors === CFG.bondFloors) say(`¡Vínculo forjado con ${a.name}!`); }
  state.floor++;
  const kindNext = floorKind(def, state.floor, state.flags);
  if (((state.floor - 1) % CFG.checkpointEvery === 0 && kindNext === 'normal') || ['legendary', 'bigLegendary', 'jirachi'].includes(kindNext)) return newRestArea();   // antes de cualquier jefe legendario
  newFloor();
}
const stairsSealed = () => state.enemies.some(e => e.hp > 0 && (e.isLegendary || e.sealsStairs));
function askStairs() {
  if (stairsSealed()) { say('Las escaleras están selladas mientras el guardián siga en pie.'); return; }
  openMenu({ title: 'Escaleras', items: ['Bajar', 'Quedarse'], onSelect: i => { if (i === 0) descend(); } });
}
function endTurn(playerActed = false) { return (state.turnP = resolveTurn(playerActed)); }
async function resolveTurn(playerActed) {
  if (state.dead) { render(); return; }
  const p = state.player;
  // Velocidad (como en el original): rápido = tus acciones extra se resuelven sin que el resto del mundo se mueva
  const ps = speedOf(p, state.weather);
  if (playerActed && ps > 0) {
    state.freeActs = (state.freeActs || 0) + 1;
    if (state.freeActs <= ps) {
      state.resolving = true;
      try { if (state.attacked) { render(); await pace(ATTACK_PAUSE()); } state.attacked = false; await waitFading(); updateVisibility(); render(); }
      finally { state.resolving = false; }
      return;
    }
    state.freeActs = 0;
  }
  state.turn++;
  if (!playerActed) { const st = preTurn(p); if (state.dead) return; }
  // barriga: −1 cada 10 turnos; vacía, se pierde 1 PS por turno y no se regenera (Exploradores del Cielo)
  // en la Mazmorra del Tiempo la barriga baja a la mitad de velocidad (1 cada 20 turnos)
  const hf = (ITEMS[p.held]?.hunger ?? 1) * (p.iqSkills?.includes('Energy Saver') ? 0.75 : 1);   // Cinto Glotón ×2, Banda Aguante ×0,5, Cinto Apretado ×0
  const bellyEvery = hf === 0 ? Infinity : Math.max(1, Math.round(CFG.bellyEveryTurns * (CFG.bellySlowDungeons[state.dungeonDef?.id] || 1) / hf));
  if (p.belly > 0) { if (state.turn % bellyEvery === 0) { p.belly--; if (p.belly === 20) { say(`¡${p.name} tiene hambre!`); playSfx('hunger'); } if (p.belly === 10) { say(`¡${p.name} tiene muchísima hambre! Come algo pronto.`); playSfx('hunger'); } if (p.belly === 0) { say(`¡La barriga de ${p.name} está vacía! Pierde PS en cada turno.`); playSfx('hunger'); openDialog([{ who: p.name, sp: p.species, mood: 'Pain', text: `¡La barriga de ${p.name} está vacía! Si no come algo, irá perdiendo PS.` }]); } } regen(p); }
  else { p.hp = Math.max(0, p.hp - 1); if (state.turn % 10 === 0) say('El hambre te va quitando PS…'); if (p.hp <= 0) { downed(p); if (state.dead) return; } }
  weatherTick();
  state.resolving = true;
  try {
    // tu acción primero: si has atacado, se ve antes de que responda nadie
    const moved0 = !state.attacked;
    if (state.attacked) { render(); await pace(ATTACK_PAUSE()); }
    state.attacked = false;
    await waitFading();
    const alive = () => !state.dead && state.scene === 'dungeon';
    // cuántas veces actúa cada uno este turno según su velocidad: lento, uno de cada dos; rápido, 2, 3 o 4 veces
    const actsOf = m => { const s = speedOf(m, state.weather); return s > 0 ? 1 + s : s < 0 ? (state.turn % 2 === 0 ? 1 : 0) : 1; };
    const rounds = ps < 0 ? 2 : 1;   // si tú eres lento, el mundo avanza dos turnos por cada acción tuya
    for (let round = 0; round < rounds; round++) {
    if (round > 0) state.turn++;
    for (const a of [...state.team]) {
      if (!alive()) return; regen(a);
      for (let k = actsOf(a); k > 0 && a.hp > 0 && alive(); k--) {
        allyTurn(a);
        if (state.attacked) { state.attacked = false; render(); await pace(ATTACK_PAUSE()); await waitFading(); }
      }
    }
    if (!alive()) return;
    if (!floorClock()) return;
    updateDungeonMusic(); turnTraits();
    // los enemigos: se mueven a la vez, pero cada ataque se ve por separado
    let first = true;
    for (const e of [...state.enemies]) {
      if (!alive()) return;
      for (let k = actsOf(e); k > 0 && e.hp > 0 && alive(); k--) {
        if (first && moved0 && cheb(e, p) <= 2 && e.hp > 0) { first = false; await pace(STEP_MS()); }   // que termine tu paso antes de que te ataquen
        enemyTurn(e); enemyPickup(e);
        if (state.attacked) { state.attacked = false; render(); await pace(ATTACK_PAUSE()); await waitFading(); }
      }
    }
    speedTick();
    }
    updateVisibility(); render();
    state.turnsSinceSave = (state.turnsSinceSave || 0) + 1;
    if (state.turnsSinceSave >= 10) { state.turnsSinceSave = 0; autosave('turns'); }   // guardado automático cada 10 turnos
  } finally { state.resolving = false; }
  setTimeout(() => dungeonTips(10), 0);   // ¿toca algún consejo del Campo de Entrenamiento?
}
// Contadores de velocidad (los cambios duran unos turnos) e Impulso (+1 de velocidad cada 10 turnos)
function speedTick() {
  for (const m of [state.player, ...state.team, ...state.enemies]) {
    if (!m || m.hp <= 0) continue;
    if (m.speedTurns > 0 && --m.speedTurns === 0 && m.speed) { m.speed = 0; if (isVisibleNow(m.x, m.y)) say(`La velocidad de ${m.name} vuelve a la normalidad.`); }
    if (hasAbility(m, 'SPEED_BOOST') && state.turn % 10 === 0 && (m.speed || 0) < 3) { m.speed = (m.speed || 0) + 1; m.speedTurns = Infinity; if (isVisibleNow(m.x, m.y)) say(`¡${m.name} acelera gracias a Impulso!`); }
  }
}
// ---------- huir (como en el original): asustados, con Fuga por debajo del 50 % y forajidos que huyen ----------
function terrify(mon, turns, why) {
  if (!mon || mon === state.player || mon.isBoss || mon.shopkeeper || mon.hp <= 0) return false;
  const was = mon.terrified; mon.terrified = Math.max(mon.terrified || 0, turns);
  if (!was && isVisibleNow(mon.x, mon.y)) say(why || `¡${mon.name} se asusta y huye!`);
  return true;
}
// paso que más aleja de todos los que amenazan (entre las 8 casillas vecinas)
function fleeStep(mon, threats) {
  if (!threats.length) return false;
  const far = (x, y) => Math.min(...threats.map(t => Math.max(Math.abs(t.x - x), Math.abs(t.y - y))));
  let best = null, bestD = far(mon.x, mon.y);
  for (const [a, b] of DIRS8) if (canMove(mon, a, b)) { const d = far(mon.x + a, mon.y + b) + Math.random() * 0.1; if (d > bestD) { bestD = d; best = [a, b]; } }
  if (!best) return false;
  mon.x += best[0]; mon.y += best[1]; mon.facing = best; mon.movedAt = performance.now(); return true;
}
// true si el enemigo ha dedicado su turno a huir
function fleeTurn(e) {
  const threats = [state.player, ...state.team].filter(m => m && m.hp > 0);
  if (!e.terrified && !e.isBoss && !e.shopkeeper && hasAbility(e, 'RUN_AWAY') && e.hp <= e.maxHp / 2) terrify(e, Infinity, `¡${e.name} huye asustado! (Fuga)`);
  if (e.fleeOutlaw) {   // forajido que huye: se aleja si te ve y, si no, va hacia la escalera; si llega, escapa
    const st = state.dungeon.stairs;
    if (st && e.x === st.x && e.y === st.y) {
      state.enemies = state.enemies.filter(x => x !== e);
      if (isVisibleNow(e.x, e.y) || true) say(`¡${e.name} ha escapado por las escaleras!`);
      return true;
    }
    const seen = threats.some(t => cheb(t, e) <= 5 && isVisibleNow(e.x, e.y));
    if (seen) fleeStep(e, threats) || stepAway(e, state.player.x, state.player.y);
    else if (st) { const path = dungeonPath(e, st); if (path?.length) { const n = path[0]; if (canMove(e, n.x - e.x, n.y - e.y)) { e.facing = [n.x - e.x, n.y - e.y]; e.x = n.x; e.y = n.y; e.movedAt = performance.now(); } } }
    return true;
  }
  if (!e.terrified) return false;
  if (Number.isFinite(e.terrified) && --e.terrified <= 0) { e.terrified = 0; return false; }
  fleeStep(e, threats) || stepAway(e, state.player.x, state.player.y);
  return true;
}
function stepAway(mon, tx, ty) {
  const dx = Math.sign(mon.x - tx) || (Math.random() < 0.5 ? 1 : -1), dy = Math.sign(mon.y - ty) || (Math.random() < 0.5 ? 1 : -1);
  for (const [a, b] of [[dx, dy], [dx, 0], [0, dy]]) if ((a || b) && canMove(mon, a, b)) { mon.x += a; mon.y += b; mon.facing = [a, b]; mon.movedAt = performance.now(); return true; }
  return false;
}
// Movimiento codicioso hacia un punto (con rodeo por un eje)
function stepToward(mon, tx, ty) {
  const dx = Math.sign(tx - mon.x), dy = Math.sign(ty - mon.y);
  const tries = [[dx, dy], [dx, 0], [0, dy], [dx, -dy], [-dx, dy]].filter(([a, b]) => a || b);
  for (const [a, b] of tries) if (canMove(mon, a, b)) { mon.x += a; mon.y += b; mon.facing = [a, b]; mon.movedAt = performance.now(); return true; }
  return false;
}
function moveStillUseful(mon, target, mv) {
  if (!mv || mv.cat !== 'status' || !mv.statFx?.changes?.length) return true;
  const self = mv.statFx.raiseSelf || mv.range === 'self' || mv.range === 'team';
  const who = self ? mon : target;
  return mv.statFx.changes.some(([stat, n]) => {
    if (stat === 'spe') { const s = who.speed || 0; return n > 0 ? s < 3 : s > -1; }
    const s = who.stages?.[stat] || 0; return n > 0 ? s < 10 : s > -10;
  });
}
function pickMove(mon, target, dist) {
  const usable = mon.moves.filter(m => m.pp > 0 && (dist === 1 ? MOVES[m.name].range !== 'room' || roomOf(mon) : (MOVES[m.name].range === 'line' && MOVES[m.name].dist >= dist) || (MOVES[m.name].range === 'around' && (MOVES[m.name].dist || 1) >= dist) || (MOVES[m.name].range === 'room' && roomOf(mon) && roomOf(mon) === roomOf(target))));
  const aligned = mon.x === target.x || mon.y === target.y || Math.abs(mon.x - target.x) === Math.abs(mon.y - target.y);
  // regla de la esquina (como en el juego): en diagonal junto a una pared no se puede atacar de frente → mejor recolocarse
  if (dist === 1 && !cornerFree(mon, target) && !usable.some(m => MOVES[m.name].range === 'room' || MOVES[m.name].range === 'around')) return null;
  if (!aligned && !usable.some(m => MOVES[m.name].range === 'room' || MOVES[m.name].range === 'around')) return null;
  if (aligned) mon.facing = [Math.sign(target.x - mon.x), Math.sign(target.y - mon.y)];
  // descartar los movimientos de estado que ya no harían nada (bajar lo que está al mínimo, subir lo que está al máximo)
  const useful = usable.filter(m => moveStillUseful(mon, target, MOVES[m.name]));
  const choice = useful.length && (dist === 1 ? state.rng.random() < 0.7 : true) ? state.rng.pick(useful) : null;
  if (choice && findTargets(mon, { ...MOVES[choice.name], name: choice.name }).length) return choice;
  return dist === 1 && aligned ? 'basic' : null;
}
function allyTurn(a) {
  const st = preTurn(a); if (st.skip || a.hp <= 0) return;
  const p = state.player;
  if (st.randomMove) { const [dx, dy] = state.rng.pick(DIRS8); if (canMove(a, dx, dy)) { a.x += dx; a.y += dy; } return; }
  const visible = state.enemies.filter(e => cheb(e, a) <= CFG.sightRadius).sort((x, y) => cheb(x, a) - cheb(y, a));
  const nearest = visible[0];
  if (a.tactic !== 'evitar' && nearest) {
    const dist = cheb(nearest, a);
    const chosen = (a.tactic === 'atacar' || dist === 1) ? pickMove(a, nearest, dist) : null;
    if (chosen === 'basic') { useMove(a, BASIC); return; }
    if (chosen) { useMove(a, { ...MOVES[chosen.name], name: chosen.name }); chosen.pp--; return; }
    if (a.tactic === 'atacar' && dist > 1) { stepToward(a, nearest.x, nearest.y); return; }
  }
  if (a.tactic === 'esperar') return;
  if (cheb(a, p) > 1) stepToward(a, p.x, p.y);
}
function weatherTick() {
  const w = WEATHER[state.weather]; if (!w?.tick || state.turn % 4 !== 0) return;
  const hit = m => { if (w.immune.some(t => SPECIES[m.species].types.includes(t)) || m.hp <= 0 || ITEMS[m.held]?.weatherImmune || hasAbility(m, 'MAGIC_GUARD')) return; const d = Math.max(1, Math.floor(m.maxHp * w.tick)); m.hp = Math.max(0, m.hp - d); state.effects.push({ x: m.x, y: m.y, text: `-${d}`, t: performance.now(), color: w.color }); if (m.hp <= 0) { if (isAlly(m)) downed(m); else defeatEnemy(m, null); } };
  hit(state.player); for (const a of [...state.team]) hit(a); for (const e of [...state.enemies]) hit(e);
  if (state.turn % 20 === 0) say(`${w.name}: castiga a los que no resisten.`);
}
// Un enemigo que pisa un objeto lo recoge (y lo suelta en el suelo si lo derrotas)
function enemyPickup(e) {
  if (e.hp <= 0 || e.shopkeeper || e.isBoss) return;
  const i = state.groundItems.findIndex(g => g.x === e.x && g.y === e.y && !g.shop && !g.missionId); if (i < 0) return;
  const [g] = state.groundItems.splice(i, 1); (e.carried ||= []).push(g.name);
  if (isVisibleNow(e.x, e.y)) say(`${e.name} recoge ${g.name}.`);
}
function dropCarried(e) {   // lo que llevaba, al suelo: en su casilla o en la más cercana libre de objetos
  for (const name of e.carried || []) {
    const spots = [[0, 0], ...DIRS8, [2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy }));
    const s = spots.find(p => state.dungeon.tiles[p.y]?.[p.x] === T.FLOOR && !state.groundItems.some(g => g.x === p.x && g.y === p.y)) || { x: e.x, y: e.y };
    state.groundItems.push({ name, x: s.x, y: s.y }); say(`${e.name} suelta ${name}.`);
  }
  e.carried = [];
}
function enemyTurn(e) {
  if (e.bowedOut) return;   // Chatot, derrotado, está en su escena
  if (e.delay > 0) { e.delay--; return; }   // tarda en reaccionar (Kecleon tras un robo)
  const st = preTurn(e); if (st.skip || e.hp <= 0) return;
  if (fleeTurn(e)) return;   // asustado, con Fuga o forajido que huye
  if (e.mega && MEGA_DIALOG[e.species]) {
    const dlg = MEGA_DIALOG[e.species], dist = cheb(state.player, e), room = roomOf(e), playerInRoom = room && roomOf(state.player) === room;
    if (!e.megaMet && playerInRoom) { megaEncounter(e); return; }   // al entrar en su sala, como una Casa Monstruo
    if (!e.megaHostile) {
      if (dlg.behavior === 'flee') {
        if (!playerInRoom) return;
        e.megaPress = (e.megaPress || 0) + 1;
        if (e.megaPress === 1 && dlg.flee) openDialog(dlg.flee.map(t => ({ who: e.name, text: t, font: dlg.font, color: dlg.color })));
        const away = stepAway(e, state.player.x, state.player.y);
        if (e.megaPress >= 4 || !away) { if (dlg.yield) openDialog(dlg.yield.map(t => ({ who: e.name, text: t, font: dlg.font, color: dlg.color })), () => { e.megaHostile = true; }); else e.megaHostile = true; }
        return;
      }
      e.megaHostile = true;
    }
  }
  if (st.randomMove) { const [dx, dy] = state.rng.pick(DIRS8); if (canMove(e, dx, dy)) { e.x += dx; e.y += dy; } return; }
  const targets = [state.player, ...state.team].sort((a, b) => cheb(a, e) - cheb(b, e)), target = targets[0], dist = cheb(target, e);
  if (e.asleep) { if (dist <= 1 && state.rng.random() < 0.5) e.asleep = false; return; }
  // Visión como en el original: te ve si estáis en la misma sala o, en los pasillos, a 2 casillas como mucho.
  // Si te pierde de vista, va al último sitio donde te vio (durante unos turnos) en vez de olvidarse de ti.
  const seen = targets.find(t => enemySees(e, t));
  if (seen) e.lastSeen = { x: seen.x, y: seen.y, ttl: 8 };
  if (seen) {
    const tgt = seen, dst = cheb(tgt, e);
    if (e.sealed > 0) { e.sealed--; if (dist <= 1) { useMove(e, BASIC); return; } }   // Orbe Silencio / Sello: solo golpes básicos
    const chosen = pickMove(e, tgt, dst);
    if (chosen === 'basic') { useMove(e, BASIC); return; }
    if (chosen) { useMove(e, { ...MOVES[chosen.name], name: chosen.name }); chosen.pp--; return; }
    chase(e, tgt.x, tgt.y); return;
  }
  if (e.lastSeen && e.lastSeen.ttl-- > 0 && !(e.x === e.lastSeen.x && e.y === e.lastSeen.y)) { chase(e, e.lastSeen.x, e.lastSeen.y); return; }
  e.lastSeen = null;
  wander(e);
}
// ¿El enemigo ve a este Pokémon? Misma sala, o a 2 casillas como mucho (pasillos, entradas de sala)
function enemySees(e, t) {
  if (!t || t.hp <= 0) return false;
  const d = cheb(e, t); if (d <= 2) return true;
  const r = roomOf(e); return !!r && r === roomOf(t) && d <= CFG.sightRadius * 2;
}
// Perseguir por el camino de verdad (por los pasillos), no en línea recta contra las paredes
function chase(e, tx, ty) {
  const path = dungeonPath(e, { x: tx, y: ty });
  const n = path?.[0];
  if (n && !(n.x === tx && n.y === ty && occupied(tx, ty))) {
    const dx = n.x - e.x, dy = n.y - e.y;
    if (canMove(e, dx, dy)) { e.x = n.x; e.y = n.y; e.facing = [dx, dy]; e.movedAt = performance.now(); return; }
  }
  stepToward(e, tx, ty);   // sin camino libre (alguien en medio): el paso de siempre
}
// Sin verte, el enemigo deambula como en Mundo Misterioso: elige una sala de destino y va hacia ella por los
// pasillos; al llegar (o si se atasca), elige otra. Así acaba recorriendo el piso y encontrándote.
function wander(e) {
  const rooms = state.dungeon.rooms; if (!rooms?.length) return;
  // los Kecleon a los que has robado te persiguen por todo el piso aunque no te vean
  if (e.shopkeeper) { const p = state.player; if (!e.goal || e.goal.x !== p.x || e.goal.y !== p.y) { e.goal = { x: p.x, y: p.y }; e.path = null; } }
  const here = roomOf(e);
  if (!e.shopkeeper && (!e.goal || (e.x === e.goal.x && e.y === e.goal.y) || (e.stuck || 0) > 4)) {
    const choices = rooms.filter(r => r !== here); const r = state.rng.pick(choices.length ? choices : rooms);
    e.goal = { x: r.x + state.rng.int(0, r.w - 1), y: r.y + state.rng.int(0, r.h - 1) }; e.path = null; e.stuck = 0;
  }
  if (!e.path || !e.path.length) e.path = dungeonPath(e, e.goal);
  const next = e.path?.[0];
  if (!next) { e.goal = null; return; }
  const dx = next.x - e.x, dy = next.y - e.y;
  if (canMove(e, dx, dy)) { e.x = next.x; e.y = next.y; e.facing = [dx, dy]; e.path.shift(); e.stuck = 0; }
  else { e.stuck = (e.stuck || 0) + 1; e.path = null; }   // alguien en medio: recalcula o cambia de destino
}
// camino por las casillas transitables para ese Pokémon (búsqueda en anchura; ignora a los demás al planificar)
function dungeonPath(mon, to) {
  const W = state.dungeon.tiles[0].length, H = state.dungeon.tiles.length, key = (x, y) => y * W + x;
  const prev = new Map([[key(mon.x, mon.y), -1]]), q = [[mon.x, mon.y]];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i]; if (x === to.x && y === to.y) break;
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(k) || !walkableFor(mon, nx, ny)) continue;
      if (dx && dy && (!passable(x + dx, y) || !passable(x, y + dy))) continue;   // regla de la esquina
      prev.set(k, key(x, y)); q.push([nx, ny]);
    }
  }
  if (!prev.has(key(to.x, to.y))) return null;
  const path = []; for (let k = key(to.x, to.y); k !== key(mon.x, mon.y); k = prev.get(k)) path.push({ x: k % W, y: Math.floor(k / W) });
  return path.reverse();
}
function updateVisibility() {
  const p = state.player, room = roomOf(p);
  const mark = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (state.seen[y]?.[x] !== undefined) state.seen[y][x] = true; };
  const cs = corridorSight();
  if (room) mark(room.x - 1, room.y - 1, room.x + room.w, room.y + room.h);   // la sala en la que estás…
  mark(p.x - cs, p.y - cs, p.x + cs, p.y + cs);                                 // …y, además, lo que tienes a tu alrededor (como en Exploradores del Cielo)
  if (state.dungeon.arena) { const r = state.dungeon.rooms[0]; mark(r.x - 1, r.y - 1, r.x + r.w, r.y + r.h); }
  state.inRoom = room || null;
  const mh = state.monsterHouse;
  if (mh && !mh.triggered && room === mh.room) {
    mh.triggered = true;
    const spawned = spawnMonsterHouse(state.rng, state.dungeonDef, state.floor, mh.room, state.dungeon.tiles, occupied, dungeonById(state.era).pool);
    spawned.enemies.forEach(e => e.house = true); state.enemies.push(...spawned.enemies); state.groundItems.push(...spawned.groundItems);
    if (state.diary) state.diary.monsterHouses++; updateDungeonMusic();
    say('¡¡Es una Casa Monstruo!! ¡Te rodean!');
    state.effects.push({ x: p.x, y: p.y, text: '!!', t: performance.now(), color: '#f2b544' });
  }
}

// =====================================================================
// MENÚS, LOG
// =====================================================================
function openMenu(menu) { state.menu = { index: 0, ...menu }; render(); }
function openDungeonMainMenu() {
  openMenu({ title: 'Menú', items: ['Movimientos', 'Bolsa', 'Equipo', 'Suelo', 'Misiones', `Mapa: ${state.showMap === false ? 'oculto' : 'visible'}`, 'Registro de mensajes', 'Cerrar'], onSelect: i => {
    if (i === 0) openMenu({ title: 'Movimientos', items: state.player.moves.map(m => `${m.name}${m.permanent ? ' ★' : ''}  ${m.pp}/${MOVES[m.name].pp}`), icons: state.player.moves.map(m => MOVES[m.name].type), onSelect: j => playerAction('skill', 0, 0, j) });
    else if (i === 1) openBagMenu();
    else if (i === 2) openTeamMenu();
    else if (i === 3) openGroundMenu();
    else if (i === 4) say(state.missions.length ? state.missions.map(m => `${m.done ? '✓' : '·'} ${missionText(m)}`).join(' | ') : 'Sin misiones activas.');
    else if (i === 5) { state.showMap = state.showMap === false; render(); }
    else if (i === 6) openHistory();
  } });
}
const itemVerb = name => { const k = ITEMS[name]?.kind; return isMachine(name) ? 'Enseñar' : k === 'belly' || k === 'heal' || k === 'berry' || k === 'seed' ? 'Comer' : k === 'held' ? 'Equipar' : k === 'sell' ? null : 'Usar'; };
function itemInfo(name) {
  const it = ITEMS[name] || {};
  if (isMachine(name)) { const mv = MOVES[name.slice(4)]; return `${name.startsWith('MD: ') ? 'Máquina Definitiva' : 'Máquina Técnica'}: enseña ${name.slice(4)}${mv ? ` (${mv.type}, ${mv.cat === 'status' ? 'estado' : 'potencia ' + (mv.pmdPower ?? '?')})` : ''}. Solo la aprenden los Pokémon compatibles.`; }
  const parts = { belly: `Llena ${it.value} de barriga.`, heal: `Recupera ${it.value} PS.`, held: 'Objeto para equipar.', sell: 'Objeto de valor: se puede vender.', orb: 'Orbe de un solo uso.' };
  return `${name}: ${it.desc || parts[it.kind] || 'Objeto.'}${it.sell ? ` (se vende por ${it.sell} P)` : ''}`;
}
function openBagMenu() {
  const items = [...state.inventory.map(n => isMachine(n) ? `${n.slice(0, 2)}: ${n.slice(4)}` : n), state.player.held ? `[Equipado] ${state.player.held} — quitar` : '[Nada equipado]'];   // las máquinas, con su disco
  openMenu({ title: `Bolsa ${state.inventory.length}/${bagSizeFor(meta?.rankPts)}`, items, onSelect: j => {
    if (j < state.inventory.length) return openItemMenu(j);
    if (state.player.held && state.inventory.length < bagSizeFor(meta?.rankPts)) { state.inventory.push(state.player.held); say(`Te quitas ${state.player.held}.`); state.player.held = null; }
    render();
  } });
}
// Opciones de un objeto de la bolsa: Usar/Comer/Equipar, Colocar en el suelo, Info
function openItemMenu(j) {
  const name = state.inventory[j]; if (!name) return openBagMenu();
  const verb = itemVerb(name), opts = [...(verb ? [verb] : []), 'Colocar', 'Info', 'Volver'];
  openMenu({ title: name, items: opts, onCancel: openBagMenu, onSelect: k => {
    const o = opts[k];
    if (o === verb) return playerAction('useItem', 0, 0, j);
    if (o === 'Colocar') return placeItem(j);
    if (o === 'Info') { say(itemInfo(name)); return openItemMenu(j); }
    openBagMenu();
  } });
}
const itemUnder = p => state.groundItems.find(g => g.x === p.x && g.y === p.y);
const shopPriceFor = g => Math.round(g.price * (state.player.species === 'kecleon' ? KECLEON_DISCOUNT : 1));
// Dejar un objeto en el suelo. Sobre la alfombra de Kecleon: si era suyo, se devuelve; si es tuyo, te ofrece comprarlo.
function placeItem(j) {
  const p = state.player, name = state.inventory[j];
  if (itemUnder(p)) { say('Ya hay un objeto aquí.'); return; }
  if (state.dungeon.tiles[p.y][p.x] === T.STAIRS) { say('No puedes dejar objetos en las escaleras.'); return; }
  state.inventory.splice(j, 1);
  const g = { name, x: p.x, y: p.y };
  if (onCarpet(p.x, p.y)) {
    const u = state.shop.unpaid.findIndex(x => x.name === name);
    if (u >= 0) { const [back] = state.shop.unpaid.splice(u, 1); Object.assign(g, { shop: true, price: back.price }); state.groundItems.push(g); say(`Devuelves ${name}. Kecleon: "Sin problema."`); endTurn(true); return; }
    state.groundItems.push(g);
    const offer = Math.floor((ITEMS[name]?.sell || 0) * 0.8);
    if (offer > 0 && !state.shop.robbed) {
      say(`Kecleon: "¿Me vendes ${name} por ${offer} Pokés?"`);
      return openMenu({ title: `¿Vender ${name} por ${offer} P?`, items: ['Sí', 'No'], onSelect: k => { if (k === 0) { state.runPokes += offer; Object.assign(g, { shop: true, price: shopPrice(name) }); say(`Vendes ${name} por ${offer} P.`); if (state.diary) state.diary.itemsSold++; } endTurn(true); }, onCancel: () => endTurn(true) });
    }
    say(`Dejas ${name} en el suelo.`); endTurn(true); return;
  }
  state.groundItems.push(g); say(`Dejas ${name} en el suelo.`); endTurn(true);
}
// Menú "Suelo": lo que hay bajo tus pies (coger, cambiar por un objeto de la bolsa)
function openGroundMenu() {
  const p = state.player, g = itemUnder(p);
  if (!g) { say('No hay nada en el suelo.'); return; }
  const title = g.shop ? `${g.name} — ${shopPriceFor(g)} P` : g.name;
  const opts = ['Coger', ...(state.inventory.length ? ['Cambiar'] : []), 'Info', 'Volver'];
  openMenu({ title, items: opts, onSelect: k => {
    const o = opts[k];
    if (o === 'Coger') return pickUp(g);
    if (o === 'Cambiar') return openMenu({ title: `Cambiar ${g.name} por…`, items: state.inventory, onCancel: openGroundMenu, onSelect: j => { const mine = state.inventory[j]; if (pickUp(g, true)) { state.inventory.splice(state.inventory.indexOf(mine), 1); const put = { name: mine, x: p.x, y: p.y }; state.groundItems.push(put); say(`Cambias ${mine} por ${g.name}.`); if (onCarpet(p.x, p.y)) say('(Si quieres vendérselo a Kecleon, cógelo y vuelve a colocarlo.)'); } } });
    if (o === 'Info') { say(itemInfo(g.name)); return openGroundMenu(); }
  } });
}
function pickUp(g, swapping = false) {
  if (!swapping && state.inventory.length >= bagSizeFor(meta?.rankPts)) { say('La bolsa está llena.'); return false; }
  state.groundItems.splice(state.groundItems.indexOf(g), 1);
  state.inventory.push(g.name);
  if (g.shop) { const price = shopPriceFor(g); state.shop.unpaid.push({ name: g.name, price }); say(`Coges ${g.name} (${price} P). Kecleon: "¡Paga antes de irte! O déjalo en la alfombra si cambias de idea."`); }
  else if (!swapping) say(`Coges ${g.name}.`);
  endTurn(true); return true;
}
// Resumen de un Pokémon: habilidades (con su efecto), IQ y habilidades IQ
function openSummary(m, back) {
  refreshTraits();
  const abil = abilitiesOf(m.species).map(a => `${ABILITY_ES[a] || a}: ${ABILITY_DESC[a] || 'su efecto aún no está disponible.'}`);
  const sk = iqSkillsFor(m), learned = sk.filter(s => s.iq <= (m.iq || 0)), next = sk.find(s => s.iq > (m.iq || 0));
  const pages = [
    { who: m.name, text: `${SPECIES[m.species].name} · Nv${m.level} · ${m.hp}/${m.maxHp} PS · IQ ${m.iq || 0}` },
    { who: 'Habilidades', text: abil.join('  ·  ') || 'Ninguna.' },
    { who: 'Habilidades IQ', text: learned.length ? learned.map(s => s.name + (s.works ? '' : ' (pendiente)')).join(', ') + '.' : 'Aún ninguna. ¡Dale gominolas!' },
  ];
  if (next) pages.push({ who: 'Siguiente', text: `${next.name} con IQ ${next.iq} (le faltan ${next.iq - (m.iq || 0)}).` });
  openDialog(pages, back);
}
function openTeamMenu() {
  const lead = state.player;
  openMenu({ title: 'Equipo', items: [`${lead.name} Nv${lead.level} · ${lead.hp}/${lead.maxHp} PS · IQ ${lead.iq || 0} (líder)`, ...state.team.map(a => `${a.name} Nv${a.level} · ${a.hp}/${a.maxHp} PS · ${TACTICS[a.tactic]} · ${a.floors}/${CFG.bondFloors} pisos${a.floors >= CFG.bondFloors ? ' ★' : ''}`)], onSelect: i0 => {
    if (i0 === 0) return openSummary(lead, openTeamMenu);
    const i = i0 - 1;
    const a = state.team[i], keys = Object.keys(TACTICS);
    openMenu({ title: a.name, items: ['Resumen', ...keys.map(k => `Táctica: ${TACTICS[k]}${a.tactic === k ? ' ✓' : ''}`), 'Expulsar del equipo'], onCancel: openTeamMenu, onSelect: j0 => {
      if (j0 === 0) return openSummary(a, openTeamMenu);
      const j = j0 - 1;
      if (j < keys.length) { a.tactic = keys[j]; say(`${a.name}: "${TACTICS[a.tactic]}".`); openTeamMenu(); }
      else openMenu({ title: `¿Expulsar a ${a.name}?${a.floors < CFG.bondFloors ? ' Se perderá.' : ' El vínculo se mantiene.'}`, items: ['No', 'Sí'], onCancel: openTeamMenu, onSelect: k => { if (k === 1) { state.team = state.team.filter(x => x !== a); if (a.floors >= CFG.bondFloors) state.bondedLost.push({ species: a.species, floors: a.floors }); else state.lostRecruits.push(a.species); say(`${a.name} abandona el equipo.`); } render(); } });
    } });
  } });
}
function say(msg) {
  feedPush(msg);   // también dentro de la pantalla (si está activado, por defecto sí)
  state.log.unshift(msg); state.log = state.log.slice(0, 4);
  document.getElementById('log').innerHTML = state.log.map(m => `<p>${m}</p>`).join('');
  logHistory(msg);
}

// ---------- registro de mensajes (como el del original: se puede releer todo lo que ha pasado) ----------
const HISTORY_MAX = 300;
let lastPlace = '';
function logHistory(msg) {
  const place = state.scene === 'dungeon' && state.dungeonDef ? `${state.dungeonDef.name} B${state.floor}F` : 'Gremio';
  const h = state.history ||= [];
  if (place !== lastPlace) { lastPlace = place; h.push({ sep: true, text: place }); }   // separador al cambiar de piso o volver al gremio
  h.push({ text: String(msg) });
  if (h.length > HISTORY_MAX) h.splice(0, h.length - HISTORY_MAX);
}
// campo de texto sencillo (motes): Enter acepta, Escape cancela
function askText(title, max = 10) {
  return new Promise(resolve => {
    state.textOpen = true;
    const el = document.createElement('div'); el.className = 'msg-history ask-text';
    el.innerHTML = `<div class="mh-box"><h3></h3><input type="text" maxlength="${max}" autocomplete="off" spellcheck="false"><div class="at-btns"><button type="button" class="btn at-ok">Aceptar</button><button type="button" class="btn at-no">Cancelar</button></div></div>`;
    el.querySelector('h3').textContent = title; document.body.appendChild(el);
    const inp = el.querySelector('input'); setTimeout(() => inp.focus(), 30);
    const done = v => { el.remove(); state.textOpen = false; render(); resolve(v); };
    const ok = () => { const v = inp.value.replace(/[<>&"'`\\]/g, '').trim().slice(0, max); done(v || null); };
    el.querySelector('.at-ok').onclick = ok; el.querySelector('.at-no').onclick = () => done(null);
    inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') ok(); else if (ev.key === 'Escape') done(null); });
  });
}
function openHistory() {
  track('ui', { what: 'registro' });
  state.historyOpen = true; state.menu = null;
  const el = document.createElement('div'); el.id = 'msg-history'; el.className = 'msg-history';
  const rows = (state.history || []).map(e => e.sep ? `<p class="mh-sep">— ${e.text} —</p>` : `<p>${e.text}</p>`).join('') || '<p class="mh-empty">Aún no hay mensajes.</p>';
  el.innerHTML = `<div class="mh-box"><h3>Registro de mensajes</h3><div class="mh-list">${rows}</div><button type="button" class="btn mh-close">Cerrar</button></div>`;
  document.body.appendChild(el);
  const list = el.querySelector('.mh-list'); list.scrollTop = list.scrollHeight;   // lo más reciente, abajo
  el.querySelector('.mh-close').onclick = closeHistory;
  el.addEventListener('pointerdown', ev => { if (ev.target === el) closeHistory(); });
}
function closeHistory() { state.historyOpen = false; document.getElementById('msg-history')?.remove(); render(); }
function historyKey(btn) {
  const list = document.querySelector('#msg-history .mh-list'); if (!list) return closeHistory();
  if (btn === 'UP') list.scrollTop -= 40; else if (btn === 'DOWN') list.scrollTop += 40;
  else if (btn === 'LEFT') list.scrollTop -= list.clientHeight; else if (btn === 'RIGHT') list.scrollTop += list.clientHeight;
  else if (btn === 'B' || btn === 'X' || btn === 'A' || btn === 'START' || btn === 'SELECT') closeHistory();
}

// =====================================================================
// RENDER
// =====================================================================
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
// Tamaño LÓGICO del juego (todo se dibuja en estas coordenadas). El lienzo real se escala para verse nítido a cualquier tamaño.
const LOG = { w: CFG.view.w * CFG.tile, h: CFG.view.h * CFG.tile };
let RK = 1; // píxeles reales por píxel lógico
const SCALES = { fit: 'Ajustar', 1: '100 %', 1.5: '150 %', 2: '200 %', 2.5: '250 %', 3: '300 %' };
const getScalePref = () => { try { return localStorage.getItem('mm_scale') || 'fit'; } catch { return 'fit'; } };
function applyScale() {
  const pref = getScalePref(), dpr = window.devicePixelRatio || 1;
  let s;
  if (document.body.classList.contains('touch-on')) {
    const pw = canvas.parentElement?.clientWidth || LOG.w;
    if (window.innerWidth > window.innerHeight) {   // móvil tumbado: que quepa en el alto (los mandos van a los lados)
      const head = document.querySelector('#screen-game header'), freeH = window.innerHeight - (head?.offsetHeight || 0) - 8;
      s = Math.max(0.3, Math.min(pw / LOG.w, (window.innerWidth - 330) / LOG.w, freeH / LOG.h));
    } else s = Math.max(0.3, pw / LOG.w); // móvil en vertical: todo el ancho
  }
  else if (pref === 'fit') {
    // lo más grande que quepa: ancho libre junto al panel lateral y alto libre entre cabecera y pie
    const aside = document.querySelector('#screen-game aside'), head = document.querySelector('#screen-game header'), foot = document.querySelector('#screen-game footer');
    const freeW = window.innerWidth - (aside?.offsetWidth || 0) - 60, freeH = window.innerHeight - (head?.offsetHeight || 0) - (foot?.offsetHeight || 0) - 40;
    s = Math.max(1, Math.min(freeW / LOG.w, freeH / LOG.h));
  } else s = +pref;
  canvas.style.width = Math.round(LOG.w * s) + 'px'; canvas.style.height = Math.round(LOG.h * s) + 'px';
  canvas.width = Math.round(LOG.w * s * dpr); canvas.height = Math.round(LOG.h * s * dpr);
  RK = canvas.width / LOG.w;
  render();
}
canvas.width = LOG.w; canvas.height = LOG.h;
window.addEventListener('resize', () => { document.body.classList.toggle('log-inside', logInside()); if (state.player && document.body.classList.contains('in-game')) applyScale(); });
// la cabecera y el registro cambian de alto (en la mazmorra hay más datos): el juego se reajusta para que todo quepa
try {
  let lastH = '';
  const ro = new ResizeObserver(() => {
    const h = ['#screen-game header', '#screen-game footer'].map(s => document.querySelector(s)?.offsetHeight || 0).join('/');
    if (h !== lastH && document.body.classList.contains('in-game')) { lastH = h; applyScale(); }
  });
  for (const s of ['#screen-game header', '#screen-game footer']) { const el = document.querySelector(s); if (el) ro.observe(el); }
} catch {} // no dibujar el juego antes de entrar
const isVisibleNow = (x, y) => {
  const p = state.player, rm = state.inRoom;
  if (state.dungeon?.arena) return true;
  const r = corridorSight(); if (Math.abs(x - p.x) <= r && Math.abs(y - p.y) <= r) return true;   // a tu alrededor
  return !!rm && x >= rm.x - 1 && x <= rm.x + rm.w && y >= rm.y - 1 && y <= rm.y + rm.h;           // y tu sala entera
};
// radio de luz en los pasillos (en las salas se ve la sala entera)
function corridorSight() { return WEATHER[state.weather]?.sight ?? CFG.corridorSight; }
function render() { if (!state.player && state.scene === 'dungeon') return; ctx.setTransform(RK, 0, 0, RK, 0, 0); state.scene === 'hub' ? renderHub() : renderDungeon(); drawFlash(); renderFeed(); renderMenu(); renderDialog(); renderHud(); }
// ---- mensajes dentro de la pantalla (como en Mundo Misterioso): recuadro abajo que se desvanece a los pocos segundos ----
const FEED_MS = 4200, FEED_FADE = 600;
const logInside = () => {   // por defecto, fuera (debajo del juego, como la pantalla de abajo de la DS); con el móvil tumbado no hay sitio: dentro
  if (document.body.classList.contains('touch-on') && window.innerWidth > window.innerHeight) return true;
  try { return localStorage.getItem('mm_log') === 'inside'; } catch { return false; }
};
let feedTimer = null;
function feedPush(msg) {
  if (state.scene !== 'dungeon') return;   // en la aldea no hay registro dentro de la pantalla
  (state.feed ||= []).push({ text: String(msg).replace(/<[^>]+>/g, ''), t: performance.now() });
  state.feed = state.feed.slice(-3);
  if (!feedTimer && logInside()) feedTimer = setInterval(() => { render(); if (!(state.feed || []).some(f => performance.now() - f.t < FEED_MS)) { clearInterval(feedTimer); feedTimer = null; render(); } }, 80);
}
// Iconos de estado sobre los Pokémon, como en el original (zetas, burbujas, rayo, llama, estrellas, copo)
function drawStatusIcon(e, px, py, tile) {
  const k = e.status?.kind || (e.asleep ? 'sleep' : e.terrified ? 'terrified' : null); if (!k) return false;
  const t = performance.now() / 1000, s = tile / 24, x = px + tile - 6 * s, y = py + 5 * s;
  ctx.save(); ctx.lineWidth = Math.max(1, 1.2 * s);
  if (k === 'sleep') {
    ctx.fillStyle = '#e8eefc'; ctx.strokeStyle = '#2a3560'; ctx.font = `bold ${Math.round(8 * s)}px sans-serif`;
    for (let i = 0; i < 2; i++) { const ph = (t * 0.8 + i * 0.5) % 1; ctx.globalAlpha = 1 - ph; ctx.strokeText('z', x - 2 * s + ph * 4 * s, y + 4 * s - ph * 8 * s); ctx.fillText('z', x - 2 * s + ph * 4 * s, y + 4 * s - ph * 8 * s); }
  } else if (k === 'poison' || k === 'toxic') {
    for (let i = 0; i < 3; i++) { const ph = (t * 0.9 + i / 3) % 1; ctx.globalAlpha = 1 - ph * 0.8; ctx.fillStyle = k === 'toxic' ? '#8a2ac0' : '#b060e0';
      ctx.beginPath(); ctx.arc(x - 6 * s + i * 4 * s, y + 3 * s - ph * 7 * s, (1.6 + (i % 2)) * s, 0, Math.PI * 2); ctx.fill(); }
  } else if (k === 'paralysis') {
    if (Math.floor(t * 4) % 2 === 0) { ctx.strokeStyle = '#f8d030'; ctx.beginPath(); ctx.moveTo(x, y - 4 * s); ctx.lineTo(x - 3 * s, y + 1 * s); ctx.lineTo(x + 1 * s, y + 1 * s); ctx.lineTo(x - 2 * s, y + 6 * s); ctx.stroke(); }
  } else if (k === 'burn') {
    const f = 1 + 0.15 * Math.sin(t * 12);
    ctx.fillStyle = '#f06030'; ctx.beginPath(); ctx.moveTo(x, y - 5 * s * f); ctx.quadraticCurveTo(x + 4 * s, y + 1 * s, x, y + 4 * s); ctx.quadraticCurveTo(x - 4 * s, y + 1 * s, x, y - 5 * s * f); ctx.fill();
    ctx.fillStyle = '#f8d030'; ctx.beginPath(); ctx.arc(x, y + 1.5 * s, 1.6 * s, 0, Math.PI * 2); ctx.fill();
  } else if (k === 'confusion') {
    const cx = px + tile / 2, cy = py + 2 * s;
    for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.09; ctx.fillStyle = '#f8e070'; ctx.font = `${Math.round(7 * s)}px sans-serif`; ctx.fillText('★', cx + Math.cos(a) * 7 * s - 3 * s, cy + Math.sin(a) * 2.5 * s + 2 * s); }
  } else if (k === 'terrified') {   // asustado: gotas de sudor que caen
    for (let i = 0; i < 2; i++) { const ph = (t * 1.4 + i * 0.5) % 1; ctx.globalAlpha = 1 - ph; ctx.fillStyle = '#9fd8ff';
      ctx.beginPath(); ctx.ellipse(x - 5 * s + i * 5 * s, y - 2 * s + ph * 7 * s, 1.4 * s, 2.2 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  } else if (k === 'freeze') {
    ctx.strokeStyle = '#a8e0f8';
    for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 4 * s, y - Math.sin(a) * 4 * s); ctx.lineTo(x + Math.cos(a) * 4 * s, y + Math.sin(a) * 4 * s); ctx.stroke(); }
  } else { ctx.fillStyle = '#b48ead'; ctx.font = `bold ${Math.round(9 * s)}px sans-serif`; ctx.fillText(STATUS[k]?.name?.[0] || '?', x - 3 * s, y + 3 * s); }
  ctx.restore(); return true;
}
const STAT_NAMES_DE = { atk: 'el Ataque', def: 'la Defensa', spa: 'el At. Esp.', spd: 'la Def. Esp.' };   // «sube el Ataque de…»
const AREA_NAMES = { plaza: 'Plaza del gremio', gremio: 'Gremio de Pidgeot', descanso: 'Zona de descanso', mercado: 'Mercado', aldea: 'Aldea', fuente: 'Fuente de la Evolución' };   // nombre de cada zona (etiqueta del mapa y cabecera)
function renderFeed() {
  if (!logInside() || state.dialog || state.scene !== 'dungeon') return;   // solo en las mazmorras (en la aldea del original no hay registro)
  const now = performance.now(), items = (state.feed || []).filter(f => now - f.t < FEED_MS);
  if (!items.length) return;
  const newest = Math.max(...items.map(f => f.t)), alpha = Math.min(1, (FEED_MS - (now - newest)) / FEED_FADE);
  const W = LOG.w, H = LOG.h, s = UIS(), size = Math.round((Sprites.fontName ? 10 : 12) * s), lh = Math.round(size * 1.45);
  ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
  ctx.font = `${size}px ${DIALOG_FONT()}`;
  const lines = items.flatMap(f => wrapText(f.text, W - 44)).slice(-3);
  const h = lines.length * lh + 18, x = 8, y = H - h - 8, w = W - 16;
  ctx.fillStyle = '#10204a'; roundRect(x, y, w, h, 6); ctx.fill();
  ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 2; roundRect(x + 2, y + 2, w - 4, h - 4, 5); ctx.stroke();
  ctx.strokeStyle = '#5070c0'; ctx.lineWidth = 1; roundRect(x + 5, y + 5, w - 10, h - 10, 4); ctx.stroke();
  ctx.fillStyle = '#f8f8f8'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x + 14, y + 9 + i * lh));
  ctx.textBaseline = 'alphabetic'; ctx.restore();
}
const HUB_SCALE = 2; // los sprites van al doble en la aldea para casar con la escala de los edificios
let musicZone = null;
function renderHub() {
  if (state.scene === 'hub' && document.body.classList.contains('in-game') && !state.cut?.music && state.hub?.area !== musicZone) { musicZone = state.hub?.area; playZone(musicZone); } // solo dentro del juego (una escena con música propia manda)
  const W = LOG.w, H = LOG.h, h = state.hub, area = Hub.view(h.area), def = HUB[h.area];
  const cam = state.cut?.cam ? { x: state.cut.cam.x, y: state.cut.cam.y } : { x: Math.max(0, Math.min(768 - W, h.x - W / 2)), y: Math.max(0, Math.min(515 - H, h.y - H / 2)) };   // en una escena, la cámara la manda el guion
  if (state.cut?.shake) { const [sx0, sy0] = sceneShake(); cam.x += sx0; cam.y += sy0; }   // temblor (alguien grita, un golpe…)
  // dónde quedan en pantalla los que participan en la conversación (para no taparlos con el cuadro de diálogo)
  if (!state.dialog) state.talkNpc = null;
  const tg0 = state.tour?.guide;
  // Rectángulo en pantalla de quien participa en la conversación (cuerpo entero + hueco para los efectos de encima
  // de la cabeza): el cuadro de diálogo y el retrato nunca deben taparlo. En una escena, el actor que habla.
  const rectAt = (x, y, tall) => ({ l: x - cam.x - 28, r: x - cam.x + 28, t: y - cam.y - tall, b: y - cam.y + 8 });
  const spk = state.cut?.speaking;
  state.dlgFocus = spk ? [rectAt(spk.x, spk.y, 104), ...(state.cut?.hidePlayer ? [] : [rectAt(h.x, h.y, 76)])]
    : [...(state.cut?.hidePlayer ? [] : [rectAt(h.x, h.y, 76)]), ...(state.talkNpc?.area === h.area ? [rectAt(state.talkNpc.x, state.talkNpc.y, 84)] : []), ...(tg0?.area === h.area ? [rectAt(tg0.x, tg0.y, 84)] : [])];
  state.dlgCam = cam;
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H);
  if (area?.img) ctx.drawImage(area.img, -cam.x, -cam.y); else { ctx.fillStyle = '#3f6b3a'; ctx.fillRect(0, 0, W, H); }
  if (state.showMask && area?.debug) ctx.drawImage(area.debug, -cam.x, -cam.y);
  // entidades ordenadas por y para que el que está más abajo tape al de arriba
  const tg = state.tour?.guide, tourNpc = tg && tg.area === h.area ? [{ id: 'chatot', x: tg.x, y: tg.y, facing: tg.facing, movedAt: tg.movedAt, kind: 'npc' }] : [];
  const ents = [...(area?.objs || []).map(o => ({ ...o, kind: 'obj', oy: o.y, y: o.base })), ...def.npcs.filter(n => npcShown(n) && !n.hidden && !state.cut?.hideNpcs && !state.cut?.hideNpcIds?.includes(n.id)).map(n => ({ ...n, kind: 'npc', still: !n.idle || !!n.still || (!!state.dialog && state.talkNpc?.x === n.x && state.talkNpc?.y === n.y) })), ...tourNpc, ...(state.cut ? [] : h.wanderers.map(w => ({ ...w, kind: 'w' }))), ...sceneEntities(area), ...(h.area === 'plaza' && !state.cut && !(meta.scenes || []).includes('acto1-bandeja') ? [{ kind: 'sceneobj', x: 432, y: 196, draw: (c, sx, sy) => drawSceneObjectAt(c, 'tray', sx, sy) }] : []), { species: state.player?.species, x: h.x, y: h.y, facing: h.facing, movedAt: h.movedAt, kind: 'me' }].filter(e => !(state.cut?.hidePlayer && e.kind === 'me')).sort((a, b) => a.y - b.y);
  const fg = (def.fg || []).map(f => ({ ...f, drawn: false }));
  const drawFg = f => {   // capa de primer plano: un trozo de la imagen redibujado encima; con poly, solo esa forma (p. ej. un mostrador en diagonal)
    if (f.drawn || !area?.img) return; f.drawn = true;
    const P = f.poly, [x0, y0, x1, y1] = f.rect || [Math.min(...P.map(q => q[0])), Math.min(...P.map(q => q[1])), Math.max(...P.map(q => q[0])), Math.max(...P.map(q => q[1]))];
    ctx.save();
    if (P) { ctx.beginPath(); P.forEach(([px, py], i) => i ? ctx.lineTo(px - cam.x, py - cam.y) : ctx.moveTo(px - cam.x, py - cam.y)); ctx.closePath(); ctx.clip(); }
    ctx.drawImage(area.img, x0, y0, x1 - x0, y1 - y0, x0 - cam.x, y0 - cam.y, x1 - x0, y1 - y0); ctx.restore();
  };
  for (const e of ents) {
    for (const f of fg) if ((f.sortY ?? f.rect?.[3] ?? Math.max(...f.poly.map(q => q[1]))) <= e.y) drawFg(f);   // sortY: hasta dónde tapa (p. ej. la viga tapa a quien cruza entre los postes) // lo que queda por encima de este personaje ya se pinta antes que él
    if (e.kind === 'obj') {
      // objeto por delante si estás detrás; si te tapa, se vuelve semitransparente para no perderte de vista
      const hides = h.y < e.base && h.x + 16 > e.x && h.x - 16 < e.x + e.w && h.y > e.oy && h.y - 44 < e.oy + e.h;
      if (hides) ctx.globalAlpha = 0.5;
      ctx.drawImage(area.objImg, e.ax, e.ay, e.w, e.h, e.x - cam.x, e.oy - cam.y, e.w, e.h);
      ctx.globalAlpha = 1; continue;
    }
    const sx = e.x - cam.x, sy = e.y - cam.y, key = e.kind === 'npc' ? e.id : e.species;
    if (e.kind === 'sceneobj') { e.draw(ctx, sx, sy); continue; }
    if (e.kind === 'actor') { drawSceneActor(ctx, e, sx, sy, HUB_SCALE, (c, m, px, py, t) => Sprites.drawMon(c, m, px, py, t)); continue; }
    if (e.kind === 'me' && h.inBed) {   // tumbado en la cama: el personaje de lado, algo más bajo (la manta ya está en la imagen)
      ctx.save(); ctx.translate(sx, sy - HUB_SCALE * 4); ctx.rotate(-Math.PI / 2);
      if (!Sprites.drawMon(ctx, { species: key, facing: [0, 1], movedAt: 0 }, -HUB_SCALE * 12, -HUB_SCALE * 12, HUB_SCALE * 24)) { ctx.fillStyle = '#f2b544'; ctx.beginPath(); ctx.ellipse(0, 0, HUB_SCALE * 8, HUB_SCALE * 11, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `bold ${HUB_SCALE * 7}px sans-serif`; ctx.fillText('z', sx + HUB_SCALE * 8, sy - HUB_SCALE * 20 - 3 * Math.sin(performance.now() / 400));
      continue;
    }
    const jl = e.kind === 'me' && h.jumpArc ? Math.sin(Math.PI * Math.min(1, (performance.now() - h.jumpArc.t0) / h.jumpArc.ms)) * h.jumpArc.h : 0;   // saltando (en una escena)
    const pose = e.pose && !(e.poseUntil && (meta?.scenes || []).includes(e.poseUntil)) ? { name: e.pose, t0: 0, dur: Infinity, loop: true } : undefined;   // (Smeargle durmiendo…)
    if (!Sprites.drawMon(ctx, { species: key, facing: e.facing, movedAt: e.movedAt, anim: pose, still: e.still || (e.kind === 'me' && !!state.dialog) }, sx - HUB_SCALE * 12, sy - HUB_SCALE * 24 - jl, HUB_SCALE * 24)) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(sx, sy - 2, 10 * HUB_SCALE / 2, 3 * HUB_SCALE / 2, 0, 0, Math.PI * 2); ctx.fill(); }   // aún descargando: solo su sombra
  }
  fg.forEach(drawFg);
  drawSceneOverlay(ctx, W, H, cam);   // noche, narración y fundidos de las escenas
  drawScreenFade(ctx, W, H);           // fundido a negro de entrada y salida de las escenas
  if (state.cut) return;
  // indicación de interacción cerca de un PNJ o cartel
  const fx = h.x + h.facing[0] * 22, fy = h.y + h.facing[1] * 22;
  const near = def.npcs.filter(npcShown).find(n => (!n.approach || inRect(h.x, h.y, n.approach)) && (Math.hypot(n.x - fx, n.y - fy) < (n.reach ? n.reach - 20 : 24) || Math.hypot(n.x - h.x, n.y - h.y) < (n.reach || 26))) || (def.signs || []).find(s => inRect(fx, fy, s.rect)) || (def.hotspots || []).find(hs => inRect(fx, fy, hs.rect) || inRect(h.x, h.y, hs.rect)) || def.exits.find(ex => ex.label && inExit(ex, fx, fy));
  if (near && !state.menu && !state.dialog) { ctx.font = 'bold 11px sans-serif'; const hint = (document.body.classList.contains('touch-on') ? 'A' : 'Z') + ' · ' + (near.label || near.text ? (near.label || 'Leer') : 'Hablar'), hw = ctx.measureText(hint).width + 20; ctx.fillStyle = 'rgba(20,18,28,.85)'; ctx.fillRect(W / 2 - hw / 2, 8, hw, 20); ctx.fillStyle = '#f2b544'; ctx.textAlign = 'center'; ctx.fillText(hint, W / 2, 22); ctx.textAlign = 'left'; } // el fondo se ajusta al texto
  { ctx.font = '11px sans-serif'; const nm = AREA_NAMES[h.area] || ''; ctx.fillStyle = 'rgba(20,18,28,.7)'; ctx.fillRect(8, 8, ctx.measureText(nm).width + 12, 18); ctx.fillStyle = '#e9e3d3'; ctx.fillText(nm, 14, 21); } // el fondo se ajusta al texto
}
const TILE_COLORS = { [T.WALL]: '#3b2f5a', [T.FLOOR]: '#8f7a5c', [T.STAIRS]: '#8f7a5c', [T.WATER]: '#2f6fa8', [T.LAVA]: '#c4521f' };
const TILE_KEYS = { [T.WALL]: 'wall', [T.FLOOR]: 'floor', [T.STAIRS]: 'stairs', [T.WATER]: 'water', [T.LAVA]: 'lava' };
// Tiles estilo PMD: primero la textura del bioma (floor_bosque), si no la genérica (floor). Una textura grande se reparte
// entre 4×4 casillas. Encima, el "look" de Mundo Misterioso se dibuja por código: interior de pared oscuro y plano,
// bloques con cara frontal cuando hay suelo debajo, bordes iluminados hacia el suelo y damero suave en el suelo.
// Muestreo sin periodo visible: cada bloque de 2×2 casillas toma un trozo distinto de la textura (posición
// pseudoaleatoria estable + volteo), así una masa de pared parece un solo chunk y no un tile repetido.
const h32 = (x, y) => { let v = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0; v = Math.imul(v ^ (v >>> 13), 1274126177) >>> 0; return (v ^ (v >>> 16)) >>> 0; };
const texFor = key => Sprites.images[`${key}_${state.era || state.dungeonDef?.id}`] || Sprites.images[key];
function drawTex(img, x, y, px, py, w, h, cropH = CFG.tile) {
  if (img.width <= CFG.tile * 2) { ctx.drawImage(img, px, py, w + 0.75, h + 0.75); return; }
  const sw = img.width / 4, hv = h32(x >> 1, y >> 1);
  const ox = hv % (img.width - 2 * sw), oy = (hv >>> 8) % (img.height - 2 * sw), flip = (hv >>> 16) & 1;
  const u = ox + (x & 1) * sw, v = oy + (y & 1) * sw, sh = sw * cropH / CFG.tile;
  if (flip) { ctx.save(); ctx.translate(px + w, py); ctx.scale(-1, 1); ctx.drawImage(img, u, v, sw, sh, 0, 0, w, h); ctx.restore(); }
  else ctx.drawImage(img, u, v, sw, sh, px, py, w + 0.75, h + 0.75);
}
const tint = (px, py, w, h, color, a) => { ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fillRect(px, py, w, h); ctx.globalAlpha = 1; };
function wallOutline(x, y, px, py, tile) { // contorno continuo de la masa de pared, dibujado desde el lado del suelo
  ctx.fillStyle = (WALL_PALETTES[state.era || state.dungeonDef?.id] || WALL_PALETTES.cueva).outline;
  if (tileAt(x, y - 1) === T.WALL) ctx.fillRect(px, py, tile, 1);
  if (tileAt(x, y + 1) === T.WALL) ctx.fillRect(px, py + tile - 1, tile, 1);
  if (tileAt(x - 1, y) === T.WALL) ctx.fillRect(px, py, 1, tile);
  if (tileAt(x + 1, y) === T.WALL) ctx.fillRect(px + tile - 1, py, 1, tile);
}
function drawTile(key, x, y, px, py, tile) {
  const img = texFor(key); if (!img) return false;
  if (key === 'stairs') { const f = texFor('floor'); if (f) { drawTex(f, x, y, px, py, tile, tile); tint(px, py, tile, tile, '#8f7a5c', 0.4); } ctx.drawImage(img, px, py, tile, tile); wallOutline(x, y, px, py, tile); return true; }
  if (key === 'floor') { drawTex(img, x, y, px, py, tile, tile); tint(px, py, tile, tile, '#8f7a5c', 0.4); if ((x + y) % 2 === 0) tint(px, py, tile, tile, '#fff', 0.05); wallOutline(x, y, px, py, tile); return true; }
  if (key === 'water' || key === 'lava') {
    const liquid = t => t === T.WATER || t === T.LAVA, isW = key === 'water';
    drawTex(img, x, y, px, py, tile, tile); tint(px, py, tile, tile, isW ? '#3478be' : '#aa3714', 0.55);
    ctx.fillStyle = isW ? '#1e4678' : '#5a190a';
    if (!liquid(tileAt(x, y - 1))) ctx.fillRect(px, py, tile, 2);
    if (!liquid(tileAt(x, y + 1))) ctx.fillRect(px, py + tile - 2, tile, 2);
    if (!liquid(tileAt(x - 1, y))) ctx.fillRect(px, py, 2, tile);
    if (!liquid(tileAt(x + 1, y))) ctx.fillRect(px + tile - 2, py, 2, tile);
    if (!liquid(tileAt(x, y - 1))) { ctx.fillStyle = isW ? '#8cc8f0' : '#ffaa3c'; ctx.fillRect(px + 2, py + 2, tile - 4, 1); }
    wallOutline(x, y, px, py, tile); return true;
  }
  // pared: toda la masa igual (textura apagada con la paleta del bioma); sólo se marca el canto hacia el suelo
  const P = WALL_PALETTES[state.era || state.dungeonDef?.id] || WALL_PALETTES.cueva;
  const open = (dx, dy) => tileAt(x + dx, y + dy) !== T.WALL;
  const N = open(0, -1), E = open(1, 0), S = open(0, 1), W = open(-1, 0);
  drawTex(img, x, y, px, py, tile, tile); tint(px, py, tile, tile, P.mass, P.massA);
  if (P.dots) { const hv = h32(x, y); ctx.fillStyle = P.dots; for (let i = 0; i < 3; i++) ctx.fillRect(px + (hv >>> (i * 5)) % (tile - 3), py + (hv >>> (i * 5 + 3)) % (tile - 3), 2, 1); }
  if (S) {
    const fh = Math.round(tile * 0.42), hv = h32(x, y);
    ctx.fillStyle = P.face; ctx.fillRect(px, py + tile - fh, tile, fh);
    ctx.fillStyle = P.faceHi; ctx.fillRect(px, py + tile - fh, tile, 1); ctx.fillStyle = P.faceLo; ctx.fillRect(px, py + tile - fh + 1, tile, 1);
    if (P.grain) { ctx.fillStyle = P.faceLo; for (let i = 0; i < 2; i++) ctx.fillRect(px + (hv >>> (i * 7)) % (tile - 2), py + tile - fh + 3, 1, fh - 5); }
    ctx.fillStyle = '#0c0a08'; ctx.fillRect(px, py + tile - 1, tile, 1);
  }
  if (N) { ctx.fillStyle = P.edge; ctx.fillRect(px, py, tile, 3); ctx.fillStyle = P.edge2; ctx.fillRect(px, py + 3, tile, 1); }
  if (W) { ctx.fillStyle = P.edgeW; ctx.fillRect(px, py, 3, tile); }
  if (E) { ctx.fillStyle = P.shadow; ctx.fillRect(px + tile - 2, py, 2, tile); }
  if (N && W) { ctx.fillStyle = P.edge; ctx.fillRect(px, py, 3, 3); }
  if (!N && !W && open(-1, -1)) { ctx.fillStyle = P.edgeW; ctx.fillRect(px, py, 3, 3); }
  if (!N && !E && open(1, -1)) { ctx.fillStyle = P.edge; ctx.fillRect(px + tile - 2, py, 2, 3); }
  return true;
}
// Paleta de pared por bioma: masa (copa de árboles, roca…), canto iluminado, sombra, cara frontal (tronco, piedra…)
const WALL_PALETTES = {
  bosque: { mass: '#18341e', massA: 0.68, dots: '#346032', edge: '#5c8c40', edge2: '#305428', edgeW: '#507c3a', shadow: '#0a160e', face: '#3e2c1e', faceHi: '#785838', faceLo: '#281c14', grain: true, outline: '#243c1e' },
  cueva:  { mass: '#1c2430', massA: 0.72, edge: '#6a7e8c', edge2: '#3c4a56', edgeW: '#5e7280', shadow: '#0c1016', face: '#28323c', faceHi: '#7a8e9c', faceLo: '#1a2028', outline: '#2a3640' },
  monte:  { mass: '#2a1614', massA: 0.72, edge: '#8c5040', edge2: '#4e2a24', edgeW: '#7e4638', shadow: '#12080a', face: '#3a1e1a', faceHi: '#9a5a48', faceLo: '#241210', outline: '#3c2020' },
  ruinas: { mass: '#2a2416', massA: 0.7, dots: '#4a5a30', edge: '#a08a48', edge2: '#5c4e2a', edgeW: '#8e7a40', shadow: '#140f08', face: '#3e3420', faceHi: '#a89052', faceLo: '#261e12', outline: '#3c321c' },
  tiempo: { mass: '#1e1830', massA: 0.72, dots: '#4a3c78', edge: '#8070b8', edge2: '#48407a', edgeW: '#7062a8', shadow: '#0a0814', face: '#2a2240', faceHi: '#8c7cc4', faceLo: '#1a1428', outline: '#302848' },
};
function renderDungeon() {
  const { tile } = CFG, p = state.player;
  const ox = p.x - Math.floor(CFG.view.w / 2), oy = p.y - Math.floor(CFG.view.h / 2);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, LOG.w, LOG.h);
  // zoom centrado en el jugador (en móvil la vista completa quedaría diminuta); los menús no se escalan
  const zoom = DUNGEON_ZOOM(), pcx = Math.floor(CFG.view.w / 2) * tile + tile / 2, pcy = Math.floor(CFG.view.h / 2) * tile + tile / 2;
  // cámara: sigue la posición deslizada del jugador (entre dos casillas mientras camina)
  sliding = false; const pv = vpos(p), camX = (pv.x - p.x) * tile, camY = (pv.y - p.y) * tile;
  ctx.save(); ctx.translate(LOG.w / 2, LOG.h / 2); ctx.scale(zoom, zoom); ctx.translate(-pcx - camX, -pcy - camY);
  { const [shx, shy] = fxShake(); const m = ctx.getTransform(); ctx.setTransform(m.a, m.b, m.c, m.d, Math.round(m.e + shx * m.a), Math.round(m.f + shy * m.d)); }   // origen en píxeles enteros (sin costuras entre casillas), y el temblor de los golpes fuertes
  lastCam = { ox, oy, zoom, pcx, pcy, camX, camY };   // para convertir un toque en pantalla en una casilla
  for (let vy = -1; vy <= CFG.view.h; vy++) for (let vx = -1; vx <= CFG.view.w; vx++) {
    const x = ox + vx, y = oy + vy;
    if (y < 0 || y >= CFG.map.h || x < 0 || x >= CFG.map.w || !state.seen[y][x]) continue;
    const t = state.dungeon.tiles[y][x], px = vx * tile, py = vy * tile;
    if (drawDtef(t, x, y, px, py, tile)) { if (t === T.STAIRS) drawTile('stairs', x, y, px, py, tile); }   // tileset del original (PMDCollab)
    else if (!drawTile(TILE_KEYS[t], x, y, px, py, tile)) {
      ctx.fillStyle = TILE_COLORS[t]; ctx.fillRect(px, py, tile, tile);
      if (t === T.FLOOR) { ctx.fillStyle = '#7d6a4e'; ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2); }
      if (t === T.WATER) { ctx.fillStyle = '#3d86c4'; ctx.fillRect(px + 3, py + 8, tile - 6, 2); ctx.fillRect(px + 6, py + 16, tile - 12, 2); }
      if (t === T.LAVA) { ctx.fillStyle = '#f0863a'; ctx.fillRect(px + 4, py + 6, 6, 4); ctx.fillRect(px + 14, py + 14, 5, 5); }
      if (t === T.STAIRS) { ctx.fillStyle = '#e9e3d3'; for (let i = 0; i < 4; i++) ctx.fillRect(px + 4, py + 4 + i * 5, tile - 8 - i * 4, 3); }
    }
    if (tileAt(x, y) === T.STAIRS && stairsSealed() && state.seen?.[y]?.[x]) {   // escalera sellada: cruz roja encima
      ctx.strokeStyle = '#e04848'; ctx.lineWidth = Math.max(2, tile / 8); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px + tile * 0.2, py + tile * 0.2); ctx.lineTo(px + tile * 0.8, py + tile * 0.8); ctx.moveTo(px + tile * 0.8, py + tile * 0.2); ctx.lineTo(px + tile * 0.2, py + tile * 0.8); ctx.stroke(); ctx.lineCap = 'butt';
    }
    if (onCarpet(x, y) && isVisibleNow(x, y)) { tint(px, py, tile, tile, '#a83a4a', 0.35); ctx.strokeStyle = '#e0b060'; ctx.lineWidth = 1; ctx.strokeRect(px + 1.5, py + 1.5, tile - 3, tile - 3); }
    const g = state.groundItems.find(g => g.x === x && g.y === y);
    if (g && isVisibleNow(x, y)) { const isz = Math.round(tile * 0.66), o = (tile - isz) / 2; if (!drawItemIcon(ctx, g.name, px + o, py + o, isz)) { ctx.fillStyle = g.missionId ? '#f2b544' : ITEMS[g.name]?.kind === 'sell' ? '#8fd0e6' : ITEMS[g.name]?.kind === 'orb' ? '#c9a2ff' : '#e07a5f'; ctx.fillRect(px + 8, py + 8, tile - 16, tile - 16); } if (g.shop) { ctx.fillStyle = '#e0b060'; ctx.font = `bold ${Math.round(tile / 3)}px sans-serif`; ctx.fillText('P', px + 2, py + tile / 3); } }
    if (!isVisibleNow(x, y)) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(px, py, tile, tile); }
  }
  if (state.dungeon.restArea) drawRestArea(ox, oy, tile);   // sala de descanso: imagen (si existe) y estatua
  let animating = false;
  const drawEntity = (e, color, ring) => {
    const v = e.fading ? { x: e.x, y: e.y } : vpos(e), vx = v.x - ox, vy = v.y - oy;   // posición deslizada
    if (vx < -1 || vy < -1 || vx > CFG.view.w || vy > CFG.view.h || !isVisibleNow(e.x, e.y)) return;
    const px = vx * tile, py = vy * tile, cx = px + tile / 2, cy = py + tile / 2;
    if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, tile / 2 - 2, 0, Math.PI * 2); ctx.stroke(); }
    if (!Sprites.drawMon(ctx, e, px, py, tile)) { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(cx, py + tile - 4, tile / 3, tile / 9, 0, 0, Math.PI * 2); ctx.fill(); animating = true; }   // aún descargando: solo su sombra
    else animating = true;
    if (drawStatusIcon(e, px, py, tile)) animating = true;   // iconos animados de estado sobre el Pokémon
    if (e.emotes?.length) {   // efectos sobre la cabeza (escenas en la mazmorra)
      const t = performance.now(); e.emotes = e.emotes.filter(em => (t - em.t0) / 1000 <= (EMOTE_LEN[em.fx] || 1));
      for (const em of e.emotes) drawEmote(ctx, em.fx, cx, py + tile * 0.05, (t - em.t0) / 1000, Math.max(1, Math.round(tile / 24)));
      animating = true;
    }
    if (e.missionId && !e.emotes?.length) { ctx.fillStyle = e.outlaw ? '#e04848' : '#f2b544'; ctx.font = 'bold 10px sans-serif'; ctx.fillText(e.outlaw ? '☠' : '!', px + 3, py + 10); }   // forajido: calavera roja
    if (e.maxHp) { ctx.fillStyle = '#000'; ctx.fillRect(px + 2, py + tile - 4, tile - 4, 3); ctx.fillStyle = e.isBoss ? '#f2b544' : isAlly(e) ? '#8fd0e6' : '#5fcf8a'; ctx.fillRect(px + 2, py + tile - 4, (tile - 4) * e.hp / e.maxHp, 3); }
  };
  for (const n of state.npcs) drawEntity(n, n.keeper ? '#4caf6d' : '#d98cb3', '#f2b544');
  for (const e of state.enemies) drawEntity(e, e.mega ? '#b060e0' : e.isLegendary ? '#5b8def' : e.isBoss || e.minion ? '#8b3a3a' : e.missionId ? '#d98cb3' : '#c95c5c');
  for (const a of state.team) drawEntity(a, '#e0b060', '#8fd0e6');
  if (state.fading?.length) {   // los que acaban de caer
    const now = performance.now(); state.fading = state.fading.filter(f => now < f.until);
    for (const f of state.fading) { ctx.save(); if (f.fadeOut) ctx.globalAlpha = Math.max(0, (f.until - now) / 650); drawEntity(f, '#c95c5c'); ctx.restore(); animating = true; }
  }
  drawEntity(p, '#f2b544');
  if (held.has('Y') && !state.menu && !state.dialog && !state.dead) { const pvx = p.x - ox, pvy = p.y - oy; drawTurnArrows(pvx * tile + tile / 2, pvy * tile + tile / 2, p.facing, tile); }
  if (drawMoveFx(ctx, (x, y) => [(x - ox) * tile + tile / 2, (y - oy) * tile + tile / 2], tile)) scheduleRender();   // animaciones de los movimientos
  const now = performance.now();
  state.effects = state.effects.filter(f => now - f.t < 700);
  for (const f of state.effects) {
    if (now < f.t) { scheduleRender(); continue; }   // (un número que aún no ha llegado: espera al impacto)
    const k = (now - f.t) / 700, vx = f.x - ox, vy = f.y - oy, big = f.miss || f.eff > 1;
    ctx.globalAlpha = 1 - k * k; ctx.font = big ? 'bold 15px ui-monospace, Menlo, monospace' : 'bold 12px sans-serif';
    const tx = vx * tile + (f.miss ? 2 : 6), ty = vy * tile + 10 - k * 14;
    if (big) { ctx.lineWidth = 3; ctx.strokeStyle = '#1a1a2a'; ctx.strokeText(f.text, tx, ty); }   // contorno oscuro (como el MISS del original)
    ctx.fillStyle = f.eff > 1 ? '#ffd040' : f.color; ctx.fillText(f.text, tx, ty); ctx.globalAlpha = 1;
  }
  ctx.restore();
  drawWeather();
  if (state.showMap !== false && !state.dungeon.arena) drawMinimap();
  if (held.has('L') && !state.menu && !state.dialog) drawMoveHints();
  if (state.effects.length || animating || sliding || (state.weather && state.weather !== 'none')) scheduleRender();   // sliding: alguien se está deslizando
  if (state.dead) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, LOG.w, LOG.h); }
}
// triángulo que indica hacia dónde mira (para los círculos sin sprite)
function drawFacingMark(cx, cy, f, tile) {
  const len = Math.hypot(f[0], f[1]) || 1, ux = f[0] / len, uy = f[1] / len, r = tile / 2 - 2;
  const tx = cx + ux * r, ty = cy + uy * r, bx = cx + ux * (r - 7), by = cy + uy * (r - 7);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1a1626'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx - uy * 4, by + ux * 4); ctx.lineTo(bx + uy * 4, by - ux * 4); ctx.closePath(); ctx.fill(); ctx.stroke();
}
// al mantener Y: las 8 flechas de PMD alrededor del jugador, con la dirección actual resaltada
function drawTurnArrows(cx, cy, facing, tile) {
  const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  for (const [dx, dy] of dirs) {
    const on = dx === Math.sign(facing[0]) && dy === Math.sign(facing[1]);
    const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, d = tile * 0.95;
    const tx = cx + ux * (d + 6), ty = cy + uy * (d + 6), bx = cx + ux * d, by = cy + uy * d;
    ctx.fillStyle = on ? '#f8d848' : 'rgba(248,248,248,.55)'; ctx.strokeStyle = '#10204a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx - uy * 5, by + ux * 5); ctx.lineTo(bx + uy * 5, by - ux * 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}
// Minimapa como el de Exploradores: lo explorado en azul, escaleras, objetos vistos, equipo y enemigos a la vista
function drawMinimap() {
  const { w, h } = CFG.map, mob = document.body.classList.contains('touch-on');
  const c = mob ? 2 : 3, mw = w * c, mh = h * c, x0 = LOG.w - mw - 10, y0 = 10;
  ctx.save(); ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(8,16,40,.22)'; ctx.fillRect(x0 - 3, y0 - 3, mw + 6, mh + 6);
  const tiles = state.dungeon.tiles;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!state.seen[y]?.[x]) continue;
    const t = tiles[y][x];
    if (t === T.WALL) continue;
    ctx.fillStyle = t === T.WATER ? '#3a78c8' : t === T.LAVA ? '#c8602a' : '#4f7fe0';
    ctx.fillRect(x0 + x * c, y0 + y * c, c, c);
    if (t === T.STAIRS) { ctx.fillStyle = stairsSealed() ? '#e04848' : '#f8f8f8'; ctx.fillRect(x0 + x * c - 1, y0 + y * c - 1, c + 2, c + 2); }   // en el minimapa, roja si está sellada
  }
  const seeAll = ITEMS[state.player.held]?.see === 'all', seeItems = seeAll || ITEMS[state.player.held]?.see === 'items' || state.scanItems, seeFoes = seeAll || state.scanFoes;
  for (const it of state.groundItems) if (seeItems || state.seen[it.y]?.[it.x]) { ctx.fillStyle = it.shop ? '#e0b060' : '#f8d848'; ctx.fillRect(x0 + it.x * c, y0 + it.y * c, c, c); }
  const dot = (e, col) => { ctx.fillStyle = col; ctx.fillRect(x0 + e.x * c - 1, y0 + e.y * c - 1, c + 2, c + 2); };
  for (const e of state.enemies) if (seeFoes || isVisibleNow(e.x, e.y)) dot(e, '#e04848');
  for (const a of state.team) dot(a, '#58c870');
  ctx.fillStyle = '#f8f8f8'; ctx.fillRect(x0 + state.player.x * c - 2, y0 + state.player.y * c - 2, c + 4, c + 4);
  dot(state.player, '#f8d848');
  ctx.restore();
}
function drawWeather() {
  const w = state.weather; if (!w || w === 'none') return;
  const W = LOG.w, H = LOG.h, t = performance.now();
  if (w === 'rain') { ctx.strokeStyle = 'rgba(150,190,240,.5)'; ctx.lineWidth = 1; for (let i = 0; i < 60; i++) { const x = (i * 137 + t * 0.4) % W, y = (i * 71 + t * 0.9) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 10); ctx.stroke(); } }
  else if (w === 'hail') { ctx.fillStyle = 'rgba(200,235,255,.7)'; for (let i = 0; i < 45; i++) { const x = (i * 149 + t * 0.2) % W, y = (i * 83 + t * 0.5) % H; ctx.fillRect(x, y, 2, 2); } }
  else if (w === 'sand') { ctx.fillStyle = 'rgba(201,162,90,.16)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = 'rgba(180,140,70,.5)'; for (let i = 0; i < 50; i++) { const x = (i * 167 + t * 0.8) % W, y = (i * 53 + Math.sin(t / 300 + i) * 20) % H; ctx.fillRect(x, y, 3, 1); } }
  else if (w === 'fog') { ctx.fillStyle = 'rgba(184,192,204,.28)'; ctx.fillRect(0, 0, W, H); }
  else if (w === 'sun') { ctx.fillStyle = 'rgba(255,210,74,.1)'; ctx.fillRect(0, 0, W, H); }
}
// Vista de la mazmorra: cercana por defecto (~14 casillas de ancho, como en PMD); «amplia» muestra todo el mapa visible
const dungeonWide = () => { try { return localStorage.getItem('mm_dview') === 'wide'; } catch { return false; } };
const DUNGEON_ZOOM = () => dungeonWide() ? 1 : 1.75;
const UIS = () => document.body.classList.contains('touch-on') ? 1.4 : 1; // texto del canvas más grande con el mando (móvil)
// Menús estilo PMD: caja azul marino con marco blanco redondeado y línea interior (como los diálogos),
// título en su propia pestaña encima, cursor ▶ parpadeante y desplazamiento con ▲▼ si no cabe todo.
function pmdBox(x, y, w, h, r = 6) {
  ctx.fillStyle = '#10204a'; roundRect(x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 2; roundRect(x + 1, y + 1, w - 2, h - 2, r); ctx.stroke();
  ctx.strokeStyle = '#5070c0'; ctx.lineWidth = 1; roundRect(x + 4.5, y + 4.5, w - 9, h - 9, Math.max(2, r - 2)); ctx.stroke();
}
function drawMoveHints() {
  const p = state.player; if (!p) return;
  const s = UIS(), fs = Math.round(12 * s), rh = Math.round(20 * s), pad = Math.round(10 * s), font = DIALOG_FONT();
  const keys = ['A', 'B', 'X', 'Y'], w = Math.round(250 * s), h = rh * 4 + pad * 2, x = 12, y = LOG.h - h - 12;
  pmdBox(x, y, w, h);
  ctx.font = `${fs}px ${font}`; ctx.textBaseline = 'middle';
  p.moves.forEach((m, i) => {
    const d = MOVES[m.name], ty = y + pad + i * rh + rh / 2;
    ctx.fillStyle = '#f8d848'; ctx.fillText(keys[i], x + pad, ty);
    const im = typeIconImg(d.type), isz = Math.round(14 * s); if (im.complete) ctx.drawImage(im, x + pad + 16 * s, ty - isz / 2, isz, isz); else im.onload = () => scheduleRender();
    ctx.fillStyle = m.pp > 0 ? '#f8f8f8' : '#8d8599'; ctx.fillText(m.name, x + pad + 16 * s + isz + 5, ty, w - pad * 2 - 90 * s);
    ctx.textAlign = 'right'; ctx.fillStyle = '#9fb0d8'; ctx.fillText(`${m.pp}/${d.pp}`, x + w - pad, ty); ctx.textAlign = 'left';
  });
  ctx.textBaseline = 'alphabetic';
}
function renderMenu() {
  const m = state.menu; if (!m) return;
  const s = UIS(), fs = Math.round(13 * s), rh = Math.round(21 * s), font = DIALOG_FONT();
  ctx.font = `${fs}px ${font}`; ctx.textBaseline = 'middle';
  const title = m.title + (state.busy ? '  …' : '');
  const tabH = Math.round(24 * s), pad = Math.round(12 * s), cur = Math.round(18 * s);
  const w = Math.min(LOG.w - 24, Math.max(200, ...m.items.map((it, i) => ctx.measureText(it).width + pad * 2 + cur + (m.icons?.[i] ? 20 * s : 0))));
  const x = state.scene === 'hub' ? (LOG.w - w) / 2 : 12, y = 12;
  const maxRows = Math.max(3, Math.floor((LOG.h - y - tabH - 10 - pad * 2) / rh));
  const rows = Math.min(m.items.length, maxRows);
  const top = Math.min(Math.max(0, m.index - Math.floor(rows / 2)), m.items.length - rows);
  const h = rows * rh + pad * 2;
  // pestaña del título
  ctx.font = `${Math.round(12 * s)}px ${font}`;
  const tw = Math.min(w, ctx.measureText(title).width + pad * 2);
  pmdBox(x, y, tw, tabH + 6, 5);
  ctx.fillStyle = '#f8d848'; ctx.fillText(title, x + pad, y + tabH / 2 + 2, tw - pad * 2);
  // caja de opciones
  const by = y + tabH + 2;
  pmdBox(x, by, w, h);
  ctx.font = `${fs}px ${font}`;
  const blink = Math.floor(performance.now() / 350) % 2 === 0;
  for (let r = 0; r < rows; r++) {
    const i = top + r, ty = by + pad + r * rh + rh / 2;
    ctx.fillStyle = '#f8f8f8';
    let ic = m.icons?.[i]; const isz = Math.round(15 * s);
    const itemName = !ic && m.noItemIcons !== true ? itemInText(m.items[i]) : null;
    if (itemName && drawItemIcon(ctx, itemName, x + pad + cur, ty - isz / 2 - 1, isz + 2)) ic = true;
    else if (ic) { const im = typeIconImg(ic); if (im.complete) ctx.drawImage(im, x + pad + cur, ty - isz / 2, isz, isz); else im.onload = () => scheduleRender(); }
    ctx.fillText(m.items[i], x + pad + cur + (ic ? isz + 5 : 0), ty, w - pad * 2 - cur - (ic ? isz + 5 : 0));
    if (i === m.index && blink) { ctx.fillStyle = '#f8f8f8'; ctx.beginPath(); ctx.moveTo(x + pad, ty - 5 * s); ctx.lineTo(x + pad + 8 * s, ty); ctx.lineTo(x + pad, ty + 5 * s); ctx.fill(); }
  }
  // flechas de desplazamiento
  ctx.fillStyle = '#f8d848'; ctx.textAlign = 'center'; ctx.font = `${Math.round(10 * s)}px ${font}`;
  if (top > 0) ctx.fillText('▲', x + w - pad, by + pad);
  if (top + rows < m.items.length) ctx.fillText('▼', x + w - pad, by + h - pad);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  scheduleRender(); // para el parpadeo del cursor
}
function wrapText(text, maxW) { const words = text.split(' '), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
// Cuadro de diálogo estilo Equipo de Rescate: caja azul marino, marco claro redondeado, texto blanco que se escribe
// letra a letra, nombre del que habla en amarillo y flecha parpadeante al acabar. Fuente: la del manifest si existe.
const DIALOG_FONT = () => Sprites.fontName || 'monospace';
// Un único redibujado pendiente como mucho (evita que las animaciones encadenen fotogramas de más)
let renderQueued = false;
function scheduleRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); }
const NPC_PORTRAITS = ['chatot', 'diglett', 'kecleon', 'kangaskhan', 'gulpin', 'wobbuffet', 'pidgeot', 'chansey', 'mawile', 'murkrow'];
function renderDialog() {
  const d = state.dialog; if (!d) return;
  const page = d.pages[d.i], W = LOG.w, h = Math.round(114 * UIS()), x = 6, w = W - 12;   // como en el original: casi todo el ancho y ~¼ de la altura
  // Abajo, salvo que tape a quien habla: si alguien queda en la franja de abajo (y nadie arriba), el cuadro sube
  // y el retrato va debajo. Así se ve la escena (en la mazmorra la cámara te centra: siempre abajo).
  const focus = state.scene === 'hub' ? (state.dlgFocus || []) : [];
  // Dónde ocupa sitio el cuadro, y el retrato que va fuera de él, en cada colocación (abajo o arriba)
  const PFb = 92, hasPor = !!(page.portraits?.length || speakerSpecies(page));
  const regions = up => {
    const yy = up ? 6 : LOG.h - h - 6, regs = [{ l: x, r: x + w, t: yy, b: yy + h }];
    if (hasPor) { const px0 = page.side === 'right' ? x + w - 4 - PFb : x + 4, py0 = up ? yy + h + 4 : yy - PFb - 4; regs.push({ l: px0, r: px0 + PFb, t: py0, b: py0 + PFb }); }
    return regs;
  };
  const overlap = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const cost = up => focus.reduce((s, f) => s + regions(up).reduce((q, r) => q + overlap(f, r), 0), 0);
  // Se decide una vez por frase (para que no salte mientras lees): la colocación que no tapa a nadie; abajo si da igual
  if (d.placedFor !== d.i) {
    d.placedFor = d.i; const cb = cost(false), ct = cost(true); d.top = ct < cb;
    // En una escena, si ninguna colocación deja libre a quien habla (pantallas bajas), la cámara se mueve lo justo
    const spk = state.cut?.speaking, cam0 = state.dlgCam;
    if (spk && state.cut.cam && Math.min(cb, ct) > 0 && cam0) {
      const regs = regions(d.top), f = focus[0];
      const bandT = d.top ? Math.max(...regs.map(r => r.b)) + 4 : 4, bandB = d.top ? LOG.h - 4 : Math.min(...regs.map(r => r.t)) - 4;
      const need = ((f.t + f.b) / 2) - (bandT + bandB) / 2, mapH = HUB[state.hub.area]?.h || 515;
      state.cut.cam.y = Math.max(0, Math.min(Math.max(0, mapH - LOG.h), cam0.y + need));
    }
  }
  const top = d.top, y = top ? 6 : LOG.h - h - 6;
  if (d.pageStart !== d.i) { d.pageStart = d.i; d.t0 = performance.now(); }
  // caja
  ctx.fillStyle = '#10204a'; roundRect(x, y, w, h, 6); ctx.fill();
  ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 2; roundRect(x + 2, y + 2, w - 4, h - 4, 5); ctx.stroke();
  ctx.strokeStyle = '#5070c0'; ctx.lineWidth = 1; roundRect(x + 5, y + 5, w - 10, h - 10, 4); ctx.stroke();
  // retrato (a la izquierda, fuera del marco, como en PMD)
  let tx = x + 14;
  // retratos con emociones (atlas de PMDCollab): quién habla y con qué cara
  const prs = page.portraits?.length ? page.portraits.map(sp => [sp, page.mood || 'Normal']) : (() => { const sp = speakerSpecies(page); return sp ? [[sp, page.mood || inferMood(page)]] : []; })();
  const PS = 80, PF = PS + 12;   // retrato al doble de su tamaño (nítido) y marco
  prs.forEach(([sp, emo], i) => {
    const px0 = page.side === 'right' ? x + w - 4 - PF - i * (PF + 6) : x + 4 + i * (PF + 6), py0 = top ? y + h + 4 : y - PF - 4;   // retrato encima del cuadro (o debajo, si el cuadro está arriba); a la derecha para el segundo interlocutor
    ctx.fillStyle = '#10204a'; roundRect(px0, py0, PF, PF, 6); ctx.fill();
    ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 2; roundRect(px0 + 2, py0 + 2, PF - 4, PF - 4, 5); ctx.stroke();
    ctx.strokeStyle = '#5070c0'; ctx.lineWidth = 1; roundRect(px0 + 4.5, py0 + 4.5, PF - 9, PF - 9, 4); ctx.stroke();
    let drawn;
    if (page.side === 'right') { ctx.save(); ctx.translate(px0 + 6 + PS, py0 + 6); ctx.scale(-1, 1); drawn = drawPortrait(ctx, sp, emo, 0, 0, PS); ctx.restore(); }   // volteado: mira hacia dentro, como en el original
    else drawn = drawPortrait(ctx, sp, emo, px0 + 6, py0 + 6, PS);
    if (!drawn) {   // sin retrato: recuadro con la inicial
      const nm = page.who || SPECIES[sp]?.name || '?', h = [...nm].reduce((q, c) => (q * 31 + c.charCodeAt(0)) % 360, 7);
      ctx.fillStyle = `hsl(${h},45%,42%)`; ctx.fillRect(px0 + 6, py0 + 6, PS, PS);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(nm[0].toUpperCase(), px0 + PF / 2, py0 + PF / 2 + 1);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
  });
  // texto: nombre en amarillo, cuerpo en blanco, efecto máquina de escribir (30 ms por carácter, X lo completa)
  const font = page.font || DIALOG_FONT(), size = Math.round((Sprites.fontName && !page.font ? 15 : 17) * UIS());   // letra grande, como en el original
  ctx.font = `${size}px ${font}`; ctx.textBaseline = 'top';
  const shown = Math.min(page.text.length, Math.floor((performance.now() - d.t0) / 30));
  d.done = shown >= page.text.length;
  const body = page.who ? `${page.who}: ` : '';
  const lines = wrapText(body + page.text, w - 34);
  let count = 0, ly = y + 14;
  for (const ln of lines.slice(0, 4)) {
    let lx = tx;
    for (const word of ln.split(' ')) {
      const isName = page.who && count < page.who.length + 1;
      const visible = word.slice(0, Math.max(0, Math.min(word.length, shown + body.length - count)));
      ctx.fillStyle = isName ? '#f8d848' : (page.color || '#f8f8f8');
      ctx.fillText(visible, lx, ly); lx += ctx.measureText(word + ' ').width; count += word.length + 1;
    }
    ly += size + 6;
  }
  ctx.textBaseline = 'alphabetic';
  if (d.done) { const b = Math.abs(Math.sin(performance.now() / 180)) * 3; ctx.fillStyle = '#f8d848'; ctx.beginPath(); ctx.moveTo(x + w - 30, y + h - 22 + b); ctx.lineTo(x + w - 14, y + h - 22 + b); ctx.lineTo(x + w - 22, y + h - 12 + b); ctx.fill(); scheduleRender(); }   // indicador para continuar: siempre visible, dando saltitos
  scheduleRender();
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function renderHud() {
  const p = state.player, $ = id => document.getElementById(id);
  $('floor').textContent = state.scene === 'hub' ? (AREA_NAMES[state.hub.area] || 'Gremio') : `${state.dungeonDef.name} B${state.floor}F${state.dungeonDef.eras ? ` · eco de ${dungeonById(state.era).name}` : ''}${state.weather && state.weather !== 'none' ? ` · ${WEATHER[state.weather].name}` : ''}`;
  $('pokes').textContent = meta.pokes; $('pokes').parentElement.style.display = state.scene === 'hub' ? 'none' : ''; $('runPokes').textContent = state.scene === 'hub' ? meta.pokes : `${state.runPokes}${unpaidTotal() ? ` (debes ${unpaidTotal()})` : ''}`;
  $('rank').textContent = `${RANKS[rankOf(meta.rankPts)].name} (${meta.rankPts})`;
  if (!p) return;
  $('nameLv').textContent = `${p.name} (${SPECIES[p.species].name}) · Nv ${p.level}${p.status ? ' · ' + STATUS[p.status.kind].name : ''}${p.speed > 0 ? ' · Rápido' : p.speed < 0 ? ' · Lento' : ''}`;
  $('hpBar').style.width = `${p.hp / p.maxHp * 100}%`; $('hpText').textContent = `${p.hp} / ${p.maxHp}`;
  $('bellyBar').style.width = `${p.belly / p.maxBelly * 100}%`; $('bellyBar').parentElement.classList.toggle('hungry', p.belly <= 20); $('bellyText').textContent = `${p.belly} / ${p.maxBelly}`;
  $('exp').textContent = `${p.exp} / ${expToNext(p.species, p.level)}`;
  $('moves').innerHTML = [0, 1, 2, 3].map(i => {
    const key = ['L+A', 'L+B', 'L+X', 'L+Y'][i];
    const m = p.moves[i]; if (!m) return `<div class="move empty"><span>${key}</span><span>—</span><span></span></div>`;
    const d = MOVES[m.name];
    return `<div class="move usable" data-move="${i}" title="Usar (o ${key})"><span>${key}</span><span>${typeIconHTML(d.type)}${m.name}${m.permanent ? ' ★' : ''}<br><span class="type">${d.type} · ${d.power ? 'potencia ' + (d.pmdPower ?? Math.round(d.power / 5)) : 'estado'} · ${d.range === 'line' ? (d.dist >= 10 ? 'en línea' : 'hasta ' + d.dist + ' casillas') : d.range === 'room' ? 'toda la sala' : d.range === 'around' ? 'a tu alrededor' : 'de frente'}</span></span><span class="pp">${m.pp}/${d.pp}</span></div>`;
  }).join('');
  const bar = document.getElementById('movebar');
  if (bar) bar.innerHTML = state.scene === 'dungeon' ? p.moves.map((m, i) => `<button class="mb" data-move="${i}" ${m.pp <= 0 ? 'disabled' : ''}><b>${['A', 'B', 'X', 'Y'][i]}</b>${typeIconHTML(MOVES[m.name].type)}<span>${m.name}</span><i>${m.pp}/${MOVES[m.name].pp}</i></button>`).join('') : '';
  $('stats').innerHTML = `${SPECIES[p.species].types.join(' / ')}<br>Ataque ${p.atk} · Defensa ${p.def}<br>At. Esp. ${p.spa} · Def. Esp. ${p.spd}<br>Equipado: ${p.held || '—'}`;
  $('team').innerHTML = state.scene === 'dungeon' && state.team.length ? state.team.map(a => `<div>${a.name} Nv${a.level} · ${a.hp}/${a.maxHp}${a.status ? ' · ' + STATUS[a.status.kind].name : ''} · ${a.floors}/${CFG.bondFloors}${a.floors >= CFG.bondFloors ? ' ★' : ''}</div>`).join('') : '<span class="dim">En solitario</span>';
  const missions = state.scene === 'hub' ? meta.active : state.missions;
  $('missions').innerHTML = missions.length ? missions.map(m => `<div>${m.done ? '✓ ' : ''}${MISSION_TYPES[m.type || 'derrotar'].label} ${m.target ? SPECIES[m.target].name : ''} · B${m.floor}F ${dungeonById(m.dungeonId).name}</div>`).join('') : 'Ninguna';
  const bag = state.scene === 'hub' ? meta.bag : state.inventory;
  $('items').innerHTML = bag.length ? bag.map(n => `<div class="${ITEMS[n]?.kind === 'sell' ? 'sell' : ''}">${n}</div>`).join('') : '<div class="dim">Nada</div>';
}

// =====================================================================
// INPUT — estilo emulador: A=X, B=Z, X=S, Y=A, L=Q, R=W, Start=Enter, Select=Tab
// =====================================================================
const BTN = { z: 'A', x: 'B', s: 'X', a: 'Y', q: 'L', w: 'R', enter: 'START', tab: 'SELECT', arrowup: 'UP', arrowdown: 'DOWN', arrowleft: 'LEFT', arrowright: 'RIGHT' };
const ARROW_VEC = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };
const held = new Set();
const heldArrowVector = () => { let dx = 0, dy = 0; for (const a of ['UP', 'DOWN', 'LEFT', 'RIGHT']) if (held.has(a)) { dx += ARROW_VEC[a][0]; dy += ARROW_VEC[a][1]; } return [dx, dy]; };
let bound = false;
function bindInput() {
  if (bound) return; bound = true;
  document.addEventListener('click', ev => { const el = ev.target.closest?.('[data-move]'); if (el) { ev.preventDefault(); useMoveSlot(+el.dataset.move); } });
  // un clic (o toque) sobre la pantalla del juego con un diálogo abierto equivale a pulsar A
  document.getElementById('game')?.addEventListener('click', () => { if (state.dialog) dialogAdvance(); });
  // tocar la mazmorra para moverse (con el dedo; con ratón también funciona)
  document.getElementById('game')?.addEventListener('pointerdown', ev => {
    if (state.scene !== 'dungeon' || state.dialog || state.menu || state.busy || state.resolving || state.dead || !state.player) return;
    const t = tileAtScreen(ev.clientX, ev.clientY); if (t) { ev.preventDefault(); tapTo(t); }
  });
  window.addEventListener('keyup', ev => { const b = BTN[ev.key.toLowerCase()]; held.delete(b); if (b === 'A' || b === 'B') stopPassing(); if (b === 'L' || b === 'Y') render(); });
  window.addEventListener('keydown', ev => {
    if (ev.key.toLowerCase() === 'm' && state.scene === 'dungeon' && ev.target?.tagName !== 'INPUT' && !state.menu) { state.showMap = state.showMap === false; render(); return; }
    if (ev.key.toLowerCase() === 'm' && state.scene === 'hub' && ev.target?.tagName !== 'INPUT') { state.showMask = !state.showMask; say(state.showMask ? 'Vista de colisiones: ACTIVADA (M para quitarla)' : 'Vista de colisiones: desactivada'); render(); return; }
    if (['INPUT', 'SELECT'].includes(ev.target.tagName) || ev.target.closest?.('.settings-panel')) return; // teclas del menú de opciones: no mueven al personaje
    const btn = BTN[ev.key.toLowerCase()]; if (!btn) return;
    ev.preventDefault(); if (ev.repeat && !ARROW_VEC[btn]) return;
    held.add(btn);
    if (state.historyOpen) { historyKey(btn); return; }
    if (state.textOpen) return;   // escribiendo un mote
    if (state.busy || state.resolving) return;
    // Start termina el tutorial en cualquier momento (también con un diálogo abierto)
    if (state.tour && btn === 'START') { state.tour.skip = true; const d = state.dialog; state.dialog = null; d?.onDone?.(); render(); return; }
    if (state.cut && btn === 'START') { skipScene(); render(); return; }
    if (state.cut && btn === 'A' && sceneTap()) { render(); return; }   // cerrar el cartel de la escena
    if (state.dialog) { if (btn === 'A' || btn === 'START') dialogAdvance(); render(); return; }
    if (state.cut || state.dcut) return;   // durante una escena, solo se puede saltar (Start) o pasar el diálogo
    if (state.menu) {
      const m = state.menu;
      if (btn === 'UP') { m.index = (m.index - 1 + m.items.length) % m.items.length; playSfx('cursor'); }
      else if (btn === 'DOWN') { m.index = (m.index + 1) % m.items.length; playSfx('cursor'); }
      else if (btn === 'A') { const i = m.index; playSfx('confirm'); state.menu = null; m.onSelect?.(i); }
      else if (btn === 'B' || btn === 'X' || btn === 'SELECT') { if (m.sticky) return; playSfx('cancel'); state.menu = null; m.onCancel?.(); }
      render(); return;
    }
    if (state.scene === 'hub' && state.hub.inBed && ['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(btn)) getUpFromBed();   // al primer paso te incorporas
    if (state.scene === 'hub') { if (state.tour) return; if (btn === 'A') hubInteract(); else if (btn === 'X' || btn === 'SELECT' || btn === 'START') openHubMenu(); return; }   // en el tutorial solo se avanzan diálogos
    if (state.dead) return;
    if (ARROW_VEC[btn]) {
      if (running) return;
      if (held.has('Y')) { const [dx, dy] = heldArrowVector(); if (dx || dy) playerAction('face', dx, dy); return; }
      if (held.has('R')) { const [dx, dy] = heldArrowVector(); if (dx && dy) playerAction('move', dx, dy); return; }
      // se espera un instante por si llega otra flecha: dos direcciones a la vez = diagonal (como en la cruceta de la DS)
      if (pendingMove) return;
      pendingMove = setTimeout(() => {
        pendingMove = null;
        const [dx, dy] = heldArrowVector();
        const v = dx || dy ? [dx, dy] : ARROW_VEC[btn];
        if (state.menu || state.dialog || state.busy || state.resolving || state.dead) return;
        if (held.has('B')) runFrom(v); else playerAction('move', ...v);   // B + dirección = correr
      }, 55);
    }
    else if (held.has('L') && ['A', 'B', 'X', 'Y'].includes(btn)) playerAction('skill', 0, 0, ['A', 'B', 'X', 'Y'].indexOf(btn));
    else if ((btn === 'A' && held.has('B')) || (btn === 'B' && held.has('A'))) { clearTimeout(pendingAttack); pendingAttack = null; startPassing(); }
    else if (btn === 'A') {
      // se espera un instante por si llega B (A+B = pasar turno, como en PMD); si no llega, se ataca
      clearTimeout(pendingAttack);
      pendingAttack = setTimeout(() => { pendingAttack = null; if (!held.has('B') && !state.menu && !state.dialog && !state.busy && !state.resolving && !state.dead) playerAction('attack'); }, 90);
    }
    else if (btn === 'L' || btn === 'Y') render(); // chuleta de movimientos / flechas de giro
    else if (btn === 'X' || btn === 'SELECT' || btn === 'START') openDungeonMainMenu();
  });
}

// ---- selector de tamaño de pantalla ----
function setupMusicControl() {
  const r = document.getElementById('music-vol'); if (!r || r.dataset.ready) return; r.dataset.ready = '1';
  const out = document.getElementById('music-val');
  const show = () => { r.style.setProperty('--fill', r.value + '%'); out.textContent = +r.value === 0 ? 'Silencio' : r.value + ' %'; };
  r.value = Math.round(getVolume() * 100); show();
  r.addEventListener('input', () => { setVolume(r.value / 100); show(); });
  r.addEventListener('change', () => r.blur());
  const fx = document.getElementById('sfx-vol'), fxOut = document.getElementById('sfx-val');
  if (fx) { const showFx = () => { fx.style.setProperty('--fill', fx.value + '%'); fxOut.textContent = +fx.value === 0 ? 'Silencio' : fx.value + ' %'; };
    fx.value = Math.round(getSfxVolume() * 100); showFx();
    fx.addEventListener('input', () => { setSfxVolume(fx.value / 100); showFx(); });
    fx.addEventListener('change', () => { fx.blur(); playSfx('confirm'); }); }
  preloadMusic();
  // menú de opciones (hamburguesa): se abre y cierra con el botón, al pulsar fuera o con Escape
  const btn = document.getElementById('settings-btn'), panel = document.getElementById('settings-panel');
  const setOpen = open => { panel.classList.toggle('hidden', !open); btn.setAttribute('aria-expanded', String(open)); if (open) { const t = document.getElementById('opt-touch'); t.checked = document.body.classList.contains('touch-on'); } };
  btn.addEventListener('click', ev => { ev.stopPropagation(); setOpen(panel.classList.contains('hidden')); btn.blur(); });
  document.addEventListener('click', ev => { if (!panel.classList.contains('hidden') && !ev.target.closest('.settings')) setOpen(false); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !panel.classList.contains('hidden')) setOpen(false); });
  document.getElementById('opt-touch').addEventListener('change', ev => { setTouchVisible(ev.target.checked); ev.target.blur(); });
  // telemetría de la beta: activada por defecto, se puede desactivar
  const ot = document.getElementById('opt-telemetry'); if (ot) { ot.checked = telemetryOn(); ot.addEventListener('change', ev => { setTelemetry(ev.target.checked); ev.target.blur(); }); }   // mostrar u ocultar el mando en pantalla
  document.getElementById('scale').addEventListener('change', ev => ev.target.blur());
  document.getElementById('set-version').textContent = VERSION_LABEL;
  const dv = document.getElementById('opt-dview');
  if (dv) { dv.value = dungeonWide() ? 'wide' : 'near'; dv.addEventListener('change', () => { try { localStorage.setItem('mm_dview', dv.value); } catch {} dv.blur(); render(); }); }
  const lg = document.getElementById('opt-log');
  if (lg) {
    lg.value = logInside() ? 'inside' : 'outside'; document.body.classList.toggle('log-inside', logInside());
    lg.addEventListener('change', () => { try { localStorage.setItem('mm_log', lg.value); } catch {} document.body.classList.toggle('log-inside', lg.value === 'inside'); lg.blur(); render(); });
  }
}
function setupScaleSelector() {
  setupMusicControl();
  const sel = document.getElementById('scale'); if (!sel || sel.dataset.ready) return; sel.dataset.ready = '1';
  sel.innerHTML = Object.entries(SCALES).map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  sel.value = getScalePref();
  sel.addEventListener('change', () => { try { localStorage.setItem('mm_scale', sel.value); } catch {} applyScale(); sel.blur(); });
  new MutationObserver(() => applyScale()).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

// ---- correr (B + dirección): en línea recta hasta chocar o hasta que pase algo, como en Exploradores ----
let pendingMove = null, running = false;
async function runFrom([dx, dy]) {
  if (running) return; running = true;
  const p = state.player, seen0 = new Set(state.enemies.filter(e => isVisibleNow(e.x, e.y)));
  const inRoom = () => !!roomOf(p);
  const openAt = (x, y) => { const t = state.dungeon.tiles[y]?.[x]; return t !== undefined && t !== T.WALL; };
  try {
    for (let step = 0; step < 60; step++) {
      if (state.menu || state.dialog || state.busy || state.dead || state.scene !== 'dungeon') break;
      const x0 = p.x, y0 = p.y, hp0 = p.hp, room0 = inRoom(), floor0 = state.floor, items0 = state.groundItems.length, inv0 = state.inventory.length;
      playerAction('move', dx, dy); await state.turnP;
      if (p.x === x0 && p.y === y0) break;                                   // se ha chocado
      if (state.floor !== floor0 || state.menu || state.dialog) break;
      if (p.hp < hp0) break;                                                  // le han hecho daño
      if (itemUnder(p) || state.groundItems.length !== items0 || state.inventory.length !== inv0 || state.dungeon.tiles[p.y][p.x] === T.STAIRS) break; // objeto (recogido o no) o escaleras
      if (inRoom() !== room0) break;                                          // entra o sale de una sala
      if (state.enemies.some(e => isVisibleNow(e.x, e.y) && !seen0.has(e))) break; // aparece un enemigo
      if (state.enemies.some(e => Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) <= 1)) break; // enemigo al lado
      const back = [p.x - dx, p.y - dy], ahead = [p.x + dx, p.y + dy];
      const others = DIRS8.map(([ax, ay]) => [p.x + ax, p.y + ay]).filter(([x, y]) => !(x === back[0] && y === back[1]) && !(x === ahead[0] && y === ahead[1]));
      const isCorr = (x, y) => openAt(x, y) && !state.dungeon.rooms.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
      if (inRoom() && others.some(([x, y]) => (x === p.x || y === p.y) && isCorr(x, y))) break;   // en una sala: la boca de un pasillo justo al lado (vertical u horizontal, no en diagonal)
      if (!inRoom() && others.filter(([x, y]) => (x === p.x || y === p.y) && openAt(x, y)).length) break;   // en un pasillo: una bifurcación a un lado
      if (state.groundItems.some(g => Math.max(Math.abs(g.x - p.x), Math.abs(g.y - p.y)) <= 1)) break;   // un objeto al lado
      if (!openAt(p.x + dx, p.y + dy)) break;                                 // lo siguiente es pared
      await sleep(Math.max(45, STEP_MS() * 0.8));   // corriendo, un paso detrás de otro (deslizándose)
    }
  } finally { running = false; render(); }
}

// ---- tocar la pantalla para moverse (como en la DS) ----
// Casilla vecina: un paso (o atacar si hay un enemigo). Más lejos: caminar hasta ella por casillas ya vistas,
// parando si aparece un enemigo, si alguno se pone al lado, si te dañan o al pisar un objeto o la escalera.
let tapWalk = 0;
function tileAtScreen(clientX, clientY) {
  const cv = document.getElementById('game'), c = lastCam; if (!cv || !c) return null;
  const r = cv.getBoundingClientRect(), sx = (clientX - r.left) / r.width * LOG.w, sy = (clientY - r.top) / r.height * LOG.h;
  const wx = (sx - LOG.w / 2) / c.zoom + c.pcx + c.camX, wy = (sy - LOG.h / 2) / c.zoom + c.pcy + c.camY;
  return { x: c.ox + Math.floor(wx / CFG.tile), y: c.oy + Math.floor(wy / CFG.tile) };
}
async function tapTo(t) {
  const p = state.player, id = ++tapWalk;
  const dx = t.x - p.x, dy = t.y - p.y; if (!dx && !dy) return;
  if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) {   // vecina: paso o ataque
    const foe = state.enemies.find(e => e.x === t.x && e.y === t.y && e.hp > 0);
    if (foe) { p.facing = [dx, dy]; playerAction('attack'); } else playerAction('move', dx, dy);
    return;
  }
  if (!state.seen[t.y]?.[t.x] || state.dungeon.tiles[t.y]?.[t.x] === T.WALL) return;
  const seen0 = new Set(foesInView());
  for (let guard = 0; guard < 80 && id === tapWalk; guard++) {
    if (state.menu || state.dialog || state.busy || state.dead || state.scene !== 'dungeon') return;
    if (p.x === t.x && p.y === t.y) return;
    const path = dungeonPath(p, t); if (!path?.length) return;
    const hp0 = p.hp, step = path[0];
    playerAction('move', step.x - p.x, step.y - p.y); await state.turnP;
    if (p.x !== step.x || p.y !== step.y || p.hp < hp0) return;                                   // bloqueado o te han dañado
    if (foesInView().some(e => !seen0.has(e)) || state.enemies.some(e => e.hp > 0 && cheb(e, p) <= 1)) return;   // enemigo nuevo o al lado
    if (itemUnder(p) || state.dungeon.tiles[p.y][p.x] === T.STAIRS) return;
    await sleep(Math.max(45, STEP_MS() * 0.8));
  }
}

// ---- pasar turno: A+B; mantenerlos repite ----
let pendingAttack = null, passTimer = null;
// avanzar un diálogo del juego (Z/A, Start o un clic sobre la pantalla): completa el texto o pasa a la siguiente página
function dialogAdvance() {
  const d = state.dialog; if (!d) return;
  if (!d.done) d.t0 = -1e9;
  else if (++d.i >= d.pages.length) { state.dialog = null; state.feed = []; d.onDone?.(); }   // lo que ya has leído no se repite en el recuadro de mensajes
  else state.tutorialFocus = d.pages[d.i].focus || null;
  render();
}
const canPass = () => state.scene === 'dungeon' && !state.menu && !state.dialog && !state.busy && !state.resolving && !state.dead;
const foesInView = () => state.enemies.filter(e => e.hp > 0 && isVisibleNow(e.x, e.y));
function startPassing() {
  if (!canPass()) return;
  const seen0 = new Set(foesInView()), hp0 = state.player.hp;
  endTurn(false); say(`${state.player.name} espera un turno.`);
  clearTimeout(passTimer);
  const tick = async () => {
    await state.turnP;
    if (!(held.has('A') && held.has('B') && canPass())) return stopPassing();
    const hp = state.player.hp; await endTurn(false);
    // se detiene solo si aparece un enemigo nuevo, te hacen daño o salta un aviso
    if (foesInView().some(e => !seen0.has(e)) || state.player.hp < hp || state.dialog || state.menu) return stopPassing();
    passTimer = setTimeout(tick, foesInView().length ? 200 : 70);   // sin nadie a la vista, unas tres veces más rápido
  };
  passTimer = setTimeout(tick, 220);
}
function stopPassing() { clearTimeout(passTimer); passTimer = null; }
// usar un movimiento desde la interfaz (clic o toque en la lista)
function useMoveSlot(i) {
  if (state.scene !== 'dungeon' || !state.player?.moves[i] || state.menu || state.dialog || state.busy || state.resolving || state.dead) return;
  playerAction('skill', 0, 0, i);
}

// exposición para pruebas automatizadas
export const __enemyTurn = e => enemyTurn(e), __hubInteract = () => hubInteract(), __state = state, __defeatEnemy = defeatEnemy, __descend = descend, __useMove = useMove, __endTurn = endTurn, __getMeta = () => meta, __openDungeons = openDungeonMenu, __endRun = endRun;
