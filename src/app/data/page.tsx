import Link from "next/link";
import { catalog } from "@/core/catalog";
import { COUNTER_STATUS_LABEL, FLOOR_GUIDE, LAYOUT_META } from "@/core/layout";

export const metadata = { title: "데이터 안내 · FLOWEAT" };

const VERIFY = { field_verified: "현장 키오스크 탭·호출 모니터", operator_listed: "운영사 목록", field_observed: "팀원 관찰", visit_report: "방문기" } as const;

/** Judge-facing: where every number and place on the student screens comes from, and what is still unknown. */
export default function DataPage() {
  const seen = catalog.menus.filter((m) => m.field).length;
  const fresh = catalog.menus.filter((m) => m.priceBasis === "field_only").length;
  return (
    <main className="mx-auto max-w-[760px] px-5 pt-10 pb-20">
      <Link href="/" className="t-sub text-ink-3 hover:text-ink">
        ← 체험 홈
      </Link>
      <h1 className="t-title mt-3">데이터 안내</h1>
      <p className="t-body mt-2 text-ink-2">학생 화면에는 상태만 보여 주고, 근거와 한계는 이 페이지에 모았어요. 자세한 기록은 저장소의 docs/에 있어요.</p>

      <Section title="실제 동작 / 시뮬레이션 / 모의">
        <Table
          rows={[
            ["주문 → 영수증 QR → 학생 앱 연결 → 호출기 번호 입력 → 모니터·학생 앱 반영", "실제 동작 (모의 키오스크 주문)"],
            ["키오스크별 대기, 좌석 현황, 시간대별 추이", "시뮬레이션 (학교 CCTV 미연결)"],
            ["대기·조리 시간 예측", "실제 계산하는 모델 (시뮬레이션 기록으로 학습)"],
            ["영상 AI", "테스트 영상 2종에서 실제 추론 (학교 영상 아님)"],
            ["결제·학교 키오스크·POS·매장 호출 장비", "모의 (연결 안 됨)"],
          ]}
        />
      </Section>

      <Section title="지도">
        <p className="t-body text-ink-2">{LAYOUT_META.note}</p>
        <p className="t-sub mt-2 text-ink-3">축척: {FLOOR_GUIDE.scaleNote} 근거: {FLOOR_GUIDE.source}.</p>
        <Table
          head={["안내도 칸", "지금 매장", "근거"]}
          rows={FLOOR_GUIDE.counters.map((c) => [
            c.guideLabel ?? "(사진 잘림)",
            c.brandId ? catalog.brands.find((b) => b.id === c.brandId)!.name : c.candidates ? `미확인 (${c.candidates.map((id) => catalog.brands.find((b) => b.id === id)!.name).join("·")} 중)` : "미확인",
            `${COUNTER_STATUS_LABEL[c.status]} — ${c.note}`,
          ])}
        />
        <ul className="t-sub mt-3 list-disc space-y-1 pl-5 text-ink-2">
          <li>안내도 사진의 오른쪽이 잘려 있어, 지도에서는 그 방향을 흐리게 처리하고 매장을 그리지 않았어요.</li>
          <li>안내도 가운데 초록 도형은 용도가 표기되지 않아 그리지 않았어요.</li>
          <li>식사 공간의 테이블·의자는 실제 배치를 확인하기 전에 그린 <b className="font-semibold text-ink">개념 배치</b>예요. 구역별 개수만 시뮬레이션 좌석 수와 맞췄고, 좌석 탭의 색은 구역 안에서 임의로 나눠 칠한 추정이에요.</li>
          <li>호출 모니터 1의 첫 열은 사진에서 잘려 있어 남은 매장인 바비든든으로 추정했어요. 실제 빨간·검은 번호의 의미는 확인 전이에요.</li>
        </ul>
      </Section>

      <Section title="매장과 메뉴">
        <p className="t-body text-ink-2">
          메뉴 {catalog.menus.length}개 중 {seen}개는 {catalog.source.field.asOf} 현장 키오스크 화면에서 이름·가격을 확인했어요({fresh}개는 그때 새로 찾은 메뉴). 나머지 {catalog.menus.length - seen}개는 제3자 공개 목록의 참고 가격이라 학생 화면에서 회색으로 보여요. 촬영 순간의 ‘준비중’은 품절로 쓰지 않았어요.
        </p>
        <Table head={["매장", "확인 경로"]} rows={catalog.brands.map((b) => [b.name, `${VERIFY[b.verification]}${b.fieldVerifiedAt ? ` (${b.fieldVerifiedAt})` : ""}`])} />
      </Section>

      <Section title="참고 문서">
        <ul className="t-body space-y-1 text-ink-2">
          <li>docs/evidence/field-2026-11-25/ — 현장 자료 반영 기록</li>
          <li>docs/evidence/open-questions.md — 미확인 사항</li>
          <li>docs/ai/ — 영상 AI·예측 검증</li>
          <li>docs/design/reference-review-v3.md — 디자인 근거</li>
        </ul>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="t-head">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head?: string[]; rows: string[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="t-sub w-full text-left">
        {head && (
          <thead className="text-ink-3">
            <tr className="border-b border-line">
              {head.map((h) => (
                <th key={h} className="py-2 pr-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line align-top">
              {r.map((c, j) => (
                <td key={j} className={`py-2.5 pr-4 ${j === 0 ? "font-medium text-ink" : "text-ink-2"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
