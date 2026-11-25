# 현장 측정값으로 보정하는 방법

시뮬레이션과 예측 모델이 쓰는 모든 가정은 `src/core/data/calibration.json` 한 파일에 있습니다. 각 묶음의 `source`가 `"assumed"`이면 아직 가정값입니다. 측정값으로 바꾼 뒤 `"field"`와 측정 날짜를 적어 주세요.

| 묶음 | 무엇을 재나 | 방법 (예) | 바꿀 값 |
|---|---|---|---|
| `arrivals` | 5분 단위 입장 일행 수 | 정문에서 계수기, 3일 이상 | `basePerMin`, `peak1PerMin`, `peak1Center`, `peak1SigmaMin` … |
| `groups` | 일행 크기, 같이 결제하는 비율 | 관찰지 50팀 | `weights`, `payTogether` |
| `kiosk` | 결제 1건 시작–끝 시간, 기기별 | 키오스크 로그 또는 스톱워치 30건/대 | `txMedianSec`, `logSd`, `speed.L1…R3` (기기 중앙값 ÷ 전체 중앙값) |
| `kitchen` | 접수 → 완료 시간, 브랜드·메뉴별 | KDS 로그 또는 번호표 시각 | `cookBaseSec`, `brands.*.cooks`, `eff` |
| `plausibility` | 화면에 보여도 되는 상한 | 측정 최대값 + 여유 | `maxPeoplePerLine` 등 |

바꾼 뒤 확인:
```bash
npx tsx scripts/sim-sanity.ts peak     # 줄 길이·대기·준비시간이 측정과 비슷한지
npm test                               # 상한 테스트
npx tsx scripts/check-models.ts        # 예측 모델 재검증
```
카메라 집계 오차(`src/core/data/count-error.json`)도 실제 연출 영상 라벨이 생기면 `npm run vision:bench` 결과로 교체합니다.
