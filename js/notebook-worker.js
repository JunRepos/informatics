/* ═══════════════════════════════════════
   notebook-worker.js — Pyodide Worker (노트북용)

   OJ worker와 달리 Python 전역 상태를 유지합니다.
   셀 A에서 선언한 변수를 셀 B에서 사용 가능.
═══════════════════════════════════════ */

importScripts('https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js');

let pyodide = null;
let initialized = false;

async function initPyodide(){
  if(initialized) return;
  pyodide = await loadPyodide();
  // 기본 설정: 출력 버퍼 준비
  pyodide.runPython(`
import sys, io
__nb_stdin_lines = []
__nb_stdin_idx = 0
def __nb_input(prompt=''):
    global __nb_stdin_idx
    if __nb_stdin_idx < len(__nb_stdin_lines):
        line = __nb_stdin_lines[__nb_stdin_idx]
        __nb_stdin_idx += 1
        return line
    return ''
__builtins__.input = __nb_input
`);
  initialized = true;
}

self.onmessage = async function(e){
  const {id, action, code, stdin} = e.data;

  try {
    await initPyodide();

    if(action === 'reset'){
      // 전역 네임스페이스 리셋
      pyodide.runPython(`
import sys
for _k in list(globals().keys()):
    if not _k.startswith('_') and _k not in ('sys','io'):
        del globals()[_k]
__nb_stdin_lines = []
__nb_stdin_idx = 0
def __nb_input(prompt=''):
    global __nb_stdin_idx
    if __nb_stdin_idx < len(__nb_stdin_lines):
        line = __nb_stdin_lines[__nb_stdin_idx]
        __nb_stdin_idx += 1
        return line
    return ''
__builtins__.input = __nb_input
`);
      self.postMessage({id, success: true, output: ''});
      return;
    }

    // stdin 설정
    pyodide.globals.set('__nb_stdin_lines_new', (stdin || '').split('\n'));
    pyodide.runPython(`
__nb_stdin_lines = list(__nb_stdin_lines_new)
__nb_stdin_idx = 0
_stdout_capture = io.StringIO()
_stderr_capture = io.StringIO()
sys.stdout = _stdout_capture
sys.stderr = _stderr_capture
`);

    let errorText = '';
    try {
      await pyodide.runPythonAsync(code);
    } catch(err){
      errorText = err.message || String(err);
    }

    const stdoutText = pyodide.runPython('_stdout_capture.getvalue()');
    const stderrText = pyodide.runPython('_stderr_capture.getvalue()');
    pyodide.runPython('sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__');

    const combined = (stdoutText || '') + (stderrText || '');
    if(errorText){
      self.postMessage({id, success: false, output: combined, error: errorText});
    } else {
      self.postMessage({id, success: true, output: combined});
    }

  } catch(err){
    self.postMessage({id, success: false, output: '', error: err.message || String(err)});
  }
};
