/* ═══════════════════════════════════════
   views/mission.js — 게임 미션 (플래피 버드 등)

   학생: 게임 좌측, 미션 단계별 코드 작성 우측
   선생님: 미션 CRUD + 에디터
═══════════════════════════════════════ */

const GAME_TYPES = [
  {id:'flappybird', label:'🐦 플래피 버드', hooks:[
    {id:'addScore', label:'addScore(score)', desc:'장애물 하나 지날 때 호출 — 새 점수를 반환'},
    {id:'finalScore', label:'finalScore(score, pipesPassed)', desc:'addScore 결과에 추가 적용 (보너스 등)'}
  ]}
];

// ── 학생: 미션 목록/플레이 ──
function vStMission(){
  if(MISSION_VIEW === 'play' && SEL_MISSION) return vMissionPlay(false);
  return vMissionList(false);
}

// ── 선생님: 미션 관리/에디터/미리보기 ──
function vTcMission(){
  if(MISSION_VIEW === 'edit') return vMissionEditor();
  if(MISSION_VIEW === 'play' && SEL_MISSION) return vMissionPlay(true);
  return vMissionList(true);
}

// ── 미션 목록 ──
function vMissionList(isTeacher){
  const tcBar = isTeacher ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
    <div class="sec-title" style="margin:0">🎮 게임 미션</div>
    <div style="display:flex;gap:6px">
      <button class="btn-p btn-sm" data-action="mission-new">+ 미션 만들기</button>
      <button class="btn-sm" data-action="mission-load-sample">🐦 예제 미션 불러오기</button>
    </div>
  </div>` : '';

  if(!MISSIONS.length){
    return tcBar + emptyBox('🎮', isTeacher ? '만든 미션이 없습니다. "예제 미션 불러오기"로 바로 시작해보세요!' : '선생님이 올린 게임 미션이 없습니다.');
  }

  const list = MISSIONS.map(m => {
    const steps = m.steps?.length || 0;
    const gt = GAME_TYPES.find(g => g.id === m.gameType);
    return `<div class="list-row click" data-action="mission-play" data-mid="${m.id}">
      <div class="row-icon">${gt?.label?.split(' ')[0] || '🎮'}</div>
      <div class="row-info">
        <div class="row-title">${esc(m.title)}</div>
        <div class="row-meta">${gt?.label || m.gameType} · ${steps}개 미션 단계${m.description ? ' · ' + esc(m.description).slice(0,40) : ''}</div>
      </div>
      <div class="row-right">
        ${isTeacher ? `
          <button class="btn-xs" data-action="mission-edit" data-mid="${m.id}">✏️ 편집</button>
          <button class="btn-xs btn-danger" data-action="mission-delete" data-mid="${m.id}" data-mtitle="${esc(m.title)}">삭제</button>
        ` : `<span class="chip chip-purple">시작 →</span>`}
      </div>
    </div>`;
  }).join('');

  return tcBar + list;
}

// ── 미션 플레이 (게임 + 단계 패널) ──
function vMissionPlay(isTeacher){
  const m = SEL_MISSION;
  if(!m || !m.steps?.length) return emptyBox('❌','미션 데이터가 없습니다.');

  const step = m.steps[MISSION_STEP_IDX] || m.steps[0];
  const totalSteps = m.steps.length;
  const passedCount = Object.values(MISSION_STEP_PASS).filter(p => p?.passed).length;

  // 진행 원형 인디케이터
  const progressDots = m.steps.map((s, i) => {
    const isCur = i === MISSION_STEP_IDX;
    const passed = MISSION_STEP_PASS[s.id]?.passed;
    return `<button class="mi-dot${isCur ? ' cur' : ''}${passed ? ' done' : ''}" data-action="mission-goto-step" data-idx="${i}" title="${esc(s.title)}">${passed ? '✓' : i+1}</button>`;
  }).join('');

  // 현재 단계의 저장된 코드 or 시작 코드
  const savedCode = MISSION_STEP_PASS[step.id]?.code;
  const curCode = savedCode !== undefined ? savedCode : (step.starterCode || '');

  // 테스트 결과 (마지막 실행)
  const testResults = MISSION_STEP_PASS[step.id]?.lastResults;

  return `
    <div class="mi-play-wrap">
      <div class="mi-header">
        <button class="btn-sm" data-action="mission-back">← 목록</button>
        <div class="mi-title">🎮 ${esc(m.title)}</div>
        <div class="mi-progress-summary">${passedCount}/${totalSteps} 완료</div>
      </div>

      <div class="mi-split">
        <!-- 게임 영역 -->
        <div class="mi-game-side">
          <canvas id="mi-game-canvas" width="360" height="480"></canvas>
          <div class="mi-game-controls">
            <button class="btn-sm" data-action="mi-game-reset">🔄 다시 시작</button>
            <div style="font-size:11px;color:var(--text3)">Space / 클릭으로 점프</div>
          </div>
        </div>

        <!-- 단계 패널 -->
        <div class="mi-step-side">
          <div class="mi-step-nav">
            ${progressDots}
          </div>

          <div class="mi-step-head">
            <div class="mi-step-num">미션 ${MISSION_STEP_IDX + 1} / ${totalSteps}</div>
            <div class="mi-step-title">${esc(step.title)}</div>
          </div>

          <div class="mi-step-desc">${typeof marked !== 'undefined' ? marked.parse(step.description || '') : esc(step.description || '')}</div>

          ${step.hint ? `<details class="mi-hint"><summary>💡 힌트</summary><div>${typeof marked !== 'undefined' ? marked.parse(step.hint) : esc(step.hint)}</div></details>` : ''}

          <div class="mi-code-label">✏️ 여기에 코드를 작성하세요:</div>
          <textarea class="mi-code-area" id="mi-code-area" spellcheck="false">${esc(curCode)}</textarea>

          <div class="mi-actions">
            <button class="btn-p btn-sm" data-action="mi-run">▶ 실행 & 테스트</button>
            <button class="btn-sm" data-action="mi-reset-code">↺ 시작 코드로</button>
            ${MISSION_STEP_IDX > 0 ? `<button class="btn-sm" data-action="mission-prev-step">← 이전</button>` : ''}
            ${MISSION_STEP_IDX < totalSteps - 1 ? `<button class="btn-sm" data-action="mission-next-step">다음 →</button>` : ''}
          </div>

          <div id="mi-test-results">${testResults ? vMiTestResults(testResults, MISSION_STEP_PASS[step.id]?.passed) : ''}</div>
        </div>
      </div>
    </div>`;
}

function vMiTestResults(results, allPassed){
  if(!Array.isArray(results)) return '';
  const items = results.map((r, i) => {
    if(r.error){
      return `<div class="mi-test-item fail">
        <span class="mi-test-icon">✗</span>
        <div>
          <div class="mi-test-label">테스트 ${i+1} 오류</div>
          <pre class="mi-test-detail">${esc(r.error)}</pre>
        </div>
      </div>`;
    }
    const callLabel = r.type === 'variable' ? `변수 <code>${esc(r.name)}</code>` : `<code>${esc(r.call)}</code>`;
    return `<div class="mi-test-item ${r.ok ? 'pass' : 'fail'}">
      <span class="mi-test-icon">${r.ok ? '✓' : '✗'}</span>
      <div>
        <div class="mi-test-label">${callLabel}</div>
        <div class="mi-test-detail">
          기대: <b>${esc(JSON.stringify(r.expected))}</b> ·
          결과: <b>${esc(JSON.stringify(r.actual))}</b>
        </div>
      </div>
    </div>`;
  }).join('');

  return `<div class="mi-results">
    ${allPassed ? `<div class="mi-success">🎉 모든 테스트 통과! 게임에 적용됐어요.</div>` : ''}
    ${items}
  </div>`;
}

// ── 선생님: 미션 에디터 ──
function vMissionEditor(){
  const m = MISSION_EDITING || {};
  const steps = m.steps || [{id: 'step_' + Date.now().toString(36), title: '', description: '', starterCode: '', tests: [], hint: '', unlocks: 'addScore'}];
  const gameOpts = GAME_TYPES.map(g => `<option value="${g.id}"${(m.gameType||'flappybird')===g.id ? ' selected' : ''}>${g.label}</option>`).join('');

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div class="sec-title" style="margin:0">🎮 ${m.id ? '미션 편집' : '새 미션 만들기'}</div>
      <button class="btn-sm" data-action="mission-editor-cancel">✕ 취소</button>
    </div>

    <div class="section">
      <div class="form">
        <div class="field"><label>미션 제목</label>
          <input id="me-title" type="text" placeholder="예: 플래피 버드 — 점수 시스템" value="${esc(m.title || '')}"/>
        </div>
        <div class="form-row">
          <div class="field"><label>게임 종류</label>
            <select id="me-game-type">${gameOpts}</select>
          </div>
        </div>
        <div class="field"><label>미션 설명 (선택)</label>
          <textarea id="me-desc" placeholder="학생에게 보여줄 간단한 소개">${esc(m.description || '')}</textarea>
        </div>
        ${!m.id ? multiClassPicker('me', TC_CLS?.id) : ''}
      </div>
    </div>

    <div class="sec-title">단계 (순서대로 진행됨)</div>
    <div id="me-steps">${steps.map((s, i) => vMeStepEditor(s, i)).join('')}</div>
    <button class="btn-sm" data-action="me-add-step" style="margin:8px 0 16px">+ 단계 추가</button>

    <div id="me-err" class="err"></div>
    <div style="display:flex;gap:8px;margin-bottom:30px">
      <button class="btn-p" data-action="me-save" data-mid="${m.id || ''}">${m.id ? '미션 수정 저장' : '미션 저장'}</button>
      <button class="btn-sm" data-action="mission-editor-cancel">취소</button>
    </div>
  `;
}

