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

// ── stdin 공유 메모리 (worker와 SharedArrayBuffer로 통신) ──
const _STDIN_BUF_SIZE = 4096;
let _nbStdinSAB = null;
let _nbStdinCtrl = null;   // Int32Array(2) — [status, length]
let _nbStdinData = null;   // Uint8Array
let _nbStdinSupported = false;
let _nbAwaitingInput = null; // {cellId, resolve} — 현재 대기 중인 입력 요청

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
      const data = e.data;
      // 입력 요청 (Python input() 호출)
      if(data.type === 'request-input'){
        handleInputRequest(data.cellId, data.prompt);
        return;
      }
      // stdin 초기화 응답
      if(data.type === 'init-stdin-done'){
        _nbStdinSupported = !!data.supported;
        return;
      }
      const cb = _nbCallbacks[data.id];
      if(cb){ delete _nbCallbacks[data.id]; cb(data); }
    };
    _nbWorker.onerror = (err) => console.error('Notebook worker error:', err);

    // stdin SharedArrayBuffer 셋업 (가능하면)
    initStdinSAB();
  }
  return _nbWorker;
}

// ── stdin SharedArrayBuffer 초기화 ──
function initStdinSAB(){
  if(typeof SharedArrayBuffer === 'undefined'){
    console.warn('[noteebook] SharedArrayBuffer 미지원 — input() 폴백 모드');
    return;
  }
  if(!self.crossOriginIsolated){
    console.warn('[notebook] crossOriginIsolated=false — coi-serviceworker가 아직 활성화 안 됨');
    return;
  }
  try {
    _nbStdinSAB = new SharedArrayBuffer(8 + _STDIN_BUF_SIZE);
    _nbStdinCtrl = new Int32Array(_nbStdinSAB, 0, 2);
    _nbStdinData = new Uint8Array(_nbStdinSAB, 8, _STDIN_BUF_SIZE);
    _nbWorker.postMessage({type: 'init-stdin', buffer: _nbStdinSAB});
  } catch(err){
    console.warn('[notebook] stdin SAB 초기화 실패:', err);
  }
}

// ── 입력 요청 처리 (worker → 메인) ──
async function handleInputRequest(cellId, prompt){
  // 현재 대기 중인 게 있으면 무시 (방어적)
  if(_nbAwaitingInput){
    submitInputResponse(null); // 기존 것 abort
  }

  const value = await showInlineInputPrompt(cellId, prompt);
  submitInputResponse(value);
}

// 사용자 응답을 SharedArrayBuffer 에 쓰고 worker 깨우기
function submitInputResponse(value){
  if(!_nbStdinCtrl || !_nbStdinData) return;
  if(value === null){
    Atomics.store(_nbStdinCtrl, 0, 2); // abort
    Atomics.store(_nbStdinCtrl, 1, 0);
  } else {
    const bytes = new TextEncoder().encode(String(value));
    const len = Math.min(bytes.length, _STDIN_BUF_SIZE);
    _nbStdinData.set(bytes.subarray(0, len));
    Atomics.store(_nbStdinCtrl, 1, len);
    Atomics.store(_nbStdinCtrl, 0, 1); // ready
  }
  Atomics.notify(_nbStdinCtrl, 0);
  _nbAwaitingInput = null;
}

