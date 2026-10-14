#!/usr/bin/env python3
"""Turn the Gemini/Veo source art in assets/dragon/source into game assets.

    python3 tools/process_dragon.py

Writes public/dragon/: room.webp (empty room, game size), one transparent
dragon-<pose>.webp per expression (all cropped to the same box so they swap
in place) and happy.mp4/.webm; plus src/dragon-layout.json (where that box sits in
the room).
Needs Pillow, numpy and ffmpeg.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/dragon/source'
OUT = ROOT / 'public/dragon'
GAME_W, GAME_H = 1280, 720

# Expression stills, all generated from Dragon_02 on flat #FF00FF magenta.
POSES = {
    'worried': 'Dragon_02.jpeg',
    'blink': 'Dragon_05.jpeg',
    'happy': 'Dragon_06.jpeg',
    'bite': 'Dragon_07.jpeg',
    'chew': 'Dragon_08.jpeg',
    'smile': 'Dragon_9.jpeg',
    'look': 'Dragon_10.jpeg',
}
MARGIN = 12  # source px kept around the dragon


def key_magenta(rgb):
    """Alpha from how magenta a pixel is, then un-mix the magenta from edges."""
    f = rgb.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    magenta = np.minimum(r, b) - g  # ~255 on the backdrop, <~40 on the dragon
    alpha = 1 - np.clip((magenta - 70) / (200 - 70), 0, 1)
    a = np.maximum(alpha, 1e-3)[..., None]
    fg = (f - (1 - a) * np.array([255, 0, 255], np.float32)) / a
    out = np.dstack([np.clip(fg, 0, 255), alpha * 255]).astype(np.uint8)
    out[alpha < 0.02] = 0
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    scale = GAME_W / Image.open(SRC / 'Dragon_01.jpeg').width

    room = Image.open(SRC / 'Dragon_01.jpeg').convert('RGB').resize((GAME_W, GAME_H), Image.LANCZOS)
    room.save(OUT / 'room.webp', quality=88)

    keyed = {name: key_magenta(np.asarray(Image.open(SRC / f).convert('RGB'))) for name, f in POSES.items()}

    # One crop box covering every pose, so the frames swap without jumping.
    union = np.zeros(next(iter(keyed.values())).shape[:2], bool)
    for k in keyed.values():
        union |= k[..., 3] > 20
    # Ignore specks (JPEG noise in corners): keep rows/cols with real content.
    ys = np.where(union.sum(1) >= 6)[0]
    xs = np.where(union.sum(0) >= 6)[0]
    h, w = union.shape
    box = (max(0, xs.min() - MARGIN), max(0, ys.min() - MARGIN), min(w, xs.max() + MARGIN), min(h, ys.max() + MARGIN))
    size = (round((box[2] - box[0]) * scale), round((box[3] - box[1]) * scale))

    for name, k in keyed.items():
        Image.fromarray(k, 'RGBA').crop(box).resize(size, Image.LANCZOS).save(OUT / f'dragon-{name}.webp', quality=90)

    meta = {'x': round(box[0] * scale), 'y': round(box[1] * scale), 'width': size[0], 'height': size[1]}
    (ROOT / 'src/dragon-layout.json').write_text(json.dumps(meta, indent=2) + '\n')

    subprocess.run(
        ['ffmpeg', '-v', 'error', '-y', '-i', str(SRC / 'dragon_happy.mp4'),
         '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-pix_fmt', 'yuv420p',
         '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', str(OUT / 'happy.mp4')],
        check=True,
    )
    # WebM too: browsers without H.264 (e.g. open-source Chromium) play VP9.
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-y', '-i', str(SRC / 'dragon_happy.mp4'),
         '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-row-mt', '1',
         '-c:a', 'libopus', '-b:a', '80k', str(OUT / 'happy.webm')],
        check=True,
    )
    print('dragon box', meta)
    for p in sorted(OUT.iterdir()):
        print(f'{p.name:24} {p.stat().st_size // 1024:6} KB')


if __name__ == '__main__':
    main()
