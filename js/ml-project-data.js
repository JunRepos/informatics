/* ═══════════════════════════════════════
   ml-project-data.js — 🧩 AI 프로젝트 매니저 (5차시: 기계학습으로 문제 해결)

   학생이 "문제 정의 → 데이터 → 모델 선정·학습 → 평가 → 성찰"의 4단계 구현 과정을
   직접 결정하고, ③·④단계는 미리 탑재한 실제 데이터로 진짜 모델을 학습시켜
   진짜 정확도를 본다. 선택·근거·성찰은 학번별로 저장(세특 원천).

   저장: 기존 aiactivity 노드 재사용 → aiactivity/submissions/{cid}/mlproj-<id>/{학번}
        answers = { need, needWhy, typePick, modelKey, modelWhy, runsLog,
                    finalModelKey, finalAcc, <reflect 필드들...> }

   새 시나리오는 MLP_LIST 에 추가만 하면 됨.
═══════════════════════════════════════ */

// 모델 카드 메타 (③단계 모델 선택지)
const MLP_MODELS = {
  logistic: { icon: '📊', label: '로지스틱 회귀', task: 'classification',
    desc: '각 특징에 가중치를 줘 확률(0~1)로 분류해요. 경계는 직선/평면.',
    good: '어떤 특징이 결과를 끌어올리는지 가중치로 해석', bad: '복잡한 경계는 약함 · 기본은 2분류' },
  tree: { icon: '🌳', label: '결정 트리', task: 'classification',
    desc: '질문을 던져(예: 성별은?) 가지를 쳐 나눠요. 규칙을 사람이 눈으로 봐요.',
    good: '해석이 쉽고 어떤 특징을 먼저 보는지 드러남', bad: '데이터에 너무 맞추면(과적합) 새 데이터에 약함' },
  knn: { icon: '👥', label: 'kNN (최근접 이웃)', task: 'classification',
    desc: '가장 가까운 이웃 k명의 다수결로 분류해요.',
    good: '단순하고 직관적', bad: '특징 단위(스케일)에 민감 · 데이터 많으면 느림' },
  linreg: { icon: '📈', label: '선형회귀', task: 'regression',
    desc: '직선 하나로 연속값을 예측해요.',
    good: '간단하고 추세가 한눈에', bad: '곡선 관계는 못 잡음' },
  kmeans: { icon: '🎯', label: 'k-평균 군집', task: 'clustering',
    desc: '정답 없이 가까운 것끼리 k개 그룹으로 묶어요.',
    good: '라벨 없이 숨은 구조 발견', bad: 'k를 직접 정해야 · 시작값에 결과가 흔들림' },
};

// 예측 유형(②③에서 학생이 맞히는 갈래)
const MLP_TYPES = {
  classification: { icon: '🏷️', label: '분류', hint: '정해진 보기 중 하나로 (살았다/죽었다, 합격/불합격)' },
  regression:     { icon: '📈', label: '회귀', hint: '연속된 숫자값으로 (점수, 가격, 기록)' },
  clustering:     { icon: '🧩', label: '군집', hint: '정답 없이 비슷한 것끼리 묶기' },
};

/* ─── 🚢 메인: 타이타닉 생존 분류 데이터 ───
   실제 타이타닉의 성별×객실등급별 생존율 통계를 반영한 대표 학습용 표본.
   (정확한 승객 명부가 아니라 문서화된 생존율 분포에서 재현 가능하게 생성 — 사회적 편향이 그대로 담김) */
