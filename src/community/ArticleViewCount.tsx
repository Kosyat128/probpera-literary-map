import { useCallback, useEffect, useMemo, useState } from "react";

import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

type Props = {
  currentPath: string;
  legacyPath?: string | null;
};

const legacyGithubPrefix = "/probpera-literary-map";

function normalizePath(value: string) {
  let path = value;
  try {
    path = new URL(value, "https://probpera.ru").pathname;
  } catch {
    path = value.split(/[?#]/u)[0] || "/";
  }
  if (path === legacyGithubPrefix || path.startsWith(`${legacyGithubPrefix}/`)) {
    path = path.slice(legacyGithubPrefix.length) || "/";
  }
  return path.replace(/\/{2,}/gu, "/").replace(/\/+$/u, "") || "/";
}

function viewPathVariants(...values: Array<string | null | undefined>) {
  const variants = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const path = normalizePath(value);
    const trailing = path === "/" ? "/" : `${path}/`;
    variants.add(path);
    variants.add(trailing);
    variants.add(`${legacyGithubPrefix}${path}`);
    variants.add(`${legacyGithubPrefix}${trailing}`);
  }
  return [...variants];
}

export default function ArticleViewCount({ currentPath, legacyPath }: Props) {
  const { configured } = useAuth();
  const { t, number } = useInterfaceLanguage();
  const [views, setViews] = useState<number | null>(null);
  const paths = useMemo(
    () => viewPathVariants(currentPath, legacyPath),
    [currentPath, legacyPath]
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("get_content_view_count", {
      p_paths: paths,
    });
    if (!error) setViews(Number(data || 0));
  }, [paths]);

  useEffect(() => {
    setViews(null);
    if (!configured) return;
    void load();
    window.addEventListener("probpera:page-view-recorded", load);
    return () => window.removeEventListener("probpera:page-view-recorded", load);
  }, [configured, load]);

  return (
    <span className="article-view-metric">
      <strong>{views === null ? "-" : number(views)}</strong>
      {t("просмотров")}
    </span>
  );
}
