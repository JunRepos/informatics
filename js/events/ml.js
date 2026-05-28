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
    // 공용 풀 20장 (클래스당 5장). TM식이라 전부 담을 필요 없음.
    ML_SUP_POOL = mlGenerateDataset(did, 5, { seedOffset: 0 });
    _mlShuffle(ML_SUP_POOL.samples);
    // 테스트 풀은 5장만 (학생이 드래그해서 모델에 넣어보는 용도)
    ML_SUP_TEST_POOL = mlGenerateDataset(did, 7, { seedOffset: 500 });
    _mlShuffle(ML_SUP_TEST_POOL.samples);
    ML_SUP_TEST_POOL.samples = ML_SUP_TEST_POOL.samples.slice(0, 5);
    // 클래스는 빈 상태로 시작 — 학생이 데이터를 보고 직접 만듦
    ML_SUP_CLASSES = [];
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

  // 그룹 추가: 빈 editing 상태로 추가, 입력 받음
  if(act === 'ml-sup-cls-add'){
    if(ML_SUP_CLASSES.length >= 5) return;
    const newCls = { id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6), name: '', editing: true };
    ML_SUP_CLASSES.push(newCls);
    // 새로 만든 그룹을 활성으로 만들지는 않음 (이름 먼저 정해야 의미 있음)
    render();
    // input에 포커스 (autofocus는 첫 렌더에서만 동작하므로 명시적으로)
    setTimeout(() => {
      const inp = document.querySelector(`[data-action="ml-sup-cls-name"][data-cid="${newCls.id}"]`);
      if(inp){ inp.focus(); inp.select(); }
    }, 30);
    return;
  }

  // 그룹 이름 편집 진입 (이름 부분 클릭)
  if(act === 'ml-sup-cls-edit'){
    const cid = el.dataset.cid;
    const c = ML_SUP_CLASSES.find(c => c.id === cid);
    if(!c) return;
    c.editing = true;
    render();
    setTimeout(() => {
      const inp = document.querySelector(`[data-action="ml-sup-cls-name"][data-cid="${cid}"]`);
      if(inp){ inp.focus(); inp.select(); }
    }, 30);
    return;
  }

  if(act === 'ml-sup-cls-del'){
    const cid = el.dataset.cid;
    const c = ML_SUP_CLASSES.find(c => c.id === cid);
    if(!c) return;
    // 라벨이 있는 그룹은 확인
    const has = Object.values(ML_SUP_LABELS).includes(cid);
    if(has && !confirm(`"${c.name || '이 그룹'}"을 삭제할까요? 이 그룹에 붙인 라벨도 함께 사라져요.`)) return;
    ML_SUP_CLASSES = ML_SUP_CLASSES.filter(x => x.id !== cid);
    Object.keys(ML_SUP_LABELS).forEach(k => { if(ML_SUP_LABELS[k] === cid) delete ML_SUP_LABELS[k]; });
    if(ML_SUP_ACTIVE_CLS === cid) ML_SUP_ACTIVE_CLS = null;
    render();
    return;
  }

  // 활성 그룹 선택 (편집 모드가 아닌 칩 클릭)
  if(act === 'ml-sup-cls-pick'){
    const cid = el.dataset.cid;
    const c = ML_SUP_CLASSES.find(c => c.id === cid);
    if(!c || c.editing) return;
    if(!(c.name || '').trim()){
      toast('이 그룹은 아직 이름이 없어요', 'err');
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

  /* ── 비지도학습 ── */
  if(act === 'ml-un-pick'){
    const did = el.dataset.did;
    const ds = mlDatasetById(did);
    if(!ds) return;
    ML_UN_DATASET = ds;
    // 클래스당 8장 정도 (총 ~32장이 화면에 보이기 좋음)
    ML_UN_DATA = mlGenerateDataset(did, 8, { seedOffset: 100 });
    ML_UN_KMEANS = null;
    ML_UN_K = ds.classes.length;  // 기본은 정답 클래스 수와 같게
    ML_UN_REVEAL = false;
    if(ML_UN_AUTO_TIMER){ clearInterval(ML_UN_AUTO_TIMER); ML_UN_AUTO_TIMER = null; }
    ML_UN_PHASE = 'run';
    render();
    return;
  }

  if(act === 'ml-un-back'){
    ML_UN_PHASE = 'pick';
    ML_UN_DATASET = null;
    ML_UN_DATA = null;
    ML_UN_KMEANS = null;
    ML_UN_REVEAL = false;
    if(ML_UN_AUTO_TIMER){ clearInterval(ML_UN_AUTO_TIMER); ML_UN_AUTO_TIMER = null; }
    render();
    return;
  }

  if(act === 'ml-un-start'){
    if(!ML_UN_DATA) return;
    ML_UN_KMEANS = mlKMeansInit(ML_UN_DATA.samples, ML_UN_K);
    // 첫 assignStep을 바로 돌려서 첫 그룹화 한 번 보여줌
    ML_UN_KMEANS.assignStep();
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
    // 끝까지 (수렴할 때까지 최대 20회)
    let safety = 0;
    while(safety++ < 20){
      ML_UN_KMEANS.updateStep();
      ML_UN_KMEANS.assignStep();
      if(!ML_UN_KMEANS.changed) break;
    }
    toast('수렴 완료!', 'ok');
    render();
    return;
  }

  if(act === 'ml-un-reset'){
    if(!ML_UN_DATA) return;
    ML_UN_KMEANS = mlKMeansInit(ML_UN_DATA.samples, ML_UN_K);
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
});

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

// 그룹 이름 input blur — editing 종료. 빈 이름이면 그룹 삭제.
document.addEventListener('blur', e => {
  const el = e.target.closest && e.target.closest('[data-action="ml-sup-cls-name"]');
  if(!el) return;
  const cid = el.dataset.cid;
  const c = ML_SUP_CLASSES.find(c => c.id === cid);
  if(!c) return;
  const name = (c.name || '').trim();
  if(!name){
    // 빈 이름: 그룹 자동 삭제 (라벨도 정리)
    ML_SUP_CLASSES = ML_SUP_CLASSES.filter(x => x.id !== cid);
    Object.keys(ML_SUP_LABELS).forEach(k => { if(ML_SUP_LABELS[k] === cid) delete ML_SUP_LABELS[k]; });
    if(ML_SUP_ACTIVE_CLS === cid) ML_SUP_ACTIVE_CLS = null;
  } else {
    // 중복 체크 (자기 자신 제외)
    const dup = ML_SUP_CLASSES.some(x => x.id !== cid && (x.name || '').trim() === name);
    if(dup){
      toast('같은 이름의 그룹이 이미 있어요', 'err');
      el.focus();
      return;
    }
    c.name = name;
    c.editing = false;
    // 이름을 처음 정한 그룹은 자동으로 활성 그룹으로
    if(!ML_SUP_ACTIVE_CLS) ML_SUP_ACTIVE_CLS = cid;
  }
  render();
}, true);  // capture phase

// Enter / Escape 키 처리
document.addEventListener('keydown', e => {
  const el = e.target.closest && e.target.closest('[data-action="ml-sup-cls-name"]');
  if(!el) return;
  if(e.key === 'Enter'){ e.preventDefault(); el.blur(); }
  else if(e.key === 'Escape'){
    // 취소: editing 해제, 이름이 비어있으면 그룹 삭제
    const cid = el.dataset.cid;
    const c = ML_SUP_CLASSES.find(c => c.id === cid);
    if(c) c.editing = false;
    el.blur();
  }
});

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
  const k = Math.min(5, trainSamples.length);
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
