/* ═══════════════════════════════════════
   views/student.js — 학생 대시보드

   학생이 로그인한 뒤 보는 모든 탭 화면:
   공지, 과제, 게시판, 파일, 출결, 내 현황
═══════════════════════════════════════ */

// 학생 대시보드 메인
function vStudent(){
  const tabs = `<div class="tabs">
    ${tab('📢 공지','notice',ST_TAB,"setST('notice')")}
    ${tab('📚 과제','assign',ST_TAB,"setST('assign')")}
    ${tab('📋 게시판','board',ST_TAB,"setST('board')")}
    ${tab('📥 파일','files',ST_TAB,"setST('files')")}
    ${tab('🗓️ 내 출결','attend',ST_TAB,"setST('attend')")}
    ${tab('👤 내 현황','mine',ST_TAB,"setST('mine')")}
  </div>`;

  let body = '';
  if     (ST_TAB === 'notice') body = vStNotice();
  else if(ST_TAB === 'assign') body = vStAssign();
  else if(ST_TAB === 'board')  body = vStBoard();
  else if(ST_TAB === 'files')  body = vStFiles();
  else if(ST_TAB === 'attend') body = vStAttend();
  else if(ST_TAB === 'mine')   body = vStMine();
  return tabs + body;
}

function setST(t){
  ST_TAB = t;
  if(t === 'attend' && SEL_CLS){
    const ym = new Date().toISOString().slice(0, 7);
    loadAttendanceMonth(SEL_CLS.id, ym).then(render);
  } else {
    render();
  }
}

// ── 공지 탭 ──
function vStNotice(){
  if(!NOTICES.length) return emptyBox('📢','등록된 공지가 없습니다.');
  return NOTICES.map(n => noticeCard(n, false)).join('');
}

// ── 과제 탭 ──
function vStAssign(){
  if(!ASSIGNMENTS.length) return emptyBox('📚','등록된 과제가 없습니다.');
  return ASSIGNMENTS.map(a => {
    const done = SUBMISSIONS[a.id] && SUBMISSIONS[a.id][ST_USER.number];
    return `<div class="list-row click" data-action="pick-assign" data-aid="${a.id}">
      <div class="row-icon">📚</div>
      <div class="row-info">
        <div class="row-title">${esc(a.title)}</div>
        <div class="row-meta">${a.dueDate ? `마감: ${fmtDay(a.dueDate)}` : '마감 없음'}</div>
        <div class="sbar"><div class="sbar-fill" style="width:${done ? 100 : 0}%"></div></div>
      </div>
      <div class="row-right">
        ${a.dueDate ? dday(a.dueDate) : ''}
        ${done ? `<span class="chip chip-green">✓ 제출완료</span>`
              : isPastDue(a.dueDate) ? `<span class="chip chip-red">미제출</span>`
              : `<span class="chip chip-gray">미제출</span>`}
      </div>
    </div>`;
  }).join('');
}

// ── 게시판 탭 ──
function vStBoard(){
  const btn = `<div style="display:flex;justify-content:flex-end;margin-bottom:10px">
    <button class="btn-p btn-sm" data-action="new-post">+ 게시물 올리기</button></div>`;
  if(!POSTS.length) return btn + emptyBox('📋','아직 게시물이 없습니다.');
  return btn + POSTS.map(p => {
    const isMine = p.authorId === ST_USER?.number;
    return `<div class="list-row click" data-action="pick-post" data-pid="${p.id}">
      <div class="row-icon">${fIcon(p.fileName)}</div>
      <div class="row-info">
        <div class="row-title">${esc(p.title)}</div>
        <div class="row-meta">${esc(p.authorName)} (${esc(p.authorId)}) · ${fmtDt(p.uploadedAt)} · ${fmtSz(p.fileSize)}</div>
      </div>
      <div class="row-right">
        ${isMine ? `<span class="chip chip-purple">내 글</span>` : ''}
        ${isMine ? `<span style="font-size:14px;color:var(--ok)">🔓</span>` : `<span style="font-size:14px;color:var(--text3)">🔒</span>`}
      </div>
    </div>`;
  }).join('');
}

