/* ═══════════════════════════════════════
   events/unit.js — 단원 콘텐츠 이벤트

   학생: 항목(링크/파일) 열기
   선생님: 단원 구성 (항목 추가/수정/삭제/순서)
═══════════════════════════════════════ */

// 폼 입력값을 작업본(UC_DRAFT)에 읽어둠 — 유형 전환·재렌더 시 입력 보존
function _ucReadForm(){
  if(!UC_DRAFT) UC_DRAFT = { type: 'file', title: '', desc: '', url: '', body: '' };
  const g = id => document.getElementById(id);
  if(g('uc-title')) UC_DRAFT.title = g('uc-title').value;
  if(g('uc-desc'))  UC_DRAFT.desc  = g('uc-desc').value;
  if(g('uc-url'))   UC_DRAFT.url   = g('uc-url').value;
  if(g('uc-body'))  UC_DRAFT.body  = g('uc-body').value;
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset.action;

  /* ── 학생/공용: 항목 열기 ── */
  if(act === 'uc-open-link'){
    const url = el.dataset.url;
    if(url) window.open(url, '_blank', 'noopener');
    return;
  }
  if(act === 'uc-dl-file'){
    dlFile(el.dataset.name, el.dataset.url);
    return;
  }

  /* ── 선생님: 단원/섹션 선택 ── */
  if(act === 'uc-pick-unit'){
    UC_TC_UNIT = el.dataset.unit; UC_EDIT = null; UC_DRAFT = null; render(); return;
  }

  /* ── 선생님: 항목 폼 ── */
  if(act === 'uc-new'){
    UC_EDIT = 'new';
    UC_DRAFT = { type: (UC_TC_SEC === 'material' ? 'file' : 'link'), title: '', desc: '', url: '', body: '', _files: [] };
    render(); return;
  }
  if(act === 'uc-type'){
    _ucReadForm();
    UC_DRAFT.type = el.dataset.type;
    render(); return;
  }
  if(act === 'uc-edit'){
    const it = (((UNIT_CONTENT[UC_TC_UNIT] || {})[UC_TC_SEC]) || []).find(x => x.id === el.dataset.id);
    if(!it) return;
    UC_EDIT = it.id;
    UC_DRAFT = { type: it.type || 'file', title: it.title || '', desc: it.desc || '', url: it.url || '', body: it.body || '', _files: _ucFiles(it) };
    render(); return;
  }
  if(act === 'uc-cancel'){
    UC_EDIT = null; UC_DRAFT = null; render(); return;
  }

  if(act === 'uc-save'){
    if(UC_SAVING) return;
    _ucReadForm();
    const cid = TC_CLS?.id; if(!cid) return;
    const errEl = document.getElementById('uc-err');
    const setErr = m => { if(errEl) errEl.textContent = m; };
    const d = UC_DRAFT || {};
    const type = d.type || 'file';
    if(!(d.title || '').trim()){ setErr('제목을 입력하세요.'); return; }
    if(type === 'link' && !(d.url || '').trim()){ setErr('링크 주소를 입력하세요.'); return; }
    if(type === 'text' && !(d.body || '').trim()){ setErr('본문을 입력하세요.'); return; }

    const editing = UC_EDIT !== 'new';
    const fileInput = document.getElementById('uc-file');
    const files = fileInput ? Array.from(fileInput.files || []) : [];
    if(type === 'file' && !editing && !files.length){ setErr('파일을 선택하세요.'); return; }
    const oversized = files.find(f => f.size > MAX_FILE_SIZE);
    if(oversized){ setErr(`"${oversized.name}" 파일이 50MB를 초과합니다.`); return; }

    UC_SAVING = true; setErr(''); render();
    try {
      const itemId = editing ? UC_EDIT : genId();
      const now = new Date().toISOString();
      const existing = editing
        ? (((UNIT_CONTENT[UC_TC_UNIT] || {})[UC_TC_SEC]) || []).find(x => x.id === itemId)
        : null;

      const data = { type, title: d.title.trim(), createdAt: existing?.createdAt || now };
      if(type !== 'text' && (d.desc || '').trim()) data.desc = d.desc.trim();
      if(type === 'link') data.url = d.url.trim();
      if(type === 'text') data.body = d.body;
      if(type === 'file'){
        if(files.length){
          const uploaded = [];
          const upId = genId();
          const prog = document.getElementById('uc-prog'); if(prog) prog.style.display = 'block';
          for(let i = 0; i < files.length; i++){
            const file = files[i];
            const pct = document.getElementById('uc-pct'); if(pct) pct.textContent = `${i + 1}/${files.length}`;
            const path = `teacherFiles/${cid}/${upId}/${file.name}`;
            const url = await uploadFile(file, path, document.getElementById('uc-pfill'), document.getElementById('uc-pct'));
            uploaded.push({ name: file.name, url, path });
          }
          data.files = uploaded;
        } else if(existing){
          const keep = _ucFiles(existing);
          if(keep.length) data.files = keep;
        }
      }

      await saveUnitItem(cid, UC_TC_UNIT, UC_TC_SEC, itemId, data);
      await loadUnitContent(cid);
      UC_EDIT = null; UC_DRAFT = null;
      toast('저장됐어요', 'ok');
    } catch(err){
      console.error(err);
      setErr('오류: ' + (err.message || err));
    } finally {
      UC_SAVING = false; render();
    }
    return;
  }

  if(act === 'uc-del'){
    if(!confirm(`"${el.dataset.title}" 항목을 삭제할까요?`)) return;
    const cid = TC_CLS?.id; if(!cid) return;
    try {
      await deleteUnitItem(cid, UC_TC_UNIT, UC_TC_SEC, el.dataset.id);
      await loadUnitContent(cid);
      if(UC_EDIT === el.dataset.id){ UC_EDIT = null; UC_DRAFT = null; }
      toast('삭제됐어요', 'ok');
    } catch(err){ toast('삭제 실패: ' + (err.message || err), 'err'); }
    render(); return;
  }

  if(act === 'uc-move'){
    const cid = TC_CLS?.id; if(!cid) return;
    try {
      await moveUnitItem(cid, UC_TC_UNIT, UC_TC_SEC, el.dataset.id, el.dataset.dir);
      await loadUnitContent(cid);
    } catch(err){ toast('순서 변경 실패', 'err'); }
    render(); return;
  }
});
