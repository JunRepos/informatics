/* ═══════════════════════════════════════
   events/assessment.js — 수행평가 이벤트 핸들러

   학생 흐름:
     entry → (카드 클릭) → chat 모드
       - 💡 아이디어 있어요  → 빈 채팅 (학생이 먼저 입력)
       - 🤔 모르겠어요       → AI가 먼저 인사
       - 📚 예시 보기         → 카테고리 → 예시 선택 → 채팅 시작
     entry 3분 무동작        → AI가 먼저 인사 (= 모르겠어요와 동일)

   선생님:
     수행평가 탭에서 활성화 토글 + 학생 진행 현황 표
═══════════════════════════════════════ */

// ── 진입 3분 자동 인사 타이머 ──
function _startAsmtEntryTimer(){
  _clearAsmtEntryTimer();
  ASMT_AUTO_TIMER = setTimeout(() => {
    if(ASMT_VIEW === 'entry' && ST_TAB === 'asmt'){
      _enterAsmtChat('need-help');
    }
  }, 3 * 60 * 1000); // 3분
}

function _clearAsmtEntryTimer(){
  if(ASMT_AUTO_TIMER){
    clearTimeout(ASMT_AUTO_TIMER);
    ASMT_AUTO_TIMER = null;
  }
}

// ── 채팅 모드로 진입 ──
//   mode: 'have-idea' | 'need-help' | { preset: '... 자동 입력 메시지 ...' }
async function _enterAsmtChat(mode){
  _clearAsmtEntryTimer();
  ASMT_VIEW = 'chat';
  ASMT_MESSAGES = [];
  ASMT_CODE = '';
  ASMT_TURN_COUNT = 0;
  ASMT_LINE_EXPLAINS = {};
  ASMT_LOADING = false;
  render();

  if(mode === 'have-idea'){
    // 학생이 먼저 입력. 별도 동작 없음.
    return;
  }

  // need-help 또는 preset 메시지 → 학생 메시지 또는 AI 인사 자동 시작
  if(mode && typeof mode === 'object' && mode.preset){
    // 학생 시뮬레이션 메시지 + AI 응답
    await _sendAsmtMessage(mode.preset);
    return;
  }

  if(mode === 'need-help'){
    // AI가 먼저 인사 — 사용자 메시지 없이 호출
    // Gemini는 사용자 메시지가 있어야 응답하므로 "(시작)" 같은 트리거 메시지 자동 추가
    await _sendAsmtMessage('(학생이 아직 어떤 프로그램을 만들지 정하지 못했습니다. 인사하고 진로/관심사를 물어 아이디어 찾기를 도와주세요.)');
    return;
  }
}

// ── 학생 메시지 전송 + AI 응답 받기 ──
async function _sendAsmtMessage(userText){
  if(!userText || !userText.trim()) return;
  if(ASMT_LOADING) return;
  if(ASMT_TURN_COUNT >= ASMT_TURN_LIMIT){
    toast(`대화 한도 ${ASMT_TURN_LIMIT}회를 모두 사용했어요.`, 'err');
    return;
  }

  // 사용자 메시지 추가
  ASMT_MESSAGES.push({
    role: 'user',
    content: userText.trim(),
    ts: Date.now()
  });
  ASMT_TURN_COUNT += 1;
  ASMT_LOADING = true;
  render();
  _scrollMsgListToBottom();

  try {
    // 워커 호출 — 시스템 프롬프트는 서버에 박혀있음
    const r = await fetch(ASMT_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: ASMT_MESSAGES.map(m => ({ role: m.role, content: m.content }))
      })
    });
    if(!r.ok){
      const errText = await r.text().catch(() => '');
      throw new Error(`서버 응답 오류 (${r.status}): ${errText.slice(0, 200)}`);
    }
    const data = await r.json();
    if(data.error){
      throw new Error(data.error);
    }
    const aiText = data.text || '';

    // AI 메시지 추가
    ASMT_MESSAGES.push({
      role: 'assistant',
      content: aiText,
      ts: Date.now()
    });

    // 코드 블록 추출 → 우측 패널에 반영
    const code = _extractAsmtCode(aiText);
    if(code){
      ASMT_CODE = code;
    }

    ASMT_LOADING = false;
    render();
    _scrollMsgListToBottom();
    _saveAsmtSession();
  } catch(e){
    ASMT_LOADING = false;
    // 실패한 학생 메시지는 그대로 둠 (다시 시도 가능)
    ASMT_MESSAGES.push({
      role: 'assistant',
      content: `(⚠️ AI 응답 중 오류가 발생했어요: ${e.message}\n\n잠시 후 다시 시도해 주세요.)`,
      ts: Date.now(),
      isError: true
    });
    render();
    _scrollMsgListToBottom();
  }
}

