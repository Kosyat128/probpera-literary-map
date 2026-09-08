var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// docs/mobile/evidence/S10/capacity-20260908/benchmark-a1/baseline-engine.ts
var baseline_engine_exports = {};
__export(baseline_engine_exports, {
  literarySearchMatchScore: () => literarySearchMatchScore,
  literarySearchMatches: () => literarySearchMatches,
  literarySearchScore: () => literarySearchScore,
  literarySearchTokens: () => literarySearchTokens,
  normalizeLiterarySearch: () => normalizeLiterarySearch
});
var searchStopWords = /* @__PURE__ */ new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "\u0430",
  "\u0431\u0435\u0437",
  "\u0432",
  "\u0434\u043B\u044F",
  "\u0438",
  "\u0438\u0437",
  "\u043A",
  "\u043D\u0430",
  "\u043E",
  "\u043E\u0431",
  "\u043E\u0442",
  "\u043F\u043E",
  "\u0441",
  "\u0441\u043E"
]);
var cyrillicToLatin = {
  \u0430: "a",
  \u0431: "b",
  \u0432: "v",
  \u0433: "g",
  \u0491: "g",
  \u0434: "d",
  \u0435: "e",
  \u0451: "e",
  \u0454: "ye",
  \u0436: "zh",
  \u0437: "z",
  \u0438: "i",
  \u0456: "i",
  \u0457: "yi",
  \u0439: "y",
  \u043A: "k",
  \u043B: "l",
  \u043C: "m",
  \u043D: "n",
  \u043E: "o",
  \u043F: "p",
  \u0440: "r",
  \u0441: "s",
  \u0442: "t",
  \u0443: "u",
  \u045E: "u",
  \u0444: "f",
  \u0445: "kh",
  \u0446: "ts",
  \u0447: "ch",
  \u0448: "sh",
  \u0449: "shch",
  \u044A: "",
  \u044B: "y",
  \u044C: "",
  \u044D: "e",
  \u044E: "yu",
  \u044F: "ya"
};
function normalizeLiterarySearch(value) {
  return value.normalize("NFKC").toLocaleLowerCase("ru").replace(/ё/gu, "\u0435").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ").trim();
}
function transliterateToken(token) {
  const transliterated = [...token].map((letter) => cyrillicToLatin[letter] ?? letter).join("").replace(/iy$/u, "y").replace(/ii$/u, "y");
  return normalizeLiterarySearch(transliterated).replace(/\s+/gu, "");
}
function stemRussianToken(token) {
  if (token.length < 5 || !/\p{Script=Cyrillic}/u.test(token)) return token;
  return token.replace(
    /(ателями|ителей|ателей|ениями|иями|ями|ами|его|ого|ему|ому|иях|ах|ях|ию|ью|ия|ья|ие|ье|ий|ый|ой|ая|яя|ое|ее|ей|ов|ев|ам|ям|ом|ем|у|ю|а|я|ы|и|е|о)$/u,
    ""
  );
}
function stemEnglishToken(token) {
  if (token.length < 5 || !/^[a-z]+$/u.test(token)) return token;
  if (token.length > 6 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 7 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 6 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 6 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}
function stemToken(token) {
  return stemEnglishToken(stemRussianToken(token));
}
function rawSearchTokens(value) {
  const tokens = normalizeLiterarySearch(value).split(" ").filter(Boolean);
  if (tokens.length <= 1) return tokens;
  return tokens.filter((token) => !searchStopWords.has(token));
}
function literarySearchTokens(value) {
  return rawSearchTokens(value).map(stemToken).filter((token) => token.length >= 2);
}
function tokenAliases(token) {
  const normalized = stemToken(token);
  const transliterated = stemToken(transliterateToken(token));
  return [.../* @__PURE__ */ new Set([normalized, transliterated])].filter(
    (candidate) => candidate.length >= 2
  );
}
function editDistanceAtMostOne(first, second) {
  if (first === second) return true;
  if (Math.abs(first.length - second.length) > 1) return false;
  const [shorter, longer] = first.length <= second.length ? [first, second] : [second, first];
  let shortIndex = 0;
  let longIndex = 0;
  let edits = 0;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (shorter.length === longer.length) shortIndex += 1;
    longIndex += 1;
  }
  return true;
}
function tokensMatch(queryToken, valueToken) {
  if (queryToken === valueToken) return true;
  if (queryToken.length >= 4 && valueToken.startsWith(queryToken)) return true;
  return queryToken.length >= 7 && valueToken.length >= 7 && editDistanceAtMostOne(queryToken, valueToken);
}
function literarySearchMatches(query, values) {
  const queryGroups = rawSearchTokens(query).map(tokenAliases).filter((aliases) => aliases.length > 0);
  const valueTokens = values.filter((value) => Boolean(value?.trim())).flatMap(rawSearchTokens).flatMap(tokenAliases);
  if (!queryGroups.length || !valueTokens.length) return false;
  return queryGroups.every(
    (aliases) => aliases.some(
      (queryToken) => valueTokens.some((valueToken) => tokensMatch(queryToken, valueToken))
    )
  );
}
function normalizedVariants(value) {
  const normalized = normalizeLiterarySearch(value);
  const transliterated = rawSearchTokens(value).map(transliterateToken).join(" ");
  return [.../* @__PURE__ */ new Set([normalized, transliterated])].filter(Boolean);
}
function literarySearchMatchScore(query, primaryValues, secondaryValues = []) {
  if (!literarySearchMatches(query, [...primaryValues, ...secondaryValues])) {
    return null;
  }
  const queryVariants = normalizedVariants(query);
  const primary = primaryValues.filter((value) => Boolean(value?.trim())).flatMap(normalizedVariants);
  const secondary = secondaryValues.filter((value) => Boolean(value?.trim())).flatMap(normalizedVariants);
  if (primary.some((value) => queryVariants.includes(value))) return 0;
  if (primary.some(
    (value) => queryVariants.some(
      (queryValue) => queryValue.length >= 3 ? value.startsWith(queryValue) : false
    )
  )) {
    return 1;
  }
  if (literarySearchMatches(query, primaryValues)) return 2;
  if (secondary.some((value) => queryVariants.includes(value))) return 3;
  if (literarySearchMatches(query, secondaryValues)) return 4;
  return 5;
}
function literarySearchScore(label, query) {
  return literarySearchMatchScore(query, [label]) ?? 6;
}

