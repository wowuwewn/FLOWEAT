import { TOKEN_PATTERN } from "@/core/orders/token";

/** Pulls the order token out of a scanned FLOWEAT ticket URL. */
export function tokenFromScan(text: string): string | null {
  const m = text.match(/\/o\/([A-Za-z0-9_-]{22})(?:[/?#]|$)/);
  if (m) return m[1];
  return TOKEN_PATTERN.test(text.trim()) ? text.trim() : null;
}

