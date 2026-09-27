import {readFile,writeFile,rename,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {parseArgs} from "node:util";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {selectReviewed,canonicalUrl,validTimestamp} from "./lib/literary-news-reviewed.mjs";

const hash = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
export function mergeReviewedBatch(existing,batch,{current=new Date(),rollback=false}={}) {
  if (!Array.isArray(existing) || !Array.isArray(batch?.records) || !Array.isArray(batch.evidence)
    || hash(batch.records) !== batch.recordSha256) throw new Error("batch_integrity_invalid");
  const records = [...existing], added = [], unchanged = [], conflicts = [], held = [];
  const evidence = new Map(batch.evidence.map((row) => [row.id,row]));
  for (const record of batch.records) {
    const proof = evidence.get(record.id), index = records.findIndex((item) => item.id === record.id);
    if (rollback) {
      if (index === -1) unchanged.push(record.id);
      else if (hash(records[index]) !== hash(record)) conflicts.push(record.id);
      else {records.splice(index,1);added.push(record.id);}
      continue;
    }
    if (index >= 0) { (hash(records[index]) === hash(record) ? unchanged : conflicts).push(record.id);continue; }
    if (!proof || proof.httpStatus !== 200 || !validTimestamp(proof.accessedAt)
      || !/^[a-f0-9]{64}$/.test(proof.responseSha256 || "") || !proof.facts?.length
      || canonicalUrl(proof.url)?.href !== canonicalUrl(record.source?.url)?.href) throw new Error("record_evidence_invalid");
    if (selectReviewed([record],current,"Europe/Moscow").length !== 1) {held.push({id:record.id,reason:"not_currently_eligible"});continue;}
    const duplicate = records.find((old) => record.eventKey && old.eventKey === record.eventKey
      || !record.eventKey && !old.eventKey && canonicalUrl(old.source.url)?.href === canonicalUrl(record.source.url)?.href
      && old.kind === record.kind && old.eventDate === record.eventDate);
    if (duplicate) {conflicts.push(record.id);continue;}
    records.push(record);added.push(record.id);
  }
  if (conflicts.length) throw new Error(`batch_conflict:${conflicts.join(",")}`);
  return {records,added,unchanged,held};
}
async function main() {
  const {values} = parseArgs({options:{batch:{type:"string"},write:{type:"boolean"},rollback:{type:"boolean"}}});
  if (!values.batch) throw new Error("batch_path_required");
  const file = new URL("../data/news/reviewed.json",import.meta.url), raw = await readFile(file,"utf8");
  const batch = JSON.parse(await readFile(resolve(values.batch),"utf8"));
  const result = mergeReviewedBatch(JSON.parse(raw),batch,{rollback:values.rollback});
  const receipt = {batchId:batch.batchId,checkedAt:new Date().toISOString(),action:values.rollback?"rollback":"additive_merge",
    written:!!values.write,beforeCount:JSON.parse(raw).length,afterCount:result.records.length,
    beforeSha256:hash(raw),afterRecordSha256:hash(result.records),addedOrRemoved:result.added,unchanged:result.unchanged,
    held:result.held,firstPublicationCount:0,currentlyPublicNew:0,publication:"not_deployed"};
  if (values.write && result.added.length) {
    const temporary = new URL("../data/news/.reviewed-r10.tmp",import.meta.url);
    await writeFile(temporary,JSON.stringify(result.records,null,2)+"\n");
    if (hash(await readFile(file,"utf8")) !== hash(raw)) throw new Error("reviewed_changed_during_merge");
    await rename(temporary,file);
  }
  const dir = new URL("../reports/r10/publication/",import.meta.url);await mkdir(dir,{recursive:true});
  await writeFile(new URL(`${batch.batchId}-${receipt.action}.json`,dir),JSON.stringify(receipt,null,2)+"\n");
  console.log(JSON.stringify(receipt));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
