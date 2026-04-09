/* ═══════════════════════════════════════
   views/assignment.js — 과제 상세 (학생 제출)

   학생이 과제를 보고 파일을 제출하는 화면
═══════════════════════════════════════ */

function vAssignDetail(){
  const a = SEL_ASSIGN;
  if(!a) return emptyBox('❌','과제를 찾을 수 없습니다.');

  const sub = ST_USER && SUBMISSIONS[a.id] && SUBMISSIONS[a.id][ST_USER.number];
  const locked = isPastDue(a.dueDate);

  return `
    <div class="back-btn" onclick="go('student')">← 수업 목록으로</div>
    <div class="section">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <div style="font-size:16px;font-weight:700">${esc(a.title)}</div>
        <div style="display:flex;gap:5px;align-items:center">
          ${a.dueDate ? dday(a.dueDate) : ''}
          ${sub ? `<span class="chip chip-green">✓ 제출완료</span>` : ''}
          ${locked && !sub ? `<span class="chip chip-red">마감</span>` : ''}
        </div>
      </div>
      ${a.classDate ? `<div style="font-size:13px;color:var(--text3);margin-bottom:4px">📅 수업 날짜: ${fmtDay(a.classDate)}</div>` : ''}
      ${a.dueDate ? `<div style="font-size:13px;color:var(--text3);margin-bottom:10px">⏰ 마감일: ${fmtDay(a.dueDate)}</div>` : ''}
      ${a.description ? `<div style="font-size:14px;color:var(--text2);white-space:pre-line;margin-bottom:14px;padding:12px;background:var(--surface2);border-radius:var(--r-sm)">${esc(a.description)}</div>` : ''}
      ${(()=>{
        const aFiles = a.files && a.files.length > 1 ? a.files : a.fileName ? [{name: a.fileName, url: a.fileUrl, path: a.filePath}] : [];
        return aFiles.map(f => `<div class="file-card">
          <div class="file-icon">${fIcon(f.name)}</div>
          <div class="file-info"><div class="file-name">${esc(f.name)}</div><div class="file-meta2">첨부파일</div></div>
          <button class="btn-p btn-sm" data-action="dl-notice-file" data-url="${esc(f.url)}" data-name="${esc(f.name)}">다운로드</button>
        </div>`).join('');
      })()}
    </div>
    ${sub ? `<div class="section">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div class="sec-title" style="margin:0">✅ 제출한 파일</div>
        ${!locked ? `<button class="btn-sm" id="resub-toggle-btn" onclick="
          const f=document.getElementById('resub-form');
          f.style.display=f.style.display==='none'?'block':'none';
          this.textContent=f.style.display==='none'?'📤 재제출':'✕ 취소';
        ">📤 재제출</button>` : ''}
      </div>
      ${(()=>{
        const subFiles = sub.files && sub.files.length ? sub.files : [{name: sub.fileName, size: sub.fileSize, url: sub.url}];
        return subFiles.map(f => `<div class="file-card" style="margin-bottom:4px">
          <div class="file-icon">${fIcon(f.name)}</div>
          <div class="file-info"><div class="file-name">${esc(f.name)}</div><div class="file-meta2">${fmtSz(f.size)} · ${fmtDt(sub.uploadedAt)}</div></div>
          <button class="btn-p btn-sm" data-action="dl-my-sub" data-url="${esc(f.url)}" data-name="${esc(f.name)}">📥 다운로드</button>
        </div>`).join('');
      })()}
      ${sub.memo ? `<div class="box-info" style="margin-bottom:0">💬 내 메모: ${esc(sub.memo)}</div>` : ''}
      <div id="resub-form" style="display:none;margin-top:12px">
        <div class="divider" style="margin-top:0"></div>
        <div class="form">
          <div class="field"><label>재제출 파일 선택 (여러 개 가능, 파일당 최대 50MB)</label><input id="sf-file" type="file" multiple/></div>
          <div class="field"><label>메모 (선택)</label><textarea id="sf-memo" placeholder="수정 사항 등을 남겨주세요">${esc(sub.memo || '')}</textarea></div>
          <div class="prog-wrap" id="sf-prog">
            <div class="prog-label">업로드 중... <span id="sf-pct">0%</span></div>
            <div class="prog-bar"><div class="prog-fill" id="sf-pfill" style="width:0%"></div></div>
          </div>
          <div id="sf-err" class="err"></div>
          <button id="sf-submit" class="btn-p">재제출하기</button>
        </div>
      </div>
    </div>` : ''}
    ${!sub && locked ? `<div class="box-warn">⏰ 마감일이 지나 제출이 불가합니다.</div>` : ''}
    ${!sub && !locked ? `<div class="section" id="sub-form-sec">
      <div class="sec-title">📤 과제 제출</div>
      <div class="form" id="sub-form">
        <div class="field"><label>파일 선택 (여러 개 가능, 파일당 최대 50MB)</label><input id="sf-file" type="file" multiple/></div>
        <div class="field"><label>선생님께 남길 메모 (선택)</label><textarea id="sf-memo" placeholder="예: 2번 문제 다시 풀었습니다"></textarea></div>
        <div class="prog-wrap" id="sf-prog">
          <div class="prog-label">업로드 중... <span id="sf-pct">0%</span></div>
          <div class="prog-bar"><div class="prog-fill" id="sf-pfill" style="width:0%"></div></div>
        </div>
        <div id="sf-err" class="err"></div>
        <button id="sf-submit" class="btn-p btn-full">제출하기</button>
      </div>
    </div>` : ''}`;
}
