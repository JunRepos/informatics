/* ═══════════════════════════════════════
   ml-engine.js — 🤖 기계학습 알고리즘 (순수 JS)

   브라우저에서 즉시 동작하는 작은 KNN/K-Means.
   학생 PC(저사양 포함)에서도 100ms 이내로 동작하도록 단순화.

   Vec = Float32Array 또는 number[]
   Sample = { vec, classId, label, ... }
═══════════════════════════════════════ */

/* ─────────────────── 거리 함수 ─────────────────── */

function mlEuclid(a, b){
  let s = 0;
  const n = a.length;
  for(let i = 0; i < n; i++){
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/* ─────────────────── KNN (지도학습) ─────────────────── */

// trainSamples 안에서 query에 가장 가까운 k개를 찾아 다수결로 클래스 결정.
// 반환: { classId, label, probs: { [classId]: 0~1 }, neighbors: [..] }
function mlKnnPredict(trainSamples, query, k){
  k = k || 5;
  if(!trainSamples || !trainSamples.length) return null;

  // 거리 계산 → 정렬 → 상위 k
  const dists = trainSamples.map((s, i) => ({ i, d: mlEuclid(s.vec, query) }));
  dists.sort((a, b) => a.d - b.d);
  const top = dists.slice(0, k).map(d => trainSamples[d.i]);

  // 클래스별 카운트
  const counts = {};
  const labels = {};
  top.forEach(s => {
    counts[s.classId] = (counts[s.classId] || 0) + 1;
    labels[s.classId] = s.label;
  });
  let bestId = null, bestN = -1;
  for(const cid in counts){
    if(counts[cid] > bestN){ bestN = counts[cid]; bestId = cid; }
  }

  // 확률 = 비율
  const probs = {};
  for(const cid in counts) probs[cid] = counts[cid] / k;

  return {
    classId: bestId,
    label: labels[bestId],
    probs,
    neighbors: top.slice(0, k),
  };
}

/* ─────────────────── K-Means (비지도학습) ─────────────────── */

// 시각화용 step-by-step API.
//   const km = mlKMeansInit(samples, k);
//   km.assignStep();   // 각 점을 가장 가까운 중심으로 배정 (color update)
//   km.updateStep();   // 중심점을 배정된 점들의 평균으로 이동
//   km.changed         // 마지막 updateStep에서 변화가 있었는지
//   km.iter            // 진행 회차
//   km.centroids       // [Vec, ...] 현재 중심
//   km.assignments     // [centroidIdx, ...] 각 sample의 그룹
function mlKMeansInit(samples, k, opts){
  k = Math.max(2, Math.min(k || 3, 8));
  opts = opts || {};
  const dim = samples[0].vec.length;
  const n = samples.length;

  const seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9);
  const rng = (() => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xFFFFFFFF; }; })();

  let centroids;
  if(opts.init === 'center' && dim === 2){
    // 모든 점의 중앙 근처 작은 원에 K개 중심을 균등 배치.
    // → 가운데서 출발해 여러 단계에 걸쳐 각 덩어리로 "찾아가는" 과정이 보임.
    const mean = [0, 0];
    for(const s of samples){ mean[0] += s.vec[0]; mean[1] += s.vec[1]; }
    mean[0] /= n; mean[1] /= n;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for(const s of samples){
      const x = s.vec[0], y = s.vec[1];
      if(x < minX) minX = x; if(x > maxX) maxX = x;
      if(y < minY) minY = y; if(y > maxY) maxY = y;
    }
    const spread = Math.max(maxX - minX, maxY - minY) || 1;
    const r = spread * 0.12;
    const a0 = rng() * Math.PI * 2;  // 시작 각도 무작위
    centroids = [];
    for(let c = 0; c < k; c++){
      const ang = a0 + (Math.PI * 2 * c) / k;
      const v = new Float32Array(2);
      v[0] = mean[0] + r * Math.cos(ang);
      v[1] = mean[1] + r * Math.sin(ang);
      centroids.push(v);
    }
  } else {
    // 기본: K-Means++ 단순화 (첫 점 무작위, 다음은 기존 중심과 가장 먼 점)
    const centroidIdx = [Math.floor(rng() * n)];
    while(centroidIdx.length < k){
      const dists = samples.map((s, i) => {
        let minD = Infinity;
        for(const ci of centroidIdx){
          const d = mlEuclid(s.vec, samples[ci].vec);
          if(d < minD) minD = d;
        }
        return { i, d: minD };
      });
      dists.sort((a, b) => b.d - a.d);
      const next = dists.find(d => !centroidIdx.includes(d.i));
      if(!next) break;
      centroidIdx.push(next.i);
    }
    centroids = centroidIdx.map(i => {
      const v = new Float32Array(dim);
      for(let j = 0; j < dim; j++) v[j] = samples[i].vec[j];
      return v;
    });
  }

  const state = {
    k,
    samples,
    centroids,
    assignments: new Array(n).fill(-1),
    iter: 0,
    changed: true,
    phase: 'assign',   // 다음에 할 단계: 'assign' or 'update'
    assignStep,
    updateStep,
    step,
  };

  function assignStep(){
    let changed = false;
    for(let i = 0; i < n; i++){
      let best = 0, bestD = Infinity;
      for(let c = 0; c < k; c++){
        const d = mlEuclid(samples[i].vec, centroids[c]);
        if(d < bestD){ bestD = d; best = c; }
      }
      if(state.assignments[i] !== best){ changed = true; state.assignments[i] = best; }
    }
    state.changed = changed;
    state.phase = 'update';
    return changed;
  }

  function updateStep(){
    let movedAny = false;
    for(let c = 0; c < k; c++){
      const sums = new Float32Array(dim);
      let cnt = 0;
      for(let i = 0; i < n; i++){
        if(state.assignments[i] === c){
          const v = samples[i].vec;
          for(let j = 0; j < dim; j++) sums[j] += v[j];
          cnt++;
        }
      }
      if(cnt > 0){
        let moved = false;
        for(let j = 0; j < dim; j++){
          const nv = sums[j] / cnt;
          if(Math.abs(centroids[c][j] - nv) > 1e-6) moved = true;
          centroids[c][j] = nv;
        }
        if(moved) movedAny = true;
      }
    }
    state.changed = movedAny;
    state.iter++;
    state.phase = 'assign';
    return movedAny;
  }

  // 한 회차 (assign + update) 묶음
  function step(){
    if(state.phase === 'assign') assignStep();
    else updateStep();
  }

  return state;
}

