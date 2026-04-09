"""
パイプライン制御・定期実行ループ。
cutieStreet_app/scheduler.py を全グループ対応に汎用化。
"""
import asyncio
import logging
import re
from datetime import datetime, timezone, timedelta

import db
import x_fetcher
import web_fetcher
import event_classifier
from event_utils import extract_event_date, extract_deadline_date, extract_deadline_dates, extract_venue, is_duplicate
from models import EventRecord, JudgementResult
from groups_config import GROUPS

logger = logging.getLogger(__name__)

FETCH_HOUR = 13  # 毎日 13:00 UTC（22:00 JST）に取得

_last_pipeline_run: str | None = None


def get_last_run_time() -> str | None:
    return _last_pipeline_run


def _record_run_time() -> None:
    global _last_pipeline_run
    _last_pipeline_run = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

# -----------------------------------------------------------------------
# スケジュールページ用カテゴリ判定
# -----------------------------------------------------------------------

_SCHED_TYPE_RE = re.compile(r'\[[A-Z]{2,3}\]\s+(LIVE|EVENT|TV|RADIO|VIDEO)', re.IGNORECASE)


def _judge_schedule(post_text: str) -> JudgementResult | None:
    m = _SCHED_TYPE_RE.search(post_text)
    type_str = m.group(1).upper() if m else "EVENT"

    if type_str == "VIDEO":
        return None

    if type_str == "LIVE":
        if any(kw in post_text for kw in ["ワンマン", "単独公演", "単独ライブ"]):
            return JudgementResult(is_event=True, category="単独ライブ")
        if any(kw in post_text for kw in ["フェス", "フェスティバル", "festival"]):
            return JudgementResult(is_event=True, category="フェス出演")
        if any(kw in post_text for kw in ["対バン", "合同ライブ", "合同公演", "合同イベント"]):
            return JudgementResult(is_event=True, category="合同ライブ")
        return JudgementResult(is_event=True, category="ライブ")

    if type_str == "TV":
        # [TV]タグでも雑誌掲載キーワードがあれば雑誌掲載に優先分類
        if any(kw in post_text for kw in ["雑誌", "掲載", "グラビア", "表紙", "誌面"]):
            return JudgementResult(is_event=True, category="雑誌掲載")
        return JudgementResult(is_event=True, category="テレビ出演")
    if type_str == "RADIO":
        return JudgementResult(is_event=True, category="ラジオ出演")

    if "大特典会" in post_text:
        return JudgementResult(is_event=True, category="大特典会")
    if any(kw in post_text for kw in ["一番くじ", "いちばんくじ", "生誕くじ", "一番賞"]):
        return JudgementResult(is_event=True, category="一番くじ")
    if any(kw in post_text for kw in ["オンラインサイン会", "オンラインサイン"]):
        return JudgementResult(is_event=True, category="オンラインサイン会")
    if any(kw in post_text for kw in ["リリースイベント", "リリイベ", "発売記念", "インストア"]):
        return JudgementResult(is_event=True, category="リリースイベント")
    if any(kw in post_text for kw in ["特典会", "チェキ", "お渡し", "ハイタッチ", "サイン会", "握手会"]):
        return JudgementResult(is_event=True, category="特典会")
    if any(kw.lower() in post_text.lower() for kw in ["フェス", "フェスティバル", "festival"]):
        return JudgementResult(is_event=True, category="フェス出演")

    return JudgementResult(is_event=True, category="その他イベント")


# -----------------------------------------------------------------------
# 締切レコード補完
# -----------------------------------------------------------------------

