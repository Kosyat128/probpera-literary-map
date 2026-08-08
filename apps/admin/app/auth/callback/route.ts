import { NextResponse, type NextRequest } from "next/server";

import { adminEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

function adminUrl(pathname: string) {
  return new URL(`${adminEnv.adminSiteUrl}${pathname}`);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createServerSupabaseClient();

  if (!code || !supabase) {
    const target = adminUrl("/login");
    target.searchParams.set(
      "error",
      !supabase
        ? "Подключение к базе данных не настроено."
        : "Ссылка восстановления пароля неполна или устарела."
    );
    return NextResponse.redirect(target);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const target = adminUrl("/login");
    target.searchParams.set(
      "error",
      "Не удалось подтвердить ссылку восстановления. Запросите новую ссылку."
    );
    return NextResponse.redirect(target);
  }

  return NextResponse.redirect(adminUrl(nextPath));
}
