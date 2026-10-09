import {
  approvePremiumTranslationWorkingDraftAction,
  discardPremiumTranslationWorkingDraftAction,
} from "@/app/(dashboard)/translations/premium-review-actions";
import type { PremiumTranslationReviewView } from "@/lib/premium-translation-review";
import { formatDate } from "@/lib/format";

import ConfirmSubmitButton from "./ConfirmSubmitButton";

type PendingReview = Extract<PremiumTranslationReviewView, { status: "pending" }>;
type ReviewText = PendingReview["currentSource"];
type ReturnTo = "library" | "editorial-database";

const countryTextLabels = {
  name: "Название", region: "Регион", continent: "Континент",
  officialLanguage: "Официальный язык", capital: "Столица",
  description: "Описание", history: "История", historicalNote: "Историческая заметка",
} as const;
const countryListLabels = {
  literaryPeriods: "Литературные периоды", literaryMovements: "Литературные направления",
  periods: "Периоды", facts: "Факты", literaryPlaces: "Литературные места",
} as const;

function TextColumn({ heading, text, language }: {
  heading: string;
  text: ReviewText | null;
  language: "ru" | "en";
}) {
  return <section className="work-workspace-section">
    <h3>{heading}</h3>
    {!text ? <p>{language === "ru" ? "Текущий русский источник не найден." : "Сохранённого английского текста нет."}</p> : <div lang={language}>
      {text.fields ? <>
        {Object.entries(countryTextLabels).map(([key, label]) => {
          const value = text.fields![key as keyof typeof countryTextLabels];
          return value ? <div key={key}>
            <h4>{label}</h4><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{value}</p>
          </div> : null;
        })}
        {Object.entries(countryListLabels).map(([key, label]) => {
          const values = text.fields![key as keyof typeof countryListLabels];
          return values.length ? <div key={key}>
            <h4>{label}</h4><ul>{values.map((value, index) => <li key={index} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{value}</li>)}</ul>
          </div> : null;
        })}
        {(["timeline", "chronology"] as const).map((key) => {
          const values = text.fields![key];
          return values.length ? <div key={key}>
            <h4>{key === "timeline" ? "События" : "Хронология"}</h4>
            <ol>{values.map((value, index) => <li key={index}>
              <strong>{value.year}{value.year && value.title ? ": " : ""}{value.title}</strong>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{value.description}</p>
            </li>)}</ol>
          </div> : null;
        })}
      </> : <>
        <h4>{text.title}</h4>
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{text.description || "Описание отсутствует."}</p>
      </>}
    </div>}
  </section>;
}

function IdentityFields({ view, returnTo }: { view: PendingReview; returnTo: ReturnTo }) {
  return <>
    <input type="hidden" name="entity_type" value={view.draft.entityType} />
    <input type="hidden" name="entity_id" value={view.draft.entityId} />
    <input type="hidden" name="draft_id" value={view.draft.id} />
    <input type="hidden" name="expected_version" value={view.draft.version} />
    <input type="hidden" name="candidate_hash" value={view.draft.candidateHash} />
    <input type="hidden" name="return_to" value={returnTo} />
  </>;
}

export default function PremiumTranslationReviewPanel({ view, returnTo }: {
  view: PremiumTranslationReviewView;
  returnTo: ReturnTo;
}) {
  if (view.status === "none") return null;
  if (view.status === "unavailable") return <section className="panel" aria-label="Проверка английского перевода">
    <h2>Проверка английского перевода</h2>
    <p className="form-message form-error" role="alert">{view.problem}</p>
  </section>;

  return <section className="panel" id="premium-translation-review" aria-label="Проверка английского перевода">
    <header>
      <h2>Английский перевод ожидает проверки</h2>
      <span className="badge">Машинный черновик</span>
      <p>Новый вариант не опубликован. Проверьте перевод, факты и источники перед принятием.</p>
      <p>
        Модель перевода: {view.draft.provenance.translatorModel}.
        {view.draft.provenance.reviewerModel && <> Модель повторной проверки: {view.draft.provenance.reviewerModel}.</>}
        {" "}Создан: <time dateTime={view.draft.provenance.generatedAt}>{formatDate(view.draft.provenance.generatedAt, true)}</time>.
      </p>
    </header>
    {view.problem && <p className="form-message form-error" role="alert">{view.problem}</p>}
    <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))" }}>
      <TextColumn heading="Русский источник" text={view.currentSource} language="ru" />
      <TextColumn heading="Текущий английский текст" text={view.currentEnglish} language="en" />
      <TextColumn heading="Новый машинный перевод" text={view.candidateEnglish} language="en" />
    </div>
    {view.draft.entityType === "literary_work" && <details>
      <summary>Источники перевода и названия</summary>
      <p>{view.draft.payload.bibliographicTitle.provider}: {view.draft.payload.bibliographicTitle.value}</p>
      <ul>{view.draft.payload.sourceUrls.map((url) => <li key={url} style={{ overflowWrap: "anywhere" }}>{url}</li>)}</ul>
    </details>}
    {view.canPromote && <form className="settings-stack" action={approvePremiumTranslationWorkingDraftAction}>
      <IdentityFields view={view} returnTo={returnTo} />
      <label className="checkbox-field">
        <input type="checkbox" name="confirm_human_review" value="yes" required />
        <span>Я проверил(а) английский текст, факты и источники.</span>
      </label>
      <ConfirmSubmitButton message="Принять этот английский текст после вашей проверки и запросить публикацию?">
        Принять проверенный EN и запросить публикацию
      </ConfirmSubmitButton>
    </form>}
    <form className="settings-stack" action={discardPremiumTranslationWorkingDraftAction}>
      <IdentityFields view={view} returnTo={returnTo} />
      <ConfirmSubmitButton message="Удалить этот машинный черновик? Сохранённые RU и EN останутся без изменений.">
        Удалить машинный черновик
      </ConfirmSubmitButton>
    </form>
  </section>;
}
