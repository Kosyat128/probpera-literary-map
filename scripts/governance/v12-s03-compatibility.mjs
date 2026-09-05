import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Test-only reverse projection. This preserves historical governance hashes;
// it neither changes production source nor certifies editorial/release approval.
const fixtureSource = readFileSync(new URL("./v12-s03-compatibility.json", import.meta.url), "utf8")
  .replace(/\r\n/gu, "\n");
if (createHash("sha256").update(fixtureSource).digest("hex") !==
    "0ede6b799487764168990a475f1814b20de085a3b13054a27a1b12a17ea9ba1b") {
  throw new Error("Changed V12 S03 compatibility specification");
}
const fixture = JSON.parse(fixtureSource);
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
  let result = source;
  for (const delta of v12S03Compatibility.projections) {
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
  const result = structuredClone(value);
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
