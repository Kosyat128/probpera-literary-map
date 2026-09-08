// Shared bounds for the canonical offline bootstrap, its worker and its audit.
// The portrait closure expands the file count; byte limits remain unchanged.
export const PWA_BOOTSTRAP_MAX_FILES = 2048;
export const PWA_BOOTSTRAP_MAX_FILE_BYTES = 16 * 1024 * 1024;
export const PWA_BOOTSTRAP_MAX_TOTAL_BYTES = 64 * 1024 * 1024;
export const PWA_BOOTSTRAP_MAX_MARKER_BYTES = 512 * 1024;
