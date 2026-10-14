# Kids Web Games

Phaser 3 games for ages 6–8, with players and per-player best stars. Sounds are synthesized; the dragon art lives in `assets/dragon/source` and is turned into game assets by `tools/process_dragon.py`.

- **Missile Math**: type the answer to a missile's math problem to shoot it down before it reaches the bases.
- **Dragon Care**: copy-type food words to feed the baby dragon; it grows across rounds.
- **Balloon Math**: pop the balloon with the right answer (sums to 10, then add/subtract within 20).
- **Word Catcher**: move the basket to catch letters in order to spell the pictured word.

Grown-ups can paste a spelling list via the 💼 button on the menu; Dragon Care and Word Catcher then use only those words.

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```
