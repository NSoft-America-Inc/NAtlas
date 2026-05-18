import argparse
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import documents, swarmvault, settings

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

@app.get("/health")
async def health():
    return {"ok": True}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NAtlas Sidecar FastAPI Server")
    parser.add_argument("--port", type=int, default=18420, help="Port to run the sidecar server")
    args = parser.parse_args()

    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")
