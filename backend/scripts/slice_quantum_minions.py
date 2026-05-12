#!/usr/bin/env python3
"""
Slice the user-supplied 4-col x 3-row Quantum Minion sheet into 12 PNGs
with the flat brown background flood-filled to transparency.

Naming convention used downstream:
   row 0 = phreak    (Phone/Phreak corruption evolution line)
   row 1 = vrghost   (VR Hacker -> Ghost-Summoner evolution line)
   row 2 = mech      (Cyborg/Mech evolution line)
Each row has 4 evolutionary stages, indexed 1..4 (left -> right).
"""
import os
import sys
from PIL import Image
from collections import deque

SRC = "/tmp/minion_sheet.png"
OUT = "/app/backend/static/sprites/quantum_minions"
os.makedirs(OUT, exist_ok=True)

ROW_NAMES = ["phreak", "vrghost", "mech"]
COLS = 4
ROWS = 3

# Brown background tolerance (R/G/B distance). Sheet bg ~ (74,51,38).
# We keep the slightly-darker ground-shadow ellipses by tightening this:
TOL = 35


def color_close(a, b, tol=TOL):
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol and abs(a[2] - b[2]) <= tol


def flood_remove_bg(im: Image.Image) -> Image.Image:
    """Flood-fill from the 4 corners of the cell, removing connected
    brown background pixels. Preserves character + ground shadow."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    # Sample background colour as median of the 4 corners
    samples = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = (
        sum(c[0] for c in samples) // 4,
        sum(c[1] for c in samples) // 4,
        sum(c[2] for c in samples) // 4,
    )
    visited = [[False] * h for _ in range(w)]
    q: deque = deque()
    # Seed from all 4 corners + edge midpoints
    seeds = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]
    for sx, sy in seeds:
        if not visited[sx][sy] and color_close(px[sx, sy], bg):
            q.append((sx, sy))
            visited[sx][sy] = True
    while q:
        x, y = q.popleft()
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                if color_close(px[nx, ny], bg):
                    visited[nx][ny] = True
                    q.append((nx, ny))
    return im


def autocrop(im: Image.Image, pad: int = 4) -> Image.Image:
    """Crop empty alpha border so each sprite is centred in its bounding box."""
    bbox = im.getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(im.size[0], x1 + pad)
    y1 = min(im.size[1], y1 + pad)
    return im.crop((x0, y0, x1, y1))


def main():
    sheet = Image.open(SRC).convert("RGBA")
    W, H = sheet.size
    cw, ch = W // COLS, H // ROWS
    print(f"Sheet {W}x{H}, cell {cw}x{ch}")

    for row in range(ROWS):
        for col in range(COLS):
            box = (col * cw, row * ch, (col + 1) * cw, (row + 1) * ch)
            cell = sheet.crop(box)
            cell = flood_remove_bg(cell)
            cell = autocrop(cell, pad=2)
            # Standardise to 256 max-side for consistent in-game scaling
            cell.thumbnail((256, 256), Image.NEAREST)
            stage = col + 1  # 1..4
            name = f"{ROW_NAMES[row]}_{stage}.png"
            cell.save(os.path.join(OUT, name), "PNG", optimize=True)
            print(f"  wrote {name}  ({cell.size[0]}x{cell.size[1]})")

    print("Done.")


if __name__ == "__main__":
    sys.exit(main())
