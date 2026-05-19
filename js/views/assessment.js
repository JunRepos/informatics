/* ═══════════════════════════════════════
   views/assessment.js — 수행평가 (AI 코딩 도우미)

   학생: 진로 인터뷰 → AI 코드 생성 → 줄별 설명 → 변형 과제 → 제출
   선생님: 활성화 토글 + 학생별 진행 현황 + 제출물 열람·채점

   백엔드: Cloudflare Worker → Gemini 2.5 Flash
   (워커 URL/턴 한도는 state.js 의 ASMT_WORKER_URL, ASMT_TURN_LIMIT)
═══════════════════════════════════════ */

// ══════════════════════════════════════
//  학생 뷰
// ══════════════════════════════════════

function vStAssessment(){
  // 진입 화면 (entry) — 카드 3개. 다음 단계는 다음 commit 에서 구현.
  if(ASMT_VIEW === 'entry') return vStAsmtEntry();
  // 다음 단계 (chat/explain/modify/done) 는 차차 추가
  return vStAsmtEntry();
}

function vStAsmtEntry(){
  // 진행 중 세션이 있으면 안내 배너
  const hasSession = ASMT_MESSAGES.length > 0 || ASMT_CODE;
  const resumeBanner = hasSession ? `
    <div class="asmt-resume-banner">
      <span>📌 이전에 진행 중이던 작업이 있어요</span>
      <button class="btn-p btn-sm" data-action="asmt-resume">이어서 하기</button>
    </div>` : '';

  return `
    <div class="asmt-entry-wrap">
      ${resumeBanner}
      <div class="asmt-hero">
        <div class="asmt-hero-title">📝 AI와 함께 만드는 나만의 프로그램</div>
        <div class="asmt-hero-sub">
          진로와 관련된 작은 Python 프로그램을 AI와 함께 구상하고,<br>
          코드의 의미를 직접 적어보는 활동입니다.
        </div>
      </div>

      <div class="asmt-step-row">
        <div class="asmt-step"><span class="asmt-step-num">1</span><span>AI와 대화하며 만들 프로그램 정하기</span></div>
        <div class="asmt-step-sep">→</div>
        <div class="asmt-step"><span class="asmt-step-num">2</span><span>AI가 만든 코드의 각 줄 의미 적기</span></div>
        <div class="asmt-step-sep">→</div>
        <div class="asmt-step"><span class="asmt-step-num">3</span><span>코드 변형 과제 풀기</span></div>
      </div>

      <div class="asmt-cards-title">시작 방법을 골라주세요</div>
      <div class="asmt-cards">
        <button class="asmt-card asmt-card-a" data-action="asmt-start-mode" data-mode="have-idea">
          <div class="asmt-card-icon">💡</div>
          <div class="asmt-card-title">아이디어가 있어요</div>
          <div class="asmt-card-desc">만들고 싶은 프로그램이 떠올랐어요.<br>바로 AI에게 부탁할게요.</div>
        </button>

        <button class="asmt-card asmt-card-b" data-action="asmt-start-mode" data-mode="need-help">
          <div class="asmt-card-icon">🤔</div>
          <div class="asmt-card-title">아직 모르겠어요</div>
          <div class="asmt-card-desc">AI가 질문을 던지면서<br>아이디어 찾는 걸 도와줘요.</div>
        </button>

        <button class="asmt-card asmt-card-c" data-action="asmt-start-mode" data-mode="examples">
          <div class="asmt-card-icon">📚</div>
          <div class="asmt-card-title">예시 보기</div>
          <div class="asmt-card-desc">진로별 프로그램 예시를 보고<br>마음에 드는 걸 골라요.</div>
        </button>
      </div>

      <div class="asmt-entry-note">
        💡 3분 동안 선택하지 않으면 AI가 먼저 인사할게요.
      </div>
    </div>
  `;
}

// ══════════════════════════════════════
//  선생님 뷰
// ══════════════════════════════════════

