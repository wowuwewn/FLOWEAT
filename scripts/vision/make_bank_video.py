"""
Semi-synthetic multi-lane kiosk queue test video with exact ground truth.

Real person pixels are matted (background subtraction) out of
Intel IoT DevKit `one-by-one-person-detection.mp4` (CC BY 4.0) and composited into
a schematic "left kiosk bank" scene seen from an ASSUMED camera in the central aisle:
three kiosks, users standing behind them facing the aisle, queues forming behind
the users (away from the camera), passers crossing in front, occasional companions.

This is a test fixture for the analysis logic, NOT footage of 1947 COMMONS.

usage: python3 -I scripts/vision/make_bank_video.py <source.mp4> <data/fixtures/sprite_tracks.json> <out_dir>
env:   SEED (default 1947) — people, arrivals, service times, passers
       NAME (default "bank"), camera CAM_X / CAM_Z / YAW / FOCAL (default: straight-on)
outputs: <NAME>.mp4 (10 fps), <NAME>_gt.json (per-frame truth incl. every person's screen box)

The sprite source boxes are a frozen fixture, so the same SEED always renders the same video.
(Older replay JSONs with 6- or 7-field person rows are also accepted.)
"""
import json
import math
import os
import random
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC, REPLAY, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 960, 540
FPS = 10
DUR = 150.0
SEED = int(os.environ.get("SEED", 1947))
random.seed(SEED)

# ---------------------------------------------------------------- source frames
def read_frames(path, fps, w, h):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps={fps},scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], stdout=subprocess.PIPE)
    size = w * h * 3
    while True:
        b = p.stdout.read(size)
        if len(b) < size:
            break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3)

replay = json.load(open(REPLAY))
# accept the frozen fixture ({frames: [[[id,x,y,w,h],...],...]}) or an app replay ({frames: [{p: [[id,x,y,w,h,role,lane?],...]}]})
track_frames = [f["p"] if isinstance(f, dict) else f for f in replay["frames"]]
frames = list(read_frames(SRC, replay["fps"], W, H))
n = min(len(frames), len(track_frames))
empty = [frames[i] for i in range(n) if not track_frames[i]]
if not empty:
    raise SystemExit("no person-free frames to build the background from")
