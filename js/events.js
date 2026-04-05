/* ═══════════════════════════════════════
   events.js — 이벤트 핸들러

   클릭, 키보드, 폼 입력 등 모든 이벤트 처리.
   data-action 기반 이벤트 위임(delegation) 패턴 사용.
═══════════════════════════════════════ */

// ── data-action 기반 클릭 이벤트 ──
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const act = el.dataset;

  // 홈: 반 선택
  if(act.action === 'pick-class'){
    const cls = classById(act.cid); if(!cls) return;
    SEL_CLS = cls;
    if(!ST_USER && !IS_TC){ go('student-login'); return; }
    if(IS_TC){ TC_CLS = cls; await loadAllClassData(cls.id); }
    else await loadAllClassData(cls.id);
    go(IS_TC ? 'teacher' : 'student');
    return;
  }

  // 공지 파일 다운로드
  if(act.action === 'dl-notice-file'){ dlFile(act.name, act.url); return; }

  // 게시물 선택
  if(act.action === 'pick-post'){
    const p = POSTS.find(x => x.id === act.pid); if(!p) return;
    go('post-detail', {post: p}); return;
  }

  // 과제 선택 (학생)
  if(act.action === 'pick-assign'){
    const a = ASSIGNMENTS.find(x => x.id === act.aid); if(!a) return;
    if(ST_USER) await loadSubmissions(CID(), a.id);
    go('assign-detail', {assign: a}); return;
  }

  // 새 게시물
  if(act.action === 'new-post'){ VIEW = 'new-post'; render(); return; }

  // 선생님 파일 다운로드
  if(act.action === 'dl-tc-file'){
    const f = TC_FILES.find(x => x.id === act.id); if(!f) return;
    const origText = el.textContent;
    el.textContent = '...'; el.disabled = true;
    try{ dlFile(f.name, f.url || await storage.ref(f.storagePath).getDownloadURL()); }
    catch(err){ alert('다운로드 실패: ' + err.message); }
    el.textContent = origText; el.disabled = false; return;
  }

  // 이미지 미리보기
  if(act.action === 'preview-img'){ showImgModal(act.url, act.name); return; }

  // 게시물 파일 다운로드
  if(act.action === 'dl-post-file'){
    el.textContent = '...'; el.disabled = true;
    try{ dlFile(SEL_POST.fileName, SEL_POST.url || await storage.ref(SEL_POST.storagePath).getDownloadURL()); }
    catch(err){ alert('다운로드 실패: ' + err.message); }
    el.textContent = '📥 파일 다운로드'; el.disabled = false; return;
  }

  // 과제 첨부파일 다운로드
  if(act.action === 'dl-assign-file'){
    el.textContent = '...'; el.disabled = true;
    try{ dlFile(SEL_ASSIGN.fileName, SEL_ASSIGN.fileUrl); }
    catch(err){ alert('다운로드 실패: ' + err.message); }
    el.textContent = '다운로드'; el.disabled = false; return;
  }

  // 제출 파일 다운로드
  if(act.action === 'dl-sub-file' || act.action === 'dl-my-sub'){
    el.textContent = '...'; el.disabled = true;
    try{ dlFile(act.name, act.url); } catch(err){ alert('실패: ' + err.message); }
    el.textContent = '다운'; el.disabled = false; return;
  }

  // 제출 현황 보기 (선생님)
  if(act.action === 'view-status'){
    const aid = act.aid;
    const cid = TC_CLS?.id; if(!cid) return;
    el.textContent = '...'; el.disabled = true;
    await loadSubmissions(cid, aid);
    const wrap = el.closest('.list-row');
    if(wrap){
      const existing = document.getElementById('status-table-' + aid);
      if(existing){ existing.remove(); el.textContent = '현황'; el.disabled = false; return; }
      const div = document.createElement('div');
      div.id = 'status-table-' + aid;
      div.innerHTML = vStatusTable(aid);
      wrap.after(div);
      div.querySelector('#zip-btn')?.addEventListener('click', () => doZipDownload(aid));
    }
    el.textContent = '현황'; el.disabled = false; return;
  }

  // 현황 테이블 닫기
  if(act.action === 'close-status'){
    document.getElementById('status-table-' + act.aid)?.remove(); return;
  }

  // 공지 수정
  if(act.action === 'edit-notice'){
    window._ncEditId = act.nid; setTC('notice'); return;
  }

  // 과제 수정
  if(act.action === 'edit-assign'){
    window._acEditId = act.aid; setTC('assign'); return;
  }

  // 묶음 ZIP 다운로드
  if(act.action === 'dl-group-zip'){
    const gid = act.gid;
    const groupFiles = TC_FILES.filter(f => (f.groupId || f.id) === gid && f.url);
    if(!groupFiles.length){ alert('다운로드할 파일이 없습니다.'); return; }
    el.textContent = '...'; el.disabled = true;
    try{
      const zip = new JSZip();
      for(const f of groupFiles){
        const res = await fetch(f.url); const blob = await res.blob();
        zip.file(f.name, blob);
      }
      const content = await zip.generateAsync({type: 'blob'});
      const url = URL.createObjectURL(content);
      dlFile(`파일묶음_${gid}.zip`, url);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch(err){ alert('ZIP 실패: ' + err.message); }
    el.textContent = '📦 전체 다운'; el.disabled = false; return;
  }

  // 전체 선생님 파일 ZIP
  if(act.action === 'dl-all-tc-zip'){
    const allFiles = TC_FILES.filter(f => f.url);
    if(!allFiles.length){ alert('다운로드할 파일이 없습니다.'); return; }
    el.textContent = '...'; el.disabled = true;
    try{
      const zip = new JSZip();
      for(const f of allFiles){
        const res = await fetch(f.url); const blob = await res.blob();
        zip.file(f.name, blob);
      }
      const content = await zip.generateAsync({type: 'blob'});
      const url = URL.createObjectURL(content);
      dlFile(`전체파일_${TC_CLS?.label || ''}.zip`, url);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch(err){ alert('ZIP 실패: ' + err.message); }
    el.textContent = '📦 전체 파일 ZIP 다운로드'; el.disabled = false; return;
  }

  // 내 제출 보기 (학생)
  if(act.action === 'view-my-sub'){
    const a = ASSIGNMENTS.find(x => x.id === act.aid); if(!a) return;
    await loadSubmissions(CID(), a.id);
    go('assign-detail', {assign: a}); return;
  }

  // 공지 고정/해제
  if(act.action === 'toggle-pin'){
    const cid = TC_CLS?.id; if(!cid) return;
    el.disabled = true;
    await db.ref(`notices/${cid}/${act.nid}/isPinned`).set(act.pinned !== 'true');
    await loadNotices(cid); render(); return;
  }

  // 공지 삭제
  if(act.action === 'del-notice'){
    if(!confirm(`"${act.ntitle}" 공지를 삭제할까요?`)) return;
    const cid = TC_CLS?.id; if(!cid) return;
    const n = NOTICES.find(x => x.id === act.nid);
    if(n?.filePath) await storage.ref(n.filePath).delete().catch(() => {});
    await db.ref(`notices/${cid}/${act.nid}`).remove();
    window._ncEditId = null;
    await loadNotices(cid); render(); return;
  }

  // 과제 삭제
  if(act.action === 'del-assign'){
    if(!confirm(`"${act.atitle}" 과제를 삭제할까요?`)) return;
    const cid = TC_CLS?.id; if(!cid) return;
    const a = ASSIGNMENTS.find(x => x.id === act.aid);
    if(a?.filePath) await storage.ref(a.filePath).delete().catch(() => {});
    await db.ref(`assignments/${cid}/${act.aid}`).remove();
    window._acEditId = null;
    await loadAssignments(cid); render(); return;
  }

  // 학생 비밀번호 초기화
  if(act.action === 'reset-st-pw'){
    const cid = TC_CLS?.id; if(!cid) return;
    if(!confirm(`${act.sname}(${act.snum}) 학생의 비밀번호를 학번으로 초기화할까요?`)) return;
    el.disabled = true;
    const salt = generateSalt();
    const h = await hashWithSalt(act.snum, salt);
    await db.ref(`students/${cid}/${act.snum}`).update({passwordHash: h, salt, isFirstLogin: true});
    await loadStudents(cid); render(); return;
  }

  // 학생 삭제
  if(act.action === 'del-student'){
    const cid = TC_CLS?.id; if(!cid) return;
    if(!confirm(`${act.sname}(${act.snum}) 학생을 삭제할까요?`)) return;
    el.disabled = true;
    await db.ref(`students/${cid}/${act.snum}`).remove();
    await loadStudents(cid); render(); return;
  }

  // 공유 파일 삭제
  if(act.action === 'del-tc-file'){
    const cid = TC_CLS?.id; if(!cid) return;
    if(!confirm(`"${act.fname}" 을 삭제할까요?`)) return;
    el.disabled = true;
    if(act.path) await storage.ref(act.path).delete().catch(() => {});
    await db.ref(`teacherFiles/${cid}/${act.id}`).remove();
    await loadTcFiles(cid); render(); return;
  }

  // 게시물 삭제
  if(act.action === 'del-post-btn' || el.id === 'del-post-btn' || el.id === 'del-my-post-btn'){
    if(!confirm(`"${SEL_POST?.title}" 게시물을 삭제할까요?`)) return;
    const cid = CID(); if(!cid) return;
    if(SEL_POST?.storagePath) await storage.ref(SEL_POST.storagePath).delete().catch(() => {});
    await db.ref(`posts/${cid}/${SEL_POST.id}`).remove();
    await loadPosts(cid);
    SEL_POST = null;
    IS_TC ? go('teacher') : go('student'); return;
  }
});

