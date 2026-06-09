/* ═══════════════════════════════════════
   views/ml.js — 🤖 기계학습 체험

   지도학습(분류기) + 비지도학습(그룹화) + 강화학습(기존 게임 링크)
   학생은 코드 0줄, 순수 인터랙션. 모든 결과는 화면에서만 (저장 X)
═══════════════════════════════════════ */

/* ═══════════════════════════════════════
   학생 — 🤖 기계학습 체험 탭
═══════════════════════════════════════ */

// 상위 그룹(유형/모델) → 하위 탭 정의
const ML_GROUPS = {
  type:  { label: '기계학습 유형', tabs: [
    { t: 'supervised',   label: '📚 지도학습' },
    { t: 'unsupervised', label: '🔍 비지도학습' },
    { t: 'reinforce',    label: '🎮 강화학습' },
  ] },
  model: { label: '기계학습 모델', tabs: [
    { t: 'linreg',   label: '📈 선형회귀' },
    { t: 'logistic', label: '📊 로지스틱 회귀' },
    { t: 'dtree',    label: '🌳 결정 트리' },
    { t: 'knn',      label: '👥 kNN' },
    { t: 'kmeans',   label: '🎯 k-평균' },
  ] },
};
function _mlGroupOf(tab){
  for(const g in ML_GROUPS) if(ML_GROUPS[g].tabs.some(x => x.t === tab)) return g;
  return 'type';
}

function vStMl(){
  if(!ML_ACTIVE[SEL_CLS?.id]) return emptyBox('🔒', '기계학습 체험이 아직 열리지 않았어요. 선생님 안내를 기다려주세요.');

  const curGroup = _mlGroupOf(ML_TAB);
  // 상위: 기계학습 유형 / 기계학습 모델
  const groupBar = `<div class="ml-groupbar">${Object.keys(ML_GROUPS).map(g =>
    `<button class="ml-group ${g === curGroup ? 'on' : ''}" data-action="ml-group" data-g="${g}">${esc(ML_GROUPS[g].label)}</button>`
  ).join('')}</div>`;
  // 하위: 선택된 그룹의 탭만
  const sub = `<div class="ml-subtabs">${ML_GROUPS[curGroup].tabs.map(x =>
    `<button class="ml-subtab ${ML_TAB === x.t ? 'on' : ''}" data-action="ml-tab" data-t="${x.t}">${x.label}</button>`
  ).join('')}</div>`;

  let body = '';
  if     (ML_TAB === 'supervised')   body = _vStMlSupervised();
  else if(ML_TAB === 'linreg')       body = _vStMlLinreg();
  else if(ML_TAB === 'logistic')     body = _vStMlLogistic();
  else if(ML_TAB === 'dtree')        body = _vStMlDtree();
  else if(ML_TAB === 'knn')          body = _vStMlKnn();
  else if(ML_TAB === 'kmeans')       body = _vStMlKmeans();
  else if(ML_TAB === 'unsupervised') body = _vStMlUnsupervised();
  else if(ML_TAB === 'reinforce')    body = _vStMlReinforce();

  return `<div class="section ml-head">
    <div class="ml-head-title">🤖 기계학습 체험</div>
    <div class="ml-head-sub">기계학습의 <b>유형</b>(지도·비지도·강화)과 대표 <b>모델</b>(선형회귀·결정 트리)을 직접 해봅시다.</div>
  </div>` + groupBar + sub + body;
}

/* ─────────────────── 지도학습 (학생 주도 흐름) ───────────────────
   Phase: pick → define → label → test → done
       1. pick   : 데이터셋(과일/동물/표정) 고르기
       2. define : 클래스 이름 자유 입력 (2~5개)
       3. label  : 카드 그리드에서 클래스 칩 선택 → 카드 클릭 라벨링
       4. test   : 별도 테스트 풀에서 학생이 카드 선택 → 모델 예측 → 👍/👎 판정
       5. done   : 학생 판정 기준 정확도 + 헷갈린 케이스
─────────────────────────────────────────────────────── */

// 클래스용 색상 팔레트
const ML_CLS_COLORS = [
  { bg:'#fef2f2', border:'#ef4444', chip:'#dc2626' },
  { bg:'#eff6ff', border:'#3b82f6', chip:'#2563eb' },
  { bg:'#f0fdf4', border:'#22c55e', chip:'#16a34a' },
  { bg:'#fffbeb', border:'#eab308', chip:'#ca8a04' },
  { bg:'#faf5ff', border:'#a855f7', chip:'#9333ea' },
];

function _mlStepBar(curStep){
  const steps = ['1. 데이터셋', '2. 그룹 만들고 라벨링', '3. 테스트'];
  return `<div class="ml-stepbar">${steps.map((s, i) => {
    const cls = i === curStep ? 'on' : (i < curStep ? 'done' : '');
    return `<div class="ml-step ${cls}">${s}</div>`;
  }).join('')}</div>`;
}

function _vStMlSupervised(){
  if(ML_SUP_PHASE === 'pick' || !ML_SUP_DATASET) return _vStMlSupPick();
  if(ML_SUP_PHASE === 'label') return _vStMlSupLabel();
  if(ML_SUP_PHASE === 'test')  return _vStMlSupTest();
  return _vStMlSupPick();
}

/* Phase 1: 데이터셋 선택 */
function _vStMlSupPick(){
  const cards = ML_DATASETS.map(d => {
    const previews = d.classes.map(c => `<span class="ml-pick-emoji">${c.emoji}</span>`).join('');
    return `<div class="ml-pick-card click" data-action="ml-sup-pick" data-did="${esc(d.id)}">
      <div class="ml-pick-icon">${d.icon}</div>
      <div class="ml-pick-body">
        <div class="ml-pick-title">${esc(d.title)}</div>
        <div class="ml-pick-desc">${esc(d.desc)}</div>
        <div class="ml-pick-emojis">${previews}</div>
      </div>
      <div class="ml-pick-arrow">→</div>
    </div>`;
  }).join('');

  return `<div class="section">
    <div class="ml-intro">
      <b>📚 지도학습</b>은 사람이 <u>정답(라벨)을 직접 알려주면서</u> 학습시키는 방식이에요.
      직접 카드를 분류해서 모델을 가르쳐봐요!
    </div>
    ${_mlStepBar(0)}
    <div class="sec-title">어떤 데이터로 가르칠까요?</div>
    <div class="ml-pick-list">${cards}</div>
  </div>`;
}

/* Phase 2: Teachable Machine 식 — 그룹 박스에 사진 끌어담기
   위: 그룹 박스들(각각 드롭존) / 아래: 공용 풀(라벨 안 된 사진, draggable)
   "전부 분류"가 아니라 "각 그룹에 예시 몇 장 담기" */
function _vStMlSupLabel(){
  const ds = ML_SUP_DATASET;
  const samples = ML_SUP_POOL.samples;

  // 각 그룹에 담긴 카드 인덱스
  const clsCards = {};
  ML_SUP_CLASSES.forEach(c => clsCards[c.id] = []);
  Object.entries(ML_SUP_LABELS).forEach(([idx, cid]) => {
    if(clsCards[cid]) clsCards[cid].push(parseInt(idx));
  });

  // 그룹 박스들 (3개 고정 — 이름 input 항상 표시, 추가/삭제 없음)
  const groupBoxes = ML_SUP_CLASSES.map((c, i) => {
    const col = ML_CLS_COLORS[i % ML_CLS_COLORS.length];
    const isActive = ML_SUP_ACTIVE_CLS === c.id;
    const cards = clsCards[c.id] || [];
    // 담긴 카드들
    const cardsHtml = cards.map(idx => {
      const s = samples[idx];
      return `<div class="ml-gb-card" data-action="ml-sup-card-unlabel" data-idx="${idx}" title="클릭하면 다시 빼요">
        <img src="${s.dataUrl}" alt=""/>
      </div>`;
    }).join('');
    return `<div class="ml-group-box ${isActive ? 'active' : ''}"
        data-group-drop="${esc(c.id)}"
        style="border-color:${col.border};background:${col.bg}">
      <div class="ml-gb-head">
        <span class="ml-gb-dot" style="background:${col.chip}"></span>
        <input type="text" class="ml-gb-input"
          data-action="ml-sup-cls-name" data-cid="${esc(c.id)}"
          value="${esc(c.name)}" placeholder="그룹 ${i + 1} 이름" maxlength="20"/>
        <span class="ml-gb-cnt">${cards.length}장</span>
      </div>
      <div class="ml-gb-cards" data-action="ml-sup-cls-pick" data-cid="${esc(c.id)}">
        ${cardsHtml || '<div class="ml-gb-empty">여기로 사진을<br>끌어다 놓아요</div>'}
      </div>
    </div>`;
  }).join('');

  const addBox = '';

  // 공용 풀 (아직 라벨 안 된 카드만)
  const poolCards = samples.map((s, i) => {
    if(ML_SUP_LABELS[i] != null) return '';  // 이미 그룹에 담김 → 풀에서 숨김
    return `<div class="ml-pool-card" data-action="ml-sup-pool-pick" data-idx="${i}">
      <img src="${s.dataUrl}" draggable="true" data-label-idx="${i}" alt=""/>
    </div>`;
  }).join('');
  const poolRemaining = samples.length - Object.keys(ML_SUP_LABELS).length;

  // 학습 가능 조건 — 이름 채운 그룹 2개 이상 + 각각 1장 이상
  const namedClasses = ML_SUP_CLASSES.filter(c => (c.name || '').trim());
  const allHaveData = namedClasses.length >= 2 && namedClasses.every(c => (clsCards[c.id] || []).length >= 1);
  let trainHint = '';
  if(namedClasses.length < 2){
    trainHint = '그룹 2개 이상에 이름을 정해주세요.';
  } else if(!allHaveData){
    trainHint = '이름 정한 그룹마다 사진을 1장 이상 담아주세요. (그룹당 3~4장이면 충분해요)';
  }

  const activeName = ML_SUP_ACTIVE_CLS
    ? ML_SUP_CLASSES.find(c => c.id === ML_SUP_ACTIVE_CLS)?.name
    : null;

  return `<div class="back-btn" data-action="ml-sup-back">← 다른 데이터셋 고르기</div>
    ${_mlStepBar(1)}
    <div class="section">
      <div class="sec-title">${ds.icon} ${esc(ds.title)} — 그룹 이름 정하고 사진 담기</div>
      <div class="ml-sub-explain">
        ① 아래 <b>3개 그룹의 이름을 정해요</b> (예: 사과 / 바나나 / 포도) → ② 사진들을 <b>각 그룹 박스로 끌어다 담아요</b>.<br>
        <u>전부 담을 필요 없어요!</u> 그룹마다 <b>3~4장</b>만 모으면 충분해요.
        ${ML_SUP_ACTIVE_CLS && activeName
          ? `<br><span class="ml-active-inline">📌 클릭으로도 담기: 지금 선택된 그룹 <b>${esc(activeName)}</b> — 아래 사진을 클릭하면 담겨요.</span>`
          : ''}
      </div>
      <div class="ml-group-boxes">
        ${groupBoxes}
      </div>
      <div class="ml-pool-label">
        아직 분류 안 한 사진 <b>${poolRemaining}장</b>
        <span class="ml-pool-hint">— 사진을 위 그룹으로 드래그하세요 (또는 그룹 선택 후 클릭)</span>
      </div>
      <div class="ml-pool">
        ${poolRemaining > 0 ? poolCards : '<div class="ml-pool-empty">🎉 모든 사진을 분류했어요!</div>'}
      </div>
    </div>
    <div class="ml-action-bar">
      ${trainHint ? `<div class="ml-train-hint">${trainHint}</div>` : ''}
      <button class="btn-p" data-action="ml-sup-train" ${allHaveData ? '' : 'disabled'}>🧠 학습하고 테스트하러 가기 →</button>
    </div>`;
}

/* Phase 4: 테스트 — 학생이 마우스로 직접 그려서 모델에게 맞춰보기 */
const ML_DRAW_PALETTE = [
  { c: '#e23b3b', name: '빨강' },
  { c: '#f5a623', name: '주황' },
  { c: '#f5d020', name: '노랑' },
  { c: '#6abf4b', name: '초록' },
  { c: '#3b82f6', name: '파랑' },
  { c: '#8b3fb0', name: '보라' },
  { c: '#8b5a2b', name: '갈색' },
  { c: '#333333', name: '검정' },
];

