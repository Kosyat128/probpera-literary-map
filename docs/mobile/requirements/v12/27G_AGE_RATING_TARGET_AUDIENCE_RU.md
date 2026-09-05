# AGE RATING AND TARGET AUDIENCE — V12

## 1. Product positioning

Default:

“Educational literary app for a broad/family audience with a protected
child mode.”

This is not a declaration that the entire app is exclusively for children.

## 2. Whole-binary inventory

Audit adult content for:

- violence/war;
- death/execution;
- suicide/self-harm references;
- alcohol/tobacco/drugs;
- sexuality/relationships;
- illness;
- political repression;
- discrimination;
- horror/fear;
- crime;
- gambling;
- strong language;
- external web content;
- user-generated content, if ever added;
- purchases.

Record severity, frequency, context and child-mode exclusion.

## 3. Child age policy

Internal exact-age filtering is separate from store age rating.

Store rating:
- describes whole binary.

Child policy:
- determines which entity a specific child profile can access.

Do not use child filtering to conceal whole-app disclosures from stores.

## 4. Apple strategy

Before selecting Kids Category, owner/legal review:

- long-term product roadmap;
- third-party SDKs;
- external links;
- purchase gates;
- data practices;
- metadata wording;
- future ability to change category;
- age bands.

Default submission does not select it automatically.

## 5. Google Play strategy

Declare actual child-facing target ages and mixed audience honestly.
Ensure:

- Families policy applicability reviewed;
- ads absent;
- child SDK/data practices compliant;
- store and external links gated;
- content and visual design match selected ages;
- privacy statements align.

## 6. RuStore

Choose age marking based on the whole build and disclose protected child
mode. Store description must not imply unrestricted child access to adult
archive.

## 7. Age questionnaire evidence

For each answer retain:

- source screen/entity;
- content sample;
- reviewer;
- rationale;
- affected mode;
- severity/frequency;
- final store answer;
- date and store policy version.

## 8. Exact-age tests

Boundary tests:

- minAge - 1 denied;
- minAge allowed;
- maxAge allowed;
- maxAge + 1 denied where max applies;
- writer approval does not unlock adult work;
- direct ID/deep link/cache/offline denied;
- age change atomically refreshes index;
- unknown status denied.

## 9. Metadata wording

Use:

- “отдельный детский режим”;
- “родительские настройки”;
- “материалы подбираются по возрасту”.

Avoid claiming that every adult archive item is suitable for children.

## 10. Release blocker

Block submission when:

- target ages conflict with UI;
- whole-app sensitive content not inventoried;
- rating answers differ across stores without rationale;
- child mode leaks adult material;
- Kids Category selection not owner-approved;
- store screenshots show a younger audience than declarations explain;
- age filter is heuristic rather than editorial allowlist.
