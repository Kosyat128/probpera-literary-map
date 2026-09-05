# BILINGUAL PRODUCT LANGUAGE CONTRACT / ДВУЯЗЫЧНЫЙ ПРОДУКТОВЫЙ КОНТРАКТ

## 1. Required locales

Production locales are exactly:

```text
ru
 en
```

Architecture must remain extensible to future locales, but no third locale
is advertised or selectable until it passes the same completeness gates.

## 2. Locale model

```ts
type SupportedLocale = "ru" | "en";
type LocaleSource = "system" | "user" | "parent-profile" | "deep-link";

type LocaleState = {
  requested: SupportedLocale;
  resolved: SupportedLocale;
  source: LocaleSource;
  persistedAt: string;
  catalogVersion: string;
  contentLocaleVersion: string;
};
```

Use BCP 47 tags at platform/store boundaries:

- app content: `ru`, `en`;
- Apple metadata: `ru`, `en-US` and optional `en-GB` variant;
- Google Play: `ru-RU`, `en-US`;
- HTML: `ru`, `en`;
- never invent nonstandard tags such as `en_RU`.

## 3. Negotiation

Resolution order:

1. locked child-profile locale when parent lock is enabled;
2. explicit user app-language choice;
3. operating-system per-app language;
4. preferred system languages;
5. `ru` for Russian language;
6. `en` for every unsupported language.

Do not infer language from IP, SIM, store country or nationality.

## 4. Language switch

Switching locale must preserve:

- same WebGL/R3F Canvas;
- camera pose and semantic camera intent;
- selected globe edition, skin, stand and background;
- selected country, writer, work and tab;
- child/adult mode and exact profile;
- Parent Gate state without weakening it;
- favorites, history and journey progress;
- purchase/entitlement/download state;
- modal route when safe;
- offline state.

Transient text reload may use a bounded skeleton, never full globe remount.

## 5. Source and fallback

- Editorial source locale: Russian.
- English is a required peer release locale, not an optional fallback-only
  locale.
- Runtime unsupported-locale fallback: English.
- A missing English Base Edition translation blocks bilingual release.
- Russian remains fully available and must not be degraded by English work.
- Error pages themselves must be localized.

## 6. Language selector

Provide:

- onboarding language choice before long copy;
- Settings language control;
- Parent Center child-language setting;
- system-language option;
- accessible label and keyboard/screen-reader support;
- `Русский` and `English` self-names, not translated labels only.

No flag icon is used as a language selector: language is not nationality.

## 7. Privacy

Locale preference is local by default. If optional account sync is enabled,
locale may sync as a preference but must be documented. Do not use language
choice to infer ethnicity, nationality or sensitive characteristics.

## 8. State before first frame

Read persisted/system locale before rendering user content. The orange
splash can be language-neutral. No flash of the wrong language is allowed,
especially in saved child mode.

## 9. Locale package versions

Track separately:

- UI catalog version;
- native string version;
- literary content version;
- child content version;
- Planetka dialogue/audio version;
- store metadata version;
- legal/support version;
- search index version.

A package is activated atomically only when compatible with the app and
source-content hashes.

## 10. Done

Both languages must complete all critical paths from clean install through
offline, child mode, purchase/restore, account deletion where enabled and
owner handoff.
