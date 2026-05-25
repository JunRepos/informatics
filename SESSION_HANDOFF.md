# 🔄 세션 핸드오프 (2026-05-22)

> 새 세션을 열 때 이 문서 + `PROJECT_CONTEXT.md` + 메모리(MEMORY.md / curriculum_taught.md / assessment_redesign.md / feedback_deploy.md)만 읽으면 컨텍스트 복원 완료.

## 📅 세션 메타

- **브랜치**: `claude/musing-kapitsa-488f5f` (워크트리 `C:\Users\PC\Desktop\github\informatics\.claude\worktrees\musing-kapitsa-488f5f`)
- **배포**: `git push origin claude/musing-kapitsa-488f5f:main` → GitHub Pages 자동
- **확인**: `curl -s -o /dev/null -w "%{http_code}" https://junrepos.github.io/informatics/`
- **로컬 환경**: node 없음 / python 3.14 있음 / 한글 콘솔 깨짐(결과는 파일로 저장 후 Read)
- **프리뷰**: python http.server, 캐시 회피로 매번 포트 +1 (마지막은 3023)

---

# 🆕 이 세션에서 한 일 (요약)

## 1. 📝 수행평가 — 전면 재구성 (PET병 챌린지)

직전 세션의 4파트 시험(예측·해석·빈칸·구현)을 **전면 삭제**하고, 선생님 PDF(환경 동아리 PET병 수거 챌린지) 기반 2단계 수행평가를 신규 구현.

### 학생 화면
- **1단계** — A 분석·추상화(큰 자유 서술칸 1개), B 자료형(4칸). "2단계로" → 1단계 잠금(되돌아갈 수 없음).
- **2단계** — C 코드 빈칸 8개 + ▶ 실행(입력칸에 5명치 수치) + 🧪 테스트(3 케이스 자동 채점).
- 빈칸 옆 **[모름] 빨간 테두리 버튼** → 정답 자동 채움(정답은 화면에서 숨김, "모름 처리됨"으로 가려짐) → 실행 가능.
- 코드 **VSCode식 구문 강조** (라이트/다크 각각). `int(input())`은 통째로 한 빈칸.
- 테스트 채점은 **숫자만 관대 비교**(30 = 30.0 통과, 값 다르면 실패).

### 현재 코드 (assessment-data.js `ASMT_DEF`)
- 변수명 `pets`, 평균 `avg = sum(pets) / 5`, 최종 `print(avg, upper, lower, mul3)`
- 빈칸 정답: `int / pets.append(count) / sum(pets) / 5 / in pets / if / else / i%3==0 and i!=0 / print(avg, upper, lower, mul3)`
- 테스트: `[10 30 40 50 20]→30.0 4 1 1`, `[12 5 4 9 20]→10.0 1 4 2`, `[0 4 2 5 20]→6.2 1 4 0`
- 입력칸 placeholder는 전부 제거(설명문·💡 박스는 유지)
- A 서술 = 한 줄 텍스트(배열 아님), 채점 A5/B5/C12/D3 = 25점 (선생님 수동)

### 선생님 화면
- "📝 시험 시작"/"🔒 닫기" 토글
- 학생별 진행(미응시/1단계/2단계/제출) + 점수 칩
- 학생 상세: A/B 답, C 빈칸 표(학생답 vs 정답·모름표시), **"🧪 이 학생 코드로 테스트 실행"** 버튼
- A·B·C·D 점수 + 코멘트, 점수 CSV/답안 .md 내보내기

## 2. 📖 수행평가 안내(연습) 탭

학생이 실제 수행평가 진행 방식을 미리 익히도록 **별도 탭** 신설. 처음엔 책 읽기 챌린지로 만들었으나 **묻는 것·코드 구조가 실제와 너무 비슷해 문제 유출 위험** → **매점 거스름돈 계산기**(사칙연산·`//`·`%`)로 교체. 같은 형식(2단계·빈칸·모름·실행·테스트)이되 **다른 종류의 문제**라 형식만 학습.

