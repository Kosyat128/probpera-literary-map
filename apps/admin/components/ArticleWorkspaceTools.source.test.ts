import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const toolsSource = readFileSync(
  new URL("./ArticleWorkspaceTools.tsx", import.meta.url),
  "utf8"
);
const contextSource = readFileSync(
  new URL("./ArticleEditorContext.tsx", import.meta.url),
  "utf8"
);
const editorSource = readFileSync(
  new URL("./ArticleEditor.tsx", import.meta.url),
  "utf8"
);
const shellSource = readFileSync(
  new URL("./AdminShell.tsx", import.meta.url),
  "utf8"
);

describe("typed article editor workspace bridge", () => {
  it("consumes typed editor state without scraping or observing rendered markup", () => {
    expect(toolsSource).toContain("useArticleEditorWorkspace");
    expect(toolsSource).not.toContain("querySelector");
    expect(toolsSource).not.toContain("MutationObserver");
    expect(toolsSource).not.toContain("textContent");
    expect(toolsSource).not.toMatch(/\.click\s*\(/u);
  });

  it("registers the route-scoped provider and explicit editor actions", () => {
    expect(contextSource).toContain("ArticleEditorWorkspaceProvider");
    expect(contextSource).toContain("useRegisterArticleEditorWorkspace");
    expect(shellSource).toContain("showArticleWorkspace ? (");
    expect(shellSource).toContain("<ArticleEditorWorkspaceProvider>");
    expect(editorSource).toContain("useRegisterArticleEditorWorkspace");
    expect(editorSource).toContain("requestSubmit(submitter)");
    expect(editorSource).toContain("registerWorkspaceSection");
  });

  it("derives outline and metrics from TipTap state rather than heading labels", () => {
    expect(editorSource).toContain("documentNode?.descendants");
    expect(editorSource).toContain("documentNode.textBetween");
    expect(editorSource).toContain("articleWorkspaceCheckSection(item.label)");
    expect(editorSource).toContain("goToWorkspaceHeading");
  });
});
