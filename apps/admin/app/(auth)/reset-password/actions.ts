"use server";

import { z } from "zod";

import { redirect, withAdminBasePath } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authServiceError, guardedAuthRequest, logAuthFailure } from "@/lib/auth-service-error";

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Новый пароль должен содержать не менее 10 символов."),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "Пароли не совпадают.",
    path: ["confirmation"],
  });

function resetUrl(message: string) {
  return `${withAdminBasePath("/reset-password")}?error=${encodeURIComponent(message)}`;
}

export async function updatePasswordAction(formData: FormData) {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) {
    redirect(resetUrl(parsed.error.issues[0]?.message || "Проверьте новый пароль."));
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirect(resetUrl("Подключение к базе данных не настроено."));
  }

  const userResult = await guardedAuthRequest(() => supabase.auth.getUser());
  if (userResult.error && authServiceError(userResult.error)) {
    logAuthFailure("recovery_session", userResult.error);
    redirect(resetUrl(authServiceError(userResult.error)!));
  }
  if (!("data" in userResult) || !userResult.data.user) {
    redirect(
      `${withAdminBasePath("/login")}?error=${encodeURIComponent(
        "Сессия восстановления истекла. Запросите новую ссылку."
      )}`
    );
  }

  const { error } = await guardedAuthRequest(() => supabase.auth.updateUser({
    password: parsed.data.password,
  }));
  if (error) {
    logAuthFailure("password_update", error);
    redirect(resetUrl(authServiceError(error) || "Не удалось изменить пароль. Запросите новую ссылку и повторите попытку."));
  }

  await guardedAuthRequest(() => supabase.auth.signOut());
  redirect(
    `${withAdminBasePath("/login")}?success=${encodeURIComponent(
      "Пароль изменён. Теперь войдите с новым паролем."
    )}`
  );
}