// ── 파일 탭 (선생님 공유 파일) ──
function vStFiles(){
  if(!TC_FILES.length) return emptyBox('📥','선생님이 올린 파일이 없습니다.');
  const groups = groupFiles(TC_FILES);
  return Object.entries(groups).map(([gid, g]) => `
    <div class="section" style="margin-bottom:10px">
      ${g.title ? `<div style="font-size:14px;font-weight:700;margin-bottom:4px">${esc(g.title)}</div>` : ''}
      ${g.desc ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px">${esc(g.desc)}</div>` : ''}
      <div style="font-size:11px;color:var(--text3);margin-bottom:10px">${fmtDt(g.uploadedAt)} · ${g.files.length}개 파일</div>
      ${g.files.map(f => fileCardHtml(f, {dlLabel: '다운'})).join('')}
      ${g.files.length > 1 ? `<button class="btn-xs btn-ok" data-action="dl-group-zip" data-gid="${gid}" style="margin-top:4px">📦 전체 다운로드</button>` : ''}
    </div>`).join('');
}

// ── 출결 탭 ──
function vStAttend(){
  const myRecs = Object.entries(AT_MONTH_DATA)
    .sort(([a],[b]) => b.localeCompare(a))
    .map(([date, recs]) => ({date, rec: recs[ST_USER?.number] || null}));

  let cntOk = 0, cntLate = 0, cntAbs = 0;
  myRecs.forEach(({rec}) => {
    if(!rec) return;
    if(rec.status === '출석') cntOk++;
    else if(rec.status === '지각') cntLate++;
    else if(rec.status === '결석') cntAbs++;
  });

  const histRows = myRecs.filter(({rec}) => rec).map(({date, rec}) => {
    const chip = rec.status === '출석'
      ? `<span class="at-chip-ok">출석</span>`
      : rec.status === '지각'
      ? `<span class="at-chip-late">지각${rec.reason ? ' (' + esc(rec.reason) + ')' : ''}</span>`
      : `<span class="at-chip-abs">결석${rec.reason ? ' (' + esc(rec.reason) + ')' : ''}</span>`;
    return `<div class="at-hist-row">
      <div class="at-hist-date">${date.slice(5).replace('-','/')}</div>
      <div style="flex:1">${chip}</div>
    </div>`;
  }).join('');

  return `
    <div class="at-summary">
      <div class="at-stat ok"><div class="at-stat-num">${cntOk}</div><div class="at-stat-label">출석</div></div>
      <div class="at-stat warn"><div class="at-stat-num">${cntLate}</div><div class="at-stat-label">지각</div></div>
      <div class="at-stat bad"><div class="at-stat-num">${cntAbs}</div><div class="at-stat-label">결석</div></div>
    </div>
    <div class="section">
      <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:10px">이번 달 출결 기록</div>
      ${histRows || emptyBox('🗓️','이번 달 출결 기록이 없습니다.')}
    </div>`;
}

// ── 내 현황 탭 ──
function vStMine(){
  const myAssigns = ASSIGNMENTS.map(a => {
    const done = SUBMISSIONS[a.id] && SUBMISSIONS[a.id][ST_USER.number];
    return `<div class="list-row${done ? ' click' : ''}${done ? '" data-action="view-my-sub" data-aid="' + a.id + '"' : ''}">
      <div class="row-icon">📚</div>
      <div class="row-info">
        <div class="row-title">${esc(a.title)}</div>
        <div class="row-meta">${a.dueDate ? `마감: ${fmtDay(a.dueDate)}` : '마감 없음'}</div>
      </div>
      <div class="row-right">
        ${done ? `<span class="chip chip-green">✓ 제출완료</span><span style="font-size:11px;color:var(--text3)">${fmtDt(done.uploadedAt)}</span>`
              : `<span class="chip chip-gray">미제출</span>`}
      </div>
    </div>`;
  }).join('');

  const myPosts = POSTS.filter(p => p.authorId === ST_USER?.number);
  const myPostsHtml = myPosts.length
    ? myPosts.map(p => `<div class="list-row click" data-action="pick-post" data-pid="${p.id}">
        <div class="row-icon">${fIcon(p.fileName)}</div>
        <div class="row-info"><div class="row-title">${esc(p.title)}</div><div class="row-meta">${fmtDt(p.uploadedAt)} · ${fmtSz(p.fileSize)}</div></div>
        <div class="row-right"><span class="chip chip-purple">내 글</span></div>
      </div>`).join('')
    : emptyBox('📋','내가 올린 게시물이 없습니다.');

  const submitted = ASSIGNMENTS.filter(a => SUBMISSIONS[a.id] && SUBMISSIONS[a.id][ST_USER?.number]).length;
  const total = ASSIGNMENTS.length;

  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">전체 과제</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--ok)">${submitted}</div><div class="stat-label">제출 완료</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--danger)">${total - submitted}</div><div class="stat-label">미제출</div></div>
      <div class="stat-card"><div class="stat-num">${myPosts.length}</div><div class="stat-label">내 게시물</div></div>
    </div>
    <div class="section">
      <div class="sec-title">📚 과제 현황</div>
      ${myAssigns || emptyBox('📚','과제가 없습니다.')}
    </div>
    <div class="section">
      <div class="sec-title">📋 내 게시물</div>
      ${myPostsHtml}
    </div>`;
}
