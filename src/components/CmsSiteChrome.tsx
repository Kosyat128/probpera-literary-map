import { cmsSiteContent } from "../data/cms/site.generated";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import {
  cmsSiteChromeFieldMarker,
} from "../cms/directEditBridge";
import {
  buildCmsNavigationForest,
  cmsBannerMatchesPath,
  type CmsNavigationItem,
  type CmsNavigationNode,
} from "../cms/siteChromeRuntime";
import { safePublicHref } from "../utils/publicHref";

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
  desktopMediaId?: string | null;
  tabletMediaId?: string | null;
  mobileMediaId?: string | null;
};

type NavigationMenu = {
  id: string;
  name: string;
  location: "header" | "footer";
  items: readonly CmsNavigationItem[];
};

function safeHref(value: unknown, fallback = "#journal") {
  return safePublicHref(value, fallback);
}

export function CmsPageBanners({ pathname }: { pathname?: string } = {}) {
  const { language, t } = useInterfaceLanguage();
  const banners = cmsSiteContent.banners as readonly Banner[];
  const currentPathname =
    pathname || (typeof window === "undefined" ? "/" : window.location.pathname);
  const banner = banners.find(
    (item) => cmsBannerMatchesPath(
      item.pagePatterns,
      currentPathname,
      import.meta.env.BASE_URL
    )
  );
  if (!banner || language === "en") return null;
  const hasImage = Boolean(
    banner.desktopImageUrl || banner.tabletImageUrl || banner.mobileImageUrl
  );
  return (
    <aside
      className={`cms-banner${hasImage ? " has-image" : ""}`}
      {...cmsSiteChromeFieldMarker(
        "banner",
        banner.id,
        "desktopMediaId",
        banner.desktopImageUrl || "",
        {
          kind: "image",
          label: "Изображение баннера для компьютера",
          adminHref: `/banners#banner-${encodeURIComponent(banner.id)}`,
          mediaId: banner.desktopMediaId,
        }
      )}
    >
      <picture className={!hasImage ? "cms-edit-empty-field" : undefined}>
          <source
            media="(max-width: 640px)"
            srcSet={banner.mobileImageUrl || undefined}
          />
          <source
            media="(max-width: 1024px)"
            srcSet={banner.tabletImageUrl || undefined}
          />
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
      <div className="cms-edit-media-tools" aria-label={t("Изображения баннера")}>
        {([
          ["desktopMediaId", "Компьютер", banner.desktopImageUrl, banner.desktopMediaId],
          ["tabletMediaId", "Планшет", banner.tabletImageUrl, banner.tabletMediaId],
          ["mobileMediaId", "Телефон", banner.mobileImageUrl, banner.mobileMediaId],
        ] as const).map(([field, label, imageUrl, mediaId]) => (
          <button
            type="button"
            key={field}
            {...cmsSiteChromeFieldMarker(
              "banner",
              banner.id,
              field,
              imageUrl || "",
              {
                kind: "image",
                label: `Изображение: ${label.toLowerCase()}`,
                adminHref: `/banners#banner-${encodeURIComponent(banner.id)}`,
                mediaId,
              }
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div>
        <span className="section-kicker">{t("Объявление редакции")}</span>
        <strong
          className={!banner.title ? "cms-edit-empty-field" : undefined}
          {...cmsSiteChromeFieldMarker("banner", banner.id, "title", banner.title, {
            label: "Заголовок баннера",
          })}
        >
          {banner.title}
        </strong>
        <p
          className={!banner.description ? "cms-edit-empty-field" : undefined}
          {...cmsSiteChromeFieldMarker(
            "banner",
            banner.id,
            "description",
            banner.description,
            { kind: "textarea", label: "Описание баннера" }
          )}
        >
          {banner.description}
        </p>
        <a
          className={!banner.targetUrl ? "cms-edit-empty-field" : undefined}
          href={safeHref(banner.targetUrl)}
          {...cmsSiteChromeFieldMarker(
            "banner",
            banner.id,
            "targetUrl",
            banner.targetUrl || "",
            { label: "Ссылка кнопки баннера" }
          )}
        >
          <span
            {...cmsSiteChromeFieldMarker(
              "banner",
              banner.id,
              "buttonText",
              banner.buttonText || "",
              { label: "Текст кнопки баннера" }
            )}
          >
            {banner.buttonText || t("Подробнее")}
          </span>{" "}
          →
          <span className="cms-edit-href-handle" aria-hidden="true">{t("ссылка")}</span>
        </a>
      </div>
    </aside>
  );
}

export function CmsHomepageBanners() {
  return <CmsPageBanners />;
}

function NavigationAnchor({
  node,
  editHandleLabel,
  className,
}: {
  node: CmsNavigationNode;
  editHandleLabel: string;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={safeHref(node.href)}
      target={node.openInNewTab ? "_blank" : undefined}
      rel={node.openInNewTab ? "noopener noreferrer" : undefined}
      {...cmsSiteChromeFieldMarker(
        "navigation-item",
        node.id,
        "href",
        node.href,
        {
          label: "Ссылка пункта меню",
          adminHref: `/menus#navigation-item-${encodeURIComponent(node.id)}`,
        }
      )}
    >
      <span
        {...cmsSiteChromeFieldMarker(
          "navigation-item",
          node.id,
          "label",
          node.label,
          { label: "Название пункта меню" }
        )}
      >
        {node.label}
      </span>
      <span className="cms-edit-href-handle" aria-hidden="true">
        {editHandleLabel}
      </span>
    </a>
  );
}

function HeaderNavigationNode({
  node,
  editHandleLabel,
  mobile,
  depth = 0,
}: {
  node: CmsNavigationNode;
  editHandleLabel: string;
  mobile: boolean;
  depth?: number;
}) {
  if (!node.children.length) {
    return (
      <NavigationAnchor
        node={node}
        editHandleLabel={editHandleLabel}
        className={mobile ? "cms-nav-mobile-link" : "cms-nav-link"}
      />
    );
  }

  return (
    <details
      className={`cms-nav-group${mobile ? " is-mobile" : ""}`}
      data-depth={depth}
    >
      <summary>
        <span
          {...cmsSiteChromeFieldMarker(
            "navigation-item",
            node.id,
            "label",
            node.label,
            { label: "Название пункта меню" }
          )}
        >
          {node.label}
        </span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="cms-nav-children" role="group" aria-label={node.label}>
        <NavigationAnchor
          node={node}
          editHandleLabel={editHandleLabel}
          className="cms-nav-parent-target"
        />
        {node.children.map((child) => (
          <HeaderNavigationNode
            key={child.id}
            node={child}
            editHandleLabel={editHandleLabel}
            mobile={mobile}
            depth={depth + 1}
          />
        ))}
      </div>
    </details>
  );
}

function FooterNavigationNode({
  node,
  editHandleLabel,
}: {
  node: CmsNavigationNode;
  editHandleLabel: string;
}) {
  return (
    <div className="cms-nav-footer-branch">
      <NavigationAnchor node={node} editHandleLabel={editHandleLabel} />
      {node.children.length ? (
        <div className="cms-nav-footer-children">
          {node.children.map((child) => (
            <FooterNavigationNode
              key={child.id}
              node={child}
              editHandleLabel={editHandleLabel}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CmsNavigationLinks({
  location,
  withHeading = false,
  mobile = false,
}: {
  location: "header" | "footer";
  withHeading?: boolean;
  mobile?: boolean;
}) {
  const { language, t } = useInterfaceLanguage();
  const menus = cmsSiteContent.navigationMenus as readonly NavigationMenu[];
  const menu = menus.find((item) => item.location === location);
  const items = buildCmsNavigationForest(menu?.items || []);
  if (!items?.length || language === "en") return null;

  const editHandleLabel = t("ссылка");
  return withHeading ? (
    <section className="cms-footer-links">
      <h2>{menu?.name || t("Дополнительно")}</h2>
      {items.map((item) => (
        <FooterNavigationNode
          key={item.id}
          node={item}
          editHandleLabel={editHandleLabel}
        />
      ))}
    </section>
  ) : (
    <>
      {items.map((item) => (
        <HeaderNavigationNode
          key={item.id}
          node={item}
          editHandleLabel={editHandleLabel}
          mobile={mobile}
        />
      ))}
    </>
  );
}
