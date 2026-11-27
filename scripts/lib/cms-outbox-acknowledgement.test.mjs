import { describe, expect, it, vi } from "vitest";
import { collectPendingOutboxIds, parsePendingOutboxIds } from "./cms-outbox-acknowledgement.mjs";

const captureOptions = {
  supabaseUrl: "https://publication-test.supabase.co",
  serviceKey: "mock-service-key",
  outboxHighWater: "9223372036854775807",
};

const response = (...ids) => Response.json(ids.map((request_id) => ({ request_id })));

describe("capture the frozen pending outbox", () => {
  it("uses numeric keyset ordering and does not truncate short server pages", async () => {
    const pages = [response("9"), response("11", "9223372036854775806"), response()];
    const seen = [];
    const fetchImpl = vi.fn(async (input, options) => {
      const url = new URL(input);
      expect(url.origin).toBe(captureOptions.supabaseUrl);
      expect(url.pathname).toBe("/rest/v1/public_build_outbox");
      expect(url.searchParams.get("select")).toBe("request_id:id::text");
      expect(url.searchParams.get("order")).toBe("id.asc");
      expect(url.searchParams.get("status")).toBe("in.(requested,dispatched,failed)");
      expect(options.redirect).toBe("error");
      expect(options.headers.Authorization).toBe("Bearer mock-service-key");
      seen.push(url.searchParams.get("and"));
      return pages.shift();
    });
    expect(await collectPendingOutboxIds({ ...captureOptions, fetchImpl })).toEqual(["9", "11", "9223372036854775806"]);
    expect(seen).toEqual([
      "(id.gt.0,id.lte.9223372036854775807)",
      "(id.gt.9,id.lte.9223372036854775807)",
      "(id.gt.9223372036854775806,id.lte.9223372036854775807)",
    ]);
  });

  it("returns only the first 5,000 exact IDs when the backlog exceeds the run output budget", async () => {
    let next = 1;
    const fetchImpl = vi.fn(async (input) => {
      const { searchParams } = new URL(input);
      const limit = Number(searchParams.get("limit"));
      return response(...Array.from({ length: limit }, () => String(next++)));
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const ids = await collectPendingOutboxIds({ ...captureOptions, fetchImpl });
      expect(ids).toEqual(Array.from({ length: 5000 }, (_, index) => String(index + 1)));
      expect(fetchImpl).toHaveBeenCalledTimes(11);
      expect(warning).toHaveBeenCalledWith(expect.stringContaining("Remaining requests will stay pending"));
      expect(parsePendingOutboxIds(ids.join(","), captureOptions.outboxHighWater)).toEqual(ids);
    } finally {
      warning.mockRestore();
    }
  });

  it.each([response(9), response("9", "9"), response("11", "9"), response("9223372036854775808")])(
    "fails closed on malformed or non-increasing capture data",
    async (badResponse) => {
      const fetchImpl = vi.fn().mockResolvedValue(badResponse);
      await expect(collectPendingOutboxIds({ ...captureOptions, fetchImpl })).rejects.toThrow("Pending outbox ID");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  );

  it("does not query an empty outbox and rejects transport failure, including redirects", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 302 }));
    expect(await collectPendingOutboxIds({ ...captureOptions, outboxHighWater: "0", fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(collectPendingOutboxIds({ ...captureOptions, fetchImpl })).rejects.toThrow("HTTP 302");
  });
});

describe("validate acknowledgement payload", () => {
  it("accepts canonical IDs up to signed bigint and a present empty list", () => {
    expect(parsePendingOutboxIds("", "7")).toEqual([]);
    expect(parsePendingOutboxIds("9,11,9223372036854775807", captureOptions.outboxHighWater)).toEqual(["9", "11", "9223372036854775807"]);
  });

  it.each([undefined, "0", "01", "1\n", "1,", "1,1", "2,1", "1, 2", "1,9223372036854775808"])(
    "rejects missing or malformed CSV %j",
    (csv) => {
      expect(() => parsePendingOutboxIds(csv, captureOptions.outboxHighWater)).toThrow();
    }
  );

  it("rejects any ID beyond the frozen head and a list beyond the capture cap", () => {
    expect(() => parsePendingOutboxIds("1,3", "2")).toThrow("within the frozen high-water mark");
    expect(() => parsePendingOutboxIds(Array.from({ length: 5001 }, (_, i) => i + 1).join(","), "6000")).toThrow("too large");
  });
});
