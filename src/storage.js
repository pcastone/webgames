// Per-browser best scores. Storage can be unavailable (private mode), so
// every access is guarded and the game works without it.
const PREFIX = 'kidgames.';

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const getBest = (game) => load(`best.${game}`, 0);

/** Records stars if they beat the previous best; returns the best. */
export function recordBest(game, stars) {
  const best = Math.max(getBest(game), stars);
  save(`best.${game}`, best);
  return best;
}
