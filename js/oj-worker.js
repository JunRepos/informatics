/* ═══════════════════════════════════════
   oj-worker.js — Pyodide Web Worker (OJ 채점/실행용)

   두 가지 모드:
   1) 채점(grade): stdin 미리 큐로 채워 자동 실행 (테스트케이스용)
   2) 실행(run):   학생이 input() 마다 직접 입력 — Colab 스타일
                   SharedArrayBuffer + Atomics 로 메인 스레드와 동기 통신
═══════════════════════════════════════ */

importScripts('https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js');

let pyodide = null;
let initialized = false;

// ── stdin 공유 메모리 (메인 스레드에서 init-stdin 으로 전달) ──
// Layout: [status:Int32, length:Int32, ...data:Uint8Array(STDIN_BUF_SIZE)]
//   status: 0=대기, 1=데이터 준비됨, 2=중단(취소)
const STDIN_BUF_SIZE = 4096;
let stdinSAB = null;
let stdinCtrl = null;   // Int32Array(2) — [status, length]
let stdinData = null;   // Uint8Array(STDIN_BUF_SIZE)
let stdinSupported = false;

// 미리 채워진 stdin 라인 큐 (채점 모드)
let preFedStdinQueue = [];
// 현재 실행이 SAB(실시간 input) 사용 가능한 모드인지
let useSAB = false;

// 메인 스레드에 입력 요청 → Atomics.wait 로 동기 대기
//   반환:
//     문자열       — 정상 입력값
//     undefined    — 실시간 모드인데 SAB 미지원 (브라우저 환경 문제)
//                    Python 측이 None 으로 받아 친절한 RuntimeError 를 던짐
//     ''           — 채점 모드(큐 비었음) — 무한 대기 방지
function syncStdinReadLine(prompt){
  // 1) 미리 받은 stdin 라인이 있으면 먼저 사용 (채점 모드, 또는 학생이 미리 채운 값)
  if(preFedStdinQueue.length > 0){
    return preFedStdinQueue.shift();
  }

  // 2) 실시간 모드인데 SAB 미지원 → undefined (Python None) 으로 명확히 알림
  if(useSAB && !stdinSupported){
    return undefined;
  }

  // 3) 채점 모드 (큐 비었음) → 빈 문자열로 무한대기 방지
  if(!useSAB){
    return '';
  }

  // 4) SAB 가능 — 메인 스레드에 입력 요청
  Atomics.store(stdinCtrl, 0, 0);
  Atomics.store(stdinCtrl, 1, 0);
  self.postMessage({type: 'request-input', prompt: prompt || ''});

  // 5) 응답 대기 (블로킹)
  Atomics.wait(stdinCtrl, 0, 0);

  // 6) 결과 읽기
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

  // input() 처리 — Colab 방식: builtins.input 직접 오버라이드
  // (setStdin 콜백은 prompt 인자를 못 받으므로 직접 가로챔)
  pyodide.globals.set('_oj_js_request_input', (prompt) => syncStdinReadLine(prompt));
  if(typeof pyodide.setStdin === 'function'){
    pyodide.setStdin({
      stdin: () => syncStdinReadLine(''),
      isatty: false
    });
  }
  pyodide.runPython(`
import sys, io, builtins, traceback

def __oj_input(prompt=''):
    try: sys.stdout.flush()
    except Exception: pass
    p = '' if prompt is None else str(prompt)
    v = _oj_js_request_input(p)
    # JS 측이 undefined 반환 → 실시간 입력 모드를 쓸 수 없는 환경
    # (SharedArrayBuffer 미지원 — 보통 첫 방문 시 발생, 새로고침 한 번 더 하면 해결)
    if v is None:
        raise RuntimeError("실시간 input() 모드를 쓸 수 없어요. 페이지를 한 번 더 새로고침(Ctrl+Shift+R) 하거나, '미리 입력값' 칸에 줄별로 값을 채워주세요.")
    return v
builtins.input = __oj_input
`);
  initialized = true;
}

self.onmessage = async function(e){
  const msg = e.data;

  // ── stdin 공유 메모리 초기화 (메인이 SAB 전달) ──
  if(msg.type === 'init-stdin'){
    if(msg.buffer && typeof SharedArrayBuffer !== 'undefined'){
      try {
        stdinSAB = msg.buffer;
        stdinCtrl = new Int32Array(stdinSAB, 0, 2);
        stdinData = new Uint8Array(stdinSAB, 8, STDIN_BUF_SIZE);
        Atomics.load(stdinCtrl, 0);
        stdinSupported = true;
      } catch(err){
        stdinSupported = false;
      }
    }
    self.postMessage({type: 'init-stdin-done', supported: stdinSupported});
    return;
  }

  const {id, code, stdin, mode} = msg;
  // mode: 'run'(실시간 input) | 'grade'(채점, 기본). run 일 때만 SAB 사용.
  useSAB = (mode === 'run');

  try {
    await initPyodide();

    // 사용자 전역 정리 (이전 실행 흔적 제거)
    pyodide.runPython(`
for _k in list(globals().keys()):
    if not _k.startswith('_') and _k not in ('sys','io','builtins','traceback'):
        del globals()[_k]

_oj_stdout = io.StringIO()
sys.stdout = _oj_stdout
`);

    // stdin 큐 세팅
    preFedStdinQueue = stdin
      ? String(stdin).split('\n').filter((_, i, arr) => i < arr.length - 1 || arr[i].length > 0)
      : [];

    let errorText = '';
    try {
      await pyodide.runPythonAsync(code);
    } catch(err){
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
  } finally {
    preFedStdinQueue = [];
    useSAB = false;
  }
};
