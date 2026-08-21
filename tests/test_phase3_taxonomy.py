import unittest

from app.engines.rule_engine import detect_risks
from app.knowledge_base.taxonomy import load_taxonomy
from app.services.log_generator import LogGenerator


class TaxonomyTest(unittest.TestCase):
    def test_taxonomy_has_sixteen_complete_unique_entries(self):
        taxonomy = load_taxonomy()
        self.assertEqual(len(taxonomy), 16)
        self.assertEqual(len({entry["name"] for entry in taxonomy.values()}), 16)
        self.assertTrue(all(entry["mitre_id"].startswith("T") for entry in taxonomy.values()))

    def test_every_rule_detection_uses_taxonomy_slug_and_explanation(self):
        taxonomy = load_taxonomy()
        records = []
        generator = LogGenerator()
        for mode in ("scan", "bruteforce", "breach"):
            records.extend(generator.generate(mode, 5))
        risks = detect_risks(records)
        self.assertTrue(risks)
        for risk in risks:
            self.assertIn(risk["attack_type"], taxonomy)
            self.assertEqual(risk["risk_category"], taxonomy[risk["attack_type"]]["name"])
            self.assertTrue(risk["reason"])
            self.assertIn("Precaution:", risk["recommendation"])


if __name__ == "__main__":
    unittest.main()