function _vStMlSupTest(){
  const ds = ML_SUP_DATASET;
  const pred = ML_SUP_DRAW_PRED;

  // 팔레트
  const palette = ML_DRAW_PALETTE.map(p =>
    `<button class="ml-pal ${ML_SUP_DRAW_COLOR === p.c ? 'on' : ''}" data-action="ml-sup-draw-color" data-color="${p.c}" title="${p.name}" style="background:${p.c}"></button>`
  ).join('');

  // 출력(확률 막대)
  let outputBox;
  if(pred){
    const bars = ML_SUP_CLASSES.map((c, ci) => {
      const p = pred.probs[c.id] || 0;
      const col = ML_CLS_COLORS[ci % ML_CLS_COLORS.length];
      const isPred = pred.classId === c.id;
      return `<div class="ml-prob-row ${isPred ? 'pred' : ''}">
        <div class="ml-prob-label">${esc(c.name)}</div>
        <div class="ml-prob-bar"><div class="ml-prob-fill" style="width:${(p * 100).toFixed(0)}%;background:${col.chip}"></div></div>
        <div class="ml-prob-pct">${(p * 100).toFixed(0)}%</div>
      </div>`;
    }).join('');
    const predName = ML_SUP_CLASSES.find(c => c.id === pred.classId)?.name || '?';
    outputBox = `<div class="ml-tm-output">
      <div class="ml-tm-box-title">출력 (모델의 예측)</div>
      <div class="ml-draw-verdict">🤖 모델은 <b>"${esc(predName)}"</b> 같대요!</div>
      ${bars}
    </div>`;
  } else {
    outputBox = `<div class="ml-tm-output empty">
      <div class="ml-tm-box-title">출력 (모델의 예측)</div>
      <div class="ml-tm-output-empty">그림을 그리고<br><b>맞춰보기</b>를 누르면<br>예측이 나와요</div>
    </div>`;
  }

  return `<div class="back-btn" data-action="ml-sup-back-label">← 라벨링 다시 하기</div>
    ${_mlStepBar(2)}
    <div class="section">
      <div class="sec-title">🧪 모델 테스트 — 직접 그려서 맞춰보기</div>
      <div class="ml-sub-explain">
        아래 칸에 <b>마우스로 직접 그림을 그려보세요</b>! (예: 빨강으로 동그란 사과)
        그리고 <b>맞춰보기</b>를 누르면, 내가 학습시킨 모델이 어느 그룹인지 알아맞혀요.<br>
        💡 이 모델은 <u>색을 많이 봐요</u> — 그릴 때 색을 비슷하게 칠하면 더 잘 맞춰요.
      </div>

      <div class="ml-tm-flow">
        <div class="ml-tm-col">
          <div class="ml-tm-box-title">입력 (내 그림)</div>
          <canvas id="ml-draw-canvas" class="ml-draw-canvas" width="280" height="280"></canvas>
          <div class="ml-draw-tools">
            <div class="ml-pal-row">${palette}</div>
            <button class="btn-xs" data-action="ml-sup-draw-clear">🗑 지우기</button>
          </div>
        </div>
        <div class="ml-tm-arrow">➜</div>
        <div class="ml-tm-col grow">
          ${outputBox}
          <button class="btn-p ml-draw-predict" data-action="ml-sup-draw-predict">🤖 맞춰보기</button>
        </div>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════
   📈 선형회귀 (단순회귀) — 학생 주도 흐름
   Stage: draw → learn → optimal → mse
     draw    : 산점도 보고 직접 직선 맞추기(양 끝 ● 드래그) + 새 값 예측 적기
     learn   : 경사하강법으로 직선이 움직이며 오차(MSE) 줄어드는 과정 관찰
     optimal : 최소제곱 정답선 공개 + 내 선과 비교 + 새 값 예측 확인
     mse     : 잔차(세로 오차선) 시각화 + MSE 계산법 단계별 설명
═══════════════════════════════════════ */

// ── SVG 산점도 좌표계 (viewBox 고정, CSS로 가로 100%) ──
const LR_SVG_W = 540, LR_SVG_H = 380;
const LR_PAD = { l: 52, r: 18, t: 18, b: 42 };
const LR_PLOT_W = LR_SVG_W - LR_PAD.l - LR_PAD.r;
const LR_PLOT_H = LR_SVG_H - LR_PAD.t - LR_PAD.b;

function _mlLrBounds(ds){
  const xs = ds.points.map(p => p[0]), ys = ds.points.map(p => p[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const xpad = (xmax - xmin) * 0.08 || 1;
  const ypad = (ymax - ymin) * 0.12 || 1;
  return {
    xMin: xmin - xpad, xMax: xmax + xpad,
    yMin: ds.yAnchor0 ? 0 : ymin - ypad, yMax: ymax + ypad,
  };
}
function _mlLrSX(b, x){ return LR_PAD.l + (x - b.xMin) / (b.xMax - b.xMin) * LR_PLOT_W; }
function _mlLrSY(b, y){ return LR_PAD.t + (1 - (y - b.yMin) / (b.yMax - b.yMin)) * LR_PLOT_H; }

// 보기 좋은 눈금값 생성
function _mlLrTicks(min, max, count){
  const span = max - min || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const stepN = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  const step = stepN * mag;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for(let v = start; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

function _mlLrNum(v, d){ d = d == null ? 1 : d; const m = Math.pow(10, d); return (Math.round(v * m) / m).toFixed(d); }
function _mlLrRound(v, d){ const m = Math.pow(10, d || 0); return Math.round(v * m) / m; }
function _mlLrFmtEq(a, b){ return `y = ${_mlLrNum(a, 1)} x ${b >= 0 ? '+' : '−'} ${_mlLrNum(Math.abs(b), 1)}`; }

// 직선 두 끝점(xMin/xMax 높이) → { a, b }
function _mlLrLineFromHandles(b, h){
  const a = (h.yR - h.yL) / (b.xMax - b.xMin);
  return { a, b: h.yL - a * b.xMin };
}

// SVG 산점도 빌더. opts: { mine, handles, gd:{a,b}, opt:{a,b}, residFor:'mine'|'opt', predict:{x,ab} }
function _mlLrPlotSvg(ds, opts){
  opts = opts || {};
  const b = _mlLrBounds(ds);

  // 격자 + 눈금
  let grid = '', tickLabels = '';
  _mlLrTicks(b.xMin, b.xMax, 5).forEach(t => {
    if(t < b.xMin || t > b.xMax) return;
    const x = _mlLrSX(b, t);
    grid += `<line class="lr-grid" x1="${x.toFixed(1)}" y1="${LR_PAD.t}" x2="${x.toFixed(1)}" y2="${LR_PAD.t + LR_PLOT_H}"/>`;
    tickLabels += `<text class="lr-tick" x="${x.toFixed(1)}" y="${LR_PAD.t + LR_PLOT_H + 16}" text-anchor="middle">${_mlLrNum(t, t % 1 === 0 ? 0 : 1)}</text>`;
  });
  _mlLrTicks(b.yMin, b.yMax, 5).forEach(t => {
    if(t < b.yMin || t > b.yMax) return;
    const y = _mlLrSY(b, t);
    grid += `<line class="lr-grid" x1="${LR_PAD.l}" y1="${y.toFixed(1)}" x2="${LR_PAD.l + LR_PLOT_W}" y2="${y.toFixed(1)}"/>`;
    tickLabels += `<text class="lr-tick" x="${LR_PAD.l - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${_mlLrNum(t, 0)}</text>`;
  });
  const axis = `<line class="lr-axis" x1="${LR_PAD.l}" y1="${LR_PAD.t}" x2="${LR_PAD.l}" y2="${LR_PAD.t + LR_PLOT_H}"/>
    <line class="lr-axis" x1="${LR_PAD.l}" y1="${LR_PAD.t + LR_PLOT_H}" x2="${LR_PAD.l + LR_PLOT_W}" y2="${LR_PAD.t + LR_PLOT_H}"/>`;
  const cy = LR_PAD.t + LR_PLOT_H / 2;
  const axisName = `<text class="lr-axisname" x="${LR_PAD.l + LR_PLOT_W / 2}" y="${LR_SVG_H - 6}" text-anchor="middle">${esc(ds.xLabel)} (${esc(ds.xUnit)})</text>
    <text class="lr-axisname" x="14" y="${cy}" text-anchor="middle" transform="rotate(-90 14 ${cy})">${esc(ds.yLabel)} (${esc(ds.yUnit)})</text>`;

  // 잔차(세로 오차선)
  let resid = '';
  if(opts.residFor){
    const ab = opts.residFor === 'mine' ? _mlLrLineFromHandles(b, ML_LR_HANDLES) : (opts.opt || ML_LR_FIT);
    if(ab) ds.points.forEach(([x, y]) => {
      const yhat = ab.a * x + ab.b;
      resid += `<line class="lr-resid" x1="${_mlLrSX(b, x).toFixed(1)}" y1="${_mlLrSY(b, y).toFixed(1)}" x2="${_mlLrSX(b, x).toFixed(1)}" y2="${_mlLrSY(b, yhat).toFixed(1)}"/>`;
    });
  }

  // 직선들
  const seg = (ab, cls, id) => {
    const y1 = ab.a * b.xMin + ab.b, y2 = ab.a * b.xMax + ab.b;
    return `<line ${id ? `id="${id}" ` : ''}class="${cls}" x1="${_mlLrSX(b, b.xMin).toFixed(1)}" y1="${_mlLrSY(b, y1).toFixed(1)}" x2="${_mlLrSX(b, b.xMax).toFixed(1)}" y2="${_mlLrSY(b, y2).toFixed(1)}"/>`;
  };
  let lines = '';
  if(opts.mine && ML_LR_HANDLES) lines += seg(_mlLrLineFromHandles(b, ML_LR_HANDLES), 'lr-line-mine', 'lr-line-mine');
  if(opts.gd) lines += seg(opts.gd, 'lr-line-gd', 'lr-line-gd');
  if(opts.opt) lines += seg(opts.opt, 'lr-line-opt', 'lr-line-opt');

  // 예측 표시 (십자 점선 + 예측점)
  let predict = '';
  if(opts.predict && opts.predict.ab){
    const { x, ab } = opts.predict;
    const yhat = ab.a * x + ab.b;
    const px = _mlLrSX(b, x), py = _mlLrSY(b, yhat);
    predict = `<line id="lr-pred-v" class="lr-pred-line" x1="${px.toFixed(1)}" y1="${(LR_PAD.t + LR_PLOT_H).toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}"/>
      <line id="lr-pred-h" class="lr-pred-line" x1="${LR_PAD.l}" y1="${py.toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}"/>
      <circle id="lr-pred-dot" class="lr-pred-dot" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6"/>`;
  }

  // 데이터 점
  const dots = ds.points.map(([x, y]) => `<circle class="lr-dot" cx="${_mlLrSX(b, x).toFixed(1)}" cy="${_mlLrSY(b, y).toFixed(1)}" r="5"/>`).join('');

  // 드래그 핸들 (양 끝)
  let handles = '';
  if(opts.handles && ML_LR_HANDLES){
    const HX = { L: _mlLrSX(b, b.xMin), R: _mlLrSX(b, b.xMax) };
    const HY = { L: _mlLrSY(b, ML_LR_HANDLES.yL), R: _mlLrSY(b, ML_LR_HANDLES.yR) };
    ['L', 'R'].forEach(s => {
      handles += `<circle class="lr-handle-hit" id="lr-hhit-${s}" data-h="${s}" cx="${HX[s].toFixed(1)}" cy="${HY[s].toFixed(1)}" r="22"/>
        <circle class="lr-handle" id="lr-h-${s}" data-h="${s}" cx="${HX[s].toFixed(1)}" cy="${HY[s].toFixed(1)}" r="9"/>`;
    });
  }

  return `<svg id="lr-svg" class="lr-svg" viewBox="0 0 ${LR_SVG_W} ${LR_SVG_H}" ${opts.handles ? 'data-interactive="1"' : ''} role="img">
    <defs><clipPath id="lr-clip"><rect x="${LR_PAD.l}" y="${LR_PAD.t}" width="${LR_PLOT_W}" height="${LR_PLOT_H}"/></clipPath></defs>
    ${grid}${axis}
    <g clip-path="url(#lr-clip)">${resid}${lines}${predict}${dots}</g>
    ${tickLabels}${axisName}${handles}
  </svg>`;
}

function _lrStepBar(cur){
  const steps = ['1. 선 긋기', '2. 학습', '3. 최적선·예측', '4. 오차(MSE)'];
  return `<div class="ml-stepbar">${steps.map((s, i) => {
    const cls = i === cur ? 'on' : (i < cur ? 'done' : '');
    return `<div class="ml-step ${cls}">${s}</div>`;
  }).join('')}</div>`;
}

function _vStMlLinreg(){
  if(!ML_LR_DATASET) return _vStMlLrPick();
  if(ML_LR_STAGE === 'learn')   return _vStMlLrLearn();
  if(ML_LR_STAGE === 'optimal') return _vStMlLrOptimal();
  if(ML_LR_STAGE === 'mse')     return _vStMlLrMse();
  return _vStMlLrDraw();
}

