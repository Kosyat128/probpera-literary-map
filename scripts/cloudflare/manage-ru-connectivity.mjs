import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validatePlan as validateRuConnectivityPlan } from "../dns/validate-ru-connectivity-plan.mjs";

export const PUBLIC_ZONE_NAME = "probpera.ru";
export const PUBLIC_HOSTS = Object.freeze([
  PUBLIC_ZONE_NAME,
  `www.${PUBLIC_ZONE_NAME}`,
]);
export const ADMIN_HOST = `admin.${PUBLIC_ZONE_NAME}`;
export const SNAPSHOT_SCHEMA = "probpera-cloudflare-dns-snapshot/v1";
export const DIRECT_TLS_PROOF_SCHEMA_VERSION = 1;
export const CONNECTIVITY_AUDIT_SCHEMA = "probpera-connectivity-audit/v1";
export const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
export const DNS_PAGE_SIZE = 100;
export const MAX_DIRECT_TLS_PROOF_AGE_MS = 60 * 60 * 1000;
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Synchronized with GitHub's official Pages custom-domain documentation. The
// manager never creates records from these constants; it only proves that
// existing public records already target a documented Pages endpoint.
export const GITHUB_PAGES_IPV4 = Object.freeze([
  "185.199.108.153",
  "185.199.109.153",
  "185.199.110.153",
  "185.199.111.153",
]);
export const GITHUB_PAGES_IPV6 = Object.freeze([
  "2606:50c0:8000::153",
  "2606:50c0:8001::153",
  "2606:50c0:8002::153",
  "2606:50c0:8003::153",
]);

const CLOUDFLARE_ID = /^[a-f0-9]{32}$/u;
const COMMIT_SHA = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const GLOBALPING_MEASUREMENT_ID = /^[A-Za-z0-9_-]{8,160}$/u;
const EXTERNAL_IPV6_PROOF_SCHEMA = "probpera-external-ipv6-origin-proof/v1";
const DNS_TYPE = /^[A-Z][A-Z0-9]{0,15}$/u;
const PAGES_HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+github\.io$/u;
const MAX_ERROR_LENGTH = 600;
const ROUTING_TYPES = new Set(["A", "AAAA", "CNAME"]);
const PASSIVE_PUBLIC_TYPES = new Set(["CAA", "MX", "TXT"]);
const VOLATILE_RECORD_FIELDS = new Set([
  "comment_modified_on",
  "created_on",
  "locked",
  "meta",
  "modified_on",
  "proxiable",
  "tags_modified_on",
]);

function lexicalCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireObject(value, name) {
  if (!isPlainObject(value)) throw new Error(`${name} must be an object`);
  return value;
}

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function requireCloudflareId(value, name) {
  const identifier = requireString(value, name);
  if (!CLOUDFLARE_ID.test(identifier)) {
    throw new Error(`${name} must be a 32-character lowercase hexadecimal identifier`);
  }
  return identifier;
}

export function normalizeCommitSha(value, name = "expected main SHA") {
  const sha = requireString(value, name).toLowerCase();
  if (!COMMIT_SHA.test(sha)) {
    throw new Error(`${name} must be an exact 40-character commit SHA`);
  }
  return sha;
}

export function normalizeDnsName(value, name = "DNS name") {
  const normalized = requireString(value, name)
    .toLowerCase()
    .replace(/\.+$/u, "");
  if (
    normalized.length > 253 ||
    !normalized.split(".").every(
      (label) =>
        label.length >= 1 &&
        label.length <= 63 &&
        /^[a-z0-9_*-](?:[a-z0-9_*-]*[a-z0-9_*-])?$/u.test(label)
    )
  ) {
    throw new Error(`${name} is not a valid normalized DNS name`);
  }
  return normalized;
}

export function normalizePagesHostname(value) {
  const hostname = normalizeDnsName(value, "GitHub Pages hostname");
  if (!PAGES_HOSTNAME.test(hostname)) {
    throw new Error("GitHub Pages hostname must be the configured *.github.io hostname");
  }
  return hostname;
}

function parseIpv6Groups(value) {
  const input = value.toLowerCase();
  if (isIP(input) !== 6) return null;
  const doubleColon = input.indexOf("::");
  if (doubleColon !== input.lastIndexOf("::")) return null;

  const parseSide = (side) => {
    if (!side) return [];
    const groups = side.split(":");
    const output = [];
    for (const group of groups) {
      if (group.includes(".")) {
        if (isIP(group) !== 4) return null;
        const bytes = group.split(".").map(Number);
        output.push((bytes[0] << 8) | bytes[1], (bytes[2] << 8) | bytes[3]);
      } else {
        const parsed = Number.parseInt(group, 16);
        if (!/^[a-f0-9]{1,4}$/u.test(group) || !Number.isInteger(parsed)) return null;
        output.push(parsed);
      }
    }
    return output;
  };

  if (doubleColon === -1) {
    const groups = parseSide(input);
    return groups?.length === 8 ? groups : null;
  }
  const left = parseSide(input.slice(0, doubleColon));
  const right = parseSide(input.slice(doubleColon + 2));
  if (!left || !right || left.length + right.length >= 8) return null;
  return [...left, ...Array(8 - left.length - right.length).fill(0), ...right];
}

export function normalizeIpAddress(value, family) {
  const input = requireString(value, "IP address");
  if (family === 4) {
    if (isIP(input) !== 4) throw new Error("Expected an IPv4 address");
    return input.split(".").map(Number).join(".");
  }
  if (family === 6) {
    const groups = parseIpv6Groups(input);
    if (!groups) throw new Error("Expected an IPv6 address");
    return groups.map((group) => group.toString(16).padStart(4, "0")).join(":");
  }
  throw new Error("IP family must be 4 or 6");
}

const OFFICIAL_IPV4 = new Set(GITHUB_PAGES_IPV4.map((value) => normalizeIpAddress(value, 4)));
const OFFICIAL_IPV6 = new Set(GITHUB_PAGES_IPV6.map((value) => normalizeIpAddress(value, 6)));

export function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot canonicalize a non-finite number");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainObject(value)) throw new Error("Cannot canonicalize a non-JSON value");
  return Object.fromEntries(
    Object.keys(value)
      .sort(lexicalCompare)
      .map((key) => {
        if (value[key] === undefined) {
          throw new Error("Cannot canonicalize an undefined value");
        }
        return [key, canonicalize(value[key])];
      })
  );
}

export function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Fingerprint(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function redactSensitive(value, secrets = []) {
  let output = String(value ?? "");
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length >= 4) {
      output = output.replaceAll(secret, "[REDACTED]");
    }
  }
  return output
    .replace(/Bearer\s+[^\s,;]+/giu, "Bearer [REDACTED]")
    .replace(/\b[a-f0-9]{32}\b/giu, "[REDACTED_ID]")
    .slice(0, MAX_ERROR_LENGTH);
}

function apiErrorCodes(payload) {
  const errors = Array.isArray(payload?.errors) ? payload.errors.slice(0, 5) : [];
  const codes = errors
    .map((error) => (Number.isInteger(error?.code) ? String(error.code) : null))
    .filter(Boolean);
  return codes.length ? `; error codes: ${codes.join(",")}` : "";
}

export class CloudflareClient {
  constructor({
    token,
    accountId,
    fetchImpl = globalThis.fetch,
    baseUrl = CLOUDFLARE_API_BASE,
    timeoutMs = 20_000,
  }) {
    this.token = requireString(token, "CLOUDFLARE_API_TOKEN");
    this.accountId = requireCloudflareId(accountId, "CLOUDFLARE_ACCOUNT_ID");
    if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
    this.fetchImpl = fetchImpl;
    this.baseUrl = requireString(baseUrl, "Cloudflare API base URL").replace(/\/+$/u, "");
    this.timeoutMs = timeoutMs;
    this.secrets = new Set([this.token, this.accountId]);
  }

  addSecrets(values) {
    for (const value of values) {
      if (typeof value === "string" && value) this.secrets.add(value);
    }
  }

