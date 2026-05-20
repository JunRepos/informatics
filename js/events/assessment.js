/* ═══════════════════════════════════════
   events/assessment.js — 📝 수행평가 (4파트 자동채점 시험) 이벤트

   학생: 파트 이동 / 답 입력 / 구현 실행 / 최종 제출(자동 채점)
   선생님: 출제·편집 / 자동 정답 추출 / 배점 / 활성화 / 채점 조정 / CSV

   채점/매칭: _normalizeAns·_matchTraceValue·_matchClozeBlank (events/coderead.js)
   코드 실행: asmt-worker.js (Pyodide) / 자동 분석: coderead-worker.js (settrace)
═══════════════════════════════════════ */

// ── Pyodide 워커 (구현 실행·채점) ──
let _asmtExecWorker = null;
function _asmtEnsureExec(){
  if(_asmtExecWorker) return _asmtExecWorker;
  _asmtExecWorker = new Worker('js/asmt-worker.js?v=20260519');
  return _asmtExecWorker;
}
function _asmtRun(code, stdin){
  return new Promise((resolve) => {
    const w = _asmtEnsureExec();
    const onMsg = (e) => {
      if(e.data?.type === 'result'){ w.removeEventListener('message', onMsg); resolve(e.data); }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ type: 'run', code, stdin });
  });
}

// ── 자동 분석 워커 (정답 추출 — stdout + 줄별 변수) ──
let _asmtTraceWorker = null;
let _asmtTraceSeq = 0;
function _asmtEnsureTrace(){
  if(_asmtTraceWorker) return _asmtTraceWorker;
  _asmtTraceWorker = new Worker('js/coderead-worker.js?v=20260504');
  return _asmtTraceWorker;
}
function _asmtAnalyze(code, stdin){
  return new Promise((resolve) => {
    const w = _asmtEnsureTrace();
    const myId = ++_asmtTraceSeq;
    const onMsg = (e) => {
      if(e.data?.id === myId){ w.removeEventListener('message', onMsg); resolve(e.data); }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id: myId, code, stdin });
  });
}

// 입력값 텍스트(쉼표/줄바꿈) → stdin 줄
function _asmtStdin(raw){
  return String(raw || '').split(/[,\n]/).map(s => s.trim()).filter((s, i, arr) => true).join('\n');
}

// 편집 중 문제 찾기
function _asmtEditFind(part, qid){
  return (ASMT_EDIT && Array.isArray(ASMT_EDIT[part])) ? ASMT_EDIT[part].find(q => q.id === qid) : null;
}

