# Attempt ledger

- art-a1: library draft; root inspected all3 images. Rejected as final visual
  quality: flat windows, uniform leather and repeated grain. No technical runs.
- art-a2: library and shared material draft; root inspected all7 images.
  Better bindings/depth, but wood cap UV swirled; books lacked support contact
  and had uniformly bulging spines. Stand UV and book geometry were corrected.
- art-a3: final source inspection:11 views, including reduced tiers and all
  three stands. Exact hashes are in its D-volume result. The result improves
  this slice but is not maximum realism/art acceptance; remaining gaps are
  recorded in the final visual review rather than hidden by green tests.
- unit-a1:14 passed. static-a1 failed only on the declared ArrayBufferView type
  in the new alpha-map test. Root narrowed already-asserted Uint8Array data;
  no runtime bytes changed. unit-a2:14 passed; static-a2 passed. Those final
  reports bind the corrected test file. Prior reports are preserved.

- browser-a1:1 actual-App Chrome case passed; all7 screenshots inspected by root.
  Art-a3:all11 frames inspected. No repeated broad runtime regression suite.
