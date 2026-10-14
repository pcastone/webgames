import Phaser from 'phaser';
import { W, H, FONT, COLORS } from '../theme.js';
import { homeButton, showResult } from '../ui.js';
import { sfx, engine } from '../sound.js';
import { getCurrentPlayer, loadPlayerData, savePlayerData } from '../storage.js';
import { getRaceSentences } from '../spelling.js';

const SENTENCES = [
  'The red car is fast.',
  'I can see the big race.',
  'We go up and down the hill.',
  'My dog likes to run with me.',
  'The sun is hot today.',
  'Look at the blue truck go.',
  'I have a cat and a fish.',
  'Mom and Dad came to the race.',
  'The bird sat in the tree.',
  'We like to play in the park.',
  'Can you jump over the box?',
  'The cars zoom past the crowd.',
  'My friend has a green bike.',
  'It is fun to go fast.',
  'The flag is black and white.',
  'I will win the next race.',
];
const PER_RACE = 2;

const TRACK_TOP = 150;
const LANE_H = 76;
const START_X = 150; // nose of the cars at the start line
const FINISH_X = 1150;
const CAR_NOSE = 62; // car texture centre to nose
const MAX_KMH = 120;
const KMH_PER_CPS = 60; // 1 correct letter a second = 60 km/h
const SPEED_WINDOW = 2.5; // seconds of typing that set the speedometer
const RIVALS = [
  { tint: 0x3a86ff, num: '2', pace: 0.75 },
  { tint: 0x2ec4b6, num: '3', pace: 0.95 },
  { tint: 0xffca3a, num: '4', pace: 1.15 },
];
const GAUGE = { x: 150, y: 612, r: 100 };

const ordinal = (n) => ['1st', '2nd', '3rd', '4th'][n - 1];
const laneY = (i) => TRACK_TOP + LANE_H * (i + 0.5);
const carX = (p) => START_X - CAR_NOSE + p * (FINISH_X - START_X);
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

/**
 * Grand Prix: type the sentence to drive. Correct letters move the car, a
 * wrong letter blocks it until backspaced (with a tyre screech), Space revs
 * the engine, and typing speed drives the speedometer. Three computer cars
 * race at paces set from this player's past races.
 */
export default class RaceScene extends Phaser.Scene {
  constructor() {
    super('Race');
  }

  create() {
    this.stats = loadPlayerData('race', { cps: 0 });
    const custom = getRaceSentences();
    const pool = custom.length ? custom : SENTENCES;
    this.sentences = Phaser.Utils.Array.Shuffle([...pool]).slice(0, Math.min(PER_RACE, pool.length));
    this.total = this.sentences.reduce((n, s) => n + s.length, 0);

    this.sentenceIndex = 0;
    this.doneChars = 0; // letters in finished sentences
    this.best = 0; // furthest correct letter in this sentence
    this.ok = 0;
    this.prevLen = 0;
    this.hits = []; // timestamps of correct letters, for speed
    this.kmh = 0;
    this.topKmh = 0;
    this.mistakes = 0;
    this.started = false;
    this.done = false;
    this.lastKeyAt = 0;

    this.drawTrack();
    this.makeCars();
    this.makeGauge();
    this.makePanel();
    this.makeHud();
    homeButton(this);

    this.motor = engine();
    this.events.once('shutdown', () => this.motor.stop());

    this.showSentence();
    this.countdown();
  }

  // ---- Scenery ------------------------------------------------------------