// ── 세션 저장 (debounce 1초) ──
function _saveAsmtSession(){
  if(!SEL_CLS || !ST_USER) return;
  if(ASMT_SAVE_TIMER) clearTimeout(ASMT_SAVE_TIMER);
  ASMT_SAVE_TIMER = setTimeout(async () => {
    try {
      const payload = {
        messages: ASMT_MESSAGES,
        code: ASMT_CODE,
        turnCount: ASMT_TURN_COUNT,
        lineExplains: ASMT_LINE_EXPLAINS,
        view: ASMT_VIEW,
        modCode: ASMT_MOD_CODE || null,
        modReason: ASMT_MOD_REASON || null,
        modStdin: ASMT_MOD_STDIN || null,
        submittedAt: ASMT_SUBMITTED_AT || null
      };
      // null 값은 Firebase 에서 자동 제거됨
      await saveAsmtSession(SEL_CLS.id, ST_USER.number, payload);
    } catch(err){
      console.warn('[수행평가] 세션 저장 실패:', err);
    }
  }, 1000);
}

// ── Pyodide 워커 (변형 과제 실행) ──
let _asmtWorker = null;

function _ensureAsmtWorker(){
  if(_asmtWorker) return _asmtWorker;
  _asmtWorker = new Worker('js/asmt-worker.js?v=20260519');
  return _asmtWorker;
}

function _runAsmtCode(code, stdin){
  return new Promise((resolve) => {
    const w = _ensureAsmtWorker();
    const onMsg = (e) => {
      if(e.data?.type === 'result'){
        w.removeEventListener('message', onMsg);
        resolve(e.data);
      }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ type: 'run', code, stdin });
  });
}

// 메시지 영역 스크롤 하단으로
function _scrollMsgListToBottom(){
  setTimeout(() => {
    const el = document.getElementById('asmt-msg-list');
    if(el) el.scrollTop = el.scrollHeight;
  }, 30);
}

