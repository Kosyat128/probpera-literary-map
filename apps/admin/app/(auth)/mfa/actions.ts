"use server";

import { z } from "zod";

import { redirect, withAdminBasePath } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const challengeSchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/u),
});

function mfaUrl(message: string) {
  return `${withAdminBasePath("/mfa")}?error=${encodeURIComponent(message)}`;
}

export async function verifyAdminMfaAction(formData: FormData) {
  const parsed = challengeSchema.safeParse({
    factorId: formData.get("factor_id"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    redirect(mfaUrl("Введите шестизначный код из приложения-аутентификатора."));
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(withAdminBasePath("/login"));

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect(withAdminBasePath("/login"));

  const { data: factors, error: factorsError } =
    await supabase.auth.mfa.listFactors();
  if (factorsError) {
    redirect(mfaUrl("Не удалось проверить подключённые факторы. Повторите вход."));
  }

  const factor = factors?.totp?.find(
    (item) => item.id === parsed.data.factorId && item.status === "verified"
  );
  if (!factor) {
    redirect(mfaUrl("Выбранный TOTP-фактор не найден или ещё не подтверждён."));
  }

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challengeError || !challenge?.id) {
    redirect(mfaUrl("Не удалось создать MFA-проверку. Попробуйте ещё раз."));
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: parsed.data.code,
  });
  if (verifyError) {
    redirect(mfaUrl("Код не принят. Проверьте время на устройстве и повторите ввод."));
  }

  redirect(withAdminBasePath("/dashboard"));
}
