#!/usr/bin/env bash
# Mux screen capture + AI VO into final MP4s.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/out"
VO="$ROOT/vo"
mkdir -p "$OUT"

assemble_one() {
  local name="$1"
  local raw="$OUT/${name}-raw.webm"
  local audio="$VO/${name}.mp3"
  local final="$OUT/${name}-walkthrough.mp4"
  if [[ ! -f "$raw" ]]; then
    echo "Missing $raw" >&2
    exit 1
  fi
  if [[ ! -f "$audio" ]]; then
    echo "Missing $audio" >&2
    exit 1
  fi

  # Pad/trim video to VO length: freeze last frame if video shorter, trim if longer.
  local vdur adur
  vdur=$(ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "$raw")
  adur=$(ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "$audio")
  echo "$name video=${vdur}s audio=${adur}s"

  ffmpeg -y -i "$raw" -i "$audio" \
    -filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=${adur}[vpad];[vpad]trim=duration=${adur},setpts=PTS-STARTPTS[v]" \
    -map "[v]" -map 1:a \
    -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest \
    "$final"
  echo "Wrote $final"
}

which="${1:-both}"
if [[ "$which" == "alumni" || "$which" == "both" ]]; then
  assemble_one alumni
fi
if [[ "$which" == "committee" || "$which" == "both" ]]; then
  assemble_one committee
fi
