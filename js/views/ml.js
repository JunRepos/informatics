/* ═══════════════════════════════════════
   views/ml.js — 🤖 기계학습 체험

   지도학습(분류기) + 비지도학습(그룹화) + 강화학습(기존 게임 링크)
   학생은 코드 0줄, 순수 인터랙션. 모든 결과는 화면에서만 (저장 X)
═══════════════════════════════════════ */

/* ═══════════════════════════════════════
   학생 — 🤖 기계학습 체험 탭
═══════════════════════════════════════ */

function vStMl(){
  if(!ML_ACTIVE[SEL_CLS?.id]) return emptyBox('🔒', '기계학습 체험이 아직 열리지 않았어요. 선생님 안내를 기다려주세요.');

  const sub = `<div class="ml-subtabs">
    <button class="ml-subtab ${ML_TAB === 'supervised' ? 'on' : ''}" data-action="ml-tab" data-t="supervised">📚 지도학습</button>
    <button class="ml-subtab ${ML_TAB === 'unsupervised' ? 'on' : ''}" data-action="ml-tab" data-t="unsupervised">🔍 비지도학습</button>
    <button class="ml-subtab ${ML_TAB === 'reinforce' ? 'on' : ''}" data-action="ml-tab" data-t="reinforce">🎮 강화학습</button>
  </div>`;

  let body = '';
  if     (ML_TAB === 'supervised')   body = _vStMlSupervised();
  else if(ML_TAB === 'unsupervised') body = _vStMlUnsupervised();
  else if(ML_TAB === 'reinforce')    body = _vStMlReinforce();

  return `<div class="section ml-head">
    <div class="ml-head-title">🤖 기계학습 체험</div>
    <div class="ml-head-sub">기계학습의 3가지 방식 — 지도·비지도·강화 — 을 직접 해봅시다.</div>
  </div>` + sub + body;
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
  if(ML_SUP_PHASE === 'done')  return _vStMlSupDone();
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

  // 그룹 박스들
  const groupBoxes = ML_SUP_CLASSES.map((c, i) => {
    const col = ML_CLS_COLORS[i % ML_CLS_COLORS.length];
    const isActive = ML_SUP_ACTIVE_CLS === c.id;
    const cards = clsCards[c.id] || [];
    // 헤더 (이름 편집/삭제)
    const header = c.editing
      ? `<input type="text" class="ml-gb-input"
           data-action="ml-sup-cls-name" data-cid="${esc(c.id)}"
           value="${esc(c.name)}" placeholder="그룹 이름" maxlength="20" autofocus/>`
      : `<span class="ml-gb-dot" style="background:${col.chip}"></span>
         <span class="ml-gb-name" data-action="ml-sup-cls-edit" data-cid="${esc(c.id)}" title="이름 수정">${esc(c.name || '(이름 없음)')}</span>
         <span class="ml-gb-cnt">${cards.length}장</span>
         <button class="ml-gb-del" data-action="ml-sup-cls-del" data-cid="${esc(c.id)}" title="그룹 삭제">✕</button>`;
    // 담긴 카드들
    const cardsHtml = cards.map(idx => {
      const s = samples[idx];
      return `<div class="ml-gb-card" data-action="ml-sup-card-unlabel" data-idx="${idx}" title="클릭하면 다시 빼요">
        <img src="${s.dataUrl}" alt=""/>
      </div>`;
    }).join('');
    return `<div class="ml-group-box ${isActive ? 'active' : ''} ${c.editing ? 'editing' : ''}"
        data-group-drop="${esc(c.id)}" data-action="${c.editing ? '' : 'ml-sup-cls-pick'}" data-cid="${esc(c.id)}"
        style="border-color:${col.border};background:${col.bg}">
      <div class="ml-gb-head">${header}</div>
      <div class="ml-gb-cards">
        ${cardsHtml || '<div class="ml-gb-empty">여기로 사진을<br>끌어다 놓아요</div>'}
      </div>
    </div>`;
  }).join('');

  const canAdd = ML_SUP_CLASSES.length < 5;
  const addBox = canAdd
    ? `<button class="ml-group-add" data-action="ml-sup-cls-add">＋<br>그룹 추가</button>`
    : '';

  // 공용 풀 (아직 라벨 안 된 카드만)
  const poolCards = samples.map((s, i) => {
    if(ML_SUP_LABELS[i] != null) return '';  // 이미 그룹에 담김 → 풀에서 숨김
    return `<div class="ml-pool-card" data-action="ml-sup-pool-pick" data-idx="${i}">
      <img src="${s.dataUrl}" draggable="true" data-label-idx="${i}" alt=""/>
    </div>`;
  }).join('');
  const poolRemaining = samples.length - Object.keys(ML_SUP_LABELS).length;

  // 학습 가능 조건
  const namedClasses = ML_SUP_CLASSES.filter(c => (c.name || '').trim());
  const allHaveData = namedClasses.length >= 2 && namedClasses.every(c => (clsCards[c.id] || []).length >= 1);
  let trainHint = '';
  if(ML_SUP_CLASSES.length === 0){
    trainHint = '👆 먼저 + 그룹 추가로 그룹을 만들어보세요.';
  } else if(namedClasses.length < 2){
    trainHint = '그룹이 2개 이상 있어야 학습할 수 있어요.';
  } else if(!allHaveData){
    trainHint = '모든 그룹에 사진을 1장 이상 담아주세요. (그룹마다 3~4장이면 충분해요)';
  }

  const activeName = ML_SUP_ACTIVE_CLS
    ? ML_SUP_CLASSES.find(c => c.id === ML_SUP_ACTIVE_CLS)?.name
    : null;

  return `<div class="back-btn" data-action="ml-sup-back">← 다른 데이터셋 고르기</div>
    ${_mlStepBar(1)}
    <div class="section">
      <div class="sec-title">${ds.icon} ${esc(ds.title)} — 그룹 만들고 사진 담기</div>
      <div class="ml-sub-explain">
        ① <b>＋ 그룹 추가</b>로 그룹을 만들고 이름을 정해요 → ② 아래 사진들을 <b>각 그룹 박스로 끌어다 담아요</b>.<br>
        <u>전부 담을 필요 없어요!</u> 그룹마다 <b>3~4장</b>만 모으면 충분해요.
        ${ML_SUP_ACTIVE_CLS && activeName
          ? `<br><span class="ml-active-inline">📌 클릭으로 담기: 지금 선택된 그룹 <b>${esc(activeName)}</b> — 아래 사진을 클릭하면 담겨요.</span>`
          : ''}
      </div>
      <div class="ml-group-boxes">
        ${groupBoxes}
        ${addBox}
      </div>
      <div class="ml-pool-label">
        아직 분류 안 한 사진 <b>${poolRemaining}장</b>
        <span class="ml-pool-hint">— 사진을 위 그룹으로 드래그하세요 (또는 그룹 선택 후 클릭)</span>
      </div>
      <div class="ml-pool ${ML_SUP_CLASSES.length ? '' : 'dim'}">
        ${poolRemaining > 0 ? poolCards : '<div class="ml-pool-empty">🎉 모든 사진을 분류했어요!</div>'}
      </div>
    </div>
    <div class="ml-action-bar">
      ${trainHint ? `<div class="ml-train-hint">${trainHint}</div>` : ''}
      <button class="btn-p" data-action="ml-sup-train" ${allHaveData ? '' : 'disabled'}>🧠 학습하고 테스트하러 가기 →</button>
    </div>`;
}

