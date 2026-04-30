/* ═══════════════════════════════════════
   games/typehunter.js — 타입 헌터 게임 엔진

   1차시(변수/자료형/형변환/print) 학습용 미션 게임.

   영웅의 자료형(str/int/float/bool)이 무기 타입 = 색이 됨.
   같은 색 몬스터만 잡을 수 있어서, 형변환 = 변신을 통해
   다양한 몬스터를 처치하는 슈팅 게임.

   조작: ←/→ 이동, SPACE 공격
═══════════════════════════════════════ */

class TypeHunter {
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;

    // ── 자료형별 팔레트 ──
    this.palette = {
      str:   {main:'#ef4444', light:'#fca5a5', shadow:'#991b1b', label:'STR'},
      int:   {main:'#3b82f6', light:'#93c5fd', shadow:'#1e40af', label:'INT'},
      float: {main:'#a855f7', light:'#d8b4fe', shadow:'#6b21a8', label:'FLOAT'},
      bool:  {main:'#eab308', light:'#fde047', shadow:'#854d0e', label:'BOOL'},
      none:  {main:'#64748b', light:'#94a3b8', shadow:'#334155', label:'???'}
    };

    // ── 영웅 상태 ──
    this.heroName = null;        // str (Stage 1)
    this.heroAttack = 0;         // int (Stage 2 — damage)
    this.heroSpeed = 1;          // float (Stage 3 — move speed multiplier)
    this.heroShielded = false;   // bool (Stage 4 — invincibility)
    this.heroFinalIntro = null;  // str (Stage 6 — intro card)
    this.heroType = 'none';      // 'str' | 'int' | 'float' | 'bool' | 'none'
    this.heroX = this.W / 2;
    this.heroY = this.H - 70;

    // ── hook 활성 플래그 ──
    this.hooks = {
      heroSummon: false,
      heroAttack: false,
      heroSpeed: false,
      heroShield: false,
      heroTransform: false,
      heroFinal: false
    };

    // ── 게임 상태 ──
    this.bullets = [];
    this.monsters = [];
    this.particles = [];
    this.popups = [];
    this.kills = 0;
    this.combo = 0;
    this.hp = 3;
    this.maxHp = 3;
    this.frame = 0;
    this.gameOver = false;
    this.started = false;
    this._lastFireFrame = -100;
    this._lastSpawnFrame = 0;
    this.lastHookError = null;
    this.running = false;

