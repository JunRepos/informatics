/* ═══════════════════════════════════════
   views/oj.js — OJ (Online Judge) 뷰

   선생님: 문제 출제/수정/삭제, 제출 현황
   학생: 문제 목록, 풀이 화면 (프로그래머스 스타일)
═══════════════════════════════════════ */

// ══════════════════════════════════════
//  선생님 뷰
// ══════════════════════════════════════

// 선생님 OJ 탭 메인
function vTcOJ(){
  const form = vTcOJForm();
  const list = vTcOJList();
  return form + list;
}

// 문제 출제/수정 폼
function vTcOJForm(){
  const editId = window._ojEditId || null;
  const editData = editId ? OJ_PROBLEMS.find(p => p.id === editId) : null;

  // 수정 시 기존 테스트케이스, 신규 시 빈 2개
  const tcs = editData && editData.testCases?.length
    ? editData.testCases
    : [{id:'new-0',input:'',expectedOutput:'',isHidden:false,order:0},{id:'new-1',input:'',expectedOutput:'',isHidden:false,order:1}];

  const tcRows = tcs.map((tc, i) => `
    <div class="oj-tc-form-row" data-tc-idx="${i}">
      <div style="flex:1;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;font-weight:700;color:var(--text2)">TC ${i + 1}</span>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:var(--text3);font-weight:500;text-transform:none;letter-spacing:0">
            <input type="checkbox" class="oj-tc-hidden" ${tc.isHidden ? 'checked' : ''} style="width:auto"/> 숨김
          </label>
          <button type="button" class="btn-xs btn-danger" data-action="oj-remove-tc" data-idx="${i}" style="margin-left:auto">✕</button>
        </div>
        <div class="form-row">
          <div class="field"><label>입력</label><textarea class="oj-tc-input" placeholder="stdin 입력값" style="min-height:50px;font-family:monospace;font-size:13px">${esc(tc.input)}</textarea></div>
          <div class="field"><label>기대 출력</label><textarea class="oj-tc-output" placeholder="기대하는 stdout" style="min-height:50px;font-family:monospace;font-size:13px">${esc(tc.expectedOutput)}</textarea></div>
        </div>
      </div>
    </div>`).join('');

  return `<div class="section">
    <div class="sec-title">${editData ? '✏️ 문제 수정' : '💻 문제 출제'}</div>
    ${editData ? `<div class="box-warn" style="margin-bottom:10px">수정 중: <b>${esc(editData.title)}</b></div>` : ''}
    <div class="form">
      <div class="field"><label>문제 제목</label><input id="oj-title" type="text" placeholder="예: 두 수의 합" value="${editData ? esc(editData.title) : ''}"/></div>
      <div class="field"><label>문제 설명 <span style="font-weight:400;color:var(--text3);text-transform:none;letter-spacing:0">(마크다운 지원: <code>#</code> 제목, <code>**굵게**</code>, <code>\`코드\`</code>, <code>\`\`\`python ... \`\`\`</code>)</span></label><textarea id="oj-desc" placeholder="문제 설명을 입력하세요. 마크다운 사용 가능!&#10;&#10;## 문제&#10;두 정수 A, B를 입력받아 **A+B** 를 출력하시오.&#10;&#10;### 입력&#10;첫 줄에 두 정수 A, B (1 ≤ A, B ≤ 1000)&#10;&#10;### 출력&#10;A+B를 출력" style="min-height:200px">${editData ? esc(editData.description || '') : ''}</textarea></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
        <div style="font-size:13px;font-weight:600;color:var(--text2)">테스트 케이스</div>
        <button type="button" class="btn-xs btn-p" data-action="oj-add-tc">+ 추가</button>
      </div>
      <div id="oj-tc-list">${tcRows}</div>
      ${!editData ? multiClassPicker('oj', TC_CLS?.id) : ''}
      <div id="oj-form-err" class="err"></div>
      <div style="display:flex;gap:7px">
        <button id="oj-save-btn" class="btn-p" data-edit-id="${editData?.id || ''}">${editData ? '수정 완료' : '문제 등록'}</button>
        ${editData ? `<button onclick="window._ojEditId=null;setTC('oj')" class="btn-sm">취소</button>` : ''}
      </div>
    </div>
  </div>`;
}

