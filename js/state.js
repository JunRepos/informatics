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

// 노트북(Colab 스타일) 관련
let NOTEBOOKS       = [];    // 현재 반의 노트북 목록
let SEL_NOTEBOOK    = null;  // 선택된 노트북 객체
let NB_CELLS        = [];    // 학생 작업용 셀 배열 (SEL_NOTEBOOK.cells 복사본)
let NB_CELL_OUTPUTS = {};    // { [cellId]: {output, error, images, execCount} }
let NB_EXEC_COUNT   = 0;     // 실행 카운터 (전역)
let NB_SELECTED     = null;  // 선택된 셀 id
let NB_EDITING_MD   = null;  // 편집 중인 마크다운 셀 id
let NB_VIEWING_STUDENT = null; // 선생님이 특정 학생 진도 보기 중 (학번)
let NB_PROGRESS_MAP    = {};   // { [학번]: {cells, updatedAt} } — 로드된 학생 진도 캐시
let NB_SHOW_PROGRESS   = false; // 학생 진도 패널 표시 여부
let NB_COLLAPSED_OUTPUTS = {}; // { [cellId]: true } — 출력 접힘 상태
let NB_SIDEBAR_OPEN    = true; // 좌측 사이드바(목차) 열림 여부
let NB_OPEN_MENU       = null; // 현재 열린 메뉴바 메뉴 id ('file'|'edit'|...|null)

// 미션(게임 실습) 관련
let MISSIONS           = [];    // 현재 반의 미션 목록
let SEL_MISSION        = null;  // 선택된 미션
let MISSION_STEP_IDX   = 0;     // 현재 진행 중인 단계 인덱스
let MISSION_STEP_PASS  = {};    // { [stepId]: {passed:true, code:"..."} } — 통과 상태
let MISSION_EDITING    = null;  // 선생님: 편집 중인 미션 (null=신규 또는 수정대상)
let MISSION_VIEW       = 'list'; // 'list' | 'play' | 'edit'
let MISSION_PROGRESS_ALL = null;   // 학생 그리드 카드용: { [missionId]: stepPass } 미리 로드

// 진도 계획
let CURRICULUM = null; // {startDate, endDate, classDays, topics, sessions, updatedAt}
let CUR_VIEW_CLS = 'info-2A';  // 사이드바에서 선택된 반
let CUR_SETTINGS_OPEN = null;  // 학기 설정 펼침 상태 (null=자동)

// 코드 읽기 (Code Reading) — 학생이 코드를 읽고 해석하는 메뉴
let CR_READINGS    = [];     // 현재 반의 코드 읽기 문제 목록
let CR_SEL         = null;   // 선택된 문제 객체
let CR_VIEW        = 'list'; // 'list' | 'solve' | 'edit' (선생님은 'edit' 사용)
let CR_PROGRESS    = {};     // { [readingId]: { [studentNum]: progress } } — 선생님: 모든 학생 / 학생: 본인 것만
let CR_STEP_IDX    = 0;      // 트레이스 문제에서 현재 단계
let CR_ANSWER      = '';     // 학생이 입력 중인 답
let CR_LAST_RESULT = null;   // {pass, correct, given, expected, msg} — 직전 채점 결과
let CR_EDITING     = null;   // 선생님: 편집 중인 문제 (null=신규)
let CR_ANALYZING   = false;  // 선생님: 자동 분석 진행 중 여부
let CR_CLOZE_ANSWERS = null; // 학생: 빈칸 채우기 풀이 중인 답안 배열
let CR_BUG_SEL     = null;   // 학생: 버그 찾기에서 현재 선택한 줄 번호 (1-based)

