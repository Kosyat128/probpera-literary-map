import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  staff: vi.fn(), upload: vi.fn(), insert: vi.fn(), build: vi.fn(), remove: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireStaff: mocks.staff }));
vi.mock("@/lib/publication", () => ({ requestPublicBuild: mocks.build }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    storage: { from: () => ({
      upload: mocks.upload,
      remove: mocks.remove,
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.invalid/${path}` } }),
    }) },
    from: (table: string) => ({ insert: (row: unknown) => {
      mocks.insert(table, row);
      return { select: () => ({ single: async () => ({ data: { id: "local-test-media" }, error: null }) }) };
    } }),
  }),
}));
import { POST } from "./route";

function request(bytes: Uint8Array, mime: string, width = 96, height = 64) {
  const data = new FormData();
  data.set("file", new File([Uint8Array.from(bytes)], "misleading-name.gif", { type: mime }));
  data.set("alt_text", "Local image fixture");
  data.set("client_width", String(width));
  data.set("client_height", String(height));
  return new Request("https://example.invalid/api/media/upload", { method: "POST", body: data });
}
const source = () => sharp({ create: { width: 96, height: 64, channels: 4, background: "#ff880080" } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.staff.mockResolvedValue({ user: { id: "local-staff" } });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.build.mockResolvedValue({ state: "queued" });
});

describe("media upload format validation before storage", () => {
  it.each(["jpeg", "png", "webp", "avif"] as const)("preserves validated %s bytes and stores the actual MIME/extension", async (format) => {
    const bytes = await source().toFormat(format).toBuffer();
    const response = await POST(request(bytes, `image/${format}`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ width: 96, height: 64, publication: "queued" });
    const [path, uploaded, options] = mocks.upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`\\.${format === "jpeg" ? "jpg" : format}$`));
    expect(Buffer.from(uploaded)).toEqual(bytes);
    expect(options.contentType).toBe(`image/${format}`);
    expect(mocks.insert).toHaveBeenCalledWith("media_assets", expect.objectContaining({ mime_type: `image/${format}`, width: 96, height: 64, byte_size: bytes.length }));
  });

  it("validates oriented dimensions instead of rejecting a portrait JPEG", async () => {
    const bytes = await source().withMetadata({ orientation: 6 }).jpeg().toBuffer();
    expect((await POST(request(bytes, "image/jpeg", 64, 96))).status).toBe(200);
  });

  it("preserves both frames of animated WebP", async () => {
    const pixels = Buffer.alloc(96 * 128 * 4, 255);
    pixels.fill(80, 96 * 64 * 4);
    const bytes = await sharp(pixels, { raw: { width: 96, height: 128, channels: 4, pageHeight: 64 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
    expect((await sharp(bytes, { animated: true }).metadata()).pages).toBe(2);
    expect((await POST(request(bytes, "image/webp"))).status).toBe(200);
    expect(Buffer.from(mocks.upload.mock.calls[0][1])).toEqual(bytes);
    expect(mocks.insert).toHaveBeenCalledWith("admin_audit_log", expect.objectContaining({ metadata: expect.objectContaining({ animated: true }) }));
  });

  it("rejects mismatched MIME, forged dimensions and executable content before any write", async () => {
    const bytes = await source().png().toBuffer();
    expect((await POST(request(bytes, "image/webp"))).status).toBe(415);
    expect((await POST(request(bytes, "image/png", 10, 10))).status).toBe(422);
    expect((await POST(request(new TextEncoder().encode("<svg><script/></svg>"), "image/png"))).status).toBe(415);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.build).not.toHaveBeenCalled();
  });

  it("keeps the existing staff authorization gate", async () => {
    mocks.staff.mockResolvedValue(null);
    expect((await POST(request(await source().png().toBuffer(), "image/png"))).status).toBe(401);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
