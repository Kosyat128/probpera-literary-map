import { describe, expect, it, vi } from "vitest";

import {
  adminReadMessage,
  readAdminResult,
  type AdminReadIssue,
} from "./admin-read-result";

type QueryResult<T> = PromiseSettledResult<{ data: T; error?: unknown }>;

const privateError = "PRIVATE_DB_PASSWORD=never-return-this-fixture";
const schemaCodes = [
  "42P01",
  "42703",
  "42883",
  "PGRST202",
  "PGRST204",
  "PGRST205",
] as const;
const permissionCodes = ["42501", "PGRST301", "PGRST302", "PGRST303"] as const;
const isArray = (data: unknown) => Array.isArray(data);

function fulfilled<T>(data: T, error: unknown = null): QueryResult<T> {
  return { status: "fulfilled", value: { data, error } };
}

function readUnknown(
  result: unknown,
  validator: (data: unknown) => boolean = isArray,
) {
  return readAdminResult(result as QueryResult<unknown>, validator);
}

function providerError(code: string) {
  return {
    code,
    message: privateError,
    details: `${privateError}: private details`,
    hint: `${privateError}: internal relation`,
  };
}

function expectSafeFailure(result: unknown, issue: AdminReadIssue) {
  const output = readUnknown(result);
  expect(output).toEqual({ status: "failed", issue });
  expect(JSON.stringify(output)).not.toContain(privateError);
  expect(adminReadMessage(issue)).not.toContain(privateError);
}

