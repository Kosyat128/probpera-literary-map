import { useId } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { BookyJourneyPlan } from "./bookyJourney";
import "./BookyJourneyFactSources.css";

export type BookyJourneyFactSourcesProps = {
  node: BookyJourneyPlan["nodes"][number] | null;
};

/** Draft interface labels; citations come only from the current admitted fact. */
export const bookyJourneyFactSourcesCopy = {
  reviewStatus: "draft", productionReady: false,
  locales: {
    ru: { heading: "Источники", accessed: "Дата обращения:" },
    en: { heading: "Sources", accessed: "Accessed:" },
  },
} as const;

export default function BookyJourneyFactSources({ node }: BookyJourneyFactSourcesProps) {
  const { language } = useInterfaceLanguage(), id = useId();
  const copy = bookyJourneyFactSourcesCopy.locales[language];
  const payload = node?.dialogue.payload;
  if (node?.kind !== "sourced-fact" || !node.fact || !payload
    || payload.locale !== language || payload.intent !== "sourced-fact"
    || payload.claimKind !== "factual" || payload.provenance.kind !== "editorial"
    || payload.factualSources.length === 0) return null;

  return <details className="booky-journey-fact-sources"
    data-booky-journey-fact-sources={node.fact.semanticChecksum} data-booky-journey-fact-locale={payload.locale}>
    <summary id={`${id}-summary`} data-booky-journey-fact-sources-summary="">{copy.heading}</summary>
    <ul className="booky-journey-fact-sources__list" aria-labelledby={`${id}-summary`}
      data-booky-journey-fact-sources-list="">
      {payload.factualSources.map(source => <li key={source.id} data-booky-journey-fact-source={source.id}>
        <span className="booky-journey-fact-sources__url" data-booky-journey-fact-source-url="">{source.url}</span>
        <span className="booky-journey-fact-sources__accessed">{copy.accessed}{" "}
          <time dateTime={source.accessedAt} data-booky-journey-fact-source-accessed="">{source.accessedAt.slice(0, 10)}</time>
        </span>
      </li>)}
    </ul>
  </details>;
}
