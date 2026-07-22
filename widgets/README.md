# LUNAMO CRM 데스크톱 위젯

CRM에 접속하지 않아도 바탕화면·메뉴바에서 경고등을 상시 확인합니다.
두 위젯은 서로 독립적이라 하나만 써도 되고, 나중에 한쪽만 삭제해도 됩니다.

## 구성
| 파일 | 역할 |
|---|---|
| `lunamo-fetch.sh` | 공용 데이터 페치. **매일 오전 9시 / 오후 9시**에만 서버를 호출하고 그 외에는 캐시를 반환 |
| `lunamo-dashboard.jsx` | Übersicht 바탕화면 위젯 |
| `lunamo.10m.sh` | SwiftBar 메뉴바 위젯 |

설치 시 세 파일 모두 `__WIDGET_TOKEN__`을 실제 `WIDGET_TOKEN` 값으로 치환해야 합니다.

- API: `/api/widget-stats?token=<WIDGET_TOKEN>` (집계 숫자만 반환, 개인정보 없음)
- 위젯이 10분마다 실행되지만 실제 서버 호출은 하루 2회 (슬롯 캐시)

## 1. Übersicht (바탕화면)
```bash
brew install --cask ubersicht
```
`lunamo-fetch.sh` → `~/Library/Application Support/lunamo-widget/` (실행권한 부여)
`lunamo-dashboard.jsx` → `~/Library/Application Support/Übersicht/widgets/`

### 위치 이동 (드래그 불가, 좌표 지정 방식)
`lunamo-dashboard.jsx` 상단의 `PLACE` 값만 바꾸고 저장하면 즉시 반영됩니다.

```js
const PLACE = 'left-center'   // 아래 6개 중 선택
const MARGIN = 40             // 화면 가장자리 여백(px)
const WIDTH = 300             // 위젯 너비(px)
```
선택지: `top-left` `top-right` `bottom-left` `bottom-right` `left-center` `right-center`

- 삭제: `~/Library/Application Support/Übersicht/widgets/` 에서 파일 제거

## 2. SwiftBar (메뉴바)
```bash
brew install --cask swiftbar
```
`lunamo.10m.sh` → SwiftBar 플러그인 폴더에 복사 후 `chmod +x`

- 드롭다운의 "지금 새로고침"으로 즉시 갱신 가능
- 삭제: 플러그인 폴더에서 파일 제거

## 갱신 시각 변경
`lunamo-fetch.sh`의 슬롯 판정 부분(`-ge 21`, `-ge 9`)에서 시각을 바꿉니다.

## 토큰 재발급
```bash
openssl rand -hex 24
vercel env rm WIDGET_TOKEN production
printf '%s' "<새토큰>" | vercel env add WIDGET_TOKEN production
```
재발급 후 설치된 `lunamo-fetch.sh`의 토큰도 함께 교체할 것.
