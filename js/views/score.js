/* ═══════════════════════════════════════
   views/score.js — 🏆 수행평가 점수 (학생 조회 + 선생님 관리)

   정의: assessment-data.js 의 ASMT_LIST (3개 수행평가)
   - 학생: ST_TAB === 'myscore' → vStMyScore()
   - 선생님: TC_TAB === 'scores' → vTcScores()

   데이터:
   - PET병(legacy): assessment/scores/{cid}/{학번} = {a,b,c,d, comment, scoredAt}
   - 빅데이터/AI(ext): assessment/scoresExt/{cid}/{학번}/{asmtId}
   - 공개 토글: assessment/published/{cid}/{asmtId}

   채점은:
   - PET병: 기존 "📝 수행평가" 탭의 학생 상세에서 (여기서는 조회만)
   - 빅데이터: 여기 학생 표에서 영역별 드롭다운으로 입력
   - AI: placeholder (자리만)
═══════════════════════════════════════ */

/* ─────────────────── 공통 유틸 ─────────────────── */

// 점수 객체에서 합계 계산. legacy(PET병) 와 ext 모두 처리.
function _scTotal(asmt, score){
  if(!score || !asmt || !asmt.parts.length) return null;
  let sum = 0, any = false;
  for(const p of asmt.parts){
    const v = score[p.key];
    if(typeof v === 'number'){ sum += v; any = true; }
  }
  return any ? sum : null;
}

// 한 자리 반올림
function _scRound(x){ return Math.round((Number(x) || 0) * 10) / 10; }

// 점수 표시 (예: "18/20"). 점수 없으면 placeholder
function _scLabel(asmt, score){
  const t = _scTotal(asmt, score);
  return t == null ? '–' : `${_scRound(t)}/${asmt.total}`;
}

// 색 클래스 (만점/거의/중간/낮음)
function _scTier(asmt, score){
  const t = _scTotal(asmt, score);
  if(t == null) return 'none';
  const r = t / asmt.total;
  if(r >= 0.95) return 'full';
  if(r >= 0.75) return 'good';
  if(r >= 0.5)  return 'mid';
  return 'low';
}

/* ═══════════════════════════════════════
   학생 — 📊 내 수행평가 점수 탭
═══════════════════════════════════════ */

function vStMyScore(){
  if(!ST_USER || !SEL_CLS) return emptyBox('🔒', '로그인이 필요합니다.');
  // MY_SCORES_PUB / MY_SCORES 는 setST('myscore') 에서 로드함
  if(MY_SCORES == null){
    return `<div class="sc-loading">⏳ 점수를 불러오는 중...</div>`;
  }

  const pub = MY_SCORES_PUB || { bigdata:false, petbottle:false, aicode:false };

  // 공개된 점수 합계
  let openSum = 0, openMax = 0;
  for(const a of ASMT_LIST){
    if(pub[a.id]){
      const t = _scTotal(a, MY_SCORES[a.id]);
      if(t != null){ openSum += t; openMax += a.total; }
    }
  }
  const anyOpen = Object.values(pub).some(v => v);

  const summary = `<div class="sc-stu-summary">
    <div class="sc-stu-sum-head">📊 내 수행평가 점수</div>
    <div class="sc-stu-sum-row">
      <div class="sc-stu-sum-total">
        <span class="sc-stu-sum-num">${anyOpen ? _scRound(openSum) : '–'}</span>
        <span class="sc-stu-sum-slash">/</span>
        <span class="sc-stu-sum-max">${anyOpen ? openMax : ASMT_TOTAL_ALL}</span>
      </div>
      <div class="sc-stu-sum-cap">${anyOpen
        ? `공개된 ${Object.values(pub).filter(v => v).length}개 수행평가 합계 (전체 만점 ${ASMT_TOTAL_ALL}점)`
        : `전체 ${ASMT_LIST.length}개 수행평가 (총 ${ASMT_TOTAL_ALL}점)`}</div>
    </div>
  </div>`;

  const reasonsPub = MY_REASONS_PUB || { bigdata:false, petbottle:false, aicode:false };
  const cards = ASMT_LIST.map(a => _vStMyScoreCard(a, MY_SCORES[a.id], pub[a.id], reasonsPub[a.id])).join('');

  return summary + cards + `<div class="sc-stu-foot">💡 점수는 선생님이 채점·공개한 뒤 표시됩니다. 궁금한 점은 선생님께 직접 문의하세요.</div>`;
}

