/* ═══════════════════════════════════════
   events/assessment.js — 수행평가 이벤트 핸들러

   학생 흐름:
     entry → (카드 클릭) → chat 모드
       - 💡 아이디어 있어요  → 빈 채팅 (학생이 먼저 입력)
       - 🤔 모르겠어요       → AI가 먼저 인사
       - 📚 예시 보기         → 카테고리 → 예시 선택 → 채팅 시작
     entry 3분 무동작        → AI가 먼저 인사 (= 모르겠어요와 동일)

   선생님:
     수행평가 탭에서 활성화 토글 + 학생 진행 현황 표
═══════════════════════════════════════ */

// ── 진입 3분 자동 인사 타이머 ──
function _startAsmtEntryTimer(){
  _clearAsmtEntryTimer();
  ASMT_AUTO_TIMER = setTimeout(() => {
    if(ASMT_VIEW === 'entry' && ST_TAB === 'asmt'){
      _enterAsmtChat('need-help');
    }
  }, 3 * 60 * 1000); // 3분
}

function _clearAsmtEntryTimer(){
  if(ASMT_AUTO_TIMER){
    clearTimeout(ASMT_AUTO_TIMER);
    ASMT_AUTO_TIMER = null;
  }
}

// ── 채팅 모드로 진입 ──
//   mode: 'have-idea' | 'need-help' | { preset: '... 자동 입력 메시지 ...' }
async function _enterAsmtChat(mode){
  _clearAsmtEntryTimer();
  ASMT_VIEW = 'chat';
  ASMT_MESSAGES = [];
  ASMT_CODE = '';
  ASMT_TURN_COUNT = 0;
  ASMT_LINE_EXPLAINS = {};
  ASMT_LOADING = false;
  render();

  if(mode === 'have-idea'){
    // 학생이 먼저 입력. 별도 동작 없음.
    return;
  }

  // need-help 또는 preset 메시지 → 학생 메시지 또는 AI 인사 자동 시작
  if(mode && typeof mode === 'object' && mode.preset){
    // 학생 시뮬레이션 메시지 + AI 응답
    await _sendAsmtMessage(mode.preset);
    return;
  }

  if(mode === 'need-help'){
    // AI가 먼저 인사 — 사용자 메시지 없이 호출
    // Gemini는 사용자 메시지가 있어야 응답하므로 "(시작)" 같은 트리거 메시지 자동 추가
    await _sendAsmtMessage('(학생이 아직 어떤 프로그램을 만들지 정하지 못했습니다. 인사하고 진로/관심사를 물어 아이디어 찾기를 도와주세요.)');
    return;
  }
}

// ── 학생 메시지 전송 + AI 응답 받기 ──
async function _sendAsmtMessage(userText){
  if(!userText || !userText.trim()) return;
  if(ASMT_LOADING) return;
  if(ASMT_TURN_COUNT >= ASMT_TURN_LIMIT){
    toast(`대화 한도 ${ASMT_TURN_LIMIT}회를 모두 사용했어요.`, 'err');
    return;
  }

  // 사용자 메시지 추가
  ASMT_MESSAGES.push({
    role: 'user',
    content: userText.trim(),
    ts: Date.now()
  });
  ASMT_TURN_COUNT += 1;
  ASMT_LOADING = true;
  render();
  _scrollMsgListToBottom();

  try {
    // 워커 호출 — 시스템 프롬프트는 서버에 박혀있음
    const r = await fetch(ASMT_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: ASMT_MESSAGES.map(m => ({ role: m.role, content: m.content }))
      })
    });
    if(!r.ok){
      const errText = await r.text().catch(() => '');
      throw new Error(`서버 응답 오류 (${r.status}): ${errText.slice(0, 200)}`);
    }
    const data = await r.json();
    if(data.error){
      throw new Error(data.error);
    }
    const aiText = data.text || '';

    // AI 메시지 추가
    ASMT_MESSAGES.push({
      role: 'assistant',
      content: aiText,
      ts: Date.now()
    });

    // 코드 블록 추출 → 우측 패널에 반영
    const code = _extractAsmtCode(aiText);
    if(code){
      ASMT_CODE = code;
    }

    ASMT_LOADING = false;
    render();
    _scrollMsgListToBottom();
    _saveAsmtSession();
  } catch(e){
    ASMT_LOADING = false;
    // 실패한 학생 메시지는 그대로 둠 (다시 시도 가능)
    ASMT_MESSAGES.push({
      role: 'assistant',
      content: `(⚠️ AI 응답 중 오류가 발생했어요: ${e.message}\n\n잠시 후 다시 시도해 주세요.)`,
      ts: Date.now(),
      isError: true
    });
    render();
    _scrollMsgListToBottom();
  }
}

