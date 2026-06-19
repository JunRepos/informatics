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
  return head + bar + items.map(_ucStudentCard).join('');
}

function setUnitSec(s){ ST_UNIT_SEC = s; render(); }

// 학생용 항목 카드 (유형별)
function _ucStudentCard(it){
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
  const meta = it.type === 'file'
    ? `📎 파일 ${_ucFiles(it).length}개`
    : it.type === 'link'
    ? `🔗 ${esc(it.url || '')}`
    : '📝 글';
  return `<div class="list-row">
    <div class="row-icon">${it.type === 'file' ? '📎' : it.type === 'link' ? '🔗' : '📝'}</div>
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
  const typeBtns = [['file', '📎 파일'], ['link', '🔗 링크'], ['text', '📝 글']].map(([k, l]) =>
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
  } else {
    typeFields = `<div class="field"><label>본문 (마크다운 지원)</label><textarea id="uc-body" style="min-height:150px" placeholder="설명/안내를 적으세요.&#10;&#10;## 활동&#10;1. KOSIS 접속&#10;2. ...">${esc(d.body || '')}</textarea></div>`;
  }

  return `<div class="section">
    <div class="sec-title">${editing ? '✏️ 항목 수정' : '+ 새 항목'}</div>
    <div class="form">
      <div><label style="display:block;margin-bottom:5px">유형</label><div style="display:flex;gap:6px;flex-wrap:wrap">${typeBtns}</div></div>
      <div class="field"><label>제목</label><input id="uc-title" type="text" placeholder="예: KOSIS로 빅데이터 분석하기" value="${esc(d.title || '')}"/></div>
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
