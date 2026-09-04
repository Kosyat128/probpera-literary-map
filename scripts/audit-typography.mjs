import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postcss from "postcss";

const canonicalPath = "src/styles/site-typography.css";
const familyAlias = /var\(--(?:sans|serif|font-ui|font-editorial|font-display)\)/u;
const localFamily = /^"Source (?:Sans 3|Serif 4) Local"$/u;
const normalizeSelector = (value) => value.trim().replace(/\s+/gu, " ").replace(/\s*([>+~])\s*/gu, "$1");
const requiredRoles = [".article-copy h3", ".library-card-copy h3", ".share-links>span", ".article-reader-content", ".cms-page-prose"];
// Explicit 2026-09-04 user exception: preserve the existing Header/Hero. These
// roots do not include reader, atlas, footer-brand or arbitrary nested controls.
const preservedRoot = /^\.(?:topline|site-header|mobile-nav|magazine-hero|brand|sections-menu|articles-menu|reader-button|global-search-trigger|hero-editorial|hero-actions|hero-proof|hero-cover|primary-action|secondary-action)(?![\w-])/u;
const preservedAliases = {
  "--sans": '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  "--serif": 'Georgia, "Times New Roman", serif',
  "--font-ui": "var(--sans)",
  "--font-editorial": "var(--serif)",
};

function ownsRole(selector, owned) {
  const normalized = normalizeSelector(selector);
  return [...owned].some((role) => normalized === role || normalized.endsWith(` ${role}`));
}

function fullText(selector) {
  const value = normalizeSelector(selector);
  if ([".sections-mega-groups small", ".sections-mega-groups strong", ".articles-mega-lead p", ".articles-mega-lead strong", ".articles-mega-content>section strong"].includes(value)) return true;
  if ([".sections-directory h3", ".sections-directory>div:last-child p", ".section-card-action strong"].includes(value)) return true;
  return /\.(?:article-copy|library-card-copy)(?: |>)?(?:h3|p)$/u.test(value) ||
    /\.(?:article-reader-content|cms-page-prose)(?:(?: |>)?(?:p|li|h[1-6]|blockquote))?$/u.test(value) ||
    /\.(?:article-card-footer|share-links|share-links--card)(?:>span)?$/u.test(value);
}

function minimumPixels(value, tokens, visited = new Set()) {
  if (value.startsWith("clamp(") && value.endsWith(")")) {
    return minimumPixels(postcss.list.comma(value.slice(6, -1))[0], tokens, visited);
  }
  const sizes = [...value.matchAll(/(-?\d*\.?\d+)(px|rem)\b/gu)]
    .map((match) => Number(match[1]) * (match[2] === "rem" ? 16 : 1));
  for (const [, token] of value.matchAll(/var\((--[a-z0-9-]+)/gu)) {
    if (visited.has(token)) continue;
    for (const candidate of tokens.get(token) || []) {
      const nested = minimumPixels(candidate, tokens, new Set([...visited, token]));
      if (nested !== null) sizes.push(nested);
    }
  }
  return sizes.length ? Math.min(...sizes) : null;
}

function minimumLeading(value, tokens, visited = new Set()) {
  const numeric = value.trim().match(/^(-?\d*\.?\d+)(%|em)?$/u);
  if (numeric) return Number(numeric[1]) / (numeric[2] === "%" ? 100 : 1);
  const variable = value.match(/^var\((--[a-z0-9-]+)\)$/u)?.[1];
  if (!variable || visited.has(variable)) return null;
  const values = (tokens.get(variable) || []).map((candidate) =>
    minimumLeading(candidate, tokens, new Set([...visited, variable]))
  ).filter((candidate) => candidate !== null);
  return values.length ? Math.min(...values) : null;
}

function atRuleCondition(node) {
  const conditions = [];
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule") {
      conditions.unshift(`@${parent.name} ${parent.params.trim().replace(/\s+/gu, " ")}`);
    }
  }
  return conditions.join(" / ");
}

