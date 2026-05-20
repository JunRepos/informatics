/* ═══════════════════════════════════════
   views/assessment.js — 📝 수행평가 (4파트 자동채점 시험)

   ① 출력예측(predict) ② 변수추적(trace) ③ 빈칸(cloze) ④ 구현(implement)
   - AI 없음. 전부 Pyodide 자동 채점.
   - 5평가요소(25점) 환산: 예측→결과 / 추적→자료형 / 빈칸→제어 / 구현→추상화+입출력
   - 학생: 4파트 자유 이동 → 최종 제출 1회 → 자동 채점
   - 선생님: 전용 출제(파트별 문제 + 배점) + 자동 정답 추출 + 채점 조정 + CSV

   채점 헬퍼는 events/coderead.js 의 _normalizeAns/_matchTraceValue/_matchClozeBlank 재사용.
═══════════════════════════════════════ */

// ── 공통 헬퍼 ──
function _asmtWeights(exam){
  const w = (exam && exam.weights) || {};
  const num = (v, d) => (typeof v === 'number' && isFinite(v) && v >= 0) ? v : d;
  return {
    predict:   num(w.predict, 5),
    trace:     num(w.trace, 5),
    cloze:     num(w.cloze, 5),
    implement: num(w.implement, 10),
  };
}
function _asmtPartList(exam, part){ return (exam && Array.isArray(exam[part])) ? exam[part] : []; }
function _asmtFirstPart(exam){
  for(const p of ASMT_PARTS){ if(_asmtPartList(exam, p.id).length) return p.id; }
  return 'predict';
}
function _asmtInitialStudentView(exam, sub){
  if(!exam || !exam.active) return 'closed';
  if(sub && sub.submittedAt) return 'done';
  return 'exam';
}
// 코드 줄번호 렌더 (읽기 전용)
function _asmtCodeLines(code){
  return String(code || '').split('\n').map((src, i) =>
    `<div class="cr-code-line"><span class="cr-line-no">${i+1}</span><span class="cr-line-src">${esc(src) || ' '}</span></div>`
  ).join('');
}

// 한 파트의 (정답수, 전체수) — predict/trace/cloze 동기 채점. implement 는 별도(비동기).
function _asmtGradeSyncPart(part, list, answers){
  let correct = 0, total = 0;
  const ans = (answers && answers[part]) || {};
  if(part === 'predict'){
    for(const q of list){
      total++;
      const g = _normalizeAns(ans[q.id]);
      if(g && g === _normalizeAns(q.expected)) correct++;
    }
  } else if(part === 'trace'){
    for(const q of list){
      const vars = q.vars || {};
      const a = ans[q.id] || {};
      for(const k of Object.keys(vars)){ total++; if(_matchTraceValue(a[k], vars[k])) correct++; }
    }
  } else if(part === 'cloze'){
    for(const q of list){
      const blanks = q.blanks || [];
      const a = ans[q.id] || [];
      for(let i = 0; i < blanks.length; i++){ total++; if(_matchClozeBlank(a[i], blanks[i])) correct++; }
    }
  }
  return { correct, total };
}

// autoScore → 5평가요소 환산 { id: {score, max} }
function _asmt5(exam, autoScore){
  const w = _asmtWeights(exam);
  const has = (p) => _asmtPartList(exam, p).length > 0;
  const ratio = (p) => { const a = autoScore && autoScore[p]; return (a && a.total) ? a.correct / a.total : 0; };
  const implMax = w.implement / 2;
  return {
    result:   { score: has('predict')   ? w.predict * ratio('predict')   : 0, max: has('predict')   ? w.predict : 0 },
    dataType: { score: has('trace')     ? w.trace   * ratio('trace')     : 0, max: has('trace')     ? w.trace   : 0 },
    control:  { score: has('cloze')     ? w.cloze   * ratio('cloze')     : 0, max: has('cloze')     ? w.cloze   : 0 },
    algo:     { score: has('implement') ? implMax   * ratio('implement') : 0, max: has('implement') ? implMax   : 0 },
    io:       { score: has('implement') ? implMax   * ratio('implement') : 0, max: has('implement') ? implMax   : 0 },
  };
}
function _asmtRound(x){ return Math.round((Number(x) || 0) * 10) / 10; }

// 파트별 진행률 (학생 탭 표시용)
function _asmtPartProgress(part, list){
  const ans = ASMT_ANSWERS[part] || {};
  let done = 0;
  for(const q of list){
    if(part === 'predict' || part === 'implement'){ if((ans[q.id] || '').trim()) done++; }
    else if(part === 'trace'){ const a = ans[q.id] || {}; if(Object.keys(q.vars || {}).some(k => (a[k] || '').trim())) done++; }
    else if(part === 'cloze'){ const a = ans[q.id] || []; if((q.blanks || []).some((_, b) => (a[b] || '').trim())) done++; }
  }
  return { done, total: list.length };
}

// ══════════════════════════════════════
//  학생 뷰
// ══════════════════════════════════════

