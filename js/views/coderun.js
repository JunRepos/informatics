/* ═══════════════════════════════════════
   views/coderun.js — 코드 실행 (구름/프로그래머스 스타일)

   Monaco Editor로 코드 작성,
   JDoodle iframe embed로 실행.
═══════════════════════════════════════ */

let _monacoEditor = null;
let _monacoReady = false;

const CODE_LANGUAGES = [
  {id: 'python3', label: 'Python 3', monaco: 'python', defaultCode: '# 코드를 입력하세요\nprint("Hello, World!")'},
  {id: 'c', label: 'C', monaco: 'c', defaultCode: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}'},
  {id: 'cpp17', label: 'C++', monaco: 'cpp', defaultCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}'},
  {id: 'java', label: 'Java', monaco: 'java', defaultCode: 'public class MyClass {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}'},
];

// ── 뷰 (선생님/학생 공용) ──
function vCodeRun(){
  const langOpts = CODE_LANGUAGES.map((l, i) =>
    `<option value="${i}">${l.label}</option>`
  ).join('');

  const savedLang = sessionStorage.getItem('cr-lang-idx') || '0';

  return `
    <div class="cr-wrap">
      <div class="cr-toolbar">
        <select id="cr-lang" onchange="onLangChange()">${langOpts}</select>
        <div class="cr-spacer"></div>
        <button class="btn-xs" onclick="resetCode()">↺ 초기화</button>
        <button class="cr-btn-run btn-sm" id="cr-run" onclick="sendToJdoodle()">▶ 실행</button>
      </div>
      <div class="cr-editor-wrap" id="cr-editor"></div>
      <div class="cr-resize-handle" id="cr-resize"></div>
      <div class="cr-output-wrap">
        <div class="cr-output-header">
          <span>📋 실행 결과</span>
          <button class="btn-xs" onclick="clearOutput()">지우기</button>
        </div>
        <div id="cr-jdoodle-area" style="display:none">
          <div id="cr-jdoodle-container"></div>
        </div>
        <div class="cr-output" id="cr-output">▶ 실행 버튼을 눌러 코드를 실행하세요. (Ctrl+Enter)</div>
      </div>
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--text3);text-align:right">
      Powered by Monaco Editor & JDoodle
    </div>`;
}

