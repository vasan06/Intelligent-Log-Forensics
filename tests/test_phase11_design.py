import unittest
from pathlib import Path


class DesignTokenTest(unittest.TestCase):
    def test_tokens_are_complete_and_loaded_before_components(self):
        tokens = Path("app/static/css/design-tokens.css").read_text(encoding="utf-8")
        template = Path("app/templates/base.html").read_text(encoding="utf-8")
        for token in ("--ink", "--font-sans", "--space-4", "--radius-lg", "--panel-shadow"):
            self.assertIn(token, tokens)
        self.assertLess(template.index("design-tokens.css"), template.index("style.css"))

    def test_component_styles_do_not_redeclare_global_roots(self):
        styles = Path("app/static/css/style.css").read_text(encoding="utf-8")
        self.assertNotIn(":root {", styles)
        self.assertNotIn(':root[data-theme="dark"]', styles)


if __name__ == "__main__":
    unittest.main()
