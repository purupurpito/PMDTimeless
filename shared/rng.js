// PRNG con semilla (mulberry32). Misma semilla → misma secuencia en cliente y servidor.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  return {
    random,
    int: (lo, hi) => lo + Math.floor(random() * (hi - lo + 1)),
    pick: arr => arr[Math.floor(random() * arr.length)],
    chance: p => random() < p,
  };
}
// Semilla derivada por piso: la mazmorra del piso N depende sólo de (semilla de run, N)
export const floorSeed = (runSeed, floor) => (Math.imul(runSeed ^ 0x9E3779B9, 0x85EBCA6B) + Math.imul(floor, 0xC2B2AE35)) >>> 0;
