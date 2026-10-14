import Phaser from 'phaser';
import { W, FONT, COLORS } from '../theme.js';
import { drawBackground, iconButton, makeButton, textInput } from '../ui.js';
import { sfx, speak } from '../sound.js';
import { addPlayer, getPlayers, setCurrentPlayer, updatePlayer } from '../storage.js';

const ICONS = ['🦄', '🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐰', '🐨', '🐙', '🦖', '🐝', '🐢', '🐧'];
const MAX_NAME = 10;

/**
 * Make a player (or edit one, when started with { player, returnTo }): type a
 * name on the keyboard and pick an icon.
 */
export default class NewPlayerScene extends Phaser.Scene {
  constructor() {
    super('NewPlayer');
  }

  init(data) {
    this.editing = data?.player ?? null;
    this.returnTo = data?.returnTo ?? 'Players';
  }

  create() {
    drawBackground(this);
    this.icon = this.editing?.icon ?? Phaser.Utils.Array.GetRandom(ICONS);

    if (this.editing || getPlayers().length > 0) iconButton(this, 56, 52, '⬅️', () => this.scene.start(this.returnTo));
    this.add
      .text(W / 2, 60, this.editing ? 'Change your player' : 'Make your player!', {
        fontFamily: FONT,
        fontSize: '58px',
        color: COLORS.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Preview card: chosen icon + the name field.
    this.add.graphics().fillStyle(0xffffff, 0.95).fillRoundedRect(W / 2 - 320, 118, 640, 120, 34);
    this.preview = this.add.text(W / 2 - 245, 178, this.icon, { fontFamily: FONT, fontSize: '80px' }).setOrigin(0.5);
    this.nameField = textInput(this, W / 2 + 55, 178, {
      width: 470,
      height: 92,
      fontSize: 52,
      placeholder: 'Type your name',
      maxLength: MAX_NAME,
      value: this.editing?.name ?? '',
    });
    this.nameField.style.background = '#f1f1f6';
    this.nameField.setAttribute('autocapitalize', 'words');
    this.nameField.addEventListener('input', () => this.refresh());
    this.nameField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.finish();
      }
    });

    this.add
      .text(W / 2, 292, 'Pick a picture', { fontFamily: FONT, fontSize: '32px', color: COLORS.ink })
      .setOrigin(0.5);
    this.makeIconPicker();
    this.done = makeButton(this, W / 2, 610, 'Done ✓', () => this.finish(), { w: 280, h: 100, color: COLORS.green, fontSize: 44 });

    this.refresh();
    if (!this.editing) speak('Make your player! Type your name and pick a picture.');
  }

  makeIconPicker() {
    this.iconRings = [];
    ICONS.forEach((icon, i) => {
      const x = W / 2 + ((i % 8) - 3.5) * 100;
      const y = 365 + Math.floor(i / 8) * 96;
      const ring = this.add.graphics();
      const c = this.add.container(x, y, [
        ring,
        this.add.text(0, 2, icon, { fontFamily: FONT, fontSize: '54px' }).setOrigin(0.5),
      ]);
      c.setSize(86, 86).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        sfx.flip();
        this.icon = icon;
        this.tweens.add({ targets: c, scale: 1.2, yoyo: true, duration: 100 });
        this.refresh();
        this.nameField.focus();
      });
      this.iconRings.push({ icon, ring });
    });
  }

  /** Letters only, shown as "Sam" whatever case was typed. */
  cleanName() {
    const letters = this.nameField.value.replace(/[^\p{L}]/gu, '').slice(0, MAX_NAME);
    return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
  }

  refresh() {
    this.preview.setText(this.icon);
    for (const { icon, ring } of this.iconRings) {
      ring.clear();
      if (icon === this.icon) ring.lineStyle(6, COLORS.orange, 1).fillStyle(0xffffff, 1).fillCircle(0, 0, 45).strokeCircle(0, 0, 45);
      else ring.fillStyle(0xffffff, 0.6).fillCircle(0, 0, 40);
    }
    this.done.setAlpha(this.cleanName() ? 1 : 0.4);
  }

  finish() {
    const name = this.cleanName();
    if (!name) {
      sfx.wrong();
      speak('Type your name first');
      this.nameField.focus();
      return;
    }
    this.nameField.blur();
    sfx.correct();
    if (this.editing) {
      const player = updatePlayer(this.editing.id, { name, icon: this.icon });
      speak(`Hi ${player.name}!`);
      return this.scene.start(this.returnTo);
    }
    const player = addPlayer(name, this.icon);
    setCurrentPlayer(player);
    speak(`Hi ${player.name}!`);
    this.scene.start('Menu');
  }
}
