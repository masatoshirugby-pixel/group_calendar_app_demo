"""
スケジュールデータをDBから取得して返す。
設定外グループ（直接入力）はWebスクレイピングにフォールバック。
"""
import os
import re
from contextlib import contextmanager
from datetime import datetime, timezone
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

import psycopg2
import psycopg2.extras

from groups_config import GROUPS, KNOWN_GROUPS, get_group

DATABASE_URL = os.getenv("DATABASE_URL", "")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

# -----------------------------------------------------------------------
# DB 取得
# -----------------------------------------------------------------------

@contextmanager
def _get_conn():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        conn.close()


def _fetch_from_db(account: str) -> list[dict]:
    if not DATABASE_URL:
        return []
    now = datetime.now(timezone.utc)
    month_start = f"{now.year}-{now.month:02d}-01"
    try:
        with _get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT post_id, post_text, post_url, category, event_date, image_url, source, posted_at, created_at
                    FROM events
                    WHERE is_event = TRUE
                      AND account = %s
                      AND (event_date >= %s OR event_date IS NULL)
                    ORDER BY event_date ASC NULLS LAST
                    LIMIT 200
                    """,
                    (account, month_start),
                )
                return [dict(row) for row in cur.fetchall()]
    except Exception:
        return []


# -----------------------------------------------------------------------
# Webスクレイピング（設定外グループ用フォールバック）
# -----------------------------------------------------------------------

_DATE_VAL_RE = re.compile(
    r"20\d{2}[-/\.]\d{1,2}[-/\.]\d{1,2}"
    r"|(?<!\d)\d{1,2}[/月]\d{1,2}(?:\(.\))?"
    r"|\d{2}\s+\d{2}\s+\[[A-Z]{2,3}\]"
)
_SCHEDULE_DETAIL_RE = re.compile(r"/(live_information|news)/detail/")
_SCHED_TYPE_RE = re.compile(r"\[[A-Z]{2,3}\]\s+(LIVE|EVENT|TV|RADIO|VIDEO)", re.IGNORECASE)
_DATE_PARSE_RE = re.compile(r"(\d{2})\s+(\d{2})\s+\[[A-Z]{2,3}\]")


def _judge_category(post_text: str) -> str | None:
    m = _SCHED_TYPE_RE.search(post_text)
    type_str = m.group(1).upper() if m else "EVENT"
    if type_str == "VIDEO":
        return None
    if type_str == "LIVE":
        if any(kw in post_text for kw in ["ワンマン", "単独公演", "単独ライブ"]):
            return "単独ライブ"
        if any(kw.lower() in post_text.lower() for kw in ["フェス", "フェスティバル", "festival"]):
            return "フェス出演"
        if any(kw in post_text for kw in ["対バン", "合同ライブ", "合同公演"]):
            return "合同ライブ"
        return "ライブ"
    if type_str == "TV":
        return "テレビ出演"
    if type_str == "RADIO":
        return "ラジオ出演"
    if "大特典会" in post_text:
        return "大特典会"
    if any(kw in post_text for kw in ["オンラインサイン会", "オンラインサイン"]):
        return "オンラインサイン会"
    if any(kw in post_text for kw in ["リリースイベント", "リリイベ", "発売記念", "インストア"]):
        return "リリースイベント"
    if any(kw in post_text for kw in ["特典会", "チェキ", "お渡し", "ハイタッチ", "サイン会"]):
        return "特典会"
    if any(kw.lower() in post_text.lower() for kw in ["フェス", "フェスティバル", "festival"]):
        return "フェス出演"
    return "その他イベント"


def _parse_event_date(post_text: str, year: int, month: int) -> str | None:
    m = _DATE_PARSE_RE.search(post_text)
    if not m:
        return None
    try:
        mm, dd = int(m.group(1)), int(m.group(2))
        return f"{year}-{mm:02d}-{dd:02d}"
    except Exception:
        return None


def _fetch_web_fallback(group_slug: str) -> list[dict]:
    """設定外グループ用: 公式サイトをスクレイピングして返す。"""
    base_url = f"https://{group_slug}.asobisystem.com"
    list_url = f"{base_url}/live_information/schedule/list/"

    try:
        resp = requests.get(list_url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
    except Exception:
        raise ValueError(f"グループ '{group_slug}' のサイトが見つかりません")

    now = datetime.now(timezone.utc)
    if now.month == 12:
        next_year, next_month = now.year + 1, 1
    else:
        next_year, next_month = now.year, now.month + 1

    events: list[dict] = []
    seen_ids: set[str] = set()

    for url in [
        f"{list_url}?viewMode=default&year={now.year}&month={now.month:02d}",
        f"{list_url}?viewMode=default&year={next_year}&month={next_month:02d}",
    ]:
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            resp.raise_for_status()
        except Exception:
            continue
        soup = BeautifulSoup(resp.text, "html.parser")
        year_m = re.search(r"year=(\d{4})", url)
        month_m = re.search(r"month=(\d{2})", url)
        y = int(year_m.group(1)) if year_m else now.year
        mo = int(month_m.group(1)) if month_m else now.month
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not _SCHEDULE_DETAIL_RE.search(href):
                continue
            post_text = a.get_text(separator=" ", strip=True)
            if not post_text or not _DATE_VAL_RE.search(post_text):
                continue
            full_url = urljoin(url, href)
            if full_url in seen_ids:
                continue
            seen_ids.add(full_url)
            category = _judge_category(post_text)
            if category is None:
                continue
            events.append({
                "post_id": full_url,
                "post_text": post_text,
                "post_url": full_url,
                "category": category,
                "event_date": _parse_event_date(post_text, y, mo),
                "image_url": None,
                "source": "web",
                "posted_at": None,
                "created_at": None,
            })

    return events


# -----------------------------------------------------------------------
# 公開 API
# -----------------------------------------------------------------------

def fetch_schedule(group_slug: str) -> list[dict]:
    """指定グループのスケジュールを返す。設定済みグループはDB、未設定はWeb。"""
    group = get_group(group_slug)
    if group:
        return _fetch_from_db(group["account"])
    return _fetch_web_fallback(group_slug)
