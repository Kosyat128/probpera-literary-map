import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

// Original 3D room inspection, separate from actual-App and device acceptance.
const [attempt = 'a1', ...extra] = process.argv.slice(2);
assert.match(attempt, /^a[1-9][0-9]*$/u); assert.equal(extra.length, 0);
const requestedViews = [['high','overview'],['high','desk'],['high','side'],['high','back'],
 ['balanced','overview'],['economy','overview'],['economy','desk']];
const root = await fs.realpath('.');
assert.equal(root.replaceAll('\\', '/'), 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work');
const out = path.join('D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s13-ws', 'art-' + attempt);
await assert.rejects(fs.stat(out), { code: 'ENOENT' });
const inputs = ['src/components/globeWriterStudyGeometry.ts', 'src/components/globeQuality.ts',
  'src/components/globeCraftMaterials.ts', 'src/components/globeLibraryBookGeometry.ts',
  'docs/mobile/evidence/S13/writer-study-20260920/capture-study.mjs'];
const snapshot = () => Promise.all(inputs.map(async file => ({ path: file,
  sha256: createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex') })));
const before = await snapshot(), startedAt = new Date().toISOString();
const compiled = await build({ absWorkingDir: root, bundle: true, write: false, metafile: true,
  format: 'iife', platform: 'browser', stdin: { resolveDir: root, loader: 'ts', sourcefile: 'writer-study-inspection.ts', contents: `
import * as THREE from 'three';
import { createGlobeWriterStudy } from './src/components/globeWriterStudyGeometry';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1.5);renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#17151b');
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.01,80);
scene.add(new THREE.AmbientLight('#f7d29a',.66));
scene.add(new THREE.HemisphereLight('#ffe2ab','#170620',1.12));
const sun=new THREE.DirectionalLight('#ffd6a0',2.35);sun.position.set(4.5,3.4,4);scene.add(sun);
for(const [color,intensity,distance,position] of [['#c45b24',13,7,[-3.5,-.7,2]],['#e89a5d',9.5,4.8,[0,-1.55,2.35]],
 ['#7b3c91',6.5,4.6,[0,-1.2,-2.4]],['#6f2b8d',8,7,[0,3.5,-3]]]){
 const light=new THREE.PointLight(color,intensity,distance);light.position.set(...position);scene.add(light);
}
function textureBytes(texture){
 const seen=new Set();let bytes=0;
 if(texture.mipmaps?.some(m=>m.data)){
  for(const mip of texture.mipmaps)if(mip.data&&!seen.has(mip.data.buffer)){seen.add(mip.data.buffer);bytes+=mip.data.buffer.byteLength;}
  return bytes;
 }
 const image=texture.image;if(!image?.data)return 0;
 bytes=image.data.byteLength;
 if(texture.generateMipmaps){let w=image.width,h=image.height;const bytesPerPixel=bytes/(w*h);
  while(w>1||h>1){w=Math.max(1,Math.floor(w/2));h=Math.max(1,Math.floor(h/2));bytes+=w*h*bytesPerPixel;}}
 return bytes;
}
const retired=[];let resource=null,resourceKey=null,creationMs=0;
function retire(){
 if(!resource)return;
 scene.remove(resource.group);
 const textures=new Map(),geometry=new Map(),materials=new Map(),instances=new Map();
 resource.group.traverse(object=>{if(object.isInstancedMesh){instances.set(object,0);object.addEventListener('dispose',()=>instances.set(object,instances.get(object)+1));}});
 const originalTexture=THREE.Texture.prototype.dispose,originalGeometry=THREE.BufferGeometry.prototype.dispose,originalMaterial=THREE.Material.prototype.dispose;
 THREE.Texture.prototype.dispose=function(){const item=textures.get(this)||{name:this.name,bytesIncludingMips:textureBytes(this),calls:0};item.calls++;textures.set(this,item);return originalTexture.call(this);};
 THREE.BufferGeometry.prototype.dispose=function(){geometry.set(this,(geometry.get(this)||0)+1);return originalGeometry.call(this);};
 THREE.Material.prototype.dispose=function(){materials.set(this,(materials.get(this)||0)+1);return originalMaterial.call(this);};
 try{resource.dispose();resource.dispose();}
 finally{THREE.Texture.prototype.dispose=originalTexture;THREE.BufferGeometry.prototype.dispose=originalGeometry;THREE.Material.prototype.dispose=originalMaterial;}
 retired.push({key:resourceKey,ownedTextures:[...textures.values()],ownedTextureBytesIncludingMips:[...textures.values()].reduce((s,t)=>s+t.bytesIncludingMips,0),
  geometryCount:geometry.size,materialCount:materials.size,instancedMeshCount:instances.size,
  exactOnce:[...textures.values()].every(t=>t.calls===1)&&[...geometry.values(),...materials.values(),...instances.values()].every(n=>n===1)});
 resource=null;resourceKey=null;
}
window.captureStudy=async(kind,tier,view)=>{
 const key=kind+':'+tier;
 if(resourceKey!==key){retire();const started=performance.now();resource=createGlobeWriterStudy(tier);
  creationMs=performance.now()-started;resourceKey=key;scene.add(resource.group);}
 const target=new THREE.Vector3(0,-1.0,-8);
 camera.fov=52;
 if(view==='desk'){camera.position.set(0,.1,-4.5);target.set(3.1,-3.4,-8.0);}
 else if(view==='side'){camera.position.set(-3.2,.5,1.2);target.set(-10,-1.2,-3);}
 else if(view==='back'){camera.position.set(0,.5,-4.5);target.set(0,-1.0,10);}
 else camera.position.set(0,.6,4.5);
 camera.lookAt(target);camera.updateProjectionMatrix();resource.group.updateMatrixWorld(true);
 renderer.compile(scene,camera);
 for(let index=0;index<3;index++){renderer.render(scene,camera);await new Promise(requestAnimationFrame);}
 const frames=[];for(let index=0;index<3;index++){const start=performance.now();renderer.render(scene,camera);frames.push(performance.now()-start);await new Promise(requestAnimationFrame);}
 const geometries=new Set(),materials=new Set(),textures=new Set(),buffers=new Set(),bounds=new THREE.Box3();
 const point=new THREE.Vector3(),normal=new THREE.Vector3(),matrix=new THREE.Matrix4(),local=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3();
 let meshes=0,lines=0,instances=0,triangles=0,drawGroups=0,geometryBytes=0,maxRadius=0,vertices=0,finite=true;
 let normalCount=0,missingNormalMeshes=0,zeroNormals=0,finiteNormals=true,minNormalLength=Infinity,maxNormalLength=0;
 const meshDetails=[];
 resource.group.traverse(object=>{
  if(!object.isMesh&&!object.isLine)return;
  const count=object.isInstancedMesh?object.count:1,geometry=object.geometry,positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
  if(object.isMesh){meshes++;instances+=count;triangles+=(geometry.index?.count??positions.count)/3*count;
   drawGroups+=Array.isArray(object.material)?geometry.groups.length:1;if(!normals)missingNormalMeshes++;}else lines++;
  geometries.add(geometry);
  for(let instance=0;instance<count;instance++){
   if(object.isInstancedMesh){object.getMatrixAt(instance,local);matrix.multiplyMatrices(object.matrixWorld,local);}else matrix.copy(object.matrixWorld);
   normalMatrix.getNormalMatrix(matrix);
   for(let index=0;index<positions.count;index++){
    point.fromBufferAttribute(positions,index).applyMatrix4(matrix);vertices++;
    finite=finite&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z);
    bounds.expandByPoint(point);maxRadius=Math.max(maxRadius,Math.hypot(point.x,point.z));
    if(normals){normal.fromBufferAttribute(normals,index);const length=normal.length();
     minNormalLength=Math.min(minNormalLength,length);maxNormalLength=Math.max(maxNormalLength,length);
     if(length<1e-8)zeroNormals++;normal.applyNormalMatrix(normalMatrix);normalCount++;
     finiteNormals=finiteNormals&&Number.isFinite(length)&&Number.isFinite(normal.x)&&Number.isFinite(normal.y)&&Number.isFinite(normal.z);}
   }
  }
  const ownedMaterials=Array.isArray(object.material)?object.material:[object.material];
  for(const material of ownedMaterials){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}
  meshDetails.push({name:object.name,instances:count,vertices:positions.count,triangles:object.isMesh?(geometry.index?.count??positions.count)/3*count:0,
   materials:ownedMaterials.map(material=>({name:material.name,color:material.color?.getHexString(),metalness:material.metalness,roughness:material.roughness}))});
 });
 const countBuffer=attribute=>{const buffer=attribute?.array?.buffer;if(buffer&&!buffers.has(buffer)){buffers.add(buffer);geometryBytes+=buffer.byteLength;}};
 for(const geometry of geometries)for(const attribute of [...Object.values(geometry.attributes),geometry.index])countBuffer(attribute);
 resource.group.traverse(object=>{if(object.isInstancedMesh){countBuffer(object.instanceMatrix);countBuffer(object.instanceColor);}});
 return{kind,tier,view,creationMs,groupName:resource.group.name,provenance:resource.group.userData.provenance,
  meshes,lines,instances,totalTriangles:triangles,theoreticalDrawGroups:drawGroups,geometryCount:geometries.size,geometryBytes,
  materialCount:materials.size,referencedTextureCount:textures.size,referencedTextureBytesIncludingMips:[...textures].reduce((sum,t)=>sum+textureBytes(t),0),
  transformedBounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),maxRadius,vertices,finite},
  normals:{count:normalCount,missingNormalMeshes,zeroNormals,finite:finiteNormals,minObjectSpaceLength:normalCount?minNormalLength:null,maxObjectSpaceLength:normalCount?maxNormalLength:null},
  meshDetails,render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,gpuMemory:{...renderer.info.memory}},
  cpuRenderMs:{median:[...frames].sort((a,b)=>a-b)[1],max:Math.max(...frames)},
  camera:{position:camera.position.toArray(),target:target.toArray(),fov:camera.fov},devicePerformanceAccepted:false};
};
window.finishStudyInspection=()=>{retire();renderer.render(scene,camera);const memory={...renderer.info.memory};renderer.dispose();
 return{retired,gpuMemoryAfterOwnerDisposal:memory,globalGpuLeakClaim:false};};
` } });
// A future material/helper dependency must be explicitly added to the binding
// list before these images can be used as evidence of that expanded source.
for (const file of Object.keys(compiled.metafile.inputs).map(value => value.replaceAll('\\', '/')).filter(value => value.startsWith('src/'))) {
  assert.ok(inputs.includes(file), 'Unbound local capture dependency: ' + file);
}
await fs.mkdir(out, { recursive: true });
const errors = [], frames = []; let disposal = null;
const context = await chromium.launchPersistentContext(path.join(out, 'profile'), {
  channel: 'chrome', headless: true, viewport: { width: 1280, height: 900 },
});
try {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', route => {
    if (route.request().url() !== 'https://writer-study-inspection.test/') {
      errors.push('Unexpected external request: ' + route.request().url()); return route.abort();
    }
    return route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}canvas{display:block}</style></head><body></body></html>' });
  });
  await page.goto('https://writer-study-inspection.test/');
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
  for (const kind of ['study']) {
    for (const [tier, view] of requestedViews) {
      const record = await page.evaluate(args => window.captureStudy(...args), [kind, tier, view]);
      record.path = path.join(out, 'room-' + kind + '-' + tier + '-' + view + '.png');
      await page.screenshot({ path: record.path });
      record.sha256 = createHash('sha256').update(await fs.readFile(record.path)).digest('hex'); frames.push(record);
    }
  }
  disposal = await page.evaluate(() => window.finishStudyInspection());
} finally { await context.close(); }
const after = await snapshot();
const result = { startedAt, endedAt: new Date().toISOString(), captureMode: 'room-and-details', sourceInputs: before,
  sourceInputsUnchanged: JSON.stringify(before) === JSON.stringify(after), frames, disposal, errors,
  lighting: 'Isolated warm canonical-style inspection rig matching the whale close-ups; not an actual-App screenshot or neutral material evaluation.',
  scope: 'Original full 3D room: four High interior views, Balanced/Economy overviews and an Economy desk view. These cameras are inspection cameras, not the application camera.',
  inspectionOnly: true, actualApp: false, externalImageAssetsUsed: false,
  devicePerformanceAccepted: false, artAccepted: false, releaseReady: false };
await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({pass:errors.length===0,sourceInputsUnchanged:result.sourceInputsUnchanged,frames:frames.map(({tier,view,meshes,totalTriangles,path})=>({tier,view,meshes,totalTriangles,path})),result:path.join(out,'result.json')},null,2));
assert.deepEqual(errors, []); assert.equal(result.sourceInputsUnchanged, true); assert.equal(frames.length, requestedViews.length);
for (const kind of ['study']) {
  assert.deepEqual(frames.filter(frame => frame.kind === kind).map(frame => [frame.tier, frame.view]), requestedViews);
}
assert.ok(frames.every(frame => frame.transformedBounds.finite && frame.normals.finite));
assert.deepEqual(disposal.retired.map(owner => owner.key), ['study'].flatMap(kind =>
  ['high', 'balanced', 'economy'].map(tier => kind + ':' + tier)));
assert.ok(disposal.retired.every(owner => owner.exactOnce));
