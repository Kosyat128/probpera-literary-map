import { describe, expect, it } from "vitest";
import { pageCreateContentRejection, parsePageCreateResult } from "./page-create-result";

const known = () => ({ outcome: "rejected", reason: "content", message: "The initial content is too large." });

describe("Closed page-create pre-insert content rejection", () => {
  it("accepts exactly the known refusal into a detached closed object", () => {
    const source = known(), result = parsePageCreateResult(source)!;
    expect(result).toEqual(source); expect(result).not.toBe(source);
    expect(Reflect.ownKeys(result).sort()).toEqual(["message", "outcome", "reason"]);
    source.message = "changed later";
    expect(result.message).toBe("The initial content is too large.");
  });
  it.each(["x".repeat(500), "😀".repeat(250), "  exact message  "])("retains a bounded nonempty message", message => {
    expect(parsePageCreateResult({ ...known(), message })?.message).toBe(message);
  });
  it.each([null, undefined, [], "rejected", 1, false, new Date(), Object.create({ inherited: true })])("holds an unknown top-level value %j", value => {
    expect(parsePageCreateResult(value)).toBeNull();
  });
  it.each(["outcome", "reason", "message"])("refuses a missing %s", key => {
    const value: Record<string, unknown> = known(); delete value[key];
    expect(parsePageCreateResult(value)).toBeNull();
  });
  it.each([
    { outcome: "saved" }, { reason: "network" }, { message: "" }, { message: " \n\t" },
    { message: "\u00a0" }, { message: "x".repeat(501) }, { message: 1 }, { message: null },
    { canExecute: true }, { receipt: { pageId: "untrusted" } }, { extra: undefined },
  ])("holds malformed or extra-key result %j", patch => {
    expect(parsePageCreateResult({ ...known(), ...patch })).toBeNull();
  });
  it("rejects a symbol or nonenumerable extra field", () => {
    const symbol = { ...known(), [Symbol("extra")]: true };
    const hidden = Object.defineProperty(known(), "extra", { value: true });
    expect(parsePageCreateResult(symbol)).toBeNull(); expect(parsePageCreateResult(hidden)).toBeNull();
  });
  it("rejects accessors without invoking the getter", () => {
    let calls = 0;
    const value = Object.defineProperty({ outcome: "rejected", reason: "content" }, "message", {
      enumerable: true, get() { calls += 1; return "untrusted"; },
    });
    expect(parsePageCreateResult(value)).toBeNull(); expect(calls).toBe(0);
  });
  it("rejects nonenumerable protocol fields", () => {
    const value = Object.defineProperty(known(), "message", { value: "hidden", enumerable: false });
    expect(parsePageCreateResult(value)).toBeNull();
  });
  it("accepts a null-prototype data object into an ordinary detached DTO", () => {
    const value = Object.assign(Object.create(null), known());
    const result = parsePageCreateResult(value)!;
    expect(result).toEqual(known()); expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });
  it("uses the identical parser for server construction and fails closed on invalid messages", () => {
    expect(pageCreateContentRejection("Known refusal")).toEqual({ outcome: "rejected", reason: "content", message: "Known refusal" });
    expect(() => pageCreateContentRejection("")).toThrow("Invalid page-create rejection contract");
    expect(() => pageCreateContentRejection("x".repeat(501))).toThrow("Invalid page-create rejection contract");
  });
});
