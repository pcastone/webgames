import Phaser from 'phaser';
import { W, FONT, COLORS, PALETTE } from '../theme.js';
import { drawBackground } from '../ui.js';
import { sfx, speak } from '../sound.js';
import { getPlayers, setCurrentPlayer, MAX_PLAYERS } from '../storage.js';

const TILE_W = 200;
const TILE_H = 210;
const GAP = 28;
const PER_ROW = 5;
const STRIP_TOP = 42; // y (from tile center) where the name strip starts

/** Opening screen: pick who is playing, or make a new player. */
export default class PlayerScene extends Phaser.Scene {
  constructor() {
    super('Players');
  }

  create() {
    const players = getPlayers();
    if (players.length === 0) return this.scene.start('NewPlayer', { player: null });

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
    c.add([
      this.add.graphics().fillStyle(0x000000, 0.18).fillRoundedRect(-TILE_W / 2 + 5, -TILE_H / 2 + 9, TILE_W, TILE_H, 34),
      this.add.graphics().fillStyle(item.color, item.add ? 0.85 : 1).fillRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 34),
      this.add.text(0, -28, item.icon, { fontFamily: FONT, fontSize: item.add ? '72px' : '96px' }).setOrigin(0.5),
    ]);
    const hover = (scale) => () => this.tweens.add({ targets: c, scale, duration: 100 });

    if (item.add) {
      c.add(this.add.text(0, 70, item.name, { fontFamily: FONT, fontSize: '28px', color: COLORS.ink, fontStyle: 'bold' }).setOrigin(0.5));
      this.tapArea(c, 0, 0, TILE_W, TILE_H, hover, () => this.scene.start('NewPlayer', { player: null }));
    } else {
      // Bottom strip holds the name and edits the player; the rest of the tile picks it.
      c.add(
        this.add.graphics().fillStyle(0x000000, 0.16).fillRoundedRect(-TILE_W / 2, STRIP_TOP, TILE_W, TILE_H / 2 - STRIP_TOP, { tl: 0, tr: 0, bl: 34, br: 34 }),
      );
      const label = this.add
        .text(0, (STRIP_TOP + TILE_H / 2) / 2, `${item.name} ✏️`, { fontFamily: FONT, fontSize: '30px', color: '#ffffff', fontStyle: 'bold' })
        .setOrigin(0.5);
      label.setScale(Math.min(1, (TILE_W - 20) / label.width));
      c.add(label);
      const player = { id: item.id, name: item.name, icon: item.icon };
      this.tapArea(c, 0, (STRIP_TOP - TILE_H / 2) / 2, TILE_W, STRIP_TOP + TILE_H / 2, hover, () => {
        setCurrentPlayer(player);
        speak(`Hi ${item.name}!`);
        this.scene.start('Menu');
      });
      this.tapArea(c, 0, (STRIP_TOP + TILE_H / 2) / 2, TILE_W, TILE_H / 2 - STRIP_TOP, hover, () =>
        this.scene.start('NewPlayer', { player, returnTo: 'Players' }),
      );
    }

    c.setScale(0);
    this.tweens.add({ targets: c, scale: 1, delay: i * 60, duration: 260, ease: 'Back.easeOut' });
  }

  tapArea(container, x, y, w, h, hover, onTap) {
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', hover(1.06));
    zone.on('pointerout', hover(1));
    zone.on('pointerup', () => {
      sfx.click();
      onTap();
    });
    container.add(zone);
  }
}
