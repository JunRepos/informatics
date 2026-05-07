/* ═══════════════════════════════════════
   games/lockermaster.js — 사물함 마스터 게임 엔진

   3차시(리스트) 학습용 퍼즐 게임.
   - lockers = 1차원 리스트 → 가로 사물함 칸들
   - grades  = 2차원 리스트 → 표(행×열) 그리드
   - picked / sliced / total 등 추가 변수 → 별도 카드

   학생 코드 실행 → applyState({lockers, picked, ...}) 호출
   → 게임이 시각적으로 사물함 모양 갱신.
═══════════════════════════════════════ */

class LockerMaster {
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;

    // 게임 상태
    this.lockers = [];           // 1차원 lockers 변수
    this.grades = null;          // 2차원 grades 변수 (있으면 그리드 모드)
    this.subVars = {};           // {picked, last, sliced, total, ...}
    this.target = null;          // 단계가 제공한 목표 사물함 미리보기
    this.targetSubVars = {};     // 목표 추가 변수 (picked 같은 것 미리보기)
    this.stepInfo = null;        // {idx, title, focus} — 현재 단계 정보
    this.lastError = null;       // 학생 코드 에러 표시
    this.justUpdated = false;    // 깜빡임 플래그
    this._updateAt = 0;
    this.frame = 0;
    this.running = false;

    // 강조 (인덱싱·슬라이싱 시각화)
    this.highlightIdx = null;    // 단일 칸 강조 (picked 단계용)
    this.highlightRange = null;  // [start, end] 슬라이스 범위 강조

    // hook 시스템 — 미션 시스템 호환성을 위해 빈 객체
    this.hooks = {};

