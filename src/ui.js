import Phaser from 'phaser';
import { W, H, FONT, COLORS, PALETTE } from './theme.js';
import { sfx, speak } from './sound.js';
import { recordBest } from './storage.js';

/** Sky gradient, drifting clouds and an optional grassy hill. */
export function drawBackground(scene, { grass = true } = {}) {
  const g = scene.add.graphics();
  g.fillGradientStyle(COLORS.sky1, COLORS.sky1, COLORS.sky2, COLORS.sky2, 1);
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) {
    const cloud = scene.add
      .image(160 + i * 320 + Phaser.Math.Between(-60, 60), Phaser.Math.Between(170, 320), 'cloud')
      .setAlpha(0.85)
      .setScale(Phaser.Math.FloatBetween(0.6, 1.1));
    scene.tweens.add({
      targets: cloud,
      x: cloud.x + Phaser.Math.Between(40, 90),
      duration: Phaser.Math.Between(6000, 9000),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  if (grass) {
    const hill = scene.add.graphics();
    hill.fillStyle(COLORS.grass, 1);
    hill.fillEllipse(W / 2, H + 70, W * 1.6, 260);
  }
}

/** Big rounded button that squishes on hover/tap. */
export function makeButton(scene, x, y, label, onClick, { w = 300, h = 90, color = COLORS.orange, fontSize = 40 } = {}) {
  const c = scene.add.container(x, y);
  const shadow = scene.add.graphics().fillStyle(0x000000, 0.18).fillRoundedRect(-w / 2 + 4, -h / 2 + 8, w, h, 26);
  const bg = scene.add.graphics().fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 26);
  const txt = scene.add
    .text(0, 0, label, { fontFamily: FONT, fontSize: `${fontSize}px`, color: '#ffffff', fontStyle: 'bold' })
    .setOrigin(0.5);
  c.add([shadow, bg, txt]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerover', () => scene.tweens.add({ targets: c, scale: 1.06, duration: 100 }));
  c.on('pointerout', () => scene.tweens.add({ targets: c, scale: 1, duration: 100 }));
  c.on('pointerup', () => {
    sfx.click();
    onClick();
  });
  return c;
}

/**
 * A real <input> placed in the game at (x, y), in game units. Using a DOM
 * field (not drawn text) is what opens the virtual keyboard on tablets.
 */
export function textInput(scene, x, y, { width, height, fontSize, placeholder = '', maxLength, numeric = false, value = '' }) {
  const el = document.createElement('input');
  Object.assign(el, { type: 'text', value, placeholder, maxLength, autocomplete: 'off', spellcheck: false });
  el.setAttribute('autocorrect', 'off');
  el.setAttribute('enterkeyhint', 'go');
  if (numeric) {
    el.inputMode = 'numeric';
    el.pattern = '[0-9]*';
  }
  Object.assign(el.style, {
    width: `${width}px`,
    height: `${height}px`,
    boxSizing: 'border-box',
    padding: '0 16px',
    border: 'none',
    borderRadius: '20px',
    outline: 'none',
    background: '#ffffff',
    color: COLORS.ink,
    caretColor: '#ff5d8f',
    fontFamily: FONT,
    fontSize: `${fontSize}px`,
    fontWeight: 'bold',
    textAlign: 'center',
  });
  scene.add.dom(x, y, el).setDepth(600);
  scene.time.delayedCall(60, () => el.focus());
  return el;
}

/** Round icon button (home, speaker, mute). */
export function iconButton(scene, x, y, icon, onClick) {
  const c = scene.add.container(x, y).setDepth(500);
  const bg = scene.add.graphics().fillStyle(0xffffff, 0.9).fillCircle(0, 0, 36);
  const txt = scene.add.text(0, 2, icon, { fontFamily: FONT, fontSize: '40px' }).setOrigin(0.5);
  c.add([bg, txt]);
  c.setSize(72, 72).setInteractive({ useHandCursor: true });
  c.on('pointerup', () => {
    sfx.click();
    onClick(txt);
  });
  return c;
}

export const homeButton = (scene) => iconButton(scene, 56, 52, '🏠', () => scene.scene.start('Menu'));

export function praise(scene, x, y) {
  const words = ['Yes!', 'Great!', 'Super!', 'Awesome!', 'Wow!'];
  const t = scene.add
    .text(x, y, Phaser.Utils.Array.GetRandom(words), {
      fontFamily: FONT,
      fontSize: '64px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#ff5d8f',
      strokeThickness: 10,
    })
    .setOrigin(0.5)
    .setDepth(400)
    .setScale(0.3);
  scene.tweens.add({ targets: t, scale: 1, duration: 250, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, alpha: 0, y: y - 60, delay: 550, duration: 350, onComplete: () => t.destroy() });
}

export function starsText(n) {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

/** End-of-game panel: stars, best score, play again / menu. */
export function showResult(scene, game, stars) {
  const best = recordBest(game, stars);
  const message = ['Good try!', 'Good try!', 'Great job!', 'Amazing!'][stars];
  sfx.win();
  speak(message);

  const layer = scene.add.container(0, 0).setDepth(1000);
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setInteractive();
  const panel = scene.add.graphics().fillStyle(0xffffff, 1).fillRoundedRect(W / 2 - 340, H / 2 - 240, 680, 480, 40);
  const title = scene.add
    .text(W / 2, H / 2 - 170, message, { fontFamily: FONT, fontSize: '64px', color: COLORS.ink, fontStyle: 'bold' })
    .setOrigin(0.5);
  layer.add([dim, panel, title]);

  for (let i = 0; i < 3; i++) {
    const s = scene.add
      .image(W / 2 + (i - 1) * 140, H / 2 - 40, 'star')
      .setTint(i < stars ? COLORS.yellow : 0xd6d6de)
      .setScale(0);
    layer.add(s);
    scene.tweens.add({ targets: s, scale: 1.4, delay: 250 + i * 250, duration: 300, ease: 'Back.easeOut' });
  }
  const bestText = scene.add
    .text(W / 2, H / 2 + 60, `Best: ${starsText(best)}`, { fontFamily: FONT, fontSize: '34px', color: '#f4a300' })
    .setOrigin(0.5);
  layer.add(bestText);
  layer.add(makeButton(scene, W / 2 - 160, H / 2 + 155, 'Play again', () => scene.scene.restart(), { color: COLORS.green }));
  layer.add(makeButton(scene, W / 2 + 160, H / 2 + 155, 'Menu', () => scene.scene.start('Menu'), { color: COLORS.purple }));

  const confetti = scene.add
    .particles(0, -20, 'spark', {
      x: { min: 0, max: W },
      speedY: { min: 150, max: 350 },
      speedX: { min: -60, max: 60 },
      lifespan: 3500,
      scale: { min: 0.6, max: 1.4 },
      tint: PALETTE,
      quantity: 3,
      frequency: 40,
      duration: 1800,
    })
    .setDepth(1001);
  return { layer, confetti };
}
