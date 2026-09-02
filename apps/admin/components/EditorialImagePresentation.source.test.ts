import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const extensionSource = readFileSync(
  new URL("./EditorialImage.ts", import.meta.url),
  "utf8"
);
const viewSource = readFileSync(
  new URL("./EditorialImageView.tsx", import.meta.url),
  "utf8"
);
const editorStyles = readFileSync(
  new URL("../app/styles/editors.css", import.meta.url),
  "utf8"
);

describe("editorial image presentation controls", () => {
  it("round-trips only normalized appearance and reveal attributes", () => {
    expect(extensionSource).toContain("appearance: {");
    expect(extensionSource).toContain("reveal: {");
    expect(extensionSource).toContain(
      'element.getAttribute("data-image-appearance")'
    );
    expect(extensionSource).toContain(
      'element.getAttribute("data-image-reveal")'
    );
  });

  it("offers understandable Russian controls with safe fixed choices", () => {
    expect(viewSource).toContain('clean: "Без рамки"');
    expect(viewSource).toContain('frame: "Редакционная рамка"');
    expect(viewSource).toContain('shadow: "Мягкая тень"');
    expect(viewSource).toContain('none: "Без анимации"');
    expect(viewSource).toContain('"fade-up": "Плавное появление"');
    expect(viewSource).toContain('zoom: "Мягкое приближение"');
    expect(viewSource).toContain("data-image-appearance={media.appearance}");
    expect(viewSource).toContain("data-image-reveal={media.reveal}");
  });

  it("previews the allowlisted appearance without accepting custom classes", () => {
    expect(editorStyles).toContain(
      '.editorial-image-node[data-image-appearance="clean"]'
    );
    expect(editorStyles).toContain(
      '.editorial-image-node[data-image-appearance="shadow"]'
    );
    expect(viewSource).not.toContain("className={media.appearance}");
    expect(viewSource).not.toContain("className={media.reveal}");
  });
});
