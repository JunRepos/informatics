/* ═══════════════════════════════════════
   oj-worker.js — Pyodide Web Worker

   브라우저 내에서 Python 코드를 실행합니다.
   메인 스레드 블로킹 없이 안전하게 실행됩니다.
═══════════════════════════════════════ */

importScripts('https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js');

let pyodide = null;

async function initPyodide(){
  if(pyodide) return;
  pyodide = await loadPyodide();
}

self.onmessage = async function(e){
  const {id, code, stdin} = e.data;

  try {
    await initPyodide();

    // stdin을 줄 단위로 제공하는 Python 래퍼
    const wrappedCode = `
import sys, io

_stdin_lines = ${JSON.stringify(stdin || '')}.split('\\n')
_stdin_idx = 0

def _custom_input(prompt=''):
    global _stdin_idx
    if _stdin_idx < len(_stdin_lines):
        line = _stdin_lines[_stdin_idx]
        _stdin_idx += 1
        return line
    return ''

__builtins__.input = _custom_input

_stdout_capture = io.StringIO()
sys.stdout = _stdout_capture

try:
${code.split('\n').map(l => '    ' + l).join('\n')}
except SystemExit:
    pass

sys.stdout = sys.__stdout__
_stdout_capture.getvalue()
`;

    const result = pyodide.runPython(wrappedCode);
    self.postMessage({id, success: true, output: result || ''});

  } catch(err){
    self.postMessage({id, success: false, output: '', error: err.message});
  }
};
