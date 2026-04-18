/* ═══════════════════════════════════════
   events/notebook.js — 노트북 이벤트 핸들러

   ipynb 업로드/파싱/삭제 + 셀 실행 (Pyodide)
═══════════════════════════════════════ */

// ── Pyodide Worker (노트북 전용, 상태 유지) ──
let _nbWorker = null;
let _nbMsgId = 0;
let _nbCallbacks = {};

function getNBWorker(){
  if(!_nbWorker){
    _nbWorker = new Worker('js/notebook-worker.js');
    _nbWorker.onmessage = (e) => {
      const cb = _nbCallbacks[e.data.id];
      if(cb){ delete _nbCallbacks[e.data.id]; cb(e.data); }
    };
    _nbWorker.onerror = (err) => console.error('Notebook worker error:', err);
  }
  return _nbWorker;
}

function runNBPython(code, stdin){
  return new Promise(resolve => {
    const id = ++_nbMsgId;
    const timer = setTimeout(() => {
      delete _nbCallbacks[id];
      resolve({success: false, output: '', error: '시간 초과 (30초)'});
    }, 30000);
    _nbCallbacks[id] = data => { clearTimeout(timer); resolve(data); };
    getNBWorker().postMessage({id, action: 'run', code, stdin});
  });
}

function resetNBWorker(){
  return new Promise(resolve => {
    const id = ++_nbMsgId;
    _nbCallbacks[id] = data => resolve(data);
    getNBWorker().postMessage({id, action: 'reset'});
  });
}

// ── ipynb 파일 파싱 (Jupyter/Colab 표준 JSON) ──
function parseIpynb(jsonText){
  const data = JSON.parse(jsonText);
  if(!data.cells || !Array.isArray(data.cells)) throw new Error('유효한 ipynb 파일이 아닙니다.');
  return data.cells.map((c, idx) => {
    const source = Array.isArray(c.source) ? c.source.join('') : (c.source || '');
    const type = c.cell_type === 'code' ? 'code' : 'markdown';
    const id = c.metadata?.id || `cell-${idx}`;
    return {id, type, source};
  });
}

