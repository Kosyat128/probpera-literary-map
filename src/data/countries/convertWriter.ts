import type { Writer } from "../types";

export function convertWriter(writer: Writer): Writer {
  return writer;
}

export function convertWriters(writers: Writer[]): Writer[] {
  return writers.map(convertWriter);
}