function vStAssessment(){
  if(ASMT_VIEW === 'closed' || !ASMT_EXAM || !ASMT_EXAM.active)
    return emptyBox('🔒', '수행평가가 아직 시작되지 않았어요. 선생님 안내를 기다려주세요.');
  if(ASMT_VIEW === 'done') return vStAsmtDone();
  return vStAsmtExam();
}

function vStAsmtExam(){
  const exam = ASMT_EXAM;
  const avail = ASMT_PARTS.filter(p => _asmtPartList(exam, p.id).length);
  if(!avail.length) return emptyBox('📭', '아직 등록된 문제가 없어요. 선생님께 문의해주세요.');

  let cur = ASMT_PART;
  if(!avail.find(p => p.id === cur)){ cur = avail[0].id; ASMT_PART = cur; }

  let allDone = 0, allTotal = 0;
  const partTabs = avail.map(p => {
    const list = _asmtPartList(exam, p.id);
    const { done, total } = _asmtPartProgress(p.id, list);
    allDone += done; allTotal += total;
    return `<button class="asmt-part-tab ${p.id === cur ? 'on' : ''}" data-action="asmt-part" data-part="${p.id}">
      <span class="asmt-part-ic">${p.icon}</span>
      <span class="asmt-part-lb">${esc(p.label)}</span>
      <span class="asmt-part-pg">${done}/${total}</span>
    </button>`;
  }).join('');

  const bodyFn = { predict: _vStAsmtPredict, trace: _vStAsmtTrace, cloze: _vStAsmtCloze, implement: _vStAsmtImplement }[cur];
  const body = bodyFn ? bodyFn(exam) : '';

  const submitting = ASMT_RUNNING === 'grading';

  return `
    <div class="asmt-exam-wrap">
      <div class="asmt-exam-bar">
        <div class="asmt-exam-title">📝 수행평가</div>
        <div class="asmt-exam-actions">
          <span class="asmt-exam-prog">전체 ${allDone} / ${allTotal} 문항</span>
          <button class="btn-p btn-sm" data-action="asmt-submit-exam" ${submitting ? 'disabled' : ''}>
            ${submitting ? '⏳ 채점 중...' : '제출하기'}
          </button>
        </div>
      </div>
      <div class="asmt-exam-info">
        🧭 위 탭으로 <b>4가지 파트를 자유롭게 오가며</b> 풀 수 있어요. 다 풀면 <b>제출하기</b>를 누르세요.
        <b>제출 후에는 수정할 수 없어요.</b>
      </div>
      <div class="asmt-part-tabs">${partTabs}</div>
      <div class="asmt-part-body">${body}</div>
    </div>
  `;
}

function _vStAsmtPredict(exam){
  const list = _asmtPartList(exam, 'predict');
  const ans = ASMT_ANSWERS.predict || {};
  return list.map((q, i) => {
    const stdinBox = q.stdin ? `<div class="asmt-stdin-box"><span>⌨️ 입력값</span><pre>${esc(q.stdin)}</pre></div>` : '';
    return `<div class="asmt-q-card">
      <div class="asmt-q-head"><span class="asmt-q-num">${i+1}</span><span class="asmt-q-text">이 코드를 실행하면 무엇이 출력될까요? 결과를 그대로 적어보세요.</span></div>
      <pre class="cr-code-box">${_asmtCodeLines(q.code)}</pre>
      ${stdinBox}
      <textarea class="asmt-q-answer" data-action="asmt-ans-predict" data-qid="${esc(q.id)}" placeholder="출력 결과를 그대로 적어주세요 (줄바꿈 포함)" spellcheck="false">${esc(ans[q.id] || '')}</textarea>
    </div>`;
  }).join('');
}

function _vStAsmtTrace(exam){
  const list = _asmtPartList(exam, 'trace');
  const ans = ASMT_ANSWERS.trace || {};
  return list.map((q, i) => {
    const a = ans[q.id] || {};
    const vars = q.vars || {};
    const rows = Object.keys(vars).map(k => `
      <div class="asmt-trace-row">
        <label class="asmt-trace-var">${esc(k)}</label>
        <input class="asmt-trace-input" data-action="asmt-ans-trace" data-qid="${esc(q.id)}" data-var="${esc(k)}" value="${esc(a[k] || '')}" placeholder="최종 값" autocomplete="off" spellcheck="false"/>
      </div>`).join('');
    const stdinBox = q.stdin ? `<div class="asmt-stdin-box"><span>⌨️ 입력값</span><pre>${esc(q.stdin)}</pre></div>` : '';
    return `<div class="asmt-q-card">
      <div class="asmt-q-head"><span class="asmt-q-num">${i+1}</span><span class="asmt-q-text">코드를 끝까지 실행했을 때, 각 변수의 <b>최종 값</b>을 적어보세요.</span></div>
      <pre class="cr-code-box">${_asmtCodeLines(q.code)}</pre>
      ${stdinBox}
      <div class="asmt-trace-grid">${rows || '<i>추적할 변수가 없습니다.</i>'}</div>
    </div>`;
  }).join('');
}

