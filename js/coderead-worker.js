/* ═══════════════════════════════════════
   coderead-worker.js — Pyodide Web Worker (코드 읽기 분석)

   선생님이 등록한 코드를 실행해서:
   1) stdout 출력 캡처
   2) sys.settrace 로 줄별 지역 변수 스냅샷 수집

   결과:
   {
     success, output, error,
     traces: [ {line, locals: {var: "repr", ...}}, ... ]
   }

   주의:
   - 사용자 코드 실행은 컴파일된 코드 객체를 exec 하여 줄번호가
     사용자 코드 기준이 되도록 한다.
   - 입력은 stdin 줄단위 처리 (input() 지원).
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

    pyodide.globals.set('__cr_user_code', code || '');
    pyodide.globals.set('__cr_stdin_raw', stdin || '');

    pyodide.runPython(`
import sys, io, builtins, json

# 이전 실행 사용자 전역 정리
_keep = {'sys','io','builtins','json','__cr_user_code','__cr_stdin_raw'}
for _k in list(globals().keys()):
    if not _k.startswith('_') and _k not in _keep:
        del globals()[_k]

# stdin/stdout 격리
_cr_lines = __cr_stdin_raw.split('\\n') if __cr_stdin_raw else []
_cr_idx = 0
def _cr_input(prompt=''):
    global _cr_idx
    if _cr_idx < len(_cr_lines):
        line = _cr_lines[_cr_idx]
        _cr_idx += 1
        return line
    return ''
builtins.input = _cr_input

_cr_stdout = io.StringIO()
sys.stdout = _cr_stdout

# 트레이스 수집
_cr_traces = []
_cr_max_steps = 200  # 무한 루프 방지

def _cr_safe_repr(v):
    try:
        r = repr(v)
        if len(r) > 200:
            r = r[:197] + '...'
        return r
    except Exception:
        return '<repr error>'

def _cr_tracer(frame, event, arg):
    # 사용자 코드(<cr_user>)에서만 trace 수집
    if frame.f_code.co_filename != '<cr_user>':
        return _cr_tracer
    if event == 'line' or event == 'return':
        if len(_cr_traces) >= _cr_max_steps:
            return _cr_tracer
        snap = {}
        for k, v in frame.f_locals.items():
            if k.startswith('_'):
                continue
            snap[k] = _cr_safe_repr(v)
        _cr_traces.append({'line': frame.f_lineno, 'locals': snap})
    return _cr_tracer

# 사용자 코드 컴파일 (filename='<cr_user>' 로 마킹)
_cr_error = ''
_cr_compiled = None
try:
    _cr_compiled = compile(__cr_user_code, '<cr_user>', 'exec')
except SyntaxError as e:
    _cr_error = f'SyntaxError: {e.msg} (line {e.lineno})'

if _cr_compiled is not None:
    _cr_user_globals = {'__name__': '__main__', '__builtins__': builtins}
    sys.settrace(_cr_tracer)
    try:
        exec(_cr_compiled, _cr_user_globals)
    except Exception as e:
        # traceback의 마지막 줄만 사용 (학생 코드 기준)
        import traceback as _tb
        tb_lines = _tb.format_exception(type(e), e, e.__traceback__)
        _cr_error = ''.join(tb_lines).strip()
    finally:
        sys.settrace(None)

_cr_output = _cr_stdout.getvalue()
sys.stdout = sys.__stdout__

_cr_result = json.dumps({
    'output': _cr_output,
    'error': _cr_error,
    'traces': _cr_traces,
})
`);

    const resultJson = pyodide.runPython('_cr_result');
    const result = JSON.parse(resultJson);

    self.postMessage({
      id,
      success: !result.error,
      output: result.output || '',
      error: result.error || '',
      traces: result.traces || []
    });

  } catch(err){
    self.postMessage({
      id,
      success: false,
      output: '',
      error: err.message || String(err),
      traces: []
    });
  }
};
