import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../../", import.meta.url));
const admin = path.join(root, "apps/admin");
const origin = "http://127.0.0.1:39225";
const id = "66666666-6666-4666-8666-666666666666";
const titleBefore = "Новая рукопись с иллюстрациями";
const titleAfter = "Новое название после отправки";

// Bundle the real editor and TipTap with Next's production React. These
// boundaries supply no database, account, remote HTTP or Next router.
const virtual = new Map([
  ["next/link", 'import React from "react"; export default (props) => React.createElement("a", props);'],
  ["next/navigation", 'export { unstable_rethrow } from "next/dist/client/components/unstable-rethrow.browser";'],
  ["@/app/(dashboard)/articles/actions", "export const saveArticleAction = (data) => window.fixture.submit(data);"],
  ["@/app/(dashboard)/articles/template-actions", "export const saveEditorTemplateAction = async () => {}; export const deleteEditorTemplateAction = async () => {};"],
  ["@/app/(dashboard)/editor-links/actions", "export const searchEditorInternalLinksAction = async () => [];"],
  ["@/app/(dashboard)/editor-autosave/actions", [
    "export const loadLatestEditorAutosaveAction = async () => ({ok: true});",
    "export const saveEditorAutosaveAction = async () => ({ok: false, error: 'Local fixture'});",
    "export const deleteExactEditorAutosaveAction = async () => ({ok: true});",
  ].join("\n")],
]);

const entry = `
  import React from "react";
  import {createRoot} from "react-dom/client";
  import {getRedirectError} from "next/dist/client/components/redirect";
  import ArticleEditor from ${JSON.stringify(path.join(admin, "components/ArticleEditor.tsx"))};

  const fixture = window.fixture = {
    calls: [],
    submit(data) {
      fixture.calls.push(Object.fromEntries(data.entries()));
      return new Promise((resolve, reject) => { fixture.reject = reject; });
    },
    redirect(to) { fixture.reject(getRedirectError(to, "push")); },
  };
  class Boundary extends React.Component {
    state = {};
    static getDerivedStateFromError(error) { return {error}; }
    render() {
      return this.state.error ? <p data-router-signal={this.state.error.digest}/> : this.props.children;
    }
  }
  const doc = (locale, text) => ({type: "doc", content: [
    {type: "heading", attrs: {level: 2}, content: [{type: "text", text: "Section"}]},
    {type: "paragraph", content: [{type: "text", text}]},
    {type: "image", attrs: {src: "https://fixture.invalid/" + locale, alt: "Alt " + locale, caption: "Caption " + locale}},
  ]});
  const html = (locale, text) => '<h2>Section</h2><p>' + text + '</p><img src="https://fixture.invalid/' + locale + '" alt="Alt ' + locale + '" data-caption="Caption ' + locale + '">';
  const query = new URLSearchParams(location.search);
  const existing = query.has("existing");
  const categoryId = "88888888-8888-4888-8888-888888888888";
  const russian = "Авторский текст. " + "Рукопись сохраняет авторское слово и каждую иллюстрацию. ".repeat(45);
  const english = "Human translation.";
  const summary = "Полное описание авторской статьи в каталоге и важный контекст для читателя, который нашёл эту страницу.";
  createRoot(document.getElementById("root")).render(<Boundary><ArticleEditor
    article={{
      id: query.has("other") ? "77777777-7777-4777-8777-777777777777" : existing ? ${JSON.stringify(id)} : undefined,
      updated_at: existing ? "2026-11-20T11:30:00+00:00" : undefined,
      title: "Новая рукопись", slug: "article", status: "draft",
      category_id: categoryId, excerpt: summary, seo_description: summary, sources: ["Редакционный источник"],
      content_html: html("ru", russian), content_json: doc("ru", russian),
      cover_external_url: "https://fixture.invalid/cover", cover_alt: "Ручное описание",
    }}
    englishTranslation={{
      title: "English title", slug: "article-en", status: "draft",
      content_html: html("en", english), content_json: doc("en", english),
    }}
    categories={[{id: categoryId, name: "Рубрика", slug: "category"}]}
    publicSiteUrl="https://fixture.invalid" canPublish saveConfirmed={query.has("saved")}
  /></Boundary>);
`;

