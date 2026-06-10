# Apps in Toss Launch Assets

앱인토스 콘솔 등록/출시 준비용 이미지입니다.

## 필수

- `app-logo-600.png`: 앱 로고, 600 x 600 PNG, 배경색 포함
- `app-thumbnail-1932x828.png`: 썸네일 이미지, 1932 x 828 PNG

## 선택

- `screenshot-01-home-636x1048.png`: 세로형 스크린샷 1, 636 x 1048 PNG
- `screenshot-02-add-636x1048.png`: 세로형 스크린샷 2, 636 x 1048 PNG
- `screenshot-03-study-636x1048.png`: 세로형 스크린샷 3, 636 x 1048 PNG
- `og-image-1200x600.png`: 공유 링크용 OG 이미지, 1200 x 600 PNG

## 다시 생성하기

```bash
/Users/yerim/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 tools/generate_ait_assets.py
```

로고를 앱인토스 콘솔에 업로드한 뒤 발급/복사한 이미지 URL을 `webview/granite.config.ts`의 `brand.icon`에 넣어 주세요.
