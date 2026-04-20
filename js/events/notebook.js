/* ═══════════════════════════════════════
   events/notebook.js — 노트북 이벤트 핸들러

   ipynb 업로드/파싱, CodeMirror 초기화, 셀 실행,
   셀 CRUD(추가/삭제/이동/복제), 단축키, 마크다운 편집 모드
═══════════════════════════════════════ */

// ── Pyodide Worker ──
let _nbWorker = null;
let _nbMsgId = 0;
let _nbCallbacks = {};
const _nbCMs = {};   // cellId -> CodeMirror instance
let _nbMdCM = null;  // 마크다운 편집용 CM

// ── 자동 저장 (학생 진행 상황) ──
let _nbSaveTimer = null;

function scheduleNBSave(){
  // 선생님은 저장하지 않음, 학생 진도 보는 중에도 저장 안 함
  if(IS_TC || NB_VIEWING_STUDENT || !ST_USER || !SEL_NOTEBOOK || !SEL_CLS) return;
  clearTimeout(_nbSaveTimer);
  setNBSaveStatus('pending');
  _nbSaveTimer = setTimeout(async () => {
    setNBSaveStatus('saving');
    try {
      await saveNotebookProgress(SEL_CLS.id, SEL_NOTEBOOK.id, ST_USER.number, NB_CELLS);
      setNBSaveStatus('saved');
    } catch(e){
      console.error('노트북 저장 실패:', e);
      setNBSaveStatus('error');
    }
  }, 1500);
}

function setNBSaveStatus(state){
  const el = document.getElementById('cb-save-ind');
  if(!el) return;
  const map = {
    idle:    {text: '',                      color: 'var(--cb-text-3)'},
    pending: {text: '✏️ 편집 중...',         color: 'var(--cb-text-3)'},
    saving:  {text: '💾 저장 중...',         color: 'var(--cb-text-3)'},
    saved:   {text: '✓ 저장됨',              color: '#188038'},
    error:   {text: '⚠️ 저장 실패',          color: '#d93025'},
  };
  const {text, color} = map[state] || map.idle;
  el.textContent = text;
  el.style.color = color;
}

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
      resolve({success: false, output: '', error: '시간 초과 (60초)', images: []});
    }, 60000);
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

// ── ipynb 파서 ──
function parseIpynb(jsonText){
  const data = JSON.parse(jsonText);
  if(!data.cells || !Array.isArray(data.cells)) throw new Error('유효한 ipynb 파일이 아닙니다.');
  return data.cells.map((c, idx) => {
    const source = Array.isArray(c.source) ? c.source.join('') : (c.source || '');
    const type = c.cell_type === 'code' ? 'code' : 'markdown';
    const id = c.metadata?.id || `cell-${idx}-${Math.random().toString(36).slice(2,8)}`;
    return {id, type, source};
  });
}

// ── 노트북 열기 ──
async function openNotebook(nbId){
  const nb = NOTEBOOKS.find(x => x.id === nbId); if(!nb) return;
  SEL_NOTEBOOK = nb;

  // 학생이면 저장된 진행 상황 시도
  let savedCells = null;
  if(ST_USER && !IS_TC && SEL_CLS){
    try {
      const saved = await loadNotebookProgress(SEL_CLS.id, nbId, ST_USER.number);
      if(saved && Array.isArray(saved.cells) && saved.cells.length){
        savedCells = saved.cells;
      }
    } catch(e){ console.warn('진행 상황 로드 실패:', e); }
  }

  const sourceCells = savedCells || nb.cells || [];
  NB_CELLS = sourceCells.map((c, idx) => ({
    id: c.id || `cell-${idx}-${Math.random().toString(36).slice(2,8)}`,
    type: c.type || c.cell_type || 'code',
    source: c.source || ''
  }));
  NB_CELL_OUTPUTS = {};
  NB_EXEC_COUNT = 0;
  NB_SELECTED = NB_CELLS[0]?.id || null;
  NB_EDITING_MD = null;
  destroyAllCMs();
  await resetNBWorker().catch(() => {});
  render();
  // 로드된 진행 상황이 있었으면 저장됨 상태로 표시
  if(savedCells) setNBSaveStatus('saved');
}

