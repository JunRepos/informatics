/* ═══════════════════════════════════════
   views/coderun.js — 코드 실행 (구름/프로그래머스 스타일)

   Monaco Editor + JDoodle API로 브라우저에서
   코드를 작성하고 실행하는 IDE 탭.
═══════════════════════════════════════ */

let _monacoEditor = null;
let _monacoReady = false;
let _codeRunning = false;

const CODE_LANGUAGES = [
  {id: 'python3', label: 'Python 3', versionIndex: '5', defaultCode: '# 코드를 입력하세요\nprint("Hello, World!")'},
];

// ── 뷰 (선생님/학생 공용) ──
function vCodeRun(){
  const langOpts = CODE_LANGUAGES.map(l =>
    `<option value="${l.id}">${l.label}</option>`
  ).join('');

  return `
    <div class="cr-wrap">
      <div class="cr-toolbar">
        <select id="cr-lang">${langOpts}</select>
        <div class="cr-spacer"></div>
        <span class="cr-status" id="cr-status"></span>
        <button class="btn-xs" id="cr-reset" onclick="resetCode()">↺ 초기화</button>
        <button class="cr-btn-run btn-sm" id="cr-run" onclick="runCode()">▶ 실행</button>
      </div>
      <div class="cr-editor-wrap" id="cr-editor"></div>
      <div class="cr-resize-handle" id="cr-resize"></div>
      <div class="cr-output-wrap">
        <div class="cr-output-header">
          <span>📋 실행 결과</span>
          <button class="btn-xs" onclick="clearOutput()">지우기</button>
        </div>
        <div class="cr-output" id="cr-output">실행 버튼을 눌러 코드를 실행하세요.</div>
      </div>
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--text3);text-align:right">
      Powered by Monaco Editor & JDoodle · 일일 실행 횟수 제한이 있습니다
    </div>`;
}

// ── Monaco 에디터 초기화 ──
function initMonaco(){
  const container = document.getElementById('cr-editor');
  if(!container || _monacoEditor) return;

  if(typeof require === 'undefined' || !require.config){
    // Monaco loader 아직 안 됨 — 재시도
    setTimeout(initMonaco, 200);
    return;
  }

  require.config({paths: {'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs'}});
  require(['vs/editor/editor.main'], function(){
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const lang = CODE_LANGUAGES[0];

    // 저장된 코드 복원 또는 기본 코드
    const savedCode = sessionStorage.getItem('cr-code');

    _monacoEditor = monaco.editor.create(container, {
      value: savedCode || lang.defaultCode,
      language: 'python',
      theme: isDark ? 'vs-dark' : 'vs',
      fontSize: 14,
      fontFamily: "'Consolas', 'Courier New', monospace",
      minimap: {enabled: false},
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      roundedSelection: true,
      automaticLayout: true,
      tabSize: 4,
      wordWrap: 'on',
      padding: {top: 10},
    });

    _monacoReady = true;

    // 코드 변경 시 자동 저장
    _monacoEditor.onDidChangeModelContent(() => {
      sessionStorage.setItem('cr-code', _monacoEditor.getValue());
    });

    // Ctrl+Enter로 실행
    _monacoEditor.addAction({
      id: 'run-code',
      label: 'Run Code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => runCode()
    });

    // 리사이즈 핸들
    initResizeHandle();
  });
}

// ── 코드 실행 (JDoodle API) ──
async function runCode(){
  if(!_monacoReady || _codeRunning) return;

  const code = _monacoEditor.getValue();
  if(!code.trim()){
    document.getElementById('cr-output').textContent = '코드를 입력하세요.';
    return;
  }

  const outputEl = document.getElementById('cr-output');
  const runBtn = document.getElementById('cr-run');
  const statusEl = document.getElementById('cr-status');

  _codeRunning = true;
  runBtn.disabled = true;
  runBtn.textContent = '⏳ 실행 중...';
  outputEl.className = 'cr-output cr-running';
  outputEl.textContent = '코드를 실행하고 있습니다...';
  statusEl.textContent = '';

  try{
    const lang = CODE_LANGUAGES.find(l => l.id === document.getElementById('cr-lang').value) || CODE_LANGUAGES[0];

    const res = await fetch('https://api.jdoodle.com/v1/execute', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        clientId: JDOODLE_CLIENT_ID,
        clientSecret: JDOODLE_CLIENT_SECRET,
        script: code,
        language: lang.id,
        versionIndex: lang.versionIndex
      })
    });

    const data = await res.json();

    if(data.error){
      outputEl.className = 'cr-output cr-error';
      outputEl.textContent = data.error;
      statusEl.textContent = '❌ 오류';
    } else {
      const output = data.output || '(출력 없음)';
      const hasError = data.statusCode !== 200 || (data.output && data.output.includes('Traceback'));
      outputEl.className = hasError ? 'cr-output cr-error' : 'cr-output';
      outputEl.textContent = output;

      const cpuTime = data.cpuTime ? `${data.cpuTime}초` : '';
      const memory = data.memory ? `${(data.memory / 1024).toFixed(0)}KB` : '';
      statusEl.textContent = `✓ 완료${cpuTime ? ' · ' + cpuTime : ''}${memory ? ' · ' + memory : ''}`;
    }
  } catch(err){
    outputEl.className = 'cr-output cr-error';
    outputEl.textContent = '실행 실패: ' + err.message;
    statusEl.textContent = '❌ 실패';
  }

  _codeRunning = false;
  runBtn.disabled = false;
  runBtn.textContent = '▶ 실행';
}

// ── 초기화 ──
function resetCode(){
  if(!_monacoReady) return;
  const lang = CODE_LANGUAGES.find(l => l.id === document.getElementById('cr-lang')?.value) || CODE_LANGUAGES[0];
  _monacoEditor.setValue(lang.defaultCode);
  sessionStorage.removeItem('cr-code');
  clearOutput();
}

function clearOutput(){
  const el = document.getElementById('cr-output');
  if(el){
    el.className = 'cr-output';
    el.textContent = '실행 버튼을 눌러 코드를 실행하세요.';
  }
  const st = document.getElementById('cr-status');
  if(st) st.textContent = '';
}

// ── 에디터 높이 리사이즈 ──
function initResizeHandle(){
  const handle = document.getElementById('cr-resize');
  const editorWrap = document.getElementById('cr-editor');
  if(!handle || !editorWrap) return;

  let startY, startH;
  handle.addEventListener('mousedown', e => {
    startY = e.clientY;
    startH = editorWrap.offsetHeight;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onDragEnd);
    e.preventDefault();
  });
  handle.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    startH = editorWrap.offsetHeight;
    document.addEventListener('touchmove', onDragTouch);
    document.addEventListener('touchend', onDragEnd);
    e.preventDefault();
  });

  function onDrag(e){
    const newH = Math.max(150, Math.min(600, startH + e.clientY - startY));
    editorWrap.style.height = newH + 'px';
  }
  function onDragTouch(e){
    const newH = Math.max(150, Math.min(600, startH + e.touches[0].clientY - startY));
    editorWrap.style.height = newH + 'px';
  }
  function onDragEnd(){
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragTouch);
    document.removeEventListener('touchend', onDragEnd);
  }
}

// ── 테마 변경 시 에디터 테마 동기화 ──
const _origToggleTheme = toggleTheme;
toggleTheme = function(){
  _origToggleTheme();
  if(_monacoEditor && typeof monaco !== 'undefined'){
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
  }
};
