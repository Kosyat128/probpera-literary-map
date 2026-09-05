# Final compiled Reader and layout-v4 evidence

Captured from the local production preview at `http://127.0.0.1:4185`, completed 2026-09-05T17:58:14.300Z. These three PNGs and `result.json` are exact SHA-256-verified copies of the final capture in `.review/book-reading-refinement/final/`; no new browser run was performed during promotion.

RU Reader at 1440 and 320 viewport widths uses Source Serif 4 body text at 17px with 25.5px line-height (1.5). Horizontal bounds and full text Range bounds pass. Next/previous section navigation and keyboard-visible focus pass; page/load errors are zero. The final panel uses violet, cream reading paper and purple/white Reader buttons.

`physical-description-tail-1440.png` shows the actual final description fragment of RU 1984 on physical page 4 of 8. Its compiled layout-v4 plan contains exactly four paragraph draw commands, matching the visible four lines. Content order and semantic anchors are preserved by the separately recorded pagination tests.

`reader-320.png` records the normal half-height mobile panel, with the body continuing inside its scrollport. It is not an expanded-panel screenshot or evidence that all body text is simultaneously visible. `reader-1440.png` shows the desktop reading panel.

The sibling `reader-refinement-final.json` and its earlier screenshots are historical evidence from before the final 1.58-to-1.5 DOM leading and brand-color polish. This final bounded capture does not repeat the full eight-case accessibility or 34-dossier pagination matrix.
