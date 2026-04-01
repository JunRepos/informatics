# 📂 학급 파일함 — 설치 가이드

학생들이 로그인 없이 파일을 다운로드하고, 비밀번호를 설정해 과제를 제출할 수 있는 시스템입니다.

---

## 🗂 전체 흐름

```
Firebase 프로젝트 생성 → index.html에 설정값 복사 → GitHub에 올리기 → Pages 활성화
```

전체 소요 시간: 약 **15~20분**

---

## 1단계. Firebase 프로젝트 만들기

1. [https://console.firebase.google.com](https://console.firebase.google.com) 접속 (Google 계정 로그인)
2. **프로젝트 추가** 클릭
3. 프로젝트 이름 입력 (예: `my-class-files`) → 계속
4. Google 애널리틱스는 **사용 안 함** 선택 → 프로젝트 만들기

---

## 2단계. Realtime Database 만들기

1. 왼쪽 메뉴에서 **빌드 → Realtime Database** 클릭
2. **데이터베이스 만들기** 클릭
3. 위치: **asia-southeast1 (싱가포르)** 또는 원하는 위치 선택
4. 보안 규칙: **테스트 모드에서 시작** 선택 → 사용 설정

### 보안 규칙 변경 (중요!)

데이터베이스가 생성되면 **규칙** 탭을 클릭하고 아래로 교체:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

→ **게시** 클릭

---

## 3단계. Storage 만들기

1. 왼쪽 메뉴에서 **빌드 → Storage** 클릭
2. **시작하기** 클릭
3. 보안 규칙: **테스트 모드에서 시작** → 다음
4. 위치: **asia-southeast1** → 완료

### Storage 보안 규칙 변경

**규칙** 탭에서 아래로 교체:

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

→ **게시** 클릭

---

## 4단계. 설정값(config) 복사하기

1. Firebase 콘솔 왼쪽 상단 **⚙️ 프로젝트 설정** 클릭
2. **일반** 탭 → 아래로 스크롤 → **내 앱** 섹션
3. 앱이 없으면 **웹 앱 추가** 클릭 (`</>`  아이콘)
   - 앱 닉네임 입력 (아무거나) → **앱 등록**
4. 아래 코드가 보입니다:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "my-class-files.firebaseapp.com",
  databaseURL: "https://my-class-files-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "my-class-files",
  storageBucket: "my-class-files.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123...:web:abc..."
};
```

---

## 5단계. index.html 수정

`index.html` 파일을 열고, 상단의 `FIREBASE_CONFIG` 부분을 찾아 **위 값들을 복사해 붙여넣기**:

```html
<!-- ★★★ 아래 FIREBASE_CONFIG를 채워주세요 ★★★ -->
<script>
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",           ← 복사한 값
  authDomain:        "my-class-files.firebaseapp.com",
  databaseURL:       "https://my-class-files-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "my-class-files",
  storageBucket:     "my-class-files.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123...:web:abc..."
};
</script>
```

---

## 6단계. GitHub에 올리기

### 방법 A — GitHub 웹사이트에서 직접 올리기 (쉬움)

1. [https://github.com](https://github.com) 로그인
2. 오른쪽 상단 **+** → **New repository**
3. Repository name: `class-files` (아무 이름)
4. **Public** 선택 (Pages 무료 사용을 위해)
5. **Create repository** 클릭
6. **uploading an existing file** 링크 클릭
7. `index.html` 파일을 드래그&드롭
8. **Commit changes** 클릭

### 방법 B — git 명령어 (터미널 사용 가능한 경우)

```bash
git init
git add index.html
git commit -m "학급 파일함 초기 설정"
git remote add origin https://github.com/아이디/class-files.git
git push -u origin main
```

---

## 7단계. GitHub Pages 활성화

1. GitHub 레포지토리 → **Settings** 탭
2. 왼쪽 메뉴 **Pages** 클릭
3. **Source**: `Deploy from a branch`
4. **Branch**: `main` / `(root)` 선택 → **Save**
5. 1~2분 후 상단에 주소가 표시됩니다:

```
https://아이디.github.io/class-files/
```

이 주소를 학생들에게 공유하면 됩니다! 🎉

---

## 🔐 선생님 첫 로그인

1. 사이트 접속 → **선생님 로그인** 클릭
2. 처음에는 **비밀번호 설정 화면**이 나옵니다
3. 원하는 비밀번호를 설정하면 즉시 로그인

---

## 📋 사용 방법 요약

| 대상 | 기능 | 방법 |
|------|------|------|
| **선생님** | 파일 공유 | 로그인 → "파일 올리기" 탭 |
| **선생님** | 학생 제출물 확인 | 로그인 → "학생 제출물" 탭 → 학생이 알려준 비밀번호 입력 |
| **학생** | 파일 다운로드 | 사이트 접속 → "선생님 파일" 탭 (로그인 불필요) |
| **학생** | 과제 제출 | "과제 제출" 탭 → 이름, 비밀번호, 파일 선택 → 제출 |

---

## 💡 자주 묻는 질문

**Q. 학생이 설정한 비밀번호를 잃어버렸어요.**  
A. 파일 자체를 삭제하고 재제출 요청해야 합니다. 비밀번호는 암호화되어 저장되므로 복구 불가.

**Q. 파일 크기 제한이 있나요?**  
A. 파일 1개당 최대 50MB입니다. Firebase Storage 무료 플랜 총 5GB.

**Q. Firebase 무료 한도가 얼마나 되나요?**  
A. 무료(Spark 플랜): 저장 5GB, 다운로드 1GB/일. 50명 학급 기준 수년간 무료로 충분합니다.

**Q. 주소가 너무 길어요.**  
A. [https://bitly.com](https://bitly.com) 같은 단축 URL 서비스를 사용하거나, 커스텀 도메인을 GitHub Pages에 연결할 수 있습니다.

---

## ⚠️ 주의사항

- 이 시스템은 **학교 내부 용도**로 설계되었습니다
- Firebase 보안 규칙이 공개 설정이므로, **민감한 개인정보 파일**은 올리지 마세요
- 학생 비밀번호는 SHA-256 해시로 저장되어 실제 비밀번호는 볼 수 없습니다
