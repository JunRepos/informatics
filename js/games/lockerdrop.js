/* ═══════════════════════════════════════
   games/lockerdrop.js — 떨어지는 사물함 받기 (Action 게임)

   3차시(리스트) 학습용 액션 게임.

   규칙:
   - 화면 위에서 이모지가 계속 떨어진다
   - 학생이 lockers 변수에 정의한 종류 → 자동으로 받아냄 (+점수)
   - 학생이 정의 안 한 종류 → 통과 → 위험 아이템이면 ❤️-1
   - ❤️ 0 또는 시간 종료 시 게임 끝
   - 단계마다 등장 이모지·목표 점수·시간 다름

   학생 코드는 setLockers / setGrades 로 게임에 반영됨.
═══════════════════════════════════════ */

class LockerDrop {
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;

    // 단계 설정 (setStepConfig 로 주입)
    this.allowedItems = [];   // 받으면 점수 (학생이 lockers에 넣을 수 있는 후보)
    this.dangerItems  = [];   // 받으면 안 됨 (학생이 lockers에 안 넣어야 함)
    this.targetScore  = 10;
    this.timeLimit    = 30;   // 초
    this.maxHp        = 3;

    // 학생 코드 결과
    this.lockers = [];        // 1차원 lockers
    this.gridLockers = null;  // 2차원 grades — 행별 사물함

    // 단계 정보 (헤더)
    this.stepInfo = null;

    // 게임 상태
    this.score = 0;
    this.hp = 3;
    this.startTime = 0;       // performance.now()
    this.frame = 0;
    this.items = [];          // {emoji, x, y, vy, kind, caught}
    this.particles = [];
    this.popups = [];
    this.gameOver = false;
    this.gameWon = false;
    this.running = false;
    this.paused = true;       // 학생 코드 미실행 시 일시정지

    this.lastError = null;

