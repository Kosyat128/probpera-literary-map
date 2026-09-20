import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

// Isolated factory inspection, not an actual-App capture or an art approval.
// Usage: node docs/mobile/evidence/S13/visual-refinement-20260920/capture.mjs a1
// One renderer, six PNGs; portrait views are three-column contact sheets.
const [attempt = 'a1', ...extra] = process.argv.slice(2);
assert.match(attempt, /^a[1-9][0-9]*$/u); assert.equal(extra.length, 0);
const root = await fs.realpath('.');
assert.equal(root.replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const out = path.join('D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-vr', 'art-' + attempt);
await assert.rejects(fs.stat(out), { code: 'ENOENT' });
const inputs = ['src/components/globeCeramicPortraitStandGeometry.ts', 'src/components/globeWriterStudyGeometry.ts',
  'src/components/globeCraftMaterials.ts', 'src/components/globeQuality.ts', 'src/components/globeLibraryBookGeometry.ts', 'src/planet/writerStudySketch.ts',
  'package.json', 'package-lock.json', 'docs/mobile/evidence/S13/visual-refinement-20260920/capture.mjs'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const snapshot = () => Promise.all(inputs.map(async file => ({ path: file, sha256: digest(await fs.readFile(path.join(root, file))) })));
const before = await snapshot(), startedAt = new Date().toISOString();
const lighting = { background: '#1a1b20', ambient: { color: '#ffffff', intensity: .38 },
  hemisphere: { sky: '#f3f5ff', ground: '#303039', intensity: .82 },
  directional: { color: '#ffffff', intensity: 2.1, position: [4.5, 3.4, 4] },
  toneMapping: 'ACESFilmicToneMapping', exposure: 1, outputColorSpace: 'SRGBColorSpace',
  note: 'Neutral inspection rig with app-like light types; not the application warm lighting. Factory-owned local lights and reflection maps remain active.' };
const views = [['portraits', 'high', 'front'], ['portraits', 'high', 'three-quarter'], ['portraits', 'economy', 'front'],
  ['study', 'high', 'overview'], ['study', 'high', 'desk'], ['study', 'economy', 'overview']];
const compiled = await build({ absWorkingDir: root, bundle: true, write: false, metafile: true,
  format: 'iife', platform: 'browser', stdin: { resolveDir: root, loader: 'ts', sourcefile: 'visual-refinement-capture.ts', contents: `
import * as THREE from 'three';
import { createCeramicPortraitStand } from './src/components/globeCeramicPortraitStandGeometry';
import { createGlobeWriterStudy } from './src/components/globeWriterStudyGeometry';
const lighting=${JSON.stringify(lighting)}, width=1536, height=852;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1.5);renderer.setSize(width,height);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=lighting.exposure;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(lighting.background);
const camera=new THREE.PerspectiveCamera(38,width/height,.01,80);
scene.add(new THREE.AmbientLight(lighting.ambient.color,lighting.ambient.intensity));
scene.add(new THREE.HemisphereLight(lighting.hemisphere.sky,lighting.hemisphere.ground,lighting.hemisphere.intensity));
const sun=new THREE.DirectionalLight(lighting.directional.color,lighting.directional.intensity);sun.position.set(...lighting.directional.position);scene.add(sun);
let owners=[],currentKey=null,finished=false;const retired=[];
function textureBytes(texture){
 const image=texture.image;if(!image?.data)return 0;
 if(texture.mipmaps?.some(mip=>mip.data)){
  const ranges=new Map();for(const view of [image.data,...texture.mipmaps.map(mip=>mip.data).filter(Boolean)]){
   const list=ranges.get(view.buffer)||[];list.push([view.byteOffset,view.byteOffset+view.byteLength]);ranges.set(view.buffer,list);}
  let bytes=0;for(const list of ranges.values()){list.sort((a,b)=>a[0]-b[0]);let start=list[0][0],end=list[0][1];
   for(const [next,last] of list.slice(1)){if(next>end){bytes+=end-start;start=next;}end=Math.max(end,last);}bytes+=end-start;}return bytes;
 }
 let bytes=image.data.byteLength,w=image.width,h=image.height;const pixelBytes=bytes/(w*h);
 if(texture.generateMipmaps)while(w>1||h>1){w=Math.max(1,Math.floor(w/2));h=Math.max(1,Math.floor(h/2));bytes+=w*h*pixelBytes;}return bytes;
}
function retireAll(){
 for(const {owner,key} of owners){
  scene.remove(owner.group);const reachableGeometry=new Set(),reachableMaterials=new Set(),reachableTextures=new Set(),instances=new Map();
  owner.group.traverse(object=>{if(object.geometry)reachableGeometry.add(object.geometry);
   for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){reachableMaterials.add(material);for(const value of Object.values(material))if(value?.isTexture)reachableTextures.add(value);}
   if(object.isInstancedMesh){instances.set(object,0);object.addEventListener('dispose',()=>instances.set(object,instances.get(object)+1));}});
  const textures=new Map(),geometries=new Map(),materials=new Map();
  const textureDispose=THREE.Texture.prototype.dispose,geometryDispose=THREE.BufferGeometry.prototype.dispose,materialDispose=THREE.Material.prototype.dispose;
  THREE.Texture.prototype.dispose=function(){const record=textures.get(this)||{name:this.name,bytesIncludingMips:textureBytes(this),calls:0};record.calls++;textures.set(this,record);return textureDispose.call(this);};
  THREE.BufferGeometry.prototype.dispose=function(){geometries.set(this,(geometries.get(this)||0)+1);return geometryDispose.call(this);};
  THREE.Material.prototype.dispose=function(){materials.set(this,(materials.get(this)||0)+1);return materialDispose.call(this);};
  try{owner.dispose();owner.dispose();}finally{THREE.Texture.prototype.dispose=textureDispose;THREE.BufferGeometry.prototype.dispose=geometryDispose;THREE.Material.prototype.dispose=materialDispose;}
  retired.push({key,ownedTextures:[...textures.values()],ownedTextureBytesIncludingMips:[...textures.values()].reduce((sum,item)=>sum+item.bytesIncludingMips,0),
   geometryCount:geometries.size,materialCount:materials.size,instancedMeshCount:instances.size,
   reachableResourcesDisposed:[...reachableGeometry].every(item=>geometries.has(item))&&[...reachableMaterials].every(item=>materials.has(item))&&[...reachableTextures].every(item=>textures.has(item)),
   exactOnce:[...textures.values()].every(item=>item.calls===1)&&[...geometries.values(),...materials.values(),...instances.values()].every(count=>count===1)});
 }
 owners=[];currentKey=null;
}
function describe(owner){
 owner.group.updateMatrixWorld(true);
 const geometries=new Set(),materials=new Set(),textures=new Set(),buffers=new Set(),bounds=new THREE.Box3();
 const point=new THREE.Vector3(),normal=new THREE.Vector3(),matrix=new THREE.Matrix4(),instanceMatrix=new THREE.Matrix4();
 let meshes=0,instances=0,triangles=0,geometryBytes=0,maxRadius=0,finite=true,finiteNormals=true,zeroNormals=0,missingNormals=0;
 const meshDetails=[];owner.group.traverse(object=>{
  if(!object.isMesh&&!object.isLine)return;
  const geometry=object.geometry,positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),count=object.isInstancedMesh?object.count:1;
  geometries.add(geometry);if(object.isMesh){meshes++;instances+=count;triangles+=(geometry.index?.count??positions.count)/3*count;if(!normals)missingNormals++;}
  for(let instance=0;instance<count;instance++){
   if(object.isInstancedMesh){object.getMatrixAt(instance,instanceMatrix);matrix.multiplyMatrices(object.matrixWorld,instanceMatrix);}else matrix.copy(object.matrixWorld);
   for(let vertex=0;vertex<positions.count;vertex++){point.fromBufferAttribute(positions,vertex).applyMatrix4(matrix);
    finite=finite&&point.toArray().every(Number.isFinite);bounds.expandByPoint(point);maxRadius=Math.max(maxRadius,Math.hypot(point.x,point.z));}
  }
  if(normals)for(let vertex=0;vertex<normals.count;vertex++){normal.fromBufferAttribute(normals,vertex);finiteNormals=finiteNormals&&normal.toArray().every(Number.isFinite);if(normal.lengthSq()<1e-16)zeroNormals++;}
  const localMaterials=Array.isArray(object.material)?object.material:[object.material];
  for(const material of localMaterials){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}
  meshDetails.push({name:object.name,instances:count,vertices:positions.count,materials:localMaterials.map(material=>material.name)});
 });
 const countBuffer=attribute=>{const buffer=attribute?.array?.buffer;if(buffer&&!buffers.has(buffer)){buffers.add(buffer);geometryBytes+=buffer.byteLength;}};
 for(const geometry of geometries)for(const attribute of [...Object.values(geometry.attributes),geometry.index])countBuffer(attribute);
 owner.group.traverse(object=>{if(object.isInstancedMesh){countBuffer(object.instanceMatrix);countBuffer(object.instanceColor);}});
 return{groupName:owner.group.name,provenance:owner.group.userData.provenance,meshes,instances,totalTriangles:triangles,geometryBytes,geometryCount:geometries.size,materialCount:materials.size,
  referencedTextureCount:textures.size,referencedTextureBytesIncludingMips:[...textures].reduce((sum,item)=>sum+textureBytes(item),0),meshDetails,
  transformedBounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),maxRadius,finite},normals:{finite:finiteNormals,zeroNormals,missingNormals}};
}
function placeCamera(owner,kind,view,aspect){
 camera.aspect=aspect;camera.fov=kind==='study'?52:38;
 const target=new THREE.Vector3();
 if(kind==='study'){
  if(view==='desk'){camera.position.set(0,.1,-4.5);target.set(3.1,-3.4,-8);}else{camera.position.set(0,.6,4.5);target.set(0,-1,-8);}
 }else{
  const box=new THREE.Box3().setFromObject(owner.group);box.getCenter(target);
  const direction=new THREE.Vector3(...(view==='three-quarter'?[.86,.025,1.04]:[0,.025,1.35])).normalize();
  camera.position.copy(target).add(direction);camera.lookAt(target);camera.updateMatrixWorld(true);
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const tanY=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=0;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
   const delta=new THREE.Vector3(x,y,z).sub(target);distance=Math.max(distance,delta.dot(direction)+1.12*Math.max(Math.abs(delta.dot(up))/tanY,Math.abs(delta.dot(right))/(tanY*aspect)));}
  camera.position.copy(target).addScaledVector(direction,distance);
 }
 camera.lookAt(target);camera.updateProjectionMatrix();return{position:camera.position.toArray(),target:target.toArray(),fov:camera.fov,aspect};
}
window.captureRefinement=async(kind,tier,view)=>{
 const key=kind+':'+tier;
 if(currentKey!==key){retireAll();
  for(const subject of kind==='portraits'?['pushkin','hemingway','tolstoy']:['study']){
   const started=performance.now(),owner=subject==='study'?createGlobeWriterStudy(tier):createCeramicPortraitStand(subject,tier);
   owner.setAmbientTime?.(0);scene.add(owner.group);owners.push({owner,key:subject+':'+tier,subject,creationMs:performance.now()-started});}
  currentKey=key;
 }
 document.querySelector('header').replaceChildren(...owners.map(({subject})=>{const label=document.createElement('span');label.textContent=subject+' · '+tier+' · '+view;return label;}));
 const columns=owners.length,columnWidth=width/columns,records=owners.map(({owner,key,subject,creationMs})=>({key,subject,creationMs,...describe(owner)}));
 for(let frame=0;frame<3;frame++){
  renderer.setScissorTest(true);
  owners.forEach(({owner},index)=>{
   for(const item of owners)item.owner.group.visible=item.owner===owner;
   renderer.setViewport(index*columnWidth,0,columnWidth,height);renderer.setScissor(index*columnWidth,0,columnWidth,height);
   records[index].camera=placeCamera(owner,kind,view,columnWidth/height);renderer.render(scene,camera);
   records[index].render={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,gpuMemory:{...renderer.info.memory}};
  });await new Promise(requestAnimationFrame);
 }
 return{kind,tier,view,threeRevision:THREE.REVISION,viewport:{width,height:height+48,canvasHeight:height,pixelRatio:renderer.getPixelRatio()},subjects:records};
};
window.finishRefinement=()=>{if(finished)return null;finished=true;try{retireAll();renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.render(scene,camera);
 return{retired,gpuMemoryAfterOwnerDisposal:{...renderer.info.memory},globalGpuLeakClaim:false};}finally{renderer.dispose();}};
` } });
for (const file of Object.keys(compiled.metafile.inputs).map(value => value.replaceAll('\\', '/')).filter(value => value.startsWith('src/'))) {
  assert.ok(inputs.includes(file), 'Unbound local capture dependency: ' + file);
}
await fs.mkdir(out, { recursive: true });
const errors = [], frames = []; let disposal = null, page, captureFailure = null;
const context = await chromium.launchPersistentContext(path.join(out, 'profile'), { channel: 'chrome', headless: true, viewport: { width: 1536, height: 900 } });
const browserVersion = context.browser()?.version() ?? null;
try {
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', route => {
    if (route.request().url() !== 'https://visual-refinement.test/') { errors.push('Unexpected external request: ' + route.request().url()); return route.abort(); }
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden;background:#1a1b20;color:#eee;font:16px system-ui}header{height:48px;display:flex;align-items:center}header span{flex:1;text-align:center}canvas{display:block}</style></head><body><header></header></body></html>' });
  });
  await page.goto('https://visual-refinement.test/'); await page.addScriptTag({ content: compiled.outputFiles[0].text });
  for (const request of views) {
    const frame = await page.evaluate(args => window.captureRefinement(...args), request);
    frame.path = path.join(out, request.join('-') + '.png'); await page.screenshot({ path: frame.path });
    frame.sha256 = digest(await fs.readFile(frame.path)); frames.push(frame);
  }
} catch (error) { captureFailure = error.stack ?? String(error); }
finally {
  try { if (page && !page.isClosed()) disposal = await page.evaluate(() => window.finishRefinement?.() ?? null); }
  catch (error) { errors.push('Resource disposal failed: ' + error.message); }
  finally { await context.close(); }
}
const after = await snapshot();
const sourceInputsUnchanged = JSON.stringify(before) === JSON.stringify(after);
const expectedRetirements = ['pushkin:high','hemingway:high','tolstoy:high','pushkin:economy','hemingway:economy','tolstoy:economy','study:high','study:economy'];
const geometryFinite = frames.every(frame => frame.subjects.every(subject => subject.transformedBounds.finite && subject.normals.finite && subject.normals.zeroNormals === 0 && subject.normals.missingNormals === 0));
const disposalVerified = disposal?.retired.every(owner => owner.exactOnce && owner.reachableResourcesDisposed)
  && JSON.stringify(disposal.retired.map(owner => owner.key)) === JSON.stringify(expectedRetirements);
