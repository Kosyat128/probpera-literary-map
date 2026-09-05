# Controlled Web/PWA architecture

This is an internal description of the implementation under review in S03. It is
not stage acceptance, a production release claim, or an owner approval. Generated
artifacts have `releaseReady: false`; production actions remain prohibited.
The separate [known gaps](evidence/S03/known-gaps.json) record distinguishes
implemented foundations from work and evidence still required.

The current-stage inputs are [content delivery and offline sync](requirements/v12/18_CONTENT_DELIVERY_OFFLINE_SYNC_RU.md),
[visual canon](requirements/v12/21_VISUAL_UX_CANON_RU.md),
[accessibility, localization and audio](requirements/v12/22_ACCESSIBILITY_LOCALIZATION_AUDIO_RU.md),
[performance and device reliability](requirements/v12/23_PERFORMANCE_RELIABILITY_DEVICE_MATRIX_RU.md),
and the shared [bilingual language contract](requirements/v12/119_BILINGUAL_PRODUCT_LANGUAGE_CONTRACT_RU_EN.md).
This document does not certify requirements routed to later stages.

## Canonical application and ownership

[main.tsx](../../src/main.tsx) mounts the existing [App](../../src/App.tsx).
The controlled edition wraps that same App with a license boundary. It does not
introduce another globe, renderer, catalog, account database, or locale owner.
The narrow [canonical domain facades](SHARED_SITE_EXTRACTION.md) preserve existing
record references and writer/work identity keys. Their demand-loading boundaries
remain part of the build graph.

Canonical main through `f406a7de` is incorporated locally with accepted S00-S02
history preserved. WriterPanel receives the same `verifiedBookArchive` reference
as the bookshelf and search, including reviewed canonical enrichment. Country,
writer and work IDs are retained; idle/loading/error/retry never fall back to raw
work records. Actual offline RU/EN tests exercise the Dostoevsky record that
previously differed between the writer panel and enriched catalog.

The controlled edition does not mount the remote news feed or start published
dossier transport. Public dossier transport still includes locale in request
identity, while reader choices belong to the same book across locale changes.
Book-scoped navigation and response/timer cleanup prevent cross-book or late
locale responses from replacing current content. The local dossier fallback is
not promoted to a reviewed paid dossier or a completed offline content package.

One Web platform adapter is created outside React rendering and injected through
the existing platform services provider. One
[InterfaceLanguageProvider](../../src/i18n/InterfaceLanguage.tsx) owns RU/EN.
[PwaEdition](../../src/pwa/PwaEdition.tsx) keeps its runtime stable;
[PwaAccessBoundary](../../src/pwa/PwaAccessBoundary.tsx) does not use locale as a
license-controller identity. Language metadata effects neither replace App nor
dispatch navigation events. A confirmed denial or expired proof can close the
licensed scene; scene preservation is not permission to retain revoked access.

In the controlled distribution, main skips the site's CMS edit document,
direct-edit bridge, analytics startup, diagnostics, consent tracking and root
service-worker registration. The canonical AuthProvider remains in the shared
tree; this is not evidence that the new license identity is integrated with a
production account service. The controlled build does not configure the site's
Supabase, Turnstile or analytics credentials.

## Two distributions, shared product

| Artifact | Entry routes | Application and metadata |
| --- | --- | --- |
| Existing public site, `dist/` | `/`, `/ru/`, `/en/`, existing journal routes; RU/EN account and deletion routes | Canonical App and existing public manifest. Account pages reuse the canonical account provider without mounting the globe. |
| Controlled preparation, `dist-pwa/` | `/planet/`, `/planet/ru/`, `/planet/en/` | Same App, local built runtime, license boundary, dedicated worker scope and one manifest identity `/planet/`. |

[vite.pwa.config.ts](../../vite.pwa.config.ts) extends the canonical Vite config
with base `/planet/`, a separate output directory, `publicDir: false` and a Vite
manifest. [build-pwa.mjs](../../scripts/mobile/build-pwa.mjs) assembles a checked
local staging directory and copies selected canonical assets with source paths
and SHA-256 provenance. It does not copy a public directory wholesale or generate
a second journal/CMS tree. The packaging script is not a deployment command.

[pwa-artifact.mjs](../../scripts/mobile/pwa-artifact.mjs) derives the essential
closure from the actual Vite graph: the entry, canonical catalog, LiteraryGlobe,
WriterPanel, GlobalSearch, BookArchiveSection and the existing landing sections,
with their static imports, CSS and assets. Canonical
default antique textures, country flags, fonts and selected brand assets complete
the offline bootstrap. Other available globe textures are copied for demand use.
Optional book/content/edition downloads are not a completed package manager.
Two install icons are resized from the existing canonical logo with explicit
transformation provenance; no writer portrait is generated.