function vMeStepEditor(step, idx){
  const tests = step.tests || [];
  const hooks = GAME_TYPES[0].hooks; // flappybird
  const hookStyle = step.hookStyle || 'variable';

  return `<div class="section me-step" data-sidx="${idx}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-weight:700;font-size:14px">단계 ${idx + 1}</div>
      <div style="display:flex;gap:4px">
        <button class="btn-xs" data-action="me-move-step" data-sidx="${idx}" data-dir="-1">↑</button>
        <button class="btn-xs" data-action="me-move-step" data-sidx="${idx}" data-dir="1">↓</button>
        <button class="btn-xs btn-danger" data-action="me-del-step" data-sidx="${idx}">삭제</button>
      </div>
    </div>

    <div class="form">
      <div class="field"><label>제목</label>
        <input class="me-step-title" type="text" placeholder="예: 점수 변수 만들기" value="${esc(step.title || '')}"/>
      </div>
      <div class="field"><label>설명 (마크다운 지원)</label>
        <textarea class="me-step-desc" style="min-height:80px" placeholder="학생에게 보여줄 문제 설명">${esc(step.description || '')}</textarea>
      </div>
      <div class="field"><label>힌트 (선택)</label>
        <textarea class="me-step-hint" style="min-height:50px" placeholder="막힐 때 펼쳐볼 수 있는 힌트">${esc(step.hint || '')}</textarea>
      </div>
      <div class="field"><label>시작 코드</label>
        <textarea class="me-step-code" style="min-height:80px;font-family:monospace;font-size:13px">${esc(step.starterCode || '')}</textarea>
      </div>

      <div class="field">
        <label>코드 스타일 & 테스트 방식</label>
        <div class="me-hookstyle-opts">
          <label class="me-radio"><input type="radio" name="me-hookstyle-${idx}" class="me-step-hookstyle" value="variable" ${hookStyle==='variable'?'checked':''} data-sidx="${idx}"/> <b>변수</b> — 변수를 만들고 값을 넣는 코드 (예: <code>score = 0</code>)</label>
          <label class="me-radio"><input type="radio" name="me-hookstyle-${idx}" class="me-step-hookstyle" value="block" ${hookStyle==='block'?'checked':''} data-sidx="${idx}"/> <b>코드 블록</b> ⭐ — 게임 이벤트 시 실행되는 코드 (변수가 주어지고, 수정 후 돌려줌)</label>
          <label class="me-radio"><input type="radio" name="me-hookstyle-${idx}" class="me-step-hookstyle" value="function" ${hookStyle==='function'?'checked':''} data-sidx="${idx}"/> <b>함수</b> — <code>def 함수이름(...):</code> 형태</label>
        </div>
      </div>

      ${hookStyle === 'block' ? `
        <div class="form-row">
          <div class="field"><label>입력 변수 (게임이 제공, 쉼표로 구분)</label>
            <input class="me-block-inputs" type="text" placeholder="예: score 또는 score, pipesPassed" value="${esc((step.blockInputs || []).join(', '))}"/>
          </div>
          <div class="field"><label>출력 변수 (게임이 읽어감)</label>
            <input class="me-block-output" type="text" placeholder="예: score" value="${esc(step.blockOutput || '')}"/>
          </div>
        </div>
      ` : ''}

      <div class="field"><label>통과 시 활성화할 게임 기능 (hook)</label>
        <select class="me-step-unlocks">
          <option value="">(없음)</option>
          ${hooks.map(h => `<option value="${h.id}"${step.unlocks === h.id ? ' selected' : ''}>${h.label} — ${h.desc}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <label>테스트 케이스 (모두 통과해야 단계 완료)</label>
        <div class="me-tests" id="me-tests-${idx}">
          ${tests.map((t, ti) => vMeTestEditor(t, idx, ti, hookStyle, step)).join('')}
        </div>
        <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
          ${hookStyle === 'block'
            ? `<button class="btn-xs" data-action="me-add-test" data-sidx="${idx}" data-ttype="block">+ 블록 테스트</button>`
            : hookStyle === 'function'
              ? `<button class="btn-xs" data-action="me-add-test" data-sidx="${idx}" data-ttype="function">+ 함수 호출 테스트</button>`
              : `<button class="btn-xs" data-action="me-add-test" data-sidx="${idx}" data-ttype="variable">+ 변수 테스트</button>`
          }
        </div>
      </div>
    </div>
  </div>`;
}

function vMeTestEditor(t, sidx, tidx, hookStyle, step){
  if(t.type === 'variable'){
    return `<div class="me-test-row" data-tidx="${tidx}">
      <span style="font-size:11px;color:var(--text3);min-width:60px">변수값</span>
      <input class="me-test-name" type="text" placeholder="변수명 (예: score)" value="${esc(t.name || '')}" style="flex:1"/>
      <span>==</span>
      <input class="me-test-expected" type="text" placeholder="기대값 (JSON: 0, 15, &quot;hi&quot;)" value="${esc(typeof t.expected === 'string' ? JSON.stringify(t.expected) : JSON.stringify(t.expected ?? ''))}" style="flex:1"/>
      <input type="hidden" class="me-test-type" value="variable"/>
      <button class="btn-xs btn-danger" data-action="me-del-test" data-sidx="${sidx}" data-tidx="${tidx}">✕</button>
    </div>`;
  }
  if(t.type === 'block'){
    // 블록 테스트: 입력 변수들의 값과 기대 출력값
    const inputsJson = t.inputs ? JSON.stringify(t.inputs) : '{}';
    return `<div class="me-test-row me-test-block" data-tidx="${tidx}">
      <span style="font-size:11px;color:var(--text3);min-width:60px">입력→결과</span>
      <input class="me-test-block-inputs" type="text" placeholder='예: {"score": 0}' value='${esc(inputsJson)}' style="flex:1.3"/>
      <span>→</span>
      <input class="me-test-expected" type="text" placeholder="기대값 (JSON)" value="${esc(JSON.stringify(t.expected ?? ''))}" style="flex:1"/>
      <input type="hidden" class="me-test-type" value="block"/>
      <button class="btn-xs btn-danger" data-action="me-del-test" data-sidx="${sidx}" data-tidx="${tidx}">✕</button>
    </div>`;
  }
  // function call
  return `<div class="me-test-row" data-tidx="${tidx}">
    <span style="font-size:11px;color:var(--text3);min-width:60px">함수호출</span>
    <input class="me-test-call" type="text" placeholder="예: add_score(0)" value="${esc(t.call || '')}" style="flex:1.2"/>
    <span>==</span>
    <input class="me-test-expected" type="text" placeholder="기대값 (JSON)" value="${esc(JSON.stringify(t.expected ?? ''))}" style="flex:1"/>
    <input type="hidden" class="me-test-type" value="function"/>
    <button class="btn-xs btn-danger" data-action="me-del-test" data-sidx="${sidx}" data-tidx="${tidx}">✕</button>
  </div>`;
}

// ── 예제 미션 템플릿 (플래피 버드) — 블록 스타일 (beginner-friendly) ──
function getFlappyBirdSampleMission(){
  return {
    title: '플래피 버드 — 점수 시스템',
    gameType: 'flappybird',
    description: '변수와 산술 연산자를 활용해 플래피 버드의 점수 시스템을 완성해봅시다.',
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: 'step_score_var',
        title: '1️⃣ 점수 변수 만들기',
        description: '## 🎯 목표\n\n게임에서 점수를 저장할 **변수**가 필요합니다.\n\n`score` 라는 이름의 변수를 만들고 **0**으로 초기화하세요.\n\n```python\n변수이름 = 초기값\n```\n\n처음 게임을 시작했을 때는 점수가 0이어야 하니까요!',
        hint: '`score = 0` 처럼 `=` 기호를 사용해 변수에 값을 저장합니다.',
        starterCode: '# 여기에 점수 변수를 만드세요\n',
        tests: [
          {type: 'variable', name: 'score', expected: 0}
        ],
        hookStyle: 'variable',
        unlocks: ''
      },
      {
        id: 'step_add_score',
        title: '2️⃣ 장애물 지날 때 점수 +1',
        description: '## 🎯 목표\n\n**장애물을 하나 지날 때마다** 실행되는 코드를 작성합니다.\n\n- 변수 `score` 에 현재 점수가 이미 주어져 있어요\n- 거기에 **1을 더해서 다시 `score` 에 저장**하면 됩니다\n\n```python\nscore = score + 1\n```\n\n저장 후 실행하면 왼쪽 게임에서 장애물을 지날 때마다 점수가 오릅니다!',
        hint: '`score = score + 1` — 산술 연산자 `+` 로 더한 값을 `=` 로 다시 저장합니다.',
        starterCode: '# score 변수에 현재 점수가 주어져 있어요\n# 1을 더해서 score에 다시 저장하세요\n\n',
        hookStyle: 'block',
        blockInputs: ['score'],
        blockOutput: 'score',
        tests: [
          {type: 'block', inputs: {score: 0}, output: 'score', expected: 1},
          {type: 'block', inputs: {score: 5}, output: 'score', expected: 6},
          {type: 'block', inputs: {score: 99}, output: 'score', expected: 100}
        ],
        unlocks: 'addScore'
      },
      {
        id: 'step_bonus',
        title: '3️⃣ 5개 지나면 1.5배 보너스!',
        description: '## 🎯 목표\n\n장애물을 **5개 이상** 지나면 점수에 **1.5배** 보너스를 주세요.\n\n주어진 변수:\n- `score`: 방금 계산된 점수\n- `pipesPassed`: 지금까지 지난 장애물 개수\n\n**조건:**\n- `pipesPassed` 가 5 이상 → `score` 에 1.5를 곱해서 다시 `score` 에 저장 (소수점 없애려면 `int(...)` 사용)\n- 아니면 아무것도 안 하면 됨\n\n```python\nif pipesPassed >= 5:\n    score = int(score * 1.5)\n```',
        hint: '`if` 조건문 + 산술 연산자 `*` 를 활용하세요.\n소수점이 생기지 않게 `int(score * 1.5)` 로 감싸세요.',
        starterCode: '# score: 현재 점수\n# pipesPassed: 지난 장애물 개수\n# 5 이상이면 score에 1.5를 곱해서 다시 저장\n\n',
        hookStyle: 'block',
        blockInputs: ['score', 'pipesPassed'],
        blockOutput: 'score',
        tests: [
          {type: 'block', inputs: {score: 3, pipesPassed: 3}, output: 'score', expected: 3},
          {type: 'block', inputs: {score: 4, pipesPassed: 4}, output: 'score', expected: 4},
          {type: 'block', inputs: {score: 10, pipesPassed: 5}, output: 'score', expected: 15},
          {type: 'block', inputs: {score: 20, pipesPassed: 7}, output: 'score', expected: 30},
          {type: 'block', inputs: {score: 100, pipesPassed: 10}, output: 'score', expected: 150}
        ],
        unlocks: 'finalScore'
      }
    ]
  };
}