const pass = !captureFailure && errors.length === 0 && sourceInputsUnchanged && frames.length === views.length && geometryFinite && disposalVerified;
const result = { schemaVersion: 1, startedAt, endedAt: new Date().toISOString(), attempt, pass,
  sourceInputs: before, sourceInputsUnchanged, sourceInputsAfter: sourceInputsUnchanged ? undefined : after,
  compiledBundleSha256: digest(compiled.outputFiles[0].contents), nodeVersion: process.version, browserVersion, lighting,
  frames, disposal, errors, captureFailure, geometryFinite, disposalVerified: Boolean(disposalVerified),
  scope: 'Three portrait subjects: High front and three-quarter contact sheets, Economy front. Study: High overview and desk, Economy overview. Isolated inspection cameras and neutral lighting.',
  passMeaning: 'Capture completion, unchanged source bytes, finite resources and observed idempotent retirement only; no visual or likeness judgement.',
  inspectionOnly: true, actualApp: false, externalImageAssetsUsed: false, portraitReferencePixelsUsed: false,
  likenessAccepted: false, artAccepted: false, userRealismRequirementSatisfied: false, devicePerformanceAccepted: false, releaseReady: false };
const resultPath = path.join(out, 'result.json'); await fs.writeFile(resultPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ pass, sourceInputsUnchanged, frames: frames.map(({ path, sha256 }) => ({ path, sha256 })), result: resultPath, errors, captureFailure }, null, 2));
assert.equal(pass, true, 'Capture incomplete or source/resource precondition failed; retained result records the failure');