The output includes `artifact.json`, `bootstrap-integrity.json`,
`asset-provenance.json`, public `license-authority.json`, local `sw.js` and `_headers`.
The build identifier binds the declared files, source HEAD, current source-input
hash, worker source hash, public authority fingerprint and any rollback anchor.
The builder rejects changes to source inputs or copied canonical public assets
during the build. Source HEAD alone does not prove a clean worktree or an exact
release candidate. The independent artifact auditor reconstructs the inventory,
bootstrap and provenance checks against the current checkout. `_headers` expresses
the intended CSP and cache policy; the draft Worker also sets these response
headers explicitly. Real production hosting remains unverified.
The controlled CSP permits local runtime resources and excludes remote scripts
and network API origins. Blocking a remote image by CSP does not prove that the
application never attempted that request; browser request evidence is separate.

## Locale URLs and startup

[pwa-shell.mjs](../../scripts/mobile/pwa-shell.mjs) produces RU/EN startup pages,
localized manifests, a neutral root entry, static recovery pages and local CSS.
Every manifest has the same `id` and `scope`, `/planet/`; localized start URLs do
not create separate installed apps. The compact canonical logo, safe-area layout
and orange `#f67518` use existing brand assets. These pages contain no inline
JavaScript or remote runtime. Controlled pages remain `noindex, nofollow`.

Direct RU/EN pages set `data-route-language` before React starts. Resolution is:
valid direct route, valid stored language, then browser preference for the
controlled edition. The first valid browser language selects RU only when its
base language is `ru`; other valid languages and the unsupported/empty fallback
select EN, as required by the language contract. Malformed tags are ignored.
The neutral root does not force a route language. The public site's existing
default behavior and SSR behavior remain separate from this browser fallback.

[PwaLocaleMetadata](../../src/pwa/PwaLocaleMetadata.tsx) updates the controlled
locale path, document language, title, canonical, reciprocal hreflang, social
metadata and manifest through the existing provider.
[PublicLocaleMetadata](../../src/i18n/PublicLocaleMetadata.tsx) performs the
corresponding operation only on the new public `/ru/` and `/en/` home routes.
Both share the narrow [head helper](../../src/i18n/headMetadata.ts). They preserve
`history.state`, search parameters and fragment with `replaceState`; they do not
emit `popstate`, reload the document, or manipulate Canvas. Root public and
article routes retain their previous navigation behavior.

[public-locale-pages.mjs](../../scripts/mobile/public-locale-pages.mjs) generates
the two public locale homes from the built canonical homepage, retaining its
module references and existing public manifest identity. The
[writer](../../scripts/mobile/write-public-locale-pages.mjs) is invoked by the
[domain build](../../scripts/build-domain-release.mjs). Static fallback copy uses
existing interface strings; article pages and CMS content are not translated by
this helper. New homes have self-canonicals and reciprocal hreflang with root
`x-default`, but remain `noindex, follow` and excluded from the indexable sitemap.
`releaseReady: true` is rejected. The generated localized WebPage JSON-LD keeps
one canonical WebSite identity. Localized static 404 pages and preparation sitemap
records explicitly retain the indexing hold. Four additional public account and
deletion pages use the same built application assets and remain noindex. Public
indexing is still an open release gate.

Canonical public hosting remains GitHub Pages. The separate
[localized404 handler](../../server/public-locales/handler.mjs) replaces only an
actual HTML404 from that origin with the exact generated RU/EN error body. Its
bound `dist-public-locales/` artifact stays outside the Pages upload; draft
configuration has no routes and no deployment. Workerd/HTTP tests verify the
prepared handler, not a change to production hosting.

[articleRoutes](../../src/utils/articleRoutes.ts) sends controlled journal links
to canonical `https://probpera.ru` routes. Programmatic journal navigation does
not push a cross-origin history entry or open a second local reader. User-driven
outbound journal navigation is distinct from a forbidden remote WebView runtime.

## Signed access proof and account trust

[WebLicense](../../src/platform/adapters/web/WebLicense.ts) verifies an ES256
compact signed assertion using configured P-256 public keys. Exact schemas,
duplicate-key rejection, issuer/audience/product/subject binding, signature,
status and time checks reject malformed, mismatched or expired assertions. The
purchase model is one-time payment; `exp` is the access-proof refresh deadline,
not a subscription invented by the client. `offlineUntil` imposes a separate
signed offline deadline. Only signed bytes are cached, not an editable paid flag.

