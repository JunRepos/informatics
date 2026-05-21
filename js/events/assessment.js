/* ═══════════════════════════════════════
   events/assessment.js — 📝 수행평가 (PET병 챌린지) 이벤트·로직

   학생: 단계 이동/잠금, A·B 작성, 빈칸 채우기/모름, ▶실행, 🧪테스트, 제출
   선생님: 활성 토글, 학생 보기, 코드 테스트, 채점, CSV·답안 내보내기

   코드 실행: js/oj-worker.js (grade 모드, stdin 미리 주입)
   테스트 채점: 숫자만 관대 비교 (_asmtPass)
═══════════════════════════════════════ */

// 자유 실행 입력값 (re-render 보존용)
let ASMT_STDIN = '';
// 선생님 학생 코드 테스트 결과
let ASMT_TC_TEST = null;

// ── Pyodide 워커 (oj-worker grade 모드 재사용) ──
let _asmtWorker = null;
let _asmtSeq = 0;
function _asmtEnsureWorker(){
  if(_asmtWorker) return _asmtWorker;
  _asmtWorker = new Worker('js/oj-worker.js?v=' + (typeof OJ_WORKER_VER !== 'undefined' ? OJ_WORKER_VER : '1'));
  return _asmtWorker;
}
function _asmtRunCode(code, stdin){
  return new Promise(resolve => {
    const w = _asmtEnsureWorker();
    const myId = ++_asmtSeq;
    const onMsg = (e) => {
      if(e.data && e.data.id === myId){ w.removeEventListener('message', onMsg); resolve(e.data); }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id: myId, code, stdin, mode: 'grade' });
  });
}

// 빈칸/정답을 합쳐 실행 가능한 코드로 조립. blanks 미지정 시 학생 작성중(ASMT_ANS) 사용
function _asmtAssemble(blanks){
  blanks = blanks || ASMT_ANS.blanks || {};
  const c = ASMT_DEF.stage2.c;
  let code = '';
  for(const tok of c.tokens){
    if(tok.t != null){ code += tok.t; continue; }
    const st = blanks[tok.b] || {};
    code += st.gaveUp ? (ASMT_BLANK_ANSWER[tok.b] || '') : (st.v || '');
  }
  return code;
}

// 입력칸 텍스트(공백/줄바꿈/쉼표) → 줄별 stdin
function _asmtToStdin(raw){
  return String(raw || '').split(/[\s,]+/).filter(s => s.length).join('\n');
}

