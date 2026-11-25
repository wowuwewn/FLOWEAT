import "server-only";
import { NextResponse } from "next/server";
import { OrderError } from "@/core/orders/service";
import { rateLimited, storeMode } from "./orders";

export function json(data: unknown, init?: number | ResponseInit) {
  const res = NextResponse.json(data, typeof init === "number" ? { status: init } : init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function noStore() {
  return storeMode() === "none"
    ? json({ error: "NO_SHARED_STORE", message: "이 배포에는 기기 간 공용 저장소가 연결되어 있지 않아요. 한 기기 체험 모드를 사용하세요." }, 503)
    : null;
}

export function limited(req: Request, sessionId?: string) {
  return rateLimited(req, sessionId) ? json({ error: "RATE_LIMITED", message: "요청이 너무 많아요. 잠시 후 다시 시도하세요." }, 429) : null;
}

export function forbidden(role: "staff" | "operator") {
  return json(
    {
      error: "FORBIDDEN",
      message: role === "staff" ? "직원 인증이 필요해요. 운영자가 알려 준 직원 키로 연결하세요." : "운영자 키가 필요해요.",
    },
    403,
  );
}

export function fail(e: unknown) {
  if (e instanceof OrderError) {
    const status = e.code === "NOT_FOUND" ? 404 : e.code === "EXPIRED" ? 410 : 400;
    return json({ error: e.code, message: e.message }, status);
  }
  console.error(e);
  return json({ error: "INTERNAL", message: "처리하지 못했어요. 다시 시도하세요." }, 500);
}

export async function body<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
