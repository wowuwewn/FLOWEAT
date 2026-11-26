# FLOWEAT — DKU Campus Design Reference Book

**v1.0 · 2026-11-24 · Claude Code 디자인·개발 계획용**  
대상: 단국대학교 죽전캠퍼스 혜당관 1층 1947 COMMONS

> 이 문서는 `FLOWEAT_PRD_v2.0.md`를 보완하는 레퍼런스 북이다. 제품 요구사항은 PRD를 우선한다. 이 문서의 디자인 제안은 참고 기준이며, Claude Code가 사용자 경험·가독성·완성도를 개선할 더 나은 안을 독립적으로 제안해도 된다. 첫 단계는 계획 검토이며 사용자 승인 전 디자인 변경·개발·배포를 시작하지 않는다.
>
> 자료의 상태: 공식 개관 공지, 공개 이미지 검색에서 실제로 확인한 사진, 영상 공개 설명 및 챕터, 공식 제품 디자인 문서를 정리했다. 영상 전체 프레임은 직접 재생·분석하지 못했다. 사진 원문 일부는 접근 차단(403), 운영사 페이지는 조회 실패 상태였다. 따라서 아래 링크는 참고 자료이며 전체 평면도, 최신 전체 입점 목록, 실제 메뉴 가격, 카메라 위치, POS 연동은 검증 완료로 간주하지 않는다.

## 1. 디자인 방향 — DKU Campus Edition

**단국대의 친숙함 + 1947 COMMONS의 실제 공간 + Apple의 상태 추적 + 토스의 정보 전달 + Google Maps의 위치·혼잡 안내.**

목표는 대학 공식 홈페이지의 외형을 복제하는 것이 아니라 학생이 실제 점심시간에 자연스럽게 열어볼 수 있는 상용 서비스 수준의 모바일 경험이다. 핵심 질문은 “지금 어디에서 주문하는 게 나을까?”, “먹고 싶은 메뉴는 얼마나 걸릴까?”, “내 음식은 나왔을까?”다.

| 레퍼런스 | 빌려올 원칙 | 적용 화면 |
|---|---|---|
| 단국대 | 청색 계열, 캠퍼스·혜당관·1947 COMMONS 명칭, 친숙한 한국어 | 전체 브랜드 |
| 실제 1947 COMMONS | 입구 기준 좌우 3대, 대기열 방향, 브랜드별 수령대, 원목·화이트·채광 | 키오스크 배치, 공간 안내, 메뉴 |
| Apple HIG | 한눈에 읽히는 진행 상태, 중요한 완료 알림, 접근성 | QR 등록, 내 주문, 알림 |
| Toss Design System | 큰 핵심 수치, 자연스러운 한국어, 목록·바텀시트, 상태별 일관성 | 홈, 브랜드/메뉴, 상세 화면 |
| Google Maps | 지도 레이어, 상태별 색상과 라벨, 실시간/평소/예측의 명확한 구분 | 키오스크 비교, 식당 혼잡 추이 |

## 2. 실제 공간 — 공식 근거 및 사진

### 2.1 공식 자료