  drawTrack() {
    const g = this.add.graphics();
    g.fillStyle(0x5aa64a, 1).fillRect(0, 0, W, H);
    // Stands and crowd.
    g.fillStyle(0x8d99ae, 1).fillRect(0, 66, W, 70);
    const colors = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93, 0xffffff, 0xff924c];
    for (let x = 12; x < W; x += 18) {
      for (const y of [84, 104, 124]) g.fillStyle(Phaser.Utils.Array.GetRandom(colors), 1).fillCircle(x + (y % 20), y, 7);
    }
    // Asphalt, curbs, lanes.
    const bottom = TRACK_TOP + LANE_H * 4;
    g.fillStyle(0x4a4e57, 1).fillRect(0, TRACK_TOP - 6, W, bottom - TRACK_TOP + 12);
    for (let x = 0; x < W; x += 40) {
      g.fillStyle((x / 40) % 2 ? 0xffffff : 0xe63946, 1);
      g.fillRect(x, TRACK_TOP - 14, 40, 8).fillRect(x, bottom + 6, 40, 8);
    }
    g.fillStyle(0xffffff, 0.7);
    for (let i = 1; i < 4; i++) for (let x = 0; x < W; x += 80) g.fillRect(x, TRACK_TOP + i * LANE_H - 2, 44, 4);
    g.fillStyle(0xffffff, 1).fillRect(START_X - 4, TRACK_TOP - 6, 8, bottom - TRACK_TOP + 12);
    for (let row = 0; row * 12 < bottom - TRACK_TOP + 12; row++) {
      for (let col = 0; col < 3; col++) {
        g.fillStyle((row + col) % 2 ? 0x111111 : 0xffffff, 1).fillRect(FINISH_X + col * 12, TRACK_TOP - 6 + row * 12, 12, 12);
      }
    }
    this.add.text(FINISH_X + 18, TRACK_TOP - 40, '🏁', { fontSize: '40px' }).setOrigin(0.5);
    // Bottom dashboard band.
    g.fillStyle(0x2b2d42, 1).fillRect(0, bottom + 14, W, H - bottom - 14);
  }

  makeCar(lane, tint, label, isPlayer) {
    const c = this.add.container(carX(0), laneY(lane));
    c.add(this.add.image(0, 0, 'car').setTint(tint));
    c.add(
      isPlayer
        ? this.add.text(2, 1, label, { fontSize: '26px' }).setOrigin(0.5)
        : this.add.text(-30, 1, label, { fontFamily: FONT, fontSize: '22px', color: '#1d1f2b', fontStyle: 'bold' }).setOrigin(0.5),
    );
    return c;
  }

  makeCars() {
    const base = Math.max(0.35, this.stats.cps || 0.5); // letters/second; first race assumes a new typist
    this.rivals = RIVALS.map((r, i) => ({
      car: this.makeCar(i, r.tint, r.num, false),
      cps: Math.max(0.3, base * r.pace),
      phase: Math.random() * 6,
      progress: 0,
      finishedAt: null,
    }));
    this.player = this.makeCar(3, 0xe63946, getCurrentPlayer()?.icon ?? '😀', true);
    this.player.setDepth(5);
    this.exhaust = this.add
      .particles(0, 0, 'spark', {
        lifespan: 500,
        speedX: { min: -90, max: -30 },
        speedY: { min: -15, max: 15 },
        scale: { start: 0.6, end: 1.8 },
        alpha: { start: 0.45, end: 0 },
        tint: 0xbfc4cc,
        emitting: false,
      })
      .setDepth(4);
    this.puff = 0;
  }

  makeHud() {
    this.add
      .text(W / 2, 32, '🏎️ Grand Prix', { fontFamily: FONT, fontSize: '40px', color: '#ffffff', fontStyle: 'bold', stroke: '#1d1f2b', strokeThickness: 8 })
      .setOrigin(0.5);
    this.add.graphics().fillStyle(0x000000, 0.45).fillRoundedRect(W - 250, 12, 232, 46, 23);
    this.placeText = this.add
      .text(W - 134, 35, '', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
  }

  // ---- Speedometer --------------------------------------------------------

  gaugeAngle(kmh) {
    return Phaser.Math.DegToRad(135 + (270 * Math.min(kmh, MAX_KMH)) / MAX_KMH);
  }

  makeGauge() {
    const { x, y, r } = GAUGE;
    const g = this.add.graphics();
    g.fillStyle(0x111318, 1).fillCircle(x, y, r + 8);
    g.lineStyle(5, 0x8d99ae, 1).strokeCircle(x, y, r + 8);
    const band = (from, to, color) => {
      g.lineStyle(12, color, 1);
      g.beginPath();
      g.arc(x, y, r - 10, this.gaugeAngle(from), this.gaugeAngle(to));
      g.strokePath();
    };
    band(0, 60, 0x8ac926);
    band(60, 90, 0xffca3a);
    band(90, 120, 0xe63946);
    for (let v = 0; v <= MAX_KMH; v += 20) {
      const a = this.gaugeAngle(v);
      this.add
        .text(x + Math.cos(a) * (r - 38), y + Math.sin(a) * (r - 38), String(v), { fontFamily: FONT, fontSize: '17px', color: '#ffffff' })
        .setOrigin(0.5);
    }
    this.needle = this.add.rectangle(x, y, r - 14, 6, 0xff3b30).setOrigin(0.06, 0.5).setRotation(this.gaugeAngle(0));
    this.add.circle(x, y, 11, 0xdddddd);
    this.kmhText = this.add
      .text(x, y + 82, '0 km/h', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
  }

  // ---- Sentence panel -----------------------------------------------------

  makePanel() {
    this.panel = { x: 290, y: 478, w: 970, h: 228 };
    const p = this.panel;
    this.add.graphics().fillStyle(0xffffff, 1).fillRoundedRect(p.x, p.y, p.w, p.h, 24);
    this.add
      .text(p.x + 28, p.y + 22, 'Type the sentence!   Space = vroom   ⌫ = brake', { fontFamily: FONT, fontSize: '22px', color: '#6c6f85' })
      .setOrigin(0, 0.5);
    this.countText = this.add
      .text(p.x + p.w - 28, p.y + 22, '', { fontFamily: FONT, fontSize: '22px', color: '#6c6f85', fontStyle: 'bold' })
      .setOrigin(1, 0.5);
    this.chars = this.add.container(0, 0);
    this.cursor = this.add.rectangle(0, 0, 30, 5, COLORS.orange).setOrigin(0, 0.5);
    this.tweens.add({ targets: this.cursor, alpha: 0.2, duration: 450, yoyo: true, repeat: -1 });

    // Invisible text field over the panel: tapping the panel opens a
    // tablet's keyboard, and desktop typing lands here.
    // Phaser rewrites the managed node's opacity every frame, so it manages a
    // wrapper and the input inside it stays transparent.
    const wrap = document.createElement('div');
    const el = document.createElement('input');
    wrap.appendChild(el);
    Object.assign(el, { type: 'text', autocomplete: 'off', spellcheck: false });
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    Object.assign(el.style, {
      width: `${p.w}px`,
      height: `${p.h}px`,
      opacity: '0',
      border: 'none',
      fontSize: '16px',
      caretColor: 'transparent',
      cursor: 'text',
      display: 'block',
      padding: '0',
      background: 'transparent',
    });
    this.add.dom(p.x + p.w / 2, p.y + p.h / 2, wrap).setDepth(600);
    this.field = el;
    el.addEventListener('keydown', (e) => this.onKey(e));
    el.addEventListener('input', (e) => this.onInput(e));
    this.input.on('pointerup', () => !this.done && el.focus());
    this.time.delayedCall(60, () => el.focus());
  }

  showSentence() {
    const text = this.sentences[this.sentenceIndex];
    const p = this.panel;
    this.chars.removeAll(true);
    this.charObjs = [];
    const style = { fontFamily: FONT, fontSize: '46px', color: COLORS.ink, fontStyle: 'bold' };
    const left = p.x + 30;
    const maxX = p.x + p.w - 30;
    let x = left;
    let y = p.y + 92;
    // Lay out letter by letter, wrapping before a word that won't fit.
    // One off-screen Text measures every letter (making and destroying a
    // Text per letter garbles WebGL textures on some GPUs).
    this.measure ||= this.make.text({ style }, false);
    const words = text.split(/( )/);
    for (const word of words) {
      const widths = [...word].map((ch) => this.measure.setText(ch === ' ' ? '\u00a0' : ch).width);
      const wordW = widths.reduce((a, b) => a + b, 0);
      if (word !== ' ' && x + wordW > maxX && x > left) {
        x = left;
        y += 66;
      }
      [...word].forEach((ch, i) => {
        const bg = this.add.rectangle(x - 1, y, widths[i] + 2, 58, 0xffd6da).setOrigin(0, 0.5).setVisible(false);
        const t = this.add.text(x, y, ch === ' ' ? '\u00a0' : ch, style).setOrigin(0, 0.5);
        this.chars.add([bg, t]);
        this.charObjs.push({ ch, t, bg, x, y, w: widths[i] });
        x += widths[i];
      });
    }
    this.countText.setText(`Sentence ${this.sentenceIndex + 1} of ${this.sentences.length}`);
    this.field.value = '';
    this.ok = 0;
    this.best = 0;
    this.prevLen = 0;
    this.paint('');
  }

  /** Green for correct, red box for wrong, orange cursor on the next letter. */
  paint(typed) {
    this.charObjs.forEach((c, i) => {
      const wrong = i >= this.ok && i < typed.length;
      c.bg.setVisible(wrong);
      c.t.setColor(i < this.ok ? '#2a9d3a' : wrong ? '#e63946' : COLORS.ink);
    });
    const next = this.charObjs[Math.min(typed.length, this.charObjs.length - 1)];
    const end = typed.length >= this.charObjs.length;
    this.cursor.setPosition(end ? next.x + next.w : next.x, next.y + 32).setSize(end ? 20 : Math.max(18, next.w), 5);
  }

  // ---- Typing -------------------------------------------------------------

  onKey(e) {
    if (!this.started || this.done) return;
    if (e.key === 'Backspace') {
      this.lastKeyAt = performance.now();
      this.brake();
    } else if (e.key === ' ') {
      this.lastKeyAt = performance.now();
      sfx.rev();
    }
  }

  onInput(e) {
    if (!this.started || this.done) {
      this.field.value = '';
      return;
    }
    // Phone keyboards may not report keys; fall back to the input event.
    if (performance.now() - this.lastKeyAt > 80) {
      if (e.inputType?.startsWith('delete')) this.brake();
      else if (e.data?.includes(' ')) sfx.rev();
    }

    const target = this.sentences[this.sentenceIndex];
    let typed = this.field.value.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
    let ok = 0;
    while (ok < typed.length && ok < target.length && same(typed[ok], target[ok])) ok++;
    if (typed.length > ok + 4) {
      typed = typed.slice(0, ok + 4); // don't let a run of typos pile up
      this.field.value = typed;
    }
    if (typed.length > this.prevLen && typed.length > ok) {
      this.mistakes++;
      sfx.wrong();
    }
    if (ok > this.best) {
      const now = this.time.now;
      for (let i = this.best; i < ok; i++) this.hits.push(now);
      this.best = ok;
    }
    this.ok = ok;
    this.prevLen = typed.length;
    this.paint(typed);

    if (ok === target.length) this.sentenceDone();
  }

  brake() {
    sfx.brake();
    this.kmh *= 0.55;
    this.tweens.add({ targets: this.player, angle: { from: -5, to: 0 }, duration: 260, ease: 'Sine.easeOut' });
    for (let i = 0; i < 6; i++) this.exhaust.emitParticleAt(this.player.x - 50, this.player.y + Phaser.Math.Between(-22, 22));
  }

  sentenceDone() {
    this.doneChars += this.sentences[this.sentenceIndex].length;
    sfx.correct();
    if (this.sentenceIndex + 1 >= this.sentences.length) return this.finish();
    this.sentenceIndex++;
    this.showSentence();
  }

  // ---- Race ---------------------------------------------------------------

  countdown() {
    const lights = [-60, 0, 60].map((dx) => this.add.circle(W / 2 + dx, 300, 24, 0x330000).setStrokeStyle(4, 0x111111).setDepth(20));
    const plate = this.add.rectangle(W / 2, 300, 210, 74, 0x111111, 0.85).setDepth(19);
    const steps = [0, 1, 2];
    steps.forEach((i) =>
      this.time.delayedCall(500 + i * 800, () => {
        lights[i].setFillStyle(0xff2222);
        sfx.beep(false);
      }),
    );
    this.time.delayedCall(500 + 3 * 800, () => {
      lights.forEach((l) => l.setFillStyle(0x22dd44));
      sfx.beep(true);
      const go = this.add
        .text(W / 2, 220, 'GO!', { fontFamily: FONT, fontSize: '90px', color: '#ffffff', fontStyle: 'bold', stroke: '#22aa44', strokeThickness: 12 })
        .setOrigin(0.5)
        .setDepth(21);
      this.tweens.add({ targets: [go, ...lights, plate], alpha: 0, delay: 700, duration: 400, onComplete: () => [go, plate, ...lights].forEach((o) => o.destroy()) });
      this.started = true;
      this.startedAt = this.time.now;
      this.field.focus();
    });
  }

  playerProgress() {
    return (this.doneChars + (this.done ? 0 : this.best)) / this.total;
  }

  update(time, delta) {
    const dt = delta / 1000;

    // Speed from recent correct letters.
    while (this.hits.length && this.hits[0] < time - SPEED_WINDOW * 1000) this.hits.shift();
    const target = Math.min(MAX_KMH, (this.hits.length / SPEED_WINDOW) * KMH_PER_CPS);
    this.kmh += (target - this.kmh) * Math.min(1, dt * (target > this.kmh ? 4 : 1.5));
    this.topKmh = Math.max(this.topKmh, this.kmh);
    this.needle.setRotation(this.gaugeAngle(this.kmh));
    this.kmhText.setText(`${Math.round(this.kmh)} km/h`);
    this.motor.set(this.kmh / MAX_KMH);

    // Player car eases toward its typed progress; exhaust grows with speed.
    const px = carX(this.playerProgress());
    this.player.x += (px - this.player.x) * Math.min(1, dt * 6);
    this.puff += dt * (0.5 + this.kmh / 15);
    while (this.puff >= 1) {
      this.puff -= 1;
      this.exhaust.emitParticleAt(this.player.x - 62, this.player.y + Phaser.Math.Between(-8, 8));
    }

    if (!this.started) return;
    const t = (time - this.startedAt) / 1000;
    for (const r of this.rivals) {
      if (r.finishedAt === null) {
        const chars = t * r.cps + Math.sin(t * 0.8 + r.phase) * 0.8;
        r.progress = Phaser.Math.Clamp(chars / this.total, 0, 1);
        if (r.progress >= 1) r.finishedAt = time;
      }
      r.car.x = carX(r.progress);
    }
    if (!this.done) {
      const mine = this.playerProgress();
      const ahead = this.rivals.filter((r) => r.progress > mine).length;
      this.placeText.setText(`Position: ${ordinal(ahead + 1)}`);
    }
  }

  finish() {
    this.done = true;
    this.field.blur();
    this.field.style.display = 'none'; // DOM sits above the canvas; keep it off the results panel
    const place = 1 + this.rivals.filter((r) => r.finishedAt !== null).length;
    this.placeText.setText(`Finished ${ordinal(place)}!`);
    this.motor.stop();

    // Remember this player's pace so the next race stays close.
    const cps = this.total / Math.max(1, (this.time.now - this.startedAt) / 1000);
    this.stats.cps = this.stats.cps ? this.stats.cps * 0.6 + cps * 0.4 : cps;
    savePlayerData('race', this.stats);

    const flag = this.add
      .text(W / 2, 300, `🏁 ${ordinal(place)}! 🏁`, { fontFamily: FONT, fontSize: '84px', color: '#ffffff', fontStyle: 'bold', stroke: '#1d1f2b', strokeThickness: 12 })
      .setOrigin(0.5)
      .setDepth(30)
      .setScale(0.3);
    this.tweens.add({ targets: flag, scale: 1, duration: 400, ease: 'Back.easeOut' });
    this.time.delayedCall(1800, () => {
      flag.destroy();
      const stars = place === 1 ? 3 : place === 2 ? 2 : 1;
      showResult(this, 'Race', stars, `You came ${ordinal(place)}! Top speed ${Math.round(this.topKmh)} km/h`);
    });
  }
}
