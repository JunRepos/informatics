# 🔄 세션 핸드오프 문서

> 이 문서 + **PROJECT_CONTEXT.md** 만 읽으면 컨텍스트 완전 복원 가능.
> 새 세션 시작: ① PROJECT_CONTEXT.md → ② 이 문서 → ③ `git log --oneline -25`

---

## 📅 세션 메타
- **마지막 갱신**: 2026-05-21 (저녁, 실교실 테스트 후 반복 수정까지)
- **마지막 커밋**: `a589f37` (수행평가 — 코드해석 다문항화 + 자동채점 제거)
- **작업 브랜치/워크트리**: `claude/musing-kapitsa-488f5f`
  - 경로: `C:\Users\PC\Desktop\github\informatics\.claude\worktrees\musing-kapitsa-488f5f`
- **배포**: `git push origin claude/musing-kapitsa-488f5f:main` → GitHub Pages 자동
- **사이트**: https://junrepos.github.io/informatics/
- **커밋 시 git 설정**: `git -c user.name="JunRepos" -c user.email="chlwns1023@gmail.com" commit ...`
- **배포 확인**: `until curl -s ".../<파일>?v=$(date +%s)" | grep -q "<키워드>"; do sleep 15; done` (background로)

### ⚠️ 환경 메모 (중요)
- 이 워크트리엔 **node 없음**. **python 3.14 있음**.
- **JS 문법/동작 검증 = 프리뷰 서버 + preview_eval** 로 함 (아래 "검증 방법" 참고).
- **PowerShell 콘솔은 한글 출력 깨짐** → 한글 결과는 파일로 저장 후 Read.
- `database.rules.json` 은 `//` 주석 포함(Firebase 허용, 정상).
- 커밋 시 LF→CRLF 경고는 무시해도 됨.

---

# 🆕 이번 세션(2026-05-21) 한 일 — 큰 그림

실교실 테스트를 돌리며 **빠르게 반복 수정**한 세션. 세 덩어리:

### A. 🤖 AI 코딩 — 독립 메뉴 신설 (수행평가에서 분리)
- 기존 수행평가의 AI 채팅(Gemini)을 떼어내 **정보반 독립 탭 "🤖 AI 코딩"** 으로.
- 선생님 **on/off 토글**(`aicode/active/{cid}`), 학생별 **세션 저장**(`aicode/sessions/{cid}/{학번}`, 이어하기).
- 진입을 **"✏️ 제가 만들어볼래요" 버튼 1개**로 단순화(예시·카테고리·자동인사 제거 — 프로그램 난이도 편차 커서).
- **실시간 input()** 지원(Colab식): `input()` 만나면 노란 입력칸 등장. **`oj-worker.js` 재사용**(SharedArrayBuffer). → 사전입력/EOFError 혼란 제거.
- **결정**: AI로 수행평가 보는 건 **폐기**(난이도 편차). AI 코딩 메뉴는 **나중에 '보고서 작성 활동'으로 재활용** 예정 → **메뉴 유지, 지우지 말 것.**
- 파일: `js/views/aicode.js`, `js/events/aicode.js`, state `AIC_*`.

### B. 📝 수행평가 — 전면 재설계 (여러 번 방향 바뀜, 최종은 아래 "현재 상태")
- 구버전(AI채팅 1차시 + 서술형5문항 2차시) **전부 폐기**.
- 1차: 4파트 자동채점(예측/추적/빈칸/구현) → 2차: 변수추적을 **코드해석(서술형)** 으로 → 3차(최종): **자동채점 전면 제거 + 코드해석 다문항화**.

### C. 🧩 퀴즈(coderead) 보강
- 빈칸(cloze): 선생님 안내를 **코드 바로 위**에 표시 + 하드코딩 "예: print" 제거.
- 변수추적(trace) 제거, **코드해석(explain)** 유형 추가(코드+강조줄+모범답안, 학생 서술 후 제출→모범답안 자가확인). 레거시 trace 데이터는 기존 렌더 유지.

---

# 📝 수행평가 — 현재 상태 (최종, 가장 중요)

