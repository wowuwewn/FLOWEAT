"use client";
import Link from "next/link";
import { PageHeader } from "@/components/student/Chrome";
import { DataSources } from "@/components/student/DataNote";

export default function AboutPage() {
  return (
    <div className="pb-10">
      <PageHeader title="데이터 안내" back="/app" />
      <section className="px-5">
        <p className="t-body text-ink-2">학교·운영사 시스템과 연결되지 않은 시연이에요. 대기와 좌석은 시뮬레이션이고, 주문은 모의 키오스크로만 들어와요.</p>
        <div className="mt-4">
          <DataSources />
        </div>
      </section>

      <section className="mt-8 px-5">
        <h2 className="t-head">개인정보</h2>
        <p className="t-body mt-1.5 text-ink-2">회원가입이 없어요. QR로 연결한 주문은 이 기기에만 저장돼요. 영상 분석은 사람 수와 테이블 상태만 세고 얼굴을 인식하지 않아요.</p>
      </section>

      <section className="mt-8 px-5">
        <h2 className="t-head">공개 자원</h2>
        <ul className="t-sub mt-1.5 space-y-1 text-ink-2">
          <li>Pretendard — SIL Open Font License 1.1</li>
          <li>YOLOX (Megvii) — Apache License 2.0</li>
          <li>Intel IoT DevKit sample-videos — CC BY 4.0</li>
          <li>ONNX Runtime Web — MIT License</li>
        </ul>
      </section>

      <p className="t-sub mx-5 mt-8 text-ink-3">
        단국대 재학생 팀의 2026 「AI로 바꾸는 단국 라이프」 공모전 시제품이에요. 학교·운영사·입점 브랜드의 공식 서비스가 아니에요.{" "}
        <Link href="/data" className="font-medium text-ink-2 underline underline-offset-2">
          근거 자료
        </Link>
      </p>
    </div>
  );
}
