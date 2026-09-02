import { describe, expect, it } from "vitest";

import { isBookEvidenceV2Ready } from "../bookEvidence";
import { isPublicBook } from "../bookQuality";
import { bookArchiveCountries } from "./index";
import { applyBookEvidenceV2PublicBatch06 } from "./bookEvidenceV2PublicBatch06";
import { applyBookEvidenceV2PublicBatch07 } from "./bookEvidenceV2PublicBatch07";
import {
  applyBookEvidenceV2PublicQuarantine01,
  applyBookEvidenceV2PublicQuarantine01Work,
  bookEvidenceV2PublicQuarantine01,
} from "./bookEvidenceV2PublicQuarantine01";

const spittelerRecordKey = "switzerland:carl_spitteler:olympian-spring";
const mommsenRecordKey = "germany:theodor_mommsen:history-of-rome";

function findWork(recordKey: string) {
  const countries = applyBookEvidenceV2PublicQuarantine01(
    applyBookEvidenceV2PublicBatch07(
      applyBookEvidenceV2PublicBatch06(bookArchiveCountries)
    )
  );
  const [countryId, writerId, workId] = recordKey.split(":");
  const work = countries
    .find((country) => country.id === countryId)
    ?.writers.find((writer) => writer.id === writerId)
    ?.workDetails?.find((candidate) => candidate.id === workId);
  expect(work).toBeDefined();
  return work!;
}

describe("public book Evidence V2 quarantine 01", () => {
  it("quarantines exactly the two records whose independent evidence is incomplete", () => {
    expect(bookEvidenceV2PublicQuarantine01).toEqual([
      expect.objectContaining({
        recordKey: spittelerRecordKey,
        status: "draft-quarantine",
        unresolvedLocales: ["ru", "en"],
        sourceHoldBatch: "book-evidence-v2-public-batch-06",
      }),
      expect.objectContaining({
        recordKey: mommsenRecordKey,
        status: "draft-quarantine",
        unresolvedLocales: ["ru"],
        sourceHoldBatch: "book-evidence-v2-public-batch-07",
      }),
    ]);
  });

  it("retains Spitteler research but prevents public publication", () => {
    const work = findWork(spittelerRecordKey);
    expect(work.title).toBe("Олимпийская весна");
    expect(work.translations?.en?.title).toBe("Olympian Spring");
    expect(work.description).toBeTruthy();
    expect(work.sources?.length).toBeGreaterThanOrEqual(2);
    expect(work.editorial?.status).toBe("draft");
    expect(work.translations?.ru?.status).toBe("draft");
    expect(work.translations?.en?.status).toBe("draft");
    expect(isPublicBook(work)).toBe(false);
    expect(isBookEvidenceV2Ready(work)).toBe(false);
  });

  it("retains Mommsen's exact data but rejects duplicate-source independence", () => {
    const work = findWork(mommsenRecordKey);
    expect(work.title).toBe("Римская история");
    expect(work.translations?.en?.title).toBe("The History of Rome");
    expect(work.localizedTitles?.ru?.evidence).toHaveLength(2);
    expect(work.localizedTitles?.en?.evidence).toHaveLength(2);
    expect(work.sources?.length).toBeGreaterThanOrEqual(6);
    expect(work.editorial?.status).toBe("draft");
    expect(work.translations?.ru?.status).toBe("draft");
    expect(work.translations?.en?.status).toBe("draft");
    expect(isPublicBook(work)).toBe(false);
  });

  it("is immutable and leaves every non-target work untouched", () => {
    const input = {
      id: "other",
      title: "Другая книга",
      editorial: { status: "verified" as const },
    };
    const output = applyBookEvidenceV2PublicQuarantine01Work(
      "switzerland",
      "carl_spitteler",
      input
    );
    expect(output).toBe(input);
  });
});
