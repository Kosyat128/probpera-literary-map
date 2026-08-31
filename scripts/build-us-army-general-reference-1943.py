#!/usr/bin/env python3
"""Build the 1943 General Reference Map globe texture.

The source is an interrupted sinusoidal map made of three panels.  This builder
analytically maps every equirectangular output pixel back into one of those
printed panels.  It never paints modern coastlines into the texture and never
creates synthetic polar caps.  Modern Natural Earth geometry is used only for
the separately stored QA preview and linework-proximity measurement.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import sys
import urllib.request
from pathlib import Path
from typing import Any, Iterable

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "scripts/globe-editions/us-army-general-reference-1943.source.json"
GEOJSON_PATH = ROOT / "src/data/geo/countries.geojson"


def load_config(path: Path = CONFIG_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def project_path(relative_path: str) -> Path:
    return ROOT / Path(relative_path)


def sha256_file(path: Path, block_size: int = 1 << 20) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while block := handle.read(block_size):
            digest.update(block)
    return digest.hexdigest()


def ensure_source(config: dict[str, Any], allow_download: bool) -> Path:
    source_path = project_path(config["acquisition"]["localPath"])
    if not source_path.exists():
        if not allow_download:
            raise FileNotFoundError(
                f"Source is missing: {source_path}\n"
                "Re-run with --download to acquire the pinned Commons original."
            )
        source_path.parent.mkdir(parents=True, exist_ok=True)
        partial_path = source_path.with_suffix(source_path.suffix + ".part")
        urllib.request.urlretrieve(config["acquisition"]["originalUrl"], partial_path)
        partial_path.replace(source_path)

    expected_hash = config["source"]["sha256"].lower()
    actual_hash = sha256_file(source_path)
    if actual_hash != expected_hash:
        raise ValueError(
            f"Source checksum mismatch: expected {expected_hash}, got {actual_hash}"
        )
    if source_path.stat().st_size != config["source"]["bytes"]:
        raise ValueError("Source byte size does not match the pinned acquisition record")

    with Image.open(source_path) as image:
        expected_size = (config["source"]["width"], config["source"]["height"])
        if image.size != expected_size:
            raise ValueError(f"Source dimensions mismatch: expected {expected_size}, got {image.size}")
    return source_path


def _panel_parameters(
    unwrapped_longitude: np.ndarray,
    latitude: np.ndarray,
    config: dict[str, Any],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    panels = config["registration"]["panels"]
    panel_index = np.where(
        unwrapped_longitude < panels[0]["longitudeMax"],
        0,
        np.where(unwrapped_longitude < panels[1]["longitudeMax"], 1, 2),
    )
    is_north = latitude >= 0

    central = np.empty_like(unwrapped_longitude, dtype=np.float64)
    pole_x = np.empty_like(unwrapped_longitude, dtype=np.float64)
    pole_y = np.empty_like(unwrapped_longitude, dtype=np.float64)
    for index, panel in enumerate(panels):
        member = panel_index == index
        north_member = member & is_north
        south_member = member & ~is_north
        central[north_member] = panel["northCentralMeridian"]
        central[south_member] = panel["southCentralMeridian"]
        pole_x[north_member] = panel["northPole"][0]
        pole_x[south_member] = panel["southPole"][0]
        pole_y[north_member] = panel["northPole"][1]
        pole_y[south_member] = panel["southPole"][1]
    return central, pole_x, pole_y


def source_coordinates(
    longitude: np.ndarray | float,
    latitude: np.ndarray | float,
    config: dict[str, Any],
) -> tuple[np.ndarray, np.ndarray]:
    """Return calibrated source-pixel coordinates for lon/lat arrays."""

    longitude_array, latitude_array = np.broadcast_arrays(
        np.asarray(longitude, dtype=np.float64),
        np.asarray(latitude, dtype=np.float64),
    )
    unwrapped = np.where(longitude_array < 60.0, longitude_array + 360.0, longitude_array)
    central, pole_x, pole_y = _panel_parameters(unwrapped, latitude_array, config)

    registration = config["registration"]
    equator = registration["equator"]
    pixels_per_degree = float(equator["pixelsPerDegree"])
    intercept = float(equator["xIntercept"])
    latitude_radians = np.deg2rad(latitude_array)
    pole_fraction = np.abs(latitude_array) / 90.0

    projected_x = (
        intercept
        + pixels_per_degree * central
        + pixels_per_degree * (unwrapped - central) * np.cos(latitude_radians)
    )
    predicted_pole_x = intercept + pixels_per_degree * central
    correction_weight = pole_fraction ** float(registration["xPoleCorrectionExponent"])
    source_x = projected_x + (pole_x - predicted_pole_x) * correction_weight

    reference_x = float(equator["referenceX"])
    y_at_reference = float(equator["yAtReferenceX"])
    y_slope = float(equator["ySlopePerPixelX"])
    equator_y_at_x = y_at_reference + y_slope * (source_x - reference_x)
    equator_y_at_pole = y_at_reference + y_slope * (pole_x - reference_x)
    source_y = equator_y_at_x + pole_fraction * (pole_y - equator_y_at_pole)
    return source_x, source_y


def calibration_metrics(config: dict[str, Any]) -> dict[str, Any]:
    registration = config["registration"]
    equator = registration["equator"]
    x_anchors = registration["digitizedEquatorAnchors"]
    longitudes = np.asarray(x_anchors["longitudes"], dtype=np.float64)
    measured_x = np.asarray(x_anchors["sourceX"], dtype=np.float64)
    predicted_x = float(equator["xIntercept"]) + float(equator["pixelsPerDegree"]) * longitudes
    x_residual = measured_x - predicted_x

    y_anchors = registration["digitizedParallelAnchors"]
    latitudes = np.asarray(y_anchors["latitudes"], dtype=np.float64)
    measured_y = np.asarray(y_anchors["sourceY"], dtype=np.float64)
    y_slope, y_intercept = np.polyfit(latitudes, measured_y, 1)
    y_residual = measured_y - (y_slope * latitudes + y_intercept)

    x_rmse = float(np.sqrt(np.mean(np.square(x_residual))))
    y_rmse = float(np.sqrt(np.mean(np.square(y_residual))))
    x_max = float(np.max(np.abs(x_residual)))
    y_max = float(np.max(np.abs(y_residual)))
    combined_rmse = math.hypot(x_rmse, y_rmse)
    combined_max = math.hypot(x_max, y_max)
    pixels_per_degree = float(equator["pixelsPerDegree"])

    pole_residuals: list[dict[str, Any]] = []
    for panel in registration["panels"]:
        for hemisphere, latitude, key in (
            ("north", 90.0, "northPole"),
            ("south", -90.0, "southPole"),
        ):
            longitude = (
                panel["northCentralMeridian"]
                if hemisphere == "north"
                else panel["southCentralMeridian"]
            )
            canonical_longitude = longitude if longitude <= 180 else longitude - 360
            x_value, y_value = source_coordinates(canonical_longitude, latitude, config)
            expected = panel[key]
            residual = math.hypot(float(x_value) - expected[0], float(y_value) - expected[1])
            pole_residuals.append(
                {
                    "panel": panel["name"],
                    "hemisphere": hemisphere,
                    "sourcePixelResidual": round(residual, 6),
                }
            )

    return {
        "method": "Residual of manually digitized 15-degree graticule anchors against the calibrated analytical model.",
        "equatorAnchorCount": int(longitudes.size),
        "parallelAnchorCount": int(latitudes.size),
        "equatorX": {
            "rmseSourcePixels": round(x_rmse, 4),
            "maxSourcePixels": round(x_max, 4),
        },
        "parallelY": {
            "fittedPixelsPerDegree": round(abs(float(y_slope)), 6),
            "rmseSourcePixels": round(y_rmse, 4),
            "maxSourcePixels": round(y_max, 4),
        },
        "combined": {
            "rmseSourcePixels": round(combined_rmse, 4),
            "maxSourcePixels": round(combined_max, 4),
            "rmseDegrees": round(combined_rmse / pixels_per_degree, 4),
            "maxDegrees": round(combined_max / pixels_per_degree, 4),
        },
        "calibratedPoleApexes": pole_residuals,
        "caveat": "These residuals quantify the digitized printed grid. Local paper and scan deformation remains visible and is not hidden by a modern-vector warp.",
    }


def bilinear_sample(source: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    height, width, _ = source.shape
    x = np.clip(x, 0.0, width - 1.0)
    y = np.clip(y, 0.0, height - 1.0)
    x0 = np.minimum(np.floor(x).astype(np.int32), width - 2)
    y0 = np.minimum(np.floor(y).astype(np.int32), height - 2)
    x1 = x0 + 1
    y1 = y0 + 1
    wx = (x - x0)[..., None]
    wy = (y - y0)[..., None]
    top = source[y0, x0] * (1.0 - wx) + source[y0, x1] * wx
    bottom = source[y1, x0] * (1.0 - wx) + source[y1, x1] * wx
    return top * (1.0 - wy) + bottom * wy


def render_equirectangular(
    source_image: Image.Image,
    width: int,
    height: int,
    config: dict[str, Any],
    chunk_rows: int = 128,
) -> tuple[Image.Image, dict[str, float]]:
    source = np.asarray(source_image.convert("RGB"), dtype=np.float32)
    output = np.empty((height, width, 3), dtype=np.uint8)
    longitude = -180.0 + (np.arange(width, dtype=np.float64) + 0.5) * (360.0 / width)
    bounds = {"minX": float("inf"), "maxX": -float("inf"), "minY": float("inf"), "maxY": -float("inf")}

    for row_start in range(0, height, chunk_rows):
        row_end = min(row_start + chunk_rows, height)
        latitude = 90.0 - (np.arange(row_start, row_end, dtype=np.float64) + 0.5) * (180.0 / height)
        longitude_grid, latitude_grid = np.meshgrid(longitude, latitude)
        source_x, source_y = source_coordinates(longitude_grid, latitude_grid, config)
        bounds["minX"] = min(bounds["minX"], float(np.min(source_x)))
        bounds["maxX"] = max(bounds["maxX"], float(np.max(source_x)))
        bounds["minY"] = min(bounds["minY"], float(np.min(source_y)))
        bounds["maxY"] = max(bounds["maxY"], float(np.max(source_y)))
        sampled = bilinear_sample(source, source_x, source_y)
        output[row_start:row_end] = np.clip(np.rint(sampled), 0, 255).astype(np.uint8)

    return Image.fromarray(output, mode="RGB"), {key: round(value, 3) for key, value in bounds.items()}


def _rings_from_geometry(geometry: dict[str, Any]) -> Iterable[list[list[float]]]:
    if geometry["type"] == "Polygon":
        yield from geometry["coordinates"]
    elif geometry["type"] == "MultiPolygon":
        for polygon in geometry["coordinates"]:
            yield from polygon


def _polygons_from_geometry(geometry: dict[str, Any]) -> Iterable[list[list[list[float]]]]:
    if geometry["type"] == "Polygon":
        yield geometry["coordinates"]
    elif geometry["type"] == "MultiPolygon":
        yield from geometry["coordinates"]


def _project_ring(ring: list[list[float]], width: int, height: int) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    previous_x: float | None = None
    for longitude, latitude in ring:
        x_value = (float(longitude) + 180.0) / 360.0 * width
        if previous_x is not None:
            while x_value - previous_x > width / 2:
                x_value -= width
            while x_value - previous_x < -width / 2:
                x_value += width
        y_value = (90.0 - float(latitude)) / 180.0 * height
        points.append((x_value, y_value))
        previous_x = x_value
    return points


def _draw_ring_copies(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[float, float]],
    canvas_width: int,
    **kwargs: Any,
) -> None:
    for shift in (-canvas_width, 0, canvas_width):
        shifted = [(x + shift, y) for x, y in points]
        draw.line(shifted, **kwargs)


def build_land_and_border_masks(
    geojson: dict[str, Any], width: int, height: int
) -> tuple[Image.Image, Image.Image, Image.Image]:
    land = Image.new("L", (width, height), 0)
    borders = Image.new("L", (width, height), 0)
    selected = Image.new("L", (width, height), 0)
    land_draw = ImageDraw.Draw(land)
    border_draw = ImageDraw.Draw(borders)
    selected_draw = ImageDraw.Draw(selected)

    for feature in geojson["features"]:
        is_selected = feature.get("properties", {}).get("ISO_A2") == "BR"
        for polygon in _polygons_from_geometry(feature["geometry"]):
            for ring_index, ring in enumerate(polygon):
                points = _project_ring(ring, width, height)
                fill_value = 255 if ring_index == 0 else 0
                for shift in (-width, 0, width):
                    shifted = [(x + shift, y) for x, y in points]
                    land_draw.polygon(shifted, fill=fill_value)
                    if is_selected:
                        selected_draw.polygon(shifted, fill=fill_value)
                _draw_ring_copies(border_draw, points, width, fill=255, width=1, joint="curve")
    return land, borders, selected


def coast_mask_from_land(land_image: Image.Image) -> np.ndarray:
    land = np.asarray(land_image, dtype=np.uint8) > 0
    interior = np.zeros_like(land)
    interior[1:-1] = (
        land[1:-1]
        & np.roll(land, 1, axis=1)[1:-1]
        & np.roll(land, -1, axis=1)[1:-1]
        & land[:-2]
        & land[2:]
    )
    coast = land & ~interior
    return coast


def linework_alignment_metrics(texture: Image.Image, coast: np.ndarray) -> dict[str, Any]:
    rgb = np.asarray(texture.convert("RGB"), dtype=np.float32)
    gray = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    gradient_x = np.zeros_like(gray)
    gradient_y = np.zeros_like(gray)
    gradient_x[:, 1:-1] = np.abs(gray[:, 2:] - gray[:, :-2]) * 0.5
    gradient_y[1:-1] = np.abs(gray[2:] - gray[:-2]) * 0.5
    gradient = np.hypot(gradient_x, gradient_y)
    threshold = max(8.0, float(np.percentile(gradient, 82.0)))
    strong_line = gradient >= threshold

    distance = np.full(strong_line.shape, 13, dtype=np.uint8)
    distance[strong_line] = 0
    reached = strong_line.copy()
    for radius in range(1, 13):
        expanded = reached.copy()
        expanded[1:] |= reached[:-1]
        expanded[:-1] |= reached[1:]
        expanded[:, 1:] |= reached[:, :-1]
        expanded[:, :-1] |= reached[:, 1:]
        expanded[1:, 1:] |= reached[:-1, :-1]
        expanded[1:, :-1] |= reached[:-1, 1:]
        expanded[:-1, 1:] |= reached[1:, :-1]
        expanded[:-1, :-1] |= reached[1:, 1:]
        newly_reached = expanded & ~reached
        distance[newly_reached] = radius
        reached = expanded

    row_latitude = 90.0 - (np.arange(coast.shape[0]) + 0.5) * (180.0 / coast.shape[0])
    evaluation_mask = coast & (np.abs(row_latitude)[:, None] <= 82.0)
    values = distance[evaluation_mask].astype(np.float64)
    if values.size == 0:
        raise ValueError("No coastline pixels available for overlay QA")
    degrees_per_pixel = 360.0 / texture.width
    return {
        "method": "Nearest strong printed-line proximity from the dissolved modern coastline at 2048x1024; Chebyshev pixels, |latitude| <= 82 degrees.",
        "purpose": "A conservative automated proxy for visual coast registration. The separately stored overlay preview remains the final human-readable check.",
        "sampleCount": int(values.size),
        "gradientThreshold": round(threshold, 4),
        "meanPixels": round(float(np.mean(values)), 4),
        "rmsePixels": round(float(np.sqrt(np.mean(np.square(values)))), 4),
        "p95Pixels": round(float(np.percentile(values, 95)), 4),
        "maxCappedPixels": int(np.max(values)),
        "within3PixelsPercent": round(float(np.mean(values <= 3) * 100.0), 2),
        "rmseDegreesAtEquator": round(float(np.sqrt(np.mean(np.square(values)))) * degrees_per_pixel, 4),
        "caveat": "Printed labels and historical boundary linework can lower nearest-line distances; this is not claimed as an independent geodetic survey.",
    }


def _smooth_vertical(values: np.ndarray, radius: int) -> np.ndarray:
    if radius <= 0:
        return values
    padded = np.pad(values, ((radius, radius), (0, 0)), mode="edge")
    cumulative = np.vstack(
        [np.zeros((1, values.shape[1]), dtype=np.float64), np.cumsum(padded, axis=0, dtype=np.float64)]
    )
    window = radius * 2 + 1
    return ((cumulative[window:] - cumulative[:-window]) / window).astype(np.float32)


def feather_canonical_seams(
    texture: Image.Image,
    config: dict[str, Any],
) -> tuple[Image.Image, dict[str, Any]]:
    """Remove hard panel cuts using only neighboring source-derived pixels.

    Most of the feather is a low-frequency paper-tone balance, so lettering and
    engraved linework remain untouched.  Only a six-column-wide 4K core is
    crossfaded to remove the duplicated printed lobe edge itself.
    """

    settings = config["projection"]["canonicalSeamFeather"]
    width, height = texture.size
    scale = width / 4096.0
    tone_band = max(4, int(round(settings["toneBandPixelsAt4096"] * scale)))
    core_width = max(2, int(round(settings["coreBlendPixelsAt4096"] * scale)))
    if core_width % 2:
        core_width += 1
    core_half = core_width // 2
    reference_width = max(2, int(round(4 * scale)))
    vertical_radius = max(
        1,
        int(round(settings["verticalSmoothingRadiusAt2048"] * (height / 2048.0))),
    )
    max_tone_adjustment = float(settings["maxToneAdjustment"])

    original = np.asarray(texture.convert("RGB"), dtype=np.float32)
    result = original.copy()
    seam_records: list[dict[str, Any]] = []
    for longitude in settings["cutLongitudes"]:
        seam_column = 0 if longitude == -180 else int(round((longitude + 180.0) / 360.0 * width))

        left_reference_indices = np.asarray(
            [(seam_column - core_half - offset) % width for offset in range(1, reference_width + 1)],
            dtype=np.int32,
        )
        right_reference_indices = np.asarray(
            [(seam_column + core_half - 1 + offset) % width for offset in range(1, reference_width + 1)],
            dtype=np.int32,
        )
        left_tone = np.mean(original[:, left_reference_indices, :], axis=1)
        right_tone = np.mean(original[:, right_reference_indices, :], axis=1)
        tone_delta = _smooth_vertical(right_tone - left_tone, vertical_radius)
        tone_delta = np.clip(tone_delta, -max_tone_adjustment, max_tone_adjustment)

        for offset in range(-tone_band, -core_half):
            column = (seam_column + offset) % width
            weight = (offset + tone_band + 1) / max(1, tone_band - core_half)
            result[:, column, :] = original[:, column, :] + 0.5 * tone_delta * weight
        for offset in range(core_half, tone_band):
            column = (seam_column + offset) % width
            weight = (tone_band - offset) / max(1, tone_band - core_half)
            result[:, column, :] = original[:, column, :] - 0.5 * tone_delta * weight

        left_endpoint = result[:, (seam_column - core_half - 1) % width, :].copy()
        right_endpoint = result[:, (seam_column + core_half) % width, :].copy()
        for core_offset in range(core_width):
            column = (seam_column - core_half + core_offset) % width
            alpha = (core_offset + 1) / (core_width + 1)
            result[:, column, :] = left_endpoint * (1.0 - alpha) + right_endpoint * alpha

        seam_records.append(
            {
                "longitude": longitude,
                "seamColumn": seam_column,
                "toneBandPixels": tone_band,
                "coreBlendPixels": core_width,
                "maximumAppliedToneAdjustment": round(float(np.max(np.abs(tone_delta))) * 0.5, 4),
            }
        )

    feathered = Image.fromarray(np.clip(np.rint(result), 0, 255).astype(np.uint8), mode="RGB")
    return feathered, {
        "sourceDerived": True,
        "policy": settings["policy"],
        "seams": seam_records,
    }


def seam_metrics(texture: Image.Image) -> dict[str, Any]:
    rgb = np.asarray(texture.convert("RGB"), dtype=np.int16)
    height, width, _ = rgb.shape
    y_start = int(round(height * 0.02))
    y_end = int(round(height * 0.98))
    seam_pairs = {
        "wrap-180": (width - 1, 0),
        "panel-minus-30": (round((150.0 / 360.0) * width) - 1, round((150.0 / 360.0) * width)),
        "panel-plus-60": (round((240.0 / 360.0) * width) - 1, round((240.0 / 360.0) * width)),
    }
    result: dict[str, Any] = {}
    for name, (left, right) in seam_pairs.items():
        delta = np.mean(np.abs(rgb[y_start:y_end, left] - rgb[y_start:y_end, right]), axis=1)
        result[name] = {
            "leftColumn": int(left),
            "rightColumn": int(right),
            "meanRgbDelta": round(float(np.mean(delta)), 4),
            "p95RgbDelta": round(float(np.percentile(delta, 95)), 4),
            "maxRgbDelta": round(float(np.max(delta)), 4),
        }
    return {
        "method": "Absolute RGB delta across adjacent canonical columns, excluding the outermost 2 percent of polar rows.",
        "seams": result,
    }


def make_qa_previews(
    mobile: Image.Image,
    config: dict[str, Any],
    qa_directory: Path,
) -> tuple[dict[str, Any], list[Path]]:
    geojson = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))
    land, borders, selected = build_land_and_border_masks(geojson, mobile.width, mobile.height)

    overlay = mobile.convert("RGBA")
    selection_layer = Image.new("RGBA", mobile.size, (0, 0, 0, 0))
    selection_layer.paste((255, 80, 110, 72), mask=selected)
    overlay = Image.alpha_composite(overlay, selection_layer)
    line_layer = Image.new("RGBA", mobile.size, (0, 0, 0, 0))
    line_layer.paste((255, 232, 80, 218), mask=borders)
    overlay = Image.alpha_composite(overlay, line_layer)
    selected_outline = Image.new("RGBA", mobile.size, (0, 0, 0, 0))
    selected_outline_draw = ImageDraw.Draw(selected_outline)
    for feature in geojson["features"]:
        if feature.get("properties", {}).get("ISO_A2") != "BR":
            continue
        for ring in _rings_from_geometry(feature["geometry"]):
            points = _project_ring(ring, mobile.width, mobile.height)
            _draw_ring_copies(
                selected_outline_draw,
                points,
                mobile.width,
                fill=(255, 55, 92, 255),
                width=3,
                joint="curve",
            )
    overlay = Image.alpha_composite(overlay, selected_outline)
    overlay_path = qa_directory / "qa-preview-standard-overlay.png"
    overlay.convert("RGB").save(overlay_path, format="PNG", optimize=True)

    graticule = mobile.convert("RGBA")
    grid_layer = Image.new("RGBA", mobile.size, (0, 0, 0, 0))
    grid_draw = ImageDraw.Draw(grid_layer)
    interval = int(config["projection"]["graticuleIntervalDegrees"])
    for longitude in range(-180, 181, interval):
        x_value = round((longitude + 180) / 360 * (mobile.width - 1))
        grid_draw.line([(x_value, 0), (x_value, mobile.height - 1)], fill=(255, 196, 40, 150), width=1)
    for latitude in range(-75, 76, interval):
        y_value = round((90 - latitude) / 180 * (mobile.height - 1))
        grid_draw.line([(0, y_value), (mobile.width - 1, y_value)], fill=(255, 196, 40, 150), width=1)
    graticule = Image.alpha_composite(graticule, grid_layer)
    graticule_path = qa_directory / "qa-preview-graticule.png"
    graticule.convert("RGB").save(graticule_path, format="PNG", optimize=True)

    coast = coast_mask_from_land(land)
    alignment = linework_alignment_metrics(mobile, coast)
    return alignment, [overlay_path, graticule_path]


def save_webp(image: Image.Image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="WEBP", quality=quality, method=6, exact=True)


def artifact_record(path: Path, width: int | None = None, height: int | None = None) -> dict[str, Any]:
    record: dict[str, Any] = {
        "path": path.relative_to(ROOT).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }
    if width is not None and height is not None:
        record["width"] = width
        record["height"] = height
    return record


def texture_content_version(
    desktop_record: dict[str, Any], mobile_record: dict[str, Any]
) -> str:
    joined_hashes = f"{desktop_record['sha256']}:{mobile_record['sha256']}"
    digest = hashlib.sha256(joined_hashes.encode("ascii")).hexdigest()
    return f"sha256-{digest[:16]}"


def write_report(manifest: dict[str, Any], report_path: Path) -> None:
    calibration = manifest["qa"]["gridCalibration"]
    alignment = manifest["qa"]["coastlineLineworkProxy"]
    desktop = manifest["artifacts"]["desktop"]
    mobile = manifest["artifacts"]["mobile"]
    seam_lines = []
    before_seams = manifest["qa"]["canonicalSeams"]["beforeFeather"]["seams"]
    after_seams = manifest["qa"]["canonicalSeams"]["deliveredAfterFeather"]["seams"]
    for name, values in after_seams.items():
        before = before_seams[name]
        seam_lines.append(
            f"- `{name}`: mean {before['meanRgbDelta']} → {values['meanRgbDelta']}, "
            f"p95 {before['p95RgbDelta']} → {values['p95RgbDelta']}, "
            f"max {before['maxRgbDelta']} → {values['maxRgbDelta']} RGB levels."
        )

    text = f"""# General Reference Map No. 1 — globe texture QA

