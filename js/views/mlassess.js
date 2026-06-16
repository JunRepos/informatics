/* ═══════════════════════════════════════
   views/mlassess.js — 📝 ML 수행평가 (디지털 활동지 · 개방형 v4)
   학생 응시(vStMlAssess) + 선생님 응시관리·채점(vTcMlAssess) + 상황·루브릭 편집(_vTcMlaEdit)
   비계(정오 피드백·길잡이) 없음 — 순수 수합. 채점은 교사용 정답 문서로.
═══════════════════════════════════════ */

function _mlaScenePs(scene){
  return String(scene || '').split(/\n+/).filter(p => p.trim())
    .map(p => `<p>${esc(p)}</p>`).join('');
}

// 문항별 학생 채점 기준(루브릭) 드롭다운 — ⚠️ 정답 없음. 5·4·3·2점 표.
function mlaRubricBox(cid, qkey){
  const r = mlaRubricFor(cid, qkey);
  const rows = MLA_RUBRIC_LEVELS.map(pk => `<tr><th>${MLA_RUBRIC_PTS[pk]}</th><td>${esc(r[pk])}</td></tr>`).join('');
  return `<details class="mla-rubric"><summary>📊 채점 기준 보기 (5점 만점 ~ 2점)</summary>
    <div class="mla-rubric-body"><table class="tbl mla-rubric-tbl"><tbody>${rows}</tbody></table></div></details>`;
}

/* ─────────── 학생 응시 ─────────── */

