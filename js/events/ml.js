/* ═══════════════════════════════════════
   events/ml.js — 🤖 기계학습 체험 이벤트
═══════════════════════════════════════ */

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset.action;

  /* ── 공통: 내부 탭 전환 ── */
  if(act === 'ml-tab'){
    ML_TAB = el.dataset.t || 'supervised';
    _mlStopAuto();      // 비지도 K-Means 타이머 정리
    _mlLrStopAuto();    // 선형회귀 학습 타이머 정리
    render();
    return;
  }

  /* ── 선생님: active 토글 ── */
  if(act === 'ml-set-active'){
    const on = el.dataset.on === '1';
    if(!TC_CLS) return;
    try {
      await setMlActive(TC_CLS.id, on);
      toast(`기계학습 체험을 ${on ? '📖 열었어요' : '🔒 닫았어요'}.`, 'ok');
      render();
    } catch(err){
      console.error(err);
      toast('토글 실패: ' + (err.message || err), 'err');
    }
    return;
  }

  /* ─── 지도학습 (학생 주도 흐름) ─── */
  // Phase 1: 데이터셋 선택 → 곧장 Phase 2(라벨링 화면)
  if(act === 'ml-sup-pick'){
    const did = el.dataset.did;
    const ds = mlDatasetById(did);
    if(!ds) return;
    ML_SUP_DATASET = ds;
    // 공용 풀 (클래스당 7장 × 3클래스 = 21장). TM식이라 전부 담을 필요 없음.
    ML_SUP_POOL = mlGenerateDataset(did, 7, { seedOffset: 0 });
    _mlShuffle(ML_SUP_POOL.samples);
    // 그룹 3개 고정 — 학생은 이름만 정하고 카드를 담음 (추가/삭제 없음)
    ML_SUP_CLASSES = [
      { id: 'g1', name: '' },
      { id: 'g2', name: '' },
      { id: 'g3', name: '' },
    ];
    ML_SUP_ACTIVE_CLS = null;
    ML_SUP_LABELS = {};
    ML_SUP_TRAINED = false;
    ML_SUP_DRAW_STROKES = [];
    ML_SUP_DRAW_PRED = null;
    ML_SUP_PHASE = 'label';
    render();
    return;
  }

  if(act === 'ml-sup-back'){
    ML_SUP_PHASE = 'pick';
    ML_SUP_DATASET = null;
    ML_SUP_POOL = null;
    ML_SUP_CLASSES = [];
    ML_SUP_ACTIVE_CLS = null;
    ML_SUP_LABELS = {};
    ML_SUP_TRAINED = false;
    ML_SUP_DRAW_STROKES = [];
    ML_SUP_DRAW_PRED = null;
    render();
    return;
  }

  // 활성 그룹 선택 (그룹 박스 본문 클릭 — 클릭으로 카드 담기용)
  if(act === 'ml-sup-cls-pick'){
    const cid = el.dataset.cid;
    const c = ML_SUP_CLASSES.find(c => c.id === cid);
    if(!c) return;
    if(!(c.name || '').trim()){
      toast('이 그룹의 이름을 먼저 정해주세요', 'err');
      return;
    }
    ML_SUP_ACTIVE_CLS = cid;
    render();
    return;
  }

  // Phase 2: 공용 풀 카드 클릭(폴백) → 활성 그룹에 담기
  if(act === 'ml-sup-pool-pick'){
    const idx = parseInt(el.dataset.idx);
    if(!ML_SUP_ACTIVE_CLS){
      toast('먼저 위에서 그룹을 하나 선택하면 클릭으로 담을 수 있어요 (또는 드래그하세요)', 'err');
      return;
    }
    ML_SUP_LABELS[idx] = ML_SUP_ACTIVE_CLS;
    render();
    return;
  }

  // Phase 2: 그룹에 담긴 카드 클릭 → 다시 풀로 빼기
  if(act === 'ml-sup-card-unlabel'){
    const idx = parseInt(el.dataset.idx);
    delete ML_SUP_LABELS[idx];
    render();
    return;
  }

  // Phase 3 → Phase 4: 학습 + 테스트(그리기)로
  if(act === 'ml-sup-train'){
    const clsCnt = {};
    ML_SUP_CLASSES.forEach(c => clsCnt[c.id] = 0);
    Object.values(ML_SUP_LABELS).forEach(cid => { if(clsCnt[cid] != null) clsCnt[cid]++; });
    const named = ML_SUP_CLASSES.filter(c => (c.name || '').trim());
    const empty = named.filter(c => clsCnt[c.id] === 0);
    if(named.length < 2 || empty.length){
      toast(`이름 정한 그룹마다 사진을 1장 이상 담아주세요`, 'err');
      return;
    }
    toast('🧠 학습 중...', 'info');
    setTimeout(() => {
      ML_SUP_TRAINED = true;
      ML_SUP_PHASE = 'test';
      ML_SUP_DRAW_STROKES = [];
      ML_SUP_DRAW_PRED = null;
      render();
    }, 600);
    return;
  }

  if(act === 'ml-sup-back-label'){
    ML_SUP_PHASE = 'label';
    render();
    return;
  }

  // Phase 4(그리기): 색 선택
  if(act === 'ml-sup-draw-color'){
    ML_SUP_DRAW_COLOR = el.dataset.color || '#333333';
    render();
    return;
  }

  // Phase 4(그리기): 지우기
  if(act === 'ml-sup-draw-clear'){
    ML_SUP_DRAW_STROKES = [];
    ML_SUP_DRAW_PRED = null;
    render();
    return;
  }

  // Phase 4(그리기): 맞춰보기 → 캔버스 벡터화 후 KNN 예측
  if(act === 'ml-sup-draw-predict'){
    if(!ML_SUP_DRAW_STROKES.length){ toast('먼저 그림을 그려주세요', 'err'); return; }
    const canvas = document.getElementById('ml-draw-canvas');
    if(!canvas){ return; }
    const vec = _mlCanvasToVec(canvas);
    const trainSamples = Object.entries(ML_SUP_LABELS).map(([sidx, cid]) => {
      const s = ML_SUP_POOL.samples[parseInt(sidx)];
      return { vec: s.vec, classId: cid, label: ML_SUP_CLASSES.find(c => c.id === cid)?.name || '?' };
    });
    if(!trainSamples.length){ toast('학습 데이터가 없습니다', 'err'); return; }
    const k = Math.min(3, trainSamples.length);
    ML_SUP_DRAW_PRED = mlKnnPredict(trainSamples, vec, k);
    render();
    return;
  }

  /* ─── 📈 선형회귀 ─── */
  if(act === 'ml-lr-pick'){
    const ds = mlLrDatasetById(el.dataset.did);
    if(!ds) return;
    ML_LR_DATASET = ds;
    const b = _mlLrBounds(ds);
    const midY = (b.yMin + b.yMax) / 2;       // 평평한 선에서 시작 → 학생이 기울여 맞춤
    ML_LR_HANDLES = { yL: midY, yR: midY };
    ML_LR_STAGE = 'draw';
    ML_LR_USER_PRED = '';
    ML_LR_PROBE_X = '';
    ML_LR_RESID_FOR = 'opt';
    ML_LR_GD = null;
    ML_LR_FIT = null;
    _mlLrStopAuto();
    render();
    return;
  }

  if(act === 'ml-lr-back'){
    _mlLrStopAuto();
    ML_LR_DATASET = null;
    ML_LR_GD = null; ML_LR_FIT = null;
    render();
    return;
  }

  if(act === 'ml-lr-stage'){
    if(!ML_LR_DATASET) return;
    const s = el.dataset.s;
    _mlLrStopAuto();
    if(s === 'learn' && !ML_LR_GD) ML_LR_GD = mlLinregGD(ML_LR_DATASET.points);
    if((s === 'optimal' || s === 'mse') && !ML_LR_FIT) ML_LR_FIT = mlLinregFit(ML_LR_DATASET.points);
    ML_LR_STAGE = s;
    render();
    return;
  }

  if(act === 'ml-lr-step'){
    if(!ML_LR_DATASET) return;
    if(!ML_LR_GD) ML_LR_GD = mlLinregGD(ML_LR_DATASET.points);
    _mlLrStopAuto();
    ML_LR_GD.step();
    render();
    return;
  }

  if(act === 'ml-lr-run'){
    if(!ML_LR_DATASET) return;
    if(!ML_LR_GD) ML_LR_GD = mlLinregGD(ML_LR_DATASET.points);
    if(ML_LR_AUTO){ _mlLrStopAuto(); render(); return; }   // 재생 중이면 정지
    if(ML_LR_GD.done) ML_LR_GD = mlLinregGD(ML_LR_DATASET.points);  // 끝났으면 처음부터
    ML_LR_AUTO = setInterval(() => {
      // 선형회귀 학습 화면을 벗어났으면 정지 (누수 방지)
      if(ST_TAB !== 'ml' || ML_TAB !== 'linreg' || ML_LR_STAGE !== 'learn' || !ML_LR_GD){ _mlLrStopAuto(); return; }
      ML_LR_GD.step();
      render();
      if(ML_LR_GD.done){ _mlLrStopAuto(); render(); }
    }, 280);
    render();
    return;
  }

  if(act === 'ml-lr-reset'){
    if(!ML_LR_DATASET) return;
    _mlLrStopAuto();
    ML_LR_GD = mlLinregGD(ML_LR_DATASET.points);
    render();
    return;
  }

  if(act === 'ml-lr-resid'){
    ML_LR_RESID_FOR = el.dataset.for === 'mine' ? 'mine' : 'opt';
    render();
    return;
  }

  /* ─── 🌳 결정 트리 (2D 칸 나누기) ─── */
  // 칸 클릭 → 라벨 순환 (없음 → 표정들 → 없음)
  if(act === 'ml-dt-cell'){
    const key = el.dataset.cell;
    const order = [null, ...ML_DT_DATASET.classes.map(c => c.id)];
    const cur = ML_DT_REGIONLAB[key] || null;
    const next = order[(order.indexOf(cur) + 1) % order.length];
    if(next) ML_DT_REGIONLAB[key] = next; else delete ML_DT_REGIONLAB[key];
    render();
    return;
  }
  // 칸막이 추가 (가장 넓은 칸 가운데, 최대 2개)
  if(act === 'ml-dt-addcut'){
    const axis = el.dataset.axis;
    const arr = axis === 'v' ? ML_DT_VCUTS : ML_DT_HCUTS;
    if(arr.length >= 2) return;
    const oldV = [...ML_DT_VCUTS], oldH = [...ML_DT_HCUTS];
    const bounds = axis === 'v' ? _mlDtBoundsX() : _mlDtBoundsY();
    let mid = 0, w = -1;
    for(let i = 0; i < bounds.length - 1; i++){ const ww = bounds[i + 1] - bounds[i]; if(ww > w){ w = ww; mid = (bounds[i] + bounds[i + 1]) / 2; } }
    let pos = Math.max(-1.5, Math.min(1.5, Math.round(mid - 0.5) + 0.5));
    while(arr.includes(pos) && pos < 1.5) pos += 1;
    while(arr.includes(pos) && pos > -1.5) pos -= 1;
    if(arr.includes(pos)) return;
    arr.push(pos); arr.sort((a, b) => a - b);
    _mlDtRemapLabels(oldV, oldH);
    render();
    return;
  }
  // 칸막이 삭제 (×)
  if(act === 'ml-dt-rmcut'){
    const axis = el.dataset.cut, idx = parseInt(el.dataset.idx);
    const oldV = [...ML_DT_VCUTS], oldH = [...ML_DT_HCUTS];
    const arr = axis === 'v' ? ML_DT_VCUTS : ML_DT_HCUTS;
    if(idx >= 0 && idx < arr.length) arr.splice(idx, 1);
    _mlDtRemapLabels(oldV, oldH);
    render();
    return;
  }
  // 칸 자동 라벨 (각 칸 다수 진짜표정)
  if(act === 'ml-dt-autolabel'){
    const bx = _mlDtBoundsX(), by = _mlDtBoundsY();
    const lab = {};
    for(let ci = 0; ci < bx.length - 1; ci++) for(let cj = 0; cj < by.length - 1; cj++){
      const cnt = {};
      ML_DT_DATASET.samples.forEach(s => { if(_mlDtCellKeyAt(s[ML_DT_FX], s[ML_DT_FY]) === ci + '_' + cj) cnt[s.cls] = (cnt[s.cls] || 0) + 1; });
      let best = null, bn = 0;
      for(const k in cnt){ if(cnt[k] > bn){ bn = cnt[k]; best = k; } }
      if(best) lab[ci + '_' + cj] = best;
    }
    ML_DT_REGIONLAB = lab;
    render();
    return;
  }
  // 칸막이·라벨 지우기
  if(act === 'ml-dt-clear'){
    ML_DT_VCUTS = []; ML_DT_HCUTS = []; ML_DT_REGIONLAB = {};
    render();
    return;
  }
  // 모델 비교 공개 토글
  if(act === 'ml-dt-reveal'){
    ML_DT_REVEAL = !ML_DT_REVEAL;
    render();
    return;
  }

  /* ── 비지도학습 (2D 점 지도 + K-Means) ── */
  if(act === 'ml-un-pick'){
    const did = el.dataset.did;
    const ds = mlDatasetById(did);
    if(!ds) return;
    ML_UN_DATASET = ds;
    // 클래스당 10장 → 3클래스면 30점. 2D로 투영해 산점도로 보여줌.
    ML_UN_DATA = mlGenerateDataset(did, 10, { seedOffset: 100 });
    _mlBuildUn2D();
    ML_UN_KMEANS = null;
    ML_UN_K = 3;
    ML_UN_REVEAL = false;
    if(ML_UN_AUTO_TIMER){ clearInterval(ML_UN_AUTO_TIMER); ML_UN_AUTO_TIMER = null; }
    ML_UN_PHASE = 'run';
    render();
    return;
  }

  if(act === 'ml-un-back'){
    ML_UN_PHASE = 'pick';
    ML_UN_DATASET = null;
    ML_UN_DATA = null; ML_UN_PTS = null; ML_UN_BOUNDS = null; ML_UN_2D = null;
    ML_UN_KMEANS = null;
    ML_UN_REVEAL = false;
    if(ML_UN_AUTO_TIMER){ clearInterval(ML_UN_AUTO_TIMER); ML_UN_AUTO_TIMER = null; }
    render();
    return;
  }

  if(act === 'ml-un-start'){
    if(!ML_UN_2D) return;
    _mlStopAuto();
    // 중심을 중앙 근처 무작위로 시작 → 여러 단계에 걸쳐 덩어리를 찾아감
    ML_UN_KMEANS = mlKMeansInit(ML_UN_2D, ML_UN_K, { init: 'center' });
    ML_UN_KMEANS.assignStep();  // 첫 색칠(중심이 가운데라 뒤섞여 보임)
    render();
    return;
  }

  if(act === 'ml-un-step'){
    if(!ML_UN_KMEANS) return;
    _mlStopAuto();
    ML_UN_KMEANS.step();
    render();
    return;
  }

  // 자동 재생: 한 단계씩 0.8초 간격으로 진행하며 중심이 이동하는 과정을 보여줌
  if(act === 'ml-un-run'){
    if(!ML_UN_KMEANS) return;
    if(ML_UN_AUTO_TIMER){ _mlStopAuto(); render(); return; }  // 재생 중이면 정지
    let stable = 0;
    ML_UN_AUTO_TIMER = setInterval(() => {
      // ml 비지도 화면을 벗어났으면 정지 (누수 방지)
      if(ST_TAB !== 'ml' || ML_TAB !== 'unsupervised' || !ML_UN_KMEANS){ _mlStopAuto(); return; }
      ML_UN_KMEANS.step();
      // update 단계 직후 변화 없으면 카운트 (assign/update 둘 다 무변이면 수렴)
      if(ML_UN_KMEANS.phase === 'assign' && !ML_UN_KMEANS.changed) stable++;
      else stable = 0;
      render();
      if(stable >= 1){ _mlStopAuto(); render(); }
    }, 800);
    render();
    return;
  }

  if(act === 'ml-un-reset'){
    if(!ML_UN_2D) return;
    _mlStopAuto();
    ML_UN_KMEANS = mlKMeansInit(ML_UN_2D, ML_UN_K, { init: 'center' });
    ML_UN_KMEANS.assignStep();
    ML_UN_REVEAL = false;
    render();
    return;
  }

  if(act === 'ml-un-reveal'){
    ML_UN_REVEAL = !ML_UN_REVEAL;
    render();
    return;
  }

  /* ── 강화학습 — 미션 탭으로 이동 ── */
  if(act === 'ml-go-mission'){
    ST_TAB = 'mission';
    setST('mission');
    return;
  }

  /* ── 강화학습 — 선생님 설명 저장 ── */
  if(act === 'ml-rl-save-desc'){
    if(!TC_CLS) return;
    const ta = document.getElementById('ml-rl-desc-input');
    const val = ta ? ta.value : '';
    try {
      await setMlRlDesc(TC_CLS.id, val);
      toast('💾 강화학습 설명을 저장했어요', 'ok');
      render();
    } catch(err){
      console.error(err);
      toast('저장 실패: ' + (err.message || err), 'err');
    }
    return;
  }
});