// 문제 목록 (선생님)
function vTcOJList(){
  if(!OJ_PROBLEMS.length) return `<div class="sec-title" style="margin-top:4px">등록된 문제</div>` + emptyBox('💻','등록된 문제가 없습니다.');

  const rows = OJ_PROBLEMS.map(p => {
    const totalTc = p.testCases?.length || 0;
    const hiddenTc = p.testCases?.filter(t => t.isHidden).length || 0;
    const subCount = OJ_SUBMISSIONS[p.id] ? Object.keys(OJ_SUBMISSIONS[p.id]).length : 0;
    return `<div class="list-row">
      <div class="row-icon">💻</div>
      <div class="row-info">
        <div class="row-title">${esc(p.title)}</div>
        <div class="row-meta">${fmtDt(p.createdAt)} · TC ${totalTc}개 (숨김 ${hiddenTc}개) · 제출 ${subCount}명</div>
      </div>
      <div class="row-right">
        <button class="btn-sm btn-p" data-action="oj-view-subs" data-pid="${p.id}">현황</button>
        <button class="btn-xs" data-action="oj-edit-prob" data-pid="${p.id}">✏️</button>
        <button class="btn-xs btn-danger" data-action="oj-del-prob" data-pid="${p.id}" data-ptitle="${esc(p.title)}">삭제</button>
      </div>
    </div>`;
  }).join('');

  return `<div class="sec-title" style="margin-top:4px">등록된 문제 (${OJ_PROBLEMS.length}개)</div>` + rows;
}

// 제출 현황 테이블
function vOJStatusTable(pid){
  const subs = OJ_SUBMISSIONS[pid] || {};
  const prob = OJ_PROBLEMS.find(p => p.id === pid);
  if(!prob) return '';

  const rows = STUDENTS.map(st => {
    const sub = subs[st.number];
    const statusChip = sub
      ? sub.status === 'pass' ? `<span class="chip chip-green">✓ 통과</span>`
        : sub.status === 'partial' ? `<span class="chip chip-orange">${sub.passedCases}/${sub.totalCases}</span>`
        : `<span class="chip chip-red">✗ 실패</span>`
      : `<span class="cell-no">미제출</span>`;
    return `<tr>
      <td>${esc(st.number)}</td>
      <td>${esc(st.name)}</td>
      <td>${statusChip}</td>
      <td style="font-size:11px">${sub ? fmtDt(sub.submittedAt) : '-'}</td>
      <td style="font-size:11px">${sub ? `${sub.passedCases}/${sub.totalCases}` : '-'}</td>
    </tr>`;
  }).join('');

  const passCount = Object.values(subs).filter(s => s.status === 'pass').length;

  return `<div class="section">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div class="sec-title" style="margin:0">📊 ${esc(prob.title)} — 제출 현황</div>
      <button class="btn-sm" data-action="oj-close-subs" data-pid="${pid}">✕ 닫기</button>
    </div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:10px">
      통과 ${passCount}명 / 제출 ${Object.keys(subs).length}명 / 전체 ${STUDENTS.length}명
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>학번</th><th>이름</th><th>결과</th><th>제출일시</th><th>통과</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:var(--text3)">학생이 없습니다</td></tr>'}</tbody>
      </table>
    </div>
  </div>`;
}


// ══════════════════════════════════════
//  학생 뷰
// ══════════════════════════════════════

// 학생 OJ 문제 목록
function vStOJ(){
  if(!OJ_PROBLEMS.length) return emptyBox('💻','등록된 문제가 없습니다.');

  return OJ_PROBLEMS.map(p => {
    const sub = OJ_SUBMISSIONS[p.id]?.[ST_USER?.number];
    const statusChip = sub
      ? sub.status === 'pass' ? `<span class="chip chip-green">✓ 통과</span>`
        : sub.status === 'partial' ? `<span class="chip chip-orange">${sub.passedCases}/${sub.totalCases}</span>`
        : `<span class="chip chip-red">✗ 실패</span>`
      : `<span class="chip chip-gray">미풀이</span>`;

    return `<div class="list-row click" data-action="oj-pick-prob" data-pid="${p.id}">
      <div class="row-icon">💻</div>
      <div class="row-info">
        <div class="row-title">${esc(p.title)}</div>
        <div class="row-meta">${fmtDt(p.createdAt)} · TC ${(p.testCases?.filter(t => !t.isHidden).length || 0)}개</div>
      </div>
      <div class="row-right">${statusChip}</div>
    </div>`;
  }).join('');
}

