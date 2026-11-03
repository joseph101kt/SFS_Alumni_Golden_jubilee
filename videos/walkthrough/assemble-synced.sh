#!/usr/bin/env bash
# Build click-synced walkthrough: each scene video trimmed/padded to its VO, then concat.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/out"
which="${1:-both}"

assemble_audience() {
  local name="$1"
  local manifest="$ROOT/vo/${name}-scenes.json"
  local scene_dir="$OUT/scenes/$name"
  local work="$OUT/work/$name"
  local final="$OUT/${name}-walkthrough.mp4"
  local list="$work/concat.txt"

  rm -rf "$work"
  mkdir -p "$work"

  python3 - <<PY
import json, subprocess, os
from pathlib import Path

root = Path("$ROOT")
manifest = json.loads(Path("$manifest").read_text())
scene_dir = Path("$scene_dir")
work = Path("$work")
list_path = Path("$list")
parts = []

for i, scene in enumerate(manifest):
    vid = scene_dir / f"{scene['id']}.webm"
    aud = root / scene["vo_file"]
    if not vid.exists():
        raise SystemExit(f"Missing video {vid}")
    if not aud.exists():
        raise SystemExit(f"Missing audio {aud}")
    adur = float(subprocess.check_output([
        "ffprobe","-v","error","-show_entries","format=duration",
        "-of","default=nk=1:nw=1", str(aud)
    ], text=True).strip())
    # small tail so cuts aren't abrupt
    target = adur + 0.35
    out = work / f"{i:02d}-{scene['id']}.mp4"
    # pad then trim to target; mute original (no page audio)
    cmd = [
        "ffmpeg","-y","-i",str(vid),"-i",str(aud),
        "-filter_complex",
        f"[0:v]tpad=stop_mode=clone:stop_duration={target}[vpad];"
        f"[vpad]trim=duration={target},setpts=PTS-STARTPTS[v];"
        f"[1:a]apad=pad_dur={target},atrim=duration={target},asetpts=PTS-STARTPTS[a]",
        "-map","[v]","-map","[a]",
        "-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k",
        str(out),
    ]
    print("scene", scene["id"], f"{target:.2f}s")
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    parts.append(out)

list_path.write_text("".join(f"file '{p}'\n" for p in parts))
final = Path("$final")
subprocess.check_call([
    "ffmpeg","-y","-f","concat","-safe","0","-i",str(list_path),
    "-c","copy", str(final),
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("Wrote", final)
PY
}

if [[ "$which" == "alumni" || "$which" == "both" ]]; then
  assemble_audience alumni
fi
if [[ "$which" == "committee" || "$which" == "both" ]]; then
  assemble_audience committee
fi
