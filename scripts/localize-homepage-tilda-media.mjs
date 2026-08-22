import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const appPath = path.join(rootDir, "src", "App.tsx");
const baselinePath = path.join(
  rootDir,
  "config",
  "tilda-dependency-baseline.json"
);
const outputDirectory = path.join(
  rootDir,
  "public",
  "brand",
  "legacy-sections"
);
const provenancePath = path.join(
  rootDir,
  "config",
  "homepage-tilda-media-provenance.json"
);

export const homepageTildaAssets = [
  {
    sourceUrl:
      "https://static.tildacdn.com/tild3736-6164-4331-b035-613333656334/33c24c3b-9444-4c08-8.png",
    publicPath: "brand/legacy-sections/homepage-book-opinions.webp",
    expectedOccurrences: 2,
    label: "Мнение о книге",
  },
  {
    sourceUrl:
      "https://static.tildacdn.com/tild3564-6330-4630-b434-383662326664/213421.jpg",
    publicPath: "brand/legacy-sections/homepage-japan-writers.webp",
    expectedOccurrences: 1,
    label: "Писатели Японии",
  },
  {
    sourceUrl:
      "https://static.tildacdn.com/tild3234-6463-4164-b834-393336393839/76122cbe-d6a0-45d5-a.png",
    publicPath: "brand/legacy-sections/homepage-rare-words.webp",
    expectedOccurrences: 2,
    label: "Редкие слова",
  },
  {
    sourceUrl:
      "https://static.tildacdn.com/tild6361-3732-4033-b231-316331353336/a15183d3-d8f6-48ad-b.png",
    publicPath: "brand/legacy-sections/homepage-writer-professions.webp",
    expectedOccurrences: 2,
    label: "Профессии писателей",
  },
  {
    sourceUrl:
      "https://static.tildacdn.com/tild3839-3364-4139-a434-386438386638/image.png",
    publicPath: "brand/legacy-sections/homepage-screen-adaptations.webp",
    expectedOccurrences: 1,
    label: "Книга и экранизация",
  },
  {
    sourceUrl:
      "https://static.tildacdn.com/tild3037-3130-4065-b839-653563653430/c471b0ab-eb22-48d7-8.png",
    publicPath: "brand/legacy-sections/homepage-book-guides.webp",
    expectedOccurrences: 1,
    label: "Книжные гиды",
  },
  {
    sourceUrl:
      "https://static.tildacdn.com/tild6634-3234-4332-b438-663736316139/anastacia-dvi-HRPaX-.jpg",
    publicPath: "brand/legacy-sections/homepage-literary-awards.webp",
    expectedOccurrences: 1,
    label: "Литературные премии",
  },
  {
    sourceUrl:
      "https://static.tildacdn.com/tild3162-6534-4936-b966-633930633738/photo.jpg",
    publicPath: "brand/legacy-sections/homepage-literary-essays.webp",
    expectedOccurrences: 1,
    label: "Литературные эссе",
  },
  {
    sourceUrl:
      "https://static.tildacdn.com/tild6262-3936-4061-b465-623133623265/image.png",
    publicPath: "brand/legacy-sections/homepage-folklore.webp",
    expectedOccurrences: 1,
    label: "Фольклор и мифология",
  },
  {
    sourceUrl:
      "https://static.tildacdn.com/tild6333-6433-4634-b862-666436373139/photo.png",
    publicPath: "brand/legacy-sections/homepage-author-stories.webp",
    expectedOccurrences: 1,
    label: "Авторские истории",
  },
  {
    sourceUrl:
      "https://static.tildacdn.com/tild6138-3239-4335-b166-643935623330/123231.png",
    publicPath: "brand/legacy-sections/homepage-literary-atlas.webp",
    expectedOccurrences: 1,
    label: "Литературная планета",
  },
  {
    sourceUrl:
      "https://static.tildacdn.com/tild6239-6339-4864-b864-333636623730/Dj.webp",
    publicPath: "brand/legacy-sections/homepage-library.webp",
    expectedOccurrences: 1,
    label: "Книжный архив",
  },
];

