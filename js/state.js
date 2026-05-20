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

// 수행평가 (Assessment) — AI 기반 코딩 수행평가 (2차시 구성)
// 백엔드: Cloudflare Worker (informatics-ai.chlwns1023.workers.dev) → Gemini API
//
// Phase (반별 단계, 선생님이 제어):
//   'off'  — 비활성 (학생 메뉴 안 보임)
//   'prep' — 1차시: 학생이 AI와 코드 만들고 제출
//   'eval' — 2차시: 학생이 자기 코드로 평가 활동 (줄별 설명 + 변형 과제)
let ASMT_PHASE       = {};     // { [classId]: 'off'|'prep'|'eval' } 캐시
let ASMT_VIEW        = 'entry';// 학생 화면 단계 / 선생님 'manage'|'student'
//   1차시: 'entry'|'examples'|'chat'|'prep-done'
//   2차시: 'explain'|'modify'|'done'
let ASMT_MESSAGES    = [];     // 채팅 메시지 [{role:'user'|'assistant', content, ts}]
let ASMT_CODE        = '';     // 1차시에 학생이 확정한 코드 (AI가 만든 것)
let ASMT_TURN_COUNT  = 0;      // 학생 메시지 누적 (30턴 제한)
let ASMT_LOADING     = false;  // AI 응답 대기 중
let ASMT_PREP_SUBMITTED = false; // 1차시 제출 완료 여부 (학생 본인)
let ASMT_LINE_EXPLAINS = {};   // 줄별 설명 모드에서 { [lineIdx]: explanation }
let ASMT_AUTO_TIMER  = null;   // 진입 화면 3분 자동 인사 타이머 ID
let ASMT_TC_SEL_SNUM = null;   // 선생님이 보고 있는 학생 학번
let ASMT_ALL_SESSIONS = {};    // 선생님: { [studentNum]: session } — 전체 세션 캐시
let ASMT_ALL_SCORES = {};      // 선생님: { [studentNum]: { algo, dataType, io, control, result, comment, scoredAt } }
let ASMT_EXAMPLES_CAT = null;  // 학생: 예시 보기에서 선택한 카테고리 id (null = 카테고리 목록)
let ASMT_SAVE_TIMER = null;    // 세션 저장 debounce 타이머
// 2차시 서술형 5문항 답안 — { purpose, vars, io, control, result }
let ASMT_ANSWERS    = {};      // 각 문항 학생 서술 답
let ASMT_RESULT_STDIN = '';    // ⑤ 결과 문항에서 직접 실행 시 입력값
let ASMT_RUN_RESULT = null;    // 실행 결과 { output, error, success }
let ASMT_RUNNING    = false;   // Pyodide 실행 중
let ASMT_SUBMITTED_AT = null;  // 2차시 제출 완료 시각 (있으면 'done')
const ASMT_TURN_LIMIT = 30;    // 학생당 최대 메시지 수
const ASMT_WORKER_URL = 'https://informatics-ai.chlwns1023.workers.dev';

