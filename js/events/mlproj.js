/* ═══════════════════════════════════════
   events/mlproj.js — 🧩 AI 프로젝트 매니저 이벤트
   캔버스 조립·연결 검증·학습 애니메이션·예측·저장
═══════════════════════════════════════ */

let _mlpAug = false;   // 데이터 보강 — 분류는 평소 훈련풀 60%, 보강 시 100%

function _mlpActId(){ return MLP_SEL ? 'mlproj-' + MLP_SEL.id : null; }

function _mlpSeedOf(id){
  let h = 0;
  for(let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h || 12345;
}

// 테스트 30% 고정, 분류는 훈련풀 60%↔100% (같은 시험지로 공정 비교)
function _mlpBuildSplit(){
  const scn = MLP_SEL;
  if(!scn || !scn.rows) return;
  const sp = mlTrainTestSplit(scn.rows, 0.7, _mlpSeedOf(scn.id), scn.target ? scn.target.key : null);
  if(scn.task === 'classification'){
    const pool = mlSeededShuffle(sp.train, _mlpSeedOf(scn.id) + 999);
    const train = _mlpAug ? pool : pool.slice(0, Math.ceil(pool.length * 0.6));
    MLP_SPLIT = { train, test: sp.test, poolSize: pool.length };
  } else {
    MLP_SPLIT = { train: sp.train, test: sp.test };
  }
}

function _mlpCvInit(){
  MLP_CV = { placed: {}, edges: [], hyper: { depth: 3, k: 5 }, axes: null };
  MLP_PANEL = null; MLP_LINK = null;
  _mlpAnimStop();
}

// 학습 결과 초기화 (단서/보강 변경 시)
function _mlpResetTrained(){
  MLP_COMPARE = {}; MLP_REG = null; MLP_CLU = null; MLP_PRED = null; MLP_FIT = {};
  _mlpAnimStop();
}

function _mlpAnimStop(){
  if(MLP_ANIM && MLP_ANIM.timer) clearInterval(MLP_ANIM.timer);
  MLP_ANIM = null;
}

// 연결 규칙 — {ok, msg}
function _mlpTryLink(from, to){
  const scn = MLP_SEL, models = _mlpModelIds(scn.task);
  const key = from + '>' + to;
  if(MLP_CV.edges.includes(key)) return { ok: false, msg: '이미 연결돼 있어요!' };
  if(from === 'data'){
    if(to === 'split') return { ok: true };
    if(scn.task === 'clustering' && to === 'kmeans') return { ok: true };
    if(models.includes(to)) return { ok: false, msg: '모델은 ✂️ 나누기에서 나온 훈련 데이터를 받아야 해요 — 시험지(테스트)를 미리 보면 안 되니까요!' };
    return { ok: false, msg: '데이터는 ✂️ 나누기로 연결해요.' };
  }
  if(from === 'split'){
    if(models.includes(to)) return { ok: true };
    if(to === 'predict') return { ok: false, msg: '테스트 데이터는 예측 보기에 자동으로 흘러가요(점선). 모델을 연결해 주세요!' };
    return { ok: false, msg: '나누기는 훈련 데이터를 모델로 보내요.' };
  }
  if(models.includes(from)){
    if(to === 'score' || to === 'predict') return { ok: true, replace: to === 'predict' };
    if(from === 'kmeans' && to === 'groups') return { ok: true };
    return { ok: false, msg: '모델의 결과는 🧪 성적표나 🔍 예측 보기로 보내요.' };
  }
  return { ok: false, msg: '이 방향으로는 연결할 수 없어요.' };
}

/* ─────────────────── 학습 실행/애니메이션 ─────────────────── */

function _mlpAnimRepaint(){
  const z = document.getElementById('mlp-anim-zone');
  if(z && MLP_ANIM) z.innerHTML = _mlpAnimZone(MLP_ANIM.mk);
}

function _mlpGuardLeave(){
  // 화면을 벗어나면 애니 정지 (누수 방지)
  if(ST_TAB !== 'ml' || ML_TAB !== 'project' || MLP_STEP !== 2 || !MLP_SEL){ _mlpAnimStop(); return true; }
  return false;
}

// 트리: 깊이 1→설정값 프레임 + 완료 시 test 채점
function _mlpTrainTree(){
  const scn = MLP_SEL, keys = _mlpFeatKeys();
  const trS = MLP_SPLIT.train.map(r => _mlRowToTreeSample(r, keys, scn.target.key));
  const teS = MLP_SPLIT.test.map(r => _mlRowToTreeSample(r, keys, scn.target.key));
  const D = MLP_CV.hyper.depth;
  const frames = [];
  for(let d = 1; d <= D; d++){
    const tree = mlBuildTree(trS, keys, { maxDepth: d, minLeaf: 2 });
    frames.push({ depth: d, tree, trainAcc: mlTreeAccuracy(tree, trS) });
  }
  const fin = frames[frames.length - 1];
  MLP_ANIM = { mk: 'tree', frames, idx: 0, timer: null };
  MLP_ANIM.timer = setInterval(() => {
    if(_mlpGuardLeave()) return;
    MLP_ANIM.idx++;
    if(MLP_ANIM.idx >= frames.length){
      _mlpAnimStop();
      MLP_FIT.tree = fin.tree;
      MLP_FIT.treeFrames = frames;
      MLP_COMPARE.tree = { trainAcc: fin.trainAcc, testAcc: mlTreeAccuracy(fin.tree, teS) };
      render();
      return;
    }
    _mlpAnimRepaint();
  }, 850);
  _mlpAnimRepaint();
}

// 로지스틱: stepper 곡선
function _mlpTrainLogistic(){
  const scn = MLP_SEL, keys = _mlpFeatKeys();
  const st = mlLogisticStepper(MLP_SPLIT.train, keys, scn.target.key, { posValue: scn.target.posValue, perStep: 20, maxEpochs: 400 });
  MLP_ANIM = { mk: 'logistic', st, pts: [[0, st.trainAcc]], timer: null };
  MLP_ANIM.timer = setInterval(() => {
    if(_mlpGuardLeave()) return;
    st.step();
    MLP_ANIM.pts.push([st.iter, st.trainAcc]);
    if(st.done){
      _mlpAnimStop();
      MLP_FIT.logistic = st;
      MLP_FIT.logiPts = MLP_ANIM ? MLP_ANIM.pts : [[st.iter, st.trainAcc]];
      MLP_COMPARE.logistic = { trainAcc: st.trainAcc, testAcc: st.accuracyOn(MLP_SPLIT.test) };
      render();
      return;
    }
    _mlpAnimRepaint();
  }, 200);
  _mlpAnimRepaint();
}

// kNN: 테스트 케이스 순차 판정 애니
function _mlpTrainKnn(){
  const scn = MLP_SEL, keys = _mlpFeatKeys();
  const k = MLP_CV.hyper.k;
  const stats = mlFeatureStats(MLP_SPLIT.train, keys);
  const test = MLP_SPLIT.test;
  MLP_ANIM = { mk: 'knn', i: 0, okN: 0, ngN: 0, cur: null, timer: null, stats, k };
  const judge = (i) => {
    const row = test[i];
    const r = mlKnnNeighbors(MLP_SPLIT.train, row, keys, scn.target.key, k, stats);
    const ok = r.pred === String(row[scn.target.key]);
    return { row, neighbors: r.neighbors, pred: r.pred, ok };
  };
  MLP_ANIM.timer = setInterval(() => {
    if(_mlpGuardLeave()) return;
    if(MLP_ANIM.i >= test.length){
      const okN = MLP_ANIM.okN, ngN = MLP_ANIM.ngN;
      _mlpAnimStop();
      MLP_FIT.knn = { stats, k, okN, ngN, i: test.length };
      MLP_COMPARE.knn = { trainAcc: mlKnnEval(MLP_SPLIT.train, MLP_SPLIT.train, keys, scn.target.key, k), testAcc: okN / test.length };
      render();
      return;
    }
    const c = judge(MLP_ANIM.i);
    MLP_ANIM.cur = c;
    if(c.ok) MLP_ANIM.okN++; else MLP_ANIM.ngN++;
    MLP_ANIM.i++;
    _mlpAnimRepaint();
  }, 380);
  _mlpAnimRepaint();
}

// 선형회귀: 경사하강 직선 애니
function _mlpTrainLinreg(){
  const scn = MLP_SEL, cfg = scn.regression;
  const pairs = MLP_SPLIT.train.map(r => [+r[cfg.x], +r[cfg.y]]);
  const gd = mlLinregGD(pairs, { perStep: 6 });
  MLP_ANIM = { mk: 'linreg', gd, timer: null };
  MLP_ANIM.timer = setInterval(() => {
    if(_mlpGuardLeave()) return;
    gd.step();
    if(gd.done){
      _mlpAnimStop();
      MLP_FIT.linreg = gd;
      MLP_REG = mlRegressionEval(MLP_SPLIT, cfg.x, cfg.y);
      render();
      return;
    }
    _mlpAnimRepaint();
  }, 160);
  _mlpAnimRepaint();
}

// k-평균: 중심 이동 애니
function _mlpTrainKmeans(){
  const scn = MLP_SEL, keys = scn.features.map(f => f.key);
  const stats = mlFeatureStats(scn.rows, keys);
  const samples = scn.rows.map(r => ({ vec: mlRowToVec(r, keys, stats), classId: scn.cluster.labelKey ? String(r[scn.cluster.labelKey]) : null }));
  const km = mlKMeansInit(samples, scn.cluster.k || 3, { seed: _mlpSeedOf(scn.id), init: 'center' });
  km.assignStep();
  MLP_ANIM = { mk: 'kmeans', km, stable: 0, timer: null };
  MLP_ANIM.timer = setInterval(() => {
    if(_mlpGuardLeave()) return;
    km.step();
    if(km.phase === 'assign' && !km.changed) MLP_ANIM.stable++;
    else MLP_ANIM.stable = 0;
    if(MLP_ANIM.stable >= 1 || km.iter > 40){
      _mlpAnimStop();
      _mlpFinishKmeans(km, samples, keys);
      render();
      return;
    }
    _mlpAnimRepaint();
  }, 700);
  _mlpAnimRepaint();
}

function _mlpFinishKmeans(km, samples, keys){
  const scn = MLP_SEL;
  const purity = mlKMeansPurity(km, samples).purity;
  const k = scn.cluster.k || 3;
  const stats = Array.from({ length: k }, () => ({ n: 0, sums: keys.map(() => 0) }));
  scn.rows.forEach((r, i) => {
    const g = km.assignments[i];
    if(g < 0 || g >= k) return;
    stats[g].n++;
    keys.forEach((fk, j) => stats[g].sums[j] += +r[fk]);
  });
  MLP_CLU = {
    assignments: km.assignments.slice(), purity, k, iters: km.iter,
    groupStats: stats.map(s => ({ n: s.n, means: s.sums.map(v => s.n ? v / s.n : 0) })),
  };
  MLP_FIT.kmeans = { assignments: MLP_CLU.assignments, centroids: km.centroids.map(c => Array.from(c)) };
}

// 즉시 완료 (⏭ 끝까지)
function _mlpAnimFinish(){
  if(!MLP_ANIM) return;
  const mk = MLP_ANIM.mk;
  const scn = MLP_SEL, keys = _mlpFeatKeys();
  if(mk === 'tree'){
    const frames = MLP_ANIM.frames, fin = frames[frames.length - 1];
    const teS = MLP_SPLIT.test.map(r => _mlRowToTreeSample(r, keys, scn.target.key));
    _mlpAnimStop();
    MLP_FIT.tree = fin.tree; MLP_FIT.treeFrames = frames;
    MLP_COMPARE.tree = { trainAcc: fin.trainAcc, testAcc: mlTreeAccuracy(fin.tree, teS) };
  } else if(mk === 'logistic'){
    const st = MLP_ANIM.st;
    const pts = MLP_ANIM.pts;
    while(!st.done){ st.step(); pts.push([st.iter, st.trainAcc]); }
    _mlpAnimStop();
    MLP_FIT.logistic = st; MLP_FIT.logiPts = pts;
    MLP_COMPARE.logistic = { trainAcc: st.trainAcc, testAcc: st.accuracyOn(MLP_SPLIT.test) };
  } else if(mk === 'knn'){
    const { stats, k } = MLP_ANIM;
    let okN = MLP_ANIM.okN;
    for(let i = MLP_ANIM.i; i < MLP_SPLIT.test.length; i++){
      const row = MLP_SPLIT.test[i];
      const r = mlKnnNeighbors(MLP_SPLIT.train, row, keys, scn.target.key, k, stats);
      if(r.pred === String(row[scn.target.key])) okN++;
    }
    _mlpAnimStop();
    MLP_FIT.knn = { stats, k, okN, ngN: MLP_SPLIT.test.length - okN, i: MLP_SPLIT.test.length };
    MLP_COMPARE.knn = { trainAcc: mlKnnEval(MLP_SPLIT.train, MLP_SPLIT.train, keys, scn.target.key, k), testAcc: okN / MLP_SPLIT.test.length };
  } else if(mk === 'linreg'){
    const gd = MLP_ANIM.gd;
    while(!gd.done) gd.step();
    _mlpAnimStop();
    MLP_FIT.linreg = gd;
    MLP_REG = mlRegressionEval(MLP_SPLIT, scn.regression.x, scn.regression.y);
  } else if(mk === 'kmeans'){
    const km = MLP_ANIM.km;
    let guard = 0;
    while(guard++ < 60){ km.updateStep(); if(!km.assignStep()) break; }
    const stats = mlFeatureStats(scn.rows, scn.features.map(f => f.key));
    const samples = scn.rows.map(r => ({ vec: mlRowToVec(r, scn.features.map(f => f.key), stats), classId: scn.cluster.labelKey ? String(r[scn.cluster.labelKey]) : null }));
    _mlpAnimStop();
    _mlpFinishKmeans(km, samples, scn.features.map(f => f.key));
  }
  render();
}

/* ─────────────────── 예측 실행 ─────────────────── */

function _mlpPredFn(mk){
  const scn = MLP_SEL, keys = _mlpFeatKeys();
  if(mk === 'tree' && MLP_FIT.tree){
    return row => {
      const pred = mlTreePredict(MLP_FIT.tree, _mlRowToTreeSample(row, keys, scn.target.key));
      return { predBin: _mlBin(pred, scn.target.posValue), };
    };
  }
  if(mk === 'logistic' && MLP_FIT.logistic){
    return row => ({ predBin: MLP_FIT.logistic.predict(row) });
  }
  if(mk === 'knn' && MLP_FIT.knn){
    return row => {
      const r = mlKnnNeighbors(MLP_SPLIT.train, row, keys, scn.target.key, MLP_FIT.knn.k, MLP_FIT.knn.stats);
      return { predBin: _mlBin(r.pred, scn.target.posValue) };
    };
  }
  return null;
}

function _mlpPredictRun(mk){
  const scn = MLP_SEL;
  if(scn.task === 'regression'){
    if(!MLP_REG) return false;
    const cfg = scn.regression;
    const list = MLP_SPLIT.test.map(row => {
      const pred = MLP_REG.a * (+row[cfg.x]) + MLP_REG.b;
      return { row, pred, err: pred - (+row[cfg.y]) };
    });
    const maeAvg = list.reduce((s, c) => s + Math.abs(c.err), 0) / (list.length || 1);
    const wrong = list.slice().sort((a, b) => Math.abs(b.err) - Math.abs(a.err)).slice(0, 2);
    MLP_PRED = { model: 'linreg', list, wrong, maeAvg, acc: Math.max(0, MLP_REG.r2) };
    return true;
  }
  const fn = _mlpPredFn(mk);
  if(!fn) return false;
  const list = MLP_SPLIT.test.map(row => {
    const p = fn(row);
    const actual = _mlBin(row[scn.target.key], scn.target.posValue);
    const ok = p.predBin === actual;
    return { row, ok, predLabel: p.predBin ? scn.target.posLabel : scn.target.negLabel };
  });
  const wrong = list.filter(c => !c.ok).slice(0, 3);
  MLP_PRED = { model: mk, list, wrong, acc: list.filter(c => c.ok).length / (list.length || 1) };
  return true;
}

/* ─────────────────── 저장 ─────────────────── */

async function _mlpSaveNow(silent){
  if(!SEL_CLS || !ST_USER || !MLP_SEL) return;
  if(MLP_SAVING) return;
  MLP_SAVING = 'save';
  if(!silent) render();
  try {
    const saved = await saveAiaSubmission(SEL_CLS.id, _mlpActId(), ST_USER.number, MLP_ANSWERS);
    MLP_SUB = saved;
    if(!silent) toast('💾 저장됐어요', 'ok');
  } catch(err){
    console.error(err);
    if(!silent) toast('저장 실패: ' + (err.message || err), 'err');
  } finally {
    MLP_SAVING = false;
    if(!silent) render();
  }
}
function _mlpQueueSave(){
  if(MLP_SAVE_TIMER) clearTimeout(MLP_SAVE_TIMER);
  MLP_SAVE_TIMER = setTimeout(() => { _mlpSaveNow(true); }, 1500);
}

/* ─────────────────── 클릭 이벤트 ─────────────────── */

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset.action;

  /* ── 학생: 문제 선택/뒤로 ── */
  if(act === 'mlp-pick'){
    const scn = mlpById(el.dataset.id);
    if(!scn || !SEL_CLS || !ST_USER) return;
    MLP_SEL = scn;
    MLP_STEP = 1;
    MLP_ANSWERS = {}; MLP_SUB = null; MLP_GOAL_TRIES = [];
    MLP_SPLIT = null; MLP_COMPARE = {}; MLP_REG = null; MLP_CLU = null; MLP_PRED = null; MLP_FIT = {};
    MLP_CV = null; MLP_PANEL = null; MLP_LINK = null;
    _mlpAug = false;
    _mlpAnimStop();
    MLP_SAVING = false;
    if(MLP_SAVE_TIMER){ clearTimeout(MLP_SAVE_TIMER); MLP_SAVE_TIMER = null; }
    MLP_LOADING = true;
    render();
    try {
      const sub = await loadAiaSubmission(SEL_CLS.id, 'mlproj-' + scn.id, ST_USER.number);
      MLP_SUB = sub;
      if(sub && sub.answers) MLP_ANSWERS = { ...sub.answers };
    } catch(err){ console.warn('[MLP] 기록 로드 실패:', err.message || err); }
    MLP_LOADING = false;
    render();
    return;
  }

  if(act === 'mlp-back'){
    _mlpAnimStop();
    MLP_SEL = null; MLP_ANSWERS = {}; MLP_SUB = null; MLP_GOAL_TRIES = [];
    MLP_SPLIT = null; MLP_COMPARE = {}; MLP_REG = null; MLP_CLU = null; MLP_PRED = null; MLP_FIT = {};
    MLP_CV = null; MLP_PANEL = null; MLP_LINK = null;
    if(MLP_SAVE_TIMER){ clearTimeout(MLP_SAVE_TIMER); MLP_SAVE_TIMER = null; }
    render();
    return;
  }

  /* ── ① 문제 정의 ── */
  if(act === 'mlp-goal'){
    if(!MLP_SEL || !MLP_SEL.goalQuiz) return;
    const id = el.dataset.id;
    const opt = MLP_SEL.goalQuiz.options.find(o => o.id === id);
    if(!opt) return;
    MLP_GOAL_TRIES.push(id);
    if(opt.good){ MLP_ANSWERS.goalPick = id; _mlpQueueSave(); }
    render();
    return;
  }

  if(act === 'mlp-feat'){
    if(!MLP_SEL) return;
    const k = el.dataset.k;
    let arr = Array.isArray(MLP_ANSWERS.featPick) ? MLP_ANSWERS.featPick.slice() : [];
    if(arr.includes(k)) arr = arr.filter(x => x !== k);
    else arr.push(k);
    MLP_ANSWERS.featPick = arr;
    if(_mlpTrainedCount() || MLP_REG){ _mlpResetTrained(); toast('단서가 바뀌어 학습 결과를 비웠어요 — 다시 학습해 보세요!', 'info'); }
    _mlpQueueSave();
    render();
    return;
  }

  if(act === 'mlp-need'){
    if(!MLP_SEL) return;
    MLP_ANSWERS.need = el.dataset.need;
    _mlpQueueSave();
    render();
    return;
  }

  if(act === 'mlp-def-done'){
    const scn = MLP_SEL;
    if(!scn) return;
    if(!scn.mlNeeded){
      if(MLP_ANSWERS.need !== scn.define.mlAnswer) return;
      MLP_STEP = 5;
      _mlpQueueSave();
      render();
      return;
    }
    const okGoal = !!MLP_ANSWERS.goalPick;
    const okFeat = Array.isArray(MLP_ANSWERS.featPick) && MLP_ANSWERS.featPick.length > 0;
    if(!okGoal || !okFeat || MLP_ANSWERS.need !== scn.define.mlAnswer) return;
    MLP_STEP = 2;
    if(!MLP_CV) _mlpCvInit();
    _mlpBuildSplit();
    _mlpQueueSave();
    render();
    return;
  }

  if(act === 'mlp-step'){
    if(!MLP_SEL) return;
    const s = parseInt(el.dataset.s);
    if(!isNaN(s)){
      _mlpAnimStop();
      MLP_STEP = s;
      if(s === 2 && !MLP_CV){ _mlpCvInit(); _mlpBuildSplit(); }
    }
    render();
    return;
  }

  /* ── ②~④ 캔버스 ── */
  if(act === 'mlp-cv-add'){
    if(!MLP_CV) return;
    const w = el.dataset.w;
    MLP_CV.placed[w] = true;
    MLP_PANEL = null;
    render();
    return;
  }

  if(act === 'mlp-cv-port'){
    if(!MLP_CV) return;
    MLP_LINK = el.dataset.w;
    render();
    return;
  }

  if(act === 'mlp-cv-cancel'){ MLP_LINK = null; render(); return; }

  if(act === 'mlp-cv-node'){
    if(!MLP_CV) return;
    const w = el.dataset.w;
    if(MLP_LINK && MLP_LINK !== w){
      const r = _mlpTryLink(MLP_LINK, w);
      if(!r.ok){ toast(r.msg, 'err'); return; }
      if(r.replace) MLP_CV.edges = MLP_CV.edges.filter(ed => !ed.endsWith('>' + w) || !_mlpModelIds(MLP_SEL.task).includes(ed.split('>')[0]));
      MLP_CV.edges.push(MLP_LINK + '>' + w);
      const from = MLP_LINK;
      MLP_LINK = null;
      if(w === 'predict' && MLP_PRED && MLP_PRED.model !== from) MLP_PRED = null;
      toast('🔗 연결!', 'ok');
      render();
      return;
    }
    if(MLP_LINK === w){ MLP_LINK = null; render(); return; }
    MLP_PANEL = (MLP_PANEL === w) ? null : w;
    render();
    return;
  }

  if(act === 'mlp-panel-close'){ MLP_PANEL = null; _mlpAnimStop(); render(); return; }

  if(act === 'mlp-cv-aug'){
    if(!MLP_SEL || MLP_SEL.task !== 'classification') return;
    const before = MLP_SPLIT ? MLP_SPLIT.train.length : 0;
    _mlpAug = !_mlpAug;
    _mlpBuildSplit();
    _mlpResetTrained();
    toast(_mlpAug
      ? `💧 훈련 데이터 ${before}명 → ${MLP_SPLIT.train.length}명! 같은 테스트로 공정 비교 — 다시 학습해 보세요`
      : `훈련 데이터를 원래(${MLP_SPLIT.train.length}명)대로 — 다시 학습해 보세요`, 'info');
    render();
    return;
  }

  if(act === 'mlp-hp-k'){
    if(!MLP_CV) return;
    MLP_CV.hyper.k = parseInt(el.dataset.k) || 5;
    if(MLP_COMPARE.knn){ delete MLP_COMPARE.knn; delete MLP_FIT.knn; if(MLP_PRED && MLP_PRED.model === 'knn') MLP_PRED = null; }
    render();
    return;
  }

  if(act === 'mlp-train'){
    const scn = MLP_SEL;
    if(!scn || !MLP_CV || MLP_ANIM) return;
    const mk = el.dataset.mk;
    const connected = scn.task === 'clustering' ? _mlpHasEdge('data', mk) : _mlpHasEdge('split', mk);
    if(!connected){ toast('먼저 데이터를 연결해 주세요', 'err'); return; }
    if(!MLP_SPLIT) _mlpBuildSplit();
    if(mk === 'tree'){ delete MLP_COMPARE.tree; _mlpTrainTree(); }
    else if(mk === 'logistic'){ delete MLP_COMPARE.logistic; _mlpTrainLogistic(); }
    else if(mk === 'knn'){ delete MLP_COMPARE.knn; _mlpTrainKnn(); }
    else if(mk === 'linreg'){ MLP_REG = null; _mlpTrainLinreg(); }
    else if(mk === 'kmeans'){ MLP_CLU = null; _mlpTrainKmeans(); }
    render();
    return;
  }

  if(act === 'mlp-train-skip'){ _mlpAnimFinish(); return; }

  if(act === 'mlp-predict-run'){
    const models = _mlpModelInto('predict');
    const mk = MLP_SEL.task === 'regression' ? 'linreg' : (models.length ? models[models.length - 1] : null);
    if(!mk){ toast('모델을 예측 보기에 연결해 주세요', 'err'); return; }
    if(!_mlpPredictRun(mk)){ toast('먼저 모델을 학습시켜 주세요', 'err'); return; }
    render();
    return;
  }

  /* ── 성찰 전환 (최종 기록 확정) ── */
  if(act === 'mlp-to-reflect'){
    const scn = MLP_SEL;
    if(!scn || !_mlpCanReflect()) return;
    if(scn.task === 'classification'){
      const cand = _mlpModelInto('score').filter(m => MLP_COMPARE[m]);
      const best = cand.reduce((a, b) => MLP_COMPARE[a].testAcc >= MLP_COMPARE[b].testAcc ? a : b);
      MLP_ANSWERS.finalModelKey = best;
      MLP_ANSWERS.finalAcc = MLP_COMPARE[best].testAcc;
      MLP_ANSWERS.runsLog = Object.keys(MLP_COMPARE).map(mk => ({ model: mk, testAcc: MLP_COMPARE[mk].testAcc }));
      // 오답 재료 확보 — 예측을 안 돌렸으면 최선 모델로 자동 실행
      if(!MLP_PRED) _mlpPredictRun(_mlpModelInto('predict').slice(-1)[0] || best);
    } else if(scn.task === 'regression'){
      MLP_ANSWERS.finalModelKey = 'linreg';
      MLP_ANSWERS.finalAcc = Math.max(0, Math.min(1, MLP_REG.r2));
      MLP_ANSWERS.runsLog = [{ model: 'linreg', testAcc: MLP_ANSWERS.finalAcc }];
      if(!MLP_PRED) _mlpPredictRun('linreg');
    } else {
      MLP_ANSWERS.finalModelKey = 'kmeans';
      MLP_ANSWERS.finalAcc = MLP_CLU.purity;
      MLP_ANSWERS.runsLog = [{ model: 'kmeans', testAcc: MLP_CLU.purity }];
    }
    _mlpAnimStop();
    MLP_STEP = 5;
    _mlpQueueSave();
    render();
    return;
  }

  /* ── 저장/제출 ── */
  if(act === 'mlp-save'){ await _mlpSaveNow(false); return; }

  if(act === 'mlp-submit'){
    if(!SEL_CLS || !ST_USER || !MLP_SEL) return;
    if(MLP_SAVING) return;
    const scn = MLP_SEL;
    const textKeys = ['needWhy', 'modelWhy', ...(scn.reflectPrompts || []).map(p => p.id)];
    const hasAny = MLP_ANSWERS.need || textKeys.some(k => (MLP_ANSWERS[k] || '').trim());
    if(!hasAny){ toast('아직 작성한 내용이 없어요. 판단·근거를 채운 뒤 제출해주세요.', 'err'); return; }
    const already = !!MLP_SUB?.submittedAt;
    if(!confirm(already ? '이미 제출했어요. 다시 제출할까요? (현재 내용으로 갱신됩니다)' : '지금까지 작성한 내용으로 제출할까요? (제출 후에도 수정 가능합니다)')) return;
    MLP_SAVING = 'submit';
    if(MLP_SAVE_TIMER){ clearTimeout(MLP_SAVE_TIMER); MLP_SAVE_TIMER = null; }
    render();
    try {
      const saved = await saveAiaSubmission(SEL_CLS.id, 'mlproj-' + scn.id, ST_USER.number, MLP_ANSWERS, { submit: true });
      MLP_SUB = saved;
      toast('📤 제출했어요!', 'ok');
    } catch(err){ console.error(err); toast('제출 실패: ' + (err.message || err), 'err'); }
    finally { MLP_SAVING = false; render(); }
    return;
  }

  /* ── 선생님: 기록 열람 ── */
  if(act === 'mlp-tc-pick'){
    const scn = mlpById(el.dataset.id);
    if(!scn || !TC_CLS) return;
    MLP_TC_SEL = scn;
    MLP_TC_VIEW = 'list';
    MLP_TC_SNUM = null;
    MLP_ALL_SUBS = {};
    render();
    try { MLP_ALL_SUBS = await loadAllAiaSubmissions(TC_CLS.id, 'mlproj-' + scn.id); }
    catch(err){ console.warn('[MLP] 전체 기록 로드 실패:', err.message || err); }
    render();
    return;
  }
  if(act === 'mlp-tc-back'){ MLP_TC_SEL = null; MLP_TC_SNUM = null; MLP_ALL_SUBS = {}; render(); return; }
  if(act === 'mlp-tc-view'){ MLP_TC_SNUM = el.dataset.snum; MLP_TC_VIEW = 'student'; render(); return; }
  if(act === 'mlp-tc-back-list'){ MLP_TC_VIEW = 'list'; MLP_TC_SNUM = null; render(); return; }
  if(act === 'mlp-tc-export'){ _mlpExportCSV(); return; }
});

