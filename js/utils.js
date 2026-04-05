/* ═══════════════════════════════════════
   utils.js — 유틸리티 함수

   날짜 포맷, 파일 크기 표시, 해시 생성 등
   여러 곳에서 재사용하는 헬퍼 함수들입니다.
═══════════════════════════════════════ */

// SHA-256 해시 (비밀번호 암호화용)
async function sha256(s){
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('');
}

// HTML 이스케이프 (XSS 방지)
function esc(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// 파일 크기 표시 (1024 → 1.0 KB)
function fmtSz(b){
  if(!b) return '0 B';
  if(b < 1024) return b + ' B';
  if(b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}

// 날짜+시간 포맷 (4월 3일 오후 2:30)
function fmtDt(iso){
  if(!iso) return '';
  return new Date(iso).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
}

// 날짜만 포맷 (4월 3일)
function fmtDay(iso){
  if(!iso) return '';
  return new Date(iso).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'});
}

// 고유 ID 생성
function genId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// 파일 확장자별 아이콘
function fIcon(name){
  const e = (name||'').split('.').pop().toLowerCase();
  return {
    pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📋',pptx:'📋',hwp:'📃',
    png:'🖼️',jpg:'🖼️',jpeg:'🖼️',gif:'🖼️',webp:'🖼️',
    zip:'📦',rar:'📦',mp4:'🎬',mp3:'🎵',txt:'📄',csv:'📊'
  }[e] || '📁';
}

// 이미지 파일인지 확인
function isImg(name){
  return /\.(png|jpg|jpeg|gif|webp)$/i.test(name||'');
}

// 파일 다운로드 트리거
function dlFile(name, url){
  const a = document.createElement('a');
  a.href = url; a.download = name; a.target = '_blank';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ID로 반 객체 찾기
function classById(id){
  return CLASSES.find(c => c.id === id) || null;
}

// D-day 칩 표시
function dday(dueDate){
  if(!dueDate) return '';
  const diff = Math.ceil((new Date(dueDate) - new Date()) / (1000*60*60*24));
  if(diff < 0)  return `<span class="chip chip-gray">마감</span>`;
  if(diff === 0) return `<span class="chip chip-red">D-day</span>`;
  if(diff <= 3)  return `<span class="chip chip-orange">D-${diff}</span>`;
  return `<span class="chip chip-blue">D-${diff}</span>`;
}

// 마감일 지났는지 확인
function isPastDue(dueDate){
  return dueDate && new Date(dueDate) < new Date();
}
