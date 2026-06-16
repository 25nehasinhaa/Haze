from fastapi import APIRouter

from backend.app.config import get_settings
from backend.app.evaluation import evaluate_demo_ranking
from backend.app.ingestion import load_demo_data
from backend.app.pipeline import run_hiring_pipeline
from backend.app.schemas import RankingRequest, RankingResponse

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": get_settings().app_name}


@router.get("/demo", response_model=RankingResponse)
def demo() -> dict:
    settings = get_settings()
    jd, candidates = load_demo_data(settings.data_dir)
    return run_hiring_pipeline(
        jd.model_dump(),
        [candidate.model_dump() for candidate in candidates],
    )


@router.post("/rank", response_model=RankingResponse)
def rank(request: RankingRequest) -> dict:
    return run_hiring_pipeline(
        request.job_description.model_dump(),
        [candidate.model_dump() for candidate in request.candidates],
    )


@router.get("/evaluate")
def evaluate() -> dict:
    settings = get_settings()
    jd, candidates = load_demo_data(settings.data_dir)
    ranking = run_hiring_pipeline(
        jd.model_dump(),
        [candidate.model_dump() for candidate in candidates],
    )
    return evaluate_demo_ranking(ranking).__dict__

