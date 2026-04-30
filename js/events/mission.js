/* ═══════════════════════════════════════
   events/mission.js — 미션 이벤트 핸들러

   학생: 미션 플레이, 코드 실행 & 테스트, 진행 저장
   선생님: 미션 CRUD + 에디터
═══════════════════════════════════════ */

let _missionGame = null;         // 현재 실행 중인 게임 인스턴스
let _missionSaveTimer = null;    // 학생 진도 저장 debounce

// ── input() 호출 감지 (주석/문자열 제외) ──
function countMissionInputCalls(code){
  const stripped = (code || '')
    .replace(/#.*$/gm, '')
    .replace(/'''[\s\S]*?'''/g, "''")
    .replace(/"""[\s\S]*?"""/g, '""')
    .replace(/'[^'\n]*'/g, "''")
    .replace(/"[^"\n]*"/g, '""');
  const matches = stripped.match(/\binput\s*\(/g);
  return matches?.length || 0;
}

// ── 미션 input() 팝업 (Colab/노트북 스타일) ──
function promptMissionInputs(count, existing){
  return new Promise(resolve => {
    const area = document.getElementById('mi-code-area');
    const parent = area?.parentElement || document.body;
    parent.querySelector('.mi-input-prompt')?.remove();

    const div = document.createElement('div');
    div.className = 'mi-input-prompt';
    div.innerHTML = `
      <div class="mi-ip-header">
        💬 이 코드는 <b>input()</b>을 ${count}번 호출합니다. 입력할 값을 한 줄씩 넣어주세요:
      </div>
      <textarea class="mi-ip-area" rows="${Math.min(Math.max(count, 2), 5)}" placeholder="한 줄에 하나씩..." spellcheck="false">${esc(existing || '')}</textarea>
      <div class="mi-ip-actions">
        <button class="mi-ip-ok btn-p btn-sm">▶ 실행</button>
        <button class="mi-ip-cancel btn-sm">취소</button>
        <span class="mi-ip-hint">💡 Ctrl+Enter 실행 · Esc 취소</span>
      </div>
    `;
    area?.insertAdjacentElement('afterend', div);

    const ta = div.querySelector('.mi-ip-area');
    const ok = div.querySelector('.mi-ip-ok');
    const cancel = div.querySelector('.mi-ip-cancel');
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 30);

    const submit = () => { const v = ta.value; div.remove(); resolve(v); };
    const abort = () => { div.remove(); resolve(null); };
    ok.addEventListener('click', submit);
    cancel.addEventListener('click', abort);
    ta.addEventListener('keydown', e => {
      if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); submit(); }
      else if(e.key === 'Escape'){ e.preventDefault(); abort(); }
    });
  });
}

