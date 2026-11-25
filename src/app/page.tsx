"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SCENARIOS, type ScenarioId } from "@/core/sim/simulator";
import { getEngine, worldAt } from "@/core/world";
import { useBackend } from "@/client/hooks";
import { currentScenario, currentSession, newSessionCode, setScenario, setSession } from "@/client/session";
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
            단국대 죽전 혜당관 1947 COMMONS의 키오스크 6대와 좌석을 AI 영상 분석으로 읽고, 번호표 QR로 내 주문이 준비되는 순간을 알려 주는 학생 팀의 서비스예요.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`/demo/split?${q}`} className="flex h-13 items-center rounded-2xl bg-blue px-6 text-[16px] font-bold text-white">
              한 화면에서 전체 체험
            </Link>
            <Link href={`/app?${q}`} className="flex h-13 items-center rounded-2xl bg-white px-6 text-[16px] font-bold text-ink shadow-[0_1px_0_var(--color-line)]">
              학생 앱 열기
            </Link>
          </div>
          <p className="mt-3 text-[13px] text-ink-3">
            {shared
              ? "이 시연 서버는 기기 간 주문을 공유해요. 키오스크·직원·모니터·휴대폰을 다른 기기에서 열 수 있어요."
              : "이 배포는 공용 저장소 없이 동작해요. 주문은 이 브라우저 안에서만 오가니 ‘한 화면에서 전체 체험’을 권해요. 휴대폰에서는 화면을 바꿔 가며 키오스크·학생 앱·직원·모니터를 모두 써 볼 수 있어요."}
          </p>
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
                  await backend?.reset(session);
                  setMsg(`세션 ${session}의 주문을 지웠어요.`);
                }}
                className="h-11 flex-1 rounded-xl bg-floor text-[14px] font-semibold"
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
            {shared && origin && (
              <div className="mt-4 flex items-center gap-3">
                <Qr value={`${origin}/app?${q}`} size={96} label="휴대폰으로 학생 앱 열기 QR" />
                <p className="text-[13px] text-ink-2">휴대폰으로 찍으면 같은 세션의 학생 앱이 열려요.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 text-[13.5px] leading-relaxed text-ink-2">
            <h2 className="text-[16px] font-bold text-ink">무엇이 실제이고 무엇이 모의인가요</h2>
            <dl className="mt-2 space-y-2">
              <div>
                <dt className="font-bold text-ink">실제로 동작</dt>
                <dd>영상 객체 검출(브라우저에서 직접), 키오스크별 줄·테이블 판정, 대기·준비시간·혼잡 예측 계산, QR 발급과 주문 연결, 완료 이벤트 전달</dd>
              </div>
              <div>
                <dt className="font-bold text-ink">모의로 대체</dt>
                <dd>학교 CCTV → 공개·합성 테스트 영상, 키오스크·POS → 모의 키오스크, 주문 이력 → 시뮬레이션, 결제 → 모의 결제</dd>
              </div>
              <div>
                <dt className="font-bold text-ink">아직 확인 전</dt>
                <dd>실제 평면도, 수령대·모니터·좌석 위치, 카메라 설치 위치, 현재 메뉴와 가격. 화면에 사실처럼 표시하지 않아요.</dd>
              </div>
            </dl>
            <p className="mt-3 text-[12.5px] text-ink-3">단국대학교·운영사·입점 브랜드의 공식 서비스가 아니에요.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