## Result

The 1943 federal world map was analytically reprojected from its three interrupted sinusoidal panels into a canonical 2:1 equirectangular texture. Every production pixel is source-derived. No current coastline, generated detail, recoloring, or synthetic polar cap is baked into the texture.

- Runtime edition id: `{manifest['editionId']}`
- Overlay contract: `{manifest['overlayProfile']}` (full country boundaries and selection geometry are supplied by the runtime, not by the bitmap)
- Texture content version: `{manifest['textureContentVersion']}`
- Desktop: `{desktop['path']}`, {desktop['width']}×{desktop['height']}, {desktop['bytes']:,} bytes, SHA-256 `{desktop['sha256']}`
- Mobile: `{mobile['path']}`, {mobile['width']}×{mobile['height']}, {mobile['bytes']:,} bytes, SHA-256 `{mobile['sha256']}`

## Provenance and rights

The sheet is *General Reference Map No. 1*, Manual M-101, November 1943, sheet 1057-G, prepared by the American Geographical Society for the Department of State and published by the U.S. Army Service Forces. The pinned original was acquired from Wikimedia Commons, where the file is marked `PD-USGov-Military`; the source page and federal catalog evidence are preserved in the manifest and source configuration.

Source: {manifest['source']['width']}×{manifest['source']['height']}, {manifest['source']['bytes']:,} bytes, SHA-256 `{manifest['source']['sha256']}`.

