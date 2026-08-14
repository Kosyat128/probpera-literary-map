import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { adminEnv, isSupabaseConfigured } from "@/lib/env";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";

export async function proxy(request: NextRequest) {
  const configuredAdminBasePath = getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH);
  const pathname = request.nextUrl.pathname;
  const duplicatedPrefix = configuredAdminBasePath
    ? `${configuredAdminBasePath}/${configuredAdminBasePath.replace(/^\/+/gu, "")}`
    : "";

  if (duplicatedPrefix && (pathname === duplicatedPrefix || pathname.startsWith(`${duplicatedPrefix}/`))) {
    const normalizedUrl = request.nextUrl.clone();
    normalizedUrl.pathname =
      pathname === duplicatedPrefix
        ? configuredAdminBasePath
        : `${configuredAdminBasePath}${pathname.slice(duplicatedPrefix.length)}`;
    return NextResponse.redirect(normalizedUrl, 308);
  }

  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    adminEnv.supabaseUrl,
    adminEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
