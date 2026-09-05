import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { projectV12S04HostSource, projectV12S04HostPackage } from "./v12-s04-host-compatibility.mjs";

// Test-only reverse projection. This preserves historical governance hashes;
// it neither changes production source nor certifies editorial/release approval.
const fixtureSource = readFileSync(new URL("./v12-s03-compatibility.json", import.meta.url), "utf8")
  .replace(/\r\n/gu, "\n");
if (createHash("sha256").update(fixtureSource).digest("hex") !==
    "0ede6b799487764168990a475f1814b20de085a3b13054a27a1b12a17ea9ba1b") {
  throw new Error("Changed V12 S03 compatibility specification");
}
const fixture = JSON.parse(fixtureSource);
const integrationSource = readFileSync(new URL("./v12-s03-canonical-integration.json", import.meta.url), "utf8")
  .replace(/\r\n/gu, "\n");
if (createHash("sha256").update(integrationSource).digest("hex") !==
    "1c021b9c744d75694d7b28cf45bf42a4bd3c341850adf8469d96b54ca3ea7923") {
  throw new Error("Changed V12 S03 canonical integration specification");
}
const integration = JSON.parse(integrationSource);
export const v12S03CanonicalIntegration = Object.freeze({
  ...integration,
  projections: Object.freeze(integration.projections.map(delta => Object.freeze(delta))),
});
export const v12S03Compatibility = Object.freeze({
  ...fixture,
  projections: Object.freeze(fixture.projections.map(delta => Object.freeze(delta))),
  packageProjections: Object.freeze(fixture.packageProjections.map(delta => Object.freeze({
    ...delta, path: Object.freeze(delta.path),
    before: Object.freeze(delta.before), after: Object.freeze(delta.after),
  }))),
});

/** Match only pinned, complete deltas; every other source byte survives. */
export function projectV12S03Source(relativePath, source) {
  let result = projectV12S04HostSource(relativePath, source);
  // Undo the latest technical integration first, then the original S03 delta.
  // Upstream bookshelf refinements are still checked separately by their lock.
  for (const delta of [...v12S03CanonicalIntegration.projections, ...v12S03Compatibility.projections]) {
    if (delta.path !== relativePath) continue;
    if (result.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate V12 S03 compatibility delta: ${delta.id}`);
    }
    result = result.replace(delta.after, delta.before);
  }
  return result;
}

/** Remove exactly two additive development/build properties, never other drift. */
export function projectV12S03Package(value) {
  const result = projectV12S04HostPackage(value);
  for (const delta of v12S03Compatibility.packageProjections) {
    const [group, key] = delta.path;
    const target = result[group];
    if (!target || !Object.hasOwn(target, key) || target[key] !== delta.after.value) {
      throw new Error(`Missing or changed V12 S03 package property: ${group}.${key}`);
    }
    delete target[key];
  }
  return result;
}
