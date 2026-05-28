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
    desc: '사과·바나나·포도·오렌지 — 색과 모양으로 구분돼요',
    classes: [
      { id: 'apple',  label: '사과',  emoji: '🍎' },
      { id: 'banana', label: '바나나', emoji: '🍌' },
      { id: 'grape',  label: '포도',  emoji: '🍇' },
      { id: 'orange', label: '오렌지', emoji: '🍊' },
    ],
  },
  {
    id: 'animal',
    title: '🐶 동물',
    icon: '🐶',
    desc: '강아지·고양이·새·물고기 — 실루엣이 꽤 달라요',
    classes: [
      { id: 'dog',  label: '강아지', emoji: '🐶' },
      { id: 'cat',  label: '고양이', emoji: '🐱' },
      { id: 'bird', label: '새',    emoji: '🐦' },
      { id: 'fish', label: '물고기', emoji: '🐟' },
    ],
  },
  {
    id: 'face',
    title: '😀 표정',
    icon: '😀',
    desc: '기쁨·슬픔·화남·놀람 — 표정이 다르면 모델이 알아챌까?',
    classes: [
      { id: 'happy',    label: '기쁨', emoji: '😀' },
      { id: 'sad',      label: '슬픔', emoji: '😢' },
      { id: 'angry',    label: '화남', emoji: '😡' },
      { id: 'surprise', label: '놀람', emoji: '😲' },
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
  const bgIdx   = Math.floor(rng() * _ML_BG_COLORS.length);
  const scale   = 0.7 + rng() * 0.3;       // 0.7~1.0 크기
  const rot     = (rng() - 0.5) * 0.5;     // -0.25 ~ +0.25 rad (≈ ±14°)
  const offX    = (rng() - 0.5) * 0.15;    // ±7.5% 위치
  const offY    = (rng() - 0.5) * 0.15;

  // 1) 큰 캔버스에 한 번 그려서 미리보기 dataUrl 생성
  const big = document.createElement('canvas');
  big.width = 64; big.height = 64;
  const bctx = big.getContext('2d');
  bctx.fillStyle = _ML_BG_COLORS[bgIdx];
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

  // 2) 28x28 그레이스케일 벡터 (KNN 입력용)
  const small = document.createElement('canvas');
  small.width = 28; small.height = 28;
  const sctx = small.getContext('2d');
  sctx.drawImage(big, 0, 0, 28, 28);
  const px = sctx.getImageData(0, 0, 28, 28).data;
  const vec = new Float32Array(784);
  for(let i = 0, j = 0; i < px.length; i += 4, j++){
    // RGB → 그레이스케일(0~1). 배경이 밝으니 1에서 빼서 "획이 있는 곳=큰 값"으로
    const gray = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    vec[j] = 1 - gray;
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
