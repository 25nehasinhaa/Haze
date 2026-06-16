from pathlib import Path
import json

from backend.app.schemas import CandidateProfile, JobDescription


def read_json(path: Path) -> dict | list:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_job_description(path: Path) -> JobDescription:
    return JobDescription.model_validate(read_json(path))


def load_candidates(path: Path) -> list[CandidateProfile]:
    return [CandidateProfile.model_validate(item) for item in read_json(path)]


def load_demo_data(data_dir: Path) -> tuple[JobDescription, list[CandidateProfile]]:
    return (
        load_job_description(data_dir / "job_description.json"),
        load_candidates(data_dir / "candidates.json"),
    )