describe("M02: a Supabase read has a confirmed result or a safe failure", () => {
  it("preserves a confirmed empty list by reference", () => {
    const rows: unknown[] = [];
    const output = readAdminResult(fulfilled(rows), isArray);

    expect(output).toEqual({ status: "success", data: [] });
    expect(output.status === "success" && output.data).toBe(rows);
  });

  it("preserves successful rows, nested data, and author punctuation unchanged", () => {
    const rows = [
      {
        id: "article-fixture",
        title: "Авторский текст: дефис -, тире \u2014 и \u2013",
        body: { ru: "Слова-слова \u2014 без изменения.", en: "Author text\u2014unchanged." },
      },
    ];
    const original = JSON.stringify(rows);
    const output = readAdminResult(fulfilled(rows), isArray);

    expect(output.status).toBe("success");
    if (output.status !== "success") throw new Error("Expected successful rows");
    expect(output.data).toBe(rows);
    expect(output.data[0]).toBe(rows[0]);
    expect(output.data[0].body).toBe(rows[0].body);
    expect(JSON.stringify(output.data)).toBe(original);
  });

  it("allows null only when the caller validates it as a legitimate result", () => {
    const validateNull = vi.fn((data: unknown) => data === null);
    expect(readAdminResult(fulfilled(null), validateNull)).toEqual({
      status: "success",
      data: null,
    });
    expect(validateNull).toHaveBeenCalledExactlyOnceWith(null);
    expect(readUnknown(fulfilled(null))).toEqual({ status: "failed", issue: "invalid" });
  });

  it.each([0, false, ""])(
    "does not reinterpret a validated falsy value %s as a failed query",
    (data) => {
      expect(readAdminResult(fulfilled(data), (value) => value === data)).toEqual({
        status: "success",
        data,
      });
    },
  );

  it("accepts a result without the optional error property", () => {
    const rows = [{ id: "fixture" }];
    const output = readAdminResult(
      { status: "fulfilled", value: { data: rows } },
      isArray,
    );
    expect(output.status === "success" && output.data).toBe(rows);
  });

  it.each(schemaCodes)("classifies returned %s as a schema failure", (code) => {
    expectSafeFailure(fulfilled(null, providerError(code)), "schema");
  });

  it.each(schemaCodes)("classifies rejected %s as a schema failure", (code) => {
    expectSafeFailure({ status: "rejected", reason: providerError(code) }, "schema");
  });

  it.each(permissionCodes)("classifies returned %s as a permission failure", (code) => {
    expectSafeFailure(fulfilled(null, providerError(code)), "permission");
  });

  it.each(permissionCodes)("classifies rejected %s as a permission failure", (code) => {
    expectSafeFailure({ status: "rejected", reason: providerError(code) }, "permission");
  });

  it.each(["57014", "PGRST000", "UNKNOWN_PROVIDER_CODE"])(
    "classifies returned %s as unavailable without exposing provider fields",
    (code) => {
      expectSafeFailure(fulfilled(null, providerError(code)), "unavailable");
    },
  );

  it.each(["57014", "PGRST000", "UNKNOWN_PROVIDER_CODE"])(
    "classifies rejected %s as unavailable without exposing provider fields",
    (code) => {
      expectSafeFailure({ status: "rejected", reason: providerError(code) }, "unavailable");
    },
  );

  it.each([
    ["a network exception", new TypeError(privateError)],
    ["a provider error without a code", { message: privateError }],
    ["a string rejection", privateError],
    ["an empty rejection", undefined],
  ])("classifies %s as unavailable", (_label, reason) => {
    expectSafeFailure({ status: "rejected", reason }, "unavailable");
  });

  it.each(["fulfilled", "rejected"] as const)(
    "classifies PGRST116 in a %s query as invalid, not as an empty success",
    (status) => {
      const error = providerError("PGRST116");
      const result = status === "fulfilled"
        ? fulfilled(null, error)
        : { status: "rejected", reason: error };
      expectSafeFailure(result, "invalid");
    },
  );

  it.each([
    ["no settled result", undefined],
    ["a null settled result", null],
    ["an invalid settled status", { status: "pending" }],
    ["an invalid settled status with apparent rows", { status: "pending", value: { data: [] } }],
    ["no fulfilled body", { status: "fulfilled" }],
    ["an undefined fulfilled body", { status: "fulfilled", value: undefined }],
    ["a null fulfilled body", { status: "fulfilled", value: null }],
    ["a scalar fulfilled body", { status: "fulfilled", value: "unexpected" }],
    ["an array fulfilled body", { status: "fulfilled", value: [] }],
    ["no data property", { status: "fulfilled", value: { error: null } }],
    ["undefined data", fulfilled(undefined)],
    ["a malformed row list", fulfilled({ rows: [] })],
    ["a scalar row list", fulfilled(42)],
  ])("rejects %s without manufacturing confirmed data", (_label, result) => {
    expectSafeFailure(result, "invalid");
  });

  it("does not let a permissive validator legitimize a missing data property", () => {
    const validate = vi.fn(() => true);
    const output = readUnknown({ status: "fulfilled", value: { error: null } }, validate);
    expect(output).toEqual({ status: "failed", issue: "invalid" });
    expect(validate).not.toHaveBeenCalled();
  });

  it("does not validate or return rows supplied alongside a provider failure", () => {
    const validate = vi.fn(() => true);
    const rows = [{ id: "unconfirmed-fixture", body: privateError }];
    const output = readAdminResult(fulfilled(rows, providerError("42501")), validate);
    expect(output).toEqual({ status: "failed", issue: "permission" });
    expect(validate).not.toHaveBeenCalled();
    expect(JSON.stringify(output)).not.toContain(privateError);
  });

  it("respects the caller's row shape validation", () => {
    const rows = [{ id: 42 }];
    const validate = (data: unknown) => Array.isArray(data)
      && data.every((row) => typeof row.id === "string");
    expect(readAdminResult(fulfilled(rows), validate)).toEqual({
      status: "failed",
      issue: "invalid",
    });
  });

  it.each(["schema", "permission", "unavailable", "invalid"] as const)(
    "provides a fixed Russian message for %s without provider text",
    (issue) => {
      const message = adminReadMessage(issue);
      expect(message).toBeTypeOf("string");
      expect(message.trim().length).toBeGreaterThan(0);
      expect(message).toMatch(/[А-Яа-яЁё]/u);
      expect(message).not.toMatch(/PRIVATE_DB_PASSWORD|PGRST\d+|42P01|42501/u);
      expect(adminReadMessage(issue)).toBe(message);
    },
  );
});
