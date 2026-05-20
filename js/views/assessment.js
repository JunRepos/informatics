/* ═══════════════════════════════════════
   views/assessment.js — 수행평가 (AI 코딩 도우미)

   학생: 진로 인터뷰 → AI 코드 생성 → 줄별 설명 → 변형 과제 → 제출
   선생님: 활성화 토글 + 학생별 진행 현황 + 제출물 열람·채점

   백엔드: Cloudflare Worker → Gemini 2.5 Flash
   (워커 URL/턴 한도는 state.js 의 ASMT_WORKER_URL, ASMT_TURN_LIMIT)
═══════════════════════════════════════ */

// ══════════════════════════════════════
//  학생 뷰
// ══════════════════════════════════════

// 탭 진입 시 phase + 세션 상태로 학생의 첫 화면 결정
function _asmtInitialStudentView(phase, sess){
  if(phase === 'prep'){
    // 1차시: 제출했으면 대기, 아니면 진행 중 화면 (이어가기)
    if(sess?.prepSubmitted) return 'prep-done';
    if(sess?.messages?.length) return 'chat';
    return 'entry';
  }
  if(phase === 'eval'){
    // 2차시: 제출 완료면 done, 아니면 서술형 문항(describe)
    if(sess?.submittedAt) return 'done';
    if(!sess?.code) return 'eval-nocode';   // 1차시 코드가 없는 학생 (결석 등)
    return 'describe';
  }
  return 'off';
}

function vStAssessment(){
  const phase = SEL_CLS ? ASMT_PHASE[SEL_CLS.id] : 'off';
  // phase 우선 가드
  if(!phase || phase === 'off') return vStAsmtClosed();
  if(ASMT_VIEW === 'prep-done')  return vStAsmtPrepDone();
  if(ASMT_VIEW === 'eval-nocode')return vStAsmtNoCode();

  if(ASMT_VIEW === 'entry')    return vStAsmtEntry();
  if(ASMT_VIEW === 'examples') return vStAsmtExamples();
  if(ASMT_VIEW === 'chat')     return vStAsmtChat();
  if(ASMT_VIEW === 'describe') return vStAsmtDescribe();
  if(ASMT_VIEW === 'done')     return vStAsmtDone();
  return vStAsmtEntry();
}

// 2차시 서술형 5문항 (각 문항 = 채점 평가요소 1개)
const ASMT_QUESTIONS = [
  {id:'purpose', icon:'🎯', rubric:'문제 추상화',
   q:'이 프로그램은 무엇을 하나요?',
   hint:'전체 동작을 순서대로 설명해 보세요. (예: 점수 5개를 입력받아 평균을 구하고, 60점 이상이면 합격을 출력합니다)'},
  {id:'vars', icon:'📦', rubric:'자료형',
   q:'어떤 변수를 썼고, 각각 어떤 자료형인가요?',
   hint:'변수 이름과 함께 정수(int)·실수(float)·문자열(str) 중 무엇인지 적어 보세요.'},
  {id:'io', icon:'⌨️', rubric:'입출력',
   q:'무엇을 입력받고, 무엇을 출력하나요?',
   hint:'input()으로 받는 값과 print()로 나오는 값을 적어 보세요.'},
  {id:'control', icon:'🔀', rubric:'제어구조',
   q:'조건문(if)과 반복문(for/while)은 각각 어떤 역할을 하나요?',
   hint:'if는 어떤 상황에서 무엇을 하고, 반복문은 무엇을 몇 번 반복하는지 적어 보세요.'},
  {id:'result', icon:'🧪', rubric:'결과',
   q:'특정 값을 입력하면 결과가 어떻게 나올까요?',
   hint:'예상 결과를 적어 보세요. 아래에서 직접 실행해 확인할 수도 있어요.', hasRun:true},
];

// phase=off 일 때 (직접 접근 등)
function vStAsmtClosed(){
  return emptyBox('🔒', '수행평가가 아직 시작되지 않았어요. 선생님 안내를 기다려주세요.');
}

