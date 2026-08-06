import { redirect } from "@/lib/navigation";

import { getStaffSession } from "@/lib/auth";
import { loginAction, logoutAction, resetPasswordAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await getStaffSession();
  if (session.user && session.role) redirect("/dashboard");
  const query = await searchParams;

  return (
    <main className="auth-screen">
      <section className="auth-story">
        <span className="brand-mark" aria-hidden="true">П</span>
        <span className="eyebrow">Редакция литературного журнала</span>
        <h1>Всё издание — в одном кабинете</h1>
        <p>
          Статьи, рубрики, иллюстрации, главная страница, комментарии и
          статистика — с безопасными ролями и историей каждого изменения.
        </p>
        <div className="auth-points" aria-label="Возможности кабинета">
          <span>Визуальный редактор без работы с кодом</span>
          <span>Публикация сразу или по расписанию</span>
          <span>Проверка SEO, ссылок и прав на изображения</span>
        </div>
      </section>

      <section className="auth-card">
        <span className="eyebrow">Защищённый вход</span>
        <h2>Добро пожаловать</h2>
        <p>
          Используйте редакционную учётную запись. Обычная регистрация
          читателя не открывает доступ к панели.
        </p>
        {!session.configured && (
          <p className="form-message">
            Панель собрана, но подключение к Supabase ещё не задано на сервере.
            Заполните переменные окружения перед первым входом.
          </p>
        )}
        {session.user && !session.role && (
          <p className="form-message">
            Учётная запись {session.user.email} подтверждена, но редакционная
            роль ей не назначена. Выйдите и войдите под учётной записью
            владельца либо добавьте пользователя в команду редакции.
          </p>
        )}
        {query.error && <p className="form-message">{query.error}</p>}
        {query.success && (
          <p className="form-message form-success">{query.success}</p>
        )}
        {session.user ? (
          <form className="form-stack" action={logoutAction}>
            <button className="button-secondary" type="submit">
              Выйти из этой учётной записи
            </button>
          </form>
        ) : (
        <form className="form-stack" action={loginAction}>
          <label className="field">
            <span>Электронная почта</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="editor@probpera.ru"
            />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>
          <button className="button" type="submit">Войти в редакцию</button>
          <button
            className="button-secondary"
            type="submit"
            formAction={resetPasswordAction}
            formNoValidate
          >
            Восстановить пароль по почте
          </button>
        </form>
        )}
      </section>
    </main>
  );
}