// 학생 OJ 풀이 화면 (프로그래머스 스타일 분할 패널)
function vStOJSolve(){
  const p = OJ_SEL_PROB;
  if(!p) return emptyBox('❌','문제를 찾을 수 없습니다.');

  const visibleTcs = (p.testCases || []).filter(t => !t.isHidden);
  const sub = OJ_SUBMISSIONS[p.id]?.[ST_USER?.number];
  const prevCode = sub?.code || '';

  // 왼쪽: 문제 설명 + 예제
  const tcExamples = visibleTcs.map((tc, i) => `
    <div class="oj-example">
      <div class="oj-tc-label">예제 입력 ${i + 1}</div>
      <div class="oj-example-block"><button class="oj-copy-btn" data-action="oj-copy-example" data-text="${esc(tc.input)}">복사</button>${esc(tc.input)}</div>
      <div class="oj-tc-label" style="margin-top:8px">예제 출력 ${i + 1}</div>
      <div class="oj-example-block"><button class="oj-copy-btn" data-action="oj-copy-example" data-text="${esc(tc.expectedOutput)}">복사</button>${esc(tc.expectedOutput)}</div>
    </div>`).join('');

  // 문제 설명: 마크다운 지원 (제목/코드블록/리스트/강조 등)
  const descHtml = (typeof marked !== 'undefined' && p.description)
    ? `<div class="oj-desc oj-desc-md">${marked.parse(p.description)}</div>`
    : `<div class="oj-desc">${esc(p.description || '')}</div>`;

  const left = `<div class="oj-left">
    <div style="font-size:18px;font-weight:700;margin-bottom:16px">${esc(p.title)}</div>
    ${descHtml}
    ${visibleTcs.length ? `<div class="divider"></div>
      <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:12px">입출력 예</div>
      ${tcExamples}` : ''}
  </div>`;

  // 오른쪽: 에디터 + 결과 패널 + 액션 바
  const isStudent = !IS_TC && !!ST_USER;
  const right = `<div class="oj-right">
    <div class="oj-editor-header">
      <span>solution.py</span>
      <div style="display:flex;gap:8px;align-items:center">
        ${isStudent ? `<span id="oj-draft-ind" class="oj-draft-ind" data-state="idle"></span>` : ''}
        ${prevCode ? `<button class="btn-xs" data-action="oj-load-prev">이전 제출 코드</button>` : ''}
      </div>
    </div>
    <div class="oj-editor-section">
      <textarea id="oj-code-editor" style="display:none">${esc(OJ_CODE)}</textarea>
    </div>
    <div class="oj-resize-h" id="oj-resize-h"></div>
    ${vOJResultsPanel()}
    <div class="oj-actions-bar">
      <button class="btn-sm" data-action="oj-reset-code">초기화</button>
      <div class="oj-spacer"></div>
      <button class="btn-sm oj-btn-run" data-action="oj-run-code" ${OJ_RUNNING ? 'disabled' : ''}>
        ${OJ_RUNNING ? '⏳ 실행 중...' : '▶ 코드 실행'}
      </button>
      <button class="btn-sm oj-btn-submit" data-action="oj-submit-code" ${OJ_RUNNING ? 'disabled' : ''}>
        ${OJ_RUNNING ? '⏳ 채점 중...' : '제출 후 채점하기'}
      </button>
    </div>
  </div>`;

  return `<div class="back-btn" data-action="oj-back">← 문제 목록으로</div>
    <div class="oj-split">${left}${right}</div>`;
}

// 결과 패널 (탭 + 내용)
function vOJResultsPanel(){
  return `<div class="oj-results-panel" id="oj-results-panel">
    <div class="oj-results-tabs">
      <button class="oj-rtab${OJ_RESULT_TAB === 'exec' ? ' active' : ''}" data-action="oj-switch-tab" data-tab="exec">실행 결과</button>
      <button class="oj-rtab${OJ_RESULT_TAB === 'test' ? ' active' : ''}" data-action="oj-switch-tab" data-tab="test">테스트 결과</button>
    </div>
    <div class="oj-results-body" id="oj-results-body">
      ${OJ_RESULT_TAB === 'exec' ? vOJRunTab() : vOJTestTab()}
    </div>
  </div>`;
}

