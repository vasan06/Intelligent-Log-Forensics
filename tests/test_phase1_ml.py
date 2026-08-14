import unittest

from app.engines.feature_engine import FEATURE_NAMES, extract_feature_rows
from app.services.log_generator import LogGenerator, generate_labeled_dataset
from app.engines.ml_engine import score, train
import tempfile
from pathlib import Path


class PhaseOneTest(unittest.TestCase):
    def test_generator_modes_share_runtime_schema(self):
        rows = generate_labeled_dataset(5)
        self.assertEqual(len(rows), 20)
        self.assertEqual({row["generator_mode"] for row in rows}, {"normal", "scan", "bruteforce", "breach"})
        self.assertTrue(all(row["raw_log"] and row["timestamp"] for row in rows))

    def test_labeled_dataset_is_reproducible(self):
        first = generate_labeled_dataset(25, seed=17)
        second = generate_labeled_dataset(25, seed=17)
        self.assertEqual(first, second)
        self.assertEqual(extract_feature_rows(first), extract_feature_rows(second))

    def test_feature_rows_match_declared_training_schema(self):
        records = LogGenerator().generate("bruteforce", 8)
        features = extract_feature_rows(records)
        self.assertEqual(set(features[0]), set(FEATURE_NAMES))
        self.assertTrue(all(row["failed_login_count"] == 8 for row in features))

    def test_invalid_generator_mode_is_rejected(self):
        with self.assertRaises(ValueError):
            LogGenerator().generate("unknown", 1)

    def test_ensemble_uses_pyod_combination_and_training_threshold(self):
        normal = LogGenerator().generate("normal", 80)
        features = extract_feature_rows(normal)
        with tempfile.TemporaryDirectory() as directory:
            bundle = train(features, Path(directory) / "model.joblib", contamination=0.05)
        self.assertEqual(bundle["combination"], "pyod.average")
        self.assertIn("threshold", bundle)
        result = score(bundle, extract_feature_rows(LogGenerator().generate("breach", 1)))
        self.assertEqual(result["combination"], "pyod.average")


if __name__ == "__main__":
    unittest.main()