/* ─────────────────── 2D 투영 (PCA) ───────────────────
   고차원 벡터(RGB 2352차원)를 2D로 떨어뜨려 산점도로 시각화.
   샘플 수 N이 작으므로 Gram 행렬(N×N) 고유분해로 빠르게 PCA 수행.
   반환: [[x, y], ...] (samples와 같은 순서) */
function mlProject2D(samples){
  const n = samples.length;
  if(n === 0) return [];
  if(n === 1) return [[0, 0]];
  const dim = samples[0].vec.length;

  // 평균
  const mean = new Float64Array(dim);
  for(const s of samples) for(let j = 0; j < dim; j++) mean[j] += s.vec[j];
  for(let j = 0; j < dim; j++) mean[j] /= n;

  // 중심화 행렬 X (n×dim)
  const X = [];
  for(let i = 0; i < n; i++){
    const row = new Float64Array(dim);
    const v = samples[i].vec;
    for(let j = 0; j < dim; j++) row[j] = v[j] - mean[j];
    X.push(row);
  }

  // Gram 행렬 G = X Xᵀ (n×n)
  const G = [];
  for(let i = 0; i < n; i++) G.push(new Float64Array(n));
  for(let i = 0; i < n; i++){
    for(let k = i; k < n; k++){
      let s = 0;
      const xi = X[i], xk = X[k];
      for(let j = 0; j < dim; j++) s += xi[j] * xk[j];
      G[i][k] = s; G[k][i] = s;
    }
  }

  // 상위 2개 고유벡터 (power iteration + deflation)
  const e1 = _mlTopEigen(G, n);
  _mlDeflate(G, e1.vec, e1.val, n);
  const e2 = _mlTopEigen(G, n);

  const c1 = Math.sqrt(Math.max(e1.val, 0));
  const c2 = Math.sqrt(Math.max(e2.val, 0));
  const pts = [];
  for(let i = 0; i < n; i++) pts.push([e1.vec[i] * c1, e2.vec[i] * c2]);
  return pts;
}

function _mlTopEigen(M, n){
  // power iteration
  let v = new Float64Array(n);
  let seed = 12345;
  for(let i = 0; i < n; i++){ seed = (seed * 1103515245 + 12345) & 0x7fffffff; v[i] = (seed / 0x7fffffff) - 0.5; }
  let val = 0;
  for(let iter = 0; iter < 120; iter++){
    const w = new Float64Array(n);
    for(let i = 0; i < n; i++){
      let s = 0; const Mi = M[i];
      for(let j = 0; j < n; j++) s += Mi[j] * v[j];
      w[i] = s;
    }
    let norm = 0;
    for(let i = 0; i < n; i++) norm += w[i] * w[i];
    norm = Math.sqrt(norm);
    if(norm < 1e-12) break;
    for(let i = 0; i < n; i++) w[i] /= norm;
    let dot = 0;
    for(let i = 0; i < n; i++) dot += w[i] * v[i];
    v = w; val = norm;
    if(Math.abs(Math.abs(dot) - 1) < 1e-9) break;
  }
  return { vec: v, val };
}

