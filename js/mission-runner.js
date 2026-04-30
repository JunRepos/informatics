/* ═══════════════════════════════════════
   mission-runner.js — 미션용 Pyodide (메인 스레드)

   게임 hook은 동기적으로 호출되어야 하므로
   Worker 대신 메인 스레드에서 Pyodide 실행.
═══════════════════════════════════════ */

let _missionPy = null;
let _missionPyLoading = null;

async function ensureMissionPyodide(){
  if(_missionPy) return _missionPy;
  if(_missionPyLoading) return _missionPyLoading;
  _missionPyLoading = (async () => {
    if(typeof loadPyodide === 'undefined'){
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js';
        s.onload = res;
        s.onerror = () => rej(new Error('Pyodide 로드 실패'));
        document.head.appendChild(s);
      });
    }
    _missionPy = await loadPyodide({indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/'});
    return _missionPy;
  })();
  return _missionPyLoading;
}

function _resetNamespace(py){
  try {
    py.runPython(`
for _k in list(globals().keys()):
    if not _k.startswith('_') and _k not in ('sys','io'):
        try: del globals()[_k]
        except: pass
`);
  } catch(e){}
}

// Pyodide stdin 설정 (문자열 또는 줄 배열)
function _setStdin(py, input){
  const lines = input == null ? [] : (Array.isArray(input) ? input : String(input).split('\n'));
  let idx = 0;
  py.setStdin({
    stdin: () => {
      if(idx < lines.length) return lines[idx++];
      return '';
    }
  });
}
function _resetStdin(py){
  try { py.setStdin({stdin: () => ''}); } catch(e){}
}

// 학생 코드 실행 후 테스트 케이스 검증
// userStdin: 학생이 팝업으로 입력한 값 (있으면 t.stdin이 없는 테스트에 사용)
async function runMissionTests(code, tests, userStdin){
  const py = await ensureMissionPyodide();

  // 테스트별 격리가 필요한 타입들 (매번 깨끗이 실행)
  const perTestIsolation = tests.some(t =>
    t.type === 'block' || t.stdin !== undefined || t.type === 'exists'
  ) || userStdin !== undefined;

  if(!perTestIsolation){
    _resetNamespace(py);
    try {
      await py.runPythonAsync(code);
    } catch(e){
      return {success: false, runError: formatPyError(e), results: []};
    }
  }

  const results = [];
  for(const t of tests){
    try {
      let actual, ok;

      if(perTestIsolation){
        _resetNamespace(py);
        // stdin: 테스트 자체 > 학생이 입력한 값 > 없음
        const effStdin = t.stdin !== undefined ? t.stdin : userStdin;
        if(effStdin !== undefined) _setStdin(py, effStdin);
        if(t.inputs){
          for(const [k, v] of Object.entries(t.inputs)){
            py.globals.set(k, v);
          }
        }
        try {
          await py.runPythonAsync(code);
        } catch(e){
          _resetStdin(py);
          results.push({...t, error: formatPyError(e), ok: false}); continue;
        }
        _resetStdin(py);
      }

      if(t.type === 'block'){
        const val = py.globals.get(t.output);
        actual = val?.toJs ? val.toJs({dict_converter: Object.fromEntries}) : val;
        ok = approxEqual(actual, t.expected);
      } else if(t.type === 'variable'){
        const v = py.globals.get(t.name);
        actual = v?.toJs ? v.toJs({dict_converter: Object.fromEntries}) : v;
        ok = approxEqual(actual, t.expected);
      } else if(t.type === 'exists'){
        // 변수 읽기: globals.get 이 실패하면 runPython(name) 으로 폴백
        let v;
        try { v = py.globals.get(t.name); } catch(_e){ v = undefined; }
        if(v === undefined || v === null){
          try { v = py.runPython(t.name); } catch(_e){ v = undefined; }
        }
        actual = v?.toJs ? v.toJs({dict_converter: Object.fromEntries}) : v;
        const exists = actual !== undefined && actual !== null;
        const typeOk = !t.typeOf || typeof actual === t.typeOf;
        const rangeOk = (t.min === undefined || actual >= t.min) &&
                        (t.max === undefined || actual <= t.max);
        ok = exists && typeOk && rangeOk;
        // 진단 로그 (실패 시): 현재 globals 키 / 실제 값 / 코드 일부
        if(!ok){
          let globalsKeys = '?';
          try {
            const g = py.runPython(`[k for k in globals().keys() if not k.startswith('_') and k not in ('sys','io','builtins','traceback')]`);
            globalsKeys = g?.toJs ? g.toJs() : g;
          } catch(_e){}
          console.warn('[mission-exists fail]', {
            wantName: t.name, wantType: t.typeOf,
            actual, actualJsType: typeof actual,
            globalsKeys, codePreview: (code || '').slice(0, 200)
          });
        }
      } else if(t.type === 'function' || t.type === 'expr'){
        const r = py.runPython(t.call);
        actual = r?.toJs ? r.toJs({dict_converter: Object.fromEntries}) : r;
        ok = approxEqual(actual, t.expected);
      }
      results.push({...t, actual, ok});
    } catch(e){
      results.push({...t, error: formatPyError(e), ok: false});
    }
  }

  const success = results.length > 0 && results.every(r => r.ok);
  return {success, results};
}

// 블록 스타일 hook 래퍼 생성 (학생 코드를 매번 실행)
function makeBlockHook(py, code, inputs, output){
  // inputs: 배열 (순서대로 게임이 넘기는 값), output: 읽을 변수명
  return (...args) => {
    try {
      // 필요한 변수만 설정 (나머지는 이전 hook에서 남겨둠)
      inputs.forEach((name, i) => py.globals.set(name, args[i]));
      py.runPython(code);
      const v = py.globals.get(output);
      const jsv = v?.toJs ? v.toJs() : v;
      return jsv;
    } catch(e){
      throw new Error(formatPyError(e));
    }
  };
}

// 학생 함수를 JS에서 호출 가능한 래퍼로 변환 (게임 hook용)
async function getMissionFunction(fnName){
  const py = await ensureMissionPyodide();
  const fn = py.globals.get(fnName);
  if(!fn || typeof fn.toJs !== 'function' && typeof fn !== 'function'){
    return null;
  }
  return (...args) => {
    try {
      const r = fn(...args);
      return r?.toJs ? r.toJs() : r;
    } catch(e){ throw new Error(formatPyError(e)); }
  };
}

// 전역 변수 읽기
async function getMissionVariable(name){
  const py = await ensureMissionPyodide();
  const v = py.globals.get(name);
  return v?.toJs ? v.toJs() : v;
}

// 유틸
function approxEqual(a, b){
  if(a === b) return true;
  if(typeof a === 'number' && typeof b === 'number'){
    return Math.abs(a - b) < 1e-9;
  }
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

function formatPyError(e){
  const msg = e?.message || String(e);
  // Pyodide 래퍼 헤더 제거
  return msg.replace(/^Traceback \(most recent call last\):\s*File.*?, line \d+, in .*?\n/gs, '')
            .replace(/^\s*File "<exec>", line \d+(, in .*?)?\n/gm, '')
            .trim();
}

// 전역 노출
window.ensureMissionPyodide = ensureMissionPyodide;
window.runMissionTests = runMissionTests;
window.getMissionFunction = getMissionFunction;
window.getMissionVariable = getMissionVariable;
window.makeBlockHook = makeBlockHook;
