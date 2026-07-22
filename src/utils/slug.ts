export function createSlug(value:string){
 return value
  .toLowerCase()
  .replace(/ё/g,"е")
  .replace(/[^a-zа-я0-9]+/gi,"-")
  .replace(/^-|-$/g,"");
}
