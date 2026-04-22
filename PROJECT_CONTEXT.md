# 📘 학급 파일함 (Informatics Classroom) — 프로젝트 전체 문서

> 신동고등학교 정보/일반과목 담당 선생님이 학생·선생님용으로 쓰는 웹 기반 학급 관리 + Python 실습 플랫폼.  
> 이 문서는 새 AI 에이전트 대화를 시작할 때 참고할 수 있도록 **전체 맥락**을 상세히 정리한 것이다.

---

## 🎯 프로젝트 개요

### 한 줄 요약
**"학급 공지·과제·출결 관리 + 브라우저 내 Python 실습(노트북/게임미션/OJ)"** 을 한 곳에서 하는 학생·선생님용 웹앱.

### 사용자

| 역할 | 수 | 인증 | 주요 기능 |
|---|---|---|---|
| **선생님** | 1명 (본인) | 전역 비밀번호 1개 | 공지/수업/게시판/출결/학생관리/노트북/미션/OJ/진도계획 관리 |
| **학생** | 반별 ~30명, 총 8반 | 학번 + 비밀번호 (SHA-256 + salt) | 공지 확인 / 과제 제출 / 게시물 올리기 / 출결 확인 / 노트북/미션/OJ 실습 |

### 학급 구성 (`js/config.js`)

```js
const CLASSES = [
  {id:'c2-1',  label:'2-1반',   emoji:'🏫', type:'normal'},
  {id:'c2-2',  label:'2-2반',   emoji:'🏫', type:'normal'},
  {id:'c2-3',  label:'2-3반',   emoji:'🏫', type:'normal'},
  {id:'c2-4',  label:'2-4반',   emoji:'🏫', type:'normal'},
  {id:'c2-5',  label:'2-5반',   emoji:'🏫', type:'normal'},
  {id:'c2-6',  label:'2-6반',   emoji:'🏫', type:'normal'},
  {id:'info-2A',label:'정보 2-A', emoji:'💻', type:'info', classDays:[3,4,5]}, // 수/목/금
  {id:'info-2B',label:'정보 2-B', emoji:'💻', type:'info', classDays:[1,2,5]}, // 월/화/금
];
```

- **`normal`** 반 (1~6반): 기본 기능만 (공지/수업/게시판/출결)
- **`info`** 반 (정보 A/B): **+ 노트북, 미션, OJ** 추가 (프로그래밍 수업용)

---

## 🛠️ 기술 스택

| 항목 | 기술 |
|---|---|
| 프론트엔드 | **Vanilla JavaScript** (no framework, no build), HTML, CSS |
| 백엔드/DB | **Firebase Realtime Database** (JSON), **Firebase Storage** (파일) |
| 배포 | **GitHub Pages** (`main` 브랜치 push → 자동 배포) |
| Python 실행 | **Pyodide** (브라우저 WASM Python) — 노트북/미션/OJ에서 사용 |
| 코드 에디터 | **CodeMirror 5** (Python 구문 하이라이트) |
| 마크다운 | **marked.js** (CDN) |
| 아이콘/폰트 | Pretendard 폰트, 이모지 아이콘 |

### 왜 Vanilla JS?

- 간단한 유지보수, 빌드 불필요
- GitHub Pages에 `main` push만 하면 즉시 반영
- 선생님이 JS 지식 어느 정도 있어서 직접 수정 가능

### 왜 Firebase?

- 무료 (Spark 요금제)
- 실시간 동기화 / 인증 없이도 RTDB rules만으로 접근 제어
- 파일 업로드(Storage) 간단

---

## 📁 디렉토리 구조

