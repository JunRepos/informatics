/* ═══════════════════════════════════════
   views/mission.js — 게임 미션 (플래피 버드 등)

   학생: 게임 좌측, 미션 단계별 코드 작성 우측
   선생님: 미션 CRUD + 에디터
═══════════════════════════════════════ */

const GAME_TYPES = [
  {id:'flappybird', label:'🐦 플래피 버드', hooks:[
    {id:'gameStartScore', label:'gameStartScore', desc:'게임 시작/재시작 시 점수 (변수 score 읽음)'},
    {id:'addScore', label:'addScore(score)', desc:'장애물 하나 지날 때 호출 — 새 점수를 반환'},
    {id:'finalScore', label:'finalScore(score, pipesPassed)', desc:'addScore 결과에 추가 적용 (보너스 등)'},
    {id:'gameOverBonus', label:'gameOverBonus(score, pipesPassed)', desc:'게임 오버 시 보너스 (최종 점수 변경)'},
    {id:'speedConfig', label:'speedConfig', desc:'입력받은 speed 값으로 게임 속도 조절'}
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

    let label, detail;
    if(r.type === 'exists'){
      const typeLabel = r.typeOf ? ` (${r.typeOf} 타입)` : '';
      label = `변수 <code>${esc(r.name)}</code>${typeLabel} 존재 확인`;
      detail = r.stdin !== undefined
        ? `입력 <code>${esc(r.stdin)}</code> → 결과 <b>${esc(JSON.stringify(r.actual))}</b>`
        : `결과 <b>${esc(JSON.stringify(r.actual))}</b>`;
    } else if(r.type === 'variable'){
      label = `변수 <code>${esc(r.name)}</code>`;
      detail = `기대 <b>${esc(JSON.stringify(r.expected))}</b> · 결과 <b>${esc(JSON.stringify(r.actual))}</b>`;
    } else if(r.type === 'block'){
      const inputStr = r.stdin !== undefined
        ? `입력 <code>${esc(r.stdin)}</code>`
        : (r.inputs ? `<code>${esc(JSON.stringify(r.inputs))}</code>` : '');
      label = `${inputStr} → 변수 <code>${esc(r.output)}</code>`;
      detail = `기대 <b>${esc(JSON.stringify(r.expected))}</b> · 결과 <b>${esc(JSON.stringify(r.actual))}</b>`;
    } else {
      label = `<code>${esc(r.call)}</code>`;
      detail = `기대 <b>${esc(JSON.stringify(r.expected))}</b> · 결과 <b>${esc(JSON.stringify(r.actual))}</b>`;
    }

    return `<div class="mi-test-item ${r.ok ? 'pass' : 'fail'}">
      <span class="mi-test-icon">${r.ok ? '✓' : '✗'}</span>
      <div>
        <div class="mi-test-label">${label}</div>
        <div class="mi-test-detail">${detail}</div>
      </div>
    </div>`;
  }).join('');

  return `<div class="mi-results">
    ${allPassed ? `<div class="mi-success">🎉 모든 테스트 통과! 왼쪽 게임에 적용됐어요.</div>` : ''}
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

// ── 예제 미션 템플릿 (플래피 버드) — 변수 / 형변환 / 입력 ──
function getFlappyBirdSampleMission(){
  return {
    title: '플래피 버드 — 변수·자료형·입력',
    gameType: 'flappybird',
    description: '변수, 자료형 변환, 입력을 활용해 플래피 버드를 내 마음대로 꾸며보세요!',
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: 'step_score_var',
        title: '1️⃣ score 변수 만들기 — 시작 점수 정하기',
        description: '## 🎯 목표\n\n**score 변수**를 만들어 원하는 숫자를 저장해보세요.\n\n저장한 값이 **왼쪽 게임 화면 상단에 바로 표시**됩니다!\n\n```python\nscore = 0        # 0점으로 시작\nscore = 100      # 100점으로 시작\n```\n\n숫자를 바꾸면서 실행해 봐요. 어떤 숫자든 OK! 🎮',
        hint: '`score = 원하는숫자` 처럼 `=` 기호로 값을 저장합니다.\n정수(0, 100, 50)면 OK!',
        starterCode: '# score 변수에 원하는 숫자를 저장하세요\n\nscore = 0\n',
        tests: [
          {type: 'exists', name: 'score', typeOf: 'number'}
        ],
        hookStyle: 'variable',
        unlocks: 'gameStartScore'
      },
      {
        id: 'step_plus_float',
        title: '2️⃣ 자료형 변환 + 덧셈 — 장애물마다 +0.5',
        description: '## 🎯 목표\n\n장애물을 지날 때마다 **0.5점씩** 더해봅시다!\n\n1. `plus` 변수를 만들고 **0.5** 저장\n2. `score`를 **`float`형으로 변환**\n3. `score`에 `plus`만큼 더해서 다시 저장\n\n```python\nplus = 0.5\nscore = float(score) + plus\n```\n\n✨ **왜 float 변환?**\n`score`는 1단계에서 정수(int)로 만들었어요. 거기에 0.5(float)를 더할 때 **자료형을 맞춰주면** 의도가 명확해집니다.\n\n성공하면 장애물 지날 때마다 0.5씩 오릅니다! (0 → 0.5 → 1.0 → 1.5 ...)',
        hint: '`float(값)`은 정수를 실수로 바꿔줘요.\n1) `plus = 0.5`\n2) `score = float(score) + plus`',
        starterCode: '# plus 변수에 0.5 저장\n# score를 float으로 변환 후 plus 만큼 더해서 score에 다시 저장\n\n',
        hookStyle: 'block',
        blockInputs: ['score'],
        blockOutput: 'score',
        tests: [
          {type: 'block', inputs: {score: 0}, output: 'plus', expected: 0.5},
          {type: 'block', inputs: {score: 0}, output: 'score', expected: 0.5},
          {type: 'block', inputs: {score: 10}, output: 'score', expected: 10.5},
          {type: 'block', inputs: {score: 3}, output: 'score', expected: 3.5}
        ],
        unlocks: 'addScore'
      },
      {
        id: 'step_speed_input',
        title: '3️⃣ 입력(input) — 게임 속도 조절!',
        description: '## 🎯 목표\n\n사용자로부터 **속도값**을 입력받아 `speed` 변수에 저장하세요.\n\n```python\nspeed = float(input())\n```\n\n- `input()` → 사용자로부터 값을 받아옴 (항상 **문자열** 형태)\n- `float(...)` → 실수로 변환해야 계산 가능!\n\n실행하면 **장애물 속도가 바뀝니다**:\n- **0.5** → 슬로우 모션 🐢\n- **1** → 보통 속도\n- **2** → 빠른 속도 🚀\n\n💡 0.3 ~ 3 사이 값을 넣어보세요!',
        hint: '`input()`은 값을 받아오지만 **문자열**이에요!\n숫자로 쓰려면 `float(...)` 로 감싸야 합니다.\n\n```python\nspeed = float(input())\n```',
        starterCode: '# input() 으로 속도값을 받고 float 으로 변환하여 speed 에 저장\n\n',
        hookStyle: 'variable',
        unlocks: 'speedConfig',
        tests: [
          {type: 'exists', name: 'speed', typeOf: 'number', stdin: '1.5'},
          {type: 'block', stdin: '0.8', output: 'speed', expected: 0.8},
          {type: 'block', stdin: '2', output: 'speed', expected: 2}
        ]
      }
    ]
  };
}
