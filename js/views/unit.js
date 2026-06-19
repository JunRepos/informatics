/* ═══════════════════════════════════════
   views/unit.js — 단원별 콘텐츠 (수업 자료 / 실습)

   학생: 단원(Ⅰ~Ⅳ) 안에서 수업자료/실습 하위탭으로 선생님이 구성한 항목을 봄.
   선생님: '단원 구성' 탭에서 단원·섹션별로 항목(파일/링크/글)을 추가·관리.
   (Phase A — 파일·링크·글. 앱 연결은 Phase B 예정)
═══════════════════════════════════════ */

// 마크다운 본문 렌더 (marked 있으면 사용, 없으면 줄바꿈만)
function _ucMd(s){
  if(typeof marked !== 'undefined' && marked.parse) return marked.parse(s || '');
  return esc(s || '').replace(/\n/g, '<br>');
}

// 항목의 파일 목록 정규화 (다중 files[] 또는 단일 fileName)
function _ucFiles(it){
  if(it.files && it.files.length) return it.files;
  if(it.fileName) return [{ name: it.fileName, url: it.url, path: it.path }];
  return [];
}

// 앱 연결 종류 메타 (이모지 / 라벨 / 대상 목록 전역)
const UC_APP_META = {
  notebook: { ico: '📓', label: '노트북',  list: () => NOTEBOOKS },
  mission:  { ico: '🎮', label: '미션',    list: () => MISSIONS },
  oj:       { ico: '💻', label: 'OJ 문제', list: () => OJ_PROBLEMS },
  quiz:     { ico: '🧩', label: '퀴즈',    list: () => CR_READINGS },
  aicode:   { ico: '💬', label: 'AI 코딩', list: () => null },
  assign:   { ico: '📝', label: '과제',    list: () => ASSIGNMENTS },
};
// '전체 목록 통째로 연결'(refId='*') 지원 종류 — 목록 화면이 있는 기능
const UC_APP_SCOPE_ALL = ['notebook', 'mission', 'oj', 'quiz'];

// ══════════════════════════════════════
//  학생 뷰
// ══════════════════════════════════════

function vStUnit(unitKey){
  const u = ASSIGN_UNIT_MAP[unitKey];
  if(!u) return emptyBox('📖', '단원을 찾을 수 없습니다.');
  const sec = ST_UNIT_SEC === 'practice' ? 'practice' : 'material';
  const data = UNIT_CONTENT[unitKey] || { material: [], practice: [] };
  const items = data[sec] || [];

  const head = `<div class="sec-title" style="margin-bottom:8px">${u.roman}. ${esc(u.label)}</div>`;
  const bar = _subTabs([
    { key: 'material', label: '📂 수업 자료' },
    { key: 'practice', label: '🧪 실습' },
  ], sec, 'setUnitSec');

  if(!items.length){
    return head + bar + emptyBox(
      sec === 'material' ? '📂' : '🧪',
      sec === 'material' ? '아직 등록된 수업 자료가 없습니다.' : '아직 등록된 실습이 없습니다.'
    );
  }
  return head + bar + items.map(it => _ucStudentCard(it, unitKey)).join('');
}

function setUnitSec(s){ ST_UNIT_SEC = s; render(); }

// 학생용 항목 카드 (유형별)
function _ucStudentCard(it, unitKey){
  if(it.type === 'app'){
    const m = UC_APP_META[it.refType] || { ico: '🔌', label: '앱' };
    const isAll = it.refId === '*';
    const meta = `${it.desc ? esc(it.desc) + ' · ' : ''}${m.label}${isAll ? ' 전체 목록' : ''} 열기 →`;
    return `<div class="list-row click" data-action="uc-open-app" data-reftype="${esc(it.refType || '')}" data-refid="${esc(it.refId || '')}" data-unit="${esc(unitKey || '')}" data-sec="${esc(ST_UNIT_SEC)}">
      <div class="row-icon">${m.ico}</div>
      <div class="row-info">
        <div class="row-title">${esc(it.title)}</div>
        <div class="row-meta">${meta}</div>
      </div>
      <div class="row-right"><span style="color:var(--text3);font-size:15px">→</span></div>
    </div>`;
  }
  if(it.type === 'text'){
    return `<div class="section" style="margin-bottom:10px">
      <div style="font-size:14px;font-weight:700;margin-bottom:6px">📝 ${esc(it.title)}</div>
      <div class="md-body" style="font-size:13px;color:var(--text2);line-height:1.7">${_ucMd(it.body)}</div>
    </div>`;
  }
  if(it.type === 'link'){
    return `<div class="list-row click" data-action="uc-open-link" data-url="${esc(it.url || '')}">
      <div class="row-icon">🔗</div>
      <div class="row-info">
        <div class="row-title">${esc(it.title)}</div>
        <div class="row-meta">${it.desc ? esc(it.desc) + ' · ' : ''}외부 링크 ↗</div>
      </div>
      <div class="row-right"><span style="color:var(--text3);font-size:15px">↗</span></div>
    </div>`;
  }
  // file
  const files = _ucFiles(it);
  const dlBtns = files.map(f =>
    `<button class="btn-xs btn-p" data-action="uc-dl-file" data-url="${esc(f.url)}" data-name="${esc(f.name)}">↓ ${esc(f.name)}</button>`
  ).join(' ');
  return `<div class="list-row">
    <div class="row-icon">${files.length ? fIcon(files[0].name) : '📎'}</div>
    <div class="row-info">
      <div class="row-title">${esc(it.title)}</div>
      <div class="row-meta">${it.desc ? esc(it.desc) : '수업 자료'}</div>
    </div>
    <div class="row-right" style="flex-wrap:wrap;gap:4px">${dlBtns || '<span style="color:var(--text3);font-size:12px">파일 없음</span>'}</div>
  </div>`;
}

