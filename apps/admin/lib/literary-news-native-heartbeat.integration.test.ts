import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { summarizeNewsRuntime, newsDeliveryStatuses, NEWS_RUNTIME_PAGE_SIZE } from "./literary-news-runtime-overview";

const current = new Date("2026-09-30T12:00:00Z"), revision = "a".repeat(64);
function native(change: Record<string, unknown> = {}) {
  return { runner: "native-cron", finishedAt: current.toISOString(), status: "daily_target_deficit",
    deliveredThisRun: 999, providerResponse: { token: "PRIVATE_TOKEN" }, dayStatus: {
      editorialDay: "2026-09-30", timeZone: "Europe/Moscow", minimum: 10, maximum: 15,
      acknowledgedCreates: 20, acknowledgedPhotoCreates: 15, freshCreates: 6, freshPhotoCreates: 6,
      legacyReceiptsWithUnknownFirstDate: 2, deficitToMinimum: 4 }, ...change };
}
type Entry = { id: string; key: string; state: Record<string, unknown> };
const summarize = (state: Record<string, unknown> | null, extra: Entry[] = [], at = current) => summarizeNewsRuntime({
  rows: [...extra, ...(state ? [{ id: "2", key: "heartbeat:native-delivery", state }] : [])],
  complete: true, readError: false, invalidRows: 0, rowsRead: extra.length + (state ? 1 : 0)
}, true, at);

// Execute the actual server component without admin alias resolution or real controls.
const filename = path.resolve(import.meta.dirname, "../components/LiteraryNewsDeliveryOverview.tsx");
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const module = { exports: {} as { default: (props: unknown) => React.ReactNode } };
const realRequire = createRequire(import.meta.url);
const mocks: Record<string, unknown> = {
  "@/components/LiteraryNewsRuntimeControls": { NewsDestinationControls: () => null, NewsJobResolutionControls: () => null },
  "@/lib/literary-news-runtime-overview": { newsDeliveryStatuses, NEWS_RUNTIME_PAGE_SIZE },
  "@/lib/literary-news-queue": { formatNewsQueueDate: (value: string) => value }
};
new Function("require", "module", "exports", compiled)((name: string) => Object.hasOwn(mocks, name) ? mocks[name] : realRequire(name), module, module.exports);
const render = (snapshot: ReturnType<typeof summarize>) => renderToStaticMarkup(module.exports.default({ snapshot, query: {}, canManage: false }));

