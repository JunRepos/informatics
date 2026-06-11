/* ═══════════════════════════════════════
   views/mlproj.js — 🧩 AI 프로젝트 매니저 (5차시: 기계학습으로 문제 해결)

   교과서(기계학습의 구현) 4단계 + 오렌지3 캔버스 차용.
   흐름: 문제 선택 → ① 의뢰 브리핑·문제 정의(목표/단서/ML판단)
        → ②~④ 캔버스(위젯 조립 → 학습 애니메이션 → 평가) → ⑤ 성찰(재료 제공)
   정의: ml-project-data.js (MLP_LIST) · 이벤트: events/mlproj.js
═══════════════════════════════════════ */

/* ─────────────────── 위젯 메타 / 슬롯 ─────────────────── */

const MLP_W = {
  data:     { icon: '📁', label: '데이터' },
  split:    { icon: '✂️', label: '나누기' },
  logistic: { icon: '📊', label: '로지스틱' },
  tree:     { icon: '🌳', label: '결정 트리' },
  knn:      { icon: '👥', label: 'kNN' },
  linreg:   { icon: '📈', label: '선형회귀' },
  kmeans:   { icon: '🎯', label: 'k-평균' },
  score:    { icon: '🧪', label: '성적표' },
  predict:  { icon: '🔍', label: '예측 보기' },
  groups:   { icon: '🗂️', label: '그룹 보기' },
};

// 팔레트에는 모든 유형의 모델을 노출 — 학생이 유형 가설을 직접 실험으로 검증한다
function _mlpPaletteList(task){
  if(task === 'clustering') return ['data', 'kmeans', 'logistic', 'tree', 'knn', 'linreg', 'groups'];
  return ['data', 'split', 'logistic', 'tree', 'knn', 'linreg', 'kmeans', 'score', 'predict'];
}
// 이 문제 유형과 "맞는" 모델들 (성적표·예측 등 정상 파이프라인 대상)
function _mlpModelIds(task){
  if(task === 'regression') return ['linreg'];
  if(task === 'clustering') return ['kmeans'];
  return ['logistic', 'tree', 'knn'];
}
function _mlpAllModelIds(){ return ['logistic', 'tree', 'knn', 'linreg', 'kmeans']; }
const MLP_MODEL_GROUPS = { classification: ['logistic', 'tree', 'knn'], regression: ['linreg'], clustering: ['kmeans'] };

// 캔버스 고정 슬롯 (px)
const MLP_NODE_W = 126, MLP_NODE_H = 46;
function _mlpSlot(id){
  const task = MLP_SEL ? MLP_SEL.task : 'classification';
  const C = task === 'clustering'
    ? { data: [20, 128], logistic: [240, 8], tree: [240, 68], kmeans: [240, 128], knn: [240, 188], linreg: [240, 248], groups: [430, 128] }
    : { data: [8, 128], split: [150, 128], logistic: [294, 8], tree: [294, 68], knn: [294, 128], linreg: [294, 188], kmeans: [294, 248], score: [452, 68], predict: [452, 208] };
  return C[id] || [8, 8];
}

/* ─────────────────── 공용 헬퍼 ─────────────────── */

// 학습에 쓸 특징 키 — 모든 유형에서 학생이 고른 단서 사용 (미선택 시 미끼 제외 전체)
function _mlpFeatKeys(){
  const scn = MLP_SEL;
  if(!scn) return [];
  const picked = MLP_ANSWERS.featPick;
  if(Array.isArray(picked) && picked.length){
    const keys = picked.filter(k => scn.features.some(f => f.key === k));
    if(keys.length) return keys;
  }
  return scn.features.filter(f => !f.decoy).map(f => f.key);
}
function _mlpFeatLabel(scn, key){
  const f = (scn.features || []).find(f => f.key === key);
  return f ? f.label : key;
}
function _mlpMetricLabel(scn){
  if(scn.task === 'regression') return 'R²(설명력)';
  if(scn.task === 'clustering') return '군집 순도';
  return '테스트 정확도';
}
function _mlpTrainedCount(){ return Object.keys(MLP_COMPARE || {}).length; }
function _mlpHasEdge(a, b){ return MLP_CV && MLP_CV.edges.includes(a + '>' + b); }
function _mlpModelInto(target){   // target(score/predict)에 연결된 모델들
  if(!MLP_CV) return [];
  return MLP_CV.edges.filter(e => e.endsWith('>' + target)).map(e => e.split('>')[0])
    .filter(m => _mlpModelIds(MLP_SEL.task).includes(m));
}

/* ─────────────────── 진입/분기 ─────────────────── */

function _vStMlProject(){
  if(!MLP_SEL) return _vStMlpPick();
  const scn = MLP_SEL;
  if(MLP_LOADING){
    return `<div class="back-btn" data-action="mlp-back">← 문제 목록으로</div>
      <div class="section"><div class="ml-sub-explain">⏳ 내 기록을 불러오는 중…</div></div>`;
  }
  const bar = _mlpStepBar(scn);
  let body;
  if(scn.task === 'none'){
    body = MLP_STEP < 5 ? _vStMlpDefine() : _vStMlpReflect();
  }
  else if(MLP_STEP === 1) body = _vStMlpDefine();
  else if(MLP_STEP === 2) body = _vStMlpCanvas();
  else body = _vStMlpReflect();
  return `<div class="back-btn" data-action="mlp-back">← 문제 목록으로</div>${bar}${body}`;
}

/* 문제 선택 */
function _vStMlpPick(){
  const cards = MLP_LIST.map(m => {
    const tagCls = m.tag === '메인' ? 'main' : (m.tag === '함정' ? 'trap' : 'ext');
    return `<div class="mlp-pick-card click" data-action="mlp-pick" data-id="${esc(m.id)}">
      <div class="mlp-pick-icon">${m.icon}</div>
      <div class="mlp-pick-body">
        <span class="mlp-pick-tag ${tagCls}">${esc(m.tag)}</span>
        <div class="mlp-pick-title">${esc(m.title)}</div>
        <div class="mlp-pick-sub">${esc(m.subtitle || '')}</div>
      </div>
      <div class="mlp-pick-arrow">→</div>
    </div>`;
  }).join('');
  return `<div class="section">
    <div class="ml-intro">
      여러분이 <b>🧩 AI 프로젝트 매니저</b>가 되어 의뢰받은 문제를 <u>기계학습으로 해결</u>해봐요!
      <b>① 문제 정의 → ② 데이터 → ③ 모델 선정·학습 → ④ 평가</b>의 구현 과정을 직접 결정하고,
      교과서의 오렌지3처럼 <b>위젯을 연결해 파이프라인을 조립</b>하면 진짜 데이터로 진짜 결과가 나옵니다.
    </div>
    <div class="sec-title">어떤 의뢰를 맡을까요?</div>
    <div class="mlp-pick-list">${cards}</div>
  </div>`;
}

/* 진행바 — 캔버스 상태로 2~4 자동 점등 */
function _mlpStepBar(scn){
  if(!scn.mlNeeded){
    const steps = ['1. 문제 정의', '2. 마무리'];
    const idx = MLP_STEP >= 5 ? 1 : 0;
    return `<div class="ml-stepbar mlp-stepbar">${steps.map((s, i) =>
      `<div class="ml-step ${i === idx ? 'on' : (i < idx ? 'done' : '')}">${s}</div>`).join('')}</div>`;
  }
  const cv = MLP_CV || { placed: {}, edges: [] };
  const dataReady = scn.task === 'clustering'
    ? (cv.placed.data && _mlpHasEdge('data', 'kmeans'))
    : (cv.placed.data && cv.placed.split && _mlpHasEdge('data', 'split'));
  const trained = _mlpTrainedCount() > 0 || !!MLP_REG || !!MLP_CLU;
  const evald = scn.task === 'clustering' ? !!MLP_CLU
    : (_mlpModelInto('score').some(m => MLP_COMPARE[m]) || !!(MLP_REG && _mlpHasEdge('linreg', 'score')) || !!MLP_PRED);
  const done = [MLP_STEP > 1, dataReady, trained, evald, false];
  const labels = ['1. 문제 정의', '2. 데이터·조립', '3. 모델 학습', '4. 평가', '5. 성찰'];
  let cur = 0;
  if(MLP_STEP === 1) cur = 0;
  else if(MLP_STEP >= 5) cur = 4;
  else cur = !dataReady ? 1 : (!trained ? 2 : 3);
  return `<div class="ml-stepbar mlp-stepbar">${labels.map((s, i) => {
    const cls = i === cur ? 'on' : (done[i] || i < cur ? 'done' : '');
    return `<div class="ml-step ${cls}">${s}</div>`;
  }).join('')}</div>`;
}

/* ═══════════════════════════════════════
   ① 문제 정의 — 의뢰 브리핑 + 목표/단서/ML판단
═══════════════════════════════════════ */

