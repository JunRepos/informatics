/* ═══════════════════════════════════════
   views/coderead.js — 코드 읽기 (Code Reading) 뷰

   학생이 코드를 읽고 해석하는 메뉴.
   - 출력 예측 (predict): 코드 보고 stdout 결과 맞히기
   - 변수 추적 (trace):  단계별로 변수 값 맞히기

   선생님은 코드 한 덩어리만 등록하면 Pyodide가 자동 분석으로
   정답·트레이스를 추출해준다.
═══════════════════════════════════════ */

// ══════════════════════════════════════
//  학생 뷰
// ══════════════════════════════════════

function vStCodeRead(){
  if(CR_VIEW === 'solve' && CR_SEL) return vStCRSolve();
  return vStCRList();
}

function vStCRList(){
  if(!CR_READINGS.length){
    return emptyBox('🔍','등록된 코드 읽기 문제가 없습니다.');
  }
  const myProg = CR_PROGRESS || {};
  const rows = CR_READINGS.map(r => {
    const p = myProg[r.id]?.[ST_USER?.number] || null;
    const passed = p && p.passed;
    const typeLabel = r.type === 'predict' ? '🔮 출력 예측' : '🔍 변수 추적';
    return `<div class="list-row click" data-action="cr-pick" data-rid="${r.id}">
      <div class="row-icon">🔍</div>
      <div class="row-info">
        <div class="row-title">${esc(r.title)}</div>
        <div class="row-meta">${typeLabel}${r.description ? ' · ' + esc((r.description||'').slice(0, 60)) : ''}</div>
      </div>
      <div class="row-right">
        ${passed
          ? `<span class="chip chip-green">✓ 통과</span>`
          : p && p.attempts ? `<span class="chip chip-orange">${p.attempts}회 시도</span>`
          : `<span class="chip chip-gray">미해결</span>`}
      </div>
    </div>`;
  }).join('');
  const passed = Object.values(myProg).filter(o => (o[ST_USER?.number]||{}).passed).length;
  const total = CR_READINGS.length;
  return `
    <div class="cr-stats">
      <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">전체 문제</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--ok)">${passed}</div><div class="stat-label">통과</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--danger)">${total - passed}</div><div class="stat-label">남은 문제</div></div>
    </div>
    <div class="sec-title" style="margin-top:4px">📚 코드 읽기 문제 (${total}개)</div>
    ${rows}
  `;
}

