/* ═══════════════════════════════════════
   events/actions.js — data-action 클릭 이벤트

   네비게이션, 다운로드, 삭제 등
   data-action 속성 기반 이벤트 위임 처리
═══════════════════════════════════════ */

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
    catch(err){ toast('다운로드 실패: ' + err.message, 'err'); }
    el.textContent = origText; el.disabled = false; return;
  }

  // 이미지 미리보기
  if(act.action === 'preview-img'){ showImgModal(act.url, act.name); return; }

  // 게시물 파일 다운로드
  if(act.action === 'dl-post-file'){
    el.textContent = '...'; el.disabled = true;
    try{ dlFile(SEL_POST.fileName, SEL_POST.url || await storage.ref(SEL_POST.storagePath).getDownloadURL()); }
    catch(err){ toast('다운로드 실패: ' + err.message, 'err'); }
    el.textContent = '📥 파일 다운로드'; el.disabled = false; return;
  }

  // 과제 첨부파일 다운로드
  if(act.action === 'dl-assign-file'){
    el.textContent = '...'; el.disabled = true;
    try{ dlFile(SEL_ASSIGN.fileName, SEL_ASSIGN.fileUrl); }
    catch(err){ toast('다운로드 실패: ' + err.message, 'err'); }
    el.textContent = '다운로드'; el.disabled = false; return;
  }

  // 제출 파일 다운로드
  if(act.action === 'dl-sub-file' || act.action === 'dl-my-sub'){
    el.textContent = '...'; el.disabled = true;
    try{ dlFile(act.name, act.url); } catch(err){ toast('실패: ' + err.message, 'err'); }
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
    if(!groupFiles.length){ toast('다운로드할 파일이 없습니다.', 'err'); return; }
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
    } catch(err){ toast('ZIP 실패: ' + err.message, 'err'); }
    el.textContent = '📦 전체 다운'; el.disabled = false; return;
  }

  // 전체 선생님 파일 ZIP
  if(act.action === 'dl-all-tc-zip'){
    const allFiles = TC_FILES.filter(f => f.url);
    if(!allFiles.length){ toast('다운로드할 파일이 없습니다.', 'err'); return; }
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
    } catch(err){ toast('ZIP 실패: ' + err.message, 'err'); }
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
  if(act.action === 'del-post'){
    if(!confirm(`"${SEL_POST?.title}" 게시물을 삭제할까요?`)) return;
    const cid = CID(); if(!cid) return;
    if(SEL_POST?.storagePath) await storage.ref(SEL_POST.storagePath).delete().catch(() => {});
    await db.ref(`posts/${cid}/${SEL_POST.id}`).remove();
    await loadPosts(cid);
    SEL_POST = null;
    IS_TC ? go('teacher') : go('student'); return;
  }
});
