import { describe, expect, it } from "vitest";

import {
  normalizeShortHyphens,
  normalizeShortHyphensDeep,
  normalizeShortHyphensFormData,
} from "./short-hyphens";

describe("short hyphen policy", () => {
  it("normalizes en dashes, em dashes and their HTML entities", () => {
    const entities = [
      "&" + "ndash;",
      "&" + "mdash;",
      "&#" + "8211;",
      "&#x" + "2014;",
    ].join(" ");
    expect(
      normalizeShortHyphens(
        `до\u2013после; до\u2014после; ${entities}`
      )
    ).toBe("до-после; до-после; - - - -");
  });

  it("normalizes nested editorial data", () => {
    expect(
      normalizeShortHyphensDeep({
        title: `Заголовок\u2014текст`,
        blocks: [{ text: `Первый\u2013второй` }],
        [`ключ\u2014текст`]: "значение",
      })
    ).toEqual({
      title: "Заголовок-текст",
      blocks: [{ text: "Первый-второй" }],
      "ключ-текст": "значение",
    });
  });

  it("normalizes every string value without collapsing repeated form fields", () => {
    const formData = new FormData();
    formData.append("copy", `Первый\u2014текст`);
    formData.append("copy", `Второй\u2013текст`);

    normalizeShortHyphensFormData(formData);

    expect(formData.getAll("copy")).toEqual([
      "Первый-текст",
      "Второй-текст",
    ]);
  });
});
