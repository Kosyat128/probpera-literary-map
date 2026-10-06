import { createHash } from "node:crypto";
import type { Common3dModel, Common3dPackage, Common3dTierId } from "./childCommon3d";
/** Test-only project-owned triangle. Never imported by app entrypoints and
 * never a release review, native capability, rights grant or authored content. */
export function common3dFixture() {
  const hash=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex"),buffer=new Uint8Array(42),v=new DataView(buffer.buffer);
  [-.5,-1.5,0,.5,-1.5,0,0,-1.2,0].forEach((n,i)=>v.setFloat32(i*4,n,true));[0,1,2].forEach((n,i)=>v.setUint16(36+i*2,n,true));
  const raw={asset:{version:"2.0",generator:"project-owned-synthetic"},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],buffers:[{uri:"vertices.bin",byteLength:42}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:6}],accessors:[{bufferView:0,componentType:5126,count:3,type:"VEC3"},{bufferView:1,componentType:5123,count:3,type:"SCALAR"}]};
  const bytes=new TextEncoder().encode(JSON.stringify(raw)),entity={kind:"stand" as const,id:"synthetic-model",contentChecksum:"a".repeat(64)};
  const model:Common3dModel={slotId:"stand",model:{assetId:"synthetic-model",entity,mime:"model/gltf+json",checksum:hash(bytes),encodedBytes:bytes.length,alias:"fixture.gltf",kind:"model"},dependencies:[{assetId:"synthetic-buffer",entity:{...entity,id:"synthetic-buffer"},mime:"application/octet-stream",checksum:hash(buffer),encodedBytes:buffer.length,alias:"vertices.bin",kind:"buffer"}],bounds:{min:[-1,-2,-1],max:[1,-1.1,1]}};
  const pack:Common3dPackage={schemaVersion:1,packageId:"synthetic-package",packageVersion:1,minAppVersion:1,formatProfile:"gltf2-static-v1",tiers:(["high","balanced","economy"] as Common3dTierId[]).map(tier=>({tier,maxDecodedBytes:1024,maxTriangles:1,models:[model]}))};
  return {buffer,bytes,raw,model,pack,buffers:new Map([["vertices.bin",buffer]])};
}
