import { z } from "zod";

import { adminEnv } from "./env";
import {
  premiumTranslationPromptIdentitySource,
  workersAiReasoningEffort,
  type PremiumEnglishTranslationOptions,
} from "./premium-english-translation";

const modelName = z.string().min(1).max(200).refine((value) =>
  value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value));
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/u);
const effort = z.enum(["none", "low", "medium", "high", "xhigh", "max"]);
const mode = z.enum(["standard", "pro"]);
const timestamp = z.string().min(1).max(80).refine((value) => Number.isFinite(Date.parse(value)));
const provider = z.enum(["cloudflare", "openai"]);
const configurationSchema = z.object({
  version: z.literal(1), provider, model: modelName, reviewerModel: modelName,
  twoPassReview: z.boolean(),
  translatorReasoningEffort: effort, translatorReasoningMode: mode,
  reviewerReasoningEffort: effort, reviewerReasoningMode: mode,
  promptFingerprint: fingerprint,
}).strict();
const identitySchema = z.object({ configuration: configurationSchema, fingerprint }).strict();
const probeError = z.enum(["translation_not_configured", "provider_unavailable",
  "provider_request_failed", "provider_invalid_response", "unexpected"]);
const probeSchema = z.object({
  provider, configured: z.boolean(), binding_found: z.boolean(), test_passed: z.boolean().nullable(),
  model: modelName.nullable(), latency_ms: z.number().int().min(0).max(3_600_000).nullable(),
  last_error_code: probeError.nullable(), last_test_at: timestamp.nullable(),
  cooldown_until: timestamp.nullable(), test_in_progress: z.boolean(),
  configuration_identity: identitySchema.nullable(),
}).strict().refine((row) => {
  if (row.test_passed === true && (!row.configured || !row.binding_found ||
    !row.model || !row.last_test_at || row.latency_ms === null || row.last_error_code !== null)) return false;
  if (row.test_passed === false && (!row.model || !row.last_test_at ||
    row.latency_ms === null || row.last_error_code === null)) return false;
  if (row.configuration_identity && (!row.last_test_at ||
    row.configuration_identity.configuration.provider !== row.provider ||
    row.configuration_identity.configuration.model !== row.model)) return false;
  return true;
});

export type PremiumTranslationConfiguration = z.infer<typeof configurationSchema>;
export type PremiumTranslationConfigurationIdentity = z.infer<typeof identitySchema>;
export type PremiumTranslationProbe = z.infer<typeof probeSchema>;
export type PremiumTranslationConfigurationOptions = Partial<Pick<PremiumEnglishTranslationOptions<unknown>,
  "provider" | "model" | "reviewerModel" | "review" | "reasoningEffort" | "reasoningMode" |
  "reviewerReasoningEffort" | "reviewerReasoningMode" | "aiBinding" | "apiKey">>;

export const PREMIUM_TRANSLATION_PROBE_COLUMNS =
  "provider,configured,binding_found,test_passed,model,latency_ms,last_error_code,last_test_at,cooldown_until,test_in_progress,configuration_identity";
export const PREMIUM_TRANSLATION_SELF_TEST_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

