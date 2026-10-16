import Phaser from 'phaser';
import { W, H } from './theme.js';
import BootScene from './scenes/BootScene.js';
import PlayerScene from './scenes/PlayerScene.js';
import NewPlayerScene from './scenes/NewPlayerScene.js';
import MenuScene from './scenes/MenuScene.js';
import MissileScene from './scenes/MissileScene.js';
import DragonScene from './scenes/DragonScene.js';
import RaceScene from './scenes/RaceScene.js';
import FrogScene from './scenes/FrogScene.js';
import WordsScene from './scenes/WordsScene.js';
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
  // DOM container lets scenes place real <input> fields, which bring up a
  // tablet's on-screen keyboard.
  dom: { createContainer: true },
  scene: [BootScene, PlayerScene, NewPlayerScene, MenuScene, MissileScene, DragonScene, RaceScene, FrogScene, BalloonScene, WordScene, WordsScene],
});

// Handy for poking at scenes from the console during development.
if (import.meta.env.DEV) window.__game = game;
