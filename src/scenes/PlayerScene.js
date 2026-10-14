import Phaser from 'phaser';
import { W, FONT, COLORS, PALETTE } from '../theme.js';
import { drawBackground } from '../ui.js';
import { sfx, speak } from '../sound.js';
import { getPlayers, setCurrentPlayer, MAX_PLAYERS } from '../storage.js';

const TILE_W = 200;
const TILE_H = 210;
const GAP = 28;
const PER_ROW = 5;

/** Opening screen: pick who is playing, or make a new player. */
export default class PlayerScene extends Phaser.Scene {
  constructor() {
    super('Players');
  }

  create() {
    const players = getPlayers();
    if (players.length === 0) return this.scene.start('NewPlayer');

    drawBackground(this);
    this.add
      .text(W / 2, 90, "Who's playing?", {
        fontFamily: FONT,
        fontSize: '80px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#ff5d8f',
        strokeThickness: 14,
      })
      .setOrigin(0.5);

    const items = players.map((p, i) => ({ ...p, color: PALETTE[i % PALETTE.length] }));
    if (players.length < MAX_PLAYERS) items.push({ add: true, icon: '➕', name: 'New player', color: 0xffffff });

    const rows = Math.ceil(items.length / PER_ROW);
    const top = rows === 1 ? 390 : 300;
    items.forEach((item, i) => {
      const row = Math.floor(i / PER_ROW);
      const inRow = Math.min(PER_ROW, items.length - row * PER_ROW);
      const col = i % PER_ROW;
      const x = W / 2 + (col - (inRow - 1) / 2) * (TILE_W + GAP);
      const y = top + row * (TILE_H + GAP);
      this.makeTile(x, y, item, i);
    });
  }

  makeTile(x, y, item, i) {
    const c = this.add.container(x, y);
    const textColor = item.add ? COLORS.ink : '#ffffff';
    c.add([
      this.add.graphics().fillStyle(0x000000, 0.18).fillRoundedRect(-TILE_W / 2 + 5, -TILE_H / 2 + 9, TILE_W, TILE_H, 34),
      this.add.graphics().fillStyle(item.color, item.add ? 0.85 : 1).fillRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 34),
      this.add.text(0, -28, item.icon, { fontFamily: FONT, fontSize: item.add ? '72px' : '96px' }).setOrigin(0.5),
      this.add
        .text(0, 70, item.name, {
          fontFamily: FONT,
          fontSize: item.add ? '28px' : '34px',
          color: textColor,
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    ]);
    c.setSize(TILE_W, TILE_H).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.06, duration: 100 }));
    c.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 100 }));
    c.on('pointerup', () => {
      sfx.click();
      if (item.add) return this.scene.start('NewPlayer');
      setCurrentPlayer({ id: item.id, name: item.name, icon: item.icon });
      speak(`Hi ${item.name}!`);
      this.scene.start('Menu');
    });

    c.setScale(0);
    this.tweens.add({ targets: c, scale: 1, delay: i * 60, duration: 260, ease: 'Back.easeOut' });
  }
}
