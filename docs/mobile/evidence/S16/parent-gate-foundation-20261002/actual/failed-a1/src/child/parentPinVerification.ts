import type { ParentGateChallenge, ParentVerificationPort, ParentVerificationResult } from "./parentGate";

// This is an internal boundary, not an installed Keychain/Keystore adapter.
// Only a constructor-owned, trusted platform implementation may supply these ports.
// Neither Preferences nor a UI/JSON flag can establish their security properties.
export interface ParentPinRecord {
  readonly schemaVersion: 1;
  readonly policyVersion: string;
  readonly revision: number;
  readonly credentialId: string;
  readonly verifier: Readonly<{
    algorithm: "PBKDF2-HMAC-SHA256";
    iterations: number;
    saltHex: string;
    hashHex: string;
  }>;
  readonly attempts: Readonly<{
    count: number;
    blockedUntilMs: number;
    lastObservedMs: number;
    pendingAttemptId: string | null;
  }>;
}

export interface ParentPinSecureStore {
  /** Atomic, authenticated read; rollback of record/revision must be prevented. */
  read(): Promise<unknown>;
  /** Atomically compare the entire expected record across all processes and commit
   * next durably before resolving true. A lost acknowledgement must never be true.
   * Never translate this into a preference read followed by an ordinary write. */
  compareAndSwap(expected: ParentPinRecord, next: ParentPinRecord): Promise<boolean>;
}

export interface ParentPinInputPort {
  /** Return an owned ephemeral ASCII digit buffer, or null for cancellation.
   * Clear native/UI input, obey AbortSignal and never log or retain its contents. */
  readPin(challenge: ParentGateChallenge, signal: AbortSignal): Promise<Uint8Array | null>;
}

export interface ParentPinKdf {
  /** Trusted implementation; returns an owned 32-byte buffer. No boolean receipts. */
  derive(pin: Uint8Array, salt: Uint8Array, iterations: number): Promise<Uint8Array>;
}

export interface ParentPinVerificationOptions {
  secureStore?: ParentPinSecureStore;
  inputPort?: ParentPinInputPort;
  kdf?: ParentPinKdf;
  /** Stable, trusted time domain across processes/restarts, immune to user clock
   * adjustment. Date.now/performance.now alone cannot satisfy this contract. */
  clock: { nowTrustedMs(): number };
  policy: { version: string; maxIterations: number; backoffDelaysMs: readonly number[] };
}

// PBKDF2-HMAC-SHA256 floor: OWASP Password Storage Cheat Sheet (2026-10-02).
// This is not a claim of device calibration or sufficient PIN entropy on its own.
const MIN_ITERATIONS = 600_000;
const HEX_32 = /^[0-9a-f]{64}$/u;
const MAX_PIN_BYTES = 128;
const safe = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function dataObject(value: unknown, expected: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), fields = Reflect.ownKeys(descriptors);
  if (fields.length !== expected.length || fields.some(key => typeof key !== "string" || !expected.includes(key) ||
    !descriptors[key].enumerable || !("value" in descriptors[key]))) return null;
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of expected) copy[key] = descriptors[key].value;
  return copy;
}
const bytes = (value: unknown): value is Uint8Array => ArrayBuffer.isView(value) && Object.getPrototypeOf(value) === Uint8Array.prototype;
const intrinsicByteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!.get!;
const byteLength = (value: Uint8Array): number => intrinsicByteLength.call(value) as number;
function wipe(value: unknown): void {
  try { if (ArrayBuffer.isView(value)) Uint8Array.prototype.fill.call(value, 0); } catch { /* Invalid/detached output has no authority. */ }
}
const hex = (value: unknown): value is string => typeof value === "string" && HEX_32.test(value);
const fromHex = (value: string) => Uint8Array.from(value.match(/../gu)!, pair => parseInt(pair, 16));
const unavailable = (): ParentVerificationResult => ({ status: "unavailable" });
const denied = (): ParentVerificationResult => ({ status: "denied" });

