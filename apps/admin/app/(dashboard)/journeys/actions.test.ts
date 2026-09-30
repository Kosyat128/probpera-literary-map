import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffSession } from "../../../lib/auth";
import type { JourneyDraftCatalog } from "../../../lib/booky-journey-draft";
import type { JourneyDraftActivityValidationResult } from "../../../lib/booky-journey-activity-validation";
import type { Country } from "../../../../../src/data/countries/types";
import type { BookArchiveEntry } from "../../../../../src/data/bookArchive";

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn<() => Promise<StaffSession | null>>(),
  catalog: vi.fn<() => JourneyDraftCatalog>(),
  archive: vi.fn<(countries: readonly Country[]) => BookArchiveEntry[]>(),
  validate: vi.fn<(...args: unknown[]) => JourneyDraftActivityValidationResult>(),
  countries: [] as Country[],
  bookArchiveCountries: [] as Country[],
}));
vi.mock("../../../lib/auth", () => ({ requireStaff: mocks.requireStaff }));
vi.mock("../../../lib/booky-journey-catalog", () => ({ getBookyJourneyDraftCatalog: mocks.catalog }));
vi.mock("../../../lib/booky-journey-activity-validation", () => ({ validateBookyJourneyDraftActivity: mocks.validate }));
vi.mock("../../../../../src/data/countries/index", () => ({ countries: mocks.countries, bookArchiveCountries: mocks.bookArchiveCountries }));
vi.mock("../../../../../src/data/bookArchive", () => ({ buildPublicBookArchive: mocks.archive }));

import { validateBookyJourneyDraftActivityAction } from "./actions";

const staff = (): StaffSession => ({ configured: true, user: { id: "synthetic-staff", email: "staff@example.invalid" },
  role: "editor", mfa: { currentLevel: "aal2", nextLevel: "aal2", required: false } });
const noContentReads = () => {
  expect(mocks.catalog).not.toHaveBeenCalled();
  expect(mocks.archive).not.toHaveBeenCalled();
  expect(mocks.validate).not.toHaveBeenCalled();
};
function expectSafeFailure(result: JourneyDraftActivityValidationResult, field: string) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected action rejection");
  expect(Object.keys(result).sort()).toEqual(["errors", "ok"]);
  expect(result.errors[0].field).toBe(field);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.errors)).toBe(true);
  expect(Object.isFrozen(result.errors[0])).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/secret|stack|staff@example/);
}

describe("Booky draft activity action staff boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireStaff.mockResolvedValue(staff());
    mocks.catalog.mockReturnValue({ countries: [] });
    mocks.archive.mockReturnValue([]);
    // Only a synthetic helper response, never a content approval or staff receipt.
    mocks.validate.mockReturnValue(Object.freeze({ ok: true, draftChecksum: "a".repeat(64) }));
  });

  it("rejects unauthenticated or required-MFA sessions before any current content provider call", async () => {
    // requireStaff returns null for a missing role/user or still-required MFA.
    mocks.requireStaff.mockResolvedValue(null);
    expectSafeFailure(await validateBookyJourneyDraftActivityAction("synthetic draft"), "activity.auth");
    expect(mocks.requireStaff).toHaveBeenCalledTimes(1);
    noContentReads();
  });

  it("rejects an unavailable MFA assurance check before current content provider calls", async () => {
    const session = staff();
    session.mfa.checkError = "secret MFA diagnostic";
    mocks.requireStaff.mockResolvedValue(session);
    expectSafeFailure(await validateBookyJourneyDraftActivityAction("synthetic draft"), "activity.auth");
    noContentReads();
  });

  it("handles a failed staff check without exposing its diagnostic or loading content", async () => {
    mocks.requireStaff.mockRejectedValue(new Error("secret session failure"));
    expectSafeFailure(await validateBookyJourneyDraftActivityAction("synthetic draft"), "activity");
    noContentReads();
  });

  it("checks staff on every request, then loads and forwards only server-owned current public data", async () => {
    const catalog: JourneyDraftCatalog = { countries: [] }, publicBooks: BookArchiveEntry[] = [];
    mocks.catalog.mockReturnValue(catalog);
    mocks.archive.mockReturnValue(publicBooks);
    for (const text of ["first draft", "second draft"]) {
      expect(await validateBookyJourneyDraftActivityAction(text)).toEqual({ ok: true, draftChecksum: "a".repeat(64) });
      expect(mocks.validate).toHaveBeenLastCalledWith(text, catalog,
        { publicCountries: mocks.countries, publicBooks });
    }
    expect(mocks.requireStaff).toHaveBeenCalledTimes(2);
    expect(mocks.catalog).toHaveBeenCalledTimes(2);
    expect(mocks.archive).toHaveBeenCalledTimes(2);
    expect(mocks.archive).toHaveBeenLastCalledWith(mocks.bookArchiveCountries);
    expect(mocks.requireStaff.mock.invocationCallOrder[0]).toBeLessThan(mocks.catalog.mock.invocationCallOrder[0]);
    expect(mocks.catalog.mock.invocationCallOrder[0]).toBeLessThan(mocks.archive.mock.invocationCallOrder[0]);
    expect(mocks.archive.mock.invocationCallOrder[0]).toBeLessThan(mocks.validate.mock.invocationCallOrder[0]);
  });

  it("preserves bounded helper rejection and turns provider failure into a safe retryable error", async () => {
    const helperError = Object.freeze({ ok: false as const,
      errors: Object.freeze([Object.freeze({ field: "activity", message: "Ответ сейчас не подтверждён." })]) });
    mocks.validate.mockReturnValue(helperError);
    expect(await validateBookyJourneyDraftActivityAction("draft")).toBe(helperError);
    mocks.catalog.mockImplementation(() => { throw new Error("secret provider details"); });
    mocks.archive.mockClear();
    mocks.validate.mockClear();
    expectSafeFailure(await validateBookyJourneyDraftActivityAction("draft"), "activity");
    expect(mocks.archive).not.toHaveBeenCalled();
    expect(mocks.validate).not.toHaveBeenCalled();
  });
});
