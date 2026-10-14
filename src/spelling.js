import Phaser from 'phaser';
// The parent's spelling list, shared by every player. When it has words,
// Dragon Care and Word Catcher practise only these.
import { load, save } from './storage.js';

export const MAX_WORD = 12;

/**
 * Pull words out of whatever was pasted: one per line, commas, numbered
 * lists ("1. apple"), tabs. Letters and apostrophes only, upper-cased,
 * duplicates removed.
 */
export function parseWords(text) {
  const words = text
    .replace(/[’‘]/g, "'")
    .toUpperCase()
    .split(/[^\p{L}']+/u)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length >= 2 && w.length <= MAX_WORD);
  return [...new Set(words)];
}

export const getSpellingWords = () => load('spelling', []);
export const saveSpellingWords = (words) => save('spelling', words);

/** n words from the list, shuffled, repeating the list if it is short. */
export function pickSpellingWords(n, filter = () => true) {
  const list = getSpellingWords().filter(filter);
  if (list.length === 0) return [];
  const out = [];
  while (out.length < n) out.push(...Phaser.Utils.Array.Shuffle([...list]));
  return out.slice(0, n);
}
