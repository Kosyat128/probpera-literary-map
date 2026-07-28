import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "public", "cms");
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const publicKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

if (!supabaseUrl || !publicKey) {
  console.log("CMS export skipped: public Supabase variables are not configured. Existing article archive is preserved.");
  process.exit(0);
}

const response = await fetch(
  `${supabaseUrl}/rest/v1/articles?select=id,title,subtitle,excerpt,content_html,cover_external_url,cover_alt,slug,legacy_path,published_at,seo_title,seo_description,canonical_url,categories(name,slug)&status=eq.published&deleted_at=is.null&order=published_at.desc`,
  {
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${publicKey}`,
    },
  }
);
if (!response.ok) throw new Error(`CMS export failed: ${response.status} ${await response.text()}`);
const articles = await response.json();
await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(
  path.join(outputDirectory, "published-articles.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "Supabase CMS",
    articles,
  }, null, 2),
  "utf8"
);
console.log(`Exported ${articles.length} published CMS articles.`);