// ── 세션 저장 (debounce 1초) ──
function _saveAsmtSession(){
  if(!SEL_CLS || !ST_USER) return;
  if(ASMT_SAVE_TIMER) clearTimeout(ASMT_SAVE_TIMER);
  ASMT_SAVE_TIMER = setTimeout(async () => {
    try {
      const payload = {
        messages: ASMT_MESSAGES,
        code: ASMT_CODE,
        turnCount: ASMT_TURN_COUNT,
        prepSubmitted: ASMT_PREP_SUBMITTED || null,
        lineExplains: ASMT_LINE_EXPLAINS,
        view: ASMT_VIEW,
        modCode: ASMT_MOD_CODE || null,
        modReason: ASMT_MOD_REASON || null,
        modStdin: ASMT_MOD_STDIN || null,
        submittedAt: ASMT_SUBMITTED_AT || null
      };
      // null 값은 Firebase 에서 자동 제거됨
      await saveAsmtSession(SEL_CLS.id, ST_USER.number, payload);
    } catch(err){
      console.warn('[수행평가] 세션 저장 실패:', err);
    }
  }, 1000);
}

// 코드에 조건문/반복문이 들어있는지 검사 (주석·문자열 제외)
function _asmtCheckControl(code){
  const stripped = (code || '')
    .replace(/#.*$/gm, '')
    .replace(/'''[\s\S]*?'''/g, '')
    .replace(/"""[\s\S]*?"""/g, '')
    .replace(/'[^'\n]*'/g, "''")
    .replace(/"[^"\n]*"/g, '""');
  return {
    hasIf:   /\bif\b/.test(stripped),
    hasLoop: /\b(for|while)\b/.test(stripped)
  };
}

// 코멘트 debounce
let _asmtCommentTimer = null;

// ── Pyodide 워커 (변형 과제 실행) ──
let _asmtWorker = null;

function _ensureAsmtWorker(){
  if(_asmtWorker) return _asmtWorker;
  _asmtWorker = new Worker('js/asmt-worker.js?v=20260519');
  return _asmtWorker;
}

function _runAsmtCode(code, stdin){
  return new Promise((resolve) => {
    const w = _ensureAsmtWorker();
    const onMsg = (e) => {
      if(e.data?.type === 'result'){
        w.removeEventListener('message', onMsg);
        resolve(e.data);
      }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ type: 'run', code, stdin });
  });
}

// 메시지 영역 스크롤 하단으로
function _scrollMsgListToBottom(){
  setTimeout(() => {
    const el = document.getElementById('asmt-msg-list');
    if(el) el.scrollTop = el.scrollHeight;
  }, 30);
}

