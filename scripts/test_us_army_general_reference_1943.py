from __future__ import annotations

import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BUILDER_PATH = ROOT / "scripts/build-us-army-general-reference-1943.py"
CONFIG_PATH = ROOT / "scripts/globe-editions/us-army-general-reference-1943.source.json"

SPEC = importlib.util.spec_from_file_location("army_general_reference_builder", BUILDER_PATH)
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


class GeneralReferenceMapRegistrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

    def test_full_overlay_and_source_only_poles_are_explicit(self) -> None:
        self.assertEqual(
            self.config["outputs"]["overlayProfile"],
            "STANDARD_GLOBE_OVERLAY_PROFILE",
        )
        self.assertFalse(self.config["outputs"]["modernCoastlineBaked"])
        self.assertTrue(self.config["projection"]["noSyntheticPolarCaps"])

    def test_digitized_grid_residual_is_below_half_degree(self) -> None:
        metrics = BUILDER.calibration_metrics(self.config)
        self.assertLess(metrics["combined"]["rmseDegrees"], 0.25)
        self.assertLess(metrics["combined"]["maxDegrees"], 0.5)

    def test_analytical_mapping_hits_all_six_pole_apexes(self) -> None:
        for panel in self.config["registration"]["panels"]:
            for hemisphere, latitude, center_key, pole_key in (
                ("north", 90.0, "northCentralMeridian", "northPole"),
                ("south", -90.0, "southCentralMeridian", "southPole"),
            ):
                longitude = panel[center_key]
                if longitude > 180:
                    longitude -= 360
                x_value, y_value = BUILDER.source_coordinates(longitude, latitude, self.config)
                expected_x, expected_y = panel[pole_key]
                self.assertAlmostEqual(float(x_value), expected_x, places=6, msg=hemisphere)
                self.assertAlmostEqual(float(y_value), expected_y, places=6, msg=hemisphere)

    def test_equator_panel_cuts_hit_the_digitized_grid(self) -> None:
        epsilon = 1e-7
        for longitude in (-180.0, -30.0):
            left_x, left_y = BUILDER.source_coordinates(longitude - epsilon, 0.0, self.config)
            right_x, right_y = BUILDER.source_coordinates(longitude + epsilon, 0.0, self.config)
            self.assertLess(abs(float(left_x) - float(right_x)), 1e-4)
            self.assertLess(abs(float(left_y) - float(right_y)), 1e-4)
        left_x, _ = BUILDER.source_coordinates(60.0 - epsilon, 0.0, self.config)
        right_x, _ = BUILDER.source_coordinates(60.0 + epsilon, 0.0, self.config)
        self.assertAlmostEqual(float(left_x), 5317.0, delta=3.0)
        self.assertAlmostEqual(float(right_x), 514.0, delta=3.0)

    def test_cached_source_matches_pin_when_present(self) -> None:
        source_path = ROOT / self.config["acquisition"]["localPath"]
        if not source_path.exists():
            self.skipTest("Pinned source is intentionally kept in the ignored cache")
        digest = hashlib.sha256(source_path.read_bytes()).hexdigest()
        self.assertEqual(digest, self.config["source"]["sha256"])
        with Image.open(source_path) as image:
            self.assertEqual(
                image.size,
                (self.config["source"]["width"], self.config["source"]["height"]),
            )

    def test_output_dimensions_when_assets_exist(self) -> None:
        for variant in ("desktop", "mobile"):
            output = self.config["outputs"][variant]
            output_path = ROOT / output["path"]
            if not output_path.exists():
                continue
            with Image.open(output_path) as image:
                self.assertEqual(image.size, (output["width"], output["height"]))

    def test_delivered_assets_keep_the_corrected_seams(self) -> None:
        desktop_path = ROOT / self.config["outputs"]["desktop"]["path"]
        if not desktop_path.exists():
            self.skipTest("Rendered desktop asset is not present")
        with Image.open(desktop_path) as image:
            metrics = BUILDER.seam_metrics(image.convert("RGB"))["seams"]
        for seam in metrics.values():
            self.assertLess(seam["meanRgbDelta"], 5.0)
            self.assertLess(seam["p95RgbDelta"], 12.0)
            self.assertLessEqual(seam["maxRgbDelta"], 30.0)

    def test_manifest_uses_both_runtime_assets_for_cache_version(self) -> None:
        desktop = BUILDER.artifact_record(
            ROOT / self.config["outputs"]["desktop"]["path"]
        )
        mobile = BUILDER.artifact_record(
            ROOT / self.config["outputs"]["mobile"]["path"]
        )
        expected = BUILDER.texture_content_version(desktop, mobile)
        manifest_path = ROOT / self.config["outputs"]["qaDirectory"] / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["textureContentVersion"], expected)


if __name__ == "__main__":
    unittest.main()
