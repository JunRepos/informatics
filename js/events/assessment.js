/* ═══════════════════════════════════════
   events/assessment.js — 수행평가 이벤트 핸들러

   현재 단계 (1단계 commit):
     - 선생님: 활성화 토글
     - 학생: 진입 카드 클릭 (다음 단계에서 채팅으로 전환)
   다음 단계에서 추가될 것:
     - 워커 호출 + 채팅 모드
     - 줄별 설명 모드 + 잠금
     - 변형 과제 모드 + 제출
═══════════════════════════════════════ */

// ── 클릭 이벤트 ──
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // 학생: 진입 카드 클릭 (현재는 토스트 안내만, 다음 commit 에서 채팅 진입)
  if(act.action === 'asmt-start-mode'){
    toast('이 기능은 다음 업데이트에서 활성화됩니다.', 'ok');
    return;
  }

  // 학생: 이전 세션 이어가기 (다음 commit 에서 채팅 진입)
  if(act.action === 'asmt-resume'){
    toast('이어서 하기는 다음 업데이트에서 활성화됩니다.', 'ok');
    return;
  }

  // 선생님: 학생 상세 보기 (다음 commit)
  if(act.action === 'asmt-tc-view'){
    toast('학생 상세 화면은 다음 업데이트에서 추가돼요.', 'ok');
    return;
  }
});

// ── change 이벤트: 활성화 토글 ──
document.addEventListener('change', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;

  if(act.action === 'asmt-toggle-active'){
    const cid = TC_CLS?.id;
    if(!cid){ toast('반을 먼저 선택하세요.', 'err'); return; }
    const checked = el.checked;
    el.disabled = true;
    try {
      await setAsmtActive(cid, checked);
      toast(checked
        ? `✓ 수행평가가 활성화됐어요. 학생 화면에 메뉴가 표시됩니다.`
        : `수행평가가 비활성화됐어요. (저장된 학생 세션은 그대로 유지)`,
        'ok');
      render();
    } catch(err){
      toast('변경 실패: ' + (err.message || err), 'err');
      el.checked = !checked;
    } finally {
      el.disabled = false;
    }
    return;
  }
});