let script;
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: entry, resolveDir: root, loader: "jsx" },
    absWorkingDir: root, bundle: true, write: false, platform: "browser", jsx: "automatic",
    tsconfig: path.join(admin, "tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"', "process.env.ADMIN_BASE_PATH": '""' },
    plugins: [{
      name: "isolated-editor",
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, ({ path: request }) => {
          if (virtual.has(request)) return { path: request, namespace: "editor-fixture" };
          if (/^(react|react-dom)(\/|$)/u.test(request)) {
            return { path: require.resolve(`next/dist/compiled/${request}`) };
          }
        });
        builder.onLoad({ filter: /.*/, namespace: "editor-fixture" }, ({ path: request }) => ({
          contents: virtual.get(request), loader: "js", resolveDir: root,
        }));
        builder.onLoad({ filter: /\.css$/ }, () => ({ contents: "export default {}" }));
      },
    }],
  });
  script = result.outputFiles[0].text;
});

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname === "/editor") {
      return route.fulfill({ contentType: "text/html",
        body: '<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script>' });
    }
    if (url.origin === origin && url.pathname === "/bundle.js") {
      return route.fulfill({ contentType: "text/javascript", body: script });
    }
    if (url.hostname === "fixture.invalid") {
      return route.fulfill({ contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' });
    }
    return route.abort("blockedbyclient");
  });
});

test("one release stays pending and a lost response retains the article for a checked retry", async ({ page }) => {
  await page.goto(`${origin}/editor`);
  await expect(page.locator(".tiptap")).toContainText("Авторский текст");
  const title = page.getByRole("textbox", { name: "Заголовок", exact: true });
  await title.fill(titleBefore);
  await page.getByRole("button", { name: /EN ·/u }).click();
  await expect(page.locator(".tiptap")).toContainText("Human translation");
  await page.getByRole("textbox", { name: "Заголовок английской версии", exact: true }).fill("Reviewed English title");
  await page.getByRole("button", { name: /RU ·/u }).click();
  const release = page.getByRole("button", { name: "Опубликовать на русском", exact: true });
  await expect(release).toBeEnabled();
  const save = page.getByRole("button", { name: "Сохранить черновик" });
  await release.evaluate((button) => {
    button.click();
    button.form.requestSubmit(button);
    button.form.requestSubmit(button.form.querySelector('button[value="save"]'));
  });
  await expect(page.getByText("Сохраняем статью и отправляем запрос на обновление сайта…")).toBeVisible();
  await expect(release).toBeDisabled();
  await expect(save).toBeDisabled();
  await title.press("Enter");
  const requests = await page.evaluate(() => window.fixture.calls);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    intent: "publish-ru", publication_override: "0", title: titleBefore,
    english_title: "Reviewed English title", cover_alt: "Ручное описание",
    cover_external_url: "https://fixture.invalid/cover",
  });
  expect(requests[0].content_html).toContain("Caption ru");
  expect(requests[0].english_content_html).toContain("Caption en");

  await title.fill(titleAfter);
  await page.evaluate(() => {
    document.querySelector(".article-form").addEventListener("reset", (event) => {
      queueMicrotask(() => { window.fixture.resetPrevented = event.defaultPrevented; });
    });
    window.fixture.reject(new TypeError("Failed to fetch"));
  });
  const check = page.getByRole("link", { name: "Проверить сохранение в админке" });
  await expect(check).toBeVisible();
  expect(new URL(await check.getAttribute("href"), origin).searchParams.get("q")).toBe(titleBefore);
  await expect(title).toHaveValue(titleAfter);
  await expect(save).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.fixture.resetPrevented)).toBe(true);
  await expect.poll(() => page.evaluate(() => Object.values(localStorage).join(" "))).toContain(titleAfter);

  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(check).toHaveAttribute("href", "/articles");
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "Восстановить локальную копию" }).click();
  await expect(title).toHaveValue(titleAfter);
  await page.getByRole("button", { name: "Результат проверен, разрешить повтор" }).click();
  await save.click();
  await expect.poll(() => page.evaluate(() => window.fixture.calls.length)).toBe(1);
  const [retry] = await page.evaluate(() => window.fixture.calls);
  expect(retry).toMatchObject({
    intent: "save", publication_override: "0", title: titleAfter, english_title: requests[0].english_title,
    content_html: requests[0].content_html, content_json: requests[0].content_json,
    english_content_html: requests[0].english_content_html, english_content_json: requests[0].english_content_json,
  });
});

