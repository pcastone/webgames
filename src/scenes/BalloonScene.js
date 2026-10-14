import Phaser from 'phaser';
import { W, H, FONT, COLORS, PALETTE, pick } from '../theme.js';
import { drawBackground, homeButton, iconButton, praise, showResult } from '../ui.js';
import { sfx, speak } from '../sound.js';

const ROUNDS = 10;
const MAX_BALLOONS = 7;

function makeQuestion(round) {
  const { Between } = Phaser.Math;
  // First half: sums to 10. Second half: add or subtract within 20.
  if (round < ROUNDS / 2) {
    const a = Between(1, 9);
    const b = Between(1, 10 - a);
    return { a, b, op: '+', answer: a + b };
  }
  if (Math.random() < 0.5) {
    const a = Between(2, 15);
    const b = Between(1, 20 - a);
    return { a, b, op: '+', answer: a + b };
  }
  const a = Between(5, 20);
  const b = Between(1, a);
  return { a, b, op: '−', answer: a - b };
}

export default class BalloonScene extends Phaser.Scene {
  constructor() {
    super('Balloon');
  }

  create() {
    drawBackground(this);
    homeButton(this);
    iconButton(this, W - 56, 52, '🔈', () => this.sayQuestion());

    this.round = 0;
    this.mistakes = 0;
    this.balloons = [];
    this.accepting = false;
    this.done = false;

    this.add.graphics().setDepth(300).fillStyle(0xffffff, 0.9).fillRoundedRect(W / 2 - 260, 18, 520, 110, 30);
    this.qText = this.add
      .text(W / 2, 73, '', { fontFamily: FONT, fontSize: '72px', color: COLORS.ink, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(301);
    this.dots = this.add.graphics().setDepth(300);
    this.drawProgress();

    this.burst = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 150, max: 380 },
        lifespan: 650,
        scale: { start: 1.3, end: 0 },
        gravityY: 500,
        tint: PALETTE,
        emitting: false,
      })
      .setDepth(200);

    this.time.addEvent({ delay: 850, loop: true, callback: () => this.spawnBalloon() });
    this.nextQuestion();
  }

  drawProgress() {
    this.dots.clear();
    for (let i = 0; i < ROUNDS; i++) {
      this.dots.fillStyle(i < this.round ? COLORS.yellow : 0xffffff, i < this.round ? 1 : 0.7);
      this.dots.fillCircle(W / 2 + (i - (ROUNDS - 1) / 2) * 34, 152, 11);
    }
  }

  sayQuestion() {
    if (!this.q) return;
    speak(`${this.q.a} ${this.q.op === '+' ? 'plus' : 'minus'} ${this.q.b}`);
  }

  nextQuestion() {
    if (this.round >= ROUNDS) return this.finish();
    this.q = makeQuestion(this.round);
    this.qText.setText(`${this.q.a} ${this.q.op} ${this.q.b} = ?`).setScale(0.6);
    this.tweens.add({ targets: this.qText, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.sayQuestion();
    this.accepting = true;
    this.spawnBalloon(true);
  }

  distractor() {
    const { answer } = this.q;
    let v;
    do v = answer + Phaser.Math.Between(-5, 5);
    while (v === answer || v < 0);
    return v;
  }

  spawnBalloon(forceCorrect = false) {
    if (!this.accepting || this.balloons.length >= MAX_BALLOONS) return;
    const hasCorrect = this.balloons.some((b) => b.value === this.q.answer && !b.popping);
    const correct = forceCorrect || Math.random() < (hasCorrect ? 0.15 : 0.55);
    const value = correct ? this.q.answer : this.distractor();

    // Keep new balloons from stacking on ones that just launched.
    let x;
    for (let tries = 0; tries < 10; tries++) {
      x = Phaser.Math.Between(110, W - 110);
      if (!this.balloons.some((b) => b.y > H - 60 && Math.abs(b.baseX - x) < 140)) break;
    }

    const color = pick(PALETTE);
    const c = this.add.container(x, H + 130).setDepth(100);
    c.add(this.add.image(0, 0, 'balloon').setOrigin(0.5, 0.35).setTint(color));
    c.add(
      this.add
        .text(0, 0, String(value), {
          fontFamily: FONT,
          fontSize: '54px',
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#2b2d42',
          strokeThickness: 7,
        })
        .setOrigin(0.5),
    );
    c.setSize(110, 130).setInteractive({ useHandCursor: true });
    Object.assign(c, {
      value,
      baseX: x,
      speed: Phaser.Math.Between(70, 105) + this.round * 5,
      phase: Math.random() * Math.PI * 2,
      popping: false,
    });
    c.on('pointerdown', () => this.tap(c));
    this.balloons.push(c);
  }

  update(time, delta) {
    const dt = delta / 1000;
    for (const b of [...this.balloons]) {
      if (b.popping) continue;
      b.y -= b.speed * dt;
      b.x = b.baseX + Math.sin(time / 700 + b.phase) * 18;
      b.rotation = Math.sin(time / 900 + b.phase) * 0.06;
      if (b.y < -170) this.remove(b);
    }
  }

  remove(b) {
    this.balloons = this.balloons.filter((o) => o !== b);
    b.destroy();
  }

  pop(b) {
    b.popping = true;
    b.disableInteractive();
    sfx.pop();
    this.burst.explode(18, b.x, b.y);
    this.tweens.add({ targets: b, scale: 1.4, alpha: 0, duration: 120, onComplete: () => this.remove(b) });
  }

  tap(b) {
    if (!this.accepting || b.popping) return;
    if (b.value !== this.q.answer) {
      this.mistakes++;
      sfx.wrong();
      b.disableInteractive();
      b.setAlpha(0.5);
      this.tweens.add({ targets: b, angle: { from: -15, to: 15 }, duration: 70, yoyo: true, repeat: 2 });
      return;
    }

    this.accepting = false;
    this.pop(b);
    this.time.delayedCall(120, () => sfx.correct());
    praise(this, b.x, Math.max(b.y, 260));
    this.round++;
    this.drawProgress();
    for (const o of this.balloons) {
      if (o === b) continue;
      o.popping = true;
      o.disableInteractive();
      this.tweens.add({ targets: o, alpha: 0, y: o.y - 60, duration: 400, onComplete: () => this.remove(o) });
    }
    this.time.delayedCall(1000, () => this.nextQuestion());
  }

  finish() {
    this.done = true;
    const stars = this.mistakes <= 1 ? 3 : this.mistakes <= 4 ? 2 : 1;
    showResult(this, 'Balloon', stars);
  }
}
