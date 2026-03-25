from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fetcher import fetch_schedule, KNOWN_GROUPS

app = FastAPI(title="Group Calendar API")

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
    """対応グループ一覧を返す"""
    return {"groups": KNOWN_GROUPS}


@app.get("/schedule")
def get_schedule(group: str = Query(..., description="グループのサブドメイン (例: cutiestreet)")):
    """指定グループのスケジュールを返す（今月 + 翌月）"""
    try:
        events = fetch_schedule(group)
        return {"group": group, "events": events}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"取得失敗: {e}")