/* Stage 0: 데이터 선택 */
function _vStMlLrPick(){
  const cards = ML_LR_DATASETS.map(d => `<div class="ml-pick-card click" data-action="ml-lr-pick" data-did="${esc(d.id)}">
    <div class="ml-pick-icon">${d.icon}</div>
    <div class="ml-pick-body">
      <div class="ml-pick-title">${esc(d.title)}</div>
      <div class="ml-pick-desc">${esc(d.desc)}</div>
      <div class="ml-pick-emojis"><span class="ml-pick-cnt">데이터 ${d.points.length}개 · ${esc(d.xLabel)} ↔ ${esc(d.yLabel)}</span></div>
    </div>
    <div class="ml-pick-arrow">→</div>
  </div>`).join('');

  return `<div class="section">
    <div class="ml-intro">
      <b>📈 선형회귀</b>는 흩어진 점들 사이를 가장 잘 지나는 <u>직선 하나</u>를 찾는 거예요.
      그 직선만 있으면 <u>새로운 값도 예측</u>할 수 있죠. 직접 그어보고, 기계가 어떻게 더 잘 긋는지 봐요!
    </div>
    ${_lrStepBar(-1)}
    <div class="sec-title">어떤 데이터로 해볼까요?</div>
    <div class="ml-pick-list">${cards}</div>
  </div>`;
}

/* Stage 1(draw): 직접 직선 긋기 + 새 값 예측 적기 */
function _vStMlLrDraw(){
  const ds = ML_LR_DATASET;
  const b = _mlLrBounds(ds);
  const mine = _mlLrLineFromHandles(b, ML_LR_HANDLES);
  const plot = _mlLrPlotSvg(ds, { mine: true, handles: true, predict: { x: ds.predictX, ab: mine } });

  return `<div class="back-btn" data-action="ml-lr-back">← 다른 데이터 고르기</div>
    ${_lrStepBar(0)}
    <div class="section">
      <div class="sec-title">${ds.icon} ${esc(ds.title)} — 직접 직선 그어보기</div>
      <div class="ml-sub-explain">
        점들이 오른쪽 위로 올라가죠? 이 흐름을 가장 잘 나타내는 <b>직선</b>을 그어봐요.<br>
        직선 양 끝의 <span class="lr-inline-handle">●</span> 점을 <b>위아래로 끌어서</b> 점들 한가운데를 지나가도록 맞추세요.
      </div>
      <div class="lr-plot-wrap">${plot}</div>
      <div class="lr-eq-row">
        <span class="lr-eq-label">내 직선</span>
        <span class="lr-eq" id="lr-eq-mine">${_mlLrFmtEq(mine.a, mine.b)}</span>
      </div>
      <div class="lr-eq-help">기울기 a = x가 1 늘 때 y가 오르는 양 · 절편 b = 직선이 세로축과 만나는 값</div>

      <div class="lr-predict-box">
        <div class="lr-predict-q">🔮 ${esc(ds.xLabel)}가 <b>${ds.predictX}${esc(ds.xUnit)}</b>이면 ${esc(ds.yLabel)}는 얼마쯤일까요?</div>
        <div class="lr-predict-hint">그래프의 점선을 따라 <b>내 직선</b>이 가리키는 값을 읽어서 적어보세요. (정답은 나중에 확인해요!)</div>
        <div class="lr-predict-input">
          <input type="number" id="lr-userpred" class="lr-num-input" placeholder="예측값" value="${esc(ML_LR_USER_PRED)}"/>
          <span class="lr-unit">${esc(ds.yUnit)}</span>
        </div>
      </div>
    </div>
    <div class="ml-action-bar">
      <button class="btn-p" data-action="ml-lr-stage" data-s="learn">🧠 기계가 학습하는 과정 보기 →</button>
    </div>`;
}

/* Stage 2(learn): 경사하강법 애니메이션 */
function _vStMlLrLearn(){
  const ds = ML_LR_DATASET;
  const b = _mlLrBounds(ds);
  const gd = ML_LR_GD;
  const mine = _mlLrLineFromHandles(b, ML_LR_HANDLES);
  const mineMse = mlLinregMSE(ds.points, mine.a, mine.b);
  const plot = _mlLrPlotSvg(ds, { mine: true, gd: gd ? { a: gd.a, b: gd.b } : null });

  const running = !!ML_LR_AUTO;
  const done = gd && gd.done;
  const info = gd
    ? `<div class="lr-learn-info">
         <div class="lr-learn-stat"><span>학습 횟수</span><b>${gd.iter}</b></div>
         <div class="lr-learn-stat big"><span>기계 직선의 오차(MSE)</span><b>${_mlLrNum(gd.mse, 1)}</b></div>
         <div class="lr-learn-stat"><span>내 직선의 오차</span><b>${_mlLrNum(mineMse, 1)}</b></div>
       </div>
       ${done ? '<div class="lr-converged">✓ 거의 다 찾았어요! 더 움직여도 오차가 거의 안 줄어요.</div>' : ''}`
    : `<div class="lr-learn-info"><div class="lr-learn-stat big"><span>내 직선의 오차(MSE)</span><b>${_mlLrNum(mineMse, 1)}</b></div></div>`;

  return `<div class="back-btn" data-action="ml-lr-stage" data-s="draw">← 선 다시 긋기</div>
    ${_lrStepBar(1)}
    <div class="section">
      <div class="sec-title">🧠 기계가 스스로 직선을 찾아가요</div>
      <div class="ml-sub-explain">
        기계는 처음엔 <b>평평한 직선(평균)</b>에서 시작해, 오차가 작아지는 쪽으로 기울기와 위치를 <b>조금씩</b> 고쳐가요.
        <b>▶ 학습</b>을 눌러 <span class="lr-key-gd">주황 직선</span>이 점들 사이로 들어가며 <b>오차(MSE)가 줄어드는</b> 걸 보세요. (<span class="lr-key-mine">회색</span> = 내가 그은 선)
      </div>
      ${info}
      <div class="ml-action-bar lr-learn-bar">
        <button class="btn-sm" data-action="ml-lr-step" ${running ? 'disabled' : ''}>⏭ 한 단계</button>
        <button class="btn-p btn-sm" data-action="ml-lr-run">${running ? '⏸ 정지' : (gd && gd.iter ? '▶ 이어서 학습' : '▶ 학습 시작')}</button>
        <button class="btn-sm" data-action="ml-lr-reset" ${running ? 'disabled' : ''}>⟲ 처음부터</button>
      </div>
      <div class="lr-plot-wrap">${plot}</div>
    </div>
    <div class="ml-action-bar">
      <button class="btn-p" data-action="ml-lr-stage" data-s="optimal">✅ 최적의 직선 확인하기 →</button>
    </div>`;
}

/* Stage 3(optimal): 최적선 공개 + 비교 + 예측 확인 */
function _vStMlLrOptimal(){
  const ds = ML_LR_DATASET;
  const b = _mlLrBounds(ds);
  const fit = ML_LR_FIT || (ML_LR_FIT = mlLinregFit(ds.points));
  const mine = _mlLrLineFromHandles(b, ML_LR_HANDLES);
  const mineMse = mlLinregMSE(ds.points, mine.a, mine.b);
  const plot = _mlLrPlotSvg(ds, { mine: true, opt: { a: fit.a, b: fit.b }, predict: { x: ds.predictX, ab: fit } });

  const optPred = _mlLrRound(fit.a * ds.predictX + fit.b, ds.decimals);
  const userPredTxt = (ML_LR_USER_PRED || '').trim();
  const probeX = (ML_LR_PROBE_X || '').trim();
  const probeVal = probeX !== '' && !isNaN(parseFloat(probeX)) ? _mlLrRound(fit.a * parseFloat(probeX) + fit.b, ds.decimals) : null;

  return `<div class="back-btn" data-action="ml-lr-stage" data-s="learn">← 학습 과정 다시 보기</div>
    ${_lrStepBar(2)}
    <div class="section">
      <div class="sec-title">✅ 최적의 회귀선</div>
      <div class="ml-sub-explain">
        오차(MSE)가 <b>가장 작아지는</b> 직선이에요. (<span class="lr-key-opt">초록</span> = 최적선, <span class="lr-key-mine">회색</span> = 내가 그은 선)
      </div>
      <div class="lr-plot-wrap">${plot}</div>

      <div class="lr-compare">
        <div class="lr-compare-card mine">
          <div class="lr-compare-head">✏️ 내 직선</div>
          <div class="lr-compare-eq">${_mlLrFmtEq(mine.a, mine.b)}</div>
          <div class="lr-compare-mse">오차 ${_mlLrNum(mineMse, 1)}</div>
        </div>
        <div class="lr-compare-card opt">
          <div class="lr-compare-head">🎯 최적 직선</div>
          <div class="lr-compare-eq">${_mlLrFmtEq(fit.a, fit.b)}</div>
          <div class="lr-compare-mse">오차 ${_mlLrNum(fit.mse, 1)}</div>
        </div>
      </div>
      <div class="lr-compare-note">${mineMse <= fit.mse + 0.5 ? '내 직선도 아주 잘 그었네요! 👏 거의 최적이에요.' : '오차가 작을수록 점들에 더 잘 맞는 직선이에요. 최적 직선의 오차가 더 작죠?'}</div>

      <div class="lr-predict-box confirm">
        <div class="lr-predict-q">🔮 새로운 값으로 예측 확인</div>
        <div class="lr-confirm-row">
          <div class="lr-confirm-item"><span>${esc(ds.xLabel)} ${ds.predictX}${esc(ds.xUnit)}일 때</span></div>
          <div class="lr-confirm-item ${userPredTxt ? '' : 'muted'}"><span>내가 적은 값</span><b>${userPredTxt ? esc(userPredTxt) + esc(ds.yUnit) : '—'}</b></div>
          <div class="lr-confirm-item hi"><span>최적선 예측</span><b>${optPred}${esc(ds.yUnit)}</b></div>
        </div>
        <div class="lr-probe">
          <span class="lr-probe-eq">${esc(ds.xLabel)} =</span>
          <input type="number" id="lr-probe" class="lr-num-input sm" placeholder="${ds.predictX}" value="${esc(ML_LR_PROBE_X)}"/>
          <span class="lr-unit">${esc(ds.xUnit)}</span>
          <span class="lr-probe-arrow">→</span>
          <span class="lr-probe-out" id="lr-probe-out">${probeVal != null ? `${esc(ds.yLabel)} 약 <b>${probeVal}${esc(ds.yUnit)}</b>` : '다른 값을 넣으면 예측값이 나와요'}</span>
        </div>
      </div>
    </div>
    <div class="ml-action-bar">
      <button class="btn-p" data-action="ml-lr-stage" data-s="mse">📏 오차(MSE)는 어떻게 구할까? →</button>
    </div>`;
}

