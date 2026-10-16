import Phaser from 'phaser';
import { W, H, FONT, COLORS } from '../theme.js';
import { homeButton, iconButton, makeButton, showResult } from '../ui.js';
import { sfx, speak, isMuted } from '../sound.js';
import { pickSpellingWords } from '../spelling.js';

const WORDS = [
  'CAT', 'DOG', 'SUN', 'RUN', 'HOP', 'BIG', 'RED', 'FISH', 'FROG', 'JUMP',
  'POND', 'TREE', 'DUCK', 'BIKE', 'CAKE', 'PLAY', 'RAIN', 'BOAT', 'GREEN', 'TRAIN',
  'WATER', 'HAPPY', 'APPLE', 'HOUSE', 'SMILE', 'SLEEP', 'UNDER', 'AFTER', 'FRIEND', 'SCHOOL',
];

// Bottom to top. Each correct word hops over one hazard to the next safe strip.
const BANDS = ['start', 'road', 'grass', 'rail', 'grass', 'river', 'grass', 'road', 'grass', 'river', 'home'];
const SAFE_H = 110;
const HAZARD_H = 170;
const PANEL_H = 160; // typing panel at the bottom of the screen
const LIVES = 3;

const isSafe = (kind) => kind === 'start' || kind === 'grass' || kind === 'home';

/**
 * Frog Hop: hear a word, type it. Spelled right, the frog hops over the next
 * road, railway or river to safety; spelled wrong, it hops into the hazard
 * (squashed, hit by a train, splash or alligator), the right spelling is
 * shown, and a new frog tries the same word. Three frogs per round.
 */
export default class FrogScene extends Phaser.Scene {
  constructor() {
    super('Frog');
  }

  create() {
    const custom = pickSpellingWords(5);
    this.words = custom.length ? custom : Phaser.Utils.Array.Shuffle([...WORDS]).slice(0, 5);
    this.wordIndex = 0;
    this.lives = LIVES;
    this.misses = 0;
    this.busy = true;
    this.done = false;

    this.layoutBands();
    this.drawBoard();
    this.movers = [];
    this.spawnTraffic();

    this.frog = this.add.text(W / 2, this.safeY(0), '🐸', { fontSize: '64px' }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: this.frog, scaleY: 0.92, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.spot = 0; // index into safe strips the frog is on

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, this.worldH + PANEL_H);
    cam.scrollY = this.cameraTarget();

    this.makeHud();
    this.makePanel();
    this.time.delayedCall(600, () => this.askWord());
  }

  // ---- Board --------------------------------------------------------------

  layoutBands() {
    // World y grows downward; the start strip sits at the bottom.
    this.worldH = BANDS.reduce((h, k) => h + (isSafe(k) ? SAFE_H : HAZARD_H), 0);
    let y = this.worldH;
    this.bands = BANDS.map((kind) => {
      const h = isSafe(kind) ? SAFE_H : HAZARD_H;
      y -= h;
      return { kind, top: y, h, mid: y + h / 2 };
    });
    this.safe = this.bands.filter((b) => isSafe(b.kind));
  }

  safeY(i) {
    return this.safe[i].mid;
  }

  /** The hazard between safe strip i and i + 1. */
  hazardAfter(i) {
    const at = this.bands.indexOf(this.safe[i]);
    return this.bands[at + 1];
  }

