import Foundation
import XCTest
import UIKit
import WebKit
import Capacitor
@testable import App

/** AUTHORED_NOT_COMPILED_NOT_RUN. Pure codec/snapshot and isolated AES cases
 * prove mechanics only. Genuine save/restore additionally requires separately
 * prepared signed native artifacts and the actual protected local child record.
 * Missing prerequisites/SKIP are not native authority or runtime acceptance. */
final class PlanetChildAppearanceRuntimeTests: XCTestCase {
    override func setUpWithError() throws {
        XCTAssertEqual(ProcessInfo.processInfo.environment["LITERARY_PLANET_APPEARANCE_TEST_PHASE"],"local-v2-profile-appearance")
        let run=try XCTUnwrap(ProcessInfo.processInfo.environment["LITERARY_PLANET_SECURE_TEST_RUN_ID"])
        XCTAssertNotNil(run.range(of:"^[a-f0-9]{32}$",options:.regularExpression))
    }
    private func selection() throws -> PlanetChildAppearance.Selection {
        try PlanetChildAppearance.Selection(sceneId:"fixture-scene",owner:PlanetChildAppearance.Owner(kind:"writer",id:"fixture-writer"),skin:PlanetChildAppearance.Slot(assetId:"fixture-skin",entityId:"fixture-skin-entity"),stand:PlanetChildAppearance.Geometry(geometryId:"stand.base.child-book-cloud",assetId:"fixture-stand",entityId:"fixture-stand-entity"),background:PlanetChildAppearance.Geometry(geometryId:"background.base.library",assetId:"fixture-background",entityId:"fixture-background-entity"))
    }
    func testStableReferenceCodecRejectsCapabilityFieldsAndAmbiguousNumbers() throws {
        let value=try selection();var bytes=try value.encoded();defer { bytes.resetBytes(in:0..<bytes.count) }
        XCTAssertEqual(try PlanetChildAppearance.Selection.decode(bytes),value);XCTAssertEqual(try PlanetChildAppearance.Selection.decodeDTO(value.dto),value)
        for field in ["sceneToken","resourceToken","uri","signature","rightsApproved","childSafe","policyGrant","title","mediaBytes","contentChecksum"] { var row=value.dto;row[field]=true;XCTAssertThrowsError(try PlanetChildAppearance.Selection.decodeDTO(row),field) }
        var row=value.dto;row["schemaVersion"]=true;XCTAssertThrowsError(try PlanetChildAppearance.Selection.decodeDTO(row));row=value.dto;row["sceneId"]="../scene";XCTAssertThrowsError(try PlanetChildAppearance.Selection.decodeDTO(row))
        row=value.dto;row["owner"]=["kind":"external-link","id":"fixture-writer"];XCTAssertThrowsError(try PlanetChildAppearance.Selection.decodeDTO(row));row=value.dto;row["stand"]=["geometryId":"adult.custom","assetId":"fixture-stand","entityId":"fixture-stand-entity"];XCTAssertThrowsError(try PlanetChildAppearance.Selection.decodeDTO(row))
        row=value.dto;row["stand"]=["geometryId":"stand.base.child-book-cloud","assetId":value.skin.assetId,"entityId":"fixture-stand-entity"];XCTAssertThrowsError(try PlanetChildAppearance.Selection.decodeDTO(row))
        bytes.append(0);XCTAssertThrowsError(try PlanetChildAppearance.Selection.decode(bytes))
    }
    func testAppearanceExtensionPreservesLegacyAndRejectsCorruption() throws {
        XCTAssertTrue(try PlanetChildDataStore.fixtureAppearanceScenario("legacy"));XCTAssertTrue(try PlanetChildDataStore.fixtureAppearanceScenario("corrupt"))
    }
    func testAppearanceRevisionsTombstonesAndProfileIsolation() throws {
        XCTAssertTrue(try PlanetChildDataStore.fixtureAppearanceScenario("cas"));XCTAssertTrue(try PlanetChildDataStore.fixtureAppearanceScenario("isolation"));XCTAssertTrue(try PlanetChildDataStore.fixtureAppearanceScenario("tombstone"))
        XCTAssertThrowsError(try PlanetChildAppearance.next(9007199254740990));XCTAssertThrowsError(try PlanetChildAppearance.revision(9007199254740991))
    }
    func testSameProfileLocaleMigrationPreservesAllStableChoices() throws { XCTAssertTrue(try PlanetChildDataStore.fixtureAppearanceScenario("migration")) }
    func testNativeCompletionReceiptRestoresExactPendingWithoutChangingCiphertext() throws {
        _=try XCTUnwrap(ProcessInfo.processInfo.environment["LITERARY_PLANET_SECURE_TEST_RUN_ID"])
        XCTAssertTrue(try PlanetChildDataStore.fixtureAppearanceCompletionUnknown(runId:id()))
    }
    func testAppearanceWireRejectsCallerSelectionsProfilesAndCapabilities() throws {
        let token=String(repeating:"2",count:32),id=String(repeating:"1",count:32),scene=String(repeating:"3",count:32)
        let read: [String:Any]=["version":2,"requestId":id,"contextToken":token];XCTAssertNil(try PlanetChildLocalV2Wire.decode("readSceneSelection",read).expectedRevision)
        var remember=read;remember["sceneToken"]=scene;remember["expectedRevision"]=0;XCTAssertEqual(try PlanetChildLocalV2Wire.decode("rememberSceneSelection",remember).sceneToken,scene)
        for field in ["selection","profileId","owner","policy","approval","acknowledged","receipt","uri"] { var invalid=remember;invalid[field]=true;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("rememberSceneSelection",invalid),field) }
        for revision: Any in [true,-1,-0.0,0.5,9007199254740990,9007199254740991] { remember["expectedRevision"]=revision;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("rememberSceneSelection",remember)) }
        var restore=read;restore["expectedRevision"]=9007199254740990;XCTAssertNotNil(try PlanetChildLocalV2Wire.decode("restoreSceneSelection",restore).expectedRevision);restore["selection"]=try selection().dto;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("restoreSceneSelection",restore))
        let plugin=PlanetChildPlugin();for method in ["readSceneSelection","rememberSceneSelection","restoreSceneSelection"] {
            XCTAssertTrue(plugin.pluginMethods.contains(where:{ $0.name==method }))
            let refused=PlanetChildLocalV2Wire.refusal(method,read,reason:"unsupported")
            XCTAssertEqual(Set(refused.keys),Set(["version","requestId","status","contextToken","generation","value"]))
            XCTAssertEqual(refused["contextToken"] as? String,token);XCTAssertTrue(refused["value"] is NSNull)
        }
    }
    func testIsolatedAESAppearancePersistenceAcrossOwnedProcessPhases() throws {
        let environment=ProcessInfo.processInfo.environment,run=try XCTUnwrap(environment["LITERARY_PLANET_SECURE_TEST_RUN_ID"])
        guard let phase=environment["LITERARY_PLANET_APPEARANCE_PERSISTENCE_PHASE"],["write","read"].contains(phase) else { throw XCTSkip("NOT_RUN: explicit owned AES write/read process phase required") }
        XCTAssertTrue(try PlanetChildDataStore.fixtureAppearancePersistence(runId:run,phase:phase))
    }
    func testPendingMarkerRejectsCallerAcknowledgementAcrossOwnedProcessPhases() throws {
        let environment=ProcessInfo.processInfo.environment,run=try XCTUnwrap(environment["LITERARY_PLANET_SECURE_TEST_RUN_ID"])
        guard let phase=environment["LITERARY_PLANET_APPEARANCE_PENDING_PHASE"],["pending","pending-reopen"].contains(phase) else { throw XCTSkip("NOT_RUN: explicit owned sticky-marker/process phase required") }
        XCTAssertTrue(try PlanetChildDataStore.fixtureAppearancePersistence(runId:run,phase:phase))
        var caller: [String:Any]=["version":2,"requestId":run,"contextToken":String(repeating:"2",count:32),"sceneToken":String(repeating:"3",count:32),"expectedRevision":0];caller["acknowledged"]=true;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("rememberSceneSelection",caller))
    }
    @MainActor private func host() throws -> (PlanetBridgeViewController,WKWebView,PlanetChildPlugin) {
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.first(where:{ $0.activationState == .foregroundActive }) as? UIWindowScene),controller=try XCTUnwrap(scene.windows.first(where:{ $0.isKeyWindow })?.rootViewController as? PlanetBridgeViewController)
        return (controller,try XCTUnwrap(controller.bridge?.webView),try XCTUnwrap(controller.bridge?.plugin(withName:"PlanetChild") as? PlanetChildPlugin))
    }
    private func id() -> String { UUID().uuidString.replacingOccurrences(of:"-",with:"").lowercased() }
    private func base(_ token: String) -> [String:Any] { ["version":2,"requestId":id(),"contextToken":token] }
    @MainActor private func native(_ web: WKWebView,_ method: String,_ request: [String:Any]) async throws -> [String:Any] {
        let json=String(decoding:try JSONSerialization.data(withJSONObject:request,options:[.sortedKeys,.withoutEscapingSlashes]),as:UTF8.self)
        _=try await web.evaluateJavaScript("window.__lpAppearanceReply=null;window.Capacitor.nativePromise('PlanetChild','\(method)',\(json)).then(value=>window.__lpAppearanceReply=JSON.stringify(value)).catch(()=>window.__lpAppearanceReply='{}');'scheduled'")
        let began=Date();while Date().timeIntervalSince(began)<10 { if let text=try await web.evaluateJavaScript("window.__lpAppearanceReply") as? String { _=try await web.evaluateJavaScript("delete window.__lpAppearanceReply");return try XCTUnwrap(JSONSerialization.jsonObject(with:Data(text.utf8)) as? [String:Any]) };try await Task.sleep(nanoseconds:20_000_000) };XCTFail("Actual original native callback did not settle");throw PlanetChildAppearance.Failure.unavailable
    }
    @MainActor func testGenuineSceneSelectionRequiresCurrentNativeSceneAndFreshRestore() async throws {
        guard ProcessInfo.processInfo.environment["LITERARY_PLANET_APPEARANCE_FIXTURE_AVAILABLE"]=="true" else { throw XCTSkip("NOT_RUN: genuine staged signed native package/media/scene and protected child record required; skip is not acceptance") }
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"child-appearance-runtime-fixture-v1",withExtension:"json")),size=try url.resourceValues(forKeys:[.fileSizeKey]).fileSize
        guard let size,size>0,size<=65536 else { XCTFail("Unbounded fixture coordinates");return };var bytes=try Data(contentsOf:url);defer { bytes.resetBytes(in:0..<bytes.count) };let fixture=try XCTUnwrap(JSONSerialization.jsonObject(with:bytes) as? [String:Any]);XCTAssertEqual(Set(fixture.keys),Set(["owner","sceneId","profileId"]));let owner=try PlanetChildLocalV2Wire.ref(fixture["owner"]),sceneId=try XCTUnwrap(fixture["sceneId"] as? String),profileId=try XCTUnwrap(fixture["profileId"] as? String)
        let (_,web,plugin)=try host();let context: String
        if let actual=plugin.runtimeOriginalContextToken() { context=actual } else { let boot=try await native(web,"bootstrap",["version":2,"requestId":id()]);XCTAssertEqual(boot["status"] as? String,"child");context=try XCTUnwrap((boot["context"] as? [String:Any])?["token"] as? String) }
        let read=try await native(web,"readSceneSelection",base(context)),prior=try XCTUnwrap(read["value"] as? [String:Any]);XCTAssertEqual(prior["profileId"] as? String,profileId);let revision=try XCTUnwrap(prior["revision"] as? NSNumber).uint64Value
        var open=base(context);open["owner"]=owner;open["sceneId"]=sceneId;let openedReply=try await native(web,"openScene",open),opened=try XCTUnwrap(openedReply["value"] as? [String:Any]);XCTAssertEqual(opened["status"] as? String,"opened");let oldSceneToken=try XCTUnwrap(opened["sceneToken"] as? String)
        var remember=base(context);remember["sceneToken"]=oldSceneToken;remember["expectedRevision"]=revision;let savedReply=try await native(web,"rememberSceneSelection",remember),saved=try XCTUnwrap(savedReply["value"] as? [String:Any]);XCTAssertEqual(saved["profileId"] as? String,profileId);XCTAssertEqual((saved["revision"] as? NSNumber)?.uint64Value,revision+1);let expected=try PlanetChildAppearance.Selection.decodeDTO(try XCTUnwrap(saved["selection"]))
        let retired=try await native(web,"retire",base(context));XCTAssertEqual(retired["status"] as? String,"retired")
        let boot=try await native(web,"bootstrap",["version":2,"requestId":id()]);XCTAssertEqual(boot["status"] as? String,"child");let fresh=try XCTUnwrap((boot["context"] as? [String:Any])?["token"] as? String);XCTAssertNotEqual(fresh,context)
        let rereadReply=try await native(web,"readSceneSelection",base(fresh)),reread=try XCTUnwrap(rereadReply["value"] as? [String:Any]);XCTAssertEqual(reread["profileId"] as? String,profileId);XCTAssertEqual((reread["revision"] as? NSNumber)?.uint64Value,revision+1);XCTAssertEqual(try PlanetChildAppearance.Selection.decodeDTO(try XCTUnwrap(reread["selection"])),expected)
        var restore=base(fresh);restore["expectedRevision"]=revision+1;let restoredReply=try await native(web,"restoreSceneSelection",restore),restored=try XCTUnwrap(restoredReply["value"] as? [String:Any]);XCTAssertEqual(restored["status"] as? String,"restored");XCTAssertEqual((restored["revision"] as? NSNumber)?.uint64Value,revision+1);let scene=try XCTUnwrap(restored["scene"] as? [String:Any]);XCTAssertNotEqual(scene["sceneToken"] as? String,oldSceneToken)
        var release=base(fresh);release["sceneToken"]=try XCTUnwrap(scene["sceneToken"]);_=try await native(web,"releaseScene",release)
        remember=base(fresh);remember["sceneToken"]=oldSceneToken;remember["expectedRevision"]=revision+1;let stale=try await native(web,"rememberSceneSelection",remember);XCTAssertNotEqual(stale["status"] as? String,"ok")
    }
    /** Terminal unknown fixture: explicitly use its own already staged native
     * target. Real native readback is paused; scene retirement then precedes the
     * original SDK return. No caller ACK or scheduling gate grants authority. */
    @MainActor func testGenuineRetirementBeforeWriteAcknowledgementKeepsStickyPending() async throws {
        guard ProcessInfo.processInfo.environment["LITERARY_PLANET_APPEARANCE_LATE_ACK_FIXTURE_AVAILABLE"]=="true" else { throw XCTSkip("NOT_RUN: dedicated genuine staged native late-ACK target required; terminal unknown is not a reusable success fixture") }
        try await lateAcknowledgement(phase:"readback")
    }
    @MainActor func testGenuineCompletionFenceFailureKeepsStickyPending() async throws {
        guard ProcessInfo.processInfo.environment["LITERARY_PLANET_APPEARANCE_COMPLETION_FENCE_FIXTURE_AVAILABLE"]=="true" else { throw XCTSkip("NOT_RUN: dedicated genuine staged completion-fence target required") }
        try await lateAcknowledgement(phase:"completion")
    }
    @MainActor private func lateAcknowledgement(phase: String) async throws {
        let fixtureURL=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"child-appearance-runtime-fixture-v1",withExtension:"json"));let size=try fixtureURL.resourceValues(forKeys:[.fileSizeKey]).fileSize;guard let size,size>0,size<=65536 else { throw PlanetChildAppearance.Failure.unavailable };var bytes=try Data(contentsOf:fixtureURL);defer { bytes.resetBytes(in:0..<bytes.count) };let fixture=try XCTUnwrap(JSONSerialization.jsonObject(with:bytes) as? [String:Any]);XCTAssertEqual(Set(fixture.keys),Set(["owner","sceneId","profileId"]))
        let (_,web,plugin)=try host(),context=try XCTUnwrap(plugin.runtimeOriginalContextToken());let read=try await native(web,"readSceneSelection",base(context)),saved=try XCTUnwrap(read["value"] as? [String:Any]),revision=try XCTUnwrap(saved["revision"] as? NSNumber).uint64Value
        var open=base(context);open["owner"]=try PlanetChildLocalV2Wire.ref(fixture["owner"]);open["sceneId"]=try XCTUnwrap(fixture["sceneId"]);let sceneReply=try await native(web,"openScene",open),scene=try XCTUnwrap(sceneReply["value"] as? [String:Any]),token=try XCTUnwrap(scene["sceneToken"] as? String);XCTAssertTrue(plugin.runtimeAppearanceSceneAdmits(token))
        let command=id();try PlanetChildAppearanceRuntimeDelay.arm(command,phase:phase);defer { PlanetChildAppearanceRuntimeDelay.resume(command) }
        var remember=base(context);remember["requestId"]=command;remember["sceneToken"]=token;remember["expectedRevision"]=revision
        let json=String(decoding:try JSONSerialization.data(withJSONObject:remember,options:[.sortedKeys,.withoutEscapingSlashes]),as:UTF8.self)
        _=try await web.evaluateJavaScript("window.__lpAppearanceLate=null;window.Capacitor.nativePromise('PlanetChild','rememberSceneSelection',\(json)).then(value=>window.__lpAppearanceLate=JSON.stringify(value)).catch(()=>window.__lpAppearanceLate='{}');'scheduled'")
        let began=Date();while !PlanetChildAppearanceRuntimeDelay.entered(command) { guard Date().timeIntervalSince(began)<3 else { XCTFail("Actual native appearance pause was not entered");return };try await Task.sleep(nanoseconds:10_000_000) }
        XCTAssertTrue(try PlanetChildDataStore.fixtureProductionPendingObserved(commandId:command))
        var release=base(context);release["sceneToken"]=token;let releaseJSON=String(decoding:try JSONSerialization.data(withJSONObject:release,options:[.sortedKeys,.withoutEscapingSlashes]),as:UTF8.self)
        _=try await web.evaluateJavaScript("window.Capacitor.nativePromise('PlanetChild','releaseScene',\(releaseJSON)).catch(()=>{});'scheduled'")
        let retiring=Date();while plugin.runtimeAppearanceSceneAdmits(token) { guard Date().timeIntervalSince(retiring)<2 else { XCTFail("Original scene was not synchronously retired");return };try await Task.sleep(nanoseconds:10_000_000) }
        PlanetChildAppearanceRuntimeDelay.resume(command);let completed=Date();var reply: [String:Any]?
        while reply==nil { if let text=try await web.evaluateJavaScript("window.__lpAppearanceLate") as? String { reply=try JSONSerialization.jsonObject(with:Data(text.utf8)) as? [String:Any] };guard Date().timeIntervalSince(completed)<5 else { XCTFail("Original native delayed completion did not return");return };if reply==nil { try await Task.sleep(nanoseconds:10_000_000) } }
        XCTAssertNotEqual(reply?["status"] as? String,"ok");XCTAssertFalse(plugin.runtimeAppearanceSceneAdmits(token));XCTAssertTrue(try PlanetChildDataStore.fixtureProductionPendingObserved(commandId:command));_=try await web.evaluateJavaScript("delete window.__lpAppearanceLate")
    }
}
