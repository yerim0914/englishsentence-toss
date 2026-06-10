# 영어 문장 암기 Apps in Toss WebView

Flutter MVP를 앱인토스 WebView 환경에 맞게 옮긴 웹 버전입니다.

## 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

빌드 결과는 `dist/`에 생성됩니다. 앱인토스 콘솔에는 `granite.config.ts`의 `appName`, `brand.displayName`, `brand.icon`을 콘솔 정보와 맞춘 뒤 업로드하세요.

## 로그인/백업/포인트

홈 화면에 토스 로그인, 문장 백업, 학습별, 토스포인트 리워드 UI가 포함되어 있습니다.

프론트는 앱인토스 `appLogin()`으로 인가 코드를 받은 뒤 `VITE_API_BASE_URL`의 백엔드로 보냅니다. 실제 토큰 발급, 사용자 조회, 문장 저장, 포인트 적립은 서버에서 처리해야 합니다.

```bash
VITE_API_BASE_URL=https://api.example.com npm run dev
```

토스포인트 리워드를 사용하려면 추가 환경 변수가 필요합니다.

```bash
VITE_REWARDED_AD_GROUP_ID=ait.rewarded.example
VITE_FIRST_SENTENCE_PROMOTION_CODE=FIRST_SENTENCE_PROMOTION
VITE_STUDY_10_PROMOTION_CODE=STUDY_10_PROMOTION
```

현재 지급 조건은 다음과 같습니다.

- 토스 로그인 후 문장 1개 이상 저장 시, 광고 시청 완료 후 토스포인트 1원 지급
- 문장 암기 10개 완료마다, 광고 시청 완료 후 토스포인트 1원 지급

앱 내부 누적 보상은 토스포인트와 구분하기 위해 `학습별`로 표기합니다.

필요한 서버 API는 `BACKEND_CONTRACT.md`를 참고하세요.

## Flutter 원본과 달라진 점

- Hive 대신 `localStorage`에 문장을 저장합니다.
- 토스 로그인 후에는 서버 API를 통해 문장 백업을 시도합니다.
- ML Kit 이미지 OCR과 온디바이스 번역은 WebView에서 그대로 사용할 수 없어 제외했습니다.
- 이미지 OCR 결과나 교재 텍스트를 붙여넣으면 기존 `SentenceParser`와 같은 규칙으로 영어 문장을 추출합니다.
- 한국어 뜻은 사용자가 직접 입력합니다.
