/* ═══════════════════════════════════════
   config.js — Firebase 설정 & 반 목록

   앱 전체에서 사용하는 설정값을 관리합니다.
   Firebase 프로젝트를 변경하려면 여기만 수정하세요.
═══════════════════════════════════════ */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAnizrBWkqStaoWxIOpd8HFUS_CuqXjw2k",
  authDomain:        "sindong-informatics.firebaseapp.com",
  databaseURL:       "https://sindong-informatics-default-rtdb.firebaseio.com",
  projectId:         "sindong-informatics",
  storageBucket:     "sindong-informatics.firebasestorage.app",
  messagingSenderId: "542931253736",
  appId:             "1:542931253736:web:d83620fe9079c3f0998c5d"
};

// 반 목록 — 반을 추가/제거하려면 여기를 수정
const CLASSES = [
  {id:'c2-1',  label:'2-1반',   emoji:'🏫',type:'normal'},
  {id:'c2-2',  label:'2-2반',   emoji:'🏫',type:'normal'},
  {id:'c2-3',  label:'2-3반',   emoji:'🏫',type:'normal'},
  {id:'c2-4',  label:'2-4반',   emoji:'🏫',type:'normal'},
  {id:'c2-5',  label:'2-5반',   emoji:'🏫',type:'normal'},
  {id:'c2-6',  label:'2-6반',   emoji:'🏫',type:'normal'},
  {id:'info-2A',label:'정보 2-A',emoji:'💻',type:'info'},
  {id:'info-2B',label:'정보 2-B',emoji:'💻',type:'info'},
];

const KNOWN_CLS = new Set(CLASSES.map(c=>c.id));
