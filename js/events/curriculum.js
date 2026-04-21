/* ═══════════════════════════════════════
   events/curriculum.js — 진도 계획 이벤트

   - 요일 토글, 일정 생성, 주제 CRUD
   - 세션 편집(주제/메모/휴강/삭제)
   - 주제 자동 재배정
   - 자동 저장 (debounce)
═══════════════════════════════════════ */

let _curSaveTimer = null;

function setCurSaveIndicator(state){
  const el = document.getElementById('cur-save-ind');
  if(!el) return;
  const m = {
    pending: {text: '✏️ 편집 중...', color: 'var(--text3)'},
    saving:  {text: '💾 저장 중...', color: 'var(--text3)'},
    saved:   {text: '✓ 저장됨',      color: '#188038'},
    error:   {text: '⚠️ 저장 실패',  color: '#d93025'}
  };
  const {text, color} = m[state] || m.saved;
  el.textContent = text;
  el.style.color = color;
  el.style.opacity = '1';
  if(state === 'saved') setTimeout(() => { el.style.opacity = '0'; }, 1500);
}

function scheduleCurSave(){
  if(!IS_TC) return;
  clearTimeout(_curSaveTimer);
  setCurSaveIndicator('pending');
  _curSaveTimer = setTimeout(async () => {
    setCurSaveIndicator('saving');
    try {
      await saveCurriculum(CURRICULUM);
      setCurSaveIndicator('saved');
    } catch(e){
      console.error('진도 계획 저장 실패:', e);
      setCurSaveIndicator('error');
    }
  }, 1200);
}

