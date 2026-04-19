/* ═══════════════════════════════════════
   notebook-worker.js — Pyodide Worker (노트북용)

   Colab처럼 Python 전역 상태를 유지 + matplotlib 이미지 출력 지원.
═══════════════════════════════════════ */

importScripts('https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js');

let pyodide = null;
let initialized = false;
let mplLoaded = false;

async function initPyodide(){
  if(initialized) return;
  pyodide = await loadPyodide();
  pyodide.runPython(`
import sys, io, base64, traceback
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
__nb_images = []
`);
  initialized = true;
}

async function ensureMatplotlib(){
  if(mplLoaded) return;
  try {
    await pyodide.loadPackage(['matplotlib', 'numpy']);
    pyodide.runPython(`
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

_original_show = plt.show
def _nb_show(*args, **kwargs):
    import io, base64
    global __nb_images
    for num in plt.get_fignums():
        fig = plt.figure(num)
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', dpi=90)
        __nb_images.append(base64.b64encode(buf.getvalue()).decode('ascii'))
    plt.close('all')
plt.show = _nb_show
`);
    mplLoaded = true;
  } catch(e){
    // matplotlib 로드 실패 무시 (사용자가 안 쓸 수도 있음)
  }
}

self.onmessage = async function(e){
  const {id, action, code, stdin} = e.data;

  try {
    await initPyodide();

    if(action === 'reset'){
      pyodide.runPython(`
for _k in list(globals().keys()):
    if not _k.startswith('_') and _k not in ('sys','io','base64','traceback'):
        del globals()[_k]
__nb_stdin_lines = []
__nb_stdin_idx = 0
__nb_images = []
def __nb_input(prompt=''):
    global __nb_stdin_idx
    if __nb_stdin_idx < len(__nb_stdin_lines):
        line = __nb_stdin_lines[__nb_stdin_idx]
        __nb_stdin_idx += 1
        return line
    return ''
__builtins__.input = __nb_input
`);
      self.postMessage({id, success: true, output: '', images: []});
      return;
    }

    // matplotlib 쓰는 코드면 미리 로드
    if(/import\s+matplotlib|from\s+matplotlib|import\s+pyplot|plt\./.test(code)){
      await ensureMatplotlib();
    }
    // numpy도 자주 같이 씀
    if(/import\s+numpy|from\s+numpy/.test(code) && !mplLoaded){
      try { await pyodide.loadPackage(['numpy']); } catch(e){}
    }
    // pandas 지원
    if(/import\s+pandas|from\s+pandas/.test(code)){
      try { await pyodide.loadPackage(['pandas']); } catch(e){}
    }

    pyodide.globals.set('__nb_stdin_lines_new', (stdin || '').split('\n'));
    pyodide.runPython(`
__nb_stdin_lines = list(__nb_stdin_lines_new)
__nb_stdin_idx = 0
__nb_images = []
_stdout_capture = io.StringIO()
_stderr_capture = io.StringIO()
sys.stdout = _stdout_capture
sys.stderr = _stderr_capture
`);

    let errorText = '';
    try {
      await pyodide.runPythonAsync(code);
    } catch(err){
      // Python 에러면 traceback 가져옴
      try {
        errorText = pyodide.runPython(`
import traceback
traceback.format_exc()
`);
      } catch(e2){
        errorText = err.message || String(err);
      }
    }

    // matplotlib 자동 show (plt.show() 없어도 그려진 그림 캡처)
    if(mplLoaded){
      try {
        pyodide.runPython(`
try:
    import matplotlib.pyplot as plt
    if plt.get_fignums():
        _nb_show()
except Exception:
    pass
`);
      } catch(e){}
    }

    const stdoutText = pyodide.runPython('_stdout_capture.getvalue()');
    const stderrText = pyodide.runPython('_stderr_capture.getvalue()');
    const imagesArr = pyodide.runPython('__nb_images').toJs();
    pyodide.runPython('sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__; __nb_images = []');

    const combined = (stdoutText || '') + (stderrText || '');
    self.postMessage({
      id,
      success: !errorText,
      output: combined,
      error: errorText || '',
      images: Array.from(imagesArr || [])
    });

  } catch(err){
    self.postMessage({id, success: false, output: '', error: err.message || String(err), images: []});
  }
};