function decodeRecord(input: unknown, version: string, maxIterations: number): ParentPinRecord | null {
  const data = dataObject(input, ["schemaVersion", "policyVersion", "revision", "credentialId", "verifier", "attempts"]);
  if (!data || data.schemaVersion !== 1 || data.policyVersion !== version || !safe(data.revision) || data.revision < 1 ||
    !hex(data.credentialId)) return null;
  const verifier = dataObject(data.verifier, ["algorithm", "iterations", "saltHex", "hashHex"]),
    attempts = dataObject(data.attempts, ["count", "blockedUntilMs", "lastObservedMs", "pendingAttemptId"]);
  if (!verifier || !attempts || verifier.algorithm !== "PBKDF2-HMAC-SHA256" ||
    !safe(verifier.iterations) || verifier.iterations < MIN_ITERATIONS || verifier.iterations > maxIterations ||
    !hex(verifier.saltHex) || !hex(verifier.hashHex) ||
    !safe(attempts.count) || !safe(attempts.blockedUntilMs) || !safe(attempts.lastObservedMs) ||
    !(attempts.pendingAttemptId === null || hex(attempts.pendingAttemptId)) ||
    (attempts.count === 0 && (attempts.blockedUntilMs !== 0 || attempts.pendingAttemptId !== null)) ||
    (attempts.count > 0 && attempts.blockedUntilMs < attempts.lastObservedMs)) return null;
  return Object.freeze({ schemaVersion: 1, policyVersion: version, revision: data.revision, credentialId: data.credentialId,
    verifier: Object.freeze({ algorithm: "PBKDF2-HMAC-SHA256", iterations: verifier.iterations,
      saltHex: verifier.saltHex, hashHex: verifier.hashHex }),
    attempts: Object.freeze({ count: attempts.count, blockedUntilMs: attempts.blockedUntilMs,
      lastObservedMs: attempts.lastObservedMs, pendingAttemptId: attempts.pendingAttemptId }) });
}

/** No enrollment, fallback, reset, biometric shortcut or actual OS adapter.
 * A cancelled/crashed attempt remains charged. Only durable success finalization
 * can produce a proof for the original controller-owned challenge. */
