import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultConfigPath = "scripts/globe-editions/cassini-1790-alignment.json";
const algorithmVersion = "cassini-interactive-adaptation-v1";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function finite(value, label, { min, max, integer = false } = {}) {
  assert(
    Number.isFinite(value) && (!integer || Number.isInteger(value)),
    `${label} must be a finite${integer ? " integer" : ""} number.`
  );
  if (min !== undefined) assert(value >= min, `${label} must be >= ${min}.`);
  if (max !== undefined) assert(value <= max, `${label} must be <= ${max}.`);
  return value;
}

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function repositoryPath(relativePath, label) {
  assert(
    typeof relativePath === "string" && relativePath.length > 0 && !path.isAbsolute(relativePath),
    `${label} must be repository-relative.`
  );
  const resolved = path.resolve(repositoryRoot, relativePath);
  assert(isInside(repositoryRoot, resolved), `${label} escaped the repository.`);
  return resolved;
}

async function existingAncestor(candidate) {
  let current = candidate;
  while (true) {
    try {
      return await realpath(current);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

async function readContained(filePath, allowedRoot, label) {
  assert(isInside(allowedRoot, filePath), `${label} escaped its allowed root.`);
  const [stat, canonicalRoot, canonicalFile] = await Promise.all([
    lstat(filePath),
    realpath(allowedRoot),
    realpath(filePath),
  ]);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular file.`);
  assert(isInside(canonicalRoot, canonicalFile), `${label} resolves outside its root.`);
  return readFile(filePath);
}

async function assertWritable(filePath, allowedRoot, label) {
  assert(filePath !== allowedRoot && isInside(allowedRoot, filePath), `${label} escaped.`);
  const [canonicalRepository, canonicalAncestor] = await Promise.all([
    realpath(repositoryRoot),
    existingAncestor(allowedRoot),
  ]);
  assert(isInside(canonicalRepository, canonicalAncestor), `${label} root escaped.`);
  await mkdir(allowedRoot, { recursive: true });
  const canonicalRoot = await realpath(allowedRoot);
  assert(isInside(canonicalRepository, canonicalRoot), `${label} root escaped.`);
  await mkdir(path.dirname(filePath), { recursive: true });
  const canonicalParent = await realpath(path.dirname(filePath));
  assert(isInside(canonicalRoot, canonicalParent), `${label} parent escaped.`);
  try {
    const stat = await lstat(filePath);
    assert(stat.isFile() && !stat.isSymbolicLink(), `${label} target is unsafe.`);
    assert(isInside(canonicalRoot, await realpath(filePath)), `${label} target escaped.`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function parseArguments(argv) {
  const result = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    assert(argv[index] === "--config", `Unsupported argument: ${argv[index]}`);
    assert(argv[index + 1] && !argv[index + 1].startsWith("--"), "Missing --config value.");
    assert(!result.has("config"), "--config may be specified only once.");
    result.set("config", argv[index + 1]);
  }
  return result;
}

function longitudeDelta(left, right) {
  return ((left - right + 540) % 360) - 180;
}

export function validateAlignmentConfig(config) {
  assert(config?.schemaVersion === 1, "Alignment schemaVersion must be 1.");
  assert(config.editionId === "cassini-1790", "Unexpected editionId.");
  assert(
    config.artifactKind === "interactive-adapted-master-alignment" &&
      config.productionReady === false,
    "Alignment config identity/readiness is invalid."
  );
  assert(
    config.historicalInput?.sidecarPath ===
      "reports/globe-editions/cassini-1790-historical-master.json" &&
      config.historicalInput.requiredArtifactKind === "historical-master" &&
      config.historicalInput.requiredProductionEligible === true &&
      config.historicalInput.requiredSeamPaperRunGate === "pass",
    "Historical Master gate configuration is invalid."
  );
  assert(
    config.canonicalAtlas?.path === "src/data/geo/countries.geojson" &&
      config.canonicalAtlas.provenancePath === "src/data/geo/countries.provenance.json" &&
      config.canonicalAtlas.repositoryVersion === "5.1.2" &&
      config.canonicalAtlas.featureCount === 177 &&
      /^[A-F0-9]{64}$/u.test(config.canonicalAtlas.localSha256) &&
      /^[A-F0-9]{64}$/u.test(config.canonicalAtlas.provenanceSha256),
    "Canonical atlas pin is invalid."
  );
  assert(
    config.output?.directory === "scripts/.cache/globe-editions/cassini-1790/masters" &&
      config.output.filenamePattern ===
        "cassini-1790-interactive-adapted-master-{width}x{height}.png" &&
      config.output.sidecarPath ===
        "reports/globe-editions/cassini-1790-interactive-adapted-master.json",
    "Adapted Master paths are not the fixed Cassini paths."
  );

  const transform = config.transform;
  assert(
    transform?.model === "identity" &&
      transform.nonlinearWarpApplied === false &&
      transform.evidenceStatus === "visual-overlay-only" &&
      Array.isArray(transform.controlPoints) &&
      transform.controlPoints.length >= 4,
    "Only a documented identity transform is accepted."
  );
  const ids = new Set();
  for (const [index, point] of transform.controlPoints.entries()) {
    assert(typeof point.id === "string" && point.id && !ids.has(point.id), `Point ${index} id is invalid.`);
    ids.add(point.id);
    finite(point.canonicalLongitudeDeg, `point ${point.id} canonical longitude`, { min: -180, max: 180 });
    finite(point.historicalLongitudeDeg, `point ${point.id} historical longitude`, { min: -180, max: 180 });
    finite(point.canonicalLatitudeDeg, `point ${point.id} canonical latitude`, { min: -90, max: 90 });
    finite(point.historicalLatitudeDeg, `point ${point.id} historical latitude`, { min: -90, max: 90 });
    assert(
      longitudeDelta(point.historicalLongitudeDeg, point.canonicalLongitudeDeg) === 0 &&
        point.historicalLatitudeDeg === point.canonicalLatitudeDeg &&
        point.evidence === "visual-overlay-only",
      `${point.id} must remain an honestly documented identity constraint.`
    );
  }

  const regions = config.protectedHistoricalContent?.regions;
  assert(Array.isArray(regions) && regions.length > 0, "Protected content is required.");
  for (const [index, region] of regions.entries()) {
    assert(
      region.shape === "lon-lat-rectangle" &&
        region.treatment === "preserve-input-rgb-exactly",
      `Protected region ${index} is invalid.`
    );
    finite(region.westLongitudeDeg, `region ${index} west`, { min: -180, max: 180 });
    finite(region.eastLongitudeDeg, `region ${index} east`, { min: -180, max: 180 });
    finite(region.southLatitudeDeg, `region ${index} south`, { min: -90, max: 90 });
    finite(region.northLatitudeDeg, `region ${index} north`, { min: -90, max: 90 });
    assert(region.southLatitudeDeg < region.northLatitudeDeg, `Region ${index} is inverted.`);
  }

  assert(
    config.canonicalCoastline?.mask === "union-of-all-canonical-land-polygons" &&
      config.canonicalCoastline.internalBorders === false &&
      config.canonicalCoastline.treatment === "source-derived-rgb-darkening" &&
      config.canonicalCoastline.edgeModel === "native-antialiased-union-mask-gradient",
    "Canonical coastline treatment is invalid."
  );
  finite(config.canonicalCoastline.maximumDarkeningOpacity, "coastline opacity", {
    min: 0,
    max: 0.5,
  });
  assert(
    config.canonicalCoastline.canonicalUnionCoastlineRegistered === true &&
      config.canonicalCoastline.registeredWidthPixelsAt4096Width === 2 &&
      config.canonicalCoastline.registeredWidthPixelsAt2048Width === 1,
    "Canonical coastline runtime registration width is invalid."
  );
  finite(
    config.canonicalCoastline.edgeSampleRadiusPixelsAt8192Width,
    "coastline edge sample radius",
    { integer: true, min: 1, max: 4 }
  );
  const antarctica = config.antarctica;
  assert(
    antarctica?.historicalStatus === "absent-from-source" &&
      antarctica.treatment ===
        "historical-source-rgb-preserved-no-raster-land-synthesis" &&
      antarctica.enabled === false &&
      antarctica.labelsOrInventedDetailsAllowed === false,
    "Antarctica treatment is invalid."
  );
  const strip = antarctica.sourceStrip;
  finite(strip?.northLatitudeDeg, "Antarctica strip north", { min: -90, max: 90 });
  finite(strip?.southLatitudeDeg, "Antarctica strip south", { min: -90, max: 90 });
  assert(strip.northLatitudeDeg > strip.southLatitudeDeg, "Antarctica strip is inverted.");
  finite(strip.lowFrequencyColumns, "low-frequency columns", { integer: true, min: 1, max: 256 });
  finite(strip.lowFrequencyRows, "low-frequency rows", { integer: true, min: 2, max: 32 });
  const polarJoin = config.polarJoin;
  assert(
    polarJoin?.source === "historical-master-real-cassini-gores-and-polar-caps" &&
      polarJoin.internalLineworkPreservedOutsideJoinBand === true &&
      polarJoin.canonicalCoastlinePreserved === true,
    "Cassini polar join contract is invalid."
  );
  finite(polarJoin.joinLatitudeDeg, "polar join latitude", { min: 70, max: 85 });
  finite(polarJoin.smoothstepHalfWidthDeg, "polar join feather", { min: 0.5, max: 2 });
  finite(
    polarJoin.paletteNormalizationStartLatitudeDeg,
    "polar palette normalization start",
    { min: 55, max: 75 }
  );
  assert(
    polarJoin.paletteNormalizationStartLatitudeDeg < polarJoin.joinLatitudeDeg,
    "Polar palette normalization must begin before the cap join."
  );
  finite(polarJoin.neutralToneSourceSouthLatitudeDeg, "polar neutral source south", {
    min: 65,
    max: 80,
  });
  finite(polarJoin.neutralToneSourceNorthLatitudeDeg, "polar neutral source north", {
    min: 65,
    max: 80,
  });
  finite(polarJoin.neutralToneBlendStartLatitudeDeg, "polar neutral blend start", {
    min: 78,
    max: 84,
  });
  finite(polarJoin.neutralToneSolidLatitudeDeg, "polar neutral solid latitude", {
    min: 85,
    max: 90,
  });
  assert(
    polarJoin.neutralToneSourceSouthLatitudeDeg <
        polarJoin.neutralToneSourceNorthLatitudeDeg &&
      polarJoin.neutralToneBlendStartLatitudeDeg < polarJoin.neutralToneSolidLatitudeDeg,
    "Polar neutral-tone latitude order is invalid."
  );
  const diagnostic = config.qa?.canonicalRegistration;
  finite(diagnostic?.maximumSamples, "maximum samples", { integer: true, min: 100, max: 100000 });
  finite(diagnostic?.gradientSearchRadiusPixelsAt4096Width, "search radius", {
    integer: true,
    min: 1,
    max: 16,
  });
  assert(
    diagnostic.status === "diagnostic-no-pass-threshold" &&
      Array.isArray(config.qa.requiredReviewBeforeProduction) &&
      config.qa.requiredReviewBeforeProduction.length > 0,
    "Independent production review gates are missing."
  );
  return config;
}

function polygons(geometry, label) {
  assert(
    geometry?.type === "Polygon" || geometry?.type === "MultiPolygon",
    `${label} must be Polygon or MultiPolygon.`
  );
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function unwrapRing(ring, label) {
  assert(Array.isArray(ring) && ring.length >= 4, `${label} is too short.`);
  const result = [];
  let previous;
  for (const [index, coordinate] of ring.entries()) {
    assert(Array.isArray(coordinate) && coordinate.length >= 2, `${label}[${index}] is invalid.`);
    let longitude = finite(coordinate[0], `${label}[${index}].lon`, { min: -180, max: 180 });
    const latitude = finite(coordinate[1], `${label}[${index}].lat`, { min: -90, max: 90 });
    if (previous !== undefined) {
      while (longitude - previous > 180) longitude -= 360;
      while (longitude - previous < -180) longitude += 360;
    }
    result.push([longitude, latitude]);
    previous = longitude;
  }
  return result;
}

function meanLongitude(ring) {
  return ring.reduce((sum, [longitude]) => sum + longitude, 0) / ring.length;
}

function alignRing(ring, targetLongitude) {
  const shift = Math.round((targetLongitude - meanLongitude(ring)) / 360) * 360;
  return ring.map(([longitude, latitude]) => [longitude + shift, latitude]);
}

function ringPath(ring, longitudeShift, width, height) {
  return (
    ring
      .map(([longitude, latitude], index) => {
        const x = ((longitude + longitudeShift + 180) / 360) * width;
        const y = ((90 - latitude) / 180) * height;
        return `${index ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)}`;
      })
      .join("") + "Z"
  );
}

function maskSvg(features, width, height) {
  const paths = [];
  for (const [featureIndex, feature] of features.entries()) {
    for (const [polygonIndex, polygon] of polygons(feature.geometry, `feature ${featureIndex}`).entries()) {
      assert(Array.isArray(polygon) && polygon.length > 0, `Polygon ${polygonIndex} is empty.`);
      const outer = unwrapRing(polygon[0], `feature ${featureIndex} outer`);
      const rings = [
        outer,
        ...polygon.slice(1).map((ring, ringIndex) =>
          alignRing(unwrapRing(ring, `feature ${featureIndex} hole ${ringIndex}`), meanLongitude(outer))
        ),
      ];
      for (const shift of [-360, 0, 360]) {
        const d = rings.map((ring) => ringPath(ring, shift, width, height)).join("");
        paths.push(`<path d="${d}" fill="#fff" fill-rule="evenodd"/>`);
      }
    }
  }
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#000"/>${paths.join("")}</svg>`
  );
}

async function renderMask(features, width, height) {
  const { data, info } = await sharp(maskSvg(features, width, height))
    .greyscale()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert(info.width === width && info.height === height && info.channels === 1, "Mask metadata is invalid.");
  return data;
}

export async function buildCanonicalMasks(atlas, width, height, selector) {
  finite(width, "mask width", { integer: true, min: 8 });
  finite(height, "mask height", { integer: true, min: 4 });
  assert(width === height * 2, "Masks require a 2:1 frame.");
  assert(atlas?.type === "FeatureCollection" && Array.isArray(atlas.features), "Atlas is invalid.");
  const antarcticaFeatures = atlas.features.filter(
    (feature) => feature.properties?.[selector.property] === selector.value
  );
  assert(antarcticaFeatures.length === 1, `Expected one Antarctica feature; found ${antarcticaFeatures.length}.`);
  const [landMask, antarcticaMask] = await Promise.all([
    renderMask(atlas.features, width, height),
    renderMask(antarcticaFeatures, width, height),
  ]);
  for (let index = 0; index < landMask.length; index += 1) {
    assert(antarcticaMask[index] <= landMask[index] + 1, "Antarctica escaped the land union.");
  }
  return { landMask, antarcticaMask };
}

export function computeUnionCoastlineEdge(mask, width, height, sampleRadius = 1) {
  assert(mask.length === width * height, "Mask dimensions do not match.");
  finite(sampleRadius, "coastline sample radius", { integer: true, min: 1, max: 4 });
  const edge = Buffer.alloc(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const value = mask[index];
      let maximum = 0;
      for (let distance = 1; distance <= sampleRadius; distance += 1) {
        const north = Math.max(0, y - distance);
        const south = Math.min(height - 1, y + distance);
        maximum = Math.max(
          maximum,
          Math.abs(value - mask[y * width + ((x + width - distance) % width)]),
          Math.abs(value - mask[y * width + ((x + distance) % width)]),
          Math.abs(value - mask[north * width + x]),
          Math.abs(value - mask[south * width + x])
        );
      }
      edge[index] = maximum;
    }
  }
  return edge;
}