/* Stage 4(mse): 잔차 시각화 + MSE 계산법 */
function _vStMlLrMse(){
  const ds = ML_LR_DATASET;
  const b = _mlLrBounds(ds);
  const fit = ML_LR_FIT || (ML_LR_FIT = mlLinregFit(ds.points));
  const mine = _mlLrLineFromHandles(b, ML_LR_HANDLES);
  const forMine = ML_LR_RESID_FOR === 'mine';
  const ab = forMine ? mine : fit;
  const plot = _mlLrPlotSvg(ds, { mine: forMine, opt: forMine ? null : { a: fit.a, b: fit.b }, residFor: ML_LR_RESID_FOR });

  let sumSq = 0;
  const rows = ds.points.map(([x, y]) => {
    const yhat = ab.a * x + ab.b, e = y - yhat;
    sumSq += e * e;
    return `<tr><td>${_mlLrNum(x, x % 1 === 0 ? 0 : 1)}</td><td>${y}</td><td>${_mlLrNum(yhat, 1)}</td><td>${_mlLrNum(e, 1)}</td><td>${_mlLrNum(e * e, 1)}</td></tr>`;
  }).join('');
  const n = ds.points.length;
  const mse = sumSq / n;
  const mineMse = mlLinregMSE(ds.points, mine.a, mine.b);

  return `<div class="back-btn" data-action="ml-lr-stage" data-s="optimal">← 최적선으로</div>
    ${_lrStepBar(3)}
    <div class="section">
      <div class="sec-title">📏 오차(MSE)는 어떻게 구할까?</div>
      <div class="ml-sub-explain">
        <b>MSE</b>(평균제곱오차)는 <u>직선이 점들에서 평균적으로 얼마나 벗어났는지</u>를 나타내는 숫자예요. 작을수록 잘 맞는 직선이죠.
      </div>

      <div class="lr-resid-toggle">
        <span>잔차를 볼 직선:</span>
        <button class="lr-seg ${!forMine ? 'on' : ''}" data-action="ml-lr-resid" data-for="opt">🎯 최적 직선</button>
        <button class="lr-seg ${forMine ? 'on' : ''}" data-action="ml-lr-resid" data-for="mine">✏️ 내 직선</button>
      </div>
      <div class="lr-plot-wrap">${plot}</div>

      <ol class="lr-mse-steps">
        <li><b>① 오차</b> = 실제값 − 예측값. 위 그래프의 <span class="lr-resid-key">빨간 세로선</span> 하나하나가 그 오차예요.</li>
        <li><b>② 제곱</b>: 오차에는 +(위로 벗어남)도 −(아래로 벗어남)도 있어 그냥 더하면 상쇄돼요. 그래서 <b>제곱</b>해 모두 양수로 만들고, 큰 오차일수록 더 크게 벌해요.</li>
        <li><b>③ 평균</b>: 제곱한 오차들을 모두 더해 개수(${n})로 나눠요.</li>
      </ol>
      <div class="lr-formula">MSE = <span class="lr-frac"><span>1</span><span>${n}</span></span> × ((실제−예측)² 의 합) = <span class="lr-frac"><span>${_mlLrNum(sumSq, 1)}</span><span>${n}</span></span> = <b>${_mlLrNum(mse, 1)}</b></div>

      <details class="lr-table-wrap">
        <summary>점별 오차 계산 표 펼치기 (${n}개)</summary>
        <table class="lr-table">
          <thead><tr><th>${esc(ds.xLabel)}</th><th>실제값</th><th>예측값</th><th>오차</th><th>오차²</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="4">오차² 합계</td><td><b>${_mlLrNum(sumSq, 1)}</b></td></tr></tfoot>
        </table>
      </details>

      <div class="lr-mse-conclude">
        내 직선의 MSE = <b>${_mlLrNum(mineMse, 1)}</b> · 최적 직선의 MSE = <b>${_mlLrNum(fit.mse, 1)}</b><br>
        기계가 한 ‘학습’이 바로 이 <b>MSE가 가장 작아지는 직선</b>을 찾는 일이었어요! 🎉
      </div>
    </div>
    <div class="ml-action-bar">
      <button class="btn-sm" data-action="ml-lr-back">↺ 다른 데이터로 다시 하기</button>
    </div>`;
}

/* ═══════════════════════════════════════
   🌳 결정 트리 (2D 평면 칸 나누기) — 표정 데이터
   학생이 두 특징을 축으로 골라 산점도에 칸막이를 긋고 칸마다 표정을 정함
   → 내 분류 정확도 확인 → 자동 결정 트리(모델)와 경계·정확도 비교
═══════════════════════════════════════ */

// 좌표계 (정사각 플롯, 특징 -2~+2 + 여백)
const DT_SVG_W = 380, DT_SVG_H = 380;
const DT_PAD = { l: 46, r: 14, t: 18, b: 42 };
const DT_PW = DT_SVG_W - DT_PAD.l - DT_PAD.r;   // 320
const DT_PH = DT_SVG_H - DT_PAD.t - DT_PAD.b;   // 320
const DT_LO = -2.6, DT_HI = 2.6;
function _mlDtSX(v){ return DT_PAD.l + (v - DT_LO) / (DT_HI - DT_LO) * DT_PW; }
function _mlDtSY(v){ return DT_PAD.t + (1 - (v - DT_LO) / (DT_HI - DT_LO)) * DT_PH; }

function _mlDtEnsureInit(){
  if(ML_DT_INIT) return;
  ML_DT_FX = 'mouth'; ML_DT_FY = 'brow';
  ML_DT_VCUTS = []; ML_DT_HCUTS = [];     // 관찰 단계: 칸막이 없이 시작
  ML_DT_REGIONLAB = {}; ML_DT_REVEAL = false; ML_DT_TREE = null;
  ML_DT_STAGE = 'observe';
  ML_DT_INIT = true;
}

function _mlDtStepBar(cur){
  const steps = ['1. 살펴보기', '2. 첫 칸막이', '3. 칸 나누고 라벨', '4. 모델 비교'];
  return `<div class="ml-stepbar">${steps.map((s, i) => {
    const cls = i === cur ? 'on' : (i < cur ? 'done' : '');
    return `<div class="ml-step ${cls}">${s}</div>`;
  }).join('')}</div>`;
}

// 칸 위치 이름 (ci: 0=왼,1=오른 / cj: 0=아래,1=위)
function _mlDtCellPosName(ci, cj, nx, ny){
  const xp = nx > 1 ? (ci === 0 ? '왼쪽' : (ci === nx - 1 ? '오른쪽' : '가운데')) : '';
  const yp = ny > 1 ? (cj === 0 ? '아래' : (cj === ny - 1 ? '위' : '중간')) : '';
  if(xp && yp) return yp + ' ' + xp;
  return xp || yp || '전체';
}

// 현재 칸별 진짜표정 구성 (읽기 순서: 위→아래, 왼→오른)
function _mlDtRegionCounts(){
  const ds = ML_DT_DATASET, bx = _mlDtBoundsX(), by = _mlDtBoundsY();
  const nx = bx.length - 1, ny = by.length - 1, cells = [];
  for(let cj = ny - 1; cj >= 0; cj--) for(let ci = 0; ci < nx; ci++){
    const key = ci + '_' + cj, cnt = {}; let total = 0;
    ds.samples.forEach(s => { if(_mlDtCellKeyAt(s[ML_DT_FX], s[ML_DT_FY]) === key){ cnt[s.cls] = (cnt[s.cls] || 0) + 1; total++; } });
    cells.push({ key, cnt, total, present: Object.keys(cnt), pos: _mlDtCellPosName(ci, cj, nx, ny) });
  }
  return cells;
}

function _mlDtCountsHtml(cells){
  const ds = ML_DT_DATASET;
  return `<div class="dt-counts">${cells.map(c => {
    const pure = c.present.length === 1 && c.total > 0;
    const mix = c.total === 0 ? '<span class="dt-count-empty">(빈 칸)</span>'
      : ds.classes.filter(cc => c.cnt[cc.id]).map(cc => `<span class="dt-count-n" style="color:${cc.color}">${cc.emoji}×${c.cnt[cc.id]}</span>`).join(' ');
    return `<div class="dt-count-chip ${pure ? 'pure' : ''}">
      <span class="dt-count-pos">${esc(c.pos)}</span>
      <span class="dt-count-mix">${mix}</span>
      ${pure ? '<span class="dt-pure-badge">✨ 순수!</span>' : (c.present.length > 1 ? '<span class="dt-mix-badge">섞임</span>' : '')}
    </div>`;
  }).join('')}</div>`;
}

// 칸 경계 (정렬된 칸막이 + 양끝)
function _mlDtBoundsX(){ return [DT_LO, ...[...ML_DT_VCUTS].sort((a, b) => a - b), DT_HI]; }
function _mlDtBoundsY(){ return [DT_LO, ...[...ML_DT_HCUTS].sort((a, b) => a - b), DT_HI]; }
function _mlDtCellKeyAt(x, y){
  const bx = _mlDtBoundsX(), by = _mlDtBoundsY();
  let ci = 0; while(ci < bx.length - 2 && x >= bx[ci + 1]) ci++;
  let cj = 0; while(cj < by.length - 2 && y >= by[cj + 1]) cj++;
  return ci + '_' + cj;
}

// 특징값에서 표정 얼굴 SVG 내부(100×100 박스, 중심 50,52)
function _mlDtFaceInner(f, ring){
  const skin = '#fde68a';
  const eyeRy = (3 + (f.eye + 2) / 4 * 11).toFixed(1);  // -2 슬릿 ~ +2 크게
  const t = f.brow * 3.2;                                // +2 안쪽↑(ㅅ) / -2 안쪽↓(찡그림)
  const mc = (70 - f.mouth * 9).toFixed(1);             // +2 웃음(위로 휨)
  return `<circle cx="50" cy="52" r="40" fill="${skin}" stroke="${ring || '#e0a93b'}" stroke-width="${ring ? 5 : 2.5}"/>
    <ellipse cx="35" cy="49" rx="8" ry="${eyeRy}" fill="#fff" stroke="#7a5a1e" stroke-width="1.5"/>
    <ellipse cx="65" cy="49" rx="8" ry="${eyeRy}" fill="#fff" stroke="#7a5a1e" stroke-width="1.5"/>
    <circle cx="35" cy="49" r="3" fill="#3a2a10"/><circle cx="65" cy="49" r="3" fill="#3a2a10"/>
    <line x1="26" y1="${(34 + t).toFixed(1)}" x2="44" y2="${(34 - t).toFixed(1)}" stroke="#5a3a14" stroke-width="3" stroke-linecap="round"/>
    <line x1="74" y1="${(34 + t).toFixed(1)}" x2="56" y2="${(34 - t).toFixed(1)}" stroke="#5a3a14" stroke-width="3" stroke-linecap="round"/>
    <path d="M33 70 Q50 ${mc} 67 70" fill="none" stroke="#9a3a2a" stroke-width="3.5" stroke-linecap="round"/>`;
}
function _mlDtFace(f, cx, cy, size, ring){
  return `<g class="dt-face" transform="translate(${(cx - size / 2).toFixed(1)},${(cy - size / 2).toFixed(1)}) scale(${(size / 100).toFixed(3)})">${_mlDtFaceInner(f, ring)}</g>`;
}

function _mlDtColorOf(id){ return mlDtClass(id) ? mlDtClass(id).color : '#999'; }

function _mlDtAxes(){
  const fx = mlDtFeature(ML_DT_FX), fy = mlDtFeature(ML_DT_FY);
  let g = '';
  [-2, -1, 0, 1, 2].forEach(t => {
    const x = _mlDtSX(t), y = _mlDtSY(t);
    g += `<line class="dt-grid" x1="${x.toFixed(1)}" y1="${DT_PAD.t}" x2="${x.toFixed(1)}" y2="${DT_PAD.t + DT_PH}"/>`;
    g += `<line class="dt-grid" x1="${DT_PAD.l}" y1="${y.toFixed(1)}" x2="${DT_PAD.l + DT_PW}" y2="${y.toFixed(1)}"/>`;
    g += `<text class="dt-tick" x="${x.toFixed(1)}" y="${(DT_PAD.t + DT_PH + 14).toFixed(1)}" text-anchor="middle">${t}</text>`;
    g += `<text class="dt-tick" x="${(DT_PAD.l - 7)}" y="${(y + 3).toFixed(1)}" text-anchor="end">${t}</text>`;
  });
  g += `<line class="dt-axis" x1="${DT_PAD.l}" y1="${DT_PAD.t}" x2="${DT_PAD.l}" y2="${DT_PAD.t + DT_PH}"/>
    <line class="dt-axis" x1="${DT_PAD.l}" y1="${DT_PAD.t + DT_PH}" x2="${DT_PAD.l + DT_PW}" y2="${DT_PAD.t + DT_PH}"/>`;
  const cy = DT_PAD.t + DT_PH / 2;
  g += `<text class="dt-axisname" x="${DT_PAD.l + DT_PW / 2}" y="${DT_SVG_H - 6}" text-anchor="middle">${esc(fx.label)} →</text>`;
  g += `<text class="dt-axisname" x="13" y="${cy}" text-anchor="middle" transform="rotate(-90 13 ${cy})">${esc(fy.label)} →</text>`;
  return g;
}

