/* ═══════════════════════════════════════
   views/student.js — 학생 대시보드

   학생이 로그인한 뒤 보는 모든 탭 화면:
   공지, 과제, 게시판, 파일, 출결, 내 현황
═══════════════════════════════════════ */

// 학생 대시보드 메인
function vStudent(){
  const clsType = SEL_CLS?.type || 'normal';
  const isInfo = clsType === 'info';

  const tabs = `<div class="tabs">
    ${tab('🏠 홈','dashboard',ST_TAB,"setST('dashboard')")}
    ${tab('📢 공지','notice',ST_TAB,"setST('notice')")}
    ${tab('📖 수업','assign',ST_TAB,"setST('assign')")}
    ${tab('📋 게시판','board',ST_TAB,"setST('board')")}
    ${tab('🗓️ 내 출결','attend',ST_TAB,"setST('attend')")}
    ${isInfo ? tab('📓 노트북','notebook',ST_TAB,"setST('notebook')") : ''}
    ${isInfo ? tab('🎮 미션','mission',ST_TAB,"setST('mission')") : ''}
    ${isInfo ? tab('💻 OJ','oj',ST_TAB,"setST('oj')") : ''}
    ${isInfo ? tab('🧩 퀴즈','coderead',ST_TAB,"setST('coderead')") : ''}
    ${isInfo && AIC_ACTIVE[SEL_CLS?.id] ? tab('🤖 AI 코딩','aicode',ST_TAB,"setST('aicode')") : ''}
    ${isInfo && AG_ACTIVE[SEL_CLS?.id] ? tab('📖 수행평가 안내','asmt-guide',ST_TAB,"setST('asmt-guide')") : ''}
    ${isInfo && ASMT_ACTIVE[SEL_CLS?.id] ? tab('📝 수행평가','asmt',ST_TAB,"setST('asmt')") : ''}
    ${isInfo ? tab('📊 내 점수','myscore',ST_TAB,"setST('myscore')") : ''}
    ${tab('👤 내 현황','mine',ST_TAB,"setST('mine')")}
  </div>`;

  let body = '';
  if     (ST_TAB === 'dashboard') body = vStDashboard();
  else if(ST_TAB === 'notice')  body = vStNotice();
  else if(ST_TAB === 'assign')  body = vStAssign();
  else if(ST_TAB === 'board')   body = vStBoard();
  else if(ST_TAB === 'attend')  body = vStAttend();
  else if(ST_TAB === 'notebook')body = vStNotebook();
  else if(ST_TAB === 'mission') body = vStMission();
  else if(ST_TAB === 'oj')      body = vStOJ();
  else if(ST_TAB === 'coderead')body = vStCodeRead();
  else if(ST_TAB === 'aicode')  body = vStAiCode();
  else if(ST_TAB === 'asmt-guide') body = vStAsmtGuide();
  else if(ST_TAB === 'asmt')    body = vStAssessment();
  else if(ST_TAB === 'myscore') body = vStMyScore();
  else if(ST_TAB === 'mine')    body = vStMine();
  return tabs + body;
}

