"""
X (Twitter) API v2 でツイートを取得するモジュール。
x_fetcher.py (cutieStreet_app) を DB なし・デモ用に簡略化。
"""
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import tweepy

BEARER_TOKEN = os.getenv("X_BEARER_TOKEN", "")

_client: Optional[tweepy.Client] = None
_user_id_cache: dict[str, str] = {}


def _get_client() -> tweepy.Client:
    global _client
    if _client is None:
        _client = tweepy.Client(bearer_token=BEARER_TOKEN, wait_on_rate_limit=False)
    return _client


def _get_user_id(username: str) -> Optional[str]:
    if username in _user_id_cache:
        return _user_id_cache[username]
    try:
        resp = _get_client().get_user(username=username)
        if resp.data:
            _user_id_cache[username] = str(resp.data.id)
            return _user_id_cache[username]
    except tweepy.errors.TweepyException:
        pass
    return None


def _extract_image_url(resp, tweet) -> Optional[str]:
    try:
        if not hasattr(tweet, "attachments") or not tweet.attachments:
            return None
        media_keys = tweet.attachments.get("media_keys", [])
        if not media_keys or not resp.includes or "media" not in resp.includes:
            return None
        media_map = {m.media_key: m for m in resp.includes["media"]}
        media = media_map.get(media_keys[0])
        if not media:
            return None
        return getattr(media, "url", None) or getattr(media, "preview_image_url", None)
    except Exception:
        return None


def fetch_tweets(username: str, days: int = 60, max_results: int = 50) -> list[dict]:
    """
    指定アカウントの直近ツイートを取得して返す（RTと返信を除く）。
    days: 何日前まで遡るか
    max_results: 最大取得件数（5〜100）
    """
    if not BEARER_TOKEN:
        return []

    user_id = _get_user_id(username)
    if not user_id:
        return []

    start_time = datetime.now(timezone.utc) - timedelta(days=days)

    try:
        resp = _get_client().get_users_tweets(
            id=user_id,
            max_results=max(5, min(max_results, 100)),
            start_time=start_time,
            tweet_fields=["created_at", "text", "attachments"],
            media_fields=["url", "preview_image_url"],
            expansions=["attachments.media_keys"],
            exclude=["retweets", "replies"],
        )
    except tweepy.errors.TooManyRequests:
        return []
    except tweepy.errors.TweepyException:
        return []

    if not resp.data:
        return []

    results = []
    for tweet in resp.data:
        image_url = _extract_image_url(resp, tweet)
        results.append({
            "post_id": str(tweet.id),
            "post_text": tweet.text,
            "post_url": f"https://x.com/{username}/status/{tweet.id}",
            "image_url": image_url,
        })
    return results
