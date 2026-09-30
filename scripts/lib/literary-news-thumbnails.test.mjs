import { describe, expect, it } from "vitest";
import { newsArticleThumbnail } from "./literary-news-thumbnails.mjs";
import { newsSemanticRevision, prepareNewsPost } from "./literary-news-social.mjs";
import reviewed from "../../data/news/reviewed.json" with { type: "json" };

const item = reviewed.find(row => row.kind === "news");
const entry = {sourceUrl:item.source.url,imageUrl:"https://images.publisher.org/article-cover.jpg",
  alt:item.title,displayOnly:true,socialReuseApproved:false,method:"og:image",sourceDocumentSha256:"a".repeat(64)};
describe("article-specific display thumbnails",()=>{
  it('accepts deterministic metadata from an independently validated daily profile and binds it to its source document',()=>{
    const record = { ...item, id: 'dynamic-fixture', provenance: { reviewKind: 'machineReviewed',
      sourceEvidence: { documentSha256: entry.sourceDocumentSha256, thumbnail: entry } } };
    expect(newsArticleThumbnail(record, {})?.url).toBe(entry.imageUrl);
    for (const altered of [{ ...record, provenance: { ...record.provenance, reviewKind: 'held' } },
      { ...record, provenance: { ...record.provenance, sourceEvidence: { ...record.provenance.sourceEvidence, documentSha256: 'b'.repeat(64) } } }])
      expect(newsArticleThumbnail(altered, {})).toBeNull();
  });
  it("requires the exact source article and refuses generic or unproven metadata",()=>{
    expect(newsArticleThumbnail(item,{[item.id]:entry})?.url).toBe(entry.imageUrl);
    for(const change of [{sourceUrl:item.source.url+"/different-article"},{method:"site-logo"},
      {sourceDocumentSha256:""},{displayOnly:false},{socialReuseApproved:true}])
      expect(newsArticleThumbnail(item,{[item.id]:{...entry,...change}})).toBeNull();
  });
  it("never displays credential, local, IP or non-HTTPS image targets",()=>{
    for(const imageUrl of ["http://images.publisher.org/a.jpg","https://u:p@images.publisher.org/a.jpg",
      "https://127.0.0.1/a.jpg","https://[::1]/a.jpg","https://host.internal/a.jpg",
      "data:image/png;base64,abc","https://images.publisher.org:8443/a.jpg"])
      expect(newsArticleThumbnail(item,{[item.id]:{...entry,imageUrl}})).toBeNull();
  });
  it("does not turn an onsite thumbnail into a social upload or a second post",async()=>{
    const enriched={...item,thumbnail:newsArticleThumbnail(item,{[item.id]:entry})};
    expect(await newsSemanticRevision(enriched)).toBe(await newsSemanticRevision(item));
    for(const platform of ["telegram","vk"]){
      const prepared=await prepareNewsPost(enriched,{id:"a".repeat(64),release:"b".repeat(40)},platform);
      expect(prepared.media).toBeNull();expect(JSON.stringify(prepared.payload)).not.toContain(entry.imageUrl);
    }
  });
});
