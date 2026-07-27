import { useCallback, useEffect, useState } from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { getCommunitySessionId } from "./sessionIdentity";

type Props = {
  articleSlug: string;
  subjectType?: "article" | "book";
  compact?: boolean;
};

type Comment = {
  id: string;
  body: string;
  created_at: string;
  guest_name?: string | null;
  profiles?: { display_name?: string } | null;
};

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ArticleEngagement({
  articleSlug,
  subjectType = "article",
  compact = false,
}: Props) {
  const { configured, user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [guestName, setGuestName] = useState("");
  const [ratingCount, setRatingCount] = useState(0);
  const [average, setAverage] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadEngagement = useCallback(async () => {
    if (!supabase) return;
    const [commentsResult, ratingResult] = await Promise.all([
      supabase
        .from("article_comments")
        .select("id,body,created_at,guest_name,profiles(display_name)")
        .eq("article_slug", articleSlug)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(compact ? 3 : 50),
      supabase.rpc("get_rating_summary", {
        p_subject_type: subjectType,
        p_subject_id: articleSlug,
        p_session_id: getCommunitySessionId(),
      }),
    ]);

    if (commentsResult.error || ratingResult.error) {
      setMessage("Не удалось обновить обсуждение. Попробуйте ещё раз.");
      return;
    }

    setComments((commentsResult.data || []) as unknown as Comment[]);
    const summary = ratingResult.data?.[0];
    setRatingCount(Number(summary?.rating_count || 0));
    setAverage(Number(summary?.average_score || 0));
    setUserRating(Number(summary?.my_score || 0));
  }, [articleSlug, compact, subjectType]);

  useEffect(() => {
    if (!configured) return;
    void loadEngagement();
    const channel = supabase
      ?.channel(`article-engagement-${articleSlug}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "article_comments",
          filter: `article_slug=eq.${articleSlug}`,
        },
        () => void loadEngagement()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ratings" },
        () => void loadEngagement()
      )
      .subscribe();

    return () => {
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [configured, loadEngagement]);

  const rate = async (score: number) => {
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("rate_content", {
      p_subject_type: subjectType,
      p_subject_id: articleSlug,
      p_score: score,
      p_session_id: getCommunitySessionId(),
    });
    setBusy(false);
    if (error) {
      setMessage("Оценку не удалось сохранить. Попробуйте ещё раз.");
      return;
    }
    setMessage("Спасибо — ваша оценка сохранена.");
    await loadEngagement();
  };

  const submitComment = async () => {
    if (!supabase || !commentBody.trim()) return;
    if (!user && guestName.trim().length < 2) return;
    setBusy(true);
    setMessage("");
    const payload = {
      p_article_slug: articleSlug,
      p_session_id: getCommunitySessionId(),
      p_body: commentBody.trim(),
      p_guest_name: user ? null : guestName.trim(),
      p_parent_id: null,
    };
    let { error } = await supabase.rpc("submit_article_comment", payload);

    // Совместимость с базой, созданной до появления защищённой RPC-функции.
    if (error?.code === "42883") {
      const fallback = await supabase.from("article_comments").insert({
        article_slug: articleSlug,
        author_id: user?.id || null,
        guest_name: user ? null : guestName.trim(),
        session_id: getCommunitySessionId(),
        body: commentBody.trim(),
      });
      error = fallback.error;
    }

    setBusy(false);
    if (error) {
      setMessage(
        error.message.includes("Too many comments")
          ? "Слишком много сообщений подряд. Подождите несколько минут."
          : "Комментарий не удалось опубликовать. Проверьте текст и повторите."
      );
      return;
    }
    if (!user) {
      window.localStorage.setItem("probpera-guest-name", guestName.trim());
    }
    setCommentBody("");
    setMessage("Комментарий опубликован.");
    await loadEngagement();
  };

  useEffect(() => {
    if (user || guestName) return;
    setGuestName(window.localStorage.getItem("probpera-guest-name") || "");
  }, [guestName, user]);

  const reportComment = async (commentId: string) => {
    if (!supabase) return;
    setMessage("");
    const { error } = await supabase.rpc("report_article_comment", {
      p_comment_id: commentId,
      p_session_id: getCommunitySessionId(),
      p_reason: "Проверить содержание комментария",
    });
    setMessage(
      error
        ? "Не удалось отправить жалобу."
        : "Спасибо. Комментарий передан редакции на проверку."
    );
  };

  if (!configured) {
    return (
      <div className="engagement-card is-pending">
        <span>★</span>
        <p>
          Открытые рейтинги и встроенные комментарии готовы и включатся после
          подключения серверной базы проекта.
        </p>
      </div>
    );
  }

  return (
    <section className={`engagement-card${compact ? " is-compact" : ""}`}>
      <header className="engagement-heading">
        <div>
          <span className="section-kicker">Обсуждение публикации</span>
          <h3>Мнение читателей</h3>
        </div>
        <span>
          {comments.length} {comments.length === 1 ? "комментарий" : "комментариев"}
        </span>
      </header>
      <div className="rating-summary">
        <span>
          <strong>{average ? average.toFixed(1) : "—"}</strong>
          <small>{ratingCount} оценок</small>
        </span>
        <div aria-label="Оценить публикацию">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              className={score <= userRating ? "is-active" : ""}
              type="button"
              key={score}
              disabled={busy}
              onClick={() => void rate(score)}
              aria-label={`${score} из 5`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {!compact && (
        <div className="comment-form">
          {!user && (
            <label>
              <span>Имя или никнейм</span>
              <input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Как к вам обращаться"
                minLength={2}
                maxLength={80}
              />
            </label>
          )}
          <label>
            <span>Комментарий</span>
            <textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="Поделитесь впечатлением о материале"
              minLength={2}
              maxLength={4000}
            />
          </label>
          <small>{commentBody.length} / 4000</small>
          <button
            type="button"
            disabled={
              busy ||
              !commentBody.trim() ||
              (!user && guestName.trim().length < 2)
            }
            onClick={() => void submitComment()}
          >
            {busy ? "Публикуем…" : "Опубликовать комментарий"}
          </button>
        </div>
      )}

      {message && (
        <p className="engagement-message" role="status">
          {message}
        </p>
      )}

      <div className="comment-list">
        {comments.length ? (
          comments.map((comment) => (
            <article key={comment.id}>
              <header>
                <strong>
                  {comment.profiles?.display_name ||
                    comment.guest_name ||
                    "Читатель"}
                </strong>
                <time dateTime={comment.created_at}>
                  {formatCommentDate(comment.created_at)}
                </time>
              </header>
              <p>{comment.body}</p>
              {!compact && (
                <button
                  type="button"
                  onClick={() => void reportComment(comment.id)}
                >
                  Пожаловаться редакции
                </button>
              )}
            </article>
          ))
        ) : (
          !compact && (
            <div className="comment-empty">
              <strong>Начните содержательный разговор</strong>
              <p>Первый комментарий может оставить любой читатель.</p>
            </div>
          )
        )}
      </div>
    </section>
  );
}
