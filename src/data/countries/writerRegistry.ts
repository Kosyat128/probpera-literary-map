import type { Writer } from "../types";
import { convertWriters } from "./convertWriter";
import { russianWriters } from "./russia";

export const allWriters: Writer[] = [
 ...convertWriters(russianWriters)
];

export function getWriterById(id:string){
 return allWriters.find(writer=>writer.id===id);
}
