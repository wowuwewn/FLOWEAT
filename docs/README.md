# FLOWEAT 문서

개발 중 계속 갱신하는 문서 모음입니다. 날짜가 있는 기록은 덮어쓰지 않고 새 파일로 남깁니다.

| 폴더 | 내용 | 갱신 규칙 |
|---|---|---|
| [product/](product/) | PRD v2.0 원본, [설계 결정 기록](product/decisions.md) | PRD는 원본 보존. 결정이 바뀌면 decisions.md에 새 항목 추가 |
| [design/](design/) | 디자인 레퍼런스 원본, [디자인 시스템 v1](design/design-system.md), [레퍼런스 검수 v2와 개선 방향](design/reference-review-v2.md) | 토큰·컴포넌트가 바뀌면 design-system.md 갱신 |
| [evidence/](evidence/) | 현장 인수인계팩 원본, [2026-11-25 현장 자료 반영](evidence/field-2026-11-25/README.md), [자료 충돌](evidence/discrepancies.md), [미확인 사항](evidence/open-questions.md) | 현장 확인이 생기면 open-questions.md의 상태를 바꾸고 출처를 적음 |
| [architecture/](architecture/) | [전체 구조·저장소·실시간](architecture/overview.md) | 어댑터·API가 바뀌면 갱신 |
| [ai/](ai/) | [영상 인식](ai/vision.md), [예측 모델](ai/prediction.md), [현장 보정 방법](ai/calibration.md), [평가 결과](ai/evaluation/) | 평가를 다시 돌리면 evaluation/에 결과 저장 |
| [demo/](demo/) | [심사 가이드](demo/judge-guide.md), [시연 운영](demo/runbook.md), [촬영 가이드](demo/filming-guide.md) | 시연 흐름이 바뀌면 갱신 |
| [qa/](qa/) | [테스트 계획·실기기 체크리스트](qa/test-plan.md) | 테스트 결과는 qa/reports/에 날짜별 |
| [dev-log/](dev-log/) | 생성형 AI(Claude Code) 활용 개발 기록 | 작업일마다 한 파일 |
| [process/](process/) | [생성형 AI 활용 기록](process/ai-usage.md), [팀 역할 기록](process/team-roles.md) | 역할·검수 상태가 바뀌면 갱신 |

## 데이터 상태 표기 원칙

- `simulated` 시뮬레이션 / `recorded_inference` 테스트 영상 AI 분석 재생 / `staged_live` 연출 영상 실시간 분석 / `live` 실제 현장 연동(현재 없음)
- 확인되지 않은 공간·브랜드·가격 정보는 `null`로 두고 화면에서 숨기거나 "참고"로 표시합니다.
