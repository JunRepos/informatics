/* ═══════════════════════════════════════
   views/home.js — 홈 화면 (반 선택)

   처음 접속하면 보이는 반 목록 그리드입니다.
═══════════════════════════════════════ */

function vHome(){
  const cards = CLASSES.map(c => {
    const cnt = POST_COUNTS[c.id] || 0;
    return `<div class="class-card${c.type === 'info' ? ' info-type' : ''}" data-action="pick-class" data-cid="${c.id}">
      <div class="cc-emoji">${c.emoji}</div>
      <div class="cc-label">${esc(c.label)}</div>
      <div class="cc-meta">게시물 ${cnt}개</div>
    </div>`;
  }).join('');

  return `<div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:11px">반을 선택하세요</div>
    <div class="class-grid">${cards}</div>`;
}
