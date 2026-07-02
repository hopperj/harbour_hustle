export function normalizeSeed(seed: number): number {
  return seed >>> 0;
}

export function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

export function randomFloat(seed: number): [number, number] {
  const next = nextSeed(seed);
  return [next, next / 0x100000000];
}

export function randomInt(seed: number, min: number, maxExclusive: number): [number, number] {
  if (maxExclusive <= min) {
    return [seed, min];
  }
  const [next, value] = randomFloat(seed);
  return [next, Math.floor(value * (maxExclusive - min)) + min];
}

export function randomPrice(seed: number, min: number, maxExclusive: number): [number, number] {
  return randomInt(seed, min, maxExclusive);
}