```
informatics/
├── index.html                    # 단일 진입점 (SPA 스타일)
├── css/
│   └── styles.css               # 전체 스타일
├── js/
│   ├── config.js                # Firebase 설정 + CLASSES 배열
│   ├── constants.js             # MAX_FILE_SIZE 등
│   ├── state.js                 # 전역 상태 변수 모음
│   ├── utils.js                 # esc, fmtDt, genId, toast 등 유틸
│   ├── firebase.js              # Firebase init + CRUD 함수들
│   ├── render.js                # render(), go(), afterRender() 등
│   ├── app.js                   # 앱 초기화 (DOMContentLoaded)
│   ├── oj-worker.js             # OJ용 Pyodide 워커
│   ├── notebook-worker.js       # 노트북용 Pyodide 워커 (상태 유지)
│   ├── mission-runner.js        # 미션용 Pyodide (메인 스레드)
│   ├── games/
│   │   └── flappybird.js        # 플래피 버드 게임 엔진
│   ├── views/                   # 화면 렌더링 함수들 (HTML 문자열 반환)
│   │   ├── shared.js            # 공통 컴포넌트 (tab, emptyBox, noticeCard 등)
│   │   ├── home.js              # 홈 (반 선택)
│   │   ├── auth.js              # 로그인 화면
│   │   ├── student.js           # 학생 대시보드 + 각 탭
│   │   ├── teacher.js           # 선생님 대시보드 + 각 탭
│   │   ├── assignment.js        # 과제/수업 상세 (학생 제출)
│   │   ├── post.js              # 게시물 상세
│   │   ├── oj.js                # OJ (Online Judge) 뷰
│   │   ├── notebook.js          # Colab 스타일 노트북 뷰
│   │   ├── mission.js           # 게임 미션 뷰 + 에디터
│   │   └── curriculum.js        # 진도 계획 뷰
│   └── events/                  # 이벤트 핸들러 (data-action 위임)
│       ├── actions.js           # 네비게이션, 다운로드, 삭제
│       ├── forms.js             # 폼 제출 (공지, 수업, 제출, 출결, 로그인)
│       ├── oj-actions.js        # OJ 이벤트
│       ├── notebook.js          # 노트북 이벤트 (셀 CRUD, 실행, 저장)
│       ├── mission.js           # 미션 이벤트 (실행, hook 적용)
│       └── curriculum.js        # 진도 계획 이벤트
├── database.rules.json           # Firebase Realtime DB 규칙 (별도 배포 필요)
└── storage.rules                 # Firebase Storage 규칙
```

### 스크립트 로딩 순서 (index.html 중요!)

```html
<!-- 라이브러리 -->
1. Firebase SDK (app, database, storage)
2. JSZip (파일 묶음)
3. CodeMirror (CSS → JS → python/markdown 모드) ← Monaco보다 먼저!
4. marked.js

<!-- 앱 -->
1. config.js, constants.js, state.js (전역 변수)
2. utils.js, firebase.js
3. views/*.js (순서: shared → home → auth → student → teacher → post → assignment → oj → notebook → mission → curriculum)
4. games/flappybird.js, mission-runner.js
5. render.js
6. events/*.js
7. app.js (마지막, 초기화)
```

**주의**: 전역 함수/변수 의존성 순서 때문에 이 순서 꼭 지킬 것.

---

## 🗺️ 주요 기능 상세

### 1. 🏠 홈 & 로그인

- 홈 화면에서 반 선택 → 학생 로그인 or 선생님 로그인 분기
- 학생: 학번 + 비밀번호 (SHA-256 + 32자 salt)
- 선생님: 전역 비밀번호 1개 (최초 접속 시 설정)
- 세션 유지: `sessionStorage`에 VIEW, 로그인 상태 등 저장

### 2. 📢 공지 (notices)

- 선생님: 제목, 내용, 고정 여부, **첨부 파일 여러 개** 등록
- 다중 반 선택 등록 ("공지 하나를 3반/4반에 동시 등록")
- 학생: 목록 확인, 파일 다운로드
- 이미지 첨부 시 인라인 표시

### 3. 📖 수업 (assignments) — 원래 "과제"였던 탭

- 선생님: 제목, 설명, **수업 날짜**, **과제 마감일**, 첨부파일 여러 개
- 학생: 수업 날짜 오름차순 + **월별 접기/펼치기** UI
- 제출: 학생이 **여러 파일 한번에** 제출 가능
- 선생님: 제출 현황 테이블 + 개별/ZIP 다운로드 + 첨부파일 다운로드
- 재제출 기능 (`resubCount`)

### 4. 📋 게시판 (posts)

- 학생이 파일과 함께 글 작성 (비밀번호 설정)
- 다운로드 시 비밀번호 입력 필요 (선생님은 무조건 접근 가능)
- 본인 글은 내 것 표시

### 5. 🗓️ 출결 (attendance)

- 날짜별 학생별 출결 기록
- **일반반**: 출석/지각/결석 (기본값 출석, 사유 선택 가능)
- **정보반**: 출석/결석 토글 + 자유 텍스트 사유
  - `classDays` 설정된 요일만 출결 가능 (비수업일 차단)
  - ◀▶ 버튼이 **수업 요일만 건너뛰며** 이동
- 월별 요약 (학생: 내 출결 보기)
- 클립보드 내보내기 (텍스트 포맷)

### 6. 👥 학생 관리

