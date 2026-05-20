/* ═══════════════════════════════════════
   views/aicode.js — 🤖 AI 코딩 (자유 실습 메뉴)

   학생이 진로/관심사 관련 Python 프로그램을 AI(Gemini)와 대화하며
   만들어보는 자유 실습 메뉴. 수행평가와 분리된 독립 기능.

   - 선생님이 on/off 토글로 노출 제어 (aicode/active/{cid})
   - 학생별 세션 저장 → 로그아웃·새로고침 후 이어하기 (aicode/sessions/{cid}/{학번})
   - 백엔드: Cloudflare Worker (AIC_WORKER_URL) → Gemini 2.5 Flash
   - 평가가 아니므로 제출·채점 없음. 코드 직접 실행(▶)만 지원.
═══════════════════════════════════════ */

// ══════════════════════════════════════
//  학생 뷰
// ══════════════════════════════════════

// 탭 진입 시 세션 상태로 첫 화면 결정
function _aicInitialStudentView(sess){
  if(sess && Array.isArray(sess.messages) && sess.messages.length) return 'chat';
  return 'entry';
}

function vStAiCode(){
  const active = SEL_CLS ? AIC_ACTIVE[SEL_CLS.id] : false;
  if(!active) return emptyBox('🔒', 'AI 코딩 메뉴가 아직 열려있지 않아요. 선생님 안내를 기다려주세요.');

  if(AIC_VIEW === 'examples') return vStAicExamples();
  if(AIC_VIEW === 'chat')     return vStAicChat();
  return vStAicEntry();
}

function vStAicEntry(){
  const hasSession = AIC_MESSAGES.length > 0 || AIC_CODE;
  const resumeBanner = hasSession ? `
    <div class="asmt-resume-banner">
      <span>📌 이전에 만들던 프로그램이 있어요</span>
      <button class="btn-p btn-sm" data-action="aic-resume">이어서 하기</button>
    </div>` : '';

  return `
    <div class="asmt-entry-wrap">
      ${resumeBanner}
      <div class="asmt-hero">
        <div class="asmt-hero-title">🤖 AI와 함께 만드는 나만의 프로그램</div>
        <div class="asmt-hero-sub">
          진로나 관심사와 관련된 작은 Python 프로그램을<br>
          AI와 대화하며 자유롭게 만들어보는 공간이에요.
        </div>
      </div>

      <div class="asmt-cards-title">시작 방법을 골라주세요</div>
      <div class="asmt-cards">
        <button class="asmt-card asmt-card-a" data-action="aic-start-mode" data-mode="have-idea">
          <div class="asmt-card-icon">💡</div>
          <div class="asmt-card-title">아이디어가 있어요</div>
          <div class="asmt-card-desc">만들고 싶은 프로그램이 떠올랐어요.<br>바로 AI에게 부탁할게요.</div>
        </button>

        <button class="asmt-card asmt-card-b" data-action="aic-start-mode" data-mode="need-help">
          <div class="asmt-card-icon">🤔</div>
          <div class="asmt-card-title">아직 모르겠어요</div>
          <div class="asmt-card-desc">AI가 질문을 던지면서<br>아이디어 찾는 걸 도와줘요.</div>
        </button>

        <button class="asmt-card asmt-card-c" data-action="aic-start-mode" data-mode="examples">
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

// ── 학생: 예시 보기 ──
function vStAicExamples(){
  const back = `<div class="asmt-sub-header">
    <button class="btn-sm" data-action="aic-back-entry">← 처음으로</button>
    <div class="asmt-sub-title">${AIC_EXAMPLES_CAT ? '예시 프로그램 선택' : '진로 카테고리 선택'}</div>
    <div></div>
  </div>`;

  if(!AIC_EXAMPLES_CAT){
    const cards = AIC_CATEGORIES.map(c => `
      <button class="asmt-cat-card" data-action="aic-pick-cat" data-cat="${esc(c.id)}">
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

  const cat = AIC_CATEGORIES.find(c => c.id === AIC_EXAMPLES_CAT);
  if(!cat){ AIC_EXAMPLES_CAT = null; return back; }
  const items = cat.examples.map((ex, i) => `
    <button class="asmt-example-row" data-action="aic-pick-example" data-idx="${i}">
      <span class="asmt-example-num">${i + 1}</span>
      <span class="asmt-example-text">${esc(ex)}</span>
      <span class="asmt-example-arrow">→</span>
    </button>
  `).join('');
  return `<div class="asmt-sub-header">
      <button class="btn-sm" data-action="aic-back-cats">← 카테고리</button>
      <div class="asmt-sub-title">${cat.emoji} ${esc(cat.label)} — 예시 프로그램</div>
      <div></div>
    </div>
    <div class="asmt-example-list">${items}</div>
    <div class="asmt-entry-note">📌 예시를 클릭하면 AI에게 "이 프로그램을 만들어주세요" 라고 자동으로 요청해요. 채팅에서 더 다듬을 수 있어요.</div>
  `;
}

