"""
Generates the 3 NPC sprites (Orion, Jax, Lyra) for the castle interior.
Reuses the same Gemini Nano Banana pipeline.
"""
import asyncio, os, base64, sys
from pathlib import Path
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()
OUT_DIR = Path(__file__).parent / "static" / "sprites"
OUT_DIR.mkdir(parents=True, exist_ok=True)

PIXEL_STYLE = (
    " 16-bit GBA-era pixel art style, sharp pixel edges, no anti-aliasing, "
    "vibrant cyberpunk neon palette, dark background that is FULLY TRANSPARENT (alpha=0), "
    "centered single subject only, no text, no labels, no UI, no border, no frame. "
    "Output a clean PNG with transparent background."
)

NPC_SPRITES = {
    "npc_orion.png": (
        "A wise professor pixel-art character: an older man with grey hair and a short beard, "
        "wearing a long white lab coat over a dark navy turtleneck, round cyan-tinted glasses, "
        "holding a digital tablet. Calm wise pose, front-facing." + PIXEL_STYLE
    ),
    "npc_jax.png": (
        "A cocky young merchant warrior pixel-art character: a swaggering man with a smirk, "
        "spiky black hair with red-orange highlights, wearing crimson leather armor with metal "
        "shoulder guards, gold chain accents, hands resting on hips, charismatic stance, "
        "front-facing. Slightly muscular build." + PIXEL_STYLE
    ),
    "npc_lyra.png": (
        "A tech-savvy young woman pixel-art character: a bright cybernetic technician with "
        "short bob-cut teal-blue hair, large cyan tech goggles pushed up on her forehead, "
        "wearing a sleek cyan-blue tech jumpsuit with white accents and a utility belt full of "
        "tools, holding a glowing wrench. Friendly genius pose, front-facing." + PIXEL_STYLE
    ),
}


async def generate_one(filename, prompt, api_key):
    out_path = OUT_DIR / filename
    if out_path.exists() and out_path.stat().st_size > 1000:
        print(f"  [skip] {filename} ({out_path.stat().st_size} bytes)")
        return True
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"npc-gen-{filename}",
            system_message="You are a pixel art sprite generator. Output exactly one PNG image per request.",
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
        text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
        if not images:
            print(f"  [FAIL] {filename}")
            return False
        with open(out_path, "wb") as f:
            f.write(base64.b64decode(images[0]["data"]))
        print(f"  [ok] {filename} ({out_path.stat().st_size} bytes)")
        return True
    except Exception as e:
        print(f"  [ERR] {filename}: {type(e).__name__}: {e}")
        return False


async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        sys.exit("ERROR: EMERGENT_LLM_KEY missing")
    print(f"Generating {len(NPC_SPRITES)} NPC sprites")
    for filename, prompt in NPC_SPRITES.items():
        await generate_one(filename, prompt, api_key)


if __name__ == "__main__":
    asyncio.run(main())
