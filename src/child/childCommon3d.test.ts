import { describe, expect, it } from "vitest";
import { decodeCommon3dModel, decodeCommon3dPackage, parseCommon3dJson } from "./childCommon3d";
import { importCommon3dModel } from "./childCommon3dImport";
import { common3dFixture } from "./childCommon3dFixture";
import * as THREE from "three";
describe("signed common static 3D import profile",()=>{
  it("decodes actual indexed geometry and imports it at signed bounds with explicit idempotent disposal",()=>{
    const f=common3dFixture(),pack=decodeCommon3dPackage(f.pack)!;expect(pack).not.toBeNull();
    const checked=decodeCommon3dModel(f.bytes,f.model,f.buffers,pack.tiers[1]);expect(checked.triangles).toBe(1);expect(checked.meshes[0][0].positions[1]).toBe(-1.5);
    const model=importCommon3dModel(f.bytes,f.model,f.buffers,new Map(),pack.tiers[1]);expect(model.root.children).toHaveLength(1);model.dispose();model.dispose();expect(model.root.children).toHaveLength(0);
  });
  it("rejects duplicate JSON fields, external/deceptive aliases, unknown formats, versions and orphan dependencies",()=>{
    expect(()=>parseCommon3dJson(new TextEncoder().encode('{"asset":{},"\\u0061sset":{}}'))).toThrow();
    const f=common3dFixture();for(const alias of ["../vertices.bin","https://example.test/x.bin","data:application/octet-stream;base64,AA=="]){const raw={...f.raw,buffers:[{uri:alias,byteLength:42}]},bytes=new TextEncoder().encode(JSON.stringify(raw));expect(()=>decodeCommon3dModel(bytes,{...f.model,model:{...f.model.model,encodedBytes:bytes.length}},f.buffers,f.pack.tiers[1])).toThrow();}
    expect(decodeCommon3dPackage({...f.pack,formatProfile:"ktx2-basis"})).toBeNull();expect(decodeCommon3dPackage({...f.pack,packageVersion:0})).toBeNull();
    expect(decodeCommon3dPackage({...f.pack,tiers:f.pack.tiers.map(t=>({...t,models:[{...f.model,dependencies:[...f.model.dependencies,{...f.model.dependencies[0],alias:"other.bin"}]}]}))})).toBeNull();
    expect(()=>decodeCommon3dModel(f.bytes,{...f.model,dependencies:[]},f.buffers,f.pack.tiers[1])).toThrow();
  });
  it("denies nonfinite vertices, out of range indices, overflow strides and model bounds before scene apply",()=>{
    const f=common3dFixture();new DataView(f.buffer.buffer).setFloat32(0,NaN,true);expect(()=>decodeCommon3dModel(f.bytes,f.model,f.buffers,f.pack.tiers[1])).toThrow();
    new DataView(f.buffer.buffer).setFloat32(0,-.5,true);new DataView(f.buffer.buffer).setUint16(40,7,true);expect(()=>decodeCommon3dModel(f.bytes,f.model,f.buffers,f.pack.tiers[1])).toThrow();
    const good=common3dFixture();expect(()=>importCommon3dModel(good.bytes,{...good.model,bounds:{min:[0,-2,-1],max:[1,-1.1,1]}},good.buffers,new Map(),good.pack.tiers[1])).toThrow();
    const raw={...good.raw,bufferViews:[{buffer:0,byteLength:36,byteStride:252},good.raw.bufferViews[1]]},bytes=new TextEncoder().encode(JSON.stringify(raw));expect(()=>decodeCommon3dModel(bytes,{...good.model,model:{...good.model.model,encodedBytes:bytes.length}},good.buffers,good.pack.tiers[1])).toThrow();
  });
  it("rejects unmeasured compressed extensions, cycles, hidden cameras and a tier over its decoded budget",()=>{
    const f=common3dFixture();for(const patch of [{extensionsUsed:["KHR_draco_mesh_compression"]},{extensionsUsed:["EXT_meshopt_compression"]},{cameras:[]},{nodes:[{mesh:0,children:[0]}]}]){const bytes=new TextEncoder().encode(JSON.stringify({...f.raw,...patch}));expect(()=>decodeCommon3dModel(bytes,{...f.model,model:{...f.model.model,encodedBytes:bytes.length}},f.buffers,f.pack.tiers[1])).toThrow();}
    expect(()=>decodeCommon3dModel(f.bytes,f.model,f.buffers,{maxDecodedBytes:47,maxTriangles:1})).toThrow();
  });
  it("checks real GLB2 chunk identity and embedded binary decoding, refusing trailing chunks and changed container version",()=>{
    const f=common3dFixture(),raw={...f.raw,buffers:[{byteLength:42}]},json=new TextEncoder().encode(JSON.stringify(raw)),size=Math.ceil(json.length/4)*4,bytes=new Uint8Array(20+size+8+44),v=new DataView(bytes.buffer);
    v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,bytes.length,true);v.setUint32(12,size,true);v.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+size);bytes.set(json,20);v.setUint32(20+size,44,true);v.setUint32(24+size,0x004e4942,true);bytes.set(f.buffer,28+size);
    const descriptor={...f.model,model:{...f.model.model,mime:"model/gltf-binary" as const,alias:"fixture.glb",encodedBytes:bytes.length},dependencies:[]};expect(decodeCommon3dModel(bytes,descriptor,new Map(),f.pack.tiers[1]).triangles).toBe(1);
    v.setUint32(4,3,true);expect(()=>decodeCommon3dModel(bytes,descriptor,new Map(),f.pack.tiers[1])).toThrow();v.setUint32(4,2,true);const tail=new Uint8Array(bytes.length+8);tail.set(bytes);new DataView(tail.buffer).setUint32(8,tail.length,true);expect(()=>decodeCommon3dModel(tail,{...descriptor,model:{...descriptor.model,encodedBytes:tail.length}},new Map(),f.pack.tiers[1])).toThrow();
  });
  it("applies checked UV and sampler state without mutating or disposing the acquired image owner",()=>{
    const f=common3dFixture(),buffer=new Uint8Array(66);buffer.set(f.buffer.subarray(0,36));buffer.set(f.buffer.subarray(36),60);const v=new DataView(buffer.buffer);[0,0,1,0,.5,1].forEach((n,i)=>v.setFloat32(36+i*4,n,true));
    const raw={...f.raw,buffers:[{uri:"vertices.bin",byteLength:66}],bufferViews:[f.raw.bufferViews[0],{buffer:0,byteOffset:60,byteLength:6},{buffer:0,byteOffset:36,byteLength:24}],accessors:[...f.raw.accessors,{bufferView:2,componentType:5126,count:3,type:"VEC2"}],meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:2},indices:1,material:0}]}],images:[{uri:"fixture.png"}],textures:[{source:0,sampler:0}],samplers:[{wrapS:33648,wrapT:33071,magFilter:9728,minFilter:9729}],materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}]};
    const bytes=new TextEncoder().encode(JSON.stringify(raw)),descriptor={...f.model,model:{...f.model.model,encodedBytes:bytes.length},dependencies:[{...f.model.dependencies[0],encodedBytes:66},{assetId:"synthetic-image",entity:{kind:"stand" as const,id:"synthetic-image",contentChecksum:"a".repeat(64)},mime:"image/png" as const,checksum:"b".repeat(64),encodedBytes:1,alias:"fixture.png",kind:"texture" as const}]};
    const source=new THREE.Texture({naturalWidth:1,naturalHeight:1} as HTMLImageElement);source.wrapS=THREE.ClampToEdgeWrapping;let disposed=0;source.addEventListener("dispose",()=>disposed++);
    const imported=importCommon3dModel(bytes,descriptor,new Map([["vertices.bin",buffer]]),new Map([["fixture.png",source]]),f.pack.tiers[1]);let material:THREE.MeshStandardMaterial|undefined;
    imported.root.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial)material=o.material;});expect(material?.map).not.toBe(source);expect(material?.map?.wrapS).toBe(THREE.MirroredRepeatWrapping);expect(material?.map?.flipY).toBe(false);imported.dispose();expect(disposed).toBe(0);source.dispose();
  });
});

