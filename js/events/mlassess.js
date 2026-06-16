/* ═══════════════════════════════════════
   events/mlassess.js — 📝 ML 수행평가 이벤트
   학생 응시(선택·입력·제출) + 선생님(응시토글·채점·CSV)
═══════════════════════════════════════ */

/* ─── 학생 저장 ─── */
async function _mlaSaveNow(silent, submit){
  if(!SEL_CLS || !ST_USER) return;
  if(MLA_SAVING) return;
  if(!MLA_ANSWERS.startedAt) MLA_ANSWERS.startedAt = new Date().toISOString();
  MLA_SAVING = submit ? 'submit' : 'save';
  if(!silent) render();
  try {
    const saved = await saveAiaSubmission(SEL_CLS.id, 'mlassess', ST_USER.number, MLA_ANSWERS, submit ? { submit: true } : undefined);
    MLA_SUB = saved;
    if(!silent) toast(submit ? '📤 제출되었습니다' : '💾 저장됐어요', 'ok');
  } catch(err){
    console.error(err);
    if(!silent) toast('저장 실패: ' + (err.message || err), 'err');
  } finally {
    MLA_SAVING = null;
    if(!silent) render();
  }
}
function _mlaQueueSave(){
  if(MLA_SAVE_TIMER) clearTimeout(MLA_SAVE_TIMER);
  MLA_SAVE_TIMER = setTimeout(() => { _mlaSaveNow(true); }, 1500);
}

