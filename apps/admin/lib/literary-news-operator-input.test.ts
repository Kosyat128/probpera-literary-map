import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseNewsOperatorForm } from "./literary-news-operator-input";

function form(extra: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ key: "destination:telegram:-10012345", operation: "pause", expected_version: "123", reason: "Оператор проверил сохранённую историю.", ...extra }).forEach(([key, value]) => data.set(key, value));
  return data;
}
const bind = { key: "post:news:sample:telegram:-10012345", operation: "bind_remote", verified: "on", remote_id: "9", proof_url: "https://t.me/c/12345/9" };
describe("news operator input boundary", () => {
  it("preserves exact bigint versions and restricts controls to pause/resume", () => {
    expect(parseNewsOperatorForm(form({ operation: "resume", expected_version: "9223372036854775807" }))).toMatchObject({ action: "resume", expectedVersion: "9223372036854775807", remoteId: null, proofUrl: null });
    for (const operation of ["on", "canary", "bootstrap", "send"]) expect(() => parseNewsOperatorForm(form({ operation }))).toThrow();
  });
  it.each(["0", "-1", "1.5", "1e3", "9223372036854775808", "99999999999999999999"])("rejects invalid CAS version %s", expected_version => {
    expect(() => parseNewsOperatorForm(form({ expected_version }))).toThrow();
  });
  it("rejects arbitrary targets, operation/key mismatch and unbounded fields", () => {
    for (const key of ["destination:telegram:@channel", "destination:vk:123", "destination:telegram:-0", "article:news:test", "post:news:test:telegram:-10012345"]) expect(() => parseNewsOperatorForm(form({ key }))).toThrow();
    expect(() => parseNewsOperatorForm(form({ reason: "short" }))).toThrow("reason_required");
    expect(() => parseNewsOperatorForm(form({ reason: "x".repeat(2001) }))).toThrow();
  });
  it("accepts only a verified remote message in the exact existing numeric destination", () => {
    expect(parseNewsOperatorForm(form(bind))).toMatchObject({ action: "bind_remote", verified: true, remoteId: "9", proofUrl: bind.proof_url });
    for (const proof_url of ["https://t.me/c/12346/9", "https://t.me/c/12345/10", "http://t.me/c/12345/9", "https://t.me/c/12345/9?token=secret", "https://t.me@evil.test/c/12345/9"]) expect(() => parseNewsOperatorForm(form({ ...bind, proof_url }))).toThrow("invalid_remote");
    expect(() => parseNewsOperatorForm(form({ ...bind, verified: "" }))).toThrow("evidence_required");
    expect(() => parseNewsOperatorForm(form({ ...bind, remote_id: "0" }))).toThrow("invalid_remote");
  });
  it("binds VK positive post ID and exact negative community URL", () => {
    expect(parseNewsOperatorForm(form({ ...bind, key: "post:news:sample:vk:-77", remote_id: "31", proof_url: "https://vk.com/wall-77_31" }))).toMatchObject({ remoteId: "31", proofUrl: "https://vk.com/wall-77_31" });
  });
  it("requires evidence for definitely-not-sent, retaining an explicit close action", () => {
    expect(() => parseNewsOperatorForm(form({ key: bind.key, operation: "not_sent" }))).toThrow("evidence_required");
    expect(parseNewsOperatorForm(form({ key: bind.key, operation: "not_sent", verified: "on" }))).toMatchObject({ action: "not_sent", verified: true });
    expect(parseNewsOperatorForm(form({ key: bind.key, operation: "explicitly_close" }))).toMatchObject({ action: "explicitly_close" });
  });
  it("server action gates writes with staff/MFA, session RPC and CAS; no provider dispatch", () => {
    const action = readFileSync("apps/admin/app/(dashboard)/literary-news/actions.ts", "utf8");
    expect(action).toContain('requireStaff(["owner", "admin"])');
    expect(action).toContain("session.mfa.checkError");
    expect(action.indexOf("await requireStaff")).toBeLessThan(action.indexOf("await supabase.rpc"));
    expect(action).toContain("p_expected_id: input.expectedVersion");
    expect(action).toContain('"operate_literary_news_runtime"');
    expect(action).not.toMatch(/service.role|fetch\(|sendMessage|wall\.post|process\.env/u);
  });
});
