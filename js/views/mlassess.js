/* ═══════════════════════════════════════
   views/mlassess.js — 📝 ML 수행평가 (디지털 활동지)
   학생 응시(vStMlAssess) + 선생님 응시관리·채점(vTcMlAssess)
   비계(정오 피드백·길잡이) 없음 — 순수 수합. 채점은 교사용 정답 문서로.
═══════════════════════════════════════ */

/* ─────────── 학생 응시 ─────────── */

function vStMlAssess(){
  if(MLA_LOADING){
    return `<div class="section"><div class="ml-sub-explain">⏳ 내 응시 기록을 불러오는 중…</div></div>`;
  }
  const A = MLA_ANSWERS;
  const submitted = !!MLA_SUB?.submittedAt;
  const sit = A.sitId === 'mine' ? null : mlaSituationById(A.sitId);
  const isMine = A.sitId === 'mine';
  const chosen = !!A.sitId;

  // 헤더
  const head = `<div class="mla-head">
    <div>
      <div class="mla-title">📝 ${esc(MLA_META.title)}</div>
      <div class="mla-sub">배점 <b>${MLA_META.total}점</b> · 권장 ${MLA_META.minutes}분 · 뒷장의 8개 상황 중 <b>자신의 진로와 가장 가까운 상황 1개</b>를 골라 세 문항에 답하세요.</div>
    </div>
    ${submitted ? '<span class="aia-submit-chip done">✓ 제출 완료</span>' : '<span class="aia-submit-chip pending">⏳ 작성 중</span>'}
  </div>`;

  // 제출 완료 → 읽기 전용
  if(submitted){
    return `<div class="section">${head}
      <div class="mlp-feedback ok">✅ 제출이 완료되었습니다. 수정이 필요하면 선생님께 말씀하세요.</div>
      ${_mlaAnswerSummary(A, true)}
    </div>`;
  }

  // 상황 선택 그리드
  const cards = MLA_SITUATIONS.map(s => `<button class="mla-sit-card ${A.sitId === s.id ? 'on' : ''}" data-action="mla-pick-sit" data-sit="${s.id}">
      <span class="mla-sit-ic">${s.icon}</span>
      <span class="mla-sit-tx"><b>상황 ${s.id.slice(1)}</b> · ${esc(s.field)}<small>${esc(s.org)}</small></span>
    </button>`).join('');
  const mineCard = `<button class="mla-sit-card mine ${isMine ? 'on' : ''}" data-action="mla-mine">
      <span class="mla-sit-ic">✍️</span><span class="mla-sit-tx"><b>나의 문제</b> · 직접 정하기<small>내 진로의 문제를 직접</small></span></button>`;

  let body = `<div class="mla-q-head">📂 상황 고르기</div>
    <div class="mla-sit-grid">${cards}${mineCard}</div>`;

  if(chosen){
    // 선택한 상황 상세 (의뢰서 톤)
    if(isMine){
      body += `<div class="mla-dossier mine">
        <div class="mla-dossier-tag">✍️ 나의 문제</div>
        <div class="ml-sub-explain">내 진로·관심 분야에서 <b>기계학습으로 풀고 싶은 문제</b>를 직접 정해 적어보세요. (문항 1은 "내 문제가 기계학습에 적합한 이유"로 답하면 됩니다.)</div>
        <textarea class="aia-field-area" data-action="mla-input" data-fid="mineProblem" rows="3" placeholder="예: 우리 동아리 공연 관객 수를 미리 예측하고 싶다…">${esc(A.mineProblem || '')}</textarea>
      </div>`;
    } else {
      const tasks = sit.tasks.map((t, i) => `<li><b>${MLA_MARKS[i]}</b> ${esc(t)}</li>`).join('');
      body += `<div class="mla-dossier">
        <div class="mla-dossier-tag">📋 상황 ${sit.id.slice(1)} · ${esc(sit.field)}</div>
        <div class="mla-dossier-org">${sit.icon} ${esc(sit.title)}</div>
        <div class="mla-dossier-scene">${esc(sit.scene)}</div>
        <div class="mla-tasklist-h">이 조직이 하고 싶어 하는 일</div>
        <ul class="mla-tasklist">${tasks}</ul>
      </div>`;
    }

    // 표지: 고른 이유 (비채점)
    body += `<div class="mla-why-pick">
      <span class="mla-why-pick-l">🧭 이 상황을 고른 이유 <small>(나의 진로·관심과 어떻게 이어지나요? 채점에 들어가지 않아요)</small></span>
      <input type="text" class="sc-cmt-in" data-action="mla-input" data-fid="pickReason" value="${esc(A.pickReason || '')}" placeholder="한 줄로 적어보세요"/>
    </div>`;

    // 문항 1
    body += `<div class="mla-q-head">문항 1. 기계학습으로 풀 수 있는 일 구분 <span class="mla-pt">[5점]</span></div>`;
    if(isMine){
      body += `<div class="ml-sub-explain">내가 정한 문제가 <b>기계학습으로 풀기에 적합한지</b> 판단하고, 그 이유를 적으세요. (규칙으로 충분한 문제라면 그렇게 판단해도 됩니다.)</div>
        <textarea class="aia-field-area" data-action="mla-input" data-fid="q1_rule" rows="3" placeholder="내 문제가 기계학습에 적합한(또는 부적합한) 이유를 적어보세요.">${esc(A.q1_rule || '')}</textarea>`;
    } else {
      const checks = sit.tasks.map((t, i) => {
        const m = MLA_MARKS[i];
        const on = Array.isArray(A.q1_ml) && A.q1_ml.includes(m);
        return `<button class="mla-check ${on ? 'on' : ''}" data-action="mla-q1ml" data-mark="${m}">${on ? '☑' : '☐'} <b>${m}</b> ${esc(t)}</button>`;
      }).join('');
      body += `<div class="ml-sub-explain">㉠~㉣ 중 <b>기계학습으로 풀 수 있는 일</b>을 모두 고르고, 기계학습이 필요 없는 일은 <b>그 기호와 이유</b>를 한 줄로 쓰세요.</div>
        <div class="mla-checklist">${checks}</div>
        <div class="mla-field-label">기계학습이 필요 없는 일과 그 이유 (규칙으로 풀 수 있는가?)</div>
        <textarea class="aia-field-area" data-action="mla-input" data-fid="q1_rule" rows="2" placeholder="예: ㉢ — 정해진 수가표대로 계산하면 되므로 규칙으로 충분하다.">${esc(A.q1_rule || '')}</textarea>`;
    }

    // 문항 2
    body += `<div class="mla-q-head">문항 2. 알맞은 기계학습 유형·모델 선택 <span class="mla-pt">[5점]</span></div>`;
    if(!isMine){
      const taskRadios = sit.tasks.map((t, i) => {
        const m = MLA_MARKS[i];
        return `<button class="mla-radio ${A.q2_task === m ? 'on' : ''}" data-action="mla-q2task" data-mark="${m}">${A.q2_task === m ? '◉' : '○'} ${m}</button>`;
      }).join('');
      body += `<div class="mla-field-label">깊게 풀 문제 한 가지를 정하세요</div><div class="mla-radio-row">${taskRadios}</div>`;
    }
    const typeRadios = MLA_TYPES.map(t => `<button class="mla-radio ${A.q2_type === t ? 'on' : ''}" data-action="mla-q2type" data-type="${esc(t)}">${A.q2_type === t ? '◉' : '○'} ${esc(t)}</button>`).join('');
    body += `<div class="mla-field-label">① 유형</div><div class="mla-radio-row">${typeRadios}</div>`;
    // 치트시트
    body += `<details class="mla-cheat"><summary>📑 모델 한눈에 보기 (참고)</summary>
      <table class="tbl mla-cheat-tbl"><thead><tr><th>유형</th><th>모델</th><th>이런 문제에 어울려요</th></tr></thead><tbody>
      ${MLA_MODELS.map(m => `<tr><td>${esc(m.type)}</td><td><b>${esc(m.key)}</b></td><td>${esc(m.desc)}</td></tr>`).join('')}
      </tbody></table></details>`;
    const modelRadios = MLA_MODELS.map(m => `<button class="mla-radio ${A.q2_model === m.key ? 'on' : ''}" data-action="mla-q2model" data-model="${esc(m.key)}">${A.q2_model === m.key ? '◉' : '○'} ${esc(m.key)}</button>`).join('');
    body += `<div class="mla-field-label">② 모델</div><div class="mla-radio-row wrap">${modelRadios}</div>
      <div class="mla-field-label">고른 이유 (유형·모델을 위 표의 특징과 연결해)</div>
      <textarea class="aia-field-area" data-action="mla-input" data-fid="q2_why" rows="3" placeholder="유형을 고른 이유와, 모델을 고른 이유를 적어보세요.">${esc(A.q2_why || '')}</textarea>`;

    // 문항 3
    body += `<div class="mla-q-head">문항 3. 선택한 모델로 해결하는 방안 <span class="mla-pt">[5점]</span></div>
      <div class="ml-sub-explain">데이터를 어디서 모으고 어떻게 손질하는지는 쓰지 않아도 됩니다.</div>
      <div class="mla-q3">
        <div class="mla-q3-row"><span class="mla-q3-k">① 입력 (모델에 넣을 특징)</span>
          <textarea class="aia-field-area" data-action="mla-input" data-fid="q3_input" rows="2" placeholder="이 문제에서 무엇을 보고 판단·예측하게 할까?">${esc(A.q3_input || '')}</textarea></div>
        <div class="mla-q3-row"><span class="mla-q3-k">② 출력 (모델이 내놓을 결과)</span>
          <textarea class="aia-field-area" data-action="mla-input" data-fid="q3_output" rows="2" placeholder="예측값·분류 결과·그룹 중 무엇을 내놓게 할까?">${esc(A.q3_output || '')}</textarea></div>
        <div class="mla-q3-row"><span class="mla-q3-k">③ 기대 효과</span>
          <textarea class="aia-field-area" data-action="mla-input" data-fid="q3_effect" rows="2" placeholder="이 모델 덕분에 문제 상황이 어떻게 나아지나?">${esc(A.q3_effect || '')}</textarea></div>
      </div>`;
  }

  const saveState = MLA_SAVING === 'save' ? '<span class="aia-meta saving">💾 저장 중…</span>'
    : MLA_SAVING === 'submit' ? '<span class="aia-meta saving">📤 제출 중…</span>'
    : (MLA_SUB?.updatedAt ? `<span class="aia-meta">저장됨 · ${fmtDt(MLA_SUB.updatedAt)}</span>` : '');

  return `<div class="section">${head}${body}
    <div class="aia-submit-bar">
      ${saveState}
      <button class="btn-sm" data-action="mla-save" ${MLA_SAVING ? 'disabled' : ''}>💾 임시 저장</button>
      <button class="btn-p btn-sm" data-action="mla-submit" ${MLA_SAVING || !chosen ? 'disabled' : ''}>📤 제출하기</button>
    </div>
  </div>`;
}

