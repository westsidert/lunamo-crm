#!/bin/bash
# LUNAMO 위젯 공용 데이터 페치
# 매일 오전 9시 / 오후 9시 슬롯이 바뀔 때만 API를 호출하고, 그 외에는 캐시를 반환한다.
# (위젯은 자주 실행되지만 실제 서버 호출은 하루 2회)
# 인자로 --force 를 주면 슬롯과 무관하게 즉시 갱신.

BASE="https://lunamo-crm.vercel.app"
TOKEN="__WIDGET_TOKEN__"

DIR="$HOME/Library/Application Support/lunamo-widget"
CACHE="$DIR/stats.json"
SLOTF="$DIR/slot"
mkdir -p "$DIR"

# 현재 시각이 속한 슬롯: 09:00~20:59 = 당일 AM, 21:00~23:59 = 당일 PM, 00:00~08:59 = 전일 PM
H=$(date +%H)
if [ "$H" -ge 21 ]; then
  SLOT="$(date +%Y%m%d)-PM"
elif [ "$H" -ge 9 ]; then
  SLOT="$(date +%Y%m%d)-AM"
else
  SLOT="$(date -v-1d +%Y%m%d)-PM"
fi

PREV=$(cat "$SLOTF" 2>/dev/null)
NEED_FETCH=0
[ "$1" = "--force" ] && NEED_FETCH=1
[ "$SLOT" != "$PREV" ] && NEED_FETCH=1
[ ! -s "$CACHE" ] && NEED_FETCH=1

if [ "$NEED_FETCH" = "1" ]; then
  OUT=$(curl -s --max-time 15 "$BASE/api/widget-stats?token=$TOKEN")
  if [ -n "$OUT" ] && ! printf '%s' "$OUT" | grep -q '"error"'; then
    printf '%s' "$OUT" > "$CACHE"
    printf '%s' "$SLOT" > "$SLOTF"
  elif [ ! -s "$CACHE" ]; then
    # 캐시도 없고 호출도 실패 - 오류를 그대로 전달
    printf '%s' "${OUT:-{\"error\":\"연결 실패\"\}}"
    exit 0
  fi
fi

cat "$CACHE" 2>/dev/null