- 개별 추가 / 일괄 추가 (학번,이름 한 줄씩)
- 비밀번호 초기화 (학번으로)
- 학생 삭제

### 7. 💻 OJ (Online Judge) — 정보반만

- 선생님: 문제 등록 (제목, 설명, 테스트케이스 input/expected, 숨김여부)
- 학생: Programmers 스타일 분할 화면
  - 좌: 문제 설명 + 테스트 케이스
  - 우: CodeMirror Python 에디터
  - 하단: 실행 결과 탭 (실행 / 채점)
- **실행**: 커스텀 stdin으로 한 번 실행 (자유 테스트)
- **제출**: 전체 테스트케이스로 채점 → DB에 점수 저장
- 실행 엔진: `js/oj-worker.js` (Pyodide 웹 워커)

### 8. 📓 노트북 (Colab 스타일) — 정보반만

#### 기본 구조
- 선생님이 **.ipynb 파일 업로드** → 학생이 Colab처럼 실습
- `js/notebook-worker.js` — Pyodide 워커 (셀 간 변수 유지)
- `marked.js` 로 마크다운 렌더링

#### 기능
- **셀 실행**: ▶ 버튼 or Ctrl+Enter
- **단축키**: Shift+Enter (실행+다음), Alt+Enter (실행+새 셀)
- **셀 CRUD**: 추가 (코드/텍스트), 삭제, ↑↓ 이동, 복제
- **셀 호버 툴바**: 우상단에 5개 버튼 (실행, 위/아래, 복제, 삭제)
- **셀 사이 `+` 버튼**: 마우스 호버 시 그 위치에만 나타남 (Colab 느낌)
- **마크다운 편집**: 더블클릭 or 편집 버튼 → CodeMirror 편집 모드 → Shift+Enter로 렌더링
- **input() 팝업**: 코드에 `input()` 감지되면 실행 전 노란 팝업으로 입력값 받음
- **matplotlib 이미지**: `plt.show()` 결과 자동 PNG 렌더
- **상단 툴바**: 스티키 고정 + 블러 배경 (목록 / 모두 실행 / 재시작)

#### 학생별 진도 저장
- `notebookProgress/{cid}/{nbId}/{studentNum}` 에 자동 저장 (1.5초 debounce)
- 편집 상태 표시 (✏️ 편집 중 → 💾 저장 중 → ✓ 저장됨)
- 학생 로그아웃/새로고침 후에도 이어서 실습 가능
- "↺ 원본 복원" 버튼으로 선생님 원본으로 되돌리기

#### 선생님용 학생 진도 보기
- "👥 학생 진도" 버튼 → 학생 목록 테이블 (편집 여부, 변경 셀 수, 마지막 저장 시각)
- 학생 클릭 → 그 학생의 노트북을 **읽기 전용**(`readOnly: 'nocursor'`)으로 열람
- 상단 노란 배너로 "📖 20101 홍길동 학생 진도 보는 중" 표시

#### UI 특징 (Colab 스타일)
- 라이트/다크 테마에 맞는 색상 팔레트
- 좌측 실행 카운터: `[ ]` → `[*]` 실행중 → `[1]`, `[2]` 실행 순서
- 선택된 셀은 파란 왼쪽 테두리 + 배경 하이라이트
- 이미지: `max-width: 100%`, 둥근 모서리, 다크 모드에서 흰 배경 패딩

#### 이미지 지원
- 인라인 base64 (`![](data:image/png;base64,...)`) — 바로 렌더
- Jupyter `attachments` 필드 — 자동으로 data URL로 변환
- 업로드 크기 체크: 14MB 이상 거부, 5MB 이상 경고

### 9. 🎮 미션 (게임 기반 실습) — 정보반만

핵심 아이디어: **학생이 작성한 Python 코드가 왼쪽 게임에 즉시 반영**되어 흥미 유발.

#### 구조
- 선생님이 **미션 에디터**로 단계별 실습 문제 만들기
- 또는 "🐦 예제 미션 불러오기" 로 플래피 버드 7단계 즉시 등록
- 학생: 좌측 canvas 게임 + 우측 단계별 코드 에디터 (분할 뷰)

#### 게임 엔진: `js/games/flappybird.js`
- Canvas 360x480 플래피 버드
- 중력/점프/파이프/충돌/점수/게임오버
- **Hook 시스템**: 학생 Python 함수가 게임 동작 바꿈
  - `gameStartScore()` — 시작 점수 (score 변수 읽음)
  - `welcomeMessage` — 시작 화면 메시지 (greeting 변수 읽음)
  - `addScore(score)` — 장애물 지날 때
  - `finalScore(score, pipesPassed)` — addScore 후 추가 보너스
  - `gameOverBonus(score, pipesPassed)` — 게임오버 시 보너스
  - `speedConfig` — speed 변수로 게임 속도 설정
  - `levelCalc(pipesPassed)` — 레벨 계산 (레벨별 6가지 배경 테마!)

