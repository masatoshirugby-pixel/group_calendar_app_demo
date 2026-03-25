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