  async request(method, resource, body) {
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${resource}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          "User-Agent": "ProbPeraRuConnectivityManager/1.0",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Cloudflare API request failed before a response: ${redactSensitive(
          detail,
          this.secrets
        )}`
      );
    }

    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(
        `Cloudflare API returned non-JSON data (HTTP ${response.status}); response body withheld`
      );
    }
    if (!response.ok || payload?.success !== true) {
      throw new Error(
        `Cloudflare API request was rejected (HTTP ${response.status})${apiErrorCodes(payload)}; response details withheld`
      );
    }
    if (!isPlainObject(payload) || !("result" in payload)) {
      throw new Error("Cloudflare API response did not include a result");
    }
    return payload;
  }
}

function validatePagination(
  payload,
  expectedPage,
  expectedTotalPages,
  expectedTotalCount
) {
  const info = requireObject(payload.result_info, "Cloudflare pagination metadata");
  const page = Number(info.page);
  const totalPages = Number(info.total_pages);
  const totalCount = Number(info.total_count);
  if (
    !Number.isSafeInteger(page) ||
    page !== expectedPage ||
    !Number.isSafeInteger(totalPages) ||
    totalPages < 1 ||
    totalPages > 100_000 ||
    (expectedTotalPages !== undefined && totalPages !== expectedTotalPages) ||
    !Number.isSafeInteger(totalCount) ||
    totalCount < 0 ||
    (expectedTotalCount !== undefined && totalCount !== expectedTotalCount)
  ) {
    throw new Error("Cloudflare pagination metadata was incomplete or inconsistent");
  }
  return { totalPages, totalCount };
}

export function validateDiscoveredZone(payload, accountId, zoneName = PUBLIC_ZONE_NAME) {
  const expectedAccountId = requireCloudflareId(accountId, "CLOUDFLARE_ACCOUNT_ID");
  if (!Array.isArray(payload?.result) || payload.result.length !== 1) {
    throw new Error(`Expected exactly one active Cloudflare zone named ${zoneName}`);
  }
  const pagination = validatePagination(payload, 1, 1, 1);
  if (pagination.totalCount !== 1) {
    throw new Error(`Expected exactly one active Cloudflare zone named ${zoneName}`);
  }
  const zone = requireObject(payload.result[0], "Cloudflare zone");
  if (
    normalizeDnsName(zone.name, "Cloudflare zone name") !== zoneName ||
    zone.status !== "active" ||
    zone.account?.id !== expectedAccountId
  ) {
    throw new Error(`Cloudflare zone identity did not match active ${zoneName}`);
  }
  requireCloudflareId(zone.id, "Cloudflare zone id");
  if (zone.type !== "full") {
    throw new Error("Cloudflare zone is not an authoritative full zone");
  }
  if (zone.paused !== false) {
    throw new Error("Cloudflare zone is paused or did not expose an explicit paused=false state");
  }
  return zone;
}

export async function discoverActiveZone(
  client,
  accountId,
  zoneName = PUBLIC_ZONE_NAME
) {
  if (zoneName !== PUBLIC_ZONE_NAME) {
    throw new Error(`This manager is locked to ${PUBLIC_ZONE_NAME}`);
  }
  const query = new URLSearchParams({
    name: zoneName,
    status: "active",
    "account.id": accountId,
    match: "all",
    page: "1",
    per_page: "50",
  });
  const payload = await client.request("GET", `/zones?${query.toString()}`);
  const zone = validateDiscoveredZone(payload, accountId, zoneName);
  client.addSecrets([zone.id]);
  return zone;
}

function validateRecord(record, zoneName, ordinal) {
  requireObject(record, `DNS record ${ordinal}`);
  requireCloudflareId(record.id, `DNS record ${ordinal} id`);
  if (typeof record.type !== "string" || !DNS_TYPE.test(record.type)) {
    throw new Error(`DNS record ${ordinal} has an unknown type`);
  }
  const name = normalizeDnsName(record.name, `DNS record ${ordinal} name`);
  if (name !== zoneName && !name.endsWith(`.${zoneName}`)) {
    throw new Error(`DNS record ${ordinal} falls outside the managed zone`);
  }
  if (typeof record.content !== "string") {
    throw new Error(`DNS record ${ordinal} content was not a string`);
  }
  if (!Number.isSafeInteger(record.ttl) || record.ttl < 1) {
    throw new Error(`DNS record ${ordinal} TTL was invalid`);
  }
  return record;
}

export async function listAllDnsRecords(client, zoneId, zoneName = PUBLIC_ZONE_NAME) {
  requireCloudflareId(zoneId, "Cloudflare zone id");
  const records = [];
  const identifiers = new Set();
  let totalPages;
  let totalCount;

  for (let page = 1; totalPages === undefined || page <= totalPages; page += 1) {
    const query = new URLSearchParams({
      page: String(page),
      per_page: String(DNS_PAGE_SIZE),
    });
    const payload = await client.request(
      "GET",
      `/zones/${zoneId}/dns_records?${query.toString()}`
    );
    if (!Array.isArray(payload.result)) {
      throw new Error("Cloudflare DNS record result was not an array");
    }
    const pagination = validatePagination(payload, page, totalPages, totalCount);
    totalPages = pagination.totalPages;
    totalCount = pagination.totalCount;
    for (const value of payload.result) {
      const record = validateRecord(value, zoneName, records.length + 1);
      if (identifiers.has(record.id)) {
        throw new Error("Cloudflare returned a duplicate DNS record across pages");
      }
      identifiers.add(record.id);
      records.push(record);
      client.addSecrets([record.id, record.content]);
    }
    if (page < totalPages && payload.result.length === 0) {
      throw new Error("Cloudflare returned an empty DNS page before the final page");
    }
  }

  if (records.length !== totalCount) {
    throw new Error("Cloudflare DNS pagination did not return the advertised record count");
  }

  return records;
}

export async function inspectCloudflareState(
  client,
  accountId,
  zoneName = PUBLIC_ZONE_NAME
) {
  const zone = await discoverActiveZone(client, accountId, zoneName);
  const [records, dnssecPayload, dnsSettingsPayload] = await Promise.all([
    listAllDnsRecords(client, zone.id, zoneName),
    client.request("GET", `/zones/${zone.id}/dnssec`),
    client.request("GET", `/zones/${zone.id}/dns_settings`),
  ]);
  if (!isPlainObject(dnssecPayload.result)) {
    throw new Error("Cloudflare DNSSEC result was not an object");
  }
  if (!isPlainObject(dnsSettingsPayload.result)) {
    throw new Error("Cloudflare DNS settings result was not an object");
  }
  return {
    zone,
    records,
    dnssec: dnssecPayload.result,
    dnsSettings: dnsSettingsPayload.result,
  };
}

export function zoneIdentity(zone) {
  requireObject(zone, "Cloudflare zone");
  const name = normalizeDnsName(zone.name, "Cloudflare zone name");
  const accountId = requireCloudflareId(zone.account?.id, "Cloudflare zone account id");
  const id = requireCloudflareId(zone.id, "Cloudflare zone id");
  if (zone.status !== "active") throw new Error("Cloudflare zone must remain active");
  if (zone.type !== "full") {
    throw new Error("Cloudflare zone must remain an authoritative full zone");
  }
  if (zone.paused !== false) {
    throw new Error("Cloudflare zone must remain explicitly unpaused");
  }
  const nameservers = Array.isArray(zone.name_servers)
    ? zone.name_servers.map((entry) => normalizeDnsName(entry, "Cloudflare nameserver"))
    : [];
  if (!nameservers.length) {
    throw new Error("Cloudflare zone did not expose authoritative nameservers");
  }
  return canonicalize({
    id,
    name,
    account_id: accountId,
    status: zone.status,
    type: zone.type,
    paused: zone.paused,
    name_servers: [...new Set(nameservers)].sort(lexicalCompare),
    vanity_name_servers: Array.isArray(zone.vanity_name_servers)
      ? [...new Set(zone.vanity_name_servers.map((entry) => normalizeDnsName(entry)))]
          .sort(lexicalCompare)
      : [],
  });
}

export function stableRecordConfiguration(record) {
  requireObject(record, "DNS record");
  const configuration = Object.fromEntries(
    Object.entries(record).filter(([key]) => !VOLATILE_RECORD_FIELDS.has(key))
  );
  return canonicalize(configuration);
}

function recordSortKey(record) {
  return `${String(record.name).toLowerCase()}\u0000${record.type}\u0000${record.id}`;
}

function sortedRecords(records) {
  return [...records].sort((left, right) =>
    lexicalCompare(recordSortKey(left), recordSortKey(right))
  );
}

export function stableConfiguration(state) {
  requireObject(state, "Cloudflare state");
  return canonicalize({
    zone: zoneIdentity(state.zone),
    dnssec: requireObject(state.dnssec, "DNSSEC state"),
    dns_settings: requireObject(state.dnsSettings, "DNS settings"),
    records: sortedRecords(state.records).map(stableRecordConfiguration),
  });
}

function normalizedRoutingContent(record) {
  if (record.type === "A") return normalizeIpAddress(record.content, 4);
  if (record.type === "AAAA") return normalizeIpAddress(record.content, 6);
  if (record.type === "CNAME") return normalizeDnsName(record.content, "CNAME target");
  throw new Error("Only routing records have normalized routing content");
}

export function publicRoutingRecords(records, zoneName = PUBLIC_ZONE_NAME) {
  if (!Array.isArray(records)) throw new Error("DNS records must be an array");
  const hosts = new Set([zoneName, `www.${zoneName}`]);
  return records.filter(
    (record) =>
      hosts.has(normalizeDnsName(record.name, "DNS record name")) &&
      ROUTING_TYPES.has(record.type)
  );
}

export function publicRecordsFingerprint(records, zoneName = PUBLIC_ZONE_NAME) {
  const projection = publicRoutingRecords(records, zoneName)
    .map((record) => ({
      name: normalizeDnsName(record.name, "DNS record name"),
      type: record.type,
      content: normalizedRoutingContent(record),
    }))
    .sort((left, right) =>
      lexicalCompare(
        `${left.name}\u0000${left.type}\u0000${left.content}`,
        `${right.name}\u0000${right.type}\u0000${right.content}`
      )
    );
  return sha256Fingerprint(projection);
}

export function recordsForHostFingerprint(records, host) {
  const expectedHost = normalizeDnsName(host, "fingerprint host");
  const projection = sortedRecords(
    records.filter(
      (record) => normalizeDnsName(record.name, "DNS record name") === expectedHost
    )
  ).map(stableRecordConfiguration);
  return sha256Fingerprint(projection);
}

function snapshotBaseFromState(state, capturedAt, expectedMainSha) {
  const zone = zoneIdentity(state.zone);
  const records = sortedRecords(state.records).map((record) => canonicalize(record));
  const base = {
    schema: SNAPSHOT_SCHEMA,
    captured_at: capturedAt,
    ...(expectedMainSha ? { expected_main_sha: normalizeCommitSha(expectedMainSha) } : {}),
    zone,
    dnssec: canonicalize(state.dnssec),
    dns_settings: canonicalize(state.dnsSettings),
    records,
    zone_fingerprint: sha256Fingerprint(zone),
    configuration_fingerprint: sha256Fingerprint(stableConfiguration(state)),
    public_records_fingerprint: publicRecordsFingerprint(records),
    admin_records_fingerprint: recordsForHostFingerprint(records, ADMIN_HOST),
  };
  return canonicalize(base);
}

export function createSnapshotDocument(
  state,
  { now = new Date(), expectedMainSha } = {}
) {
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error("Snapshot time was invalid");
  const base = snapshotBaseFromState(state, date.toISOString(), expectedMainSha);
  return {
    ...base,
    integrity_fingerprint: sha256Fingerprint(base),
  };
}

function stateFromSnapshot(snapshot) {
  return {
    zone: {
      id: snapshot.zone.id,
      name: snapshot.zone.name,
      status: snapshot.zone.status,
      type: snapshot.zone.type,
      paused: snapshot.zone.paused,
      account: { id: snapshot.zone.account_id },
      name_servers: snapshot.zone.name_servers,
      vanity_name_servers: snapshot.zone.vanity_name_servers,
    },
    records: snapshot.records,
    dnssec: snapshot.dnssec,
    dnsSettings: snapshot.dns_settings,
  };
}

export function validateSnapshotDocument(value) {
  const snapshot = requireObject(value, "snapshot");
  if (snapshot.schema !== SNAPSHOT_SCHEMA) {
    throw new Error("Snapshot schema is unsupported");
  }
  if (!Array.isArray(snapshot.records)) throw new Error("Snapshot records must be an array");
  if (!SHA256.test(String(snapshot.integrity_fingerprint || ""))) {
    throw new Error("Snapshot integrity fingerprint is missing or invalid");
  }
  const { integrity_fingerprint: integrityFingerprint, ...base } = snapshot;
  if (sha256Fingerprint(base) !== integrityFingerprint) {
    throw new Error("Snapshot integrity validation failed");
  }

  const state = stateFromSnapshot(snapshot);
  for (const [index, record] of snapshot.records.entries()) {
    validateRecord(record, PUBLIC_ZONE_NAME, index + 1);
  }
  if (snapshot.zone_fingerprint !== sha256Fingerprint(zoneIdentity(state.zone))) {
    throw new Error("Snapshot zone fingerprint validation failed");
  }
  if (
    snapshot.configuration_fingerprint !== sha256Fingerprint(stableConfiguration(state))
  ) {
    throw new Error("Snapshot configuration fingerprint validation failed");
  }
  if (snapshot.public_records_fingerprint !== publicRecordsFingerprint(snapshot.records)) {
    throw new Error("Snapshot public-record fingerprint validation failed");
  }
  if (
    snapshot.admin_records_fingerprint !==
    recordsForHostFingerprint(snapshot.records, ADMIN_HOST)
  ) {
    throw new Error("Snapshot admin-record fingerprint validation failed");
  }
  if (snapshot.expected_main_sha !== undefined) {
    normalizeCommitSha(snapshot.expected_main_sha, "snapshot expected main SHA");
  }
  return snapshot;
}

export function assertSnapshotZoneMatches(snapshot, state) {
  validateSnapshotDocument(snapshot);
  const currentZoneFingerprint = sha256Fingerprint(zoneIdentity(state.zone));
  if (snapshot.zone_fingerprint !== currentZoneFingerprint) {
    throw new Error("Current Cloudflare zone does not match the snapshot zone fingerprint");
  }
}

export function assertCurrentStateMatchesSnapshot(snapshot, state) {
  assertSnapshotZoneMatches(snapshot, state);
  if (
    snapshot.configuration_fingerprint !== sha256Fingerprint(stableConfiguration(state))
  ) {
    throw new Error("Current Cloudflare state changed after the snapshot");
  }
  if (
    snapshot.admin_records_fingerprint !== recordsForHostFingerprint(state.records, ADMIN_HOST)
  ) {
    throw new Error("Admin DNS records changed after the snapshot");
  }
}

function validateRecordTarget(record, pagesHostname, ordinal) {
  if (record.type === "A") {
    if (!OFFICIAL_IPV4.has(normalizeIpAddress(record.content, 4))) {
      throw new Error(`Public A record ${ordinal} is not an official GitHub Pages target`);
    }
  } else if (record.type === "AAAA") {
    if (!OFFICIAL_IPV6.has(normalizeIpAddress(record.content, 6))) {
      throw new Error(`Public AAAA record ${ordinal} is not an official GitHub Pages target`);
    }
  } else if (record.type === "CNAME") {
    if (normalizeDnsName(record.content, "CNAME target") !== pagesHostname) {
      throw new Error(`Public CNAME record ${ordinal} is not the configured Pages hostname`);
    }
  }
}

export function planDirectChanges(
  records,
  { zoneName = PUBLIC_ZONE_NAME, pagesHostname } = {}
) {
  if (zoneName !== PUBLIC_ZONE_NAME) {
    throw new Error(`This manager is locked to ${PUBLIC_ZONE_NAME}`);
  }
  const configuredPagesHostname = normalizePagesHostname(pagesHostname);
  if (!Array.isArray(records)) throw new Error("DNS records must be an array");
  const identifiers = new Set();
  const recordsByHost = new Map(PUBLIC_HOSTS.map((host) => [host, []]));

  for (const [index, record] of records.entries()) {
    validateRecord(record, zoneName, index + 1);
    if (identifiers.has(record.id)) throw new Error("DNS record identifiers were not unique");
    identifiers.add(record.id);
    const name = normalizeDnsName(record.name, "DNS record name");
    if (recordsByHost.has(name)) recordsByHost.get(name).push(record);
  }

  const eligible = [];
  for (const [host, hostRecords] of recordsByHost) {
    const routing = hostRecords.filter((record) => ROUTING_TYPES.has(record.type));
    const unknown = hostRecords.filter(
      (record) => !ROUTING_TYPES.has(record.type) && !PASSIVE_PUBLIC_TYPES.has(record.type)
    );
    if (unknown.length) {
      throw new Error(`Public host ${host} has an unknown or conflicting DNS record type`);
    }
    if (!routing.length) {
      throw new Error(`Public host ${host} has no direct GitHub Pages routing record`);
    }
    const cnameRecords = routing.filter((record) => record.type === "CNAME");
    if (
      cnameRecords.length > 1 ||
      (cnameRecords.length === 1 && routing.length !== 1)
    ) {
      throw new Error(`Public host ${host} has a conflicting CNAME record set`);
    }
    if (!cnameRecords.length) {
      const ipv4 = routing
        .filter((record) => record.type === "A")
        .map((record) => normalizeIpAddress(record.content, 4));
      const ipv6 = routing
        .filter((record) => record.type === "AAAA")
        .map((record) => normalizeIpAddress(record.content, 6));
      if (
        ipv4.length !== OFFICIAL_IPV4.size ||
        ipv6.length !== OFFICIAL_IPV6.size ||
        new Set(ipv4).size !== OFFICIAL_IPV4.size ||
        new Set(ipv6).size !== OFFICIAL_IPV6.size ||
        ipv4.some((address) => !OFFICIAL_IPV4.has(address)) ||
        ipv6.some((address) => !OFFICIAL_IPV6.has(address))
      ) {
        throw new Error(
          `Public host ${host} must use the exact official GitHub Pages A and AAAA sets`
        );
      }
    }
    for (const [index, record] of routing.entries()) {
      validateRecordTarget(record, configuredPagesHostname, index + 1);
      if (record.proxiable !== true || typeof record.proxied !== "boolean") {
        throw new Error(`Public host ${host} contains a routing record that cannot be safely toggled`);
      }
      eligible.push(record);
    }
  }

  const adminRecords = records.filter(
    (record) => normalizeDnsName(record.name, "DNS record name") === ADMIN_HOST
  );
  if (!adminRecords.length) {
    throw new Error("Admin DNS record set is missing; refusing to plan a public change");
  }
  const changes = eligible
    .filter((record) => record.proxied === true)
    .map((record) => ({
      id: record.id,
      name: normalizeDnsName(record.name, "DNS record name"),
      type: record.type,
      from: true,
      to: false,
    }));
  if (changes.some((change) => change.name === ADMIN_HOST)) {
    throw new Error("Internal safety check selected an admin DNS record");
  }
  return canonicalize({
    operation: changes.length ? "disable-public-proxy" : "none",
    zone: zoneName,
    pages_hostname: configuredPagesHostname,
    public_records_fingerprint: publicRecordsFingerprint(records, zoneName),
    admin_records_fingerprint: recordsForHostFingerprint(records, ADMIN_HOST),
    eligible_record_count: eligible.length,
    admin_record_count: adminRecords.length,
    changes,
  });
}

export function directBatchBody(plan) {
  requireObject(plan, "direct plan");
  if (!Array.isArray(plan.changes)) throw new Error("Direct plan changes must be an array");
  const patches = plan.changes.map((change) => {
    requireCloudflareId(change.id, "planned DNS record id");
    if (change.from !== true || change.to !== false) {
      throw new Error("Direct plan may only change proxied true to false");
    }
    if (!PUBLIC_HOSTS.includes(change.name) || !ROUTING_TYPES.has(change.type)) {
      throw new Error("Direct plan selected a non-public or unsupported record");
    }
    return { id: change.id, proxied: false };
  });
  if (new Set(patches.map((patch) => patch.id)).size !== patches.length) {
    throw new Error("Direct plan contains duplicate record changes");
  }
  return { patches };
}

function configuredAddressesByHost(records) {
  const output = Object.fromEntries(PUBLIC_HOSTS.map((host) => [host, []]));
  for (const record of publicRoutingRecords(records)) {
    if (record.type === "A") {
      output[normalizeDnsName(record.name)].push(normalizeIpAddress(record.content, 4));
    } else if (record.type === "AAAA") {
      output[normalizeDnsName(record.name)].push(normalizeIpAddress(record.content, 6));
    }
  }
  for (const host of PUBLIC_HOSTS) output[host].sort(lexicalCompare);
  return output;
}

function proofHostEntry(proof, host) {
  const key = host === PUBLIC_ZONE_NAME ? "apex" : "www";
  return requireObject(proof.hosts?.[key], `TLS proof for ${host}`);
}

export function unwrapDirectTlsProof(value) {
  const artifact = requireObject(value, "direct TLS proof artifact");
  if (artifact.schema === CONNECTIVITY_AUDIT_SCHEMA) {
    if (artifact.requiredOk !== true || artifact.directTlsReady !== true) {
      throw new Error("Connectivity audit wrapper did not pass its required direct checks");
    }
    return requireObject(artifact.proof, "connectivity audit proof");
  }
  if ("schema" in artifact || "proof" in artifact) {
    throw new Error("Direct TLS proof wrapper schema is unsupported");
  }
  return artifact;
}

function exactNormalizedIpv6Set(values, expected, name) {
  if (!Array.isArray(values)) throw new Error(`${name} must be an array`);
  const normalized = values.map((value) => normalizeIpAddress(value, 6));
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${name} contains duplicate addresses`);
  }
  const actual = [...normalized].sort(lexicalCompare);
  const wanted = [...expected].map((value) => normalizeIpAddress(value, 6)).sort(lexicalCompare);
  if (actual.length !== wanted.length || actual.some((value, index) => value !== wanted[index])) {
    throw new Error(`${name} does not match the exact official Pages IPv6 set`);
  }
  return normalized;
}

