"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import NextLink from "next/link";
import type { DragEvent as ReactDragEvent } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { createSlug } from "@/lib/slug";
import { saveArticleAction } from "@/app/(dashboard)/articles/actions";
import {
  deleteEditorTemplateAction,
  saveEditorTemplateAction,
} from "@/app/(dashboard)/articles/template-actions";
import { articlePublicPath } from "@/lib/article-route";
import { withClientAdminPath } from "@/lib/admin-path";
import {
  EditorialBlock,
  insertEditorialBlock,
  insertEditorialGallery,
  insertEditorialSlider,
  replaceSelectedMediaSlot,
  setEditorialBlockReveal,
} from "@/components/EditorialBlock";
import {
  EditorialImage,
  type EditorialImageLayout,
} from "@/components/EditorialImage";

type Category = { id: string; name: string; slug: string };
type ImageUploadTarget = "article" | "cover";
type ImageSelectionContext = {
  selectedImage: boolean;
  attributes: Record<string, unknown>;
  insertionPos?: number;
};
type Article = {
  id?: string;
  title?: string;
  subtitle?: string;
  excerpt?: string;
  slug?: string;
  content_html?: string;
  content_json?: unknown;
  category_id?: string | null;
  status?: string;
  scheduled_at?: string | null;
  cover_external_url?: string | null;
  cover_alt?: string;
  legacy_path?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_url?: string | null;
  featured?: boolean;
  show_on_homepage?: boolean;
  pinned?: boolean;
  sources?: unknown;
  bibliography?: unknown;
  seo_keywords?: string[];
  og_title?: string | null;
  og_description?: string | null;
  allow_indexing?: boolean;
};

function mediaSlot(label: string, hint: string) {
  return `<section class="article-design-block is-media" data-editorial-block="media" data-reveal="fade-up"><h3>${label}</h3><p>${hint}</p></section>`;
}

function suggestedAltText(file: File) {
  const label = file.name
    .replace(/\.[^.]+$/u, "")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return label.length >= 3 ? label.slice(0, 500) : "РР»Р»СЋСЃС‚СЂР°С†РёСЏ Рє СЃС‚Р°С‚СЊРµ";
}