## Registration QA

- Digitized 15° graticule residual: RMSE {calibration['combined']['rmseSourcePixels']} source px ({calibration['combined']['rmseDegrees']}°), maximum {calibration['combined']['maxSourcePixels']} source px ({calibration['combined']['maxDegrees']}°).
- Coastline/printed-line proxy at 2048×1024: RMSE {alignment['rmsePixels']} px ({alignment['rmseDegreesAtEquator']}° at the equator), p95 {alignment['p95Pixels']} px, {alignment['within3PixelsPercent']}% within 3 px.
- The six calibrated pole apexes have zero analytical residual. Polar rows are a direct reprojection of the printed apex neighborhoods; there is no synthetic fill.
- The overlay preview uses modern Natural Earth geometry only as a QA layer. The production WebP files contain the historical scan alone.

The automated coastline metric is deliberately described as a linework-proximity proxy: labels and historical borders can be nearby strong edges. Inspect `qa-preview-standard-overlay.png` for continental alignment and `qa-preview-graticule.png` for the printed-grid registration.

## Canonical seam measurements

{chr(10).join(seam_lines)}

The correction is a source-derived multiband feather. High-frequency map detail is retained through the tone band; only the six central desktop columns at each mathematical cut are crossfaded to remove the duplicated printed lobe edge. No fill or modern geometry is introduced.

