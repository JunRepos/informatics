/* ═══════════════════════════════════════
   views/mission.js — 게임 미션 (플래피 버드 등)

   학생: 게임 좌측, 미션 단계별 코드 작성 우측
   선생님: 미션 CRUD + 에디터
═══════════════════════════════════════ */

const GAME_TYPES = [
  {id:'flappybird', label:'🐦 플래피 버드', hooks:[
    {id:'gameStartScore', label:'gameStartScore', desc:'게임 시작/재시작 시 점수 (변수 score 읽음)'},
    {id:'welcomeMessage', label:'welcomeMessage', desc:'시작 화면 메시지 (변수 greeting 읽음)'},
    {id:'addScore', label:'addScore(score)', desc:'장애물 하나 지날 때 호출 — 새 점수를 반환'},
    {id:'finalScore', label:'finalScore(score, pipesPassed)', desc:'addScore 결과에 추가 적용 (보너스 등)'},
    {id:'gameOverBonus', label:'gameOverBonus(score, pipesPassed)', desc:'게임 오버 시 보너스 (최종 점수 변경)'},
    {id:'speedConfig', label:'speedConfig', desc:'입력받은 speed 값으로 게임 속도 조절'},
    {id:'levelCalc', label:'levelCalc(pipesPassed)', desc:'레벨 계산 (좌상단 Lv.N + 배경 변화)'}
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

          ${step.experiment ? `<div class="mi-experiment">
            <div class="mi-exp-title">🎨 자유롭게 바꿔보세요!</div>
            <div class="mi-exp-body">${typeof marked !== 'undefined' ? marked.parse(step.experiment) : esc(step.experiment)}</div>
          </div>` : ''}

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
  if(!Array.isArray(results) || !results.length) return '';

  // 모두 통과: 큼지막한 축하 메시지
  if(allPassed){
    // 내가 만든 변수들의 값을 보여줌 (학생이 어떤 값을 넣었는지 피드백)
    const values = [];
    const seen = new Set();
    for(const r of results){
      if(r.type === 'exists' && r.name && !seen.has(r.name)){
        seen.add(r.name);
        if(r.actual !== undefined && r.actual !== null){
          values.push(`<code>${esc(r.name)}</code> = <b>${esc(JSON.stringify(r.actual))}</b>`);
        }
      }
    }
    const valueLine = values.length
      ? `<div class="mi-success-vars">${values.join(' · ')}</div>`
      : '';
    return `<div class="mi-results">
      <div class="mi-success-big">
        <div class="mi-success-title">🎉 적용 완료!</div>
        <div class="mi-success-sub">왼쪽 게임에서 바로 확인해보세요 →</div>
        ${valueLine}
      </div>
    </div>`;
  }

  // 실패: 친절한 에러 메시지만
  const items = results.filter(r => !r.ok).map((r) => {
    if(r.error){
      return `<div class="mi-test-item fail">
        <span class="mi-test-icon">⚠️</span>
        <div>
          <div class="mi-test-label">코드 실행 중 오류가 발생했어요</div>
          <pre class="mi-test-detail">${esc(r.error)}</pre>
        </div>
      </div>`;
    }
    if(r.type === 'exists'){
      const typeLabel = r.typeOf ? ` (<code>${r.typeOf}</code> 자료형이어야 함)` : '';
      let msg;
      if(r.actual === undefined || r.actual === null){
        msg = `아직 <code>${esc(r.name)}</code> 변수가 만들어지지 않았어요.${typeLabel}`;
      } else {
        msg = `<code>${esc(r.name)}</code>의 자료형이 맞지 않아요.${typeLabel}<br>현재 값: <b>${esc(JSON.stringify(r.actual))}</b>`;
      }
      return `<div class="mi-test-item fail">
        <span class="mi-test-icon">✗</span>
        <div><div class="mi-test-label">${msg}</div></div>
      </div>`;
    }
    return '';
  }).filter(Boolean).join('');

  return `<div class="mi-results">${items}</div>`;
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

// ── 예제 미션 템플릿 (플래피 버드) — 7단계: 변수→문자열→덧셈→곱셈→입력→몫→창작 ──
function getFlappyBirdSampleMission(){
  return {
    title: '플래피 버드 — 내 손으로 완성하는 게임',
    gameType: 'flappybird',
    description: '변수, 문자열, 산술 연산자, 입력, 자료형 변환을 하나씩 배우며 플래피 버드를 완성합니다. 마지막엔 나만의 공식으로 최고 점수에 도전!',
    createdAt: new Date().toISOString(),
    steps: [
      // ═══ 1단계: 변수 (=) ═══
      {
        id: 'step_score_var',
        title: '1️⃣ 점수판 만들기 — 변수 선언',
        description: '## 🎯 목표\n\n게임에 점수판이 보이지 않네요! **`score`** 라는 변수를 만들어 **시작 점수**를 저장해봅시다.\n\n```python\nscore = 0       # 0점으로 시작\nscore = 100     # 100점으로 시작도 가능!\n```\n\n👉 코드를 저장하고 실행하면 왼쪽 게임 화면에 **내가 정한 숫자가 딱 나타납니다** ✨\n\n### 💡 개념: 변수\n- **변수**란? 값을 담는 "상자". 이름을 붙여서 저장하고 꺼낼 수 있어요\n- **`=`** 기호는 "오른쪽 값을 왼쪽 변수에 넣어라" 는 뜻\n- 수학의 등호(=)와 달라요! `score = 0` 은 **"score에 0을 저장"** 입니다',
        experiment: '어떤 숫자를 넣든 OK. 여러 가지로 시도해봐요!\n\n- `score = 9999` — 무한대 느낌\n- `score = -100` — 음수로 시작! 점수가 마이너스부터 시작돼요\n- `score = 2025` — 올해 연도\n\n**실행 & 테스트**를 누르면 게임이 리셋되면서 새 점수로 시작합니다.',
        hint: '변수 만드는 법: `변수이름 = 값`\n\n```python\nscore = 0\n```',
        starterCode: '# score 변수에 원하는 숫자를 저장해보세요\n# 예) score = 0    /    score = 100\n\n',
        tests: [
          {type: 'exists', name: 'score', typeOf: 'number'}
        ],
        hookStyle: 'variable',
        unlocks: 'gameStartScore'
      },

      // ═══ 2단계: 문자열 + 문자열 결합 ═══
      {
        id: 'step_greeting',
        title: '2️⃣ 환영 메시지 — 문자열과 합치기',
        description: '## 🎯 목표\n\n게임 시작할 때 **내 이름으로 인사**하는 메시지를 띄워봅시다!\n\n```python\nname = "내이름"\ngreeting = "환영해, " + name + "!"\n```\n\n👉 저장하면 왼쪽 게임 **시작 화면에 내 맞춤 메시지**가 뜹니다 💌\n\n### 💡 개념: 문자열(str)과 결합\n- **문자열** = 글자들의 묶음. 항상 **따옴표**로 감쌉니다: `"안녕"`, `\'hello\'`\n- 문자열끼리 **`+`** 로 이어 붙일 수 있어요!\n  - `"안녕" + " " + "친구"` → `"안녕 친구"`\n- 숫자 `+` 숫자 = 합계, 문자열 `+` 문자열 = 연결 (똑같은 `+` 지만 하는 일이 달라요!)',
        experiment: '메시지를 내 스타일로 꾸며보세요!\n\n- `name = input()` — 이름을 매번 입력받기 (이름 물어봐줌!)\n- `greeting = "🎮 " + name + " 🎮 게임 시작!"`\n- `greeting = name + "은(는) 오늘의 챔피언!"`\n- `greeting = "난 " + name + ", 최고가 될 거야"`\n\n친구 이름 넣고 서로 게임해봐도 재밌어요 😄',
        hint: '1) 먼저 `name = "이름"` 으로 내 이름 저장\n2) `greeting = "환영해, " + name + "!"` 로 합치기\n3) 따옴표 꼭 붙이기!\n\n```python\nname = "김학생"\ngreeting = "환영해, " + name + "!"\n```',
        starterCode: '# 1. name 변수에 내 이름 저장 (따옴표 꼭!)\n# 2. greeting 변수에 "환영해, " + name + "!" 저장\n\n',
        tests: [
          {type: 'exists', name: 'greeting', typeOf: 'string'}
        ],
        hookStyle: 'variable',
        unlocks: 'welcomeMessage'
      },

      // ═══ 3단계: 덧셈 (+) ═══
      {
        id: 'step_add_score',
        title: '3️⃣ 장애물마다 점수 +1 — 덧셈 연산자',
        description: '## 🎯 목표\n\n지금은 점수가 멈춰 있죠? 장애물을 지날 때마다 **1점씩 올라가게** 해봅시다.\n\n주어진 변수:\n- `score`: 현재 점수\n\n```python\nscore = score + 1\n```\n\n👉 저장하면 장애물 지날 때마다 **점수가 1씩 올라갑니다**!\n\n### 💡 개념: 덧셈과 변수 재할당\n- `score + 1` → 현재 score에 1을 **더한 값**\n- `score = score + 1` → 그 값을 **다시 score에 저장**\n- 오른쪽부터 계산 → 왼쪽에 저장 (이 순서 중요!)',
        experiment: '- `score = score + 5` — 한 번에 5점씩 올리기\n- `score = score + 100` — 100점씩!\n- `score = score - 1` — **뺄셈**! 점수가 줄어들어요 😱\n- `score = score + 1` — 기본\n\n음수를 넣어도 되고, 뺄셈도 되고, 0이면 점수 안 변해요. 자유롭게!',
        hint: '`score`에 값을 더한 결과를 다시 `score`에 저장:\n\n```python\nscore = score + 1\n```',
        starterCode: '# score에 1을 더해서 다시 score에 저장하세요\n\n',
        hookStyle: 'block',
        blockInputs: ['score'],
        blockOutput: 'score',
        tests: [
          {type: 'exists', name: 'score', typeOf: 'number', inputs: {score: 0}},
          {type: 'exists', name: 'score', typeOf: 'number', inputs: {score: 50}}
        ],
        unlocks: 'addScore'
      },

      // ═══ 4단계: 곱셈 (*) with multiplier variable ═══
      {
        id: 'step_multiplier',
        title: '4️⃣ 점수 배수기! — 곱셈 연산자',
        description: '## 🎯 목표\n\n점수가 너무 천천히 올라가나요? **배수기**를 만들어서 점수를 **폭발적**으로 늘려봅시다! 💥\n\n주어진 변수:\n- `score`: 방금 +1된 점수 (3단계 결과)\n\n```python\nmultiplier = 2\nscore = score * multiplier\n```\n\n👉 `multiplier = 2` 면 장애물 지날 때마다 점수가 **2배**씩 커져요!\n- 1 → 2 → 6 → 14 → 30 → 62 → 126... (폭발 🔥)\n\n### 💡 개념: 곱셈과 변수 활용\n- **`*`** 가 곱셈 기호 (수학의 ×)\n- `score * multiplier` → score와 multiplier를 곱한 값\n- `multiplier` 변수 하나만 바꾸면 게임 전체가 달라져요! (코드 한 곳 수정으로 전체 변화)',
        experiment: '`multiplier` 값을 바꿔가며 반응을 확인해봐요:\n\n- `multiplier = 1` — 아무 효과 없음 (곱해도 그대로)\n- `multiplier = 2` — 기본 (2배씩)\n- `multiplier = 3` — 3배씩 더 폭발적!\n- `multiplier = 10` — 🤯 미친 속도로 증가\n- `multiplier = 0.5` — 반대! 점수가 줄어들어요\n- `multiplier = 0` — 어?! 점수가 0으로 리셋 됨!\n\n**왜 `multiplier`를 변수로 따로 뺐을까요?** → 값을 바꾸기 쉽고, 나중에 "배수기 파워업" 같은 기능 추가하기도 편해요.',
        hint: '1) `multiplier = 2` 로 배수 변수 만들기\n2) `score = score * multiplier` 로 score에 곱하기\n\n```python\nmultiplier = 2\nscore = score * multiplier\n```',
        starterCode: '# 1. multiplier 변수에 배수 값 저장 (예: 2)\n# 2. score에 multiplier 를 곱해서 다시 score에 저장\n\n',
        hookStyle: 'block',
        blockInputs: ['score'],
        blockOutput: 'score',
        tests: [
          {type: 'exists', name: 'multiplier', typeOf: 'number', inputs: {score: 5}},
          {type: 'exists', name: 'score', typeOf: 'number', inputs: {score: 5}}
        ],
        unlocks: 'finalScore'
      },

      // ═══ 5단계: 입력 + 형변환 ═══
      {
        id: 'step_speed_input',
        title: '5️⃣ 속도 조절 — 입력과 자료형 변환',
        description: '## 🎯 목표\n\n게임 속도를 **직접 입력**해서 조절해봅시다!\n\n```python\nspeed = float(input())\n```\n\n👉 실행하면 **팝업이 뜨고**, 학생이 속도값을 입력해요. 그 값대로 게임 속도가 바뀝니다!\n- **0.5** → 슬로우 모션 🐢\n- **1** → 기본\n- **2** → 빠름 🚀\n\n### 💡 개념: input() 과 형변환 (float)\n- **`input()`** → 사용자로부터 값을 받아옴. 근데 **항상 문자열 `str`** 로 돌아와요!\n- 숫자로 쓰려면 **변환**이 필요:\n  - `int("1")` → `1` (정수)\n  - `float("1.5")` → `1.5` (실수)\n\n`float()` 로 감싸야 `1.5` 같은 소수점도 받을 수 있어요!',
        experiment: '입력값을 여러 가지로 넣어봐요 (팝업 창에 타이핑):\n\n- **`0.3`** — 초슬로우 (거의 멈춤 🐌)\n- **`1`** — 기본\n- **`2.5`** — 빠름!\n- **`3`** — 폭주 🔥\n\n### 🧪 실험: `float()` 대신 `int(input())`을 써볼까?\n```python\nspeed = int(input())\n```\n- `2` 입력 → ✅ 작동\n- `1.5` 입력 → ❌ 오류!\n\n왜냐? `int()`는 정수만 받거든요. 소수점 있는 값도 받으려면 **꼭 `float()`** 를 써야 해요!',
        hint: '`input()`은 문자열을 받아오므로 `float()`으로 감싸야 숫자로 쓸 수 있어요:\n\n```python\nspeed = float(input())\n```',
        starterCode: '# input()으로 속도값을 받아 float으로 변환하고 speed에 저장\n\n',
        hookStyle: 'variable',
        unlocks: 'speedConfig',
        tests: [
          {type: 'exists', name: 'speed', typeOf: 'number'}
        ]
      },

      // ═══ 6단계: 몫 (//) + 배경 변화 ═══
      {
        id: 'step_level_system',
        title: '6️⃣ 레벨 시스템 — 몫 연산자 & 배경 변화',
        description: '## 🎯 목표\n\n장애물 **5개 지날 때마다 레벨 1 증가** + 레벨마다 **배경이 변합니다**!\n\n주어진 변수:\n- `pipesPassed`: 지금까지 지난 장애물 개수\n\n```python\nlevel = pipesPassed // 5\n```\n\n### 💡 개념: 몫 연산자 `//`\n- `a // b` = `a`를 `b`로 나눈 **몫** (정수 부분만)\n- `17 // 5` = **3** (17÷5 = 3...나머지 2)\n- `10 // 5` = **2**\n- `4 // 5` = **0** (4는 5보다 작으므로)\n\n### 🎮 게임 효과\n- **Lv.0** 낮 ☀️ → **Lv.1** 아침노을 🌤️ → **Lv.2** 석양 🌇\n- **Lv.3** 황혼 💜 → **Lv.4** 밤 🌙 → **Lv.5+** 우주 🌌\n\n장애물 많이 지날수록 세계가 변해요! ⭐',
        experiment: '레벨 공식을 바꾸면 **세계 전환 속도**가 달라져요:\n\n- `level = pipesPassed // 3` — 3개마다 레벨업 (우주까지 빨리!)\n- `level = pipesPassed // 10` — 10개마다 (천천히 음미)\n- `level = pipesPassed // 1` — 장애물 하나마다! ⚡\n- `level = pipesPassed` — 몫 없이 그대로 (곧바로 우주)\n\n**일반 나눗셈(`/`)** 은 소수점 결과가 나와요: `10 / 3` = `3.333...`  \n**몫(`//`)** 은 정수만: `10 // 3` = `3`\n\n레벨은 정수여야 하니 `//`가 딱!',
        hint: '`//` 연산자로 몫을 구합니다:\n\n```python\nlevel = pipesPassed // 5\n```',
        starterCode: '# pipesPassed를 5로 나눈 몫을 level 변수에 저장\n\n',
        hookStyle: 'block',
        blockInputs: ['pipesPassed'],
        blockOutput: 'level',
        unlocks: 'levelCalc',
        tests: [
          {type: 'exists', name: 'level', typeOf: 'number', inputs: {pipesPassed: 0}},
          {type: 'exists', name: 'level', typeOf: 'number', inputs: {pipesPassed: 15}}
        ]
      },

      // ═══ 7단계: 자유 창작 (최종) ═══
      {
        id: 'step_final_formula',
        title: '7️⃣ 🎨 나만의 점수 공식 — 최종 보스!',
        description: '## 🎯 최종 도전\n\n게임이 끝날 때 **나만의 공식**으로 최종 점수를 계산해서 **친구들과 최고 점수 대결!** 🏆\n\n주어진 변수:\n- `score`: 현재까지 모은 점수\n- `pipesPassed`: 지난 장애물 개수\n\n```python\n# 네 마음대로 공식을 만들어!\nscore = ???\n```\n\n### 💡 여태껏 배운 모든 걸 써보자\n- **덧셈 `+`** — 값을 더하기\n- **곱셈 `*`** — 값을 곱하기\n- **뺄셈 `-`** — 값을 빼기\n- **나눗셈 `/`** — 나누기 (실수)\n- **몫 `//`** — 나누기 (정수)\n- **거듭제곱 `**`** — 제곱\n\n정답은 없어요! **내 스타일**대로 만들면 됩니다. 🎨',
        experiment: '### 💪 도전 예시들\n\n**기본형**\n- `score = score * 2` — 그냥 2배\n- `score = score + 100` — 보너스 100점\n\n**중급형**\n- `score = score + pipesPassed * 10` — 장애물 개수 × 10 보너스\n- `score = score * 2 + pipesPassed` — 점수 2배 + 장애물 개수\n\n**고급형 (폭발적!)**\n- `score = score ** 2` — 점수 자체를 **제곱** 💥\n- `score = score + pipesPassed ** 2` — 제곱 보너스\n- `score = score * pipesPassed + 500` — 장애물 × 점수 + 500\n\n**미친 공식**\n- `score = (score + pipesPassed) ** 2 // 2` — 합쳐서 제곱 후 절반\n- `score = score * 1000 - pipesPassed ** 3` — 천배 곱 - 세제곱\n\n### 🏆 친구랑 대결\n1. 각자 공식 만들기\n2. 같은 게임 플레이 (예: 장애물 10개씩)\n3. 최종 점수 비교 → **공식이 좋은 사람이 승자!** 😎',
        hint: '제약 없어요! 배운 연산자 중 뭐든 쓰세요.\n\n간단한 예부터:\n```python\nscore = score * 2\n```\n\n그 다음 더 복잡하게:\n```python\nscore = score + pipesPassed ** 2\n```',
        starterCode: '# 🎨 나만의 최종 점수 공식\n# score와 pipesPassed를 활용해 자유롭게!\n# 정답은 없어요. 친구랑 점수 대결해보세요!\n\n',
        hookStyle: 'block',
        blockInputs: ['score', 'pipesPassed'],
        blockOutput: 'score',
        unlocks: 'gameOverBonus',
        tests: [
          {type: 'exists', name: 'score', typeOf: 'number', inputs: {score: 10, pipesPassed: 5}},
          {type: 'exists', name: 'score', typeOf: 'number', inputs: {score: 100, pipesPassed: 20}}
        ]
      }
    ]
  };
}