function vStCRSolve(){
  const r = CR_SEL;
  if(!r) return vStCRList();
  const isPredict = r.type === 'predict';
  const isTrace   = r.type === 'trace';
  const myProg = CR_PROGRESS[r.id]?.[ST_USER?.number] || null;
  const isPassed = myProg && myProg.passed;

  // 코드 좌측 (줄번호 포함, 읽기 전용)
  const codeLines = (r.code || '').split('\n');
  const codeHtml = codeLines.map((ln, i) =>
    `<div class="cr-code-line"><span class="cr-line-no">${i+1}</span><span class="cr-line-src">${esc(ln) || ' '}</span></div>`
  ).join('');

  // 우측 문제
  let questionHtml = '';
  if(isPredict){
    // input() 이 들어간 코드는 stdin 을 학생에게 보여줘야 출력 예측 가능
    const stdinBlock = (r.stdin && r.stdin.trim())
      ? `<div class="cr-stdin-block">
           <div class="cr-stdin-label">📥 사용자가 입력한 값 (이 값으로 코드가 실행돼요)</div>
           <pre class="cr-stdin-pre">${esc(r.stdin)}</pre>
         </div>`
      : '';
    questionHtml = `
      <div class="cr-q-title">🔮 이 코드의 출력은 무엇일까요?</div>
      <div class="cr-q-desc">코드를 머릿속으로 한 줄씩 따라가며, <code>print()</code>로 찍히는 결과를 예측해 입력하세요.</div>
      ${stdinBlock}
      <div class="cr-q-form">
        <textarea id="cr-answer" class="cr-answer-box" placeholder="출력 결과를 그대로 입력하세요&#10;(여러 줄이면 줄바꿈도 똑같이)" autocomplete="off">${esc(CR_ANSWER || '')}</textarea>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn-p" data-action="cr-submit-predict">제출</button>
          ${myProg && !isPassed ? `<button class="btn-sm" data-action="cr-show-hint">💡 힌트 보기</button>` : ''}
          <button class="btn-sm" data-action="cr-back">← 목록</button>
        </div>
      </div>
      ${renderCRResult()}
    `;
  } else if(isTrace){
    const traces = r.traces || [];
    if(!traces.length){
      questionHtml = `<div class="cr-q-title">⚠️ 트레이스 데이터가 없습니다</div><div><button class="btn-sm" data-action="cr-back">← 목록</button></div>`;
    } else {
      const idx = Math.min(CR_STEP_IDX || 0, traces.length - 1);
      const cur = traces[idx];
      questionHtml = `
        <div class="cr-step-bar">
          <span>단계 <b>${idx+1}</b> / ${traces.length}</span>
          <div class="cr-step-dots">
            ${traces.map((_, i) => `<span class="cr-dot${i === idx ? ' active' : ''}${i < idx ? ' done' : ''}"></span>`).join('')}
          </div>
        </div>
        <div class="cr-q-title">🔍 ${cur.line}번 줄 실행 직후, <code>${esc(cur.askVar)}</code> 변수의 값은?</div>
        <div class="cr-q-desc">코드를 처음부터 ${cur.line}번 줄까지 차근차근 따라가 보세요.</div>
        <div class="cr-q-form">
          <input id="cr-answer" type="text" class="cr-answer-input" placeholder="${esc(cur.askVar)} 의 값 (예: 5, 'hello', [1,2,3])" autocomplete="off" value="${esc(CR_ANSWER || '')}"/>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn-p" data-action="cr-submit-trace">제출</button>
            ${idx > 0 ? `<button class="btn-sm" data-action="cr-trace-prev">◀ 이전 단계</button>` : ''}
            <button class="btn-sm" data-action="cr-back">← 목록</button>
          </div>
          <div class="cr-hint-row">
            💡 정답은 파이썬의 <code>repr()</code> 형식이에요. 문자열은 따옴표 포함, 리스트는 <code>[1, 2]</code> 형식.
          </div>
        </div>
        ${renderCRResult()}
      `;
    }
  }

  return `
    <div class="cr-solve-bar">
      <div>
        <span class="cr-type-chip cr-type-${r.type}">${isPredict ? '🔮 출력 예측' : '🔍 변수 추적'}</span>
        <span style="font-weight:700;font-size:14px;margin-left:6px">${esc(r.title)}</span>
      </div>
      <div>
        ${isPassed ? `<span class="chip chip-green">✓ 통과 완료</span>` : ''}
        <button class="btn-sm" data-action="cr-back">← 목록</button>
      </div>
    </div>
    ${r.description ? `<div class="cr-desc-box">${esc(r.description)}</div>` : ''}
    <div class="cr-split">
      <div class="cr-code-pane">
        <div class="cr-pane-title">📄 코드</div>
        <pre class="cr-code-box">${codeHtml}</pre>
      </div>
      <div class="cr-q-pane">${questionHtml}</div>
    </div>
  `;
}

function renderCRResult(){
  const res = CR_LAST_RESULT;
  if(!res) return '';
  if(res.pass){
    return `<div class="cr-result cr-result-pass">
      <div class="cr-result-title">🎉 정답입니다!</div>
      <div class="cr-result-body">${esc(res.msg || '잘 따라가셨네요!')}</div>
    </div>`;
  }
  return `<div class="cr-result cr-result-fail">
    <div class="cr-result-title">❌ 다시 한 번 확인해 보세요</div>
    <div class="cr-result-body">
      ${res.msg ? `<div>${esc(res.msg)}</div>` : ''}
      ${res.given !== undefined ? `<div style="margin-top:6px"><b>입력한 답:</b> <code>${esc(res.given)}</code></div>` : ''}
      ${res.showAnswer && res.expected !== undefined ? `<div><b>정답:</b> <code>${esc(res.expected)}</code></div>` : ''}
    </div>
  </div>`;
}

// ══════════════════════════════════════
//  선생님 뷰
// ══════════════════════════════════════

function vTcCodeRead(){
  if(CR_VIEW === 'edit') return vTcCREdit();
  return vTcCRList();
}