// 산점도 플롯. mode: 'mine'(상호작용) | 'model'(읽기전용)
// opts: { editable(칸막이 드래그), labelable(칸 클릭 라벨) }
function _mlDtPlotSvg(mode, opts){
  opts = opts || {};
  const ds = ML_DT_DATASET, fx = ML_DT_FX, fy = ML_DT_FY;
  let regions = '', predFor;

  if(mode === 'mine'){
    const bx = _mlDtBoundsX(), by = _mlDtBoundsY();
    for(let ci = 0; ci < bx.length - 1; ci++) for(let cj = 0; cj < by.length - 1; cj++){
      const key = ci + '_' + cj, lab = ML_DT_REGIONLAB[key];
      const x = _mlDtSX(bx[ci]), x2 = _mlDtSX(bx[ci + 1]), y = _mlDtSY(by[cj + 1]), y2 = _mlDtSY(by[cj]);
      regions += `<rect class="dt-cell${opts.labelable ? ' labelable' : ''}" ${opts.labelable ? `data-action="ml-dt-cell" data-cell="${key}"` : ''} x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(x2 - x).toFixed(1)}" height="${(y2 - y).toFixed(1)}" fill="${lab ? _mlDtColorOf(lab) : '#000'}" fill-opacity="${lab ? 0.18 : 0}"/>`;
    }
    predFor = s => ML_DT_REGIONLAB[_mlDtCellKeyAt(s[fx], s[fy])] || null;
  } else {
    const rs = mlTreeRegions(ML_DT_TREE, fx, fy, DT_LO, DT_HI, DT_LO, DT_HI);
    rs.forEach(r => {
      const x = _mlDtSX(r.x0), x2 = _mlDtSX(r.x1), y = _mlDtSY(r.y1), y2 = _mlDtSY(r.y0);
      regions += `<rect class="dt-cell-ro" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(x2 - x).toFixed(1)}" height="${(y2 - y).toFixed(1)}" fill="${r.label ? _mlDtColorOf(r.label) : '#000'}" fill-opacity="${r.label ? 0.2 : 0}"/>`;
    });
    predFor = s => mlTreePredict(ML_DT_TREE, s);
  }

  // 칸막이 (mine만). 보이는 선은 항상, 드래그용 hit-line은 editable일 때만.
  let cuts = '';
  if(mode === 'mine'){
    ML_DT_VCUTS.forEach((v, i) => {
      const x = _mlDtSX(v);
      if(opts.editable) cuts += `<line class="dt-cut-hit" data-cut="v" data-idx="${i}" x1="${x.toFixed(1)}" y1="${DT_PAD.t}" x2="${x.toFixed(1)}" y2="${DT_PAD.t + DT_PH}"/>`;
      cuts += `<line class="dt-cut${opts.editable ? ' on' : ''}" x1="${x.toFixed(1)}" y1="${DT_PAD.t}" x2="${x.toFixed(1)}" y2="${DT_PAD.t + DT_PH}"/>`;
      if(opts.editable) cuts += `<circle class="dt-cut-grip" cx="${x.toFixed(1)}" cy="${(DT_PAD.t + DT_PH / 2).toFixed(1)}" r="7"/>`;
    });
    ML_DT_HCUTS.forEach((v, i) => {
      const y = _mlDtSY(v);
      if(opts.editable) cuts += `<line class="dt-cut-hit" data-cut="h" data-idx="${i}" x1="${DT_PAD.l}" y1="${y.toFixed(1)}" x2="${DT_PAD.l + DT_PW}" y2="${y.toFixed(1)}"/>`;
      cuts += `<line class="dt-cut${opts.editable ? ' on' : ''}" x1="${DT_PAD.l}" y1="${y.toFixed(1)}" x2="${DT_PAD.l + DT_PW}" y2="${y.toFixed(1)}"/>`;
      if(opts.editable) cuts += `<circle class="dt-cut-grip" cx="${(DT_PAD.l + DT_PW / 2).toFixed(1)}" cy="${y.toFixed(1)}" r="7"/>`;
    });
  }

  // 얼굴 (진짜 표정 = 테두리색, 분류 틀리면 ✗)
  let faces = '';
  ds.samples.forEach(s => {
    const cx = _mlDtSX(s[fx] + s.jx), cy = _mlDtSY(s[fy] + s.jy);
    faces += _mlDtFace(s, cx, cy, 30, _mlDtColorOf(s.cls));
    const pred = predFor(s);
    if(pred && pred !== s.cls) faces += `<text class="dt-wrong" x="${cx.toFixed(1)}" y="${(cy + 5).toFixed(1)}" text-anchor="middle">✗</text>`;
  });

  return `<svg class="dt-svg ${mode}" viewBox="0 0 ${DT_SVG_W} ${DT_SVG_H}" ${mode === 'mine' ? 'id="dt-svg" data-interactive="1"' : ''} role="img">
    ${_mlDtAxes()}
    <g>${regions}${faces}</g>
    ${cuts}
  </svg>`;
}

// 결정 트리 구조를 글로 (예/아니오 분기)
function _mlDtTreeHtml(node){
  if(!node) return '';
  if(node.feature == null){
    const c = mlDtClass(node.label);
    return `<span class="dt-leaf" style="background:${c ? c.color : '#999'}22;border-color:${c ? c.color : '#999'}">${c ? c.emoji : ''} ${esc(c ? c.label : '?')}</span>`;
  }
  const fl = mlDtFeature(node.feature) ? mlDtFeature(node.feature).label : node.feature;
  return `<div class="dt-node">
    <div class="dt-q">${esc(fl)}가 ${node.thr}보다 작은가?</div>
    <div class="dt-branches">
      <div class="dt-branch"><span class="dt-tag yes">예</span>${_mlDtTreeHtml(node.left)}</div>
      <div class="dt-branch"><span class="dt-tag no">아니오</span>${_mlDtTreeHtml(node.right)}</div>
    </div>
  </div>`;
}

function _mlDtLegend(){
  const ds = ML_DT_DATASET;
  return `<div class="dt-legend">${ds.features.map(f => `<div class="dt-legend-feat">
    <div class="dt-legend-name">${esc(f.label)}</div>
    <div class="dt-legend-faces">
      <div class="dt-mini"><svg viewBox="0 0 100 100" class="dt-mini-svg">${_mlDtFaceInner(Object.assign({ mouth: 0, brow: 0, eye: 0 }, { [f.key]: -2 }))}</svg><span>−2 ${esc(f.lowDesc)}</span></div>
      <div class="dt-mini"><svg viewBox="0 0 100 100" class="dt-mini-svg">${_mlDtFaceInner(Object.assign({ mouth: 0, brow: 0, eye: 0 }, { [f.key]: 2 }))}</svg><span>+2 ${esc(f.highDesc)}</span></div>
    </div></div>`).join('')}</div>`;
}
function _mlDtClassKey(){
  return `<div class="dt-classkey">${ML_DT_DATASET.classes.map(c => `<span class="dt-ck" style="border-color:${c.color}"><span class="dt-ck-dot" style="background:${c.color}"></span>${c.emoji} ${esc(c.label)}</span>`).join('')}</div>`;
}
function _mlDtAccCount(){
  let correct = 0;
  ML_DT_DATASET.samples.forEach(s => { if(ML_DT_REGIONLAB[_mlDtCellKeyAt(s[ML_DT_FX], s[ML_DT_FY])] === s.cls) correct++; });
  return correct;
}

function _vStMlDtree(){
  _mlDtEnsureInit();
  if(ML_DT_STAGE === 'cut1')    return _vStMlDtCut(1);
  if(ML_DT_STAGE === 'cut2')    return _vStMlDtCut(2);
  if(ML_DT_STAGE === 'compare') return _vStMlDtCompare();
  return _vStMlDtObserve();
}

