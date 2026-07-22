# LUNAMO CRM 데스크톱 위젯

CRM에 접속하지 않아도 바탕화면·메뉴바에서 경고등을 상시 확인합니다.
두 위젯은 서로 독립적이라 하나만 써도 되고, 나중에 한쪽만 삭제해도 됩니다.

## 공통 준비
- API: `/api/widget-stats?token=<WIDGET_TOKEN>` (Vercel 환경변수 `WIDGET_TOKEN`)
- 5분마다 자동 갱신, 집계 숫자만 반환 (개인정보 없음)

## 1. Übersicht (바탕화면)
```bash
brew install --cask ubersicht
```
`lunamo-dashboard.jsx`의 `__WIDGET_TOKEN__`을 실제 토큰으로 바꿔
`~/Library/Application Support/Übersicht/widgets/` 에 복사한 뒤 Übersicht 실행.

- 위치 조정: 파일 내 `className`의 `top`/`right` 값 수정
- 갱신 주기: `refreshFrequency` (밀리초)
- 삭제: 위 폴더에서 파일 제거

## 2. SwiftBar (메뉴바)
```bash
brew install --cask swiftbar
```
`lunamo.5m.sh`의 `__WIDGET_TOKEN__`을 실제 토큰으로 바꿔
SwiftBar 플러그인 폴더에 복사 후 `chmod +x`.

- 갱신 주기: 파일명의 `5m` 부분 (`1m`, `10m` 등)
- 삭제: 플러그인 폴더에서 파일 제거

## 토큰 재발급
```bash
openssl rand -hex 24        # 새 토큰 생성
vercel env rm WIDGET_TOKEN production
printf '%s' "<새토큰>" | vercel env add WIDGET_TOKEN production
```
재발급 후 두 위젯 파일의 토큰도 함께 교체할 것.