function pixelLongitude(width, x) {
  return ((x + 0.5) / width) * 360 - 180;
}

function pixelLatitude(height, y) {
  return 90 - ((y + 0.5) / height) * 180;
}

function longitudeInRegion(longitude, west, east) {
  return west <= east
    ? longitude >= west && longitude <= east
    : longitude >= west || longitude <= east;
}

function protectedRegionAt(regions, longitude, latitude) {
  return regions.find(
    (region) =>
      longitudeInRegion(longitude, region.westLongitudeDeg, region.eastLongitudeDeg) &&
      latitude >= region.southLatitudeDeg &&
      latitude <= region.northLatitudeDeg
  );
}

function smoothstep01(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function rowForLatitude(height, latitude) {
  return Math.max(
    0,
    Math.min(height - 1, Math.round(((90 - latitude) / 180) * height - 0.5))
  );
}

function neutralMean(rgb, width, firstRow, afterLastRow, firstColumn, afterLastColumn) {
  const sums = [0, 0, 0];
  let count = 0;
  for (let y = firstRow; y < afterLastRow; y += 1) {
    for (let x = firstColumn; x < afterLastColumn; x += 1) {
      const index = (y * width + x) * 3;
      const red = rgb[index];
      const green = rgb[index + 1];
      const blue = rgb[index + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      if ((red + green + blue) / 3 >= 105 && maximum - minimum <= 58) {
        sums[0] += red;
        sums[1] += green;
        sums[2] += blue;
        count += 1;
      }
    }
  }
  assert(count > 0, "Polar neutral-colour sample is empty.");
  return sums.map((sum) => sum / count);
}

function polarRows(height, north, innerLatitude, outerLatitude) {
  const first = rowForLatitude(height, north ? outerLatitude : -innerLatitude);
  const last = rowForLatitude(height, north ? innerLatitude : -outerLatitude);
  return { first: Math.min(first, last), afterLast: Math.max(first, last) + 1 };
}

function stabilizePolarJoin(historicalRgb, width, height, polarJoin) {
  const output = Buffer.from(historicalRgb);
  const join = polarJoin.joinLatitudeDeg;
  const halfWidth = polarJoin.smoothstepHalfWidthDeg;
  const normalizationStart = polarJoin.paletteNormalizationStartLatitudeDeg;
  const segmentCount = 12;
  const reports = [];
  let affectedPixelCount = 0;
  for (const north of [true, false]) {
    const neutralSourceBand = polarRows(
      height,
      north,
      polarJoin.neutralToneSourceSouthLatitudeDeg,
      polarJoin.neutralToneSourceNorthLatitudeDeg
    );
    const neutralTone = neutralMean(
      historicalRgb,
      width,
      neutralSourceBand.first,
      neutralSourceBand.afterLast,
      0,
      width
    );
    const capBand = polarRows(height, north, join + halfWidth, join + halfWidth + 2);
    const capTarget = neutralMean(output, width, capBand.first, capBand.afterLast, 0, width);
    const corrections = [];
    const sourceBand = polarRows(height, north, normalizationStart, join - halfWidth);
    for (let segment = 0; segment < segmentCount; segment += 1) {
      const firstColumn = Math.floor((segment / segmentCount) * width);
      const afterLastColumn = Math.floor(((segment + 1) / segmentCount) * width);
      const sourceMean = neutralMean(
        output,
        width,
        sourceBand.first,
        sourceBand.afterLast,
        firstColumn,
        afterLastColumn
      );
      corrections.push(
        sourceMean.map((value, channel) =>
          Math.max(-18, Math.min(18, capTarget[channel] - value))
        )
      );
    }
    for (let y = sourceBand.first; y < sourceBand.afterLast; y += 1) {
      const latitude = Math.abs(pixelLatitude(height, y));
      const latitudeWeight = smoothstep01(
        (latitude - normalizationStart) / (join - halfWidth - normalizationStart)
      );
      for (let x = 0; x < width; x += 1) {
        const segment = Math.min(segmentCount - 1, Math.floor((x / width) * segmentCount));
        const next = (segment + 1) % segmentCount;
        const segmentFraction = ((x / width) * segmentCount) % 1;
        const index = (y * width + x) * 3;
        const red = output[index];
        const green = output[index + 1];
        const blue = output[index + 2];
        const luminance = (red + green + blue) / 3;
        const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
        const pixelWeight =
          latitudeWeight *
          Math.max(0, Math.min(1, (luminance - 100) / 80)) *
          Math.max(0, Math.min(1, (62 - chroma) / 34)) *
          0.82;
        for (let channel = 0; channel < 3; channel += 1) {
          const correction =
            corrections[segment][channel] * (1 - segmentFraction) +
            corrections[next][channel] * segmentFraction;
          output[index + channel] = Math.round(
            Math.max(0, Math.min(255, output[index + channel] + correction * pixelWeight))
          );
        }
      }
    }
    const joinBand = polarRows(height, north, join - halfWidth, join + halfWidth);
    const goreAnchor = rowForLatitude(height, north ? join - halfWidth : -(join - halfWidth));
    const capAnchor = rowForLatitude(height, north ? join + halfWidth : -(join + halfWidth));
    for (let y = joinBand.first; y < joinBand.afterLast; y += 1) {
      const latitude = Math.abs(pixelLatitude(height, y));
      const mix = smoothstep01((latitude - (join - halfWidth)) / (2 * halfWidth));
      for (let x = 0; x < width; x += 1) {
        const target = (y * width + x) * 3;
        const gore = (goreAnchor * width + x) * 3;
        const cap = (capAnchor * width + x) * 3;
        for (let channel = 0; channel < 3; channel += 1) {
          output[target + channel] = Math.round(
            output[gore + channel] * (1 - mix) + output[cap + channel] * mix
          );
        }
      }
    }
    const neutralToneBand = polarRows(
      height,
      north,
      polarJoin.neutralToneBlendStartLatitudeDeg,
      90
    );
    for (let y = neutralToneBand.first; y < neutralToneBand.afterLast; y += 1) {
      const latitude = Math.abs(pixelLatitude(height, y));
      const mix = smoothstep01(
        (latitude - polarJoin.neutralToneBlendStartLatitudeDeg) /
          (polarJoin.neutralToneSolidLatitudeDeg -
            polarJoin.neutralToneBlendStartLatitudeDeg)
      );
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 3;
        for (let channel = 0; channel < 3; channel += 1) {
          output[index + channel] = Math.round(
            output[index + channel] * (1 - mix) + neutralTone[channel] * mix
          );
        }
      }
    }
    const affectedBand = polarRows(height, north, normalizationStart, 90);
    affectedPixelCount += (affectedBand.afterLast - affectedBand.first) * width;
    reports.push({
      hemisphere: north ? "north" : "south",
      capTargetRgb: capTarget,
      neutralToneRgb: neutralTone,
    });
  }
  return {
    output,
    affectedPixelCount,
    report: {
      ...polarJoin,
      method:
        "neutral-low-frequency-gore-normalization-plus-real-cap-smoothstep-and-longitude-neutral-polar-tone",
      inventedLandOrLabelsAdded: false,
      hemispheres: reports,
      labelsOrInventedDetailsAdded: false,
    },
  };
}

function sourceStripRows(height, strip) {
  const first = Math.max(
    0,
    Math.min(height - 1, Math.floor(((90 - strip.northLatitudeDeg) / 180) * height))
  );
  const afterLast = Math.max(
    first + 1,
    Math.min(height, Math.ceil(((90 - strip.southLatitudeDeg) / 180) * height))
  );
  return { first, afterLast };
}

function deriveParchment(historicalRgb, width, height, strip) {
  const columns = Math.min(strip.lowFrequencyColumns, width);
  const rows = Math.min(strip.lowFrequencyRows, height);
  const { first, afterLast } = sourceStripRows(height, strip);
  const sums = new Float64Array(columns * rows * 3);
  const counts = new Uint32Array(columns * rows);
  for (let y = first; y < afterLast; y += 1) {
    const rowBucket = Math.min(
      rows - 1,
      Math.floor(((y - first) / (afterLast - first)) * rows)
    );
    for (let x = 0; x < width; x += 1) {
      const columnBucket = Math.min(columns - 1, Math.floor((x / width) * columns));
      const bucket = rowBucket * columns + columnBucket;
      const source = (y * width + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        sums[bucket * 3 + channel] += historicalRgb[source + channel];
      }
      counts[bucket] += 1;
    }
  }
  const samples = new Float64Array(columns * rows * 3);
  const global = [0, 0, 0];
  let globalCount = 0;
  for (let bucket = 0; bucket < counts.length; bucket += 1) {
    assert(counts[bucket] > 0, "A low-frequency parchment bucket is empty.");
    for (let channel = 0; channel < 3; channel += 1) {
      samples[bucket * 3 + channel] = sums[bucket * 3 + channel] / counts[bucket];
      global[channel] += sums[bucket * 3 + channel];
    }
    globalCount += counts[bucket];
  }
  for (let channel = 0; channel < 3; channel += 1) global[channel] /= globalCount;
  return {
    columns,
    rows,
    samples,
    global,
    sourceRows: { first, afterLastExclusive: afterLast },
  };
}

function sampleParchment(field, xFraction, yFraction, channel) {
  const scaledX = xFraction * field.columns - 0.5;
  const baseX = Math.floor(scaledX);
  const xMix = scaledX - baseX;
  const x0 = ((baseX % field.columns) + field.columns) % field.columns;
  const x1 = (x0 + 1) % field.columns;
  const scaledY = Math.max(0, Math.min(1, yFraction)) * (field.rows - 1);
  const y0 = Math.floor(scaledY);
  const y1 = Math.min(field.rows - 1, y0 + 1);
  const yMix = scaledY - y0;
  const value00 = field.samples[(y0 * field.columns + x0) * 3 + channel];
  const value10 = field.samples[(y0 * field.columns + x1) * 3 + channel];
  const value01 = field.samples[(y1 * field.columns + x0) * 3 + channel];
  const value11 = field.samples[(y1 * field.columns + x1) * 3 + channel];
  const top = value00 + (value10 - value00) * xMix;
  const bottom = value01 + (value11 - value01) * xMix;
  return (top + (bottom - top) * yMix) * 0.88 + field.global[channel] * 0.12;
}

function provenanceClasses(counts, total) {
  return Object.entries(counts).map(([provenanceClass, pixelCount]) => ({
    provenanceClass,
    pixelCount,
    percentage: Number(((pixelCount / total) * 100).toFixed(6)),
  }));
}

export function adaptHistoricalPixels({
  historicalRgb,
  width,
  height,
  landMask,
  antarcticaMask,
  coastline,
  antarctica,
  polarJoin,
  protectedRegions,
}) {
  assert(historicalRgb.length === width * height * 3, "Historical RGB dimensions do not match.");
  assert(
    landMask.length === width * height && antarcticaMask.length === width * height,
    "Canonical mask dimensions do not match."
  );
  const configuredRadius = coastline.edgeSampleRadiusPixelsAt8192Width ?? 1;
  const sampleRadius = Math.max(1, Math.round((configuredRadius * width) / 8192));
  const edge = computeUnionCoastlineEdge(landMask, width, height, sampleRadius);
  const polar = polarJoin
    ? stabilizePolarJoin(historicalRgb, width, height, polarJoin)
    : { output: Buffer.from(historicalRgb), affectedPixelCount: 0, report: null };
  const antarcticaEnabled = antarctica.enabled !== false;
  const parchment = antarcticaEnabled
    ? deriveParchment(polar.output, width, height, antarctica.sourceStrip)
    : null;
  const output = Buffer.from(polar.output);
  const counts = {
    historicalSourceUnmodified: 0,
    protectedHistoricalSourceUnmodified: 0,
    sourceDerivedCoastlineDarkening: 0,
    sourceDerivedPolarJoin: 0,
    sourceDerivedPolarJoinWithCoastlineDarkening: 0,
    sourceDerivedAntarcticaParchment: 0,
    sourceDerivedAntarcticaParchmentWithCoastlineDarkening: 0,
  };
  let coastlineDarkenedPixelCount = 0;
  let antarcticaAffectedPixelCount = 0;

  for (let y = 0; y < height; y += 1) {
    const latitude = pixelLatitude(height, y);
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const rgb = pixel * 3;
      if (
        protectedRegionAt(
          protectedRegions,
          pixelLongitude(width, x),
          latitude
        )
      ) {
        counts.protectedHistoricalSourceUnmodified += 1;
        continue;
      }
      const antarcticaAlpha = antarcticaMask[pixel] / 255;
      const edgeAlpha = edge[pixel] / 255;
      const hasFill = antarcticaEnabled && antarcticaAlpha > 0;
      const hasEdge = edgeAlpha > 0;
      const absoluteLatitude = Math.abs(latitude);
      const hasPolarJoin =
        polarJoin !== undefined &&
        absoluteLatitude >= polarJoin.paletteNormalizationStartLatitudeDeg;
      if (hasFill) {
        const fillNorthLatitude = antarctica.sourceStrip.southLatitudeDeg;
        const latitudeFraction = Math.max(
          0,
          Math.min(1, (fillNorthLatitude - latitude) / (fillNorthLatitude + 90))
        );
        for (let channel = 0; channel < 3; channel += 1) {
          const parchmentValue = sampleParchment(
            parchment,
            (x + 0.5) / width,
            latitudeFraction,
            channel
          );
          output[rgb + channel] = Math.round(
            polar.output[rgb + channel] * (1 - antarcticaAlpha) +
              parchmentValue * antarcticaAlpha
          );
        }
        antarcticaAffectedPixelCount += 1;
      }
      if (hasEdge) {
        const factor = 1 - coastline.maximumDarkeningOpacity * edgeAlpha;
        for (let channel = 0; channel < 3; channel += 1) {
          output[rgb + channel] = Math.round(output[rgb + channel] * factor);
        }
        coastlineDarkenedPixelCount += 1;
      }
      if (hasFill && hasEdge) {
        counts.sourceDerivedAntarcticaParchmentWithCoastlineDarkening += 1;
      } else if (hasFill) {
        counts.sourceDerivedAntarcticaParchment += 1;
      } else if (hasPolarJoin && hasEdge) {
        counts.sourceDerivedPolarJoinWithCoastlineDarkening += 1;
      } else if (hasPolarJoin) {
        counts.sourceDerivedPolarJoin += 1;
      } else if (hasEdge) {
        counts.sourceDerivedCoastlineDarkening += 1;
      } else {
        counts.historicalSourceUnmodified += 1;
      }
    }
  }
  return {
    output,
    edge,
    provenanceClasses: provenanceClasses(counts, width * height),
    coastlineDarkenedPixelCount,
    antarcticaAffectedPixelCount,
    polarJoinAffectedPixelCount: polar.affectedPixelCount,
    polarJoin: polar.report,
    parchment: parchment
      ? {
          enabled: true,
          derivation: "deterministic-block-average-and-bilinear-interpolation",
          columns: parchment.columns,
          rows: parchment.rows,
          sourceRows: parchment.sourceRows,
          globalRgbMean: parchment.global.map((value) => Number(value.toFixed(6))),
          randomTextureUsed: false,
          labelsOrInventedDetailsAdded: false,
        }
      : {
          enabled: false,
          derivation: null,
          historicalSourceRgbPreserved: true,
          labelsOrInventedDetailsAdded: false,
        },
  };
}

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * fraction))
  );
  return sorted[index];
}