/* 1단계: 살펴보기 (칸막이 없이, 축 탐색) */
function _vStMlDtObserve(){
  const ds = ML_DT_DATASET;
  const axSel = (which, cur) => `<select class="dt-axis-sel" data-action="ml-dt-axis" data-axis="${which}">${ds.features.map(f => `<option value="${f.key}" ${f.key === cur ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select>`;
  return `${_mlDtStepBar(0)}
    <div class="section">
      <div class="ml-intro">
        <b>🌳 결정 트리</b>는 <u>'예/아니오' 질문(칸막이)</u>으로 데이터를 점점 더 작은 칸으로 나눠 분류해요.
        먼저 표정들이 특징에 따라 어떻게 흩어지는지 <b>살펴봐요</b>.
      </div>
      <div class="sec-title">표정의 특징 (값이 클수록 →)</div>
      ${_mlDtLegend()}
      <div class="dt-axis-row">
        <span>가로축(→)</span> ${axSel('x', ML_DT_FX)}
        <span>세로축(↑)</span> ${axSel('y', ML_DT_FY)}
        <span class="dt-axis-hint">두 특징을 바꿔가며, 같은 표정끼리 잘 뭉치는 조합을 찾아보세요</span>
      </div>
      ${_mlDtClassKey()}
      <div class="dt-plot-wrap">${_mlDtPlotSvg('mine', { editable: false, labelable: false })}</div>
      <div class="dt-howto">👀 같은 색(표정) 얼굴끼리 모여 있나요? 한 표정이 한쪽으로 쏠리는 두 축을 고른 뒤 다음으로 가요.</div>
    </div>
    <div class="ml-action-bar">
      <button class="btn-p" data-action="ml-dt-stage" data-s="cut1">✂️ 칸막이로 나눠보기 →</button>
    </div>`;
}

/* 2·3단계: 첫 칸막이(n=1) / 둘째 칸막이+라벨(n=2) */
function _vStMlDtCut(n){
  const ds = ML_DT_DATASET, total = ds.samples.length, correct = _mlDtAccCount();
  const counts = _mlDtRegionCounts();
  const axisInfo = `<div class="dt-axis-fixed">가로축 <b>${esc(mlDtFeature(ML_DT_FX).label)}</b> · 세로축 <b>${esc(mlDtFeature(ML_DT_FY).label)}</b> <span class="dt-axis-back" data-action="ml-dt-stage" data-s="observe">← 축 다시 고르기</span></div>`;
  const guide = n === 1
    ? '<b>세로 칸막이(파란 세로선)</b>를 좌우로 <b>드래그</b>해서, <b>한쪽에 한 표정만</b> 모이도록 나눠보세요. (예: 입꼬리 올라간 😀기쁨을 한쪽으로) 아래에서 칸별 구성을 확인해요.'
    : '<b>가로 칸막이</b>를 위아래로 움직여 <b>남은 두 표정</b>을 갈라요. 그다음 <b>각 칸을 클릭</b>해 그 칸이 무슨 표정인지 정하세요(없음→😀→😢→😡).';

  return `${_mlDtStepBar(n)}
    <div class="section">
      <div class="sec-title">${n === 1 ? '✂️ 첫 칸막이로 한 표정 떼어내기' : '✂️ 칸막이 하나 더 + 칸마다 표정 정하기'}</div>
      ${axisInfo}
      <div class="ml-sub-explain">${guide}</div>
      ${_mlDtClassKey()}
      <div class="dt-plot-wrap">${_mlDtPlotSvg('mine', { editable: true, labelable: n === 2 })}</div>
      <div class="dt-counts-title">칸별 구성</div>
      ${_mlDtCountsHtml(counts)}
      ${n === 2 ? `<div class="dt-toolbar"><button class="btn-xs" data-action="ml-dt-autolabel">🎯 칸 자동 라벨(다수결)</button></div>
        <div class="dt-acc ${correct === total ? 'perfect' : ''}">✏️ 내 분류 정확도 <b>${correct} / ${total}</b></div>` : ''}
    </div>
    <div class="ml-action-bar">
      <button class="btn-sm" data-action="ml-dt-stage" data-s="${n === 1 ? 'observe' : 'cut1'}">← 이전</button>
      <button class="btn-p" data-action="ml-dt-stage" data-s="${n === 1 ? 'cut2' : 'compare'}">${n === 1 ? '칸막이 하나 더 →' : '🤖 모델과 비교 →'}</button>
    </div>`;
}

/* 4단계: 모델 비교 */
function _vStMlDtCompare(){
  const ds = ML_DT_DATASET, total = ds.samples.length, correct = _mlDtAccCount();
  if(!ML_DT_TREE || ML_DT_TREE._fx !== ML_DT_FX || ML_DT_TREE._fy !== ML_DT_FY){
    ML_DT_TREE = mlBuildTree(ds.samples, [ML_DT_FX, ML_DT_FY], { maxDepth: 3 });
    ML_DT_TREE._fx = ML_DT_FX; ML_DT_TREE._fy = ML_DT_FY;
  }
  const macc = Math.round(mlTreeAccuracy(ML_DT_TREE, ds.samples) * total);
  return `${_mlDtStepBar(3)}
    <div class="section">
      <div class="sec-title">🤖 내 분류 vs 모델</div>
      <div class="ml-sub-explain">모델(결정 트리)은 표정이 가장 잘 갈리는 특징·기준을 <b>스스로</b> 골라 나눠요. 같은 두 축에서 내 칸막이와 비교해 보세요.</div>
      ${_mlDtClassKey()}
      <div class="dt-compare-2">
        <div class="dt-compare-col">
          <div class="dt-compare-title">✏️ 내 분류</div>
          ${_mlDtPlotSvg('mine', { editable: false, labelable: false })}
          <div class="dt-acc ${correct === total ? 'perfect' : ''}">정확도 <b>${correct} / ${total}</b></div>
        </div>
        <div class="dt-compare-col">
          <div class="dt-compare-title">🤖 모델</div>
          ${_mlDtPlotSvg('model')}
          <div class="dt-acc model ${macc === total ? 'perfect' : ''}">정확도 <b>${macc} / ${total}</b></div>
        </div>
      </div>
      <div class="dt-tree-cap">모델이 던진 질문 (결정 트리)</div>
      <div class="dt-tree-text">${_mlDtTreeHtml(ML_DT_TREE)}</div>
      <div class="dt-model-note">${_mlDtModelNote(macc, correct, total)}</div>
    </div>
    <div class="ml-action-bar">
      <button class="btn-sm" data-action="ml-dt-stage" data-s="cut2">← 칸 다시 수정</button>
      <button class="btn-sm" data-action="ml-dt-stage" data-s="observe">↺ 처음부터</button>
    </div>`;
}

function _mlDtModelNote(macc, mine, total){
  if(mine >= macc && mine === total) return '내 분류도 모델만큼 완벽해요! 같은 특징·기준을 찾았네요. 👏';
  if(mine >= macc) return '내 분류가 모델만큼(또는 그 이상으로) 잘 맞았어요! 👏';
  if(macc === total) return '모델은 100% 맞혔어요. 두 칸막이만으로도 표정이 깔끔히 갈리는 특징 조합이 있다는 뜻이에요.';
  return '모델도 이 두 축만으로는 완벽하진 않아요. 다른 특징 조합을 축으로 바꿔보면 더 잘 갈릴 수 있어요!';
}

/* ═══════════════════════════════════════
   공통 2D 플롯 헬퍼 (로지스틱·kNN·k-평균)
═══════════════════════════════════════ */
const ML2_W = 520, ML2_H = 380, ML2_PAD = { l: 52, r: 18, t: 18, b: 42 };
const ML2_PW = ML2_W - ML2_PAD.l - ML2_PAD.r, ML2_PH = ML2_H - ML2_PAD.t - ML2_PAD.b;
function _ml2sx(b, x){ return ML2_PAD.l + (x - b.xMin) / (b.xMax - b.xMin) * ML2_PW; }
function _ml2sy(b, y){ return ML2_PAD.t + (1 - (y - b.yMin) / (b.yMax - b.yMin)) * ML2_PH; }
function _ml2BoundsOf(xs, ys, padFrac){
  const f = padFrac || 0.1;
  let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const px = (xmax - xmin) * f || 1, py = (ymax - ymin) * f || 1;
  return { xMin: xmin - px, xMax: xmax + px, yMin: ymin - py, yMax: ymax + py };
}
function _ml2axes(b, xLabel, yLabel, yTicks){
  let g = '';
  _mlLrTicks(b.xMin, b.xMax, 5).forEach(t => { if(t < b.xMin || t > b.xMax) return; const x = _ml2sx(b, t);
    g += `<line class="ml2-grid" x1="${x.toFixed(1)}" y1="${ML2_PAD.t}" x2="${x.toFixed(1)}" y2="${ML2_PAD.t + ML2_PH}"/>`;
    g += `<text class="ml2-tick" x="${x.toFixed(1)}" y="${ML2_PAD.t + ML2_PH + 16}" text-anchor="middle">${_mlLrNum(t, t % 1 === 0 ? 0 : 1)}</text>`; });
  (yTicks || _mlLrTicks(b.yMin, b.yMax, 5)).forEach(t => { if(t < b.yMin || t > b.yMax) return; const y = _ml2sy(b, t);
    g += `<line class="ml2-grid" x1="${ML2_PAD.l}" y1="${y.toFixed(1)}" x2="${ML2_PAD.l + ML2_PW}" y2="${y.toFixed(1)}"/>`;
    g += `<text class="ml2-tick" x="${ML2_PAD.l - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${_mlLrNum(t, t % 1 === 0 ? 0 : 1)}</text>`; });
  g += `<line class="ml2-axis" x1="${ML2_PAD.l}" y1="${ML2_PAD.t}" x2="${ML2_PAD.l}" y2="${ML2_PAD.t + ML2_PH}"/>
    <line class="ml2-axis" x1="${ML2_PAD.l}" y1="${ML2_PAD.t + ML2_PH}" x2="${ML2_PAD.l + ML2_PW}" y2="${ML2_PAD.t + ML2_PH}"/>`;
  const cy = ML2_PAD.t + ML2_PH / 2;
  g += `<text class="ml2-axisname" x="${ML2_PAD.l + ML2_PW / 2}" y="${ML2_H - 6}" text-anchor="middle">${esc(xLabel)}</text>
    <text class="ml2-axisname" x="14" y="${cy}" text-anchor="middle" transform="rotate(-90 14 ${cy})">${esc(yLabel)}</text>`;
  return g;
}
function _mlSteps(labels, cur){
  return `<div class="ml-stepbar">${labels.map((s, i) => `<div class="ml-step ${i === cur ? 'on' : (i < cur ? 'done' : '')}">${s}</div>`).join('')}</div>`;
}

/* ═══════════════════════════════════════
   📊 로지스틱 회귀 — 확률(S자) 분류
   Stage: line(직선의 한계) → curve(S자 학습) → predict(예측·분류)
═══════════════════════════════════════ */
function _mlLgBounds(){ return { xMin: 0, xMax: 10.6, yMin: -0.28, yMax: 1.28 }; }
function _mlLgSigPath(b, probFn){
  const N = 64, pts = [];
  for(let i = 0; i <= N; i++){ const x = b.xMin + (b.xMax - b.xMin) * i / N; const y = Math.max(0, Math.min(1, probFn(x))); pts.push(`${_ml2sx(b, x).toFixed(1)},${_ml2sy(b, y).toFixed(1)}`); }
  return pts.join(' ');
}
function _mlLgDots(ds, b){
  return ds.points.map(p => `<circle class="ml2-dot" cx="${_ml2sx(b, p.x).toFixed(1)}" cy="${_ml2sy(b, p.y).toFixed(1)}" r="5.5" fill="${p.y ? ds.posColor : ds.negColor}" stroke="#fff" stroke-width="1"/>`).join('');
}
function _vStMlLogistic(){
  const ds = ML_LG_DATASET, b = _mlLgBounds();
  const stage = ML_LG_STAGE;
  const y0 = _ml2sy(b, 0), y1 = _ml2sy(b, 1), yTop = _ml2sy(b, b.yMax), yBot = _ml2sy(b, b.yMin);
  const invalid = `<rect class="ml2-invalid" x="${ML2_PAD.l}" y="${yTop.toFixed(1)}" width="${ML2_PW}" height="${(y1 - yTop).toFixed(1)}"/>
    <rect class="ml2-invalid" x="${ML2_PAD.l}" y="${y0.toFixed(1)}" width="${ML2_PW}" height="${(yBot - y0).toFixed(1)}"/>`;
  const guideLines = `<line class="ml2-ref" x1="${ML2_PAD.l}" y1="${y1.toFixed(1)}" x2="${ML2_PAD.l + ML2_PW}" y2="${y1.toFixed(1)}"/>
    <line class="ml2-ref" x1="${ML2_PAD.l}" y1="${y0.toFixed(1)}" x2="${ML2_PAD.l + ML2_PW}" y2="${y0.toFixed(1)}"/>`;
  const lblPos = `<text class="ml2-side" x="${ML2_PAD.l + 4}" y="${(y1 - 5).toFixed(1)}">${esc(ds.posLabel)}(1)</text>`;
  const lblNeg = `<text class="ml2-side" x="${ML2_PAD.l + 4}" y="${(y0 + 14).toFixed(1)}">${esc(ds.negLabel)}(0)</text>`;

  let overlay = '', below = '';
  const step = _mlSteps(['1. 직선의 한계', '2. S자 곡선 학습', '3. 예측·분류'], stage === 'line' ? 0 : stage === 'curve' ? 1 : 2);

  if(stage === 'line'){
    const lin = mlLinregFit(ds.points.map(p => [p.x, p.y]));
    const lx1 = b.xMin, lx2 = b.xMax;
    overlay = `<line class="ml2-line-bad" x1="${_ml2sx(b, lx1).toFixed(1)}" y1="${_ml2sy(b, lin.a * lx1 + lin.b).toFixed(1)}" x2="${_ml2sx(b, lx2).toFixed(1)}" y2="${_ml2sy(b, lin.a * lx2 + lin.b).toFixed(1)}"/>`;
    below = `<div class="ml-sub-explain">합격(1)/불합격(0)을 <b>직선</b>으로 예측하면, 공부를 아주 많이 하면 확률이 <b>1을 넘고</b> 아주 적게 하면 <b>0보다 작아져요</b>. 확률은 0~1 사이여야 하는데 직선은 그 범위를 못 지켜요 → <b class="ml2-bad">직선은 분류에 부적합!</b> (분홍 영역 = 확률 범위 밖)</div>
      <div class="ml-action-bar"><button class="btn-p" data-action="ml-lg-stage" data-s="curve">S자 곡선으로 풀어보기 →</button></div>`;
  } else {
    if(!ML_LG_GD) ML_LG_GD = mlLogisticFit(ds.points);
    const gd = ML_LG_GD;
    overlay = `<polyline class="ml2-sig" points="${_mlLgSigPath(b, x => gd.prob(x))}"/>`;
    if(stage === 'curve'){
      const running = !!ML_LG_AUTO, done = gd.done;
      below = `<div class="ml-sub-explain">직선의 양 끝을 <b>0과 1 사이로 눌러</b> 주면 <b>S자 곡선(시그모이드)</b>이 돼요. <b>▶ 학습</b>을 누르면 곡선이 점들에 맞춰지며 <b>오차가 줄어듭니다</b>.</div>
        <div class="ml2-statline">학습 횟수 <b>${gd.iter}</b> · 오차 <b>${_mlLrNum(gd.loss, 3)}</b> · 정확도 <b>${Math.round(gd.accuracy() * ds.points.length)}/${ds.points.length}</b>${done ? ' · <span style="color:var(--ok)">✓ 수렴</span>' : ''}</div>
        <div class="ml-action-bar lr-learn-bar">
          <button class="btn-sm" data-action="ml-lg-step" ${running ? 'disabled' : ''}>⏭ 한 단계</button>
          <button class="btn-p btn-sm" data-action="ml-lg-run">${running ? '⏸ 정지' : (gd.iter ? '▶ 이어서' : '▶ 학습 시작')}</button>
          <button class="btn-sm" data-action="ml-lg-reset" ${running ? 'disabled' : ''}>⟲ 처음부터</button>
        </div>
        <div class="ml-action-bar"><button class="btn-p" data-action="ml-lg-stage" data-s="predict">예측·분류 해보기 →</button></div>`;
    } else {
      // predict
      const bx = gd.boundaryX();
      if(bx != null && bx >= b.xMin && bx <= b.xMax){
        const px = _ml2sx(b, bx), yb = _ml2sy(b, 0.5);
        overlay += `<line class="ml2-thresh" x1="${ML2_PAD.l}" y1="${yb.toFixed(1)}" x2="${ML2_PAD.l + ML2_PW}" y2="${yb.toFixed(1)}"/>
          <line class="ml2-bound" x1="${px.toFixed(1)}" y1="${ML2_PAD.t}" x2="${px.toFixed(1)}" y2="${ML2_PAD.t + ML2_PH}"/>
          <text class="ml2-side" x="${(px + 4).toFixed(1)}" y="${(ML2_PAD.t + 12)}">경계 ${_mlLrNum(bx, 1)}${esc(ds.xUnit)}</text>`;
      }
      const probe = (ML_LG_PROBE || '').trim();
      let probeOut = '예측할 공부 시간을 넣어보세요';
      if(probe !== '' && !isNaN(parseFloat(probe))){
        const pv = gd.prob(parseFloat(probe));
        const cls = pv >= 0.5 ? ds.posLabel : ds.negLabel;
        probeOut = `합격 확률 <b>${(pv * 100).toFixed(0)}%</b> → <b style="color:${pv >= 0.5 ? ds.posColor : ds.negColor}">${esc(cls)}</b> ${pv >= 0.5 ? '(0.5 이상)' : '(0.5 미만)'}`;
        const ppx = _ml2sx(b, parseFloat(probe)), ppy = _ml2sy(b, Math.max(0, Math.min(1, pv)));
        if(parseFloat(probe) >= b.xMin && parseFloat(probe) <= b.xMax) overlay += `<line class="ml2-probe-l" x1="${ppx.toFixed(1)}" y1="${(ML2_PAD.t + ML2_PH).toFixed(1)}" x2="${ppx.toFixed(1)}" y2="${ppy.toFixed(1)}"/><circle class="ml2-probe-d" cx="${ppx.toFixed(1)}" cy="${ppy.toFixed(1)}" r="6"/>`;
      }
      below = `<div class="ml-sub-explain">곡선 높이가 <b>합격 확률</b>이에요. <b>0.5</b>(가로 점선)를 기준으로, 위면 <b style="color:${ds.posColor}">${esc(ds.posLabel)}</b>·아래면 <b style="color:${ds.negColor}">${esc(ds.negLabel)}</b>으로 분류해요.</div>
        <div class="lr-predict-box confirm">
          <div class="lr-probe"><span class="lr-probe-eq">${esc(ds.xLabel)} =</span>
            <input type="number" id="ml-lg-probe" class="lr-num-input sm" placeholder="${ds.predictX}" value="${esc(ML_LG_PROBE)}"/>
            <span class="lr-unit">${esc(ds.xUnit)}</span><span class="lr-probe-arrow">→</span>
            <span class="lr-probe-out" id="ml-lg-probe-out">${probeOut}</span>
          </div>
        </div>
        <div class="lr-mse-conclude">📌 <b>로지스틱 회귀</b> = 회귀처럼 점수를 내고(<b>속은 회귀</b>), S자로 확률(0~1)을 만든 뒤 0.5로 잘라 분류(<b>겉은 분류</b>). 이름에 '회귀'가 있어도 하는 일은 <b>분류</b>예요.</div>
        <div class="ml-action-bar"><button class="btn-sm" data-action="ml-lg-stage" data-s="curve">← 학습 다시</button></div>`;
    }
  }

  return `${step}
    <div class="section">
      <div class="ml-intro"><b>📊 로지스틱 회귀</b>는 어떤 클래스에 속할 <u>확률(0~1)</u>을 <u>S자 곡선</u>으로 예측하고, <b>0.5</b>를 기준으로 분류하는 모델이에요. (예: 공부 시간 → 합격/불합격)</div>
      <div class="lr-plot-wrap"><svg class="lr-svg" viewBox="0 0 ${ML2_W} ${ML2_H}" role="img">
        ${stage === 'line' ? invalid : ''}
        ${_ml2axes(b, ds.xLabel + ' (' + ds.xUnit + ')', '합격 확률', [0, 0.5, 1])}
        ${guideLines}${lblPos}${lblNeg}
        ${overlay}
        ${_mlLgDots(ds, b)}
      </svg></div>
      ${below}
    </div>`;
}

/* ═══════════════════════════════════════
   👥 kNN — 새 점 + k 이웃 투표 (위조지폐)
═══════════════════════════════════════ */
function _mlKnBounds(){
  const ds = ML_KN_DATASET;
  return _ml2BoundsOf(ds.points.map(p => p.x).concat(ds.newDefault.x), ds.points.map(p => p.y).concat(ds.newDefault.y), 0.12);
}
function _vStMlKnn(){
  const ds = ML_KN_DATASET, b = _mlKnBounds();
  if(!ML_KN_NEW) ML_KN_NEW = { ...ds.newDefault };
  const train = ds.points.map(p => ({ vec: [p.x, p.y], classId: p.cls }));
  const k = ML_KN_K;
  const pred = mlKnnPredict(train, [ML_KN_NEW.x, ML_KN_NEW.y], k);
  const counts = {}; ds.classes.forEach(c => counts[c.id] = 0);
  (pred ? pred.neighbors : []).forEach(s => counts[s.classId]++);
  const predClass = ds.classes.find(c => c.id === pred.classId);
  // k번째 이웃까지 거리 → 원
  const nx = ML_KN_NEW.x, ny = ML_KN_NEW.y;
  const neigh = pred ? pred.neighbors : [];
  const maxD = neigh.length ? Math.sqrt(Math.max(...neigh.map(s => (s.vec[0] - nx) ** 2 + (s.vec[1] - ny) ** 2))) : 0;
  const rPx = Math.abs(_ml2sx(b, nx + maxD) - _ml2sx(b, nx));

  const neighSet = new Set(neigh.map(s => s.vec[0] + ',' + s.vec[1]));
  const dots = ds.points.map(p => {
    const c = ds.classes.find(cc => cc.id === p.cls), on = neighSet.has(p.x + ',' + p.y);
    return `<circle class="ml2-dot ${on ? 'knn-on' : ''}" cx="${_ml2sx(b, p.x).toFixed(1)}" cy="${_ml2sy(b, p.y).toFixed(1)}" r="${on ? 7 : 5.5}" fill="${c.color}" stroke="${on ? '#111' : '#fff'}" stroke-width="${on ? 2 : 1}"/>`;
  }).join('');
  const links = neigh.map(s => `<line class="ml2-knn-link" x1="${_ml2sx(b, nx).toFixed(1)}" y1="${_ml2sy(b, ny).toFixed(1)}" x2="${_ml2sx(b, s.vec[0]).toFixed(1)}" y2="${_ml2sy(b, s.vec[1]).toFixed(1)}"/>`).join('');
  const circle = `<circle class="ml2-knn-ring" cx="${_ml2sx(b, nx).toFixed(1)}" cy="${_ml2sy(b, ny).toFixed(1)}" r="${rPx.toFixed(1)}"/>`;
  const star = `<text id="ml-kn-star" class="ml2-star" x="${_ml2sx(b, nx).toFixed(1)}" y="${(_ml2sy(b, ny) + 7).toFixed(1)}" text-anchor="middle" style="fill:${predClass ? predClass.color : '#111'}">★</text>`;

  const kBtns = [1, 3, 5, 7].map(kv => `<button class="ml2-kbtn ${kv === k ? 'on' : ''}" data-action="ml-kn-k" data-k="${kv}">k=${kv}</button>`).join('');
  const tally = ds.classes.map(c => `<span class="ml2-tally" style="color:${c.color}">${c.emoji} ${esc(c.label)} <b>${counts[c.id]}표</b></span>`).join('<span class="ml2-vs">vs</span>');

  return `<div class="section">
      <div class="ml-intro"><b>👥 kNN (k-최근접 이웃)</b>은 새 데이터가 오면 <u>가장 가까운 k개 이웃</u>의 다수 클래스로 분류해요. <i>유유상종</i> — 이웃을 보면 그 데이터가 보인다!</div>
      <div class="ml2-knn-bar">
        <span class="ml2-knn-q">새 지폐 <b class="ml2-star-inline">★</b> 를 <b>드래그</b>해 옮기고, k를 바꿔보세요:</span>
        <span class="ml2-kbtns">${kBtns}</span>
      </div>
      <div class="lr-plot-wrap"><svg id="ml-kn-svg" class="lr-svg" viewBox="0 0 ${ML2_W} ${ML2_H}" role="img" data-interactive="1">
        ${_ml2axes(b, ds.xLabel + ' (' + ds.unit + ')', ds.yLabel + ' (' + ds.unit + ')')}
        ${circle}${links}${dots}${star}
        <circle class="ml2-star-hit" id="ml-kn-hit" cx="${_ml2sx(b, nx).toFixed(1)}" cy="${_ml2sy(b, ny).toFixed(1)}" r="20"/>
      </svg></div>
      <div class="ml2-knn-result">
        가장 가까운 <b>${k}개</b> 이웃: ${tally}
        <div class="ml2-knn-verdict" style="border-color:${predClass ? predClass.color : '#999'}">→ 모델 판정: <b style="color:${predClass ? predClass.color : '#111'}">${predClass ? predClass.emoji + ' ' + esc(predClass.label) : '?'}</b></div>
      </div>
      <div class="ml-sub-explain">💡 <b>k에 따라 결과가 바뀌어요!</b> 같은 ★ 위치라도 k=3과 k=7의 판정이 다를 수 있어요(가까운 이웃을 몇 명까지 볼지). 그래서 <b>적절한 k</b>를 정하는 게 중요해요. (거리는 두 점 사이 직선거리 = 유클리디안)</div>
    </div>`;
}

/* ═══════════════════════════════════════
   🎯 k-평균 (모델) — PPT 단계: 임의중심 → 배정 → 이동 → 반복
═══════════════════════════════════════ */
const ML_KM_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];
function _mlKmBounds(){
  const ds = ML_KM_DATASET;
  return _ml2BoundsOf(ds.points.map(p => p.x), ds.points.map(p => p.y), 0.12);
}
// 엔진은 정규화([0,1]) 좌표로 군집화 → 중심점을 원래 좌표로 되돌릴 때 사용
function _mlKmNorm(){
  const ds = ML_KM_DATASET, xs = ds.points.map(p => p.x), ys = ds.points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return { minX, rangeX: (maxX - minX) || 1, minY, rangeY: (maxY - minY) || 1 };
}
function _vStMlKmeans(){
  const ds = ML_KM_DATASET, b = _mlKmBounds();
  const km = ML_KM_STATE;
  const running = !!ML_KM_AUTO;
  const converged = km && km.iter > 0 && km.phase === 'assign' && !km.changed;

  const dots = ds.points.map((p, i) => {
    const c = km ? km.assignments[i] : -1;
    const col = c >= 0 ? ML_KM_COLORS[c % ML_KM_COLORS.length] : '#cbd5e1';
    return `<circle class="ml2-dot" cx="${_ml2sx(b, p.x).toFixed(1)}" cy="${_ml2sy(b, p.y).toFixed(1)}" r="6" fill="${col}" stroke="#fff" stroke-width="1.2" style="transition:fill .4s"/>`;
  }).join('');
  let cents = '';
  if(km){
    const nm = _mlKmNorm();
    cents = km.centroids.map((cv, ci) => {
      const ox = nm.minX + cv[0] * nm.rangeX, oy = nm.minY + cv[1] * nm.rangeY;  // 정규화 → 원래 좌표
      return `<text class="ml2-centroid" x="${_ml2sx(b, ox).toFixed(1)}" y="${(_ml2sy(b, oy) + 7).toFixed(1)}" text-anchor="middle" style="fill:${ML_KM_COLORS[ci % ML_KM_COLORS.length]}">✕</text>`;
    }).join('');
  }

  const phaseLbl = !km ? '시작 전' : (converged ? '완료' : (km.phase === 'assign' ? '다음: 배정' : '다음: 중심 이동'));
  const steps = `<ol class="dt-mse-steps lr-mse-steps">
    <li class="${km ? 'done' : 'cur'}"><b>1.</b> 군집 개수 k=${ds.k} 정하고, 중심점(✕) ${ds.k}개를 <b>임의 위치</b>에 놓기</li>
    <li class="${km && (km.iter > 0 || km.phase === 'update') ? 'done' : (km ? 'cur' : '')}"><b>2~3.</b> 각 데이터를 <b>가장 가까운 중심점</b>의 군집(색)으로 배정</li>
    <li class="${km && km.iter > 0 ? 'done' : ''}"><b>4.</b> 중심점을 군집의 <b>평균 위치</b>로 이동 → 2~4 반복</li>
  </ol>`;

  return `<div class="section">
      <div class="ml-intro"><b>🎯 k-평균(k-means) 군집화</b>는 정답(레이블) 없이 데이터를 <u>k개 군집</u>으로 묶는 비지도학습이에요. (예: 키·몸무게로 티셔츠 S·M·L 나누기) 중심점이 안 움직일 때까지 <b>배정 → 이동</b>을 반복해요.</div>
      ${steps}
      <div class="ml-step-info">단계: <b>${phaseLbl}</b> · 반복 ${km ? km.iter : 0}회 ${converged ? '· <span style="color:var(--ok)">✓ 중심이 안 움직여요 → S·M·L 완성!</span>' : ''}</div>
      <div class="ml-action-bar lr-learn-bar">
        ${!km
          ? `<button class="btn-p" data-action="ml-km-start">▶ 중심점 ${ds.k}개 놓고 시작</button>`
          : `<button class="btn-sm" data-action="ml-km-step" ${running || converged ? 'disabled' : ''}>⏭ 한 단계</button>
             <button class="btn-p btn-sm" data-action="ml-km-run" ${converged ? 'disabled' : ''}>${running ? '⏸ 정지' : '▶ 자동 재생'}</button>
             <button class="btn-sm" data-action="ml-km-reset" ${running ? 'disabled' : ''}>⟲ 다시(새 중심점)</button>`}
      </div>
      <div class="lr-plot-wrap"><svg class="lr-svg" viewBox="0 0 ${ML2_W} ${ML2_H}" role="img">
        ${_ml2axes(b, ds.xLabel + ' (' + ds.xUnit + ')', ds.yLabel + ' (' + ds.yUnit + ')')}
        ${dots}${cents}
      </svg></div>
      <div class="ml-sub-explain">✕ = 군집 중심점. 각 점은 <b>가장 가까운 ✕의 색</b>으로 물들고(배정), ✕는 자기 색 점들의 <b>평균 위치</b>로 이동해요. (거리는 유클리디안) <b>kNN의 k</b>는 '이웃 수', <b>k-평균의 k</b>는 '군집 수' — 의미가 달라요!</div>
    </div>`;
}

