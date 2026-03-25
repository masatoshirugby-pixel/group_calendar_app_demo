"""
asobisystem 系グループのスケジュールページをスクレイピングして返す。
cutiestreet / candytune / sweetsteady は X タイムラインも取得してマージする。
DB 不要・オンデマンド取得。
"""
import re
from datetime import datetime, timezone
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from x_fetcher import fetch_tweets
from tweet_classifier import classify_tweet
from date_extractor import extract_event_date

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

# 対応グループ（サブドメイン → 表示名）
KNOWN_GROUPS: list[dict] = [
    {"slug": "cutiestreet",   "name": "CUTIE STREET"},
    {"slug": "candytune",     "name": "CANDY TUNE"},
    {"slug": "sweetsteady",   "name": "SWEET STEADY"},
    {"slug": "wasuta",        "name": "わーすた"},
    {"slug": "ukka",          "name": "ukka"},
    {"slug": "bromance",      "name": "BROMAnce"},
    {"slug": "ocha-norma",    "name": "OCHA NORMA"},
    {"slug": "fruits-zipper", "name": "FRUITS ZIPPER"},
    {"slug": "poipoipoizon",  "name": "ぽいずん"},
]

# X アカウント対応表（slug → X username）
_X_ACCOUNTS: dict[str, str] = {
    "cutiestreet": "CUTIE_STREET_",
    "candytune":   "CANDY_TUNE_",
    "sweetsteady": "SWEET_STEADY",
}

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

    # EVENT
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


def _fetch_web(url: str, base_url: str) -> list[dict]:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except Exception:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []
    seen: set[str] = set()

    year_m = re.search(r"year=(\d{4})", url)
    month_m = re.search(r"month=(\d{2})", url)
    now = datetime.now(timezone.utc)
    year = int(year_m.group(1)) if year_m else now.year
    month = int(month_m.group(1)) if month_m else now.month

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not _SCHEDULE_DETAIL_RE.search(href):
            continue
        post_text = a.get_text(separator=" ", strip=True)
        if not post_text or not _DATE_VAL_RE.search(post_text):
            continue
        full_url = urljoin(base_url, href)
        if full_url in seen:
            continue
        seen.add(full_url)

        category = _judge_category(post_text)
        if category is None:
            continue

        event_date = _parse_event_date(post_text, year, month)
        results.append({
            "post_id": full_url,
            "post_text": post_text,
            "post_url": full_url,
            "category": category,
            "event_date": event_date,
            "source": "web",
        })

    return results


def _fetch_x_events(slug: str, web_events: list[dict]) -> list[dict]:
    """X タイムラインを取得し、Webと重複しないイベントのみ返す。"""
    username = _X_ACCOUNTS.get(slug)
    if not username:
        return []

    tweets = fetch_tweets(username, days=60, max_results=50)
    if not tweets:
        return []

    # Web イベントの（category, event_date）セットを重複チェック用に作成
    web_keys: set[tuple[str, str]] = set()
    for ev in web_events:
        if ev["event_date"]:
            web_keys.add((ev["category"], ev["event_date"]))

    results = []
    for tweet in tweets:
        category = classify_tweet(tweet["post_text"])
        if category is None:
            continue

        event_date = extract_event_date(tweet["post_text"])

        # Web と同一（カテゴリ＋日付）なら重複スキップ
        if event_date and (category, event_date) in web_keys:
            continue

        results.append({
            "post_id": tweet["post_id"],
            "post_text": tweet["post_text"],
            "post_url": tweet["post_url"],
            "category": category,
            "event_date": event_date,
            "source": "x",
        })

    return results


def fetch_schedule(group_slug: str) -> list[dict]:
    """
    指定グループのスケジュール（今月 + 翌月）を取得して返す。
    cutiestreet / candytune / sweetsteady は X も取得してマージ。
    """
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

    this_month_url = f"{list_url}?viewMode=default&year={now.year}&month={now.month:02d}"
    next_month_url = f"{list_url}?viewMode=default&year={next_year}&month={next_month:02d}"

    web_events: list[dict] = []
    seen_ids: set[str] = set()

    for url in [this_month_url, next_month_url]:
        for ev in _fetch_web(url, base_url):
            if ev["post_id"] not in seen_ids:
                seen_ids.add(ev["post_id"])
                web_events.append(ev)

    # X イベントをマージ（対象グループのみ）
    x_events = _fetch_x_events(group_slug, web_events)

    return web_events + x_events
