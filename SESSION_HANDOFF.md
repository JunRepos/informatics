# 🔄 세션 핸드오프 문서

> 이 세션에서 추가/변경한 모든 작업의 요약.
> 새 세션을 열어서 이어서 작업할 때 **이 문서 + PROJECT_CONTEXT.md** 만 읽으면 컨텍스트 완전 복원 가능.

## 📅 세션 메타

- **시작**: 2026-05-04
- **마지막 커밋**: `3a04049` (노트북: 선생님이 셀 편집하면 학생에게 자동 반영)
- **작업한 브랜치**: `claude/vigilant-mirzakhani-0a9364` (워크트리)
- **배포 경로**: `git push origin claude/vigilant-mirzakhani-0a9364:main` → GitHub Pages 자동 배포
- **git config** (이 저장소만): `user.name=JunRepos / user.email=chlwns1023@gmail.com`

---

# 📦 이 세션에서 추가한 새 메뉴/기능

## 1. 🔍 코드 읽기 (Code Reading) — 정보반 신규 탭

학생이 코드를 *읽고 해석* 하는 새 학습 메뉴 (작성 X, 읽기 O).

### 두 가지 문제 유형
| 유형 | 학생이 하는 것 | 채점 방식 |
|---|---|---|
| **🔮 출력 예측 (predict)** | 코드 보고 stdout 결과 텍스트로 입력 | 정답 stdout과 문자열 비교 |
| **🔍 변수 추적 (trace)** | 각 단계 줄 실행 후 변수 값 입력 | repr 정답과 비교 (공백/따옴표 관대) |

### 핵심 파일
- `js/views/coderead.js` — 학생/교사 뷰
- `js/events/coderead.js` — 이벤트 + 예제 묶음 데이터 (`CR_SAMPLE_PACKS`)
- `js/coderead-runner.js` — 메인 측 워커 호출 + 흥미로운 단계 자동 선택
- `js/coderead-worker.js` — Pyodide + `sys.settrace` 로 줄별 변수 스냅샷

### 선생님 UX
1. **코드만 등록하면 정답 자동 추출** — Pyodide가 실행해 stdout / 줄별 변수 캡처
2. **🪄 자동 분석 미리보기** 버튼 — 등록 전 결과 확인
3. **예제 묶음 카드** (📥 표준입출력·자료형·산술 5문제 / 📋 리스트 5문제) — 클릭 한 번에 일괄 등록

### 학생 UX (`vStCRSolve`)
- 좌: 코드 (줄번호 + 읽기 전용)
- 우: 문제 입력칸 + 통과 시 🎉, 실패 시 친절한 안내
- **`predict` 타입은 stdin이 학생 화면에 노란 박스로 표시** (학생이 입력값 보고 추측 가능)

### 데이터 모델
```
codeReadings/{cid}/{rdId}
  { id, title, description, code, stdin?, type, expectedOutput?, traces?, createdAt }

codeReadingProgress/{cid}/{rdId}/{studentNum}
  { passed, attempts, lastAttempt, updatedAt }
```
**Firebase 규칙 추가** — `database.rules.json` 게시 필요.

### Trace 정답 매칭 관대화 (`_matchTraceValue`)
- 큰따옴표 ↔ 작은따옴표 자동 정규화
- 리스트 `[10,20]` ↔ `[10, 20]` 공백 차이 흡수
- 학생이 다양한 표기로 답해도 통과

---

## 2. 🗄️ 떨어지는 사물함 미션 — 액션 게임 (3차시 리스트)

리스트 학습용 진짜 액션 게임. (사물함 마스터는 시각화에 가까웠다는 사용자 피드백 후 신규 작성)

### 게임 메커니즘
- 화면 위에서 이모지 떨어짐 (사과 🍎, 책 📚, 별 ⭐, 폭탄 💣...)
- 학생이 `lockers = [...]` 정의 → 그 종류만 자동 받음
- 위험 이모지(💣)를 lockers에 넣으면 받아서 ❤️ -1
- 8단계: 만들기 / append / insert / 인덱싱 수정 / pop·remove / 슬라이싱 / sort+len / 2차원 grades

### 이모지 팔레트 (필수)
학생이 이모지를 직접 찾기 어려우므로 **코드 에디터 위에 클릭 가능한 이모지 버튼** 표시:
- 단계별 `emojiPool` 에서 자동 노출
- 안전(초록)/위험(빨강) 색상 구분
- 클릭 시 `navigator.clipboard.writeText` + 토스트 "복사됨!"