// ── 학생: 채팅 화면 (좌 채팅 / 우 코드 패널 + 실행) ──
function vStAicChat(){
  const turnLeft = Math.max(0, AIC_TURN_LIMIT - AIC_TURN_COUNT);
  const isLimit = turnLeft <= 0;

  const messages = AIC_MESSAGES.map(m => {
    if(m.role === 'user'){
      return `<div class="asmt-msg asmt-msg-user">
        <div class="asmt-msg-bubble">${esc(m.content)}</div>
      </div>`;
    }
    const rendered = _renderAicAssistant(m.content);
    return `<div class="asmt-msg asmt-msg-ai">
      <div class="asmt-msg-avatar">🤖</div>
      <div class="asmt-msg-bubble">${rendered}</div>
    </div>`;
  }).join('');

  const loadingBubble = AIC_LOADING ? `
    <div class="asmt-msg asmt-msg-ai">
      <div class="asmt-msg-avatar">🤖</div>
      <div class="asmt-msg-bubble asmt-msg-loading">
        <span></span><span></span><span></span>
      </div>
    </div>` : '';

  // 실행 결과 블록
  let runBlock = '';
  if(AIC_RUNNING){
    runBlock = `<div class="asmt-mod-run-loading">⏳ 실행 중... (첫 실행은 10~15초 걸려요)</div>`;
  } else if(AIC_RUN_RESULT){
    const r = AIC_RUN_RESULT;
    runBlock = `<div class="asmt-mod-run-result ${r.success ? 'ok' : 'err'}">
      <div class="asmt-mod-run-head">${r.success ? '✅ 실행 결과' : '⚠️ 실행 오류'}</div>
      ${r.output ? `<pre class="asmt-mod-run-out">${esc(r.output)}</pre>` : ''}
      ${r.error ? `<pre class="asmt-mod-run-err">${esc(r.error)}</pre>` : ''}
    </div>`;
  }

  const codePanel = AIC_CODE
    ? `<div class="asmt-code-head">
         <span>💻 AI가 만든 코드 (${AIC_CODE.split('\n').length}줄)</span>
         <button class="btn-sm" data-action="aic-copy-code">📋 복사</button>
       </div>
       <pre class="asmt-code-body"><code>${esc(AIC_CODE)}</code></pre>
       <div class="aic-run-box">
         <div class="asmt-q-run-row">
           <input type="text" class="aic-run-stdin" data-action="aic-run-stdin" value="${esc(AIC_RUN_STDIN)}" placeholder="실행에 쓸 입력값 (input이 여러 개면 쉼표로: 3,5)" autocomplete="off"/>
           <button class="btn-p btn-sm" data-action="aic-run" ${AIC_RUNNING ? 'disabled' : ''}>${AIC_RUNNING ? '⏳' : '▶ 실행'}</button>
         </div>
         ${runBlock}
       </div>`
    : `<div class="asmt-code-empty">
         <div class="asmt-code-empty-icon">💻</div>
         <div class="asmt-code-empty-msg">AI에게 만들고 싶은 프로그램을 설명해주세요.<br>코드가 만들어지면 여기에 표시돼요.</div>
       </div>`;

  const inputDisabled = AIC_LOADING || isLimit;
  const placeholder = isLimit
    ? `대화 한도(${AIC_TURN_LIMIT}회)를 모두 사용했어요. "새로 시작"으로 다시 만들 수 있어요.`
    : AIC_LOADING
      ? 'AI가 답변 중이에요...'
      : (AIC_MESSAGES.length === 0
          ? '어떤 프로그램을 만들어볼까요? (예: 학생 점수 평균을 구하는 프로그램)'
          : '메시지를 입력하세요... (Enter로 전송, Shift+Enter 줄바꿈)');

  return `
    <div class="asmt-chat-wrap">
      <div class="asmt-chat-bar">
        <button class="btn-sm" data-action="aic-back-entry">← 처음으로</button>
        <div class="asmt-chat-bar-stats">
          <span class="asmt-turn-chip${turnLeft <= 5 ? ' warn' : ''}">대화 ${AIC_TURN_COUNT}/${AIC_TURN_LIMIT}</span>
          <button class="btn-sm" data-action="aic-restart" title="대화와 코드를 모두 지우고 새 프로그램을 만들어요">🔄 새로 시작</button>
        </div>
      </div>

      <div class="asmt-chat-split">
        <div class="asmt-chat-left">
          <div class="asmt-msg-list" id="aic-msg-list">
            ${messages || '<div class="asmt-msg-empty">AI에게 첫 메시지를 보내보세요 👇</div>'}
            ${loadingBubble}
          </div>
          <div class="asmt-input-row">
            <textarea
              id="aic-input"
              class="asmt-input"
              rows="2"
              placeholder="${esc(placeholder)}"
              ${inputDisabled ? 'disabled' : ''}
            ></textarea>
            <button class="btn-p asmt-send-btn" data-action="aic-send" ${inputDisabled ? 'disabled' : ''}>전송</button>
          </div>
        </div>

        <div class="asmt-chat-right">${codePanel}</div>
      </div>
    </div>
  `;
}