// ── 키보드 이벤트 ──
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') closeModal();
});

document.addEventListener('keydown', e => {
  if(e.key !== 'Enter') return;
  const t = e.target;
  if(t.id === 'sl-pw') document.getElementById('sl-btn')?.click();
  if(t.id === 'tl-pw' || t.id === 'tl-pw2') document.getElementById('tl-btn')?.click();
  if(t.id === 'pd-pw') document.getElementById('pd-ok')?.click();
  if(t.id === 'cp-new' || t.id === 'cp-con') document.getElementById('cp-btn')?.click();
});

// ── 날짜/파일 변경 이벤트 ──
document.addEventListener('change', async e => {
  if(e.target.id === 'at-date-input'){
    AT_DATE = e.target.value;
    if(TC_CLS) await loadAttendance(TC_CLS.id, AT_DATE);
    render();
  }
  if(e.target.id === 'tf-file'){
    const files = Array.from(e.target.files || []);
    const listEl = document.getElementById('tf-file-list');
    if(!listEl) return;
    if(!files.length){ listEl.style.display = 'none'; listEl.innerHTML = ''; return; }
    listEl.style.display = 'block';
    listEl.innerHTML = files.map(f => `<div>📎 ${esc(f.name)} (${fmtSz(f.size)})</div>`).join('');
  }
});