    // ── 입력 ──
    this.keys = {left: false, right: false};
    this.canvas.tabIndex = 0;
    this.canvas.style.cursor = 'pointer';
    this.canvas.addEventListener('click', () => this._handleClick());
    this.canvas.addEventListener('keydown', e => this._onKeyDown(e));
    this.canvas.addEventListener('keyup', e => this._onKeyUp(e));
    // 페이지 전역 핸들러 (캔버스 포커스 아닐 때도 동작)
    this._gKD = e => { if(this.running && !this._inEditor()) this._onKeyDown(e); };
    this._gKU = e => { if(this.running && !this._inEditor()) this._onKeyUp(e); };
    document.addEventListener('keydown', this._gKD);
    document.addEventListener('keyup', this._gKU);
  }

  destroy(){
    this.running = false;
    document.removeEventListener('keydown', this._gKD);
    document.removeEventListener('keyup', this._gKU);
  }

  _inEditor(){
    const ae = document.activeElement;
    if(!ae) return false;
    if(ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT') return true;
    if(ae.closest && ae.closest('.CodeMirror')) return true;
    return false;
  }

  _onKeyDown(e){
    if(e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A'){ e.preventDefault(); this.keys.left = true; }
    if(e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D'){ e.preventDefault(); this.keys.right = true; }
    if(e.code === 'Space'){ e.preventDefault(); this._fire(); }
  }
  _onKeyUp(e){
    if(e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
    if(e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
  }

  _handleClick(){
    if(this.gameOver){ this.reset(); return; }
    if(!this.started) this.started = true;
    this._fire();
  }

  start(){
    if(this.running) return;
    this.running = true;
    this.loop();
  }
  stop(){ this.running = false; }

  reset(){
    this.bullets = [];
    this.monsters = [];
    this.particles = [];
    this.popups = [];
    this.kills = 0;
    this.combo = 0;
    this.hp = this.maxHp;
    this.frame = 0;
    this.gameOver = false;
    this.started = false;
    this.heroX = this.W / 2;
    this.lastHookError = null;
  }

  // ── hook 적용 (events/mission.js에서 호출) ──
  setHook(name){ this.hooks[name] = true; }
  clearHooks(){
    this.hooks = {heroSummon:false, heroAttack:false, heroSpeed:false, heroShield:false, heroTransform:false, heroFinal:false};
    this.heroName = null;
    this.heroAttack = 0;
    this.heroSpeed = 1;
    this.heroShielded = false;
    this.heroFinalIntro = null;
    this.heroType = 'none';
  }

  setHeroName(name){
    this.heroName = (typeof name === 'string') ? name : null;
    if(this.heroName && this.heroType === 'none') this.heroType = 'str';
  }
  setHeroAttack(v){
    if(typeof v === 'number' && !isNaN(v) && Number.isInteger(v)){
      this.heroAttack = Math.max(0, Math.min(9999, v));
      this.heroType = 'int';
    }
  }
  setHeroSpeed(v){
    if(typeof v === 'number' && !isNaN(v) && v > 0){
      this.heroSpeed = Math.max(0.3, Math.min(4, v));
      this.heroType = 'float';
    }
  }
  setHeroShield(v){
    this.heroShielded = (v === true);
    if(this.heroShielded) this.heroType = 'bool';
  }
  // Stage 5: 변신술 — 변수 hero의 자료형이 영웅 색을 결정
  setHeroTransform(v){
    if(typeof v === 'string'){ this.heroType = 'str'; }
    else if(typeof v === 'boolean'){ this.heroType = 'bool'; }
    else if(typeof v === 'number' && !isNaN(v)){
      this.heroType = Number.isInteger(v) ? 'int' : 'float';
    }
  }
  setHeroFinalIntro(s){
    if(typeof s === 'string') this.heroFinalIntro = s;
  }

  // 스폰 모드: heroTransform 통과 후엔 4종 다 등장
  get spawnAllTypes(){ return this.hooks.heroTransform || this.hooks.heroFinal; }

  // 발사 쿨다운 (heroSpeed 비례)
  _fireCooldown(){
    return Math.max(6, Math.round(20 / Math.max(0.5, this.heroSpeed)));
  }

  _fire(){
    if(this.gameOver) return;
    if(this.heroType === 'none') return;
    if(!this.started) this.started = true;
    if(this.frame - this._lastFireFrame < this._fireCooldown()) return;
    this._lastFireFrame = this.frame;
    this.bullets.push({
      x: this.heroX,
      y: this.heroY - 18,
      vy: -7,
      type: this.heroType,
      damage: this.hooks.heroAttack ? Math.max(1, this.heroAttack) : 1
    });
  }

  spawnMonster(){
    const types = this.spawnAllTypes
      ? ['str','int','float','bool']
      : [this.heroType === 'none' ? 'str' : this.heroType];
    const type = types[Math.floor(Math.random() * types.length)];
    const x = 30 + Math.random() * (this.W - 60);
    const speed = 0.4 + Math.random() * 0.5 + (this.kills * 0.01); // 점차 빠르게
    this.monsters.push({
      x, y: -24, type,
      vy: speed,
      hp: type === 'bool' ? 3 : 2,  // bool 몬스터는 약간 더 단단
      wobble: Math.random() * Math.PI * 2,
      shake: 0
    });
  }

  update(){
    if(this.gameOver) return;

    // 영웅 이동 (heroSpeed 비례)
    const moveSpeed = 2 * this.heroSpeed;
    if(this.keys.left)  this.heroX = Math.max(20, this.heroX - moveSpeed);
    if(this.keys.right) this.heroX = Math.min(this.W - 20, this.heroX + moveSpeed);

    // 몬스터 스폰 (heroType이 정해진 후에만)
    if(this.started && this.heroType !== 'none'){
      const interval = Math.max(45, 90 - this.kills * 2);
      if(this.frame - this._lastSpawnFrame >= interval){
        this._lastSpawnFrame = this.frame;
        this.spawnMonster();
      }
    }

    // 총알 이동
    for(const b of this.bullets){
      b.y += b.vy;
    }
    this.bullets = this.bullets.filter(b => b.y > -20);

    // 몬스터 이동
    for(const m of this.monsters){
      m.y += m.vy;
      m.wobble += 0.1;
      if(m.shake > 0) m.shake--;
    }

    // 충돌: 총알 vs 몬스터
    for(const b of this.bullets){
      for(const m of this.monsters){
        if(m.hp <= 0) continue;
        const dx = b.x - m.x, dy = b.y - m.y;
        if(dx*dx + dy*dy < 22*22){
          if(b.type === m.type){
            // 같은 타입 → 데미지
            m.hp -= b.damage;
            m.shake = 8;
            b.hit = true;
            this._addParticles(m.x, m.y, this.palette[m.type].main, 6);
            if(m.hp <= 0){
              this.kills++;
              this.combo++;
              const points = b.damage * (this.combo > 1 ? this.combo : 1);
              this.popups.push({x: m.x, y: m.y, text: `+${points}`, color: this.palette[m.type].light, life: 30});
              if(this.combo >= 3){
                this.popups.push({x: m.x, y: m.y - 16, text: `${this.combo} combo!`, color: '#ffd700', life: 30});
              }
              this._addParticles(m.x, m.y, this.palette[m.type].light, 12);
            }
          } else {
            // 다른 타입 → 튕김
            b.hit = true;
            m.shake = 4;
            this._addParticles(b.x, b.y, '#cccccc', 4);
            this.popups.push({x: b.x, y: b.y, text: '✕', color: '#888', life: 20});
            this.combo = 0;
          }
        }
      }
    }
    this.bullets = this.bullets.filter(b => !b.hit);

    // 몬스터가 바닥/영웅 도달 → 데미지
    for(const m of this.monsters){
      if(m.hp <= 0) continue;
      const reachedBottom = m.y > this.H - 40;
      const hitHero = Math.abs(m.x - this.heroX) < 22 && Math.abs(m.y - this.heroY) < 22;
      if(reachedBottom || hitHero){
        if(this.heroShielded){
          // 방어막 = 무적
          this._addParticles(m.x, m.y, this.palette.bool.light, 10);
          m.hp = 0;
        } else {
          this.hp--;
          this.combo = 0;
          this._addParticles(this.heroX, this.heroY, '#ff4444', 14);
          m.hp = 0;
          if(this.hp <= 0){ this.gameOver = true; }
        }
      }
    }
    this.monsters = this.monsters.filter(m => m.hp > 0);

    // 파티클 / 팝업
    for(const p of this.particles){
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for(const p of this.popups){ p.y -= 0.6; p.life--; }
    this.popups = this.popups.filter(p => p.life > 0);

    this.frame++;
  }

  _addParticles(x, y, color, n){
    for(let i = 0; i < n; i++){
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 1,
        size: 2 + Math.random() * 3,
        color, life: 20 + Math.random() * 12
      });
    }
  }

  // ── 그리기 ──
  draw(){
    const ctx = this.ctx, W = this.W, H = this.H;

    // 우주 배경 (다크 톤)
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#0f172a');
    grd.addColorStop(1, '#1e293b');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // 별 (배경)
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for(let i = 0; i < 35; i++){
      const sx = (i * 47) % W;
      const sy = ((i * 71) + this.frame * 0.3) % H;
      const sz = (i % 3 === 0) ? 2 : 1;
      const tw = 0.3 + 0.7 * Math.abs(Math.sin((this.frame + i * 30) * 0.04));
      ctx.globalAlpha = tw;
      ctx.fillRect(sx, sy, sz, sz);
    }
    ctx.globalAlpha = 1;

    // 몬스터
    for(const m of this.monsters){
      const sx = m.shake > 0 ? (Math.random() - 0.5) * 4 : 0;
      this._drawMonster(m.x + sx, m.y, m.type, m.wobble);
    }

    // 총알
    for(const b of this.bullets){
      const p = this.palette[b.type];
      ctx.save();
      ctx.shadowColor = p.main;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.light;
      ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = p.main;
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // 영웅
    if(this.heroType !== 'none'){
      this._drawHero();
    }

    // 파티클
    for(const p of this.particles){
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 30);
      ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 팝업 (점수)
    for(const p of this.popups){
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.max(0, p.life / 30);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;

    // ── HUD ──
    this._drawHUD();

    // 시작 안내 / 게임오버
    if(!this.started && this.heroType !== 'none' && !this.gameOver){
      this._drawStartScreen();
    }
    if(this.gameOver){
      this._drawGameOver();
    }
    // 영웅 미소환 시 안내
    if(this.heroType === 'none'){
      this._drawNoHero();
    }

    // hook 에러 표시
    if(this.lastHookError){
      ctx.fillStyle = 'rgba(217,48,37,0.9)';
      ctx.fillRect(4, H - 22, W - 8, 18);
      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('⚠ ' + String(this.lastHookError).slice(0, 60), 8, H - 8);
    }
  }

  _drawHero(){
    const ctx = this.ctx;
    const p = this.palette[this.heroType];
    const x = this.heroX, y = this.heroY;

    // 방어막 (bool 활성 시)
    if(this.heroShielded){
      const r = 26 + Math.sin(this.frame * 0.15) * 2;
      ctx.save();
      ctx.shadowColor = this.palette.bool.main;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = this.palette.bool.main;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = this.palette.bool.light;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r - 4, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // 발광
    ctx.save();
    ctx.shadowColor = p.main;
    ctx.shadowBlur = 12;

    // 몸통 (사각형)
    ctx.fillStyle = p.main;
    ctx.fillRect(x - 11, y - 5, 22, 18);
    // 몸 아래 그림자
    ctx.fillStyle = p.shadow;
    ctx.fillRect(x - 11, y + 9, 22, 4);
    // 머리 (원)
    ctx.fillStyle = p.light;
    ctx.beginPath(); ctx.arc(x, y - 12, 9, 0, Math.PI*2); ctx.fill();
    // 눈
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 4, y - 13, 2, 3);
    ctx.fillRect(x + 2, y - 13, 2, 3);
    // 무기 (현재 타입 라벨)
    ctx.restore();

    // 타입 라벨 (영웅 위)
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = p.light;
    ctx.fillText(`[${p.label} HERO]`, x, y - 26);
    if(this.heroName){
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(this.heroName, x, y - 38);
    }
  }

  _drawMonster(x, y, type, wobble){
    const ctx = this.ctx;
    const p = this.palette[type];
    ctx.save();
    ctx.shadowColor = p.main;
    ctx.shadowBlur = 6;

    if(type === 'str'){
      // 슬라임 (둥근 블롭)
      const wob = Math.sin(wobble) * 2;
      ctx.fillStyle = p.main;
      ctx.beginPath();
      ctx.ellipse(x, y, 14, 12 + wob, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = p.light;
      ctx.beginPath(); ctx.arc(x - 4, y - 4, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - 4, y - 1, 2, 3);
      ctx.fillRect(x + 2, y - 1, 2, 3);
    } else if(type === 'int'){
      // 골렘 (블록)
      ctx.fillStyle = p.main;
      ctx.fillRect(x - 13, y - 12, 26, 24);
      ctx.fillStyle = p.shadow;
      ctx.fillRect(x - 13, y + 7, 26, 5);
      ctx.fillStyle = p.light;
      ctx.fillRect(x - 9, y - 8, 6, 4);
      ctx.fillRect(x + 3, y - 8, 6, 4);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - 7, y - 7, 2, 2);
      ctx.fillRect(x + 5, y - 7, 2, 2);
    } else if(type === 'float'){
      // 유령 (물결)
      const wob = Math.sin(wobble * 1.5) * 3;
      ctx.fillStyle = p.main;
      ctx.beginPath();
      ctx.arc(x, y - 4, 11, Math.PI, 0);
      ctx.lineTo(x + 11, y + 8);
      ctx.lineTo(x + 7, y + 6 + wob);
      ctx.lineTo(x + 3, y + 8);
      ctx.lineTo(x - 3, y + 6 - wob);
      ctx.lineTo(x - 7, y + 8);
      ctx.lineTo(x - 11, y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = p.light;
      ctx.beginPath(); ctx.arc(x - 4, y - 5, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 4, y - 5, 2, 0, Math.PI*2); ctx.fill();
    } else if(type === 'bool'){
      // 결정 (다이아몬드)
      const sp = 1 + Math.sin(wobble) * 0.05;
      ctx.translate(x, y);
      ctx.scale(sp, sp);
      ctx.fillStyle = p.main;
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(11, 0); ctx.lineTo(0, 12); ctx.lineTo(-11, 0); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = p.light;
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 4); ctx.lineTo(-6, 0); ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  _drawHUD(){
    const ctx = this.ctx, W = this.W, H = this.H;
    // 상단 바 (반투명)
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, 28);

    // HP 하트
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    let hpStr = '';
    for(let i = 0; i < this.maxHp; i++){
      hpStr += i < this.hp ? '❤' : '♡';
    }
    ctx.fillText(hpStr, 8, 19);

    // 처치 카운트
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`처치: ${this.kills}`, W / 2, 19);

    // 콤보 (3 이상부터)
    if(this.combo >= 3){
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`🔥 ${this.combo} COMBO`, W / 2, 42);
    }

    // 영웅 타입 라벨 (우상단)
    if(this.heroType !== 'none'){
      const p = this.palette[this.heroType];
      ctx.textAlign = 'right';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = p.main;
      ctx.fillText(`[${p.label}]`, W - 8, 19);
    }
  }

  _drawStartScreen(){
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(W/2 - 120, H/2 - 50, 240, 90);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('⚔️ 타입 헌터', W/2, H/2 - 22);
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText('←→ 또는 A/D 로 이동', W/2, H/2 - 2);
    ctx.fillText('SPACE 또는 클릭으로 공격', W/2, H/2 + 14);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('아무 키나 눌러 시작', W/2, H/2 + 32);
  }

  _drawGameOver(){
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(W/2 - 130, H/2 - 50, 260, 100);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('💀 GAME OVER', W/2, H/2 - 16);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`최종 처치: ${this.kills}`, W/2, H/2 + 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px sans-serif';
    ctx.fillText('클릭하면 다시 시작', W/2, H/2 + 30);
  }

  _drawNoHero(){
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W/2 - 130, H/2 - 36, 260, 72);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('영웅이 아직 소환되지 않았습니다', W/2, H/2 - 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px sans-serif';
    ctx.fillText('미션 1을 완료해 영웅을 소환하세요', W/2, H/2 + 12);
  }

  // 영웅 자기소개 카드 (Stage 6 통과 시 게임 위에 표시)
  _drawHeroCard(){
    if(!this.heroFinalIntro) return;
    const ctx = this.ctx, W = this.W;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    const lines = String(this.heroFinalIntro).split('\n').slice(0, 6);
    const boxH = 14 + lines.length * 14;
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1;
    ctx.fillRect(8, 36, W - 16, boxH);
    ctx.strokeRect(8, 36, W - 16, boxH);
    ctx.fillStyle = '#fde047';
    lines.forEach((l, i) => ctx.fillText(l.slice(0, 40), 14, 52 + i * 14));
  }

  loop(){
    if(!this.running) return;
    this.update();
    this.draw();
    if(this.heroFinalIntro) this._drawHeroCard();
    requestAnimationFrame(() => this.loop());
  }
}

window.TypeHunter = TypeHunter;
