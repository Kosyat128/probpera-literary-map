import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function bookDossierStaticIssues(value, location = "root") {
  const issues = [];
  const visit = (entry, current) => {
    if (!entry || typeof entry !== "object") return;
    if (Array.isArray(entry)) { entry.forEach((item, index) => visit(item, `${current}.${index}`)); return; }
    if (entry.schemaVersion === 2 && typeof entry.bookKey === "string" && (Array.isArray(entry.blocks) || Array.isArray(entry.pages) || Array.isArray(entry.rights))) {
      issues.push(`${current}: dossier payload belongs in live no-store delivery`); return;
    }
    if (entry.draft?.schemaVersion === 2 && typeof entry.draft.bookKey === "string" || entry.schemaVersion === 2 && Array.isArray(entry.variants)) {
      issues.push(`${current}: private dossier record or variant bank`); return;
    }
    for (const [key, item] of Object.entries(entry)) {
      if (["book_dossiers", "bookDossierRecords", "bookDossierDrafts", "bookDossierVariantBank"].includes(key)) issues.push(`${current}.${key}: private dossier collection`);
      else visit(item, `${current}.${key}`);
    }
  };
  visit(value, location);
  return issues;
}

export async function auditBookDossierStaticDelivery(root) {
  const issues = [];
  let checked = 0;
  const walk = async folder => {
    let entries;
    try { entries = await readdir(folder, { withFileTypes: true }); } catch (error) { if (error.code === "ENOENT") return; throw error; }
    for (const entry of entries) {
      const absolute = path.join(folder, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && /\.json$/u.test(entry.name)) {
        const relative = path.relative(root, absolute);
        const source = await readFile(absolute, "utf8");
        checked += 1;
        try { issues.push(...bookDossierStaticIssues(JSON.parse(source), relative)); }
        catch { issues.push(`${relative}: invalid static JSON`); }
      }
    }
  };
  await walk(path.join(root, "public"));
  await walk(path.join(root, "dist"));
  return { checked, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await auditBookDossierStaticDelivery(process.cwd());
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.issues.length) process.exitCode = 1;
}