  drawBoard() {
    const g = this.add.graphics();
    for (const b of this.bands) {
      const { top, h } = b;
      if (b.kind === 'road') {
        g.fillStyle(0x4a4e57, 1).fillRect(0, top, W, h);
        g.fillStyle(0xbfc4cc, 1).fillRect(0, top, W, 6).fillRect(0, top + h - 6, W, 6);
        g.fillStyle(0xffd23f, 1);
        for (let x = 0; x < W; x += 90) g.fillRect(x, top + h / 2 - 3, 50, 6);
      } else if (b.kind === 'rail') {
        g.fillStyle(0x9c8a74, 1).fillRect(0, top, W, h);
        g.fillStyle(0x6b4f2a, 1);
        for (let x = 0; x < W; x += 34) g.fillRect(x, top + h / 2 - 40, 16, 80);
        g.fillStyle(0xc7ccd6, 1).fillRect(0, top + h / 2 - 30, W, 7).fillRect(0, top + h / 2 + 23, W, 7);
      } else if (b.kind === 'river') {
        g.fillStyle(0x2f80d8, 1).fillRect(0, top, W, h);
        g.lineStyle(3, 0x8fc7ff, 0.6);
        for (let i = 0; i < 14; i++) {
          const x = Phaser.Math.Between(0, W);
          const y = top + Phaser.Math.Between(16, h - 16);
          g.beginPath().arc(x, y, 14, Math.PI * 1.1, Math.PI * 1.9).strokePath();
        }
      } else if (b.kind === 'home') {
        g.fillStyle(0x2f80d8, 1).fillRect(0, top, W, h);
        g.fillStyle(0x2e8b3c, 1);
        for (let x = 120; x < W; x += 260) g.fillEllipse(x, b.mid, 150, 70);
        g.fillEllipse(W / 2, b.mid, 170, 80);
        this.add.text(W / 2 + 60, b.mid - 20, '🌸', { fontSize: '30px' }).setOrigin(0.5);
        this.add.text(W / 2 - 160, top + 22, 'HOME', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      } else {
        g.fillStyle(b.kind === 'start' ? 0x6cc24a : 0x7ed957, 1).fillRect(0, top, W, h);
        g.fillStyle(0x5aa64a, 1);
        for (let i = 0; i < 18; i++) g.fillTriangle(...this.tuft(top, h));
        if (b.kind === 'start') this.add.text(W / 2 - 160, b.mid, 'START', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      }
    }
  }

  tuft(top, h) {
    const x = Phaser.Math.Between(10, W - 10);
    const y = top + Phaser.Math.Between(20, h - 10);
    return [x - 6, y, x + 6, y, x, y - 14];
  }

  /** Background traffic: cars, logs and gators that loop; trains now and then. */
  spawnTraffic() {
    for (const b of this.bands) {
      if (b.kind === 'road') {
        [[b.top + 45, 1], [b.top + b.h - 45, -1]].forEach(([y, dir]) => {
          const speed = Phaser.Math.Between(120, 190) * dir;
          for (let i = 0; i < 3; i++) {
            const car = this.add.text(Phaser.Math.Between(0, W) + i * 420, y, Phaser.Utils.Array.GetRandom(['🚗', '🚕', '🚙', '🚌', '🚚']), { fontSize: '56px' })
              .setOrigin(0.5)
              .setFlipX(dir > 0)
              .setDepth(20);
            this.movers.push({ obj: car, vx: speed });
          }
        });
      } else if (b.kind === 'river') {
        [[b.top + 45, -1], [b.top + b.h - 45, 1]].forEach(([y, dir]) => {
          const speed = Phaser.Math.Between(50, 90) * dir;
          for (let i = 0; i < 3; i++) {
            const x = Phaser.Math.Between(0, W) + i * 430;
            const obj = Math.random() < 0.65 ? this.makeLog(x, y) : this.add.text(x, y, '🐊', { fontSize: '58px' }).setOrigin(0.5).setFlipX(dir > 0).setDepth(20);
            this.movers.push({ obj, vx: speed });
          }
        });
      } else if (b.kind === 'rail') {
        this.time.addEvent({ delay: 7000, startAt: Phaser.Math.Between(1000, 5000), loop: true, callback: () => this.runTrain(b, false) });
      }
    }
  }

  makeLog(x, y) {
    const c = this.add.container(x, y).setDepth(15);
    const g = this.add.graphics();
    g.fillStyle(0x8b5a2b, 1).fillRoundedRect(-85, -22, 170, 44, 22);
    g.lineStyle(3, 0x5c3a1a, 1).lineBetween(-60, -8, 50, -8).lineBetween(-40, 8, 70, 8);
    g.fillStyle(0xc49a6c, 1).fillEllipse(80, 0, 18, 40);
    c.add(g);
    return c;
  }

  /** A train crossing the band; returns its engine so a scene can follow it. */
  runTrain(band, fast) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const cars = ['🚂', '🚃', '🚃', '🚃', '🚃'];
    const train = this.add.container(dir > 0 ? -560 : W + 560, band.mid).setDepth(30);
    cars.forEach((e, i) => {
      // The engine leads, whichever way the train runs.
      train.add(this.add.text(-dir * i * 100, 0, e, { fontSize: '86px' }).setOrigin(0.5).setFlipX(dir > 0));
    });
    const speed = (fast ? 1700 : 1100) * dir;
    this.movers.push({ obj: train, vx: speed, once: true });
    return { train, dir };
  }

  // ---- HUD and typing panel -----------------------------------------------

  makeHud() {
    homeButton(this).setScrollFactor(0, 0, true);
    this.add.graphics().setScrollFactor(0).setDepth(400).fillStyle(0x000000, 0.45).fillRoundedRect(W / 2 - 150, 14, 300, 50, 25);
    this.progressText = this.add
      .text(W / 2, 39, '', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(401);
    this.add.graphics().setScrollFactor(0).setDepth(400).fillStyle(0x000000, 0.45).fillRoundedRect(W - 220, 14, 200, 50, 25);
    this.lifeIcons = [0, 1, 2].map((i) => this.add.text(W - 170 + i * 50, 39, '🐸', { fontSize: '32px' }).setOrigin(0.5).setScrollFactor(0).setDepth(401));
    this.updateHud();
  }

  updateHud() {
    this.progressText.setText(`Word ${Math.min(this.wordIndex + 1, this.words.length)} of ${this.words.length}`);
    this.lifeIcons.forEach((t, i) => t.setAlpha(i < this.lives ? 1 : 0.25));
  }

  makePanel() {
    const top = H - PANEL_H;
    // Fixed to the screen; containers pass it to their children so taps line up.
    const ui = (o) => o.setScrollFactor(0, 0, true).setDepth(400);
    ui(this.add.graphics().fillStyle(0xffffff, 1).fillRect(0, top, W, PANEL_H).fillStyle(0x2e8b3c, 1).fillRect(0, top, W, 6));
    ui(iconButton(this, 90, top + 70, '🔊', () => this.sayWord()));
    this.hint = ui(
      this.add.text(W / 2, top + 135, 'Listen, then type the word and press Enter', { fontFamily: FONT, fontSize: '22px', color: '#6c6f85' }).setOrigin(0.5),
    );
    this.slots = ui(this.add.container(W / 2, top + 65));
    this.hopButton = ui(makeButton(this, W - 130, top + 70, 'Hop! 🐸', () => this.submit(), { w: 200, h: 84, color: COLORS.green, fontSize: 34 }));

    // Invisible field over the blanks: tapping opens a tablet keyboard.
    const wrap = document.createElement('div');
    const el = document.createElement('input');
    wrap.appendChild(el);
    Object.assign(el, { type: 'text', autocomplete: 'off', spellcheck: false });
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('enterkeyhint', 'go');
    Object.assign(el.style, { display: 'block', width: '760px', height: '120px', opacity: '0', border: 'none', padding: '0', fontSize: '16px', caretColor: 'transparent', background: 'transparent' });
    this.add.dom(W / 2, top + 70, wrap).setScrollFactor(0).setDepth(600);
    this.field = el;
    el.addEventListener('input', () => this.onType());
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    });
    this.input.on('pointerup', () => !this.done && el.focus());
    this.time.delayedCall(60, () => el.focus());
  }