describe("common model compiler and renderer parity regressions",()=>{
  it("denies WebP as High/Balanced material source while keeping the Economy fallback explicit",()=>{
    const f=common3dFixture(),image={assetId:"synthetic-image",entity:{kind:"stand" as const,id:"synthetic-image",contentChecksum:"a".repeat(64)},mime:"image/webp" as const,checksum:"b".repeat(64),encodedBytes:16,alias:"image.webp",kind:"texture" as const};
    const tiers=f.pack.tiers.map(t=>({...t,models:[{...f.model,dependencies:[...f.model.dependencies,image]}]}));
    expect(decodeCommon3dPackage({...f.pack,tiers})).toBeNull();
    const fallback=f.pack.tiers.map(t=>t.tier==="economy"?{...t,models:[{...f.model,dependencies:[...f.model.dependencies,image]}]}:t);
    expect(decodeCommon3dPackage({...f.pack,tiers:fallback})).not.toBeNull();
  });
  it("refuses a GLB bufferView that reads BIN padding beyond the logical signed buffer",()=>{
    const f=common3dFixture(),raw={...f.raw,buffers:[{byteLength:42}],bufferViews:[f.raw.bufferViews[0],{buffer:0,byteOffset:38,byteLength:6}]},json=new TextEncoder().encode(JSON.stringify(raw)),size=Math.ceil(json.length/4)*4,bytes=new Uint8Array(20+size+8+44),v=new DataView(bytes.buffer);
    v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,bytes.length,true);v.setUint32(12,size,true);v.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+size);bytes.set(json,20);v.setUint32(20+size,44,true);v.setUint32(24+size,0x004e4942,true);bytes.set(f.buffer,28+size);
    const descriptor={...f.model,model:{...f.model.model,mime:"model/gltf-binary" as const,alias:"fixture.glb",encodedBytes:bytes.length},dependencies:[]};
    expect(()=>decodeCommon3dModel(bytes,descriptor,new Map(),f.pack.tiers[1])).toThrow("bufferView range");
  });
  it("rejects a textured primitive without UV during source validation before renderer import",()=>{
    const f=common3dFixture(),raw={...f.raw,meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:0}]}],images:[{uri:"image.png"}],textures:[{source:0}],materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}]},bytes=new TextEncoder().encode(JSON.stringify(raw));
    const descriptor={...f.model,model:{...f.model.model,encodedBytes:bytes.length},dependencies:[...f.model.dependencies,{assetId:"synthetic-image",entity:{kind:"stand" as const,id:"synthetic-image",contentChecksum:"a".repeat(64)},mime:"image/png" as const,checksum:"b".repeat(64),encodedBytes:16,alias:"image.png",kind:"texture" as const}]};
    expect(()=>decodeCommon3dModel(bytes,descriptor,f.buffers,f.pack.tiers[1])).toThrow("requires UV");
  });
});