#### 레벨별 배경 테마
- Lv.0 낮 ☀️ → Lv.1 아침노을 🌤️ → Lv.2 석양 🌇
- Lv.3 황혼 💜 → Lv.4 밤 🌙 (별 반짝) → Lv.5+ 우주 🌌
- 하늘/파이프/땅/구름 색상 전부 바뀜

#### Pyodide 러너: `js/mission-runner.js`
- **메인 스레드** Pyodide (게임 hook 동기 호출용)
- 지연 로드 (첫 미션 클릭 시 다운로드 ~5-10초)
- 테스트 타입:
  - `exists` — 변수 존재 + 타입 확인
  - `variable` — 변수 값 비교
  - `function` — 함수 호출 결과 비교
  - `block` — 입력 주고 출력 변수 확인
- stdin 지원 (input() 사용하는 테스트)

#### 코드 스타일 3가지 (에디터 선택)
1. **변수 (`hookStyle: 'variable'`)**: `score = 0` 같은 변수 선언
2. **블록 (`hookStyle: 'block'`)** ⭐ 추천: 게임이 변수 주면 수정해서 돌려줌 — `def` 없이도 가능
3. **함수 (`hookStyle: 'function'`)**: `def addScore(score): return score + 1`

#### 예제 미션: "플래피 버드 — 내 손으로 완성하는 게임" (7단계)

| # | 단계 제목 | 핵심 개념 | 게임 효과 |
|---|---|---|---|
| 1️⃣ | 점수판 만들기 | 변수 `=` | 점수 등장 |
| 2️⃣ | 환영 메시지 | 문자열 `+` 결합 | 시작 화면에 내 이름 |
| 3️⃣ | 장애물마다 +1 | 덧셈 | 점수가 오름 |
| 4️⃣ | 점수 배수기 | 곱셈 `*` + 변수 조합 | multiplier로 폭발적 성장 |
| 5️⃣ | 속도 조절 | `input()` + `float()` | 게임 속도 변화 |
| 6️⃣ | 레벨 시스템 | 몫 `//` | 배경 6가지 테마 변화 |
| 7️⃣ | 🎨 나만의 공식 | 종합 + 창작 | 친구와 최고 점수 대결 |

- 각 단계에 `experiment` 필드 — "자유롭게 바꿔보세요" 아이디어 제공
- 마지막 단계는 완전 자유 창작 (교실 경쟁 활동용)

#### 테스트 UX 철학 (중요!)
- **엄격한 값 비교 X** → `exists` 타입으로 "변수만 맞는 타입으로 존재하면 통과"
- 학생의 창의성 방해하지 않음 (plus=1, plus=10, plus=-1 다 통과)
- 통과 시: 🎉 **"적용 완료!"** 축하 카드 + 학생이 설정한 변수 값 표시
- 실패 시: 친절한 메시지 (`score 변수가 아직 없어요`)

#### 학생 진도 저장
- `missionProgress/{cid}/{missionId}/{studentNum}` 에 단계별 pass/code 저장
- 다음 미통과 단계로 자동 이동

#### 미션 에디터 (선생님)
- 제목, 설명, 단계 추가/삭제/순서 변경
- 각 단계: 제목 / 설명(마크다운) / 힌트 / 시작 코드 / 테스트 케이스 / hook
- 다중 반 등록 지원

### 10. 📅 진도 계획 (curriculum) — 전역

선생님이 **한 페이지에서 2-A, 2-B 진도를 통합 관리**:

#### 레이아웃
- **상단**: 제목 + 학기 설정 토글 + 💾 저장 + 저장 상태
- **접이식 학기 설정**: 시작/종료일 + 반별 수업 요일 칩 토글
- **주제 목록** (공통): 1. 변수 2. 조건문 ... 순서대로 자동 배정
- **좌측 사이드바**: 정보 2-A / 정보 2-B 카드 (진행률 바 포함)
- **메인**: 선택된 반의 수업 일정 테이블만 표시

#### 기능
- "🔄 일정 생성/재생성" — 기간 + 요일로 세션 자동 생성
- "🔁 주제 자동 재배정" — 휴강 제외하고 순서대로
- 각 세션: 주제 드롭다운 / 메모 / 휴강 체크 / 삭제
- "+ 보강/특별 일정" — 수동 추가 (현재 선택 반에 자동 적용)
- 자동 저장 (1.2초 debounce)