  /** Draw one box per letter, filled with what's typed (or the answer). */
  drawSlots(letters, colors = []) {
    this.slots.removeAll(true);
    const n = this.word.length;
    const step = Math.min(66, 700 / n);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * step;
      this.slots.add(this.add.graphics().fillStyle(0xf1f1f6, 1).fillRoundedRect(x - step / 2 + 4, -40, step - 8, 80, 12));
      this.slots.add(this.add.rectangle(x, 30, step - 22, 4, 0x8d99ae));
      this.slots.add(
        this.add
          .text(x, 0, letters[i] ?? '', { fontFamily: FONT, fontSize: `${Math.round(Math.min(56, step * 0.85))}px`, color: colors[i] ?? COLORS.ink, fontStyle: 'bold' })
          .setOrigin(0.5),
      );
    }
  }

  // ---- Words --------------------------------------------------------------

  askWord() {
    this.word = this.words[this.wordIndex];
    this.field.value = '';
    this.drawSlots([]);
    this.updateHud();
    this.hint.setText('Listen, then type the word and press Enter');
    this.busy = false;
    this.field.focus();
    this.sayWord();
  }

  sayWord() {
    if (!this.word) return;
    if (isMuted() || !('speechSynthesis' in window)) {
      // No voice: show the word briefly instead.
      this.drawSlots([...this.word], []);
      this.time.delayedCall(2000, () => !this.busy && this.drawSlots([...this.typed()]));
      return;
    }
    speak(this.word.toLowerCase());
  }

  typed() {
    return this.field.value.replace(/[’‘]/g, "'").toUpperCase().replace(/[^\p{L}']/gu, '');
  }

  onType() {
    if (this.busy) {
      this.field.value = '';
      return;
    }
    const t = this.typed().slice(0, this.word.length);
    this.field.value = t;
    sfx.click();
    this.drawSlots([...t]);
  }

  submit() {
    if (this.busy || this.done) return;
    const t = this.typed();
    if (!t) {
      sfx.wrong();
      return;
    }
    this.busy = true;
    if (t === this.word) this.hopSafe();
    else this.hopIntoDanger(t);
  }

  // ---- Hops ---------------------------------------------------------------

  hop(toY, duration = 520) {
    sfx.hop();
    return new Promise((resolve) => {
      this.tweens.add({ targets: this.frog, y: toY, duration, ease: 'Sine.easeInOut', onComplete: resolve });
      this.tweens.add({ targets: this.frog, scale: 1.4, duration: duration / 2, yoyo: true });
    });
  }

  wait(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  async hopSafe() {
    sfx.correct();
    this.drawSlots([...this.word], Array(this.word.length).fill('#2a9d3a'));
    this.spot++;
    await this.hop(this.safeY(this.spot), 700);
    this.wordIndex++;
    if (this.spot === this.safe.length - 1) return this.finish(true);
    await this.wait(300);
    this.askWord();
  }

  async hopIntoDanger(typed) {
    this.misses++;
    const band = this.hazardAfter(this.spot);
    const laneY = band.kind === 'rail' ? band.mid : band.top + 45;
    await this.hop(laneY, 450);

    if (band.kind === 'road') await this.squash(laneY);
    else if (band.kind === 'rail') await this.train(band);
    else if (Math.random() < 0.5) await this.splash();
    else await this.gator(laneY);

    // Show the right spelling, letter by letter.
    const colors = [...this.word].map((c, i) => (typed[i] === c ? '#2a9d3a' : '#e63946'));
    this.drawSlots([...this.word], colors);
    this.hint.setText(`It's spelled ${[...this.word].join(' - ')}`);
    speak(`Oops! ${this.word.toLowerCase()} is spelled ${[...this.word.toLowerCase()].join(', ')}`);

    this.lives--;
    this.updateHud();
    await this.wait(3600);
    if (this.lives <= 0) return this.finish(false);

    // A new frog on the same strip tries the same word again.
    this.frog.setPosition(W / 2, this.safeY(this.spot)).setAlpha(1).setAngle(0).setScale(0);
    this.tweens.add({ targets: this.frog, scale: 1, duration: 300, ease: 'Back.easeOut' });
    await this.wait(400);
    this.askWord();
  }

  /** A car speeds through the frog's lane and flattens it. */
  squash(y) {
    return new Promise((resolve) => {
      const car = this.add.text(-120, y, '🚙', { fontSize: '64px' }).setOrigin(0.5).setFlipX(true).setDepth(60);
      sfx.honk();
      this.movers.push({ obj: car, vx: 1300, once: true });
      const check = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          if (car.x < this.frog.x - 30) return;
          check.remove();
          sfx.splat();
          this.tweens.killTweensOf(this.frog);
          this.frog.setScale(1.5, 0.2);
          this.time.delayedCall(700, resolve);
        },
      });
    });
  }

  /** Horn, then a fast train knocks the frog flying. */
  async train(band) {
    sfx.horn();
    await this.wait(500);
    const { train, dir } = this.runTrain(band, true);
    await new Promise((resolve) => {
      const check = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          if ((dir > 0 && train.x < this.frog.x - 40) || (dir < 0 && train.x > this.frog.x + 40)) return;
          check.remove();
          sfx.boing();
          this.tweens.killTweensOf(this.frog);
          this.tweens.add({ targets: this.frog, y: this.frog.y - 320, x: this.frog.x + dir * 200, angle: 720 * dir, alpha: 0, duration: 900, onComplete: resolve });
        },
      });
    });
  }

  /** The frog misses everything and sinks with a splash. */
  async splash() {
    sfx.splash();
    this.tweens.killTweensOf(this.frog);
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(this.frog.x, this.frog.y + 10, 10).setStrokeStyle(4, 0xffffff, 0.9).setDepth(55);
      this.tweens.add({ targets: ring, radius: 70, alpha: 0, delay: i * 160, duration: 700, onComplete: () => ring.destroy() });
    }
    await new Promise((resolve) => this.tweens.add({ targets: this.frog, scale: 0, y: this.frog.y + 14, duration: 600, onComplete: resolve }));
    await this.wait(300);
  }

  /** An alligator swims over and snaps the frog up. */
  gator(y) {
    return new Promise((resolve) => {
      const gator = this.add.text(W + 120, y, '🐊', { fontSize: '80px' }).setOrigin(0.5).setDepth(60);
      this.movers.push({ obj: gator, vx: -900, once: true });
      const check = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          if (gator.x > this.frog.x + 50) return;
          check.remove();
          sfx.chomp();
          this.tweens.killTweensOf(this.frog);
          this.frog.setAlpha(0);
          this.tweens.add({ targets: gator, scale: 1.15, duration: 90, yoyo: true, repeat: 1 });
          this.time.delayedCall(700, resolve);
        },
      });
    });
  }

  // ---- Frame loop and end -------------------------------------------------

  cameraTarget() {
    const max = this.worldH + PANEL_H - H;
    return Phaser.Math.Clamp(this.frog.y - 320, 0, max);
  }

  update(time, delta) {
    const dt = delta / 1000;
    for (const m of [...this.movers]) {
      m.obj.x += m.vx * dt;
      if (m.once) {
        if (m.obj.x < -900 || m.obj.x > W + 900) {
          m.obj.destroy();
          this.movers = this.movers.filter((o) => o !== m);
        }
      } else if (m.vx > 0 && m.obj.x > W + 150) m.obj.x = -150;
      else if (m.vx < 0 && m.obj.x < -150) m.obj.x = W + 150;
    }
    const cam = this.cameras.main;
    cam.scrollY += (this.cameraTarget() - cam.scrollY) * Math.min(1, dt * 4);
  }

  finish(home) {
    this.done = true;
    this.field.blur();
    this.field.style.display = 'none'; // DOM sits above the canvas; keep it off the results panel
    if (home) {
      sfx.correct();
      speak('You made it home!');
      this.tweens.add({ targets: this.frog, y: this.frog.y - 40, duration: 220, yoyo: true, repeat: 2 });
    }
    this.time.delayedCall(home ? 1400 : 300, () =>
      showResult(this, 'Frog', home ? this.lives : 0, home ? `Home with ${this.lives} frog${this.lives === 1 ? '' : 's'} left!` : 'Out of frogs! Try again'),
    );
  }
}