function _vStMlpDefine(){
  const scn = MLP_SEL, A = MLP_ANSWERS, d = scn.define;

  // 의뢰 브리핑 (채팅 카드)
  const chat = (scn.brief || []).map(m => `<div class="mlp-msg ${m.who === '🙋' ? 'me' : ''}">
      <span class="mlp-msg-ava">${m.who}</span>
      <div class="mlp-msg-bd">
        <div class="mlp-msg-name">${esc(m.name)}</div>
        <div class="mlp-msg-tx">${m.text}</div>
      </div>
    </div>`).join('');

  // Q3: ML 필요 판단 (공통)
  const chosen = A.need;
  let needFb = '';
  if(chosen){
    const correct = chosen === d.mlAnswer;
    needFb = `<div class="mlp-feedback ${correct ? 'ok' : 'rethink'}">${correct ? '✅' : '🤔'} ${chosen === 'ml' ? d.feedbackMl : d.feedbackRule}</div>`;
  }
  const needBlock = `
    <div class="mlp-q-head">❓ 이 문제, <b>기계학습이 필요할까요?</b></div>
    <div class="ml-sub-explain">💡 판단 힌트<br>· ${d.q1}<br>· ${d.q2}</div>
    <div class="mlp-choice-row">
      <button class="mlp-choice ${chosen === 'ml' ? 'on' : ''}" data-action="mlp-need" data-need="ml">🤖 기계학습으로 풀기</button>
      <button class="mlp-choice ${chosen === 'rule' ? 'on' : ''}" data-action="mlp-need" data-need="rule">⌨️ 그냥 프로그래밍으로 풀기</button>
    </div>
    ${needFb}
    <div class="mlp-why">
      <div class="mlp-why-label">📝 왜 그렇게 판단했나요? (근거)</div>
      <textarea class="aia-field-area" data-action="mlp-input" data-fid="needWhy" rows="2" placeholder="내 생각을 적어보세요.">${esc(A.needWhy || '')}</textarea>
    </div>`;

  // 함정(BMI): 브리핑 + ML판단만
  if(!scn.mlNeeded){
    return `<div class="section">
      <div class="sec-title">📨 의뢰가 도착했어요</div>
      <div class="mlp-chat">${chat}</div>
      ${needBlock}
    </div>
    <div class="ml-action-bar">
      ${chosen === d.mlAnswer
        ? '<button class="btn-p" data-action="mlp-def-done">마무리하기 →</button>'
        : '<div class="ml-train-hint">의뢰를 잘 읽고 판단해 보세요.</div>'}
    </div>`;
  }

  // Q1: 해결 목표 고르기
  const gq = scn.goalQuiz;
  const lastTry = MLP_GOAL_TRIES.length ? MLP_GOAL_TRIES[MLP_GOAL_TRIES.length - 1] : null;
  const goalOpts = gq.options.map(o => {
    const sel = (A.goalPick === o.id) || (lastTry === o.id);
    return `<button class="mlp-goal-opt ${sel ? (o.good ? 'good' : 'bad') : ''}" data-action="mlp-goal" data-id="${esc(o.id)}">
      <span class="mlp-goal-mk">${sel ? (o.good ? '✅' : '❌') : '◻'}</span> ${esc(o.label)}
    </button>`;
  }).join('');
  const lastOpt = gq.options.find(o => o.id === lastTry);
  const goalFb = lastOpt ? `<div class="mlp-feedback ${lastOpt.good ? 'ok' : 'rethink'}">${lastOpt.good ? '✅' : '🤔'} ${lastOpt.why}</div>` : '';
  const goalDone = !!A.goalPick;

  // Q2: 단서(특징) 고르기 — goal 정답 후 노출
  const featMin = scn.task === 'clustering' ? 2 : 1;
  let featBlock = '';
  if(goalDone){
    const picked = Array.isArray(A.featPick) ? A.featPick : [];
    const chips = scn.features.map(f => {
      const on = picked.includes(f.key);
      return `<button class="mlp-featchip ${on ? 'on' : ''}" data-action="mlp-feat" data-k="${esc(f.key)}">${on ? '✔ ' : ''}${esc(f.label)}</button>`;
    }).join('');
    featBlock = `<div class="mlp-q-head">🔎 어떤 정보가 <b>단서</b>가 될까요?</div>
      <div class="ml-sub-explain">${scn.featNote || '학습에 쓸 항목을 고르세요.'}</div>
      <div class="mlp-featrow">${chips}</div>
      <div class="mlp-feat-cnt">${picked.length ? `단서 <b>${picked.length}개</b> 선택됨${picked.length < featMin ? ` — ${featMin}개 이상 고르세요` : ''}` : `최소 ${featMin}개 이상 고르세요`}</div>`;
  }

  const featOk = !goalDone ? false : (Array.isArray(A.featPick) && A.featPick.length >= featMin);

  // Q4: 유형 가설 세우기 — 정오를 알려주지 않고, 캔버스 실험으로 검증
  let typeBlock = '';
  if(goalDone && featOk && chosen === d.mlAnswer){
    const tPick = A.typePick;
    const cards = Object.keys(MLP_TYPES).map(t => {
      const T = MLP_TYPES[t];
      return `<button class="mlp-goal-opt ${tPick === t ? 'good' : ''}" data-action="mlp-type" data-t="${t}">
        <span class="mlp-goal-mk">${tPick === t ? '🧪' : '◻'}</span> <b>${T.icon} ${esc(T.label)}</b> — ${esc(T.hint)}
      </button>`;
    }).join('');
    typeBlock = `<div class="mlp-q-head">🔬 이 문제는 어떤 <b>기계학습 유형</b>일까요? — 가설 세우기</div>
      <div class="ml-sub-explain">${scn.predictWhat ? '우리가 하려는 것: ' + scn.predictWhat + '<br>' : ''}정답은 알려주지 않아요 — <b>가설을 세우고, 캔버스에서 직접 실험해 확인</b>합니다. (실험하다 생각이 바뀌면 돌아와서 바꿔도 돼요!)</div>
      <div class="mlp-goal-list">${cards}</div>
      ${tPick ? `<div class="mlp-feedback ok">🧪 <b>${MLP_TYPES[tPick].label}</b> 가설을 세웠어요! 캔버스에서 ${MLP_TYPES[tPick].icon} ${MLP_TYPES[tPick].label} 모델을 학습시켜 검증해 보세요.</div>` : ''}`;
  }

  const allOk = goalDone && featOk && chosen === d.mlAnswer && !!A.typePick;

  return `<div class="section">
    <div class="sec-title">📨 의뢰가 도착했어요</div>
    <div class="mlp-chat">${chat}</div>

    <div class="mlp-q-head">🎯 ${esc(gq.q)}</div>
    <div class="mlp-goal-list">${goalOpts}</div>
    ${goalFb}
    ${featBlock}
    ${goalDone && featOk ? needBlock : ''}
    ${typeBlock}
  </div>
  <div class="ml-action-bar">
    ${allOk
      ? '<button class="btn-p" data-action="mlp-def-done">문제 정의 완료 — 파이프라인 조립하러 →</button>'
      : `<div class="ml-train-hint">${!goalDone ? '먼저 해결 목표를 골라보세요.'
        : (!featOk ? `단서를 ${featMin}개 이상 골라보세요.`
        : (chosen !== d.mlAnswer ? 'ML 필요 여부를 판단해 보세요.' : '유형 가설을 세워보세요.'))}</div>`}
  </div>`;
}

/* ═══════════════════════════════════════
   ②~④ 캔버스 — 오렌지3식 조립·학습·평가
═══════════════════════════════════════ */

