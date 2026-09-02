export const stage5BaselineProvenance = Object.freeze({
  schemaVersion: 3,
  capturedOn: "2026-08-24",
  baseMainSha: "8c24038510324d00086afe05b8de78b0f09ae52e",
  integrationStartSha: "5992b3b53a76446910d8c4ec10d5fc517fb874bb",
  sourceTreeSha: "83985c6446af670cbc2e9b409851e8f5bceda7f5",
  repositoryManifest: {
    algorithm: "sha256",
    recordFormat: "path\\0blob-object\\0bytes\\0",
    files: 4002,
    bytes: 254639669,
    sha256: "daa16b84f3c1d3553e9e55ec079d6a581ee756eff31a77241cc9070fe1510cfb",
  },
  verifiedProductionEvidencePath:
    "reports/stage5-baseline/verified-production-build.json",
  verifiedProduction: {
    classification: "EXACT_GITHUB_PAGES_ARTIFACT",
    workflowRunId: 32719497676,
    artifactId: 9517505146,
    releaseSha: "8c24038510324d00086afe05b8de78b0f09ae52e",
    files: 4383,
    bytes: 115067016,
    manifestSha256:
      "5cfcdf9e48c6377398dc62bad7aac89d163bda811a3e5a7d3b3d49a963a58ef8",
  },
  stylesheetPaths: [
    "src/index.css",
    "src/analytics/analyticsConsent.css",
    "src/community/community-accessibility.css",
  ],
});

export const stage4ProductionPaths = Object.freeze([
  "src/atlas/atlasExperienceState.ts",
  "src/atlas/useAtlasExperience.ts",
  "src/components/AtlasExperienceChrome.tsx",
  "src/components/GlobeCameraRig.tsx",
  "src/components/GlobeViewObserver.tsx",
  "src/components/LiteraryGlobe.tsx",
  "src/components/LiteraryWorldMap.tsx",
  "src/components/NobelMarkerLayer.tsx",
  "src/components/WriterPanel.tsx",
  "src/components/globeAtlas.ts",
  "src/components/globeCoordinates.ts",
  "src/components/globeDiscovery.ts",
  "src/components/globeFocusMath.ts",
  "src/components/globeKeyboardNavigation.ts",
  "src/components/globePerformance.ts",
  "src/components/globeProjection.ts",
  "src/components/globeTouchActivation.ts",
  "src/components/nobelMarkerPolicy.ts",
  "src/components/useGlobeStyleState.ts",
  "src/i18n/InterfaceLanguage.tsx",
]);

export const bookArchiveOwnerPaths = Object.freeze([
  "src/components/BookArchiveSection.tsx",
  "src/hooks/useReadingLibrary.ts",
  "src/data/bookArchive.ts",
  "src/data/bookArchiveQueue.ts",
  "src/data/bookLocalization.ts",
  "src/data/bookQuality.ts",
  "src/data/cms/bookEditions.generated.ts",
  "src/data/cms/bookEditions.ts",
  "src/data/userSuppliedBookCovers.ts",
]);

export const premiumTranslationAndHealthPaths = Object.freeze([
  ".github/workflows/deploy-admin.yml",
  ".github/workflows/dispatch-premium-database-reconciliation.yml",
  ".github/workflows/reconcile-production-database.yml",
  "apps/admin/app/(dashboard)/articles/actions-legacy.ts",
  "apps/admin/app/(dashboard)/articles/atomic-auto-publish-action.ts",
  "apps/admin/app/(dashboard)/articles/atomic-standard-save-action.ts",
  "apps/admin/app/(dashboard)/articles/save-article-action.ts",
  "apps/admin/app/(dashboard)/library/premium-translation-actions.ts",
  "apps/admin/app/(dashboard)/site-copy/actions.ts",
  "apps/admin/app/(dashboard)/translations/actions.ts",
  "apps/admin/app/(dashboard)/translations/article-actions.ts",
  "apps/admin/app/(dashboard)/translations/country-actions.ts",
  "apps/admin/catalog-assets/editorial-catalog.json",
  "apps/admin/catalog-assets/interface-copy-catalog.json",
  "apps/admin/lib/admin-catalog-assets.ts",
  "apps/admin/lib/article-translations.ts",
  "apps/admin/lib/auto-translate-article-core.ts",
  "apps/admin/lib/auto-translate-article-premium.ts",
  "apps/admin/lib/auto-translate-article.ts",
  "apps/admin/lib/auto-translate-country-profile.ts",
  "apps/admin/lib/auto-translate-literary-work-safe.ts",
  "apps/admin/lib/auto-translate-literary-work.ts",
  "apps/admin/lib/auto-translate-published-article-premium.ts",
  "apps/admin/lib/auto-translate-site-copy.ts",
  "apps/admin/lib/auto-translate-writer-biography.ts",
  "apps/admin/lib/editorial-schema-health.ts",
  "apps/admin/lib/env.ts",
  "apps/admin/lib/premium-english-translation.ts",
  "apps/admin/lib/publication.ts",
  "apps/admin/scripts/sync-private-catalogs.mjs",
  "scripts/audit-editorial-language.mjs",
  "scripts/database/build-production-migration-plan.mjs",
  "scripts/export-interface-copy-catalog.mjs",
  "scripts/export-premium-translations.mjs",
  "src/data/articles/localization.ts",
  "src/data/bookLocalization.ts",
  "src/data/countryLocalization.ts",
  "src/i18n/InterfaceLanguage.tsx",
  "supabase/migrations/20260808_article_translations.sql",
  "supabase/migrations/20260808_book_translations_and_import_staging.sql",
  "supabase/migrations/20260813_unified_revision_history.sql",
  "supabase/migrations/20260814_publication_outbox_and_schema_health.sql",
  "supabase/migrations/20260822_zz_atomic_article_bundle.sql",
  "supabase/migrations/20260823_premium_machine_translation.sql",
]);

