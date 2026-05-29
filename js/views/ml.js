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

  // 그룹 박스들 (3개 고정 — 이름 input 항상 표시, 추가/삭제 없음)
  const groupBoxes = ML_SUP_CLASSES.map((c, i) => {
    const col = ML_CLS_COLORS[i % ML_CLS_COLORS.length];
    const isActive = ML_SUP_ACTIVE_CLS === c.id;
    const cards = clsCards[c.id] || [];
    // 담긴 카드들
    const cardsHtml = cards.map(idx => {
      const s = samples[idx];
      return `<div class="ml-gb-card" data-action="ml-sup-card-unlabel" data-idx="${idx}" title="클릭하면 다시 빼요">
        <img src="${s.dataUrl}" alt=""/>
      </div>`;
    }).join('');
    return `<div class="ml-group-box ${isActive ? 'active' : ''}"
        data-group-drop="${esc(c.id)}"
        style="border-color:${col.border};background:${col.bg}">
      <div class="ml-gb-head">
        <span class="ml-gb-dot" style="background:${col.chip}"></span>
        <input type="text" class="ml-gb-input"
          data-action="ml-sup-cls-name" data-cid="${esc(c.id)}"
          value="${esc(c.name)}" placeholder="그룹 ${i + 1} 이름" maxlength="20"/>
        <span class="ml-gb-cnt">${cards.length}장</span>
      </div>
      <div class="ml-gb-cards" data-action="ml-sup-cls-pick" data-cid="${esc(c.id)}">
        ${cardsHtml || '<div class="ml-gb-empty">여기로 사진을<br>끌어다 놓아요</div>'}
      </div>
    </div>`;
  }).join('');

  const addBox = '';

  // 공용 풀 (아직 라벨 안 된 카드만)
  const poolCards = samples.map((s, i) => {
    if(ML_SUP_LABELS[i] != null) return '';  // 이미 그룹에 담김 → 풀에서 숨김
    return `<div class="ml-pool-card" data-action="ml-sup-pool-pick" data-idx="${i}">
      <img src="${s.dataUrl}" draggable="true" data-label-idx="${i}" alt=""/>
    </div>`;
  }).join('');
  const poolRemaining = samples.length - Object.keys(ML_SUP_LABELS).length;

  // 학습 가능 조건 — 이름 채운 그룹 2개 이상 + 각각 1장 이상
  const namedClasses = ML_SUP_CLASSES.filter(c => (c.name || '').trim());
  const allHaveData = namedClasses.length >= 2 && namedClasses.every(c => (clsCards[c.id] || []).length >= 1);
  let trainHint = '';
  if(namedClasses.length < 2){
    trainHint = '그룹 2개 이상에 이름을 정해주세요.';
  } else if(!allHaveData){
    trainHint = '이름 정한 그룹마다 사진을 1장 이상 담아주세요. (그룹당 3~4장이면 충분해요)';
  }

  const activeName = ML_SUP_ACTIVE_CLS
    ? ML_SUP_CLASSES.find(c => c.id === ML_SUP_ACTIVE_CLS)?.name
    : null;

  return `<div class="back-btn" data-action="ml-sup-back">← 다른 데이터셋 고르기</div>
    ${_mlStepBar(1)}
    <div class="section">
      <div class="sec-title">${ds.icon} ${esc(ds.title)} — 그룹 이름 정하고 사진 담기</div>
      <div class="ml-sub-explain">
        ① 아래 <b>3개 그룹의 이름을 정해요</b> (예: 사과 / 바나나 / 포도) → ② 사진들을 <b>각 그룹 박스로 끌어다 담아요</b>.<br>
        <u>전부 담을 필요 없어요!</u> 그룹마다 <b>3~4장</b>만 모으면 충분해요.
        ${ML_SUP_ACTIVE_CLS && activeName
          ? `<br><span class="ml-active-inline">📌 클릭으로도 담기: 지금 선택된 그룹 <b>${esc(activeName)}</b> — 아래 사진을 클릭하면 담겨요.</span>`
          : ''}
      </div>
      <div class="ml-group-boxes">
        ${groupBoxes}
      </div>
      <div class="ml-pool-label">
        아직 분류 안 한 사진 <b>${poolRemaining}장</b>
        <span class="ml-pool-hint">— 사진을 위 그룹으로 드래그하세요 (또는 그룹 선택 후 클릭)</span>
      </div>
      <div class="ml-pool">
        ${poolRemaining > 0 ? poolCards : '<div class="ml-pool-empty">🎉 모든 사진을 분류했어요!</div>'}
      </div>
    </div>
    <div class="ml-action-bar">
      ${trainHint ? `<div class="ml-train-hint">${trainHint}</div>` : ''}
      <button class="btn-p" data-action="ml-sup-train" ${allHaveData ? '' : 'disabled'}>🧠 학습하고 테스트하러 가기 →</button>
    </div>`;
}