// 1차시 제출 완료 → 2차시 대기 화면
function vStAsmtPrepDone(){
  const codeLines = (ASMT_CODE || '').split('\n');
  const codeHtml = codeLines.map((ln, i) =>
    `<div class="cr-code-line"><span class="cr-line-no">${i+1}</span><span class="cr-line-src">${esc(ln) || ' '}</span></div>`
  ).join('');
  return `
    <div class="asmt-done-wrap">
      <div class="asmt-done-card">
        <div class="asmt-done-icon">✅</div>
        <div class="asmt-done-title">1차시 제출 완료!</div>
        <div class="asmt-done-sub">AI와 함께 만든 코드를 잘 제출했어요.<br>다음 시간에 이 코드로 평가 활동을 진행합니다.</div>
      </div>
      <div class="asmt-prepdone-codebox">
        <div class="asmt-prepdone-codehead">📄 내가 제출한 코드</div>
        <pre class="cr-code-box">${codeHtml}</pre>
      </div>
      <div class="asmt-done-note">
        💡 다음 시간 전까지 이 코드를 한 번씩 읽어보면, 2차시 활동(줄별 의미 적기·변형)이 훨씬 수월해요.
      </div>
    </div>
  `;
}

// 2차시인데 1차시 코드가 없는 학생 (결석 등)
function vStAsmtNoCode(){
  return emptyBox('📭', '1차시에 만든 코드가 없어요. 선생님께 문의해주세요. (결석 등으로 1차시에 참여하지 못한 경우)');
}

// 코드의 의미있는 줄(빈 줄·공백만인 줄 제외) 인덱스 배열
function _asmtMeaningfulLines(code){
  const lines = (code || '').split('\n');
  const idxs = [];
  for(let i = 0; i < lines.length; i++){
    if(lines[i].trim()) idxs.push(i);
  }
  return idxs;
}

function vStAsmtEntry(){
  // 진행 중 세션이 있으면 안내 배너
  const hasSession = ASMT_MESSAGES.length > 0 || ASMT_CODE;
  const resumeBanner = hasSession ? `
    <div class="asmt-resume-banner">
      <span>📌 이전에 진행 중이던 작업이 있어요</span>
      <button class="btn-p btn-sm" data-action="asmt-resume">이어서 하기</button>
    </div>` : '';

  return `
    <div class="asmt-entry-wrap">
      ${resumeBanner}
      <div class="asmt-hero">
        <div class="asmt-hero-title">📝 AI와 함께 만드는 나만의 프로그램</div>
        <div class="asmt-hero-sub">
          진로와 관련된 작은 Python 프로그램을 AI와 함께 구상하고,<br>
          코드의 의미를 직접 적어보는 활동입니다.
        </div>
      </div>

      <div class="asmt-step-row">
        <div class="asmt-step"><span class="asmt-step-num">1</span><span>AI와 대화하며 만들 프로그램 정하기</span></div>
        <div class="asmt-step-sep">→</div>
        <div class="asmt-step"><span class="asmt-step-num">2</span><span>AI가 만든 코드의 각 줄 의미 적기</span></div>
        <div class="asmt-step-sep">→</div>
        <div class="asmt-step"><span class="asmt-step-num">3</span><span>코드 변형 과제 풀기</span></div>
      </div>

      <div class="asmt-cards-title">시작 방법을 골라주세요</div>
      <div class="asmt-cards">
        <button class="asmt-card asmt-card-a" data-action="asmt-start-mode" data-mode="have-idea">
          <div class="asmt-card-icon">💡</div>
          <div class="asmt-card-title">아이디어가 있어요</div>
          <div class="asmt-card-desc">만들고 싶은 프로그램이 떠올랐어요.<br>바로 AI에게 부탁할게요.</div>
        </button>

        <button class="asmt-card asmt-card-b" data-action="asmt-start-mode" data-mode="need-help">
          <div class="asmt-card-icon">🤔</div>
          <div class="asmt-card-title">아직 모르겠어요</div>
          <div class="asmt-card-desc">AI가 질문을 던지면서<br>아이디어 찾는 걸 도와줘요.</div>
        </button>

        <button class="asmt-card asmt-card-c" data-action="asmt-start-mode" data-mode="examples">
          <div class="asmt-card-icon">📚</div>
          <div class="asmt-card-title">예시 보기</div>
          <div class="asmt-card-desc">진로별 프로그램 예시를 보고<br>마음에 드는 걸 골라요.</div>
        </button>
      </div>

      <div class="asmt-entry-note">
        💡 3분 동안 선택하지 않으면 AI가 먼저 인사할게요.
      </div>
    </div>
  `;
}

