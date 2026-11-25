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
  { href: "/app", title: "학생 앱", who: "학생", body: "정문에서 본 키오스크 6대의 예상 대기, 자리, 메뉴별 준비시간, 내 주문 알림", tag: "휴대폰" },
  { href: "/kiosk", title: "모의 키오스크", who: "주문", body: "기존 키오스크처럼 주문하고 브랜드별 번호표와 QR을 받아요. 결제는 모의예요", tag: "세로 화면" },
  { href: "/staff", title: "직원 주문 관리", who: "매장", body: "들어온 순서대로 티켓을 보고 완료를 한 번 누르면 모니터와 휴대폰에 반영돼요", tag: "태블릿" },
  { href: "/monitor", title: "호출 모니터", who: "공용 화면", body: "지금처럼 준비된 번호만 보여 줘요", tag: "TV" },
  { href: "/ops", title: "AI 분석", who: "운영", body: "영상에서 키오스크별 줄과 테이블 상태를 읽는 과정과 검증 결과", tag: "PC" },
];

const STEPS = [
  ["AI 분석 보기", "테스트 영상에서 키오스크 3대의 줄을 따로 세고, 지나가는 사람은 빼는 과정을 봐요.", "/ops"],
  ["학생 앱에서 줄 비교", "지도에서 줄이 짧아도 느린 키오스크를 찾아보세요. 메뉴별 준비시간도 볼 수 있어요.", "/app"],
  ["키오스크에서 두 브랜드 주문", "번호표가 브랜드별로 2장 나와요.", "/kiosk"],
  ["번호표 QR 연결", "휴대폰 카메라로 찍거나 ‘이 기기에서 열기’를 누르면 회원가입 없이 연결돼요.", "/app/orders"],
  ["직원 화면에서 한 매장만 완료", "완료는 실제 이벤트예요. 예상 시간이 지나도 저절로 완료되지 않아요.", "/staff"],
  ["모니터와 휴대폰 확인", "완료한 번호만 바뀌고 다른 주문은 그대로예요.", "/monitor"],
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
    <div className="min-h-dvh bg-[#f3f4f7] text-ink">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-5 pt-6">
        <Wordmark size={21} />
        <span className="rounded-full border border-line bg-white px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap text-ink-2">
          <span className="sm:hidden">2026 공모전 출품작</span>
          <span className="hidden sm:inline">2026 「AI로 바꾸는 단국 라이프」 출품 시제품</span>
        </span>
      </header>

      <section className="mx-auto mt-6 grid max-w-[1180px] items-center gap-6 px-5 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <h1 className="text-[34px] leading-[1.18] font-[800] tracking-[-0.035em] sm:text-[44px]">
            학식 줄과 자리를 미리 보고,
            <br />
            음식이 나오면 알려 줘요
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-2">
            단국대 죽전 혜당관 1947 COMMONS의 키오스크 줄·좌석 혼잡과 내 주문 준비를 알려 주는 학생 팀의 시제품이에요. 학교 카메라와 연결하기 전이라, 화면의 식당 상황은 <b className="font-semibold text-ink">시뮬레이션</b>이고 영상 AI는 <b className="font-semibold text-ink">테스트 영상</b>(키오스크 3대 장면, 테이블 4개 장면)에서 실제로 돌아가요.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`/demo/split?${q}`} className="flex h-13 items-center rounded-2xl bg-blue px-6 text-[16px] font-bold text-white">
              한 화면에서 전체 체험
            </Link>
            <Link href={`/app?${q}`} className="flex h-13 items-center rounded-2xl bg-white px-6 text-[16px] font-bold text-ink shadow-[0_1px_0_var(--color-line)]">
              학생 앱 열기
            </Link>
          </div>
          {shared ? (
            <p className="mt-3 text-[13px] text-ink-3">이 시연 서버는 기기 간 주문을 공유해요. 키오스크·직원·모니터·휴대폰을 다른 기기에서 열 수 있어요. 직원 화면은 운영자가 연결해 줘야 해요.</p>
          ) : (
            <div className="mt-4 max-w-xl rounded-2xl border border-[#f0d9a8] bg-[#fff8e8] px-4 py-3 text-[13.5px] leading-relaxed text-[#5c3d00]" role="note">
              <p className="font-bold">체험 전에: 이 주소는 ‘한 기기 체험’이에요</p>
              <p className="mt-0.5">
                주문은 지금 이 브라우저 안에서만 오가요. 키오스크 번호표 QR을 <b>다른 휴대폰 카메라로 찍으면 주문을 찾을 수 없다</b>고 나와요. 번호표 아래 ‘학생 앱에 연결’ 버튼을 쓰거나, 아래 ‘한 화면에서 전체 체험’으로 진행하세요. 휴대폰에서는 위쪽 탭으로 화면을 바꿔 가며 써요.
              </p>
            </div>
          )}
        </div>
        <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_20px_50px_rgba(15,26,51,.10)]">
          <CommonsMap kiosks={world.kiosks} interactive={false} width={520} height={380} selected="R2" />
          <p className="border-t border-line px-5 py-3 text-[13px] text-ink-2">정문에서 안쪽을 본 개념 지도 (점심 피크 시뮬레이션). 오른쪽 가운데 줄은 사람이 적어도 주문이 느려요.</p>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-[1180px] px-5" aria-labelledby="surf-h">
        <h2 id="surf-h" className="text-[20px] font-bold">
          화면 바로가기
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SURFACES.map((s) => (
            <li key={s.href}>
              <Link href={`${s.href}?${q}`} className="flex h-full flex-col rounded-2xl bg-white p-4 transition-shadow hover:shadow-[0_6px_20px_rgba(15,26,51,.08)]">
                <span className="text-[12.5px] font-semibold text-ink-3">
                  {s.who}, {s.tag}
                </span>
                <span className="mt-1 text-[17px] font-bold">{s.title}</span>
                <span className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{s.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-10 grid max-w-[1180px] gap-4 px-5 pb-12 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl bg-white p-6" aria-labelledby="steps-h">
          <h2 id="steps-h" className="text-[18px] font-bold">
            체험 순서
          </h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map(([title, body, href], i) => (
              <li key={title} className="flex gap-4">
                <span className="num grid size-8 shrink-0 place-items-center rounded-full bg-ice text-[14px] font-bold text-navy">{i + 1}</span>
                <div>
                  <Link href={`${href}?${q}`} className="text-[15.5px] font-bold hover:underline">
                    {title}
                  </Link>
                  <p className="text-[14px] leading-relaxed text-ink-2">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-6">
            <h2 className="text-[16px] font-bold">시연 세션</h2>
            <p className="num mt-1 text-[30px] font-[800] tracking-[0.08em] text-navy">{session}</p>
            <p className="text-[13px] text-ink-2">심사위원마다 새 세션을 만들면 서로의 주문이 섞이지 않아요.</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  const c = newSessionCode();
                  setSession(c);
                  setSess(c);
                  setMsg(`새 세션 ${c}를 만들었어요.`);
                }}
                className="h-11 flex-1 rounded-xl bg-navy text-[14px] font-semibold text-white"
              >
                새 세션
              </button>
              <button
                onClick={async () => {
                  try {
                    await backend?.reset(session);
                    setMsg(`세션 ${session}의 주문을 지웠어요.`);
                  } catch {
                    setMsg("주문 초기화는 운영자 키가 있어야 해요 (아래 ‘운영자’).");
                  }
                }}
                disabled={shared && !hasOp}
                className="h-11 flex-1 rounded-xl bg-floor text-[14px] font-semibold disabled:opacity-50"
                title={shared && !hasOp ? "운영자 키가 필요해요" : undefined}
              >
                주문 초기화
              </button>
            </div>
            {msg && (
              <p role="status" className="mt-2 text-[13px] text-ink-2">
                {msg}
              </p>
            )}
            <div className="mt-4 grid gap-2" role="radiogroup" aria-label="식당 상황">
              {Object.values(SCENARIOS).map((s) => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={scenario === s.id}
                  onClick={() => {
                    setScenario(s.id);
                    setSc(s.id);
                  }}
                  className={`rounded-xl border-2 px-4 py-2.5 text-left ${scenario === s.id ? "border-blue bg-ice" : "border-line"}`}
                >
                  <span className="block text-[14.5px] font-bold">{s.name}</span>
                  <span className="block text-[12.5px] text-ink-2">{s.description} (시뮬레이션)</span>
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-start gap-3 rounded-xl bg-floor px-4 py-3 text-[13px] leading-relaxed text-ink-2">
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
                className="mt-1 size-4 accent-[#2448db]"
              />
              <span>
                <b className="text-ink">실제 시각 연동</b> (선택) — 기본은 그날 가장 붐비는 점심 45분(보통 11:40–12:40 사이)을 반복해요. 켜면 실제 점심시간(11:00–13:50)에만 지금 시각으로 시뮬레이션해요.
              </span>
            </label>
            {shared && (
              <div className="mt-4 rounded-xl border border-line p-4" aria-labelledby="op-h">
                <h3 id="op-h" className="text-[14.5px] font-bold">
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
                    <input id="op-key" type="password" value={opKey} onChange={(e) => setOpKey(e.target.value)} placeholder="서버 시작 때 표시된 운영자 키" autoComplete="off" className="h-10 min-w-0 flex-1 rounded-lg border border-line px-3 text-[14px]" />
                    <button className="h-10 rounded-lg bg-navy px-4 text-[13.5px] font-semibold text-white">저장</button>
                  </form>
                ) : (
                  <div className="mt-2 space-y-2 text-[13px] text-ink-2">
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const k = await (backend as ServerBackend).issueStaffKey(session);
                            setPair(`${origin}/staff?s=${session}#staff=${k}`);
                          } catch {
                            setMsg("운영자 키가 맞지 않아요. 다시 입력하세요.");
                            saveOperatorKey(null);
                            setHasOp(false);
                          }
                        }}
                        className="h-10 flex-1 rounded-lg bg-navy text-[13.5px] font-semibold text-white"
                      >
                        직원 기기 연결 QR
                      </button>
                      <button
                        onClick={() => {
                          saveOperatorKey(null);
                          setHasOp(false);
                          setPair(null);
                        }}
                        className="h-10 rounded-lg bg-floor px-3 text-[13px] font-semibold"
                      >
                        키 지우기
                      </button>
                    </div>
                    {pair && (
                      <div className="flex items-center gap-3">
                        <Qr value={pair} size={96} label={`세션 ${session} 직원 화면 연결 QR`} />
                        <p>매장 태블릿으로 찍으면 이 세션의 직원 화면이 열려요. 키는 주소의 # 뒤에 있어 서버 로그에 남지 않아요. 세션 코드만으로는 완료 처리를 할 수 없어요.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {shared && origin && (
              <div className="mt-4 flex items-center gap-3">
                <Qr value={`${origin}/app?${q}`} size={96} label="휴대폰으로 학생 앱 열기 QR" />
                <p className="text-[13px] text-ink-2">휴대폰으로 찍으면 같은 세션의 학생 앱이 열려요.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 text-[13.5px] leading-relaxed text-ink-2">
            <h2 className="text-[16px] font-bold text-ink">무엇이 실제이고 무엇이 모의인가요</h2>
            <dl className="mt-2 space-y-2.5">
              <div>
                <dt className="font-bold text-ink">영상 AI (실제 추론, 테스트 영상 한정)</dt>
                <dd>
                  사람 검출 모델이 <b>테스트 영상 2종</b>에서 실제로 돌아가요: 키오스크 3대 줄 장면(사람 이미지를 잘라 만든 <b>합성 영상</b>)과 테이블 4개 장면(공개 영상). 학교 CCTV·실제 1947 COMMONS 영상은 아직 분석하지 않았어요. ‘AI 분석’ 화면에서 <b>미리 계산한 결과 재생</b>과 <b>이 브라우저에서 직접 추론</b>을 고를 수 있어요.
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink">학생 앱의 식당 상황 (시뮬레이션)</dt>
                <dd>키오스크 6대의 줄과 좌석은 기본적으로 시뮬레이션이에요. 아래 버튼으로 영상 AI 결과를 연결하면 <b>왼쪽 키오스크 3대</b>와 <b>중앙 칸막이석 4개</b>만 테스트 영상 분석값으로 바뀌고 ‘영상 AI’ 표시가 붙어요.</dd>
              </div>
              <div>
                <dt className="font-bold text-ink">주문·QR·완료 알림 (실제 동작)</dt>
                <dd>모의 키오스크 주문, 매장별 번호표 QR, 직원 완료, 모니터·학생 화면 반영은 실제 이벤트예요. 결제·학교 키오스크·POS는 모의예요.</dd>
              </div>
              <div>
                <dt className="font-bold text-ink">알림의 한계</dt>
                <dd>학생 앱을 열어 둔 동안 화면 배너로 알려요. 소리·진동·백그라운드(잠금 화면) 알림은 기기와 브라우저에 따라 안 될 수 있어요 (예: iPhone은 진동 미지원).</dd>
              </div>
              <div>
                <dt className="font-bold text-ink">아직 확인 전</dt>
                <dd>실제 평면도, 수령대·모니터·좌석 위치, 카메라 설치 위치, 현재 메뉴와 가격. 화면에 사실처럼 표시하지 않아요.</dd>
              </div>
            </dl>
            <button
              onClick={() => {
                setVisionLinked(true);
                router.push(`/app?${q}`);
              }}
              className="mt-4 h-11 w-full rounded-xl bg-blue text-[14px] font-semibold text-white"
            >
              {linked ? "영상 AI 결과가 연결됨 → 학생 앱에서 보기" : "영상 AI 결과를 학생 앱에 연결해 보기"}
            </button>
            <p className="mt-3 text-[12.5px] text-ink-3">단국대학교·운영사·입점 브랜드의 공식 서비스가 아니에요.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
