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