describe("native heartbeat actual admin projection and rendering", () => {
  it("recognizes the exact native key, selects the latest scheduler, and displays confirmed metrics without trusting run counters", () => {
    const snapshot = summarize(native(), [{ id: "1", key: "heartbeat:scheduler", state: { finishedAt: "2026-09-30T11:00:00Z", mode: "--capture" } }]);
    expect(snapshot).toMatchObject({ complete: true, lastSchedulerAt: current.toISOString(), schedulerMode: "native-cron",
      nativeDelivery: { freshPhotoCreates: 6, deficitToMinimum: 4, nonFreshPhotoCreates: 9, otherAcknowledgedCreates: 5,
        legacyReceiptsWithUnknownFirstDate: 2, isCurrentDay: true } });
    expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE_TOKEN|deliveredThisRun/);
    const html = render(snapshot);
    expect(html).toContain("с фото: <strong>6</strong>"); expect(html).toContain("осталось: <strong>4</strong>");
    expect(html).toContain("известной даты первой отправки в истории: <strong>2</strong>");
    expect(html).toContain("Правки ранее опубликованных сообщений не считаются новыми отправками");
  });
  it("today's edits and legacy receipts cannot inflate fresh creates", () => {
    const state = native(), day = state.dayStatus;
    const snapshot = summarize(native({ dayStatus: { ...day, acknowledgedCreates: 0, acknowledgedPhotoCreates: 0,
      freshCreates: 0, freshPhotoCreates: 0, deficitToMinimum: 10 } }), [{ id: "1", key: "post:news:edited:telegram:-10012345", state: {
      newsId: "edited", destination: { platform: "telegram", id: "-10012345" }, status: "sent_current",
      originalAdmission: "2026-09-29T12:00:00Z", remoteId: "8", acknowledgedRevision: revision, desiredRevision: revision,
      firstAcknowledgedAt: "2026-09-29T12:00:00Z", acknowledgedAt: current.toISOString(), prepared: { payload: { text: "An edited post" } }
    } }]);
    expect(snapshot.lastDeliveryAt).toBe(current.toISOString());
    expect(snapshot.nativeDelivery?.freshPhotoCreates).toBe(0);
    const html = render(snapshot); expect(html).toContain("с фото: <strong>0</strong>"); expect(html).toContain("осталось: <strong>10</strong>");
  });
  it("counts fresh text news toward the same target and keeps photo totals separate", () => {
    const state = native(), snapshot = summarize(native({ dayStatus: { ...state.dayStatus,
      freshCreates: 10, freshPhotoCreates: 6, deficitToMinimum: 0 }, status: "daily_minimum_reached" }));
    expect(snapshot.nativeDelivery).toMatchObject({ freshCreates: 10, freshPhotoCreates: 6,
      freshTextCreates: 4, deficitToMinimum: 0 });
    const html = render(snapshot);
    expect(html).toContain("новостей: <strong>10</strong>");
    expect(html).toContain("без фото: <strong>4</strong>");
    expect(html).toContain("08:00 до 23:00");
    expect(html).toContain("1 часа 45 минут (105 минут)");
    expect(html).not.toMatch(/примерно раз в час|фото получают приоритет/);
  });
  it("past-day heartbeat remains explicitly historical instead of a current-day zero or success", () => {
    const state = native(), snapshot = summarize(native({ finishedAt: "2026-09-29T20:59:59Z",
      dayStatus: { ...state.dayStatus, editorialDay: "2026-09-29" } }));
    expect(snapshot.nativeDelivery).toMatchObject({ isCurrentDay: false, freshPhotoCreates: 6 });
    const html = render(snapshot);
    expect(html).toContain("Сводка за сегодня ещё не получена"); expect(html).toContain("2026-09-29");
    expect(html).not.toContain("с фото: <strong>6</strong>");
  });
  it("Moscow midnight uses the report's actual editorial day", () => {
    const snapshot = summarize(native({ finishedAt: "2026-09-29T21:00:00Z" }));
    expect(snapshot.nativeDelivery).toMatchObject({ editorialDay: "2026-09-30", isCurrentDay: true });
  });
  it.each(["counter", "deficit", "timezone", "day", "future", "status", "runner"])("rejects invalid native %s without presenting confirmed totals", kind => {
    const value = native();
    if (kind === "counter") value.dayStatus.freshPhotoCreates = 16;
    if (kind === "deficit") value.dayStatus.deficitToMinimum = 0;
    if (kind === "timezone") value.dayStatus.timeZone = "UTC";
    if (kind === "day") value.dayStatus.editorialDay = "2026-09-29";
    if (kind === "future") value.finishedAt = "2026-09-30T12:00:01Z";
    if (kind === "status") value.status = "daily_minimum_reached";
    if (kind === "runner") value.runner = "unverified";
    const snapshot = summarize(value);
    expect(snapshot).toMatchObject({ complete: false, nativeDelivery: null, nativeDeliveryInvalid: true, invalidRows: 1 });
    expect(render(snapshot)).toContain("Количество отправок за сегодня неизвестно");
  });
  it("an arbitrary heartbeat suffix and absent native report cannot fabricate a daily result", () => {
    const snapshot = summarize(null, [{ id: "1", key: "heartbeat:native-delivery:extra", state: native() }]);
    expect(snapshot.nativeDelivery).toBeNull();
    expect(render(snapshot)).toContain("Подтверждённая дневная сводка нативного планировщика ещё не получена");
  });
  it.each([2, 8, 9])("renders the current 8-10 heartbeat with %s actual fresh creates and its validated deficit", freshCreates => {
    const at = new Date("2026-10-09T12:20:00Z");
    const snapshot = summarize(native({ finishedAt: at.toISOString(),
      status: freshCreates < 8 ? "daily_target_deficit" : "daily_minimum_reached",
      dayStatus: { editorialDay: "2026-10-09", timeZone: "Europe/Moscow", minimum: 8, maximum: 10,
        acknowledgedCreates: freshCreates, acknowledgedPhotoCreates: 1, freshCreates, freshPhotoCreates: 1,
        legacyReceiptsWithUnknownFirstDate: 2, deficitToMinimum: Math.max(0, 8 - freshCreates) } }), [], at);
    expect(snapshot).toMatchObject({ complete: true, nativeDeliveryInvalid: false,
      nativeDelivery: { minimum: 8, maximum: 10, freshCreates, freshTextCreates: freshCreates - 1,
        deficitToMinimum: Math.max(0, 8 - freshCreates), isCurrentDay: true } });
    const html = render(snapshot);
    expect(html).toContain("Цель: 8-10 в день");
    expect(html).toContain(`новостей: <strong>${freshCreates}</strong>`);
    expect(html).toContain(`осталось: <strong>${Math.max(0, 8 - freshCreates)}</strong>`);
    expect(html).toContain("1 часа 45 минут (105 минут)");
    expect(html).toContain("08:00 до 23:00");
    expect(html).not.toMatch(/сводка планировщика не прошла|примерно раз в час|фото получают приоритет|PRIVATE_TOKEN/);
  });
  it.each([15, 20])("retains the known historical 10/%s policy without rewriting counts", maximum => {
    const state = native(), snapshot = summarize(native({ dayStatus: { ...state.dayStatus, maximum } }));
    expect(snapshot).toMatchObject({ complete: true, nativeDeliveryInvalid: false,
      nativeDelivery: { minimum: 10, maximum, freshCreates: 6, deficitToMinimum: 4 } });
    expect(render(snapshot)).toContain(`Цель: 10-${maximum} в день`);
  });
  it.each([
    { minimum: 8, maximum: 15 }, { minimum: 8, maximum: 20 }, { minimum: 10, maximum: 10 },
    { minimum: 9, maximum: 10 }, { minimum: "8", maximum: 10 }, { minimum: 8, maximum: "10" },
    { minimum: 0, maximum: 10 }, { minimum: 8, maximum: 100 },
  ])("rejects unknown or mistyped policy pairs %j", policy => {
    const state = native(), snapshot = summarize(native({ dayStatus: { ...state.dayStatus, ...policy,
      deficitToMinimum: Math.max(0, Number(policy.minimum) - state.dayStatus.freshCreates) } }));
    expect(snapshot).toMatchObject({ complete: false, nativeDelivery: null, nativeDeliveryInvalid: true });
    expect(render(snapshot)).toContain("Дневная сводка планировщика не прошла проверку");
  });
  it.each([
    { freshCreates: 21 }, { freshPhotoCreates: 7 }, { acknowledgedPhotoCreates: 21 },
    { freshCreates: -1 }, { freshCreates: 6.5 }, { freshCreates: "6" },
    { legacyReceiptsWithUnknownFirstDate: 10_000_001 }, { deficitToMinimum: 4 },
  ])("keeps count and deficit validation strict for the new policy: %j", patch => {
    const state = native(), snapshot = summarize(native({ dayStatus: { ...state.dayStatus,
      minimum: 8, maximum: 10, deficitToMinimum: 2, ...patch } }));
    expect(snapshot).toMatchObject({ complete: false, nativeDelivery: null, nativeDeliveryInvalid: true });
  });
});