const articleTemplates = [
  {
    label: "РњРЅРµРЅРёРµ Рѕ РєРЅРёРіРµ",
    html: `<aside class="article-lead"><p><strong>РџСЂРµРґРёСЃР»РѕРІРёРµ</strong></p><p>Р—Р°РјРµРЅРёС‚Рµ СЌС‚РѕС‚ С‚РµРєСЃС‚ СЃРІРѕРёРј РІСЃС‚СѓРїР»РµРЅРёРµРј: РїРѕС‡РµРјСѓ РєРЅРёРіР° Р·Р°СЃР»СѓР¶РёРІР°РµС‚ РІРЅРёРјР°С‚РµР»СЊРЅРѕРіРѕ СЂР°Р·РіРѕРІРѕСЂР°.</p></aside>${mediaSlot("РћР±Р»РѕР¶РєР° РёР»Рё РіР»Р°РІРЅРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ", "РџРѕСЃС‚Р°РІСЊС‚Рµ РєСѓСЂСЃРѕСЂ СЃСЋРґР° Рё РЅР°Р¶РјРёС‚Рµ В«Р—Р°РјРµРЅРёС‚СЊ РјРµСЃС‚Рѕ РґР»СЏ С„РѕС‚РѕВ».")}<h2>РСЃС‚РѕСЂРёСЏ СЃРѕР·РґР°РЅРёСЏ Рё РїСѓР±Р»РёРєР°С†РёРё</h2><p>Р’СЃС‚Р°РІСЊС‚Рµ РїРѕРґРіРѕС‚РѕРІР»РµРЅРЅС‹Р№ С‚РµРєСЃС‚ СЂР°Р·РґРµР»Р°.</p><h2>Рћ С‡С‘Рј РїСЂРѕРёР·РІРµРґРµРЅРёРµ</h2><p>Р Р°СЃСЃРєР°Р¶РёС‚Рµ Рѕ Р·Р°РІСЏР·РєРµ Р±РµР· Р»РёС€РЅРёС… СЃРїРѕР№Р»РµСЂРѕРІ.</p>${mediaSlot("РР»Р»СЋСЃС‚СЂР°С†РёСЏ Рє СЃСЋР¶РµС‚Сѓ", "Р’С‹Р±РµСЂРёС‚Рµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ РёР· РјРµРґРёР°С‚РµРєРё Рё РґРѕР±Р°РІСЊС‚Рµ С‚РѕС‡РЅРѕРµ РѕРїРёСЃР°РЅРёРµ.")}<h2>РўРµРјС‹, РіРµСЂРѕРё Рё С…СѓРґРѕР¶РµСЃС‚РІРµРЅРЅС‹Р№ РјРёСЂ</h2><p>Р’СЃС‚Р°РІСЊС‚Рµ РѕСЃРЅРѕРІРЅРѕР№ СЂР°Р·Р±РѕСЂ РїСЂРѕРёР·РІРµРґРµРЅРёСЏ.</p><section class="article-design-block is-accent" data-editorial-block="accent" data-reveal="fade-up"><h3>РљР»СЋС‡РµРІР°СЏ РјС‹СЃР»СЊ</h3><p>Р—Р°РјРµРЅРёС‚Рµ СЌС‚РѕС‚ С‚РµРєСЃС‚ РіР»Р°РІРЅС‹Рј СЂРµРґР°РєС†РёРѕРЅРЅС‹Рј РІС‹РІРѕРґРѕРј.</p></section><h2>Р—Р°РєР»СЋС‡РёС‚РµР»СЊРЅРѕРµ РјРЅРµРЅРёРµ Рѕ РєРЅРёРіРµ</h2><p>РЎС„РѕСЂРјСѓР»РёСЂСѓР№С‚Рµ РёС‚РѕРіРѕРІСѓСЋ РѕС†РµРЅРєСѓ.</p><h2>РСЃС‚РѕС‡РЅРёРєРё</h2><p>РСЃС‚РѕС‡РЅРёРєРё С‚Р°РєР¶Рµ СѓРєР°Р·С‹РІР°СЋС‚СЃСЏ РІ РѕС‚РґРµР»СЊРЅРѕРј РїРѕР»Рµ СЃРїСЂР°РІР°.</p>`,
  },
  {
    label: "Р‘РёРѕРіСЂР°С„РёСЏ РїРёСЃР°С‚РµР»СЏ",
    html: `<aside class="article-lead"><p><strong>Р РµРґР°РєС†РёРѕРЅРЅРѕРµ РІРІРµРґРµРЅРёРµ</strong></p><p>Р—Р°РјРµРЅРёС‚Рµ С‚РµРєСЃС‚: РјРµСЃС‚Рѕ РїРёСЃР°С‚РµР»СЏ РІ Р»РёС‚РµСЂР°С‚СѓСЂРµ Рё РїСЂРёС‡РёРЅР° РѕР±СЂР°С‚РёС‚СЊСЃСЏ Рє РµРіРѕ СЃСѓРґСЊР±Рµ.</p></aside>${mediaSlot("РџРѕСЂС‚СЂРµС‚ РїРёСЃР°С‚РµР»СЏ", "РСЃРїРѕР»СЊР·СѓР№С‚Рµ РїСЂРѕРІРµСЂРµРЅРЅС‹Р№ РїРѕСЂС‚СЂРµС‚ СЃ РїРѕРЅСЏС‚РЅС‹Рј РёСЃС‚РѕС‡РЅРёРєРѕРј Рё Р»РёС†РµРЅР·РёРµР№.")}<h2>Р”РµС‚СЃС‚РІРѕ Рё РѕР±СЂР°Р·РѕРІР°РЅРёРµ</h2><p>Р’СЃС‚Р°РІСЊС‚Рµ С‚РµРєСЃС‚ СЂР°Р·РґРµР»Р°.</p><h2>РќР°С‡Р°Р»Рѕ Р»РёС‚РµСЂР°С‚СѓСЂРЅРѕРіРѕ РїСѓС‚Рё</h2><p>Р’СЃС‚Р°РІСЊС‚Рµ С‚РµРєСЃС‚ СЂР°Р·РґРµР»Р°.</p><section class="article-design-block is-timeline" data-editorial-block="timeline" data-reveal="fade-up"><h3>РҐСЂРѕРЅРѕР»РѕРіРёСЏ</h3><p>Р“РѕРґ вЂ” РІР°Р¶РЅРѕРµ СЃРѕР±С‹С‚РёРµ.</p><p>Р“РѕРґ вЂ” РІР°Р¶РЅРѕРµ СЃРѕР±С‹С‚РёРµ.</p></section><h2>Р“Р»Р°РІРЅС‹Рµ РїСЂРѕРёР·РІРµРґРµРЅРёСЏ</h2><p>Р’СЃС‚Р°РІСЊС‚Рµ С‚РµРєСЃС‚ СЂР°Р·РґРµР»Р°.</p>${mediaSlot("РђСЂС…РёРІРЅРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ РёР»Рё СЂСѓРєРѕРїРёСЃСЊ", "Р—Р°РјРµРЅРёС‚Рµ РјРµСЃС‚Рѕ РёР·РѕР±СЂР°Р¶РµРЅРёРµРј Рё РґРѕР±Р°РІСЊС‚Рµ СЃРѕРґРµСЂР¶Р°С‚РµР»СЊРЅСѓСЋ РїРѕРґРїРёСЃСЊ РІ РјРµРґРёР°С‚РµРєРµ.")}<h2>Р›РёС‡РЅР°СЏ СЃСѓРґСЊР±Р° Рё РІСЂРµРјСЏ</h2><p>Р’СЃС‚Р°РІСЊС‚Рµ С‚РµРєСЃС‚ СЂР°Р·РґРµР»Р°.</p><h2>РќР°СЃР»РµРґРёРµ</h2><p>РЎС„РѕСЂРјСѓР»РёСЂСѓР№С‚Рµ РІР·РІРµС€РµРЅРЅС‹Р№ СЂРµРґР°РєС†РёРѕРЅРЅС‹Р№ РІС‹РІРѕРґ.</p><h2>РСЃС‚РѕС‡РЅРёРєРё Рё Р±РёР±Р»РёРѕРіСЂР°С„РёСЏ</h2><p>РЈРєР°Р¶РёС‚Рµ РїСЂРѕРІРµСЂСЏРµРјС‹Рµ РёСЃС‚РѕС‡РЅРёРєРё.</p>`,
  },
  {
    label: "РљРЅРёРіР° Рё СЌРєСЂР°РЅРёР·Р°С†РёСЏ",
    html: `<aside class="article-lead"><p><strong>РљРЅРёРіР° Рё РµС‘ СЌРєСЂР°РЅРЅР°СЏ РІРµСЂСЃРёСЏ</strong></p><p>Р—Р°РјРµРЅРёС‚Рµ С‚РµРєСЃС‚: С‡С‚Рѕ РёРјРµРЅРЅРѕ СЃСЂР°РІРЅРёРІР°РµС‚СЃСЏ Рё РїРѕС‡РµРјСѓ.</p></aside>${mediaSlot("РћР±Р»РѕР¶РєР° Р»РёС‚РµСЂР°С‚СѓСЂРЅРѕРіРѕ РїРµСЂРІРѕРёСЃС‚РѕС‡РЅРёРєР°", "РџРѕСЃС‚Р°РІСЊС‚Рµ РєСѓСЂСЃРѕСЂ СЃСЋРґР° Рё Р·Р°РјРµРЅРёС‚Рµ РјРµСЃС‚Рѕ РёР·РѕР±СЂР°Р¶РµРЅРёРµРј.")}<h2>Р›РёС‚РµСЂР°С‚СѓСЂРЅС‹Р№ РїРµСЂРІРѕРёСЃС‚РѕС‡РЅРёРє</h2><p>Р’СЃС‚Р°РІСЊС‚Рµ С‚РµРєСЃС‚ Рѕ РєРЅРёРіРµ.</p>${mediaSlot("РљР°РґСЂ РёР»Рё РѕС„РёС†РёР°Р»СЊРЅС‹Р№ РїРѕСЃС‚РµСЂ СЌРєСЂР°РЅРёР·Р°С†РёРё", "Р”РѕР±Р°РІР»СЏР№С‚Рµ С‚РѕР»СЊРєРѕ РёР·РѕР±СЂР°Р¶РµРЅРёРµ СЃ РїСЂРѕРІРµСЂРµРЅРЅС‹Рј РѕСЃРЅРѕРІР°РЅРёРµРј РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ.")}<h2>Р­РєСЂР°РЅРЅР°СЏ РІРµСЂСЃРёСЏ</h2><p>Р’СЃС‚Р°РІСЊС‚Рµ С‚РµРєСЃС‚ РѕР± СЌРєСЂР°РЅРёР·Р°С†РёРё.</p><h2>РЎСЋР¶РµС‚ Рё РєРѕРјРїРѕР·РёС†РёСЏ</h2><p>РЎРѕРїРѕСЃС‚Р°РІСЊС‚Рµ СЂРµС€РµРЅРёСЏ РєРЅРёРіРё Рё С„РёР»СЊРјР°.</p><section class="article-design-block is-columns" data-editorial-block="columns" data-reveal="fade-up"><h3>РљРЅРёРіР° Рё СЌРєСЂР°РЅ</h3><p>РљРЅРёРіР°: Р·Р°РјРµРЅРёС‚Рµ СЌС‚РѕС‚ С‚РµРєСЃС‚.</p><p>Р­РєСЂР°РЅРёР·Р°С†РёСЏ: Р·Р°РјРµРЅРёС‚Рµ СЌС‚РѕС‚ С‚РµРєСЃС‚.</p></section><h2>Р“РµСЂРѕРё Рё Р°РєС‚С‘СЂСЃРєРёРµ СЂР°Р±РѕС‚С‹</h2><p>Р’СЃС‚Р°РІСЊС‚Рµ С‚РµРєСЃС‚ СЂР°Р·РґРµР»Р°.</p><h2>Р§С‚Рѕ РёР·РјРµРЅРёР»РѕСЃСЊ Рё С‡С‚Рѕ СЃРѕС…СЂР°РЅРёР»РѕСЃСЊ</h2><p>Р’СЃС‚Р°РІСЊС‚Рµ РІС‹РІРѕРґС‹ СЃСЂР°РІРЅРµРЅРёСЏ.</p><h2>РС‚РѕРі</h2><p>РЎС„РѕСЂРјСѓР»РёСЂСѓР№С‚Рµ СЂРµРґР°РєС†РёРѕРЅРЅСѓСЋ РѕС†РµРЅРєСѓ.</p>`,
  },
  {
    label: "Р‘РѕР»СЊС€РѕРµ СЌСЃСЃРµ",
    html: `<aside class="article-lead"><p><strong>РџСЂРµРґРёСЃР»РѕРІРёРµ</strong></p><p>Р—Р°РјРµРЅРёС‚Рµ С‚РµРєСЃС‚ РіР»Р°РІРЅС‹Рј РІРѕРїСЂРѕСЃРѕРј Рё СЂРµРґР°РєС†РёРѕРЅРЅРѕР№ РїРѕР·РёС†РёРµР№.</p></aside>${mediaSlot("Р“Р»Р°РІРЅРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ СЌСЃСЃРµ", "РџРѕСЃС‚Р°РІСЊС‚Рµ РєСѓСЂСЃРѕСЂ СЃСЋРґР° Рё РЅР°Р¶РјРёС‚Рµ В«Р—Р°РјРµРЅРёС‚СЊ РјРµСЃС‚Рѕ РґР»СЏ С„РѕС‚РѕВ».")}<h2>РљРѕРЅС‚РµРєСЃС‚</h2><p>Р’СЃС‚Р°РІСЊС‚Рµ С‚РµРєСЃС‚ СЂР°Р·РґРµР»Р°.</p><h2>РћСЃРЅРѕРІРЅР°СЏ РёРґРµСЏ</h2><p>Р Р°Р·РІРµСЂРЅРёС‚Рµ С†РµРЅС‚СЂР°Р»СЊРЅС‹Р№ С‚РµР·РёСЃ.</p><h2>РџСЂРёРјРµСЂС‹ Рё Р°СЂРіСѓРјРµРЅС‚С‹</h2><p>Р’СЃС‚Р°РІСЊС‚Рµ РѕСЃРЅРѕРІРЅСѓСЋ С‡Р°СЃС‚СЊ СЌСЃСЃРµ.</p><blockquote><p>Р—Р°РјРµРЅРёС‚Рµ С†РёС‚Р°С‚Сѓ Рё РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ СѓРєР°Р¶РёС‚Рµ РёСЃС‚РѕС‡РЅРёРє.</p></blockquote>${mediaSlot("Р’С‚РѕСЂР°СЏ РёР»Р»СЋСЃС‚СЂР°С†РёСЏ", "РСЃРїРѕР»СЊР·СѓР№С‚Рµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ РєР°Рє СЃРјС‹СЃР»РѕРІСѓСЋ РїР°СѓР·Сѓ, Р° РЅРµ РєР°Рє СѓРєСЂР°С€РµРЅРёРµ.")}<h2>Р’С‹РІРѕРґ</h2><p>РЎС„РѕСЂРјСѓР»РёСЂСѓР№С‚Рµ РёС‚РѕРі.</p><h2>РСЃС‚РѕС‡РЅРёРєРё</h2><p>РЈРєР°Р¶РёС‚Рµ РїСЂРѕРІРµСЂСЏРµРјС‹Рµ РёСЃС‚РѕС‡РЅРёРєРё.</p>`,
  },
] as const;

const LEGACY_TEMPLATES_KEY = "probpera-editor-custom-templates";
export type CustomTemplate = {
  id: string;
  label: string;
  html: string;
  visibility?: "personal" | "shared";
  canDelete?: boolean;
  localOnly?: boolean;
};

function listValue(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) =>
      typeof item === "string"
        ? item
        : item && typeof item === "object" && "text" in item
          ? String(item.text || "")
          : ""
    )
    .filter(Boolean)
    .join("\n");
}

function hasStructuredContent(value: unknown): value is JSONContent {
  if (!value || typeof value !== "object" || !("content" in value)) return false;
  return Array.isArray(value.content) && value.content.length > 0;
}

function ToolbarButton({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "is-active" : undefined}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {label}
    </button>
  );
}

