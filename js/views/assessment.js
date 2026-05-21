/* ═══════════════════════════════════════
   views/assessment.js — 📝 수행평가 (PET병 챌린지 2단계)

   정의: assessment-data.js 의 ASMT_DEF
   - 1단계(A 서술6, B 자료형4) → "2단계로" 누르면 잠금(되돌아갈 수 없음)
   - 2단계(C 코드 빈칸 + ▶실행/🧪테스트, D 테스트케이스)
   - 채점: 선생님 수동(A5/B5/C12/D3=25). 테스트는 숫자만 관대 비교.
   이벤트/로직은 events/assessment.js.
═══════════════════════════════════════ */

// 문제 상황 (두 단계 모두 상단에 표시)
function _asmtSituation(){
  return `<div class="asmt-situation">
    <div class="asmt-sit-title">📦 문제 상황 · ${esc(ASMT_DEF.subtitle)}</div>
    <div class="asmt-sit-body">${esc(ASMT_DEF.situation)}</div>
    <ul class="asmt-sit-needs">${ASMT_DEF.resultNeeds.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    <div class="asmt-sit-body">${esc(ASMT_DEF.situationTail)}</div>
  </div>`;
}

// 파이썬 구문 강조 (고정 텍스트 토큰용 — 빈칸은 입력칸으로 따로 렌더)
const _ASMT_KW = new Set(['for','in','if','elif','else','while','def','return','and','or','not','True','False','None','break','continue','import','from','as','with','pass','is']);
const _ASMT_BI = new Set(['int','str','float','bool','print','input','range','sum','len','list','append','round','abs','min','max','sorted','map','sorted']);
function _asmtHighlight(src){
  let out = '', i = 0; const n = src.length;
  while(i < n){
    const ch = src[i];
    if(ch === '#'){ let j = i; while(j < n && src[j] !== '\n') j++; out += `<span class="tok-com">${esc(src.slice(i, j))}</span>`; i = j; continue; }
    if(ch === '"' || ch === "'"){ const q = ch; let j = i + 1; while(j < n && src[j] !== q){ if(src[j] === '\\') j++; j++; } j = Math.min(j + 1, n); out += `<span class="tok-str">${esc(src.slice(i, j))}</span>`; i = j; continue; }
    if(ch >= '0' && ch <= '9'){ let j = i; while(j < n && ((src[j] >= '0' && src[j] <= '9') || src[j] === '.')) j++; out += `<span class="tok-num">${esc(src.slice(i, j))}</span>`; i = j; continue; }
    if(/[A-Za-z_]/.test(ch)){ let j = i; while(j < n && /[A-Za-z0-9_]/.test(src[j])) j++; const w = src.slice(i, j); const cls = _ASMT_KW.has(w) ? 'tok-kw' : (_ASMT_BI.has(w) ? 'tok-bi' : ''); out += cls ? `<span class="${cls}">${esc(w)}</span>` : esc(w); i = j; continue; }
    out += esc(ch); i++;
  }
  return out;
}

// 코드 + 인라인 빈칸 렌더 (학생 작성용)
function _asmtRenderCodeEditable(){
  const c = ASMT_DEF.stage2.c;
  let html = '';
  for(const tok of c.tokens){
    if(tok.t != null){ html += _asmtHighlight(tok.t); continue; }
    const b = c.blanks.find(x => x.id === tok.b);
    const st = ASMT_ANS.blanks[b.id] || {};
    if(st.gaveUp){
      html += `<span class="asmt-blank gaveup"><span class="asmt-blank-hidden">모름 처리됨</span>` +
        `<button class="asmt-blank-x on" data-action="asmt-blank-x" data-bid="${esc(b.id)}" title="다시 직접 풀기">↩ 되돌리기</button></span>`;
    } else {
      html += `<span class="asmt-blank"><input class="asmt-blank-in" data-action="asmt-blank-in" data-bid="${esc(b.id)}" value="${esc(st.v || '')}" size="${b.size}" spellcheck="false" autocomplete="off" placeholder="빈칸"/>` +
        `<button class="asmt-blank-x" data-action="asmt-blank-x" data-bid="${esc(b.id)}" title="모르면 누르세요 — 정답이 자동으로 채워져 실행할 수 있어요">모름</button></span>`;
    }
  }
  return `<pre class="asmt-code">${html}</pre>`;
}

