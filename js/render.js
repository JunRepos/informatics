/* ═══════════════════════════════════════
   render.js — 렌더링 코어

   화면 전환, 이미지 모달, 테마 토글 등
   앱의 메인 렌더링 로직을 담당합니다.
═══════════════════════════════════════ */

// ── 테마 초기화 ──
(()=>{
  const saved = localStorage.getItem('theme');
  const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', saved || (sys ? 'dark' : 'light'));
})();

function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.querySelectorAll('.theme-btn').forEach(b => b.textContent = next === 'dark' ? '☀️' : '🌙');
}

// ── 본문 너비 결정 ──
// 화면/탭에 따라 .wrap 컨테이너 너비 조정
//   full(1600px): 노트북 / 미션 / OJ 풀이 (IDE 느낌)
//   wide(1280px): OJ 목록 / 진도 계획 (테이블·분할 뷰)
//   기본(840px) : 공지/수업/게시판/출결/학생관리/로그인 등 텍스트·폼 위주
function applyWrapWidth(){
  const wrap = document.querySelector('.wrap');
  if(!wrap) return;
  let cls = '';
  if(VIEW === 'oj-solve'){
    cls = 'full';
  } else if(VIEW === 'teacher'){
    if(TC_TAB === 'notebook' || TC_TAB === 'mission') cls = 'full';
    else if(TC_TAB === 'oj' || TC_TAB === 'curriculum') cls = 'wide';
  } else if(VIEW === 'student'){
    if(ST_TAB === 'notebook' || ST_TAB === 'mission') cls = 'full';
    else if(ST_TAB === 'oj') cls = 'wide';
  }
  wrap.className = 'wrap' + (cls ? ' ' + cls : '');
}

// ── 메인 렌더링 ──
function render(){
  applyWrapWidth();
  const theme = document.documentElement.getAttribute('data-theme');
  const themeIcon = theme === 'dark' ? '☀️' : '🌙';

  // OJ 풀이 화면 (특수 처리 — 분할 패널)
  if(VIEW === 'oj-solve'){
    document.getElementById('root').innerHTML = `
      <div class="header">
        <div class="hbrand"><div class="hicon">📂</div>
          <div><span style="font-size:13px;font-weight:600">${esc(ST_USER?.number)} ${esc(ST_USER?.name)}</span><span class="chip chip-blue" style="margin-left:6px">${esc(SEL_CLS?.label)}</span></div>
        </div>
        <div class="hright">
          <button class="btn-sm" onclick="goHome()">🏠 홈</button>
          <button class="btn-sm btn-danger" onclick="logoutStudent()">로그아웃</button>
          <button class="theme-btn" onclick="toggleTheme()">${themeIcon}</button>
        </div>
      </div>${vStOJSolve()}`;
    afterRender();
    return;
  }

  // 새 게시물 작성 화면 (특수 처리)
  if(VIEW === 'new-post'){
    document.getElementById('root').innerHTML = `
      <div class="header">
        <div class="hbrand"><div class="hicon">📂</div>
          <div><span style="font-size:13px;font-weight:600">${esc(ST_USER?.number)} ${esc(ST_USER?.name)}</span><span class="chip chip-blue" style="margin-left:6px">${esc(SEL_CLS?.label)}</span></div>
        </div>
        <div class="hright">
          <button class="btn-sm" onclick="goHome()">🏠 홈</button>
          <button class="btn-sm btn-danger" onclick="logoutStudent()">로그아웃</button>
          <button class="theme-btn" onclick="toggleTheme()">${themeIcon}</button>
        </div>
      </div>${vNewPost()}`;
    afterRender();
    return;
  }

  // 헤더 좌측
  let hLeft = '', hRight = '';
  if(VIEW === 'home'){
    hLeft = `<div class="htitle">학급 파일함</div><div class="hsub">반을 선택해 시작하세요</div>`;
  } else if(IS_TC){
    hLeft = `<span class="hbadge">👩‍🏫 선생님</span>`;
    if(TC_CLS) hLeft += `<span style="font-size:13px;font-weight:600;color:var(--text2)">${esc(TC_CLS.label)}</span>`;
  } else if(ST_USER){
    hLeft = `<span style="font-size:13px;font-weight:600">${esc(ST_USER.number)} ${esc(ST_USER.name)}</span>
             <span class="chip chip-blue">${esc(SEL_CLS?.label)}</span>`;
  } else {
    hLeft = `<span style="font-size:13px;color:var(--text2)">${esc(SEL_CLS?.label || '')}</span>`;
  }

  // 헤더 우측
  if(IS_TC){
    hRight = `<button class="btn-sm" onclick="goHome()">🏠 홈</button>
              <button class="btn-sm btn-danger" onclick="logoutTeacher()">로그아웃</button>
              <button class="theme-btn" onclick="toggleTheme()">${themeIcon}</button>`;
  } else if(ST_USER){
    hRight = `<button class="btn-sm" onclick="goHome()">🏠 홈</button>
              <button class="btn-sm btn-danger" onclick="logoutStudent()">로그아웃</button>
              <button class="theme-btn" onclick="toggleTheme()">${themeIcon}</button>`;
  } else {
    hRight = `<button class="btn-sm" onclick="go('teacher-login')">👩‍🏫 선생님</button>
              <button class="theme-btn" onclick="toggleTheme()">${themeIcon}</button>`;
  }

  // 본문
  let body = '';
  if     (VIEW === 'home')           body = vHome();
  else if(VIEW === 'student-login')  body = vStudentLogin();
  else if(VIEW === 'change-pw')      body = vChangePw();
  else if(VIEW === 'student')        body = vStudent();
  else if(VIEW === 'post-detail')    body = vPostDetail();
  else if(VIEW === 'assign-detail')  body = vAssignDetail();
  else if(VIEW === 'teacher-login')  body = vTeacherLogin();
  else if(VIEW === 'teacher')        body = vTeacher();

  document.getElementById('root').innerHTML = `
    <div class="header">
      <div class="hbrand"><div class="hicon">📂</div><div>${hLeft}</div></div>
      <div class="hright">${hRight}</div>
    </div>${body}`;
  afterRender();
}

