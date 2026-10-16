import Phaser from 'phaser';
import { W, FONT, COLORS } from '../theme.js';
import { drawBackground, iconButton, makeButton } from '../ui.js';
import {
  getSpellingWords, parseWords, saveSpellingWords, MAX_WORD,
  getRaceSentences, parseSentences, saveRaceSentences, MAX_SENTENCE,
} from '../spelling.js';

const TABS = {
  words: {
    label: 'Spelling words',
    games: 'Dragon Care, Word Catcher and Frog Hop',
    placeholder: 'One word per line, or separated by commas\n\napple\nfriend\nbecause',
    rule: `Letters only, 2–${MAX_WORD} letters per word.`,
    parse: parseWords,
    load: () => getSpellingWords().map((w) => w.toLowerCase()).join('\n'),
    save: saveSpellingWords,
    noun: 'word',
    show: (items) => items.map((w) => w.toLowerCase()).join(' · '),
  },
  sentences: {
    label: 'Race sentences',
    games: 'Grand Prix',
    placeholder: 'One sentence per line\n\nThe cat sat on the mat.\nI like to read books.',
    rule: `One per line, up to ${MAX_SENTENCE} characters.`,
    parse: parseSentences,
    load: () => getRaceSentences().join('\n'),
    save: saveRaceSentences,
    noun: 'sentence',
    show: (items) => items.join('\n'),
  },
};

/** Parent page: paste this week's spelling words and race sentences. */
export default class WordsScene extends Phaser.Scene {
  constructor() {
    super('Words');
  }

  init(data) {
    this.tab = data?.tab ?? 'words';
  }

  create() {
    drawBackground(this, { grass: false });
    // Games that use arrow keys capture Space/arrows globally; free them for typing.
    this.input.keyboard?.clearCaptures();
    iconButton(this, 56, 52, '⬅️', () => this.scene.start('Menu'));

    this.add
      .text(W / 2, 48, '💼 For grown-ups', { fontFamily: FONT, fontSize: '48px', color: COLORS.ink, fontStyle: 'bold' })
      .setOrigin(0.5);

    // One text box per tab; only the active one is shown.
    this.boxes = {};
    for (const [key, tab] of Object.entries(TABS)) {
      const box = document.createElement('textarea');
      box.value = tab.load();
      box.placeholder = tab.placeholder;
      box.spellcheck = false;
      Object.assign(box.style, {
        width: '600px',
        height: '500px',
        boxSizing: 'border-box',
        padding: '16px 20px',
        border: '4px solid #8e6cff',
        borderRadius: '24px',
        outline: 'none',
        resize: 'none',
        background: '#ffffff',
        color: COLORS.ink,
        fontFamily: FONT,
        fontSize: key === 'words' ? '30px' : '24px',
        lineHeight: '1.35',
      });
      this.add.dom(350, 410, box);
      box.addEventListener('input', () => this.refresh());
      this.boxes[key] = box;
    }

    this.tabButtons = Object.entries(TABS).map(([key, tab], i) => {
      const c = this.add.container(W / 2 - 150 + i * 300, 112);
      const bg = this.add.graphics();
      const txt = this.add.text(0, 0, tab.label, { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold' }).setOrigin(0.5);
      c.add([bg, txt]).setSize(280, 50).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => this.switchTab(key));
      return { key, bg, txt };
    });

    // Live preview of what will be saved.
    this.add.graphics().fillStyle(0xffffff, 0.85).fillRoundedRect(690, 160, 560, 400, 24);
    this.countText = this.add.text(720, 178, '', { fontFamily: FONT, fontSize: '28px', color: COLORS.ink, fontStyle: 'bold' });
    this.usedBy = this.add.text(720, 216, '', { fontFamily: FONT, fontSize: '20px', color: '#6c6f85' });
    this.listText = this.add.text(720, 252, '', { fontFamily: FONT, fontSize: '22px', color: '#4a4e69', wordWrap: { width: 500 }, lineSpacing: 6 });
    this.ruleText = this.add.text(720, 532, '', { fontFamily: FONT, fontSize: '20px', color: '#6c6f85' }).setOrigin(0, 0.5);

    makeButton(this, 830, 630, 'Save', () => this.saveAndExit(), { w: 240, h: 84, color: COLORS.green });
    makeButton(this, 1110, 630, 'Clear', () => this.clear(), { w: 240, h: 84, color: COLORS.pink });

    this.switchTab(this.tab);
  }

  switchTab(key) {
    this.tab = key;
    for (const [k, box] of Object.entries(this.boxes)) box.style.display = k === key ? 'block' : 'none';
    for (const { key: k, bg, txt } of this.tabButtons) {
      const on = k === key;
      bg.clear().fillStyle(on ? COLORS.purple : 0xffffff, on ? 1 : 0.8).fillRoundedRect(-140, -25, 280, 50, 25);
      txt.setColor(on ? '#ffffff' : COLORS.ink);
    }
    this.ruleText.setText(TABS[key].rule);
    this.usedBy.setText(`Used by ${TABS[key].games}, instead of the built-in ones.`);
    this.refresh();
    this.time.delayedCall(30, () => this.boxes[key].focus());
  }

  refresh() {
    const tab = TABS[this.tab];
    const items = tab.parse(this.boxes[this.tab].value);
    const n = items.length;
    this.countText.setText(n ? `${n} ${tab.noun}${n === 1 ? '' : 's'} found` : `No ${tab.noun}s yet`);
    const limit = this.tab === 'words' ? 40 : 8;
    this.listText.setText(tab.show(items.slice(0, limit)) + (n > limit ? `\n+${n - limit} more` : ''));
  }

  clear() {
    this.boxes[this.tab].value = '';
    this.refresh();
    this.boxes[this.tab].focus();
  }

  /** Saves both tabs. */
  saveAndExit() {
    for (const [key, tab] of Object.entries(TABS)) tab.save(tab.parse(this.boxes[key].value));
    this.scene.start('Menu');
  }
}
