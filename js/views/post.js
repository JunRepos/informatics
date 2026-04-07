/* ═══════════════════════════════════════
   views/post.js — 게시물 상세 & 새 게시물

   게시물 상세보기(비밀번호 확인, 다운로드)와
   새 게시물 작성 폼
═══════════════════════════════════════ */

// 게시물 상세보기
function vPostDetail(){
  const p = SEL_POST;
  if(!p) return emptyBox('❌','게시물을 찾을 수 없습니다.');

  const isMine = ST_USER && p.authorId === ST_USER.number;
  const canSee = IS_TC || isMine || POST_UNLOCKED;
  const back = IS_TC
    ? `<div class="back-btn" onclick="go('teacher')">← 게시판으로</div>`
    : `<div class="back-btn" onclick="go('student')">← 게시판으로</div>`;

  // 비밀번호 미입력 상태
  if(!canSee){
    return back + `<div class="section" style="max-width:360px;margin:0 auto">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:13px">
        <div class="row-icon" style="width:40px;height:40px;font-size:20px">${fIcon(p.fileName)}</div>
        <div><div style="font-size:14px;font-weight:700">${esc(p.title)}</div>
             <div style="font-size:11px;color:var(--text3)">${esc(p.authorName)} · ${fmtDt(p.uploadedAt)}</div></div>
      </div>
      <div class="form">
        <div class="field"><label>비밀번호를 입력하면 파일을 다운로드할 수 있습니다</label>
          <input id="pd-pw" type="password" placeholder="비밀번호 입력" autocomplete="off"/></div>
        <div id="pd-err" class="err"></div>
        <button id="pd-ok" class="btn-p btn-full">확인</button>
      </div>
    </div>`;
  }

  // 열람 가능 상태
  return back + `<div class="section">
    <div style="font-size:16px;font-weight:700;margin-bottom:5px">${esc(p.title)}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:14px">${esc(p.authorName)} (${esc(p.authorId)}) · ${fmtDt(p.uploadedAt)}</div>
    ${p.memo ? `<div class="box-info" style="margin-bottom:14px">💬 ${esc(p.memo)}</div>` : ''}
    <div class="file-card">
      <div class="file-icon">${fIcon(p.fileName)}</div>
      <div class="file-info"><div class="file-name">${esc(p.fileName)}</div><div class="file-meta2">${fmtSz(p.fileSize)}</div></div>
      ${isImg(p.fileName) ? `<button class="btn-sm" data-action="preview-img" data-url="${esc(p.url)}" data-name="${esc(p.fileName)}">미리보기</button>` : ''}
    </div>
    <button class="btn-p btn-full" data-action="dl-post-file">📥 파일 다운로드</button>
    ${IS_TC ? `
      <div class="divider"></div>
      <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:8px">🔐 비밀번호 초기화</div>
      <div style="display:flex;gap:7px;margin-bottom:8px">
        <input id="reset-pw" type="password" placeholder="새 비밀번호 (빈칸=0000)" autocomplete="new-password" style="flex:1;font-size:13px;padding:7px 10px"/>
        <button id="reset-btn" class="btn-sm" style="border-color:var(--warn-bd);color:var(--warn-txt);background:var(--warn-bg)">초기화</button>
      </div>
      <div id="reset-msg" style="font-size:12px;min-height:16px"></div>
      <div class="divider"></div>
      <button id="del-post-btn" class="btn-danger btn-sm" data-action="del-post">이 게시물 삭제</button>` : ''}
    ${isMine && !IS_TC ? `
      <div class="divider"></div>
      <button id="del-my-post-btn" class="btn-danger btn-sm" data-action="del-post">내 게시물 삭제</button>` : ''}
  </div>`;
}

// 새 게시물 작성 폼
function vNewPost(){
  return `
    <div class="back-btn" onclick="setST('board');go('student')">← 게시판으로</div>
    <div class="section">
      <div class="sec-title">📤 게시물 올리기</div>
      <div class="box-info">비밀번호를 아는 사람만 파일을 다운로드할 수 있습니다.<br>비밀번호는 선생님께 따로 알려드리세요.</div>
      <div class="form" id="np-form">
        <div class="field"><label>게시물 제목</label><input id="np-title" type="text" placeholder="예: 3번 과제 제출합니다" autocomplete="off"/></div>
        <div class="field"><label>비밀번호 설정</label><input id="np-pw" type="password" placeholder="비밀번호를 설정하세요" autocomplete="new-password"/></div>
        <div class="field"><label>선생님께 남길 메모 (선택)</label><textarea id="np-memo" placeholder="메모"></textarea></div>
        <div class="field"><label>파일 선택 (최대 50MB)</label><input id="np-file" type="file"/></div>
        <div class="prog-wrap" id="np-prog">
          <div class="prog-label">업로드 중... <span id="np-pct">0%</span></div>
          <div class="prog-bar"><div class="prog-fill" id="np-pfill" style="width:0%"></div></div>
        </div>
        <div id="np-err" class="err"></div>
        <button id="np-submit" class="btn-p btn-full" style="margin-top:4px">게시물 올리기</button>
      </div>
    </div>`;
}
