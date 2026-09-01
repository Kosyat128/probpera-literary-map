import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n?/gu, "\n");

const authSource = read("apps/admin/lib/auth.ts");
const policySource = read("apps/admin/lib/admin-mfa-policy.ts");
const dashboardLayout = read("apps/admin/app/(dashboard)/layout.tsx");
const loginPage = read("apps/admin/app/(auth)/login/page.tsx");
const challengeAction = read("apps/admin/app/(auth)/mfa/actions.ts");
const challengePage = read("apps/admin/app/(auth)/mfa/page.tsx");
const settingsComponent = read("apps/admin/components/AdminMfaSettings.tsx");
const settingsLoader = read("apps/admin/components/AdminMfaSettingsLoader.tsx");
const settingsPage = read("apps/admin/app/(dashboard)/settings/page.tsx");

describe("admin TOTP MFA source contract", () => {
  it("requires AAL2 only after a verified factor makes AAL2 reachable", () => {
    expect(authSource).toContain("getAuthenticatorAssuranceLevel");
    expect(authSource).toContain("shouldRequireStaffMfa");
    expect(authSource).toContain("session.mfa.required");
    expect(policySource).toContain('input.nextLevel === "aal2"');
    expect(policySource).toContain('input.currentLevel !== "aal2"');
    expect(policySource).not.toContain("enroll(");
  });

  it("blocks dashboard and server actions for opted-in staff still at AAL1", () => {
    const mfaGate = dashboardLayout.indexOf("session.mfa.required");
    const shell = dashboardLayout.indexOf("<AdminShell");
    expect(mfaGate).toBeGreaterThan(-1);
    expect(shell).toBeGreaterThan(mfaGate);
    expect(dashboardLayout).toContain('adminRedirect("/mfa")');
    expect(loginPage).toContain("session.mfa.required");
    expect(loginPage).toContain('redirect("/mfa")');
    expect(authSource).toContain("!session.role ||\n    session.mfa.required ||");
  });

  it("uses the official challenge and verify path for an already verified TOTP factor", () => {
    expect(challengeAction).toContain("supabase.auth.mfa.listFactors()");
    expect(challengeAction).toContain('item.status === "verified"');
    expect(challengeAction).toContain("supabase.auth.mfa.challenge({ factorId: factor.id })");
    expect(challengeAction).toContain("supabase.auth.mfa.verify({");
    expect(challengeAction).toContain("challengeId: challenge.id");
    expect(challengePage).toContain('autoComplete="one-time-code"');
    expect(challengePage).toContain('pattern="[0-9]{6}"');
  });

  it("keeps enrollment opt-in and secrets only in ephemeral client state", () => {
    expect(settingsComponent).toContain('factorType: "totp"');
    expect(settingsComponent).toContain("data.totp.qr_code");
    expect(settingsComponent).toContain("data.totp.secret");
    expect(settingsComponent).toContain("setEnrollment({");
    expect(settingsComponent).toContain("supabase.auth.mfa.challenge({ factorId })");
    expect(settingsComponent).toContain("supabase.auth.mfa.verify({");
    expect(settingsComponent).not.toContain("localStorage");
    expect(settingsComponent).not.toContain("sessionStorage");
    expect(settingsComponent).not.toContain("console.log");
    expect(settingsComponent).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("cancels only the current unverified enrollment and leaves verified-factor removal out of Stage 1", () => {
    expect(settingsComponent).toContain("const factorId = enrollment?.factorId");
    expect(settingsComponent).toContain("supabase.auth.mfa.unenroll({ factorId })");
    expect(settingsComponent).not.toContain("removeVerifiedFactor");
    expect(settingsComponent).toContain("Добавить резервный аутентификатор");
  });

  it("surfaces MFA status and enrollment from the existing settings page", () => {
    expect(settingsPage).toContain("<AdminMfaSettingsLoader");
    expect(settingsPage).not.toContain(
      'from "@/components/AdminMfaSettings"'
    );
    expect(settingsLoader).toContain(
      'dynamic(() => import("./AdminMfaSettings")'
    );
    expect(settingsLoader).toContain("ssr: false");
    expect(settingsPage).toContain("adminMfaStatusLabel");
    expect(settingsPage).toContain("MFA редакции");
  });
});