// src/utils/literarySearch.ts
var literarySearch_exports = {};
__export(literarySearch_exports, {
  compileLiterarySearchFields: () => compileLiterarySearchFields,
  compileLiterarySearchQuery: () => compileLiterarySearchQuery,
  compiledLiterarySearchMatchScore: () => compiledLiterarySearchMatchScore,
  compiledLiterarySearchMatches: () => compiledLiterarySearchMatches,
  literarySearchMatchScore: () => literarySearchMatchScore2,
  literarySearchMatches: () => literarySearchMatches2,
  literarySearchScore: () => literarySearchScore2,
  literarySearchTokens: () => literarySearchTokens2,
  normalizeLiterarySearch: () => normalizeLiterarySearch2
});
var searchStopWords2 = /* @__PURE__ */ new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "\u0430",
  "\u0431\u0435\u0437",
  "\u0432",
  "\u0434\u043B\u044F",
  "\u0438",
  "\u0438\u0437",
  "\u043A",
  "\u043D\u0430",
  "\u043E",
  "\u043E\u0431",
  "\u043E\u0442",
  "\u043F\u043E",
  "\u0441",
  "\u0441\u043E"
]);
var cyrillicToLatin2 = {
  \u0430: "a",
  \u0431: "b",
  \u0432: "v",
  \u0433: "g",
  \u0491: "g",
  \u0434: "d",
  \u0435: "e",
  \u0451: "e",
  \u0454: "ye",
  \u0436: "zh",
  \u0437: "z",
  \u0438: "i",
  \u0456: "i",
  \u0457: "yi",
  \u0439: "y",
  \u043A: "k",
  \u043B: "l",
  \u043C: "m",
  \u043D: "n",
  \u043E: "o",
  \u043F: "p",
  \u0440: "r",
  \u0441: "s",
  \u0442: "t",
  \u0443: "u",
  \u045E: "u",
  \u0444: "f",
  \u0445: "kh",
  \u0446: "ts",
  \u0447: "ch",
  \u0448: "sh",
  \u0449: "shch",
  \u044A: "",
  \u044B: "y",
  \u044C: "",
  \u044D: "e",
  \u044E: "yu",
  \u044F: "ya"
};
function normalizeLiterarySearch2(value) {
  return value.normalize("NFKC").toLocaleLowerCase("ru").replace(/ё/gu, "\u0435").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ").trim();
}
function transliterateToken2(token) {
  const transliterated = [...token].map((letter) => cyrillicToLatin2[letter] ?? letter).join("").replace(/iy$/u, "y").replace(/ii$/u, "y");
  return normalizeLiterarySearch2(transliterated).replace(/\s+/gu, "");
}
function stemRussianToken2(token) {
  if (token.length < 5 || !/\p{Script=Cyrillic}/u.test(token)) return token;
  return token.replace(
    /(ателями|ителей|ателей|ениями|иями|ями|ами|его|ого|ему|ому|иях|ах|ях|ию|ью|ия|ья|ие|ье|ий|ый|ой|ая|яя|ое|ее|ей|ов|ев|ам|ям|ом|ем|у|ю|а|я|ы|и|е|о)$/u,
    ""
  );
}
function stemEnglishToken2(token) {
  if (token.length < 5 || !/^[a-z]+$/u.test(token)) return token;
  if (token.length > 6 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 7 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 6 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 6 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}
function stemToken2(token) {
  return stemEnglishToken2(stemRussianToken2(token));
}
function tokensFromNormalizedValue(value) {
  const tokens = value.split(" ").filter(Boolean);
  if (tokens.length <= 1) return tokens;
  return tokens.filter((token) => !searchStopWords2.has(token));
}
function rawSearchTokens2(value) {
  return tokensFromNormalizedValue(normalizeLiterarySearch2(value));
}
function literarySearchTokens2(value) {
  return rawSearchTokens2(value).map(stemToken2).filter((token) => token.length >= 2);
}
function tokenAliases2(token, transliteration) {
  const normalized = stemToken2(token);
  const transliterated = stemToken2(transliteration);
  return [.../* @__PURE__ */ new Set([normalized, transliterated])].filter(
    (candidate) => candidate.length >= 2
  );
}
function editDistanceAtMostOne2(first, second) {
  if (first === second) return true;
  if (Math.abs(first.length - second.length) > 1) return false;
  const [shorter, longer] = first.length <= second.length ? [first, second] : [second, first];
  let shortIndex = 0;
  let longIndex = 0;
  let edits = 0;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (shorter.length === longer.length) shortIndex += 1;
    longIndex += 1;
  }
  return true;
}
function tokensMatch2(queryToken, valueToken) {
  if (queryToken === valueToken) return true;
  if (queryToken.length >= 4 && valueToken.startsWith(queryToken)) return true;
  return queryToken.length >= 7 && valueToken.length >= 7 && editDistanceAtMostOne2(queryToken, valueToken);
}
function compileValue(value) {
  const normalized = normalizeLiterarySearch2(value);
  const tokens = tokensFromNormalizedValue(normalized);
  const transliterations = tokens.map(transliterateToken2);
  return {
    normalized,
    tokenGroups: tokens.map((token, index) => tokenAliases2(token, transliterations[index])).filter((aliases) => aliases.length > 0),
    normalizedVariants: [.../* @__PURE__ */ new Set([normalized, transliterations.join(" ")])].filter(Boolean)
  };
}
function compileLiterarySearchQuery(query) {
  const compiled = compileValue(query);
  return {
    normalizedQuery: compiled.normalized,
    tokenGroups: compiled.tokenGroups,
    normalizedVariants: compiled.normalizedVariants
  };
}
function compileLiterarySearchFields(values) {
  const aliases = /* @__PURE__ */ new Set();
  const variants = /* @__PURE__ */ new Set();
  for (const value of values) {
    if (!value?.trim()) continue;
    const compiled = compileValue(value);
    for (const group of compiled.tokenGroups) for (const alias of group) aliases.add(alias);
    for (const variant of compiled.normalizedVariants) variants.add(variant);
  }
  return { tokenAliases: [...aliases], normalizedVariants: [...variants] };
}
function compiledLiterarySearchMatches(query, primary, secondary) {
  if (!query.tokenGroups.length) return false;
  return query.tokenGroups.every(
    (aliases) => aliases.some(
      (queryToken) => primary.tokenAliases.some((valueToken) => tokensMatch2(queryToken, valueToken)) || secondary?.tokenAliases.some((valueToken) => tokensMatch2(queryToken, valueToken))
    )
  );
}
function compiledLiterarySearchMatchScore(query, primary, secondary) {
  if (!compiledLiterarySearchMatches(query, primary, secondary)) {
    return null;
  }
  const queryVariants = query.normalizedVariants;
  if (primary.normalizedVariants.some((value) => queryVariants.includes(value))) return 0;
  if (primary.normalizedVariants.some(
    (value) => queryVariants.some(
      (queryValue) => queryValue.length >= 3 ? value.startsWith(queryValue) : false
    )
  )) {
    return 1;
  }
  if (compiledLiterarySearchMatches(query, primary)) return 2;
  if (secondary?.normalizedVariants.some((value) => queryVariants.includes(value))) return 3;
  if (secondary && compiledLiterarySearchMatches(query, secondary)) return 4;
  return 5;
}
function literarySearchMatches2(query, values) {
  return compiledLiterarySearchMatches(
    compileLiterarySearchQuery(query),
    compileLiterarySearchFields(values)
  );
}
function literarySearchMatchScore2(query, primaryValues, secondaryValues = []) {
  return compiledLiterarySearchMatchScore(
    compileLiterarySearchQuery(query),
    compileLiterarySearchFields(primaryValues),
    compileLiterarySearchFields(secondaryValues)
  );
}
function literarySearchScore2(label, query) {
  return literarySearchMatchScore2(query, [label]) ?? 6;
}