#### 데이터 위치
- `curriculum/plan` — 단일 전역 문서
- 로컬 타임존 YYYY-MM-DD 사용 (ISO UTC 쓰면 KST 자정이 전날로 밀림!)

---

## 🗄️ Firebase 데이터 모델

### Realtime Database (`database.rules.json`)

```
auth/
  teacher/ {h, salt}

notices/{classId}/{noticeId}
  { title, content, isPinned, createdAt, fileName?, fileUrl?, filePath?, files?[] }

assignments/{classId}/{assignId}
  { title, description, classDate?, dueDate?, createdAt, fileName?, files?[] }

submissions/{classId}/{assignId}/{studentNum}
  { studentName, fileName, uploadedAt, url, storagePath, memo, resubCount, files?[] }

posts/{classId}/{postId}
  { title, authorName, authorId, fileName, fileSize, uploadedAt,
    passwordHash, salt, storagePath, url, memo }

students/{classId}/{studentNum}
  { name, passwordHash, salt, isFirstLogin, createdAt }

teacherFiles/{classId}/{fileId}
  { name, size, uploadedAt, storagePath, url, groupId, groupTitle, groupDesc }

attendance/{classId}/{date}/{studentNum}
  { status, reason?, updatedAt }
  // status: "출석" | "지각" | "결석" (정보반은 출석/결석만)

problems/{classId}/{problemId}     // OJ 문제
  { title, description, createdAt,
    testCases: { {tcId}: {input, expectedOutput, isHidden, order} } }

ojSubmissions/{classId}/{problemId}/{studentNum}  // OJ 제출
  { code, submittedAt, totalCases, passedCases, status, results }

notebooks/{classId}/{nbId}         // 노트북 (선생님 업로드)
  { title, cells[], createdAt }

notebookProgress/{classId}/{nbId}/{studentNum}  // 노트북 학생 진도
  { cells[], updatedAt }

missions/{classId}/{missionId}     // 게임 미션
  { title, gameType, description, steps[], createdAt }

missionProgress/{classId}/{missionId}/{studentNum}  // 미션 진도
  { stepPass: {stepId: {passed, code, ...}}, updatedAt }

curriculum/plan                     // 전역 진도 계획
  { startDate, endDate, classDays, topics[], sessions, updatedAt }
```

### Storage

```
notices/{classId}/{noticeId}/{fileName}
assignments/{classId}/{assignId}/{fileName}
posts/{classId}/{postId}/{fileName}
submissions/{classId}/{assignId}/{studentNum}/{fileName}
teacherFiles/{classId}/{fileId}/{fileName}
```

- 최대 파일 크기: 50MB (constants.js)
- classId 패턴 매칭으로 쓰기 권한 제어

### 보안 규칙의 핵심 아이디어

- **인증 시스템 없음** (Firebase Auth 안 씀)
- 대신 `classId.matches(/^(c2-[1-6]|info-2[AB])$/)` 로 경로 패턴 검증
- 즉, **같은 반 학생끼리는 서로 덮어쓸 수도 있음** (신뢰 기반 — 학교 내부용이라 OK)
- 실제 사용자 식별은 클라이언트 측에서만 (비밀번호 해시 체크)

### ⚠️ 중요한 규칙 이슈

1. **같은 레벨에 와일드카드 2개 불가**: `posts` 아래에 `$classId`와 `$legacyPostId` 둘 다 두면 에러. → `$classId` 하나로 합치고 내부에서 구분.
2. **진도 계획 규칙**: 최초 배포 시 `curriculum/plan` 규칙 추가 필요. 없으면 PERMISSION_DENIED.
3. **로컬 날짜 처리**: `toISOString().slice(0,10)` 쓰지 말 것! KST 자정이 UTC 전날 15시로 밀림. `toLocalDateStr()` 유틸 사용.

---

## 💻 코딩 컨벤션

### 1. 전역 변수 + 간단한 함수 (class/module 거의 안 씀)

```js
// state.js
let VIEW = 'home';
let IS_TC = false;
let ST_USER = null;
let NB_CELLS = [];
// ...
```

- JS 모듈 시스템 없이 script tag로 전역에 다 올림
- 심플하고 디버깅 쉬움 (DevTools 콘솔에서 바로 접근 가능)

### 2. View 함수 = HTML 문자열 반환