/* Phase 4: 테스트 — Teachable Machine 식. 후보 5장 중 하나를 모델 입력칸으로 드래그 */
function _vStMlSupTest(){
  const ds = ML_SUP_DATASET;
  const pool = ML_SUP_TEST_POOL.samples;

  // 후보 카드 줄 (드래그 가능). 판정 끝난 카드는 배지 표시
  const candHtml = pool.map((s, i) => {
    const j = ML_SUP_TEST_JUDGED[i];
    let badge = '';
    let extraCls = '';
    if(j){
      badge = j.judged === 'ok'
        ? '<div class="ml-test-badge ok">👍</div>'
        : '<div class="ml-test-badge ng">👎</div>';
      extraCls = 'judged ' + (j.judged === 'ok' ? 'judged-ok' : 'judged-ng');
    }
    if(ML_SUP_TEST_PICK && ML_SUP_TEST_PICK.idx === i) extraCls += ' picked';
    return `<div class="ml-cand-card ${extraCls}" data-action="ml-sup-test-pick" data-idx="${i}">
      <img src="${s.dataUrl}" draggable="true" data-drag-idx="${i}" alt=""/>
      ${badge}
    </div>`;
  }).join('');

  const okCnt = Object.values(ML_SUP_TEST_JUDGED).filter(j => j.judged === 'ok').length;
  const ngCnt = Object.values(ML_SUP_TEST_JUDGED).filter(j => j.judged === 'ng').length;
  const judgedCnt = okCnt + ngCnt;

  // INPUT 박스 (드롭존)
  const inputBox = ML_SUP_TEST_PICK
    ? `<div class="ml-tm-input filled" data-dropzone="1">
         <img src="${ML_SUP_TEST_PICK.sample.dataUrl}" alt=""/>
       </div>`
    : `<div class="ml-tm-input" data-dropzone="1">
         <div class="ml-tm-drop-hint">
           <div class="ml-tm-drop-icon">📥</div>
           <div>여기로 사진을<br>끌어다 놓아요</div>
         </div>
       </div>`;

  // OUTPUT 박스 (확률 막대)
  let outputBox;
  if(ML_SUP_TEST_PICK){
    const { pred } = ML_SUP_TEST_PICK;
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
    outputBox = `<div class="ml-tm-output"><div class="ml-tm-box-title">출력 (모델의 예측)</div>${bars}</div>`;
  } else {
    outputBox = `<div class="ml-tm-output empty"><div class="ml-tm-box-title">출력 (모델의 예측)</div>
      <div class="ml-tm-output-empty">사진을 입력하면<br>여기에 예측 결과가 나와요</div></div>`;
  }

  // 판정 영역 (입력된 카드가 있을 때만)
  let judgeBar = '';
  if(ML_SUP_TEST_PICK){
    const judged = ML_SUP_TEST_JUDGED[ML_SUP_TEST_PICK.idx];
    judgeBar = `<div class="ml-test-judge-wrap">
      <div class="ml-test-verdict-q">이 예측이 맞다고 생각해요?</div>
      <div class="ml-test-judge-bar">
        <button class="btn-sm ml-judge-ok ${judged?.judged === 'ok' ? 'on' : ''}" data-action="ml-sup-judge" data-judge="ok">👍 맞아!</button>
        <button class="btn-sm ml-judge-ng ${judged?.judged === 'ng' ? 'on' : ''}" data-action="ml-sup-judge" data-judge="ng">👎 틀렸어</button>
      </div>
    </div>`;
  }

  return `<div class="back-btn" data-action="ml-sup-back-label">← 라벨링 다시 하기</div>
    ${_mlStepBar(2)}
    <div class="section">
      <div class="sec-title">🧪 모델 테스트  <span class="ml-test-meta">(판정: 👍 ${okCnt} · 👎 ${ngCnt})</span></div>
      <div class="ml-sub-explain">
        새 사진 <b>5장</b>이에요. 이 중 하나를 골라 <b>모델 입력칸으로 드래그</b>해보세요.
        모델이 어떤 그룹이라고 예측하는지 보고, <b>맞으면 👍 틀리면 👎</b>로 평가해요.
      </div>

      <div class="ml-tm-cands-label">테스트 사진 (드래그하세요)</div>
      <div class="ml-tm-cands">${candHtml}</div>

      <div class="ml-tm-flow">
        <div class="ml-tm-col">
          <div class="ml-tm-box-title">입력</div>
          ${inputBox}
        </div>
        <div class="ml-tm-arrow">➜</div>
        <div class="ml-tm-col grow">
          ${outputBox}
        </div>
      </div>
      ${judgeBar}
    </div>
    <div class="ml-action-bar">
      <span class="ml-test-progress">${judgedCnt}장 판정 / ${pool.length}장 중</span>
      <button class="btn-p btn-sm" data-action="ml-sup-finish" ${judgedCnt >= 1 ? '' : 'disabled'}>결과 보기 →</button>
    </div>`;
}

