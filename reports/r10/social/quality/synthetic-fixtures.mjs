import sharp from 'sharp';
import { normalizeNewsMedia, mediaByteHash } from '../../../../scripts/lib/literary-news-media.mjs';

// Local injection only. No production registry, API, source article or real event is used.
export const fixtureNow = new Date('2026-09-26T12:00:00Z');
export const fixtureDestinations = [
  {platform:'telegram',id:'-100123',mode:'off',sendable:false},
  {platform:'vk',id:'-456',mode:'off',sendable:false},
];
export const fixtureSnapshot = {id:'synthetic-quality-only',release:'synthetic-quality-only',sendable:false};
const palette={purple:'#6810c9',deep:'#300a4f',orange:'#f67518',cream:'#fffaf2',ink:'#271538'};
const definitions=[
  {id:'book',subject:'book',label:'Книга',width:720,height:960,title:'ТЕСТ: макет обложки «Сад & река»',summary:'Синтетический пример проверяет полную вертикальную обложку. Это вымышленное оформление, а не существующая книга; текст и края должны оставаться видимыми.',art:'<rect x="155" y="170" width="410" height="610" rx="8" fill="#300a4f"/><rect x="181" y="197" width="358" height="556" fill="none" stroke="#fffaf2" stroke-width="3"/><path d="M195 650Q320 410 525 520" fill="none" stroke="#f67518" stroke-width="24"/><text x="360" y="325" text-anchor="middle" fill="#fffaf2" font-size="38">SAD &amp; REKA</text><text x="360" y="390" text-anchor="middle" fill="#fffaf2" font-size="23">FICTIONAL COVER</text>'},
  {id:'portrait',subject:'portrait',label:'Портрет',width:720,height:900,title:'ТЕСТ: схема портрета условного автора',summary:'Геометрический силуэт используется только для проверки вертикального кадра и подписи. Изображение не представляет реального человека и не подтверждает литературное событие.',art:'<circle cx="360" cy="320" r="120" fill="#f67518"/><path d="M120 725Q125 500 360 500Q595 500 600 725Z" fill="#6810c9"/><path d="M250 310H470M360 210V430" stroke="#fffaf2" stroke-width="4"/><text x="360" y="790" text-anchor="middle" fill="#271538" font-size="25">GEOMETRIC FIGURE</text>'},
  {id:'adaptation',subject:'adaptation',label:'Экранизация',width:1200,height:675,title:'ТЕСТ: анонс экранизации, не сообщение о премьере',summary:'Вымышленный пример сохраняет стадию «запланировано». Условная хлопушка показывает широкий кадр; это не кадр фильма, не трейлер и не доказательство состоявшейся премьеры.',kind:'announcement',art:'<rect x="250" y="175" width="700" height="350" rx="14" fill="#300a4f"/><path d="M250 245H950" stroke="#fffaf2" stroke-width="7"/><path d="M270 180L340 240M430 180L500 240M590 180L660 240M750 180L820 240M910 180L950 215" stroke="#f67518" stroke-width="30"/><text x="600" y="370" text-anchor="middle" fill="#fffaf2" font-size="46">STORYBOARD TEST</text><text x="600" y="435" text-anchor="middle" fill="#fffaf2" font-size="27">NOT A FILM STILL</text>'},
  {id:'festival',subject:'festival',label:'Фестиваль',width:960,height:720,title:'ТЕСТ: афиша условной встречи 26 сентября 2026 года',summary:'Синтетическая афиша проверяет читаемость года, темы и нижней границы. Условная встреча не существует; пример не сообщает о проведённом фестивале.',kind:'announcement',art:'<rect x="100" y="135" width="760" height="435" fill="#6810c9"/><text x="480" y="235" text-anchor="middle" fill="#fffaf2" font-size="46">SAMPLE MEETING</text><text x="480" y="350" text-anchor="middle" fill="#fffaf2" font-size="86">26.09.2026</text><path d="M190 460H770" stroke="#f67518" stroke-width="24"/><text x="480" y="535" text-anchor="middle" fill="#fffaf2" font-size="25">FICTIONAL EVENT</text>'},
  {id:'archive',subject:'archive',label:'Архив',width:1000,height:780,title:'ТЕСТ: схема архивного листа, не подлинная рукопись',summary:'Пример содержит только геометрические линии и явно тестовый штамп. Он проверяет сохранение полей документа и не имитирует историческую находку, почерк или подпись писателя.',art:'<rect x="170" y="140" width="660" height="485" fill="#f5eadb" stroke="#300a4f" stroke-width="4"/><path d="M230 250H770M230 310H720M230 370H750M230 430H650" stroke="#72667a" stroke-width="9"/><rect x="470" y="495" width="290" height="80" fill="none" stroke="#f67518" stroke-width="5"/><text x="615" y="547" text-anchor="middle" fill="#300a4f" font-size="29">SAMPLE ONLY</text>'},
  {id:'no-photo',subject:'editorial',label:'Без изображения',width:0,height:0,title:'ТЕСТ: текст без фото - cafe\u0301 & 👩‍💻',summary:'Самостоятельный текст сохраняется, когда разрешённой иллюстрации нет. Комбинируемый акцент, амперсанд и составной эмодзи проверяют UTF-16-разметку; источник и смысл не обрезаются.'},
];

