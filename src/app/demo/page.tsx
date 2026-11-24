"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SCENARIOS, type ScenarioId } from "@/core/sim/simulator";
import { useBackend } from "@/client/hooks";
import { currentScenario, currentSession, newSessionCode, setScenario, setSession } from "@/client/session";
import { Qr } from "@/components/Qr";

const STEPS = [
  ["AI 분석 보기", "테스트 영상에서 사람·테이블을 검출하고, 줄과 자리 상태로 바꾸는 과정을 봐요.", "/ops"],
  ["학생 화면에서 줄 비교", "정문 기준 좌우 3대의 예상 대기와 메뉴별 준비시간을 비교해요.", "/"],
  ["모의 키오스크에서 주문", "두 브랜드 메뉴를 담으면 번호표가 브랜드별로 2장 나와요.", "/kiosk"],
  ["번호표 QR 연결", "휴대폰 카메라로 QR을 찍으면 회원가입 없이 내 주문에 연결돼요.", "/orders"],
  ["직원 화면에서 완료", "한 매장 주문만 완료를 눌러 보세요.", "/staff"],
  ["모니터와 휴대폰 확인", "완료한 번호만 모니터와 휴대폰에 바로 바뀌고, 다른 주문은 그대로예요.", "/monitor"],
] as const;

