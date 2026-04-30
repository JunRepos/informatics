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
      // ⚠️ traceback.format_exc()는 쓰면 안 됨 — 이 시점엔 Python의 sys.exc_info()가
      //   이미 비워져서 항상 "NoneType: None"만 반환함.
      //   Pyodide PythonError.message 에 포맷된 traceback이 들어 있으니 그걸 사용.
      errorText = (err && err.message) ? err.message : String(err || '알 수 없는 오류');
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