> 사용자가 **새 세션에서 더 수정 예정**. 현재 동작하는 베이스라인:

## 구성: 4파트(예측·코드해석·빈칸·구현) 유지, 단 **자동채점은 전부 제거됨**
| 파트 | 학생 | 출제 |
|---|---|---|
| 🔮 출력예측(predict) | 코드 보고 출력 서술 | 코드+stdin, 🪄자동분석으로 expected 추출(이젠 *참고 정답*용) |
| 📝 **코드해석(explain) — 핵심** | **코드 1개 + 주관식 문제 여러 개**, 문제별 textarea | 코드 + 강조줄(선택) + **질문 여러 개**(+모범답안) |
| 🧩 빈칸(cloze) | `___` 채움 | 코드(`___`)+정답 |
| ⌨️ 구현(implement) | 코드 작성, **▶실행(실시간 input)** 자기점검 | 제목/설명/시작코드/테스트케이스 |

## 채점 = **자동채점 없음, 선생님 수동**
- 학생 **제출 → 답안만 즉시 저장**(채점/실행 안 함).
- 선생님 "보기" → 파트별 학생 답 + **참고 정답·모범답안 나란히**(정답/오답 자동표시 없음) + **5요소 점수 직접 입력**(미채점 표시) + 코멘트 + 저장.
- 내보내기 2종: **📤 점수 CSV**(NEIS), **📝 답안 내보내기(.md)**(학생 전체 답안 → 나중에 Claude가 채점).
- 5요소(계획서 25점): ①예측→⑤결과 / ②코드해석→②자료형 / ③빈칸→④제어 / ④구현→①추상화+③입출력. 배점은 선생님 조정(기본 5/5/5/10), 자동채점 없으니 **5요소 점수 상한**으로만 쓰임.

## 데이터 모델 (수행평가)
```
assessment/exam/{cid} = { active, weights:{predict,explain,cloze,implement},
  predict[], explain[], cloze[], implement[], updatedAt }
  predict   = { id, code, stdin, expected }            // expected=참고정답
  explain   = { id, code, highlight:[줄번호], questions:[{id, q, model}] }   ★ 다문항
  cloze     = { id, code('___'포함), blanks:[...], desc }
  implement = { id, title, desc, starter, tests:[{input,expected,hidden}] }
assessment/submissions/{cid}/{학번} = { answers, submittedAt }   // autoScore 더이상 없음
  answers = { predict:{qid:str}, explain:{qid:{subQid:str}}, cloze:{qid:[str]}, implement:{qid:code} }
assessment/scores/{cid}/{학번} = { algo,dataType,io,control,result, comment, scoredAt }  // 선생님 수동
```

## 핵심 함수 (js/views/assessment.js, js/events/assessment.js, state ASMT_*) — 전부 구현·검증됨
- `_asmtExplainQs(q)` (assessment.js:81) — explain 문제의 주관식 목록 반환. `q.questions` 있으면 그대로, 없으면 구 `{prompt,answer}` → `[{id:'q1',q:prompt,model:answer}]` 호환. **정의돼 있음(걱정 X).**
- 학생: `_vStAsmtExplain`(코드 + 문제별 textarea, `data-action="asmt-ans-explain" data-qid data-sub`), `_asmtPartProgress`(explain은 문항 단위 카운트)
- 선생님 출제: `_vTcEditExplain`(질문 add/del = `asmt-add-eq-q`/`asmt-del-eq-q`, 필드 = `asmt-eq-q-field`)
- 선생님 채점: `vTcAsmtStudent`(파트별 답+참고정답/모범답안, 5요소 수동입력), `_asmtFinalScore`(저장점수만)
- 제출: `_asmtSubmitExam`(답안만 저장), 내보내기 `_asmtExportCsv`(점수)/`_asmtExportAnswers`(답안 .md)
- (참고) `_asmtGradeSyncPart`/`_asmt5`/`ASMT_AUTO`는 자동채점 잔재 — 현재 미사용(삭제해도 무방). `_asmtRun`(asmt-worker)은 구현 ▶실행에서 아직 사용.

