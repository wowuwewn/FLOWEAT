"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SCENARIOS, type ScenarioId } from "@/core/sim/simulator";
import { getEngine, worldAt } from "@/core/world";
import { ServerBackend } from "@/client/backend";
import { useBackend } from "@/client/hooks";
import { currentScenario, currentSession, newSessionCode, operatorKeyStored, saveOperatorKey, setScenario, setSession } from "@/client/session";
import { setVisionLinked, useVisionLinked } from "@/client/vision";
import { Wordmark } from "@/components/brand/Logo";
import { CommonsMap } from "@/components/map/CommonsMap";
import { Qr } from "@/components/Qr";

const SURFACES = [
  { href: "/app", title: "학생 앱", body: "키오스크 대기, 빈 테이블, 조리 시간, 내 주문 알림" },
  { href: "/kiosk", title: "키오스크", body: "현장 주문 흐름 그대로, 영수증에 추적 QR" },
  { href: "/staff", title: "매장 호출기", body: "영수증 번호만 누르면 호출" },
  { href: "/monitor", title: "호출 모니터", body: "두 모니터에 같은 번호 리스트" },
  { href: "/ops", title: "영상 AI", body: "테스트 영상에서 줄·테이블 분석" },
];

const STEPS = [
  ["키오스크에서 두 매장 주문", "/kiosk"],
  ["영수증 QR을 학생 앱에 연결", "/app/orders"],
  ["호출기에 한 매장 번호 입력", "/staff"],
  ["모니터와 학생 앱에서 확인", "/monitor"],
] as const;