export function createParentPinVerification(options: ParentPinVerificationOptions): ParentVerificationPort {
  let lastClock = -1, clockFailed = false, busy = false;
  const seen = new WeakSet<object>();
  const store = options.secureStore, input = options.inputPort, kdf = options.kdf;
  const readTime = options.clock?.nowTrustedMs?.bind(options.clock), read = store?.read?.bind(store),
    cas = store?.compareAndSwap?.bind(store), readPin = input?.readPin?.bind(input), derive = kdf?.derive?.bind(kdf);
  const version = options.policy.version, maxIterations = options.policy.maxIterations;
  const delays = [...options.policy.backoffDelaysMs];
  const configured = typeof version === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(version) &&
    safe(maxIterations) && maxIterations >= MIN_ITERATIONS && maxIterations <= 0xffff_ffff && delays.length > 0 &&
    delays.length <= 64 && delays.every((delay, index) => safe(delay) && delay > 0 && (index === 0 || delay > delays[index - 1]));
  function now(): number | null {
    if (clockFailed) return null;
    try {
      const value = readTime?.();
      if (!safe(value) || value < lastClock) { clockFailed = true; return null; }
      lastClock = value; return value;
    } catch { clockFailed = true; return null; }
  }
  return Object.freeze({ async verify(challenge: ParentGateChallenge, signal: AbortSignal): Promise<ParentVerificationResult> {
    if (!configured || !read || !cas || !readPin || !derive || !readTime || clockFailed) return unavailable();
    if (busy || signal.aborted || !challenge || !hex(challenge.id) || seen.has(challenge)) return denied();
    seen.add(challenge); busy = true;
    let supplied: Uint8Array | null = null, pin: Uint8Array | null = null, salt: Uint8Array | null = null,
      expectedHash: Uint8Array | null = null, derived: Uint8Array | null = null;
    try {
      const record = decodeRecord(await read(), version, maxIterations);
      if (!record) return unavailable();
      const initialNow = now();
      if (initialNow === null || initialNow < record.attempts.lastObservedMs) { clockFailed = true; return unavailable(); }
      if (signal.aborted) return denied();
      if (initialNow < record.attempts.blockedUntilMs) return { status: "blocked" };
      supplied = await readPin(challenge, signal);
      if (supplied === null || signal.aborted) return denied();
      if (!bytes(supplied) || byteLength(supplied) === 0 || byteLength(supplied) > MAX_PIN_BYTES) return denied();
      pin = new Uint8Array(supplied); wipe(supplied); supplied = null;
      const reservedAt = now();
      if (reservedAt === null || reservedAt < record.attempts.lastObservedMs) return unavailable();
      const count = record.attempts.count + 1, revision = record.revision + 1;
      const delay = delays[Math.min(count - 1, delays.length - 1)], blockedUntilMs = reservedAt + delay;
      if (!safe(count) || !safe(revision) || !safe(blockedUntilMs)) return unavailable();
      const reservation: ParentPinRecord = Object.freeze({ ...record, revision,
        attempts: Object.freeze({ count, blockedUntilMs, lastObservedMs: reservedAt, pendingAttemptId: challenge.id }) });
      if (signal.aborted) return denied();
      if (await cas(record, reservation) !== true) return denied();
      if (signal.aborted) return denied();
      // Malformed PIN submissions are charged, rather than giving free attempts.
      const digits = pin.every(byte => byte >= 48 && byte <= 57);
      if (digits) {
        salt = fromHex(record.verifier.saltHex); expectedHash = fromHex(record.verifier.hashHex);
        derived = await derive(pin, salt, record.verifier.iterations);
      }
      wipe(pin); pin = null;
      if (signal.aborted) return denied();
      if (digits && (!bytes(derived) || byteLength(derived) !== 32)) return unavailable();
      let difference = digits ? 0 : 1;
      if (digits) for (let index = 0; index < 32; index++) difference |= derived![index] ^ expectedHash![index];
      const latest = decodeRecord(await read(), version, maxIterations);
      if (!latest || JSON.stringify(latest) !== JSON.stringify(reservation)) return denied();
      const completedAt = now();
      if (completedAt === null || completedAt < latest.attempts.lastObservedMs) return unavailable();
      const nextRevision = latest.revision + 1;
      const retryAt = difference === 0 ? 0 : Math.max(latest.attempts.blockedUntilMs, completedAt + delay);
      if (!safe(nextRevision) || !safe(retryAt)) return unavailable();
      const final: ParentPinRecord = Object.freeze({ ...latest, revision: nextRevision,
        attempts: Object.freeze({ count: difference === 0 ? 0 : count, blockedUntilMs: retryAt,
          lastObservedMs: completedAt, pendingAttemptId: null }) });
      if (signal.aborted) return denied();
      if (await cas(latest, final) !== true) return denied();
      if (signal.aborted || now() === null) return denied();
      return difference === 0 ? { status: "verified", challenge } : denied();
    } catch { return unavailable(); }
    finally {
      wipe(supplied); wipe(pin); wipe(salt); wipe(expectedHash); wipe(derived);
      busy = false;
    }
  } });
}

/** PBKDF2 with fixed SHA-256 and 256-bit output, using the standard Web Crypto API.
 * Native secure storage/time and calibrated policy are still separate requirements.
 * Managed buffers are wiped; the runtime's non-extractable CryptoKey lifecycle is
 * controlled by Web Crypto and cannot be explicitly erased from JavaScript. */
export function createWebCryptoParentPinKdf(cryptoPort: Pick<Crypto, "subtle"> | undefined = globalThis.crypto): ParentPinKdf | undefined {
  if (!cryptoPort?.subtle) return undefined;
  const subtle = cryptoPort.subtle;
  return Object.freeze({ async derive(pin: Uint8Array, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
    if (!bytes(pin) || byteLength(pin) === 0 || byteLength(pin) > MAX_PIN_BYTES ||
      !bytes(salt) || byteLength(salt) !== 32 || !safe(iterations) || iterations < MIN_ITERATIONS ||
      iterations > 0xffff_ffff) throw new Error("Parent PIN derivation unavailable");
    const pinCopy = new Uint8Array(pin), saltCopy = new Uint8Array(salt);
    try {
      const key = await subtle.importKey("raw", pinCopy, { name: "PBKDF2" }, false, ["deriveBits"]);
      pinCopy.fill(0);
      return new Uint8Array(await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltCopy, iterations }, key, 256));
    } finally { pinCopy.fill(0); saltCopy.fill(0); }
  } });
}
