/* ═══════════════════════════════════════
   events/oj-actions.js — OJ 이벤트 핸들러

   문제 CRUD, 코드 실행 (Pyodide), 채점, 제출
═══════════════════════════════════════ */

// ── Pyodide Worker 관리 ──
let _ojWorker = null;
let _ojMsgId = 0;
let _ojCallbacks = {};

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

function runPython(code, stdin){
  return new Promise((resolve) => {
    const id = ++_ojMsgId;
    const timer = setTimeout(() => {
      delete _ojCallbacks[id];
      resolve({success: false, output: '', error: '시간 초과 (10초)'});
    }, 10000);
    _ojCallbacks[id] = (data) => { clearTimeout(timer); resolve(data); };
    getOJWorker().postMessage({id, code, stdin});
  });
}

// 출력 정규화 (채점용)
function normalizeOutput(s){
  return (s || '').replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd()).join('\n').trim();
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
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // 학생: 문제 선택
  if(act.action === 'oj-pick-prob'){
    const p = OJ_PROBLEMS.find(x => x.id === act.pid); if(!p) return;
    OJ_SEL_PROB = p;
    OJ_CODE = '';
    OJ_RUN_RESULTS = null;
    OJ_SUBMIT_RESULTS = null;
    const cid = CID();
    if(cid) await loadOJSubmissions(cid, p.id);
    // 이전 제출 코드가 있으면 불러오기
    const prev = OJ_SUBMISSIONS[p.id]?.[ST_USER?.number];
    if(prev?.code) OJ_CODE = prev.code;
    go('oj-solve');
    return;
  }

  // 학생: 뒤로가기
  if(act.action === 'oj-back'){
    OJ_SEL_PROB = null; OJ_RUN_RESULTS = null; OJ_SUBMIT_RESULTS = null;
    go('student');
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
    document.getElementById('oj-results').innerHTML = vOJResults();
    return;
  }

  // 학생: 코드 실행 (공개 TC만)
  if(act.action === 'oj-run-code'){
    const cm = document.getElementById('oj-code-editor')?._cm;
    if(cm) OJ_CODE = cm.getValue();
    if(!OJ_CODE.trim()){ toast('코드를 입력하세요.', 'err'); return; }

    const visibleTcs = (OJ_SEL_PROB.testCases || []).filter(t => !t.isHidden);
    if(!visibleTcs.length){ toast('테스트 케이스가 없습니다.', 'err'); return; }

    OJ_RUNNING = true;
    el.textContent = '⏳ 실행 중...'; el.disabled = true;
    document.getElementById('oj-results').innerHTML = '<div style="color:var(--text3);font-size:13px;padding:12px">⏳ Python 실행 중...</div>';

    const results = [];
    for(const tc of visibleTcs){
      const resp = await runPython(OJ_CODE, tc.input);
      const actual = normalizeOutput(resp.output);
      const expected = normalizeOutput(tc.expectedOutput);
      results.push({
        tcId: tc.id, passed: actual === expected && resp.success,
        input: tc.input, expected: tc.expectedOutput, actual: resp.output || '',
        isHidden: false, error: resp.success ? null : resp.error
      });
    }

    OJ_RUN_RESULTS = results; OJ_SUBMIT_RESULTS = null; OJ_RUNNING = false;
    el.textContent = '▶ 코드 실행'; el.disabled = false;
    document.getElementById('oj-results').innerHTML = vOJResults();
    return;
  }

  // 학생: 제출 후 채점 (전체 TC)
  if(act.action === 'oj-submit-code'){
    const cm = document.getElementById('oj-code-editor')?._cm;
    if(cm) OJ_CODE = cm.getValue();
    if(!OJ_CODE.trim()){ toast('코드를 입력하세요.', 'err'); return; }

    const allTcs = OJ_SEL_PROB.testCases || [];
    if(!allTcs.length){ toast('테스트 케이스가 없습니다.', 'err'); return; }

    OJ_RUNNING = true;
    el.textContent = '⏳ 채점 중...'; el.disabled = true;
    const runBtn = document.querySelector('[data-action=oj-run-code]');
    if(runBtn) runBtn.disabled = true;
    document.getElementById('oj-results').innerHTML = '<div style="color:var(--text3);font-size:13px;padding:12px">⏳ 채점 중... (테스트 케이스 실행 중)</div>';

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
    el.textContent = '📤 제출 후 채점하기'; el.disabled = false;
    if(runBtn) runBtn.disabled = false;
    document.getElementById('oj-results').innerHTML = vOJResults();
    return;
  }

  // 선생님: 문제 저장
  if(e.target.id === 'oj-save-btn'){
    const title = document.getElementById('oj-title')?.value?.trim();
    const desc = document.getElementById('oj-desc')?.value?.trim();
    const err = document.getElementById('oj-form-err');
    const cid = TC_CLS?.id; if(!cid) return;
    if(!title){ err.textContent = '제목을 입력하세요.'; return; }

    // 테스트케이스 수집
    const tcRows = document.querySelectorAll('.oj-tc-form-row');
    const testCases = {};
    let tcOrder = 0;
    tcRows.forEach(row => {
      const input = row.querySelector('.oj-tc-input')?.value || '';
      const output = row.querySelector('.oj-tc-output')?.value || '';
      const hidden = row.querySelector('.oj-tc-hidden')?.checked || false;
      if(!input && !output) return; // 빈 행 건너뛰기
      const tid = genId();
      testCases[tid] = {input, expectedOutput: output, isHidden: hidden, order: tcOrder++};
    });

    if(!Object.keys(testCases).length){ err.textContent = '테스트 케이스를 최소 1개 입력하세요.'; return; }

    e.target.disabled = true; err.textContent = '';

    try {
      const editId = e.target.dataset.editId;
      if(editId){
        await db.ref(`problems/${cid}/${editId}`).update({title, description: desc || '', testCases});
        window._ojEditId = null;
      } else {
        const targetClasses = getSelectedClasses('oj');
        if(!targetClasses.length){ err.textContent = '등록할 반을 선택하세요.'; e.target.disabled = false; return; }
        const now = new Date().toISOString();
        for(const targetCid of targetClasses){
          const id = genId();
          await db.ref(`problems/${targetCid}/${id}`).set({title, description: desc || '', createdAt: now, testCases});
        }
        if(targetClasses.length > 1) toast(`${targetClasses.length}개 반에 문제가 등록됐습니다.`, 'ok');
      }
      await loadOJProblems(cid); render();
    } catch(e2){ err.textContent = '오류: ' + e2.message; e.target.disabled = false; }
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
