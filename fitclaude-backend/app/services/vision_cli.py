"""Vision via the local Claude Code CLI (headless).

MiniMax-M2.7 (the prod text model) cannot ingest images, and there are no
Anthropic API credits. But the VPS has Claude Code installed and authed with a
Max subscription — headless `claude -p` reads images and uses the plan (no API
credits). So for image requests we shell out to the CLI: it turns the photo into
JSON/text, and the existing pipeline (nutrition logging / coach tools) does the
rest. MiniMax stays for all text.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
import uuid

logger = logging.getLogger(__name__)

# Configurable via env; defaults match the Hostinger VPS layout (user `clawd`).
CLAUDE_BIN = os.environ.get("CLAUDE_CLI_PATH", "/home/clawd/.npm-global/bin/claude")
CLAUDE_HOME = os.environ.get("CLAUDE_CLI_HOME", "/home/clawd")
# A dir OUTSIDE the git repo (so `git pull` never conflicts) that the CLI can Read.
TMP_DIR = os.environ.get("CLAUDE_VISION_TMP", "/home/clawd/.fc_vision_tmp")
VISION_TIMEOUT = int(os.environ.get("CLAUDE_VISION_TIMEOUT", "150"))

# Cap concurrent CLI processes — each spawns Node/Claude Code (heavy on a small VPS).
_SEM = asyncio.Semaphore(int(os.environ.get("CLAUDE_VISION_CONCURRENCY", "2")))

_EXT = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}


async def _run_claude_on_image(image_base64: str, media_type: str | None, prompt: str) -> str | None:
    """Write the image to a temp file, run `claude -p` headless, return its final text."""
    os.makedirs(TMP_DIR, exist_ok=True)
    ext = _EXT.get((media_type or "").lower(), "jpg")
    fname = f"fc_{uuid.uuid4().hex}.{ext}"
    fpath = os.path.join(TMP_DIR, fname)
    try:
        with open(fpath, "wb") as f:
            f.write(base64.b64decode(image_base64))
    except Exception as e:
        logger.error(f"[vision-cli] failed to write temp image: {e}")
        return None

    try:
        # Reference the image by filename; cwd is TMP_DIR so Read (allowed tool) finds it.
        full_prompt = prompt.replace("<IMAGE>", fname)
        env = {**os.environ, "HOME": CLAUDE_HOME}
        async with _SEM:
            try:
                proc = await asyncio.create_subprocess_exec(
                    CLAUDE_BIN, "-p", full_prompt,
                    "--allowedTools", "Read",
                    "--output-format", "json",
                    cwd=TMP_DIR,
                    env=env,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
            except FileNotFoundError:
                logger.error(f"[vision-cli] claude binary not found at {CLAUDE_BIN}")
                return None
            try:
                out, err = await asyncio.wait_for(proc.communicate(), timeout=VISION_TIMEOUT)
            except asyncio.TimeoutError:
                try:
                    proc.kill()
                except Exception:
                    pass
                logger.error("[vision-cli] claude timed out")
                return None

        if proc.returncode != 0:
            logger.error(f"[vision-cli] claude exited {proc.returncode}: {err.decode(errors='ignore')[:300]}")
            return None

        raw = out.decode(errors="ignore").strip()
        # --output-format json → envelope {"type":"result","result":"<text>",...}
        try:
            env_json = json.loads(raw)
            if isinstance(env_json, dict) and "result" in env_json:
                return str(env_json["result"])
        except Exception:
            pass
        return raw
    finally:
        try:
            os.remove(fpath)
        except Exception:
            pass


def _extract_json(text: str | None) -> dict | None:
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


async def extract_nutrition_from_image(
    image_base64: str, media_type: str | None, user_text: str = "", weight_unit: str = "kg"
) -> dict:
    """Return {raw_text, total_calories, total_protein_g, total_carbs_g, total_fat_g, confirmation} or {error}."""
    unit = "ounces" if weight_unit == "lb" else "grams"
    prompt = (
        f'The user attached a photo of food. User note: "{user_text or ""}". '
        "Read the image file <IMAGE>. Identify each food item and its portion and estimate the nutrition "
        f"(portions in {unit}). Respond with ONLY a JSON object — no prose, no code fences — with keys: "
        "raw_text (a short human description of the meal), total_calories (integer), total_protein_g (integer), "
        "total_carbs_g (integer), total_fat_g (integer), confirmation (a short phrase like 'grilled chicken and rice'). "
        'If there is no food in the image, respond with {"error":"no food detected in the photo"}.'
    )
    text = await _run_claude_on_image(image_base64, media_type, prompt)
    if text is None:
        return {"error": "Vision analysis failed — please try again."}
    data = _extract_json(text)
    if not data:
        return {"error": "Couldn't read the photo. Try a clearer picture or type it in."}
    if "error" in data:
        return {"error": str(data["error"])}
    try:
        return {
            "raw_text": str(data.get("raw_text") or data.get("confirmation") or "meal"),
            "total_calories": int(round(float(data.get("total_calories", 0) or 0))),
            "total_protein_g": int(round(float(data.get("total_protein_g", 0) or 0))),
            "total_carbs_g": int(round(float(data.get("total_carbs_g", 0) or 0))),
            "total_fat_g": int(round(float(data.get("total_fat_g", 0) or 0))),
            "confirmation": str(data.get("confirmation") or data.get("raw_text") or "meal"),
        }
    except Exception as e:
        logger.error(f"[vision-cli] nutrition coerce failed: {e}; data={data}")
        return {"error": "Couldn't parse the nutrition from the photo."}


async def describe_image_for_coach(image_base64: str, media_type: str | None, user_text: str = "") -> str | None:
    """Plain-text extraction of a photo so the (blind) text model can act on it via tools."""
    prompt = (
        f'The user attached a photo. User note: "{user_text or ""}". '
        "Read the image file <IMAGE> and describe everything relevant, in detail, as plain text. "
        "If it is a workout/routine board or exercise list, list each exercise with sets/reps/weight shown. "
        "If it is food, list each item with an estimated portion and calories. Be concise and specific. "
        "Do not add commentary — just the extracted contents."
    )
    return await _run_claude_on_image(image_base64, media_type, prompt)
