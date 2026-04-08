/* ═══════════════════════════════════════
   views/shared.js — 공통 UI 컴포넌트

   여러 화면에서 재사용하는 UI 조각들입니다.
   탭 버튼, 빈 화면, 공지카드 등
═══════════════════════════════════════ */

// 다중 반 선택 체크박스 (신규 등록 시에만 표시)
function multiClassPicker(idPrefix, currentClassId){
  const checks = CLASSES.map(c => {
    const checked = c.id === currentClassId ? 'checked' : '';
    return `<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;color:var(--text2);font-weight:500;text-transform:none;letter-spacing:0">
      <input type="checkbox" class="${idPrefix}-cls-chk" value="${c.id}" style="width:auto" ${checked}/> ${c.emoji} ${c.label}
    </label>`;
  }).join('');
  return `<div class="field">
    <label>등록할 반 선택</label>
    <div style="display:flex;flex-wrap:wrap;gap:8px 14px;padding:8px 0">
      ${checks}
      <button type="button" class="btn-xs" onclick="document.querySelectorAll('.${idPrefix}-cls-chk').forEach(c=>c.checked=true)" style="margin-left:4px">전체 선택</button>
      <button type="button" class="btn-xs" onclick="document.querySelectorAll('.${idPrefix}-cls-chk').forEach(c=>c.checked=false)">전체 해제</button>
    </div>
  </div>`;
}

// 선택된 반 ID 배열 가져오기
function getSelectedClasses(idPrefix){
  return Array.from(document.querySelectorAll(`.${idPrefix}-cls-chk:checked`)).map(c => c.value);
}

// 탭 버튼 생성
function tab(label, key, active, fn){
  return `<button class="tab${active === key ? ' active' : ''}" onclick="${fn}">${label}</button>`;
}

// 빈 화면 표시
function emptyBox(icon, msg){
  return `<div class="empty"><div class="empty-icon">${icon}</div>${msg}</div>`;
}

// 파일 그룹을 묶어서 렌더링 (학생/선생님 공용)
function groupFiles(files){
  const groups = {};
  files.forEach(f => {
    const gid = f.groupId || f.id;
    if(!groups[gid]) groups[gid] = {title: f.groupTitle || '', desc: f.groupDesc || '', uploadedAt: f.uploadedAt, files: []};
    groups[gid].files.push(f);
  });
  return groups;
}

// 파일 카드 렌더링 (개별 파일)
function fileCardHtml(f, opts = {}){
  const buttons = [];
  if(isImg(f.name)) buttons.push(`<button class="btn-xs" data-action="preview-img" data-url="${esc(f.url)}" data-name="${esc(f.name)}">👁</button>`);
  buttons.push(`<button class="btn-xs btn-p" data-action="dl-tc-file" data-id="${f.id}">↓${opts.dlLabel ? ' ' + opts.dlLabel : ''}</button>`);
  if(opts.canDelete) buttons.push(`<button class="btn-xs btn-danger" data-action="del-tc-file" data-id="${f.id}" data-path="${esc(f.storagePath || '')}" data-fname="${esc(f.name)}">✕</button>`);
  return `<div class="file-card" style="margin-bottom:6px">
    <div class="file-icon">${fIcon(f.name)}</div>
    <div class="file-info"><div class="file-name">${esc(f.name)}</div><div class="file-meta2">${fmtSz(f.size)}</div></div>
    <div style="display:flex;gap:4px;flex-wrap:wrap">${buttons.join('')}</div>
  </div>`;
}

// 공지사항 카드 (학생/선생님 공용)
function noticeCard(n, isTeacher = false){
  // 다중 파일 지원 (files 배열이 있으면 사용, 없으면 기존 단일 파일 호환)
  const allFiles = n.files && n.files.length > 1
    ? n.files
    : n.fileName ? [{name: n.fileName, url: n.fileUrl, path: n.filePath}] : [];

  const imgHtml = allFiles.length
    ? allFiles.map(f => isImg(f.name)
        ? `<img src="${esc(f.url)}" alt="${esc(f.name)}"
            style="max-width:100%;border-radius:var(--r-md);margin-top:10px;display:block;cursor:pointer"
            data-action="preview-img" data-url="${esc(f.url)}" data-name="${esc(f.name)}"/>`
        : `<div class="file-card" style="margin-top:10px;margin-bottom:0">
            <div class="file-icon">${fIcon(f.name)}</div>
            <div class="file-info"><div class="file-name">${esc(f.name)}</div></div>
            <button class="btn-p btn-sm" data-action="dl-notice-file" data-url="${esc(f.url)}" data-name="${esc(f.name)}">다운로드</button>
          </div>`
      ).join('')
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
