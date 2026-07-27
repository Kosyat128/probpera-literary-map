import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "../lib/supabase";
import { useReadingLibrary } from "../hooks/useReadingLibrary";
import { articlePath } from "../utils/articleRoutes";
import { useAuth } from "./AuthContext";
import EditorialWorkbench from "./EditorialWorkbench";

export type CommunityView = "account" | "forum" | "admin";

type Props = {
  open: boolean;
  initialView?: CommunityView;
  onClose: () => void;
};

type ForumTopic = {
  id: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
  author_id: string;
  profiles?: { display_name?: string } | null;
  forum_replies?: Array<{ count: number }>;
};

type ForumReply = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles?: { display_name?: string } | null;
};

type DashboardCounts = {
  readers: number;
  topics: number;
  comments: number;
  ratings: number;
  views: number;
  reports: number;
};

type ModerationItem = {
  id: string;
  kind: "topic" | "comment";
  title?: string;
  body: string;
  status: "published" | "hidden" | "pending";
  created_at: string;
  profiles?: { display_name?: string } | null;
};

type CommentReport = {
  id: string;
  reason: string;
  created_at: string;
  article_comments?: {
    id: string;
    article_slug: string;
    body: string;
    status: string;
    guest_name?: string | null;
    profiles?: { display_name?: string } | null;
  } | null;
};

