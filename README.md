# FLOWEAT

**AI 기반 실시간 학식 내비게이션.** 단국대학교 죽전캠퍼스 혜당관 1층 1947 COMMONS의 키오스크 6대 대기와 좌석 혼잡을 영상 AI로 읽고, 키오스크 번호표 QR로 내 음식이 준비되면 알려 줍니다.

> 2026 단국대 「AI로 바꾸는 단국 라이프」 공모전 출품용 **학생 팀 시제품**입니다. 학교·운영사의 공식 서비스가 아니며, 학교 CCTV·키오스크·POS와 연결되어 있지 않습니다. 그 부분만 모의 시스템으로 대체했습니다.

## 무엇이 실제로 동작하나

| 영역 | 상태 |
|---|---|
| 영상 객체 검출 (YOLOX, ONNX) | **실제 동작** — 브라우저(onnxruntime-web)와 Node에서 같은 코드로 추론 |
| 키오스크별 줄 분석 (주문 중·대기·동행·지나감), 4인 테이블·1인석 판정 | **실제 동작** — v2, 합성·공개 테스트 영상으로 검증 (`docs/ai/vision.md`) |
| 대기열·키오스크 이용·테이블 점유 판정 | **실제 동작** — 추적 + 구역 규칙 + 히스테리시스 |
| 대기시간·준비시간·단기 혼잡 예측 | **실제 계산** — 시뮬레이션 기록으로 학습·검증 |
| 키오스크 주문 → 브랜드별 QR 번호표 → 주문 연결 → 직원 완료 → 모니터·휴대폰 반영 | **실제 동작** |
| 학교 CCTV | 공개 테스트 영상(CC BY 4.0)으로 대체 |
| 키오스크·POS·주문 이력·결제 | 모의 키오스크, 시뮬레이션, 모의 결제로 대체 |

## 빠르게 실행

```bash
npm install          # postinstall이 onnxruntime-web WASM을 public/ort로 복사
npm run dev          # http://localhost:3000
```

같은 Wi-Fi의 휴대폰으로 연동하려면 이 컴퓨터의 IP 주소(예: `http://192.168.0.10:3000`)로 키오스크를 여세요.

| 화면 | 경로 |
|---|---|
| **체험 진입 (심사위원용 첫 화면)** | `/` , 한 화면 체험 `/demo/split` |
| 학생 앱 | `/app` (`/app/menu`, `/app/orders`, `/app/scan`, `/app/about`), QR 랜딩 `/o/{token}` |
| 모의 키오스크 | `/kiosk?k=L2` |
| 직원용 (KDS) | `/staff?b=bibigogo` |
| 호출 모니터 | `/monitor` |
| AI·운영 대시보드 | `/ops` |

녹화·스크린샷용으로 `?t=12:20`을 붙이면 시연 시각을 고정해요(`?t=live`로 해제).

## 주문 저장소 모드

| 환경 | `FLOWEAT_STORE` | 동작 |
|---|---|---|
| 로컬, 노트북 시연 | `memory` (기본) | Node 프로세스 하나가 주문을 공유 → **실제 여러 기기 연동** |
| Vercel | `none` (자동) | 공용 저장소 없음 → **한 기기 체험 모드** (같은 브라우저의 탭·창·분할 화면끼리 동기화) |
| 추후 | redis / postgres 어댑터 | 같은 `OrderRepository` 인터페이스에 어댑터 1개 추가 |

온라인 기기 간 연동과 백그라운드(잠금화면) 알림은 공용 저장소 연결과 실기기 검증이 끝나야 제공됩니다. 자세한 내용은 [docs/architecture/overview.md](docs/architecture/overview.md).

## 테스트

```bash
npm test             # 단위 테스트 (주문 도메인, 토큰, 예측)
npm run build && npm run e2e   # Playwright: 기기 간 주문 루프, 멱등성, 한 기기 모드
npx tsx scripts/check-models.ts          # 예측 모델 백테스트
VIDEO_DIR=... npm run vision:eval        # 영상 모델 비교 (라벨 기준)
```

## 문서

[docs/README.md](docs/README.md)에서 제품 요구사항, 현장 근거, 설계 결정, AI 모델 카드, 시연·촬영 가이드를 볼 수 있습니다.

## 라이선스와 출처

- Pretendard — SIL OFL 1.1
- YOLOX-Nano / Tiny 가중치 — Apache-2.0 (`public/models/NOTICE.md`)
- 테스트 영상 — Intel IoT DevKit sample-videos, CC BY 4.0 (`public/media/NOTICE.md`)
- 메뉴·가격 119행 — 제3자 공개 목록의 참고값, 게시일·현재 판매 여부 미확인 (`docs/evidence/`)