### 핵심 파일
- `js/games/lockerdrop.js` — 캔버스 게임 엔진 (`applyState` 패턴)
- `js/views/mission.js` — `getLockerDropSampleMission()`, `vMiEmojiPalette()`, GAME_TYPES 등록
- `js/events/mission.js` — `_applyLockerDropState`, 이모지 복사 핸들러

### 시스템에 남아 있는 게임 종류 (GAME_TYPES)
- 🐦 플래피버드 (1·2차시 산술)
- ⚔️ 타입헌터 (1차시 자료형)
- 🗄️ 떨어지는 사물함 (3차시 리스트)
- ~~사물함 마스터~~ — **삭제됨** (시각화 도구라 게임성 부족 피드백)

---

## 3. 💻 OJ — 다섯 가지 큰 개선

### 3-1. 순서 변경 ▲▼
- 선생님 OJ 목록 각 행 우측에 ▲▼ 버튼
- 두 문제의 `createdAt` swap (DB 스키마 변경 없음)
- 정렬은 `createdAt` 오름차순 (등록한 순서대로 학생에게 표시)

### 3-2. 사전 코드 (starterCode)
- 등록 폼에 사전 코드 입력 textarea
- `description` 첫 줄에 `<!-- starter:base64 -->` 로 인코딩 저장 (DB 스키마 그대로)
- `loadOJProblems` 가 로드 시 자동 디코드해서 `obj.starterCode` 로 복원
- 학생 풀이 화면 진입 시 사전 코드가 OJ_CODE 초기값으로
- 학생이 **초기화** 버튼 누르면 사전 코드로 되돌림

### 3-3. 실시간 input() (Colab 스타일)
**가장 큰 변경**. 학생이 ▶ 코드 실행 시:
- `input()` 만나면 결과 패널에 **노란 입력 박스** 등장
- 학생이 값 입력 + Enter → 워커에 전달 → 계속 실행
- "미리 입력값" 비우면 실시간, 채우면 자동 (예전 동작)

### 구현 (oj-worker.js + events/oj-actions.js)
- **SharedArrayBuffer + Atomics.wait** (노트북 워커와 같은 패턴)
- 메인이 `init-stdin` 메시지로 SAB 전달 → 워커는 `crossOriginIsolated` 환경에서만 SAB 활성
- Python `builtins.input` 을 직접 오버라이드해 `_oj_js_request_input(prompt)` 호출 → 메인에 prompt 포함 메시지
- SAB 미지원 환경(첫 방문/시크릿)에서 워커가 `undefined` 반환 → Python `None` → `RuntimeError` → friendlyOJError가 "새로고침 안내" 표시

### 캐시 무효화
- `OJ_WORKER_VER` 상수 (`events/oj-actions.js`) — 워커 코드 바꾸면 이 값 올려서 학생 브라우저에 새 워커 강제 로드
- 현재 값: `'20260516-input-fallback'`

### 3-4. 수정 시 다른 반에 복사 등록
- OJ 문제 ✏️ 수정 화면 하단에 "📋 다른 반에도 복사 등록" 체크박스
- 체크된 반에 새 ID로 같은 문제 등록 (현재 반은 update만)

### 3-5. 23문제 한방 등록 (전체 진도)
선생님 OJ 탭 우상단 **📦 23문제 한방 등록 (전체 진도)** 버튼:
- `js/oj-problems-data.js` 의 `OJ_23_PROBLEMS` 배열 23문제 일괄 등록
- 사전 코드 / 테스트 케이스(공개·숨김) / 마크다운 설명 모두 포함
- 분포: 변수·자료형 2 / 입출력·산술 4 / 리스트 5 / 조건문 3 / 반복문 4 / 종합 5
- 학생이 split·map 미학습이라 **모든 split·map 사용 줄 위에 한국어 주석 부착**
- 등록 후 ▲▼로 순서 자유 조정 가능

---

## 4. 🎨 비주얼 OJ — 시각화 위젯 인프라

학생이 OJ 푸는 동안 좌측에 **시각적 결과** 가 함께 보이는 새 패턴.

### 작동 흐름
1. OJ 문제에 `visualType` 메타 (description 첫 줄에 `<!-- visual:위젯ID -->` 인코딩)
2. 학생 풀이 화면 좌측에 `<canvas id="oj-visual-canvas">` 추가
3. 학생 코드 실행 후 stdout → 위젯 호출 (입력은 stdin, 출력은 stdout, 정답은 첫 공개 TC의 expectedOutput)
4. 정답 시: 황금 막대 + 🏆 트로피 / 오답 시: 파란 강조 / 미실행: 회색 막대

