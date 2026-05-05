/* ═══════════════════════════════════════
   coderead-runner.js — 코드 읽기 자동 분석기

   선생님이 코드를 등록할 때 Pyodide로 코드를 실행하여:
   1) 출력(stdout) 캡처 → 출력 예측 문제의 정답
   2) sys.settrace로 줄별 변수 스냅샷 → 트레이스 문제의 정답

   학생 답안 채점은 등록 시 저장된 정답과 문자열 비교만 하므로
   학생 화면에선 Pyodide를 띄울 필요가 없다 (가볍게 유지).
═══════════════════════════════════════ */

// OJ 워커를 그대로 재사용하면 settrace 결과를 받기 까다로우므로 전용 워커를 둔다.
let _crWorker = null;
let _crMsgId = 0;
let _crCallbacks = {};
const CR_TIMEOUT_MS = 6000;

function getCRWorker(){
  if(!_crWorker){
    _crWorker = new Worker('js/coderead-worker.js');
    _crWorker.onmessage = (e) => {
      const cb = _crCallbacks[e.data.id];
      if(cb){ delete _crCallbacks[e.data.id]; cb(e.data); }
    };
    _crWorker.onerror = (err) => {
      console.error('CodeRead Worker error:', err);
    };
  }
  return _crWorker;
}

// 코드 분석 — 출력 + 줄별 변수 스냅샷 추출
function analyzeCode(code, stdin){
  return new Promise((resolve) => {
    const id = ++_crMsgId;
    const timer = setTimeout(() => {
      delete _crCallbacks[id];
      try { _crWorker?.terminate(); } catch(e){}
      _crWorker = null;
      resolve({success: false, output: '', error: '시간 초과 (6초). 무한 루프이거나 코드가 너무 깁니다.', traces: []});
    }, CR_TIMEOUT_MS);
    _crCallbacks[id] = (data) => { clearTimeout(timer); resolve(data); };
    getCRWorker().postMessage({id, code, stdin: stdin || ''});
  });
}

// 트레이스 결과로부터 자동으로 "흥미로운 단계" 추출
//   - 변수가 새로 생기거나 값이 바뀌는 줄을 우선 선택
//   - 너무 많으면 균등 간격으로 샘플링 (최대 6개)
function pickTraceSteps(traces, maxSteps = 6){
  if(!traces || !traces.length) return [];
  const interesting = [];
  const seen = {}; // var → last value
  for(const t of traces){
    let changed = false;
    for(const [k, v] of Object.entries(t.locals || {})){
      if(seen[k] !== v){
        changed = true;
        seen[k] = v;
      }
    }
    if(changed) interesting.push(t);
  }
  // 너무 많으면 균등 샘플링
  if(interesting.length <= maxSteps) return interesting;
  const step = (interesting.length - 1) / (maxSteps - 1);
  const picked = [];
  for(let i = 0; i < maxSteps; i++){
    picked.push(interesting[Math.round(i * step)]);
  }
  return picked;
}

// 한 trace 단계에서 "물어볼 변수" 자동 선택
//   - 가장 최근에 바뀐 변수 우선
//   - 없으면 마지막 변수
function pickAskVar(curTrace, prevTrace){
  const cur = curTrace.locals || {};
  const prev = (prevTrace && prevTrace.locals) || {};
  // 새로 생긴 / 바뀐 변수 우선
  for(const k of Object.keys(cur)){
    if(prev[k] !== cur[k]) return k;
  }
  // 못 찾으면 첫 변수
  return Object.keys(cur)[0] || null;
}
