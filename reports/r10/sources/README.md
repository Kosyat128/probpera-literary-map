# R10 source research

Investigated 474 real candidate organisations/endpoints. 217 profiles passed a bounded HTTP fetch, the actual discovery parser and a separately fetched literary detail sample; 215 source families; 63 organisation countries. Geography reflects organisation identity, never an author's nationality or an event location. Office country remains empty for uncertain/exiled organisations.

The final production collector audit measured 212 available profiles out of 217, with 4,543 held findings and no publications. This exceeds the requested 108-profile checkpoint plus 100 working sources. Five upstream failures are recorded separately in completion-runtime-identified/runtime-verification.json. Availability is a dated observation, not a permanent guarantee. The compact completion-20261002.json separates verified profiles, current availability, source families, countries and languages.

The candidate registry is not a runtime allowlist. Only the reviewed JavaScript profiles are imported by the collector. Existing source identities remain in the registry when their latest probe fails; no public records are withdrawn by this change. RSS endpoints are discovered in real link tags, not guessed. Empty RSS/challenge pages do not count. Seasonal or old sample articles prove availability, not freshness.

Observed finds: 4418. Ready: 0; public: 0 for this source-only audit. This is not a claim about the separately prepared content batch. Individual reports contain response hashes, times, errors, extracted facts and a sample item. Full response bodies are temporary local parser inputs in .tmp and are not published.

For the complete source/country/language/category and find → ready → public map, read coverage.json. Causes of blocking remain in the candidate registry and individual reports. No 30-day yield is claimed.
