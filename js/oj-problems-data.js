/* ═══════════════════════════════════════
   oj-problems-data.js — 23개 OJ 문제 일괄 등록 데이터

   OJ 탭의 "📦 23문제 한방 등록" 버튼으로 현재 반에 일괄 등록.
   각 문제의 starterCode 는 description 첫 줄에 <!-- starter:base64 --> 로
   자동 인코딩되어 저장 (_encodeOJMeta 헬퍼 사용).
═══════════════════════════════════════ */

window.OJ_23_PROBLEMS = [

  // ═══════════════════════════════════════
  //  1. 자기소개 카드 — 변수·print
  // ═══════════════════════════════════════
  {
    title: '🪪 자기소개 카드',
    description: `## 문제
이름, 나이, 키를 입력받아 자기소개 카드를 만들어 출력하세요.

## 입력
- 첫 줄: 이름 (문자열)
- 둘째 줄: 나이 (정수)
- 셋째 줄: 키 (실수)

## 출력
\`\`\`
=== 자기소개 ===
이름: (이름)
나이: (나이) 살
키: (키) cm
================
\`\`\`

## 예시

**입력**
\`\`\`
김민지
17
168.5
\`\`\`

**출력**
\`\`\`
=== 자기소개 ===
이름: 김민지
나이: 17 살
키: 168.5 cm
================
\`\`\`

## 💡 힌트
- 윗줄·아랫줄의 \`===\` 도 그대로 \`print()\` 해야 합니다.
- 변수와 글자를 한 줄에 출력할 땐 쉼표 \`,\` 사용`,
    starterCode: `# 이름·나이·키를 입력받아 자기소개 카드를 출력해 봐요
name = input()
age = int(input())
height = float(input())

# 여기에 print() 들로 카드를 만들어 보세요
`,
    testCases: [
      {input: '김민지\n17\n168.5', expectedOutput: '=== 자기소개 ===\n이름: 김민지\n나이: 17 살\n키: 168.5 cm\n================', isHidden: false},
      {input: '홍길동\n16\n172', expectedOutput: '=== 자기소개 ===\n이름: 홍길동\n나이: 16 살\n키: 172.0 cm\n================', isHidden: false},
      {input: '이서연\n18\n160.3', expectedOutput: '=== 자기소개 ===\n이름: 이서연\n나이: 18 살\n키: 160.3 cm\n================', isHidden: true},
      {input: '박지호\n15\n175.8', expectedOutput: '=== 자기소개 ===\n이름: 박지호\n나이: 15 살\n키: 175.8 cm\n================', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  2. 자료형 탐험 — type()
  // ═══════════════════════════════════════
  {
    title: '🔬 자료형 탐험',
    description: `## 문제
네 개의 값에 대해 각각 \`type()\` 결과를 출력하세요.

## 입력
없음 (코드 안에 변수가 정해져 있음)

## 출력
4줄 — 각 변수의 \`type()\` 결과

## 예시
입력 없음.

**출력**
\`\`\`
<class 'int'>
<class 'float'>
<class 'str'>
<class 'bool'>
\`\`\`

## 💡 힌트
- \`print(type(a))\` 처럼 \`type()\` 결과를 직접 출력`,
    starterCode: `a = 100
b = 3.14
c = '안녕'
d = True

# a, b, c, d 의 type 을 한 줄씩 출력해 보세요
`,
    testCases: [
      {input: '', expectedOutput: "<class 'int'>\n<class 'float'>\n<class 'str'>\n<class 'bool'>", isHidden: false}
    ]
  },

  // ═══════════════════════════════════════
  //  3. 두 수의 합 — input + 산술
  // ═══════════════════════════════════════
  {
    title: '➕ 두 수의 합',
    description: `## 문제
두 정수를 입력받아 합을 출력하세요.

## 입력
- 첫 줄: 정수 A
- 둘째 줄: 정수 B

## 출력
A + B

## 예시

**입력**
\`\`\`
3
5
\`\`\`

**출력**
\`\`\`
8
\`\`\`

## 💡 힌트
- \`input()\` 으로 받은 값은 항상 문자열이라 \`int()\` 로 변환 필수`,
    starterCode: `a = int(input())
b = int(input())

# a + b 를 출력하세요
`,
    testCases: [
      {input: '3\n5', expectedOutput: '8', isHidden: false},
      {input: '100\n200', expectedOutput: '300', isHidden: false},
      {input: '-7\n10', expectedOutput: '3', isHidden: true},
      {input: '0\n0', expectedOutput: '0', isHidden: true},
      {input: '999\n1', expectedOutput: '1000', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  4. 직사각형 둘레와 넓이 — 산술
  // ═══════════════════════════════════════
  {
    title: '📐 직사각형 둘레와 넓이',
    description: `## 문제
직사각형의 가로와 세로 길이를 입력받아, **둘레**와 **넓이**를 차례로 출력하세요.

## 입력
- 첫 줄: 가로 (정수)
- 둘째 줄: 세로 (정수)

## 출력
- 첫 줄: 둘레 (2 × (가로+세로))
- 둘째 줄: 넓이 (가로 × 세로)

## 예시

**입력**
\`\`\`
5
3
\`\`\`

**출력**
\`\`\`
16
15
\`\`\`

## 💡 힌트
- 둘레 = \`2 * (w + h)\`, 넓이 = \`w * h\``,
    starterCode: `w = int(input())
h = int(input())

# 둘레와 넓이를 계산해서 두 줄로 출력하세요
`,
    testCases: [
      {input: '5\n3', expectedOutput: '16\n15', isHidden: false},
      {input: '10\n10', expectedOutput: '40\n100', isHidden: false},
      {input: '7\n4', expectedOutput: '22\n28', isHidden: true},
      {input: '1\n1', expectedOutput: '4\n1', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  5. 평균 점수 — 형변환 + /
  // ═══════════════════════════════════════
  {
    title: '📊 평균 점수',
    description: `## 문제
국어·영어·수학 점수를 입력받아 **평균**을 소수점 둘째 자리까지 출력하세요.

## 입력
- 세 줄: 각 줄에 정수 점수

## 출력
평균 (\`85.00\` 형식, 소수점 둘째 자리까지)

## 예시

**입력**
\`\`\`
80
90
85
\`\`\`

**출력**
\`\`\`
85.00
\`\`\`

## 💡 힌트
- 합 ÷ 3 (실수 나눗셈은 \`/\`)
- 소수점 둘째 자리: \`print(f"{평균:.2f}")\` 또는 \`round(평균, 2)\` 응용`,
    starterCode: `kor = int(input())
eng = int(input())
math = int(input())

# 평균을 소수점 둘째 자리까지 출력하세요
`,
    testCases: [
      {input: '80\n90\n85', expectedOutput: '85.00', isHidden: false},
      {input: '100\n100\n100', expectedOutput: '100.00', isHidden: false},
      {input: '70\n80\n90', expectedOutput: '80.00', isHidden: false},
      {input: '60\n65\n70', expectedOutput: '65.00', isHidden: true},
      {input: '0\n50\n100', expectedOutput: '50.00', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  6. 초를 시·분·초로 — // %
  // ═══════════════════════════════════════
  {
    title: '⏰ 초를 시·분·초로',
    description: `## 문제
어떤 사람이 \`N\` 초 동안 운동했어요. 이걸 **시:분:초** 형식으로 변환해 출력하세요.

## 입력
- 한 줄: 정수 \`N\` (총 초, 0 ≤ N ≤ 100000)

## 출력
- \`시:분:초\` 한 줄 (예: \`1:30:45\`)

## 예시

**입력**
\`\`\`
5445
\`\`\`

**출력**
\`\`\`
1:30:45
\`\`\`
> 1시간(3600초) + 30분(1800초) + 45초 = 5445초

## 💡 힌트
- 시 = 전체 초를 3600으로 나눈 **몫** (\`//\`)
- 남은 초 = 전체 초를 3600으로 나눈 **나머지** (\`%\`)
- 분 = 남은 초를 60으로 나눈 몫, 초 = 60으로 나눈 나머지`,
    starterCode: `n = int(input())

# n 초를 시:분:초 로 변환해서 출력하세요
`,
    testCases: [
      {input: '5445', expectedOutput: '1:30:45', isHidden: false},
      {input: '3600', expectedOutput: '1:0:0', isHidden: false},
      {input: '61', expectedOutput: '0:1:1', isHidden: false},
      {input: '7325', expectedOutput: '2:2:5', isHidden: true},
      {input: '59', expectedOutput: '0:0:59', isHidden: true},
      {input: '0', expectedOutput: '0:0:0', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  7. 학번 찾기 — 리스트 인덱싱 (음수 포함)
  // ═══════════════════════════════════════
  {
    title: '🔢 학번 찾기',
    description: `## 문제
명단에 학생 \`N\` 명의 학번이 차례로 있어요. \`K\` 번째 자리(0부터 시작)의 학번을 출력하세요.
\`K\` 가 음수면 **뒤에서부터** 셉니다 (\`-1\` = 마지막).

## 입력
- 첫 줄: 정수 \`N\`
- 둘째 줄: \`N\`개의 학번 (공백 구분)
- 셋째 줄: 정수 \`K\`

## 출력
K번째 자리 학번

## 예시

**입력**
\`\`\`
5
20101 20102 20103 20104 20105
2
\`\`\`

**출력**
\`\`\`
20103
\`\`\`

## 💡 힌트
- \`nums[k]\` 한 줄로 끝납니다
- 음수 인덱스도 그대로 작동`,
    starterCode: `n = int(input())

# ── 다음 한 줄은 "한 줄에 N개의 정수가 공백으로" 들어올 때 쓰는 입력 패턴이에요 ──
#   input()           : 한 줄을 문자열로 받음 (예: "20101 20102 20103")
#   .split()          : 공백 기준으로 잘라 문자열 리스트로 만듦 (예: ['20101', '20102', '20103'])
#   map(int, ...)     : 위 리스트의 모든 조각을 int 로 변환
#   list(...)         : map 결과를 리스트로 모음
nums = list(map(int, input().split()))

k = int(input())

# nums의 k번째 값을 출력하세요
`,
    testCases: [
      {input: '5\n20101 20102 20103 20104 20105\n2', expectedOutput: '20103', isHidden: false},
      {input: '5\n10 20 30 40 50\n0', expectedOutput: '10', isHidden: false},
      {input: '4\n100 200 300 400\n-1', expectedOutput: '400', isHidden: false},
      {input: '7\n11 22 33 44 55 66 77\n5', expectedOutput: '66', isHidden: true},
      {input: '6\n1 2 3 4 5 6\n-3', expectedOutput: '4', isHidden: true},
      {input: '1\n42\n0', expectedOutput: '42', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  8. 구간 점수 합 — 슬라이싱 + sum
  // ═══════════════════════════════════════
  {
    title: '📏 구간 점수 합',
    description: `## 문제
학생 \`N\` 명의 점수가 있어요. 인덱스 \`a\` 부터 \`b\` 직전까지의 점수 **합**을 출력하세요.
(\`b\` 번째는 포함되지 않습니다!)

## 입력
- 첫 줄: 정수 \`N\`
- 둘째 줄: \`N\`개의 정수
- 셋째 줄: 정수 \`a\`, \`b\` (공백 구분, 0 ≤ a ≤ b ≤ N)

## 출력
\`scores[a:b]\` 의 합

## 예시

**입력**
\`\`\`
6
10 20 30 40 50 60
1 4
\`\`\`

**출력**
\`\`\`
90
\`\`\`
> \`scores[1:4]\` = \`[20, 30, 40]\` → 합 = 90 (4번 자리 50은 미포함!)

## 💡 힌트
- 슬라이싱 결과에 \`sum()\``,
    starterCode: `n = int(input())

# ── "한 줄에 N개 정수" 입력 패턴 ──
#   input().split() 으로 공백 기준 분리 → map(int, ...) 으로 정수 변환 → list() 로 리스트화
scores = list(map(int, input().split()))

# ── "한 줄에 두 정수 a, b" 입력 패턴 ──
#   split() 결과 두 조각을 map(int, ...) 으로 변환 후 a, b 두 변수에 동시 할당
a, b = map(int, input().split())

# scores[a:b] 의 합을 출력하세요
`,
    testCases: [
      {input: '6\n10 20 30 40 50 60\n1 4', expectedOutput: '90', isHidden: false},
      {input: '5\n1 2 3 4 5\n0 5', expectedOutput: '15', isHidden: false},
      {input: '5\n10 20 30 40 50\n2 4', expectedOutput: '70', isHidden: false},
      {input: '7\n5 5 5 5 5 5 5\n0 4', expectedOutput: '20', isHidden: true},
      {input: '5\n1 1 1 1 1\n2 2', expectedOutput: '0', isHidden: true},
      {input: '4\n100 200 300 400\n0 4', expectedOutput: '1000', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  9. 점수 추가하고 평균 — append + sum/len
  // ═══════════════════════════════════════
  {
    title: '➕ 점수 추가하고 평균',
    description: `## 문제
**빈 리스트** 에 점수 \`N\` 개를 한 줄씩 받아 \`.append()\` 로 모으세요.
다 모은 뒤 **최고 점수**와 **평균**을 출력하세요.

## 입력
- 첫 줄: 정수 \`N\`
- 다음 \`N\` 줄: 각 줄에 점수 하나

## 출력
- 첫 줄: 최고 점수
- 둘째 줄: 평균 (소수점 둘째 자리, 예: \`85.00\`)

## 예시

**입력**
\`\`\`
5
80
90
75
88
92
\`\`\`

**출력**
\`\`\`
92
85.00
\`\`\`

## 💡 힌트
- 빈 리스트는 \`scores = []\`
- 반복 안에서 \`scores.append(int(input()))\`
- 최고점 \`max(scores)\`, 평균 \`sum(scores)/len(scores)\``,
    starterCode: `n = int(input())
scores = []

# for 반복으로 N번 입력받아 scores 에 append 하기

# 최고점, 평균 출력
`,
    testCases: [
      {input: '5\n80\n90\n75\n88\n92', expectedOutput: '92\n85.00', isHidden: false},
      {input: '3\n100\n100\n100', expectedOutput: '100\n100.00', isHidden: false},
      {input: '4\n70\n80\n90\n100', expectedOutput: '100\n85.00', isHidden: false},
      {input: '1\n50', expectedOutput: '50\n50.00', isHidden: true},
      {input: '6\n10\n50\n30\n20\n40\n60', expectedOutput: '60\n35.00', isHidden: true},
      {input: '5\n0\n0\n0\n0\n100', expectedOutput: '100\n20.00', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  10. 가장 잘한 학생은? — max + index
  // ═══════════════════════════════════════
  {
    title: '🏆 가장 잘한 학생은?',
    description: `## 문제
학생 \`N\` 명의 점수가 있어요. **최고 점수의 인덱스(자리)와 점수**를 두 줄로 출력하세요.
같은 점수가 여러 명이면 가장 앞 자리.

## 입력
- 첫 줄: 정수 \`N\`
- 둘째 줄: \`N\`개의 점수 (공백 구분)

## 출력
- 첫 줄: 최고점인 학생의 인덱스 (0부터)
- 둘째 줄: 그 점수

## 예시

**입력**
\`\`\`
5
80 92 75 88 90
\`\`\`

**출력**
\`\`\`
1
92
\`\`\`

## 💡 힌트
- 가장 큰 값: \`max(scores)\`
- 그 값의 첫 위치: \`scores.index(max(scores))\``,
    starterCode: `n = int(input())

# ── "한 줄에 N개 정수" 입력 패턴 ──
#   input().split() 으로 공백 기준 분리 → map(int, ...) 으로 정수 변환 → list() 로 리스트화
scores = list(map(int, input().split()))

# 최고점의 인덱스와 점수를 두 줄로 출력하세요
`,
    testCases: [
      {input: '5\n80 92 75 88 90', expectedOutput: '1\n92', isHidden: false},
      {input: '4\n100 100 80 90', expectedOutput: '0\n100', isHidden: false},
      {input: '3\n50 60 70', expectedOutput: '2\n70', isHidden: false},
      {input: '6\n55 77 88 88 66 33', expectedOutput: '2\n88', isHidden: true},
      {input: '1\n42', expectedOutput: '0\n42', isHidden: true},
      {input: '5\n0 0 0 0 1', expectedOutput: '4\n1', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  11. 우리 반 성적표 — 2차원 리스트
  // ═══════════════════════════════════════
  {
    title: '📋 우리 반 성적표',
    description: `## 문제
학생 \`N\` 명의 국·영·수 점수가 한 줄씩 주어져요.
**0번 학생의 평균**을 출력하세요. (소수점 둘째 자리)

## 입력
- 첫 줄: 정수 \`N\` (학생 수)
- 다음 \`N\` 줄: 각 줄에 세 정수 (국어, 영어, 수학)

## 출력
0번 학생의 평균

## 예시

**입력**
\`\`\`
3
85 90 95
70 75 80
60 65 70
\`\`\`

**출력**
\`\`\`
90.00
\`\`\`
> 0번 학생: (85+90+95)/3 = 90.0

## 💡 힌트
- \`grades[0]\` 자체가 1차원 리스트 → \`sum(grades[0])/len(grades[0])\``,
    starterCode: `n = int(input())
grades = []

for i in range(n):
    # ── "한 줄에 세 정수가 공백으로" 들어올 때 쓰는 입력 패턴 ──
    #   input().split() 으로 공백 분리 → map(int, ...) 으로 정수 변환 → list() 로 리스트화
    #   그 결과 [국어, 영어, 수학] 한 행이 row 에 담김
    row = list(map(int, input().split()))
    grades.append(row)

# 0번 학생 (grades[0]) 의 평균을 출력하세요
`,
    testCases: [
      {input: '3\n85 90 95\n70 75 80\n60 65 70', expectedOutput: '90.00', isHidden: false},
      {input: '2\n100 100 100\n50 50 50', expectedOutput: '100.00', isHidden: false},
      {input: '3\n70 80 90\n100 100 100\n0 0 0', expectedOutput: '80.00', isHidden: false},
      {input: '1\n50 60 70', expectedOutput: '60.00', isHidden: true},
      {input: '4\n90 90 90\n0 0 0\n0 0 0\n0 0 0', expectedOutput: '90.00', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  12. 합격/불합격 — if/else
  // ═══════════════════════════════════════
  {
    title: '✅ 합격/불합격',
    description: `## 문제
점수가 60점 **이상**이면 \`합격\`, 아니면 \`불합격\` 을 출력하세요.

## 입력
- 한 줄: 정수 점수 (0 ~ 100)

## 출력
- \`합격\` 또는 \`불합격\`

## 예시

**입력**: \`75\` → **출력**: \`합격\`
**입력**: \`45\` → **출력**: \`불합격\`

## 💡 힌트
- \`if score >= 60:\` (60도 합격이므로 \`>=\`)`,
    starterCode: `score = int(input())

# 60점 이상이면 '합격', 아니면 '불합격'
`,
    testCases: [
      {input: '75', expectedOutput: '합격', isHidden: false},
      {input: '45', expectedOutput: '불합격', isHidden: false},
      {input: '60', expectedOutput: '합격', isHidden: false},
      {input: '59', expectedOutput: '불합격', isHidden: true},
      {input: '100', expectedOutput: '합격', isHidden: true},
      {input: '0', expectedOutput: '불합격', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  13. 점수 등급 매기기 — if/elif/else
  // ═══════════════════════════════════════
  {
    title: '🏅 점수 등급 매기기',
    description: `## 문제
점수에 따라 등급을 출력하세요.
- 90점 이상: \`A\`
- 80점 이상: \`B\`
- 70점 이상: \`C\`
- 60점 이상: \`D\`
- 그 외: \`F\`

## 입력
- 한 줄: 정수 점수 (0 ~ 100)

## 출력
- 등급 한 글자

## 예시

**입력**: \`85\` → **출력**: \`B\`

## 💡 힌트
- 위에서부터 검사: \`if score >= 90: ... elif score >= 80: ...\`
- \`else:\` 는 60 미만 (F)`,
    starterCode: `score = int(input())

# 점수에 따라 A/B/C/D/F 출력
`,
    testCases: [
      {input: '95', expectedOutput: 'A', isHidden: false},
      {input: '85', expectedOutput: 'B', isHidden: false},
      {input: '60', expectedOutput: 'D', isHidden: false},
      {input: '100', expectedOutput: 'A', isHidden: true},
      {input: '59', expectedOutput: 'F', isHidden: true},
      {input: '70', expectedOutput: 'C', isHidden: true},
      {input: '0', expectedOutput: 'F', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  14. 윤년 판별기 — and / or
  // ═══════════════════════════════════════
  {
    title: '📅 윤년 판별기',
    description: `## 문제
연도를 입력받아 **윤년**이면 \`윤년\`, 아니면 \`평년\`을 출력하세요.
윤년 규칙: **4의 배수이면서 100의 배수가 아니거나**, **400의 배수**

## 입력
- 한 줄: 연도 (정수)

## 출력
- \`윤년\` 또는 \`평년\`

## 예시

**입력**: \`2024\` → **출력**: \`윤년\`
**입력**: \`2023\` → **출력**: \`평년\`
**입력**: \`2000\` → **출력**: \`윤년\` (400의 배수)
**입력**: \`1900\` → **출력**: \`평년\` (100의 배수지만 400의 배수 아님)

## 💡 힌트
- 윤년 조건 (한 줄로): \`(year % 4 == 0 and year % 100 != 0) or year % 400 == 0\``,
    starterCode: `year = int(input())

# 윤년이면 '윤년', 아니면 '평년'
`,
    testCases: [
      {input: '2024', expectedOutput: '윤년', isHidden: false},
      {input: '2023', expectedOutput: '평년', isHidden: false},
      {input: '2000', expectedOutput: '윤년', isHidden: false},
      {input: '1900', expectedOutput: '평년', isHidden: false},
      {input: '2020', expectedOutput: '윤년', isHidden: true},
      {input: '2100', expectedOutput: '평년', isHidden: true},
      {input: '2400', expectedOutput: '윤년', isHidden: true},
      {input: '2021', expectedOutput: '평년', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  15. 1부터 N까지 합 — for + range + 누적
  // ═══════════════════════════════════════
  {
    title: '➕ 1부터 N까지 합',
    description: `## 문제
정수 \`N\` 을 입력받아 **1부터 N까지의 합**을 출력하세요.

## 입력
- 한 줄: 정수 \`N\` (1 ≤ N ≤ 10000)

## 출력
- 합

## 예시

**입력**: \`10\` → **출력**: \`55\`
**입력**: \`100\` → **출력**: \`5050\`

## 💡 힌트
- \`range(1, n+1)\` 이면 1부터 n까지 (n+1은 미포함)
- 누적 변수 \`total\` 은 반복문 **바깥** 에서 0으로 초기화`,
    starterCode: `n = int(input())
total = 0

# for + range 로 1부터 n까지 더하기

print(total)
`,
    testCases: [
      {input: '10', expectedOutput: '55', isHidden: false},
      {input: '100', expectedOutput: '5050', isHidden: false},
      {input: '1', expectedOutput: '1', isHidden: false},
      {input: '50', expectedOutput: '1275', isHidden: true},
      {input: '1000', expectedOutput: '500500', isHidden: true},
      {input: '5', expectedOutput: '15', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  16. 구구단 한 단 — for + range
  // ═══════════════════════════════════════
  {
    title: '✖️ 구구단 한 단',
    description: `## 문제
단을 입력받아 그 단의 구구단 9줄을 출력하세요.
출력 형식: \`단 x i = 결과\`

## 입력
- 한 줄: 단 (2 ~ 9)

## 출력
- 9줄

## 예시

**입력**: \`3\`

**출력**
\`\`\`
3 x 1 = 3
3 x 2 = 6
3 x 3 = 9
3 x 4 = 12
3 x 5 = 15
3 x 6 = 18
3 x 7 = 21
3 x 8 = 24
3 x 9 = 27
\`\`\`

## 💡 힌트
- \`print(dan, 'x', i, '=', dan * i)\` 형태`,
    starterCode: `dan = int(input())

# 1~9 까지 반복하면서 dan 의 구구단 출력
`,
    testCases: [
      {input: '3', expectedOutput: '3 x 1 = 3\n3 x 2 = 6\n3 x 3 = 9\n3 x 4 = 12\n3 x 5 = 15\n3 x 6 = 18\n3 x 7 = 21\n3 x 8 = 24\n3 x 9 = 27', isHidden: false},
      {input: '2', expectedOutput: '2 x 1 = 2\n2 x 2 = 4\n2 x 3 = 6\n2 x 4 = 8\n2 x 5 = 10\n2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18', isHidden: false},
      {input: '9', expectedOutput: '9 x 1 = 9\n9 x 2 = 18\n9 x 3 = 27\n9 x 4 = 36\n9 x 5 = 45\n9 x 6 = 54\n9 x 7 = 63\n9 x 8 = 72\n9 x 9 = 81', isHidden: true},
      {input: '5', expectedOutput: '5 x 1 = 5\n5 x 2 = 10\n5 x 3 = 15\n5 x 4 = 20\n5 x 5 = 25\n5 x 6 = 30\n5 x 7 = 35\n5 x 8 = 40\n5 x 9 = 45', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  17. 카운트다운 — while
  // ═══════════════════════════════════════
  {
    title: '⏳ 카운트다운',
    description: `## 문제
정수 \`N\` 을 입력받아 \`N\`부터 1까지 차례로 한 줄씩 출력하고, 마지막에 \`발사!\` 를 출력하세요.

## 입력
- 한 줄: 정수 \`N\` (1 ≤ N ≤ 100)

## 출력
- \`N\`줄: N, N-1, ..., 1 (각 줄에 한 숫자)
- 마지막 줄: \`발사!\`

## 예시

**입력**: \`3\`

**출력**
\`\`\`
3
2
1
발사!
\`\`\`

## 💡 힌트
- \`while n > 0:\` 안에서 \`print(n)\` 하고 \`n = n - 1\`
- 반복 끝나면 \`print('발사!')\``,
    starterCode: `n = int(input())

# while 로 n부터 1까지 출력, 마지막에 '발사!'
`,
    testCases: [
      {input: '3', expectedOutput: '3\n2\n1\n발사!', isHidden: false},
      {input: '1', expectedOutput: '1\n발사!', isHidden: false},
      {input: '5', expectedOutput: '5\n4\n3\n2\n1\n발사!', isHidden: true},
      {input: '10', expectedOutput: '10\n9\n8\n7\n6\n5\n4\n3\n2\n1\n발사!', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  18. 최댓값 직접 찾기 — for + 비교
  // ═══════════════════════════════════════
  {
    title: '🥇 최댓값 직접 찾기',
    description: `## 문제
\`N\` 개의 정수가 주어집니다. **\`max()\` 함수를 쓰지 않고** \`for\` 반복으로 최댓값을 찾아 출력하세요.

## 입력
- 첫 줄: 정수 \`N\`
- 둘째 줄: \`N\`개의 정수 (공백 구분)

## 출력
- 최댓값

## 예시

**입력**
\`\`\`
5
3 1 4 1 5
\`\`\`

**출력**
\`\`\`
5
\`\`\`

## 💡 힌트
- \`best = nums[0]\` (첫 값으로 시작)
- \`for n in nums:\` 안에서 \`if n > best: best = n\``,
    starterCode: `n = int(input())

# ── "한 줄에 N개 정수" 입력 패턴 ──
#   input().split() 으로 공백 분리 → map(int, ...) 으로 정수 변환 → list() 로 리스트화
nums = list(map(int, input().split()))

# max() 함수를 쓰지 않고 for 반복으로 가장 큰 값을 찾으세요
# 힌트: 첫 값을 일단 best 라고 두고, 더 큰 값이 나오면 갱신
`,
    testCases: [
      {input: '5\n3 1 4 1 5', expectedOutput: '5', isHidden: false},
      {input: '4\n100 50 80 90', expectedOutput: '100', isHidden: false},
      {input: '1\n42', expectedOutput: '42', isHidden: false},
      {input: '6\n-3 -7 -1 -5 -2 -4', expectedOutput: '-1', isHidden: true},
      {input: '5\n7 7 7 7 7', expectedOutput: '7', isHidden: true},
      {input: '3\n0 0 1', expectedOutput: '1', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  19. 합격자만 골라내기 — for + if + 카운트
  // ═══════════════════════════════════════
  {
    title: '🎯 합격자만 골라내기',
    description: `## 문제
\`N\` 명의 점수가 주어져요. **60점 이상**인 학생들의 점수만 입력 순서대로 한 줄씩 출력하고,
마지막 줄에 **합격자 수**를 출력하세요.

## 입력
- 첫 줄: 정수 \`N\`
- 둘째 줄: \`N\`개의 점수 (공백 구분)

## 출력
- 합격자 점수를 입력 순서대로 한 줄씩 출력 (합격자가 0명이면 아무 줄도 출력 안 함)
- 마지막 줄: 합격자 수

## 예시

**입력**
\`\`\`
5
55 80 30 92 60
\`\`\`

**출력**
\`\`\`
80
92
60
3
\`\`\`

**입력 (합격자 0명)**
\`\`\`
3
50 40 30
\`\`\`

**출력**
\`\`\`
0
\`\`\`

## 💡 힌트
- 한 줄씩 출력: \`print(점수)\` 만 하면 자동 줄바꿈
- 카운트: \`count = count + 1\` 또는 \`count += 1\`
- 합격자가 0명이면 점수 출력은 한 줄도 안 나오고 \`0\` 만 마지막에 출력됨`,
    starterCode: `n = int(input())

# ── "한 줄에 N개 점수" 입력 패턴 ──
#   input().split() 으로 공백 분리 → map(int, ...) 으로 정수 변환 → list() 로 리스트화
scores = list(map(int, input().split()))

count = 0

# for + if 로 점수를 하나씩 살펴보세요
# 60점 이상이면:
#   1) 그 점수를 한 줄로 print
#   2) count 를 1 증가

# 마지막에 합격자 수(count) 출력
print(count)
`,
    testCases: [
      {input: '5\n55 80 30 92 60', expectedOutput: '80\n92\n60\n3', isHidden: false},
      {input: '4\n100 90 80 70', expectedOutput: '100\n90\n80\n70\n4', isHidden: false},
      {input: '3\n50 40 30', expectedOutput: '0', isHidden: false},
      {input: '1\n60', expectedOutput: '60\n1', isHidden: true},
      {input: '6\n59 60 70 100 0 80', expectedOutput: '60\n70\n100\n80\n4', isHidden: true},
      {input: '2\n100 100', expectedOutput: '100\n100\n2', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  20. 성적 종합 분석 — 2차원 + for + if + 통계
  // ═══════════════════════════════════════
  {
    title: '📈 성적 종합 분석',
    description: `## 문제
학생 \`N\` 명의 국어·영어·수학 점수가 주어져요. 다음을 차례로 출력하세요.
1. 첫 줄: **반 평균** (세 과목 모두 합쳐서 평균, 소수점 둘째 자리)
2. 둘째 줄: **합격자(평균 60 이상) 수** (각 학생의 세 과목 평균 기준)
3. 셋째 줄: **반 최고점 학생의 인덱스와 그 학생의 세 과목 합** (공백 구분)

## 입력
- 첫 줄: 정수 \`N\` (학생 수, 1 ≤ N ≤ 50)
- 다음 \`N\` 줄: 각 줄에 세 정수 (국어 영어 수학)

## 출력
- 3줄 (위 순서대로)

## 예시

**입력**
\`\`\`
3
80 90 70
50 50 50
100 100 100
\`\`\`

**출력**
\`\`\`
73.33
2
2 300
\`\`\`
> 반 평균 = (80+90+70+50+50+50+100+100+100) / 9 = 73.33
> 합격자: 0번(평균 80), 2번(평균 100) → 2명
> 최고점: 2번 학생, 합 300

## 💡 힌트
- 반 평균: 모든 학생의 모든 점수 합 / (N × 3)
- 합격자 수: \`for row in grades:\` 안에서 \`if sum(row)/3 >= 60: count += 1\`
- 최고점: 각 학생의 \`sum(row)\` 중 최댓값. 인덱스는 첫 등장 위치`,
    starterCode: `n = int(input())
grades = []

for i in range(n):
    # ── "한 줄에 세 정수가 공백으로" 들어올 때 쓰는 입력 패턴 ──
    #   input().split() 으로 공백 분리 → map(int, ...) 으로 정수 변환 → list() 로 리스트화
    #   결과 [국어, 영어, 수학] 한 행이 row 에 담깁니다
    row = list(map(int, input().split()))
    grades.append(row)

# 1) 반 평균 (모든 점수 다 더해 / 전체 개수)
# 2) 평균 60 이상 학생 수 (각 학생의 sum(row)/3)
# 3) 가장 합이 큰 학생의 인덱스와 그 합
`,
    testCases: [
      {input: '3\n80 90 70\n50 50 50\n100 100 100', expectedOutput: '73.33\n2\n2 300', isHidden: false},
      {input: '2\n100 100 100\n0 0 0', expectedOutput: '50.00\n1\n0 300', isHidden: false},
      {input: '1\n70 80 90', expectedOutput: '80.00\n1\n0 240', isHidden: false},
      {input: '4\n60 60 60\n90 90 90\n30 40 50\n80 70 60', expectedOutput: '65.00\n3\n1 270', isHidden: true},
      {input: '2\n50 60 70\n70 60 50', expectedOutput: '60.00\n2\n0 180', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  21. 카페 주문 계산기 — 현실 맥락 종합
  // ═══════════════════════════════════════
  {
    title: '🛒 카페 주문 계산기',
    description: `## 🎬 상황
친구들과 카페에 가서 음료 여러 잔을 주문해요.
회원이면 총액의 **5% 할인**, 비회원이면 정가.
원 단위는 버리고(절삭) 최종 결제액을 출력해 봅시다.

## 입력
- 첫 줄: 정수 \`N\` (주문한 잔 수, 1 ≤ N ≤ 20)
- 다음 \`N\` 줄: 각 줄에 한 잔의 가격 (정수 원)
- 마지막 줄: \`1\` (회원) 또는 \`0\` (비회원)

## 출력
- 한 줄: 최종 결제액 (정수, 원 단위 절삭)

## 예시

**입력**
\`\`\`
3
4500
3000
5000
1
\`\`\`

**출력**
\`\`\`
11875
\`\`\`
> 총액 = 12500원 → 회원 5% 할인 → 11875원

## 💡 힌트
- 총액: \`total = sum(prices)\`
- 회원 할인: \`if is_member == 1: total = total * 0.95\`
- 원 단위 절삭(소수점 버리기): \`int(total)\``,
    starterCode: `n = int(input())
prices = []
for i in range(n):
    prices.append(int(input()))
is_member = int(input())

# 1) 총액 구하기 (sum 또는 for 누적)
# 2) 회원(1)이면 5% 할인 — total * 0.95
# 3) 원 단위 절삭 → int() 로 변환 후 출력
`,
    testCases: [
      {input: '3\n4500\n3000\n5000\n1', expectedOutput: '11875', isHidden: false},
      {input: '2\n3000\n4500\n0', expectedOutput: '7500', isHidden: false},
      {input: '1\n1000\n1', expectedOutput: '950', isHidden: false},
      {input: '5\n2000\n2000\n2000\n2000\n2000\n1', expectedOutput: '9500', isHidden: true},
      {input: '4\n3500\n2500\n4000\n5500\n0', expectedOutput: '15500', isHidden: true},
      {input: '1\n100\n1', expectedOutput: '95', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  22. 영화관 좌석 예약 현황 — 2차원 + for + 카운트
  // ═══════════════════════════════════════
  {
    title: '🎬 영화관 좌석 예약 현황',
    description: `## 🎬 상황
영화 예매 사이트에서 좌석표를 봤어요. 빈 자리(\`0\`)와 예약된 자리(\`1\`)가 격자로 표시돼요.
좌석표를 분석해 (1) 전체 빈 자리 수, (2) 가장 비어 있는 행을 찾아 봅시다.

## 입력
- 첫 줄: 정수 \`R C\` (행 수, 열 수, 공백 구분)
- 다음 \`R\` 줄: 각 줄에 \`C\`개의 정수 (\`0\` 또는 \`1\`, 공백 구분)

## 출력
- 첫 줄: 전체 빈 자리 수
- 둘째 줄: **가장 비어 있는 행 번호(0부터)** 와 **그 행의 빈자리 수** (공백 구분)
  - 같으면 더 앞의 행

## 예시

**입력**
\`\`\`
3 5
0 1 0 1 0
1 1 1 1 1
0 0 0 1 0
\`\`\`

**출력**
\`\`\`
7
2 4
\`\`\`
> 0번 행: 빈자리 3 / 1번 행: 빈자리 0 / 2번 행: 빈자리 4 → 합 7, 가장 비어 있는 건 2번 행

## 💡 힌트
- 한 행의 빈자리 수: \`row.count(0)\` 또는 \`len(row) - sum(row)\` (1은 예약, 0은 빈)
- 전체 빈자리: 모든 행에 대해 누적
- 가장 비어 있는 행: 첫 행을 best 로 두고 더 빈 행 나오면 갱신`,
    starterCode: `# ── 첫 줄에 두 정수 R, C 가 공백으로 들어와요 ──
#   split() 결과 두 조각을 map(int, ...) 으로 변환 후 r, c 두 변수에 동시 할당
r, c = map(int, input().split())

seats = []
for i in range(r):
    # ── "한 줄에 C개 0/1 이 공백으로" 들어오는 입력 패턴 ──
    #   split() 으로 분리 → map(int, ...) 으로 정수 변환 → list() 로 리스트화
    row = list(map(int, input().split()))
    seats.append(row)

# 1) 전체 빈 자리 수 (모든 행의 0 개수 합)
# 2) 가장 비어 있는 행 번호 + 그 행 빈자리 수
`,
    testCases: [
      {input: '3 5\n0 1 0 1 0\n1 1 1 1 1\n0 0 0 1 0', expectedOutput: '7\n2 4', isHidden: false},
      {input: '2 3\n0 0 0\n0 0 0', expectedOutput: '6\n0 3', isHidden: false},
      {input: '1 4\n1 1 1 1', expectedOutput: '0\n0 0', isHidden: false},
      {input: '4 4\n0 0 0 0\n1 1 1 1\n0 1 0 1\n1 1 0 0', expectedOutput: '8\n0 4', isHidden: true},
      {input: '2 2\n0 1\n1 0', expectedOutput: '2\n0 1', isHidden: true},
      {input: '3 3\n1 1 1\n1 1 1\n1 1 1', expectedOutput: '0\n0 0', isHidden: true}
    ]
  },

  // ═══════════════════════════════════════
  //  23. 한 달 운동 기록 분석 — 리스트 + 통계 + 조건
  // ═══════════════════════════════════════
  {
    title: '🏃 한 달 운동 기록 분석',
    description: `## 🎬 상황
운동 앱이 N일치 운동 시간(분 단위)을 기록해 줬어요.
이 데이터를 분석해 평균·최고 기록일·목표 미달일 수를 출력해 봅시다.
(하루 목표: **30분**)

## 입력
- 첫 줄: 정수 \`N\` (1 ≤ N ≤ 31)
- 둘째 줄: \`N\` 개의 정수 (각 날의 운동 시간, 0 이상, 공백 구분)

## 출력
- 첫 줄: 평균 운동 시간 (소수점 둘째 자리, 예: \`30.50\`)
- 둘째 줄: 가장 많이 운동한 시간 (분)
- 셋째 줄: 목표(30분) **미달**인 날의 수 (30분 정확히 한 날은 포함하지 않음)

## 예시

**입력**
\`\`\`
7
30 45 0 60 20 30 25
\`\`\`

**출력**
\`\`\`
30.00
60
3
\`\`\`
> 평균 = 210/7 = 30.0, 최대 = 60, 미달일 = 0, 20, 25 → 3일 (30분은 미달 아님)

## 💡 힌트
- 평균: \`sum(times) / len(times)\` → \`f"{평균:.2f}"\`
- 최대: \`max(times)\`
- 미달일 카운트: for + if 로 \`< 30\` 인 날 세기`,
    starterCode: `n = int(input())

# ── "한 줄에 N개 정수가 공백으로" 들어오는 입력 패턴 ──
#   input().split() 으로 공백 분리 → map(int, ...) 으로 정수 변환 → list() 로 리스트화
times = list(map(int, input().split()))

# 1) 평균 (sum/len, 소수점 둘째 자리)
# 2) 최댓값 (max 또는 for 로 직접)
# 3) 목표 미달일 수 — for + if 로 30 미만인 날 세기
`,
    testCases: [
      {input: '7\n30 45 0 60 20 30 25', expectedOutput: '30.00\n60\n3', isHidden: false},
      {input: '5\n30 30 30 30 30', expectedOutput: '30.00\n30\n0', isHidden: false},
      {input: '3\n10 20 0', expectedOutput: '10.00\n20\n3', isHidden: false},
      {input: '4\n60 60 60 60', expectedOutput: '60.00\n60\n0', isHidden: true},
      {input: '5\n29 30 31 0 100', expectedOutput: '38.00\n100\n2', isHidden: true},
      {input: '1\n50', expectedOutput: '50.00\n50\n0', isHidden: true}
    ]
  }

];