// 비지도 자동 재생 정지
function _mlStopAuto(){
  if(ML_UN_AUTO_TIMER){ clearInterval(ML_UN_AUTO_TIMER); ML_UN_AUTO_TIMER = null; }
}

// 선형회귀 학습 자동 재생 정지
function _mlLrStopAuto(){
  if(ML_LR_AUTO){ clearInterval(ML_LR_AUTO); ML_LR_AUTO = null; }
}

// ── 선형회귀: 직선 끝점(●) 드래그 (한 번만 등록, 전역 위임) ──
let _mlLrDrag = { side: null };

// 드래그 중 예측 십자선을 직선 따라 이동 (full render 없이 DOM만)
function _mlLrUpdatePredictMarker(b, ab){
  const ds = ML_LR_DATASET; if(!ds) return;
  const x = ds.predictX, yhat = ab.a * x + ab.b;
  const px = _mlLrSX(b, x), py = _mlLrSY(b, yhat);
  const v = document.getElementById('lr-pred-v');
  const h = document.getElementById('lr-pred-h');
  const dot = document.getElementById('lr-pred-dot');
  if(v){ v.setAttribute('x1', px.toFixed(1)); v.setAttribute('x2', px.toFixed(1)); v.setAttribute('y2', py.toFixed(1)); }
  if(h){ h.setAttribute('y1', py.toFixed(1)); h.setAttribute('y2', py.toFixed(1)); h.setAttribute('x2', px.toFixed(1)); }
  if(dot){ dot.setAttribute('cx', px.toFixed(1)); dot.setAttribute('cy', py.toFixed(1)); }
}

