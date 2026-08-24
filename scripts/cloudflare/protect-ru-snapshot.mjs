import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes as cryptoRandomBytes,
} from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  stableStringify,
  validateSnapshotDocument,
} from "./manage-ru-connectivity.mjs";

export const SNAPSHOT_ENVELOPE_SCHEMA = "probpera-cloudflare-snapshot-envelope/v2";
const KEY_INFO = Buffer.from("probpera.ru/connectivity-snapshot/aes-256-gcm/v2", "utf8");
const keyIdPattern = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/u;
const expectedEnvelopeKeys = [
  "cipher",
  "ciphertext",
  "createdAt",
  "iv",
  "kdf",
  "keyId",
  "salt",
  "schema",
  "tag",
];

function requireSecret(secret) {
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Snapshot encryption key must contain at least 32 bytes");
  }
  return Buffer.from(secret, "utf8");
}

function encode(value) {
  return Buffer.from(value).toString("base64");
}

function decode(value, name, expectedLength) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) {
    throw new Error(`${name} is not valid base64`);
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== expectedLength || encode(decoded) !== value) {
    throw new Error(`${name} has an invalid encoded length`);
  }
  return decoded;
}

function deriveKey(secret, salt) {
  return Buffer.from(hkdfSync("sha256", requireSecret(secret), salt, KEY_INFO, 32));
}

function requireKeyId(keyId) {
  if (typeof keyId !== "string" || !keyIdPattern.test(keyId)) {
    throw new Error("Snapshot key ID is invalid");
  }
  return keyId;
}

function envelopeHeader({ createdAt, keyId, salt, iv }) {
  return {
    schema: SNAPSHOT_ENVELOPE_SCHEMA,
    kdf: "HKDF-SHA256",
    cipher: "AES-256-GCM",
    createdAt,
    keyId: requireKeyId(keyId),
    salt: encode(salt),
    iv: encode(iv),
  };
}

export function encryptSnapshot(
  snapshotValue,
  secret,
  { keyId = "default", now = new Date(), randomBytes = cryptoRandomBytes } = {}
) {
  const snapshot = validateSnapshotDocument(snapshotValue);
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error("Envelope time is invalid");
  const salt = Buffer.from(randomBytes(16));
  const iv = Buffer.from(randomBytes(12));
  if (salt.length !== 16 || iv.length !== 12) throw new Error("Secure random source failed");
  const header = envelopeHeader({ createdAt: date.toISOString(), keyId, salt, iv });
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, salt), iv);
  cipher.setAAD(Buffer.from(stableStringify(header), "utf8"));
  const plaintext = Buffer.from(JSON.stringify(snapshot), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ...header,
    ciphertext: encode(ciphertext),
    tag: encode(tag),
  };
}

export function decryptSnapshot(envelopeValue, secret) {
  if (!envelopeValue || typeof envelopeValue !== "object" || Array.isArray(envelopeValue)) {
    throw new Error("Encrypted snapshot envelope must be an object");
  }
  const keys = Object.keys(envelopeValue).sort();
  if (
    keys.length !== expectedEnvelopeKeys.length ||
    keys.some((key, index) => key !== [...expectedEnvelopeKeys].sort()[index])
  ) {
    throw new Error("Encrypted snapshot envelope fields are invalid");
  }
  if (
    envelopeValue.schema !== SNAPSHOT_ENVELOPE_SCHEMA ||
    envelopeValue.kdf !== "HKDF-SHA256" ||
    envelopeValue.cipher !== "AES-256-GCM" ||
    !Number.isFinite(Date.parse(envelopeValue.createdAt))
  ) {
    throw new Error("Encrypted snapshot envelope metadata is invalid");
  }
  const salt = decode(envelopeValue.salt, "Envelope salt", 16);
  const iv = decode(envelopeValue.iv, "Envelope IV", 12);
  const tag = decode(envelopeValue.tag, "Envelope authentication tag", 16);
  const ciphertext = decode(
    envelopeValue.ciphertext,
    "Envelope ciphertext",
    Buffer.from(envelopeValue.ciphertext, "base64").length
  );
  const header = envelopeHeader({
    createdAt: envelopeValue.createdAt,
    keyId: envelopeValue.keyId,
    salt,
    iv,
  });
  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret, salt), iv);
    decipher.setAAD(Buffer.from(stableStringify(header), "utf8"));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return validateSnapshotDocument(JSON.parse(plaintext.toString("utf8")));
  } catch {
    throw new Error("Encrypted snapshot authentication or payload validation failed");
  }
}

