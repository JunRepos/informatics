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

  const isStudent = !isTeacher && !!ST_USER;
  const saveInd = isStudent ? `<div id="cb-save-ind" class="cb-save-ind" style="font-size:11px;color:var(--cb-text-3);margin-right:6px">✓ 저장됨</div>` : '';
  const progressBtn = isTeacher ? `<button class="cb-tb-btn" data-action="nb-show-progress" title="학생별 진도 보기">👥 학생 진도</button>` : '';

  // 학생 진도 보는 중일 때 상단 배너
  const viewingBanner = NB_VIEWING_STUDENT ? (() => {
    const st = STUDENTS.find(s => s.number === NB_VIEWING_STUDENT);
    const name = st ? `${st.number} ${st.name}` : NB_VIEWING_STUDENT;
    return `<div class="cb-viewing-banner">
      <span>📖 <b>${esc(name)}</b> 학생의 진도를 보고 있습니다 (읽기 전용)</span>
      <button class="cb-tb-btn" data-action="nb-exit-viewing">← 원본으로</button>
    </div>`;
  })() : '';

  // 상단 타이틀 바
  const toolbar = `<div class="cb-toolbar">
    <button class="cb-back-btn" data-action="nb-close">← 목록</button>
    <button class="cb-tb-btn cb-sidebar-toggle" data-action="nb-toggle-sidebar" title="사이드바 토글 (Ctrl+/)" aria-label="사이드바">☰</button>
    <div class="cb-title">📓 ${esc(nb.title)}</div>
    ${saveInd}
    <div class="cb-toolbar-actions">
      ${progressBtn}
    </div>
  </div>
  ${viewingBanner}`;

  // 메뉴바 (Colab 스타일)
  const menubar = vNbMenubar(isTeacher, isStudent);

  // 학생 진도 패널
  if(isTeacher && NB_SHOW_PROGRESS){
    return `<div class="cb-wrap">${toolbar}${vNbProgressPanel()}</div>`;
  }

  const cellsHtml = (NB_CELLS || []).map((cell, idx) => vNbCell(cell, idx)).join('');

  // 맨 아래 셀 추가 버튼
  const addEndRow = `<div class="cb-add-row cb-add-row-end">
    <button class="cb-add-btn" data-action="nb-add-cell" data-type="code" data-pos="${NB_CELLS.length}">+ 코드</button>
    <button class="cb-add-btn" data-action="nb-add-cell" data-type="markdown" data-pos="${NB_CELLS.length}">+ 텍스트</button>
  </div>`;

  // 좌측 사이드바 (목차)
  const sidebar = NB_SIDEBAR_OPEN ? vNbSidebar() : '';

  return `
    <div class="cb-wrap">
      ${toolbar}
      ${menubar}
      <div class="cb-body${NB_SIDEBAR_OPEN ? ' cb-has-sidebar' : ''}">
        ${sidebar}
        <div class="cb-main">
          <div class="cb-cells" id="cb-cells">${cellsHtml || ''}</div>
          ${addEndRow}
        </div>
      </div>
    </div>`;
}

// ── 메뉴바 (Colab 스타일: 파일/편집/보기/삽입/런타임/도움말) ──
function vNbMenubar(isTeacher, isStudent){
  const menus = [
    {id: 'file', label: '파일', items: [
      {label: '⬇️  ipynb 로 다운로드', action: 'nb-download-ipynb', shortcut: 'Ctrl+S'},
      {label: '🖨️  인쇄', action: 'nb-print', shortcut: 'Ctrl+P'},
    ]},
    {id: 'edit', label: '편집', items: [
      {label: '🧹  모든 출력 지우기', action: 'nb-clear-outputs'},
      ...(isStudent ? [{label: '↺   원본 복원', action: 'nb-reset-original'}] : []),
    ]},
    {id: 'view', label: '보기', items: [
      {label: '☰   사이드바 ' + (NB_SIDEBAR_OPEN ? '숨기기' : '표시'), action: 'nb-toggle-sidebar', shortcut: 'Ctrl+/'},
      {label: '🌗  테마 전환', action: 'nb-toggle-theme'},
    ]},
    {id: 'insert', label: '삽입', items: [
      {label: '➕  코드 셀', action: 'nb-insert-code'},
      {label: '📝  텍스트 셀', action: 'nb-insert-text'},
    ]},
    {id: 'runtime', label: '런타임', items: [
      {label: '▶▶  모두 실행', action: 'nb-run-all'},
      {label: '🔄  재시작', action: 'nb-reset-all'},
      {label: '🚀  재시작 후 모두 실행', action: 'nb-reset-and-run-all'},
    ]},
    {id: 'help', label: '도움말', items: [
      {label: '⌨️   단축키 보기', action: 'nb-show-shortcuts'},
    ]},
  ];

  return `<div class="cb-menubar" id="cb-menubar">
    ${menus.map(m => `
      <div class="cb-menu${NB_OPEN_MENU === m.id ? ' cb-menu-open' : ''}" data-menu="${m.id}">
        <button class="cb-menu-btn" data-action="nb-toggle-menu" data-menuid="${m.id}">${m.label}</button>
        <div class="cb-menu-dropdown">
          ${m.items.map(it => `
            <button class="cb-menu-item" data-action="${it.action}">
              <span>${it.label}</span>
              ${it.shortcut ? `<span class="cb-menu-shortcut">${it.shortcut}</span>` : ''}
            </button>
          `).join('')}
        </div>
      </div>
    `).join('')}
  </div>`;
}