// AI 응답 텍스트에서 코드 펜스 제거 + 마크다운 렌더
function _renderAicAssistant(text){
  if(!text) return '';
  const stripped = text.replace(/```[\w-]*\n[\s\S]*?```/g, '*(코드는 오른쪽 패널을 확인해주세요 →)*');
  if(typeof marked !== 'undefined'){
    return marked.parse(stripped);
  }
  return esc(stripped).replace(/\n/g, '<br>');
}

// AI 응답에서 첫 번째 python 코드 블록 추출 (자유 실습이라 주석은 보존)
function _extractAicCode(text){
  if(!text) return null;
  const m = text.match(/```(?:python|py)?\n([\s\S]*?)```/);
  if(!m) return null;
  return m[1].replace(/\n$/, '');
}

// ══════════════════════════════════════
//  선생님 뷰
// ══════════════════════════════════════

function vTcAiCode(){
  if(!TC_CLS) return emptyBox('👆','관리할 반을 먼저 선택하세요.');
  if(AIC_VIEW === 'student' && AIC_TC_SEL_SNUM) return vTcAicStudent();
  return vTcAicManage();
}

function vTcAicManage(){
  const cid = TC_CLS.id;
  const active = !!AIC_ACTIVE[cid];
  const sessions = AIC_ALL_SESSIONS || {};

  const usedCount = STUDENTS.filter(st => {
    const s = sessions[st.number];
    return s && ((s.messages?.length || 0) > 0 || s.code);
  }).length;

  const toggle = `
    <div class="asmt-phase-seg">
      <button class="asmt-phase-btn ${!active ? 'on' : ''}" data-action="aic-set-active" data-on="0">🔒 닫기</button>
      <button class="asmt-phase-btn ${active ? 'on prep' : ''}" data-action="aic-set-active" data-on="1">🤖 열기</button>
    </div>`;

  const stuRows = STUDENTS.map(st => {
    const s = sessions[st.number] || null;
    const turns = s?.turnCount || 0;
    const hasCode = !!(s && s.code);
    const updatedAt = s?.updatedAt ? fmtDt(s.updatedAt) : '-';
    const canView = !!(s && ((s.messages?.length || 0) > 0 || s.code));
    return `<tr>
      <td>${esc(st.number)}</td>
      <td>${esc(st.name)}</td>
      <td>${turns}/${AIC_TURN_LIMIT}</td>
      <td>${hasCode ? '✅' : '-'}</td>
      <td>${updatedAt}</td>
      <td><button class="btn-xs" data-action="aic-tc-view" data-snum="${esc(st.number)}" ${canView ? '' : 'disabled'}>보기</button></td>
    </tr>`;
  }).join('');

  return `
    <div class="asmt-phase-row">
      <div class="asmt-phase-info">
        <div class="asmt-phase-title">🤖 AI 코딩 메뉴</div>
        <div class="asmt-phase-cur">${active
          ? '<b style="color:var(--accent)">● 열림</b> — 학생 화면에 "🤖 AI 코딩" 탭이 보이고 자유롭게 AI와 코드를 만들 수 있어요.'
          : '<b style="color:var(--text3)">● 닫힘</b> — 학생 화면에 메뉴가 보이지 않습니다. (저장된 작업은 보존)'}</div>
      </div>
      ${toggle}
    </div>

    <div class="asmt-stat-grid">
      <div class="stat-card"><div class="stat-num">${STUDENTS.length}</div><div class="stat-label">전체 학생</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--accent)">${usedCount}</div><div class="stat-label">사용한 학생</div></div>
    </div>

    <div class="sec-title" style="margin-top:14px">학생별 사용 현황</div>
    ${STUDENTS.length === 0
      ? emptyBox('👥', '먼저 학생을 등록하세요.')
      : `<div style="overflow-x:auto"><table class="tbl asmt-tc-table">
          <thead><tr><th>학번</th><th>이름</th><th>대화</th><th>코드</th><th>마지막 활동</th><th></th></tr></thead>
          <tbody>${stuRows}</tbody>
        </table></div>`
    }

    <div class="asmt-tc-help">
      <b>📖 안내</b>
      <ul>
        <li>"🤖 열기"를 누르면 학생 화면에 <b>AI 코딩 탭</b>이 나타나고, AI와 대화하며 자유롭게 프로그램을 만들 수 있어요.</li>
        <li>학생 작업은 자동 저장되어 다음 시간에 <b>이어서</b> 할 수 있습니다.</li>
        <li>"보기"로 학생이 AI와 나눈 대화와 만든 코드를 확인할 수 있어요.</li>
        <li>학생당 AI 메시지는 최대 <b>${AIC_TURN_LIMIT}회</b>입니다.</li>
      </ul>
    </div>
  `;
}

