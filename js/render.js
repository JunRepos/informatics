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

// ── 메인 렌더링 ──
function render(){
  const theme = document.documentElement.getAttribute('data-theme');
  const themeIcon = theme === 'dark' ? '☀️' : '🌙';

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
  render();
}

// ── 홈으로 ──
async function goHome(){
  VIEW = 'home'; SEL_CLS = null; TC_CLS = null; ST_USER = null; SEL_POST = null; SEL_ASSIGN = null;
  await loadPostCounts();
  render();
}

// ── 로그아웃 ──
function logoutTeacher(){ IS_TC = false; TC_CLS = null; TC_TAB = 'notice'; goHome(); }
function logoutStudent(){ ST_USER = null; FORCE_PW = false; ST_TAB = 'notice'; go('student-login'); }

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
}