export const ownerCssClasses = Object.freeze([
  "topline",
  "site-header",
  "brand",
  "sections-menu",
  "sections-mega-menu",
  "sections-mega-groups",
  "header-actions",
  "global-search-trigger",
  "interface-language-control",
  "header-socials",
  "reader-button",
  "mobile-nav",
  "magazine-hero",
  "hero-editorial",
  "hero-title-lead",
  "hero-title-accent",
  "hero-title-accent-line",
  "hero-mobile-break",
  "hero-actions",
  "primary-action",
  "secondary-action",
  "hero-proof",
  "hero-cover",
]);

export const governanceFingerprintRegistry = Object.freeze([
  {
    id: "STAGE4-PRODUCTION-SURFACE",
    paths: stage4ProductionPaths,
    expected: {
      files: 20,
      sha256: "bdf233f3996f069798908abc42e21f13e620a88c2fe293b3aa633004f7f23f60",
    },
  },
  {
    id: "BOOK-ARCHIVE-OWNER-LOCK",
    paths: bookArchiveOwnerPaths,
    expected: {
      files: 9,
      sha256: "0cc93c1437b7829a9657557b4f26038d2e0d79df41b7791160316c168411cd41",
    },
  },
  {
    id: "PREMIUM-TRANSLATION-AND-HEALTH-PIPELINE",
    paths: premiumTranslationAndHealthPaths,
    expected: {
      files: 44,
      sha256: "2b4bdaa25e526d7839297330befe68f121539443ba68634e3bf036dbae7afe9f",
    },
  },
  {
    id: "HEADER-HERO-CSS-OWNER-LOCK",
    paths: ["src/index.css"],
    classTokens: ownerCssClasses,
    expected: {
      rules: 221,
      sha256: "952a62f4118a962af3d47fd7e8f614d864c655e08e86148e95681d034d6a2a96",
    },
  },
]);

export const currentIntegrationPremiumTranslationAndHealthPaths = Object.freeze([
  ...premiumTranslationAndHealthPaths,
  "apps/admin/lib/article-translation-machine-ownership.ts",
  "apps/admin/lib/premium-translation-runtime.ts",
  "apps/admin/lib/translation-backfill-cursor.ts",
]);

export const stage5D1AdditiveI18nAttestation = Object.freeze({
  id: "STAGE5-D1-INTERFACE-COPY",
  sourceIntegrationSha: "fdd981381e859ab0ceaa44b48e9236af70c43db7",
  fixturePath: "scripts/fixtures/stage5d1-interface-additions.json",
  allowedPaths: Object.freeze([
    "src/i18n/InterfaceLanguage.tsx",
    "apps/admin/catalog-assets/interface-copy-catalog.json",
  ]),
  interfaceLanguage: Object.freeze({
    declaration: "englishInterfaceText",
    baselineEntries: 916,
    baselinePairsSha256:
      "7053755a7c46865d1c8f1c795c595b08d96d031bfeb0a9653c1cc1f6dc395c93",
    codeOutsideInitializerSha256:
      "96a330622dd3b14b98f4215fc8392e7af7160c8ff74b8e33df2d2e99efb55802",
    currentEntries: 1074,
    additions: Object.freeze({
      entries: 158,
      keysSha256:
        "862b7216fd6640f2ee56128b946e8a2dddb600586337f4cfc51a13023ba06be4",
      pairsSha256:
        "969b9d5f09667af8b1381cc3ffdda4cb3318fa9afd7360fbcf0a5244953355bc",
    }),
  }),
  catalog: Object.freeze({
    baselineEntries: 1130,
    baselineContentSha256:
      "280bb7704a34921fdbb2c95c51bb5264ecaab1c210dfbdb5b0a37d62a29caa5d",
    currentEntries: 1288,
    additions: Object.freeze({
      entries: 158,
      keysSha256:
        "d0a12bf4b233d494b28ea44cf8ae16fa14340779719b76ce835f29626d53b223",
      contentSha256:
        "95af343e30cb1cdd3ba0056fde37c02597f0c0346c3a6989d027b00289a46a27",
    }),
  }),
});

