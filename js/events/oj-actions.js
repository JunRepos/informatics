/* ═══════════════════════════════════════
   events/oj-actions.js — OJ 이벤트 핸들러

   문제 CRUD, 코드 실행 (Pyodide), 채점, 제출
═══════════════════════════════════════ */

// ── Pyodide Worker 관리 ──
let _ojWorker = null;
let _ojMsgId = 0;
let _ojCallbacks = {};

// ── 자동 저장 (학생 작성 중 코드) ──
let _ojDraftTimer = null;
function scheduleOJDraftSave(){
  if(IS_TC || !ST_USER || !OJ_SEL_PROB || !SEL_CLS) return;
  clearTimeout(_ojDraftTimer);
  setOJDraftStatus('pending');
  _ojDraftTimer = setTimeout(async () => {
    setOJDraftStatus('saving');
    try {
      await saveOJDraft(SEL_CLS.id, OJ_SEL_PROB.id, ST_USER.number, OJ_CODE);
      setOJDraftStatus('saved');
    } catch(e){
      console.warn('OJ draft save failed:', e);
      setOJDraftStatus('error');
    }
  }, 1500);
}
function setOJDraftStatus(state){
  const el = document.getElementById('oj-draft-ind');
  if(!el) return;
  const map = {
    idle:    '',
    pending: '✏️ 편집 중...',
    saving:  '💾 저장 중...',
    saved:   '✓ 자동 저장됨',
    error:   '⚠️ 저장 실패',
  };
  el.textContent = map[state] || '';
  el.dataset.state = state;
}

// 워커 코드 변경 시 이 버전을 올려 브라우저 캐시 무효화
const OJ_WORKER_VER = '20260516-input-fallback';

// SAB 공유 메모리 (실시간 input() 용)
const OJ_STDIN_BUF_SIZE = 4096;
let _ojStdinSAB = null;
let _ojStdinCtrl = null;   // Int32Array(2) — [status, length]
let _ojStdinData = null;   // Uint8Array
let _ojStdinReady = false; // 워커가 SAB 활성화 완료
let _ojSABSupported = (typeof SharedArrayBuffer !== 'undefined' && typeof Atomics !== 'undefined' && self.crossOriginIsolated !== false);

function getOJWorker(){
  if(!_ojWorker){
    _ojWorker = new Worker('js/oj-worker.js?v=' + OJ_WORKER_VER);
    _ojWorker.onmessage = (e) => {
      const data = e.data;
      // 입력 요청 (Python input() 호출)
      if(data.type === 'request-input'){
        _handleOJInputRequest(data.prompt);
        return;
      }
      if(data.type === 'init-stdin-done'){
        _ojStdinReady = !!data.supported;
        return;
      }
      const cb = _ojCallbacks[data.id];
      if(cb){ delete _ojCallbacks[data.id]; cb(data); }
    };
    _ojWorker.onerror = (err) => {
      console.error('OJ Worker error:', err);
    };
    // SAB 초기화 — 워커에 공유 버퍼 전달
    try {
      if(_ojSABSupported){
        _ojStdinSAB = new SharedArrayBuffer(8 + OJ_STDIN_BUF_SIZE);
        _ojStdinCtrl = new Int32Array(_ojStdinSAB, 0, 2);
        _ojStdinData = new Uint8Array(_ojStdinSAB, 8, OJ_STDIN_BUF_SIZE);
        _ojWorker.postMessage({type: 'init-stdin', buffer: _ojStdinSAB});
      } else {
        _ojWorker.postMessage({type: 'init-stdin'});
      }
    } catch(e){
      console.warn('OJ SAB init failed:', e);
      _ojWorker.postMessage({type: 'init-stdin'});
    }
  }
  return _ojWorker;
}

// 워커가 input() 요청 시 호출 — 결과 패널에 인라인 입력 박스 표시 후
// 사용자 입력을 SAB 에 써서 워커 깨움 (Atomics.notify)
async function _handleOJInputRequest(prompt){
  const value = await _showOJInlineInput(prompt);
  if(!_ojStdinSAB || !_ojStdinCtrl || !_ojStdinData) return;
  if(value === null){
    Atomics.store(_ojStdinCtrl, 0, 2); // 취소
    Atomics.notify(_ojStdinCtrl, 0);
    return;
  }
  const enc = new TextEncoder();
  const bytes = enc.encode(value);
  const len = Math.min(bytes.length, OJ_STDIN_BUF_SIZE);
  for(let i = 0; i < len; i++) _ojStdinData[i] = bytes[i];
  Atomics.store(_ojStdinCtrl, 1, len);
  Atomics.store(_ojStdinCtrl, 0, 1); // 데이터 준비됨
  Atomics.notify(_ojStdinCtrl, 0);
}

// 결과 패널에 노란 입력 박스 띄우고 Promise 로 값 받기
function _showOJInlineInput(prompt){
  return new Promise(resolve => {
    const body = document.getElementById('oj-results-body');
    if(!body){ resolve(''); return; }
    // 기존 입력 박스 제거
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
    div.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    const input = div.querySelector('.oj-live-field');
    const btn = div.querySelector('.oj-live-submit');
    setTimeout(() => input?.focus(), 30);
    let done = false;
    const submit = () => {
      if(done) return;
      done = true;
      const val = input?.value || '';
      // echo 출력으로 변환
      const echo = document.createElement('div');
      echo.className = 'oj-live-echo';
      echo.textContent = (prompt ? prompt : '') + val;
      div.replaceWith(echo);
      resolve(val);
    };
    const cancel = () => {
      if(done) return;
      done = true;
      div.remove();
      resolve(null);
    };
    btn?.addEventListener('click', submit);
    input?.addEventListener('keydown', e => {
      if(e.key === 'Enter'){ e.preventDefault(); submit(); }
      else if(e.key === 'Escape'){ e.preventDefault(); cancel(); }
    });
  });
}

// 5초 타임아웃 (무한루프 방지). 단, 실시간 input 모드에선 길게 (학생 입력 대기 가능)
const OJ_TIMEOUT_MS = 5000;
const OJ_TIMEOUT_RUN_MS = 5 * 60 * 1000; // 실시간 모드: 5분