function _vStMlpCanvas(){
  const scn = MLP_SEL;
  const cv = MLP_CV;
  if(!cv) return '<div class="section">초기화 중…</div>';
  const hint = _mlpCvHint();

  // 팔레트 — 모델은 유형별 그룹으로, 학생의 가설 유형을 맨 위에
  const palIds = _mlpPaletteList(scn.task);
  const palBtn = id => {
    const w = MLP_W[id];
    const placed = !!cv.placed[id];
    return `<button class="mlp-pal-item ${placed ? 'placed' : ''}" data-action="mlp-cv-add" data-w="${id}" ${placed ? 'disabled' : ''}>
      <span>${w.icon}</span>${esc(w.label)}${placed ? ' ✓' : ''}</button>`;
  };
  const hyp = MLP_ANSWERS.typePick;
  const taskOrder = ['classification', 'regression', 'clustering'];
  const grpOrder = (hyp && taskOrder.includes(hyp)) ? [hyp, ...taskOrder.filter(t => t !== hyp)] : taskOrder;
  let pal = palIds.filter(id => id === 'data' || id === 'split').map(palBtn).join('');
  grpOrder.forEach(t => {
    const ids = MLP_MODEL_GROUPS[t].filter(id => palIds.includes(id));
    if(!ids.length) return;
    pal += `<div class="mlp-pal-grp">${MLP_TYPES[t].icon} ${esc(MLP_TYPES[t].label)} 모델${hyp === t ? ' <b>· 내 가설 🧪</b>' : ''}</div>` + ids.map(palBtn).join('');
  });
  pal += palIds.filter(id => id === 'score' || id === 'predict' || id === 'groups').map(palBtn).join('');

  // 와이어 (SVG)
  const CW = 590, CH = 304;
  let wires = '';
  const port = id => { const [x, y] = _mlpSlot(id); return [x + MLP_NODE_W, y + MLP_NODE_H / 2]; };
  const inlet = id => { const [x, y] = _mlpSlot(id); return [x, y + MLP_NODE_H / 2]; };
  cv.edges.forEach(e => {
    const [a, b] = e.split('>');
    if(!cv.placed[a] || !cv.placed[b]) return;
    const [x1, y1] = port(a), [x2, y2] = inlet(b);
    const mx = (x1 + x2) / 2;
    wires += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" class="mlp-wire" marker-end="url(#mlpar)"/>`;
  });
  // 훈련 라벨 (나누기→모델 첫 엣지)
  const firstModelEdge = cv.edges.find(e => e.startsWith('split>'));
  if(firstModelEdge && cv.placed.split){
    const [x1, y1] = port('split');
    wires += `<text x="${x1 + 8}" y="${y1 - 8}" class="mlp-wire-lb">훈련 70%</text>`;
  }
  // 테스트 자동선 (나누기→예측, 점선)
  if(cv.placed.split && cv.placed.predict && scn.task !== 'clustering'){
    const [sx, sy] = _mlpSlot('split'), [px, py] = _mlpSlot('predict');
    const x1 = sx + MLP_NODE_W / 2, y1 = sy + MLP_NODE_H, x2 = px, y2 = py + MLP_NODE_H / 2 + 8;
    wires += `<path d="M${x1},${y1} C${x1},${y1 + 56} ${x2 - 60},${y2} ${x2},${y2}" class="mlp-wire dash" marker-end="url(#mlpar)"/>
      <text x="${x1 + 14}" y="${y1 + 40}" class="mlp-wire-lb">테스트 30%</text>`;
  }

  // 노드들
  const validTargets = MLP_LINK ? _mlpLinkTargets(MLP_LINK) : [];
  const nodes = _mlpPaletteList(scn.task).filter(id => cv.placed[id]).map(id => {
    const w = MLP_W[id];
    const [x, y] = _mlpSlot(id);
    const sub = _mlpNodeSub(id);
    const hasPort = !['score', 'predict', 'groups'].includes(id);
    const cls = [
      'mlpw',
      MLP_PANEL === id ? 'open' : '',
      MLP_LINK === id ? 'link-from' : '',
      validTargets.includes(id) ? 'link-ok' : '',
    ].join(' ');
    return `<div class="${cls}" style="left:${x}px;top:${y}px" data-action="mlp-cv-node" data-w="${id}">
      <span class="mlpw-ic">${w.icon}</span>
      <span class="mlpw-tx">${esc(w.label)}${sub ? `<small>${sub}</small>` : ''}</span>
      ${hasPort ? `<span class="mlpw-port" data-action="mlp-cv-port" data-w="${id}" title="연결 시작">●</span>` : ''}
    </div>`;
  }).join('');

  const linkBar = MLP_LINK
    ? `<div class="mlp-linkbar">🔗 <b>${MLP_W[MLP_LINK].icon} ${esc(MLP_W[MLP_LINK].label)}</b>에서 연결 중 — 연결할 위젯을 누르세요
       <button class="btn-xs" data-action="mlp-cv-cancel">취소</button></div>`
    : '';

  return `<div class="section mlp-cv-sec">
    <div class="mlp-cv-hintbar">💡 ${hint}</div>
    ${linkBar}
    <div class="mlp-cv-row">
      <div class="mlp-palette">
        <div class="mlp-pal-title">위젯 팔레트</div>
        ${pal}
      </div>
      <div class="mlp-cvwrap">
        <div class="mlp-cv" style="min-width:${CW}px;height:${CH}px">
          <svg class="mlp-cv-svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
            <defs><marker id="mlpar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L8,4L0,8z" class="mlp-wire-ar"/></marker></defs>
            ${wires}
          </svg>
          ${nodes}
          ${!cv.placed.data ? '<div class="mlp-cv-empty">팔레트에서 위젯을 눌러 캔버스에 놓으세요</div>' : ''}
        </div>
      </div>
    </div>
    ${MLP_PANEL ? _mlpPanelHtml() : ''}
  </div>
  <div class="ml-action-bar">
    <button class="btn-sm" data-action="mlp-step" data-s="1">← 문제 정의</button>
    ${_mlpCanReflect()
      ? '<button class="btn-p" data-action="mlp-to-reflect">✅ 평가 끝 — 성찰하기 →</button>'
      : '<div class="ml-train-hint">모델을 학습시키고 성적표로 평가하면 성찰로 넘어갈 수 있어요</div>'}
  </div>`;
}

// 노드 보조 텍스트
function _mlpNodeSub(id){
  const scn = MLP_SEL;
  if(id === 'data'){
    return scn.task === 'classification' ? `단서 ${_mlpFeatKeys().length}개 · ${scn.rows.length}명` : `${scn.rows.length}명`;
  }
  if(id === 'split'){
    return MLP_SPLIT ? `훈련 ${MLP_SPLIT.train.length} · 테스트 ${MLP_SPLIT.test.length}` : '70 : 30';
  }
  if(MLP_MODELS[id]){
    if(MLP_MODELS[id].task !== scn.task){
      if(MLP_MISMATCH && MLP_MISMATCH.mk === id) return '✗ 유형 불일치!';
      return MLP_TYPES[MLP_MODELS[id].task].label + ' 모델';
    }
    if(MLP_ANIM && MLP_ANIM.mk === id) return '학습 중…';
    if(scn.task === 'classification' && MLP_COMPARE[id]) return `✓ 테스트 ${(MLP_COMPARE[id].testAcc * 100).toFixed(0)}%`;
    if(id === 'linreg' && MLP_REG) return `✓ R² ${(Math.max(0, MLP_REG.r2) * 100).toFixed(0)}%`;
    if(id === 'kmeans' && MLP_CLU) return `✓ 순도 ${(MLP_CLU.purity * 100).toFixed(0)}%`;
    if(id === 'tree') return `깊이 ${MLP_CV.hyper.depth}`;
    if(id === 'knn') return `k = ${MLP_CV.hyper.k}`;
    return '학습 전';
  }
  if(id === 'score'){
    const n = _mlpModelInto('score').filter(m => MLP_COMPARE[m] || (m === 'linreg' && MLP_REG)).length;
    return n ? `모델 ${n}개 비교` : '';
  }
  if(id === 'predict') return MLP_PRED ? `오답 ${MLP_PRED.wrong.length}건` : '';
  if(id === 'groups') return MLP_CLU ? `${MLP_CLU.k}개 그룹` : '';
  return '';
}

// 가이드 힌트
function _mlpCvHint(){
  const scn = MLP_SEL, cv = MLP_CV;
  const W = MLP_W;
  if(scn.task === 'clustering'){
    if(!cv.placed.data) return `팔레트에서 ${W.data.icon} <b>데이터</b>를 캔버스에 놓아 보세요`;
    if(!cv.placed.kmeans) return `${W.kmeans.icon} <b>k-평균</b>을 놓으세요 — 정답 없이 비슷한 것끼리 묶는 모델이에요`;
    if(!_mlpHasEdge('data', 'kmeans')) return `${W.data.icon} 데이터의 <b>● 포트</b>를 누르고 ${W.kmeans.icon} k-평균을 눌러 연결!`;
    if(!MLP_CLU) return `${W.kmeans.icon} k-평균을 눌러 패널을 열고 <b>▶ 묶기 시작</b>!`;
    if(!cv.placed.groups) return `${W.groups.icon} <b>그룹 보기</b>를 놓고 연결해 결과를 해석해 보세요`;
    if(!_mlpHasEdge('kmeans', 'groups')) return `${W.kmeans.icon} k-평균 ●를 눌러 ${W.groups.icon} 그룹 보기에 연결`;
    return '그룹별 평균을 살펴봤다면 <b>성찰하기</b>로!';
  }
  if(!cv.placed.data) return `팔레트에서 ${W.data.icon} <b>데이터</b>를 캔버스에 놓아 보세요`;
  if(!cv.placed.split) return `${W.split.icon} <b>나누기</b>를 놓으세요 — 훈련용과 테스트(시험)용을 나눌 거예요`;
  if(!_mlpHasEdge('data', 'split')) return `${W.data.icon} 데이터의 <b>● 포트</b>를 누른 뒤 ${W.split.icon} 나누기를 눌러 연결!`;
  const hypT = MLP_ANSWERS.typePick && MLP_TYPES[MLP_ANSWERS.typePick];
  const anyPlaced = _mlpAllModelIds().some(m => cv.placed[m]);
  const models = _mlpModelIds(scn.task).filter(m => cv.placed[m]);
  if(!anyPlaced) return `${hypT ? `내 가설 <b>${hypT.icon} ${hypT.label}</b> 모델부터 놓고 실험해 보세요` : '모델을 놓아 보세요'} — 다른 유형 모델도 시험해볼 수 있어요!`;
  if(!models.length) return `모델을 학습시켜 <b>가설을 검증</b>해 보세요 — 안 맞으면 실험 결과가 알려줄 거예요!`;
  const connected = models.filter(m => _mlpHasEdge('split', m));
  if(!connected.length) return `${W.split.icon} 나누기의 <b>●</b>를 눌러 모델에 <b>훈련 데이터</b>를 연결하세요`;
  const trained = connected.filter(m => MLP_COMPARE[m] || (m === 'linreg' && MLP_REG));
  if(!trained.length) return `모델을 눌러 패널을 열고 <b>▶ 학습 시작</b> — 학습 과정을 지켜보세요!`;
  if(!cv.placed.score) return `${W.score.icon} <b>성적표</b>를 놓으세요 — 테스트 데이터로 채점합니다`;
  if(!_mlpModelInto('score').length) return `학습한 모델의 <b>●</b>를 눌러 ${W.score.icon} 성적표에 연결`;
  if(scn.task === 'classification' && models.length < 2) return `다른 모델도 놓고 학습해 <b>비교</b>해 보세요! (교과서처럼 3개 비교 추천)`;
  if(!cv.placed.predict) return `${W.predict.icon} <b>예측 보기</b>를 놓고 모델을 연결하면 <b>틀린 사례</b>를 볼 수 있어요 (성찰 재료!)`;
  if(!_mlpModelInto('predict').length) return `모델 ●를 눌러 ${W.predict.icon} 예측 보기에 연결 → ▶ 예측 실행`;
  if(!MLP_PRED) return `${W.predict.icon} 예측 보기를 열어 <b>▶ 예측 실행</b> — 모델이 틀린 사람을 찾아보세요`;
  return '충분히 실험했다면 <b>✅ 성찰하기</b>로 넘어가세요!';
}

// 연결 가능 대상 (하이라이트용) — events의 규칙과 동일
function _mlpLinkTargets(from){
  const scn = MLP_SEL, cv = MLP_CV;
  const out = [];
  const allModels = _mlpAllModelIds();
  _mlpPaletteList(scn.task).forEach(to => {
    if(!cv.placed[to] || to === from) return;
    if(from === 'data' && (to === 'split' || to === 'kmeans' || (scn.task === 'clustering' && allModels.includes(to)))) out.push(to);
    if(from === 'split' && allModels.includes(to) && to !== 'kmeans') out.push(to);
    if(allModels.includes(from) && (to === 'score' || to === 'predict')) out.push(to);
    if(from === 'kmeans' && to === 'groups') out.push(to);
  });
  return out;
}

// 성찰 이동 가능?
function _mlpCanReflect(){
  const scn = MLP_SEL;
  if(scn.task === 'clustering') return !!MLP_CLU;
  if(scn.task === 'regression') return !!MLP_REG && _mlpHasEdge('linreg', 'score');
  return _mlpModelInto('score').some(m => MLP_COMPARE[m]);
}

/* ─────────────────── 위젯 패널 ─────────────────── */

function _mlpPanelHtml(){
  const id = MLP_PANEL, w = MLP_W[id];
  return `<div class="mlp-panel">
    <div class="mlp-panel-head">
      <span>${w.icon} <b>${esc(w.label)}</b></span>
      <button class="btn-xs" data-action="mlp-panel-close">✕ 닫기</button>
    </div>
    <div class="mlp-panel-body">${_mlpPanelBody(id)}</div>
  </div>`;
}

function _mlpPanelBody(id){
  const scn = MLP_SEL;
  if(id === 'data') return _mlpPanelData();
  if(id === 'split') return _mlpPanelSplit();
  if(id === 'score') return _mlpPanelScore();
  if(id === 'predict') return _mlpPanelPredict();
  if(id === 'groups') return _mlpPanelGroups();
  if(MLP_MODELS[id]) return _mlpPanelModel(id);
  return '';
}

/* 데이터 패널 — 단서 칩 + 미니 표 */
function _mlpPanelData(){
  const scn = MLP_SEL;
  const keys = _mlpFeatKeys();
  const picked = Array.isArray(MLP_ANSWERS.featPick) ? MLP_ANSWERS.featPick : [];
  const chips = `<div class="ml-sub-explain" style="margin-bottom:8px">🔎 단서(특징) — 바꾸면 모델을 다시 학습해야 해요. ${scn.featNote || ''}</div>
    <div class="mlp-featrow">${scn.features.map(f => {
      const on = picked.includes(f.key);
      return `<button class="mlp-featchip ${on ? 'on' : ''}" data-action="mlp-feat" data-k="${esc(f.key)}">${on ? '✔ ' : ''}${esc(f.label)}</button>`;
    }).join('')}</div>`;
  const feats = scn.features.filter(f => keys.includes(f.key));
  let lastHead = '', lastCell = () => '';
  if(scn.task === 'classification'){
    lastHead = `<th class="mlp-th-target">${esc(scn.target.posLabel)}?</th>`;
    lastCell = r => `<td class="mlp-td-target">${_mlBin(r[scn.target.key], scn.target.posValue)
      ? '<b style="color:var(--ok)">' + esc(scn.target.posLabel) + '</b>' : esc(scn.target.negLabel)}</td>`;
  } else if(scn.task === 'regression'){
    lastHead = `<th class="mlp-th-target">${esc(scn.regression.yLabel)}(${esc(scn.regression.yUnit)})</th>`;
    lastCell = r => `<td class="mlp-td-target"><b>${esc(String(r[scn.regression.y]))}</b></td>`;
  }
  const head = feats.map(f => `<th>${esc(f.label)}</th>`).join('') + lastHead;
  const rows = scn.rows.slice(0, 6).map(r =>
    `<tr>${feats.map(f => `<td>${esc(mlpFmtFeat(f, r[f.key]))}</td>`).join('')}${lastCell(r)}</tr>`).join('');
  let balance = `전체 <b>${scn.rows.length}</b>명`;
  if(scn.task === 'classification'){
    const pos = scn.rows.filter(r => _mlBin(r[scn.target.key], scn.target.posValue)).length;
    balance += ` · ${esc(scn.target.posLabel)} ${pos} · ${esc(scn.target.negLabel)} ${scn.rows.length - pos}`;
  }
  if(scn.task === 'clustering') balance += ' · <b style="color:#E8740C">정답(라벨) 없음!</b>';
  return `${chips}
    <div class="mlp-balance">${balance}</div>
    <div style="overflow-x:auto"><table class="tbl mlp-data-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="mlp-auto-note">🧹 결측치 보정·숫자 변환 같은 <b>전처리는 자동</b>으로 해뒀어요. (앞 6줄만 표시)</div>`;
}

/* 나누기 패널 */
function _mlpPanelSplit(){
  const scn = MLP_SEL;
  const tr = MLP_SPLIT ? MLP_SPLIT.train.length : 0, te = MLP_SPLIT ? MLP_SPLIT.test.length : 0;
  const aug = (typeof _mlpAug !== 'undefined' && _mlpAug);
  return `<div class="ml-sub-explain">전체 데이터를 <b>훈련용</b>(모델이 배우는 문제집)과 <b>테스트용</b>(한 번도 안 본 시험지)으로 나눠요.
    시험지를 미리 보면 진짜 실력을 잴 수 없겠죠?</div>
    <div class="mlp-splitbar"><div class="tr" style="width:70%">훈련 ${tr}명</div><div class="te" style="width:30%">테스트 ${te}명</div></div>
    ${scn.task === 'classification' ? `
      <div class="mlp-eval-actions" style="margin-top:10px">
        <button class="btn-sm" data-action="mlp-cv-aug">${aug ? '↩ 훈련 데이터 원래대로' : '💧 훈련 데이터 더 늘려보기 (60%→100%)'}</button>
      </div>
      <div class="mlp-retry-hint">테스트는 그대로 두고 훈련량만 바꿔요 — <b>같은 시험지로 공정 비교!</b> (바꾸면 모델 재학습 필요)</div>` : ''}`;
}

/* 모델 패널 — 하이퍼파라미터 + 학습 애니메이션 (유형 불일치 모델이면 실험 카드) */
function _mlpPanelModel(mk){
  const scn = MLP_SEL;
  const connected = _mlpHasEdge('split', mk) || _mlpHasEdge('data', mk);
  const m = MLP_MODELS[mk];

  // 유형 불일치 모델 — "그래도 실험해 보기" → 왜 안 되는지 실데이터로 확인
  if(m.task !== scn.task){
    const desc = `<div class="ml-sub-explain" style="margin-bottom:8px">${esc(m.desc)} <span class="mlp-good">👍 ${esc(m.good)}</span> <span class="mlp-bad">⚠️ ${esc(m.bad)}</span></div>`;
    const tried = MLP_MISMATCH && MLP_MISMATCH.mk === mk;
    const needSrc = (mk === 'kmeans' || scn.task === 'clustering') ? '📁 데이터를' : '✂️ 나누기를';
    const ctrl = !connected
      ? `<div class="ml-train-hint">${needSrc} 먼저 연결하면 실험할 수 있어요</div>`
      : `<div class="mlp-hp-row"><button class="btn-p btn-sm" data-action="mlp-train" data-mk="${mk}">🧪 이 모델로 실험해 보기</button></div>`;
    return desc + ctrl + (tried
      ? _mlpMismatchCard()
      : `<div class="mlp-anim-empty">이건 <b>${MLP_TYPES[m.task].icon} ${MLP_TYPES[m.task].label}</b> 유형 모델이에요. 이 문제와 맞을까요? 직접 실험해서 확인해 보세요!</div>`);
  }
  const running = MLP_ANIM && MLP_ANIM.mk === mk;
  let hyper = '';
  if(mk === 'tree'){
    hyper = `<label class="mlp-hp">트리 깊이 <input type="range" min="1" max="4" step="1" value="${MLP_CV.hyper.depth}" data-action="mlp-hp-depth" ${running ? 'disabled' : ''}/> <b>${MLP_CV.hyper.depth}</b></label>`;
  } else if(mk === 'knn'){
    hyper = `<span class="mlp-hp">이웃 수 k ${[1, 3, 5, 7].map(k =>
      `<button class="btn-xs ${MLP_CV.hyper.k === k ? 'mlp-seg-on' : ''}" data-action="mlp-hp-k" data-k="${k}" ${running ? 'disabled' : ''}>${k}</button>`).join('')}</span>`;
  }
  const desc = m ? `<div class="ml-sub-explain" style="margin-bottom:8px">${esc(m.desc)} <span class="mlp-good">👍 ${esc(m.good)}</span> <span class="mlp-bad">⚠️ ${esc(m.bad)}</span></div>` : '';
  const btnLabel = mk === 'knn' ? '▶ 평가 시작 (kNN은 외워두는 모델!)' : (mk === 'kmeans' ? '▶ 묶기 시작' : '▶ 학습 시작');
  const ctrl = !connected
    ? `<div class="ml-train-hint">${scn.task === 'clustering' ? '📁 데이터를' : '✂️ 나누기를'} 먼저 연결해야 학습할 수 있어요</div>`
    : `<div class="mlp-hp-row">${hyper}
        ${running
          ? `<button class="btn-sm" data-action="mlp-train-skip">⏭ 끝까지</button>`
          : `<button class="btn-p btn-sm" data-action="mlp-train" data-mk="${mk}">${_mlpIsTrained(mk) ? '↺ 다시 학습' : btnLabel}</button>`}
      </div>`;
  return `${desc}${ctrl}<div id="mlp-anim-zone">${_mlpAnimZone(mk)}</div>`;
}

function _mlpIsTrained(mk){
  if(mk === 'linreg') return !!MLP_REG;
  if(mk === 'kmeans') return !!MLP_CLU;
  return !!MLP_COMPARE[mk];
}

/* 유형 불일치 실험 결과 카드 — 실데이터 증거로 "왜 안 되는지" 보여준다 */
function _mlpMismatchCard(){
  const scn = MLP_SEL, MM = MLP_MISMATCH;
  if(!MM || !MM.info) return '';
  const m = MLP_MODELS[MM.mk], I = MM.info;
  let evid = '';
  if(I.kind === 'cls-reg'){
    evid = `<div class="ml-sub-explain">실제로 <b>${esc(I.featLabel)}</b>로 직선을 그어 예측해 봤어요. 테스트 승객 ${I.samples.length}명의 결과:</div>
      <div class="mlp-mm-samples">${I.samples.map(s => `<span class="mlp-mm-chip">${esc(s.feat)} → 예측값 <b>${esc(s.pred)}</b>…?</span>`).join('')}</div>
      <div class="ml-sub-explain"><b>${esc(scn.target.posLabel)}(1)도 ${esc(scn.target.negLabel)}(0)도 아닌 어중간한 숫자</b>만 나와요.
      둘 중 하나를 골라야 하는 문제엔 <b>분류</b>가 필요해요!</div>`;
  } else if(I.kind === 'cls-clu'){
    evid = `<div class="ml-sub-explain">실제로 정답을 가리고 ${I.k}개 그룹으로 묶어 봤어요. 그룹 안을 들여다보면:</div>
      <div class="mlp-mm-samples">${I.groups.map((g, i) => `<span class="mlp-mm-chip">그룹 ${i + 1} (${g.n}명) — ${esc(scn.target.posLabel)} ${g.pos} · ${esc(scn.target.negLabel)} ${g.neg}</span>`).join('')}</div>
      <div class="ml-sub-explain">한 그룹 안에 <b>${esc(scn.target.posLabel)}·${esc(scn.target.negLabel)}이 섞여</b> 있죠?
      군집은 묶기만 할 뿐 <b>누가 ${esc(scn.target.posLabel)}인지 말해주지 않아요</b>. 정답이 있는 데이터엔 정답을 보고 배우는 <b>지도학습(분류)</b>이 맞아요!</div>`;
  } else if(I.kind === 'reg-cls'){
    evid = `<div class="ml-sub-explain">분류 모델은 <b>정해진 보기 중에서만</b> 답을 골라요. 그런데 ${esc(scn.regression.yLabel)}은
      ${I.vals.map(v => `<b>${esc(v)}</b>`).join(', ')}… 처럼 <b>끝없이 다양한 연속된 숫자</b>예요.</div>
      <div class="ml-sub-explain">"14.83초"라는 보기를 미리 만들 수는 없죠. 새로운 숫자를 계산해 내는 건 <b>회귀</b>의 일이에요!</div>`;
  } else if(I.kind === 'reg-clu'){
    evid = `<div class="ml-sub-explain">묶을 수는 있어요 — 하지만 나오는 건 "비슷한 부원 그룹"일 뿐,
      의뢰가 원하는 <b>"이 부원의 예상 ${esc(scn.regression.yLabel)} 몇 ${esc(scn.regression.yUnit)}"</b>라는 숫자는 끝내 나오지 않아요.
      숫자를 예측하려면 <b>회귀</b>가 필요해요!</div>`;
  } else if(I.kind === 'clu-sup'){
    evid = `<div class="ml-sub-explain">${m.icon} ${esc(m.label)}는 <b>정답(라벨)을 보고 배우는 지도학습</b> 모델이에요.
      그런데 이 데이터의 항목을 보세요:</div>
      <div class="mlp-mm-samples">${I.cols.map(c => `<span class="mlp-mm-chip">${esc(c)}</span>`).join('')}<span class="mlp-mm-chip" style="color:#b91c1c"><b>정답 칸 없음!</b></span></div>
      <div class="ml-sub-explain">"무엇을 맞혀라"라고 알려줄 정답이 없으니 <b>지도학습은 시작조차 할 수 없어요</b>.
      정답 없이 비슷한 것끼리 묶는 건 <b>비지도학습(군집)</b>의 일이에요!</div>`;
  }
  return `<div class="mlp-feedback rethink" style="margin-top:8px">🔬 <b>실험 결과 — 이 유형으로는 풀리지 않아요!</b></div>
    ${evid}
    <div class="mlp-hp-row" style="margin-top:8px">
      <button class="btn-sm" data-action="mlp-step" data-s="1">① 유형 가설 다시 세우기</button>
      <span class="ml-train-hint" style="margin:0">틀린 가설도 훌륭한 실험이에요 🧪 (기록에 남아요)</span>
    </div>`;
}

/* 학습 애니메이션 본문 — 진행 중엔 MLP_ANIM, 완료 후엔 최종 상태 */
function _mlpAnimZone(mk){
  const scn = MLP_SEL;
  const A = (MLP_ANIM && MLP_ANIM.mk === mk) ? MLP_ANIM : null;
  if(mk === 'tree') return _mlpZoneTree(A);
  if(mk === 'logistic') return _mlpZoneLogistic(A);
  if(mk === 'knn') return _mlpZoneKnn(A);
  if(mk === 'linreg') return _mlpZoneLinreg(A);
  if(mk === 'kmeans') return _mlpZoneKmeans(A);
  return '';
}

/* ── 트리: 깊이 1부터 자라나는 트리 + 정확도 곡선 ── */
function _mlpZoneTree(A){
  const scn = MLP_SEL;
  const frames = A ? A.frames : (MLP_FIT.treeFrames || null);
  const idx = A ? A.idx : (frames ? frames.length - 1 : -1);
  if(!frames || idx < 0) return '<div class="mlp-anim-empty">▶ 학습을 시작하면 트리가 한 단계씩 자라나는 모습을 볼 수 있어요</div>';
  const fr = frames[Math.min(idx, frames.length - 1)];
  const curve = frames.slice(0, Math.min(idx, frames.length - 1) + 1).map((f, i) => ({ x: i + 1, y: f.trainAcc }));
  const done = !A;
  const test = MLP_COMPARE.tree ? (MLP_COMPARE.tree.testAcc * 100).toFixed(0) : null;
  return `<div class="mlp-anim-flex">
    <div class="mlp-anim-left" style="overflow-x:auto">${_mlpTreeSvg(fr.tree, scn)}</div>
    <div class="mlp-anim-right">
      ${_mlpCurveSvg(curve, frames.length, '깊이', '훈련 정확도')}
      <div class="mlp-anim-cap">질문(깊이) <b>${fr.depth}</b> · 훈련 정확도 <b>${(fr.trainAcc * 100).toFixed(0)}%</b>
      ${done && test != null ? `<br>✅ 학습 완료 — <b>테스트 정확도 ${test}%</b> (처음 보는 ${MLP_SPLIT.test.length}명 채점)` : ''}</div>
      ${done && fr.tree && fr.tree.feature != null ? `<div class="mlp-tree-note">🌳 첫 질문 = <b>"${esc(_mlpFeatLabel(scn, fr.tree.feature))}"</b> — 모델이 가장 중요하게 본 특징! 왜일까요?</div>` : ''}
    </div>
  </div>`;
}

/* 트리 SVG (작은 결정트리 그리기) */
function _mlpTreeSvg(root, scn){
  if(!root) return '';
  const BW = 92, BH = 30, VS = 56;
  let leafN = 0, maxD = 0;
  (function meas(n, d){
    maxD = Math.max(maxD, d);
    if(n.feature == null){ n._lx = leafN++; return; }
    meas(n.left, d + 1); meas(n.right, d + 1);
    n._lx = (n.left._lx + n.right._lx) / 2;
  })(root, 0);
  const W = Math.max(300, leafN * (BW + 12) + 16), H = (maxD + 1) * VS + 8;
  const X = n => 8 + n._lx * (BW + 12) + BW / 2;
  const Y = d => 8 + d * VS;
  let edges = '', boxes = '';
  (function draw(n, d){
    const x = X(n), y = Y(d);
    if(n.feature != null){
      const s = _mlpSplitLbl(scn, n.feature, n.thr);
      const cx1 = X(n.left), cx2 = X(n.right), cy = Y(d + 1);
      edges += `<line x1="${x}" y1="${y + BH}" x2="${cx1}" y2="${cy}" class="mlp-tr-e"/>
        <line x1="${x}" y1="${y + BH}" x2="${cx2}" y2="${cy}" class="mlp-tr-e"/>
        <text x="${(x + cx1) / 2 - 4}" y="${(y + BH + cy) / 2}" class="mlp-tr-el" text-anchor="end">${esc(s.l)}</text>
        <text x="${(x + cx2) / 2 + 4}" y="${(y + BH + cy) / 2}" class="mlp-tr-el">${esc(s.r)}</text>`;
      boxes += `<g><rect x="${x - BW / 2}" y="${y}" width="${BW}" height="${BH}" rx="6" class="mlp-tr-q"/>
        <text x="${x}" y="${y + 19}" text-anchor="middle" class="mlp-tr-qt">${esc(s.q)}</text></g>`;
      draw(n.left, d + 1); draw(n.right, d + 1);
    } else {
      const isPos = scn.target && _mlBin(n.label, scn.target.posValue) === 1;
      const lb = scn.target ? (isPos ? scn.target.posLabel : scn.target.negLabel) : n.label;
      boxes += `<g><rect x="${x - BW / 2}" y="${y}" width="${BW}" height="${BH}" rx="6" class="mlp-tr-l ${isPos ? 'pos' : 'neg'}"/>
        <text x="${x}" y="${y + 19}" text-anchor="middle" class="mlp-tr-lt">${esc(lb)} (${n.n})</text></g>`;
    }
  })(root, 0);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="mlp-tr-svg">${edges}${boxes}</svg>`;
}
function _mlpSplitLbl(scn, fk, thr){
  const f = (scn.features || []).find(x => x.key === fk);
  if(!f) return { q: fk + '?', l: '<', r: '≥' };
  if(f.cats){
    const lo = [], hi = [];
    for(const v in f.cats) (+v < thr ? lo : hi).push(f.cats[v]);
    return { q: `${f.label}?`, l: lo.join('·') || '<', r: hi.join('·') || '≥' };
  }
  const t = Math.abs(thr) >= 20 ? Math.round(thr) : Math.round(thr * 10) / 10;
  return { q: `${f.label} < ${t}?`, l: '예', r: '아니오' };
}

/* 공용: 작은 상승 곡선 SVG (pts: [{x(1..),y(0~1)}]) */
function _mlpCurveSvg(pts, xMax, xLabel, yLabel){
  const W = 220, H = 110, P = { l: 30, r: 8, t: 8, b: 22 };
  const sx = x => P.l + (x / Math.max(1, xMax)) * (W - P.l - P.r);
  const sy = y => P.t + (1 - (y - 0.3) / 0.7) * (H - P.t - P.b);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(Math.max(0.3, p.y)).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="mlp-curve">
    <line x1="${P.l}" y1="${H - P.b}" x2="${W - P.r}" y2="${H - P.b}" class="ax"/>
    <line x1="${P.l}" y1="${P.t}" x2="${P.l}" y2="${H - P.b}" class="ax"/>
    <text x="${P.l - 4}" y="${sy(1) + 4}" text-anchor="end" class="tk">100</text>
    <text x="${P.l - 4}" y="${sy(0.5) + 4}" text-anchor="end" class="tk">50</text>
    ${pts.length ? `<path d="${path}" class="ln"/><circle cx="${sx(last.x)}" cy="${sy(Math.max(0.3, last.y))}" r="3.5" class="dot"/>
    <text x="${Math.min(sx(last.x) + 5, W - 30)}" y="${sy(Math.max(0.3, last.y)) - 6}" class="lb">${(last.y * 100).toFixed(0)}%</text>` : ''}
    <text x="${(W + P.l) / 2}" y="${H - 6}" text-anchor="middle" class="tk">${esc(xLabel)}</text>
  </svg>`;
}

/* ── 로지스틱: 정확도 곡선 + 특징 가중치 막대 ── */
function _mlpZoneLogistic(A){
  const scn = MLP_SEL;
  const st = A ? A.st : MLP_FIT.logistic;
  if(!st) return '<div class="mlp-anim-empty">▶ 학습을 시작하면 정확도가 차츰 올라가는 과정과, 모델이 각 단서에 주는 <b>가중치</b>를 볼 수 있어요</div>';
  const pts = (A ? A.pts : (MLP_FIT.logiPts || [])).map(p => ({ x: p[0], y: p[1] }));
  const keys = st.featureKeys;
  const maxW = Math.max(0.1, ...st.weights.map(w => Math.abs(w)));
  const bars = keys.map((k, i) => {
    const w = st.weights[i], pct = Math.abs(w) / maxW * 100;
    return `<div class="mlp-wrow"><span class="mlp-wlb">${esc(_mlpFeatLabel(scn, k))}</span>
      <div class="mlp-wbar"><div class="mlp-wfill ${w >= 0 ? 'pos' : 'neg'}" style="width:${pct.toFixed(0)}%"></div></div>
      <span class="mlp-wsign">${w >= 0 ? '↑' + esc(scn.target.posLabel) : '↓'}</span></div>`;
  }).join('');
  const done = !A;
  const test = MLP_COMPARE.logistic ? (MLP_COMPARE.logistic.testAcc * 100).toFixed(0) : null;
  return `<div class="mlp-anim-flex">
    <div class="mlp-anim-left">${_mlpCurveSvg(pts, 400, '학습 횟수(epoch)', '')}
      <div class="mlp-anim-cap">epoch <b>${st.iter}</b> · 훈련 정확도 <b>${(st.trainAcc * 100).toFixed(0)}%</b>
      ${done && test != null ? `<br>✅ 학습 완료 — <b>테스트 정확도 ${test}%</b>` : ''}</div></div>
    <div class="mlp-anim-right">
      <div class="mlp-anim-cap" style="margin-bottom:4px">각 단서의 <b>가중치</b> — 길수록 영향 큼</div>
      ${bars}
      ${done ? '<div class="mlp-retry-hint">가중치가 0에 가까운 단서는 모델이 "별 도움 안 됨"이라 판단한 거예요!</div>' : ''}
    </div>
  </div>`;
}

/* ── kNN: 산점도에 테스트 손님이 한 명씩 — 이웃 투표 + 채점 카운트업 ── */
function _mlpZoneKnn(A){
  const scn = MLP_SEL;
  const fin = MLP_FIT.knn;
  if(!A && !fin) return '<div class="mlp-anim-empty">▶ 평가를 시작하면 테스트 데이터가 한 명씩 등장해 <b>가까운 이웃 k명의 투표</b>로 판정받는 과정을 볼 수 있어요</div>';
  const ax = MLP_CV.axes;
  const keys = _mlpFeatKeys();
  const numKeys = keys;
  const axX = ax && keys.includes(ax.x) ? ax.x : numKeys[0];
  const axY = ax && keys.includes(ax.y) ? ax.y : (numKeys[1] || numKeys[0]);
  const sel = (which, cur) => `<select data-action="mlp-ax" data-which="${which}" class="mlp-ax-sel">${numKeys.map(k =>
    `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(_mlpFeatLabel(scn, k))}</option>`).join('')}</select>`;
  const state = A || fin;
  const okN = state.okN || 0, ngN = state.ngN || 0, i = state.i || 0, total = MLP_SPLIT.test.length;
  const done = !A;
  const test = MLP_COMPARE.knn ? (MLP_COMPARE.knn.testAcc * 100).toFixed(0) : null;
  return `<div class="mlp-ax-row">가로축 ${sel('x', axX)} 세로축 ${sel('y', axY)} <span class="mlp-knn-cnt">✓ <b>${okN}</b> · ✗ <b>${ngN}</b> (${Math.min(i, total)}/${total})</span></div>
    ${_mlpKnnScatter(axX, axY, A)}
    <div class="mlp-anim-cap">${done && test != null
      ? `✅ 평가 완료 — <b>테스트 정확도 ${test}%</b>. 가까운 이웃 ${MLP_CV.hyper.k}명의 다수결이었어요!`
      : '⭐ = 지금 판정 중인 테스트 손님 · 선 = 가장 가까운 이웃'}</div>`;
}