function setST(t){
  ST_TAB = t;
  if(t === 'attend' && SEL_CLS){
    const ym = new Date().toISOString().slice(0, 7);
    loadAttendanceMonth(SEL_CLS.id, ym).then(render);
  } else if(t === 'coderead' && SEL_CLS && ST_USER){
    // 학생 본인 진도만 한꺼번에 로드
    CR_VIEW = 'list';
    CR_SEL = null;
    CR_LAST_RESULT = null;
    CR_CLOZE_ANSWERS = null;
    CR_BUG_SEL = null;
    loadCodeReadings(SEL_CLS.id).then(async () => {
      // 학생 진도 일괄 로드 (목록 표시용)
      CR_PROGRESS = {};
      for(const r of CR_READINGS){
        const p = await loadCodeReadingProgress(SEL_CLS.id, r.id, ST_USER.number);
        if(p){
          if(!CR_PROGRESS[r.id]) CR_PROGRESS[r.id] = {};
          CR_PROGRESS[r.id][ST_USER.number] = p;
        }
      }
      render();
    });
  } else if(t === 'aicode' && SEL_CLS && ST_USER){
    // AI 코딩 탭 — active + 저장 세션 로드 후 적절한 화면 결정
    AIC_MESSAGES = [];
    AIC_CODE = '';
    AIC_TURN_COUNT = 0;
    AIC_RUN_RESULT = null;
    AIC_RUN_STDIN = '';
    AIC_VIEW = 'entry';
    Promise.all([
      loadAicActive(SEL_CLS.id),
      loadAicSession(SEL_CLS.id, ST_USER.number)
    ]).then(([_active, s]) => {
      if(s){
        AIC_MESSAGES = Array.isArray(s.messages) ? s.messages : [];
        AIC_CODE = s.code || '';
        AIC_TURN_COUNT = s.turnCount || 0;
      }
      AIC_VIEW = _aicInitialStudentView(s);
      render();
    });
  } else if(t === 'asmt-guide'){
    // 수행평가 안내(연습) — 매 진입 시 새로 시작 (제출·저장 없음)
    AG_STAGE = 1; AG_ANS = { a: '', b: {}, blanks: {} };
    AG_RUN = null; AG_TEST = null; AG_RUNNING = false; AG_STDIN = '';
    render();
  } else if(t === 'asmt' && SEL_CLS && ST_USER){
    // 수행평가 — 내 제출(진행상황) 로드 후 적절한 단계/화면 결정
    ASMT_ANS = { a: '', b: {}, blanks: {} };
    ASMT_STAGE = 1;
    ASMT_VIEW = 'exam';
    ASMT_RUN = null;
    ASMT_TEST = null;
    ASMT_RUNNING = false;
    loadAsmtSubmission(SEL_CLS.id, ST_USER.number).then(sub => {
      ASMT_SUB = sub;
      if(sub){
        ASMT_ANS = { a: sub.a || '', b: sub.b || {}, blanks: sub.blanks || {} };
        if(sub.submittedAt){ ASMT_VIEW = 'done'; }
        else if(sub.stage === 2){ ASMT_STAGE = 2; }
      }
      render();
    });
  } else if(t === 'myscore' && SEL_CLS && ST_USER){
    // 📊 내 점수 — 공개 토글 + 사유 공개 토글 + 내 점수 함께 로드
    MY_SCORES = null; MY_SCORES_PUB = null; MY_REASONS_PUB = null;
    render(); // 로딩 표시
    Promise.all([
      loadAsmtPublished(SEL_CLS.id),
      loadAsmtReasonsPublished(SEL_CLS.id),
      loadMyAsmtScores(SEL_CLS.id, ST_USER.number),
    ]).then(([pub, rpub, scores]) => {
      MY_SCORES_PUB = pub;
      MY_REASONS_PUB = rpub;
      MY_SCORES = scores;
      if(ST_TAB === 'myscore') render();
    });
  } else if(t === 'mission' && SEL_CLS && ST_USER){
    // 미션 그리드 카드의 진행률 표시용 — 한 번에 로드
    MISSION_VIEW = 'list';
    SEL_MISSION = null;
    MISSION_PROGRESS_ALL = null;
    render(); // 일단 빈 진행률로 렌더
    loadAllMissionProgress(SEL_CLS.id, ST_USER.number).then(prog => {
      MISSION_PROGRESS_ALL = prog;
      if(ST_TAB === 'mission' && MISSION_VIEW === 'list') render();
    });
  } else {
    render();
  }
}

