/* ═══════════════════════════════════════
   games/flappybird.js — 플래피 버드 게임 엔진

   hooks로 학생 코드가 게임 동작을 바꿀 수 있음:
   - addScore(score): 장애물 하나 지날 때 호출, 새 점수 반환
   - finalScore(score, pipesPassed): 위 계산 후 호출 (보너스 등)
═══════════════════════════════════════ */

class FlappyBird {
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;

    // 학생 hook 슬롯
    this.hooks = {
      gameStartScore: null,  // () => number — 시작 점수
      addScore: null,        // (score) => score — 장애물 지날 때
      finalScore: null,      // (score, pipesPassed) => score — 추가 보너스
      gameOverBonus: null    // (score, pipesPassed) => score — 게임오버 보너스
    };
    this.speedMultiplier = 1;  // 게임 속도 배수 (1 = 기본)

    this.reset();
    this.running = false;

    // 입력 처리
    canvas.style.cursor = 'pointer';
    canvas.tabIndex = 0;
    canvas.addEventListener('click', () => this.onInput());
    canvas.addEventListener('keydown', e => {
      if(e.code === 'Space' || e.code === 'ArrowUp'){ e.preventDefault(); this.onInput(); }
    });
    // 페이지 전역 space (canvas 포커스 아닐 때도)
    this._globalKeyHandler = e => {
      if(!this.running) return;
      if(document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;
      if(document.activeElement?.closest('.CodeMirror')) return;
      if(e.code === 'Space'){ e.preventDefault(); this.onInput(); }
    };
    document.addEventListener('keydown', this._globalKeyHandler);
  }

  destroy(){
    this.running = false;
    document.removeEventListener('keydown', this._globalKeyHandler);
  }

  reset(){
    this.score = 0;
    this.pipesPassed = 0;
    this.birdY = this.H / 2;
    this.birdVY = 0;
    this.pipes = [];
    this.frame = 0;
    this.gameOver = false;
    this.started = false;
    this.lastHookError = null;
    this._gameOverApplied = false;
    // 시작 점수 hook 적용
    this.applyStartScore();
  }

  start(){
    if(this.running) return;
    this.running = true;
    this._lastTs = performance.now();
    this.loop();
  }

  stop(){ this.running = false; }

  setHook(name, fn){ this.hooks[name] = fn; }
  clearHooks(){
    this.hooks.addScore = null;
    this.hooks.finalScore = null;
    this.hooks.gameStartScore = null;
    this.hooks.gameOverBonus = null;
  }

  // 시작 점수를 hook에서 가져와 적용
  applyStartScore(){
    let initial = 0;
    if(this.hooks.gameStartScore){
      try {
        const r = this.hooks.gameStartScore();
        if(typeof r === 'number' && !isNaN(r)) initial = r;
      } catch(e){ this.lastHookError = 'gameStartScore: ' + e.message; }
    }
    this.score = initial;
  }

  onInput(){
    if(this.gameOver){ this.reset(); this.applyStartScore(); return; }
    if(!this.started) this.started = true;
    this.birdVY = -6.5;
  }

  spawnPipe(){
    const gap = 140;
    const minY = 60;
    const maxY = this.H - gap - 120;
    const topH = minY + Math.random() * (maxY - minY);
    this.pipes.push({ x: this.W + 20, topH, gap, width: 52, passed: false });
  }

  update(){
    if(!this.started || this.gameOver) return;

    // 속도 배수 (학생이 speed 변수로 조절)
    const sp = Math.max(0.3, Math.min(3, this.speedMultiplier || 1));

    // 중력
    this.birdVY += 0.38;
    if(this.birdVY > 10) this.birdVY = 10;
    this.birdY += this.birdVY;

    // 파이프 생성 (속도 빠를수록 자주 생성)
    const spawnInterval = Math.max(40, Math.round(95 / sp));
    if(this.frame % spawnInterval === 0) this.spawnPipe();

    const BIRD_X = this.W * 0.27;
    for(const p of this.pipes){
      p.x -= 2.2 * sp;
      if(!p.passed && p.x + p.width < BIRD_X){
        p.passed = true;
        this.pipesPassed++;
        // === 학생 hook 호출 ===
        this.lastHookError = null;
        if(this.hooks.addScore){
          try {
            const r = this.hooks.addScore(this.score);
            if(typeof r === 'number' && !isNaN(r)) this.score = r;
          } catch(e){ this.lastHookError = 'addScore: ' + e.message; }
        }
        if(this.hooks.finalScore){
          try {
            const r = this.hooks.finalScore(this.score, this.pipesPassed);
            if(typeof r === 'number' && !isNaN(r)) this.score = r;
          } catch(e){ this.lastHookError = 'finalScore: ' + e.message; }
        }
      }
    }
    this.pipes = this.pipes.filter(p => p.x + p.width > 0);

    // 충돌 검사
    const BW = 28, BH = 24;
    const bt = this.birdY, bb = this.birdY + BH;
    const bl = BIRD_X, br = BIRD_X + BW;
    for(const p of this.pipes){
      if(br > p.x && bl < p.x + p.width){
        if(bt < p.topH || bb > p.topH + p.gap){
          this.gameOver = true;
        }
      }
    }
    if(this.birdY + BH > this.H - 60) this.gameOver = true;
    if(this.birdY < 0){ this.birdY = 0; this.birdVY = 0; }

    // 게임 오버 시 보너스 hook
    if(this.gameOver && !this._gameOverApplied){
      this._gameOverApplied = true;
      if(this.hooks.gameOverBonus){
        try {
          const r = this.hooks.gameOverBonus(this.score, this.pipesPassed);
          if(typeof r === 'number' && !isNaN(r)) this.score = r;
        } catch(e){ this.lastHookError = 'gameOverBonus: ' + e.message; }
      }
    }

    this.frame++;
  }