### 첫 위젯
- `js/visual-widgets.js` 의 `window.VISUAL_WIDGETS['playlist-bars']`
- 입력 파싱: 첫 줄 N, 둘째 줄 N개 정수 → 막대 그래프
- 출력 파싱: 첫 줄 인덱스, 둘째 줄 값 → 해당 막대 강조

### 한방 등록
선생님 OJ 탭 **🎨 비주얼 OJ — 재생목록** 버튼 → "🎵 재생목록 — 가장 긴 노래는?" 등록.

### 확장 패턴 (새 위젯 추가 시)
```js
window.VISUAL_WIDGETS['새위젯ID'] = function(canvas, opts){
  // opts.input, opts.output, opts.expected
  // canvas 에 그리기
};
```
그 다음 OJ 문제 등록 시 `description` 앞에 `<!-- visual:새위젯ID -->` 추가하면 끝.

---

## 5. ▲▼ 순서 변경 — 모든 탭에 일괄 적용

선생님 화면의 6개 탭에 순서 조정 버튼:

| 탭 | 정렬 키 |
|---|---|
| 📢 공지 | createdAt (isPinned 그룹 내) |
| 📋 게시판 | uploadedAt |
| 📓 노트북 | createdAt |
| 🎮 미션 | createdAt |
| 💻 OJ | createdAt |
| 🧠 코드 읽기 | createdAt |

### 공통 헬퍼
- `firebase.js` 의 `_moveItemBy(dbPath, items, id, direction)` 함수 한 곳에 정의
- 인접 두 아이템의 정렬 키만 swap (DB 스키마 변경 없음)
- createdAt 우선, 없으면 uploadedAt 자동 감지

### 각 view 에 ▲▼ 버튼
- `js/views/shared.js` noticeCard
- `js/views/teacher.js` vTcBoard
- `js/views/notebook.js` vTcNotebook
- `js/views/mission.js` vMissionList (isTeacher 분기)
- `js/views/coderead.js` vTcCRList
- `js/views/oj.js` vTcOJList

### 핸들러
- `js/events/actions.js` — 공지/게시판/노트북
- `js/events/mission.js` — 미션
- `js/events/coderead.js` — 코드 읽기
- `js/events/oj-actions.js` — OJ

---

## 6. 📓 노트북 두 가지 큰 개선

### 6-1. input() 프롬프트 표시
이전엔 `input("이름")` 호출해도 노란 박스에 안내가 없었음.
- `notebook-worker.js` 에서 `builtins.input` 을 Python 측에서 직접 오버라이드
- `_nb_js_request_input(prompt)` 가 prompt 받아 메인에 그대로 전달
- Colab과 동일하게 노란 박스에 "이름" 표시

### 6-2. 선생님 수정 → 학생 자동 반영 (학생 작업 보존) ⭐ 새 기능
선생님이 노트북 셀 편집하면 **학생 진도에 자동 머지**:

#### 선생님 측 (`scheduleNBSave` 분기 확장)
- 선생님 + 본인 노트북 → `notebooks/{cid}/{nbId}` 의 cells 자동 갱신 (1.5초 debounce)
- 학생 진도 보기 모드 (`NB_VIEWING_STUDENT`) 에선 저장 안 함 (다른 학생 데이터 보호)
- 학생 → 본인 진도 (기존 동작)

#### 학생 측 (`_mergeNotebookCells`)
셀 ID 기반 머지:
- 학생 진도에 같은 ID 셀이 있으면 → 학생 source 그대로 보존
- 학생 진도에 없는 원본 셀 (선생님이 새로 추가) → 원본 그대로 끼움
- 학생만 가진 셀 (학생 추가 or 선생님이 삭제) → 끝에 보존 (작업 손실 방지)
- 새 셀 감지 시 토스트: "🆕 선생님이 노트북을 업데이트했어요"

#### 한계
선생님이 **기존 셀의 source만 편집** 한 경우, 학생이 이미 진도 저장했으면 학생 source 우선 (작업 보존이 최우선이라 의도된 동작).
강제 반영 필요 시 학생이 **↺ 원본 복원** 누르거나 추후 별도 메뉴 추가 검토.

---

## 7. 🔧 자잘한 수정 / 잡픽스

### 7-1. Pretendard 폰트 URL 수정
- 이전: `fonts.googleapis.com/css2?family=Pretendard:...` → **항상 400 에러** (Pretendard는 Google Fonts에 없음)
- 변경: `cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/...` (공식 CDN)
- 부수 효과: 한국어가 실제 Pretendard로 렌더링됨 + COEP/CORP 환경 호환