export function summarizeConfiguredTransform(controlPoints, width, height) {
  const displacement = controlPoints
    .map((point) => {
      const x = (longitudeDelta(point.historicalLongitudeDeg, point.canonicalLongitudeDeg) / 360) * width;
      const y = ((point.canonicalLatitudeDeg - point.historicalLatitudeDeg) / 180) * height;
      return Math.hypot(x, y);
    })
    .toSorted((left, right) => left - right);
  const meanSquare =
    displacement.reduce((sum, value) => sum + value * value, 0) / displacement.length;
  return {
    metricClass: "configured-transform-displacement-not-observed-residual",
    controlPointCount: controlPoints.length,
    medianDisplacementPixels: percentile(displacement, 0.5),
    rootMeanSquareDisplacementPixels: Number(Math.sqrt(meanSquare).toFixed(6)),
    maximumDisplacementPixels: displacement.at(-1),
    nonlinearWarpApplied: false,
    interpretation:
      "Zero values prove that the configured transform is identity; they do not prove geographic alignment.",
    pass: null,
  };
}

function lumaAt(rgb, width, height, x, y) {
  const wrappedX = ((x % width) + width) % width;
  const clampedY = Math.max(0, Math.min(height - 1, y));
  const index = (clampedY * width + wrappedX) * 3;
  return rgb[index] * 0.2126 + rgb[index + 1] * 0.7152 + rgb[index + 2] * 0.0722;
}

