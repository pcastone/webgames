// Synthesized sound effects (no audio files) and spoken prompts via the
// browser's speech synthesis, which helps kids who are still learning to read.
import { load, save } from './storage.js';

let ctx = null;
let muted = load('muted', false);

function audio() {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', when = 0, vol = 0.18, slideTo = null } = {}) {
  if (muted) return;
  try {
    audio();
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch {
    /* audio unavailable */
  }
}

export const sfx = {
  click: () => tone(660, 0.08, { type: 'triangle' }),
  flip: () => tone(520, 0.06, { type: 'triangle', slideTo: 780 }),
  pop: () => tone(900, 0.12, { type: 'triangle', slideTo: 200, vol: 0.25 }),
  ding: () => tone(1046, 0.15, { type: 'sine', vol: 0.2 }),
  wrong: () => tone(260, 0.25, { type: 'square', slideTo: 180, vol: 0.06 }),
  correct: () => {
    tone(523, 0.12);
    tone(659, 0.12, { when: 0.1 });
    tone(784, 0.22, { when: 0.2 });
  },
  launch: () => tone(300, 0.3, { type: 'triangle', slideTo: 1000, vol: 0.12 }),
  boom: () => tone(140, 0.45, { type: 'sawtooth', slideTo: 35, vol: 0.2 }),
  win: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.18, { when: i * 0.12 })),
};

/** Filtered white noise burst (tyre screech, whoosh). */
function noise(dur, { freq = 2500, q = 6, vol = 0.25, slideTo = null } = {}) {
  if (muted) return;
  try {
    const c = audio();
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = q;
    const t = c.currentTime;
    filter.frequency.setValueAtTime(freq, t);
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t);
  } catch {
    /* audio unavailable */
  }
}

Object.assign(sfx, {
  brake: () => {
    noise(0.45, { freq: 3200, q: 9, vol: 0.3, slideTo: 1800 });
    tone(1500, 0.35, { type: 'sawtooth', slideTo: 900, vol: 0.03 });
  },
  rev: () => {
    tone(110, 0.18, { type: 'sawtooth', slideTo: 420, vol: 0.12 });
    tone(420, 0.35, { type: 'sawtooth', when: 0.18, slideTo: 160, vol: 0.1 });
  },
  hop: () => tone(380, 0.14, { type: 'triangle', slideTo: 900, vol: 0.14 }),
  honk: () => {
    tone(392, 0.18, { type: 'square', vol: 0.07 });
    tone(330, 0.3, { type: 'square', when: 0.2, vol: 0.07 });
  },
  splat: () => noise(0.25, { freq: 400, q: 1, vol: 0.4, slideTo: 120 }),
  splash: () => {
    noise(0.6, { freq: 1200, q: 0.8, vol: 0.35, slideTo: 300 });
    tone(700, 0.3, { type: 'sine', slideTo: 200, vol: 0.08 });
  },
  chomp: () => {
    tone(160, 0.08, { type: 'square', vol: 0.12 });
    tone(120, 0.1, { type: 'square', when: 0.12, vol: 0.12 });
  },
  horn: () => {
    for (const f of [311, 392, 466]) tone(f, 0.9, { type: 'sawtooth', vol: 0.035 });
  },
  boing: () => tone(200, 0.5, { type: 'sine', slideTo: 900, vol: 0.12 }),
  beep: (high = false) => tone(high ? 880 : 440, high ? 0.5 : 0.25, { type: 'square', vol: 0.08 }),
});

/**
 * Continuous engine hum; set(0..1) moves pitch and loudness with speed.
 * Always stop() it when the scene ends.
 */
export function engine() {
  if (muted) return { set() {}, stop() {} };
  try {
    const c = audio();
    const t = c.currentTime;
    const a = c.createOscillator();
    const b = c.createOscillator();
    a.type = b.type = 'sawtooth';
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.035, t + 0.5);
    a.connect(filter);
    b.connect(filter);
    filter.connect(gain).connect(c.destination);
    a.start();
    b.start();
    const set = (v) => {
      const now = c.currentTime;
      a.frequency.setTargetAtTime(55 + v * 140, now, 0.15);
      b.frequency.setTargetAtTime(56.5 + v * 143, now, 0.15);
      filter.frequency.setTargetAtTime(500 + v * 1400, now, 0.15);
      gain.gain.setTargetAtTime(0.03 + v * 0.03, now, 0.2);
    };
    set(0);
    let stopped = false;
    return {
      set: (v) => !stopped && set(v),
      stop() {
        if (stopped) return;
        stopped = true;
        const now = c.currentTime;
        gain.gain.setTargetAtTime(0.0001, now, 0.1);
        a.stop(now + 0.5);
        b.stop(now + 0.5);
      },
    };
  } catch {
    return { set() {}, stop() {} };
  }
}

// Novelty and low-quality voices that ship with some systems.
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|pipe organ|espeak|compact/i;

/** Higher is more natural-sounding. */
function voiceScore(v) {
  let s = 0;
  if (/^en[-_]US/i.test(v.lang)) s += 30;
  else if (/^en/i.test(v.lang)) s += 20;
  else return -1;
  if (NOVELTY.test(v.name)) return -1;
  if (/natural|neural/i.test(v.name)) s += 50; // Edge / Windows online voices
  if (/premium|enhanced|siri/i.test(v.name)) s += 45; // Apple downloaded voices
  if (/google/i.test(v.name)) s += 35; // Chrome's cloud voices
  if (/samantha|ava|allison|susan|zoe|karen|moira|serena|aria|jenny|guy/i.test(v.name)) s += 15;
  if (v.default) s += 5;
  return s;
}

let voice = null;
function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  voice = voices.reduce((best, v) => (voiceScore(v) > (best ? voiceScore(best) : -1) ? v : best), null);
}
if ('speechSynthesis' in window) {
  pickVoice();
  // Many browsers load the voice list after startup.
  window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function speak(text) {
  if (muted || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-US';
    u.rate = 0.75; // slower than normal speech so young spellers can catch every sound
    u.pitch = 1; // pitching up makes voices sound more synthetic
    window.speechSynthesis.speak(u);
  } catch {
    /* speech unavailable */
  }
}

export const isMuted = () => muted;

export function toggleMute() {
  muted = !muted;
  save('muted', muted);
  if (muted && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  return muted;
}
