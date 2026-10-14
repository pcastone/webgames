import Phaser from 'phaser';
import { W, FONT, COLORS } from '../theme.js';
import { drawBackground, homeButton, praise, showResult } from '../ui.js';
import { sfx, speak } from '../sound.js';

const ANIMALS = [
  ['🐶', 'dog'], ['🐱', 'cat'], ['🐸', 'frog'], ['🐵', 'monkey'], ['🦁', 'lion'], ['🐼', 'panda'],
  ['🐷', 'pig'], ['🐰', 'bunny'], ['🦊', 'fox'], ['🐻', 'bear'], ['🐨', 'koala'], ['🐯', 'tiger'],
];
const COLS = 4;
const ROWS = 3;
const CW = 150;
const CH = 165;
const GAP = 22;

export default class MemoryScene extends Phaser.Scene {
  constructor() {
    super('Memory');
  }

  create() {
    drawBackground(this, { grass: false });
    homeButton(this);

    this.first = null;
    this.locked = false;
    this.moves = 0;
    this.matched = 0;

    this.add
      .text(W / 2, 55, 'Find the pairs!', { fontFamily: FONT, fontSize: '50px', color: COLORS.ink, fontStyle: 'bold' })
      .setOrigin(0.5);
    this.movesText = this.add
      .text(W - 120, 55, 'Moves: 0', { fontFamily: FONT, fontSize: '32px', color: COLORS.ink })
      .setOrigin(0.5);

    const pairs = Phaser.Utils.Array.Shuffle([...ANIMALS]).slice(0, (COLS * ROWS) / 2);
    const deck = Phaser.Utils.Array.Shuffle([...pairs, ...pairs]);
    const left = W / 2 - ((COLS - 1) * (CW + GAP)) / 2;
    const top = 135 + CH / 2;
    deck.forEach(([emoji, name], i) => {
      const x = left + (i % COLS) * (CW + GAP);
      const y = top + Math.floor(i / COLS) * (CH + GAP);
      this.makeCard(x, y, emoji, name, i);
    });
  }

  makeCard(x, y, emoji, name, i) {
    const c = this.add.container(x, y);
    const back = this.add.container(0, 0, [
      this.add.graphics().fillStyle(COLORS.purple, 1).fillRoundedRect(-CW / 2, -CH / 2, CW, CH, 22)
        .lineStyle(6, 0xffffff, 0.6).strokeRoundedRect(-CW / 2 + 10, -CH / 2 + 10, CW - 20, CH - 20, 16),
      this.add.text(0, 0, '?', { fontFamily: FONT, fontSize: '80px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5),
    ]);
    const front = this.add.container(0, 0, [
      this.add.graphics().fillStyle(0xffffff, 1).fillRoundedRect(-CW / 2, -CH / 2, CW, CH, 22)
        .lineStyle(6, COLORS.yellow, 1).strokeRoundedRect(-CW / 2 + 3, -CH / 2 + 3, CW - 6, CH - 6, 20),
      this.add.text(0, 0, emoji, { fontFamily: FONT, fontSize: '90px' }).setOrigin(0.5),
    ]).setVisible(false);
    c.add([back, front]);
    Object.assign(c, { emoji, name, back, front, faceUp: false, done: false });
    c.setSize(CW, CH).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => this.pick(c));

    // Deal-in animation.
    c.setScale(0);
    this.tweens.add({ targets: c, scale: 1, delay: i * 40, duration: 250, ease: 'Back.easeOut' });
  }

  flip(card, faceUp) {
    card.faceUp = faceUp;
    sfx.flip();
    this.tweens.add({
      targets: card,
      scaleX: 0,
      duration: 110,
      onComplete: () => {
        card.back.setVisible(!faceUp);
        card.front.setVisible(faceUp);
        this.tweens.add({ targets: card, scaleX: 1, duration: 110 });
      },
    });
  }

  pick(card) {
    if (this.locked || card.faceUp || card.done) return;
    this.flip(card, true);
    if (!this.first) {
      this.first = card;
      return;
    }

    const a = this.first;
    const b = card;
    this.first = null;
    this.locked = true;
    this.moves++;
    this.movesText.setText(`Moves: ${this.moves}`);

    if (a.emoji === b.emoji) {
      this.time.delayedCall(350, () => {
        a.done = b.done = true;
        sfx.correct();
        speak(a.name);
        praise(this, W / 2, 380);
        this.tweens.add({ targets: [a, b], scale: 1.12, yoyo: true, duration: 160 });
        this.locked = false;
        if (++this.matched === (COLS * ROWS) / 2) this.time.delayedCall(700, () => this.finish());
      });
    } else {
      this.time.delayedCall(900, () => {
        sfx.wrong();
        this.flip(a, false);
        this.flip(b, false);
        this.time.delayedCall(250, () => (this.locked = false));
      });
    }
  }

  finish() {
    // 6 pairs: 6 moves is perfect.
    const stars = this.moves <= 9 ? 3 : this.moves <= 13 ? 2 : 1;
    showResult(this, 'Memory', stars);
  }
}
