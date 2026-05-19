/* ═══════════════════════════════════════
   events/coderead.js — 코드 읽기 이벤트 핸들러

   - 학생: 문제 선택, 답안 제출, 다음 단계
   - 선생님: 문제 CRUD, 자동 분석, 예제 일괄 등록
═══════════════════════════════════════ */

// ── 학생: 답 비교 헬퍼 ──
function _normalizeAns(s){
  return String(s == null ? '' : s).replace(/\r\n/g, '\n').split('\n').map(l => l.replace(/\s+$/,'')).join('\n').trim();
}

// 트레이스 답 비교 — 사용자 입력을 관대하게 받음
//   리스트의 공백/따옴표 차이, 부울/None 대소문자 차이까지 허용
function _normTraceValue(s){
  return String(s || '')
    .trim()
    // 큰따옴표 → 작은따옴표로 통일
    .replace(/"/g, "'")
    // [ 뒤 공백, ] 앞 공백 제거 → [ 10, 20 ] → [10, 20]
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']')
    // ( ) { } 도 동일
    .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
    .replace(/\{\s+/g, '{').replace(/\s+\}/g, '}')
    // 쉼표 주변 공백 표준화 → "10,20" → "10, 20"
    .replace(/\s*,\s*/g, ', ')
    // 콜론 주변 공백 표준화 (딕셔너리)
    .replace(/\s*:\s*/g, ': ');
}

