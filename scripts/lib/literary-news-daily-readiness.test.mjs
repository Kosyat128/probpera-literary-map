import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { literaryNewsDailyReadiness } from './literary-news-daily-readiness.mjs';
import { normalizeNewsMedia, mediaByteHash } from './literary-news-media.mjs';
import { extractDailyNewsDetail } from '../prepare-literary-news-daily-review.mjs';

const current = new Date('2026-09-29T20:00:00Z');
const destination = { platform:'telegram', id:'-100123', mode:'off', requirePhotoForNewPosts:true };
const item = (id,publishedAt) => ({ id, eventDate:'2026-09-29', category:'releases',kind:'news',verification:'confirmed',
  publishedAt,verifiedAt:current.toISOString(),title:{ru:'Новая книга',en:'New book'},summary:{ru:'Издатель объявил книгу.',en:'A publisher announced a book.'},
  source:{name:'Publisher',url:`https://publisher.example/news/${id}`,language:'en'} });
async function fixture() {
  const bytes=await sharp({create:{width:480,height:640,channels:3,background:'#998877'}}).png().toBuffer();
  const normalized=await normalizeNewsMedia(bytes,'image/png');
  const asset={id:'fixture',status:'approved',newsIds:['fresh','old','undated'],sourceUrl:'https://publisher.example/image.png',sourceSha256:mediaByteHash(bytes),
    subject:'book',entityEvidence:'Synthetic fixture only.',author:'Fixture',rightsholder:'Fixture',credit:'Synthetic fixture',license:'owned',
    licenseEvidenceUrl:'https://publisher.example/fixture-permission',licenseEvidenceSha256:'a'.repeat(64),checkMethod:'ownership-record',
    checkedAt:'2026-09-29T00:00:00Z',validUntil:'2026-10-29T00:00:00Z',
    transformations:{resize:true,metadataRemoval:true,reencode:true,crop:false},
    permissions:[{platform:destination.platform,destinationId:destination.id,publish:true,providerProcessing:true,evidenceUrl:'https://publisher.example/fixture-permission'}],
    derivative:normalized.descriptor};
  return { registry:{assets:[asset],downloadHosts:['publisher.example']},now:current,readBytes:async()=>normalized.bytes };
}
describe('honest daily photo supply and accepted receipt counts',()=>{
  it('counts source freshness separately from image readiness and never treats edit acknowledgement as a create',async()=>{
    const feed={snapshot:{id:'fixture',release:'a'.repeat(40)},items:[item('fresh','2026-09-29'),item('old','2026-09-01'),item('undated',null)]};
    const jobs=[{newsId:'already-new',destination,remoteId:'1',firstAcknowledgedAt:'2026-09-29T05:00:00Z',acknowledgedAt:'2026-09-29T07:00:00Z',
      prepared:{temporal:{kind:'news',publishedAt:'2026-09-29'}},remoteMediaKind:'text'},
      {newsId:'legacy-edit',destination,remoteId:'2',acknowledgedAt:'2026-09-29T07:00:00Z'}];
    const result=await literaryNewsDailyReadiness({feed,destination,jobs,current,mediaOptions:await fixture()});
    expect(result.counts).toMatchObject({currentFeedItems:3,sourcePublishedToday:1,unknownSourcePublicationDates:1,
      photoReady:3,recentPhotoReady:1,acceptedFirstPostsToday:1,firstPostDatesUnknown:1,minimumSupplyDeficit:8,targetSupplyDeficit:13});
    expect(result.outcomes.every(row=>row.nativeMethod==='sendPhoto')).toBe(true);
  });
  it('counts all fresh unsent text or photo supply toward the news goal, with photos separately',async()=>{
    const optional={...destination,requirePhotoForNewPosts:false},feed={snapshot:{id:'fixture',release:'a'.repeat(40)},
      items:[item('fresh','2026-09-29'),item('text','2026-09-28'),item('undated',null),item('old','2026-09-01')]};
    const result=await literaryNewsDailyReadiness({feed,destination:optional,current,mediaOptions:await fixture()});
    expect(result.counts).toMatchObject({recentPhotoReady:1,recentTextReady:1,recentReady:2,minimumSupplyDeficit:8,
      targetSupplyDeficit:13,minimumPhotoSupplyDeficit:9,targetPhotoSupplyDeficit:14});
    expect(result.outcomes.find(row=>row.newsId==='text')).toMatchObject({status:'text_ready',nativeMethod:'sendMessage'});
  });
  it('does not call a missing or changed JPEG ready or create a send claim for local previews',async()=>{
    const mediaOptions=await fixture();mediaOptions.readBytes=async()=>Buffer.from('changed');
    const result=await literaryNewsDailyReadiness({feed:{snapshot:{id:'fixture',release:'a'.repeat(40)},items:[item('fresh','2026-09-29')]},
      destination,current,mediaOptions});
    expect(result.publication).toBe('local_preparation');expect(result.counts.photoReady).toBe(0);
    expect(result.heldReasons).toEqual({media_cache_bytes_changed:1});expect(result.counts.acceptedFirstPostsToday).toBe(0);
  });
  it('extracts actual source dates and article titles while an OG image grants no social permission',()=>{
    const result=extractDailyNewsDetail('<h1>Site logo</h1><h2 class="entry-title">A new book</h2><main>Actual book text</main>'
      +'<meta property="og:image" content="/image.jpg"><script type="application/ld+json">{"datePublished":"2026-09-29"}</script>',
    'https://publisher.example/news/book');
    expect(result.headline).toBe('A new book');expect(result.publishedDates).toEqual([{value:'2026-09-29',method:'jsonld.datePublished'}]);
    expect(result.images).toEqual([{url:'https://publisher.example/image.jpg',method:'og:image',displayOnly:true,socialReuseApproved:false}]);
    expect(extractDailyNewsDetail('<main>No source date</main>','https://publisher.example/book').publishedDates).toEqual([]);
  });
});
