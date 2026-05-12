#!/usr/bin/env python3
"""
V2 slicer for the magenta-keyed minion sheet.

Same output paths as v1 (phreak/vrghost/mech_1..4) so the
DynamicMinionRenderer lookup keeps working without any code change.

V2 differences vs v1:
  - Background key is MAGENTA (~RGB 178,90,130) instead of brown.
  - Flood-fill seeds + per-pixel tolerance tuned for the cleaner key.
  - Bumps cache buster from v1 -> v2 in the renderer so devices refetch.
"""
import os
import sys
from PIL import Image
from collections import deque

SRC = "/tmp/minion_v2.png"
OUT = "/app/backend/static/sprites/quantum_minions"
os.makedirs(OUT, exist_ok=True)

ROW_NAMES = ["phreak", "vrghost", "mech"]
COLS = 3   # 3 evolution LINES (= columns in the sheet)
ROWS = 4   # 4 evolution STAGES (= rows in the sheet, top to bottom)

# Magenta key tolerance — keep tight so dark sprite pixels survive.
TOL = 45


def color_close(a, b, tol=TOL):
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol and abs(a[2] - b[2]) <= tol


def flood_remove_bg(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    samples = [px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3],
               px[w // 2, 2], px[2, h // 2]]
    bg = (
        sum(c[0] for c in samples) // 6,
        sum(c[1] for c in samples) // 6,
        sum(c[2] for c in samples) // 6,
    )
    visited = [[False] * h for _ in range(w)]
    q = deque()
    # Seed from full perimeter every 8 px so any thin grid line bleeds through.
    for x in range(0, w, 8):
        for y_seed in (0, h - 1):
            if color_close(px[x, y_seed], bg):
                q.append((x, y_seed))
                visited[x][y_seed] = True
    for y in range(0, h, 8):
        for x_seed in (0, w - 1):
            if color_close(px[x_seed, y], bg):
                q.append((x_seed, y))
                visited[x_seed][y] = True
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


def autocrop(im: Image.Image, pad: int = 2) -> Image.Image:
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

    # Iterate the sheet column-major: each COLUMN is one evolution line
    # (phreak/vrghost/mech) and each ROW within that column is one of the
    # 4 evolutionary stages. Output filenames stay phreak/vrghost/mech_1..4
    # so DynamicMinionRenderer's SPECIES_LINE_MAP needs no code change.
    for col in range(COLS):           # 0..2 -> ROW_NAMES[col]
        for row in range(ROWS):       # 0..3 -> stage (row+1)
            box = (col * cw, row * ch, (col + 1) * cw, (row + 1) * ch)
            cell = sheet.crop(box)
            cell = flood_remove_bg(cell)
            cell = autocrop(cell, pad=3)
            # Standardise to 256 max side for consistent on-screen scaling.
            cell.thumbnail((256, 256), Image.NEAREST)
            stage = row + 1
            name = f"{ROW_NAMES[col]}_{stage}.png"
            cell.save(os.path.join(OUT, name), "PNG", optimize=True)
            print(f"  wrote {name}  ({cell.size[0]}x{cell.size[1]})")
    print("Done.")


if __name__ == "__main__":
    sys.exit(main())
