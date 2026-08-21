import argparse
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.engines.feature_engine import FEATURE_NAMES, extract_feature_rows
from app.services.log_generator import generate_labeled_dataset


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples-per-mode", type=int, default=250)
    parser.add_argument("--output", type=Path, default=ROOT / "instance/generated/training_data.csv")
    args = parser.parse_args()
    records = generate_labeled_dataset(args.samples_per_mode)
    features = extract_feature_rows(records)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=[*FEATURE_NAMES, "generator_mode", "is_anomaly"])
        writer.writeheader()
        for record, row in zip(records, features):
            writer.writerow({**row, "generator_mode": record["generator_mode"], "is_anomaly": int(record["generator_mode"] != "normal")})
    print(f"Generated {len(records)} labeled rows at {args.output}")


if __name__ == "__main__":
    main()