[PwaLicenseRuntime](../../src/pwa/PwaLicenseRuntime.ts) first requests identity
from same-origin `POST /planet/api/license/identity`. The Web license client uses
same-origin `POST /planet/api/license/session`. Both use credentials, no-store
requests, reject redirects and bound pending work. The saved identity is
independent of the receipt subject; a receipt cannot select its own verifier
identity. Identity changes and observed denials invalidate the prior context.
Online transport failure requires an explicit offline verification path; it does
not convert a denial into authorization.

The server implementation now lives in [server/planet](../../server/planet/api.ts),
outside the browser dependency graph. It provides the encrypted session bridge,
identity and signed-proof endpoints, canonical sign-out, deletion-request handling
and a verified-payment provider port. The port accepts a payment only after its
configured server verifier authenticates the original bytes; no production
provider is configured. The default build has no production license authority
and cannot manufacture one. An explicit loopback QA authority accepts only a
public verification key in checked local configuration; QA assertions and browser
fixtures are not evidence of a real purchase.

The canonical account and editorial store is Supabase/Postgres. The reader uses
[AuthContext](../../src/community/AuthContext.tsx) and the lazy
[Supabase client](../../src/lib/supabase.ts); CMS uses the
[server client](../../apps/admin/lib/supabase/server.ts) with staff membership and
MFA checks. The checked-in public/admin workflows reference the same Supabase
connection secret names. [The admin Worker configuration](../../apps/admin/wrangler.jsonc)
has a catalog KV binding, not a D1 account database. New server foundations must
reuse the existing `auth.users.id` and canonical migrations. This source review
does not certify the live database configuration.

The public browser session is bridged explicitly, without making readers CMS
staff. The [Supabase adapter](../../server/planet/supabase.ts) uses the existing
project to verify signed claims, the current Auth user and the matching live Auth
session. Its AES-GCM cookie binds that token, subject, session ID, epoch and expiry;
the browser cannot set a paid flag. The canonical
[migration](../../supabase/migrations/20260905_literary_planet_web_license.sql)
stores verified events, receipt state, session epochs and deletion requests beside
the existing users. Service-only RPCs enforce idempotency, transaction ownership,
terminal refunds/revocations and access blocking. Access is checked again after
asynchronous signing and recent-authentication verification.

[PlanetAccountPage](../../src/pwa/PlanetAccountPage.tsx) implements public RU/EN
restoration and deletion-request pages through the existing AuthProvider and
CommunityHub. Subject changes invalidate pending operations; return paths are
restricted to canonical controlled routes. The account page loads lazily and
does not start the globe, analytics or CMS edit integrations.
[Password recovery](../../src/pwa/passwordRecovery.ts) uses the canonical Auth
service and signed recovery-session claims. The password update is bound to the
verified token, followed by global sign-out and a clear result if sign-out cannot
be confirmed. Real email delivery and project redirect configuration are external
checks, not results of local fixtures.

Deletion requires verified recent authentication and an explicitly configured
synchronized RU/EN disclosure. Without that disclosure, submission stays disabled.
A successful request atomically blocks paid access and returns status `requested`;
it does not claim the account was deleted. The server-only
[reader processor](../../server/planet/deletionProcessor.ts), its existing-project
[Supabase SDK adapter](../../server/planet/deletionProcessorSupabase.ts) and
[guarded SQL](../../supabase/migrations/20260906_literary_planet_reader_deletion_processor.sql)
now implement request leases, ownership/schema checks, avatar cleanup and Auth
deletion with verifiable completion/retry. Private view cleanup targets the
exact user ID, preserves guest/other-reader rows sharing a session and rolls
back with a failed Auth transaction. Provider and request ledgers retain their
records with nullable subject references; this is not anonymization.

The executable [operator tool](../../scripts/mobile/process-reader-deletion.mjs)
defaults to dry-run without transport. Real processing requires an explicit
request ID, reviewed policy input, server credentials and separate authorization.
No production policy instance, execution or automated scheduler is enabled.
Accounts with public contributions, editorial/staff references or unsupported
linked data remain blocked; the safe-reader path does not certify general
account erasure. The synchronized
[RU/EN disclosure draft](ACCOUNT_DELETION_DISCLOSURE_DRAFT_RU_EN.md) maps these
facts and unresolved decisions without inventing retention periods or approval.

The [draft Cloudflare adapter](../../server/planet/worker.ts) assembles the server
using explicit bindings and serves only the controlled local assets. Private
signing and service keys never enter the browser build. Missing configuration
fails closed; the draft has no production routes or deployment commands. Local
tests exercise real signatures, encryption, the installed Supabase SDK and the
actual migration in PGlite PostgreSQL. Its single connection does not establish
multi-connection lock behavior or validate a live production database.