// ── 학생: 예시 보기 (카테고리 그리드 / 카테고리 내 예시 목록) ──
function vStAsmtExamples(){
  const back = `<div class="asmt-sub-header">
    <button class="btn-sm" data-action="asmt-back-entry">← 진입 화면으로</button>
    <div class="asmt-sub-title">${ASMT_EXAMPLES_CAT ? '예시 프로그램 선택' : '진로 카테고리 선택'}</div>
    <div></div>
  </div>`;

  if(!ASMT_EXAMPLES_CAT){
    // 카테고리 8개 그리드
    const cards = ASMT_CATEGORIES.map(c => `
      <button class="asmt-cat-card" data-action="asmt-pick-cat" data-cat="${esc(c.id)}">
        <div class="asmt-cat-emoji">${c.emoji}</div>
        <div class="asmt-cat-label">${esc(c.label)}</div>
        <div class="asmt-cat-tag">${esc(c.tagline)}</div>
      </button>
    `).join('');
    return back + `
      <div class="asmt-cat-grid">${cards}</div>
      <div class="asmt-entry-note">📌 내 진로가 안 보여도 가장 가까운 분야로 가서 예시를 보고, 채팅에서 직접 다듬어도 좋아요.</div>
    `;
  }

  // 선택된 카테고리의 예시 4개
  const cat = ASMT_CATEGORIES.find(c => c.id === ASMT_EXAMPLES_CAT);
  if(!cat){
    ASMT_EXAMPLES_CAT = null;
    return back;
  }
  const items = cat.examples.map((ex, i) => `
    <button class="asmt-example-row" data-action="asmt-pick-example" data-idx="${i}">
      <span class="asmt-example-num">${i + 1}</span>
      <span class="asmt-example-text">${esc(ex)}</span>
      <span class="asmt-example-arrow">→</span>
    </button>
  `).join('');
  return `<div class="asmt-sub-header">
      <button class="btn-sm" data-action="asmt-back-cats">← 카테고리</button>
      <div class="asmt-sub-title">${cat.emoji} ${esc(cat.label)} — 예시 프로그램</div>
      <div></div>
    </div>
    <div class="asmt-example-list">${items}</div>
    <div class="asmt-entry-note">📌 예시를 클릭하면 AI 에게 "이 프로그램을 만들어주세요" 라고 자동으로 요청해요. 채팅에서 더 다듬을 수 있어요.</div>
  `;
}

// ── 학생: 채팅 화면 (좌 채팅 / 우 코드 패널) ──
function vStAsmtChat(){
  const turnLeft = Math.max(0, ASMT_TURN_LIMIT - ASMT_TURN_COUNT);
  const isLimit = turnLeft <= 0;

  // 메시지 말풍선
  const messages = ASMT_MESSAGES.map(m => {
    if(m.role === 'user'){
      return `<div class="asmt-msg asmt-msg-user">
        <div class="asmt-msg-bubble">${esc(m.content)}</div>
      </div>`;
    }
    // assistant — 마크다운 + 코드 펜스 제거하여 렌더 (코드는 우측 패널로 옮겨감)
    const rendered = _renderAsmtAssistant(m.content);
    return `<div class="asmt-msg asmt-msg-ai">
      <div class="asmt-msg-avatar">🤖</div>
      <div class="asmt-msg-bubble">${rendered}</div>
    </div>`;
  }).join('');

  const loadingBubble = ASMT_LOADING ? `
    <div class="asmt-msg asmt-msg-ai">
      <div class="asmt-msg-avatar">🤖</div>
      <div class="asmt-msg-bubble asmt-msg-loading">
        <span></span><span></span><span></span>
      </div>
    </div>` : '';

  // 우측 코드 패널
  const codePanel = ASMT_CODE
    ? `<div class="asmt-code-head">
         <span>💻 AI가 만든 코드 (${ASMT_CODE.split('\n').length}줄)</span>
         <button class="btn-p btn-sm" data-action="asmt-submit-prep" ${ASMT_LOADING ? 'disabled' : ''}>📋 이 코드로 1차시 제출</button>
       </div>
       <pre class="asmt-code-body"><code>${esc(ASMT_CODE)}</code></pre>`
    : `<div class="asmt-code-empty">
         <div class="asmt-code-empty-icon">💻</div>
         <div class="asmt-code-empty-msg">AI에게 만들고 싶은 프로그램을 설명해주세요.<br>코드가 만들어지면 여기에 표시돼요.</div>
       </div>`;

  const inputDisabled = ASMT_LOADING || isLimit;
  const placeholder = isLimit
    ? '대화 한도(30회)를 모두 사용했어요. "이 코드로 진행" 버튼을 눌러주세요.'
    : ASMT_LOADING
      ? 'AI가 답변 중이에요...'
      : (ASMT_MESSAGES.length === 0
          ? '어떤 프로그램을 만들어볼까요? (예: 학생 점수 평균을 구하는 프로그램)'
          : '메시지를 입력하세요... (Enter로 전송, Shift+Enter 줄바꿈)');

  return `
    <div class="asmt-chat-wrap">
      <div class="asmt-chat-bar">
        <button class="btn-sm" data-action="asmt-back-entry">← 처음으로</button>
        <div class="asmt-chat-bar-stats">
          <span class="asmt-turn-chip${turnLeft <= 5 ? ' warn' : ''}">대화 ${ASMT_TURN_COUNT}/${ASMT_TURN_LIMIT}</span>
        </div>
      </div>

      <div class="asmt-chat-split">
        <div class="asmt-chat-left">
          <div class="asmt-msg-list" id="asmt-msg-list">
            ${messages || '<div class="asmt-msg-empty">AI에게 첫 메시지를 보내보세요 👇</div>'}
            ${loadingBubble}
          </div>
          <div class="asmt-input-row">
            <textarea
              id="asmt-input"
              class="asmt-input"
              rows="2"
              placeholder="${esc(placeholder)}"
              ${inputDisabled ? 'disabled' : ''}
            ></textarea>
            <button class="btn-p asmt-send-btn" data-action="asmt-send" ${inputDisabled ? 'disabled' : ''}>전송</button>
          </div>
        </div>

        <div class="asmt-chat-right">${codePanel}</div>
      </div>
    </div>
  `;
}