// ══════════════════════════════════════
//  선생님 뷰 — 단원 구성
// ══════════════════════════════════════

function vTcUnit(){
  const unit = ASSIGN_UNIT_MAP[UC_TC_UNIT] || ASSIGN_UNITS[0];
  const unitChips = ASSIGN_UNITS.map(u =>
    `<button class="btn-sm ${u.key === UC_TC_UNIT ? 'btn-p' : ''}" data-action="uc-pick-unit" data-unit="${u.key}">${u.roman}. ${esc(u.label)}</button>`
  ).join(' ');
  const secTabs = _subTabs([
    { key: 'material', label: '📂 수업 자료' },
    { key: 'practice', label: '🧪 실습' },
  ], UC_TC_SEC, 'setUcSec');

  const items = ((UNIT_CONTENT[UC_TC_UNIT] || {})[UC_TC_SEC]) || [];
  const list = items.length
    ? items.map((it, i) => _ucTcRow(it, i, items.length)).join('')
    : emptyBox('📭', '이 칸에 항목이 없습니다. 위에서 추가하세요.');

  return `<div class="section">
    <div class="sec-title">📚 단원 구성</div>
    <div class="box-info">학생 사이드바의 단원(Ⅰ~Ⅳ) 안 <b>수업 자료 / 실습</b>에 보일 항목을 구성합니다. 반별로 따로 저장됩니다.</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${unitChips}</div>
    ${secTabs}
  </div>
  ${_ucForm()}
  <div class="sec-title" style="margin-top:4px">${unit.roman}. ${esc(unit.label)} · ${UC_TC_SEC === 'material' ? '수업 자료' : '실습'} 항목 (${items.length})</div>
  ${list}`;
}

function setUcSec(s){ UC_TC_SEC = s; UC_EDIT = null; UC_DRAFT = null; render(); }

// 선생님 항목 행 (편집/삭제/순서)
function _ucTcRow(it, i, n){
  const am = it.type === 'app' ? (UC_APP_META[it.refType] || { ico: '🔌', label: '앱' }) : null;
  const ico = it.type === 'file' ? '📎' : it.type === 'link' ? '🔗' : it.type === 'text' ? '📝' : (am ? am.ico : '🔌');
  const meta = it.type === 'file'
    ? `📎 파일 ${_ucFiles(it).length}개`
    : it.type === 'link'
    ? `🔗 ${esc(it.url || '')}`
    : it.type === 'text'
    ? '📝 글'
    : `🔌 ${am.label} ${it.refId === '*' ? '전체 목록 ' : ''}연결`;
  return `<div class="list-row">
    <div class="row-icon">${ico}</div>
    <div class="row-info">
      <div class="row-title">${esc(it.title)}</div>
      <div class="row-meta" style="word-break:break-all">${meta}</div>
    </div>
    <div class="row-right" style="gap:3px">
      <button class="btn-xs" data-action="uc-move" data-id="${it.id}" data-dir="up" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button class="btn-xs" data-action="uc-move" data-id="${it.id}" data-dir="down" ${i === n - 1 ? 'disabled' : ''}>▼</button>
      <button class="btn-xs" data-action="uc-edit" data-id="${it.id}">✏️</button>
      <button class="btn-xs btn-danger" data-action="uc-del" data-id="${it.id}" data-title="${esc(it.title)}">삭제</button>
    </div>
  </div>`;
}

