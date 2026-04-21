/* ═══════════════════════════════════════
   views/curriculum.js — 진도 계획 (선생님 전용)

   레이아웃:
   - 상단 헤더: 제목 + 학기설정 토글 + 저장
   - 접이식 학기 설정 패널
   - 주제 목록 (공통)
   - 좌측 사이드바(반 선택) + 메인(선택된 반의 일정)
═══════════════════════════════════════ */

const CUR_CLASS_IDS = ['info-2A', 'info-2B'];
const DAY_NAMES = ['일','월','화','수','목','금','토'];

function vTcCurriculum(){
  const cur = CURRICULUM || defaultCurriculum();
  const selCls = CUR_VIEW_CLS || 'info-2A';
  // 자동 설정 토글: 최초에는 펼침, 세션이 생성되면 접힘
  const hasAnySession = CUR_CLASS_IDS.some(c => (cur.sessions?.[c] || []).length > 0);
  const settingsOpen = CUR_SETTINGS_OPEN === null ? !hasAnySession : CUR_SETTINGS_OPEN;

  return `
    <div class="cur-top">
      <div class="cur-top-title">📅 진도 계획</div>
      <div class="cur-top-meta">${cur.updatedAt ? '마지막 저장: ' + fmtDt(cur.updatedAt) : ''}</div>
      <div class="cur-top-actions">
        <button class="btn-sm" data-action="cur-toggle-settings">
          ${settingsOpen ? '▲ 학기 설정 접기' : '⚙ 학기 설정'}
        </button>
        <button class="btn-p btn-sm" data-action="cur-save-all">💾 저장</button>
        <span id="cur-save-ind" class="cur-save-ind"></span>
      </div>
    </div>

    ${settingsOpen ? vCurSetupCompact(cur) : ''}
    ${vCurTopics(cur)}

    <div class="cur-layout">
      <div class="cur-sidebar">
        ${CUR_CLASS_IDS.map(cid => vCurSidebarBtn(cid, selCls, cur)).join('')}
      </div>
      <div class="cur-main">
        ${vCurScheduleForClass(cur, selCls)}
      </div>
    </div>
  `;
}

function defaultCurriculum(){
  const today = new Date();
  const end = new Date(today); end.setMonth(end.getMonth() + 3);
  const cls2A = CLASSES.find(c => c.id === 'info-2A');
  const cls2B = CLASSES.find(c => c.id === 'info-2B');
  return {
    startDate: today.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    classDays: {
      'info-2A': cls2A?.classDays || [3, 4, 5],
      'info-2B': cls2B?.classDays || [1, 2, 5]
    },
    topics: [],
    sessions: {'info-2A': [], 'info-2B': []}
  };
}

// ── 사이드바 버튼 ──
function vCurSidebarBtn(cid, selCls, cur){
  const cls = CLASSES.find(c => c.id === cid);
  const sessions = cur.sessions?.[cid] || [];
  const active = sessions.filter(s => !s.skipped).length;
  const assigned = sessions.filter(s => !s.skipped && s.topicId).length;
  const total = sessions.length;
  const pct = active ? Math.round(assigned / active * 100) : 0;
  return `<button class="cur-cls-btn${selCls === cid ? ' sel' : ''}" data-action="cur-select-cls" data-cid="${cid}">
    <div class="cur-cls-btn-emoji">${cls?.emoji || '📘'}</div>
    <div class="cur-cls-btn-label">${esc(cls?.label || cid)}</div>
    <div class="cur-cls-btn-stat">${assigned}/${active}<span style="font-size:10px;color:var(--text3)"> · 전체 ${total}</span></div>
    <div class="cur-cls-btn-bar"><div class="cur-cls-btn-fill" style="width:${pct}%"></div></div>
  </button>`;
}

// ── 학기 설정 (컴팩트) ──
function vCurSetupCompact(cur){
  const classRows = CUR_CLASS_IDS.map(cid => {
    const cls = CLASSES.find(c => c.id === cid);
    const active = cur.classDays?.[cid] || [];
    const chips = [1,2,3,4,5].map(d => `
      <label class="cur-day-chip${active.includes(d) ? ' sel' : ''}">
        <input type="checkbox" class="cur-day-chk" data-cid="${cid}" data-day="${d}" ${active.includes(d) ? 'checked' : ''} style="display:none"/>
        ${DAY_NAMES[d]}
      </label>
    `).join('');
    return `<div class="cur-cls-row">
      <div class="cur-cls-label">${cls?.emoji || ''} ${esc(cls?.label || cid)}</div>
      <div class="cur-day-chips">${chips}</div>
    </div>`;
  }).join('');

  return `<div class="cur-setup-panel">
    <div class="cur-setup-row">
      <div class="field" style="flex:1;min-width:140px"><label>시작일</label><input type="date" id="cur-start" value="${esc(cur.startDate || '')}"/></div>
      <div class="field" style="flex:1;min-width:140px"><label>종료일</label><input type="date" id="cur-end" value="${esc(cur.endDate || '')}"/></div>
    </div>
    <div class="field" style="margin-bottom:8px">
      <label>반별 수업 요일 (클릭해서 토글)</label>
      ${classRows}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn-p btn-sm" data-action="cur-generate">🔄 일정 생성/재생성</button>
      <button class="btn-sm" data-action="cur-reassign">🔁 주제 자동 재배정</button>
    </div>
  </div>`;
}

