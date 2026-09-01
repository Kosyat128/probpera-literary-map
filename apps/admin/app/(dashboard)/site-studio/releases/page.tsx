import Link from "next/link";

import { AdminDependencyState } from "@/components/AdminStatusState";
import { getStaffSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { siteStudioErrorMessage } from "@/lib/site-studio-messages";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  publishSiteDesignChangeSetAction,
  removeSiteDesignChangeSetItemAction,
  rollbackSiteDesignReleaseAction,
  saveSiteDesignChangeSetAction,
  transitionSiteDesignChangeSetAction,
} from "./actions";
import styles from "./releases.module.css";

export const metadata = { title: "Выпуски дизайна · Site Studio" };

type SearchMessages = {
  error?: string;
  saved?: string;
  transitioned?: string;
  published?: string;
  rolled_back?: string;
  removed?: string;
  set?: string;
};

type ChangeSetRow = {
  id: string;
  name: string;
  description: string;
  status: "draft" | "review" | "approved" | "published" | "cancelled";
  scheduled_at: string | null;
  cas_version: number;
  updated_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  published_at: string | null;
};

type ChangeSetItemRow = {
  id: number;
  change_set_id: string;
  token_id: string;
  expected_token_cas_version: number;
  proposed_value: unknown;
};

type TokenIdentityRow = {
  id: string;
  token_key: string;
  layer: string;
  target_key: string;
};

type ReleaseRow = {
  id: string;
  release_number: number;
  action: "publish" | "rollback";
  change_set_id: string | null;
  rollback_of_release_id: string | null;
  token_count: number;
  created_at: string;
};

const statusLabels: Record<ChangeSetRow["status"], string> = {
  draft: "Черновик",
  review: "На проверке",
  approved: "Одобрен",
  published: "Опубликован",
  cancelled: "Отменён",
};

function valueSummary(value: unknown) {
  const serialized = JSON.stringify(value);
  if (!serialized) return "-";
  return serialized.length > 90 ? `${serialized.slice(0, 87)}…` : serialized;
}

function minimumScheduleValue() {
  return new Date(Date.now() + 60_000).toISOString().slice(0, 16);
}