// 📝 수행평가 (Assessment) — 4파트 시험
//   ① 출력예측(predict) ② 코드해석(explain·서술형) ③ 빈칸(cloze) ④ 구현(implement)
//   predict/cloze/implement 는 Pyodide 자동채점, explain 은 선생님 수동 채점.
//   → 5평가요소(25점) 환산 (예측→결과 / 해석→자료형 / 빈칸→제어 / 구현→추상화+입출력)
let ASMT_EXAM        = null;   // 현재 반 시험: { active, weights, predict[], trace[], cloze[], implement[], updatedAt }
let ASMT_ACTIVE      = {};     // { [classId]: bool } — 학생 탭 노출용 캐시 (exam.active)
let ASMT_VIEW        = 'exam'; // 학생: 'closed'|'exam'|'done' / 선생님: 'manage'|'edit'|'student'
let ASMT_PART        = 'predict'; // 현재 보고 있는 파트 id
let ASMT_ANSWERS     = {};     // 학생 답안: { predict:{qid:str}, explain:{qid:str}, cloze:{qid:[str]}, implement:{qid:code} }
let ASMT_RUN         = {};     // 학생: 구현 파트 qid별 실행 결과 {output,error,success}
let ASMT_RUNNING     = null;   // 실행/채점 중인 qid 또는 'grading' (null=대기)
let ASMT_SUBMITTED_AT= null;   // 학생 제출 시각 (있으면 done)
let ASMT_AUTO        = null;   // 학생 본인 제출의 autoScore (제출 후 표시용)
let ASMT_EDIT        = null;   // 선생님: 편집 중인 시험 객체 (deep clone)
let ASMT_EDIT_PART   = 'predict'; // 선생님 편집 파트 탭
let ASMT_ANALYZING   = null;   // 선생님: 자동 분석 중인 qid (null=대기)
let ASMT_ALL_SUBS    = {};     // 선생님: { [학번]: submission }
let ASMT_ALL_SCORES  = {};     // 선생님: { [학번]: { algo,dataType,io,control,result,comment,scoredAt } }
let ASMT_TC_SEL_SNUM = null;   // 선생님: 보고 있는 학생 학번

// 4파트 메타 (배점 기본값 + 화면 표시)
const ASMT_PARTS = [
  {id:'predict',   icon:'🔮', label:'출력 예측', desc:'코드의 실행 결과(출력)를 예측해 적기 (자동채점)', defW:5},
  {id:'explain',   icon:'📝', label:'코드 해석', desc:'코드의 표시된 부분을 직접 설명 (서술형 · 선생님 채점)', defW:5},
  {id:'cloze',     icon:'🧩', label:'빈칸 채우기', desc:'코드의 빈칸(___)에 들어갈 내용 채우기 (자동채점)', defW:5},
  {id:'implement', icon:'⌨️', label:'코드 구현', desc:'설명을 보고 직접 코드 작성 (테스트 자동 채점)', defW:10},
];
// 채점 평가요소 (계획서 25점) — 4파트에서 환산
const ASMT_RUBRIC = [
  {id:'algo',     label:'알고리즘 표현 — 문제 추상화'},
  {id:'dataType', label:'자료형 활용'},
  {id:'io',       label:'적절한 입출력 형식 활용'},
  {id:'control',  label:'다양한 제어 구조 활용'},
  {id:'result',   label:'다양한 상황에서 올바른 결과'},
];

// 🤖 AI 코딩 (자유 실습 메뉴) — 수행평가와 분리된 독립 기능
// 백엔드: Cloudflare Worker (Gemini). 선생님이 on/off 토글로 노출 제어.
let AIC_ACTIVE       = {};      // { [classId]: bool } 캐시
let AIC_VIEW         = 'entry'; // 학생: 'entry'|'chat' / 선생님: 'manage'|'student'
let AIC_MESSAGES     = [];      // 채팅 메시지 [{role, content, ts}]
let AIC_CODE         = '';      // AI가 만든 현재 코드
let AIC_TURN_COUNT   = 0;       // 학생 메시지 누적
let AIC_LOADING      = false;   // AI 응답 대기 중
let AIC_SAVE_TIMER   = null;    // 세션 저장 debounce
let AIC_RUN_STDIN    = '';      // 코드 실행 입력값
let AIC_RUN_RESULT   = null;    // 코드 실행 결과 {output, error, success}
let AIC_RUNNING      = false;   // Pyodide 실행 중
let AIC_ALL_SESSIONS = {};      // 선생님: { [학번]: session }
let AIC_TC_SEL_SNUM  = null;    // 선생님: 보고 있는 학생 학번
const AIC_TURN_LIMIT = 40;      // 학생당 최대 메시지 수
const AIC_WORKER_URL = 'https://informatics-ai.chlwns1023.workers.dev';

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