/* ─────────────────── 비지도학습 ─────────────────── */

function _vStMlUnsupervised(){
  if(ML_UN_PHASE === 'pick' || !ML_UN_DATASET) return _vStMlUnPick();
  return _vStMlUnRun();
}

function _vStMlUnPick(){
  const cards = ML_DATASETS.map(d => {
    const previews = d.classes.map(c => `<span class="ml-pick-emoji">${c.emoji}</span>`).join('');
    return `<div class="ml-pick-card click" data-action="ml-un-pick" data-did="${esc(d.id)}">
      <div class="ml-pick-icon">${d.icon}</div>
      <div class="ml-pick-body">
        <div class="ml-pick-title">${esc(d.title)}</div>
        <div class="ml-pick-desc">${esc(d.desc)}</div>
        <div class="ml-pick-emojis">${previews} <span class="ml-pick-cnt">· ${d.classes.length}종</span></div>
      </div>
      <div class="ml-pick-arrow">→</div>
    </div>`;
  }).join('');

  return `<div class="section">
    <div class="ml-intro">
      <b>🔍 비지도학습</b>은 <u>정답 없이</u> 비슷한 것들을 자동으로 모아주는 방식입니다.
      모델에게 "정답"을 알려주지 않아도, 알아서 그룹을 찾아내요.
    </div>
    <div class="sec-title">데이터셋을 골라봐요 (정답은 모델에게 알려주지 않아요)</div>
    <div class="ml-pick-list">${cards}</div>
  </div>`;
}

