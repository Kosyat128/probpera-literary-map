# S15 Booky dialogue registry boundary

Adult dialogue registry infrastructure now validates version/checksum, context, age, entity, review and rights boundaries. Twelve existing support-copy locale records remain not-reviewed and unavailable through the reviewed-dialogue resolver. 52 tests, TypeScript and the fixed-inventory audit passed. Existing runtime remains unchanged; this does not complete reviewed dialogue or child/narration scope.

Source: 35e01e02b377c3cd05cc2d6dc7c137a54f528297. All 12 records are drafts derived from existing interface copy; no literary facts, child access or human approval are inferred. The registry is deliberately unimported by the current application.

Evidence: [result.json](result.json), selected unit/static/inventory attempts, fixed source hashes and rehashed preserved PWA/Android payloads. No new build or browser execution is claimed for unchanged runtime.

Next: Continue S15 with guarded, versioned literary journey definitions using canonical public country/writer/work IDs and reviewed dialogue references. Resolve public visibility and precise entity relations before exposing a route; unknown policy, missing or unreviewed content stays unavailable. Keep production journeys draft until content and rights are genuinely reviewed. Then expand the dialogue inventory to existing navigation and contextual lines. Preserve adult progress, explicit resume/reset, offline recovery and all canonical scene ownership. Child profiles, age-adaptive full journeys, reviewed text/audio, installed-device, accessibility, iOS and release acceptance remain pending. S03.acceptance remains first unresolved.

Historical a1: 52 unit cases and the inventory passed. TypeScript failed because the new inventory test used String.replaceAll outside the configured ES2020 library; the test changed during that run and its sourceInputsUnchanged flag is false. Two test calls were corrected to regex replacement. All selected a2 checks share the final source manifest and passed. Original reports were retained.
