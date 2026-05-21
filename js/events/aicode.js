/* ═══════════════════════════════════════
   events/aicode.js — 🤖 AI 코딩 이벤트 핸들러

   학생: 진입 카드 → AI 채팅(코드 생성) → 자동 저장 → 코드 직접 실행
   선생님: on/off 토글 + 학생별 대화·코드 열람

   백엔드: Cloudflare Worker (AIC_WORKER_URL) → Gemini 2.5 Flash
   코드 실행: js/asmt-worker.js (Pyodide)
═══════════════════════════════════════ */

// ── 채팅 모드로 진입 (빈 채팅 — 학생이 직접 입력) ──
function _enterAicChat(){
  AIC_VIEW = 'chat';
  AIC_MESSAGES = [];
  AIC_CODE = '';
  AIC_TURN_COUNT = 0;
  AIC_LOADING = false;
  AIC_RUN_RESULT = null;
  AIC_RUN_STDIN = '';
  render();
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

// ── Pyodide 워커 (코드 실행) — 실시간 input() 지원 (oj-worker 재사용) ──
//   Colab 방식: input() 만나면 SharedArrayBuffer 로 메인에 입력 요청 → 노란 입력칸
const AIC_STDIN_BUF_SIZE = 4096;
let _aicWorker = null;
let _aicMsgId = 0;
const _aicCallbacks = {};
let _aicStdinSAB = null, _aicStdinCtrl = null, _aicStdinData = null;
const _aicSABSupported = (typeof SharedArrayBuffer !== 'undefined' && typeof Atomics !== 'undefined' && self.crossOriginIsolated !== false);

function _getAicWorker(){
  if(_aicWorker) return _aicWorker;
  // oj-worker 는 범용 run/grade 워커 (실시간 input 지원). 캐시 키도 OJ 와 공유.
  _aicWorker = new Worker('js/oj-worker.js?v=' + (typeof OJ_WORKER_VER !== 'undefined' ? OJ_WORKER_VER : '1'));
  _aicWorker.onmessage = (e) => {
    const data = e.data;
    if(data.type === 'request-input'){ _handleAicInputRequest(data.prompt); return; }
    if(data.type === 'init-stdin-done'){ return; }
    const cb = _aicCallbacks[data.id];
    if(cb){ delete _aicCallbacks[data.id]; cb(data); }
  };
  _aicWorker.onerror = (err) => console.error('AIC Worker error:', err);
  try {
    if(_aicSABSupported){
      _aicStdinSAB = new SharedArrayBuffer(8 + AIC_STDIN_BUF_SIZE);
      _aicStdinCtrl = new Int32Array(_aicStdinSAB, 0, 2);
      _aicStdinData = new Uint8Array(_aicStdinSAB, 8, AIC_STDIN_BUF_SIZE);
      _aicWorker.postMessage({ type: 'init-stdin', buffer: _aicStdinSAB });
    } else {
      _aicWorker.postMessage({ type: 'init-stdin' });
    }
  } catch(e){
    _aicWorker.postMessage({ type: 'init-stdin' });
  }
  return _aicWorker;
}

// 워커가 input() 요청 → 노란 입력칸 표시 후 SAB 에 써서 깨움
async function _handleAicInputRequest(prompt){
  const value = await _showAicInlineInput(prompt);
  if(!_aicStdinSAB || !_aicStdinCtrl || !_aicStdinData) return;
  if(value === null){
    Atomics.store(_aicStdinCtrl, 0, 2); // 취소
    Atomics.notify(_aicStdinCtrl, 0);
    return;
  }
  const bytes = new TextEncoder().encode(value);
  const len = Math.min(bytes.length, AIC_STDIN_BUF_SIZE);
  for(let i = 0; i < len; i++) _aicStdinData[i] = bytes[i];
  Atomics.store(_aicStdinCtrl, 1, len);
  Atomics.store(_aicStdinCtrl, 0, 1); // 데이터 준비됨
  Atomics.notify(_aicStdinCtrl, 0);
}

// 코드 패널 실행 영역에 노란 입력칸 띄우고 Promise 로 값 받기 (OJ 와 동일 스타일 재사용)
function _showAicInlineInput(prompt){
  return new Promise(resolve => {
    const body = document.getElementById('aic-run-area');
    if(!body){ resolve(''); return; }
    body.querySelectorAll('.oj-live-input').forEach(el => el.remove());
    const div = document.createElement('div');
    div.className = 'oj-live-input';
    const label = prompt
      ? `<span style="color:var(--text);font-weight:500">${esc(prompt)}</span>`
      : `<span style="color:var(--text2)">📝 input() — 값을 입력하세요</span>`;
    div.innerHTML = `
      <div class="oj-live-prompt">${label}</div>
      <div class="oj-live-row">
        <input class="oj-live-field" type="text" placeholder="값을 입력하고 Enter" spellcheck="false" autocomplete="off"/>
        <button class="btn-sm btn-p oj-live-submit">↵ 입력</button>
      </div>
      <div class="oj-live-hint">Enter로 제출 · Esc로 취소</div>`;
    body.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const input = div.querySelector('.oj-live-field');
    const btn = div.querySelector('.oj-live-submit');
    setTimeout(() => input?.focus(), 30);
    let done = false;
    const submit = () => {
      if(done) return; done = true;
      const val = input?.value || '';
      const echo = document.createElement('div');
      echo.className = 'oj-live-echo';
      echo.textContent = (prompt ? prompt : '') + val;
      div.replaceWith(echo);
      resolve(val);
    };
    const cancel = () => {
      if(done) return; done = true;
      div.remove();
      resolve(null);
    };
    btn?.addEventListener('click', submit);
    input?.addEventListener('keydown', ev => {
      if(ev.key === 'Enter'){ ev.preventDefault(); submit(); }
      else if(ev.key === 'Escape'){ ev.preventDefault(); cancel(); }
    });
  });
}

// 실시간 입력 모드로 실행 (5분 타임아웃 — 학생 입력 대기 허용)
const AIC_RUN_TIMEOUT_MS = 5 * 60 * 1000;
function _runAicCode(code){
  return new Promise((resolve) => {
    const id = ++_aicMsgId;
    const timer = setTimeout(() => {
      delete _aicCallbacks[id];
      try { _aicWorker?.terminate(); } catch(e){}
      _aicWorker = null;
      document.querySelectorAll('.oj-live-input').forEach(el => el.remove());
      resolve({ success: false, output: '', error: 'TimeoutError: 5분 동안 응답이 없어 종료했어요.' });
    }, AIC_RUN_TIMEOUT_MS);
    _aicCallbacks[id] = (data) => { clearTimeout(timer); resolve(data); };
    _getAicWorker().postMessage({ id, code, stdin: '', mode: 'run' });
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

  // 학생: 시작 ("제가 만들어볼래요" → 빈 채팅)
  if(act.action === 'aic-begin'){
    _enterAicChat();
    return;
  }

  // 학생: 이전 작업 이어하기
  if(act.action === 'aic-resume'){
    AIC_VIEW = AIC_MESSAGES.length ? 'chat' : 'entry';
    render();
    if(AIC_VIEW === 'chat') _scrollAicListToBottom();
    return;
  }

  // 학생: 처음 화면으로
  if(act.action === 'aic-back-entry'){
    AIC_VIEW = 'entry';
    render();
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

  // 학생: 코드 실행 (실시간 input — input() 만나면 입력칸이 뜸)
  if(act.action === 'aic-run'){
    if(AIC_RUNNING) return;
    const code = AIC_CODE || '';
    if(!code.trim()){ toast('실행할 코드가 없어요.', 'err'); return; }
    AIC_RUNNING = true;
    AIC_RUN_RESULT = null;
    render();
    const result = await _runAicCode(code);
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
  if(ST_TAB !== 'aicode') return;
  if(AIC_VIEW === 'chat'){
    _scrollAicListToBottom();
    setTimeout(() => {
      const inp = document.getElementById('aic-input');
      if(inp && !inp.disabled) inp.focus();
    }, 50);
  }
}

window.afterRenderAiCode = afterRenderAiCode;
