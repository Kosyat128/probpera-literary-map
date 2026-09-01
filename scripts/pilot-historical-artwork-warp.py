#!/usr/bin/env python3
"""Build a bounded, non-production historical-artwork registration pilot.

The production historical texture builder currently registers only a thin
canonical interaction coastline.  This pilot instead deforms the underlying
historical RGB with a deterministic regularized spherical displacement map.  It is kept
separate from the production builder until the landmark evidence, distortion
guards and artwork-edge measurements have been independently reviewed.

The command deliberately refuses production resolutions and writes only below
``.tmp/globe-registration-pilot``.  It never modifies ``public/textures``.
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
from PIL import Image, ImageDraw, ImageFilter


REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
BUILDER_PATH = REPOSITORY_ROOT / "scripts/build-historical-globe-textures.py"
DEFAULT_CONFIG = (
    REPOSITORY_ROOT
    / "scripts/globe-editions/historical-artwork-registration-pilot.json"
)
DEFAULT_OUTPUT_ROOT = REPOSITORY_ROOT / ".tmp/globe-registration-pilot"
MAXIMUM_PILOT_WIDTH = 1536
Image.MAX_IMAGE_PIXELS = None


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load_builder() -> Any:
    specification = importlib.util.spec_from_file_location(
        "historical_globe_builder", BUILDER_PATH
    )
    if specification is None or specification.loader is None:
        raise RuntimeError("Unable to load the historical globe builder.")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


def project_historical_rgb(
    builder: Any,
    edition: dict[str, Any],
    production_config: dict[str, Any],
    width: int,
    height: int,
) -> tuple[np.ndarray, dict[str, Any]]:
    """Reconstruct source gores/caps without adding the canonical coastline."""

    cache_root = REPOSITORY_ROOT / production_config["cacheDirectory"]
    gores = builder.expand_gores(edition["surface"])
    source_specs = {source["id"]: source for source in edition["sources"]}
    longitudes = ((np.arange(width, dtype=np.float64) + 0.5) / width) * 360.0 - 180.0
    latitudes = 90.0 - ((np.arange(height, dtype=np.float64) + 0.5) / height) * 180.0
    surface = edition["surface"]
    accumulator = np.zeros((height, width, 3), dtype=np.float32)
    weight_sum = np.zeros((height, width), dtype=np.float32)
    caps = surface.get("caps", [])
    cap_output = np.zeros((height, width, 3), dtype=np.uint8)
    cap_assigned = np.zeros((height, width), dtype=bool)
    join_latitude = float(surface["joinLatitudeDeg"])
    join_feather = float(surface.get("joinFeatherDeg", 0))
    gore_overlap = float(surface.get("goreOverlapDeg", 0.8))
    cap_edge_inset = float(surface.get("capEdgeInsetPx", 0))

    for source_id, source_spec in source_specs.items():
        source = builder.verify_and_open_source(source_spec, cache_root)
        for gore in gores:
            if gore["sourceId"] != source_id:
                continue
            offset = builder.signed_longitude_difference(
                longitudes, gore["centralLongitudeDeg"]
            )
            minimum, maximum = gore["offsetRangeDeg"]
            columns = np.where(
                (offset >= minimum - gore_overlap)
                & (offset <= maximum + gore_overlap)
            )[0]
            if columns.size == 0:
                continue
            relative = np.clip(offset[columns], minimum, maximum) / 15.0
            column_weights = builder.overlap_weights(
                offset[columns], minimum, maximum, gore_overlap
            )
            for row_index, latitude in enumerate(latitudes):
                if abs(latitude) > join_latitude + join_feather:
                    continue
                sample_latitude = float(
                    np.clip(latitude, -join_latitude, join_latitude)
                )
                center_x, source_y, left_width, right_width = (
                    builder.source_row_geometry(gore, sample_latitude)
                )
                edge_inset = builder.edge_inset_at(surface, sample_latitude)
                left_width = max(0.0, left_width - edge_inset)
                right_width = max(0.0, right_width - edge_inset)
                source_x = center_x + relative * np.where(
                    relative < 0, left_width, right_width
                )
                sampled = builder.bilinear_sample(
                    source,
                    source_x,
                    np.full(source_x.shape, source_y, dtype=np.float64),
                ).astype(np.float32)
                accumulator[row_index, columns] += sampled * column_weights[:, None]
                weight_sum[row_index, columns] += column_weights

        for cap in caps:
            if cap["sourceId"] != source_id:
                continue
            north = cap["hemisphere"] == "north"
            row_indices = np.where(
                latitudes >= join_latitude - join_feather
                if north
                else latitudes <= -join_latitude + join_feather
            )[0]
            angle = np.radians(
                cap["zeroLongitudeAngleDeg"]
                + cap["longitudeDirection"] * longitudes
            )
            for row_index in row_indices:
                latitude = latitudes[row_index]
                cap_latitude = max(join_latitude, abs(latitude))
                radius = (cap["radiusPx"] - cap_edge_inset) * (
                    90.0 - cap_latitude
                ) / (90.0 - join_latitude)
                source_x = cap["centerX"] + np.cos(angle) * radius
                source_y = cap["centerY"] + np.sin(angle) * radius
                cap_output[row_index] = builder.bilinear_sample(
                    source, source_x, source_y
                )
                cap_assigned[row_index] = True

    gore_assigned = weight_sum > 0
    gore_output = np.zeros((height, width, 3), dtype=np.uint8)
    gore_output[gore_assigned] = np.clip(
        np.rint(accumulator[gore_assigned] / weight_sum[gore_assigned][:, None]),
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
                fraction = (distance - (join_latitude - join_feather)) / (
                    2 * join_feather
                )
                output[row_index] = np.clip(
                    np.rint(
                        gore_output[row_index].astype(np.float32)
                        * (1.0 - fraction)
                        + cap_output[row_index].astype(np.float32) * fraction
                    ),
                    0,
                    255,
                ).astype(np.uint8)
                assigned[row_index] = (
                    gore_assigned[row_index] & cap_assigned[row_index]
                )
    else:
        output = gore_output
        assigned = gore_assigned
    if not np.all(assigned):
        raise ValueError(
            f"{edition['id']}: pilot projection left "
            f"{int(np.size(assigned) - np.count_nonzero(assigned))} pixels unassigned."
        )
    output, palette_record = builder.normalize_low_frequency_palette(
        output,
        gores,
        float(surface.get("paletteNormalizationStrength", 0)),
    )
    return output, {
        "mappedPixelCoveragePercent": 100,
        "paletteNormalization": palette_record,
        "canonicalCoastlineRasterized": False,
    }


def spherical_coordinates(longitude: np.ndarray, latitude: np.ndarray) -> np.ndarray:
    lon = np.radians(longitude)
    lat = np.radians(latitude)
    cosine = np.cos(lat)
    return np.stack(
        (cosine * np.cos(lon), cosine * np.sin(lon), np.sin(lat)), axis=-1
    )


def angular_distance_degrees(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    dots = np.clip(np.sum(left * right, axis=-1), -1.0, 1.0)
    return np.degrees(np.arccos(dots))


def signed_longitude_difference(left: float, right: float) -> float:
    return (left - right + 540.0) % 360.0 - 180.0


def prepare_warp_model(
    controls: list[dict[str, Any]],
    sigma_degrees: float,
    base_longitude_offset_degrees: float,
    base_latitude_offset_degrees: float,
    background_weight: float,
) -> dict[str, Any]:
    target = np.asarray(
        [
            [control["canonicalLongitudeDeg"], control["canonicalLatitudeDeg"]]
            for control in controls
        ],
        dtype=np.float64,
    )
    source = np.asarray(
        [
            [control["historicalLongitudeDeg"], control["historicalLatitudeDeg"]]
            for control in controls
        ],
        dtype=np.float64,
    )
    target_sphere = spherical_coordinates(target[:, 0], target[:, 1])
    longitude_delta = np.asarray(
        [
            signed_longitude_difference(source_lon, target_lon)
            for source_lon, target_lon in zip(source[:, 0], target[:, 0], strict=True)
        ],
        dtype=np.float64,
    )
    latitude_delta = source[:, 1] - target[:, 1]
    residuals = np.column_stack(
        (
            longitude_delta - base_longitude_offset_degrees,
            latitude_delta - base_latitude_offset_degrees,
        )
    )
    return {
        "target": target,
        "source": source,
        "targetSphere": target_sphere,
        "residuals": residuals,
        "sigmaDegrees": sigma_degrees,
        "baseLongitudeOffsetDegrees": base_longitude_offset_degrees,
        "baseLatitudeOffsetDegrees": base_latitude_offset_degrees,
        "backgroundWeight": background_weight,
    }


def evaluate_inverse_map(
    model: dict[str, Any], longitude: np.ndarray, latitude: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    points = spherical_coordinates(longitude, latitude)
    distances = angular_distance_degrees(
        points[..., None, :], model["targetSphere"]
    )
    weights = np.exp(
        -0.5 * np.square(distances / float(model["sigmaDegrees"]))
    )
    local_weight = np.sum(weights, axis=-1, keepdims=True)
    residual = (weights @ model["residuals"]) / (
        local_weight + float(model["backgroundWeight"])
    )
    delta = residual + np.asarray(
        [
            model["baseLongitudeOffsetDegrees"],
            model["baseLatitudeOffsetDegrees"],
        ]
    )
    source_longitude = np.mod(longitude + delta[..., 0] + 180.0, 360.0) - 180.0
    source_latitude = np.clip(latitude + delta[..., 1], -89.999999, 89.999999)
    return source_longitude, source_latitude


def bilinear_sample_periodic(
    source: np.ndarray, x: np.ndarray, y: np.ndarray
) -> np.ndarray:
    height, width, channels = source.shape
    x0 = np.floor(x).astype(np.int32) % width
    y0 = np.clip(np.floor(y).astype(np.int32), 0, height - 1)
    x1 = (x0 + 1) % width
    y1 = np.minimum(y0 + 1, height - 1)
    xb = (x - np.floor(x))[..., None]
    yb = (y - np.floor(y))[..., None]
    top = source[y0, x0] * (1.0 - xb) + source[y0, x1] * xb
    bottom = source[y1, x0] * (1.0 - xb) + source[y1, x1] * xb
    result = top * (1.0 - yb) + bottom * yb
    if np.issubdtype(source.dtype, np.integer):
        return np.clip(np.rint(result), 0, 255).astype(source.dtype)
    return result.reshape((*x.shape, channels))


def warp_array(
    source: np.ndarray, model: dict[str, Any], chunk_rows: int = 64
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    height, width, _ = source.shape
    result = np.empty_like(source)
    longitude_map = np.empty((height, width), dtype=np.float32)
    latitude_map = np.empty((height, width), dtype=np.float32)
    longitudes = ((np.arange(width, dtype=np.float64) + 0.5) / width) * 360.0 - 180.0
    for start in range(0, height, chunk_rows):
        end = min(height, start + chunk_rows)
        latitudes = 90.0 - (
            (np.arange(start, end, dtype=np.float64) + 0.5) / height
        ) * 180.0
        target_longitude, target_latitude = np.meshgrid(longitudes, latitudes)
        source_longitude, source_latitude = evaluate_inverse_map(
            model, target_longitude, target_latitude
        )
        source_x = ((source_longitude + 180.0) / 360.0) * width - 0.5
        source_y = ((90.0 - source_latitude) / 180.0) * height - 0.5
        result[start:end] = bilinear_sample_periodic(
            source.astype(np.float32), source_x, source_y
        )
        longitude_map[start:end] = source_longitude.astype(np.float32)
        latitude_map[start:end] = source_latitude.astype(np.float32)
    return result, longitude_map, latitude_map


def warp_mask(
    source_mask: np.ndarray,
    longitude_map: np.ndarray,
    latitude_map: np.ndarray,
) -> np.ndarray:
    height, width = source_mask.shape
    source_x = np.rint(((longitude_map + 180.0) / 360.0) * width - 0.5).astype(
        np.int32
    ) % width
    source_y = np.clip(
        np.rint(((90.0 - latitude_map) / 180.0) * height - 0.5).astype(
            np.int32
        ),
        0,
        height - 1,
    )
    return source_mask[source_y, source_x]


def scherer_land_mask(rgb: np.ndarray, specification: dict[str, Any]) -> np.ndarray:
    image = Image.fromarray(rgb, mode="RGB").filter(
        ImageFilter.GaussianBlur(radius=float(specification["blurRadiusPxAt1024"]) * rgb.shape[1] / 1024)
    )
    pixels = np.asarray(image, dtype=np.int16)
    chroma = pixels.max(axis=2) - pixels.min(axis=2)
    luminance = (
        pixels[:, :, 0] * 2126
        + pixels[:, :, 1] * 7152
        + pixels[:, :, 2] * 722
    ) / 10000
    mask = (
        (chroma >= int(specification["minimumChroma"]))
        & (luminance <= float(specification["maximumLuminance"]))
    )
    # Scherer's red full-width graticule/rule bands are chromatic but are not
    # land.  Detect only unusually occupied rows, clear a narrow band, and let
    # the later closing step restore coloured land on both sides.  This is
    # content-derived and resolution-scaled, rather than a list of hand-painted
    # pixels.
    occupied = np.mean(mask, axis=1)
    dense_rows = np.where(
        occupied >= float(specification["maximumForegroundRowFraction"])
    )[0]
    cleared_half_width = max(
        1,
        round(
            float(specification["denseRowClearHalfWidthPxAt1024"])
            * rgb.shape[1]
            / 1024
        ),
    )
    for row in dense_rows:
        mask[
            max(0, row - cleared_half_width) : min(
                mask.shape[0], row + cleared_half_width + 1
            )
        ] = False
    mask_image = Image.fromarray(mask.astype(np.uint8) * 255, mode="L")
    opening = int(specification["openingKernelPxAt1024"] * rgb.shape[1] / 1024)
    closing = int(specification["closingKernelPxAt1024"] * rgb.shape[1] / 1024)
    opening = max(3, opening | 1)
    closing = max(3, closing | 1)
    mask_image = mask_image.filter(ImageFilter.MinFilter(opening)).filter(
        ImageFilter.MaxFilter(opening)
    )
    mask_image = mask_image.filter(ImageFilter.MaxFilter(closing)).filter(
        ImageFilter.MinFilter(closing)
    )
    return np.asarray(mask_image, dtype=np.uint8) > 127


def binary_edge(mask: np.ndarray) -> np.ndarray:
    west = np.roll(mask, 1, axis=1)
    east = np.roll(mask, -1, axis=1)
    north = np.vstack((mask[:1], mask[:-1]))
    south = np.vstack((mask[1:], mask[-1:]))
    return mask ^ (west & east & north & south) | (~mask & (west | east | north | south))


def longitude_to_x(longitude: float, width: int) -> float:
    return ((longitude + 180.0) / 360.0) * width - 0.5


def latitude_to_y(latitude: float, height: int) -> float:
    return ((90.0 - latitude) / 180.0) * height - 0.5


def discover_controls(
    targets: list[dict[str, Any]],
    source_edge: np.ndarray,
    maximum_radius_pixels: float,
) -> list[dict[str, Any]]:
    height, width = source_edge.shape
    edge_y, edge_x = np.nonzero(source_edge)
    discovered = []
    for target in targets:
        search_longitude = target.get(
            "historicalSearchLongitudeDeg", target["canonicalLongitudeDeg"]
        )
        search_latitude = target.get(
            "historicalSearchLatitudeDeg", target["canonicalLatitudeDeg"]
        )
        target_x = longitude_to_x(search_longitude, width)
        target_y = latitude_to_y(search_latitude, height)
        dx = np.abs(edge_x.astype(np.float64) - target_x)
        dx = np.minimum(dx, width - dx)
        dy = edge_y.astype(np.float64) - target_y
        distance = np.hypot(dx, dy)
        eligible = distance <= maximum_radius_pixels
        if not np.any(eligible):
            raise ValueError(f"No historical edge candidate near {target['id']}.")
        candidate_indices = np.where(eligible)[0]
        best_index = candidate_indices[np.argmin(distance[candidate_indices])]
        source_x = float(edge_x[best_index]) + 0.5
        source_y = float(edge_y[best_index]) + 0.5
        discovered.append(
            {
                "id": target["id"],
                "canonicalLongitudeDeg": target["canonicalLongitudeDeg"],
                "canonicalLatitudeDeg": target["canonicalLatitudeDeg"],
                "historicalLongitudeDeg": source_x / width * 360.0 - 180.0,
                "historicalLatitudeDeg": 90.0 - source_y / height * 180.0,
                "discoveryDistancePixels": round(float(distance[best_index]), 6),
                "evidence": "nearest-edge-in-manually-reviewed-landmark-roi-on-versioned-chroma-mask",
            }
        )
    return discovered


def percentile(values: np.ndarray, fraction: float) -> float | None:
    if values.size == 0:
        return None
    return round(float(np.percentile(values, fraction * 100)), 6)


def edge_distance_samples(
    query_edge: np.ndarray,
    target_edge: np.ndarray,
    eligible_mask: np.ndarray,
    maximum_samples: int,
    search_radius: int,
) -> np.ndarray:
    height, width = query_edge.shape
    points = np.argwhere(query_edge & eligible_mask)
    if points.size == 0:
        return np.empty(0, dtype=np.float64)
    stride = max(1, math.ceil(points.shape[0] / maximum_samples))
    points = points[::stride]
    result = np.empty(points.shape[0], dtype=np.float64)
    for index, (y, x) in enumerate(points):
        y0 = max(0, int(y) - search_radius)
        y1 = min(height, int(y) + search_radius + 1)
        xs = np.arange(int(x) - search_radius, int(x) + search_radius + 1) % width
        candidates = np.argwhere(target_edge[y0:y1][:, xs])
        if candidates.size == 0:
            result[index] = search_radius + 1
            continue
        candidate_y = candidates[:, 0] + y0
        candidate_x = xs[candidates[:, 1]]
        dx = np.abs(candidate_x - int(x))
        dx = np.minimum(dx, width - dx)
        result[index] = float(np.min(np.hypot(dx, candidate_y - int(y))))
    return result


def edge_metric(
    historical_edge: np.ndarray,
    canonical_edge: np.ndarray,
    eligible: np.ndarray,
    maximum_samples: int,
    search_radius: int,
) -> dict[str, Any]:
    canonical_to_historical = edge_distance_samples(
        canonical_edge,
        historical_edge,
        eligible,
        maximum_samples,
        search_radius,
    )
    historical_to_canonical = edge_distance_samples(
        historical_edge,
        canonical_edge,
        eligible,
        maximum_samples,
        search_radius,
    )
    combined = np.concatenate((canonical_to_historical, historical_to_canonical))
    return {
        "metricClass": "segmented-historical-artwork-to-canonical-union-edge-distance",
        "canonicalToHistoricalSampleCount": int(canonical_to_historical.size),
        "historicalToCanonicalSampleCount": int(historical_to_canonical.size),
        "medianPixels": percentile(combined, 0.5),
        "p95Pixels": percentile(combined, 0.95),
        "maximumCappedPixels": percentile(combined, 1.0),
        "searchRadiusPixels": search_radius,
    }


def distortion_metric(
    longitude_map: np.ndarray, latitude_map: np.ndarray
) -> dict[str, Any]:
    height, width = longitude_map.shape
    stride = max(1, width // 128)
    longitude = longitude_map[::stride, ::stride].astype(np.float64)
    latitude = latitude_map[::stride, ::stride].astype(np.float64)
    unwrapped = np.degrees(np.unwrap(np.radians(longitude), axis=1))
    dx_lon = np.gradient(unwrapped, axis=1) / stride * width / 360.0
    dy_lon = np.gradient(unwrapped, axis=0) / stride * height / 180.0
    dx_lat = -np.gradient(latitude, axis=1) / stride * width / 360.0
    dy_lat = -np.gradient(latitude, axis=0) / stride * height / 180.0
    determinant = dx_lon * dy_lat - dy_lon * dx_lat
    return {
        "sampleStridePixels": stride,
        "minimumApproximateJacobianDeterminant": round(float(np.min(determinant)), 6),
        "medianApproximateJacobianDeterminant": round(float(np.median(determinant)), 6),
        "maximumApproximateJacobianDeterminant": round(float(np.max(determinant)), 6),
        "foldoverDetected": bool(np.any(determinant <= 0)),
    }


def overlay_diagnostic(
    rgb: np.ndarray,
    canonical_edge: np.ndarray,
    historical_edge: np.ndarray,
    controls: list[dict[str, Any]],
) -> Image.Image:
    result = rgb.copy()
    result[historical_edge] = np.array([20, 110, 235], dtype=np.uint8)
    result[canonical_edge] = np.array([240, 35, 35], dtype=np.uint8)
    image = Image.fromarray(result, mode="RGB")
    draw = ImageDraw.Draw(image)
    width, height = image.size
    radius = max(2, width // 256)
    for control in controls:
        x = longitude_to_x(control["canonicalLongitudeDeg"], width)
        y = latitude_to_y(control["canonicalLatitudeDeg"], height)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, 225, 0))
        source_x = longitude_to_x(control["historicalLongitudeDeg"], width)
        source_y = latitude_to_y(control["historicalLatitudeDeg"], height)
        delta_x = source_x - x
        if delta_x > width / 2:
            source_x -= width
        elif delta_x < -width / 2:
            source_x += width
        draw.line((x, y, source_x, source_y), fill=(255, 215, 0), width=max(1, radius // 2))
        draw.rectangle(
            (
                source_x - radius,
                source_y - radius,
                source_x + radius,
                source_y + radius,
            ),
            outline=(0, 235, 90),
            width=max(1, radius // 2),
        )
    return image


def validate_pilot_config(config: dict[str, Any]) -> dict[str, Any]:
    if (
        config.get("schemaVersion") != 1
        or config.get("artifactKind") != "historical-artwork-registration-pilot"
        or config.get("productionEligible") is not False
    ):
        raise ValueError("Pilot config identity/readiness is invalid.")
    algorithm = config.get("algorithm", {})
    if (
        algorithm.get("model")
        != "inverse-spherical-normalized-gaussian-displacement"
        or algorithm.get("nonlinearWarpApplied") is not True
        or algorithm.get("deterministic") is not True
        or algorithm.get("generativeModelUsed") is not False
    ):
        raise ValueError("Pilot algorithm contract is invalid.")
    return config


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--edition", default="scherer-1700")
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--discover-controls", action="store_true")
    args = parser.parse_args()
    if args.width < 512 or args.width > MAXIMUM_PILOT_WIDTH or args.width % 2:
        raise ValueError(
            f"Pilot width must be an even value from 512 to {MAXIMUM_PILOT_WIDTH}."
        )
    height = args.width // 2
    config_path = args.config.resolve()
    config_bytes = config_path.read_bytes()
    config = validate_pilot_config(json.loads(config_bytes))
    if args.edition != config["editionId"]:
        raise ValueError("Only the edition pinned by the pilot config may be built.")
    production_config_path = REPOSITORY_ROOT / config["historicalProjectionConfigPath"]
    production_config = json.loads(production_config_path.read_text(encoding="utf-8"))
    edition = next(
        item for item in production_config["editions"] if item["id"] == args.edition
    )
    builder = load_builder()
    historical_rgb, projection_record = project_historical_rgb(
        builder, edition, production_config, args.width, height
    )
    segmentation = config["segmentation"]
    historical_mask = scherer_land_mask(historical_rgb, segmentation)
    historical_edge = binary_edge(historical_mask)
    canonical_mask = builder.canonical_union_land_mask(
        json.loads(
            (REPOSITORY_ROOT / production_config["canonicalAtlas"]["path"]).read_text(
                encoding="utf-8"
            )
        ),
        args.width,
        height,
    ) > 127
    canonical_edge = binary_edge(canonical_mask)
    output_root = DEFAULT_OUTPUT_ROOT / args.edition / f"{args.width}x{height}"
    output_root.mkdir(parents=True, exist_ok=True)
    Image.fromarray(historical_rgb, mode="RGB").save(
        output_root / "historical-projection-no-canonical-line.png", optimize=True
    )
    Image.fromarray(historical_mask.astype(np.uint8) * 255, mode="L").save(
        output_root / "segmented-historical-land-mask.png", optimize=True
    )

    controls = config.get("controls", [])
    if args.discover_controls:
        controls = discover_controls(
            config["controlDiscoveryTargets"],
            historical_edge,
            float(config["controlDiscoveryMaximumRadiusPixelsAt1024"])
            * args.width
            / 1024,
        )
        discovery_path = output_root / "discovered-controls.json"
        discovery_path.write_text(
            json.dumps(controls, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        overlay_diagnostic(
            historical_rgb, canonical_edge, historical_edge, controls
        ).save(output_root / "discovered-controls-overlay.png", optimize=True)
        print(f"Discovered {len(controls)} pilot controls at {discovery_path}")
        return
    if len(controls) < 8:
        raise ValueError("At least eight reviewed landmark controls are required.")
    algorithm = config["algorithm"]
    model = prepare_warp_model(
        controls,
        float(algorithm["sigmaDegrees"]),
        float(algorithm["baseLongitudeOffsetDegrees"]),
        float(algorithm["baseLatitudeOffsetDegrees"]),
        float(algorithm["backgroundWeight"]),
    )
    warped_rgb, longitude_map, latitude_map = warp_array(
        historical_rgb, model, int(algorithm["chunkRows"])
    )
    warped_mask = warp_mask(historical_mask, longitude_map, latitude_map)
    warped_edge = binary_edge(warped_mask)
    latitudes = 90.0 - (
        (np.arange(height, dtype=np.float64) + 0.5) / height
    ) * 180.0
    eligible = np.broadcast_to(
        (
            (latitudes <= float(config["qa"]["northLatitudeLimitDeg"]))
            & (latitudes >= float(config["qa"]["southLatitudeLimitDeg"]))
        )[:, None],
        (height, args.width),
    )
    maximum_samples = int(config["qa"]["maximumSamplesPerDirection"])
    search_radius = max(
        8,
        round(
            float(config["qa"]["edgeSearchRadiusPixelsAt1024"])
            * args.width
            / 1024
        ),
    )
    before = edge_metric(
        historical_edge,
        canonical_edge,
        eligible,
        maximum_samples,
        search_radius,
    )
    after = edge_metric(
        warped_edge,
        canonical_edge,
        eligible,
        maximum_samples,
        search_radius,
    )
    control_target_lon = np.asarray(
        [control["canonicalLongitudeDeg"] for control in controls]
    )
    control_target_lat = np.asarray(
        [control["canonicalLatitudeDeg"] for control in controls]
    )
    mapped_lon, mapped_lat = evaluate_inverse_map(
        model, control_target_lon, control_target_lat
    )
    target_source_lon = np.asarray(
        [control["historicalLongitudeDeg"] for control in controls]
    )
    target_source_lat = np.asarray(
        [control["historicalLatitudeDeg"] for control in controls]
    )
    lon_residual = np.asarray(
        [
            signed_longitude_difference(mapped, expected)
            for mapped, expected in zip(mapped_lon, target_source_lon, strict=True)
        ]
    )
    lat_residual = mapped_lat - target_source_lat
    residual_pixels = np.hypot(
        lon_residual / 360.0 * args.width,
        lat_residual / 180.0 * height,
    )
    distortion = distortion_metric(longitude_map, latitude_map)
    if distortion["foldoverDetected"]:
        raise ValueError("Pilot warp produced a foldover; output is rejected.")
    Image.fromarray(warped_rgb, mode="RGB").save(
        output_root / "adapted-artwork-pilot.png", optimize=True
    )
    overlay_diagnostic(
        warped_rgb, canonical_edge, warped_edge, controls
    ).save(output_root / "adapted-artwork-overlay.png", optimize=True)
    report = {
        "schemaVersion": 1,
        "artifactKind": "historical-artwork-registration-pilot-result",
        "editionId": args.edition,
        "productionEligible": False,
        "reviewState": "pilot-awaiting-independent-control-and-mask-review",
        "config": {
            "path": config_path.relative_to(REPOSITORY_ROOT).as_posix(),
            "sha256": hashlib.sha256(config_bytes).hexdigest().upper(),
        },
        "historicalProjectionConfig": {
            "path": production_config_path.relative_to(REPOSITORY_ROOT).as_posix(),
            "sha256": sha256_file(production_config_path),
        },
        "output": {"width": args.width, "height": height},
        "projection": projection_record,
        "algorithm": {
            **algorithm,
            "controlCount": len(controls),
            "controlInterpolationResidualPixels": {
                "median": percentile(residual_pixels, 0.5),
                "p95": percentile(residual_pixels, 0.95),
                "maximum": percentile(residual_pixels, 1.0),
                "interpretation": "Regularized control mismatch; these controls guide but do not force the warp and are not independent geographic evidence.",
            },
        },
        "controls": controls,
        "distortion": distortion,
        "artworkEdgeRegistration": {
            "before": before,
            "after": after,
            "interpretation": "Observed edge-distance proxy from the versioned chroma segmentation, excluding the configured polar/Antarctic latitude bands. It measures this pilot's artwork movement, not historical geographic truth; labels, graticules and uncoloured islands can escape the segmentation.",
        },
        "historicalFidelity": {
            "sourcePixelsSynthesized": False,
            "generativeModelUsed": False,
            "modernMapColourFillUsed": False,
            "singleBilinearResamplingPass": True,
            "labelsAndEngravingMoveWithHistoricalArtwork": True,
            "warning": "Nonlinear adaptation changes the relative placement and local scale of historical artwork. This pilot must not replace the Historical Master.",
        },
        "limitations": [
            "The control points and chroma mask require independent human review before any production use.",
            "The proxy cannot prove coastline agreement where the source has no homologous land or where historical geography intentionally differs.",
            "Behaim 1492 cannot be globally registered to a modern coastline without inventing absent American geography; any future Behaim adaptation must remain partial and explicitly masked.",
        ],
    }
    report_path = output_root / "pilot-report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Built non-production {args.edition} {args.width}x{height} pilot: "
        f"edge median {before['medianPixels']} -> {after['medianPixels']} px, "
        f"p95 {before['p95Pixels']} -> {after['p95Pixels']} px; {report_path}"
    )


if __name__ == "__main__":
    main()