function runPython(code, stdin, opts){
  const mode = opts?.mode || 'grade';
  return new Promise((resolve) => {
    const id = ++_ojMsgId;
    const limit = mode === 'run' ? OJ_TIMEOUT_RUN_MS : OJ_TIMEOUT_MS;
    const timer = setTimeout(() => {
      delete _ojCallbacks[id];
      // 워커 폐기 후 재생성 (무한루프로 멈춰있을 수 있음)
      try { _ojWorker?.terminate(); } catch(e){}
      _ojWorker = null;
      _ojStdinReady = false;
      // 인라인 입력 박스 정리
      document.querySelectorAll('.oj-live-input').forEach(el => el.remove());
      resolve({
        success: false, output: '',
        error: mode === 'run' ? 'TimeoutError: 5분 동안 응답이 없어 종료했어요.' : 'TimeoutError: 시간 초과 (5초). 무한 루프이거나 너무 느린 알고리즘일 수 있어요.',
        timedOut: true
      });
    }, limit);
    _ojCallbacks[id] = (data) => { clearTimeout(timer); resolve(data); };
    getOJWorker().postMessage({id, code, stdin, mode});
  });
}

// 비주얼 OJ — 시각화 캔버스 업데이트
function _updateOJVisual(input, output, error){
  if(!OJ_SEL_PROB?.visualType) return;
  const canvas = document.getElementById('oj-visual-canvas');
  if(!canvas || typeof renderVisualWidget !== 'function') return;
  // 첫 공개 TC 의 expectedOutput 을 정답 비교용으로 사용
  const firstTc = (OJ_SEL_PROB.testCases || []).find(t => !t.isHidden);
  const expected = firstTc?.expectedOutput || '';
  // 에러가 있으면 output 무효 처리
  renderVisualWidget(canvas, OJ_SEL_PROB.visualType, {
    input: input || firstTc?.input || '',
    output: error ? null : (output || ''),
    expected
  });
}

// 출력 정규화 (채점용)
function normalizeOutput(s){
  return (s || '').replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd()).join('\n').trim();
}