// ── 게임 hook 적용 (통과한 단계의 것만) ──
async function applyPassedHooks(){
  if(!_missionGame || !SEL_MISSION) return;
  _missionGame.clearHooks();
  _missionGame.speedMultiplier = 1;
  _missionGame.welcomeMessage = null;

  const py = await ensureMissionPyodide();

  // 타입 헌터 hook 처리 (변수 읽어 게임 setter 호출)
  const isTypeHunter = SEL_MISSION?.gameType === 'typehunter';
  const TYPEHUNTER_HOOKS = {
    heroSummon:    {varName: 'hero_name', setter: 'setHeroName'},
    heroAttack:    {varName: 'attack',    setter: 'setHeroAttack'},
    heroSpeed:     {varName: 'speed',     setter: 'setHeroSpeed'},
    heroShield:    {varName: 'shielded',  setter: 'setHeroShield'},
    heroTransform: {varName: 'hero',      setter: 'setHeroTransform'},
    heroFinal:     {varName: 'intro',     setter: 'setHeroFinalIntro'}
  };

  for(const step of SEL_MISSION.steps || []){
    const pass = MISSION_STEP_PASS[step.id];
    if(!pass?.passed || !step.unlocks) continue;

    try {
      // ── 타입 헌터 hook ──
      if(isTypeHunter && TYPEHUNTER_HOOKS[step.unlocks]){
        const conf = TYPEHUNTER_HOOKS[step.unlocks];
        try {
          _resetNamespaceMission(py);
          await py.runPythonAsync(pass.code);
          const v = py.globals.get(conf.varName);
          const jsv = v?.toJs ? v.toJs() : v;
          if(typeof _missionGame[conf.setter] === 'function'){
            _missionGame[conf.setter](jsv);
          }
          // hook 활성 플래그 (스폰 모드 결정용)
          if(typeof _missionGame.setHook === 'function'){
            _missionGame.setHook(step.unlocks);
          }
        } catch(e){ console.warn(`${step.unlocks} 적용 실패:`, e); }
        continue;  // typehunter hook 처리 끝, 아래 flappybird 분기 건너뜀
      }

      if(step.unlocks === 'gameStartScore'){
        // 변수 스타일: 시작 점수. hook 호출 시 학생 코드 재실행 후 score 읽음
        const code = pass.code;
        _missionGame.setHook('gameStartScore', () => {
          try {
            py.runPython(code);
            const v = py.globals.get('score');
            return v?.toJs ? v.toJs() : v;
          } catch(e){ return 0; }
        });
      } else if(step.unlocks === 'welcomeMessage'){
        // 학생이 만든 greeting 변수를 읽어 시작 화면 메시지로 사용
        try {
          _resetNamespaceMission(py);
          await py.runPythonAsync(pass.code);
          const v = py.globals.get('greeting');
          const msg = v?.toJs ? v.toJs() : v;
          if(typeof msg === 'string' && msg.trim()){
            _missionGame.welcomeMessage = msg;
          }
        } catch(e){ console.warn('welcomeMessage 적용 실패:', e); }
      } else if(step.unlocks === 'speedConfig'){
        // input()으로 받은 speed 변수 읽어서 게임 속도에 적용 (1회성)
        try {
          // 학생이 팝업으로 직접 입력한 값 우선, 없으면 테스트 stdin, 기본 1
          const stdin = pass.actualStdin ?? pass.lastStdin ?? '1';
          _resetStdinForMission(py);
          _setStdinForMission(py, stdin);
          _resetNamespaceMission(py);
          await py.runPythonAsync(pass.code);
          _resetStdinForMission(py);
          const v = py.globals.get('speed');
          const s = v?.toJs ? v.toJs() : v;
          if(typeof s === 'number' && s > 0 && !isNaN(s)){
            _missionGame.speedMultiplier = s;
          }
        } catch(e){ console.warn('speedConfig 적용 실패:', e); }
      } else if(step.hookStyle === 'block'){
        const inputs = step.blockInputs || [];
        const output = step.blockOutput || inputs[0];
        const hook = makeBlockHook(py, pass.code, inputs, output);
        _missionGame.setHook(step.unlocks, hook);
      } else {
        const fn = await getMissionFunction(step.unlocks);
        if(fn) _missionGame.setHook(step.unlocks, fn);
      }
    } catch(e){ console.warn('hook 적용 실패:', e); }
  }

  // 시작 점수 hook이 바뀌었을 수 있으니 게임 리셋 (안 시작됐거나 게임오버인 경우만)
  // 진행 중이면 현재 게임은 그대로 두고, 다음 리셋 시 새 hook 적용
  if(_missionGame.started === false || _missionGame.gameOver){
    _missionGame.reset();
  } else {
    // 진행 중이면 레벨만 재계산 (새로 쓴 levelCalc 즉시 반영)
    _missionGame.recalcLevel?.();
  }
}

// 헬퍼: 네임스페이스 / stdin (mission-runner.js 내부 함수를 다시 불러씀)
function _resetNamespaceMission(py){
  try { py.runPython(`
for _k in list(globals().keys()):
    if not _k.startswith('_') and _k not in ('sys','io'):
        try: del globals()[_k]
        except: pass
`); } catch(e){}
}
function _setStdinForMission(py, input){
  const lines = Array.isArray(input) ? input : String(input).split('\n');
  let idx = 0;
  try { py.setStdin({stdin: () => idx < lines.length ? lines[idx++] : ''}); } catch(e){}
}
function _resetStdinForMission(py){
  try { py.setStdin({stdin: () => ''}); } catch(e){}
}

// 통과한 단계 코드 복원 (새로고침 후)
async function reloadPassedCode(){
  if(!SEL_MISSION) return;
  try {
    await applyPassedHooks();
  } catch(e){ console.warn('복원 실패:', e); }
}