/* Phase 4: 테스트 — 학생이 마우스로 직접 그려서 모델에게 맞춰보기 */
const ML_DRAW_PALETTE = [
  { c: '#e23b3b', name: '빨강' },
  { c: '#f5a623', name: '주황' },
  { c: '#f5d020', name: '노랑' },
  { c: '#6abf4b', name: '초록' },
  { c: '#3b82f6', name: '파랑' },
  { c: '#8b3fb0', name: '보라' },
  { c: '#8b5a2b', name: '갈색' },
  { c: '#333333', name: '검정' },
];

function _vStMlSupTest(){
  const ds = ML_SUP_DATASET;
  const pred = ML_SUP_DRAW_PRED;

  // 팔레트
  const palette = ML_DRAW_PALETTE.map(p =>
    `<button class="ml-pal ${ML_SUP_DRAW_COLOR === p.c ? 'on' : ''}" data-action="ml-sup-draw-color" data-color="${p.c}" title="${p.name}" style="background:${p.c}"></button>`
  ).join('');

  // 출력(확률 막대)
  let outputBox;
  if(pred){
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
    const predName = ML_SUP_CLASSES.find(c => c.id === pred.classId)?.name || '?';
    outputBox = `<div class="ml-tm-output">
      <div class="ml-tm-box-title">출력 (모델의 예측)</div>
      <div class="ml-draw-verdict">🤖 모델은 <b>"${esc(predName)}"</b> 같대요!</div>
      ${bars}
    </div>`;
  } else {
    outputBox = `<div class="ml-tm-output empty">
      <div class="ml-tm-box-title">출력 (모델의 예측)</div>
      <div class="ml-tm-output-empty">그림을 그리고<br><b>맞춰보기</b>를 누르면<br>예측이 나와요</div>
    </div>`;
  }

  return `<div class="back-btn" data-action="ml-sup-back-label">← 라벨링 다시 하기</div>
    ${_mlStepBar(2)}
    <div class="section">
      <div class="sec-title">🧪 모델 테스트 — 직접 그려서 맞춰보기</div>
      <div class="ml-sub-explain">
        아래 칸에 <b>마우스로 직접 그림을 그려보세요</b>! (예: 빨강으로 동그란 사과)
        그리고 <b>맞춰보기</b>를 누르면, 내가 학습시킨 모델이 어느 그룹인지 알아맞혀요.<br>
        💡 이 모델은 <u>색을 많이 봐요</u> — 그릴 때 색을 비슷하게 칠하면 더 잘 맞춰요.
      </div>

      <div class="ml-tm-flow">
        <div class="ml-tm-col">
          <div class="ml-tm-box-title">입력 (내 그림)</div>
          <canvas id="ml-draw-canvas" class="ml-draw-canvas" width="280" height="280"></canvas>
          <div class="ml-draw-tools">
            <div class="ml-pal-row">${palette}</div>
            <button class="btn-xs" data-action="ml-sup-draw-clear">🗑 지우기</button>
          </div>
        </div>
        <div class="ml-tm-arrow">➜</div>
        <div class="ml-tm-col grow">
          ${outputBox}
          <button class="btn-p ml-draw-predict" data-action="ml-sup-draw-predict">🤖 맞춰보기</button>
        </div>
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

// 2D 좌표 → plot 영역 % 변환
function _mlUnPctX(x){ const b = ML_UN_BOUNDS; return ((x - b.minX) / (b.maxX - b.minX)) * 100; }
function _mlUnPctY(y){ const b = ML_UN_BOUNDS; return (1 - (y - b.minY) / (b.maxY - b.minY)) * 100; }

function _vStMlUnRun(){
  const ds = ML_UN_DATASET;
  const km = ML_UN_KMEANS;
  const pts = ML_UN_PTS;
  const samples = ML_UN_DATA.samples;

  // 클러스터 색
  const clusterColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#06b6d4'];

  // 점들 (이모지 썸네일). 그룹 짓기 전엔 회색 테두리, 후엔 클러스터 색
  const dotsHtml = pts.map((p, i) => {
    const left = _mlUnPctX(p[0]).toFixed(1);
    const top  = _mlUnPctY(p[1]).toFixed(1);
    const c = km ? km.assignments[i] : -1;
    const col = c >= 0 ? clusterColors[c % clusterColors.length] : '#cbd5e1';
    return `<div class="ml-pt" style="left:${left}%;top:${top}%;border-color:${col};box-shadow:0 0 0 2px ${col}33">
      <img src="${samples[i].dataUrl}" alt=""/>
    </div>`;
  }).join('');

  // 중심점(✕)
  let centroidsHtml = '';
  if(km){
    centroidsHtml = km.centroids.map((cv, c) => {
      const left = _mlUnPctX(cv[0]).toFixed(1);
      const top  = _mlUnPctY(cv[1]).toFixed(1);
      const col = clusterColors[c % clusterColors.length];
      return `<div class="ml-centroid" style="left:${left}%;top:${top}%;color:${col};border-color:${col}">✕</div>`;
    }).join('');
  }

  const stepInfo = km
    ? `<div class="ml-step-info">반복 회차: <b>${km.iter}</b> ${km.iter > 0 && !km.changed ? '· <span style="color:var(--ok)">✓ 수렴 완료 (더 이상 안 변해요)</span>' : ''}</div>`
    : '<div class="ml-step-info">아직 그룹 짓기 전 — 점들이 회색이에요</div>';

  // 정답 공개
  let revealHtml = '';
  if(km && ML_UN_REVEAL){
    const groups = mlKMeansGroups(km);
    const purity = mlKMeansPurity(km, ML_UN_2D);
    revealHtml = `<div class="section ml-reveal">
      <div class="sec-title">😎 정답 공개! 그룹별 진짜 라벨</div>
      <div class="ml-reveal-info">
        모델은 정답(${ds.classes.length}종)을 모른 채 <b>${km.k}개 그룹</b>으로 나눴어요. 같은 종류끼리 얼마나 잘 모였는지 보세요.
      </div>
      <div class="ml-reveal-grid">
        ${groups.map((g, gi) => {
          const cnt = {};
          g.forEach(i => { const cid = samples[i].classId; cnt[cid] = (cnt[cid] || 0) + 1; });
          const sorted = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
          const breakdown = sorted.map(([cid, n]) => {
            const c = ds.classes.find(cc => cc.id === cid);
            return `<span class="ml-reveal-tag">${c?.emoji || '?'} ${esc(c?.label || cid)} ×${n}</span>`;
          }).join('');
          return `<div class="ml-reveal-card" style="border-color:${clusterColors[gi % clusterColors.length]}">
            <div class="ml-reveal-head">그룹 ${gi + 1} (${g.length}개)</div>
            <div class="ml-reveal-tags">${breakdown || '(비어있음)'}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="ml-purity">정확도(순도): <b>${(purity.purity * 100).toFixed(0)}%</b> — 같은 그룹 안의 다수 라벨 비율</div>
    </div>`;
  }

  return `<div class="back-btn" data-action="ml-un-back">← 다른 데이터셋</div>
    <div class="section">
      <div class="sec-title">${ds.icon} ${esc(ds.title)} — 비지도 그룹화 (점 지도)</div>
      <div class="ml-sub-explain">
        각 사진을 <b>색·모양 특징</b>으로 평면 위 점으로 흩뿌렸어요. 비슷한 사진일수록 가까이 모여요.<br>
        <b>K-Means</b>가 중심점(✕)을 옮겨가며 가까운 점끼리 <b>${ML_UN_K}개 그룹</b>(색)으로 묶습니다.
      </div>
      ${stepInfo}
      <div class="ml-action-bar">
        ${km
          ? `<button class="btn-sm" data-action="ml-un-step" ${ML_UN_AUTO_TIMER ? 'disabled' : ''}>⏭ 한 단계</button>
             <button class="btn-sm" data-action="ml-un-run">${ML_UN_AUTO_TIMER ? '⏸ 정지' : '▶ 자동 재생'}</button>
             <button class="btn-sm" data-action="ml-un-reset" ${ML_UN_AUTO_TIMER ? 'disabled' : ''}>⟲ 초기화</button>
             <button class="btn-p btn-sm" data-action="ml-un-reveal" ${ML_UN_AUTO_TIMER ? 'disabled' : ''}>${ML_UN_REVEAL ? '🙈 정답 숨기기' : '😎 정답 공개'}</button>`
          : `<button class="btn-p" data-action="ml-un-start">▶ 그룹 짓기 시작</button>`}
      </div>
      <div class="ml-plot">
        ${dotsHtml}
        ${centroidsHtml}
      </div>
    </div>
    ${revealHtml}`;
}

/* ─────────────────── 강화학습 ─────────────────── */

const ML_RL_DUCK_URL = 'https://8laos.github.io/reinforced-duck/';

function _vStMlReinforce(){
  // 선생님이 입력한 설명 (없으면 표시 안 함)
  const desc = (ML_RL_DESC[SEL_CLS?.id] || '').trim();
  const descHtml = desc
    ? `<div class="ml-rl-desc-box">${esc(desc).replace(/\n/g, '<br>')}</div>`
    : '';

  return `<div class="section">
    <div class="ml-intro">
      <b>🎮 강화학습</b>은 <u>잘하면 보상, 못하면 벌점</u>을 받으며 <u>여러 번 시도(시행착오)</u>하면서 점점 더 잘하게 되는 방식이에요.
    </div>

    <div class="ml-rl-game">
      <div class="ml-rl-title">🦆 강화학습 오리 (Reinforced Duck)</div>
      ${descHtml}
      <a class="btn-p ml-rl-open-big" href="${ML_RL_DUCK_URL}" target="_blank" rel="noopener">🎮 게임 열기 (새 탭)</a>
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

  const rlDesc = ML_RL_DESC[TC_CLS.id] || '';

  return phaseRow + `<div class="section">
    <div class="sec-title">활동 구성</div>
    <div class="ml-sub-explain">
      학생은 데이터를 직접 만들지 않고 <b>미리 준비된 이모지 데이터셋(3종 클래스)</b>에서 골라 분류기를 만들거나(지도), 그룹화를 체험(비지도)합니다.
      코드 작성은 0줄. 강화학습은 친구가 만든 <b>Reinforced Duck</b> 게임을 새 탭에서 직접 플레이합니다.
    </div>
    <div class="ml-tc-flow">
      <div class="ml-tc-flow-card"><b>📚 지도학습</b><br><small>3개 그룹 이름 정하고 사진 끌어담기 → 학습 → 테스트(드래그) 후 👍/👎 판정</small></div>
      <div class="ml-tc-flow-card"><b>🔍 비지도학습</b><br><small>사진을 2D 점 지도로 흩뿌리고 K-Means가 색으로 묶는 과정 관찰 → 정답 공개</small></div>
      <div class="ml-tc-flow-card"><b>🎮 강화학습</b><br><small>Reinforced Duck 게임을 새 탭에서 플레이 (설명은 아래에서 직접 작성)</small></div>
    </div>

    <div class="sec-title" style="margin-top:14px">🎮 강화학습 게임 설명 (학생 화면에 표시)</div>
    <div class="ml-sub-explain">강화학습 탭의 게임 위에 보여줄 설명을 자유롭게 적어주세요. 비워두면 설명 없이 게임 버튼만 보입니다.</div>
    <textarea id="ml-rl-desc-input" class="ml-rl-desc-edit" rows="4" placeholder="예: 직접 플레이하면서 더 높은 점수에 도전해보세요! 여러 번 하다 보면 요령이 생겨요.">${esc(rlDesc)}</textarea>
    <div class="ml-action-bar">
      <button class="btn-p btn-sm" data-action="ml-rl-save-desc">💾 설명 저장</button>
    </div>

    <div class="sec-title" style="margin-top:14px">제공되는 데이터셋 (각 3종)</div>
    <div class="ml-tc-ds-list">${datasets}</div>
  </div>`;
}