## Reproduction

Run once with the pinned source already in the ignored cache:

```powershell
python scripts/build-us-army-general-reference-1943.py
```

If the source cache is absent, `--download` acquires the exact Commons original and verifies its SHA-256 before rendering.
"""
    report_path.write_text(text, encoding="utf-8")


def build(
    config: dict[str, Any],
    allow_download: bool,
    resume_qa_from_rendered_assets: bool = False,
) -> dict[str, Any]:
    source_path = ensure_source(config, allow_download)
    qa_directory = project_path(config["outputs"]["qaDirectory"])
    qa_directory.mkdir(parents=True, exist_ok=True)

    desktop_config = config["outputs"]["desktop"]
    desktop_path = project_path(desktop_config["path"])
    mobile_config = config["outputs"]["mobile"]
    mobile_path = project_path(mobile_config["path"])
    if resume_qa_from_rendered_assets:
        if not desktop_path.exists() or not mobile_path.exists():
            raise FileNotFoundError("--resume-qa requires both already-rendered WebP assets")
        with Image.open(desktop_path) as desktop_handle:
            desktop = desktop_handle.convert("RGB")
        with Image.open(mobile_path) as mobile_handle:
            mobile = mobile_handle.convert("RGB")
        expected_desktop_size = (int(desktop_config["width"]), int(desktop_config["height"]))
        expected_mobile_size = (int(mobile_config["width"]), int(mobile_config["height"]))
        if desktop.size != expected_desktop_size or mobile.size != expected_mobile_size:
            raise ValueError("Existing rendered assets do not match the pinned output dimensions")
        before_feather_seams = seam_metrics(desktop)
        seam_feather_record = {
            "sourceDerived": True,
            "policy": "Already applied in the existing delivered assets used for QA recovery.",
            "seams": [],
        }
        sample_longitudes, sample_latitudes = np.meshgrid(
            np.linspace(-180, 180, 1441, endpoint=False),
            np.linspace(90, -90, 721),
        )
        sample_x, sample_y = source_coordinates(sample_longitudes, sample_latitudes, config)
        sampled_bounds = {
            "minX": round(float(np.min(sample_x)), 3),
            "maxX": round(float(np.max(sample_x)), 3),
            "minY": round(float(np.min(sample_y)), 3),
            "maxY": round(float(np.max(sample_y)), 3),
        }
    else:
        with Image.open(source_path) as source_handle:
            source_image = source_handle.convert("RGB")
        desktop, sampled_bounds = render_equirectangular(
            source_image,
            int(desktop_config["width"]),
            int(desktop_config["height"]),
            config,
        )
        before_feather_seams = seam_metrics(desktop)
        desktop, seam_feather_record = feather_canonical_seams(desktop, config)
        save_webp(desktop, desktop_path, int(desktop_config["webpQuality"]))
        mobile = desktop.resize(
            (int(mobile_config["width"]), int(mobile_config["height"])),
            Image.Resampling.LANCZOS,
        )
        save_webp(mobile, mobile_path, int(mobile_config["webpQuality"]))

    with Image.open(desktop_path) as desktop_handle:
        delivered_desktop = desktop_handle.convert("RGB")
    with Image.open(mobile_path) as mobile_handle:
        delivered_mobile = mobile_handle.convert("RGB")
    alignment, preview_paths = make_qa_previews(delivered_mobile, config, qa_directory)
    desktop_record = artifact_record(desktop_path, desktop.width, desktop.height)
    mobile_record = artifact_record(mobile_path, mobile.width, mobile.height)
    manifest: dict[str, Any] = {
        "schemaVersion": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "editionId": config["id"],
        "textureContentVersion": texture_content_version(desktop_record, mobile_record),
        "overlayProfile": config["outputs"]["overlayProfile"],
        "modernCoastlineBaked": config["outputs"]["modernCoastlineBaked"],
        "source": {
            "path": config["acquisition"]["localPath"],
            "pageUrl": config["acquisition"]["pageUrl"],
            "originalUrl": config["acquisition"]["originalUrl"],
            "width": config["source"]["width"],
            "height": config["source"]["height"],
            "bytes": config["source"]["bytes"],
            "sha256": config["source"]["sha256"],
            "rights": config["rights"],
        },
        "render": {
            "projection": config["projection"]["targetName"],
            "method": config["projection"]["method"],
            "sourceSamplingBounds": sampled_bounds,
            "polarPolicy": config["projection"]["polarPolicy"],
            "colorPolicy": config["source"]["colorPolicy"],
            "canonicalSeamFeather": seam_feather_record,
        },
        "artifacts": {
            "desktop": desktop_record,
            "mobile": mobile_record,
            "qaPreviews": [artifact_record(path) for path in preview_paths],
        },
        "qa": {
            "gridCalibration": calibration_metrics(config),
            "coastlineLineworkProxy": alignment,
            "canonicalSeams": {
                "beforeFeather": before_feather_seams,
                "deliveredAfterFeather": seam_metrics(delivered_desktop),
            },
        },
    }

    manifest_path = qa_directory / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report_path = qa_directory / "README.md"
    write_report(manifest, report_path)
    manifest["artifacts"]["manifest"] = artifact_record(manifest_path)
    manifest["artifacts"]["report"] = artifact_record(report_path)
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--download",
        action="store_true",
        help="Acquire the exact pinned Commons source if it is absent.",
    )
    parser.add_argument(
        "--verify-source-only",
        action="store_true",
        help="Verify the pinned source without rendering production assets.",
    )
    parser.add_argument(
        "--resume-qa",
        action="store_true",
        help="Resume QA/manifest generation from complete rendered assets after a QA-only failure.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config()
    if args.verify_source_only:
        source_path = ensure_source(config, args.download)
        print(f"Verified {source_path.relative_to(ROOT).as_posix()}")
        return 0
    manifest = build(config, args.download, args.resume_qa)
    print(json.dumps({
        "editionId": manifest["editionId"],
        "textureContentVersion": manifest["textureContentVersion"],
        "desktop": manifest["artifacts"]["desktop"],
        "mobile": manifest["artifacts"]["mobile"],
        "gridCalibration": manifest["qa"]["gridCalibration"]["combined"],
        "coastlineLineworkProxy": manifest["qa"]["coastlineLineworkProxy"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
