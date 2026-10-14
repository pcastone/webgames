import Phaser from 'phaser';
import { W, FONT, COLORS } from '../theme.js';
import { drawBackground, iconButton, makeButton } from '../ui.js';
import { sfx, speak } from '../sound.js';
import { addPlayer, getPlayers, setCurrentPlayer } from '../storage.js';

const ICONS = ['🦄', '🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐰', '🐨', '🐙', '🦖', '🐝', '🐢', '🐧'];
const KEY_ROWS = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ⌫'];
const MAX_NAME = 10;
const KEY = 70;
const KEY_GAP = 10;
const KB_X = 500; // keyboard center; the Done button sits to its right

/** Make a player: type a name with the big ABC keyboard and pick an icon. */
export default class NewPlayerScene extends Phaser.Scene {
  constructor() {
    super('NewPlayer');
  }

  create() {
    drawBackground(this, { grass: false });
    this.name = '';
    this.icon = Phaser.Utils.Array.GetRandom(ICONS);

    if (getPlayers().length > 0) iconButton(this, 56, 52, '⬅️', () => this.scene.start('Players'));
    this.add
      .text(W / 2, 52, 'Make your player!', { fontFamily: FONT, fontSize: '54px', color: COLORS.ink, fontStyle: 'bold' })
      .setOrigin(0.5);

    // Preview card: chosen icon + name typed so far.
    this.add.graphics().fillStyle(0xffffff, 0.95).fillRoundedRect(W / 2 - 300, 98, 600, 100, 30);
    this.preview = this.add.text(W / 2 - 230, 150, this.icon, { fontFamily: FONT, fontSize: '70px' }).setOrigin(0.5);
    this.nameText = this.add
      .text(W / 2 - 160, 150, '', { fontFamily: FONT, fontSize: '56px', color: COLORS.ink, fontStyle: 'bold' })
      .setOrigin(0, 0.5);
    this.hint = this.add
      .text(W / 2 - 160, 150, 'Type your name', { fontFamily: FONT, fontSize: '40px', color: '#a0a0b4' })
      .setOrigin(0, 0.5);
    this.cursor = this.add.rectangle(0, 150, 5, 56, COLORS.blue);
    this.tweens.add({ targets: this.cursor, alpha: 0, duration: 450, yoyo: true, repeat: -1 });

    this.makeIconPicker();
    this.makeKeyboard();
    this.done = makeButton(this, 1080, 520, 'Done ✓', () => this.finish(), { w: 250, h: 110, color: COLORS.green, fontSize: 44 });

    this.input.keyboard?.on('keydown', (e) => {
      if (/^[a-z]$/i.test(e.key)) this.type(e.key.toUpperCase());
      else if (e.key === 'Backspace') this.type('⌫');
      else if (e.key === 'Enter') this.finish();
    });

    this.refresh();
    speak('Make your player! Type your name and pick a picture.');
  }

  makeIconPicker() {
    this.iconRings = [];
    ICONS.forEach((icon, i) => {
      const x = W / 2 + ((i % 8) - 3.5) * 92;
      const y = 265 + Math.floor(i / 8) * 88;
      const ring = this.add.graphics();
      const c = this.add.container(x, y, [
        ring,
        this.add.text(0, 2, icon, { fontFamily: FONT, fontSize: '50px' }).setOrigin(0.5),
      ]);
      c.setSize(80, 80).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        sfx.flip();
        this.icon = icon;
        this.tweens.add({ targets: c, scale: 1.2, yoyo: true, duration: 100 });
        this.refresh();
      });
      this.iconRings.push({ icon, ring });
    });
  }

  makeKeyboard() {
    KEY_ROWS.forEach((row, r) => {
      [...row].forEach((ch, i) => {
        const x = KB_X + (i - 4) * (KEY + KEY_GAP);
        const y = 455 + r * (KEY + KEY_GAP);
        const color = ch === '⌫' ? COLORS.pink : COLORS.blue;
        const c = this.add.container(x, y, [
          this.add.graphics().fillStyle(0x000000, 0.15).fillRoundedRect(-KEY / 2 + 2, -KEY / 2 + 5, KEY, KEY, 16),
          this.add.graphics().fillStyle(color, 1).fillRoundedRect(-KEY / 2, -KEY / 2, KEY, KEY, 16),
          this.add
            .text(0, 2, ch, { fontFamily: FONT, fontSize: '40px', color: '#ffffff', fontStyle: 'bold' })
            .setOrigin(0.5),
        ]);
        c.setSize(KEY, KEY).setInteractive({ useHandCursor: true });
        c.on('pointerdown', () => {
          this.tweens.add({ targets: c, scale: 0.88, yoyo: true, duration: 70 });
          this.type(ch);
        });
      });
    });
  }

  type(ch) {
    if (ch === '⌫') {
      this.name = this.name.slice(0, -1);
    } else if (this.name.length < MAX_NAME) {
      this.name += ch;
    } else {
      return sfx.wrong();
    }
    sfx.click();
    this.refresh();
  }

  /** Display names as "Sam", whatever case was typed. */
  displayName() {
    return this.name.charAt(0) + this.name.slice(1).toLowerCase();
  }

  refresh() {
    this.preview.setText(this.icon);
    this.nameText.setText(this.displayName());
    this.hint.setVisible(this.name.length === 0);
    this.cursor.setX(this.nameText.x + this.nameText.width + 6);
    for (const { icon, ring } of this.iconRings) {
      ring.clear();
      if (icon === this.icon) ring.lineStyle(6, COLORS.orange, 1).fillStyle(0xffffff, 1).fillCircle(0, 0, 42).strokeCircle(0, 0, 42);
      else ring.fillStyle(0xffffff, 0.6).fillCircle(0, 0, 38);
    }
    const ready = this.name.length > 0;
    this.done.setAlpha(ready ? 1 : 0.4);
  }

  finish() {
    if (!this.name) {
      sfx.wrong();
      speak('Type your name first');
      return;
    }
    const player = addPlayer(this.displayName(), this.icon);
    setCurrentPlayer(player);
    sfx.correct();
    speak(`Hi ${player.name}!`);
    this.scene.start('Menu');
  }
}
