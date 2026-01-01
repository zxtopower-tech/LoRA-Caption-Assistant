#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
if command -v static_ffmpeg >/dev/null 2>&1; then
  FFMPEG_BIN="static_ffmpeg"
elif command -v ffmpeg >/dev/null 2>&1; then
  FFMPEG_BIN="ffmpeg"
else
  echo "ffmpeg not found. Please install static-ffmpeg via pip or install system ffmpeg." >&2
  exit 1
fi

ASSET_DIR="${ROOT_DIR}/backend/tests/assets"
mkdir -p "$ASSET_DIR"

"$FFMPEG_BIN" -f lavfi -i color=c=black:s=320x240:d=1 -frames:v 1 "$ASSET_DIR/test-image.png" -y
"$FFMPEG_BIN" -f lavfi -i color=c=blue:s=320x240:r=30:d=2 -c:v libx264 -pix_fmt yuv420p -t 2 "$ASSET_DIR/test-video.mp4" -y

echo "Generated test assets in $ASSET_DIR"