// ── 주제 목록 ──
function vCurTopics(cur){
  const topics = cur.topics || [];
  const rows = topics.length ? topics.map((t, i) => `
    <div class="cur-topic-row" data-tidx="${i}">
      <span class="cur-topic-num">${i + 1}</span>
      <input class="cur-topic-title" type="text" placeholder="주제 제목 (예: 변수와 자료형)" value="${esc(t.title || '')}" data-tid="${esc(t.id)}"/>
      <div class="cur-topic-actions">
        <button class="btn-xs" data-action="cur-topic-move" data-tidx="${i}" data-dir="-1" title="위로">↑</button>
        <button class="btn-xs" data-action="cur-topic-move" data-tidx="${i}" data-dir="1" title="아래로">↓</button>
        <button class="btn-xs btn-danger" data-action="cur-topic-del" data-tidx="${i}" title="삭제">✕</button>
      </div>
    </div>
  `).join('') : `<div style="color:var(--text3);font-size:13px;padding:10px 0">주제가 없습니다. 추가하거나 "↕ 여러 줄 한번에"로 붙여넣으세요.</div>`;

  return `<div class="cur-topics-wrap">
    <div class="cur-topics-head">
      <div class="sec-title" style="margin:0">📚 진도 주제 <span style="font-size:11px;color:var(--text3);font-weight:400">(순서대로 자동 배정 · 양쪽 반 공통)</span></div>
      <div style="display:flex;gap:4px">
        <button class="btn-xs" data-action="cur-topic-add">+ 주제</button>
        <button class="btn-xs" data-action="cur-topic-bulk">↕ 여러 줄</button>
      </div>
    </div>
    <div id="cur-topics">${rows}</div>
  </div>`;
}

// ── 선택된 반의 일정 테이블 ──
function vCurScheduleForClass(cur, cid){
  const cls = CLASSES.find(c => c.id === cid);
  const sessions = cur.sessions?.[cid] || [];

  if(!sessions.length){
    return `<div class="cur-schedule-panel">
      <div class="cur-sch-head">
        <div class="sec-title" style="margin:0">📆 ${cls?.emoji} ${esc(cls?.label)} 수업 일정</div>
      </div>
      <div style="color:var(--text3);font-size:13px;padding:20px 0;text-align:center">
        상단에서 <b>⚙ 학기 설정</b>을 열고 기간·요일을 지정한 뒤 <b>🔄 일정 생성</b>을 눌러주세요.
      </div>
    </div>`;
  }

  const topicOpts = ['<option value="">(없음)</option>']
    .concat((cur.topics || []).map((t, i) => `<option value="${esc(t.id)}">${i+1}. ${esc(t.title || '제목 없음')}</option>`))
    .join('');

  // 날짜순 정렬 (인덱스 보존)
  const indexed = sessions.map((s, idx) => ({...s, _idx: idx}));
  indexed.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const rows = indexed.map(s => {
    const d = new Date(s.date + 'T00:00:00');
    const dayName = DAY_NAMES[d.getDay()];
    const weekClass = d.getDay() === 0 || d.getDay() === 6 ? ' cur-weekend' : '';
    const customBadge = s.isCustom ? ` <span class="chip chip-purple" style="font-size:10px;padding:1px 6px">보강</span>` : '';
    const selectedAttr = s.topicId || '';
    return `<tr class="cur-sess-row${s.skipped ? ' cur-skipped' : ''}${weekClass}" data-cid="${cid}" data-sidx="${s._idx}">
      <td class="cur-date">${s.date.slice(5).replace('-','/')}(${dayName})${customBadge}</td>
      <td>
        <select class="cur-sess-topic" data-cid="${cid}" data-sidx="${s._idx}">
          ${(cur.topics || []).reduce((html, t, i) => {
            const sel = selectedAttr === t.id ? ' selected' : '';
            return html + `<option value="${esc(t.id)}"${sel}>${i+1}. ${esc(t.title || '제목 없음')}</option>`;
          }, `<option value=""${!selectedAttr ? ' selected' : ''}>(없음)</option>`)}
        </select>
      </td>
      <td>
        <input class="cur-sess-memo" type="text" placeholder="메모" value="${esc(s.memo || '')}" data-cid="${cid}" data-sidx="${s._idx}"/>
      </td>
      <td style="text-align:center">
        <label class="cur-skip-lbl">
          <input type="checkbox" class="cur-sess-skip" ${s.skipped ? 'checked' : ''} data-cid="${cid}" data-sidx="${s._idx}"/>
          휴강
        </label>
      </td>
      <td>
        <button class="btn-xs btn-danger" data-action="cur-sess-del" data-cid="${cid}" data-sidx="${s._idx}" title="삭제">✕</button>
      </td>
    </tr>`;
  }).join('');

  const active = sessions.filter(s => !s.skipped).length;
  const assigned = sessions.filter(s => !s.skipped && s.topicId).length;
  const skipped = sessions.filter(s => s.skipped).length;

  return `<div class="cur-schedule-panel">
    <div class="cur-sch-head">
      <div class="sec-title" style="margin:0">📆 ${cls?.emoji} ${esc(cls?.label)} 수업 일정</div>
      <div class="cur-sch-head-actions">
        <button class="btn-sm" data-action="cur-sess-add" data-cid="${cid}">+ 보강/특별 일정</button>
      </div>
    </div>
    <div class="cur-sch-stats">
      <span>📖 주제 배정 <b>${assigned}/${active}</b></span>
      <span>·</span>
      <span>🗓️ 전체 ${sessions.length}회</span>
      ${skipped ? `<span>·</span><span>❌ 휴강 ${skipped}</span>` : ''}
    </div>
    <div class="tbl-wrap cur-tbl-wrap">
      <table class="tbl cur-tbl">
        <thead>
          <tr><th>날짜</th><th>주제</th><th>메모</th><th>휴강</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}