// 에러 박스 렌더 (친절한 한국어 + 원본 traceback 펼치기)
function vOJErrorBox(rawError){
  if(!rawError) return '';
  const info = (typeof friendlyOJError === 'function') ? friendlyOJError(rawError) : null;
  const friendly = info?.friendly;
  const lineNum = info?.line;
  const lineHint = lineNum ? `<span class="oj-err-line">📍 ${lineNum}번째 줄 근처</span>` : '';
  return `<div class="oj-output-box oj-error">
    ${friendly
      ? `<div class="oj-err-friendly">💡 ${friendly}</div>${lineHint}`
      : `<div class="oj-err-friendly">⚠️ 실행 중 오류가 발생했어요.</div>${lineHint}`}
    <details class="oj-err-raw"><summary>원본 에러 메시지 보기</summary><pre>${esc(rawError)}</pre></details>
  </div>`;
}

// 실행 결과 탭 (커스텀 stdin + 출력)
function vOJRunTab(){
  let outputHtml = '';
  if(OJ_CUSTOM_OUTPUT === null){
    outputHtml = `<div class="oj-output-box oj-placeholder">실행 결과가 여기에 표시됩니다.</div>`;
  } else if(!OJ_CUSTOM_OUTPUT.success){
    outputHtml = vOJErrorBox(OJ_CUSTOM_OUTPUT.error || '실행 오류');
  } else {
    outputHtml = `<div class="oj-output-box">${esc(OJ_CUSTOM_OUTPUT.output || '(출력 없음)')}</div>`;
  }

  return `<div class="oj-stdin-label">입력값</div>
    <div class="oj-stdin-area">
      <textarea id="oj-custom-stdin" placeholder="실행 시 사용할 입력값을 입력하세요">${esc(OJ_CUSTOM_STDIN)}</textarea>
    </div>
    <div class="oj-output-label">실행 결과</div>
    ${outputHtml}`;
}

// 테스트 결과 탭 (TC 채점 결과 + diff)
function vOJTestTab(){
  const results = OJ_SUBMIT_RESULTS;
  if(!results) return `<div class="oj-output-box oj-placeholder">제출 후 채점하기 버튼을 눌러 채점하세요.</div>`;

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const allPass = passed === total;

  const header = `<div class="box-${allPass ? 'ok' : 'warn'}" style="margin-bottom:10px">
    ${allPass ? '🎉 모든 테스트를 통과했습니다!' : `⚠️ ${passed}/${total}개 테스트 통과`}
  </div>`;

  const rows = results.map((r, i) => {
    const label = r.isHidden ? `테스트 ${i + 1} (숨김)` : `테스트 ${i + 1}`;

    // 에러로 실패한 경우: 친절한 메시지
    if(r.error){
      const errBox = vOJErrorBox(r.error);
      return `<div class="oj-result-row">
        <span>${label}</span>
        <span class="oj-result-fail">⚠️ 오류</span>
      </div>
      ${!r.isHidden ? `<div class="oj-result-detail">${errBox}</div>` : ''}`;
    }

    // 통과
    if(r.passed){
      return `<div class="oj-result-row">
        <span>${label}</span>
        <span class="oj-result-pass">✓ 통과</span>
      </div>`;
    }

    // 실패 (에러 아님, 출력만 다름) — 숨김 TC면 디테일 X
    const detail = r.isHidden ? '' : `<div class="oj-result-detail">
      <div class="oj-fail-input"><span class="oj-fail-label">입력</span>
        <pre>${esc(r.input || '(없음)')}</pre>
      </div>
      ${renderOJDiff(r.expected, r.actual)}
    </div>`;
    return `<div class="oj-result-row">
      <span>${label}</span>
      <span class="oj-result-fail">✗ 출력 불일치</span>
    </div>${detail}`;
  }).join('');

  return header + `<div class="oj-result-list">${rows}</div>`;
}