function _vStAsmtCloze(exam){
  const list = _asmtPartList(exam, 'cloze');
  const ans = ASMT_ANSWERS.cloze || {};
  return list.map((q, i) => {
    const a = ans[q.id] || [];
    const segs = esc(q.code || '').split('___');
    let html = '';
    for(let b = 0; b < segs.length; b++){
      html += segs[b];
      if(b < segs.length - 1){
        html += `<input class="quiz-cloze-blank" data-action="asmt-ans-cloze" data-qid="${esc(q.id)}" data-bi="${b}" value="${esc(a[b] || '')}" autocomplete="off" spellcheck="false"/>`;
      }
    }
    const descBox = q.desc ? `<div class="asmt-q-hint">${esc(q.desc)}</div>` : '';
    return `<div class="asmt-q-card">
      <div class="asmt-q-head"><span class="asmt-q-num">${i+1}</span><span class="asmt-q-text">빈칸(___)에 들어갈 코드를 채워보세요.</span></div>
      ${descBox}
      <pre class="asmt-cloze-pre">${html}</pre>
    </div>`;
  }).join('');
}

function _vStAsmtImplement(exam){
  const list = _asmtPartList(exam, 'implement');
  const ans = ASMT_ANSWERS.implement || {};
  return list.map((q, i) => {
    const code = (ans[q.id] != null) ? ans[q.id] : (q.starter || '');
    const tests = q.tests || [];
    const shown = tests.filter(t => !t.hidden);
    const hiddenCount = tests.length - shown.length;
    const testHtml = shown.map((t, ti) => `
      <div class="asmt-tc">
        <div class="asmt-tc-h">예시 ${ti+1}</div>
        <div class="asmt-tc-row"><span>입력</span><pre>${esc(t.input || '(없음)')}</pre></div>
        <div class="asmt-tc-row"><span>출력</span><pre>${esc(t.expected || '')}</pre></div>
      </div>`).join('');
    const run = ASMT_RUN[q.id];
    let runBlock = '';
    if(ASMT_RUNNING === q.id){
      runBlock = `<div class="asmt-mod-run-loading">⏳ 실행 중... (첫 실행은 10~15초 걸려요)</div>`;
    } else if(run){
      runBlock = `<div class="asmt-mod-run-result ${run.success ? 'ok' : 'err'}">
        <div class="asmt-mod-run-head">${run.success ? '✅ 실행 결과' : '⚠️ 실행 오류'}</div>
        ${run.output ? `<pre class="asmt-mod-run-out">${esc(run.output)}</pre>` : ''}
        ${run.error ? `<pre class="asmt-mod-run-err">${esc(run.error)}</pre>` : ''}
      </div>`;
    }
    const descHtml = q.desc ? (typeof marked !== 'undefined' ? marked.parse(q.desc) : esc(q.desc).replace(/\n/g, '<br>')) : '';
    return `<div class="asmt-q-card">
      <div class="asmt-q-head"><span class="asmt-q-num">${i+1}</span><span class="asmt-q-text">${esc(q.title || '코드 구현')}</span></div>
      ${descHtml ? `<div class="asmt-impl-desc">${descHtml}</div>` : ''}
      ${testHtml ? `<div class="asmt-tc-list">${testHtml}${hiddenCount ? `<div class="asmt-tc-hidden">🔒 숨김 테스트 ${hiddenCount}개 (제출 시 함께 채점)</div>` : ''}</div>` : ''}
      <textarea class="asmt-impl-code" data-action="asmt-ans-impl" data-qid="${esc(q.id)}" spellcheck="false" placeholder="여기에 코드를 작성하세요">${esc(code)}</textarea>
      <div class="asmt-q-run">
        <div class="asmt-q-run-row">
          <input type="text" class="asmt-impl-stdin" data-qid="${esc(q.id)}" placeholder="실행에 쓸 입력값 (쉼표 또는 줄바꿈으로 구분)" autocomplete="off"/>
          <button class="btn-sm" data-action="asmt-run-impl" data-qid="${esc(q.id)}" ${ASMT_RUNNING ? 'disabled' : ''}>▶ 실행</button>
        </div>
        ${runBlock}
      </div>
    </div>`;
  }).join('');
}

function vStAsmtDone(){
  const submittedAt = ASMT_SUBMITTED_AT ? fmtDt(ASMT_SUBMITTED_AT) : '';
  const rows = ASMT_PARTS.filter(p => _asmtPartList(ASMT_EXAM, p.id).length).map(p => {
    const a = ASMT_AUTO && ASMT_AUTO[p.id];
    const ansCount = a ? `${a.correct}/${a.total} 항목 정답` : '채점 완료';
    return `<tr><td>${p.icon} ${esc(p.label)}</td><td>${ansCount}</td></tr>`;
  }).join('');
  return `
    <div class="asmt-done-wrap">
      <div class="asmt-done-card">
        <div class="asmt-done-icon">🎉</div>
        <div class="asmt-done-title">수행평가 제출 완료!</div>
        <div class="asmt-done-sub">수고했어요. 자동 채점이 끝났고, 선생님이 최종 확인 후 점수가 반영됩니다.</div>
        ${submittedAt ? `<div class="asmt-done-time">제출 시각: ${submittedAt}</div>` : ''}
      </div>
      <div class="asmt-done-summary">
        <div class="asmt-done-summary-title">📋 채점 요약</div>
        <table class="asmt-done-table">${rows}</table>
      </div>
      <div class="asmt-done-note">💡 제출 후에는 수정할 수 없어요. 결과는 선생님이 확인한 뒤 알려주실 거예요.</div>
    </div>
  `;
}