// ── 인라인 입력 프롬프트 (Colab 스타일, 셀 안에 표시) ──
function showInlineInputPrompt(cellId, prompt){
  return new Promise(resolve => {
    _nbAwaitingInput = {cellId, resolve};

    const cellDiv = document.querySelector(`.cb-cell[data-cellid="${cellId}"]`);
    if(!cellDiv){ resolve(''); return; }
    // 기존 프롬프트 제거 (혹시 남아있다면)
    cellDiv.querySelectorAll('.cb-input-prompt').forEach(el => el.remove());

    // 출력 박스 안 하단에 끼워넣기 (없으면 셀 끝에)
    const outDiv = cellDiv.querySelector('.cb-output');
    const outBody = outDiv?.querySelector('.cb-out-body');

    const div = document.createElement('div');
    div.className = 'cb-input-prompt';
    const label = prompt
      ? `<span style="color:var(--cb-text);font-weight:500">${esc(prompt)}</span>`
      : `<span style="color:var(--cb-text-2)">📝 input() 입력 대기 중...</span>`;
    div.innerHTML = `
      <div class="cb-ip-header">${label}</div>
      <div class="cb-ip-row">
        <input class="cb-ip-input" type="text" placeholder="값을 입력하고 Enter" spellcheck="false" autocomplete="off"/>
        <button class="cb-ip-run btn-p btn-sm">↵ 입력</button>
      </div>
      <div class="cb-ip-hint" style="margin-top:4px">Enter로 제출 · Esc로 취소</div>
    `;
    if(outBody) outBody.appendChild(div);
    else cellDiv.appendChild(div);

    const input = div.querySelector('.cb-ip-input');
    const runBtn = div.querySelector('.cb-ip-run');

    setTimeout(() => input.focus(), 30);

    const submit = () => {
      const val = input.value;
      div.remove();
      // 사용자가 입력한 값을 출력 영역에 보존 (어떤 값을 넣었는지 보임)
      if(outBody){
        const echo = document.createElement('div');
        echo.className = 'cb-input-echo';
        echo.textContent = (prompt ? prompt : '') + val;
        outBody.appendChild(echo);
      }
      resolve(val);
    };
    const cancel = () => {
      div.remove();
      resolve(null);
    };

    runBtn.addEventListener('click', submit);
    input.addEventListener('keydown', e => {
      if(e.key === 'Enter'){ e.preventDefault(); submit(); }
      else if(e.key === 'Escape'){ e.preventDefault(); cancel(); }
    });
  });
}

function runNBPython(code, stdin, cellId){
  return new Promise(resolve => {
    const id = ++_nbMsgId;
    // input() 대기 중일 수 있으므로 타임아웃 길게(5분), 진짜 무한 루프 방지용
    const timer = setTimeout(() => {
      delete _nbCallbacks[id];
      // worker가 input 대기 중이면 abort 신호
      if(_nbAwaitingInput) submitInputResponse(null);
      resolve({success: false, output: '', error: '시간 초과 (5분)', images: []});
    }, 300000);
    _nbCallbacks[id] = data => { clearTimeout(timer); resolve(data); };
    getNBWorker().postMessage({id, action: 'run', code, stdin, cellId});
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
    let source = Array.isArray(c.source) ? c.source.join('') : (c.source || '');

    // attachment: 참조를 data URL로 변환 (Jupyter 일부 형식)
    if(c.attachments && typeof c.attachments === 'object'){
      for(const [name, mediaMap] of Object.entries(c.attachments)){
        if(!mediaMap || typeof mediaMap !== 'object') continue;
        const entries = Object.entries(mediaMap);
        if(!entries.length) continue;
        const [mime, b64] = entries[0];
        if(mime && b64){
          const clean = String(b64).replace(/\s+/g, '');
          const dataUrl = `data:${mime};base64,${clean}`;
          source = source.split(`attachment:${name}`).join(dataUrl);
        }
      }
    }

    const type = c.cell_type === 'code' ? 'code' : 'markdown';
    const id = c.metadata?.id || `cell-${idx}-${Math.random().toString(36).slice(2,8)}`;
    return {id, type, source};
  });
}

