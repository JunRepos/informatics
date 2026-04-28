/* ═══════════════════════════════════════
   firebase.js — Firebase 초기화 & DB 헬퍼

   Firebase 연결과 데이터 CRUD 함수들입니다.
   새로운 데이터 종류를 추가할 때 여기에 load/save 함수를 만드세요.
═══════════════════════════════════════ */

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();
const storage = firebase.storage();

// ── 네트워크 상태 감지 ──
let IS_ONLINE = navigator.onLine;

window.addEventListener('online', () => {
  IS_ONLINE = true;
  toast('네트워크가 복구됐습니다.', 'ok');
});
window.addEventListener('offline', () => {
  IS_ONLINE = false;
  toast('네트워크 연결이 끊겼습니다. 일부 기능이 제한됩니다.', 'err');
});

// Firebase 연결 상태 감지 (초기 로드 시 false가 잠깐 나오므로 3초 후부터 감지)
let _fbConnReady = false;
setTimeout(() => { _fbConnReady = true; }, 3000);
db.ref('.info/connected').on('value', snap => {
  if(_fbConnReady && snap.val() === false && IS_ONLINE){
    toast('서버 연결이 불안정합니다.', 'err');
  }
});

// 현재 활성 반 ID
const CID = () => (IS_TC ? TC_CLS : SEL_CLS)?.id;

// 선생님 인증 정보 가져오기
async function getAuth(){
  const s = await db.ref('auth/teacher').get();
  return s.exists() ? s.val() : null;
}

// ── 게시물 개수 (홈 화면용) ──
async function loadPostCounts(){
  const s = await db.ref('posts').get();
  CLASSES.forEach(c => { POST_COUNTS[c.id] = 0; });
  if(!s.exists()) return;
  Object.entries(s.val()).forEach(([k, v]) => {
    if(KNOWN_CLS.has(k) && typeof v === 'object')
      POST_COUNTS[k] = Object.keys(v).length;
  });
}

