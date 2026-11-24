/**
 * Builds src/core/data/catalog.json from the field-evidence handoff pack.
 * - Brands: names + verification level from FLOWEAT_evidence.json
 * - Menus: 119 rows from FLOWEAT_menu_reference.csv (third-party, undated reference prices)
 * - Cooking type: generative-AI (Claude Code) classification draft, see data/menu-classification.json
 * Nothing here is a live/verified current menu. Court numbers and pickup positions stay null.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const ev = join(root, "docs/evidence/floweat-handoff-2026-11-24");
const evidence = JSON.parse(readFileSync(join(ev, "FLOWEAT_evidence.json"), "utf8"));
const csv = readFileSync(join(ev, "FLOWEAT_menu_reference.csv"), "utf8").replace(/^﻿/, "");
const classification: Record<string, string> = JSON.parse(readFileSync(join(root, "data/menu-classification.json"), "utf8")).items;

const BRAND_META: Record<string, { id: string; cuisine: string }> = {
  값찌개: { id: "gapjjigae", cuisine: "찌개" },
  경성카츠: { id: "gyeongseong", cuisine: "돈카츠와 우동" },
  바비든든: { id: "babi", cuisine: "덮밥" },
  포포420: { id: "popo420", cuisine: "쌀국수" },
  비비고고: { id: "bibigogo", cuisine: "비빔밥과 카레" },
  광뚝: { id: "gwangttuk", cuisine: "뚝배기와 칼제비" },
  폭풍분식: { id: "pokpung", cuisine: "분식과 포케" },
  도쿄야: { id: "tokyoya", cuisine: "오므라이스와 라멘" },
  가오슝: { id: "kaohsiung", cuisine: "대만식 중식" },
  "51장국밥": { id: "jang51", cuisine: "국밥과 냉면" },
};

type Verification = "operator_listed" | "field_observed" | "visit_report";
function verificationOf(b: any): { level: Verification; note: string } {
  const listed = b.operator_jukjeon_brand_listing === "확인";
  const user = !!b.local_user_observation;
  if (listed && user) return { level: "operator_listed", note: "운영사 죽전 매장 목록에 있고, 팀원이 현장에서도 봤어요." };
  if (listed) return { level: "operator_listed", note: "운영사의 죽전 매장 목록에 있는 브랜드예요." };
  if (user) return { level: "field_observed", note: "팀원이 현장에서 본 브랜드예요. 운영사 목록에는 아직 없어요." };
  return { level: "visit_report", note: "방문기와 공개 가격 목록에서만 확인된 브랜드예요. 지금도 운영하는지 확인이 필요해요." };
}

const rows = csv.trim().split(/\r?\n/).slice(1).map((line) => {
  const [brand, menu, price] = line.split(",");
  return { brand, menu, price: Number(price) };
});

const brands = evidence.campus_branches.map((b: any) => {
  const meta = BRAND_META[b.label];
  if (!meta) throw new Error(`unknown brand ${b.label}`);
  const v = verificationOf(b);
  const reviews = (b.operator_dated_review_evidence ?? []).map((r: any) => String(r.date).slice(0, 10));
  return {
    id: meta.id,
    name: b.label,
    cuisine: meta.cuisine,
    verification: v.level,
    verificationNote: v.note,
    latestOperatorReview: reviews.sort().at(-1) ?? null,
    currentCourtNumber: null,
    pickupNodeId: null,
  };
});

const menus = rows.map((r, i) => {
  const brand = brands.find((b: any) => b.name === r.brand);
  const key = `${r.brand}|${r.menu}`;
  const type = classification[key];
  if (!type) throw new Error(`missing classification for ${key}`);
  return {
    id: `${brand.id}-${String(i + 1).padStart(3, "0")}`,
    brandId: brand.id,
    name: r.menu,
    listedPriceKrw: r.price > 0 ? r.price : null,
    cookType: type,
    isSide: type === "side",
  };
});

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  source: {
    evidence: "docs/evidence/floweat-handoff-2026-11-24",
    priceSource: evidence.third_party_price_source,
    priceStatus: "제3자 공개 목록의 참고 가격 · 게시일과 오늘 판매 여부 미확인",
    asOf: evidence.as_of_kst,
  },
  brands,
  menus,
};
writeFileSync(join(root, "src/core/data/catalog.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`brands=${brands.length} menus=${menus.length}`);