// ── 화면 전환 ──
function go(v, extra = {}){
  VIEW = v;
  if(extra.post){ SEL_POST = extra.post; POST_UNLOCKED = false; }
  if(extra.assign){ SEL_ASSIGN = extra.assign; }
  saveSession();
  history.pushState({view: v}, '', '#' + v);
  render();
}

// ── 홈으로 ──
async function goHome(){
  VIEW = 'home'; SEL_CLS = null; TC_CLS = null; ST_USER = null; SEL_POST = null; SEL_ASSIGN = null;
  clearSession();
  history.pushState({view: 'home'}, '', '#home');
  await loadPostCounts();
  render();
}

// ── 브라우저 뒤로가기/앞으로가기 ──
window.addEventListener('popstate', async () => {
  if(restoreSession()){
    const cid = SEL_CLS?.id || TC_CLS?.id;
    if(cid) await loadAllClassData(cid);
  } else {
    VIEW = 'home'; SEL_CLS = null; TC_CLS = null; ST_USER = null;
    await loadPostCounts();
  }
  render();
});

// ── 로그아웃 ──
function logoutTeacher(){ IS_TC = false; TC_CLS = null; TC_TAB = 'notice'; clearSession(); goHome(); }
function logoutStudent(){ ST_USER = null; FORCE_PW = false; ST_TAB = 'dashboard'; clearSession(); go('student-login'); }

// ── 이미지 미리보기 모달 ──
function showImgModal(url, name){
  document.getElementById('modal-root').innerHTML = `
    <div class="modal-ov" onclick="closeModal()">
      <button class="modal-close" onclick="closeModal()">✕ 닫기</button>
      <img class="modal-img" src="${esc(url)}" alt="${esc(name)}" onclick="event.stopPropagation()"/>
    </div>`;
}
function closeModal(){
  document.getElementById('modal-root').innerHTML = '';
}

