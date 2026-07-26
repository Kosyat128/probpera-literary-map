import { useParams } from "react-router-dom";
import WriterProfile from "../components/WriterProfile";
import { allWriters } from "../data/countries/writerRegistry";
import type { WriterProfile as Writer } from "../data/countries/types";

const writers: Writer[] = allWriters;

export default function WritersPage() {
  const { id } = useParams();
  const writer = writers.find((item) => item.id === id);

  if (!writer) {
    return <div>Писатель не найден</div>;
  }

  return <WriterProfile writer={writer} />;
}