function closeNotebook(){
  SEL_NOTEBOOK = null;
  NB_CELLS = [];
  NB_CELL_OUTPUTS = {};
  NB_SELECTED = null;
  NB_EDITING_MD = null;
  NB_VIEWING_STUDENT = null;
  NB_SHOW_PROGRESS = false;
  NB_PROGRESS_MAP = {};
  destroyAllCMs();
  render();
}

// ── CodeMirror 헬퍼 ──
function destroyAllCMs(){
  Object.keys(_nbCMs).forEach(id => {
    try { _nbCMs[id].toTextArea?.(); } catch(e){}
    delete _nbCMs[id];
  });
  if(_nbMdCM){ try { _nbMdCM.toTextArea(); } catch(e){} _nbMdCM = null; }
}

function initNotebookCMs(){
  if(typeof CodeMirror === 'undefined') return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const readOnly = !!NB_VIEWING_STUDENT; // 학생 진도 보기 중이면 읽기 전용

  // 코드 셀
  document.querySelectorAll('.cb-code-area').forEach(ta => {
    const cellId = ta.dataset.cellid;
    if(_nbCMs[cellId]) return; // 이미 초기화됨
    const cm = CodeMirror.fromTextArea(ta, {
      mode: 'python',
      theme: isDark ? 'dracula' : 'default',
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      matchBrackets: true,
      readOnly: readOnly ? 'nocursor' : false,
      viewportMargin: Infinity,
      extraKeys: {
        'Shift-Enter': () => runCellAndNext(cellId),
        'Ctrl-Enter': () => runCell(cellId),
        'Cmd-Enter': () => runCell(cellId),
        'Alt-Enter': () => runCellAndInsert(cellId),
      }
    });
    cm.on('change', () => {
      const cell = NB_CELLS.find(c => c.id === cellId);
      if(cell){ cell.source = cm.getValue(); scheduleNBSave(); }
    });
    cm.on('focus', () => {
      if(NB_SELECTED !== cellId){
        NB_SELECTED = cellId;
        highlightSelected();
      }
    });
    _nbCMs[cellId] = cm;
  });

  // 마크다운 편집 모드
  if(NB_EDITING_MD){
    const ta = document.querySelector(`.cb-md-area[data-cellid="${NB_EDITING_MD}"]`);
    if(ta && !_nbMdCM){
      _nbMdCM = CodeMirror.fromTextArea(ta, {
        mode: 'markdown',
        theme: isDark ? 'dracula' : 'default',
        lineNumbers: false,
        lineWrapping: true,
        viewportMargin: Infinity,
        extraKeys: {
          'Shift-Enter': () => commitMdEdit(),
          'Esc': () => cancelMdEdit(),
        }
      });
      const editId = NB_EDITING_MD;
      _nbMdCM.on('change', () => {
        const cell = NB_CELLS.find(c => c.id === editId);
        if(cell){ cell.source = _nbMdCM.getValue(); scheduleNBSave(); }
      });
      setTimeout(() => _nbMdCM?.focus(), 50);
    }
  }
}

function highlightSelected(){
  document.querySelectorAll('.cb-cell').forEach(el => {
    el.classList.toggle('cb-selected', el.dataset.cellid === NB_SELECTED);
  });
}

// ── 셀 찾기 ──
function findCellIdx(cellId){ return NB_CELLS.findIndex(c => c.id === cellId); }
function cellSource(cellId){
  const cm = _nbCMs[cellId];
  if(cm) return cm.getValue();
  const ta = document.getElementById(`cb-code-${cellId}`);
  return ta?.value ?? NB_CELLS.find(c => c.id === cellId)?.source ?? '';
}

