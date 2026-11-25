"""
Merge the 2026-11-25 field observations (kiosk screen video, IMG_0748.MOV) into the catalog.

    python3 scripts/data/merge_field_menu.py          # rewrites src/core/data/catalog.json
    python3 scripts/data/merge_field_menu.py --check  # prints the diff summary only

Rules (docs/evidence/field-2026-11-25/FIELD_NOTES.md):
  * a name+price read on the real kiosk wins over the third-party listing (kept as referencePriceKrw)
  * items seen only on site are added; items not seen stay as reference data (field = null)
  * "준비중" at capture time is stored as a snapshot (field.display = "preparing"), never as sold out
  * a price shown as 0 (도쿄야 음료) is unknown, not free
The script is idempotent: it starts from the reference listing every time.
"""
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "src/core/data/catalog.json"
FIELD_CSV = ROOT / "docs/evidence/field-2026-11-25/menu_observations.csv"
REF_CSV = ROOT / "docs/evidence/floweat-handoff-2026-11-24/FLOWEAT_menu_reference.csv"
FIELD_DATE = "2026-11-25"

BRAND_ID = {
    "바비든든": "babi", "비비고고": "bibigogo", "포포420": "popo420", "가오슝": "kaohsiung", "폭풍분식": "pokpung",
    "값찌개": "gapjjigae", "경성카츠": "gyeongseong", "도쿄야": "tokyoya", "51장국밥": "jang51", "광뚝": "gwangttuk",
}
# kiosk tab order seen in the video: two rows of five (tab order is NOT the physical counter order)
KIOSK_TABS = [["babi", "bibigogo", "popo420", "kaohsiung", "pokpung"], ["gapjjigae", "gyeongseong", "tokyoya", "jang51", "gwangttuk"]]
# call monitors (IMG_0751): screen A's first column is cut off in the photo (babi is the only brand left, unconfirmed)
MONITOR = {"A": ["babi", "popo420", "kaohsiung", "pokpung", "gapjjigae"], "B": ["gyeongseong", "tokyoya", "jang51", "gwangttuk", "bibigogo"]}
MONITOR_UNCONFIRMED = {("A", 0)}

# field display name -> reference listing name, where the two spell the same dish differently
ALIASES = {
    ("kaohsiung", "마라풍 마파두부덮밥"): "마파두부덮밥",
    ("kaohsiung", "마라풍 마파참깨면"): "마파참깨면",
    ("kaohsiung", "마라풍 마파참깨덮밥"): "마파참깨덮밥",
    ("pokpung", "폭풍라면(토핑 추가 가능)"): "폭풍라면",
    # the kiosk itself prints "됴쿄야오므라이스" (checked on the frame); the CSV normalised the spelling
    ("tokyoya", "도쿄야오므라이스"): "됴쿄야오므라이스",
}
KEEP_REFERENCE_NAME = {("tokyoya", "도쿄야오므라이스")}

# NEW / BEST corner badges and the chilli icon, read by eye from the private reference frames
# (reference_private/0748_*.jpg, not redistributed). Snapshot of 2026-11-25 only.
BADGES = {
    ("babi", "장어덮밥"): "NEW",
    ("kaohsiung", "고추잡채덮밥"): "NEW",
    ("kaohsiung", "가오슝 짬뽕"): "NEW",
    ("kaohsiung", "대만식고기덮밥"): "BEST",
    ("kaohsiung", "갈비튀김덮밥"): "BEST",
    ("kaohsiung", "동파육덮밥"): "BEST",
    ("kaohsiung", "우육면"): "BEST",
    ("pokpung", "데리야끼 닭다리살포케"): "NEW",
    ("pokpung", "로제떡볶이"): "NEW",
    ("gwangttuk", "왕만두 사골칼제비"): "NEW",
    ("jang51", "광주 크림순대국밥"): "NEW",
    ("jang51", "얼큰 광주 크림순대국밥"): "NEW",
    ("tokyoya", "돈코츠라멘"): "BEST",
    ("gyeongseong", "샐러드파스타+등심카츠"): "NEW",
}
SPICY_ICON = {("kaohsiung", "마라풍 마파참깨면"), ("kaohsiung", "마라풍 마파참깨덮밥")}
# seen in the frames but missing from the CSV: name partly hidden by a hand
EXTRA_SIGHTINGS = [
    ("jang51", "얼큰순대국밥", 7500, "status_unknown", "약 8.5초", "이름 뒷부분이 손에 가려짐(‘얼큰순대국…’), 가격 7,500 확인 — 기존 목록 명칭과 대조"),
    ("gwangttuk", "얼큰떡왕만두뚝배기", None, "status_unknown", "약 7.75초", "이름·가격 일부가 손에 가려짐(‘얼큰떡왕만…’ 8,…) — 메뉴 존재만 확인, 가격은 참고값 유지"),
]
NEW_ITEM_TYPES = {
    ("bibigogo", "치킨가라아게"): ("side", True),
    ("bibigogo", "새우튀김"): ("side", True),
    ("bibigogo", "밥 추가(반공기)"): ("side", True),
    ("kaohsiung", "갈비튀김"): ("side", True),
    ("kaohsiung", "새우완탕튀김"): ("side", True),
    ("pokpung", "데리야끼 닭다리살포케"): ("snack", False),
    ("gwangttuk", "매운찜닭"): ("wok", False),
    ("gwangttuk", "공기밥"): ("side", True),
}
DISPLAY = {"normal_display": "normal", "preparing_display": "preparing", "status_unknown": "unknown", "price_unknown": "price_unknown"}


