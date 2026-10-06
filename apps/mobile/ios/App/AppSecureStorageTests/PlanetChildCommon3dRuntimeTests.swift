import Foundation
import XCTest
import UIKit
import WebKit
import Capacitor
@testable import App

/** AUTHORED_NOT_COMPILED_NOT_RUN. Project-owned indexed triangle exercises
 * actual native import/cache/wire code. It grants no review or ResourceClaim. */
final class PlanetChildCommon3dRuntimeTests: XCTestCase {
    private typealias Import=PlanetChildModelImport
    private func document() -> [String:Any] {
        ["asset":["version":"2.0","generator":"project-owned-synthetic"],"scene":0,"scenes":[["nodes":[0]]],"nodes":[["mesh":0]],"meshes":[["primitives":[["attributes":["POSITION":0],"indices":1]]]],"buffers":[["uri":"vertices.bin","byteLength":42]],"bufferViews":[["buffer":0,"byteOffset":0,"byteLength":36],["buffer":0,"byteOffset":36,"byteLength":6]],"accessors":[["bufferView":0,"componentType":5126,"count":3,"type":"VEC3"],["bufferView":1,"componentType":5123,"count":3,"type":"SCALAR"]]]
    }
    private func encoded(_ raw: [String:Any]) throws -> Data { try JSONSerialization.data(withJSONObject:raw,options:[.sortedKeys,.withoutEscapingSlashes]) }
    private func u32(_ v: UInt32) -> Data { Data((0..<4).map { UInt8(truncatingIfNeeded:v>>($0*8)) }) }
    private func buffer() -> Data { var data=Data();let values: [Float]=[-0.5,-1.5,0,0.5,-1.5,0,0,-1.2,0];for v in values { data.append(u32(v.bitPattern)) };data.append(contentsOf:[0,0,1,0,2,0]);return data }
    private func resource(_ bytes: Data,_ id: String,_ mime: String,_ alias: String,_ kind: String) -> Import.Resource {
        Import.Resource(id:id,entity:["kind":"stand","id":id,"contentChecksum":String(repeating:"a",count:64)],mime:mime,checksum:PlanetChildPassport.digest(bytes),bytes:bytes.count,alias:alias,kind:kind)
    }
    private func model(_ bytes: Data,_ data: Data,_ glb: Bool=false) -> Import.Model {
        Import.Model(slot:"stand",model:resource(bytes,"synthetic-model",glb ? "model/gltf-binary":"model/gltf+json",glb ? "fixture.glb":"fixture.gltf","model"),dependencies:glb ? []:[resource(data,"synthetic-buffer","application/octet-stream","vertices.bin","buffer")],min:[-1,-2,-1],max:[1,-1.1,1])
    }
    private func tier(_ model: Import.Model,_ bytes: Int=1024,_ triangles: Int=1) -> Import.Tier { Import.Tier(id:"balanced",decodedBytes:bytes,triangles:triangles,models:[model]) }
    private func topologyBuffer(_ vertices: [Float],_ indices: [UInt16]) -> Data {
        var bytes=Data();for v in vertices { bytes.append(u32(v.bitPattern)) };for i in indices { bytes.append(UInt8(truncatingIfNeeded:i));bytes.append(UInt8(truncatingIfNeeded:i>>8)) };return bytes
    }
    private func topologyDocument(_ vertices: Int,_ indices: Int,_ count: Int) throws -> Data {
        var raw=document();raw["buffers"]=[["uri":"vertices.bin","byteLength":count]];raw["bufferViews"]=[["buffer":0,"byteLength":vertices*12],["buffer":0,"byteOffset":vertices*12,"byteLength":indices*2]];raw["accessors"]=[["bufferView":0,"componentType":5126,"count":vertices,"type":"VEC3"],["bufferView":1,"componentType":5123,"count":indices,"type":"SCALAR"]];return try encoded(raw)
    }
    private func backgroundModel(_ bytes: Data,_ buffer: Data) -> Import.Model {
        Import.Model(slot:"background",model:resource(bytes,"synthetic-model","model/gltf+json","fixture.gltf","model"),dependencies:[resource(buffer,"synthetic-buffer","application/octet-stream","vertices.bin","buffer")],min:[-3,-3,-3],max:[3,3,3])
    }
    func testActualIndexedWorldClosureAllowsRoomAndRefusesClippingDegeneracyAndCancellation() throws {
        let vertices: [Float]=[-3,-3,-3,3,-3,-3,3,3,-3,-3,3,-3,-3,-3,3,3,-3,3,3,3,3,-3,3,3],indices: [UInt16]=[0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7,0,3,7,0,7,4,1,5,6,1,6,2],data=topologyBuffer(vertices,indices),bytes=try topologyDocument(8,36,data.count),m=backgroundModel(bytes,data),probe=try Import.model(bytes,m,tier(m,4096,12));var checks=0
        try probe.closure(bytes,["vertices.bin":data]) { checks+=1 };XCTAssertEqual(probe.triangles,12);XCTAssertGreaterThan(checks,0)
        let crossing=topologyBuffer([-3,-3,0,3,-3,0,0,3,0],[0,1,2]),face=try topologyDocument(3,3,crossing.count),cm=backgroundModel(face,crossing),cp=try Import.model(face,cm,tier(cm));XCTAssertThrowsError(try cp.closure(face,["vertices.bin":crossing],{}))
        let flat=topologyBuffer([2,0,0,2.5,0,0,3,0,0],[0,1,2]);XCTAssertThrowsError(try cp.closure(face,["vertices.bin":flat],{}))
        XCTAssertThrowsError(try probe.closure(bytes,["vertices.bin":data],{ throw Import.Failure.refused }));try probe.closure(bytes,["vertices.bin":data],{})
    }
    func testGLBProfileRefusesEvenSignedExternalBufferDependencies() throws {
        let raw=document();var json=try encoded(raw);while json.count%4 != 0 { json.append(32) };var data=buffer();while data.count%4 != 0 { data.append(0) };var bytes=Data();bytes.append(u32(0x46546c67));bytes.append(u32(2));bytes.append(u32(UInt32(28+json.count+data.count)));bytes.append(u32(UInt32(json.count)));bytes.append(u32(0x4e4f534a));bytes.append(json);bytes.append(u32(UInt32(data.count)));bytes.append(u32(0x004e4942));bytes.append(data)
        let m=Import.Model(slot:"stand",model:resource(bytes,"synthetic-model","model/gltf-binary","fixture.glb","model"),dependencies:[resource(buffer(),"synthetic-buffer","application/octet-stream","vertices.bin","buffer")],min:[-1,-2,-1],max:[1,-1.1,1]);XCTAssertThrowsError(try Import.model(bytes,m,tier(m)))
    }
    func testNativeTexturedPrimitiveRequiresUVAndCountsPerTextureIndexClones() throws {
        var raw=document();raw["images"]=[["uri":"paint.png"]];raw["textures"]=[["source":0],["source":0,"sampler":0]];raw["samplers"]=[["wrapS":33071]];raw["materials"]=[["pbrMetallicRoughness":["baseColorTexture":["index":0]]],["pbrMetallicRoughness":["baseColorTexture":["index":1]]]];raw["meshes"]=[["primitives":[["attributes":["POSITION":0],"indices":1,"material":0],["attributes":["POSITION":0],"indices":1,"material":1]]]]
        func textured(_ bytes: Data,_ data: Data) -> Import.Model { let m=model(bytes,data);return Import.Model(slot:m.slot,model:m.model,dependencies:m.dependencies+[resource(Data([1]),"synthetic-texture","image/png","paint.png","texture")],min:m.min,max:m.max) }
        let noUV=try encoded(raw),bad=textured(noUV,buffer());XCTAssertThrowsError(try Import.model(noUV,bad,tier(bad,4096,2)))
        raw["buffers"]=[["uri":"vertices.bin","byteLength":68]];raw["bufferViews"]=[["buffer":0,"byteLength":36],["buffer":0,"byteOffset":36,"byteLength":6],["buffer":0,"byteOffset":44,"byteLength":24]];raw["accessors"]=[["bufferView":0,"componentType":5126,"count":3,"type":"VEC3"],["bufferView":1,"componentType":5123,"count":3,"type":"SCALAR"],["bufferView":2,"componentType":5126,"count":3,"type":"VEC2"]];raw["meshes"]=[["primitives":[["attributes":["POSITION":0,"TEXCOORD_0":2],"indices":1,"material":0],["attributes":["POSITION":0,"TEXCOORD_0":2],"indices":1,"material":1]]]]
        var data=buffer();data.append(Data(repeating:0,count:26));let bytes=try encoded(raw),m=textured(bytes,data),probe=try Import.model(bytes,m,tier(m,4096,2));try probe.buffer("vertices.bin",data);XCTAssertEqual(probe.textureUses["paint.png"],2)
    }
    func testActualFiniteIndexedBufferDecodeAndGeneratedNormalBoundary() throws {
        let data=buffer(),bytes=try encoded(document()),m=model(bytes,data),probe=try Import.model(bytes,m,tier(m,84));try probe.buffer("vertices.bin",data)
        XCTAssertEqual(probe.decodedBytes,84);XCTAssertEqual(probe.triangles,1);XCTAssertThrowsError(try Import.model(bytes,m,tier(m,83)))
    }
    func testPackageVersionTierOrderAndExactDependencyIdentityStayClosed() throws {
        let data=buffer(),bytes=try encoded(document()),m=model(bytes,data)
        func dto(_ r: Import.Resource) -> [String:Any] { ["assetId":r.id,"entity":r.entity,"mime":r.mime,"checksum":r.checksum,"encodedBytes":r.bytes,"alias":r.alias,"kind":r.kind] }
        let descriptor: [String:Any]=["slotId":"stand","model":dto(m.model),"dependencies":m.dependencies.map(dto),"bounds":["min":m.min,"max":m.max]]
        let tiers: [[String:Any]]=["high","balanced","economy"].map { ["tier":$0,"maxDecodedBytes":1024,"maxTriangles":1,"models":[descriptor]] }
        let pack: [String:Any]=["schemaVersion":1,"packageId":"synthetic-package","packageVersion":1,"minAppVersion":1,"formatProfile":"gltf2-static-v1","tiers":tiers]
        XCTAssertEqual(try Import.package(pack).version,1)
        let patches: [[String:Any]]=[["packageVersion":0],["minAppVersion":2],["formatProfile":"ktx2-basis"],["tiers":Array(tiers.reversed())],["approved":true]];for patch in patches { XCTAssertThrowsError(try Import.package(pack.merging(patch){_,new in new})) }
        var duplicate=descriptor;duplicate["dependencies"]=[dto(m.dependencies[0]),dto(m.dependencies[0])];var changed=pack;changed["tiers"]=tiers.map { $0.merging(["models":[duplicate]]){_,new in new} };XCTAssertThrowsError(try Import.package(changed))
    }
    func testNonfiniteVertexAndOutOfRangeIndexAreRefusedByActualNativeProbe() throws {
        let data=buffer(),bytes=try encoded(document()),m=model(bytes,data),probe=try Import.model(bytes,m,tier(m));var nan=data;nan.replaceSubrange(0..<4,with:u32(Float.nan.bitPattern));XCTAssertThrowsError(try probe.buffer("vertices.bin",nan))
        var bad=data;bad[40]=7;XCTAssertThrowsError(try probe.buffer("vertices.bin",bad));XCTAssertThrowsError(try probe.buffer("external.bin",data));XCTAssertThrowsError(try probe.buffer("vertices.bin",Data(data.dropLast())))
        var extra=data;extra.append(0);XCTAssertThrowsError(try probe.buffer("vertices.bin",extra))
    }
    func testClosedDependencyProfileRejectsRemoteAliasesExtensionsCyclesAndStrides() throws {
        let data=buffer(),patches: [[String:Any]]=[["extensionsUsed":["KHR_draco_mesh_compression"]],["extensionsUsed":["EXT_meshopt_compression"]],["cameras":[]],["nodes":[["mesh":0,"children":[0]]]],["buffers":[["uri":"https://example.test/x.bin","byteLength":42]]],["bufferViews":[["buffer":0,"byteLength":36,"byteStride":252],["buffer":0,"byteOffset":36,"byteLength":6]]]];for patch in patches {
            let bytes=try encoded(document().merging(patch){_,new in new}),m=model(bytes,data);XCTAssertThrowsError(try Import.model(bytes,m,tier(m)))
        }
        XCTAssertThrowsError(try Import.json(Data("{\"asset\":{},\"\\u0061sset\":{}}".utf8)))
    }
    func testEveryMeshInstanceCountsAgainstTierDrawBudget() throws {
        var raw=document();raw["nodes"]=[["mesh":0],["mesh":0]];raw["scenes"]=[["nodes":[0,1]]];let data=buffer(),bytes=try encoded(raw),m=model(bytes,data)
        XCTAssertThrowsError(try Import.model(bytes,m,tier(m)));let probe=try Import.model(bytes,m,tier(m,1024,2));try probe.buffer("vertices.bin",data);XCTAssertEqual(probe.triangles,2)
    }
    func testRealGLB2ContainerAndEmbeddedBinaryAreDecodedWithoutExtensionLoaders() throws {
        var raw=document();raw["buffers"]=[["byteLength":42]];var json=try encoded(raw);while json.count%4 != 0 { json.append(32) };var data=buffer();while data.count%4 != 0 { data.append(0) }
        var bytes=Data();bytes.append(u32(0x46546c67));bytes.append(u32(2));bytes.append(u32(UInt32(28+json.count+data.count)));bytes.append(u32(UInt32(json.count)));bytes.append(u32(0x4e4f534a));bytes.append(json);bytes.append(u32(UInt32(data.count)));bytes.append(u32(0x004e4942));bytes.append(data)
        let m=model(bytes,data,true);XCTAssertEqual(try Import.model(bytes,m,tier(m)).triangles,1);try Import.cached(bytes,"model/gltf-binary")
        var wrong=bytes;wrong.replaceSubrange(4..<8,with:u32(3));XCTAssertThrowsError(try Import.model(wrong,model(wrong,data,true),tier(m)))
    }
    func testTypedWireRequiresExactResourceAndMeasuredTierWithoutCallerURI() throws {
        var wire: [String:Any]=["version":2,"requestId":String(repeating:"1",count:32),"contextToken":String(repeating:"2",count:32),"sceneToken":String(repeating:"3",count:32),"slotId":"model","assetId":"synthetic-model","tier":"economy"]
        XCTAssertEqual(try PlanetChildLocalV2Wire.decode("acquireWebResource",wire).tier,"economy")
        for field in ["uri","approval","profileId","mime","checksum"] { var invalid=wire;invalid[field]=true;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("acquireWebResource",invalid)) }
        wire["tier"]="ktx2-unmeasured";XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("acquireWebResource",wire));wire.removeValue(forKey:"tier");XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("acquireWebResource",wire))
    }
    func testTypedEncryptedObjectColdReopenCancellationAndPriorValidRollback() throws {
        guard let run=ProcessInfo.processInfo.environment["LITERARY_PLANET_SECURE_TEST_RUN_ID"] else { throw XCTSkip("NOT_RUN: explicit isolated native AES/key namespace required") }
        let bytes=try encoded(document());for scenario in ["restart","cancel","rollback","delete"] { XCTAssertTrue(try PlanetChildDataStore.fixtureTypedObjectPersistence(runId:run,bytes:bytes,mime:"model/gltf+json",scenario:scenario)) }
    }
    func testChunkWireRequiresClosedTokensExactBoundedIntegersAndNoURIOrCallerBytes() throws {
        let wire: [String:Any]=["version":2,"requestId":String(repeating:"1",count:32),"contextToken":String(repeating:"2",count:32),"sceneToken":String(repeating:"3",count:32),"resourceToken":String(repeating:"4",count:32),"offset":0,"byteLength":65536]
        let request=try PlanetChildLocalV2Wire.decode("readWebResourceChunk",wire);XCTAssertEqual(request.offset,0);XCTAssertEqual(request.byteLength,65536)
        for patch: [String:Any] in [["offset":-1],["offset":33554432],["offset":0.5],["offset":true],["byteLength":0],["byteLength":65537],["resourceToken":"../../file"],["uri":"file:///private"],["encodedBase64":"AAAA"],["tier":"high"]] { XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("readWebResourceChunk",wire.merging(patch){_,new in new})) }
    }
    @MainActor private func actual(_ web: WKWebView,_ method: String,_ request: [String:Any]) async throws -> [String:Any] {
        let json=String(decoding:try JSONSerialization.data(withJSONObject:request,options:[.sortedKeys,.withoutEscapingSlashes]),as:UTF8.self)
        _=try await web.evaluateJavaScript("window.__lpCommon3dReply=null;window.Capacitor.nativePromise('PlanetChild','\(method)',\(json)).then(value=>window.__lpCommon3dReply=JSON.stringify(value)).catch(()=>window.__lpCommon3dReply='{}');'scheduled'")
        let began=Date();while Date().timeIntervalSince(began)<10 { if let text=try await web.evaluateJavaScript("window.__lpCommon3dReply") as? String { _=try await web.evaluateJavaScript("delete window.__lpCommon3dReply");let reply=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(text.utf8)) as? [String:Any]);XCTAssertEqual(reply["status"] as? String,"ok");return reply };try await Task.sleep(nanoseconds:20_000_000) };throw PlanetChildAppearance.Failure.unavailable
    }
    /** NOT_RUN: this separate fixture uses genuine existing native artifacts and
     * a protected local record. No synthetic bytes can construct its permits. */
    @MainActor func testGenuineTypedOutputImportAndStagedRestoreRollbackRetainCurrentScene() async throws {
        guard ProcessInfo.processInfo.environment["LITERARY_PLANET_COMMON3D_FIXTURE_AVAILABLE"]=="true" else { throw XCTSkip("NOT_RUN: genuine signed v3 native scene/package/media, original bridge and owned protected child fixture required; skip is not acceptance") }
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"child-common3d-runtime-fixture-v1",withExtension:"json")),size=try url.resourceValues(forKeys:[.fileSizeKey]).fileSize;guard let size,size>0,size<=65536 else { throw PlanetChildAppearance.Failure.unavailable }
        var coordinates=try Data(contentsOf:url);defer { coordinates.resetBytes(in:0..<coordinates.count) };let fixture=try XCTUnwrap(JSONSerialization.jsonObject(with:coordinates) as? [String:Any]);XCTAssertEqual(Set(fixture.keys),Set(["owner","sceneId","profileId"]));let owner=try PlanetChildLocalV2Wire.ref(fixture["owner"]),sceneId=try XCTUnwrap(fixture["sceneId"] as? String)
        let ui=try XCTUnwrap(UIApplication.shared.connectedScenes.first(where:{ $0.activationState == .foregroundActive }) as? UIWindowScene),host=try XCTUnwrap(ui.windows.first(where:{ $0.isKeyWindow })?.rootViewController as? PlanetBridgeViewController),web=try XCTUnwrap(host.bridge?.webView),plugin=try XCTUnwrap(host.bridge?.plugin(withName:"PlanetChild") as? PlanetChildPlugin),context=try XCTUnwrap(plugin.runtimeOriginalContextToken())
        func base() -> [String:Any] { ["version":2,"requestId":UUID().uuidString.replacingOccurrences(of:"-",with:"").lowercased(),"contextToken":context] }
        func value(_ response: [String:Any]) throws -> [String:Any] { try XCTUnwrap(response["value"] as? [String:Any]) }
        let prior=try value(await actual(web,"readSceneSelection",base())),revision=try XCTUnwrap(prior["revision"] as? NSNumber).uint64Value;XCTAssertEqual(prior["profileId"] as? String,fixture["profileId"] as? String)
        var open=base();open["owner"]=owner;open["sceneId"]=sceneId;let scene=try value(await actual(web,"openScene",open)),token=try XCTUnwrap(scene["sceneToken"] as? String),pack=try Import.package(try XCTUnwrap(scene["modelPackage"] as? [String:Any])),tier=try XCTUnwrap(pack.tiers.first(where:{ $0.id=="balanced" }))
        for slot in ["skin","stand","background"] { var request=base();request["sceneToken"]=token;request["slotId"]=slot;let output=try value(await actual(web,"acquireWebResource",request));XCTAssertEqual(output["status"] as? String,"available") }
        for m in tier.models {
            var raw=[String:Data]();defer { for alias in Array(raw.keys) { if var bytes=raw.removeValue(forKey:alias) { bytes.resetBytes(in:0..<bytes.count) } } }
            for resource in [m.model]+m.dependencies {
                var acquire=base();acquire["sceneToken"]=token;acquire["slotId"]=resource.kind;acquire["assetId"]=resource.id;acquire["tier"]=tier.id;let output=try value(await actual(web,"acquireWebResource",acquire));XCTAssertEqual(output["status"] as? String,"available");if resource.kind=="texture" { continue }
                let outputToken=try XCTUnwrap(output["resourceToken"] as? String);var bytes=Data();while bytes.count<resource.bytes {
                    var request=base();request["sceneToken"]=token;request["resourceToken"]=outputToken;request["offset"]=bytes.count;let count=min(65536,resource.bytes-bytes.count);request["byteLength"]=count
                    let chunk=try value(await actual(web,"readWebResourceChunk",request));XCTAssertEqual(chunk["sceneToken"] as? String,token);XCTAssertEqual(chunk["resourceToken"] as? String,outputToken);XCTAssertEqual((chunk["offset"] as? NSNumber)?.intValue,bytes.count);XCTAssertEqual((chunk["totalBytes"] as? NSNumber)?.intValue,resource.bytes);XCTAssertEqual(chunk["mime"] as? String,resource.mime)
                    let encoded=try XCTUnwrap(chunk["encodedBase64"] as? String);var part=try XCTUnwrap(Data(base64Encoded:encoded));XCTAssertEqual(part.count,count);XCTAssertEqual(part.base64EncodedString(),encoded);bytes.append(part);part.resetBytes(in:0..<part.count)
                };XCTAssertEqual(PlanetChildPassport.digest(bytes),resource.checksum);raw[resource.alias]=bytes
            }
            let probe=try Import.model(try XCTUnwrap(raw[m.model.alias]),m,tier);for dependency in m.dependencies where dependency.kind=="buffer" { try probe.buffer(dependency.alias,try XCTUnwrap(raw[dependency.alias])) }
        }
        var remember=base();remember["sceneToken"]=token;remember["expectedRevision"]=revision;let saved=try value(await actual(web,"rememberSceneSelection",remember));XCTAssertEqual((saved["revision"] as? NSNumber)?.uint64Value,revision+1);XCTAssertTrue(plugin.runtimeAppearanceSceneAdmits(token))
        var restore=base();restore["expectedRevision"]=revision+1;let restored=try value(await actual(web,"restoreSceneSelection",restore)),staged=try XCTUnwrap((restored["scene"] as? [String:Any])?["sceneToken"] as? String);XCTAssertNotEqual(staged,token);XCTAssertTrue(plugin.runtimeAppearanceSceneAdmits(token))
        var release=base();release["sceneToken"]=staged;_=try await actual(web,"releaseScene",release);XCTAssertFalse(plugin.runtimeAppearanceSceneAdmits(staged));XCTAssertTrue(plugin.runtimeAppearanceSceneAdmits(token));XCTAssertEqual(plugin.runtimeOriginalContextToken(),context)
        let read=try value(await actual(web,"readSceneSelection",base()));XCTAssertEqual((read["revision"] as? NSNumber)?.uint64Value,revision+1);XCTAssertEqual(try PlanetChildAppearance.Selection.decodeDTO(try XCTUnwrap(read["selection"])),try PlanetChildAppearance.Selection.decodeDTO(try XCTUnwrap(saved["selection"])))
        // A fresh complete original stage captures prior choice under native
        // CAS. Rollback derives that choice without any JS selection input.
        var replacementOpen=base();replacementOpen["owner"]=owner;replacementOpen["sceneId"]=sceneId;let replacement=try value(await actual(web,"openScene",replacementOpen)),replacementToken=try XCTUnwrap(replacement["sceneToken"] as? String)
        for slot in ["skin","stand","background"] { var request=base();request["sceneToken"]=replacementToken;request["slotId"]=slot;let output=try value(await actual(web,"acquireWebResource",request));XCTAssertEqual(output["status"] as? String,"available") }
        var acquired=Set<String>();for kind in ["model","buffer","texture"] { for resource in tier.models.flatMap({ [$0.model]+$0.dependencies }) where resource.kind==kind && acquired.insert(resource.id).inserted { var request=base();request["sceneToken"]=replacementToken;request["slotId"]=resource.kind;request["assetId"]=resource.id;request["tier"]=tier.id;let output=try value(await actual(web,"acquireWebResource",request));XCTAssertEqual(output["status"] as? String,"available") } }
        remember=base();remember["sceneToken"]=replacementToken;remember["expectedRevision"]=revision+1;let replacementSaved=try value(await actual(web,"rememberSceneSelection",remember));XCTAssertEqual((replacementSaved["revision"] as? NSNumber)?.uint64Value,revision+2)
        var rollback=base();rollback["sceneToken"]=replacementToken;rollback["expectedRevision"]=revision+2;let rolledBack=try value(await actual(web,"rollbackSceneSelection",rollback));XCTAssertEqual((rolledBack["revision"] as? NSNumber)?.uint64Value,revision+3);XCTAssertEqual(try PlanetChildAppearance.Selection.decodeDTO(try XCTUnwrap(rolledBack["selection"])),try PlanetChildAppearance.Selection.decodeDTO(try XCTUnwrap(saved["selection"])))
        release=base();release["sceneToken"]=replacementToken;_=try await actual(web,"releaseScene",release);XCTAssertTrue(plugin.runtimeAppearanceSceneAdmits(token));XCTAssertFalse(plugin.runtimeAppearanceSceneAdmits(replacementToken))
    }
    func testActualWorldPositionFitsSignedBoundsIncludingNestedTransformsAndCacheGLB() throws {
        let data=buffer()
        var raw=document();raw["nodes"]=[["children":[1],"translation":[0,1,0]],["mesh":0]]
        var bytes=try encoded(raw);var m=model(bytes,data);let translated=try Import.model(bytes,m,tier(m));XCTAssertThrowsError(try translated.buffer("vertices.bin",data))
        raw["nodes"]=[["children":[1],"translation":[0,12,0]],["mesh":0,"translation":[0,12,0]]]
        bytes=try encoded(raw);m=Import.Model(slot:"stand",model:resource(bytes,"synthetic-model","model/gltf+json","fixture.gltf","model"),dependencies:[resource(data,"synthetic-buffer","application/octet-stream","vertices.bin","buffer")],min:[-12,-12,-12],max:[12,12,12])
        let overflow=try Import.model(bytes,m,tier(m));XCTAssertThrowsError(try overflow.buffer("vertices.bin",data))
        raw=document();raw["nodes"]=[["mesh":0,"scale":[2,1,1]]];bytes=try encoded(raw);m=model(bytes,data);try Import.model(bytes,m,tier(m)).buffer("vertices.bin",data)
        raw["nodes"]=[["mesh":0,"rotation":[0,0,0.7071067811865476,0.7071067811865476]]];bytes=try encoded(raw);m=model(bytes,data);let rotated=try Import.model(bytes,m,tier(m));XCTAssertThrowsError(try rotated.buffer("vertices.bin",data))
        raw=document();raw["buffers"]=[["byteLength":42]];raw["nodes"]=[["mesh":0,"translation":[0,12,0],"children":[1]],["translation":[0,12,0]]]
        // Use a parent translation with the mesh on the child to exercise the
        // generic cache framing bounds independently of signed stand clearance.
        raw["nodes"]=[["children":[1],"translation":[0,12,0]],["mesh":0,"translation":[0,12,0]]]
        var json=try encoded(raw);while json.count%4 != 0 { json.append(32) };var bin=data;while bin.count%4 != 0 { bin.append(0) };var glb=Data();glb.append(u32(0x46546c67));glb.append(u32(2));glb.append(u32(UInt32(28+json.count+bin.count)));glb.append(u32(UInt32(json.count)));glb.append(u32(0x4e4f534a));glb.append(json);glb.append(u32(UInt32(bin.count)));glb.append(u32(0x004e4942));glb.append(bin)
        XCTAssertThrowsError(try Import.cached(glb,"model/gltf-binary"))
    }
    func testSharedIndexAccessorChecksEveryPrimitiveVertexCount() throws {
        var raw=document(),data=buffer();var positions=Data(data.prefix(36));positions.append(u32(Float(0).bitPattern));positions.append(u32(Float(-1.5).bitPattern));positions.append(u32(Float(0).bitPattern));data=positions;data.append(contentsOf:[0,0,1,0,3,0])
        raw["buffers"]=[["uri":"vertices.bin","byteLength":54]];raw["bufferViews"]=[["buffer":0,"byteOffset":0,"byteLength":48],["buffer":0,"byteOffset":48,"byteLength":6]]
        raw["accessors"]=[["bufferView":0,"componentType":5126,"count":3,"type":"VEC3"],["bufferView":1,"componentType":5123,"count":3,"type":"SCALAR"],["bufferView":0,"componentType":5126,"count":4,"type":"VEC3"]]
        raw["meshes"]=[["primitives":[["attributes":["POSITION":0],"indices":1],["attributes":["POSITION":2],"indices":1]]]]
        let bytes=try encoded(raw),m=model(bytes,data),probe=try Import.model(bytes,m,tier(m,4096,2));XCTAssertThrowsError(try probe.buffer("vertices.bin",data))
    }
    func testRollbackWireCannotSupplyPreviousChoiceOrUnboundedRevision() throws {
        let wire: [String:Any]=["version":2,"requestId":String(repeating:"1",count:32),"contextToken":String(repeating:"2",count:32),"sceneToken":String(repeating:"3",count:32),"expectedRevision":1]
        let request=try PlanetChildLocalV2Wire.decode("rollbackSceneSelection",wire);XCTAssertEqual(request.expectedRevision,1);XCTAssertEqual(request.sceneToken,String(repeating:"3",count:32))
        for patch: [String:Any] in [["selection":NSNull()],["previousSelection":NSNull()],["priorRevision":0],["profileId":"caller"],["resourceToken":String(repeating:"4",count:32)],["expectedRevision":-1],["expectedRevision":9007199254740990],["expectedRevision":true],["expectedRevision":0.5]] { XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("rollbackSceneSelection",wire.merging(patch){_,new in new})) }
    }
}