// ── 선생님: 학생 상세 (대화 + 코드, 읽기 전용) ──
function vTcAicStudent(){
  const snum = AIC_TC_SEL_SNUM;
  const st = STUDENTS.find(s => s.number === snum);
  const sess = AIC_ALL_SESSIONS[snum] || {};
  if(!st) return emptyBox('❓', `학번 ${snum} 학생을 찾을 수 없어요.`);

  const messages = Array.isArray(sess.messages) ? sess.messages : [];
  const code = sess.code || '';

  const header = `
    <div class="asmt-tcs-header">
      <button class="btn-sm" data-action="aic-tc-back">← 학생 목록</button>
      <div class="asmt-tcs-stu-info">
        <span class="asmt-tcs-snum">${esc(st.number)}</span>
        <span class="asmt-tcs-name">${esc(st.name)}</span>
        <span class="chip">대화 ${sess.turnCount || 0}회</span>
      </div>
      <div></div>
    </div>
  `;

  const codeSec = code ? `
    <section class="asmt-tcs-sec">
      <div class="asmt-tcs-sec-head">💻 AI와 만든 코드</div>
      <pre class="asmt-tcs-code-pre">${esc(code)}</pre>
    </section>` : '';

  const dialogSec = messages.length ? `
    <section class="asmt-tcs-sec">
      <div class="asmt-tcs-sec-head">💬 AI 대화 (${messages.length}개 메시지)</div>
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
    </section>` : emptyBox('💬','아직 AI와 대화를 시작하지 않았어요.');

  return `<div class="asmt-tcs-wrap">
    ${header}
    ${codeSec}
    ${dialogSec}
  </div>`;
}
