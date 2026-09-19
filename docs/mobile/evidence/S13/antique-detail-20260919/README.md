# Antique decoration detail follows graphics quality

The existing antique frame uses fixed geometry counts in every quality tier.
This slice makes its two ring segment budgets and shared whale body grid follow
the already-owned GlobeQualityProfile. High keeps the original counts and exact
body data. Balanced and Economy reduce vertex/index buffers without changing
canonical geography, picking, materials, transforms or the camera.
The public site's legacy economical flag retains its previous antique counts;
these additional reductions belong to explicit application quality tiers.

Only the body geometry generator moves to a small testable module. Body disposal
must be independent of the unchanged tail, fin and mouth buffers, since those
remain shared and live during quality changes. There is no claim of a previously
demonstrated leak: the new lifecycle must be correct for changing body resources.

Focused tests compare actual High geometry to a digest derived from source
8ca9f7e5, check lower-tier buffers and validate segment boundaries. One actual
Chrome scenario checks same-scene behavior, buffer changes and 30 quality
switches. This does not certify all skins, stands, compositions, GPUs or devices.

The preceding PWA 3a57411a and Android/dev 485eda7b remain exact preserved builds
from 8ca9f7e5. This later source slice will enter the next accumulated runtime
build batch; no repetitive native rebuild is required for this local geometry
checkpoint.
