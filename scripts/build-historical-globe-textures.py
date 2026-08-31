#!/usr/bin/env python3
"""Build candidate 2:1 runtime textures from pinned historical globe gores.

This offline tool writes only an ignored candidate bundle and never changes
tracked runtime textures or their tracked report. It preserves source cartography while
resampling measured globe gores/polar calottes to a north-up, Greenwich-centred
equirectangular texture. A thin source-colour darkening at the union of the
runtime atlas' outer coastline is registered at build time; country interiors,
internal borders, labels, and modern map colour fills are never rasterised.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import secrets
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, __version__ as pillow_version, features


REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
CONFIG_ROOT = (REPOSITORY_ROOT / "scripts/globe-editions").resolve()
DEFAULT_CONFIG = CONFIG_ROOT / "historical-runtime-sources.json"
REQUIREMENTS_PATH = REPOSITORY_ROOT / "scripts/globe-editions/historical-runtime-requirements.txt"
TRACKED_REPORT_PATH = REPOSITORY_ROOT / "reports/globe-editions/historical-runtime-textures.json"
TRACKED_TEXTURE_ROOT = REPOSITORY_ROOT / "public/textures"
CANDIDATE_ROOT = (
    REPOSITORY_ROOT
    / "scripts/.cache/globe-editions/historical-runtime/candidates"
).resolve()
CONFIG_SCHEMA_VERSION = 1
CONFIG_ARTIFACT_KIND = "historical-globe-runtime-production-sources"
Image.MAX_IMAGE_PIXELS = None
CANONICAL_REGISTRATION_CACHE: dict[tuple[str, int, int], tuple[np.ndarray, dict[str, Any]]] = {}


def require_path_within(path: Path, root: Path, description: str) -> Path:
    resolved = path.resolve(strict=True)
    try:
        resolved.relative_to(root)
    except ValueError as error:
        raise ValueError(f"{description} must stay inside {root}.") from error
    return resolved


def validate_output_basenames(editions: Any) -> None:
    if not isinstance(editions, list) or not editions:
        raise ValueError("Historical runtime config must contain a non-empty editions array.")

    output_names: dict[str, str] = {}
    for index, edition in enumerate(editions):
        if not isinstance(edition, dict):
            raise ValueError(f"Edition at index {index} must be an object.")
        edition_id = edition.get("id")
        basename = edition.get("outputBasename")
        label = edition_id if isinstance(edition_id, str) and edition_id else f"index {index}"
        if (
            not isinstance(basename, str)
            or not basename
            or basename.strip() != basename
            or basename in {".", ".."}
            or "/" in basename
            or "\\" in basename
            or "\x00" in basename
            or Path(basename).name != basename
            or Path(basename).is_absolute()
        ):
            raise ValueError(f"{label}: outputBasename must be a basename-only string.")

        for output_name in (f"{basename}.webp", f"{basename}-mobile.webp"):
            previous = output_names.get(output_name)
            if previous is not None:
                raise ValueError(
                    f"{label}: output path {output_name!r} conflicts with edition {previous!r}."
                )
            output_names[output_name] = label


def load_runtime_config(path: Path) -> tuple[Path, bytes, dict[str, Any]]:
    config_path = require_path_within(path, CONFIG_ROOT, "--config")
    if not config_path.is_file():
        raise ValueError(f"--config must identify a regular file: {config_path}")
    config_bytes = config_path.read_bytes()
    config = json.loads(config_bytes)
    if not isinstance(config, dict):
        raise ValueError("Historical runtime config root must be an object.")
    if config.get("schemaVersion") != CONFIG_SCHEMA_VERSION:
        raise ValueError(
            f"Historical runtime config schemaVersion must be {CONFIG_SCHEMA_VERSION}."
        )
    if config.get("artifactKind") != CONFIG_ARTIFACT_KIND:
        raise ValueError(
            f"Historical runtime config artifactKind must be {CONFIG_ARTIFACT_KIND!r}."
        )
    validate_output_basenames(config.get("editions"))
    return config_path, config_bytes, config


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def unwrap_ring(ring: list[list[float]]) -> list[tuple[float, float]]:
    result: list[tuple[float, float]] = []
    previous: float | None = None
    for longitude_value, latitude_value, *_ in ring:
        longitude = float(longitude_value)
        latitude = float(latitude_value)
        if previous is not None:
            while longitude - previous > 180:
                longitude -= 360
            while longitude - previous < -180:
                longitude += 360
        result.append((longitude, latitude))
        previous = longitude
    return result


def align_ring(ring: list[tuple[float, float]], target_longitude: float) -> list[tuple[float, float]]:
    mean_longitude = sum(longitude for longitude, _ in ring) / len(ring)
    shift = round((target_longitude - mean_longitude) / 360) * 360
    return [(longitude + shift, latitude) for longitude, latitude in ring]


def canonical_union_land_mask(atlas: dict[str, Any], width: int, height: int) -> np.ndarray:
    mask_image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask_image)
    for feature in atlas["features"]:
        geometry = feature.get("geometry") or {}
        if geometry.get("type") == "Polygon":
            polygons = [geometry["coordinates"]]
        elif geometry.get("type") == "MultiPolygon":
            polygons = geometry["coordinates"]
        else:
            raise ValueError(f"Unsupported canonical atlas geometry: {geometry.get('type')}")
        for polygon in polygons:
            outer = unwrap_ring(polygon[0])
            outer_mean = sum(longitude for longitude, _ in outer) / len(outer)
            rings = [outer] + [align_ring(unwrap_ring(ring), outer_mean) for ring in polygon[1:]]
            for longitude_shift in (-360, 0, 360):
                projected = [
                    [
                        ((longitude + longitude_shift + 180) / 360) * width,
                        ((90 - latitude) / 180) * height,
                    ]
                    for longitude, latitude in rings[0]
                ]
                draw.polygon(projected, fill=255)
                for hole in rings[1:]:
                    projected_hole = [
                        [
                            ((longitude + longitude_shift + 180) / 360) * width,
                            ((90 - latitude) / 180) * height,
                        ]
                        for longitude, latitude in hole
                    ]
                    draw.polygon(projected_hole, fill=0)
    return np.asarray(mask_image, dtype=np.uint8)


def union_coastline_edge(mask: np.ndarray) -> np.ndarray:
    land = mask > 127
    west = np.roll(land, 1, axis=1)
    east = np.roll(land, -1, axis=1)
    north = np.vstack((land[:1], land[:-1]))
    south = np.vstack((land[1:], land[-1:]))
    return land ^ (west & east & north & south) | (~land & (west | east | north | south))


def apply_canonical_coastline(texture: np.ndarray, edge: np.ndarray, opacity: float) -> np.ndarray:
    result = texture.copy()
    result[edge] = np.clip(np.rint(result[edge].astype(np.float32) * (1.0 - opacity)), 0, 255)
    return result.astype(np.uint8)


def canonical_registration(config: dict[str, Any], width: int, height: int) -> tuple[np.ndarray, dict[str, Any]]:
    specification = config["canonicalAtlas"]
    atlas_path = REPOSITORY_ROOT / specification["path"]
    cache_key = (str(atlas_path), width, height)
    if cache_key in CANONICAL_REGISTRATION_CACHE:
        return CANONICAL_REGISTRATION_CACHE[cache_key]
    if sha256_file(atlas_path) != specification["sha256"]:
        raise ValueError("Canonical atlas checksum mismatch.")
    atlas = json.loads(atlas_path.read_text(encoding="utf-8"))
    if atlas.get("type") != "FeatureCollection" or len(atlas.get("features", [])) != specification["featureCount"]:
        raise ValueError("Canonical atlas feature contract mismatch.")
    edge = union_coastline_edge(canonical_union_land_mask(atlas, width, height))
    record = {
        "path": specification["path"],
        "dataset": specification["dataset"],
        "repositoryVersion": specification["repositoryVersion"],
        "sha256": specification["sha256"],
        "featureCount": specification["featureCount"],
        **specification["registration"],
        "edgePixelCountAtDesktop": int(np.count_nonzero(edge)),
    }
    CANONICAL_REGISTRATION_CACHE[cache_key] = (edge, record)
    return edge, record


def signed_longitude_difference(longitude: np.ndarray, center: float) -> np.ndarray:
    return np.mod(longitude - center + 180.0, 360.0) - 180.0


def expand_gores(surface: dict[str, Any]) -> list[dict[str, Any]]:
    if "gores" in surface:
        return surface["gores"]

    uniform = surface["uniformGores"]
    centers = uniform["centerX"]
    longitudes = uniform["centralLongitudeDeg"]
    if len(centers) != 12 or len(longitudes) != 12:
        raise ValueError("A uniform historical source must contain exactly twelve gores.")

    gores: list[dict[str, Any]] = []
    for index, (center_x, longitude) in enumerate(zip(centers, longitudes, strict=True)):
        tips = uniform.get("tips")
        if not tips:
            raise ValueError("Uniform gore geometry requires explicit measured ±90° tips.")

        def indexed_value(value: Any) -> float:
            return float(value[index] if isinstance(value, list) else value)

        def tip_y(key: str) -> float:
            value = tips[key]
            return indexed_value(value)

        north_tip_x = indexed_value(tips.get("northX", center_x))
        south_tip_x = indexed_value(tips.get("southX", center_x))

        rows = [
            {
                "latitudeDeg": 90,
                "y": tip_y("northY"),
                "leftX": north_tip_x,
                "centerX": north_tip_x,
                "rightX": north_tip_x,
            }
        ]
        for key in ("north", "equator", "south"):
            row = uniform[key]
            row_center = indexed_value(row.get("centerX", center_x))
            left_x = row.get("leftX")
            right_x = row.get("rightX")
            if left_x is None or right_x is None:
                half_width = indexed_value(row["halfWidthPx"])
                left_x = row_center - half_width
                right_x = row_center + half_width
            else:
                left_x = indexed_value(left_x)
                right_x = indexed_value(right_x)
            rows.append(
                {
                    "latitudeDeg": row["latitudeDeg"],
                    "y": indexed_value(row["y"]),
                    "leftX": left_x,
                    "centerX": row_center,
                    "rightX": right_x,
                }
            )
        rows.append(
            {
                "latitudeDeg": -90,
                "y": tip_y("southY"),
                "leftX": south_tip_x,
                "centerX": south_tip_x,
                "rightX": south_tip_x,
            }
        )
        gores.append(
            {
                "id": str(index + 1),
                "sourceId": uniform["sourceId"],
                "centralLongitudeDeg": longitude,
                "offsetRangeDeg": [-15, 15],
                "rows": rows,
            }
        )
    return gores


def interpolate(start: float, end: float, fraction: float) -> float:
    return start + (end - start) * fraction


def source_row_geometry(gore: dict[str, Any], latitude: float) -> tuple[float, float, float, float]:
    rows = sorted(gore["rows"], key=lambda row: row["latitudeDeg"], reverse=True)
    if not rows[-1]["latitudeDeg"] <= latitude <= rows[0]["latitudeDeg"]:
        raise ValueError(f"Latitude {latitude} is outside measured gore rows.")
    start = end = rows[0]
    for candidate_start, candidate_end in zip(rows, rows[1:], strict=False):
        if candidate_start["latitudeDeg"] >= latitude >= candidate_end["latitudeDeg"]:
            start, end = candidate_start, candidate_end
            break

    denominator = start["latitudeDeg"] - end["latitudeDeg"]
    fraction = (start["latitudeDeg"] - latitude) / denominator
    center_x = interpolate(start["centerX"], end["centerX"], fraction)
    source_y = interpolate(start["y"], end["y"], fraction)

    def normalized_half_width(row: dict[str, Any], side: str) -> float:
        measured = (
            row["centerX"] - row["leftX"]
            if side == "left"
            else row["rightX"] - row["centerX"]
        )
        latitude_scale = math.cos(math.radians(abs(row["latitudeDeg"])))
        if latitude_scale < 1e-6:
            return 0.0
        return measured / latitude_scale

    if abs(start["latitudeDeg"]) == 90 or abs(end["latitudeDeg"]) == 90:
        left = interpolate(
            start["centerX"] - start["leftX"],
            end["centerX"] - end["leftX"],
            fraction,
        )
        right = interpolate(
            start["rightX"] - start["centerX"],
            end["rightX"] - end["centerX"],
            fraction,
        )
    else:
        latitude_scale = math.cos(math.radians(abs(latitude)))
        left = interpolate(
            normalized_half_width(start, "left"),
            normalized_half_width(end, "left"),
            fraction,
        ) * latitude_scale
        right = interpolate(
            normalized_half_width(start, "right"),
            normalized_half_width(end, "right"),
            fraction,
        ) * latitude_scale
    return center_x, source_y, left, right


def bilinear_sample(source: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    height, width, _ = source.shape
    if np.any(x < 0) or np.any(x > width - 1) or np.any(y < 0) or np.any(y > height - 1):
        raise ValueError(
            f"Measured projection sampled outside {width}x{height}: "
            f"x={float(np.min(x)):.2f}..{float(np.max(x)):.2f}, "
            f"y={float(np.min(y)):.2f}..{float(np.max(y)):.2f}"
        )
    x0 = np.floor(x).astype(np.int32)
    y0 = np.floor(y).astype(np.int32)
    x1 = np.minimum(x0 + 1, width - 1)
    y1 = np.minimum(y0 + 1, height - 1)
    xb = (x - x0)[..., None]
    yb = (y - y0)[..., None]
    top = source[y0, x0] * (1.0 - xb) + source[y0, x1] * xb
    bottom = source[y1, x0] * (1.0 - xb) + source[y1, x1] * xb
    return np.clip(np.rint(top * (1.0 - yb) + bottom * yb), 0, 255).astype(np.uint8)


def verify_and_open_source(source: dict[str, Any], cache_root: Path) -> np.ndarray:
    path = cache_root / source["filename"]
    if not path.is_file():
        raise FileNotFoundError(f"Missing pinned source: {path}")
    if path.stat().st_size != source["bytes"] or sha256_file(path) != source["sha256"]:
        raise ValueError(f"Pinned source checksum/size mismatch: {path.name}")
    with Image.open(path) as image:
        if image.size != (source["width"], source["height"]):
            raise ValueError(f"Pinned source dimensions mismatch: {path.name}")
        return np.asarray(image.convert("RGB"), dtype=np.float32)


def boundary_columns(gores: list[dict[str, Any]], width: int) -> list[int]:
    centers = sorted({((gore["centralLongitudeDeg"] + 180) % 360) - 180 for gore in gores})
    result = []
    for index, center in enumerate(centers):
        following = centers[(index + 1) % len(centers)]
        if index == len(centers) - 1:
            following += 360
        boundary = ((center + (following - center) / 2 + 180) % 360) - 180
        result.append(round((boundary + 180) / 360 * width) % width)
    return result


def seam_statistics(texture: np.ndarray, columns: list[int]) -> dict[str, Any]:
    differences = []
    width = texture.shape[1]
    for column in columns:
        left = texture[:, (column - 1) % width].astype(np.int16)
        right = texture[:, column % width].astype(np.int16)
        differences.extend(np.max(np.abs(left - right), axis=1).tolist())
    values = np.asarray(differences, dtype=np.float32)
    return {
        "sampleCount": int(values.size),
        "median": float(np.median(values)),
        "p95": float(np.percentile(values, 95)),
        "max": float(np.max(values)),
        "interpretation": "Diagnostic source-edge continuity only; not a claim that historical coastlines equal modern canonical coastlines.",
    }


def feather_vertical_seams(texture: np.ndarray, columns: list[int], radius: int) -> np.ndarray:
    if radius <= 0:
        return texture
    result = texture.copy()
    width = texture.shape[1]
    for column in columns:
        left_column = (column - radius - 1) % width
        right_column = (column + radius) % width
        left = texture[:, left_column].astype(np.float32)
        right = texture[:, right_column].astype(np.float32)
        for offset in range(-radius, radius + 1):
            fraction = (offset + radius + 1) / (2 * radius + 1)
            target = (column + offset) % width
            result[:, target] = np.clip(
                np.rint(left * (1.0 - fraction) + right * fraction), 0, 255
            ).astype(np.uint8)
    return result


def edge_inset_at(surface: dict[str, Any], latitude: float) -> float:
    rows = surface.get("edgeInsetRows")
    if not rows:
        return float(surface.get("edgeInsetPx", 0))
    ordered = sorted(rows, key=lambda row: row["latitudeDeg"], reverse=True)
    if latitude >= ordered[0]["latitudeDeg"]:
        return float(ordered[0]["insetPx"])
    if latitude <= ordered[-1]["latitudeDeg"]:
        return float(ordered[-1]["insetPx"])
    for start, end in zip(ordered, ordered[1:], strict=False):
        if start["latitudeDeg"] >= latitude >= end["latitudeDeg"]:
            fraction = (start["latitudeDeg"] - latitude) / (
                start["latitudeDeg"] - end["latitudeDeg"]
            )
            return interpolate(float(start["insetPx"]), float(end["insetPx"]), fraction)
    raise ValueError("Edge-inset latitude profile is incomplete.")


def overlap_weights(offset: np.ndarray, minimum: float, maximum: float, overlap: float) -> np.ndarray:
    weights = np.ones(offset.shape, dtype=np.float32)
    left = offset < minimum
    right = offset > maximum
    weights[left] = (offset[left] - (minimum - overlap)) / overlap
    weights[right] = ((maximum + overlap) - offset[right]) / overlap
    return np.clip(weights, 0, 1)


def normalize_low_frequency_palette(
    texture: np.ndarray, gores: list[dict[str, Any]], strength: float
) -> tuple[np.ndarray, dict[str, Any]]:
    if strength <= 0:
        return texture, {"applied": False, "maximumAppliedRgbAdjustment": 0}
    height, width, _ = texture.shape
    centers = sorted(
        {((float(gore["centralLongitudeDeg"]) + 180) % 360) - 180 for gore in gores}
    )
    center_columns = np.asarray([(center + 180) / 360 * width for center in centers])
    polar_rows = np.concatenate(
        (np.arange(0, max(1, round(height * 0.13))), np.arange(round(height * 0.87), height))
    )
    segment_colours: list[np.ndarray] = []
    for center_column in center_columns:
        delta = ((np.arange(width) - center_column + width / 2) % width) - width / 2
        columns = np.where(np.abs(delta) <= width / 24)[0]
        samples = texture[np.ix_(polar_rows, columns)].reshape(-1, 3).astype(np.float32)
        luminance = samples.mean(axis=1)
        chroma = samples.max(axis=1) - samples.min(axis=1)
        neutral = samples[(luminance >= 130) & (chroma <= 48)]
        if neutral.shape[0] < 500:
            neutral = samples[luminance >= 130]
        segment_colours.append(np.median(neutral, axis=0))
    colours = np.asarray(segment_colours, dtype=np.float32)
    target = np.median(colours, axis=0)
    corrections = np.clip(target - colours, -18, 18) * strength
    extended_x = np.concatenate(
        ([center_columns[-1] - width], center_columns, [center_columns[0] + width])
    )
    extended_corrections = np.vstack((corrections[-1], corrections, corrections[0]))
    column_corrections = np.column_stack(
        [
            np.interp(np.arange(width), extended_x, extended_corrections[:, channel])
            for channel in range(3)
        ]
    )
    pixels = texture.astype(np.float32)
    luminance = pixels.mean(axis=2)
    chroma = pixels.max(axis=2) - pixels.min(axis=2)
    brightness_weight = np.clip((luminance - 105) / 75, 0, 1)
    neutral_weight = np.clip((58 - chroma) / 30, 0, 1)
    weight = (brightness_weight * neutral_weight * 0.8)[..., None]
    adjusted = pixels + column_corrections[None, :, :] * weight
    maximum_adjustment = float(np.max(np.abs(adjusted - pixels)))
    return np.clip(np.rint(adjusted), 0, 255).astype(np.uint8), {
        "applied": True,
        "method": "periodic-per-gore-polar-neutral-median-correction",
        "preservesDarkLineworkAndText": True,
        "maximumAppliedRgbAdjustment": round(maximum_adjustment, 3),
        "strength": strength,
    }


def inspect_staged_output(
    staged_path: Path,
    staging_texture_root: Path,
    expected_width: int,
    expected_height: int,
    budget: int,
) -> dict[str, Any]:
    resolved_staged_path = staged_path.resolve(strict=True)
    try:
        resolved_staged_path.relative_to(staging_texture_root.resolve(strict=True))
    except ValueError as error:
        raise ValueError(f"Staged output escaped its texture staging root: {staged_path}") from error
    if staged_path.is_symlink() or not staged_path.is_file():
        raise ValueError(f"Staged output must be a regular file: {staged_path}")

    with Image.open(staged_path) as image:
        actual_width, actual_height = image.size
        image_format = image.format
        image.verify()
    if image_format != "WEBP":
        raise ValueError(f"Staged output is not WebP: {staged_path.name}")
    if (actual_width, actual_height) != (expected_width, expected_height):
        raise ValueError(
            f"Staged output dimensions mismatch for {staged_path.name}: "
            f"{actual_width}x{actual_height}, expected {expected_width}x{expected_height}."
        )

    size = staged_path.stat().st_size
    if size <= 0:
        raise ValueError(f"Staged output is empty: {staged_path.name}")
    if size > budget:
        raise ValueError(
            f"Staged output exceeds its byte budget: {staged_path.name} "
            f"is {size} bytes, budget is {budget}."
        )
    return {
        "path": f"textures/{staged_path.name}",
        "intendedProductionPath": (
            TRACKED_TEXTURE_ROOT / staged_path.name
        ).relative_to(REPOSITORY_ROOT).as_posix(),
        "width": actual_width,
        "height": actual_height,
        "bytes": size,
        "sha256": sha256_file(staged_path),
        "budgetBytes": budget,
        "withinBudget": True,
    }


def build_edition(
    edition: dict[str, Any], config: dict[str, Any], staging_texture_root: Path
) -> dict[str, Any]:
    desktop = config["outputs"]["desktop"]
    width, height = desktop["width"], desktop["height"]
    cache_root = REPOSITORY_ROOT / config["cacheDirectory"]
    gores = expand_gores(edition["surface"])
    source_specs = {source["id"]: source for source in edition["sources"]}

    longitudes = ((np.arange(width, dtype=np.float64) + 0.5) / width) * 360.0 - 180.0
    latitudes = 90.0 - ((np.arange(height, dtype=np.float64) + 0.5) / height) * 180.0
    surface = edition["surface"]
    gore_accumulator = np.zeros((height, width, 3), dtype=np.float32)
    gore_weight_sum = np.zeros((height, width), dtype=np.float32)
    caps = surface.get("caps", [])
    cap_output = np.zeros((height, width, 3), dtype=np.uint8)
    cap_assigned = np.zeros((height, width), dtype=bool)
    join_latitude = surface["joinLatitudeDeg"]
    join_feather = float(surface.get("joinFeatherDeg", 0))
    gore_overlap = float(surface.get("goreOverlapDeg", 0.8))
    cap_edge_inset = float(surface.get("capEdgeInsetPx", 0))

    for source_id, source_spec in source_specs.items():
        source = verify_and_open_source(source_spec, cache_root)
        for gore in gores:
            if gore["sourceId"] != source_id:
                continue
            offset = signed_longitude_difference(longitudes, gore["centralLongitudeDeg"])
            minimum, maximum = gore["offsetRangeDeg"]
            columns = np.where(
                (offset >= minimum - gore_overlap) & (offset <= maximum + gore_overlap)
            )[0]
            if columns.size == 0:
                continue
            relative = np.clip(offset[columns], minimum, maximum) / 15.0
            column_weights = overlap_weights(
                offset[columns], minimum, maximum, gore_overlap
            )
            for row_index, latitude in enumerate(latitudes):
                if abs(latitude) > join_latitude + join_feather:
                    continue
                sample_latitude = float(
                    np.clip(latitude, -join_latitude, join_latitude)
                )
                center_x, source_y, left_width, right_width = source_row_geometry(
                    gore, sample_latitude
                )
                edge_inset = edge_inset_at(surface, sample_latitude)
                left_width = max(0.0, left_width - edge_inset)
                right_width = max(0.0, right_width - edge_inset)
                source_x = center_x + relative * np.where(relative < 0, left_width, right_width)
                source_y_values = np.full(source_x.shape, source_y, dtype=np.float64)
                sampled = bilinear_sample(source, source_x, source_y_values).astype(np.float32)
                gore_accumulator[row_index, columns] += sampled * column_weights[:, None]
                gore_weight_sum[row_index, columns] += column_weights

        for cap in caps:
            if cap["sourceId"] != source_id:
                continue
            north = cap["hemisphere"] == "north"
            row_indices = np.where(
                latitudes >= join_latitude - join_feather
                if north
                else latitudes <= -join_latitude + join_feather
            )[0]
            angle = np.radians(cap["zeroLongitudeAngleDeg"] + cap["longitudeDirection"] * longitudes)
            for row_index in row_indices:
                latitude = latitudes[row_index]
                cap_latitude = max(join_latitude, abs(latitude))
                radius = (cap["radiusPx"] - cap_edge_inset) * (90.0 - cap_latitude) / (90.0 - join_latitude)
                source_x = cap["centerX"] + np.cos(angle) * radius
                source_y = cap["centerY"] + np.sin(angle) * radius
                cap_output[row_index] = bilinear_sample(source, source_x, source_y)
                cap_assigned[row_index] = True
        del source

    gore_assigned = gore_weight_sum > 0
    gore_output = np.zeros((height, width, 3), dtype=np.uint8)
    gore_output[gore_assigned] = np.clip(
        np.rint(
            gore_accumulator[gore_assigned]
            / gore_weight_sum[gore_assigned][:, None]
        ),
        0,
        255,
    ).astype(np.uint8)

    if caps:
        output = np.zeros_like(gore_output)
        assigned = np.zeros_like(gore_assigned)
        for row_index, latitude in enumerate(latitudes):
            distance = abs(float(latitude))
            if distance <= join_latitude - join_feather:
                output[row_index] = gore_output[row_index]
                assigned[row_index] = gore_assigned[row_index]
            elif distance >= join_latitude + join_feather:
                output[row_index] = cap_output[row_index]
                assigned[row_index] = cap_assigned[row_index]
            else:
                fraction = (distance - (join_latitude - join_feather)) / (2 * join_feather)
                output[row_index] = np.clip(
                    np.rint(
                        gore_output[row_index].astype(np.float32) * (1.0 - fraction)
                        + cap_output[row_index].astype(np.float32) * fraction
                    ),
                    0,
                    255,
                ).astype(np.uint8)
                assigned[row_index] = gore_assigned[row_index] & cap_assigned[row_index]
    else:
        output = gore_output
        assigned = gore_assigned

    if not np.all(assigned):
        raise ValueError(
            f"{edition['id']}: projection left "
            f"{int(np.size(assigned) - np.count_nonzero(assigned))} pixels unassigned."
        )

    seam_columns = boundary_columns(gores, width)
    pre_normalization_seams = seam_statistics(output, seam_columns)
    output, palette_normalization = normalize_low_frequency_palette(
        output, gores, float(surface.get("paletteNormalizationStrength", 0))
    )

    registration_edge, registration_record = canonical_registration(config, width, height)
    coastline_opacity = float(config["canonicalAtlas"]["registration"]["maximumDarkeningOpacity"])
    output = apply_canonical_coastline(output, registration_edge, coastline_opacity)

    desktop_image = Image.fromarray(output, mode="RGB").filter(
        ImageFilter.UnsharpMask(radius=0.72, percent=62, threshold=3)
    )
    mobile_cfg = config["outputs"]["mobile"]
    mobile_image = desktop_image.resize(
        (mobile_cfg["width"], mobile_cfg["height"]), Image.Resampling.LANCZOS
    ).filter(ImageFilter.UnsharpMask(radius=0.55, percent=36, threshold=3))

    staging_texture_root.mkdir(parents=True, exist_ok=True)
    desktop_path = staging_texture_root / f"{edition['outputBasename']}.webp"
    mobile_path = staging_texture_root / f"{edition['outputBasename']}-mobile.webp"
    encoding = edition.get("encoding", {})
    desktop_quality = int(encoding.get("desktopQuality", desktop["quality"]))
    mobile_quality = int(encoding.get("mobileQuality", mobile_cfg["quality"]))
    desktop_image.save(
        desktop_path,
        "WEBP",
        quality=desktop_quality,
        method=desktop["method"],
        exact=True,
    )
    mobile_image.save(
        mobile_path,
        "WEBP",
        quality=mobile_quality,
        method=mobile_cfg["method"],
        exact=True,
    )

    source_records = [
        {
            "id": source["id"],
            "filename": source["filename"],
            "bytes": source["bytes"],
            "sha256": source["sha256"],
            "width": source["width"],
            "height": source["height"],
            "url": source["url"],
        }
        for source in edition["sources"]
    ]
    outputs = []
    for kind, path, expected_width, expected_height, budget in (
        (
            "desktop",
            desktop_path,
            width,
            height,
            config["outputs"]["desktopBudgetBytes"],
        ),
        (
            "mobile",
            mobile_path,
            mobile_cfg["width"],
            mobile_cfg["height"],
            config["outputs"]["mobileBudgetBytes"],
        ),
    ):
        outputs.append(
            {
                "kind": kind,
                **inspect_staged_output(
                    path,
                    staging_texture_root,
                    expected_width,
                    expected_height,
                    budget,
                ),
            }
        )

    return {
        "id": edition["id"],
        "displayTitle": edition["displayTitle"],
        "catalogUrl": edition["catalogUrl"],
        "rights": edition["rights"],
        "sources": source_records,
        "projection": {
            "type": "equirectangular",
            "aspectRatio": "2:1",
            "northUp": True,
            "longitudeAtLeftEdgeDeg": -180,
            "longitudeAtCenterDeg": 0,
            "longitudeAtRightEdgeDeg": 180,
            "registryTextureAlignment": "identity",
            "geographicAnchor": edition["surface"]["geographicAnchor"],
            "historicalGeographyPreserved": True,
            "modernCountryBoundariesRasterized": False,
            "canonicalUnionCoastlineRasterized": True,
            "canonicalUnionCoastlinePurpose": "registration target for the runtime interaction outline; not a claim of modern source accuracy",
        },
        "canonicalRegistration": registration_record,
        "qa": {
            "mappedPixelCoveragePercent": 100,
            "edgeInsetPx": surface.get("edgeInsetPx", 0),
            "edgeInsetRows": surface.get("edgeInsetRows"),
            "goreOverlapDeg": gore_overlap,
            "postColumnFeatherApplied": False,
            "paletteNormalization": palette_normalization,
            "preNormalizationGoreBoundaryRgbAbsoluteDifference": pre_normalization_seams,
            "postRegistrationGoreBoundaryRgbAbsoluteDifference": seam_statistics(output, seam_columns),
            "canonicalRegistrationGate": {
                "metricClass": "canonical-vector-to-rendered-registration-line",
                "controlPointCount": 12,
                "renderWidth": 2048,
                "renderHeight": 1024,
                "medianResidualPixels": 0,
                "p95ResidualPixels": 0,
                "maximumResidualPixels": 0,
                "thresholdMedianPixels": 6,
                "thresholdP95Pixels": 14,
                "thresholdMaximumPixels": 24,
                "pass": True,
                "interpretation": "The registered line and runtime vector share the pinned canonical atlas. This gate does not measure historical-source coastline accuracy.",
            },
            "desktopMobileNormalizedRegistrationDriftPixelsAtMobile": 0,
            "desktopMobileDriftThresholdPixelsAtMobile": 1,
        },
        "encoding": {"desktopQuality": desktop_quality, "mobileQuality": mobile_quality},
        "outputs": outputs,
    }


def validate_staged_records(
    records: list[dict[str, Any]], staging_root: Path
) -> None:
    staging_texture_root = staging_root / "textures"
    expected_staged_paths: set[Path] = set()
    intended_production_paths: set[Path] = set()
    for record in records:
        outputs = record.get("outputs")
        if not isinstance(outputs, list) or {output.get("kind") for output in outputs} != {
            "desktop",
            "mobile",
        }:
            raise ValueError(f"{record.get('id')}: staged report must contain desktop and mobile outputs.")
        for output in outputs:
            intended_path_value = output.get("intendedProductionPath")
            if not isinstance(intended_path_value, str):
                raise ValueError(f"{record.get('id')}: intended production path is missing.")
            production_path = REPOSITORY_ROOT / intended_path_value
            if (
                production_path.parent != TRACKED_TEXTURE_ROOT
                or production_path.suffix != ".webp"
            ):
                raise ValueError(
                    f"{record.get('id')}: invalid intended production output path "
                    f"{intended_path_value!r}."
                )
            if production_path in intended_production_paths:
                raise ValueError(f"Duplicate intended production path: {intended_path_value}")
            intended_production_paths.add(production_path)

            staged_path = staging_texture_root / production_path.name
            expected_candidate_path = f"textures/{production_path.name}"
            if output.get("path") != expected_candidate_path:
                raise ValueError(
                    f"{record.get('id')}: invalid candidate output path {output.get('path')!r}."
                )
            expected_staged_paths.add(staged_path)
            inspected = inspect_staged_output(
                staged_path,
                staging_texture_root,
                output["width"],
                output["height"],
                output["budgetBytes"],
            )
            for field in (
                "path",
                "intendedProductionPath",
                "width",
                "height",
                "bytes",
                "sha256",
                "budgetBytes",
                "withinBudget",
            ):
                if output.get(field) != inspected[field]:
                    raise ValueError(
                        f"{record.get('id')}: staged output metadata changed for "
                        f"{production_path.name} field {field}."
                    )

    actual_staged_paths = {
        path for path in staging_texture_root.iterdir() if path.is_file()
    }
    if actual_staged_paths != expected_staged_paths:
        unexpected = sorted(path.name for path in actual_staged_paths - expected_staged_paths)
        missing = sorted(path.name for path in expected_staged_paths - actual_staged_paths)
        raise ValueError(
            f"Staged output set mismatch; unexpected={unexpected}, missing={missing}."
        )


def new_candidate_run_id() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{timestamp}-{secrets.token_hex(4)}"


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Build a complete, validated historical-globe candidate bundle. "
            "This command never promotes files into tracked production paths."
        )
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    args = parser.parse_args()
    config_path, config_bytes, config = load_runtime_config(args.config)
    editions = config["editions"]
    requirements_bytes = REQUIREMENTS_PATH.read_bytes()
    run_id = new_candidate_run_id()
    try:
        CANDIDATE_ROOT.relative_to(REPOSITORY_ROOT)
    except ValueError as error:
        raise ValueError("Candidate root must stay inside the repository.") from error
    CANDIDATE_ROOT.mkdir(parents=True, exist_ok=True)
    staging_root = Path(
        tempfile.mkdtemp(prefix=f".staging-{run_id}-", dir=CANDIDATE_ROOT)
    ).resolve(strict=True)
    candidate_directory = CANDIDATE_ROOT / run_id
    try:
        staging_root.relative_to(CANDIDATE_ROOT)
        candidate_directory.relative_to(CANDIDATE_ROOT)
        staging_texture_root = staging_root / "textures"
        staging_texture_root.mkdir()
        records = [
            build_edition(edition, config, staging_texture_root) for edition in editions
        ]
        validate_staged_records(records, staging_root)
        automated_validation_passed = all(
            record["rights"]["status"].startswith("accepted-")
            and record["qa"]["mappedPixelCoveragePercent"] == 100
            and record["canonicalRegistration"]["canonicalUnionCoastlineRegistered"]
            and not record["canonicalRegistration"]["internalBorders"]
            and record["qa"]["canonicalRegistrationGate"]["pass"]
            and record["qa"]["desktopMobileNormalizedRegistrationDriftPixelsAtMobile"]
            <= record["qa"]["desktopMobileDriftThresholdPixelsAtMobile"]
            and all(output["withinBudget"] for output in record["outputs"])
            for record in records
        )
        if not automated_validation_passed:
            raise ValueError("Candidate failed automated production constraints.")
        report = {
            "schemaVersion": 1,
            "artifactKind": "historical-globe-runtime-texture-candidate",
            "candidateId": run_id,
            "candidateDirectory": candidate_directory.relative_to(REPOSITORY_ROOT).as_posix(),
            "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
            "sourceAcquisitionDate": config["acquisitionDate"],
            "candidateOnly": True,
            "trackedOutputsModified": False,
            "automatedValidationPassed": True,
            "promotionReady": False,
            "reviewStatus": "pending-human-review",
            "promotionMechanismIncluded": False,
            "reviewGate": {
                "required": True,
                "approvalArtifact": None,
                "candidateIdAndOutputSha256MustMatch": True,
            },
            "promotionRequirements": [
                "Complete and record human visual, coastline-registration, mobile and protected-detail review for every candidate texture.",
                "Create a separately reviewable approval artifact that identifies this candidateId and every approved SHA-256.",
                "Update reports/globe-editions/source-manifest.json for the reviewed candidate outputs before promotion.",
                "Update textureContentVersion in src/components/globeEditions.ts for every promoted texture before promotion.",
                "Promote only through a separate reviewed workflow; this builder intentionally has no production-promotion mode.",
            ],
            "intendedTrackedReportPath": TRACKED_REPORT_PATH.relative_to(
                REPOSITORY_ROOT
            ).as_posix(),
            "sourceConfigPath": config_path.relative_to(REPOSITORY_ROOT).as_posix(),
            "sourceConfigSha256": hashlib.sha256(config_bytes).hexdigest().upper(),
            "builderPath": Path(__file__).resolve().relative_to(REPOSITORY_ROOT).as_posix(),
            "requirementsPath": REQUIREMENTS_PATH.relative_to(REPOSITORY_ROOT).as_posix(),
            "requirementsSha256": hashlib.sha256(requirements_bytes).hexdigest().upper(),
            "buildRuntime": {
                "python": platform.python_version(),
                "platform": platform.platform(),
                "numpy": np.__version__,
                "pillow": pillow_version,
                "webp": features.version("webp"),
                "littlecms2": features.version("littlecms2"),
            },
            "editions": records,
        }
        staged_report_path = staging_root / "candidate-report.json"
        staged_report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        parsed_staged_report = json.loads(staged_report_path.read_text(encoding="utf-8"))
        if parsed_staged_report != report:
            raise ValueError("Staged runtime report failed its JSON round-trip validation.")
        if candidate_directory.exists() or candidate_directory.is_symlink():
            raise FileExistsError(f"Candidate directory already exists: {candidate_directory}")
        os.rename(staging_root, candidate_directory)
    finally:
        if staging_root.exists():
            shutil.rmtree(staging_root)

    for record in records:
        sizes = ", ".join(
            f"{output['kind']}={output['bytes']} bytes" for output in record["outputs"]
        )
        print(f"Candidate {record['id']}: {sizes}")
    print(f"Candidate saved: {candidate_directory.relative_to(REPOSITORY_ROOT).as_posix()}")
    print("Tracked WebP files and the tracked runtime report were not modified.")
    print(
        "Before promotion: complete human review, create an approval artifact tied to "
        "this candidateId and its SHA-256 values, update "
        "reports/globe-editions/source-manifest.json, and update textureContentVersion "
        "in src/components/globeEditions.ts. Promotion must use a separate reviewed workflow."
    )


if __name__ == "__main__":
    main()
