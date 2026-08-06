import Link from "next/link";

import HomepageMediaField, {
  type HomepageMediaOption,
} from "@/components/HomepageMediaField";
import HomepageVisualPreview from "@/components/HomepageVisualPreview";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { adminEnv } from "@/lib/env";
import {
  createHomepageBlockAction,
  deleteHomepageBlockAction,
  moveHomepageBlockAction,
  republishHomepageAction,
  toggleHomepageBlockAction,
  updateHomepageBlockAction,
} from "./actions";

export const metadata = { title: "Р“Р»Р°РІРЅР°СЏ СЃС‚СЂР°РЅРёС†Р°" };

const blockLabels: Record<string, string> = {
  hero: "РџРµСЂРІС‹Р№ СЌРєСЂР°РЅ",
  "article-grid": "РЎРµС‚РєР° СЃС‚Р°С‚РµР№",
  carousel: "РљР°СЂСѓСЃРµР»СЊ",
  "editors-choice": "Р’С‹Р±РѕСЂ СЂРµРґР°РєС†РёРё",
  popular: "РџРѕРїСѓР»СЏСЂРЅРѕРµ",
  latest: "РќРѕРІРѕРµ",
  categories: "Р Р°Р·РґРµР»С‹",
  "book-vs-screen": "РљРЅРёРіР° Рё СЌРєСЂР°РЅРёР·Р°С†РёСЏ",
  "literary-map": "Р›РёС‚РµСЂР°С‚СѓСЂРЅР°СЏ РєР°СЂС‚Р°",
  awards: "РџСЂРµРјРёРё",
  subscription: "РџРѕРґРїРёСЃРєР°",
  text: "РўРµРєСЃС‚РѕРІС‹Р№ Р±Р»РѕРє",
};

const backgroundLabels: Record<string, string> = {
  violet: "Р¤РёРѕР»РµС‚РѕРІС‹Р№",
  orange: "РћСЂР°РЅР¶РµРІС‹Р№",
  paper: "Р‘СѓРјР°РіР° СЃ РјР°Р·РєР°РјРё",
  light: "РЎРІРµС‚Р»С‹Р№",
  transparent: "РџСЂРѕР·СЂР°С‡РЅС‹Р№",
};

function settingsObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function settingText(settings: Record<string, unknown>, key: string) {
  const value = settings[key];
  return typeof value === "string" ? value : "";
}

function articleIds(settings: Record<string, unknown>) {
  const value = settings.articleIds;
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join("\n")
    : "";
}