// 항목 추가/수정 폼
function _ucForm(){
  if(UC_EDIT === null){
    return `<div class="section"><button class="btn-p btn-sm" data-action="uc-new">+ 항목 추가</button></div>`;
  }
  const d = UC_DRAFT || { type: 'file', title: '', desc: '', url: '', body: '' };
  const editing = UC_EDIT !== 'new';
  const typeBtns = [['file', '📎 파일'], ['link', '🔗 링크'], ['text', '📝 글'], ['app', '🔌 앱연결']].map(([k, l]) =>
    `<button class="btn-sm ${d.type === k ? 'btn-p' : ''}" data-action="uc-type" data-type="${k}">${l}</button>`
  ).join(' ');

  let typeFields = '';
  if(d.type === 'file'){
    const cur = (d._files || []);
    typeFields = `${cur.length ? `<div class="box-ok" style="font-size:12px">현재 파일: ${cur.map(f => esc(f.name)).join(', ')} <span style="color:var(--text3)">(새로 선택하면 교체)</span></div>` : ''}
      <div class="field"><label>파일 ${editing ? '(교체 시에만 선택)' : '(여러 개 가능)'}</label><input id="uc-file" type="file" multiple/></div>
      <div class="prog-wrap" id="uc-prog"><div class="prog-label">업로드 중... <span id="uc-pct">0%</span></div><div class="prog-bar"><div class="prog-fill" id="uc-pfill" style="width:0%"></div></div></div>`;
  } else if(d.type === 'link'){
    typeFields = `<div class="field"><label>링크 주소 (URL)</label><input id="uc-url" type="text" placeholder="https://kosis.kr/..." value="${esc(d.url || '')}"/></div>`;
  } else if(d.type === 'text'){
    typeFields = `<div class="field"><label>본문 (마크다운 지원)</label><textarea id="uc-body" style="min-height:150px" placeholder="설명/안내를 적으세요.&#10;&#10;## 활동&#10;1. KOSIS 접속&#10;2. ...">${esc(d.body || '')}</textarea></div>`;
  } else {
    // app — 기존 노트북/미션/OJ/퀴즈/AI코딩/과제 중 골라 연결
    const refType = d.refType || 'notebook';
    const refBtns = Object.entries(UC_APP_META).map(([k, m]) =>
      `<button class="btn-xs ${refType === k ? 'btn-p' : ''}" data-action="uc-reftype" data-reftype="${k}">${m.ico} ${m.label}</button>`
    ).join(' ');
    let picker;
    if(refType === 'aicode'){
      picker = `<div class="box-info" style="font-size:12px">학생이 클릭하면 AI 코딩 메뉴가 열립니다. (선생님 'AI 코딩' 탭에서 켜져 있어야 사용 가능)</div>`;
    } else {
      // 노트북·미션·OJ·퀴즈는 '전체 목록 통째로' 옵션 제공 → 항목을 일일이 추가 안 해도 됨
      const supportsAll = UC_APP_SCOPE_ALL.includes(refType);
      const arr = UC_APP_META[refType].list() || [];
      const allOpt = supportsAll ? `<option value="*" ${d.refId === '*' ? 'selected' : ''}>📋 전체 목록 (이 메뉴 통째로 연결)</option>` : '';
      const pickOpt = supportsAll ? '' : `<option value="" ${!d.refId ? 'selected' : ''}>— 항목 선택 —</option>`;
      const itemOpts = arr.map(x => `<option value="${x.id}" ${d.refId === x.id ? 'selected' : ''}>${esc(x.title || x.id)}</option>`).join('');
      picker = (arr.length || supportsAll)
        ? `<div class="field"><label>연결 대상</label><select id="uc-refid">${allOpt}${pickOpt}${itemOpts}</select>
            ${supportsAll ? `<div style="font-size:11px;color:var(--text3);margin-top:5px">💡 <b>전체 목록</b>을 고르면 학생이 ${UC_APP_META[refType].label} 전체를 한 메뉴에서 보고 골라요. (20개를 일일이 추가할 필요 없음)</div>` : ''}</div>`
        : `<div class="box-warn" style="font-size:12px">연결할 ${UC_APP_META[refType].label}이(가) 없습니다. 먼저 해당 탭에서 만들어 주세요.</div>`;
    }
    typeFields = `<div><label style="display:block;margin-bottom:5px">연결 종류</label><div style="display:flex;gap:5px;flex-wrap:wrap">${refBtns}</div></div>${picker}`;
  }

  const titleHint = d.type === 'app' ? ` <span style="font-weight:400;color:var(--text3);text-transform:none;letter-spacing:0">(비우면 연결한 항목 제목 사용)</span>` : '';
  return `<div class="section">
    <div class="sec-title">${editing ? '✏️ 항목 수정' : '+ 새 항목'}</div>
    <div class="form">
      <div><label style="display:block;margin-bottom:5px">유형</label><div style="display:flex;gap:6px;flex-wrap:wrap">${typeBtns}</div></div>
      <div class="field"><label>제목${titleHint}</label><input id="uc-title" type="text" placeholder="예: KOSIS로 빅데이터 분석하기" value="${esc(d.title || '')}"/></div>
      ${d.type !== 'text' ? `<div class="field"><label>설명 (선택)</label><input id="uc-desc" type="text" value="${esc(d.desc || '')}"/></div>` : ''}
      ${typeFields}
      <div id="uc-err" class="err"></div>
      <div style="display:flex;gap:6px">
        <button class="btn-p" data-action="uc-save" ${UC_SAVING ? 'disabled' : ''}>${UC_SAVING ? '저장 중...' : '저장'}</button>
        <button class="btn-sm" data-action="uc-cancel">취소</button>
      </div>
    </div>
  </div>`;
}
