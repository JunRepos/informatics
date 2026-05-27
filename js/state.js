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
let CR_CT          = { blanks:{}, run:null, test:null, running:false, stdin:'' }; // 학생: 코드완성(codetest) 풀이 상태

// 📝 수행평가 (Assessment) — PET병 챌린지 2단계 (정의는 assessment-data.js ASMT_DEF)
let ASMT_ACTIVE   = {};        // { [classId]: bool } — 학생 탭 노출용 캐시
// 학생 측
let ASMT_VIEW     = 'exam';    // 학생: 'closed'|'exam'|'done'
let ASMT_STAGE    = 1;         // 학생 현재 단계 1|2 (2로 가면 1 잠금)
let ASMT_SUB      = null;      // 학생 본인 제출 { stage, a[], b{}, blanks{}, submittedAt }
let ASMT_ANS      = { a: '', b: {}, blanks: {} }; // 작성 중 답안 (a: 서술 텍스트, blanks: { bid:{v, gaveUp} })
let ASMT_RUN      = null;      // 자유 실행 결과 { success, output, error }
let ASMT_RUNNING  = false;     // 실행/테스트 진행 중
let ASMT_TEST     = null;      // 테스트 결과 [{ input, expected, output, pass, error }]
// 선생님 측
let ASMT_TC_VIEW  = 'manage';  // 선생님: 'manage'|'student'
let ASMT_ALL_SUBS = {};        // { [학번]: submission }
let ASMT_ALL_SCORES = {};      // { [학번]: { a,b,c,d, comment, scoredAt } }
let ASMT_TC_SEL_SNUM = null;   // 선생님: 보고 있는 학생 학번

// 📖 수행평가 안내(연습) — 정의는 assessment-data.js ASMT_GUIDE_DEF. 제출·채점 없음(로컬 연습).
let AG_ACTIVE  = {};           // { [classId]: bool } — 선생님이 켜야 학생 안내 탭 노출
let AG_STAGE   = 1;
let AG_ANS     = { a: '', b: {}, blanks: {} };
let AG_RUN     = null;
let AG_TEST    = null;
let AG_RUNNING = false;
let AG_STDIN   = '';

// 채점 항목 (PDF 배점) — 선생님 수동 입력
const ASMT_RUBRIC = [
  { id: 'a', label: 'A. 문제 분석·추상화', max: 5 },
  { id: 'b', label: 'B. 자료형 확인', max: 5 },
  { id: 'c', label: 'C. 코드 구현(빈칸)', max: 12 },
  { id: 'd', label: 'D. 입력값별 출력', max: 3 },
];

// 🏆 점수 관리 (선생님) — 빅데이터/PET병/AI 통합 점수표
let SC_TC_ASMT       = 'bigdata';   // 현재 선택된 수행평가 탭 ('bigdata'|'petbottle'|'aicode'|'overview')
let SC_PUBLISHED     = {};          // { [cid]: { bigdata:bool, petbottle:bool, aicode:bool } } 캐시 — 점수 공개
let SC_REASONS_PUB   = {};          // { [cid]: { bigdata:bool, petbottle:bool, aicode:bool } } 캐시 — 영역별 사유 공개
let SC_BIGDATA_SCORES = {};         // { [학번]: { prob,data,viz,insight, reasons:{key:str}, comment, scoredAt } } — 현재 반의 빅데이터 점수
let SC_AICODE_SCORES  = {};         // { [학번]: {...} } — AI 점수 (구체화 시)
let SC_SAVING_SNUM    = null;       // 저장 중인 학번 (UI 잠금용)
let SC_EXPAND_SNUM    = null;       // 사유 입력 행 펼침 학번 (null=모두 접힘, 한 번에 하나만)
let SC_EXPAND_ASMT    = null;       // 펼친 수행평가 ID (탭 바뀌면 자연스레 접힘)

// 📊 학생: 내 수행평가 점수
let MY_SCORES        = null;        // { bigdata:..., petbottle:..., aicode:... } — 본인 점수 모음 (null=아직 로드 안 함)
let MY_SCORES_PUB    = null;        // { bigdata:bool, petbottle:bool, aicode:bool } — 점수 공개 상태
let MY_REASONS_PUB   = null;        // { bigdata:bool, petbottle:bool, aicode:bool } — 영역별 사유 공개 상태

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
