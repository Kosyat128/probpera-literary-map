import { compileBookyJourney, type BookyJourneyContext, type BookyJourneyPlan, type BookyJourneyTrust } from "./bookyJourney";
import type { BookyDialogueLocale } from "./bookyDialogueRegistry";
import type { BookySupportContentStatus } from "./bookySupport";

export type BookyJourneyHostSnapshot = Readonly<{
  /** Host-owned monotonic safe integer. Every policy, catalog, availability,
   * definition or context change must replace the snapshot and increase it. */
  revision: number;
  enabled: boolean;
  active: boolean;
  access: "adult" | "child" | "blocked";
  countryStatus: BookySupportContentStatus;
  booksStatus: BookySupportContentStatus;
  /** Exact local policy only; unknown age or reading level means null. */
  context: BookyJourneyContext | null;
  definition: unknown;
  trust: BookyJourneyTrust;
}>;
export type BookyJourneyHostRequest = Readonly<{
  journeyId: string;
  version: number;
  locale: BookyDialogueLocale;
  definitionChecksum: string;
  nodeId: string;
  hostRevision: number;
}>;
export type BookyJourneyHostOffer = BookyJourneyHostRequest & Readonly<{
  node: BookyJourneyPlan["nodes"][number];
}>;

const requestFields = ["journeyId", "version", "locale", "definitionChecksum", "nodeId", "hostRevision"];
const key = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9._:-]{0,95}$/.test(value);
const revisionValid = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Copy only exact own primitive data; never invoke request accessors/toJSON. */
function readRequest(input: unknown): BookyJourneyHostRequest | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(input), names = Reflect.ownKeys(descriptors);
  if (names.length !== requestFields.length || names.some(name => typeof name !== "string" || !requestFields.includes(name))) return null;
  if (requestFields.some(name => !descriptors[name] || !("value" in descriptors[name]) || !descriptors[name].enumerable)) return null;
  const journeyId: unknown = descriptors.journeyId.value, version: unknown = descriptors.version.value;
  const locale: unknown = descriptors.locale.value, definitionChecksum: unknown = descriptors.definitionChecksum.value;
  const nodeId: unknown = descriptors.nodeId.value, hostRevision: unknown = descriptors.hostRevision.value;
  if (!key(journeyId) || typeof version !== "number" || !Number.isInteger(version) || version < 1 || version > 1_000_000
    || locale !== "ru" && locale !== "en" || typeof definitionChecksum !== "string" || !/^[a-f0-9]{64}$/.test(definitionChecksum)
    || !key(nodeId) || !revisionValid(hostRevision)) return null;
  return Object.freeze({ journeyId, version, locale, definitionChecksum, nodeId, hostRevision });
}

/** Resolve again at action time. An offer is an immutable observation, never
 * bearer authorization, navigation or progress. No plan is cached here.
 *
 * The trusted reader must return the same immutable snapshot object while its
 * revision is current, including stable catalog views and context. It must
 * replace the registry when its independent review policy changes: registries
 * capture review receipts at construction. No age, reading level, approval or
 * offline availability is inferred by this boundary. */
export function resolveBookyJourneyNode(input: unknown,
  readCurrentHost: () => BookyJourneyHostSnapshot | null): BookyJourneyHostOffer | null {
  try {
    const request = readRequest(input);
    if (!request) return null;
    const host = readCurrentHost();
    if (!host || !revisionValid(host.revision) || host.revision !== request.hostRevision
      || host.enabled !== true || host.active !== true || host.access !== "adult"
      || host.countryStatus !== "ready" || !host.context) return null;
    const revision = host.revision;
    const plan = compileBookyJourney(host.definition, host.context, {
      ...host.trust, publicBooks: host.booksStatus === "ready" ? host.trust.publicBooks : [],
    });
    if (!plan || plan.id !== request.journeyId || plan.version !== request.version || plan.locale !== request.locale
      || plan.definitionChecksum !== request.definitionChecksum) return null;
    const node = plan.nodes.find(item => item.id === request.nodeId);
    if (!node) return null;
    const current = readCurrentHost();
    if (current !== host || current.revision !== revision) return null;
    return Object.freeze({ ...request, node });
  } catch { return null; }
}
