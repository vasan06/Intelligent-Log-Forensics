import json
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def load_taxonomy():
    path = Path(__file__).with_name("attack_taxonomy.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    required = {"name", "mitre_id", "detection_signal", "fix", "precaution"}
    if len(data) != 16 or any(not required.issubset(entry) for entry in data.values()):
        raise ValueError("Attack taxonomy must contain 16 complete entries")
    return data


def entry(slug):
    return load_taxonomy()[slug]


def by_name(name):
    return next(((slug, item) for slug, item in load_taxonomy().items() if item["name"] == name), None)
