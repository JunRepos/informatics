/* ═══════════════════════════════════════
   views/notebook.js — 노트북(Colab 스타일)

   레이아웃:
   - 상단 툴바: 제목 + 모두 실행/재시작
   - 셀 목록: 번호/실행카운트/툴바/에디터/출력
   - 셀 사이: + 코드 / + 텍스트 추가 버튼
═══════════════════════════════════════ */

// ── 선생님: 노트북 관리 ──
function vTcNotebook(){
  const form = `<div class="section">
    <div class="sec-title">📓 노트북 업로드</div>
    <div class="box-info">Google Colab 또는 Jupyter .ipynb 파일을 업로드하면 학생들이 웹에서 단계적으로 실습할 수 있습니다.</div>
    <div class="form">
      <div class="field"><label>제목 (비워두면 파일명 사용)</label><input id="nb-title" type="text" placeholder="예: 2차시 - 사칙연산 계산기 만들기"/></div>
      <div class="field"><label>ipynb 파일 (여러 개 가능)</label><input id="nb-file" type="file" accept=".ipynb" multiple/></div>
      ${multiClassPicker('nb', TC_CLS?.id)}
      <div id="nb-err" class="err"></div>
      <div id="nb-prog" style="display:none;font-size:12px;color:var(--text2)"></div>
      <button id="nb-upload" class="btn-p btn-sm">업로드</button>
    </div>
  </div>`;

  // 선생님도 미리보기 가능
  if(SEL_NOTEBOOK) return vNotebookDetail(true);

  const list = !NOTEBOOKS.length ? emptyBox('📓','등록된 노트북이 없습니다.') : NOTEBOOKS.map(nb => `
    <div class="list-row click" data-action="open-notebook" data-nid="${nb.id}">
      <div class="row-icon">📓</div>
      <div class="row-info">
        <div class="row-title">${esc(nb.title)}</div>
        <div class="row-meta">${nb.cells?.length || 0}개 셀 · ${fmtDt(nb.createdAt)}</div>
      </div>
      <div class="row-right">
        <button class="btn-xs btn-danger" data-action="del-notebook" data-nid="${nb.id}" data-ntitle="${esc(nb.title)}">삭제</button>
      </div>
    </div>`).join('');

  return form + `<div class="sec-title" style="margin-top:4px">등록된 노트북</div>` + list;
}

// ── 학생: 노트북 목록/상세 ──
function vStNotebook(){
  if(SEL_NOTEBOOK) return vNotebookDetail(false);
  if(!NOTEBOOKS.length) return emptyBox('📓','선생님이 올린 노트북이 없습니다.');
  return NOTEBOOKS.map(nb => `
    <div class="list-row click" data-action="open-notebook" data-nid="${nb.id}">
      <div class="row-icon">📓</div>
      <div class="row-info">
        <div class="row-title">${esc(nb.title)}</div>
        <div class="row-meta">${nb.cells?.length || 0}개 셀</div>
      </div>
      <div class="row-right"><span class="chip chip-purple">시작 →</span></div>
    </div>`).join('');
}

// ── 노트북 상세 (Colab 스타일) ──
function vNotebookDetail(isTeacher){
  const nb = SEL_NOTEBOOK;
  if(!nb) return emptyBox('❌','노트북을 찾을 수 없습니다.');

  const toolbar = `<div class="cb-toolbar">
    <button class="cb-back-btn" data-action="nb-close">← 목록</button>
    <div class="cb-title">📓 ${esc(nb.title)}</div>
    <div class="cb-toolbar-actions">
      <button class="cb-tb-btn" data-action="nb-run-all" title="모두 실행">▶▶ 모두 실행</button>
      <button class="cb-tb-btn" data-action="nb-reset-all" title="런타임 재시작 (변수 초기화)">🔄 재시작</button>
    </div>
  </div>`;

  const cellsHtml = (NB_CELLS || []).map((cell, idx) => vNbCell(cell, idx)).join('');

  // 맨 아래 셀 추가 버튼
  const addEndRow = `<div class="cb-add-row cb-add-row-end">
    <button class="cb-add-btn" data-action="nb-add-cell" data-type="code" data-pos="${NB_CELLS.length}">+ 코드</button>
    <button class="cb-add-btn" data-action="nb-add-cell" data-type="markdown" data-pos="${NB_CELLS.length}">+ 텍스트</button>
  </div>`;

  return `
    <div class="cb-wrap">
      ${toolbar}
      <div class="cb-cells" id="cb-cells">${cellsHtml || ''}</div>
      ${addEndRow}
    </div>`;
}