// 응답 요약 (제출 완료/교사 열람 공용)
function _mlaAnswerSummary(a, compact){
  const isMine = a.sitId === 'mine';
  const sit = isMine ? null : mlaSituationById(a.sitId);
  const sitLbl = isMine ? '✍️ 나의 문제' : (sit ? `${sit.icon} 상황 ${sit.id.slice(1)} · ${esc(sit.field)} (${esc(sit.org)})` : '–');
  const taskLbl = m => {
    if(isMine || !sit) return m || '–';
    const i = MLA_MARKS.indexOf(m);
    return i >= 0 ? `${m} ${esc(sit.tasks[i])}` : (m || '–');
  };
  const q1ml = Array.isArray(a.q1_ml) && a.q1_ml.length ? a.q1_ml.map(taskLbl).join(' / ') : (isMine ? '(나의 문제)' : '(선택 없음)');
  const row = (k, v) => `<tr><th>${k}</th><td>${v || '<span style="color:var(--text3)">(무응답)</span>'}</td></tr>`;
  return `<table class="mlp-summary"><tbody>
    ${row('선택 상황', sitLbl)}
    ${isMine ? row('나의 문제', esc(a.mineProblem || '')) : ''}
    ${a.pickReason ? row('고른 이유', esc(a.pickReason)) : ''}
    ${row('문항1 · ML로 풀 일', isMine ? '' : esc(q1ml))}
    ${row('문항1 · 규칙형/이유', esc(a.q1_rule || ''))}
    ${row('문항2 · 깊게 풀 문제', isMine ? '(나의 문제)' : esc(taskLbl(a.q2_task)))}
    ${row('문항2 · 유형', esc(a.q2_type || ''))}
    ${row('문항2 · 모델', esc(a.q2_model || ''))}
    ${row('문항2 · 근거', esc(a.q2_why || ''))}
    ${row('문항3 · 입력', esc(a.q3_input || ''))}
    ${row('문항3 · 출력', esc(a.q3_output || ''))}
    ${row('문항3 · 기대효과', esc(a.q3_effect || ''))}
  </tbody></table>`;
}

