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

  /* ── 지도학습 ── */
  if(act === 'ml-sup-pick'){
    const did = el.dataset.did;
    const ds = mlDatasetById(did);
    if(!ds) return;
    ML_SUP_DATASET = ds;
    ML_SUP_TRAIN_DATA = mlGenerateDataset(did, 20, { seedOffset: 0 });
    ML_SUP_TEST_DATA  = mlGenerateDataset(did, 3,  { seedOffset: 500 });  // 4클래스 × 3 = 12장
    ML_SUP_TRAINED = false;
    ML_SUP_TEST_IDX = 0;
    ML_SUP_TEST_RESULTS = [];
    ML_SUP_LAST_RESULT = null;
    // 테스트 셔플
    _mlShuffle(ML_SUP_TEST_DATA.samples);
    ML_SUP_PHASE = 'learn';
    render();
    return;
  }

  if(act === 'ml-sup-back'){
    ML_SUP_PHASE = 'pick';
    ML_SUP_DATASET = null;
    ML_SUP_TRAIN_DATA = null;
    ML_SUP_TEST_DATA = null;
    ML_SUP_TRAINED = false;
    ML_SUP_TEST_IDX = 0;
    ML_SUP_TEST_RESULTS = [];
    ML_SUP_LAST_RESULT = null;
    render();
    return;
  }

  if(act === 'ml-sup-back-learn'){
    ML_SUP_PHASE = 'learn';
    ML_SUP_LAST_RESULT = null;
    render();
    return;
  }

  if(act === 'ml-sup-train'){
    // KNN은 학습이 사실상 즉시 끝나지만, 학생에게 "학습 중" 느낌을 살짝 주기
    ML_SUP_TRAINED = false;
    toast('🧠 모델이 데이터를 살펴보는 중...', 'info');
    setTimeout(() => {
      ML_SUP_TRAINED = true;
      render();
    }, 600);
    return;
  }

  if(act === 'ml-sup-start-test'){
    ML_SUP_PHASE = 'test';
    ML_SUP_TEST_IDX = 0;
    ML_SUP_TEST_RESULTS = [];
    ML_SUP_LAST_RESULT = null;
    render();
    return;
  }

  if(act === 'ml-sup-predict'){
    const cur = ML_SUP_TEST_DATA.samples[ML_SUP_TEST_IDX];
    const pred = mlKnnPredict(ML_SUP_TRAIN_DATA.samples, cur.vec, 5);
    if(!pred){ toast('예측 실패', 'err'); return; }
    const ok = pred.classId === cur.classId;
    ML_SUP_LAST_RESULT = {
      ...pred,
      trueLabel: cur.label,
      trueClassId: cur.classId,
      ok,
      dataUrl: cur.dataUrl,
    };
    ML_SUP_TEST_RESULTS.push({
      ok,
      label: pred.label,
      trueLabel: cur.label,
      probs: pred.probs,
      dataUrl: cur.dataUrl,
    });
    render();
    return;
  }

  if(act === 'ml-sup-next'){
    ML_SUP_LAST_RESULT = null;
    ML_SUP_TEST_IDX++;
    if(ML_SUP_TEST_IDX >= ML_SUP_TEST_DATA.samples.length){
      ML_SUP_PHASE = 'done';
    }
    render();
    return;
  }

  if(act === 'ml-sup-restart'){
    // 새로운 테스트 셋 (다른 seed)
    const did = ML_SUP_DATASET.id;
    const newSeed = 500 + Math.floor(Math.random() * 5000);
    ML_SUP_TEST_DATA = mlGenerateDataset(did, 3, { seedOffset: newSeed });
    _mlShuffle(ML_SUP_TEST_DATA.samples);
    ML_SUP_TEST_IDX = 0;
    ML_SUP_TEST_RESULTS = [];
    ML_SUP_LAST_RESULT = null;
    ML_SUP_PHASE = 'test';
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
  if(!el) return;
  const v = parseInt(el.value, 10);
  if(isNaN(v)) return;
  ML_UN_K = v;
  // K가 바뀌면 자동으로 재초기화
  if(ML_UN_DATA){
    ML_UN_KMEANS = mlKMeansInit(ML_UN_DATA.samples, ML_UN_K);
    ML_UN_KMEANS.assignStep();
    ML_UN_REVEAL = false;
    render();
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
