# Stage 5 approved BookShelf reference

This directory stores the owner-approved Stage 5 BookShelf composition reference
as a byte-for-byte repository artifact.

## Integrity pin

| Property | Value |
| --- | --- |
| File | [`STAGE_5_BOOKSHELF_CONCEPT_APPROVED.png`](STAGE_5_BOOKSHELF_CONCEPT_APPROVED.png) |
| SHA-256 | `46727D471384D42919F872D53A15C6047E6023EE02414C1300252E02A5DAD0DF` |
| Byte size | `2159063` |
| Provenance | Owner-provided local Stage 5 handoff |
| Transfer | Binary copy; no transcoding, optimization, metadata rewrite, or resize |

PowerShell integrity check:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath `
  'docs/stage5-reference/STAGE_5_BOOKSHELF_CONCEPT_APPROVED.png'
```

POSIX integrity check:

```bash
sha256sum docs/stage5-reference/STAGE_5_BOOKSHELF_CONCEPT_APPROVED.png
```

## How to use the reference

The image is the primary visual reference for the Shelf composition. It locks the
single dark library frame, integrated top search/filters, book-dominant central
scene, right detail panel, thin bottom controls, orange interaction accent, and
modern stocked library depth behind the active shelf.

Behavior, accessibility, data ownership, rejected variants, and the exact
measured-versus-pending review policy are defined in
[`../BOOKSHELF_REFERENCE_FIDELITY_STAGE5.md`](../BOOKSHELF_REFERENCE_FIDELITY_STAGE5.md).
The image is not source code and does not authorize copying code, HTML, covers,
audio, or embedded assets from any external reference.

Do not replace or re-encode this file during formatting or asset optimization.
A replacement requires a new explicit owner approval, a new hash/size pin, and a
reviewed update to both fidelity documents. A hash mismatch is a hard fidelity
failure.
