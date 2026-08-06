"use server";

import { redirect, withAdminBasePath } from "@/lib/navigation";
import { z } from "zod";

import { adminEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email("Проверьте адрес электронной почты."),
  password: z.string().min(8, "Пароль должен содержать не менее 8 символов."),
});

function loginUrl(message: string, kind: "error" | "success" = "error") {
  return `${withAdminBasePath("/login")}?${kind}=${encodeURIComponent(message)}`;
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(loginUrl(parsed.error.issues[0]?.message || "Проверьте введённые данные."));
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(loginUrl("Подключение к базе ещё не настроено."));
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    redirect(loginUrl("Неверная почта или пароль."));
  }

  redirect(withAdminBasePath("/dashboard"));
}

export async function resetPasswordAction(formData: FormData) {
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success) {
    redirect(loginUrl("Укажите корректный адрес электронной почты."));
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(loginUrl("Подключение к базе ещё не настроено."));
  }

  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${adminEnv.adminSiteUrl}/login`,
  });
  redirect(
    loginUrl(
      "Если адрес зарегистрирован, на него отправлена ссылка восстановления.",
      "success"
    )
  );
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase?.auth.signOut();
  redirect(withAdminBasePath("/login"));
}