function expectedExternalMeasurement(address, role, check) {
  const apexHost = PUBLIC_ZONE_NAME;
  const wwwHost = `www.${PUBLIC_ZONE_NAME}`;
  const definitions = {
    "apex:https-release": { host: apexHost, protocol: "HTTP2", port: 443, path: "/.well-known/probpera-release-head.json" },
    "apex:http-root": { host: apexHost, protocol: "HTTP", port: 80, path: "/" },
    "www:https-root": { host: wwwHost, protocol: "HTTP2", port: 443, path: "/" },
    "www:https-release": { host: wwwHost, protocol: "HTTP2", port: 443, path: "/.well-known/probpera-release-head.json" },
    "www:http-root": { host: wwwHost, protocol: "HTTP", port: 80, path: "/" },
  };
  const definition = definitions[`${role}:${check}`];
  if (!definition) throw new Error("External IPv6 measurement role/check is unsupported");
  return { address, role, check, ...definition };
}

function validateExternalRedirect(result, measurement) {
  if (![301, 308].includes(result.statusCode)) {
    throw new Error("External IPv6 redirect measurement was not permanent");
  }
  const location = requireString(result.location, "external IPv6 redirect location");
  const canonicalApex = `https://${PUBLIC_ZONE_NAME}/`;
  const httpsWww = `https://www.${PUBLIC_ZONE_NAME}/`;
  const allowed = measurement.role === "www" && measurement.check === "http-root"
    ? new Set([canonicalApex, httpsWww])
    : new Set([canonicalApex]);
  if (!allowed.has(location)) {
    throw new Error("External IPv6 redirect measurement targeted an unsafe location");
  }
}