/* ─── 클릭 ─── */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset.action;

  /* 학생: 상황 선택 */
  if(act === 'mla-pick-sit'){
    MLA_ANSWERS.sitId = el.dataset.sit;
    delete MLA_ANSWERS.mineProblem;
    _mlaQueueSave(); render(); return;
  }
  if(act === 'mla-mine'){
    MLA_ANSWERS.sitId = 'mine';
    _mlaQueueSave(); render(); return;
  }
  if(act === 'mla-q2type'){ MLA_ANSWERS.q2_type = el.dataset.type; _mlaQueueSave(); render(); return; }
  if(act === 'mla-q2model'){ MLA_ANSWERS.q2_model = el.dataset.model; _mlaQueueSave(); render(); return; }

  if(act === 'mla-save'){ await _mlaSaveNow(false, false); return; }
  if(act === 'mla-submit'){
    if(!MLA_ANSWERS.sitId){ toast('먼저 상황을 골라주세요.', 'err'); return; }
    if(!confirm('지금까지 작성한 내용으로 제출할까요? 제출 후에는 선생님만 다시 열 수 있어요.')) return;
    await _mlaSaveNow(false, true);
    return;
  }

  /* 선생님 */
  if(act === 'mla-active-toggle'){
    if(!TC_CLS) return;
    const next = !MLA_ACTIVE[TC_CLS.id];
    try { await setMlaActive(TC_CLS.id, next); toast(next ? '🟢 응시를 열었어요' : '⚪ 응시를 닫았어요', 'ok'); }
    catch(err){ toast('실패: ' + (err.message || err), 'err'); }
    render(); return;
  }
  if(act === 'mla-tc-view'){ MLA_TC_SNUM = el.dataset.snum; MLA_TC_VIEW = 'student'; render(); return; }
  if(act === 'mla-tc-back'){ MLA_TC_VIEW = 'list'; MLA_TC_SNUM = null; render(); return; }

  /* 선생님: 상황·루브릭 편집 */
  if(act === 'mla-tc-edit'){
    const cur = MLA_CONFIG[TC_CLS?.id] || {};
    MLA_EDIT_DRAFT = JSON.parse(JSON.stringify({ intro: cur.intro ?? null, q: cur.q || {}, situations: cur.situations || {}, rubric: cur.rubric || {} }));
    MLA_TC_VIEW = 'edit'; render(); return;
  }
  if(act === 'mla-tc-editback'){ MLA_TC_VIEW = 'list'; MLA_EDIT_DRAFT = null; render(); return; }
  if(act === 'mla-edit-save'){
    if(!TC_CLS) return;
    const d = MLA_EDIT_DRAFT || {};
    const cfg = {};
    if(d.intro && String(d.intro).trim() && d.intro !== MLA_INTRO_DEFAULT) cfg.intro = String(d.intro);
    // 루브릭: 문항별 칸 단위, 기본값과 다른 것만 저장
    const ro = {};
    for(const qk of ['q1', 'q2', 'q3']){
      const o = {};
      for(const pk of MLA_RUBRIC_LEVELS){
        const v = ((d.rubric || {})[qk] || {})[pk];
        if(v != null && String(v).trim() && v !== MLA_RUBRIC_DEFAULT[qk][pk]) o[pk] = String(v);
      }
      if(Object.keys(o).length) ro[qk] = o;
    }
    if(Object.keys(ro).length) cfg.rubric = ro;
    const qo = {};
    for(const k in MLA_Q_DEFAULT){
      const v = (d.q || {})[k];
      if(v != null && String(v).trim() && v !== MLA_Q_DEFAULT[k]) qo[k] = String(v);
    }
    if(Object.keys(qo).length) cfg.q = qo;
    const sm = {};
    for(const s of MLA_SITUATIONS){
      const ov = (d.situations || {})[s.id] || {};
      const o = {};
      if(ov.title != null && String(ov.title).trim() && ov.title !== s.title) o.title = String(ov.title);
      if(ov.scene != null && String(ov.scene).trim() && ov.scene !== s.scene) o.scene = String(ov.scene);
      if(Object.keys(o).length) sm[s.id] = o;
    }
    if(Object.keys(sm).length) cfg.situations = sm;
    MLA_EDIT_SAVING = true; render();
    try {
      for(const t of ['info-2A', 'info-2B']) await setMlaConfig(t, cfg);
      toast('저장됐어요 (정보 2-A·2-B 반영)', 'ok');
      MLA_TC_VIEW = 'list'; MLA_EDIT_DRAFT = null;
    } catch(err){ toast('저장 실패: ' + (err.message || err), 'err'); }
    finally { MLA_EDIT_SAVING = false; render(); }
    return;
  }
  if(act === 'mla-edit-reset'){
    if(!TC_CLS) return;
    if(!confirm('상황·안내문·루브릭을 모두 기본값으로 되돌릴까요? (정보 2-A·2-B 모두)')) return;
    MLA_EDIT_SAVING = true; render();
    try {
      for(const t of ['info-2A', 'info-2B']){ await db.ref(`aiactivity/submissions/${t}/mlassessConfig`).remove(); MLA_CONFIG[t] = {}; }
      toast('기본값으로 되돌렸어요', 'ok');
      MLA_TC_VIEW = 'list'; MLA_EDIT_DRAFT = null;
    } catch(err){ toast('실패: ' + (err.message || err), 'err'); }
    finally { MLA_EDIT_SAVING = false; render(); }
    return;
  }
  if(act === 'mla-tc-savescore'){
    const snum = MLA_TC_SNUM;
    if(!TC_CLS || !snum) return;
    const sc = MLA_TC_SCORES[snum] || {};
    // 빈 값 정리
    const payload = { ...sc };
    ['q1', 'q2', 'q3'].forEach(k => { if(payload[k] === '' || payload[k] == null) delete payload[k]; else payload[k] = Number(payload[k]); });
    if(payload.comment != null && !String(payload.comment).trim()) delete payload.comment;
    MLA_TC_SAVING = snum; render();
    try {
      await saveAsmtScoreExt(TC_CLS.id, snum, 'aicode', payload);
      // 점수 관리 캐시도 갱신 (켜져 있으면 반영)
      if(typeof SC_AICODE_SCORES === 'object' && SC_AICODE_SCORES) SC_AICODE_SCORES[snum] = { ...payload };
      toast('💾 점수를 저장했어요 (점수 관리 반영)', 'ok');
    } catch(err){ toast('저장 실패: ' + (err.message || err), 'err'); }
    finally { MLA_TC_SAVING = null; render(); }
    return;
  }
  if(act === 'mla-tc-csv'){ _mlaExportCSV(); return; }
});

