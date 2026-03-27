import asyncio
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import db
import scheduler
from fetcher import fetch_schedule
from groups_config import KNOWN_GROUPS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    logger.info("DB 初期化完了")
    task = asyncio.create_task(scheduler.run_loop())
    logger.info("スケジューラー起動")
    yield
    task.cancel()


app = FastAPI(title="Group Calendar API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/status")
def get_status():
    """最終パイプライン実行時刻を返す"""
    return {"last_pipeline_run": scheduler.get_last_run_time()}


@app.get("/groups")
def get_groups():
    return {"groups": KNOWN_GROUPS}


@app.get("/schedule")
def get_schedule(group: str = Query(..., description="グループのスラッグ (例: cutiestreet)")):
    try:
        events = fetch_schedule(group)
        return {"group": group, "events": events}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"取得失敗: {e}")


@app.post("/fetch")
async def manual_fetch(
    start_time: str = Query(default=None, description="取得開始日時 (RFC3339例: 2026-03-15T00:00:00Z)"),
    max_results: int = Query(default=10, ge=5, le=100, description="1アカウントあたりの最大取得件数"),
):
    """手動トリガー: Web + X のフルパイプラインを全グループ実行"""
    try:
        count = await asyncio.to_thread(scheduler.run_pipeline, start_time, max_results)
        return {"message": f"{count} 件のイベントを保存しました"}
    except Exception as e:
        logger.error(f"/fetch エラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/fetch/web")
async def manual_fetch_web():
    """手動トリガー: Webスクレイピングのみ（X API不使用）"""
    try:
        count = await asyncio.to_thread(scheduler.run_web_pipeline)
        return {"message": f"{count} 件のイベントを保存しました"}
    except Exception as e:
        logger.error(f"/fetch/web エラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/fetch/deadlines")
async def manual_deadline_backfill():
    """手動トリガー: 申込締切レコードのバックフィル"""
    try:
        count = await asyncio.to_thread(scheduler.run_deadline_backfill)
        return {"message": f"{count} 件の申込締切レコードを補完しました"}
    except Exception as e:
        logger.error(f"/fetch/deadlines エラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/reclassify")
async def reclassify_event_dates(
    account: str = Query(default=None, description="対象アカウント名 (例: CANDY_TUNE_)。省略時は全グループ対象"),
):
    """
    既存のX投稿イベントの event_date を再分類して更新する。
    修正済みロジック（申込締切日を開催日と誤判定しない）を既存レコードに適用したいときに使う。
    """
    try:
        result = await asyncio.to_thread(scheduler.run_reclassify, account)
        return {
            "message": f"{result['checked']} 件確認、{result['updated']} 件の開催日を更新しました",
            **result,
        }
    except Exception as e:
        logger.error(f"/admin/reclassify エラー: {e}")
        raise HTTPException(status_code=500, detail=str(e))