// ── 대시보드 홈 탭 ──
function vStDashboard(){
  const clsType = SEL_CLS?.type || 'normal';
  const isInfo = clsType === 'info';

  // 과제 통계
  const totalAssign = ASSIGNMENTS.length;
  const doneAssign = ASSIGNMENTS.filter(a => SUBMISSIONS[a.id] && SUBMISSIONS[a.id][ST_USER?.number]).length;
  const pendingAssign = totalAssign - doneAssign;
  const urgentAssigns = ASSIGNMENTS.filter(a => {
    const done = SUBMISSIONS[a.id] && SUBMISSIONS[a.id][ST_USER?.number];
    return !done && a.dueDate && !isPastDue(a.dueDate);
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);

  // 최근 공지 (최대 3개)
  const recentNotices = NOTICES.slice(0, 3);

  // 제출한 파일 목록 (최근 5개)
  const mySubmitted = ASSIGNMENTS
    .filter(a => SUBMISSIONS[a.id] && SUBMISSIONS[a.id][ST_USER?.number])
    .map(a => ({assign: a, sub: SUBMISSIONS[a.id][ST_USER.number]}))
    .sort((a, b) => b.sub.uploadedAt.localeCompare(a.sub.uploadedAt))
    .slice(0, 5);

  // 게시물 수
  const myPosts = POSTS.filter(p => p.authorId === ST_USER?.number).length;

  return `
    <div class="dash-greeting">
      <div class="dash-hello">안녕하세요, <strong>${esc(ST_USER?.name)}</strong>님! 👋</div>
      <div class="dash-class">${esc(SEL_CLS?.emoji)} ${esc(SEL_CLS?.label)}</div>
    </div>

    <div class="dash-stats">
      <div class="dash-stat-card" onclick="setST('assign')">
        <div class="dash-stat-icon">📖</div>
        <div class="dash-stat-body">
          <div class="dash-stat-num">${pendingAssign}</div>
          <div class="dash-stat-label">미제출 수업</div>
        </div>
      </div>
      <div class="dash-stat-card" onclick="setST('assign')">
        <div class="dash-stat-icon">✅</div>
        <div class="dash-stat-body">
          <div class="dash-stat-num" style="color:var(--ok)">${doneAssign}</div>
          <div class="dash-stat-label">제출 완료</div>
        </div>
      </div>
      <div class="dash-stat-card" onclick="setST('assign')">
        <div class="dash-stat-icon">📖</div>
        <div class="dash-stat-body">
          <div class="dash-stat-num">${totalAssign}</div>
          <div class="dash-stat-label">전체 수업</div>
        </div>
      </div>
      <div class="dash-stat-card" onclick="setST('board')">
        <div class="dash-stat-icon">📋</div>
        <div class="dash-stat-body">
          <div class="dash-stat-num">${myPosts}</div>
          <div class="dash-stat-label">내 게시물</div>
        </div>
      </div>
    </div>

    ${urgentAssigns.length ? `
    <div class="dash-section">
      <div class="dash-sec-header">
        <div class="dash-sec-title">⏰ 다가오는 마감</div>
        <button class="btn-xs" onclick="setST('assign')">전체 보기 →</button>
      </div>
      ${urgentAssigns.map(a => `
        <div class="dash-item click" data-action="pick-assign" data-aid="${a.id}">
          <div class="dash-item-icon">📖</div>
          <div class="dash-item-body">
            <div class="dash-item-title">${esc(a.title)}</div>
            <div class="dash-item-meta">마감: ${fmtDay(a.dueDate)}</div>
          </div>
          <div class="dash-item-right">${dday(a.dueDate)}</div>
        </div>`).join('')}
    </div>` : ''}

    ${recentNotices.length ? `
    <div class="dash-section">
      <div class="dash-sec-header">
        <div class="dash-sec-title">📢 최근 공지</div>
        <button class="btn-xs" onclick="setST('notice')">전체 보기 →</button>
      </div>
      ${recentNotices.map(n => `
        <div class="dash-item">
          <div class="dash-item-icon">${n.isPinned ? '📌' : '📢'}</div>
          <div class="dash-item-body">
            <div class="dash-item-title">${esc(n.title)}</div>
            <div class="dash-item-meta">${fmtDt(n.createdAt)}${n.content ? ' · ' + esc(n.content).slice(0, 40) + (n.content.length > 40 ? '…' : '') : ''}</div>
          </div>
        </div>`).join('')}
    </div>` : ''}

    ${mySubmitted.length ? `
    <div class="dash-section">
      <div class="dash-sec-header">
        <div class="dash-sec-title">📄 최근 제출한 파일</div>
        <button class="btn-xs" onclick="setST('mine')">전체 보기 →</button>
      </div>
      ${mySubmitted.map(({assign: a, sub}) => {
        const subFiles = sub.files && sub.files.length ? sub.files : [{name: sub.fileName, url: sub.url}];
        return `<div class="dash-item">
          <div class="dash-item-icon">📄</div>
          <div class="dash-item-body">
            <div class="dash-item-title">${esc(a.title)}</div>
            <div class="dash-item-meta">${subFiles.map(f => esc(f.name)).join(', ')} · ${fmtDt(sub.uploadedAt)}</div>
          </div>
          <div class="dash-item-right"><span class="chip chip-green" style="font-size:10px">제출</span></div>
        </div>`;
      }).join('')}
    </div>` : ''}

    ${isInfo && OJ_PROBLEMS.length ? `
    <div class="dash-section">
      <div class="dash-sec-header">
        <div class="dash-sec-title">💻 OJ 문제</div>
        <button class="btn-xs" onclick="setST('oj')">전체 보기 →</button>
      </div>
      <div class="dash-item-meta" style="padding:0 2px">${OJ_PROBLEMS.length}개 문제 등록됨</div>
    </div>` : ''}
  `;
}

// ── 공지 탭 ──
function vStNotice(){
  if(!NOTICES.length) return emptyBox('📢','등록된 공지가 없습니다.');
  return NOTICES.map(n => noticeCard(n, false)).join('');
}

// ── 수업 탭 (날짜별 오름차순, 월별 접기/펼치기) ──
function vStAssign(){
  if(!ASSIGNMENTS.length) return emptyBox('📖','등록된 수업이 없습니다.');

  // 수업 날짜(classDate) 기준 오름차순 정렬, 없으면 createdAt 사용
  const sorted = [...ASSIGNMENTS].sort((a, b) => {
    const da = a.classDate || a.createdAt?.slice(0, 10) || '';
    const db = b.classDate || b.createdAt?.slice(0, 10) || '';
    return da.localeCompare(db);
  });

  // 월별 그룹핑
  const months = {};
  sorted.forEach(a => {
    const dateStr = a.classDate || a.createdAt?.slice(0, 10) || '';
    const ym = dateStr.slice(0, 7) || '미정';
    if(!months[ym]) months[ym] = [];
    months[ym].push(a);
  });

  // 현재 월 계산
  const curYM = new Date().toISOString().slice(0, 7);

  return Object.entries(months).map(([ym, items]) => {
    const label = ym === '미정' ? '날짜 미정' : ym.replace('-', '년 ') + '월';
    const isOpen = ym === curYM || ym === '미정';
    return `<div class="month-group${isOpen ? '' : ' collapsed'}">
      <div class="month-header" onclick="this.parentElement.classList.toggle('collapsed')">
        <span class="month-arrow">▼</span>
        <span class="month-label">${label}</span>
        <span class="month-count">${items.length}개</span>
      </div>
      <div class="month-body">
        ${items.map(a => {
          const done = SUBMISSIONS[a.id] && SUBMISSIONS[a.id][ST_USER.number];
          const dateDisp = a.classDate ? fmtDay(a.classDate) : '';
          return `<div class="list-row click" data-action="pick-assign" data-aid="${a.id}">
            <div class="row-icon">📖</div>
            <div class="row-info">
              <div class="row-title">${esc(a.title)}</div>
              <div class="row-meta">${dateDisp ? `📅 ${dateDisp}` : ''}${a.dueDate ? ` · 마감: ${fmtDay(a.dueDate)}` : ''}</div>
              ${a.dueDate ? `<div class="sbar"><div class="sbar-fill" style="width:${done ? 100 : 0}%"></div></div>` : ''}
            </div>
            <div class="row-right">
              ${a.dueDate ? dday(a.dueDate) : ''}
              ${done ? `<span class="chip chip-green">✓ 제출완료</span>`
                    : a.dueDate && isPastDue(a.dueDate) ? `<span class="chip chip-red">미제출</span>`
                    : a.dueDate ? `<span class="chip chip-gray">미제출</span>` : ''}
            </div>
          </div>`;
        }).join('')}
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
      <div class="row-icon">📖</div>
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
      <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">전체 수업</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--ok)">${submitted}</div><div class="stat-label">제출 완료</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--danger)">${total - submitted}</div><div class="stat-label">미제출</div></div>
      <div class="stat-card"><div class="stat-num">${myPosts.length}</div><div class="stat-label">내 게시물</div></div>
    </div>
    <div class="section">
      <div class="sec-title">📖 수업 현황</div>
      ${myAssigns || emptyBox('📖','수업이 없습니다.')}
    </div>
    <div class="section">
      <div class="sec-title">📋 내 게시물</div>
      ${myPostsHtml}
    </div>`;
}