/** Parse CSS rather than scanning lines, so media queries and font shorthand count. */
export function auditTypography(sources) {
  const issues = [];
  const parsed = new Map();
  const add = (file, node, message) => issues.push({ file, line: node?.source?.start?.line || 1, message });
  for (const [file, css] of Object.entries(sources)) {
    try { parsed.set(file, postcss.parse(css, { from: file })); }
    catch (error) { add(file, null, `Invalid CSS: ${error.reason || error.message}`); }
  }
  const canonical = parsed.get(canonicalPath);
  if (!canonical) add(canonicalPath, null, "Canonical typography stylesheet is missing or invalid");
  const owned = new Set();
  const tokens = new Map();
  const canonicalDeclarations = new Map();
  const subgridCarriers = new Set();
  for (const root of parsed.values()) {
    root.walkDecls((declaration) => {
      if (["grid-template-rows", "grid-template-columns"].includes(declaration.prop) &&
        /\bsubgrid\b/u.test(declaration.value) && declaration.parent.type === "rule") {
        postcss.list.comma(declaration.parent.selector)
          .forEach((selector) => subgridCarriers.add(normalizeSelector(selector)));
      }
    });
  }
  canonical?.walkDecls((declaration) => {
    if (declaration.prop.startsWith("--")) {
      tokens.set(declaration.prop, [...(tokens.get(declaration.prop) || []), declaration.value]);
    }
    if (declaration.prop === "font-size" && declaration.parent.type === "rule") {
      postcss.list.comma(declaration.parent.selector).forEach((selector) => owned.add(normalizeSelector(selector)));
    }
  });
  for (const role of requiredRoles) {
    if (!owned.has(role)) add(canonicalPath, null, `Canonical size owner missing: ${role}`);
  }

  for (const [file, root] of parsed) {
    root.walkDecls((declaration) => {
      const { prop, value } = declaration;
      const parent = declaration.parent;
      const isFace = parent.type === "atrule" && parent.name === "font-face";
      const selectors = parent.type === "rule" ? postcss.list.comma(parent.selector) : [];
      const ownsSize = selectors.some((selector) => ownsRole(selector, owned));
      const isFullText = selectors.some(fullText);
      const preserved = ["src/index.css", "src/styles/header-preserved.css"].includes(file) &&
        selectors.length > 0 && selectors.every((selector) => preservedRoot.test(normalizeSelector(selector)));
      const preservedIsland = preserved && file === "src/styles/header-preserved.css";
      const fail = (message) => add(file, declaration, `${message}: ${prop}: ${value}${parent.selector ? ` (${parent.selector.replace(/\s+/gu, " ")})` : ""}`);

      const establishesContainment =
        (prop === "container-type" && /\b(?:inline-size|size)\b/u.test(value)) ||
        (prop === "container" && /\/\s*(?:inline-size|size)\b/u.test(value)) ||
        (prop === "contain" && /\b(?:layout|size|strict|content)\b/u.test(value));
      if (establishesContainment && selectors.some((selector) =>
        ownsRole(selector, subgridCarriers) ||
        [...subgridCarriers].some((carrier) => ownsRole(carrier, new Set([normalizeSelector(selector)])))
      )) fail("Subgrid carrier must not establish size/layout containment");

      if (file === canonicalPath && !prop.startsWith("--")) {
        for (const selector of selectors) {
          const key = `${atRuleCondition(declaration)} | ${normalizeSelector(selector)} | ${prop}`;
          const previous = canonicalDeclarations.get(key);
          if (previous) fail(`Duplicate canonical property in the same condition (first at line ${previous})`);
          else canonicalDeclarations.set(key, declaration.source?.start?.line || 1);
        }
      }

      const nonDisplayRole = selectors.some((selector) =>
        (ownsRole(selector, owned) || fullText(selector)) &&
        !normalizeSelector(selector).includes(".hero-editorial h1")
      );
      if (nonDisplayRole && (prop === "line-height" || prop === "font")) {
        const leading = prop === "line-height" ? value : value.match(/\/\s*(\d*\.?\d+(?:%|em)?)(?=\s|$)/u)?.[1];
        const minimum = leading ? minimumLeading(leading, tokens) : null;
        if (minimum !== null && minimum < 1) fail("Non-display editorial line-height is smaller than 1");
      }

      if (["--sans", "--serif", "--font-ui", "--font-editorial", "--font-display"].includes(prop)) {
        const preservedAlias = preservedIsland && preservedAliases[prop] === value;
        if (file !== canonicalPath && !preservedAlias) fail("Font aliases have a second owner outside site-typography.css");
        if (!preservedAlias && !familyAlias.test(value) && !/^"Source (?:Sans 3|Serif 4) Local",/u.test(value)) {
          fail("Font alias must start with a bundled local family");
        }
      }

      if (prop === "font-family" && !/^(?:inherit|initial|unset)$/u.test(value)) {
        const valid = isFace ? localFamily.test(value) :
          new RegExp(`^${familyAlias.source}$`, "u").test(value) ||
          value === '"Segoe UI Emoji", "Apple Color Emoji", sans-serif' ||
          value === 'ui-monospace, "Cascadia Code", "SFMono-Regular", monospace';
        if (!valid) fail("Use an approved font alias or local face");
      }
      if (prop === "font" && !/^(?:inherit|initial|unset)$/u.test(value)) {
        if (!familyAlias.test(value)) fail("Font shorthand bypasses approved family aliases");
        const weight = value.match(/(?:^|\s)([1-9]\d{2})(?=\s)/u)?.[1];
        if (weight && !["400", "600", "700"].includes(weight)) fail("Font weight has no bundled local face");
      }
      if (prop === "font-weight" &&
        !/^(?:400|600|700|normal|bold|inherit|initial|unset)$/u.test(value) &&
        !(preserved && /^(?:500|800|900)$/u.test(value)) &&
        !/^var\(--cms-(?:body|title)-weight(?:,\s*inherit)?\)$/u.test(value)) {
        fail("Font weight has no bundled local face");
      }
      if ((prop === "overflow-wrap" && value === "anywhere") || (prop === "word-break" && value === "break-all")) {
        if (!(file === "src/index.css" && selectors.length === 1 && normalizeSelector(selectors[0]) === ".hero-editorial>p" && prop === "overflow-wrap")) {
          fail("Unsafe public text wrapping");
        }
      }
      if (isFullText && (
        (["height", "block-size", "max-height", "max-block-size"].includes(prop) && !["auto", "none", "initial", "unset"].includes(value)) ||
        (["overflow", "overflow-x", "overflow-y"].includes(prop) && /\b(?:hidden|clip)\b/u.test(value)) ||
        (["line-clamp", "-webkit-line-clamp"].includes(prop) && !["none", "unset"].includes(value)) ||
        (prop === "text-overflow" && value === "ellipsis")
      )) fail("Full editorial text or card footer must remain visible");

      if (file !== canonicalPath && !preservedIsland && ownsSize && ["font-size", "font"].includes(prop) && value !== "inherit") {
        fail("Canonical role size has a second owner outside site-typography.css");
      }
      if (file === canonicalPath && prop === "font-size") {
        if (/\d(?:px|rem|em|vw|cqi|%)/u.test(value)) fail("Canonical role sizes must use tokens");
        const minimum = minimumPixels(value, tokens);
        if (minimum !== null && minimum < 12) fail("Informative canonical type is smaller than 12px");
      }
    });
  }
  return issues;
}

async function cssFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await cssFiles(fullPath));
    else if (entry.name.endsWith(".css")) files.push(fullPath);
  }
  return files;
}

async function main() {
  if (process.argv.length > 2) throw new Error(`Unknown argument: ${process.argv[2]}`);
  const files = await cssFiles(path.resolve("src"));
  const sources = Object.fromEntries(await Promise.all(files.map(async (file) => [
    path.relative(process.cwd(), file).replaceAll("\\", "/"), await fs.readFile(file, "utf8"),
  ])));
  const issues = auditTypography(sources);
  for (const issue of issues) console.error(`${issue.file}:${issue.line}: ${issue.message}`);
  console.log(`Typography audit: ${files.length} public CSS files, ${issues.length} issue(s).`);
  if (issues.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