export const stage5FinalInterfaceCopyAttestation = Object.freeze({
  id: "STAGE5-FINAL-INTERFACE-COPY",
  sourceStage5FSha: "d473278a7d0617f14b1d50938fda9bab5c464efa",
  sourceMainSyncSha: "c1939a632bc4c3d36649e7c4b2076fcc0711d2c4",
  interfaceLanguage: Object.freeze({
    entries: 1211,
    keysSha256:
      "3de27ec05f1faf0ab50ecd06a4984bb4fe7cec83cf443bedcbfa7a4f52708424",
    pairsSha256:
      "06f54de7c59f25b4c6dc3be6796ab729fe5e7f7e9b6092ed2adaf97eeded5147",
  }),
  catalog: Object.freeze({
    entries: 1425,
    keysSha256:
      "079fba83f5898e208ff99e92d84b5d79e0bbf55059009156783ad1c840104461",
    contentSha256:
      "20dbcd7d32f2d74cb18ee3f2ad4e13c678681560efc6c1ae9184de81bcf50716",
  }),
});

export const russianBiographyEditorialOwnerAttestation = Object.freeze({
  id: "RUSSIAN-BIOGRAPHY-EDITORIAL-2026-09-01",
  authorizedOn: "2026-09-01",
  scopes: Object.freeze([
    "canonical-writer-biographies",
    "book-quality-russian-copy",
    "premium-translation-and-health-russian-copy",
  ]),
});

export const bookDatabaseEditorialOwnerAttestation = Object.freeze({
  id: "BOOK-DATABASE-EDITORIAL-2026-09-02",
  authorizedOn: "2026-09-02",
  sourceIntegrationSha: "d87db7674de685bed86f78d93212246ab41fe804",
  scopes: Object.freeze([
    "canonical-book-audit-and-localization",
    "canon-source-and-evidence-v2-adjudication",
    "book-admin-and-atomic-release-pipeline",
  ]),
});

const stage5D1Stage4GlobeStablePaths = Object.freeze(
  stage4ProductionPaths.filter(
    (entry) => entry !== "src/i18n/InterfaceLanguage.tsx"
  )
);

const retiredPremiumCompatibilityPaths = Object.freeze([
  "apps/admin/app/(dashboard)/articles/actions-legacy.ts",
  "apps/admin/app/(dashboard)/articles/atomic-auto-publish-action.ts",
]);

const stage5D1PremiumCurrentStablePaths = Object.freeze([
  ...currentIntegrationPremiumTranslationAndHealthPaths.filter(
    (entry) =>
      !stage5D1AdditiveI18nAttestation.allowedPaths.includes(entry) &&
      !retiredPremiumCompatibilityPaths.includes(entry)
  ),
  ".github/workflows/deploy-pages.yml",
  "package.json",
  "apps/admin/app/(dashboard)/editorial-database/actions.ts",
  "apps/admin/app/(dashboard)/editorial-database/page.tsx",
  "apps/admin/app/(dashboard)/translations/page.tsx",
  "apps/admin/lib/editorial-catalog.ts",
  "apps/admin/lib/editorial-profile-edit.ts",
  "apps/admin/lib/writer-biography-edit.ts",
  "scripts/archive-source.ts",
  "scripts/audit-writer-biography-structured-ru.mjs",
  "scripts/build-writer-biography-fact-review-overlay.mjs",
  "scripts/export-editorial-catalog.mjs",
  "scripts/generate-writer-biography-english-translations.mjs",
  "scripts/generate-writer-biography-russian-editorial-refinements.mjs",
  "scripts/lib/writer-biography-english-qa.mjs",
  "scripts/lib/writer-biography-english-source-contract.mjs",
  "scripts/lib/writer-biography-public-overrides.mjs",
  "scripts/lib/writer-biography-public-profile.mjs",
  "scripts/lib/writer-biography-russian-editorial-contract.mjs",
  "scripts/lib/writer-biography-structured-ru.mjs",
  "scripts/workers/writer-biography-english-translation-worker.ts",
  "scripts/wrangler.writer-biography-english.jsonc",
  "scripts/writer-biography-english-source.ts",
  "src/data/countries/index.ts",
  "src/data/countries/russianWriterExpansion.ts",
  "src/data/countries/writerBiographyEnglishTranslations.ts",
  "src/data/countries/writerBiographyFactReviews.ts",
  "src/data/writerBiography.ts",
  "src/data/writerBiographyDisplay.ts",
]);

