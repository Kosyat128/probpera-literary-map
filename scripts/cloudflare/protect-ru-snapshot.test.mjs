import assert from "node:assert/strict";
import test from "node:test";
import { createSnapshotDocument } from "./manage-ru-connectivity.mjs";
import {
  decryptSnapshot,
  decryptSnapshotWithKeyring,
  encryptSnapshot,
  parseSnapshotKeyring,
  SNAPSHOT_ENVELOPE_SCHEMA,
} from "./protect-ru-snapshot.mjs";

function snapshotFixture() {
  return createSnapshotDocument(
    {
      zone: {
        id: "a".repeat(32),
        name: "probpera.ru",
        status: "active",
        type: "full",
        paused: false,
        account: { id: "b".repeat(32) },
        name_servers: ["magdalena.ns.cloudflare.com", "miguel.ns.cloudflare.com"],
        vanity_name_servers: [],
      },
      records: [
        {
          id: "c".repeat(32),
          zone_id: "a".repeat(32),
          zone_name: "probpera.ru",
          name: "probpera.ru",
          type: "TXT",
          content: "google-site-verification=private-snapshot-fixture",
          ttl: 300,
          proxiable: false,
          proxied: false,
        },
      ],
      dnssec: { status: "disabled" },
      dnsSettings: { zone_mode: "standard" },
    },
    { now: new Date("2026-08-24T00:00:00.000Z") }
  );
}

test("snapshot envelope round-trips without exposing DNS contents", () => {
  let randomCall = 0;
  const envelope = encryptSnapshot(snapshotFixture(), "x".repeat(48), {
    now: new Date("2026-08-24T01:00:00.000Z"),
    randomBytes: (size) => Buffer.alloc(size, ++randomCall),
  });
  assert.equal(envelope.schema, SNAPSHOT_ENVELOPE_SCHEMA);
  assert.doesNotMatch(JSON.stringify(envelope), /private-snapshot-fixture/u);
  assert.deepEqual(decryptSnapshot(envelope, "x".repeat(48)), snapshotFixture());
});

test("wrong key and ciphertext tampering fail authenticated decryption", () => {
  const envelope = encryptSnapshot(snapshotFixture(), "a".repeat(48));
  assert.throws(
    () => decryptSnapshot(envelope, "b".repeat(48)),
    /authentication or payload validation/u
  );
  const tampered = {
    ...envelope,
    ciphertext: `${envelope.ciphertext[0] === "A" ? "B" : "A"}${envelope.ciphertext.slice(1)}`,
  };
  assert.throws(
    () => decryptSnapshot(tampered, "a".repeat(48)),
    /authentication or payload validation/u
  );
});

test("short or missing encryption secrets are rejected", () => {
  assert.throws(() => encryptSnapshot(snapshotFixture(), "short"), /at least 32 bytes/u);
});

test("a retained key ID decrypts snapshot A after active rotation to key B", () => {
  const oldSecret = "a".repeat(48);
  const newSecret = "b".repeat(48);
  const envelope = encryptSnapshot(snapshotFixture(), oldSecret, { keyId: "2026-08-a" });
  const rotatedKeyring = parseSnapshotKeyring(JSON.stringify({
    activeKeyId: "2026-09-b",
    keys: {
      "2026-08-a": oldSecret,
      "2026-09-b": newSecret,
    },
  }));
  assert.deepEqual(
    decryptSnapshotWithKeyring(envelope, rotatedKeyring),
    snapshotFixture()
  );
});

test("unknown or removed key IDs fail closed", () => {
  const envelope = encryptSnapshot(snapshotFixture(), "a".repeat(48), {
    keyId: "retired-key",
  });
  const keyring = parseSnapshotKeyring(JSON.stringify({
    activeKeyId: "active-key",
    keys: { "active-key": "b".repeat(48) },
  }));
  assert.throws(
    () => decryptSnapshotWithKeyring(envelope, keyring),
    /not retained/u
  );
});