bg = np.median(np.stack(empty[:: max(1, len(empty) // 25)]), axis=0).astype(np.int16)

# ---------------------------------------------------------------- sprites
sprites = {}  # track id -> {"stand": [...], "walk": [...]}
prev = {}
for i in range(n):
    for row in track_frames[i]:
        pid, x, y, w, h = row[:5]
        if h < 200 or x < 2 or x + w > W - 2:
            continue  # need whole bodies
        x0, y0, x1, y1 = max(0, x - 8), max(0, y - 8), min(W, x + w + 8), min(H, y + h + 4)
        crop = frames[i][y0:y1, x0:x1].astype(np.int16)
        diff = np.abs(crop - bg[y0:y1, x0:x1]).max(axis=2)
        mask = Image.fromarray(((diff > 30) * 255).astype(np.uint8))
        mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
        rgba = Image.fromarray(frames[i][y0:y1, x0:x1].astype(np.uint8)).convert("RGBA")
        rgba.putalpha(mask)
        foot = ((x + w / 2) - x0, (y + h) - y0)
        moving = pid in prev and abs((x + w / 2) - prev[pid]) > 6
        prev[pid] = x + w / 2
        kind = "walk" if moving else "stand"
        sprites.setdefault(pid, {"stand": [], "walk": []})[kind].append((rgba, foot, h))
ids = [k for k, v in sprites.items() if len(v["stand"]) >= 8]
print("identities", len(ids), [(k, len(sprites[k]["stand"]), len(sprites[k]["walk"])) for k in ids])

# ---------------------------------------------------------------- camera / world
HORIZON, F, CAM_H = 92, float(os.environ.get("FOCAL", 205.0)), 2.6
# camera placement (env): straight-on (default) or oblique, e.g. CAM_X=4.2 CAM_Z=-0.6 YAW=-42
CAM_X = float(os.environ.get("CAM_X", 0))
CAM_Z = float(os.environ.get("CAM_Z", 0))
YAW = math.radians(float(os.environ.get("YAW", 0)))
NAME = os.environ.get("NAME", "bank")

def cam(X, Z):
    dx, dz = X - CAM_X, Z - CAM_Z
    return dx * math.cos(YAW) + dz * math.sin(YAW), -dx * math.sin(YAW) + dz * math.cos(YAW)

def proj(X, Z, Y=0.0):
    """world (lateral X m, depth Z m, height Y m) -> screen"""
    x, z = cam(X, Z)
    z = max(z, 0.3)
    return 480 + F * x / z, HORIZON + F * (CAM_H - Y) / z

LANES_X = [-2.3, 0.0, 2.3]  # L1 (entrance side, image left) .. L3
KIOSK_Z, SERVE_Z, SLOT = 1.65, 2.15, 0.75

def background():
    img = Image.new("RGB", (W, H), (226, 229, 233))
    d = ImageDraw.Draw(img)
    # wall far away
    d.rectangle([0, 0, W, HORIZON + 40], fill=(244, 244, 241))
    # floor tiles
    d.rectangle([0, HORIZON + 40, W, H], fill=(205, 208, 212))
    for z in [1.2 + 0.6 * k for k in range(14)]:
        _, y = proj(0, z)
        d.line([0, y, W, y], fill=(190, 193, 198), width=1)
    for X in [-6 + 0.6 * k for k in range(21)]:
        a, b = proj(X, 1.0), proj(X, 12)
        d.line([a[0], a[1], b[0], b[1]], fill=(190, 193, 198), width=1)
    # oak pillar at the back
    for X in (-4.8, 4.8):
        x0, y0 = proj(X - 0.3, 9, 3.2)
        x1, y1 = proj(X + 0.3, 9, 0)
        d.rectangle([x0, y0, x1, y1], fill=(196, 154, 106))
    return img

def kiosk_layer(img, X):
    d = ImageDraw.Draw(img)
    pts = [proj(X - 0.32, KIOSK_Z, 1.45), proj(X + 0.32, KIOSK_Z, 1.45), proj(X + 0.32, KIOSK_Z, 0.0), proj(X - 0.32, KIOSK_Z, 0.0)]
    d.polygon(pts, fill=(250, 250, 250), outline=(205, 208, 214))

# ---------------------------------------------------------------- simulation
SERVICE_MEAN = [15.0, 26.0, 12.0]   # lane 2 (centre) is slow
ARRIVAL_MEAN = [17.0, 30.0, 13.0]

class P:
    _id = 0
    def __init__(self, lane, t):
        P._id += 1
        self.id = P._id
        self.lane = lane
        self.ident = random.choice(ids)
        self.state = "approach"
        self.t0 = t
        self.join = None
        self.start = None
        self.end = None
        self.slot = None
        self.z = None
        self.x = None
        self.from_x = None
        self.phase = random.random() * 10
        self.side = random.choice([-1, 1])

people, passers, companions, events = [], [], [], []
queues = [[] for _ in LANES_X]
serving = [None, None, None]
next_arrival = [random.expovariate(1 / m) for m in ARRIVAL_MEAN]
# start with some people already waiting
for li, k in enumerate([2, 1, 3]):
    for j in range(k):
        p = P(li, 0)
        p.state = "wait"
        p.join = -random.uniform(5, 20)
        queues[li].append(p)
        people.append(p)
next_passer = 3.0
gt_frames = []

def slot_z(k):
    return SERVE_Z + SLOT * (k + 1)

t = 0.0
dt = 1 / FPS
while t < DUR:
    for li in range(3):
        # arrivals
        if t >= next_arrival[li] and t < DUR - 20:
            p = P(li, t)
            p.from_x = LANES_X[li] + p.side * 3.5
            queues[li].append(p)
            people.append(p)
            next_arrival[li] = t + random.expovariate(1 / ARRIVAL_MEAN[li]) + 3
        # service completion
        s = serving[li]
        if s and t >= s.end:
            s.state = "leave"
            s.t0 = t
            serving[li] = None
        if serving[li] is None and queues[li] and queues[li][0].state == "wait":
            p = queues[li].pop(0)
            p.state = "order"
            p.start = t
            p.end = t + max(6, random.gauss(SERVICE_MEAN[li], SERVICE_MEAN[li] * 0.25))
            serving[li] = p
            events.append({"lane": li, "id": p.id, "join": round(p.join, 2), "start": round(p.start, 2), "end": round(p.end, 2)})
            if li == 0 and random.random() < 0.5:
                companions.append({"lane": li, "until": p.end, "dx": 0.55, "ident": random.choice(ids), "owner": p.id})
    # positions
    for li in range(3):
        for k, p in enumerate(queues[li]):
            target_z = slot_z(k)
            if p.state == "approach":
                f = min(1, (t - p.t0) / 2.5)
                p.x = p.from_x + (LANES_X[li] - p.from_x) * f
                p.z = target_z
                if f >= 1:
                    p.state = "wait"
                    p.join = t
            else:
                p.x = LANES_X[li]
                p.z = target_z if p.z is None else p.z + max(-0.6 * dt * 2, (target_z - p.z)) if p.z > target_z else target_z
        s = serving[li]
        if s:
            s.x, s.z = LANES_X[li], SERVE_Z
    for p in people:
        if p.state == "leave":
            f = (t - p.t0) / 2.5
            p.x = LANES_X[p.lane] + p.side * 3.5 * f
            p.z = SERVE_Z + 0.3
            if f >= 1:
                p.state = "gone"
    if t >= next_passer and t < DUR - 6:
        d = random.choice([-1, 1])
        passers.append({"t0": t, "dir": d, "z": random.choice([1.25, 1.35, 4.8]), "ident": random.choice(ids), "speed": random.uniform(1.1, 1.5), "id": 10000 + len(passers)})
        next_passer = t + random.uniform(5, 11)

    # ---- ground truth (people whose body is in frame)
    gt = {"t": round(t, 2), "lanes": []}
    for li in range(3):
        waiting = sum(1 for p in queues[li] if p.state == "wait")
        gt["lanes"].append({"ordering": 1 if serving[li] else 0, "waiting": waiting, "approaching": sum(1 for p in queues[li] if p.state == "approach")})
    gt["passers"] = sum(1 for q in passers if 0 <= (t - q["t0"]) * q["speed"] <= 9)
    gt["companions"] = sum(1 for c in companions if t < c["until"])
    gt_frames.append(gt)

    # ---- render
    img = background()
    drawables = []  # (z, kind, payload)
    for X in LANES_X:
        drawables.append((cam(X, KIOSK_Z)[1], "kiosk", X))
    boxes = []
    def add_person(ident, X, Z, kind, phase, role, lane, pid):
        seq = sprites[ident][kind] or sprites[ident]["stand"]
        drawables.append((cam(X, Z)[1], "person", (seq[int((t * 4 + phase * 7)) % len(seq)], X, Z)))
        fx, fy = proj(X, Z)
        hh = F * 1.7 / max(0.3, cam(X, Z)[1])
        boxes.append([role, lane, pid, round(fx, 1), round(fy, 1), round(hh, 1)])
    for p in people:
        if p.state in ("approach", "leave"):
            add_person(p.ident, p.x, p.z, "walk", p.phase, p.state, p.lane, p.id)
        elif p.state in ("wait", "order"):
            add_person(p.ident, p.x, p.z, "stand", p.phase, p.state, p.lane, p.id)
    for c in companions:
        if t < c["until"]:
            add_person(c["ident"], LANES_X[c["lane"]] + c["dx"], SERVE_Z + 0.1, "stand", 3, "companion", c["lane"], 20000 + c["owner"])
    for q in passers:
        dist = (t - q["t0"]) * q["speed"]
        if 0 <= dist <= 9:
            X = -4.5 * q["dir"] + q["dir"] * dist
            add_person(q["ident"], X, q["z"], "walk", 1, "passer", -1, q["id"])
    gt["boxes"] = boxes
    drawables.sort(key=lambda d: -d[0])
    for z, kind, pay in drawables:
        if kind == "kiosk":
            kiosk_layer(img, pay)
        else:
            (spr, foot, src_h), X, Z = pay
            target_h = F * 1.7 / max(0.3, cam(X, Z)[1])
            sc = target_h / src_h
            sw, sh = max(1, int(spr.width * sc)), max(1, int(spr.height * sc))
            s2 = spr.resize((sw, sh), Image.BILINEAR)
            fx, fy = proj(X, Z)
            img.paste(s2, (int(fx - foot[0] * sc), int(fy - foot[1] * sc)), s2)
    if not hasattr(sys.modules[__name__], "_enc"):
        os.makedirs(OUT, exist_ok=True)
        _enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", os.path.join(OUT, NAME + ".mp4")], stdin=subprocess.PIPE)
        setattr(sys.modules[__name__], "_enc", _enc)
    sys.modules[__name__]._enc.stdin.write(np.asarray(img, np.uint8).tobytes())
    t += dt

sys.modules[__name__]._enc.stdin.close()
sys.modules[__name__]._enc.wait()
json.dump({
    "_about": "합성 테스트 영상(bank)의 정답. 사람 이미지는 Intel sample-videos(CC BY 4.0)에서 배경 차분으로 잘라 합성. 1947 COMMONS 영상 아님.",
    "seed": SEED, "boxFields": ["role", "lane", "id", "footX", "footY", "heightPx"],
    "fps": FPS, "duration": DUR, "camera": {"assumed": "가정 위치 (설치 미확정)", "x": CAM_X, "z": CAM_Z, "yaw_deg": math.degrees(YAW), "height_m": CAM_H},
    "lanes": ["L1", "L2", "L3"], "service": events, "frames": gt_frames,
}, open(os.path.join(OUT, NAME + "_gt.json"), "w"), ensure_ascii=False)
print("frames", len(gt_frames), "services", len(events))