// ── 미션 열기 ──
async function openMission(missionId){
  const m = MISSIONS.find(x => x.id === missionId); if(!m) return;
  SEL_MISSION = m;
  MISSION_STEP_IDX = 0;
  MISSION_STEP_PASS = {};
  MISSION_VIEW = 'play';

  // 학생 진도 로드
  if(ST_USER && !IS_TC && SEL_CLS){
    try {
      const prog = await loadMissionProgress(SEL_CLS.id, missionId, ST_USER.number);
      if(prog?.stepPass){
        MISSION_STEP_PASS = prog.stepPass;
        // 다음 미통과 단계로 이동
        const nextIdx = m.steps.findIndex(s => !MISSION_STEP_PASS[s.id]?.passed);
        MISSION_STEP_IDX = nextIdx === -1 ? m.steps.length - 1 : nextIdx;
      }
    } catch(e){ console.warn('진도 로드 실패:', e); }
  }
  render();
}

function closeMission(){
  MISSION_VIEW = 'list';
  SEL_MISSION = null;
  MISSION_STEP_IDX = 0;
  MISSION_STEP_PASS = {};
  if(_missionGame){ _missionGame.stop(); _missionGame.destroy(); _missionGame = null; }
  render();
}

// ── 게임 초기화 (render 후 호출) ──
async function initMissionGame(){
  if(MISSION_VIEW !== 'play') return;
  const canvas = document.getElementById('mi-game-canvas');
  if(!canvas) return;
  if(_missionGame){ _missionGame.stop(); _missionGame.destroy(); _missionGame = null; }
  // 미션의 gameType에 따라 다른 엔진 사용
  const gt = SEL_MISSION?.gameType || 'flappybird';
  if(gt === 'typehunter' && typeof TypeHunter === 'function'){
    _missionGame = new TypeHunter(canvas);
  } else {
    _missionGame = new FlappyBird(canvas);
  }
  _missionGame.start();
  // 통과한 단계 코드 재실행 + hooks 적용
  await reloadPassedCode();
}

// ── 학생: 코드 실행 & 테스트 ──
async function runCurrentStep(){
  const m = SEL_MISSION;
  if(!m) return;
  const step = m.steps[MISSION_STEP_IDX];
  const area = document.getElementById('mi-code-area');
  const code = area?.value || '';
  const resEl = document.getElementById('mi-test-results');
  if(!resEl) return;

  resEl.innerHTML = `<div class="mi-results"><div style="color:var(--text2);font-size:13px">⏳ Python 실행 중...</div></div>`;

  // Pyodide 준비 (첫 실행 시 로딩 시간 있음)
  try { await ensureMissionPyodide(); }
  catch(e){ resEl.innerHTML = `<div class="mi-results"><div class="mi-test-item fail">⚠️ Pyodide 로드 실패: ${esc(e.message)}</div></div>`; return; }

  // input() 감지 → 학생에게 실제 게임에 쓸 값 입력받음
  let userStdin = null;
  const inputCount = countMissionInputCalls(code);
  if(inputCount > 0){
    const prev = MISSION_STEP_PASS[step.id]?.actualStdin;
    resEl.innerHTML = '';
    userStdin = await promptMissionInputs(inputCount, prev);
    if(userStdin === null){ return; }
    resEl.innerHTML = `<div class="mi-results"><div style="color:var(--text2);font-size:13px">⏳ Python 실행 중...</div></div>`;
  }

  // 각 단계는 독립적으로 테스트 (이전 단계 코드 prepend 안 함)
  // 이전 단계 코드는 게임 hook 실행 시점에만 사용됨 (applyPassedHooks)
  const result = await runMissionTests(code, step.tests || [], userStdin ?? undefined);

  if(result.runError){
    MISSION_STEP_PASS[step.id] = {...(MISSION_STEP_PASS[step.id]||{}), code, passed: false, lastResults: [{error: result.runError, ok: false}]};
    renderTestResultsArea();
    return;
  }

  // 첫 테스트의 stdin (fallback용)
  const lastStdin = (step.tests || []).find(t => t.stdin !== undefined)?.stdin;

  MISSION_STEP_PASS[step.id] = {
    ...(MISSION_STEP_PASS[step.id]||{}),
    code,
    passed: result.success,
    lastResults: result.results,
    ...(lastStdin !== undefined ? {lastStdin} : {}),
    ...(userStdin !== null && userStdin !== undefined ? {actualStdin: userStdin} : {})
  };

  // 통과 시 hook 적용
  if(result.success){
    await applyPassedHooks();
    toast(`🎉 미션 ${MISSION_STEP_IDX + 1} 통과!`, 'ok');
  }

  // 학생이면 저장
  scheduleMissionSave();
  renderTestResultsArea();
}

