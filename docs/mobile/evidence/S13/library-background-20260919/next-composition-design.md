# Next bounded S13 composition slice

Read-only design after the included library and stand material work. This is
pending implementation, not a completion claim or full document-17 model.

Use one bounded versioned preference record for the known edition, stand and
background IDs. Validate the full combination with current exact local rules;
do not invent accessory/audio/child IDs. Graphics quality remains a preparation
constraint owned by the existing quality controller.

One composition coordinator must own applied/displayed selection, intent tokens,
render acknowledgements and the single ordered record write. Current controls
may retain their public API through a shared driver; independent proxy ports or
Promise.all over the three old keys do not provide an atomic saved selection.

Read the new key first. Only confirmed absence permits reading legacy keys;
malformed, failed or timed-out reads cannot authorize fallback migration.
Normalize the known legacy values, prepare the whole combination, acknowledge
its frame, then persist one new record. Keep legacy keys unchanged. Explicit
intent fences every late migration or acknowledgement.

Edition preparation needs special work: its existing onCommit follows atlas
canvas repaint, while stand/background acknowledgement follows a render frame.
Confirm the exact edition/stand/background tokens in one actual scene frame.
Keep a temporary lease of the applied atlas source, so rollback can restore the
same map canvas without a new potentially failing network load. Retain the one
Canvas, camera, renderer, geography and semantic selection.

Serialize the single key across controller remounts. Timeout must not release a
started native write. Distinguish an acknowledged session choice, a confirmed
preference write, full composition rollback and crash-safe device persistence.
Do not imply stronger guarantees than the adapter can provide.

Meaningful verification: migration versus malformed new state; delayed reads
versus explicit intent; stale A/B acknowledgements after intent C; one-component
preparation failure restores the entire baseline; atlas rollback without network;
timeout/remount write ordering; background/context loss; independent locale,
quality, pose and semantic state. Local API and actual-scene evidence remain
separate from installed-device and release acceptance.