// ══════════════════════════════════════
//  학생 뷰
// ══════════════════════════════════════

function vStAssessment(){
  if(!ASMT_ACTIVE[SEL_CLS?.id] || ASMT_VIEW === 'closed')
    return emptyBox('🔒', '수행평가가 아직 시작되지 않았어요. 선생님 안내를 기다려주세요.');
  if(ASMT_VIEW === 'done') return _vStAsmtDone();
  return ASMT_STAGE === 2 ? _vStAsmtStage2() : _vStAsmtStage1();
}

function _asmtExamHeader(stageLabel){
  return `<div class="asmt-exam-bar">
    <div class="asmt-exam-title">📝 ${esc(ASMT_DEF.title)}</div>
    <div class="asmt-stage-chips">
      <span class="asmt-stage-chip ${ASMT_STAGE === 1 ? 'on' : 'done'}">1단계 · 분석/자료형</span>
      <span class="asmt-stage-arrow">→</span>
      <span class="asmt-stage-chip ${ASMT_STAGE === 2 ? 'on' : ''}">2단계 · 구현/테스트</span>
    </div>
  </div>`;
}

// ── 1단계: A 서술 + B 자료형 ──
function _vStAsmtStage1(){
  const a = ASMT_DEF.stage1.a, b = ASMT_DEF.stage1.b;
  const aVal = Array.isArray(ASMT_ANS.a) ? ASMT_ANS.a.filter(Boolean).join('\n') : (ASMT_ANS.a || '');
  const aBox = `<textarea class="asmt-a-input asmt-a-big" data-action="asmt-a" rows="8" spellcheck="false" placeholder="문제 해결 절차를 자유롭게 적어보세요. (단계별로 한 줄씩 적어도 좋아요)">${esc(aVal)}</textarea>`;

  const bRows = b.fields.map(f => `
    <div class="asmt-b-row">
      <label class="asmt-b-label">${esc(f.label)}</label>
      <input class="asmt-b-input" data-action="asmt-b" data-bid="${esc(f.id)}" value="${esc((ASMT_ANS.b || {})[f.id] || '')}" spellcheck="false" autocomplete="off" placeholder="예: 정수, 리스트 ..."/>
    </div>`).join('');

  return `<div class="asmt-exam-wrap">
    ${_asmtExamHeader()}
    ${_asmtSituation()}

    <section class="asmt-part">
      <div class="asmt-part-head"><b>${esc(a.title)}</b> <span class="asmt-pt">${a.points}점</span></div>
      <div class="asmt-part-desc">${esc(a.desc)}</div>
      ${aBox}
      <div class="asmt-guide">💡 이 질문들을 생각해보세요.
        <ul>${a.guide.map(g => `<li>${esc(g)}</li>`).join('')}</ul>
      </div>
    </section>

    <section class="asmt-part">
      <div class="asmt-part-head"><b>${esc(b.title)}</b> <span class="asmt-pt">${b.points}점</span></div>
      <div class="asmt-part-desc">${esc(b.desc)}</div>
      <div class="asmt-b-list">${bRows}</div>
    </section>

    <div class="asmt-stage-foot">
      <div class="asmt-stage-warn">⚠️ <b>2단계로 넘어가면 1단계로 되돌아올 수 없어요.</b> 1단계 답을 다 확인했으면 넘어가세요.</div>
      <button class="btn-p" data-action="asmt-to-stage2">2단계로 넘어가기 →</button>
    </div>
  </div>`;
}

