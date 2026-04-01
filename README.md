# 📂 학급 파일함 — 설치 가이드

학생들이 로그인 없이 게시판에 파일을 올리고, 선생님은 로그인 후 모든 게시물을 관리할 수 있는 시스템입니다.

---

## 🗂 전체 흐름

```
Firebase 프로젝트 생성 → index.html에 설정값 입력 → GitHub에 올리기 → Pages 활성화
```

전체 소요 시간: 약 **15~20분**

---

## 1단계. Firebase 프로젝트 만들기

1. [https://console.firebase.google.com](https://console.firebase.google.com) 접속 (Google 계정 로그인)
2. **프로젝트 추가** 클릭
3. 프로젝트 이름 입력 → 계속
4. Google 애널리틱스 **사용 안 함** 선택 → 프로젝트 만들기

---

## 2단계. Realtime Database 만들기

1. 왼쪽 메뉴 **빌드 → Realtime Database** 클릭
2. **데이터베이스 만들기** 클릭
3. 위치: **asia-southeast1 (싱가포르)** 선택
4. 보안 규칙: **테스트 모드에서 시작** → 사용 설정

### 보안 규칙 변경 (중요!)

데이터베이스 생성 후 **규칙** 탭에서 아래 내용으로 교체 후 **게시**:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

---

## 3단계. Storage 만들기

1. 왼쪽 메뉴 **빌드 → Storage** 클릭
2. **시작하기** 클릭
3. 보안 규칙: **테스트 모드에서 시작** → 다음
4. 위치: **asia-southeast1** → 완료

### Storage 보안 규칙 변경

**규칙** 탭에서 아래 내용으로 교체 후 **게시**:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

---

## 4단계. 설정값(config) 복사하기

1. Firebase 콘솔 왼쪽 상단 **⚙️ 프로젝트 설정** 클릭
2. **일반** 탭 → 아래로 스크롤 → **내 앱** 섹션
3. 앱이 없으면 **웹 앱 추가** 클릭 (`</>` 아이콘)
   - 앱 닉네임 입력 → **앱 등록**
4. 화면에 표시되는 `firebaseConfig` 값들을 복사해둡니다

---

## 5단계. index.html 수정

`index.html` 파일 상단의 `FIREBASE_CONFIG` 부분을 찾아 복사한 값으로 교체:

```js
const FIREBASE_CONFIG = {
  apiKey:            "복사한 apiKey",
  authDomain:        "복사한 authDomain",
  databaseURL:       "복사한 databaseURL",
  projectId:         "복사한 projectId",
  storageBucket:     "복사한 storageBucket",
  messagingSenderId: "복사한 messagingSenderId",
  appId:             "복사한 appId"
};
```

---

## 6단계. GitHub에 올리기

### 방법 A — GitHub 웹사이트에서 직접 올리기 (쉬움)

1. [https://github.com](https://github.com) 로그인
2. 오른쪽 상단 **+** → **New repository**
3. Repository name 입력
4. **Public** 선택 → **Create repository**
5. **uploading an existing file** 링크 클릭
6. `index.html` 파일을 드래그&드롭
7. **Commit changes** 클릭

### 방법 B — git 명령어

```bash
git init
git add index.html
git commit -m "학급 파일함 초기 설정"
git remote add origin https://github.com/아이디/레포이름.git
git push -u origin main
```

---

## 7단계. GitHub Pages 활성화

1. GitHub 레포지토리 → **Settings** 탭
2. 왼쪽 메뉴 **Pages** 클릭
3. **Source**: `Deploy from a branch`
4. **Branch**: `main` / `(root)` 선택 → **Save**
5. 1~2분 후 아래 주소로 접속 가능:

```
https://아이디.github.io/레포이름/
```

이 주소를 학생들에게 공유하면 됩니다! 🎉

---

## 🔐 선생님 첫 로그인

1. 사이트 접속 → 우측 상단 **선생님 로그인** 클릭
2. 처음에는 **비밀번호 설정 화면**이 나옵니다
3. 원하는 비밀번호를 설정하면 즉시 로그인

---

## 📋 기능 요약

| 대상 | 기능 |
|------|------|
| **학생** | 게시판에서 이름·제목·비밀번호·파일을 입력해 게시물 올리기 |
| **학생** | 게시물 클릭 → 비밀번호 입력 → 파일 다운로드 |
| **학생** | 선생님이 공유한 파일 로그인 없이 다운로드 |
| **선생님** | 로그인 후 모든 게시물 비밀번호 없이 열람·다운로드 |
| **선생님** | 학생 게시물의 비밀번호 초기화 (직접 설정 또는 0000으로) |
| **선생님** | 게시물 삭제, 파일 공유·관리 |

---

## 💡 자주 묻는 질문

**Q. 학생이 비밀번호를 잊어버렸어요.**
A. 선생님이 로그인 후 해당 게시물에서 비밀번호를 초기화할 수 있습니다.

**Q. 파일 크기 제한이 있나요?**
A. 파일 1개당 최대 50MB입니다. Firebase Storage 무료 플랜 기준 총 5GB.

**Q. Firebase 무료 한도는 얼마나 되나요?**
A. 무료(Spark 플랜): 저장 5GB, 다운로드 1GB/일. 50명 학급 기준 충분합니다.

---

## ⚠️ 주의사항

- 이 시스템은 **학교 내부 용도**로 설계됐습니다
- Firebase 보안 규칙이 공개 설정이므로 **민감한 개인정보 파일**은 올리지 마세요
- 학생 비밀번호는 SHA-256으로 암호화 저장되어 원문은 확인할 수 없습니다