function _mlpKnnScatter(axX, axY, A){
  const scn = MLP_SEL;
  const W = 430, H = 190, P = 26;
  const train = MLP_SPLIT.train;
  const all = train.concat(MLP_SPLIT.test);
  let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
  all.forEach(r => {
    mnX = Math.min(mnX, +r[axX]); mxX = Math.max(mxX, +r[axX]);
    mnY = Math.min(mnY, +r[axY]); mxY = Math.max(mxY, +r[axY]);
  });
  const jit = i => ((i * 9301 + 49297) % 233) / 233 - 0.5;
  const fx = scn.features.find(f => f.key === axX), fy = scn.features.find(f => f.key === axY);
  const sx = (v, i) => P + ((v - mnX) / ((mxX - mnX) || 1)) * (W - P * 2) + (fx && fx.cats ? jit(i) * 26 : 0);
  const sy = (v, i) => H - P + (-(v - mnY) / ((mxY - mnY) || 1)) * (H - P * 2) + (fy && fy.cats ? jit(i + 7) * 26 : 0);
  let dots = train.map((r, i) => {
    const pos = _mlBin(r[scn.target.key], scn.target.posValue) === 1;
    return `<circle cx="${sx(+r[axX], i).toFixed(1)}" cy="${sy(+r[axY], i).toFixed(1)}" r="4" class="mlp-kn-dot ${pos ? 'pos' : 'neg'}"/>`;
  }).join('');
  let star = '', lines = '';
  if(A && A.cur){
    const r = A.cur.row, ti = 9999;
    const x = sx(+r[axX], ti), y = sy(+r[axY], ti);
    (A.cur.neighbors || []).forEach(ni => {
      const nr = train[ni];
      lines += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${sx(+nr[axX], ni).toFixed(1)}" y2="${sy(+nr[axY], ni).toFixed(1)}" class="mlp-kn-ln"/>`;
    });
    star = `<text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" text-anchor="middle" class="mlp-kn-star ${A.cur.ok ? 'ok' : 'ng'}">★</text>`;
  }
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" class="mlp-kn-svg">
    <rect x="0" y="0" width="${W}" height="${H}" rx="8" class="bgr"/>
    ${lines}${dots}${star}
    <text x="${W - 8}" y="${H - 8}" text-anchor="end" class="tk">${esc(_mlpFeatLabel(scn, axX))} →</text>
    <text x="10" y="16" class="tk">↑ ${esc(_mlpFeatLabel(scn, axY))}</text>
    <g transform="translate(${P},${H - 10})"><circle r="4" class="mlp-kn-dot pos"/><text x="8" y="4" class="tk">${esc(scn.target.posLabel)}</text>
    <circle cx="64" r="4" class="mlp-kn-dot neg"/><text x="72" y="4" class="tk">${esc(scn.target.negLabel)}</text></g>
  </svg>`;
}

/* ── 선형회귀: 단서 1개=직선 애니 / 여러 개=R² 곡선+가중치 막대 ── */
function _mlpZoneLinreg(A){
  const scn = MLP_SEL;
  if((A && A.st) || (!A && MLP_FIT.linreg && MLP_FIT.linreg.featureKeys)) return _mlpZoneLinregMulti(A);
  const gd = A ? A.gd : (MLP_FIT.linreg || null);
  if(!gd) return `<div class="mlp-anim-empty">▶ 학습을 시작하면 ${_mlpFeatKeys().length > 1
    ? '단서 여러 개를 함께 쓰는 학습 과정(R² 곡선 + 단서별 가중치)을'
    : '직선이 점들 사이로 <b>스스로 찾아 들어가는</b> 과정을'} 볼 수 있어요</div>`;
  const cfg = scn.regression;
  const xKey = (A && A.xKey) || MLP_FIT.linregXKey || cfg.x;
  const xLabel = _mlpFeatLabel(scn, xKey);
  const pairs = MLP_SPLIT.train.map(r => [+r[xKey], +r[cfg.y]]);
  const W = 430, H = 200, P = 30;
  let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
  pairs.forEach(([x, y]) => { mnX = Math.min(mnX, x); mxX = Math.max(mxX, x); mnY = Math.min(mnY, y); mxY = Math.max(mxY, y); });
  const padY = (mxY - mnY) * 0.15 || 1;
  mnY -= padY; mxY += padY;
  const sx = v => P + ((v - mnX) / ((mxX - mnX) || 1)) * (W - P * 2);
  const sy = v => H - P - ((v - mnY) / ((mxY - mnY) || 1)) * (H - P * 2);
  const dots = pairs.map(([x, y]) => `<circle cx="${sx(x).toFixed(1)}" cy="${sy(y).toFixed(1)}" r="4" class="mlp-kn-dot pos"/>`).join('');
  const y1 = gd.a * mnX + gd.b, y2 = gd.a * mxX + gd.b;
  const done = !A && MLP_REG && !MLP_REG.multi;
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" class="mlp-kn-svg">
      <rect x="0" y="0" width="${W}" height="${H}" rx="8" class="bgr"/>
      ${dots}
      <line x1="${sx(mnX).toFixed(1)}" y1="${sy(y1).toFixed(1)}" x2="${sx(mxX).toFixed(1)}" y2="${sy(y2).toFixed(1)}" class="mlp-lr-line"/>
      <text x="${W - 8}" y="${H - 8}" text-anchor="end" class="tk">${esc(xLabel)} →</text>
      <text x="10" y="16" class="tk">↑ ${esc(cfg.yLabel)}</text>
    </svg>
    <div class="mlp-anim-cap">학습 ${gd.iter}회 · 오차(MSE) <b>${gd.mse.toFixed(2)}</b>
    ${done ? `<br>✅ 완료 — <b>${esc(cfg.yLabel)} ≈ ${MLP_REG.a.toFixed(2)} × ${esc(xLabel)} ${MLP_REG.b >= 0 ? '+' : '−'} ${Math.abs(MLP_REG.b).toFixed(2)}</b> · 테스트 R² <b>${(Math.max(0, MLP_REG.r2) * 100).toFixed(0)}%</b> · 평균 오차 ±${MLP_REG.mae.toFixed(2)}${esc(cfg.yUnit)}<br><span style="color:var(--text3)">💡 단서를 더 고르면(예: 수면) 설명력이 오를까요? 데이터 위젯에서 바꿔 실험!</span>` : ''}</div>`;
}

