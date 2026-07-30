import { describe, expect, it } from "vitest";

import { isValidIsbn, normalizeIsbn } from "./isbn";

describe("точный импорт книжных изданий", () => {
  it("нормализует ISBN без потери контрольной цифры X", () => {
    expect(normalizeIsbn("0-8044-2957-X")).toBe("080442957X");
  });

  it.each(["0385472579", "9780385533225", "0-8044-2957-X"])(
    "принимает корректный ISBN %s",
    (isbn) => {
      expect(isValidIsbn(isbn)).toBe(true);
    }
  );

  it.each(["0385472578", "9780385533226", "123", "not-an-isbn"])(
    "отклоняет неточный идентификатор %s",
    (isbn) => {
      expect(isValidIsbn(isbn)).toBe(false);
    }
  );
});
