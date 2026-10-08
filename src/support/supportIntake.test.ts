import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupportDraft, createSupportMailto, resolveSupportReplyLocale, SUPPORT_INCIDENTS, SUPPORT_RECIPIENT, type SupportIncidentId } from "./supportDraft";

afterEach(() => vi.unstubAllGlobals());

describe("shared support intake drafts", () => {
  it("covers the same eleven requirement-155 incidents in both languages", () => {
    expect(SUPPORT_INCIDENTS.map(incident => incident.id)).toEqual([
      "installation-launch", "globe-webgl", "content-correction", "child-parent-gate", "purchase-restore-refund",
      "account-deletion", "privacy-data-request", "rights-takedown", "accessibility", "store-review-moderation", "security-incident",
    ]);
    for (const incident of SUPPORT_INCIDENTS) {
      for (const locale of ["ru", "en"] as const) {
        const draft = createSupportDraft(incident.id, locale);
        expect(draft).toMatchObject({ incidentId: incident.id, recipient: SUPPORT_RECIPIENT, replyLocale: locale });
        expect(draft.subject).toContain(incident[locale].title);
        expect(draft.body).toContain(incident[locale].prompt);
        expect(draft.subject).toContain(`[${incident.id}]`);
        expect(draft.body).toContain(incident.id);
        if (locale === "en") expect(draft.subject + draft.body).not.toMatch(/[а-яё]/iu);
        else expect(draft.body).toContain("Предпочитаемый язык ответа: русский.");
      }
    }
  });

  it("uses only an explicit supported reply locale and falls back to English", () => {
    expect(resolveSupportReplyLocale("ru")).toBe("ru");
    expect(resolveSupportReplyLocale("en")).toBe("en");
    const english = createSupportDraft("security-incident", "en");
    for (const unknown of [undefined, null, "", "RU", "ru-RU", " ru ", "fr", {}, ["ru"], "ru\nBcc: other@example.test"]) {
      expect(resolveSupportReplyLocale(unknown)).toBe("en");
      expect(createSupportDraft("security-incident", unknown)).toEqual(english);
    }
  });

  it("does not read or append browser, account, device or route information", () => {
    const secret = "ambient-private-value";
    for (const global of ["window", "document", "navigator"]) vi.stubGlobal(global, new Proxy({}, {
      get() { throw new Error(secret); },
    }));
    const draft = createSupportDraft("account-deletion", "ru");
    expect(Object.keys(draft).sort()).toEqual(["body", "incidentId", "recipient", "replyLocale", "subject"]);
    expect(draft.subject + draft.body).not.toContain(secret);
    expect(draft.recipient).toBe("probperasite@yandex.ru");
  });

  it("builds an opt-in email URI with one fixed recipient and only encoded subject/body", () => {
    for (const incident of SUPPORT_INCIDENTS) {
      for (const locale of ["ru", "en"] as const) {
        const draft = createSupportDraft(incident.id, locale);
        const uri = new URL(createSupportMailto(incident.id, locale));
        expect(uri.protocol).toBe("mailto:");
        expect(uri.pathname).toBe("probperasite@yandex.ru");
        expect([...uri.searchParams.keys()]).toEqual(["subject", "body"]);
        expect(uri.searchParams.get("subject")).toBe(draft.subject);
        expect(uri.searchParams.get("body")).toBe(draft.body);
        expect(uri.hash).toBe("");
      }
    }
    expect(createSupportMailto("security-incident", "ru\nBcc: other@example.test"))
      .toBe(createSupportMailto("security-incident", "en"));
    expect(() => createSupportMailto("other@example.test" as SupportIncidentId, "ru"))
      .toThrow("Unknown support incident");
  });

  it("rejects an unknown category instead of echoing it into a draft", () => {
    expect(() => createSupportDraft("unknown\nBcc: other@example.test" as SupportIncidentId, "en"))
      .toThrow("Unknown support incident");
  });
});