// AI 응답 텍스트에서 코드 펜스 제거 + 마크다운 간단 렌더
function _renderAsmtAssistant(text){
  if(!text) return '';
  // ```python ... ``` 또는 ``` ... ``` 펜스 제거 (코드는 우측 패널로 옮겨감)
  const stripped = text.replace(/```[\w-]*\n[\s\S]*?```/g, '*(코드는 오른쪽 패널을 확인해주세요 →)*');
  // marked 가 로드돼 있으면 사용, 아니면 간단 이스케이프
  if(typeof marked !== 'undefined'){
    return marked.parse(stripped);
  }
  return esc(stripped).replace(/\n/g, '<br>');
}

// AI 응답에서 첫 번째 python 코드 블록 추출 (없으면 null) + 주석 자동 제거
function _extractAsmtCode(text){
  if(!text) return null;
  const m = text.match(/```(?:python|py)?\n([\s\S]*?)```/);
  if(!m) return null;
  return _stripPyComments(m[1].replace(/\n$/, ''));
}

// 파이썬 코드에서 주석(#) 제거 — 학생이 직접 의미를 적어야 하므로 AI 주석은 차단.
// 문자열 리터럴 안의 # 은 보존. 줄 전체가 주석이던 줄은 통째로 삭제.
function _stripPyComments(code){
  const out = [];
  for(const line of (code || '').split('\n')){
    let inStr = false, strCh = '', cut = -1;
    for(let i = 0; i < line.length; i++){
      const c = line[i];
      if(inStr){
        if(c === strCh) inStr = false;
      } else if(c === '"' || c === "'"){
        inStr = true; strCh = c;
      } else if(c === '#'){
        cut = i; break;
      }
    }
    if(cut === -1){ out.push(line); continue; }
    const head = line.slice(0, cut).replace(/\s+$/, '');
    // 줄 전체가 주석이었으면 (코드 부분이 비어있으면) 그 줄은 버림
    if(head.trim() === '') continue;
    out.push(head);
  }
  return out.join('\n');
}


