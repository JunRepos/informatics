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

function getOJWorker(){
  if(!_ojWorker){
    _ojWorker = new Worker('js/oj-worker.js');
    _ojWorker.onmessage = (e) => {
      const cb = _ojCallbacks[e.data.id];
      if(cb){ delete _ojCallbacks[e.data.id]; cb(e.data); }
    };
    _ojWorker.onerror = (err) => {
      console.error('OJ Worker error:', err);
    };
  }
  return _ojWorker;
}

// 5초 타임아웃 (무한루프 방지). 학생 수업용으로는 충분 — 진짜 알고리즘 문제도 5초면 끝남.
const OJ_TIMEOUT_MS = 5000;

function runPython(code, stdin){
  return new Promise((resolve) => {
    const id = ++_ojMsgId;
    const timer = setTimeout(() => {
      delete _ojCallbacks[id];
      // 워커 폐기 후 재생성 (무한루프로 멈춰있을 수 있음)
      try { _ojWorker?.terminate(); } catch(e){}
      _ojWorker = null;
      resolve({success: false, output: '', error: 'TimeoutError: 시간 초과 (5초). 무한 루프이거나 너무 느린 알고리즘일 수 있어요.', timedOut: true});
    }, OJ_TIMEOUT_MS);
    _ojCallbacks[id] = (data) => { clearTimeout(timer); resolve(data); };
    getOJWorker().postMessage({id, code, stdin});
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
    {re: /ValueError: invalid literal for int\(\)/, msg: () => '<code>int()</code> 로 정수 변환을 시도했지만 <b>숫자가 아닌 값</b>이 들어왔습니다. 입력값에 공백·문자가 섞여있나 확인하세요.'},
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

// ── 선생님: 문제 저장/수정 ──
async function _ojSaveProblem(btn){
  const title = document.getElementById('oj-title')?.value?.trim();
  const desc = document.getElementById('oj-desc')?.value?.trim();
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
    if(editId){
      await db.ref(`problems/${cid}/${editId}`).update({title, description: desc || '', testCases});
      window._ojEditId = null;
    } else {
      const targetClasses = getSelectedClasses('oj');
      if(!targetClasses.length){ err.textContent = '등록할 반을 선택하세요.'; btn.disabled = false; return; }
      const now = new Date().toISOString();
      for(const targetCid of targetClasses){
        const id = genId();
        await db.ref(`problems/${targetCid}/${id}`).set({title, description: desc || '', createdAt: now, testCases});
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
    go('oj-solve');
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

  // 학생: 코드 실행 (커스텀 stdin)
  if(act.action === 'oj-run-code'){
    const cm = document.getElementById('oj-code-editor')?._cm;
    if(cm) OJ_CODE = cm.getValue();
    if(!OJ_CODE.trim()){ toast('코드를 입력하세요.', 'err'); return; }

    // stdin 값 읽기
    const stdinEl = document.getElementById('oj-custom-stdin');
    if(stdinEl) OJ_CUSTOM_STDIN = stdinEl.value;

    OJ_RUNNING = true; OJ_RESULT_TAB = 'exec';
    el.textContent = '⏳ 실행 중...'; el.disabled = true;
    // 탭 활성화
    document.querySelectorAll('.oj-rtab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'exec'));
    const body = document.getElementById('oj-results-body');
    if(body) body.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:12px">⏳ Python 실행 중...</div>`;

    const resp = await runPython(OJ_CODE, OJ_CUSTOM_STDIN);
    OJ_CUSTOM_OUTPUT = resp;
    OJ_RUNNING = false;
    el.textContent = '▶ 코드 실행'; el.disabled = false;
    if(body) body.innerHTML = vOJRunTab();
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
    return;
  }

  // 선생님: 리스트 실습 3문제 한방 등록
  if(act.action === 'oj-load-list-pack'){
    const cid = TC_CLS?.id;
    if(!cid){ toast('반을 먼저 선택하세요.', 'err'); return; }
    if(!confirm(`${TC_CLS.label} 에 리스트 실습 OJ 3문제(인덱싱·슬라이싱·append)를 한 번에 등록할까요?`)) return;
    el.disabled = true;
    const orig = el.textContent;
    el.textContent = '⏳ 등록 중...';
    try {
      const baseTime = Date.now();
      for(let i = 0; i < OJ_LIST_SAMPLES.length; i++){
        const sample = OJ_LIST_SAMPLES[i];
        const id = genId();
        const testCases = {};
        sample.testCases.forEach((tc, idx) => {
          testCases[genId()] = {
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: !!tc.isHidden,
            order: idx
          };
        });
        await db.ref(`problems/${cid}/${id}`).set({
          title: sample.title,
          description: sample.description,
          createdAt: new Date(baseTime + i).toISOString(),
          testCases
        });
      }
      await loadOJProblems(cid);
      toast(`✓ ${OJ_LIST_SAMPLES.length}개 문제가 등록됐습니다!`, 'ok');
      render();
    } catch(err){
      toast('등록 실패: ' + err.message, 'err');
    } finally {
      el.disabled = false;
      el.textContent = orig;
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
//  OJ 예제 문제 묶음 — 3차시 리스트 실습 (인덱싱·슬라이싱·append)
//  "📦 리스트 실습 3문제 등록" 버튼으로 일괄 등록
// ══════════════════════════════════════
const OJ_LIST_SAMPLES = [

  // ── 문제 1: 인덱싱 (음수 포함) ──
  {
    title: '🔢 학번 찾기 — 인덱스로 꺼내기',
    description: `## 문제

명단에 학생 \`N\`명의 학번이 있습니다. \`K\`번째 자리(0부터 시작)에 있는 학생의 학번을 출력하세요.

\`K\` 가 음수면 **뒤에서부터** 셉니다 (\`-1\` = 마지막).

## 입력

- 첫 줄: 정수 \`N\` (1 ≤ N ≤ 100)
- 둘째 줄: \`N\`개의 학번 (공백으로 구분)
- 셋째 줄: 정수 \`K\` (\`-N ≤ K < N\`)

## 출력

\`K\` 번째 자리 학생의 학번 한 줄

## 예시 1

**입력**
\`\`\`
5
20101 20102 20103 20104 20105
2
\`\`\`

**출력**
\`\`\`
20103
\`\`\`

## 예시 2 — 음수 인덱스

**입력**
\`\`\`
4
100 200 300 400
-1
\`\`\`

**출력**
\`\`\`
400
\`\`\`

## 💡 힌트

- 두 번째 줄을 \`split()\` 로 잘라서 리스트로 만들기
- \`nums = list(map(int, input().split()))\` 패턴이 자주 쓰여요
- 음수 인덱스도 그대로 \`nums[k]\` 로 접근 가능합니다`,
    testCases: [
      // 공개
      {input: '5\n20101 20102 20103 20104 20105\n2', expectedOutput: '20103', isHidden: false},
      {input: '5\n10 20 30 40 50\n0', expectedOutput: '10', isHidden: false},
      {input: '4\n100 200 300 400\n-1', expectedOutput: '400', isHidden: false},
      // 숨김
      {input: '7\n11 22 33 44 55 66 77\n5', expectedOutput: '66', isHidden: true},
      {input: '1\n42\n0', expectedOutput: '42', isHidden: true},
      {input: '6\n1 2 3 4 5 6\n-3', expectedOutput: '4', isHidden: true}
    ]
  },

  // ── 문제 2: 슬라이싱 + sum ──
  {
    title: '📏 구간 점수 합 — 슬라이싱',
    description: `## 문제

학생 \`N\`명의 점수가 차례로 주어집니다. **인덱스 \`a\` 부터 \`b\` 직전까지** 의 점수 합을 출력하세요.

즉, 파이썬으로 \`sum(scores[a:b])\` 의 값을 구하면 됩니다. (\`b\`번째는 포함되지 않습니다!)

## 입력

- 첫 줄: 정수 \`N\` (1 ≤ N ≤ 100)
- 둘째 줄: \`N\`개의 점수 (공백 구분)
- 셋째 줄: 두 정수 \`a b\` (0 ≤ a ≤ b ≤ N)

## 출력

\`scores[a:b]\` 의 합

## 예시 1

**입력**
\`\`\`
6
10 20 30 40 50 60
1 4
\`\`\`

**출력**
\`\`\`
90
\`\`\`

설명: \`scores[1:4]\` = \`[20, 30, 40]\` → 합 = **90** (4번째인 50은 포함되지 않음!)

## 예시 2 — 전체

**입력**
\`\`\`
5
1 2 3 4 5
0 5
\`\`\`

**출력**
\`\`\`
15
\`\`\`

## 💡 힌트

- 두 번째 줄을 split해서 리스트로
- 슬라이싱 결과에 \`sum()\` 적용
- \`scores[a:b]\` 가 빈 리스트면 \`sum\` 은 \`0\``,
    testCases: [
      // 공개
      {input: '6\n10 20 30 40 50 60\n1 4', expectedOutput: '90', isHidden: false},
      {input: '5\n1 2 3 4 5\n0 5', expectedOutput: '15', isHidden: false},
      {input: '5\n10 20 30 40 50\n2 4', expectedOutput: '70', isHidden: false},
      // 숨김
      {input: '7\n5 5 5 5 5 5 5\n0 4', expectedOutput: '20', isHidden: true},
      {input: '5\n1 1 1 1 1\n2 2', expectedOutput: '0', isHidden: true},
      {input: '4\n100 200 300 400\n0 4', expectedOutput: '1000', isHidden: true},
      {input: '8\n3 1 4 1 5 9 2 6\n3 7', expectedOutput: '17', isHidden: true}
    ]
  },

  // ── 문제 3: append + max + 평균 ──
  {
    title: '➕ 점수 누적 — 빈 리스트에 append',
    description: `## 문제

빈 리스트 \`scores = []\` 를 만든 뒤, **점수 \`N\`개를 한 줄씩 입력받아** \`.append()\` 로 차례로 담으세요.

다 모은 뒤:
1. **첫째 줄**: 가장 높은 점수
2. **둘째 줄**: 평균 (소수점 **둘째 자리**까지)

## 입력

- 첫 줄: 정수 \`N\` (1 ≤ N ≤ 100)
- 다음 \`N\`줄: 각 줄에 점수 하나

## 출력

- 첫 줄: 최고 점수
- 둘째 줄: 평균 (소수점 둘째 자리, 예: \`85.00\`)

## 예시

**입력**
\`\`\`
5
80
90
75
88
92
\`\`\`

**출력**
\`\`\`
92
85.00
\`\`\`

## 💡 힌트

- 빈 리스트는 \`scores = []\`
- 반복으로 한 줄씩 입력받아 \`scores.append(int(input()))\`
- 최고 점수는 \`max(scores)\`
- 평균은 \`sum(scores) / len(scores)\`
- 소수점 둘째 자리 출력: \`f"{평균:.2f}"\` 또는 \`round(평균, 2)\` 후 \`format\``,
    testCases: [
      // 공개
      {input: '5\n80\n90\n75\n88\n92', expectedOutput: '92\n85.00', isHidden: false},
      {input: '3\n100\n100\n100', expectedOutput: '100\n100.00', isHidden: false},
      {input: '4\n70\n80\n90\n100', expectedOutput: '100\n85.00', isHidden: false},
      // 숨김
      {input: '1\n50', expectedOutput: '50\n50.00', isHidden: true},
      {input: '6\n10\n50\n30\n20\n40\n60', expectedOutput: '60\n35.00', isHidden: true},
      {input: '5\n0\n0\n0\n0\n100', expectedOutput: '100\n20.00', isHidden: true}
    ]
  }
];
