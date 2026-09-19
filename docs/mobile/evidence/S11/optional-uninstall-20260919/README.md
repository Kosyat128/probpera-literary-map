# S11 optional-package removal

Source `46df306b76f0e90163a26bb08c840b83123f1924` implements explicit RU/EN removal
of saved packages that the trusted app catalog marks optional. Missing policy
means required. Confirmation is bound to the displayed selection, so another
tab cannot replace the selected package and have its new version silently removed.

Retirement is atomic and retains a version floor plus an incremented operation
epoch. Old writes cannot resurrect removed content. Current/previous package
bytes and incomplete generations are collected afterward; mandatory bootstrap
and unrelated namespaces stay protected. A failed cleanup remains retryable.
Exact readback distinguishes a lost write response from failed retirement.

167 focused unit cases and four actual Chrome scenarios pass. Browser evidence
covers two tabs, offline removal, restart, explicit signed HTTP reinstallation,
RU/EN, focus, Axe and narrow-screen overflow. Two screenshots were inspected.
Android Java compilation passes; native execution and iOS compilation remain open.
The initial TypeScript narrowing failure is retained; non-null annotations emit
identical JavaScript and the final typecheck passes, without repeating green suites.

A fresh explicit reinstall from another native JS host may need retry if it
overlaps cleanup. Complete native candidate validation prevents incomplete data
from becoming selected. This source evidence is not native-device validation.

Existing PWA `d1e90c35` and Android `b2f77958` remain preserved and predate this
slice. The next shared-reader repair is already in progress; refresh artifacts
together afterward. No stage acceptance, production activation or release is
inferred. See `result.json` for machine-readable records and exact source hashes.