// 빈칸 채우기 — 공백/따옴표/괄호 차이 흡수해서 관대 비교
function _matchClozeBlank(given, expected){
  const norm = (s) => String(s || '')
    .trim()
    .replace(/\s+/g, '')      // 모든 공백 제거
    .replace(/["']/g, "'")    // 따옴표 통일
    .toLowerCase();           // 대소문자 무시 (True/true 등)
  return norm(given) === norm(expected);
}

function _matchTraceValue(given, expected){
  const g = String(given || '').trim();
  const e = String(expected || '').trim();
  if(g === e) return true;
  // 정규화 후 비교 (공백/따옴표 차이 흡수)
  if(_normTraceValue(g) === _normTraceValue(e)) return true;
  // 따옴표만 다른 문자열 (예: 'hello' vs "hello")
  if(/^["'].*["']$/.test(g) && /^["'].*["']$/.test(e)){
    const stripQuotes = (s) => s.slice(1, -1);
    if(stripQuotes(g) === stripQuotes(e)) return true;
  }
  // 부울/None 대소문자 관대 (True == true)
  if(g.toLowerCase() === e.toLowerCase() &&
     ['true','false','none'].includes(g.toLowerCase()) &&
     ['true','false','none'].includes(e.toLowerCase())) return true;
  return false;
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // ── 학생: 문제 선택 ──
  if(act.action === 'cr-pick'){
    const r = CR_READINGS.find(x => x.id === act.rid); if(!r) return;
    CR_SEL = r;
    CR_VIEW = 'solve';
    CR_STEP_IDX = 0;
    CR_ANSWER = '';
    CR_LAST_RESULT = null;
    CR_CLOZE_ANSWERS = (r.type === 'cloze') ? new Array((r.blanks || []).length).fill('') : null;
    CR_BUG_SEL = null;
    // 진도 로드 (학생 본인 것)
    if(ST_USER){
      const prog = await loadCodeReadingProgress(SEL_CLS.id, r.id, ST_USER.number);
      if(!CR_PROGRESS[r.id]) CR_PROGRESS[r.id] = {};
      if(prog) CR_PROGRESS[r.id][ST_USER.number] = prog;
    }
    render();
    return;
  }

  // ── 학생/선생님 공통: 목록으로 ──
  if(act.action === 'cr-back'){
    CR_VIEW = 'list';
    CR_SEL = null;
    CR_STEP_IDX = 0;
    CR_ANSWER = '';
    CR_LAST_RESULT = null;
    CR_EDITING = null;
    CR_CLOZE_ANSWERS = null;
    CR_BUG_SEL = null;
    render();
    return;
  }

  // ── 학생: 출력 예측 제출 ──
  if(act.action === 'cr-submit-predict'){
    const ta = document.getElementById('cr-answer');
    const given = ta ? ta.value : '';
    CR_ANSWER = given;
    const expected = CR_SEL?.expectedOutput || '';
    const pass = _normalizeAns(given) === _normalizeAns(expected);
    CR_LAST_RESULT = {
      pass,
      given,
      expected,
      msg: pass ? '코드를 정확히 읽었어요!' : '예측한 출력이 실제 결과와 달라요. 한 줄씩 다시 따라가 보세요.',
      showAnswer: false
    };
    await _recordCRAttempt(pass);
    render();
    return;
  }

  // ── 학생: 트레이스 제출 ──
  if(act.action === 'cr-submit-trace'){
    const inp = document.getElementById('cr-answer');
    const given = inp ? inp.value : '';
    CR_ANSWER = given;
    const traces = CR_SEL?.traces || [];
    const idx = Math.min(CR_STEP_IDX || 0, traces.length - 1);
    const cur = traces[idx];
    const pass = _matchTraceValue(given, cur.expectedValue);
    if(pass){
      CR_LAST_RESULT = {
        pass: true,
        msg: idx + 1 < traces.length ? '잘 따라가셨네요! 다음 단계로 넘어갈게요.' : '🎉 마지막 단계까지 모두 통과! 코드 흐름을 완벽히 읽었어요.'
      };
      // 다음 단계로
      const isLast = idx + 1 >= traces.length;
      if(!isLast){
        setTimeout(() => {
          CR_STEP_IDX = idx + 1;
          CR_ANSWER = '';
          CR_LAST_RESULT = null;
          render();
        }, 1100);
      } else {
        await _recordCRAttempt(true);
      }
    } else {
      CR_LAST_RESULT = {
        pass: false,
        given,
        expected: cur.expectedValue,
        msg: '값이 달라요. 코드를 처음부터 ' + cur.line + '번 줄까지 차근차근 다시 따라가 보세요.',
        showAnswer: true
      };
      await _recordCRAttempt(false);
    }
    render();
    return;
  }

  // ── 학생: 트레이스 이전 단계 ──
  if(act.action === 'cr-trace-prev'){
    CR_STEP_IDX = Math.max(0, (CR_STEP_IDX || 0) - 1);
    CR_ANSWER = '';
    CR_LAST_RESULT = null;
    render();
    return;
  }

  // ── 학생: 객관식 제출 (보기 버튼 자체가 제출) ──
  if(act.action === 'cr-submit-mcq'){
    if(!CR_SEL || CR_SEL.type !== 'mcq') return;
    const cidx = parseInt(el.dataset.cidx);
    const correct = (typeof CR_SEL.correctIndex === 'number') ? CR_SEL.correctIndex : 0;
    const pass = (cidx === correct);
    CR_LAST_RESULT = {
      pass,
      given: CR_SEL.choices?.[cidx] || '',
      expected: (CR_SEL.choices?.[correct] || '') + (CR_SEL.explanation ? ` — ${CR_SEL.explanation}` : ''),
      msg: pass
        ? (CR_SEL.explanation ? '정답! ' + CR_SEL.explanation : '정답이에요!')
        : '아쉬워요. 다시 한번 골라 보세요.',
      showAnswer: !pass
    };
    await _recordCRAttempt(pass);
    render();
    return;
  }

  // ── 학생: 빈칸 채우기 제출 ──
  if(act.action === 'cr-submit-cloze'){
    if(!CR_SEL || CR_SEL.type !== 'cloze') return;
    const inputs = document.querySelectorAll('.quiz-cloze-blank');
    const givens = [];
    inputs.forEach(inp => {
      const idx = parseInt(inp.dataset.bidx);
      givens[idx] = inp.value || '';
    });
    CR_CLOZE_ANSWERS = givens;
    const expected = CR_SEL.blanks || [];
    let allPass = givens.length === expected.length;
    const wrongPositions = [];
    if(allPass){
      for(let i = 0; i < expected.length; i++){
        if(!_matchClozeBlank(givens[i], expected[i])){
          allPass = false;
          wrongPositions.push(i + 1);
        }
      }
    } else {
      wrongPositions.push(0); // 개수 불일치
    }
    CR_LAST_RESULT = {
      pass: allPass,
      given: givens.join(' | '),
      expected: expected.join(' | '),
      msg: allPass
        ? '모든 빈칸을 정확히 채웠어요!'
        : (wrongPositions.length && wrongPositions[0]
            ? `빈칸 ${wrongPositions.join(', ')}번이 아직 맞지 않아요.`
            : '입력 개수가 다릅니다.'),
      showAnswer: !allPass
    };
    await _recordCRAttempt(allPass);
    render();
    return;
  }

  // ── 학생: 버그 찾기 줄 선택 (제출은 별도 버튼) ──
  if(act.action === 'cr-bug-select'){
    if(!CR_SEL || CR_SEL.type !== 'bugfix') return;
    CR_BUG_SEL = parseInt(el.dataset.lineno);
    CR_LAST_RESULT = null;
    render();
    return;
  }

  // ── 학생: 버그 찾기 제출 ──
  if(act.action === 'cr-submit-bugfix'){
    if(!CR_SEL || CR_SEL.type !== 'bugfix') return;
    if(!CR_BUG_SEL){ toast('버그가 있는 줄을 먼저 클릭하세요.', 'err'); return; }
    const expected = parseInt(CR_SEL.buggyLine);
    const pass = (CR_BUG_SEL === expected);
    CR_LAST_RESULT = {
      pass,
      given: `${CR_BUG_SEL}번 줄`,
      expected: `${expected}번 줄${CR_SEL.explanation ? ' — ' + CR_SEL.explanation : ''}`,
      msg: pass
        ? (CR_SEL.explanation ? '정답! ' + CR_SEL.explanation : '버그를 찾아냈어요!')
        : '그 줄이 아니에요. 코드의 흐름을 다시 한 번 따라가 보세요.',
      showAnswer: !pass
    };
    await _recordCRAttempt(pass);
    render();
    return;
  }

  // ── 학생: 힌트 보기 ──
  if(act.action === 'cr-show-hint'){
    if(CR_SEL?.type !== 'predict') return;
    CR_LAST_RESULT = {
      pass: false,
      msg: '💡 힌트: 출력 첫 줄은 ' + (CR_SEL.expectedOutput || '').split('\n')[0],
      showAnswer: false
    };
    render();
    return;
  }

  // ══════════════════════════════════════
  //  선생님 측
  // ══════════════════════════════════════

  // 새 문제 — data-qtype 으로 유형 받음 (없으면 predict)
  if(act.action === 'cr-new'){
    const qtype = act.qtype || 'predict';
    CR_EDITING = {
      title: '',
      description: '',
      type: qtype,
      code: '',
      stdin: ''
    };
    if(qtype === 'mcq')    CR_EDITING.choices = ['', '', '', ''], CR_EDITING.correctIndex = 0;
    if(qtype === 'cloze')  CR_EDITING.blanks = [];
    if(qtype === 'bugfix') CR_EDITING.buggyLine = 1;
    CR_VIEW = 'edit';
    render();
    return;
  }

  // cloze 편집기: 코드의 ___ 개수에 맞춰 빈칸 정답 입력란 갱신
  if(act.action === 'cr-cloze-refresh'){
    const codeEl = document.getElementById('cr-e-code');
    const code = codeEl ? codeEl.value : '';
    const count = (code.match(/___/g) || []).length;
    const cur = _readClozeBlanks();
    const next = new Array(count).fill('').map((_, i) => cur[i] || '');
    CR_EDITING = CR_EDITING || {};
    CR_EDITING.code = code;
    CR_EDITING.blanks = next;
    // 폼 부분만 갱신: 가장 간단한 방법은 전체 re-render
    render();
    return;
  }

  // 수정
  if(act.action === 'cr-edit'){
    const r = CR_READINGS.find(x => x.id === act.rid); if(!r) return;
    CR_EDITING = JSON.parse(JSON.stringify(r));
    CR_VIEW = 'edit';
    render();
    return;
  }

  // 편집 취소 / 목록으로
  if(act.action === 'cr-edit-cancel'){
    CR_EDITING = null;
    CR_VIEW = 'list';
    render();
    return;
  }

  // 자동 분석 미리보기
  if(act.action === 'cr-analyze'){
    const meta = _readCRForm();
    if(!meta.code.trim()){ toast('코드를 먼저 입력하세요.', 'err'); return; }
    el.disabled = true;
    el.textContent = '⏳ 분석 중... (Pyodide 첫 실행은 5~10초)';
    const result = await analyzeCode(meta.code, meta.stdin);
    el.disabled = false;
    el.textContent = '🪄 자동 분석 미리보기';
    const box = document.getElementById('cr-analyze-result');
    if(box) box.innerHTML = renderAnalyzeResult(result, meta.type);
    return;
  }

  // 저장 — 유형별 분기
  if(act.action === 'cr-save'){
    const meta = _readCRForm();
    const errEl = document.getElementById('cr-e-err');
    const setErr = (m) => { if(errEl) errEl.innerHTML = m; };
    if(!meta.title.trim()){ setErr('제목을 입력하세요.'); return; }

    const editId = act.editId;
    let targets;
    if(editId){
      targets = [TC_CLS?.id];
    } else {
      targets = getSelectedClasses('cr-e');
      if(!targets.length){ setErr('등록할 반을 한 개 이상 선택하세요.'); return; }
    }

    el.disabled = true;
    const origLabel = el.textContent;
    el.textContent = '⏳ 저장 중...';
    try {
      // 수정 시 기존 createdAt 보존
      if(editId && CR_EDITING?.createdAt) meta.createdAt = CR_EDITING.createdAt;
      let data;

      if(meta.type === 'predict' || meta.type === 'trace'){
        if(!meta.code.trim()){ setErr('코드를 입력하세요.'); el.disabled = false; el.textContent = origLabel; return; }
        el.textContent = '⏳ 분석+저장 중...';
        const result = await analyzeCode(meta.code, meta.stdin);
        if(!result.success){
          setErr('⚠️ 코드 실행 중 오류가 발생했어요. 코드를 점검해주세요.<br><pre style="font-size:11px;white-space:pre-wrap">' + esc(result.error) + '</pre>');
          el.disabled = false; el.textContent = origLabel; return;
        }
        data = buildReadingFromAnalysis(meta, result);
        if(meta.type === 'trace' && (!data.traces || !data.traces.length)){
          setErr('변수가 없거나 단일 표현식이라 트레이스 단계를 만들 수 없어요. 변수에 값을 대입하는 코드여야 해요.');
          el.disabled = false; el.textContent = origLabel; return;
        }

      } else if(meta.type === 'mcq'){
        const question = (document.getElementById('cr-e-question')?.value || '').trim();
        const explanation = (document.getElementById('cr-e-explanation')?.value || '').trim();
        const choices = [];
        document.querySelectorAll('.cr-e-choice').forEach(inp => {
          const i = parseInt(inp.dataset.cidx);
          choices[i] = inp.value || '';
        });
        const filled = choices.filter(c => c && c.trim()).length;
        if(filled < 2){ setErr('보기를 최소 2개 이상 입력하세요.'); el.disabled = false; el.textContent = origLabel; return; }
        const correctIndex = parseInt(document.querySelector('input[name="cr-correct"]:checked')?.value || '0');
        if(!choices[correctIndex] || !choices[correctIndex].trim()){
          setErr('정답으로 선택된 보기가 비어 있어요.'); el.disabled = false; el.textContent = origLabel; return;
        }
        data = {
          title: meta.title,
          description: meta.description || '',
          code: meta.code || '',
          type: 'mcq',
          question,
          choices: choices.map(c => c || ''),
          correctIndex,
          explanation,
          createdAt: meta.createdAt || new Date().toISOString()
        };

      } else if(meta.type === 'cloze'){
        if(!meta.code.trim()){ setErr('코드를 입력하세요.'); el.disabled = false; el.textContent = origLabel; return; }
        const blankCount = (meta.code.match(/___/g) || []).length;
        if(!blankCount){ setErr('코드 안에 빈칸이 없어요. <code>___</code> (밑줄 세 개) 로 채울 자리를 표시하세요.'); el.disabled = false; el.textContent = origLabel; return; }
        const blanks = _readClozeBlanks();
        if(blanks.length !== blankCount){
          setErr(`코드의 <code>___</code> 개수(${blankCount})와 정답 입력 칸 개수(${blanks.length})가 달라요. "🔄 코드 보고 빈칸 다시 만들기" 를 눌러 주세요.`);
          el.disabled = false; el.textContent = origLabel; return;
        }
        for(let i = 0; i < blanks.length; i++){
          if(!blanks[i] || !blanks[i].toString().trim()){
            setErr(`빈칸 ${i+1}번의 정답을 입력하세요.`);
            el.disabled = false; el.textContent = origLabel; return;
          }
        }
        data = {
          title: meta.title,
          description: meta.description || '',
          code: meta.code,
          type: 'cloze',
          blanks,
          createdAt: meta.createdAt || new Date().toISOString()
        };

      } else if(meta.type === 'bugfix'){
        if(!meta.code.trim()){ setErr('코드를 입력하세요.'); el.disabled = false; el.textContent = origLabel; return; }
        const ln = parseInt(document.getElementById('cr-e-buggy-line')?.value || '0');
        const totalLines = meta.code.split('\n').length;
        if(!ln || ln < 1 || ln > totalLines){
          setErr(`버그가 있는 줄 번호는 1~${totalLines} 사이여야 해요.`);
          el.disabled = false; el.textContent = origLabel; return;
        }
        const explanation = (document.getElementById('cr-e-explanation')?.value || '').trim();
        data = {
          title: meta.title,
          description: meta.description || '',
          code: meta.code,
          type: 'bugfix',
          buggyLine: ln,
          explanation,
          createdAt: meta.createdAt || new Date().toISOString()
        };

      } else {
        setErr('알 수 없는 퀴즈 유형이에요.');
        el.disabled = false; el.textContent = origLabel; return;
      }

      const rdId = editId || genId();
      for(const cid of targets){
        if(!cid) continue;
        await saveCodeReading(cid, rdId, {...data, id: rdId});
      }

      toast(editId ? '수정되었습니다.' : `${targets.length}개 반에 등록되었습니다.`, 'ok');
      CR_EDITING = null;
      CR_VIEW = 'list';
      if(TC_CLS) await loadCodeReadings(TC_CLS.id);
      render();
    } catch(err){
      setErr('저장 실패: ' + (err.message || err));
      el.disabled = false;
      el.textContent = origLabel;
    }
    return;
  }

  // 순서 변경 ▲▼
  if(act.action === 'cr-move-up' || act.action === 'cr-move-down'){
    if(!TC_CLS) return;
    el.disabled = true;
    const dir = act.action === 'cr-move-up' ? 'up' : 'down';
    const ok = await _moveItemBy(`codeReadings/${TC_CLS.id}`, CR_READINGS, act.rid, dir);
    if(ok){ await loadCodeReadings(TC_CLS.id); render(); }
    else { el.disabled = false; }
    return;
  }

  // 삭제
  if(act.action === 'cr-del'){
    if(!confirm(`"${act.rtitle}" 문제를 삭제할까요? (학생 진도도 모두 삭제됩니다)`)) return;
    try {
      await deleteCodeReading(TC_CLS.id, act.rid);
      await loadCodeReadings(TC_CLS.id);
      toast('삭제되었습니다.', 'ok');
      render();
    } catch(err){ toast('삭제 실패: ' + err.message, 'err'); }
    return;
  }

});

// 폼에서 메타데이터 읽기 — 공통 필드만 (유형별 추가 필드는 cr-save 에서 직접 읽음)
function _readCRForm(){
  const title = (document.getElementById('cr-e-title')?.value || '').trim();
  const description = (document.getElementById('cr-e-desc')?.value || '').trim();
  const code = document.getElementById('cr-e-code')?.value || '';
  const stdin = document.getElementById('cr-e-stdin')?.value || '';
  // 유형은 편집 중인 상태에서 가져옴 (cr-new 시 결정되어 폼에서는 바꾸지 않음)
  const type = CR_EDITING?.type || 'predict';
  return {title, description, code, stdin, type};
}

// 빈칸 정답 입력란 → 배열
function _readClozeBlanks(){
  const result = [];
  document.querySelectorAll('.cr-e-blank').forEach(inp => {
    const i = parseInt(inp.dataset.bidx);
    result[i] = inp.value || '';
  });
  return result;
}

// 시도/통과 기록 (학생)
async function _recordCRAttempt(pass){
  if(!ST_USER || !SEL_CLS || !CR_SEL) return;
  const prev = CR_PROGRESS[CR_SEL.id]?.[ST_USER.number] || {attempts: 0, passed: false};
  const next = {
    attempts: (prev.attempts || 0) + 1,
    passed: prev.passed || pass,
    lastAttempt: new Date().toISOString()
  };
  if(!CR_PROGRESS[CR_SEL.id]) CR_PROGRESS[CR_SEL.id] = {};
  CR_PROGRESS[CR_SEL.id][ST_USER.number] = next;
  try {
    await saveCodeReadingProgress(SEL_CLS.id, CR_SEL.id, ST_USER.number, next);
  } catch(err){
    console.warn('CR progress save failed:', err);
  }
}

