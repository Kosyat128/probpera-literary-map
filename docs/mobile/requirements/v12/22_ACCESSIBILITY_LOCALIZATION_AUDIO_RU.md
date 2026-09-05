# ACCESSIBILITY, LOCALIZATION, TYPOGRAPHY, AUDIO AND SENSORY COMFORT — V12

## 1. Accessibility goal

Основная литературная информация и управление должны быть доступны без
обязательного использования точных 3D-жестов, зрения, слуха или анимации.
Ориентир — WCAG 2.2 AA для web/PWA и соответствующие нативные паттерны
VoiceOver/TalkBack/Dynamic Type.

## 2. 3D alternative

Создать полностью доступный альтернативный путь:

- список/поиск стран;
- список писателей;
- список произведений;
- выбор страны/писателя;
- кнопка «Показать на планете»;
- текстовое описание текущего globe state;
- controls zoom/rotate/reset с accessible names;
- live region только для значимых изменений.

Декоративные звёзды, животные, части Планетки и particles не засоряют
accessibility tree.

## 3. Controls and focus

- minimum touch target 44x44 CSS pt/dp;
- predictable focus order;
- visible focus ring;
- no colour-only state;
- focus trap only in modal;
- focus return after close;
- escape/back semantics;
- pressed/selected/loading/disabled exposed semantically;
- large text does not hide critical action;
- system contrast/forced colours support where applicable.

## 4. Motion and sensory

Respect system reduced motion and allow parent/adult override:

- no parallax/particles/auto rotation when reduced;
- camera flights shortened or instant;
- mascot uses static poses/fades;
- no flashing/strobing;
- no essential information conveyed by motion;
- sensory quiet mode disables ambience/haptics and reduces visual density;
- child mode defaults to calm, not hyperactive animation.

## 5. Localization

At release:

- complete Russian UI;
- English UI architecture and only reviewed content;
- no mixed language;
- no raw machine/AI translation in production;
- plural/date/number/currency formatting by locale;
- long-string/pseudolocalization tests;
- RTL architecture not required for v1 but no unnecessary blockers;
- locale fallback explicit and visible to editorial workflow.

Every string comes from typed catalog, including native errors, purchase
states, Parent Gate, offline/update and store metadata source files.

## 6. Typography

- reuse licensed/self-hosted project fonts;
- fallback stack documented;
- readable line length/line height;
- Dynamic Type/font scale;
- names/titles wrap without clipping;
- no functional text baked into images;
- clear hierarchy for reading biography;
- child reading levels affect language, not tiny font or hidden detail.

## 7. Audio and narration

Audio pipeline records:

- asset ID;
- source/creator/license;
- locale/voice;
- transcript/caption;
- age policy;
- volume/loudness target;
- checksum/version;
- allowed platforms/territories;
- expiry.

Rules:

- no actor/celebrity/character voice cloning;
- no Disney music/voice without explicit rights;
- no mandatory microphone;
- no autoplay after resume;
- narration optional;
- captions always available;
- audio focus/interruptions/headphones/Bluetooth tested;
- app respects silent mode/platform conventions;
- ambience separately controllable;
- child parent controls override profile.

## 8. Haptics

- subtle and optional;
- never sole feedback;
- disabled in reduced sensory mode;
- no continuous vibration;
- lifecycle-safe;
- platform conventions respected.

## 9. Accessibility QA

Test matrix:

- VoiceOver iPhone/iPad;
- TalkBack Android;
- keyboard/switch-style navigation for PWA;
- 200%/largest text;
- landscape/tablet;
- reduced motion;
- high contrast/forced colours;
- screen magnification;
- no-audio;
- no-haptic;
- colour blindness checks;
- child and Parent Gate flows;
- store/purchase/restore/errors;
- accessible alternative to globe.

Release blocker: any P0/P1 accessibility issue on core flows.

## V12 bilingual mandatory overlay

Russian and English are both complete production locales. Implement the
requirements in 119–126 and 151–155. Accessibility labels, announcements,
transcripts, captions, error text and native/system-facing text must be
complete in both languages. A language switch must preserve the same globe,
route, country, writer, child profile and purchase state. No critical
accessibility meaning may be clipped after English text expansion.