// ── 학생: 2차시 서술형 5문항 (코드 좌측 + 문항 우측) ──
function vStAsmtDescribe(){
  const code = ASMT_CODE || '';
  const codeLines = code.split('\n').map((src, i) =>
    `<div class="cr-code-line"><span class="cr-line-no">${i+1}</span><span class="cr-line-src">${esc(src) || ' '}</span></div>`
  ).join('');

  const answered = ASMT_QUESTIONS.filter(q => (ASMT_ANSWERS[q.id] || '').trim()).length;
  const total = ASMT_QUESTIONS.length;
  const pct = Math.round(answered / total * 100);

  // 실행 결과 (⑤ 문항용)
  let runBlock = '';
  if(ASMT_RUNNING){
    runBlock = `<div class="asmt-mod-run-loading">⏳ 실행 중... (첫 실행은 10~15초 걸려요)</div>`;
  } else if(ASMT_RUN_RESULT){
    const r = ASMT_RUN_RESULT;
    runBlock = `<div class="asmt-mod-run-result ${r.success ? 'ok' : 'err'}">
      <div class="asmt-mod-run-head">${r.success ? '✅ 실행 결과' : '⚠️ 실행 오류'}</div>
      ${r.output ? `<pre class="asmt-mod-run-out">${esc(r.output)}</pre>` : ''}
      ${r.error ? `<pre class="asmt-mod-run-err">${esc(r.error)}</pre>` : ''}
    </div>`;
  }

  const questionBlocks = ASMT_QUESTIONS.map((q, i) => {
    const saved = ASMT_ANSWERS[q.id] || '';
    const runUI = q.hasRun ? `
      <div class="asmt-q-run">
        <div class="asmt-q-run-row">
          <input type="text" class="asmt-q-stdin" data-action="asmt-result-stdin" value="${esc(ASMT_RESULT_STDIN)}" placeholder="실행에 쓸 입력값 (input이 여러 개면 한 줄에 하나씩은 어려우니 쉼표로: 3,5)" autocomplete="off"/>
          <button class="btn-sm" data-action="asmt-run-result" ${ASMT_RUNNING ? 'disabled' : ''}>${ASMT_RUNNING ? '⏳' : '▶ 실행'}</button>
        </div>
        ${runBlock}
      </div>` : '';
    return `
      <div class="asmt-q-card">
        <div class="asmt-q-head">
          <span class="asmt-q-icon">${q.icon}</span>
          <span class="asmt-q-num">${i+1}.</span>
          <span class="asmt-q-text">${esc(q.q)}</span>
          ${saved.trim() ? '<span class="asmt-q-check">✓</span>' : ''}
        </div>
        <div class="asmt-q-hint">${esc(q.hint)}</div>
        <textarea
          class="asmt-q-answer"
          data-action="asmt-answer-input"
          data-qid="${q.id}"
          placeholder="여기에 답을 적어주세요. 자세히 쓸수록 점수가 높아요!"
          spellcheck="false"
        >${esc(saved)}</textarea>
        ${runUI}
      </div>`;
  }).join('');

  return `
    <div class="asmt-desc-wrap">
      <div class="asmt-desc-bar">
        <div class="asmt-desc-title">📝 2차시 — 내 코드 설명하기</div>
        <div class="asmt-explain-progress">
          <span class="asmt-explain-count">${answered} / ${total} 문항 작성</span>
          <div class="asmt-explain-bar-track"><div class="asmt-explain-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <button class="btn-p btn-sm" data-action="asmt-submit-describe">제출하기</button>
      </div>

      <div class="asmt-desc-info">
        🤖 AI 채팅은 잠겼어요. 1차시에 만든 <b>내 코드</b>를 보면서 아래 질문에 답해 주세요.
        <b>정답을 외울 필요 없어요</b> — 코드를 보고 이해한 만큼, <b>자세히 설명할수록 높은 점수</b>를 받아요.
      </div>

      <div class="asmt-desc-split">
        <div class="asmt-desc-code">
          <div class="asmt-desc-code-head">📄 내 코드 (1차시에 만든 것)</div>
          <pre class="cr-code-box">${codeLines}</pre>
        </div>
        <div class="asmt-desc-questions">${questionBlocks}</div>
      </div>
    </div>
  `;
}

// ── 학생: 제출 완료 화면 ──
function vStAsmtDone(){
  const submittedAt = ASMT_SUBMITTED_AT ? fmtDt(ASMT_SUBMITTED_AT) : '';
  const answeredCount = ASMT_QUESTIONS ? ASMT_QUESTIONS.filter(q => (ASMT_ANSWERS[q.id]||'').trim()).length : 0;
  return `
    <div class="asmt-done-wrap">
      <div class="asmt-done-card">
        <div class="asmt-done-icon">🎉</div>
        <div class="asmt-done-title">수행평가 제출 완료!</div>
        <div class="asmt-done-sub">수고하셨어요. 선생님이 확인하시면 결과가 반영됩니다.</div>
        ${submittedAt ? `<div class="asmt-done-time">제출 시각: ${submittedAt}</div>` : ''}
      </div>

      <div class="asmt-done-summary">
        <div class="asmt-done-summary-title">📋 제출 내역 요약</div>
        <table class="asmt-done-table">
          <tr><td>1차시 — AI와 만든 코드</td><td>${(ASMT_CODE||'').split('\n').length}줄</td></tr>
          <tr><td>2차시 — 설명 문항 작성</td><td>${answeredCount} / ${ASMT_QUESTIONS ? ASMT_QUESTIONS.length : 5}문항</td></tr>
        </table>
      </div>

      <div class="asmt-done-note">
        💡 제출 후에는 수정할 수 없어요. 다른 친구들도 모두 마치면 선생님이 종합 피드백을 알려주실 거예요.
      </div>
    </div>
  `;
}

