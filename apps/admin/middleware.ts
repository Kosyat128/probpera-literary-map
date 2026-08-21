import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import {
  buildAdminContentSecurityPolicy,
  createAdminCspNonce,
} from "@/lib/content-security-policy";
import { adminEnv, isSupabaseConfigured } from "@/lib/env";

// Next.js 16 keeps middleware.ts specifically for Edge-runtime deployments.
// OpenNext Cloudflare does not yet support the Node-runtime proxy.ts convention.
export const runtime = "experimental-edge";

function secureRequestHeaders(
  request: NextRequest,
  nonce: string,
  contentSecurityPolicy: string
) {
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", contentSecurityPolicy);
  return headers;
}

function secureResponse(response: NextResponse, contentSecurityPolicy: string) {
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function middleware(request: NextRequest) {
  const nonce = createAdminCspNonce();
  const contentSecurityPolicy = buildAdminContentSecurityPolicy({
    nonce,
    isDevelopment: process.env.NODE_ENV !== "production",
    supabaseUrl: adminEnv.supabaseUrl,
    publicSiteUrl: adminEnv.publicSiteUrl,
  });
  const createNextResponse = () =>
    secureResponse(
      NextResponse.next({
        request: {
          headers: secureRequestHeaders(
            request,
            nonce,
            contentSecurityPolicy
          ),
        },
      }),
      contentSecurityPolicy
    );

  const configuredAdminBasePath = getAdminBasePathFromEnv(
    process.env.ADMIN_BASE_PATH
  );
  const pathname = request.nextUrl.pathname;
  const duplicatedPrefix = configuredAdminBasePath
    ? `${configuredAdminBasePath}/${configuredAdminBasePath.replace(/^\/+?/gu, "")}`
    : "";

  if (
    duplicatedPrefix &&
    (pathname === duplicatedPrefix ||
      pathname.startsWith(`${duplicatedPrefix}/`))
  ) {
    const normalizedUrl = request.nextUrl.clone();
    normalizedUrl.pathname =
      pathname === duplicatedPrefix
        ? configuredAdminBasePath
        : `${configuredAdminBasePath}${pathname.slice(duplicatedPrefix.length)}`;
    return secureResponse(
      NextResponse.redirect(normalizedUrl, 308),
      contentSecurityPolicy
    );
  }

  if (!isSupabaseConfigured) return createNextResponse();

  let response = createNextResponse();
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
          response = createNextResponse();
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
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