// 카드 헤더 (부제는 비어있으면 안 보임)
function _vStMyScoreCardHead(asmt, totalLabel, tier){
  const subBlock = asmt.subtitle ? `<span class="sc-stu-card-sub">· ${esc(asmt.subtitle)}</span>` : '';
  const right = totalLabel
    ? `<span class="sc-stu-card-total tier-${tier}">${totalLabel}</span>`
    : `<span class="sc-stu-card-max">${asmt.total}점</span>`;
  return `<div class="sc-stu-card-head">
    <span class="sc-stu-card-icon">${asmt.icon}</span>
    <span class="sc-stu-card-title">${esc(asmt.title)}</span>
    ${subBlock}
    ${right}
  </div>`;
}

function _vStMyScoreCard(asmt, score, isPub, isReasonsPub){
  const tier = isPub ? _scTier(asmt, score) : 'closed';

  if(asmt.placeholder){
    return `<div class="sc-stu-card placeholder">
      ${_vStMyScoreCardHead(asmt, null, tier)}
      <div class="sc-stu-card-body">
        <div class="sc-stu-placeholder">🛠️ 준비 중인 수행평가입니다. 일정·세부 배점은 추후 안내됩니다.</div>
      </div>
    </div>`;
  }

  if(!isPub){
    return `<div class="sc-stu-card closed">
      ${_vStMyScoreCardHead(asmt, null, tier)}
      <div class="sc-stu-card-body">
        <div class="sc-stu-closed">🔒 아직 점수가 공개되지 않았어요. 선생님이 채점·공개하면 여기서 볼 수 있어요.</div>
      </div>
    </div>`;
  }

  // 공개됨 — 세부 배점 표시
  const t = _scTotal(asmt, score);
  if(t == null){
    return `<div class="sc-stu-card pending">
      ${_vStMyScoreCardHead(asmt, null, tier)}
      <div class="sc-stu-card-body">
        <div class="sc-stu-pending">⏳ 공개됐지만 아직 채점되지 않았어요.</div>
      </div>
    </div>`;
  }

  const reasons = (score && score.reasons) || {};
  const parts = asmt.parts.map(p => {
    const v = typeof score[p.key] === 'number' ? score[p.key] : null;
    const pct = v != null ? Math.min(100, Math.round(v / p.max * 100)) : 0;
    const cls = v == null ? 'none' : (v >= p.max ? 'full' : (v >= p.max * 0.75 ? 'good' : (v >= p.max * 0.5 ? 'mid' : 'low')));
    const reason = (reasons[p.key] || '').trim();
    // 영역별 사유는 isReasonsPub가 true일 때만 학생에게 표시
    const reasonHtml = (isReasonsPub && reason)
      ? `<div class="sc-part-reason">💬 ${esc(reason).replace(/\n/g,'<br>')}</div>`
      : '';
    return `<div class="sc-part">
      <div class="sc-part-head">
        <span class="sc-part-label">${esc(p.label)}</span>
        <span class="sc-part-val ${cls}">${v == null ? '–' : _scRound(v)}<span class="sc-part-max"> / ${p.max}</span></span>
      </div>
      <div class="sc-part-bar"><div class="sc-part-bar-fill ${cls}" style="width:${pct}%"></div></div>
      ${reasonHtml}
    </div>`;
  }).join('');

  const commentBlock = score.comment
    ? `<div class="sc-stu-comment"><b>💬 종합 코멘트</b><div>${esc(score.comment).replace(/\n/g,'<br>')}</div></div>`
    : '';

  return `<div class="sc-stu-card open tier-${tier}">
    ${_vStMyScoreCardHead(asmt, _scLabel(asmt, score), tier)}
    <div class="sc-stu-card-body">
      <div class="sc-parts">${parts}</div>
      ${commentBlock}
      ${score.scoredAt ? `<div class="sc-stu-meta">채점일: ${fmtDt(score.scoredAt)}</div>` : ''}
    </div>
  </div>`;
}

