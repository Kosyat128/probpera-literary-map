# S15 companion mobile placement

Source: 3dd6d478164f4f23187844fe0c033267230b0951.

Automatic companion placement avoids adding obstruction to the observed globe controls at 320 px portrait in RU and EN and at 800 x 400 landscape in EN, with collection controls checked in EN. A short landscape row retains the existing 88 px avatar and 44 px touch buttons. Deliberate drag, Home reset, immediate walking interruption and resize behavior are preserved. Existing host-only overlaps remain separately recorded. Fresh 141 focused unit cases, TypeScript and 8 actual-App browser cases pass with 16 inspected screenshots; PWA f53b86b2 and Android-dev 6d86207b are freshly rebuilt and byte-audited. 1644 source inputs remain exact. This is a bounded layout/interaction fix, not full accessibility, installed-device, art or stage acceptance.

- At 800 x 400 the existing country strip independently covers some globe toolbar controls even when the companion is hidden. This change removes additional companion obstruction; ordinary page text can still lie behind the optional floating character.
- Fresh browser evidence is restricted to the configured companion and policy fixtures; the older complete 37-case report remains attributed to source 10beb1315ea29184fced208ee26049db093e4823.
- Native OS/preference ports are controlled browser test ports. No installed device or iOS compilation was used.
- Source geometry and animation are unchanged; prior actual-model portraits remain original-source renders, not fresh screenshots of this layout fix.
- Production journey and migration inventories remain empty; all 34 dialogue drafts remain unapproved.
- All requirement and stage statuses remain unchanged; no release or production action is performed.
