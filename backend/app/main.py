from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.api import router
from backend.app.config import get_settings
from backend.app.logging_config import configure_logging

configure_logging()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    import logging

    logger = logging.getLogger("haze.startup")
    jsonl_path = settings.data_dir / "candidates.jsonl"
    if jsonl_path.exists():
        def _warm():
            from backend.app.dataset_adapter import load_jsonl_candidates_cached
            from backend.app.retrieval import get_cached_retriever

            candidates = load_jsonl_candidates_cached(jsonl_path, limit=None, filter_open_to_work=False)
            get_cached_retriever(candidates)
            logger.info(f"Warmed cache: {len(candidates)} candidates indexed.")

        asyncio.get_event_loop().run_in_executor(None, _warm)
    else:
        logger.info("No candidates.jsonl found; skipping cache warm-up.")
    yield


app = FastAPI(
    title=settings.app_name,
    description="Evidence-based hiring intelligence API.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

# Serve React frontend from /frontend/dist if it exists
_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/assets", StaticFiles(directory=str(_dist / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        index = _dist / "index.html"
        return FileResponse(str(index))

