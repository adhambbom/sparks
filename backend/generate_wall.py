"""
Generates one seamless 'worn industrial brick wall' tile texture
via Gemini Nano Banana, then center-crops to a square so it tiles
cleanly across the dungeon walls. NO background-strip cleanup —
we want the FULL filled image to use as a tile background.
"""
import asyncio, os, base64, sys
from pathlib import Path
from dotenv import load_dotenv
from PIL import Image
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()
OUT_DIR = Path(__file__).parent / "static" / "sprites"
OUT_DIR.mkdir(parents=True, exist_ok=True)

WALL_PROMPT = (
    "A seamless tileable game-tile texture of a WORN INDUSTRIAL BRICK WALL. "
    "Theme: gritty, weathered, dystopian, dark. The bricks are simple rectangular "
    "stones in muted dark grey, charcoal black, and very dark navy tones, with "
    "moss-coloured stains and rust streaks. Mortar lines are thin and dark. "
    "ABSOLUTELY NO glowing tech elements, NO neon, NO circuitry, NO pipes, NO graffiti, "
    "NO text, NO labels — just plain weathered dystopian brickwork. "
    "Square edge-to-edge filling the whole canvas. 16-bit GBA pixel art style with "
    "sharp pixel edges and no anti-aliasing. The image must FILL the entire frame "
    "edge to edge with the brick pattern (no border, no margin, no padding)."
)


async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        sys.exit("ERROR: EMERGENT_LLM_KEY missing")

    out_path = OUT_DIR / "wall_brick.png"
    print(f"Generating wall_brick.png …")

    chat = LlmChat(
        api_key=api_key,
        session_id="wall-brick-tile",
        system_message="You are a pixel art tile texture generator. Output exactly one PNG image per request that fills the entire canvas edge-to-edge.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    text, images = await chat.send_message_multimodal_response(UserMessage(text=WALL_PROMPT))
    if not images:
        sys.exit(f"Generation failed (text={text[:200] if text else ''})")

    raw = base64.b64decode(images[0]["data"])
    raw_path = OUT_DIR / "_wall_brick_raw.png"
    raw_path.write_bytes(raw)

    # Center-crop the largest square region (Nano Banana usually returns ~1408x768)
    img = Image.open(raw_path).convert("RGB")
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))

    # Downscale to a clean 128x128 game tile (preserve crisp pixel art)
    img = img.resize((128, 128), Image.NEAREST)
    img.save(out_path, "PNG")
    raw_path.unlink(missing_ok=True)
    print(f"  → saved {out_path} ({out_path.stat().st_size} bytes, 128x128 tileable)")


if __name__ == "__main__":
    asyncio.run(main())