function lumaGradient(rgb, width, height, x, y) {
  return (
    Math.abs(lumaAt(rgb, width, height, x + 1, y) - lumaAt(rgb, width, height, x - 1, y)) +
    Math.abs(lumaAt(rgb, width, height, x, y + 1) - lumaAt(rgb, width, height, x, y - 1))
  );
}

function registrationDiagnostic({
  historicalRgb,
  width,
  height,
  edge,
  antarcticaMask,
  protectedRegions,
  maximumSamples,
  searchRadius,
}) {
  const eligible = [];
  for (let y = 1; y < height - 1; y += 1) {
    const latitude = pixelLatitude(height, y);
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (
        edge[index] >= 96 &&
        antarcticaMask[index] === 0 &&
        !protectedRegionAt(protectedRegions, pixelLongitude(width, x), latitude)
      ) {
        eligible.push(index);
      }
    }
  }
  const stride = Math.max(1, Math.ceil(eligible.length / maximumSamples));
  const offsets = [];
  for (let sample = 0; sample < eligible.length; sample += stride) {
    const index = eligible[sample];
    const x = index % width;
    const y = Math.floor(index / width);
    let strongestGradient = -1;
    let strongestDistance = 0;
    for (let dy = -searchRadius; dy <= searchRadius; dy += 1) {
      for (let dx = -searchRadius; dx <= searchRadius; dx += 1) {
        const gradient = lumaGradient(historicalRgb, width, height, x + dx, y + dy);
        const distance = Math.hypot(dx, dy);
        if (
          gradient > strongestGradient ||
          (gradient === strongestGradient && distance < strongestDistance)
        ) {
          strongestGradient = gradient;
          strongestDistance = distance;
        }
      }
    }
    offsets.push(strongestDistance);
  }
  const sorted = offsets.toSorted((left, right) => left - right);
  const mean = sorted.length
    ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length
    : null;
  return {
    status: "diagnostic-no-pass-threshold",
    method:
      "At sampled non-Antarctic canonical union-coastline pixels, locate the strongest Historical Master luminance gradient in a bounded neighborhood. Graticules, lettering and relief can influence this diagnostic; it is not a landmark residual PASS.",
    eligibleCanonicalEdgePixelCount: eligible.length,
    sampleCount: sorted.length,
    samplingStride: stride,
    searchRadiusPixels: searchRadius,
    meanStrongestGradientOffsetPixels: mean === null ? null : Number(mean.toFixed(6)),
    medianStrongestGradientOffsetPixels: percentile(sorted, 0.5),
    p95StrongestGradientOffsetPixels: percentile(sorted, 0.95),
    maximumStrongestGradientOffsetPixels: sorted.at(-1) ?? null,
    normalizedMedianOffsetPercentOfWidth: sorted.length
      ? Number(((percentile(sorted, 0.5) / width) * 100).toFixed(6))
      : null,
    pass: null,
  };
}