describe("full surrounding environment geometry clearance",()=>{
 function environment(crossing=false){
  const f=common3dFixture(),vertices=crossing?[-3,0,0,3,0,0,0,3,0]:[-3,-3,-3,3,-3,-3,3,3,-3,-3,3,-3,-3,-3,3,3,-3,3,3,3,3,-3,3,3],indices=crossing?[0,1,2]:[0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7,0,3,7,0,7,4,1,5,6,1,6,2],buffer=new Uint8Array(vertices.length*4+indices.length*2),view=new DataView(buffer.buffer);
  vertices.forEach((n,i)=>view.setFloat32(i*4,n,true));indices.forEach((n,i)=>view.setUint16(vertices.length*4+i*2,n,true));
  const raw={...f.raw,buffers:[{uri:"vertices.bin",byteLength:buffer.length}],bufferViews:[{buffer:0,byteLength:vertices.length*4},{buffer:0,byteOffset:vertices.length*4,byteLength:indices.length*2}],accessors:[{bufferView:0,componentType:5126,count:vertices.length/3,type:"VEC3"},{bufferView:1,componentType:5123,count:indices.length,type:"SCALAR"}]},bytes=new TextEncoder().encode(JSON.stringify(raw));
  const model={...f.model,slotId:"background" as const,model:{...f.model.model,entity:{...f.model.model.entity,kind:"background" as const},encodedBytes:bytes.length},dependencies:f.model.dependencies.map(d=>({...d,entity:{...d.entity,kind:"background" as const},encodedBytes:buffer.length})),bounds:{min:[-3,-3,-3],max:[3,3,3]}},pack={...f.pack,tiers:f.pack.tiers.map(t=>({...t,maxTriangles:12,models:[model]}))};
  return {bytes,buffer,model,pack};
 }
 it("admits an actual room surrounding the canonical globe without a one-sided AABB restriction",()=>{
  const f=environment(),pack=decodeCommon3dPackage(f.pack)!;expect(pack).not.toBeNull();
  const checked=decodeCommon3dModel(f.bytes,f.model,new Map([["vertices.bin",f.buffer]]),pack.tiers[1]);expect(checked.triangles).toBe(12);
  const model=importCommon3dModel(f.bytes,f.model,new Map([["vertices.bin",f.buffer]]),new Map(),pack.tiers[1]);expect(model.root.children).toHaveLength(1);model.dispose();
 });
 it("rejects a triangle whose far vertices hide a face passing through the globe",()=>{
  const f=environment(true);expect(decodeCommon3dPackage(f.pack)).not.toBeNull();expect(()=>decodeCommon3dModel(f.bytes,f.model,new Map([["vertices.bin",f.buffer]]),f.pack.tiers[1])).toThrow("triangle globe clearance");
 });
 it("rejects zero-area geometry instead of counting it as a rendered full-3D face",()=>{
  const f=common3dFixture();f.buffer.fill(0,0,36);expect(()=>decodeCommon3dModel(f.bytes,f.model,f.buffers,f.pack.tiers[1])).toThrow("nondegenerate");
 });
});
