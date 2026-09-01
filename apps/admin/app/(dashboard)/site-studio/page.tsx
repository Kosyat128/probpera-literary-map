import Link from "next/link";

import { getStaffSession } from "@/lib/auth";

import styles from "./studio.module.css";

export const metadata = { title: "Студия сайта · Проба Пера" };

const studioSections = [
  {
    icon: "◫",
    title: "Холст и компоненты",
    text: "Структура страницы, выбранный компонент, адаптивный режим и безопасный инспектор.",
    href: "/site-studio/components",
    status: "Единый холст",
  },
  {
    icon: "◆",
    title: "Токены дизайна",
    text: "Цвет, интервалы, радиусы, тени, сетка и движение без произвольного CSS.",
    href: "/site-studio/tokens",
    status: "Черновик → релиз",
  },
  {
    icon: "Тт",
    title: "Шрифты и типографика",
    text: "Семейства, начертания, смысловые стили и правила для разных экранов.",
    href: "/site-studio/fonts",
    status: "Управляется",
  },
  {
    icon: "⇧",
    title: "Наборы изменений",
    text: "Проверка, согласование, расписание, атомарная публикация и групповой откат.",
    href: "/site-studio/releases",
    status: "Без частичных релизов",
  },
] as const;

export default async function SiteStudioPage() {
  const session = await getStaffSession();
  const canManage = session.role === "owner" || session.role === "admin";

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span className="eyebrow">Site Studio</span>
          <h1>Оформление сайта — в одной системе</h1>
          <p>
            Меняйте управляемые части сайта через типизированные настройки,
            проверяйте результат и публикуйте связанные правки одним выпуском.
          </p>
        </div>
        <div className={styles.access}>
          <span>{canManage ? "Режим управления" : "Режим просмотра"}</span>
          <strong>Без произвольного кода</strong>
        </div>
      </header>

      <section className={styles.workflow} aria-labelledby="studio-workflow-title">
        <div>
          <span className="eyebrow">Рабочий процесс</span>
          <h2 id="studio-workflow-title">Выберите → настройте → проверьте → выпустите</h2>
        </div>
        <ol>
          <li><span>1</span> Выберите компонент или токен</li>
          <li><span>2</span> Сохраните правку в набор изменений</li>
          <li><span>3</span> Проверьте адаптивный предпросмотр</li>
          <li><span>4</span> Опубликуйте выпуск целиком</li>
        </ol>
      </section>

      <section className={styles.grid} aria-label="Разделы студии сайта">
        {studioSections.map((section) => (
          <Link className={styles.card} href={section.href} key={section.href}>
            <span className={styles.icon} aria-hidden="true">{section.icon}</span>
            <span className={styles.status}>{section.status}</span>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
            <strong>Открыть раздел <span aria-hidden="true">→</span></strong>
          </Link>
        ))}
      </section>

      <aside className={styles.guardrail}>
        <div>
          <span className="eyebrow">Защитные границы</span>
          <h2>Сложные интерактивные сцены защищены</h2>
          <p>
            Литературный глобус и книжная полка зарегистрированы как системные
            компоненты. Обычные настройки студии не переписывают их геометрию,
            анимацию или поведение.
          </p>
        </div>
        <Link className="button-secondary" href="/homepage">
          Открыть редактор главной
        </Link>
      </aside>
    </div>
  );
}
