import { useState } from "react";

import { SocialMark, type SocialMarkId } from "../components/SocialLinks";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

type Props = {
  url: string;
  title: string;
};

export default function ShareLinks({ url, title }: Props) {
  const { t } = useInterfaceLanguage();
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
  const shareItems: Array<{
    id: Extract<SocialMarkId, "vk" | "telegram" | "ok">;
    label: string;
    href: string;
  }> = [
    {
      id: "vk",
      label: t("Поделиться во ВКонтакте"),
      href: `https://vk.com/share.php?url=${encodedUrl}&title=${encodedTitle}`,
    },
    {
      id: "telegram",
      label: t("Поделиться в Telegram"),
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      id: "ok",
      label: t("Поделиться в Одноклассниках"),
      href: `https://connect.ok.ru/offer?url=${encodedUrl}&title=${encodedTitle}`,
    },
  ];

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
    <div className="share-links" aria-label={`${t("Поделиться материалом")} “${title}”`}>
      <span>{t("Поделиться")}</span>
      {shareItems.map((item) => (
        <a
          className={`share-icon is-${item.id}`}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          aria-label={item.label}
          title={item.label}
          key={item.id}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <SocialMark id={item.id} />
          </svg>
        </a>
      ))}
      <button
        className={`share-icon is-copy${copied ? " is-copied" : ""}`}
        type="button"
        onClick={() => void copyLink()}
        aria-label={copied ? t("Ссылка скопирована") : t("Копировать ссылку")}
        title={copied ? t("Ссылка скопирована") : t("Копировать ссылку")}
      >
        {copied ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5.5 12.3 4.1 4.1L18.8 7" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9.2 14.8 14.8 9m-7.3 8.7-1.2 1.2a3.45 3.45 0 0 1-4.9-4.9l3.1-3.1a3.45 3.45 0 0 1 4.9 0m7.1-4.6 1.2-1.2a3.45 3.45 0 1 1 4.9 4.9l-3.1 3.1a3.45 3.45 0 0 1-4.9 0" />
          </svg>
        )}
      </button>
    </div>
  );
}