export function parseSnapshotKeyring(serialized) {
  let value;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error("Snapshot keyring must be valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Snapshot keyring must be an object");
  }
  const topLevelKeys = Object.keys(value).sort();
  if (topLevelKeys.join(",") !== "activeKeyId,keys") {
    throw new Error("Snapshot keyring fields are invalid");
  }
  const activeKeyId = requireKeyId(value.activeKeyId);
  if (!value.keys || typeof value.keys !== "object" || Array.isArray(value.keys)) {
    throw new Error("Snapshot keyring keys must be an object");
  }
  const keyEntries = Object.entries(value.keys);
  if (keyEntries.length < 1 || keyEntries.length > 16) {
    throw new Error("Snapshot keyring must contain between 1 and 16 keys");
  }
  const keys = {};
  for (const [keyId, secret] of keyEntries) {
    requireKeyId(keyId);
    requireSecret(secret);
    keys[keyId] = secret;
  }
  if (!Object.hasOwn(keys, activeKeyId)) {
    throw new Error("Snapshot keyring active key is missing");
  }
  return { activeKeyId, keys };
}

export function decryptSnapshotWithKeyring(envelope, keyring) {
  const keyId = requireKeyId(envelope?.keyId);
  if (!Object.hasOwn(keyring.keys, keyId)) {
    throw new Error("Snapshot key ID is not retained in the keyring");
  }
  return decryptSnapshot(envelope, keyring.keys[keyId]);
}

function parseCli(argv) {
  const command = argv[0];
  if (!['encrypt', 'decrypt'].includes(command)) {
    throw new Error("Usage: protect-ru-snapshot.mjs encrypt|decrypt --input=PATH --output=PATH");
  }
  const values = new Map();
  for (const argument of argv.slice(1)) {
    const match = argument.match(/^--(input|output)=(.+)$/u);
    if (!match || values.has(match[1])) throw new Error(`Invalid argument: ${argument}`);
    values.set(match[1], match[2]);
  }
  if (!values.has("input") || !values.has("output")) {
    throw new Error("Both --input and --output are required");
  }
  return { command, input: values.get("input"), output: values.get("output") };
}

async function writeNewJson(filePath, value) {
  try {
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("Output path already exists");
    throw new Error("Protected snapshot output could not be written");
  }
}

export async function main(argv = process.argv.slice(2), environment = process.env) {
  const options = parseCli(argv);
  let input;
  try {
    input = JSON.parse(await readFile(options.input, "utf8"));
  } catch {
    throw new Error("Protected snapshot input could not be read as JSON");
  }
  const serializedKeyring = environment.RU_CONNECTIVITY_SNAPSHOT_KEYRING_JSON;
  const keyring = serializedKeyring ? parseSnapshotKeyring(serializedKeyring) : null;
  const fallbackSecret =
    environment.RU_CONNECTIVITY_SNAPSHOT_ENCRYPTION_KEY ||
    environment.CLOUDFLARE_API_TOKEN;
  if (!keyring && !fallbackSecret) {
    throw new Error("Snapshot encryption keyring or disposable fallback secret is unavailable");
  }
  const output = options.command === "encrypt"
    ? encryptSnapshot(
        input,
        keyring ? keyring.keys[keyring.activeKeyId] : fallbackSecret,
        {
          keyId: keyring
            ? keyring.activeKeyId
            : environment.RU_CONNECTIVITY_SNAPSHOT_ENCRYPTION_KEY
              ? "legacy-dedicated"
              : "disposable-cloudflare-token",
        }
      )
    : keyring
      ? decryptSnapshotWithKeyring(input, keyring)
      : decryptSnapshot(input, fallbackSecret);
  await writeNewJson(options.output, output);
  console.log(
    options.command === "encrypt"
      ? "Cloudflare snapshot encrypted for short-lived artifact storage."
      : "Cloudflare snapshot authenticated and decrypted on the ephemeral runner."
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  try {
    await main();
  } catch (error) {
    console.error(`Snapshot protection failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
