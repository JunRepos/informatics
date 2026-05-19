/* ═══════════════════════════════════════
   views/coderead.js — 퀴즈 (Quiz) 뷰
   (구 "코드 읽기" — DB 경로 codeReadings/codeReadingProgress 는 유지)

   학생: 다양한 형식으로 코드/개념 문제 풀이.
     · 🔮 출력 예측 (predict)  — 코드 보고 stdout 결과 텍스트로
     · 🔍 변수 추적 (trace)    — 단계별 변수 값 맞히기
     · ✅ 객관식 (mcq)         — 4지선다
     · 🧩 빈칸 채우기 (cloze)  — 코드 안 ___ 채우기
     · 🐛 버그 찾기 (bugfix)   — 잘못된 줄 클릭

   선생님은 유형별 폼으로 등록. predict/trace 는 Pyodide 자동 분석,
   mcq/cloze/bugfix 는 정답 직접 입력.
═══════════════════════════════════════ */

const QUIZ_TYPES = [
  {id:'predict', label:'🔮 출력 예측',   desc:'코드 실행 결과를 텍스트로 맞히기 (Pyodide 자동 정답)'},
  {id:'trace',   label:'🔍 변수 추적',   desc:'단계별로 변수 값 맞히기 (Pyodide 자동 정답)'},
  {id:'mcq',     label:'✅ 객관식',       desc:'4지선다 — 코드 결과·개념·문법 자유 출제'},
  {id:'cloze',   label:'🧩 빈칸 채우기', desc:'코드의 ___ 부분을 학생이 채워 정답과 비교'},
  {id:'bugfix',  label:'🐛 버그 찾기',   desc:'잘못된 줄 번호를 클릭해 찾기'}
];

function _quizTypeMeta(t){
  return QUIZ_TYPES.find(x => x.id === t) || QUIZ_TYPES[0];
}

// ══════════════════════════════════════
//  학생 뷰
// ══════════════════════════════════════

function vStCodeRead(){
  if(CR_VIEW === 'solve' && CR_SEL) return vStCRSolve();
  return vStCRList();
}