Identity and proof storage are namespaced by authority/product and subject.
`localStorage`, CacheStorage and the verifier still share the site's origin.
A URL path or worker scope is not a security origin. Signatures prevent receipt
forgery under the configured key; they do not provide hardware device binding,
protection from an origin compromise, or trustworthy anti-copy storage. Browser
storage may be unavailable, evicted or cleared. A safe-storage memory fallback
does not promise persistence after restart. Offline operation cannot learn of an
unseen server revocation before reconnection or proof expiry. Clock safeguards
within a live controller do not establish a hardware-backed clock across reloads.

## Offline install and explicit update

[serviceWorkerRuntime](../../src/pwa/serviceWorkerRuntime.js) accepts only the
declared same-origin `/planet/` inventory. The essential core is bounded to 512
files, 16 MiB per file and 64 MiB total. Downloads have a deadline and require
matching byte length, SHA-256, response type and MIME. Authorization-bearing
requests, private/API paths, arbitrary queries and undeclared assets are not
admitted. Exact recorded `?v=` asset aliases are supported; this is not a broad
`ignoreSearch` cache. Locale navigation permits only bounded recognized
selection parameters and fragments.

A candidate receives a COMPLETE marker only after its entire core verifies.
Activation revalidates the candidate and retains one previous intact activated
generation. Cleanup targets only owned `literary-planet-pwa-v1-` generations.
The [public site worker](../../public/sw.js) skips `/planet/` and removes only its
known legacy site cache names. Cache namespaces protect cooperative cleanup;
they do not isolate either worker from hostile code running on the same origin.

Serving rechecks cached bytes. A missing or corrupt entry can be repaired only
from a response matching the current declared hash. Failure does not mix files
from different builds. A failed candidate leaves the previous active worker
usable. A user-facing rollback protocol now verifies a complete compatible prior
application generation before selecting it atomically. It requires the same
authority fingerprint and a declared prior-manifest hash; late requests and new
documents are fenced against generation mixing. The current worker engine stays
installed while the entire prior application bootstrap is selected. This is not
an offline replacement of the worker binary. The precise protocol and limits are
recorded in [PWA_ROLLBACK_PROTOCOL.md](PWA_ROLLBACK_PROTOCOL.md).

[registerPwaWorker](../../src/pwa/registerPwaWorker.ts) registers the exact local
script and scope only on supported controlled routes over HTTPS, or explicit
loopback QA. Update readiness and activation use bounded correlated messages,
validated worker/client identities and a complete candidate. Activation is an
explicit user action. Updates reload only after confirmed controller change;
rollback reloads only after its correlated, accepted selection acknowledgement.
Multiple controlled windows prevent rollback. Locale and network changes do not
independently trigger reloads. Transitive rollback targets are not guessed when
an intermediate engine already selected a different prior application.

The bootstrap can support an already authorized offline core. It does not claim
that every optional content item, book cover, audio file, edition or search
package is available offline. First-use installation and access proof acquisition
still require successful delivery and account/merchant integration.

## Open validation and editorial work

[pwaCopy](../../src/pwa/pwaCopy.ts) and the update messages in
[PwaConnectivity](../../src/pwa/PwaConnectivity.tsx) explicitly mark newly authored
RU/EN copy as draft. Existing shell strings do not constitute a new human review
of the whole English catalog. Reviewed legal/purchase/offline/child copy, full
accessibility evidence and complete content packages remain release work.
Programming and translation work stay with implementation; owner evidence is
requested only for concrete authority, rights, account or approval decisions.

A focused fixture verified a missing freshness check in the existing
[article locale selector](../../src/data/articles/localization.ts): an approved
English fixture with a deliberately mismatching `sourceContentHash` was still
selected. The existing [article builder](../../scripts/build-article-pages.mjs)
also checks release status and content presence without directly comparing that
hash at its English release predicate. This is evidence of an absent check in
those inspected gates, not evidence that a production article is currently stale.
Upstream freshness enforcement and actual catalog staleness require their own
audit; the fixture did not change editorial data or approval status.

The earlier local QA artifact passed 12 actual desktop/mobile browser scenarios,
including offline/reconnect and the same live R3F scene across RU/EN. Current
account, recovery, rollback and offline-catalog edits require a fresh artifact and
regression before S03 acceptance. Real built-browser checks must establish offline/reconnect behavior, license
denial/deadlines, update lifecycle, failed install preservation, request boundaries
and the same live scene across RU/EN changes. A local QA build and test screenshots
are not exact-RC store screenshots, accessibility certification, or production
readiness. Native clients, child isolation, general download management, audio
packages, production legal review and final handoff are not completed by this
PWA foundation. No acceptance decision is recorded in this document.