### 7-2. favicon 추가
- 이전: 브라우저가 `/favicon.ico` 자동 요청 → 404
- 변경: index.html `<link rel="icon">` 에 인라인 SVG (📂 이모지)

### 7-3. 코드 읽기 메뉴 시각 다듬기
- 탭 아이콘 🧠 → 🔍 (사용자 피드백 "뇌 아이콘 징그러")
- 예제 묶음을 카드 그리드 (`cr-pack-card`) 로 정리
- 차시 표기 → "다루는 개념" 으로 일관화

### 7-4. OJ 문제 ValueError 친절 안내
- `friendlyOJError` 패턴 추가:
  - `RuntimeError: 실시간 input` → 새로고침 안내
  - `ValueError: invalid literal for int() with base N: ''` → "입력 박스 못 보셨나요?" 안내

---

# 🗂️ 파일 변경 요약

## 새 파일 (이 세션에서 생성)
| 파일 | 역할 |
|---|---|
| `js/views/coderead.js` | 코드 읽기 학생/교사 뷰 |
| `js/events/coderead.js` | 코드 읽기 이벤트 + 예제 묶음 데이터 |
| `js/coderead-runner.js` | 코드 읽기 워커 호출 헬퍼 |
| `js/coderead-worker.js` | Pyodide + settrace 워커 |
| `js/games/lockerdrop.js` | 떨어지는 사물함 게임 엔진 |
| `js/visual-widgets.js` | 비주얼 OJ 위젯 라이브러리 |
| `js/oj-problems-data.js` | OJ 23문제 일괄 등록 데이터 |
| `OJ_20_PROBLEMS_PROPOSAL.md` | 23문제 설계 제안서 (사용자 수정용) |
| `SESSION_HANDOFF.md` | **이 문서** |

## 삭제된 파일
- `js/games/lockermaster.js` — 사물함 마스터 (떨어지는 사물함으로 대체)

## 주요 수정 파일
- `index.html` — 신규 스크립트 로드, Pretendard CDN, favicon
- `js/state.js` — `CR_*` 변수들 추가
- `js/firebase.js` — `loadCodeReadings`, `_moveItemBy`, OJ description 메타 디코드
- `js/render.js` — applyWrapWidth (coderead 추가), 비주얼 OJ 캔버스 초기 그림
- `js/views/student.js`, `js/views/teacher.js` — 🔍 코드 읽기 탭
- `js/views/oj.js` — visualType 분기, ▲▼, 사전 코드, 다른 반 복사
- `js/views/notebook.js` — 선생님도 저장 표시
- `js/views/shared.js` — noticeCard ▲▼
- `js/views/mission.js` — lockerdrop GAME_TYPES, 이모지 팔레트
- `js/events/notebook.js` — 머지 로직, 선생님 자동 저장
- `js/events/oj-actions.js` — SAB input, 23문제·비주얼 로드, ▲▼, 사전 코드 인코딩
- `js/events/mission.js` — lockerdrop 분기, copy-emoji
- `js/events/coderead.js` — cr-* 핸들러
- `js/events/actions.js` — 노트북/공지/게시판 ▲▼
- `js/oj-worker.js` — SAB + builtins.input 오버라이드
- `js/notebook-worker.js` — builtins.input 오버라이드
- `database.rules.json` — codeReadings + codeReadingProgress
- `css/styles.css` — cr-*, mi-emoji-*, oj-live-*, oj-visual-* 등

---

# ⚠️ 새 세션에서 알아야 할 운영 사항

## A. Firebase 규칙 미게시 시 동작
새 메뉴(코드 읽기)는 `database.rules.json` 에 규칙이 추가돼야 정상 동작. 콘솔에서 안 게시하면:
- `loadCodeReadings` 는 try/catch로 빈 배열 반환 → 다른 기능은 정상
- 코드 읽기 등록 시 PERMISSION_DENIED → 사용자에게 게시 안내

## B. 메타 인코딩 패턴 (DB 스키마 변경 없이 옵션 필드 추가)
**OJ 문제** 의 `description` 첫 줄에 HTML 주석으로 메타 데이터:
```
<!-- visual:playlist-bars -->
<!-- starter:base64인코딩된코드 -->
## 실제 문제 설명
...
```
- `loadOJProblems` 가 자동으로 떼어내서 `obj.visualType` / `obj.starterCode` 로 복원
- description 표시 시엔 주석이 제거되어 깔끔
- 새 메타 필드 추가도 같은 패턴 (firebase.js 의 메타 디코드 부분에 추가)

