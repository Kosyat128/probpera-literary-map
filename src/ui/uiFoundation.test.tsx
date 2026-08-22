import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BrandArrowIcon from "../components/BrandArrowIcon";
import BrandSearchIcon from "../components/BrandSearchIcon";
import ActionLink from "./ActionLink";
import Button from "./Button";
import IconButton from "./IconButton";

describe("UI Foundation primitives", () => {
  it("keeps semantic button states and a stable loading label", () => {
    const markup = renderToStaticMarkup(
      <Button variant="primary" size="lg" loading>
        Открыть глобус
      </Button>
    );

    expect(markup).toContain("ui-action--primary");
    expect(markup).toContain("ui-action--lg");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("Открыть глобус");
    expect(markup).toContain("ui-action__spinner");
  });

  it("requires an accessible name for icon-only controls", () => {
    const markup = renderToStaticMarkup(
      <IconButton
        aria-label="Открыть поиск"
        icon={<BrandSearchIcon />}
        surface="dark"
      />
    );

    expect(markup).toContain('aria-label="Открыть поиск"');
    expect(markup).toContain("ui-icon-button--dark");
    expect(markup).toContain('viewBox="0 0 24 24"');
  });

  it("uses the same action contract for crawlable links", () => {
    const markup = renderToStaticMarkup(
      <ActionLink
        href="#atlas"
        variant="primary"
        endIcon={<BrandArrowIcon />}
      >
        Открыть глобус
      </ActionLink>
    );

    expect(markup).toContain('href="#atlas"');
    expect(markup).toContain("ui-action--primary");
    expect(markup).toContain("brand-arrow-icon");
  });
});
