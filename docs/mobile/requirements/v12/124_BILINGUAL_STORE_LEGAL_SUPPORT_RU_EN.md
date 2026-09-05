# BILINGUAL STORE, LEGAL AND SUPPORT / МАГАЗИНЫ, ПРАВО И ПОДДЕРЖКА

## 1. Store locale strategy

For a new global app record, recommended defaults are:

```text
Apple primary metadata: English (U.S.)
Apple additional localization: Russian
Google Play default listing: English (United States)
Google Play translation: Russian
RuStore storefront: Russian
Application binary: Russian + English
Web/PWA: Russian + English
```

If an existing app record has another primary language, preserve it until a
store-safe migration plan is approved. Apple primary-language changes have
review and screenshot prerequisites.

## 2. Localized product identity

Russian:

- `Литературная планета`;
- `Проба пера`.

English:

- `Literary Planet`;
- `Proba Pera`.

Store name and subtitle remain within current limits and are checked on the
submission date.

## 3. Metadata

Generate independent, human-quality:

- name/subtitle;
- promotional/short text;
- full description;
- keywords/tags;
- “What’s New”;
- IAP names/descriptions;
- FAQ where supported;
- reviewer notes;
- screenshots/captions;
- support text.

Do not publish Google’s automated translation or an English machine draft
without the V12 quality workflow. Custom Google Play listings do not inherit
automatic translations reliably; create explicit localized content.

## 4. Screenshots

Capture exact RC in both languages. Same feature story, but text and data
must genuinely be rendered in the target locale. Do not paste English
captions over a Russian UI and call it localized.

## 5. Legal documents

Provide Russian and English versions of:

- Privacy Policy;
- Terms/User Agreement;
- paid-sale conditions;
- refund information;
- account deletion;
- child privacy notice;
- support/contact information;
- rights/attribution notice.

Define:

- effective date;
- version;
- applicable product/platform;
- controlling language;
- change log;
- accessible public URLs;
- synchronized update process.

The controlling language is selected by the owner/legal reviewer. English
cannot be a disclaimer-free marketing rewrite of stricter Russian terms.

## 6. Support

At first bilingual public release:

- Russian and English support intake;
- bilingual automatic acknowledgement;
- response templates;
- category routing;
- no child personal data in tickets;
- reviewer/store escalation in English;
- RuStore response available in Russian;
- stated response SLA that can actually be met.

If live English support is not ready for a territory, exclude the territory
rather than promise unsupported service.

## 7. Prices

Show store-supplied localized price. Store copy must distinguish Base
Edition from optional purchase in both languages. Do not translate or
convert a price manually inside the native client.

## 8. Review dossiers

Apple and Google reviewer notes are complete English. RuStore gets Russian
plus an English backup. Every path, button name and expected result is
written exactly as displayed in that locale.

## 9. Web discovery

Localized web pages use unique locale URLs, correct canonical/hreflang,
localized structured data and language-consistent Open Graph text. Do not
serve English metadata with Russian body content.

## 10. Release blocker

- English listing but Russian-only binary;
- English screenshot caption over Russian UI;
- missing English privacy/support;
- auto-translated product claim not verified;
- inconsistent paid/IAP statement;
- English title exceeds limit;
- unavailable feature in one locale;
- locale-specific rights missing;
- reviewer instructions refer to wrong language labels.
