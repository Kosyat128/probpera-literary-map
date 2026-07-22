import { useParams } from "react-router-dom";
import type { Writer } from "../data/types";
import WriterProfile from "../components/WriterProfile";
import { russianWriters } from "../data/writers/russia";
import { convertWriters } from "../data/writers/convertWriter";

const writers: Writer[] = convertWriters(russianWriters);

export default function WritersPage(){
  const { id } = useParams();
  const writer = writers.find(item => item.id === id);

  if(!writer){
    return <div>Писатель не найден</div>;
  }

  return <WriterProfile writer={writer}/>;
}
