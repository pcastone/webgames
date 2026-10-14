import Phaser from 'phaser';
import { W, H, FONT, COLORS } from '../theme.js';
import { homeButton, showResult, textInput } from '../ui.js';
import { sfx } from '../sound.js';
import { makeQuestion } from '../mathq.js';

const TOTAL = 15; // missiles per round
const MAX_ALIVE = 4;
const GROUND_Y = 600;
const BASE_XS = [220, 640, 1060];
const INTERCEPT_SPEED = 900;
const MAX_DIGITS = 2;

/**
 * Missiles carry math problems toward the bases. Type an answer and fire:
 * the nearest base shoots down the missile with that answer, or the shot
 * flies off harmlessly if no missile matches. Stars = bases left standing.
 */
export default class MissileScene extends Phaser.Scene {
  constructor() {
    super('Missile');
  }

  create() {
    this.drawNight();
    homeButton(this);

    this.missiles = [];
    this.shots = [];
    this.spawned = 0;
    this.hits = 0;
    this.done = false;

    this.trails = this.add.graphics().setDepth(10);
    this.bases = BASE_XS.map((x) => ({
      x,
      alive: true,
      img: this.add.image(x, GROUND_Y - 36, 'base').setTint(0x4cc9f0).setDepth(20),
    }));

    this.add.graphics().setDepth(499).fillStyle(0x000000, 0.45).fillRoundedRect(W - 490, 16, 474, 64, 32);
    this.hud = this.add
      .text(W - 40, 30, '', { fontFamily: FONT, fontSize: '32px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(1, 0)
      .setDepth(500);
    this.updateHud();

    const hint = this.add
      .text(W / 2, 250, 'Type the answer on the keyboard\nand press Enter to fire!', {
        fontFamily: FONT,
        fontSize: '40px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(400);
    this.tweens.add({ targets: hint, alpha: 0, delay: 4000, duration: 800, onComplete: () => hint.destroy() });

    this.makeKeypad();

    this.time.delayedCall(1200, () => this.spawnLoop());
  }

  drawNight() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0b1d51, 0x0b1d51, 0x3a2e7a, 0x3a2e7a, 1);
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const star = this.add
        .circle(Phaser.Math.Between(0, W), Phaser.Math.Between(0, GROUND_Y - 60), Phaser.Math.FloatBetween(1, 2.5), 0xffffff)
        .setAlpha(Phaser.Math.FloatBetween(0.3, 0.9));
      this.tweens.add({ targets: star, alpha: 0.15, duration: Phaser.Math.Between(800, 2000), yoyo: true, repeat: -1 });
    }
    this.add.text(1160, 160, '🌙', { fontSize: '64px' }).setOrigin(0.5);
    g.fillStyle(0x3c8d40, 1).fillRect(0, GROUND_Y, W, H - GROUND_Y);
    g.fillStyle(0x2d6a30, 1).fillRect(0, GROUND_Y, W, 8);
  }

  // ---- Answer entry -------------------------------------------------------

  /** Answer box plus ⌫ and FIRE; the digits come from the real keyboard. */
  makeKeypad() {
    const y = 660;
    this.answer = textInput(this, W / 2, y, { width: 220, height: 84, fontSize: 60, placeholder: '?', maxLength: MAX_DIGITS, numeric: true });
    this.answer.addEventListener('input', () => {
      this.answer.value = this.answer.value.replace(/\D/g, '').slice(0, MAX_DIGITS);
      sfx.click();
    });
    this.answer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.fire();
      }
    });
    // Taps on the game keep the field focused so the keyboard stays up.
    this.input.on('pointerup', () => !this.done && this.answer.focus());
    this.add
      .text(W / 2 - 140, y, 'Type the answer ⌨️', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(1, 0.5)
      .setDepth(300);

    const keys = [
      { k: '⌫', label: '⌫', w: 90, color: COLORS.pink, x: W / 2 + 175 },
      { k: 'FIRE', label: 'FIRE 🚀', w: 190, color: COLORS.orange, x: W / 2 + 335 },
    ];
    for (const { k, label, w, color, x } of keys) {
      const c = this.add.container(x, y, [
        this.add.graphics().fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2 + 2, -36 + 5, w, 72, 16),
        this.add.graphics().fillStyle(color, 1).fillRoundedRect(-w / 2, -36, w, 72, 16),
        this.add.text(0, 2, label, { fontFamily: FONT, fontSize: '34px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5),
      ]);
      c.setDepth(300).setSize(w, 72).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => {
        this.tweens.add({ targets: c, scale: 0.88, yoyo: true, duration: 70 });
        this.press(k);
      });
    }
  }

  press(k) {
    if (this.done) return;
    if (k === 'FIRE') return this.fire();
    this.answer.value = this.answer.value.slice(0, -1);
    sfx.click();
    this.answer.focus();
  }

  fire() {
    if (this.done) return;
    this.answer.focus();
    if (!this.answer.value) return sfx.wrong();
    const value = Number(this.answer.value);
    this.answer.value = '';

    const target = this.missiles.find((m) => !m.targeted && m.q.answer === value);
    const alive = this.bases.filter((b) => b.alive);
    if (alive.length === 0) return;
    const from = target
      ? alive.reduce((best, b) => (Math.abs(b.x - target.x) < Math.abs(best.x - target.x) ? b : best))
      : Phaser.Utils.Array.GetRandom(alive);

    if (target) {
      target.targeted = true;
      target.labelBg.clear().fillStyle(0x8ac926, 1).fillRoundedRect(0, 0, target.labelW, 52, 14);
      target.labelText.setColor('#ffffff');
    } else {
      sfx.wrong();
    }
    sfx.launch();
    const sy = GROUND_Y - 72;
    this.tweens.add({ targets: from.img, y: from.img.y + 6, duration: 60, yoyo: true });
    this.shots.push({
      sx: from.x,
      sy,
      x: from.x,
      y: sy,
      target,
      vx: target ? 0 : Phaser.Math.Between(-120, 120),
      vy: -INTERCEPT_SPEED,
      img: this.add.image(from.x, sy, 'missile').setTint(0x4cc9f0).setScale(0.8).setDepth(30),
    });
  }

  // ---- Incoming missiles --------------------------------------------------

  spawnLoop() {
    if (this.done || this.spawned >= TOTAL) return;
    if (this.missiles.length < MAX_ALIVE) this.spawnMissile();
    const delay = Math.max(2600, 5200 - this.spawned * 180);
    this.time.delayedCall(delay, () => this.spawnLoop());
  }

  spawnMissile() {
    const alive = this.bases.filter((b) => b.alive);
    if (alive.length === 0) return;

    // Every missile on screen has a different answer.
    const taken = new Set(this.missiles.filter((m) => !m.targeted).map((m) => m.q.answer));
    let q;
    for (let i = 0; i < 30; i++) {
      q = makeQuestion(this.spawned >= 5);
      if (!taken.has(q.answer)) break;
    }

    const base = Phaser.Utils.Array.GetRandom(alive);
    const sx = Phaser.Math.Between(80, W - 80);
    const tx = base.x + Phaser.Math.Between(-20, 20);
    const ty = GROUND_Y - 30;
    const text = `${q.a} ${q.op} ${q.b}`;

    const labelText = this.add.text(14, 26, text, { fontFamily: FONT, fontSize: '34px', color: COLORS.ink, fontStyle: 'bold' }).setOrigin(0, 0.5);
    const labelW = labelText.width + 28;
    const labelBg = this.add.graphics().fillStyle(0xffffff, 1).fillRoundedRect(0, 0, labelW, 52, 14);
    const label = this.add.container(0, 0, [labelBg, labelText]).setDepth(200);

    const m = {
      q,
      sx,
      sy: -30,
      tx,
      ty,
      x: sx,
      y: -30,
      base,
      t: 0,
      dur: Math.max(10, 19 - this.spawned * 0.6), // seconds to reach the ground
      targeted: false,
      img: this.add.image(sx, -30, 'missile').setTint(0xff595e).setDepth(40),
      label,
      labelBg,
      labelText,
      labelW,
    };
    m.img.rotation = Math.atan2(ty - m.sy, tx - sx) + Math.PI / 2;
    this.missiles.push(m);
    this.spawned++;
    this.updateHud();
  }

  // ---- Frame loop ---------------------------------------------------------

  update(time, delta) {
    const dt = delta / 1000;
    this.trails.clear();

    for (const m of [...this.missiles]) {
      if (!this.missiles.includes(m)) continue; // removed by finish() this frame
      m.t = Math.min(1, m.t + dt / m.dur);
      m.x = Phaser.Math.Linear(m.sx, m.tx, m.t);
      m.y = Phaser.Math.Linear(m.sy, m.ty, m.t);
      m.img.setPosition(m.x, m.y);
      // Label rides beside the tip, flipping left near the right edge.
      const lx = m.x + 22 + m.labelW > W - 10 ? m.x - 22 - m.labelW : m.x + 22;
      m.label.setPosition(lx, Math.max(4, m.y - 10));
      this.trails.lineStyle(4, 0xff8fa3, 0.55).lineBetween(m.sx, m.sy, m.x, m.y);
      if (m.t >= 1) this.missileLands(m);
    }

    for (const s of [...this.shots]) {
      if (s.target && !this.missiles.includes(s.target)) {
        // Target already gone: keep flying the way we were heading.
        s.target = null;
      }
      if (s.target) {
        const ang = Math.atan2(s.target.y - s.y, s.target.x - s.x);
        s.vx = Math.cos(ang) * INTERCEPT_SPEED;
        s.vy = Math.sin(ang) * INTERCEPT_SPEED;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.img.setPosition(s.x, s.y).setRotation(Math.atan2(s.vy, s.vx) + Math.PI / 2);
      this.trails.lineStyle(3, 0x9be7ff, 0.6).lineBetween(s.sx, s.sy, s.x, s.y);

      if (s.target && Phaser.Math.Distance.Between(s.x, s.y, s.target.x, s.target.y) < 24) {
        this.removeShot(s);
        this.destroyMissile(s.target);
      } else if (s.y < -60 || s.x < -60 || s.x > W + 60) {
        this.removeShot(s);
      }
    }

    if (!this.done && this.spawned >= TOTAL && this.missiles.length === 0 && this.shots.length === 0) this.finish();
  }

  removeShot(s) {
    this.shots = this.shots.filter((o) => o !== s);
    s.img.destroy();
  }

  removeMissile(m) {
    this.missiles = this.missiles.filter((o) => o !== m);
    m.img.destroy();
    m.label.destroy();
  }

  destroyMissile(m) {
    this.removeMissile(m);
    this.boom(m.x, m.y, 0xffd23f, 1);
    this.hits++;
    this.updateHud();
    this.time.delayedCall(150, () => sfx.correct());
  }

  missileLands(m) {
    this.removeMissile(m);
    this.boom(m.x, m.y, 0xff595e, 1.4);
    this.cameras.main.shake(250, 0.01);
    const base = m.base;
    if (base.alive) {
      base.alive = false;
      base.img.setTint(0x4a4a5a).setScale(1, 0.55).setY(GROUND_Y - 20);
      this.add.text(base.x, GROUND_Y - 40, '💨', { fontSize: '40px' }).setOrigin(0.5).setDepth(25);
    }
    if (this.bases.every((b) => !b.alive)) this.finish();
  }

  boom(x, y, color, size) {
    sfx.boom();
    const b = this.add.image(x, y, 'boom').setTint(color).setScale(0.1).setDepth(150);
    this.tweens.add({ targets: b, scale: size, alpha: 0, duration: 450, ease: 'Cubic.easeOut', onComplete: () => b.destroy() });
  }

  updateHud() {
    this.hud.setText(`Stopped: ${this.hits}   Missiles: ${this.spawned}/${TOTAL}`);
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.answer.blur();
    this.answer.style.display = 'none'; // DOM sits above the canvas; keep it off the results panel
    for (const m of [...this.missiles]) this.removeMissile(m);
    for (const s of [...this.shots]) this.removeShot(s);
    const stars = this.bases.filter((b) => b.alive).length;
    this.time.delayedCall(700, () => showResult(this, 'Missile', stars));
  }
}
