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
  if(g('uc-refid')) UC_DRAFT.refId = g('uc-refid').value;
}

// 앱연결 항목 열기 — 단원에서 기능(노트북/미션/OJ/퀴즈/AI코딩/과제) 진입
async function openUnitApp(refType, refId, unitKey, section){
  const whole = refId === '*';   // 전체 목록 통째로 연결
  if(refType === 'notebook'){
    ST_TAB = 'notebook';
    UNIT_RETURN = { unitKey, section };
    if(whole){ SEL_NOTEBOOK = null; render(); }   // 노트북 목록
    else await openNotebook(refId);               // 내부에서 render
  } else if(refType === 'mission'){
    ST_TAB = 'mission';
    UNIT_RETURN = { unitKey, section };
    if(whole){
      MISSION_VIEW = 'list'; SEL_MISSION = null; MISSION_PROGRESS_ALL = null;
      render();
      if(SEL_CLS && ST_USER) loadAllMissionProgress(SEL_CLS.id, ST_USER.number).then(p => {
        MISSION_PROGRESS_ALL = p;
        if(ST_TAB === 'mission' && MISSION_VIEW === 'list') render();
      });
    } else await openMission(refId);              // 내부에서 render
  } else if(refType === 'quiz'){
    ST_TAB = 'practice'; ST_PRACTICE_SUB = 'quiz';
    UNIT_RETURN = { unitKey, section };
    if(whole){
      CR_VIEW = 'list'; CR_SEL = null; CR_LAST_RESULT = null;
      render();
      if(SEL_CLS && ST_USER) _loadCrProgress().then(render);   // 목록 진도 갱신
    } else {
      const r = (CR_READINGS || []).find(x => x.id === refId);
      if(r){
        CR_SEL = r; CR_VIEW = 'solve'; CR_STEP_IDX = 0; CR_ANSWER = ''; CR_LAST_RESULT = null;
        CR_CLOZE_ANSWERS = (r.type === 'cloze') ? new Array((r.blanks || []).length).fill('') : null;
        CR_BUG_SEL = null;
        if(r.type === 'codetest') CR_CT = { blanks: {}, run: null, test: null, running: false, stdin: '' };
        if(ST_USER && SEL_CLS){
          try {
            const prog = await loadCodeReadingProgress(SEL_CLS.id, r.id, ST_USER.number);
            if(!CR_PROGRESS[r.id]) CR_PROGRESS[r.id] = {};
            if(prog) CR_PROGRESS[r.id][ST_USER.number] = prog;
          } catch(e){}
        }
      }
      render();
    }
  } else if(refType === 'aicode'){
    ST_TAB = 'aicode';
    UNIT_RETURN = { unitKey, section };
    AIC_MESSAGES = []; AIC_CODE = ''; AIC_TURN_COUNT = 0; AIC_RUN_RESULT = null; AIC_RUN_STDIN = ''; AIC_VIEW = 'entry';
    render();
    Promise.all([loadAicActive(SEL_CLS.id), loadAicSession(SEL_CLS.id, ST_USER.number)]).then(([_a, s]) => {
      if(s){ AIC_MESSAGES = Array.isArray(s.messages) ? s.messages : []; AIC_CODE = s.code || ''; AIC_TURN_COUNT = s.turnCount || 0; }
      AIC_VIEW = _aicInitialStudentView(s);
      render();
    });
  } else if(refType === 'oj'){
    if(whole){
      // OJ 전체 목록 → 문제풀이(OJ) 탭. 복귀 바로 단원 복귀.
      ST_TAB = 'practice'; ST_PRACTICE_SUB = 'oj';
      OJ_SEL_PROB = null; OJ_RUN_RESULTS = null; OJ_SUBMIT_RESULTS = null;
      UNIT_RETURN = { unitKey, section };
      render();
      return;
    }
    // 특정 OJ 문제는 별도 전체화면(oj-solve). ST_TAB(단원)은 그대로라 oj-back이 단원으로 복귀.
    const p = (OJ_PROBLEMS || []).find(x => x.id === refId);
    if(!p){ toast('연결된 OJ 문제를 찾을 수 없어요.', 'err'); render(); return; }
    OJ_SEL_PROB = p; OJ_CODE = ''; OJ_RUN_RESULTS = null; OJ_SUBMIT_RESULTS = null;
    OJ_CUSTOM_STDIN = ''; OJ_CUSTOM_OUTPUT = null; OJ_RESULT_TAB = 'exec';
    const cid = CID();
    if(cid) await loadOJSubmissions(cid, p.id);
    if(ST_USER && cid){
      try { const draft = await loadOJDraft(cid, p.id, ST_USER.number); if(draft?.code !== undefined) OJ_CODE = draft.code; } catch(e){}
    }
    if(!OJ_CODE){ const prev = OJ_SUBMISSIONS[p.id]?.[ST_USER?.number]; if(prev?.code) OJ_CODE = prev.code; }
    if(!OJ_CODE && p.starterCode) OJ_CODE = p.starterCode;
    go('oj-solve');
  } else if(refType === 'assign'){
    // 과제는 별도 전체화면(assign-detail). ST_TAB(단원) 그대로라 뒤로가기가 단원으로 복귀.
    const a = (ASSIGNMENTS || []).find(x => x.id === refId);
    if(!a){ toast('연결된 과제를 찾을 수 없어요.', 'err'); render(); return; }
    if(ST_USER) await loadSubmissions(CID(), a.id);
    go('assign-detail', { assign: a });
  }
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
  if(act === 'uc-open-app'){
    await openUnitApp(el.dataset.reftype, el.dataset.refid, el.dataset.unit, el.dataset.sec);
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
    if(UC_DRAFT.type === 'app' && !UC_DRAFT.refType){
      UC_DRAFT.refType = 'notebook';
      UC_DRAFT.refId = UC_APP_SCOPE_ALL.includes('notebook') ? '*' : '';
    }
    render(); return;
  }
  if(act === 'uc-reftype'){
    _ucReadForm();
    UC_DRAFT.refType = el.dataset.reftype;
    UC_DRAFT.refId = UC_APP_SCOPE_ALL.includes(UC_DRAFT.refType) ? '*' : '';  // 전체목록 기본
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
    if(type !== 'app' && !(d.title || '').trim()){ setErr('제목을 입력하세요.'); return; }
    if(type === 'link' && !(d.url || '').trim()){ setErr('링크 주소를 입력하세요.'); return; }
    if(type === 'text' && !(d.body || '').trim()){ setErr('본문을 입력하세요.'); return; }
    if(type === 'app' && (d.refType || 'notebook') !== 'aicode' && !(d.refId || '').trim()){ setErr('연결할 항목을 선택하세요.'); return; }

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

      const data = { type, title: (d.title || '').trim(), createdAt: existing?.createdAt || now };
      if(type !== 'text' && (d.desc || '').trim()) data.desc = d.desc.trim();
      if(type === 'link') data.url = d.url.trim();
      if(type === 'text') data.body = d.body;
      if(type === 'app'){
        const refType = d.refType || 'notebook';
        data.refType = refType;
        if(refType === 'aicode'){
          data.refId = '';
          if(!data.title) data.title = 'AI 코딩';
        } else {
          data.refId = d.refId;
          if(!data.title){
            if(d.refId === '*'){
              data.title = UC_APP_META[refType] ? UC_APP_META[refType].label : '전체';
            } else {
              const arr = (UC_APP_META[refType] && UC_APP_META[refType].list()) || [];
              const ref = arr.find(x => x.id === d.refId);
              data.title = (ref && (ref.title || '')) || (UC_APP_META[refType] ? UC_APP_META[refType].label : '연결');
            }
          }
        }
      }
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
