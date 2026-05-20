# 🔄 세션 핸드오프 문서

> 이 문서 + **PROJECT_CONTEXT.md** 만 읽으면 컨텍스트 완전 복원 가능.
> 새 세션 시작 시: ① PROJECT_CONTEXT.md → ② 이 문서 → ③ `git log --oneline -40`

---

## 📅 세션 메타

- **마지막 갱신**: 2026-05-21
- **마지막 커밋**: `84a2590` (수행평가 전면 재설계 — 4파트 자동채점)
- **작업 브랜치**: `claude/musing-kapitsa-488f5f` (워크트리)
  - 워크트리 경로: `C:\Users\PC\Desktop\github\informatics\.claude\worktrees\musing-kapitsa-488f5f`
- **배포**: `git push origin claude/musing-kapitsa-488f5f:main` → GitHub Pages 자동 배포
- **사이트 주소**: https://junrepos.github.io/informatics/
- **git config** (커밋 시): `git -c user.name="JunRepos" -c user.email="chlwns1023@gmail.com" commit ...`
- **배포 확인**: `until curl -s ".../<파일>?v=$(date +%s)" | grep -q "<키워드>"; do sleep 15; done`

### ⚠️ 환경 메모
- 이 워크트리 환경엔 **node 없음** (npx 류 안 됨). **python 3.14 있음**.
- 프리뷰: `.claude/launch.json` 이 python http.server 로 워크트리를 서빙하도록 설정됨 (preview_start "static-server"). 단 `.claude/`는 git-ignore — 메인 레포의 `.claude/launch.json` 을 프리뷰가 읽음.
- PowerShell 콘솔은 **한글 출력이 깨짐**. 한글 결과는 파일로 저장 후 Read.
- `database.rules.json` 은 `//` 주석 포함 → Firebase 는 허용(정상).

---

# 🆕 이번 세션(2026-05-21) 작업 — 수행평가 전면 재설계

사용자 결정으로 **기존 AI 수행평가(2차시: AI채팅+서술형5문항)를 폐기**하고 두 가지로 분리:
**B. AI 코딩 독립 메뉴** (커밋 `71e59de`) + **A. 새 4파트 자동채점 수행평가** (커밋 `84a2590`).

## B. 🤖 AI 코딩 — 독립 메뉴 (신규)

기존 수행평가의 AI 채팅을 떼어내 **정보반 독립 탭**으로 만듦. 자유 실습용.

- **파일**: `js/views/aicode.js`, `js/events/aicode.js` (신규) + state `AIC_*`
- 선생님 **on/off 토글**(`aicode/active/{cid}`) → 학생 탭 노출
- 학생별 **세션 저장**(`aicode/sessions/{cid}/{학번}`) → 이어하기
- 진입 카드(아이디어/모르겠어요/예시) → AI 채팅(좌 채팅/우 코드) → 코드 직접 실행(▶)
- 선생님: 학생별 대화·코드 열람(읽기 전용)
- 백엔드: **기존 Cloudflare Worker 그대로 재사용** (`AIC_WORKER_URL` = `https://informatics-ai.chlwns1023.workers.dev`, Gemini 2.5 Flash). 코드 실행은 `asmt-worker.js`.
- 대화 한도 `AIC_TURN_LIMIT=40`.

## A. 📝 수행평가 — 4파트 자동채점 시험 (신규, 핵심)

AI 없는 순수 자동채점 시험. 4파트 전부 Pyodide 자동 채점.

| 파트 | 내용 | 채점 | 5요소 매핑 |
|---|---|---|---|
| ① 출력예측(predict) | 코드 stdout 예측 | 저장된 expected와 `_normalizeAns` 비교 | ⑤ 결과 |
| ② 코드해석(explain) | 선생님이 강조한 줄을 학생이 **서술 설명** | **자동채점 X — 선생님 수동** | ② 자료형 |
| ③ 빈칸(cloze) | 코드 `___` 채우기 | `_matchClozeBlank` | ④ 제어구조 |
| ④ 구현(implement) | 명세+테스트케이스 코드 작성 | 코드 실행 후 통과율 | ① 추상화 + ③ 입출력(절반씩) |

> ② 코드해석은 서술형이라 자동채점에서 제외(2026-05-21 변수추적에서 변경). 선생님이 학생 답을 보고 자료형(②) 점수를 직접 입력. 퀴즈(coderead)의 trace 도 동일하게 explain 으로 교체(퀴즈는 제출 후 모범답안 자가확인).

- **파일**: `js/views/assessment.js`, `js/events/assessment.js` **전면 재작성** + state `ASMT_*` 교체
- **배점**: 선생님이 파트별 조정(기본 ①5/②5/③5/④10=25). `exam.weights`
- **5요소 환산**: `_asmt5(exam, autoScore)` — 파트 점수 = 배점 × (정답/전체). 구현은 절반씩 algo/io.
- **선생님 출제**: 전용 편집 UI(`vTcAsmtEdit`). 4파트 탭 + 문제 추가/삭제 + 배점.
  - ①②는 코드 입력 후 **🪄 자동 분석**(`_asmtAnalyze` → `coderead-worker.js` settrace) 누르면 정답(expected/vars) 자동 추출
  - ③ cloze: 코드에 `___` + 정답 한 줄에 하나씩
  - ④ implement: 제목/설명/시작코드/테스트케이스(input·expected·숨김)
