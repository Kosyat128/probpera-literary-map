/// <reference types="@cloudflare/workers-types" />

export {};

declare global {
  interface CloudflareEnv {
    ADMIN_CATALOGS: AdminCloudflareBindings["ADMIN_CATALOGS"];
  }
}
