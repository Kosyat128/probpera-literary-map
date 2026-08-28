import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MediaUploader publication feedback", () => {
  it("shows every durable publication state and offers a retry on queue failure", () => {
    const uploader = readFileSync(
      new URL("./MediaUploader.tsx", import.meta.url),
      "utf8"
    );
    const actions = readFileSync(
      new URL("../app/(dashboard)/media/actions.ts", import.meta.url),
      "utf8"
    );

    expect(uploader).toContain('result.publication === "started"');
    expect(uploader).toContain('result.publication === "queued"');
    expect(uploader).toContain('publication === "queue-error"');
    expect(uploader).toContain("republishMediaAction");
    expect(uploader).toContain("uploadEditorImage(sourceFile");
    expect(uploader).not.toContain('fetch(withClientAdminPath("/api/media/upload")');
    expect(actions).toContain('reason: "media.uploaded.retry"');
  });
});