function renderTestResultsArea(){
  const step = SEL_MISSION?.steps[MISSION_STEP_IDX]; if(!step) return;
  const pass = MISSION_STEP_PASS[step.id];
  const el = document.getElementById('mi-test-results');
  if(!el) return;
  el.innerHTML = vMiTestResults(pass?.lastResults || [], pass?.passed);

  // 단계 네비게이션 dot 갱신
  document.querySelectorAll('.mi-dot').forEach((d, i) => {
    const sid = SEL_MISSION.steps[i]?.id;
    const p = sid ? MISSION_STEP_PASS[sid]?.passed : false;
    d.classList.toggle('done', !!p);
    if(p && !d.textContent.startsWith('✓')) d.textContent = '✓';
    if(!p && d.textContent === '✓') d.textContent = String(i + 1);
  });
}

// ── 진도 저장 (debounce) ──
function scheduleMissionSave(){
  if(IS_TC || !ST_USER || !SEL_MISSION || !SEL_CLS) return;
  clearTimeout(_missionSaveTimer);
  _missionSaveTimer = setTimeout(async () => {
    try {
      // lastResults는 저장 안 함 (용량 절약)
      const sanitized = {};
      for(const [k, v] of Object.entries(MISSION_STEP_PASS)){
        sanitized[k] = {passed: !!v.passed, code: v.code || ''};
      }
      await saveMissionProgress(SEL_CLS.id, SEL_MISSION.id, ST_USER.number, sanitized);
    } catch(e){ console.warn('미션 진도 저장 실패:', e); }
  }, 1200);
}