function validateExternalMeasurement(measurementValue, expectedSha) {
  const measurement = requireObject(measurementValue, "external IPv6 measurement");
  const identifier = requireString(measurement.id, "external IPv6 measurement id");
  if (!GLOBALPING_MEASUREMENT_ID.test(identifier)) {
    throw new Error("External IPv6 measurement id is invalid");
  }
  const address = normalizeIpAddress(measurement.target, 6);
  const expected = expectedExternalMeasurement(address, measurement.role, measurement.check);
  if (
    measurement.host !== expected.host ||
    measurement.protocol !== expected.protocol ||
    measurement.port !== expected.port ||
    measurement.path !== expected.path ||
    measurement.status !== "passed"
  ) {
    throw new Error("External IPv6 measurement request or status is invalid");
  }
  if (
    !Number.isSafeInteger(measurement.createdProbesCount) ||
    measurement.createdProbesCount < 1 ||
    measurement.resultsCount !== measurement.createdProbesCount ||
    !Array.isArray(measurement.results) ||
    measurement.results.length !== measurement.createdProbesCount
  ) {
    throw new Error("External IPv6 measurement probe coverage is incomplete");
  }
  for (const resultValue of measurement.results) {
    const result = requireObject(resultValue, "external IPv6 probe result");
    if (
      result.passed !== true ||
      result.datacenterNetwork !== true ||
      result.targetVerified !== true ||
      normalizeIpAddress(result.resolvedAddress, 6) !== address ||
      result.requestHost !== expected.host ||
      result.requestedProtocol !== expected.protocol
    ) {
      throw new Error("External IPv6 probe did not verify the forced target and request host");
    }
    if (
      expected.protocol === "HTTP2" &&
      (result.tlsAuthorized !== true ||
        result.http2Verified !== true ||
        result.criticalHeadersValid !== true)
    ) {
      throw new Error("External IPv6 HTTP/2 TLS or security evidence failed");
    }
    if (measurement.check === "https-release") {
      const bodyProof = result.statusCode === 200 && result.releaseSha === expectedSha &&
        result.releaseProofMode === "body";
      const redirectedWwwProof = measurement.role === "www" &&
        [301, 308].includes(result.statusCode) &&
        result.location === `https://${PUBLIC_ZONE_NAME}/.well-known/probpera-release-head.json` &&
        result.releaseProofMode === "redirect-to-verified-apex";
      if (!bodyProof && !redirectedWwwProof) {
        throw new Error("External IPv6 release proof did not match the expected commit");
      }
    } else {
      validateExternalRedirect(result, measurement);
    }
  }
  return { measurement, identifier, address, expected };
}

function validateExternalIpv6Proof(markerValue, evidenceValue, expectedSha) {
  if (markerValue === null || markerValue === undefined) return;
  const marker = requireObject(markerValue, "external IPv6 proof marker");
  if (marker.provider !== "globalping" || marker.status !== "passed" || marker.requiredOk !== true) {
    throw new Error("External IPv6 proof marker is not a passed Globalping proof");
  }
  exactNormalizedIpv6Set(marker.addressesRequired, GITHUB_PAGES_IPV6, "external IPv6 marker addresses");
  if (!Array.isArray(marker.measurementIds) || marker.measurementIds.length !== 20) {
    throw new Error("External IPv6 proof marker must contain exactly 20 measurement ids");
  }
  const markerIds = marker.measurementIds.map((value) => requireString(value, "external IPv6 measurement id"));
  if (markerIds.some((value) => !GLOBALPING_MEASUREMENT_ID.test(value)) ||
      new Set(markerIds).size !== markerIds.length) {
    throw new Error("External IPv6 proof marker measurement ids are invalid or duplicated");
  }

  const evidence = requireObject(evidenceValue, "full external IPv6 evidence");
  if (
    evidence.schema !== EXTERNAL_IPV6_PROOF_SCHEMA ||
    evidence.provider !== "globalping" ||
    evidence.status !== "passed" ||
    evidence.requiredOk !== true ||
    normalizeCommitSha(evidence.expectedReleaseSha, "external IPv6 expected release SHA") !== expectedSha
  ) {
    throw new Error("Full external IPv6 evidence is not a passed proof for the expected commit");
  }
  const expectedAddresses = exactNormalizedIpv6Set(
    evidence.addressesRequired,
    GITHUB_PAGES_IPV6,
    "external IPv6 evidence addresses"
  );
  if (!Array.isArray(evidence.measurements) || evidence.measurements.length !== 20) {
    throw new Error("Full external IPv6 evidence must contain exactly 20 measurements");
  }
  const validated = evidence.measurements.map((measurement) =>
    validateExternalMeasurement(measurement, expectedSha)
  );
  const evidenceIds = validated.map(({ identifier }) => identifier);
  if (new Set(evidenceIds).size !== evidenceIds.length ||
      [...evidenceIds].sort(lexicalCompare).some((value, index) =>
        value !== [...markerIds].sort(lexicalCompare)[index]
      )) {
    throw new Error("External IPv6 marker does not match the full measurement evidence");
  }

  const addressEvidence = requireObject(evidence.addresses, "external IPv6 address evidence");
  const normalizedAddressKeys = Object.keys(addressEvidence).map((value) => normalizeIpAddress(value, 6));
  if (new Set(normalizedAddressKeys).size !== expectedAddresses.length ||
      normalizedAddressKeys.length !== expectedAddresses.length ||
      [...normalizedAddressKeys].sort(lexicalCompare).some((value, index) =>
        value !== [...expectedAddresses].sort(lexicalCompare)[index]
      )) {
    throw new Error("External IPv6 address summaries do not cover the exact reviewed set");
  }
  for (const address of expectedAddresses) {
    const originalKey = Object.keys(addressEvidence).find((value) => normalizeIpAddress(value, 6) === address);
    const summary = requireObject(addressEvidence[originalKey], `external IPv6 evidence for ${address}`);
    const apex = requireObject(summary.apex, `external IPv6 apex evidence for ${address}`);
    const www = requireObject(summary.www, `external IPv6 www evidence for ${address}`);
    if (
      apex.host !== PUBLIC_ZONE_NAME || apex.status !== "passed" ||
      apex.certificateValid !== true || apex.hostnameVerified !== true ||
      apex.http2Verified !== true || apex.criticalHeadersValid !== true ||
      apex.httpStatus !== 200 || apex.releaseSha !== expectedSha ||
      apex.httpRedirectTo !== `https://${PUBLIC_ZONE_NAME}/`
    ) {
      throw new Error(`External IPv6 apex summary failed for ${address}`);
    }
    if (
      www.host !== `www.${PUBLIC_ZONE_NAME}` || www.status !== "passed" ||
      www.certificateValid !== true || www.hostnameVerified !== true ||
      www.http2Verified !== true || www.criticalHeadersValid !== true ||
      ![301, 308].includes(www.httpStatus) ||
      www.redirectTo !== `https://${PUBLIC_ZONE_NAME}/` ||
      www.releaseSha !== expectedSha ||
      ![`https://${PUBLIC_ZONE_NAME}/`, `https://www.${PUBLIC_ZONE_NAME}/`].includes(www.httpRedirectTo)
    ) {
      throw new Error(`External IPv6 www summary failed for ${address}`);
    }
    const forAddress = validated.filter((entry) => entry.address === address);
    const expectedJobs = new Set([
      "apex:https-release", "apex:http-root", "www:https-root", "www:https-release", "www:http-root",
    ]);
    const actualJobs = new Set(forAddress.map(({ measurement }) => `${measurement.role}:${measurement.check}`));
    if (forAddress.length !== 5 || actualJobs.size !== expectedJobs.size ||
        [...expectedJobs].some((job) => !actualJobs.has(job))) {
      throw new Error(`External IPv6 measurement roles are incomplete for ${address}`);
    }
    const apexIds = new Set(forAddress.filter(({ measurement }) => measurement.role === "apex")
      .map(({ identifier }) => identifier));
    const wwwIds = new Set(forAddress.filter(({ measurement }) => measurement.role === "www")
      .map(({ identifier }) => identifier));
    if (!Array.isArray(apex.measurements) || apex.measurements.length !== 2 ||
        !apex.measurements.every((id) => apexIds.has(id)) ||
        !Array.isArray(www.measurements) || www.measurements.length !== 3 ||
        !www.measurements.every((id) => wwwIds.has(id))) {
      throw new Error(`External IPv6 address summary measurements are inconsistent for ${address}`);
    }
  }
  // Schema v1 proves transport and the release-head response only. It does
  // not bind every forced IPv6 origin to the representative HTML, CMS, PWA,
  // and static-asset hashes in the local audit, so it must never authorize a
  // DNS mutation. A future schema may remove this fail-closed gate only after
  // those content-integrity claims become part of the signed evidence.
  throw new Error(
    "External IPv6 proof does not bind full content integrity; use a trusted dual-stack runner"
  );
}