// ── 클릭 이벤트 ──
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // 학생: 진입 카드 클릭
  if(act.action === 'asmt-start-mode'){
    const mode = act.mode;
    if(mode === 'examples'){
      _clearAsmtEntryTimer();
      ASMT_VIEW = 'examples';
      ASMT_EXAMPLES_CAT = null;
      render();
      return;
    }
    await _enterAsmtChat(mode); // 'have-idea' or 'need-help'
    return;
  }

  // 학생: 이전 세션 이어가기
  if(act.action === 'asmt-resume'){
    _clearAsmtEntryTimer();
    ASMT_VIEW = ASMT_MESSAGES.length ? 'chat' : 'entry';
    render();
    if(ASMT_VIEW === 'chat') _scrollMsgListToBottom();
    return;
  }

  // 학생: 진입 화면으로 돌아가기 (대화는 보존)
  if(act.action === 'asmt-back-entry'){
    _clearAsmtEntryTimer();
    ASMT_VIEW = 'entry';
    ASMT_EXAMPLES_CAT = null;
    render();
    return;
  }

  // 학생: 카테고리 선택
  if(act.action === 'asmt-pick-cat'){
    ASMT_EXAMPLES_CAT = act.cat || null;
    render();
    return;
  }
  if(act.action === 'asmt-back-cats'){
    ASMT_EXAMPLES_CAT = null;
    render();
    return;
  }

  // 학생: 예시 클릭 → 채팅 시작 (자동 입력)
  if(act.action === 'asmt-pick-example'){
    const cat = ASMT_CATEGORIES.find(c => c.id === ASMT_EXAMPLES_CAT);
    const ex = cat?.examples[parseInt(act.idx)];
    if(!ex) return;
    await _enterAsmtChat({preset: `${ex} 를 만들어주세요.`});
    return;
  }

  // 학생: 메시지 전송
  if(act.action === 'asmt-send'){
    const input = document.getElementById('asmt-input');
    const text = input?.value || '';
    if(!text.trim()) return;
    if(input) input.value = '';
    await _sendAsmtMessage(text);
    return;
  }

  // 학생: "이 코드로 1차시 제출" → 조건+반복 검증 후 제출
  if(act.action === 'asmt-submit-prep'){
    if(!ASMT_CODE){ toast('아직 코드가 없어요. AI와 대화해서 코드를 먼저 만들어주세요.', 'err'); return; }
    const chk = _asmtCheckControl(ASMT_CODE);
    if(!chk.hasIf || !chk.hasLoop){
      const missing = [];
      if(!chk.hasIf)   missing.push('조건문(if)');
      if(!chk.hasLoop) missing.push('반복문(for 또는 while)');
      alert(`⚠️ 이 코드에는 ${missing.join(' 과 ')} 이(가) 없어요.\n\n` +
            `이번 수행평가는 조건문과 반복문이 모두 들어가야 해요.\n` +
            `채팅창에서 AI에게 "${missing.join(' 과 ')} 도 넣어주세요" 라고 요청한 다음 다시 제출해주세요.`);
      return;
    }
    if(!confirm('이 코드로 1차시를 제출할까요?\n\n제출 후에는 이번 시간에 더 수정할 수 없어요.\n다음 시간에 이 코드로 평가 활동(줄별 의미 적기·변형)을 진행합니다.')) return;
    ASMT_PREP_SUBMITTED = true;
    ASMT_VIEW = 'prep-done';
    render();
    _saveAsmtSession();
    toast('1차시 제출 완료! 수고하셨어요 🎉', 'ok');
    return;
  }

  // 학생: 줄별 설명 → 변형 과제 진입
  if(act.action === 'asmt-proceed-modify'){
    const meaningful = _asmtMeaningfulLines(ASMT_CODE);
    const done = meaningful.filter(i => (ASMT_LINE_EXPLAINS[i] || '').trim()).length;
    if(done < meaningful.length){
      toast(`아직 ${meaningful.length - done}줄이 비어 있어요.`, 'err');
      return;
    }
    ASMT_VIEW = 'modify';
    ASMT_MOD_CODE = ASMT_MOD_CODE || ASMT_CODE; // 첫 진입 시 원본 코드를 초깃값으로
    ASMT_RUN_RESULT = null;
    render();
    _saveAsmtSession();
    return;
  }

  // 학생: 변형 코드 실행
  if(act.action === 'asmt-run-mod'){
    if(ASMT_RUNNING) return;
    const code = document.getElementById('asmt-mod-code')?.value || '';
    const stdin = document.getElementById('asmt-mod-stdin')?.value || '';
    if(!code.trim()){ toast('실행할 코드가 비어 있어요.', 'err'); return; }
    ASMT_MOD_CODE = code;
    ASMT_MOD_STDIN = stdin;
    ASMT_RUNNING = true;
    ASMT_RUN_RESULT = null;
    render();
    const result = await _runAsmtCode(code, stdin);
    ASMT_RUNNING = false;
    ASMT_RUN_RESULT = result;
    render();
    _saveAsmtSession();
    return;
  }

  // 학생: 변형 코드 원본으로 되돌리기
  if(act.action === 'asmt-reset-mod'){
    if(!confirm('수정한 코드를 모두 지우고 원본으로 되돌릴까요?')) return;
    ASMT_MOD_CODE = ASMT_CODE;
    ASMT_RUN_RESULT = null;
    render();
    _saveAsmtSession();
    return;
  }

  // 학생: 최종 제출
  if(act.action === 'asmt-submit-final'){
    const code = document.getElementById('asmt-mod-code')?.value || ASMT_MOD_CODE || '';
    const reason = document.getElementById('asmt-mod-reason')?.value || ASMT_MOD_REASON || '';
    if(code.trim() === (ASMT_CODE || '').trim()){
      toast('원본 코드와 다르게 수정한 부분이 없어요.', 'err'); return;
    }
    if(reason.trim().length < 10){
      toast('변경 이유를 10자 이상 적어주세요.', 'err'); return;
    }
    if(!confirm('제출하시겠어요?\n제출 후에는 수정할 수 없어요.')) return;
    ASMT_MOD_CODE = code;
    ASMT_MOD_REASON = reason;
    ASMT_VIEW = 'done';
    ASMT_SUBMITTED_AT = new Date().toISOString();
    render();
    _saveAsmtSession();
    toast('제출 완료! 수고하셨어요 🎉', 'ok');
    return;
  }

  // 선생님: 학생 상세 보기
  if(act.action === 'asmt-tc-view'){
    const snum = act.snum;
    if(!snum) return;
    ASMT_TC_SEL_SNUM = snum;
    ASMT_VIEW = 'student';
    render();
    setTimeout(() => window.scrollTo({top:0, behavior:'instant'}), 30);
    return;
  }

  // 선생님: 학생 목록으로 돌아가기
  if(act.action === 'asmt-tc-back'){
    ASMT_TC_SEL_SNUM = null;
    ASMT_VIEW = 'manage';
    render();
    return;
  }

  // 선생님: CSV 내보내기
  if(act.action === 'asmt-export-csv'){
    if(!STUDENTS.length){ toast('학생 명단이 비어있어요.', 'err'); return; }
    const cid = TC_CLS?.id || 'unknown';
    const cls = TC_CLS?.label || cid;
    const headers = ['학번','이름','단계','대화수','알고리즘(5)','자료형(5)','입출력(5)','제어구조(5)','결과확인(5)','총점(25)','코멘트','제출시각'];
    const rows = STUDENTS.map(st => {
      const sess = ASMT_ALL_SESSIONS[st.number] || {};
      const sc = ASMT_ALL_SCORES[st.number] || {};
      const stageLabel = ({entry:'시작 전', chat:'1단계', explain:'2단계', modify:'3단계', done:'제출완료'})[sess.view] || (sess.messages?.length ? '진행 중' : '-');
      const total = _asmtScoreTotal(sc);
      const submittedAt = sess.submittedAt ? fmtDt(sess.submittedAt) : '';
      return [
        st.number, st.name, stageLabel, sess.turnCount || 0,
        sc.algo ?? '', sc.dataType ?? '', sc.io ?? '', sc.control ?? '', sc.result ?? '',
        total ?? '', (sc.comment || '').replace(/\n/g,' '), submittedAt
      ];
    });
    const csvRow = (arr) => arr.map(v => {
      const s = String(v ?? '');
      // 쉼표·따옴표·줄바꿈 포함 시 따옴표로 감싸고 따옴표는 두 번
      if(/[,"\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    }).join(',');
    const csv = '﻿' + csvRow(headers) + '\n' + rows.map(csvRow).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0,10);
    a.href = url; a.download = `수행평가-${cls}-${dateStr}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('✓ CSV 파일 다운로드 시작', 'ok');
    return;
  }

  // 선생님: phase 변경 (off / prep / eval)
  if(act.action === 'asmt-set-phase'){
    const cid = TC_CLS?.id;
    if(!cid){ toast('반을 먼저 선택하세요.', 'err'); return; }
    const next = act.phase;
    if(!['off','prep','eval'].includes(next)) return;
    if((ASMT_PHASE[cid] || 'off') === next) return; // 이미 그 단계
    const msg = ({
      'off':  '수행평가를 비활성화할까요? 학생 화면에서 메뉴가 사라집니다. (세션·점수는 보존)',
      'prep': '1차시(코드 만들기)를 시작할까요? 학생들이 AI와 코드를 만들 수 있게 됩니다.',
      'eval': '2차시(평가)를 시작할까요?\n\n학생들은 자기 1차시 코드로 줄별 설명·변형 과제를 하게 되고,\nAI 채팅은 잠깁니다. 1차시 제출을 못 한 학생은 평가 활동을 할 수 없어요.'
    })[next];
    if(!confirm(msg)) return;
    try {
      await setAsmtPhase(cid, next);
      toast(({
        'off':'비활성화됐어요.',
        'prep':'✓ 1차시 시작! 학생들이 코드를 만들 수 있어요.',
        'eval':'✓ 2차시 시작! 학생들이 평가 활동을 할 수 있어요.'
      })[next], 'ok');
      render();
    } catch(err){
      toast('변경 실패: ' + (err.message || err), 'err');
    }
    return;
  }
});

// ── change 이벤트: 활성화 토글 ──
document.addEventListener('change', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // 선생님: 채점 점수 입력 (라디오)
  if(act.action === 'asmt-score-input'){
    const snum = ASMT_TC_SEL_SNUM;
    if(!snum || !TC_CLS) return;
    const rid = el.dataset.rid;
    const val = parseInt(el.value);
    if(!rid || !val) return;
    const prev = ASMT_ALL_SCORES[snum] || {};
    const next = {...prev, [rid]: val};
    ASMT_ALL_SCORES[snum] = next;
    try {
      await saveAsmtScore(TC_CLS.id, snum, next);
      // 합계 칩 + 헤더 칩 갱신만 (re-render 없이)
      const total = _asmtScoreTotal(next);
      document.querySelectorAll('.asmt-tcs-score-sec .asmt-score-chip, .asmt-tcs-stu-info .asmt-score-chip').forEach(chip => {
        if(total != null) chip.textContent = `${total}/25`;
      });
      // 라벨 on/off
      el.closest('.asmt-tcs-score-opts')?.querySelectorAll('.asmt-tcs-score-opt').forEach(l => l.classList.remove('on'));
      el.closest('.asmt-tcs-score-opt')?.classList.add('on');
      const metaEl = document.querySelector('.asmt-tcs-score-meta');
      if(metaEl) metaEl.textContent = `💾 마지막 저장: ${fmtDt(new Date().toISOString())}`;
    } catch(err){
      toast('점수 저장 실패: ' + (err.message || err), 'err');
    }
    return;
  }

});

// ── 키보드: Enter 전송 ──
document.addEventListener('keydown', e => {
  if(e.target?.id !== 'asmt-input') return;
  if(e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();
  const text = e.target.value || '';
  if(!text.trim()) return;
  e.target.value = '';
  _sendAsmtMessage(text);
});

// ── 줄별 설명 입력 — 실시간 저장 (debounce) + 진행률 갱신 ──
let _asmtLineProgressTimer = null;
document.addEventListener('input', e => {
  const t = e.target;
  if(!t || !t.dataset) return;
  const a = t.dataset.action;

  // 줄별 설명 입력
  if(a === 'asmt-line-input'){
    const idx = parseInt(t.dataset.idx);
    const v = t.value || '';
    ASMT_LINE_EXPLAINS[idx] = v;
    if(v.trim()){ t.classList.add('filled'); } else { t.classList.remove('filled'); }
    _updateAsmtExplainProgress();
    _saveAsmtSession();
    return;
  }

  // 변형 과제 — 코드 입력
  if(a === 'asmt-mod-code-input'){
    ASMT_MOD_CODE = t.value || '';
    _updateAsmtModButtons();
    _saveAsmtSession();
    return;
  }

  // 변형 과제 — stdin 입력
  if(a === 'asmt-mod-stdin-input'){
    ASMT_MOD_STDIN = t.value || '';
    _saveAsmtSession();
    return;
  }

  // 선생님: 채점 코멘트 입력 (debounce 저장)
  if(a === 'asmt-score-comment'){
    const snum = ASMT_TC_SEL_SNUM;
    if(!snum || !TC_CLS) return;
    const prev = ASMT_ALL_SCORES[snum] || {};
    const next = {...prev, comment: t.value || ''};
    ASMT_ALL_SCORES[snum] = next;
    if(_asmtCommentTimer) clearTimeout(_asmtCommentTimer);
    _asmtCommentTimer = setTimeout(async () => {
      try { await saveAsmtScore(TC_CLS.id, snum, next); } catch(e){ /* ignore */ }
    }, 700);
    return;
  }

  // 변형 과제 — 변경 이유 입력
  if(a === 'asmt-mod-reason-input'){
    ASMT_MOD_REASON = t.value || '';
    _updateAsmtModButtons();
    // 글자 수 카운트 즉시 갱신
    const cntEl = document.querySelector('.asmt-mod-reason-count');
    if(cntEl) cntEl.textContent = `${(ASMT_MOD_REASON||'').trim().length} / 최소 10자`;
    _saveAsmtSession();
    return;
  }
});

// 변형 과제 화면 — 제출 버튼/변경됨 표시 갱신 (포커스 보존)
function _updateAsmtModButtons(){
  if(ASMT_VIEW !== 'modify') return;
  const codeDiff = (ASMT_MOD_CODE || '') !== (ASMT_CODE || '');
  const reasonFilled = (ASMT_MOD_REASON || '').trim().length >= 10;
  const canSubmit = codeDiff && reasonFilled;
  const btn = document.querySelector('[data-action="asmt-submit-final"]');
  if(btn){
    btn.disabled = !canSubmit;
    btn.textContent = canSubmit ? '✓ 제출' : (codeDiff ? '변경 이유를 적어주세요' : '코드를 수정해주세요');
  }
  // "변경됨" 칩 토글
  const head = document.querySelector('.asmt-mod-edit-head');
  if(head){
    const chip = head.querySelector('.asmt-mod-changed');
    if(codeDiff && !chip){
      const span = document.createElement('span');
      span.className = 'asmt-mod-changed';
      span.textContent = '변경됨';
      head.appendChild(span);
    } else if(!codeDiff && chip){
      chip.remove();
    }
  }
}

function _updateAsmtExplainProgress(){
  if(ASMT_VIEW !== 'explain') return;
  const meaningful = _asmtMeaningfulLines(ASMT_CODE);
  const total = meaningful.length;
  const done = meaningful.filter(i => (ASMT_LINE_EXPLAINS[i] || '').trim()).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const countEl = document.querySelector('.asmt-explain-count');
  const fillEl = document.querySelector('.asmt-explain-bar-fill');
  if(countEl) countEl.textContent = `${done} / ${total} 줄 완료`;
  if(fillEl) fillEl.style.width = pct + '%';
  // 다음 버튼 활성화
  const nextBtn = document.querySelector('[data-action="asmt-proceed-modify"]');
  if(nextBtn){
    const allDone = done >= total && total > 0;
    nextBtn.disabled = !allDone;
    nextBtn.textContent = allDone ? '다음: 변형 과제 →' : `${total - done}줄 더 채우기`;
  }
}

// ── render 후 처리: 채팅 모드에서 스크롤·포커스 + 진입 화면 타이머 ──
function afterRenderAssessment(){
  if(ST_TAB !== 'asmt') {
    _clearAsmtEntryTimer();
    return;
  }
  if(ASMT_VIEW === 'entry'){
    _startAsmtEntryTimer();
  } else if(ASMT_VIEW === 'chat'){
    _scrollMsgListToBottom();
    // 입력창 자동 포커스
    setTimeout(() => {
      const inp = document.getElementById('asmt-input');
      if(inp && !inp.disabled) inp.focus();
    }, 50);
  }
}

// 전역 노출 — render.js 의 afterRender 에서 호출
window.afterRenderAssessment = afterRenderAssessment;
