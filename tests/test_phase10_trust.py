import unittest

from app.services.trust_score import calculate_trust_score


class TrustScoreTest(unittest.TestCase):
    def test_documented_weighted_formula(self):
        self.assertEqual(calculate_trust_score(80, 60, 100), 80.0)

    def test_formula_clamps_inputs(self):
        self.assertEqual(calculate_trust_score(120, -5, 100), 70.0)


if __name__ == "__main__":
    unittest.main()
