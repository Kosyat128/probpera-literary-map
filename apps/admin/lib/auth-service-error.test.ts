import { describe, expect, it, vi } from "vitest";
import { authServiceError, guardedAuthRequest, logAuthFailure } from "./auth-service-error";

describe("admin auth service failures", () => {
  it("distinguishes service restriction and rate limiting from invalid credentials", () => {
    expect(authServiceError({ status: 402, message: "secret provider reply" })).toContain("временно ограничен");
    expect(authServiceError({ statusCode: "402" })).toContain("временно ограничен");
    expect(authServiceError({ status: 429 })).toContain("Подождите");
    expect(authServiceError({ status: 400, code: "invalid_credentials" })).toBeNull();
    expect(authServiceError({ name: "AuthSessionMissingError", status: 400 })).toBeNull();
  });
  it("handles thrown network failures without retrying or claiming success", async () => {
    const request = vi.fn().mockRejectedValue(new TypeError("fetch failed secret"));
    const result = await guardedAuthRequest(request);
    expect(request).toHaveBeenCalledTimes(1);
    expect(authServiceError(result.error)).toContain("временно недоступен");
    expect(result).not.toHaveProperty("data");
  });
  it("preserves a valid response and logs only bounded safe diagnostics", async () => {
    const response = { data: { user: { id: "staff" } }, error: null };
    expect(await guardedAuthRequest(async () => response)).toBe(response);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logAuthFailure("password_recovery", { status: 402, message: "email or token", code: "https://secret" });
    expect(spy.mock.calls).toEqual([["Admin auth unavailable", { operation: "password_recovery", status: 402, code: "auth_request_failed" }]]);
    spy.mockRestore();
  });
});