// 출력에서 숫자만 추출
function _asmtNums(s){ return (String(s).match(/-?\d+\.?\d*/g) || []).map(Number); }
// 숫자만 관대 비교: 개수 같고 각 값이 (부동소수 허용) 일치
function _asmtPass(output, expected){
  const a = _asmtNums(output), b = _asmtNums(expected);
  if(a.length !== b.length) return false;
  for(let i = 0; i < b.length; i++){ if(Math.abs(a[i] - b[i]) > 1e-6) return false; }
  return true;
}
// 빈칸 정답 비교용 정규화 (공백 제거, 따옴표 통일)
function _asmtNormCode(s){
  return String(s == null ? '' : s).replace(/\s+/g, '').replace(/'/g, '"').trim();
}

// 모든 테스트케이스 실행 → 결과 배열
async function _asmtRunTests(code){
  const out = [];
  for(const t of ASMT_DEF.stage2.d.tests){
    const r = await _asmtRunCode(code, t.input);
    out.push({
      input: t.input,
      expected: t.expected,
      output: (r.output || '').trim(),
      error: r.error || '',
      pass: !r.error && _asmtPass(r.output, t.expected)
    });
  }
  return out;
}

// ══════════════════════════════════════
//  클릭
// ══════════════════════════════════════
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // ── 학생: 빈칸 모름 토글 ──
  if(act.action === 'asmt-blank-x'){
    const bid = act.bid;
    const cur = ASMT_ANS.blanks[bid] || {};
    ASMT_ANS.blanks[bid] = { ...cur, gaveUp: !cur.gaveUp };
    render();
    return;
  }

  // ── 학생: 자유 실행 ──
  if(act.action === 'asmt-run'){
    if(ASMT_RUNNING) return;
    const code = _asmtAssemble();
    ASMT_RUNNING = 'run';
    ASMT_RUN = null;
    render();
    const r = await _asmtRunCode(code, _asmtToStdin(ASMT_STDIN));
    ASMT_RUNNING = false;
    ASMT_RUN = r;
    render();
    return;
  }

  // ── 학생: 테스트 실행 ──
  if(act.action === 'asmt-test'){
    if(ASMT_RUNNING) return;
    const code = _asmtAssemble();
    ASMT_RUNNING = 'test';
    ASMT_TEST = null;
    render();
    ASMT_TEST = await _asmtRunTests(code);
    ASMT_RUNNING = false;
    render();
    return;
  }

  // ── 학생: 2단계로 (1단계 잠금) ──
  if(act.action === 'asmt-to-stage2'){
    if(ASMT_STAGE === 2) return;
    if(!confirm('2단계로 넘어갈까요?\n\n넘어가면 1단계(분석·자료형)로 되돌아올 수 없어요.')) return;
    try {
      await saveAsmtSubmission(SEL_CLS.id, ST_USER.number, {
        stage: 2, a: ASMT_ANS.a || [], b: ASMT_ANS.b || {}, blanks: {}
      });
      ASMT_STAGE = 2;
      ASMT_RUN = null; ASMT_TEST = null;
      render();
      toast('2단계로 넘어왔어요. 코드 빈칸을 채워보세요!', 'ok');
    } catch(err){
      toast('저장 실패: ' + (err.message || err), 'err');
    }
    return;
  }

  // ── 학생: 최종 제출 ──
  if(act.action === 'asmt-submit'){
    if(ASMT_RUNNING) return;
    if(!confirm('수행평가를 제출할까요?\n\n제출 후에는 수정할 수 없어요. 빈칸이 있어도 제출됩니다.')) return;
    try {
      await saveAsmtSubmission(SEL_CLS.id, ST_USER.number, {
        stage: 2, a: ASMT_ANS.a || [], b: ASMT_ANS.b || {},
        blanks: ASMT_ANS.blanks || {}, submittedAt: new Date().toISOString()
      });
      ASMT_SUB = { stage: 2, a: ASMT_ANS.a, b: ASMT_ANS.b, blanks: ASMT_ANS.blanks, submittedAt: new Date().toISOString() };
      ASMT_VIEW = 'done';
      render();
      toast('제출 완료! 수고했어요 🎉', 'ok');
    } catch(err){
      toast('제출 실패: ' + (err.message || err), 'err');
    }
    return;
  }

  // ══ 선생님 ══

  // 활성 토글
  if(act.action === 'asmt-set-active'){
    const cid = TC_CLS?.id;
    if(!cid){ toast('반을 먼저 선택하세요.', 'err'); return; }
    const next = act.on === '1';
    if(!!ASMT_ACTIVE[cid] === next) return;
    try {
      await setAsmtActive(cid, next);
      toast(next ? '✓ 시험을 시작했어요. 학생 화면에 탭이 보입니다.' : '시험을 닫았어요.', 'ok');
      render();
    } catch(err){ toast('변경 실패: ' + (err.message || err), 'err'); }
    return;
  }

  // 학생 상세 / 뒤로
  if(act.action === 'asmt-tc-view'){
    ASMT_TC_SEL_SNUM = act.snum;
    ASMT_TC_VIEW = 'student';
    ASMT_TC_TEST = null;
    render();
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 30);
    return;
  }
  if(act.action === 'asmt-tc-back'){
    ASMT_TC_SEL_SNUM = null;
    ASMT_TC_VIEW = 'manage';
    ASMT_TC_TEST = null;
    render();
    return;
  }

  // 선생님: 학생 코드로 테스트 실행
  if(act.action === 'asmt-tc-runtest'){
    if(ASMT_RUNNING) return;
    const sub = ASMT_ALL_SUBS[ASMT_TC_SEL_SNUM];
    if(!sub){ return; }
    const code = _asmtAssemble(sub.blanks || {});
    ASMT_RUNNING = 'tctest';
    ASMT_TC_TEST = null;
    render();
    ASMT_TC_TEST = await _asmtRunTests(code);
    ASMT_RUNNING = false;
    render();
    return;
  }

  // 점수 저장
  if(act.action === 'asmt-score-save'){
    await _asmtSaveScore();
    return;
  }
  if(act.action === 'asmt-export-csv'){ _asmtExportCsv(); return; }
  if(act.action === 'asmt-export-answers'){ _asmtExportAnswers(); return; }
});

// ══════════════════════════════════════
//  입력 (input) — 포커스 보존 위해 re-render 없이 모델만 갱신
// ══════════════════════════════════════
document.addEventListener('input', e => {
  const t = e.target;
  if(!t || !t.dataset) return;
  const a = t.dataset.action;

  if(a === 'asmt-a'){
    if(!Array.isArray(ASMT_ANS.a)) ASMT_ANS.a = [];
    ASMT_ANS.a[parseInt(t.dataset.idx)] = t.value;
    return;
  }
  if(a === 'asmt-b'){
    if(!ASMT_ANS.b || typeof ASMT_ANS.b !== 'object') ASMT_ANS.b = {};
    ASMT_ANS.b[t.dataset.bid] = t.value;
    return;
  }
  if(a === 'asmt-blank-in'){
    const bid = t.dataset.bid;
    const cur = ASMT_ANS.blanks[bid] || {};
    ASMT_ANS.blanks[bid] = { ...cur, v: t.value, gaveUp: false };
    return;
  }
  if(a === 'asmt-stdin'){
    ASMT_STDIN = t.value;
    return;
  }
});

