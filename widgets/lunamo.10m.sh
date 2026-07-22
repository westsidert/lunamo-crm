#!/bin/bash
# LUNAMO CRM 메뉴바 위젯 (SwiftBar)
# 설치: 이 파일을 SwiftBar 플러그인 폴더에 복사 후 chmod +x
# 파일명의 5m = 5분마다 갱신
#
# <bitbar.title>LUNAMO CRM</bitbar.title>
# <bitbar.version>v1.0</bitbar.version>
# <bitbar.author>lunamo</bitbar.author>
# <bitbar.desc>영상 프로덕션 CRM 경고등 요약</bitbar.desc>

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

BASE="https://lunamo-crm.vercel.app"
FETCH="$HOME/Library/Application Support/lunamo-widget/lunamo-fetch.sh"

# 강제 새로고침 (드롭다운의 '지금 새로고침' 클릭 시)
if [ "$1" = "force" ]; then
  bash "$FETCH" --force >/dev/null 2>&1
  exit 0
fi

# 데이터는 lunamo-fetch.sh가 관리 (매일 오전 9시 / 오후 9시에만 서버 호출)
JSON=$(bash "$FETCH" 2>/dev/null)
SELF="${SWIFTBAR_PLUGIN_PATH:-$0}"

if [ -z "$JSON" ] || echo "$JSON" | grep -q '"error"'; then
  echo "LUNAMO ⚠️"
  echo "---"
  echo "연결 실패 | color=red"
  echo "CRM 열기 | href=$BASE"
  exit 0
fi

# jq 없이 python3으로 파싱 (macOS 기본 탑재)
python3 - "$JSON" "$BASE" "$SELF" <<'PY'
import json, sys

data = json.loads(sys.argv[1])
base = sys.argv[2]
me = sys.argv[3]
m = data["month"]
a = data["alerts"]

def won(n):
    n = int(n or 0)
    if abs(n) >= 100000000:
        return f"{n/100000000:.1f}".rstrip('0').rstrip('.') + "억"
    if abs(n) >= 10000:
        return f"{round(n/10000):,}만"
    return f"{n:,}"

rows = []
rec = a["receivable"]
rows.append(("danger" if rec["count90"] else "warn" if rec["count30"] else "ok",
             "미수금",
             f'{rec["total"]}건 {won(rec["totalAmount"])}' if rec["total"] else "정상"))
tax = a.get("tax")
rows.append(("danger" if tax and tax["daysLeft"] < 0 else "warn" if tax else "ok",
             "원천세 신고",
             (f'{tax["doneCount"]}/4 · ' + ("마감초과" if tax["daysLeft"] < 0 else f'D-{tax["daysLeft"]}')) if tax else "완료"))
ul = a["unpaidLabor"]
rows.append(("warn" if ul["count"] else "ok", "미지급 인건비",
             f'{ul["count"]}건 {won(ul["amount"])}' if ul["count"] else "정상"))
ui = a["unissuedInvoices"]
rows.append(("warn" if ui else "ok", "세금계산서 미발행", f"{ui}건" if ui else "정상"))
pj = a["projects"]
rows.append(("danger" if pj["overdue"] else "warn" if pj["soon"] else "ok", "프로젝트 마감",
             f'지연 {pj["overdue"]}건' if pj["overdue"] else (f'7일내 {pj["soon"]}건' if pj["soon"] else "정상")))
sq = a["sentQuotes"]
rows.append(("info" if sq["count"] else "ok", "발송 견적 대기",
             f'{sq["count"]}건 {won(sq["amount"])}' if sq["count"] else "없음"))

alerts = [r for r in rows if r[0] in ("danger", "warn")]
icon = {"danger": "🔴", "warn": "🟠", "info": "🔵", "ok": "🟢"}

# 메뉴바 타이틀: 경고 있으면 개수, 없으면 이번달 매출
if alerts:
    print(f"🎬 {len(alerts)}")
else:
    print(f"🎬 {won(m['sales'])}")

print("---")
print(f"{m['month']}월 매출 {won(m['sales'])} · 순이익 {won(m['profit'])} | size=13")
print("---")
for state, label, value in rows:
    color = "" if state == "ok" else " color=#f8fafc"
    print(f"{icon[state]} {label}: {value} | size=13{color} href={base}")
print("---")
print(f"CRM 대시보드 열기 | href={base}")
print("---")
print("매일 9시 / 21시 자동 갱신 | size=11 color=#94a3b8")
print(f"지금 새로고침 | bash={me} param1=force terminal=false refresh=true")
PY
