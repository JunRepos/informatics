/* ═══════════════════════════════════════
   app.js — 앱 초기화 & 부가 기능

   앱 시작, ZIP 다운로드, 레거시 복구 등
═══════════════════════════════════════ */

// ── ZIP 다운로드 (과제 제출물) ─��
async function doZipDownload(aid){
  const a = ASSIGNMENTS.find(x => x.id === aid);
  const subs = SUBMISSIONS[aid] || {};
  const entries = Object.entries(subs).filter(([, v]) => v && v.url);
  if(!entries.length){ toast('제출된 파일이 없습니다.', 'err'); return; }

  const btn = document.getElementById('zip-btn');
  if(btn){ btn.textContent = '📦 압축 중...'; btn.disabled = true; }

  try{
    const zip = new JSZip();
    for(const [num, sub] of entries){
      const st = STUDENTS.find(s => s.number === num);
      const stName = st ? st.name : num;
      const fname = `${num}_${stName}_${sub.fileName}`;
      const res = await fetch(sub.url);
      const blob = await res.blob();
      zip.file(fname, blob);
    }
    const content = await zip.generateAsync({type: 'blob'});
    const url = URL.createObjectURL(content);
    dlFile(`${a?.title || 'submissions'}_제출물.zip`, url);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch(err){ toast('ZIP 다운로드 실패: ' + err.message, 'err'); }

  if(btn){ btn.textContent = `📦 ZIP 다운로드 (${entries.length}개)`; btn.disabled = false; }
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