// ══════════════════════════════════════
//  선생님 뷰
// ══════════════════════════════════════

function vTcAssessment(){
  if(!TC_CLS) return emptyBox('👆', '관리할 반을 먼저 선택하세요.');
  if(ASMT_VIEW === 'edit' && ASMT_EDIT) return vTcAsmtEdit();
  if(ASMT_VIEW === 'student' && ASMT_TC_SEL_SNUM) return vTcAsmtStudent();
  return vTcAsmtManage();
}

// 학생 제출의 최종 점수(선생님 조정 우선, 없으면 자동) → {five, total, max}
function _asmtFinalScore(sub, savedScore){
  const auto = sub && sub.autoScore;
  const five = _asmt5(ASMT_EXAM, auto);
  const out = {};
  let total = 0, max = 0;
  for(const r of ASMT_RUBRIC){
    const m = five[r.id] ? five[r.id].max : 0;
    let s = five[r.id] ? five[r.id].score : 0;
    if(savedScore && typeof savedScore[r.id] === 'number') s = savedScore[r.id]; // 선생님 조정값 우선
    out[r.id] = { score: s, max: m };
    total += s; max += m;
  }
  return { five: out, total, max };
}

function vTcAsmtManage(){
  const exam = ASMT_EXAM;
  const active = !!(exam && exam.active);
  const subs = ASMT_ALL_SUBS || {};
  const scores = ASMT_ALL_SCORES || {};

  // 시험 미작성
  if(!exam){
    return `
      <div class="asmt-phase-row">
        <div class="asmt-phase-info">
          <div class="asmt-phase-title">📝 수행평가 (4파트 자동채점 시험)</div>
          <div class="asmt-phase-cur">아직 이 반의 시험이 만들어지지 않았어요.</div>
        </div>
        <button class="btn-p" data-action="asmt-edit-start">✏️ 시험 출제하기</button>
      </div>
      <div class="asmt-tc-help">
        <b>📖 안내</b>
        <ul>
          <li><b>출제하기</b>를 누르면 4개 파트(출력예측·변수추적·빈칸·구현)의 문제를 등록할 수 있어요.</li>
          <li>① 출력예측·② 변수추적은 코드만 넣고 <b>🪄 자동 분석</b>을 누르면 정답이 자동으로 추출됩니다.</li>
          <li>학생 제출은 <b>전부 자동 채점</b>되고, 5개 평가요소(25점)로 환산돼요. 점수는 선생님이 조정할 수 있어요.</li>
        </ul>
      </div>
    `;
  }

  const w = _asmtWeights(exam);
  const partSummary = ASMT_PARTS.map(p => {
    const n = _asmtPartList(exam, p.id).length;
    return `<div class="asmt-psum ${n ? '' : 'empty'}">
      <span class="asmt-psum-ic">${p.icon}</span>
      <span class="asmt-psum-lb">${esc(p.label)}</span>
      <span class="asmt-psum-n">${n}문제</span>
      <span class="asmt-psum-w">${_asmtRound(w[p.id])}점</span>
    </div>`;
  }).join('');
  const totalW = w.predict + w.trace + w.cloze + w.implement;

  const toggle = `
    <div class="asmt-phase-seg">
      <button class="asmt-phase-btn ${!active ? 'on' : ''}" data-action="asmt-set-active" data-on="0">🔒 닫기</button>
      <button class="asmt-phase-btn ${active ? 'on prep' : ''}" data-action="asmt-set-active" data-on="1">📝 시험 시작</button>
    </div>`;

  // 학생 행
  const stuRows = STUDENTS.map(st => {
    const sub = subs[st.number] || null;
    const sc = scores[st.number] || null;
    const submitted = !!(sub && sub.submittedAt);
    let scoreCell = '<span class="asmt-score-chip none">-</span>';
    if(submitted){
      const fin = _asmtFinalScore(sub, sc);
      const adj = sc ? ' (조정)' : '';
      scoreCell = `<span class="asmt-score-chip">${_asmtRound(fin.total)}/${_asmtRound(fin.max)}${adj}</span>`;
    }
    return `<tr>
      <td>${esc(st.number)}</td>
      <td>${esc(st.name)}</td>
      <td>${submitted ? `✅ ${fmtDt(sub.submittedAt)}` : '<span style="color:var(--text3)">미제출</span>'}</td>
      <td>${scoreCell}</td>
      <td><button class="btn-xs" data-action="asmt-tc-view" data-snum="${esc(st.number)}" ${submitted ? '' : 'disabled'}>보기</button></td>
    </tr>`;
  }).join('');

  const submittedCount = STUDENTS.filter(st => subs[st.number]?.submittedAt).length;

  return `
    <div class="asmt-phase-row">
      <div class="asmt-phase-info">
        <div class="asmt-phase-title">📝 수행평가 (4파트 자동채점)</div>
        <div class="asmt-phase-cur">${active
          ? '<b style="color:var(--ok)">● 시험 진행 중</b> — 학생 화면에 "📝 수행평가" 탭이 보이고 응시할 수 있어요.'
          : '<b style="color:var(--text3)">● 닫힘</b> — 학생 화면에 보이지 않습니다. (제출·점수는 보존)'}</div>
      </div>
      ${toggle}
    </div>

    <div class="asmt-exam-meta">
      <div class="asmt-exam-meta-head">
        <span>출제 현황 — 총 <b>${_asmtRound(totalW)}점</b></span>
        <button class="btn-sm" data-action="asmt-edit-start">✏️ 출제/편집</button>
      </div>
      <div class="asmt-psum-grid">${partSummary}</div>
    </div>

    <div class="asmt-stat-grid">
      <div class="stat-card"><div class="stat-num">${STUDENTS.length}</div><div class="stat-label">전체 학생</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--ok)">${submittedCount}</div><div class="stat-label">제출 완료</div></div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-top:14px">
      <div class="sec-title" style="margin:0">학생별 제출·점수</div>
      <button class="btn-sm" data-action="asmt-export-csv" title="자동 채점(또는 조정) 점수를 CSV로 내보내기 (NEIS 활용)">📤 CSV 내보내기</button>
    </div>

    ${STUDENTS.length === 0
      ? emptyBox('👥', '먼저 학생을 등록하세요.')
      : `<div style="overflow-x:auto"><table class="tbl asmt-tc-table">
          <thead><tr><th>학번</th><th>이름</th><th>제출</th><th>점수</th><th></th></tr></thead>
          <tbody>${stuRows}</tbody>
        </table></div>`
    }
  `;
}

