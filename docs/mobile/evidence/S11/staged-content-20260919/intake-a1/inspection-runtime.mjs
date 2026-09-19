// node_modules/@noble/hashes/esm/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error("Uint8Array expected of length " + lengths + ", got length=" + b.length);
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
var hasHexBuiltin = /* @__PURE__ */ (() => (
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
))();
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  abytes(data);
  return data;
}
var Hash = class {
};
function createHasher(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}

// node_modules/@noble/hashes/esm/_md.js
function setBigUint64(view, byteOffset, value, isLE) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE);
  const _32n = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n & _u32_max);
  const wl = Number(value & _u32_max);
  const h = isLE ? 4 : 0;
  const l = isLE ? 0 : 4;
  view.setUint32(byteOffset + h, wh, isLE);
  view.setUint32(byteOffset + l, wl, isLE);
}
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class extends Hash {
  constructor(blockLen, outputLen, padOffset, isLE) {
    super();
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to || (to = new this.constructor());
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);

// node_modules/@noble/hashes/esm/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA256 = class extends HashMD {
  constructor(outputLen = 32) {
    super(64, outputLen, 8, false);
    this.A = SHA256_IV[0] | 0;
    this.B = SHA256_IV[1] | 0;
    this.C = SHA256_IV[2] | 0;
    this.D = SHA256_IV[3] | 0;
    this.E = SHA256_IV[4] | 0;
    this.F = SHA256_IV[5] | 0;
    this.G = SHA256_IV[6] | 0;
    this.H = SHA256_IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var sha256 = /* @__PURE__ */ createHasher(() => new SHA256());

// src/planet/contentPackageProtocol.mjs
var encoder = new TextEncoder();
var PURPOSE = "literary-planet-content-data";
var ENVIRONMENT = "local-qa";
var MANIFEST_CONTRACT = "literary-planet-data-package-v1";
var SIGNATURE_CONTRACT = "literary-planet-data-package-signature-v1";
var SHA2562 = /^[a-f0-9]{64}$/u;
var MAX_FILE_BYTES = 16 * 1024 * 1024;
var MAX_PACKAGE_BYTES = 64 * 1024 * 1024;
var MANIFEST_KEYS = [
  "schemaVersion",
  "contract",
  "purpose",
  "environment",
  "releaseReady",
  "packageId",
  "version",
  "sourceCommit",
  "locales",
  "namespace",
  "childPolicy",
  "compatibility",
  "files"
];
var hash = (bytes) => bytesToHex(sha256(typeof bytes === "string" ? encoder.encode(bytes) : bytes));
var fail = (reason) => {
  throw new Error(reason);
};
var plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function exact(value, keys, reason) {
  if (!plain(value) || Reflect.ownKeys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value"))) fail(reason);
}
function contentPackageCanonicalJson(value) {
  let nodes = 0;
  const active = /* @__PURE__ */ new Set();
  function normalize(input, depth) {
    if (++nodes > 3e5 || depth > 48) fail("json-structure-limit");
    if (input === null || typeof input === "boolean" || typeof input === "string") return input;
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (!plain(input) && !Array.isArray(input) || active.has(input)) fail("invalid-plain-json");
    active.add(input);
    let result2;
    if (Array.isArray(input)) {
      if (input.length > 1e5 || Object.keys(input).length !== input.length) fail("invalid-json-array");
      result2 = Array.from({ length: input.length }, (_, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(input, index);
        if (!descriptor || !Object.hasOwn(descriptor, "value")) fail("json-accessor-rejected");
        return normalize(descriptor.value, depth + 1);
      });
    } else {
      result2 = /* @__PURE__ */ Object.create(null);
      const keys = Reflect.ownKeys(input);
      if (keys.some((key) => typeof key !== "string")) fail("unsafe-json-key");
      for (const key of keys.sort()) {
        if (["__proto__", "constructor", "prototype"].includes(key)) fail("unsafe-json-key");
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (!Object.hasOwn(descriptor, "value")) fail("json-accessor-rejected");
        result2[key] = normalize(descriptor.value, depth + 1);
      }
    }
    active.delete(input);
    return result2;
  }
  const result = JSON.stringify(normalize(value, 0));
  if (encoder.encode(result).byteLength > MAX_FILE_BYTES) fail("json-byte-limit");
  return result;
}
function dataPath(value) {
  if (typeof value !== "string" || value.length > 240 || value !== value.normalize("NFC") || !/^[\p{L}\p{N}._-]+(?:\/[\p{L}\p{N}._-]+)*\.json$/u.test(value) || value.split("/").some((part) => part === "." || part === ".." || part.endsWith(".") || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part)) || /^(?:assets|runtime|app|planet|scripts?|modules?)(?:\/|\.)/iu.test(value) || /(?:^|\/)(?:index|service-worker|sw|manifest|package|tsconfig)\.json$/iu.test(value)) fail("unsafe-data-file-path");
  return value;
}
function inspectDataBytes(value) {
  if (typeof value !== "string" && !(value instanceof Uint8Array)) fail("data-file-bytes-required");
  const bytes = typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) fail("data-file-byte-limit");
  let source, parsed;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = JSON.parse(source);
  } catch {
    fail("invalid-utf8-json-data");
  }
  if (!plain(parsed) && !Array.isArray(parsed)) fail("structured-json-data-required");
  const stack = [];
  let tokens = 0;
  for (const match of source.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],]/gu)) {
    if (++tokens > 6e5) fail("json-structure-limit");
    const token = match[0], current = stack.at(-1);
    if (token === "{") stack.push({ keys: /* @__PURE__ */ new Set(), expectingKey: true });
    else if (token === "[") stack.push(null);
    else if (token === "}" || token === "]") stack.pop();
    else if (token === "," && current) current.expectingKey = true;
    else if (token.startsWith('"') && current?.expectingKey) {
      const key = JSON.parse(token);
      if (current.keys.has(key)) fail("duplicate-json-data-key");
      current.keys.add(key);
      current.expectingKey = false;
    }
  }
  contentPackageCanonicalJson(parsed);
  function inspect(item, field = "") {
    if (typeof item === "string") {
      if (/^(?:text|description|biography|title|quote|label|sourceUrl|evidenceUrl)$/u.test(field)) return;
      if (/^\s*(?:javascript:|data:|file:|blob:)/iu.test(item) || /^(?:https?:)?\/\/[^\s]+\.(?:[cm]?js|wasm)(?:[?#]|$)/iu.test(item)) fail("executable-data-reference-rejected");
    } else if (Array.isArray(item)) item.forEach((child) => inspect(child, field));
    else if (plain(item)) for (const [key, child] of Object.entries(item)) {
      if (/^(?:scripts?|executable|runtime|remoteRuntime|module(?:Source|Url)?|webview(?:Url)?|onload|onerror)$/iu.test(key)) {
        fail("executable-data-field-rejected");
      }
      inspect(child, key);
    }
  }
  inspect(parsed);
  return { bytes, header: plain(parsed) ? parsed : null };
}
function actualInventory(files, context) {
  if (!Array.isArray(files) || files.length < 2 || files.length > 128) fail("invalid-data-file-count");
  const seen = /* @__PURE__ */ new Set();
  let total = 0;
  const result = files.map((file) => {
    exact(file, ["path", "bytes"], "invalid-data-file");
    const path = dataPath(file.path), key = path.toLowerCase();
    if (seen.has(key)) fail("duplicate-data-file-path");
    seen.add(key);
    const { bytes, header } = inspectDataBytes(file.bytes);
    const expectedLocale = /^(ru|en)\//u.exec(path)?.[1];
    if (expectedLocale && header?.locale !== expectedLocale) fail("data-file-locale-mismatch");
    if (expectedLocale && (header.schemaVersion !== 1 || header.contract !== "literary-planet-content-candidate-v1" || header.sourceCommit !== context.sourceCommit || header.namespace !== context.namespace || header.releaseReady !== false)) {
      fail("data-file-context-mismatch");
    }
    total += bytes.length;
    if (total > MAX_PACKAGE_BYTES) fail("package-byte-limit");
    return { path, bytes: bytes.length, sha256: hash(bytes) };
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  if (!["ru/", "en/"].every((prefix) => result.some((file) => file.path.startsWith(prefix)))) fail("bilingual-data-files-required");
  return result;
}
function policy(value, namespace) {
  if (namespace === "adult") {
    if (value !== null) fail("adult-child-policy-conflict");
    return null;
  }
  if (namespace !== "child") fail("invalid-package-namespace");
  exact(value, ["policyId", "version", "sha256"], "exact-child-policy-required");
  if (typeof value.policyId !== "string" || !/^[a-z0-9][a-z0-9._-]{0,95}$/u.test(value.policyId) || typeof value.version !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/u.test(value.version) || typeof value.sha256 !== "string" || !SHA2562.test(value.sha256)) fail("invalid-child-policy");
  return { policyId: value.policyId, version: value.version, sha256: value.sha256 };
}
function normalizeManifest(input) {
  contentPackageCanonicalJson(input);
  exact(input, MANIFEST_KEYS, "invalid-package-manifest-schema");
  if (input.schemaVersion !== 1 || input.contract !== MANIFEST_CONTRACT || input.purpose !== PURPOSE || input.environment !== ENVIRONMENT || input.releaseReady !== false) fail("unsupported-package-purpose-or-environment");
  if (typeof input.packageId !== "string" || !/^[a-z0-9][a-z0-9._-]{0,95}$/u.test(input.packageId) || !Number.isSafeInteger(input.version) || input.version < 1 || typeof input.sourceCommit !== "string" || !/^[a-f0-9]{40}$/u.test(input.sourceCommit)) fail("invalid-package-identity");
  if (!Array.isArray(input.locales) || input.locales.length !== 2 || input.locales[0] !== "ru" || input.locales[1] !== "en") fail("exact-bilingual-locales-required");
  const childPolicy = policy(input.childPolicy, input.namespace);
  exact(input.compatibility, ["catalogSchemaVersion", "minimumReaderVersion", "maximumReaderVersion"], "invalid-package-compatibility");
  if (input.compatibility.catalogSchemaVersion !== 1 || !Number.isSafeInteger(input.compatibility.minimumReaderVersion) || !Number.isSafeInteger(input.compatibility.maximumReaderVersion) || input.compatibility.minimumReaderVersion < 1 || input.compatibility.maximumReaderVersion > 1e6 || input.compatibility.maximumReaderVersion < input.compatibility.minimumReaderVersion) fail("invalid-package-compatibility");
  if (!Array.isArray(input.files) || input.files.length < 2 || input.files.length > 128) fail("invalid-data-file-count");
  const seen = /* @__PURE__ */ new Set();
  let total = 0;
  const files = input.files.map((file) => {
    exact(file, ["path", "bytes", "sha256"], "invalid-file-inventory-record");
    const path = dataPath(file.path), key = path.toLowerCase();
    if (seen.has(key)) fail("duplicate-data-file-path");
    seen.add(key);
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > MAX_FILE_BYTES || typeof file.sha256 !== "string" || !SHA2562.test(file.sha256)) fail("invalid-file-inventory-record");
    total += file.bytes;
    if (total > MAX_PACKAGE_BYTES) fail("package-byte-limit");
    return { path, bytes: file.bytes, sha256: file.sha256 };
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  if (!["ru/", "en/"].every((prefix) => files.some((file) => file.path.startsWith(prefix)))) fail("bilingual-data-files-required");
  return {
    schemaVersion: 1,
    contract: MANIFEST_CONTRACT,
    purpose: PURPOSE,
    environment: ENVIRONMENT,
    releaseReady: false,
    packageId: input.packageId,
    version: input.version,
    sourceCommit: input.sourceCommit,
    locales: ["ru", "en"],
    namespace: input.namespace,
    childPolicy,
    compatibility: { ...input.compatibility },
    files
  };
}
function keyId(value) {
  if (typeof value !== "string" || !/^content-qa-[A-Za-z0-9_-]{1,64}$/u.test(value)) fail("dedicated-content-qa-key-id-required");
  return value;
}
function protectedBytes(manifest, id) {
  return encoder.encode(`${SIGNATURE_CONTRACT}\0${contentPackageCanonicalJson({
    algorithm: "ES256",
    contract: SIGNATURE_CONTRACT,
    purpose: PURPOSE,
    environment: ENVIRONMENT,
    keyId: id,
    manifest
  })}`);
}
function normalizeContentPackageExpected(input) {
  exact(input, ["packageId", "version", "sourceCommit", "namespace", "childPolicy", "readerVersion"], "exact-reader-context-required");
  contentPackageCanonicalJson(input);
  if (typeof input.packageId !== "string" || !/^[a-z0-9][a-z0-9._-]{0,95}$/u.test(input.packageId) || !Number.isSafeInteger(input.version) || input.version < 1 || typeof input.sourceCommit !== "string" || !/^[a-f0-9]{40}$/u.test(input.sourceCommit) || !Number.isSafeInteger(input.readerVersion) || input.readerVersion < 1 || input.readerVersion > 1e6) fail("exact-reader-context-required");
  const childPolicy = policy(input.childPolicy, input.namespace);
  return {
    packageId: input.packageId,
    version: input.version,
    sourceCommit: input.sourceCommit,
    namespace: input.namespace,
    childPolicy,
    readerVersion: input.readerVersion
  };
}
function inspectContentPackageEnvelope(envelope, expected) {
  contentPackageCanonicalJson(envelope);
  exact(envelope, ["contract", "algorithm", "keyId", "manifest", "signature"], "invalid-signature-envelope");
  if (envelope.contract !== SIGNATURE_CONTRACT || envelope.algorithm !== "ES256") fail("unsupported-signature-contract");
  keyId(envelope.keyId);
  const manifest = normalizeManifest(envelope.manifest);
  expected = normalizeContentPackageExpected(expected);
  if (!["packageId", "version", "sourceCommit", "namespace"].every((key) => expected[key] === manifest[key]) || contentPackageCanonicalJson(expected.childPolicy) !== contentPackageCanonicalJson(manifest.childPolicy)) fail("package-context-mismatch");
  if (!Number.isSafeInteger(expected.readerVersion) || expected.readerVersion < manifest.compatibility.minimumReaderVersion || expected.readerVersion > manifest.compatibility.maximumReaderVersion) fail("incompatible-package-reader");
  return { manifest, keyId: envelope.keyId, signature: envelope.signature };
}
function decodeContentPackageSignature(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{86}$/u.test(value)) fail("invalid-signature-encoding");
  const bytes = Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/") + "=="), (char) => char.charCodeAt(0));
  const encoded = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  if (bytes.length !== 64 || encoded !== value) fail("invalid-signature-encoding");
  return bytes;
}

// src/planet/verifyContentPackage.ts
function fail2(reason) {
  throw new Error(reason);
}
var hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
function coordinate(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(value)) return fail2("invalid-trusted-content-key");
  const decoded = atob(value.replace(/-/gu, "+").replace(/_/gu, "/") + "=");
  if (decoded.length !== 32 || btoa(decoded).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "") !== value) return fail2("invalid-trusted-content-key");
  return value;
}
function normalizeContentPackageTrust(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return fail2("trusted-content-keys-required");
  contentPackageCanonicalJson(value);
  const ids2 = /* @__PURE__ */ new Set(), points = /* @__PURE__ */ new Set();
  return Object.freeze(value.map((item) => {
    exact(item, ["keyId", "purpose", "environment", "jwk"], "invalid-trusted-content-key");
    const id = keyId(item.keyId);
    if (item.purpose !== PURPOSE || item.environment !== ENVIRONMENT || ids2.has(id)) return fail2("invalid-trusted-content-key");
    ids2.add(id);
    const key = item.jwk;
    if (!key || typeof key !== "object" || Array.isArray(key) || Object.keys(key).some((field) => !["kty", "crv", "x", "y", "alg", "use", "key_ops", "ext", "kid"].includes(field)) || key.kty !== "EC" || key.crv !== "P-256" || hasOwn(key, "alg") && key.alg !== "ES256" || hasOwn(key, "use") && key.use !== "sig" || hasOwn(key, "ext") && typeof key.ext !== "boolean" || hasOwn(key, "kid") && key.kid !== id || hasOwn(key, "key_ops") && (!Array.isArray(key.key_ops) || key.key_ops.length !== 1 || key.key_ops[0] !== "verify")) return fail2("invalid-trusted-content-key");
    const x = coordinate(key.x), y = coordinate(key.y), point = x + ":" + y;
    if (points.has(point)) return fail2("duplicate-trusted-content-key");
    points.add(point);
    return Object.freeze({
      keyId: id,
      purpose: PURPOSE,
      environment: ENVIRONMENT,
      jwk: Object.freeze({ kty: "EC", crv: "P-256", x, y })
    });
  }));
}
async function abortable(operation, signal) {
  if (!signal) return operation;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(value);
    };
    const abort = () => finish(new Error("cancelled"));
    operation.then((value) => finish(null, value), (error) => finish(error));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
function signatureContext(input) {
  const signal = input.signal;
  if (signal?.aborted) fail2("cancelled");
  const { manifest, keyId: keyId2, signature: encoded } = inspectContentPackageEnvelope(input.envelope, input.expected);
  const trusted = normalizeContentPackageTrust(input.trustedKeys);
  if (!trusted.some((key) => key.keyId === keyId2)) fail2("unknown-content-key");
  const signature = decodeContentPackageSignature(encoded), signingBytes = protectedBytes(manifest, keyId2);
  const manifestHash = hash(contentPackageCanonicalJson(manifest));
  const subtle = input.subtle === void 0 ? globalThis.crypto?.subtle : input.subtle;
  return { signal, manifest, keyId: keyId2, trusted, signature, signingBytes, manifestHash, subtle };
}
async function verifySignature(context) {
  const { signal, trusted, keyId: keyId2, signature, signingBytes, subtle } = context;
  if (!subtle) fail2("crypto-unavailable");
  let selected;
  for (const key of trusted) {
    let imported;
    try {
      imported = await abortable(subtle.importKey("jwk", { ...key.jwk }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]), signal);
    } catch {
      fail2(signal?.aborted ? "cancelled" : "invalid-trusted-content-key");
    }
    if (key.keyId === keyId2) selected = imported;
  }
  if (!selected) fail2("unknown-content-key");
  let valid;
  try {
    valid = await abortable(subtle.verify({ name: "ECDSA", hash: "SHA-256" }, selected, signature, signingBytes), signal);
  } catch {
    fail2(signal?.aborted ? "cancelled" : "invalid-content-signature");
  }
  if (!valid) fail2("invalid-content-signature");
  if (signal?.aborted) fail2("cancelled");
}
function unverifiedResult() {
  return {
    verified: false,
    activationAllowed: false,
    childModeEnabled: false,
    releaseReady: false,
    environment: ENVIRONMENT,
    manifestSha256: null,
    reason: null
  };
}
async function verifyContentPackageManifest(input) {
  const result = { ...unverifiedResult(), manifest: null };
  try {
    const context = signatureContext(input);
    await verifySignature(context);
    result.verified = true;
    result.manifestSha256 = context.manifestHash;
    result.manifest = context.manifest;
  } catch (error) {
    result.reason = error instanceof Error ? error.message : "invalid-package-input";
  }
  return Object.freeze(result);
}
async function verifyContentPackage(input) {
  const result = unverifiedResult();
  try {
    const context = signatureContext(input);
    const inventory = actualInventory(input.files, context.manifest);
    if (contentPackageCanonicalJson(inventory) !== contentPackageCanonicalJson(context.manifest.files)) fail2("package-file-integrity-mismatch");
    await verifySignature(context);
    result.verified = true;
    result.manifestSha256 = context.manifestHash;
  } catch (error) {
    result.reason = error instanceof Error ? error.message : "invalid-package-input";
  }
  return Object.freeze(result);
}

// src/planet/contentPackageTransport.ts
function fail3(reason) {
  throw new Error(reason);
}
function normalizeContentPackageBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return fail3("invalid-content-package-url");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.href !== value || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/") || url.protocol !== "https:" && !(local && url.protocol === "http:")) fail3("invalid-content-package-url");
  return url.href;
}
async function downloadContentPackageFile(options) {
  const base = normalizeContentPackageBaseUrl(options.baseUrl), file = { ...options.file };
  const timeout = options.idleTimeoutMs ?? 3e4, signal = options.signal, fetch = options.fetch, onBytes = options.onBytes;
  if (!Number.isSafeInteger(timeout) || timeout < 10 || timeout > 6e4) fail3("invalid-content-download-timeout");
  if (!Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > 16 * 1024 * 1024 || typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(file.sha256) || typeof file.path !== "string" || !/^[\p{L}\p{N}._-]+(?:\/[\p{L}\p{N}._-]+)*\.json$/u.test(file.path) || file.path.split("/").some((part) => part === "." || part === "..")) fail3("invalid-content-download-file");
  const url = new URL(file.path.split("/").map(encodeURIComponent).join("/"), base).href;
  if (!url.startsWith(base)) fail3("invalid-content-package-url");
  const controller = new AbortController();
  let timer;
  let reason, reader;
  const stop = (nextReason) => {
    if (!controller.signal.aborted) {
      reason = nextReason;
      controller.abort();
    }
  };
  const abort = () => stop("cancelled");
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => stop("content-download-timeout"), timeout);
  };
  const check = () => {
    if (controller.signal.aborted) fail3(reason ?? "cancelled");
  };
  const pending = async (operation) => new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      controller.signal.removeEventListener("abort", aborted);
      if (error) reject(error);
      else resolve(value);
    };
    const aborted = () => finish(new Error(reason ?? "cancelled"));
    operation.then((value) => finish(null, value), (error) => finish(error));
    controller.signal.addEventListener("abort", aborted, { once: true });
    if (controller.signal.aborted) aborted();
  });
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  try {
    check();
    arm();
    const response = await pending(fetch(url, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      mode: "cors",
      signal: controller.signal,
      headers: { Accept: "application/json" }
    }));
    check();
    arm();
    if (response.status !== 200 || response.redirected || response.type === "opaque" || response.url && response.url !== url) fail3("invalid-content-download-response");
    const mime = response.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
    if (mime !== "application/json" && !/^application\/[a-z0-9.+-]+\+json$/u.test(mime ?? "")) fail3("invalid-content-download-type");
    if (!response.body) fail3("incomplete-content-download");
    reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    while (true) {
      check();
      const { done, value } = await pending(reader.read());
      check();
      arm();
      if (done) break;
      length += value.byteLength;
      if (length > file.bytes) fail3("content-download-byte-limit");
      chunks.push(new Uint8Array(value));
      try {
        onBytes?.(length);
      } catch {
      }
    }
    if (length !== file.bytes) fail3("incomplete-content-download");
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (hash(bytes) !== file.sha256) fail3("content-download-integrity-mismatch");
    check();
    return bytes;
  } catch (error) {
    if (!controller.signal.aborted) {
      reason = error instanceof Error ? error.message : "content-download-unavailable";
      controller.abort();
    }
    return fail3(reason ?? "content-download-unavailable");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    if (reader) {
      void reader.cancel().catch(() => void 0);
      reader.releaseLock();
    }
  }
}