/* ─────────── 선생님: 응시 관리·채점 ─────────── */

function vTcMlAssess(){
  const on = !!MLA_ACTIVE[TC_CLS?.id];
  if(MLA_TC_VIEW === 'student' && MLA_TC_SNUM) return _vTcMlaStudent();

  const toggle = `<div class="mla-tc-toggle ${on ? 'on' : ''}">
    <div><b>${on ? '🟢 응시 열림' : '⚪ 응시 닫힘'}</b> — ${on ? '학생 화면에 <b>📝 ML 수행평가</b> 탭이 보입니다.' : '학생에게 보이지 않아요. 시험 시간에 열어주세요.'}</div>
    <button class="btn-sm ${on ? '' : 'btn-p'}" data-action="mla-active-toggle">${on ? '응시 닫기' : '응시 열기'}</button>
  </div>`;

  const subs = MLA_ALL_SUBS || {};
  const written = STUDENTS.filter(s => subs[s.number]).length;
  const submitted = STUDENTS.filter(s => subs[s.number]?.submittedAt).length;
  const rows = STUDENTS.map(st => {
    const sub = subs[st.number];
    const a = sub?.answers || {};
    const sc = MLA_TC_SCORES[st.number] || {};
    const total = ['q1', 'q2', 'q3'].reduce((s, k) => s + (Number(sc[k]) || 0), 0);
    const hasScore = ['q1', 'q2', 'q3'].some(k => sc[k] != null && sc[k] !== '');
    const sitLbl = a.sitId === 'mine' ? '✍️ 나의 문제' : (a.sitId ? `상황 ${String(a.sitId).slice(1)}` : '–');
    return `<tr>
      <td>${esc(st.number)}</td><td>${esc(st.name)}</td>
      <td>${sub ? esc(sitLbl) : '<span style="color:var(--text3)">–</span>'}</td>
      <td>${sub?.submittedAt ? `<span class="chip chip-green">✓ 제출</span>` : (sub ? '<span class="chip">작성 중</span>' : '<span style="color:var(--text3)">미응시</span>')}</td>
      <td>${hasScore ? `<b>${total}</b>/15` : '<span style="color:var(--text3)">미채점</span>'}</td>
      <td><button class="btn-xs" data-action="mla-tc-view" data-snum="${esc(st.number)}">답안·채점 →</button></td>
    </tr>`;
  }).join('');

  return `<div class="aia-tc-head">
      <div class="aia-tc-head-title">📝 ${esc(MLA_META.title)} <span style="color:var(--text3);font-size:13px">· ${MLA_META.total}점</span></div>
      <button class="btn-sm" data-action="mla-tc-csv">📤 답안 CSV</button>
    </div>
    ${toggle}
    <div class="asmt-stat-grid">
      <div class="stat-card"><div class="stat-num">${STUDENTS.length}</div><div class="stat-label">전체</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#3b82f6">${written}</div><div class="stat-label">작성</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--ok)">${submitted}</div><div class="stat-label">제출</div></div>
    </div>
    <div class="ml-sub-explain">채점 기준은 <b>「수행평가_운영안·정답(교사용)」</b> 문서를 참고하세요. 점수는 <b>🏆 점수 관리</b>에도 자동 반영되고, 거기서 학생 공개 토글을 켤 수 있어요.</div>
    ${STUDENTS.length === 0 ? emptyBox('👥', '먼저 학생을 등록하세요.')
      : `<div style="overflow-x:auto"><table class="tbl aia-tc-table">
          <thead><tr><th>학번</th><th>이름</th><th>선택</th><th>제출</th><th>점수</th><th></th></tr></thead>
          <tbody>${rows}</tbody></table></div>`}`;
}

