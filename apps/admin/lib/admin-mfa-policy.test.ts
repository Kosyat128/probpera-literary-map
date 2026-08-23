import { describe, expect, it } from "vitest";

import {
  adminMfaStatusLabel,
  shouldRequireStaffMfa,
} from "./admin-mfa-policy";

describe("admin MFA policy", () => {
  it("requires a challenge only for staff whose verified factor can raise aal1 to aal2", () => {
    expect(
      shouldRequireStaffMfa({
        hasStaffRole: true,
        currentLevel: "aal1",
        nextLevel: "aal2",
      })
    ).toBe(true);

    expect(
      shouldRequireStaffMfa({
        hasStaffRole: true,
        currentLevel: "aal2",
        nextLevel: "aal2",
      })
    ).toBe(false);
  });

  it("does not force enrollment before the owner has verified a factor", () => {
    expect(
      shouldRequireStaffMfa({
        hasStaffRole: true,
        currentLevel: "aal1",
        nextLevel: "aal1",
      })
    ).toBe(false);
    expect(
      shouldRequireStaffMfa({
        hasStaffRole: false,
        currentLevel: "aal1",
        nextLevel: "aal2",
      })
    ).toBe(false);
  });

  it("reports the visible assurance state without exposing factor secrets", () => {
    expect(adminMfaStatusLabel({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(
      "Подтверждено"
    );
    expect(adminMfaStatusLabel({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(
      "Требуется код"
    );
    expect(adminMfaStatusLabel({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(
      "Не подключено"
    );
  });
});
