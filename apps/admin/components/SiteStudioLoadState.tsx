import { adminReadMessage, type AdminReadIssue } from "@/lib/admin-read-result";

export default function SiteStudioLoadState({ issue, retryHref, sections, message }: {
  issue: AdminReadIssue; retryHref: string; sections: { label: string; rows: string[] }[]; message?: string;
}) {
  return <>
    <p className="form-message form-error" role="alert">
      {message ?? adminReadMessage(issue)}{" "}Редактор недоступен до полной проверки данных. Показаны только прочитанные записи.{" "}
      <a href={retryHref}>Повторить загрузку</a>
    </p>
    {sections.map((section) => <section className="panel" key={section.label}>
      <h2>{section.label}</h2>
      {section.rows.map((row, index) => <p key={index}>{row}</p>)}
    </section>)}
  </>;
}
