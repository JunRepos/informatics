/* ═══════════════════════════════════════
   aiactivity-data.js — 🧠 인공지능 활동지 정의

   인공지능 단원 학습지를 정의한다. 새 활동을 추가하려면
   AIA_LIST 배열에 항목을 추가하면 된다.

   sections 타입:
   - 'card-fields' : 카드형 textarea 여러 개 (각 필드별 icon/label/placeholder)
   - 'single-text' : 단일 textarea (제목 + 답안 칸)
   - 'rich-text'   : 자유 서술 (긴 textarea)

   학생 답안 저장 키: 각 필드의 id가 답안 객체의 키가 된다.
═══════════════════════════════════════ */

const AIA_LIST = [
  {
    id: 'agent-design',
    icon: '🎯',
    title: '실생활 및 진로 분야에서 필요한 지능 에이전트를 설계해보기',
    subtitle: '활동',
    intro: '실생활 또는 본인의 진로 분야와 관련해 도움이 될 만한 지능 에이전트를 직접 설계해봅시다. 에이전트 이름과 간단 설명을 먼저 정한 뒤, 4요소(목표·환경·인식·학습 및 추론·행동)를 차근차근 채우고, 가장 도움이 될 사람도 함께 적어주세요.',
    sections: [
      {
        id: 'agentInfo',
        title: '🤖 내 에이전트 소개',
        type: 'card-fields',
        fields: [
          { id: 'agentName', icon: '🪪', label: '이 름',     placeholder: '예: 진로 도우미 봇',                                       rows: 1 },
          { id: 'agentDesc', icon: '📝', label: '간단 설명', placeholder: '어떤 에이전트인지 한두 문장으로 소개해보세요.',           rows: 2 },
        ],
      },
      {
        id: 'fourElements',
        title: '내 진로 에이전트의 4요소 설계',
        type: 'card-fields',
        fields: [
          { id: 'goal',     icon: '🎯', label: '목 표',           placeholder: '내 에이전트가 사용자에게 무엇을 해주는가?',         rows: 3 },
          { id: 'env',      icon: '🌐', label: '환 경',           placeholder: '이 에이전트가 활동할 공간/상황',                 rows: 3 },
          { id: 'perceive', icon: '👁️', label: '인 식',           placeholder: '어떤 데이터를 어떻게 받아오는가?',                rows: 3 },
          { id: 'learn',    icon: '🧠', label: '학습 및 추론',     placeholder: '받아온 데이터로 무엇을 학습하고 어떻게 판단하는가?', rows: 5 },
          { id: 'act',      icon: '⚙️', label: '행 동',           placeholder: '어떤 결과를 출력하거나 실행하는가?',              rows: 3 },
        ],
      },
      {
        id: 'audience',
        title: '이 에이전트가 가장 도움이 될 사람은?',
        type: 'single-text',
        icon: '👥',
        placeholder: '예: 진로를 고민하는 고등학생 / 시간 관리가 어려운 직장인 ...',
        rows: 2,
      },
    ],
  },
];

function aiaById(id){ return AIA_LIST.find(a => a.id === id) || null; }

// 활동지 답안에서 모든 필드 id 추출 (CSV 내보내기 등에서 사용)
function aiaFieldIds(act){
  const ids = [];
  for(const sec of (act.sections || [])){
    if(sec.type === 'card-fields'){
      (sec.fields || []).forEach(f => ids.push(f.id));
    } else if(sec.type === 'single-text' || sec.type === 'rich-text'){
      ids.push(sec.id);
    }
  }
  return ids;
}
