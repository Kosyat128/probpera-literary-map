import { describe, expect, it } from "vitest";

import * as canonicalBooks from "../data/bookArchive";
import { cmsWriterKey as canonicalWriterKey } from "../data/cms/editorialOverrides";
import { isPublicBook as canonicalPublicationGate } from "../data/bookQuality";
import { bookArchiveCountries, countries } from "./catalog";
import * as books from "./books";

describe("shared book identity and publication boundary", () => {
  it("uses the canonical archive builder, relation keys and publication gate", () => {
    expect(books.buildBookArchive).toBe(canonicalBooks.buildBookArchive);
    expect(books.bookArchiveKey).toBe(canonicalBooks.bookArchiveKey);
    expect(books.cmsWriterKey).toBe(canonicalWriterKey);
    expect(books.isPublicBook).toBe(canonicalPublicationGate);
    expect(books.bookArchiveKey("russia", "tolstoy", "war-and-peace")).toBe("russia:tolstoy:war-and-peace");
    expect(books.cmsWriterKey("russia", "tolstoy")).toBe("russia:tolstoy");
  });

  it("resolves public navigation to the exact current country and writer objects", () => {
    const country = countries.find((candidate) => candidate.writers.length > 0)!;
    const writer = country.writers[0];
    const target = books.resolveBookArchivePublicTarget(countries, {
      countryId: country.id,
      writerId: writer.id,
    });
    expect(target?.country).toBe(country);
    expect(target?.writer).toBe(writer);
  });

  it("retains quarantined writer relations for books without restoring public writer access", () => {
    const publicKeys = new Set(countries.flatMap((country) => country.writers.map((writer) => books.cmsWriterKey(country.id, writer.id))));
    const retained = bookArchiveCountries.flatMap((country) => country.writers.map((writer) => ({ country, writer }))).find(({ country, writer }) => !publicKeys.has(books.cmsWriterKey(country.id, writer.id)));
    expect(retained).toBeDefined();
    expect(books.resolveBookArchivePublicTarget(countries, {
      countryId: retained!.country.id,
      writerId: retained!.writer.id,
    })).toBeNull();
    expect(retained!.country.writers).toContain(retained!.writer);
  });

  it("keeps each pending/verified work keyed once and retains original book and asset references", () => {
    const country = bookArchiveCountries.find((candidate) => candidate.id === "russia")!;
    const sourceWriter = country.writers.find((candidate) => candidate.id === "tolstoy")!;
    const archive = books.buildBookArchive([{ ...country, writers: [sourceWriter] }]);
    expect(archive.length).toBeGreaterThan(0);
    const byKey = new Map(archive.map((book) => [books.bookArchiveKey(book.countryId, book.writerId, book.id), book]));
    const queue = books.classifyBookArchiveQueue(archive);
    expect(queue.counts.total).toBe(byKey.size);
    expect(queue.counts.verified + queue.counts.pending).toBe(queue.counts.total);
    for (const item of queue.all) {
      const original = byKey.get(item.key)!;
      expect(item.book).toBe(original);
      expect(item.status).toBe(canonicalPublicationGate(original) ? "verified" : "pending");
      expect(item.book.edition).toBe(original.edition);
      expect(item.book.coverRights).toBe(original.coverRights);
      expect(books.coverArtworkSrcSet(item.book)).toBe(canonicalBooks.coverArtworkSrcSet(original));
      expect(books.isCoverArtworkDisplayAllowed(item.book)).toBe(canonicalBooks.isCoverArtworkDisplayAllowed(original));
    }
  });
});