function vTcCRList(){
  // 묶음별 등록 카드 — 차시 추가될수록 카드만 늘어남
  const packCards = (typeof CR_SAMPLE_PACKS !== 'undefined' ? CR_SAMPLE_PACKS : []).map(p => `
    <button class="cr-pack-card" data-action="cr-load-pack" data-pack-id="${esc(p.id)}">
      <div class="cr-pack-icon">${p.icon || '📦'}</div>
      <div class="cr-pack-body">
        <div class="cr-pack-title">${esc(p.title)}</div>
        <div class="cr-pack-meta">${p.samples.length}문제 · ${esc(p.description)}</div>
      </div>
      <div class="cr-pack-arrow">＋</div>
    </button>
  `).join('');

  const header = `<div class="cr-header-row">
    <div style="font-size:13px;color:var(--text2);flex:1;min-width:240px">
      학생들이 코드를 읽고 결과를 예측하거나 변수 값을 추적하게 만드는 문제예요.
      코드만 등록하면 정답은 자동으로 분석됩니다.
    </div>
    <button class="btn-p" data-action="cr-new">+ 새 문제 만들기</button>
  </div>`;

  const packsSection = packCards ? `
    <div class="cr-pack-section">
      <div class="cr-pack-section-title">📦 예제 묶음 한방 등록 <span style="font-weight:400;color:var(--text3);font-size:11px">— 카드를 클릭하면 해당 차시 문제가 모두 등록됩니다</span></div>
      <div class="cr-pack-grid">${packCards}</div>
    </div>` : '';

  if(!CR_READINGS.length){
    return header + packsSection + emptyBox('🔍','아직 등록된 코드 읽기 문제가 없습니다.');
  }

  const rows = CR_READINGS.map((r, i) => {
    const allProg = CR_PROGRESS[r.id] || {};
    const passedCount = Object.values(allProg).filter(p => p && p.passed).length;
    const totalSt = STUDENTS.length || 0;
    const typeLabel = r.type === 'predict' ? '🔮 출력 예측' : '🔍 변수 추적';
    const stepCount = r.type === 'trace' ? (r.traces || []).length : 1;
    return `<div class="list-row">
      <div class="row-icon">${i + 1}</div>
      <div class="row-info">
        <div class="row-title">${esc(r.title)}</div>
        <div class="row-meta">${typeLabel} · ${stepCount}단계 · ${passedCount}/${totalSt}명 통과 · ${fmtDt(r.createdAt)}</div>
      </div>
      <div class="row-right">
        <button class="btn-xs" data-action="cr-move-up" data-rid="${r.id}" title="위로">▲</button>
        <button class="btn-xs" data-action="cr-move-down" data-rid="${r.id}" title="아래로">▼</button>
        <button class="btn-xs" data-action="cr-edit" data-rid="${r.id}">✏️</button>
        <button class="btn-xs btn-danger" data-action="cr-del" data-rid="${r.id}" data-rtitle="${esc(r.title)}">삭제</button>
      </div>
    </div>`;
  }).join('');

  return header + packsSection + `<div class="sec-title" style="margin-top:4px">등록된 문제 (${CR_READINGS.length}개)</div>` + rows;
}

function vTcCREdit(){
  const r = CR_EDITING || {};
  const isEdit = !!r.id;
  const type = r.type || 'predict';
  const code = r.code || '';
  const stdin = r.stdin || '';

  return `<div class="section">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="sec-title" style="margin:0">${isEdit ? '✏️ 코드 읽기 문제 수정' : '🆕 코드 읽기 문제 만들기'}</div>
      <button class="btn-sm" data-action="cr-edit-cancel">← 목록으로</button>
    </div>
    <div class="form">
      <div class="field"><label>제목</label>
        <input id="cr-e-title" type="text" placeholder="예: for 루프와 누적합" value="${esc(r.title || '')}"/>
      </div>
      <div class="field"><label>설명 (선택)</label>
        <textarea id="cr-e-desc" placeholder="문제에 대한 안내 (예: 'range와 += 연산을 익혀봅시다')" style="min-height:50px">${esc(r.description || '')}</textarea>
      </div>
      <div class="field"><label>문제 유형</label>
        <div style="display:flex;gap:14px;padding:6px 0">
          <label style="display:flex;align-items:center;gap:5px;font-weight:500;font-size:13px;text-transform:none;letter-spacing:0;cursor:pointer">
            <input type="radio" name="cr-type" value="predict" ${type === 'predict' ? 'checked' : ''} style="width:auto"/>
            🔮 출력 예측 (코드 결과 맞히기)
          </label>
          <label style="display:flex;align-items:center;gap:5px;font-weight:500;font-size:13px;text-transform:none;letter-spacing:0;cursor:pointer">
            <input type="radio" name="cr-type" value="trace" ${type === 'trace' ? 'checked' : ''} style="width:auto"/>
            🔍 변수 추적 (단계별 값 맞히기)
          </label>
        </div>
      </div>
      <div class="field"><label>Python 코드</label>
        <textarea id="cr-e-code" class="cr-code-textarea" placeholder="x = 3&#10;y = x * 2&#10;print(x + y)" style="min-height:200px;font-family:monospace;font-size:13px">${esc(code)}</textarea>
      </div>
      <div class="field"><label>표준입력 (선택, input() 쓰는 코드용)</label>
        <textarea id="cr-e-stdin" placeholder="한 줄에 하나씩" style="min-height:40px;font-family:monospace;font-size:13px">${esc(stdin)}</textarea>
      </div>

      <div id="cr-analyze-result"></div>

      ${!isEdit ? multiClassPicker('cr-e', TC_CLS?.id) : ''}

      <div id="cr-e-err" class="err"></div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="btn-sm" data-action="cr-analyze">🪄 자동 분석 미리보기</button>
        <button class="btn-p" data-action="cr-save" data-edit-id="${r.id || ''}">${isEdit ? '수정 완료' : '문제 등록'}</button>
        <button class="btn-sm" data-action="cr-edit-cancel">취소</button>
      </div>
      <div class="box-info" style="margin-top:8px">
        💡 <b>자동 분석</b>은 Pyodide로 코드를 실제 실행해서 출력값과 줄별 변수 스냅샷을 추출합니다.
        등록 시에도 자동으로 분석되어 정답이 저장돼요.
      </div>
    </div>
  </div>`;
}