function vStMlAssess(){
  if(MLA_LOADING){
    return `<div class="section"><div class="ml-sub-explain">⏳ 내 응시 기록을 불러오는 중…</div></div>`;
  }
  const cid = SEL_CLS?.id;
  const A = MLA_ANSWERS;
  const submitted = !!MLA_SUB?.submittedAt;
  const isMine = A.sitId === 'mine';
  const sit = isMine ? null : mlaEffSit(cid, A.sitId);
  const chosen = !!A.sitId;
  const sits = mlaEffSituations(cid);
  const Q = mlaEffQ(cid);
  const subHtml = s => esc(s || '').replace(/\n/g, '<br>');

  const head = `<div class="mla-head">
    <div>
      <div class="mla-title">📝 ${esc(MLA_META.title)}</div>
      <div class="mla-sub">배점 <b>${MLA_META.total}점</b> · 권장 ${MLA_META.minutes}분 · ${esc(mlaEffIntro(cid))}</div>
    </div>
    ${submitted ? '<span class="aia-submit-chip done">✓ 제출 완료</span>' : '<span class="aia-submit-chip pending">⏳ 작성 중</span>'}
  </div>`;

  if(submitted){
    return `<div class="section">${head}
      <div class="mlp-feedback ok">✅ 제출이 완료되었습니다. 수정이 필요하면 선생님께 말씀하세요.</div>
      ${_mlaAnswerSummary(A, true, cid)}
    </div>`;
  }

  // 상황 선택 그리드
  const cards = sits.map(s => `<button class="mla-sit-card ${A.sitId === s.id ? 'on' : ''}" data-action="mla-pick-sit" data-sit="${s.id}">
      <span class="mla-sit-ic">${s.icon}</span>
      <span class="mla-sit-tx"><b>상황 ${s.id.slice(1)}</b> · ${esc(s.field)}<small>${esc(s.org)}</small></span>
    </button>`).join('');
  const mineCard = `<button class="mla-sit-card mine ${isMine ? 'on' : ''}" data-action="mla-mine">
      <span class="mla-sit-ic">✍️</span><span class="mla-sit-tx"><b>나의 문제</b> · 직접 정하기<small>내 진로의 문제를 직접</small></span></button>`;

  let body = `<div class="mla-q-head">📂 상황 고르기</div>
    <div class="mla-sit-grid">${cards}${mineCard}</div>`;

  if(chosen){
    if(isMine){
      body += `<div class="mla-dossier mine">
        <div class="mla-dossier-tag">✍️ 나의 문제</div>
        <div class="ml-sub-explain">내 진로·관심 분야에서 <b>기계학습으로 풀고 싶은 문제</b>를 직접 정해 적어보세요. (문항 1은 "내 문제가 기계학습에 적합한 이유"로 답하면 됩니다.)</div>
        <textarea class="aia-field-area mla-answer" data-action="mla-input" data-fid="mineProblem" rows="3" placeholder="여기에 작성하세요">${esc(A.mineProblem || '')}</textarea>
      </div>`;
    } else {
      body += `<div class="mla-dossier">
        <div class="mla-dossier-tag">📋 상황 ${sit.id.slice(1)} · ${esc(sit.field)}</div>
        <div class="mla-dossier-org">${sit.icon} ${esc(sit.title)}</div>
        <div class="mla-dossier-scene">${_mlaScenePs(sit.scene)}</div>
        <div class="mla-derive-hint">💡 이 상황 속 ‘하고 싶은 일’ 중에서 <b>기계학습으로 풀 수 있는 일을 직접 찾아내는</b> 것이 여러분의 일이에요.</div>
      </div>`;
    }

    // 표지: 고른 이유 (비채점)
    body += `<div class="mla-why-pick">
      <span class="mla-why-pick-l">🧭 이 상황을 고른 이유 <small>(나의 진로·관심과 어떻게 이어지나요? 채점에 들어가지 않아요)</small></span>
      <input type="text" class="sc-cmt-in" data-action="mla-input" data-fid="pickReason" value="${esc(A.pickReason || '')}" placeholder="한 줄로 적어보세요"/>
    </div>`;

    // 문항 1
    body += `<div class="mla-q-head">문항 1. ${esc(Q.q1head)} <span class="mla-pt">[5점]</span></div>${mlaRubricBox(cid, 'q1')}`;
    if(isMine){
      body += `<div class="ml-sub-explain">내가 정한 문제가 <b>기계학습으로 풀기에 적합한지</b> 판단하고, 그 이유를 적으세요. (규칙·계산으로 충분한 문제라면 그렇게 판단해도 됩니다.)</div>
        <div class="mla-field-label">✏️ 답안</div>
        <textarea class="aia-field-area mla-answer" data-action="mla-input" data-fid="q1_ml" rows="4" placeholder="여기에 작성하세요">${esc(A.q1_ml || '')}</textarea>`;
    } else {
      body += `<div class="ml-sub-explain">${subHtml(Q.q1sub)}</div>
        <div class="mla-field-label">✏️ ${esc(Q.q1aLabel)}</div>
        <textarea class="aia-field-area mla-answer" data-action="mla-input" data-fid="q1_a" rows="3" placeholder="여기에 작성하세요">${esc(A.q1_a || '')}</textarea>
        <div class="mla-field-label">✏️ ${esc(Q.q1bLabel)}</div>
        <textarea class="aia-field-area mla-answer" data-action="mla-input" data-fid="q1_b" rows="3" placeholder="여기에 작성하세요">${esc(A.q1_b || '')}</textarea>`;
    }

    // 문항 2
    body += `<div class="mla-q-head">문항 2. ${esc(Q.q2head)} <span class="mla-pt">[5점]</span></div>${mlaRubricBox(cid, 'q2')}
      <div class="ml-sub-explain">${subHtml(Q.q2sub)}</div>
      <div class="mla-field-label">✏️ ${isMine ? '내 문제 중 ' : ''}${esc(Q.q2pickLabel)}</div>
      <textarea class="aia-field-area mla-answer" data-action="mla-input" data-fid="q2_pick" rows="2" placeholder="여기에 작성하세요">${esc(A.q2_pick || '')}</textarea>`;
    const typeRadios = MLA_TYPES.map(t => `<button class="mla-radio ${A.q2_type === t ? 'on' : ''}" data-action="mla-q2type" data-type="${esc(t)}">${A.q2_type === t ? '◉' : '○'} ${esc(t)}</button>`).join('');
    body += `<div class="mla-field-label">${esc(Q.q2typeLabel)}</div><div class="mla-radio-row">${typeRadios}</div>`;
    const modelRadios = MLA_MODELS.map(m => `<button class="mla-radio ${A.q2_model === m.key ? 'on' : ''}" data-action="mla-q2model" data-model="${esc(m.key)}">${A.q2_model === m.key ? '◉' : '○'} ${esc(m.key)}</button>`).join('');
    body += `<div class="mla-field-label">${esc(Q.q2modelLabel)}</div><div class="mla-radio-row wrap">${modelRadios}</div>
      <div class="mla-field-label">✏️ ${esc(Q.q2whyLabel)}</div>
      <textarea class="aia-field-area mla-answer" data-action="mla-input" data-fid="q2_why" rows="3" placeholder="여기에 작성하세요">${esc(A.q2_why || '')}</textarea>`;

    // 문항 3
    body += `<div class="mla-q-head">문항 3. ${esc(Q.q3head)} <span class="mla-pt">[5점]</span></div>${mlaRubricBox(cid, 'q3')}
      <div class="ml-sub-explain">${subHtml(Q.q3sub)}</div>
      <div class="mla-q3">
        <div class="mla-q3-row"><span class="mla-q3-k">✏️ ${esc(Q.q3inLabel)}</span>
          <textarea class="aia-field-area mla-answer" data-action="mla-input" data-fid="q3_input" rows="2" placeholder="여기에 작성하세요">${esc(A.q3_input || '')}</textarea></div>
        <div class="mla-q3-row"><span class="mla-q3-k">✏️ ${esc(Q.q3outLabel)}</span>
          <textarea class="aia-field-area mla-answer" data-action="mla-input" data-fid="q3_output" rows="2" placeholder="여기에 작성하세요">${esc(A.q3_output || '')}</textarea></div>
        <div class="mla-q3-row"><span class="mla-q3-k">✏️ ${esc(Q.q3effLabel)}</span>
          <textarea class="aia-field-area mla-answer" data-action="mla-input" data-fid="q3_effect" rows="2" placeholder="여기에 작성하세요">${esc(A.q3_effect || '')}</textarea></div>
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
function _mlaAnswerSummary(a, compact, cid){
  const isMine = a.sitId === 'mine';
  const sit = isMine ? null : mlaSituationById(a.sitId, cid);
  const sitLbl = isMine ? '✍️ 나의 문제' : (sit ? `${sit.icon} 상황 ${sit.id.slice(1)} · ${esc(sit.field)} (${esc(sit.org)})` : '–');
  const row = (k, v) => `<tr><th>${k}</th><td>${v || '<span style="color:var(--text3)">(무응답)</span>'}</td></tr>`;
  // 문항1: 신규(q1_a/q1_b) 우선, 옛 응답(q1_ml/q1_rule) 호환
  let q1rows;
  if(isMine){
    q1rows = row('문항1 · ML 적합 판단', esc(a.q1_ml || ''));
  } else if(a.q1_a != null || a.q1_b != null){
    q1rows = row('문항1 · 찾은 ML ①', esc(a.q1_a || '')) + row('문항1 · 찾은 ML ②', esc(a.q1_b || ''));
  } else {
    q1rows = row('문항1 · 찾은 ML 과제', esc(a.q1_ml || '')) + (a.q1_rule ? row('문항1 · 규칙형/이유', esc(a.q1_rule)) : '');
  }
  return `<table class="mlp-summary"><tbody>
    ${row('선택 상황', sitLbl)}
    ${isMine ? row('나의 문제', esc(a.mineProblem || '')) : ''}
    ${a.pickReason ? row('고른 이유', esc(a.pickReason)) : ''}
    ${q1rows}
    ${row('문항2 · 깊게 풀 문제', esc(a.q2_pick || ''))}
    ${row('문항2 · 유형', esc(a.q2_type || ''))}
    ${row('문항2 · 모델', esc(a.q2_model || ''))}
    ${row('문항2 · 이유·작동방식', esc(a.q2_why || ''))}
    ${row('문항3 · 입력', esc(a.q3_input || ''))}
    ${row('문항3 · 출력', esc(a.q3_output || ''))}
    ${row('문항3 · 기대효과', esc(a.q3_effect || ''))}
  </tbody></table>`;
}

/* ─────────── 선생님: 응시 관리·채점 ─────────── */

function vTcMlAssess(){
  if(MLA_TC_VIEW === 'edit') return _vTcMlaEdit();
  if(MLA_TC_VIEW === 'student' && MLA_TC_SNUM) return _vTcMlaStudent();

  const on = !!MLA_ACTIVE[TC_CLS?.id];
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

  const edited = !!MLA_CONFIG[TC_CLS?.id]?.updatedAt;
  return `<div class="aia-tc-head">
      <div class="aia-tc-head-title">📝 ${esc(MLA_META.title)} <span style="color:var(--text3);font-size:13px">· ${MLA_META.total}점 · 개방형</span></div>
      <div style="display:flex;gap:6px">
        <button class="btn-sm" data-action="mla-tc-edit">✏️ 상황·루브릭 편집${edited ? ' <span class="chip chip-green" style="margin-left:4px">수정됨</span>' : ''}</button>
        <button class="btn-sm" data-action="mla-tc-csv">📤 답안 CSV</button>
      </div>
    </div>
    ${toggle}
    <div class="asmt-stat-grid">
      <div class="stat-card"><div class="stat-num">${STUDENTS.length}</div><div class="stat-label">전체</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#3b82f6">${written}</div><div class="stat-label">작성</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--ok)">${submitted}</div><div class="stat-label">제출</div></div>
    </div>
    <div class="ml-sub-explain">채점 기준은 <b>「운영안·정답(교사용) v4」</b> 문서를 참고하세요. 점수는 <b>🏆 점수 관리</b>에도 자동 반영되고, 거기서 학생 공개 토글을 켤 수 있어요.</div>
    ${STUDENTS.length === 0 ? emptyBox('👥', '먼저 학생을 등록하세요.')
      : `<div style="overflow-x:auto"><table class="tbl aia-tc-table">
          <thead><tr><th>학번</th><th>이름</th><th>선택</th><th>제출</th><th>점수</th><th></th></tr></thead>
          <tbody>${rows}</tbody></table></div>`}`;
}

function _vTcMlaStudent(){
  const snum = MLA_TC_SNUM;
  const cid = TC_CLS?.id;
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
    + `<div class="section aia-tcs-sec"><div class="aia-tcs-sec-title">📋 학생 답안</div>${_mlaAnswerSummary(a, false, cid)}</div>`
    + `<div class="section aia-tcs-sec"><div class="aia-tcs-sec-title">⭐ 채점 (점수 관리에 자동 반영)</div>
        <div class="mla-score-row">${scoreInputs}<span class="mla-score-total">합계 <b>${total}</b>/15</span></div>
        <textarea class="sc-reason-area" data-action="mla-tc-comment" rows="2" placeholder="(선택) 학생에게 보일 종합 코멘트">${esc(sc.comment || '')}</textarea>
        <div style="margin-top:8px"><button class="btn-p btn-sm" data-action="mla-tc-savescore" ${saving ? 'disabled' : ''}>${saving ? '저장 중…' : '💾 점수 저장'}</button></div>
      </div>`;
}

/* ─────────── 선생님: 상황·안내·학생용 루브릭 편집 ─────────── */
function _vTcMlaEdit(){
  const d = MLA_EDIT_DRAFT || {};
  const sitMap = d.situations || {};
  const sitBlocks = MLA_SITUATIONS.map(s => {
    const ov = sitMap[s.id] || {};
    const title = ov.title != null ? ov.title : s.title;
    const scene = ov.scene != null ? ov.scene : s.scene;
    return `<div class="mla-edit-sit">
      <div class="mla-edit-sit-h">${s.icon} 상황 ${s.id.slice(1)} · ${esc(s.field)}</div>
      <label class="mla-edit-label">제목</label>
      <input type="text" class="sc-cmt-in" data-action="mla-edit-input" data-field="${s.id}.title" value="${esc(title)}"/>
      <label class="mla-edit-label">상황 글 <small>(빈 줄로 문단을 나눠요)</small></label>
      <textarea class="aia-field-area mla-edit-scene" data-action="mla-edit-input" data-field="${s.id}.scene" rows="9">${esc(scene)}</textarea>
    </div>`;
  }).join('');
  const intro = d.intro != null ? d.intro : MLA_INTRO_DEFAULT;
  const rd = d.rubric || {};
  const rv = (qk, pk) => (rd[qk] && rd[qk][pk] != null) ? rd[qk][pk] : MLA_RUBRIC_DEFAULT[qk][pk];
  const rBlock = (title, qk) => `<div class="mla-edit-q"><div class="mla-edit-sit-h">${title} 채점 기준</div>` +
    MLA_RUBRIC_LEVELS.map(pk => `<label class="mla-edit-label">${MLA_RUBRIC_PTS[pk]}</label>` +
      `<textarea class="aia-field-area" data-action="mla-edit-input" data-field="rubric.${qk}.${pk}" rows="2">${esc(rv(qk, pk))}</textarea>`).join('') + `</div>`;
  const qd = d.q || {};
  const qv = k => qd[k] != null ? qd[k] : MLA_Q_DEFAULT[k];
  const qField = (label, key, area) => `<label class="mla-edit-label">${label}</label>` + (area
    ? `<textarea class="aia-field-area" data-action="mla-edit-input" data-field="q.${key}" rows="3">${esc(qv(key))}</textarea>`
    : `<input type="text" class="sc-cmt-in" data-action="mla-edit-input" data-field="q.${key}" value="${esc(qv(key))}"/>`);
  const qBlock = (title, fields) => `<div class="mla-edit-q"><div class="mla-edit-sit-h">${title}</div>${fields.map(f => qField(f[0], f[1], f[2])).join('')}</div>`;
  return `<div class="aia-tcs-header">
      <button class="btn-sm" data-action="mla-tc-editback">← 관리</button>
      <div class="aia-tcs-info"><span class="aia-tcs-name">✏️ 상황·루브릭 편집</span></div>
    </div>
    <div class="ml-sub-explain">여기서 고친 내용은 <b>학생 화면에 바로 반영</b>됩니다. (정보 <b>2-A·2-B 두 반 모두</b>에 함께 저장돼요.) 정답은 학생 글·상황 어디에도 적지 마세요.</div>

    <div class="section mla-edit-sec">
      <div class="aia-tcs-sec-title">📢 안내문 (상단 설명)</div>
      <textarea class="aia-field-area" data-action="mla-edit-input" data-field="intro" rows="3">${esc(intro)}</textarea>
    </div>

    <div class="section mla-edit-sec">
      <div class="aia-tcs-sec-title">📝 문항 안내 (질문 글)</div>
      <div class="ml-sub-explain">문항의 <b>제목·설명·각 칸 라벨</b>을 고칠 수 있어요. (입력칸 자체와 유형/모델 선택지 구조는 그대로 유지) 빈칸으로 두면 기본값이 쓰입니다.</div>
      ${qBlock('문항 1', [['제목', 'q1head', false], ['설명', 'q1sub', true], ['① 칸 라벨', 'q1aLabel', false], ['② 칸 라벨', 'q1bLabel', false]])}
      ${qBlock('문항 2', [['제목', 'q2head', false], ['설명', 'q2sub', true], ['문제 선정칸 라벨', 'q2pickLabel', false], ['유형 라벨', 'q2typeLabel', false], ['모델 라벨', 'q2modelLabel', false], ['이유칸 라벨', 'q2whyLabel', false]])}
      ${qBlock('문항 3', [['제목', 'q3head', false], ['설명', 'q3sub', true], ['입력칸 라벨', 'q3inLabel', false], ['출력칸 라벨', 'q3outLabel', false], ['기대효과칸 라벨', 'q3effLabel', false]])}
    </div>

    <div class="section mla-edit-sec">
      <div class="aia-tcs-sec-title">📋 상황 8개</div>
      ${sitBlocks}
    </div>

    <div class="section mla-edit-sec">
      <div class="aia-tcs-sec-title">📊 학생용 채점 기준 (문항별 · 5점~2점)</div>
      <div class="ml-sub-explain">⚠️ <b>학생에게 보이는</b> 칸입니다 — 정답(어떤 게 ML인지·유형이 무엇인지)을 쓰지 마세요. 학생은 시험 중 <b>각 문항 옆 드롭다운</b>으로 봅니다. 칸을 비우면 그 점수대는 기본값이 쓰입니다.</div>
      ${rBlock('문항 1', 'q1')}
      ${rBlock('문항 2', 'q2')}
      ${rBlock('문항 3', 'q3')}
    </div>

    <div class="aia-submit-bar">
      ${MLA_EDIT_SAVING ? '<span class="aia-meta saving">💾 저장 중…</span>' : ''}
      <button class="btn-sm" data-action="mla-edit-reset">↩ 기본값으로 되돌리기</button>
      <button class="btn-p btn-sm" data-action="mla-edit-save" ${MLA_EDIT_SAVING ? 'disabled' : ''}>💾 저장 (두 반 적용)</button>
    </div>`;
}
