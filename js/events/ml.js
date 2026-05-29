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
    // 테스트 풀은 5장만 (학생이 드래그해서 모델에 넣어보는 용도)
    ML_SUP_TEST_POOL = mlGenerateDataset(did, 7, { seedOffset: 500 });
    _mlShuffle(ML_SUP_TEST_POOL.samples);
    ML_SUP_TEST_POOL.samples = ML_SUP_TEST_POOL.samples.slice(0, 5);
    // 그룹 3개 고정 — 학생은 이름만 정하고 카드를 담음 (추가/삭제 없음)
    ML_SUP_CLASSES = [
      { id: 'g1', name: '' },
      { id: 'g2', name: '' },
      { id: 'g3', name: '' },
    ];
    ML_SUP_ACTIVE_CLS = null;
    ML_SUP_LABELS = {};
    ML_SUP_TRAINED = false;
    ML_SUP_TEST_PICK = null;
    ML_SUP_TEST_JUDGED = {};
    ML_SUP_PHASE = 'label';
    render();
    return;
  }

  if(act === 'ml-sup-back'){
    ML_SUP_PHASE = 'pick';
    ML_SUP_DATASET = null;
    ML_SUP_POOL = null;
    ML_SUP_TEST_POOL = null;
    ML_SUP_CLASSES = [];
    ML_SUP_ACTIVE_CLS = null;
    ML_SUP_LABELS = {};
    ML_SUP_TRAINED = false;
    ML_SUP_TEST_PICK = null;
    ML_SUP_TEST_JUDGED = {};
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

  // Phase 3 → Phase 4: 학습 + 테스트로
  if(act === 'ml-sup-train'){
    // 각 클래스에 최소 1장은 있어야
    const clsCnt = {};
    ML_SUP_CLASSES.forEach(c => clsCnt[c.id] = 0);
    Object.values(ML_SUP_LABELS).forEach(cid => { if(clsCnt[cid] != null) clsCnt[cid]++; });
    const empty = ML_SUP_CLASSES.filter(c => clsCnt[c.id] === 0);
    if(empty.length){
      toast(`"${empty[0].name}" 클래스에 카드를 1장 이상 붙여주세요`, 'err');
      return;
    }
    // 학습 데이터 = 라벨이 붙은 카드들만 + classId를 학생 정의 id로
    toast('🧠 학습 중...', 'info');
    setTimeout(() => {
      ML_SUP_TRAINED = true;
      ML_SUP_PHASE = 'test';
      ML_SUP_TEST_PICK = null;
      ML_SUP_TEST_JUDGED = {};
      render();
    }, 600);
    return;
  }

  if(act === 'ml-sup-back-label'){
    ML_SUP_PHASE = 'label';
    ML_SUP_TEST_PICK = null;
    render();
    return;
  }

  // Phase 4: 테스트 카드 클릭(폴백) → 모델 입력칸에 넣기
  if(act === 'ml-sup-test-pick'){
    const idx = parseInt(el.dataset.idx);
    _mlLoadTestCard(idx);
    return;
  }

  // Phase 4: 학생 판정 (맞아/틀려)
  if(act === 'ml-sup-judge'){
    if(!ML_SUP_TEST_PICK) return;
    const j = el.dataset.judge;
    ML_SUP_TEST_JUDGED[ML_SUP_TEST_PICK.idx] = {
      pred: ML_SUP_TEST_PICK.pred,
      judged: j,
    };
    render();
    return;
  }

  // Phase 4 → Phase 5
  if(act === 'ml-sup-finish'){
    if(Object.keys(ML_SUP_TEST_JUDGED).length < 1){
      toast('사진을 1장 이상 테스트하고 판정한 뒤 결과를 볼 수 있어요', 'err');
      return;
    }
    ML_SUP_PHASE = 'done';
    ML_SUP_TEST_PICK = null;
    render();
    return;
  }

  // Phase 5: 다시 흐름
  if(act === 'ml-sup-back-test'){
    ML_SUP_PHASE = 'test';
    ML_SUP_TEST_PICK = null;
    render();
    return;
  }
  if(act === 'ml-sup-relabel'){
    ML_SUP_PHASE = 'label';
    ML_SUP_TEST_PICK = null;
    ML_SUP_TEST_JUDGED = {};
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
    ML_UN_KMEANS = mlKMeansInit(ML_UN_2D, ML_UN_K);
    ML_UN_KMEANS.assignStep();  // 첫 색칠
    render();
    return;
  }

  if(act === 'ml-un-step'){
    if(!ML_UN_KMEANS) return;
    ML_UN_KMEANS.step();
    render();
    return;
  }

  if(act === 'ml-un-run'){
    if(!ML_UN_KMEANS) return;
    let safety = 0;
    while(safety++ < 30){
      ML_UN_KMEANS.updateStep();
      ML_UN_KMEANS.assignStep();
      if(!ML_UN_KMEANS.changed) break;
    }
    toast('수렴 완료!', 'ok');
    render();
    return;
  }

  if(act === 'ml-un-reset'){
    if(!ML_UN_2D) return;
    ML_UN_KMEANS = mlKMeansInit(ML_UN_2D, ML_UN_K);
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

// 비지도: 현재 데이터셋을 2D로 투영하고 K-Means용 샘플/정규화 범위 준비
function _mlBuildUn2D(){
  const samples = ML_UN_DATA.samples;
  const pts = mlProject2D(samples);
  ML_UN_PTS = pts;
  // K-Means용 2D 샘플 (정답 classId 동반 — 정답 공개/순도 계산용)
  ML_UN_2D = samples.map((s, i) => ({ vec: [pts[i][0], pts[i][1]], classId: s.classId, emoji: s.emoji, dataUrl: s.dataUrl }));
  // 정규화 범위
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for(const [x, y] of pts){
    if(x < minX) minX = x; if(x > maxX) maxX = x;
    if(y < minY) minY = y; if(y > maxY) maxY = y;
  }
  // 여유 패딩
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

// 테스트 카드 1장을 모델 입력칸에 넣고 KNN 예측 (드롭/클릭 공용)
function _mlLoadTestCard(idx){
  if(!ML_SUP_TEST_POOL || isNaN(idx)) return;
  const sample = ML_SUP_TEST_POOL.samples[idx];
  if(!sample) return;
  // 학습 샘플 = 라벨 붙은 학습 풀 카드 (classId = 학생 정의 그룹 id)
  const trainSamples = Object.entries(ML_SUP_LABELS).map(([sidx, cid]) => {
    const s = ML_SUP_POOL.samples[parseInt(sidx)];
    return { vec: s.vec, classId: cid, label: ML_SUP_CLASSES.find(c => c.id === cid)?.name || '?' };
  });
  if(!trainSamples.length){ toast('학습 데이터가 없습니다', 'err'); return; }
  const k = Math.min(3, trainSamples.length);
  const pred = mlKnnPredict(trainSamples, sample.vec, k);
  ML_SUP_TEST_PICK = { idx, sample, pred };
  render();
}

// ── 드래그 앤 드롭 ──
//   ① 테스트 사진(data-drag-idx) → 모델 입력칸(data-dropzone)
//   ② 라벨링 풀 사진(data-label-idx) → 그룹 박스(data-group-drop)
let ML_SUP_DRAG_IDX = null;       // 테스트 카드 드래그 중 idx
let ML_SUP_LABEL_DRAG = null;     // 라벨링 풀 카드 드래그 중 idx

document.addEventListener('dragstart', e => {
  const testImg = e.target.closest('[data-drag-idx]');
  if(testImg){
    ML_SUP_DRAG_IDX = parseInt(testImg.dataset.dragIdx);
    if(e.dataTransfer){ e.dataTransfer.effectAllowed = 'copy'; try { e.dataTransfer.setData('text/plain', 't' + ML_SUP_DRAG_IDX); } catch(_){} }
    const card = testImg.closest('.ml-cand-card'); if(card) card.classList.add('dragging');
    return;
  }
  const poolImg = e.target.closest('[data-label-idx]');
  if(poolImg){
    ML_SUP_LABEL_DRAG = parseInt(poolImg.dataset.labelIdx);
    if(e.dataTransfer){ e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'l' + ML_SUP_LABEL_DRAG); } catch(_){} }
    const card = poolImg.closest('.ml-pool-card'); if(card) card.classList.add('dragging');
    return;
  }
});

document.addEventListener('dragend', e => {
  document.querySelectorAll('.ml-cand-card.dragging, .ml-pool-card.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.dragover').forEach(el => el.classList.remove('dragover'));
});

document.addEventListener('dragover', e => {
  const dz = e.target.closest('[data-dropzone], [data-group-drop]');
  if(!dz) return;
  e.preventDefault();
  if(e.dataTransfer) e.dataTransfer.dropEffect = dz.hasAttribute('data-group-drop') ? 'move' : 'copy';
  dz.classList.add('dragover');
});

document.addEventListener('dragleave', e => {
  const dz = e.target.closest('[data-dropzone], [data-group-drop]');
  if(dz && !dz.contains(e.relatedTarget)) dz.classList.remove('dragover');
});

document.addEventListener('drop', e => {
  // 그룹 박스에 떨어뜨린 경우 (라벨링)
  const gbox = e.target.closest('[data-group-drop]');
  if(gbox){
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
    // 담은 그룹을 활성으로 (이어서 클릭으로도 담기 쉽게)
    ML_SUP_ACTIVE_CLS = gbox.dataset.groupDrop;
    render();
    return;
  }
  // 모델 입력칸에 떨어뜨린 경우 (테스트)
  const dz = e.target.closest('[data-dropzone]');
  if(dz){
    e.preventDefault();
    dz.classList.remove('dragover');
    let idx = ML_SUP_DRAG_IDX;
    if(idx == null && e.dataTransfer){
      const t = e.dataTransfer.getData('text/plain');
      if(t && t[0] === 't') idx = parseInt(t.slice(1));
    }
    ML_SUP_DRAG_IDX = null;
    if(idx == null || isNaN(idx)) return;
    _mlLoadTestCard(idx);
    return;
  }
});
