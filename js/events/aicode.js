/* ═══════════════════════════════════════
   events/aicode.js — 🤖 AI 코딩 이벤트 핸들러

   학생: 진입 카드 → AI 채팅(코드 생성) → 자동 저장 → 코드 직접 실행
   선생님: on/off 토글 + 학생별 대화·코드 열람

   백엔드: Cloudflare Worker (AIC_WORKER_URL) → Gemini 2.5 Flash
   코드 실행: js/asmt-worker.js (Pyodide)
═══════════════════════════════════════ */

// ── 진입 3분 자동 인사 타이머 ──
function _startAicEntryTimer(){
  _clearAicEntryTimer();
  AIC_AUTO_TIMER = setTimeout(() => {
    if(AIC_VIEW === 'entry' && ST_TAB === 'aicode'){
      _enterAicChat('need-help');
    }
  }, 3 * 60 * 1000);
}

function _clearAicEntryTimer(){
  if(AIC_AUTO_TIMER){
    clearTimeout(AIC_AUTO_TIMER);
    AIC_AUTO_TIMER = null;
  }
}

// ── 채팅 모드로 진입 ──
//   mode: 'have-idea' | 'need-help' | { preset: '자동 입력 메시지' }
async function _enterAicChat(mode){
  _clearAicEntryTimer();
  AIC_VIEW = 'chat';
  AIC_MESSAGES = [];
  AIC_CODE = '';
  AIC_TURN_COUNT = 0;
  AIC_LOADING = false;
  AIC_RUN_RESULT = null;
  AIC_RUN_STDIN = '';
  render();

  if(mode === 'have-idea') return;

  if(mode && typeof mode === 'object' && mode.preset){
    await _sendAicMessage(mode.preset);
    return;
  }

  if(mode === 'need-help'){
    await _sendAicMessage('(학생이 아직 어떤 프로그램을 만들지 정하지 못했습니다. 인사하고 진로/관심사를 물어 아이디어 찾기를 도와주세요.)');
    return;
  }
}

// ── 학생 메시지 전송 + AI 응답 ──
async function _sendAicMessage(userText){
  if(!userText || !userText.trim()) return;
  if(AIC_LOADING) return;
  if(AIC_TURN_COUNT >= AIC_TURN_LIMIT){
    toast(`대화 한도 ${AIC_TURN_LIMIT}회를 모두 사용했어요.`, 'err');
    return;
  }

  AIC_MESSAGES.push({ role: 'user', content: userText.trim(), ts: Date.now() });
  AIC_TURN_COUNT += 1;
  AIC_LOADING = true;
  render();
  _scrollAicListToBottom();

  try {
    const r = await fetch(AIC_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: AIC_MESSAGES.map(m => ({ role: m.role, content: m.content }))
      })
    });
    if(!r.ok){
      const errText = await r.text().catch(() => '');
      throw new Error(`서버 응답 오류 (${r.status}): ${errText.slice(0, 200)}`);
    }
    const data = await r.json();
    if(data.error) throw new Error(data.error);
    const aiText = data.text || '';

    AIC_MESSAGES.push({ role: 'assistant', content: aiText, ts: Date.now() });

    const code = _extractAicCode(aiText);
    if(code) AIC_CODE = code;

    AIC_LOADING = false;
    render();
    _scrollAicListToBottom();
    _saveAicSession();
  } catch(e){
    AIC_LOADING = false;
    AIC_MESSAGES.push({
      role: 'assistant',
      content: `(⚠️ AI 응답 중 오류가 발생했어요: ${e.message}\n\n잠시 후 다시 시도해 주세요.)`,
      ts: Date.now(),
      isError: true
    });
    render();
    _scrollAicListToBottom();
  }
}

// ── 세션 저장 (debounce 1초) ──
function _saveAicSession(){
  if(!SEL_CLS || !ST_USER) return;
  if(AIC_SAVE_TIMER) clearTimeout(AIC_SAVE_TIMER);
  AIC_SAVE_TIMER = setTimeout(async () => {
    try {
      await saveAicSession(SEL_CLS.id, ST_USER.number, {
        messages: AIC_MESSAGES,
        code: AIC_CODE || null,
        turnCount: AIC_TURN_COUNT
      });
    } catch(err){
      console.warn('[AI코딩] 세션 저장 실패:', err);
    }
  }, 1000);
}

