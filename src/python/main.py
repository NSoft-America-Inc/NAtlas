import os
import sys

# Windows embedded Python does not add the script's directory to sys.path automatically.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# packaged app 구동 시 PATH 유실 현상(Homebrew 경로 등 누락) 방지
if sys.platform != "win32":
    extra_paths = ["/opt/homebrew/bin", "/usr/local/bin", os.path.expanduser("~/.npm-global/bin")]
    path_env = os.environ.get("PATH", "")
    paths = path_env.split(":")
    for ep in extra_paths:
        if ep not in paths and os.path.exists(ep):
            paths.insert(0, ep)
    os.environ["PATH"] = ":".join(paths)
else:
    extra_paths = [
        os.path.expanduser("~/AppData/Roaming/npm"),
        os.path.expanduser("~/AppData/Local/Programs/Python/Python311"),
        os.path.expanduser("~/AppData/Local/Programs/Python/Python312"),
    ]
    path_env = os.environ.get("PATH", "")
    paths = path_env.split(";")
    for ep in extra_paths:
        if ep not in paths and os.path.exists(ep):
            paths.insert(0, ep)
    os.environ["PATH"] = ";".join(paths)

import argparse
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import documents, swarmvault, settings
import db

# Initialize SQLite database
db.init_db()

app = FastAPI(title="NAtlas Sidecar Backend", version="1.0.0")

# Enforce CORS so the Electron-vite React renderer can call our endpoints securely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(documents.router, prefix="/documents", tags=["Documents"])
app.include_router(swarmvault.router, prefix="/swarmvault", tags=["SwarmVault"])
app.include_router(settings.router, prefix="/settings", tags=["Settings"])

import asyncio
from routers.swarmvault import start_smart_scheduler

@app.on_event("startup")
async def startup_event():
    # 60초(1분) 간격으로 백그라운드 스마트 인덱싱 기동
    asyncio.create_task(start_smart_scheduler(60))

@app.get("/health")
async def health():
    return {"ok": True}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NAtlas Sidecar FastAPI Server")
    parser.add_argument("--port", type=int, default=18420, help="Port to run the sidecar server")
    args = parser.parse_args()

    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")
