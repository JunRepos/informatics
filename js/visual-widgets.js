/* ═══════════════════════════════════════
   visual-widgets.js — 비주얼 OJ 시각화 위젯 라이브러리

   각 위젯은 (canvas, opts) 를 받아 Canvas 위에 그림을 그립니다.
   opts: { input, output, expected }
     input    — 문제의 stdin (예: "5\n180 240 195 320 210")
     output   — 학생 코드 실행 결과 stdout (없으면 미실행 상태)
     expected — 정답 stdout (output 과 동일하면 정답 → 트로피 표시)

   위젯 등록은 window.VISUAL_WIDGETS 객체에 함수로 추가.
   OJ 문제의 visualType 필드값과 키가 일치하면 자동 호출됨.
═══════════════════════════════════════ */

window.VISUAL_WIDGETS = window.VISUAL_WIDGETS || {};

// ── 공통 유틸 ──
function _vwClear(ctx, W, H){
  // 배경 — 따뜻한 톤
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#fdf6e3');
  grd.addColorStop(1, '#fbe9c2');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
}

function _vwNormalize(s){
  return String(s == null ? '' : s).replace(/\r\n/g, '\n').replace(/\s+$/gm, '').trim();
}

// ══════════════════════════════════════
//  📊 playlist-bars — 재생목록 막대 그래프
//  입력: 첫 줄 N, 둘째 줄 N개 정수 (시간초)
//  출력: 첫 줄 인덱스, 둘째 줄 시간
//  정답이면 해당 막대 황금색 + 🏆
// ══════════════════════════════════════
window.VISUAL_WIDGETS['playlist-bars'] = function(canvas, opts){
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  _vwClear(ctx, W, H);

  // 입력 파싱
  const lines = (opts.input || '').trim().split(/\n/);
  const N = parseInt(lines[0], 10);
  const times = (lines[1] || '').trim().split(/\s+/).map(Number).filter(n => !isNaN(n));

  if(!N || !times.length){
    ctx.fillStyle = '#7a6649';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ 입력 데이터가 없습니다', W/2, H/2);
    return;
  }

  // 출력 파싱 — 첫 줄 = 강조 인덱스, 둘째 줄 = 시간
  let highlightIdx = -1;
  let highlightTime = null;
  let outputValid = false;
  if(opts.output){
    const oLines = String(opts.output).trim().split(/\n/);
    highlightIdx = parseInt(oLines[0], 10);
    highlightTime = oLines[1] ? parseInt(oLines[1], 10) : null;
    outputValid = !isNaN(highlightIdx) && highlightIdx >= 0 && highlightIdx < N;
  }

  // 정답 여부
  const isCorrect = opts.output && opts.expected &&
    _vwNormalize(opts.output) === _vwNormalize(opts.expected);

  // 제목 영역
  ctx.fillStyle = '#5b4636';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎵 내 재생목록', W/2, 28);

  // 정답 시 트로피 (제목 위)
  if(isCorrect){
    ctx.font = '34px sans-serif';
    ctx.fillText('🏆', W/2, 68);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#d97706';
    ctx.fillText(`찾았어요! 인덱스 ${highlightIdx} — ${times[highlightIdx]}초`, W/2, 92);
  } else if(opts.output){
    ctx.font = '12px sans-serif';
    ctx.fillStyle = outputValid ? '#5b4636' : '#dc2626';
    ctx.fillText(outputValid ? `🔎 인덱스 ${highlightIdx}번 노래 골랐어요!` : '🤔 출력 형식을 다시 확인해 봐요', W/2, 56);
  } else {
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#7a6649';
    ctx.fillText('▶ 코드를 실행하면 결과가 여기 표시돼요', W/2, 56);
  }

  // 막대 영역
  const topY = 110;
  const baseY = H - 60;
  const maxBarH = baseY - topY - 18;
  const totalGap = 14;
  const sideMargin = 30;
  const availW = W - sideMargin * 2;
  const barW = Math.max(20, (availW - (N - 1) * totalGap) / N);
  const startX = sideMargin + (availW - (barW * N + (N - 1) * totalGap)) / 2;
  const maxT = Math.max(...times, 1);

  // 베이스라인
  ctx.strokeStyle = '#a08868';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(20, baseY);
  ctx.lineTo(W - 20, baseY);
  ctx.stroke();

  // 막대들
  for(let i = 0; i < N; i++){
    const x = startX + i * (barW + totalGap);
    const h = (times[i] / maxT) * maxBarH;
    const y = baseY - h;

    const isWinner = i === highlightIdx;

    // 막대 본체
    if(isWinner && isCorrect){
      // 황금색 그라디언트 + 글로우
      ctx.save();
      ctx.shadowColor = 'rgba(251, 191, 36, 0.7)';
      ctx.shadowBlur = 14;
      const grd = ctx.createLinearGradient(x, y, x, baseY);
      grd.addColorStop(0, '#fde047');
      grd.addColorStop(0.5, '#fbbf24');
      grd.addColorStop(1, '#d97706');
      ctx.fillStyle = grd;
      ctx.fillRect(x, y, barW, h);
      ctx.restore();
      // 별 장식
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⭐', x + barW/2, y - 6);
    } else if(isWinner && outputValid){
      // 학생이 골랐으나 정답 X — 파란 강조
      const grd = ctx.createLinearGradient(x, y, x, baseY);
      grd.addColorStop(0, '#60a5fa');
      grd.addColorStop(1, '#2563eb');
      ctx.fillStyle = grd;
      ctx.fillRect(x, y, barW, h);
    } else {
      // 일반 막대
      const grd = ctx.createLinearGradient(x, y, x, baseY);
      grd.addColorStop(0, '#cbd5e1');
      grd.addColorStop(1, '#94a3b8');
      ctx.fillStyle = grd;
      ctx.fillRect(x, y, barW, h);
    }

    // 막대 테두리
    ctx.strokeStyle = isWinner && isCorrect ? '#a16207' : '#64748b';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, barW - 1, h - 1);

    // 시간 라벨 (막대 위)
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1c1108';
    ctx.fillText(`${times[i]}s`, x + barW/2, y - 6);

    // 인덱스 라벨 (막대 아래)
    ctx.fillStyle = isWinner ? (isCorrect ? '#d97706' : '#2563eb') : '#5b4636';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`[${i}]`, x + barW/2, baseY + 16);

    // 음표 아이콘 (막대 위 작게, 윈너만)
    if(isWinner){
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('🎵', x + barW/2, y + h/2 + 5);
    }
  }

  // 범례 (하단)
  ctx.fillStyle = '#7a6649';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('각 막대 = 한 노래의 재생 시간 (초)', W/2, H - 22);
};

// ── 위젯 호출 헬퍼 ──
window.renderVisualWidget = function(canvas, type, opts){
  const fn = window.VISUAL_WIDGETS[type];
  if(!fn){
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fef2f2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`⚠️ 알 수 없는 시각화: ${type}`, canvas.width/2, canvas.height/2);
    return;
  }
  try {
    fn(canvas, opts || {});
  } catch(err){
    console.error('[visual-widget] error:', err);
  }
};
