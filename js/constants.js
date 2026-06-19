/* ═══════════════════════════════════════
   constants.js — 앱 전체 상수

   매직 넘버와 반복되는 문자열을 한 곳에서 관리합니다.
   값을 바꿀 때 여기만 수정하면 됩니다.
═══════════════════════════════════════ */

const MAX_FILE_SIZE    = 50 * 1024 * 1024; // 50MB
const MAX_TITLE_LEN    = 200;
const MAX_CONTENT_LEN  = 5000;
const MAX_MEMO_LEN     = 1000;
const MAX_NAME_LEN     = 50;

const AT_STATUS = {
  OK:   '출석',
  LATE: '지각',
  ABS:  '결석',
};

const AT_REASONS = ['질병', '인정', '미인정'];

// 수업 단원 (정보 교과) — 학생 사이드바 '수업' 그룹 + 선생님 수업 등록 시 분류용
// 키는 DB의 assignments/{}/unit 에 저장. 로마자 번호는 메뉴/칩 표기에 사용.
const ASSIGN_UNITS = [
  { key: 'computing',   roman: 'Ⅰ', label: '컴퓨팅 시스템' },
  { key: 'bigdata',     roman: 'Ⅱ', label: '빅데이터' },
  { key: 'programming', roman: 'Ⅲ', label: '프로그래밍' },
  { key: 'ai',          roman: 'Ⅳ', label: '인공지능' },
];
const ASSIGN_UNIT_MAP = Object.fromEntries(ASSIGN_UNITS.map(u => [u.key, u]));
