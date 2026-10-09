# Native daily preparation

The private Worker is `probpera-literary-news-preparation`, configured by
`scripts/wrangler.literary-news-preparation.jsonc`. Its public request handler always
returns 404. The fixed Cron invokes one `DailyNewsPreparationCoordinator` SQLite
Durable Object. The coordinator owns approved daily profile and annual ledger writes;
scheduled GitHub delivery/media Actions only collect snapshots and deliver existing
reviewed items. A separate guarded deployment workflow can activate the native
coordinator after its verification checks pass.

The default configuration disables preparation. Activation requires the existing AI
and `NEWS_STATE` bindings, `NEWS_AUTOMATION_WRITER=native`, and an explicit bootstrap
for an absent owner/fence. Bootstrap validates any existing ledger and public profile
before establishing the first fence. It never resets an existing fence or accepts a
corrupt profile. Once initialized, leaving bootstrap enabled does not bypass hashes.

Each half-hour run checks up to 32 rotating registered sources and 10 article pages,
using at most 48 external source requests including redirects. Source requests use
the fixed HTTPS registry, reject credentials/IP literals/unregistered ports and
cross-origin redirects, and bound response streams to 1 MiB for listings or 512 KiB
for details. Pool concurrency is four; discarded response bodies are closed.

Only reviewed, frozen source profiles may set their own `listingMaxBytes` or
`detailMaxBytes`: each must be a positive safe integer capped at 2 MiB. The measured
Asymptote and Liechtenstein National Library detail pages are examples of this narrow
exception; profiles without overrides retain the defaults. Both fields are validated before any
request, and a redirect rechecks the matched destination profile. Caller `maxBytes`
cannot change the bound. HTML and bytes are transient parser input; details do not
retain raw bytes or persist HTML. The exception leaves request budgets, deadlines,
host checks and concurrency unchanged, consistent with the [Workers streaming and
memory guidance](https://developers.cloudflare.com/workers/platform/limits/#memory).

Only exact source publication metadata within seven days is eligible. Up to five
eligible candidates can enter the shared two-pass grounded RU/EN engine per run.
Both provider calls use the existing Cloudflare AI binding and a 45-second abort
signal. Durable budgets reserve calls before inference: 40 draft requests and 80
provider calls per Moscow day. Admission stops at 10 distinct accepted stories per
day from October 9; earlier ledger days retain their original limit of 15. The shared admission window is 2026-09-29 inclusive to 2027-09-30 exclusive.
Provider quota/rate errors stop further inference and retain prior checkpoints.

Source OG/Twitter thumbnails remain display-only. They do not authorize social
reuse. New social posts still require separately validated image rights, bytes,
attribution and destination policy; the default automation report explicitly holds
unverified photos. Photo materialization uses the separate Node media runner and
private KV bytes; this preparer does not write Supabase Storage or send Telegram.

## Storage recovery

The Durable Object stores a seven-minute lease, the expected ledger SHA, a
pending ledger SHA, a pending public-profile SHA, and the latest claimed half-hour slot. The annual content stays in
the fixed private KV keys. Each ledger write stages its exact digest transactionally,
writes KV, then confirms the digest. Publication stages the validated public profile
digest before KV PUT as well, so a late PUT remains fenced after lease expiry.

If a write succeeds but its confirmation is lost, a later run recovers only when KV
returns the exact staged digest. An old KV value may be stale: it cannot clear a
pending digest. A differing digest, corrupt content, or unresolved pending write
fails closed and retains the fence. A truly failed ambiguous KV write can therefore
require operator recovery; automated rollback would risk deleting accepted content.

Recovery must first disable native preparation and wait at least eight minutes for
the active lease/run to drain. Preserve both KV values and the small fence before
changing anything. Read and validate the actual ledger/profile using the shared
validators, compare their exact digests with the staged and expected digests, and
recover a verified staged value whenever it exists. Clearing a pending digest is
permitted only with independent proof that the staged write cannot later complete;
an old KV GET alone is insufficient proof. There is no public reset endpoint or
automatic reset command.

The Node fallback writer requires separate explicit authorization, a native-off
and drained owner record, and the existing `--offline-owner-authorized` gate. Its
successful writes intentionally invalidate the prior native expected digest. Before
returning ownership to native, an operator must verify the preserved fallback
ledger/profile and transfer their exact digest to the small fence while native
remains disabled. Bootstrap cannot silently perform that transfer.

## Verification limits

On 2026-10-02, the intended GitHub token reached the real native AI binding in run
`36955958406`; the draft request stopped with `ai_quota_exceeded`. Preparation was
left disabled. This result establishes the initial quota stop, not successful
draft/review execution or a continuous supply of new stories.

The explicit delivery-only deployment keeps `NEWS_AUTOMATION_ENABLED=false`,
`NEWS_AUTOMATION_BOOTSTRAP=false` and `NEWS_AUTOMATION_WRITER=native`, while setting
`NEWS_DELIVERY_ENABLED=true`. Delivery uses the existing reviewed feed and its
eligible records, spacing and receipt checks. It does not invoke AI preparation,
generate replacement stories or transfer ledger ownership to another writer. Both
Cron schedules stay unchanged; the disabled preparer performs no scheduled work.

After this deployment, `node scripts/verify-native-news-workers.mjs
--expect-delivery-only` checks the two Workers' settings and schedules with exactly
four read-only GETs. It requires preparation/bootstrap off and delivery on, rejects
conflicting expectation flags, and prints only approved operational fields. These
configuration checks do not prove a Telegram receipt or guarantee future feed
availability. Returning to full preparation requires restored provider capacity
and a successful two-protocol activation check; a quota error must not be bypassed.

The owner authorized automatic retry after the next intended UTC quota reset.
`LITERARY_NEWS_NATIVE_PREPARATION_AUTO_RESUME=true` enables the daily deployment
check at 00:07 UTC (03:07 Moscow), with the earliest allowed instant fixed by
`LITERARY_NEWS_NATIVE_PREPARATION_RESUME_AFTER=2026-10-03T00:00:00.000Z`. Before that
instant the workflow skips activation. Afterwards it first reads both Workers'
actual flags and schedules with four GETs. If full preparation is already enabled,
it skips the fixture requests and redeployment. Otherwise it checks both unpublished
AI fixture protocols and all existing activation guards before any production
configuration write. A refused request, quota error or invalid protocol response
leaves preparation disabled and keeps delivery available from the reviewed feed.
The scheduled check does not purchase capacity or configure a paid-plan upgrade.

`LITERARY_NEWS_NATIVE_PREPARATION_ENABLED=false` may remain as the repository's
initial configuration after successful automatic activation; the workflow does not
write GitHub variables. With the explicit auto-resume flag, the read-only operations
monitor selects `expected: 'auto-resume'` in the fixed four-GET verifier and uses the
validated actual Worker mode as its source of truth. While preparation remains off, it reports
`preparation_disabled`, the explicitly configured `ai_quota_exceeded` block reason,
and unknown preparation counts as `null`. It reports the canonical scheduled retry
timestamp separately; that timestamp is not evidence of recovered quota or a
successful activation. Once the actual preparation flags are on, every original
profile, ledger, ownership, heartbeat, freshness and provider-stop check is required
again, regardless of the historical repository flag or quota reason. Feed identity,
Telegram delivery heartbeat, due queue and actual daily/historical receipts remain
required in both modes. Neither this monitor nor the scheduled activation uses a
Codex session or the Node fallback writer for runtime preparation.

Activation checks both unpublished fixture protocols through an isolated remote
AI binding using the explicitly supplied GitHub deployment token. It does not read
local Wrangler OAuth, install another credential, or use production KV, queues,
coordinators or Telegram. The same `env.AI.run` adapter, models and response parser
used by preparation are checked. A refused preview or AI request blocks activation;
successful fixture responses do not establish any actual news publication.

Local tests use fake AI/storage and do not establish account quota, deployment,
delivery or a daily supply guarantee. Wrangler dry-run proves bundling only.
SQLite Durable Objects have a documented default 30-second CPU budget even on Free;
network/AI waiting does not consume CPU. The outer Cron only invokes the coordinator.
Both Workers and Durable Objects still have memory and request/storage quotas.
Growing annual profiles must be sized and checked in the actual account before
claiming year-long operating capacity. No paid-plan upgrade is configured here.

Daily reports distinguish admitted stories, supply deficit, provider stop, photo
readiness and actual destination receipts. A deficit or unresolved fence is a
degraded state, not a successful publication/delivery guarantee.

Official references: [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/).

## October 2026 recovery improvements

Preparation checks sources at minutes 17 and 47 each hour. The owner's October 9 setting is 8-10 accepted stories daily; existing inference ceilings remain 40 draft requests and 80 total provider calls. Historical days with up to 15 accepted stories remain readable without rewriting their hashes. A bounded persistent least-recently-fetched history rotates article details even when sources repeatedly expose undated or rejected links; a rejected URL rests for six hours. Exact source publication dates and two independent grounded RU/EN passes remain mandatory.

During the delivery window, the separate five-minute delivery scheduler also checks for a missed preparation run after completing capture and dispatch. At actual UTC minutes 25-29 and 55-59 it calls `/recover` through a private cross-worker binding to the existing `daily-news-preparation` Durable Object. Both the primary `/run` and recovery route atomically claim the same persistent half-hour slot before preparation. A duplicate, early recovery, disabled worker or out-of-window request does not start inference or refresh the attempt checkpoint. Failed attempts retain their slot and can retry in the next half-hour; the existing lease and digest fences still protect every write. Recovery failures are isolated from delivery, both public Worker handlers still return 404, and no AI credential is added to the delivery worker. Deploying delivery first remains compatible with an older preparation worker, which returns 404 for the optional recovery request.

Telegram uses a fixed minimum interval of 105 minutes during 08:00-23:00 Moscow, with an 8-10 daily target and at most 10 reserved slots. A Durable Object alarm uses the next eligible dispatch time, while the five-minute scheduler remains a backup; both enter the same receipt, lease and atomic pacing checks. Starting at 08:00 normally allows nine posts before closing. Existing reservations and acknowledgements are retained and cannot shorten the new interval. Temporary read failures while checking Telegram permissions defer the same job and retry fresh checks instead of permanently pausing the channel. Confirmed permission loss still pauses. An uncertain write is never automatically resent.

The public feed reader releases its response slot when a request is aborted, its body completes or is cancelled, or its 60-second response lease expires. Expiry closes the old JSON iterator before another snapshot can replace it; an in-progress profile load still keeps its separate memory fence until it finishes. This prevents an abandoned client response from indefinitely blocking the next time-zone or cache-period request while retaining complete profile and snapshot validation.

The separate native-attempt checkpoint records completed preparation attempts, including quota cooldown and failures, without changing the accepted-content checkpoint. The read-only monitor runs at minutes 27 and 57 each hour and flags an enabled preparation worker whose latest attempt is over 90 minutes old. It retries only known transient reads and distinguishes unreadable state from an intentionally disabled destination. The separate six-hour publication freshness checks remain unchanged. After noon it also flags an observed delivery shortfall against the 105-minute cadence, allowing one interval of grace and requiring fresh successful reads; an empty due page alone is never treated as proof that the future queue is empty.

For compatible code fixes on active workers, first deploy the public news API on the exact reviewed main SHA, then use **Upgrade active literary news workers without disabling delivery** on that same SHA. The upgrade requires the public reader to report the new release before preparation can publish additional publication-date provenance. It preserves enabled flags, credentials, source state, accepted content, locks and Telegram receipts; tests and bundle checks happen before deployment. A failed precheck leaves current workers running. Use the original activation workflow only for initial activation or an explicit mode change.

For the October 9 cadence change, update the service-only `literary_news_delivery_day_status` function from `scripts/database/literary-news-runtime-latest-query.sql` after the compatible worker deployment. The new client validates and normalizes the previous function's reply during this transition; the SQL keeps historical days on their original target and applies 8-10 from October 9 Moscow time. No receipt or pacing journal row is rewritten. Keep schema-5 support during any later rollback.

The delivery coordinator now discovers changed public records on each five-minute capture, reconciling at most four IDs from the original complete verified snapshot. Its durable cursor retains at most 24 IDs, content digests and attempt dates; newly published or revised records take precedence. Failed per-record preparation waits 30 minutes without starving other records, and unchanged successful records refresh after an hour. This cursor is an optimization, so corrupt cursor state can be rebuilt through the existing queue CAS rather than changing send receipts or pacing. Successful backup preparation immediately invokes another capture only, never an extra dispatch. Every private capture and dispatch retains its separate 50-external-request ceiling.

Before a ledger or approved profile write, preparation retains its exact staged JSON in fixed bounded 64 KiB durable slots. The payload manifest and pending digest commit together. An interrupted write can replay only this exact validated payload after a new lease; it cannot regenerate missing data or discard an unknown older ledger digest. A legacy profile can be reconstructed only when its complete digest matches the staged digest. Lease checks immediately before KV writes and live writer exclusion prevent an expired but unfinished writer from overlapping recovery. These changes retain the existing control key, schema, DO identity and bindings.

Before running the updated operations monitor, apply the additive service-only query in `scripts/database/literary-news-operations-supply.sql`. It reads at most 24 exact latest journal keys and requires the same public semantic revisions and temporal metadata. It returns counts and a stable attention fingerprint, never article bodies or provider identifiers. The monitor reports a specific eligible unacknowledged post after 15 minutes of quiet overdue time, unresolved ambiguous dispatches, and the current selected publication reserve for remaining slots. A short reserve is attention information rather than a claim that the entire queue is empty. The monitor remains read-only and does not resend ambiguous jobs or send notifications itself.