// ══════════════════════════════════════
//  로직 함수
// ══════════════════════════════════════
async function _asmtSaveScore(){
  const snum = ASMT_TC_SEL_SNUM;
  if(!snum || !TC_CLS) return;
  const score = {};
  document.querySelectorAll('.asmt-sc-input').forEach(inp => {
    const v = parseFloat(inp.value);
    if(isFinite(v)) score[inp.dataset.rid] = v;
  });
  const commentEl = document.querySelector('.asmt-tcs-comment-area');
  if(commentEl) score.comment = commentEl.value || '';
  try {
    await saveAsmtScore(TC_CLS.id, snum, score);
    ASMT_ALL_SCORES[snum] = { ...score, scoredAt: new Date().toISOString() };
    render();
    toast('✓ 점수를 저장했어요.', 'ok');
  } catch(err){
    toast('저장 실패: ' + (err.message || err), 'err');
  }
}

// CSV 내보내기 (점수)
function _asmtExportCsv(){
  if(!STUDENTS.length){ toast('학생 명단이 비어있어요.', 'err'); return; }
  const cls = TC_CLS?.label || TC_CLS?.id || 'unknown';
  const headers = ['학번', '이름', '제출', ...ASMT_RUBRIC.map(r => r.label), '총점', '코멘트', '제출시각'];
  const rows = STUDENTS.map(st => {
    const sub = ASMT_ALL_SUBS[st.number] || null;
    const sc = ASMT_ALL_SCORES[st.number] || null;
    const submitted = !!(sub && sub.submittedAt);
    const scoreCells = ASMT_RUBRIC.map(r => (sc && typeof sc[r.id] === 'number') ? sc[r.id] : '');
    const total = _asmtScoreTotal(sc);
    return [
      st.number, st.name, submitted ? '제출' : (sub ? '진행중' : '미응시'),
      ...scoreCells, total != null ? total : '',
      (sc?.comment || '').replace(/\n/g, ' '), submitted ? fmtDt(sub.submittedAt) : ''
    ];
  });
  const csvRow = (arr) => arr.map(v => {
    const s = String(v ?? '');
    return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',');
  const csv = '﻿' + csvRow(headers) + '\n' + rows.map(csvRow).join('\n');
  _asmtDownload(csv, `수행평가-${cls}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
  toast('✓ 점수 CSV 다운로드 시작', 'ok');
}

// 답안 내보내기 (마크다운)
function _asmtExportAnswers(){
  const subs = ASMT_ALL_SUBS || {};
  const submitted = STUDENTS.filter(st => subs[st.number]);
  if(!submitted.length){ toast('응시한 학생이 없어요.', 'err'); return; }
  const cls = TC_CLS?.label || TC_CLS?.id || 'unknown';
  const a = ASMT_DEF.stage1.a, b = ASMT_DEF.stage1.b, c = ASMT_DEF.stage2.c;
  const lines = [`# 수행평가 답안 — ${cls}`, `## ${ASMT_DEF.title} · ${ASMT_DEF.subtitle}`, ''];

  for(const st of submitted){
    const sub = subs[st.number];
    lines.push(`### ${st.number} ${st.name}` + (sub.submittedAt ? ` (제출 ${fmtDt(sub.submittedAt)})` : ' (진행 중)'), '');
    lines.push(`**${a.title}**`);
    (sub.a || []).forEach((v, i) => lines.push(`- ${i + 1}) ${(v || '(무응답)').replace(/\n/g, ' ')}`));
    lines.push(`**${b.title}**`);
    b.fields.forEach(f => lines.push(`- ${f.label}: ${((sub.b || {})[f.id] || '(무응답)').replace(/\n/g, ' ')}`));
    lines.push(`**${c.title}** (학생 답 / 정답)`);
    c.blanks.forEach(bl => {
      const stt = (sub.blanks || {})[bl.id] || {};
      const val = stt.gaveUp ? '(모름 처리)' : (stt.v || '(무응답)');
      lines.push(`- ${bl.id}: \`${val}\`  / 정답 \`${bl.answer}\``);
    });
    lines.push('', '---', '');
  }
  _asmtDownload(lines.join('\n'), `수행평가-답안-${cls}-${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown;charset=utf-8');
  toast('✓ 답안 내보내기 시작', 'ok');
}

function _asmtDownload(content, filename, type){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
