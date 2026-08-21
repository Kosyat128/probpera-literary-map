"use client";

import { installSafeWebStorage } from "../../../src/utils/safeWebStorage";

// Run during client-module evaluation so legacy editor effects never observe a
// throwing localStorage/sessionStorage property. The render call is an
// idempotent fallback for environments that evaluate the module on the server.
installSafeWebStorage();

export default function SafeBrowserStorageBootstrap() {
  installSafeWebStorage();
  return null;
}