// ── 2단계: C 코드 빈칸 + D 테스트 ──
function _vStAsmtStage2(){
  const c = ASMT_DEF.stage2.c, d = ASMT_DEF.stage2.d;

  // 실행 결과
  let runBlock = '';
  if(ASMT_RUNNING === 'run'){
    runBlock = `<div class="asmt-run-loading">⏳ 실행 중... (첫 실행은 10~15초 걸려요)</div>`;
  } else if(ASMT_RUN){
    runBlock = `<div class="asmt-run-result ${ASMT_RUN.success ? 'ok' : 'err'}">
      <div class="asmt-run-head">${ASMT_RUN.success ? '✅ 실행 결과' : '⚠️ 실행 오류'}</div>
      ${ASMT_RUN.output ? `<pre class="asmt-run-out">${esc(ASMT_RUN.output)}</pre>` : ''}
      ${ASMT_RUN.error ? `<pre class="asmt-run-err">${esc(ASMT_RUN.error)}</pre>` : ''}
    </div>`;
  }

  // 테스트 결과
  let testBlock = '';
  if(ASMT_RUNNING === 'test'){
    testBlock = `<div class="asmt-run-loading">⏳ ${d.tests.length}개 테스트케이스 실행 중...</div>`;
  } else if(ASMT_TEST){
    const passCount = ASMT_TEST.filter(t => t.pass).length;
    testBlock = `<div class="asmt-test-summary ${passCount === ASMT_TEST.length ? 'ok' : ''}">테스트 통과 ${passCount} / ${ASMT_TEST.length}</div>
      <div class="asmt-test-list">${ASMT_TEST.map((t, i) => `
        <div class="asmt-test-item ${t.pass ? 'ok' : 'err'}">
          <div class="asmt-test-h">${t.pass ? '✅' : '❌'} 테스트 ${i+1}</div>
          <div class="asmt-test-row"><span>입력</span><pre>${esc(t.input.replace(/\n/g, ' '))}</pre></div>
          <div class="asmt-test-row"><span>기대</span><pre>${esc(t.expected)}</pre></div>
          <div class="asmt-test-row"><span>내 출력</span><pre>${esc(t.error ? ('오류: ' + t.error) : (t.output || '(출력 없음)'))}</pre></div>
        </div>`).join('')}</div>`;
  }

  return `<div class="asmt-exam-wrap">
    ${_asmtExamHeader()}
    ${_asmtSituation()}

    <div class="asmt-locked-note">🔒 1단계(분석·자료형)는 제출되어 수정할 수 없어요.</div>

    <section class="asmt-part">
      <div class="asmt-part-head"><b>${esc(c.title)}</b> <span class="asmt-pt">${c.points}점</span></div>
      <div class="asmt-part-desc">${esc(c.desc)}</div>
      ${_asmtRenderCodeEditable()}

      <div class="asmt-run-area">
        <label class="asmt-run-label">▶ 직접 실행해보기 — 5명의 수거량을 입력하세요 (띄어쓰기 또는 줄바꿈)</label>
        <div class="asmt-run-row">
          <input class="asmt-stdin" data-action="asmt-stdin" value="${esc(ASMT_STDIN)}" placeholder="예: 10 30 40 50 20" autocomplete="off"/>
          <button class="btn-sm" data-action="asmt-run" ${ASMT_RUNNING ? 'disabled' : ''}>▶ 실행</button>
        </div>
        ${runBlock}
      </div>
    </section>

    <section class="asmt-part">
      <div class="asmt-part-head"><b>${esc(d.title)}</b> <span class="asmt-pt">${d.points}점</span></div>
      <div class="asmt-part-desc">아래 버튼을 누르면 모든 테스트케이스가 자동으로 입력되어 채점돼요. 어떤 케이스에서 틀렸는지 확인하고 빈칸을 고쳐보세요.</div>
      <table class="asmt-d-table">
        <thead><tr><th>입력값</th><th>기대 출력</th></tr></thead>
        <tbody>${d.tests.map(t => `<tr><td>${esc(t.input.replace(/\n/g, ' '))}</td><td>${esc(t.expected)}</td></tr>`).join('')}</tbody>
      </table>
      <button class="btn-p btn-sm" data-action="asmt-test" ${ASMT_RUNNING ? 'disabled' : ''}>🧪 테스트 실행</button>
      ${testBlock}
    </section>

    <div class="asmt-stage-foot">
      <div class="asmt-stage-warn">제출 후에는 수정할 수 없어요. 다 풀었으면 제출하세요.</div>
      <button class="btn-p" data-action="asmt-submit" ${ASMT_RUNNING ? 'disabled' : ''}>제출하기</button>
    </div>
  </div>`;
}

function _vStAsmtDone(){
  const t = ASMT_SUB?.submittedAt ? fmtDt(ASMT_SUB.submittedAt) : '';
  return `<div class="asmt-done-wrap">
    <div class="asmt-done-card">
      <div class="asmt-done-icon">🎉</div>
      <div class="asmt-done-title">수행평가 제출 완료!</div>
      <div class="asmt-done-sub">수고했어요. 제출이 정상적으로 저장됐어요.<br>선생님이 확인한 뒤 점수를 알려주실 거예요.</div>
      ${t ? `<div class="asmt-done-time">제출 시각: ${t}</div>` : ''}
    </div>
    <div class="asmt-done-note">💡 제출 후에는 수정할 수 없어요.</div>
  </div>`;
}

