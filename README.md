# FLOWEAT

**AI 기반 실시간 학식 내비게이션.** 단국대학교 죽전캠퍼스 혜당관 1층 1947 COMMONS의 키오스크 6대 대기와 좌석 혼잡을 영상 AI로 읽고, 키오스크 번호표 QR로 내 음식이 준비되면 알려 줍니다.

> 2026 단국대 「AI로 바꾸는 단국 라이프」 공모전 출품용 **학생 팀 시제품**입니다. 학교·운영사의 공식 서비스가 아니며, 학교 CCTV·키오스크·POS와 연결되어 있지 않습니다. 그 부분만 모의 시스템으로 대체했습니다.

## 무엇이 실제로 동작하나

| 영역 | 상태 |
|---|---|
| 영상 객체 검출 (YOLOX-Nano, ONNX) | **실제 추론** — 브라우저(onnxruntime-web)와 Node에서 같은 코드. 단, 입력은 **테스트 영상 2종**뿐: 키오스크 3대 줄 장면(실제 사람 이미지를 잘라 만든 **합성 영상**), 테이블 4개 장면(공개 영상) |
| 키오스크별 줄 분석 (v3 혼합 방식) | **실제 동작**, 합성 영상 홀드아웃 시드 대기 인원 MAE 0.191명 (단순 구역 집계 0.231, v2 0.277) — `docs/ai/vision.md` |
| 테이블 판정 | 공개 영상에서 “이용 중을 빈자리로” 오판 1/64칸. 실제로 비워진 테이블 장면이 없어 빈자리 찾기는 **단위 테스트로만** 확인 |
| 학생 앱의 키오스크 6대 줄·좌석 | **시뮬레이션** (기본). ‘영상 AI 결과 연결’을 켜면 왼쪽 3대와 중앙 칸막이석 4개만 테스트 영상 분석값으로 바뀜 |
| 대기시간·준비시간·단기 혼잡 예측 | **실제 계산**, 시뮬레이션 기록으로 학습·검증. 카메라 집계 오차를 반영한 검증 포함 — `docs/ai/prediction.md` |
| 키오스크 주문 → 브랜드별 QR 번호표 → 주문 연결 → 직원 완료(되돌리기) → 모니터·휴대폰 반영 | **실제 동작** |
| 학교 CCTV, 키오스크·POS·주문 이력·결제 | 테스트 영상·모의 키오스크·시뮬레이션·모의 결제로 대체 |
| 알림 | 학생 앱을 열어 둔 동안 화면 배너. 소리·진동·백그라운드 알림은 기기에 따라 안 될 수 있음(보장하지 않음) |

**실제 학식 영상으로 성능을 검증하지 않았습니다.** 수치는 모두 테스트 영상·시뮬레이션 기준입니다.

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
| 로컬, 노트북 시연 | `memory` (기본) | Node 프로세스 하나가 주문을 공유 → **실제 여러 기기 연동**. 서버 시작 때 콘솔에 **운영자 키**가 표시됨(직원 기기 연결·세션 초기화에 필요). `FLOWEAT_OPERATOR_KEY`로 지정 가능 |
| Vercel | `none` (자동) | 공용 저장소 없음 → **한 기기 체험 모드** (같은 브라우저의 탭·창·분할 화면끼리 동기화) |
| 추후 | redis / postgres 어댑터 | 같은 `OrderRepository` 인터페이스에 어댑터 1개 추가 |

온라인 기기 간 연동과 백그라운드(잠금화면) 알림은 공용 저장소 연결과 실기기 검증이 끝나야 제공됩니다. 자세한 내용은 [docs/architecture/overview.md](docs/architecture/overview.md).

## 테스트

```bash
npm test             # 단위 25개: 주문·되돌리기·동시 완료·세션 격리, 역할 키·요청 제한, 영상 분석, 시뮬레이션 상한
npm run build && npm run e2e   # Playwright 26개: 기기 간 루프, 권한, 다중 탭·되돌리기, 반응형, 접근성
npx tsx scripts/check-models.ts          # 예측 모델 백테스트 (카메라 오차 반영 포함)
scripts/vision/make-synth-set.sh dev && npm run vision:bench -- dev   # 줄 집계 3방식 비교 (holdout도 동일)
VIDEO_DIR=... npm run vision:eval        # 공개 영상(카운터·테이블) 라벨 비교
```

## 문서

[docs/README.md](docs/README.md)에서 제품 요구사항, 현장 근거, 설계 결정, AI 모델 카드, 시연·촬영 가이드를 볼 수 있습니다.

## 라이선스와 출처

- Pretendard — SIL OFL 1.1
- YOLOX-Nano / Tiny 가중치 — Apache-2.0 (`public/models/NOTICE.md`)
- 테스트 영상 — Intel IoT DevKit sample-videos, CC BY 4.0 (`public/media/NOTICE.md`)
- 메뉴·가격 119행 — 제3자 공개 목록의 참고값, 게시일·현재 판매 여부 미확인 (`docs/evidence/`)