// ── input() 호출 감지 (주석/문자열 제외) ──
function countInputCalls(code){
  const stripped = (code || '')
    .replace(/#.*$/gm, '')             // 주석 제거
    .replace(/'''[\s\S]*?'''/g, "''")  // 세 작은따옴표 문자열
    .replace(/"""[\s\S]*?"""/g, '""')  // 세 큰따옴표 문자열
    .replace(/'[^'\n]*'/g, "''")       // 작은따옴표 문자열
    .replace(/"[^"\n]*"/g, '""');      // 큰따옴표 문자열
  const matches = stripped.match(/\binput\s*\(/g);
  return matches?.length || 0;
}

// ── 입력값 팝업 (Colab 스타일) ──
function promptForInputs(cellId, count, existingStdin){
  return new Promise(resolve => {
    const cellDiv = document.querySelector(`.cb-cell[data-cellid="${cellId}"]`);
    if(!cellDiv){ resolve(existingStdin || ''); return; }
    // 기존 팝업 제거
    cellDiv.querySelector('.cb-input-prompt')?.remove();

    const div = document.createElement('div');
    div.className = 'cb-input-prompt';
    div.innerHTML = `
      <div class="cb-ip-header">
        💬 이 셀은 <b>input()</b> 을 ${count}번 호출합니다. 입력할 값을 한 줄씩 넣어주세요:
      </div>
      <textarea class="cb-ip-area" rows="${Math.min(Math.max(count, 2), 6)}" placeholder="한 줄에 하나씩..." spellcheck="false">${esc(existingStdin || '')}</textarea>
      <div class="cb-ip-actions">
        <button class="cb-ip-run btn-p btn-sm">▶ 실행</button>
        <button class="cb-ip-cancel btn-sm">취소</button>
        <span class="cb-ip-hint">💡 Ctrl+Enter 로 실행 · Esc로 취소</span>
      </div>
    `;
    cellDiv.appendChild(div);

    const ta = div.querySelector('.cb-ip-area');
    const runBtn = div.querySelector('.cb-ip-run');
    const cancelBtn = div.querySelector('.cb-ip-cancel');

    // 포커스 + 커서 맨 끝
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 50);

    const submit = () => {
      const val = ta.value;
      // stdin textarea에도 반영 (다음에 재사용 가능)
      const stdinEl = document.getElementById(`cb-stdin-${cellId}`);
      if(stdinEl){
        stdinEl.value = val;
        // stdin details 펼쳐서 사용자가 값을 볼 수 있게
        const det = stdinEl.closest('details');
        if(det) det.open = true;
      }
      div.remove();
      resolve(val);
    };
    const cancel = () => { div.remove(); resolve(null); };

    runBtn.addEventListener('click', submit);
    cancelBtn.addEventListener('click', cancel);
    ta.addEventListener('keydown', e => {
      if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); submit(); }
      else if(e.key === 'Escape'){ e.preventDefault(); cancel(); }
    });
  });
}

// ── 셀 실행 ──
async function runCell(cellId){
  const cell = NB_CELLS.find(c => c.id === cellId);
  if(!cell || cell.type !== 'code') return;
  const code = cellSource(cellId);
  cell.source = code; // sync

  // 기존 stdin textarea 값
  let stdin = document.getElementById(`cb-stdin-${cellId}`)?.value || '';
  const stdinLines = stdin ? stdin.split('\n').filter(l => l.length > 0).length : 0;

  // input() 사용 감지 → 부족하면 팝업으로 받기
  const needed = countInputCalls(code);
  if(needed > 0 && stdinLines < needed){
    const result = await promptForInputs(cellId, needed, stdin);
    if(result === null) return; // 사용자가 취소
    stdin = result;
  }

  NB_CELL_OUTPUTS[cellId] = {running: true};
  updateCellOutputDom(cellId);

  const result = await runNBPython(code, stdin);
  NB_EXEC_COUNT++;
  NB_CELL_OUTPUTS[cellId] = {...result, execCount: NB_EXEC_COUNT, running: false};
  updateCellOutputDom(cellId);
}