| ID | 자료·링크 | 확인된 사실 및 활용 |
|---|---|---|
| DKU-01 | [신규 오픈 안내 — 단국대 총무인사팀](https://swcu.dankook.ac.kr/ko/web/kor/-390?_dku_bbs_web_BbsPortlet_action=view_message&_dku_bbs_web_BbsPortlet_bbsMessageId=148440&_dku_bbs_web_BbsPortlet_cur=30&p_p_id=dku_bbs_web_BbsPortlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal) | 2025-03-04 게시. 혜당관 1층, 2025-03-10 개장, 10개 코트와 카페. 공식 운영 구조 참고. 현재 운영시간은 별도 확인. |
| DKU-02 | [죽전 학생식당 새단장 안내 — 학교 뉴스](https://grec.dankook.ac.kr/web/kor/-550?_dku_bbs_web_BbsPortlet_action=view_message&_dku_bbs_web_BbsPortlet_bbsMessageId=15333&_dku_bbs_web_BbsPortlet_cur=24&p_p_id=dku_bbs_web_BbsPortlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal) | 2025-02-19 게시, 이후 수정. 1,505㎡, 최대 600명 이용 가능, 다양한 좌석, 올리브홀딩스 위탁 운영. 개장 당시 코트 표와 조감도. |
| DKU-03 | [개관 현장 및 식당 전경 — 학교 뉴스](https://swcu.dankook.ac.kr/ko/web/kor/-550?_dku_bbs_web_BbsPortlet_action=view_message&_dku_bbs_web_BbsPortlet_bbsMessageId=15346&_dku_bbs_web_BbsPortlet_cur=28&p_p_id=dku_bbs_web_BbsPortlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal) | 2025-03-13 개관 기사. 실제 시설 사진을 확인할 출처. |
| DKU-04 | [DKU WEBZINE 포토뉴스](https://webzine.dankook.ac.kr/news/articleView.html?idxno=377) | 실제 키오스크·내부 사진. 본문 직접 열기 403, 아래 공개 검색 사진을 확인함. |
| DKU-05 | [The Dankook Herald — Behind the Warmth of DKU’s New Food Court](https://dkherald.dankook.ac.kr/news/articleView.html?idxno=20266) | 2025년 4월 내부 사진 및 매장 사진. 본문 직접 열기 403, 아래 공개 검색 사진을 확인함. |
| DKU-06 | [총동창회 개장 전 조감도](https://dankook.or.kr/dankook-news/?bmode=view&idx=152985294) | 2025-02-21. 재료·조명·분위기의 참고 자료. 조감도는 실측도나 실제 준공 사진이 아니다. 최초 3/4 개장 예정은 이후 3/10으로 변경됨. |
| DKU-07 | [무장애 키오스크 및 식당 도우미 보도](https://biz.newdaily.co.kr/site/data/html/2026/04/15/2026041500203.html) | 2026-04-15. 접근성 기능 유지 필요. 현장의 현재 기기 수는 학생 관찰(6대)을 우선하며 보도 사진만으로 기기 총수를 추정하지 않음. |
| DKU-08 | [천안캠퍼스 동명 식당 안내 — 비교/제외 자료](https://www.dankook.ac.kr/web/kor/-550?_dku_bbs_web_BbsPortlet_action=view_message&_dku_bbs_web_BbsPortlet_bbsMessageId=166862&_dku_bbs_web_BbsPortlet_cur=13&p_p_id=dku_bbs_web_BbsPortlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal) | 2026년 리뉴얼된 천안캠퍼스 1947_commons는 별개 시설. 이번 공간 레퍼런스에 혼합하지 않는다. |

### 2.2 사진 레퍼런스 — 공개 이미지의 원문 및 원본 링크

사진은 외부 URL로 연결한 연구용 레퍼런스다. 링크가 차단되거나 변경되면 원문/공식 자료에서 확인한다. 학생 얼굴, 캐릭터, 로고, 워터마크 등 포함 가능성이 있어 제품 내 그대로 삽입하거나 AI 훈련 자료로 쓰지 않는다. 허가받은 자체 사진 또는 자체 제작 도형으로 최종 UI를 구성한다.

#### P01. 실제 키오스크 측면과 이용 방향 — DKU WEBZINE

![P01 — 실제 키오스크 측면 및 화면 방향](https://cdn.webzine.dankook.ac.kr/news/photo/202503/377_843_430.jpg)

[원본 사진](https://cdn.webzine.dankook.ac.kr/news/photo/202503/377_843_430.jpg) · [출처 기사](https://webzine.dankook.ac.kr/news/articleView.html?idxno=377)

- 창가와 통로에 설치된 키오스크의 실제 모습, 화면을 바라보는 사용자 방향을 참고한다.
- 사진 한 장으로 좌우 6대 전체의 정확한 위치와 방향을 단정하지 않는다. 좌우 3대씩, 바깥쪽 대기열이라는 학생 확인 내용을 배치의 우선 근거로 사용한다.

#### P02. 원목 파티션, 흰색 의자, 중앙 식사 공간 — The Dankook Herald

![P02 — 실제 중앙 식사 공간](https://cdn.dkherald.dankook.ac.kr/news/photo/202504/20266_10581_5321.jpeg)

[원본 사진](https://cdn.dkherald.dankook.ac.kr/news/photo/202504/20266_10581_5321.jpeg) · [출처 기사](https://dkherald.dankook.ac.kr/news/articleView.html?idxno=20266)

- 원목 파티션, 밝은 바닥, 흰색 의자, 조경 요소가 보인다.
- 식당 전체를 동일한 4인 테이블로 그리지 않는다. 구역별 혼잡을 읽을 수 있는 명료한 덩어리로 설계한다.

#### P03. 창가 및 높은 천장, 다양한 좌석 — The Dankook Herald

![P03 — 창가 식사 공간](https://cdn.dkherald.dankook.ac.kr/news/photo/202504/20266_10582_5339.jpeg)

[원본 사진](https://cdn.dkherald.dankook.ac.kr/news/photo/202504/20266_10582_5339.jpeg) · [출처 기사](https://dkherald.dankook.ac.kr/news/articleView.html?idxno=20266)

- 채광, 넓은 창, 직사각형·원형 테이블 및 조명을 참고한다.
- 2D/2.5D 지도에서 구역을 구분할 때 재질·형태를 단순화해 쓰되 정확한 위치는 추정하지 않는다.

#### P04. 실제 브랜드 수령 카운터 — The Dankook Herald

![P04 — Kitchen 101 수령 카운터](https://cdn.dkherald.dankook.ac.kr/news/photo/202504/20266_10577_5118.jpeg)

[원본 사진](https://cdn.dkherald.dankook.ac.kr/news/photo/202504/20266_10577_5118.jpeg) · [출처 기사](https://dkherald.dankook.ac.kr/news/articleView.html?idxno=20266)

- 2025년 사진에서 KITCHEN 101 간판과 민트 타일 카운터가 확인된다. 당시 매장 증거이며 2026년 11월 입점 지속 여부는 미확인이다.
- 내 주문 완료 화면에서는 확인된 브랜드 이름이 위치 정보보다 먼저 읽히게 한다. 정확한 수령 위치가 확인되면 지도에서 해당 구역을 강조한다.

#### P05. 학생식당의 실제 분위기 — DKU WEBZINE

![P05 — 실제 식당 내부와 조명](https://cdn.webzine.dankook.ac.kr/news/photo/202503/377_849_432.jpg)

[원본 사진](https://cdn.webzine.dankook.ac.kr/news/photo/202503/377_849_432.jpg) · [출처 기사](https://webzine.dankook.ac.kr/news/articleView.html?idxno=377)

- 벽돌, 격자창, 선형 조명과 원목 요소가 어우러지는 실제 분위기 참고.
- 사진 속 개인이나 캐릭터는 제품 이미지의 모티프로 직접 복제하지 않는다.

#### P06. 개장 전 조감도 — 총동창회

![P06 — 개장 전 조감도](https://cdn.imweb.me/upload/S20200729a607cbee3063e/a957fac56f1a2.png)

[원본 이미지](https://cdn.imweb.me/upload/S20200729a607cbee3063e/a957fac56f1a2.png) · [출처](https://dankook.or.kr/dankook-news/?bmode=view&idx=152985294)

- 조명·재료·전반적인 인테리어 방향 참고. 최종 공간 배치의 근거로 사용하지 않는다.

#### P07. 개장 당시 브랜드 안내표 — 학교 뉴스

![P07 — 개장 당시 코트 안내표](https://grec.dankook.ac.kr/html_portlet_repositories/images/ExtImgFile/10158/10185/3360663/156125.jpg)

[원본 이미지](https://grec.dankook.ac.kr/html_portlet_repositories/images/ExtImgFile/10158/10185/3360663/156125.jpg) · [출처](https://grec.dankook.ac.kr/web/kor/-550?_dku_bbs_web_BbsPortlet_action=view_message&_dku_bbs_web_BbsPortlet_bbsMessageId=15333&_dku_bbs_web_BbsPortlet_cur=24&p_p_id=dku_bbs_web_BbsPortlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal)

- 공개 이미지 검색에서 보인 일부 코트 표를 근거로 한다. 원본 전체 직접 열기 실패. 현재 입점표 또는 물리적 배치 순서로 간주하지 않는다.

## 3. 영상 자료 — 공개 영상 3편 및 탐색 채널

영상 자체를 다운로드하거나 전체 프레임을 분석한 자료는 아니다. 영상 페이지의 제목·공개 설명·챕터를 확인했다. 아래의 시점은 공식 영상 설명에 기재된 구간이다. Claude Code 또는 팀원이 영상 재생 가능한 환경에서 추가 검토할 때 사용한다.

| ID | 영상 | 활용 방법 |
|---|---|---|
| V01 | [GaekGa World — 학식 어디까지 가 보았니? 단국대학교 학생식당](https://www.youtube.com/watch?v=uzdUhyhCeEE) · 2025-04-25 | 방문객이 실제 입장·메뉴·식사를 경험하는 모습의 참고 자료. 영상 전체를 보며 입구, 키오스크, 번호표, 카운터, 통로의 연결 관계를 확인할 것. 정확한 해당 장면 시각은 미확인. |
| V02 | [단국대학교 공식 — 단책부록 1947 COMMONS 모든 식당 리뷰](https://www.youtube.com/watch?v=XLXJ5kCpRYc) · 2025-03-28 | [2:07 식당 입장](https://www.youtube.com/watch?v=XLXJ5kCpRYc&t=127s), [3:11 중식대장 소개](https://www.youtube.com/watch?v=XLXJ5kCpRYc&t=191s), [4:36 메뉴 소개](https://www.youtube.com/watch?v=XLXJ5kCpRYc&t=276s), [5:40 이전과 달라진 점](https://www.youtube.com/watch?v=XLXJ5kCpRYc&t=340s), [7:23 메뉴 시식](https://www.youtube.com/watch?v=XLXJ5kCpRYc&t=443s). 실제 브랜드·입장 흐름·메뉴 참고. 챕터 자체는 설명란에서 확인. |
| V03 | [단대신문 영상부 단국온 — 리뉴얼된 학생식당, 직접 체험해봤습니다!](https://www.youtube.com/watch?v=0qhttHQPc8g) · 2025-03-18 | 학생 시점의 리뉴얼 현장 취재. 실사용 방식, 주문 안내 및 내부 공간 확인 후보. |

추가 탐색 채널: [단국온 인스타그램](https://www.instagram.com/dku_onair/) · [구시아푸드마켓 운영 매장](https://www.gusia.co.kr/stores/) · [구시아푸드마켓 브랜드](https://www.gusia.co.kr/brands/). 이번 확인에서는 해당 인스타그램 개별 릴스의 정확한 영상·운영사 페이지 내용을 확보하지 못했다. 링크는 미검증 탐색 경로이며 입점 확정의 근거가 아니다.

영상 검토 기록을 추가할 때는 `영상 ID / 시각 / 화면에 보이는 사실 / 불확실성 / 앱에 반영할 사항` 형식으로 작성한다. 서로 다른 연도 자료가 충돌하면 현재 학생 관찰 및 최신 현장 확인을 우선한다.

## 4. 브랜드·메뉴 레퍼런스 — 검증 수준 구분

| 상태 | 브랜드 | 범주 또는 근거 | 화면에 넣는 원칙 |
|---|---|---|---|
| 현재 학생 확인 | 비비고고 | 비빔밥, 사용자 현장 확인 + 개장 표의 8코트 | 실제 브랜드 이름 사용 가능. 메뉴명/가격/사진/코트 위치는 별도 확인 |
| 현재 학생 확인 | 가오슝 | 사용자가 현재 입점이라고 설명 | 실제 브랜드 이름 사용 가능. 세부 메뉴·위치 미확인 |
| 2025 개장 자료 | 중식대장 | 3코트, 중화요리. 공식 영상 3:11에도 등장 | 현재 입점 여부 재확인 후 실제 브랜드로 사용 |
| 2025 개장 자료 | 폭풍분식 | 4코트, 분식 | 위와 동일 |
| 2025 개장 자료 | 값찌개 | 5코트, 찌개 | 위와 동일 |
| 2025 개장 자료 | 경성카츠 | 6코트, 돈가스 | 위와 동일 |
| 2025 개장 자료 | 51장국밥 | 7코트, 국밥 | 위와 동일 |
| 2025 개장 자료 | 1847 SALWICH COFFEE | 9코트, 커피·디저트 (표에 보이는 표기) | 위와 동일. 식당 주문 시스템과 동일한지는 미확인 |
| 2025 실제 사진 | Kitchen 101 | 카운터 간판 확인 (P04) | 현재 입점 여부 재확인 |
| 이전 조사 후보 | 바비든든, 포포420, 광뚝 등 | PRD v2.0의 참고 후보. 최신 죽전점 정보 미확인 | 실제 입점 브랜드로 단정하지 말 것 |
| 2025 방문 영상 설명 | 든든밥심 | V01 공개 설명에 등장 | 정확한 현재 명칭·메뉴와 가격 재확인 |

위 표는 **현재 전체 입점 리스트가 아니다.** 학교 개관 자료의 10개 매장+카페 수는 개장 시점의 시설 정보다. 과거 코트 번호로 현재 수령대 위치를 자동 추정하지 않는다. 가오슝이 특정 옛 매장을 대체했다는 근거도 없다.

### UI에 반영할 메뉴 구조

- 브랜드 탐색을 기본으로 하되 전체 검색 및 메뉴별 예상 준비시간 비교가 가능해야 한다. 메뉴가 많으므로 홈에서 모든 메뉴를 한꺼번에 나열하지 않는다.
- 브랜드 요약시간과 개별 메뉴 준비시간의 정의를 구분한다. 시간 예측은 주문 후 완료 기준이다.
- 현재 운영 중인지 검증된 브랜드/메뉴와 시연용 예시 데이터를 구분한다. 실제 가격이나 사진을 확보하지 못했으면 값을 꾸며 넣지 않는다.
- 메뉴 사진은 직접 촬영하거나 사용권을 확인한 자료를 선택한다. 공식 자료의 로고·음식 이미지는 참고용으로 링크만 사용한다. 제품에 무단 복제·핫링크하지 않는다. 필요한 경우 자체 아이콘·이름 중심으로 구성한다.
- 별도 친구 그룹, 모바일 주문/결제, 품절 중심 기능을 새로 추가하지 않는다.

## 5. 공간 배치 및 위치 안내 — 구현용 근거

### 5.1 확인된 상대적 구조

사용자가 설명하고 확인한 구조: 정문으로 들어가면 좌우에 3대씩, 개별 대기열은 중앙이 아닌 바깥쪽으로 이어진다. 총 6대, 모든 기기에서 동일 메뉴 주문 가능, 실제 기기 번호 없음. 아래는 **상대적인 방향만** 나타낸 개념도다.

```text
                   식당 내부 방향 (정확한 통로·수령대 미확정)

대기열 → [키오스크]         │         [키오스크] ← 대기열
대기열 → [키오스크]         │         [키오스크] ← 대기열
대기열 → [키오스크]         │         [키오스크] ← 대기열
                           정문 기준
```

학생이 실제 사진 기준으로 정확한 배치와 거리, 출입구 형태를 확인하기 전에는 정교한 전체 평면도를 만들어 실제 도면으로 표현하지 않는다. 외곽 치수·각도·카메라 위치·모니터 위치·매장 순서·테이블 수는 미확정이다.

### 5.2 디자인 추천 (Claude Code가 더 좋은 안을 제시해도 됨)

1. 우선 모바일에서 입구 방향과 좌우 3대를 한눈에 파악할 수 있는 평면형 안내를 만든다. 특정 기기 숫자를 현장 번호로 노출하지 않는다. 내부 데이터 ID는 L1–L3/R1–R3 등으로 관리한다.
2. 각 대기 영역에 대기 인원 추정과 예상시간 범위를 표시한다. 동일한 기준을 써서 비교하고, 예측 차이가 작으면 동급으로 보인다. 한 기기만 과도하게 강조해 새 혼잡을 유발하지 않는다.
3. 원목·창가 등의 특징은 실제 구역을 확인한 뒤 식당 전체 지도에 반영한다. 구역별 테이블 점유 정보는 선택 가능한 레이어로 제공한다. 가림/미관측은 회색·텍스트로 표시한다. 빈자리 확보는 보장하지 않는다.
4. 브랜드 수령대의 정확한 위치가 확인되지 않으면 이름과 주문번호로 안내한다. GPS 위치나 실내 측위가 확보되지 않았으므로 임의의 현재 위치 점, 실시간 턴바이턴 경로, 거리 수치를 표시하지 않는다.
5. 2D 우선, 2.5D/아이소메트릭은 휴대폰에서 6개 대기열과 수치가 더 읽히는 경우에 선택한다. 장식적인 3D 렌더가 핵심 정보 가독성을 해치면 사용하지 않는다.

실제 배치 정보가 나중에 수정되더라도 UI 코드를 다시 짜지 않도록 위치·구역·기기 방향·영상 분석 영역을 설정 데이터로 분리하는 것이 좋다.

## 6. 단국대 브랜드와 인테리어의 디자인 언어

공식 UI 참고: [단국대학교 기본 UI 소개](https://dankook.ac.kr/dku_ui), [UI 규정](https://rule.dankook.ac.kr/service/law/lawFullScreenContent.do?historySeq=1538&seq=55). 학교 UI 자산 사용·변형은 공식 관리 기준을 따른다. 단국대 공식 서비스라는 인상을 주는 무단 로고, 캐릭터, 엠블럼 사용을 피하고 자체 워드마크와 프로젝트 표시를 사용한다.

### 권장 독자 팔레트 (공식 단국대 색상값 아님)

| 역할 | 제안 색상 | 참고 |
|---|---|---|
| Campus Navy | `#0B2454` | 단국대 청색 정체성에서 영감, 핵심 제목/브랜드 |
| Flow Blue | `#2663D9` | 주요 행동 및 선택된 지도 레이어 |
| Ice Blue | `#EAF1FF` | 정보 강조의 연한 배경 |
| Cloud White | `#F5F7FB` | 기본 화면 배경 |
| Surface | `#FFFFFF` | 명료한 콘텐츠 영역 |
| Warm Oak | `#D5B99C` | 실제 원목 파티션에서 영감, 지도 재질/보조 요소 |
| Text | `#14213B` | 본문·수치 |
| Muted | `#63728B` | 보조 설명, 대비 검증 필요 |
| 상태 | 녹색/주황/적색/회색 | 여유/보통·혼잡/매우 혼잡/정보 부족, 반드시 텍스트 동반 |

색상은 권장안이며 Claude Code가 대비와 실제 인테리어 조화를 기준으로 수정 가능하다. 청색은 브랜드와 선택 강조에, 혼잡 색상은 상태 표현에 분리한다. 로고는 기존 시안의 흐름/대기열 모티프를 참고해도 되지만 독자적이고 간결해야 한다. Pretendard, Noto Sans KR 또는 플랫폼 기본 한글 서체 등 라이선스와 실제 기기 렌더링이 적절한 서체를 선택한다. 숫자 변화 시 폭이 튀지 않도록 tabular numerals를 지원한다.

기존 [Figma 시안](https://www.figma.com/design/I2qglBkC3XmRiDfH0GJ3eK)은 컬러/주문 추적의 참고용이다. 현재의 정확한 6대 상대 배치와 브랜드별 메뉴 탐색 등 최신 기획을 모두 반영한 것이 아니다. 반드시 따라 만들 필요 없다.

## 7. Apple — 주문 추적과 완료 알림 레퍼런스

| ID | 공식 레퍼런스 | 관찰·적용 포인트 |
|---|---|---|
| A01 | [Human Interface Guidelines: Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities?changes=_8) | 짧은 활동의 상태를 한눈에 확인, 중요한 변화만 알림. 내 주문 카드와 지속 추적 UX에 적용. |
| A02 | [HIG: Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications) | 간결하고 가치 있는 알림, 중복 알림 방지, 권한 동의, 전면 상태 반영. |
| A03 | [HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography) | 글자 크기·굵기로 계층 형성, 확대 대응, 대비·가독성. 번호·예상시간에 적용. |
| A04 | [HIG: Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/) | 필요한 정보 우선, 일관된 구조, 세심한 상호작용과 반복 개선. |
| A05 | [ActivityKit: Displaying live data](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities?changes=_6) | 실제 iOS Live Activities가 네이티브 위젯 확장, SwiftUI/WidgetKit/ActivityKit 기반임을 확인하는 기술 참고. |

**FLOWEAT 적용:** QR 주문 연결 후 주문번호와 브랜드가 핵심이다. 접수/완료 대기/준비 완료는 실제 이벤트로 변경한다. 실제 조리 시작 이벤트가 없다면 진행률을 임의 생성하지 않는다. 완료 시 상태 변화, 색과 텍스트, 한 번의 알림으로 알려준다. 여러 주문이면 개별 상태를 구분한다. 해당 주문 상세로 이동할 수 있어야 한다.

웹/PWA MVP에서는 앱 내부의 지속 주문 카드 및 실시간 알림 UX에 먼저 적용한다. iPhone 잠금화면/Dynamic Island의 실제 Live Activities를 구현했다고 주장하려면 네이티브 기능 및 실기기 검증이 필요하다. 디자인 유사성만으로 OS 통합을 시연했다고 주장하지 않는다. Apple 고유 로고, 시스템 폰트 파일, 스크린샷, 아이콘을 그대로 앱 에셋으로 복제하지 않는다.

## 8. 토스 — 학생 홈과 브랜드/메뉴 정보 구조

| ID | 공식 레퍼런스 | 관찰·적용 포인트 |
|---|---|---|
| T01 | [Toss Design System Mobile](https://tossmini-docs.toss.im/tds-mobile/) | 공통 컴포넌트·일관된 인터랙션·템플릿으로 품질 유지. |
| T02 | [토스 디자이너가 제품에만 집중할 수 있는 방법](https://toss.tech/article/toss-design-system) | 섬세한 등장/퇴장, 터치 피드백, 팝업의 가벼운 표현. |
| T03 | [ListRow 이해하기](https://tossmini-docs.toss.im/tds-mobile/components/ListRow/list-row-overview/) | 좌측 식별 요소/중앙 정보/우측 상태·시간을 구분하는 목록. |
| T04 | [ListRow 영역 구성](https://tossmini-docs.toss.im/tds-mobile/components/ListRow/list-row-components/) | 메뉴·가격·예상시간의 정렬 및 썸네일 활용, 여러 줄 계층. |
| T05 | [BottomSheet](https://tossmini-docs.toss.im/tds-mobile/components/bottom-sheet/) | 페이지 이탈 없이 필요한 상세 정보 제공, 닫기와 접근성 고려. |

**FLOWEAT 적용:** 홈의 첫 화면에서 지금 학식 상태와 주요 주문 대기 정보, 진행 중인 내 주문을 우선 배치한다. 브랜드 목록에는 이름, 음식 종류, 준비 예상시간을 명확히 정렬하고 검색·상세 진입을 제공한다. 지도에서 키오스크를 누르면 대기 추정 범위와 갱신 시각을 가벼운 상세 패널로 볼 수 있다. 숫자·상태의 변화를 자연스럽게 반영하고, 스켈레톤/오류/오프라인/데이터 없음도 완성한다. 실제 제품처럼 짧고 자연스러운 한국어를 사용한다. 중첩 카드 남용, 지나치게 많은 배지, 그라디언트·블러 남용은 피한다. 토스 상표나 전용 그래픽·앱 화면을 복제하거나 TDS 패키지의 사용권을 확인하지 않고 포함하지 않는다.

## 9. Google Maps — 위치 및 실시간 혼잡 UX

| ID | 공식 레퍼런스 | 관찰·적용 포인트 |
|---|---|---|
| G01 | [Google Maps: Traffic layers](https://support.google.com/maps/answer/3092439?co=GENIE.Platform%3DAndroid&hl=en) | 상태별 색상과 지도 레이어를 이용한 빠른 상황 비교. |
| G02 | [Google Maps: Busy areas](https://support.google.com/maps/answer/11323117?hl=en) | 혼잡 지역의 시각적 표시, 상세 시간대 차트, 정보가 부족할 때 미표시, 개인 위치 비공개 원칙. |
| G03 | [Google Business Profile: Popular times, wait times & visit duration](https://support.google.com/business/answer/6263531?hl=en) | 평상시 시간대 패턴과 현재 상황의 차이를 그래프로 구분. |
| G04 | [Google Maps Indoor: FAQ](https://maps.google.com/help/maps/indoormaps/faqs.html) | 실내 평면과 매장명 등 위치 라벨을 이용한 탐색. |
| G05 | [Use indoor maps to view floor plans](https://support.google.com/maps/answer/2803784?co=GENIE.Platform%3DAndroid&hl=en-NE) | 실내 지도의 확대·상세 탐색 방식 참고. |

**FLOWEAT 적용:** 정문 기준 좌우 3대의 상대 배치를 기본 지도 위에 표시한다. 대기열의 인원과 예상시간을 비교할 수 있게 하며, 가장 짧은 줄과 가장 빠를 것으로 예측되는 줄이 다를 수 있음을 표현한다. 색상 이외에 시간과 상태 텍스트를 표시한다. 현재 관측값, 과거 추이, 5~15분 단기 예측은 시각적으로 구분하고 예측 범위/갱신 시각을 보여준다. 데이터 부족이면 예측을 숨기고 관측값만 보여준다. 구역별 테이블 혼잡 지도는 실측 위치 확보 이후 고도화한다.

Google Maps 실제 지도 API나 실내 지도 데이터가 있어야 한다는 의미는 아니다. 자체 SVG/Canvas/HTML 등으로 식당의 단순화된 지도와 레이어를 구현하는 안이 적합할 수 있다. Google의 지도 타일·로고·고유 에셋을 무단 복제하지 않는다. 1947 COMMONS의 실내 지도가 Google에 등록되었다는 근거는 없다.

## 10. 화면별 레퍼런스 적용 매트릭스

| 화면 | 핵심 참고 | 반드시 지킬 사용자 경험 |
|---|---|---|
| 학생 홈 | DKU-02, A04, T01, G02 | 방문 전 현재 상태 파악. 주문 대기·테이블 혼잡·메뉴·내 주문을 정보 우선순위로 구성. 활동 주문이 있다면 눈에 띄게 표시. |
| 키오스크 비교 | P01, 학생 확인 배치, G01/G04, T05 | 좌우 3대씩 개별 줄, 위치 기반 예상시간/인원 비교. 학생은 앱에서 주문하지 않는다. |
| 식당 혼잡 | P02/P03/P05, G02/G03 | 테이블/구역 혼잡과 관측 범위, 현재와 추이 구분. 예약·빈자리 보장 금지. |
| 브랜드·메뉴 | P04/P07, V02, T03/T04 | 실제 확인 브랜드 중심. 검색·분류·예상 준비시간, 가격 및 사진 검증. |
| 주문 추적/완료 | A01/A02/A03, T02 | QR 스캔 후 복수 주문 개별 표시, 완료 이벤트 즉시 반영. 알림 권한과 제한을 알림. |
| 모의 키오스크 | P01, DKU-07, T01 | 기존 메뉴/주문 UX 유지, 준비시간을 간단히 추가, 브랜드별 번호표 QR. 실제 결제 없음. 접근성 유지. |
| 직원/공용 호출 모니터 | 학생 관찰, P04 | 기존 직원 완료 처리 한 번, 공용 모니터는 완료 번호만, 앱에도 완료 이벤트 전달. |
| AI 운영/시연 | P01/P02, G01 | 영상 인식 영역과 인원/테이블 상태·갱신이 연결됨을 검증. 학생용 화면과 운영/시연 모드 분리. |

## 11. Claude Code의 디자인 계획 평가 기준 (제안, 구현 지시 아님)

- 시각적 완성도보다 먼저 3초 안에 주요 상태를 읽을 수 있는지 확인한다. 홈 상단에 과도한 문구나 장식적인 AI 그래픽을 넣지 않는다.
- 학생의 이동을 방해하지 않는 모바일 UX: 한 손 조작, 충분한 터치 범위, 스크롤·지도 확대 동작 충돌 방지, 접근성 및 모션 감소 지원.
- 지도와 메뉴를 통해 사용자가 판단하도록 한다. 과거에 제외한 시간표·강의실 이동시간 계산, 예약·대기 등록, 친구 그룹, 챗봇, 모바일 결제를 다시 넣지 않는다.
- 예측값 범위, 갱신 시각, 정보 부족, 관측 범위를 간결하고 일관되게 표현한다. 데모 데이터는 항상 실제 데이터와 구분한다.
- 실제 식당 시스템과 연동되지 않은 상태에서 LIVE라는 표현으로 실제 학식 실시간 데이터를 제공한다고 오인시키지 않는다. 데모의 실시간 갱신과 실제 현장 연동은 별개다.
- 디자인은 Apple/Toss/Google의 좋은 패턴을 재해석하여 독자 브랜드로 만든다. 단순히 세 회사의 화면을 나란히 붙인 결과를 피한다.
- 여러 화면의 실제 기능 연결이 중요하다. 카메라 인식 결과 → 학생 화면 → 모의 키오스크의 QR → 직원 완료 처리 → 개인 주문 알림의 일관된 흐름을 디자인한다.
- 기존 Figma 시안의 색·레이아웃을 개선하거나 대체할 수 있다. 화면 수, 기술 스택, 지도 구현, 상세 인터랙션은 PRD를 만족하는 한 Claude Code의 제안을 검토한다.

## 12. 추가로 확보하면 좋은 최소 현장 자료

아래는 전체 레퍼런스를 다시 조사하라는 의미가 아니다. **정확한 지도·브랜드 표시를 위해 아직 부족한 정보**만 정리했다. 기획 및 개발 계획 수립은 지금 문서만으로 진행 가능하다.

| 우선순위 | 자료 | 필요한 이유 |
|---|---|---|
| 1 | 정문에서 양쪽 키오스크 3대와 줄 방향을 각각 확인할 수 있는 사진 또는 손그림 | 정확한 좌우 배치와 화면 방향, 학생 동선 |
| 2 | 실제 브랜드 목록·메뉴판 사진 또는 학교 앱 캡처 | 현 입점 브랜드, 메뉴명·가격 검증 |
| 3 | 식당 내부의 간단한 스케치 및 수령대 위치 | 전체 지도·브랜드 위치 정확도 개선 |
| 4 | 개인정보 없는 번호표 및 완료 모니터 예시 | QR 번호표 개선과 실제 호출 UI 반영 |
| 5 | 운영자 협조 여부 및 카메라 시야 | 실제 배포 단계에서만 필요. 이번 시제품은 승인된 연출 영상/모의 시스템으로 검증 |

촬영 시 다른 학생의 얼굴, 결제정보, 주문 조회 토큰, CCTV 화면 등의 민감한 정보를 가리지 않은 채 공유하지 않는다. 무단 촬영·CCTV 접근·자료 다운로드를 강요하지 않는다. 공개 자료의 이용 조건을 확인한다.

## 13. Claude Code에 전달할 때 읽는 순서

1. `FLOWEAT_PRD_v2.0.md` — 필수 기능, 제약, 검증 기준.
2. 이 문서 — 공간 사실, 사진·영상 출처, 제품 디자인 참고.
3. (선택) 기존 Figma 시안 — 시각 방향의 참고용, 그대로 구현할 의무 없음.

계획 단계에서는 현재 근거로 표현할 수 있는 공간 정보와 추가 현장 확인이 필요한 영역을 나누고, 레퍼런스를 어떤 화면에 적용할지 명확히 설명한다. 자료 간 충돌이 있다면 최신 사용자 확인과 공식 근거의 시점을 구분하고 대안을 제안한다. 최종 개발용 프롬프트는 별도 작업에서 사용자의 확인 후 작성한다.
