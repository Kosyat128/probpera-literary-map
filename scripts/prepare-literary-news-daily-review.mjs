import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { boundedFetch } from './research-literary-news-sources.mjs';
import registry from '../data/news/social-media-assets.json' with {type:'json'};
import destinations from '../data/news/social-destinations.json' with {type:'json'};
import { checkedNewsMediaAsset } from './lib/literary-news-media-policy.mjs';
import { collectDailyNewsReview } from './lib/literary-news-daily-intake.mjs';
export * from './lib/literary-news-daily-intake.mjs';

function registeredMediaEvidence(newsId,current) {
  const destination=destinations.destinations.find(d=>d.platform==='telegram');
  for(const asset of registry.assets)try {
    checkedNewsMediaAsset(asset,destination,newsId,current);
    return {status:'approved_registry',assetId:asset.id,license:asset.license,subject:asset.subject,
      entityEvidence:asset.entityEvidence,licenseEvidenceUrl:asset.licenseEvidenceUrl,
      licenseEvidenceSha256:asset.licenseEvidenceSha256,sourceSha256:asset.sourceSha256,
      derivativeSha256:asset.derivative.sha256,validUntil:asset.validUntil};
  }catch { /* A public image or another record's permission never grants reuse. */ }
  return {status:'rights_unverified'};
}


export async function prepareDailyNewsReview(options={}) {
  const reviewed=options.reviewed ?? JSON.parse(await readFile('data/news/reviewed.json','utf8'));
  return collectDailyNewsReview({...options,reviewed,fetchImpl:options.fetchImpl||boundedFetch,
    resolveMediaEvidence:options.resolveMediaEvidence||((row,current)=>registeredMediaEvidence(row.id,current))});
}

async function main() {
  const result = await prepareDailyNewsReview();
  await mkdir('.tmp/literary-news-daily', { recursive: true });
  await writeFile('.tmp/literary-news-daily/source-documents.json', JSON.stringify(result.documents));
  delete result.documents;
  await writeFile('.tmp/literary-news-daily/review-intake.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result.counts));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
