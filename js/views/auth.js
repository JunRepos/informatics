/* ═══════════════════════════════════════
   views/auth.js — 로그인 / 비밀번호 변경 화면

   학생 로그인, 선생님 로그인, 최초 비밀번호 변경
═══════════════════════════════════════ */

// 학생 로그인
function vStudentLogin(){
  return `
    <div class="back-btn" onclick="goHome()">← 반 선택으로</div>
    <div class="login-wrap">
      <div class="section">
        <div class="sec-title">${esc(SEL_CLS?.label)} 로그인</div>
        <div class="form">
          <div class="field"><label>학번</label><input id="sl-num" class="big-input" type="text" placeholder="학번 입력" maxlength="10" autocomplete="off"/></div>
          <div class="field"><label>비밀번호</label><input id="sl-pw" type="password" placeholder="비밀번호" autocomplete="current-password"/></div>
          <div id="sl-err" class="err"></div>
          <button id="sl-btn" class="btn-p btn-full" style="margin-top:4px">로그인</button>
        </div>
        <div class="divider"></div>
        <div style="text-align:center;font-size:12px;color:var(--text3)">
          계정이 없다면 선생님께 등록 요청하세요<br>
          <span style="color:var(--text2)">초기 비밀번호는 학번과 동일합니다</span>
        </div>
      </div>
    </div>`;
}

// 비밀번호 강제 변경 (최초 로그인)
function vChangePw(){
  return `
    <div class="login-wrap">
      <div class="section">
        <div class="sec-title">🔐 비밀번호 변경</div>
        <div class="box-warn">처음 로그인하셨습니다. 보안을 위해 비밀번호를 변경해주세요.</div>
        <div class="form">
          <div class="field"><label>새 비밀번호 (4자 이상)</label><input id="cp-new" type="password" autocomplete="new-password"/></div>
          <div class="field"><label>비밀번호 확인</label><input id="cp-con" type="password" autocomplete="new-password"/></div>
          <div id="cp-err" class="err"></div>
          <button id="cp-btn" class="btn-p btn-full" style="margin-top:4px">변경 후 시작하기</button>
        </div>
      </div>
    </div>`;
}

// 선생님 로그인
function vTeacherLogin(){
  if(FIRST_SETUP) return `
    <div class="back-btn" onclick="goHome()">← 홈으로</div>
    <div class="login-wrap"><div class="section">
      <div class="sec-title">🔐 선생님 비밀번호 초기 설정</div>
      <div class="box-info">처음 사용하시네요. 선생님 비밀번호를 설정해주세요.</div>
      <div class="form">
        <div class="field"><label>새 비밀번호</label><input id="tl-pw" type="password" placeholder="4자 이상" autocomplete="new-password"/></div>
        <div class="field"><label>비밀번호 확인</label><input id="tl-pw2" type="password" placeholder="동일하게 입력" autocomplete="new-password"/></div>
        <div id="tl-err" class="err"></div>
        <button id="tl-btn" class="btn-p btn-full" style="margin-top:4px">설정 후 로그인</button>
      </div>
    </div></div>`;

  return `
    <div class="back-btn" onclick="goHome()">← 홈으로</div>
    <div class="login-wrap"><div class="section">
      <div class="sec-title">👩‍🏫 선생님 로그인</div>
      <div class="form">
        <div class="field"><label>비밀번호</label><input id="tl-pw" type="password" placeholder="비밀번호" autocomplete="current-password"/></div>
        <div id="tl-err" class="err"></div>
        <button id="tl-btn" class="btn-p btn-full" style="margin-top:4px">로그인</button>
      </div>
    </div></div>`;
}