async function runCellAndNext(cellId){
  await runCell(cellId);
  const idx = findCellIdx(cellId);
  // 다음 코드 셀로 이동 (없으면 새로 추가)
  let nextIdx = -1;
  for(let i = idx + 1; i < NB_CELLS.length; i++){
    if(NB_CELLS[i].type === 'code'){ nextIdx = i; break; }
  }
  if(nextIdx === -1){
    // 맨 아래 새 코드 셀 추가
    addCell(NB_CELLS.length, 'code', true);
    return;
  }
  NB_SELECTED = NB_CELLS[nextIdx].id;
  highlightSelected();
  const cm = _nbCMs[NB_SELECTED];
  cm?.focus();
}

async function runCellAndInsert(cellId){
  await runCell(cellId);
  const idx = findCellIdx(cellId);
  addCell(idx + 1, 'code', true);
}

async function runAll(){
  for(const cell of [...NB_CELLS]){
    if(cell.type === 'code') await runCell(cell.id);
  }
}

// ── 셀 추가/삭제/이동/복제 ──
function addCell(pos, type, focus){
  const newCell = {
    id: 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    type,
    source: type === 'markdown' ? '' : ''
  };
  NB_CELLS.splice(pos, 0, newCell);
  NB_SELECTED = newCell.id;
  if(type === 'markdown') NB_EDITING_MD = newCell.id;
  destroyAllCMs();
  render();
  scheduleNBSave();
  if(focus){
    setTimeout(() => {
      if(type === 'code') _nbCMs[newCell.id]?.focus();
      else _nbMdCM?.focus();
    }, 80);
  }
}

function deleteCell(cellId){
  const idx = findCellIdx(cellId);
  if(idx === -1) return;
  NB_CELLS.splice(idx, 1);
  delete NB_CELL_OUTPUTS[cellId];
  NB_SELECTED = NB_CELLS[idx]?.id || NB_CELLS[idx-1]?.id || null;
  destroyAllCMs();
  render();
  scheduleNBSave();
}

function moveCell(cellId, dir){
  const idx = findCellIdx(cellId);
  const newIdx = idx + dir;
  if(idx === -1 || newIdx < 0 || newIdx >= NB_CELLS.length) return;
  const [cell] = NB_CELLS.splice(idx, 1);
  NB_CELLS.splice(newIdx, 0, cell);
  destroyAllCMs();
  render();
  scheduleNBSave();
}

function copyCell(cellId){
  const idx = findCellIdx(cellId);
  if(idx === -1) return;
  const orig = NB_CELLS[idx];
  const clone = {
    id: 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    type: orig.type,
    source: cellSource(cellId) || orig.source
  };
  if(orig.type === 'code') clone.source = cellSource(cellId);
  NB_CELLS.splice(idx + 1, 0, clone);
  NB_SELECTED = clone.id;
  destroyAllCMs();
  render();
  scheduleNBSave();
}

// 원본으로 복원
async function resetToOriginal(){
  if(!SEL_NOTEBOOK || !ST_USER || !SEL_CLS) return;
  if(!confirm('선생님이 올린 원본 노트북으로 되돌릴까요?\n지금까지 작성한 내용이 삭제됩니다.')) return;
  try {
    await deleteNotebookProgress(SEL_CLS.id, SEL_NOTEBOOK.id, ST_USER.number);
  } catch(e){ console.warn(e); }
  NB_CELLS = (SEL_NOTEBOOK.cells || []).map((c, idx) => ({
    id: c.id || `cell-${idx}-${Math.random().toString(36).slice(2,8)}`,
    type: c.type || c.cell_type || 'code',
    source: c.source || ''
  }));
  NB_CELL_OUTPUTS = {};
  NB_SELECTED = NB_CELLS[0]?.id || null;
  NB_EDITING_MD = null;
  destroyAllCMs();
  render();
  setNBSaveStatus('saved');
  toast('원본으로 복원됐습니다.', 'ok');
}

