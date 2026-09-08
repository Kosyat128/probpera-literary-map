import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out='public/brand/ui-polish-v4';
const evidence='reports/ui-polish-v4/assets';
await mkdir(evidence,{recursive:true});
const generated=`${evidence}/orange-extraction-source.png`;
const original='../.tmp/ui-polish-v4-package/PROBPERA_UI_POLISH_V4_BRUSH_FLOW_FINAL/backgrounds/R07_read_purple.jpg';
const recipes=[
 {name:'orange-stroke',input:generated,crop:{left:45,top:0,width:1415,height:543},mode:'orange'},
 {name:'white-stroke',input:original,crop:{left:0,top:0,width:620,height:610},mode:'white'},
];
const files=[];
for(const recipe of recipes){
 const input=await readFile(recipe.input);
 const {data,info}=await sharp(input).extract(recipe.crop).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const rgba=Buffer.alloc(info.width*info.height*4);
 for(let i=0;i<info.width*info.height;i++){
  const r=data[i*3],g=data[i*3+1],b=data[i*3+2];
  let a;
  if(recipe.mode==='orange'){
   // A neutral matte cancels exactly in R-B; retain smooth pigment coverage.
   a=Math.max(0,(r-b)/255); if(a<3/255)a=0;
   rgba[i*4]=255;rgba[i*4+1]=a?Math.round(Math.max(0,Math.min(255,(g-b)/a))):117;rgba[i*4+2]=0;
  }else{
   // Original white pigment only. Violet and orange have low minimum channels.
   a=Math.max(0,Math.min(1,(Math.min(r,g,b)-38)/217));
   rgba[i*4]=255;rgba[i*4+1]=255;rgba[i*4+2]=255;
  }
  rgba[i*4+3]=Math.round(a*255);
 }
 const png=await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).trim({threshold:1}).png().toBuffer();
 await writeFile(`${evidence}/${recipe.name}.png`,png);
 await sharp(png).resize({width:1415,withoutEnlargement:true}).webp({quality:96,alphaQuality:100,effort:6}).toFile(`${out}/${recipe.name}.webp`);
 const bytes=await readFile(`${out}/${recipe.name}.webp`);const metadata=await sharp(bytes).metadata();
 files.push({file:`${recipe.name}.webp`,source:recipe.mode==='orange'?`${evidence}/orange-extraction-source.png`:'backgrounds/R07_read_purple.jpg',sourceSha256:createHash('sha256').update(input).digest('hex'),operation:{crop:recipe.crop,matte:recipe.mode==='orange'?'neutral matte cancellation (R-B)/255; unpremultiplied original orange':'original white pigment coverage from minimum channel; violet background excluded',resizeWidth:1415,withoutEnlargement:true,quality:96,alphaQuality:100},width:metadata.width,height:metadata.height,hasAlpha:metadata.hasAlpha,bytes:bytes.length,outputSha256:createHash('sha256').update(bytes).digest('hex')});
}
const manifest={recipe:'Owner latest revision: three times previous stroke widths, contrasting colors in separated edge locations. Strokes do not combine into multicolor boundary strips. No full-panel paintings or generated joins.',tool:'built-in image_gen for orange extraction followed by neutral-matte alpha cleanup. CSS tints the same high-resolution alpha white or violet without raster enlargement. Original R07 white extraction retained as source evidence.',files,deliveryBytes:files.reduce((s,x)=>s+x.bytes,0),runtimeBytes:files.find(x=>x.file==='orange-stroke.webp').bytes,placement:{atlas:'orange upper right; white along the middle of the right edge; solid violet left',violetSections:'orange and white in separate corners or side margins, with different positions in adjacent sections',whiteSections:'orange at an outer corner and violet vertically along a separate side margin'},sizing:{desktopOrange:'clamp(840px,81vw,1140px)',desktopSecondary:600,mobileOrange:510,mobileSecondary:330,scaleFromPrevious:3}};
await writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
await sharp({create:{width:1100,height:620,channels:4,background:'#24083a'}}).composite([{input:await sharp(`${out}/orange-stroke.webp`).resize({width:500}).toBuffer(),left:560,top:40},{input:await sharp(`${out}/white-stroke.webp`).resize({width:280}).toBuffer(),left:40,top:285}]).png().toFile(`${evidence}/alpha-on-violet-preview.png`);
console.log(JSON.stringify(manifest));
