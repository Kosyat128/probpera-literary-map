import { redirect as nextRedirect } from "next/navigation";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";

export const adminBasePath = getAdminBasePathFromEnv(
  process.env.ADMIN_BASE_PATH
);

export function withAdminBasePath(destination: string) {
  if (!destination) return destination;

  const normalized = destination.trim();
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("mailto:") ||
    normalized.startsWith("#")
  ) {
    return normalized;
  }

  return normalized;
}

export function redirect(destination: string): never {
  nextRedirect(withAdminBasePath(destination));
}
