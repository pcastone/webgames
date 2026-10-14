import Phaser from 'phaser';
import { W, FONT, COLORS } from '../theme.js';
import { drawBackground, iconButton, starsText } from '../ui.js';
import { sfx, isMuted, toggleMute } from '../sound.js';
import { getBest } from '../storage.js';

const GAMES = [
  { key: 'Memory', name: 'Memory Match', icon: '🐶', color: COLORS.purple },
  { key: 'Balloon', name: 'Balloon Math', icon: '🎈', color: COLORS.pink },
  { key: 'Word', name: 'Word Catcher', icon: '🔤', color: COLORS.green },
];

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
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

    GAMES.forEach((game, i) => this.makeTile(W / 2 + (i - 1) * 370, 430, game));

    iconButton(this, W - 56, 52, isMuted() ? '🔇' : '🔊', (txt) => txt.setText(toggleMute() ? '🔇' : '🔊'));
  }

  makeTile(x, y, { key, name, icon, color }) {
    const size = 310;
    const c = this.add.container(x, y);
    const shadow = this.add.graphics().fillStyle(0x000000, 0.18).fillRoundedRect(-size / 2 + 6, -size / 2 + 10, size, size, 40);
    const bg = this.add.graphics().fillStyle(color, 1).fillRoundedRect(-size / 2, -size / 2, size, size, 40);
    const iconText = this.add.text(0, -45, icon, { fontFamily: FONT, fontSize: '120px' }).setOrigin(0.5);
    const label = this.add
      .text(0, 75, name, { fontFamily: FONT, fontSize: '38px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    const best = this.add
      .text(0, 122, starsText(getBest(key)), { fontFamily: FONT, fontSize: '34px', color: '#ffe066' })
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
