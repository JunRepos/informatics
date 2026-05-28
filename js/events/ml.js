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
    ML_SUP_POOL = mlGenerateDataset(did, 8, { seedOffset: 0 });
    _mlShuffle(ML_SUP_POOL.samples);
    ML_SUP_TEST_POOL = mlGenerateDataset(did, 7, { seedOffset: 500 });
    _mlShuffle(ML_SUP_TEST_POOL.samples);
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

  // Phase 3: 카드 클릭 라벨링 (이미 같은 라벨이면 해제, 다른 라벨이면 덮어쓰기)
  if(act === 'ml-sup-card-label'){
    const idx = parseInt(el.dataset.idx);
    if(!ML_SUP_ACTIVE_CLS){
      toast('먼저 위의 클래스 중 하나를 선택해주세요', 'err');
      return;
    }
    if(ML_SUP_LABELS[idx] === ML_SUP_ACTIVE_CLS){
      // 같은 라벨 다시 클릭 = 해제
      delete ML_SUP_LABELS[idx];
    } else {
      ML_SUP_LABELS[idx] = ML_SUP_ACTIVE_CLS;
    }
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

  // Phase 4: 테스트 카드 클릭 → 모델 예측
  if(act === 'ml-sup-test-pick'){
    const idx = parseInt(el.dataset.idx);
    const sample = ML_SUP_TEST_POOL.samples[idx];
    // 학습 샘플 구성: 라벨 붙은 학습 풀 카드 + classId = 학생 정의 클래스 id
    const trainSamples = Object.entries(ML_SUP_LABELS).map(([sidx, cid]) => {
      const s = ML_SUP_POOL.samples[parseInt(sidx)];
      return { vec: s.vec, classId: cid, label: ML_SUP_CLASSES.find(c => c.id === cid)?.name || '?' };
    });
    if(!trainSamples.length){ toast('학습 데이터가 없습니다', 'err'); return; }
    const k = Math.min(5, trainSamples.length);
    const pred = mlKnnPredict(trainSamples, sample.vec, k);
    ML_SUP_TEST_PICK = { idx, sample, pred };
    render();
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
    if(Object.keys(ML_SUP_TEST_JUDGED).length < 3){
      toast('3장 이상 판정한 뒤 결과를 볼 수 있어요', 'err');
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