/* ── 선형회귀(다특성): R² 곡선 + 단서별 가중치 막대 ── */
function _mlpZoneLinregMulti(A){
  const scn = MLP_SEL, cfg = scn.regression;
  const st = A ? A.st : MLP_FIT.linreg;
  if(!st) return '<div class="mlp-anim-empty">▶ 학습을 시작하면 설명력(R²)이 오르는 과정과 단서별 <b>가중치</b>를 볼 수 있어요</div>';
  const pts = (A ? A.pts : (MLP_FIT.linregPts || [])).map(p => ({ x: p[0], y: p[1] }));
  const keys = st.featureKeys;
  const maxW = Math.max(0.05, ...st.weights.map(w => Math.abs(w)));
  const bars = keys.map((k, i) => {
    const w = st.weights[i], pct = Math.abs(w) / maxW * 100;
    return `<div class="mlp-wrow"><span class="mlp-wlb">${esc(_mlpFeatLabel(scn, k))}</span>
      <div class="mlp-wbar"><div class="mlp-wfill ${w >= 0 ? 'pos' : 'neg'}" style="width:${pct.toFixed(0)}%"></div></div>
      <span class="mlp-wsign">${w >= 0 ? '↑' : '↓'}${esc(cfg.yLabel)}</span></div>`;
  }).join('');
  const done = !A && MLP_REG && MLP_REG.multi;
  return `<div class="mlp-anim-flex">
    <div class="mlp-anim-left">${_mlpCurveSvg(pts, Math.max(100, st.iter), '학습 횟수(epoch)', '')}
      <div class="mlp-anim-cap">epoch <b>${st.iter}</b> · 훈련 R² <b>${(Math.max(0, st.trainR2) * 100).toFixed(0)}%</b>
      ${done ? `<br>✅ 완료 — 테스트 R² <b>${(Math.max(0, MLP_REG.r2) * 100).toFixed(0)}%</b> · 평균 오차 ±${MLP_REG.mae.toFixed(2)}${esc(cfg.yUnit)}` : ''}</div></div>
    <div class="mlp-anim-right">
      <div class="mlp-anim-cap" style="margin-bottom:4px">각 단서의 <b>가중치</b> — 길수록 ${esc(cfg.yLabel)}에 영향 큼</div>
      ${bars}
      ${done ? '<div class="mlp-retry-hint">가중치가 0에 가까운 단서는 모델이 "별 도움 안 됨"이라 판단한 거예요. 단서를 빼고 다시 실험해 볼까요?</div>' : ''}
    </div>
  </div>`;
}

