import Phaser from 'phaser';
import { W, H } from './theme.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import MemoryScene from './scenes/MemoryScene.js';
import BalloonScene from './scenes/BalloonScene.js';
import WordScene from './scenes/WordScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#8fd3ff',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  scene: [BootScene, MenuScene, MemoryScene, BalloonScene, WordScene],
});

// Handy for poking at scenes from the console during development.
if (import.meta.env.DEV) window.__game = game;
