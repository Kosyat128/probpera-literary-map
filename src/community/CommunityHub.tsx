import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "../lib/supabase";
import type { Country } from "../data/countries";
import { useReadingLibrary } from "../hooks/useReadingLibrary";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { articlePath } from "../utils/articleRoutes";
import BrandHeartIcon from "../components/BrandHeartIcon";
import BrandCloseIcon from "../components/BrandCloseIcon";
import { useAuth } from "./AuthContext";
import EditorialWorkbench from "./EditorialWorkbench";

export type CommunityView = "account" | "forum" | "admin";

type Props = {
  open: boolean;
  initialView?: CommunityView;
  countries?: Country[];
  onClose: () => void;
};

type ForumProfile = {
  display_name?: string;
  avatar_url?: string | null;
  reputation?: number;
};

type ForumTopic = {
  id: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
  author_id: string;
  score?: number;
  profiles?: ForumProfile | null;
  forum_replies?: Array<{ count: number }>;
};

type ForumReply = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  score?: number;
  profiles?: ForumProfile | null;
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
  kind: "topic" | "reply" | "comment";
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

type ForumReport = {
  id: string;
  subject_type: "topic" | "reply";
  subject_id: string;
  subject_title: string;
  subject_excerpt: string;
  reason: string;
  created_at: string;
};

const forumCategories = [
  {
    label: "Книжный клуб",
    description: "Совместное чтение и обсуждение книги месяца",
    symbol: "К",
  },
  {
    label: "Обсуждение книги",
    description: "Впечатления, вопросы и внимательный разбор текста",
    symbol: "О",
  },
  {
    label: "Классика",
    description: "Произведения, выдержавшие проверку временем",
    symbol: "К",
  },
  {
    label: "Современная литература",
    description: "Новые книги, авторы и литературные явления",
    symbol: "С",
  },
  {
    label: "Поэзия",
    description: "Стихи, поэтика, чтения и переводы",
    symbol: "П",
  },
  {
    label: "Переводы",
    description: "Сравнение переводов и разговор о языке",
    symbol: "Я",
  },
  {
    label: "Экранизации",
    description: "Книга и экран: находки, потери и интерпретации",
    symbol: "Э",
  },
  {
    label: "Литературная карта",
    description: "Страны, писатели и маршруты мировой литературы",
    symbol: "М",
  },
  {
    label: "Подборки читателей",
    description: "Личные списки книг и тематические маршруты",
    symbol: "Б",
  },
  {
    label: "Вопрос редакции",
    description: "Предложения, уточнения и темы для материалов",
    symbol: "Р",
  },
];

const categories = forumCategories.map((category) => category.label);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function pluralRu(count: number, forms: [string, string, string]) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function ForumAuthor({ profile }: { profile?: ForumProfile | null }) {
  const name = profile?.display_name || "Читатель";
  return (
    <span className="forum-author">
      <span className="forum-author-avatar" aria-hidden="true">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" loading="lazy" />
        ) : (
          name.slice(0, 1).toLocaleUpperCase("ru")
        )}
      </span>
      <span>
        <strong>{name}</strong>
        <small>{profile?.reputation || 0} репутации</small>
      </span>
    </span>
  );
}