```js
function vStNotice(){
  if(!NOTICES.length) return emptyBox('📢','등록된 공지가 없습니다.');
  return NOTICES.map(n => noticeCard(n, false)).join('');
}
```

- 뷰 함수명은 `v` + PascalCase (예: `vStNotice`, `vTcAssign`)
- `Tc` = Teacher, `St` = Student
- 템플릿 리터럴로 HTML 문자열 만들기
- **`esc(str)`** 필수! (XSS 방지 — 모든 사용자 입력에)

### 3. 이벤트 위임 (`data-action`)

```html
<button data-action="pick-class" data-cid="${c.id}">...</button>
```

```js
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;
  if(act.action === 'pick-class'){ ... }
  if(act.action === 'del-notice'){ ... }
});
```

- DOM 재렌더해도 이벤트 핸들러 재등록 불필요
- `events/*.js`에 기능별로 분리

### 4. 폼 제출은 id 기반

```js
if(t.id === 'nc-submit'){ /* 공지 등록 */ }
if(t.id === 'sa-btn'){ /* 학생 추가 */ }
```

- 입력 폼 제출 버튼은 고유 id로 처리

### 5. 렌더링 사이클

```js
function render(){
  document.getElementById('root').innerHTML = `<div class="header">...</div>${body}`;
  afterRender();
}

function afterRender(){
  // CodeMirror 초기화, 이벤트 바인딩 등
  // requestAnimationFrame으로 DOM 준비 보장
}
```

- **`render()`** — 전체 화면 innerHTML로 교체
- **`afterRender()`** — DOM 세팅 후 JS로 추가 작업 (CodeMirror, 게임 등)
- `go('viewname')` — 뷰 전환 (pushState + render)

### 6. 상태 저장

```js
// sessionStorage 자동 저장 (로그인 유지)
saveSession();  // VIEW, IS_TC, ST_USER, ST_TAB 등
restoreSession();
```

---

## 🔧 주요 기술 결정 사항 (왜 이렇게 했나)

### Pyodide 3가지 인스턴스

| 용도 | 위치 | 상태 | 이유 |
|---|---|---|---|
| OJ | 워커 | 휘발성 | 테스트마다 fresh namespace |
| 노트북 | 워커 | 영구 | 셀 간 변수 공유 |
| 미션 | 메인 스레드 | 영구 | 게임 hook에서 동기 호출 필요 (60fps) |

- 각각 따로 로드 (Pyodide 캐시되지만 초기화는 별도)
- 메인 스레드 Pyodide는 짧은 코드면 <10ms 동기 실행 OK

### input() 처리 방식

- GitHub Pages는 COOP/COEP 헤더 못 넣음 → SharedArrayBuffer + Atomics.wait 못 씀
- 진짜 실시간 차단 input()은 불가
- **대안**: 실행 전에 `input()` 호출 개수를 정규식으로 감지 → 노란 팝업으로 값을 미리 받음
- UX 비슷하고 충분히 실용적

### View vs Events 분리

- 순수 view 함수는 HTML만 생성 (상태 없음, 재렌더 쉬움)
- 상태 변경은 event 핸들러에서만 발생
- React처럼 "state → view" 단방향 흐름 유지

### 왜 CodeMirror 5?

- 무겁지 않고 CDN으로 바로 로드 가능
- CodeMirror 6는 빌드 필요 (Rollup 등) → Vanilla JS 철학과 안 맞음
- 기능 충분 (구문 하이라이트, 줄번호, 브래킷 매칭, extraKeys)

### 왜 모든 게 하나의 repo + gh-pages?

- 학교용 소규모 앱이라 배포 단순화가 최우선
- CI/CD 없음, 빌드 없음, `git push` → 2분 내 라이브
- 선생님이 로컬에서 직접 수정하고 push 가능

---

## 🎓 교육 철학 (미션 설계 기반)

### 1. "내 코드가 진짜 뭔가 바꾼다"

- 추상적 이론 → 즉각적 시각 피드백
- `score = 100` 작성 → 왼쪽 화면에 100 등장 → "내가 만들었다!"

### 2. 엄격한 테스트 < 자유로운 실험

- **"exists" 테스트**: 변수가 존재하고 올바른 타입이면 통과
- 값 비교는 최소화 → 학생이 `plus = 1`, `plus = 100`, `plus = -1` 모두 도전 가능
- 코드 오류 메시지는 친절하게 ("score 변수가 아직 없어요")

### 3. 스토리 있는 학습