function validatePermanentWwwRedirect(entry) {
  if (![301, 308].includes(entry.httpStatus)) {
    throw new Error("Direct HTTPS response proof failed for www.probpera.ru");
  }
  const locationValue = entry.redirectTo ?? entry.redirectLocation ?? entry.location;
  let location;
  try {
    location = new URL(requireString(locationValue, "www redirect location"));
  } catch {
    throw new Error("Direct www redirect proof did not contain an absolute HTTPS target");
  }
  if (
    location.protocol !== "https:" ||
    normalizeDnsName(location.hostname, "www redirect hostname") !== PUBLIC_ZONE_NAME ||
    location.username ||
    location.password ||
    (location.port && location.port !== "443")
  ) {
    throw new Error("Direct www redirect did not target canonical https://probpera.ru");
  }
}

function validateRepresentativeHtmlProof(entry) {
  const representativePath = requireString(
    entry.representativeHtmlPath,
    "representative published HTML path"
  );
  let url;
  try {
    url = new URL(representativePath, `https://${PUBLIC_ZONE_NAME}`);
  } catch {
    throw new Error("Representative published HTML path was invalid");
  }
  const depth = url.pathname.split("/").filter(Boolean).length;
  if (
    !representativePath.startsWith("/stati/") ||
    representativePath.startsWith("//") ||
    url.origin !== `https://${PUBLIC_ZONE_NAME}` ||
    url.pathname !== representativePath ||
    url.search ||
    url.hash ||
    depth < 3
  ) {
    throw new Error("Representative published HTML path was not an eligible same-origin article");
  }
  if (
    !Number.isInteger(entry.representativeHtmlStatus) ||
    entry.representativeHtmlStatus < 200 ||
    entry.representativeHtmlStatus >= 300
  ) {
    throw new Error("Representative published HTML response proof failed");
  }
  if (
    !Number.isSafeInteger(entry.representativeHtmlContentLength) ||
    entry.representativeHtmlContentLength <= 16_384
  ) {
    throw new Error("Representative published HTML content proof was too small");
  }
  if (!SHA256.test(String(entry.representativeHtmlSha256 || ""))) {
    throw new Error("Representative published HTML hash proof was invalid");
  }
}

function validateSameOriginPath(value, prefix, name) {
  const pathValue = requireString(value, name);
  let url;
  try {
    url = new URL(pathValue, `https://${PUBLIC_ZONE_NAME}`);
  } catch {
    throw new Error(`${name} was invalid`);
  }
  if (
    !pathValue.startsWith(prefix) ||
    pathValue.startsWith("//") ||
    url.origin !== `https://${PUBLIC_ZONE_NAME}` ||
    url.pathname !== pathValue ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} was not an eligible same-origin path`);
  }
  return pathValue;
}

function validateSeoContinuityProof(entry) {
  if (
    entry.redirectManifestPath !== "/redirects.generated.json" ||
    !Number.isSafeInteger(entry.redirectManifestCount) ||
    entry.redirectManifestCount < 157 ||
    !SHA256.test(String(entry.redirectManifestSha256 || ""))
  ) {
    throw new Error("Legacy redirect manifest proof failed");
  }

  const legacyAliasPath = validateSameOriginPath(
    entry.legacyAliasPath,
    "/articles/",
    "legacy alias path"
  );
  if (legacyAliasPath.split("/").filter(Boolean).length < 2) {
    throw new Error("Legacy alias path did not identify a deterministic article alias");
  }
  let aliasTarget;
  try {
    aliasTarget = new URL(requireString(entry.legacyAliasTarget, "legacy alias target"));
  } catch {
    throw new Error("Legacy alias canonical target was invalid");
  }
  if (
    aliasTarget.protocol !== "https:" ||
    normalizeDnsName(aliasTarget.hostname, "legacy alias target hostname") !==
      PUBLIC_ZONE_NAME ||
    !aliasTarget.pathname.startsWith("/stati/") ||
    aliasTarget.pathname.split("/").filter(Boolean).length < 3 ||
    aliasTarget.username ||
    aliasTarget.password ||
    (aliasTarget.port && aliasTarget.port !== "443") ||
    aliasTarget.search ||
    aliasTarget.hash
  ) {
    throw new Error("Legacy alias did not preserve the canonical same-origin target");
  }
  const validModeStatus =
    entry.legacyAliasMode === "redirect" &&
    [301, 308].includes(entry.legacyAliasStatus);
  if (!validModeStatus || !SHA256.test(String(entry.legacyAliasSha256 || ""))) {
    throw new Error("Legacy alias semantic proof failed");
  }

  if (
    entry.notFoundPath !== "/.well-known/probpera-connectivity-audit-not-found" ||
    entry.notFoundStatus !== 404 ||
    entry.notFoundCanonical !== `https://${PUBLIC_ZONE_NAME}/` ||
    !SHA256.test(String(entry.notFoundSha256 || ""))
  ) {
    throw new Error("Custom 404 semantic proof failed");
  }
}

export function validateDirectTlsProof(
  value,
  {
    expectedMainSha,
    pagesHostname,
    records,
    now = new Date(),
    allowUnboundFingerprint = false,
  }
) {
  const artifact = requireObject(value, "direct TLS proof artifact");
  const proof = unwrapDirectTlsProof(value);
  const sha = normalizeCommitSha(expectedMainSha);
  const configuredPagesHostname = normalizePagesHostname(pagesHostname);
  if (proof.schemaVersion !== DIRECT_TLS_PROOF_SCHEMA_VERSION) {
    throw new Error("Direct TLS proof schema version is unsupported");
  }
  if (proof.status !== "passed") {
    throw new Error("Direct TLS proof status is not passed");
  }
  if (proof.proofEligible !== true) {
    throw new Error("Direct TLS proof is not eligible for a production DNS change");
  }
  if (normalizeCommitSha(proof.expectedMainSha, "proof expected main SHA") !== sha) {
    throw new Error("Direct TLS proof is for a different main commit");
  }
  if (normalizePagesHostname(proof.pagesHostname) !== configuredPagesHostname) {
    throw new Error("Direct TLS proof is for a different Pages hostname");
  }
  validateExternalIpv6Proof(
    proof.externalIpv6Proof,
    artifact.schema === CONNECTIVITY_AUDIT_SCHEMA ? artifact.externalIpv6 : undefined,
    sha
  );
  const expectedFingerprint = publicRecordsFingerprint(records);
  let proofFingerprint = proof.publicRecordsFingerprint;
  if (proofFingerprint === null && allowUnboundFingerprint === true) {
    // plan-direct is read-only. It may bind a fresh, otherwise complete audit
    // proof to the just-read Cloudflare record set in memory, but the artifact
    // remains unusable for apply-direct until a workflow writes this hash into
    // the proof itself.
    proofFingerprint = expectedFingerprint;
  }
  if (
    !SHA256.test(String(proofFingerprint || "")) ||
    proofFingerprint !== expectedFingerprint
  ) {
    throw new Error("Direct TLS proof is not bound to the current public DNS record set");
  }

  const currentTime = now instanceof Date ? now : new Date(now);
  const verifiedAt = new Date(proof.verifiedAt);
  const expiresAt = new Date(proof.expiresAt);
  if (
    !Number.isFinite(currentTime.getTime()) ||
    !Number.isFinite(verifiedAt.getTime()) ||
    !Number.isFinite(expiresAt.getTime()) ||
    verifiedAt.getTime() > currentTime.getTime() + 60_000 ||
    currentTime.getTime() - verifiedAt.getTime() > MAX_DIRECT_TLS_PROOF_AGE_MS ||
    expiresAt.getTime() <= currentTime.getTime() ||
    expiresAt.getTime() - verifiedAt.getTime() > MAX_DIRECT_TLS_PROOF_AGE_MS
  ) {
    throw new Error("Direct TLS proof is stale, expired, or has an invalid validity window");
  }

  const expectedAddresses = configuredAddressesByHost(records);
  for (const host of PUBLIC_HOSTS) {
    const entry = proofHostEntry(proof, host);
    if (normalizeDnsName(entry.host, "TLS proof host") !== host) {
      throw new Error(`Direct TLS proof host binding failed for ${host}`);
    }
    if (entry.status !== "passed") {
      throw new Error(`Direct host proof status failed for ${host}`);
    }
    if (entry.certificateValid !== true || entry.hostnameVerified !== true) {
      throw new Error(`Direct TLS certificate proof failed for ${host}`);
    }
    if (host === PUBLIC_ZONE_NAME) {
      if (
        !Number.isInteger(entry.httpStatus) ||
        entry.httpStatus < 200 ||
        entry.httpStatus >= 300
      ) {
        throw new Error(`Direct HTTPS response proof failed for ${host}`);
      }
      if (!Number.isSafeInteger(entry.rootContentLength) || entry.rootContentLength < 8_192) {
        throw new Error(`Direct HTTPS root content proof was too small for ${host}`);
      }
      if (
        entry.contentPath !== "/cms/published-content.json" ||
        !Number.isSafeInteger(entry.contentLength) ||
        entry.contentLength < 16_384 ||
        !Number.isSafeInteger(entry.largeContentLength) ||
        entry.largeContentLength < 16_384
      ) {
        throw new Error(`Direct HTTPS large-content proof failed for ${host}`);
      }
      validateRepresentativeHtmlProof(entry);
      validateSeoContinuityProof(entry);
    } else {
      validatePermanentWwwRedirect(entry);
    }
    if (normalizeCommitSha(entry.releaseSha, "proof release SHA") !== sha) {
      throw new Error(`Direct release proof failed for ${host}`);
    }
    if (!Array.isArray(entry.originIpsTested) || !entry.originIpsTested.length) {
      throw new Error(`Direct origin IP proof is missing for ${host}`);
    }
    const tested = new Set(
      entry.originIpsTested.map((address) => {
        const family = isIP(address);
        if (family !== 4 && family !== 6) {
          throw new Error(`Direct origin IP proof was invalid for ${host}`);
        }
        const normalized = normalizeIpAddress(address, family);
        const official = family === 4 ? OFFICIAL_IPV4 : OFFICIAL_IPV6;
        if (!official.has(normalized)) {
          throw new Error(`Direct origin IP proof included a non-Pages target for ${host}`);
        }
        return `${family}:${normalized}`;
      })
    );
    for (const address of [...GITHUB_PAGES_IPV4, ...GITHUB_PAGES_IPV6]) {
      const family = isIP(address);
      const normalized = normalizeIpAddress(address, family);
      if (!tested.has(`${family}:${normalized}`)) {
        throw new Error(`Direct TLS proof did not cover the official Pages address set for ${host}`);
      }
    }
    for (const address of expectedAddresses[host]) {
      const family = isIP(address);
      if (!tested.has(`${family}:${address}`)) {
        throw new Error(`Direct TLS proof did not test every configured address for ${host}`);
      }
    }
    if (Array.isArray(entry.certSANs)) {
      const sans = new Set(
        entry.certSANs.map((name) => normalizeDnsName(name, "certificate SAN"))
      );
      if (!sans.has(host)) throw new Error(`Certificate SAN proof failed for ${host}`);
    }
    if (entry.notAfter !== undefined) {
      const notAfter = new Date(entry.notAfter);
      if (!Number.isFinite(notAfter.getTime()) || notAfter <= currentTime) {
        throw new Error(`Certificate expiry proof failed for ${host}`);
      }
    }
  }
  return proof;
}