async function loadHistoricalMaster(config) {
  const reportsRoot = path.resolve(repositoryRoot, "reports", "globe-editions");
  const mastersRoot = repositoryPath(config.output.directory, "output.directory");
  const sidecarPath = repositoryPath(
    config.historicalInput.sidecarPath,
    "historicalInput.sidecarPath"
  );
  const sidecarBytes = await readContained(
    sidecarPath,
    reportsRoot,
    "Historical Master sidecar"
  );
  const sidecar = JSON.parse(sidecarBytes.toString("utf8"));
  assert(
    sidecar.schemaVersion === 1 &&
      sidecar.editionId === config.editionId &&
      sidecar.stage === "historical-master" &&
      sidecar.artifactKind === config.historicalInput.requiredArtifactKind &&
      sidecar.productionEligible ===
        config.historicalInput.requiredProductionEligible,
    "Historical Master identity/gates are invalid."
  );
  assert(
    sidecar.gates?.seamPaperRuns ===
      config.historicalInput.requiredSeamPaperRunGate &&
      sidecar.qa?.seamPaperRuns?.gate?.passed === true &&
      sidecar.gates?.historicalMaster === "generated",
    "Historical Master seam/generation gates have not passed."
  );
  const historicalPath = repositoryPath(
    sidecar.output?.path,
    "Historical Master output.path"
  );
  assert(
    isInside(mastersRoot, historicalPath) &&
      new RegExp(
        `^${config.editionId}-historical-master-[0-9]+x[0-9]+\\.png$`,
        "u"
      ).test(path.basename(historicalPath)),
    "Historical Master is not the fixed ignored-cache artifact."
  );
  const historicalBytes = await readContained(
    historicalPath,
    mastersRoot,
    "Historical Master"
  );
  const metadata = await sharp(historicalBytes).metadata();
  const hasProfile =
    metadata.hasProfile === true || metadata.icc !== undefined;
  assert(
    metadata.format === "png" &&
      Number.isInteger(metadata.width) &&
      Number.isInteger(metadata.height) &&
      metadata.width === metadata.height * 2 &&
      metadata.width === sidecar.output.width &&
      metadata.height === sidecar.output.height &&
      metadata.space === "srgb" &&
      metadata.depth === "uchar" &&
      metadata.channels === 3 &&
      metadata.hasAlpha !== true &&
      !hasProfile &&
      sidecar.output.lossless === true &&
      sidecar.output.sha256 === hash(historicalBytes) &&
      sidecar.output.bytes === historicalBytes.length,
    "Historical Master bytes/metadata do not match the sidecar."
  );
  const { data: historicalRgb, info } = await sharp(historicalBytes)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert(info.channels === 3, "Historical Master raw decode is not RGB.");
  return {
    sidecarBytes,
    sidecarPath,
    historicalBytes,
    historicalPath,
    historicalRgb,
    width: info.width,
    height: info.height,
  };
}