// ══════════════════════════════════════
//  선생님 뷰
// ══════════════════════════════════════

function _asmtScoreTotal(sc){
  if(!sc) return null;
  let total = 0, any = false;
  for(const r of ASMT_RUBRIC){
    if(typeof sc[r.id] === 'number'){ total += sc[r.id]; any = true; }
  }
  return any ? total : null;
}
function _asmtMaxTotal(){ return ASMT_RUBRIC.reduce((s, r) => s + r.max, 0); }
function _asmtRound(x){ return Math.round((Number(x) || 0) * 10) / 10; }

function vTcAssessment(){
  if(!TC_CLS) return emptyBox('👆', '관리할 반을 먼저 선택하세요.');
  if(ASMT_TC_VIEW === 'student' && ASMT_TC_SEL_SNUM) return _vTcAsmtStudent();
  return _vTcAsmtManage();
}

function _vTcAsmtManage(){
  const active = !!ASMT_ACTIVE[TC_CLS.id];
  const subs = ASMT_ALL_SUBS || {};
  const scores = ASMT_ALL_SCORES || {};
  const maxT = _asmtMaxTotal();

  const toggle = `<div class="asmt-phase-seg">
    <button class="asmt-phase-btn ${!active ? 'on' : ''}" data-action="asmt-set-active" data-on="0">🔒 닫기</button>
    <button class="asmt-phase-btn ${active ? 'on prep' : ''}" data-action="asmt-set-active" data-on="1">📝 시험 시작</button>
  </div>`;

  const stuRows = STUDENTS.map(st => {
    const sub = subs[st.number] || null;
    const sc = scores[st.number] || null;
    const submitted = !!(sub && sub.submittedAt);
    let stageLbl = '<span style="color:var(--text3)">미응시</span>';
    if(submitted) stageLbl = '✅ 제출';
    else if(sub && sub.stage === 2) stageLbl = '✏️ 2단계 진행';
    else if(sub) stageLbl = '✏️ 1단계 진행';
    const total = _asmtScoreTotal(sc);
    const scoreCell = total != null
      ? `<span class="asmt-score-chip">${_asmtRound(total)}/${maxT}</span>`
      : (submitted ? '<span class="asmt-score-chip partial">미채점</span>' : '<span class="asmt-score-chip none">-</span>');
    return `<tr>
      <td>${esc(st.number)}</td>
      <td>${esc(st.name)}</td>
      <td>${stageLbl}</td>
      <td>${submitted ? fmtDt(sub.submittedAt) : '-'}</td>
      <td>${scoreCell}</td>
      <td><button class="btn-xs" data-action="asmt-tc-view" data-snum="${esc(st.number)}" ${sub ? '' : 'disabled'}>보기</button></td>
    </tr>`;
  }).join('');

  const submittedCount = STUDENTS.filter(st => subs[st.number]?.submittedAt).length;

  return `
    <div class="asmt-phase-row">
      <div class="asmt-phase-info">
        <div class="asmt-phase-title">📝 ${esc(ASMT_DEF.title)} <span style="font-weight:500;color:var(--text2)">· ${esc(ASMT_DEF.subtitle)}</span></div>
        <div class="asmt-phase-cur">${active
          ? '<b style="color:var(--ok)">● 시험 진행 중</b> — 학생 화면에 "📝 수행평가" 탭이 보이고 응시할 수 있어요.'
          : '<b style="color:var(--text3)">● 닫힘</b> — 학생 화면에 보이지 않습니다. (제출·점수는 보존)'}</div>
      </div>
      ${toggle}
    </div>

    <div class="asmt-tc-help">
      <b>📖 안내</b>
      <ul>
        <li>이 수행평가는 <b>2단계</b>예요. 1단계(분석·자료형 서술) → 2단계(코드 빈칸·테스트). 학생이 2단계로 넘어가면 1단계로 못 돌아가요.</li>
        <li>채점은 <b>선생님이 직접</b> 합니다(A 5 / B 5 / C 12 / D 3 = ${maxT}점). 학생 답·테스트 결과는 "보기"에서 확인하세요.</li>
        <li>문제를 바꾸려면 <code>js/assessment-data.js</code> 의 정의를 수정하면 됩니다.</li>
      </ul>
    </div>

    <div class="asmt-stat-grid">
      <div class="stat-card"><div class="stat-num">${STUDENTS.length}</div><div class="stat-label">전체 학생</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--ok)">${submittedCount}</div><div class="stat-label">제출 완료</div></div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-top:14px">
      <div class="sec-title" style="margin:0">학생별 제출·점수</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="btn-sm" data-action="asmt-export-answers" title="학생 답안 전체를 텍스트로 내보내기">📝 답안 내보내기</button>
        <button class="btn-sm" data-action="asmt-export-csv" title="점수를 CSV로 내보내기 (NEIS 활용)">📤 점수 CSV</button>
      </div>
    </div>

    ${STUDENTS.length === 0
      ? emptyBox('👥', '먼저 학생을 등록하세요.')
      : `<div style="overflow-x:auto"><table class="tbl asmt-tc-table">
          <thead><tr><th>학번</th><th>이름</th><th>진행</th><th>제출시각</th><th>점수</th><th></th></tr></thead>
          <tbody>${stuRows}</tbody>
        </table></div>`
    }
  `;
}