// ── 출결 & 폼 제출 클릭 이벤트 ──
document.addEventListener('click', async e => {
  const t = e.target;

  // 선생님 반 이동
  if(t.id === 'tc-cls-go'){
    const sel = document.getElementById('tc-cls-sel');
    const cls = classById(sel?.value); if(!cls) return;
    TC_CLS = cls; t.textContent = '...'; t.disabled = true;
    await loadAllClassData(cls.id);
    for(const a of ASSIGNMENTS) await loadSubmissions(cls.id, a.id);
    if(TC_TAB === 'attend') await loadAttendance(cls.id, AT_DATE);
    t.textContent = '이동'; t.disabled = false;
    render(); return;
  }

  // 출결: 상태 변경
  if(e.target.closest('[data-action=at-set]')){
    const el = e.target.closest('[data-action=at-set]');
    const num = el.dataset.num, status = el.dataset.status;
    const cid = TC_CLS?.id; if(!cid) return;
    el.disabled = true;
    const prev = ATTENDANCE[num] || {};
    const reason = (status === '출석') ? null : (prev.reason || null);
    await saveAttendance(cid, AT_DATE, num, status, reason);
    const row = document.getElementById('atr-' + num);
    if(row) row.outerHTML = buildAtRow({number: num, name: STUDENTS.find(s => s.number === num)?.name || num});
    updateAtSummary(cid);
    return;
  }

  // 출결: 사유 변경
  if(e.target.closest('[data-action=at-reason]')){
    const el = e.target.closest('[data-action=at-reason]');
    const num = el.dataset.num, reason = el.dataset.reason;
    const cid = TC_CLS?.id; if(!cid) return;
    el.disabled = true;
    const status = ATTENDANCE[num]?.status || '지각';
    await saveAttendance(cid, AT_DATE, num, status, reason);
    const row = document.getElementById('atr-' + num);
    if(row) row.outerHTML = buildAtRow({number: num, name: STUDENTS.find(s => s.number === num)?.name || num});
    return;
  }

  // 출결: 이전 날
  if(e.target.closest('[data-action=at-prev-day]')){
    const d = new Date(AT_DATE); d.setDate(d.getDate() - 1);
    AT_DATE = d.toISOString().slice(0, 10);
    await loadAttendance(TC_CLS?.id, AT_DATE); render(); return;
  }
  // 출결: 다음 날
  if(e.target.closest('[data-action=at-next-day]')){
    const d = new Date(AT_DATE); d.setDate(d.getDate() + 1);
    AT_DATE = d.toISOString().slice(0, 10);
    await loadAttendance(TC_CLS?.id, AT_DATE); render(); return;
  }
  // 출결: 오늘
  if(e.target.closest('[data-action=at-go-today]')){
    AT_DATE = new Date().toISOString().slice(0, 10);
    await loadAttendance(TC_CLS?.id, AT_DATE); render(); return;
  }
  // 출결: 내보내기
  if(e.target.closest('[data-action=at-export]')){ atExport(); return; }

  // ── 학생 로그인 ──
  if(t.id === 'sl-btn'){
    const num = document.getElementById('sl-num')?.value?.trim();
    const pw = document.getElementById('sl-pw')?.value;
    const err = document.getElementById('sl-err');
    if(!num || !pw){ err.textContent = '학번과 비밀번호를 입력하세요.'; return; }
    t.textContent = '...'; t.disabled = true; err.textContent = '';
    try{
      const s = await db.ref(`students/${SEL_CLS.id}/${num}`).get();
      if(!s.exists()){ err.textContent = '등록되지 않은 학번입니다.'; t.textContent = '로그인'; t.disabled = false; return; }
      const data = s.val();
      const ok = await verifyPassword(pw, data.passwordHash, data.salt);
      if(!ok){ err.textContent = '비밀번호가 틀렸습니다.'; t.textContent = '로그인'; t.disabled = false; return; }
      // salt 없는 기존 계정이면 자동 업그레이드
      if(!data.salt){
        const newSalt = generateSalt();
        const newHash = await hashWithSalt(pw, newSalt);
        await db.ref(`students/${SEL_CLS.id}/${num}`).update({passwordHash: newHash, salt: newSalt});
      }
      ST_USER = {number: num, name: data.name, classId: SEL_CLS.id};
      FORCE_PW = !!data.isFirstLogin;
      await loadAllClassData(SEL_CLS.id);
      for(const a of ASSIGNMENTS) await loadSubmissions(SEL_CLS.id, a.id);
      const ym = new Date().toISOString().slice(0, 7);
      await loadAttendanceMonth(SEL_CLS.id, ym);
      if(FORCE_PW) go('change-pw'); else { ST_TAB = 'notice'; go('student'); }
    } catch(err2){ err.textContent = '오류: ' + err2.message; t.textContent = '로그인'; t.disabled = false; }
    return;
  }

  // ── 비밀번호 강제 변경 ──
  if(t.id === 'cp-btn' && VIEW === 'change-pw'){
    const nw = document.getElementById('cp-new')?.value;
    const con = document.getElementById('cp-con')?.value;
    const err = document.getElementById('cp-err');
    if(!nw || nw.length < 4){ err.textContent = '4자 이상 입력하세요.'; return; }
    if(nw !== con){ err.textContent = '비밀번호가 일치하지 않습니다.'; return; }
    t.textContent = '...'; t.disabled = true;
    const salt = generateSalt();
    const h = await hashWithSalt(nw, salt);
    await db.ref(`students/${SEL_CLS.id}/${ST_USER.number}`).update({passwordHash: h, salt, isFirstLogin: false});
    FORCE_PW = false; ST_TAB = 'notice'; go('student'); return;
  }

  // ── 선생님 로그인 ──
  if(t.id === 'tl-btn'){
    const pw = document.getElementById('tl-pw')?.value;
    const err = document.getElementById('tl-err');
    t.textContent = '...'; t.disabled = true; err.textContent = '';
    try{
      if(FIRST_SETUP){
        const pw2 = document.getElementById('tl-pw2')?.value;
        if(!pw || pw.length < 4){ err.textContent = '4자 이상 입력하세요.'; t.textContent = '설정 후 로그인'; t.disabled = false; return; }
        if(pw !== pw2){ err.textContent = '비밀번호가 일치하지 않습니다.'; t.textContent = '설정 후 로그인'; t.disabled = false; return; }
        const salt = generateSalt();
        await db.ref('auth/teacher').set({h: await hashWithSalt(pw, salt), salt}); FIRST_SETUP = false;
      } else {
        const auth = await getAuth();
        const ok = await verifyPassword(pw, auth?.h, auth?.salt);
        if(!auth || !ok){ err.textContent = '비밀번호가 틀렸습니다.'; t.textContent = '로그인'; t.disabled = false; return; }
        // salt 없는 기존 계정이면 자동 업그레이드
        if(!auth.salt){
          const newSalt = generateSalt();
          await db.ref('auth/teacher').set({h: await hashWithSalt(pw, newSalt), salt: newSalt});
        }
      }
      IS_TC = true; TC_TAB = 'notice'; TC_CLS = null; VIEW = 'teacher'; render();
    } catch(err2){ err.textContent = '오류: ' + err2.message; t.textContent = '로그인'; t.disabled = false; }
    return;
  }

  // ── 게시물 비밀번호 확인 ──
  if(t.id === 'pd-ok'){
    const pw = document.getElementById('pd-pw')?.value;
    const err = document.getElementById('pd-err');
    if(!pw){ err.textContent = '비밀번호를 입력하세요.'; return; }
    t.textContent = '...'; t.disabled = true;
    const ok = await verifyPassword(pw, SEL_POST?.passwordHash, SEL_POST?.salt);
    if(ok){ POST_UNLOCKED = true; render(); }
    else { err.textContent = '비밀번호가 틀렸습니다.'; t.textContent = '확인'; t.disabled = false; }
    return;
  }

  // ── 게시물 비밀번호 초기화 (선생님) ──
  if(t.id === 'reset-btn'){
    const input = document.getElementById('reset-pw');
    const newPw = input?.value || '0000';
    const msg = document.getElementById('reset-msg');
    const cid = TC_CLS?.id || SEL_CLS?.id; if(!cid) return;
    t.disabled = true;
    const salt = generateSalt();
    const h = await hashWithSalt(newPw, salt);
    await db.ref(`posts/${cid}/${SEL_POST.id}`).update({passwordHash: h, salt});
    SEL_POST.passwordHash = h; SEL_POST.salt = salt;
    const label = input?.value ? `"${input.value}"` : '0000';
    msg.style.color = 'var(--ok)'; msg.textContent = `✓ 비밀번호가 ${label}(으)로 초기화됐습니다.`;
    if(input) input.value = '';
    t.disabled = false; return;
  }

  // ── 공지 등록/수정 (선생님) ──
  if(t.id === 'nc-submit'){
    const title = document.getElementById('nc-title')?.value?.trim();
    const content = document.getElementById('nc-content')?.value?.trim();
    const isPinned = document.getElementById('nc-pin')?.checked || false;
    const file = document.getElementById('nc-file')?.files[0];
    const err = document.getElementById('nc-err');
    const cid = TC_CLS?.id; if(!cid) return;
    if(!title){ err.textContent = '제목을 입력하세요.'; return; }
    t.disabled = true; err.textContent = '';
    try{
      const editId = t.dataset.editId;
      if(editId){
        const existing = NOTICES.find(n => n.id === editId);
        const updates = {title, content: content || '', isPinned};
        if(file){
          if(file.size > 50*1024*1024){ err.textContent = '50MB 이하 파일만 가능합니다.'; t.disabled = false; return; }
          document.getElementById('nc-prog').style.display = 'block';
          if(existing?.filePath) await storage.ref(existing.filePath).delete().catch(() => {});
          const path = `notices/${cid}/${editId}/${file.name}`;
          const url = await uploadFile(file, path, document.getElementById('nc-pfill'), document.getElementById('nc-pct'));
          updates.fileName = file.name; updates.fileUrl = url; updates.filePath = path;
        }
        await db.ref(`notices/${cid}/${editId}`).update(updates);
        window._ncEditId = null;
      } else {
        const id = genId(); let fileData = {};
        if(file){
          if(file.size > 50*1024*1024){ err.textContent = '50MB 이하 파일만 가능합니다.'; t.disabled = false; return; }
          document.getElementById('nc-prog').style.display = 'block';
          const path = `notices/${cid}/${id}/${file.name}`;
          const url = await uploadFile(file, path, document.getElementById('nc-pfill'), document.getElementById('nc-pct'));
          fileData = {fileName: file.name, fileUrl: url, filePath: path};
        }
        await db.ref(`notices/${cid}/${id}`).set({title, content: content || '', isPinned, createdAt: new Date().toISOString(), ...fileData});
      }
      await loadNotices(cid); render();
    } catch(err2){ err.textContent = '오류: ' + err2.message; t.disabled = false; }
    return;
  }

  // ── 과제 등록/수정 (선생님) ──
  if(t.id === 'ac-submit'){
    const title = document.getElementById('ac-title')?.value?.trim();
    const desc = document.getElementById('ac-desc')?.value?.trim();
    const due = document.getElementById('ac-due')?.value;
    const file = document.getElementById('ac-file')?.files[0];
    const err = document.getElementById('ac-err');
    const cid = TC_CLS?.id; if(!cid) return;
    if(!title){ err.textContent = '과제 제목을 입력하세요.'; return; }
    t.disabled = true; err.textContent = '';
    try{
      const editId = t.dataset.editId;
      if(editId){
        const existing = ASSIGNMENTS.find(a => a.id === editId);
        const updates = {title, description: desc || '', dueDate: due || null};
        if(file){
          if(file.size > 50*1024*1024){ err.textContent = '50MB 이하 파일만 가능합니다.'; t.disabled = false; return; }
          document.getElementById('ac-prog').style.display = 'block';
          if(existing?.filePath) await storage.ref(existing.filePath).delete().catch(() => {});
          const path = `assignments/${cid}/${editId}/${file.name}`;
          const url = await uploadFile(file, path, document.getElementById('ac-pfill'), document.getElementById('ac-pct'));
          updates.fileName = file.name; updates.fileUrl = url; updates.filePath = path;
        }
        await db.ref(`assignments/${cid}/${editId}`).update(updates);
        window._acEditId = null;
      } else {
        const id = genId(); let fileData = {};
        if(file){
          if(file.size > 50*1024*1024){ err.textContent = '50MB 이하 파일만 가능합니다.'; t.disabled = false; return; }
          document.getElementById('ac-prog').style.display = 'block';
          const path = `assignments/${cid}/${id}/${file.name}`;
          const url = await uploadFile(file, path, document.getElementById('ac-pfill'), document.getElementById('ac-pct'));
          fileData = {fileName: file.name, fileUrl: url, filePath: path};
        }
        await db.ref(`assignments/${cid}/${id}`).set({
          title, description: desc || '', dueDate: due || null,
          createdAt: new Date().toISOString(), ...fileData
        });
      }
      await loadAssignments(cid); render();
    } catch(err2){ err.textContent = '오류: ' + err2.message; t.disabled = false; }
    return;
  }

  // ── 새 게시물 제출 (학생) ──
  if(t.id === 'np-submit'){
    const title = document.getElementById('np-title')?.value?.trim();
    const pw = document.getElementById('np-pw')?.value?.trim();
    const memo = document.getElementById('np-memo')?.value?.trim();
    const file = document.getElementById('np-file')?.files[0];
    const err = document.getElementById('np-err');
    const cid = SEL_CLS?.id; if(!cid) return;
    if(!title){ err.textContent = '제목을 입력하세요.'; return; }
    if(!pw){ err.textContent = '비밀번호를 설정하세요.'; return; }
    if(!file){ err.textContent = '파일을 선택하세요.'; return; }
    if(file.size > 50*1024*1024){ err.textContent = '50MB 이하 파일만 가능합니다.'; return; }
    t.disabled = true; document.getElementById('np-prog').style.display = 'block'; err.textContent = '';
    try{
      const salt = generateSalt();
      const passwordHash = await hashWithSalt(pw, salt);
      const id = genId();
      const path = `posts/${cid}/${id}/${file.name}`;
      const url = await uploadFile(file, path, document.getElementById('np-pfill'), document.getElementById('np-pct'));
      await db.ref(`posts/${cid}/${id}`).set({
        title, authorName: ST_USER?.name || '익명', authorId: ST_USER?.number || '',
        fileName: file.name, fileSize: file.size, uploadedAt: new Date().toISOString(),
        passwordHash, salt, storagePath: path, url, memo: memo || ''
      });
      await loadPosts(cid);
      document.getElementById('np-form').innerHTML = `<div class="success-pg">
        <div class="ico">✅</div>
        <div class="t">게시물이 등록됐습니다!</div>
        <div class="s">비밀번호를 아는 사람만 파일을 다운로드할 수 있습니다.</div>
        <button onclick="ST_TAB='board';go('student')" style="margin-top:14px" class="btn-p btn-sm">← 게시판으로</button>
      </div>`;
    } catch(err2){ err.textContent = '업로드 실패: ' + err2.message; document.getElementById('np-prog').style.display = 'none'; t.disabled = false; }
    return;
  }

  // ── 과제 제출/재제출 (학생) ──
  if(t.id === 'sf-submit'){
    const file = document.getElementById('sf-file')?.files[0];
    const memo = document.getElementById('sf-memo')?.value?.trim();
    const err = document.getElementById('sf-err');
    const cid = SEL_CLS?.id; if(!cid || !SEL_ASSIGN || !ST_USER) return;
    if(!file){ err.textContent = '파일을 선택하세요.'; return; }
    if(file.size > 50*1024*1024){ err.textContent = '50MB 이하 파일만 가능합니다.'; return; }
    t.disabled = true; document.getElementById('sf-prog').style.display = 'block'; err.textContent = '';
    try{
      const existing = SUBMISSIONS[SEL_ASSIGN.id]?.[ST_USER.number];
      const resubCount = (existing?.resubCount || 0) + (existing ? 1 : 0);
      if(existing?.storagePath) await storage.ref(existing.storagePath).delete().catch(() => {});
      const id = genId();
      const path = `submissions/${cid}/${SEL_ASSIGN.id}/${ST_USER.number}/${file.name}`;
      const url = await uploadFile(file, path, document.getElementById('sf-pfill'), document.getElementById('sf-pct'));
      await db.ref(`submissions/${cid}/${SEL_ASSIGN.id}/${ST_USER.number}`).set({
        studentName: ST_USER.name, studentNumber: ST_USER.number,
        fileName: file.name, fileSize: file.size,
        uploadedAt: new Date().toISOString(), storagePath: path, url,
        memo: memo || '', resubCount
      });
      await loadSubmissions(cid, SEL_ASSIGN.id);
      go('assign-detail', {assign: SEL_ASSIGN});
    } catch(err2){ err.textContent = '업로드 실패: ' + err2.message; document.getElementById('sf-prog').style.display = 'none'; t.disabled = false; }
    return;
  }

  // ── 학생 추가 ──
  if(t.id === 'sa-btn'){
    const num = document.getElementById('st-num')?.value?.trim();
    const name = document.getElementById('st-name')?.value?.trim();
    const err = document.getElementById('sa-err');
    const cid = TC_CLS?.id; if(!cid) return;
    if(!num || !name){ err.textContent = '학번과 이름을 입력하세요.'; return; }
    t.disabled = true;
    const salt = generateSalt();
    const h = await hashWithSalt(num, salt);
    await db.ref(`students/${cid}/${num}`).set({name, passwordHash: h, salt, isFirstLogin: true, createdAt: new Date().toISOString()});
    await loadStudents(cid);
    document.getElementById('st-num').value = '';
    document.getElementById('st-name').value = '';
    err.style.color = 'var(--ok)'; err.textContent = `✓ ${name}(${num}) 추가됐습니다.`;
    t.disabled = false; return;
  }

  // ── 학생 일괄 추가 ──
  if(t.id === 'bulk-btn'){
    const raw = document.getElementById('bulk-input')?.value || '';
    const err = document.getElementById('bulk-err');
    const cid = TC_CLS?.id; if(!cid) return;
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    if(!lines.length){ err.textContent = '내용을 입력하세요.'; return; }
    t.disabled = true; err.textContent = '처리 중...';
    let ok = 0, fail = 0;
    for(const line of lines){
      const parts = line.split(',').map(s => s.trim());
      if(parts.length < 2){ fail++; continue; }
      const [num, name] = parts;
      if(!num || !name){ fail++; continue; }
      const salt = generateSalt();
      const h = await hashWithSalt(num, salt);
      await db.ref(`students/${cid}/${num}`).set({name, passwordHash: h, salt, isFirstLogin: true, createdAt: new Date().toISOString()});
      ok++;
    }
    await loadStudents(cid);
    err.style.color = 'var(--ok)'; err.textContent = `✓ ${ok}명 추가 완료${fail ? `, ${fail}개 실패` : ''}`;
    document.getElementById('bulk-input').value = '';
    t.disabled = false; return;
  }

  // ── 파일 공유 (선생님) ──
  if(t.id === 'tf-upload'){
    const files = Array.from(document.getElementById('tf-file')?.files || []);
    const title = document.getElementById('tf-title')?.value?.trim() || '';
    const desc = document.getElementById('tf-desc')?.value?.trim() || '';
    const errEl = document.getElementById('tf-err');
    const cid = TC_CLS?.id; if(!cid) return;
    if(!files.length){ errEl.textContent = '파일을 선택하세요.'; return; }
    const oversized = files.find(f => f.size > 50*1024*1024);
    if(oversized){ errEl.textContent = `"${oversized.name}" 파일이 50MB를 초과합니다.`; return; }
    t.disabled = true; document.getElementById('tf-prog').style.display = 'block'; errEl.textContent = '';
    const groupId = genId();
    const now = new Date().toISOString();
    try{
      for(let i = 0; i < files.length; i++){
        const file = files[i];
        const id = genId();
        const path = `teacherFiles/${cid}/${id}/${file.name}`;
        const pct = Math.round(i / files.length * 100);
        document.getElementById('tf-pfill').style.width = pct + '%';
        document.getElementById('tf-pct').textContent = pct + '%';
        document.getElementById('tf-cur').textContent = `(${i+1}/${files.length}) ${file.name}`;
        const url = await uploadFile(file, path, null, null);
        document.getElementById('tf-pfill').style.width = Math.round((i+1) / files.length * 100) + '%';
        await db.ref(`teacherFiles/${cid}/${id}`).set({
          name: file.name, size: file.size, uploadedAt: now,
          storagePath: path, url,
          groupId, groupTitle: title, groupDesc: desc
        });
      }
      await loadTcFiles(cid); render();
    } catch(err2){ errEl.textContent = '실패: ' + err2.message; document.getElementById('tf-prog').style.display = 'none'; t.disabled = false; }
    return;
  }

  // ── 선생님 비밀번호 변경 ──
  if(t.id === 'cp-btn' && TC_TAB === 'settings'){
    const cur = document.getElementById('cp-cur')?.value;
    const nw = document.getElementById('cp-new')?.value;
    const con = document.getElementById('cp-con')?.value;
    const msg = document.getElementById('cp-msg');
    const setM = (txt, ok) => { msg.style.color = ok ? 'var(--ok)' : 'var(--danger)'; msg.textContent = txt; };
    if(!cur || !nw || !con){ setM('모두 입력해주세요.', false); return; }
    if(nw !== con){ setM('새 비밀번호가 일치하지 않습니다.', false); return; }
    if(nw.length < 4){ setM('4자 이상 입력하세요.', false); return; }
    const auth = await getAuth();
    const curOk = await verifyPassword(cur, auth?.h, auth?.salt);
    if(!auth || !curOk){ setM('현재 비밀번호가 틀렸습니다.', false); return; }
    const newSalt = generateSalt();
    await db.ref('auth/teacher').set({h: await hashWithSalt(nw, newSalt), salt: newSalt});
    setM('✓ 비밀번호가 변경됐습니다.', true);
    ['cp-cur','cp-new','cp-con'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    return;
  }
});
