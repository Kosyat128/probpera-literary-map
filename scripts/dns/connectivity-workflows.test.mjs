import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function workflow(name) {
  return (await fs.readFile(path.join(projectRoot, ".github", "workflows", name), "utf8"))
    .replace(/\r\n/gu, "\n");
}

test("production mutation workflow cannot skip compensation after evidence upload failure", async () => {
  const source = await workflow("manage-ru-connectivity.yml");
  assert.match(source, /id: post_apply_ru_artifact\n\s+if: \$\{\{ always\(\)/u);
  assert.match(source, /id: post_apply_ru_artifact[\s\S]*?continue-on-error: true/u);
  assert.match(source, /id: post_apply_ru_confirmation\n\s+if: \$\{\{ always\(\)/u);
  const references = source.match(/steps\.post_apply_ru_artifact\.outcome/gu) || [];
  assert.equal(references.length, 2);
});

test("production mutation workflow uses tested DS and reviewed-plan gates", async () => {
  const source = await workflow("manage-ru-connectivity.yml");
  assert.match(source, /pull-requests: read/u);
  assert.match(source, /if: \$\{\{ always\(\) && github\.ref == 'refs\/heads\/main' \}\}/u);
  assert.match(source, /verify-parent-ds-absence\.mjs --zone=probpera\.ru/u);
  assert.doesNotMatch(source, /resolveDs/u);
  assert.match(source, /--delivery-plan=config\/dns\/ru-connectivity-plan\.json/u);
  assert.match(source, /github\.paginate\(github\.rest\.pulls\.listFiles/u);
  assert.match(source, /github\.paginate\(github\.rest\.pulls\.listReviews/u);
  assert.doesNotMatch(source, /uses: actions\/[a-z0-9-]+@v[0-9]+/iu);
});

test("Cloudflare secret workflow pins third-party actions to immutable commits", async () => {
  const source = await workflow("configure-cloudflare-edge-security.yml");
  assert.doesNotMatch(source, /uses: actions\/[a-z0-9-]+@v[0-9]+/iu);
  assert.match(source, /actions\/checkout@[0-9a-f]{40}/u);
  assert.match(source, /actions\/setup-node@[0-9a-f]{40}/u);
});

test("trusted deploy and schedule audits derive the RU route from reviewed state", async () => {
  const source = await workflow("audit-ru-connectivity.yml");
  assert.match(source, /"cloudflare-full": "cloudflare"/u);
  assert.match(source, /"geodns-ru-direct": "direct"/u);
  assert.match(source, /github\.event\.workflow_run\.head_sha/u);
  assert.match(source, /steps\.routing_state\.outputs\.expected_route/u);
});