// ══════════════════════════════════════
//  선생님 뷰
// ══════════════════════════════════════

function vTcAssessment(){
  if(!TC_CLS) return emptyBox('👆','관리할 반을 먼저 선택하세요.');
  if(ASMT_VIEW === 'student' && ASMT_TC_SEL_SNUM) return vTcAsmtStudent();
  return vTcAsmtManage();
}

// 채점 평가요소 메타 (계획서 기준, 25점)
const ASMT_RUBRIC = [
  {id:'algo',     label:'알고리즘 표현 — 문제 추상화', max:5},
  {id:'dataType', label:'자료형 활용',                  max:5},
  {id:'io',       label:'적절한 입출력 형식 활용',      max:5},
  {id:'control',  label:'다양한 제어 구조 활용',        max:5},
  {id:'result',   label:'다양한 상황에서 올바른 결과', max:5}
];

function _asmtScoreTotal(s){
  if(!s) return null;
  let sum = 0;
  for(const r of ASMT_RUBRIC){
    const v = s[r.id];
    if(typeof v === 'number' && v >= 2 && v <= 5) sum += v;
    else return null; // 한 항목이라도 없으면 미완
  }
  return sum;
}

function vTcAsmtManage(){
  const cid = TC_CLS.id;
  const phase = ASMT_PHASE[cid] || 'off';
  const sessions = ASMT_ALL_SESSIONS || {};
  const scores = ASMT_ALL_SCORES || {};

  // 학생별 진행 단계 요약
  const stuRows = STUDENTS.map(st => {
    const s = sessions[st.number] || null;
    let stageLabel = '-';
    if(s){
      if(s.submittedAt)        stageLabel = '✅ 2차시 제출';
      else if(s.view === 'modify')  stageLabel = '🛠️ 변형 과제 중';
      else if(s.view === 'explain') stageLabel = '✍️ 줄별 설명 중';
      else if(s.prepSubmitted) stageLabel = '📋 1차시 제출';
      else if(s.code)          stageLabel = '💻 코드 작성됨';
      else if(s.messages?.length) stageLabel = '💬 AI 대화 중';
      else stageLabel = '시작 전';
    }
    const turns = s?.turnCount || 0;
    const updatedAt = s?.updatedAt ? fmtDt(s.updatedAt) : '-';
    const sc = scores[st.number];
    const total = _asmtScoreTotal(sc);
    const scoreCell = total != null
      ? `<span class="asmt-score-chip">${total}/25</span>`
      : (sc ? `<span class="asmt-score-chip partial">미완</span>` : `<span class="asmt-score-chip none">-</span>`);
    const canView = !!(s && ((s.messages?.length || 0) > 0 || s.code));
    return `<tr>
      <td>${esc(st.number)}</td>
      <td>${esc(st.name)}</td>
      <td>${stageLabel}</td>
      <td>${turns}/${ASMT_TURN_LIMIT}</td>
      <td>${updatedAt}</td>
      <td>${scoreCell}</td>
      <td><button class="btn-xs" data-action="asmt-tc-view" data-snum="${esc(st.number)}" ${canView ? '' : 'disabled'}>상세</button></td>
    </tr>`;
  }).join('');

  const prepDoneCount = STUDENTS.filter(st => sessions[st.number]?.prepSubmitted).length;
  const evalDoneCount = STUDENTS.filter(st => sessions[st.number]?.submittedAt).length;
  const scoredCount = STUDENTS.filter(st => _asmtScoreTotal(scores[st.number]) != null).length;

  // Phase 토글 (3단계 세그먼트)
  const phaseSeg = `
    <div class="asmt-phase-seg">
      <button class="asmt-phase-btn ${phase==='off'?'on':''}"  data-action="asmt-set-phase" data-phase="off">🔒 비활성</button>
      <button class="asmt-phase-btn ${phase==='prep'?'on prep':''}" data-action="asmt-set-phase" data-phase="prep">1️⃣ 1차시 (코드 만들기)</button>
      <button class="asmt-phase-btn ${phase==='eval'?'on eval':''}" data-action="asmt-set-phase" data-phase="eval">2️⃣ 2차시 (평가)</button>
    </div>`;

  const phaseDesc = ({
    'off':  '<b style="color:var(--text3)">● 비활성</b> — 학생 화면에 메뉴가 보이지 않습니다.',
    'prep': '<b style="color:var(--accent)">● 1차시 진행 중</b> — 학생들이 AI와 코드를 만들고 제출합니다.',
    'eval': '<b style="color:var(--ok)">● 2차시 진행 중</b> — 학생들이 1차시 코드로 줄별 설명·변형 과제를 합니다.'
  })[phase];

  return `
    <div class="asmt-phase-row">
      <div class="asmt-phase-info">
        <div class="asmt-phase-title">📝 수행평가 단계</div>
        <div class="asmt-phase-cur">${phaseDesc}</div>
      </div>
      ${phaseSeg}
    </div>

    <div class="asmt-stat-grid">
      <div class="stat-card"><div class="stat-num">${STUDENTS.length}</div><div class="stat-label">전체 학생</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--accent)">${prepDoneCount}</div><div class="stat-label">1차시 제출</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--ok)">${evalDoneCount}</div><div class="stat-label">2차시 제출</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#a855f7">${scoredCount}</div><div class="stat-label">채점 완료</div></div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-top:14px">
      <div class="sec-title" style="margin:0">학생별 진행 현황</div>
      <button class="btn-sm" data-action="asmt-export-csv" title="학생별 채점·진행 상태를 CSV 파일로 다운로드 (NEIS 입력 등에 활용)">📤 CSV 내보내기</button>
    </div>

    ${STUDENTS.length === 0
      ? emptyBox('👥', '먼저 학생을 등록하세요.')
      : `<div style="overflow-x:auto"><table class="tbl asmt-tc-table">
          <thead><tr><th>학번</th><th>이름</th><th>단계</th><th>대화</th><th>마지막 활동</th><th>점수</th><th></th></tr></thead>
          <tbody>${stuRows}</tbody>
        </table></div>`
    }

    <div class="asmt-tc-help">
      <b>📖 운영 안내 (2차시 구성)</b>
      <ul>
        <li><b>1차시</b>: "1차시" 버튼을 누르면 학생들이 AI와 대화하며 <b>조건문+반복문이 든 코드</b>를 만들고 제출합니다. (조건/반복 없으면 제출 자동 차단)</li>
        <li><b>2차시</b>: "2차시" 버튼을 누르면 학생들이 <b>자기 1차시 코드</b>로 줄별 의미 적기·변형 과제를 합니다. 이 단계부터 AI 채팅은 잠깁니다.</li>
        <li>평가가 끝나면 "비활성"으로 돌려 메뉴를 숨기세요. (저장된 세션·점수는 보존)</li>
        <li>학생당 AI 메시지는 최대 <b>${ASMT_TURN_LIMIT}회</b>.</li>
        <li>"상세"로 학생 답안 전체를 보고 5개 항목(각 5점)으로 채점 → 📤 CSV로 내보내 NEIS에 활용.</li>
      </ul>
    </div>
  `;
}