// ── 선생님: 시험 출제/편집 ──
function vTcAsmtEdit(){
  const edit = ASMT_EDIT;
  const w = _asmtWeights(edit);
  const cur = ASMT_EDIT_PART;

  const partTabs = ASMT_PARTS.map(p => {
    const n = _asmtPartList(edit, p.id).length;
    return `<button class="asmt-part-tab ${p.id === cur ? 'on' : ''}" data-action="asmt-edit-part" data-part="${p.id}">
      <span class="asmt-part-ic">${p.icon}</span>
      <span class="asmt-part-lb">${esc(p.label)}</span>
      <span class="asmt-part-pg">${n}</span>
    </button>`;
  }).join('');

  const weightInputs = ASMT_PARTS.map(p => `
    <label class="asmt-w-item">
      <span>${p.icon} ${esc(p.label)}</span>
      <input type="number" min="0" step="0.5" class="asmt-w-input" data-action="asmt-weight" data-part="${p.id}" value="${_asmtRound(w[p.id])}"/>점
    </label>`).join('');
  const totalW = w.predict + w.trace + w.cloze + w.implement;

  const bodyFn = { predict: _vTcEditPredict, trace: _vTcEditTrace, cloze: _vTcEditCloze, implement: _vTcEditImplement }[cur];
  const body = bodyFn ? bodyFn(edit) : '';
  const curMeta = ASMT_PARTS.find(p => p.id === cur);

  return `
    <div class="asmt-edit-bar">
      <button class="btn-sm" data-action="asmt-edit-cancel">← 관리로</button>
      <div class="asmt-edit-title">✏️ 수행평가 출제 — ${esc(TC_CLS.label)}</div>
      <button class="btn-p btn-sm" data-action="asmt-edit-save">💾 저장</button>
    </div>

    <div class="asmt-w-row">
      <div class="asmt-w-title">파트별 배점 (합계 <b>${_asmtRound(totalW)}점</b>)</div>
      <div class="asmt-w-grid">${weightInputs}</div>
      <div class="asmt-w-note">5요소 환산: 예측→결과 / 추적→자료형 / 빈칸→제어구조 / 구현→추상화+입출력(절반씩). 기본 합계 25점.</div>
    </div>

    <div class="asmt-part-tabs">${partTabs}</div>
    <div class="asmt-edit-part-desc">${curMeta ? `${curMeta.icon} <b>${esc(curMeta.label)}</b> — ${esc(curMeta.desc)}` : ''}</div>
    <div class="asmt-part-body">${body}</div>
    <div style="margin-top:12px">
      <button class="btn-sm" data-action="asmt-add-q" data-part="${cur}">+ ${curMeta ? esc(curMeta.label) : ''} 문제 추가</button>
    </div>
  `;
}

