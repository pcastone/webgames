import Phaser from 'phaser';
import { W, H, FONT, COLORS } from '../theme.js';
import { homeButton, iconButton, showResult, textInput } from '../ui.js';
import { sfx, speak, isMuted } from '../sound.js';
import { loadPlayerData, savePlayerData } from '../storage.js';
import { pickSpellingWords } from '../spelling.js';
import DRAGON from '../dragon-layout.json';

// Words to copy, grouped by length so the dragon's level sets the challenge.
const FOODS = [
  ['EGG', '🥚'], ['PIE', '🥧'], ['HAM', '🍖'], ['NUT', '🥜'],
  ['CORN', '🌽'], ['CAKE', '🍰'], ['FISH', '🐟'], ['MILK', '🥛'], ['PEAR', '🍐'], ['RICE', '🍚'], ['TACO', '🌮'],
  ['APPLE', '🍎'], ['BREAD', '🍞'], ['GRAPE', '🍇'], ['PIZZA', '🍕'], ['MELON', '🍈'], ['LEMON', '🍋'], ['PEACH', '🍑'],
  ['CHEESE', '🧀'], ['CARROT', '🥕'], ['BANANA', '🍌'], ['COOKIE', '🍪'],
];
const POSES = ['worried', 'blink', 'happy', 'bite', 'chew', 'smile', 'look'];
const TUMMY = 8; // foods per round
const FOODS_PER_LEVEL = 16; // two full tummies grow the dragon one level
const MAX_LEVEL = 6;
const MOUTH = { x: 566, y: 488 }; // in the room image, at level-1 size
const BOWL = { x: 456, y: 622 };
const TORCHES = [{ x: 823, y: 140 }, { x: 1222, y: 50 }];

const levelFor = (fed) => Math.min(MAX_LEVEL, 1 + Math.floor(fed / FOODS_PER_LEVEL));
const maxLetters = (level) => (level === 1 ? 4 : level === 2 ? 5 : 6);
/** A stable food picture for a spelling word, so "friend" is always the same treat. */
const foodFor = (word) => FOODS[[...word].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % FOODS.length][1];

/**
 * Dragon Care: copy-type the food's name to feed the baby dragon. Fill its
 * tummy to finish a round; every two rounds the dragon grows a level, and
 * bigger dragons ask for longer words.
 */
export default class DragonScene extends Phaser.Scene {
  constructor() {
    super('Dragon');
  }

