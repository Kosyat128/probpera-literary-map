import fs from "node:fs";
const p='src/data/countries/generated/books.generated.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
const latinPattern=/[\u00C0-\u00FF]/g;
const bad=[];
for (const [k,arr] of Object.entries(d.works||{})) {
  if (!Array.isArray(arr)) continue;
  for (let i=0;i<arr.length;i++) {
    const w=arr[i];
    const t=w.title;
    if (typeof t !== 'string') continue;
    const repaired = Buffer.from(t,'latin1').toString('utf8');
    if (t!==repaired && latinPattern.test(t)) {
      bad.push({key:`${k}[${i}]`,old:t,new:repaired});
    }
  }
}
console.log('count',bad.length);
console.log(JSON.stringify(bad.slice(0,200),null,2));