// 분석 결과 미리보기 렌더 (등록 폼 안에서 호출)
function renderAnalyzeResult(result, type){
  if(!result) return '';
  if(!result.success){
    return `<div class="box-warn"><b>⚠️ 분석 실패</b><pre style="margin:6px 0 0;font-size:12px;white-space:pre-wrap">${esc(result.error || '')}</pre></div>`;
  }
  if(type === 'predict'){
    return `<div class="box-ok"><b>✓ 분석 완료</b>
      <div style="font-size:12px;color:var(--text2);margin-top:4px">자동 추출된 정답 (출력):</div>
      <pre style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px;margin:6px 0 0;font-size:13px;white-space:pre-wrap;font-family:monospace">${esc(result.output || '(빈 출력)')}</pre>
    </div>`;
  }
  if(type === 'trace'){
    const steps = pickTraceSteps(result.traces || [], 6);
    if(!steps.length) return `<div class="box-warn">변수가 없거나 단일 표현식이라 트레이스 단계를 만들 수 없어요.</div>`;
    const rows = steps.map((s, i) => {
      const prev = i === 0 ? null : steps[i-1];
      const askVar = pickAskVar(s, prev);
      const val = askVar ? s.locals[askVar] : '';
      return `<tr><td>${i+1}</td><td>${s.line}</td><td><code>${esc(askVar || '-')}</code></td><td><code>${esc(val || '')}</code></td></tr>`;
    }).join('');
    return `<div class="box-ok"><b>✓ 분석 완료 — ${steps.length}단계 자동 생성</b>
      <table class="tbl" style="margin-top:6px;font-size:12px">
        <thead><tr><th>#</th><th>줄</th><th>물어볼 변수</th><th>정답값(repr)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${result.output ? `<div style="font-size:12px;color:var(--text2);margin-top:8px">코드 실행 출력: <code>${esc(result.output.slice(0, 100))}${result.output.length > 100 ? '…' : ''}</code></div>` : ''}
    </div>`;
  }
  return '';
}

// 분석 결과로부터 저장할 데이터 만들기
function buildReadingFromAnalysis(meta, analysis){
  const base = {
    title: meta.title,
    description: meta.description || '',
    code: meta.code,
    stdin: meta.stdin || '',
    type: meta.type,
    createdAt: meta.createdAt || new Date().toISOString()
  };
  if(meta.type === 'predict'){
    base.expectedOutput = analysis.output || '';
  } else if(meta.type === 'trace'){
    const steps = pickTraceSteps(analysis.traces || [], 6);
    base.traces = steps.map((s, i) => {
      const askVar = pickAskVar(s, i === 0 ? null : steps[i-1]);
      return {
        line: s.line,
        askVar: askVar || '',
        expectedValue: askVar ? (s.locals[askVar] || '') : ''
      };
    }).filter(t => t.askVar);
  }
  return base;
}
