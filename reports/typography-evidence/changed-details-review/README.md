# Changed-details verification

Fresh RU checks at 390px/coarse and 1440px waited for the actual book action and title, then decoded its cover. The selected book was **Лолита**; its local 168×251 cover retains `object-fit: contain`. Loaded book content has no horizontal overflow, and its text fits the card.

Confirmed changed roles:

- Footer at coarse/390: both map buttons are 44px high; all five social controls are exactly 44×44px.
- Portrait attribution: Source Sans 3, 14px/400. Life dates and footer metadata: 13px.
- Archive search: actual keyboard focus has a visible solid 3px outline.
- Both observed pages reported no browser page errors.

Four component screenshots accompany `measurements.json`. A 1600px-high viewport keeps these isolated components within the screenshot viewport; sticky navigation is hidden only for the captures. No full-page capture was made.

`book-heading-before-25pct.json` preserves the measured 28px book-section heading before the separately requested increase. The final build was then checked at both widths: **28px → 35px, ratio exactly 1.25**. `book-heading-25pct.json` records the final values, zero heading/document horizontal overflow, one-line wrapping and clear separation from the following book title. Both loaded-book PNGs were refreshed and visually inspected: the complete cover, description and actions remain visible. The earlier general measurements retain their original heading values; this final heading report supersedes those values.

The owner's later white-text request is verified in `book-button.json` and two `ru-book-button-*.png` crops. Actual built-page rest, hover, keyboard-focus and pressed states at 390/1440 retain a white label, 14px type and unchanged 44px-high controls. Contrast is 5.455:1 at rest, 4.817:1 on hover/focus and 6.319:1 when pressed. No text or page overflow was found. Files ending in `-preview` are the earlier source-CSS check, not final build evidence. The full loaded-book crops above predate this button-color adjustment.