export const stage5D1EnforcedGovernanceScopes = Object.freeze({
  stage4Globe: Object.freeze({
    paths: stage5D1Stage4GlobeStablePaths,
    expected: Object.freeze({
      files: 19,
      sha256:
        "d65bdd6d7bb99d16a2786879d7f88ed323286a7c227400d5292c1c43fb3db90c",
    }),
  }),
  premiumCurrent: Object.freeze({
    paths: stage5D1PremiumCurrentStablePaths,
    ownerAttestationId: bookDatabaseEditorialOwnerAttestation.id,
    expected: Object.freeze({
      files: 72,
      sha256:
        "3376be86e374f657b0a9b0d83d24fd018fc3303616a8a6e460cf79f3e91e5044",
    }),
  }),
});

export const currentIntegrationGovernanceFingerprintRegistry = Object.freeze(
  governanceFingerprintRegistry.map((entry) =>
    entry.id === "STAGE4-PRODUCTION-SURFACE"
      ? Object.freeze({
          ...entry,
          enforced: stage5D1EnforcedGovernanceScopes.stage4Globe,
          additiveAttestationId: stage5D1AdditiveI18nAttestation.id,
        })
      : entry.id === "PREMIUM-TRANSLATION-AND-HEALTH-PIPELINE"
        ? Object.freeze({
            ...entry,
            sourceMainSha: "97f4a8d191989f454b5625caae0bafc6a22b47d6",
            sourceBookIntegrationSha:
              bookDatabaseEditorialOwnerAttestation.sourceIntegrationSha,
            paths: currentIntegrationPremiumTranslationAndHealthPaths,
            expected: Object.freeze({
              files: 47,
              sha256:
                "8fe4558f9539ecc52b67421e8208661ce5e25f44e1b759f4a27d476c0218d6f3",
            }),
            enforced: stage5D1EnforcedGovernanceScopes.premiumCurrent,
            additiveAttestationId: stage5D1AdditiveI18nAttestation.id,
          })
        : entry.id === "BOOK-ARCHIVE-OWNER-LOCK"
          ? Object.freeze({
              ...entry,
              sourceIntegrationSha:
                bookDatabaseEditorialOwnerAttestation.sourceIntegrationSha,
              expected: Object.freeze({
                files: 9,
                sha256:
                  "dd720968c269372c4caa3521273d9eea9b1ead231e5733e334c993402da38942",
              }),
              enforced: Object.freeze({
                paths: bookArchiveOwnerPaths,
                ownerAttestationId:
                  bookDatabaseEditorialOwnerAttestation.id,
                expected: Object.freeze({
                  files: 9,
                  sha256:
                    "5f9a3fc115e4022b6a128cb592191b8e0a3c317e55e383e5b95651d45f97e383",
                }),
              }),
            })
          : entry.id === "HEADER-HERO-CSS-OWNER-LOCK"
            ? Object.freeze({
                ...entry,
                enforced: Object.freeze({
                  paths: ["src/index.css"],
                  expected: Object.freeze({
                    rules: 225,
                    sha256:
                      "576898463bc2f981e3ddfdbb283ac82b961d2eaeb5a5fb316d35f89fd528d743",
                  }),
                }),
              })
            : entry
  )
);

