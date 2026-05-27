/* ═══════════════════════════════════════
   views/aiactivity.js — 🧠 인공지능 활동지

   정의: aiactivity-data.js 의 AIA_LIST
   학생: 활동 목록 → 풀이(자동 저장) → 제출
   선생님: 활동 목록 + active 토글 + 학생별 답안 확인 + CSV 내보내기
═══════════════════════════════════════ */

/* ─────────────────── 공통 ─────────────────── */

function _aiaSectionLabel(sec){
  if(sec.type === 'card-fields') return sec.title;
  if(sec.icon) return `${sec.icon} ${sec.title}`;
  return sec.title;
}

/* ═══════════════════════════════════════
   학생 — 🧠 AI 활동지 탭
═══════════════════════════════════════ */

function vStAiActivity(){
  if(!AIA_ACTIVE[SEL_CLS?.id]) return emptyBox('🔒', 'AI 활동지가 아직 열리지 않았어요. 선생님 안내를 기다려주세요.');
  if(!AIA_LIST.length) return emptyBox('📭', '등록된 활동이 없습니다.');

  if(AIA_VIEW === 'do' && AIA_SEL) return _vStAiaDo();

  // 활동 목록
  const cards = AIA_LIST.map(a => {
    return `<div class="aia-card click" data-action="aia-pick" data-aid="${esc(a.id)}">
      <div class="aia-card-icon">${a.icon || '🧠'}</div>
      <div class="aia-card-body">
        <div class="aia-card-sub">${esc(a.subtitle || '활동')}</div>
        <div class="aia-card-title">${esc(a.title)}</div>
        <div class="aia-card-intro">${esc((a.intro || '').slice(0, 80))}${(a.intro || '').length > 80 ? '…' : ''}</div>
      </div>
      <div class="aia-card-arrow">→</div>
    </div>`;
  }).join('');

  return `<div class="section">
    <div class="sec-title">🧠 인공지능 활동지</div>
    <div class="aia-list">${cards}</div>
  </div>`;
}

function _vStAiaDo(){
  const act = AIA_SEL;
  const sections = (act.sections || []).map(_vStAiaSection).join('');
  const submitted = !!AIA_SUB?.submittedAt;
  const updatedLabel = AIA_SUB?.updatedAt
    ? `<span class="aia-meta">마지막 저장: ${fmtDt(AIA_SUB.updatedAt)}</span>`
    : '<span class="aia-meta">아직 저장된 답안이 없어요</span>';
  const savingChip = AIA_SAVING === 'save' ? '<span class="aia-meta saving">💾 저장 중...</span>'
                   : AIA_SAVING === 'submit' ? '<span class="aia-meta saving">📤 제출 중...</span>' : '';
  const submitChip = submitted
    ? `<span class="aia-submit-chip done">✓ 제출 완료 · ${fmtDt(AIA_SUB.submittedAt)}</span>`
    : `<span class="aia-submit-chip pending">⏳ 아직 제출하지 않음</span>`;

  // 상단·하단 모두 같은 정보. 학생이 위에서 한눈에 보고, 다 작성하면 하단에서 제출.
  const topBar = `<div class="aia-do-statusbar">
    ${submitChip}
    ${submitted ? '<span class="aia-meta" style="margin-left:6px">자유롭게 수정 후 다시 제출할 수 있어요</span>' : ''}
  </div>`;

  return `<div class="back-btn" data-action="aia-back">← 활동 목록으로</div>
    <div class="section aia-do-head">
      <div class="aia-do-title">${act.icon || '🧠'} ${esc(act.subtitle || '활동')} — ${esc(act.title)}</div>
      ${act.intro ? `<div class="aia-do-intro">${esc(act.intro)}</div>` : ''}
      ${topBar}
    </div>
    ${sections}
    <div class="aia-do-foot">
      ${updatedLabel}
      ${savingChip}
      <button class="btn-sm" data-action="aia-save" ${AIA_SAVING ? 'disabled' : ''}>💾 임시 저장</button>
      <button class="btn-p btn-sm" data-action="aia-submit" ${AIA_SAVING ? 'disabled' : ''}>${submitted ? '🔁 다시 제출하기' : '📤 제출하기'}</button>
    </div>`;
}

