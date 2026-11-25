#!/usr/bin/env bash
# Regenerates the semi-synthetic kiosk-queue videos + exact ground truth for a split.
#   scripts/vision/make-synth-set.sh dev       # seeds used while developing the analyzer
#   scripts/vision/make-synth-set.sh holdout   # seeds evaluated ONCE after the analyzer is frozen
# Needs: ffmpeg, python3 with numpy + pillow, and the CC BY 4.0 source clip in $VIDEO_DIR
# (Intel IoT DevKit sample-videos: one-by-one-person-detection.mp4). Output: data/cache/synth/<split>/
set -euo pipefail
SPLIT=${1:-dev}
VIDEO_DIR=${VIDEO_DIR:-data/videos}
case "$SPLIT" in
  dev) SEEDS="1947 7 2027 31" ;;
  holdout) SEEDS="4242 8080 1203 555" ;;
  *) echo "split must be dev or holdout"; exit 1 ;;
esac
OUT=data/cache/synth/$SPLIT
mkdir -p "$OUT"
for seed in $SEEDS; do
  # straight-on camera in the aisle (default) and the oblique side camera (same people, same timeline)
  [ -f "$OUT/s${seed}_straight.mp4" ] || SEED=$seed NAME=s${seed}_straight python3 -I scripts/vision/make_bank_video.py "$VIDEO_DIR/one-by-one-person-detection.mp4" data/fixtures/sprite_tracks.json "$OUT"
  [ -f "$OUT/s${seed}_oblique.mp4" ] || SEED=$seed NAME=s${seed}_oblique CAM_X=3.4 CAM_Z=0.4 YAW=50 FOCAL=300 python3 -I scripts/vision/make_bank_video.py "$VIDEO_DIR/one-by-one-person-detection.mp4" data/fixtures/sprite_tracks.json "$OUT"
done
ls -la "$OUT"
