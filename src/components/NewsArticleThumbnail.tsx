import { useState } from "react";
import type { InterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { NewsItem } from "../news/types";
import "../styles/news-article-thumbnail.css";

export default function NewsArticleThumbnail({ item, language, onRead }: {
  item: NewsItem; language: InterfaceLanguage; onRead: () => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const thumbnail = item.thumbnail;
  if (!thumbnail || failedUrl === thumbnail.url) return null;
  return <a className="literary-news__article-thumbnail" href={item.source.url}
    target="_blank" rel="noopener noreferrer" onClick={onRead}
    onAuxClick={event => { if (event.button === 1) onRead(); }}>
    <img src={thumbnail.url} alt={thumbnail.alt[language]} width={72} height={72}
      loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onError={() => setFailedUrl(thumbnail.url)} />
  </a>;
}
