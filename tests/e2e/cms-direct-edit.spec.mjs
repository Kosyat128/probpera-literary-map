import { expect, test } from "@playwright/test";

test("редактор выбирает текст внутри фона главной и сохраняет прямое редактирование полей", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero-editorial h1")).toBeVisible();
  const publicUrl = new URL(page.url());
  publicUrl.searchParams.set("cms-edit", "1");
  publicUrl.searchParams.set("cms-parent-origin", publicUrl.origin);
  const parentUrl = new URL("/__cms-direct-edit-parent", publicUrl);
  await page.route(parentUrl.toString(), (route) => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html><body style="margin:0">
      <script>window.cmsMessages=[];addEventListener('message',event=>{
        if(event.origin===location.origin&&event.data?.channel==='probpera:cms-edit')
          window.cmsMessages.push(event.data);
      });</script>
      <iframe title="Предпросмотр сайта" style="width:100%;height:100vh;border:0"
        src="${publicUrl.toString().replaceAll("&", "&amp;")}"></iframe>
    </body></html>`,
  }));
  await page.goto(parentUrl.toString());
  const preview = page.frameLocator("iframe");
  await expect(preview.locator("html")).toHaveClass(/cms-edit-mode/u);

  const lastMessage = () => page.evaluate(() => window.cmsMessages.at(-1));
  await preview.locator(".hero-editorial h1").click();
  await expect.poll(lastMessage).toMatchObject({
    type: "selection", key: "homepage.hero.title", entityType: "homepage-core",
  });

  const readJournal = preview.locator(".hero-actions .secondary-action");
  const originalText = (await readJournal.textContent()).trim();
  await readJournal.click();
  await expect.poll(lastMessage).toMatchObject({
    type: "selection", field: "siteCopy", kind: "text", value: originalText,
    entityType: "", entityId: "",
  });
  const selection = await lastMessage();
  expect(selection.copyKey).toMatch(/^interface\./u);
  expect(selection.key).toBe(selection.copyKey);

  await page.evaluate(({ key }) => {
    document.querySelector("iframe").contentWindow.postMessage({
      channel: "probpera:cms-edit", version: 2, type: "preview-update",
      key, kind: "text", value: "Читать новый выпуск",
    }, location.origin);
  }, selection);
  await expect(readJournal).toHaveText("Читать новый выпуск");
  await readJournal.click();
  await expect.poll(lastMessage).toMatchObject({
    type: "selection", key: selection.key, value: "Читать новый выпуск",
  });

  await preview.locator(".magazine-hero").click({ position: { x: 8, y: 8 } });
  await expect.poll(lastMessage).toMatchObject({
    type: "selection", key: "homepage.hero.backgroundMediaId", kind: "image",
  });
});
