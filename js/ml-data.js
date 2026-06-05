/* ═══════════════════════════════════════
   ml-data.js — 🤖 기계학습 체험용 데이터셋

   이모지를 Canvas에 다양한 폰트·크기·회전·배경색으로 그려
   클래스별로 N장씩 자동 생성한다. 각 이미지는 28×28 그레이스케일
   벡터(Float32Array length=784, 값 0~1)로 변환되어 KNN/K-Means
   알고리즘에 그대로 들어간다.

   ML_DATASETS 글로벌:
     [{ id, title, icon, classes: [{ id, label, emoji }] }, ...]

   API:
     mlGenerateDataset(datasetId, perClass=20)
       → { samples: [{ vec, label, classId, emoji, dataUrl }], classes }
     mlRenderEmojiThumb(emoji, size=64)
       → dataUrl (학생에게 보여줄 큰 미리보기)
═══════════════════════════════════════ */

const ML_DATASETS = [
  {
    id: 'fruit',
    title: '🍎 과일',
    icon: '🍎',
    desc: '사과·바나나·포도 — 색이 뚜렷하게 달라요',
    classes: [
      { id: 'apple',  label: '사과',  emoji: '🍎' },
      { id: 'banana', label: '바나나', emoji: '🍌' },
      { id: 'grape',  label: '포도',  emoji: '🍇' },
    ],
  },
  {
    id: 'animal',
    title: '🐶 동물',
    icon: '🐶',
    desc: '강아지·고양이·새 — 색과 실루엣이 달라요',
    classes: [
      { id: 'dog',  label: '강아지', emoji: '🐶' },
      { id: 'cat',  label: '고양이', emoji: '🐱' },
      { id: 'bird', label: '새',    emoji: '🐦' },
    ],
  },
  {
    id: 'face',
    title: '😀 표정',
    icon: '😀',
    desc: '기쁨·슬픔·화남 — 표정이 다르면 모델이 알아챌까?',
    classes: [
      { id: 'happy', label: '기쁨', emoji: '😀' },
      { id: 'sad',   label: '슬픔', emoji: '😢' },
      { id: 'angry', label: '화남', emoji: '😡' },
    ],
  },
];

function mlDatasetById(id){ return ML_DATASETS.find(d => d.id === id) || null; }

/* ─────────────────── Canvas 렌더링 ─────────────────── */

// 이모지 폰트 후보 (시스템마다 다른 폰트로 다양성 확보)
const _ML_EMOJI_FONTS = [
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
  '"Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
];

// 약간씩 다른 배경색 (학습 데이터 다양화)
const _ML_BG_COLORS = [
  '#ffffff', '#fff8e7', '#f0f9ff', '#fef2f2', '#f0fdf4',
  '#fdf4ff', '#fffbeb', '#eff6ff', '#f5f3ff', '#ecfeff'
];

// seed 기반 의사난수 (각 샘플이 결정론적으로 같은 모양을 갖도록)
function _mlSeededRng(seed){
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xFFFFFFFF;
  };
}