export default function DemoHub() {
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

  const q = `s=${session}&sc=${scenario}`;
  const shared = info?.kind === "server";
  const onLocalhost = /\/\/(localhost|127\.)/.test(origin);

  const fresh = () => {
    const c = newSessionCode();
    setSession(c);
    setSess(c);
    setMsg(`새 시연 세션 ${c}를 만들었어요. 이 세션의 주문은 다른 세션과 섞이지 않아요.`);
  };
  const reset = async () => {
    await backend?.reset(session);
    setMsg(`세션 ${session}의 주문을 모두 지웠어요.`);
  };

  return (
    <div className="min-h-dvh bg-floor">
      <header className="bg-navy px-6 pt-8 pb-7 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-[14px] opacity-80">FLOWEAT 심사·시연 안내</p>
          <h1 className="mt-1 text-[30px] leading-tight font-[780] tracking-[-0.02em]">한 번의 주문으로 전체 흐름을 체험해 보세요</h1>
          <p className="mt-2 max-w-2xl text-[15.5px] leading-relaxed opacity-90">
            학식 줄과 자리를 AI로 읽고, 키오스크 번호표 QR로 내 음식이 준비되면 알려 주는 학생 팀의 시제품이에요. 학교·운영사 시스템과는 연결되지 않았고, 그 부분만 모의 시스템으로 바꿨어요.
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-[var(--radius-card)] bg-surface p-6" aria-labelledby="mode-h">
          <h2 id="mode-h" className="text-[19px] font-bold">
            {shared ? "여러 기기로 체험" : "한 기기로 체험"}
          </h2>
          {shared ? (
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              이 시연 서버가 주문을 공유해요. 키오스크, 직원 화면, 모니터, 휴대폰을 각각 다른 기기에서 열 수 있어요.
              {onLocalhost && " 지금 localhost로 열었어요. 휴대폰에서 접속하려면 같은 Wi-Fi에서 이 컴퓨터의 IP 주소로 열어 주세요."}
            </p>
          ) : (
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              이 배포에는 기기 간 공용 저장소가 아직 없어요. 그래서 주문은 이 브라우저 안에서만 오가요. 아래 분할 화면에서 키오스크·직원·모니터·휴대폰 화면을 한 번에 체험할 수 있어요. 다른 휴대폰으로 QR을 찍는 기기 간 연동과 백그라운드 알림은 공용 저장소 연결과 실기기 검증 뒤에 제공돼요.
            </p>
          )}
          <Link href={`/demo/split?${q}`} className="mt-4 flex h-14 items-center justify-center rounded-2xl bg-blue text-[17px] font-bold text-white">
            분할 화면으로 체험 시작
          </Link>

          <ol className="mt-6 space-y-4">
            {STEPS.map(([title, body, href], i) => (
              <li key={title} className="flex gap-4">
                <span className="num grid size-8 shrink-0 place-items-center rounded-full bg-ice text-[15px] font-bold text-navy">{i + 1}</span>
                <div>
                  <Link href={`${href}?${q}`} className="text-[16px] font-bold underline-offset-2 hover:underline">
                    {title}
                  </Link>
                  <p className="text-[14px] leading-relaxed text-ink-2">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="space-y-4">
          <section className="rounded-[var(--radius-card)] bg-surface p-6" aria-labelledby="sess-h">
            <h2 id="sess-h" className="text-[17px] font-bold">
              시연 세션
            </h2>
            <p className="num mt-1 text-[34px] font-[800] tracking-[0.08em] text-navy">{session}</p>
            <p className="text-[13.5px] text-ink-2">심사위원마다 새 세션을 만들면 서로의 주문이 섞이지 않아요.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={fresh} className="h-11 flex-1 rounded-xl bg-navy text-[14.5px] font-semibold text-white">
                새 세션
              </button>
              <button onClick={reset} className="h-11 flex-1 rounded-xl bg-floor text-[14.5px] font-semibold">
                주문 초기화
              </button>
            </div>
            {msg && (
              <p role="status" className="mt-3 text-[13.5px] text-ink-2">
                {msg}
              </p>
            )}
          </section>

          <section className="rounded-[var(--radius-card)] bg-surface p-6" aria-labelledby="sc-h">
            <h2 id="sc-h" className="text-[17px] font-bold">
              식당 상황 바꾸기
            </h2>
            <div className="mt-3 grid gap-2" role="radiogroup" aria-label="시뮬레이션 상황">
              {Object.values(SCENARIOS).map((s) => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={scenario === s.id}
                  onClick={() => {
                    setScenario(s.id);
                    setSc(s.id);
                  }}
                  className={`rounded-xl border-2 px-4 py-3 text-left ${scenario === s.id ? "border-blue bg-ice" : "border-line"}`}
                >
                  <span className="block text-[15px] font-bold">{s.name}</span>
                  <span className="block text-[13px] text-ink-2">{s.description}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12.5px] text-ink-3">바꾸면 대기·자리·준비시간이 다시 계산돼요. 시뮬레이션 데이터예요.</p>
          </section>

          {shared && origin && (
            <section className="rounded-[var(--radius-card)] bg-surface p-6" aria-labelledby="join-h">
              <h2 id="join-h" className="text-[17px] font-bold">
                휴대폰으로 학생 화면 열기
              </h2>
              <div className="mt-3 flex items-center gap-4">
                <Qr value={`${origin}/?${q}`} size={120} label="학생 화면 접속 QR" />
                <p className="text-[13.5px] leading-relaxed text-ink-2">같은 세션의 학생 화면이 열려요. 그다음 키오스크 번호표 QR을 찍으면 돼요.</p>
              </div>
            </section>
          )}

          <section className="rounded-[var(--radius-card)] bg-surface p-6 text-[13.5px] leading-relaxed text-ink-2" aria-labelledby="data-h">
            <h2 id="data-h" className="text-[17px] font-bold text-ink">
              무엇이 진짜이고 무엇이 모의인가요
            </h2>
            <ul className="mt-2 space-y-1.5">
              <li><b className="text-ink">실제 동작</b>: 영상 객체 검출(브라우저 AI), 대기·준비시간·혼잡 예측 계산, QR 발급과 주문 연결, 완료 이벤트 전달</li>
              <li><b className="text-ink">모의</b>: 학교 CCTV → 공개 테스트 영상, 키오스크·POS → 모의 키오스크, 주문 이력 → 시뮬레이션, 결제 → 모의 결제</li>
              <li><b className="text-ink">미확인</b>: 실제 평면도, 수령대 위치, 현재 메뉴·가격. 화면에 실제처럼 표시하지 않아요.</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