- **활성화**: `setAsmtExamActive(cid, bool)` 토글 → 학생 탭 노출
- **학생**: 4파트 자유 이동 → "제출하기" 1회 → 잠금. 미응답 허용. 제출 즉시 자동 채점(`_asmtSubmitExam`). 구현만 코드 실행 채점(비동기).
- **선생님 채점**: 학생 상세(`vTcAsmtStudent`)에서 파트별 학생답 vs 정답 표시 + **5요소 점수 자동 프리필(number input, 조정 가능)** + 코멘트 + 저장. CSV 내보내기(NEIS).

### 데이터 모델 (수행평가)
```
assessment/exam/{cid}              : { active, weights:{predict,trace,cloze,implement},
                                       predict[], trace[], cloze[], implement[], updatedAt }
  predict 문제   = { id, code, stdin, expected }
  explain 문제   = { id, code, highlight:[줄번호], prompt(질문), answer(모범답안·채점참고) }
  cloze 문제     = { id, code('___'포함), blanks:[...], desc }
  implement 문제 = { id, title, desc, starter, tests:[{input,expected,hidden}] }
assessment/submissions/{cid}/{학번} : { answers:{predict,trace,cloze,implement}, autoScore:{part:{correct,total}}, submittedAt }
assessment/scores/{cid}/{학번}      : { algo,dataType,io,control,result, comment, scoredAt }  // 선생님 조정값(없으면 자동)
```
- 구 `assessment/phase`·`assessment/sessions` 는 **폐기**(코드/규칙에서 제거). 데이터는 방치(무해).

---

# ⚠️ Firebase 규칙 — 콘솔 게시 필요 (이번 세션 변경!)
`database.rules.json` 변경됨 → **Firebase 콘솔 → Realtime Database → 규칙 → 게시** 안 하면 PERMISSION_DENIED.
- 추가: `aicode/{active,sessions}`, `assessment/exam`, `assessment/submissions`
- 제거: `assessment/{active,phase,sessions}` (구버전)
- 동기화 URL: https://raw.githubusercontent.com/JunRepos/informatics/main/database.rules.json

---

# 🔬 검증 방법 (이번 세션에 사용)
node 없음 → **프리뷰 서버 + preview_eval** 로 검증:
1. `preview_start("static-server")` → python http.server 가 워크트리 서빙
2. `preview_eval` 로 전역 함수 정의 확인 + 뷰 함수 호출(throw 없는지) + 채점 헬퍼 단위 테스트
3. Pyodide 워커(`_asmtAnalyze`)도 라이브 호출로 검증(첫 로딩 ~10-15s)
4. `preview_screenshot` 로 레이아웃 육안 확인
- 전 뷰 렌더 OK, 채점/환산 정확, 자동분석 워커 정상 확인 완료.

---

# ✅ 전체 메뉴 현황 (정보반 기준)
| 메뉴 | 상태 |
|---|---|
| 📢 공지 / 📖 수업 / 📋 게시판 / 🗓️ 출결 / 👥 학생관리 | 안정 |
| 📓 노트북 | 안정 |
| 🎮 미션 | 그리드 카드 + 단계 텍스트 편집 |
| 💻 OJ | Markdown 업로드/내보내기 + 비주얼 OJ |
| 🧩 퀴즈 | 5유형 (predict/trace/mcq/cloze/bugfix) |
| 🤖 AI 코딩 | **신규** — 독립 메뉴 + 선생님 토글 + 세션 저장 |
| 📝 수행평가 | **전면 재설계** — 4파트 자동채점(예측·추적·빈칸·구현) + 출제/채점/CSV |
| 📅 진도계획 | 안정 (전역) |

---

# 🚧 다음 작업 후보 (미착수)
- **실교실 검증**: Firebase 규칙 게시 후 정보반에서 수행평가 출제 → 학생 제출 → 자동채점 → CSV 전체 흐름 1회 점검
- 수행평가 **샘플 문제 한방 등록** 버튼(4파트 예시 세트) — 선생님 편의
- 학생용 수행평가 안내서(루브릭/예시/일정) PDF
- 구현 파트 채점: 현재 테스트 통과율(부분점수). 필요시 문제 단위 all-or-nothing 옵션 검토
- (참고) Cloudflare Worker 시스템 프롬프트는 레포에 없음 — 수정 시 대시보드 `informatics-ai` 에서 통째 교체

## 작업 흐름 (자리잡은 패턴)
- 코드 변경 → 워크트리 커밋 → `git push origin claude/musing-kapitsa-488f5f:main`
- **새 DB 경로/규칙 추가 시 Firebase 콘솔 게시 안내 필수**
- 사용자 선호: **배포까지 직접 처리** / 토론하며 단계적으로 / 한국어 친근한 톤
