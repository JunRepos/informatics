/* ═══════════════════════════════════════
   state.js — 전역 상태 변수

   앱의 현재 상태를 추적하는 변수들입니다.
   어떤 화면을 보고 있는지, 누가 로그인했는지 등을
   모든 파일에서 공유합니다.
═══════════════════════════════════════ */

// 현재 화면
let VIEW = 'home';

// 선택된 반 / 선생님 활성 반
let SEL_CLS = null;   // 학생이 선택한 반 객체
let TC_CLS  = null;   // 선생님이 관리중인 반 객체

// 로그인 상태
let IS_TC       = false; // 선생님 로그인 여부
let FIRST_SETUP = false; // 선생님 최초 비밀번호 설정
let ST_USER     = null;  // { number, name, classId } — 로그인한 학생
let FORCE_PW    = false; // 최초 로그인 비밀번호 변경 필요

// 탭 상태
let ST_TAB = 'dashboard'; // 학생 대시보드 현재 탭
let TC_TAB = 'notice'; // 선생님 대시보드 현재 탭

// 데이터 캐시 (Firebase에서 로드한 데이터)
let NOTICES     = [];
let ASSIGNMENTS = [];
let POSTS       = [];
let TC_FILES    = [];
let STUDENTS    = [];
let SUBMISSIONS = {};
let POST_COUNTS = {};

// 상세보기 대상
let SEL_POST    = null;
let SEL_ASSIGN  = null;
let POST_UNLOCKED = false;

// 출결 관련
let ATTENDANCE    = {};    // { [학번]: {status, reason, updatedAt} }
let AT_DATE       = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
let AT_MONTH_DATA = {};    // { [날짜]: { [학번]: record } }

// OJ (Online Judge) 관련
let OJ_PROBLEMS       = [];    // 현재 반의 문제 목록
let OJ_SEL_PROB       = null;  // 선택된 문제 객체
let OJ_CODE           = '';    // 에디터에 작성 중인 코드
let OJ_RUN_RESULTS    = null;  // "코드 실행" 결과 (공개 TC만)
let OJ_SUBMIT_RESULTS = null;  // "제출 후 채점" 결과 (전체 TC)
let OJ_RUNNING        = false; // Pyodide 실행 중 여부
let OJ_SUBMISSIONS    = {};    // { [problemId]: { [studentNum]: submission } }
let OJ_CUSTOM_STDIN   = '';    // 커스텀 입력 텍스트
let OJ_CUSTOM_OUTPUT  = null;  // 커스텀 실행 결과 {output, error, success}
let OJ_RESULT_TAB     = 'exec'; // 결과 탭: 'exec' | 'test'

// ── 세션 저장/복원 (새로고침 시 로그인 유지) ──
function saveSession(){
  const data = { VIEW, IS_TC, ST_USER, FORCE_PW, ST_TAB, TC_TAB, OJ_CODE, OJ_CUSTOM_STDIN };
  if(SEL_CLS) data.SEL_CLS_ID = SEL_CLS.id;
  if(TC_CLS)  data.TC_CLS_ID  = TC_CLS.id;
  sessionStorage.setItem('session', JSON.stringify(data));
}

function clearSession(){
  sessionStorage.removeItem('session');
}

function restoreSession(){
  const raw = sessionStorage.getItem('session');
  if(!raw) return false;
  try {
    const s = JSON.parse(raw);
    VIEW     = s.VIEW     || 'home';
    IS_TC    = s.IS_TC    || false;
    ST_USER  = s.ST_USER  || null;
    FORCE_PW = s.FORCE_PW || false;
    ST_TAB   = s.ST_TAB   || 'dashboard';
    TC_TAB   = s.TC_TAB   || 'notice';
    OJ_CODE  = s.OJ_CODE || '';
    OJ_CUSTOM_STDIN = s.OJ_CUSTOM_STDIN || '';
    if(s.SEL_CLS_ID) SEL_CLS = classById(s.SEL_CLS_ID);
    if(s.TC_CLS_ID)  TC_CLS  = classById(s.TC_CLS_ID);
    return true;
  } catch(e){ return false; }
}
