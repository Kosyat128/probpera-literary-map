import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n?/gu, "\n");

const articleLoader = read("apps/admin/components/ArticleEditorLoader.tsx");
const pageLoader = read("apps/admin/components/PageEditorLoader.tsx");
const editArticlePage = read(
  "apps/admin/app/(dashboard)/articles/[id]/page.tsx"
);
const newArticlePage = read("apps/admin/app/(dashboard)/articles/new/page.tsx");
const editPagePage = read("apps/admin/app/(dashboard)/pages/[id]/page.tsx");

describe("rich editor lazy-loading boundary", () => {
  it("keeps browser-only editors behind non-SSR dynamic imports", () => {
    expect(articleLoader).toContain('"use client"');
    expect(articleLoader).toContain(
      'dynamic(() => import("./ArticleEditor")'
    );
    expect(articleLoader).toContain(
      'import type { ArticleEditorProps } from "./ArticleEditor"'
    );
    expect(articleLoader).toContain("ssr: false");
    expect(articleLoader).toContain('aria-live="polite"');

    expect(pageLoader).toContain('"use client"');
    expect(pageLoader).toContain('dynamic(() => import("./PageEditor")');
    expect(pageLoader).toContain(
      'import type { PageEditorProps } from "./PageEditor"'
    );
    expect(pageLoader).toContain("ssr: false");
    expect(pageLoader).toContain('aria-live="polite"');
  });

  it("routes every server page through the lightweight loaders", () => {
    for (const source of [editArticlePage, newArticlePage]) {
      expect(source).toContain(
        'from "@/components/ArticleEditorLoader"'
      );
      expect(source).toContain("<ArticleEditorLoader");
      expect(source).not.toContain('from "@/components/ArticleEditor"');
    }

    expect(editPagePage).toContain('from "@/components/PageEditorLoader"');
    expect(editPagePage).toContain("<PageEditorLoader");
    expect(editPagePage).not.toContain('from "@/components/PageEditor"');
  });
});