function vStCRList(){
  if(!CR_READINGS.length){
    return emptyBox('🧩','등록된 퀴즈가 없습니다.');
  }
  const myProg = CR_PROGRESS || {};
  const rows = CR_READINGS.map(r => {
    const p = myProg[r.id]?.[ST_USER?.number] || null;
    const passed = p && p.passed;
    const typeLabel = _quizTypeMeta(r.type).label;
    return `<div class="list-row click" data-action="cr-pick" data-rid="${r.id}">
      <div class="row-icon">🧩</div>
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
      <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">전체 퀴즈</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--ok)">${passed}</div><div class="stat-label">통과</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--danger)">${total - passed}</div><div class="stat-label">남은 퀴즈</div></div>
    </div>
    <div class="sec-title" style="margin-top:4px">📚 퀴즈 목록 (${total}개)</div>
    ${rows}
  `;
}

function vStCRSolve(){
  const r = CR_SEL;
  if(!r) return vStCRList();
  const type = r.type || 'predict';
  const meta = _quizTypeMeta(type);
  const myProg = CR_PROGRESS[r.id]?.[ST_USER?.number] || null;
  const isPassed = myProg && myProg.passed;

  const headerBar = `
    <div class="cr-solve-bar">
      <div>
        <span class="cr-type-chip cr-type-${type}">${meta.label}</span>
        <span style="font-weight:700;font-size:14px;margin-left:6px">${esc(r.title)}</span>
      </div>
      <div>
        ${isPassed ? `<span class="chip chip-green">✓ 통과 완료</span>` : ''}
        <button class="btn-sm" data-action="cr-back">← 목록</button>
      </div>
    </div>
    ${r.description ? `<div class="cr-desc-box">${esc(r.description)}</div>` : ''}
  `;

  // 유형별 본문 분기
  if(type === 'mcq')    return headerBar + vStQuizMcq(r);
  if(type === 'cloze')  return headerBar + vStQuizCloze(r);
  if(type === 'bugfix') return headerBar + vStQuizBugfix(r);
  // 기본 — predict / trace (코드 + 우측 질문 패널)
  return headerBar + vStQuizCodeSplit(r);
}

// 코드 좌측 + 질문 우측 — predict / trace 공용
function vStQuizCodeSplit(r){
  const type = r.type;
  const codeLines = (r.code || '').split('\n');
  const codeHtml = codeLines.map((ln, i) =>
    `<div class="cr-code-line"><span class="cr-line-no">${i+1}</span><span class="cr-line-src">${esc(ln) || ' '}</span></div>`
  ).join('');

  let questionHtml = '';
  if(type === 'predict'){
    const stdinBlock = (r.stdin && r.stdin.trim())
      ? `<div class="cr-stdin-block">
           <div class="cr-stdin-label">📥 사용자가 입력한 값 (이 값으로 코드가 실행돼요)</div>
           <pre class="cr-stdin-pre">${esc(r.stdin)}</pre>
         </div>`
      : '';
    const myProg = CR_PROGRESS[r.id]?.[ST_USER?.number] || null;
    const isPassed = myProg && myProg.passed;
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
  } else if(type === 'trace'){
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
    <div class="cr-split">
      <div class="cr-code-pane">
        <div class="cr-pane-title">📄 코드</div>
        <pre class="cr-code-box">${codeHtml}</pre>
      </div>
      <div class="cr-q-pane">${questionHtml}</div>
    </div>
  `;
}

// 객관식
function vStQuizMcq(r){
  const choices = r.choices || [];
  const codeBlock = r.code?.trim()
    ? `<pre class="cr-code-box cr-code-box-full">${(r.code || '').split('\n').map((ln,i) =>
        `<div class="cr-code-line"><span class="cr-line-no">${i+1}</span><span class="cr-line-src">${esc(ln) || ' '}</span></div>`).join('')}</pre>`
    : '';
  const choiceBtns = choices.map((c, i) => `
    <button class="quiz-mcq-choice" data-action="cr-submit-mcq" data-cidx="${i}">
      <span class="quiz-mcq-letter">${String.fromCharCode(65 + i)}</span>
      <span class="quiz-mcq-text">${esc(c)}</span>
    </button>
  `).join('');
  const question = r.question || r.description || '';
  return `
    <div class="quiz-mcq-wrap">
      ${codeBlock}
      ${question ? `<div class="quiz-mcq-question">${esc(question)}</div>` : ''}
      <div class="quiz-mcq-choices">${choiceBtns}</div>
      ${renderCRResult()}
      <div style="margin-top:10px"><button class="btn-sm" data-action="cr-back">← 목록</button></div>
    </div>
  `;
}

// 빈칸 채우기 (code에 ___ 토큰)
function vStQuizCloze(r){
  const blanks = r.blanks || [];
  // 코드를 줄 단위로 렌더 + 줄 안의 ___ 를 input 으로 치환
  let blankIdx = 0;
  const lines = (r.code || '').split('\n').map((ln, i) => {
    let html = '';
    let rest = ln;
    while(rest.includes('___')){
      const p = rest.indexOf('___');
      html += esc(rest.slice(0, p));
      const saved = (CR_CLOZE_ANSWERS && CR_CLOZE_ANSWERS[blankIdx]) || '';
      html += `<input class="quiz-cloze-blank" type="text" data-bidx="${blankIdx}" value="${esc(saved)}" autocomplete="off" spellcheck="false"/>`;
      rest = rest.slice(p + 3);
      blankIdx++;
    }
    html += esc(rest);
    return `<div class="cr-code-line"><span class="cr-line-no">${i+1}</span><span class="cr-line-src">${html || ' '}</span></div>`;
  }).join('');
  return `
    <div class="quiz-cloze-wrap">
      <div class="cr-q-title">🧩 빈칸에 알맞은 값을 채워주세요</div>
      <div class="cr-q-desc">${blanks.length}개의 빈칸이 있어요. 각 칸을 클릭해서 입력하세요.</div>
      <pre class="cr-code-box cr-code-box-full">${lines}</pre>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px">
        <button class="btn-p" data-action="cr-submit-cloze">제출</button>
        <button class="btn-sm" data-action="cr-back">← 목록</button>
      </div>
      ${renderCRResult()}
    </div>
  `;
}

// 버그 찾기 (줄 클릭)
function vStQuizBugfix(r){
  const lines = (r.code || '').split('\n').map((ln, i) =>
    `<div class="quiz-bug-line${(CR_BUG_SEL === i+1) ? ' selected' : ''}" data-action="cr-bug-select" data-lineno="${i+1}">
       <span class="cr-line-no">${i+1}</span><span class="cr-line-src">${esc(ln) || ' '}</span>
     </div>`
  ).join('');
  return `
    <div class="quiz-bug-wrap">
      <div class="cr-q-title">🐛 잘못된 줄을 찾아 클릭하세요</div>
      <div class="cr-q-desc">${esc(r.description || '아래 코드 중 한 줄에 버그가 있어요. 그 줄을 클릭해서 골라 주세요.')}</div>
      <pre class="quiz-bug-code">${lines}</pre>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px">
        <button class="btn-p" data-action="cr-submit-bugfix" ${CR_BUG_SEL ? '' : 'disabled'}>
          ${CR_BUG_SEL ? `${CR_BUG_SEL}번 줄로 제출` : '줄을 먼저 클릭하세요'}
        </button>
        <button class="btn-sm" data-action="cr-back">← 목록</button>
      </div>
      ${renderCRResult()}
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
  // 묶음별 등록 카드
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

  const typeCards = QUIZ_TYPES.map(t => `
    <button class="quiz-type-card" data-action="cr-new" data-qtype="${t.id}">
      <div class="quiz-type-card-label">${t.label}</div>
      <div class="quiz-type-card-desc">${esc(t.desc)}</div>
    </button>
  `).join('');

  const header = `<div class="cr-header-row">
    <div style="font-size:13px;color:var(--text2);flex:1;min-width:240px">
      학생들에게 다양한 형식의 퀴즈를 출제할 수 있어요.
      코드 결과 예측, 변수 추적, 객관식, 빈칸 채우기, 버그 찾기 — 단원·차시에 맞춰 골라 쓰세요.
    </div>
  </div>
  <div class="quiz-type-grid">${typeCards}</div>`;

  const packsSection = packCards ? `
    <div class="cr-pack-section">
      <div class="cr-pack-section-title">📦 예제 묶음 한방 등록 <span style="font-weight:400;color:var(--text3);font-size:11px">— 카드를 클릭하면 해당 차시 문제가 모두 등록됩니다</span></div>
      <div class="cr-pack-grid">${packCards}</div>
    </div>` : '';

  if(!CR_READINGS.length){
    return header + packsSection + emptyBox('🧩','아직 등록된 퀴즈가 없어요. 위에서 유형을 골라 새 퀴즈를 만들어 보세요.');
  }

  const rows = CR_READINGS.map((r, i) => {
    const allProg = CR_PROGRESS[r.id] || {};
    const passedCount = Object.values(allProg).filter(p => p && p.passed).length;
    const totalSt = STUDENTS.length || 0;
    const typeLabel = _quizTypeMeta(r.type).label;
    let stepInfo = '';
    if(r.type === 'trace')  stepInfo = `${(r.traces || []).length}단계`;
    else if(r.type === 'cloze') stepInfo = `${(r.blanks || []).length}개 빈칸`;
    else stepInfo = '1문항';
    return `<div class="list-row">
      <div class="row-icon">${i + 1}</div>
      <div class="row-info">
        <div class="row-title">${esc(r.title)}</div>
        <div class="row-meta">${typeLabel} · ${stepInfo} · ${passedCount}/${totalSt}명 통과 · ${fmtDt(r.createdAt)}</div>
      </div>
      <div class="row-right">
        <button class="btn-xs" data-action="cr-move-up" data-rid="${r.id}" title="위로">▲</button>
        <button class="btn-xs" data-action="cr-move-down" data-rid="${r.id}" title="아래로">▼</button>
        <button class="btn-xs" data-action="cr-edit" data-rid="${r.id}">✏️</button>
        <button class="btn-xs btn-danger" data-action="cr-del" data-rid="${r.id}" data-rtitle="${esc(r.title)}">삭제</button>
      </div>
    </div>`;
  }).join('');

  return header + packsSection + `<div class="sec-title" style="margin-top:14px">등록된 퀴즈 (${CR_READINGS.length}개)</div>` + rows;
}

function vTcCREdit(){
  const r = CR_EDITING || {};
  const isEdit = !!r.id;
  const type = r.type || 'predict';
  const meta = _quizTypeMeta(type);

  // 공통: 제목/설명
  const commonFields = `
    <div class="field"><label>제목</label>
      <input id="cr-e-title" type="text" placeholder="예: for 루프와 누적합" value="${esc(r.title || '')}"/>
    </div>
    <div class="field"><label>설명 / 안내 (선택)</label>
      <textarea id="cr-e-desc" placeholder="학생에게 보여줄 안내 (예: 'range와 += 연산을 익혀봅시다')" style="min-height:50px">${esc(r.description || '')}</textarea>
    </div>
  `;

  // 유형별 필드
  let typeFields = '';
  if(type === 'predict' || type === 'trace'){
    typeFields = `
      <div class="field"><label>Python 코드</label>
        <textarea id="cr-e-code" class="cr-code-textarea" placeholder="x = 3&#10;y = x * 2&#10;print(x + y)" style="min-height:180px;font-family:monospace;font-size:13px">${esc(r.code || '')}</textarea>
      </div>
      <div class="field"><label>표준입력 (선택, input() 쓰는 코드용)</label>
        <textarea id="cr-e-stdin" placeholder="한 줄에 하나씩" style="min-height:40px;font-family:monospace;font-size:13px">${esc(r.stdin || '')}</textarea>
      </div>
      <div id="cr-analyze-result"></div>
      <div class="box-info" style="margin-top:8px;font-size:12px">
        💡 <b>자동 분석</b>은 Pyodide로 코드를 실제 실행해서 정답을 추출합니다.
        등록 시에도 자동으로 분석되어 정답이 저장돼요.
      </div>
    `;
  } else if(type === 'mcq'){
    const choices = r.choices || ['', '', '', ''];
    const ci = (typeof r.correctIndex === 'number') ? r.correctIndex : 0;
    typeFields = `
      <div class="field"><label>코드 (선택 — 코드 없는 개념 질문도 가능)</label>
        <textarea id="cr-e-code" class="cr-code-textarea" placeholder="x = 3 + 5&#10;print(x)" style="min-height:120px;font-family:monospace;font-size:13px">${esc(r.code || '')}</textarea>
      </div>
      <div class="field"><label>질문</label>
        <textarea id="cr-e-question" placeholder="예: 위 코드의 출력은? / 다음 중 올바른 변수명은?" style="min-height:50px">${esc(r.question || '')}</textarea>
      </div>
      <div class="field"><label>보기 (정답 옆 동그라미를 선택)</label>
        <div class="quiz-mcq-edit-list">
          ${choices.map((c, i) => `
            <div class="quiz-mcq-edit-row">
              <label class="quiz-mcq-edit-correct">
                <input type="radio" name="cr-correct" value="${i}" ${i === ci ? 'checked' : ''}/>
                <span>${String.fromCharCode(65 + i)}</span>
              </label>
              <input class="cr-e-choice" data-cidx="${i}" type="text" placeholder="보기 ${String.fromCharCode(65 + i)}" value="${esc(c)}"/>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="field"><label>해설 (선택 — 정답 공개 시 표시)</label>
        <textarea id="cr-e-explanation" placeholder="왜 이게 정답인지 짧게" style="min-height:40px">${esc(r.explanation || '')}</textarea>
      </div>
    `;
  } else if(type === 'cloze'){
    const blanks = r.blanks || [];
    typeFields = `
      <div class="field"><label>Python 코드 (채우게 할 자리는 <code>___</code> 세 개로 표시)</label>
        <textarea id="cr-e-code" class="cr-code-textarea" placeholder="a = ___&#10;b = ___&#10;print(a + b)  # 결과: 8" style="min-height:160px;font-family:monospace;font-size:13px">${esc(r.code || '')}</textarea>
      </div>
      <div class="field"><label>빈칸 정답 (위에서 아래로 / 같은 줄은 왼쪽부터)</label>
        <div id="cr-e-blanks" class="quiz-cloze-edit-list">
          ${blanks.length ? blanks.map((b, i) => `
            <div class="quiz-cloze-edit-row">
              <span class="quiz-cloze-edit-tag">빈칸 ${i+1}</span>
              <input class="cr-e-blank" data-bidx="${i}" type="text" placeholder="정답" value="${esc(b)}"/>
            </div>
          `).join('') : `<div class="cr-hint-row">코드의 <code>___</code> 개수만큼 자동으로 정답 입력란이 만들어집니다. <button class="btn-xs" data-action="cr-cloze-refresh" type="button">🔄 코드 보고 빈칸 갱신</button></div>`}
        </div>
        <div style="margin-top:6px"><button class="btn-xs" data-action="cr-cloze-refresh" type="button">🔄 코드 보고 빈칸 다시 만들기</button></div>
      </div>
      <div class="box-info" style="margin-top:6px;font-size:12px">
        💡 학생이 입력한 답은 <b>공백/대소문자 차이는 무시</b>하고 비교돼요. 따옴표 종류(",')도 자동 정규화됩니다.
      </div>
    `;
  } else if(type === 'bugfix'){
    typeFields = `
      <div class="field"><label>버그가 있는 Python 코드</label>
        <textarea id="cr-e-code" class="cr-code-textarea" placeholder="a = 10&#10;b = 20&#10;print(a - b)  # 합을 구하려고 했어요&#10;# (정답은 3번 줄)" style="min-height:160px;font-family:monospace;font-size:13px">${esc(r.code || '')}</textarea>
      </div>
      <div class="field"><label>버그가 있는 줄 번호 (1부터)</label>
        <input id="cr-e-buggy-line" type="number" min="1" placeholder="예: 3" value="${r.buggyLine || ''}" style="max-width:120px"/>
      </div>
      <div class="field"><label>해설 (선택 — 학생 통과 시 표시)</label>
        <textarea id="cr-e-explanation" placeholder="왜 그 줄이 잘못됐는지 설명" style="min-height:50px">${esc(r.explanation || '')}</textarea>
      </div>
    `;
  }

  return `<div class="section">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div class="sec-title" style="margin:0">${isEdit ? '✏️ 퀴즈 수정' : '🆕 새 퀴즈 만들기'} <span style="font-size:12px;font-weight:500;color:var(--text3);margin-left:6px">${meta.label}</span></div>
      <button class="btn-sm" data-action="cr-edit-cancel">← 목록으로</button>
    </div>
    <div class="form">
      ${commonFields}
      ${typeFields}

      ${!isEdit ? multiClassPicker('cr-e', TC_CLS?.id) : ''}

      <div id="cr-e-err" class="err"></div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        ${(type === 'predict' || type === 'trace')
          ? `<button class="btn-sm" data-action="cr-analyze">🪄 자동 분석 미리보기</button>` : ''}
        <button class="btn-p" data-action="cr-save" data-edit-id="${r.id || ''}">${isEdit ? '수정 완료' : '퀴즈 등록'}</button>
        <button class="btn-sm" data-action="cr-edit-cancel">취소</button>
      </div>
    </div>
  </div>`;
}

// 분석 결과 미리보기 렌더 (predict/trace 등록 폼 안에서 호출)
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

// 분석 결과로부터 저장할 데이터 만들기 (predict/trace)
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