async function loadCanonicalAtlas(config) {
  const geoRoot = path.resolve(repositoryRoot, "src", "data", "geo");
  const atlasPath = repositoryPath(config.canonicalAtlas.path, "canonicalAtlas.path");
  const provenancePath = repositoryPath(
    config.canonicalAtlas.provenancePath,
    "canonicalAtlas.provenancePath"
  );
  const [atlasBytes, provenanceBytes] = await Promise.all([
    readContained(atlasPath, geoRoot, "Canonical atlas"),
    readContained(provenancePath, geoRoot, "Canonical atlas provenance"),
  ]);
  assert(
    hash(atlasBytes) === config.canonicalAtlas.localSha256 &&
      hash(provenanceBytes) === config.canonicalAtlas.provenanceSha256,
    "Canonical atlas or provenance checksum changed."
  );
  const atlas = JSON.parse(atlasBytes.toString("utf8"));
  const provenance = JSON.parse(provenanceBytes.toString("utf8"));
  assert(
    atlas.type === "FeatureCollection" &&
      atlas.features.length === config.canonicalAtlas.featureCount &&
      provenance.dataset === config.canonicalAtlas.dataset &&
      provenance.repositoryVersion === config.canonicalAtlas.repositoryVersion &&
      provenance.featureCount === atlas.features.length &&
      provenance.localSha256 === config.canonicalAtlas.localSha256,
    "Canonical atlas provenance identity is invalid."
  );
  for (const [index, feature] of atlas.features.entries()) {
    polygons(feature.geometry, `atlas feature ${index}`);
  }
  return {
    atlas,
    atlasBytes,
    atlasPath,
    provenance,
    provenanceBytes,
    provenancePath,
  };
}