// 셀 배열의 총 바이트 수 추정 (업로드 경고용)
function estimateCellsSize(cells){
  try {
    return new Blob([JSON.stringify(cells)]).size;
  } catch { return 0; }
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
  // 입력 대기 중이면 abort (worker hang 방지)
  if(_nbAwaitingInput) submitInputResponse(null);
  // 표시 중이던 입력 프롬프트 제거
  document.querySelectorAll('.cb-input-prompt').forEach(el => el.remove());
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

    // 기존 CM이 DOM에 아직 연결되어 있으면 skip, 아니면 제거
    const existing = _nbCMs[cellId];
    if(existing){
      try {
        const wrap = existing.getWrapperElement?.();
        if(wrap && wrap.isConnected) return; // 아직 유효함
      } catch(e){}
      delete _nbCMs[cellId]; // stale
    }

    // 이미 CM이 이 textarea 위에 생성되어 있다면 skip (fromTextArea 두 번 호출 방지)
    if(ta.nextSibling && ta.nextSibling.classList?.contains('CodeMirror')) return;

    let cm;
    try {
      cm = CodeMirror.fromTextArea(ta, {
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
    } catch(e){ console.error('CodeMirror 초기화 실패:', cellId, e); return; }

    // 크기 재계산 보장 (DOM 레이아웃 후 한 번 refresh)
    setTimeout(() => { try { cm.refresh(); } catch(e){} }, 0);

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

// ── 셀 실행 ──
//   진짜 input() 모드: stdin 인자는 빈 값이거나 batch 테스트용 미리 입력
//   input() 호출 시 worker가 메인에 request-input 메시지를 보냄 → showInlineInputPrompt 처리
async function runCell(cellId){
  const cell = NB_CELLS.find(c => c.id === cellId);
  if(!cell || cell.type !== 'code') return;
  const code = cellSource(cellId);
  cell.source = code; // sync

  NB_CELL_OUTPUTS[cellId] = {running: true};
  updateCellOutputDom(cellId);

  const startedAt = performance.now();
  const result = await runNBPython(code, '', cellId);
  const elapsedMs = performance.now() - startedAt;
  NB_EXEC_COUNT++;
  NB_CELL_OUTPUTS[cellId] = {...result, execCount: NB_EXEC_COUNT, elapsedMs, running: false};
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
      cellDiv.appendChild(outDiv);
    }
    outDiv.outerHTML = `<div class="cb-output cb-out-running" data-cellid="${cellId}"><div class="cb-out-header"><span class="cb-out-prompt">Out [*]:</span><span class="cb-out-time">⏱ 실행 중</span></div><div class="cb-out-body"><pre style="color:#999;font-style:italic;margin:0;padding:0 12px">⏳ 실행 중...</pre></div></div>`;
    return;
  }

  const html = vNbOutput(result, cellId);
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

        // 크기 체크 (Firebase 16MB 제한)
        const size = estimateCellsSize(cells);
        const sizeMB = (size / 1024 / 1024).toFixed(1);
        if(size > 14 * 1024 * 1024){
          errEl.textContent = `"${file.name}" 이 너무 큽니다 (${sizeMB}MB). 이미지 크기를 줄이거나 분할해주세요. (최대 14MB)`;
          continue;
        }
        if(size > 5 * 1024 * 1024){
          if(!confirm(`"${file.name}" 크기: ${sizeMB}MB\n큰 이미지가 포함된 것 같습니다. 업로드/로딩이 느릴 수 있어요. 계속할까요?`)){
            continue;
          }
        }

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
    NB_OPEN_MENU = null;
    if(el.classList.contains('cb-menu-item')){
      // 메뉴에서 호출 — 즉시 메뉴 닫고 실행
      closeNbMenu();
      runAll().then(() => toast('모두 실행 완료', 'ok'));
    } else {
      el.textContent = '⏳ 실행 중...'; el.disabled = true;
      await runAll();
      el.textContent = '▶▶ 모두 실행'; el.disabled = false;
    }
    return;
  }
  if(act.action === 'nb-reset-all'){
    closeNbMenu();
    if(!confirm('런타임을 재시작할까요? 선언한 모든 변수가 사라집니다.')) return;
    el.textContent = '⏳'; el.disabled = true;
    // 입력 대기 중이면 먼저 abort (worker hang 방지)
    if(_nbAwaitingInput) submitInputResponse(null);
    document.querySelectorAll('.cb-input-prompt').forEach(el => el.remove());
    await resetNBWorker();
    NB_CELL_OUTPUTS = {};
    NB_EXEC_COUNT = 0;
    el.textContent = '🔄 재시작'; el.disabled = false;
    toast('런타임이 재시작됐습니다.', 'ok');
    render();
    return;
  }
  if(act.action === 'nb-reset-and-run-all'){
    closeNbMenu();
    if(!confirm('런타임을 재시작 후 모든 셀을 실행할까요?')) return;
    if(_nbAwaitingInput) submitInputResponse(null);
    document.querySelectorAll('.cb-input-prompt').forEach(el => el.remove());
    await resetNBWorker();
    NB_CELL_OUTPUTS = {};
    NB_EXEC_COUNT = 0;
    render();
    setTimeout(() => runAll().then(() => toast('재시작 후 모두 실행 완료', 'ok')), 50);
    return;
  }

  // ── 메뉴바 ──
  if(act.action === 'nb-toggle-menu'){
    const id = act.menuid;
    NB_OPEN_MENU = (NB_OPEN_MENU === id) ? null : id;
    refreshMenubar();
    return;
  }
  if(act.action === 'nb-toggle-sidebar'){
    closeNbMenu();
    NB_SIDEBAR_OPEN = !NB_SIDEBAR_OPEN;
    destroyAllCMs(); render();
    return;
  }
  if(act.action === 'nb-toggle-theme'){
    closeNbMenu();
    if(typeof toggleTheme === 'function') toggleTheme();
    // CodeMirror 테마도 갱신해야 함 → 재렌더
    destroyAllCMs(); render();
    return;
  }
  if(act.action === 'nb-insert-code'){
    closeNbMenu();
    // 선택된 셀 다음에 삽입 (없으면 맨 아래)
    const selIdx = NB_SELECTED ? findCellIdx(NB_SELECTED) : -1;
    addCell(selIdx >= 0 ? selIdx + 1 : NB_CELLS.length, 'code', true);
    return;
  }
  if(act.action === 'nb-insert-text'){
    closeNbMenu();
    const selIdx = NB_SELECTED ? findCellIdx(NB_SELECTED) : -1;
    addCell(selIdx >= 0 ? selIdx + 1 : NB_CELLS.length, 'markdown', true);
    return;
  }
  if(act.action === 'nb-clear-outputs'){
    closeNbMenu();
    if(!confirm('모든 셀의 출력을 지울까요? (실행 결과만 삭제됩니다)')) return;
    NB_CELL_OUTPUTS = {};
    render();
    return;
  }
  if(act.action === 'nb-print'){
    closeNbMenu();
    window.print();
    return;
  }
  if(act.action === 'nb-download-ipynb'){
    closeNbMenu();
    downloadIpynb();
    return;
  }
  if(act.action === 'nb-show-shortcuts'){
    closeNbMenu();
    showNbShortcuts();
    return;
  }

  // 출력 접기/펴기
  if(act.action === 'nb-toggle-output'){
    const cid = act.cellid;
    if(NB_COLLAPSED_OUTPUTS[cid]) delete NB_COLLAPSED_OUTPUTS[cid];
    else NB_COLLAPSED_OUTPUTS[cid] = true;
    const out = document.querySelector(`.cb-output[data-cellid="${cid}"]`);
    if(out){
      out.classList.toggle('cb-out-collapsed');
      const btn = out.querySelector('.cb-out-toggle');
      if(btn){
        const collapsed = out.classList.contains('cb-out-collapsed');
        btn.textContent = collapsed ? '▸' : '▾';
        btn.title = collapsed ? '출력 펼치기' : '출력 접기';
      }
    }
    return;
  }

  // 목차 점프
  if(act.action === 'nb-toc-jump'){
    closeNbMenu();
    const cellEl = document.querySelector(`.cb-cell[data-cellid="${act.cellid}"]`);
    if(cellEl){
      cellEl.scrollIntoView({behavior: 'smooth', block: 'start'});
      cellEl.classList.add('cb-flash');
      setTimeout(() => cellEl.classList.remove('cb-flash'), 1200);
    }
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

  // 노트북 화면일 때만 작동
  if(!SEL_NOTEBOOK) return;

  // 사이드바 토글: Ctrl+/
  if((e.ctrlKey || e.metaKey) && e.key === '/'){
    e.preventDefault();
    NB_SIDEBAR_OPEN = !NB_SIDEBAR_OPEN;
    destroyAllCMs(); render();
    return;
  }
  // ipynb 다운로드: Ctrl+S
  if((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')){
    e.preventDefault();
    downloadIpynb();
    return;
  }
  // 메뉴 닫기: Esc (메뉴가 열려 있을 때)
  if(e.key === 'Escape' && NB_OPEN_MENU){
    closeNbMenu();
    return;
  }
});

// ── 메뉴바: 외부 클릭 시 닫기 ──
document.addEventListener('click', e => {
  if(!NB_OPEN_MENU) return;
  if(e.target.closest?.('.cb-menubar')) return; // 메뉴 내부 클릭은 통과
  closeNbMenu();
});

// ── 메뉴 헬퍼 ──
function closeNbMenu(){
  NB_OPEN_MENU = null;
  refreshMenubar();
}

function refreshMenubar(){
  // 메뉴바만 다시 렌더 (전체 render() 피해서 CodeMirror 상태 보존)
  const menubar = document.getElementById('cb-menubar');
  if(!menubar) return;
  if(typeof vNbMenubar === 'function'){
    const tmp = document.createElement('div');
    const isStudent = !!ST_USER && !IS_TC;
    tmp.innerHTML = vNbMenubar(IS_TC, isStudent);
    const newBar = tmp.firstElementChild;
    if(newBar) menubar.replaceWith(newBar);
  }
}

// ── ipynb 다운로드 ──
function downloadIpynb(){
  if(!SEL_NOTEBOOK) return;
  const ipynb = {
    cells: NB_CELLS.map(c => {
      const lines = (c.source || '').split('\n');
      const sourceArr = lines.map((l, i) => i < lines.length - 1 ? l + '\n' : l);
      if(c.type === 'code'){
        const result = NB_CELL_OUTPUTS[c.id];
        const outputs = [];
        if(result?.output){
          outputs.push({
            output_type: 'stream', name: 'stdout',
            text: result.output.split('\n').map((l, i, a) => i < a.length - 1 ? l + '\n' : l)
          });
        }
        if(result?.images?.length){
          for(const b64 of result.images){
            outputs.push({
              output_type: 'display_data',
              data: {'image/png': b64}, metadata: {}
            });
          }
        }
        if(result?.error){
          outputs.push({
            output_type: 'error', ename: 'Error', evalue: '',
            traceback: result.error.split('\n')
          });
        }
        return {
          cell_type: 'code', source: sourceArr,
          metadata: {id: c.id},
          execution_count: result?.execCount || null,
          outputs
        };
      }
      return {cell_type: 'markdown', source: sourceArr, metadata: {id: c.id}};
    }),
    metadata: {
      kernelspec: {display_name: 'Python 3', language: 'python', name: 'python3'},
      language_info: {name: 'python'}
    },
    nbformat: 4, nbformat_minor: 5
  };
  const blob = new Blob([JSON.stringify(ipynb, null, 1)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (SEL_NOTEBOOK.title || 'notebook') + '.ipynb';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('ipynb 다운로드 시작', 'ok');
}

// ── 단축키 모달 ──
function showNbShortcuts(){
  const lines = [
    ['Ctrl+Enter', '현재 셀 실행'],
    ['Shift+Enter', '실행 + 다음 셀로'],
    ['Alt+Enter', '실행 + 새 셀'],
    ['Ctrl+S', 'ipynb 로 다운로드'],
    ['Ctrl+/', '사이드바 토글'],
    ['Esc (마크다운 편집 중)', '편집 취소'],
    ['Shift+Enter (마크다운 편집 중)', '렌더링 완료'],
    ['더블클릭 (텍스트 셀)', '편집 모드'],
  ];
  const html = `
    <div class="modal-ov" onclick="closeModal()" style="display:flex;align-items:center;justify-content:center;padding:20px">
      <div onclick="event.stopPropagation()" style="background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:20px 22px;min-width:380px;max-width:520px;box-shadow:var(--sh)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div style="font-size:16px;font-weight:700">⌨️ 노트북 단축키</div>
          <button class="btn-sm" onclick="closeModal()">✕ 닫기</button>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          ${lines.map(([k, v]) => `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid var(--border)"><code style="background:var(--surface2);padding:2px 8px;border-radius:4px;font-family:Consolas,monospace">${esc(k)}</code></td>
              <td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text2)">${esc(v)}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    </div>`;
  document.getElementById('modal-root').innerHTML = html;
}
