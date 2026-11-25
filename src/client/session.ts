"use client";
import { SESSION_PATTERN } from "@/core/orders/service";
import { SCENARIOS, type ScenarioId } from "@/core/sim/simulator";

const SESSION_KEY = "floweat.session";
const SCENARIO_KEY = "floweat.scenario";
const KIOSK_KEY = "floweat.kiosk";
const BRAND_KEY = "floweat.staffBrand";
export const DEFAULT_SESSION = "DEMO";

function param(name: string): string | null {
  try {
    return new URLSearchParams(location.search).get(name);
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

/** Demo session code: ?s=CODE → remembered; otherwise the shared default. */
export function currentSession(): string {
  const p = param("s")?.toUpperCase();
  if (p && SESSION_PATTERN.test(p)) {
    write(SESSION_KEY, p);
    return p;
  }
  const saved = read(SESSION_KEY);
  return saved && SESSION_PATTERN.test(saved) ? saved : DEFAULT_SESSION;
}

export function setSession(code: string) {
  if (SESSION_PATTERN.test(code)) write(SESSION_KEY, code);
}

export function newSessionCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function currentScenario(): ScenarioId {
  const p = param("sc");
  if (p && p in SCENARIOS) {
    write(SCENARIO_KEY, p);
    return p as ScenarioId;
  }
  const saved = read(SCENARIO_KEY);
  return saved && saved in SCENARIOS ? (saved as ScenarioId) : "peak";
}

export function setScenario(id: ScenarioId) {
  write(SCENARIO_KEY, id);
  try {
    window.dispatchEvent(new CustomEvent("floweat:scenario", { detail: id }));
  } catch {
    /* ignore */
  }
}

export function currentKiosk(): string {
  const p = param("k")?.toUpperCase();
  if (p && /^[LR][1-3]$/.test(p)) {
    write(KIOSK_KEY, p);
    return p;
  }
  const saved = read(KIOSK_KEY);
  return saved && /^[LR][1-3]$/.test(saved) ? saved : "L2";
}

export function savedStaffBrand(): string | null {
  return param("b") ?? read(BRAND_KEY);
}
export function saveStaffBrand(id: string) {
  write(BRAND_KEY, id);
}

// ---- role keys (laptop demo server only; Vercel one-device mode needs none) ------------------
const STAFF_KEY = (sid: string) => `floweat.staffKey.${sid}`;
const OPERATOR_KEY = "floweat.operatorKey";

export function staffKeyFor(sessionId: string): string | null {
  return read(STAFF_KEY(sessionId)) || null;
}
export function saveStaffKey(sessionId: string, key: string) {
  write(STAFF_KEY(sessionId), key);
}
export function operatorKeyStored(): string | null {
  return read(OPERATOR_KEY);
}
export function saveOperatorKey(key: string | null) {
  try {
    if (key) localStorage.setItem(OPERATOR_KEY, key);
    else localStorage.removeItem(OPERATOR_KEY);
  } catch {
    /* ignore */
  }
}
/** A pairing link puts the staff key in the URL fragment (never sent to the server): /staff?s=X#staff=KEY */
export function adoptStaffKeyFromHash(sessionId: string): boolean {
  try {
    const m = /(?:^|[#&])staff=([A-Za-z0-9_-]{8,64})/.exec(location.hash);
    if (!m) return false;
    saveStaffKey(sessionId, m[1]);
    history.replaceState(null, "", location.pathname + location.search);
    return true;
  } catch {
    return false;
  }
}
