import { redirect as nextRedirect } from "next/navigation";

const configuredBasePath = process.env.ADMIN_BASE_PATH?.trim() ?? "/admin";

export const adminBasePath =
  configuredBasePath === "" || configuredBasePath === "/"
    ? ""
    : `/${configuredBasePath.replace(/^\/+|\/+$/gu, "")}`;

export function withAdminBasePath(destination: string) {
  // Next applies `basePath` to internal redirects itself. Prefixing it here
  // produces `/admin/admin/...` after Server Actions.
  return destination;
}

export function redirect(destination: string): never {
  nextRedirect(destination);
}