const categories = [
  "Обсуждение книги",
  "Классика",
  "Современная литература",
  "Экранизации",
  "Вопрос редакции",
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function CommunityHub({
  open,
  initialView = "account",
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const {
    configured,
    loading,
    user,
    role,
    displayName: profileDisplayName,
  } = useAuth();
  const [view, setView] = useState<CommunityView>(initialView);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<ForumTopic | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicBody, setTopicBody] = useState("");
  const [topicCategory, setTopicCategory] = useState(categories[0]);
  const [replyBody, setReplyBody] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [dashboardCounts, setDashboardCounts] = useState<DashboardCounts>({
    readers: 0,
    topics: 0,
    comments: 0,
    ratings: 0,
    views: 0,
    reports: 0,
  });
  const [moderationItems, setModerationItems] = useState<ModerationItem[]>([]);
  const [commentReports, setCommentReports] = useState<CommentReport[]>([]);
  const { items: savedReadings, remove: removeSavedReading } =
    useReadingLibrary();

  const isModerator = ["moderator", "editor", "admin"].includes(role);

  useEffect(() => {
    if (!open) return;
    setView(initialView);
    setMessage("");
  }, [initialView, open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const loadTopics = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("forum_topics")
      .select(
        "id,title,body,category,created_at,author_id,profiles(display_name),forum_replies(count)"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      setMessage("Не удалось загрузить обсуждения. Проверьте схему сообщества.");
      return;
    }
    setTopics((data || []) as unknown as ForumTopic[]);
  }, []);

  const loadReplies = useCallback(async (topicId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from("forum_replies")
      .select("id,body,created_at,author_id,profiles(display_name)")
      .eq("topic_id", topicId)
      .eq("status", "published")
      .order("created_at", { ascending: true });
    setReplies((data || []) as unknown as ForumReply[]);
  }, []);

  useEffect(() => {
    if (!open || view !== "forum" || !configured) return;
    void loadTopics();

    const channel = supabase
      ?.channel("forum-home")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "forum_topics" },
        () => void loadTopics()
      )
      .subscribe();

    return () => {
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [configured, loadTopics, open, view]);

  useEffect(() => {
    if (!selectedTopic) {
      setReplies([]);
      return;
    }
    void loadReplies(selectedTopic.id);
  }, [loadReplies, selectedTopic]);

  const loadDashboard = useCallback(async () => {
    if (!supabase || !isModerator) return;

    const [
      readers,
      topics,
      comments,
      ratings,
      views,
      reports,
      recentTopics,
      recentComments,
      recentReports,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("forum_topics").select("id", { count: "exact", head: true }),
      supabase
        .from("article_comments")
        .select("id", { count: "exact", head: true }),
      supabase.from("ratings").select("id", { count: "exact", head: true }),
      supabase
        .from("content_views")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("comment_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("forum_topics")
        .select("id,title,body,status,created_at,profiles(display_name)")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("article_comments")
        .select("id,body,status,created_at,profiles(display_name)")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("comment_reports")
        .select(
          "id,reason,created_at,article_comments(id,article_slug,body,status,guest_name,profiles(display_name))"
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setDashboardCounts({
      readers: readers.count || 0,
      topics: topics.count || 0,
      comments: comments.count || 0,
      ratings: ratings.count || 0,
      views: views.count || 0,
      reports: reports.count || 0,
    });

    setModerationItems(
      [
        ...((recentTopics.data || []).map((item) => ({
          ...item,
          kind: "topic" as const,
        })) as unknown as ModerationItem[]),
        ...((recentComments.data || []).map((item) => ({
          ...item,
          kind: "comment" as const,
        })) as unknown as ModerationItem[]),
      ]
        .sort(
          (first, second) =>
            new Date(second.created_at).getTime() -
            new Date(first.created_at).getTime()
        )
        .slice(0, 18)
    );
    setCommentReports(
      (recentReports.data || []) as unknown as CommentReport[]
    );
  }, [isModerator]);

  useEffect(() => {
    if (!open || view !== "admin" || !configured || !isModerator) return;
    void loadDashboard();
  }, [configured, isModerator, loadDashboard, open, view]);

  const readerName = useMemo(
    () =>
      user?.user_metadata?.display_name ||
      profileDisplayName ||
      user?.email?.split("@")[0] ||
      "Читатель",
    [profileDisplayName, user]
  );

  if (!open) return null;

  const submitAuth = async () => {
    if (!supabase) {
      setMessage("Сервер сообщества ещё не подключён к этой сборке сайта.");
      return;
    }
    if (
      authMode === "signup" &&
      !/^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,31}$/u.test(displayName.trim())
    ) {
      setMessage(
        "Никнейм должен содержать от 2 до 32 букв или цифр; допустимы пробел, точка, дефис и подчёркивание."
      );
      return;
    }
    if (authMode === "signup" && password !== confirmPassword) {
      setMessage("Пароли не совпадают.");
      return;
    }
    if (authMode === "signup" && !acceptedTerms) {
      setMessage("Подтвердите согласие с правилами сообщества.");
      return;
    }
    setBusy(true);
    setMessage("");

    const result =
      authMode === "signup"
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { display_name: displayName.trim() || "Читатель" } },
          })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setMessage(
      authMode === "signup"
        ? "Проверьте почту и подтвердите регистрацию."
        : "Вы вошли в клуб читателей."
    );
  };

  const createTopic = async () => {
    if (!supabase || !user || !topicTitle.trim() || !topicBody.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("forum_topics").insert({
      author_id: user.id,
      title: topicTitle.trim(),
      body: topicBody.trim(),
      category: topicCategory,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setTopicTitle("");
    setTopicBody("");
    setComposeOpen(false);
    await loadTopics();
  };

  const createReply = async () => {
    if (!supabase || !user || !selectedTopic || !replyBody.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("forum_replies").insert({
      topic_id: selectedTopic.id,
      author_id: user.id,
      body: replyBody.trim(),
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setReplyBody("");
    await loadReplies(selectedTopic.id);
  };

  const moderate = async (
    item: ModerationItem,
    status: "published" | "hidden"
  ) => {
    if (!supabase || !isModerator) return;
    setBusy(true);
    const table =
      item.kind === "topic" ? "forum_topics" : "article_comments";
    const { error } = await supabase.from(table).update({ status }).eq("id", item.id);
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadDashboard();
  };

  const resolveReport = async (reportId: string, hideComment: boolean) => {
    if (!supabase || !isModerator) return;
    setBusy(true);
    const { error } = await supabase.rpc("resolve_comment_report", {
      p_report_id: reportId,
      p_hide_comment: hideComment,
    });
    setBusy(false);
    if (error) {
      setMessage("Не удалось обработать жалобу.");
      return;
    }
    setMessage(
      hideComment
        ? "Комментарий скрыт, жалоба закрыта."
        : "Комментарий оставлен, жалоба закрыта."
    );
    await loadDashboard();
  };

  return (
    <div className="community-overlay" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className={`community-hub${view === "account" ? " is-account" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="community-header">
          <div>
            <img
              src={`${import.meta.env.BASE_URL}brand/probpera-logo.png`}
              alt=""
            />
            <span>
              <small>Клуб читателей</small>
              <strong id="community-title">Говорилка «Проба Пера»</strong>
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <nav className="community-tabs" aria-label="Разделы сообщества">
          <button
            className={view === "account" ? "is-active" : ""}
            type="button"
            onClick={() => setView("account")}
          >
            {user ? "Профиль" : "Вход и регистрация"}
          </button>
          <button
            className={view === "forum" ? "is-active" : ""}
            type="button"
            onClick={() => setView("forum")}
          >
            Форум
          </button>
          {isModerator && (
            <button
              className={view === "admin" ? "is-active" : ""}
              type="button"
              onClick={() => setView("admin")}
            >
              Панель редакции
            </button>
          )}
        </nav>

        {view !== "account" && !configured ? (
          <div className="community-setup">
            <span aria-hidden="true">✦</span>
            <h2>Сообщество готово к подключению</h2>
            <p>
              Интерфейс, защищённая схема профилей, форума, комментариев и
              рейтингов уже подготовлены. Для общей работы пользователей нужно
              указать публичные параметры проекта Supabase.
            </p>
            <small>До подключения формы не сохраняют персональные данные.</small>
          </div>
        ) : loading && configured ? (
          <div className="community-setup">Проверяем сессию…</div>
        ) : view === "admin" && isModerator ? (
          <div className="admin-view">
            <div className="admin-heading">
              <div>
                <span className="section-kicker">Только для редакции</span>
                <h2>Панель сообщества</h2>
                <p>
                  Внутренняя статистика и очередь модерации без рекламных
                  счётчиков и сторонних комментариев.
                </p>
              </div>
              <button type="button" onClick={() => void loadDashboard()}>
                Обновить
              </button>
            </div>

            <div className="admin-stats">
              {[
                ["Читатели", dashboardCounts.readers],
                ["Темы форума", dashboardCounts.topics],
                ["Комментарии", dashboardCounts.comments],
                ["Оценки", dashboardCounts.ratings],
                ["Просмотры", dashboardCounts.views],
                ["Открытые жалобы", dashboardCounts.reports],
              ].map(([label, value]) => (
                <article key={label}>
                  <strong>{Number(value).toLocaleString("ru-RU")}</strong>
                  <span>{label}</span>
                </article>
              ))}
            </div>

            <div className="report-queue">
              <header>
                <div>
                  <span className="section-kicker">Требует решения</span>
                  <h3>Жалобы читателей</h3>
                </div>
                <span>{commentReports.length}</span>
              </header>
              {commentReports.length ? (
                commentReports.map((report) => (
                  <article key={report.id}>
                    <div>
                      <small>
                        {report.article_comments?.article_slug || "Публикация"} ·{" "}
                        {formatDate(report.created_at)}
                      </small>
                      <strong>
                        {report.article_comments?.profiles?.display_name ||
                          report.article_comments?.guest_name ||
                          "Читатель"}
                      </strong>
                      <p>{report.article_comments?.body}</p>
                      <em>{report.reason}</em>
                    </div>
                    <div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void resolveReport(report.id, false)}
                      >
                        Оставить
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void resolveReport(report.id, true)}
                      >
                        Скрыть
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p>Открытых жалоб нет.</p>
              )}
            </div>

            <div className="moderation-list">
              <header>
                <h3>Последняя активность</h3>
                <span>{moderationItems.length} записей</span>
              </header>
              {moderationItems.length ? (
                moderationItems.map((item) => (
                  <article key={`${item.kind}-${item.id}`}>
                    <div>
                      <small>
                        {item.kind === "topic" ? "Форум" : "Комментарий"} ·{" "}
                        {item.profiles?.display_name || "Читатель"} ·{" "}
                        {formatDate(item.created_at)}
                      </small>
                      {item.title && <strong>{item.title}</strong>}
                      <p>{item.body}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void moderate(
                          item,
                          item.status === "hidden" ? "published" : "hidden"
                        )
                      }
                    >
                      {item.status === "hidden" ? "Вернуть" : "Скрыть"}
                    </button>
                  </article>
                ))
              ) : (
                <div className="forum-empty">
                  <strong>Активность появится после запуска сообщества.</strong>
                </div>
              )}
            </div>
            {["editor", "admin"].includes(role) && <EditorialWorkbench />}
          </div>
        ) : view === "account" ? (
          <div className="account-view">
            <aside className="account-story">
              <div>
                <span className="account-monogram" aria-hidden="true">
                  ПП
                </span>
                <span className="section-kicker">Литературное сообщество</span>
                <h2>Читайте глубже. Обсуждайте уважительно.</h2>
                <p>
                  Один профиль связывает ваши оценки, комментарии, форум и
                  будущую личную библиотеку внутри «Пробы Пера».
                </p>
              </div>
              <ul>
                <li>Комментарии и рейтинги без сторонних виджетов</li>
                <li>Обсуждения книг, статей и переводов</li>
                <li>Спокойная редакционная модерация</li>
              </ul>
              <small>
                Ваши данные не используются для рекламного профилирования.
              </small>
            </aside>

            <div className="account-panel">
              {user ? (
                <>
                <span className="section-kicker">Личный кабинет</span>
                <h2>Здравствуйте, {readerName}</h2>
                <p>
                  Теперь можно участвовать в обсуждениях, оценивать публикации
                  и книги, сохранять историю комментариев.
                </p>
                <dl>
                  <div>
                    <dt>Почта</dt>
                    <dd>{user.email}</dd>
                  </div>
                  <div>
                    <dt>Статус</dt>
                    <dd>Участник клуба читателей</dd>
                  </div>
                </dl>
                <section className="account-library">
                  <header>
                    <div>
                      <span className="section-kicker">Моя библиотека</span>
                      <h3>Сохранённые материалы</h3>
                    </div>
                    <strong>{savedReadings.length}</strong>
                  </header>
                  {savedReadings.length ? (
                    <div>
                      {savedReadings.slice(0, 6).map((item) => (
                        <article key={item.id}>
                          <a href={articlePath(item.id)}>
                            <small>{item.sectionLabel}</small>
                            <strong>{item.title}</strong>
                          </a>
                          <button
                            type="button"
                            onClick={() => removeSavedReading(item.id)}
                            aria-label={`Удалить «${item.title}» из библиотеки`}
                          >
                            ×
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>
                      Нажмите значок закладки в режиме чтения — статья появится
                      здесь.
                    </p>
                  )}
                </section>
                <div className="account-actions">
                  <button type="button" onClick={() => setView("forum")}>
                    Перейти в форум
                  </button>
                  <button
                    type="button"
                    onClick={() => void supabase?.auth.signOut()}
                  >
                    Выйти
                  </button>
                </div>
                </>
              ) : (
                <>
                <span className="section-kicker">
                  {authMode === "signup" ? "Новый читатель" : "С возвращением"}
                </span>
                <h2>
                  {authMode === "signup"
                    ? "Вступить в литературный клуб"
                    : "Войти в «Пробу Пера»"}
                </h2>

                {authMode === "signup" && (
                  <label>
                    Никнейм в сообществе
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      autoComplete="nickname"
                      minLength={2}
                      maxLength={32}
                      placeholder="Например, Читатель_ПП"
                    />
                  </label>
                )}
                <label>
                  Электронная почта
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                  />
                </label>
                <label>
                  Пароль
                  <span className="auth-password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      minLength={10}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={
                        authMode === "signup" ? "new-password" : "current-password"
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                    >
                      {showPassword ? "Скрыть" : "Показать"}
                    </button>
                  </span>
                </label>
                {authMode === "signup" && (
                  <>
                    <label>
                      Повторите пароль
                      <input
                        type={showPassword ? "text" : "password"}
                        minLength={10}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                      />
                    </label>
                    <small className="password-hint">
                      Не менее 10 символов. Не используйте пароль от почты или
                      социальных сетей.
                    </small>
                    <label className="terms-check">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(event) => setAcceptedTerms(event.target.checked)}
                      />
                      <span>
                        Я принимаю правила уважительного общения и обработку
                        данных, необходимых для работы профиля.
                      </span>
                    </label>
                  </>
                )}
                {!configured && (
                  <p className="auth-connection-note">
                    Форма полностью готова. Регистрация включится после
                    подключения серверных ключей проекта в GitHub Actions.
                  </p>
                )}
                <button
                  className="community-primary"
                  type="button"
                  disabled={
                    busy ||
                    !configured ||
                    !email.trim() ||
                    password.length < 10 ||
                    (authMode === "signup" &&
                      (!displayName.trim() ||
                        password !== confirmPassword ||
                        !acceptedTerms))
                  }
                  onClick={() => void submitAuth()}
                >
                  {busy
                    ? "Подождите…"
                    : authMode === "signup"
                      ? "Зарегистрироваться"
                      : "Войти"}
                </button>
                <button
                  className="auth-switch"
                  type="button"
                  onClick={() =>
                    setAuthMode((current) =>
                      current === "signup" ? "signin" : "signup"
                    )
                  }
                >
                  {authMode === "signup"
                    ? "Уже есть аккаунт — войти"
                    : "Нет аккаунта — зарегистрироваться"}
                </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="forum-view">
            <div className="forum-toolbar">
              <div>
                <span className="section-kicker">Разговор о литературе</span>
                <h2>{selectedTopic ? selectedTopic.title : "Форум читателей"}</h2>
              </div>
              {selectedTopic ? (
                <button type="button" onClick={() => setSelectedTopic(null)}>
                  ← Все темы
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      setView("account");
                      setMessage("Войдите, чтобы открыть новую тему.");
                    } else {
                      setComposeOpen((current) => !current);
                    }
                  }}
                >
                  + Новая тема
                </button>
              )}
            </div>

            {selectedTopic ? (
              <div className="topic-thread">
                <article>
                  <small>
                    {selectedTopic.category} · {formatDate(selectedTopic.created_at)}
                  </small>
                  <p>{selectedTopic.body}</p>
                </article>
                <div className="thread-replies">
                  {replies.map((reply) => (
                    <article key={reply.id}>
                      <strong>
                        {reply.profiles?.display_name || "Читатель"}
                      </strong>
                      <small>{formatDate(reply.created_at)}</small>
                      <p>{reply.body}</p>
                    </article>
                  ))}
                </div>
                {user ? (
                  <div className="reply-form">
                    <textarea
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      placeholder="Ответить по существу…"
                      maxLength={4000}
                    />
                    <button
                      type="button"
                      disabled={busy || !replyBody.trim()}
                      onClick={() => void createReply()}
                    >
                      Отправить ответ
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setView("account")}>
                    Войдите, чтобы ответить
                  </button>
                )}
              </div>
            ) : (
              <>
                {composeOpen && (
                  <div className="topic-compose">
                    <select
                      value={topicCategory}
                      onChange={(event) => setTopicCategory(event.target.value)}
                    >
                      {categories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                    <input
                      value={topicTitle}
                      onChange={(event) => setTopicTitle(event.target.value)}
                      placeholder="Название обсуждения"
                      maxLength={140}
                    />
                    <textarea
                      value={topicBody}
                      onChange={(event) => setTopicBody(event.target.value)}
                      placeholder="Сформулируйте вопрос или тему…"
                      maxLength={8000}
                    />
                    <button
                      type="button"
                      disabled={
                        busy || !topicTitle.trim() || !topicBody.trim()
                      }
                      onClick={() => void createTopic()}
                    >
                      Опубликовать тему
                    </button>
                  </div>
                )}
                <div className="topic-list">
                  {topics.length ? (
                    topics.map((topic) => (
                      <button
                        type="button"
                        key={topic.id}
                        onClick={() => setSelectedTopic(topic)}
                      >
                        <span>{topic.category}</span>
                        <strong>{topic.title}</strong>
                        <p>{topic.body}</p>
                        <small>
                          {topic.profiles?.display_name || "Читатель"} ·{" "}
                          {formatDate(topic.created_at)} ·{" "}
                          {topic.forum_replies?.[0]?.count || 0} ответов
                        </small>
                      </button>
                    ))
                  ) : (
                    <div className="forum-empty">
                      <strong>Первое обсуждение ещё не открыто.</strong>
                      <p>
                        Начните разговор о книге, авторе, переводе или
                        экранизации.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {message && <p className="community-message">{message}</p>}
      </section>
    </div>
  );
}