function _vStAiaSection(sec){
  if(sec.type === 'card-fields'){
    const rows = (sec.fields || []).map(f => {
      const v = AIA_ANSWERS[f.id] || '';
      // rows=1 인 필드는 input(한 줄), 나머지는 textarea
      const inputHtml = (f.rows === 1)
        ? `<input type="text" class="aia-field-area aia-field-input" data-action="aia-input" data-fid="${esc(f.id)}" placeholder="${esc(f.placeholder || '')}" value="${esc(v)}"/>`
        : `<textarea class="aia-field-area" data-action="aia-input" data-fid="${esc(f.id)}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
      return `<div class="aia-field">
        <div class="aia-field-label">${f.icon ? f.icon + ' ' : ''}${esc(f.label)}</div>
        ${inputHtml}
      </div>`;
    }).join('');
    return `<div class="section aia-sec">
      <div class="aia-sec-title">${esc(sec.title)}</div>
      <div class="aia-fields">${rows}</div>
    </div>`;
  }
  if(sec.type === 'single-text' || sec.type === 'rich-text'){
    const v = AIA_ANSWERS[sec.id] || '';
    return `<div class="section aia-sec">
      <div class="aia-sec-title">${sec.icon ? sec.icon + ' ' : ''}${esc(sec.title)}</div>
      <textarea class="aia-field-area aia-field-single" data-action="aia-input" data-fid="${esc(sec.id)}" rows="${sec.rows || 3}" placeholder="${esc(sec.placeholder || '')}">${esc(v)}</textarea>
    </div>`;
  }
  return '';
}

/* ═══════════════════════════════════════
   선생님 — 🧠 AI 활동지 관리
═══════════════════════════════════════ */

function vTcAiActivity(){
  if(!TC_CLS) return emptyBox('👆', '관리할 반을 먼저 선택하세요.');
  if(AIA_VIEW === 'tcStudent' && AIA_SEL && AIA_TC_SEL_SNUM) return _vTcAiaStudent();

  const active = !!AIA_ACTIVE[TC_CLS.id];
  const toggle = `<div class="asmt-phase-seg">
    <button class="asmt-phase-btn ${!active ? 'on' : ''}" data-action="aia-set-active" data-on="0">🔒 닫기</button>
    <button class="asmt-phase-btn ${active ? 'on prep' : ''}" data-action="aia-set-active" data-on="1">📖 열기</button>
  </div>`;

  const phaseRow = `<div class="asmt-phase-row">
    <div class="asmt-phase-info">
      <div class="asmt-phase-title">🧠 인공지능 활동지 탭</div>
      <div class="asmt-phase-cur">${active
        ? '<b style="color:var(--ok)">● 열림</b> — 학생 화면에 "🧠 AI 활동지" 탭이 보여요.'
        : '<b style="color:var(--text3)">● 닫힘</b> — 학생 화면에 보이지 않습니다. (제출은 보존)'}</div>
    </div>
    ${toggle}
  </div>`;

  if(AIA_SEL){
    return phaseRow + _vTcAiaStudentList();
  }

  // 활동 목록 (선택용)
  if(!AIA_LIST.length) return phaseRow + emptyBox('📭', '등록된 활동이 없습니다. js/aiactivity-data.js 에 활동을 추가하세요.');

  const cards = AIA_LIST.map(a => {
    return `<div class="aia-card click" data-action="aia-tc-pick" data-aid="${esc(a.id)}">
      <div class="aia-card-icon">${a.icon || '🧠'}</div>
      <div class="aia-card-body">
        <div class="aia-card-sub">${esc(a.subtitle || '활동')}</div>
        <div class="aia-card-title">${esc(a.title)}</div>
        <div class="aia-card-intro">${esc((a.intro || '').slice(0, 80))}${(a.intro || '').length > 80 ? '…' : ''}</div>
      </div>
      <div class="aia-card-arrow">→</div>
    </div>`;
  }).join('');

  return phaseRow + `<div class="section">
    <div class="sec-title">활동 목록</div>
    <div class="aia-list">${cards}</div>
  </div>`;
}

function _vTcAiaStudentList(){
  const act = AIA_SEL;
  const subs = AIA_ALL_SUBS || {};
  const fieldIds = aiaFieldIds(act);

  const rows = STUDENTS.map(st => {
    const sub = subs[st.number];
    const answers = sub?.answers || {};
    const filled = fieldIds.filter(fid => (answers[fid] || '').trim()).length;
    const pct = fieldIds.length ? Math.round(filled / fieldIds.length * 100) : 0;
    const submitted = !!sub?.submittedAt;
    return `<tr>
      <td>${esc(st.number)}</td>
      <td>${esc(st.name)}</td>
      <td>
        <span class="aia-fill-chip ${pct === 100 ? 'full' : pct >= 50 ? 'mid' : pct > 0 ? 'low' : 'none'}">${filled}/${fieldIds.length}</span>
        <div class="sbar" style="width:80px;display:inline-block;margin-left:6px;vertical-align:middle"><div class="sbar-fill" style="width:${pct}%"></div></div>
      </td>
      <td>${submitted
        ? `<span class="aia-submit-chip done">✓ 제출</span><div style="font-size:10px;color:var(--text3);margin-top:2px">${fmtDt(sub.submittedAt)}</div>`
        : sub
          ? '<span class="aia-submit-chip pending">⏳ 미제출</span>'
          : '<span style="color:var(--text3)">–</span>'}</td>
      <td>${sub?.updatedAt ? fmtDt(sub.updatedAt) : '<span style="color:var(--text3)">미작성</span>'}</td>
      <td><button class="btn-xs" data-action="aia-tc-view" data-snum="${esc(st.number)}" ${sub ? '' : 'disabled'}>보기</button></td>
    </tr>`;
  }).join('');

  const writtenCount = STUDENTS.filter(st => subs[st.number]?.updatedAt).length;
  const submittedCount = STUDENTS.filter(st => subs[st.number]?.submittedAt).length;

  return `<div class="aia-tc-head">
    <button class="btn-sm" data-action="aia-tc-back">← 활동 선택으로</button>
    <div class="aia-tc-head-title">${act.icon || '🧠'} ${esc(act.title)}</div>
    <button class="btn-sm" data-action="aia-export-csv">📤 답안 CSV</button>
  </div>
  <div class="asmt-stat-grid">
    <div class="stat-card"><div class="stat-num">${STUDENTS.length}</div><div class="stat-label">전체 학생</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#3b82f6">${writtenCount}</div><div class="stat-label">작성 중·작성함</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--ok)">${submittedCount}</div><div class="stat-label">제출 완료</div></div>
  </div>
  ${STUDENTS.length === 0
    ? emptyBox('👥', '먼저 학생을 등록하세요.')
    : `<div style="overflow-x:auto"><table class="tbl aia-tc-table">
        <thead><tr><th>학번</th><th>이름</th><th>작성률</th><th>제출</th><th>마지막 저장</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`
  }`;
}

function _vTcAiaStudent(){
  const act = AIA_SEL;
  const snum = AIA_TC_SEL_SNUM;
  const st = STUDENTS.find(s => s.number === snum);
  const sub = AIA_ALL_SUBS[snum] || null;
  if(!st) return emptyBox('❓', `학번 ${snum} 학생을 찾을 수 없어요.`);

  const back = `<div class="aia-tcs-header">
    <button class="btn-sm" data-action="aia-tc-back-list">← 학생 목록</button>
    <div class="aia-tcs-info">
      <span class="aia-tcs-snum">${esc(st.number)}</span>
      <span class="aia-tcs-name">${esc(st.name)}</span>
      ${sub?.submittedAt
        ? `<span class="chip chip-green">✓ 제출 ${fmtDt(sub.submittedAt)}</span>`
        : sub
          ? '<span class="chip" style="background:#f59e0b;color:#fff">⏳ 미제출(작성 중)</span>'
          : '<span class="chip">미작성</span>'}
      ${sub?.updatedAt && sub?.submittedAt && sub.updatedAt !== sub.submittedAt
        ? `<span class="chip" style="font-size:10px">마지막 수정 ${fmtDt(sub.updatedAt)}</span>`
        : ''}
    </div>
  </div>`;

  if(!sub){
    return back + emptyBox('📭', '아직 작성된 답안이 없어요.');
  }

  const answers = sub.answers || {};
  const sections = (act.sections || []).map(sec => {
    if(sec.type === 'card-fields'){
      const rows = (sec.fields || []).map(f => {
        const v = (answers[f.id] || '').trim();
        return `<div class="aia-tcs-field">
          <div class="aia-tcs-label">${f.icon ? f.icon + ' ' : ''}${esc(f.label)}</div>
          <pre class="aia-tcs-val${v ? '' : ' empty'}">${v ? esc(v) : '(무응답)'}</pre>
        </div>`;
      }).join('');
      return `<div class="section aia-tcs-sec">
        <div class="aia-tcs-sec-title">${esc(sec.title)}</div>
        <div class="aia-tcs-fields">${rows}</div>
      </div>`;
    }
    if(sec.type === 'single-text' || sec.type === 'rich-text'){
      const v = (answers[sec.id] || '').trim();
      return `<div class="section aia-tcs-sec">
        <div class="aia-tcs-sec-title">${sec.icon ? sec.icon + ' ' : ''}${esc(sec.title)}</div>
        <pre class="aia-tcs-val${v ? '' : ' empty'}">${v ? esc(v) : '(무응답)'}</pre>
      </div>`;
    }
    return '';
  }).join('');

  return back + sections;
}