export default function ArticleEditor({
  article,
  categories,
  publicSiteUrl,
  templates = [],
}: {
  article: Article;
  categories: Category[];
  publicSiteUrl: string;
  templates?: CustomTemplate[];
}) {
  const [title, setTitle] = useState(article.title || "");
  const [slug, setSlug] = useState(article.slug || "");
  const [categoryId, setCategoryId] = useState(article.category_id || "");
  const initialCategorySlug = categories.find(
    (category) => category.id === (article.category_id || "")
  )?.slug;
  const initialCanonical = `${publicSiteUrl}${articlePublicPath(
    article.slug || "adres-stati",
    initialCategorySlug
  )}`;
  const [canonicalUrl, setCanonicalUrl] = useState(
    initialCanonical
  );
  const [canonicalEdited, setCanonicalEdited] = useState(false);
  const [slugEdited, setSlugEdited] = useState(Boolean(article.id));
  const [contentHtml, setContentHtml] = useState(article.content_html || "");
  const [contentJson, setContentJson] = useState(
    JSON.stringify(article.content_json || { type: "doc", content: [] })
  );
  const [savedLocallyAt, setSavedLocallyAt] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasRecoveryCopy, setHasRecoveryCopy] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(templates);
  const [templateMessage, setTemplateMessage] = useState("");
  const [mediaComposerKind, setMediaComposerKind] = useState<
    "gallery" | "slider" | null
  >(null);
  const [mediaComposerValue, setMediaComposerValue] = useState("");
  const [mediaComposerError, setMediaComposerError] = useState("");
  const [templatePending, startTemplateTransition] = useTransition();
  const [excerpt, setExcerpt] = useState(article.excerpt || "");
  const [status, setStatus] = useState(article.status || "draft");
  const [coverUrl, setCoverUrl] = useState(article.cover_external_url || "");
  const [coverAlt, setCoverAlt] = useState(article.cover_alt || "");
  const [imageUploadTarget, setImageUploadTarget] = useState<ImageUploadTarget | null>(null);
  const [imageUploadMessage, setImageUploadMessage] = useState("");
  const [imageUploadError, setImageUploadError] = useState("");
  const [isImageDraggingOverEditor, setIsImageDraggingOverEditor] = useState(false);
  const articleFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const imageSelectionRef = useRef<ImageSelectionContext>({
    selectedImage: false,
    attributes: {},
  });
  const [seoDescription, setSeoDescription] = useState(article.seo_description || "");
  const [sourceText, setSourceText] = useState(listValue(article.sources));
  const initialEditorContent = hasStructuredContent(article.content_json)
    ? article.content_json
    : article.content_html || "";

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),
      EditorialBlock,
      TableKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      EditorialImage,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder:
          "РќР°С‡РЅРёС‚Рµ РїРёСЃР°С‚СЊ. Р”Р»СЏ Р±РѕР»СЊС€РѕРіРѕ РјР°С‚РµСЂРёР°Р»Р° РёСЃРїРѕР»СЊР·СѓР№С‚Рµ РїРѕРґР·Р°РіРѕР»РѕРІРєРё вЂ” РёР· РЅРёС… Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРѕР±РµСЂС‘С‚СЃСЏ РѕРіР»Р°РІР»РµРЅРёРµ.",
      }),
    ],
    content: initialEditorContent,
    onUpdate({ editor: currentEditor }) {
      setContentHtml(currentEditor.getHTML());
      setContentJson(JSON.stringify(currentEditor.getJSON()));
      setIsDirty(true);
    },
  });

  useEffect(() => {
    if (!slugEdited) setSlug(createSlug(title));
  }, [slugEdited, title]);

  const selectedCategorySlug = categories.find(
    (category) => category.id === categoryId
  )?.slug;
  const generatedCanonical = `${publicSiteUrl}${articlePublicPath(
    slug || "adres-stati",
    selectedCategorySlug
  )}`;

  useEffect(() => {
    if (!canonicalEdited) setCanonicalUrl(generatedCanonical);
  }, [canonicalEdited, generatedCanonical]);

  useEffect(() => {
    const recoveryKey = `probpera-editor-${article.id || "new"}`;
    setHasRecoveryCopy(Boolean(window.localStorage.getItem(recoveryKey)));
  }, [article.id]);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(LEGACY_TEMPLATES_KEY) || "[]"
      );
      if (Array.isArray(stored) && stored.length) {
        const legacy = stored.slice(0, 12).map((template: CustomTemplate) => ({
          ...template,
          id: `local-${template.id}`,
          localOnly: true,
          canDelete: true,
        }));
        setCustomTemplates((current) => [
          ...current,
          ...legacy.filter((item: CustomTemplate) =>
            !current.some((saved) => saved.label.toLocaleLowerCase("ru") === item.label.toLocaleLowerCase("ru"))
          ),
        ]);
      }
    } catch {
      window.localStorage.removeItem(LEGACY_TEMPLATES_KEY);
    }
  }, []);

  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [isDirty]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const recoveryKey = `probpera-editor-${article.id || "new"}`;
      window.localStorage.setItem(
        recoveryKey,
        JSON.stringify({ title, slug, contentHtml, contentJson, savedAt: Date.now() })
      );
      setSavedLocallyAt(
        new Intl.DateTimeFormat("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date())
      );
      setHasRecoveryCopy(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [article.id, contentHtml, contentJson, slug, title]);

  const wordCount = useMemo(() => {
    const text = editor?.getText().trim() || "";
    return text ? text.split(/\s+/u).length : 0;
  }, [contentHtml, editor]);

  const publicationChecks = useMemo(() => [
    { label: "Р—Р°РіРѕР»РѕРІРѕРє Рё РїРѕСЃС‚РѕСЏРЅРЅС‹Р№ Р°РґСЂРµСЃ", ok: title.trim().length >= 3 && slug.length >= 2 },
    { label: "Р СѓР±СЂРёРєР° РІС‹Р±СЂР°РЅР°", ok: Boolean(categoryId) },
    { label: "РќРµ РјРµРЅРµРµ 250 СЃР»РѕРІ", ok: wordCount >= 250 },
    { label: "Р•СЃС‚СЊ СЃРјС‹СЃР»РѕРІС‹Рµ РїРѕРґР·Р°РіРѕР»РѕРІРєРё H2", ok: /<h2(?:\s|>)/iu.test(contentHtml) },
    { label: "РћРїРёСЃР°РЅРёРµ РєР°СЂС‚РѕС‡РєРё вЂ” РѕС‚ 80 Р·РЅР°РєРѕРІ", ok: excerpt.trim().length >= 80 },
    { label: "РћР±Р»РѕР¶РєР° Рё РµС‘ РѕРїРёСЃР°РЅРёРµ", ok: /^https:\/\//iu.test(coverUrl) && coverAlt.trim().length >= 10 },
    { label: "SEO-РѕРїРёСЃР°РЅРёРµ вЂ” РѕС‚ 80 Р·РЅР°РєРѕРІ", ok: seoDescription.trim().length >= 80 },
    { label: "РЈРєР°Р·Р°РЅ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ РёСЃС‚РѕС‡РЅРёРє", ok: sourceText.split(/\r?\n/u).some((item) => item.trim().length >= 5) },
    { label: "Р’СЃРµ РјРµСЃС‚Р° РґР»СЏ РёР·РѕР±СЂР°Р¶РµРЅРёР№ Р·Р°РјРµРЅРµРЅС‹", ok: !/data-editorial-block=["']media["']/iu.test(contentHtml) },
  ], [categoryId, contentHtml, coverAlt, coverUrl, excerpt, seoDescription, slug, sourceText, title, wordCount]);
  const publicationReady = publicationChecks.every((item) => item.ok);

  const setLink = () => {
    const previousUrl = editor?.getAttributes("link").href || "";
    const url = window.prompt("РђРґСЂРµСЃ СЃСЃС‹Р»РєРё", previousUrl);
    if (url === null || !editor) return;
    if (!url) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImage = () => {
    if (!editor) return;
    const selectedImage = editor.isActive("image")
      ? editor.getAttributes("image")
      : {};
    const url = window.prompt(
      editor.isActive("image")
        ? "РќРѕРІС‹Р№ Р°РґСЂРµСЃ РІС‹Р±СЂР°РЅРЅРѕРіРѕ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ"
        : "РђРґСЂРµСЃ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ РёР· РјРµРґРёР°С‚РµРєРё",
      typeof selectedImage.src === "string" ? selectedImage.src : ""
    );
    if (!url || !editor) return;
    const alt = window.prompt(
      "РљСЂР°С‚РєРѕ РѕРїРёС€РёС‚Рµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ РґР»СЏ С‡РёС‚Р°С‚РµР»РµР№ Рё РїРѕРёСЃРєРѕРІС‹С… СЃРёСЃС‚РµРј",
      typeof selectedImage.alt === "string" ? selectedImage.alt : ""
    );
    if (alt === null) return;
    const caption = window.prompt(
      "РџРѕРґРїРёСЃСЊ РїРѕРґ РёР·РѕР±СЂР°Р¶РµРЅРёРµРј (РЅРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)",
      typeof selectedImage.caption === "string" ? selectedImage.caption : ""
    );
    if (caption === null) return;
    const attributes = {
      src: url,
      alt: alt.trim(),
      caption: caption.trim(),
      layout:
        typeof selectedImage.layout === "string"
          ? (selectedImage.layout as EditorialImageLayout)
          : "wide",
    };
    if (editor.isActive("image")) {
      editor.chain().focus().updateAttributes("image", attributes).run();
      setTemplateMessage("Р’С‹Р±СЂР°РЅРЅРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ Р·Р°РјРµРЅРµРЅРѕ.");
      return;
    }
    if (replaceSelectedMediaSlot(editor, attributes)) {
      setTemplateMessage("РњРµСЃС‚Рѕ РґР»СЏ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ Р·Р°РїРѕР»РЅРµРЅРѕ.");
      return;
    }
    editor.chain().focus().setImage(attributes).run();
    setTemplateMessage("РР·РѕР±СЂР°Р¶РµРЅРёРµ РІСЃС‚Р°РІР»РµРЅРѕ РІ РјР°С‚РµСЂРёР°Р».");
  };

  const rememberImageSelection = () => {
    const selectedImage = Boolean(editor?.isActive("image"));
    imageSelectionRef.current = {
      selectedImage,
      attributes: selectedImage ? editor?.getAttributes("image") || {} : {},
      insertionPos: undefined,
    };
  };

  const handleEditorImageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    const file = Array.from(event.dataTransfer.files || []).find((item) =>
      item.type.startsWith("image/")
    );
    if (!file || !editor) return;

    event.preventDefault();
    event.stopPropagation();
    const coordinates = editor.view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });
    imageSelectionRef.current = {
      selectedImage: false,
      attributes: {},
      insertionPos: coordinates?.pos,
    };
    setIsImageDraggingOverEditor(false);
    void uploadImageFile(file, "article");
  };

  const openImagePicker = (target: ImageUploadTarget) => {
    setImageUploadError("");
    setImageUploadMessage("");
    if (target === "article") {
      rememberImageSelection();
      articleFileInputRef.current?.click();
      return;
    }
    coverFileInputRef.current?.click();
  };

  const uploadImageFile = async (file: File, target: ImageUploadTarget) => {
    const acceptedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
    ]);
    if (!acceptedTypes.has(file.type)) {
      setImageUploadError("Р’С‹Р±РµСЂРёС‚Рµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ JPEG, PNG, WebP РёР»Рё AVIF.");
      return;
    }
    if (file.size <= 0 || file.size > 12 * 1024 * 1024) {
      setImageUploadError("Р Р°Р·РјРµСЂ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РЅРµ Р±РѕР»СЊС€Рµ 12 РњР‘.");
      return;
    }

    const selection = imageSelectionRef.current;
    const currentAlt =
      target === "cover"
        ? coverAlt.trim()
        : typeof selection.attributes.alt === "string"
          ? selection.attributes.alt.trim()
          : "";
    const altText = currentAlt.length >= 3 ? currentAlt : suggestedAltText(file);
    const caption =
      target === "article" && typeof selection.attributes.caption === "string"
        ? selection.attributes.caption.trim()
        : "";
    const formData = new FormData();
    formData.set("file", file);
    formData.set("alt_text", altText);
    formData.set("caption", caption);
    formData.set("creator", "");
    formData.set("source_url", "");
    formData.set("license_name", "");
    formData.set("license_url", "");
    formData.set("collection_name", target === "cover" ? "РћР±Р»РѕР¶РєРё СЃС‚Р°С‚РµР№" : "РЎС‚Р°С‚СЊРё");
    formData.set("image_usage", target);

    setImageUploadTarget(target);
    setImageUploadError("");
    setImageUploadMessage("РР·РѕР±СЂР°Р¶РµРЅРёРµ Р·Р°РіСЂСѓР¶Р°РµС‚СЃСЏ Рё РѕРїС‚РёРјРёР·РёСЂСѓРµС‚СЃСЏвЂ¦");
    try {
      const response = await fetch(withClientAdminPath("/api/media/upload"), {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.ok || !result.url) {
        throw new Error(result.error || "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ.");
      }

      if (target === "cover") {
        setCoverUrl(result.url);
        if (!coverAlt.trim()) setCoverAlt(altText);
        setImageUploadMessage("РћР±Р»РѕР¶РєР° Р·Р°РіСЂСѓР¶РµРЅР°, РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅР° РІ WebP Рё СѓСЃС‚Р°РЅРѕРІР»РµРЅР°.");
        setIsDirty(true);
        return;
      }

      if (!editor) throw new Error("Р РµРґР°РєС‚РѕСЂ РµС‰С‘ РЅРµ РіРѕС‚РѕРІ. РџРѕРІС‚РѕСЂРёС‚Рµ Р·Р°РіСЂСѓР·РєСѓ.");
      const attributes = {
        src: result.url,
        alt: altText,
        caption,
        layout:
          typeof selection.attributes.layout === "string"
            ? (selection.attributes.layout as EditorialImageLayout)
            : "wide",
      };
      if (selection.selectedImage) {
        editor.chain().focus().updateAttributes("image", attributes).run();
        setImageUploadMessage("Р’С‹Р±СЂР°РЅРЅРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ Р·Р°РјРµРЅРµРЅРѕ С„Р°Р№Р»РѕРј СЃ РєРѕРјРїСЊСЋС‚РµСЂР°.");
      } else if (typeof selection.insertionPos === "number") {
        const insertionPos = Math.max(
          0,
          Math.min(selection.insertionPos, editor.state.doc.content.size)
        );
        editor
          .chain()
          .focus()
          .insertContentAt(insertionPos, { type: "image", attrs: attributes })
          .run();
        setImageUploadMessage("РР·РѕР±СЂР°Р¶РµРЅРёРµ РІСЃС‚Р°РІР»РµРЅРѕ С‚РѕС‡РЅРѕ РІ РІС‹Р±СЂР°РЅРЅРѕРµ РјРµСЃС‚Рѕ С‚РµРєСЃС‚Р°.");
      } else if (replaceSelectedMediaSlot(editor, attributes)) {
        setImageUploadMessage("РњРµСЃС‚Рѕ РґР»СЏ С„РѕС‚РѕРіСЂР°С„РёРё Р·Р°РїРѕР»РЅРµРЅРѕ Р·Р°РіСЂСѓР¶РµРЅРЅС‹Рј РёР·РѕР±СЂР°Р¶РµРЅРёРµРј.");
      } else {
        editor.chain().focus().setImage(attributes).run();
        setImageUploadMessage("РР·РѕР±СЂР°Р¶РµРЅРёРµ Р·Р°РіСЂСѓР¶РµРЅРѕ Рё РІСЃС‚Р°РІР»РµРЅРѕ РІ СЃС‚Р°С‚СЊСЋ.");
      }
      setTemplateMessage("РР·РѕР±СЂР°Р¶РµРЅРёРµ РіРѕС‚РѕРІРѕ. РџСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё РІС‹Р±РµСЂРёС‚Рµ РµРіРѕ Рё РёР·РјРµРЅРёС‚Рµ СЂР°СЃРїРѕР»РѕР¶РµРЅРёРµ.");
      setIsDirty(true);
    } catch (error) {
      setImageUploadMessage("");
      setImageUploadError(
        error instanceof Error ? error.message : "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ."
      );
    } finally {
      setImageUploadTarget(null);
      if (articleFileInputRef.current) articleFileInputRef.current.value = "";
      if (coverFileInputRef.current) coverFileInputRef.current.value = "";
    }
  };

  const setImageLayout = (layout: EditorialImageLayout) => {
    if (!editor?.isActive("image")) {
      setTemplateMessage(
        "РЎРЅР°С‡Р°Р»Р° С‰С‘Р»РєРЅРёС‚Рµ РїРѕ РёР·РѕР±СЂР°Р¶РµРЅРёСЋ РІ С‚РµРєСЃС‚Рµ, Р·Р°С‚РµРј РІС‹Р±РµСЂРёС‚Рµ РµРіРѕ РїРѕР»РѕР¶РµРЅРёРµ."
      );
      return;
    }
    editor.chain().focus().updateAttributes("image", { layout }).run();
    const labels: Record<EditorialImageLayout, string> = {
      wide: "РЅР° РІСЃСЋ С€РёСЂРёРЅСѓ",
      normal: "РїРѕ С†РµРЅС‚СЂСѓ",
      left: "СЃР»РµРІР° СЃ РѕР±С‚РµРєР°РЅРёРµРј",
      right: "СЃРїСЂР°РІР° СЃ РѕР±С‚РµРєР°РЅРёРµРј",
    };
    setTemplateMessage(`РР·РѕР±СЂР°Р¶РµРЅРёРµ СЂР°СЃРїРѕР»РѕР¶РµРЅРѕ ${labels[layout]}.`);
  };

  const addMediaCollection = (kind: "gallery" | "slider") => {
    setMediaComposerKind(kind);
    setMediaComposerValue("");
    setMediaComposerError("");
  };

  const confirmMediaCollection = () => {
    if (!mediaComposerKind) return;
    const urls = mediaComposerValue
      .split(/\r?\n/u)
      .map((item) => item.trim())
      .filter((item) => /^https:\/\//iu.test(item))
      .slice(0, 8);
    if (!urls.length) {
      setMediaComposerError("Р”РѕР±Р°РІСЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ РєРѕСЂСЂРµРєС‚РЅС‹Р№ HTTPS-Р°РґСЂРµСЃ.");
      return;
    }
    if (mediaComposerKind === "slider") insertEditorialSlider(editor, urls);
    else insertEditorialGallery(editor, urls);
    setTemplateMessage(
      mediaComposerKind === "slider"
        ? "РЎР»Р°Р№РґРµСЂ РІСЃС‚Р°РІР»РµРЅ: РЅР° СЃР°Р№С‚Рµ РїРѕСЏРІСЏС‚СЃСЏ СЃС‚СЂРµР»РєРё, С‚РѕС‡РєРё Рё СЃРІР°Р№Рї."
        : "Р“Р°Р»РµСЂРµСЏ РІСЃС‚Р°РІР»РµРЅР° РІ РјР°С‚РµСЂРёР°Р»."
    );
    setMediaComposerKind(null);
    setMediaComposerValue("");
    setMediaComposerError("");
  };

  const applyTemplate = (html: string, label: string) => {
    if (!editor) return;
    if (
      editor.getText().trim() &&
      !window.confirm(
        `Р—Р°РјРµРЅРёС‚СЊ С‚РµРєСѓС‰РёР№ С‚РµРєСЃС‚ С€Р°Р±Р»РѕРЅРѕРј В«${label}В»? Р›РѕРєР°Р»СЊРЅР°СЏ СЂРµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ СЃРѕС…СЂР°РЅРёС‚СЃСЏ.`
      )
    ) {
      return;
    }
    const recoveryKey = `probpera-editor-${article.id || "new"}`;
    window.localStorage.setItem(
      recoveryKey,
      JSON.stringify({
        title,
        slug,
        contentHtml: editor.getHTML(),
        contentJson: JSON.stringify(editor.getJSON()),
        savedAt: Date.now(),
        reason: `before-template:${label}`,
      })
    );
    editor.commands.setContent(html);
    editor.chain().focus("start").run();
    setIsDirty(true);
    setHasRecoveryCopy(true);
    setTemplateMessage(
      `РЁР°Р±Р»РѕРЅ В«${label}В» РІСЃС‚Р°РІР»РµРЅ. Р—Р°РјРµРЅРёС‚Рµ СЂРµРґР°РєС†РёРѕРЅРЅС‹Рµ РїРѕРґСЃРєР°Р·РєРё СЃРІРѕРёРј С‚РµРєСЃС‚РѕРј Рё РёР·РѕР±СЂР°Р¶РµРЅРёСЏРјРё.`
    );
  };

  const saveCustomTemplate = () => {
    if (!editor || !editor.getText().trim()) {
      window.alert("РЎРЅР°С‡Р°Р»Р° РїРѕРґРіРѕС‚РѕРІСЊС‚Рµ СЃС‚СЂСѓРєС‚СѓСЂСѓ РјР°С‚РµСЂРёР°Р»Р° РІ СЂРµРґР°РєС‚РѕСЂРµ.");
      return;
    }
    const label = window.prompt("РќР°Р·РІР°РЅРёРµ СЃРѕР±СЃС‚РІРµРЅРЅРѕРіРѕ С€Р°Р±Р»РѕРЅР°")?.trim();
    if (!label) return;
    const visibility = window.confirm("РЎРґРµР»Р°С‚СЊ С€Р°Р±Р»РѕРЅ РѕР±С‰РёРј РґР»СЏ РІСЃРµР№ СЂРµРґР°РєС†РёРё?") ? "shared" : "personal";
    setTemplateMessage("");
    startTemplateTransition(async () => {
      const result = await saveEditorTemplateAction({
        label: label.slice(0, 80),
        html: editor.getHTML(),
        json: editor.getJSON(),
        visibility,
      });
      if (result.error || !result.template) {
        setTemplateMessage(result.error || "РЁР°Р±Р»РѕРЅ РЅРµ СЃРѕС…СЂР°РЅС‘РЅ.");
        return;
      }
      setCustomTemplates((current) => [
        ...current.filter((template) => template.label.toLocaleLowerCase("ru") !== result.template!.label.toLocaleLowerCase("ru")),
        result.template as CustomTemplate,
      ]);
      const legacy = customTemplates.filter((item) => item.localOnly && item.label !== result.template!.label);
      window.localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(legacy));
      setTemplateMessage("РЁР°Р±Р»РѕРЅ СЃРѕС…СЂР°РЅС‘РЅ РІ СЂРµРґР°РєС†РёРѕРЅРЅРѕР№ Р±Р°Р·Рµ.");
    });
  };

  const clearCustomTemplates = () => {
    if (!customTemplates.length || !window.confirm("РЈРґР°Р»РёС‚СЊ РґРѕСЃС‚СѓРїРЅС‹Рµ СЃРѕР±СЃС‚РІРµРЅРЅС‹Рµ С€Р°Р±Р»РѕРЅС‹? РћР±С‰РёРµ С€Р°Р±Р»РѕРЅС‹ РґСЂСѓРіРёС… СЂРµРґР°РєС‚РѕСЂРѕРІ СЃРѕС…СЂР°РЅСЏС‚СЃСЏ.")) return;
    startTemplateTransition(async () => {
      const deletable = customTemplates.filter((template) => template.canDelete && !template.localOnly);
      const results = await Promise.all(deletable.map((template) => deleteEditorTemplateAction(template.id)));
      const failedIds = new Set(deletable.filter((_, index) => results[index]?.error).map((item) => item.id));
      setCustomTemplates((current) => current.filter((template) => !template.localOnly && (!template.canDelete || failedIds.has(template.id))));
      window.localStorage.removeItem(LEGACY_TEMPLATES_KEY);
      setTemplateMessage(failedIds.size ? "Р§Р°СЃС‚СЊ С€Р°Р±Р»РѕРЅРѕРІ РЅРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ." : "РЎРѕР±СЃС‚РІРµРЅРЅС‹Рµ С€Р°Р±Р»РѕРЅС‹ СѓРґР°Р»РµРЅС‹.");
    });
  };

  const restoreLocalCopy = () => {
    const stored = window.localStorage.getItem(
      `probpera-editor-${article.id || "new"}`
    );
    if (!stored || !editor) return;
    try {
      const recovery = JSON.parse(stored) as {
        title?: string;
        slug?: string;
        contentHtml?: string;
      };
      if (
        !window.confirm(
          "Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ Р»РѕРєР°Р»СЊРЅСѓСЋ СЂРµР·РµСЂРІРЅСѓСЋ РєРѕРїРёСЋ? РўРµРєСѓС‰РёР№ С‚РµРєСЃС‚ РІ СЂРµРґР°РєС‚РѕСЂРµ Р±СѓРґРµС‚ Р·Р°РјРµРЅС‘РЅ."
        )
      ) {
        return;
      }
      if (recovery.title) setTitle(recovery.title);
      if (recovery.slug) {
        setSlugEdited(true);
        setSlug(recovery.slug);
      }
      editor.commands.setContent(recovery.contentHtml || "");
      setIsDirty(true);
    } catch {
      window.alert("Р›РѕРєР°Р»СЊРЅР°СЏ РєРѕРїРёСЏ РїРѕРІСЂРµР¶РґРµРЅР° Рё РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅР°.");
    }
  };

  return (
    <form
      action={saveArticleAction}
      onSubmit={() => setIsDirty(false)}
      className={isFullscreen ? "article-form is-fullscreen" : "article-form"}
    >
      {article.id && <input type="hidden" name="id" value={article.id} />}
      <input type="hidden" name="previous_status" value={article.status || "draft"} />
      <input type="hidden" name="content_html" value={contentHtml} />
      <input type="hidden" name="content_json" value={contentJson} />
      <input type="hidden" name="publication_override" value="0" />

      <div className="article-editor">
        <div className="editor-main">
          <section className="panel">
            <label className="field">
              <span>Р—Р°РіРѕР»РѕРІРѕРє</span>
              <input
                className="editor-title"
                name="title"
                value={title}
                maxLength={240}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setIsDirty(true);
                }}
                placeholder="Р—Р°РіРѕР»РѕРІРѕРє РјР°С‚РµСЂРёР°Р»Р°"
                required
              />
            </label>
            <label className="field">
              <span>РџРѕРґР·Р°РіРѕР»РѕРІРѕРє</span>
              <input
                name="subtitle"
                defaultValue={article.subtitle}
                maxLength={360}
                placeholder="РќРµРѕР±СЏР·Р°С‚РµР»СЊРЅР°СЏ СЃС‚СЂРѕРєР° РїРѕРґ Р·Р°РіРѕР»РѕРІРєРѕРј"
              />
            </label>
            <label className="field">
              <span>РљСЂР°С‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ</span>
              <textarea
                name="excerpt"
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                maxLength={700}
                placeholder="Р”Р»СЏ РєР°СЂС‚РѕС‡РµРє, РїРѕРёСЃРєР° Рё СЃРѕС†РёР°Р»СЊРЅС‹С… СЃРµС‚РµР№"
              />
            </label>
          </section>

          <section className="panel editor-surface">
            <div className="editor-template-bar">
              <span>РќР°С‡Р°С‚СЊ СЃ СЂРµРґР°РєС†РёРѕРЅРЅРѕРіРѕ С€Р°Р±Р»РѕРЅР°</span>
              <small>
                Р’С‹Р±РµСЂРёС‚Рµ СЃС‚СЂСѓРєС‚СѓСЂСѓ вЂ” РѕРЅР° СЃСЂР°Р·Сѓ РїРѕСЏРІРёС‚СЃСЏ РІ СЂРµРґР°РєС‚РѕСЂРµ. Р—Р°С‚РµРј
                Р·Р°РјРµРЅРёС‚Рµ РїРѕРґСЃРєР°Р·РєРё СЃРІРѕРёРј С‚РµРєСЃС‚РѕРј, С„РѕС‚РѕРіСЂР°С„РёСЏРјРё Рё РіР°Р»РµСЂРµСЏРјРё.
              </small>
              <div>
                {articleTemplates.map((template) => (
                  <button
                    type="button"
                    key={template.label}
                    onClick={() => applyTemplate(template.html, template.label)}
                  >
                    {template.label}
                  </button>
                ))}
                {customTemplates.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => applyTemplate(template.html, template.label)}
                    title={template.localOnly ? "Р›РѕРєР°Р»СЊРЅС‹Р№ С€Р°Р±Р»РѕРЅ вЂ” СЃРѕС…СЂР°РЅРёС‚Рµ РµРіРѕ Р·Р°РЅРѕРІРѕ, С‡С‚РѕР±С‹ РїРµСЂРµРЅРµСЃС‚Рё РІ Р±Р°Р·Сѓ" : template.visibility === "shared" ? "РћР±С‰РёР№ С€Р°Р±Р»РѕРЅ СЂРµРґР°РєС†РёРё" : "Р›РёС‡РЅС‹Р№ С€Р°Р±Р»РѕРЅ"}
                  >
                    {template.visibility === "shared" ? "в—†" : "в…"} {template.label}{template.localOnly ? " В· Р»РѕРєР°Р»СЊРЅС‹Р№" : ""}
                  </button>
                ))}
                <button type="button" onClick={saveCustomTemplate} disabled={templatePending}>
                  пј‹ РЎРѕС…СЂР°РЅРёС‚СЊ РєР°Рє С€Р°Р±Р»РѕРЅ
                </button>
                <NextLink
                  className="editor-template-link"
                  href={withClientAdminPath("/media")}
                  target="_blank"
                >
                  РњРµРґРёР°С‚РµРєР° в†—
                </NextLink>
                {customTemplates.length > 0 && (
                  <button type="button" onClick={clearCustomTemplates} disabled={templatePending}>
                    РЈРґР°Р»РёС‚СЊ РјРѕРё С€Р°Р±Р»РѕРЅС‹
                  </button>
                )}
              </div>
              {templateMessage && <small role="status">{templateMessage}</small>}
            </div>
            <div className="editor-toolbar" aria-label="РџР°РЅРµР»СЊ С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёСЏ">
              <ToolbarButton label="Р–" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} />
              <ToolbarButton label="Рљ" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} />
              <ToolbarButton label="Р§" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
              <ToolbarButton label="Р—Р°С‡С‘СЂРєРЅСѓС‚С‹Р№" active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()} />
              <ToolbarButton label="H2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
              <ToolbarButton label="H3" active={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} />
              <ToolbarButton label="H4" active={editor?.isActive("heading", { level: 4 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()} />
              <ToolbarButton label="вЂў РЎРїРёСЃРѕРє" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
              <ToolbarButton label="1. РЎРїРёСЃРѕРє" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
              <ToolbarButton label="Р¦РёС‚Р°С‚Р°" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
              <ToolbarButton label="Р Р°Р·РґРµР»РёС‚РµР»СЊ" onClick={() => editor?.chain().focus().setHorizontalRule().run()} />
              <ToolbarButton label="Р¤Р°РєС‚" onClick={() => insertEditorialBlock(editor, "fact")} />
              <ToolbarButton label="РђРєС†РµРЅС‚" onClick={() => insertEditorialBlock(editor, "accent")} />
              <ToolbarButton label="2 РєРѕР»РѕРЅРєРё" onClick={() => insertEditorialBlock(editor, "columns")} />
              <ToolbarButton label="РҐСЂРѕРЅРѕР»РѕРіРёСЏ" onClick={() => insertEditorialBlock(editor, "timeline")} />
              <ToolbarButton label="Р¦РёС„СЂС‹" onClick={() => insertEditorialBlock(editor, "metrics")} />
              <ToolbarButton label="Р¤РёРіСѓСЂР°-СЂР°Р·РґРµР»РёС‚РµР»СЊ" onClick={() => insertEditorialBlock(editor, "ornament")} />
              <ToolbarButton label="РњРµСЃС‚Рѕ РґР»СЏ С„РѕС‚Рѕ" onClick={() => insertEditorialBlock(editor, "media")} />
              <ToolbarButton label="РџРѕСЏРІР»РµРЅРёРµ в†‘" onClick={() => setEditorialBlockReveal(editor, "fade-up")} />
              <ToolbarButton label="РџРѕСЏРІР»РµРЅРёРµ в†ђ" onClick={() => setEditorialBlockReveal(editor, "slide-left")} />
              <ToolbarButton label="РњР°СЃС€С‚Р°Р±" onClick={() => setEditorialBlockReveal(editor, "zoom-in")} />
              <ToolbarButton label="Р‘РµР· Р°РЅРёРјР°С†РёРё" onClick={() => setEditorialBlockReveal(editor, "none")} />
              <ToolbarButton label="РўР°Р±Р»РёС†Р°" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
              <ToolbarButton label="РЎСЃС‹Р»РєР°" active={editor?.isActive("link")} onClick={setLink} />
              <ToolbarButton
                label={imageUploadTarget === "article" ? "Р—Р°РіСЂСѓР·РєР°вЂ¦" : "Р—Р°РіСЂСѓР·РёС‚СЊ С„РѕС‚Рѕ"}
                active={imageUploadTarget === "article"}
                onClick={() => openImagePicker("article")}
              />
              <ToolbarButton label="Р¤РѕС‚Рѕ / Р·Р°РјРµРЅРёС‚СЊ" active={editor?.isActive("image")} onClick={addImage} />
              <ToolbarButton label="Р¤РѕС‚Рѕ С€РёСЂРѕРєРѕ" onClick={() => setImageLayout("wide")} />
              <ToolbarButton label="Р¤РѕС‚Рѕ С†РµРЅС‚СЂ" onClick={() => setImageLayout("normal")} />
              <ToolbarButton label="Р¤РѕС‚Рѕ СЃР»РµРІР°" onClick={() => setImageLayout("left")} />
              <ToolbarButton label="Р¤РѕС‚Рѕ СЃРїСЂР°РІР°" onClick={() => setImageLayout("right")} />
              <ToolbarButton label="Р“Р°Р»РµСЂРµСЏ" onClick={() => addMediaCollection("gallery")} />
              <ToolbarButton label="РЎР»Р°Р№РґРµСЂ" onClick={() => addMediaCollection("slider")} />
              <ToolbarButton label="РЎР»РµРІР°" active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()} />
              <ToolbarButton label="Р¦РµРЅС‚СЂ" active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()} />
              <ToolbarButton label="РћС‡РёСЃС‚РёС‚СЊ С„РѕСЂРјР°С‚" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} />
              <ToolbarButton label="в†¶" onClick={() => editor?.chain().focus().undo().run()} />
              <ToolbarButton label="в†·" onClick={() => editor?.chain().focus().redo().run()} />
              <ToolbarButton
                label={isFullscreen ? "РЎРІРµСЂРЅСѓС‚СЊ СЂРµРґР°РєС‚РѕСЂ" : "РќР° РІРµСЃСЊ СЌРєСЂР°РЅ"}
                active={isFullscreen}
                onClick={() => setIsFullscreen((value) => !value)}
              />
            </div>
            <input
              ref={articleFileInputRef}
              className="visually-hidden-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadImageFile(file, "article");
              }}
            />
            <button
              className={
                imageUploadTarget === "article"
                  ? "editor-direct-upload is-uploading"
                  : "editor-direct-upload"
              }
              type="button"
              onClick={() => openImagePicker("article")}
              onDragEnter={rememberImageSelection}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void uploadImageFile(file, "article");
              }}
              disabled={imageUploadTarget !== null}
            >
              <strong>
                {imageUploadTarget === "article"
                  ? "РћРїС‚РёРјРёР·РёСЂСѓРµРј РёР·РѕР±СЂР°Р¶РµРЅРёРµвЂ¦"
                  : "РќР°Р¶РјРёС‚Рµ РёР»Рё РїРµСЂРµС‚Р°С‰РёС‚Рµ С„РѕС‚РѕРіСЂР°С„РёСЋ СЃСЋРґР°"}
              </strong>
              <span>
                РћРЅР° Р·Р°РіСЂСѓР·РёС‚СЃСЏ СЃ РєРѕРјРїСЊСЋС‚РµСЂР°, РїСЂРµРѕР±СЂР°Р·СѓРµС‚СЃСЏ РІ WebP Рё РїРѕСЏРІРёС‚СЃСЏ РІ РјРµСЃС‚Рµ РєСѓСЂСЃРѕСЂР°.
                Р•СЃР»Рё РІС‹Р±СЂР°РЅР° СЃС‚Р°СЂР°СЏ С„РѕС‚РѕРіСЂР°С„РёСЏ, РЅРѕРІР°СЏ Р·Р°РјРµРЅРёС‚ РµС‘.
              </span>
            </button>
            {imageUploadMessage && (
              <p className="upload-feedback is-success" role="status">{imageUploadMessage}</p>
            )}
            {imageUploadError && (
              <p className="upload-feedback is-error" role="alert">{imageUploadError}</p>
            )}
            <div
              className={
                isImageDraggingOverEditor
                  ? "editor-content-drop-target is-dragging"
                  : "editor-content-drop-target"
              }
              onDragEnterCapture={(event) => {
                if (Array.from(event.dataTransfer.items || []).some(
                  (item) => item.kind === "file" && item.type.startsWith("image/")
                )) {
                  setIsImageDraggingOverEditor(true);
                }
              }}
              onDragOverCapture={(event) => {
                if (Array.from(event.dataTransfer.items || []).some(
                  (item) => item.kind === "file" && item.type.startsWith("image/")
                )) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsImageDraggingOverEditor(false);
                }
              }}
              onDropCapture={handleEditorImageDrop}
            >
              <EditorContent editor={editor} />
              {isImageDraggingOverEditor && (
                <span className="editor-drop-hint" aria-hidden="true">
                  РћС‚РїСѓСЃС‚РёС‚Рµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ вЂ” РѕРЅРѕ РїРѕСЏРІРёС‚СЃСЏ РІ СЌС‚РѕРј РјРµСЃС‚Рµ СЃС‚Р°С‚СЊРё
                </span>
              )}
            </div>
          </section>
        </div>

        <aside className="editor-side">
          <section className="panel settings-stack">
            <h2>РџСѓР±Р»РёРєР°С†РёСЏ</h2>
            <label className="field">
              <span>РЎС‚Р°С‚СѓСЃ</span>
              <select name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="draft">Р§РµСЂРЅРѕРІРёРє</option>
                <option value="review">РќР° РїСЂРѕРІРµСЂРєРµ</option>
                <option value="scheduled">РџРѕ СЂР°СЃРїРёСЃР°РЅРёСЋ</option>
                <option value="published">РћРїСѓР±Р»РёРєРѕРІР°РЅР°</option>
                <option value="hidden">РЎРєСЂС‹С‚Р°</option>
                <option value="archived">Р’ Р°СЂС…РёРІРµ</option>
              </select>
            </label>
            <label className="field">
              <span>Р”Р°С‚Р° Рё РІСЂРµРјСЏ РїСѓР±Р»РёРєР°С†РёРё</span>
              <input
                type="datetime-local"
                name="scheduled_at"
                defaultValue={article.scheduled_at?.slice(0, 16) || ""}
              />
            </label>
            <label><input type="checkbox" name="featured" defaultChecked={article.featured} /> Р’С‹Р±РѕСЂ СЂРµРґР°РєС†РёРё</label>
            <label><input type="checkbox" name="show_on_homepage" defaultChecked={article.show_on_homepage} /> РџРѕРєР°Р·С‹РІР°С‚СЊ РЅР° РіР»Р°РІРЅРѕР№</label>
            <label><input type="checkbox" name="pinned" defaultChecked={article.pinned} /> Р—Р°РєСЂРµРїРёС‚СЊ</label>
          </section>

          <section className="panel settings-stack">
            <h2>Р СѓР±СЂРёРєР°</h2>
            <label className="field">
              <span>РћСЃРЅРѕРІРЅР°СЏ СЂСѓР±СЂРёРєР°</span>
              <select
                name="category_id"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Р‘РµР· СЂСѓР±СЂРёРєРё</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="panel settings-stack">
            <h2>РћР±Р»РѕР¶РєР°</h2>
            <input
              ref={coverFileInputRef}
              className="visually-hidden-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadImageFile(file, "cover");
              }}
            />
            <button
              className={
                imageUploadTarget === "cover"
                  ? "cover-upload-zone is-uploading"
                  : "cover-upload-zone"
              }
              type="button"
              onClick={() => openImagePicker("cover")}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void uploadImageFile(file, "cover");
              }}
              disabled={imageUploadTarget !== null}
            >
              {coverUrl ? (
                <img src={coverUrl} alt={coverAlt || "РџСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ РѕР±Р»РѕР¶РєРё СЃС‚Р°С‚СЊРё"} />
              ) : (
                <span className="cover-upload-mark" aria-hidden="true">пј‹</span>
              )}
              <strong>
                {imageUploadTarget === "cover"
                  ? "Р—Р°РіСЂСѓР¶Р°РµРј РѕР±Р»РѕР¶РєСѓвЂ¦"
                  : coverUrl
                    ? "РќР°Р¶РјРёС‚Рµ, С‡С‚РѕР±С‹ Р·Р°РјРµРЅРёС‚СЊ РѕР±Р»РѕР¶РєСѓ"
                    : "Р’С‹Р±СЂР°С‚СЊ РѕР±Р»РѕР¶РєСѓ СЃ РєРѕРјРїСЊСЋС‚РµСЂР°"}
              </strong>
              <small>
                РђРІС‚РѕРїРѕРґРіРѕРЅРєР° Р±РµР· РѕР±СЂРµР·РєРё В· JPEG, PNG, WebP РёР»Рё AVIF В· РґРѕ 12 РњР‘
              </small>
            </button>
            <label className="field">
              <span>РђРґСЂРµСЃ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ</span>
              <input
                type="url"
                name="cover_external_url"
                value={coverUrl}
                onChange={(event) => setCoverUrl(event.target.value)}
                placeholder="https://вЂ¦"
              />
            </label>
            <label className="field">
              <span>РћРїРёСЃР°РЅРёРµ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ</span>
              <textarea
                name="cover_alt"
                value={coverAlt}
                onChange={(event) => setCoverAlt(event.target.value)}
                maxLength={500}
                placeholder="Р§С‚Рѕ РёР·РѕР±СЂР°Р¶РµРЅРѕ вЂ” РґР»СЏ РґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё Рё РїРѕРёСЃРєР°"
              />
            </label>
          </section>

          <section className="panel settings-stack">
            <h2>РђРґСЂРµСЃ Рё SEO</h2>
            <label className="field">
              <span>РђРґСЂРµСЃ СЃС‚Р°С‚СЊРё</span>
              <input
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(createSlug(event.target.value));
                }}
                required
              />
              <span className="slug-control-row">
                <small>
                  {!slugEdited
                    ? "РђРґСЂРµСЃ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РјРµРЅСЏРµС‚СЃСЏ РІРјРµСЃС‚Рµ СЃ Р·Р°РіРѕР»РѕРІРєРѕРј."
                    : "РђРґСЂРµСЃ Р·Р°РєСЂРµРїР»С‘РЅ РІСЂСѓС‡РЅСѓСЋ Рё Р±РѕР»СЊС€Рµ РЅРµ РёР·РјРµРЅРёС‚СЃСЏ РѕС‚ Р·Р°РіРѕР»РѕРІРєР°."}
                </small>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setSlugEdited(false);
                    setSlug(createSlug(title));
                    setCanonicalEdited(false);
                    setIsDirty(true);
                  }}
                >
                  РЎРѕР·РґР°РІР°С‚СЊ РёР· Р·Р°РіРѕР»РѕРІРєР°
                </button>
              </span>
              <small>
                {publicSiteUrl}
                {articlePublicPath(
                  slug || "adres-stati",
                  selectedCategorySlug
                )}
              </small>
            </label>
            <label className="field">
              <span>РЎС‚Р°СЂС‹Р№ Р°РґСЂРµСЃ вЂ” С‚РѕР»СЊРєРѕ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ</span>
              <input
                name="legacy_path"
                defaultValue={article.legacy_path || ""}
                placeholder="/read/page-article/вЂ¦"
              />
              <small>
                РќРµ РїРѕРєР°Р·С‹РІР°РµС‚СЃСЏ С‡РёС‚Р°С‚РµР»СЏРј Рё РЅРµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІ РЅРѕРІС‹С… СЃСЃС‹Р»РєР°С….
                РќСѓР¶РµРЅ С‚РѕР»СЊРєРѕ РґР»СЏ Р±РµСЃС€РѕРІРЅРѕРіРѕ 301вЂ‘РїРµСЂРµС…РѕРґР° СЃРѕ СЃС‚Р°СЂС‹С… РїСѓР±Р»РёРєР°С†РёР№.
              </small>
            </label>
            <label className="field">
              <span>SEO-Р·Р°РіРѕР»РѕРІРѕРє</span>
              <input name="seo_title" defaultValue={article.seo_title || ""} maxLength={180} />
            </label>
            <label className="field">
              <span>РћРїРёСЃР°РЅРёРµ РґР»СЏ РїРѕРёСЃРєР°</span>
              <textarea name="seo_description" value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} maxLength={400} />
            </label>
            <label className="field">
              <span>РљР»СЋС‡РµРІС‹Рµ СЃР»РѕРІР°</span>
              <textarea
                name="seo_keywords"
                defaultValue={(article.seo_keywords || []).join(", ")}
                maxLength={1000}
                placeholder="Р»РёС‚РµСЂР°С‚СѓСЂР°, Р°РІС‚РѕСЂ, РЅР°Р·РІР°РЅРёРµ РєРЅРёРіРё"
              />
            </label>
            <label className="field">
              <span>РўРµРєСѓС‰РёР№ РїРѕСЃС‚РѕСЏРЅРЅС‹Р№ Р°РґСЂРµСЃ</span>
              <input
                type="url"
                name="canonical_url"
                value={canonicalUrl}
                readOnly
                placeholder={generatedCanonical}
              />
              <small>
                РЎС‚СЂРѕРёС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РёР· СЂСѓР±СЂРёРєРё Рё РЅР°Р·РІР°РЅРёСЏ. РќРѕРІС‹Рµ РїСѓР±Р»РёРєР°С†РёРё
                РІСЃРµРіРґР° РёСЃРїРѕР»СЊР·СѓСЋС‚ СЌС‚РѕС‚ РїРѕРЅСЏС‚РЅС‹Р№ Р°РґСЂРµСЃ.
              </small>
            </label>
            <label className="field">
              <span>Open Graph вЂ” Р·Р°РіРѕР»РѕРІРѕРє</span>
              <input name="og_title" defaultValue={article.og_title || ""} maxLength={180} />
            </label>
            <label className="field">
              <span>Open Graph вЂ” РѕРїРёСЃР°РЅРёРµ</span>
              <textarea name="og_description" defaultValue={article.og_description || ""} maxLength={400} />
            </label>
            <label>
              <input
                type="checkbox"
                name="allow_indexing"
                defaultChecked={article.allow_indexing !== false}
              />{" "}
              Р Р°Р·СЂРµС€РёС‚СЊ РёРЅРґРµРєСЃР°С†РёСЋ РїРѕРёСЃРєРѕРІС‹РјРё СЃРёСЃС‚РµРјР°РјРё
            </label>
          </section>

          <section className="panel settings-stack publication-checklist" aria-labelledby="publication-checklist-title">
            <h2 id="publication-checklist-title">РљРѕРЅС‚СЂРѕР»СЊ РїРµСЂРµРґ РїСѓР±Р»РёРєР°С†РёРµР№</h2>
            <ul>
              {publicationChecks.map((item) => (
                <li className={item.ok ? "is-ready" : "is-missing"} key={item.label}>
                  <span aria-hidden="true">{item.ok ? "вњ“" : "в—‹"}</span>{item.label}
                </li>
              ))}
            </ul>
            <p>{publicationReady ? "РњР°С‚РµСЂРёР°Р» РіРѕС‚РѕРІ Рє РІС‹РїСѓСЃРєСѓ." : "Р§РµСЂРЅРѕРІРёРє РјРѕР¶РЅРѕ СЃРѕС…СЂР°РЅСЏС‚СЊ. Р”Р»СЏ РІС‹РїСѓСЃРєР° Р·Р°РІРµСЂС€РёС‚Рµ РѕС‚РјРµС‡РµРЅРЅС‹Рµ РїСѓРЅРєС‚С‹."}</p>
            <input type="hidden" name="publication_ready" value={publicationReady ? "yes" : "no"} />
          </section>

          <section className="panel settings-stack">
            <h2>РСЃС‚РѕС‡РЅРёРєРё Рё Р±РёР±Р»РёРѕРіСЂР°С„РёСЏ</h2>
            <label className="field">
              <span>РСЃС‚РѕС‡РЅРёРєРё вЂ” РїРѕ РѕРґРЅРѕРјСѓ РЅР° СЃС‚СЂРѕРєСѓ</span>
              <textarea
                name="sources"
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="РќР°Р·РІР°РЅРёРµ вЂ” https://вЂ¦"
              />
            </label>
            <label className="field">
              <span>Р‘РёР±Р»РёРѕРіСЂР°С„РёСЏ вЂ” РїРѕ РѕРґРЅРѕР№ Р·Р°РїРёСЃРё РЅР° СЃС‚СЂРѕРєСѓ</span>
              <textarea
                name="bibliography"
                defaultValue={listValue(article.bibliography)}
              />
            </label>
          </section>
        </aside>
      </div>

      {mediaComposerKind && (
        <div
          className="editor-media-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMediaComposerKind(null);
          }}
        >
          <section
            className="editor-media-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-media-modal-title"
          >
            <div className="editor-media-modal-heading">
              <div>
                <span>РР·РѕР±СЂР°Р¶РµРЅРёСЏ СЃС‚Р°С‚СЊРё</span>
                <h2 id="editor-media-modal-title">
                  {mediaComposerKind === "slider"
                    ? "РЎРѕР±СЂР°С‚СЊ СЃР»Р°Р№РґРµСЂ"
                    : "РЎРѕР±СЂР°С‚СЊ РіР°Р»РµСЂРµСЋ"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Р—Р°РєСЂС‹С‚СЊ РѕРєРЅРѕ"
                onClick={() => setMediaComposerKind(null)}
              >
                Г—
              </button>
            </div>
            <p>
              Р’СЃС‚Р°РІСЊС‚Рµ РґРѕ РІРѕСЃСЊРјРё HTTPS-Р°РґСЂРµСЃРѕРІ вЂ” РїРѕ РѕРґРЅРѕРјСѓ РІ СЃС‚СЂРѕРєРµ. РР·РѕР±СЂР°Р¶РµРЅРёСЏ
              РѕСЃС‚Р°РЅСѓС‚СЃСЏ РѕРґРЅРёРј Р±Р»РѕРєРѕРј; РїРѕСЂСЏРґРѕРє СЃС‚СЂРѕРє СЃС‚Р°РЅРµС‚ РїРѕСЂСЏРґРєРѕРј РєР°РґСЂРѕРІ.
              РџРѕСЃР»Рµ РІСЃС‚Р°РІРєРё РІС‹Р±РµСЂРёС‚Рµ РєР°Р¶РґС‹Р№ РєР°РґСЂ Рё СѓС‚РѕС‡РЅРёС‚Рµ РµРіРѕ РѕРїРёСЃР°РЅРёРµ С‡РµСЂРµР·
              В«Р¤РѕС‚Рѕ / Р·Р°РјРµРЅРёС‚СЊВ».
            </p>
            <textarea
              autoFocus
              value={mediaComposerValue}
              onChange={(event) => {
                setMediaComposerValue(event.target.value);
                setMediaComposerError("");
              }}
              rows={9}
              placeholder={
                "https://вЂ¦/image-1.webp\nhttps://вЂ¦/image-2.webp\nhttps://вЂ¦/image-3.webp"
              }
              aria-label="РђРґСЂРµСЃР° РёР·РѕР±СЂР°Р¶РµРЅРёР№"
            />
            <div className="editor-media-modal-summary">
              <span>
                {
                  mediaComposerValue
                    .split(/\r?\n/u)
                    .map((item) => item.trim())
                    .filter((item) => /^https:\/\//iu.test(item))
                    .slice(0, 8).length
                }{" "}
                РёР· 8 РёР·РѕР±СЂР°Р¶РµРЅРёР№
              </span>
            <NextLink
              href={withClientAdminPath("/media")}
              target="_blank"
            >
              РћС‚РєСЂС‹С‚СЊ РјРµРґРёР°С‚РµРєСѓ в†—
            </NextLink>
            </div>
            {mediaComposerError && (
              <p className="editor-media-modal-error" role="alert">
                {mediaComposerError}
              </p>
            )}
            <div className="editor-media-modal-actions">
              <button
                className="button-secondary"
                type="button"
                onClick={() => setMediaComposerKind(null)}
              >
                РћС‚РјРµРЅР°
              </button>
              <button className="button" type="button" onClick={confirmMediaCollection}>
                {mediaComposerKind === "slider"
                  ? "Р’СЃС‚Р°РІРёС‚СЊ СЃР»Р°Р№РґРµСЂ"
                  : "Р’СЃС‚Р°РІРёС‚СЊ РіР°Р»РµСЂРµСЋ"}
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="editor-footer">
        <small>
          {wordCount.toLocaleString("ru-RU")} СЃР»РѕРІ
          {savedLocallyAt ? ` В· СЂРµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ ${savedLocallyAt}` : ""}
          {isDirty ? " В· РµСЃС‚СЊ РЅРµСЃРѕС…СЂР°РЅС‘РЅРЅС‹Рµ РёР·РјРµРЅРµРЅРёСЏ" : ""}
        </small>
        <div className="editor-actions">
          {hasRecoveryCopy && (
            <button
              className="button-secondary"
              type="button"
              onClick={restoreLocalCopy}
            >
              Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ Р»РѕРєР°Р»СЊРЅСѓСЋ РєРѕРїРёСЋ
            </button>
          )}
          {article.id && (
            <NextLink
              className="button-secondary"
              href={withClientAdminPath(`/articles/${article.id}/preview`)}
              target="_blank"
              rel="noreferrer"
            >
              РџСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ
            </NextLink>
          )}
          <button className="button-secondary" type="submit" name="intent" value="save">
            РЎРѕС…СЂР°РЅРёС‚СЊ
          </button>
          <button className="button" type="submit" name="intent" value="publish" disabled={!publicationReady} title={publicationReady ? "Опубликовать материал" : "Заполните требования чеклиста"}>
            Опубликовать
          </button>
          <button
            className="button"
            type="submit"
            name="intent"
            value="publish"
            title="Опубликовать без проверки"
            onClick={(event) => {
              const form = event.currentTarget.form;
              const overrideInput = form?.querySelector("input[name=\"publication_override\"]") as HTMLInputElement | null;
              if (overrideInput) overrideInput.value = "1";
              if (!window.confirm("Действительно опубликовать эту статью без проверки готовности?")) {
                event.preventDefault();
                if (overrideInput) overrideInput.value = "0";
              }
            }}
          >
            Опубликовать сейчас
          </button>
        </div>
      </footer>
    </form>
  );
}