function _vTcAsmtStudent(){
  const snum = ASMT_TC_SEL_SNUM;
  const st = STUDENTS.find(s => s.number === snum);
  const sub = ASMT_ALL_SUBS[snum] || null;
  const sc = ASMT_ALL_SCORES[snum] || null;
  if(!st) return emptyBox('❓', `학번 ${snum} 학생을 찾을 수 없어요.`);
  const back = `<div class="asmt-tcs-header"><button class="btn-sm" data-action="asmt-tc-back">← 학생 목록</button></div>`;
  if(!sub) return back + emptyBox('📭', '아직 응시하지 않은 학생이에요.');

  const a = ASMT_DEF.stage1.a, b = ASMT_DEF.stage1.b, c = ASMT_DEF.stage2.c;
  const subB = sub.b || {}, subBlanks = sub.blanks || {};
  const subAText = Array.isArray(sub.a) ? sub.a.filter(Boolean).join('\n') : (sub.a || '');

  // A 답 (자유 서술)
  const aHtml = `<div class="asmt-tcs-ans"><pre>${esc(subAText) || '(무응답)'}</pre></div>`;
  // B 답
  const bHtml = b.fields.map(f =>
    `<div class="asmt-tcs-ans"><b>${esc(f.label)}</b><pre>${esc(subB[f.id] || '(무응답)')}</pre></div>`).join('');

  // C 빈칸 — 학생 답 vs 정답
  let cHtml = '';
  if(sub.stage === 2 || sub.submittedAt){
    const rows = c.blanks.map(bl => {
      const stt = subBlanks[bl.id] || {};
      const val = stt.gaveUp ? '(모름 처리)' : (stt.v || '(무응답)');
      const ok = !stt.gaveUp && _asmtNormCode(stt.v) === _asmtNormCode(bl.answer);
      const mark = stt.gaveUp ? '<span class="asmt-mk gave">모름</span>' : (ok ? '<span class="asmt-mk ok">정답</span>' : '<span class="asmt-mk no">불일치</span>');
      return `<tr><td><code>${esc(bl.id)}</code></td><td><code>${esc(val)}</code></td><td><code>${esc(bl.answer)}</code></td><td>${mark}</td></tr>`;
    }).join('');
    const correct = c.blanks.filter(bl => { const stt = subBlanks[bl.id] || {}; return !stt.gaveUp && _asmtNormCode(stt.v) === _asmtNormCode(bl.answer); }).length;
    const gave = c.blanks.filter(bl => (subBlanks[bl.id] || {}).gaveUp).length;
    cHtml = `<div class="asmt-tcs-cnote">정답 일치 ${correct} / ${c.blanks.length} · 모름 처리 ${gave}개</div>
      <table class="asmt-tcs-blank-table"><thead><tr><th>빈칸</th><th>학생 답</th><th>정답</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <div class="asmt-tcs-testrun">
        <button class="btn-sm" data-action="asmt-tc-runtest" ${ASMT_RUNNING ? 'disabled' : ''}>🧪 이 학생 코드로 테스트 실행</button>
        ${_vTcAsmtTestResult()}
      </div>`;
  } else {
    cHtml = `<div class="asmt-tcs-cnote">아직 2단계(코드)에 진입하지 않았어요.</div>`;
  }

  // 채점
  const rubricRows = ASMT_RUBRIC.map(r => {
    const v = sc && typeof sc[r.id] === 'number' ? sc[r.id] : '';
    return `<tr>
      <td>${esc(r.label)}</td>
      <td><input type="number" class="asmt-sc-input" data-rid="${r.id}" min="0" max="${r.max}" step="0.5" value="${v}"/> <span class="asmt-sc-max">/ ${r.max}</span></td>
    </tr>`;
  }).join('');
  const total = _asmtScoreTotal(sc);

  return `<div class="asmt-tcs-wrap">
    <div class="asmt-tcs-header">
      <button class="btn-sm" data-action="asmt-tc-back">← 학생 목록</button>
      <div class="asmt-tcs-stu-info">
        <span class="asmt-tcs-snum">${esc(st.number)}</span>
        <span class="asmt-tcs-name">${esc(st.name)}</span>
        ${sub.submittedAt ? `<span class="chip chip-green">✓ 제출 ${fmtDt(sub.submittedAt)}</span>` : '<span class="chip">진행 중</span>'}
        ${total != null ? `<span class="asmt-score-chip">${_asmtRound(total)}/${_asmtMaxTotal()}</span>` : ''}
      </div>
      <button class="btn-sm" onclick="window.print()" title="브라우저 인쇄 → PDF 저장">🖨️ 인쇄</button>
    </div>

    <section class="asmt-tcs-sec"><div class="asmt-tcs-sec-head">${esc(a.title)}</div>${aHtml}</section>
    <section class="asmt-tcs-sec"><div class="asmt-tcs-sec-head">${esc(b.title)}</div>${bHtml}</section>
    <section class="asmt-tcs-sec"><div class="asmt-tcs-sec-head">${esc(c.title)}</div>${cHtml}</section>

    <section class="asmt-tcs-sec asmt-tcs-score-sec">
      <div class="asmt-tcs-sec-head">⭐ 채점 (선생님 직접 입력)</div>
      <table class="asmt-tcs-score-table"><thead><tr><th>평가요소</th><th>점수</th></tr></thead><tbody>${rubricRows}</tbody></table>
      <div class="asmt-tcs-score-comment">
        <label>종합 코멘트 (선택 — 세특 작성 참고)</label>
        <textarea class="asmt-tcs-comment-area" placeholder="학생의 강점·약점·지도 방향 등">${esc(sc?.comment || '')}</textarea>
      </div>
      <div class="asmt-tcs-score-actions">
        <button class="btn-p btn-sm" data-action="asmt-score-save">💾 점수 저장</button>
        <span class="asmt-tcs-score-meta">${sc?.scoredAt ? `마지막 저장: ${fmtDt(sc.scoredAt)}` : '아직 채점 전'}</span>
      </div>
    </section>
  </div>`;
}

