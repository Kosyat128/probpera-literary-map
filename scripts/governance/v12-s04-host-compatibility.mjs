import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./v12-s04-host-compatibility.json", import.meta.url), "utf8").replace(/\r\n/gu, "\n");
if (createHash("sha256").update(source).digest("hex") !== "9911ef918c31595d2b954c74b6d0d703a5885b0b60193252998675a959134027") {
  throw new Error("Changed V12 S04 host compatibility specification");
}
export const v12S04HostCompatibility = JSON.parse(source);

/** Test-only exact reversal; unrelated content and scene bytes remain visible. */
export function projectV12S04HostSource(relativePath, text) {
  let result = text;
  for (const delta of v12S04HostCompatibility.projections) {
    if (delta.path !== relativePath) continue;
    if (result.split(delta.after).length !== 2) throw new Error("Missing or duplicate V12 S04 compatibility delta: " + delta.id);
    result = result.replace(delta.after, delta.before);
  }
  return result;
}

export function projectV12S04HostPackage(value) {
  const result = structuredClone(value);
  for (const delta of v12S04HostCompatibility.packageProjections) {
    const [group, name] = delta.path;
    if (result[group]?.[name] !== delta.value) throw new Error("Missing or changed V12 S04 package property: " + name);
    delete result[group][name];
  }
  return result;
}