  // 점수 포맷: 정수면 그대로, 소수점이면 소수 1자리
  fmtScore(s){
    if(typeof s !== 'number' || isNaN(s)) return '0';
    if(Number.isInteger(s)) return String(s);
    return s.toFixed(1);
  }

  draw(){
    const ctx = this.ctx, W = this.W, H = this.H;

    // 하늘 그라디언트
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#87ceeb'); grd.addColorStop(1, '#c4e8f0');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

    // 구름 (장식)
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for(let i = 0; i < 3; i++){
      const cx = ((this.frame * 0.2 + i * 150) % (W + 60)) - 30;
      const cy = 30 + i * 45;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI*2);
      ctx.arc(cx+14, cy+4, 12, 0, Math.PI*2);
      ctx.arc(cx-13, cy+4, 12, 0, Math.PI*2);
      ctx.fill();
    }

    // 파이프
    for(const p of this.pipes){
      ctx.fillStyle = '#5eaa3f';
      ctx.fillRect(p.x, 0, p.width, p.topH);
      ctx.fillRect(p.x, p.topH + p.gap, p.width, H - p.topH - p.gap - 60);
      // 파이프 테두리
      ctx.fillStyle = '#4a8b32';
      ctx.fillRect(p.x, 0, 3, p.topH);
      ctx.fillRect(p.x, p.topH + p.gap, 3, H - p.topH - p.gap - 60);
      // 입구
      ctx.fillStyle = '#5eaa3f';
      ctx.fillRect(p.x - 4, p.topH - 16, p.width + 8, 16);
      ctx.fillRect(p.x - 4, p.topH + p.gap, p.width + 8, 16);
      ctx.fillStyle = '#4a8b32';
      ctx.strokeStyle = '#3a6b28'; ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 4, p.topH - 16, p.width + 8, 16);
      ctx.strokeRect(p.x - 4, p.topH + p.gap, p.width + 8, 16);
    }

    // 땅
    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, H - 60, W, 60);
    ctx.fillStyle = '#c3be7b';
    for(let x = -(this.frame * 2) % 30; x < W; x += 30){
      ctx.fillRect(x, H - 60, 15, 60);
    }
    ctx.fillStyle = '#88aa4f';
    ctx.fillRect(0, H - 62, W, 4);

    // 새
    const BIRD_X = W * 0.27;
    const rot = Math.max(-0.4, Math.min(1.1, this.birdVY / 10));
    ctx.save();
    ctx.translate(BIRD_X + 14, this.birdY + 12);
    ctx.rotate(rot);
    // 몸
    ctx.fillStyle = '#ffde00';
    ctx.fillRect(-14, -12, 28, 24);
    ctx.fillStyle = '#e8c200';
    ctx.fillRect(-14, 6, 28, 6);
    // 날개
    ctx.fillStyle = '#f09a2a';
    const wingY = -2 + Math.sin(this.frame * 0.4) * 3;
    ctx.fillRect(-12, wingY, 12, 8);
    // 눈
    ctx.fillStyle = '#fff'; ctx.fillRect(4, -8, 7, 7);
    ctx.fillStyle = '#000'; ctx.fillRect(7, -6, 3, 4);
    // 부리
    ctx.fillStyle = '#f67d1b'; ctx.fillRect(12, -2, 6, 4);
    ctx.fillStyle = '#d9601a'; ctx.fillRect(12, 2, 6, 2);
    ctx.restore();

    // 점수 (큰 숫자, 상단 중앙)
    const scoreText = this.fmtScore(this.score);
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText(scoreText, W/2 + 2, 62);
    ctx.fillStyle = '#fff';
    ctx.fillText(scoreText, W/2, 60);

    // 지난 장애물 (우측 상단)
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(`지난 장애물: ${this.pipesPassed}`, W - 8, 22);

    // 시작 안내
    if(!this.started){
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(W/2 - 110, H/2 - 40, 220, 64);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('🐦 플래피 버드', W/2, H/2 - 14);
      ctx.font = '12px sans-serif';
      ctx.fillText('클릭 / Space 로 점프', W/2, H/2 + 8);
    }

    // 게임 오버
    if(this.gameOver){
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(W/2 - 120, H/2 - 48, 240, 86);
      ctx.fillStyle = '#ff6b6b';
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('💥 게임 오버', W/2, H/2 - 18);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`최종 점수: ${this.fmtScore(this.score)}`, W/2, H/2 + 4);
      ctx.font = '11px sans-serif';
      ctx.fillText('클릭해서 다시 시작', W/2, H/2 + 24);
    }

    // hook 에러 표시
    if(this.lastHookError){
      ctx.fillStyle = 'rgba(217,48,37,0.9)';
      ctx.fillRect(4, H - 84, W - 8, 18);
      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('⚠ ' + this.lastHookError.slice(0, 60), 8, H - 70);
    }
  }

  loop(){
    if(!this.running) return;
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

window.FlappyBird = FlappyBird;
