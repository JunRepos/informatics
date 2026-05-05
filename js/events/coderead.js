/* ═══════════════════════════════════════
   events/coderead.js — 코드 읽기 이벤트 핸들러

   - 학생: 문제 선택, 답안 제출, 다음 단계
   - 선생님: 문제 CRUD, 자동 분석, 예제 일괄 등록
═══════════════════════════════════════ */

// ── 학생: 답 비교 헬퍼 ──
function _normalizeAns(s){
  return String(s == null ? '' : s).replace(/\r\n/g, '\n').split('\n').map(l => l.replace(/\s+$/,'')).join('\n').trim();
}

// 트레이스 답 비교 — 사용자 입력을 약간 관대하게 받음
function _matchTraceValue(given, expected){
  const g = String(given || '').trim();
  const e = String(expected || '').trim();
  if(g === e) return true;
  // 따옴표 차이만 있는 문자열: '..' vs ".."
  if(/^["'].*["']$/.test(g) && /^["'].*["']$/.test(e)){
    const stripQuotes = (s) => s.slice(1, -1);
    if(stripQuotes(g) === stripQuotes(e)) return true;
  }
  // 정수 표기 차이 (예: 5 == 5.0 비허용 — 의도적)
  // 부울/None 대소문자 관대 (True == true)
  if(g.toLowerCase() === e.toLowerCase() &&
     ['true','false','none','True','False','None'].includes(g) &&
     ['true','false','none','True','False','None'].includes(e)) return true;
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

  // 새 문제
  if(act.action === 'cr-new'){
    CR_EDITING = {
      title: '',
      description: '',
      type: 'predict',
      code: '',
      stdin: ''
    };
    CR_VIEW = 'edit';
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

  // 저장
  if(act.action === 'cr-save'){
    const meta = _readCRForm();
    if(!meta.title.trim()){ document.getElementById('cr-e-err').textContent = '제목을 입력하세요.'; return; }
    if(!meta.code.trim()){ document.getElementById('cr-e-err').textContent = '코드를 입력하세요.'; return; }

    const editId = act.editId;
    let targets;
    if(editId){
      targets = [TC_CLS?.id]; // 수정은 현재 반만
    } else {
      targets = getSelectedClasses('cr-e');
      if(!targets.length){ document.getElementById('cr-e-err').textContent = '등록할 반을 한 개 이상 선택하세요.'; return; }
    }

    el.disabled = true;
    el.textContent = '⏳ 분석+저장 중...';
    try {
      // 항상 분석 실행 — 정답 자동 추출
      const result = await analyzeCode(meta.code, meta.stdin);
      if(!result.success){
        document.getElementById('cr-e-err').innerHTML = '⚠️ 코드 실행 중 오류가 발생했어요. 코드를 점검해주세요.<br><pre style="font-size:11px;white-space:pre-wrap">' + esc(result.error) + '</pre>';
        el.disabled = false;
        el.textContent = editId ? '수정 완료' : '문제 등록';
        return;
      }
      // 수정 시 기존 createdAt 보존
      if(editId && CR_EDITING?.createdAt) meta.createdAt = CR_EDITING.createdAt;
      const data = buildReadingFromAnalysis(meta, result);
      if(meta.type === 'trace' && (!data.traces || !data.traces.length)){
        document.getElementById('cr-e-err').textContent = '변수가 없거나 단일 표현식이라 트레이스 단계를 만들 수 없어요. 변수에 값을 대입하는 코드여야 해요.';
        el.disabled = false;
        el.textContent = editId ? '수정 완료' : '문제 등록';
        return;
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
      document.getElementById('cr-e-err').textContent = '저장 실패: ' + (err.message || err);
      el.disabled = false;
      el.textContent = editId ? '수정 완료' : '문제 등록';
    }
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

  // 예제 일괄 등록
  if(act.action === 'cr-load-samples'){
    if(!TC_CLS){ toast('반을 먼저 선택하세요.', 'err'); return; }
    if(!confirm(`${TC_CLS.label}에 예제 코드 읽기 문제 10개를 한 번에 등록할까요?`)) return;
    el.disabled = true;
    el.textContent = '⏳ 분석+등록 중... (1~2분)';
    try {
      let registered = 0;
      for(const sample of CR_SAMPLES){
        const result = await analyzeCode(sample.code, sample.stdin || '');
        if(!result.success){
          console.warn('샘플 분석 실패:', sample.title, result.error);
          continue;
        }
        const data = buildReadingFromAnalysis({
          title: sample.title,
          description: sample.description || '',
          code: sample.code,
          stdin: sample.stdin || '',
          type: sample.type,
          createdAt: new Date(Date.now() + registered).toISOString() // 등록순서 유지
        }, result);
        if(sample.type === 'trace' && !data.traces?.length) continue;
        const rdId = genId();
        await saveCodeReading(TC_CLS.id, rdId, {...data, id: rdId});
        registered++;
      }
      toast(`✓ ${registered}개 예제 문제가 등록됐어요!`, 'ok');
      await loadCodeReadings(TC_CLS.id);
      render();
    } catch(err){
      toast('등록 실패: ' + err.message, 'err');
    } finally {
      el.disabled = false;
      el.textContent = '🎁 예제 10문제 한방 등록';
    }
    return;
  }
});

// 폼에서 메타데이터 읽기
function _readCRForm(){
  const title = (document.getElementById('cr-e-title')?.value || '').trim();
  const description = (document.getElementById('cr-e-desc')?.value || '').trim();
  const code = document.getElementById('cr-e-code')?.value || '';
  const stdin = document.getElementById('cr-e-stdin')?.value || '';
  const type = (document.querySelector('input[name="cr-type"]:checked')?.value) || 'predict';
  return {title, description, code, stdin, type};
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

// ══════════════════════════════════════
//  예제 문제 10개
//  교실에서 바로 쓸 수 있는 기초 코드 — 변수, 산술, 조건, 반복, 리스트
// ══════════════════════════════════════
const CR_SAMPLES = [
  {
    title: '1. 변수와 산술',
    description: '변수에 숫자를 담아 더하기·곱하기 결과를 예측해 봐요.',
    type: 'predict',
    code: 'a = 3\nb = 4\nprint(a + b)\nprint(a * b)\n'
  },
  {
    title: '2. 변수 다시 대입하기',
    description: '같은 이름의 변수에 새 값을 넣으면 어떻게 될까요?',
    type: 'trace',
    code: 'x = 10\nx = x + 5\nx = x * 2\n'
  },
  {
    title: '3. 문자열 합치기',
    description: '+ 연산자로 문자열을 이어 붙이기.',
    type: 'predict',
    code: 'name = "지민"\nhello = "안녕, " + name + "!"\nprint(hello)\n'
  },
  {
    title: '4. 조건문 — if/else',
    description: '점수가 60점 이상이면 합격이에요.',
    type: 'predict',
    code: 'score = 75\nif score >= 60:\n    print("합격")\nelse:\n    print("불합격")\n'
  },
  {
    title: '5. for 반복 — 누적합',
    description: '1부터 5까지 더하면 얼마일까요?',
    type: 'trace',
    code: 'total = 0\nfor i in range(1, 6):\n    total = total + i\n'
  },
  {
    title: '6. while 반복 — 카운트다운',
    description: 'n이 0이 될 때까지 줄어드는 모습을 추적해요.',
    type: 'trace',
    code: 'n = 4\nwhile n > 0:\n    n = n - 1\n'
  },
  {
    title: '7. 리스트와 인덱싱',
    description: '리스트의 0번째, 마지막 원소를 꺼내 보세요.',
    type: 'predict',
    code: 'nums = [10, 20, 30, 40]\nprint(nums[0])\nprint(nums[-1])\nprint(len(nums))\n'
  },
  {
    title: '8. 리스트에 값 추가하기',
    description: 'append로 리스트를 키워가요.',
    type: 'trace',
    code: 'fruits = []\nfruits.append("사과")\nfruits.append("바나나")\nfruits.append("귤")\n'
  },
  {
    title: '9. 함수와 반환값',
    description: '함수가 돌려주는 값을 변수에 받기.',
    type: 'predict',
    code: 'def square(n):\n    return n * n\n\na = square(3)\nb = square(5)\nprint(a + b)\n'
  },
  {
    title: '10. 짝수만 모으기',
    description: '반복문 + 조건문 종합 — 짝수만 새 리스트에 담기.',
    type: 'trace',
    code: 'nums = [1, 2, 3, 4, 5, 6]\nevens = []\nfor n in nums:\n    if n % 2 == 0:\n        evens.append(n)\n'
  }
];
