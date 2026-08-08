import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { updatePasswordAction } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data } = (await supabase?.auth.getUser()) || { data: { user: null } };

  if (!data.user) {
    redirect(
      `/login?error=${encodeURIComponent(
        "Откройте свежую ссылку восстановления из письма."
      )}`
    );
  }

  return (
    <main className="auth-screen auth-screen-single">
      <section className="auth-card">
        <span className="eyebrow">Безопасность редакции</span>
        <h1>Задайте новый пароль</h1>
        <p>
          Используйте уникальный пароль длиной не менее 10 символов. После
          сохранения потребуется войти снова.
        </p>
        {query.error && <p className="form-message">{query.error}</p>}
        <form className="form-stack" action={updatePasswordAction}>
          <label className="field">
            <span>Новый пароль</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </label>
          <label className="field">
            <span>Повторите пароль</span>
            <input
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </label>
          <button className="button" type="submit">
            Сохранить новый пароль
          </button>
        </form>
      </section>
    </main>
  );
}
