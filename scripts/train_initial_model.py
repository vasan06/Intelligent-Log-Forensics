"""Train the shipped runtime anomaly-detection ensemble from the synthetic
multi-source dataset. Safe to run repeatedly; it overwrites MODEL_PATH.

Usage:
    python scripts/train_initial_model.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import create_app
from app.engines.feature_engine import extract_feature_rows
from app.engines.ml_engine import train
from app.services.log_generator import LogGenerator


def main():
    app = create_app()
    with app.app_context():
        normal = LogGenerator(seed=700).generate("normal", 200, source="mixed")
        attacks = (
            LogGenerator(seed=701).generate("bruteforce", 80, source="mixed")
            + LogGenerator(seed=702).generate("scan", 80, source="mixed")
            + LogGenerator(seed=703).generate("breach", 80, source="mixed")
        )
        normal_features = extract_feature_rows(normal)
        attack_features = extract_feature_rows(attacks)
        total = len(normal_features) + len(attack_features)
        contamination = min(0.25, max(0.05, len(attack_features) / total))
        bundle = train(normal_features + attack_features, app.config["MODEL_PATH"], contamination=contamination)
        print(f"trained {bundle['version']} -> {app.config['MODEL_PATH']} (contamination={contamination:.3f})")


if __name__ == "__main__":
    main()