export const sourceReviewRegistry = Object.freeze([
  ["governance", "docs/UI_FOUNDATION.md"],
  ["governance", "docs/GLOBE_EXPLORATION_UX.md"],
  ["governance", "reports/ui-ux-audit.md"],
  ["stage4", "reports/stage4-premium-globe-exploration-pr.md"],
  ["stage4", "reports/stage4-visual-evidence/README.md"],
  ["app", "src/App.tsx"],
  ["app", "src/index.css"],
  ["ui", "src/ui/Button.tsx"],
  ["ui", "src/ui/IconButton.tsx"],
  ["ui", "src/ui/ActionLink.tsx"],
  ["globe", "src/components/LiteraryGlobe.tsx"],
  ["globe", "src/components/AtlasExperienceChrome.tsx"],
  ["globe", "src/components/AtlasSearchCombobox.tsx"],
  ["globe-state", "src/atlas/atlasExperienceState.ts"],
  ["globe-state", "src/atlas/useAtlasExperience.ts"],
  ["globe-camera", "src/components/GlobeCameraRig.tsx"],
  ["globe-camera", "src/components/GlobeViewObserver.tsx"],
  ["globe-map", "src/components/LiteraryWorldMap.tsx"],
  ["globe-map", "src/components/WorldMap.tsx"],
  ["globe-map", "src/components/GlobeCountryFocus.tsx"],
  ["globe-nobel", "src/components/NobelMarkerLayer.tsx"],
  ["globe-policy", "src/components/globeAtlas.ts"],
  ["globe-policy", "src/components/globeAssetCache.ts"],
  ["globe-policy", "src/components/globeCoordinates.ts"],
  ["globe-policy", "src/components/globeDiscovery.ts"],
  ["globe-policy", "src/components/globeFocusMath.ts"],
  ["globe-policy", "src/components/globeGeography.ts"],
  ["globe-policy", "src/components/globeInteraction.ts"],
  ["globe-policy", "src/components/globeKeyboardNavigation.ts"],
  ["globe-policy", "src/components/globePerformance.ts"],
  ["globe-policy", "src/components/globeProjection.ts"],
  ["globe-policy", "src/components/globeTouchActivation.ts"],
  ["globe-policy", "src/components/nobelMarkerPolicy.ts"],
  ["globe-style", "src/components/useGlobeStyleState.ts"],
  ["sections", "src/components/SectionsDirectory.tsx"],
  ["writers", "src/components/WriterPanel.tsx"],
  ["reader", "src/components/ArticleReader.tsx"],
  ["reader", "src/components/ArticleLibrarySection.tsx"],
  ["books", "src/components/BookArchiveSection.tsx"],
  ["calendar", "src/components/LiteraryCalendar.tsx"],
  ["search", "src/components/GlobalSearch.tsx"],
  ["cms", "src/components/CmsHomepageContent.tsx"],
  ["community", "src/community/CommunityHub.tsx"],
  ["reading-library", "src/hooks/useReadingLibrary.ts"],
  ["i18n", "src/i18n/InterfaceLanguage.tsx"],
  ["build", "package.json"],
  ["performance", "performance-budget.json"],
  ["performance", "scripts/audit-performance-budget.mjs"],
  ["service-worker", "public/sw.js"],
  ["service-worker", "src/mobile/registerServiceWorker.ts"],
  ["database", "scripts/database/build-production-migration-plan.mjs"],
  ["database", "scripts/database/production-migration-plan.test.mjs"],
  ["database", "supabase/migrations/20260728_reader_favorites.sql"],
  ["database", "supabase/migrations/20260801_reader_profiles_and_forum_votes.sql"],
  ["database", "supabase/migrations/20260802_reader_journey.sql"],
  ["database", "supabase/migrations/20260808_article_translations.sql"],
  ["database", "supabase/migrations/20260808_book_translations_and_import_staging.sql"],
  ["database", "supabase/migrations/20260813_homepage_atomic_move.sql"],
  ["database", "supabase/migrations/20260814_publication_outbox_and_schema_health.sql"],
  ["database", "supabase/migrations/20260820_homepage_book_month_editorial_choice.sql"],
  ["schema-health", "apps/admin/lib/editorial-schema-health.ts"],
  ["production-workflow", ".github/workflows/reconcile-production-database.yml"],
  ["production-workflow", ".github/workflows/dispatch-premium-database-reconciliation.yml"],
  ["production-workflow", ".github/workflows/deploy-pages.yml"],
  ["production-workflow", ".github/workflows/quality.yml"],
  ["translation", "supabase/migrations/20260823_premium_machine_translation.sql"],
  ["translation", "scripts/export-premium-translations.mjs"],
  ["translation", "scripts/export-premium-translations.source.test.mjs"],
  ["translation", "apps/admin/lib/premium-english-translation.ts"],
  ["translation", "apps/admin/lib/auto-translate-article-premium.ts"],
  ["translation", "apps/admin/lib/auto-translate-published-article-premium.ts"],
  ...stage4ProductionPaths.map((file) => ["stage4-owner-lock", file]),
  ...bookArchiveOwnerPaths.map((file) => ["book-archive-owner-lock", file]),
  ...premiumTranslationAndHealthPaths.map((file) => ["premium-pipeline-lock", file]),
]);

const keep = (selector, reason, match = "exact") => ({
  selector,
  decision: "KEEP",
  reason,
  match,
});
const tune = (selector, reason, match = "exact") => ({
  selector,
  decision: "TUNE",
  reason,
  match,
});
const fix = (selector, reason, match = "exact") => ({
  selector,
  decision: "FIX",
  reason,
  match,
});

