import path from "node:path";

function decodedRedirectSegments(pathname) {
  return pathname
    .split("/")
    .filter(Boolean)
    .map((encodedSegment) => {
      let segment;
      try {
        segment = decodeURIComponent(encodedSegment);
      } catch {
        throw new Error(`Redirect source contains invalid URL encoding: ${pathname}`);
      }
      if (
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("/") ||
        segment.includes("\\") ||
        segment.includes("\0")
      ) {
        throw new Error(`Redirect source contains an unsafe path segment: ${pathname}`);
      }
      return segment;
    });
}

export function resolveRedirectArtifactPath({
  distDirectory,
  siteOrigin,
  sourceValue,
}) {
  const root = path.resolve(distDirectory);
  let origin;
  try {
    origin = new URL(siteOrigin);
  } catch {
    throw new Error(`Redirect site origin is not a valid URL: ${siteOrigin}`);
  }
  const pathname = String(sourceValue || "");
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname.includes("?") ||
    pathname.includes("#")
  ) {
    throw new Error(`Redirect source must be a same-origin pathname: ${sourceValue}`);
  }

  const segments = decodedRedirectSegments(pathname);
  const finalSegment = segments.at(-1) || "";
  const artifactSegments = /\.[a-z0-9]{1,8}$/iu.test(finalSegment)
    ? segments
    : [...segments, "index.html"];
  const artifactPath = path.resolve(root, ...artifactSegments);
  const relative = path.relative(root, artifactPath);
  if (
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`Redirect artifact escapes the dist directory: ${sourceValue}`);
  }
  return artifactPath;
}