// literary-search-capacity-entry.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import os from "node:os";
var measure = function measureSearchCapacity(baseline, current) {
  const round = (value) => Math.round(value * 1e3) / 1e3;
  const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const documents = Array.from({ length: 1e4 }, (_, index) => {
    const number = String(index).padStart(5, "0");
    const titles = [`\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u0442\u043E\u043C ${number}`, `Benchmark volume ${number}`, `\u8A66\u9A13\u306E\u672C ${number}`];
    const primary = titles;
    const secondary = [
      index % 2 ? "\u0410\u0432\u0442\u043E\u0440 \u0421\u0435\u0432\u0435\u0440\u043D\u044B\u0439" : "Writer North",
      "\u0422\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0430",
      "Test country",
      ["\u0440\u043E\u043C\u0430\u043D", "poetry", "\u0438\u0441\u0442\u043E\u0440\u0438\u044F", "children"][index % 4],
      `Synthetic capacity record ${number}. This description is test data only and has no editorial status.`,
      `\u0421\u0438\u043D\u0442\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C ${number} \u0434\u043B\u044F \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438. \u042D\u0442\u043E \u043D\u0435 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435 \u0438 \u043D\u0435 \u0431\u0438\u043E\u0433\u0440\u0430\u0444\u0438\u044F.`
    ];
    return {
      key: `capacity-fixture:${number}`,
      label: titles[index % 2],
      primary,
      secondary,
      joined: baseline.normalizeLiterarySearch([...primary, ...secondary].join(" "))
    };
  });
  const queries = [
    "\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u0442\u043E\u043C 00042",
    "Benchmark volume 03173",
    "volume",
    "\u0421\u0435\u0432\u0435\u0440\u043D\u044B\u0439",
    "Severnyy",
    "\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u0421\u0435\u0432\u0435\u0440\u043D\u044B\u0439",
    "03173 poetry",
    "\u8A66\u9A13\u306E\u672C 00042",
    "synthetix",
    "biography",
    "in",
    "no-such-zqxv",
    '"\u0422\u041E\u041C"',
    "\u0430"
  ];
  const collator = new Intl.Collator("en");
  const rank = (values) => values.sort((a, b) => a.score - b.score || collator.compare(a.key, b.key));
  function legacySearch(query, mode, source) {
    const normalized = baseline.normalizeLiterarySearch(query);
    const matches = [];
    for (const document of source) {
      const score = mode === "atlas" ? baseline.literarySearchMatches(normalized, [document.joined]) ? baseline.literarySearchScore(document.label, normalized) : null : baseline.literarySearchMatchScore(normalized, document.primary, document.secondary);
      if (score !== null) matches.push({ key: document.key, score });
    }
    return rank(matches);
  }
  function preparedSearch(query, mode, source) {
    const prepared = current.compileLiterarySearchQuery(query);
    const matches = [];
    for (const document of source) {
      const score = mode === "atlas" ? current.compiledLiterarySearchMatches(prepared, document.fields) ? current.compiledLiterarySearchMatchScore(prepared, document.labelFields) ?? 6 : null : current.compiledLiterarySearchMatchScore(prepared, document.primaryFields, document.secondaryFields);
      if (score !== null) matches.push({ key: document.key, score });
    }
    return rank(matches);
  }
  const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)];
  const modes = [];
  for (const mode of ["atlas", "shared-fields"]) {
    globalThis.gc();
    const heapBefore = process.memoryUsage().heapUsed, started = performance.now();
    const prepared = documents.map((document) => mode === "atlas" ? { key: document.key, fields: current.compileLiterarySearchFields([document.joined]), labelFields: current.compileLiterarySearchFields([document.label]) } : { key: document.key, primaryFields: current.compileLiterarySearchFields(document.primary), secondaryFields: current.compileLiterarySearchFields(document.secondary) });
    const preparationMs = performance.now() - started;
    globalThis.gc();
    const retainedHeapDeltaBytes = process.memoryUsage().heapUsed - heapBefore;
    for (const query of queries) {
      legacySearch(query, mode, documents.slice(0, 64));
      preparedSearch(query, mode, prepared.slice(0, 64));
    }
    const measurements = queries.map((query) => ({ query, baselineMs: [], compiledMs: [], matches: null, digest: null }));
    for (let repeat = 0; repeat < 2; repeat += 1) {
      for (const [queryIndex, measurement] of measurements.entries()) {
        const order = (queryIndex + repeat) % 2 ? ["compiled", "baseline"] : ["baseline", "compiled"];
        const results = {};
        for (const engine of order) {
          const start = performance.now();
          const matches = engine === "baseline" ? legacySearch(measurement.query, mode, documents) : preparedSearch(measurement.query, mode, prepared);
          const elapsed = performance.now() - start;
          measurement[`${engine}Ms`].push(round(elapsed));
          results[engine] = { count: matches.length, digest: digest(matches) };
        }
        assert.deepEqual(results.compiled, results.baseline, `${mode}: ${measurement.query}`);
        measurement.matches = results.compiled.count;
        measurement.digest = results.compiled.digest;
      }
    }
    const baselineTimes = measurements.flatMap((value) => value.baselineMs);
    const compiledTimes = measurements.flatMap((value) => value.compiledMs);
    modes.push({
      mode,
      preparationMs: round(preparationMs),
      retainedHeapDeltaBytes,
      measurements,
      baseline: { medianMs: round(percentile(baselineTimes, 0.5)), p95Ms: round(percentile(baselineTimes, 0.95)), maxMs: Math.max(...baselineTimes) },
      compiled: { medianMs: round(percentile(compiledTimes, 0.5)), p95Ms: round(percentile(compiledTimes, 0.95)), maxMs: Math.max(...compiledTimes) },
      medianSpeedup: round(percentile(baselineTimes, 0.5) / percentile(compiledTimes, 0.5)),
      allRankedKeyAndScoreDigestsEqual: true
    });
  }
  return {
    schemaVersion: 1,
    recordedAt: (/* @__PURE__ */ new Date()).toISOString(),
    pass: true,
    fixture: "DETERMINISTIC_SYNTHETIC_NOT_PRODUCTION_CATALOG",
    count: documents.length,
    corpusSha256: digest(documents),
    queryCount: queries.length,
    repeats: 2,
    environment: { node: process.version, platform: process.platform, architecture: process.arch, cpu: os.cpus()[0]?.model, cpuCount: os.cpus().length },
    modes,
    limits: [
      "Node desktop engine measurement; not installed-device or browser main-thread latency certification.",
      "Shared-fields mode measures matching/scoring, not full global suggestion grouping, article loading or publication checks.",
      "Preparation is synchronous and memory is an approximate retained V8 heap delta after GC; cold startup/chunk scheduling require separate measurement.",
      "Mixed-query percentiles describe these 28 samples per mode; no production SLA is inferred.",
      "No synthetic record has publication, translation, title evidence or rights approval."
    ],
    stageAccepted: false,
    releaseReady: false
  };
};
console.log(JSON.stringify(measure(baseline_engine_exports, literarySearch_exports)));
