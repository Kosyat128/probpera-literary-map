# -*- coding: utf-8 -*-
import unittest

import tmp_text_full_check as full_text_audit


class FullTextAuditTest(unittest.TestCase):
    def test_scope_classification(self):
        self.assertEqual(
            full_text_audit.audit_scope(
                full_text_audit.ROOT
                / "src/data/countries/generated/writerIdentityRemediations.generated.json"
            ),
            "historical-negative-evidence",
        )
        self.assertEqual(
            full_text_audit.audit_scope(
                full_text_audit.ROOT / "src/data/countries/example.test.ts"
            ),
            "test-or-fixture",
        )
        self.assertEqual(
            full_text_audit.audit_scope(
                full_text_audit.ROOT / "src/data/countries/russia.ts"
            ),
            "runtime",
        )
        self.assertEqual(
            full_text_audit.audit_scope(
                full_text_audit.ROOT
                / "src/data/countries/generated/writerFacts.wikidata.json"
            ),
            "audit-source-snapshot",
        )

    def test_indentation_and_valid_dates_are_not_findings(self):
        line = '    "birthDate": "1801-08-17", "years": "1801–1865", value ?? undefined'
        self.assertEqual(full_text_audit.finding_categories(line), [])

    def test_real_text_defects_remain_findings(self):
        self.assertIn(
            "double_space",
            full_text_audit.finding_categories('"description": "Великий  писатель"'),
        )
        self.assertIn(
            "placeholders",
            full_text_audit.finding_categories('"description": "TODO"'),
        )
        self.assertIn(
            "suspicious_date_like",
            full_text_audit.finding_categories('"birthDate": "14-1899"'),
        )
        self.assertIn(
            "encoding_mojibake",
            full_text_audit.finding_categories('"description": "Повреждённый � текст"'),
        )

    def test_spanish_todo_and_code_nullish_values_are_not_placeholders(self):
        self.assertNotIn(
            "placeholders",
            full_text_audit.finding_categories('works: ["Puedo explicarlo todo"]'),
        )
        self.assertNotIn(
            "placeholders",
            full_text_audit.finding_categories('typeof window !== "undefined"'),
        )

    def test_report_serialization_obeys_short_hyphen_policy(self):
        rendered = full_text_audit.serialize({"text": "1882\u20141941 / 1911\u20131968"})
        self.assertIn("1882-1941 / 1911-1968", rendered)
        self.assertNotRegex(rendered, "[\u2013\u2014]")


if __name__ == "__main__":
    unittest.main()