document.addEventListener('pointerdown', e => {
  const h = e.target.closest && e.target.closest('#lr-svg [data-h]');
  if(!h) return;
  if(ST_TAB !== 'ml' || ML_TAB !== 'linreg' || ML_LR_STAGE !== 'draw' || !ML_LR_HANDLES) return;
  e.preventDefault();
  _mlLrDrag.side = h.dataset.h;
  const svg = document.getElementById('lr-svg');
  try { svg && svg.setPointerCapture && svg.setPointerCapture(e.pointerId); } catch(_){}
});

window.addEventListener('pointermove', e => {
  if(!_mlLrDrag.side || !ML_LR_DATASET || !ML_LR_HANDLES) return;
  const svg = document.getElementById('lr-svg');
  if(!svg) return;
  const rect = svg.getBoundingClientRect();
  const b = _mlLrBounds(ML_LR_DATASET);
  const svgY = (e.clientY - rect.top) / rect.height * LR_SVG_H;
  let dataY = b.yMin + (1 - (svgY - LR_PAD.t) / LR_PLOT_H) * (b.yMax - b.yMin);
  dataY = Math.max(b.yMin, Math.min(b.yMax, dataY));
  const side = _mlLrDrag.side;
  if(side === 'L') ML_LR_HANDLES.yL = dataY; else ML_LR_HANDLES.yR = dataY;
  const cy = _mlLrSY(b, dataY).toFixed(1);
  const vis = document.getElementById('lr-h-' + side);
  const hit = document.getElementById('lr-hhit-' + side);
  if(vis) vis.setAttribute('cy', cy);
  if(hit) hit.setAttribute('cy', cy);
  const line = document.getElementById('lr-line-mine');
  if(line) line.setAttribute(side === 'L' ? 'y1' : 'y2', cy);
  const mine = _mlLrLineFromHandles(b, ML_LR_HANDLES);
  const eq = document.getElementById('lr-eq-mine');
  if(eq) eq.textContent = _mlLrFmtEq(mine.a, mine.b);
  _mlLrUpdatePredictMarker(b, mine);
});

