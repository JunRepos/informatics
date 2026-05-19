/* ═══════════════════════════════════════
   asmt-worker.js — 수행평가 변형 과제 Pyodide 워커

   학생이 변형한 코드를 실행하고 stdout / 오류를 반환.
   input() 은 미리 입력된 stdin 텍스트를 줄 단위로 차례로 소비.

   OJ 워커와 별도 인스턴스 — 단순하고 가벼움 (채점 로직 없음).
═══════════════════════════════════════ */

self.importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

let pyodide = null;
let initPromise = null;

async function init(){
  pyodide = await loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
  });
  // builtins.input 을 stdin 줄 소비 형태로 재정의
  await pyodide.runPythonAsync(`
import builtins
_asmt_stdin = []
_asmt_idx = [0]
def _asmt_input(prompt=''):
    if prompt:
        print(prompt, end='')
    i = _asmt_idx[0]
    if i >= len(_asmt_stdin):
        raise EOFError("입력값이 부족합니다. 코드 아래 '입력값' 칸을 채워주세요.")
    val = _asmt_stdin[i]
    _asmt_idx[0] = i + 1
    return val
builtins.input = _asmt_input
`);
  return pyodide;
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  if(msg.type !== 'run') return;

  try {
    if(!initPromise) initPromise = init();
    await initPromise;

    // stdin 설정
    const stdinLines = String(msg.stdin || '').replace(/\r\n/g, '\n').split('\n');
    // 마지막 빈 줄 제거 (편집 시 자주 생김)
    while(stdinLines.length && stdinLines[stdinLines.length - 1] === '') stdinLines.pop();
    pyodide.globals.set('_asmt_stdin', stdinLines);
    pyodide.globals.set('_asmt_idx', [0]);

    let output = '';
    pyodide.setStdout({ batched: (s) => { output += s + '\n'; } });
    pyodide.setStderr({ batched: (s) => { output += s + '\n'; } });

    try {
      await pyodide.runPythonAsync(msg.code || '');
      self.postMessage({
        type: 'result',
        output: output.replace(/\n$/, ''),
        error: null,
        success: true
      });
    } catch(err){
      self.postMessage({
        type: 'result',
        output: output.replace(/\n$/, ''),
        error: String(err.message || err),
        success: false
      });
    }
  } catch(err){
    self.postMessage({
      type: 'result',
      output: '',
      error: 'Pyodide 초기화 실패: ' + (err.message || err),
      success: false
    });
  }
};

// 워커 준비 완료 알림 (UI 측에서 첫 실행 시 로딩 표시 끄기 등에 사용 가능)
self.postMessage({ type: 'worker-ready' });