/* ── k-평균: 중심 이동 애니 ── */
function _mlpZoneKmeans(A){
  const scn = MLP_SEL;
  const st = A ? A.km : (MLP_FIT.kmeans || null);
  if(!st && !MLP_CLU) return '<div class="mlp-anim-empty">▶ 묶기를 시작하면 중심(✕)이 움직이며 비슷한 손님끼리 색으로 묶이는 과정을 볼 수 있어요</div>';
  const keys = (MLP_CLU && MLP_CLU.keys) || _mlpFeatKeys();
  const W = 430, H = 210, P = 28;
  const rows = scn.rows;
  let mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
  rows.forEach(r => keys.forEach((k, j) => { mn[j] = Math.min(mn[j], +r[k]); mx[j] = Math.max(mx[j], +r[k]); }));
  const S = (v, j) => j === 0
    ? P + ((v - mn[0]) / ((mx[0] - mn[0]) || 1)) * (W - P * 2)
    : H - P - ((v - mn[1]) / ((mx[1] - mn[1]) || 1)) * (H - P * 2);
  const colors = ['#6366f1', '#16a34a', '#E8740C', '#dc2626', '#0891b2'];
  const assign = st ? st.assignments : MLP_CLU.assignments;
  const cents = st ? st.centroids : null;
  const dots = rows.map((r, i) => {
    const g = assign[i];
    const col = g >= 0 ? colors[g % colors.length] : 'var(--text3)';
    return `<circle cx="${S(+r[keys[0]], 0).toFixed(1)}" cy="${S(+r[keys[1]], 1).toFixed(1)}" r="5" fill="${col}" opacity=".82"/>`;
  }).join('');
  let xs = '';
  if(cents){
    xs = cents.map((c, g) => {
      const vx = mn[0] + c[0] * ((mx[0] - mn[0]) || 1), vy = mn[1] + c[1] * ((mx[1] - mn[1]) || 1);
      return `<text x="${S(vx, 0).toFixed(1)}" y="${(S(vy, 1) + 6).toFixed(1)}" text-anchor="middle" class="mlp-km-x" fill="${colors[g % colors.length]}">✕</text>`;
    }).join('');
  }
  const cap = A
    ? `${A.km.iter}회차 — 중심(✕)이 자기 그룹의 한가운데로 이동 중…`
    : (MLP_CLU ? `✅ ${MLP_CLU.iters}회 만에 수렴! 숨겨둔 실제 유형과 <b>${(MLP_CLU.purity * 100).toFixed(0)}%</b> 일치 — 🗂️ 그룹 보기에서 해석해 보세요` : '');
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" class="mlp-kn-svg">
      <rect x="0" y="0" width="${W}" height="${H}" rx="8" class="bgr"/>${dots}${xs}
      <text x="${W - 8}" y="${H - 8}" text-anchor="end" class="tk">${esc(_mlpFeatLabel(scn, keys[0]))} →</text>
      <text x="10" y="16" class="tk">↑ ${esc(_mlpFeatLabel(scn, keys[1] || keys[0]))}</text>
    </svg>
    <div class="mlp-anim-cap">${cap}${keys.length > 2 ? ` <span style="color:var(--text3)">(그림은 앞 단서 2개 기준 — 묶기는 ${keys.length}개 단서 모두 사용)</span>` : ''}</div>`;
}

/* 성적표 패널 */
function _mlpPanelScore(){
  const scn = MLP_SEL;
  const models = _mlpModelInto('score');
  if(!models.length) return '<div class="mlp-anim-empty">학습한 모델의 ● 포트를 눌러 성적표에 연결하세요 — 여러 개를 연결하면 비교돼요!</div>';
  if(scn.task === 'regression'){
    if(!MLP_REG) return '<div class="mlp-anim-empty">📈 선형회귀를 먼저 학습시키세요</div>';
    return `<div class="mlp-eval-big" style="margin-bottom:6px">
        <div class="mlp-eval-model">📈 선형회귀</div>
        <div class="mlp-eval-acc"><span class="mlp-eval-num">${(Math.max(0, MLP_REG.r2) * 100).toFixed(0)}<small>%</small></span><span class="mlp-eval-cap">테스트 설명력 (R²)</span></div>
      </div>
      <div class="ml-sub-explain">평균 오차(MAE) <b>±${MLP_REG.mae.toFixed(2)}${esc(scn.regression.yUnit)}</b> — 훈련에 안 쓴 테스트 ${MLP_SPLIT.test.length}명 기준 진짜 점수예요.</div>`;
  }
  const rows = models.map(mk => {
    const m = MLP_MODELS[mk], c = MLP_COMPARE[mk];
    if(!c) return `<tr><td>${m.icon} ${esc(m.label)}</td><td><span class="ml-train-hint" style="margin:0">미학습 — 모델을 눌러 학습하세요</span></td></tr>`;
    return `<tr><td>${m.icon} ${esc(m.label)}</td>
      <td><div class="mlp-acc-bar"><div class="mlp-acc-fill" style="width:${(c.testAcc * 100).toFixed(0)}%"></div><span>${(c.testAcc * 100).toFixed(0)}%</span></div></td>
      <td class="mlp-score-tr">훈련 ${(c.trainAcc * 100).toFixed(0)}%${c.trainAcc - c.testAcc > 0.18 ? ' ⚠️과적합?' : ''}</td></tr>`;
  }).join('');
  const trained = models.filter(mk => MLP_COMPARE[mk]);
  let bestNote = '';
  if(trained.length >= 2){
    const best = trained.reduce((a, b) => MLP_COMPARE[a].testAcc >= MLP_COMPARE[b].testAcc ? a : b);
    bestNote = `<div class="mlp-retry-hint">🏆 지금까지는 <b>${MLP_MODELS[best].icon} ${esc(MLP_MODELS[best].label)}</b>가 1등! 왜 모델마다 점수가 다를까요?</div>`;
  }
  return `<div class="ml-sub-explain">훈련에 안 쓴 <b>테스트 ${MLP_SPLIT ? MLP_SPLIT.test.length : '?'}명</b>으로 채점한 진짜 점수(CA·분류 정확도)예요.</div>
    <table class="mlp-comp"><tbody>${rows}</tbody></table>${bestNote}`;
}

/* 예측 보기 패널 — 케이스 채점 + 오답 카드 */
function _mlpPanelPredict(){
  const scn = MLP_SEL;
  const models = _mlpModelInto('predict');
  const mk = models.length ? models[models.length - 1] : null;
  if(!mk) return '<div class="mlp-anim-empty">모델의 ● 포트를 눌러 예측 보기에 연결하세요 (마지막에 연결한 모델로 예측해요)</div>';
  const trained = _mlpIsTrained(mk);
  const head = `<div class="mlp-hp-row"><span>예측에 쓸 모델: <b>${MLP_MODELS[mk].icon} ${esc(MLP_MODELS[mk].label)}</b></span>
    ${trained ? `<button class="btn-p btn-sm" data-action="mlp-predict-run">▶ 예측 실행</button>` : '<span class="ml-train-hint" style="margin:0">먼저 이 모델을 학습시키세요</span>'}</div>`;
  if(!MLP_PRED || MLP_PRED.model !== mk) return head + '<div class="mlp-anim-empty">테스트 데이터 전원을 이 모델로 채점해 봅니다 — 특히 <b>틀린 사례</b>가 성찰의 재료가 돼요!</div>';
  const P = MLP_PRED;
  if(scn.task === 'regression'){
    const rowsH = P.list.slice(0, 8).map(c => `<tr><td>${esc(_mlpRegRowLabel(c.row))}</td>
      <td>${c.pred.toFixed(2)}${esc(scn.regression.yUnit)}</td><td>${c.row[scn.regression.y]}${esc(scn.regression.yUnit)}</td>
      <td class="${Math.abs(c.err) > P.maeAvg * 1.6 ? 'mlp-err-big' : ''}">${c.err > 0 ? '+' : ''}${c.err.toFixed(2)}</td></tr>`).join('');
    const worst = P.wrong.map(c => `<div class="mlp-wrongcard">😅 <b>${esc(_mlpRegRowLabel(c.row))}</b>인 부원 —
      예측 <b>${c.pred.toFixed(2)}</b> vs 실제 <b>${c.row[scn.regression.y]}</b> (오차 ${Math.abs(c.err).toFixed(2)}${esc(scn.regression.yUnit)})<br>
      <span class="mlp-wrong-q">모델이 못 담은 이 차이는 어디서 왔을까요? 어떤 단서를 더하면 좋을까요?</span></div>`).join('');
    return head + `<table class="tbl mlp-data-table" style="margin-top:8px"><thead><tr><th>부원 조건 (고른 단서)</th><th>예측</th><th>실제</th><th>오차</th></tr></thead><tbody>${rowsH}</tbody></table>
      <div class="sec-title" style="margin-top:10px">예측이 가장 빗나간 사례</div>${worst}`;
  }
  const grid = P.list.map(c => `<span class="mlp-ok ${c.ok ? '' : 'ng'}">${c.ok ? '✓' : '✗'}</span>`).join('');
  const wrongCards = P.wrong.map(c => {
    const feats = _mlpFeatKeys().map(k => {
      const f = scn.features.find(x => x.key === k);
      return `${esc(f.label)} ${esc(mlpFmtFeat(f, c.row[k]))}`;
    }).join(' · ');
    const actual = _mlBin(c.row[scn.target.key], scn.target.posValue) ? scn.target.posLabel : scn.target.negLabel;
    return `<div class="mlp-wrongcard">😅 <b>${feats}</b><br>
      모델 예측: <b class="mlp-wrong-pred">${esc(c.predLabel)}</b> → 실제: <b style="color:var(--ok)">${esc(actual)}</b>
      <span class="mlp-wrong-q">왜 틀렸을까요? 이 사람의 어떤 점이 패턴과 달랐을까요?</span></div>`;
  }).join('');
  return head + `<div class="mlp-okgrid">${grid}</div>
    <div class="mlp-anim-cap">테스트 ${P.list.length}명 중 <b>${P.list.length - P.wrong.length}명 정답</b> (${(P.acc * 100).toFixed(0)}%)</div>
    ${P.wrong.length ? `<div class="sec-title" style="margin-top:10px">모델이 틀린 사람들 (최대 3명)</div>${wrongCards}` : '<div class="mlp-feedback ok">🎉 테스트 전원 정답!</div>'}`;
}

/* 그룹 보기 패널 (군집) */
function _mlpPanelGroups(){
  const scn = MLP_SEL;
  if(!MLP_CLU) return '<div class="mlp-anim-empty">먼저 🎯 k-평균을 실행하세요</div>';
  const keys = MLP_CLU.keys || _mlpFeatKeys();
  const feats = keys.map(k => scn.features.find(f => f.key === k)).filter(Boolean);
  const rows = (MLP_CLU.groupStats || []).map((g, i) => `<tr>
    <td><b>그룹 ${i + 1}</b></td><td>${g.n}명</td>
    ${g.means.map((m, j) => `<td>${m.toFixed(1)}${esc((feats[j] && feats[j].unit) || '')}</td>`).join('')}</tr>`).join('');
  return `<div class="ml-sub-explain">모델은 <b>정답 없이</b> 묶었어요. 각 그룹의 평균을 보고 <b>"어떤 손님들일까?"</b> 이름을 붙여보세요. (검증용으로 숨겨둔 실제 유형과는 <b>${(MLP_CLU.purity * 100).toFixed(0)}%</b> 일치 — 단서를 바꾸면 이 숫자도 달라져요!)</div>
    <table class="mlp-summary"><thead><tr><th></th><th>인원</th>${feats.map(f => `<th>평균 ${esc(f.label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

/* 회귀: 행을 "고른 단서" 값으로 요약 */
function _mlpRegRowLabel(row){
  const scn = MLP_SEL;
  return _mlpFeatKeys().map(k => {
    const f = scn.features.find(x => x.key === k);
    return `${f ? f.label : k} ${mlpFmtFeat(f || {}, row[k])}`;
  }).join(' · ');
}

/* ═══════════════════════════════════════
   ⑤ 성찰 — 재료(오답·편향) + 서술
═══════════════════════════════════════ */

function _vStMlpReflect(){
  const scn = MLP_SEL, A = MLP_ANSWERS;
  if(!scn.mlNeeded){
    const p = scn.reflectPrompts[0];
    return `<div class="section">
      <div class="mlp-feedback ok" style="font-size:14px">🎯 ${scn.trapWhy}</div>
      <div class="mlp-why">
        <div class="mlp-why-label">${p.icon} ${esc(p.label)}</div>
        <textarea class="aia-field-area" data-action="mlp-input" data-fid="${esc(p.id)}" rows="${p.rows}" placeholder="${esc(p.placeholder)}">${esc(A[p.id] || '')}</textarea>
      </div>
      ${_mlpSubmitBar()}
    </div>
    <div class="ml-action-bar"><button class="btn-sm" data-action="mlp-step" data-s="1">← 의뢰 다시 보기</button></div>`;
  }

  const fm = MLP_MODELS[A.finalModelKey];
  const goal = scn.goalQuiz ? (scn.goalQuiz.options.find(o => o.id === A.goalPick) || null) : null;
  const featLbls = (A.featPick || []).map(k => _mlpFeatLabel(scn, k)).join(', ');
  const typeT = A.typePick ? MLP_TYPES[A.typePick] : null;
  const summary = `<table class="mlp-summary"><tbody>
    <tr><th>의뢰(문제)</th><td>${esc(scn.title)}</td></tr>
    ${goal ? `<tr><th>해결 목표</th><td>${esc(goal.label)}</td></tr>` : ''}
    ${featLbls ? `<tr><th>고른 단서</th><td>${esc(featLbls)}</td></tr>` : ''}
    <tr><th>ML 필요?</th><td>${A.need === 'ml' ? '✅ 필요 (데이터로 학습)' : '규칙으로 충분'}</td></tr>
    ${typeT ? `<tr><th>유형 가설</th><td>${typeT.icon} ${esc(typeT.label)}${A.typePick === scn.typeAnswer ? ' <span style="color:var(--ok)">— 실험으로 확인 ✓</span>' : ''}${Array.isArray(A.misTries) && A.misTries.length ? ` <span style="color:var(--text3)">(다른 유형 실험 ${A.misTries.length}회)</span>` : ''}</td></tr>` : ''}
    <tr><th>최종 모델</th><td>${fm ? fm.icon + ' ' + esc(fm.label) : '–'}</td></tr>
    <tr><th>${_mlpMetricLabel(scn)}</th><td><b>${A.finalAcc != null ? (A.finalAcc * 100).toFixed(0) + '%' : '–'}</b></td></tr>
    ${Array.isArray(A.runsLog) && A.runsLog.length > 1 ? `<tr><th>비교한 모델</th><td>${A.runsLog.map(r => `${esc(MLP_MODELS[r.model]?.label || r.model)} ${(r.testAcc * 100).toFixed(0)}%`).join(' · ')}</td></tr>` : ''}
  </tbody></table>
  ${scn.typeWhy ? `<div class="ml-sub-explain" style="margin-top:6px">🔬 <b>유형 확인</b> — ${scn.typeWhy}</div>` : ''}`;

  // 재료 1: 오답/오차 카드
  let material = '';
  if(MLP_PRED && MLP_PRED.wrong.length && scn.task === 'classification'){
    const cards = MLP_PRED.wrong.map(c => {
      const feats = _mlpFeatKeys().map(k => {
        const f = scn.features.find(x => x.key === k);
        return `${esc(f.label)} ${esc(mlpFmtFeat(f, c.row[k]))}`;
      }).join(' · ');
      const actual = _mlBin(c.row[scn.target.key], scn.target.posValue) ? scn.target.posLabel : scn.target.negLabel;
      return `<div class="mlp-wrongcard">😅 <b>${feats}</b><br>모델: <b class="mlp-wrong-pred">${esc(c.predLabel)}</b> → 실제: <b style="color:var(--ok)">${esc(actual)}</b></div>`;
    }).join('');
    material += `<div class="sec-title">🔍 재료 ① — 내 모델이 틀린 사람들</div>
      <div class="ml-sub-explain">아래 성찰을 쓸 때 이 사례들을 근거로 써보세요. <b>"왜 틀렸을까?"</b></div>${cards}`;
  } else if(MLP_PRED && MLP_PRED.wrong.length && scn.task === 'regression'){
    const cfg = scn.regression;
    const cards = MLP_PRED.wrong.map(c => `<div class="mlp-wrongcard">😅 <b>${esc(_mlpRegRowLabel(c.row))}</b>인 부원 —
      예측 <b>${c.pred.toFixed(2)}</b> vs 실제 <b>${c.row[cfg.y]}</b> (${Math.abs(c.err).toFixed(2)}${esc(cfg.yUnit)} 빗나감)</div>`).join('');
    material += `<div class="sec-title">🔍 재료 ① — 예측이 빗나간 사례</div>${cards}`;
  } else if(scn.task === 'clustering' && MLP_CLU){
    const cKeys = MLP_CLU.keys || _mlpFeatKeys();
    const feats = cKeys.map(k => scn.features.find(f => f.key === k)).filter(Boolean);
    const rows = (MLP_CLU.groupStats || []).map((g, i) => `<tr><td><b>그룹 ${i + 1}</b></td><td>${g.n}명</td>
      ${g.means.map((m, j) => `<td>${m.toFixed(1)}${esc((feats[j] && feats[j].unit) || '')}</td>`).join('')}</tr>`).join('');
    material += `<div class="sec-title">🔍 재료 — 그룹별 평균</div>
      <table class="mlp-summary"><thead><tr><th></th><th>인원</th>${feats.map(f => `<th>${esc(f.label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
  }
  // 재료 2: 편향 증거 차트 (타이타닉)
  if(scn.id === 'titanic'){
    material += `<div class="sec-title">⚖️ 재료 ② — 데이터에 담긴 생존율 (편향의 증거)</div>
      ${_mlpBiasChartSvg(scn)}
      <div class="ml-sub-explain">모델이 배운 패턴의 뿌리예요. <b>성별과 객실 등급</b>에 따라 생존율이 크게 달랐죠 — 이런 데이터로 학습한 AI를 현실에 쓰면 어떤 일이 생길까요?</div>`;
  }

  const fields = [{ id: 'modelWhy', icon: '🤖', label: '모델 선택과 비교 — 무엇을 골랐고 왜?', rows: 3, placeholder: '성적표에서 비교한 결과와 함께, 최종 모델을 고른 이유를 적어보세요.' }]
    .concat(scn.reflectPrompts)
    .map(p => `<div class="mlp-why">
      <div class="mlp-why-label">${p.icon} ${esc(p.label)}</div>
      <textarea class="aia-field-area" data-action="mlp-input" data-fid="${esc(p.id)}" rows="${p.rows}" placeholder="${esc(p.placeholder)}">${esc(A[p.id] || '')}</textarea>
    </div>`).join('');

  return `<div class="section">
    <div class="sec-title">⑤ 정리 & 성찰</div>
    ${summary}
    ${material}
    <div class="ml-sub-explain" style="margin-top:10px">위 재료를 근거로 자유롭게 답해보세요. 같은 의뢰라도 <b>여러분의 실험과 생각</b>은 저마다 달라요. (자동 저장)</div>
    ${fields}
    ${_mlpSubmitBar()}
  </div>
  <div class="ml-action-bar"><button class="btn-sm" data-action="mlp-step" data-s="2">← 캔버스로 돌아가 더 실험하기</button></div>`;
}

/* 편향 차트 — 성별×객실등급 생존율 */
function _mlpBiasChartSvg(scn){
  const groups = [];
  [1, 0].forEach(sex => [1, 2, 3].forEach(pc => {
    const rs = scn.rows.filter(r => r.sex === sex && r.pclass === pc);
    const sv = rs.filter(r => r.survived === 1).length;
    groups.push({ label: `${sex ? '여' : '남'} ${pc}등실`, rate: rs.length ? sv / rs.length : 0, female: !!sex });
  }));
  const W = 460, H = 150, P = { l: 30, b: 34, t: 16 };
  const bw = (W - P.l - 12) / groups.length - 10;
  const bars = groups.map((g, i) => {
    const x = P.l + 6 + i * (bw + 10);
    const h = (H - P.t - P.b) * g.rate;
    const y = H - P.b - h;
    return `<rect x="${x}" y="${y.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="4" fill="${g.female ? '#2E9E68' : '#94a3b8'}"/>
      <text x="${x + bw / 2}" y="${y - 4}" text-anchor="middle" class="mlp-bias-v">${(g.rate * 100).toFixed(0)}%</text>
      <text x="${x + bw / 2}" y="${H - P.b + 14}" text-anchor="middle" class="mlp-bias-l">${g.label}</text>`;
  }).join('');
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" class="mlp-bias-svg">
    <line x1="${P.l}" y1="${H - P.b}" x2="${W - 6}" y2="${H - P.b}" class="ax"/>
    ${bars}
    <text x="${P.l}" y="${H - 4}" class="mlp-bias-l">■ 여성</text>
    <text x="${P.l + 52}" y="${H - 4}" class="mlp-bias-l" fill="#94a3b8">■ 남성</text>
  </svg>`;
}

function _mlpSubmitBar(){
  const submitted = !!MLP_SUB?.submittedAt;
  const updated = MLP_SUB?.updatedAt
    ? `<span class="aia-meta">마지막 저장: ${fmtDt(MLP_SUB.updatedAt)}</span>`
    : '<span class="aia-meta">아직 저장된 기록이 없어요</span>';
  const saving = MLP_SAVING === 'save' ? '<span class="aia-meta saving">💾 저장 중...</span>'
               : MLP_SAVING === 'submit' ? '<span class="aia-meta saving">📤 제출 중...</span>' : '';
  const chip = submitted
    ? `<span class="aia-submit-chip done">✓ 제출 완료 · ${fmtDt(MLP_SUB.submittedAt)}</span>`
    : '<span class="aia-submit-chip pending">⏳ 아직 제출하지 않음</span>';
  return `<div class="aia-do-statusbar" style="margin-top:6px">${chip}</div>
    <div class="aia-do-foot">
      ${updated}${saving}
      <button class="btn-sm" data-action="mlp-save" ${MLP_SAVING ? 'disabled' : ''}>💾 임시 저장</button>
      <button class="btn-p btn-sm" data-action="mlp-submit" ${MLP_SAVING ? 'disabled' : ''}>${submitted ? '🔁 다시 제출하기' : '📤 제출하기'}</button>
    </div>`;
}

/* ═══════════════════════════════════════
   선생님 — 학생 기록 (시나리오별 열람 + CSV)
═══════════════════════════════════════ */

function _vTcMlpRecordsSection(){
  const cards = MLP_LIST.map(m => {
    const tagCls = m.tag === '메인' ? 'main' : (m.tag === '함정' ? 'trap' : 'ext');
    return `<div class="aia-card click" data-action="mlp-tc-pick" data-id="${esc(m.id)}">
      <div class="aia-card-icon">${m.icon}</div>
      <div class="aia-card-body">
        <div class="aia-card-sub"><span class="mlp-pick-tag ${tagCls}">${esc(m.tag)}</span> ${esc(m.subtitle || '')}</div>
        <div class="aia-card-title">${esc(m.title)}</div>
      </div>
      <div class="aia-card-arrow">→</div>
    </div>`;
  }).join('');
  return `<div class="section">
    <div class="sec-title">🧩 AI 프로젝트 매니저 — 학생 기록</div>
    <div class="ml-sub-explain">5차시 "기계학습으로 문제 해결" 활동. 학생들의 <b>목표·단서 선택, 모델 비교, 성찰</b>을 확인하고 CSV로 내보내요. (세특 작성 재료)<br>※ 학생에게 보이려면 위 <b>🤖 기계학습 체험 탭</b>을 <b>열기</b>로 켜야 합니다.</div>
    <div class="aia-list">${cards}</div>
  </div>`;
}

function _vTcMlpStudentList(){
  const scn = MLP_TC_SEL;
  const subs = MLP_ALL_SUBS || {};
  const rows = STUDENTS.map(st => {
    const sub = subs[st.number];
    const a = sub?.answers || {};
    const submitted = !!sub?.submittedAt;
    let result = '<span style="color:var(--text3)">–</span>';
    if(sub){
      if(!scn.mlNeeded) result = a.need === 'rule' ? '✅ ML 불필요로 판단' : (a.need ? '🤔 ML 선택' : '진행 중');
      else if(a.finalModelKey) result = `${MLP_MODELS[a.finalModelKey]?.icon || ''} ${MLP_MODELS[a.finalModelKey]?.label || a.finalModelKey} · <b>${(a.finalAcc * 100 || 0).toFixed(0)}%</b>`;
      else result = '진행 중';
    }
    return `<tr>
      <td>${esc(st.number)}</td><td>${esc(st.name)}</td>
      <td>${result}</td>
      <td>${submitted
        ? `<span class="aia-submit-chip done">✓ 제출</span><div style="font-size:10px;color:var(--text3);margin-top:2px">${fmtDt(sub.submittedAt)}</div>`
        : (sub ? '<span class="aia-submit-chip pending">⏳ 미제출</span>' : '<span style="color:var(--text3)">–</span>')}</td>
      <td>${sub?.updatedAt ? fmtDt(sub.updatedAt) : '<span style="color:var(--text3)">미작성</span>'}</td>
      <td><button class="btn-xs" data-action="mlp-tc-view" data-snum="${esc(st.number)}" ${sub ? '' : 'disabled'}>보기</button></td>
    </tr>`;
  }).join('');
  const writtenCount = STUDENTS.filter(st => subs[st.number]?.updatedAt).length;
  const submittedCount = STUDENTS.filter(st => subs[st.number]?.submittedAt).length;
  return `<div class="aia-tc-head">
    <button class="btn-sm" data-action="mlp-tc-back">← 시나리오 선택</button>
    <div class="aia-tc-head-title">${scn.icon} ${esc(scn.title)}</div>
    <button class="btn-sm" data-action="mlp-tc-export">📤 기록 CSV</button>
  </div>
  <div class="asmt-stat-grid">
    <div class="stat-card"><div class="stat-num">${STUDENTS.length}</div><div class="stat-label">전체 학생</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#3b82f6">${writtenCount}</div><div class="stat-label">작성</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--ok)">${submittedCount}</div><div class="stat-label">제출</div></div>
  </div>
  ${STUDENTS.length === 0
    ? emptyBox('👥', '먼저 학생을 등록하세요.')
    : `<div style="overflow-x:auto"><table class="tbl aia-tc-table">
        <thead><tr><th>학번</th><th>이름</th><th>결과</th><th>제출</th><th>마지막 저장</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`}`;
}

function _vTcMlpStudent(){
  const scn = MLP_TC_SEL, snum = MLP_TC_SNUM;
  const st = STUDENTS.find(s => s.number === snum);
  const sub = MLP_ALL_SUBS[snum] || null;
  if(!st) return emptyBox('❓', `학번 ${snum} 학생을 찾을 수 없어요.`);
  const back = `<div class="aia-tcs-header">
    <button class="btn-sm" data-action="mlp-tc-back-list">← 학생 목록</button>
    <div class="aia-tcs-info">
      <span class="aia-tcs-snum">${esc(st.number)}</span>
      <span class="aia-tcs-name">${esc(st.name)}</span>
      ${sub?.submittedAt
        ? `<span class="chip chip-green">✓ 제출 ${fmtDt(sub.submittedAt)}</span>`
        : (sub ? '<span class="chip" style="background:#f59e0b;color:#fff">⏳ 미제출(작성 중)</span>' : '<span class="chip">미작성</span>')}
    </div>
  </div>`;
  if(!sub) return back + emptyBox('📭', '아직 작성된 기록이 없어요.');
  const a = sub.answers || {};

  const goal = scn.goalQuiz ? scn.goalQuiz.options.find(o => o.id === a.goalPick) : null;
  let decisions = '';
  if(goal) decisions += `<tr><th>해결 목표</th><td>${esc(goal.label)}</td></tr>`;
  if(Array.isArray(a.featPick) && a.featPick.length)
    decisions += `<tr><th>고른 단서</th><td>${a.featPick.map(k => esc(_mlpFeatLabel(scn, k))).join(', ')}${a.featPick.some(k => scn.features.find(f => f.key === k && f.decoy)) ? ' <span style="color:#b45309">(미끼 포함!)</span>' : ''}</td></tr>`;
  decisions += `<tr><th>ML 필요?</th><td>${a.need === 'ml' ? '🤖 기계학습' : (a.need === 'rule' ? '⌨️ 그냥 프로그래밍' : '–')}</td></tr>`;
  if(a.typePick)
    decisions += `<tr><th>유형 가설</th><td>${esc(MLP_TYPES[a.typePick]?.label || a.typePick)}${a.typePick === scn.typeAnswer ? ' ✓' : ' <span style="color:#b45309">(정답과 다름)</span>'}${Array.isArray(a.misTries) && a.misTries.length ? ` · 불일치 모델 실험 ${a.misTries.length}회 <span style="color:var(--text3)">(${a.misTries.map(k => esc(MLP_MODELS[k]?.label || k)).join(', ')})</span>` : ''}</td></tr>`;
  if(scn.mlNeeded){
    decisions += `<tr><th>최종 모델·평가</th><td>${a.finalModelKey ? esc(MLP_MODELS[a.finalModelKey]?.label || a.finalModelKey) + ' · <b>' + (a.finalAcc * 100 || 0).toFixed(0) + '%</b>' : '–'}</td></tr>`;
    if(Array.isArray(a.runsLog) && a.runsLog.length)
      decisions += `<tr><th>시도한 모델</th><td>${a.runsLog.map(r => esc(MLP_MODELS[r.model]?.label || r.model) + ' ' + (r.testAcc * 100).toFixed(0) + '%').join(' · ')}</td></tr>`;
  }

  const textFields = [['needWhy', '📝 ML 필요 판단 근거']];
  if(scn.mlNeeded) textFields.push(['modelWhy', '🤖 모델 선택·비교 근거']);
  (scn.reflectPrompts || []).forEach(p => textFields.push([p.id, `${p.icon} ${p.label}`]));
  const texts = textFields.map(([fid, label]) => {
    const v = (a[fid] || '').trim();
    return `<div class="aia-tcs-field"><div class="aia-tcs-label">${esc(label)}</div><pre class="aia-tcs-val${v ? '' : ' empty'}">${v ? esc(v) : '(무응답)'}</pre></div>`;
  }).join('');

  return back
    + `<div class="section aia-tcs-sec"><div class="aia-tcs-sec-title">판단 · 선택</div><table class="mlp-summary"><tbody>${decisions}</tbody></table></div>`
    + `<div class="section aia-tcs-sec"><div class="aia-tcs-sec-title">근거 · 성찰</div><div class="aia-tcs-fields">${texts}</div></div>`;
}