window.addEventListener('pointerup', () => { _mlLrDrag.side = null; });

// ── 🌳 결정 트리: 축 선택(change) ──
document.addEventListener('change', e => {
  const el = e.target.closest && e.target.closest('[data-action="ml-dt-axis"]');
  if(!el) return;
  const which = el.dataset.axis, val = el.value;
  if(which === 'x'){ if(val === ML_DT_FY) ML_DT_FY = ML_DT_FX; ML_DT_FX = val; }
  else { if(val === ML_DT_FX) ML_DT_FX = ML_DT_FY; ML_DT_FY = val; }
  ML_DT_TREE = null;  // 축 바뀌면 모델 다시 학습
  render();
});

// 칸막이 추가/삭제 시 칸별 라벨을 칸 중심 기준으로 이어받기
function _mlDtRemapLabels(oldV, oldH){
  const oBX = [DT_LO, ...[...oldV].sort((a, b) => a - b), DT_HI];
  const oBY = [DT_LO, ...[...oldH].sort((a, b) => a - b), DT_HI];
  const oldKeyAt = (x, y) => {
    let ci = 0; while(ci < oBX.length - 2 && x >= oBX[ci + 1]) ci++;
    let cj = 0; while(cj < oBY.length - 2 && y >= oBY[cj + 1]) cj++;
    return ci + '_' + cj;
  };
  const bx = _mlDtBoundsX(), by = _mlDtBoundsY(), nl = {};
  for(let ci = 0; ci < bx.length - 1; ci++) for(let cj = 0; cj < by.length - 1; cj++){
    const cx = (bx[ci] + bx[ci + 1]) / 2, cy = (by[cj] + by[cj + 1]) / 2;
    const ol = ML_DT_REGIONLAB[oldKeyAt(cx, cy)];
    if(ol) nl[ci + '_' + cj] = ol;
  }
  ML_DT_REGIONLAB = nl;
}