export async function createSyntheticFixtures(){
  const bytesByHash=new Map(),assets=[],fixtures=[];
  for(const d of definitions){
    const news={id:`fixture-${d.id}`,verification:'confirmed',fixtureOnly:true,sendable:false,
      title:{ru:d.title,en:`SYNTHETIC TEST: ${d.id}`},summary:{ru:d.summary,en:'Synthetic local fixture. No real person, publication or event is represented.'},
      source:{id:'synthetic-fixture',name:'Тестовый источник - пример, не публикация',url:`https://example.invalid/fixture/${d.id}`},
      category:'publishing',kind:d.kind||'news',eventDate:'2026-09-26',publishedAt:'2026-09-26T10:00:00Z',verifiedAt:'2026-09-26',eventKey:`fixture:${d.id}`};
    let normalized=null;
    if(d.art){
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${d.width}" height="${d.height}" viewBox="0 0 ${d.width} ${d.height}"><rect width="100%" height="100%" fill="${palette.cream}"/><rect x="8" y="8" width="${d.width-16}" height="${d.height-16}" fill="none" stroke="${palette.orange}" stroke-width="8"/><g font-family="Arial,sans-serif"><rect x="22" y="22" width="${d.width-44}" height="75" rx="4" fill="${palette.deep}"/><text x="${d.width/2}" y="70" text-anchor="middle" fill="${palette.cream}" font-size="30">SYNTHETIC TEST - NOT NEWS</text>${d.art}<text x="${d.width/2}" y="${d.height-42}" text-anchor="middle" fill="${palette.ink}" font-size="25">LOCAL FIXTURE / SENDABLE: FALSE</text></g></svg>`;
      const sourceBytes=await sharp(Buffer.from(svg)).png().toBuffer();
      normalized=await normalizeNewsMedia(sourceBytes,'image/png');bytesByHash.set(normalized.descriptor.sha256,normalized.bytes);
      assets.push({id:`fixture-${d.id}-asset`,fixtureOnly:true,sendable:false,status:'approved',newsIds:[news.id],subject:d.subject,
        sourceUrl:`https://example.invalid/fixture/${d.id}.png`,sourceSha256:mediaByteHash(sourceBytes),
        entityEvidence:`Synthetic geometry generated by this fixture; ${d.id}; no actual work, person or event.`,
        author:'Local synthetic fixture',rightsholder:'Local synthetic fixture',credit:'Синтетический тестовый рисунок; не реальное событие.',
        license:'owned',licenseEvidenceUrl:'https://example.invalid/fixture/ownership',licenseEvidenceSha256:mediaByteHash(Buffer.from('Fixture-only geometric artwork; no production rights grant.')),
        checkMethod:'ownership-record',checkedAt:fixtureNow.toISOString(),validUntil:'2026-10-26T12:00:00Z',
        transformations:{resize:true,metadataRemoval:true,reencode:true,crop:false},
        permissions:fixtureDestinations.map(x=>({platform:x.platform,destinationId:x.id,publish:true,providerProcessing:true,evidenceUrl:'https://example.invalid/fixture/ownership',fixtureOnly:true,sendable:false})),
        derivative:normalized.descriptor});
    }
    fixtures.push({id:d.id,label:d.label,news,normalized:normalized?.descriptor||null,fixtureOnly:true,sendable:false});
  }
  const registry={schemaVersion:1,fixtureOnly:true,sendable:false,downloadHosts:[],assets};
  const readBytes=async descriptor=>{const data=bytesByHash.get(descriptor.sha256);if(!data)throw new Error('fixture_bytes_missing');return data;};
  const longCreditAsset={...assets[0],id:'fixture-long-credit',newsIds:['fixture-no-photo'],subject:'editorial',
    entityEvidence:'Synthetic test card, used only to test required-credit overflow; not a factual illustration.',
    credit:'Только тестовый образец. '+ 'Полная обязательная подпись синтетического изображения сохраняется без сокращения. '.repeat(13)};
  return {fixtures,registry,bytesByHash,readBytes,longCreditAsset,fixtureNow,fixtureDestinations,fixtureSnapshot};
}
