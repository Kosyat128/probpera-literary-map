import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { loadSupabaseClient } from "../lib/loadSupabaseClient";
import { readWebStorage, writeWebStorage } from "../utils/safeWebStorage";
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

function pluralRu(count: number, forms: [string, string, string]) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function formatCommentDate(value: string, language: "ru" | "en") {
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-GB", {
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
  const { language, t, number } = useInterfaceLanguage();
  const isBook = subjectType === "book";
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [guestName, setGuestName] = useState("");
  const [ratingCount, setRatingCount] = useState(0);
  const [average, setAverage] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const engagementIdentity = `${subjectType}:${articleSlug}:${compact ? "compact" : "full"}`;
  const activeEngagementIdentityRef = useRef<string | null>(engagementIdentity);
  const engagementLoadSequenceRef = useRef(0);
  activeEngagementIdentityRef.current = engagementIdentity;

  const loadEngagement = useCallback(async () => {
    const requestIdentity = engagementIdentity;
    if (activeEngagementIdentityRef.current !== requestIdentity) return;
    const requestSequence = ++engagementLoadSequenceRef.current;
    const isCurrentRequest = () =>
      activeEngagementIdentityRef.current === requestIdentity &&
      engagementLoadSequenceRef.current === requestSequence;
    const client = await loadSupabaseClient();
    if (!client || !isCurrentRequest()) return;
    const [commentsResult, ratingResult] = await Promise.all([
      client
        .from("article_comments")
        .select("id,body,created_at,guest_name,profiles(display_name)")
        .eq("article_slug", articleSlug)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(compact ? 3 : 50),
      client.rpc("get_rating_summary", {
        p_subject_type: subjectType,
        p_subject_id: articleSlug,
        p_session_id: getCommunitySessionId(),
      }),
    ]);
    if (!isCurrentRequest()) return;

    if (commentsResult.error || ratingResult.error) {
      setMessage(t("Не удалось обновить обсуждение. Попробуйте ещё раз."));
      return;
    }

    setComments((commentsResult.data || []) as unknown as Comment[]);
    const summary = ratingResult.data?.[0];
    setRatingCount(Number(summary?.rating_count || 0));
    setAverage(Number(summary?.average_score || 0));
    setUserRating(Number(summary?.my_score || 0));
  }, [articleSlug, compact, engagementIdentity, subjectType, t]);

  useEffect(() => {
    if (!configured) return;
    activeEngagementIdentityRef.current = engagementIdentity;
    let active = true;
    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    void loadEngagement();
    void loadSupabaseClient().then((loadedClient) => {
      if (!active || !loadedClient) return;
      client = loadedClient;
      channel = client
        .channel(`article-engagement-${articleSlug}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "article_comments",
            filter: `article_slug=eq.${articleSlug}`,
          },
          () => {
            if (active) void loadEngagement();
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ratings" },
          () => {
            if (active) void loadEngagement();
          }
        )
        .subscribe();
    });

    return () => {
      active = false;
      engagementLoadSequenceRef.current += 1;
      if (activeEngagementIdentityRef.current === engagementIdentity) {
        activeEngagementIdentityRef.current = null;
      }
      if (channel && client) void client.removeChannel(channel);
    };
  }, [configured, engagementIdentity, loadEngagement]);

  const rate = async (score: number) => {
    const client = await loadSupabaseClient();
    if (!client) return;
    setBusy(true);
    setMessage("");
    const { error } = await client.rpc("rate_content", {
      p_subject_type: subjectType,
      p_subject_id: articleSlug,
      p_score: score,
      p_session_id: getCommunitySessionId(),
    });
    setBusy(false);
    if (error) {
      setMessage(t("Оценку не удалось сохранить. Попробуйте ещё раз."));
      return;
    }
    setMessage(t("Спасибо - ваша оценка сохранена."));
    await loadEngagement();
  };

  const submitComment = async () => {
    if (!commentBody.trim()) return;
    const client = await loadSupabaseClient();
    if (!client) return;
    if (!user && guestName.trim().length < 2) return;
    setBusy(true);
    setMessage("");
    const { error } = await client.rpc("submit_article_comment", {
      p_article_slug: articleSlug,
      p_session_id: getCommunitySessionId(),
      p_body: commentBody.trim(),
      p_guest_name: user ? null : guestName.trim(),
      p_parent_id: null,
    });

    setBusy(false);
    if (error) {
      setMessage(
        error.message.includes("Too many comments")
          ? t("Слишком много сообщений подряд. Подождите несколько минут.")
          : t(
              "Комментарий не удалось опубликовать. Проверьте текст и повторите."
            )
      );
      return;
    }
    if (!user) {
      writeWebStorage("local", "probpera-guest-name", guestName.trim());
    }
    setCommentBody("");
    setMessage(t("Комментарий опубликован."));
    await loadEngagement();
  };

  useEffect(() => {
    if (user || guestName) return;
    setGuestName(readWebStorage("local", "probpera-guest-name") || "");
  }, [guestName, user]);

  const reportComment = async (commentId: string) => {
    const client = await loadSupabaseClient();
    if (!client) return;
    setMessage("");
    const { error } = await client.rpc("report_article_comment", {
      p_comment_id: commentId,
      p_session_id: getCommunitySessionId(),
      p_reason: "Проверить содержание комментария",
    });
    setMessage(
      error
        ? t("Не удалось отправить жалобу.")
        : t("Спасибо. Комментарий передан редакции на проверку.")
    );
  };

  if (!configured) {
    return (
      <div className="engagement-card is-pending">
        <span>★</span>
        <p>
          {t(
            "Открытые рейтинги и встроенные комментарии готовы и включатся после подключения серверной базы проекта."
          )}
        </p>
      </div>
    );
  }

  return (
    <section className={`engagement-card${compact ? " is-compact" : ""}`}>
      <header className="engagement-heading">
        <div>
          <span className="section-kicker">
            {isBook ? t("Обсуждение книги") : t("Обсуждение публикации")}
          </span>
          <h3>{isBook ? t("Мнение о книге") : t("Мнение читателей")}</h3>
        </div>
        <span>
          {number(comments.length)}{" "}
          {language === "en"
            ? comments.length === 1
              ? "comment"
              : "comments"
            : pluralRu(comments.length, [
                "комментарий",
                "комментария",
                "комментариев",
              ])}
        </span>
      </header>
      <div className="rating-summary">
        <span>
          <strong>{average ? average.toFixed(1) : "-"}</strong>
          <small>
            {number(ratingCount)}{" "}
            {language === "en"
              ? ratingCount === 1
                ? "rating"
                : "ratings"
              : pluralRu(ratingCount, ["оценка", "оценки", "оценок"])}
          </small>
        </span>
        <div aria-label={isBook ? t("Оценить книгу") : t("Оценить публикацию")}>
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              className={score <= userRating ? "is-active" : ""}
              type="button"
              key={score}
              disabled={busy}
              onClick={() => void rate(score)}
              aria-label={
                language === "en" ? `${score} out of 5` : `${score} из 5`
              }
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
              <span>{t("Имя или никнейм")}</span>
              <input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder={t("Как к вам обращаться")}
                minLength={2}
                maxLength={80}
              />
            </label>
          )}
          <label>
            <span>{t("Комментарий")}</span>
            <textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder={
                isBook
                  ? t("Поделитесь впечатлением о книге")
                  : t("Поделитесь впечатлением о материале")
              }
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
            {busy ? t("Публикуем…") : t("Опубликовать комментарий")}
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
                    t("Читатель")}
                </strong>
                <time dateTime={comment.created_at}>
                  {formatCommentDate(comment.created_at, language)}
                </time>
              </header>
              <p>{comment.body}</p>
              {!compact && (
                <button
                  type="button"
                  onClick={() => void reportComment(comment.id)}
                >
                  {t("Пожаловаться редакции")}
                </button>
              )}
            </article>
          ))
        ) : (
          !compact && (
            <div className="comment-empty">
              <strong>{t("Начните содержательный разговор")}</strong>
              <p>{t("Первый комментарий может оставить любой читатель.")}</p>
            </div>
          )
        )}
      </div>
    </section>
  );
}
