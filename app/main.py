# main.py
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os

from app.controllers.game_controller import router

app = FastAPI(
    title="Score Game API",
    description="A turn-based scoring game API for 2-4 players",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(router, prefix="/api", tags=["game"])

# Static files - make sure the directory exists
static_dir = "app/views/static"
if os.path.exists(static_dir):
    app.mount(
        "/static",
        StaticFiles(directory=static_dir),
        name="static"
    )
else:
    print(f"Warning: Static directory '{static_dir}' does not exist")

# Root route
@app.get("/")
def read_index():
    index_path = "app/views/static/index.html"
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        return {"error": "index.html not found", "path": index_path}

# Health check
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "message": "Score Game API is running",
        "version": "1.0.0"
    }

# API info
@app.get("/api-info")
def api_info():
    return {
        "name": "Score Game API",
        "description": "API for a turn-based scoring game with 2-4 players",
        "endpoints": {
            "POST /api/start": "Start a new game",
            "POST /api/action": "Perform an action",
            "GET /api/status": "Get game status",
            "GET /api/current-player": "Get current player",
            "POST /api/reset": "Reset the game",
            "GET /api/rules": "Get game rules"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)