// ── 클릭 이벤트 ──
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // 학생: 진입 카드 클릭
  if(act.action === 'asmt-start-mode'){
    const mode = act.mode;
    if(mode === 'examples'){
      _clearAsmtEntryTimer();
      ASMT_VIEW = 'examples';
      ASMT_EXAMPLES_CAT = null;
      render();
      return;
    }
    await _enterAsmtChat(mode); // 'have-idea' or 'need-help'
    return;
  }

  // 학생: 이전 세션 이어가기
  if(act.action === 'asmt-resume'){
    _clearAsmtEntryTimer();
    ASMT_VIEW = ASMT_MESSAGES.length ? 'chat' : 'entry';
    render();
    if(ASMT_VIEW === 'chat') _scrollMsgListToBottom();
    return;
  }

  // 학생: 진입 화면으로 돌아가기 (대화는 보존)
  if(act.action === 'asmt-back-entry'){
    _clearAsmtEntryTimer();
    ASMT_VIEW = 'entry';
    ASMT_EXAMPLES_CAT = null;
    render();
    return;
  }

  // 학생: 카테고리 선택
  if(act.action === 'asmt-pick-cat'){
    ASMT_EXAMPLES_CAT = act.cat || null;
    render();
    return;
  }
  if(act.action === 'asmt-back-cats'){
    ASMT_EXAMPLES_CAT = null;
    render();
    return;
  }

  // 학생: 예시 클릭 → 채팅 시작 (자동 입력)
  if(act.action === 'asmt-pick-example'){
    const cat = ASMT_CATEGORIES.find(c => c.id === ASMT_EXAMPLES_CAT);
    const ex = cat?.examples[parseInt(act.idx)];
    if(!ex) return;
    await _enterAsmtChat({preset: `${ex} 를 만들어주세요.`});
    return;
  }

  // 학생: 메시지 전송
  if(act.action === 'asmt-send'){
    const input = document.getElementById('asmt-input');
    const text = input?.value || '';
    if(!text.trim()) return;
    if(input) input.value = '';
    await _sendAsmtMessage(text);
    return;
  }

  // 학생: "이 코드로 진행" → 줄별 설명 모드 진입 (채팅 잠금)
  if(act.action === 'asmt-proceed-explain'){
    if(!ASMT_CODE){ toast('아직 코드가 없어요.', 'err'); return; }
    if(!confirm('이 코드로 진행할까요?\n\n진행 후에는 AI와 더 이상 대화할 수 없어요. 코드를 더 다듬고 싶다면 "취소"를 눌러주세요.')) return;
    ASMT_VIEW = 'explain';
    ASMT_LINE_EXPLAINS = ASMT_LINE_EXPLAINS || {};
    render();
    _saveAsmtSession();
    return;
  }

  // 학생: 줄별 설명 → 변형 과제 진입
  if(act.action === 'asmt-proceed-modify'){
    const meaningful = _asmtMeaningfulLines(ASMT_CODE);
    const done = meaningful.filter(i => (ASMT_LINE_EXPLAINS[i] || '').trim()).length;
    if(done < meaningful.length){
      toast(`아직 ${meaningful.length - done}줄이 비어 있어요.`, 'err');
      return;
    }
    ASMT_VIEW = 'modify';
    ASMT_MOD_CODE = ASMT_MOD_CODE || ASMT_CODE; // 첫 진입 시 원본 코드를 초깃값으로
    ASMT_RUN_RESULT = null;
    render();
    _saveAsmtSession();
    return;
  }

  // 학생: 변형 코드 실행
  if(act.action === 'asmt-run-mod'){
    if(ASMT_RUNNING) return;
    const code = document.getElementById('asmt-mod-code')?.value || '';
    const stdin = document.getElementById('asmt-mod-stdin')?.value || '';
    if(!code.trim()){ toast('실행할 코드가 비어 있어요.', 'err'); return; }
    ASMT_MOD_CODE = code;
    ASMT_MOD_STDIN = stdin;
    ASMT_RUNNING = true;
    ASMT_RUN_RESULT = null;
    render();
    const result = await _runAsmtCode(code, stdin);
    ASMT_RUNNING = false;
    ASMT_RUN_RESULT = result;
    render();
    _saveAsmtSession();
    return;
  }

  // 학생: 변형 코드 원본으로 되돌리기
  if(act.action === 'asmt-reset-mod'){
    if(!confirm('수정한 코드를 모두 지우고 원본으로 되돌릴까요?')) return;
    ASMT_MOD_CODE = ASMT_CODE;
    ASMT_RUN_RESULT = null;
    render();
    _saveAsmtSession();
    return;
  }

  // 학생: 최종 제출
  if(act.action === 'asmt-submit-final'){
    const code = document.getElementById('asmt-mod-code')?.value || ASMT_MOD_CODE || '';
    const reason = document.getElementById('asmt-mod-reason')?.value || ASMT_MOD_REASON || '';
    if(code.trim() === (ASMT_CODE || '').trim()){
      toast('원본 코드와 다르게 수정한 부분이 없어요.', 'err'); return;
    }
    if(reason.trim().length < 10){
      toast('변경 이유를 10자 이상 적어주세요.', 'err'); return;
    }
    if(!confirm('제출하시겠어요?\n제출 후에는 수정할 수 없어요.')) return;
    ASMT_MOD_CODE = code;
    ASMT_MOD_REASON = reason;
    ASMT_VIEW = 'done';
    ASMT_SUBMITTED_AT = new Date().toISOString();
    render();
    _saveAsmtSession();
    toast('제출 완료! 수고하셨어요 🎉', 'ok');
    return;
  }

  // 선생님: 학생 상세 보기 (다음 commit)
  if(act.action === 'asmt-tc-view'){
    toast('학생 상세 화면은 다음 업데이트에서 추가돼요.', 'ok');
    return;
  }
});

// ── change 이벤트: 활성화 토글 ──
document.addEventListener('change', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;

  if(act.action === 'asmt-toggle-active'){
    const cid = TC_CLS?.id;
    if(!cid){ toast('반을 먼저 선택하세요.', 'err'); return; }
    const checked = el.checked;
    el.disabled = true;
    try {
      await setAsmtActive(cid, checked);
      toast(checked
        ? `✓ 수행평가가 활성화됐어요. 학생 화면에 메뉴가 표시됩니다.`
        : `수행평가가 비활성화됐어요. (저장된 학생 세션은 그대로 유지)`,
        'ok');
      render();
    } catch(err){
      toast('변경 실패: ' + (err.message || err), 'err');
      el.checked = !checked;
    } finally {
      el.disabled = false;
    }
    return;
  }
});