    // hook 시스템 호환 (미션 시스템이 호출)
    this.hooks = {};
  }

  destroy(){ this.running = false; }

  // hook 시스템 호환 API
  setHook(){ /* lockerdrop은 별도 hook 없음 — 모두 applyState 통합 */ }
  clearHooks(){ this.reset(); }

  // mission system이 호출하는 표준 API
  applyState(state){
    state = state || {};
    this.lockers = Array.isArray(state.lockers) ? state.lockers.slice(0, 12) : [];
    this.gridLockers = Array.isArray(state.grades)
      ? state.grades.slice(0, 4).map(r => Array.isArray(r) ? r.slice(0, 6) : [])
      : null;
    this.lastError = state.error || null;
    // 코드가 적용되면 게임 자동 재시작
    this.reset();
    this.paused = false;
    this.startTime = performance.now();
  }

  // 단계 정보 (게임 헤더 + 게임 설정)
  setStep(stepInfo){
    this.stepInfo = stepInfo || null;
    if(stepInfo?.config){
      const c = stepInfo.config;
      this.allowedItems = c.allowed || [];
      this.dangerItems  = c.danger || [];
      this.targetScore  = c.targetScore ?? 10;
      this.timeLimit    = c.timeLimit ?? 30;
      this.maxHp        = c.maxHp ?? 3;
    }
  }

  reset(){
    this.score = 0;
    this.hp = this.maxHp;
    this.frame = 0;
    this.items = [];
    this.particles = [];
    this.popups = [];
    this.gameOver = false;
    this.gameWon = false;
    this._lastSpawnFrame = -100;
    this.startTime = performance.now();
  }

  start(){
    if(this.running) return;
    this.running = true;
    this.loop();
  }
  stop(){ this.running = false; }

  // ── 사물함 칸들 (1차원 또는 2차원의 한 행을 평탄화) ──
  _activeLockers(){
    if(this.gridLockers && this.gridLockers.length){
      // 2차원이면 행이 여러 개 — 모든 행의 합집합으로 받기 (시각화는 그리드)
      const flat = [];
      for(const row of this.gridLockers){
        if(Array.isArray(row)) flat.push(...row);
      }
      return flat;
    }
    return this.lockers;
  }

  // 학생 lockers 에 어떤 이모지가 있는지 빠른 검사
  _hasInLockers(emoji){
    const set = new Set(this._activeLockers().map(v => String(v)));
    return set.has(String(emoji));
  }

  spawnItem(){
    // 위험 + 안전 이모지 풀에서 랜덤
    const pool = [
      ...this.allowedItems.map(e => ({emoji: e, kind: 'safe'})),
      ...this.dangerItems.map(e => ({emoji: e, kind: 'danger'}))
    ];
    if(!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const x = 30 + Math.random() * (this.W - 60);
    const baseSpeed = 1.4 + Math.min(2, this.frame / 600); // 시간 지날수록 빨라짐
    this.items.push({
      emoji: pick.emoji,
      kind: pick.kind,
      x, y: -20,
      vy: baseSpeed,
      caught: false,
      missed: false,
      bounce: 0
    });
  }

  // 사물함 영역 (캐릭터 라인) — 화면 하단에서 100px 위
  _lockerY(){ return this.H - 88; }

  update(){
    if(this.gameOver || this.gameWon || this.paused) return;
    const elapsed = (performance.now() - this.startTime) / 1000;

    // 시간 종료
    if(elapsed >= this.timeLimit){
      if(this.score >= this.targetScore) this.gameWon = true;
      else this.gameOver = true;
      return;
    }

    // 스폰 (시간 갈수록 자주)
    const spawnInterval = Math.max(28, Math.round(75 - elapsed * 1.2));
    if(this.frame - this._lastSpawnFrame >= spawnInterval){
      this._lastSpawnFrame = this.frame;
      this.spawnItem();
    }

    // 아이템 이동 + 충돌
    const lockerY = this._lockerY();
    for(const it of this.items){
      it.y += it.vy;
      if(it.bounce > 0) it.bounce--;
      if(!it.caught && !it.missed && it.y >= lockerY){
        // 사물함 라인 도달 — 받을지 결정
        if(this._hasInLockers(it.emoji)){
          if(it.kind === 'safe'){
            it.caught = true;
            it.bounce = 16;
            this.score++;
            this.popups.push({x: it.x, y: lockerY, text: '+1', color: '#16a34a', life: 30});
            this._addParticles(it.x, lockerY, '#86efac', 8);
            // 목표 점수 달성 시 즉시 승리
            if(this.score >= this.targetScore){
              this.gameWon = true;
            }
          } else {
            // 위험인데 받음 → 패널티
            it.caught = true;
            it.bounce = 12;
            this.hp = Math.max(0, this.hp - 1);
            this.popups.push({x: it.x, y: lockerY, text: '-1 ❤️', color: '#dc2626', life: 35});
            this._addParticles(it.x, lockerY, '#fca5a5', 10);
            if(this.hp <= 0) this.gameOver = true;
          }
        } else {
          // lockers 에 없음 — 통과
          it.missed = true;
          if(it.kind === 'safe'){
            // 안전 아이템 놓침 — 살짝 회색 표시 (페널티 없음)
            this.popups.push({x: it.x, y: lockerY - 10, text: '...', color: '#94a3b8', life: 20});
          }
          // 위험 아이템 통과는 OK (학생이 잘 막은 것)
        }
      }
      // 화면 밖 (받았어도 살짝 더 떨어진 후 사라짐)
      if(it.y > this.H + 30) it.gone = true;
    }
    this.items = this.items.filter(i => !i.gone);

    // 파티클 / 팝업
    for(const p of this.particles){
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life--;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for(const p of this.popups){ p.y -= 0.7; p.life--; }
    this.popups = this.popups.filter(p => p.life > 0);

    this.frame++;
  }

  _addParticles(x, y, color, n){
    for(let i = 0; i < n; i++){
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5 - 1,
        size: 2 + Math.random() * 3,
        color, life: 22 + Math.random() * 14
      });
    }
  }

  // ── 그리기 ──
  draw(){
    const ctx = this.ctx, W = this.W, H = this.H;
    // 배경 — 하늘 같은 그라디언트
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#fef9e7');
    grd.addColorStop(1, '#fff5d4');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // 상단 헤더 (단계 정보)
    this._drawHeader();

    // HUD — 점수 / 생명 / 시간
    this._drawHUD();

    // 떨어지는 아이템들
    for(const it of this.items){
      ctx.save();
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 받은 직후 살짝 튕김
      const yo = it.bounce > 0 ? -Math.sin(it.bounce / 16 * Math.PI) * 14 : 0;
      // 위험 아이템엔 살짝 빨간 테두리 표시
      if(it.kind === 'danger' && !it.caught){
        ctx.shadowColor = 'rgba(220,38,38,0.6)';
        ctx.shadowBlur = 10;
      }
      ctx.globalAlpha = it.missed ? 0.4 : 1;
      ctx.fillText(it.emoji, it.x, it.y + yo);
      ctx.restore();
    }

    // 사물함 라인 + 칸
    this._drawLockers();

    // 파티클
    for(const p of this.particles){
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 30);
      ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 팝업
    for(const p of this.popups){
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.max(0, p.life / 35);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    // 일시정지 / 게임 오버 / 승리 오버레이
    if(this.paused && !this.gameOver && !this.gameWon){
      this._drawPausedOverlay();
    }
    if(this.gameWon) this._drawWinOverlay();
    if(this.gameOver) this._drawLoseOverlay();

    // 코드 에러
    if(this.lastError){
      ctx.fillStyle = 'rgba(220, 38, 38, 0.92)';
      ctx.fillRect(0, H - 22, W, 22);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('⚠ ' + String(this.lastError).slice(0, 56), 8, H - 7);
    }
  }

  _drawHeader(){
    const ctx = this.ctx, W = this.W;
    ctx.fillStyle = '#5b4636';
    ctx.fillRect(0, 0, W, 48);
    ctx.fillStyle = '#3d2f24';
    ctx.fillRect(0, 48, W, 2);
    if(this.stepInfo){
      ctx.fillStyle = '#ffd887';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`미션 ${this.stepInfo.idx + 1}${this.stepInfo.total ? ' / ' + this.stepInfo.total : ''}`, 10, 17);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText((this.stepInfo.title || '').slice(0, 32), 10, 36);
    } else {
      ctx.fillStyle = '#ffd887';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🗄️ 떨어지는 사물함 받기', W/2, 30);
    }
  }

  _drawHUD(){
    const ctx = this.ctx, W = this.W;
    const elapsed = this.paused ? 0 : Math.max(0, this.timeLimit - (performance.now() - this.startTime) / 1000);
    // 박스 배경
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(0, 50, W, 28);
    ctx.strokeStyle = '#cbb791';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 78); ctx.lineTo(W, 78); ctx.stroke();

    // HP (왼쪽)
    let hpStr = '';
    for(let i = 0; i < this.maxHp; i++) hpStr += i < this.hp ? '❤️' : '🤍';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#dc2626';
    ctx.fillText(hpStr, 8, 70);

    // 점수 (가운데) — 목표/현재
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.score >= this.targetScore ? '#16a34a' : '#1c1108';
    ctx.fillText(`${this.score} / ${this.targetScore} 점`, W/2, 70);

    // 시간 (오른쪽)
    ctx.textAlign = 'right';
    ctx.fillStyle = elapsed < 5 ? '#dc2626' : '#5b4636';
    ctx.fillText(`⏱ ${Math.ceil(elapsed)}s`, W - 8, 70);
  }

  _drawLockers(){
    const ctx = this.ctx, W = this.W;
    const y = this._lockerY();
    // 사물함 받침대
    ctx.fillStyle = '#cbb791';
    ctx.fillRect(0, y - 4, W, 6);
    ctx.fillStyle = '#a08868';
    ctx.fillRect(0, y + 2, W, 3);

    // 2차원이면 그리드, 1차원이면 한 줄
    if(this.gridLockers && this.gridLockers.length){
      this._drawGrid2D(y);
    } else {
      this._drawLockers1D(y);
    }
  }

  _drawLockers1D(y){
    const ctx = this.ctx, W = this.W;
    const items = this.lockers;
    if(!items.length){
      // 안내
      ctx.fillStyle = '#7a6649';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('lockers 변수가 비어 있어요!', W/2, y + 30);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#9b8060';
      ctx.fillText('받아낼 이모지를 lockers 리스트에 넣어주세요', W/2, y + 48);
      return;
    }
    const n = Math.min(items.length, 8);
    const cellW = Math.min(58, Math.floor((W - 16) / n) - 4);
    const gap = 4;
    const totalW = n * cellW + (n - 1) * gap;
    const startX = (W - totalW) / 2;
    for(let i = 0; i < n; i++){
      const cx = startX + i * (cellW + gap);
      this._drawLockerCell(cx, y + 6, cellW, 64, i, items[i]);
    }
  }

  _drawLockers2D(y){ /* not used; placeholder */ }

  _drawGrid2D(y){
    const ctx = this.ctx, W = this.W;
    const rows = this.gridLockers.length;
    const cols = Math.max(...this.gridLockers.map(r => r.length || 0));
    if(!rows || !cols){
      ctx.fillStyle = '#7a6649';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('grades 가 비어 있어요!', W/2, y + 30);
      return;
    }
    const cellW = Math.min(50, Math.floor((W - 16 - (cols - 1) * 3) / cols));
    const cellH = Math.min(36, Math.floor(78 / rows) - 3);
    const totalW = cols * cellW + (cols - 1) * 3;
    const startX = (W - totalW) / 2;
    let curY = y + 4;
    for(let r = 0; r < rows; r++){
      for(let c = 0; c < cols; c++){
        const v = this.gridLockers[r][c];
        if(v === undefined || v === null) continue;
        this._drawLockerCell(startX + c * (cellW + 3), curY, cellW, cellH, c, v, true);
      }
      curY += cellH + 3;
    }
  }

  _drawLockerCell(cx, cy, cw, ch, idx, value, compact){
    const ctx = this.ctx;
    // 배경
    const grd = ctx.createLinearGradient(cx, cy, cx, cy + ch);
    grd.addColorStop(0, '#f9f5ec');
    grd.addColorStop(1, '#e6dec7');
    ctx.fillStyle = grd;
    ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = '#a08868';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);

    // 인덱스
    ctx.fillStyle = '#7a6649';
    ctx.font = `bold ${compact ? 8 : 9}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(String(idx), cx + 3, cy + (compact ? 9 : 10));

    // 값 (이모지 또는 텍스트)
    const text = String(value ?? '');
    const isShortEmoji = text.length <= 4 && /[\p{Extended_Pictographic}]/u.test(text);
    ctx.font = isShortEmoji ? `${compact ? 18 : 24}px sans-serif` : `bold ${compact ? 11 : 13}px sans-serif`;
    ctx.fillStyle = '#1c1108';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let displayText = text;
    while(ctx.measureText(displayText).width > cw - 6 && displayText.length > 1){
      displayText = displayText.slice(0, -1);
    }
    ctx.fillText(displayText, cx + cw / 2, cy + ch / 2 + (compact ? 2 : 4));
    ctx.textBaseline = 'alphabetic';
  }

  _drawPausedOverlay(){
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 80, W, H - 80);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▶ 코드를 실행하면 시작!', W/2, H/2 - 10);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText('lockers 리스트에 이모지를 넣고 ▶ 실행 & 테스트', W/2, H/2 + 14);
  }

  _drawWinOverlay(){
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(22, 163, 74, 0.85)';
    ctx.fillRect(0, 80, W, H - 80);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 클리어!', W/2, H/2 - 16);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`최종 점수: ${this.score}`, W/2, H/2 + 8);
    ctx.font = '12px sans-serif';
    ctx.fillText('→ "다음" 으로 다음 단계로!', W/2, H/2 + 30);
  }

  _drawLoseOverlay(){
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 80, W, H - 80);
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    const reason = this.hp <= 0 ? '💔 생명이 다했어요' : '⏰ 시간 종료';
    ctx.fillText(reason, W/2, H/2 - 16);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`점수: ${this.score} / ${this.targetScore}`, W/2, H/2 + 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px sans-serif';
    ctx.fillText('lockers 코드를 고치고 다시 실행해 봐요', W/2, H/2 + 30);
  }

  loop(){
    if(!this.running) return;
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

window.LockerDrop = LockerDrop;
