# Canonical account deletion: source audit, 2026-09-05

Actual processing is not implemented yet. The current server accepts a reauthenticated request and blocks Web licensing; the status recovery work belongs to the canonical agent. This is not account deletion completion. No production connection, Auth mutation or Storage deletion was performed.

The local proof is `account-deletion-constraint-repro.mjs` / `.json` in this directory. It executes verbatim selected public DDL in PGlite with an explicitly minimal `auth.users` fixture. It does not establish deployed migration parity or test the hosted Auth Admin API.

Run the script from the repository root. Its new output goes to
`.tmp/worker-review/account-deletion-constraint-repro.json`; the committed JSON
beside this report remains the recorded historical finding, not a mutable latest
result or stage acceptance. The current source base is `0a348bd4`; newer upstream
schema additions must also be inspected before implementing deletion processing.

## Confirmed ordinary-reader blockers and collateral effects

| Source | Behavior |
| --- | --- |
| `supabase/schema.sql:37–48`, `:365–424`; `supabase/migrations/20260727_community_safety.sql:73–86` | `article_comments.author_id ON DELETE SET NULL` conflicts with `CHECK(author_id IS NOT NULL OR guest_name IS NOT NULL)`. The canonical authenticated comment RPC writes `guest_name = NULL`. A reader with such a comment cannot be removed: local PostgreSQL `23514`, `article_comments_check`. |
| `supabase/schema.sql:51–61`, `:181–187`, `:270–313` | `ratings.user_id SET NULL` can violate partial `ratings_guest_unique_idx(subject_type,subject_id,session_id) WHERE user_id IS NULL`. The actual `rate_content` RPC independently stores guest and authenticated ratings; it does not merge the earlier guest row. Local paired-row proof: `23505`, `ratings_guest_unique_idx`. |
| `supabase/migrations/20260801_reader_profiles_and_forum_votes.sql:151–209`; `src/community/CommunityHub.tsx:827–860` | Ordinary readers can own `avatars/<user UUID>/avatar.<extension>` Storage objects. Profile deletion does not remove the blob. All owned objects and obsolete avatar extensions need bounded discovery and Storage API removal; never follow an arbitrary `avatar_url`. |
| `supabase/schema.sql:16–34` | Deleting a profile cascades its forum topics, then all replies to those topics, including other readers' replies. Local proof removed the other reader's reply. Deleting an article comment also cascades its child comments through `parent_id`; a cleanup must account for other authors' replies. |
| `supabase/migrations/20260801_reader_profiles_and_forum_votes.sql:16–128`; `20260801_forum_reports.sql:4–17` | `community_votes.subject_id` and `forum_reports.subject_id` are polymorphic UUID fields without target FKs. Deleted subjects can leave other users' vote/report records, including copied report title/excerpt. Vote scores and profile reputation are maintained by `vote_forum_item`, not delete triggers; direct cascades require aggregate reconciliation. These are source findings, not an executed full migration proof. |

`profiles`, reader favorites, book collections/items/favorites, progress, subscriptions, notifications and the reader's votes already have user/profile CASCADE relations. A bare-reader fixture deletes its profile successfully. Sources: `supabase/schema.sql:6–14,79–163`; `20260802_reader_journey.sql:14–96`; `20260827_reader_book_collections.sql`; `20260801_reader_profiles_and_forum_votes.sql:16–26`.

`content_views`, `client_errors`, ratings and moderation records with SET NULL retain session identifiers, text or event context after the identity link is removed. Nulling the FK alone must not be described as erasing every related datum. The actual retention/scrubbing policy is still required.

## Staff and editorial boundaries

`staff_memberships.user_id` is CASCADE (`20260728_cms_foundation.sql:37–42`). Last-owner and self-removal checks live in `owner_set_staff_member` / `owner_remove_staff_member`, with advisory transaction lock `(188654771,1)` (`20260901_zz_staff_owner_invariant.sql:20–156`). The admin UI invokes those RPCs (`apps/admin/app/(dashboard)/settings/actions.ts:32–73`).

Auth Admin deletion does not invoke those owner RPCs. The source has no last-owner DELETE trigger on `auth.users` / `staff_memberships`. The local minimal-auth fixture consequently deletes the only owner and leaves owner_count=0. A reader processor must explicitly refuse any staff membership and non-reader community role; it must also handle concurrent promotion under the same owner guard. Do not silently reassign ownership or assume CASCADE enforces this invariant.

Existing references that independently prevent removal of present or former editorial contributors:

| Migration | Tables / user columns with `ON DELETE RESTRICT` |
| --- | --- |
| `20260728_cms_foundation.sql:109–340` | `media_assets.uploaded_by`; `articles.created_by/updated_by`; `pages.created_by/updated_by`; `homepage_blocks.updated_by`; `banners.created_by/updated_by`; `redirects.created_by`; `publication_jobs.created_by`. |
| `20260808_article_translations.sql:23–51` | `article_translations.created_by/updated_by`. |
| `20260830_zz_site_typography_engine.sql:5–149` | `font_assets.uploaded_by/deleted_by`; `site_typography_overrides.created_by/updated_by/published_by`; `site_typography_revisions.created_by`. |
| `20260901_zz_site_studio_engine.sql:401–601` | `site_design_tokens.created_by/updated_by/published_by`; `site_design_change_sets.created_by/updated_by/submitted_by/approved_by/published_by/cancelled_by`; `site_design_change_set_items.created_by/updated_by`; `site_design_releases.created_by`; `site_design_token_revisions.created_by`. |
| `20260901_zz_translation_operations.sql:6–20` | `translation_jobs.requested_by`. |
| `20260902_article_working_drafts.sql:4–12` | `article_working_drafts.actor_id`. |

Some references are nullable, but still RESTRICT while populated. These must be detected from the actual database constraint catalog before enabling processing, including unknown newer relations. Do not delete canonical editorial assets or rewrite immutable authorship/history as a workaround. SET NULL revision/audit actor references can still leave original identifiers or names inside JSON snapshots/metadata; field-level retention needs a separate inventory.

## Minimal processing that can be implemented and tested locally now

1. Add a server-only processor and service-only claim/preflight RPC. Obtain the target UUID exclusively from a locked `planet_deletion_requests` row. Use an idempotent claim/lease and resumable steps, not an arbitrary client UUID. Default processing remains disabled when no reviewed cleanup/retention configuration is supplied.
2. Preflight verifies current schema/constraints, reader role, no staff membership or editorial RESTRICT rows, exact owned Storage objects, comment/thread dependencies and retained records. Recheck under transaction locks before mutations. Coordinate the staff advisory lock and a guard against promotion of a deletion-pending user; a read followed by a separate Auth API call is not atomic.
3. Freeze writes for a deletion-pending user across relevant canonical RPCs/RLS and Storage uploads before cleanup. Current `planet_access_state.access_blocked_at` only blocks the Web licensing API; it is not a site-wide auth/write prohibition. Existing JWTs remain usable until expiry unless the relevant operation checks live session/pending state. A temporary ban alone is not the required fence.
4. Apply the configured reader-data strategy transactionally. Resolve comment constraints and rating collisions; preserve or explicitly account for other authors' content; remove orphan polymorphic rows and reconcile aggregates. Do not guess an anonymous author label or erase an entire shared thread implicitly.
5. Remove only verified owned objects through the Storage API in bounded batches and verify their absence. Storage and Auth HTTP mutations cannot share one PostgreSQL transaction: persist step outcomes, retry safely after timeouts, and treat unknown outcome as unresolved.
6. Use the existing canonical server service-role client `auth.admin.deleteUser(userId, false)` after successful preflight/cleanup. Recheck actual absence of user, sessions, profile and scoped Storage data. A transient HTTP failure is not evidence of either deletion or non-deletion; inspect state before retrying.
7. Only then record `completed` through `planet_record_deletion_outcome` with a digest of minimal non-PII evidence. Keep its existing guard requiring `user_id IS NULL`; do not null that field manually to manufacture completion. Interrupted cleanup remains processing/blocked with bounded reason codes. The completed receipt is not a public account-enumeration endpoint.

Current hooks: `server/planet/supabase.ts:103` calls only `planet_request_account_deletion`; `server/planet/api.ts:257` returns an accepted request. `supabase/migrations/20260905_literary_planet_web_license.sql:274` records outcomes but has no processing caller. New commerce events/receipts/deletion requests use SET NULL; access state uses CASCADE. They are not permanent FK blockers. Retained provider transaction identifiers still require an explicit policy.

The missing processor, claim/lease, mutation fences, preflight, cleanup, verification, retry and tests are internal engineering work that can be prepared locally. Policy/owner decisions are the documented treatment of public contributions/other readers' replies, editorial/audit material, provider records and other retained diagnostics; synchronized RU/EN disclosure and any retention durations must follow that decision. No approval or legal retention period is inferred here. Live migration parity, host credentials and deployment approval remain external release checks; they do not prevent local implementation and test preparation.

## Official source refresh

Accessed 2026-09-05: [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data) documents Storage ownership blocking Auth deletion, hard deletion removing refresh sessions, and the remaining JWT expiry window. [Auth Admin deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) is the canonical server operation. [Storage object deletion](https://supabase.com/docs/guides/storage/management/delete-objects) requires Storage API removal; deleting SQL metadata alone leaves blobs orphaned (batch remove limit: 1000).
