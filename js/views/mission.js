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

      <div class="field"><label>통과 시 활성화할 게임 기능 (hook)</label>
        <select class="me-step-unlocks">
          <option value="">(없음)</option>
          ${hooks.map(h => `<option value="${h.id}"${step.unlocks === h.id ? ' selected' : ''}>${h.label} — ${h.desc}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <label>테스트 케이스 (모두 통과해야 단계 완료)</label>
        <div class="me-tests" id="me-tests-${idx}">
          ${tests.map((t, ti) => vMeTestEditor(t, idx, ti)).join('')}
        </div>
        <div style="display:flex;gap:6px;margin-top:4px">
          <button class="btn-xs" data-action="me-add-test" data-sidx="${idx}" data-ttype="variable">+ 변수 테스트</button>
          <button class="btn-xs" data-action="me-add-test" data-sidx="${idx}" data-ttype="function">+ 함수 호출 테스트</button>
        </div>
      </div>
    </div>
  </div>`;
}

function vMeTestEditor(t, sidx, tidx){
  if(t.type === 'variable'){
    return `<div class="me-test-row" data-tidx="${tidx}">
      <span style="font-size:11px;color:var(--text3);min-width:60px">변수값</span>
      <input class="me-test-name" type="text" placeholder="변수명 (예: score)" value="${esc(t.name || '')}" style="flex:1"/>
      <span>==</span>
      <input class="me-test-expected" type="text" placeholder="기대값 (JSON: 0, 15, 1.5, \&quot;hi\&quot;, [1,2])" value="${esc(typeof t.expected === 'string' ? JSON.stringify(t.expected) : JSON.stringify(t.expected ?? ''))}" style="flex:1"/>
      <input type="hidden" class="me-test-type" value="variable"/>
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

// ── 예제 미션 템플릿 (플래피 버드) ──
function getFlappyBirdSampleMission(){
  return {
    title: '플래피 버드 — 점수 시스템',
    gameType: 'flappybird',
    description: '변수, 산술 연산자, 조건문을 활용해 플래피 버드의 점수 시스템을 완성해봅시다.',
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
        unlocks: ''
      },
      {
        id: 'step_add_score',
        title: '2️⃣ 장애물 지날 때 점수 +1',
        description: '## 🎯 목표\n\n장애물을 하나 지날 때마다 점수를 **1점씩** 올리는 함수를 만듭니다.\n\n함수 이름은 `addScore`, 파라미터는 현재 점수 `score`.\n**새 점수 (score + 1)** 를 반환하세요.\n\n```python\ndef addScore(score):\n    return score + 1\n```\n\n저장 후 실행하면 왼쪽 게임에서 장애물을 지날 때마다 점수가 오르는 걸 볼 수 있어요!',
        hint: '`return` 키워드로 함수의 결과를 돌려줍니다.\n`score + 1` 같은 **산술 연산자(+)** 를 활용하세요.',
        starterCode: 'def addScore(score):\n    # 현재 score에 1을 더한 값을 반환하세요\n    pass\n',
        tests: [
          {type: 'function', call: 'addScore(0)', expected: 1},
          {type: 'function', call: 'addScore(5)', expected: 6},
          {type: 'function', call: 'addScore(99)', expected: 100}
        ],
        unlocks: 'addScore'
      },
      {
        id: 'step_bonus',
        title: '3️⃣ 5개 지나면 1.5배 보너스!',
        description: '## 🎯 목표\n\n장애물을 **5개 이상** 지났을 때부터는 점수에 **1.5배** 를 곱하는 함수를 만듭니다.\n\n함수 이름: `finalScore(score, pipesPassed)`\n- `score`: 방금 계산된 점수\n- `pipesPassed`: 지금까지 지난 장애물 개수\n\n**조건:**\n- `pipesPassed < 5` → 점수 그대로 반환\n- `pipesPassed >= 5` → 점수에 1.5를 곱해서 반환 (결과는 정수로 변환: `int(...)`)\n\n```python\ndef finalScore(score, pipesPassed):\n    if pipesPassed >= 5:\n        return int(score * 1.5)\n    else:\n        return score\n```',
        hint: '조건문 `if / else` 를 사용합니다.\n소수점이 생기지 않게 `int()` 로 감싸세요.',
        starterCode: 'def finalScore(score, pipesPassed):\n    # pipesPassed가 5 이상이면 score에 1.5를 곱해서 반환\n    # 아니면 score를 그대로 반환\n    pass\n',
        tests: [
          {type: 'function', call: 'finalScore(3, 3)', expected: 3},
          {type: 'function', call: 'finalScore(4, 4)', expected: 4},
          {type: 'function', call: 'finalScore(10, 5)', expected: 15},
          {type: 'function', call: 'finalScore(20, 7)', expected: 30},
          {type: 'function', call: 'finalScore(100, 10)', expected: 150}
        ],
        unlocks: 'finalScore'
      }
    ]
  };
}
