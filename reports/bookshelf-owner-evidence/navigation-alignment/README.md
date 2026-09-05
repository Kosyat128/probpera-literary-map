# Navigation alignment

The user screenshot showed independent column heights: the second item in one column started above its peers. The previous production build reproduced up to 23.390625px of title/description row spread at 1440px and 19.5px in the isolated 1024px panel.

The sections panel now shares natural grid tracks through two subgrid levels: category groups, then each link's title and description. The span comes from the actual maximum group length in the existing JSX element, without a fixed item count. At 1024px the two adjacent groups share rows; at 390px groups return to a single natural stack. Articles use three shared tracks per card for category, title and metadata.

The subsequent explicit font choice uses local Onest throughout the menu: titles at weight 500, descriptions at 15px/400 with 1.4 leading. Orange uppercase category labels remain at 13px/600. No copy is truncated, hidden or rewritten.

Evidence phases:
- `before/`: previous production build.
- `source/`: historical diagnostic CSS and the equivalent computed row-count property applied to the previous real DOM, before the subsequent Onest font choice. All six cases passed with 0px row spread and no overflow/clipping. These images do not represent the final font.
- `after/`: final compiled production build with Onest; no source CSS injection. All six cases passed with 0px title/description row spread, no horizontal overflow or text clipping, unchanged authored text compared with `before/`, and the final link reachable by scrolling. Local Onest faces at weights 400, 500 and 600 loaded successfully.

At 1440px each menu opens through normal navigation. The preserved Header hides desktop navigation at 1024px and 390px, so those widths use the actual menu DOM in an isolated host with only the outer placement overridden. They verify the compiled panel's responsive content, and do not claim that the dropdown is part of normal mobile navigation.

Reproduce after a production build:

```powershell
node scripts/audit-navigation-alignment.mjs after http://127.0.0.1:4185/
$env:PLAYWRIGHT_PORT='4185'
$env:PLAYWRIGHT_REUSE_SERVER='true'
npx playwright test tests/e2e/header-hero-polish.spec.mjs --project=desktop-chromium --workers=1 -g 'section mega-menu shares'
```

The focused E2E permanently checks real desktop title/description alignment, full text range bounds, local families and readable sizes.

Final validation: 6/6 browser audit cases and 1/1 desktop E2E passed. Final sections PNGs at all three widths and the desktop articles PNG were visually inspected. The browser is closed; the source and resulting build were not changed during this run.
