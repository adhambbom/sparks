#!/usr/bin/env python3
"""
Auto-slice the two cyberpunk expansion sheets.

Both sheets share the same convention: each sprite cell has a MAGENTA
background (~rgb(192, 96, 144) / various pinks). We:
  1. Find each cell's bounding box by detecting the magenta key.
  2. Crop the sprite inside it.
  3. Convert magenta → transparent.
  4. Trim transparent padding.
  5. Save as <name>.png

For Sheet 1 (1086x1448): 4 rows x 3 cols = 12 sprites
For Sheet 2 (1024x1536): 7 rows x 5 cols = 35 sprites
"""
import os
import sys
from PIL import Image

OUT_DIR = "/app/backend/static/sprites/cyber_pack"
os.makedirs(OUT_DIR, exist_ok=True)

# ─── Names mapped to grid (row, col) — used for our vertical slice ───
# Sheet 1 is 4 rows x 3 cols
SHEET1_NAMES = {
    (0, 0): "drone_eyeball",
    (0, 1): "soldier_red",
    (0, 2): "spider_purple",
    (1, 0): "drone_scanner",
    (1, 1): "operative_hood",
    (1, 2): "mech_shield",
    (2, 0): "mech_hound",
    (2, 1): "turret_spider",
    (2, 2): "monitor_face",
    (3, 0): "robed_caster",
    (3, 1): "mutant_chainsaw",
    (3, 2): "turret_dual",
}

# Sheet 2 is 7 rows x 5 cols
SHEET2_NAMES = {
    (0, 0): "hero_rifle",
    (0, 1): "marine_shield",
    (0, 2): "spider_scout",
    (0, 3): "wraith_hood",
    (0, 4): "drone_spike",
    (1, 0): "spider_skull",
    (1, 1): "marine_gauntlet",
    (1, 2): "tentacle_orb",
    (1, 3): "warlock_purple",
    (1, 4): "drone_cube",
    (2, 0): "trooper_visor",
    (2, 1): "mech_skullhead",
    (2, 2): "spider_eye",
    (2, 3): "fleshhost",
    (2, 4): "infected_arms",
    (3, 0): "cyborg_minigun",
    (3, 1): "ghost_pack",
    (3, 2): "mech_titan",
    (3, 3): "alert_terminal",
    (3, 4): "containment_tube",
    (4, 0): "drone_quad",
    (4, 1): "tentacle_floater",
    (4, 2): "antenna_bot",
    (4, 3): "turret_cube",
    (4, 4): "spider_glow",
    (5, 0): "operator_jacked",
    (5, 1): "wraith_tentacle",
    (5, 2): "zombie_cyber",
    (5, 3): "ghost_shadow",
    (5, 4): "wraith_amulet",
    (6, 0): "rider_pilot",
    (6, 1): "drone_dog",
    (6, 2): "trooper_pack",
    (6, 3): "operative_mount",
    (6, 4): "lockdown_panel",
}


def is_magenta(px):
    """The sheets use slightly different magentas (~#C06090 / #B85090).
    Accept anything that is *clearly* pink: high R, low-mid G, high B."""
    if len(px) < 3:
        return False
    r, g, b = px[0], px[1], px[2]
    return r > 150 and g < 130 and b > 110 and r > g + 30 and b > g


def slice_grid(path: str, rows: int, cols: int, names: dict, header_h: int, footer_h: int):
    im = Image.open(path).convert("RGBA")
    W, H = im.size
    usable_top = header_h
    usable_bot = H - footer_h
    cell_h = (usable_bot - usable_top) / rows
    cell_w = W / cols

    print(f"[slice] {path}: W={W} H={H} → cell ~{cell_w:.1f}x{cell_h:.1f}")

    for r in range(rows):
        for c in range(cols):
            x0 = int(c * cell_w)
            x1 = int((c + 1) * cell_w)
            y0 = int(usable_top + r * cell_h)
            y1 = int(usable_top + (r + 1) * cell_h)
            crop = im.crop((x0, y0, x1, y1)).convert("RGBA")
            # Make magenta transparent
            pixels = crop.load()
            cw, ch = crop.size
            for yy in range(ch):
                for xx in range(cw):
                    if is_magenta(pixels[xx, yy]):
                        pixels[xx, yy] = (0, 0, 0, 0)
            # Trim transparent padding
            bbox = crop.getbbox()
            if bbox:
                crop = crop.crop(bbox)
            name = names.get((r, c), f"r{r}c{c}")
            out_path = os.path.join(OUT_DIR, f"{name}.png")
            # Optionally cap size to a sane 256 px for in-game use.
            if crop.width > 256 or crop.height > 256:
                crop.thumbnail((256, 256), Image.LANCZOS)
            crop.save(out_path, optimize=True)
            print(f"  → {name}.png ({crop.size})")


if __name__ == "__main__":
    # Sheet1: title bar ~70px top, footer text ~120px bottom (3-line dim/key)
    slice_grid("/tmp/sheet1.png", rows=4, cols=3, names=SHEET1_NAMES,
               header_h=70, footer_h=120)
    # Sheet2: top header ~110px (2-line title), no footer (sprites go to bottom)
    slice_grid("/tmp/sheet2.png", rows=7, cols=5, names=SHEET2_NAMES,
               header_h=110, footer_h=10)
    print("[done] sliced into", OUT_DIR)