> 프리뷰 eval로 학생 다문항(textarea 3개·data-sub)·진행률(문항단위)·출제(질문 add/del)·교사상세·내보내기 모두 정상 확인됨.

---

# 🤖 AI 코딩 메뉴 — 현재 상태
- 학생: `vStAiCode`(entry→chat), 진입 `aic-begin` → 채팅(좌 채팅/우 코드패널). `AIC_TURN_LIMIT=40`.
- **실시간 input()**: `events/aicode.js`의 `_getAicWorker`(=`oj-worker.js` 재사용, SAB) + `_showAicInlineInput`(노란칸, `.oj-live-*` 스타일 재사용) + `_runAicCode(code)`(mode:'run'). 코드 패널에 `#aic-run-area`.
- 선생님: `vTcAicManage`(토글+사용현황), `vTcAicStudent`(대화·코드 열람).
- 백엔드 워커: 아래 "Cloudflare Worker" 참고.

---

# 🧩 퀴즈(coderead) — 현재 상태
- 유형(`QUIZ_TYPES`, js/views/coderead.js): predict / **explain(코드해석)** / mcq / cloze / bugfix. (trace 제거, 레거시 trace 데이터는 `vStQuizCodeSplit`로 계속 렌더)
- explain: 출제(코드+`cr-e-highlight`줄+`cr-e-answer`모범답안), 학생 `vStQuizExplain`(서술 후 `cr-submit-explain`→모범답안 자가확인, 통과 처리).
- 강조 줄 CSS: `.cr-code-line.hl`. DB는 기존 `codeReadings`/`codeReadingProgress` 그대로(`type:'explain'`, `highlight`, `answer` 필드 추가 — 규칙이 필수필드만 검증해서 OK).

---

# 🌐 Cloudflare Worker (AI 코딩 백엔드) — 레포에 없음, 대시보드에만 존재
- **URL**: `https://informatics-ai.chlwns1023.workers.dev` (state.js `AIC_WORKER_URL`)
- **모델**: `gemini-2.5-flash`, Secret `GEMINI_API_KEY`.
- **이번 세션에 적용한 핵심 수정** (사용자가 대시보드에서 직접 함):
  - `generationConfig`에 **`thinkingConfig: { thinkingBudget: 0 }`** + `maxOutputTokens: 4096`. → thinking이 토큰 까먹어 **답 잘림** 버그 해결.