function _mlDeflate(M, v, val, n){
  for(let i = 0; i < n; i++)
    for(let j = 0; j < n; j++)
      M[i][j] -= val * v[i] * v[j];
}

// 그룹별로 sample 인덱스 묶어주기 (UI 표시용)
function mlKMeansGroups(state){
  const groups = Array.from({ length: state.k }, () => []);
  state.assignments.forEach((c, i) => { if(c >= 0) groups[c].push(i); });
  return groups;
}

/* ─────────────────── 단순 선형회귀 (지도학습 — 회귀) ───────────────────
   data: [[x, y], ...]
   학생 실습용. 최소제곱 정답선 + 경사하강법 단계별 애니메이션. */

// 평균제곱오차 MSE = (1/n) Σ (y − (a x + b))²
function mlLinregMSE(data, a, b){
  const n = data.length;
  if(!n) return 0;
  let s = 0;
  for(const [x, y] of data){ const e = y - (a * x + b); s += e * e; }
  return s / n;
}

// 최소제곱 정확해(닫힌 형태). 반환 { a, b, mse }
function mlLinregFit(data){
  const n = data.length;
  if(!n) return { a: 0, b: 0, mse: 0 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for(const [x, y] of data){ sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const denom = n * sxx - sx * sx;
  const a = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const b = (sy - a * sx) / n;
  return { a, b, mse: mlLinregMSE(data, a, b) };
}

// 경사하강법 단계별 stepper (시각화용).
//   x,y를 [0,1]로 정규화해 학습률을 데이터 규모와 무관하게 안정화.
//   처음엔 "평균값을 지나는 수평선"에서 출발 → 기울기를 차차 찾아감.
//   const gd = mlLinregGD(data);
//   gd.step();          // 한 번 호출 = perStep epoch 진행
//   gd.a, gd.b          // 현재 직선(원래 스케일)
//   gd.mse              // 현재 MSE(원래 스케일)
//   gd.iter             // 진행한 epoch 수
//   gd.done             // 수렴 여부
function mlLinregGD(data, opts){
  opts = opts || {};
  const lr = opts.lr != null ? opts.lr : 0.2;
  const perStep = opts.perStep || 4;
  const tol = opts.tol != null ? opts.tol : 1e-5;
  const maxIter = opts.maxIter || 600;
  const n = data.length;

  // 정규화 범위
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for(const [x, y] of data){
    if(x < minX) minX = x; if(x > maxX) maxX = x;
    if(y < minY) minY = y; if(y > maxY) maxY = y;
  }
  const rx = (maxX - minX) || 1, ry = (maxY - minY) || 1;
  const nx = data.map(d => (d[0] - minX) / rx);
  const ny = data.map(d => (d[1] - minY) / ry);

  // 정규화 공간 파라미터: ny ≈ p·nx + q.  평균을 지나는 수평선에서 시작.
  let p = 0, q = ny.reduce((s, v) => s + v, 0) / (n || 1);

  // 정규화 파라미터(p,q) → 원래 스케일(a,b)
  function toOrig(){
    const a = p * ry / rx;
    const b = minY + q * ry - p * ry * minX / rx;
    return { a, b };
  }
  function mseNorm(){
    let s = 0;
    for(let i = 0; i < n; i++){ const e = (p * nx[i] + q) - ny[i]; s += e * e; }
    return s / n;
  }

  const state = { iter: 0, done: false, a: 0, b: 0, mse: 0, step };
  syncOut();

  function syncOut(){
    const o = toOrig();
    state.a = o.a; state.b = o.b;
    state.mse = mlLinregMSE(data, o.a, o.b);
  }
  function step(){
    if(state.done) return;
    const prev = mseNorm();
    for(let k = 0; k < perStep; k++){
      let dp = 0, dq = 0;
      for(let i = 0; i < n; i++){
        const e = (p * nx[i] + q) - ny[i];
        dp += e * nx[i]; dq += e;
      }
      dp = (2 / n) * dp; dq = (2 / n) * dq;
      p -= lr * dp; q -= lr * dq;
      state.iter++;
    }
    syncOut();
    if(state.iter >= maxIter) state.done = true;
    else if(Math.abs(prev - mseNorm()) < tol && state.iter > 6 * perStep) state.done = true;
  }
  return state;
}

// 정답(classId)이 있는 데이터셋에서 K-Means 결과와의 일치율 계산
//   각 그룹에서 가장 많은 정답 라벨을 그 그룹의 "대표"로 보고 정확도 산출
function mlKMeansPurity(state, samples){
  const groups = mlKMeansGroups(state);
  let correct = 0;
  const groupDominant = [];
  groups.forEach(g => {
    const cnt = {};
    g.forEach(i => { const cid = samples[i].classId; cnt[cid] = (cnt[cid] || 0) + 1; });
    let domId = null, domN = -1;
    for(const cid in cnt){ if(cnt[cid] > domN){ domN = cnt[cid]; domId = cid; } }
    groupDominant.push({ classId: domId, count: domN, total: g.length });
    correct += domN;
  });
  return {
    purity: samples.length ? correct / samples.length : 0,
    groupDominant,
  };
}

/* ─────────────────── 로지스틱 회귀 (지도학습 — 분류) ───────────────────
   data: [{ x:number, y:0|1 }]
   확률 p = sigmoid(a·x + b), 0.5 기준 분류. 경사하강(교차엔트로피).
   x를 [0,1]로 정규화해 학습률 안정화. */
function mlSigmoid(z){ return 1 / (1 + Math.exp(-z)); }

function mlLogisticFit(data, opts){
  opts = opts || {};
  const lr = opts.lr != null ? opts.lr : 0.6;
  const perStep = opts.perStep || 8;
  const tol = opts.tol != null ? opts.tol : 1e-3;
  const maxIter = opts.maxIter || 800;
  const n = data.length;
  let minX = Infinity, maxX = -Infinity;
  for(const d of data){ if(d.x < minX) minX = d.x; if(d.x > maxX) maxX = d.x; }
  const rx = (maxX - minX) || 1;
  const nx = data.map(d => (d.x - minX) / rx), y = data.map(d => d.y);
  let a = 0, b = 0;
  const pN = xn => mlSigmoid(a * xn + b);
  function loss(){
    let s = 0;
    for(let i = 0; i < n; i++){ const p = Math.min(1 - 1e-9, Math.max(1e-9, pN(nx[i]))); s += -(y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p)); }
    return s / n;
  }
  const state = {
    iter: 0, done: false, loss: 0, a: 0, b: 0,
    prob: x => mlSigmoid(a * ((x - minX) / rx) + b),   // 원래 x에서의 확률
    boundaryX: () => (a === 0 ? null : minX + (-b / a) * rx),  // p=0.5 되는 x
    accuracy: () => { let ok = 0; for(let i = 0; i < n; i++){ const pred = pN(nx[i]) >= 0.5 ? 1 : 0; if(pred === y[i]) ok++; } return ok / n; },
    step,
  };
  syncOut();
  function syncOut(){ state.a = a; state.b = b; state.loss = loss(); }
  function step(){
    if(state.done) return;
    const prev = loss();
    for(let k = 0; k < perStep; k++){
      let da = 0, db = 0;
      for(let i = 0; i < n; i++){ const p = pN(nx[i]); da += (p - y[i]) * nx[i]; db += (p - y[i]); }
      da /= n; db /= n; a -= lr * da; b -= lr * db; state.iter++;
    }
    syncOut();
    if(state.iter >= maxIter) state.done = true;
    else if(Math.abs(prev - loss()) < tol && state.iter > 6 * perStep) state.done = true;
  }
  return state;
}

/* ─────────────────── 결정 트리 (지도학습 — 분류) ───────────────────
   samples: [{ [featureKey]: number, cls: classId }, ...]
   학생이 직접 칸을 나눈 것과 비교할 "모델". 그리디 CART(Gini), 축정렬 분할. */

function _mlCounts(rows){ const c = {}; for(const r of rows) c[r.cls] = (c[r.cls] || 0) + 1; return c; }
function _mlMajority(c){ let id = null, n = -1; for(const k in c){ if(c[k] > n){ n = c[k]; id = k; } } return id; }
function _mlGini(c, n){ if(!n) return 0; let s = 1; for(const k in c){ const p = c[k] / n; s -= p * p; } return s; }

// 결정 트리 만들기 (그리디). featureKeys 안에서만 분할 → 2D 비교 시 [fx,fy]만 넘기면 사각형 영역.
function mlBuildTree(samples, featureKeys, opts){
  opts = opts || {};
  const maxDepth = opts.maxDepth != null ? opts.maxDepth : 3;
  const minLeaf = opts.minLeaf || 1;

  function build(rows, depth){
    const c = _mlCounts(rows);
    const node = { counts: c, label: _mlMajority(c), n: rows.length };
    if(depth >= maxDepth || rows.length <= minLeaf || Object.keys(c).length <= 1) return node;
    const parentGini = _mlGini(c, rows.length);
    let best = null;
    featureKeys.forEach(fk => {
      const vals = [...new Set(rows.map(r => r[fk]))].sort((a, b) => a - b);
      for(let i = 0; i < vals.length - 1; i++){
        const thr = (vals[i] + vals[i + 1]) / 2;
        const L = rows.filter(r => r[fk] < thr), R = rows.filter(r => r[fk] >= thr);
        if(L.length < minLeaf || R.length < minLeaf) continue;
        const g = (L.length * _mlGini(_mlCounts(L), L.length) + R.length * _mlGini(_mlCounts(R), R.length)) / rows.length;
        if(!best || g < best.g){ best = { g, fk, thr, L, R }; }
      }
    });
    if(!best || best.g >= parentGini - 1e-9) return node;  // 개선 없으면 잎
    node.feature = best.fk; node.thr = best.thr;
    node.left = build(best.L, depth + 1);
    node.right = build(best.R, depth + 1);
    node.label = null;  // 내부 노드
    return node;
  }
  return build(samples, 0);
}

// 한 샘플 예측 (잎의 다수 라벨)
function mlTreePredict(node, sample){
  while(node && node.feature != null) node = sample[node.feature] < node.thr ? node.left : node.right;
  return node ? node.label : null;
}

// 정확도
function mlTreeAccuracy(node, samples){
  if(!samples.length) return 0;
  let ok = 0;
  for(const s of samples) if(mlTreePredict(node, s) === s.cls) ok++;
  return ok / samples.length;
}

// 2개 축(fx,fy)만 쓰는 트리 → 잎 사각형 목록 (경계 그리기용)
function mlTreeRegions(node, fx, fy, x0, x1, y0, y1){
  if(!node) return [];
  if(node.feature == null) return [{ x0, x1, y0, y1, label: node.label, n: node.n }];
  if(node.feature === fx){
    return mlTreeRegions(node.left, fx, fy, x0, node.thr, y0, y1)
      .concat(mlTreeRegions(node.right, fx, fy, node.thr, x1, y0, y1));
  }
  if(node.feature === fy){
    return mlTreeRegions(node.left, fx, fy, x0, x1, y0, node.thr)
      .concat(mlTreeRegions(node.right, fx, fy, x0, x1, node.thr, y1));
  }
  // 다른 특징(2D 외) — 같은 영역에 병합(모델을 [fx,fy]로 build하면 발생 안 함)
  return mlTreeRegions(node.left, fx, fy, x0, x1, y0, y1)
    .concat(mlTreeRegions(node.right, fx, fy, x0, x1, y0, y1));
}

/* ═══════════════════════════════════════════════════════════════════
   📦 데이터셋 학습 래퍼 — 🧩 AI 프로젝트 매니저(5차시 문제 해결)

   미리 탑재한 tabular 데이터를 훈련/테스트로 나눠 실제 모델을 학습 →
   진짜 정확도/오차로 평가하는 범용 도구. row = { [featureKey]:number, [targetKey]:값 }
   - 분류: 모델 'logistic'(이진) | 'tree' | 'knn'
   - 회귀: 모델 'linreg' (여기선 1특징)
   - 군집: 'kmeans' (정답 target 은 평가(순도)에만 사용)
   비교가 공정하도록 같은 split(훈련/테스트)을 모든 모델에 동일하게 적용한다.
═══════════════════════════════════════════════════════════════════ */

// 시드 기반 셔플 (재현 가능 — 같은 시드면 같은 결과 → 정확도가 매번 흔들리지 않음)
function mlSeededShuffle(arr, seed){
  const a = arr.slice();
  let s = (seed || 12345) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 훈련/테스트 분할. ratio=훈련 비율(기본 0.7). targetKey 주면 클래스별 층화(작은 표본 쏠림 방지).
function mlTrainTestSplit(rows, ratio, seed, targetKey){
  ratio = ratio == null ? 0.7 : ratio;
  if(targetKey){
    const byCls = {};
    rows.forEach(r => { const c = String(r[targetKey]); (byCls[c] = byCls[c] || []).push(r); });
    const train = [], test = [];
    let k = 0;
    for(const c in byCls){
      const sh = mlSeededShuffle(byCls[c], (seed || 1) + (k++ * 101));
      const nTrain = Math.max(1, Math.round(sh.length * ratio));
      train.push(...sh.slice(0, nTrain));
      test.push(...sh.slice(nTrain));
    }
    return { train, test };
  }
  const sh = mlSeededShuffle(rows, seed);
  const nTrain = Math.round(sh.length * ratio);
  return { train: sh.slice(0, nTrain), test: sh.slice(nTrain) };
}

// 특징 정규화 통계(min-max)를 훈련행에서 계산 (kNN 거리·로지스틱 GD 안정화)
function mlFeatureStats(rows, featureKeys){
  const stats = {};
  featureKeys.forEach(k => {
    let mn = Infinity, mx = -Infinity;
    for(const r of rows){ const v = +r[k]; if(v < mn) mn = v; if(v > mx) mx = v; }
    stats[k] = { min: mn, max: mx, range: (mx - mn) || 1 };
  });
  return stats;
}
function mlRowToVec(row, featureKeys, stats){
  return featureKeys.map(k => ((+row[k]) - stats[k].min) / stats[k].range);
}

// target 값을 0/1 로. posValue 주면 그 값이 1, 아니면 (1/'1'/true) 가 1.
function _mlBin(v, posValue){
  if(posValue != null) return String(v) === String(posValue) ? 1 : 0;
  return (v === 1 || v === '1' || v === true) ? 1 : 0;
}

// ── 다특징 이진 로지스틱 회귀 (경사하강) ──
//   반환 { weights, bias, stats, prob(row), predict(row), accuracy(rows), featureKeys }
function mlLogisticFitMulti(trainRows, featureKeys, targetKey, opts){
  opts = opts || {};
  const posValue = opts.posValue;
  const lr = opts.lr != null ? opts.lr : 0.5;
  const epochs = opts.epochs || 700;
  const stats = mlFeatureStats(trainRows, featureKeys);
  const X = trainRows.map(r => mlRowToVec(r, featureKeys, stats));
  const y = trainRows.map(r => _mlBin(r[targetKey], posValue));
  const n = X.length, d = featureKeys.length;
  const w = new Array(d).fill(0);
  let b = 0;
  for(let ep = 0; ep < epochs; ep++){
    const gw = new Array(d).fill(0);
    let gb = 0;
    for(let i = 0; i < n; i++){
      let z = b;
      for(let j = 0; j < d; j++) z += w[j] * X[i][j];
      const e = mlSigmoid(z) - y[i];
      for(let j = 0; j < d; j++) gw[j] += e * X[i][j];
      gb += e;
    }
    for(let j = 0; j < d; j++) w[j] -= lr * gw[j] / n;
    b -= lr * gb / n;
  }
  const prob = row => {
    const v = mlRowToVec(row, featureKeys, stats);
    let z = b;
    for(let j = 0; j < d; j++) z += w[j] * v[j];
    return mlSigmoid(z);
  };
  const predict = row => (prob(row) >= 0.5 ? 1 : 0);
  const accuracy = rows => {
    if(!rows.length) return 0;
    let ok = 0;
    for(const r of rows) if(predict(r) === _mlBin(r[targetKey], posValue)) ok++;
    return ok / rows.length;
  };
  return { weights: w, bias: b, stats, prob, predict, accuracy, featureKeys };
}

// ── 다특징 이진 로지스틱 — 단계별 stepper (학습 과정 애니메이션용) ──
//   const st = mlLogisticStepper(train, keys, target, {posValue});
//   st.step() → perStep 에폭 진행. st.iter / st.done / st.trainAcc / st.weights / st.accuracyOn(rows)
function mlLogisticStepper(trainRows, featureKeys, targetKey, opts){
  opts = opts || {};
  const posValue = opts.posValue;
  const lr = opts.lr != null ? opts.lr : 0.5;
  const perStep = opts.perStep || 20;
  const maxEpochs = opts.maxEpochs || 400;
  const stats = mlFeatureStats(trainRows, featureKeys);
  const X = trainRows.map(r => mlRowToVec(r, featureKeys, stats));
  const y = trainRows.map(r => _mlBin(r[targetKey], posValue));
  const n = X.length, d = featureKeys.length;
  const w = new Array(d).fill(0);
  let b = 0;
  const probVec = v => { let z = b; for(let j = 0; j < d; j++) z += w[j] * v[j]; return mlSigmoid(z); };
  const state = {
    iter: 0, done: false, trainAcc: 0, weights: w, bias: 0, featureKeys,
    prob: row => probVec(mlRowToVec(row, featureKeys, stats)),
    predict: row => (probVec(mlRowToVec(row, featureKeys, stats)) >= 0.5 ? 1 : 0),
    accuracyOn: rows => {
      if(!rows.length) return 0;
      let ok = 0;
      for(const r of rows) if(state.predict(r) === _mlBin(r[targetKey], posValue)) ok++;
      return ok / rows.length;
    },
    step,
  };
  function calcTrainAcc(){
    let ok = 0;
    for(let i = 0; i < n; i++) if((probVec(X[i]) >= 0.5 ? 1 : 0) === y[i]) ok++;
    state.trainAcc = ok / n;
  }
  calcTrainAcc();
  function step(){
    if(state.done) return;
    for(let ep = 0; ep < perStep; ep++){
      const gw = new Array(d).fill(0);
      let gb = 0;
      for(let i = 0; i < n; i++){
        const e = probVec(X[i]) - y[i];
        for(let j = 0; j < d; j++) gw[j] += e * X[i][j];
        gb += e;
      }
      for(let j = 0; j < d; j++) w[j] -= lr * gw[j] / n;
      b -= lr * gb / n;
      state.iter++;
    }
    state.bias = b;
    calcTrainAcc();
    if(state.iter >= maxEpochs) state.done = true;
  }
  return state;
}

// ── 다특성 선형회귀 stepper (GD, 시각화용) ──
//   특징·타깃을 [0,1] 정규화해 학습. weights는 정규화 공간 값(상대 비교용).
//   const st = mlLinregStepperMulti(rows, keys, 'record', {perStep:20});
//   st.step() / st.done / st.iter / st.weights / st.trainR2 / st.predict(row) / st.r2On(rows) / st.maeOn(rows)
function mlLinregStepperMulti(trainRows, featureKeys, targetKey, opts){
  opts = opts || {};
  const lr = opts.lr != null ? opts.lr : 0.4;
  const perStep = opts.perStep || 20;
  const maxEpochs = opts.maxEpochs || 500;
  const stats = mlFeatureStats(trainRows, featureKeys);
  const X = trainRows.map(r => mlRowToVec(r, featureKeys, stats));
  let mnY = Infinity, mxY = -Infinity;
  trainRows.forEach(r => { const v = +r[targetKey]; if(v < mnY) mnY = v; if(v > mxY) mxY = v; });
  const ry = (mxY - mnY) || 1;
  const y = trainRows.map(r => (+r[targetKey] - mnY) / ry);
  const n = X.length, d = featureKeys.length;
  const w = new Array(d).fill(0);
  let b = y.reduce((s, v) => s + v, 0) / (n || 1);   // 평균에서 출발
  const predNorm = v => { let z = b; for(let j = 0; j < d; j++) z += w[j] * v[j]; return z; };
  const state = {
    iter: 0, done: false, trainR2: 0, weights: w, featureKeys,
    predict: row => mnY + predNorm(mlRowToVec(row, featureKeys, stats)) * ry,
    r2On: rows => {
      if(!rows.length) return 0;
      const ys = rows.map(r => +r[targetKey]);
      const my = ys.reduce((s, v) => s + v, 0) / ys.length;
      let ssr = 0, sst = 0;
      rows.forEach((r, i) => { const e = state.predict(r) - ys[i]; ssr += e * e; sst += (ys[i] - my) * (ys[i] - my); });
      return sst ? 1 - ssr / sst : 0;
    },
    maeOn: rows => {
      if(!rows.length) return 0;
      let s = 0;
      rows.forEach(r => { s += Math.abs(state.predict(r) - (+r[targetKey])); });
      return s / rows.length;
    },
    step,
  };
  function calcTrainR2(){
    const my = y.reduce((s, v) => s + v, 0) / (n || 1);
    let ssr = 0, sst = 0;
    for(let i = 0; i < n; i++){ const e = predNorm(X[i]) - y[i]; ssr += e * e; sst += (y[i] - my) * (y[i] - my); }
    state.trainR2 = sst ? Math.max(0, 1 - ssr / sst) : 0;
  }
  calcTrainR2();
  function step(){
    if(state.done) return;
    for(let ep = 0; ep < perStep; ep++){
      const gw = new Array(d).fill(0);
      let gb = 0;
      for(let i = 0; i < n; i++){
        const e = predNorm(X[i]) - y[i];
        for(let j = 0; j < d; j++) gw[j] += e * X[i][j];
        gb += e;
      }
      for(let j = 0; j < d; j++) w[j] -= lr * (2 / n) * gw[j];
      b -= lr * (2 / n) * gb;
      state.iter++;
    }
    calcTrainR2();
    if(state.iter >= maxEpochs) state.done = true;
  }
  return state;
}

// ── kNN 분류 정확도 (훈련행으로 학습, 평가행 채점, 정규화 거리) ──
function mlKnnEval(trainRows, evalRows, featureKeys, targetKey, k){
  k = k || 5;
  const stats = mlFeatureStats(trainRows, featureKeys);
  const train = trainRows.map(r => ({ vec: mlRowToVec(r, featureKeys, stats), classId: String(r[targetKey]) }));
  if(!train.length || !evalRows.length) return 0;
  let ok = 0;
  for(const r of evalRows){
    const q = mlRowToVec(r, featureKeys, stats);
    const pred = mlKnnPredict(train, q, Math.min(k, train.length));
    if(pred && pred.classId === String(r[targetKey])) ok++;
  }
  return ok / evalRows.length;
}

// ── kNN 단건 예측 + 이웃 인덱스 (시각화용) ──
//   반환 { pred:classId, neighbors:[trainRows 인덱스...] }
function mlKnnNeighbors(trainRows, row, featureKeys, targetKey, k, stats){
  stats = stats || mlFeatureStats(trainRows, featureKeys);
  const q = mlRowToVec(row, featureKeys, stats);
  const dists = trainRows.map((r, i) => {
    const v = mlRowToVec(r, featureKeys, stats);
    let s = 0;
    for(let j = 0; j < q.length; j++){ const d = v[j] - q[j]; s += d * d; }
    return { i, d: s };
  });
  dists.sort((a, b) => a.d - b.d);
  const top = dists.slice(0, Math.min(k, dists.length));
  const cnt = {};
  top.forEach(t => { const c = String(trainRows[t.i][targetKey]); cnt[c] = (cnt[c] || 0) + 1; });
  let pred = null, bn = -1;
  for(const c in cnt) if(cnt[c] > bn){ bn = cnt[c]; pred = c; }
  return { pred, neighbors: top.map(t => t.i) };
}

// row → 결정 트리 sample({ cls, [featureKey] })
function _mlRowToTreeSample(r, featureKeys, targetKey){
  const o = { cls: String(r[targetKey]) };
  featureKeys.forEach(k => o[k] = +r[k]);
  return o;
}

// ── 분류: 한 split 에서 지정 모델 학습 → 훈련/테스트 정확도 + 모델 객체 ──
function mlClassifyEval(split, featureKeys, targetKey, modelType, opts){
  opts = opts || {};
  const { train, test } = split;
  if(modelType === 'logistic'){
    const m = mlLogisticFitMulti(train, featureKeys, targetKey, opts);
    return { modelType, trainAcc: m.accuracy(train), testAcc: m.accuracy(test), model: m };
  }
  if(modelType === 'knn'){
    const k = opts.k || 5;
    return { modelType, trainAcc: mlKnnEval(train, train, featureKeys, targetKey, k), testAcc: mlKnnEval(train, test, featureKeys, targetKey, k), k };
  }
  // tree (기본)
  const trS = train.map(r => _mlRowToTreeSample(r, featureKeys, targetKey));
  const teS = test.map(r => _mlRowToTreeSample(r, featureKeys, targetKey));
  const node = mlBuildTree(trS, featureKeys, { maxDepth: opts.maxDepth != null ? opts.maxDepth : 4, minLeaf: opts.minLeaf || 2 });
  return { modelType, trainAcc: mlTreeAccuracy(node, trS), testAcc: mlTreeAccuracy(node, teS), model: node };
}

// ── 회귀(1특징): R²·MAE 평가 ──
function mlR2(pairs, a, b){
  if(!pairs.length) return 0;
  const mean = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  let ssRes = 0, ssTot = 0;
  for(const [x, y] of pairs){ const yhat = a * x + b; ssRes += (y - yhat) * (y - yhat); ssTot += (y - mean) * (y - mean); }
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
}
function mlRegressionEval(split, fx, ty){
  const toPairs = rows => rows.map(r => [+r[fx], +r[ty]]);
  const trainPairs = toPairs(split.train), testPairs = toPairs(split.test);
  const fit = mlLinregFit(trainPairs);
  let mae = 0;
  for(const [x, y] of testPairs) mae += Math.abs(y - (fit.a * x + fit.b));
  mae = testPairs.length ? mae / testPairs.length : 0;
  return { a: fit.a, b: fit.b, r2: mlR2(testPairs, fit.a, fit.b), mae, fit, trainPairs, testPairs };
}

// ── 군집: 정규화 → K-Means 수렴 → 순도 + 2D 투영 좌표 ──
function mlClusterEval(rows, featureKeys, k, labelKey, opts){
  opts = opts || {};
  const stats = mlFeatureStats(rows, featureKeys);
  const samples = rows.map(r => ({ vec: mlRowToVec(r, featureKeys, stats), classId: labelKey != null ? String(r[labelKey]) : null }));
  const km = mlKMeansInit(samples, k, { seed: opts.seed || 7 });
  km.assignStep();
  let guard = 0;
  while(guard++ < 60){ km.updateStep(); if(!km.assignStep()) break; }
  const purity = labelKey != null ? mlKMeansPurity(km, samples).purity : null;
  const pts = mlProject2D(samples);   // 산점도 시각화용 (특징 수와 무관하게 2D)
  return { assignments: km.assignments.slice(), centroids: km.centroids.map(c => Array.from(c)), purity, pts, samples, iters: km.iter, k };
}