// ── 선생님: 학생 상세 화면 (한 페이지 세로 스크롤) ──
function vTcAsmtStudent(){
  const snum = ASMT_TC_SEL_SNUM;
  const st = STUDENTS.find(s => s.number === snum);
  const sess = ASMT_ALL_SESSIONS[snum] || {};
  const sc = ASMT_ALL_SCORES[snum] || {};
  if(!st){
    return emptyBox('❓', `학번 ${snum} 학생을 찾을 수 없어요.`);
  }
  const messages = Array.isArray(sess.messages) ? sess.messages : [];
  const code = sess.code || '';
  const answers = sess.answers || {};
  const submittedAt = sess.submittedAt ? fmtDt(sess.submittedAt) : null;
  const totalScore = _asmtScoreTotal(sc);

  // 헤더
  const header = `
    <div class="asmt-tcs-header">
      <button class="btn-sm" data-action="asmt-tc-back">← 학생 목록</button>
      <div class="asmt-tcs-stu-info">
        <span class="asmt-tcs-snum">${esc(st.number)}</span>
        <span class="asmt-tcs-name">${esc(st.name)}</span>
        ${submittedAt
          ? `<span class="chip chip-green">✓ 제출 ${submittedAt}</span>`
          : `<span class="chip chip-orange">진행 중 — ${esc(sess.view || '시작 전')}</span>`}
        ${totalScore != null ? `<span class="asmt-score-chip">${totalScore}/25</span>` : ''}
      </div>
      <button class="btn-sm" onclick="window.print()" title="브라우저 인쇄 → PDF로 저장 가능">🖨️ 인쇄</button>
    </div>
  `;

  // ① AI 대화 로그
  const dialogSec = messages.length ? `
    <section class="asmt-tcs-sec">
      <div class="asmt-tcs-sec-head">💬 1단계 — AI 대화 (${messages.length}개 메시지)</div>
      <div class="asmt-tcs-msgs">
        ${messages.map(m => {
          const cls = m.role === 'user' ? 'user' : 'ai';
          const label = m.role === 'user' ? `👤 ${esc(st.name)}` : '🤖 AI';
          const body = m.role === 'user'
            ? esc(m.content).replace(/\n/g, '<br>')
            : (typeof marked !== 'undefined' ? marked.parse(m.content) : esc(m.content).replace(/\n/g, '<br>'));
          return `<div class="asmt-tcs-msg ${cls}">
            <div class="asmt-tcs-msg-label">${label}</div>
            <div class="asmt-tcs-msg-body">${body}</div>
          </div>`;
        }).join('')}
      </div>
    </section>` : `
    <section class="asmt-tcs-sec">
      <div class="asmt-tcs-sec-head">💬 1단계 — AI 대화</div>
      ${emptyBox('💬','학생이 아직 AI와 대화를 시작하지 않았어요.')}
    </section>`;

  // ② 1차시 코드
  const codeSec = code ? `
    <section class="asmt-tcs-sec">
      <div class="asmt-tcs-sec-head">💻 1차시 — AI와 만든 코드</div>
      <pre class="asmt-tcs-code-pre">${esc(code)}</pre>
    </section>` : '';

  // ③ 2차시 서술형 5문항 답 (채점 기준 매핑 표시)
  const QMAP = (typeof ASMT_QUESTIONS !== 'undefined') ? ASMT_QUESTIONS : [];
  const answerSec = `
    <section class="asmt-tcs-sec">
      <div class="asmt-tcs-sec-head">✍️ 2차시 — 코드 설명 (서술형 5문항)</div>
      ${QMAP.map((q, i) => {
        const a = (answers[q.id] || '').trim();
        return `<div class="asmt-tcs-ans">
          <div class="asmt-tcs-ans-q">
            <span>${q.icon} ${i+1}. ${esc(q.q)}</span>
            <span class="asmt-tcs-ans-rubric">→ ${esc(q.rubric)}</span>
          </div>
          <div class="asmt-tcs-ans-body ${a ? '' : 'empty'}">${a ? esc(a).replace(/\n/g,'<br>') : '<i>(답하지 않음)</i>'}</div>
        </div>`;
      }).join('')}
    </section>`;

  // ⑥ 채점 입력
  const rubricRows = ASMT_RUBRIC.map(r => {
    const cur = sc[r.id];
    const opts = [5,4,3,2].map(v => `
      <label class="asmt-tcs-score-opt ${cur === v ? 'on' : ''}">
        <input type="radio" name="asmt-score-${r.id}" value="${v}" ${cur === v ? 'checked' : ''} data-action="asmt-score-input" data-rid="${r.id}"/>
        <span class="asmt-tcs-score-val">${v}점</span>
      </label>
    `).join('');
    return `<tr>
      <td>${esc(r.label)}</td>
      <td><div class="asmt-tcs-score-opts">${opts}</div></td>
    </tr>`;
  }).join('');

  const scoreSec = `
    <section class="asmt-tcs-sec asmt-tcs-score-sec">
      <div class="asmt-tcs-sec-head">⭐ 채점 (25점 만점) ${totalScore != null ? `<span class="asmt-score-chip">${totalScore}/25</span>` : ''}</div>
      <table class="asmt-tcs-score-table">
        <thead><tr><th>평가요소</th><th>점수</th></tr></thead>
        <tbody>${rubricRows}</tbody>
      </table>
      <div class="asmt-tcs-score-comment">
        <label>종합 코멘트 (선택 — 세특 작성 시 참고)</label>
        <textarea
          class="asmt-tcs-comment-area"
          data-action="asmt-score-comment"
          placeholder="학생의 강점·약점·향후 지도 방향 등"
        >${esc(sc.comment || '')}</textarea>
      </div>
      <div class="asmt-tcs-score-meta">
        ${sc.scoredAt ? `💾 마지막 저장: ${fmtDt(sc.scoredAt)}` : '아직 저장된 점수가 없습니다.'}
      </div>
    </section>
  `;

  return `<div class="asmt-tcs-wrap">
    ${header}
    ${codeSec}
    ${answerSec}
    ${dialogSec}
    ${scoreSec}
  </div>`;
}
