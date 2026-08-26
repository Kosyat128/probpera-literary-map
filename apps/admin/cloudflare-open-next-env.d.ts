/// <reference types="@cloudflare/workers-types" />

export {};

declare global {
  interface CloudflareEnv {
    AI: Ai;
    ADMIN_CATALOGS: AdminCloudflareBindings["ADMIN_CATALOGS"];
  }
}
