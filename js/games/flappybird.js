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
      gameOverBonus: null,   // (score, pipesPassed) => score — 게임오버 보너스
      levelCalc: null        // (pipesPassed) => level — 레벨 계산
    };
    this.speedMultiplier = 1;  // 게임 속도 배수 (1 = 기본)
    this.currentLevel = 0;
    this.welcomeMessage = null;  // 시작 화면 커스텀 인사말 (학생 설정)

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
    // 시작 레벨 계산
    this.recalcLevel();
  }

  recalcLevel(){
    if(!this.hooks.levelCalc){ this.currentLevel = 0; return; }
    try {
      const r = this.hooks.levelCalc(this.pipesPassed);
      if(typeof r === 'number' && !isNaN(r)) this.currentLevel = r;
    } catch(e){ this.lastHookError = 'levelCalc: ' + e.message; }
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
    this.hooks.levelCalc = null;
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
        // 레벨 재계산 (hook 있으면)
        this.recalcLevel();
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

  // 텍스트 줄바꿈 (canvas 용)
  _wrapText(ctx, text, maxWidth, font){
    if(!text) return [''];
    ctx.save();
    if(font) ctx.font = font;
    const chars = [...text];
    const lines = [];
    let cur = '';
    for(const ch of chars){
      const test = cur + ch;
      if(ctx.measureText(test).width > maxWidth && cur){
        lines.push(cur);
        cur = ch;
      } else {
        cur = test;
      }
    }
    if(cur) lines.push(cur);
    ctx.restore();
    return lines.length ? lines.slice(0, 3) : ['']; // 최대 3줄
  }

  // 둥근 사각형 path (레벨 배지용)
  _roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // 레벨별 배경 테마 (levelCalc hook이 있을 때만 사용)
  getLevelTheme(){
    const themes = [
      {name:'낮',     sky:['#87ceeb','#c4e8f0'], pipe:'#5eaa3f', pipe2:'#4a8b32', pipe3:'#3a6b28', ground:'#ded895', groundDark:'#c3be7b', groundEdge:'#88aa4f', cloud:'rgba(255,255,255,0.7)', stars:false},
      {name:'아침노을',sky:['#ffb347','#ffdcb8'], pipe:'#7ba44b', pipe2:'#5e8a36', pipe3:'#3e6621', ground:'#e6cfa3', groundDark:'#c9b387', groundEdge:'#9f8a5b', cloud:'rgba(255,255,255,0.65)', stars:false},
      {name:'석양',   sky:['#ff7e67','#ffb08a'], pipe:'#a37a3f', pipe2:'#7b5a2b', pipe3:'#563d1b', ground:'#e8a76f', groundDark:'#c18859', groundEdge:'#8a5a33', cloud:'rgba(255,220,190,0.6)', stars:false},
      {name:'황혼',   sky:['#6a5acd','#b27dc9'], pipe:'#5b3d7d', pipe2:'#3e2754', pipe3:'#281536', ground:'#705b93', groundDark:'#56437a', groundEdge:'#382752', cloud:'rgba(220,200,255,0.45)', stars:false},
      {name:'밤',     sky:['#191970','#2d2580'], pipe:'#2b5f7a', pipe2:'#1d4254', pipe3:'#102735', ground:'#2f3562', groundDark:'#252a4f', groundEdge:'#161a33', cloud:'rgba(200,210,255,0.25)', stars:true},
      {name:'우주',   sky:['#0a0a2e','#1a0b3a'], pipe:'#4a1a7a', pipe2:'#2d0b50', pipe3:'#18052b', ground:'#1a1040', groundDark:'#100828', groundEdge:'#080416', cloud:'rgba(180,160,255,0.15)', stars:true}
    ];
    if(!this.hooks.levelCalc) return themes[0];
    const idx = Math.max(0, Math.min(themes.length - 1, this.currentLevel));
    return themes[idx];
  }

  draw(){
    const ctx = this.ctx, W = this.W, H = this.H;
    const theme = this.getLevelTheme();

    // 하늘 그라디언트 (레벨에 따라 변함)
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, theme.sky[0]); grd.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

    // 별 (밤/우주 테마)
    if(theme.stars){
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      // deterministic star positions
      for(let i = 0; i < 40; i++){
        const sx = ((i * 37) % W);
        const sy = ((i * 53) % (H - 100));
        const size = (i % 3 === 0) ? 2 : 1;
        const twinkle = Math.abs(Math.sin((this.frame + i * 20) * 0.02));
        ctx.globalAlpha = 0.4 + twinkle * 0.6;
        ctx.fillRect(sx, sy, size, size);
      }
      ctx.globalAlpha = 1;
    }

    // 구름 (장식)
    ctx.fillStyle = theme.cloud;
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
      ctx.fillStyle = theme.pipe;
      ctx.fillRect(p.x, 0, p.width, p.topH);
      ctx.fillRect(p.x, p.topH + p.gap, p.width, H - p.topH - p.gap - 60);
      // 파이프 테두리
      ctx.fillStyle = theme.pipe2;
      ctx.fillRect(p.x, 0, 3, p.topH);
      ctx.fillRect(p.x, p.topH + p.gap, 3, H - p.topH - p.gap - 60);
      // 입구
      ctx.fillStyle = theme.pipe;
      ctx.fillRect(p.x - 4, p.topH - 16, p.width + 8, 16);
      ctx.fillRect(p.x - 4, p.topH + p.gap, p.width + 8, 16);
      ctx.fillStyle = theme.pipe2;
      ctx.strokeStyle = theme.pipe3; ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 4, p.topH - 16, p.width + 8, 16);
      ctx.strokeRect(p.x - 4, p.topH + p.gap, p.width + 8, 16);
    }

    // 땅
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, H - 60, W, 60);
    ctx.fillStyle = theme.groundDark;
    for(let x = -(this.frame * 2) % 30; x < W; x += 30){
      ctx.fillRect(x, H - 60, 15, 60);
    }
    ctx.fillStyle = theme.groundEdge;
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

    // 점수 (큰 숫자, 상단 중앙) — gameStartScore hook 있을 때만 표시
    // (1단계 통과해서 score 변수를 만든 후에만 보임)
    if(this.hooks.gameStartScore){
      const scoreText = this.fmtScore(this.score);
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillText(scoreText, W/2 + 2, 62);
      ctx.fillStyle = '#fff';
      ctx.fillText(scoreText, W/2, 60);
    }

    // 지난 장애물 (우측 상단)
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(`지난 장애물: ${this.pipesPassed}`, W - 8, 22);

    // 레벨 (좌측 상단, levelCalc hook이 있을 때만)
    if(this.hooks.levelCalc){
      ctx.textAlign = 'left';
      const lvlText = `Lv.${this.currentLevel} · ${theme.name}`;
      ctx.font = 'bold 13px sans-serif';
      const tw = ctx.measureText(lvlText).width;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      this._roundRect(ctx, 8, 8, tw + 14, 22, 11);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(lvlText, 15, 23);
    }

    // 시작 안내
    if(!this.started){
      const hasCustomMsg = this.welcomeMessage && typeof this.welcomeMessage === 'string';
      // 메시지 길이에 따라 박스 크기 조정
      const mainMsg = hasCustomMsg ? this.welcomeMessage.slice(0, 40) : '🐦 플래피 버드';
      const msgLines = this._wrapText(ctx, mainMsg, 220, hasCustomMsg ? 'bold 15px sans-serif' : 'bold 16px sans-serif');
      const boxH = 34 + msgLines.length * 22;
      const boxW = 250;

      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(W/2 - boxW/2, H/2 - boxH/2, boxW, boxH);

      ctx.textAlign = 'center';
      ctx.fillStyle = hasCustomMsg ? '#ffe58a' : '#fff';
      ctx.font = hasCustomMsg ? 'bold 15px sans-serif' : 'bold 16px sans-serif';
      msgLines.forEach((line, i) => {
        ctx.fillText(line, W/2, H/2 - boxH/2 + 24 + i * 22);
      });

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '11px sans-serif';
      ctx.fillText('클릭 / Space 로 점프', W/2, H/2 - boxH/2 + boxH - 10);
    }

    // 게임 오버
    if(this.gameOver){
      const hasScore = !!this.hooks.gameStartScore;
      const boxH = hasScore ? 86 : 62;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(W/2 - 120, H/2 - 36, 240, boxH);
      ctx.fillStyle = '#ff6b6b';
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('💥 게임 오버', W/2, H/2 - 6);
      if(hasScore){
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`최종 점수: ${this.fmtScore(this.score)}`, W/2, H/2 + 16);
      }
      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.fillText('클릭해서 다시 시작', W/2, H/2 + (hasScore ? 36 : 16));
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
