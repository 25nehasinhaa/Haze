import json
from pathlib import Path
from typing import Any


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_demo_dataset(data_dir: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    jd = load_json(data_dir / "job_description.json")
    candidates = load_json(data_dir / "candidates.json")
    return jd, candidates