export const inventoryRegistry = Object.freeze({
  typography: {
    title: "Typography",
    scope:
      "Declared typography values in the public app. Runtime computed styles require browser capture.",
    entries: [
      keep("body", "Stable public-app base; change only through scoped roles."),
      keep(".brand", "Header owner lock (HEADER-001/002).", "family"),
      keep(".site-header > nav > a", "Header navigation owner lock.", "state"),
      keep(".hero-editorial h1", "Hero typography owner lock (HERO-001/002).", "family"),
      tune(".section-kicker", "Normalize the shared kicker role without global element overrides."),
      tune(".section-heading h2", "Normalize major section title role in Stage 5B."),
      tune(".book-of-day h3", "Book Month title is a scoped card-title role."),
      tune(".article-copy h3", "Editorial card title currently has family-specific sizing."),
      tune(".community-copy h2", "Bring Community title into the major-title scale."),
      tune(".author-showcase strong", "Author-card title rhythm belongs to Stage 5B/5C."),
      tune(".sections-directory h3", "Unify directory card-title baseline in Stage 5B/5C."),
      tune(".calendar-heading h3", "Bring Calendar title into the normal section scale."),
      keep(".article-reader-lead h1", "Reader hierarchy is a separate, already scoped surface.", "family"),
      keep(".article-reader-content", "Author text and reader measure must not be mutated.", "family"),
    ],
  },
  spacing: {
    title: "Spacing",
    scope:
      "Declared layout rhythm for owner locks, homepage sections, overlays, and archive boundaries.",
    entries: [
      keep(".site-header", "Header geometry is owner locked.", "state"),
      keep(".magazine-hero", "Hero composition is owner locked.", "state"),
      keep(".atlas-section", "Stage 4 Globe architecture and geometry are locked.", "state"),
      tune(".daily-grid", "Book Month group is explicitly in Stage 5B/5C polish scope.", "state"),
      tune(".editorial-section", "Audit excessive gaps while preserving editorial whitespace.", "state"),
      tune(".community-section", "Community grid rhythm is Stage 5C scope.", "state"),
      fix(".author-showcase article", "Stage 5C requires overly tall author cards to be corrected.", "family"),
      fix(".section-directory-card", "Section landmarks require a shared row baseline.", "family"),
      tune(".calendar-card", "Calendar padding and empty space need cross-viewport review.", "family"),
      tune(".trust-center", "Align Trust spacing with the final homepage sequence.", "family"),
      keep(".book-archive-section", "Book Archive is measure-only through Stage 5C.", "family"),
      keep(".article-reader-paper", "Reader measure is intentionally isolated.", "family"),
      keep(".site-footer", "Footer is a terminal landmark; no Stage 5A redesign.", "state"),
    ],
  },
  colors: {
    title: "Colors",
    scope:
      "Brand, surface, text, state, and reader colors declared in the public stylesheets.",
    entries: [
      keep(":root", "Canonical Probpera tokens and UI foundation variables."),
      keep(".site-header", "Header owner lock.", "state"),
      keep(".hero-editorial", "Hero color composition is owner locked.", "family"),
      keep(".primary-action", "Owner-approved Open Globe action color.", "state"),
      keep(".atlas-section", "Stage 4 Globe art direction is locked.", "state"),
      tune(".section-kicker", "Use orange only for the shared branded metadata role."),
      tune(".editorial-section", "Consolidate the VIOLET/INK surface family.", "state"),
      tune(".community-section", "Retain artwork while normalizing brand-orange emphasis.", "state"),
      tune(".painted-paper-section", "Consolidate PAPER/LIGHT EDITORIAL fallback surfaces.", "state"),
      keep(".article-reader.is-dark", "Reader theme palette is a separate functional theme."),
      keep(".article-reader.is-book", "Book reader palette is a separate functional theme."),
      keep(".engagement-message", "Success/error/status semantics must not become brand orange.", "family"),
    ],
  },
  buttons: {
    title: "Buttons and actions",
    scope:
      "Shared primitives plus legacy/surface-specific actions and their interaction states.",
    entries: [
      keep(".primary-action", "Open Globe button is part of the Hero owner lock.", "state"),
      keep(".secondary-action", "Hero secondary action is part of the Hero owner lock.", "state"),
      fix(
        ".global-search-trigger",
        "Header geometry remains owner locked, but the measured forced-colors focus indicator requires a scoped Stage 5F accessibility fix.",
        "family"
      ),
      keep(".reader-button", "Header action geometry is owner locked.", "family"),
      keep(".atlas-filters button", "Stage 4 Globe controls are locked.", "family"),
      keep(".ui-action", "Canonical accessible shared action primitive.", "family"),
      keep(".ui-icon-button", "Canonical accessible icon-button primitive.", "family"),
      keep(".ui-action--primary", "Canonical brand action states.", "state"),
      keep(".ui-action--secondary", "Canonical secondary action states.", "state"),
      keep(".ui-action--text", "Canonical text-action states.", "state"),
      tune(".book-of-day .book-action-primary", "Align scoped Book Month action with the foundation.", "state"),
      tune(".book-of-day .book-action-secondary", "Align scoped Book Month action with the foundation.", "state"),
      tune(".section-link", "Normalize small editorial CTA type and focus treatment.", "state"),
      tune(".sections-all-button", "Normalize directory expansion action with shared controls.", "state"),
      fix(".calendar-navigation button", "Legacy circular buttons need shared focus/size verification.", "family"),
    ],
  },
  backgrounds: {
    title: "Backgrounds",
    scope:
      "Owner-locked, CMS-supplied, and CSS fallback background families in the public app.",
    entries: [
      keep("body", "Root stacking/background contract; decorative art remains behind content.", "state"),
      keep(".magazine-hero", "Hero image and composition are owner locked.", "state"),
      keep(".atlas-section", "Stage 4 Globe background/canvas stacking is locked.", "state"),
      tune(".painted-paper-section", "Consolidate PAPER fallback family without new heavy assets.", "state"),
      tune(".daily-grid", "Book Month fallback belongs to LIGHT EDITORIAL/PAPER.", "state"),
      tune(".editorial-section", "Consolidate VIOLET/INK family.", "state"),
      tune(".community-section", "Keep existing art but clarify foreground/background hierarchy.", "state"),
      tune(".authors-section.painted-paper-section", "Keep one coherent paper family.", "state"),
      tune(".calendar-section.painted-paper-section", "Keep one coherent paper family.", "state"),
      keep(".cms-core-editable.has-cms-background", "Homepage CMS background must beat CSS fallback.", "family"),
      keep(".article-reader-paper", "Reader paper is an isolated functional surface.", "state"),
      keep(".site-footer", "Terminal INK surface remains structurally stable.", "state"),
    ],
  },
  motion: {
    title: "Motion",
    scope:
      "Declared transitions/animations and reduced-motion overrides; runtime timing is not inferred.",
    entries: [
      keep(".site-header", "Header owner lock.", "family"),
      keep(".magazine-hero", "Hero owner lock.", "family"),
      keep(".atlas-experience-surface", "Stage 4 transition architecture is locked.", "family"),
      keep(".literary-globe", "Stage 4 Canvas interaction is locked.", "family"),
      keep(".ui-action", "Shared micro-interaction contract uses motion tokens.", "family"),
      keep(".ui-icon-button", "Shared micro-interaction contract uses motion tokens.", "family"),
      tune(".editorial-grid article", "500 ms media hover exceeds the future standard UI tier.", "family"),
      tune(".community-reading-notes button", "Review decorative hover motion with quiet-idle policy.", "family"),
      tune(".article-reader-cover", "Reader media motion is longer than standard UI motion.", "family"),
      keep(".article-reader-loading span", "Loading indicator is functional, not idle decoration.", "family"),
      keep(".ui-action__spinner", "Functional loading state has an explicit reduced-motion override.", "family"),
    ],
  },
  "card-families": {
    title: "Card families",
    scope:
      "Homepage, archive, reader, writer, community, and trust card-family declarations.",
    entries: [
      tune(".book-of-day", "Book Month remains primary but proportions need Stage 5C polish.", "family"),
      tune(".book-fact-card", "Editorial insert proportions need Stage 5C polish.", "family"),
      tune(".editorial-standard", "Proof block belongs to the Book Month composition.", "family"),
      tune(".editorial-grid article", "Editorial article cards need shared family rhythm.", "family"),
      tune(".article-library-grid article", "Article Library cards need shared family rhythm.", "family"),
      tune(".community-reading-notes button", "Three prompts require equal height/padding/baselines.", "family"),
      fix(".author-showcase article", "Stage 5C explicitly requires overly tall author cards to be fixed.", "family"),
      fix(".section-directory-card", "All section landmarks must align on the same row.", "family"),
      tune(".calendar-card", "Calendar card joins the normalized editorial family.", "family"),
      tune(".trust-center details", "Trust disclosures need consistent terminal-section rhythm.", "family"),
      keep(".engagement-card", "Reader engagement is a functional nested card.", "family"),
      keep(".book-archive-section", "Book Archive is baseline-only through Stage 5C.", "family"),
      keep(".writer-detail", "WriterPanel is a separate functional detail surface.", "family"),
    ],
  },
});

