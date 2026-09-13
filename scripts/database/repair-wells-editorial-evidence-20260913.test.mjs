import { readFile } from "node:fs/promises";
import { describe, it, expect, vi } from "vitest";
import { WELLS_REPAIR, verifyWellsRepairPacket, verifyWellsRepairInvocation, applyWellsRepair } from "./repair-wells-editorial-evidence-20260913.mjs";

const sha = "a".repeat(40);
const environment = {
  EXPECTED_MAIN_SHA: sha, GITHUB_SHA: sha, GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "Kosyat128/probpera-literary-map", GITHUB_REF: "refs/heads/main",
  GITHUB_WORKFLOW: "Reconcile production database",
  VITE_SUPABASE_URL: "https://sjqejjmwpzfsczxdghvw.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fixture-credential-never-log",
};

describe("reviewed single-work Wells repair", () => {
  it("passes the unchanged real validator and preserves the original CMS text, translations and imagery", async () => {
    const packet = await verifyWellsRepairPacket();
    expect(packet.afterContent.work.description).toBe(packet.beforeContent.work.description);
    expect(packet.afterContent.work.metadata.wellsEditorialRepair20260913.previousTranslations).toEqual(packet.beforeContent.translations);
    expect(packet.afterContent.artworks).toEqual(packet.beforeContent.artworks);
    for (const row of packet.afterContent.translations) {
      expect(row.metadata.descriptionProvenance.origin).toBe("official-source-synthesis");
      expect(row.metadata.descriptionProvenance.author).toBe("Codex AI /root");
      expect(row.description).not.toBe(packet.beforeContent.translations.find(before => before.locale === row.locale).description);
    }
  });

  it("rejects edited packet bytes before accessing any database", async () => {
    const bytes = await readFile(new URL("../../reports/wells-editorial-repair-20260913.json", import.meta.url));
    await expect(verifyWellsRepairPacket({ packetBytes: Buffer.concat([bytes, Buffer.from(" ")]) })).rejects.toThrow("exact reviewed Wells packet");
  });

  it.each([
    { GITHUB_REF: "refs/heads/codex/unreviewed" }, { EXPECTED_MAIN_SHA: "b".repeat(40) },
    { GITHUB_WORKFLOW: "Other workflow" }, { GITHUB_REPOSITORY: "other/repository" },
    { GITHUB_ACTIONS: "false" },
  ])("rejects an invocation outside the reviewed workflow: %j", patch => {
    expect(() => verifyWellsRepairInvocation({ ...environment, ...patch }, sha)).toThrow();
  });

  it("makes no request if checkout or production destination differ", async () => {
    const fetchImpl = vi.fn();
    await expect(applyWellsRepair({ packet: {}, environment, checkoutSha: "b".repeat(40), fetchImpl })).rejects.toThrow();
    await expect(applyWellsRepair({ packet: {}, environment: { ...environment, VITE_SUPABASE_URL: "https://another.supabase.co" }, checkoutSha: sha, fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("accepts only a receipt bound to the exact repaired content, including the idempotent case", async () => {
    const receipt = { contract: WELLS_REPAIR.contract, workId: WELLS_REPAIR.workId, contentSha256: WELLS_REPAIR.afterSha256, attested: true, status: "already-repaired" };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(receipt), {status: 200}));
    const actual = await applyWellsRepair({ packet: {contract: WELLS_REPAIR.contract}, environment, checkoutSha: sha, fetchImpl });
    expect(actual.status).toBe("already-repaired");
    expect(JSON.stringify(actual)).not.toContain(environment.SUPABASE_SERVICE_ROLE_KEY);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://sjqejjmwpzfsczxdghvw.supabase.co/rest/v1/rpc/repair_wells_editorial_evidence_20260913");
    expect(fetchImpl.mock.calls[0][1].redirect).toBe("error");
    receipt.contentSha256 = "0".repeat(64);
    await expect(applyWellsRepair({ packet: {}, environment, checkoutSha: sha, fetchImpl })).rejects.toThrow();
  });

  it("does not disclose raw database error text or fetch exception credentials", async () => {
    const rawError = `secret ${environment.SUPABASE_SERVICE_ROLE_KEY}`;
    await expect(applyWellsRepair({ packet: {}, environment, checkoutSha: sha,
      fetchImpl: async () => new Response(rawError, {status: 409}),
    })).rejects.toThrow("rejected (HTTP 409)");
    await expect(applyWellsRepair({ packet: {}, environment, checkoutSha: sha,
      fetchImpl: async () => { throw new Error(rawError); },
    })).rejects.toThrow("could not be confirmed");
  });
});