// ── 🌳 결정 트리: 칸막이 드래그 (한 번만 등록) ──
document.addEventListener('pointerdown', e => {
  const hit = e.target.closest && e.target.closest('#dt-svg [data-cut]');
  if(!hit || hit.dataset.action) return;   // × 삭제 버튼은 클릭으로 처리
  if(ST_TAB !== 'ml' || ML_TAB !== 'dtree') return;
  e.preventDefault();
  ML_DT_DRAG = { axis: hit.dataset.cut, idx: parseInt(hit.dataset.idx) };
});

window.addEventListener('pointermove', e => {
  if(!ML_DT_DRAG) return;
  const svg = document.getElementById('dt-svg');
  if(!svg) return;
  const rect = svg.getBoundingClientRect();
  const { axis, idx } = ML_DT_DRAG;
  let val;
  if(axis === 'v'){
    const svgX = (e.clientX - rect.left) / rect.width * DT_SVG_W;
    val = DT_LO + (svgX - DT_PAD.l) / DT_PW * (DT_HI - DT_LO);
  } else {
    const svgY = (e.clientY - rect.top) / rect.height * DT_SVG_H;
    val = DT_LO + (1 - (svgY - DT_PAD.t) / DT_PH) * (DT_HI - DT_LO);
  }
  let snapped = Math.max(-1.5, Math.min(1.5, Math.round(val - 0.5) + 0.5));  // 단계 사이(±0.5,±1.5)
  const arr = axis === 'v' ? ML_DT_VCUTS : ML_DT_HCUTS;
  if(arr.some((c, i) => i !== idx && c === snapped)) return;  // 겹침 방지
  if(arr[idx] !== snapped){ arr[idx] = snapped; render(); }   // 값 바뀔 때만 재렌더
});

