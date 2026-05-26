/* ═══════════════════════════════════════
   events/score.js — 🏆 점수 관리 이벤트

   선생님: 수행평가 탭 전환 / 공개 토글 / 영역 점수 입력·저장 / CSV
═══════════════════════════════════════ */

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset.action;

  // 수행평가 탭 전환
  if(act === 'sc-tab'){
    SC_TC_ASMT = el.dataset.asmt;
    render();
    return;
  }

  // 공개 토글
  if(act === 'sc-publish'){
    const asmtId = el.dataset.asmt;
    const on = el.dataset.on === '1';
    if(!TC_CLS || !asmtId) return;
    try {
      await setAsmtPublished(TC_CLS.id, asmtId, on);
      if(!SC_PUBLISHED[TC_CLS.id]) SC_PUBLISHED[TC_CLS.id] = {};
      SC_PUBLISHED[TC_CLS.id][asmtId] = on;
      toast(`${asmtById(asmtId)?.title || asmtId} 점수를 ${TC_CLS.label}에 ${on ? '📤 공개' : '🔒 비공개'} 처리했어요.`, 'ok');
      render();
    } catch(err){
      console.error(err);
      toast('공개 토글 실패: ' + (err.message || err), 'err');
    }
    return;
  }

  // 점수 저장 (한 학생 단위)
  if(act === 'sc-save'){
    const snum = el.dataset.snum;
    const asmtId = el.dataset.asmt;
    if(!TC_CLS || !snum || !asmtId) return;
    const asmt = asmtById(asmtId);
    if(!asmt || asmt.placeholder) return;

    const map = asmtId === 'bigdata' ? SC_BIGDATA_SCORES : SC_AICODE_SCORES;
    const cur = map[snum] || {};
    SC_SAVING_SNUM = snum;
    render();
    try {
      await saveAsmtScoreExt(TC_CLS.id, snum, asmtId, cur);
      // 저장 시각 갱신
      map[snum] = { ...cur, scoredAt: new Date().toISOString() };
      const t = (() => {
        let s = 0, any = false;
        for(const p of asmt.parts){
          if(typeof cur[p.key] === 'number'){ s += cur[p.key]; any = true; }
        }
        return any ? s : null;
      })();
      toast(`${snum} 학생 점수 저장됨 (${t == null ? '–' : t}/${asmt.total})`, 'ok');
    } catch(err){
      console.error(err);
      toast('저장 실패: ' + (err.message || err), 'err');
    } finally {
      SC_SAVING_SNUM = null;
      render();
    }
    return;
  }

  // PET병 채점 화면으로 이동 (점수 관리 표에서 "채점 →" 클릭)
  if(act === 'sc-goto-pet'){
    const snum = el.dataset.snum;
    if(!TC_CLS || !snum) return;
    // 수행평가 탭으로 이동 후 해당 학생 상세 열기
    TC_TAB = 'asmt';
    ASMT_TC_VIEW = 'student';
    ASMT_TC_SEL_SNUM = snum;
    // 데이터 로드 (이미 ASMT_ALL_* 가 있을 수 있지만 확실히 갱신)
    Promise.all([
      loadAllAsmtSubmissions(TC_CLS.id),
      loadAllAsmtScores(TC_CLS.id),
    ]).then(([subs, scores]) => {
      ASMT_ALL_SUBS = subs || {};
      ASMT_ALL_SCORES = scores || {};
      render();
    });
    return;
  }

  // 종합 CSV
  if(act === 'sc-export-csv'){
    _scExportCSV();
    return;
  }
});

// 점수 입력 (드롭다운/숫자) — change 이벤트
document.addEventListener('change', e => {
  const el = e.target.closest('[data-action="sc-set"]');
  if(!el) return;
  const snum = el.dataset.snum;
  const asmtId = el.dataset.asmt;
  const key = el.dataset.key;
  const raw = el.value;
  if(!snum || !asmtId || !key) return;

  const map = asmtId === 'bigdata' ? SC_BIGDATA_SCORES : SC_AICODE_SCORES;
  if(!map[snum]) map[snum] = {};
  if(raw === ''){
    delete map[snum][key];
  } else {
    const n = Number(raw);
    if(Number.isFinite(n)) map[snum][key] = n;
  }
  // 부분 합계만 셀에 즉시 반영하려고 row 다시 그리는 게 무겁다 — 전체 render 유지
  render();
});

// 코멘트 입력 — input 이벤트 (저장은 sc-save 버튼)
document.addEventListener('input', e => {
  const el = e.target.closest('[data-action="sc-cmt"]');
  if(!el) return;
  const snum = el.dataset.snum;
  const asmtId = el.dataset.asmt;
  if(!snum || !asmtId) return;
  const map = asmtId === 'bigdata' ? SC_BIGDATA_SCORES : SC_AICODE_SCORES;
  if(!map[snum]) map[snum] = {};
  map[snum].comment = el.value;
  // 코멘트 변경은 render 없이 메모리만 갱신 (저장 시 함께 반영)
});

/* ─────────────── CSV 내보내기 ─────────────── */
function _scExportCSV(){
  if(!TC_CLS) return;
  const rows = [];
  // 헤더
  const header = ['학번', '이름'];
  for(const a of ASMT_LIST){
    for(const p of a.parts) header.push(`${a.title}_${p.label}`);
    header.push(`${a.title}_합계`);
  }
  header.push('총점');
  rows.push(header);

  const map = {
    bigdata:   SC_BIGDATA_SCORES || {},
    petbottle: ASMT_ALL_SCORES   || {},
    aicode:    SC_AICODE_SCORES  || {},
  };

  for(const st of STUDENTS){
    const r = [st.number, st.name];
    let stuSum = 0, anyScored = false;
    for(const a of ASMT_LIST){
      const sc = map[a.id][st.number] || {};
      let sum = 0, any = false;
      for(const p of a.parts){
        const v = sc[p.key];
        if(typeof v === 'number'){ r.push(v); sum += v; any = true; }
        else r.push('');
      }
      r.push(any ? sum : '');
      if(any){ stuSum += sum; anyScored = true; }
    }
    r.push(anyScored ? stuSum : '');
    rows.push(r);
  }

  // RFC4180 CSV 직렬화 — Excel 호환 BOM 포함
  const csv = '﻿' + rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `수행평가_종합점수_${TC_CLS.id}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('CSV 내보내기 완료', 'ok');
}
