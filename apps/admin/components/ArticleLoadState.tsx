import AdminStatusState from "./AdminStatusState";
import { adminReadMessage, type AdminReadIssue } from "@/lib/admin-read-result";

export default function ArticleLoadState({
  issue,
  retryHref,
}: {
  issue: AdminReadIssue;
  retryHref: string;
}) {
  return (
    <AdminStatusState
      eyebrow="Редактор статьи"
      title="Не удалось загрузить данные редактора"
      description={adminReadMessage(issue)}
      action={<a className="button-secondary" href={retryHref}>Повторить загрузку</a>}
    />
  );
}
