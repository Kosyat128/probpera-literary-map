"use server";

import { z } from "zod";

import { redirect, withAdminBasePath } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authServiceError, guardedAuthRequest, logAuthFailure } from "@/lib/auth-service-error";

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

  const userResult = await guardedAuthRequest(() => supabase.auth.getUser());
  const userError = userResult.error;
  const user = "data" in userResult ? userResult.data.user : null;
  if (userError && authServiceError(userError)) redirect(mfaUrl(authServiceError(userError)!));
  if (userError || !user) redirect(withAdminBasePath("/login"));

  const factorsResult = await guardedAuthRequest(() => supabase.auth.mfa.listFactors());
  const factors = "data" in factorsResult ? factorsResult.data : null;
  const factorsError = factorsResult.error;
  if (factorsError) {
    logAuthFailure("mfa_factors", factorsError);
    redirect(mfaUrl(authServiceError(factorsError) || "Не удалось проверить подключённые факторы. Повторите вход."));
  }

  const factor = factors?.totp?.find(
    (item) => item.id === parsed.data.factorId && item.status === "verified"
  );
  if (!factor) {
    redirect(mfaUrl("Выбранный TOTP-фактор не найден или ещё не подтверждён."));
  }

  const challengeResult = await guardedAuthRequest(() => supabase.auth.mfa.challenge({ factorId: factor.id }));
  const challenge = "data" in challengeResult ? challengeResult.data : null;
  const challengeError = challengeResult.error;
  if (challengeError || !challenge?.id) {
    redirect(mfaUrl(authServiceError(challengeError) || "Не удалось создать MFA-проверку. Попробуйте ещё раз."));
  }

  const { error: verifyError } = await guardedAuthRequest(() => supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: parsed.data.code,
  }));
  if (verifyError) {
    redirect(mfaUrl(authServiceError(verifyError) || "Код не принят. Проверьте время на устройстве и повторите ввод."));
  }

  redirect(withAdminBasePath("/dashboard"));
}
