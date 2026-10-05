import Foundation
import XCTest
import UIKit
import WebKit
import Capacitor
@testable import App

/** AUTHORED_NOT_COMPILED_NOT_RUN. Positive execution requires separately
 * staged independently signed native content and the actual protected child
 * record on an explicitly owned local target. A skipped prerequisite is never
 * native output/runtime acceptance. No synthetic record or authority is minted. */
final class PlanetChildCanonicalResourceRuntimeTests: XCTestCase {
    override func setUpWithError() throws {
        let environment=ProcessInfo.processInfo.environment
        XCTAssertEqual(environment["LITERARY_PLANET_CANONICAL_RESOURCE_TEST_PHASE"],"local-v2-canonical-resource")
        let runId=try XCTUnwrap(environment["LITERARY_PLANET_SECURE_TEST_RUN_ID"])
        XCTAssertNotNil(runId.range(of:"^[a-f0-9]{32}$",options:.regularExpression))
    }
    private func id() -> String { UUID().uuidString.replacingOccurrences(of:"-",with:"").lowercased() }
    private func base(_ token: String=String(repeating:"2",count:32)) -> [String:Any] { ["version":2,"requestId":id(),"contextToken":token] }
    private func owner() -> [String:Any] { ["kind":"writer","id":"fixture-writer","contentChecksum":String(repeating:"a",count:64)] }
    func testClosedWireRejectsCallerURLProofAndCleanupAcknowledgement() throws {
        var open=base();open["owner"]=owner();open["sceneId"]="fixture-scene"
        XCTAssertEqual(try PlanetChildLocalV2Wire.decode("openScene",open).sceneId,"fixture-scene")
        for field in ["uri","proof","gpuAck","clearReceipt","nativeAuthority","url"] { var invalid=open;invalid[field]=true;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("openScene",invalid)) }
        var acquire=base();acquire["sceneToken"]=String(repeating:"3",count:32);acquire["slotId"]="skin"
        XCTAssertEqual(try PlanetChildLocalV2Wire.decode("acquireWebResource",acquire).slotId,"skin")
        for slot in ["image","accessory","../skin","skin?x"] { acquire["slotId"]=slot;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("acquireWebResource",acquire)) }
        var release=base();release["sceneToken"]=NSNull();XCTAssertNil(try PlanetChildLocalV2Wire.decode("releaseScene",release).sceneToken)
        release=base();release["resourceToken"]=NSNull();XCTAssertNil(try PlanetChildLocalV2Wire.decode("releaseWebResource",release).resourceToken)
    }
    func testOpaqueURIsAndSceneNumbersRemainClosed() throws {
        let token=String(repeating:"1",count:32),uri="planet-child-resource://local/"+token
        XCTAssertEqual(try PlanetChildWebResources.token(uri),token)
        for invalid in [uri+"?q=1",uri+"#a",uri+"/x","planet-child-resource://other/"+token,"https://localhost/"+token,uri+"\n"] { XCTAssertThrowsError(try PlanetChildWebResources.token(invalid)) }
        let valid=#"{"position":[2,0.25,-1],"radius":0.05}"#
        XCTAssertFalse(try PlanetChildCanonicalResourceRuntimeFixture.sceneNumberSource(valid).isEmpty)
        XCTAssertThrowsError(try PlanetChildCanonicalResourceRuntimeFixture.originalNumberSource(valid))
        for invalid in [#"{"x":0,"x":1}"#,"[NaN]","[1e999]","[-0.0]","[1.]"] { XCTAssertThrowsError(try PlanetChildCanonicalResourceRuntimeFixture.sceneNumberSource(invalid)) }
        let plugin=PlanetChildPlugin();for method in ["listScenes","openScene","releaseScene","acquireWebResource","releaseWebResource"] { XCTAssertTrue(plugin.pluginMethods.contains(where:{ $0.name==method })) }
    }
    func testIndependentReviewAndExactOriginalSourceGraphRefuseSubstitution() throws {
        XCTAssertTrue(try PlanetChildCanonicalResourceRuntimeFixture.graphScenario("exact"))
        for scenario in ["changed-graph","changed-size","unknown-graph-field","missing-source","wrong-order","orphan-output"] { XCTAssertThrowsError(try PlanetChildCanonicalResourceRuntimeFixture.graphScenario(scenario),scenario) }
        XCTAssertTrue(try PlanetChildCanonicalResourceRuntimeFixture.independentReview(false,false))
        XCTAssertThrowsError(try PlanetChildCanonicalResourceRuntimeFixture.independentReview(true,false))
        XCTAssertThrowsError(try PlanetChildCanonicalResourceRuntimeFixture.independentReview(false,true))
    }
    @MainActor private func host() throws -> (PlanetBridgeViewController,WKWebView) {
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.first(where:{ $0.activationState == .foregroundActive }) as? UIWindowScene)
        let controller=try XCTUnwrap(scene.windows.first(where:{ $0.isKeyWindow })?.rootViewController as? PlanetBridgeViewController)
        let web=try XCTUnwrap(controller.bridge?.webView);XCTAssertTrue(web.configuration.urlSchemeHandler(forURLScheme:PlanetChildWebResources.scheme) === controller.childResources);return (controller,web)
    }
    /** Negative task facade supplies no output or authority. Positive decode
     * below is driven by WebKit's own actual task and original registered SDK. */
    private final class DeniedTask: NSObject,WKURLSchemeTask {
        let request: URLRequest;var failed=false,bytes=0,finished=false
        init(_ uri: String,_ document: URL) { var r=URLRequest(url:URL(string:uri)!);r.httpMethod="GET";r.mainDocumentURL=document;r.setValue(PlanetChildWebResources.origin,forHTTPHeaderField:"Origin");request=r;super.init() }
        func didReceive(_ response: URLResponse) { XCTFail("Unknown task received a response") }
        func didReceive(_ data: Data) { bytes+=data.count;XCTFail("Unknown task received bytes") }
        func didFinish() { finished=true;XCTFail("Unknown task finished") }
        func didFailWithError(_ error: Error) { failed=true }
    }
    @MainActor private func imageState(_ web: WKWebView,_ uri: String,_ upload: Bool) async throws -> String {
        let literal=String(decoding:try JSONSerialization.data(withJSONObject:uri,options:[.fragmentsAllowed,.withoutEscapingSlashes]),as:UTF8.self)
        let script="""
        (()=>{const image=new Image();window.__lpCanonicalImage={state:'pending'};image.crossOrigin='anonymous';image.onerror=()=>{image.onload=null;image.onerror=null;image.src='';window.__lpCanonicalImage={state:'denied'};};image.onload=()=>{let gl,texture;try{if(\(upload ? "true":"false")){if(image.naturalWidth!==2*image.naturalHeight)throw Error('ratio');const canvas=document.createElement('canvas');gl=canvas.getContext('webgl');if(!gl)throw Error('webgl');texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);if(gl.getError()!==gl.NO_ERROR)throw Error('upload');}window.__lpCanonicalImage={state:'uploaded'};}catch(e){window.__lpCanonicalImage={state:'denied'};}finally{image.onload=null;image.onerror=null;image.src='';if(gl&&texture)gl.deleteTexture(texture);if(gl){const loss=gl.getExtension('WEBGL_lose_context');if(loss)loss.loseContext();}}};image.src=\(literal);return 'scheduled';})()
        """
        _=try await web.evaluateJavaScript(script);let began=Date()
        while Date().timeIntervalSince(began)<5 { if let result=try await web.evaluateJavaScript("window.__lpCanonicalImage?.state") as? String,result != "pending" { _=try await web.evaluateJavaScript("delete window.__lpCanonicalImage");return result };try await Task.sleep(nanoseconds:20_000_000) };XCTFail("Actual WKWebView image did not settle");throw PlanetChildLocalV2ResourceError.cleanupUnknown
    }
    @MainActor func testRealBoundWKWebViewDeniesUnknownWrongViewAndMainFrame() async throws {
        let (controller,web)=try host(),uri="planet-child-resource://local/"+String(repeating:"1",count:32),document=try XCTUnwrap(web.url)
        let unknown=DeniedTask(uri,document);controller.childResources.webView(web,start:unknown);XCTAssertTrue(unknown.failed);XCTAssertEqual(unknown.bytes,0)
        let configuration=WKWebViewConfiguration();configuration.setURLSchemeHandler(controller.childResources,forURLScheme:PlanetChildWebResources.scheme);let wrong=WKWebView(frame:.zero,configuration:configuration)
        let wrongTask=DeniedTask(uri,document);controller.childResources.webView(wrong,start:wrongTask);XCTAssertTrue(wrongTask.failed)
        let main=DeniedTask(uri,URL(string:uri)!);controller.childResources.webView(web,start:main);XCTAssertTrue(main.failed)
        let denied=try await imageState(web,uri,false);XCTAssertEqual(denied,"denied")
    }
    @MainActor private func native(_ web: WKWebView,_ method: String,_ request: [String:Any]) async throws -> [String:Any] {
        let json=String(decoding:try JSONSerialization.data(withJSONObject:request,options:[.sortedKeys,.withoutEscapingSlashes]),as:UTF8.self)
        _=try await web.evaluateJavaScript("window.__lpCanonicalReply=null;window.Capacitor.nativePromise('PlanetChild','\(method)',\(json)).then(value=>window.__lpCanonicalReply=JSON.stringify(value)).catch(()=>window.__lpCanonicalReply='{}');'scheduled'")
        let began=Date();while Date().timeIntervalSince(began)<10 { if let text=try await web.evaluateJavaScript("window.__lpCanonicalReply") as? String { _=try await web.evaluateJavaScript("delete window.__lpCanonicalReply");return try XCTUnwrap(JSONSerialization.jsonObject(with:Data(text.utf8)) as? [String:Any]) };try await Task.sleep(nanoseconds:20_000_000) };XCTFail("Actual original SDK callback did not return");throw PlanetChildLocalV2ResourceError.cleanupUnknown
    }
    @MainActor func testGenuineOriginalOutputDecodesUploadsAndRetiresAfterAcquisitionCommandReturned() async throws {
        guard ProcessInfo.processInfo.environment["LITERARY_PLANET_CANONICAL_FIXTURE_AVAILABLE"]=="true" else { throw XCTSkip("NOT_RUN: separately staged signed native artifacts and actual protected child record required; skip is not acceptance") }
        let fixtureURL=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"child-canonical-resource-runtime-fixture-v2",withExtension:"json")),size=try fixtureURL.resourceValues(forKeys:[.fileSizeKey]).fileSize
        guard let size,size>0,size<=65536 else { XCTFail("Unbounded canonical native fixture coordinates");return };var bytes=try Data(contentsOf:fixtureURL);defer { bytes.resetBytes(in:0..<bytes.count) }
        let fixture=try XCTUnwrap(JSONSerialization.jsonObject(with:bytes) as? [String:Any]);XCTAssertEqual(Set(fixture.keys),Set(["owner","sceneId"]));let owner=try PlanetChildLocalV2Wire.ref(fixture["owner"]),sceneId=try XCTUnwrap(fixture["sceneId"] as? String)
        let (controller,web)=try host(),plugin=try XCTUnwrap(controller.bridge?.plugin(withName:"PlanetChild") as? PlanetChildPlugin)
        let context: String
        if let actual=plugin.runtimeOriginalContextToken() { context=actual;let current=try await native(web,"readContext",base(actual));XCTAssertEqual(current["status"] as? String,"child") }
        else { let boot=try await native(web,"bootstrap",["version":2,"requestId":id()]);XCTAssertEqual(boot["status"] as? String,"child");context=try XCTUnwrap((boot["context"] as? [String:Any])?["token"] as? String) }
        var open=base(context);open["owner"]=owner;open["sceneId"]=sceneId;let sceneReply=try await native(web,"openScene",open),scene=try XCTUnwrap(sceneReply["value"] as? [String:Any]);XCTAssertEqual(scene["status"] as? String,"opened");let sceneToken=try XCTUnwrap(scene["sceneToken"] as? String)
        var acquire=base(context);acquire["sceneToken"]=sceneToken;acquire["slotId"]="skin";let acquired=try await native(web,"acquireWebResource",acquire),resource=try XCTUnwrap(acquired["value"] as? [String:Any]);XCTAssertEqual(resource["status"] as? String,"available");let uri=try XCTUnwrap(resource["uri"] as? String),resourceToken=try XCTUnwrap(resource["resourceToken"] as? String)
        XCTAssertEqual(try PlanetChildWebResources.token(uri),resourceToken);let owned=try controller.childResources.runtimeObservation();XCTAssertEqual(owned["outputs"],1);XCTAssertGreaterThan(owned["encodedBytes"] ?? 0,0)
        let uploaded=try await imageState(web,uri,true);XCTAssertEqual(uploaded,"uploaded")
        var release=base(context);release["resourceToken"]=resourceToken;let retired=try await native(web,"releaseWebResource",release);XCTAssertEqual((retired["value"] as? [String:Any])?["status"] as? String,"retired")
        let joined=try controller.childResources.runtimeObservation();XCTAssertEqual(joined["outputs"],0);XCTAssertEqual(joined["tasks"],0);XCTAssertEqual(joined["encodedBytes"],0);let denied=try await imageState(web,uri,false);XCTAssertEqual(denied,"denied")
        release=base(context);release["sceneToken"]=sceneToken;let closed=try await native(web,"releaseScene",release);XCTAssertEqual((closed["value"] as? [String:Any])?["status"] as? String,"retired")
    }
}