// ── 셀 한 개 렌더 ──
function vNbCell(cell, idx){
  const selected = NB_SELECTED === cell.id ? ' cb-selected' : '';
  const isMd = cell.type === 'markdown';
  const isEditingMd = isMd && NB_EDITING_MD === cell.id;

  // 셀 사이 + 버튼
  const addRow = `<div class="cb-add-row">
    <button class="cb-add-btn" data-action="nb-add-cell" data-type="code" data-pos="${idx}">+ 코드</button>
    <button class="cb-add-btn" data-action="nb-add-cell" data-type="markdown" data-pos="${idx}">+ 텍스트</button>
  </div>`;

  // 셀 호버 툴바
  const hoverTb = `<div class="cb-cell-actions">
    ${!isMd ? `<button class="cb-act-btn" data-action="nb-run-cell" data-cellid="${cell.id}" title="실행 (Ctrl+Enter)">▶</button>` : ''}
    <button class="cb-act-btn" data-action="nb-move-up" data-cellid="${cell.id}" title="위로">↑</button>
    <button class="cb-act-btn" data-action="nb-move-down" data-cellid="${cell.id}" title="아래로">↓</button>
    <button class="cb-act-btn" data-action="nb-copy" data-cellid="${cell.id}" title="복제">⧉</button>
    <button class="cb-act-btn cb-act-del" data-action="nb-delete" data-cellid="${cell.id}" title="삭제">🗑</button>
  </div>`;

  let body = '';
  if(isMd){
    if(isEditingMd){
      body = `<div class="cb-md-editor">
        <textarea class="cb-md-area" data-cellid="${cell.id}" spellcheck="false">${esc(cell.source || '')}</textarea>
        <div style="font-size:11px;color:var(--text3);padding:4px 8px">💡 Shift+Enter 로 렌더링 완료 · Esc로 취소</div>
      </div>`;
    } else {
      const html = typeof marked !== 'undefined' ? marked.parse(cell.source || '') : esc(cell.source || '');
      body = `<div class="cb-md-render" data-cellid="${cell.id}" title="더블클릭하여 편집">${html || '<div style="color:var(--cb-text-3);font-style:italic">(빈 텍스트 셀 — 더블클릭해서 편집)</div>'}</div>`;
    }
    return addRow + `<div class="cb-cell cb-cell-md${selected}" data-cellid="${cell.id}">
      ${hoverTb}
      ${body}
    </div>`;
  }

  // 코드 셀
  const result = NB_CELL_OUTPUTS[cell.id];
  const execLabel = result?.running ? '[*]' : (result?.execCount ? `[${result.execCount}]` : '[ ]');
  const outputHtml = result && !result.running ? vNbOutput(result) : (result?.running ? `<div class="cb-output"><pre style="color:#999;font-style:italic">⏳ 실행 중...</pre></div>` : '');

  return addRow + `<div class="cb-cell cb-cell-code${selected}" data-cellid="${cell.id}">
    ${hoverTb}
    <div class="cb-code-wrap">
      <div class="cb-exec-prompt">${execLabel}</div>
      <div class="cb-code-main">
        <textarea class="cb-code-area" id="cb-code-${cell.id}" data-cellid="${cell.id}" spellcheck="false">${esc(cell.source || '')}</textarea>
      </div>
    </div>
    <details class="cb-stdin-wrap">
      <summary class="cb-stdin-summary">💬 입력 (input()에 전달할 값)</summary>
      <textarea class="cb-stdin-area" id="cb-stdin-${cell.id}" placeholder="한 줄에 하나씩..." spellcheck="false"></textarea>
    </details>
    ${outputHtml}
  </div>`;
}

function vNbOutput(result){
  let html = '';
  if(result.output) html += `<pre class="cb-out-text">${esc(result.output)}</pre>`;
  if(result.images && result.images.length){
    html += result.images.map(b64 => `<img class="cb-out-img" src="data:image/png;base64,${b64}"/>`).join('');
  }
  if(result.error) html += `<pre class="cb-out-err">${esc(result.error)}</pre>`;
  if(!html && result.success) html = `<pre style="color:var(--text3);font-style:italic;margin:0">(출력 없음)</pre>`;
  return `<div class="cb-output${result.error ? ' cb-has-error' : ''}">${html}</div>`;
}