/* ─────────────────── input/change ─────────────────── */

// 근거·성찰 textarea (debounce 자동 저장, 렌더 X → 포커스 유지)
document.addEventListener('input', e => {
  const el = e.target.closest('[data-action="mlp-input"]');
  if(el){
    const fid = el.dataset.fid;
    if(!fid || !MLP_SEL) return;
    MLP_ANSWERS[fid] = el.value;
    _mlpQueueSave();
    return;
  }
  // 트리 깊이 슬라이더 — 값만 갱신, 손 뗐을 때(change) 반영
  const dp = e.target.closest('[data-action="mlp-hp-depth"]');
  if(dp && MLP_CV){
    MLP_CV.hyper.depth = parseInt(dp.value) || 3;
    const b = dp.parentElement && dp.parentElement.querySelector('b');
    if(b) b.textContent = MLP_CV.hyper.depth;
  }
});

document.addEventListener('change', e => {
  const dp = e.target.closest('[data-action="mlp-hp-depth"]');
  if(dp && MLP_CV){
    MLP_CV.hyper.depth = parseInt(dp.value) || 3;
    if(MLP_COMPARE.tree){ delete MLP_COMPARE.tree; delete MLP_FIT.tree; delete MLP_FIT.treeFrames; if(MLP_PRED && MLP_PRED.model === 'tree') MLP_PRED = null; }
    render();
    return;
  }
  const ax = e.target.closest('[data-action="mlp-ax"]');
  if(ax && MLP_CV){
    if(!MLP_CV.axes){
      const ks = _mlpFeatKeys();
      MLP_CV.axes = { x: ks[0], y: ks[1] || ks[0] };
    }
    MLP_CV.axes[ax.dataset.which] = ax.value;
    if(!MLP_ANIM) render();
    else { MLP_CV.axes[ax.dataset.which] = ax.value; _mlpAnimRepaint(); }
    return;
  }
});