/* ═══════════════════════════════════════
   선생님 — 🏆 점수 관리 탭
═══════════════════════════════════════ */

function vTcScores(){
  if(!TC_CLS) return emptyBox('👆', '관리할 반을 먼저 선택하세요.');
  if(SC_LOADING) return `<div class="sc-loading">⏳ 점수를 불러오는 중...</div>`;

  // 수행평가 선택 칩
  const tabs = ASMT_LIST.map(a => {
    const isOn = SC_TC_ASMT === a.id;
    const pubOn = (SC_PUBLISHED[TC_CLS.id] || {})[a.id];
    const rpubOn = (SC_REASONS_PUB[TC_CLS.id] || {})[a.id];
    return `<button class="sc-tc-tab ${isOn ? 'on' : ''}" data-action="sc-tab" data-asmt="${a.id}">
      ${a.icon} ${esc(a.title)} <span class="sc-tc-tab-max">${a.total}점</span>
      ${pubOn ? '<span class="sc-tc-tab-pub" title="점수 공개 중">📤</span>' : ''}
      ${rpubOn ? '<span class="sc-tc-tab-pub" title="사유 공개 중">💬</span>' : ''}
    </button>`;
  }).join('');
  const overviewBtn = `<button class="sc-tc-tab ${SC_TC_ASMT === 'overview' ? 'on' : ''}" data-action="sc-tab" data-asmt="overview">
    🧾 종합 (${ASMT_TOTAL_ALL}점)
  </button>`;

  const tabBar = `<div class="sc-tc-tabbar">${tabs}${overviewBtn}</div>`;

  let body = '';
  if(SC_TC_ASMT === 'overview') body = _vTcScoreOverview();
  else body = _vTcScoreAsmt(asmtById(SC_TC_ASMT));

  return tabBar + body;
}

