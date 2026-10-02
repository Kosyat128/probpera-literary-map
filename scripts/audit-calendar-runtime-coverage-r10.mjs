import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const target = ".tmp/calendar-runtime-coverage-r10/runtime.mjs";
await mkdir(".tmp/calendar-runtime-coverage-r10", { recursive: true });
await build({
  stdin: { contents: `export { countries } from './src/data/countries';
export { selectCalendarEvents, calendarEventsForMonth, calendarEventsForYear, calendarWriterIdentity } from './src/components/LiteraryCalendar';`, resolveDir: process.cwd() },
  bundle: true, platform: "node", packages: "external", format: "esm", target: "node22", outfile: target, logLevel: "silent",
});
const rt = await import(`${pathToFileURL(`${process.cwd()}/${target}`).href}?t=${Date.now()}`);
const app = await readFile("src/App.tsx", "utf8");
assert.match(app, /import\("\.\/data\/countries"\)/u);
assert.match(app, /setCountryArchive\(module\.countries\)/u);
assert.match(app, /<LiteraryCalendar\s+countries=\{countryArchive\}/u);

const events = rt.selectCalendarEvents(rt.countries, "ru");
const identity = event => `${rt.calendarWriterIdentity(event.writer, event.country.id)}:${event.kind}`;
assert.equal(new Set(events.map(identity)).size, events.length);
assert.deepEqual(rt.selectCalendarEvents(rt.countries, "en").map(identity).sort(), events.map(identity).sort());
for (const event of events) {
  assert.ok(rt.countries.find(country => country.id === event.country.id)?.writers.some(writer => writer.id === event.writer.id),
    `Calendar event has no public writer card: ${identity(event)}`);
}
const counts = year => Array.from({ length: 12 }, (_, month) => ({
  month: month + 1, events: rt.calendarEventsForMonth(events, year, month).length,
}));
const february29 = events.filter(event => event.month === 1 && event.day === 29).map(event => ({
  identity: identity(event), writerKey: `${event.country.id}:${event.writer.id}`,
  name: event.title, date: event.writer[event.kind === "birth" ? "birthDate" : "deathDate"],
}));
const annual = { uniqueEvents: events.length, birthdays: events.filter(event => event.kind === "birth").length,
  memorials: events.filter(event => event.kind === "memory").length };
assert.deepEqual(annual, { uniqueEvents: 2340, birthdays: 1287, memorials: 1053 });
assert.equal(rt.calendarEventsForYear(events, 2026).length, 2338);
assert.equal(rt.calendarEventsForYear(events, 2028).length, 2340);
assert.equal(counts(2026)[9].events, 190);
assert.equal(february29.length, 2);
assert.deepEqual(february29.map(event => event.writerKey).sort(), ["montenegro:stefan_ljubisa", "usa:tim_powers"]);

const report = {
  version: 1, checkedAt: new Date().toISOString(), environment: "checked-in public corpus and actual App calendar input",
  countries: rt.countries.length, writerRecords: rt.countries.reduce((sum, country) => sum + country.writers.length, 0),
  annual,
  display2026: { visibleEvents: rt.calendarEventsForYear(events, 2026).length, months: counts(2026) },
  display2028: { visibleEvents: rt.calendarEventsForYear(events, 2028).length, months: counts(2028) },
  february29,
  observed190: { scope: "October 2026", cause: "month summary label omitted its scope; no runtime event cap" },
  ui: { monthlyScopeExplicit: true, annualCountDerivedFromActualEvents: true, directMonthNavigation: 12,
    yearSearch: "writer, country or DD.MM", yearPageSize: 20, yearNavigation: true },
  checks: { publicWriterCardForEveryEvent: true, uniqueAnnualIdentities: true, ruEnIdentityParity: true,
    fullPublicCountryArchivePassedByApp: true, nonLeapYearDoesNotShiftFebruary29: true },
  additional1000: { baselineAnnualEvents: 2237, netGrowth: events.length - 2237, requiredGrowth: 1000, complete: false },
  deployment: false, productionAcceptance: false,
};
if (process.argv.includes("--write")) {
  await writeFile("reports/r10/calendar/runtime-coverage-20261002.json", `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report));