// src/planet/contentPackageCache.ts
var PREFIX = "literary-planet-content-qa-v1-";
var SHA = /^[a-f0-9]{64}$/u;
var METADATA_MAX_BYTES = 128 * 1024;
var encoder2 = new TextEncoder();
var fail4 = (reason) => {
  throw new Error(reason);
};
var cancelled = (signal) => {
  if (signal?.aborted) fail4("cancelled");
};
var epochOf = (selected) => selected?.schemaVersion === 2 ? selected.epoch : 0;
var retired = (selected) => selected?.schemaVersion === 2 && selected.retired;
var receipt = (selected) => hash(contentPackageCanonicalJson(selected));
function digest(value) {
  if (typeof value !== "string" || !SHA.test(value)) return fail4("exact-manifest-digest-required");
  return value;
}
function snapshotFiles(input) {
  if (!Array.isArray(input) || input.length < 2 || input.length > 128) return fail4("invalid-data-file-count");
  let total = 0;
  return input.map((file) => {
    exact(file, ["path", "bytes"], "invalid-data-file");
    const value = file.bytes;
    if (typeof value !== "string" && !(value instanceof Uint8Array) || value.length > MAX_FILE_BYTES) return fail4("data-file-byte-limit");
    const bytes = typeof value === "string" ? encoder2.encode(value) : new Uint8Array(value);
    total += bytes.byteLength;
    if (!bytes.byteLength || bytes.byteLength > MAX_FILE_BYTES || total > MAX_PACKAGE_BYTES) return fail4("package-byte-limit");
    return { path: file.path, bytes };
  });
}
function createContentPackageCache(options) {
  if (options.allowLocalQa !== true) fail4("content-cache-qa-only");
  const origin = new URL(options.origin);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (origin.origin !== options.origin || origin.protocol !== "https:" && !(loopback && origin.protocol === "http:")) fail4("invalid-content-cache-origin");
  const trustedKeys = normalizeContentPackageTrust(options.trustedKeys);
  const storage = options.caches, locks = options.locks, subtle = options.subtle;
  const url = (path) => new URL("/__literary_content_qa__/" + path, origin).href;
  const markerUrl = url("complete.json"), envelopeUrl = url("signature.json"), selectionUrl = url("selection.json");
  const fileUrl = (path) => url("files/" + path.split("/").map(encodeURIComponent).join("/"));
  const metadataResponse = (value) => new Response(contentPackageCanonicalJson(value), { headers: { "Content-Type": "application/json" } });
  const scope = (expected) => PREFIX + hash(contentPackageCanonicalJson({
    packageId: expected.packageId,
    namespace: expected.namespace,
    childPolicy: expected.childPolicy
  }));
  const rejected = (error, signal) => Object.freeze({
    ok: false,
    activationAllowed: false,
    reason: signal?.aborted ? "cancelled" : error instanceof Error ? error.message : "content-cache-unavailable"
  });
  const removable = /* @__PURE__ */ new Set();
  for (const item of options.optionalPackages ?? []) {
    const expected = normalizeContentPackageExpected(item.expected);
    if (expected.namespace !== "adult") fail4("adult-download-controller-required");
    removable.add(contentPackageCanonicalJson(expected) + ":" + digest(item.manifestSha256));
  }
  async function readBytes(response, maximum, signal) {
    if (!response || response.status !== 200 || !response.body) return fail4("incomplete-content-cache");
    const reader = response.body.getReader();
    let length = 0;
    const chunks = [];
    try {
      while (true) {
        cancelled(signal);
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maximum) {
          void reader.cancel().catch(() => void 0);
          fail4("content-cache-byte-limit");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    cancelled(signal);
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }
  async function metadata(name, key, maximum, signal) {
    const response = await storage.match(key, { cacheName: name });
    cancelled(signal);
    if (!response) return null;
    const source = new TextDecoder("utf-8", { fatal: true }).decode(await readBytes(response, maximum, signal));
    const value = JSON.parse(source);
    if (source !== contentPackageCanonicalJson(value)) fail4("noncanonical-cache-metadata");
    return value;
  }
  async function selection(name, signal) {
    const value = await metadata(name, selectionUrl, 1024, signal);
    if (value === null) return null;
    const selected = value;
    if (selected?.schemaVersion !== 1 && selected?.schemaVersion !== 2) fail4("invalid-cache-selection");
    exact(value, selected.schemaVersion === 1 ? ["schemaVersion", "current", "previous"] : ["schemaVersion", "epoch", "retired", "current", "previous"], "invalid-cache-selection");
    if (selected.schemaVersion === 2 && (!Number.isSafeInteger(selected.epoch) || selected.epoch < 1 || typeof selected.retired !== "boolean" || selected.retired && selected.previous !== null)) fail4("invalid-cache-selection");
    for (const generation of [selected.current, ...selected.previous ? [selected.previous] : []]) {
      exact(generation, ["sha256", "version"], "invalid-cache-generation");
      digest(generation.sha256);
      if (!Number.isSafeInteger(generation.version) || generation.version < 1) fail4("invalid-cache-generation");
    }
    if (selected.previous !== null && (!selected.previous || selected.previous.sha256 === selected.current.sha256 || selected.previous.version >= selected.current.version)) fail4("invalid-cache-selection");
    return selected;
  }
  async function readGeneration(name, hash2, expected, signal, requireMarker = true) {
    const cacheName = name + "-" + hash2;
    if (requireMarker) {
      const marker = await metadata(cacheName, markerUrl, 1024, signal);
      if (contentPackageCanonicalJson(marker) !== contentPackageCanonicalJson({ schemaVersion: 1, state: "VERIFIED_CANDIDATE", manifestSha256: hash2, activationAllowed: false })) fail4("incomplete-content-cache");
    }
    const envelope = await metadata(cacheName, envelopeUrl, METADATA_MAX_BYTES, signal);
    const { manifest, keyId: keyId2, signature } = inspectContentPackageEnvelope(envelope, expected);
    if (hash(contentPackageCanonicalJson(manifest)) !== hash2) fail4("cached-manifest-digest-mismatch");
    const normalizedEnvelope = { contract: "literary-planet-data-package-signature-v1", algorithm: "ES256", keyId: keyId2, manifest, signature };
    const files = [];
    for (const file of manifest.files) {
      cancelled(signal);
      files.push({ path: file.path, bytes: await readBytes(await storage.match(fileUrl(file.path), { cacheName }), file.bytes, signal) });
    }
    const verification = await verifyContentPackage({ envelope: normalizedEnvelope, expected, trustedKeys, files, signal, subtle });
    if (!verification.verified || verification.manifestSha256 !== hash2) fail4(verification.reason ?? "cached-package-verification-failed");
    return { envelope: normalizedEnvelope, files };
  }
  async function candidateFile(name, hash2, file, signal) {
    const response = await storage.match(fileUrl(file.path), { cacheName: name + "-" + hash2 });
    cancelled(signal);
    if (!response) return null;
    try {
      const bytes = await readBytes(response, file.bytes, signal);
      return bytes.length === file.bytes && hash(bytes) === file.sha256 ? bytes : null;
    } catch (error) {
      cancelled(signal);
      if (error instanceof Error && ["incomplete-content-cache", "content-cache-byte-limit"].includes(error.message)) return null;
      throw error;
    }
  }
  async function locked(name, signal, operation) {
    cancelled(signal);
    if (!storage || !locks) return fail4("content-cache-unavailable");
    return locks.request(name, { mode: "exclusive", ...signal ? { signal } : {} }, async () => {
      cancelled(signal);
      return operation();
    });
  }
  async function prune(name, keep, epoch, signal) {
    for (const cacheName of await storage.keys()) {
      cancelled(signal);
      if (!cacheName.startsWith(name + "-")) continue;
      const hash2 = cacheName.slice(name.length + 1);
      if (SHA.test(hash2) && !keep.includes(hash2)) {
        if (epochOf(await selection(name, signal)) !== epoch) fail4("content-generation-conflict");
        await storage.delete(cacheName, { epoch });
      }
    }
  }
  const hasGenerations = async (name) => (await storage.keys()).some((key) => key.startsWith(name + "-") && SHA.test(key.slice(name.length + 1)));
  function accepts(before, hash2, version, priorPin, epoch) {
    if (epochOf(before) !== epoch) fail4("content-generation-conflict");
    const active = !retired(before), alreadySelected = active && before?.current.sha256 === hash2;
    if (!alreadySelected && (active ? before?.current.sha256 ?? null : null) !== priorPin) fail4("content-generation-conflict");
    if (!alreadySelected && before && version <= before.current.version && !(retired(before) && hash2 === before.current.sha256 && version === before.current.version)) fail4("content-version-not-newer");
    return alreadySelected;
  }
  async function save(request, capturedEpoch) {
    const signal = request.signal;
    try {
      cancelled(signal);
      const expected = normalizeContentPackageExpected(request.expected), hash2 = digest(request.manifestSha256);
      const priorPin = request.expectedCurrentManifestSha256 === null ? null : digest(request.expectedCurrentManifestSha256);
      const parsed = inspectContentPackageEnvelope(request.envelope, expected);
      const envelope = {
        contract: "literary-planet-data-package-signature-v1",
        algorithm: "ES256",
        keyId: parsed.keyId,
        manifest: parsed.manifest,
        signature: parsed.signature
      };
      if (encoder2.encode(contentPackageCanonicalJson(envelope)).byteLength > METADATA_MAX_BYTES) fail4("content-envelope-byte-limit");
      const files = snapshotFiles(request.files), name = scope(expected);
      const epoch = capturedEpoch ?? await locked(name, signal, async () => epochOf(await selection(name, signal)));
      const verified = await verifyContentPackage({ envelope, expected, trustedKeys, files, signal, subtle });
      if (!verified.verified || verified.manifestSha256 !== hash2) fail4(verified.reason ?? "package-manifest-digest-mismatch");
      return await locked(name, signal, async () => {
        const before = await selection(name, signal), alreadySelected = accepts(before, hash2, expected.version, priorPin, epoch);
        const previous = retired(before) ? null : alreadySelected ? before.previous : before?.current ?? null;
        if (alreadySelected) {
          let readable = false;
          try {
            await readGeneration(name, hash2, expected, signal);
            readable = true;
          } catch {
            cancelled(signal);
          }
          if (receipt(await selection(name, signal)) !== receipt(before)) fail4("content-generation-conflict");
          if (readable) {
            return Object.freeze({
              ok: true,
              manifestSha256: hash2,
              previousManifestSha256: previous?.sha256 ?? null,
              selectionSha256: receipt(before),
              activationAllowed: false,
              releaseReady: false,
              persistence: "best-effort"
            });
          }
        }
        const keep = [hash2, before?.current.sha256, before?.previous?.sha256].filter((value) => !!value);
        await prune(name, keep, epoch, signal);
        const cacheName = name + "-" + hash2, cache = await storage.open(cacheName, { epoch });
        for (const file of files) {
          cancelled(signal);
          const record = parsed.manifest.files.find((record2) => record2.path === file.path);
          if (await candidateFile(name, hash2, record, signal)) continue;
          await cache.put(fileUrl(file.path), new Response(file.bytes, { headers: { "Content-Type": "application/json" } }));
        }
        cancelled(signal);
        await cache.put(envelopeUrl, metadataResponse(envelope));
        await readGeneration(name, hash2, expected, signal, false);
        cancelled(signal);
        await cache.put(markerUrl, metadataResponse({ schemaVersion: 1, state: "VERIFIED_CANDIDATE", manifestSha256: hash2, activationAllowed: false }));
        cancelled(signal);
        const next = epoch > 0 ? { schemaVersion: 2, epoch, retired: false, current: { sha256: hash2, version: expected.version }, previous } : { schemaVersion: 1, current: { sha256: hash2, version: expected.version }, previous };
        const index = await storage.open(name);
        cancelled(signal);
        if (storage.commitSelection) {
          const committed = await storage.commitSelection({
            name,
            url: selectionUrl,
            expectedSha256: before ? hash(contentPackageCanonicalJson(before)) : null,
            json: contentPackageCanonicalJson(next),
            candidate: { name: cacheName, entries: [
              ...parsed.manifest.files.map((file) => ({ url: fileUrl(file.path), bytes: file.bytes, sha256: file.sha256 })),
              ...[[envelopeUrl, envelope], [markerUrl, { schemaVersion: 1, state: "VERIFIED_CANDIDATE", manifestSha256: hash2, activationAllowed: false }]].map(([key, value]) => {
                const source = contentPackageCanonicalJson(value);
                return { url: key, bytes: encoder2.encode(source).byteLength, sha256: hash(source) };
              })
            ] }
          });
          if (!committed) fail4("content-generation-conflict");
        } else await index.put(selectionUrl, metadataResponse(next));
        if (!signal?.aborted) await prune(name, [hash2, ...previous ? [previous.sha256] : []], epoch, signal).catch(() => void 0);
        return Object.freeze({
          ok: true,
          manifestSha256: hash2,
          previousManifestSha256: previous?.sha256 ?? null,
          selectionSha256: receipt(next),
          activationAllowed: false,
          releaseReady: false,
          persistence: "best-effort"
        });
      });
    } catch (error) {
      return rejected(error, signal);
    }
  }
  const api = {
    /** Retire first, then collect bytes. A retained receipt prevents stale work
     * from resurrecting an absent selection and retains the version floor. */
    async uninstall(request) {
      const signal = request.signal;
      try {
        const expected = normalizeContentPackageExpected(request.expected), hash2 = digest(request.manifestSha256);
        const confirmed = digest(request.selectionSha256);
        if (!removable.has(contentPackageCanonicalJson(expected) + ":" + hash2)) fail4("content-package-required");
        if (storage?.commitSelection && !storage.retireSelection) fail4("content-retirement-unavailable");
        const name = scope(expected);
        return await locked(name, signal, async () => {
          const before = await selection(name, signal);
          if (!before || before.current.sha256 !== hash2 || before.current.version !== expected.version || receipt(before) !== confirmed) fail4("content-generation-conflict");
          const next = retired(before) ? before : {
            schemaVersion: 2,
            epoch: epochOf(before) + 1,
            retired: true,
            current: before.current,
            previous: null
          };
          if (!Number.isSafeInteger(epochOf(next))) fail4("content-retirement-limit");
          cancelled(signal);
          if (!retired(before)) {
            try {
              if (storage.retireSelection) {
                if (!await storage.retireSelection({
                  name,
                  url: selectionUrl,
                  expectedSha256: confirmed,
                  json: contentPackageCanonicalJson(next)
                })) fail4("content-generation-conflict");
              } else {
                const index = await storage.open(name);
                cancelled(signal);
                await index.put(selectionUrl, metadataResponse(next));
              }
            } catch (error) {
              const stored = await selection(name).catch(() => null);
              if (!stored || receipt(stored) !== receipt(next)) throw error;
            }
          }
          let cleanupComplete = false;
          try {
            await prune(name, [], epochOf(next), signal);
            cleanupComplete = !await hasGenerations(name) && receipt(await selection(name)) === receipt(next);
          } catch {
          }
          return Object.freeze({ ok: true, cleanupComplete, selectionSha256: receipt(next), activationAllowed: false });
        });
      } catch (error) {
        return rejected(error, signal);
      }
    },
    /** Explicitly discard one adult candidate. Never remove a selected version,
     * its rollback, another package/namespace, or the mandatory app bootstrap. */
    async discard(request) {
      const signal = request.signal;
      try {
        const expected = normalizeContentPackageExpected(request.expected), hash2 = digest(request.manifestSha256);
        if (expected.namespace !== "adult") fail4("adult-download-controller-required");
        const name = scope(expected), candidate = name + "-" + hash2;
        return await locked(name + ":download", signal, () => locked(name, signal, async () => {
          const selected = await selection(name, signal);
          if (!retired(selected) && [selected?.current.sha256, selected?.previous?.sha256].includes(hash2)) fail4("content-generation-protected");
          cancelled(signal);
          const removed = await storage.delete(candidate, { epoch: epochOf(selected) });
          if (!removed && (await storage.keys()).includes(candidate)) fail4("content-removal-not-confirmed");
          return Object.freeze({ ok: true, removed, activationAllowed: false });
        }));
      } catch (error) {
        return rejected(error, signal);
      }
    },
    save: (request) => save(request),
    async read(request) {
      const signal = request.signal;
      try {
        const expected = normalizeContentPackageExpected(request.expected), hash2 = digest(request.manifestSha256), name = scope(expected);
        return await locked(name, signal, async () => {
          const selected = await selection(name, signal);
          if (retired(selected)) {
            if (selected.current.sha256 !== hash2) fail4("content-generation-not-selected");
            const cleanupComplete = !await hasGenerations(name);
            if (receipt(await selection(name, signal)) !== receipt(selected)) fail4("content-generation-conflict");
            return Object.freeze({ ok: false, reason: "content-package-removed", selectionSha256: receipt(selected), cleanupComplete, activationAllowed: false });
          }
          if (![selected?.current.sha256, selected?.previous?.sha256].includes(hash2)) fail4("content-generation-not-selected");
          const loaded = await readGeneration(name, hash2, expected, signal);
          if (receipt(await selection(name, signal)) !== receipt(selected)) fail4("content-generation-conflict");
          return Object.freeze({
            ok: true,
            manifestSha256: hash2,
            selectionSha256: receipt(selected),
            selectedCurrentManifestSha256: selected.current.sha256,
            ...loaded,
            activationAllowed: false,
            releaseReady: false
          });
        });
      } catch (error) {
        return rejected(error, signal);
      }
    },
    async download(request) {
      const signal = request.signal;
      try {
        cancelled(signal);
        const expected = normalizeContentPackageExpected(request.expected), hash2 = digest(request.manifestSha256);
        const priorPin = request.expectedCurrentManifestSha256 === null ? null : digest(request.expectedCurrentManifestSha256);
        const baseUrl = normalizeContentPackageBaseUrl(request.baseUrl), fetch = request.fetch;
        const idleTimeoutMs = request.idleTimeoutMs, observer = request.onProgress;
        if (typeof fetch !== "function") fail4("content-download-unavailable");
        const parsed = inspectContentPackageEnvelope(request.envelope, expected);
        const envelope = {
          contract: "literary-planet-data-package-signature-v1",
          algorithm: "ES256",
          keyId: parsed.keyId,
          manifest: parsed.manifest,
          signature: parsed.signature
        };
        const name = scope(expected), epoch = await locked(name, signal, async () => epochOf(await selection(name, signal)));
        const authenticated = await verifyContentPackageManifest({ envelope, expected, trustedKeys, signal, subtle });
        if (!authenticated.verified || authenticated.manifestSha256 !== hash2) fail4(authenticated.reason ?? "package-manifest-digest-mismatch");
        const cacheName = name + "-" + hash2, files = [];
        let downloadedBytes = 0, cachedBytes = 0;
        const totalBytes = parsed.manifest.files.reduce((sum, file) => sum + file.bytes, 0);
        const progress = (phase, path, currentBytes = 0) => {
          try {
            observer?.(Object.freeze({ phase, path, downloadedBytes: downloadedBytes + currentBytes, cachedBytes, totalBytes }));
          } catch {
          }
        };
        const checkSelection = async () => {
          const selected = await selection(name, signal);
          accepts(selected, hash2, expected.version, priorPin, epoch);
          return selected;
        };
        return await locked(name + ":download", signal, async () => {
          await locked(name, signal, async () => {
            const selected = await checkSelection();
            await prune(name, [hash2, selected?.current.sha256, selected?.previous?.sha256].filter((value) => !!value), epoch, signal);
            await storage.open(cacheName, { epoch });
          });
          for (const file of parsed.manifest.files) {
            cancelled(signal);
            let bytes = await locked(name, signal, async () => {
              await checkSelection();
              return candidateFile(name, hash2, file, signal);
            });
            if (bytes) {
              cachedBytes += bytes.length;
              progress("downloading", file.path);
            } else {
              progress("downloading", file.path);
              bytes = await downloadContentPackageFile({
                baseUrl,
                file,
                fetch,
                signal,
                idleTimeoutMs,
                onBytes: (count) => progress("downloading", file.path, count)
              });
              downloadedBytes += bytes.length;
              const verifiedBytes = bytes;
              await locked(name, signal, async () => {
                await checkSelection();
                const cache = await storage.open(cacheName, { epoch });
                cancelled(signal);
                await cache.put(fileUrl(file.path), new Response(verifiedBytes, { headers: { "Content-Type": "application/json" } }));
              });
            }
            files.push({ path: file.path, bytes });
          }
          progress("verifying", null);
          const saved = await save({ envelope, expected, files, manifestSha256: hash2, expectedCurrentManifestSha256: priorPin, signal }, epoch);
          if (saved.ok) progress("saved", null);
          return saved;
        });
      } catch (error) {
        return rejected(error, signal);
      }
    }
  };
  return Object.freeze(api);
}

// src/planet/contentExportHash.ts
function contentTextHash(text) {
  return bytesToHex(sha256(utf8ToBytes(text)));
}
function contentUnitId(entity, field, locale) {
  return JSON.stringify([
    entity.kind,
    entity.countryId,
    entity.kind === "country" ? null : entity.writerId,
    entity.kind === "work" ? entity.workId : null,
    field,
    locale
  ]);
}
function contentRecordHash(value) {
  const ancestors = /* @__PURE__ */ new Set();
  let visited = 0;
  function encode(item, depth) {
    if (++visited > 2e6 || depth > 32) throw new Error("Content snapshot exceeds JSON bounds");
    if (item === null || typeof item === "string" || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number" && Number.isFinite(item)) return JSON.stringify(item);
    if (!item || typeof item !== "object" || ancestors.has(item)) throw new Error("Content snapshot must be acyclic JSON");
    ancestors.add(item);
    try {
      if (Array.isArray(item)) return "[" + Array.from(item, (value2) => encode(value2, depth + 1)).join(",") + "]";
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new Error("Content snapshot must contain plain records");
      const record = item;
      return "{" + Object.keys(record).filter((key) => record[key] !== void 0).sort().map((key) => JSON.stringify(key) + ":" + encode(record[key], depth + 1)).join(",") + "}";
    } finally {
      ancestors.delete(item);
    }
  }
  return contentTextHash(encode(value, 0));
}

// src/planet/contentDependencies.ts
var locales = ["ru", "en"];
var hashPattern = /^[a-f0-9]{64}$/u;
var bases = /* @__PURE__ */ new Set(["canonical-name-candidate", "evidenced-title-candidate", "authored-public-prose", "reviewed-source-bound-prose"]);
var fields = { country: ["name"], writer: ["name", "biography"], work: ["title", "description"] };
var revision = (unit) => contentRecordHash({ ...unit, dependencyIds: [...unit.dependencyIds].sort() });
function candidateUnitsHash(snapshot, units) {
  return contentRecordHash({
    sourceCommit: snapshot.sourceCommit,
    contract: snapshot.contract,
    namespace: snapshot.namespace,
    requiredLocales: snapshot.requiredLocales,
    units: [...units.values()].map((unit) => [unit.id, revision(unit)]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  });
}
function validEntity(entity) {
  if (!entity || typeof entity !== "object" || !Object.prototype.hasOwnProperty.call(fields, entity.kind)) return false;
  const names = entity.kind === "country" ? ["kind", "countryId"] : entity.kind === "writer" ? ["kind", "countryId", "writerId"] : ["kind", "countryId", "writerId", "workId"];
  return Object.keys(entity).sort().join(",") === names.sort().join(",") && Object.values(entity).every((value) => typeof value === "string" && value.length > 0 && value.length <= 256 && value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value));
}
function validContentUnitIdentity(unit) {
  return Boolean(unit && validEntity(unit.entityRef) && locales.includes(unit.locale) && fields[unit.entityRef.kind].includes(unit.field) && unit.id === contentUnitId(unit.entityRef, unit.field, unit.locale));
}
function checkedUnits(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.contract !== "literary-planet-content-candidate-v1" || !/^[a-f0-9]{40}$/u.test(snapshot.sourceCommit) || snapshot.namespace !== "adult" || snapshot.releaseReady !== false || !Array.isArray(snapshot.requiredLocales) || snapshot.requiredLocales.join(",") !== "ru,en" || !Array.isArray(snapshot.units) || snapshot.units.length > 2e5 || !Array.isArray(snapshot.held)) {
    throw new Error("Invalid canonical content candidate");
  }
  const byId = /* @__PURE__ */ new Map();
  for (const unit of snapshot.units) {
    if (!unit || !validContentUnitIdentity(unit) || byId.has(unit.id) || typeof unit.text !== "string" || !unit.text.trim() || unit.text.length > 1e5 || unit.contentHash !== contentTextHash(unit.text) || !bases.has(unit.publicationBasis) || ![null, "utf8-sha256", "writer-biography-review-v1"].includes(unit.sourceHashContract) || [unit.observedRuSourceHash, unit.reviewedRuSourceHash].some((hash2) => hash2 !== null && !hashPattern.test(hash2)) || [unit.observedTargetHash, unit.reviewTargetHash].some((hash2) => hash2 !== void 0 && !hashPattern.test(hash2)) || !Array.isArray(unit.dependencyIds) || unit.dependencyIds.length > 32 || unit.dependencyIds.some((id) => typeof id !== "string" || id.length > 1e3 || id === unit.id) || new Set(unit.dependencyIds).size !== unit.dependencyIds.length) {
      throw new Error("Invalid or ambiguous canonical content unit");
    }
    byId.set(unit.id, unit);
  }
  const pending = /* @__PURE__ */ new Map(), dependants = /* @__PURE__ */ new Map();
  for (const unit of byId.values()) {
    const dependencies2 = unit.dependencyIds.filter((id) => byId.has(id));
    pending.set(unit.id, dependencies2.length);
    for (const id of dependencies2) {
      const values = dependants.get(id) || [];
      values.push(unit.id);
      dependants.set(id, values);
    }
  }
  const ready = [...pending].filter(([, count]) => count === 0).map(([id]) => id);
  for (let position = 0; position < ready.length; position++) {
    for (const id of dependants.get(ready[position]) || []) {
      const count = pending.get(id) - 1;
      pending.set(id, count);
      if (count === 0) ready.push(id);
    }
  }
  if (ready.length !== byId.size) throw new Error("Cyclic canonical content dependencies");
  return byId;
}
function hasCurrentReview(unit, source) {
  return Boolean(source && source.locale === "ru" && unit.locale === "en" && source.id === contentUnitId(unit.entityRef, unit.field, "ru") && unit.publicationBasis === "reviewed-source-bound-prose" && unit.sourceHashContract !== null && unit.sourceHashContract === source.sourceHashContract && unit.observedRuSourceHash !== null && unit.observedRuSourceHash === source.observedRuSourceHash && unit.reviewedRuSourceHash === unit.observedRuSourceHash && unit.observedTargetHash && unit.reviewTargetHash === unit.observedTargetHash);
}
function compareContentCandidates(previous, current, previousState) {
  const before = previous ? checkedUnits(previous) : /* @__PURE__ */ new Map();
  const after = checkedUnits(current);
  const previousCandidateHash = previous ? candidateUnitsHash(previous, before) : null;
  const currentCandidateHash = candidateUnitsHash(current, after);
  if (previousState && (!previous || previousState.schemaVersion !== 1 || previousState.contract !== "literary-planet-content-dependencies-v1" || previousState.releaseReady !== false || previousState.sourceCommit !== previous.sourceCommit || previousState.currentCandidateHash !== previousCandidateHash || !Array.isArray(previousState.staleUnitIds) || previousState.staleUnitIds.length > before.size || previousState.staleUnitIds.some((id) => typeof id !== "string" || !before.has(id)) || new Set(previousState.staleUnitIds).size !== previousState.staleUnitIds.length)) {
    throw new Error("Previous dependency state does not match its canonical generation");
  }
  const addedUnitIds = [...after.keys()].filter((id) => !before.has(id)).sort();
  const changedUnitIds = [...after.keys()].filter((id) => before.has(id) && revision(before.get(id)) !== revision(after.get(id))).sort();
  const removedUnitIds = [...before.keys()].filter((id) => !after.has(id)).sort();
  const changedSources = /* @__PURE__ */ new Set([...changedUnitIds, ...removedUnitIds]);
  const reverse = /* @__PURE__ */ new Map();
  for (const unit of after.values()) for (const dependency of unit.dependencyIds) {
    const dependants = reverse.get(dependency) || [];
    dependants.push(unit.id);
    reverse.set(dependency, dependants);
  }
  const stale = /* @__PURE__ */ new Set();
  for (const id of previousState?.staleUnitIds || []) {
    const unit = after.get(id);
    if (unit && !hasCurrentReview(unit, after.get(contentUnitId(unit.entityRef, unit.field, "ru")))) stale.add(id);
  }
  for (const unit of after.values()) {
    if (unit.dependencyIds.some((id) => !after.has(id)) || unit.locale === "en" && unit.publicationBasis === "reviewed-source-bound-prose" && !hasCurrentReview(unit, after.get(contentUnitId(unit.entityRef, unit.field, "ru")))) stale.add(unit.id);
  }
  const queue = [.../* @__PURE__ */ new Set([...changedSources, ...stale])];
  for (let position = 0; position < queue.length; position++) {
    const dependency = queue[position];
    for (const id of reverse.get(dependency) || []) {
      const unit = after.get(id);
      if (stale.has(id) || !stale.has(dependency) && hasCurrentReview(unit, after.get(dependency))) continue;
      stale.add(id);
      queue.push(id);
    }
  }
  const affected = /* @__PURE__ */ new Set([...addedUnitIds, ...changedUnitIds, ...removedUnitIds, ...stale]);
  const invalidatedOutputs = [];
  for (const locale of locales) {
    const reasonUnitIds = [...affected].filter((id) => (after.get(id) || before.get(id))?.locale === locale).sort();
    if (reasonUnitIds.length) for (const kind of ["search", "package"]) invalidatedOutputs.push({ kind, locale, reasonUnitIds });
  }
  return {
    schemaVersion: 1,
    contract: "literary-planet-content-dependencies-v1",
    sourceCommit: current.sourceCommit,
    previousSourceCommit: previous?.sourceCommit ?? null,
    currentCandidateHash,
    previousCandidateHash,
    addedUnitIds,
    changedUnitIds,
    removedUnitIds,
    staleUnitIds: [...stale].sort(),
    tombstones: removedUnitIds.map((id) => {
      const unit = before.get(id);
      return { id, entityRef: { ...unit.entityRef }, field: unit.field, locale: unit.locale };
    }),
    invalidatedOutputs,
    releaseReady: false
  };
}

// src/planet/contentPackageInspection.ts
var PATHS = ["dependency-index.json", "en/catalog.json", "ru/catalog.json"];
var HASH = /^[a-f0-9]{64}$/u;
var COMMIT = /^[a-f0-9]{40}$/u;
var InspectionError = class extends Error {
};
var fail5 = (code) => {
  throw new InspectionError(code);
};
var cancelled2 = (signal) => {
  if (signal?.aborted) fail5("cancelled");
};
function exact2(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) fail5(code);
}
function identity(id) {
  if (typeof id !== "string" || !id || id.length > 1e3) return fail5("invalid-dependency-index");
  let parts;
  try {
    parts = JSON.parse(id);
  } catch {
    return fail5("invalid-dependency-index");
  }
  if (!Array.isArray(parts) || parts.length !== 6) return fail5("invalid-dependency-index");
  const [kind, countryId, writerId, workId, field, locale] = parts;
  const entityRef = kind === "country" ? { kind, countryId } : kind === "writer" ? { kind, countryId, writerId } : { kind, countryId, writerId, workId };
  const value = { id, entityRef, field, locale };
  if (!validContentUnitIdentity(value)) return fail5("invalid-dependency-index");
  return value;
}
function ids(value) {
  if (!Array.isArray(value) || value.length > 2e5 || new Set(value).size !== value.length) return fail5("invalid-dependency-index");
  for (const id of value) identity(id);
  return value;
}
function dependencies(value, sourceCommit) {
  exact2(value, [
    "schemaVersion",
    "contract",
    "sourceCommit",
    "previousSourceCommit",
    "currentCandidateHash",
    "previousCandidateHash",
    "addedUnitIds",
    "changedUnitIds",
    "removedUnitIds",
    "staleUnitIds",
    "tombstones",
    "invalidatedOutputs",
    "releaseReady"
  ], "invalid-dependency-index");
  if (value.schemaVersion !== 1 || value.contract !== "literary-planet-content-dependencies-v1" || value.sourceCommit !== sourceCommit || value.releaseReady !== false || typeof value.currentCandidateHash !== "string" || !HASH.test(value.currentCandidateHash) || !(value.previousSourceCommit === null && value.previousCandidateHash === null) && !(typeof value.previousSourceCommit === "string" && COMMIT.test(value.previousSourceCommit) && typeof value.previousCandidateHash === "string" && HASH.test(value.previousCandidateHash))) fail5("invalid-dependency-index");
  const added = ids(value.addedUnitIds), changed = ids(value.changedUnitIds), removed = ids(value.removedUnitIds), stale = ids(value.staleUnitIds);
  const changedSet = new Set(changed), removedSet = new Set(removed);
  if (added.some((id) => changedSet.has(id) || removedSet.has(id)) || changed.some((id) => removedSet.has(id)) || stale.some((id) => removedSet.has(id)) || value.previousSourceCommit === null && (changed.length || removed.length)) fail5("invalid-dependency-index");
  if (!Array.isArray(value.tombstones) || value.tombstones.length !== removed.length) fail5("invalid-dependency-index");
  const tombstones = /* @__PURE__ */ new Set();
  for (const tombstone of value.tombstones) {
    exact2(tombstone, ["id", "entityRef", "field", "locale"], "invalid-dependency-index");
    const unit = tombstone;
    if (!validContentUnitIdentity(unit) || !removedSet.has(unit.id) || tombstones.has(unit.id)) fail5("invalid-dependency-index");
    tombstones.add(unit.id);
  }
  const affected = [.../* @__PURE__ */ new Set([...added, ...changed, ...removed, ...stale])];
  const expectedOutputs = ["ru", "en"].flatMap((locale) => {
    const reasonUnitIds = affected.filter((id) => identity(id).locale === locale).sort();
    return reasonUnitIds.length ? ["search", "package"].map((kind) => ({ kind, locale, reasonUnitIds })) : [];
  });
  if (!Array.isArray(value.invalidatedOutputs) || value.invalidatedOutputs.length !== expectedOutputs.length) fail5("invalid-dependency-index");
  const outputs = value.invalidatedOutputs.map((output) => {
    exact2(output, ["kind", "locale", "reasonUnitIds"], "invalid-dependency-index");
    if (!["search", "package"].includes(output.kind) || !["ru", "en"].includes(output.locale)) fail5("invalid-dependency-index");
    return { kind: output.kind, locale: output.locale, reasonUnitIds: [...ids(output.reasonUnitIds)].sort() };
  });
  const ordered = (entries) => [...entries].sort((a, b) => `${a.locale}:${a.kind}`.localeCompare(`${b.locale}:${b.kind}`));
  if (contentRecordHash(ordered(outputs)) !== contentRecordHash(ordered(expectedOutputs))) fail5("invalid-dependency-index");
  return value;
}
function freeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function snapshotBytes(value) {
  if (typeof value !== "string" && !(value instanceof Uint8Array)) return fail5("package-file-inventory-mismatch");
  if (!value.length || value.length > MAX_FILE_BYTES) return fail5("package-file-inventory-mismatch");
  if (typeof value !== "string") return new Uint8Array(value);
  let length = 0;
  for (const character of value) {
    const point = character.codePointAt(0);
    length += point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;
    if (length > MAX_FILE_BYTES) return fail5("package-file-inventory-mismatch");
  }
  return new TextEncoder().encode(value);
}
async function inspectContentPackage(input) {
  try {
    const signal = input.signal, pin = input.manifestSha256, selectionPin = input.selectionSha256;
    cancelled2(signal);
    let expected;
    try {
      expected = normalizeContentPackageExpected(input.expected);
    } catch {
      return fail5("invalid-inspection-context");
    }
    if (expected.namespace !== "adult" || expected.childPolicy !== null) fail5("adult-content-inspection-required");
    if (!HASH.test(pin) || !HASH.test(selectionPin)) fail5("invalid-inspection-context");
    const read = await input.cache.read({ expected, manifestSha256: pin, signal });
    cancelled2(signal);
    if (!read?.ok || read.activationAllowed !== false || read.releaseReady !== false) fail5("content-read-rejected");
    if (read.manifestSha256 !== pin) fail5("manifest-pin-mismatch");
    if (read.selectionSha256 !== selectionPin || !HASH.test(read.selectedCurrentManifestSha256)) fail5("selection-receipt-mismatch");
    const selectedCurrentManifestSha256 = read.selectedCurrentManifestSha256;
    const envelope = JSON.parse(contentPackageCanonicalJson(read.envelope));
    const { manifest } = inspectContentPackageEnvelope(envelope, expected);
    if (hash(contentPackageCanonicalJson(manifest)) !== pin) fail5("manifest-pin-mismatch");
    if (!Array.isArray(read.files) || read.files.length !== 3 || read.files.map((file) => file.path).sort().join(",") !== PATHS.join(",") || manifest.files.map((file) => file.path).sort().join(",") !== PATHS.join(",")) fail5("package-file-inventory-mismatch");
    const files = read.files.map((file) => ({ path: file.path, bytes: snapshotBytes(file.bytes) }));
    try {
      const inventory = actualInventory(files, manifest);
      if (contentPackageCanonicalJson(inventory) !== contentPackageCanonicalJson(manifest.files)) fail5("package-file-inventory-mismatch");
    } catch {
      return fail5("invalid-content-bytes");
    }
    const parsed = new Map(files.map((file) => [file.path, JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(file.bytes))]));
    const units = [];
    for (const locale of ["ru", "en"]) {
      const catalog = parsed.get(`${locale}/catalog.json`);
      exact2(catalog, ["schemaVersion", "contract", "sourceCommit", "namespace", "locale", "units", "releaseReady"], "invalid-catalog-header");
      if (catalog.schemaVersion !== 1 || catalog.contract !== "literary-planet-content-candidate-v1" || catalog.sourceCommit !== expected.sourceCommit || catalog.namespace !== "adult" || catalog.locale !== locale || catalog.releaseReady !== false || !Array.isArray(catalog.units)) fail5("invalid-catalog-header");
      for (const unit of catalog.units) {
        exact2(unit, [
          "id",
          "entityRef",
          "field",
          "locale",
          "text",
          "contentHash",
          "observedRuSourceHash",
          "reviewedRuSourceHash",
          "sourceHashContract",
          "dependencyIds",
          "publicationBasis",
          ...["observedTargetHash", "reviewTargetHash"].filter((key) => Object.prototype.hasOwnProperty.call(unit ?? {}, key))
        ], "invalid-content-unit");
        if (unit.locale !== locale) fail5("invalid-content-unit");
        units.push(unit);
      }
    }
    const snapshot = {
      schemaVersion: 1,
      contract: "literary-planet-content-candidate-v1",
      namespace: "adult",
      sourceCommit: expected.sourceCommit,
      requiredLocales: ["ru", "en"],
      units,
      held: [],
      releaseReady: false
    };
    let checked;
    try {
      checked = compareContentCandidates(null, snapshot);
    } catch {
      return fail5("invalid-content-unit");
    }
    if (checked.staleUnitIds.length) fail5("content-dependency-inconsistent");
    const declared = dependencies(parsed.get("dependency-index.json"), expected.sourceCommit);
    const delivered = new Set(units.map((unit) => unit.id)), stale = new Set(declared.staleUnitIds), removed = new Set(declared.removedUnitIds);
    if (units.some((unit) => stale.has(unit.id))) fail5("stale-content-unit-delivered");
    if (units.some((unit) => removed.has(unit.id))) fail5("removed-content-unit-delivered");
    if ([...declared.addedUnitIds, ...declared.changedUnitIds].some((id) => !delivered.has(id) && !stale.has(id))) fail5("content-dependency-inconsistent");
    if (declared.previousSourceCommit === null) {
      const initialIds = /* @__PURE__ */ new Set([...delivered, ...stale]);
      if (declared.addedUnitIds.length !== initialIds.size || declared.addedUnitIds.some((id) => !initialIds.has(id))) fail5("content-dependency-inconsistent");
    }
    const orderedUnits = units.map((unit) => ({ ...unit, entityRef: { ...unit.entityRef }, dependencyIds: [...unit.dependencyIds].sort() })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const diagnostics = [];
    for (const unit of orderedUnits) {
      const missingLocale = unit.locale === "ru" ? "en" : "ru";
      if (!delivered.has(contentUnitId(unit.entityRef, unit.field, missingLocale))) diagnostics.push({ kind: "missing-locale-counterpart", unitId: unit.id, missingLocale });
    }
    for (const unitId of [...stale].sort()) diagnostics.push({ kind: "excluded-stale-unit", unitId });
    for (const unitId of [...removed].sort()) diagnostics.push({ kind: "removed-unit", unitId });
    const deliveredUnitsHash = contentRecordHash({
      contract: "literary-planet-delivered-content-units-v1",
      sourceCommit: expected.sourceCommit,
      namespace: "adult",
      requiredLocales: ["ru", "en"],
      units: orderedUnits
    });
    cancelled2(signal);
    const view = {
      schemaVersion: 1,
      contract: "literary-planet-staged-content-inspection-v1",
      namespace: "adult",
      packageId: expected.packageId,
      version: expected.version,
      sourceCommit: expected.sourceCommit,
      manifestSha256: pin,
      selectionSha256: selectionPin,
      selectedCurrentManifestSha256,
      selectionRole: pin === selectedCurrentManifestSha256 ? "current" : "rollback",
      fullCandidateHash: declared.currentCandidateHash,
      deliveredUnitsHash,
      units: orderedUnits,
      diagnostics,
      activationAllowed: false,
      releaseReady: false
    };
    return freeze({ ok: true, view, activationAllowed: false });
  } catch (error) {
    return Object.freeze({ ok: false, reason: input.signal?.aborted ? "cancelled" : error instanceof InspectionError ? error.message : "content-inspection-unavailable", activationAllowed: false });
  }
}

// src/planet/contentDownloadCatalog.ts
var contentDownloadCatalog = Object.freeze([]);
var contentDownloadTrust = Object.freeze([]);
export {
  compareContentCandidates,
  contentDownloadCatalog,
  contentDownloadTrust,
  contentPackageCanonicalJson,
  hash as contentPackageHash,
  contentUnitId,
  createContentPackageCache,
  inspectContentPackage
};
/*! Bundled license information:

@noble/hashes/esm/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
