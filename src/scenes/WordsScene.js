import Phaser from 'phaser';
import { W, FONT, COLORS } from '../theme.js';
import { drawBackground, iconButton, makeButton } from '../ui.js';
import { getSpellingWords, parseWords, saveSpellingWords, MAX_WORD } from '../spelling.js';

/** Parent page: paste this week's spelling words. */
export default class WordsScene extends Phaser.Scene {
  constructor() {
    super('Words');
  }

  create() {
    drawBackground(this, { grass: false });
    // Games that use arrow keys capture Space/arrows globally; free them for typing.
    this.input.keyboard?.clearCaptures();
    iconButton(this, 56, 52, '⬅️', () => this.scene.start('Menu'));

    this.add
      .text(W / 2, 52, '💼 Spelling Words', { fontFamily: FONT, fontSize: '52px', color: COLORS.ink, fontStyle: 'bold' })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 112, "For grown-ups: paste this week's spelling words. Dragon Care and Word Catcher will use only these.", {
        fontFamily: FONT,
        fontSize: '22px',
        color: COLORS.ink,
      })
      .setOrigin(0.5);

    this.box = document.createElement('textarea');
    this.box.value = getSpellingWords().map((w) => w.toLowerCase()).join('\n');
    this.box.placeholder = 'One word per line, or separated by commas\n\napple\nfriend\nbecause';
    this.box.spellcheck = false;
    Object.assign(this.box.style, {
      width: '600px',
      height: '480px',
      boxSizing: 'border-box',
      padding: '16px 20px',
      border: '4px solid #8e6cff',
      borderRadius: '24px',
      outline: 'none',
      resize: 'none',
      background: '#ffffff',
      color: COLORS.ink,
      fontFamily: FONT,
      fontSize: '30px',
      lineHeight: '1.35',
    });
    this.add.dom(350, 400, this.box);
    this.box.addEventListener('input', () => this.refresh());
    this.time.delayedCall(60, () => this.box.focus());

    // Live preview of what will be saved.
    this.add.graphics().fillStyle(0xffffff, 0.85).fillRoundedRect(690, 160, 560, 400, 24);
    this.countText = this.add.text(720, 180, '', { fontFamily: FONT, fontSize: '30px', color: COLORS.ink, fontStyle: 'bold' });
    this.listText = this.add.text(720, 228, '', {
      fontFamily: FONT,
      fontSize: '24px',
      color: '#4a4e69',
      wordWrap: { width: 500 },
      lineSpacing: 6,
    });
    this.add
      .text(720, 532, `Letters only, 2–${MAX_WORD} letters per word.`, { fontFamily: FONT, fontSize: '20px', color: '#6c6f85' })
      .setOrigin(0, 0.5);

    makeButton(this, 830, 630, 'Save', () => this.saveAndExit(), { w: 240, h: 84, color: COLORS.green });
    makeButton(this, 1110, 630, 'Clear', () => this.clear(), { w: 240, h: 84, color: COLORS.pink });

    this.refresh();
  }

  refresh() {
    const words = parseWords(this.box.value);
    this.countText.setText(words.length ? `${words.length} word${words.length === 1 ? '' : 's'} found` : 'No words yet');
    const shown = words.slice(0, 40).map((w) => w.toLowerCase());
    this.listText.setText(shown.join(' · ') + (words.length > 40 ? `  +${words.length - 40} more` : ''));
  }

  clear() {
    this.box.value = '';
    this.refresh();
    this.box.focus();
  }

  saveAndExit() {
    saveSpellingWords(parseWords(this.box.value));
    this.scene.start('Menu');
  }
}