// ── 공지사항 ──
async function loadNotices(cid){
  const s = await db.ref(`notices/${cid}`).get();
  if(!s.exists()){ NOTICES = []; return; }
  NOTICES = Object.entries(s.val()).map(([id, v]) => ({id, ...v}))
    .sort((a, b) => {
      if(a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

// ── 과제 ──
async function loadAssignments(cid){
  const s = await db.ref(`assignments/${cid}`).get();
  if(!s.exists()){ ASSIGNMENTS = []; return; }
  ASSIGNMENTS = Object.entries(s.val()).map(([id, v]) => ({id, ...v}))
    .sort((a, b) => a.dueDate && b.dueDate
      ? a.dueDate.localeCompare(b.dueDate)
      : b.createdAt.localeCompare(a.createdAt));
}

// ── 게시판 글 ──
async function loadPosts(cid){
  const s = await db.ref(`posts/${cid}`).get();
  if(!s.exists()){ POSTS = []; return; }
  POSTS = Object.entries(s.val()).map(([id, v]) => ({id, ...v}))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

// ── 선생님 공유 파일 ──
async function loadTcFiles(cid){
  const s = await db.ref(`teacherFiles/${cid}`).get();
  if(!s.exists()){ TC_FILES = []; return; }
  TC_FILES = Object.entries(s.val()).map(([id, v]) => ({id, ...v}))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

// ── 학생 목록 ──
async function loadStudents(cid){
  const s = await db.ref(`students/${cid}`).get();
  if(!s.exists()){ STUDENTS = []; return; }
  STUDENTS = Object.entries(s.val()).map(([num, v]) => ({number: num, ...v}))
    .sort((a, b) => a.number.localeCompare(b.number));
}

// ── 출결 (특정 날짜) ──
async function loadAttendance(cid, date){
  const s = await db.ref(`attendance/${cid}/${date}`).get();
  ATTENDANCE = s.exists() ? s.val() : {};
}

// ── 출결 (월 단위, 학생 이력용) ──
async function loadAttendanceMonth(cid, ym){
  const s = await db.ref(`attendance/${cid}`).get();
  AT_MONTH_DATA = {};
  if(!s.exists()) return;
  Object.entries(s.val()).forEach(([date, recs]) => {
    if(date.startsWith(ym)) AT_MONTH_DATA[date] = recs;
  });
}

// ── 출결 저장 ──
async function saveAttendance(cid, date, num, status, reason){
  const rec = {status, updatedAt: new Date().toISOString()};
  if(reason) rec.reason = reason; else rec.reason = null;
  await db.ref(`attendance/${cid}/${date}/${num}`).set(rec);
  if(!ATTENDANCE[num]) ATTENDANCE[num] = {};
  ATTENDANCE[num] = rec;
}

// ── 과제 제출 현황 ──
async function loadSubmissions(cid, aid){
  const s = await db.ref(`submissions/${cid}/${aid}`).get();
  SUBMISSIONS[aid] = s.exists() ? s.val() : {};
}

// ── OJ 문제 목록 ──
async function loadOJProblems(cid){
  const s = await db.ref(`problems/${cid}`).get();
  if(!s.exists()){ OJ_PROBLEMS = []; return; }
  OJ_PROBLEMS = Object.entries(s.val()).map(([id, v]) => {
    const tcs = v.testCases ? Object.entries(v.testCases).map(([tid, tc]) => ({id: tid, ...tc}))
      .sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
    return {id, ...v, testCases: tcs};
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── OJ 제출 현황 ──
async function loadOJSubmissions(cid, pid){
  const s = await db.ref(`ojSubmissions/${cid}/${pid}`).get();
  OJ_SUBMISSIONS[pid] = s.exists() ? s.val() : {};
}

// ── OJ 작성 중 코드 자동 저장 (학생) ──
async function loadOJDraft(cid, pid, studentNum){
  const s = await db.ref(`ojDrafts/${cid}/${pid}/${studentNum}`).get();
  return s.exists() ? s.val() : null;  // {code, updatedAt}
}

async function saveOJDraft(cid, pid, studentNum, code){
  await db.ref(`ojDrafts/${cid}/${pid}/${studentNum}`).set({
    code: code || '',
    updatedAt: new Date().toISOString()
  });
}

// ── 노트북 목록 ──
async function loadNotebooks(cid){
  const s = await db.ref(`notebooks/${cid}`).get();
  if(!s.exists()){ NOTEBOOKS = []; return; }
  NOTEBOOKS = Object.entries(s.val()).map(([id, v]) => ({id, ...v}))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

// ── 노트북 학생 진행 상황 (셀 편집/추가/삭제) ──
async function loadNotebookProgress(cid, nbId, studentNum){
  const s = await db.ref(`notebookProgress/${cid}/${nbId}/${studentNum}`).get();
  return s.exists() ? s.val() : null;
}

async function saveNotebookProgress(cid, nbId, studentNum, cells){
  // cells 배열을 그대로 저장 (source/type/id만 포함)
  const sanitized = (cells || []).map(c => ({
    id: c.id || '',
    type: c.type || 'code',
    source: c.source || ''
  }));
  await db.ref(`notebookProgress/${cid}/${nbId}/${studentNum}`).set({
    cells: sanitized,
    updatedAt: new Date().toISOString()
  });
}

async function deleteNotebookProgress(cid, nbId, studentNum){
  await db.ref(`notebookProgress/${cid}/${nbId}/${studentNum}`).remove();
}

// 노트북 전체 학생 진도 로드 (선생님용)
async function loadAllNotebookProgress(cid, nbId){
  const s = await db.ref(`notebookProgress/${cid}/${nbId}`).get();
  return s.exists() ? s.val() : {};
}

// ── 미션 (게임 실습) ──
async function loadMissions(cid){
  const s = await db.ref(`missions/${cid}`).get();
  if(!s.exists()){ MISSIONS = []; return; }
  MISSIONS = Object.entries(s.val()).map(([id, v]) => ({id, ...v}))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

async function saveMission(cid, missionId, data){
  await db.ref(`missions/${cid}/${missionId}`).set(data);
}

async function deleteMission(cid, missionId){
  await db.ref(`missions/${cid}/${missionId}`).remove();
  await db.ref(`missionProgress/${cid}/${missionId}`).remove().catch(() => {});
}

async function loadMissionProgress(cid, mid, studentNum){
  const s = await db.ref(`missionProgress/${cid}/${mid}/${studentNum}`).get();
  return s.exists() ? s.val() : null;
}

async function saveMissionProgress(cid, mid, studentNum, stepPass){
  await db.ref(`missionProgress/${cid}/${mid}/${studentNum}`).set({
    stepPass, updatedAt: new Date().toISOString()
  });
}

// ── 진도 계획 (선생님 전용, 전역 하나) ──
async function loadCurriculum(){
  const s = await db.ref('curriculum/plan').get();
  CURRICULUM = s.exists() ? s.val() : null;
  // sessions는 Firebase에서 객체로 올 수 있으니 배열로 정규화
  if(CURRICULUM?.sessions){
    for(const cid of Object.keys(CURRICULUM.sessions)){
      const v = CURRICULUM.sessions[cid];
      if(v && !Array.isArray(v)) CURRICULUM.sessions[cid] = Object.values(v);
    }
  }
  if(CURRICULUM?.topics && !Array.isArray(CURRICULUM.topics)){
    CURRICULUM.topics = Object.values(CURRICULUM.topics);
  }
}

async function saveCurriculum(data){
  await db.ref('curriculum/plan').set({
    ...data,
    updatedAt: new Date().toISOString()
  });
}

// ── 반 전체 데이터 로드 ──
async function loadAllClassData(cid){
  await Promise.all([
    loadNotices(cid),
    loadAssignments(cid),
    loadPosts(cid),
    loadTcFiles(cid),
    loadStudents(cid),
    loadOJProblems(cid),
    loadNotebooks(cid),
    loadMissions(cid)
  ]);
}

// ── 레거시 게시물 (이전 버전 호환) ──
async function loadLegacyPosts(){
  const s = await db.ref('posts').get();
  if(!s.exists()) return [];
  const val = s.val(), out = [];
  Object.entries(val).forEach(([k, v]) => {
    if(!KNOWN_CLS.has(k) && v && 'title' in v) out.push({id: k, ...v});
  });
  return out.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

// ── 파일 업로드 (진행률 표시 지원) ──
async function uploadFile(file, path, progFill, progPct){
  const ref = storage.ref(path);
  const task = ref.put(file);
  await new Promise((res, rej) => task.on('state_changed', snap => {
    const p = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
    if(progFill) progFill.style.width = p + '%';
    if(progPct) progPct.textContent = p + '%';
  }, rej, res));
  return await ref.getDownloadURL();
}
