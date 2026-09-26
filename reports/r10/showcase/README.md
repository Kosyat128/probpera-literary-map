# R10 header showcase evidence

Status: implemented and locally verified; release review pending. No deployment or human acceptance is claimed.

The existing 1+6 arrangement, fonts and brand palette remain. The scoped delta fixes click-open dismissal, selection/pins, loading/errors, full media containment, readable short-screen typography and one accessible overflow area.

Current reference: receipt.json (variant/fingerprint/commands/limitations), runtime.json (eight runtime sessions), media-pins.json, error-retry.json. Fresh before and after PNGs were opened and inspected by the agent. The before capture found the former mouseleave close and18px short-screen lead. All author titles/descriptions and source media are unchanged.

Current public catalog:167 records in the checked-out snapshot, not a claim about the live website. Published English translations are filtered before selection.

Pins are configured within the existing homepage editor under the featured journal section. Native article and UTC period fields serialize ID/order/timezone only; shared selection drives the preview and public header. Existing expected_updated_at protection guards publication. Authenticated database save/conflict testing awaits release access.

Next: Run repository release checks and authenticated admin pin save/version conflict review; preserve this variant and repeat only affected runtime sessions. Native bfcache/physical-device/live evidence remains separate from local acceptance.

Image refinement (2026-09-26): image-contain-before.json and image-contain-after.json document the actual source, currentSrc, intrinsic proportions and Chrome geometry. The forced 16:9 frame and short-screen image width were removed; authored assets and text remain unchanged. On1280x600 the complete full-width image uses the existing panel scroll (131px), with all links and footer reachable. Earlier zero-scroll geometry is superseded by this user-requested result.

Final image CSS freeze: all eight groups in scripts/r10-showcase-runtime.mjs were rerun successfully against the current CSS. Short-screen checks now verify permitted panel scrolling and footer access. CSS-policy checks passed for real1280x600 and long RU/EN copy; typography audit34files/0issues. Missing-image fallback geometry remains unchanged.

Delivered CSS runtime checker: node scripts/r10-showcase-css-policy.mjs. Its bytes are identical to the successfully executed temporary copy; the script uses repository-relative report paths and bare package imports.