def _ensure_deadline_record(tweet, account: str, source: str) -> None:
    entries = extract_deadline_dates(tweet.post_text)
    if not entries:
        return
    event_date = extract_event_date(tweet.post_text)
    if source == "x":
        post_url = f"https://x.com/{account}/status/{tweet.post_id}"
    elif tweet.post_id.startswith("https://"):
        post_url = tweet.post_id
    else:
        post_url = ""
    for idx, (label, deadline_date) in enumerate(entries):
        if event_date and deadline_date >= event_date:
            continue
        if deadline_date == event_date:
            continue
        suffix = "_deadline" if idx == 0 else f"_deadline_{idx}"
        deadline_id = f"{tweet.post_id}{suffix}"
        if db.is_post_exists(deadline_id):
            continue
        deadline_record = EventRecord(
            post_id=deadline_id,
            post_text=tweet.post_text,
            post_url=post_url,
            posted_at=tweet.posted_at,
            is_event=True,
            account=account,
            category="申込締切",
            event_date=deadline_date.isoformat(),
            venue=label,
            image_url=None,
            source=source,
            created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        )
        if db.save_event(deadline_record):
            logger.info(f"[{source}:{account}] 申込締切補完: {deadline_id} label={label} deadline={deadline_date}")


# -----------------------------------------------------------------------
# 共通: TweetData → 判定 → DB保存
# -----------------------------------------------------------------------

def _save_tweet_data(tweets, account: str, source: str) -> int:
    existing_records = db.get_recent_events_for_dedup(account=account, limit=100)
    saved = 0

    for tweet in tweets:
        if db.is_post_exists(tweet.post_id):
            _ensure_deadline_record(tweet, account, source)
            continue

        if source == "web":
            judgement = _judge_schedule(tweet.post_text)
            if judgement is None:
                continue
        else:
            judgement = event_classifier.judge_tweet(tweet.post_text)
            if not judgement.is_event:
                continue

        event_date = extract_event_date(tweet.post_text)
        event_date_str = event_date.isoformat() if event_date else None
        venue = extract_venue(tweet.post_text)

        # Webソース: 過去イベントを再挿入しない（expiry削除後の再スクレイプで誤NEW防止）
        if source == "web" and event_date and event_date < datetime.now(timezone.utc).date():
            logger.debug(f"[web:{account}] 過去イベントをスキップ: {tweet.post_id} event_date={event_date}")
            continue

        if source != "web" and is_duplicate(
            new_text=tweet.post_text,
            new_category=judgement.category,
            new_event_date=event_date,
            existing_records=existing_records,
        ):
            logger.info(f"[{source}:{account}] 重複スキップ: {tweet.post_id}")
            continue

        if source == "x":
            post_url = f"https://x.com/{account}/status/{tweet.post_id}"
        elif source in ("web", "news") and tweet.post_id.startswith("https://"):
            post_url = tweet.post_id
        else:
            post_url = ""

        record = EventRecord(
            post_id=tweet.post_id,
            post_text=tweet.post_text,
            post_url=post_url,
            posted_at=tweet.posted_at,
            is_event=True,
            account=account,
            category=judgement.category,
            event_date=event_date_str,
            venue=venue,
            image_url=tweet.image_url,
            source=source,
            created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        )

        if db.save_event(record):
            saved += 1
            existing_records.append({
                "post_text": tweet.post_text,
                "category": judgement.category,
                "event_date": event_date_str,
            })
            logger.info(f"[{source}:{account}] 保存: {tweet.post_id} [{judgement.category}] event_date={event_date_str}")

            for idx, (label, deadline_date) in enumerate(extract_deadline_dates(tweet.post_text)):
                if deadline_date == event_date:
                    continue
                if event_date and deadline_date >= event_date:
                    continue
                suffix = "_deadline" if idx == 0 else f"_deadline_{idx}"
                deadline_id = f"{tweet.post_id}{suffix}"
                if not db.is_post_exists(deadline_id):
                    deadline_record = EventRecord(
                        post_id=deadline_id,
                        post_text=tweet.post_text,
                        post_url=post_url,
                        posted_at=tweet.posted_at,
                        is_event=True,
                        account=account,
                        category="申込締切",
                        event_date=deadline_date.isoformat(),
                        venue=label,
                        image_url=None,
                        source=source,
                        created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    )
                    if db.save_event(deadline_record):
                        logger.info(f"[{source}:{account}] 申込締切保存: {deadline_id} label={label} deadline={deadline_date}")

    return saved