// ── 키보드: Enter 전송 ──
document.addEventListener('keydown', e => {
  if(e.target?.id !== 'asmt-input') return;
  if(e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();
  const text = e.target.value || '';
  if(!text.trim()) return;
  e.target.value = '';
  _sendAsmtMessage(text);
});

// ── 줄별 설명 입력 — 실시간 저장 (debounce) + 진행률 갱신 ──
let _asmtLineProgressTimer = null;
document.addEventListener('input', e => {
  const t = e.target;
  if(!t || !t.dataset) return;
  const a = t.dataset.action;

  // 줄별 설명 입력
  if(a === 'asmt-line-input'){
    const idx = parseInt(t.dataset.idx);
    const v = t.value || '';
    ASMT_LINE_EXPLAINS[idx] = v;
    if(v.trim()){ t.classList.add('filled'); } else { t.classList.remove('filled'); }
    _updateAsmtExplainProgress();
    _saveAsmtSession();
    return;
  }

  // 변형 과제 — 코드 입력
  if(a === 'asmt-mod-code-input'){
    ASMT_MOD_CODE = t.value || '';
    _updateAsmtModButtons();
    _saveAsmtSession();
    return;
  }

  // 변형 과제 — stdin 입력
  if(a === 'asmt-mod-stdin-input'){
    ASMT_MOD_STDIN = t.value || '';
    _saveAsmtSession();
    return;
  }

  // 변형 과제 — 변경 이유 입력
  if(a === 'asmt-mod-reason-input'){
    ASMT_MOD_REASON = t.value || '';
    _updateAsmtModButtons();
    // 글자 수 카운트 즉시 갱신
    const cntEl = document.querySelector('.asmt-mod-reason-count');
    if(cntEl) cntEl.textContent = `${(ASMT_MOD_REASON||'').trim().length} / 최소 10자`;
    _saveAsmtSession();
    return;
  }
});

// 변형 과제 화면 — 제출 버튼/변경됨 표시 갱신 (포커스 보존)
function _updateAsmtModButtons(){
  if(ASMT_VIEW !== 'modify') return;
  const codeDiff = (ASMT_MOD_CODE || '') !== (ASMT_CODE || '');
  const reasonFilled = (ASMT_MOD_REASON || '').trim().length >= 10;
  const canSubmit = codeDiff && reasonFilled;
  const btn = document.querySelector('[data-action="asmt-submit-final"]');
  if(btn){
    btn.disabled = !canSubmit;
    btn.textContent = canSubmit ? '✓ 제출' : (codeDiff ? '변경 이유를 적어주세요' : '코드를 수정해주세요');
  }
  // "변경됨" 칩 토글
  const head = document.querySelector('.asmt-mod-edit-head');
  if(head){
    const chip = head.querySelector('.asmt-mod-changed');
    if(codeDiff && !chip){
      const span = document.createElement('span');
      span.className = 'asmt-mod-changed';
      span.textContent = '변경됨';
      head.appendChild(span);
    } else if(!codeDiff && chip){
      chip.remove();
    }
  }
}

function _updateAsmtExplainProgress(){
  if(ASMT_VIEW !== 'explain') return;
  const meaningful = _asmtMeaningfulLines(ASMT_CODE);
  const total = meaningful.length;
  const done = meaningful.filter(i => (ASMT_LINE_EXPLAINS[i] || '').trim()).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const countEl = document.querySelector('.asmt-explain-count');
  const fillEl = document.querySelector('.asmt-explain-bar-fill');
  if(countEl) countEl.textContent = `${done} / ${total} 줄 완료`;
  if(fillEl) fillEl.style.width = pct + '%';
  // 다음 버튼 활성화
  const nextBtn = document.querySelector('[data-action="asmt-proceed-modify"]');
  if(nextBtn){
    const allDone = done >= total && total > 0;
    nextBtn.disabled = !allDone;
    nextBtn.textContent = allDone ? '다음: 변형 과제 →' : `${total - done}줄 더 채우기`;
  }
}

// ── render 후 처리: 채팅 모드에서 스크롤·포커스 + 진입 화면 타이머 ──
function afterRenderAssessment(){
  if(ST_TAB !== 'asmt') {
    _clearAsmtEntryTimer();
    return;
  }
  if(ASMT_VIEW === 'entry'){
    _startAsmtEntryTimer();
  } else if(ASMT_VIEW === 'chat'){
    _scrollMsgListToBottom();
    // 입력창 자동 포커스
    setTimeout(() => {
      const inp = document.getElementById('asmt-input');
      if(inp && !inp.disabled) inp.focus();
    }, 50);
  }
}

// 전역 노출 — render.js 의 afterRender 에서 호출
window.afterRenderAssessment = afterRenderAssessment;