export function premiumTranslationSelfTestFresh(lastTestAt: unknown, now = Date.now()) {
  if (typeof lastTestAt !== "string") return false;
  const testedAt = Date.parse(lastTestAt);
  return Number.isFinite(testedAt) && testedAt <= now && now - testedAt <= PREMIUM_TRANSLATION_SELF_TEST_MAX_AGE_MS;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function configurationValues(configuration: PremiumTranslationConfiguration) {
  return [configuration.version, configuration.provider, configuration.model, configuration.reviewerModel,
    configuration.twoPassReview, configuration.translatorReasoningEffort, configuration.translatorReasoningMode,
    configuration.reviewerReasoningEffort, configuration.reviewerReasoningMode, configuration.promptFingerprint];
}

function configurationMatches(left: PremiumTranslationConfiguration, right: PremiumTranslationConfiguration) {
  return JSON.stringify(configurationValues(left)) === JSON.stringify(configurationValues(right));
}

export async function premiumTranslationConfigurationIdentity(
  options: PremiumTranslationConfigurationOptions = {},
): Promise<PremiumTranslationConfigurationIdentity> {
  const selectedProvider = options.provider ?? adminEnv.premiumTranslationProvider;
  const cloudflare = selectedProvider === "cloudflare";
  // Workers AI dispatch uses its environment models; the repair slot remains
  // active even when the optional final editorial pass is disabled.
  const model = cloudflare ? adminEnv.cloudflareTranslationModel : options.model ?? adminEnv.openAiTranslationModel;
  const reviewerModel = cloudflare ? adminEnv.cloudflareTranslationReviewModel : options.reviewerModel ?? adminEnv.openAiTranslationReviewModel;
  const configuration = configurationSchema.parse({
    version: 1, provider: selectedProvider, model, reviewerModel,
    twoPassReview: options.review ?? adminEnv.openAiPremiumTranslationReview,
    translatorReasoningEffort: cloudflare ? workersAiReasoningEffort(model) : options.reasoningEffort ?? adminEnv.openAiTranslationReasoningEffort,
    translatorReasoningMode: cloudflare ? "standard" : options.reasoningMode ?? adminEnv.openAiTranslationReasoningMode,
    reviewerReasoningEffort: cloudflare ? workersAiReasoningEffort(reviewerModel) : options.reviewerReasoningEffort ?? adminEnv.openAiTranslationReviewReasoningEffort,
    reviewerReasoningMode: cloudflare ? "standard" : options.reviewerReasoningMode ?? adminEnv.openAiTranslationReviewReasoningMode,
    promptFingerprint: await sha256(premiumTranslationPromptIdentitySource()),
  });
  // PostgreSQL jsonb_build_array(...primitives)::text uses comma-space separators.
  const canonical = `[${configurationValues(configuration).map((value) => JSON.stringify(value)).join(", ")}]`;
  return { configuration, fingerprint: await sha256(canonical) };
}

export function isPremiumTranslationProbe(value: unknown): value is PremiumTranslationProbe {
  return probeSchema.safeParse(value).success;
}

export function premiumTranslationProbeStatus(
  probe: PremiumTranslationProbe | null,
  runtime: { provider: "cloudflare" | "openai"; configured: boolean; bindingFound: boolean },
  identity: PremiumTranslationConfigurationIdentity | null,
  now = Date.now(),
): "ready" | "pending" | "failed" | "unverified" {
  if (!probe || !isPremiumTranslationProbe(probe)) return "unverified";
  if (probe.provider === runtime.provider && probe.test_in_progress) return "pending";
  const completed = probe.configuration_identity;
  if (!identity || !completed || !runtime.configured || !runtime.bindingFound ||
    !probe.configured || !probe.binding_found || probe.provider !== runtime.provider ||
    probe.model !== identity.configuration.model || completed.fingerprint !== identity.fingerprint ||
    !configurationMatches(completed.configuration, identity.configuration) ||
    !premiumTranslationSelfTestFresh(probe.last_test_at, now)) return "unverified";
  return probe.test_passed === true ? "ready" : probe.test_passed === false ? "failed" : "unverified";
}

const reservationSchema = z.object({
  provider, configuration: configurationSchema, configurationFingerprint: fingerprint,
  leaseToken: z.string().uuid(), leaseExpiresAt: timestamp, cooldownUntil: timestamp,
  configured: z.boolean(), bindingFound: z.boolean(),
}).strict();
export type PremiumTranslationProbeReservation = z.infer<typeof reservationSchema>;

export function parsePremiumTranslationProbeReservation(
  value: unknown,
  identity: PremiumTranslationConfigurationIdentity,
  runtime: { provider: "cloudflare" | "openai"; configured: boolean; bindingFound: boolean },
  now = Date.now(),
): PremiumTranslationProbeReservation | null {
  const result = reservationSchema.safeParse(value);
  if (!result.success) return null;
  const row = result.data;
  return row.provider === runtime.provider && row.configurationFingerprint === identity.fingerprint &&
    configurationMatches(row.configuration, identity.configuration) &&
    row.configured === runtime.configured && row.bindingFound === runtime.bindingFound &&
    Date.parse(row.leaseExpiresAt) > now && Date.parse(row.leaseExpiresAt) <= now + 300_000 &&
    Date.parse(row.cooldownUntil) > now && Date.parse(row.cooldownUntil) <= now + 1_800_000 ? row : null;
}

const completionSchema = z.object({
  provider, configurationFingerprint: fingerprint, leaseToken: z.string().uuid(), probe: probeSchema,
}).strict();

export function parsePremiumTranslationProbeCompletion(
  value: unknown,
  reservation: PremiumTranslationProbeReservation,
  expected: { testPassed: boolean; model: string; latencyMs: number; errorCode: string | null },
): PremiumTranslationProbe | null {
  const parsed = completionSchema.safeParse(value);
  if (!parsed.success) return null;
  const receipt = parsed.data, probe = receipt.probe, identity = probe.configuration_identity;
  return receipt.provider === reservation.provider && receipt.configurationFingerprint === reservation.configurationFingerprint &&
    receipt.leaseToken === reservation.leaseToken && identity?.fingerprint === reservation.configurationFingerprint &&
    configurationMatches(identity.configuration, reservation.configuration) && probe.provider === reservation.provider &&
    probe.configured === reservation.configured && probe.binding_found === reservation.bindingFound &&
    probe.test_in_progress === false && probe.test_passed === expected.testPassed &&
    probe.model === expected.model && probe.latency_ms === expected.latencyMs && probe.last_error_code === expected.errorCode &&
    probe.last_test_at !== null && Date.parse(probe.last_test_at) <= Date.now() &&
    Date.parse(probe.last_test_at) >= Date.parse(reservation.leaseExpiresAt) - 300_000 &&
    Date.parse(probe.last_test_at) <= Date.parse(reservation.leaseExpiresAt) &&
    probe.cooldown_until === reservation.cooldownUntil ? probe : null;
}