// 2D 좌표 → plot 영역 % 변환
function _mlUnPctX(x){ const b = ML_UN_BOUNDS; return ((x - b.minX) / (b.maxX - b.minX)) * 100; }
function _mlUnPctY(y){ const b = ML_UN_BOUNDS; return (1 - (y - b.minY) / (b.maxY - b.minY)) * 100; }

function _vStMlUnRun(){
  const ds = ML_UN_DATASET;
  const km = ML_UN_KMEANS;
  const pts = ML_UN_PTS;
  const samples = ML_UN_DATA.samples;

  // 클러스터 색
  const clusterColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#06b6d4'];

  // 점들 (이모지 썸네일). 그룹 짓기 전엔 회색 테두리, 후엔 클러스터 색
  const dotsHtml = pts.map((p, i) => {
    const left = _mlUnPctX(p[0]).toFixed(1);
    const top  = _mlUnPctY(p[1]).toFixed(1);
    const c = km ? km.assignments[i] : -1;
    const col = c >= 0 ? clusterColors[c % clusterColors.length] : '#cbd5e1';
    return `<div class="ml-pt" style="left:${left}%;top:${top}%;border-color:${col};box-shadow:0 0 0 2px ${col}33">
      <img src="${samples[i].dataUrl}" alt=""/>
    </div>`;
  }).join('');

  // 중심점(✕)
  let centroidsHtml = '';
  if(km){
    centroidsHtml = km.centroids.map((cv, c) => {
      const left = _mlUnPctX(cv[0]).toFixed(1);
      const top  = _mlUnPctY(cv[1]).toFixed(1);
      const col = clusterColors[c % clusterColors.length];
      return `<div class="ml-centroid" style="left:${left}%;top:${top}%;color:${col};border-color:${col}">✕</div>`;
    }).join('');
  }

  const stepInfo = km
    ? `<div class="ml-step-info">반복 회차: <b>${km.iter}</b> ${km.iter > 0 && !km.changed ? '· <span style="color:var(--ok)">✓ 수렴 완료 (더 이상 안 변해요)</span>' : ''}</div>`
    : '<div class="ml-step-info">아직 그룹 짓기 전 — 점들이 회색이에요</div>';

  // 정답 공개
  let revealHtml = '';
  if(km && ML_UN_REVEAL){
    const groups = mlKMeansGroups(km);
    const purity = mlKMeansPurity(km, ML_UN_2D);
    revealHtml = `<div class="section ml-reveal">
      <div class="sec-title">😎 정답 공개! 그룹별 진짜 라벨</div>
      <div class="ml-reveal-info">
        모델은 정답(${ds.classes.length}종)을 모른 채 <b>${km.k}개 그룹</b>으로 나눴어요. 같은 종류끼리 얼마나 잘 모였는지 보세요.
      </div>
      <div class="ml-reveal-grid">
        ${groups.map((g, gi) => {
          const cnt = {};
          g.forEach(i => { const cid = samples[i].classId; cnt[cid] = (cnt[cid] || 0) + 1; });
          const sorted = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
          const breakdown = sorted.map(([cid, n]) => {
            const c = ds.classes.find(cc => cc.id === cid);
            return `<span class="ml-reveal-tag">${c?.emoji || '?'} ${esc(c?.label || cid)} ×${n}</span>`;
          }).join('');
          return `<div class="ml-reveal-card" style="border-color:${clusterColors[gi % clusterColors.length]}">
            <div class="ml-reveal-head">그룹 ${gi + 1} (${g.length}개)</div>
            <div class="ml-reveal-tags">${breakdown || '(비어있음)'}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="ml-purity">정확도(순도): <b>${(purity.purity * 100).toFixed(0)}%</b> — 같은 그룹 안의 다수 라벨 비율</div>
    </div>`;
  }

  return `<div class="back-btn" data-action="ml-un-back">← 다른 데이터셋</div>
    <div class="section">
      <div class="sec-title">${ds.icon} ${esc(ds.title)} — 비지도 그룹화 (점 지도)</div>
      <div class="ml-sub-explain">
        각 사진을 <b>색·모양 특징</b>으로 평면 위 점으로 흩뿌렸어요. 비슷한 사진일수록 가까이 모여요.<br>
        <b>K-Means</b>가 중심점(✕)을 옮겨가며 가까운 점끼리 <b>${ML_UN_K}개 그룹</b>(색)으로 묶습니다.
      </div>
      ${stepInfo}
      <div class="ml-action-bar">
        ${km
          ? `<button class="btn-sm" data-action="ml-un-step" ${ML_UN_AUTO_TIMER ? 'disabled' : ''}>⏭ 한 단계</button>
             <button class="btn-sm" data-action="ml-un-run">${ML_UN_AUTO_TIMER ? '⏸ 정지' : '▶ 자동 재생'}</button>
             <button class="btn-sm" data-action="ml-un-reset" ${ML_UN_AUTO_TIMER ? 'disabled' : ''}>⟲ 초기화</button>
             <button class="btn-p btn-sm" data-action="ml-un-reveal" ${ML_UN_AUTO_TIMER ? 'disabled' : ''}>${ML_UN_REVEAL ? '🙈 정답 숨기기' : '😎 정답 공개'}</button>`
          : `<button class="btn-p" data-action="ml-un-start">▶ 그룹 짓기 시작</button>`}
      </div>
      <div class="ml-plot">
        ${dotsHtml}
        ${centroidsHtml}
      </div>
    </div>
    ${revealHtml}`;
}

/* ─────────────────── 강화학습 ─────────────────── */

const ML_RL_DUCK_URL = 'https://8laos.github.io/reinforced-duck/';

function _vStMlReinforce(){
  // 선생님이 입력한 설명 (없으면 표시 안 함)
  const desc = (ML_RL_DESC[SEL_CLS?.id] || '').trim();
  const descHtml = desc
    ? `<div class="ml-rl-desc-box">${esc(desc).replace(/\n/g, '<br>')}</div>`
    : '';

  return `<div class="section">
    <div class="ml-intro">
      <b>🎮 강화학습</b>은 <u>잘하면 보상, 못하면 벌점</u>을 받으며 <u>여러 번 시도(시행착오)</u>하면서 점점 더 잘하게 되는 방식이에요.
    </div>

    <div class="ml-rl-game">
      <div class="ml-rl-title">🦆 강화학습 오리 (Reinforced Duck)</div>
      ${descHtml}
      <a class="btn-p ml-rl-open-big" href="${ML_RL_DUCK_URL}" target="_blank" rel="noopener">🎮 게임 열기 (새 탭)</a>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════
   선생님 — 🤖 기계학습 체험 관리
═══════════════════════════════════════ */

function vTcMl(){
  if(!TC_CLS) return emptyBox('👆', '관리할 반을 먼저 선택하세요.');

  const active = !!ML_ACTIVE[TC_CLS.id];
  const toggle = `<div class="asmt-phase-seg">
    <button class="asmt-phase-btn ${!active ? 'on' : ''}" data-action="ml-set-active" data-on="0">🔒 닫기</button>
    <button class="asmt-phase-btn ${active ? 'on prep' : ''}" data-action="ml-set-active" data-on="1">📖 열기</button>
  </div>`;

  const phaseRow = `<div class="asmt-phase-row">
    <div class="asmt-phase-info">
      <div class="asmt-phase-title">🤖 기계학습 체험 탭</div>
      <div class="asmt-phase-cur">${active
        ? '<b style="color:var(--ok)">● 열림</b> — 학생 화면에 "🤖 기계학습 체험" 탭이 보여요.'
        : '<b style="color:var(--text3)">● 닫힘</b> — 학생 화면에 보이지 않습니다.'}</div>
    </div>
    ${toggle}
  </div>`;

  // 데이터셋 소개 (선생님이 어떤 데이터로 학생들이 체험할지 확인)
  const datasets = ML_DATASETS.map(d => {
    const previews = d.classes.map(c => `<span class="ml-pick-emoji">${c.emoji} ${esc(c.label)}</span>`).join(' · ');
    return `<div class="ml-tc-ds">
      <div class="ml-tc-ds-head">${d.icon} <b>${esc(d.title)}</b></div>
      <div class="ml-tc-ds-desc">${esc(d.desc)}</div>
      <div class="ml-tc-ds-cls">${previews}</div>
    </div>`;
  }).join('');

  const rlDesc = ML_RL_DESC[TC_CLS.id] || '';

  return phaseRow + `<div class="section">
    <div class="sec-title">활동 구성</div>
    <div class="ml-sub-explain">
      학생은 데이터를 직접 만들지 않고 <b>미리 준비된 이모지 데이터셋(3종 클래스)</b>에서 골라 분류기를 만들거나(지도), 그룹화를 체험(비지도)합니다.
      코드 작성은 0줄. 강화학습은 친구가 만든 <b>Reinforced Duck</b> 게임을 새 탭에서 직접 플레이합니다.
    </div>
    <div class="ml-tc-flow">
      <div class="ml-tc-flow-card"><b>📚 지도학습</b><br><small>3개 그룹 이름 정하고 사진 끌어담기 → 학습 → 테스트(드래그) 후 👍/👎 판정</small></div>
      <div class="ml-tc-flow-card"><b>📈 선형회귀</b><br><small>산점도에 직접 직선 긋기 → 경사하강법으로 학습 과정 관찰 → 최적선·예측·오차(MSE) 이해</small></div>
      <div class="ml-tc-flow-card"><b>🌳 결정 트리</b><br><small>표정 얼굴을 두 특징 축에 흩뿌리고 칸막이로 영역 분류 → 내 정확도 → 자동 결정 트리(모델)와 비교</small></div>
      <div class="ml-tc-flow-card"><b>📊 로지스틱 회귀</b><br><small>공부시간→합격/불합격. 직선의 한계 → S자 곡선(시그모이드) 학습 → 0.5 기준 확률 분류 (4차시)</small></div>
      <div class="ml-tc-flow-card"><b>👥 kNN</b><br><small>위조지폐 판별. 새 점(★)을 드래그하고 k를 바꾸며 가까운 이웃 투표 관찰 (k=3 vs k=7 결과가 바뀜) (4차시)</small></div>
      <div class="ml-tc-flow-card"><b>🎯 k-평균</b><br><small>키·몸무게로 티셔츠 S·M·L 군집화. 임의 중심점 → 배정 → 이동 반복 (PPT 단계 그대로) (4차시)</small></div>
      <div class="ml-tc-flow-card"><b>🔍 비지도학습</b><br><small>사진을 2D 점 지도로 흩뿌리고 K-Means가 색으로 묶는 과정 관찰 → 정답 공개</small></div>
      <div class="ml-tc-flow-card"><b>🎮 강화학습</b><br><small>Reinforced Duck 게임을 새 탭에서 플레이 (설명은 아래에서 직접 작성)</small></div>
    </div>

    <div class="sec-title" style="margin-top:14px">🎮 강화학습 게임 설명 (학생 화면에 표시)</div>
    <div class="ml-sub-explain">강화학습 탭의 게임 위에 보여줄 설명을 자유롭게 적어주세요. 비워두면 설명 없이 게임 버튼만 보입니다.</div>
    <textarea id="ml-rl-desc-input" class="ml-rl-desc-edit" rows="4" placeholder="예: 직접 플레이하면서 더 높은 점수에 도전해보세요! 여러 번 하다 보면 요령이 생겨요.">${esc(rlDesc)}</textarea>
    <div class="ml-action-bar">
      <button class="btn-p btn-sm" data-action="ml-rl-save-desc">💾 설명 저장</button>
    </div>

    <div class="sec-title" style="margin-top:14px">제공되는 데이터셋 (각 3종)</div>
    <div class="ml-tc-ds-list">${datasets}</div>
  </div>`;
}