function _vTcEditPredict(edit){
  const list = _asmtPartList(edit, 'predict');
  if(!list.length) return emptyBox('🔮', '아직 문제가 없어요. 아래 "+ 문제 추가"로 등록하세요.');
  return list.map((q, i) => `
    <div class="asmt-eq" data-qid="${esc(q.id)}">
      <div class="asmt-eq-head"><b>출력예측 ${i+1}</b>
        <button class="btn-xs danger" data-action="asmt-del-q" data-part="predict" data-qid="${esc(q.id)}">🗑 삭제</button></div>
      <label class="asmt-eq-lb">코드</label>
      <textarea class="asmt-eq-code" data-action="asmt-edit-field" data-qid="${esc(q.id)}" data-field="code" spellcheck="false" placeholder="실행할 파이썬 코드">${esc(q.code || '')}</textarea>
      <label class="asmt-eq-lb">입력값(stdin) — input() 쓸 때만 (선택)</label>
      <input class="asmt-eq-stdin" data-action="asmt-edit-field" data-qid="${esc(q.id)}" data-field="stdin" value="${esc(q.stdin || '')}" placeholder="여러 개면 쉼표 또는 줄바꿈"/>
      <div class="asmt-eq-analyze">
        <button class="btn-sm" data-action="asmt-analyze" data-part="predict" data-qid="${esc(q.id)}" ${ASMT_ANALYZING ? 'disabled' : ''}>${ASMT_ANALYZING === q.id ? '⏳ 분석 중...' : '🪄 자동 분석 (정답 추출)'}</button>
        ${q.expected != null ? `<div class="asmt-eq-expected"><b>예상 출력(정답):</b><pre>${esc(q.expected) || '(빈 출력)'}</pre></div>` : '<span class="asmt-eq-warn">⚠️ 자동 분석을 눌러 정답을 추출하세요.</span>'}
      </div>
    </div>`).join('');
}

function _vTcEditTrace(edit){
  const list = _asmtPartList(edit, 'trace');
  if(!list.length) return emptyBox('🔍', '아직 문제가 없어요. 아래 "+ 문제 추가"로 등록하세요.');
  return list.map((q, i) => {
    const vars = q.vars || {};
    const varHtml = Object.keys(vars).length
      ? `<div class="asmt-eq-expected"><b>최종 변수 값(정답):</b>${Object.keys(vars).map(k => `<div class="asmt-trace-ans"><code>${esc(k)}</code> = <code>${esc(vars[k])}</code></div>`).join('')}</div>`
      : '<span class="asmt-eq-warn">⚠️ 자동 분석을 눌러 변수와 최종 값을 추출하세요.</span>';
    return `
    <div class="asmt-eq" data-qid="${esc(q.id)}">
      <div class="asmt-eq-head"><b>변수추적 ${i+1}</b>
        <button class="btn-xs danger" data-action="asmt-del-q" data-part="trace" data-qid="${esc(q.id)}">🗑 삭제</button></div>
      <label class="asmt-eq-lb">코드</label>
      <textarea class="asmt-eq-code" data-action="asmt-edit-field" data-qid="${esc(q.id)}" data-field="code" spellcheck="false" placeholder="실행할 파이썬 코드">${esc(q.code || '')}</textarea>
      <label class="asmt-eq-lb">입력값(stdin) — 선택</label>
      <input class="asmt-eq-stdin" data-action="asmt-edit-field" data-qid="${esc(q.id)}" data-field="stdin" value="${esc(q.stdin || '')}" placeholder="여러 개면 쉼표 또는 줄바꿈"/>
      <div class="asmt-eq-analyze">
        <button class="btn-sm" data-action="asmt-analyze" data-part="trace" data-qid="${esc(q.id)}" ${ASMT_ANALYZING ? 'disabled' : ''}>${ASMT_ANALYZING === q.id ? '⏳ 분석 중...' : '🪄 자동 분석 (변수 추출)'}</button>
        ${varHtml}
      </div>
    </div>`;
  }).join('');
}

function _vTcEditCloze(edit){
  const list = _asmtPartList(edit, 'cloze');
  if(!list.length) return emptyBox('🧩', '아직 문제가 없어요. 아래 "+ 문제 추가"로 등록하세요.');
  return list.map((q, i) => {
    const blankCount = (String(q.code || '').match(/___/g) || []).length;
    const ansCount = (q.blanks || []).length;
    const warn = blankCount !== ansCount ? `<span class="asmt-eq-warn">⚠️ 빈칸(___) ${blankCount}개 ≠ 정답 ${ansCount}개. 개수를 맞춰주세요.</span>` : `<span class="asmt-eq-ok">✓ 빈칸 ${blankCount}개 / 정답 ${ansCount}개</span>`;
    return `
    <div class="asmt-eq" data-qid="${esc(q.id)}">
      <div class="asmt-eq-head"><b>빈칸 ${i+1}</b>
        <button class="btn-xs danger" data-action="asmt-del-q" data-part="cloze" data-qid="${esc(q.id)}">🗑 삭제</button></div>
      <label class="asmt-eq-lb">코드 — 빈칸 자리에 <code>___</code> (밑줄 3개) 를 넣으세요</label>
      <textarea class="asmt-eq-code" data-action="asmt-edit-field" data-qid="${esc(q.id)}" data-field="code" spellcheck="false" placeholder="예: total = ___\nfor i in range(___):">${esc(q.code || '')}</textarea>
      <label class="asmt-eq-lb">정답 — 빈칸 순서대로 한 줄에 하나씩</label>
      <textarea class="asmt-eq-blanks" data-action="asmt-edit-blanks" data-qid="${esc(q.id)}" spellcheck="false" placeholder="0\n5">${esc((q.blanks || []).join('\n'))}</textarea>
      <label class="asmt-eq-lb">설명/안내 (선택)</label>
      <input class="asmt-eq-stdin" data-action="asmt-edit-field" data-qid="${esc(q.id)}" data-field="desc" value="${esc(q.desc || '')}" placeholder="학생에게 보일 안내"/>
      <div class="asmt-eq-analyze">${warn}</div>
    </div>`;
  }).join('');
}