    // 입력은 게임 자체에 없음 (학생 코드가 모든 변화를 만듦)
    canvas.style.cursor = 'default';
  }

  destroy(){
    this.running = false;
  }

  reset(){
    this.lockers = [];
    this.grades = null;
    this.subVars = {};
    this.lastError = null;
    this.highlightIdx = null;
    this.highlightRange = null;
    this.justUpdated = false;
  }

  start(){
    if(this.running) return;
    this.running = true;
    this.loop();
  }
  stop(){ this.running = false; }

  // hook 시스템 호환 (mission system에서 호출하는 표준 API)
  setHook(name, fn){ this.hooks[name] = fn || true; }
  clearHooks(){ this.hooks = {}; this.reset(); }

  // ── 외부 API: 단계 정보 설정 ──
  // stepInfo: {idx, total, title, focus, target, highlightIdx, highlightRange}
  setStep(stepInfo){
    this.stepInfo = stepInfo || null;
    this.target = stepInfo?.target ?? null;
    this.targetSubVars = stepInfo?.targetSubVars || {};
    this.highlightIdx = stepInfo?.highlightIdx ?? null;
    this.highlightRange = stepInfo?.highlightRange ?? null;
  }

  // ── 외부 API: 학생 코드 실행 결과 적용 ──
  // state: {lockers, grades, picked, last, sliced, total, max_score, min_score, ...}
  // 이전 단계의 잔재가 남지 않도록 매번 명시적 갱신.
  applyState(state){
    state = state || {};
    this.lockers = Array.isArray(state.lockers) ? state.lockers.slice(0, 20) : [];
    this.grades  = Array.isArray(state.grades)
      ? state.grades.slice(0, 8).map(row => Array.isArray(row) ? row.slice(0, 8) : [])
      : null;
    // 추가 변수 모음
    const subKeys = ['picked', 'last', 'first', 'sliced', 'total', 'avg',
                     'max_score', 'min_score', 'count', 'score', 'student_score'];
    this.subVars = {};
    for(const k of subKeys){
      if(state[k] !== undefined && state[k] !== null) this.subVars[k] = state[k];
    }
    this.lastError = state.error || null;
    this.justUpdated = true;
    this._updateAt = this.frame;
  }

  // ── 그리기 ──
  draw(){
    const ctx = this.ctx, W = this.W, H = this.H;

    // 배경 (밝은 베이지/우드 톤 — 사물함 느낌)
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#fefdf9');
    grd.addColorStop(1, '#f3eee0');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // 상단 단계 정보
    this._drawStepHeader();

    // 메인 영역: 2차원이면 그리드, 아니면 1차원 사물함
    const mainTop = 78;
    const mainH = this.grades ? 230 : 150;
    if(this.grades){
      this._drawGrid(10, mainTop, W - 20, mainH, this.grades, '📋 grades');
    } else {
      this._drawLockerRow(10, mainTop, W - 20, mainH, this.lockers, '🗄️ lockers');
    }

    // 목표 미리보기 (있을 때, 작게)
    if(this.target){
      const tY = mainTop + mainH + 10;
      this._drawTargetPreview(10, tY, W - 20, 60);
    }

    // 추가 변수 카드들 (picked, sliced, total 등)
    const subY = (this.target ? mainTop + mainH + 80 : mainTop + mainH + 10);
    this._drawSubVars(10, subY, W - 20, H - subY - 10);

    // 코드 에러 (있으면 빨간 띠)
    if(this.lastError){
      ctx.fillStyle = 'rgba(220, 38, 38, 0.92)';
      ctx.fillRect(0, H - 22, W, 22);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('⚠ ' + String(this.lastError).slice(0, 56), 8, H - 7);
    }
  }

  _drawStepHeader(){
    const ctx = this.ctx, W = this.W;
    // 헤더 배경
    ctx.fillStyle = '#5b4636';
    ctx.fillRect(0, 0, W, 68);
    // 가로선
    ctx.fillStyle = '#3d2f24';
    ctx.fillRect(0, 68, W, 3);

    if(this.stepInfo){
      ctx.fillStyle = '#ffd887';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`미션 ${this.stepInfo.idx + 1}${this.stepInfo.total ? ' / ' + this.stepInfo.total : ''}`, 12, 22);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      const title = (this.stepInfo.title || '').slice(0, 28);
      ctx.fillText(title, 12, 42);
      if(this.stepInfo.focus){
        ctx.fillStyle = '#dcc7a8';
        ctx.font = '11px sans-serif';
        ctx.fillText(this.stepInfo.focus.slice(0, 38), 12, 60);
      }
    } else {
      ctx.fillStyle = '#ffd887';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🗄️ 사물함 마스터 — 리스트 퍼즐', W/2, 32);
      ctx.fillStyle = '#dcc7a8';
      ctx.font = '11px sans-serif';
      ctx.fillText('첫 번째 미션을 시작해보세요!', W/2, 52);
    }
  }

  // 1차원 사물함 한 줄 그리기
  _drawLockerRow(x, y, w, h, items, label){
    const ctx = this.ctx;
    // 라벨
    ctx.fillStyle = '#5b4636';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y - 4);
    // 우측에 길이 표시
    if(items.length){
      ctx.textAlign = 'right';
      ctx.fillStyle = '#9b8060';
      ctx.font = '11px sans-serif';
      ctx.fillText(`len = ${items.length}`, x + w, y - 4);
    }

    // 빈 리스트면 안내
    if(!items.length){
      ctx.fillStyle = 'rgba(155, 128, 96, 0.4)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#cbb791';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = '#7a6649';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('lockers 변수가 비어 있어요', x + w/2, y + h/2 - 6);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#9b8060';
      ctx.fillText('코드로 lockers 리스트를 만들어 보세요', x + w/2, y + h/2 + 12);
      return;
    }

    // 칸 크기 계산 (최대 8칸까지 보기 좋게)
    const n = items.length;
    const gap = 4;
    const maxCellW = 70;
    const cellW = Math.min(maxCellW, Math.floor((w - gap * (n - 1)) / n));
    const totalW = cellW * n + gap * (n - 1);
    const startX = x + (w - totalW) / 2;
    const cellH = Math.min(h - 4, 78);
    const cellY = y + (h - cellH) / 2;

    // 슬라이스 범위 표시 (먼저 박스로 묶어서 강조)
    if(this.highlightRange){
      const [s, e] = this.highlightRange;
      const sIdx = Math.max(0, s);
      const eIdx = Math.min(n, e);
      if(sIdx < eIdx){
        const rx = startX + sIdx * (cellW + gap) - 4;
        const rw = (eIdx - sIdx) * cellW + (eIdx - sIdx - 1) * gap + 8;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.18)';
        ctx.fillRect(rx, cellY - 6, rw, cellH + 12);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(rx, cellY - 6, rw, cellH + 12);
        ctx.setLineDash([]);
      }
    }

    // 각 칸 그리기
    for(let i = 0; i < n; i++){
      const cx = startX + i * (cellW + gap);
      this._drawLockerCell(cx, cellY, cellW, cellH, i, items[i]);
    }
  }

  // 단일 사물함 칸
  _drawLockerCell(cx, cy, cw, ch, idx, value){
    const ctx = this.ctx;
    // 강조: highlightIdx == idx 면 노란 펄스
    const isHL = this.highlightIdx !== null && this.highlightIdx === idx;
    const updatedAge = this.frame - this._updateAt;
    const pulseFactor = isHL && updatedAge < 60 ? Math.abs(Math.sin(this.frame * 0.15)) : 0;

    // 배경 (사물함 메탈 느낌)
    const grd = ctx.createLinearGradient(cx, cy, cx, cy + ch);
    if(isHL){
      grd.addColorStop(0, `rgba(254, 240, 138, ${0.6 + pulseFactor * 0.4})`);
      grd.addColorStop(1, '#fcd34d');
    } else {
      grd.addColorStop(0, '#f9f5ec');
      grd.addColorStop(1, '#e6dec7');
    }
    ctx.fillStyle = grd;
    ctx.fillRect(cx, cy, cw, ch);

    // 테두리
    ctx.strokeStyle = isHL ? '#d97706' : '#a08868';
    ctx.lineWidth = isHL ? 2.5 : 1.5;
    ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);

    // 손잡이 (작은 점)
    ctx.fillStyle = '#7a6649';
    ctx.beginPath();
    ctx.arc(cx + cw - 6, cy + ch / 2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 인덱스 (상단)
    ctx.fillStyle = '#7a6649';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(idx), cx + cw / 2, cy + 12);
    // 음수 인덱스 (하단)
    ctx.fillStyle = '#a89978';
    ctx.font = '9px sans-serif';
    ctx.fillText(`-${this.lockers.length - idx}`, cx + cw / 2, cy + ch - 4);

    // 값 (가운데, 큼지막하게)
    this._drawCellValue(cx + cw / 2, cy + ch / 2 + 4, cw - 8, value);
  }

  // 셀 안에 값 그리기 — 이모지/문자열/숫자/불리언
  _drawCellValue(centerX, centerY, maxW, value){
    const ctx = this.ctx;
    let text = '';
    let color = '#1c1108';
    let font = '';

    if(value === null || value === undefined){
      text = 'None';
      color = '#999';
      font = 'italic 12px sans-serif';
    } else if(typeof value === 'string'){
      text = value;
      // 이모지인지 체크 — 길이가 짧고 일반 문자가 아니면 크게
      const isShortEmoji = text.length <= 4 && /[\p{Extended_Pictographic}]/u.test(text);
      font = isShortEmoji ? '24px sans-serif' : 'bold 13px sans-serif';
      color = '#1c1108';
    } else if(typeof value === 'number'){
      text = String(value);
      font = 'bold 16px monospace';
      color = '#0c4a6e';
    } else if(typeof value === 'boolean'){
      text = value ? 'True' : 'False';
      font = 'bold 13px monospace';
      color = value ? '#15803d' : '#991b1b';
    } else if(Array.isArray(value)){
      text = '[…]';
      font = 'bold 13px monospace';
      color = '#7c2d12';
    } else {
      try { text = JSON.stringify(value); } catch { text = String(value); }
      font = '11px monospace';
    }
    ctx.font = font;
    // 크기 줄여 fit
    let displayText = text;
    while(ctx.measureText(displayText).width > maxW && displayText.length > 1){
      displayText = displayText.slice(0, -1);
    }
    if(displayText !== text && displayText.length > 1) displayText = displayText.slice(0, -1) + '…';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(displayText, centerX, centerY);
  }

  // 2차원 그리드
  _drawGrid(x, y, w, h, grid, label){
    const ctx = this.ctx;
    ctx.fillStyle = '#5b4636';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y - 4);

    if(!grid.length){
      ctx.fillStyle = '#9b8060';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('grades 가 비어 있어요', x + w/2, y + h/2);
      return;
    }

    const rows = grid.length;
    const cols = Math.max(...grid.map(r => r.length || 0));
    const gap = 3;
    const cellW = Math.min(60, Math.floor((w - gap * (cols + 1)) / cols));
    const cellH = Math.min(50, Math.floor((h - gap * (rows + 2)) / (rows + 1)));
    const totalW = cols * cellW + (cols - 1) * gap;
    const startX = x + (w - totalW) / 2;
    let curY = y + 4;

    // 열 헤더
    for(let c = 0; c < cols; c++){
      const cx = startX + c * (cellW + gap);
      ctx.fillStyle = '#7a6649';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`열 ${c}`, cx + cellW/2, curY + 10);
    }
    curY += 16;

    // 각 행
    for(let r = 0; r < rows; r++){
      const row = grid[r] || [];
      for(let c = 0; c < cols; c++){
        const cx = startX + c * (cellW + gap);
        const isHL = this.highlightIdx && Array.isArray(this.highlightIdx) &&
                     this.highlightIdx[0] === r && this.highlightIdx[1] === c;
        // 셀 배경
        const grd = ctx.createLinearGradient(cx, curY, cx, curY + cellH);
        if(isHL){
          grd.addColorStop(0, '#fef3c7');
          grd.addColorStop(1, '#fcd34d');
        } else {
          grd.addColorStop(0, '#f9f5ec');
          grd.addColorStop(1, '#e6dec7');
        }
        ctx.fillStyle = grd;
        ctx.fillRect(cx, curY, cellW, cellH);
        ctx.strokeStyle = isHL ? '#d97706' : '#a08868';
        ctx.lineWidth = isHL ? 2 : 1.2;
        ctx.strokeRect(cx + 0.5, curY + 0.5, cellW - 1, cellH - 1);
        // 값
        this._drawCellValue(cx + cellW/2, curY + cellH/2 + 4, cellW - 6, row[c]);
      }
      // 행 라벨 (첫 칸 왼쪽)
      ctx.fillStyle = '#7a6649';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`행 ${r}`, startX - 4, curY + cellH/2 + 4);
      curY += cellH + gap;
    }
  }

  // 목표 사물함 미리보기 (작게, 점선)
  _drawTargetPreview(x, y, w, h){
    const ctx = this.ctx;
    ctx.fillStyle = '#f0e6d0';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#a08868';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.setLineDash([]);

    ctx.fillStyle = '#7a6649';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🎯 이렇게 만들어 봐요', x + 6, y + 13);

    if(!Array.isArray(this.target)){
      ctx.font = '11px monospace';
      ctx.fillStyle = '#5b4636';
      ctx.fillText(String(this.target), x + 6, y + 32);
      return;
    }

    // 1차원 미리보기 — 작은 칸들
    const n = this.target.length;
    const gap = 2;
    const cellW = Math.min(34, Math.floor((w - 16 - gap * (n - 1)) / n));
    const cellH = Math.min(28, h - 22);
    const startX = x + 8;
    const startY = y + 18;
    for(let i = 0; i < n; i++){
      const cx = startX + i * (cellW + gap);
      ctx.fillStyle = '#fff8e7';
      ctx.fillRect(cx, startY, cellW, cellH);
      ctx.strokeStyle = '#cbb791';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + 0.5, startY + 0.5, cellW - 1, cellH - 1);
      ctx.fillStyle = '#5b4636';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i), cx + cellW/2, startY + 9);
      // 값
      const v = this.target[i];
      this._drawCellValue(cx + cellW/2, startY + cellH - 6, cellW - 4, v);
    }
  }

  // 추가 변수 카드 (picked, sliced, total 등)
  _drawSubVars(x, y, w, h){
    const entries = Object.entries(this.subVars);
    if(!entries.length) return;

    const ctx = this.ctx;
    ctx.fillStyle = '#5b4636';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📦 내가 만든 변수들', x, y + 12);

    // 각 변수를 작은 카드로
    let curY = y + 22;
    const cardH = 26;
    for(const [name, val] of entries){
      if(curY + cardH > y + h) break;
      // 카드 배경
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, curY, w, cardH);
      ctx.strokeStyle = '#d4c8a8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, curY + 0.5, w - 1, cardH - 1);
      // 변수명 (왼쪽)
      ctx.fillStyle = '#7c3aed';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(name, x + 8, curY + 17);
      // = 기호
      ctx.fillStyle = '#7a6649';
      ctx.font = '11px sans-serif';
      const nameW = ctx.measureText(name).width;
      ctx.fillText('=', x + 8 + nameW + 6, curY + 17);
      // 값 (오른쪽)
      const valStr = this._fmtVal(val);
      ctx.fillStyle = '#1c1108';
      ctx.font = 'bold 12px monospace';
      let displayed = valStr;
      const maxValW = w - nameW - 30;
      while(ctx.measureText(displayed).width > maxValW && displayed.length > 4){
        displayed = displayed.slice(0, -1);
      }
      if(displayed !== valStr && displayed.length > 4) displayed = displayed.slice(0, -1) + '…';
      ctx.fillText(displayed, x + 8 + nameW + 22, curY + 17);
      curY += cardH + 3;
    }
  }

  _fmtVal(v){
    if(v === null || v === undefined) return 'None';
    if(typeof v === 'string') return JSON.stringify(v);  // 따옴표 포함
    if(typeof v === 'number'){
      if(Number.isInteger(v)) return String(v);
      return v.toFixed(2).replace(/\.?0+$/, '');
    }
    if(typeof v === 'boolean') return v ? 'True' : 'False';
    if(Array.isArray(v)){
      try { return JSON.stringify(v).replace(/"/g, "'"); } catch { return '[...]'; }
    }
    try { return JSON.stringify(v); } catch { return String(v); }
  }

  loop(){
    if(!this.running) return;
    this.frame++;
    if(this.justUpdated && this.frame - this._updateAt > 60) this.justUpdated = false;
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

window.LockerMaster = LockerMaster;