# -----------------------------------------------------------------------
# グループ別パイプライン
# -----------------------------------------------------------------------

def run_web_for_group(group: dict) -> int:
    account = group["account"]
    slug = group["slug"]
    pages = web_fetcher.fetch_web_events(slug)
    if not pages:
        return 0
    saved = _save_tweet_data(pages, account, source="web")
    # 今回取得できなくなったイベント（公式サイトから消えたもの）を削除
    current_ids = [p.post_id for p in pages]
    deleted = db.delete_stale_web_events(account, current_ids)
    if deleted:
        logger.info(f"[web:{account}] 旧スケジュールイベント {deleted} 件を削除")
    return saved


def run_x_for_group(
    group: dict,
    start_time: str | None = None,
    end_time: str | None = None,  # テスト用（通常運用では不要）
    max_results: int = 100,
) -> int:
    x_username = group.get("x_username")
    if not x_username:
        return 0
    account = group["account"]

    since_id = db.get_latest_post_id(account) if not start_time else None
    tweets = x_fetcher.fetch_latest_tweets(
        username=x_username,
        since_id=since_id,
        start_time=start_time,
        end_time=end_time,  # テスト用（通常運用では不要）
        max_results=max_results,
    )
    if not tweets:
        logger.info(f"[X:{account}] 新規ツイートなし。スキップ")
        return 0
    return _save_tweet_data(tweets, account, source="x")


# -----------------------------------------------------------------------
# 締切バックフィル
# -----------------------------------------------------------------------

def run_deadline_backfill() -> int:
    import requests
    from bs4 import BeautifulSoup
    from datetime import date as _date

    events = db.get_news_without_deadlines()
    count = 0
    for event in events:
        entries = extract_deadline_dates(event.post_text)
        if not entries and event.source in ("news", "web") and event.post_id.startswith("https://"):
            try:
                resp = requests.get(
                    event.post_id,
                    headers={"User-Agent": "Mozilla/5.0"},
                    timeout=15,
                )
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "html.parser")
                h1 = soup.find("h1")
                title = h1.get_text(strip=True) if h1 else ""
                section = soup.find(class_="section--detail")
                body_text = section.get_text(separator=" ", strip=True) if section else soup.get_text(separator=" ", strip=True)
                full_text = f"{title}\n{body_text}" if title else body_text
                entries = extract_deadline_dates(full_text)
            except Exception as e:
                logger.warning(f"[backfill] 再取得失敗 {event.post_id}: {e}")
        if not entries:
            continue
        event_date_obj = _date.fromisoformat(event.event_date) if event.event_date else None
        post_url = event.post_url or ""
        for idx, (label, deadline_date) in enumerate(entries):
            if event_date_obj and deadline_date >= event_date_obj:
                continue
            suffix = "_deadline" if idx == 0 else f"_deadline_{idx}"
            deadline_id = f"{event.post_id}{suffix}"
            if db.is_post_exists(deadline_id):
                continue
            deadline_record = EventRecord(
                post_id=deadline_id,
                post_text=event.post_text,
                post_url=post_url,
                posted_at=event.posted_at,
                is_event=True,
                account=event.account,
                category="申込締切",
                event_date=deadline_date.isoformat(),
                venue=label,
                image_url=None,
                source=event.source,
                created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            )
            if db.save_event(deadline_record):
                count += 1
                logger.info(f"[backfill] 申込締切補完: {deadline_id} label={label} deadline={deadline_date}")
    logger.info(f"[backfill] 申込締切補完 合計 {count} 件")
    return count


# -----------------------------------------------------------------------
# カテゴリ再分類
# -----------------------------------------------------------------------

