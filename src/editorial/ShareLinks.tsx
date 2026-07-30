import { useState } from "react";

type Props = {
  url: string;
  title: string;
};

export default function ShareLinks({ url, title }: Props) {
  const [copied, setCopied] = useState(false);
  const configuredOrigin = import.meta.env.VITE_PUBLIC_SITE_URL?.trim().replace(
    /\/+$/,
    ""
  );
  const publicOrigin =
    configuredOrigin ||
    (typeof window !== "undefined" ? window.location.origin : "https://probpera.ru");
  const absoluteUrl = new URL(url, `${publicOrigin}/`).href;
  const encodedUrl = encodeURIComponent(absoluteUrl);
  const encodedTitle = encodeURIComponent(title);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.open(absoluteUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="share-links" aria-label={`Поделиться материалом «${title}»`}>
      <span>Поделиться</span>
      <a
        href={`https://vk.com/share.php?url=${encodedUrl}&title=${encodedTitle}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Поделиться во ВКонтакте"
      >
        VK
      </a>
      <a
        href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Поделиться в Telegram"
      >
        TG
      </a>
      <a
        href={`https://connect.ok.ru/offer?url=${encodedUrl}&title=${encodedTitle}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Поделиться в Одноклассниках"
      >
        OK
      </a>
      <button type="button" onClick={() => void copyLink()}>
        {copied ? "Ссылка скопирована" : "Копировать"}
      </button>
    </div>
  );
}
