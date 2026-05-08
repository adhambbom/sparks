"""
Post-process AI-generated sprites:
1. Detect the grey checker-pattern background (and any solid grey/black border)
2. Convert it to true alpha=0 transparency
3. Crop to the tight bounding box of the subject
4. Save as RGBA PNG
"""
import numpy as np
from PIL import Image
from pathlib import Path
from scipy.ndimage import label, binary_dilation

SPRITES_DIR = Path(__file__).parent / "static" / "sprites"


def clean_sprite(path: Path):
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    h, w, _ = arr.shape
    r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)

    # --- Step 1: classify pixels as "background candidate" ---
    # Background pixels are LOW SATURATION grey (checker pattern + solid grey edges)
    # AND/OR very dark near-black corners
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    saturation = mx - mn
    # Strip pixels that are either very-bright greys (white/canvas halo, mx > 220)
    # OR mid-grey checker patterns (40 < mx < 220 with extremely low saturation, sat<14)
    # This preserves dark stone walls (mx ~80-180) which have slightly tinted greys.
    bright_halo = (saturation < 32) & (mx >= 220)
    flat_grey = (saturation < 14) & (mx >= 40) & (mx <= 219)
    grey_candidate = bright_halo | flat_grey
    # Very dark corners (the canvas matte) — only count as bg if connected to edge
    dark_candidate = (mx < 30)
    bg_candidate = grey_candidate | dark_candidate

    # --- Step 2: flood-fill connected components touching the image edge ---
    lbl, num = label(bg_candidate)
    edge_labels = set()
    edge_labels.update(np.unique(lbl[0, :]).tolist())
    edge_labels.update(np.unique(lbl[-1, :]).tolist())
    edge_labels.update(np.unique(lbl[:, 0]).tolist())
    edge_labels.update(np.unique(lbl[:, -1]).tolist())
    edge_labels.discard(0)
    bg_mask = np.isin(lbl, list(edge_labels))

    # --- Step 3: dilate the bg mask slightly to also clean any thin halos ---
    bg_mask = binary_dilation(bg_mask, iterations=1)

    # --- Step 4: apply alpha=0 to background ---
    arr[:, :, 3] = np.where(bg_mask, 0, 255)

    # --- Step 4b: keep ONLY the largest connected opaque component(s) ---
    # This drops scattered noise dots that survived the flood-fill.
    opaque_mask = arr[:, :, 3] > 0
    # Dilate so multi-part subjects (e.g. detached visor pixels) merge into one component
    merged = binary_dilation(opaque_mask, iterations=3)
    comp_lbl, n_comp = label(merged)
    if n_comp > 0:
        sizes = np.bincount(comp_lbl.ravel())
        sizes[0] = 0  # ignore background label
        # Keep components >= 2% of the largest one (so we don't drop small but real parts)
        max_size = sizes.max()
        keep_labels = np.where(sizes >= max(50, max_size * 0.02))[0]
        keep_mask = np.isin(comp_lbl, keep_labels) & opaque_mask
        arr[:, :, 3] = np.where(keep_mask, 255, 0)

    # --- Step 5: crop to bounding box of remaining opaque pixels ---
    opaque_y, opaque_x = np.where(arr[:, :, 3] > 0)
    if len(opaque_y) == 0:
        print(f"  [WARN] {path.name}: nothing remained after cleanup")
        return
    y0, y1 = opaque_y.min(), opaque_y.max() + 1
    x0, x1 = opaque_x.min(), opaque_x.max() + 1
    # Add a tiny 4px breathing room
    pad = 4
    y0 = max(0, y0 - pad); x0 = max(0, x0 - pad)
    y1 = min(h, y1 + pad); x1 = min(w, x1 + pad)
    cropped = arr[y0:y1, x0:x1]

    out = Image.fromarray(cropped, mode="RGBA")
    out.save(path)
    print(f"  [ok] {path.name}: {w}x{h} → {cropped.shape[1]}x{cropped.shape[0]}")


def main():
    files = sorted(SPRITES_DIR.glob("*.png"))
    print(f"Cleaning {len(files)} sprite(s) in {SPRITES_DIR}")
    for f in files:
        clean_sprite(f)


if __name__ == "__main__":
    main()