window.addEventListener('pointerup', () => { if(ML_DT_DRAG) ML_DT_DRAG = null; });

// 비지도: 현재 데이터셋을 2D로 투영하고 K-Means용 샘플/정규화 범위 준비
//   이모지가 색으로 너무 깔끔히 나뉘면 K-Means가 1~2단계에 끝나 과정이 안 보임.
//   → PCA 좌표에서 클래스 중심을 서로 당기고(shrink) 점을 퍼뜨려(spread+노이즈)
//     경계를 겹치게 만들어, K-Means가 여러 단계에 걸쳐 경계를 다듬게 한다.
function _mlBuildUn2D(){
  const samples = ML_UN_DATA.samples;
  let pts = mlProject2D(samples);

  const n = pts.length;
  // 글로벌 평균
  let gx = 0, gy = 0;
  for(const p of pts){ gx += p[0]; gy += p[1]; }
  gx /= n; gy /= n;
  // 클래스별 평균
  const byClass = {};
  samples.forEach((s, i) => { (byClass[s.classId] = byClass[s.classId] || []).push(i); });
  const classMean = {};
  for(const cid in byClass){
    let cx = 0, cy = 0;
    for(const i of byClass[cid]){ cx += pts[i][0]; cy += pts[i][1]; }
    const m = byClass[cid].length;
    classMean[cid] = [cx / m, cy / m];
  }
  // 데이터 규모 (노이즈 스케일)
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
  for(const p of pts){ mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]); }
  const span = Math.max(mxx - mnx, mxy - mny) || 1;

  const shrink = 0.5;              // 클래스 간 거리를 50%로 압축 → 덩어리들이 가까워짐
  const spread = 1.1;              // 클래스 내 퍼짐 약간 확대
  const jitter = span * 0.05;      // 가우시안 노이즈로 경계 겹치게
  let seed = 7919;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const gauss = () => (rnd() + rnd() + rnd() - 1.5);  // 대략 정규분포

  pts = pts.map((p, i) => {
    const cm = classMean[samples[i].classId];
    const ncx = gx + (cm[0] - gx) * shrink;
    const ncy = gy + (cm[1] - gy) * shrink;
    const x = ncx + (p[0] - cm[0]) * spread + gauss() * jitter;
    const y = ncy + (p[1] - cm[1]) * spread + gauss() * jitter;
    return [x, y];
  });

  ML_UN_PTS = pts;
  ML_UN_2D = samples.map((s, i) => ({ vec: [pts[i][0], pts[i][1]], classId: s.classId, emoji: s.emoji, dataUrl: s.dataUrl }));
  // 정규화 범위
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for(const [x, y] of pts){
    if(x < minX) minX = x; if(x > maxX) maxX = x;
    if(y < minY) minY = y; if(y > maxY) maxY = y;
  }
  const padX = (maxX - minX) * 0.08 || 1, padY = (maxY - minY) * 0.08 || 1;
  ML_UN_BOUNDS = { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
}

