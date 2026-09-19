# Existing globe edition preference

Documented parallel-safe S13 entry, preserving the first-open S03 criterion.
This slice connects the existing canonical edition choice to the application
PreferenceStore. It adds no new globe, stand, texture, child eligibility or store
product. The public site's existing local preference behavior remains scoped to
the public site.

Hydration must yield to explicit choices. Only a successfully rendered requested
edition may be persisted. A save failure keeps the actual rendered texture and
offers a localized retry. A confirmation timeout cannot cancel an already-started
native write; operation ordering and late-result fencing remain necessary.
Best-effort port acceptance is not a durable-storage or ownership guarantee.

Native migration reads the old non-secret WebView value only after both platform
keys are confirmed absent. An unavailable or malformed native edition read is
rejected rather than converted into permission to overwrite it. Old keys are
preserved; migration writes the canonical ID only after its texture has rendered.

Evidence is limited to focused controller/adapter tests, TypeScript, and actual
Chrome rendering with controlled preference ports. A native shell in Chrome
does not establish installed Android/iOS device behavior. Exact PWA and Android
artifacts are refreshed only after the implementation is committed, combining
this slice with the previously verified dossier navigation fix.

The S13 matrix requires engine17 and catalog36, recorded in entry.json as direct
dependencies beyond the coarse S11-S15 document route. Full composition
preview/apply/revert, stands, accessories, child skins, rights acceptance and
the complete Starter Set remain open.