// ── Pyodide 워커 (코드 실행) — asmt-worker 재사용 ──
let _aicWorker = null;
function _ensureAicWorker(){
  if(_aicWorker) return _aicWorker;
  _aicWorker = new Worker('js/asmt-worker.js?v=20260519');
  return _aicWorker;
}
function _runAicCode(code, stdin){
  return new Promise((resolve) => {
    const w = _ensureAicWorker();
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

function _scrollAicListToBottom(){
  setTimeout(() => {
    const el = document.getElementById('aic-msg-list');
    if(el) el.scrollTop = el.scrollHeight;
  }, 30);
}

// ── 클릭 이벤트 ──
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // 학생: 진입 카드
  if(act.action === 'aic-start-mode'){
    const mode = act.mode;
    if(mode === 'examples'){
      _clearAicEntryTimer();
      AIC_VIEW = 'examples';
      AIC_EXAMPLES_CAT = null;
      render();
      return;
    }
    await _enterAicChat(mode);
    return;
  }

  if(act.action === 'aic-resume'){
    _clearAicEntryTimer();
    AIC_VIEW = AIC_MESSAGES.length ? 'chat' : 'entry';
    render();
    if(AIC_VIEW === 'chat') _scrollAicListToBottom();
    return;
  }

  if(act.action === 'aic-back-entry'){
    _clearAicEntryTimer();
    AIC_VIEW = 'entry';
    AIC_EXAMPLES_CAT = null;
    render();
    return;
  }

  if(act.action === 'aic-pick-cat'){
    AIC_EXAMPLES_CAT = act.cat || null;
    render();
    return;
  }
  if(act.action === 'aic-back-cats'){
    AIC_EXAMPLES_CAT = null;
    render();
    return;
  }

  if(act.action === 'aic-pick-example'){
    const cat = AIC_CATEGORIES.find(c => c.id === AIC_EXAMPLES_CAT);
    const ex = cat?.examples[parseInt(act.idx)];
    if(!ex) return;
    await _enterAicChat({preset: `${ex} 를 만들어주세요.`});
    return;
  }

  if(act.action === 'aic-send'){
    const input = document.getElementById('aic-input');
    const text = input?.value || '';
    if(!text.trim()) return;
    if(input) input.value = '';
    await _sendAicMessage(text);
    return;
  }

  // 학생: 새로 시작 (대화·코드 초기화)
  if(act.action === 'aic-restart'){
    if(!confirm('지금까지의 대화와 코드를 모두 지우고 새 프로그램을 만들까요?')) return;
    AIC_MESSAGES = [];
    AIC_CODE = '';
    AIC_TURN_COUNT = 0;
    AIC_RUN_RESULT = null;
    AIC_RUN_STDIN = '';
    AIC_VIEW = 'entry';
    render();
    _saveAicSession();
    return;
  }

  // 학생: 코드 복사
  if(act.action === 'aic-copy-code'){
    if(!AIC_CODE) return;
    try {
      await navigator.clipboard.writeText(AIC_CODE);
      toast('코드를 복사했어요!', 'ok');
    } catch(_){
      toast('복사에 실패했어요. 직접 선택해 복사해주세요.', 'err');
    }
    return;
  }

  // 학생: 코드 실행
  if(act.action === 'aic-run'){
    if(AIC_RUNNING) return;
    const code = AIC_CODE || '';
    if(!code.trim()){ toast('실행할 코드가 없어요.', 'err'); return; }
    const raw = document.querySelector('.aic-run-stdin')?.value || '';
    AIC_RUN_STDIN = raw;
    const stdin = raw.split(/[,\n]/).map(s => s.trim()).join('\n');
    AIC_RUNNING = true;
    AIC_RUN_RESULT = null;
    render();
    const result = await _runAicCode(code, stdin);
    AIC_RUNNING = false;
    AIC_RUN_RESULT = result;
    render();
    return;
  }

  // 선생님: 학생 상세 보기
  if(act.action === 'aic-tc-view'){
    const snum = act.snum;
    if(!snum) return;
    AIC_TC_SEL_SNUM = snum;
    AIC_VIEW = 'student';
    render();
    setTimeout(() => window.scrollTo({top:0, behavior:'instant'}), 30);
    return;
  }

  if(act.action === 'aic-tc-back'){
    AIC_TC_SEL_SNUM = null;
    AIC_VIEW = 'manage';
    render();
    return;
  }

  // 선생님: on/off 토글
  if(act.action === 'aic-set-active'){
    const cid = TC_CLS?.id;
    if(!cid){ toast('반을 먼저 선택하세요.', 'err'); return; }
    const next = act.on === '1';
    if(!!AIC_ACTIVE[cid] === next) return;
    try {
      await setAicActive(cid, next);
      toast(next ? '✓ AI 코딩 메뉴를 열었어요. 학생 화면에 탭이 나타납니다.' : 'AI 코딩 메뉴를 닫았어요.', 'ok');
      render();
    } catch(err){
      toast('변경 실패: ' + (err.message || err), 'err');
    }
    return;
  }
});

// ── 입력 이벤트: 실행 입력값 보존 ──
document.addEventListener('input', e => {
  const t = e.target;
  if(t?.dataset?.action === 'aic-run-stdin'){
    AIC_RUN_STDIN = t.value || '';
  }
});

// ── 키보드: Enter 전송 ──
document.addEventListener('keydown', e => {
  if(e.target?.id !== 'aic-input') return;
  if(e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();
  const text = e.target.value || '';
  if(!text.trim()) return;
  e.target.value = '';
  _sendAicMessage(text);
});

// ── render 후 처리 ──
function afterRenderAiCode(){
  if(ST_TAB !== 'aicode'){
    _clearAicEntryTimer();
    return;
  }
  if(AIC_VIEW === 'entry'){
    _startAicEntryTimer();
  } else if(AIC_VIEW === 'chat'){
    _scrollAicListToBottom();
    setTimeout(() => {
      const inp = document.getElementById('aic-input');
      if(inp && !inp.disabled) inp.focus();
    }, 50);
  }
}

window.afterRenderAiCode = afterRenderAiCode;