// 이모지를 Canvas에 그려서 28x28 그레이스케일 벡터로 변환
// + 학생에게 보여줄 64x64 미리보기 dataUrl 동시 반환
function _mlRenderSample(emoji, sampleIdx, classIdx){
  const rng = _mlSeededRng(sampleIdx * 9173 + classIdx * 31 + emoji.charCodeAt(0));
  const fontIdx = Math.floor(rng() * _ML_EMOJI_FONTS.length);
  // 정확도(같은 클래스끼리 비슷하게)를 위해 변동을 줄이고 배경은 흰색 고정
  const scale   = 0.86 + rng() * 0.14;     // 0.86~1.0 크기
  const rot     = (rng() - 0.5) * 0.26;    // ≈ ±7.5°
  const offX    = (rng() - 0.5) * 0.08;    // ±4% 위치
  const offY    = (rng() - 0.5) * 0.08;

  // 1) 큰 캔버스에 한 번 그려서 미리보기 dataUrl 생성
  const big = document.createElement('canvas');
  big.width = 64; big.height = 64;
  const bctx = big.getContext('2d');
  bctx.fillStyle = '#ffffff';
  bctx.fillRect(0, 0, 64, 64);
  bctx.save();
  bctx.translate(32 + offX * 64, 32 + offY * 64);
  bctx.rotate(rot);
  bctx.font = `${Math.floor(46 * scale)}px ${_ML_EMOJI_FONTS[fontIdx]}`;
  bctx.textAlign = 'center';
  bctx.textBaseline = 'middle';
  bctx.fillText(emoji, 0, 2);
  bctx.restore();
  const dataUrl = big.toDataURL('image/png');

  // 2) 28x28 RGB 벡터 (KNN/PCA 입력용). 색이 클래스 구분에 중요해서 채널 분리 유지.
  //    배경(흰색)은 0에 가깝게(1-x), 색이 있는 곳은 채널별로 값이 살아남 → 색+모양 모두 반영.
  const small = document.createElement('canvas');
  small.width = 28; small.height = 28;
  const sctx = small.getContext('2d');
  sctx.drawImage(big, 0, 0, 28, 28);
  const px = sctx.getImageData(0, 0, 28, 28).data;
  const vec = new Float32Array(28 * 28 * 3);
  for(let i = 0, j = 0; i < px.length; i += 4, j += 3){
    vec[j]     = 1 - px[i]     / 255;  // R
    vec[j + 1] = 1 - px[i + 1] / 255;  // G
    vec[j + 2] = 1 - px[i + 2] / 255;  // B
  }
  return { vec, dataUrl };
}

