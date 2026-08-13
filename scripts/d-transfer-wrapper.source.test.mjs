import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const wrapperPath = fileURLToPath(
  new URL("./run-d-transfer-once-after-reboot.ps1", import.meta.url),
);
const source = readFileSync(wrapperPath, "utf8");
const registerPath = fileURLToPath(
  new URL("./register-d-transfer-after-reboot.ps1", import.meta.url),
);
const registerSource = readFileSync(registerPath, "utf8");

describe("post-reboot D transfer wrapper", () => {
  it("is ASCII-only so Windows PowerShell 5.1 can parse it reliably", () => {
    expect([...Buffer.from(source)].every((byte) => byte < 128)).toBe(true);
    expect([...Buffer.from(registerSource)].every((byte) => byte < 128)).toBe(true);
  });

  it("fails closed before transfer and limits process checks to D transfer commands", () => {
    expect(source).toContain("if (-not (Test-GitSnapshot))");
    expect(source).toContain("if (-not (Test-StoragePreflight))");
    expect(source).toContain("D:\\\\Codex|complete-d-transfer-after-reboot");
    expect(source).toContain("[string]::IsNullOrWhiteSpace($_.CommandLine)");
    expect(source).toContain("DirtyBitSet -ne $false");
    expect(source).toContain("chkdsk.exe D: /scan");
    expect(source).toContain("Local\\ProbperaCanonicalDTransfer");
  });

  it("archives invalid targets and self-removes only after final verification", () => {
    expect(source).toContain("-ArchiveInvalidTarget");
    const finalCheck = source.indexOf("Installed target failed the final SHA/status check");
    const taskDelete = source.indexOf("schtasks.exe /Delete");
    expect(finalCheck).toBeGreaterThan(0);
    expect(taskDelete).toBeGreaterThan(finalCheck);
    expect(source).not.toMatch(/\b(?:Remove-Item|del|erase|rmdir|rd)\b/i);
  });

  it("registers an exact elevated one-shot task only from clean origin/main", () => {
    expect(registerSource).toContain("$head -ne $originMain");
    expect(registerSource).toContain("$status.Count -ne 0");
    expect(registerSource).toContain("-AtLogOn -User $currentUser");
    expect(registerSource).toContain("-RunLevel Highest");
    expect(registerSource).toContain("Register-ScheduledTask");
    expect(registerSource).toContain("$registered.Actions[0].Arguments -cne $actionArguments");
    expect(registerSource).not.toMatch(/\b(?:Remove-Item|del|erase|rmdir|rd)\b/i);
  });
});