// K 슬라이더 (input)
document.addEventListener('input', e => {
  const el = e.target.closest('[data-action="ml-un-k"]');
  if(el){
    const v = parseInt(el.value, 10);
    if(isNaN(v)) return;
    ML_UN_K = v;
    if(ML_UN_DATA){
      ML_UN_KMEANS = mlKMeansInit(ML_UN_DATA.samples, ML_UN_K);
      ML_UN_KMEANS.assignStep();
      ML_UN_REVEAL = false;
      render();
    }
    return;
  }
  // 그룹 이름 입력 중 — 포커스 유지를 위해 값만 갱신, 렌더 X
  const clsEl = e.target.closest('[data-action="ml-sup-cls-name"]');
  if(clsEl){
    const cid = clsEl.dataset.cid;
    const c = ML_SUP_CLASSES.find(c => c.id === cid);
    if(c) c.name = clsEl.value;
    return;
  }
  // 선형회귀: 학생이 손으로 적는 예측값 (렌더 X — 포커스 유지)
  const upEl = e.target.closest('#lr-userpred');
  if(upEl){ ML_LR_USER_PRED = upEl.value; return; }
  // 선형회귀: 임의 x 예측(probe) — 결과 span만 직접 갱신
  const probeEl = e.target.closest('#lr-probe');
  if(probeEl){
    ML_LR_PROBE_X = probeEl.value;
    const out = document.getElementById('lr-probe-out');
    const ds = ML_LR_DATASET, fit = ML_LR_FIT;
    if(out && ds && fit){
      const xv = parseFloat(probeEl.value);
      if(probeEl.value.trim() !== '' && !isNaN(xv)){
        const yv = _mlLrRound(fit.a * xv + fit.b, ds.decimals);
        out.innerHTML = `${esc(ds.yLabel)} 약 <b>${yv}${esc(ds.yUnit)}</b>`;
      } else {
        out.innerHTML = '다른 값을 넣으면 예측값이 나와요';
      }
    }
    return;
  }
});

// 그룹 이름 input blur — 이름이 채워졌고 활성 그룹이 없으면 자동 활성화 (그룹은 3개 고정, 삭제 없음)
document.addEventListener('blur', e => {
  const el = e.target.closest && e.target.closest('[data-action="ml-sup-cls-name"]');
  if(!el) return;
  const cid = el.dataset.cid;
  const c = ML_SUP_CLASSES.find(c => c.id === cid);
  if(!c) return;
  c.name = (c.name || '').trim();
  if(c.name && !ML_SUP_ACTIVE_CLS) ML_SUP_ACTIVE_CLS = cid;
  render();
}, true);  // capture phase

// 헬퍼: Fisher-Yates 셔플 (in-place)
function _mlShuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── 드래그 앤 드롭 (라벨링: 풀 사진 → 그룹 박스) ──
let ML_SUP_LABEL_DRAG = null;     // 라벨링 풀 카드 드래그 중 idx