// ══════════════════════════════════════
//  클릭
// ══════════════════════════════════════
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // ── 학생: 파트 이동 ──
  if(act.action === 'asmt-part'){
    ASMT_PART = act.part;
    render();
    return;
  }

  // ── 학생: 구현 코드 실행 ──
  if(act.action === 'asmt-run-impl'){
    if(ASMT_RUNNING) return;
    const qid = act.qid;
    const code = (ASMT_ANSWERS.implement && ASMT_ANSWERS.implement[qid]) || '';
    if(!code.trim()){ toast('실행할 코드를 먼저 작성하세요.', 'err'); return; }
    const stdinRaw = document.querySelector(`.asmt-impl-stdin[data-qid="${qid}"]`)?.value || '';
    ASMT_RUNNING = qid;
    ASMT_RUN[qid] = null;
    render();
    const r = await _asmtRun(code, _asmtStdin(stdinRaw));
    ASMT_RUNNING = null;
    ASMT_RUN[qid] = r;
    render();
    return;
  }

  // ── 학생: 최종 제출 ──
  if(act.action === 'asmt-submit-exam'){
    if(ASMT_RUNNING) return;
    if(!confirm('수행평가를 제출할까요?\n\n제출 후에는 수정할 수 없어요. 빈 문항이 있어도 제출됩니다.')) return;
    await _asmtSubmitExam();
    return;
  }

  // ══ 선생님 ══

  // 출제 시작/편집
  if(act.action === 'asmt-edit-start'){
    if(ASMT_EXAM){
      ASMT_EDIT = JSON.parse(JSON.stringify(ASMT_EXAM));
    } else {
      ASMT_EDIT = { active:false, weights:{predict:5,trace:5,cloze:5,implement:10}, predict:[], trace:[], cloze:[], implement:[] };
    }
    for(const p of ['predict','trace','cloze','implement']) if(!Array.isArray(ASMT_EDIT[p])) ASMT_EDIT[p] = [];
    if(!ASMT_EDIT.weights) ASMT_EDIT.weights = {predict:5,trace:5,cloze:5,implement:10};
    ASMT_EDIT_PART = 'predict';
    ASMT_VIEW = 'edit';
    render();
    return;
  }
  if(act.action === 'asmt-edit-cancel'){
    ASMT_EDIT = null;
    ASMT_VIEW = 'manage';
    render();
    return;
  }
  if(act.action === 'asmt-edit-part'){
    ASMT_EDIT_PART = act.part;
    render();
    return;
  }

  // 문제 추가
  if(act.action === 'asmt-add-q'){
    const part = act.part;
    if(!ASMT_EDIT) return;
    const id = genId();
    if(part === 'predict')        ASMT_EDIT.predict.push({id, code:'', stdin:'', expected:null});
    else if(part === 'trace')     ASMT_EDIT.trace.push({id, code:'', stdin:'', vars:null});
    else if(part === 'cloze')     ASMT_EDIT.cloze.push({id, code:'', blanks:[], desc:''});
    else if(part === 'implement') ASMT_EDIT.implement.push({id, title:'', desc:'', starter:'', tests:[]});
    render();
    return;
  }
  // 문제 삭제
  if(act.action === 'asmt-del-q'){
    const {part, qid} = act;
    if(!ASMT_EDIT || !Array.isArray(ASMT_EDIT[part])) return;
    if(!confirm('이 문제를 삭제할까요?')) return;
    ASMT_EDIT[part] = ASMT_EDIT[part].filter(q => q.id !== qid);
    render();
    return;
  }

  // 테스트 추가/삭제 (구현)
  if(act.action === 'asmt-add-tc'){
    const q = _asmtEditFind('implement', act.qid);
    if(!q) return;
    if(!Array.isArray(q.tests)) q.tests = [];
    q.tests.push({input:'', expected:'', hidden:false});
    render();
    return;
  }
  if(act.action === 'asmt-del-tc'){
    const q = _asmtEditFind('implement', act.qid);
    if(!q || !Array.isArray(q.tests)) return;
    q.tests.splice(parseInt(act.ti), 1);
    render();
    return;
  }

  // 자동 분석 (정답 추출)
  if(act.action === 'asmt-analyze'){
    if(ASMT_ANALYZING) return;
    const {part, qid} = act;
    const q = _asmtEditFind(part, qid);
    if(!q){ return; }
    if(!(q.code || '').trim()){ toast('먼저 코드를 입력하세요.', 'err'); return; }
    ASMT_ANALYZING = qid;
    render();
    try {
      const r = await _asmtAnalyze(q.code, _asmtStdin(q.stdin));
      if(r.error){
        alert('⚠️ 코드 실행 중 오류가 있어요. 정답을 추출할 수 없습니다:\n\n' + r.error);
      } else if(part === 'predict'){
        q.expected = r.output || '';
      } else if(part === 'trace'){
        const traces = r.traces || [];
        const last = traces.length ? traces[traces.length - 1] : null;
        const vars = (last && last.locals) ? last.locals : {};
        if(!Object.keys(vars).length){
          alert('추적할 변수를 찾지 못했어요. 코드에 변수 할당이 있는지 확인해주세요.');
        }
        q.vars = vars;
      }
    } catch(err){
      alert('분석 실패: ' + (err.message || err));
    }
    ASMT_ANALYZING = null;
    render();
    return;
  }

  // 활성화 토글
  if(act.action === 'asmt-set-active'){
    const cid = TC_CLS?.id;
    if(!cid){ toast('반을 먼저 선택하세요.', 'err'); return; }
    if(!ASMT_EXAM){ toast('먼저 시험을 출제하세요.', 'err'); return; }
    const next = act.on === '1';
    if(!!ASMT_EXAM.active === next) return;
    if(next){
      const has = ASMT_PARTS.some(p => _asmtPartList(ASMT_EXAM, p.id).length);
      if(!has){ toast('등록된 문제가 없어요. 먼저 문제를 출제하세요.', 'err'); return; }
    }
    try {
      await setAsmtExamActive(cid, next);
      toast(next ? '✓ 시험을 시작했어요. 학생 화면에 탭이 보입니다.' : '시험을 닫았어요.', 'ok');
      render();
    } catch(err){ toast('변경 실패: ' + (err.message || err), 'err'); }
    return;
  }

  // 시험 저장
  if(act.action === 'asmt-edit-save'){
    await _asmtSaveExam();
    return;
  }

  // 학생 상세 / 뒤로
  if(act.action === 'asmt-tc-view'){
    ASMT_TC_SEL_SNUM = act.snum;
    ASMT_VIEW = 'student';
    render();
    setTimeout(() => window.scrollTo({top:0, behavior:'instant'}), 30);
    return;
  }
  if(act.action === 'asmt-tc-back'){
    ASMT_TC_SEL_SNUM = null;
    ASMT_VIEW = 'manage';
    render();
    return;
  }

  // 점수 저장 (선생님 조정)
  if(act.action === 'asmt-score-save'){
    await _asmtSaveScore();
    return;
  }

  // CSV
  if(act.action === 'asmt-export-csv'){
    _asmtExportCsv();
    return;
  }
});

