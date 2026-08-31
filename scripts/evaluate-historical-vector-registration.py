#!/usr/bin/env python3
"""Evaluate a canonical-to-historical vector overlay without changing source RGB.

This bounded Scherer pilot maps sampled canonical coastline points through the
same deterministic inverse field as the rejected raster-warp experiment, then
measures those points against the versioned pilot land-edge mask.  It never
writes textures or runtime geometry.  The result is an offline acceptance
artifact only; ``--check`` recomputes and compares it byte-for-data.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image


REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
PILOT_SCRIPT_PATH = REPOSITORY_ROOT / "scripts/pilot-historical-artwork-warp.py"
DEFAULT_CONFIG_PATH = (
    REPOSITORY_ROOT
    / "scripts/globe-editions/historical-artwork-registration-pilot.json"
)
DEFAULT_MASK_PATH = (
    REPOSITORY_ROOT
    / ".tmp/globe-registration-pilot/scherer-1700/1024x512/segmented-historical-land-mask.png"
)
DEFAULT_REPORT_PATH = (
    REPOSITORY_ROOT
    / "reports/globe-editions/historical-vector-registration-pilot.json"
)
MAXIMUM_EVALUATION_WIDTH = 1536


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def repository_relative(path: Path) -> str:
    resolved = path.resolve()
    try:
        return resolved.relative_to(REPOSITORY_ROOT).as_posix()
    except ValueError as error:
        raise ValueError(f"Path escaped repository: {resolved}") from error


def load_module(path: Path, name: str) -> Any:
    specification = importlib.util.spec_from_file_location(name, path)
    if specification is None or specification.loader is None:
        raise RuntimeError(f"Unable to load {path}.")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


def percentile(values: np.ndarray, fraction: float) -> float:
    if values.size == 0:
        raise ValueError("Cannot summarize an empty residual sample.")
    return round(float(np.percentile(values, fraction * 100)), 6)


def summarize(values: np.ndarray) -> dict[str, float | int]:
    return {
        "sampleCount": int(values.size),
        "medianPixels": percentile(values, 0.5),
        "p95Pixels": percentile(values, 0.95),
        "maximumPixels": percentile(values, 1.0),
    }


def nearest_edge_distances(
    target_edge: np.ndarray,
    query_x: np.ndarray,
    query_y: np.ndarray,
    search_radius: int,
) -> np.ndarray:
    height, width = target_edge.shape
    distances = np.empty(query_x.size, dtype=np.float64)
    for index, (x, y) in enumerate(zip(query_x, query_y, strict=True)):
        center_x = int(round(float(x)))
        center_y = int(round(float(y)))
        y0 = max(0, center_y - search_radius)
        y1 = min(height, center_y + search_radius + 1)
        unwrapped_x = np.arange(
            center_x - search_radius,
            center_x + search_radius + 1,
            dtype=np.int32,
        )
        candidates = np.argwhere(target_edge[y0:y1][:, unwrapped_x % width])
        if candidates.size == 0:
            distances[index] = search_radius + 1
            continue
        candidate_y = candidates[:, 0].astype(np.float64) + y0
        candidate_x = unwrapped_x[candidates[:, 1]].astype(np.float64)
        distances[index] = float(
            np.min(np.hypot(candidate_x - x, candidate_y - y))
        )
    return distances


def coverage(distances: np.ndarray) -> dict[str, float]:
    return {
        f"within{threshold}PixelsPercent": round(
            float(np.mean(distances <= threshold) * 100), 6
        )
        for threshold in (1, 2, 4, 6, 8, 12, 24)
    }


def build_report(config_path: Path, mask_path: Path) -> dict[str, Any]:
    pilot = load_module(PILOT_SCRIPT_PATH, "historical_artwork_warp_pilot")
    config_bytes = config_path.read_bytes()
    config = json.loads(config_bytes)
    if config.get("editionId") != "scherer-1700":
        raise ValueError("This bounded evaluator accepts only the Scherer pilot config.")
    production_config_path = (
        REPOSITORY_ROOT / config["historicalProjectionConfigPath"]
    ).resolve()
    production_config = json.loads(production_config_path.read_text(encoding="utf-8"))
    canonical_atlas_path = (
        REPOSITORY_ROOT / production_config["canonicalAtlas"]["path"]
    ).resolve()
    canonical_atlas = json.loads(canonical_atlas_path.read_text(encoding="utf-8"))
    builder = pilot.load_builder()

    with Image.open(mask_path) as mask_image:
        historical_mask = np.asarray(mask_image.convert("L"), dtype=np.uint8) > 127
    height, width = historical_mask.shape
    if width > MAXIMUM_EVALUATION_WIDTH or width != height * 2:
        raise ValueError(
            f"Evaluation mask must be 2:1 and no wider than {MAXIMUM_EVALUATION_WIDTH}."
        )
    if width != 1024:
        raise ValueError("The pinned controls and mask are reviewed only at 1024x512.")

    historical_edge = pilot.binary_edge(historical_mask)
    canonical_mask = builder.canonical_union_land_mask(
        canonical_atlas, width, height
    ) > 127
    canonical_edge = pilot.binary_edge(canonical_mask)
    latitudes_by_row = 90.0 - (
        (np.arange(height, dtype=np.float64) + 0.5) / height
    ) * 180.0
    eligible_rows = (
        (latitudes_by_row <= float(config["qa"]["northLatitudeLimitDeg"]))
        & (latitudes_by_row >= float(config["qa"]["southLatitudeLimitDeg"]))
    )
    points = np.argwhere(canonical_edge & eligible_rows[:, None])
    maximum_samples = int(config["qa"]["maximumSamplesPerDirection"])
    stride = max(1, math.ceil(points.shape[0] / maximum_samples))
    points = points[::stride]
    canonical_y = points[:, 0].astype(np.float64)
    canonical_x = points[:, 1].astype(np.float64)
    canonical_longitude = ((canonical_x + 0.5) / width) * 360.0 - 180.0
    canonical_latitude = 90.0 - ((canonical_y + 0.5) / height) * 180.0

    algorithm = config["algorithm"]
    model = pilot.prepare_warp_model(
        config["controls"],
        float(algorithm["sigmaDegrees"]),
        float(algorithm["baseLongitudeOffsetDegrees"]),
        float(algorithm["baseLatitudeOffsetDegrees"]),
        float(algorithm["backgroundWeight"]),
    )
    mapped_longitude, mapped_latitude = pilot.evaluate_inverse_map(
        model, canonical_longitude, canonical_latitude
    )
    mapped_x = ((mapped_longitude + 180.0) / 360.0) * width - 0.5
    mapped_y = ((90.0 - mapped_latitude) / 180.0) * height - 0.5
    search_radius = max(
        8,
        round(
            float(config["qa"]["edgeSearchRadiusPixelsAt1024"])
            * width
            / 1024
        ),
    )
    baseline_residual = nearest_edge_distances(
        historical_edge, canonical_x, canonical_y, search_radius
    )
    candidate_residual = nearest_edge_distances(
        historical_edge, mapped_x, mapped_y, search_radius
    )
    delta_x = np.abs(mapped_x - canonical_x)
    delta_x = np.minimum(delta_x, width - delta_x)
    hit_target_displacement = np.hypot(delta_x, mapped_y - canonical_y)

    baseline_summary = summarize(baseline_residual)
    candidate_summary = summarize(candidate_residual)
    candidate_coverage = coverage(candidate_residual)
    improves_median_and_p95 = bool(
        candidate_summary["medianPixels"] < baseline_summary["medianPixels"]
        and candidate_summary["p95Pixels"] < baseline_summary["p95Pixels"]
    )
    maximum_does_not_regress = bool(
        candidate_summary["maximumPixels"] <= baseline_summary["maximumPixels"]
    )
    gate = {
        "medianMaximumPixelsAt1024": 0.5,
        "p95MaximumPixelsAt1024": 1,
        "maximumMaximumPixelsAt1024": 3,
        "minimumCoverageWithinOnePixelPercent": 95,
        "requiresIndependentHoldoutControls": True,
    }
    passes_numeric_gate = bool(
        candidate_summary["medianPixels"] <= gate["medianMaximumPixelsAt1024"]
        and candidate_summary["p95Pixels"] <= gate["p95MaximumPixelsAt1024"]
        and candidate_summary["maximumPixels"] <= gate["maximumMaximumPixelsAt1024"]
        and candidate_coverage["within1PixelsPercent"]
        >= gate["minimumCoverageWithinOnePixelPercent"]
    )

    return {
        "schemaVersion": 1,
        "artifactKind": "historical-vector-registration-pilot-result",
        "editionId": "scherer-1700",
        "productionEligible": False,
        "reviewState": "rejected-offline-vector-pilot",
        "inputs": {
            "pilotConfigPath": repository_relative(config_path),
            "pilotConfigSha256": hashlib.sha256(config_bytes).hexdigest().upper(),
            "historicalProjectionConfigPath": repository_relative(
                production_config_path
            ),
            "historicalProjectionConfigSha256": sha256_file(
                production_config_path
            ),
            "canonicalAtlasPath": repository_relative(canonical_atlas_path),
            "canonicalAtlasSha256": sha256_file(canonical_atlas_path),
            "historicalMaskPath": repository_relative(mask_path),
            "historicalMaskSha256": sha256_file(mask_path),
        },
        "evaluationCanvas": {"width": width, "height": height},
        "algorithm": {
            "version": "historical-vector-inverse-map-pilot-v1",
            "fieldVersion": algorithm["version"],
            "direction": "canonical-longitude-latitude-to-historical-longitude-latitude",
            "deterministic": True,
            "historicalRgbModified": False,
            "runtimeHitTestingModified": False,
            "controlPointCount": len(config["controls"]),
            "holdoutControlPointCount": 0,
        },
        "edgeResidual": {
            "metricClass": "one-way-sampled-canonical-vector-to-segmented-historical-artwork-edge-distance",
            "eligibleLatitudeRangeDegrees": [
                float(config["qa"]["southLatitudeLimitDeg"]),
                float(config["qa"]["northLatitudeLimitDeg"]),
            ],
            "sampleStrideCanonicalEdgePixels": stride,
            "searchRadiusPixels": search_radius,
            "baselineUnwarpedCanonicalVector": baseline_summary,
            "inverseMappedHistoricalVector": candidate_summary,
            "inverseMappedCoverage": candidate_coverage,
            "improvesMedianAndP95": improves_median_and_p95,
            "maximumDoesNotRegress": maximum_does_not_regress,
            "sourceMaskStatus": "versioned-chroma-proxy-not-independently-reviewed",
        },
        "canonicalHitTargetToDisplayedVectorDisplacement": {
            **summarize(hit_target_displacement),
            "interpretation": "A warped outline would no longer coincide with unchanged canonical pointer hit-testing.",
        },
        "acceptanceGate": {
            **gate,
            "numericGatePass": passes_numeric_gate,
            "independentHoldoutGatePass": False,
            "completeProductCoveragePass": False,
            "productionGate": "fail",
        },
        "historicalFidelity": {
            "sourceArtworkChanged": False,
            "labelsGraticuleAndDecorationsChanged": False,
            "geographyInvented": False,
            "interpretation": "Vector-only evaluation preserves source artwork, but does not prove accurate or complete interactive alignment.",
        },
        "decision": {
            "warpedRuntimeFillAllowed": False,
            "warpedRuntimeOutlineAllowed": False,
            "reason": "Residuals remain far above the gate, the maximum regresses, controls have no holdout, and a displaced outline would conflict with canonical hit-testing.",
            "safeFallback": "source-only-centroid-selection-v2",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG_PATH)
    parser.add_argument("--historical-mask", type=Path, default=DEFAULT_MASK_PATH)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT_PATH)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write-report", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()

    config_path = args.config.resolve()
    mask_path = args.historical_mask.resolve()
    report_path = args.report.resolve()
    repository_relative(config_path)
    repository_relative(mask_path)
    repository_relative(report_path)
    if not repository_relative(mask_path).startswith(".tmp/globe-registration-pilot/"):
        raise ValueError("Historical mask must remain inside the bounded pilot root.")
    if not repository_relative(report_path).startswith("reports/globe-editions/"):
        raise ValueError("Vector pilot report must remain inside reports/globe-editions.")

    report = build_report(config_path, mask_path)
    serialized = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.write_report:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(serialized, encoding="utf-8")
        print(
            "Wrote rejected Scherer vector-registration pilot: "
            f"{repository_relative(report_path)}"
        )
        return

    recorded = json.loads(report_path.read_text(encoding="utf-8"))
    if recorded != report:
        raise ValueError("Recorded vector-registration pilot no longer reproduces.")
    print(
        "Verified rejected Scherer vector-registration pilot: "
        f"{repository_relative(report_path)}"
    )


if __name__ == "__main__":
    main()