def run_reclassify_categories(account: str | None = None) -> dict:
    """
    既存イベントのカテゴリを新しいロジックで再分類して更新する。
    X/web 問わず全ソース対象。申込締切レコードは除外。
    """
    rows = db.get_all_events_for_category_reclassify(account)
    total_checked = len(rows)
    total_updated = 0

    for row in rows:
        post_text = row["post_text"]
        old_category = row["category"]
        source = row["source"]

        if source == "web":
            result = _judge_schedule(post_text)
            new_category = result.category if result else old_category
        else:
            result = event_classifier.judge_tweet(post_text)
            new_category = result.category if result.is_event else old_category

        if new_category == old_category:
            continue

        if db.update_event_category(row["post_id"], new_category):
            total_updated += 1
            logger.info(
                f"[reclassify-category] {row['post_id']}: "
                f"'{old_category}' → '{new_category}'"
            )

    logger.info(f"[reclassify-category] {total_checked} 件確認 / {total_updated} 件更新")
    return {"checked": total_checked, "updated": total_updated}


# -----------------------------------------------------------------------
# 開催日再分類
# -----------------------------------------------------------------------

def run_reclassify(account: str | None = None) -> dict:
    """
    既存のXイベントレコードに対して event_date を再分類し、
    変わったものだけ DB を更新する。
    account を指定すると対象アカウントのみ処理。
    """
    from groups_config import GROUPS as ALL_GROUPS
    targets = [g for g in ALL_GROUPS if not account or g["account"] == account]
    total_checked = 0
    total_updated = 0

    for group in targets:
        rows = db.get_x_events_for_reclassify(group["account"])
        for row in rows:
            total_checked += 1
            new_date = extract_event_date(row["post_text"])
            new_date_str = new_date.isoformat() if new_date else None
            old_date_str = row["event_date"]
            if new_date_str == old_date_str:
                continue
            if db.update_event_date(row["post_id"], new_date_str):
                total_updated += 1
                logger.info(
                    f"[reclassify:{group['account']}] {row['post_id']}: "
                    f"{old_date_str} → {new_date_str}"
                )

    logger.info(f"[reclassify] {total_checked} 件確認 / {total_updated} 件更新")
    return {"checked": total_checked, "updated": total_updated}


# -----------------------------------------------------------------------
# 全体パイプライン
# -----------------------------------------------------------------------

def run_web_pipeline() -> int:
    """Web スクレイピングのみ（X API不使用）。全グループ対象。"""
    total = 0
    for group in GROUPS:
        total += run_web_for_group(group)
    run_deadline_backfill()
    deleted = db.delete_expired_events()
    if deleted:
        logger.info(f"期限切れイベント {deleted} 件を削除しました")
    logger.info(f"[web pipeline] 合計 {total} 件保存")
    _record_run_time()
    return total


def run_pipeline(
    start_time: str | None = None,
    end_time: str | None = None,  # テスト用（通常運用では不要）
    max_results: int = 100,
) -> int:
    """Web + X のフルパイプライン。全グループ対象。"""
    total = 0
    for group in GROUPS:
        total += run_web_for_group(group)
        total += run_x_for_group(group, start_time=start_time, end_time=end_time, max_results=max_results)

    deleted = db.delete_expired_events()
    if deleted:
        logger.info(f"期限切れイベント {deleted} 件を削除しました")

    logger.info(f"パイプライン完了: 合計 {total} 件保存")
    _record_run_time()
    return total


async def run_loop() -> None:
    """起動時はWebのみ、以降は毎日 FETCH_HOUR 時に Web+X を実行するループ"""
    logger.info("起動時Webパイプライン実行開始")
    try:
        await asyncio.to_thread(run_web_pipeline)
    except Exception as e:
        logger.error(f"起動時Webパイプラインエラー: {e}")

    while True:
        now = datetime.now(timezone.utc)
        next_run = now.replace(hour=FETCH_HOUR, minute=0, second=0, microsecond=0)
        if now >= next_run:
            next_run += timedelta(days=1)

        wait_seconds = (next_run - now).total_seconds()
        logger.info(f"次回取得: {next_run.isoformat()} ({wait_seconds:.0f}秒後)")
        await asyncio.sleep(wait_seconds)

        try:
            await asyncio.to_thread(run_pipeline)
        except Exception as e:
            logger.error(f"スケジューラーエラー: {e}")
