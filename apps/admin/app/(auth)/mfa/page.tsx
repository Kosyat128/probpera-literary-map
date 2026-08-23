import { logoutAction } from "@/app/(auth)/login/actions";
import { getStaffSession } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { verifyAdminMfaAction } from "./actions";

export const metadata = { title: "Подтверждение входа" };

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const session = await getStaffSession();
  if (!session.user) redirect("/login");
  if (!session.role) redirect("/login");
  if (!session.mfa.required) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { data: factors, error: factorsError } =
    await supabase.auth.mfa.listFactors();
  const verifiedFactors = (factors?.totp || []).filter(
    (factor) => factor.status === "verified"
  );

  return (
    <main className="auth-screen">
      <section className="auth-story">
        <span className="brand-mark" aria-hidden="true">П</span>
        <span className="eyebrow">Второй фактор</span>
        <h1>Подтвердите вход в редакцию</h1>
        <p>
          Пароль уже принят. Откройте приложение-аутентификатор и введите
          текущий шестизначный код для редакционной учётной записи.
        </p>
        <div className="auth-points" aria-label="Защита редакционной учётной записи">
          <span>Код действует только короткое время</span>
          <span>Секрет TOTP не передаётся в журнал сайта</span>
          <span>После проверки сессия получает уровень AAL2</span>
        </div>
      </section>

      <section className="auth-card">
        <span className="eyebrow">Защищённый вход</span>
        <h2>Код из приложения</h2>
        <p>{session.user.email}</p>
        {query.error && <p className="form-message">{query.error}</p>}
        {factorsError && (
          <p className="form-message">
            Не удалось прочитать подключённые факторы. Выйдите и повторите вход.
          </p>
        )}
        {!factorsError && verifiedFactors.length > 0 ? (
          <form className="form-stack" action={verifyAdminMfaAction}>
            {verifiedFactors.length === 1 ? (
              <input
                type="hidden"
                name="factor_id"
                value={verifiedFactors[0].id}
              />
            ) : (
              <label className="field">
                <span>Фактор</span>
                <select name="factor_id" required defaultValue={verifiedFactors[0].id}>
                  {verifiedFactors.map((factor, index) => (
                    <option key={factor.id} value={factor.id}>
                      {factor.friendly_name || `Аутентификатор ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Одноразовый код</span>
              <input
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
                autoFocus
              />
            </label>
            <button className="button" type="submit">
              Подтвердить и открыть редакцию
            </button>
          </form>
        ) : (
          !factorsError && (
            <p className="form-message">
              Подтверждённый TOTP-фактор не найден. Выйдите и повторите вход.
            </p>
          )
        )}
        <form className="form-stack" action={logoutAction}>
          <button className="button-secondary" type="submit">
            Выйти из учётной записи
          </button>
        </form>
      </section>
    </main>
  );
}
