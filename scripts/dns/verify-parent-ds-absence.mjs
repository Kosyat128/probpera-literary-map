import { randomBytes } from "node:crypto";
import { connect as connectHttp2, constants as http2Constants } from "node:http2";
import { pathToFileURL } from "node:url";

export const DEFAULT_DOH_ENDPOINTS = Object.freeze([
  ["cloudflare", "https://cloudflare-dns.com/dns-query"],
  ["google", "https://dns.google/dns-query"],
  ["quad9", "https://dns.quad9.net/dns-query"],
]);

function normalizeZone(value) {
  const zone = String(value || "").trim().toLowerCase().replace(/\.$/u, "");
  if (
    zone.length === 0 ||
    zone.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(zone)
  ) {
    throw new Error("zone must be a valid ASCII DNS name");
  }
  return zone;
}

function encodeName(name) {
  return Buffer.concat([
    ...name.split(".").map((label) => {
      const bytes = Buffer.from(label, "ascii");
      if (bytes.length === 0 || bytes.length > 63) throw new Error("Invalid DNS label");
      return Buffer.concat([Buffer.from([bytes.length]), bytes]);
    }),
    Buffer.from([0]),
  ]);
}

export function buildDsQuery({ zone, id = randomBytes(2).readUInt16BE(0) }) {
  const normalizedZone = normalizeZone(zone);
  if (!Number.isInteger(id) || id < 0 || id > 0xffff) throw new Error("DNS query id is invalid");
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0);
  header.writeUInt16BE(0x0100, 2); // recursion desired
  header.writeUInt16BE(1, 4);
  header.writeUInt16BE(1, 10); // one EDNS OPT record
  const question = Buffer.alloc(4);
  question.writeUInt16BE(43, 0); // DS
  question.writeUInt16BE(1, 2); // IN
  const opt = Buffer.alloc(11);
  opt.writeUInt16BE(41, 1); // OPT
  opt.writeUInt16BE(1232, 3);
  opt.writeUInt32BE(0x00008000, 5); // DNSSEC OK
  return {
    id,
    zone: normalizedZone,
    bytes: Buffer.concat([header, encodeName(normalizedZone), question, opt]),
  };
}

function readName(message, start) {
  const labels = [];
  let cursor = start;
  let next = null;
  const visited = new Set();
  for (let depth = 0; depth < 128; depth += 1) {
    if (cursor >= message.length || visited.has(cursor)) throw new Error("Malformed DNS name");
    visited.add(cursor);
    const length = message[cursor];
    if ((length & 0xc0) === 0xc0) {
      if (cursor + 1 >= message.length) throw new Error("Truncated DNS pointer");
      if (next === null) next = cursor + 2;
      cursor = ((length & 0x3f) << 8) | message[cursor + 1];
      continue;
    }
    if ((length & 0xc0) !== 0 || length > 63) throw new Error("Invalid DNS label length");
    cursor += 1;
    if (length === 0) return { name: labels.join("."), next: next ?? cursor };
    if (cursor + length > message.length) throw new Error("Truncated DNS label");
    labels.push(message.subarray(cursor, cursor + length).toString("ascii").toLowerCase());
    cursor += length;
  }
  throw new Error("DNS compression depth exceeded");
}

export function parseDsResponse(messageValue, { expectedId, zone, provider = "resolver" }) {
  const message = Buffer.from(messageValue);
  const normalizedZone = normalizeZone(zone);
  if (message.length < 12) throw new Error(`${provider} returned a short DNS message`);
  const flags = message.readUInt16BE(2);
  const questionCount = message.readUInt16BE(4);
  const answerCount = message.readUInt16BE(6);
  if (message.readUInt16BE(0) !== expectedId || (flags & 0x8000) === 0) {
    throw new Error(`${provider} returned an unrelated DNS message`);
  }
  if ((flags & 0x0200) !== 0 || (flags & 0x000f) !== 0 || (flags & 0x0020) === 0) {
    throw new Error(`${provider} did not return a complete DNSSEC-validated NOERROR response`);
  }
  if (questionCount !== 1) throw new Error(`${provider} returned an unexpected question count`);
  let cursor = 12;
  const question = readName(message, cursor);
  cursor = question.next;
  if (cursor + 4 > message.length) throw new Error(`${provider} truncated the DNS question`);
  const questionType = message.readUInt16BE(cursor);
  const questionClass = message.readUInt16BE(cursor + 2);
  cursor += 4;
  if (question.name !== normalizedZone || questionType !== 43 || questionClass !== 1) {
    throw new Error(`${provider} did not echo the exact DS question`);
  }
  for (let index = 0; index < answerCount; index += 1) {
    const owner = readName(message, cursor);
    cursor = owner.next;
    if (cursor + 10 > message.length) throw new Error(`${provider} truncated a DNS answer`);
    const type = message.readUInt16BE(cursor);
    const rdLength = message.readUInt16BE(cursor + 8);
    cursor += 10;
    if (cursor + rdLength > message.length) throw new Error(`${provider} truncated DNS RDATA`);
    if (type === 43) throw new Error(`Parent DS exists according to ${provider}`);
    throw new Error(`${provider} returned an unexpected non-DS answer to a DS query`);
  }
  return { provider, status: "absent", authenticatedDenial: true };
}