// 한 수행평가에 대한 학생별 채점 표
function _vTcScoreAsmt(asmt){
  if(!asmt) return emptyBox('❓', '수행평가를 선택하세요.');
  const cid = TC_CLS.id;
  const pub = (SC_PUBLISHED[cid] || {})[asmt.id];
  const noStudent = STUDENTS.length === 0;

  // 공개 토글 + 메타 (부제는 비어있으면 안 보임)
  const subHead = asmt.subtitle ? ` <span class="sc-tc-head-sub">· ${esc(asmt.subtitle)}</span>` : '';
  const reasonsPub = (SC_REASONS_PUB[cid] || {})[asmt.id];
  const reasonsToggleDisabled = !pub;  // 점수 공개 안 됐으면 사유 토글 비활성
  const header = `<div class="sc-tc-head">
    <div class="sc-tc-head-info">
      <div class="sc-tc-head-title">${asmt.icon} ${esc(asmt.title)}${subHead}</div>
      <div class="sc-tc-head-note">${esc(asmt.note || '')}</div>
    </div>
    <div class="sc-tc-toggles">
      <div class="sc-tc-toggle-row">
        <span class="sc-tc-toggle-label">점수</span>
        <div class="sc-tc-pub-seg">
          <button class="sc-tc-pub-btn ${!pub ? 'on' : ''}" data-action="sc-publish" data-asmt="${asmt.id}" data-on="0">🔒 비공개</button>
          <button class="sc-tc-pub-btn ${pub ? 'on pub' : ''}" data-action="sc-publish" data-asmt="${asmt.id}" data-on="1">📤 공개 (${esc(TC_CLS.label)})</button>
        </div>
      </div>
      <div class="sc-tc-toggle-row ${reasonsToggleDisabled ? 'disabled' : ''}" title="${reasonsToggleDisabled ? '점수를 먼저 공개해야 사유를 공개할 수 있어요' : ''}">
        <span class="sc-tc-toggle-label">사유</span>
        <div class="sc-tc-pub-seg">
          <button class="sc-tc-pub-btn ${!reasonsPub ? 'on' : ''}" data-action="sc-reasons-pub" data-asmt="${asmt.id}" data-on="0" ${reasonsToggleDisabled ? 'disabled' : ''}>🔒 사유 비공개</button>
          <button class="sc-tc-pub-btn ${reasonsPub ? 'on pub' : ''}" data-action="sc-reasons-pub" data-asmt="${asmt.id}" data-on="1" ${reasonsToggleDisabled ? 'disabled' : ''}>💬 사유 공개</button>
        </div>
      </div>
    </div>
  </div>`;

  if(asmt.placeholder){
    return header + `<div class="sc-tc-placeholder">🛠️ 이 수행평가는 아직 구체화되지 않았어요. 세부 배점·문항이 확정되면 채점 UI가 추가됩니다.
      <br>현재는 학생 화면에 "준비 중" 카드만 표시돼요.</div>`;
  }
  if(noStudent) return header + emptyBox('👥', '먼저 학생을 등록하세요.');

  // 데이터 묶음
  let scoresMap;
  if(asmt.storage === 'legacy'){
    // PET병: ASMT_ALL_SCORES (이미 로드되어 있을 수도 있고 아닐 수도) — 이 탭 진입 시 다시 로드함
    scoresMap = ASMT_ALL_SCORES || {};
  } else if(asmt.id === 'bigdata'){
    scoresMap = SC_BIGDATA_SCORES || {};
  } else {
    scoresMap = SC_AICODE_SCORES || {};
  }

  // 헤더 컬럼: 학번, 이름, [영역들], 합계, 코멘트, 저장
  const colHead = asmt.parts.map(p => `<th>${esc(p.label)}<br><span class="sc-col-max">/${p.max}</span></th>`).join('');

  const colSpanTotal = 2 + asmt.parts.length + 3; // 학번+이름+영역+합계+코멘트+저장

  const rows = STUDENTS.map(st => {
    const sc = scoresMap[st.number] || {};
    const total = _scTotal(asmt, sc);
    const cells = asmt.parts.map(p => _scInputCell(asmt, st.number, p, sc[p.key])).join('');
    const cmt = sc.comment || '';
    const saving = SC_SAVING_SNUM === st.number;
    const isExpanded = SC_EXPAND_SNUM === st.number && SC_EXPAND_ASMT === asmt.id;
    const reasons = sc.reasons || {};
    const hasAnyReason = asmt.parts.some(p => (reasons[p.key] || '').trim());

    const mainRow = `<tr class="sc-row ${isExpanded ? 'expanded' : ''}">
      <td class="sc-cell-num">${esc(st.number)}</td>
      <td class="sc-cell-name">
        <button class="sc-expand-btn ${isExpanded ? 'on' : ''}" data-action="sc-expand" data-snum="${esc(st.number)}" data-asmt="${asmt.id}" title="${isExpanded ? '접기' : '영역별 사유 입력/보기'}">${isExpanded ? '▼' : '▶'}</button>
        ${esc(st.name)}${hasAnyReason ? '<span class="sc-reason-dot" title="사유가 입력되어 있음">●</span>' : ''}
      </td>
      ${cells}
      <td class="sc-cell-total">${total == null ? '–' : `<b>${_scRound(total)}</b><span class="sc-cell-total-max">/${asmt.total}</span>`}</td>
      <td class="sc-cell-cmt">
        <input type="text" class="sc-cmt-in" data-action="sc-cmt" data-snum="${esc(st.number)}" data-asmt="${asmt.id}" value="${esc(cmt)}" placeholder="(선택) 종합 코멘트"/>
      </td>
      <td class="sc-cell-save">
        ${asmt.storage === 'legacy'
          ? `<button class="btn-xs" data-action="sc-goto-pet" data-snum="${esc(st.number)}" title="PET병 채점 화면으로 이동">채점 →</button>`
          : `<button class="btn-xs ${saving ? '' : 'btn-ok'}" data-action="sc-save" data-snum="${esc(st.number)}" data-asmt="${asmt.id}" ${saving ? 'disabled' : ''}>${saving ? '저장중...' : '💾 저장'}</button>`
        }
      </td>
    </tr>`;

    // 펼쳐진 사유 입력 행
    if(!isExpanded) return mainRow;

    const isLegacy = asmt.storage === 'legacy';
    const reasonRows = asmt.parts.map(p => {
      const reason = reasons[p.key] || '';
      return `<div class="sc-reason-row">
        <div class="sc-reason-label">${esc(p.label)}<span class="sc-col-max"> · /${p.max}</span></div>
        <textarea class="sc-reason-area" data-action="sc-reason" data-snum="${esc(st.number)}" data-asmt="${asmt.id}" data-key="${p.key}" placeholder="이 영역 점수를 준 이유를 적어주세요 (학생에게도 공개됨)" ${isLegacy ? 'readonly' : ''}>${esc(reason)}</textarea>
      </div>`;
    }).join('');
    const expandRow = `<tr class="sc-expand-tr">
      <td colspan="${colSpanTotal}" class="sc-expand-cell">
        <div class="sc-expand-box">
          <div class="sc-expand-head">📝 ${esc(st.name)}(${esc(st.number)}) — 영역별 점수 사유</div>
          <div class="sc-reason-list">${reasonRows}</div>
          ${isLegacy
            ? `<div class="sc-expand-foot">PET병 사유는 <b>📝 수행평가</b> 탭의 학생 상세 화면에서 입력하세요. 여기서는 조회만 가능합니다.</div>`
            : `<div class="sc-expand-foot">사유는 <b>💾 저장</b> 버튼을 누르면 함께 반영됩니다.</div>`
          }
        </div>
      </td>
    </tr>`;
    return mainRow + expandRow;
  }).join('');

  // 통계: 평균, 채점 완료 인원
  const scoredCount = STUDENTS.filter(st => _scTotal(asmt, scoresMap[st.number] || {}) != null).length;
  const avgRaw = STUDENTS.reduce((s, st) => {
    const t = _scTotal(asmt, scoresMap[st.number] || {});
    return t == null ? s : s + t;
  }, 0);
  const avg = scoredCount ? avgRaw / scoredCount : null;

  const helpText = asmt.storage === 'legacy'
    ? `<div class="sc-tc-help">PET병 점수는 <b>📝 수행평가</b> 탭의 학생 상세에서 직접 채점하세요. 여기서는 점수 확인·공개 토글·코멘트 수정만 가능합니다.</div>`
    : asmt.inputMode === 'rubric25'
      ? `<div class="sc-tc-help">각 영역을 <b>5/4/3/2점 중 선택</b>하세요 (미제출은 0점). 자세한 채점 기준은 <a href="https://firebasestorage.googleapis.com/v0/b/sindong-informatics.firebasestorage.app/o/notices%2Finfo-2A%2Fmnnyjr8symee8%2F%EB%B9%85%EB%8D%B0%EC%9D%B4%ED%84%B0%EB%B6%84%EC%84%9D_%EC%B1%84%EC%A0%90%EB%A3%A8%EB%B8%8C%EB%A6%AD.pdf?alt=media&token=67b22a04-0b98-4685-a4b6-22f1b38d0405" target="_blank">루브릭 PDF</a> 참고. 저장 버튼을 누르면 즉시 반영됩니다.</div>`
      : '';

  return header + helpText + `
    <div class="sc-tc-stat-grid">
      <div class="stat-card"><div class="stat-num">${STUDENTS.length}</div><div class="stat-label">전체 학생</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--ok)">${scoredCount}</div><div class="stat-label">채점 완료</div></div>
      <div class="stat-card"><div class="stat-num">${avg == null ? '–' : _scRound(avg)}<span style="font-size:13px;color:var(--text3)">/${asmt.total}</span></div><div class="stat-label">평균</div></div>
    </div>
    <div class="sc-tc-table-wrap">
      <table class="tbl sc-tc-table">
        <thead><tr>
          <th>학번</th><th>이름</th>${colHead}<th>합계</th><th>코멘트</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// 영역 점수 입력 셀
function _scInputCell(asmt, snum, part, value){
  const v = (typeof value === 'number') ? value : '';
  if(asmt.storage === 'legacy'){
    // PET병은 읽기 전용 (채점은 기존 탭에서)
    return `<td class="sc-cell-val">${v === '' ? '<span class="sc-cell-empty">–</span>' : _scRound(v)}</td>`;
  }
  if(asmt.inputMode === 'rubric25'){
    const opts = [
      ['',  '–'],
      ['0', '0 (미제출)'],
      ['2', '2'],
      ['3', '3'],
      ['4', '4'],
      ['5', '5'],
    ].map(([val, lbl]) => `<option value="${val}" ${String(v) === val ? 'selected' : ''}>${lbl}</option>`).join('');
    return `<td class="sc-cell-sel">
      <select class="sc-sel" data-action="sc-set" data-snum="${esc(snum)}" data-asmt="${asmt.id}" data-key="${part.key}">${opts}</select>
    </td>`;
  }
  // number input (fallback)
  return `<td class="sc-cell-num-in">
    <input type="number" min="0" max="${part.max}" step="0.5" class="sc-num" data-action="sc-set" data-snum="${esc(snum)}" data-asmt="${asmt.id}" data-key="${part.key}" value="${v}"/>
  </td>`;
}

// 종합 탭 — 학생별 3개 수행평가 합산
function _vTcScoreOverview(){
  const cid = TC_CLS.id;
  if(STUDENTS.length === 0) return emptyBox('👥', '먼저 학생을 등록하세요.');

  const pub = SC_PUBLISHED[cid] || {};
  // 점수 매핑 가져오기 (이미 로드됨)
  const map = {
    bigdata:   SC_BIGDATA_SCORES || {},
    petbottle: ASMT_ALL_SCORES   || {},
    aicode:    SC_AICODE_SCORES  || {},
  };

  const colHead = ASMT_LIST.map(a =>
    `<th>${a.icon} ${esc(a.title)}<br><span class="sc-col-max">/${a.total}</span></th>`
  ).join('');

  const rows = STUDENTS.map(st => {
    let stuSum = 0, anyScored = false;
    const cells = ASMT_LIST.map(a => {
      const sc = map[a.id][st.number];
      const t = _scTotal(a, sc);
      if(t != null){ stuSum += t; anyScored = true; }
      const p = pub[a.id] ? '<span class="sc-ov-pub" title="공개됨">📤</span>' : '';
      return `<td>${t == null ? '<span class="sc-cell-empty">–</span>' : `${_scRound(t)}<span class="sc-cell-total-max">/${a.total}</span>${p}`}</td>`;
    }).join('');
    return `<tr>
      <td class="sc-cell-num">${esc(st.number)}</td>
      <td class="sc-cell-name">${esc(st.name)}</td>
      ${cells}
      <td class="sc-cell-total">${anyScored ? `<b>${_scRound(stuSum)}</b><span class="sc-cell-total-max">/${ASMT_TOTAL_ALL}</span>` : '–'}</td>
    </tr>`;
  }).join('');

  // 반 평균 (각 수행평가별)
  const avgs = ASMT_LIST.map(a => {
    const scored = STUDENTS.map(st => _scTotal(a, map[a.id][st.number])).filter(v => v != null);
    if(!scored.length) return null;
    return scored.reduce((s, v) => s + v, 0) / scored.length;
  });

  return `<div class="sc-tc-help">전체 학생의 수행평가 현황을 한눈에 볼 수 있어요. 📤 표시는 학생에게 공개 중인 항목입니다. 점수 수정은 각 수행평가 탭에서 하세요.</div>
    <div class="sc-tc-table-wrap">
      <table class="tbl sc-tc-table sc-ov-table">
        <thead><tr>
          <th>학번</th><th>이름</th>${colHead}<th>총점</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="2" class="sc-ov-avg-label">📊 반 평균</td>
          ${avgs.map((avg, i) => `<td class="sc-ov-avg">${avg == null ? '–' : _scRound(avg)}<span class="sc-cell-total-max">/${ASMT_LIST[i].total}</span></td>`).join('')}
          <td class="sc-ov-avg">${(() => {
            const valid = avgs.filter(v => v != null);
            if(!valid.length) return '–';
            const sum = avgs.reduce((s, v, i) => v == null ? s : s + v, 0);
            return `${_scRound(sum)}<span class="sc-cell-total-max">/${ASMT_TOTAL_ALL}</span>`;
          })()}</td>
        </tr></tfoot>
      </table>
    </div>
    <div style="margin-top:14px;display:flex;gap:7px;flex-wrap:wrap">
      <button class="btn-sm" data-action="sc-export-csv">📤 종합 점수 CSV</button>
    </div>
  `;
}
