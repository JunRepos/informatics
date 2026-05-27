/* ═══════════════════════════════════════
   events/aiactivity.js — 🧠 AI 활동지 이벤트
═══════════════════════════════════════ */

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset.action;

  // 학생: 활동 선택
  if(act === 'aia-pick'){
    const aid = el.dataset.aid;
    const def = aiaById(aid);
    if(!def || !SEL_CLS || !ST_USER) return;
    AIA_SEL = def;
    AIA_ANSWERS = {};
    AIA_VIEW = 'do';
    AIA_SAVING = false;
    // 본인 답안 로드
    const sub = await loadAiaSubmission(SEL_CLS.id, def.id, ST_USER.number);
    AIA_SUB = sub;
    if(sub && sub.answers) AIA_ANSWERS = { ...sub.answers };
    render();
    return;
  }

  // 학생: 뒤로 (활동 목록)
  if(act === 'aia-back'){
    AIA_VIEW = 'list';
    AIA_SEL = null;
    AIA_ANSWERS = {};
    AIA_SUB = null;
    if(AIA_SAVE_TIMER){ clearTimeout(AIA_SAVE_TIMER); AIA_SAVE_TIMER = null; }
    render();
    return;
  }

  // 학생: 명시적 임시 저장 (제출 시각 변경 안 함)
  if(act === 'aia-save'){
    await _aiaSaveNow();
    return;
  }

  // 학생: 제출 (submittedAt 갱신)
  if(act === 'aia-submit'){
    if(!SEL_CLS || !ST_USER || !AIA_SEL) return;
    if(AIA_SAVING) return;
    // 작성된 답안이 있는지 확인 (다 빈 칸이면 제출 막기)
    const hasAny = aiaFieldIds(AIA_SEL).some(fid => (AIA_ANSWERS[fid] || '').trim());
    if(!hasAny){
      toast('아직 작성된 내용이 없어요. 한 칸이라도 채운 뒤 제출해주세요.', 'err');
      return;
    }
    const already = !!AIA_SUB?.submittedAt;
    if(!confirm(already ? '이미 제출했어요. 다시 제출할까요? (현재 작성된 내용으로 갱신됩니다)' : '지금 작성한 내용으로 제출할까요? (제출 후에도 수정 가능합니다)')) return;
    AIA_SAVING = 'submit';
    if(AIA_SAVE_TIMER){ clearTimeout(AIA_SAVE_TIMER); AIA_SAVE_TIMER = null; }
    render();
    try {
      const saved = await saveAiaSubmission(SEL_CLS.id, AIA_SEL.id, ST_USER.number, AIA_ANSWERS, { submit: true });
      AIA_SUB = saved;
      toast('📤 제출했어요!', 'ok');
    } catch(err){
      console.error(err);
      toast('제출 실패: ' + (err.message || err), 'err');
    } finally {
      AIA_SAVING = false;
      render();
    }
    return;
  }

  // 선생님: active 토글
  if(act === 'aia-set-active'){
    const on = el.dataset.on === '1';
    if(!TC_CLS) return;
    try {
      await setAiaActive(TC_CLS.id, on);
      toast(`AI 활동지를 ${on ? '📖 열었어요' : '🔒 닫았어요'}.`, 'ok');
      render();
    } catch(err){
      console.error(err);
      toast('토글 실패: ' + (err.message || err), 'err');
    }
    return;
  }

  // 선생님: 활동 선택
  if(act === 'aia-tc-pick'){
    const aid = el.dataset.aid;
    const def = aiaById(aid);
    if(!def || !TC_CLS) return;
    AIA_SEL = def;
    AIA_TC_SEL_SNUM = null;
    AIA_ALL_SUBS = await loadAllAiaSubmissions(TC_CLS.id, def.id);
    render();
    return;
  }

  // 선생님: 활동 선택 화면으로
  if(act === 'aia-tc-back'){
    AIA_SEL = null;
    AIA_TC_SEL_SNUM = null;
    AIA_ALL_SUBS = {};
    AIA_VIEW = 'list';
    render();
    return;
  }

  // 선생님: 학생 답안 보기
  if(act === 'aia-tc-view'){
    AIA_TC_SEL_SNUM = el.dataset.snum;
    AIA_VIEW = 'tcStudent';
    render();
    return;
  }

  // 선생님: 학생 목록으로 돌아가기
  if(act === 'aia-tc-back-list'){
    AIA_TC_SEL_SNUM = null;
    AIA_VIEW = 'list';
    render();
    return;
  }

  // 선생님: CSV 내보내기
  if(act === 'aia-export-csv'){
    _aiaExportCSV();
    return;
  }
});

// 학생: 입력 (debounce 자동 저장)
document.addEventListener('input', e => {
  const el = e.target.closest('[data-action="aia-input"]');
  if(!el) return;
  const fid = el.dataset.fid;
  if(!fid) return;
  AIA_ANSWERS[fid] = el.value;
  // 자동 저장 (1.5초 후) — 학생 입력 중에는 저장 안 함
  if(AIA_SAVE_TIMER) clearTimeout(AIA_SAVE_TIMER);
  AIA_SAVE_TIMER = setTimeout(() => { _aiaSaveNow(true); }, 1500);
});

// 임시 저장 로직 (submittedAt 보존)
async function _aiaSaveNow(silent){
  if(!SEL_CLS || !ST_USER || !AIA_SEL) return;
  if(AIA_SAVING) return;
  AIA_SAVING = 'save';
  if(!silent) render();
  try {
    const saved = await saveAiaSubmission(SEL_CLS.id, AIA_SEL.id, ST_USER.number, AIA_ANSWERS);
    AIA_SUB = saved;  // { answers, updatedAt, submittedAt? }
    if(!silent) toast('💾 저장됐어요', 'ok');
  } catch(err){
    console.error(err);
    if(!silent) toast('저장 실패: ' + (err.message || err), 'err');
  } finally {
    AIA_SAVING = false;
    // 입력 중 포커스를 잃지 않도록 silent 저장은 렌더 생략
    if(!silent) render();
  }
}

// CSV 내보내기
function _aiaExportCSV(){
  if(!TC_CLS || !AIA_SEL) return;
  const act = AIA_SEL;
  const fieldIds = aiaFieldIds(act);
  // 헤더 라벨 만들기
  const labels = {};
  for(const sec of act.sections || []){
    if(sec.type === 'card-fields'){
      (sec.fields || []).forEach(f => { labels[f.id] = f.label; });
    } else if(sec.type === 'single-text' || sec.type === 'rich-text'){
      labels[sec.id] = sec.title;
    }
  }
  const header = ['학번', '이름', ...fieldIds.map(fid => labels[fid] || fid), '제출시각', '마지막수정'];
  const rows = [header];
  for(const st of STUDENTS){
    const sub = AIA_ALL_SUBS[st.number];
    const ans = sub?.answers || {};
    const row = [st.number, st.name];
    for(const fid of fieldIds) row.push(ans[fid] || '');
    row.push(sub?.submittedAt ? fmtDt(sub.submittedAt) : '');
    row.push(sub?.updatedAt ? fmtDt(sub.updatedAt) : '');
    rows.push(row);
  }
  const csv = '﻿' + rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AI활동지_${act.id}_${TC_CLS.id}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('CSV 내보내기 완료', 'ok');
}
