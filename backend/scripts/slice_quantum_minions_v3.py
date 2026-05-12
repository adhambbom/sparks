#!/usr/bin/env python3
"""
V3 slicer — uses connected-component analysis instead of a fixed grid.

The user's spritesheet has irregular packing (some cells empty), so a
naive grid slice produces multi-character crops. Instead, we:
  1. Build an alpha mask where pixels !~ background-magenta are foreground.
  2. Label connected components.
  3. Filter to components whose bbox area > MIN_AREA (drops noise).
  4. Sort components row-major (top→bottom, left→right) by bbox centroid.
  5. Crop each, key the magenta to alpha=0, autocrop, scale to ≤256.
  6. Write them as phreak_1..4 → vrghost_1..4 → mech_1..4 in that order so
     the existing SPECIES_LINE_MAP keeps working.
"""
import os
import sys
from PIL import Image
from collections import deque

SRC = "/tmp/minion_v2.png"
OUT = "/app/backend/static/sprites/quantum_minions"
os.makedirs(OUT, exist_ok=True)

# Background key — dusty pink. Tighten tolerance to keep dark character pixels.
BG_TARGET = (178, 90, 130)
TOL = 50
# Drop tiny specks (anti-alias debris). Each cell is ≥ 200×200 so 5000 is safe.
MIN_AREA = 5000
# Annotation text band at the bottom — skip Y > USABLE_H.
USABLE_H = 1320

TARGET_NAMES = [
    "phreak_1", "phreak_2", "phreak_3", "phreak_4",
    "vrghost_1", "vrghost_2", "vrghost_3", "vrghost_4",
    "mech_1", "mech_2", "mech_3", "mech_4",
]


def is_bg(rgb):
    r, g, b = rgb[0], rgb[1], rgb[2]
    return (abs(r - BG_TARGET[0]) <= TOL
            and abs(g - BG_TARGET[1]) <= TOL
            and abs(b - BG_TARGET[2]) <= TOL)


def find_components(im):
    """Iterative flood-fill labeller (avoids recursion limits at 1.5M pixels)."""
    W, H = im.size
    px = im.load()
    labels = [[0] * H for _ in range(W)]
    components = []  # list of dicts: {bbox, pixels}
    next_id = 1
    for y0 in range(0, min(H, USABLE_H)):
        for x0 in range(W):
            if labels[x0][y0] != 0:
                continue
            if is_bg(px[x0, y0]):
                continue
            # New component — BFS
            q = deque([(x0, y0)])
            labels[x0][y0] = next_id
            xmin, ymin, xmax, ymax = x0, y0, x0, y0
            area = 0
            while q:
                x, y = q.popleft()
                area += 1
                if x < xmin: xmin = x
                if y < ymin: ymin = y
                if x > xmax: xmax = x
                if y > ymax: ymax = y
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < W and 0 <= ny < min(H, USABLE_H) and labels[nx][ny] == 0:
                        if not is_bg(px[nx, ny]):
                            labels[nx][ny] = next_id
                            q.append((nx, ny))
            components.append({
                "id": next_id,
                "bbox": (xmin, ymin, xmax + 1, ymax + 1),
                "area": area,
            })
            next_id += 1
    return components


def merge_overlapping_bboxes(comps, gap=14):
    """Merge components whose bboxes overlap or sit within `gap` px of each
    other — handles disconnected limbs / accessories (laser beam, tentacles
    that detach from main body)."""
    boxes = [c["bbox"] for c in sorted(comps, key=lambda c: -c["area"])]
    merged = []
    used = [False] * len(boxes)
    for i in range(len(boxes)):
        if used[i]:
            continue
        x0, y0, x1, y1 = boxes[i]
        changed = True
        while changed:
            changed = False
            for j in range(len(boxes)):
                if i == j or used[j]:
                    continue
                bx0, by0, bx1, by1 = boxes[j]
                # Bounding-box overlap or proximity check
                if (bx0 - gap <= x1 and bx1 + gap >= x0 and
                        by0 - gap <= y1 and by1 + gap >= y0):
                    x0 = min(x0, bx0); y0 = min(y0, by0)
                    x1 = max(x1, bx1); y1 = max(y1, by1)
                    used[j] = True
                    changed = True
        used[i] = True
        merged.append((x0, y0, x1, y1))
    return merged


def crop_and_clean(im, bbox, pad=4):
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(im.size[0], x1 + pad); y1 = min(im.size[1], y1 + pad)
    cell = im.crop((x0, y0, x1, y1)).convert("RGBA")
    px = cell.load()
    w, h = cell.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_bg((r, g, b)):
                px[x, y] = (r, g, b, 0)
    return cell


def main():
    sheet = Image.open(SRC).convert("RGB")
    print(f"Sheet {sheet.size}, scanning for sprites...")
    comps = find_components(sheet)
    big = [c for c in comps if c["area"] > MIN_AREA]
    print(f"Found {len(comps)} raw components, {len(big)} pass min-area.")
    # Skip the merge step — the magenta separators between cells are wide
    # enough that connected-component analysis already gives clean isolated
    # sprites. (Merging with gap>0 collapses everything into one box.)
    # Filter out runaway components that span > 60% of the image — those are
    # accidental thin pixel chains through the separator lines.
    SH = sheet.size[1]
    SW = sheet.size[0]
    filtered = []
    for c in big:
        x0, y0, x1, y1 = c["bbox"]
        if (x1 - x0) > SW * 0.6 or (y1 - y0) > SH * 0.5:
            print(f"  drop runaway component bbox={c['bbox']} area={c['area']}")
            continue
        filtered.append(c)
    boxes = [c["bbox"] for c in filtered]
    print(f"Using {len(boxes)} bounding boxes directly (no merge).")

    # Sort row-major: bucket by Y-bands first then sort within each band by X.
    # Row bands of ~200px so sprites on the same row land in the same bucket.
    boxes_sorted = sorted(boxes, key=lambda b: ((b[1] + b[3]) // 2 // 200, b[0]))

    if len(boxes_sorted) < 12:
        print(f"WARNING: only {len(boxes_sorted)} sprites detected — filling rest with empties.")
    if len(boxes_sorted) > 12:
        print(f"WARNING: {len(boxes_sorted)} sprites > 12 — keeping the first 12.")
        boxes_sorted = boxes_sorted[:12]

    for i, bbox in enumerate(boxes_sorted):
        name = TARGET_NAMES[i] if i < len(TARGET_NAMES) else f"extra_{i}"
        cell = crop_and_clean(sheet, bbox, pad=4)
        cell.thumbnail((256, 256), Image.NEAREST)
        cell.save(os.path.join(OUT, f"{name}.png"), "PNG", optimize=True)
        print(f"  wrote {name}.png  ({cell.size[0]}x{cell.size[1]}) from bbox {bbox}")
    print("Done.")


if __name__ == "__main__":
    sys.exit(main())