// ── 좌측 사이드바 (마크다운 헤더 자동 목차) ──
function vNbSidebar(){
  const toc = buildNbTOC();
  let tocHtml;
  if(!toc.length){
    tocHtml = `<div class="cb-toc-empty">텍스트 셀에 <code># 제목</code>을<br>적으면 여기에 목차가 생겨요.</div>`;
  } else {
    tocHtml = toc.map(it => `
      <a class="cb-toc-item cb-toc-lv${it.level}" data-action="nb-toc-jump" data-cellid="${it.cellId}">
        ${esc(it.text)}
      </a>
    `).join('');
  }

  // 코드/텍스트 셀 통계
  const codeCount = NB_CELLS.filter(c => c.type === 'code').length;
  const mdCount = NB_CELLS.filter(c => c.type === 'markdown').length;
  const ranCount = Object.values(NB_CELL_OUTPUTS).filter(o => o?.execCount).length;

  return `<aside class="cb-sidebar">
    <div class="cb-sidebar-section">
      <div class="cb-sidebar-title">📋 목차</div>
      <div class="cb-toc">${tocHtml}</div>
    </div>
    <div class="cb-sidebar-section">
      <div class="cb-sidebar-title">📊 통계</div>
      <div class="cb-stats">
        <div class="cb-stat-row"><span>코드 셀</span><b>${codeCount}</b></div>
        <div class="cb-stat-row"><span>텍스트 셀</span><b>${mdCount}</b></div>
        <div class="cb-stat-row"><span>실행됨</span><b>${ranCount}/${codeCount}</b></div>
      </div>
    </div>
  </aside>`;
}

// 마크다운 헤더 추출 → 목차 항목
function buildNbTOC(){
  const items = [];
  for(const cell of (NB_CELLS || [])){
    if(cell.type !== 'markdown') continue;
    const lines = (cell.source || '').split('\n');
    let inFence = false;
    for(const line of lines){
      // 코드 블록 안의 # 무시
      if(/^\s*```/.test(line)){ inFence = !inFence; continue; }
      if(inFence) continue;
      const m = line.match(/^(#{1,4})\s+(.+?)\s*$/);
      if(m){
        items.push({level: m[1].length, text: m[2].replace(/[#*_`]/g, '').trim(), cellId: cell.id});
      }
    }
  }
  return items;
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
    ${!isMd ? `<button class="cb-act-btn" data-action="nb-run-cell" data-cellid="${cell.id}" title="셀 실행 (Ctrl+Enter)">▶</button>` : `<button class="cb-act-btn" data-action="nb-md-edit-btn" data-cellid="${cell.id}" title="편집">✏️</button>`}
    <button class="cb-act-btn" data-action="nb-move-up" data-cellid="${cell.id}" title="셀 위로 이동">↑</button>
    <button class="cb-act-btn" data-action="nb-move-down" data-cellid="${cell.id}" title="셀 아래로 이동">↓</button>
    <button class="cb-act-btn" data-action="nb-copy" data-cellid="${cell.id}" title="셀 복제">⧉</button>
    <button class="cb-act-btn cb-act-del" data-action="nb-delete" data-cellid="${cell.id}" title="셀 삭제">🗑</button>
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
  const outputHtml = result && !result.running ? vNbOutput(result, cell.id) : (result?.running ? `<div class="cb-output cb-out-running" data-cellid="${cell.id}"><div class="cb-out-header"><span class="cb-out-prompt">Out [*]:</span><span class="cb-out-time">⏱ 실행 중</span></div><div class="cb-out-body"><pre style="color:#999;font-style:italic;margin:0;padding:0 12px">⏳ 실행 중...</pre></div></div>` : '');

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

