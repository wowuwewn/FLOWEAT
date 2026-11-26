/** Prints the operator key once when the laptop demo server starts (never on Vercel). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { storeMode } = await import("./server/orders");
  if (storeMode() !== "memory") return;
  const { operatorKey } = await import("./server/auth");
  console.log(`\n[FLOWEAT] 시연 서버 운영자 키: ${operatorKey()}  — 체험 홈(/)의 '운영자' 칸에 입력하면 직원 기기 연결·세션 초기화를 할 수 있어요.\n`);
}