- **선생님 토글 독립**: `assessment/guideActive` (실제 시험과 별개). 수행평가 관리 화면에 "📖 안내 열기/닫기" 토글.
- 제출·채점·Firebase 저장 **없음**(로컬 연습). "↩ 처음부터 다시" 버튼.
- `int(input())` 두 곳 통째로 빈칸. 테스트: `(700,1000)→300 0 3` 등.
- 공용 렌더러 `_asmtExamView(def, state, prefix, opts)` 로 실제/안내 같은 화면 코드 공유. AG_* 상태 분리.

## 3. 🧩 퀴즈(코드 읽기) — 연습문제 8개 한방 등록

학생들이 약한 **반복문·조건문 흐름 읽기** 훈련용. 모두 1~6차시 범위·복합 개념.

- **새 유형 추가**: `🧪 코드 완성 (codetest)` — 수행평가식(빈칸+모름+실행+테스트). 수행평가 헬퍼(`_asmtRunCode`/`_asmtPass`/`_asmtHighlight`) 재사용. 상태 `CR_CT`, 이벤트 `cr-ct-*`. 편집기는 제목·설명만 수정(코드/테스트는 보존).
- **📦 연습문제 한방 등록 버튼**: 현재 반에 8문제 일괄 등록.
  - 예측 5: 반복+조건 누적 / while+`//`·`%` / 이중반복 / 조건 수집+append / continue·break
  - 코드완성 3: 짝수합 / 가장 큰 수 찾기(`num=int(input())`/`nums.append(num)` 두 줄 분리) / 1~N 3의 배수 개수·합
- 정답·모름 자동채움 모두 3/3 통과 검증됨.

## 4. 📘 파이썬 통합 가이드북 (Word)

선생님 1~6차시 가이드북 5개(.docx)를 통합한 **Word 통합본** 생성. python-docx 1.2.0 설치 후 빌드.

- **경로**: `D:\Google drive\신동고등학교\01_교과_정보\알고리즘과 프로그래밍\파이썬 통합 가이드북.docx`
- 2단 A4, 6장(들어가며 + 1.변수·자료형 / 2.입출력·산술 / 3.리스트 / 4.선택구조 / 5.반복구조 + 이중반복 / 통합예시 3개)
- **continue/break 제외** (가이드북 통합 시 요청), **이중반복 포함**.
- 13개 코드 예시(챕터별 2 + 통합 3), 모두 Pyodide로 출력 검증.
- 빌드 스크립트: `C:\Users\PC\AppData\Local\Temp\build_guidebook.py` (재실행 가능)
- ⚠️ LibreOffice 미설치라 PDF 변환 검증을 못 함 → Word로 한 번 확인 필요(2단 표 폭 등).

## 5. 🐛 Firebase 인프라 버그 수정

### ① PERMISSION_DENIED — 다중 파일 수업 등록 시
- **원인**: 기존 규칙이 `notices/assignments/submissions/posts` 에 `$other: validate false` 라 다중 파일이 쓰는 `files` 배열 + 과제의 `classDate`가 거부됨.
- **수정**: 4개 노드의 `$other` 라인을 `files`/`classDate` 허용으로 교체 (commit `f6f7230`).
- 사용자가 콘솔에서 **규칙 재게시 필요**.

### ② ZIP 일괄 다운로드 CORS 실패
- **원인**: 일괄 다운로드는 `fetch()`로 Storage 바이트를 읽는데 **버킷에 CORS 미설정**. (COEP는 coi-serviceworker에서 이미 credentialless라 그쪽은 정상)
- **수정**: `storage-cors.json` 추가(GET/HEAD, origin `*`). 사용자가 **gcloud로 버킷에 적용 필요**:
  ```bash
  gcloud storage buckets update gs://sindong-informatics.firebasestorage.app --cors-file=cors.json
  ```

## 6. 🧠 메모리 갱신

- `memory/curriculum_taught.md` 신규 — 실제 수업 1~6차시 범위 정리(가이드북 docx 5개로 확정). def·split·map·딕셔너리 미학습 → 문제·예시는 이 범위 안에서만.
- `memory/assessment_redesign.md` 최신화 — PET병 신규 구현 완료, 정의는 `js/assessment-data.js`.
- `memory/MEMORY.md` 인덱스 줄 갱신.