// ── 학생 진도 패널 ──
function vNbProgressPanel(){
  const nb = SEL_NOTEBOOK;
  const origCount = nb.cells?.length || 0;

  // 학생별 상태 계산
  const rows = STUDENTS.map(st => {
    const prog = NB_PROGRESS_MAP[st.number];
    const edited = !!prog;
    const cellCount = prog?.cells?.length || 0;
    const updatedAt = prog?.updatedAt;
    // 원본과 비교해서 변경된 셀 개수
    let changedCells = 0;
    if(edited && Array.isArray(prog.cells)){
      const origById = {};
      (nb.cells || []).forEach(c => { if(c.id) origById[c.id] = c.source || ''; });
      prog.cells.forEach(c => {
        if(!origById.hasOwnProperty(c.id)) changedCells++;
        else if(origById[c.id] !== (c.source || '')) changedCells++;
      });
    }
    return {st, edited, cellCount, updatedAt, changedCells};
  }).sort((a, b) => a.st.number.localeCompare(b.st.number));

  const editedCount = rows.filter(r => r.edited).length;

  const tbl = !rows.length ? emptyBox('👥', '등록된 학생이 없습니다.') : `
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>학번</th><th>이름</th><th>상태</th><th>셀 수</th>
            <th>변경 셀</th><th>마지막 저장</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td style="font-weight:600">${esc(r.st.number)}</td>
            <td>${esc(r.st.name)}</td>
            <td>${r.edited ? `<span class="chip chip-green">✓ 편집함</span>` : `<span class="chip chip-gray">원본</span>`}</td>
            <td>${r.edited ? r.cellCount : origCount}</td>
            <td>${r.edited ? (r.changedCells ? `<span style="color:var(--accent);font-weight:600">${r.changedCells}</span>` : '-') : '-'}</td>
            <td style="font-size:11px">${r.updatedAt ? fmtDt(r.updatedAt) : '-'}</td>
            <td>${r.edited ? `<button class="btn-xs btn-p" data-action="nb-view-student" data-snum="${esc(r.st.number)}">보기</button>` : '<span class="cell-no">-</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  return `<div class="cb-progress-wrap">
    <div class="cb-progress-header">
      <div>
        <div style="font-size:14px;font-weight:700">👥 학생 진도</div>
        <div style="font-size:12px;color:var(--cb-text-2);margin-top:2px">
          ${editedCount}명 편집 / ${STUDENTS.length}명 전체
          ${STUDENTS.length ? `(${Math.round(editedCount / STUDENTS.length * 100)}%)` : ''}
        </div>
      </div>
      <button class="btn-sm" data-action="nb-hide-progress">✕ 닫기</button>
    </div>
    ${tbl}
  </div>`;
}

function vNbOutput(result, cellId){
  let body = '';
  if(result.output) body += `<pre class="cb-out-text">${esc(result.output)}</pre>`;
  if(result.images && result.images.length){
    body += result.images.map(b64 => `<img class="cb-out-img" src="data:image/png;base64,${b64}"/>`).join('');
  }
  if(result.error) body += `<pre class="cb-out-err">${esc(result.error)}</pre>`;
  if(!body && result.success) body = `<pre class="cb-out-empty">(출력 없음)</pre>`;

  const collapsed = !!(cellId && NB_COLLAPSED_OUTPUTS[cellId]);
  const promptLabel = result.execCount ? `Out [${result.execCount}]:` : 'Out:';
  const timeLabel = formatElapsed(result.elapsedMs);

  return `<div class="cb-output${result.error ? ' cb-has-error' : ''}${collapsed ? ' cb-out-collapsed' : ''}" data-cellid="${cellId || ''}">
    <div class="cb-out-header">
      <span class="cb-out-prompt">${promptLabel}</span>
      ${timeLabel ? `<span class="cb-out-time" title="실행 시간">⏱ ${timeLabel}</span>` : ''}
      <span class="cb-out-spacer"></span>
      ${cellId ? `<button class="cb-out-toggle" data-action="nb-toggle-output" data-cellid="${cellId}" title="${collapsed ? '출력 펼치기' : '출력 접기'}">${collapsed ? '▸' : '▾'}</button>` : ''}
    </div>
    <div class="cb-out-body">${body}</div>
  </div>`;
}

// 실행 시간을 사람 읽기 좋은 문자열로
function formatElapsed(ms){
  if(typeof ms !== 'number' || ms < 0) return '';
  if(ms < 1000) return `${Math.round(ms)}ms`;
  if(ms < 60000) return `${(ms/1000).toFixed(1)}초`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}분 ${s}초`;
}
