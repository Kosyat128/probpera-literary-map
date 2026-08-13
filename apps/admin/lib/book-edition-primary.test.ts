import { describe, expect, it, vi } from "vitest";

import { persistWithPrimaryEditionCompensation } from "./book-edition-primary";

describe("book edition primary compensation", () => {
  it("persists directly when the edition is not primary", async () => {
    const read = vi.fn(async () => ["old"]);
    const persist = vi.fn(async () => "saved");
    await expect(
      persistWithPrimaryEditionCompensation({
        enabled: false,
        readPreviousPrimaryIds: read,
        demotePreviousPrimaries: vi.fn(),
        persist,
        restorePreviousPrimaries: vi.fn(),
      })
    ).resolves.toBe("saved");
    expect(read).not.toHaveBeenCalled();
  });

  it("demotes previous primaries before a successful write", async () => {
    const demote = vi.fn(async () => undefined);
    const restore = vi.fn(async () => undefined);
    await expect(
      persistWithPrimaryEditionCompensation({
        enabled: true,
        readPreviousPrimaryIds: async () => ["old-primary"],
        demotePreviousPrimaries: demote,
        persist: async () => "new-primary",
        restorePreviousPrimaries: restore,
      })
    ).resolves.toBe("new-primary");
    expect(demote).toHaveBeenCalledWith(["old-primary"]);
    expect(restore).not.toHaveBeenCalled();
  });

  it("restores the previous primary when persistence fails", async () => {
    const restore = vi.fn(async () => undefined);
    await expect(
      persistWithPrimaryEditionCompensation({
        enabled: true,
        readPreviousPrimaryIds: async () => ["old-primary"],
        demotePreviousPrimaries: async () => undefined,
        persist: async () => {
          throw new Error("duplicate ISBN");
        },
        restorePreviousPrimaries: restore,
      })
    ).rejects.toThrow("duplicate ISBN");
    expect(restore).toHaveBeenCalledWith(["old-primary"]);
  });

  it("surfaces a critical error when compensation also fails", async () => {
    await expect(
      persistWithPrimaryEditionCompensation({
        enabled: true,
        readPreviousPrimaryIds: async () => ["old-primary"],
        demotePreviousPrimaries: async () => undefined,
        persist: async () => {
          throw new Error("write failed");
        },
        restorePreviousPrimaries: async () => {
          throw new Error("restore failed");
        },
      })
    ).rejects.toThrow(/Сохранение: write failed.*Восстановление: restore failed/u);
  });
});
