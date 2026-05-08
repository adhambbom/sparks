"""
One-off script: generates the 7 priority sprites for Synthetic Sparks
using Gemini Nano Banana, saves to /app/backend/static/sprites/.
"""
import asyncio
import os
import base64
import sys
from pathlib import Path
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()

OUT_DIR = Path(__file__).parent / "static" / "sprites"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Common style suffix to ensure consistency across all sprites
PIXEL_STYLE = (
    " 16-bit GBA-era pixel art style, sharp pixel edges, no anti-aliasing, "
    "vibrant cyberpunk neon palette, dark background that is FULLY TRANSPARENT (alpha=0), "
    "centered single subject only, no text, no labels, no UI, no border, no frame. "
    "Output a clean PNG with transparent background."
)

SPRITES = {
    "player_adhamb.png": (
        "A heroic mini pixel-art character: a young cyborg-soldier wearing sleek "
        "magenta-pink full body armor, a matching pink helmet with a glowing cyan neural visor "
        "across the eyes, gold accents on the chest core, athletic action stance, facing forward. "
        "Front-facing single character, cute chibi proportions, GBA RPG hero style." + PIXEL_STYLE
    ),
    "enemy_scout.png": (
        "A rusty quadruped robot-mutant called Clockwork Scout: copper and bronze metallic body, "
        "spiky shoulders, four insectoid legs, a single glowing red sensor eye projecting a faint "
        "red detection cone, bio-mechanical fusion of flesh and rusted gears, menacing low pose. "
        "Side-profile creature." + PIXEL_STYLE
    ),
    "enemy_juggernaut.png": (
        "A massive heavy-armored blue mech mini-boss called Juggernaut: thick steel-blue plating, "
        "wide shoulder pauldrons, glowing red visor slit, holding a large rectangular riot shield "
        "in one hand, intimidating stomp pose. Front-facing humanoid mech." + PIXEL_STYLE
    ),
    "cyber_castle.png": (
        "A massive isometric futuristic gothic cyber-castle fortress: dark stone walls with "
        "glowing magenta-pink stained-glass windows, multiple tall spires and turrets with "
        "pointed dark roofs, satellite dishes mounted on towers, ornate central archway entrance, "
        "imposing single building structure, isometric 3/4 perspective." + PIXEL_STYLE
    ),
    "sapphire_core.png": (
        "A glowing blue sapphire crystal pedestal objective: a faceted bright cyan-blue diamond "
        "crystal floating above a metallic hexagonal base with cyan glowing edges, intense blue "
        "energy aura radiating around the crystal, sci-fi mission objective object." + PIXEL_STYLE
    ),
    "spike_pad.png": (
        "A floor trap hazard: a square metal grate plate set into the ground with rows of sharp "
        "metallic spikes protruding upward, rust spots on the plate, glowing orange warning lights "
        "at the corners, top-down 3/4 isometric view, single trap." + PIXEL_STYLE
    ),
    "destructible_barrel.png": (
        "A wooden destructible barrel: classic round wood barrel with horizontal metal bands, "
        "weathered planks, slight crack on the side, sitting on the ground, single object, "
        "front 3/4 view." + PIXEL_STYLE
    ),
}


async def generate_one(filename: str, prompt: str, api_key: str):
    out_path = OUT_DIR / filename
    if out_path.exists() and out_path.stat().st_size > 1000:
        print(f"  [skip] {filename} already exists ({out_path.stat().st_size} bytes)")
        return True
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"sprite-gen-{filename}",
            system_message="You are a pixel art sprite generator. Output exactly one PNG image per request.",
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
            modalities=["image", "text"]
        )
        msg = UserMessage(text=prompt)
        text, images = await chat.send_message_multimodal_response(msg)
        if not images:
            print(f"  [FAIL] {filename}: no images returned (text={text[:120] if text else ''})")
            return False
        img = images[0]
        image_bytes = base64.b64decode(img["data"])
        with open(out_path, "wb") as f:
            f.write(image_bytes)
        print(f"  [ok]   {filename} ({len(image_bytes)} bytes)")
        return True
    except Exception as e:
        print(f"  [ERR]  {filename}: {type(e).__name__}: {e}")
        return False


async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("ERROR: EMERGENT_LLM_KEY not in environment")
        sys.exit(1)
    print(f"Generating {len(SPRITES)} sprites into {OUT_DIR}")
    results = []
    # Run sequentially to avoid rate limits
    for filename, prompt in SPRITES.items():
        ok = await generate_one(filename, prompt, api_key)
        results.append((filename, ok))
    print("\n--- Summary ---")
    for filename, ok in results:
        print(f"  {'OK' if ok else 'FAIL'}  {filename}")
    fails = [f for f, ok in results if not ok]
    if fails:
        print(f"\n{len(fails)} failed. Re-run script to retry only failed ones.")
        sys.exit(2)


if __name__ == "__main__":
    asyncio.run(main())
