# Dossier navigation while physical pages are pending

The accessible dossier reader is available before asynchronous font measurement
and physical pagination complete. Explicit semantic navigation must survive a
late result and must remain usable when physical layout is unavailable.

This slice preserves canonical book, version, locale and reading-mode boundaries.
Saving a dossier position follows the existing saved-book policy; it does not
silently add a book to favorites or publish private reading data.

Focused source/browser evidence will distinguish controlled layout scheduling
from real device and release acceptance. PWA `5403f982` and Android/dev `8d8cb1ec`
remain the preserved runtime artifacts until the next runtime build batch.
