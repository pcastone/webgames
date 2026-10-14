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

// Players: { id, name, icon }. The current player lives in memory only, so
// the opening screen always asks who is playing.
export const MAX_PLAYERS = 9;
let current = null;

export const getPlayers = () => load('players', []);
export const getCurrentPlayer = () => current;
export const setCurrentPlayer = (player) => (current = player);

export function addPlayer(name, icon) {
  const player = { id: Date.now().toString(36), name, icon };
  save('players', [...getPlayers(), player]);
  return player;
}

export function updatePlayer(id, changes) {
  const players = getPlayers().map((p) => (p.id === id ? { ...p, ...changes } : p));
  save('players', players);
  if (current?.id === id) current = { ...current, ...changes };
  return players.find((p) => p.id === id);
}

/** Per-player data for the current player (e.g. how much their dragon ate). */
export const loadPlayerData = (key, fallback) => load(`${key}.${current?.id ?? 'guest'}`, fallback);
export const savePlayerData = (key, value) => save(`${key}.${current?.id ?? 'guest'}`, value);

const bestKey = (game) => `best.${current?.id ?? 'guest'}.${game}`;

export const getBest = (game) => load(bestKey(game), 0);

/** Records stars if they beat the current player's best; returns the best. */
export function recordBest(game, stars) {
  const best = Math.max(getBest(game), stars);
  save(bestKey(game), best);
  return best;
}
