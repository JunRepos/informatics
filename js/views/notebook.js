/* ═══════════════════════════════════════
   views/notebook.js — 노트북(Colab 스타일) 실습

   선생님: .ipynb 파일 업로드
   학생: 마크다운 셀 읽고 코드 셀 단계적 실행
═══════════════════════════════════════ */

// ── 선생님: 노트북 탭 ──
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

// ── 학생: 노트북 목록 ──
function vStNotebook(){
  if(SEL_NOTEBOOK) return vNotebookDetail();
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

// ── 노트북 상세 (셀 렌더링) ──
function vNotebookDetail(){
  const nb = SEL_NOTEBOOK;
  if(!nb || !nb.cells) return emptyBox('❌','노트북을 찾을 수 없습니다.');

  const cellsHtml = nb.cells.map((cell, idx) => {
    if(cell.type === 'markdown'){
      return vNbMarkdownCell(cell, idx);
    } else {
      return vNbCodeCell(cell, idx);
    }
  }).join('');

  return `
    <div class="back-btn" onclick="SEL_NOTEBOOK=null;render()">← 노트북 목록으로</div>
    <div class="nb-wrap">
      <div class="nb-header">
        <div class="nb-title">📓 ${esc(nb.title)}</div>
        <div class="nb-actions">
          <button class="btn-xs" data-action="nb-reset-all" title="모든 변수 초기화">🔄 세션 초기화</button>
        </div>
      </div>
      <div class="nb-cells">${cellsHtml}</div>
    </div>`;
}

function vNbMarkdownCell(cell, idx){
  const html = typeof marked !== 'undefined' ? marked.parse(cell.source || '') : esc(cell.source || '');
  return `<div class="nb-cell nb-cell-md" data-cidx="${idx}">
    <div class="nb-md-body">${html}</div>
  </div>`;
}

function vNbCodeCell(cell, idx){
  const cellId = cell.id || `cell-${idx}`;
  const userCode = NB_CELL_CODES[cellId];
  const code = userCode !== undefined ? userCode : (cell.source || '');
  const result = NB_CELL_OUTPUTS[cellId];

  return `<div class="nb-cell nb-cell-code" data-cidx="${idx}" data-cellid="${cellId}">
    <div class="nb-cell-gutter">
      <button class="nb-run-btn" data-action="nb-run-cell" data-cellid="${cellId}" data-cidx="${idx}" title="실행 (Shift+Enter)">
        ${result?.running ? '⏳' : '▶'}
      </button>
    </div>
    <div class="nb-cell-main">
      <textarea class="nb-code-area" id="nb-code-${cellId}" data-cellid="${cellId}" spellcheck="false">${esc(code)}</textarea>
      <details class="nb-stdin-details">
        <summary style="cursor:pointer;font-size:11px;color:var(--text3);padding:4px 8px">💬 입력 (input()에 전달할 값)</summary>
        <textarea class="nb-stdin-area" id="nb-stdin-${cellId}" placeholder="한 줄에 하나씩 입력..." spellcheck="false"></textarea>
      </details>
      ${result ? `<div class="nb-output ${result.success === false ? 'nb-output-err' : ''}">
        ${result.output ? `<pre>${esc(result.output)}</pre>` : ''}
        ${result.error ? `<pre class="nb-error">${esc(result.error)}</pre>` : ''}
        ${!result.output && !result.error && result.success ? `<pre style="color:var(--text3);font-style:italic">(출력 없음)</pre>` : ''}
      </div>` : ''}
    </div>
  </div>`;
}