// ── 셀 출력 영역만 갱신 (전체 리렌더 피함) ──
function updateCellOutputDom(cellId){
  const cellDiv = document.querySelector(`.cb-cell[data-cellid="${cellId}"]`);
  if(!cellDiv) return;
  const result = NB_CELL_OUTPUTS[cellId];

  // 실행 프롬프트 갱신
  const promptEl = cellDiv.querySelector('.cb-exec-prompt');
  if(promptEl){
    if(result?.running) promptEl.textContent = '[*]';
    else if(result?.execCount) promptEl.textContent = `[${result.execCount}]`;
    else promptEl.textContent = '[ ]';
  }

  // 출력 영역 갱신
  let outDiv = cellDiv.querySelector('.cb-output');
  if(!result){ outDiv?.remove(); return; }

  if(result.running){
    if(!outDiv){
      outDiv = document.createElement('div');
      outDiv.className = 'cb-output';
      cellDiv.appendChild(outDiv);
    }
    outDiv.className = 'cb-output';
    outDiv.innerHTML = `<pre style="color:#999;font-style:italic">⏳ 실행 중...</pre>`;
    return;
  }

  const html = vNbOutput(result);
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const newOut = tmp.firstChild;
  if(outDiv) outDiv.replaceWith(newOut);
  else cellDiv.appendChild(newOut);
}

// ── 마크다운 편집 모드 ──
function startMdEdit(cellId){
  NB_EDITING_MD = cellId;
  NB_SELECTED = cellId;
  destroyAllCMs();
  render();
}
function commitMdEdit(){
  if(_nbMdCM){
    const val = _nbMdCM.getValue();
    const cell = NB_CELLS.find(c => c.id === NB_EDITING_MD);
    if(cell) cell.source = val;
  }
  NB_EDITING_MD = null;
  destroyAllCMs();
  render();
}
function cancelMdEdit(){
  NB_EDITING_MD = null;
  destroyAllCMs();
  render();
}