function _vTcEditImplement(edit){
  const list = _asmtPartList(edit, 'implement');
  if(!list.length) return emptyBox('⌨️', '아직 문제가 없어요. 아래 "+ 문제 추가"로 등록하세요.');
  return list.map((q, i) => {
    const tests = q.tests || [];
    const testRows = tests.map((t, ti) => `
      <div class="asmt-etc" data-ti="${ti}">
        <div class="asmt-etc-h">테스트 ${ti+1}
          <label class="asmt-etc-hide"><input type="checkbox" data-action="asmt-tc-hidden" data-qid="${esc(q.id)}" data-ti="${ti}" ${t.hidden ? 'checked' : ''}/> 숨김</label>
          <button class="btn-xs danger" data-action="asmt-del-tc" data-qid="${esc(q.id)}" data-ti="${ti}">🗑</button>
        </div>
        <div class="asmt-etc-row">
          <div><label>입력</label><textarea class="asmt-etc-in" data-action="asmt-tc-field" data-qid="${esc(q.id)}" data-ti="${ti}" data-field="input" spellcheck="false">${esc(t.input || '')}</textarea></div>
          <div><label>기대 출력</label><textarea class="asmt-etc-out" data-action="asmt-tc-field" data-qid="${esc(q.id)}" data-ti="${ti}" data-field="expected" spellcheck="false">${esc(t.expected || '')}</textarea></div>
        </div>
      </div>`).join('');
    return `
    <div class="asmt-eq" data-qid="${esc(q.id)}">
      <div class="asmt-eq-head"><b>구현 ${i+1}</b>
        <button class="btn-xs danger" data-action="asmt-del-q" data-part="implement" data-qid="${esc(q.id)}">🗑 삭제</button></div>
      <label class="asmt-eq-lb">문제 제목</label>
      <input class="asmt-eq-stdin" data-action="asmt-edit-field" data-qid="${esc(q.id)}" data-field="title" value="${esc(q.title || '')}" placeholder="예: 평균 구하기"/>
      <label class="asmt-eq-lb">문제 설명 (마크다운)</label>
      <textarea class="asmt-eq-code" data-action="asmt-edit-field" data-qid="${esc(q.id)}" data-field="desc" spellcheck="false" placeholder="무엇을 입력받아 무엇을 출력하는지 설명">${esc(q.desc || '')}</textarea>
      <label class="asmt-eq-lb">시작 코드 (선택)</label>
      <textarea class="asmt-eq-code" data-action="asmt-edit-field" data-qid="${esc(q.id)}" data-field="starter" spellcheck="false" placeholder="학생 에디터 초기값">${esc(q.starter || '')}</textarea>
      <label class="asmt-eq-lb">테스트 케이스</label>
      <div class="asmt-etc-list">${testRows || '<i>테스트가 없습니다.</i>'}</div>
      <button class="btn-xs" data-action="asmt-add-tc" data-qid="${esc(q.id)}">+ 테스트 추가</button>
    </div>`;
  }).join('');
}

