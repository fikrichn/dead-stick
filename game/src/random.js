// A tiny seeded random source (mulberry32): the same seed always deals the
// same crisis, so a screenshot run and a player's retry see the same world.

export function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Random integer in [min, max], both ends included. */
export function intRange(random, min, max) {
  return Math.floor(range(random, min, max + 1));
}

/** A shuffled copy of the list, so the crisis order is dealt, not fixed. */
export function shuffled(random, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
