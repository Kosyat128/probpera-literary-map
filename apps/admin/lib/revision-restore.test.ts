import { describe, expect, it } from "vitest";

import { buildRevisionRestorePatch } from "./revision-restore";

describe("safe revision restore patch", () => {
  it("restores only explicitly allowed site-chrome fields", () => {
    expect(
      buildRevisionRestorePatch(
        {
          id: "old-id",
          label: "Журнал",
          href: "/journal/",
          is_visible: true,
          menu_id: "menu-id",
          created_at: "old-date",
          created_by: "old-owner",
          injected_column: "unsafe",
        },
        {
          snapshotIdColumn: "id",
          blockedColumns: ["created_at", "updated_at"],
          allowedColumns: [
            "menu_id",
            "parent_id",
            "label",
            "href",
            "open_in_new_tab",
            "is_visible",
            "display_order",
          ],
        },
        "current-actor"
      )
    ).toEqual({
      menu_id: "menu-id",
      label: "Журнал",
      href: "/journal/",
      is_visible: true,
    });
  });

  it("forces the current actor for banner updated_by", () => {
    expect(
      buildRevisionRestorePatch(
        { id: "banner", title: "Архив", updated_by: "previous-actor" },
        {
          snapshotIdColumn: "id",
          blockedColumns: [],
          allowedColumns: ["title"],
          forceUpdatedBy: true,
        },
        "current-actor"
      )
    ).toEqual({ title: "Архив", updated_by: "current-actor" });
  });

  it("rejects malformed or empty snapshots", () => {
    expect(() =>
      buildRevisionRestorePatch(null, {
        snapshotIdColumn: "id",
        blockedColumns: [],
      }, "actor")
    ).toThrow("повреждён");
    expect(() =>
      buildRevisionRestorePatch({ id: "only-id" }, {
        snapshotIdColumn: "id",
        blockedColumns: [],
        allowedColumns: ["label"],
      }, "actor")
    ).toThrow("нет полей");
  });
});
