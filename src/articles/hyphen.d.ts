declare module "hyphen/ru" {
  export function hyphenateSync(text: string, options?: {html?: boolean; minWordLength?: number}): string;
}
declare module "hyphen/en-us" {
  export { hyphenateSync } from "hyphen/ru";
}
