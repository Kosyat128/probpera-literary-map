import { readFile, writeFile } from "node:fs/promises";

const oldPolicy =
  "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors https://admin.probpera.ru; form-action 'self'; script-src 'self' https://mc.yandex.ru https://yastatic.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://mc.yandex.ru https://mc.yandex.az https://mc.yandex.by https://mc.yandex.co.il https://mc.yandex.com https://mc.yandex.com.am https://mc.yandex.com.ge https://mc.yandex.com.tr https://mc.yandex.ee https://mc.yandex.fr https://mc.yandex.kg https://mc.yandex.kz https://mc.yandex.lt https://mc.yandex.lv https://mc.yandex.md https://mc.yandex.tj https://mc.yandex.tm https://mc.yandex.uz; media-src 'self' blob: https:; worker-src 'self' blob:; upgrade-insecure-requests";
const newPolicy =
  "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors https://admin.probpera.ru; form-action 'self'; script-src 'self' https://challenges.cloudflare.com https://mc.yandex.ru https://yastatic.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com https://*.supabase.co wss://*.supabase.co https://mc.yandex.ru https://mc.yandex.az https://mc.yandex.by https://mc.yandex.co.il https://mc.yandex.com https://mc.yandex.com.am https://mc.yandex.com.ge https://mc.yandex.com.tr https://mc.yandex.ee https://mc.yandex.fr https://mc.yandex.kg https://mc.yandex.kz https://mc.yandex.lt https://mc.yandex.lv https://mc.yandex.md https://mc.yandex.tj https://mc.yandex.tm https://mc.yandex.uz; frame-src https://challenges.cloudflare.com; media-src 'self' blob: https:; worker-src 'self' blob:; upgrade-insecure-requests";

async function replaceOnce(path, oldValue, newValue) {
  const source = await readFile(path, "utf8");
  if (source.includes(newValue)) return false;
  const first = source.indexOf(oldValue);
  const last = source.lastIndexOf(oldValue);
  if (first < 0 || first !== last) {
    throw new Error(`${path} does not contain exactly one expected source block.`);
  }
  await writeFile(
    path,
    `${source.slice(0, first)}${newValue}${source.slice(first + oldValue.length)}`,
    "utf8"
  );
  return true;
}

const policyFiles = [
  "scripts/cloudflare/configure-edge-security.mjs",
  "scripts/build-article-pages.mjs",
];
for (const path of policyFiles) {
  await replaceOnce(path, oldPolicy, newPolicy);
}

await replaceOnce(
  ".github/workflows/deploy-pages.yml",
  '          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}\n          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}\n          VITE_BOOSTY_URL:',
  '          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}\n          VITE_TURNSTILE_SITE_KEY: ${{ vars.VITE_TURNSTILE_SITE_KEY }}\n          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}\n          VITE_BOOSTY_URL:'
);