const assets = homepageTildaAssets;

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function countOccurrences(source, value) {
  return source.split(value).length - 1;
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

async function fetchImage(sourceUrl) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
          "User-Agent": "ProbPeraMediaMigration/1.0 (+https://probpera.ru)",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const contentType = (response.headers.get("content-type") || "")
        .split(";", 1)[0]
        .trim()
        .toLocaleLowerCase("en");
      if (!contentType.startsWith("image/")) {
        throw new Error(`unexpected content type ${contentType || "missing"}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 1024 || buffer.length > 20 * 1024 * 1024) {
        throw new Error(`unexpected payload size ${buffer.length}`);
      }
      return { buffer, contentType };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Could not fetch ${sourceUrl}: ${detail}`);
}

async function convertToWebp(buffer) {
  const metadata = await sharp(buffer, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 120 || metadata.height < 120) {
    throw new Error(
      `Image dimensions are invalid: ${metadata.width || 0}x${metadata.height || 0}`
    );
  }
  if (!new Set(["jpeg", "png", "webp"]).has(metadata.format || "")) {
    throw new Error(`Unsupported source format: ${metadata.format || "unknown"}`);
  }
  if (metadata.pages && metadata.pages > 1) {
    throw new Error("Animated or multi-page images are not accepted");
  }
  if (metadata.width * metadata.height > 80_000_000) {
    throw new Error(`Image pixel count is too large: ${metadata.width}x${metadata.height}`);
  }

  const plans = [
    {
      maxDimension: 1920,
      quality: 94,
      nearLossless: metadata.format === "png",
    },
    { maxDimension: 1600, quality: 90, nearLossless: false },
    { maxDimension: 1400, quality: 86, nearLossless: false },
  ];
  let output = null;
  let encoding = null;

  for (const plan of plans) {
    const candidate = await sharp(buffer, { failOn: "error" })
      .rotate()
      .resize({
        width: plan.maxDimension,
        height: plan.maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: plan.quality,
        alphaQuality: 100,
        effort: 6,
        smartSubsample: true,
        nearLossless: plan.nearLossless,
      })
      .toBuffer();
    output = candidate;
    encoding = plan;
    if (candidate.length <= 900 * 1024) break;
  }

  if (!output || !encoding || output.length > 1_500 * 1024) {
    throw new Error(
      `Converted asset exceeds the safe size limit: ${output?.length || 0} bytes`
    );
  }
  const outputMetadata = await sharp(output, { failOn: "error" }).metadata();
  if (!outputMetadata.width || !outputMetadata.height || outputMetadata.format !== "webp") {
    throw new Error("Converted asset is not a readable WebP image");
  }
  return { metadata, output, outputMetadata, encoding };
}

export async function localizeHomepageTildaMedia({ apply = false } = {}) {
  const [appSource, baselineSource] = await Promise.all([
    fs.readFile(appPath, "utf8"),
    fs.readFile(baselinePath, "utf8"),
  ]);
  const baseline = JSON.parse(baselineSource);
  const appBaseline = baseline.handwrittenFiles?.["src/App.tsx"];
  if (!appBaseline) {
    throw new Error("The Tilda dependency baseline for src/App.tsx is missing");
  }

  const sourceUrls = assets.map((asset) => asset.sourceUrl);
  const expectedTotal = assets.reduce(
    (total, asset) => total + asset.expectedOccurrences,
    0
  );
  if (appBaseline.expectedOccurrences !== expectedTotal) {
    throw new Error(
      `Baseline expected ${appBaseline.expectedOccurrences}, migration expects ${expectedTotal}`
    );
  }
  if (
    JSON.stringify(sorted(appBaseline.allowedUrls || [])) !==
    JSON.stringify(sorted(sourceUrls))
  ) {
    throw new Error("The reviewed Tilda URL baseline does not match the migration map");
  }

  let nextAppSource = appSource;
  const provenanceAssets = [];
  if (apply) await fs.mkdir(outputDirectory, { recursive: true });

  for (const asset of assets) {
    const occurrences = countOccurrences(nextAppSource, asset.sourceUrl);
    if (occurrences !== asset.expectedOccurrences) {
      throw new Error(
        `${asset.sourceUrl}: expected ${asset.expectedOccurrences} occurrence(s), found ${occurrences}`
      );
    }

    const { buffer, contentType } = await fetchImage(asset.sourceUrl);
    const { metadata, output, outputMetadata, encoding } =
      await convertToWebp(buffer);
    const absoluteOutputPath = path.join(rootDir, "public", asset.publicPath);

    if (apply) {
      await fs.mkdir(path.dirname(absoluteOutputPath), { recursive: true });
      await fs.writeFile(absoluteOutputPath, output);
    }
    nextAppSource = nextAppSource.replaceAll(asset.sourceUrl, asset.publicPath);
    provenanceAssets.push({
      label: asset.label,
      sourceUrl: asset.sourceUrl,
      localPath: `public/${asset.publicPath}`,
      replacedOccurrences: asset.expectedOccurrences,
      sourceContentType: contentType,
      sourceFormat: metadata.format || null,
      sourceWidth: metadata.width,
      sourceHeight: metadata.height,
      sourceBytes: buffer.length,
      sourceSha256: sha256(buffer),
      outputFormat: outputMetadata.format,
      outputWidth: outputMetadata.width,
      outputHeight: outputMetadata.height,
      outputBytes: output.length,
      outputSha256: sha256(output),
      encoding,
    });
  }

  if (nextAppSource.includes("static.tildacdn.com")) {
    throw new Error("src/App.tsx still contains a Tilda CDN dependency");
  }
  const finalLocalOccurrences = assets.reduce(
    (total, asset) => total + countOccurrences(nextAppSource, asset.publicPath),
    0
  );
  if (finalLocalOccurrences !== expectedTotal) {
    throw new Error(
      `Expected ${expectedTotal} localized references, found ${finalLocalOccurrences}`
    );
  }

  baseline.handwrittenFiles["src/App.tsx"] = {
    expectedOccurrences: 0,
    allowedUrls: [],
  };
  const provenance = {
    version: 1,
    generatedAt: new Date().toISOString(),
    purpose: "Local copies for the handwritten homepage editorial and section cards",
    sourceHost: "static.tildacdn.com",
    rightsNote:
      "These files were copied from the existing ProbPera Tilda CDN references. Editorial rights metadata must be reviewed separately before external reuse.",
    assets: provenanceAssets,
  };

  if (apply) {
    await Promise.all([
      fs.writeFile(appPath, nextAppSource),
      fs.writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`),
      fs.writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`),
    ]);
  }

  return {
    status: apply ? "localized" : "verified",
    assets: provenanceAssets.length,
    replacedOccurrences: expectedTotal,
    sourceBytes: provenanceAssets.reduce((total, asset) => total + asset.sourceBytes, 0),
    outputBytes: provenanceAssets.reduce((total, asset) => total + asset.outputBytes, 0),
    outputDirectory: path.relative(rootDir, outputDirectory),
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const unknownArguments = process.argv.slice(2).filter((argument) => argument !== "--apply");
  if (unknownArguments.length) {
    throw new Error(`Unknown argument: ${unknownArguments[0]}`);
  }
  const summary = await localizeHomepageTildaMedia({ apply });
  console.log(JSON.stringify(summary, null, 2));
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (entryPoint === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