/* ─── 입력 (textarea/number) ─── */
document.addEventListener('input', e => {
  const fi = e.target.closest('[data-action="mla-input"]');
  if(fi){
    MLA_ANSWERS[fi.dataset.fid] = e.target.value;
    _mlaQueueSave();
    return;
  }
  // 선생님 편집 (상황·안내·루브릭) — 재렌더 없이 작업본만 갱신(포커스 유지)
  const ei = e.target.closest('[data-action="mla-edit-input"]');
  if(ei){
    if(!MLA_EDIT_DRAFT) MLA_EDIT_DRAFT = {};
    const f = ei.dataset.field, v = e.target.value;
    if(f === 'intro') MLA_EDIT_DRAFT.intro = v;
    else if(f.startsWith('rubric.')){
      const p = f.split('.'); // rubric.q1.p5
      if(!MLA_EDIT_DRAFT.rubric) MLA_EDIT_DRAFT.rubric = {};
      if(!MLA_EDIT_DRAFT.rubric[p[1]]) MLA_EDIT_DRAFT.rubric[p[1]] = {};
      MLA_EDIT_DRAFT.rubric[p[1]][p[2]] = v;
    }
    else if(f.startsWith('q.')){
      if(!MLA_EDIT_DRAFT.q) MLA_EDIT_DRAFT.q = {};
      MLA_EDIT_DRAFT.q[f.slice(2)] = v;
    } else {
      const [sid, key] = f.split('.');
      if(!MLA_EDIT_DRAFT.situations) MLA_EDIT_DRAFT.situations = {};
      if(!MLA_EDIT_DRAFT.situations[sid]) MLA_EDIT_DRAFT.situations[sid] = {};
      MLA_EDIT_DRAFT.situations[sid][key] = v;
    }
    return;
  }
  const sci = e.target.closest('[data-action="mla-tc-score"]');
  if(sci){
    const snum = MLA_TC_SNUM;
    if(!snum) return;
    if(!MLA_TC_SCORES[snum]) MLA_TC_SCORES[snum] = {};
    let v = e.target.value;
    if(v !== ''){ v = Math.max(0, Math.min(5, Number(v) || 0)); }
    MLA_TC_SCORES[snum][sci.dataset.key] = v;
    // 합계만 갱신 (전체 재렌더 X — 입력 포커스 유지)
    const tot = ['q1', 'q2', 'q3'].reduce((s, k) => s + (Number(MLA_TC_SCORES[snum][k]) || 0), 0);
    const totEl = document.querySelector('.mla-score-total b');
    if(totEl) totEl.textContent = tot;
    return;
  }
  const ci = e.target.closest('[data-action="mla-tc-comment"]');
  if(ci){
    const snum = MLA_TC_SNUM;
    if(!snum) return;
    if(!MLA_TC_SCORES[snum]) MLA_TC_SCORES[snum] = {};
    MLA_TC_SCORES[snum].comment = e.target.value;
    return;
  }
});

/* ─── CSV (답안) ─── */
function _mlaExportCSV(){
  if(!TC_CLS) return;
  const cols = [
    ['sit', '선택상황'], ['pickReason', '고른이유'],
    ['q1_a', '문항1_ML①'], ['q1_b', '문항1_ML②'], ['q1_ml', '문항1_나의문제판단'],
    ['q2_pick', '문항2_깊게풀문제'], ['q2_type', '문항2_유형'], ['q2_model', '문항2_모델'], ['q2_why', '문항2_이유·작동'],
    ['q3_input', '문항3_입력'], ['q3_output', '문항3_출력'], ['q3_effect', '문항3_기대효과'],
    ['score', '점수(합)'],
  ];
  const header = ['학번', '이름', ...cols.map(c => c[1]), '제출시각'];
  const rows = [header];
  for(const st of STUDENTS){
    const sub = MLA_ALL_SUBS[st.number];
    const a = sub?.answers || {};
    const sc = MLA_TC_SCORES[st.number] || {};
    const sit = a.sitId === 'mine' ? null : mlaSituationById(a.sitId);
    const line = [st.number, st.name];
    for(const [k] of cols){
      let v = '';
      if(k === 'sit') v = a.sitId === 'mine' ? `나의문제: ${a.mineProblem || ''}` : (sit ? `상황${sit.id.slice(1)} ${sit.field}` : '');
      else if(k === 'score'){ const t = ['q1', 'q2', 'q3'].reduce((s, kk) => s + (Number(sc[kk]) || 0), 0); v = ['q1', 'q2', 'q3'].some(kk => sc[kk] != null && sc[kk] !== '') ? t : ''; }
      else v = a[k] || '';
      line.push(v);
    }
    line.push(sub?.submittedAt ? fmtDt(sub.submittedAt) : '');
    rows.push(line);
  }
  const csv = '﻿' + rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a2 = document.createElement('a');
  a2.href = url; a2.download = `ML수행평가_${TC_CLS.id}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('답안 CSV 내보내기 완료', 'ok');
}
