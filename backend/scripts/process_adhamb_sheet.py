"""
Process the user-supplied ADHAMB walking spritesheet into 12 game-ready frames.

Input:  /tmp/sheet_raw.png  (1024×1536 RGBA, 4 cols × 5 rows, dashed cyan grid,
                              black background)
Layout (rows top→bottom, cols left→right):
    row 0:  [DOWN label]  [d0]  [d1]  [d2]
    row 1:  [UP   label]  [u0]  [u1]  [u2]
    row 2:  [LEFT label]  [l0]  [l1]  [l2]
    row 3:  [LEFT label – duplicate, IGNORE]
    row 4:  [R1GHT label – frames cropped off, IGNORE → mirror from LEFT]

Output: /app/backend/static/sprites/adhamb_sheet/<dir>_<frame>.png    where
        dir   ∈ { down, up, left, right }
        frame ∈ { 0 (idle), 1 (left-step), 2 (right-step) }

Each output PNG:
    * 100% transparent background (black is keyed out + soft alpha clean-up)
    * uniform size across all 12 frames (square cell, sprite centred)
    * crisp edges (nearest-neighbour later in the renderer)
"""
from __future__ import annotations
import os
from pathlib import Path
from PIL import Image
import numpy as np

# ── Source / output ──────────────────────────────────────────────────────
SRC = "/tmp/sheet_raw.png"
OUT_DIR = Path("/app/backend/static/sprites/adhamb_sheet")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Cell grid ────────────────────────────────────────────────────────────
SHEET_W, SHEET_H = 1024, 1536
COLS = 4              # label + 3 frames
ROWS = 5              # DOWN, UP, LEFT, (dup), RIGHT(cut)
CELL_W = SHEET_W // COLS    # 256
CELL_H = SHEET_H // ROWS    # 307

# Map "logical row index" → row in the sheet.
# NOTE: the user-supplied source row labelled "LEFT" actually shows the character
# facing RIGHT (sheet labelling bug). We treat it as the canonical RIGHT-facing
# frames and generate LEFT by horizontal mirroring below.
ROW_INDEX = {"down": 0, "up": 1, "right": 2}     # 'left' is mirrored from 'right'


def cell_bbox(col: int, row: int) -> tuple[int, int, int, int]:
    """Return the pixel bbox of cell (col,row), 0-indexed.
    Inset by `INSET` px on every side so the dashed cyan grid lines that ride
    along the cell boundaries are NOT captured during cropping (they were
    showing up as a faint dotted box around the sprite previously)."""
    INSET = 14
    return (
        col * CELL_W + INSET,
        row * CELL_H + INSET,
        (col + 1) * CELL_W - INSET,
        (row + 1) * CELL_H - INSET,
    )


def crop_cell(im: Image.Image, col: int, row: int) -> Image.Image:
    return im.crop(cell_bbox(col, row))


# ── Black-background → transparent ───────────────────────────────────────
def key_black(rgba: Image.Image, hard: int = 28, soft: int = 70) -> Image.Image:
    """
    Pixels darker than `hard` (per channel) become fully transparent.
    Pixels with brightness between `hard` and `soft` get partial alpha so the
    silhouette stays anti-aliased rather than jaggy.

    Also kills any leftover **dashed cyan grid pixels** (the ones that ride the
    cell borders in the source sheet) — these are saturated teal/cyan with very
    low red, so we detect them by `b > 90 and r < 80` and zero their alpha.
    """
    a = np.array(rgba.convert("RGBA")).astype(np.int32)
    r, g, b, _ = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    bright = np.maximum(np.maximum(r, g), b)
    # Black keyout
    new_alpha = np.where(
        bright <= hard,
        0,
        np.where(
            bright >= soft,
            255,
            ((bright - hard) * 255 // max(soft - hard, 1)).clip(0, 255),
        ),
    ).astype(np.int32)
    # Cyan-grid keyout — kills dashed border remnants without touching the
    # character's cyan visor (visor has higher red and is smaller/contained).
    cyan_mask = (b > 90) & (r < 80) & (g > 90)
    new_alpha = np.where(cyan_mask, 0, new_alpha)
    a[..., 3] = new_alpha.astype(np.uint8)
    return Image.fromarray(a.astype(np.uint8), mode="RGBA")


# ── Tight bbox of the visible (non-transparent) sprite ───────────────────
def sprite_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    a = np.array(im.convert("RGBA"))[..., 3]
    rows = np.any(a > 8, axis=1)
    cols = np.any(a > 8, axis=0)
    if not rows.any() or not cols.any():
        return (0, 0, im.size[0], im.size[1])
    y0, y1 = np.where(rows)[0][[0, -1]]
    x0, x1 = np.where(cols)[0][[0, -1]]
    return (int(x0), int(y0), int(x1) + 1, int(y1) + 1)


# ── Centre sprite into a square canvas of given size ────────────────────
def fit_into(im: Image.Image, target: int, padding: int = 6) -> Image.Image:
    """
    Crop `im` to its sprite bbox, then paste centred into a `target`×`target`
    transparent canvas (with `padding` px breathing room).
    """
    bx, by, bx2, by2 = sprite_bbox(im)
    cropped = im.crop((bx, by, bx2, by2))
    cw, ch = cropped.size
    inner = target - 2 * padding
    # Scale only if it would overflow; preserve nearest-neighbour resampling for crisp pixels.
    scale = min(inner / cw, inner / ch, 1.0)
    if scale < 1.0:
        cropped = cropped.resize(
            (max(1, int(cw * scale)), max(1, int(ch * scale))),
            resample=Image.NEAREST,
        )
        cw, ch = cropped.size
    canvas = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    px = (target - cw) // 2
    py = (target - ch) // 2
    canvas.paste(cropped, (px, py), cropped)
    return canvas


def process() -> None:
    sheet = Image.open(SRC).convert("RGBA")
    print(f"Loaded sheet: {sheet.size}")

    # 1. Slice 9 cells (3 dirs × 3 frames each).
    raw: dict[tuple[str, int], Image.Image] = {}
    for d, row in ROW_INDEX.items():
        for f in (0, 1, 2):
            cell = crop_cell(sheet, col=1 + f, row=row)
            keyed = key_black(cell)
            raw[(d, f)] = keyed

    # 2. Compute the largest sprite bbox across all 9 frames so the output canvas
    #    is consistent, preventing jitter when frames swap during walking.
    max_w = max_h = 0
    for im in raw.values():
        x0, y0, x1, y1 = sprite_bbox(im)
        max_w = max(max_w, x1 - x0)
        max_h = max(max_h, y1 - y0)
    target = max(max_w, max_h) + 12   # 6 px padding on each side
    print(f"Common canvas size: {target}x{target}")

    # 3. Center each frame on a uniform square canvas.
    centred: dict[tuple[str, int], Image.Image] = {
        k: fit_into(v, target) for k, v in raw.items()
    }

    # 4. Build LEFT by mirroring RIGHT horizontally (the source row labelled
    #    'LEFT' was actually facing right — see ROW_INDEX comment).
    for f in (0, 1, 2):
        centred[("left", f)] = centred[("right", f)].transpose(Image.FLIP_LEFT_RIGHT)

    # 5. Save all 12 frames.
    for (d, f), im in centred.items():
        out = OUT_DIR / f"{d}_{f}.png"
        im.save(out, "PNG", optimize=True)
        print(f"  ✓ {out.name}  {im.size}")

    print(f"\nDone. {len(centred)} frames written to {OUT_DIR}")


if __name__ == "__main__":
    process()
