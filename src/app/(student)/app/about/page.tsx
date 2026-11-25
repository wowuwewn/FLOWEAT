"use client";
import { PageHeader } from "@/components/student/Chrome";
import { DataSources } from "@/components/student/DataNote";
import { catalog } from "@/core/catalog";
import { LAYOUT_META } from "@/core/layout";

const VERIFY_LABEL = { field_verified: "현장 키오스크·호출 모니터", operator_listed: "운영사 죽전 목록", field_observed: "팀원 현장 관찰", visit_report: "방문기·가격 목록" } as const;

const fieldSeen = catalog.menus.filter((m) => m.field).length;
const fieldOnly = catalog.menus.filter((m) => m.priceBasis === "field_only").length;

export default function AboutPage() {
  return (
    <div className="pb-8">
      <PageHeader title="데이터와 출처" back="/app" />
      <section className="mx-3 rounded-[var(--radius-card)] bg-surface px-5 py-5">
        <DataSources />
      </section>

      <section className="mx-3 mt-3 rounded-[var(--radius-card)] bg-surface px-5 py-5">
        <h2 className="text-[17px] font-bold">공간 정보</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{LAYOUT_META.note}</p>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
          시설 규모는 학교 공지의 1,505㎡, 최대 600명 기준이에요. 좌석 구역의 테이블 수와 카메라 범위는 시연용 가정이에요.
        </p>
      </section>

      <section className="mx-3 mt-3 rounded-[var(--radius-card)] bg-surface px-5 py-5">
        <h2 className="text-[17px] font-bold">브랜드는 어떻게 확인했나요</h2>
        <ul className="mt-2 divide-y divide-line">
          {catalog.brands.map((b) => (
            <li key={b.id} className="flex justify-between gap-3 py-2.5 text-[14.5px]">
              <span className="font-semibold">{b.name}</span>
              <span className="text-right text-ink-2">
                {VERIFY_LABEL[b.verification]}
                {b.fieldVerifiedAt && <span className="block text-[12px] text-ink-3">{b.fieldVerifiedAt} 확인</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12.5px] text-ink-3">
          메뉴 {catalog.menus.length}개 중 {fieldSeen}개는 {catalog.source.field.asOf} 현장 키오스크 화면에서 이름과 가격을 확인했고({fieldOnly}개는 그때 새로 찾은 메뉴), 나머지 {catalog.menus.length - fieldSeen}개는 제3자 공개 목록({catalog.source.asOf} 조사)의 참고값이에요. 촬영 순간의 화면이라 오늘 판매 여부는 알 수 없어요. 코트 번호는 확인 전이라 쓰지 않아요.
        </p>
      </section>

      <section className="mx-3 mt-3 rounded-[var(--radius-card)] bg-surface px-5 py-5">
        <h2 className="text-[17px] font-bold">개인정보</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
          회원가입이 없어요. 번호표 QR로 연결한 주문은 이 기기에만 저장돼요. 영상 분석은 사람 수와 테이블 상태 같은 집계값만 쓰고, 얼굴 인식이나 개인 추적 기록을 만들지 않아요.
        </p>
      </section>

      <section className="mx-3 mt-3 rounded-[var(--radius-card)] bg-surface px-5 py-5 text-[13.5px] leading-relaxed text-ink-2">
        <h2 className="text-[17px] font-bold text-ink">사용한 공개 자원</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Pretendard 서체 — SIL Open Font License 1.1</li>
          <li>YOLOX 객체 검출 모델 (Megvii) — Apache License 2.0</li>
          <li>테스트 영상: Intel IoT DevKit sample-videos — CC BY 4.0</li>
          <li>ONNX Runtime Web — MIT License</li>
        </ul>
        <p className="mt-3">FLOWEAT은 단국대학교 2026 「AI로 바꾸는 단국 라이프」 공모전에 참가한 재학생 팀의 시제품이에요. 단국대학교, 운영사, 입점 브랜드의 공식 서비스가 아니에요.</p>
      </section>
    </div>
  );
}
