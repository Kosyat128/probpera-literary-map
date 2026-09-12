import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panelSource = readFileSync(
  new URL("./WriterPanel.tsx", import.meta.url),
  "utf8"
);
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const bookArchiveSource = readFileSync(
  new URL("./BookArchiveSection.tsx", import.meta.url),
  "utf8"
);
const globeSource = readFileSync(
  new URL("./LiteraryGlobe.tsx", import.meta.url),
  "utf8"
);

describe("writer panel accessible relationships", () => {
  it("connects the country region, writer detail, tabs, and tab panels", () => {
    expect(panelSource).toContain('aria-labelledby={countryHeadingId}');
    expect(panelSource).toContain('aria-labelledby={writerDetailHeadingId}');
    expect(panelSource).toContain('role="tablist"');
    expect(panelSource).toContain('role="tab"');
    expect(panelSource).toContain('role="tabpanel"');
    expect(panelSource).toContain("aria-controls={detailPanelId(view)}");
    expect(panelSource).toContain("tabIndex={detailView === view ? 0 : -1}");
    expect(panelSource).toContain("onKeyDown={handleDetailTabKeyDown}");
  });

  it("keeps empty states explicit and honors reduced motion", () => {
    expect(panelSource).toContain("!hasWriterWorks");
    expect(panelSource).toContain("!hasWriterAwards");
    expect(panelSource).toContain("!hasWriterSources && !hasWriterRelatedArticles");
    expect(panelSource).toContain('className="writer-source-empty" role="status"');
    expect(panelSource).toContain('prefers-reduced-motion: reduce');
    expect(panelSource).not.toContain('className="country-panel" aria-live');
  });

  it("labels editorial groups, source links, and record statuses", () => {
    expect(panelSource).toContain("activeWriterWorkGroups.map");
    expect(panelSource).toContain("activeWriterAwardGroups.map");
    expect(panelSource).toContain("aria-labelledby={groupHeadingId}");
    expect(panelSource).toContain("data-editorial-status={work.status}");
    expect(panelSource).toContain("data-editorial-status={award.status}");
    expect(panelSource).toContain('target="_blank"');
    expect(panelSource).toContain('rel="noreferrer"');
    expect(panelSource).toContain('t("Открыть источник")');
    expect(panelSource).not.toContain("activeWriterWorks.slice(0, 8)");
  });

  it("opens every published work through an exact archive relation", () => {
    expect(panelSource).toContain("onWorkSelect?: (");
    expect(panelSource).toContain('className="writer-record-open-book"');
    expect(panelSource).toContain("onWorkSelect(");
    expect(panelSource).toContain("country.id,");
    expect(panelSource).toContain("activeWriter.id,");
    expect(panelSource).toContain("work.id");
    expect(panelSource).toContain("event.currentTarget");

    const transition = appSource.slice(
      appSource.indexOf("const openWriterWork"),
      appSource.indexOf("const selectCountry")
    );
    expect(transition).toContain("bookArchive.find");
    expect(transition).toContain("entry.countryId === countryId");
    expect(transition).toContain("entry.writerId === writerId");
    expect(transition).toContain("entry.id === workId");
    expect(transition).toContain("openResolvedWriterWork(book, returnFocus)");
    const resolvedTransition = appSource.slice(
      appSource.indexOf("const openResolvedWriterWork"),
      appSource.indexOf("const openWriterWork")
    );
    expect(resolvedTransition).toContain("openBook(book, returnFocus)");
    expect(resolvedTransition).toContain(
      "pendingImmersiveBookFocusRef.current = returnFocus"
    );
    expect(resolvedTransition).toContain(
      'atlasExperience.requestExit("programmatic")'
    );
    expect(appSource).toContain("onWorkSelect={openWriterWork}");
    expect(appSource).toContain(
      "requestedBookReturnFocus={requestedBookReturnFocusRef.current}"
    );
    expect(bookArchiveSource).toContain(
      "openBookDetail(requestedBook, requestedBookReturnFocus)"
    );
    expect(bookArchiveSource).toContain(
      "const target = exactReturnFocus || reconnectedTrigger || fallback"
    );
  });

  it("keeps article hrefs while intercepting only ordinary clicks", () => {
    expect(panelSource.match(/shouldUseClientNavigation\(event\)/gu)).toHaveLength(3);
    expect(panelSource.match(/navigateToArticle\(/gu)).toHaveLength(3);
    expect(panelSource.match(/event\.preventDefault\(\)/gu)?.length).toBeGreaterThanOrEqual(3);
  });

  it("exposes a semantic breadcrumb and explicit globe actions", () => {
    expect(panelSource).toContain('className="country-panel-breadcrumbs"');
    expect(panelSource).toContain(
      'aria-label={t("Навигация по Литературной планете")}'
    );
    expect(panelSource).toContain('<li aria-current="page">{activeWriterLabel}</li>');
    expect(panelSource).toContain("onNavigateWorld?: () => void");
    expect(panelSource).toContain("onNavigateCountry?: () => void");
    expect(panelSource).toContain("onShowWriterOnGlobe?: (writer: Writer) => void");
    expect(panelSource).toContain("onClick={() => onShowWriterOnGlobe(activeWriter)}");
    expect(panelSource).toContain('{t("Показать на глобусе")}');
  });

  it("only offers writer travel for validated spatial data", () => {
    expect(panelSource).toContain("const activeWriterGlobeCoordinates");
    expect(panelSource).toContain("createGlobeCoordinates(");
    expect(panelSource).toContain(
      "onShowWriterOnGlobe && activeWriterGlobeCoordinates"
    );
    expect(panelSource).toContain(
      'className="writer-source-empty writer-globe-unavailable"'
    );
    expect(panelSource).toContain(
      't("Место писателя на глобусе пока не указано")'
    );
  });

  it("keeps writer selection separate from the explicit globe action", () => {
    const chooseWriterSource = panelSource.slice(
      panelSource.indexOf("const chooseWriter"),
      panelSource.indexOf("const writerDetailId")
    );
    expect(chooseWriterSource).toContain("onWriterSelect?.(writer)");
    expect(chooseWriterSource).not.toContain("onShowWriterOnGlobe");
  });

  it("keeps World and Country breadcrumb transitions independent from refocus", () => {
    const worldTransition = appSource.slice(
      appSource.indexOf("const navigateWriterBreadcrumbWorld"),
      appSource.indexOf("const navigateWriterBreadcrumbCountry")
    );
    const countryTransition = appSource.slice(
      appSource.indexOf("const navigateWriterBreadcrumbCountry"),
      appSource.indexOf("const showWriterOnGlobe")
    );

    expect(worldTransition).toContain("setSelectedCountry(null)");
    expect(worldTransition).toContain("setSelectedWriter(null)");
    expect(worldTransition).toContain("globeFocusRequestIdRef.current += 1");
    expect(worldTransition).toContain('kind: "home"');
    expect(worldTransition).toContain("countryId: null");
    expect(worldTransition).toContain("writerId: null");

    expect(countryTransition).toContain("setSelectedWriter(null)");
    expect(countryTransition).toContain("countryId: selectedCountry.id");
    expect(countryTransition).toContain("writerId: null");
    expect(countryTransition).toContain("focusCountryPresentation()");
    expect(countryTransition).not.toContain("setSelectedCountry(null)");
    expect(countryTransition).not.toContain("showCountryOnGlobe");
    expect(appSource).toContain(
      "const keepWriter = keepCountry ? selectedWriter : null"
    );
    expect(appSource).toContain("country && urlState.writerId");
  });

  it("routes the World transition through the camera home intent", () => {
    expect(globeSource).toContain('kind: "home";');
    expect(globeSource).toContain('focusRequest?.kind === "home"');
    expect(globeSource).toContain('{ id: focusRequest.id, kind: "home" }');
  });

  it("validates writer coordinates again at the App boundary", () => {
    const showWriterTransition = appSource.slice(
      appSource.indexOf("const showWriterOnGlobe"),
      appSource.indexOf("const openCommunity")
    );
    expect(showWriterTransition).toContain("createGlobeCoordinates(");
    expect(showWriterTransition).toContain("!coordinates ||");
    expect(showWriterTransition).toContain("globeFocusRequestIdRef.current += 1");
    expect(showWriterTransition).toContain("coordinates,");
    expect(showWriterTransition).not.toContain("coordinates: null");
  });
});
