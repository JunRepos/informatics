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
  // Phase 1: 데이터셋 선택 → Phase 2(클래스 정의)
  if(act === 'ml-sup-pick'){
    const did = el.dataset.did;
    const ds = mlDatasetById(did);
    if(!ds) return;
    ML_SUP_DATASET = ds;
    // 학습 풀(라벨링 대상): 클래스 종류 무관, 한 풀에 골고루 섞어서 학생이 분류하게
    // 클래스당 8장 → 4클래스면 32장 정도가 그리드로 적당
    ML_SUP_POOL = mlGenerateDataset(did, 8, { seedOffset: 0 });
    _mlShuffle(ML_SUP_POOL.samples);
    // 테스트 풀: 다른 seed로 새 카드 30장 정도
    ML_SUP_TEST_POOL = mlGenerateDataset(did, 7, { seedOffset: 500 });
    _mlShuffle(ML_SUP_TEST_POOL.samples);
    // 클래스 정의 기본값: 데이터셋 종류 수만큼 빈 칸 (학생이 자유 입력)
    ML_SUP_CLASSES = [];
    for(let i = 0; i < Math.min(ds.classes.length, 4); i++){
      ML_SUP_CLASSES.push({ id: 'c' + (Date.now() + i), name: '', color: null });
    }
    ML_SUP_ACTIVE_CLS = null;
    ML_SUP_LABELS = {};
    ML_SUP_TRAINED = false;
    ML_SUP_TEST_PICK = null;
    ML_SUP_TEST_JUDGED = {};
    ML_SUP_PHASE = 'define';
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

  // Phase 2: 클래스 추가/삭제
  if(act === 'ml-sup-cls-add'){
    if(ML_SUP_CLASSES.length >= 5) return;
    ML_SUP_CLASSES.push({ id: 'c' + Date.now(), name: '', color: null });
    render();
    return;
  }
  if(act === 'ml-sup-cls-del'){
    const cid = el.dataset.cid;
    ML_SUP_CLASSES = ML_SUP_CLASSES.filter(c => c.id !== cid);
    // 이 클래스에 붙어있던 라벨 모두 해제
    Object.keys(ML_SUP_LABELS).forEach(k => { if(ML_SUP_LABELS[k] === cid) delete ML_SUP_LABELS[k]; });
    if(ML_SUP_ACTIVE_CLS === cid) ML_SUP_ACTIVE_CLS = null;
    render();
    return;
  }
  if(act === 'ml-sup-back-define'){
    ML_SUP_PHASE = 'define';
    ML_SUP_TRAINED = false;
    render();
    return;
  }

  // Phase 2 → Phase 3: 라벨링 시작
  if(act === 'ml-sup-go-label'){
    if(ML_SUP_CLASSES.length < 2) { toast('클래스를 2개 이상 만들어주세요', 'err'); return; }
    if(ML_SUP_CLASSES.some(c => !c.name.trim())) { toast('모든 클래스에 이름을 입력해주세요', 'err'); return; }
    // 이름 중복 체크
    const names = ML_SUP_CLASSES.map(c => c.name.trim());
    if(new Set(names).size !== names.length){ toast('클래스 이름이 겹치지 않게 해주세요', 'err'); return; }
    ML_SUP_ACTIVE_CLS = ML_SUP_CLASSES[0].id;
    ML_SUP_PHASE = 'label';
    render();
    return;
  }

  // Phase 3: 활성 클래스 선택
  if(act === 'ml-sup-cls-pick'){
    ML_SUP_ACTIVE_CLS = el.dataset.cid;
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
  // 클래스 이름 자유 입력 (정의 단계) — 입력 중 렌더 X (포커스 유지), 값만 저장
  const clsEl = e.target.closest('[data-action="ml-sup-cls-name"]');
  if(clsEl){
    const cid = clsEl.dataset.cid;
    const c = ML_SUP_CLASSES.find(c => c.id === cid);
    if(c) c.name = clsEl.value;
    // 다음 버튼 활성/비활성을 갱신하기 위해 그 버튼만 직접 토글
    const valid = ML_SUP_CLASSES.length >= 2 && ML_SUP_CLASSES.every(c => c.name.trim().length > 0);
    const btn = document.querySelector('[data-action="ml-sup-go-label"]');
    if(btn){
      if(valid) btn.removeAttribute('disabled');
      else btn.setAttribute('disabled', '');
    }
    return;
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
