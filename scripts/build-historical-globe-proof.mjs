import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const degreesToRadians = Math.PI / 180;
const historicalMasterStage = "historical-master";
const seamPaperRunThresholds = Object.freeze({
  luminanceMinimum: 198,
  chromaMaximum: 48,
  verticalSupportMinimumRatio: 0.4,
  maximumAbsoluteLatitudeDeg: 70,
  boundaryAdjacencyTolerancePixels: 1,
  requiredMaximumSolidContinuousRunWidthPixels: 0,
});

function parseArguments(argv) {
  const result = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    result.set(key.slice(2), value);
    index += 1;
  }
  return result;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function canonicalExistingAncestor(candidate) {
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

async function assertSafeOutput(outputPath) {
  const forbiddenRoots = [
    path.resolve(repositoryRoot, "public"),
    path.resolve(repositoryRoot, "scripts", "assets"),
  ];
  if (forbiddenRoots.some((root) => isInside(root, outputPath))) {
    throw new Error("Historical proofs may not write into production asset roots.");
  }

  const allowedRoots = [
    path.resolve(repositoryRoot, ".tmp"),
    path.resolve(repositoryRoot, "reports", "globe-editions"),
  ];
  if (!allowedRoots.some((root) => isInside(root, outputPath))) {
    throw new Error(
      "Historical proofs may write only inside .tmp/ or reports/globe-editions/."
    );
  }
  if (path.extname(outputPath).toLowerCase() !== ".png") {
    throw new Error(
      "The reduced historical projection proof must be a lossless PNG."
    );
  }

  await Promise.all(allowedRoots.map((root) => mkdir(root, { recursive: true })));
  const [canonicalAllowedRoots, canonicalForbiddenRoots] = await Promise.all([
    Promise.all(allowedRoots.map((root) => realpath(root))),
    Promise.all(forbiddenRoots.map((root) => realpath(root))),
  ]);
  if (
    canonicalAllowedRoots.some((allowedRoot) =>
      canonicalForbiddenRoots.some((forbiddenRoot) =>
        isInside(forbiddenRoot, allowedRoot)
      )
    )
  ) {
    throw new Error("Historical proof output roots may not resolve into production roots.");
  }

  const parentPath = path.dirname(outputPath);
  const canonicalAncestor = await canonicalExistingAncestor(parentPath);
  if (!canonicalAllowedRoots.some((root) => isInside(root, canonicalAncestor))) {
    throw new Error("Historical proof output parent resolves outside allowed roots.");
  }
  await mkdir(parentPath, { recursive: true });
  const canonicalParent = await realpath(parentPath);
  if (!canonicalAllowedRoots.some((root) => isInside(root, canonicalParent))) {
    throw new Error("Historical proof output parent resolves outside allowed roots.");
  }

  try {
    const targetStat = await lstat(outputPath);
    if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
      throw new Error("Historical proof output target must be a regular file.");
    }
    const canonicalTarget = await realpath(outputPath);
    if (!canonicalAllowedRoots.some((root) => isInside(root, canonicalTarget))) {
      throw new Error("Historical proof output target resolves outside allowed roots.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function assertSafeHistoricalMasterOutput(outputPath, editionId) {
  const mastersRoot = path.resolve(
    repositoryRoot,
    "scripts",
    ".cache",
    "globe-editions",
    editionId,
    "masters"
  );
  if (
    outputPath === mastersRoot ||
    !isInside(mastersRoot, outputPath) ||
    path.extname(outputPath).toLowerCase() !== ".png"
  ) {
    throw new Error(
      "Historical Masters may write lossless PNG files only inside the edition's ignored masters cache."
    );
  }

  const canonicalAncestor = await canonicalExistingAncestor(mastersRoot);
  const canonicalScriptsRoot = await realpath(
    path.resolve(repositoryRoot, "scripts")
  );
  if (!isInside(canonicalScriptsRoot, canonicalAncestor)) {
    throw new Error("Historical Master cache resolves outside scripts/.");
  }
  await mkdir(mastersRoot, { recursive: true });
  const canonicalMastersRoot = await realpath(mastersRoot);
  if (!isInside(canonicalScriptsRoot, canonicalMastersRoot)) {
    throw new Error("Historical Master cache escaped the canonical scripts root.");
  }

  const parentPath = path.dirname(outputPath);
  await mkdir(parentPath, { recursive: true });
  const canonicalParent = await realpath(parentPath);
  if (!isInside(canonicalMastersRoot, canonicalParent)) {
    throw new Error("Historical Master output parent escaped its cache root.");
  }

  try {
    const targetStat = await lstat(outputPath);
    if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
      throw new Error("Historical Master output target must be a regular file.");
    }
    const canonicalTarget = await realpath(outputPath);
    if (!isInside(canonicalMastersRoot, canonicalTarget)) {
      throw new Error("Historical Master output target escaped its cache root.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function assertSafeHistoricalMasterSidecar(sidecarPath, editionId) {
  const reportsRoot = path.resolve(repositoryRoot, "reports", "globe-editions");
  const expectedPath = path.resolve(
    reportsRoot,
    `${editionId}-historical-master.json`
  );
  if (sidecarPath !== expectedPath) {
    throw new Error("Historical Master sidecar path must use the tracked reports location.");
  }
  await mkdir(reportsRoot, { recursive: true });
  const canonicalReportsRoot = await realpath(reportsRoot);
  const canonicalRepositoryRoot = await realpath(repositoryRoot);
  if (!isInside(canonicalRepositoryRoot, canonicalReportsRoot)) {
    throw new Error("Historical Master reports root escaped the repository.");
  }
  try {
    const targetStat = await lstat(sidecarPath);
    if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
      throw new Error("Historical Master sidecar target must be a regular file.");
    }
    const canonicalTarget = await realpath(sidecarPath);
    if (!isInside(canonicalReportsRoot, canonicalTarget)) {
      throw new Error("Historical Master sidecar escaped the reports root.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function assertFiniteNumber(value, label, { integer = false, min, max } = {}) {
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    throw new Error(`${label} must be a finite${integer ? " integer" : ""} number.`);
  }
  if (min !== undefined && value < min) {
    throw new Error(`${label} must be at least ${min}.`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${label} must be at most ${max}.`);
  }
  return value;
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * fraction))
  );
  return sorted[index];
}

function summarizeDifferences(values) {
  const sorted = values.toSorted((left, right) => left - right);
  return {
    sampleCount: sorted.length,
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted.at(-1) ?? 0,
  };
}

function interpolate(start, end, fraction) {
  return start + (end - start) * fraction;
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function pixelOffset(width, x, y, channel) {
  return (y * width + x) * 3 + channel;
}

function sampleBilinear(image, x, y, channel) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    y < 0 ||
    x > image.width - 1 ||
    y > image.height - 1
  ) {
    throw new Error(
      `${image.id}: proof geometry sampled outside the source at ${x.toFixed(
        2
      )}, ${y.toFixed(2)}`
    );
  }

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const xBlend = x - x0;
  const yBlend = y - y0;
  const top =
    image.data[pixelOffset(image.width, x0, y0, channel)] * (1 - xBlend) +
    image.data[pixelOffset(image.width, x1, y0, channel)] * xBlend;
  const bottom =
    image.data[pixelOffset(image.width, x0, y1, channel)] * (1 - xBlend) +
    image.data[pixelOffset(image.width, x1, y1, channel)] * xBlend;
  return Math.round(top * (1 - yBlend) + bottom * yBlend);
}

function normalizedHalfWidth(row, side) {
  const measured =
    side === "left" ? row.centerX - row.leftX : row.rightX - row.centerX;
  const latitudeScale = Math.max(
    0.01,
    Math.cos(Math.abs(row.latitudeDeg) * degreesToRadians)
  );
  return measured / latitudeScale;
}

function sourceCoordinatesForGore(gore, latitude, longitudeOffset) {
  const [start, end, fraction] =
    latitude >= 0
      ? [
          gore.north,
          gore.equator,
          (gore.north.latitudeDeg - latitude) /
            (gore.north.latitudeDeg - gore.equator.latitudeDeg),
        ]
      : [
          gore.equator,
          gore.south,
          (gore.equator.latitudeDeg - latitude) /
            (gore.equator.latitudeDeg - gore.south.latitudeDeg),
        ];

  const centerX = interpolate(start.centerX, end.centerX, fraction);
  const y = interpolate(start.y, end.y, fraction);
  const latitudeScale = Math.cos(Math.abs(latitude) * degreesToRadians);
  const leftHalfWidth =
    interpolate(
      normalizedHalfWidth(start, "left"),
      normalizedHalfWidth(end, "left"),
      fraction
    ) * latitudeScale;
  const rightHalfWidth =
    interpolate(
      normalizedHalfWidth(start, "right"),
      normalizedHalfWidth(end, "right"),
      fraction
    ) * latitudeScale;
  const normalizedLongitude = longitudeOffset / gore.halfLongitudeSpanDeg;
  const x =
    centerX +
    normalizedLongitude *
      (normalizedLongitude < 0 ? leftHalfWidth : rightHalfWidth);
  return { x, y };
}

function sourceCoordinatesForCap(cap, latitude, longitude) {
  const distanceFromPole =
    (90 - Math.abs(latitude)) / (90 - cap.joinLatitudeDeg);
  const radius = cap.radius * distanceFromPole;
  const angle =
    (cap.zeroLongitudeAngleDeg + cap.longitudeDirection * longitude) *
    degreesToRadians;
  return {
    x: cap.centerX + Math.cos(angle) * radius,
    y: cap.centerY + Math.sin(angle) * radius,
  };
}

function normalizeGore(gore, defaultAngularWidthDeg) {
  const centralLongitudeDeg =
    gore.centralLongitudeDeg ?? gore.approxCentralLongitudeDeg;
  const angularWidthDeg = gore.angularWidthDeg ?? defaultAngularWidthDeg;
  if (!Number.isFinite(centralLongitudeDeg)) {
    throw new Error(`Gore ${gore.number} must define centralLongitudeDeg.`);
  }
  if (!Number.isFinite(angularWidthDeg) || angularWidthDeg <= 0 || angularWidthDeg > 360) {
    throw new Error(`Gore ${gore.number} has an invalid angular width.`);
  }
  if (gore.north && gore.equator && gore.south) {
    return {
      ...gore,
      centralLongitudeDeg,
      angularWidthDeg,
      halfLongitudeSpanDeg: angularWidthDeg / 2,
    };
  }
  const rowAt = (latitudeDeg) =>
    gore.rows?.find((row) => row.latitudeDeg === latitudeDeg);
  const north = rowAt(80);
  const equator = rowAt(0);
  const south = rowAt(-80);
  if (!north || !equator || !south) {
    throw new Error(
      `Gore ${gore.number} must define measured rows at +80, 0 and -80 degrees.`
    );
  }
  for (const [label, row] of [
    ["north", north],
    ["equator", equator],
    ["south", south],
  ]) {
    for (const field of ["latitudeDeg", "y", "leftX", "centerX", "rightX"]) {
      assertFiniteNumber(row[field], `Gore ${gore.number} ${label}.${field}`);
    }
    if (!(row.leftX < row.centerX && row.centerX < row.rightX)) {
      throw new Error(`Gore ${gore.number} ${label} row has invalid x ordering.`);
    }
  }
  return {
    ...gore,
    north,
    equator,
    south,
    centralLongitudeDeg,
    angularWidthDeg,
    halfLongitudeSpanDeg: angularWidthDeg / 2,
  };
}

function normalizeCap(cap, joinLatitudeDeg) {
  const normalized = {
    ...cap,
    radius: cap.radius ?? cap.radiusPx,
    zeroLongitudeAngleDeg:
      cap.zeroLongitudeAngleDeg ?? cap.zeroAngleDeg,
    longitudeDirection: cap.longitudeDirection ?? cap.direction,
    joinLatitudeDeg: cap.joinLatitudeDeg ?? joinLatitudeDeg,
  };
  for (const field of [
    "centerX",
    "centerY",
    "radius",
    "zeroLongitudeAngleDeg",
    "longitudeDirection",
    "joinLatitudeDeg",
  ]) {
    assertFiniteNumber(normalized[field], `${cap.hemisphere} cap.${field}`);
  }
  if (normalized.radius <= 0 || normalized.longitudeDirection === 0) {
    throw new Error(`${cap.hemisphere} cap radius/direction is invalid.`);
  }
  return normalized;
}

function signedLongitudeDifference(longitude, centerLongitude) {
  return mod(longitude - centerLongitude + 180, 360) - 180;
}

function selectGoreForLongitude(gores, longitude) {
  let selected = null;
  let selectedOffset = 0;
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const gore of gores) {
    const offset = signedLongitudeDifference(
      longitude,
      gore.centralLongitudeDeg
    );
    const distance = Math.abs(offset);
    if (
      distance < smallestDistance - Number.EPSILON ||
      (Math.abs(distance - smallestDistance) <= Number.EPSILON &&
        (!selected || gore.number < selected.number))
    ) {
      selected = gore;
      selectedOffset = offset;
      smallestDistance = distance;
    }
  }

  if (!selected || smallestDistance > selected.halfLongitudeSpanDeg + 1e-7) {
    throw new Error(
      `Historical gore geometry does not cover longitude ${longitude.toFixed(4)}.`
    );
  }
  return { gore: selected, longitudeOffset: selectedOffset };
}

function goreBoundaryLongitudes(gores) {
  const centers = gores
    .map(({ centralLongitudeDeg }) => mod(centralLongitudeDeg + 180, 360) - 180)
    .toSorted((left, right) => left - right);
  return centers.map((center, index) => {
    const next =
      index === centers.length - 1 ? centers[0] + 360 : centers[index + 1];
    return mod(center + (next - center) / 2 + 180, 360) - 180;
  });
}

function sourceInputFor(source, inputKind) {
  const expected =
    inputKind === "production"
      ? source.productionSourceInput
      : source.proofDerivative;
  if (inputKind === "proof") {
    const productionSourceStatus = source.productionSourceBinary?.status;
    if (
      expected?.productionEligible !== false ||
      expected?.tracked !== false ||
      !["not_acquired", "verified_in_external_config"].includes(
        productionSourceStatus
      )
    ) {
      throw new Error(`${source.id}: proof-only source gates are incomplete.`);
    }
  } else if (
    expected?.tracked !== false ||
    expected?.masterArtifact !== false
  ) {
    throw new Error(`${source.id}: production source-input gates are incomplete.`);
  }
  return expected;
}

async function readAndValidateSource(sourceDirectory, source, inputKind) {
  const expected = sourceInputFor(source, inputKind);
  if (
    typeof expected.filename !== "string" ||
    !expected.filename ||
    path.basename(expected.filename) !== expected.filename
  ) {
    throw new Error(`${source.id}: source filename must be a basename.`);
  }
  assertFiniteNumber(expected.width, `${source.id}.width`, {
    integer: true,
    min: 1,
  });
  assertFiniteNumber(expected.height, `${source.id}.height`, {
    integer: true,
    min: 1,
  });
  assertFiniteNumber(expected.bytes, `${source.id}.bytes`, {
    integer: true,
    min: 1,
  });
  if (!/^[0-9A-F]{64}$/u.test(expected.sha256)) {
    throw new Error(`${source.id}: expected an uppercase SHA-256 checksum.`);
  }
  const filePath = path.join(sourceDirectory, expected.filename);
  const [canonicalSourceDirectory, canonicalFile] = await Promise.all([
    realpath(sourceDirectory),
    realpath(filePath),
  ]);
  const fileStat = await lstat(filePath);
  if (
    fileStat.isSymbolicLink() ||
    !fileStat.isFile() ||
    !isInside(canonicalSourceDirectory, canonicalFile)
  ) {
    throw new Error(`${source.id}: source input must be a regular in-cache file.`);
  }
  const bytes = await readFile(filePath);
  const actualHash = sha256(bytes);
  if (bytes.length !== expected.bytes || actualHash !== expected.sha256) {
    throw new Error(`${source.id}: source input checksum/size mismatch.`);
  }

  const metadata = await sharp(bytes, { failOn: "warning" }).metadata();
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    throw new Error(`${source.id}: source input dimensions mismatch.`);
  }
  if (metadata.orientation && metadata.orientation !== 1) {
    throw new Error(`${source.id}: unexpected EXIF orientation.`);
  }

  if (inputKind === "production") {
    if (
      metadata.format !== expected.format ||
      metadata.space !== expected.colorSpace ||
      metadata.depth !== expected.depth ||
      metadata.channels !== expected.channels ||
      metadata.hasProfile === true ||
      metadata.icc !== undefined
    ) {
      throw new Error(`${source.id}: pinned production input metadata mismatch.`);
    }
  }

  return {
    id: source.id,
    encodedBytes: bytes,
    width: metadata.width,
    height: metadata.height,
    bytes: bytes.length,
    sha256: actualHash,
    format: metadata.format,
    colorSpace: metadata.space,
    depth: metadata.depth,
    channels: metadata.channels,
    hasIccProfile:
      metadata.hasProfile === true || metadata.icc !== undefined,
    localPath: path.relative(repositoryRoot, filePath).replaceAll("\\", "/"),
  };
}

async function decodeSource(source) {
  const { data, info } = await sharp(source.encodedBytes, { failOn: "warning" })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) {
    throw new Error(`${source.id}: expected a three-channel RGB source input.`);
  }
  return { ...source, data, width: info.width, height: info.height };
}

function scaleSurfaceGeometry(surface, geometrySources, inputSources, inputKind) {
  if (inputKind === "proof") return surface;
  const geometryById = new Map(
    geometrySources.map((source) => [source.id, source.proofDerivative])
  );
  const inputById = new Map(
    inputSources.map((source) => [source.id, source.productionSourceInput])
  );
  const scaleFor = (sourceId) => {
    const reference = geometryById.get(sourceId);
    const input = inputById.get(sourceId);
    if (!reference || !input) {
      throw new Error(`${sourceId}: missing geometry or production source input.`);
    }
    return { x: input.width / reference.width, y: input.height / reference.height };
  };

  return {
    ...surface,
    gores: surface.gores.map((gore) => {
      const scale = scaleFor(gore.sourceId);
      return {
        ...gore,
        rows: gore.rows.map((row) => ({
          ...row,
          y: row.y * scale.y,
          leftX: row.leftX * scale.x,
          centerX: row.centerX * scale.x,
          rightX: row.rightX * scale.x,
        })),
      };
    }),
    caps: surface.caps.map((cap) => {
      const scale = scaleFor(cap.sourceId);
      const isotropicRadiusScale = (scale.x + scale.y) / 2;
      return {
        ...cap,
        centerX: cap.centerX * scale.x,
        centerY: cap.centerY * scale.y,
        radiusPx: cap.radiusPx * isotropicRadiusScale,
      };
    }),
  };
}

function collectVerticalDifference(output, width, height, column, joinLatitudeDeg) {
  const values = [];
  const safeColumn = mod(column, width);
  const previousColumn = mod(safeColumn - 1, width);
  for (let y = 0; y < height; y += 1) {
    const latitude = 90 - ((y + 0.5) / height) * 180;
    if (Math.abs(latitude) > joinLatitudeDeg) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      values.push(
        Math.abs(
          output[pixelOffset(width, safeColumn, y, channel)] -
            output[pixelOffset(width, previousColumn, y, channel)]
        )
      );
    }
  }
  return values;
}

function collectHorizontalDifference(output, width, height, row) {
  const values = [];
  const safeRow = Math.min(height - 1, Math.max(1, row));
  for (let x = 0; x < width; x += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      values.push(
        Math.abs(
          output[pixelOffset(width, x, safeRow, channel)] -
            output[pixelOffset(width, x, safeRow - 1, channel)]
        )
      );
    }
  }
  return values;
}

function paperLikePixel(output, width, x, y) {
  const offset = pixelOffset(width, mod(x, width), y, 0);
  const red = output[offset];
  const green = output[offset + 1];
  const blue = output[offset + 2];
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const chroma =
    Math.max(red, green, blue) - Math.min(red, green, blue);
  return (
    luminance >= seamPaperRunThresholds.luminanceMinimum &&
    chroma <= seamPaperRunThresholds.chromaMaximum
  );
}

function contiguousOffsetRuns(offsets) {
  if (!offsets.length) return [];
  const sorted = offsets.toSorted((left, right) => left - right);
  const runs = [];
  let startOffset = sorted[0];
  let endOffset = sorted[0];
  for (const offset of sorted.slice(1)) {
    if (offset === endOffset + 1) {
      endOffset = offset;
      continue;
    }
    runs.push({
      startOffset,
      endOffset,
      widthPixels: endOffset - startOffset + 1,
    });
    startOffset = offset;
    endOffset = offset;
  }
  runs.push({
    startOffset,
    endOffset,
    widthPixels: endOffset - startOffset + 1,
  });
  return runs;
}

function distanceFromBoundary(run) {
  if (run.endOffset < -1) return -1 - run.endOffset;
  if (run.startOffset > 0) return run.startOffset;
  return 0;
}

function measureSeamPaperRuns(output, width, height, gores) {
  const searchRadiusPixels = Math.max(
    4,
    Math.round((width / 2048) * 12)
  );
  const evaluatedRows = [];
  for (let y = 0; y < height; y += 1) {
    const latitude = 90 - ((y + 0.5) / height) * 180;
    if (
      Math.abs(latitude) <=
      seamPaperRunThresholds.maximumAbsoluteLatitudeDeg
    ) {
      evaluatedRows.push(y);
    }
  }

  const perBoundary = goreBoundaryLongitudes(gores).map((longitudeDeg) => {
    const outputBoundaryColumn = Math.round(
      ((longitudeDeg + 180) / 360) * width
    );
    const columnSupport = [];
    for (
      let offset = -searchRadiusPixels;
      offset <= searchRadiusPixels;
      offset += 1
    ) {
      let paperLikeRows = 0;
      for (const y of evaluatedRows) {
        if (paperLikePixel(output, width, outputBoundaryColumn + offset, y)) {
          paperLikeRows += 1;
        }
      }
      const verticalSupportRatio =
        evaluatedRows.length === 0 ? 0 : paperLikeRows / evaluatedRows.length;
      columnSupport.push({
        offset,
        paperLikeRows,
        verticalSupportRatio,
      });
    }

    const solidColumnOffsets = columnSupport
      .filter(
        ({ verticalSupportRatio }) =>
          verticalSupportRatio >=
          seamPaperRunThresholds.verticalSupportMinimumRatio
      )
      .map(({ offset }) => offset);
    const solidRuns = contiguousOffsetRuns(solidColumnOffsets).map((run) => ({
      ...run,
      distanceFromBoundaryPixels: distanceFromBoundary(run),
    }));
    const boundaryRuns = solidRuns.filter(
      ({ distanceFromBoundaryPixels }) =>
        distanceFromBoundaryPixels <=
        seamPaperRunThresholds.boundaryAdjacencyTolerancePixels
    );
    const maximumSupport = columnSupport.reduce(
      (current, candidate) =>
        candidate.verticalSupportRatio > current.verticalSupportRatio
          ? candidate
          : current,
      columnSupport[0]
    );
    const leftGore = selectGoreForLongitude(
      gores,
      longitudeDeg - 1e-6
    ).gore;
    const rightGore = selectGoreForLongitude(
      gores,
      longitudeDeg + 1e-6
    ).gore;

    return {
      longitudeDeg,
      outputBoundaryColumn: mod(outputBoundaryColumn, width),
      leftGoreNumber: leftGore.number,
      rightGoreNumber: rightGore.number,
      evaluatedRowCount: evaluatedRows.length,
      solidColumnOffsets,
      solidRuns,
      solidContinuousPaperRunWidthPixels: Math.max(
        0,
        ...boundaryRuns.map(({ widthPixels }) => widthPixels)
      ),
      maximumColumnPaperSupport: {
        offset: maximumSupport.offset,
        ratio: Number(maximumSupport.verticalSupportRatio.toFixed(6)),
        percent: Number(
          (maximumSupport.verticalSupportRatio * 100).toFixed(3)
        ),
      },
    };
  });
  const maximumSolidContinuousPaperRunWidthPixels = Math.max(
    0,
    ...perBoundary.map(
      ({ solidContinuousPaperRunWidthPixels }) =>
        solidContinuousPaperRunWidthPixels
    )
  );
  const passed =
    maximumSolidContinuousPaperRunWidthPixels <=
    seamPaperRunThresholds.requiredMaximumSolidContinuousRunWidthPixels;

  return {
    method:
      "Vertical light/low-chroma support around configured gore boundaries; geometry is measured without seam blending or content replacement.",
    thresholds: {
      ...seamPaperRunThresholds,
      searchRadiusPixels,
    },
    perBoundary,
    maximumSolidContinuousPaperRunWidthPixels,
    gate: {
      requiredMaximumSolidContinuousPaperRunWidthPixels:
        seamPaperRunThresholds.requiredMaximumSolidContinuousRunWidthPixels,
      passed,
    },
  };
}

const argumentsMap = parseArguments(process.argv.slice(2));
const configPath = path.resolve(
  repositoryRoot,
  argumentsMap.get("config") ??
    "scripts/globe-editions/cassini-1790-proof.json"
);
const configBytes = await readFile(configPath);
const config = JSON.parse(configBytes.toString("utf8"));
const stage = argumentsMap.get("stage") ?? "proof";
if (stage !== "proof" && stage !== historicalMasterStage) {
  throw new Error("--stage must be either proof or historical-master.");
}
const isHistoricalMaster = stage === historicalMasterStage;
const inputKind =
  argumentsMap.get("input-kind") ?? (isHistoricalMaster ? "production" : "proof");
if (inputKind !== "proof" && inputKind !== "production") {
  throw new Error("--input-kind must be either proof or production.");
}
if (isHistoricalMaster && inputKind !== "production") {
  throw new Error("--stage historical-master requires --input-kind production.");
}

if (config.schemaVersion !== 1 || config.proofOnly !== true) {
  throw new Error("Only schemaVersion 1 proof-only configs are accepted.");
}
if (config.productionEligible !== false) {
  throw new Error("Historical proof config must remain production-ineligible.");
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(config.editionId)) {
  throw new Error("config.editionId must be a lowercase semantic slug.");
}
assertFiniteNumber(config.output?.width, "config.output.width", {
  integer: true,
  min: 2,
});
assertFiniteNumber(config.output?.height, "config.output.height", {
  integer: true,
  min: 1,
});
if (config.output.width !== config.output.height * 2) {
  throw new Error("Historical proof output must use a 2:1 equirectangular frame.");
}
if (config.surface.gores.length < 2) {
  throw new Error("Historical proof requires at least two measured gores.");
}
assertFiniteNumber(config.surface.joinLatitudeDeg, "surface.joinLatitudeDeg", {
  min: 1,
  max: 89,
});
const goreNumbers = config.surface.gores.map(({ number }) => number).toSorted(
  (left, right) => left - right
);
if (goreNumbers.some((number, index) => number !== index + 1)) {
  throw new Error(
    `Gore numbers must be unique and cover 1 through ${goreNumbers.length}.`
  );
}
if (config.surface.caps.length !== 2) {
  throw new Error("Historical proof requires measured north and south caps.");
}
if (isHistoricalMaster) {
  const longitudeStatus =
    (config.longitudeConvention ?? config.surface.longitudeConvention)?.status;
  if (!String(longitudeStatus ?? "").startsWith("verified_")) {
    throw new Error(
      "Historical Master requires a verified longitude convention."
    );
  }
  if (
    config.surface.caps.some(({ orientationStatus }) =>
      !String(orientationStatus ?? "").startsWith("verified_")
    )
  ) {
    throw new Error(
      "Historical Master requires verified north/south cap orientations."
    );
  }
}

const sourceConfigPath =
  inputKind === "production"
    ? path.resolve(
        repositoryRoot,
        argumentsMap.get("source-config") ??
          `scripts/globe-editions/${config.editionId}-production-sources.json`
      )
    : configPath;
const sourceConfigBytes =
  inputKind === "production" ? await readFile(sourceConfigPath) : configBytes;
const sourceConfig =
  inputKind === "production"
    ? JSON.parse(sourceConfigBytes.toString("utf8"))
    : config;
if (inputKind === "production") {
  if (
    sourceConfig.schemaVersion !== 1 ||
    sourceConfig.editionId !== config.editionId ||
    sourceConfig.artifactKind !==
      "official-full-resolution-production-source-inputs" ||
    sourceConfig.sourceInputsOnly !== true ||
    sourceConfig.masterArtifact !== false ||
    sourceConfig.runtimeEligible !== false ||
    sourceConfig.tracked !== false
  ) {
    throw new Error("Pinned production source-input config is invalid.");
  }
  if (
    !Array.isArray(sourceConfig.sources) ||
    sourceConfig.sources.length !== config.sources.length
  ) {
    throw new Error("Production source set must match the geometry source set.");
  }
  for (const geometrySource of config.sources) {
    const inputSource = sourceConfig.sources.find(
      ({ id }) => id === geometrySource.id
    );
    if (
      !inputSource ||
      inputSource.resourceId !== geometrySource.resourceId ||
      inputSource.role !== geometrySource.role
    ) {
      throw new Error(
        `${geometrySource.id}: production source identity/role mismatch.`
      );
    }
  }
}

const defaultWidth = isHistoricalMaster ? 8192 : config.output.width;
const defaultHeight = isHistoricalMaster ? 4096 : config.output.height;
const width = argumentsMap.has("width")
  ? Number(argumentsMap.get("width"))
  : defaultWidth;
const height = argumentsMap.has("height")
  ? Number(argumentsMap.get("height"))
  : argumentsMap.has("width")
    ? width / 2
    : defaultHeight;
assertFiniteNumber(width, "output.width", { integer: true, min: 2 });
assertFiniteNumber(height, "output.height", { integer: true, min: 1 });
if (width !== height * 2) {
  throw new Error("Historical proof output must use a 2:1 equirectangular frame.");
}
if (isHistoricalMaster && width < 8192) {
  throw new Error(
    "Historical Master width must be at least 8192 pixels; use proof stage for smaller calibration renders."
  );
}

const sourceDirectory = path.resolve(
  repositoryRoot,
  argumentsMap.get("source-dir") ??
    `scripts/.cache/globe-editions/${config.editionId}/${
      inputKind === "production" ? "production-inputs" : "proof-inputs"
    }`
);
const outputStem =
  inputKind === "production"
    ? `${config.editionId}-full-source-projection-proof`
    : `${config.editionId}-historical-proof`;
const outputPath = path.resolve(
  repositoryRoot,
  argumentsMap.get("output") ??
    (isHistoricalMaster
      ? `scripts/.cache/globe-editions/${config.editionId}/masters/${config.editionId}-historical-master-${width}x${height}.png`
      : `reports/globe-editions/${config.editionId}-proof/${outputStem}-${width}x${height}.png`)
);
if (isHistoricalMaster) {
  await assertSafeHistoricalMasterOutput(outputPath, config.editionId);
} else {
  await assertSafeOutput(outputPath);
}
const sidecarPath = isHistoricalMaster
  ? path.resolve(
      repositoryRoot,
      `reports/globe-editions/${config.editionId}-historical-master.json`
    )
  : outputPath.replace(/\.png$/iu, ".json");
if (isHistoricalMaster) {
  await assertSafeHistoricalMasterSidecar(sidecarPath, config.editionId);
}

const inputSources = sourceConfig.sources;
const sourceFilenames = inputSources.map(
  (source) => sourceInputFor(source, inputKind)?.filename
);
if (new Set(sourceFilenames.map((filename) => filename?.toLowerCase())).size !== sourceFilenames.length) {
  throw new Error("Source input filenames must be case-insensitively unique.");
}

const sourceRecords = new Map();
for (const source of inputSources) {
  sourceRecords.set(
    source.id,
    await readAndValidateSource(sourceDirectory, source, inputKind)
  );
}

const surface = scaleSurfaceGeometry(
  config.surface,
  config.sources,
  inputSources,
  inputKind
);
const defaultAngularWidthDeg =
  surface.goreAngularWidthDeg ?? 360 / surface.gores.length;
const gores = surface.gores
  .map((gore) => normalizeGore(gore, defaultAngularWidthDeg))
  .toSorted((left, right) => left.number - right.number);
const caps = new Map(
  surface.caps
    .map((cap) => normalizeCap(cap, surface.joinLatitudeDeg))
    .map((cap) => [cap.hemisphere, cap])
);
const output = Buffer.alloc(width * height * 3);
const mappedPixels = new Uint8Array(width * height);
let mappedPixelCount = 0;

const longitudeColumns = Array.from({ length: width }, (_, x) => {
  const longitude = ((x + 0.5) / width) * 360 - 180;
  return {
    longitude,
    selection: selectGoreForLongitude(gores, longitude),
  };
});
const latitudeRows = Float64Array.from(
  { length: height },
  (_, y) => 90 - ((y + 0.5) / height) * 180
);

for (const sourceRecord of sourceRecords.values()) {
  const source = await decodeSource(sourceRecord);
  for (let y = 0; y < height; y += 1) {
    const latitude = latitudeRows[y];
    const isCap = Math.abs(latitude) > surface.joinLatitudeDeg;
    const cap = isCap
      ? caps.get(latitude > 0 ? "north" : "south")
      : null;
    if (isCap && !cap) {
      throw new Error(`Missing ${latitude > 0 ? "north" : "south"} cap.`);
    }
    if (isCap && cap.sourceId !== source.id) continue;

    for (let x = 0; x < width; x += 1) {
      const column = longitudeColumns[x];
      const geometrySourceId = isCap
        ? cap.sourceId
        : column.selection.gore.sourceId;
      if (geometrySourceId !== source.id) continue;

      const coordinates = isCap
        ? sourceCoordinatesForCap(cap, latitude, column.longitude)
        : sourceCoordinatesForGore(
            column.selection.gore,
            latitude,
            column.selection.longitudeOffset
          );
      const pixelIndex = y * width + x;
      if (mappedPixels[pixelIndex]) {
        throw new Error(`Output pixel ${x},${y} received more than one source.`);
      }
      const outputIndex = pixelOffset(width, x, y, 0);
      output[outputIndex] = sampleBilinear(source, coordinates.x, coordinates.y, 0);
      output[outputIndex + 1] = sampleBilinear(
        source,
        coordinates.x,
        coordinates.y,
        1
      );
      output[outputIndex + 2] = sampleBilinear(
        source,
        coordinates.x,
        coordinates.y,
        2
      );
      mappedPixels[pixelIndex] = 1;
      mappedPixelCount += 1;
    }
  }
}
if (mappedPixelCount !== width * height) {
  throw new Error(
    `Historical projection mapped ${mappedPixelCount} of ${width * height} pixels.`
  );
}

const outputBytes = await sharp(output, {
  raw: { width, height, channels: 3 },
})
  .png({ compressionLevel: 9, palette: false, adaptiveFiltering: false })
  .toBuffer();
const outputMetadata = await sharp(outputBytes).metadata();
const outputHasIccProfile =
  outputMetadata.hasProfile === true || outputMetadata.icc !== undefined;
if (
  isHistoricalMaster &&
  (outputMetadata.format !== "png" ||
    outputMetadata.space !== "srgb" ||
    outputMetadata.depth !== "uchar" ||
    outputMetadata.channels !== 3 ||
    outputMetadata.hasAlpha === true ||
    outputHasIccProfile)
) {
  throw new Error(
    "Historical Master output must be an unprofiled, three-channel, 8-bit sRGB lossless PNG."
  );
}

const seamDifferences = [];
for (const longitude of goreBoundaryLongitudes(gores)) {
  const column = Math.round(((longitude + 180) / 360) * width);
  seamDifferences.push(
    ...collectVerticalDifference(
      output,
      width,
      height,
      column,
      surface.joinLatitudeDeg
    )
  );
}
const northJoinRow = Math.round(((90 - surface.joinLatitudeDeg) / 180) * height);
const southJoinRow = Math.round(((90 + surface.joinLatitudeDeg) / 180) * height);
const capJoinDifferences = [
  ...collectHorizontalDifference(output, width, height, northJoinRow),
  ...collectHorizontalDifference(output, width, height, southJoinRow),
];
const seamPaperRuns = measureSeamPaperRuns(output, width, height, gores);
if (isHistoricalMaster && !seamPaperRuns.gate.passed) {
  throw new Error(
    `Historical Master seam paper-run gate failed: maximum ${seamPaperRuns.maximumSolidContinuousPaperRunWidthPixels}px, required 0px.`
  );
}

await writeFile(outputPath, outputBytes);

const configPathRelative = path
  .relative(repositoryRoot, configPath)
  .replaceAll("\\", "/");
const sourceConfigPathRelative = path
  .relative(repositoryRoot, sourceConfigPath)
  .replaceAll("\\", "/");
const configHash = sha256(configBytes);
const sourceConfigHash = sha256(sourceConfigBytes);
const outputHash = sha256(outputBytes);
const mappedPixelCoveragePercent = Number(
  ((mappedPixelCount / (width * height)) * 100).toFixed(6)
);
const inputManifestRecords = [...sourceRecords.values()].map(
  ({
    id,
    localPath,
    width: sourceWidth,
    height: sourceHeight,
    bytes,
    sha256: hash,
    format,
    colorSpace,
    depth,
    channels,
    hasIccProfile,
  }) => ({
    id,
    localPath,
    width: sourceWidth,
    height: sourceHeight,
    bytes,
    sha256: hash,
    ...(isHistoricalMaster
      ? {
          format,
          colorSpace,
          depth,
          bitsPerChannel: depth === "uchar" ? 8 : null,
          channels,
          hasIccProfile,
        }
      : {}),
  })
);
const sourceSetHash = sha256(
  Buffer.from(
    inputManifestRecords
      .map(({ id, sha256: hash }) => `${id}:${hash}`)
      .toSorted()
      .join("\n"),
    "utf8"
  )
);

const proofManifest = {
  schemaVersion: 1,
  editionId: config.editionId,
  proofOnly: true,
  productionEligible: false,
  inputKind:
    inputKind === "production"
      ? "official-full-resolution-production-sources"
      : "reduced-proof-derivatives",
  configPath: configPathRelative,
  configSha256: configHash,
  sourceConfigPath: sourceConfigPathRelative,
  sourceConfigSha256: sourceConfigHash,
  output: {
    path: path.relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
    width,
    height,
    format: "png",
    bytes: outputBytes.length,
    sha256: outputHash,
  },
  inputs: inputManifestRecords,
  geometry: {
    joinLatitudeDeg: surface.joinLatitudeDeg,
    geometryScaledFromReferenceInputs: inputKind === "production",
    longitudeConvention:
      config.longitudeConvention ?? surface.longitudeConvention,
    capOrientationStatus: surface.caps.map(
      ({ hemisphere, orientationStatus }) => ({ hemisphere, orientationStatus })
    ),
    zodiacCalendarBandsUsed: false,
  },
  qa: {
    goreBoundaryRgbAbsoluteDifference: summarizeDifferences(seamDifferences),
    capJoinRgbAbsoluteDifference: summarizeDifferences(capJoinDifferences),
    mappedPixelCoveragePercent: Number(
      ((mappedPixelCount / (width * height)) * 100).toFixed(6)
    ),
    seamPaperRuns,
    verifiedGeographicCoveragePercent: null,
    canonicalAlignmentMetrics: null,
  },
  gates: {
    reducedProofInputsVerified: inputKind === "proof",
    reducedHistoricalProjectionProof: "generated",
    fullResolutionProductionSources:
      inputKind === "production" ? "verified" : "not_acquired",
    fullSourceHistoricalProjectionProof:
      inputKind === "production" ? "generated" : "not_started",
    interactiveAdaptedMaster: "not_started",
    productionReady: false,
  },
  runtime: {
    sharp: sharp.versions.sharp,
    vips: sharp.versions.vips,
  },
};

const historicalMasterManifest = {
  schemaVersion: 1,
  editionId: config.editionId,
  stage: historicalMasterStage,
  artifactKind: "historical-master",
  trackedSidecar: true,
  proofOnly: false,
  productionEligible: true,
  inputKind: "official-full-resolution-production-sources",
  configPath: configPathRelative,
  configSha256: configHash,
  sourceConfigPath: sourceConfigPathRelative,
  sourceConfigSha256: sourceConfigHash,
  provenanceHashes: {
    geometryConfigSha256: configHash,
    productionSourceConfigSha256: sourceConfigHash,
    productionSourceSetSha256: sourceSetHash,
    sourceInputs: inputManifestRecords.map(({ id, sha256: hash }) => ({
      id,
      sha256: hash,
    })),
  },
  output: {
    path: path.relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
    width,
    height,
    format: outputMetadata.format,
    bytes: outputBytes.length,
    sha256: outputHash,
    lossless: true,
    colorSpace: outputMetadata.space,
    depth: outputMetadata.depth,
    bitsPerChannel: 8,
    channels: outputMetadata.channels,
    hasAlpha: outputMetadata.hasAlpha === true,
    hasIccProfile: outputHasIccProfile,
  },
  inputs: inputManifestRecords,
  coverage: {
    method: "output-pixel assignment bitmap",
    mappedPixelCount,
    totalPixelCount: width * height,
    unmappedPixelCount: width * height - mappedPixelCount,
    mappedPixelCoveragePercent,
    verifiedGeographicCoveragePercent: null,
  },
  geometry: {
    joinLatitudeDeg: surface.joinLatitudeDeg,
    geometryScaledFromReferenceInputs: true,
    goreOrderDirection: surface.goreOrderDirection ?? null,
    longitudeConvention:
      config.longitudeConvention ?? surface.longitudeConvention,
    orientationStatus: {
      longitudeConvention:
        (config.longitudeConvention ?? surface.longitudeConvention)?.status ??
        null,
      caps: surface.caps.map(({ hemisphere, orientationStatus }) => ({
        hemisphere,
        orientationStatus,
      })),
    },
    zodiacCalendarBandsUsed: false,
    seamTreatment: "none",
    destructiveBlendingUsed: false,
  },
  qa: {
    goreBoundaryRgbAbsoluteDifference: summarizeDifferences(seamDifferences),
    capJoinRgbAbsoluteDifference: summarizeDifferences(capJoinDifferences),
    mappedPixelCoveragePercent,
    seamPaperRuns,
    verifiedGeographicCoveragePercent: null,
    canonicalAlignmentMetrics: null,
  },
  gates: {
    fullResolutionProductionSources: "verified",
    seamPaperRuns: "pass",
    historicalMaster: "generated",
    interactiveAdaptedMaster: "not_started",
    productionReady: false,
  },
  runtime: {
    sharp: sharp.versions.sharp,
    vips: sharp.versions.vips,
  },
};

const manifest = isHistoricalMaster
  ? historicalMasterManifest
  : proofManifest;
await writeFile(sidecarPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(
  isHistoricalMaster
    ? `Built ${width}x${height} Historical Master at ${path.relative(
        repositoryRoot,
        outputPath
      )}.`
    : `Built ${inputKind === "production" ? "full-source " : ""}proof-only ${width}x${height} historical projection proof at ${path.relative(
        repositoryRoot,
        outputPath
      )}.`
);