function vTcAssessment(){
  if(!TC_CLS) return emptyBox('👆','관리할 반을 먼저 선택하세요.');
  // 학생 상세 보기는 다음 단계에서 구현
  return vTcAsmtManage();
}

function vTcAsmtManage(){
  const cid = TC_CLS.id;
  const active = !!ASMT_ACTIVE[cid];

  // 학생별 진행 단계 요약
  const sessions = ASMT_ALL_SESSIONS || {};
  const stuRows = STUDENTS.map(st => {
    const s = sessions[st.number] || null;
    const stage = s?.view || (s?.messages?.length ? 'chat' : '-');
    const stageLabel = ({
      'entry':   '시작 전',
      'chat':    '1️⃣ AI 대화',
      'explain': '2️⃣ 줄별 설명',
      'modify':  '3️⃣ 변형 과제',
      'done':    '✓ 제출 완료',
    })[stage] || '-';
    const turns = s?.turnCount || 0;
    const updatedAt = s?.updatedAt ? fmtDt(s.updatedAt) : '-';
    return `<tr>
      <td>${esc(st.number)}</td>
      <td>${esc(st.name)}</td>
      <td>${stageLabel}</td>
      <td>${turns}/${ASMT_TURN_LIMIT}</td>
      <td>${updatedAt}</td>
      <td><button class="btn-xs" data-action="asmt-tc-view" data-snum="${esc(st.number)}" disabled title="(다음 단계에서 활성화)">상세</button></td>
    </tr>`;
  }).join('');

  const submittedCount = STUDENTS.filter(st => sessions[st.number]?.view === 'done').length;
  const inProgressCount = STUDENTS.filter(st => {
    const s = sessions[st.number];
    return s && s.view !== 'done' && (s.messages?.length || 0) > 0;
  }).length;

  return `
    <div class="asmt-tc-toggle-row">
      <div class="asmt-tc-toggle-info">
        <div class="asmt-tc-toggle-title">📝 수행평가 활성화</div>
        <div class="asmt-tc-toggle-desc">
          ${active
            ? '<b style="color:var(--ok)">● 활성화됨</b> — 정보반 학생 화면에 "📝 수행평가" 탭이 보입니다.'
            : '<b style="color:var(--text3)">● 비활성</b> — 토글을 켜면 학생들이 시작할 수 있어요.'}
        </div>
      </div>
      <label class="asmt-toggle-switch">
        <input type="checkbox" data-action="asmt-toggle-active" ${active ? 'checked' : ''}/>
        <span class="asmt-toggle-slider"></span>
      </label>
    </div>

    <div class="asmt-stat-grid">
      <div class="stat-card"><div class="stat-num">${STUDENTS.length}</div><div class="stat-label">전체 학생</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--accent)">${inProgressCount}</div><div class="stat-label">진행 중</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--ok)">${submittedCount}</div><div class="stat-label">제출 완료</div></div>
    </div>

    <div class="sec-title" style="margin-top:14px">학생별 진행 현황</div>
    ${STUDENTS.length === 0
      ? emptyBox('👥', '먼저 학생을 등록하세요.')
      : `<div style="overflow-x:auto"><table class="tbl asmt-tc-table">
          <thead><tr><th>학번</th><th>이름</th><th>단계</th><th>대화</th><th>마지막 활동</th><th></th></tr></thead>
          <tbody>${stuRows}</tbody>
        </table></div>`
    }

    <div class="asmt-tc-help">
      <b>📖 운영 안내</b>
      <ul>
        <li>활성화 토글을 켜면 학생 화면에 메뉴가 즉시 나타납니다 (학생 새로고침 필요).</li>
        <li>평가 종료 후 토글을 끄면 메뉴가 사라져 학생이 추가 시도를 못 합니다 (저장된 세션은 보존).</li>
        <li>학생당 AI 와의 메시지 교환은 최대 <b>${ASMT_TURN_LIMIT}회</b> 입니다.</li>
        <li>학생 상세 화면(대화 로그·코드·줄별 설명·변형 과제 제출물)은 다음 업데이트에서 추가됩니다.</li>
      </ul>
    </div>
  `;
}
