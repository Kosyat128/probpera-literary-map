// Synthetic component fixture; all server boundaries are replaced by the runner.
import React from "react";
import { createRoot } from "react-dom/client";
import PageEditor from "@/components/PageEditor";
import RecoveryController from "@/components/editor/RecoveryController";
import PageEditorLoader from "@/components/PageEditorLoader";

const harness = window.__pageFormHarness;
const page = {
  id: "11111111-1111-4111-8111-111111111111",
  updated_at: "2026-09-30T10:00:00.123456+00:00",
  title: "Synthetic page title", excerpt: "Synthetic original excerpt", slug: "synthetic-page",
  content_html: "<p>Synthetic original paragraph.</p>",
  content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Synthetic original paragraph." }] }] },
  status: "draft", seo_title: null, seo_description: null, canonical_url: null, allow_indexing: true,
};
class HarnessErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) {
    harness.componentErrors.push({ name: error.name, message: error.message, digest: error.digest || null });
  }
  render() {
    return this.state.error
      ? <div role="alert" data-harness-error-boundary="true">Fixture captured an unhandled component error.</div>
      : this.props.children;
  }
}
const recoveryOnly = harness.scenario.startsWith("fallback-");
const editorProps = (id) => ({ page: { ...page, id }, publicSiteUrl: "https://public.invalid",
  catalogContext: { q: "Synthetic context", status: "draft", page: 2, revisionPage: 3 } });
function LoaderHarness() {
  const [pageId, setPageId] = React.useState(page.id);
  const [current, setCurrent] = React.useState(harness.scenario === "loader-initial-null" ? null : editorProps(page.id));
  harness.updateLoader = (available, nextId = page.id) => { setPageId(nextId); setCurrent(available ? editorProps(nextId) : null); };
  const retryHref = "/admin/pages/11111111-1111-4111-8111-111111111111?syntheticRetry=1";
  const fallback = <p data-harness-loader-unavailable="true">Synthetic loader unavailable. <a href={retryHref}>Synthetic retry read</a></p>;
  // The old caller conditionally removed its actual loader. The new caller always
  // renders the actual boundary. Keep this composition difference explicit.
  return harness.legacyLoaderApi ? current ? <PageEditorLoader {...current} /> : fallback
    : <PageEditorLoader pageId={pageId} current={current} fallback={fallback} retryHref={retryHref} />;
}
harness.reactVersion = React.version;
createRoot(document.getElementById("root")).render(
  <HarnessErrorBoundary>
    {harness.scenario.startsWith("loader-") ? <LoaderHarness /> : recoveryOnly ? <RecoveryController
      locator={{ entityType: "page", entityId: page.id, draftScope: page.id, localeScope: "default", baseUpdatedAt: page.updated_at }}
      snapshot={{ version: 2, title: "Synthetic autosave title", contentHtml: page.content_html, contentJson: JSON.stringify(page.content_json) }}
      isDirty={true} onRestore={() => {}}
      onLocalFallback={() => { harness.localFallbackCalls += 1; return harness.scenario === "fallback-false" ? false : undefined; }}
    /> : <PageEditor page={page} publicSiteUrl="https://public.invalid" savedAfterSubmit={harness.scenario.startsWith("cleanup-")}
      catalogContext={{ q: "Synthetic context", status: "draft", page: 2, revisionPage: 3 }} />}
  </HarnessErrorBoundary>
);
harness.bundleLoaded = true;
