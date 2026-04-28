/* ═══════════════════════════════════════
   notebook-worker.js — Pyodide Worker (노트북용)

   Colab처럼 Python 전역 상태를 유지 + matplotlib 이미지 출력 지원.

   ✨ 진짜 input() 지원:
   - 메인 스레드와 SharedArrayBuffer 공유
   - input() 호출 시 메인 스레드에 알림 → Atomics.wait 로 대기
   - 사용자가 값 입력 → 메인이 SAB에 쓰고 notify → 워커 깨어남
═══════════════════════════════════════ */

importScripts('https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js');

let pyodide = null;
let initialized = false;
let mplLoaded = false;

// ── stdin 공유 메모리 (메인 스레드에서 init 시 전달받음) ──
// Layout: [status:Int32, length:Int32, ...data:Uint8Array(STDIN_BUF_SIZE)]
//   status: 0=대기, 1=데이터 준비됨, 2=중단(취소/타임아웃)
const STDIN_BUF_SIZE = 4096;
let stdinSAB = null;
let stdinCtrl = null;   // Int32Array(2) — [status, length]
let stdinData = null;   // Uint8Array(STDIN_BUF_SIZE)
let stdinSupported = false;

// 미리 채워진 stdin 라인 큐 (옵션, batch 테스트용)
let preFedStdinQueue = [];
// 현재 실행 중인 셀 id (input 요청 시 메인에 알림)
let currentRunCellId = null;

// 메인 스레드에 입력 요청 → Atomics.wait 로 동기 대기
function syncStdinReadLine(prompt){
  // 1) 미리 받은 stdin 라인이 있으면 먼저 사용
  if(preFedStdinQueue.length > 0){
    return preFedStdinQueue.shift();
  }

  // 2) SharedArrayBuffer 미지원이면 빈 문자열 (graceful fallback)
  if(!stdinSupported){
    return '';
  }

  // 3) 메인 스레드에 입력 요청
  Atomics.store(stdinCtrl, 0, 0);  // status: 대기 중
  Atomics.store(stdinCtrl, 1, 0);
  self.postMessage({type: 'request-input', cellId: currentRunCellId, prompt: prompt || ''});

  // 4) 메인 스레드 응답 대기 (블로킹)
  Atomics.wait(stdinCtrl, 0, 0);

  // 5) 결과 읽기
  const status = Atomics.load(stdinCtrl, 0);
  if(status === 2){
    throw new Error('KeyboardInterrupt: 입력 취소');
  }
  const len = Atomics.load(stdinCtrl, 1);
  const bytes = stdinData.slice(0, len);
  return new TextDecoder().decode(bytes);
}

async function initPyodide(){
  if(initialized) return;
  pyodide = await loadPyodide();

  // Pyodide stdin 콜백 등록 (input() 호출될 때마다 호출됨)
  if(typeof pyodide.setStdin === 'function'){
    pyodide.setStdin({
      stdin: () => syncStdinReadLine(),
      isatty: false
    });
  } else {
    // 구형 Pyodide fallback: __builtins__.input 직접 오버라이드
    pyodide.runPython(`
import builtins
def __nb_input(prompt=''):
    if prompt: print(prompt, end='')
    return ''
builtins.input = __nb_input
`);
  }

  pyodide.runPython(`
import sys, io, base64, traceback
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
    // matplotlib 로드 실패 무시
  }
}

self.onmessage = async function(e){
  const msg = e.data;

  // ── stdin 공유 메모리 초기화 ──
  if(msg.type === 'init-stdin'){
    if(msg.buffer && typeof SharedArrayBuffer !== 'undefined'){
      try {
        stdinSAB = msg.buffer;
        stdinCtrl = new Int32Array(stdinSAB, 0, 2);
        stdinData = new Uint8Array(stdinSAB, 8, STDIN_BUF_SIZE);
        // Atomics 사용 가능 여부 테스트
        Atomics.load(stdinCtrl, 0);
        stdinSupported = true;
      } catch(err){
        stdinSupported = false;
      }
    }
    self.postMessage({type: 'init-stdin-done', supported: stdinSupported});
    return;
  }

  const {id, action, code, stdin, cellId} = msg;

  try {
    await initPyodide();

    if(action === 'reset'){
      pyodide.runPython(`
for _k in list(globals().keys()):
    if not _k.startswith('_') and _k not in ('sys','io','base64','traceback','builtins'):
        del globals()[_k]
__nb_images = []
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

    // stdin 큐 세팅 (textarea에 미리 쓴 값들)
    preFedStdinQueue = stdin
      ? stdin.split('\n').filter((_, i, arr) => i < arr.length - 1 || arr[i].length > 0)
      : [];
    currentRunCellId = cellId || null;

    pyodide.runPython(`
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

    // matplotlib 자동 show
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
  } finally {
    currentRunCellId = null;
    preFedStdinQueue = [];
  }
};
