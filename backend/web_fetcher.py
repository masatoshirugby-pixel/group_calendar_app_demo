"""
公式サイトのスクレイピングでイベント情報を取得する。
cutieStreet_app の web_fetcher.py を全グループ対応に汎用化。
"""

import logging
import re
from datetime import datetime, timezone
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from models import TweetData

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

_DATE_VAL_RE = re.compile(
    r'20\d{2}[-/\.]\d{1,2}[-/\.]\d{1,2}'
    r'|(?<!\d)\d{1,2}[/月]\d{1,2}(?:\(.\))?'
    r'|\d{2}\s+\d{2}\s+\[[A-Z]{2,3}\]'
)
_SCHEDULE_DETAIL_RE = re.compile(r"/(live_information|news)/detail/")


def _fetch_soup(url: str) -> BeautifulSoup | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        logger.warning(f"ページ取得失敗 {url}: {e}")
        return None


def _next_month_url(base_url: str) -> str:
    now = datetime.now(timezone.utc)
    if now.month == 12:
        year, month = now.year + 1, 1
    else:
        year, month = now.year, now.month + 1
    return f"{base_url}?viewMode=default&year={year}&month={month:02d}"


def fetch_web_events(slug: str) -> list[TweetData]:
    """公式スケジュールページから今月・翌月のイベントを取得する。"""
    base_url = f"https://{slug}.asobisystem.com/live_information/schedule/list/"
    results: list[TweetData] = []
    seen_ids: set[str] = set()

    for url in [base_url, _next_month_url(base_url)]:
        soup = _fetch_soup(url)
        if not soup:
            continue
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
            results.append(TweetData(
                post_id=full_url,
                post_text=post_text,
                posted_at="",  # 公式サイトには投稿日時なし
                image_url=None,
            ))

    logger.info(f"[Web:{slug}] {len(results)} 件取得")
    return results
