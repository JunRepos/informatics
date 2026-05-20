# 🔄 세션 핸드오프 문서

> 이 문서 + **PROJECT_CONTEXT.md** 만 읽으면 컨텍스트 완전 복원 가능.
> 새 세션 시작 시: ① PROJECT_CONTEXT.md → ② 이 문서 → ③ `git log --oneline -40`

---

## 📅 세션 메타

- **마지막 갱신**: 2026-05-20
- **마지막 커밋**: `62c81fc` (수행평가 2차시 전면 개편 — 서술형 5문항)
- **작업 브랜치**: `claude/musing-kapitsa-488f5f` (워크트리)
  - 워크트리 경로: `C:\Users\PC\Desktop\github\informatics\.claude\worktrees\musing-kapitsa-488f5f`
- **배포**: `git push origin claude/musing-kapitsa-488f5f:main` → GitHub Pages 자동 배포
- **사이트 주소**: https://junrepos.github.io/informatics/
- **git config** (이 저장소만): `user.name=JunRepos / user.email=chlwns1023@gmail.com`
  - 커밋 시 `git -c user.name="JunRepos" -c user.email="chlwns1023@gmail.com" commit ...`
- **배포 확인 패턴**: `until curl -s "https://junrepos.github.io/informatics/<파일>?v=$(date +%s)" | grep -q "<키워드>"; do sleep 15; done`

### ⚠️ 환경 메모
- 이 워크트리 환경엔 **node 없음**. JS syntax 검증은 PowerShell 파서로:
  `[System.Management.Automation.Language.Parser]::ParseInput($code,[ref]$null,[ref]$null)`
  (JS 전용 검증은 아니지만 괄호/토큰 균형 오류는 잡힘)
- PowerShell 콘솔은 **한글 출력이 깨짐**. 한글 결과는 파일로 저장 후 Read 도구로 확인.
- `database.rules.json` 은 `//` 주석 포함 → 표준 JSON 파서(ConvertFrom-Json)는 거부하지만 Firebase 는 허용. 정상.

---

# 🆕 이번 세션(2026-05-20) 작업 요약

총 17개 커밋. 크게 **① 기존 메뉴 개선** + **② 수행평가 시스템 신규 구축(가장 큼)**.

## 1. 노트북 — 셀 호버 툴바 좌측 이동 (`39da85e`)
- 셀 우상단 `▶ ↑ ↓ 📋 🗑` 버튼이 수업 중 마우스 이동 거리가 멀다는 피드백
- `css/styles.css` `.cb-cell-actions` 의 `right:12px` → `left:12px` (한 줄)

## 2. OJ — 한방 등록 → 파일 업로드 (`a623a92` → `1c88dcf`)
- 기존: `oj-problems-data.js`(1177줄)에 23문제 박아 한 버튼 등록 → **제거**
- 신규: 선생님이 **Markdown(.md) 파일**을 업로드해 여러 문제 일괄 등록
- OJ 탭 우상단 버튼 3개: **📥 Markdown 업로드 / 📄 샘플 양식 / 📤 내보내기**
- 처음엔 JSON 으로 만들었다가(`a623a92`), 따옴표/줄바꿈 escape 불편하다는 피드백으로 **Markdown 으로 전환**(`1c88dcf`)
- 파서/직렬화: `js/events/oj-actions.js` 의 `parseOJMarkdown` / `buildOJMarkdown` / `OJ_MD_SAMPLE`
- **Markdown 형식**:
  ```
  # 문제 제목
  <!-- visual:playlist-bars -->     ← 선택 (비주얼 OJ)
  ## 설명
  (마크다운 본문)
  ## 시작 코드
  ```python ... ```
  ## 테스트
  ### 케이스 1
  입력: ``` ... ```
  출력: ``` ... ```
  ### 케이스 2 (숨김)
  ...
  ```
  - 새 문제는 다시 `# 제목`. fenced 블록 내부의 `#` 은 무시(학생 코드 주석 안전)
  - `(숨김)`/`(hidden)` 태그로 hidden TC 표시
