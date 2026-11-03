#!/usr/bin/env python3
"""Generate per-scene AI voiceovers (click-synced pipeline)."""
from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

DEFAULT_VOICE = "en-US-AvaMultilingualNeural"
RATE = "-8%"
ROOT = Path(__file__).resolve().parent


async def synth(text: str, out: Path, voice: str) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    await edge_tts.Communicate(text, voice, rate=RATE).save(str(out))
    print(f"Wrote {out}")


def duration_seconds(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nk=1:nw=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out)


async def build_audience(name: str, voice: str) -> None:
    scenes = json.loads((ROOT / "scenes" / f"{name}.json").read_text(encoding="utf-8"))
    vo_dir = ROOT / "vo" / "scenes" / name
    vo_dir.mkdir(parents=True, exist_ok=True)
    manifest = []
    for scene in scenes:
        mp3 = vo_dir / f"{scene['id']}.mp3"
        await synth(scene["vo"], mp3, voice)
        dur = duration_seconds(mp3)
        manifest.append({**scene, "vo_file": str(mp3.relative_to(ROOT)), "duration": dur})
        print(f"  {scene['id']}: {dur:.2f}s")
    (ROOT / "vo" / f"{name}-scenes.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print(f"Manifest → vo/{name}-scenes.json")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "audience",
        choices=("alumni", "committee", "both"),
        nargs="?",
        default="both",
    )
    parser.add_argument(
        "--voice",
        default=DEFAULT_VOICE,
        help="edge-tts ShortName (default: Ava Multilingual)",
    )
    args = parser.parse_args()
    print(f"Voice: {args.voice} @ {RATE}")
    targets = ["alumni", "committee"] if args.audience == "both" else [args.audience]
    for name in targets:
        await build_audience(name, args.voice)


if __name__ == "__main__":
    asyncio.run(main())