def norm(s: str) -> str:
    return re.sub(r"[\s()+~]", "", s).lower()


def main(check: bool) -> None:
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    # always rebuild from the reference listing so reruns are idempotent
    ref_prices = {}
    with REF_CSV.open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            ref_prices[(BRAND_ID[r["brand"]], r["menu"])] = int(r["listed_krw"]) if r["listed_krw"] and r["listed_krw"] != "0" else None

    menus = [m for m in cat["menus"] if m.get("priceBasis") != "field_only"]
    for m in menus:
        if "referenceName" in m:  # undo an earlier run's rename
            m["name"] = m.pop("referenceName")
        m["referencePriceKrw"] = ref_prices.get((m["brandId"], m["name"]), m.get("referencePriceKrw", m["listedPriceKrw"]))
        m["listedPriceKrw"] = m["referencePriceKrw"]
        m["priceBasis"] = "reference"
        m["field"] = None
        m.pop("badge", None)
    index = {(m["brandId"], norm(m["name"])): m for m in menus}

    rows = []
    with FIELD_CSV.open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            price = int(r["listed_price_krw"]) if r["listed_price_krw"] else None
            rows.append((BRAND_ID[r["brand"]], r["menu_display"], price, r["status_at_capture"], r["video_time_approx"], r["notes"]))
    rows += EXTRA_SIGHTINGS

    report = {"matched": 0, "price_changed": [], "added": [], "not_seen": 0}
    seq = {}
    for m in menus:
        seq[m["brandId"]] = max(seq.get(m["brandId"], 0), int(m["id"].split("-")[1]))
    for brand, name, price, status, at, note in rows:
        ref_name = ALIASES.get((brand, name), name)
        m = index.get((brand, norm(ref_name)))
        if m is None:
            cook, side = NEW_ITEM_TYPES[(brand, name)]
            nid = max(seq.values()) + 1  # ids are numbered across the whole catalog
            seq[brand] = nid
            m = {"id": f"{brand}-{nid:03d}", "brandId": brand, "name": name, "listedPriceKrw": None, "cookType": cook, "isSide": side, "referencePriceKrw": None, "priceBasis": "field_only"}
            menus.append(m)
            index[(brand, norm(name))] = m
            report["added"].append(f"{brand} {name} {price}")
        else:
            report["matched"] += 1
            if (brand, name) not in KEEP_REFERENCE_NAME and name != m["name"]:
                m["referenceName"] = m["name"]
                m["name"] = name
        if price is not None:
            if m["referencePriceKrw"] is not None and m["referencePriceKrw"] != price:
                report["price_changed"].append(f"{brand} {name}: {m['referencePriceKrw']} → {price}")
            m["listedPriceKrw"] = price
            if m["priceBasis"] != "field_only":
                m["priceBasis"] = "field"
        m["field"] = {
            "order": sum(1 for x in menus if x.get("field") and x["brandId"] == brand) + 1,  # position on the kiosk screen
            "date": FIELD_DATE,
            "source": f"IMG_0748.MOV {at}",
            "priceKrw": price,
            "display": DISPLAY[status],
            "badge": BADGES.get((brand, name)),
            "spicyIcon": (brand, name) in SPICY_ICON,
            "note": note,
        }
    report["not_seen"] = sum(1 for m in menus if m["field"] is None)

    order = [b for row in KIOSK_TABS for b in row]
    # kiosk screen order first (as seen on site), reference-only items after
    menus.sort(key=lambda m: (order.index(m["brandId"]), m["field"]["order"] if m["field"] else 999, int(m["id"].split("-")[1])))

    brands = {b["id"]: b for b in cat["brands"]}
    for r, row in enumerate(KIOSK_TABS):
        for c, bid in enumerate(row):
            b = brands[bid]
            if b["verification"] != "field_verified":
                b["earlierVerification"] = b["verification"]
            b["verification"] = "field_verified"
            b["fieldVerifiedAt"] = FIELD_DATE
            b["verificationNote"] = "2026-11-25 현장 키오스크 탭과 호출 모니터에서 확인한 매장이에요. 메뉴별 판매 여부는 실시간으로 알 수 없어요."
            b["kioskTab"] = {"row": r + 1, "col": c + 1}
            screen = next(s for s, cols in MONITOR.items() if bid in cols)
            col = MONITOR[screen].index(bid)
            b["monitor"] = {"screen": screen, "column": col + 1, "confirmed": (screen, col) not in MONITOR_UNCONFIRMED}
    cat["brands"] = [brands[b] for b in order]
    cat["menus"] = menus
    cat["generatedAt"] = FIELD_DATE
    cat["source"]["field"] = {
        "evidence": "docs/evidence/field-2026-11-25",
        "asOf": FIELD_DATE,
        "status": "2026-11-25 현장 키오스크 화면에서 읽은 메뉴명·가격. 그 순간의 표시이며 오늘 판매 여부는 알 수 없음",
        "rows": len(rows),
    }

    print(json.dumps(report, ensure_ascii=False, indent=1))
    print("menus", len(menus), "field-seen", sum(1 for m in menus if m["field"]), "reference-only", report["not_seen"])
    if not check:
        CATALOG.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("wrote", CATALOG.relative_to(ROOT))


if __name__ == "__main__":
    main("--check" in sys.argv)
