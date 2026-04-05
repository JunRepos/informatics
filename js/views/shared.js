/* ═══════════════════════════════════════
   views/shared.js — 공통 UI 컴포넌트

   여러 화면에서 재사용하는 UI 조각들입니다.
   탭 버튼, 빈 화면, 공지카드 등
═══════════════════════════════════════ */

// 탭 버튼 생성
function tab(label, key, active, fn){
  return `<button class="tab${active === key ? ' active' : ''}" onclick="${fn}">${label}</button>`;
}

// 빈 화면 표시
function emptyBox(icon, msg){
  return `<div class="empty"><div class="empty-icon">${icon}</div>${msg}</div>`;
}

// 공지사항 카드 (학생/선생님 공용)
function noticeCard(n, isTeacher = false){
  const imgHtml = n.fileName && isImg(n.fileName)
    ? `<img src="${esc(n.fileUrl)}" alt="${esc(n.fileName)}"
        style="max-width:100%;border-radius:var(--r-md);margin-top:10px;display:block;cursor:pointer"
        data-action="preview-img" data-url="${esc(n.fileUrl)}" data-name="${esc(n.fileName)}"/>`
    : n.fileName
      ? `<div class="file-card" style="margin-top:10px;margin-bottom:0">
          <div class="file-icon">${fIcon(n.fileName)}</div>
          <div class="file-info"><div class="file-name">${esc(n.fileName)}</div></div>
          <button class="btn-p btn-sm" data-action="dl-notice-file" data-url="${esc(n.fileUrl)}" data-name="${esc(n.fileName)}">다운로드</button>
        </div>`
      : '';

  const tcBtns = isTeacher ? `
    <div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap">
      <button class="btn-xs" data-action="edit-notice" data-nid="${n.id}"
        data-ntitle="${esc(n.title)}" data-ncontent="${esc(n.content)}" data-npin="${n.isPinned}">✏️ 수정</button>
      <button class="btn-xs" data-action="toggle-pin" data-nid="${n.id}" data-pinned="${n.isPinned}">${n.isPinned ? '📌 고정해제' : '📌 고정'}</button>
      <button class="btn-xs btn-danger" data-action="del-notice" data-nid="${n.id}" data-ntitle="${esc(n.title)}">삭제</button>
    </div>` : '';

  return `<div class="${n.isPinned ? 'box-pin section' : 'section'}" style="margin-bottom:10px">
    ${n.isPinned ? `<div class="pin-label">📌 고정 공지</div>` : ''}
    <div style="font-size:14px;font-weight:700;margin-bottom:5px">${esc(n.title)}</div>
    <div style="font-size:13px;color:var(--text2);white-space:pre-line">${esc(n.content)}</div>
    ${imgHtml}
    <div style="font-size:11px;color:var(--text3);margin-top:8px">${fmtDt(n.createdAt)}</div>
    ${tcBtns}
  </div>`;
}
