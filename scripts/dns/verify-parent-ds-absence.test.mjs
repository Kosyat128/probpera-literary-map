import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDsQuery,
  parseDsResponse,
  verifyParentDsAbsence,
} from "./verify-parent-ds-absence.mjs";

function responseFromQuery(query, { authenticated = true, answerType = null } = {}) {
  const questionEnd = query.bytes.length - 11;
  const headerAndQuestion = Buffer.from(query.bytes.subarray(0, questionEnd));
  headerAndQuestion.writeUInt16BE(authenticated ? 0x81a0 : 0x8180, 2);
  headerAndQuestion.writeUInt16BE(answerType === null ? 0 : 1, 6);
  headerAndQuestion.writeUInt16BE(0, 8);
  headerAndQuestion.writeUInt16BE(0, 10);
  if (answerType === null) return headerAndQuestion;
  const answer = Buffer.alloc(16);
  answer.writeUInt16BE(0xc00c, 0);
  answer.writeUInt16BE(answerType, 2);
  answer.writeUInt16BE(1, 4);
  answer.writeUInt32BE(300, 6);
  answer.writeUInt16BE(4, 10);
  answer.writeUInt32BE(1, 12);
  return Buffer.concat([headerAndQuestion, answer]);
}

test("accepts an authenticated NOERROR DS denial for the exact zone", () => {
  const query = buildDsQuery({ zone: "probpera.ru", id: 0x1234 });
  const parsed = parseDsResponse(responseFromQuery(query), {
    expectedId: query.id,
    zone: query.zone,
    provider: "fixture",
  });
  assert.deepEqual(parsed, {
    provider: "fixture",
    status: "absent",
    authenticatedDenial: true,
  });
});

test("fails closed when an authenticated DS record exists", () => {
  const query = buildDsQuery({ zone: "probpera.ru", id: 0x2345 });
  assert.throws(
    () => parseDsResponse(responseFromQuery(query, { answerType: 43 }), {
      expectedId: query.id,
      zone: query.zone,
      provider: "fixture",
    }),
    /Parent DS exists/u
  );
});

test("rejects unauthenticated denial and unexpected answer types", () => {
  const query = buildDsQuery({ zone: "probpera.ru", id: 0x3456 });
  assert.throws(
    () => parseDsResponse(responseFromQuery(query, { authenticated: false }), {
      expectedId: query.id,
      zone: query.zone,
      provider: "fixture",
    }),
    /DNSSEC-validated/u
  );
  assert.throws(
    () => parseDsResponse(responseFromQuery(query, { answerType: 1 }), {
      expectedId: query.id,
      zone: query.zone,
      provider: "fixture",
    }),
    /unexpected non-DS answer/u
  );
});

test("requires three successful independent resolver responses", async () => {
  const endpoints = [
    ["one", "https://one.example/dns-query"],
    ["two", "https://two.example/dns-query"],
    ["three", "https://three.example/dns-query"],
  ];
  const seen = [];
  const report = await verifyParentDsAbsence({
    zone: "probpera.ru",
    endpoints,
    postImpl: async (url, bytes, { provider }) => {
      seen.push({ url, provider });
      return {
        status: 200,
        contentType: "application/dns-message",
        body: responseFromQuery({ bytes }),
      };
    },
  });
  assert.equal(report.status, "absent");
  assert.equal(report.authenticatedResolverCount, 3);
  assert.deepEqual(report.providers, ["one", "two", "three"]);
  assert.equal(seen.length, 3);
});