  preload() {
    const loading = this.add
      .text(W / 2, H / 2, 'Waking the dragon…', { fontFamily: FONT, fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5);
    this.load.on('complete', () => loading.destroy());
    if (!this.textures.exists('room')) this.load.image('room', 'dragon/room.webp');
    for (const p of POSES) if (!this.textures.exists(`dragon-${p}`)) this.load.image(`dragon-${p}`, `dragon/dragon-${p}.webp`);
    // Phaser's loader throws when no listed format is playable, so check first.
    const { webm, h264 } = this.sys.game.device.video;
    if (!this.cache.video.exists('dragonHappy') && (webm || h264)) {
      this.load.video('dragonHappy', [...(webm ? ['dragon/happy.webm'] : []), ...(h264 ? ['dragon/happy.mp4'] : [])]);
    }
  }

  create() {
    this.stats = loadPlayerData('dragon', { fed: 0 });
    this.level = levelFor(this.stats.fed);
    this.eaten = 0;
    this.mistakes = 0;
    this.busy = false;
    this.done = false;

    this.add.image(0, 0, 'room').setOrigin(0);
    this.makeAmbience();
    this.makeDragon();
    this.makeHud();
    this.makeWordPanel();
    homeButton(this);

    // The parent's spelling list wins; otherwise food words sized to the level.
    const custom = pickSpellingWords(TUMMY);
    if (custom.length) {
      this.words = custom.map((w) => [w, foodFor(w)]);
    } else {
      const pool = FOODS.filter(([w]) => w.length <= maxLetters(this.level));
      this.words = Phaser.Utils.Array.Shuffle([...pool]).slice(0, TUMMY);
    }
    this.time.delayedCall(400, () => this.nextWord());
  }

  wait(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  // ---- Scene dressing -----------------------------------------------------

  makeAmbience() {
    for (const t of TORCHES) {
      const glow = this.add.image(t.x, t.y, 'boom').setTint(0xffa040).setAlpha(0.22).setScale(1.3).setBlendMode(Phaser.BlendModes.ADD);
      const flicker = () =>
        this.tweens.add({
          targets: glow,
          alpha: Phaser.Math.FloatBetween(0.12, 0.3),
          scale: Phaser.Math.FloatBetween(1.15, 1.45),
          duration: Phaser.Math.Between(90, 220),
          onComplete: flicker,
        });
      flicker();
    }
    // Dust drifting in the window light.
    this.add.particles(0, 0, 'spark', {
      x: { min: 470, max: 640 },
      y: { min: 60, max: 420 },
      lifespan: 6000,
      speedX: { min: -6, max: 6 },
      speedY: { min: 4, max: 14 },
      scale: { min: 0.12, max: 0.3 },
      alpha: { onUpdate: (particle, key, t) => Math.sin(t * Math.PI) * 0.6 },
      frequency: 260,
      blendMode: 'ADD',
    });
  }

  makeDragon() {
    // Scale from the feet so a growing dragon stays on the floor.
    this.footX = DRAGON.x + DRAGON.width / 2;
    this.footY = DRAGON.y + DRAGON.height;
    this.dragon = this.add.container(this.footX, this.footY);
    const shadow = this.add.ellipse(0, -14, DRAGON.width * 0.75, 46, 0x000000, 0.28);
    this.dragonImg = this.add.image(0, 0, 'dragon-worried').setOrigin(0.5, 1);
    this.dragon.add([shadow, this.dragonImg]);
    this.applyGrowth(false);

    // Breathing.
    this.tweens.add({ targets: this.dragonImg, scaleY: 1.018, scaleX: 0.995, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.pose = 'worried';
    this.scheduleBlink();
  }

  growthScale(level = this.level) {
    return 0.9 + (level - 1) * 0.06;
  }

  applyGrowth(animate) {
    const s = this.growthScale();
    if (animate) this.tweens.add({ targets: this.dragon, scale: s, duration: 900, ease: 'Back.easeOut' });
    else this.dragon.setScale(s);
  }

  /** Where the dragon's mouth is now, accounting for its size. */
  mouth() {
    const s = this.dragon.scale;
    return { x: this.footX + (MOUTH.x - this.footX) * s, y: this.footY + (MOUTH.y - this.footY) * s };
  }

  setPose(name) {
    this.pose = name;
    this.dragonImg.setTexture(`dragon-${name}`);
  }

  scheduleBlink() {
    this.time.delayedCall(Phaser.Math.Between(2200, 4800), () => {
      if (this.pose === 'worried') {
        this.dragonImg.setTexture('dragon-blink');
        this.time.delayedCall(140, () => this.pose === 'worried' && this.dragonImg.setTexture('dragon-worried'));
      }
      this.scheduleBlink();
    });
  }

  // ---- HUD ----------------------------------------------------------------

  makeHud() {
    this.add.graphics().fillStyle(0x000000, 0.4).fillRoundedRect(W - 210, 18, 192, 64, 32);
    this.levelText = this.add
      .text(W - 114, 50, '', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);

    // Tummy meter on the right edge.
    this.add.graphics().fillStyle(0x000000, 0.4).fillRoundedRect(W - 92, 220, 64, 360, 32);
    this.tummyFill = this.add.graphics();
    this.add.text(W - 60, 196, '😋', { fontSize: '40px' }).setOrigin(0.5);
    this.add
      .text(W - 60, 606, 'Tummy', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.updateHud();
  }

  updateHud() {
    this.levelText.setText(`🐉 Level ${this.level}`);
    const h = (340 * this.eaten) / TUMMY;
    this.tummyFill.clear().fillStyle(COLORS.orange, 1);
    if (h > 0) this.tummyFill.fillRoundedRect(W - 82, 570 - h, 44, h, Math.min(22, h / 2));
  }

  // ---- Word to copy -------------------------------------------------------

  makeWordPanel() {
    this.add.graphics().fillStyle(0xffffff, 0.92).fillRoundedRect(W / 2 - 330, 16, 660, 184, 32);
    this.foodIcon = this.add.text(W / 2 - 250, 108, '', { fontFamily: FONT, fontSize: '96px' }).setOrigin(0.5);
    this.letters = this.add.container(W / 2 + 60, 64);
    this.field = textInput(this, W / 2 + 60, 152, { width: 360, height: 70, fontSize: 46, placeholder: 'Type it!', maxLength: 8 });
    this.field.style.background = '#f1f1f6';
    this.field.setAttribute('autocapitalize', 'characters');
    this.field.addEventListener('input', () => this.onType());
    this.input.on('pointerup', () => !this.done && this.field.focus());
  }

  nextWord() {
    [this.word, this.emoji] = this.words[this.eaten];
    this.typedOk = 0;
    this.foodIcon.setText(this.emoji).setScale(0.3);
    this.tweens.add({ targets: this.foodIcon, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.letters.removeAll(true);
    // Long spelling words shrink to fit the panel.
    const step = Math.min(58, 520 / this.word.length);
    const size = Math.round(Math.min(64, step * 1.1));
    [...this.word].forEach((ch, i) => {
      this.letters.add(
        this.add
          .text((i - (this.word.length - 1) / 2) * step, 0, ch, { fontFamily: FONT, fontSize: `${size}px`, color: COLORS.ink, fontStyle: 'bold' })
          .setOrigin(0.5),
      );
    });
    this.field.value = '';
    this.field.maxLength = this.word.length + 2;
    this.lastLength = 0;
    this.field.focus();
    speak(this.word.toLowerCase());
    this.busy = false;
  }

  /** Colour each letter: green when typed right, red where it differs. */
  onType() {
    if (this.busy) {
      this.field.value = '';
      return;
    }
    const typed = this.field.value.toUpperCase().replace(/[’‘]/g, "'").replace(/[^\p{L}']/gu, '');
    this.field.value = typed;
    let ok = 0;
    while (ok < typed.length && typed[ok] === this.word[ok]) ok++;
    this.letters.list.forEach((t, i) => {
      if (i < ok) t.setColor('#2a9d3a');
      else if (i < typed.length) t.setColor('#e63946');
      else t.setColor(COLORS.ink);
    });

    if (typed.length > ok && typed.length > (this.lastLength ?? 0)) {
      this.mistakes++;
      sfx.wrong();
      this.tweens.killTweensOf(this.letters);
      this.letters.x = W / 2 + 60;
      this.tweens.add({ targets: this.letters, x: this.letters.x + 8, duration: 50, yoyo: true, repeat: 2 });
    } else if (ok > this.typedOk) {
      sfx.click();
    }
    this.typedOk = ok;
    this.lastLength = typed.length;
    if (typed === this.word) this.feed();
  }

  // ---- Feeding ------------------------------------------------------------

  async feed() {
    this.busy = true;
    this.lastLength = 0;
    sfx.correct();
    this.letters.list.forEach((t) => this.tweens.add({ targets: t, y: -10, duration: 120, yoyo: true }));

    // Food drops from the panel into the bowl; the dragon notices.
    const food = this.add.text(this.foodIcon.x, this.foodIcon.y, this.emoji, { fontSize: '96px' }).setOrigin(0.5).setDepth(50);
    this.foodIcon.setText('');
    this.tweens.add({ targets: food, x: BOWL.x, duration: 650, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: food, y: BOWL.y - 30, scale: 0.75, duration: 650, ease: 'Back.easeIn' });
    this.setPose('look');
    await this.wait(750);

    // Big bite, then chew.
    this.setPose('bite');
    const m = this.mouth();
    this.tweens.add({ targets: food, x: m.x, y: m.y, scale: 0.35, duration: 260, ease: 'Quad.easeIn' });
    await this.wait(260);
    food.destroy();
    sfx.pop();
    for (let i = 0; i < 3; i++) {
      this.setPose('chew');
      await this.wait(230);
      this.setPose('smile');
      await this.wait(230);
    }
    this.setPose('happy');
    this.hearts();
    this.eaten++;
    this.updateHud();
    await this.wait(900);

    if (this.eaten >= TUMMY) return this.finish();
    this.setPose('worried');
    this.nextWord();
  }

  hearts() {
    const m = this.mouth();
    for (let i = 0; i < 5; i++) {
      const h = this.add
        .text(m.x + Phaser.Math.Between(-60, 120), m.y - 60, Phaser.Utils.Array.GetRandom(['❤️', '💛', '💖']), { fontSize: '36px' })
        .setOrigin(0.5)
        .setDepth(60)
        .setScale(0);
      this.tweens.add({ targets: h, scale: 1, delay: i * 90, duration: 200, ease: 'Back.easeOut' });
      this.tweens.add({ targets: h, y: h.y - 140, alpha: 0, delay: 200 + i * 90, duration: 900, onComplete: () => h.destroy() });
    }
  }

  // ---- End of round -------------------------------------------------------

  async finish() {
    this.done = true;
    this.field.blur();
    this.field.style.display = 'none'; // DOM sits above the canvas; keep it off the results panel

    const before = this.level;
    this.stats.fed += TUMMY;
    savePlayerData('dragon', this.stats);
    this.level = levelFor(this.stats.fed);
    const grew = this.level > before;
    if (grew) {
      this.applyGrowth(true);
      this.updateHud();
    }
    speak(grew ? 'Your dragon grew!' : 'Yum! My tummy is full!');
    await this.wait(1600);

    await this.playCelebration();

    const toNext = FOODS_PER_LEVEL - (this.stats.fed % FOODS_PER_LEVEL);
    const extra = grew
      ? `Your dragon grew to level ${this.level}!`
      : this.level < MAX_LEVEL
        ? `${toNext} more foods to grow`
        : 'Your dragon is all grown up!';
    const stars = this.mistakes <= 2 ? 3 : this.mistakes <= 6 ? 2 : 1;
    showResult(this, 'Dragon', stars, extra);
  }

  /** The happy-dragon video as the round's bookend; tap to skip. */
  playCelebration() {
    if (!this.cache.video.exists('dragonHappy')) return Promise.resolve();
    return new Promise((resolve) => {
      let finished = false;
      const video = this.add.video(W / 2, H / 2, 'dragonHappy').setDepth(900);
      const skip = this.add
        .text(W - 30, H - 24, 'Tap to skip ⏭', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5 })
        .setOrigin(1, 1)
        .setDepth(901);
      const catcher = this.add.zone(W / 2, H / 2, W, H).setInteractive().setDepth(902);
      const end = () => {
        if (finished) return;
        finished = true;
        video.stop();
        this.tweens.add({ targets: [video, skip], alpha: 0, duration: 300, onComplete: () => { video.destroy(); skip.destroy(); } });
        catcher.destroy();
        resolve();
      };
      video.setMute(isMuted());
      video.on('complete', end);
      catcher.on('pointerup', end);
      this.time.delayedCall(11000, end); // never get stuck if playback is blocked
      video.setAlpha(0).play();
      this.tweens.add({ targets: video, alpha: 1, duration: 400 });
    });
  }
}