// 선생님: 학생 코드 테스트 실행 결과 (ASMT_TC_TEST)
function _vTcAsmtTestResult(){
  if(ASMT_RUNNING === 'tctest') return `<div class="asmt-run-loading">⏳ 실행 중...</div>`;
  if(!ASMT_TC_TEST) return '';
  const passCount = ASMT_TC_TEST.filter(t => t.pass).length;
  return `<div class="asmt-test-summary ${passCount === ASMT_TC_TEST.length ? 'ok' : ''}">테스트 통과 ${passCount} / ${ASMT_TC_TEST.length}</div>
    <div class="asmt-test-list">${ASMT_TC_TEST.map((t, i) => `
      <div class="asmt-test-item ${t.pass ? 'ok' : 'err'}">
        <div class="asmt-test-h">${t.pass ? '✅' : '❌'} 테스트 ${i+1}</div>
        <div class="asmt-test-row"><span>입력</span><pre>${esc(t.input.replace(/\n/g, ' '))}</pre></div>
        <div class="asmt-test-row"><span>기대</span><pre>${esc(t.expected)}</pre></div>
        <div class="asmt-test-row"><span>출력</span><pre>${esc(t.error ? ('오류: ' + t.error) : (t.output || '(출력 없음)'))}</pre></div>
      </div>`).join('')}</div>`;
}