// ── 이벤트 위임 ──
document.addEventListener('click', async e => {
  const t = e.target;

  // ── 노트북 업로드 (선생님) ──
  if(t.id === 'nb-upload'){
    const files = Array.from(document.getElementById('nb-file')?.files || []);
    const title = document.getElementById('nb-title')?.value?.trim();
    const errEl = document.getElementById('nb-err');
    const progEl = document.getElementById('nb-prog');
    if(!files.length){ errEl.textContent = 'ipynb 파일을 선택하세요.'; return; }
    const targetClasses = getSelectedClasses('nb');
    if(!targetClasses.length){ errEl.textContent = '등록할 반을 선택하세요.'; return; }

    t.disabled = true; errEl.textContent = '';
    progEl.style.display = 'block';
    try {
      const now = new Date().toISOString();
      let total = 0;
      for(let i = 0; i < files.length; i++){
        const file = files[i];
        progEl.textContent = `(${i+1}/${files.length}) ${file.name} 처리 중...`;
        const text = await file.text();
        let cells;
        try { cells = parseIpynb(text); }
        catch(err){ errEl.textContent = `"${file.name}" 파싱 실패: ${err.message}`; continue; }
        const nbTitle = (files.length === 1 && title) ? title : file.name.replace(/\.ipynb$/i, '');
        for(const targetCid of targetClasses){
          const nid = genId();
          await db.ref(`notebooks/${targetCid}/${nid}`).set({
            title: nbTitle, cells, createdAt: now
          });
          total++;
        }
      }
      progEl.style.display = 'none';
      toast(`${total}개 노트북 등록 완료`, 'ok');
      await loadNotebooks(TC_CLS.id); render();
    } catch(err){
      errEl.textContent = '오류: ' + err.message;
      progEl.style.display = 'none';
      t.disabled = false;
    }
    return;
  }

  const el = t.closest?.('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // 노트북 열기 (선생님/학생 공용)
  if(act.action === 'open-notebook'){
    const nb = NOTEBOOKS.find(x => x.id === act.nid); if(!nb) return;
    SEL_NOTEBOOK = nb;
    NB_CELL_OUTPUTS = {};
    NB_CELL_CODES = {};
    await resetNBWorker().catch(() => {});
    render();
    return;
  }

  // 노트북 삭제
  if(act.action === 'del-notebook'){
    if(!confirm(`"${act.ntitle}" 노트북을 삭제할까요?`)) return;
    const cid = TC_CLS?.id; if(!cid) return;
    el.disabled = true;
    await db.ref(`notebooks/${cid}/${act.nid}`).remove();
    await loadNotebooks(cid); render();
    return;
  }

  // 셀 실행
  if(act.action === 'nb-run-cell'){
    const cellId = act.cellid;
    const codeArea = document.getElementById(`nb-code-${cellId}`);
    const stdinArea = document.getElementById(`nb-stdin-${cellId}`);
    if(!codeArea) return;
    const code = codeArea.value;
    const stdin = stdinArea?.value || '';
    NB_CELL_CODES[cellId] = code;

    NB_CELL_OUTPUTS[cellId] = {running: true};
    // 버튼 상태만 바꿈 (전체 리렌더는 에디터 포커스 상실함)
    el.textContent = '⏳'; el.disabled = true;
    // 출력 영역 "실행 중..." 표시
    const cellDiv = el.closest('.nb-cell-code');
    let outDiv = cellDiv?.querySelector('.nb-output');
    if(!outDiv){
      outDiv = document.createElement('div');
      outDiv.className = 'nb-output';
      cellDiv?.querySelector('.nb-cell-main')?.appendChild(outDiv);
    }
    outDiv.classList.remove('nb-output-err');
    outDiv.innerHTML = `<pre style="color:var(--text3);font-style:italic">⏳ 실행 중...</pre>`;

    const result = await runNBPython(code, stdin);
    NB_CELL_OUTPUTS[cellId] = result;

    // 결과 표시 (해당 셀만 갱신)
    outDiv.classList.toggle('nb-output-err', result.success === false);
    let html = '';
    if(result.output) html += `<pre>${esc(result.output)}</pre>`;
    if(result.error) html += `<pre class="nb-error">${esc(result.error)}</pre>`;
    if(!result.output && !result.error && result.success) html += `<pre style="color:var(--text3);font-style:italic">(출력 없음)</pre>`;
    outDiv.innerHTML = html;
    el.textContent = '▶'; el.disabled = false;
    return;
  }

  // 세션 초기화 (모든 변수 삭제)
  if(act.action === 'nb-reset-all'){
    if(!confirm('Python 세션을 초기화할까요? 선언한 모든 변수가 사라집니다.')) return;
    el.textContent = '⏳'; el.disabled = true;
    await resetNBWorker();
    NB_CELL_OUTPUTS = {};
    el.textContent = '🔄 세션 초기화'; el.disabled = false;
    toast('세션이 초기화됐습니다.', 'ok');
    render();
    return;
  }
});

// ── Shift+Enter로 셀 실행 ──
document.addEventListener('keydown', e => {
  if(e.key !== 'Enter' || !e.shiftKey) return;
  const ta = e.target;
  if(!ta.classList?.contains('nb-code-area')) return;
  e.preventDefault();
  const cellId = ta.dataset.cellid;
  const btn = document.querySelector(`[data-action="nb-run-cell"][data-cellid="${cellId}"]`);
  btn?.click();
});

// ── 코드 영역 자동 저장 (input) ──
document.addEventListener('input', e => {
  if(e.target.classList?.contains('nb-code-area')){
    NB_CELL_CODES[e.target.dataset.cellid] = e.target.value;
  }
});

// ── Tab 키 4칸 들여쓰기 ──
document.addEventListener('keydown', e => {
  if(e.key !== 'Tab') return;
  const ta = e.target;
  if(!ta.classList?.contains('nb-code-area')) return;
  e.preventDefault();
  const s = ta.selectionStart, en = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(en);
  ta.selectionStart = ta.selectionEnd = s + 4;
});