// 학생용 큰 미리보기만 한 장 생성 (테스트 카드 등에 사용)
function mlRenderEmojiThumb(emoji, size){
  size = size || 96;
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.font = `${Math.floor(size * 0.7)}px ${_ML_EMOJI_FONTS[0]}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.04);
  return cv.toDataURL('image/png');
}

/* ─────────────────── 데이터셋 생성 ─────────────────── */

// perClass: 클래스당 샘플 수. 학습용 N장 + 별도로 테스트 풀도 같은 함수로 만들고
// 다른 seed offset을 줘서 학습/테스트가 안 겹치게 한다.
function mlGenerateDataset(datasetId, perClass, opts){
  const def = mlDatasetById(datasetId);
  if(!def) return null;
  perClass = perClass || 20;
  opts = opts || {};
  const seedOffset = opts.seedOffset || 0;

  const samples = [];
  def.classes.forEach((cls, ci) => {
    for(let i = 0; i < perClass; i++){
      const { vec, dataUrl } = _mlRenderSample(cls.emoji, i + seedOffset, ci);
      samples.push({
        vec,
        label: cls.label,
        classId: cls.id,
        emoji: cls.emoji,
        dataUrl,
      });
    }
  });
  return { samples, classes: def.classes, def };
}

/* ═══════════════════════════════════════
   📈 단순 선형회귀 실습용 데이터셋

   학생이 산점도를 보고 직접 직선을 맞추고, 기계가 학습(경사하강법)하는
   과정을 관찰하는 용도. points 는 고정 데이터(재현 가능).
   - xUnit/yUnit: 축·예측 문구에 붙는 단위
   - predictX  : "새 값 예측" 기본 질문에 쓰는 x값 (데이터 범위 안)
   - yAnchor0  : true 면 y축 아래를 0에 고정 (점수·판매량처럼 0이 자연스러운 값)
═══════════════════════════════════════ */
const ML_LR_DATASETS = [
  {
    id: 'study',
    icon: '📖',
    title: '공부 시간 → 시험 점수',
    desc: '하루 공부 시간이 늘면 시험 점수는 어떻게 변할까요?',
    xLabel: '하루 공부 시간', xUnit: '시간',
    yLabel: '시험 점수',     yUnit: '점',
    yAnchor0: true, decimals: 0,
    predictX: 6.5,
    points: [
      [0.5, 32], [1, 38], [1.5, 45], [2, 44], [2.5, 55], [3, 52],
      [3.5, 63], [4, 61], [5, 72], [6, 74], [7, 83], [8, 88],
    ],
  },
  {
    id: 'icecream',
    icon: '🍦',
    title: '기온 → 아이스크림 판매량',
    desc: '날이 더울수록 아이스크림이 더 많이 팔릴까요?',
    xLabel: '기온',          xUnit: '℃',
    yLabel: '하루 판매량',   yUnit: '개',
    yAnchor0: true, decimals: 0,
    predictX: 27,
    points: [
      [20, 135], [22, 150], [23, 165], [25, 180], [26, 205], [28, 210],
      [29, 235], [30, 250], [31, 255], [33, 295], [34, 300], [35, 330],
    ],
  },
];

function mlLrDatasetById(id){ return ML_LR_DATASETS.find(d => d.id === id) || null; }

/* ═══════════════════════════════════════
   🌳 결정 트리 실습용 데이터셋 (표정)

   각 얼굴은 3가지 특징값(-2~+2 단계)으로 정의되고, 그 값에서 SVG 얼굴을 그림.
   - mouth(입 기울기): -2 많이 내려감 ~ +2 활짝 웃음
   - brow (눈썹 기울기): -2 안쪽 내려감(찡그림/화남) ~ +2 안쪽 올라감(ㅅ자/슬픔)
   - eye  (눈 크기): -2 가늘게 ~ +2 크게 뜸  ← 표정 구분엔 약한 특징(일부러 겹치게)
   설계: (입 × 눈썹) 두 축이면 두 칸막이로 깔끔히 갈리고, 눈 크기는 잘 안 갈림
        → 학생이 "어떤 특징이 잘 나누나" 직접 발견.
═══════════════════════════════════════ */
const ML_DT_DATASET = (() => {
  const classes = [
    { id: 'happy', label: '기쁨', emoji: '😀', color: '#22c55e' },
    { id: 'sad',   label: '슬픔', emoji: '😢', color: '#3b82f6' },
    { id: 'angry', label: '화남', emoji: '😡', color: '#ef4444' },
  ];
  const features = [
    { key: 'mouth', label: '입 기울기', lowDesc: '입꼬리 내려감', highDesc: '입꼬리 올라감' },
    { key: 'brow',  label: '눈썹 기울기', lowDesc: '안쪽 내려감(찡그림)', highDesc: '안쪽 올라감(ㅅ자)' },
    { key: 'eye',   label: '눈 크기', lowDesc: '가늘게', highDesc: '크게 뜸' },
  ];
  const base = [
    // 기쁨: 입꼬리 ↑, 눈썹 ~평평, 눈 다양
    { mouth: 2, brow: 0, eye: 0,  cls: 'happy' },
    { mouth: 2, brow: 1, eye: 1,  cls: 'happy' },
    { mouth: 1, brow: 0, eye: -1, cls: 'happy' },
    { mouth: 2, brow: 0, eye: 1,  cls: 'happy' },
    { mouth: 1, brow: 1, eye: 0,  cls: 'happy' },
    // 슬픔: 입꼬리 ↓, 눈썹 안쪽 ↑(ㅅ자), 눈 다양
    { mouth: -2, brow: 2, eye: 0,  cls: 'sad' },
    { mouth: -1, brow: 2, eye: 1,  cls: 'sad' },
    { mouth: -2, brow: 1, eye: -1, cls: 'sad' },
    { mouth: -1, brow: 2, eye: 0,  cls: 'sad' },
    { mouth: -2, brow: 2, eye: 1,  cls: 'sad' },
    // 화남: 입꼬리 ↓/앙다묾, 눈썹 안쪽 ↓(찡그림), 눈 부릅
    { mouth: -1, brow: -2, eye: 1, cls: 'angry' },
    { mouth: 0,  brow: -2, eye: 2, cls: 'angry' },
    { mouth: -1, brow: -1, eye: 0, cls: 'angry' },
    { mouth: -2, brow: -2, eye: 2, cls: 'angry' },
    { mouth: 0,  brow: -2, eye: 1, cls: 'angry' },
  ];
  // 같은 좌표 겹침 방지용 고정(시드) 지터
  let s = 20260605;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const samples = base.map((b, i) => ({
    ...b, id: 'f' + i,
    jx: (rnd() - 0.5) * 0.42, jy: (rnd() - 0.5) * 0.42,
  }));
  return { classes, features, samples };
})();

function mlDtFeature(key){ return ML_DT_DATASET.features.find(f => f.key === key) || null; }
function mlDtClass(id){ return ML_DT_DATASET.classes.find(c => c.id === id) || null; }