/* ─────────────────── CSV ─────────────────── */

function _mlpExportCSV(){
  if(!TC_CLS || !MLP_TC_SEL) return;
  const scn = MLP_TC_SEL;
  const cols = [];
  if(scn.goalQuiz) cols.push(['goalPick', '해결목표']);
  if(scn.task === 'classification') cols.push(['featPick', '고른단서']);
  cols.push(['need', 'ML필요판단'], ['needWhy', 'ML판단근거']);
  if(scn.mlNeeded){
    cols.push(['modelWhy', '모델선택근거'], ['finalModelKey', '최종모델'],
      ['finalAcc', _mlpMetricLabel(scn)], ['runsLog', '시도한모델']);
  }
  (scn.reflectPrompts || []).forEach(p => cols.push([p.id, p.label]));
  const header = ['학번', '이름', ...cols.map(c => c[1]), '제출시각', '마지막수정'];
  const rows = [header];
  for(const st of STUDENTS){
    const sub = MLP_ALL_SUBS[st.number];
    const a = sub?.answers || {};
    const row = [st.number, st.name];
    for(const [key] of cols){
      let v = a[key];
      if(key === 'goalPick') v = scn.goalQuiz ? (scn.goalQuiz.options.find(o => o.id === v)?.label || '') : '';
      else if(key === 'featPick') v = Array.isArray(v) ? v.map(k => _mlpFeatLabel(scn, k)).join('/') : '';
      else if(key === 'need') v = v === 'ml' ? '기계학습' : (v === 'rule' ? '그냥프로그래밍' : '');
      else if(key === 'finalModelKey') v = MLP_MODELS[v] ? MLP_MODELS[v].label : '';
      else if(key === 'finalAcc') v = (v != null ? Math.round(v * 100) + '%' : '');
      else if(key === 'runsLog') v = Array.isArray(v) ? v.map(r => `${MLP_MODELS[r.model]?.label || r.model} ${Math.round(r.testAcc * 100)}%`).join(' / ') : '';
      else v = v || '';
      row.push(v);
    }
    row.push(sub?.submittedAt ? fmtDt(sub.submittedAt) : '');
    row.push(sub?.updatedAt ? fmtDt(sub.updatedAt) : '');
    rows.push(row);
  }
  const csv = '﻿' + rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a2 = document.createElement('a');
  a2.href = url;
  a2.download = `AI프로젝트_${scn.id}_${TC_CLS.id}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a2);
  a2.click();
  document.body.removeChild(a2);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('CSV 내보내기 완료', 'ok');
}
