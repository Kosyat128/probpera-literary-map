import WriterProfile from "../components/WriterProfile";
import { allWriters } from "../data/countries/writerRegistry";
import type { WriterProfile as Writer } from "../data/countries/types";

const writers: Writer[] = allWriters;

export default function WritersPage({ writerId }: { writerId?: string }) {
  const pathParts =
    typeof window !== "undefined"
      ? window.location.pathname.split("/").filter(Boolean)
      : [];
  const routeId =
    writerId ||
    decodeURIComponent(pathParts[pathParts.length - 1] || "");
  const writer = writers.find((item) => item.id === routeId);

  if (!writer) {
    return <div>Писатель не найден</div>;
  }

  return <WriterProfile writer={writer} />;
}
