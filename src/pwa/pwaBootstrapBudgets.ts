// Shared bounds for the canonical offline bootstrap, its worker and its audit.
// Current canonical portraits and book covers fit below this explicit bound.
// Large future owner archives belong in separately bounded content packages.
export const PWA_BOOTSTRAP_MAX_FILES = 2048;
export const PWA_BOOTSTRAP_MAX_FILE_BYTES = 16 * 1024 * 1024;
export const PWA_BOOTSTRAP_MAX_TOTAL_BYTES = 72 * 1024 * 1024;
export const PWA_BOOTSTRAP_MAX_MARKER_BYTES = 512 * 1024;
