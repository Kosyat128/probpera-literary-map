import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const analyticsPage = readFileSync(
  new URL("../app/(dashboard)/analytics/page.tsx", import.meta.url),
  "utf8"
);
const adminWorkflow = readFileSync(
  new URL("../../../.github/workflows/deploy-admin.yml", import.meta.url),
  "utf8"
);

describe("admin geography analytics contract", () => {
  it("opens the exact Yandex Metrika geography report without inventing geo data", () => {
    expect(analyticsPage).toContain("adminEnv.metrikaCounterId");
    expect(analyticsPage).toContain("/^\\d{1,15}$/u");
    expect(analyticsPage).toContain("https://metrika.yandex.ru/stat/geo?period=month&id=");
    expect(analyticsPage).toContain("Язык браузера и часовой пояс");
    expect(analyticsPage).toContain('rel="noreferrer"');
  });

  it("passes and validates the production counter for the admin build", () => {
    expect(adminWorkflow).toContain(
      "YANDEX_METRIKA_COUNTER_ID: ${{ vars.YANDEX_METRIKA_COUNTER_ID }}"
    );
    expect(adminWorkflow).toContain(
      '[[ "$YANDEX_METRIKA_COUNTER_ID" =~ ^[0-9]+$ ]]'
    );
  });
});
