# 전체 구조

```
브라우저 (학생·키오스크·직원·모니터·운영)                Next.js 서버 (로컬/노트북)
 ┌───────────────────────────────┐                  ┌─────────────────────────────┐
 │ UI (React 19, Tailwind v4)     │   fetch/롱폴링   │ Route Handlers /api/*        │
 │ useWorld ─ core/world (시뮬+예측)│ ───────────────▶ │  OrderService (core)         │
 │ OrderBackend ─┬ ServerBackend  │                  │  MapRepository ─ memory 상태 │
 │               └ DeviceBackend ─┼─ localStorage    │  MemoryFeed (롱폴링 깨우기)   │
 │ 영상: onnxruntime-web + core/vision │ BroadcastChannel └─────────────────────────────┘
 └───────────────────────────────┘
오프라인: scripts/vision (onnxruntime-node + 같은 core/vision) → public/vision/*.json
```

## 계층

| 경로 | 역할 | 런타임 |
|---|---|---|
| `src/core/orders` | 주문 도메인(브랜드별 분리, 표시번호, 토큰, 상태 전이, 만료, 멱등) + 포트 | 서버·브라우저 공용 |
| `src/core/sim` | 결정적 점심 시뮬레이터 | 공용 |
| `src/core/predict` | 대기·준비·단기 예측, 백테스트 | 공용 |
| `src/core/vision` | 전처리·디코딩·NMS, 추적, 구역·테이블 판정, 장면 설정 | 공용 |
| `src/core/world.ts` | 특정 시각의 식당 상태 + 예측 합성 | 공용 |
| `src/server` | 저장소 모드 선택, 메모리 저장소, 롱폴링 피드, 요청 제한 | 서버 |
| `src/client` | 백엔드 선택(서버/한 기기), 세션, 내 주문, 영상 재생·실시간 추론 | 브라우저 |

## 주문 흐름

`모의 결제 1건 → 브랜드별 주문 N개 → 주문마다 128비트 조회 토큰(QR, DB에는 SHA-256만) → 직원 완료(멱등) → 모니터·학생 휴대폰`

- 상태: `accepted → ready → closed`(학생이 "받았어요") / `expired`(접수 3시간, 완료 후 90분)
- 예측 시간이 지나도 직원 완료 전에는 절대 `ready`가 되지 않습니다.
- 완료 되돌리기는 10초 안에만 가능합니다.
- 표시번호만으로는 개인 주문을 조회할 수 없습니다(토큰 필요).

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 저장소 모드, 기기 간 공유 가능 여부 |
| POST | `/api/sessions/{sid}/orders` | 키오스크 주문 → 번호표(토큰 포함, 한 번만 반환) |
| GET | `/api/sessions/{sid}/orders?since=&wait=` | 직원·모니터용 롱폴링 |
| POST | `/api/sessions/{sid}/orders/{id}/ready` | 완료/되돌리기 (`idempotencyKey`) |
| POST | `/api/sessions/{sid}/reset` | 시연 세션 초기화 |
| POST | `/api/track` | 토큰 목록 조회 (`versions`+`wait`로 롱폴링) |
| POST | `/api/track/close` | "받았어요" |

## 공용 저장소를 붙일 때 (아직 하지 않음)

1. `OrderRepository`를 구현하는 어댑터 1개 추가 (`MapRepository`의 키 구조를 그대로 Redis 해시·셋에 옮기면 됨).
2. `ChangeFeed.waitForChange`는 짧은 폴링(1.5초)으로 구현하거나 즉시 반환.
3. `storeMode()`에 새 모드 추가, Vercel 환경 변수로 연결 정보 설정. UI·도메인 코드는 그대로.
4. Web Push(P1)는 `push_subscriptions`를 같은 저장소에 두고 완료 이벤트에서 발송.

## 데이터 모드

모든 관측·예측 값은 `DataMode`를 가지고, 카드·시트에 출처를 표시합니다. `live`(실제 현장)는 연동 전까지 쓰지 않습니다.
