"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type {
  ArticleWorkspaceLocale,
  ArticleWorkspaceSection,
} from "@/lib/article-workspace-utils";

export type ArticleWorkspaceOutlineItem = {
  id: string;
  label: string;
  level: 2 | 3;
};

export type ArticleWorkspaceGuidanceItem = {
  label: string;
  locale: ArticleWorkspaceLocale;
  section: ArticleWorkspaceSection;
};

export type ArticleWorkspaceSnapshot = {
  locale: ArticleWorkspaceLocale;
  outline: ArticleWorkspaceOutlineItem[];
  missing: ArticleWorkspaceGuidanceItem[];
  metrics: {
    words: number;
    headings: number;
    images: number;
    readingMinutes: number;
  };
  ready: number;
  total: number;
  saveState: string;
  canSave: boolean;
  canPreview: boolean;
  canPublish: boolean;
};

export type ArticleWorkspaceActions = {
  save: () => void;
  preview: () => void;
  toggleFullscreen: () => void;
  publish: () => void;
  goToSection: (section: ArticleWorkspaceSection) => void;
  goToIssue: (issue: ArticleWorkspaceGuidanceItem) => void;
  goToHeading: (id: string) => void;
};

export type ArticleEditorWorkspace = {
  snapshot: ArticleWorkspaceSnapshot;
  actions: ArticleWorkspaceActions;
};

type RegisterWorkspace = (workspace: ArticleEditorWorkspace) => () => void;

const ArticleWorkspaceStateContext =
  createContext<ArticleEditorWorkspace | null>(null);
const ArticleWorkspaceRegistrationContext =
  createContext<RegisterWorkspace | null>(null);

export function ArticleEditorWorkspaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [workspace, setWorkspace] = useState<ArticleEditorWorkspace | null>(null);
  const registerWorkspace = useCallback<RegisterWorkspace>((nextWorkspace) => {
    setWorkspace(nextWorkspace);
    return () => {
      setWorkspace((currentWorkspace) =>
        currentWorkspace === nextWorkspace ? null : currentWorkspace
      );
    };
  }, []);

  return (
    <ArticleWorkspaceRegistrationContext.Provider value={registerWorkspace}>
      <ArticleWorkspaceStateContext.Provider value={workspace}>
        {children}
      </ArticleWorkspaceStateContext.Provider>
    </ArticleWorkspaceRegistrationContext.Provider>
  );
}

export function useRegisterArticleEditorWorkspace(
  workspace: ArticleEditorWorkspace
) {
  const registerWorkspace = useContext(ArticleWorkspaceRegistrationContext);

  useEffect(() => {
    if (!registerWorkspace) return;
    return registerWorkspace(workspace);
  }, [registerWorkspace, workspace]);
}

export function useArticleEditorWorkspace() {
  return useContext(ArticleWorkspaceStateContext);
}