export function bindDirectTlsProofArtifact(
  artifactValue,
  snapshotValue,
  { expectedMainSha, pagesHostname, now = new Date() }
) {
  const snapshot = validateSnapshotDocument(snapshotValue);
  const artifact = requireObject(artifactValue, "direct TLS proof artifact");
  const sha = normalizeCommitSha(expectedMainSha);
  if (snapshot.expected_main_sha !== undefined && snapshot.expected_main_sha !== sha) {
    throw new Error("Snapshot expected main SHA does not equal the proof binding SHA");
  }
  validateDirectTlsProof(artifact, {
    expectedMainSha: sha,
    pagesHostname,
    records: snapshot.records,
    now,
    allowUnboundFingerprint: true,
  });
  const proof = unwrapDirectTlsProof(artifact);
  const boundProof = canonicalize({
    ...proof,
    publicRecordsFingerprint: snapshot.public_records_fingerprint,
    snapshotConfigurationFingerprint: snapshot.configuration_fingerprint,
  });
  const boundArtifact =
    artifact.schema === CONNECTIVITY_AUDIT_SCHEMA
      ? canonicalize({ ...artifact, proof: boundProof })
      : boundProof;
  validateDirectTlsProof(boundArtifact, {
    expectedMainSha: sha,
    pagesHostname,
    records: snapshot.records,
    now,
  });
  return boundArtifact;
}

export function assertProofBoundToSnapshot(artifactValue, snapshotValue) {
  const snapshot = validateSnapshotDocument(snapshotValue);
  const proof = unwrapDirectTlsProof(artifactValue);
  if (
    !SHA256.test(String(proof.snapshotConfigurationFingerprint || "")) ||
    proof.snapshotConfigurationFingerprint !== snapshot.configuration_fingerprint ||
    proof.publicRecordsFingerprint !== snapshot.public_records_fingerprint
  ) {
    throw new Error("Direct TLS proof is not cryptographically bound to this snapshot");
  }
}

function recordsById(records) {
  const output = new Map();
  for (const record of records) {
    requireCloudflareId(record.id, "DNS record id");
    if (output.has(record.id)) throw new Error("DNS record identifiers were not unique");
    output.set(record.id, record);
  }
  return output;
}

function configurationWithoutProxy(record) {
  const configuration = { ...stableRecordConfiguration(record) };
  delete configuration.proxied;
  return canonicalize(configuration);
}

export function planRollbackChanges(
  snapshotValue,
  currentState,
  { pagesHostname } = {}
) {
  const snapshot = validateSnapshotDocument(snapshotValue);
  assertSnapshotZoneMatches(snapshot, currentState);
  const baselineState = stateFromSnapshot(snapshot);
  if (
    stableStringify(baselineState.dnssec) !== stableStringify(currentState.dnssec) ||
    stableStringify(baselineState.dnsSettings) !== stableStringify(currentState.dnsSettings)
  ) {
    throw new Error("DNSSEC or zone DNS settings changed after the snapshot");
  }

  const directPlan = planDirectChanges(snapshot.records, { pagesHostname });
  const eligible = new Set(directPlan.changes.map((change) => change.id));
  const baselineById = recordsById(snapshot.records);
  const currentById = recordsById(currentState.records);
  if (
    baselineById.size !== currentById.size ||
    [...baselineById.keys()].some((id) => !currentById.has(id))
  ) {
    throw new Error("DNS record set changed after the snapshot");
  }

  const changes = [];
  for (const [id, baseline] of baselineById) {
    const current = currentById.get(id);
    if (
      stableStringify(configurationWithoutProxy(baseline)) !==
      stableStringify(configurationWithoutProxy(current))
    ) {
      throw new Error("A DNS record definition changed after the snapshot");
    }
    if (baseline.proxied === current.proxied) continue;
    if (!(eligible.has(id) && baseline.proxied === true && current.proxied === false)) {
      throw new Error("Current proxy state is not an exact result of the direct plan");
    }
    changes.push({
      id,
      name: normalizeDnsName(baseline.name),
      type: baseline.type,
      from: false,
      to: true,
    });
  }
  if (
    snapshot.admin_records_fingerprint !==
    recordsForHostFingerprint(currentState.records, ADMIN_HOST)
  ) {
    throw new Error("Admin DNS records changed after the snapshot");
  }
  return canonicalize({
    operation: changes.length ? "restore-public-proxy" : "none",
    zone: PUBLIC_ZONE_NAME,
    changes,
  });
}

export function rollbackBatchBody(plan) {
  requireObject(plan, "rollback plan");
  if (!Array.isArray(plan.changes)) throw new Error("Rollback changes must be an array");
  const patches = plan.changes.map((change) => {
    requireCloudflareId(change.id, "rollback DNS record id");
    if (
      change.from !== false ||
      change.to !== true ||
      !PUBLIC_HOSTS.includes(change.name) ||
      !ROUTING_TYPES.has(change.type)
    ) {
      throw new Error("Rollback may only restore public routing proxy flags");
    }
    return { id: change.id, proxied: true };
  });
  if (new Set(patches.map((patch) => patch.id)).size !== patches.length) {
    throw new Error("Rollback plan contains duplicate record changes");
  }
  return { patches };
}

export function confirmationFor(command, expectedMainSha) {
  const sha = normalizeCommitSha(expectedMainSha);
  if (command === "apply-direct") return `APPLY DIRECT PROBPERA ${sha}`;
  if (command === "rollback") return `ROLLBACK PROBPERA ${sha}`;
  throw new Error("Confirmation is only defined for mutating commands");
}

export function validateMutationGate({
  command,
  expectedMainSha,
  repositorySha,
  snapshotMainSha,
  confirmation,
  snapshot,
}) {
  const expected = normalizeCommitSha(expectedMainSha);
  const repository = normalizeCommitSha(repositorySha, "checked-out repository SHA");
  if (repository !== expected) {
    throw new Error("Checked-out repository SHA does not equal the expected main SHA");
  }
  const immutableSnapshotSha = normalizeCommitSha(
    snapshot?.expected_main_sha,
    "immutable snapshot main SHA"
  );
  if (command === "apply-direct") {
    if (immutableSnapshotSha !== expected) {
      throw new Error("Apply snapshot main SHA does not equal the requested main SHA");
    }
  } else if (command === "rollback") {
    const attestedSnapshotSha = normalizeCommitSha(
      snapshotMainSha,
      "attested snapshot main SHA"
    );
    if (immutableSnapshotSha !== attestedSnapshotSha) {
      throw new Error("Rollback snapshot main SHA does not match workflow provenance");
    }
  } else {
    throw new Error("Mutation gate received a non-mutating command");
  }
  if (confirmation !== confirmationFor(command, expected)) {
    throw new Error(`Exact ${command} confirmation is required`);
  }
  return expected;
}

function stateWithProxyChanges(state, changes) {
  const byId = new Map(changes.map((change) => [change.id, change.to]));
  return {
    ...state,
    records: state.records.map((record) =>
      byId.has(record.id) ? { ...record, proxied: byId.get(record.id) } : record
    ),
  };
}