const MLP_TITANIC_ROWS = (() => {
  // [sex(0=남,1=여), pclass, 생존율, 인원] — 실제 생존율 분포의 경향(여성↑·상위등급↑)을 반영한 학습용 표본
  const groups = [
    [1, 1, 0.97, 16], [1, 2, 0.92, 14], [1, 3, 0.68, 22],
    [0, 1, 0.32, 20], [0, 2, 0.15, 16], [0, 3, 0.12, 28],
  ];
  let s = 20260609;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const rows = [];
  groups.forEach(([sex, pclass, rate, nn]) => {
    for(let i = 0; i < nn; i++){
      let age = Math.round((pclass === 1 ? 38 : pclass === 2 ? 30 : 26) + (rnd() - 0.5) * 26);
      age = Math.max(1, Math.min(70, age));
      const sibsp = rnd() < 0.28 ? 1 : (rnd() < 0.12 ? 2 : 0);
      const parch = rnd() < 0.22 ? 1 : 0;
      const childBonus = age < 15 ? 0.22 : 0;
      const survived = rnd() < Math.min(0.99, rate + childBonus) ? 1 : 0;
      rows.push({ sex, pclass, age, sibsp, parch, survived });
    }
  });
  return rows;
})();

const MLP_LIST = [
  /* ═══════ 메인 (전원 공통) ═══════ */
  {
    id: 'titanic',
    icon: '🚢',
    tag: '메인',
    title: '타이타닉, 누가 살아남았을까?',
    subtitle: '생존 분류',
    task: 'classification',
    mlNeeded: true,
    story: '1912년 침몰한 타이타닉호. 승객 명단에는 <b>성별·나이·객실 등급·동승 가족 수</b>가 적혀 있고, 각 사람이 <b>살았는지(생존) 죽었는지</b>도 기록돼 있어요. 이 데이터로 "어떤 사람이 살아남았는가"의 패턴을 학습해, <b>새로운 승객의 생존 여부를 예측</b>하는 것이 목표예요.',
    define: {
      mlAnswer: 'ml',
      q1: '생존을 정하는 규칙을 우리가 정확히 적을 수 있나요? (예: "나이가 X 미만이면 생존") → 딱 떨어지지 않아요.',
      q2: '대신 살았는지/죽었는지가 적힌 <b>예시 데이터가 충분히</b> 있나요? → 네, 많이 있어요.',
      feedbackMl: '맞아요! 규칙을 딱 정하긴 어렵지만 <b>정답이 달린 데이터가 많을 때</b>, 데이터에서 패턴을 학습하는 기계학습이 잘 맞아요.',
      feedbackRule: '음, 생존 여부는 "키 ÷ 몸무게" 처럼 공식 하나로 안 나와요. 규칙이 명확하지 않고 정답 데이터가 많으니 <b>기계학습</b>이 더 적절해요. (다시 생각해볼까요?)',
    },
    predictWhat: '한 승객이 <b>생존</b>인지 <b>사망</b>인지',
    typeAnswer: 'classification',
    typeWhy: '"생존 / 사망" 둘 중 하나로 나누는 문제죠? 정해진 보기 중 하나를 고르는 건 <b>분류</b>예요. (생존=1, 사망=0인 이진분류)',
    target: { key: 'survived', posValue: 1, posLabel: '생존', negLabel: '사망' },
    features: [
      { key: 'sex',    label: '성별',        cats: { 0: '남', 1: '여' } },
      { key: 'pclass', label: '객실 등급',   cats: { 1: '1등실', 2: '2등실', 3: '3등실' } },
      { key: 'age',    label: '나이',        unit: '세' },
      { key: 'sibsp',  label: '동승 형제/배우자', unit: '명' },
      { key: 'parch',  label: '동승 부모/자녀',   unit: '명' },
    ],
    rows: MLP_TITANIC_ROWS,
    models: ['logistic', 'tree', 'knn'],
    reflectPrompts: [
      { id: 'reflectLimit',  icon: '📉', label: '모델의 한계',          rows: 3, placeholder: '정확도가 100%가 아닌 이유는 뭘까요? 모델이 자주 틀리는 사람은 어떤 사람일까요?' },
      { id: 'reflectBias',   icon: '⚖️', label: '데이터에 담긴 편향',    rows: 4, placeholder: '생존이 성별·객실 등급에 크게 갈렸어요. 이런 데이터로 학습한 AI를 현실(보험·채용 등)에 쓰면 어떤 문제가 생길까요?' },
      { id: 'reflectCareer', icon: '🧭', label: '내 관심·진로와의 연결', rows: 4, placeholder: '내가 관심 있는 분야에서 이런 분류 모델을 쓴다면 어디에 쓸 수 있을까요? 그때 조심해야 할 편향은?' },
      { id: 'reflectMore',   icon: '🔎', label: '더 탐구하고 싶은 점',   rows: 3, placeholder: '특징을 바꾸거나 데이터를 더 모으면 어떻게 될지, 궁금한 점을 적어보세요.' },
    ],
  },

  /* ═══════ 확장 ①: 분류 · 보건/의료 ═══════ */
  {
    id: 'health',
    icon: '🩺',
    tag: '확장',
    title: '건강검진 데이터로 위험군 찾기',
    subtitle: '분류 · 보건/의료',
    task: 'classification',
    mlNeeded: true,
    story: '보건소에 건강검진 기록이 쌓여 있어요. <b>나이·BMI·수축기 혈압·주당 운동 횟수</b>와 함께, 의사 선생님이 판정한 <b>위험군 여부</b>가 적혀 있죠. 이 데이터로 패턴을 학습해 <b>새로운 검진자가 위험군인지 미리 예측</b>하고, 위험군에게 정밀검사를 먼저 안내하는 것이 목표예요.',
    define: {
      mlAnswer: 'ml',
      q1: '위험군 판정 규칙을 공식 하나로 정확히 적을 수 있나요? → 나이·혈압·운동량이 얽혀 있어 딱 떨어지지 않아요.',
      q2: '의사가 판정한 <b>정답이 달린 데이터가 충분히</b> 있나요? → 네, 많이 쌓여 있어요.',
      feedbackMl: '맞아요! 여러 요인이 복합적으로 작용해 규칙을 적기 어렵고, <b>정답이 달린 데이터가 많으니</b> 기계학습이 적절해요.',
      feedbackRule: '음, 위험군 여부는 BMI처럼 공식 하나로 떨어지지 않아요. 여러 요인이 얽혀 있고 정답 데이터가 많으니 <b>기계학습</b>이 더 적절해요. (다시 생각해볼까요?)',
    },
    predictWhat: '한 검진자가 <b>위험군</b>인지 <b>정상</b>인지',
    typeAnswer: 'classification',
    typeWhy: '"위험군 / 정상" 둘 중 하나로 나누는 문제죠? 정해진 보기 중 하나를 고르는 건 <b>분류</b>(이진분류)예요.',
    target: { key: 'risk', posValue: 1, posLabel: '위험군', negLabel: '정상' },
    features: [
      { key: 'age',      label: '나이',         unit: '세' },
      { key: 'bmi',      label: 'BMI',          unit: '' },
      { key: 'sbp',      label: '수축기 혈압',  unit: '' },
      { key: 'exercise', label: '주당 운동',    unit: '회' },
    ],
    rows: (() => {
      let s = 20260610;
      const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      const rows = [];
      for(let i = 0; i < 30; i++){   // 위험군: 나이·BMI·혈압이 대체로 높음 (정상과 일부 겹치게 — 100% 못 맞히도록)
        rows.push({
          age: Math.round(33 + rnd() * 42), bmi: Math.round((23 + rnd() * 10) * 10) / 10,
          sbp: Math.round(118 + rnd() * 50), exercise: Math.round(rnd() * 4), risk: 1,
        });
      }
      for(let i = 0; i < 30; i++){   // 정상 (경계 구간 겹침 포함)
        rows.push({
          age: Math.round(17 + rnd() * 48), bmi: Math.round((18.5 + rnd() * 9) * 10) / 10,
          sbp: Math.round(102 + rnd() * 36), exercise: Math.round(rnd() * 6), risk: 0,
        });
      }
      return rows;
    })(),
    models: ['logistic', 'tree', 'knn'],
    reflectPrompts: [
      { id: 'reflectLimit',  icon: '📉', label: '모델이 틀리면 어떻게 될까?',   rows: 3, placeholder: '위험군인데 정상으로 예측(놓침)하는 것과, 정상인데 위험군으로 예측(과잉 경고)하는 것 — 어느 쪽이 더 위험할까요? 왜요?' },
      { id: 'reflectBias',   icon: '🔒', label: '민감한 데이터',               rows: 3, placeholder: '건강 데이터는 민감한 개인정보예요. 이런 데이터로 AI를 만들 때 꼭 지켜야 할 것은 무엇일까요?' },
      { id: 'reflectCareer', icon: '🧭', label: '내 관심·진로와의 연결',       rows: 3, placeholder: '의료가 아니어도 좋아요 — 내 관심 분야에서 "위험을 미리 찾아내는 분류"를 쓴다면 어디에 쓸 수 있을까요?' },
      { id: 'reflectMore',   icon: '🔎', label: '더 탐구하고 싶은 점',         rows: 2, placeholder: '어떤 특징(데이터)을 더 모으면 예측이 정확해질까요?' },
    ],
  },

  /* ═══════ 확장 ②: 회귀 · 스포츠 ═══════ */
  {
    id: 'sprint',
    icon: '🏃',
    tag: '확장',
    title: '훈련 시간으로 100m 기록 예측',
    subtitle: '회귀 · 스포츠',
    task: 'regression',
    mlNeeded: true,
    story: '육상부 코치가 부원들의 <b>주당 훈련 시간</b>과 <b>100m 기록(초)</b>을 기록해 뒀어요. 이 데이터로 둘 사이의 관계를 학습해서, <b>훈련 계획에 따라 기록이 얼마나 좋아질지 숫자로 예측</b>하는 것이 목표예요.',
    define: {
      mlAnswer: 'ml',
      q1: '"훈련 1시간당 기록이 몇 초 줄어드는지"를 우리가 미리 알 수 있나요? → 아니요, 데이터를 봐야 알아요.',
      q2: '훈련 시간 ↔ 기록 짝이 적힌 <b>데이터가 충분히</b> 있나요? → 네!',
      feedbackMl: '맞아요! 관계(기울기)를 미리 알 수 없으니 <b>데이터에서 직선을 학습</b>하는 기계학습(회귀)이 적절해요.',
      feedbackRule: '음, 훈련과 기록의 관계는 공식으로 미리 정해져 있지 않아요. 데이터에서 배워야 하니 <b>기계학습</b>이 적절해요. (다시 생각해볼까요?)',
    },
    predictWhat: '훈련 시간에 따른 <b>100m 기록(초)</b> — 연속된 숫자',
    typeAnswer: 'regression',
    typeWhy: '기록(13.2초, 15.8초…)은 정해진 보기가 아니라 <b>연속된 숫자값</b>이죠? 숫자를 예측하는 건 <b>회귀</b>예요.',
    regression: { x: 'train', y: 'record', xLabel: '주당 훈련 시간', xUnit: '시간', yLabel: '100m 기록', yUnit: '초' },
    features: [
      { key: 'train', label: '주당 훈련 시간', unit: '시간' },
    ],
    rows: (() => {
      let s = 20260611;
      const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      const rows = [];
      for(let i = 0; i < 24; i++){
        const train = Math.round((1 + rnd() * 11) * 2) / 2;             // 1~12시간 (0.5 단위)
        const record = Math.round((17.4 - 0.33 * train + (rnd() - 0.5) * 0.9) * 100) / 100;
        rows.push({ train, record });
      }
      return rows;
    })(),
    models: ['linreg'],
    reflectPrompts: [
      { id: 'reflectLimit',  icon: '📉', label: '직선 예측의 한계',        rows: 3, placeholder: '훈련을 주 50시간 하면 기록이 0초가 될까요? 직선 예측을 어디까지 믿을 수 있을까요?' },
      { id: 'reflectVar',    icon: '🎯', label: '직선이 못 담는 것',       rows: 3, placeholder: '훈련 시간이 같은데도 기록이 다른 이유는 뭘까요? 어떤 특징을 추가하면 좋을까요?' },
      { id: 'reflectCareer', icon: '🧭', label: '내 관심·진로와의 연결',   rows: 3, placeholder: '내 분야에서 "숫자를 예측하는 회귀"를 쓴다면 무엇을 예측하고 싶나요?' },
    ],
  },

  /* ═══════ 확장 ③: 군집 · 경영/마케팅 ═══════ */
  {
    id: 'customers',
    icon: '🛍️',
    tag: '확장',
    title: '고객을 그룹으로 나눠 맞춤 이벤트',
    subtitle: '군집 · 경영/마케팅',
    task: 'clustering',
    mlNeeded: true,
    story: '가게 사장님에게 고객들의 <b>월 방문 횟수</b>와 <b>월 구매액</b> 데이터가 있어요. 그런데 이번엔 <u>정답(고객 유형)이 안 적혀</u> 있어요! <b>비슷한 고객끼리 그룹으로 묶어서</b>, 그룹별로 어울리는 맞춤 이벤트를 만드는 것이 목표예요.',
    define: {
      mlAnswer: 'ml',
      q1: '"단골" 기준을 사람이 임의로 정할 수도 있지만(방문 10회 이상?), 그 기준이 데이터의 진짜 모양과 맞는지는 알 수 없어요.',
      q2: '정답(라벨)은 없지만 <b>데이터는 충분히</b> 있어요 → 데이터가 스스로 그룹을 드러내게 할 수 있어요.',
      feedbackMl: '맞아요! <b>정답 라벨이 없을 때</b> 비슷한 것끼리 묶는 기계학습(비지도 · 군집)이 적절해요.',
      feedbackRule: '기준을 사람이 임의로 정하면(방문 10회 이상=단골?) 데이터의 진짜 모양과 어긋날 수 있어요. 데이터가 스스로 그룹을 드러내게 하는 <b>기계학습</b>이 더 적절해요. (다시 생각해볼까요?)',
    },
    predictWhat: '정답 없이, <b>비슷한 고객끼리 그룹</b>으로 묶기',
    typeAnswer: 'clustering',
    typeWhy: '정답(라벨) 없이 비슷한 것끼리 묶는 문제 — <b>군집</b>이에요. 정답을 보고 배우는 지도학습(분류·회귀)과 다른 점이죠!',
    cluster: { k: 3, labelKey: 'seg' },
    features: [
      { key: 'visits', label: '월 방문 횟수', unit: '회' },
      { key: 'spend',  label: '월 구매액',   unit: '만원' },
    ],
    rows: (() => {
      let s = 20260612;
      const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      const rows = [];
      const mk = (n, v0, vr, p0, pr, seg) => {
        for(let i = 0; i < n; i++) rows.push({
          visits: Math.round(v0 + rnd() * vr),
          spend: Math.round((p0 + rnd() * pr) * 10) / 10,
          seg,
        });
      };
      mk(12, 1, 6, 1.5, 5.5, 'a');   // 가끔 들르고 적게 구매
      mk(12, 7, 9, 4, 8, 'b');       // 자주 오고 중간 구매 (a와 경계 겹침)
      mk(12, 4, 7, 12, 18, 'c');     // 방문은 중간, 구매액 큼 (b와 경계 겹침)
      return rows;
    })(),
    models: ['kmeans'],
    reflectPrompts: [
      { id: 'reflectName',   icon: '🏷️', label: '군집에 이름 붙이기',      rows: 3, placeholder: '세 그룹의 평균(방문·구매액)을 보고 각 그룹에 이름을 붙여보세요. 그룹별로 어떤 이벤트가 어울릴까요?' },
      { id: 'reflectEthic',  icon: '⚖️', label: '맞춤 마케팅의 양면',      rows: 3, placeholder: '고객을 나눠 다르게 대하는 것의 좋은 점과, 조심해야 할 점(차별처럼 느껴질 수 있는 경우)은?' },
      { id: 'reflectCareer', icon: '🧭', label: '내 관심·진로와의 연결',   rows: 3, placeholder: '내 분야에서 "비슷한 것끼리 묶기(군집)"를 쓴다면 어디에 쓸 수 있을까요?' },
    ],
  },

  /* ═══════ 함정: ML이 필요 없는 문제 ═══════ */
  {
    id: 'bmi',
    icon: '⚖️',
    tag: '함정',
    title: '키·몸무게로 비만도(BMI) 판정하기',
    subtitle: 'ML이 필요할까?',
    task: 'none',
    mlNeeded: false,
    story: '보건 선생님이 학생들의 <b>키와 몸무게</b>로 비만도(BMI)를 자동 판정하는 프로그램을 원해요. 공식은 <b>BMI = 몸무게(kg) ÷ 키(m)²</b> 이고, 결과를 <b>저체중 / 정상 / 과체중 / 비만</b> 으로 정해진 기준에 따라 나눕니다.',
    define: {
      mlAnswer: 'rule',
      q1: '판정 규칙을 우리가 정확히 적을 수 있나요? → 네! 공식과 기준이 이미 명확해요.',
      q2: '데이터에서 패턴을 "학습"해야 하나요? → 아니요, 규칙이 확실하니 그대로 계산하면 돼요.',
      feedbackRule: '정확해요! 👏 <b>규칙(공식·기준)이 명확하면</b> 그대로 코드로 옮기는 게 100% 정확하고 빨라요. 이건 기계학습이 아니라 <b>그냥 프로그래밍</b>이 정답이에요. (모든 문제에 ML이 필요한 건 아니에요!)',
      feedbackMl: '잠깐 🤔 BMI는 "몸무게 ÷ 키²" 라는 <b>명확한 공식</b>과 정해진 기준이 있어요. 규칙이 분명한데 굳이 데이터로 학습할 필요가 있을까요? 이런 문제는 <b>그냥 프로그래밍</b>이 더 정확하고 간단해요.',
    },
    trapWhy: 'BMI는 공식과 기준이 이미 정해져 있어 규칙을 그대로 코드로 옮기면 <b>100% 정확</b>해요. 데이터로 패턴을 학습할 필요가 없으니 <b>ML이 필요 없는 문제</b>랍니다. 학습목표 ①: "ML로 풀 문제 / 그냥 프로그래밍으로 풀 문제"를 구분하기!',
    reflectPrompts: [
      { id: 'reflectTrap', icon: '💡', label: '왜 이 문제는 ML이 필요 없을까?', rows: 4, placeholder: '규칙이 명확한 문제와, 데이터로 학습해야 하는 문제는 무엇이 다를까요? 각각의 예를 하나씩 들어보세요.' },
    ],
  },
];

function mlpById(id){ return MLP_LIST.find(m => m.id === id) || null; }

// 특징값 → 보기 좋은 문자열 (cats 매핑 우선, 없으면 값+단위)
function mlpFmtFeat(feat, v){
  if(feat.cats && feat.cats[v] != null) return feat.cats[v];
  return v + (feat.unit ? feat.unit : '');
}

// target 값 → 라벨
function mlpFmtTarget(scn, v){
  const t = scn.target;
  if(!t) return String(v);
  return _mlBin(v, t.posValue) === 1 ? t.posLabel : t.negLabel;
}