// ── Monaco 에디터 초기화 ──
function initMonaco(){
  const container = document.getElementById('cr-editor');
  if(!container || _monacoEditor) return;

  if(typeof require === 'undefined' || !require.config){
    setTimeout(initMonaco, 200);
    return;
  }

  require.config({paths: {'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs'}});
  require(['vs/editor/editor.main'], function(){
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const langIdx = parseInt(sessionStorage.getItem('cr-lang-idx') || '0');
    const lang = CODE_LANGUAGES[langIdx] || CODE_LANGUAGES[0];
    const savedCode = sessionStorage.getItem('cr-code');

    _monacoEditor = monaco.editor.create(container, {
      value: savedCode || lang.defaultCode,
      language: lang.monaco,
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

    // 언어 선택 복원
    const sel = document.getElementById('cr-lang');
    if(sel) sel.value = langIdx;

    // 코드 변경 시 자동 저장
    _monacoEditor.onDidChangeModelContent(() => {
      sessionStorage.setItem('cr-code', _monacoEditor.getValue());
    });

    // Ctrl+Enter로 실행
    _monacoEditor.addAction({
      id: 'run-code',
      label: 'Run Code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => sendToJdoodle()
    });

    initResizeHandle();
  });
}

// ── JDoodle iframe으로 코드 전송 & 실행 ──
function sendToJdoodle(){
  if(!_monacoReady) return;

  const code = _monacoEditor.getValue();
  if(!code.trim()){
    document.getElementById('cr-output').textContent = '코드를 입력하세요.';
    return;
  }

  const langIdx = parseInt(document.getElementById('cr-lang')?.value || '0');
  const lang = CODE_LANGUAGES[langIdx] || CODE_LANGUAGES[0];

  const outputEl = document.getElementById('cr-output');
  const jdArea = document.getElementById('cr-jdoodle-area');
  const jdContainer = document.getElementById('cr-jdoodle-container');
  const runBtn = document.getElementById('cr-run');

  // 출력창에 실행 중 표시
  outputEl.className = 'cr-output cr-running';
  outputEl.textContent = '코드를 실행하고 있습니다...';
  runBtn.disabled = true;
  runBtn.textContent = '⏳ 실행 중...';

  // JDoodle iframe 생성
  jdArea.style.display = 'block';
  jdContainer.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:300px;border:none;border-top:1px solid var(--border)';

  // JDoodle의 embed URL에 코드를 전달
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `https://api.jdoodle.com/v1/execute`;
  form.target = 'jdoodle-frame';
  form.style.display = 'none';

  // JDoodle execute via hidden form won't work due to CORS
  // Instead, use JDoodle's compiler page directly
  iframe.name = 'jdoodle-result';

  // 가장 신뢰할 수 있는 방법: onecompiler embed 사용
  const encodedCode = encodeURIComponent(code);
  iframe.src = `https://onecompiler.com/embed/${lang.id === 'python3' ? 'python' : lang.id === 'cpp17' ? 'cpp' : lang.id}?code=${encodedCode}&theme=dark&hideTitle=true&hideLanguageSelection=true&hideNew=true&hideStdin=false`;

  iframe.onload = () => {
    outputEl.style.display = 'none';
    runBtn.disabled = false;
    runBtn.textContent = '▶ 실행';
  };

  jdContainer.appendChild(iframe);
}

// ── 언어 변경 ──
function onLangChange(){
  const idx = parseInt(document.getElementById('cr-lang')?.value || '0');
  const lang = CODE_LANGUAGES[idx] || CODE_LANGUAGES[0];
  sessionStorage.setItem('cr-lang-idx', idx);

  if(_monacoReady && _monacoEditor){
    const model = _monacoEditor.getModel();
    if(model) monaco.editor.setModelLanguage(model, lang.monaco);
    _monacoEditor.setValue(lang.defaultCode);
    sessionStorage.removeItem('cr-code');
  }
  clearOutput();
}

// ── 초기화 ──
function resetCode(){
  if(!_monacoReady) return;
  const idx = parseInt(document.getElementById('cr-lang')?.value || '0');
  const lang = CODE_LANGUAGES[idx] || CODE_LANGUAGES[0];
  _monacoEditor.setValue(lang.defaultCode);
  sessionStorage.removeItem('cr-code');
  clearOutput();
}

function clearOutput(){
  const el = document.getElementById('cr-output');
  if(el){
    el.className = 'cr-output';
    el.style.display = 'block';
    el.textContent = '▶ 실행 버튼을 눌러 코드를 실행하세요. (Ctrl+Enter)';
  }
  const jdArea = document.getElementById('cr-jdoodle-area');
  if(jdArea){ jdArea.style.display = 'none'; }
  const jdContainer = document.getElementById('cr-jdoodle-container');
  if(jdContainer) jdContainer.innerHTML = '';
}

// ── 에디터 높이 리사이즈 ──
function initResizeHandle(){
  const handle = document.getElementById('cr-resize');
  const editorWrap = document.getElementById('cr-editor');
  if(!handle || !editorWrap) return;

  let startY, startH;
  handle.addEventListener('mousedown', e => {
    startY = e.clientY; startH = editorWrap.offsetHeight;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onDragEnd);
    e.preventDefault();
  });
  handle.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY; startH = editorWrap.offsetHeight;
    document.addEventListener('touchmove', onDragTouch);
    document.addEventListener('touchend', onDragEnd);
    e.preventDefault();
  });
  function onDrag(e){ editorWrap.style.height = Math.max(150, Math.min(600, startH + e.clientY - startY)) + 'px'; }
  function onDragTouch(e){ editorWrap.style.height = Math.max(150, Math.min(600, startH + e.touches[0].clientY - startY)) + 'px'; }
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