async function main() {
  const argumentsMap = parseArguments(process.argv.slice(2));
  const configPath = repositoryPath(
    argumentsMap.get("config") ?? defaultConfigPath,
    "--config"
  );
  const configRoot = path.resolve(repositoryRoot, "scripts", "globe-editions");
  const configBytes = await readContained(configPath, configRoot, "Alignment config");
  const config = validateAlignmentConfig(JSON.parse(configBytes.toString("utf8")));

  const [historical, canonical] = await Promise.all([
    loadHistoricalMaster(config),
    loadCanonicalAtlas(config),
  ]);
  const { width, height } = historical;
  const masks = await buildCanonicalMasks(canonical.atlas, width, height, {
    property: config.antarctica.canonicalFeatureProperty,
    value: config.antarctica.canonicalFeatureValue,
  });
  const adapted = adaptHistoricalPixels({
    historicalRgb: historical.historicalRgb,
    width,
    height,
    landMask: masks.landMask,
    antarcticaMask: masks.antarcticaMask,
    coastline: config.canonicalCoastline,
    antarctica: config.antarctica,
    polarJoin: config.polarJoin,
    protectedRegions: config.protectedHistoricalContent.regions,
  });
  const outputBytes = await sharp(adapted.output, {
    raw: { width, height, channels: 3 },
  })
    .png({ compressionLevel: 9, palette: false, adaptiveFiltering: false })
    .toBuffer();
  const outputMetadata = await sharp(outputBytes).metadata();
  const outputHasProfile =
    outputMetadata.hasProfile === true || outputMetadata.icc !== undefined;
  assert(
    outputMetadata.format === "png" &&
      outputMetadata.width === width &&
      outputMetadata.height === height &&
      outputMetadata.space === "srgb" &&
      outputMetadata.depth === "uchar" &&
      outputMetadata.channels === 3 &&
      outputMetadata.hasAlpha !== true &&
      !outputHasProfile,
    "Adapted Master is not unprofiled lossless three-channel 8-bit sRGB PNG."
  );

  const outputDirectory = repositoryPath(config.output.directory, "output.directory");
  const outputFilename = config.output.filenamePattern
    .replace("{width}", String(width))
    .replace("{height}", String(height));
  assert(
    outputFilename ===
      `${config.editionId}-interactive-adapted-master-${width}x${height}.png`,
    "Adapted Master filename convention changed."
  );
  const outputPath = path.resolve(outputDirectory, outputFilename);
  const sidecarPath = repositoryPath(config.output.sidecarPath, "output.sidecarPath");
  const reportsRoot = path.resolve(repositoryRoot, "reports", "globe-editions");
  await Promise.all([
    assertWritable(outputPath, outputDirectory, "Adapted Master"),
    assertWritable(sidecarPath, reportsRoot, "Adapted Master sidecar"),
  ]);

  const searchRadius = Math.max(
    1,
    Math.round(
      (config.qa.canonicalRegistration.gradientSearchRadiusPixelsAt4096Width *
        width) /
        4096
    )
  );
  const configuredTransform = summarizeConfiguredTransform(
    config.transform.controlPoints,
    width,
    height
  );
  const canonicalCoastlineRegistration = registrationDiagnostic({
    historicalRgb: historical.historicalRgb,
    width,
    height,
    edge: adapted.edge,
    antarcticaMask: masks.antarcticaMask,
    protectedRegions: config.protectedHistoricalContent.regions,
    maximumSamples: config.qa.canonicalRegistration.maximumSamples,
    searchRadius,
  });
  const totalPixelCount = width * height;
  const manifest = {
    schemaVersion: 1,
    editionId: config.editionId,
    stage: "interactive-adapted-master",
    artifactKind: "interactive-adapted-master",
    trackedSidecar: true,
    productionReady: false,
    reviewState: "generated-awaiting-independent-qa",
    algorithm: {
      version: algorithmVersion,
      deterministic: true,
      networkAccessUsed: false,
      nonlinearWarpApplied: false,
      randomTextureUsed: false,
      genericModernMapFillUsed: false,
      labelsOrInventedDetailsAdded: false,
    },
    alignmentConfig: {
      path: path.relative(repositoryRoot, configPath).replaceAll("\\", "/"),
      sha256: hash(configBytes),
      transformVersion: config.transform.version,
      evidenceStatus: config.transform.evidenceStatus,
      evidence: config.transform.evidence,
      reviewerNote: config.transform.reviewerNote,
      controlPoints: config.transform.controlPoints,
    },
    historicalMasterInput: {
      sidecarPath: path
        .relative(repositoryRoot, historical.sidecarPath)
        .replaceAll("\\", "/"),
      sidecarSha256: hash(historical.sidecarBytes),
      path: path
        .relative(repositoryRoot, historical.historicalPath)
        .replaceAll("\\", "/"),
      bytes: historical.historicalBytes.length,
      sha256: hash(historical.historicalBytes),
      width,
      height,
      modifiedInPlace: false,
    },
    canonicalAtlas: {
      path: path.relative(repositoryRoot, canonical.atlasPath).replaceAll("\\", "/"),
      sha256: hash(canonical.atlasBytes),
      provenancePath: path
        .relative(repositoryRoot, canonical.provenancePath)
        .replaceAll("\\", "/"),
      provenanceSha256: hash(canonical.provenanceBytes),
      dataset: canonical.provenance.dataset,
      repositoryVersion: canonical.provenance.repositoryVersion,
      featureCount: canonical.atlas.features.length,
      mask: "union-of-all-canonical-land-polygons",
      internalCountryBordersRendered: false,
    },
    protectedHistoricalContent: {
      regions: config.protectedHistoricalContent.regions,
      treatment: "input RGB copied byte-for-byte inside every protected region",
    },
    processing: {
      canonicalCoastline: config.canonicalCoastline,
      antarctica: {
        ...config.antarctica,
        derivedField: adapted.parchment,
      },
      polarJoin: adapted.polarJoin,
    },
    provenance: {
      totalPixelCount,
      classes: adapted.provenanceClasses,
      coastlineDarkenedPixelCount: adapted.coastlineDarkenedPixelCount,
      antarcticaAffectedPixelCount: adapted.antarcticaAffectedPixelCount,
      polarJoinAffectedPixelCount: adapted.polarJoinAffectedPixelCount,
      note:
        "Classes are mutually exclusive and cover the output. Antarctica raster synthesis is disabled; only the source-derived polar join cleanup and canonical union-coastline darkening modify Historical Master RGB.",
    },
    output: {
      path: path.relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
      width,
      height,
      format: outputMetadata.format,
      bytes: outputBytes.length,
      sha256: hash(outputBytes),
      lossless: true,
      colorSpace: outputMetadata.space,
      depth: outputMetadata.depth,
      bitsPerChannel: 8,
      channels: outputMetadata.channels,
      hasAlpha: outputMetadata.hasAlpha === true,
      hasIccProfile: outputHasProfile,
    },
    qa: {
      configuredTransform,
      canonicalCoastlineRegistration,
      independentLandmarkResiduals: null,
      requiredReviewBeforeProduction: config.qa.requiredReviewBeforeProduction,
    },
    gates: {
      historicalMaster: "verified",
      historicalSeamPaperRuns: "pass",
      canonicalAtlasChecksum: "verified",
      unionLandMask: "generated",
      identityTransform: "applied",
      independentAlignmentReview: "pending",
      fourKAndTwoKVisualReview: "pending",
      runtimeReview: "pending",
      productionReady: false,
    },
    runtime: {
      node: process.versions.node,
      sharp: sharp.versions.sharp,
      vips: sharp.versions.vips,
    },
  };

  await writeFile(outputPath, outputBytes);
  await writeFile(sidecarPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(
    `Built ${width}x${height} Cassini Interactive Adapted Master at ${path.relative(
      repositoryRoot,
      outputPath
    )}; productionReady remains false pending independent QA.`
  );
}

const directExecution =
  process.argv[1] !== undefined &&
  (await realpath(path.resolve(process.argv[1]))) ===
    (await realpath(fileURLToPath(import.meta.url)));

if (directExecution) await main();