- "변수가 뭐예요?" → "점수판을 만들려면 변수가 필요해!"
- "왜 float()?" → "input()은 문자열이라 숫자로 변환해야 함!"
- "//는 왜 써?" → "레벨은 정수여야 하니까!"

### 4. 스캐폴딩 (점진적 자유)

- 초반: 명확한 정답 (Stage 1, 2)
- 중반: 여러 방법 가능 (Stage 3~6)
- 마지막: 완전 자유 창작 (Stage 7)

### 5. 사회적 요소

- 이름 입력 (Stage 2) → 친구들과 공유
- 최고 점수 대결 (Stage 7) → 수업 마무리 활동

---

## 🐛 알려진 이슈 / 주의사항

### 1. Firebase 규칙 배포
- `database.rules.json` 은 **GitHub Pages 배포와 별개**
- 파일 수정 후 Firebase 콘솔 → Realtime Database → 규칙 → 붙여넣기 → **게시** 필수
- 안 하면 저장 시 `PERMISSION_DENIED`

### 2. 타임존 버그
- `toISOString().slice(0,10)` → UTC 날짜 (KST 자정이 전날이 됨!)
- 진도 계획 일정 생성 시 이 버그로 "수/목/금" 이 "화/수/목" 으로 밀렸던 경험
- **반드시** `toLocalDateStr()` 함수 (각 파일에 있음) 사용

### 3. CodeMirror 타이밍 이슈
- `afterRender` 에서 바로 `CodeMirror.fromTextArea` 호출하면 크기 측정 실패
- 노트북 첫 진입 시 코드 셀이 안 보이는 버그 있었음
- **해결**: requestAnimationFrame + setTimeout(cm.refresh, 0) 조합 + stale CM 체크

### 4. Pyodide 초기 로드 느림
- 첫 OJ/노트북/미션 접근 시 5~10초 걸림
- UX: "⏳ Python 실행 중..." 표시 필수

### 5. Firebase RTDB 16MB 노드 제한
- 큰 이미지가 많은 ipynb는 업로드 실패 가능
- 체크: 14MB 이상 거부, 5MB 이상 경고

### 6. 이미지 base64 1.33배 팽창
- 5MB PNG → base64로 ~6.7MB
- 노트북 당 이미지 많이 넣으면 DB 부담

### 7. GitHub Pages 캐시
- 배포 후 1~2분 반영 지연
- 강한 새로고침 (`Ctrl+Shift+R`) 안내

---

## 🚀 배포 프로세스

### 코드 배포 (자동)

```bash
git add .
git commit -m "commit msg"
git push origin main
# → GitHub Pages가 1~2분 내 자동 배포
# 주소: https://junrepos.github.io/informatics/
```

### 배포 확인

```bash
curl -s -o /dev/null -w "%{http_code}" "https://junrepos.github.io/informatics/"
# 200 나오면 OK
```

### Firebase 규칙 배포 (수동)