// ── 일정 생성 ──
function generateCurSessions(cur){
  const sessions = {'info-2A': [], 'info-2B': []};
  const start = new Date(cur.startDate + 'T00:00:00');
  const end = new Date(cur.endDate + 'T00:00:00');
  if(!(start < end)) return sessions;

  // 기존 커스텀 일정(보강)은 유지
  const keepCustom = {'info-2A': [], 'info-2B': []};
  for(const cid of ['info-2A', 'info-2B']){
    const arr = cur.sessions?.[cid] || [];
    arr.forEach(s => { if(s.isCustom) keepCustom[cid].push(s); });
  }

  for(const cid of ['info-2A', 'info-2B']){
    const days = cur.classDays?.[cid] || [];
    if(!days.length) continue;
    const d = new Date(start);
    while(d <= end){
      if(days.includes(d.getDay())){
        sessions[cid].push({
          id: 'sess_' + d.toISOString().slice(0,10) + '_' + cid,
          date: d.toISOString().slice(0, 10),
          topicId: null,
          memo: '',
          skipped: false,
          isCustom: false
        });
      }
      d.setDate(d.getDate() + 1);
    }
    // 커스텀 세션 병합
    sessions[cid] = sessions[cid].concat(keepCustom[cid]);
    sessions[cid].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  return sessions;
}

// ── 주제 자동 배정 (휴강 제외한 세션에 순서대로) ──
function autoAssignTopics(cur){
  for(const cid of ['info-2A', 'info-2B']){
    const sessions = cur.sessions?.[cid] || [];
    let ti = 0;
    for(const s of sessions){
      if(s.skipped){
        s.topicId = null;
        continue;
      }
      s.topicId = cur.topics[ti]?.id || null;
      if(cur.topics[ti]) ti++;
    }
  }
}

// ── Setup 읽기 ──
function readCurSetup(){
  if(!CURRICULUM) CURRICULUM = {};
  const startEl = document.getElementById('cur-start');
  const endEl = document.getElementById('cur-end');
  if(startEl) CURRICULUM.startDate = startEl.value;
  if(endEl) CURRICULUM.endDate = endEl.value;
  CURRICULUM.classDays = CURRICULUM.classDays || {};
  for(const cid of ['info-2A', 'info-2B']){
    const checked = Array.from(document.querySelectorAll(`.cur-day-chk[data-cid="${cid}"]:checked`))
      .map(el => parseInt(el.dataset.day))
      .filter(d => !isNaN(d))
      .sort((a,b) => a-b);
    CURRICULUM.classDays[cid] = checked;
  }
  // 주제 제목도 현재 DOM에서 읽어서 반영
  document.querySelectorAll('.cur-topic-title').forEach((el, i) => {
    if(!CURRICULUM.topics) CURRICULUM.topics = [];
    if(!CURRICULUM.topics[i]) CURRICULUM.topics[i] = {id: 'topic_' + Date.now() + '_' + i};
    CURRICULUM.topics[i].title = el.value;
  });
  CURRICULUM.topics = CURRICULUM.topics || [];
  CURRICULUM.sessions = CURRICULUM.sessions || {'info-2A': [], 'info-2B': []};
}

// ── 이벤트 핸들러 ──
document.addEventListener('click', async e => {
  const t = e.target;

  // 요일 칩 토글 (click label)
  const chip = t.closest?.('.cur-day-chip');
  if(chip){
    e.preventDefault();
    const chk = chip.querySelector('.cur-day-chk');
    if(chk){
      chk.checked = !chk.checked;
      chip.classList.toggle('sel', chk.checked);
      // 상태만 갱신 (재렌더 안함)
      if(!CURRICULUM) CURRICULUM = {};
      if(!CURRICULUM.classDays) CURRICULUM.classDays = {};
      const cid = chk.dataset.cid;
      const day = parseInt(chk.dataset.day);
      const cur = CURRICULUM.classDays[cid] || [];
      if(chk.checked){
        if(!cur.includes(day)) cur.push(day);
      } else {
        const idx = cur.indexOf(day);
        if(idx !== -1) cur.splice(idx, 1);
      }
      cur.sort((a,b)=>a-b);
      CURRICULUM.classDays[cid] = cur;
      scheduleCurSave();
    }
    return;
  }

  const el = t.closest?.('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // ── 일정 생성/재생성 ──
  if(act.action === 'cur-generate'){
    readCurSetup();
    if(!CURRICULUM.startDate || !CURRICULUM.endDate){
      toast('시작일과 종료일을 입력하세요.', 'err'); return;
    }
    if(CURRICULUM.sessions && (CURRICULUM.sessions['info-2A']?.length || CURRICULUM.sessions['info-2B']?.length)){
      if(!confirm('기존 일정을 전부 재생성합니다. 메모/휴강 등 편집한 내용은 유지할 수 없어요. 계속할까요?\n(보강 일정은 유지됩니다)')) return;
    }
    const newSessions = generateCurSessions(CURRICULUM);
    CURRICULUM.sessions = newSessions;
    // 주제 자동 배정
    autoAssignTopics(CURRICULUM);
    render();
    scheduleCurSave();
    toast('일정이 생성됐습니다.', 'ok');
    return;
  }

  // ── 주제 자동 재배정 ──
  if(act.action === 'cur-reassign'){
    readCurSetup();
    autoAssignTopics(CURRICULUM);
    render();
    scheduleCurSave();
    toast('주제를 재배정했습니다.', 'ok');
    return;
  }

  // ── 주제 CRUD ──
  if(act.action === 'cur-topic-add'){
    readCurSetup();
    CURRICULUM.topics = CURRICULUM.topics || [];
    CURRICULUM.topics.push({id: 'topic_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6), title: ''});
    render();
    scheduleCurSave();
    // 방금 추가된 항목에 포커스
    setTimeout(() => {
      const inputs = document.querySelectorAll('.cur-topic-title');
      inputs[inputs.length - 1]?.focus();
    }, 50);
    return;
  }
  if(act.action === 'cur-topic-del'){
    readCurSetup();
    const idx = parseInt(act.tidx);
    CURRICULUM.topics.splice(idx, 1);
    render();
    scheduleCurSave();
    return;
  }
  if(act.action === 'cur-topic-move'){
    readCurSetup();
    const idx = parseInt(act.tidx);
    const dir = parseInt(act.dir);
    const arr = CURRICULUM.topics;
    const j = idx + dir;
    if(j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    // 주제 순서 바뀌었으니 세션도 재배정
    autoAssignTopics(CURRICULUM);
    render();
    scheduleCurSave();
    return;
  }
  if(act.action === 'cur-topic-bulk'){
    const cur = CURRICULUM?.topics || [];
    const defaultText = cur.map(t => t.title || '').join('\n');
    const input = prompt('주제를 한 줄에 하나씩 입력하세요 (기존 주제는 덮어씁니다):', defaultText);
    if(input === null) return;
    const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
    if(!CURRICULUM) CURRICULUM = {};
    CURRICULUM.topics = lines.map((title, i) => ({
      id: 'topic_' + Date.now().toString(36) + '_' + i,
      title
    }));
    readCurSetup();
    autoAssignTopics(CURRICULUM);
    render();
    scheduleCurSave();
    toast(`${lines.length}개 주제가 등록됐습니다.`, 'ok');
    return;
  }

  // ── 세션 편집 ──
  if(act.action === 'cur-sess-del'){
    if(!confirm('이 일정을 삭제할까요?')) return;
    readCurSetup();
    const cid = act.cid;
    const sidx = parseInt(act.sidx);
    CURRICULUM.sessions[cid].splice(sidx, 1);
    render();
    scheduleCurSave();
    return;
  }

  if(act.action === 'cur-sess-add'){
    readCurSetup();
    const dateStr = prompt('추가할 날짜를 입력하세요 (YYYY-MM-DD):', new Date().toISOString().slice(0,10));
    if(!dateStr) return;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)){ toast('날짜 형식이 잘못됐습니다.', 'err'); return; }
    const cid = prompt('반을 입력하세요 (info-2A 또는 info-2B):', 'info-2A');
    if(!cid || !['info-2A', 'info-2B'].includes(cid)){ toast('반 ID가 올바르지 않습니다.', 'err'); return; }

    CURRICULUM.sessions = CURRICULUM.sessions || {'info-2A': [], 'info-2B': []};
    CURRICULUM.sessions[cid] = CURRICULUM.sessions[cid] || [];
    CURRICULUM.sessions[cid].push({
      id: 'sess_custom_' + Date.now().toString(36),
      date: dateStr, topicId: null, memo: '', skipped: false, isCustom: true
    });
    CURRICULUM.sessions[cid].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    render();
    scheduleCurSave();
    toast('보강 일정이 추가됐습니다.', 'ok');
    return;
  }

  // 수동 저장 버튼
  if(act.action === 'cur-save-all'){
    readCurSetup();
    el.disabled = true; el.textContent = '⏳ 저장 중...';
    try {
      await saveCurriculum(CURRICULUM);
      toast('진도 계획이 저장됐습니다.', 'ok');
      setCurSaveIndicator('saved');
    } catch(e){
      toast('저장 실패: ' + e.message, 'err');
    }
    el.disabled = false; el.textContent = '💾 저장';
    return;
  }
});

// ── input/change 이벤트 (세션 주제/메모/휴강, 주제 제목) ──
document.addEventListener('change', e => {
  const t = e.target;

  // 세션 주제 선택
  if(t.classList?.contains('cur-sess-topic')){
    if(!CURRICULUM) return;
    const cid = t.dataset.cid;
    const sidx = parseInt(t.dataset.sidx);
    const s = CURRICULUM.sessions?.[cid]?.[sidx];
    if(s){
      s.topicId = t.value || null;
      scheduleCurSave();
    }
    return;
  }

  // 휴강 체크
  if(t.classList?.contains('cur-sess-skip')){
    if(!CURRICULUM) return;
    const cid = t.dataset.cid;
    const sidx = parseInt(t.dataset.sidx);
    const s = CURRICULUM.sessions?.[cid]?.[sidx];
    if(s){
      s.skipped = t.checked;
      if(s.skipped) s.topicId = null;
      // 시각적으로 회색 처리
      const row = t.closest('.cur-sess-row');
      if(row) row.classList.toggle('cur-skipped', t.checked);
      scheduleCurSave();
    }
    return;
  }

  // 시작일/종료일 변경
  if(t.id === 'cur-start' || t.id === 'cur-end'){
    readCurSetup();
    scheduleCurSave();
    return;
  }
});

document.addEventListener('input', e => {
  const t = e.target;

  // 세션 메모
  if(t.classList?.contains('cur-sess-memo')){
    if(!CURRICULUM) return;
    const cid = t.dataset.cid;
    const sidx = parseInt(t.dataset.sidx);
    const s = CURRICULUM.sessions?.[cid]?.[sidx];
    if(s){
      s.memo = t.value;
      scheduleCurSave();
    }
    return;
  }

  // 주제 제목
  if(t.classList?.contains('cur-topic-title')){
    if(!CURRICULUM?.topics) return;
    const row = t.closest('.cur-topic-row');
    const idx = row ? parseInt(row.dataset.tidx) : -1;
    if(idx >= 0 && CURRICULUM.topics[idx]){
      CURRICULUM.topics[idx].title = t.value;
      scheduleCurSave();
    }
    return;
  }
});
