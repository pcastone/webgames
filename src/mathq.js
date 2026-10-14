import Phaser from 'phaser';

/** Easy: sums to 10. Hard: add or subtract within 20. */
export function makeQuestion(hard) {
  const { Between } = Phaser.Math;
  if (!hard) {
    const a = Between(1, 9);
    const b = Between(1, 10 - a);
    return { a, b, op: '+', answer: a + b };
  }
  if (Math.random() < 0.5) {
    const a = Between(2, 15);
    const b = Between(1, 20 - a);
    return { a, b, op: '+', answer: a + b };
  }
  const a = Between(5, 20);
  const b = Between(1, a);
  return { a, b, op: '−', answer: a - b };
}