// 진로 카테고리 8개 + 카테고리별 예시 프로그램 4개씩
// 학생이 "📚 예시 보기" 카드 → 카테고리 선택 → 예시 선택 → 채팅 시작
const ASMT_CATEGORIES = [
  {id:'med', emoji:'🩺', label:'의약·보건', tagline:'의대·치대·약대·간호·수의대',
   examples:[
     '환자 키와 몸무게로 BMI를 계산해서 저체중/정상/과체중/비만을 알려주는 프로그램',
     '수축기/이완기 혈압을 입력받아 정상/주의/고혈압을 판별하는 프로그램',
     '약 복용 시작 시각과 간격(시간)을 입력받아 하루 복용 시각을 모두 출력하는 프로그램',
     '체온을 입력받아 정상/미열/발열로 분류하고 권장 행동을 알려주는 프로그램',
   ]},
  {id:'eng', emoji:'⚙️', label:'공학', tagline:'기계·전기·화공·토목',
   examples:[
     '도로 신호등 — 차량 수에 따라 초록불 시간을 조정하는 프로그램',
     '다리 위 차량들의 무게 합이 한도를 넘는지 점검하는 프로그램',
     '24시간 시각을 입력받아 12시간 + 오전/오후 형식으로 변환하는 프로그램',
     '와이파이 신호 강도(-30 ~ -90 dBm)를 입력받아 신호 단계를 알려주는 프로그램',
   ]},
  {id:'it', emoji:'💻', label:'IT·컴퓨터', tagline:'컴공·AI·게임·보안',
   examples:[
     '비밀번호를 입력받아 길이·숫자 포함·특수문자 포함을 검사해 강도를 알려주는 프로그램',
     'CPU·RAM·SSD 가격을 입력받아 총액을 계산하고 예산 초과 여부를 알려주는 프로그램',
     '가위바위보 — 학생이 입력하면 컴퓨터(랜덤)와 대결하는 프로그램',
     '카운트다운 — 초를 입력받아 1초씩 줄여가며 모든 숫자를 출력하는 프로그램',
   ]},
  {id:'sci', emoji:'🔬', label:'자연과학', tagline:'수학·물리·화학·생물',
   examples:[
     '학생 N명의 시험 점수를 입력받아 평균·최댓값·최솟값을 출력하는 프로그램',
     '양의 정수를 입력받아 소수(prime)인지 판별하는 프로그램',
     '섭씨 온도를 입력받아 화씨·켈빈으로 변환하는 프로그램',
     'pH 값(0~14)을 입력받아 산성/중성/염기성을 분류하는 프로그램',
   ]},
  {id:'biz', emoji:'💼', label:'사회·경영', tagline:'경영·경제·법·심리',
   examples:[
     '상품 단가·수량·할인율을 입력받아 결제 금액을 계산하는 프로그램',
     '원화 금액을 달러/엔/유로 환율로 변환해주는 프로그램',
     '월 적립금과 기간을 입력받아 단리 적금 만기액을 계산하는 프로그램',
     '후보 N명의 득표 수를 입력받아 당선자와 득표율을 출력하는 프로그램',
   ]},
  {id:'hum', emoji:'📚', label:'인문', tagline:'어문학·사학·철학',
   examples:[
     '문장을 입력받아 글자 수와 모음 개수를 세어주는 프로그램',
     '연도를 입력받아 몇 세기인지 알려주는 프로그램 (1592 → 16세기)',
     '단어를 입력받아 거꾸로 읽어도 같은지(회문) 판별하는 프로그램',
     '문장을 입력받아 단어 수를 세는 프로그램 (공백으로 분리)',
   ]},
  {id:'edu', emoji:'🎓', label:'교육', tagline:'사범대·교육학',
   examples:[
     '학생 5명의 점수를 입력받아 A/B/C/D/F 학점 분포를 출력하는 프로그램',
     '출석 일수와 총 수업일 수를 입력받아 출석률(%)을 계산하는 프로그램',
     '학생 N명의 점수를 입력받아 60점 이상 합격자 명단을 출력하는 프로그램',
     '하루 학습 시간(분)을 7일치 입력받아 총 시간·분 형식으로 변환하는 프로그램',
   ]},
  {id:'art', emoji:'🎨', label:'예체능', tagline:'디자인·음악·미술·체육',
   examples:[
     '운동 시간(분)과 강도를 입력받아 소모 칼로리를 계산하는 프로그램',
     'BPM(분당 박자)을 입력받아 한 박자의 길이(밀리초)를 알려주는 프로그램',
     'RGB 값을 입력받아 가장 가까운 기본 색(빨강/초록/파랑)을 알려주는 프로그램',
     '음표 간격(도→솔 = 5도 같은) 두 개를 입력받아 합을 계산하는 프로그램',
   ]},
];

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
