import type { ReactNode, SyntheticEvent } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { canonicalJournalOrigin } from "../platform/distribution";

/** Implementation copy only. The synchronized legal/release workflow must
 * review it before production; this is not an approved privacy policy. */
export const pwaHelpCopy = {
  reviewStatus: "draft",
  locales: {
    ru: {
      heading: "Справка и данные на устройстве",
      offlineHeading: "Чтение без сети",
      offline: "После установки и проверки доступа без сети доступны сохранённый глобус, поиск писателей, включённые биографии и каталог книг. Избранное сохраняется на этом устройстве. Для обложек, портретов и других материалов, которые ещё не сохранены, может понадобиться интернет.",
      access: "Доступ без сети действует до срока последнего подтверждения. Если приложение просит повторную проверку, подключитесь к интернету. Смена языка сохраняет текущий экран и выбранные материалы.",
      updateHeading: "Обновление приложения",
      update: "Готовое обновление устанавливается по вашей команде. Если доступна проверенная предыдущая версия, её можно вернуть кнопкой «Вернуть предыдущую версию». Для возврата закройте остальные окна приложения.",
      dataHeading: "Данные на этом устройстве",
      data: "Приложение сохраняет язык, настройки, избранное, историю открытых писателей и книг, сведения для проверки доступа и файлы для работы без сети. Браузер может удалить эти данные при очистке хранилища или нехватке места. Тогда потребуется повторное подключение к интернету и восстановление доступа.",
      account: "Восстановить доступ",
      deletion: "Заявка на удаление аккаунта",
      online: "Для работы с аккаунтом и отправки письма требуется интернет. Статус заявки проверяется на странице удаления аккаунта.",
      contact: "Написать в поддержку",
      links: "Аккаунт и поддержка",
    },
    en: {
      heading: "Help and data on this device",
      offlineHeading: "Reading offline",
      offline: "After installation and access verification, the saved globe, writer search, included biographies and book catalog are available offline. Favorites are saved on this device. Covers, portraits and other content that has not been saved may need an internet connection.",
      access: "Offline access lasts until the deadline in your latest verification. If the app asks you to verify access again, connect to the internet. Changing the language keeps your current screen and selected content.",
      updateHeading: "Updating the app",
      update: "A ready update is installed when you choose to apply it. When a verified previous version is available, use Restore previous version to return to it. Close other app windows before restoring a version.",
      dataHeading: "Data on this device",
      data: "The app saves your language, settings, favorites, recently opened writers and books, access verification information and offline files. Your browser may remove this data when storage is cleared or space runs low. You will then need to reconnect to the internet and restore access.",
      account: "Restore access",
      deletion: "Request account deletion",
      online: "Account actions and sending email require an internet connection. Check the status of a request on the account deletion page.",
      contact: "Email support",
      links: "Account and support",
    },
  },
} as const;

function accountLinkProps(page: "planet-account" | "delete-account", language: "ru" | "en") {
  const href = () => {
    const returnTo = typeof window === "undefined" ? `/planet/${language}/` : window.location.pathname + window.location.search + window.location.hash;
    return `${canonicalJournalOrigin}/${language}/${page}/?returnTo=${encodeURIComponent(returnTo)}`;
  };
  // Canonical navigation owns history and can change it without rendering this
  // sibling. Read the current address when a link is used, including keyboard,
  // middle-click and context-menu actions; keep native anchor behavior intact.
  const refresh = (event: SyntheticEvent<HTMLAnchorElement>) => { event.currentTarget.href = href(); };
  return { href: href(), onClick: refresh, onAuxClick: refresh, onFocus: refresh, onPointerDown: refresh, onContextMenu: refresh };
}

/** Native details keeps keyboard behavior and its open state across locale
 * updates; it neither remounts the application nor adds a second locale control. */
export default function PwaHelp({ embedded = false, devicePanel }: { embedded?: boolean; devicePanel?: ReactNode } = {}) {
  const { language } = useInterfaceLanguage();
  const copy = pwaHelpCopy.locales[language];
  return (
    <aside className={`pwa-help${embedded ? " pwa-help--embedded" : ""}`} aria-label={copy.heading}>
      <details>
        <summary>{copy.heading}</summary>
        <div className="pwa-help__body">
          {devicePanel}
          <h2>{copy.offlineHeading}</h2>
          <p>{copy.offline}</p>
          <p>{copy.access}</p>
          <h2>{copy.updateHeading}</h2>
          <p>{copy.update}</p>
          <h2>{copy.dataHeading}</h2>
          <p>{copy.data}</p>
          <p>{copy.online}</p>
          <nav className="pwa-help__links" aria-label={copy.links}>
            <a {...accountLinkProps("planet-account", language)}>{copy.account}</a>
            <a {...accountLinkProps("delete-account", language)}>{copy.deletion}</a>
            <a href="mailto:probperasite@yandex.ru">{copy.contact}</a>
          </nav>
        </div>
      </details>
    </aside>
  );
}