export default function EntryHub() {
  const { backend, info } = useBackend();
  const [session, setSess] = useState("DEMO");
  const [scenario, setSc] = useState<ScenarioId>("peak");
  const [origin, setOrigin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [opKey, setOpKey] = useState("");
  const [hasOp, setHasOp] = useState(false);
  const [pair, setPair] = useState<string | null>(null);
  const [realClock, setRealClock] = useState(false);
  const linked = useVisionLinked();
  const router = useRouter();
  useEffect(() => {
    setHasOp(!!operatorKeyStored());
    try {
      setRealClock(localStorage.getItem("floweat.clock") === "real");
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    setSess(currentSession());
    setSc(currentScenario());
    setOrigin(location.origin);
  }, []);
  const world = useMemo(() => worldAt(getEngine("2026-11-24", "peak"), { dateKey: "2026-11-24", tSec: 12 * 3600 + 22 * 60, realTime: false }), []);
  const q = `s=${session}&sc=${scenario}`;
  const shared = info?.kind === "server";

  return (
    <div className="min-h-dvh bg-white text-ink">
      <header className="mx-auto flex max-w-[1120px] items-center justify-between px-5 pt-6">
        <Wordmark size={20} />
        <span className="t-sub text-ink-3">2026 「AI로 바꾸는 단국 라이프」 출품작</span>
      </header>

      <section className="mx-auto mt-10 grid max-w-[1120px] items-center gap-10 px-5 lg:grid-cols-[1fr_480px]">
        <div>
          <h1 className="text-[34px] leading-[1.25] font-bold tracking-[-0.03em] sm:text-[40px]">
            학식 줄, 빈자리, 내 음식.
            <br />
            도착 전에 한 번에.
          </h1>
          <p className="t-body mt-4 max-w-[34em] text-ink-2">
            단국대 죽전 1947 COMMONS 학생용 시제품이에요. 식당 상황은 <b className="font-semibold text-ink">시뮬레이션</b>이고, 영상 AI는 테스트 영상에서 실제로 돌아가요.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <Link href={`/demo/split?${q}`} className="flex h-12 items-center rounded-[var(--radius-tile)] bg-blue px-5 text-[16px] font-semibold text-white">
              전체 흐름 체험
            </Link>
            <Link href={`/app?${q}`} className="flex h-12 items-center rounded-[var(--radius-tile)] bg-floor px-5 text-[16px] font-semibold text-ink">
              학생 앱
            </Link>
          </div>
          {shared ? (
            <p className="t-sub mt-3 text-ink-3">시연 서버 연결됨 · 다른 기기에서도 같은 세션을 열 수 있어요</p>
          ) : (
            <p className="t-sub mt-3 text-ink-3" role="note">
              한 기기 체험이에요. 주문은 이 브라우저 안에서만 오가서, 다른 휴대폰으로 QR을 찍으면 주문을 찾을 수 없어요.
            </p>
          )}
        </div>
        <div className="overflow-hidden rounded-[20px] ring-1 ring-line">
          <CommonsMap kiosks={world.kiosks} interactive={false} width={480} height={340} selected="R2" fitHalf={11} />
        </div>
      </section>

      <nav className="mx-auto mt-14 max-w-[1120px] px-5" aria-label="화면 바로가기">
        <ul className="grid gap-x-6 border-t border-line sm:grid-cols-2 lg:grid-cols-5">
          {SURFACES.map((s) => (
            <li key={s.href} className="border-b border-line lg:border-b-0">
              <Link href={`${s.href}?${q}`} className="group block py-4">
                <span className="t-row block font-semibold group-hover:text-blue-ink">{s.title}</span>
                <span className="t-sub block text-ink-3">{s.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mx-auto mt-12 grid max-w-[1120px] gap-12 px-5 pb-16 lg:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="t-head">체험 순서</h2>
          <ol className="mt-3">
            {STEPS.map(([title, href], i) => (
              <li key={title} className="border-b border-line">
                <Link href={`${href}?${q}`} className="flex items-center gap-3 py-3 hover:text-blue-ink">
                  <span className="num w-5 text-[14px] font-semibold text-ink-3">{i + 1}</span>
                  <span className="t-row">{title}</span>
                </Link>
              </li>
            ))}
          </ol>

          <h2 className="t-head mt-10">실제와 모의</h2>
          <dl className="t-sub mt-3 divide-y divide-line border-y border-line">
            {[
              ["실제 동작", "주문, 영수증 QR, 호출기, 모니터·학생 앱 반영"],
              ["실제 추론", "영상 AI (줄·테이블 등 테스트 영상, 학교 영상 아님)"],
              ["시뮬레이션", "키오스크 대기, 좌석, 시간대별 추이"],
              ["모의", "결제, 학교 키오스크·POS·호출 장비 연동"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-4 py-2.5">
                <dt className="w-20 shrink-0 font-semibold text-ink">{k}</dt>
                <dd className="text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              onClick={() => {
                setVisionLinked(true);
                router.push(`/app?${q}`);
              }}
              className="h-10 rounded-[10px] bg-floor px-4 text-[14px] font-semibold text-ink"
            >
              {linked ? "사전 분석값 적용 중 · 학생 앱 보기" : "사전 분석값을 학생 앱에 적용"}
            </button>
            <Link href="/data" className="t-sub font-medium text-ink-2 underline underline-offset-2">
              데이터 근거와 미확인 사항
            </Link>
          </div>
        </div>

        <div>
          <h2 className="t-head">시연 설정</h2>
          <div className="mt-3 flex items-end justify-between border-b border-line pb-4">
            <div>
              <p className="t-sub text-ink-3">세션</p>
              <p className="num text-[26px] leading-8 font-bold tracking-[0.06em]">{session}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const c = newSessionCode();
                  setSession(c);
                  setSess(c);
                  setMsg(`새 세션 ${c}`);
                }}
                className="h-10 rounded-[10px] bg-ink px-4 text-[14px] font-semibold text-white"
              >
                새 세션
              </button>
              <button
                onClick={async () => {
                  try {
                    await backend?.reset(session);
                    setMsg(`세션 ${session} 주문을 지웠어요`);
                  } catch {
                    setMsg("운영자 키가 필요해요");
                  }
                }}
                disabled={shared && !hasOp}
                className="h-10 rounded-[10px] bg-floor px-4 text-[14px] font-semibold disabled:opacity-50"
                title={shared && !hasOp ? "운영자 키가 필요해요" : undefined}
              >
                주문 초기화
              </button>
            </div>
          </div>
          {msg && (
            <p role="status" className="t-sub mt-2 text-ink-2">
              {msg}
            </p>
          )}

          <p className="t-sub mt-5 text-ink-3">식당 상황 (시뮬레이션)</p>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-[12px] bg-floor p-1" role="radiogroup" aria-label="식당 상황">
            {Object.values(SCENARIOS).map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={scenario === s.id}
                title={s.description}
                onClick={() => {
                  setScenario(s.id);
                  setSc(s.id);
                }}
                className={`h-10 rounded-[9px] text-[14px] font-semibold ${scenario === s.id ? "bg-white text-ink shadow-[0_1px_2px_rgba(16,24,40,.12)]" : "text-ink-3"}`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <label className="mt-4 flex items-center justify-between gap-4 border-b border-line pb-4">
            <span>
              <span className="t-row block">실제 시각 따라가기</span>
              <span className="t-sub block text-ink-3">끄면 그날 가장 붐비는 45분을 반복해요</span>
            </span>
            <input
              type="checkbox"
              checked={realClock}
              onChange={(e) => {
                setRealClock(e.target.checked);
                try {
                  localStorage.setItem("floweat.clock", e.target.checked ? "real" : "loop");
                } catch {
                  /* ignore */
                }
              }}
              className="size-5 shrink-0 accent-[#1e62e6]"
            />
          </label>

          {shared && (
            <div className="mt-5" aria-labelledby="op-h">
              <h3 id="op-h" className="t-row font-semibold">
                운영자
              </h3>
              {!hasOp ? (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!opKey.trim()) return;
                    saveOperatorKey(opKey.trim());
                    setHasOp(true);
                    setOpKey("");
                  }}
                >
                  <label className="sr-only" htmlFor="op-key">
                    운영자 키
                  </label>
                  <input id="op-key" type="password" value={opKey} onChange={(e) => setOpKey(e.target.value)} placeholder="서버 시작 때 표시된 운영자 키" autoComplete="off" className="t-body h-10 min-w-0 flex-1 rounded-[10px] bg-floor px-3 outline-none" />
                  <button className="h-10 rounded-[10px] bg-ink px-4 text-[14px] font-semibold text-white">저장</button>
                </form>
              ) : (
                <div className="t-sub mt-2 space-y-3 text-ink-2">
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const k = await (backend as ServerBackend).issueStaffKey(session);
                          setPair(`${origin}/staff?s=${session}#staff=${k}`);
                        } catch {
                          setMsg("운영자 키가 맞지 않아요");
                          saveOperatorKey(null);
                          setHasOp(false);
                        }
                      }}
                      className="h-10 flex-1 rounded-[10px] bg-ink text-[14px] font-semibold text-white"
                    >
                      매장 호출기 연결 QR
                    </button>
                    <button
                      onClick={() => {
                        saveOperatorKey(null);
                        setHasOp(false);
                        setPair(null);
                      }}
                      className="h-10 rounded-[10px] bg-floor px-3 text-[14px] font-semibold"
                    >
                      키 지우기
                    </button>
                  </div>
                  {pair && (
                    <div className="flex items-center gap-3">
                      <Qr value={pair} size={96} label={`세션 ${session} 매장 호출기 연결 QR`} />
                      <p>매장 기기로 찍으면 이 세션의 호출기가 열려요. 세션 코드만으로는 호출할 수 없어요.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {shared && origin && (
            <div className="mt-5 flex items-center gap-3">
              <Qr value={`${origin}/app?${q}`} size={88} label="휴대폰으로 학생 앱 열기 QR" />
              <p className="t-sub text-ink-2">휴대폰으로 찍으면 같은 세션의 학생 앱이 열려요</p>
            </div>
          )}
          <p className="t-micro mt-8 text-ink-3">단국대학교·운영사·입점 브랜드의 공식 서비스가 아니에요.</p>
        </div>
      </section>
    </div>
  );
}