export default function CommunityHub({
  open,
  initialView = "account",
  countries = [],
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
  const [forumCategoryFilter, setForumCategoryFilter] = useState("all");
  const [forumQuery, setForumQuery] = useState("");
  const [forumSort, setForumSort] = useState<"new" | "popular" | "active">("new");
  const [replyBody, setReplyBody] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [profileBio, setProfileBio] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileReputation, setProfileReputation] = useState(0);
  const [favoriteCountryCodes, setFavoriteCountryCodes] = useState<string[]>([]);
  const [favoriteWriterIds, setFavoriteWriterIds] = useState<string[]>([]);
  const [favoriteCountryDraft, setFavoriteCountryDraft] = useState("");
  const [favoriteWriterDraft, setFavoriteWriterDraft] = useState("");
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
  const [forumReports, setForumReports] = useState<ForumReport[]>([]);
  const {
    items: savedReadings,
    remove: removeSavedReading,
    setStatus: setReadingStatus,
  } = useReadingLibrary();
  const {
    items: subscriptions,
    toggle: toggleSubscription,
  } = useSubscriptions();

  const isModerator = ["moderator", "editor", "admin"].includes(role);

  useEffect(() => {
    const client = supabase;
    if (!client || !user) {
      setProfileBio("");
      setProfileAvatarUrl("");
      setProfileReputation(0);
      setFavoriteCountryCodes([]);
      setFavoriteWriterIds([]);
      return;
    }

    let active = true;
    const loadProfile = async () => {
      const basic = await client
        .from("profiles")
        .select("avatar_url,bio")
        .eq("id", user.id)
        .single();
      if (!active) return;
      setProfileAvatarUrl(basic.data?.avatar_url || "");
      setProfileBio(basic.data?.bio || "");

      const extended = await client
        .from("profiles")
        .select("reputation,favorite_country_codes,favorite_writer_ids")
        .eq("id", user.id)
        .single();
      if (!active || extended.error || !extended.data) return;
      setProfileReputation(Number(extended.data.reputation || 0));
      setFavoriteCountryCodes(extended.data.favorite_country_codes || []);
      setFavoriteWriterIds(extended.data.favorite_writer_ids || []);
    };
    void loadProfile();
    return () => {
      active = false;
    };
  }, [user]);

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
    const modernResult = await supabase
      .from("forum_topics")
      .select(
        "id,title,body,category,created_at,author_id,score,profiles(display_name,avatar_url,reputation),forum_replies(count)"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(30);
    let topicData: unknown = modernResult.data;
    let topicError = modernResult.error;

    if (topicError?.message.toLocaleLowerCase("ru").includes("score")) {
      const legacyResult = await supabase
        .from("forum_topics")
        .select(
          "id,title,body,category,created_at,author_id,profiles(display_name,avatar_url),forum_replies(count)"
        )
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(30);
      topicData = legacyResult.data;
      topicError = legacyResult.error;
    }

    if (topicError) {
      setMessage("Не удалось загрузить обсуждения. Проверьте схему сообщества.");
      return;
    }
    setTopics((topicData || []) as ForumTopic[]);
  }, []);

  const loadReplies = useCallback(async (topicId: string) => {
    if (!supabase) return;
    const modernResult = await supabase
      .from("forum_replies")
      .select("id,body,created_at,author_id,score,profiles(display_name,avatar_url,reputation)")
      .eq("topic_id", topicId)
      .eq("status", "published")
      .order("created_at", { ascending: true });
    let replyData: unknown = modernResult.data;
    let replyError = modernResult.error;

    if (replyError?.message.toLocaleLowerCase("ru").includes("score")) {
      const legacyResult = await supabase
        .from("forum_replies")
        .select("id,body,created_at,author_id,profiles(display_name,avatar_url)")
        .eq("topic_id", topicId)
        .eq("status", "published")
        .order("created_at", { ascending: true });
      replyData = legacyResult.data;
      replyError = legacyResult.error;
    }
    if (replyError) {
      setMessage("Не удалось загрузить ответы.");
      return;
    }
    setReplies((replyData || []) as ForumReply[]);
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

  useEffect(() => {
    if (!open || view !== "forum" || !configured || !selectedTopic || !supabase) {
      return;
    }
    const client = supabase;
    const channel = client
      .channel(`forum-thread-${selectedTopic.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "forum_replies",
          filter: `topic_id=eq.${selectedTopic.id}`,
        },
        () => void loadReplies(selectedTopic.id)
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [configured, loadReplies, open, selectedTopic, view]);

  const loadDashboard = useCallback(async () => {
    if (!supabase || !isModerator) return;

    const [
      readers,
      topics,
      comments,
      ratings,
      views,
      reports,
      forumReportCount,
      recentTopics,
      recentReplies,
      recentComments,
      recentReports,
      recentForumReports,
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
        .from("forum_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("forum_topics")
        .select("id,title,body,status,created_at,profiles(display_name)")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("forum_replies")
        .select("id,body,status,created_at,profiles(display_name)")
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
      supabase
        .from("forum_reports")
        .select(
          "id,subject_type,subject_id,subject_title,subject_excerpt,reason,created_at"
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
      reports: (reports.count || 0) + (forumReportCount.count || 0),
    });

    setModerationItems(
      [
        ...((recentTopics.data || []).map((item) => ({
          ...item,
          kind: "topic" as const,
        })) as unknown as ModerationItem[]),
        ...((recentReplies.data || []).map((item) => ({
          ...item,
          kind: "reply" as const,
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
    setForumReports(
      (recentForumReports.data || []) as unknown as ForumReport[]
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

  const filteredTopics = useMemo(
    () => {
      const query = forumQuery.trim().toLocaleLowerCase("ru");
      const result = topics.filter((topic) => {
        const categoryMatches =
          forumCategoryFilter === "all" || topic.category === forumCategoryFilter;
        const queryMatches =
          !query ||
          `${topic.title} ${topic.body} ${topic.profiles?.display_name || ""}`
            .toLocaleLowerCase("ru")
            .includes(query);
        return categoryMatches && queryMatches;
      });
      return [...result].sort((first, second) => {
        if (forumSort === "popular") {
          return (second.score || 0) - (first.score || 0);
        }
        if (forumSort === "active") {
          return (
            (second.forum_replies?.[0]?.count || 0) -
            (first.forum_replies?.[0]?.count || 0)
          );
        }
        return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
      });
    },
    [forumCategoryFilter, forumQuery, forumSort, topics]
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    topics.forEach((topic) => {
      counts.set(topic.category, (counts.get(topic.category) || 0) + 1);
    });
    return counts;
  }, [topics]);

  const favoriteWriterOptions = useMemo(() => {
    const selectedCountry = countries.find(
      (country) =>
        (country.code || country.id) === favoriteCountryDraft ||
        country.id === favoriteCountryDraft
    );
    if (!selectedCountry) return [];
    return selectedCountry.writers
      .map((writer) => ({
        value: `${selectedCountry.id}:${writer.id}`,
        label: writer.name || writer.fullName || "Автор",
      }))
      .sort((first, second) => first.label.localeCompare(second.label, "ru"));
  }, [countries, favoriteCountryDraft]);

  const countryOptions = useMemo(
    () => [...countries].sort((first, second) => first.name.localeCompare(second.name, "ru")),
    [countries]
  );

  const favoriteCountryLabel = useCallback(
    (code: string) => {
      const country = countries.find(
        (item) => (item.code || item.id) === code || item.id === code
      );
      return country?.name || code;
    },
    [countries]
  );

  const favoriteWriterLabel = useCallback(
    (identity: string) => {
      const separator = identity.indexOf(":");
      const countryId = separator >= 0 ? identity.slice(0, separator) : "";
      const writerId = separator >= 0 ? identity.slice(separator + 1) : identity;
      const country = countries.find((item) => item.id === countryId);
      const writer = country?.writers.find((item) => item.id === writerId);
      return writer?.name || writer?.fullName || writerId;
    },
    [countries]
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

  const voteForumItem = async (
    subjectType: "topic" | "reply",
    subjectId: string,
    score: -1 | 1
  ) => {
    if (!supabase || !user) {
      setView("account");
      setMessage("Войдите, чтобы оценивать обсуждения.");
      return;
    }
    setBusy(true);
    setMessage("");
    const result = await supabase.rpc("vote_forum_item", {
      p_subject_type: subjectType,
      p_subject_id: subjectId,
      p_score: score,
    });
    setBusy(false);
    if (result.error) {
      setMessage(
        result.error.code === "42883"
          ? "Обновите схему сообщества: модуль оценок форума ещё не установлен."
          : "Оценку не удалось сохранить. Попробуйте ещё раз."
      );
      return;
    }
    const nextScore = Number(result.data || 0);
    if (subjectType === "topic") {
      setSelectedTopic((current) =>
        current?.id === subjectId ? { ...current, score: nextScore } : current
      );
      setTopics((current) =>
        current.map((topic) =>
          topic.id === subjectId ? { ...topic, score: nextScore } : topic
        )
      );
    } else {
      setReplies((current) =>
        current.map((reply) =>
          reply.id === subjectId ? { ...reply, score: nextScore } : reply
        )
      );
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!supabase || !user || !file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage("Используйте изображение JPG, PNG или WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage("Размер аватара не должен превышать 2 МБ.");
      return;
    }
    setBusy(true);
    setMessage("");
    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    const path = `${user.id}/avatar.${extension}`;
    const uploaded = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });
    if (uploaded.error) {
      setBusy(false);
      setMessage("Аватар не загрузился. Проверьте миграцию хранилища профилей.");
      return;
    }
    const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data
      .publicUrl;
    const updated = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setBusy(false);
    if (updated.error) {
      setMessage("Изображение загружено, но профиль не обновился.");
      return;
    }
    setProfileAvatarUrl(`${publicUrl}?v=${Date.now()}`);
    setMessage("Аватар обновлён.");
  };

  const saveReaderProfile = async () => {
    if (!supabase || !user) return;
    setBusy(true);
    setMessage("");
    const basic = await supabase
      .from("profiles")
      .update({
        avatar_url: profileAvatarUrl.split("?v=")[0],
        bio: profileBio.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (basic.error) {
      setBusy(false);
      setMessage("Профиль не удалось сохранить.");
      return;
    }
    const extended = await supabase
      .from("profiles")
      .update({
        favorite_country_codes: favoriteCountryCodes,
        favorite_writer_ids: favoriteWriterIds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setBusy(false);
    setMessage(
      extended.error
        ? "Биография сохранена. Для подборок примените новую миграцию профиля."
        : "Профиль и литературные интересы сохранены."
    );
  };

  const addFavoriteCountry = () => {
    if (!favoriteCountryDraft || favoriteCountryCodes.length >= 8) return;
    setFavoriteCountryCodes((current) =>
      current.includes(favoriteCountryDraft)
        ? current
        : [...current, favoriteCountryDraft]
    );
  };

  const addFavoriteWriter = () => {
    if (!favoriteWriterDraft || favoriteWriterIds.length >= 12) return;
    setFavoriteWriterIds((current) =>
      current.includes(favoriteWriterDraft)
        ? current
        : [...current, favoriteWriterDraft]
    );
    setFavoriteWriterDraft("");
  };

  const moderate = async (
    item: ModerationItem,
    status: "published" | "hidden"
  ) => {
    if (!supabase || !isModerator) return;
    setBusy(true);
    const table =
      item.kind === "topic"
        ? "forum_topics"
        : item.kind === "reply"
          ? "forum_replies"
          : "article_comments";
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

  const reportForumItem = async (
    subjectType: "topic" | "reply",
    subjectId: string
  ) => {
    if (!supabase || !user) {
      setView("account");
      setMessage("Войдите, чтобы передать публикацию модератору.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("report_forum_item", {
      p_subject_type: subjectType,
      p_subject_id: subjectId,
      p_reason: "Пользователь просит редакцию проверить эту публикацию форума.",
    });
    setBusy(false);
    setMessage(
      error
        ? "Жалобу не удалось отправить. Проверьте миграцию модерации форума."
        : "Публикация передана редактору на проверку."
    );
  };

  const resolveForumReport = async (reportId: string, hideItem: boolean) => {
    if (!supabase || !isModerator) return;
    setBusy(true);
    const { error } = await supabase.rpc("resolve_forum_report", {
      p_report_id: reportId,
      p_hide_item: hideItem,
    });
    setBusy(false);
    if (error) {
      setMessage("Не удалось обработать жалобу форума.");
      return;
    }
    setMessage(
      hideItem
        ? "Публикация форума скрыта, жалоба закрыта."
        : "Публикация оставлена, жалоба закрыта."
    );
    await loadDashboard();
  };

  const readingLibrary = (
    <section className="account-library">
      <header>
        <div>
          <span className="section-kicker">Моя библиотека</span>
          <h3>
            <BrandHeartIcon filled />
            Сохранённые материалы
          </h3>
        </div>
        <strong>{savedReadings.length}</strong>
      </header>
      {savedReadings.length ? (
        <div>
          {savedReadings.map((item) => (
            <article key={`${item.kind}:${item.id}`}>
              <a
                href={
                  item.href ||
                  articlePath(item.id, item.title, item.sectionId)
                }
                onClick={item.kind === "book" ? onClose : undefined}
              >
                <small>
                  {item.kind === "book" ? "Книга · " : ""}
                  {item.sectionLabel}
                </small>
                <strong>{item.title}</strong>
              </a>
              <div className="library-actions">
                <label>
                  <span className="sr-only">Статус «{item.title}»</span>
                  <select
                    value={item.status}
                    aria-label={`Статус чтения «${item.title}»`}
                    onChange={(event) =>
                      setReadingStatus(
                        item.id,
                        item.kind,
                        event.target.value as typeof item.status
                      )
                    }
                  >
                    <option value="saved">Хочу прочитать</option>
                    <option value="reading">Читаю</option>
                    <option value="finished">Прочитано</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => removeSavedReading(item.id, item.kind)}
                  aria-label={`Удалить «${item.title}» из библиотеки`}
                >
                  <BrandHeartIcon filled />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p>
          Нажмите оранжевое сердце у статьи или книги — материал появится здесь.
        </p>
      )}
      <aside className="subscription-summary">
        <header>
          <span className="section-kicker">Литературная траектория</span>
          <strong>{subscriptions.length}</strong>
        </header>
        <p>
          Страны и писатели, новые материалы о которых вы хотите отслеживать.
        </p>
        {subscriptions.length ? (
          <div>
            {subscriptions.map((item) => (
              <button
                key={`${item.type}:${item.id}`}
                type="button"
                title={`Отменить подписку «${item.label}»`}
                onClick={() =>
                  toggleSubscription({
                    type: item.type,
                    id: item.id,
                    label: item.label,
                  })
                }
              >
                <span>
                  {item.type === "country"
                    ? "Страна"
                    : item.type === "writer"
                      ? "Писатель"
                      : "Раздел"}
                </span>
                {item.label} <i aria-hidden="true">×</i>
              </button>
            ))}
          </div>
        ) : (
          <small>Подписки добавляются в карточках стран и писателей.</small>
        )}
      </aside>
    </section>
  );

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
              <strong id="community-title">
                {view === "forum"
                  ? "Говорилка — форум «Проба Пера»"
                  : view === "admin"
                    ? "Редакция «Пробы Пера»"
                    : "Личный кабинет «Пробы Пера»"}
              </strong>
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <BrandCloseIcon />
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

            <div className="report-queue">
              <header>
                <div>
                  <span className="section-kicker">Форум</span>
                  <h3>Жалобы на темы и ответы</h3>
                </div>
                <span>{forumReports.length}</span>
              </header>
              {forumReports.length ? (
                forumReports.map((report) => (
                  <article key={report.id}>
                    <div>
                      <small>
                        {report.subject_type === "topic" ? "Тема" : "Ответ"} ·{" "}
                        {formatDate(report.created_at)}
                      </small>
                      <strong>{report.subject_title}</strong>
                      <p>{report.subject_excerpt}</p>
                      <em>{report.reason}</em>
                    </div>
                    <div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void resolveForumReport(report.id, false)}
                      >
                        Оставить
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void resolveForumReport(report.id, true)}
                      >
                        Скрыть
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p>Открытых жалоб на форум нет.</p>
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
                        {item.kind === "topic"
                          ? "Тема форума"
                          : item.kind === "reply"
                            ? "Ответ форума"
                            : "Комментарий"} ·{" "}
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
                <span className="section-kicker">Литературное сообщество</span>
                <h2>Читайте глубже. Обсуждайте уважительно.</h2>
                <p>
                  Один профиль связывает ваши оценки, комментарии, форум и
                  личную библиотеку внутри «Пробы Пера».
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
                <section className="reader-profile-editor">
                  <header>
                    <div className="reader-avatar">
                      {profileAvatarUrl ? (
                        <img src={profileAvatarUrl} alt={`Аватар ${readerName}`} />
                      ) : (
                        <span aria-hidden="true">
                          {readerName.slice(0, 1).toLocaleUpperCase("ru")}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="section-kicker">Профиль читателя</span>
                      <h3>{readerName}</h3>
                      <small>Репутация в клубе · {profileReputation}</small>
                    </div>
                    <label className="reader-avatar-upload">
                      <span>{busy ? "Загрузка…" : "Сменить аватар"}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy}
                        onChange={(event) =>
                          void uploadAvatar(event.target.files?.[0])
                        }
                      />
                    </label>
                  </header>
                  <label>
                    О себе
                    <textarea
                      value={profileBio}
                      maxLength={1000}
                      placeholder="Несколько слов о ваших читательских интересах"
                      onChange={(event) => setProfileBio(event.target.value)}
                    />
                    <small>{profileBio.length} / 1000</small>
                  </label>
                  <div className="reader-preferences">
                    <section>
                      <span>Любимые литературные страны</span>
                      <div>
                        <select
                          value={favoriteCountryDraft}
                          onChange={(event) => {
                            setFavoriteCountryDraft(event.target.value);
                            setFavoriteWriterDraft("");
                          }}
                        >
                          <option value="">Выберите страну</option>
                          {countryOptions.map((country) => (
                            <option
                              value={country.code || country.id}
                              key={country.id}
                            >
                              {country.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={
                            !favoriteCountryDraft ||
                            favoriteCountryCodes.includes(favoriteCountryDraft) ||
                            favoriteCountryCodes.length >= 8
                          }
                          onClick={addFavoriteCountry}
                        >
                          Добавить
                        </button>
                      </div>
                      <div className="reader-preference-chips">
                        {favoriteCountryCodes.map((code) => (
                          <button
                            type="button"
                            key={code}
                            onClick={() =>
                              setFavoriteCountryCodes((current) =>
                                current.filter((item) => item !== code)
                              )
                            }
                            title="Убрать из подборки"
                          >
                            {favoriteCountryLabel(code)} <span>×</span>
                          </button>
                        ))}
                      </div>
                    </section>
                    <section>
                      <span>Любимые писатели</span>
                      <div>
                        <select
                          value={favoriteWriterDraft}
                          disabled={!favoriteWriterOptions.length}
                          onChange={(event) =>
                            setFavoriteWriterDraft(event.target.value)
                          }
                        >
                          <option value="">
                            {favoriteCountryDraft
                              ? "Выберите писателя"
                              : "Сначала выберите страну"}
                          </option>
                          {favoriteWriterOptions.map((writer) => (
                            <option value={writer.value} key={writer.value}>
                              {writer.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={
                            !favoriteWriterDraft ||
                            favoriteWriterIds.includes(favoriteWriterDraft) ||
                            favoriteWriterIds.length >= 12
                          }
                          onClick={addFavoriteWriter}
                        >
                          Добавить
                        </button>
                      </div>
                      <div className="reader-preference-chips">
                        {favoriteWriterIds.map((identity) => (
                          <button
                            type="button"
                            key={identity}
                            onClick={() =>
                              setFavoriteWriterIds((current) =>
                                current.filter((item) => item !== identity)
                              )
                            }
                            title="Убрать из подборки"
                          >
                            {favoriteWriterLabel(identity)} <span>×</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                  <button
                    className="reader-profile-save"
                    type="button"
                    disabled={busy}
                    onClick={() => void saveReaderProfile()}
                  >
                    Сохранить профиль
                  </button>
                </section>
                {readingLibrary}
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
                <form
                  className="auth-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitAuth();
                  }}
                >
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
                  type="submit"
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
                </form>
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

            {!selectedTopic && (
              <>
                <nav className="forum-categories" aria-label="Разделы форума">
                  <button
                    className={forumCategoryFilter === "all" ? "is-active" : ""}
                    type="button"
                    onClick={() => setForumCategoryFilter("all")}
                  >
                    <span aria-hidden="true">✦</span>
                    <strong>Все обсуждения</strong>
                    <small>{topics.length}</small>
                  </button>
                  {forumCategories.map((category) => (
                    <button
                      className={
                        forumCategoryFilter === category.label ? "is-active" : ""
                      }
                      type="button"
                      key={category.label}
                      onClick={() => setForumCategoryFilter(category.label)}
                    >
                      <span aria-hidden="true">{category.symbol}</span>
                      <strong>{category.label}</strong>
                      <small>{categoryCounts.get(category.label) || 0}</small>
                      <em>{category.description}</em>
                    </button>
                  ))}
                </nav>
                <div className="forum-discovery-controls">
                  <label>
                    <span>Найти обсуждение</span>
                    <input
                      type="search"
                      value={forumQuery}
                      placeholder="Книга, автор, тема или читатель"
                      onChange={(event) => setForumQuery(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Порядок</span>
                    <select
                      value={forumSort}
                      onChange={(event) =>
                        setForumSort(event.target.value as typeof forumSort)
                      }
                    >
                      <option value="new">Сначала новые</option>
                      <option value="popular">По рейтингу</option>
                      <option value="active">По числу ответов</option>
                    </select>
                  </label>
                  <small>
                    Найдено: {filteredTopics.length} из {topics.length}
                  </small>
                </div>
              </>
            )}

            {selectedTopic ? (
              <div className="topic-thread">
                <article>
                  <ForumAuthor profile={selectedTopic.profiles} />
                  <small>
                    {selectedTopic.category} · {formatDate(selectedTopic.created_at)}
                  </small>
                  <p>{selectedTopic.body}</p>
                  <button
                    className="forum-report-button"
                    type="button"
                    disabled={busy || user?.id === selectedTopic.author_id}
                    onClick={() =>
                      void reportForumItem("topic", selectedTopic.id)
                    }
                  >
                    Передать модератору
                  </button>
                  <div className="forum-vote" aria-label="Оценка обсуждения">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void voteForumItem("topic", selectedTopic.id, 1)
                      }
                      aria-label="Поддержать обсуждение"
                    >
                      ↑
                    </button>
                    <strong>{selectedTopic.score || 0}</strong>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void voteForumItem("topic", selectedTopic.id, -1)
                      }
                      aria-label="Снизить оценку обсуждения"
                    >
                      ↓
                    </button>
                  </div>
                </article>
                <div className="thread-replies">
                  {replies.map((reply) => (
                    <article key={reply.id}>
                      <header>
                        <ForumAuthor profile={reply.profiles} />
                        <small>{formatDate(reply.created_at)}</small>
                      </header>
                      <p>{reply.body}</p>
                      <button
                        className="forum-report-button"
                        type="button"
                        disabled={busy || user?.id === reply.author_id}
                        onClick={() => void reportForumItem("reply", reply.id)}
                      >
                        Передать модератору
                      </button>
                      <div className="forum-vote" aria-label="Оценка ответа">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void voteForumItem("reply", reply.id, 1)
                          }
                          aria-label="Полезный ответ"
                        >
                          ↑
                        </button>
                        <strong>{reply.score || 0}</strong>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void voteForumItem("reply", reply.id, -1)
                          }
                          aria-label="Снизить оценку ответа"
                        >
                          ↓
                        </button>
                      </div>
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
                      aria-label="Раздел форума"
                      value={topicCategory}
                      onChange={(event) => setTopicCategory(event.target.value)}
                    >
                      {categories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                    <input
                      aria-label="Название обсуждения"
                      value={topicTitle}
                      onChange={(event) => setTopicTitle(event.target.value)}
                      placeholder="Название обсуждения"
                      maxLength={140}
                    />
                    <textarea
                      aria-label="Текст обсуждения"
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
                  {filteredTopics.length ? (
                    filteredTopics.map((topic) => (
                      <button
                        type="button"
                        key={topic.id}
                        onClick={() => setSelectedTopic(topic)}
                      >
                        <span>{topic.category}</span>
                        <strong>{topic.title}</strong>
                        <p>{topic.body}</p>
                        <footer>
                          <ForumAuthor profile={topic.profiles} />
                          <small>
                            {formatDate(topic.created_at)} ·{" "}
                            {topic.forum_replies?.[0]?.count || 0}{" "}
                            {pluralRu(topic.forum_replies?.[0]?.count || 0, [
                              "ответ",
                              "ответа",
                              "ответов",
                            ])}{" "}
                            · рейтинг {topic.score || 0}
                          </small>
                        </footer>
                      </button>
                    ))
                  ) : (
                    <div className="forum-empty">
                      <strong>Первое обсуждение ещё не открыто.</strong>
                      <p>
                        {forumCategoryFilter === "all"
                          ? forumQuery.trim()
                            ? "Измените запрос или выберите другой раздел форума."
                            : "Начните разговор о книге, авторе, переводе или экранизации."
                          : "В этой ветке пока нет тем. Откройте первое содержательное обсуждение."}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {message && (
          <p className="community-message" role="status" aria-live="polite">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