// ── 선생님: 학생 상세 + 채점 조정 ──
function vTcAsmtStudent(){
  const snum = ASMT_TC_SEL_SNUM;
  const st = STUDENTS.find(s => s.number === snum);
  const sub = ASMT_ALL_SUBS[snum] || null;
  const sc = ASMT_ALL_SCORES[snum] || null;
  if(!st) return emptyBox('❓', `학번 ${snum} 학생을 찾을 수 없어요.`);
  if(!sub || !sub.submittedAt) return `<div class="asmt-tcs-header"><button class="btn-sm" data-action="asmt-tc-back">← 학생 목록</button></div>` + emptyBox('📭', '아직 제출하지 않은 학생이에요.');

  const fin = _asmtFinalScore(sub, sc);
  const answers = sub.answers || {};
  const auto = sub.autoScore || {};

  const header = `
    <div class="asmt-tcs-header">
      <button class="btn-sm" data-action="asmt-tc-back">← 학생 목록</button>
      <div class="asmt-tcs-stu-info">
        <span class="asmt-tcs-snum">${esc(st.number)}</span>
        <span class="asmt-tcs-name">${esc(st.name)}</span>
        <span class="chip chip-green">✓ 제출 ${fmtDt(sub.submittedAt)}</span>
        <span class="asmt-score-chip">${_asmtRound(fin.total)}/${_asmtRound(fin.max)}</span>
      </div>
      <button class="btn-sm" onclick="window.print()" title="브라우저 인쇄 → PDF 저장">🖨️ 인쇄</button>
    </div>`;

  // 파트별 학생 답 + 정답
  const partSecs = ASMT_PARTS.filter(p => _asmtPartList(ASMT_EXAM, p.id).length).map(p => {
    const list = _asmtPartList(ASMT_EXAM, p.id);
    const a = answers[p.id] || {};
    const ac = auto[p.id];
    let inner = '';
    if(p.id === 'predict'){
      inner = list.map((q, i) => {
        const g = a[q.id] || '';
        const ok = _normalizeAns(g) && _normalizeAns(g) === _normalizeAns(q.expected);
        return `<div class="asmt-tcs-ans"><div class="asmt-tcs-ans-q">${i+1}. 출력예측 ${ok ? '<span class="chip chip-green">정답</span>' : '<span class="chip chip-orange">오답</span>'}</div>
          <pre class="asmt-tcs-code-pre">${_asmtCodeLines(q.code)}</pre>
          <div class="asmt-tcs-cmp"><div><b>학생 답</b><pre>${esc(g) || '(무응답)'}</pre></div><div><b>정답</b><pre>${esc(q.expected || '')}</pre></div></div>
        </div>`;
      }).join('');
    } else if(p.id === 'trace'){
      inner = list.map((q, i) => {
        const av = a[q.id] || {};
        const rows = Object.keys(q.vars || {}).map(k => {
          const ok = _matchTraceValue(av[k], q.vars[k]);
          return `<div class="asmt-trace-ans"><code>${esc(k)}</code> — 학생: <code>${esc(av[k] || '(무응답)')}</code> / 정답: <code>${esc(q.vars[k])}</code> ${ok ? '✅' : '❌'}</div>`;
        }).join('');
        return `<div class="asmt-tcs-ans"><div class="asmt-tcs-ans-q">${i+1}. 변수추적</div><pre class="asmt-tcs-code-pre">${_asmtCodeLines(q.code)}</pre>${rows}</div>`;
      }).join('');
    } else if(p.id === 'cloze'){
      inner = list.map((q, i) => {
        const av = a[q.id] || [];
        const rows = (q.blanks || []).map((b, bi) => {
          const ok = _matchClozeBlank(av[bi], b);
          return `<div class="asmt-trace-ans">빈칸 ${bi+1} — 학생: <code>${esc(av[bi] || '(무응답)')}</code> / 정답: <code>${esc(b)}</code> ${ok ? '✅' : '❌'}</div>`;
        }).join('');
        return `<div class="asmt-tcs-ans"><div class="asmt-tcs-ans-q">${i+1}. 빈칸</div><pre class="asmt-tcs-code-pre">${esc(q.code || '')}</pre>${rows}</div>`;
      }).join('');
    } else if(p.id === 'implement'){
      inner = list.map((q, i) => {
        const code = a[q.id] || '';
        return `<div class="asmt-tcs-ans"><div class="asmt-tcs-ans-q">${i+1}. ${esc(q.title || '구현')}</div><pre class="asmt-tcs-code-pre">${esc(code) || '(무응답)'}</pre></div>`;
      }).join('');
    }
    const acStr = ac ? `${ac.correct}/${ac.total} 항목` : '-';
    return `<section class="asmt-tcs-sec">
      <div class="asmt-tcs-sec-head">${p.icon} ${esc(p.label)} <span class="asmt-score-chip partial">${acStr}</span></div>
      ${inner}
    </section>`;
  }).join('');

  // 채점 조정 (5요소) — 자동값 프리필, 선생님이 수정 가능
  const rubricRows = ASMT_RUBRIC.map(r => {
    const cell = fin.five[r.id] || { score: 0, max: 0 };
    return `<tr>
      <td>${esc(r.label)}</td>
      <td><input type="number" class="asmt-sc-input" data-action="asmt-score-input" data-rid="${r.id}" min="0" max="${_asmtRound(cell.max)}" step="0.5" value="${_asmtRound(cell.score)}" ${cell.max ? '' : 'disabled'}/> <span class="asmt-sc-max">/ ${_asmtRound(cell.max)}</span></td>
    </tr>`;
  }).join('');

  const scoreSec = `
    <section class="asmt-tcs-sec asmt-tcs-score-sec">
      <div class="asmt-tcs-sec-head">⭐ 채점 (자동 환산값 — 필요시 조정) <span class="asmt-score-chip">${_asmtRound(fin.total)}/${_asmtRound(fin.max)}</span></div>
      <table class="asmt-tcs-score-table"><thead><tr><th>평가요소</th><th>점수</th></tr></thead><tbody>${rubricRows}</tbody></table>
      <div class="asmt-tcs-score-comment">
        <label>종합 코멘트 (선택 — 세특 작성 참고)</label>
        <textarea class="asmt-tcs-comment-area" data-action="asmt-score-comment" placeholder="학생의 강점·약점·지도 방향 등">${esc(sc?.comment || '')}</textarea>
      </div>
      <div class="asmt-tcs-score-actions">
        <button class="btn-p btn-sm" data-action="asmt-score-save">💾 점수 저장</button>
        <span class="asmt-tcs-score-meta">${sc?.scoredAt ? `마지막 저장: ${fmtDt(sc.scoredAt)}` : '아직 조정·저장 전 (자동 점수가 반영됩니다)'}</span>
      </div>
    </section>`;

  return `<div class="asmt-tcs-wrap">${header}${partSecs}${scoreSec}</div>`;
}