// ── 이벤트 ──
document.addEventListener('click', async e => {
  const el = e.target.closest?.('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // 미션 열기
  if(act.action === 'mission-play'){ await openMission(act.mid); return; }
  if(act.action === 'mission-back'){ closeMission(); return; }

  // 단계 네비게이션
  if(act.action === 'mission-goto-step'){
    MISSION_STEP_IDX = parseInt(act.idx); render(); return;
  }
  if(act.action === 'mission-prev-step'){
    if(MISSION_STEP_IDX > 0){ MISSION_STEP_IDX--; render(); } return;
  }
  if(act.action === 'mission-next-step'){
    if(MISSION_STEP_IDX < (SEL_MISSION?.steps?.length || 0) - 1){ MISSION_STEP_IDX++; render(); } return;
  }

  // 코드 실행
  if(act.action === 'mi-run'){
    el.disabled = true; el.textContent = '⏳ 실행 중...';
    await runCurrentStep();
    el.disabled = false; el.textContent = '▶ 실행 & 테스트';
    return;
  }
  // 시작 코드로 리셋
  if(act.action === 'mi-reset-code'){
    const step = SEL_MISSION?.steps[MISSION_STEP_IDX];
    const area = document.getElementById('mi-code-area');
    if(area && step) area.value = step.starterCode || '';
    return;
  }
  // 게임 재시작
  if(act.action === 'mi-game-reset'){
    if(_missionGame){ _missionGame.reset(); }
    return;
  }

  // ── 선생님: 미션 관리 ──
  if(act.action === 'mission-new'){
    MISSION_EDITING = null; MISSION_VIEW = 'edit'; render(); return;
  }
  if(act.action === 'mission-edit'){
    const m = MISSIONS.find(x => x.id === act.mid); if(!m) return;
    MISSION_EDITING = JSON.parse(JSON.stringify(m)); // deep clone
    MISSION_VIEW = 'edit'; render(); return;
  }
  if(act.action === 'mission-editor-cancel'){
    MISSION_EDITING = null; MISSION_VIEW = 'list'; render(); return;
  }
  if(act.action === 'mission-delete'){
    if(!confirm(`"${act.mtitle}" 미션을 삭제할까요?\n학생들의 진도도 함께 삭제됩니다.`)) return;
    const cid = TC_CLS?.id; if(!cid) return;
    el.disabled = true;
    await deleteMission(cid, act.mid);
    await loadMissions(cid); render();
    return;
  }
  if(act.action === 'mission-load-sample'){
    if(!confirm('플래피 버드 예제 미션을 이 반에 등록할까요?')) return;
    const cid = TC_CLS?.id; if(!cid) return;
    const sample = getFlappyBirdSampleMission();
    const newId = genId();
    await saveMission(cid, newId, sample);
    await loadMissions(cid);
    toast('예제 미션이 등록됐습니다.', 'ok');
    render();
    return;
  }
  if(act.action === 'mission-load-typehunter'){
    if(!confirm('타입 헌터 예제 미션(1차시 변수/자료형 학습용)을 이 반에 등록할까요?')) return;
    const cid = TC_CLS?.id; if(!cid) return;
    const sample = getTypeHunterSampleMission();
    const newId = genId();
    await saveMission(cid, newId, sample);
    await loadMissions(cid);
    toast('타입 헌터 예제 미션이 등록됐습니다.', 'ok');
    render();
    return;
  }

  // ── 에디터: 단계 조작 ──
  if(act.action === 'me-add-step'){
    collectEditorState();
    MISSION_EDITING = MISSION_EDITING || {};
    MISSION_EDITING.steps = MISSION_EDITING.steps || [];
    MISSION_EDITING.steps.push({
      id: 'step_' + Date.now().toString(36),
      title: '',
      description: '',
      starterCode: '',
      hint: '',
      tests: [],
      unlocks: ''
    });
    render(); return;
  }
  if(act.action === 'me-del-step'){
    collectEditorState();
    if(MISSION_EDITING?.steps?.length > 1){
      MISSION_EDITING.steps.splice(parseInt(act.sidx), 1);
      render();
    } else { toast('최소 1개 단계가 있어야 합니다.', 'err'); }
    return;
  }
  if(act.action === 'me-move-step'){
    collectEditorState();
    const i = parseInt(act.sidx), d = parseInt(act.dir);
    const arr = MISSION_EDITING.steps;
    const j = i + d;
    if(j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    render(); return;
  }
  if(act.action === 'me-add-test'){
    collectEditorState();
    const sidx = parseInt(act.sidx);
    const step = MISSION_EDITING.steps[sidx];
    step.tests = step.tests || [];
    if(act.ttype === 'variable') step.tests.push({type: 'variable', name: '', expected: 0});
    else if(act.ttype === 'block') step.tests.push({type: 'block', inputs: {}, output: step.blockOutput || '', expected: 0});
    else step.tests.push({type: 'function', call: '', expected: 0});
    render(); return;
  }
  if(act.action === 'me-del-test'){
    collectEditorState();
    const sidx = parseInt(act.sidx), tidx = parseInt(act.tidx);
    MISSION_EDITING.steps[sidx].tests.splice(tidx, 1);
    render(); return;
  }

  // 미션 저장
  if(act.action === 'me-save'){
    await saveMissionFromEditor(el); return;
  }
});

// 에디터 DOM → MISSION_EDITING 수집
function collectEditorState(){
  MISSION_EDITING = MISSION_EDITING || {};
  const t = document.getElementById('me-title')?.value || '';
  const g = document.getElementById('me-game-type')?.value || 'flappybird';
  const d = document.getElementById('me-desc')?.value || '';
  MISSION_EDITING.title = t;
  MISSION_EDITING.gameType = g;
  MISSION_EDITING.description = d;
  MISSION_EDITING.steps = MISSION_EDITING.steps || [];
  document.querySelectorAll('.me-step').forEach(stepEl => {
    const idx = parseInt(stepEl.dataset.sidx);
    const step = MISSION_EDITING.steps[idx] || {};
    step.title = stepEl.querySelector('.me-step-title')?.value || '';
    step.description = stepEl.querySelector('.me-step-desc')?.value || '';
    step.hint = stepEl.querySelector('.me-step-hint')?.value || '';
    step.starterCode = stepEl.querySelector('.me-step-code')?.value || '';
    step.unlocks = stepEl.querySelector('.me-step-unlocks')?.value || '';
    // hookStyle 수집
    const hs = stepEl.querySelector('.me-step-hookstyle:checked')?.value || step.hookStyle || 'variable';
    step.hookStyle = hs;
    if(hs === 'block'){
      const inputsRaw = stepEl.querySelector('.me-block-inputs')?.value || '';
      step.blockInputs = inputsRaw.split(',').map(s => s.trim()).filter(Boolean);
      step.blockOutput = stepEl.querySelector('.me-block-output')?.value?.trim() || '';
    }
    // 테스트 수집
    step.tests = [];
    stepEl.querySelectorAll('.me-test-row').forEach(row => {
      const type = row.querySelector('.me-test-type')?.value;
      const expRaw = row.querySelector('.me-test-expected')?.value || '';
      let expected;
      try { expected = JSON.parse(expRaw); }
      catch { expected = expRaw; }
      if(type === 'variable'){
        const name = row.querySelector('.me-test-name')?.value?.trim() || '';
        if(name) step.tests.push({type, name, expected});
      } else if(type === 'block'){
        const inputsRaw = row.querySelector('.me-test-block-inputs')?.value || '{}';
        let inputs = {};
        try { inputs = JSON.parse(inputsRaw); } catch(e){}
        step.tests.push({type: 'block', inputs, output: step.blockOutput || '', expected});
      } else {
        const call = row.querySelector('.me-test-call')?.value?.trim() || '';
        if(call) step.tests.push({type: 'function', call, expected});
      }
    });
    MISSION_EDITING.steps[idx] = step;
  });
}

async function saveMissionFromEditor(btn){
  collectEditorState();
  const m = MISSION_EDITING;
  const err = document.getElementById('me-err');
  if(!m?.title){ err.textContent = '제목을 입력하세요.'; return; }
  if(!m.steps?.length){ err.textContent = '최소 1개 단계가 필요합니다.'; return; }
  for(const s of m.steps){
    if(!s.title){ err.textContent = '모든 단계에 제목이 필요합니다.'; return; }
    if(!s.tests?.length){ err.textContent = `"${s.title}" 단계에 테스트 케이스가 없습니다.`; return; }
  }

  btn.disabled = true; err.textContent = '';
  try {
    const editId = btn.dataset.mid;
    const now = new Date().toISOString();
    if(editId){
      // 수정
      const cid = TC_CLS.id;
      await saveMission(cid, editId, {
        title: m.title,
        gameType: m.gameType || 'flappybird',
        description: m.description || '',
        steps: m.steps,
        createdAt: m.createdAt || now
      });
      toast('미션 수정 완료', 'ok');
    } else {
      // 신규 — 다중 반 선택
      const targets = getSelectedClasses('me');
      if(!targets.length){ err.textContent = '등록할 반을 선택하세요.'; btn.disabled = false; return; }
      for(const cid of targets){
        const id = genId();
        await saveMission(cid, id, {
          title: m.title,
          gameType: m.gameType || 'flappybird',
          description: m.description || '',
          steps: m.steps,
          createdAt: now
        });
      }
      toast(`${targets.length}개 반에 미션이 등록됐습니다.`, 'ok');
    }
    MISSION_EDITING = null;
    MISSION_VIEW = 'list';
    await loadMissions(TC_CLS.id);
    render();
  } catch(e){
    err.textContent = '저장 실패: ' + e.message;
    btn.disabled = false;
  }
}

// 에디터의 hookStyle 라디오 변경 시 재렌더
document.addEventListener('change', e => {
  if(e.target.classList?.contains('me-step-hookstyle')){
    collectEditorState();
    render();
  }
});

// 미션 플레이 화면 렌더 후 게임 초기화
function afterRenderMission(){
  if(MISSION_VIEW === 'play' && document.getElementById('mi-game-canvas')){
    initMissionGame();
  } else {
    if(_missionGame){ _missionGame.stop(); _missionGame.destroy(); _missionGame = null; }
  }
}

// render 시 자동 호출되도록 전역 노출
window.afterRenderMission = afterRenderMission;
