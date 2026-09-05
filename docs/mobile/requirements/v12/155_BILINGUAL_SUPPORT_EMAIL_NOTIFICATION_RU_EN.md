# BILINGUAL SUPPORT, EMAIL AND NOTIFICATION CONTRACT / ПОДДЕРЖКА RU/EN

## 1. First-release support

Provide Russian and English support intake for every public territory where
English is promised. If English support cannot meet the stated SLA, exclude
that territory rather than publish a false support claim.

## 2. Support routing

Templates and queues cover:

- installation/launch;
- globe/WebGL;
- content correction;
- child/Parent Gate;
- purchase/Restore/refund;
- account/deletion;
- privacy/data request;
- rights/takedown;
- accessibility;
- store review/moderation;
- security incident.

English and Russian tickets resolve to the same incident taxonomy. Do not
create separate disconnected support histories.

## 3. Child safety

A child is directed to a parent/guardian for support actions. Do not ask the
child for email, phone, photo, voice, precise age/date of birth or device
identifiers. Child-facing errors contain no commercial upsell.

## 4. Emails

If optional account/web entitlement emails are enabled, localize:

- verification/recovery;
- purchase/entitlement notice;
- refund/revocation;
- data deletion request/status;
- security notice;
- support acknowledgement.

Use the recipient’s explicit locale with a safe English fallback. Security
and deletion emails must not mix languages or hide the action deadline.
Store receipts remain store-controlled.

## 5. Push notifications

Push remains disabled in SAFE_PAID_BILINGUAL_V1. A future release may enable
it only after privacy, child, permission, localization and store-review gates.
Every notification must have `ru`/`en` variants and a safe deep link checked
against child policy after opening.

## 6. Operational messages

Maintenance, outage, download failure, content rollback and licence-expiry
notices require both languages before activation in an English territory.
A server outage must not fall back to an untranslated raw backend message.

## 7. Store reviewer communication

- Apple/Google: complete English response templates.
- RuStore: Russian primary response plus English internal backup.
- Preserve exact store terminology and build/version identifiers.
- No machine-only legal or rights response is sent without owner approval.

## 8. Metrics

Operational metrics may aggregate ticket language and response time, but no
child behavioral profile is created. Locale is not treated as ethnicity or
nationality.

## 9. Release blocker

Missing English support route, untranslated security/deletion message, child
personal-data request, mixed-language critical email, broken locale deep link
or unsupported SLA blocks the affected English territory/feature.
