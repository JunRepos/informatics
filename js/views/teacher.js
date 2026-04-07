/* ═══════════════════════════════════════
   views/teacher.js — 선생님 대시보드

   선생님이 로그인한 뒤 보는 모든 탭 화면:
   공지, 과제, 게시판, 출결, 학생관리, 파일, 설정
═══════════════════════════════════════ */

// 선생님 대시보드 메인
function vTeacher(){
  const clsOpts = CLASSES.map(c =>
    `<option value="${c.id}"${TC_CLS?.id === c.id ? ' selected' : ''}>${c.emoji} ${c.label}</option>`
  ).join('');

  const clsBar = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 14px;margin-bottom:13px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;box-shadow:var(--sh)">
    <label style="font-size:12px">관리 반:</label>
    <select id="tc-cls-sel" style="flex:1;min-width:130px;font-size:13px;padding:6px 10px">${clsOpts}</select>
    <button class="btn-p btn-sm" id="tc-cls-go">이동</button>
  </div>`;

  const tabs = `<div class="tabs">
    ${tab('📢 공지','notice',TC_TAB,"setTC('notice')")}
    ${tab('📚 과제','assign',TC_TAB,"setTC('assign')")}
    ${tab('📋 게시판','board',TC_TAB,"setTC('board')")}
    ${tab('🗓️ 출결','attend',TC_TAB,"setTC('attend')")}
    ${tab('👥 학생관리','students',TC_TAB,"setTC('students')")}
    ${tab('📁 파일','files',TC_TAB,"setTC('files')")}
    ${tab('⚙️ 설정','settings',TC_TAB,"setTC('settings')")}
    ${tab('▶️ 코드','coderun',TC_TAB,"setTC('coderun')")}
  </div>`;

  if(!TC_CLS && TC_TAB !== 'settings' && TC_TAB !== 'coderun')
    return clsBar + tabs + emptyBox('👆','관리할 반을 선택하세요.');

  let body = '';
  if     (TC_TAB === 'notice')   body = vTcNotice();
  else if(TC_TAB === 'assign')   body = vTcAssign();
  else if(TC_TAB === 'board')    body = vTcBoard();
  else if(TC_TAB === 'attend')   body = vTcAttend();
  else if(TC_TAB === 'students') body = vTcStudents();
  else if(TC_TAB === 'files')    body = vTcFiles();
  else if(TC_TAB === 'settings') body = vTcSettings();
  else if(TC_TAB === 'coderun')  body = vCodeRun();

  return clsBar + tabs + body;
}

function setTC(t){
  TC_TAB = t;
  if(t === 'attend' && TC_CLS){
    loadAttendance(TC_CLS.id, AT_DATE).then(render);
  } else {
    render();
  }
}

// ── 공지 관리 ──
function vTcNotice(){
  const editId = window._ncEditId || null;
  const editData = editId ? NOTICES.find(n => n.id === editId) : null;

  const form = `<div class="section">
    <div class="sec-title">${editData ? '📢 공지 수정' : '📢 공지 등록'}</div>
    ${editData ? `<div class="box-warn" style="margin-bottom:10px">수정 중: <b>${esc(editData.title)}</b></div>` : ''}
    <div class="form">
      <div class="field"><label>제목</label><input id="nc-title" type="text" placeholder="공지 제목" value="${editData ? esc(editData.title) : ''}"/></div>
      <div class="field"><label>내용</label><textarea id="nc-content" placeholder="공지 내용을 입력하세요">${editData ? esc(editData.content) : ''}</textarea></div>
      <div class="form-row">
        <div class="field"><label>첨부파일 ${editData ? '(교체 시에만 선택)' : '(선택)'}</label><input id="nc-file" type="file" accept="image/*,*/*"/></div>
        <div class="field" style="flex:0 0 auto;display:flex;align-items:flex-end">
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px;color:var(--text2);font-weight:500;text-transform:none;letter-spacing:0">
            <input type="checkbox" id="nc-pin" style="width:auto" ${editData?.isPinned ? 'checked' : ''}/> 📌 상단 고정
          </label>
        </div>
      </div>
      ${!editData ? multiClassPicker('nc', TC_CLS?.id) : ''}
      <div class="prog-wrap" id="nc-prog">
        <div class="prog-label">업로드 중... <span id="nc-pct">0%</span></div>
        <div class="prog-bar"><div class="prog-fill" id="nc-pfill" style="width:0%"></div></div>
      </div>
      <div id="nc-err" class="err"></div>
      <div style="display:flex;gap:7px">
        <button id="nc-submit" class="btn-p" data-edit-id="${editData?.id || ''}">${editData ? '수정 완료' : '공지 등록'}</button>
        ${editData ? `<button onclick="window._ncEditId=null;setTC('notice')" class="btn-sm">취소</button>` : ''}
      </div>
    </div>
  </div>`;

  const list = !NOTICES.length ? emptyBox('📢','공지가 없습니다.') : NOTICES.map(n => noticeCard(n, true)).join('');
  return form + `<div class="sec-title" style="margin-top:4px">등록된 공지</div>` + list;
}

// ── 과제 관리 ──
function vTcAssign(){
  const editId = window._acEditId || null;
  const editData = editId ? ASSIGNMENTS.find(a => a.id === editId) : null;

  const form = `<div class="section">
    <div class="sec-title">${editData ? '📚 과제 수정' : '📚 과제 등록'}</div>
    ${editData ? `<div class="box-warn" style="margin-bottom:10px">수정 중: <b>${esc(editData.title)}</b></div>` : ''}
    <div class="form">
      <div class="field"><label>과제 제목</label><input id="ac-title" type="text" placeholder="과제 제목" value="${editData ? esc(editData.title) : ''}"/></div>
      <div class="field"><label>설명</label><textarea id="ac-desc" placeholder="과제 설명 (선택)">${editData ? esc(editData.description || '') : ''}</textarea></div>
      <div class="form-row">
        <div class="field"><label>마감일 (선택)</label><input id="ac-due" type="date" value="${editData?.dueDate || ''}"/></div>
        <div class="field"><label>첨부파일 ${editData ? '(교체 시에만 선택)' : '(선택)'}</label><input id="ac-file" type="file"/></div>
      </div>
      ${!editData ? multiClassPicker('ac', TC_CLS?.id) : ''}
      <div class="prog-wrap" id="ac-prog">
        <div class="prog-label">업로드 중... <span id="ac-pct">0%</span></div>
        <div class="prog-bar"><div class="prog-fill" id="ac-pfill" style="width:0%"></div></div>
      </div>
      <div id="ac-err" class="err"></div>
      <div style="display:flex;gap:7px">
        <button id="ac-submit" class="btn-p" data-edit-id="${editData?.id || ''}">${editData ? '수정 완료' : '과제 등록'}</button>
        ${editData ? `<button onclick="window._acEditId=null;setTC('assign')" class="btn-sm">취소</button>` : ''}
      </div>
    </div>
  </div>`;

  const list = !ASSIGNMENTS.length ? emptyBox('📚','등록된 과제가 없습니다.') : ASSIGNMENTS.map(a => {
    const subCount = SUBMISSIONS[a.id] ? Object.keys(SUBMISSIONS[a.id]).length : 0;
    const total = STUDENTS.length;
    const pct = total ? Math.round(subCount / total * 100) : 0;
    return `<div class="list-row">
      <div class="row-icon">📚</div>
      <div class="row-info">
        <div class="row-title">${esc(a.title)}</div>
        <div class="row-meta">${a.dueDate ? `마감: ${fmtDay(a.dueDate)}` : '마감 없음'} · ${subCount}/${total}명 제출</div>
        <div class="sbar"><div class="sbar-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="row-right">
        ${a.dueDate ? dday(a.dueDate) : ''}
        <button class="btn-sm btn-p" data-action="view-status" data-aid="${a.id}">현황</button>
        <button class="btn-xs" data-action="edit-assign" data-aid="${a.id}">✏️</button>
        <button class="btn-xs btn-danger" data-action="del-assign" data-aid="${a.id}" data-atitle="${esc(a.title)}">삭제</button>
      </div>
    </div>`;
  }).join('');

  return form + `<div class="sec-title" style="margin-top:4px">등록된 과제</div>` + list;
}

// ── 제출 현황 테이블 (과제별) ──
function vStatusTable(aid){
  const a = ASSIGNMENTS.find(x => x.id === aid);
  if(!a) return '';
  const subs = SUBMISSIONS[aid] || {};
  const subArr = Object.entries(subs).map(([num, v]) => ({num, ...v}));

  const rows = STUDENTS.map(st => {
    const sub = subs[st.number];
    return `<tr>
      <td>${esc(st.number)}</td>
      <td>${esc(st.name)}</td>
      <td>${sub ? `<span class="cell-ok">✓ 제출</span>` : `<span class="cell-no">-</span>`}</td>
      <td style="font-size:11px">${sub ? fmtDt(sub.uploadedAt) : '-'}</td>
      <td>${sub ? `<button class="btn-xs btn-p" data-action="dl-sub-file" data-url="${esc(sub.url)}" data-name="${esc(sub.fileName)}">${esc(sub.fileName || '').slice(0,10)}…</button>`
               : `<span class="cell-no">-</span>`}</td>
      <td style="font-size:12px;color:var(--text2);max-width:160px;word-break:break-word">${sub && sub.memo ? esc(sub.memo) : '-'}</td>
      ${sub?.resubCount ? `<td style="font-size:11px;color:var(--text3)">재제출 ${sub.resubCount}회</td>` : '<td>-</td>'}
    </tr>`;
  }).join('');

  const submittedSubs = subArr.filter(s => s.url);
  return `<div class="section">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div class="sec-title" style="margin:0">📊 ${esc(a.title)} — 제출 현황</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${submittedSubs.length ? `<button class="btn-ok btn-sm" id="zip-btn" data-aid="${aid}">📦 ZIP (${submittedSubs.length}개)</button>` : ''}
        <button class="btn-sm" data-action="close-status" data-aid="${aid}">✕ 닫기</button>
      </div>
    </div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:10px">
      ${submittedSubs.length}명 제출 / ${STUDENTS.length}명 전체
      (${STUDENTS.length ? Math.round(submittedSubs.length / STUDENTS.length * 100) : 0}%)
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>학번</th><th>이름</th><th>제출</th><th>제출일시</th><th>파일</th><th>메모</th><th>재제출</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:var(--text3)">학생이 없습니다</td></tr>'}</tbody>
      </table>
    </div>
  </div>`;
}

// ── 게시판 (선생님은 모든 글 열람 가능) ──
function vTcBoard(){
  if(!POSTS.length) return emptyBox('📋','학생이 올린 게시물이 없습니다.');
  return `<div class="box-ok">🔓 선생님은 모든 게시물을 비밀번호 없이 열람할 수 있습니다.</div>`
    + POSTS.map(p => `
      <div class="list-row click" data-action="pick-post" data-pid="${p.id}">
        <div class="row-icon">${fIcon(p.fileName)}</div>
        <div class="row-info">
          <div class="row-title">${esc(p.title)}</div>
          <div class="row-meta">${esc(p.authorName)} (${esc(p.authorId)}) · ${fmtDt(p.uploadedAt)} · ${fmtSz(p.fileSize)}</div>
        </div>
        <div class="row-right"><span style="font-size:14px;color:var(--ok)">🔓</span></div>
      </div>`).join('');
}

// ── 출결 관리 ──
function vTcAttend(){
  const cntAbs  = STUDENTS.filter(s => ATTENDANCE[s.number]?.status === '결석').length;
  const cntLate = STUDENTS.filter(s => ATTENDANCE[s.number]?.status === '지각').length;
  const cntOk   = STUDENTS.length - cntAbs - cntLate;

  const rows = !STUDENTS.length
    ? emptyBox('👥','등록된 학생이 없습니다. 학생관리 탭에서 먼저 추가하세요.')
    : STUDENTS.map(st => {
        const rec = ATTENDANCE[st.number] || {};
        const status = rec.status || '출석';
        const reason = rec.reason || '';
        const needReason = status === '지각' || status === '결석';
        const reasons = ['질병','인정','미인정'];
        return buildAtRow2(st, status, reason, needReason, reasons);
      }).join('');

  return `
    <div class="at-date-bar">
      <div class="at-day-nav">
        <button class="btn-sm" data-action="at-prev-day">◀</button>
        <button class="btn-sm" data-action="at-next-day">▶</button>
      </div>
      <input type="date" id="at-date-input" value="${AT_DATE}" style="flex:1;min-width:130px"/>
      <button class="btn-p btn-sm" data-action="at-go-today">오늘</button>
      <button class="btn-ok btn-sm" data-action="at-export">📋 내보내기</button>
    </div>
    <div class="box-info" style="margin-bottom:12px">기본값은 <b>출석</b>입니다. 지각·결석인 학생만 체크하세요.</div>
    <div class="at-summary">
      <div class="at-stat ok"><div class="at-stat-num">${cntOk}</div><div class="at-stat-label">출석</div></div>
      <div class="at-stat warn"><div class="at-stat-num">${cntLate}</div><div class="at-stat-label">지각</div></div>
      <div class="at-stat bad"><div class="at-stat-num">${cntAbs}</div><div class="at-stat-label">결석</div></div>
    </div>
    <div id="at-rows">${rows}</div>`;
}

// 출결 행 렌더링 헬퍼
function buildAtRow2(st, status, reason, needReason, reasons){
  const isLate = status === '지각', isAbs = status === '결석';
  return `<div class="at-row" id="atr-${st.number}">
    <div class="at-row-info">
      <div class="at-row-num">${esc(st.number)}</div>
      <div class="at-row-name">${esc(st.name)}</div>
    </div>
    <div class="at-btns">
      <button class="at-btn${isLate ? ' sel-지각' : ''}"
        data-action="at-set" data-num="${st.number}" data-status="${isLate ? '출석' : '지각'}">
        ${isLate ? '↩ 지각 취소' : '⏰ 지각'}
      </button>
      <button class="at-btn${isAbs ? ' sel-결석' : ''}"
        data-action="at-set" data-num="${st.number}" data-status="${isAbs ? '출석' : '결석'}">
        ${isAbs ? '↩ 결석 취소' : '✗ 결석'}
      </button>
      ${needReason ? `<div class="at-reason">
        ${reasons.map(r => `<button class="at-rbtn${reason === r ? ' sel' : ''}"
          data-action="at-reason" data-num="${st.number}" data-reason="${r}">${r}</button>`).join('')}
      </div>` : ''}
    </div>
    <div style="flex-shrink:0">
      ${status === '출석' ? `<span class="at-chip-ok">출석</span>`
        : status === '지각' ? `<span class="at-chip-late">지각${reason ? ' (' + reason + ')' : ''}</span>`
        : `<span class="at-chip-abs">결석${reason ? ' (' + reason + ')' : ''}</span>`}
    </div>
  </div>`;
}

// 출결 행 단일 갱신용 헬퍼
function buildAtRow(st){
  const rec = ATTENDANCE[st.number] || {};
  const status = rec.status || '출석';
  const reason = rec.reason || '';
  const needReason = status === '지각' || status === '결석';
  const reasons = ['질병','인정','미인정'];
  return buildAtRow2(st, status, reason, needReason, reasons);
}

// 출결 요약 카드만 갱신
function updateAtSummary(){
  const ok   = STUDENTS.filter(s => ATTENDANCE[s.number]?.status === '출석').length;
  const late = STUDENTS.filter(s => ATTENDANCE[s.number]?.status === '지각').length;
  const abs  = STUDENTS.filter(s => ATTENDANCE[s.number]?.status === '결석').length;
  const none = STUDENTS.length - ok - late - abs;

  document.querySelectorAll('.at-stat').forEach(el => {
    if(el.classList.contains('ok'))   el.querySelector('.at-stat-num').textContent = ok;
    if(el.classList.contains('warn')) el.querySelector('.at-stat-num').textContent = late;
    if(el.classList.contains('bad'))  el.querySelector('.at-stat-num').textContent = abs;
  });

  let warn = document.querySelector('.at-none-warn');
  if(none > 0){
    if(!warn){
      warn = document.createElement('div');
      warn.className = 'box-warn at-none-warn';
      warn.style.marginBottom = '12px';
      document.getElementById('at-rows')?.before(warn);
    }
    warn.textContent = `⚠️ 미체크 ${none}명 — 출결 체크를 완료해주세요.`;
  } else {
    warn?.remove();
  }
}

// 출결 내보내기 (클립보드)
function atExport(){
  const dateStr = AT_DATE.replace(/-/g, '/');
  let lines = [`[출결] ${TC_CLS?.label} ${dateStr}`, ''];
  const groups = {출석: [], 지각: [], 결석: [], 미체크: []};
  STUDENTS.forEach(st => {
    const rec = ATTENDANCE[st.number] || {};
    const s = rec.status || '미체크';
    const label = s === '미체크' ? `${st.name}(${st.number})`
      : s === '출석' ? `${st.name}(${st.number})`
      : `${st.name}(${st.number})${rec.reason ? ' [' + rec.reason + ']' : ''}`;
    groups[s].push(label);
  });
  if(groups['출석'].length)  lines.push(`✓ 출석(${groups['출석'].length}명): ` + groups['출석'].join(', '));
  if(groups['지각'].length)  lines.push(`⏰ 지각(${groups['지각'].length}명): ` + groups['지각'].join(', '));
  if(groups['결석'].length)  lines.push(`✗ 결석(${groups['결석'].length}명): ` + groups['결석'].join(', '));
  if(groups['미체크'].length) lines.push(`? 미체크(${groups['미체크'].length}명): ` + groups['미체크'].join(', '));
  const text = lines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    toast('📋 클립보드에 복사됐습니다!', 'ok');
  }).catch(() => toast('클립보드 복사 실패', 'err'));
}

// ── 학생 관리 ──
function vTcStudents(){
  const addForm = `<div class="section">
    <div class="sec-title">👤 학생 추가</div>
    <div class="tabs" style="margin-bottom:12px">
      <button class="tab active" id="add-tab-1" onclick="document.getElementById('add-one').style.display='block';document.getElementById('add-bulk').style.display='none';this.className='tab active';document.getElementById('add-tab-2').className='tab'">개별 추가</button>
      <button class="tab" id="add-tab-2" onclick="document.getElementById('add-bulk').style.display='block';document.getElementById('add-one').style.display='none';this.className='tab active';document.getElementById('add-tab-1').className='tab'">일괄 추가</button>
    </div>
    <div id="add-one" class="form">
      <div class="form-row">
        <div class="field"><label>학번</label><input id="st-num" type="text" placeholder="예: 20101" autocomplete="off"/></div>
        <div class="field"><label>이름</label><input id="st-name" type="text" placeholder="홍길동"/></div>
      </div>
      <div class="box-info" style="margin:0">초기 비밀번호는 <b>학번</b>으로 자동 설정됩니다.</div>
      <div id="sa-err" class="err"></div>
      <button id="sa-btn" class="btn-p btn-sm">추가</button>
    </div>
    <div id="add-bulk" class="form" style="display:none">
      <div class="field"><label>일괄 입력 (학번,이름 — 한 줄에 하나씩)</label>
        <textarea id="bulk-input" placeholder="20101,홍길동&#10;20102,김철수&#10;20103,이영희" style="min-height:120px;font-family:monospace;font-size:13px"></textarea></div>
      <div id="bulk-err" class="err"></div>
      <button id="bulk-btn" class="btn-p btn-sm">일괄 추가</button>
    </div>
  </div>`;

  const list = !STUDENTS.length ? emptyBox('👥','등록된 학생이 없습니다.') : `
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>학번</th><th>이름</th><th>비밀번호</th><th>관리</th></tr></thead>
        <tbody>${STUDENTS.map(s => `<tr>
          <td style="font-weight:600">${esc(s.number)}</td>
          <td>${esc(s.name)}</td>
          <td><span class="chip ${s.isFirstLogin ? 'chip-orange' : 'chip-green'}">${s.isFirstLogin ? '변경 필요' : '변경완료'}</span></td>
          <td><button class="btn-xs" data-action="reset-st-pw" data-snum="${esc(s.number)}" data-sname="${esc(s.name)}">비번초기화</button>
              <button class="btn-xs btn-danger" data-action="del-student" data-snum="${esc(s.number)}" data-sname="${esc(s.name)}">삭제</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

  return addForm + `<div class="sec-title" style="margin-bottom:10px">등록된 학생 (${STUDENTS.length}명)</div>` + list;
}

// ── 파일 공유 ──
function vTcFiles(){
  const form = `<div class="section">
    <div class="sec-title">📁 파일 공유하기</div>
    <div class="box-info">이 반 학생들이 로그인 없이 다운로드할 수 있습니다. 여러 파일을 한 번에 선택할 수 있습니다. (파일당 최대 50MB)</div>
    <div class="form">
      <div class="field"><label>묶음 제목 (선택)</label><input id="tf-title" type="text" placeholder="예: 4월 2주차 수업 자료"/></div>
      <div class="field"><label>설명 (선택)</label><textarea id="tf-desc" placeholder="파일에 대한 설명을 입력하세요" style="min-height:60px"></textarea></div>
      <div class="field"><label>파일 선택 (여러 개 가능)</label><input id="tf-file" type="file" multiple/></div>
      <div id="tf-file-list" style="display:none;font-size:12px;color:var(--text2);margin-top:4px"></div>
      <div class="prog-wrap" id="tf-prog">
        <div class="prog-label">업로드 중... <span id="tf-pct">0%</span> <span id="tf-cur"></span></div>
        <div class="prog-bar"><div class="prog-fill" id="tf-pfill" style="width:0%"></div></div>
      </div>
      <div id="tf-err" class="err"></div>
      <button id="tf-upload" class="btn-p btn-sm">공유하기</button>
    </div>
  </div>`;

  if(!TC_FILES.length) return form + emptyBox('📁','공유한 파일이 없습니다.');

  const groups = groupFiles(TC_FILES);
  const allFilesForZip = TC_FILES.filter(f => f.url);
  const groupHtml = Object.entries(groups).map(([gid, g]) => `
    <div class="section" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
        <div>
          ${g.title ? `<div style="font-size:14px;font-weight:700">${esc(g.title)}</div>` : ''}
          ${g.desc ? `<div style="font-size:12px;color:var(--text2);margin-top:2px">${esc(g.desc)}</div>` : ''}
          <div style="font-size:11px;color:var(--text3);margin-top:3px">${fmtDt(g.uploadedAt)} · ${g.files.length}개 파일</div>
        </div>
        ${g.files.length > 1 ? `<button class="btn-xs btn-ok" data-action="dl-group-zip" data-gid="${gid}">📦 전체 다운</button>` : ''}
      </div>
      ${g.files.map(f => fileCardHtml(f, {canDelete: true})).join('')}
    </div>`).join('');

  const totalZipBtn = allFilesForZip.length > 1
    ? `<button class="btn-ok btn-sm" data-action="dl-all-tc-zip" style="margin-bottom:12px">📦 전체 파일 ZIP 다운로드 (${allFilesForZip.length}개)</button>` : '';

  return form + totalZipBtn + groupHtml;
}

// ── 설정 ──
function vTcSettings(){
  return `
    <div class="section" style="max-width:360px">
      <div class="sec-title">🔐 선생님 비밀번호 변경</div>
      <div class="form">
        <div class="field"><label>현재 비밀번호</label><input id="cp-cur" type="password" autocomplete="current-password"/></div>
        <div class="field"><label>새 비밀번호 (4자 이상)</label><input id="cp-new" type="password" autocomplete="new-password"/></div>
        <div class="field"><label>새 비밀번호 확인</label><input id="cp-con" type="password" autocomplete="new-password"/></div>
        <div id="cp-msg" style="font-size:13px;min-height:16px"></div>
        <button id="cp-btn" class="btn-p btn-sm" style="margin-top:4px">비밀번호 변경</button>
      </div>
    </div>
    <div class="section" style="max-width:360px">
      <div class="sec-title">♻️ 기존 게시물 복구</div>
      <div class="box-warn">이전 버전 게시물을 반별로 이동합니다.</div>
      <div id="mig-body"><button class="btn-sm" id="mig-load-btn">복구할 게시물 불러오기</button></div>
    </div>`;
}
