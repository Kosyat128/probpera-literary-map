import { cmsSiteContent } from "../data/cms/site.generated";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

type Banner = {
  id: string;
  title: string;
  description: string;
  targetUrl?: string | null;
  buttonText?: string;
  pagePatterns?: string[];
  desktopImageUrl?: string;
  tabletImageUrl?: string;
  mobileImageUrl?: string;
};

type NavigationItem = {
  id: string;
  parentId?: string | null;
  label: string;
  href: string;
  openInNewTab?: boolean;
  displayOrder: number;
};

type NavigationMenu = {
  id: string;
  name: string;
  location: "header" | "footer";
  items: readonly NavigationItem[];
};

function safeHref(value: unknown, fallback = "#journal") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^(https:\/\/|mailto:|\/|#)/iu.test(trimmed) ? trimmed : fallback;
}

export function CmsHomepageBanners() {
  const { language, t } = useInterfaceLanguage();
  const banners = cmsSiteContent.banners as readonly Banner[];
  const banner = banners.find(
    (item) =>
      !item.pagePatterns?.length ||
      item.pagePatterns.includes("/") ||
      item.pagePatterns.includes("*")
  );
  if (!banner || language === "en") return null;
  const hasImage = Boolean(
    banner.desktopImageUrl || banner.tabletImageUrl || banner.mobileImageUrl
  );
  return (
    <aside className={`cms-banner${hasImage ? " has-image" : ""}`}>
      {hasImage && (
        <picture>
          {banner.mobileImageUrl && (
            <source media="(max-width: 640px)" srcSet={banner.mobileImageUrl} />
          )}
          {banner.tabletImageUrl && (
            <source media="(max-width: 1024px)" srcSet={banner.tabletImageUrl} />
          )}
          <img
            src={
              banner.desktopImageUrl ||
              banner.tabletImageUrl ||
              banner.mobileImageUrl
            }
            alt=""
            loading="lazy"
            decoding="async"
          />
        </picture>
      )}
      <div>
        <span className="section-kicker">{t("Объявление редакции")}</span>
        <strong>{banner.title}</strong>
        {banner.description && <p>{banner.description}</p>}
        {banner.targetUrl && (
          <a href={safeHref(banner.targetUrl)}>
            {banner.buttonText || t("Подробнее")} →
          </a>
        )}
      </div>
    </aside>
  );
}

export function CmsNavigationLinks({
  location,
  withHeading = false,
}: {
  location: "header" | "footer";
  withHeading?: boolean;
}) {
  const { language, t } = useInterfaceLanguage();
  const menus = cmsSiteContent.navigationMenus as readonly NavigationMenu[];
  const menu = menus.find((item) => item.location === location);
  const items = menu?.items
    .filter((item) => !item.parentId)
    .sort((first, second) => first.displayOrder - second.displayOrder);
  if (!items?.length || language === "en") return null;

  const links = items.map((item) => (
    <a
      href={safeHref(item.href)}
      key={item.id}
      target={item.openInNewTab ? "_blank" : undefined}
      rel={item.openInNewTab ? "noreferrer" : undefined}
    >
      {item.label}
    </a>
  ));
  return withHeading ? (
    <section className="cms-footer-links">
      <h2>{menu?.name || t("Дополнительно")}</h2>
      {links}
    </section>
  ) : (
    <>{links}</>
  );
}