## C. 워커 캐시 무효화
워커 코드 변경 시 사용자 브라우저에 새 워커 강제 로드:
- 노트북: `events/notebook.js` 의 `NB_WORKER_VER` 상수
- OJ: `events/oj-actions.js` 의 `OJ_WORKER_VER` 상수
바꾸면 워커 URL에 `?v=` 쿼리가 새 값으로 → 캐시 우회

## D. 다중 반 등록 / 다른 반 복사
- **OJ 신규 등록**: `multiClassPicker('oj', ...)` → 선택한 모든 반에 새 ID로 등록
- **OJ 수정**: 현재 반은 update, 추가 체크한 반은 새 ID로 set (이 세션에서 추가)
- 다른 메뉴 (노트북·미션·공지 등) 도 같은 패턴

## E. 컬러 톤 / UI 일관성
- 정답·성공: `var(--ok)` 초록
- 경고: `var(--warn-bg)` / `var(--warn-bd)` 노랑
- 위험·오답: `var(--danger)` 빨강
- 강조 입력 박스: 노란 톤 (코드 읽기 stdin / 노트북 input / OJ live-input 모두 같은 노란 톤)

## F. 한국어 톤 (사용자 선호)
- 친근하지만 가르치는 톤 ("~해 보세요" / "~할까요?")
- 학생 실수 = 학습 기회 — 친절하게
- 정답 강요 X, 자유로운 실험
- 마크다운 사용 (코드 백틱, 굵게, 표)

---

# 🚧 알려진 한계 / 향후 개선

## 노트북 머지의 한계
- 선생님이 **기존 셀 source 만 편집** 한 경우 학생 진도 우선 (학생 작업 보존 위해 의도된 동작)
- 강제 반영 메뉴 추가 가능 (예: "선생님 변경 모두 적용" 버튼)

## 비주얼 OJ
- 위젯 1개만 구현됨 (playlist-bars)
- md 파일 `OJ_20_PROBLEMS_PROPOSAL.md` 에 추가 위젯 후보 5종 메모됨 (막대그래프·상자·격자·트랙·레시피)
- 새 위젯 추가 시 `js/visual-widgets.js` 에 함수 등록만 하면 끝

## OJ 한방 등록의 사전 코드
- 23문제 데이터(`js/oj-problems-data.js`) 의 모든 split·map 부분에 한국어 주석 부착됨
- 사용자가 등록 후 OJ에서 ✏️ 수정으로 직접 다듬을 수 있음
- 원본 데이터 수정은 `OJ_20_PROBLEMS_PROPOSAL.md` 또는 `js/oj-problems-data.js` 직접 편집

## 미션 시스템 — 다음 후보
이 세션 초반에 미션 시스템 총평하면서 *ROI 순으로 추천* 한 개선들:
1. **실시간 변수 패널 + print 콘솔** — 디버깅 지옥 해결, 모든 미션 학습 효과 ↑
2. **거북이(turtle) 그림 게임** — 새 학습 스타일 학생 포섭
3. **친구 코드 갤러리** (단계 통과 후 익명 공유) — 또래 학습
4. **무한루프 5초 타임아웃** (Worker 분리) — 미션 안정성
5. **선생님 학습 통계 대시보드** — 학생들이 어디서 막히는지

## 코드 읽기 — 다음 확장 후보
- 🧩 코드 정렬 (Parsons) — 섞인 줄 드래그로 순서 맞추기
- 🐛 버그 찾기 — 잘못된 줄 찾아 수정

---

# 🎯 새 세션에서 시작할 때 추천 단계

1. **PROJECT_CONTEXT.md** 읽기 (전체 프로젝트 맥락)
2. **이 문서(SESSION_HANDOFF.md)** 읽기 (최근 작업 컨텍스트)
3. `git log --oneline -30` 으로 최근 커밋 확인
4. 사용자의 새 요청에 따라 작업
5. 큰 작업 마무리 시 이 핸드오프 문서 업데이트 권장

## 작업 흐름 (이미 자리잡은 패턴)
- 코드 변경 → 커밋 → `git push origin <branch>:main` → GitHub Pages 자동 배포
- 배포 확인: `until curl -s "https://junrepos.github.io/informatics/<바뀐파일>" | grep -q "<바뀐 키워드>"; do sleep 15; done` (background)
- Firebase 규칙 변경 시 사용자에게 콘솔 게시 안내
- 사용자 선호: **"배포까지 직접 처리"** — Claude가 변경 후 사용자에게 떠넘기지 말기