export function postDohHttp2(
  urlValue,
  body,
  { connectImpl = connectHttp2, timeoutMs = 12_000 } = {}
) {
  const url = new URL(urlValue);
  if (url.protocol !== "https:") throw new Error("DoH endpoint must use HTTPS");
  return new Promise((resolve, reject) => {
    const session = connectImpl(url.origin);
    let settled = false;
    let request;
    const timer = setTimeout(
      () => finish(new Error(`${url.hostname} DoH timed out`)),
      timeoutMs
    );
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        request?.close(http2Constants.NGHTTP2_CANCEL);
        session.destroy();
        reject(error);
      } else {
        session.close();
        resolve(value);
      }
    };
    session.once("error", (error) => finish(error));
    session.once("connect", () => {
      if (session.alpnProtocol !== "h2") {
        finish(new Error(`${url.hostname} did not negotiate HTTP/2 for DoH`));
      }
    });
    request = session.request({
      ":method": "POST",
      ":path": `${url.pathname}${url.search}`,
      accept: "application/dns-message",
      "content-type": "application/dns-message",
      "content-length": String(body.length),
    });
    let responseHeaders = null;
    const chunks = [];
    let responseBytes = 0;
    request.once("response", (headers) => {
      responseHeaders = headers;
    });
    request.on("data", (chunk) => {
      responseBytes += chunk.length;
      if (responseBytes > 64 * 1024) {
        finish(new Error(`${url.hostname} returned an oversized DoH response`));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    request.once("error", (error) => finish(error));
    request.once("end", () => finish(null, {
      status: Number(responseHeaders?.[":status"] || 0),
      contentType: String(responseHeaders?.["content-type"] || "").toLowerCase(),
      body: Buffer.concat(chunks),
    }));
    request.end(body);
  });
}

export async function verifyParentDsAbsence({
  zone,
  endpoints = DEFAULT_DOH_ENDPOINTS,
  postImpl = postDohHttp2,
} = {}) {
  const normalizedZone = normalizeZone(zone);
  if (!Array.isArray(endpoints) || endpoints.length < 3) {
    throw new Error("At least three independent DoH resolvers are required");
  }
  const results = [];
  for (const [provider, url] of endpoints) {
    const query = buildDsQuery({ zone: normalizedZone });
    const response = await postImpl(url, query.bytes, { provider });
    if (response?.status !== 200) {
      throw new Error(`${provider} DS-over-HTTPS returned HTTP ${response?.status || 0}`);
    }
    if (!String(response.contentType || "").toLowerCase().includes("application/dns-message")) {
      throw new Error(`${provider} returned an unexpected DS-over-HTTPS content type`);
    }
    results.push(parseDsResponse(response.body, {
      expectedId: query.id,
      zone: normalizedZone,
      provider,
    }));
  }
  return {
    schema: "probpera-parent-ds-check/v1",
    zone: normalizedZone,
    status: "absent",
    authenticatedResolverCount: results.length,
    providers: results.map((entry) => entry.provider),
    checkedAt: new Date().toISOString(),
  };
}

function parseCliOptions(argv) {
  const options = { zone: "probpera.ru" };
  for (const argument of argv) {
    if (argument.startsWith("--zone=")) options.zone = argument.slice("--zone=".length);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const report = await verifyParentDsAbsence(options);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