function _vTcMlaStudent(){
  const snum = MLA_TC_SNUM;
  const st = STUDENTS.find(s => s.number === snum);
  const sub = MLA_ALL_SUBS[snum];
  const back = `<div class="aia-tcs-header">
    <button class="btn-sm" data-action="mla-tc-back">← 목록</button>
    <div class="aia-tcs-info"><span class="aia-tcs-snum">${esc(snum)}</span><span class="aia-tcs-name">${esc(st?.name || '')}</span>
      ${sub?.submittedAt ? `<span class="chip chip-green">✓ 제출 ${fmtDt(sub.submittedAt)}</span>` : (sub ? '<span class="chip">작성 중</span>' : '<span class="chip">미응시</span>')}</div>
  </div>`;
  if(!sub) return back + emptyBox('📭', '아직 응시 기록이 없어요.');
  const a = sub.answers || {};
  const sc = MLA_TC_SCORES[snum] || {};
  const scoreInputs = MLA_PARTS.map(p => `<label class="mla-score-in">${esc(p.label)}
      <input type="number" min="0" max="${p.max}" step="1" value="${sc[p.key] != null ? esc(String(sc[p.key])) : ''}" data-action="mla-tc-score" data-key="${p.key}" placeholder="/${p.max}"/></label>`).join('');
  const total = ['q1', 'q2', 'q3'].reduce((s, k) => s + (Number(sc[k]) || 0), 0);
  const saving = MLA_TC_SAVING === snum;
  return back
    + `<div class="section aia-tcs-sec"><div class="aia-tcs-sec-title">📋 학생 답안</div>${_mlaAnswerSummary(a, false)}</div>`
    + `<div class="section aia-tcs-sec"><div class="aia-tcs-sec-title">⭐ 채점 (점수 관리에 자동 반영)</div>
        <div class="mla-score-row">${scoreInputs}<span class="mla-score-total">합계 <b>${total}</b>/15</span></div>
        <textarea class="sc-reason-area" data-action="mla-tc-comment" rows="2" placeholder="(선택) 학생에게 보일 종합 코멘트">${esc(sc.comment || '')}</textarea>
        <div style="margin-top:8px"><button class="btn-p btn-sm" data-action="mla-tc-savescore" ${saving ? 'disabled' : ''}>${saving ? '저장 중…' : '💾 점수 저장'}</button></div>
      </div>`;
}
