/* ═══════════════════════════════════════
   views/post.js — 궁금증 상세 & 새 궁금증

   누구나 열람(학생=익명 표시 / 선생님=실명).
   답변은 선생님만 작성. 파일 첨부는 선택.
═══════════════════════════════════════ */

// 궁금증 상세보기
function vPostDetail(){
  const p = SEL_POST;
  if(!p) return emptyBox('❌','궁금증을 찾을 수 없습니다.');

  const isMine = ST_USER && p.authorId === ST_USER.number;
  const back = IS_TC
    ? `<div class="back-btn" onclick="go('teacher')">← 궁금증 게시판으로</div>`
    : `<div class="back-btn" onclick="go('student')">← 궁금증 게시판으로</div>`;

  // 작성자 표시 — 선생님만 실명, 학생에게는 익명(본인은 '나')
  const who = IS_TC
    ? `${esc(p.authorName)} (${esc(p.authorId)})`
    : (isMine ? '나 (익명으로 표시됨)' : '익명');

  const hasFile = p.fileName && p.fileName.length;
  const fileHtml = hasFile ? `
    <div class="file-card" style="margin-top:14px">
      <div class="file-icon">${fIcon(p.fileName)}</div>
      <div class="file-info"><div class="file-name">${esc(p.fileName)}</div><div class="file-meta2">${fmtSz(p.fileSize)}</div></div>
      ${isImg(p.fileName) ? `<button class="btn-sm" data-action="preview-img" data-url="${esc(p.url)}" data-name="${esc(p.fileName)}">미리보기</button>` : ''}
      <button class="btn-sm btn-p" data-action="dl-post-file">📥 다운로드</button>
    </div>` : '';

  // 답변 영역 — 선생님은 작성/수정, 학생은 열람만
  let answerHtml;
  if(IS_TC){
    answerHtml = `
      <div class="divider"></div>
      <div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:8px">👩‍🏫 선생님 답변</div>
      <textarea id="ans-text" maxlength="5000" placeholder="답변을 입력하세요">${esc(p.answer || '')}</textarea>
      <div id="ans-msg" style="font-size:12px;min-height:16px;margin-top:4px"></div>
      <button id="ans-submit" class="btn-p btn-sm" style="margin-top:4px">${p.answer ? '답변 수정' : '답변 등록'}</button>`;
  } else {
    answerHtml = p.answer ? `
      <div class="divider"></div>
      <div class="box-ok" style="white-space:pre-line">
        <div style="font-weight:700;margin-bottom:6px">👩‍🏫 선생님 답변</div>${esc(p.answer)}
        ${p.answeredAt ? `<div style="font-size:11px;color:var(--text3);margin-top:8px">${fmtDt(p.answeredAt)}</div>` : ''}
      </div>` : `
      <div class="divider"></div>
      <div class="box-info">⏳ 아직 선생님 답변이 없습니다. 조금만 기다려 주세요.</div>`;
  }

  return back + `<div class="section">
    <div style="font-size:16px;font-weight:700;margin-bottom:5px">${esc(p.title)}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:14px">${who} · ${fmtDt(p.uploadedAt)}</div>
    ${p.memo ? `<div style="font-size:14px;color:var(--text);white-space:pre-line;line-height:1.7">${esc(p.memo)}</div>` : ''}
    ${fileHtml}
    ${answerHtml}
    ${IS_TC ? `
      <div class="divider"></div>
      <button class="btn-danger btn-sm" data-action="del-post">이 궁금증 삭제</button>` : ''}
    ${isMine && !IS_TC ? `
      <div class="divider"></div>
      <button class="btn-danger btn-sm" data-action="del-post">내 궁금증 삭제</button>` : ''}
  </div>`;
}

// 새 궁금증 작성 폼
function vNewPost(){
  return `
    <div class="back-btn" onclick="setST('board');go('student')">← 궁금증 게시판으로</div>
    <div class="section">
      <div class="sec-title">❓ 궁금증 남기기</div>
      <div class="box-info">궁금한 점을 자유롭게 남겨주세요.<br>친구들에게는 <b>익명</b>으로 보이고, 선생님께만 이름이 보여요. 답변은 선생님이 달아드립니다.</div>
      <div class="form" id="np-form">
        <div class="field"><label>제목 (궁금한 점 한 줄 요약)</label><input id="np-title" type="text" maxlength="200" placeholder="예: 반복문에서 i는 왜 0부터 시작하나요?" autocomplete="off"/></div>
        <div class="field"><label>궁금한 내용 (선택)</label><textarea id="np-memo" maxlength="1000" placeholder="자세히 적으면 더 정확한 답변을 받을 수 있어요"></textarea></div>
        <div class="field"><label>파일 첨부 (선택, 최대 50MB)</label><input id="np-file" type="file"/></div>
        <div class="prog-wrap" id="np-prog">
          <div class="prog-label">업로드 중... <span id="np-pct">0%</span></div>
          <div class="prog-bar"><div class="prog-fill" id="np-pfill" style="width:0%"></div></div>
        </div>
        <div id="np-err" class="err"></div>
        <button id="np-submit" class="btn-p btn-full" style="margin-top:4px">궁금증 올리기</button>
      </div>
    </div>`;
}
