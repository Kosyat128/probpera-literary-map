import AdminStatusState from "../../../components/AdminStatusState";

export function isHiddenArticleRead(status: number, code: string) {
  return status === 401 || status === 403 || code === "22P02";
}

export function ArticleReadUnavailable({ retryHref }: { retryHref: string }) {
  return (
    <AdminStatusState
      eyebrow="Подключение данных"
      title="Статью временно не удалось открыть"
      description="Не удалось загрузить данные статьи. Повторите загрузку через несколько минут."
      action={<a className="button-secondary" href={retryHref}>Повторить загрузку</a>}
    />
  );
}