1. Firebase 콘솔 (https://console.firebase.google.com/)
2. 프로젝트: `sindong-informatics`
3. Realtime Database → 규칙 탭
4. `database.rules.json` 내용 복사 → 붙여넣기
5. **게시** 버튼

### Storage 규칙 배포 (수동)

1. Firebase 콘솔 → Storage → 규칙
2. `storage.rules` 내용 붙여넣기 → 게시

---

## 📝 커밋 메시지 스타일

- 한국어 사용
- 제목: 기능/변경 요약 (50자 이내)
- 본문: 무엇을/왜 변경했는지 (필요 시)
- 예시:
  ```
  미션 테스트 철학 변경: 엄격 비교 → '변수 존재 확인' + 게임 반영

  문제: 0.3~3 값 입력하라 해놓고 테스트는 1.5/0.8/2 고정값 비교
        → 학생이 int(input())로 1.5 받으려 하면 테스트 실패

  변경:
  1. 모든 샘플 미션 테스트를 'exists' 타입으로 단순화
  2. 3단계 stdin을 학생 팝업 입력값으로 직접 사용
  3. 테스트 결과 UI 개편 — 통과 시 축하 카드
  ```

### Co-author
- 모든 AI 생성 커밋에 `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` 추가

### Git 사용자 설정 필요 시
```bash
git -c user.name="JunRepos" -c user.email="chlwns1023@gmail.com" commit -m "..."
```

---

## 🔮 향후 개선 방향

### 단기 (작업 예정/대기)

- [ ] 노트북 서비스 워커 (`coi-serviceworker`) 도입으로 **진짜 실시간 input()** 지원
- [ ] `%` 나머지 연산자 미션 단계 (조건문 배운 후)
- [ ] 뺄셈 `-` 페널티 시스템
- [ ] `print()` 출력을 게임 하단 메시지 박스로 통합

### 중기

- [ ] 다른 게임 엔진 추가 (스네이크, 숫자야구, 숫자 맞추기)
- [ ] 단원별 미션 시리즈 (조건문 미션, 반복문 미션, 함수 미션, 리스트 미션)
- [ ] 학생별 미션 통계 대시보드 (선생님용)
- [ ] 수업 자료 버전 관리 (노트북 v1, v2 같은 히스토리)

### 장기

- [ ] 학생 간 코드 공유 (동의 기반, 익명화)
- [ ] 선생님 사이 수업자료 교환 (학교별 repo 분리 가능)
- [ ] 수업 계획 템플릿 라이브러리 (교육부 커리큘럼 기반)
- [ ] 모바일/태블릿 최적화 (현재 웹 전용)

---

## 💬 중요한 사용자 선호 사항 (과거 대화에서)

1. **"배포 후 ~하라고 하지 마"**
   - Claude가 변경 후 "테스트 해보세요" 하지 말고 **직접 커밋/푸시/배포 확인까지** 해야 함
   - `curl` 로 HTTP 200 확인해서 실제 배포 검증

2. **"모바일 반응형은 노트북엔 필요없음"**
   - 노트북은 웹 전용 최적화
   - 다른 기능(공지/과제 등)은 모바일 대응 유지

3. **"선생님 관점 우선"**
   - 에디터 제공, 직접 콘텐츠 만들 수 있게
   - 예제 템플릿 "한 번 클릭으로 등록" 편의성

4. **"학생이 재밌어해야 함"**
   - 즉각적 피드백
   - 창의성 자유
   - 테스트 실패해도 상처 안 받게 친절한 메시지

5. **"정답 강요 X"**
   - 엄격한 값 비교보다 변수 존재 확인
   - 실험 가이드로 다양한 시도 유도

---

## 🧠 내부 용어 / 약어

- **`cb-*`** — Colab notebook 관련 CSS 클래스 (`cb-wrap`, `cb-cell`)
- **`mi-*`** — Mission 관련 (`mi-split`, `mi-test-item`)
- **`me-*`** — Mission Editor 관련 (`me-step`, `me-tests`)
- **`oj-*`** — Online Judge 관련
- **`cur-*`** — Curriculum 관련
- **`nb-*`** — Notebook 이벤트 (`nb-run-cell`, `nb-add-cell`)
- **`TC_`** — Teacher 관련 전역 변수 (`TC_TAB`, `TC_CLS`)
- **`ST_`** — Student 관련 (`ST_TAB`, `ST_USER`)
- **`OJ_`** — Online Judge 상태
- **`NB_`** — Notebook 상태 (`NB_CELLS`, `NB_VIEWING_STUDENT`)
- **`CUR_`** — Curriculum 상태

---

## 🎯 이 문서를 읽고 다음 에이전트에게 전하는 말

이 프로젝트는 **"교실에서 실제로 쓰이는 도구"** 입니다. 가상 사용자 없음, 마케팅 없음, 다른 사람 앱 아님 — **선생님 본인 + 실제 학생 ~240명**이 씁니다.

개발 원칙:
1. **간단함 > 최신 트렌드** (Vanilla JS, no build)
2. **즉시 배포** (`git push` → 2분 안에 라이브)
3. **선생님이 이해 가능한 코드** (선생님이 직접 수정할 수도 있음)
4. **학생이 재밌어하는 UX** (기능보다 경험)

코딩할 때:
- 새 기능은 **왜 필요한지 교육학적 맥락**에서 검토
- XSS 방지 (`esc()` 필수!)
- 타임존 주의 (로컬 기준)
- Firebase 16MB 제한 기억
- 커밋 메시지는 **"무엇을 왜"**

UX 결정할 때:
- **학생의 실수 = 학습 기회** — 친절한 메시지로
- **즉각적 시각 피드백** — 추상 < 구체
- **창의 공간** — 정답 강요 X
- **직접 해봐야 이해** — 이론 설명보다 실험 예시

질문 있으면 `git log --oneline` 으로 이전 커밋 메시지 읽어보면 맥락 이해에 많은 도움이 됨.

---

_작성: 2026-04-22_  
_프로젝트 시작: 2025 (추정)_  
_최근 메이저 기능: 플래피 버드 미션 7단계 재설계, 노트북 Colab 스타일 리뉴얼, 진도 계획 통합 뷰_