function BackgroundSelect({ value }: { value: string }) {
  return (
    <select name="background_style" defaultValue={value}>
      {Object.entries(backgroundLabels).map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

export default async function HomepagePage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    deleted?: string;
    published?: string;
  }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const [{ data: blocksResult }, { data: mediaResult }] = await Promise.all([
    supabase.from("homepage_blocks").select("*").order("display_order"),
    supabase
      .from("media_assets")
      .select("id,bucket,object_path,alt_text,collection_name")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(240),
  ]);
  const blocks = blocksResult || [];
  const media: HomepageMediaOption[] = (mediaResult || []).map((asset) => ({
    id: asset.id,
    label:
      asset.alt_text || asset.collection_name || asset.object_path.split("/").pop() || "РР·РѕР±СЂР°Р¶РµРЅРёРµ",
    publicUrl: supabase.storage.from(asset.bucket).getPublicUrl(asset.object_path).data.publicUrl,
  }));
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Р’РёС‚СЂРёРЅР° Р¶СѓСЂРЅР°Р»Р°</span>
          <h1>Р“Р»Р°РІРЅР°СЏ СЃС‚СЂР°РЅРёС†Р°</h1>
          <p>
            Р—РґРµСЃСЊ РЅР°СЃС‚СЂР°РёРІР°СЋС‚СЃСЏ РѕРїСѓР±Р»РёРєРѕРІР°РЅРЅС‹Рµ СЂРµРґР°РєС†РёРѕРЅРЅС‹Рµ Р±Р»РѕРєРё. РџРѕСЃР»Рµ
            СЃРѕС…СЂР°РЅРµРЅРёСЏ РїР°РЅРµР»СЊ Р·Р°РїСѓСЃРєР°РµС‚ Р±РµР·РѕРїР°СЃРЅСѓСЋ РїРµСЂРµСЃР±РѕСЂРєСѓ СЃР°Р№С‚Р°, Р° РіР»РѕР±СѓСЃ Рё
            РѕСЃРЅРѕРІРЅС‹Рµ СЂР°Р·РґРµР»С‹ РѕСЃС‚Р°СЋС‚СЃСЏ РїРѕСЃС‚РѕСЏРЅРЅРѕР№ С‡Р°СЃС‚СЊСЋ РіР»Р°РІРЅРѕР№.
          </p>
        </div>
        <div className="editor-actions">
          <Link className="button-secondary" href="/media">
            РћС‚РєСЂС‹С‚СЊ РјРµРґРёР°С‚РµРєСѓ
          </Link>
          <form action={republishHomepageAction}>
            <button className="button-secondary" type="submit">
              Republish homepage
            </button>
          </form>
          <a
            className="button"
            href={adminEnv.publicSiteUrl}
            target="_blank"
            rel="noreferrer"
          >
            РџРѕСЃРјРѕС‚СЂРµС‚СЊ РіР»Р°РІРЅСѓСЋ в†—
          </a>
        </div>
      </header>

      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && (
        <p className="form-message form-success">
          РР·РјРµРЅРµРЅРёСЏ СЃРѕС…СЂР°РЅРµРЅС‹ Рё РїРѕСЃС‚Р°РІР»РµРЅС‹ РІ РѕС‡РµСЂРµРґСЊ РїСѓР±Р»РёРєР°С†РёРё. РџСѓР±Р»РёС‡РЅР°СЏ
          РІРµСЂСЃРёСЏ РѕР±РЅРѕРІРёС‚СЃСЏ РїРѕСЃР»Рµ Р±РµР·РѕРїР°СЃРЅРѕР№ РїРµСЂРµСЃР±РѕСЂРєРё.
        </p>
      )}
      {query.published === "started" && (
        <p className="form-message form-success">
          Publication publish started. Changes are queued for deploy.
        </p>
      )}
      {query.published === "queue-error" && (
        <p className="form-message form-success">
          Queue request rejected. The system will retry automatically.
        </p>
      )}
      {query.published === "disabled" && (
        <p className="form-message form-error">
          Publish is currently unavailable. Please check build hook settings.
        </p>
      )}

      {query.deleted && (
        <p className="form-message form-success">
          Р‘Р»РѕРє СѓРґР°Р»С‘РЅ Рё РёР·РјРµРЅРµРЅРёРµ РїРѕСЃС‚Р°РІР»РµРЅРѕ РІ РѕС‡РµСЂРµРґСЊ РїСѓР±Р»РёРєР°С†РёРё.
        </p>
      )}

      <HomepageVisualPreview url={adminEnv.publicSiteUrl} />

      {blocks.length ? (
        <div className="module-grid">
          {blocks.map((block, index) => {
            const settings = settingsObject(block.settings);
            return (
              <article className="panel settings-stack" key={block.id}>
                <div className="page-heading">
                  <div>
                    <span className="badge">
                      {index + 1}.{" "}
                      {blockLabels[block.block_type] || block.block_type}
                    </span>
                    <h2>{block.title || "Р‘РµР· Р·Р°РіРѕР»РѕРІРєР°"}</h2>
                  </div>
                  <div className="editor-actions">
                    <form action={moveHomepageBlockAction}>
                      <input type="hidden" name="id" value={block.id} />
                      <button
                        className="button-secondary"
                        type="submit"
                        name="direction"
                        value="up"
                        disabled={index === 0}
                        aria-label="РџРѕРґРЅСЏС‚СЊ Р±Р»РѕРє"
                      >
                        в†‘
                      </button>
                    </form>
                    <form action={moveHomepageBlockAction}>
                      <input type="hidden" name="id" value={block.id} />
                      <button
                        className="button-secondary"
                        type="submit"
                        name="direction"
                        value="down"
                        disabled={index === blocks.length - 1}
                        aria-label="РћРїСѓСЃС‚РёС‚СЊ Р±Р»РѕРє"
                      >
                        в†“
                      </button>
                    </form>
                  </div>
                </div>

                <form
                  className="settings-stack"
                  action={updateHomepageBlockAction}
                >
                  <input type="hidden" name="id" value={block.id} />
                  <label className="field">
                    <span>Р—Р°РіРѕР»РѕРІРѕРє</span>
                    <input name="title" defaultValue={block.title} />
                  </label>
                  <label className="field">
                    <span>РќР°РґР·Р°РіРѕР»РѕРІРѕРє</span>
                    <input
                      name="eyebrow"
                      defaultValue={settingText(settings, "eyebrow")}
                      placeholder="РќР°РїСЂРёРјРµСЂ: Р’С‹Р±РѕСЂ СЂРµРґР°РєС†РёРё"
                    />
                  </label>
                  <label className="field">
                    <span>РћРїРёСЃР°РЅРёРµ</span>
                    <textarea
                      name="description"
                      defaultValue={
                        settingText(settings, "description") ||
                        settingText(settings, "copy")
                      }
                      placeholder="РљРѕСЂРѕС‚РєРёР№ С‚РµРєСЃС‚ Р±Р»РѕРєР°"
                    />
                  </label>
                  <label className="field">
                    <span>Р¤РѕРЅ</span>
                    <BackgroundSelect value={block.background_style} />
                  </label>
                  <div className="field">
                    <span>Р¤РѕРЅРѕРІРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ РёР· РјРµРґРёР°С‚РµРєРё</span>
                    <HomepageMediaField value={block.background_media_id} media={media} />
                    <small>
                      РР·РѕР±СЂР°Р¶РµРЅРёРµ РїСЂРёРјРµРЅСЏРµС‚СЃСЏ РЅР° РІСЃСЋ С€РёСЂРёРЅСѓ Р±Р»РѕРєР° Рё Р°РґР°РїС‚РёСЂСѓРµС‚СЃСЏ
                      РґР»СЏ РјРѕР±РёР»СЊРЅРѕРіРѕ СЌРєСЂР°РЅР°.
                    </small>
                  </div>
                  {block.background_media_id && mediaById.get(block.background_media_id) && (
                    <img
                      className="homepage-block-preview"
                      src={mediaById.get(block.background_media_id)!.publicUrl}
                      alt="РџСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ С„РѕРЅРѕРІРѕРіРѕ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ Р±Р»РѕРєР°"
                    />
                  )}
                  <div className="dashboard-grid">
                    <label className="field">
                      <span>РўРµРєСЃС‚ РєРЅРѕРїРєРё</span>
                      <input
                        name="button_text"
                        defaultValue={settingText(settings, "buttonText")}
                      />
                    </label>
                    <label className="field">
                      <span>РЎСЃС‹Р»РєР° РєРЅРѕРїРєРё</span>
                      <input
                        name="button_url"
                        defaultValue={settingText(settings, "buttonUrl")}
                        placeholder="#atlas РёР»Рё https://вЂ¦"
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>РЎС‚Р°С‚СЊРё Р±Р»РѕРєР°</span>
                    <textarea
                      name="article_ids"
                      defaultValue={articleIds(settings)}
                      placeholder="РџРѕ РѕРґРЅРѕРјСѓ ID СЃС‚Р°С‚СЊРё РЅР° СЃС‚СЂРѕРєСѓ. Р•СЃР»Рё РѕСЃС‚Р°РІРёС‚СЊ РїСѓСЃС‚С‹Рј, СЃР°Р№С‚ РІС‹Р±РµСЂРµС‚ СЃРІРµР¶РёРµ РїСѓР±Р»РёРєР°С†РёРё."
                    />
                  </label>
                  <button className="button" type="submit">
                    РЎРѕС…СЂР°РЅРёС‚СЊ Р±Р»РѕРє
                  </button>
                </form>

                <div className="editor-actions">
                  <form action={toggleHomepageBlockAction}>
                    <input type="hidden" name="id" value={block.id} />
                    <input
                      type="hidden"
                      name="enabled"
                      value={block.is_enabled ? "false" : "true"}
                    />
                    <button className="button-secondary" type="submit">
                      {block.is_enabled ? "РЎРєСЂС‹С‚СЊ РЅР° СЃР°Р№С‚Рµ" : "РџРѕРєР°Р·Р°С‚СЊ РЅР° СЃР°Р№С‚Рµ"}
                    </button>
                  </form>
                  <form action={deleteHomepageBlockAction}>
                    <input type="hidden" name="id" value={block.id} />
                    <button className="button-secondary" type="submit">
                      РЈРґР°Р»РёС‚СЊ
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="panel empty-state">
          <div>
            <h2>РЈРїСЂР°РІР»СЏРµРјС‹С… Р±Р»РѕРєРѕРІ РїРѕРєР° РЅРµС‚</h2>
            <p>
              РўРµРєСѓС‰Р°СЏ РіР»Р°РІРЅР°СЏ РїСЂРѕРґРѕР»Р¶Р°РµС‚ СЂР°Р±РѕС‚Р°С‚СЊ. Р”РѕР±Р°РІСЊС‚Рµ РїРµСЂРІС‹Р№ Р±Р»РѕРє, С‡С‚РѕР±С‹
              СѓРїСЂР°РІР»СЏС‚СЊ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕР№ СЂРµРґР°РєС†РёРѕРЅРЅРѕР№ РІРёС‚СЂРёРЅРѕР№ РёР· РїР°РЅРµР»Рё.
            </p>
          </div>
        </section>
      )}

      <form
        className="panel settings-stack"
        action={createHomepageBlockAction}
      >
        <h2>Р”РѕР±Р°РІРёС‚СЊ Р±Р»РѕРє</h2>
        <div className="dashboard-grid">
          <label className="field">
            <span>РўРёРї</span>
            <select name="block_type">
              {Object.entries(blockLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Р¤РѕРЅ</span>
            <BackgroundSelect value="paper" />
          </label>
          <div className="field">
            <span>Р¤РѕРЅРѕРІРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ</span>
            <HomepageMediaField media={media} />
          </div>
        </div>
        <label className="field">
          <span>Р—Р°РіРѕР»РѕРІРѕРє</span>
          <input name="title" />
        </label>
        <label className="field">
          <span>РќР°РґР·Р°РіРѕР»РѕРІРѕРє</span>
          <input name="eyebrow" />
        </label>
        <label className="field">
          <span>РћРїРёСЃР°РЅРёРµ</span>
          <textarea name="description" />
        </label>
        <div className="dashboard-grid">
          <label className="field">
            <span>РўРµРєСЃС‚ РєРЅРѕРїРєРё</span>
            <input name="button_text" />
          </label>
          <label className="field">
            <span>РЎСЃС‹Р»РєР° РєРЅРѕРїРєРё</span>
            <input name="button_url" />
          </label>
        </div>
        <label className="field">
          <span>ID РІС‹Р±СЂР°РЅРЅС‹С… СЃС‚Р°С‚РµР№</span>
          <textarea name="article_ids" />
        </label>
        <button className="button" type="submit">
          Р”РѕР±Р°РІРёС‚СЊ РІ РєРѕРЅРµС† РіР»Р°РІРЅРѕР№
        </button>
      </form>
    </>
  );
}