function assertPostApplyState(beforeState, afterState, changes, adminFingerprint) {
  if (
    sha256Fingerprint(zoneIdentity(beforeState.zone)) !==
      sha256Fingerprint(zoneIdentity(afterState.zone)) ||
    stableStringify(beforeState.dnssec) !== stableStringify(afterState.dnssec) ||
    stableStringify(beforeState.dnsSettings) !== stableStringify(afterState.dnsSettings)
  ) {
    throw new Error("Cloudflare post-apply verification detected a zone-level change");
  }
  const expected = stateWithProxyChanges(beforeState, changes);
  if (
    sha256Fingerprint(stableConfiguration(expected)) !==
    sha256Fingerprint(stableConfiguration(afterState))
  ) {
    throw new Error("Cloudflare post-apply verification did not match the exact proxy plan");
  }
  if (recordsForHostFingerprint(afterState.records, ADMIN_HOST) !== adminFingerprint) {
    throw new Error("Cloudflare post-apply verification detected an admin DNS change");
  }
}

async function readJsonFile(filePath, label, readFileImpl) {
  let text;
  try {
    text = await readFileImpl(filePath, "utf8");
  } catch {
    throw new Error(`${label} could not be read`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} was not valid JSON`);
  }
}

export async function writeSnapshotFile(
  snapshotPath,
  snapshot,
  writeFileImpl = writeFile
) {
  const destination = requireString(snapshotPath, "--snapshot path");
  try {
    await writeFileImpl(destination, `${JSON.stringify(snapshot, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error("Snapshot path already exists; refusing to overwrite it");
    }
    throw new Error("Snapshot could not be written to the required path");
  }
}

export async function writeBoundProofFile(
  destinationPath,
  artifact,
  writeFileImpl = writeFile
) {
  const destination = requireString(destinationPath, "--bound-proof path");
  try {
    await writeFileImpl(destination, `${JSON.stringify(artifact, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error("Bound proof path already exists; refusing to overwrite it");
    }
    throw new Error("Bound proof could not be written to the required path");
  }
}

function recordTypeCounts(records) {
  const counts = new Map();
  for (const record of records) counts.set(record.type, (counts.get(record.type) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => lexicalCompare(left, right)));
}

export function validateEmergencyDeliveryPlan(
  value,
  { pagesHostname, renewalEvidenceContent = null } = {}
) {
  const plan = requireObject(value, "reviewed direct delivery plan");
  const errors = validateRuConnectivityPlan(plan, {
    requireReady: true,
    renewalEvidenceContent,
  });
  if (errors.length > 0) {
    throw new Error(`Reviewed direct delivery plan is not ready: ${errors.join("; ")}`);
  }
  const configuredPagesHostname = normalizePagesHostname(pagesHostname);
  if (
    plan.status !== "ready" ||
    plan.directDelivery?.mode !== "github-pages" ||
    plan.directDelivery?.provider !== "github-pages" ||
    normalizePagesHostname(plan.directDelivery?.hostname) !== configuredPagesHostname ||
    plan.contentOrigin?.longTermCertificateRenewalConfirmed !== true ||
    plan.preconditions?.githubPagesCertificateRenewalCompatibilityConfirmed !== true ||
    plan.preconditions?.githubPagesDnsCheckPassed !== true ||
    plan.preconditions?.githubPagesHttpsEnforced !== true
  ) {
    throw new Error(
      "Emergency DNS-only apply requires a reviewed GitHub Pages plan with long-term certificate renewal attested"
    );
  }
  return plan;
}

async function compensateFailedDirectApply({
  accountId,
  client,
  pagesHostname,
  snapshot,
  zoneName,
  delayImpl,
}) {
  // A timed-out POST is ambiguous: Cloudflare may have committed it even when
  // the response never reached the runner. Wait, re-read, and restore every
  // observed subset of the exact proxy-only plan from the authenticated
  // pre-change snapshot. No unrelated drift is ever overwritten.
  await delayImpl(2_000);
  let observed = await inspectCloudflareState(client, accountId, zoneName);
  const rollbackPlan = planRollbackChanges(snapshot, observed, { pagesHostname });
  if (rollbackPlan.changes.length > 0) {
    try {
      await client.request(
        "POST",
        `/zones/${observed.zone.id}/dns_records/batch`,
        rollbackBatchBody(rollbackPlan)
      );
    } catch {
      // The compensating response can be ambiguous for the same reason. Its
      // result is decided only by the exact subsequent state comparison.
    }
  }
  await delayImpl(2_000);
  observed = await inspectCloudflareState(client, accountId, zoneName);
  assertCurrentStateMatchesSnapshot(snapshot, observed);
  await delayImpl(2_000);
  const stable = await inspectCloudflareState(client, accountId, zoneName);
  assertCurrentStateMatchesSnapshot(snapshot, stable);
  return rollbackPlan.changes.length;
}

export async function manageRuConnectivity(options = {}) {
  const command = options.command || "inspect";
  if (
    ![
      "inspect",
      "snapshot",
      "bind-proof",
      "plan-direct",
      "apply-direct",
      "rollback",
    ].includes(command)
  ) {
    throw new Error("Unknown RU connectivity command");
  }
  const zoneName = options.zoneName || PUBLIC_ZONE_NAME;
  if (zoneName !== PUBLIC_ZONE_NAME) {
    throw new Error(`This manager is locked to ${PUBLIC_ZONE_NAME}`);
  }
  const accountId = requireCloudflareId(options.accountId, "CLOUDFLARE_ACCOUNT_ID");
  const client = new CloudflareClient({
    token: options.token,
    accountId,
    fetchImpl: options.fetchImpl || globalThis.fetch,
    baseUrl: options.baseUrl || CLOUDFLARE_API_BASE,
    timeoutMs: options.timeoutMs || 20_000,
  });
  const state = await inspectCloudflareState(client, accountId, zoneName);

  if (command === "inspect") {
    return {
      command,
      mode: "read-only",
      zone: zoneName,
      active: true,
      authoritative: state.zone.type === "full" && state.zone.paused === false,
      recordCount: state.records.length,
      recordTypeCounts: recordTypeCounts(state.records),
      proxiedRecordCount: state.records.filter((record) => record.proxied === true).length,
      dnssecStatus: typeof state.dnssec.status === "string" ? state.dnssec.status : "unknown",
      mutationCount: 0,
    };
  }

  if (command === "snapshot") {
    const snapshot = createSnapshotDocument(state, {
      now: options.now,
      expectedMainSha: options.expectedMainSha,
    });
    await writeSnapshotFile(
      options.snapshotPath,
      snapshot,
      options.writeFileImpl || writeFile
    );
    return {
      command,
      mode: "snapshot-only",
      zone: zoneName,
      recordCount: state.records.length,
      mutationCount: 0,
      snapshotWritten: true,
    };
  }

  const expectedMainSha = normalizeCommitSha(options.expectedMainSha);
  const pagesHostname = normalizePagesHostname(options.pagesHostname);
  const readFileImpl = options.readFileImpl || readFile;

  if (command === "bind-proof") {
    const snapshotValue = options.snapshot || (await readJsonFile(
      requireString(options.snapshotPath, "--snapshot path"),
      "Snapshot",
      readFileImpl
    ));
    const snapshot = validateSnapshotDocument(snapshotValue);
    assertCurrentStateMatchesSnapshot(snapshot, state);
    const repositorySha = normalizeCommitSha(
      options.repositorySha,
      "checked-out repository SHA"
    );
    if (repositorySha !== expectedMainSha) {
      throw new Error("Checked-out repository SHA does not equal the expected main SHA");
    }
    const artifact = options.tlsProof || (await readJsonFile(
      requireString(options.tlsProofPath, "--tls-proof path"),
      "Direct TLS proof",
      readFileImpl
    ));
    const boundArtifact = bindDirectTlsProofArtifact(artifact, snapshot, {
      expectedMainSha,
      pagesHostname,
      now: options.now,
    });
    await writeBoundProofFile(
      options.boundProofPath,
      boundArtifact,
      options.writeFileImpl || writeFile
    );
    return {
      command,
      mode: "proof-binding-only",
      zone: zoneName,
      boundProofWritten: true,
      mutationCount: 0,
    };
  }

  if (command === "plan-direct" || command === "apply-direct") {
    const plan = planDirectChanges(state.records, { pagesHostname });
    const proof = options.tlsProof || (await readJsonFile(
      requireString(options.tlsProofPath, "--tls-proof path"),
      "Direct TLS proof",
      readFileImpl
    ));
    validateDirectTlsProof(proof, {
      expectedMainSha,
      pagesHostname,
      records: state.records,
      now: options.now,
      allowUnboundFingerprint: command === "plan-direct",
    });

    if (command === "plan-direct") {
      if (options.repositorySha !== undefined) {
        const repositorySha = normalizeCommitSha(options.repositorySha, "checked-out repository SHA");
        if (repositorySha !== expectedMainSha) {
          throw new Error("Checked-out repository SHA does not equal the expected main SHA");
        }
      }
      return {
        command,
        mode: "read-only",
        zone: zoneName,
        operation: plan.operation,
        eligibleRecordCount: plan.eligible_record_count,
        plannedChangeCount: plan.changes.length,
        adminRecordCount: plan.admin_record_count,
        mutationCount: 0,
      };
    }

    if (
      plan.eligible_record_count < 1 ||
      plan.changes.length !== plan.eligible_record_count
    ) {
      throw new Error(
        "Emergency apply requires every eligible public routing record to start proxied"
      );
    }

    const deliveryPlanValue = options.deliveryPlan || (await readJsonFile(
      requireString(options.deliveryPlanPath, "--delivery-plan path"),
      "Reviewed direct delivery plan",
      readFileImpl
    ));
    let renewalEvidenceContent = options.renewalEvidenceContent;
    if (renewalEvidenceContent === undefined) {
      const evidenceRelativePath =
        deliveryPlanValue.contentOrigin?.longTermCertificateRenewalEvidence?.path;
      if (typeof evidenceRelativePath === "string") {
        if (
          !/^config\/dns\/evidence\/github-pages-renewal-[a-z0-9-]+\.md$/u.test(
            evidenceRelativePath
          )
        ) {
          throw new Error("Reviewed Pages renewal evidence path is outside the fixed repository scope");
        }
        const evidencePath = path.resolve(repositoryRoot, evidenceRelativePath);
        const evidenceRoot = path.join(repositoryRoot, "config", "dns", "evidence");
        const relative = path.relative(evidenceRoot, evidencePath);
        if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
          throw new Error("Reviewed Pages renewal evidence path escaped its repository scope");
        }
        try {
          renewalEvidenceContent = await readFileImpl(evidencePath);
        } catch {
          throw new Error("Reviewed Pages renewal evidence file could not be read");
        }
      }
    }
    validateEmergencyDeliveryPlan(deliveryPlanValue, {
      pagesHostname,
      renewalEvidenceContent,
    });

    const snapshotValue = options.snapshot || (await readJsonFile(
      requireString(options.snapshotPath, "--snapshot path"),
      "Snapshot",
      readFileImpl
    ));
    const snapshot = validateSnapshotDocument(snapshotValue);
    assertCurrentStateMatchesSnapshot(snapshot, state);
    assertProofBoundToSnapshot(proof, snapshot);
    validateMutationGate({
      command,
      expectedMainSha,
      repositorySha: options.repositorySha,
      confirmation: options.confirmation,
      snapshot,
    });
    if (!plan.changes.length) {
      return {
        command,
        mode: "apply",
        zone: zoneName,
        operation: "none",
        plannedChangeCount: 0,
        appliedChangeCount: 0,
        mutationCount: 0,
      };
    }
    try {
      await client.request(
        "POST",
        `/zones/${state.zone.id}/dns_records/batch`,
        directBatchBody(plan)
      );
      const verified = await inspectCloudflareState(client, accountId, zoneName);
      assertPostApplyState(state, verified, plan.changes, plan.admin_records_fingerprint);
    } catch {
      try {
        await compensateFailedDirectApply({
          accountId,
          client,
          pagesHostname,
          snapshot,
          zoneName,
          delayImpl:
            options.reconciliationDelayImpl ||
            ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))),
        });
      } catch {
        throw new Error(
          "Direct apply failed and automatic snapshot restoration could not be verified; use the attested rollback artifact"
        );
      }
      throw new Error("Direct apply failed; the pre-change snapshot was automatically restored");
    }
    return {
      command,
      mode: "apply",
      zone: zoneName,
      operation: plan.operation,
      plannedChangeCount: plan.changes.length,
      appliedChangeCount: plan.changes.length,
      mutationCount: 1,
      verified: true,
    };
  }

  const snapshotValue = options.snapshot || (await readJsonFile(
    requireString(options.snapshotPath, "--snapshot path"),
    "Snapshot",
    readFileImpl
  ));
  const snapshot = validateSnapshotDocument(snapshotValue);
  const rollbackPlan = planRollbackChanges(snapshot, state, { pagesHostname });
  validateMutationGate({
    command,
    expectedMainSha,
    repositorySha: options.repositorySha,
    snapshotMainSha: options.snapshotMainSha,
    confirmation: options.confirmation,
    snapshot,
  });
  if (!rollbackPlan.changes.length) {
    return {
      command,
      mode: "rollback",
      zone: zoneName,
      operation: "none",
      plannedChangeCount: 0,
      appliedChangeCount: 0,
      mutationCount: 0,
    };
  }
  const reconciliationDelayImpl =
    options.reconciliationDelayImpl ||
    ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let pendingPlan = rollbackPlan;
  let rollbackMutationCount = 0;
  let verified;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (pendingPlan.changes.length > 0) {
      rollbackMutationCount += 1;
      try {
        await client.request(
          "POST",
          `/zones/${state.zone.id}/dns_records/batch`,
          rollbackBatchBody(pendingPlan)
        );
      } catch {
        // A missing response does not reveal whether Cloudflare committed the
        // transaction. Decide only from the exact re-read state below.
      }
    }
    await reconciliationDelayImpl(2_000);
    verified = await inspectCloudflareState(client, accountId, zoneName);
    try {
      assertCurrentStateMatchesSnapshot(snapshot, verified);
      break;
    } catch (error) {
      if (attempt === 2) {
        throw new Error(
          "Cloudflare rollback could not verify the exact snapshot after bounded reconciliation"
        );
      }
      pendingPlan = planRollbackChanges(snapshot, verified, { pagesHostname });
      if (pendingPlan.changes.length === 0) throw error;
    }
  }
  return {
    command,
    mode: "rollback",
    zone: zoneName,
    operation: rollbackPlan.operation,
    plannedChangeCount: rollbackPlan.changes.length,
    appliedChangeCount: rollbackPlan.changes.length,
    mutationCount: rollbackMutationCount,
    verified: true,
  };
}

export function parseCliOptions(argv) {
  if (!Array.isArray(argv)) throw new Error("CLI arguments must be an array");
  const commands = new Set([
    "inspect",
    "snapshot",
    "bind-proof",
    "plan-direct",
    "apply-direct",
    "rollback",
  ]);
  let command = "inspect";
  let offset = 0;
  if (argv[0] && !argv[0].startsWith("--")) {
    if (!commands.has(argv[0])) throw new Error("Unknown RU connectivity command");
    command = argv[0];
    offset = 1;
  }
  const values = new Map();
  for (const argument of argv.slice(offset)) {
    const match = argument.match(/^--([a-z][a-z0-9-]*)=(.+)$/u);
    if (!match) throw new Error("Unknown or malformed CLI argument");
    const key = match[1] === "direct-tls-proof" ? "tls-proof" : match[1];
    if (values.has(key)) throw new Error(`Duplicate argument: --${key}`);
    values.set(key, match[2]);
  }
  const allowed = new Set([
    "bound-proof",
    "confirm",
    "delivery-plan",
    "expected-main-sha",
    "pages-hostname",
    "snapshot",
    "snapshot-main-sha",
    "tls-proof",
    "zone",
  ]);
  for (const key of values.keys()) {
    if (!allowed.has(key)) throw new Error("Unknown CLI option");
  }
  const zoneName = values.get("zone") || PUBLIC_ZONE_NAME;
  if (zoneName !== PUBLIC_ZONE_NAME) {
    throw new Error(`This manager is locked to ${PUBLIC_ZONE_NAME}`);
  }
  if (command === "snapshot" && !values.has("snapshot")) {
    throw new Error("snapshot requires --snapshot=PATH");
  }
  if (["bind-proof", "plan-direct", "apply-direct", "rollback"].includes(command)) {
    for (const key of ["expected-main-sha", "pages-hostname"]) {
      if (!values.has(key)) throw new Error(`${command} requires --${key}=VALUE`);
    }
  }
  if (["bind-proof", "plan-direct", "apply-direct"].includes(command) && !values.has("tls-proof")) {
    throw new Error(`${command} requires --tls-proof=PATH`);
  }
  if (["apply-direct", "rollback"].includes(command)) {
    for (const key of ["snapshot", "confirm"]) {
      if (!values.has(key)) throw new Error(`${command} requires --${key}=VALUE`);
    }
  }
  if (command === "apply-direct" && !values.has("delivery-plan")) {
    throw new Error("apply-direct requires --delivery-plan=PATH");
  }
  if (command === "rollback" && !values.has("snapshot-main-sha")) {
    throw new Error("rollback requires --snapshot-main-sha=VALUE");
  }
  if (command === "bind-proof") {
    for (const key of ["snapshot", "bound-proof"]) {
      if (!values.has(key)) throw new Error(`${command} requires --${key}=VALUE`);
    }
  }
  return {
    command,
    zoneName,
    snapshotPath: values.get("snapshot"),
    snapshotMainSha: values.get("snapshot-main-sha"),
    boundProofPath: values.get("bound-proof"),
    tlsProofPath: values.get("tls-proof"),
    expectedMainSha: values.get("expected-main-sha"),
    pagesHostname: values.get("pages-hostname"),
    confirmation: values.get("confirm"),
    deliveryPlanPath: values.get("delivery-plan"),
  };
}

export function readRepositorySha() {
  let output;
  try {
    output = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error("Could not verify the checked-out repository SHA");
  }
  return normalizeCommitSha(output, "checked-out repository SHA");
}

export function summarizeResult(result) {
  const lines = [
    `RU connectivity command: ${result.command}`,
    `Mode: ${result.mode}`,
    `Zone: ${result.zone} (active and account-verified)`,
  ];
  if (result.recordCount !== undefined) lines.push(`DNS records inspected: ${result.recordCount}`);
  if (result.dnssecStatus !== undefined) lines.push(`DNSSEC status: ${result.dnssecStatus}`);
  if (result.plannedChangeCount !== undefined) {
    lines.push(`Public proxy flags planned: ${result.plannedChangeCount}`);
  }
  if (result.appliedChangeCount !== undefined) {
    lines.push(`Public proxy flags applied: ${result.appliedChangeCount}`);
  }
  lines.push(`Cloudflare mutation requests: ${result.mutationCount}`);
  return lines.join("\n");
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.ACCOUNT_ID;
  try {
    const cli = parseCliOptions(process.argv.slice(2));
    const repositorySha = ["bind-proof", "plan-direct", "apply-direct", "rollback"].includes(cli.command)
      ? readRepositorySha()
      : undefined;
    const result = await manageRuConnectivity({
      ...cli,
      token,
      accountId,
      repositorySha,
    });
    console.log(summarizeResult(result));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
      `RU connectivity manager failed: ${redactSensitive(detail, [token, accountId])}`
    );
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (entryPoint === import.meta.url) await main();