export const sectionLandmarkRegistry = Object.freeze([
  ["card", ".section-directory-card"],
  ["content", ".section-directory-card > div"],
  ["eyebrow", ".sections-directory .section-card-eyebrow"],
  ["title", ".sections-directory h3"],
  ["description", ".sections-directory > div:last-child p"],
  ["series-slot", ".section-card-series-slot"],
  ["series", ".section-card-series"],
  ["latest-slot", ".section-card-latest-slot"],
  ["latest", ".section-card-latest"],
  ["divider", ".section-card-latest::before"],
  ["footer", ".section-card-action"],
  ["CTA", ".section-card-action > a"],
  ["arrow", ".section-card-action i"],
  ["bottom", ".section-card-action"],
]);

export const homepageOrderRegistry = Object.freeze([
  ["Hero", 'className={`magazine-hero'],
  ["Globe", 'className={`atlas-section'],
  ["Book Month", 'className={`daily-grid'],
  ["Book Archive", "<BookArchiveSection"],
  ["Featured Journal", 'className={`editorial-section'],
  ["Article Library", "<ArticleLibrarySection />"],
  ["Community", 'className={`community-section'],
  ["Authors", 'className={`authors-section'],
  ["Sections", "<SectionsDirectory"],
  ["Trust", 'className={`trust-center'],
  ["Calendar", 'className={`calendar-section'],
  ["Footer", '<footer className="site-footer">'],
]);

