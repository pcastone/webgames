import Phaser from 'phaser';
import { W, FONT, COLORS } from '../theme.js';
import { drawBackground, iconButton, starsText } from '../ui.js';
import { sfx, isMuted, toggleMute } from '../sound.js';
import { getBest, getCurrentPlayer } from '../storage.js';

const GAMES = [
  { key: 'Missile', name: 'Missile Math', icon: '🚀', color: COLORS.blue },
  { key: 'Memory', name: 'Memory Match', icon: '🐶', color: COLORS.purple },
  { key: 'Balloon', name: 'Balloon Math', icon: '🎈', color: COLORS.pink },
  { key: 'Word', name: 'Word Catcher', icon: '🔤', color: COLORS.green },
];

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const player = getCurrentPlayer();
    if (!player) return this.scene.start('Players');
    drawBackground(this);

    const title = this.add
      .text(W / 2, 105, 'Fun Games!', {
        fontFamily: FONT,
        fontSize: '88px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#ff5d8f',
        strokeThickness: 14,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: title, y: 120, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add
      .text(W / 2, 205, 'Pick a game to play', { fontFamily: FONT, fontSize: '34px', color: COLORS.ink })
      .setOrigin(0.5);

    GAMES.forEach((game, i) => this.makeTile(W / 2 + (i - (GAMES.length - 1) / 2) * 300, 430, game));

    this.playerChip(player);
    iconButton(this, W - 56, 52, isMuted() ? '🔇' : '🔊', (txt) => txt.setText(toggleMute() ? '🔇' : '🔊'));
  }

  /** Shows who is playing: tap the chip to edit, the 👥 button to switch. */
  playerChip(player) {
    const { name, icon } = player;
    const label = this.add
      .text(0, 0, `${name} ✏️`, { fontFamily: FONT, fontSize: '32px', color: COLORS.ink, fontStyle: 'bold' })
      .setOrigin(0, 0.5);
    const w = 84 + label.width + 26;
    label.setX(84 - w / 2);
    const c = this.add.container(20 + w / 2, 52, [
      this.add.graphics().fillStyle(0xffffff, 0.9).fillRoundedRect(-w / 2, -36, w, 72, 36),
      this.add.text(40 - w / 2, 2, icon, { fontFamily: FONT, fontSize: '46px' }).setOrigin(0.5),
      label,
    ]);
    c.setSize(w, 72).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      sfx.click();
      this.scene.start('NewPlayer', { player, returnTo: 'Menu' });
    });
    iconButton(this, 20 + w + 50, 52, '👥', () => this.scene.start('Players'));
  }

  makeTile(x, y, { key, name, icon, color }) {
    const size = 270;
    const c = this.add.container(x, y);
    const shadow = this.add.graphics().fillStyle(0x000000, 0.18).fillRoundedRect(-size / 2 + 6, -size / 2 + 10, size, size, 40);
    const bg = this.add.graphics().fillStyle(color, 1).fillRoundedRect(-size / 2, -size / 2, size, size, 40);
    const iconText = this.add.text(0, -40, icon, { fontFamily: FONT, fontSize: '104px' }).setOrigin(0.5);
    const label = this.add
      .text(0, 62, name, { fontFamily: FONT, fontSize: '32px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    const best = this.add
      .text(0, 104, starsText(getBest(key)), { fontFamily: FONT, fontSize: '34px', color: '#ffe066' })
      .setOrigin(0.5);
    c.add([shadow, bg, iconText, label, best]);
    c.setSize(size, size).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.05, angle: -2, duration: 120 }));
    c.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, angle: 0, duration: 120 }));
    c.on('pointerup', () => {
      sfx.click();
      this.scene.start(key);
    });
  }
}