- `_encodeOJMeta`(visualType/starterCode 를 description 주석으로 인코딩)는 유지

## 3. 미션 — Steam/Itch 풍 그리드 + 만들기 제거 (`75df408`)
- 미션 목록을 `list-row` → **그리드 카드**(`.mi-grid`/`.mi-card`)
  - 게임별 그라데이션 배경 + 큰 이모지 + 인게임 데코(파이프/별/떨어지는 이모지)
  - 학생 카드: 진행률 바(탭 진입 시 `loadAllMissionProgress` 로 일괄 로드)
  - 선생님 카드: 호버 시 우상단 `▲▼ ✏️ 🗑`
- **"+ 미션 만들기" 제거**: 선생님이 새 게임을 만들 수 없으므로(게임 엔진=코드)
  - `vMissionEditor`/`vMeStepEditor`/`vMeTestEditor` + 관련 핸들러 전부 삭제
  - ✏️ 버튼 = `vMissionTextEditor` — **단계 텍스트(제목/설명/힌트/experiment)만 편집**, 코드/테스트/hook 은 원본 보존(deep clone 후 텍스트만 덮어씀)
- `GAME_TYPES` 에 카드 메타(emoji/tagline/topics/gradient/decor) 추가, `_gameTypeMeta(id)` 헬퍼
- 예제 게임 등록 버튼(🐦 플래피버드 / ⚔️ 타입헌터 / 🗄️ 사물함)은 유지 — 사실상 게임 등록 방법

## 4. 코드 읽기 → "퀴즈" 5유형 (`1878e20` → `00b9b69`)
- 탭 라벨: 🔍 코드 읽기 → **🧩 퀴즈** (학생/선생). DB 경로(`codeReadings`/`codeReadingProgress`)·`CR_*` 변수명은 호환 위해 **유지**
- 유형 5종 (`QUIZ_TYPES`):
  - 🔮 출력 예측(predict) / 🔍 변수 추적(trace) — 기존, Pyodide 자동 정답
  - ✅ 객관식(mcq) — 코드+질문+4지선다, 정답·해설 직접 입력
  - 🧩 빈칸 채우기(cloze) — 코드의 `___` 토큰을 학생이 채움, 공백/대소문자/따옴표 관대 비교(`_matchClozeBlank`)
  - 🐛 버그 찾기(bugfix) — 잘못된 줄 클릭, `buggyLine` 일치 시 통과
- 선생님: 목록 상단 **유형 선택 카드 5개**(`quiz-type-card`) → 클릭 시 유형별 폼
- 예제 묶음(`CR_SAMPLE_PACKS`) 한방 등록은 **제거**(`00b9b69`)
- 새 state: `CR_CLOZE_ANSWERS`, `CR_BUG_SEL`

---

# 🤖 수행평가 시스템 (이번 세션 핵심 신규 — 가장 중요)

> 커밋: `e3a7de3` → `54c5342` → `e1f7804` → `730bb8e` → `504d076` → `a73b118` → `f237905` → `e83d1c7`(퀴즈규칙) → `7c4194b` → `d188ce1` → `62c81fc`

## 개념
**AI(Gemini)로 진로 관련 코드를 만들고(1차시), 그 코드를 해석·설명(2차시)** 하는 2차시 구성 수행평가. 평가 계획서(`알고리즘과 프로그래밍 수행평가 계획서.pdf`, D 드라이브)의 **논술 평가방법 + 5개 평가요소(25점)** 에 맞춤.

### 평가 계획서 채점 기준 (각 5점, 총 25점)
1. 알고리즘 표현(문제 추상화) 2. 자료형 활용 3. 적절한 입출력 형식 4. 다양한 제어 구조 활용 5. 다양한 상황에서 올바른 결과 출력

## 🌐 외부 인프라 (새 세션에서 꼭 알아야 함)