test("reloading an in-flight save on an old success URL keeps the recovery copy", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${origin}/editor?existing&saved=1`);
  await expect(page.locator(".tiptap")).toContainText("Авторский текст");
  const title = page.getByRole("textbox", { name: "Заголовок", exact: true });
  await title.fill(titleAfter);
  const save = page.getByRole("button", { name: "Сохранить черновик" });
  await save.click();
  await expect(page.getByText("Сохраняем черновик…")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.fixture.calls.length)).toBe(1);
  await page.reload();

  const check = page.getByRole("link", { name: "Проверить сохранение в админке" });
  await expect(check).toHaveAttribute("href", `/articles/edit?id=${id}`);
  await expect(save).toBeDisabled();
  await page.goto(`${origin}/editor?existing&other&saved=1`);
  await expect(page.locator(".tiptap")).toContainText("Авторский текст");
  const retained = await page.evaluate((articleId) => localStorage.getItem(`probpera-editor-${articleId}`), id);
  expect(JSON.parse(retained).title).toBe(titleAfter);
  await page.goto(`${origin}/editor?existing&saved=1`);
  await expect(check).toBeVisible();
  await page.getByRole("button", { name: "Восстановить локальную копию" }).click();
  await expect(title).toHaveValue(titleAfter);
});

test("preview and Enter preserve intent and forward the real Next router signal", async ({ page }) => {
  for (const [intent, destination, saved] of [
    ["save", `/articles/edit?id=${id}&error=validation`, false],
    ["preview", `/articles/${id}/preview?locale=ru`, false],
    ["save", `/articles/edit?id=${id}&saved=1`, true],
  ]) {
    await page.goto(`${origin}/editor?existing&saved=1`);
    await expect(page.locator(".tiptap")).toContainText("Авторский текст");
    const title = page.getByRole("textbox", { name: "Заголовок", exact: true });
    await title.fill(titleAfter);
    if (intent === "save") {
      await title.press("Enter");
      await expect(page.getByText("Сохраняем черновик…")).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Сохранить и открыть предпросмотр" }).click();
      await expect(page.getByText("Сохраняем статью для предпросмотра…")).toBeVisible();
    }
    const [request] = await page.evaluate(() => window.fixture.calls);
    expect(request).toMatchObject({ id, intent, expected_updated_at: "2026-11-20T11:30:00+00:00" });
    await page.evaluate((to) => window.fixture.redirect(to), destination);
    await expect(page.locator("[data-router-signal]"))
      .toHaveAttribute("data-router-signal", `NEXT_REDIRECT;push;${destination};307;`);
    await expect(page.getByText("Сервер не подтвердил результат.", { exact: false })).toHaveCount(0);
    const recovery = await page.evaluate((articleId) => localStorage.getItem(`probpera-editor-${articleId}`), id);
    expect(recovery === null).toBe(saved);
  }
});

test("cover preparation and a failed upload keep the article intact for retry", async ({ page }) => {
  const responses = [];
  const sizes = [];
  await page.route(`${origin}/api/media/upload`, async (route) => {
    sizes.push(route.request().postDataBuffer().length);
    const success = await new Promise((resolve) => responses.push(resolve));
    return route.fulfill(success
      ? { json: { ok: true, url: "https://fixture.invalid/prepared-cover.webp" } }
      : { status: 503, json: { error: "Медиатека временно недоступна." } });
  });
  await page.goto(`${origin}/editor?existing`);
  await expect(page.locator(".tiptap")).toContainText("Авторский текст");
  await page.evaluate(() => {
    const encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      window.fixture.finishPreparingCover = () => {
        HTMLCanvasElement.prototype.toBlob = encode;
        encode.apply(this, args);
      };
    };
  });
  const png = await sharp({ create: { width: 1200, height: 600, channels: 3, background: "#286c9e" } })
    .png({ compressionLevel: 0 }).toBuffer();
  const file = { name: "original-cover.png", mimeType: "image/png", buffer: png };
  const cover = page.locator("section").filter({ has: page.getByRole("heading", { name: "Обложка", exact: true }) });
  const input = cover.locator('input[type="file"]');
  const url = cover.getByRole("textbox", { name: "Адрес изображения" });
  const save = page.getByRole("button", { name: "Сохранить черновик" });
  const status = page.locator(".editor-save-state");

  await input.setInputFiles(file);
  await expect(status).toContainText("Подготавливаем изображение без обрезки…");
  await expect(save).toBeDisabled();
  await page.waitForFunction(() => Boolean(window.fixture.finishPreparingCover));
  await page.evaluate(() => window.fixture.finishPreparingCover());
  await expect(status).toContainText("Загружаем подготовленное изображение…");
  await expect.poll(() => responses.length).toBe(1);
  expect(sizes[0]).toBeLessThan(png.byteLength);
  responses[0](false);
  await expect(page.getByText(/Медиатека временно недоступна\./u)).toBeVisible();
  await expect(url).toHaveValue("https://fixture.invalid/cover");
  await expect(save).toBeEnabled();

  await input.setInputFiles(file);
  await expect.poll(() => responses.length).toBe(2);
  responses[1](true);
  await expect(url).toHaveValue("https://fixture.invalid/prepared-cover.webp");
  await save.click();
  const [request] = await page.evaluate(() => window.fixture.calls);
  expect(request).toMatchObject({
    cover_external_url: "https://fixture.invalid/prepared-cover.webp",
    cover_alt: "Ручное описание",
  });
  expect(request.content_html).toContain("Авторский текст");
  expect(request.content_html).toContain("Caption ru");
  expect(JSON.stringify(request)).not.toContain("data:image");
});
