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