export const targetStage5cOrder = Object.freeze([
  "Article Library",
  "Authors",
  "Sections",
  "Calendar",
  "Community",
  "Trust",
  "Footer",
]);

export const ownerLocks = Object.freeze([
  {
    id: "HEADER-001/002",
    decision: "KEEP",
    selectors: [".topline", ".site-header", ".mobile-nav"],
    source: "src/App.tsx + src/index.css",
  },
  {
    id: "HERO-001/002",
    decision: "KEEP",
    selectors: [".magazine-hero", ".hero-editorial", ".hero-cover", ".primary-action"],
    source: "src/App.tsx + src/index.css",
  },
  {
    id: "STAGE4-GLOBE",
    decision: "KEEP",
    selectors: [".atlas-section", ".atlas-experience-surface", ".literary-globe"],
    source: "Stage 4 Globe components + src/index.css",
  },
  {
    id: "AUTHOR-TEXT",
    decision: "KEEP",
    selectors: [".article-reader-content"],
    source: "article data/CMS + ArticleReader",
  },
  {
    id: "BOOK-ARCHIVE-5A-5C",
    decision: "KEEP",
    selectors: [".book-archive-section"],
    source: "BookArchiveSection",
  },
]);

export const runtimeObservedFindings = Object.freeze([
  {
    id: "A11Y-FORCED-COLORS-GLOBAL-SEARCH-FOCUS",
    selector: ".global-search-trigger",
    decision: "FIX",
    targetStage: "Stage 5F",
    ownerLock: "HEADER-001/002",
    environment: "forced-colors: active",
    state: "focus retained",
    viewport: "desktop + mobile",
    locale: "NOT REPORTED",
    computed: {
      outlineStyle: "none",
      boxShadow: "none",
    },
    finding:
      "The control keeps focus, but neither an outline nor a box shadow supplies a visible forced-colors focus indicator.",
    evidence:
      "Runtime forced-colors baseline reported by the Stage 5A browser audit.",
  },
]);

export const visualViewportRegistry = Object.freeze([
  ...[320, 360, 390, 430, 768, 1024, 1280, 1440, 1920].map((width) => ({
    locale: "RU",
    viewport: `${width}px`,
  })),
  { locale: "RU", viewport: "1366x700" },
  { locale: "RU", viewport: "1366x768" },
  ...[360, 768, 1440, 1920].map((width) => ({
    locale: "EN",
    viewport: `${width}px`,
  })),
]);

export const visualCloseupRegistry = Object.freeze([
  "Header",
  "Hero",
  "Globe",
  "Book area",
  "Book Archive",
  "Article Library",
  "Community",
  "Authors",
  "Sections",
  "Calendar",
  "Trust",
  "Footer",
  "WriterPanel",
  "ArticleReader",
  "GlobalSearch",
  "Follow Writer",
  "RU/EN book detail",
  "Reading library",
]);

export const visualStateRegistry = Object.freeze([
  "default",
  "hover",
  "focus",
  "active",
  "loading",
  "empty",
  "error",
  "expanded",
  "selected",
  "disabled",
  "mobile sheet",
  "reduced motion",
  "200% zoom",
  "forced colors",
]);
