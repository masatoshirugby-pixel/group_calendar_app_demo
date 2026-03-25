"""
ツイートテキストからイベント日付を抽出するユーティリティ。
event_utils.py (cutieStreet_app) から必要部分を移植。
"""
import re
from datetime import date, datetime, timezone

_DATE_PATTERNS: list[tuple[re.Pattern, bool]] = [
    (re.compile(r"(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日"), True),
    (re.compile(r"(\d{4})/\s*(\d{1,2})/\s*(\d{1,2})"), True),
    (re.compile(r"(\d{4})\.(\d{1,2})\.(\d{1,2})"), True),
    (re.compile(r"(\d{1,2})月\s*(\d{1,2})日"), False),
    (re.compile(r"(?<!\d)(\d{1,2})\s*/\s*(\d{1,2})(?!\d)"), False),
]

_EVENT_DATE_CONTEXT_KEYWORDS = re.compile(
    r"(開催日程|開催日時|開催日|実施日時|実施日|日時|日程|開演日)\s*[：:：\s]?\s*"
)
_CONTEXT_WINDOW = 60


def _try_parse(year: int, month: int, day: int) -> date | None:
    today = datetime.now(timezone.utc).date()
    try:
        d = date(year, month, day)
        if (today - d).days > 365 * 5:
            return None
        return d
    except ValueError:
        return None


def _extract_dates(text: str) -> list[date]:
    today = datetime.now(timezone.utc).date()
    results: list[date] = []
    for pat, has_year in _DATE_PATTERNS:
        for m in pat.finditer(text):
            try:
                if has_year:
                    year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
                else:
                    month, day = int(m.group(1)), int(m.group(2))
                    year = today.year
                    if (today - date(year, month, day)).days > 90:
                        year += 1
                d = _try_parse(year, month, day)
                if d and d not in results:
                    results.append(d)
            except ValueError:
                pass
    return sorted(results)


def extract_event_date(text: str) -> str | None:
    """イベント日付をISO文字列(YYYY-MM-DD)で返す。見つからない場合はNone。"""
    today = datetime.now(timezone.utc).date()

    # 開催日程・日時などのキーワード周辺から優先抽出
    for kw_match in _EVENT_DATE_CONTEXT_KEYWORDS.finditer(text):
        window = text[kw_match.end(): kw_match.end() + _CONTEXT_WINDOW]
        for pat, has_year in _DATE_PATTERNS:
            m = pat.search(window)
            if not m:
                continue
            try:
                if has_year:
                    year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
                else:
                    month, day = int(m.group(1)), int(m.group(2))
                    year = today.year
                    if (today - date(year, month, day)).days > 90:
                        year += 1
                d = _try_parse(year, month, day)
                if d:
                    return d.isoformat()
            except ValueError:
                pass

    # 冒頭200文字から
    head = _extract_dates(text[:200])
    if head:
        return head[0].isoformat()

    # 全文から
    all_dates = _extract_dates(text)
    return all_dates[0].isoformat() if all_dates else None