/* Phase 5: 결과 */
function _vStMlSupDone(){
  const ds = ML_SUP_DATASET;
  const judgeArr = Object.entries(ML_SUP_TEST_JUDGED).map(([idx, v]) => ({ idx: parseInt(idx), ...v }));
  const total = judgeArr.length;
  const correct = judgeArr.filter(r => r.judged === 'ok').length;
  const wrong = judgeArr.filter(r => r.judged === 'ng');
  const acc = total ? (correct / total * 100).toFixed(0) : '0';
  const tier = total > 0 && correct === total ? 'perfect'
             : (correct / total >= 0.7 ? 'good'
             : (correct / total >= 0.4 ? 'mid' : 'low'));

  const wrongHtml = wrong.length
    ? wrong.map(r => {
        const s = ML_SUP_TEST_POOL.samples[r.idx];
        const c = ML_SUP_CLASSES.find(c => c.id === r.pred.classId);
        return `<div class="ml-wrong-item">
          <img src="${s.dataUrl}" class="ml-thumb-big"/>
          <div class="ml-wrong-meta">
            <div>모델 예측: <b style="color:var(--danger)">${esc(c?.name || '?')}</b></div>
            <div style="font-size:11px;color:var(--text3)">학생 판정: 👎 틀렸음</div>
          </div>
        </div>`;
      }).join('')
    : '<div class="ml-perfect">🌟 모든 예측이 맞았다고 평가했어요!</div>';

  const tipMsg = tier === 'perfect' ? '🎉 모델이 완벽하게 학습했네요! 라벨링을 잘했나봐요.' :
                 tier === 'good'    ? '👍 잘 학습됐어요! 라벨링 데이터가 좋았네요.' :
                 tier === 'mid'     ? '🤔 절반 정도만 맞췄어요. 라벨링한 카드가 너무 적거나, 비슷한 모양이 섞여있었을 수 있어요.' :
                                       '😅 모델이 잘 못 맞췄네요. 라벨링을 더 정확하게 다시 해볼까요?';

  const labelStats = ML_SUP_CLASSES.map((c, i) => {
    const cnt = Object.values(ML_SUP_LABELS).filter(cid => cid === c.id).length;
    const col = ML_CLS_COLORS[i % ML_CLS_COLORS.length];
    return `<div class="ml-stat-chip" style="background:${col.bg};color:${col.chip};border:1px solid ${col.border}">${esc(c.name)} ${cnt}장</div>`;
  }).join('');

  return `<div class="section">
    <div class="sec-title">${ds.icon} 모델 평가 결과</div>
    <div class="ml-score-big ${tier}">
      <div class="ml-score-pct">${acc}<span style="font-size:24px">%</span></div>
      <div class="ml-score-frac">${correct} / ${total} 맞췄다고 평가</div>
    </div>
    <div class="ml-sub-explain">${tipMsg}</div>
    <div class="sec-title" style="margin-top:14px">📋 내가 학습시킨 데이터</div>
    <div class="ml-stat-row">${labelStats}</div>
    <div class="sec-title" style="margin-top:14px">🔎 모델이 틀린 케이스</div>
    <div class="ml-wrong-list">${wrongHtml}</div>
    <div class="ml-action-bar">
      <button class="btn-sm" data-action="ml-sup-back-test">↩ 테스트 더 하기</button>
      <button class="btn-sm" data-action="ml-sup-relabel">🔁 라벨링부터 다시</button>
      <button class="btn-p btn-sm" data-action="ml-sup-back">🆕 다른 데이터셋</button>
    </div>
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

function _vStMlUnRun(){
  const ds = ML_UN_DATASET;
  const km = ML_UN_KMEANS;
  const samples = ML_UN_DATA.samples;
  const groups = km ? mlKMeansGroups(km) : [];

  // 그룹 박스 (가로 또는 그리드)
  const groupColors = ['#fee2e2', '#dbeafe', '#dcfce7', '#fef3c7', '#fae8ff', '#cffafe', '#fed7aa', '#e0e7ff'];
  const groupBordersOuter = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#06b6d4', '#f97316', '#6366f1'];

  let groupsHtml = '';
  if(km){
    groupsHtml = groups.map((g, gi) => {
      // 그룹 내 카드 (정답 라벨 안 보여줌)
      const cardsHtml = g.map(i => {
        const s = samples[i];
        return `<img src="${s.dataUrl}" class="ml-card-img" data-cid="${esc(s.classId)}" alt=""/>`;
      }).join('');
      return `<div class="ml-group" style="background:${groupColors[gi % 8]};border-color:${groupBordersOuter[gi % 8]}">
        <div class="ml-group-head">그룹 ${gi + 1} <span class="ml-group-cnt">${g.length}장</span></div>
        <div class="ml-group-cards">${cardsHtml || '<div class="ml-group-empty">(비어있음)</div>'}</div>
      </div>`;
    }).join('');
  } else {
    // 초기 상태: 무작위로 흩어진 모든 카드
    const cardsHtml = samples.map(s => `<img src="${s.dataUrl}" class="ml-card-img scattered" alt=""/>`).join('');
    groupsHtml = `<div class="ml-group ml-group-init">
      <div class="ml-group-head">전체 데이터 — 아직 그룹 짓기 전</div>
      <div class="ml-group-cards">${cardsHtml}</div>
    </div>`;
  }

  // 결과(정답 공개) 토글
  const purity = km && ML_UN_REVEAL ? mlKMeansPurity(km, samples) : null;
  let revealHtml = '';
  if(km && ML_UN_REVEAL){
    revealHtml = `<div class="section ml-reveal">
      <div class="sec-title">😎 정답 공개! 그룹별 진짜 라벨</div>
      <div class="ml-reveal-info">
        모델은 ${ds.classes.length}종을 미리 알지 못한 상태로 <b>${km.k}개 그룹</b>으로 나눴어요.
        평균적으로 같은 종류끼리 얼마나 잘 모였는지 보세요.
      </div>
      <div class="ml-reveal-grid">
        ${groups.map((g, gi) => {
          // 그룹 내 라벨 카운트
          const cnt = {};
          g.forEach(i => { const cid = samples[i].classId; cnt[cid] = (cnt[cid] || 0) + 1; });
          const sorted = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
          const breakdown = sorted.map(([cid, n]) => {
            const c = ds.classes.find(cc => cc.id === cid);
            return `<span class="ml-reveal-tag">${c?.emoji || '?'} ${esc(c?.label || cid)} ×${n}</span>`;
          }).join('');
          return `<div class="ml-reveal-card" style="border-color:${groupBordersOuter[gi % 8]}">
            <div class="ml-reveal-head">그룹 ${gi + 1} (${g.length}장)</div>
            <div class="ml-reveal-tags">${breakdown}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="ml-purity">정확도(순도): <b>${(purity.purity * 100).toFixed(1)}%</b> — 같은 그룹 안의 다수 라벨 비율</div>
    </div>`;
  }

  const kSlider = `<div class="ml-k-ctrl">
    <label>그룹 수 K = <b>${ML_UN_K}</b></label>
    <input type="range" min="2" max="6" value="${ML_UN_K}" data-action="ml-un-k" class="ml-k-slider"/>
  </div>`;

  const stepInfo = km
    ? `<div class="ml-step-info">반복 회차: <b>${km.iter}</b> ${km.iter > 0 && !km.changed ? '✓ <span style="color:var(--ok)">수렴 완료</span>' : ''}</div>`
    : '<div class="ml-step-info">아직 그룹 짓기 전</div>';

  return `<div class="back-btn" data-action="ml-un-back">← 다른 데이터셋</div>
    <div class="section">
      <div class="sec-title">${ds.icon} ${esc(ds.title)} — 비지도 그룹화</div>
      <div class="ml-sub-explain">
        모델(<b>K-Means</b>)은 비슷한 픽셀을 가진 것끼리 자동으로 K개 그룹으로 모아요.
        한 단계씩 진행하거나 한번에 끝까지 돌릴 수 있어요.
      </div>
      ${kSlider}
      ${stepInfo}
      <div class="ml-action-bar">
        ${km
          ? `<button class="btn-sm" data-action="ml-un-step">⏭ 한 단계 진행</button>
             <button class="btn-sm" data-action="ml-un-run">▶ 끝까지 진행</button>
             <button class="btn-sm" data-action="ml-un-reset">⟲ 초기화</button>
             <button class="btn-p btn-sm" data-action="ml-un-reveal">${ML_UN_REVEAL ? '🙈 정답 숨기기' : '😎 정답 공개'}</button>`
          : `<button class="btn-p" data-action="ml-un-start">▶ 그룹 짓기 시작</button>`}
      </div>
    </div>
    <div class="ml-groups-wrap k-${km ? km.k : 1}">
      ${groupsHtml}
    </div>
    ${revealHtml}`;
}

/* ─────────────────── 강화학습 ─────────────────── */

const ML_RL_DUCK_URL = 'https://8laos.github.io/reinforced-duck/';

function _vStMlReinforce(){
  return `<div class="section">
    <div class="ml-intro">
      <b>🎮 강화학습</b>은 <u>잘하면 보상, 못하면 벌점</u>을 주면서 스스로 학습시키는 방식이에요.
      AI가 수많은 시도(trial & error)를 반복하며 점점 더 잘하게 됩니다.
    </div>

    <div class="ml-rl-game">
      <div class="ml-rl-game-head">
        <div>
          <div class="ml-rl-title">🦆 강화학습 오리 (Reinforced Duck)</div>
          <div class="ml-rl-credit">친구가 Unity로 직접 만든 강화학습 게임이에요. AI 오리가 장애물을 피하며 보상을 받아 점점 잘하게 되는 과정을 지켜보세요!</div>
        </div>
        <a class="btn-p btn-sm ml-rl-open" href="${ML_RL_DUCK_URL}" target="_blank" rel="noopener">🔗 새 탭에서 크게 열기</a>
      </div>
      <div class="ml-rl-frame-wrap">
        <iframe class="ml-rl-frame" credentialless src="${ML_RL_DUCK_URL}"
          allow="fullscreen; autoplay; gamepad"
          allowfullscreen loading="lazy"
          title="Reinforced Duck"></iframe>
      </div>
      <div class="ml-rl-note">게임이 안 보이면 위의 <b>🔗 새 탭에서 크게 열기</b>를 눌러주세요. (불러오는 데 몇 초 걸릴 수 있어요)</div>
    </div>

    <div class="ml-rl-card">
      <div class="ml-rl-icon">🐦</div>
      <div class="ml-rl-body">
        <div class="ml-rl-title2">직접 보상 시스템 만들어보기 — 플래피 버드</div>
        <div class="ml-rl-desc">
          🎮 미션 탭에서 플래피 버드의 점수·레벨 같은 <b>보상 시스템을 직접 디자인</b>해봐요.
          어떤 행동에 점수를 줄지 정하는 게 곧 강화학습의 핵심이에요.
        </div>
        <button class="btn-sm" data-action="ml-go-mission">🎮 미션 탭으로 이동</button>
      </div>
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

  return phaseRow + `<div class="section">
    <div class="sec-title">활동 구성</div>
    <div class="ml-sub-explain">
      학생은 데이터를 직접 만들지 않고 <b>미리 준비된 이모지 데이터셋</b>에서 골라 분류기를 만들거나(지도), 그룹화를 체험(비지도)합니다.
      코드 작성은 0줄. 강화학습은 <b>Reinforced Duck</b>(외부 Unity 게임) 임베드로 보여주고, 보조로 🎮 미션(플래피 버드) 보상 설계와 연결됩니다.
    </div>
    <div class="ml-tc-flow">
      <div class="ml-tc-flow-card"><b>📚 지도학습</b><br><small>데이터셋 선택 → 그룹 만들어 라벨링 → 테스트(드래그) 정확도 확인</small></div>
      <div class="ml-tc-flow-card"><b>🔍 비지도학습</b><br><small>K-Means로 라벨 없이 그룹화 → 정답 공개로 정확도 확인</small></div>
      <div class="ml-tc-flow-card"><b>🎮 강화학습</b><br><small>Reinforced Duck 게임 임베드 + 플래피버드 보상 설계 안내</small></div>
    </div>
    <div class="sec-title" style="margin-top:14px">제공되는 데이터셋</div>
    <div class="ml-tc-ds-list">${datasets}</div>
  </div>`;
}