document.addEventListener('dragstart', e => {
  const poolImg = e.target.closest('[data-label-idx]');
  if(poolImg){
    ML_SUP_LABEL_DRAG = parseInt(poolImg.dataset.labelIdx);
    if(e.dataTransfer){ e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'l' + ML_SUP_LABEL_DRAG); } catch(_){} }
    const card = poolImg.closest('.ml-pool-card'); if(card) card.classList.add('dragging');
  }
});

document.addEventListener('dragend', e => {
  document.querySelectorAll('.ml-pool-card.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.dragover').forEach(el => el.classList.remove('dragover'));
});

document.addEventListener('dragover', e => {
  const dz = e.target.closest('[data-group-drop]');
  if(!dz) return;
  e.preventDefault();
  if(e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  dz.classList.add('dragover');
});

document.addEventListener('dragleave', e => {
  const dz = e.target.closest('[data-group-drop]');
  if(dz && !dz.contains(e.relatedTarget)) dz.classList.remove('dragover');
});

document.addEventListener('drop', e => {
  const gbox = e.target.closest('[data-group-drop]');
  if(!gbox) return;
  e.preventDefault();
  gbox.classList.remove('dragover');
  let idx = ML_SUP_LABEL_DRAG;
  if(idx == null && e.dataTransfer){
    const t = e.dataTransfer.getData('text/plain');
    if(t && t[0] === 'l') idx = parseInt(t.slice(1));
  }
  ML_SUP_LABEL_DRAG = null;
  if(idx == null || isNaN(idx)) return;
  ML_SUP_LABELS[idx] = gbox.dataset.groupDrop;
  ML_SUP_ACTIVE_CLS = gbox.dataset.groupDrop;  // 이어서 클릭으로도 담기 쉽게
  render();
});

// ── 그리기 캔버스 → 28×28 RGB 벡터 (학습 이모지와 동일 방식: 흰 배경, 1-RGB) ──
function _mlCanvasToVec(canvas){
  const small = document.createElement('canvas');
  small.width = 28; small.height = 28;
  const sctx = small.getContext('2d');
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, 28, 28);
  sctx.drawImage(canvas, 0, 0, 28, 28);
  const px = sctx.getImageData(0, 0, 28, 28).data;
  const vec = new Float32Array(28 * 28 * 3);
  for(let i = 0, j = 0; i < px.length; i += 4, j += 3){
    vec[j]     = 1 - px[i]     / 255;
    vec[j + 1] = 1 - px[i + 1] / 255;
    vec[j + 2] = 1 - px[i + 2] / 255;
  }
  return vec;
}

// ── 지도학습 그리기 캔버스 셋업/복원 (afterRender 훅) ──
const _mlDraw = { drawing: false, cur: null };

// window pointerup은 단 한 번만 등록 (그리기 종료)
window.addEventListener('pointerup', () => { _mlDraw.drawing = false; _mlDraw.cur = null; });

function afterRenderMl(){
  const canvas = document.getElementById('ml-draw-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // 흰 배경 + 기존 획 복원
  const repaint = () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for(const st of ML_SUP_DRAW_STROKES){
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.size;
      const pts = st.points;
      if(pts.length === 1){
        ctx.fillStyle = st.color;
        ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], st.size / 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      }
    }
  };
  repaint();

  const posOf = (e) => {
    const r = canvas.getBoundingClientRect();
    const cx = (e.clientX) - r.left;
    const cy = (e.clientY) - r.top;
    return [cx * (W / r.width), cy * (H / r.height)];
  };

  // 캔버스 리스너는 요소가 매 렌더 새로 생성되므로 자동 정리됨
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    _mlDraw.drawing = true;
    _mlDraw.cur = { color: ML_SUP_DRAW_COLOR, size: ML_SUP_DRAW_SIZE, points: [posOf(e)] };
    ML_SUP_DRAW_STROKES.push(_mlDraw.cur);
    repaint();
  });
  canvas.addEventListener('pointermove', (e) => {
    if(!_mlDraw.drawing || !_mlDraw.cur) return;
    e.preventDefault();
    _mlDraw.cur.points.push(posOf(e));
    const pts = _mlDraw.cur.points, n = pts.length;
    ctx.strokeStyle = _mlDraw.cur.color; ctx.lineWidth = _mlDraw.cur.size;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[n - 2][0], pts[n - 2][1]);
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    ctx.stroke();
  });
}
