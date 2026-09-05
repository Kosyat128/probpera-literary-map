# Atlas intro and controls

The embedded Atlas places its title and description above the controls. On wide
desktop screens, the five filters, largest archives button, and search share one
row. The search column grows from 220px to 240px. Filter labels use local Onest at
15px; counts and search labels retain their canonical metadata roles. At 960px
and below, search occupies its own full-width row. At 680px and below, all six
filter buttons use two equal columns with complete labels and natural row
heights. The existing control tokens provide touch targets of at least 44px.

The JSX adds one wrapper around the existing heading/search and filter owners.
IDs, refs, text, and handlers are retained. The wrapper uses `display: contents`
in immersive mode, where the existing panel layout continues to apply. The
embedded section uses `overflow: clip` to prevent the horizontal focus scroll
previously permitted by `overflow: hidden`; the immersive overflow behavior is
preserved. No globe, canvas, or data behavior is changed by this layout work.

The narrow heading scales against the intro container so that its complete glyph
range fits the content column. The audit checks clipping ancestors separately
from document scroll width: a page without horizontal overflow can still hide
part of a heading.

The final compiled production audit passed all eight cases at RU/EN 320, 390,
1440, and 1848px on `http://127.0.0.1:4185/`. All eight PNGs and
`measurements.json` are from that production build, without source injection;
`renderedFrom` is `Production build`. Full labels, heading glyph bounds, filter
and document overflow, dropdown bounds, and search/archive/filter actions passed.
Natural control heights measured 48px or 60px, depending on locale and width.
The log is `.review/atlas-final-compiled.log`.

The earlier source-injection probe also passed eight cases. Visual inspection
covered its RU390 and RU1440 views; the compiled results preserve the same
geometry. No wider visual review is claimed. Earlier four-case RU production
results used older font/search dimensions and are superseded by these compiled
measurements. The optional `--source` mode remains diagnostic: it injects the
exact current CSS and the wrapper when absent, without fabricating data.

Repeat against the separately running production preview:

```powershell
node scripts/audit-atlas-intro-layout.mjs http://127.0.0.1:4185/ --immersive
```

Without `--source`, this checks the actual compiled build in all eight cases.
The bounded audit covers six filter targets, full text, wrapping, horizontal
overflow, desktop filter/search alignment, full-width mobile search, heading
glyph bounds, search/Escape, largest-archives/Escape, and actual filter selection.
The RU1440 `--immersive` interaction smoke also passed entry, search/filter focus,
Escape focus restoration, and exit (`immersiveSmokePassed: true`). This bounded
result does not cover every immersive identity label; the separate identity-label
assertion is tracked independently from this embedded-layout audit.
