/* ═══════════════════════════════════════
   views/curriculum.js — 진도 계획 (선생님 전용)

   정보 2-A, 정보 2-B 를 한 페이지에서 통합 관리:
   - 학기 기간 + 반별 수업 요일 설정
   - 주제 목록 (순서대로 자동 배정)
   - 자동 생성된 수업 일정 (날짜순) 테이블에서 편집
═══════════════════════════════════════ */

const CUR_CLASS_IDS = ['info-2A', 'info-2B'];
const DAY_NAMES = ['일','월','화','수','목','금','토'];

function vTcCurriculum(){
  const cur = CURRICULUM || defaultCurriculum();

  return `
    <div class="sec-title" style="margin-bottom:10px">📅 진도 계획</div>
    <div class="box-info" style="margin-bottom:14px">정보 2-A, 2-B 학기 진도를 한 번에 관리합니다. 학기 기간과 수업 요일을 지정하면 일정이 자동 생성됩니다.</div>

    ${vCurSetup(cur)}
    ${vCurTopics(cur)}
    ${vCurSchedule(cur)}

    <div id="cur-save-ind" style="position:fixed;bottom:20px;right:20px;font-size:12px;padding:8px 14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);box-shadow:var(--sh);opacity:0;transition:opacity .2s;pointer-events:none;z-index:100"></div>
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

// ── 학기 설정 ──
function vCurSetup(cur){
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

  return `<div class="section">
    <div class="sec-title" style="margin-bottom:8px">⚙️ 학기 설정</div>
    <div class="form">
      <div class="form-row">
        <div class="field"><label>시작일</label><input type="date" id="cur-start" value="${esc(cur.startDate || '')}"/></div>
        <div class="field"><label>종료일</label><input type="date" id="cur-end" value="${esc(cur.endDate || '')}"/></div>
      </div>
      <div class="field">
        <label>반별 수업 요일 (클릭해서 토글)</label>
        ${classRows}
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn-p btn-sm" data-action="cur-generate">🔄 일정 생성/재생성</button>
        <button class="btn-sm" data-action="cur-reassign">🔁 주제 자동 재배정</button>
        <span style="font-size:11px;color:var(--text3);margin-left:auto">
          ${cur.updatedAt ? `마지막 저장: ${fmtDt(cur.updatedAt)}` : '아직 저장 안 됨'}
        </span>
      </div>
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
  `).join('') : `<div style="color:var(--text3);font-size:13px;padding:10px 0">주제가 없습니다. 추가해주세요.</div>`;

  return `<div class="section">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div class="sec-title" style="margin:0">📚 진도 주제 <span style="font-size:11px;color:var(--text3);font-weight:400">(순서대로 자동 배정)</span></div>
      <div style="display:flex;gap:6px">
        <button class="btn-sm" data-action="cur-topic-add">+ 주제 추가</button>
        <button class="btn-sm" data-action="cur-topic-bulk">↕ 여러 줄 한번에</button>
      </div>
    </div>
    <div id="cur-topics">${rows}</div>
  </div>`;
}

// ── 일정 테이블 ──
function vCurSchedule(cur){
  // 두 반 세션을 하나로 합쳐 날짜순 정렬
  const allSessions = [];
  for(const cid of CUR_CLASS_IDS){
    const arr = cur.sessions?.[cid] || [];
    arr.forEach((s, idx) => allSessions.push({...s, cid, idx}));
  }
  allSessions.sort((a, b) => {
    const d = (a.date || '').localeCompare(b.date || '');
    if(d !== 0) return d;
    return a.cid.localeCompare(b.cid);
  });

  if(!allSessions.length){
    return `<div class="section">
      <div class="sec-title" style="margin-bottom:8px">📆 수업 일정</div>
      <div style="color:var(--text3);font-size:13px;padding:16px 0;text-align:center">
        위에서 학기 설정을 하고 <b>🔄 일정 생성</b> 버튼을 누르세요.
      </div>
    </div>`;
  }

  const topicOpts = ['<option value="">(없음)</option>']
    .concat((cur.topics || []).map((t, i) => `<option value="${esc(t.id)}">${i+1}. ${esc(t.title || '제목 없음')}</option>`))
    .join('');

  const rows = allSessions.map(s => {
    const cls = CLASSES.find(c => c.id === s.cid);
    const d = new Date(s.date + 'T00:00:00');
    const dayName = DAY_NAMES[d.getDay()];
    const weekClass = d.getDay() === 0 || d.getDay() === 6 ? ' cur-weekend' : '';
    const customBadge = s.isCustom ? ` <span class="chip chip-purple" style="font-size:10px;padding:1px 6px">보강</span>` : '';
    return `<tr class="cur-sess-row${s.skipped ? ' cur-skipped' : ''}${weekClass}" data-cid="${s.cid}" data-sidx="${s.idx}">
      <td class="cur-date">${s.date.slice(5).replace('-','/')}(${dayName})${customBadge}</td>
      <td>${cls?.emoji || ''} ${esc(cls?.label || s.cid)}</td>
      <td>
        <select class="cur-sess-topic" data-cid="${s.cid}" data-sidx="${s.idx}">
          ${topicOpts.replace(`value="${esc(s.topicId || '')}"`, `value="${esc(s.topicId || '')}" selected`)}
        </select>
      </td>
      <td>
        <input class="cur-sess-memo" type="text" placeholder="메모" value="${esc(s.memo || '')}" data-cid="${s.cid}" data-sidx="${s.idx}"/>
      </td>
      <td style="text-align:center">
        <label class="cur-skip-lbl">
          <input type="checkbox" class="cur-sess-skip" ${s.skipped ? 'checked' : ''} data-cid="${s.cid}" data-sidx="${s.idx}"/>
          휴강
        </label>
      </td>
      <td>
        <button class="btn-xs btn-danger" data-action="cur-sess-del" data-cid="${s.cid}" data-sidx="${s.idx}" title="이 일정 삭제">✕</button>
      </td>
    </tr>`;
  }).join('');

  // 반별 진행 통계
  const stats = CUR_CLASS_IDS.map(cid => {
    const arr = cur.sessions?.[cid] || [];
    const total = arr.length;
    const active = arr.filter(s => !s.skipped).length;
    const assigned = arr.filter(s => !s.skipped && s.topicId).length;
    const cls = CLASSES.find(c => c.id === cid);
    return `<div class="cur-stat">
      <span>${cls?.emoji} ${esc(cls?.label)}</span>
      <span class="cur-stat-num">${assigned}/${active}</span>
      <span style="font-size:11px;color:var(--text3)">주제 배정</span>
    </div>`;
  }).join('');

  return `<div class="section">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
      <div class="sec-title" style="margin:0">📆 수업 일정</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-sm" data-action="cur-sess-add">+ 보강/특별 일정 추가</button>
        <button class="btn-p btn-sm" data-action="cur-save-all">💾 저장</button>
      </div>
    </div>
    <div class="cur-stats">${stats}</div>
    <div class="tbl-wrap cur-tbl-wrap">
      <table class="tbl cur-tbl">
        <thead>
          <tr><th>날짜</th><th>반</th><th>주제</th><th>메모</th><th>휴강</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}