### Cloudflare Worker (AI 프록시)
- **URL**: `https://informatics-ai.chlwns1023.workers.dev`
- 역할: 학생 브라우저 → 워커(시스템 프롬프트 강제) → Gemini API → 응답
- **모델**: `gemini-2.5-flash` (Google AI Studio, **유료 결제 등록 완료** — 한국 IP 무료티어 차단 회피용. 실제 비용은 수업당 ~2천원 미만)
- **Secret**: `GEMINI_API_KEY` (워커 환경변수에 등록됨)
- **워커 코드/시스템 프롬프트는 Cloudflare 대시보드에만 존재** (이 레포에 없음!)
  - 새 세션에서 시스템 프롬프트 수정하려면: 워커 코드 전체를 새로 만들어 사용자에게 주고 → 사용자가 Cloudflare 대시보드 `informatics-ai` → Edit code → 통째로 교체 → Deploy
  - 시스템 프롬프트 핵심 제약(최종본):
    - 존댓말, 한 번에 한 질문, 짧게
    - **조건문(if) + 반복문(for/while) 둘 다 필수** 포함, 빼달라 해도 거절
    - 사용 가능: 변수, print(콤마 출력), input, int/float/str, 산술, 비교, 논리, if/elif/else, while+break+continue, for+range(5)/range(1,5)/range(1,5,2), 리스트/len/인덱싱/슬라이싱
    - **금지: f-string, `{:.2f}`/round, 문자열 곱셈("-"*20), 인자 없는 range, def, class, import, lambda, 컴프리헨션, try/except, 코드 주석(#)**
    - 변수명 짧게(2단어까지, `_str` 접미사 금지), `input()` 결과는 바로 형변환
    - 줄별 설명/정답 요청은 거절(힌트만)
  - 클라이언트 호출: `js/events/assessment.js` 의 `_sendAsmtMessage` → POST `{messages:[{role,content}]}` → `{text, finishReason, usage}`
  - **주석 안전망**: AI가 가끔 주석을 달아서, `js/views/assessment.js` 의 `_extractAsmtCode` → `_stripPyComments` 로 코드 추출 시 주석 제거. 문자열 안 `#` 보존, 줄 전체 주석은 줄째 삭제

### Pyodide 워커 (2차시 코드 실행)
- `js/asmt-worker.js` — OJ 워커와 별도 인스턴스(단순 실행기). `builtins.input` 을 stdin 줄 소비로 오버라이드
- 호출: `js/events/assessment.js` `_runAsmtCode(code, stdin)` / `_ensureAsmtWorker`

## 📂 수행평가 파일
| 파일 | 역할 |
|---|---|
| `js/views/assessment.js` | 학생/선생님 뷰 전체 |
| `js/events/assessment.js` | 핸들러 + 워커 호출 + 세션 저장 |
| `js/asmt-worker.js` | Pyodide 실행 워커 (2차시 ⑤ 문항) |
| `js/state.js` | `ASMT_*` 상태 변수 |
| `js/firebase.js` | `loadAsmtPhase/setAsmtPhase`, `load/saveAsmtSession`, `loadAllAsmtSessions`, `loadAllAsmtScores/saveAsmtScore` |

## 🔧 Phase 모델 (반별 단계 — 선생님 제어)
- DB: `assessment/phase/{cid}` = `'off'` | `'prep'`(1차시) | `'eval'`(2차시)
- 선생님 화면: 3단계 세그먼트 버튼 `[🔒비활성] [1️⃣1차시] [2️⃣2차시]`
- 학생 탭 노출 조건: `ASMT_PHASE[cid] !== 'off'`

## 👩‍🎓 학생 흐름
- **1차시(prep)**: 진입 카드(💡있어요/🤔모르겠어요/📚예시보기, 3분 무동작 시 AI 자동 인사) → AI 채팅(좌 채팅/우 코드, 30턴 한도 `ASMT_TURN_LIMIT`) → **"📋 이 코드로 1차시 제출"**
  - 제출 시 `_asmtCheckControl` 로 if + for/while 둘 다 있는지 검사, 없으면 alert+차단
  - 제출 후 `prep-done` 대기 화면(제출 코드 미리보기)
- **2차시(eval)**: 자기 1차시 코드 보며 **서술형 5문항**(`vStAsmtDescribe`) → 제출 → `done`
  - 1차시 코드 없는 학생(결석): `eval-nocode` 안내
- `_asmtInitialStudentView(phase, sess)` 가 탭 진입 시 화면 자동 결정

## 📝 2차시 서술형 5문항 (`ASMT_QUESTIONS`, 최신 — `62c81fc`)
좌측 내 코드 + 우측 5문항. 각 문항 = 채점 평가요소 1:1 매핑:
1. 🎯 이 프로그램은 무엇을 하나요? → ① 문제 추상화
2. 📦 변수와 자료형은? → ② 자료형
3. ⌨️ 무엇을 입력받고 출력? → ③ 입출력
4. 🔀 조건문·반복문 역할? → ④ 제어구조
5. 🧪 이 값 넣으면 결과는? (▶ 직접 실행 가능) → ⑤ 결과
- "자세히 쓸수록 점수" / 일부만 답해도 제출 가능(0점 방지) / 진행률 N/5
- state: `ASMT_ANSWERS{purpose,vars,io,control,result}`, `ASMT_RESULT_STDIN`
- **(구) 줄별 설명(explain) + 변형 과제(modify)는 이번에 전면 제거됨** — 25~30줄 줄별 설명이 중하위권에 가혹 + 변형 부담 피드백

## 👨‍🏫 선생님 화면
- Phase 세그먼트 + 학생별 진행 현황 표(단계/대화수/마지막활동/점수) + 📤 CSV 내보내기
- "상세" → `vTcAsmtStudent`: 1차시 코드 + 5문항 답(평가요소 칩) + 1차시 AI 대화 로그 + **채점(5요소×5점 라디오 + 코멘트)**
  - 채점 즉시 저장 `assessment/scores/{cid}/{학번}` = `{algo,dataType,io,control,result,comment,scoredAt}`
  - `ASMT_RUBRIC` = algo/dataType/io/control/result
- CSV: 학번/이름/단계/대화수/항목별점수/총점/코멘트/제출시각 (BOM UTF-8, NEIS 활용)

## 🗄️ DB 스키마 (수행평가)
```
assessment/phase/{cid}              : 'off'|'prep'|'eval'
assessment/sessions/{cid}/{학번}     : { messages, code, turnCount, prepSubmitted,
                                         answers:{purpose,vars,io,control,result},
                                         view, submittedAt, updatedAt }
assessment/scores/{cid}/{학번}       : { algo,dataType,io,control,result,comment,scoredAt }
assessment/active/{cid}             : (구버전 bool, 미사용 — phase로 대체)
```

---

# ⚠️ Firebase 규칙 — 매번 콘솔 게시 필요 (자주 빠뜨림!)
`database.rules.json` 은 GitHub Pages 배포와 **별개**. 규칙 변경 시 **Firebase 콘솔 → Realtime Database → 규칙 → 게시** 필수. 안 하면 `PERMISSION_DENIED`.
- 이번 세션에 추가된 경로: `assessment/phase`, `assessment/scores`, `codeReadings`(검증 완화)
- 전체 동기화 URL: https://raw.githubusercontent.com/JunRepos/informatics/main/database.rules.json
- **이번 세션에서 PERMISSION_DENIED 가 3번 발생**(active→phase, codeReadings 5유형 확장, scores) — 전부 콘솔 미게시가 원인. 새 경로 추가하면 반드시 게시 안내할 것.

---

# 🐛 이번 세션에서 잡은 버그
- 빈칸 채우기 빈칸이 줄 전체로 깨짐(`7c4194b`): 전역 `input[type=text]{width:100%}` 가 `.quiz-cloze-blank` 를 우선순위로 이김 → `input.quiz-cloze-blank` 로 specificity 올려 해결
- 퀴즈 5유형 저장 시 PERMISSION_DENIED(`e83d1c7`): `codeReadings` 규칙이 predict/trace만 허용 + `$other:false` → 필수필드(title/type/createdAt)만 검증으로 완화
- 출제 설명(description)이 학생 화면에 약하게 표시(`d188ce1`): `.cr-desc-box` 강조 + 출제 폼 라벨에 "학생 화면에 표시됨" 안내

---

# 🚧 진행 중 / 다음 작업 (사용자가 새 세션에서 이어갈 것)

## ⭐ 수행평가 — **전면 재설계 예정** (사용자 명시, 2026-05-20)
- 현재 구현(phase 1/2차시 + AI채팅 + 서술형 5문항 + 채점/CSV)은 완성·배포돼 있지만,
  사용자가 **"수행평가는 전부 바꾸기로 했다"** 고 함. → **기존 흐름·화면을 고치는 게 아니라 처음부터 다시 설계.**
- **새 세션에서 할 일**:
  1. 기존 수행평가 구현을 *참고용*으로만 보고(어떤 게 잘됐고 안됐는지), 사용자에게 **"새 수행평가를 어떤 방향으로 만들고 싶은지"** 부터 충분히 토론.
  2. 결정 전까지 코드 건드리지 말 것. 사용자는 토론하며 단계적으로 가는 걸 선호.
  3. **재활용 가능한 자산**(새로 만들지 말 것):
     - Cloudflare Worker(`informatics-ai.chlwns1023.workers.dev`) + Gemini 2.5 Flash — AI 호출 인프라 그대로 사용 가능
     - `js/asmt-worker.js` — Pyodide 코드 실행 워커
     - Firebase `assessment/*` 경로 + 규칙(이미 게시됨)
     - 선생님 채점 화면(5요소×5점) + CSV 내보내기 패턴
  4. 기존 수행평가 화면/흐름이 마음에 안 들면 과감히 갈아엎어도 됨. 단, **AI 인프라·워커·DB·채점 틀**은 살리는 게 효율적.
- 평가 계획서(`알고리즘과 프로그래밍 수행평가 계획서.pdf`)의 5개 평가요소(25점) + 논술 방법은 변하지 않는 제약.

## 미착수 (이전에 논의됨)
- 학생용 수행평가 안내서(7섹션: 한줄요약/일정/루브릭/예시/AI규칙/진로가이드/이의신청) — PDF 1~2장
  → 수행평가 재설계 방향이 확정된 뒤에 진행

---

# ✅ 전체 메뉴 현황 (정보반 기준)
| 메뉴 | 상태 |
|---|---|
| 📢 공지 / 📖 수업 / 📋 게시판 / 🗓️ 출결 / 👥 학생관리 | 안정 |
| 📓 노트북 | 안정 (셀 툴바 좌측) |
| 🎮 미션 | 그리드 카드 + 단계 텍스트 편집만 (만들기 없음) |
| 💻 OJ | Markdown 업로드/내보내기 + 비주얼 OJ |
| 🧩 퀴즈 | 5유형 (predict/trace/mcq/cloze/bugfix) |
| 📝 수행평가 | **신규** — phase(1/2차시) + AI채팅 + 서술형 5문항 + 채점/CSV |
| 📅 진도계획 | 안정 (전역) |

---

# 🎯 새 세션 시작 추천 순서
1. **PROJECT_CONTEXT.md** 읽기 (전체 맥락 — 단, 수행평가·퀴즈·미션은 이 문서가 최신)
2. **이 문서** 읽기 (이번 세션 전체 + 수행평가 인프라)
3. `git log --oneline -40` 확인
4. 사용자에게 **"수행평가 2차시 어디를 수정할지"** 부터 확인 (이게 다음 작업)

## 작업 흐름 (자리잡은 패턴)
- 코드 변경 → 워크트리에서 커밋 → `git push origin claude/musing-kapitsa-488f5f:main`
- 배포 확인: `until curl -s ".../<파일>?v=$(date +%s)" | grep -q "<키워드>"; do sleep 15; done`
- **새 DB 경로/규칙 추가 시 Firebase 콘솔 게시 안내 필수**
- 워커(시스템 프롬프트) 수정 시 Cloudflare 대시보드 안내 (레포에 없음)
- 사용자 선호: **"배포까지 직접 처리"** / 토론하며 단계적으로 / 한국어 친근한 톤
