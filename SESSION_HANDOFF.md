# 🔄 세션 핸드오프 (2026-06-01 갱신)

> 새 세션은 **메모리(자동로드) + 이 핸드오프 + PROJECT_CONTEXT.md** 만 읽으면 복원 완료.
> 워크트리 `claude/musing-kapitsa-488f5f` / 배포 `git push origin claude/musing-kapitsa-488f5f:main` / curl 확인.
> 환경: node 없음·python 3.14 / 프리뷰는 python http.server 포트 +1 + preview_eval / 한글 콘솔 깨짐→파일 저장 후 Read.

## 🆕 2026-06-01 작업 요약

### 1. 🤖 기계학습 체험 메뉴 신규 (정보반, 코드 0줄) — 자세한 건 메모리 [ml_feature.md]
- **지도학습**: 이모지 데이터셋(과일/동물/표정, 각 3클래스) 선택 → 3개 고정 그룹에 이름 입력 → 공용 풀 사진을 그룹으로 **드래그/클릭**해 담기 → 학습(KNN) → **테스트는 마우스로 직접 그림 그려서** 모델이 맞춤(확률막대).
- **비지도학습**: 사진을 PCA로 **2D 점 지도**에 배치 + 적당히 겹치게 변환 → K-Means 중심(✕)이 무작위에서 출발해 단계별로 색으로 묶임("자동 재생"/"한 단계"/"정답 공개" 순도).
- **강화학습**: 친구 Unity 게임 **Reinforced Duck**(https://8laos.github.io/reinforced-duck/) 새 탭 버튼 + **선생님이 설명 직접 편집**(ml/rlDesc). 플래피 카드 제거.
- 파일: `js/ml-data.js`·`js/ml-engine.js`·`js/views/ml.js`·`js/events/ml.js` + state/firebase/rules/css/student/teacher/index.html.
- 선생님 `🤖 기계학습` 탭에서 노출 토글(ml/active) + 설명 편집. **active 켜야 학생에게 보임.**

### 2. 💻 OJ 난이도 높은 5문제 제안 + import 파서 버그 수정
- `OJ_HARD_5_PROPOSAL.md` (최장연속출석·반장선거개표·숫자삼각형·산봉우리개수·거스름돈동전, 모두 1~6차시 범위·Python 검증). **OJ 마크다운 가져오기 형식**이라 일괄 import 가능.
- 버그 수정(`js/events/oj-actions.js` `parseOJMarkdown`): `### 케이스`가 `## 테스트`의 형제로 분해돼 테스트케이스 0개로 읽혀 **import 자체가 안 되던 버그** 수정. 기존 oj-조건문-반복문.md도 이제 import됨.

### 3. 정보 2-B 수행평가 채점 (Firebase 반영 완료) — 메모리 [assessment_grading_workflow.md]
- **프로그래밍(PET병)** 18명, **빅데이터** 14명(영역별 사유+종합 코멘트). 2-A 기준 역산해 일관 채점, 미제출 비움/8점 등 정책은 사용자 확인 후 적용. 선생님이 빅데이터 일부 직접 수정·미제출 7명 8점 부여함(형평성 검토 완료, 현행 유지).
- ⚠️ **두 평가 모두 학생 공개(published)는 꺼진 상태.**

### 4. 🐛 점수 관리 탭 레이스 수정
- 진입 즉시 render 안 하고 .then에서만 해서 "데이터 안 뜨다가 메뉴 왔다갔다 하면 뜨는" 버그 → `SC_LOADING` 플래그 + 즉시 로딩렌더 + `.catch` (학생 '내 점수' 패턴과 동일).

### ⚠️ 펜딩 (선생님이 할 일)
1. **Firebase 콘솔에서 `database.rules.json` 재게시** — `ml/active`·`ml/rlDesc` 노드 추가됨 (안 하면 기계학습 토글·강화 설명저장 PERMISSION_DENIED). 이전 펜딩(scoresExt/published/reasonsPublished/aiactivity/studentDownloadLocked)도 함께 적용.
2. 정보반에 `🤖 기계학습` **노출 토글 ON** + 강화학습 설명 입력.
3. 수행평가 점수 **공개 토글** (검토 후) 켜기.
4. `OJ_HARD_5_PROPOSAL.md` import (원하면).

---

# 🔄 세션 핸드오프 (2026-05-28 갱신)

## 🆕 2026-05-27~28 작업 요약

### 1. 점수 관리 — 영역별 사유 + 공개 토글 분리
- 선생님 점수 관리 표에서 학생 행 ▼ 클릭 → 영역별(`prob/data/viz/insight`) 사유 textarea
- 사유 공개 토글을 점수 공개 토글과 **분리** (`assessment/reasonsPublished/{cid}/{asmtId}`)
  - 점수 공개 OFF 상태에선 사유 토글 자동 비활성화
  - 점수 공개 끄면 사유 공개도 자동 OFF
- 학생 카드: 사유 공개 ON일 때만 영역별 💬 사유 표시 (종합 코멘트는 점수 공개만 따름)

### 2. 정보 2-A 빅데이터 채점 적용
- 학생 답안 PDF(`D:\Google drive\신동고등학교\...\정보 2-A\*.pdf`) 25명 검토
- 루브릭 기준 + 사용자 "널널 채점" 의도 + 영역별 일관성으로 검토
- Firebase에 **24명 reasons + comment 일괄 PATCH 적용**
- 사용자가 김진형 viz(5→4), 강수희 data(3→4), 김민관 data(3→4), 방경환 data(5→4), 윤희준 prob(5→4), 진민재 prob(5→4)·data(5→4), 안수연 prob(5→4), 이은택 insight(4→5) 등 조정함

### 3. 수업/과제 학생 다운로드 잠금 토글
- `assignments/{cid}/{aid}/studentDownloadLocked` (bool)
- 선생님 수업 탭에 🔓/🔒 토글 버튼, 잠긴 항목 제목 옆에 빨간 칩
- 학생 수업 상세에서 잠긴 과제의 첨부 파일 **카드 자체를 안 보이게** (잠금 메시지 X)
- 선생님은 그대로 다운로드 가능 (IS_TC 분기)
- **빅데이터 관련 13개 과제 일괄 잠금 적용** (양쪽 정보반)

### 4. 🧠 AI 활동지 메뉴 신규
- 정보반 학생/선생님 탭 신설 — `aiactivity/active/{cid}` 토글로 노출 제어
- 활동 정의는 `js/aiactivity-data.js`의 `AIA_LIST` (코드에 박힘)
- 첫 활동: **실생활/진로 분야 지능 에이전트 4요소 설계**
  - 🤖 내 에이전트 소개 (이름·간단 설명)
  - 4요소 (목표·환경·인식·학습 및 추론·행동)
  - 가장 도움이 될 사람
- 학생: 자동 저장(1.5초 debounce) + 임시 저장 + 📤 제출하기/🔁 다시 제출하기
- 선생님: 학생별 작성률 표 + 보기 + 답안 CSV 내보내기
- 데이터: `aiactivity/submissions/{cid}/{actId}/{학번}` = `{answers, updatedAt, submittedAt?}`

### 5. 정보 2-B 빅데이터 채점 (미적용)
- 학생 답안 PDF 14명(미제출 제외) 검토 완료
- 결과 파일: `C:\Users\PC\Downloads\빅데이터_채점결과_정보2-B_2026-05-28.md`
- **Firebase에는 아직 미적용** — 사용자가 새 세션에서 적용 여부 결정 예정
- 만점 3명: 강민승(20501)·김도연(20503)·이민호(20516)
- ⚠️ 최유연(20520) — CORREL=-0.985를 "상관관계 없음"으로 잘못 해석한 점이 옥에 티 (점수는 19)

### 6. PET병 챌린지 채점 검토 (의견만)
- 사용자가 정보 2-A PET병 채점 완료(공지함)
- Claude가 답안 markdown + 루브릭 대조 후 비일관성 검토만 진행
- **조정은 사용자가 결정 안 함** (현재 점수 그대로 유지 중)
- 비일관 의심: 김우혁 B=5 (4개 다 틀린데 만점), 권윤성 B=5 (1개 틀림), 김민관 B=5, 임수안·박종빈·최은교·황지현 C 점수가 루브릭상 1점 낮음

---

# 🔄 세션 핸드오프 (2026-05-26 갱신)

## 🆕 2026-05-26 추가 작업 — 수행평가 점수 확인 탭

3개 수행평가(빅데이터 20 / PET병 25 / AI 15 = **총 60점**)를 한 곳에서 조회·채점·공개 제어하는 신규 탭 추가, 배포됨 (commit `696e77f`).

### 학생 — `📊 내 점수` 탭 (정보반만)
- 공개된 수행평가만 세부 영역별 점수 + 막대 그래프로 표시
- 선생님 코멘트, 채점일 표시
- 점수 티어(만점/거의/중간/낮음)에 따른 색상 강조 (초록·파랑·주황·빨강)
- 비공개·미채점·준비중 상태는 안내 카드만

### 선생님 — `🏆 점수 관리` 탭 (정보반만)
- **빅데이터 탭**: 학생 명단 표 + 영역별 5/4/3/2/0/– 드롭다운 + 코멘트 + 저장 버튼 + 통계(평균 등)
- **PET병 탭**: 점수는 조회만, "채점 →" 버튼으로 기존 수행평가 화면으로 이동
- **AI 탭**: placeholder ("아직 구체화 안 됨" 안내)
- **종합 탭**: 학생별 3개 수행평가 합계 + 반 평균 + CSV 내보내기
- 각 수행평가별 **공개/비공개 토글** (반 단위: 2-A/2-B 따로)

### 데이터 모델
- `assessment/scoresExt/{cid}/{학번}/{asmtId}` — 빅데이터/AI 점수 (신규 노드)
- `assessment/published/{cid}/{asmtId}` — 공개 토글 (신규 노드, bool)
- `assessment/scores/{cid}/{학번}` — PET병(legacy) 그대로 유지

### 핵심 파일
| 영역 | 파일 |
|---|---|
| **수행평가 메타** | `js/assessment-data.js` 의 `ASMT_LIST` (3개 정의) + `asmtById/ASMT_TOTAL_ALL` |
| 점수 뷰 | `js/views/score.js` — `vStMyScore` / `vTcScores` |
| 점수 이벤트 | `js/events/score.js` — `sc-tab` / `sc-publish` / `sc-save` / `sc-set` / `sc-cmt` / `sc-export-csv` / `sc-goto-pet` |
| DB 함수 | `js/firebase.js` — `loadAsmtScoreExt/saveAsmtScoreExt/loadAllAsmtScoresExt/loadAsmtPublished/setAsmtPublished/loadMyAsmtScores` |
| 상태 | `js/state.js` — `SC_TC_ASMT/SC_PUBLISHED/SC_BIGDATA_SCORES/SC_AICODE_SCORES/SC_SAVING_SNUM/MY_SCORES/MY_SCORES_PUB` |
| 규칙 | `database.rules.json` — `assessment.scoresExt` + `assessment.published` 추가 |

### ⚠️ 선생님이 해야 할 일 (펜딩)
1. **Firebase Realtime Database 규칙 재게시** — 콘솔에 `database.rules.json` 통째 붙여넣기 + 게시
   - 안 하면 빅데이터 점수 저장/공개 토글 모두 **PERMISSION_DENIED**
   - 5월 22일자 펜딩(다중 파일/`classDate` 허용)이 아직 안 됐다면 함께 적용됨
2. (기존) Storage CORS 적용
3. (기존) 통합 가이드북 워드 한번 열어 확인

### 다음 작업 후보
- AI 수행평가 세부 배점 확정 시 `ASMT_LIST` 의 `aicode` 항목 채우기 + `placeholder:true` 제거
- 학생 점수 변동 알림 (선택 사항 — 공개 시점에 학생 화면 dashboard에 칩 표시)
- NEIS 입력용 CSV 포맷 조정 (현재는 일반 형식)

---

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