// ── 이벤트 위임 ──
document.addEventListener('click', async e => {
  const t = e.target;

  // 노트북 업로드 (선생님)
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

  // 노트북 열기
  if(act.action === 'open-notebook'){ await openNotebook(act.nid); return; }
  // 노트북 목록으로
  if(act.action === 'nb-close'){ closeNotebook(); return; }
  // 노트북 삭제 (선생님)
  if(act.action === 'del-notebook'){
    if(!confirm(`"${act.ntitle}" 노트북을 삭제할까요?`)) return;
    const cid = TC_CLS?.id; if(!cid) return;
    el.disabled = true;
    await db.ref(`notebooks/${cid}/${act.nid}`).remove();
    await loadNotebooks(cid); render();
    return;
  }

  // 셀 실행
  if(act.action === 'nb-run-cell'){ runCell(act.cellid); return; }
  if(act.action === 'nb-run-all'){
    el.textContent = '⏳ 실행 중...'; el.disabled = true;
    await runAll();
    el.textContent = '▶▶ 모두 실행'; el.disabled = false;
    return;
  }
  if(act.action === 'nb-reset-all'){
    if(!confirm('런타임을 재시작할까요? 선언한 모든 변수가 사라집니다.')) return;
    el.textContent = '⏳'; el.disabled = true;
    await resetNBWorker();
    NB_CELL_OUTPUTS = {};
    NB_EXEC_COUNT = 0;
    el.textContent = '🔄 재시작'; el.disabled = false;
    toast('런타임이 재시작됐습니다.', 'ok');
    render();
    return;
  }

  // 셀 추가
  if(act.action === 'nb-add-cell'){ addCell(parseInt(act.pos), act.type, true); return; }
  // 셀 삭제
  if(act.action === 'nb-delete'){ deleteCell(act.cellid); return; }
  // 셀 이동
  if(act.action === 'nb-move-up'){ moveCell(act.cellid, -1); return; }
  if(act.action === 'nb-move-down'){ moveCell(act.cellid, 1); return; }
  // 셀 복제
  if(act.action === 'nb-copy'){ copyCell(act.cellid); return; }
  // 마크다운 편집 버튼 (툴바)
  if(act.action === 'nb-md-edit-btn'){ startMdEdit(act.cellid); return; }

  // 원본 복원 (학생)
  if(act.action === 'nb-reset-original'){ await resetToOriginal(); return; }

  // 학생 진도 패널 열기 (선생님)
  if(act.action === 'nb-show-progress'){
    if(!TC_CLS || !SEL_NOTEBOOK) return;
    el.textContent = '⏳'; el.disabled = true;
    try {
      NB_PROGRESS_MAP = await loadAllNotebookProgress(TC_CLS.id, SEL_NOTEBOOK.id);
    } catch(e){ toast('진도 로드 실패: ' + e.message, 'err'); el.disabled = false; return; }
    NB_SHOW_PROGRESS = true;
    destroyAllCMs();
    render();
    return;
  }
  // 패널 닫기
  if(act.action === 'nb-hide-progress'){
    NB_SHOW_PROGRESS = false;
    destroyAllCMs();
    render();
    return;
  }

  // 특정 학생 진도 보기
  if(act.action === 'nb-view-student'){
    const snum = act.snum;
    const prog = NB_PROGRESS_MAP[snum];
    if(!prog || !Array.isArray(prog.cells)){ toast('진도 데이터가 없습니다.', 'err'); return; }
    NB_VIEWING_STUDENT = snum;
    NB_SHOW_PROGRESS = false;
    NB_CELLS = prog.cells.map((c, idx) => ({
      id: c.id || `cell-${idx}-${Math.random().toString(36).slice(2,8)}`,
      type: c.type || 'code',
      source: c.source || ''
    }));
    NB_CELL_OUTPUTS = {};
    NB_SELECTED = NB_CELLS[0]?.id || null;
    NB_EDITING_MD = null;
    destroyAllCMs();
    await resetNBWorker().catch(() => {});
    render();
    return;
  }

  // 학생 진도 보기 종료 → 원본으로
  if(act.action === 'nb-exit-viewing'){
    NB_VIEWING_STUDENT = null;
    NB_CELLS = (SEL_NOTEBOOK.cells || []).map((c, idx) => ({
      id: c.id || `cell-${idx}-${Math.random().toString(36).slice(2,8)}`,
      type: c.type || c.cell_type || 'code',
      source: c.source || ''
    }));
    NB_CELL_OUTPUTS = {};
    NB_SELECTED = NB_CELLS[0]?.id || null;
    destroyAllCMs();
    render();
    return;
  }

  // 마크다운 편집 시작 (더블클릭 대신 클릭도 허용 안 함 → dblclick만)
  // (dblclick 이벤트에서 처리)
});

// 마크다운 더블클릭 → 편집 모드
document.addEventListener('dblclick', e => {
  const md = e.target.closest?.('.cb-md-render');
  if(md) startMdEdit(md.dataset.cellid);
});

// 셀 클릭 시 선택 표시
document.addEventListener('click', e => {
  const cell = e.target.closest?.('.cb-cell');
  if(!cell) return;
  const id = cell.dataset.cellid;
  if(NB_SELECTED !== id){
    NB_SELECTED = id;
    highlightSelected();
  }
});

// ── 전역 단축키 (노트북 화면에서만) ──
document.addEventListener('keydown', e => {
  // 마크다운 textarea에서 Shift+Enter / Esc
  if(e.target.classList?.contains('cb-md-area')){
    if(e.key === 'Enter' && e.shiftKey){ e.preventDefault(); commitMdEdit(); return; }
    if(e.key === 'Escape'){ e.preventDefault(); cancelMdEdit(); return; }
  }
});