- **시스템 프롬프트**(대시보드에만): 고2, 조건문+반복문까지 배움. 코드 작성 시 제약 — f-string/round/문자열곱셈/def/class/import/주석(#) 금지, 변수명 짧게, 콤마 print. **실행환경 안내 블록**(input()은 화면 입력칸으로 실시간 입력됨, IDLE/VS Code 언급 금지)을 넣어둠. **길이 제약**(20~25줄, 입력검증 while·메뉴 while True·장식 print 금지)도 추가됨.
- 워커 수정하려면: 코드 전체를 새로 만들어 사용자에게 주고 → 대시보드 `informatics-ai` → Edit code → 교체 → Deploy.

---

# 🔥 Firebase
- 프로젝트 `sindong-informatics`, DB `https://sindong-informatics-default-rtdb.firebaseio.com`.
- **규칙은 게시돼 있음**(사용자가 콘솔에 게시 완료). 새 경로 추가 시 또 게시 필요.
- 이번에 추가/변경된 규칙: `aicode/{active,sessions}`, `assessment/{exam,submissions,scores}`. (구 `assessment/{phase,sessions,active}` 제거)
- **REST로 학생 데이터 읽어 디버깅 가능** (규칙이 `$classId` 레벨 `.read:true`):
  - ✅ 됨: `.../aicode/sessions/info-2A.json`, `.../assessment/submissions/info-2A.json` (반 단위)
  - ❌ 안 됨: `.../aicode/sessions.json` (상위 노드는 read 권한 없음 → Permission denied. **부모 통째 읽기는 원래 거부되는 게 정상**, 규칙 미게시 아님!)
  - active: `.../aicode/active/info-2A.json` → `true`/`null`
  - 한글 깨짐 방지: curl→파일 저장 후 python으로 요약→파일→Read.

---

# 🔬 검증 방법 (이번 세션 내내 사용)
node 없음 → **python http.server 프리뷰 + preview_eval**:
1. `.claude/launch.json`(메인 레포 것 — 프리뷰가 이걸 읽음)에 python 정적서버 설정. **워크트리를 서빙**하도록 `--directory .claude/worktrees/musing-kapitsa-488f5f`.
2. **브라우저 캐시 회피**: python http.server는 no-cache 헤더가 없어 `location.reload()로도 옛 JS가 캐시됨.** → **포트를 바꿔(예 3013→3014) 새 origin으로 띄우면 확실히 새 파일 로드.** (이번 세션에 이 트릭 계속 씀. 기존 포트 python은 `Stop-Process`로 종료 후 `preview_start`.)
3. `preview_console_logs`(error) + `preview_eval`로 전역 함수 정의/뷰 렌더(throw 없는지)/로직 단위 테스트.
4. **`crossOriginIsolated`가 localhost에서도 true**(coi-serviceworker 사이트 전역 로드) → 실시간 input()도 프리뷰에서 끝까지 테스트 가능.
5. `preview_screenshot`은 이 환경에서 자주 timeout남(렌더러 이슈) — eval 검증으로 대체해도 됨.

---

# 🚧 다음 작업 (새 세션)
- ⭐ **사용자가 수행평가를 "더 수정" 예정** (구체 내용 미정 — 새 세션에서 받을 것). 위 "수행평가 현재 상태"가 출발점.
- ⚠️ **착수 즉시 점검**: `_asmtExplainQs` 헬퍼 정의 여부 + `_vStAsmtExplain`이 `q.questions` 다문항 렌더인지 (위 수행평가 섹션의 경고 참고). 깨졌으면 먼저 고치고 진행.
- 미착수(이전부터): 학생용 수행평가 안내서(루브릭/예시) PDF, 수행평가 샘플문제 한방등록, AI 코딩 → 보고서 활동 전환.
- 채점 위임: 사용자가 **답안 .md 내보내기** 파일을 주면 5요소 기준으로 Claude가 채점하기로 함.

---

# ✅ 전체 메뉴 현황 (정보반 기준)
| 메뉴 | 상태 |
|---|---|
| 📢 공지 / 📖 수업 / 📋 게시판 / 🗓️ 출결 / 👥 학생관리 | 안정 |
| 📓 노트북 | 안정 (Colab식, 실시간 input, 진도저장). `이중반복문_구구단_계단.ipynb`(데스크톱) 업로드용 워크시트 만들어둠 |
| 🎮 미션 | 그리드 카드, 단계 텍스트만 편집 |
| 💻 OJ | Markdown 업로드/내보내기, 비주얼 OJ, 실시간 input |
| 🧩 퀴즈 | predict/**explain(코드해석)**/mcq/cloze/bugfix |
| 🤖 AI 코딩 | **신규** — 독립 메뉴, 토글, 세션저장, **실시간 input**. (수행평가용 폐기→보고서용 보존) |
| 📝 수행평가 | **재설계** — 코드해석 다문항 중심 4파트, **자동채점 없음**, 선생님 수동채점+답안내보내기 |
| 📅 진도계획 | 안정 (전역) |

---

# 🧷 작업 패턴 / 사용자 선호
- 코드 변경 → 워크트리 커밋 → `git push origin claude/musing-kapitsa-488f5f:main` → curl로 배포 확인(background).
- **새 DB 경로/규칙 추가 시 Firebase 콘솔 게시 안내 필수.** 워커(시스템프롬프트) 수정은 Cloudflare 대시보드 안내.
- 사용자 선호: **배포까지 직접 처리** / 큰 결정은 토론·단계적으로(AskUserQuestion 잘 받음) / 한국어 친근한 톤 / 실교실에서 바로 쓰므로 `Ctrl+Shift+R` 안내.
- 메모리: `assessment_redesign.md`(수행평가 최종 설계) 갱신돼 있음.
