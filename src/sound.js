// Synthesized sound effects (no audio files) and spoken prompts via the
// browser's speech synthesis, which helps kids who are still learning to read.
import { load, save } from './storage.js';

let ctx = null;
let muted = load('muted', false);

function tone(freq, dur, { type = 'sine', when = 0, vol = 0.18, slideTo = null } = {}) {
  if (muted) return;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
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

export function speak(text) {
  if (muted || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 1.15;
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
