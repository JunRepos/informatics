/* ═══════════════════════════════════════
   oj-worker.js — Pyodide Web Worker (OJ 채점용)

   학생 코드를 안전하게 실행:
   - stdin/stdout 격리 (실행마다 fresh)
   - traceback line 번호가 사용자 코드 기준이 되도록 직접 runPythonAsync 호출
   - 변수 격리 (이전 실행 잔재 없음)
═══════════════════════════════════════ */

importScripts('https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js');

let pyodide = null;

async function initPyodide(){
  if(pyodide) return;
  pyodide = await loadPyodide();
  // 한 번만 import
  pyodide.runPython(`
import sys, io, builtins, traceback
`);
}

self.onmessage = async function(e){
  const {id, code, stdin} = e.data;

  try {
    await initPyodide();

    // ── 이전 실행 흔적 제거 + stdin/stdout 셋업 ──
    pyodide.globals.set('__oj_stdin_raw', stdin || '');
    pyodide.runPython(`
# 사용자 전역 정리 (이전 실행 변수 제거)
for _k in list(globals().keys()):
    if not _k.startswith('_') and _k not in ('sys','io','builtins','traceback'):
        del globals()[_k]

_oj_lines = __oj_stdin_raw.split('\\n')
_oj_idx = 0
def _oj_input(prompt=''):
    global _oj_idx
    if _oj_idx < len(_oj_lines):
        line = _oj_lines[_oj_idx]
        _oj_idx += 1
        return line
    return ''
builtins.input = _oj_input

_oj_stdout = io.StringIO()
sys.stdout = _oj_stdout
`);

    // ── 사용자 코드 실행 (line 번호 = 사용자 코드 기준) ──
    let errorText = '';
    try {
      await pyodide.runPythonAsync(code);
    } catch(err){
      // Python traceback (사용자 line 번호 기준)
      try {
        errorText = pyodide.runPython(`traceback.format_exc()`);
      } catch(e2){
        errorText = err.message || String(err);
      }
    }

    const output = pyodide.runPython('_oj_stdout.getvalue()');
    pyodide.runPython('sys.stdout = sys.__stdout__');

    self.postMessage({
      id,
      success: !errorText,
      output: output || '',
      error: errorText || ''
    });

  } catch(err){
    self.postMessage({id, success: false, output: '', error: err.message || String(err)});
  }
};
