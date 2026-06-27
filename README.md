# 영어 커뮤니티 웹사이트

영어 문장 암기 기능을 포함한 커뮤니티 웹사이트입니다. 자유게시판, 모여라 게시판, 오늘의 표현, 추천 영어 사이트를 제공합니다.

## 실행

API 서버:

```bash
cd ocr-server
npm install
npm start
```

웹:

```bash
npm install
npm run dev
```

기본 웹 주소는 `http://localhost:5173`, API 주소는 `http://localhost:8787`입니다.
API 주소를 바꾸려면 웹 빌드/실행 시 `VITE_API_BASE_URL`을 지정하세요.

## 빌드

```bash
npm run build
```

## 주요 기능

- 자유게시판과 모여라 게시판은 서버 SQLite DB에 저장됩니다.
- 로그인 없이 작성자명과 글 비밀번호로 글을 작성하고, 같은 비밀번호로 수정/삭제합니다.
- 문장암기 데이터는 브라우저 `localStorage`에 저장됩니다.
- 추천 사이트와 오늘의 표현은 API 서버의 초기 시드 데이터로 제공됩니다.
