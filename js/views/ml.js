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

/* ─────────────────── 지도학습 ─────────────────── */

function _vStMlSupervised(){
  if(ML_SUP_PHASE === 'pick'  || !ML_SUP_DATASET) return _vStMlSupPick();
  if(ML_SUP_PHASE === 'learn') return _vStMlSupLearn();
  if(ML_SUP_PHASE === 'test')  return _vStMlSupTest();
  if(ML_SUP_PHASE === 'done')  return _vStMlSupDone();
  return _vStMlSupPick();
}

function _vStMlSupPick(){
  const cards = ML_DATASETS.map(d => {
    const previews = d.classes.map(c => `<span class="ml-pick-emoji">${c.emoji}</span>`).join('');
    return `<div class="ml-pick-card click" data-action="ml-sup-pick" data-did="${esc(d.id)}">
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
      <b>📚 지도학습</b>은 <u>정답이 있는 데이터</u>로 학습해서 새 데이터를 분류·예측하는 방식입니다.
      예: "이 사진은 사과일까 바나나일까?"
    </div>
    <div class="ml-stepbar">
      <div class="ml-step on">1. 데이터셋 선택</div>
      <div class="ml-step">2. 학습</div>
      <div class="ml-step">3. 테스트</div>
    </div>
    <div class="sec-title">데이터셋을 골라봐요</div>
    <div class="ml-pick-list">${cards}</div>
  </div>`;
}

function _vStMlSupLearn(){
  const ds = ML_SUP_DATASET;
  const train = ML_SUP_TRAIN_DATA?.samples || [];

  // 클래스별 샘플 카드 (대표 9장 정도씩)
  const perClassShown = 9;
  const classGroups = ds.classes.map(c => {
    const ss = train.filter(s => s.classId === c.id).slice(0, perClassShown);
    const thumbs = ss.map(s => `<img src="${s.dataUrl}" class="ml-thumb" alt="${esc(c.label)}"/>`).join('');
    const total = train.filter(s => s.classId === c.id).length;
    return `<div class="ml-cls-block">
      <div class="ml-cls-head"><span class="ml-cls-emoji">${c.emoji}</span> <b>${esc(c.label)}</b> <span class="ml-cls-cnt">${total}장</span></div>
      <div class="ml-thumbs">${thumbs}${total > perClassShown ? `<span class="ml-thumb-more">+${total - perClassShown}</span>` : ''}</div>
    </div>`;
  }).join('');

  const trained = !!ML_SUP_TRAINED;
  return `<div class="back-btn" data-action="ml-sup-back">← 다른 데이터셋 고르기</div>
    <div class="ml-stepbar">
      <div class="ml-step done">1. 데이터셋 선택</div>
      <div class="ml-step on">2. 학습</div>
      <div class="ml-step">3. 테스트</div>
    </div>
    <div class="section">
      <div class="sec-title">${ds.icon} ${esc(ds.title)} — 학습용 데이터</div>
      <div class="ml-sub-explain">
        클래스(정답)별로 묶인 이 이미지들을 모델(<b>KNN</b>)에 보여주면 학습 끝!
        모델은 <b>"비슷하게 생긴 것 찾기"</b> 방식으로 새 이미지를 분류해요.
      </div>
      ${classGroups}
    </div>
    <div class="ml-action-bar">
      ${trained
        ? `<div class="ml-trained-msg">🧠 학습 완료! 이제 테스트를 시작해봐요.</div>
           <button class="btn-p" data-action="ml-sup-start-test">🧪 테스트 시작 →</button>`
        : `<button class="btn-p" data-action="ml-sup-train">🧠 학습 시작</button>`}
    </div>`;
}

function _vStMlSupTest(){
  const ds = ML_SUP_DATASET;
  const total = ML_SUP_TEST_DATA?.samples?.length || 0;
  const idx = ML_SUP_TEST_IDX;
  const cur = ML_SUP_TEST_DATA.samples[idx];
  const lastResult = ML_SUP_LAST_RESULT;  // 직전에 본 카드의 예측 (없으면 null = 아직 안 본 새 카드)
  const correctSoFar = ML_SUP_TEST_RESULTS.filter(r => r.ok).length;

  // 확률 막대
  let probBars = '';
  if(lastResult){
    probBars = ds.classes.map(c => {
      const p = lastResult.probs[c.id] || 0;
      const isPred = lastResult.classId === c.id;
      return `<div class="ml-prob-row ${isPred ? 'pred' : ''}">
        <div class="ml-prob-label">${c.emoji} ${esc(c.label)}</div>
        <div class="ml-prob-bar"><div class="ml-prob-fill" style="width:${(p * 100).toFixed(0)}%"></div></div>
        <div class="ml-prob-pct">${(p * 100).toFixed(0)}%</div>
      </div>`;
    }).join('');
  }

  const verdict = lastResult
    ? (lastResult.ok
       ? `<div class="ml-verdict ok">🎉 정답! <b>${esc(lastResult.label)}</b> 맞췄어요</div>`
       : `<div class="ml-verdict ng">❌ 헷갈렸네요. 모델은 <b>${esc(lastResult.label)}</b>로 봤는데, 정답은 <b>${esc(lastResult.trueLabel)}</b></div>`)
    : '';

  return `<div class="back-btn" data-action="ml-sup-back-learn">← 학습 화면으로</div>
    <div class="ml-stepbar">
      <div class="ml-step done">1. 데이터셋 선택</div>
      <div class="ml-step done">2. 학습</div>
      <div class="ml-step on">3. 테스트</div>
    </div>
    <div class="section">
      <div class="sec-title">🧪 테스트 ${idx + 1} / ${total}  <span class="ml-test-meta">(맞춤: ${correctSoFar})</span></div>
      <div class="ml-test-card">
        <div class="ml-test-left">
          <img src="${cur.dataUrl}" class="ml-test-img" alt="test"/>
          <div class="ml-test-truth">진짜 정답: <b>${cur.emoji} ${esc(cur.label)}</b></div>
        </div>
        <div class="ml-test-right">
          ${lastResult
            ? `<div class="ml-test-q">이 이미지에 대해 모델이 예측한 결과:</div>${probBars}${verdict}
               <button class="btn-p btn-sm" data-action="ml-sup-next" style="margin-top:10px">다음 →</button>`
            : `<div class="ml-test-q">이 이미지를 모델은 뭐라고 판단할까?</div>
               <button class="btn-p" data-action="ml-sup-predict">🤔 모델에게 물어보기</button>`}
        </div>
      </div>
    </div>`;
}

function _vStMlSupDone(){
  const ds = ML_SUP_DATASET;
  const results = ML_SUP_TEST_RESULTS;
  const total = results.length;
  const correct = results.filter(r => r.ok).length;
  const acc = total ? (correct / total * 100).toFixed(1) : '0';
  const tier = correct === total ? 'perfect' : (correct / total >= 0.7 ? 'good' : 'mid');

  // 헷갈린 케이스 갤러리
  const wrongs = results.filter(r => !r.ok);
  const wrongHtml = wrongs.length
    ? wrongs.map(r => `<div class="ml-wrong-item">
        <img src="${r.dataUrl}" class="ml-thumb-big"/>
        <div class="ml-wrong-meta">
          <div>진짜: <b>${esc(r.trueLabel)}</b></div>
          <div>모델: <b style="color:var(--danger)">${esc(r.label)}</b></div>
        </div>
      </div>`).join('')
    : '<div class="ml-perfect">🌟 헷갈린 케이스 없음! 완벽한 모델!</div>';

  return `<div class="section">
    <div class="sec-title">${ds.icon} 테스트 결과</div>
    <div class="ml-score-big ${tier}">
      <div class="ml-score-pct">${acc}<span style="font-size:24px">%</span></div>
      <div class="ml-score-frac">${correct} / ${total} 맞춤</div>
    </div>
    <div class="ml-sub-explain">
      ${tier === 'perfect' ? '🎉 모든 이미지를 정확히 분류했어요!' :
        tier === 'good'    ? '👍 잘했어요! 대부분 맞췄네요.' :
                             '🤔 헷갈리는 부분이 있었네요. 사람이 봐도 비슷해 보이는 경우들이 있어요.'}
      KNN은 학습 데이터와 가장 비슷한 것을 찾는 방식이라 데이터가 많을수록 더 정확해져요.
    </div>
    <div class="sec-title" style="margin-top:14px">🔎 헷갈린 케이스</div>
    <div class="ml-wrong-list">${wrongHtml}</div>
    <div class="ml-action-bar">
      <button class="btn-sm" data-action="ml-sup-restart">🔁 다시 테스트</button>
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

function _vStMlReinforce(){
  return `<div class="section">
    <div class="ml-intro">
      <b>🎮 강화학습</b>은 <u>잘하면 보상, 못하면 벌점</u>을 주면서 스스로 학습시키는 방식이에요.
      여러분이 만들 플래피 버드의 점수 시스템도 비슷한 원리!
    </div>
    <div class="ml-rl-card">
      <div class="ml-rl-icon">🐦</div>
      <div class="ml-rl-body">
        <div class="ml-rl-title">플래피 버드 — 여러분의 코드가 게임을 학습시켜요</div>
        <div class="ml-rl-desc">
          🎮 미션 탭에 가서 플래피 버드를 직접 만들어봐요.<br>
          점수·레벨 같은 보상 시스템을 여러분이 직접 디자인하면, 그게 곧 강화학습의 핵심이에요.
        </div>
        <button class="btn-p" data-action="ml-go-mission">🎮 미션 탭으로 이동</button>
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
      코드 작성은 0줄. 강화학습은 기존 🎮 미션(플래피 버드)로 연결됩니다.
    </div>
    <div class="ml-tc-flow">
      <div class="ml-tc-flow-card"><b>📚 지도학습</b><br><small>데이터셋 선택 → 학습 → 테스트 카드로 정확도 확인</small></div>
      <div class="ml-tc-flow-card"><b>🔍 비지도학습</b><br><small>K-Means로 라벨 없이 그룹화 → 정답 공개로 정확도 확인</small></div>
      <div class="ml-tc-flow-card"><b>🎮 강화학습</b><br><small>🎮 미션의 플래피 버드 점수 시스템과 연결</small></div>
    </div>
    <div class="sec-title" style="margin-top:14px">제공되는 데이터셋</div>
    <div class="ml-tc-ds-list">${datasets}</div>
  </div>`;
}
