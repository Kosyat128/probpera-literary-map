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

    setComments((commentsResult.data || []) as unknown as Comment[]);
    const summary = ratingResult.data?.[0];
    setRatingCount(Number(summary?.rating_count || 0));
    setAverage(Number(summary?.average_score || 0));
    setUserRating(Number(summary?.my_score || 0));
  }, [articleSlug, compact, subjectType]);

  useEffect(() => {
    if (!configured) return;
    void loadEngagement();
  }, [configured, loadEngagement]);

  const rate = async (score: number) => {
    if (!supabase) return;
    setBusy(true);
    await supabase.rpc("rate_content", {
      p_subject_type: subjectType,
      p_subject_id: articleSlug,
      p_score: score,
      p_session_id: getCommunitySessionId(),
    });
    setBusy(false);
    await loadEngagement();
  };

  const submitComment = async () => {
    if (!supabase || !commentBody.trim()) return;
    if (!user && guestName.trim().length < 2) return;
    setBusy(true);
    await supabase.from("article_comments").insert({
      article_slug: articleSlug,
      author_id: user?.id || null,
      guest_name: user ? null : guestName.trim(),
      session_id: getCommunitySessionId(),
      body: commentBody.trim(),
    });
    setCommentBody("");
    setBusy(false);
    await loadEngagement();
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
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Ваше имя"
              maxLength={80}
            />
          )}
          <textarea
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            placeholder="Ваш комментарий к материалу"
            maxLength={4000}
          />
          <button
            type="button"
            disabled={
              busy ||
              !commentBody.trim() ||
              (!user && guestName.trim().length < 2)
            }
            onClick={() => void submitComment()}
          >
            Опубликовать комментарий
          </button>
        </div>
      )}

      <div className="comment-list">
        {comments.map((comment) => (
          <article key={comment.id}>
            <strong>
              {comment.profiles?.display_name ||
                comment.guest_name ||
                "Читатель"}
            </strong>
            <p>{comment.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