// ── 친절한 에러 메시지 ──
//   Pyodide raw traceback → 한국어 한 줄 + 원본은 펼쳐보기로
function friendlyOJError(rawError){
  if(!rawError) return null;

  // line 번호 추출 (사용자 코드 기준)
  const lineMatch = rawError.match(/File "<exec>", line (\d+)/);
  const lineNum = lineMatch ? parseInt(lineMatch[1]) : null;

  // 가장 안쪽(마지막) 에러 라인 추출
  const lines = rawError.split('\n').map(l => l.trimEnd()).filter(Boolean);
  const errorLine = lines.length ? lines[lines.length - 1] : '';

  const patterns = [
    {re: /RuntimeError: 실시간 input/, msg: () => '실시간 입력 모드가 활성화되지 않았어요. <b>페이지를 한 번 더 새로고침(Ctrl+Shift+R)</b> 하거나, 결과 패널의 <b>"미리 입력값"</b> 칸에 줄별로 값을 채우고 ▶ 실행해주세요.'},
    {re: /^TimeoutError/, msg: () => '실행이 5초를 넘어 중단됐어요. <b>무한 루프</b>이거나(while True 같은 거 종료조건 확인), 알고리즘이 너무 느릴 수 있어요.'},
    {re: /NameError: name '(\w+)' is not defined/, msg: m => `<code>${m[1]}</code> 라는 이름을 사용했는데 <b>아직 정의되지 않았습니다</b>. 변수/함수 이름 오타가 없는지 확인해주세요.`},
    {re: /IndentationError/, msg: () => '<b>들여쓰기</b>가 맞지 않습니다. 같은 블록은 모두 같은 칸 수(보통 4칸 또는 탭)로 통일해주세요.'},
    {re: /SyntaxError: EOL while scanning string literal/, msg: () => '문자열의 <b>닫는 따옴표</b>(<code>"</code> 또는 <code>\'</code>)가 빠졌습니다.'},
    {re: /SyntaxError: unexpected EOF/, msg: () => '코드가 완성되지 않았습니다. <b>괄호</b>나 <b>콜론(<code>:</code>)</b>이 빠지지 않았는지 확인해주세요.'},
    {re: /SyntaxError/, msg: () => '<b>문법 오류</b>입니다. 콜론(<code>:</code>), 괄호, 따옴표를 빼먹지 않았는지 확인해주세요.'},
    {re: /TypeError: unsupported operand type/, msg: () => '서로 <b>다른 자료형</b>끼리 연산했습니다. 예: 문자열 + 숫자 → 숫자를 <code>str()</code>로 변환하거나, <code>int(input())</code>로 입력값을 정수로 바꿔야 할 수 있어요.'},
    {re: /TypeError: '(\w+)' object is not subscriptable/, msg: m => `<code>${m[1]}</code> 자료형은 <b>인덱싱(<code>[ ]</code>)을 지원하지 않습니다</b>.`},
    {re: /TypeError: '(\w+)' object is not callable/, msg: m => `<code>${m[1]}</code> 는 함수가 아니어서 <b><code>()</code>로 호출할 수 없어요</b>. 변수명과 함수명이 같지 않은지 확인하세요.`},
    {re: /TypeError: '(\w+)' object is not iterable/, msg: m => `<code>${m[1]}</code> 자료형은 <b>반복(<code>for/in</code>)에 사용할 수 없어요</b>.`},
    {re: /TypeError: argument of type '(\w+)' is not iterable/, msg: m => `<code>${m[1]}</code> 자료형은 반복할 수 없어요. 리스트나 문자열인지 확인하세요.`},
    {re: /TypeError: missing (\d+) required positional argument/, msg: m => `함수에 필요한 <b>인자가 ${m[1]}개 부족</b>합니다.`},
    {re: /TypeError: (\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given/, msg: m => `<code>${m[1]}</code> 함수는 <b>${m[2]}개</b>의 인자를 받지만 <b>${m[3]}개</b>를 넘겼어요.`},
    {re: /TypeError: '(.+?)' not supported between instances of '(\w+)' and '(\w+)'/, msg: m => `<b>${m[2]}</b> 와 <b>${m[3]}</b> 자료형끼리는 <code>${m[1]}</code> 비교/연산이 안 됩니다.`},
    {re: /TypeError/, msg: () => '<b>자료형 오류</b>입니다. 변수의 종류(숫자/문자열/리스트 등)가 맞는지 확인해주세요.'},
    {re: /ZeroDivisionError/, msg: () => '<b>0으로 나눌 수 없습니다</b>. 분모가 0인지 검사하는 조건문을 추가해주세요.'},
    {re: /IndexError: list index out of range/, msg: () => '리스트의 <b>범위를 벗어나</b> 접근했습니다. 인덱스는 <code>0</code>부터 <code>len(리스트)-1</code>까지여야 해요.'},
    {re: /IndexError: string index out of range/, msg: () => '문자열의 <b>범위를 벗어나</b> 접근했습니다.'},
    {re: /IndexError: tuple index out of range/, msg: () => '튜플의 <b>범위를 벗어나</b> 접근했습니다.'},
    {re: /KeyError: ['"]?(.+?)['"]?$/m, msg: m => `딕셔너리에 <code>${m[1]}</code> 키가 <b>없습니다</b>.`},
    {re: /ValueError: invalid literal for int\(\) with base \d+: ['"]['"]/, msg: () => '<code>int(input())</code> 에 <b>빈 값</b>이 들어왔어요. <br>📝 ▶ 실행 후 결과 패널 아래에 <b>노란 입력 박스</b>가 떴는지 확인하고, 값을 입력 후 Enter 눌러주세요. <br>📝 또는 <b>"미리 입력값"</b> 칸에 값을 한 줄씩 채우고 다시 ▶ 실행해도 됩니다.'},
    {re: /ValueError: invalid literal for int\(\)/, msg: () => '<code>int()</code> 로 정수 변환을 시도했지만 <b>숫자가 아닌 값</b>이 들어왔어요. 입력값에 공백·문자가 섞여있나 확인하세요. (예: <code>17</code> 은 되지만 <code>17세</code> 는 안 됨)'},
    {re: /ValueError: could not convert string to float/, msg: () => '<code>float()</code> 로 변환할 수 없는 값입니다.'},
    {re: /ValueError: not enough values to unpack \(expected (\d+), got (\d+)\)/, msg: m => `값을 <b>${m[1]}개</b>로 받으려 했는데 <b>${m[2]}개</b>만 있어요. <code>a, b = ...</code> 같은 코드에서 오른쪽 값 개수를 확인하세요.`},
    {re: /ValueError: too many values to unpack/, msg: () => '값의 개수가 너무 많습니다. <code>a, b = ...</code> 같은 코드에서 받는 변수 수가 충분한지 확인하세요.'},
    {re: /ValueError/, msg: () => '<b>값이 적절하지 않습니다</b>. 함수에 넘긴 값이 올바른 형식인지 확인하세요.'},
    {re: /ImportError|ModuleNotFoundError: No module named '(\w+)'/, msg: m => `<code>${m[1] || '모듈'}</code> 을(를) 찾을 수 없어요. 우리 환경에서는 일부 표준 라이브러리만 사용 가능합니다.`},
    {re: /AttributeError: '(\w+)' object has no attribute '(\w+)'/, msg: m => `<code>${m[1]}</code> 자료형에 <code>${m[2]}</code> 속성/메서드가 <b>없습니다</b>. 오타나 자료형을 확인해주세요.`},
    {re: /AttributeError: module '(\w+)' has no attribute '(\w+)'/, msg: m => `<code>${m[1]}</code> 모듈에 <code>${m[2]}</code> 가 없습니다. 오타나 모듈 이름을 확인하세요.`},
    {re: /RecursionError/, msg: () => '<b>재귀 호출이 너무 깊어요</b>. 종료 조건이 잘 동작하는지 확인하거나 반복문으로 바꿔보세요.'},
    {re: /OverflowError/, msg: () => '숫자가 너무 커서 <b>오버플로우</b>가 발생했습니다.'},
    {re: /MemoryError/, msg: () => '<b>메모리가 부족</b>합니다. 너무 큰 자료구조를 만들지 않았는지 확인하세요.'},
    {re: /AssertionError/, msg: () => '<code>assert</code> 조건이 거짓이라 발생한 오류입니다.'},
  ];

  for(const p of patterns){
    const m = errorLine.match(p.re) || rawError.match(p.re);
    if(m){
      return {friendly: p.msg(m), line: lineNum, raw: rawError};
    }
  }
  return {friendly: null, line: lineNum, raw: rawError};
}

// ── 줄 단위 diff 렌더 ──
function renderOJDiff(expected, actual){
  const eLines = (expected || '').replace(/\r\n/g, '\n').split('\n');
  const aLines = (actual   || '').replace(/\r\n/g, '\n').split('\n');
  const maxLen = Math.max(eLines.length, aLines.length);

  let rows = '';
  for(let i = 0; i < maxLen; i++){
    const e = eLines[i] ?? '';
    const a = aLines[i] ?? '';
    const same = e.trimEnd() === a.trimEnd();
    rows += `<div class="oj-diff-row${same ? '' : ' oj-diff-mismatch'}">
      <span class="oj-diff-num">${i + 1}</span>
      <span class="oj-diff-cell oj-diff-exp">${e ? esc(e) : '<span class="oj-diff-empty">∅</span>'}</span>
      <span class="oj-diff-arrow">${same ? '=' : '≠'}</span>
      <span class="oj-diff-cell oj-diff-act">${a ? esc(a) : '<span class="oj-diff-empty">∅</span>'}</span>
    </div>`;
  }

  return `<div class="oj-diff">
    <div class="oj-diff-head">
      <span class="oj-diff-num"></span>
      <span class="oj-diff-cell">기대 출력</span>
      <span class="oj-diff-arrow"></span>
      <span class="oj-diff-cell">실제 출력</span>
    </div>
    ${rows}
  </div>`;
}

// description 앞에 메타 주석 추가 (visualType + starterCode)
function _encodeOJMeta(desc, opts){
  let prefix = '';
  if(opts && opts.visualType) prefix += `<!-- visual:${opts.visualType} -->\n`;
  if(opts && opts.starterCode){
    // 멀티라인 안전을 위해 base64. UTF-8 안전 인코딩.
    const b64 = btoa(unescape(encodeURIComponent(opts.starterCode)));
    prefix += `<!-- starter:${b64} -->\n`;
  }
  return prefix + (desc || '');
}

// ── 선생님: 문제 저장/수정 ──
async function _ojSaveProblem(btn){
  const title = document.getElementById('oj-title')?.value?.trim();
  const desc = document.getElementById('oj-desc')?.value?.trim();
  const starterCode = document.getElementById('oj-starter')?.value || '';
  const err = document.getElementById('oj-form-err');
  const cid = TC_CLS?.id; if(!cid) return;
  if(!title){ err.textContent = '제목을 입력하세요.'; return; }

  const tcRows = document.querySelectorAll('.oj-tc-form-row');
  const testCases = {};
  let tcOrder = 0;
  tcRows.forEach(row => {
    const input = row.querySelector('.oj-tc-input')?.value || '';
    const output = row.querySelector('.oj-tc-output')?.value || '';
    const hidden = row.querySelector('.oj-tc-hidden')?.checked || false;
    if(!input && !output) return;
    const tid = genId();
    testCases[tid] = {input, expectedOutput: output, isHidden: hidden, order: tcOrder++};
  });

  if(!Object.keys(testCases).length){ err.textContent = '테스트 케이스를 최소 1개 입력하세요.'; return; }

  btn.disabled = true; err.textContent = '';
  try {
    const editId = btn.dataset.editId;
    // 수정 시 기존 visualType 보존 (다른 메타와 함께)
    const existing = editId ? OJ_PROBLEMS.find(p => p.id === editId) : null;
    const visualType = existing?.visualType || '';
    const fullDesc = _encodeOJMeta(desc, {visualType, starterCode: starterCode.trim() ? starterCode : null});

    if(editId){
      await db.ref(`problems/${cid}/${editId}`).update({title, description: fullDesc, testCases});
      // 수정 모드에서 "다른 반에 복사" 체크된 반들에 새 문제로 등록
      const copyTargets = Array.from(document.querySelectorAll('.oj-copy-cls-chk:checked')).map(c => c.value);
      if(copyTargets.length){
        const now = new Date().toISOString();
        for(const targetCid of copyTargets){
          const id = genId();
          // 새로 등록되는 testCases는 ID 새로 부여 (기존 ID 충돌 방지)
          const newTcs = {};
          let order = 0;
          Object.values(testCases).forEach(tc => {
            newTcs[genId()] = {...tc, order: order++};
          });
          await db.ref(`problems/${targetCid}/${id}`).set({title, description: fullDesc, createdAt: now, testCases: newTcs});
        }
        toast(`수정 완료 + ${copyTargets.length}개 반에 복사 등록!`, 'ok');
      } else {
        toast('수정 완료', 'ok');
      }
      window._ojEditId = null;
    } else {
      const targetClasses = getSelectedClasses('oj');
      if(!targetClasses.length){ err.textContent = '등록할 반을 선택하세요.'; btn.disabled = false; return; }
      const now = new Date().toISOString();
      for(const targetCid of targetClasses){
        const id = genId();
        await db.ref(`problems/${targetCid}/${id}`).set({title, description: fullDesc, createdAt: now, testCases});
      }
      if(targetClasses.length > 1) toast(`${targetClasses.length}개 반에 문제가 등록됐습니다.`, 'ok');
    }
    await loadOJProblems(cid); render();
  } catch(e2){ err.textContent = '오류: ' + e2.message; btn.disabled = false; }
}

// ── 테스트케이스 동적 추가/삭제 ──
document.addEventListener('click', e => {
  if(e.target.closest('[data-action=oj-add-tc]')){
    const list = document.getElementById('oj-tc-list');
    if(!list) return;
    const idx = list.querySelectorAll('.oj-tc-form-row').length;
    const row = document.createElement('div');
    row.className = 'oj-tc-form-row';
    row.dataset.tcIdx = idx;
    row.innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;font-weight:700;color:var(--text2)">TC ${idx + 1}</span>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:var(--text3);font-weight:500;text-transform:none;letter-spacing:0">
            <input type="checkbox" class="oj-tc-hidden" style="width:auto"/> 숨김
          </label>
          <button type="button" class="btn-xs btn-danger" data-action="oj-remove-tc" data-idx="${idx}" style="margin-left:auto">✕</button>
        </div>
        <div class="form-row">
          <div class="field"><label>입력</label><textarea class="oj-tc-input" placeholder="stdin 입력값" style="min-height:50px;font-family:monospace;font-size:13px"></textarea></div>
          <div class="field"><label>기대 출력</label><textarea class="oj-tc-output" placeholder="기대하는 stdout" style="min-height:50px;font-family:monospace;font-size:13px"></textarea></div>
        </div>
      </div>`;
    list.appendChild(row);
    return;
  }

  if(e.target.closest('[data-action=oj-remove-tc]')){
    const btn = e.target.closest('[data-action=oj-remove-tc]');
    const row = btn.closest('.oj-tc-form-row');
    if(row) row.remove();
    return;
  }
});

// ── 메인 OJ 이벤트 핸들러 ──
document.addEventListener('click', async e => {
  // 선생님: 문제 저장 (id 기반 — data-action 체크 전에 처리)
  if(e.target.id === 'oj-save-btn'){
    _ojSaveProblem(e.target);
    return;
  }

  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // 학생: 문제 선택
  if(act.action === 'oj-pick-prob'){
    const p = OJ_PROBLEMS.find(x => x.id === act.pid); if(!p) return;
    OJ_SEL_PROB = p;
    OJ_CODE = '';
    OJ_RUN_RESULTS = null; OJ_SUBMIT_RESULTS = null;
    OJ_CUSTOM_STDIN = ''; OJ_CUSTOM_OUTPUT = null; OJ_RESULT_TAB = 'exec';
    const cid = CID();
    if(cid) await loadOJSubmissions(cid, p.id);
    // 1) 자동 저장된 작성 중 코드 우선 로드 → 2) 없으면 이전 제출 코드 → 3) 없으면 빈
    if(ST_USER && cid){
      try {
        const draft = await loadOJDraft(cid, p.id, ST_USER.number);
        if(draft?.code !== undefined) OJ_CODE = draft.code;
      } catch(e){ /* 무시 */ }
    }
    if(!OJ_CODE){
      const prev = OJ_SUBMISSIONS[p.id]?.[ST_USER?.number];
      if(prev?.code) OJ_CODE = prev.code;
    }
    // 가장 마지막 폴백: 선생님이 등록한 사전 코드 (starter code)
    if(!OJ_CODE && p.starterCode){
      OJ_CODE = p.starterCode;
    }
    go('oj-solve');
    return;
  }

  // 학생: 코드 초기화 시 사전 코드가 있으면 그걸로 되돌림
  if(act.action === 'oj-reset-code'){
    if(!confirm('작성 중인 코드를 초기화할까요?')) return;
    const starter = OJ_SEL_PROB?.starterCode || '';
    OJ_CODE = starter;
    const cm = document.getElementById('oj-code-editor')?._cm;
    if(cm){ cm.setValue(starter); cm.focus(); }
    else {
      const ta = document.getElementById('oj-code-editor');
      if(ta) ta.value = starter;
    }
    return;
  }

  // 학생: 뒤로가기
  if(act.action === 'oj-back'){
    OJ_SEL_PROB = null; OJ_RUN_RESULTS = null; OJ_SUBMIT_RESULTS = null;
    OJ_CUSTOM_STDIN = ''; OJ_CUSTOM_OUTPUT = null; OJ_RESULT_TAB = 'exec';
    go('student');
    return;
  }

  // 탭 전환
  if(act.action === 'oj-switch-tab'){
    OJ_RESULT_TAB = act.tab;
    // stdin 값 보존
    const stdinEl = document.getElementById('oj-custom-stdin');
    if(stdinEl) OJ_CUSTOM_STDIN = stdinEl.value;
    // 탭 버튼 업데이트
    document.querySelectorAll('.oj-rtab').forEach(b => b.classList.toggle('active', b.dataset.tab === act.tab));
    // 내용만 갱신
    const body = document.getElementById('oj-results-body');
    if(body) body.innerHTML = OJ_RESULT_TAB === 'exec' ? vOJRunTab() : vOJTestTab();
    return;
  }

  // 예제 복사
  if(act.action === 'oj-copy-example'){
    navigator.clipboard.writeText(act.text).then(() => {
      el.textContent = '✓'; setTimeout(() => { el.textContent = '복사'; }, 1000);
    }).catch(() => toast('복사 실패', 'err'));
    return;
  }

  // 학생: 이전 코드 불러오기
  if(act.action === 'oj-load-prev'){
    const sub = OJ_SUBMISSIONS[OJ_SEL_PROB?.id]?.[ST_USER?.number];
    if(sub?.code){
      OJ_CODE = sub.code;
      const cm = document.getElementById('oj-code-editor')?._cm;
      if(cm) cm.setValue(OJ_CODE);
      toast('이전 제출 코드를 불러왔습니다.', 'ok');
    }
    return;
  }

  // 학생: 코드 초기화
  if(act.action === 'oj-reset-code'){
    if(!confirm('코드를 초기화할까요?')) return;
    OJ_CODE = '';
    const cm = document.getElementById('oj-code-editor')?._cm;
    if(cm) cm.setValue('');
    OJ_RUN_RESULTS = null; OJ_SUBMIT_RESULTS = null;
    OJ_CUSTOM_STDIN = ''; OJ_CUSTOM_OUTPUT = null; OJ_RESULT_TAB = 'exec';
    const body = document.getElementById('oj-results-body');
    if(body) body.innerHTML = vOJRunTab();
    document.querySelectorAll('.oj-rtab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'exec'));
    return;
  }

  // 학생: 코드 실행 — 실시간 input() 모드 (input() 호출마다 인라인 박스로 직접 입력)
  if(act.action === 'oj-run-code'){
    const cm = document.getElementById('oj-code-editor')?._cm;
    if(cm) OJ_CODE = cm.getValue();
    if(!OJ_CODE.trim()){ toast('코드를 입력하세요.', 'err'); return; }

    // stdin 영역(미리 입력값) — 비어 있으면 실시간 입력으로 동작
    const stdinEl = document.getElementById('oj-custom-stdin');
    if(stdinEl) OJ_CUSTOM_STDIN = stdinEl.value;

    OJ_RUNNING = true; OJ_RESULT_TAB = 'exec';
    el.textContent = '⏳ 실행 중...'; el.disabled = true;
    document.querySelectorAll('.oj-rtab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'exec'));
    const body = document.getElementById('oj-results-body');
    if(body){
      body.innerHTML = `
        <div class="oj-run-header" style="color:var(--text3);font-size:13px;padding:8px 12px;border-bottom:1px solid var(--border)">⏳ Python 실행 중... <span style="color:var(--text2)">input() 만나면 여기에 입력 박스가 떠요</span></div>
        <div class="oj-run-stream" id="oj-run-stream"></div>`;
    }

    // mode: 'run' — 실시간 input 활성. stdin이 비어 있으면 input() 호출 시 직접 입력.
    const resp = await runPython(OJ_CODE, OJ_CUSTOM_STDIN, {mode: 'run'});
    OJ_CUSTOM_OUTPUT = resp;
    OJ_RUNNING = false;
    el.textContent = '▶ 코드 실행'; el.disabled = false;
    if(body) body.innerHTML = vOJRunTab();
    _updateOJVisual(OJ_CUSTOM_STDIN, resp.output, resp.error);
    return;
  }

  // 학생: 제출 후 채점 (전체 TC)
  if(act.action === 'oj-submit-code'){
    const cm = document.getElementById('oj-code-editor')?._cm;
    if(cm) OJ_CODE = cm.getValue();
    if(!OJ_CODE.trim()){ toast('코드를 입력하세요.', 'err'); return; }

    const allTcs = OJ_SEL_PROB.testCases || [];
    if(!allTcs.length){ toast('테스트 케이스가 없습니다.', 'err'); return; }

    // stdin 값 보존
    const stdinEl2 = document.getElementById('oj-custom-stdin');
    if(stdinEl2) OJ_CUSTOM_STDIN = stdinEl2.value;

    OJ_RUNNING = true; OJ_RESULT_TAB = 'test';
    el.textContent = '⏳ 채점 중...'; el.disabled = true;
    const runBtn = document.querySelector('[data-action=oj-run-code]');
    if(runBtn) runBtn.disabled = true;
    // 탭 활성화
    document.querySelectorAll('.oj-rtab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'test'));
    const body2 = document.getElementById('oj-results-body');
    if(body2) body2.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:12px">⏳ 채점 중... (테스트 케이스 실행 중)</div>';

    const results = [];
    for(const tc of allTcs){
      const resp = await runPython(OJ_CODE, tc.input);
      const actual = normalizeOutput(resp.output);
      const expected = normalizeOutput(tc.expectedOutput);
      results.push({
        tcId: tc.id, passed: actual === expected && resp.success,
        input: tc.input, expected: tc.expectedOutput, actual: resp.output || '',
        isHidden: tc.isHidden, error: resp.success ? null : resp.error
      });
    }

    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const status = passed === total ? 'pass' : passed > 0 ? 'partial' : 'fail';

    // Firebase에 저장
    const cid = CID();
    if(cid && ST_USER){
      await db.ref(`ojSubmissions/${cid}/${OJ_SEL_PROB.id}/${ST_USER.number}`).set({
        code: OJ_CODE, submittedAt: new Date().toISOString(),
        totalCases: total, passedCases: passed, status,
        results: results.map(r => ({tcId: r.tcId, passed: r.passed, isHidden: r.isHidden}))
      });
      await loadOJSubmissions(cid, OJ_SEL_PROB.id);
    }

    OJ_SUBMIT_RESULTS = results; OJ_RUN_RESULTS = null; OJ_RUNNING = false;
    el.textContent = '제출 후 채점하기'; el.disabled = false;
    if(runBtn) runBtn.disabled = false;
    if(body2) body2.innerHTML = vOJTestTab();
    // 비주얼 OJ — 첫 공개 TC 결과를 시각화에 반영 (정답이면 자동으로 트로피)
    const firstVisible = results.find((r, i) => !allTcs[i].isHidden) || results[0];
    if(firstVisible){
      _updateOJVisual(firstVisible.input, firstVisible.actual, firstVisible.error);
    }
    return;
  }

  // 선생님: Markdown 업로드 — 파일 선택 → 파싱 → 한 번에 여러 문제 등록
  if(act.action === 'oj-import-md'){
    const cid = TC_CLS?.id;
    if(!cid){ toast('반을 먼저 선택하세요.', 'err'); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt,text/markdown,text/plain';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if(!file) return;
      try {
        const text = await file.text();
        let problems;
        try {
          problems = parseOJMarkdown(text);
        } catch(perr){
          toast('Markdown 파싱 오류: ' + perr.message, 'err');
          return;
        }
        if(!problems.length){
          toast('파일에서 문제를 찾을 수 없어요. (각 문제는 "# 제목" 으로 시작해야 해요)', 'err');
          return;
        }
        if(!confirm(`${TC_CLS.label} 에 OJ 문제 ${problems.length}개를 등록할까요?\n\n파일: ${file.name}`)) return;
        const btn = document.querySelector('[data-action="oj-import-md"]');
        if(btn){ btn.disabled = true; }
        const orig = btn ? btn.textContent : '';
        try {
          const baseTime = Date.now();
          for(let i = 0; i < problems.length; i++){
            const prob = problems[i];
            const fullDesc = _encodeOJMeta(prob.description, {
              visualType: prob.visualType || null,
              starterCode: prob.starterCode || null
            });
            const id = genId();
            const tcMap = {};
            prob.testCases.forEach((tc, idx) => {
              tcMap[genId()] = {
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isHidden: !!tc.isHidden,
                order: idx
              };
            });
            await db.ref(`problems/${cid}/${id}`).set({
              title: prob.title,
              description: fullDesc,
              createdAt: new Date(baseTime + i).toISOString(),
              testCases: tcMap
            });
            if(btn) btn.textContent = `⏳ 등록 중 ${i+1}/${problems.length}...`;
          }
          await loadOJProblems(cid);
          toast(`✓ ${problems.length}개 문제가 등록됐습니다!`, 'ok');
          render();
        } catch(err){
          toast('등록 실패: ' + err.message, 'err');
        } finally {
          if(btn){ btn.disabled = false; btn.textContent = orig; }
        }
      } catch(err){
        toast('파일 읽기 실패: ' + err.message, 'err');
      }
    };
    input.click();
    return;
  }

  // 선생님: 샘플 Markdown 양식 다운로드 (편집해서 다시 업로드)
  if(act.action === 'oj-download-sample'){
    const sample = OJ_MD_SAMPLE;
    const blob = new Blob([sample], {type:'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'oj-template-sample.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('샘플 양식(.md)이 다운로드됐어요. 편집한 뒤 📥 업로드 하세요.', 'ok');
    return;
  }

  // 선생님: 현재 반 문제 전체 → Markdown 내보내기 (백업 / 다른 반 이동용)
  if(act.action === 'oj-export-md'){
    const cid = TC_CLS?.id;
    if(!cid){ toast('반을 먼저 선택하세요.', 'err'); return; }
    if(!OJ_PROBLEMS.length){ toast('내보낼 문제가 없어요.', 'err'); return; }
    const md = buildOJMarkdown(OJ_PROBLEMS);
    const blob = new Blob([md], {type:'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0,10);
    a.href = url; a.download = `oj-${cid}-${dateStr}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`✓ ${OJ_PROBLEMS.length}개 문제를 내보냈어요`, 'ok');
    return;
  }

  // 선생님: 문제 순서 위/아래로 (인접 두 문제의 createdAt swap)
  if(act.action === 'oj-move-up' || act.action === 'oj-move-down'){
    const cid = TC_CLS?.id; if(!cid) return;
    const idx = OJ_PROBLEMS.findIndex(p => p.id === act.pid);
    if(idx < 0) return;
    const swapIdx = act.action === 'oj-move-up' ? idx - 1 : idx + 1;
    if(swapIdx < 0 || swapIdx >= OJ_PROBLEMS.length) return;
    const a = OJ_PROBLEMS[idx];
    const b = OJ_PROBLEMS[swapIdx];
    el.disabled = true;
    try {
      // createdAt 만 swap — DB 스키마 변경 없음, 정렬은 자동 반영
      await db.ref(`problems/${cid}/${a.id}/createdAt`).set(b.createdAt);
      await db.ref(`problems/${cid}/${b.id}/createdAt`).set(a.createdAt);
      await loadOJProblems(cid);
      render();
    } catch(err){
      toast('순서 변경 실패: ' + err.message, 'err');
      el.disabled = false;
    }
    return;
  }

  // 선생님: 문제 수정 모드
  if(act.action === 'oj-edit-prob'){
    window._ojEditId = act.pid; setTC('oj'); return;
  }

  // 선생님: 문제 삭제
  if(act.action === 'oj-del-prob'){
    if(!confirm(`"${act.ptitle}" 문제를 삭제할까요?`)) return;
    const cid = TC_CLS?.id; if(!cid) return;
    el.disabled = true;
    await db.ref(`problems/${cid}/${act.pid}`).remove();
    await db.ref(`ojSubmissions/${cid}/${act.pid}`).remove();
    window._ojEditId = null;
    await loadOJProblems(cid); render(); return;
  }

  // 선생님: 제출 현황 보기
  if(act.action === 'oj-view-subs'){
    const pid = act.pid;
    const cid = TC_CLS?.id; if(!cid) return;
    el.textContent = '...'; el.disabled = true;
    await loadOJSubmissions(cid, pid);
    const wrap = el.closest('.list-row');
    if(wrap){
      const existing = document.getElementById('oj-status-' + pid);
      if(existing){ existing.remove(); el.textContent = '현황'; el.disabled = false; return; }
      const div = document.createElement('div');
      div.id = 'oj-status-' + pid;
      div.innerHTML = vOJStatusTable(pid);
      wrap.after(div);
    }
    el.textContent = '현황'; el.disabled = false; return;
  }

  // 선생님: 현황 닫기
  if(act.action === 'oj-close-subs'){
    document.getElementById('oj-status-' + act.pid)?.remove(); return;
  }
});


// ══════════════════════════════════════
//  OJ Markdown 파서 / 직렬화
//
//  형식 (한 파일에 여러 문제):
//    # 문제 제목
//    <!-- visual:playlist-bars -->     ← 선택 (비주얼 OJ 위젯)
//
//    ## 설명
//    (마크다운 본문 — 입력/출력/예시 등 자유롭게)
//
//    ## 시작 코드
//    ```python
//    a = int(input())
//    ```
//
//    ## 테스트
//
//    ### 케이스 1
//    입력:
//    ```
//    3 5
//    ```
//    출력:
//    ```
//    8
//    ```
//
//    ### 케이스 2 (숨김)
//    ...
//
//  새 문제는 다시 "# 제목" 으로 시작 (구분자 불필요).
//  fenced code block (``` ... ```) 내부에 # 가 있으면 무시됨.
// ══════════════════════════════════════

function parseOJMarkdown(text){
  // 줄 단위 + fenced block 추적해서 problem 들로 분할
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const problems = [];
  let cur = null;
  let inFence = false;
  for(const line of lines){
    const isFence = /^\s*```/.test(line);
    if(isFence){
      // fenced 진입/탈출 토글, 현재 문제 본문에 추가
      if(cur) cur._body.push(line);
      inFence = !inFence;
      continue;
    }
    if(!inFence && /^#\s+/.test(line)){
      // 새 문제 시작
      if(cur) problems.push(cur);
      cur = {_title: line.replace(/^#\s+/, '').trim(), _body: []};
      continue;
    }
    if(cur) cur._body.push(line);
    // cur가 null이면 (첫 # 전) 그냥 무시 — 앞쪽 자유 노트 허용
  }
  if(cur) problems.push(cur);

  // 각 문제의 본문을 섹션으로 분해
  const result = [];
  for(const p of problems){
    const parsed = _parseOJProblemBody(p._title, p._body.join('\n'));
    if(parsed) result.push(parsed);
  }
  return result;
}

function _parseOJProblemBody(title, body){
  // visual 메타 (HTML 주석)
  let visualType = null;
  body = body.replace(/<!--\s*visual:\s*([\w-]+)\s*-->/i, (m, v) => { visualType = v; return ''; });

  // 본문을 ##/### 헤더로 섹션 분리 (fenced 안의 # 는 무시)
  const sections = _splitMdSections(body);
  // sections: [{level, title, content}] — content 는 다음 같은/낮은 레벨 헤더 전까지

  // 섹션 라벨 정규화 (대소문자/공백 무시)
  const norm = (s) => (s || '').toLowerCase().replace(/\s/g, '');
  let description = '';
  let starterCode = '';
  let testRawSections = []; // 케이스 sub-sections

  for(let i = 0; i < sections.length; i++){
    const sec = sections[i];
    if(sec.level !== 2) continue;
    const t = norm(sec.title);
    if(t === '설명' || t === 'description'){
      description = sec.content.trim();
    } else if(t === '시작코드' || t === 'startercode' || t === '시작' || t === 'starter'){
      // 첫 fenced 블록의 내용
      starterCode = _firstFencedContent(sec.content);
    } else if(t === '테스트' || t === 'tests' || t === '테스트케이스' || t === 'testcases'){
      // _splitMdSections 는 평면 구조라 "### 케이스 N" 들은 "## 테스트" 의 형제로 뒤따라온다.
      // → 다음 level-2 헤더 전까지 따라오는 level-3 섹션들을 케이스로 수집.
      testRawSections = [];
      for(let j = i + 1; j < sections.length && sections[j].level >= 3; j++){
        testRawSections.push(sections[j]);
      }
      // (호환) 혹시 content 안에 직접 들어있는 경우도 포함
      const inside = _splitMdSections(sec.content).filter(s => s.level === 3);
      if(inside.length) testRawSections = inside.concat(testRawSections);
    }
  }

  // 설명이 비어 있고 ## 섹션이 없으면 본문 전체를 설명으로
  if(!description && !starterCode && !testRawSections.length){
    description = body.trim();
  }

  const testCases = [];
  for(const sec of testRawSections){
    const isHidden = /\(숨김\)|\(hidden\)/i.test(sec.title);
    // 섹션 내용에서 fenced 블록 추출 — 첫 번째는 input, 두 번째는 expectedOutput
    const blocks = _allFencedContents(sec.content);
    if(blocks.length < 2){
      // 라벨(입력:/출력:) 기반으로 다시 시도
      const inMatch = sec.content.match(/(?:입력|input)\s*:?\s*\n```[\w-]*\n([\s\S]*?)```/i);
      const outMatch = sec.content.match(/(?:출력|expected|output)\s*:?\s*\n```[\w-]*\n([\s\S]*?)```/i);
      if(inMatch && outMatch){
        testCases.push({
          input: _stripFenceTail(inMatch[1]),
          expectedOutput: _stripFenceTail(outMatch[1]),
          isHidden
        });
        continue;
      }
      throw new Error(`"${title}" — 테스트 "${sec.title}" 에 입력/출력 코드 블록이 부족해요. ` +
        `각 케이스에 \`\`\` ... \`\`\` 블록이 입력, 출력 순서로 2개 필요해요.`);
    }
    testCases.push({
      input: blocks[0],
      expectedOutput: blocks[1],
      isHidden
    });
  }

  if(!testCases.length){
    throw new Error(`"${title}" 에 테스트 케이스가 없어요. "## 테스트" 섹션 아래에 "### 케이스 1" 같은 sub 헤더로 추가하세요.`);
  }

  const obj = {
    title,
    description,
    testCases
  };
  if(starterCode) obj.starterCode = starterCode;
  if(visualType)  obj.visualType  = visualType;
  return obj;
}

// 본문을 헤더 단위 섹션으로 분리. fenced 블록 내부의 # 는 무시.
// 반환: [{level: 2|3|..., title: '...', content: '...'}]
function _splitMdSections(text){
  const lines = (text || '').split('\n');
  const result = [];
  let cur = null;
  let inFence = false;
  for(const line of lines){
    if(/^\s*```/.test(line)){
      if(cur) cur.lines.push(line);
      inFence = !inFence;
      continue;
    }
    const m = !inFence && line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if(m){
      if(cur) result.push({level: cur.level, title: cur.title, content: cur.lines.join('\n')});
      cur = {level: m[1].length, title: m[2], lines: []};
      continue;
    }
    if(cur) cur.lines.push(line);
  }
  if(cur) result.push({level: cur.level, title: cur.title, content: cur.lines.join('\n')});
  return result;
}

// 텍스트에서 첫 fenced code block 의 내용 추출
function _firstFencedContent(text){
  const m = (text || '').match(/```[\w-]*\n([\s\S]*?)```/);
  return m ? _stripFenceTail(m[1]) : '';
}

// 텍스트에서 모든 fenced code block 의 내용을 순서대로 추출
function _allFencedContents(text){
  const re = /```[\w-]*\n([\s\S]*?)```/g;
  const out = [];
  let m;
  while((m = re.exec(text || '')) !== null){
    out.push(_stripFenceTail(m[1]));
  }
  return out;
}

// fenced 블록 본문에서 마지막 \n 한 개만 제거 (블록 종료 ``` 직전의 줄바꿈)
function _stripFenceTail(s){
  return (s || '').replace(/\n$/, '');
}

// ── OJ → Markdown 직렬화 (현재 OJ_PROBLEMS 를 .md 텍스트로) ──
function buildOJMarkdown(problems){
  const stripMeta = (s) => (s || '')
    .replace(/^<!--\s*visual:[^>]*-->\s*\n?/, '')
    .replace(/^<!--\s*starter:[^>]*-->\s*\n?/, '');

  return problems.map(p => {
    const lines = [];
    lines.push(`# ${p.title || '(제목 없음)'}`);
    lines.push('');
    if(p.visualType) lines.push(`<!-- visual:${p.visualType} -->`, '');
    const desc = stripMeta(p.description || '').trim();
    lines.push('## 설명');
    lines.push('');
    lines.push(desc || '(설명 없음)');
    lines.push('');
    if(p.starterCode && p.starterCode.trim()){
      lines.push('## 시작 코드');
      lines.push('');
      lines.push('```python');
      lines.push(p.starterCode.replace(/\n$/, ''));
      lines.push('```');
      lines.push('');
    }
    lines.push('## 테스트');
    lines.push('');
    (p.testCases || []).forEach((tc, i) => {
      const hiddenTag = tc.isHidden ? ' (숨김)' : '';
      lines.push(`### 케이스 ${i + 1}${hiddenTag}`);
      lines.push('');
      lines.push('입력:');
      lines.push('```');
      lines.push((tc.input || '').replace(/\n$/, ''));
      lines.push('```');
      lines.push('');
      lines.push('출력:');
      lines.push('```');
      lines.push((tc.expectedOutput || '').replace(/\n$/, ''));
      lines.push('```');
      lines.push('');
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n');
  }).join('\n\n');
}

// ── 샘플 Markdown (다운로드용 — 2문제 예시) ──
const OJ_MD_SAMPLE = `# 🧪 예시: 두 수의 합

## 설명

두 정수를 입력받아 합을 출력하세요.

**입력**
- 첫 줄: 두 정수 (공백 구분)

**출력**
- 두 수의 합

## 시작 코드

\`\`\`python
a, b = map(int, input().split())
# 여기에 코드를 작성하세요
\`\`\`

## 테스트

### 케이스 1
입력:
\`\`\`
3 5
\`\`\`
출력:
\`\`\`
8
\`\`\`

### 케이스 2
입력:
\`\`\`
10 20
\`\`\`
출력:
\`\`\`
30
\`\`\`

### 케이스 3 (숨김)
입력:
\`\`\`
100 200
\`\`\`
출력:
\`\`\`
300
\`\`\`

# 🎵 예시: 가장 긴 노래 (비주얼 OJ)

<!-- visual:playlist-bars -->

## 설명

재생목록에서 가장 긴 노래의 인덱스(0부터)와 그 길이를 출력하세요.

**입력**
- 첫 줄: N (노래 개수)
- 둘째 줄: N개 정수 (각 길이, 초)

**출력**
- 첫 줄: 가장 긴 노래의 인덱스
- 둘째 줄: 그 길이

## 시작 코드

\`\`\`python
n = int(input())
# split·map: 공백으로 나눠 정수 리스트로 변환
lengths = list(map(int, input().split()))
# 여기에 코드를 작성하세요
\`\`\`

## 테스트

### 케이스 1
입력:
\`\`\`
5
180 240 195 320 210
\`\`\`
출력:
\`\`\`
3
320
\`\`\`

### 케이스 2 (숨김)
입력:
\`\`\`
3
100 200 150
\`\`\`
출력:
\`\`\`
1
200
\`\`\`
`;