// ── 렌더링 후 바인딩 ──
function afterRender(){
  document.getElementById('mig-load-btn')?.addEventListener('click', bindMigration);

  document.getElementById('zip-btn')?.addEventListener('click', e => {
    doZipDownload(e.currentTarget.dataset.aid);
  });

  const theme = document.documentElement.getAttribute('data-theme');
  document.querySelectorAll('.theme-btn').forEach(b => b.textContent = theme === 'dark' ? '☀️' : '🌙');

  // 노트북 CodeMirror 초기화 — DOM 레이아웃 완료 후 실행 (타이밍 이슈 방지)
  if(typeof initNotebookCMs === 'function' && document.querySelector('.cb-wrap')){
    // 즉시 한 번 호출 + 다음 프레임에 한 번 더 호출
    // (stale CM 체크가 있어서 중복 호출 안전함)
    initNotebookCMs();
    requestAnimationFrame(() => {
      if(document.querySelector('.cb-wrap')) initNotebookCMs();
    });
  }

  // 미션 게임 초기화/정리
  if(typeof afterRenderMission === 'function'){
    afterRenderMission();
  }

  // CodeMirror 초기화 (OJ 풀이 화면)
  const cmEl = document.getElementById('oj-code-editor');
  if(cmEl && !cmEl._cm && typeof CodeMirror !== 'undefined'){
    cmEl.style.display = '';
    const cm = CodeMirror.fromTextArea(cmEl, {
      mode: 'python',
      theme: theme === 'dark' ? 'dracula' : 'default',
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false,
      matchBrackets: true,
      extraKeys: {'Tab': (ed) => ed.replaceSelection('    ', 'end')}
    });
    cm.setSize('100%', '100%');
    cm.setValue(OJ_CODE || '');
    cm.on('change', (ed) => {
      OJ_CODE = ed.getValue();
      // 학생이면 1.5초 debounce 자동 저장
      if(typeof scheduleOJDraftSave === 'function') scheduleOJDraftSave();
    });
    cmEl._cm = cm;
  // OJ 에디터/결과 리사이즈 핸들
  const ojResizeH = document.getElementById('oj-resize-h');
  const ojEditorSec = document.querySelector('.oj-editor-section');
  const ojResultsPanel = document.getElementById('oj-results-panel');
  if(ojResizeH && ojEditorSec && ojResultsPanel){
    let rStartY, rStartEdH, rStartResH;
    const onRDrag = (e) => {
      const dy = (e.clientY || e.touches?.[0]?.clientY || 0) - rStartY;
      ojEditorSec.style.flex = 'none';
      ojEditorSec.style.height = Math.max(120, rStartEdH + dy) + 'px';
      ojResultsPanel.style.flex = 'none';
      ojResultsPanel.style.height = Math.max(100, rStartResH - dy) + 'px';
    };
    const onREnd = () => {
      document.removeEventListener('mousemove', onRDrag);
      document.removeEventListener('mouseup', onREnd);
      document.removeEventListener('touchmove', onRDrag);
      document.removeEventListener('touchend', onREnd);
    };
    ojResizeH.addEventListener('mousedown', e => {
      rStartY = e.clientY; rStartEdH = ojEditorSec.offsetHeight; rStartResH = ojResultsPanel.offsetHeight;
      document.addEventListener('mousemove', onRDrag); document.addEventListener('mouseup', onREnd);
      e.preventDefault();
    });
    ojResizeH.addEventListener('touchstart', e => {
      rStartY = e.touches[0].clientY; rStartEdH = ojEditorSec.offsetHeight; rStartResH = ojResultsPanel.offsetHeight;
      document.addEventListener('touchmove', onRDrag); document.addEventListener('touchend', onREnd);
      e.preventDefault();
    });
  }

  } else if(cmEl && !cmEl._cm){
    cmEl.style.display = '';
    cmEl.style.fontFamily = 'monospace';
    cmEl.style.fontSize = '14px';
    cmEl.style.minHeight = '100%';
    cmEl.style.width = '100%';
    cmEl.style.padding = '12px';
    cmEl.style.tabSize = '4';
    cmEl.addEventListener('input', () => {
      OJ_CODE = cmEl.value;
      if(typeof scheduleOJDraftSave === 'function') scheduleOJDraftSave();
    });
    cmEl.addEventListener('keydown', (e) => {
      if(e.key === 'Tab'){
        e.preventDefault();
        const s = cmEl.selectionStart;
        cmEl.value = cmEl.value.substring(0, s) + '    ' + cmEl.value.substring(cmEl.selectionEnd);
        cmEl.selectionStart = cmEl.selectionEnd = s + 4;
      }
    });
  }
}
