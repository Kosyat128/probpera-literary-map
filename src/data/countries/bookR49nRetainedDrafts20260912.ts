import type { WorkProfile, WorkTranslationProfile } from "./types";
import { bookR49nRetainedDrafts20260912Data01 } from "./bookR49nRetainedDrafts20260912Data01";
import { bookR49nRetainedDrafts20260912Data02 } from "./bookR49nRetainedDrafts20260912Data02";
import { bookR49nRetainedDrafts20260912Data03 } from "./bookR49nRetainedDrafts20260912Data03";

// Exact R49N current synopses. Display permission is not editorial verification.
// Historical provenance and exact hashes: reports/book-r49n-retained-drafts-20260912.json.
export const bookR49nRetainedDraftsProtectedReviewedKeys = [
  "austria:franz_kafka:openlibrary-works-ol498556w",
  "canada:margaret_atwood:openlibrary-works-ol675783w",
  "canada:yann_martel:life-of-pi",
  "england:aldous_huxley:brave-new-world-editorial",
  "england:charles_dickens:a-tale-of-two-cities",
  "england:charles_dickens:article-series-1tdjfsi",
  "england:charles_dickens:david-copperfield-editorial",
  "england:charles_dickens:great-expectations",
  "england:charles_dickens:oliver-twist-editorial",
  "england:charles_dickens:openlibrary-works-ol13114895w",
  "england:charles_dickens:openlibrary-works-ol14868510w",
  "england:charles_dickens:openlibrary-works-ol14869167w",
  "england:charles_dickens:openlibrary-works-ol32466w",
  "england:charles_dickens:openlibrary-works-ol8193387w",
  "england:charles_dickens:openlibrary-works-ol8300174w",
  "england:david_mitchell:ghostwritten",
  "england:david_mitchell:number9dream",
  "england:david_mitchell:slade-house",
  "england:david_mitchell:the-bone-clocks",
  "england:david_mitchell:the-thousand-autumns-of-jacob-de-zoet",
  "england:george_orwell:animal-farm-editorial",
  "england:george_orwell:nineteen-eighty-four",
  "england:h_g_wells:ann-veronica",
  "england:h_g_wells:men-like-gods",
  "england:h_g_wells:the-first-men-in-the-moon",
  "england:h_g_wells:the-food-of-the-gods",
  "england:h_g_wells:the-history-of-mr-polly",
  "england:h_g_wells:the-world-set-free",
  "england:h_g_wells:when-the-sleeper-wakes",
  "england:j_r_r_tolkien:openlibrary-works-ol27448w",
  "england:j_r_r_tolkien:the-hobbit",
  "england:jane_austen:pride-and-prejudice",
  "england:john_galsworthy:the-forsyte-saga",
  "england:william_shakespeare:hamlet",
  "france:flaubert:madame-bovary",
  "france:jules_verne:openlibrary-works-ol1099280w",
  "france:jules_verne:openlibrary-works-ol1099364w",
  "france:jules_verne:openlibrary-works-ol1099479w",
  "france:jules_verne:openlibrary-works-ol1099513w",
  "france:jules_verne:openlibrary-works-ol1099630w",
  "france:jules_verne:openlibrary-works-ol1100007w",
  "france:jules_verne:the-mysterious-island-editorial",
  "france:saint_exupery:openlibrary-works-ol10263w",
  "france:victor_hugo:les-miserables",
  "germany:thomas_mann:buddenbrooks-editorial",
  "norway:knut_hamsun:growth-of-the-soil",
  "poland:wladyslaw_reymont:the-peasants",
  "russia:buninin:the-village",
  "russia:chekhov:the-black-monk",
  "russia:chekhov:the-duel",
  "russia:chekhov:the-lady-with-the-dog",
  "russia:chekhov:the-man-in-a-case",
  "russia:chekhov:uncle-vanya",
  "russia:dostoevsky:crime-and-punishment",
  "russia:tolstoy:article-series-zqpjjm",
  "russia:tolstoy:war-and-peace",
  "russia:turgenev:article-series-men9bv",
  "spain:miguel_de_cervantes:openlibrary-works-ol15272537w",
  "usa:ernest_hemingway:the-old-man-and-the-sea",
  "usa:francis_scott_fitzgerald:the-great-gatsby",
  "usa:harper_lee:to-kill-a-mockingbird-editorial",
  "usa:harriet_beecher_stowe:uncle-toms-cabin",
  "usa:herman_melville:moby-dick",
  "usa:jack_london:article-catalog-1hfivd6",
  "usa:jack_london:article-catalog-2s2iy7",
  "usa:jerome_david_salinger:the-catcher-in-the-rye-editorial",
  "usa:ray_bradbury:fahrenheit-451-editorial",
  "usa:suzanne_collins:the-hunger-games",
  "usa:vladimir_nabokov:lolita-editorial"
] as const;
const reviewedKeys = new Set<string>(bookR49nRetainedDraftsProtectedReviewedKeys);
type RetainedDraftText = { text: string; sourceUrls: string[] };
type RetainedTranslation = WorkTranslationProfile & { retainedCatalogSource: "R49N-20260912" };
const retainedDrafts: Record<string, Record<"ru" | "en", RetainedDraftText>> = {
  ...bookR49nRetainedDrafts20260912Data01,
  ...bookR49nRetainedDrafts20260912Data02,
  ...bookR49nRetainedDrafts20260912Data03,
};

export const bookR49nRetainedDraftRecordKeys = Object.keys(retainedDrafts);

function draftTranslation(work: WorkProfile, locale: "ru" | "en", retained: RetainedDraftText): RetainedTranslation {
  const previous = work.translations?.[locale];
  // A previous synopsis review cannot be transferred to a different exact text.
  const { descriptionProvenance: _previousProvenance, reviewedAt: _previousReview, ...translation } = previous || {};
  return {
    ...translation,
    locale,
    title: previous?.title || work.localizedTitles?.[locale]?.value
      || (locale === "en" ? work.originalTitle : undefined) || work.title,
    description: retained.text,
    sourceLanguage: locale,
    status: "draft",
    sourceUrls: [...retained.sourceUrls],
    method: "editorial-original",
    retainedCatalogSource: "R49N-20260912",
  };
}

export function applyBookR49nRetainedDrafts20260912Work(countryId: string, writerId: string, work: WorkProfile): WorkProfile {
  const key = [countryId, writerId, work.id].join(":");
  if (reviewedKeys.has(key)) return work;
  const retained = retainedDrafts[key];
  if (!retained) return work;
  return {
    ...work,
    description: retained.ru.text,
    translations: {
      ...work.translations,
      ru: draftTranslation(work, "ru", retained.ru),
      en: draftTranslation(work, "en", retained.en),
    },
    editorial: { status: "draft" },
  };
}
