# 초이스골프 국내골프 견적시스템

## 배포 방법 (Vercel + GitHub)

### 1. GitHub 저장소 생성
1. https://github.com/new 에서 새 저장소 생성
   - 이름: `domestic-golf` (원하는 이름)
   - Private 선택
2. 이 폴더의 파일들을 모두 업로드

### 2. Vercel 배포
1. https://vercel.com 로그인
2. "Add New Project" 클릭
3. 위에서 만든 GitHub 저장소 Import
4. Framework: Vite 자동 감지됨
5. "Deploy" 클릭
6. 완료되면 `domestic-golf-xxxx.vercel.app` 주소 생성

### 3. 커스텀 도메인 (선택)
- Vercel 프로젝트 Settings → Domains에서 원하는 도메인 연결 가능

## 업데이트 방법
GitHub에 파일을 수정하면 Vercel이 자동으로 재배포합니다.
→ 같은 URL로 접속하면 업데이트된 버전이 바로 보입니다.

### 간편 업데이트 순서:
1. GitHub 저장소에서 `src/App.jsx` 파일 클릭
2. 연필 아이콘 (Edit) 클릭
3. 내용 수정 후 "Commit changes" 클릭
4. 1~2분 후 자동 배포 완료

## 비밀번호
현재: `0090`
변경: `src/App.jsx` 파일 상단의 `const PW = "0090";` 부분 수정

## 데이터 저장
- localStorage 사용 (브라우저별 개별 저장)
- 요금 관리에서 수정한 내용은 해당 브라우저에만 저장됩니다