// ══════════════════════════════════════
//  입력 (input)
// ══════════════════════════════════════
document.addEventListener('input', e => {
  const t = e.target;
  if(!t || !t.dataset) return;
  const a = t.dataset.action;

  // 학생 답안 (re-render 없이 모델만 갱신 → 포커스 보존)
  if(a === 'asmt-ans-predict'){
    if(!ASMT_ANSWERS.predict) ASMT_ANSWERS.predict = {};
    ASMT_ANSWERS.predict[t.dataset.qid] = t.value;
    return;
  }
  if(a === 'asmt-ans-trace'){
    if(!ASMT_ANSWERS.trace) ASMT_ANSWERS.trace = {};
    const qid = t.dataset.qid;
    if(!ASMT_ANSWERS.trace[qid]) ASMT_ANSWERS.trace[qid] = {};
    ASMT_ANSWERS.trace[qid][t.dataset.var] = t.value;
    return;
  }
  if(a === 'asmt-ans-cloze'){
    if(!ASMT_ANSWERS.cloze) ASMT_ANSWERS.cloze = {};
    const qid = t.dataset.qid;
    if(!Array.isArray(ASMT_ANSWERS.cloze[qid])) ASMT_ANSWERS.cloze[qid] = [];
    ASMT_ANSWERS.cloze[qid][parseInt(t.dataset.bi)] = t.value;
    return;
  }
  if(a === 'asmt-ans-impl'){
    if(!ASMT_ANSWERS.implement) ASMT_ANSWERS.implement = {};
    ASMT_ANSWERS.implement[t.dataset.qid] = t.value;
    return;
  }

  // 선생님 편집 — 문제 필드
  if(a === 'asmt-edit-field'){
    const part = ASMT_EDIT_PART;
    const q = _asmtEditFind(part, t.dataset.qid);
    if(q) q[t.dataset.field] = t.value;
    return;
  }
  if(a === 'asmt-edit-blanks'){
    const q = _asmtEditFind('cloze', t.dataset.qid);
    if(q){
      let lines = t.value.split('\n');
      while(lines.length && lines[lines.length-1] === '') lines.pop();
      q.blanks = lines;
    }
    return;
  }
  if(a === 'asmt-weight'){
    if(ASMT_EDIT){
      if(!ASMT_EDIT.weights) ASMT_EDIT.weights = {};
      const v = parseFloat(t.value);
      ASMT_EDIT.weights[t.dataset.part] = (isFinite(v) && v >= 0) ? v : 0;
    }
    return;
  }
  if(a === 'asmt-tc-field'){
    const q = _asmtEditFind('implement', t.dataset.qid);
    if(q && Array.isArray(q.tests)){
      const tc = q.tests[parseInt(t.dataset.ti)];
      if(tc) tc[t.dataset.field] = t.value;
    }
    return;
  }
});

// ══════════════════════════════════════
//  변경 (change) — 체크박스
// ══════════════════════════════════════
document.addEventListener('change', e => {
  const t = e.target;
  if(t?.dataset?.action === 'asmt-tc-hidden'){
    const q = _asmtEditFind('implement', t.dataset.qid);
    if(q && Array.isArray(q.tests)){
      const tc = q.tests[parseInt(t.dataset.ti)];
      if(tc) tc.hidden = t.checked;
    }
  }
});

// ══════════════════════════════════════
//  로직 함수
// ══════════════════════════════════════

// 학생 제출 — 자동 채점
async function _asmtSubmitExam(){
  const exam = ASMT_EXAM;
  const answers = ASMT_ANSWERS;
  const autoScore = {};

  // 동기 채점 파트
  for(const part of ['predict','trace','cloze']){
    autoScore[part] = _asmtGradeSyncPart(part, _asmtPartList(exam, part), answers);
  }

  // 구현 — 코드 실행 채점 (비동기)
  const implList = _asmtPartList(exam, 'implement');
  if(implList.length){
    ASMT_RUNNING = 'grading';
    render();
    let correct = 0, total = 0;
    const implAns = answers.implement || {};
    for(const q of implList){
      const tests = q.tests || [];
      const code = implAns[q.id] || '';
      for(const tc of tests){
        total++;
        if(!code.trim()) continue;
        const r = await _asmtRun(code, tc.input || '');
        if(r.success && _normalizeAns(r.output) === _normalizeAns(tc.expected)) correct++;
      }
    }
    autoScore.implement = { correct, total };
  } else {
    autoScore.implement = { correct:0, total:0 };
  }

  try {
    await saveAsmtSubmission(SEL_CLS.id, ST_USER.number, { answers, autoScore });
    ASMT_AUTO = autoScore;
    ASMT_SUBMITTED_AT = new Date().toISOString();
    ASMT_RUNNING = null;
    ASMT_VIEW = 'done';
    render();
    toast('제출 완료! 수고했어요 🎉', 'ok');
  } catch(err){
    ASMT_RUNNING = null;
    render();
    toast('제출 실패: ' + (err.message || err), 'err');
  }
}

