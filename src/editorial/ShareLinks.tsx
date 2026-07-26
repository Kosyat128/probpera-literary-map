import { useState } from "react";

type Props = {
  url: string;
  title: string;
};

export default function ShareLinks({ url, title }: Props) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
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