---

# 🗂 핵심 파일 맵

| 영역 | 파일 |
|---|---|
| **수행평가 데이터** | `js/assessment-data.js` (ASMT_DEF · ASMT_GUIDE_DEF) — 문제 바꾸려면 여기만 |
| 수행평가 뷰/이벤트 | `js/views/assessment.js` (공유 `_asmtExamView` 포함) / `js/events/assessment.js` |
| 수행평가 상태 | `js/state.js` (ASMT_* · AG_* · ASMT_RUBRIC) |
| 수행평가 DB | `js/firebase.js` (loadAsmt*/setAsmt* · loadAsmtGuideActive) |
| **퀴즈 연습문제 팩** | `js/events/coderead.js` (`CR_PRACTICE_PACK` + `cr-register-pack` · 코드완성 이벤트) |
| 퀴즈 코드완성 뷰 | `js/views/coderead.js` (`vStQuizCodeTest` · `_crCtRenderCode`) |
| **DB 규칙** | `database.rules.json` (assessment.active/guideActive/submissions/scores; files/classDate 허용됨) |
| Storage CORS | `storage-cors.json` (gcloud로 버킷 적용) |
| 화면필기 안드로이드 | 별도 레포(`JunRepos/screen-draw`) — informatics와 무관 |
| 통합 가이드북 빌더 | `C:\Users\PC\AppData\Local\Temp\build_guidebook.py` |

---

# ⚠️ 사용자가 해야 할 일 (펜딩)

1. **Firebase Realtime Database 규칙 재게시** — 콘솔에 `database.rules.json` 통째 붙여넣기 + 게시. (다중 파일 수업 등록 풀림. 전에 한 번 게시한 적 있어도 `files`/`classDate` 추가본을 다시 게시해야 함)
2. **Storage CORS 적용** — Cloud Shell에서 위 gcloud 명령 한 번 실행. (ZIP 일괄 다운로드 풀림)
3. Word 통합 가이드북을 한 번 열어 2단 레이아웃·표 폭 확인. 어색하면 조정 가능.

---

# 🔧 운영 메모 (다음 세션에서 알아두면 좋음)

- **JS/CSS 캐시**: 브라우저가 옛 파일을 캐시하므로, 프리뷰 검증 시 매번 launch.json 포트를 +1 한 뒤 `preview_stop` → `preview_start`. 실제 배포본은 `?cb=$(date +%s)` 쿼리로 curl 검증.
- **한글 콘솔 깨짐**: Bash 출력에서 한글이 깨져 보일 수 있음 → 결과는 파일로 저장 후 Read 도구로 확인.
- **수행평가/안내 화면 공유**: `_asmtExamView(def, state, prefix, opts)` 한 함수가 실제/안내 양쪽 렌더. 새 변형이 필요하면 새 def + AG_-style 상태 + prefix만 추가하면 됨.
- **codetest 유형**: 예제 등록 전용. 편집기는 제목/설명만 수정. 코드/빈칸/테스트 손대려면 `CR_PRACTICE_PACK` 데이터 직접 수정 후 한방 등록 다시.
- **수업 범위**: `curriculum_taught.md` 참고. 문제·예시에 `def`/`split`/`map`/딕셔너리 쓰지 말 것.
- **AI 코딩 메뉴**: 실제로는 `oj-worker.js`를 사용함(`asmt-worker.js` 아님 — 그 파일은 삭제됨). 잘못된 주석도 정정 완료.
- **screen-draw 안드로이드**: informatics 와 무관 (별도 레포 `JunRepos/screen-draw`, 로컬 ScreenHandwriting 폴더).

---

# 🎯 새 세션 시작 절차

1. 워크트리로 이동: `cd .claude/worktrees/musing-kapitsa-488f5f`
2. `git log --oneline -15` 최근 작업 확인
3. 메모리(자동 로드) + 이 핸드오프 + PROJECT_CONTEXT.md 확인
4. 사용자 요청 받기
5. 변경 후 `git push origin claude/musing-kapitsa-488f5f:main` + curl 검증 (떠넘기지 말기)
