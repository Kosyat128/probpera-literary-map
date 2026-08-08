import WriterProfile from "../components/WriterProfile";
import { allWriters } from "../data/countries/writerRegistry";
import type { WriterProfile as Writer } from "../data/countries/types";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

const writers: Writer[] = allWriters;

export default function WritersPage({ writerId }: { writerId?: string }) {
  const { t } = useInterfaceLanguage();
  const pathParts =
    typeof window !== "undefined"
      ? window.location.pathname.split("/").filter(Boolean)
      : [];
  const routeId =
    writerId ||
    decodeURIComponent(pathParts[pathParts.length - 1] || "");
  const writer = writers.find((item) => item.id === routeId);

  if (!writer) {
    return <div>{t("Писатель не найден")}</div>;
  }

  return <WriterProfile writer={writer} />;
}
