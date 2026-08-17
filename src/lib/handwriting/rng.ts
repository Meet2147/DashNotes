/**
 * Deterministic pseudo-randomness.
 *
 * Every wobble the renderer adds — baseline jitter, rotation, sample choice —
 * comes from here, seeded from the document. That means the same text plus the
 * same settings always produces a byte-identical page, so the preview the user
 * approves is exactly what gets exported.
 */

/** mulberry32 — small, fast, good enough distribution for visual jitter. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, so a string can seed the generator. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Uniform value in [-spread, spread]. */
export function jitter(rng: () => number, spread: number): number {
  return (rng() * 2 - 1) * spread;
}

/**
 * Sum of three uniforms — clusters near zero like real hand tremor does,
 * instead of the flat distribution a single uniform gives.
 */
export function jitterSoft(rng: () => number, spread: number): number {
  const sum = rng() + rng() + rng();
  return ((sum / 1.5) - 1) * spread;
}

/** Pick an element, biased towards nothing in particular. */
export function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}