// 시험 저장 (선생님)
async function _asmtSaveExam(){
  const cid = TC_CLS?.id;
  if(!cid || !ASMT_EDIT){ return; }

  // 검증 — 경고만 (저장은 허용)
  const warns = [];
  const pr = _asmtPartList(ASMT_EDIT, 'predict').filter(q => q.expected == null);
  if(pr.length) warns.push(`출력예측 ${pr.length}문제: 자동 분석(정답)이 없습니다.`);
  const tr = _asmtPartList(ASMT_EDIT, 'trace').filter(q => !q.vars || !Object.keys(q.vars).length);
  if(tr.length) warns.push(`변수추적 ${tr.length}문제: 자동 분석(변수)이 없습니다.`);
  const cl = _asmtPartList(ASMT_EDIT, 'cloze').filter(q => (String(q.code||'').match(/___/g)||[]).length !== (q.blanks||[]).length);
  if(cl.length) warns.push(`빈칸 ${cl.length}문제: 빈칸 수와 정답 수가 다릅니다.`);
  const im = _asmtPartList(ASMT_EDIT, 'implement').filter(q => !(q.tests||[]).length);
  if(im.length) warns.push(`구현 ${im.length}문제: 테스트 케이스가 없습니다.`);

  if(warns.length){
    if(!confirm('⚠️ 아래 문제가 있어요. 그래도 저장할까요?\n(저장 후 보완 가능)\n\n' + warns.join('\n'))) return;
  }

  try {
    await saveAsmtExam(cid, ASMT_EDIT);
    ASMT_EXAM = JSON.parse(JSON.stringify(ASMT_EDIT));
    ASMT_EDIT = null;
    ASMT_VIEW = 'manage';
    render();
    toast('✓ 시험을 저장했어요.', 'ok');
  } catch(err){
    toast('저장 실패: ' + (err.message || err), 'err');
  }
}

// 점수 저장 (선생님 조정)
async function _asmtSaveScore(){
  const snum = ASMT_TC_SEL_SNUM;
  if(!snum || !TC_CLS) return;
  const score = {};
  document.querySelectorAll('.asmt-sc-input').forEach(inp => {
    const v = parseFloat(inp.value);
    score[inp.dataset.rid] = isFinite(v) ? v : 0;
  });
  const commentEl = document.querySelector('.asmt-tcs-comment-area');
  if(commentEl) score.comment = commentEl.value || '';
  try {
    await saveAsmtScore(TC_CLS.id, snum, score);
    ASMT_ALL_SCORES[snum] = { ...score, scoredAt: new Date().toISOString() };
    render();
    toast('✓ 점수를 저장했어요.', 'ok');
  } catch(err){
    toast('저장 실패: ' + (err.message || err), 'err');
  }
}

// CSV 내보내기
function _asmtExportCsv(){
  if(!STUDENTS.length){ toast('학생 명단이 비어있어요.', 'err'); return; }
  const cls = TC_CLS?.label || TC_CLS?.id || 'unknown';
  const headers = ['학번','이름','제출','알고리즘','자료형','입출력','제어구조','결과','총점','코멘트','제출시각'];
  const rows = STUDENTS.map(st => {
    const sub = ASMT_ALL_SUBS[st.number] || null;
    const sc = ASMT_ALL_SCORES[st.number] || null;
    if(!sub || !sub.submittedAt) return [st.number, st.name, '미제출', '','','','','','','',''];
    const fin = _asmtFinalScore(sub, sc);
    return [
      st.number, st.name, '제출',
      _asmtRound(fin.five.algo.score), _asmtRound(fin.five.dataType.score), _asmtRound(fin.five.io.score),
      _asmtRound(fin.five.control.score), _asmtRound(fin.five.result.score),
      _asmtRound(fin.total), (sc?.comment || '').replace(/\n/g,' '), fmtDt(sub.submittedAt)
    ];
  });
  const csvRow = (arr) => arr.map(v => {
    const s = String(v ?? '');
    return /[,"\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }).join(',');
  const csv = '﻿' + csvRow(headers) + '\n' + rows.map(csvRow).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `수행평가-${cls}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('✓ CSV 다운로드 시작', 'ok');
}

// render 후 (현재 특별 처리 없음)
function afterRenderAssessment(){}
window.afterRenderAssessment = afterRenderAssessment;
