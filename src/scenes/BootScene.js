import Phaser from 'phaser';

/** Draws every texture in code so the game ships with no image files. */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const g = this.add.graphics();

    // Balloon: light-gray body so tinting gives a shaded look, white highlight.
    g.fillStyle(0xdddddd, 1).fillEllipse(60, 70, 104, 128);
    g.fillTriangle(50, 142, 70, 142, 60, 130);
    g.fillStyle(0xffffff, 1).fillEllipse(38, 44, 22, 36);
    g.lineStyle(3, 0x888888, 1);
    g.beginPath();
    g.moveTo(60, 142);
    g.lineTo(54, 165);
    g.lineTo(66, 185);
    g.lineTo(60, 200);
    g.strokePath();
    g.generateTexture('balloon', 120, 200);

    // Star (white so it can be tinted).
    g.clear().fillStyle(0xffffff, 1);
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 42 : 18;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push({ x: 44 + Math.cos(a) * r, y: 46 + Math.sin(a) * r });
    }
    g.fillPoints(pts, true);
    g.generateTexture('star', 88, 88);

    // Particle dot.
    g.clear().fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
    g.generateTexture('spark', 16, 16);

    // Cloud.
    g.clear().fillStyle(0xffffff, 1);
    g.fillCircle(60, 60, 38).fillCircle(100, 45, 45).fillCircle(145, 62, 35).fillRoundedRect(25, 60, 150, 36, 18);
    g.generateTexture('cloud', 200, 100);

    // Basket.
    g.clear();
    g.fillStyle(0xb5651d, 1).fillPoints(
      [
        { x: 6, y: 22 },
        { x: 174, y: 22 },
        { x: 152, y: 98 },
        { x: 28, y: 98 },
      ],
      true,
    );
    g.lineStyle(4, 0x8a4a12, 1);
    for (let y = 42; y < 98; y += 18) g.lineBetween(14 + (y - 22) * 0.28, y, 166 - (y - 22) * 0.28, y);
    for (let x = 40; x < 160; x += 28) g.lineBetween(x, 24, x + (90 - x) * 0.2, 96);
    g.fillStyle(0xd98b3a, 1).fillRoundedRect(0, 10, 180, 18, 9);
    g.generateTexture('basket', 180, 100);

    g.destroy();
    this.scene.start('Menu');
  }
}
