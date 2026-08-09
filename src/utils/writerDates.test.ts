import { describe, expect, it } from "vitest";

import {
  calculateWriterLifespanAge,
  formatWriterDate,
  parseWriterDate,
} from "./writerDates";

describe("writer date precision", () => {
  it("keeps month-only dates at month precision", () => {
    expect(parseWriterDate("1925-02")).toMatchObject({
      year: 1925,
      month: 2,
      precision: "month",
    });
    expect(formatWriterDate("1925-02", "ru")).toBe("февраль 1925 г.");
    expect(formatWriterDate("1925-02", "en")).toBe("February 1925");
  });

  it("formats complete dates without changing their precision", () => {
    expect(formatWriterDate("1925-02-28", "ru")).toBe("28 февраля 1925 г.");
    expect(formatWriterDate("1925-02-28", "en")).toBe("February 28, 1925");
  });

  it("does not invent an exact lifespan age from partial dates", () => {
    expect(calculateWriterLifespanAge("1925-02", "2012-09-16")).toBeNull();
    expect(calculateWriterLifespanAge("1925", "2012")).toBeNull();
    expect(calculateWriterLifespanAge("1925-02-28", "2012-09-16")).toBe(87);
  });

  it("rejects impossible calendar dates", () => {
    expect(parseWriterDate("1925-02-30")).toBeNull();
  });
});
