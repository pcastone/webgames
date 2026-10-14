import Phaser from 'phaser';
import { W, H, FONT, COLORS, PALETTE, pick } from '../theme.js';
import { drawBackground, homeButton, iconButton, praise, showResult } from '../ui.js';
import { sfx, speak } from '../sound.js';
import { pickSpellingWords } from '../spelling.js';

const WORDS = [
  ['CAT', '🐱'], ['DOG', '🐶'], ['SUN', '☀️'], ['BUS', '🚌'], ['BEE', '🐝'], ['HAT', '🎩'],
  ['PIG', '🐷'], ['CAR', '🚗'], ['FISH', '🐟'], ['FROG', '🐸'], ['CAKE', '🍰'], ['STAR', '⭐'],
  ['MOON', '🌙'], ['DUCK', '🦆'], ['TREE', '🌳'], ['BOOK', '📖'], ['APPLE', '🍎'], ['HOUSE', '🏠'],
];
const WORDS_PER_GAME = 5;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SLOT_W = 72;
const SLOT_GAP = 12;
const BASKET_Y = H - 70;

export default class WordScene extends Phaser.Scene {
  constructor() {
    super('Word');
  }

  create() {
    drawBackground(this);
    homeButton(this);
    iconButton(this, W - 56, 52, '🔈', () => this.sayWord());

    // The parent's spelling list (A–Z words only, since letters fall from
    // A–Z) wins; otherwise built-in words, short ones first.
    const custom = pickSpellingWords(WORDS_PER_GAME, (w) => /^[A-Z]+$/.test(w));
    this.words = custom.length
      ? custom.map((w) => [w, '📝'])
      : Phaser.Utils.Array.Shuffle([...WORDS])
          .slice(0, WORDS_PER_GAME)
          .sort((a, b) => a[0].length - b[0].length);
    // Cursor keys capture Space/arrows for the whole page; release them on exit.
    this.events.once('shutdown', () => this.input.keyboard?.clearCaptures());
    this.wordIndex = 0;
    this.mistakes = 0;
    this.letters = [];
    this.accepting = false;
    this.header = null;

    this.basket = this.add.image(W / 2, BASKET_Y, 'basket').setDepth(150);
    this.targetX = W / 2;
    const follow = (p) => (this.targetX = p.x);
    this.input.on('pointermove', follow);
    this.input.on('pointerdown', follow);
    this.cursors = this.input.keyboard?.createCursorKeys();

    this.burst = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 120, max: 320 },
        lifespan: 600,
        scale: { start: 1.2, end: 0 },
        gravityY: 400,
        tint: PALETTE,
        emitting: false,
      })
      .setDepth(200);

    this.add
      .text(W / 2, 178, 'Move the basket to catch the letters in order', {
        fontFamily: FONT,
        fontSize: '22px',
        color: COLORS.ink,
      })
      .setOrigin(0.5)
      .setDepth(160);

    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.spawnLetter() });
    this.startWord();
  }

  sayWord() {
    if (this.word) speak(`Spell ${this.word.toLowerCase()}`);
  }

  startWord() {
    const [word, emoji] = this.words[this.wordIndex];
    this.word = word;
    this.pos = 0;
    this.sinceNeeded = 0;

    this.header?.destroy();
    const n = word.length;
    this.slotW = Math.min(SLOT_W, Math.floor((760 - (n - 1) * SLOT_GAP) / n)); // long words shrink
    const total = n * this.slotW + (n - 1) * SLOT_GAP;
    this.header = this.add.container(W / 2 + 50, 95).setDepth(300);
    const panelW = total + 160;
    this.header.add(
      this.add.graphics().fillStyle(0xffffff, 0.9).fillRoundedRect(-total / 2 - 140, -62, panelW + 30, 124, 30),
    );
    this.emoji = this.add.text(-total / 2 - 70, 0, emoji, { fontFamily: FONT, fontSize: '84px' }).setOrigin(0.5);
    this.header.add(this.emoji);
    this.slots = [...word].map((ch, i) => {
      const x = -total / 2 + this.slotW / 2 + i * (this.slotW + SLOT_GAP);
      const box = this.add.graphics();
      const txt = this.add
        .text(x, 2, ch, { fontFamily: FONT, fontSize: `${Math.round(this.slotW * 0.8)}px`, color: '#c9c9d6', fontStyle: 'bold' })
        .setOrigin(0.5);
      this.header.add([box, txt]);
      return { x, box, txt };
    });
    this.drawSlots();
    this.header.setScale(0.5);
    this.tweens.add({ targets: this.header, scale: 1, duration: 300, ease: 'Back.easeOut' });

    this.sayWord();
    this.accepting = true;
  }

  drawSlots() {
    this.slots.forEach(({ x, box }, i) => {
      box.clear();
      box.fillStyle(i < this.pos ? COLORS.green : 0xf1f1f6, 1);
      box.fillRoundedRect(x - this.slotW / 2, -44, this.slotW, 88, 16);
      if (i === this.pos) box.lineStyle(5, COLORS.orange, 1).strokeRoundedRect(x - this.slotW / 2, -44, this.slotW, 88, 16);
    });
  }

  spawnLetter() {
    if (!this.accepting || this.letters.length >= 6) return;
    const need = this.word[this.pos];
    let ch;
    // Guarantee the needed letter shows up at least every third drop.
    if (this.sinceNeeded >= 2 || Math.random() < 0.4) {
      ch = need;
      this.sinceNeeded = 0;
    } else {
      do ch = pick(ALPHABET);
      while (ch === need);
      this.sinceNeeded++;
    }

    let x;
    for (let tries = 0; tries < 10; tries++) {
      x = Phaser.Math.Between(80, W - 80);
      if (!this.letters.some((l) => l.y < 280 && Math.abs(l.x - x) < 120)) break;
    }

    const c = this.add.container(x, 230).setDepth(100);
    c.add(this.add.graphics().fillStyle(pick(PALETTE), 1).fillCircle(0, 0, 42).lineStyle(4, 0xffffff, 0.8).strokeCircle(0, 0, 38));
    c.add(
      this.add
        .text(0, 2, ch, {
          fontFamily: FONT,
          fontSize: '52px',
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#2b2d42',
          strokeThickness: 6,
        })
        .setOrigin(0.5),
    );
    c.setScale(0);
    this.tweens.add({ targets: c, scale: 1, duration: 200 });
    Object.assign(c, { ch, speed: 140 + this.wordIndex * 15 + Phaser.Math.Between(0, 40), phase: Math.random() * 6 });
    this.letters.push(c);
  }

  update(time, delta) {
    const dt = delta / 1000;
    const b = this.basket;
    const kLeft = this.cursors?.left.isDown;
    const kRight = this.cursors?.right.isDown;
    if (kLeft || kRight) {
      b.x += (kRight ? 1 : -1) * 650 * dt;
      this.targetX = b.x;
    } else {
      b.x += (this.targetX - b.x) * Math.min(1, dt * 14);
    }
    b.x = Phaser.Math.Clamp(b.x, 90, W - 90);

    for (const l of [...this.letters]) {
      l.y += l.speed * dt;
      l.rotation = Math.sin(time / 300 + l.phase) * 0.15;
      if (l.y > b.y - 95 && l.y < b.y - 20 && Math.abs(l.x - b.x) < 88) this.catchLetter(l);
      else if (l.y > H + 60) this.removeLetter(l);
    }
  }

  removeLetter(l) {
    this.letters = this.letters.filter((o) => o !== l);
    l.destroy();
  }

  catchLetter(l) {
    this.letters = this.letters.filter((o) => o !== l);
    if (!this.accepting) return l.destroy();

    if (l.ch !== this.word[this.pos]) {
      this.mistakes++;
      sfx.wrong();
      this.tweens.add({ targets: this.basket, angle: { from: -8, to: 8 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => this.basket.setAngle(0) });
      this.tweens.add({ targets: l, alpha: 0, y: l.y + 40, scale: 0.5, duration: 250, onComplete: () => l.destroy() });
      return;
    }

    const slot = this.slots[this.pos];
    this.pos++;
    sfx.ding();
    this.burst.explode(12, l.x, l.y);
    const wordDone = this.pos === this.word.length;
    if (wordDone) this.accepting = false;

    // Fly the letter up into its slot.
    this.tweens.add({
      targets: l,
      x: this.header.x + slot.x * this.header.scaleX,
      y: this.header.y,
      scale: 0.6,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        l.destroy();
        slot.txt.setColor('#ffffff');
        this.drawSlots();
        if (wordDone) this.wordComplete();
      },
    });
  }

  wordComplete() {
    sfx.correct();
    speak(this.word.toLowerCase());
    praise(this, W / 2, 300);
    this.tweens.add({ targets: this.emoji, scale: 1.4, angle: 360, duration: 600, ease: 'Back.easeOut' });
    for (const l of this.letters) this.tweens.add({ targets: l, alpha: 0, duration: 300, onComplete: () => l.destroy() });
    this.letters = [];
    this.time.delayedCall(1600, () => {
      this.wordIndex++;
      if (this.wordIndex >= this.words.length) this.finish();
      else this.startWord();
    });
  }

  finish() {
    const stars = this.mistakes <= 2 ? 3 : this.mistakes <= 5 ? 2 : 1;
    showResult(this, 'Word', stars);
  }
}
