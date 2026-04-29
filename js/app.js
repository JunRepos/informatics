/* ═══════════════════════════════════════
   app.js — 앱 초기화 & 부가 기능

   앱 시작, ZIP 다운로드, 레거시 복구 등
═══════════════════════════════════════ */

// ── 파일명 헬퍼 ──
// 파일시스템/ZIP에 안전한 이름 (/, \, :, *, ?, ", <, >, | 제거)
function _safeFilename(s){
  return String(s || '').replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || '_';
}
// 확장자 추출 (".py", ".docx", ".tar.gz" 등)
function _fileExt(filename){
  const name = String(filename || '');
  // .tar.gz / .tar.bz2 같은 복합 확장자 우선
  const compound = name.match(/\.(tar\.(gz|bz2|xz))$/i);
  if(compound) return '.' + compound[1];
  const m = name.match(/\.([a-zA-Z0-9]{1,8})$/);
  return m ? '.' + m[1] : '';
}

// ── ZIP 일괄 다운로드 (한 수업의 제출물 전부) ──
//   파일명 규칙
//     · 학생이 1개 파일 제출: 학번_이름_수업제목.확장자
//     · 학생이 N개 파일 제출: 학번_이름_수업제목/원본파일명.확장자  (폴더로)
async function doZipDownload(aid){
  const a = ASSIGNMENTS.find(x => x.id === aid);
  if(!a){ toast('수업을 찾을 수 없습니다.', 'err'); return; }

  const subs = SUBMISSIONS[aid] || {};
  // 다중 파일(files[]) 또는 단일 파일(url) 둘 다 포함
  const submittedEntries = Object.entries(subs).filter(([, v]) =>
    v && (v.url || (Array.isArray(v.files) && v.files.length))
  );
  if(!submittedEntries.length){ toast('제출된 파일이 없습니다.', 'err'); return; }

  const btn = document.getElementById('zip-btn');
  const totalStudents = submittedEntries.length;
  const setBtn = (text, disabled) => { if(btn){ btn.textContent = text; btn.disabled = disabled; } };

  setBtn('📦 압축 준비 중...', true);

  const safeAssignTitle = _safeFilename(a.title || '수업');
  let failedCount = 0;

  try {
    const zip = new JSZip();

    for(let i = 0; i < submittedEntries.length; i++){
      const [num, sub] = submittedEntries[i];
      setBtn(`📦 ${i + 1}/${totalStudents}명 처리 중...`, true);

      const st = STUDENTS.find(s => s.number === num);
      const stName = _safeFilename(st ? st.name : num);
      const studentPrefix = `${_safeFilename(num)}_${stName}`;

      // 파일 목록 정리 (다중/단일 둘 다 처리)
      const files = (Array.isArray(sub.files) && sub.files.length)
        ? sub.files
        : (sub.fileName && sub.url ? [{name: sub.fileName, url: sub.url}] : []);
      if(!files.length) continue;

      if(files.length === 1){
        // 단일 파일: 학번_이름_수업제목.확장자
        const f = files[0];
        const ext = _fileExt(f.name);
        const fname = `${studentPrefix}_${safeAssignTitle}${ext}`;
        try {
          const res = await fetch(f.url);
          if(!res.ok) throw new Error('HTTP ' + res.status);
          zip.file(fname, await res.blob());
        } catch(err){
          console.warn(`[ZIP] ${num} 다운로드 실패:`, err);
          failedCount++;
        }
      } else {
        // 여러 파일: 학번_이름_수업제목/ 폴더 안에 원본 파일명 그대로
        const folder = `${studentPrefix}_${safeAssignTitle}`;
        for(const f of files){
          const safeName = _safeFilename(f.name);
          try {
            const res = await fetch(f.url);
            if(!res.ok) throw new Error('HTTP ' + res.status);
            zip.file(`${folder}/${safeName}`, await res.blob());
          } catch(err){
            console.warn(`[ZIP] ${num}/${f.name} 다운로드 실패:`, err);
            failedCount++;
          }
        }
      }
    }

    setBtn('📦 압축 중...', true);
    const content = await zip.generateAsync({type: 'blob'});
    const url = URL.createObjectURL(content);
    dlFile(`${safeAssignTitle}_제출물.zip`, url);
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    if(failedCount > 0){
      toast(`다운로드 시작 — ${failedCount}개 파일은 실패`, 'err');
    } else {
      toast(`📦 ${totalStudents}명 ${a.title} 제출물 다운로드 시작`, 'ok');
    }
  } catch(err){
    toast('ZIP 다운로드 실패: ' + err.message, 'err');
  }

  setBtn(`📦 일괄 다운로드 (${totalStudents}명)`, false);
}

// ── 레거시 게시물 복구 ──
async function bindMigration(){
  const body = document.getElementById('mig-body');
  if(!body) return;
  body.innerHTML = '<div style="color:var(--text3);font-size:13px">불러오는 중...</div>';
  const legacy = await loadLegacyPosts();
  if(!legacy.length){ body.innerHTML = '<div class="box-ok">복구할 게시물이 없습니다.</div>'; return; }
  const opts = CLASSES.map(c => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
  body.innerHTML = legacy.map(p => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap" data-mpid="${p.id}">
      <div style="font-size:13px;font-weight:600;flex:1;min-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.title)}</div>
      <select class="mig-sel" data-mpid="${p.id}" style="font-size:12px;padding:5px 9px;flex:0 0 auto">${opts}</select>
    </div>`).join('')
    + `<div style="display:flex;gap:8px;margin-top:10px;align-items:center">
        <button id="mig-run" class="btn-ok btn-sm">♻️ 복구 실행 (${legacy.length}개)</button>
        <span id="mig-msg" style="font-size:12px;color:var(--text3)"></span>
      </div>`;

  document.getElementById('mig-run')?.addEventListener('click', async () => {
    const btn = document.getElementById('mig-run'), msg = document.getElementById('mig-msg');
    btn.disabled = true; btn.textContent = '처리 중...';
    let ok = 0;
    for(const p of legacy){
      const sel = document.querySelector(`.mig-sel[data-mpid="${p.id}"]`);
      if(!sel) continue;
      const cid = sel.value;
      try{
        const {id: oldId, ...data} = p;
        await db.ref(`posts/${cid}/${oldId}`).set(data);
        await db.ref(`posts/${oldId}`).remove();
        ok++;
      } catch(e){}
    }
    await loadPostCounts();
    msg.style.color = 'var(--ok)'; msg.textContent = `✓ ${ok}개 이동 완료`;
    btn.textContent = '♻️ 완료';
    setTimeout(() => { setTC('settings'); render(); }, 1500);
  });
}

// ── 앱 시작 ──
async function init(){
  try{
    const auth = await getAuth();
    FIRST_SETUP = !auth;
    await loadPostCounts();

    // 세션 복원 (새로고침 시 로그인 유지)
    if(restoreSession()){
      const cid = SEL_CLS?.id || TC_CLS?.id;
      if(cid){
        await loadAllClassData(cid);
        for(const a of ASSIGNMENTS) await loadSubmissions(cid, a.id);
        if(ST_USER){
          const ym = new Date().toISOString().slice(0, 7);
          await loadAttendanceMonth(cid, ym);
        }
        if(IS_TC && TC_TAB === 'attend') await loadAttendance(cid, AT_DATE);
      }
    }
  } catch(e){ console.error(e); }
  render();
}

init();