export default async function SiteStudioReleasesPage({
  searchParams,
}: {
  searchParams: Promise<SearchMessages>;
}) {
  const query = await searchParams;
  const [session, supabase] = await Promise.all([
    getStaffSession(),
    createServerSupabaseClient(),
  ]);
  if (!supabase) return <AdminDependencyState />;
  const canManage = session.role === "owner" || session.role === "admin";

  const [setResult, itemResult, tokenResult, releaseResult] = await Promise.all([
    supabase
      .from("site_design_change_sets")
      .select(
        "id,name,description,status,scheduled_at,cas_version,updated_at,submitted_at,approved_at,published_at"
      )
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("site_design_change_set_items")
      .select(
        "id,change_set_id,token_id,expected_token_cas_version,proposed_value"
      )
      .order("id", { ascending: true })
      .limit(500),
    supabase
      .from("site_design_tokens")
      .select("id,token_key,layer,target_key")
      .limit(1024),
    supabase
      .from("site_design_releases")
      .select(
        "id,release_number,action,change_set_id,rollback_of_release_id,token_count,created_at"
      )
      .order("release_number", { ascending: false })
      .limit(50),
  ]);

  const changeSets = (setResult.data || []) as ChangeSetRow[];
  const items = (itemResult.data || []) as ChangeSetItemRow[];
  const tokens = new Map(
    ((tokenResult.data || []) as TokenIdentityRow[]).map((token) => [token.id, token])
  );
  const releases = (releaseResult.data || []) as ReleaseRow[];
  const schemaUnavailable = Boolean(
    setResult.error || itemResult.error || tokenResult.error || releaseResult.error
  );

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span className="eyebrow">Site Studio · Releases</span>
          <h1>Наборы изменений и выпуски</h1>
          <p>
            Собирайте связанные настройки, отправляйте их на проверку и
            публикуйте одной транзакцией. Частично применённого дизайна не бывает.
          </p>
        </div>
        <div className={styles.headingActions}>
          <Link className="button-secondary" href="/site-studio/tokens">Токены</Link>
          <Link className="button-secondary" href="/site-studio">К разделам</Link>
        </div>
      </header>

      {schemaUnavailable && <p className={styles.message} role="alert">Схема выпусков ещё не применена к этой среде.</p>}
      {query.error && <p className={styles.message} role="alert">{siteStudioErrorMessage(query.error)}</p>}
      {(query.saved || query.transitioned || query.published || query.rolled_back || query.removed) && (
        <p className={`${styles.message} ${styles.success}`} role="status">
          {query.published
            ? "Выпуск опубликован атомарно."
            : query.rolled_back
              ? "Опубликованный выпуск откачен новой групповой ревизией."
              : query.removed
                ? "Настройка удалена из черновика выпуска."
                : query.transitioned
                  ? "Этап согласования обновлён."
                  : "Набор изменений сохранён."}
        </p>
      )}

      <section className={styles.createPanel}>
        <div>
          <span className="eyebrow">Новый набор</span>
          <h2>Соберите логически связанный выпуск</h2>
          <p>Например: новая палитра журнала, мобильная сетка или сезонное оформление.</p>
        </div>
        <form action={saveSiteDesignChangeSetAction}>
          <label className="field">
            <span>Название</span>
            <input name="name" maxLength={160} required placeholder="Осеннее оформление журнала" />
          </label>
          <label className="field">
            <span>Что и зачем меняется</span>
            <textarea name="description" maxLength={1200} rows={3} placeholder="Кратко опишите цель и область проверки" />
          </label>
          <button className="button" type="submit" disabled={!canManage}>Создать черновик</button>
        </form>
      </section>

      <div className={styles.workspace}>
        <main className={styles.sets}>
          <header><span className="eyebrow">Change sets</span><h2>Согласование</h2></header>
          {changeSets.length === 0 && <p className={styles.empty}>Наборов изменений пока нет.</p>}
          {changeSets.map((changeSet) => {
            const setItems = items.filter((item) => item.change_set_id === changeSet.id);
            return (
              <article className={styles.setCard} id={`set-${changeSet.id}`} key={changeSet.id}>
                <header>
                  <div>
                    <span className={`${styles.status} ${styles[changeSet.status]}`}>{statusLabels[changeSet.status]}</span>
                    <h3>{changeSet.name}</h3>
                    <p>{changeSet.description || "Описание не добавлено."}</p>
                  </div>
                  <small>v{changeSet.cas_version} · {formatDate(changeSet.updated_at, true)}</small>
                </header>

                <div className={styles.items}>
                  {setItems.map((item) => {
                    const token = tokens.get(item.token_id);
                    return (
                      <div className={styles.item} key={item.id}>
                        <div>
                          <strong>{token?.token_key || item.token_id}</strong>
                          <small>{token ? `${token.layer} · ${token.target_key}` : "Токен недоступен"}</small>
                          <code>{valueSummary(item.proposed_value)}</code>
                        </div>
                        {changeSet.status === "draft" && (
                          <form action={removeSiteDesignChangeSetItemAction}>
                            <input type="hidden" name="change_set_id" value={changeSet.id} />
                            <input type="hidden" name="token_id" value={item.token_id} />
                            <input type="hidden" name="expected_version" value={changeSet.cas_version} />
                            <button type="submit" disabled={!canManage}>Убрать</button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                  {setItems.length === 0 && <p className={styles.empty}>Добавьте токены из раздела «Токены дизайна».</p>}
                </div>

                <footer className={styles.actions}>
                  {changeSet.status === "draft" && (
                    <>
                      <details>
                        <summary>Изменить описание</summary>
                        <form action={saveSiteDesignChangeSetAction}>
                          <input type="hidden" name="change_set_id" value={changeSet.id} />
                          <input type="hidden" name="expected_version" value={changeSet.cas_version} />
                          <label className="field"><span>Название</span><input name="name" maxLength={160} defaultValue={changeSet.name} required /></label>
                          <label className="field"><span>Описание</span><textarea name="description" maxLength={1200} defaultValue={changeSet.description} rows={3} /></label>
                          <button className="button-secondary" type="submit" disabled={!canManage}>Сохранить</button>
                        </form>
                      </details>
                      <form action={transitionSiteDesignChangeSetAction}>
                        <input type="hidden" name="change_set_id" value={changeSet.id} />
                        <input type="hidden" name="expected_version" value={changeSet.cas_version} />
                        <input type="hidden" name="next_status" value="review" />
                        <button className="button" type="submit" disabled={!canManage || setItems.length === 0}>Отправить на проверку</button>
                      </form>
                    </>
                  )}
                  {changeSet.status === "review" && (
                    <form className={styles.approval} action={transitionSiteDesignChangeSetAction}>
                      <input type="hidden" name="change_set_id" value={changeSet.id} />
                      <input type="hidden" name="expected_version" value={changeSet.cas_version} />
                      <input type="hidden" name="next_status" value="approved" />
                      <label className="field"><span>Опубликовать не раньше (необязательно)</span><input type="datetime-local" name="scheduled_at" min={minimumScheduleValue()} /></label>
                      <button className="button" type="submit" disabled={!canManage}>Одобрить выпуск</button>
                    </form>
                  )}
                  {changeSet.status === "approved" && (
                    <form action={publishSiteDesignChangeSetAction}>
                      <input type="hidden" name="change_set_id" value={changeSet.id} />
                      <input type="hidden" name="expected_version" value={changeSet.cas_version} />
                      <button className="button" type="submit" disabled={!canManage}>Опубликовать атомарно</button>
                      {changeSet.scheduled_at && <small>Запланировано: {formatDate(changeSet.scheduled_at, true)}</small>}
                    </form>
                  )}
                  {(changeSet.status === "draft" || changeSet.status === "review" || changeSet.status === "approved") && (
                    <form action={transitionSiteDesignChangeSetAction}>
                      <input type="hidden" name="change_set_id" value={changeSet.id} />
                      <input type="hidden" name="expected_version" value={changeSet.cas_version} />
                      <input type="hidden" name="next_status" value="cancelled" />
                      <button className="button-secondary" type="submit" disabled={!canManage}>Отменить</button>
                    </form>
                  )}
                </footer>
              </article>
            );
          })}
        </main>

        <aside className={styles.releaseHistory}>
          <header><span className="eyebrow">История</span><h2>Опубликованные выпуски</h2></header>
          <div className={styles.releaseList}>
            {releases.map((release, index) => (
              <article key={release.id}>
                <span>№ {release.release_number}</span>
                <strong>{release.action === "publish" ? "Публикация" : "Откат"}</strong>
                <small>{release.token_count} настроек · {formatDate(release.created_at, true)}</small>
                {index === 0 && release.action === "publish" && (
                  <form action={rollbackSiteDesignReleaseAction}>
                    <input type="hidden" name="release_id" value={release.id} />
                    <button type="submit" disabled={!canManage}>Откатить выпуск</button>
                  </form>
                )}
              </article>
            ))}
            {releases.length === 0 && <p className={styles.empty}>Публикаций ещё не было.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
