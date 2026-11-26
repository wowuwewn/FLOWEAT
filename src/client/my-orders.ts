"use client";
/**
 * Orders this device follows. Only raw QR tokens are kept, locally. No account,
 * no server-side device profile. Re-scanning the same QR never duplicates.
 */
import { useSyncExternalStore } from "react";

export interface MyOrderRef {
  token: string;
  addedAt: number;
}

const KEY = "floweat.my-orders.v1";
const EVENT = "floweat:my-orders";
const EMPTY: MyOrderRef[] = [];
let cache: { raw: string | null; value: MyOrderRef[] } = { raw: null, value: EMPTY };

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function myOrders(): MyOrderRef[] {
  const raw = readRaw();
  if (raw === cache.raw) return cache.value;
  let value: MyOrderRef[] = EMPTY;
  try {
    value = raw ? (JSON.parse(raw) as MyOrderRef[]) : EMPTY;
  } catch {
    value = EMPTY;
  }
  cache = { raw, value };
  return value;
}

function save(list: MyOrderRef[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Returns true when the token was newly added. */
export function addMyOrder(token: string): boolean {
  const list = myOrders();
  if (list.some((o) => o.token === token)) return false;
  save([{ token, addedAt: Date.now() }, ...list].slice(0, 12));
  return true;
}

export function removeMyOrder(token: string) {
  save(myOrders().filter((o) => o.token !== token));
}

/** Demo reset: stop following every order on this device. */
export function clearMyOrders() {
  save([]);
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useMyOrders(): MyOrderRef[] {
  return useSyncExternalStore(subscribe, myOrders, () => EMPTY);
}
