import Foundation
import XCTest
import Capacitor
import UIKit
import WebKit
import CryptoKit
@testable import App

/** AUTHORED_NOT_COMPILED_NOT_RUN. These isolated codec/signed-graph/storage
 * fixtures prove mechanics only; they cannot mint installed child admission. */
final class PlanetChildJourneyRuntimeTests: XCTestCase {
    override func setUpWithError() throws {
        XCTAssertEqual(ProcessInfo.processInfo.environment["LITERARY_PLANET_JOURNEY_TEST_PHASE"],"local-v2-child-journey")
        let run=try XCTUnwrap(ProcessInfo.processInfo.environment["LITERARY_PLANET_SECURE_TEST_RUN_ID"]);XCTAssertNotNil(run.range(of:"^[a-f0-9]{32}$",options:.regularExpression))
    }
    private func progress(_ current: String?="node-one",_ completed: [String]=[]) throws -> PlanetChildJourney.Progress { try PlanetChildJourney.Progress(journeyId:"route-one",journeyVersion:1,contentVersion:1,currentNodeId:current,completedNodeIds:completed,selectedCountryId:"country-one",selectedWriterId:nil,selectedWorkId:nil,lastSafeRoute:"journey") }
    func testSemanticCodecRoundtripAndExactCapabilityRejection() throws {
        let value=try progress("node-one",["z-removed-node","a-removed-node"]);var bytes=try value.encoded();defer { bytes.resetBytes(in:0..<bytes.count) };XCTAssertEqual(try PlanetChildJourney.Progress.decode(bytes),value);XCTAssertEqual(try PlanetChildJourney.Progress.decodeDTO(value.dto),value);XCTAssertEqual(value.completedNodeIds,["z-removed-node","a-removed-node"]);XCTAssertEqual(bytes.last,1)
        // Independent public LPJ1 specification bytes, shared with Java. This
        // fixture does not derive its expected result from the production codec.
        let goldenHex="4c504a31010009726f7574652d6f6e65000000000000000100000000000000010100086e6f64652d6f6e6502000e7a2d72656d6f7665642d6e6f6465000e612d72656d6f7665642d6e6f646501000b636f756e7472792d6f6e65000001"
        var golden=Data();defer { golden.resetBytes(in:0..<golden.count) }
        for offset in stride(from:0,to:goldenHex.utf8.count,by:2) { let begin=goldenHex.index(goldenHex.startIndex,offsetBy:offset),end=goldenHex.index(begin,offsetBy:2);golden.append(try XCTUnwrap(UInt8(goldenHex[begin..<end],radix:16))) }
        XCTAssertEqual(golden.count,93);XCTAssertEqual(bytes,golden);XCTAssertEqual(try PlanetChildJourney.Progress.decode(golden),value)
        for field in ["contextToken","uri","reference","profileId","approval","signature","contentChecksum","camera","nodeIds"] { var row=value.dto;row[field]=true;XCTAssertThrowsError(try PlanetChildJourney.Progress.decodeDTO(row),field) }
        for invalid: Any in [true,-1,0.5,9007199254740991,9007199254740992] { var row=value.dto;row["journeyVersion"]=invalid;XCTAssertThrowsError(try PlanetChildJourney.Progress.decodeDTO(row)) }
        var row=value.dto;row["completedNodeIds"]=["node-one","node-one"];XCTAssertThrowsError(try PlanetChildJourney.Progress.decodeDTO(row));row=value.dto;row["lastSafeRoute"]="https://adult.example";XCTAssertThrowsError(try PlanetChildJourney.Progress.decodeDTO(row));bytes.append(0);XCTAssertThrowsError(try PlanetChildJourney.Progress.decode(bytes))
    }
    func testMigrationRetainsCurrentNodeSelectionsAndRecentCompletedCheckpoint() throws {
        let saved=try progress("node-two",["node-one","removed-node"]),migrated=try PlanetChildJourney.migrate(saved,journeyId:"route-one",version:2,nodeIds:["node-one","node-two","node-three"],kinds:["activity","writer","work"])
        XCTAssertEqual(migrated.currentNodeId,"node-two");XCTAssertEqual(migrated.completedNodeIds,["node-one","removed-node"]);XCTAssertEqual(migrated.contentVersion,2);XCTAssertEqual(migrated.selectedCountryId,"country-one")
        let removed=try PlanetChildJourney.migrate(try progress("gone",["removed-node"]),journeyId:"route-one",version:2,nodeIds:["node-one","node-two"],kinds:["country","writer"]);XCTAssertEqual(removed.currentNodeId,"node-one");XCTAssertEqual(removed.completedNodeIds,["removed-node"])
        let recent=try PlanetChildJourney.migrate(try progress("gone",["node-two","node-one"]),journeyId:"route-one",version:2,nodeIds:["node-one","node-two","node-three"],kinds:["country","writer","work"]);XCTAssertEqual(recent.currentNodeId,"node-one");XCTAssertEqual(recent.completedNodeIds,["node-two","node-one"])
        let complete=try PlanetChildJourney.migrate(try progress(nil,["node-one"]),journeyId:"route-one",version:2,nodeIds:["node-one","node-two"],kinds:["country","writer"]);XCTAssertEqual(complete.currentNodeId,"node-two")
    }
    func testRestartPreservesCompletionsAndFinalNodeCompletesToNull() throws {
        let saved=try progress("node-two",["node-one"]),restarted=try PlanetChildJourney.migrate(saved,journeyId:"route-one",version:1,nodeIds:["node-one","node-two"],kinds:["country","writer"],restart:true)
        XCTAssertEqual(restarted.currentNodeId,"node-one");XCTAssertEqual(restarted.completedNodeIds,["node-one"])
        let done=try PlanetChildJourney.complete(saved,nodeIds:["node-one","node-two"],currentNodeId:"node-two");XCTAssertNil(done.currentNodeId);XCTAssertEqual(done.completedNodeIds,["node-one","node-two"])
        XCTAssertThrowsError(try PlanetChildJourney.complete(saved,nodeIds:["node-one","node-two"],currentNodeId:"node-one"))
        let sequential=try PlanetChildJourney.complete(try progress("node-one",["node-two"]),nodeIds:["node-one","node-two","node-three"],currentNodeId:"node-one",kind:"writer");XCTAssertEqual(sequential.currentNodeId,"node-two");XCTAssertEqual(sequential.completedNodeIds,["node-two","node-one"]);XCTAssertEqual(sequential.selectedWriterId,"node-one")
        let inserted=try PlanetChildJourney.complete(try progress("node-two"),nodeIds:["new-earlier","node-two"],currentNodeId:"node-two");XCTAssertEqual(inserted.currentNodeId,"new-earlier");XCTAssertEqual(inserted.completedNodeIds,["node-two"])
        let selected=try PlanetChildJourney.selectCurrent(saved,nodeId:"node-two",kind:"work");XCTAssertEqual(selected.selectedWorkId,"node-two");XCTAssertEqual(selected.selectedCountryId,"country-one")
    }
    func testCompletionBoundDoesNotDiscardHistoryOrManufactureCompletion() throws {
        let done=(0..<64).map { "old-node-"+String($0) },saved=try progress("node-one",done)
        XCTAssertThrowsError(try PlanetChildJourney.complete(saved,nodeIds:["node-one"],currentNodeId:"node-one"));XCTAssertEqual(saved.completedNodeIds.count,64)
        XCTAssertThrowsError(try PlanetChildJourney.next(9007199254740990))
    }
    func testApprovedGraphExcludesHomeEmptyRoutesDuplicateIDsAndWrapperNodes() throws {
        for name in ["valid","empty","duplicate","wrapper","expiry"] { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.journeyGraph(name),name) }
    }
    func testProtectedExtensionLegacyIsolationSwitchMigrationAndCorruption() throws {
        for name in ["legacy","isolation","switch","migration","corrupt","capacity"] { XCTAssertTrue(try PlanetChildDataStore.fixtureJourneyScenario(name),name) }
    }
    func testUnknownCompletionRetainsExactPendingMarkerAndCiphertext() throws {
        let run=UUID().uuidString.replacingOccurrences(of:"-",with:"").lowercased();XCTAssertTrue(try PlanetChildDataStore.fixtureJourneyCompletionUnknown(runId:run))
    }
    func testJourneyWireRejectsCallerProgressProfileCapabilitiesAndStaleShape() throws {
        let base: [String:Any]=["version":2,"requestId":String(repeating:"1",count:32),"contextToken":String(repeating:"2",count:32)]
        for name in ["listJourneys","readJourneyProgress","closeJourney"] { XCTAssertNotNil(try PlanetChildLocalV2Wire.decode(name,base));XCTAssertTrue(PlanetChildPlugin().pluginMethods.contains(where:{ $0.name==name })) }
        var open=base;open["journeyId"]="route-one";open["expectedRevision"]=0;XCTAssertEqual(try PlanetChildLocalV2Wire.decode("openJourney",open).journeyId,"route-one")
        var exhausted=open;exhausted["expectedRevision"]=9007199254740990;XCTAssertEqual(try PlanetChildLocalV2Wire.decode("openJourney",exhausted).expectedRevision,9007199254740990)
        for field in ["progress","profileId","node","references","journeyVersion","contentVersion","approval","receipt"] { var row=open;row[field]=true;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("openJourney",row),field) }
        var advance=open;advance["currentNodeId"]="node-one";advance["action"]="complete";XCTAssertEqual(try PlanetChildLocalV2Wire.decode("advanceJourney",advance).currentNodeId,"node-one")
        advance["currentNodeId"]=NSNull();XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("advanceJourney",advance));advance["action"]="restart";XCTAssertNil(try PlanetChildLocalV2Wire.decode("advanceJourney",advance).currentNodeId)
        for invalid: Any in [true,-1,-0.0,0.5,9007199254740991] { advance["expectedRevision"]=invalid;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("advanceJourney",advance)) }
        let refused=PlanetChildLocalV2Wire.refusal("openJourney",open,reason:"unsupported");XCTAssertEqual(Set(refused.keys),Set(["version","requestId","status","contextToken","generation","value"]));XCTAssertTrue(refused["value"] is NSNull)
    }
    @MainActor private func nativeHost() throws -> (WKWebView,PlanetChildPlugin) {
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.first(where:{ $0.activationState == .foregroundActive }) as? UIWindowScene),controller=try XCTUnwrap(scene.windows.first(where:{ $0.isKeyWindow })?.rootViewController as? PlanetBridgeViewController)
        return (try XCTUnwrap(controller.bridge?.webView),try XCTUnwrap(controller.bridge?.plugin(withName:"PlanetChild") as? PlanetChildPlugin))
    }
    private func nativeBase(_ token: String) -> [String:Any] { ["version":2,"requestId":UUID().uuidString.replacingOccurrences(of:"-",with:"").lowercased(),"contextToken":token] }
    @MainActor private func native(_ web: WKWebView,_ method: String,_ request: [String:Any],timeout: TimeInterval=10) async throws -> [String:Any] {
        let json=String(decoding:try JSONSerialization.data(withJSONObject:request,options:[.sortedKeys,.withoutEscapingSlashes]),as:UTF8.self)
        _=try await web.evaluateJavaScript("window.__lpJourneyReply=null;window.Capacitor.nativePromise('PlanetChild','\(method)',\(json)).then(value=>window.__lpJourneyReply=JSON.stringify(value)).catch(()=>window.__lpJourneyReply='{}');'scheduled'")
        let began=Date();while Date().timeIntervalSince(began)<timeout { if let text=try await web.evaluateJavaScript("window.__lpJourneyReply") as? String { _=try await web.evaluateJavaScript("delete window.__lpJourneyReply");return try XCTUnwrap(JSONSerialization.jsonObject(with:Data(text.utf8)) as? [String:Any]) };try await Task.sleep(nanoseconds:20_000_000) };XCTFail("Original native SDK callback did not settle");throw PlanetChildJourney.Failure.unavailable
    }
    @MainActor private func nativeContext(_ web: WKWebView,_ plugin: PlanetChildPlugin) async throws -> (String,[String:Any]) {
        if let token=plugin.runtimeOriginalContextToken() { let current=try await native(web,"readContext",nativeBase(token));guard current["status"] as? String=="child" else { throw XCTSkip("NOT_RUN: genuine protected child context and signed journey package required") };return (token,try XCTUnwrap(current["context"] as? [String:Any])) }
        let boot=try await native(web,"bootstrap",["version":2,"requestId":UUID().uuidString.replacingOccurrences(of:"-",with:"").lowercased()]);guard boot["status"] as? String=="child" else { throw XCTSkip("NOT_RUN: installed protected child profile and native reviewed journey pins required") };let context=try XCTUnwrap(boot["context"] as? [String:Any]);return (try XCTUnwrap(context["token"] as? String),context)
    }
    /** The actual original Capacitor/native calls establish retirement,
     * bootstrap of a new token and protected semantic reread. Environment
     * coordinates only opt into staged prerequisites; they grant no authority. */
    @MainActor func testGenuineContinueRereadsProtectedStateAfterContextRetirement() async throws {
        guard ProcessInfo.processInfo.environment["LITERARY_PLANET_JOURNEY_FIXTURE_AVAILABLE"]=="true" else { throw XCTSkip("NOT_RUN: genuine staged native signed journey package and enrolled local child profile required") }
        let (web,plugin)=try nativeHost(),(token,_)=try await nativeContext(web,plugin),list=try await native(web,"listJourneys",nativeBase(token)),routes=try XCTUnwrap(list["value"] as? [[String:Any]])
        guard let first=routes.first,let journey=first["journeyId"] as? String else { throw XCTSkip("NOT_RUN: current native-approved nonempty journey graph required") }
        let before=try await native(web,"readJourneyProgress",nativeBase(token)),prior=try XCTUnwrap(before["value"] as? [String:Any]),revision=try XCTUnwrap(prior["revision"] as? NSNumber).uint64Value
        var open=nativeBase(token);open["journeyId"]=journey;open["expectedRevision"]=revision;let opened=try await native(web,"openJourney",open),value=try XCTUnwrap(opened["value"] as? [String:Any]);XCTAssertTrue(["opened","restored"].contains(value["status"] as? String ?? ""))
        var saved=try PlanetChildJourney.Progress.decodeDTO(try XCTUnwrap(value["progress"])),savedRevision=try XCTUnwrap(value["revision"] as? NSNumber).uint64Value
        var advance=nativeBase(token);advance["journeyId"]=journey;advance["expectedRevision"]=savedRevision;advance["currentNodeId"]=saved.currentNodeId as Any? ?? NSNull();advance["action"]=saved.currentNodeId==nil ? "restart":"complete"
        let advanced=try await native(web,"advanceJourney",advance),progressValue=try XCTUnwrap(advanced["value"] as? [String:Any]);saved=try PlanetChildJourney.Progress.decodeDTO(try XCTUnwrap(progressValue["progress"]));savedRevision=try XCTUnwrap(progressValue["revision"] as? NSNumber).uint64Value
        let closed=try await native(web,"closeJourney",nativeBase(token));XCTAssertEqual((closed["value"] as? [String:Any])?["status"] as? String,"retired")
        let retired=try await native(web,"retire",nativeBase(token));XCTAssertEqual(retired["status"] as? String,"retired")
        let (fresh,_)=try await nativeContext(web,plugin);XCTAssertNotEqual(fresh,token)
        let reread=try await native(web,"readJourneyProgress",nativeBase(fresh)),protected=try XCTUnwrap(reread["value"] as? [String:Any]);XCTAssertEqual((protected["revision"] as? NSNumber)?.uint64Value,savedRevision);XCTAssertEqual(try PlanetChildJourney.Progress.decodeDTO(try XCTUnwrap(protected["progress"])),saved)
        open=nativeBase(fresh);open["journeyId"]=journey;open["expectedRevision"]=savedRevision;let resumed=try await native(web,"openJourney",open),restored=try XCTUnwrap(resumed["value"] as? [String:Any]);XCTAssertEqual(restored["status"] as? String,"restored");XCTAssertEqual(try PlanetChildJourney.Progress.decodeDTO(try XCTUnwrap(restored["progress"])),saved)
    }
    private func counterpartPrepared(_ locale: String,_ age: Int) throws -> Bool {
        guard let root=Bundle.main.resourceURL else { return false };let directory=root.appendingPathComponent("public/child-native",isDirectory:true)
        func bounded(_ file: URL,_ maximum: Int) -> Data? {
            guard file.resolvingSymlinksInPath().standardizedFileURL==file.standardizedFileURL,let info=try? file.resourceValues(forKeys:[.isRegularFileKey,.isSymbolicLinkKey,.fileSizeKey]),info.isRegularFile==true,info.isSymbolicLink != true,let size=info.fileSize,size>0,size<=maximum else { return nil };return try? Data(contentsOf:file)
        }
        func digest(_ bytes: Data) -> String { SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() }
        guard var data=bounded(directory.appendingPathComponent("catalog-v1.json"),65536) else { return false };defer { data.resetBytes(in:0..<data.count) }
        guard let row=try JSONSerialization.jsonObject(with:data) as? [String:Any],let packages=row["packages"] as? [[String:Any]],packages.count<=32 else { return false }
        for pin in packages {
            guard let hash=pin["packageChecksum"] as? String,let reviewHash=pin["reviewChecksum"] as? String,hash.range(of:#"\A[a-f0-9]{64}\z"#,options:.regularExpression) != nil,reviewHash.range(of:#"\A[a-f0-9]{64}\z"#,options:.regularExpression) != nil else { return false }
            guard var payload=bounded(directory.appendingPathComponent("packages/"+hash+".json"),8388608),var review=bounded(directory.appendingPathComponent("reviews/"+reviewHash+".json"),2097152) else { return false };defer { payload.resetBytes(in:0..<payload.count);review.resetBytes(in:0..<review.count) }
            guard digest(payload)==hash,digest(review)==reviewHash,let approved=try JSONSerialization.jsonObject(with:review) as? [String:Any],approved["packageChecksum"] as? String==hash else { return false }
            if let value=try JSONSerialization.jsonObject(with:payload) as? [String:Any],value["locale"] as? String==locale,(value["exactAge"] as? NSNumber)?.intValue==age,approved["locale"] as? String==locale,(approved["exactAge"] as? NSNumber)?.intValue==age { return true }
        }
        return false // Exact-byte precondition only; actual native Gate verifies signatures/admission.
    }
    /** Optional operator fixture exercises the actual existing native PIN/OS
     * Parent Gate. It never rewrites or injects a profile result. */
    @MainActor func testGenuineLocaleMigrationUsesOriginalNativeParentGate() async throws {
        guard ProcessInfo.processInfo.environment["literaryChildJourneyLocaleGateFixtureAvailable"]=="true" else { throw XCTSkip("NOT_RUN: explicit operator and native PIN/OS Parent Gate fixture readiness required") }
        let (web,plugin)=try nativeHost(),(token,context)=try await nativeContext(web,plugin),profile=try XCTUnwrap(context["profileId"] as? String),locale=try XCTUnwrap(context["locale"] as? String),other=locale=="ru" ? "en":"ru"
        let original=try await native(web,"readContext",nativeBase(token)),profiles=try XCTUnwrap(original["profiles"] as? [[String:Any]]),selected=try XCTUnwrap(profiles.first(where:{ $0["id"] as? String==profile })),age=try XCTUnwrap(selected["exactAge"] as? NSNumber).intValue
        guard try counterpartPrepared(other,age) else { throw XCTSkip("NOT_RUN: prepared reviewed counterpart locale package is absent; no profile mutation attempted") }
        let read=try await native(web,"readJourneyProgress",nativeBase(token)),saved=try XCTUnwrap(read["value"] as? [String:Any]);guard !(saved["progress"] is NSNull),let raw=saved["progress"] else { throw XCTSkip("NOT_RUN: first complete the genuine saved journey fixture") };let progress=try PlanetChildJourney.Progress.decodeDTO(raw)
        var action=nativeBase(token);action["action"]="expand-access-settings";action["target"]=["profileId":profile,"changes":["locale":other]]
        let result=try await native(web,"perform",action,timeout:55)
        guard result["status"] as? String=="child",let next=result["context"] as? [String:Any],next["locale"] as? String==other else { throw XCTSkip("NOT_RUN: genuine original PIN/OS UI or approved counterpart admission did not complete; no synthetic success used") }
        let fresh=try XCTUnwrap(next["token"] as? String);XCTAssertNotEqual(fresh,token);let reread=try await native(web,"readJourneyProgress",nativeBase(fresh)),protected=try XCTUnwrap(reread["value"] as? [String:Any]),retained=try PlanetChildJourney.Progress.decodeDTO(try XCTUnwrap(protected["progress"]));XCTAssertEqual(retained.completedNodeIds,progress.completedNodeIds)
        var open=nativeBase(fresh);open["journeyId"]=progress.journeyId;open["expectedRevision"]=try XCTUnwrap(protected["revision"] as? NSNumber).uint64Value;let resumed=try await native(web,"openJourney",open),value=try XCTUnwrap(resumed["value"] as? [String:Any]);XCTAssertEqual(value["status"] as? String,"restored");let migrated=try PlanetChildJourney.Progress.decodeDTO(try XCTUnwrap(value["progress"]));XCTAssertEqual(migrated.completedNodeIds,progress.completedNodeIds)
    }

    // AUTHORED_NOT_COMPILED_NOT_RUN: isolated typed fixtures never mint native CHILD admission.
    func testChildLocalePureTransitionRequiresExplicitParentPolicyAndPreservesPin() throws {
        for name in ["valid","locked","legacy","missing-policy","current-only","wrong-profile","wrong-revision","no-op"] { XCTAssertTrue(try PlanetChildLocalV2SDKRuntimeFixture.childLocaleTransition(name),name) }
    }
    func testCanonicalReadingLedgerRetainsLegacySiblingAndUnknownAnchorWithoutCapacityLoss() throws {
        for name in ["legacy","codec","migration","history","profile","downloads","capacity","unknown-anchor"] { XCTAssertTrue(try PlanetChildDataStore.fixtureReadingScenario(name),name) }
    }
    func testSignedReadingAnchorsAndPrivateWireRefuseAliasesCapabilitiesAndMalformedCas() throws {
        let record=try PlanetChildReadingPosition.Record("work","Work.ONE",1,"Passage.ONE"),reference:[String:Any]=["kind":"work","id":"Work.ONE","contentChecksum":String(repeating:"a",count:64)],anchors:[String:Any]=["schemaVersion":1,"anchorVersion":1,"segments":[["anchorId":"Passage.ONE","text":"One"]],"narration":NSNull()]
        XCTAssertEqual(try PlanetChildReadingPosition.decode(record.dto),record);try PlanetChildReadingPosition.membership(record,reference,anchors,"One")
        var invalid=record.dto;invalid["schemaVersion"]=true;XCTAssertThrowsError(try PlanetChildReadingPosition.decode(invalid));invalid=record.dto;invalid["locale"]="ru";XCTAssertThrowsError(try PlanetChildReadingPosition.decode(invalid))
        var duplicate=anchors;duplicate["segments"]=[["anchorId":"Passage.ONE","text":"O"],["anchorId":"Passage.ONE","text":"ne"]];XCTAssertThrowsError(try PlanetChildReadingPosition.anchors(duplicate,"One"));let unknown=try PlanetChildReadingPosition.Record("work","Work.ONE",2,"Passage.ONE");XCTAssertThrowsError(try PlanetChildReadingPosition.membership(unknown,reference,anchors,"One"))
        var gap=anchors;gap["narration"]=["assetId":"Audio.ONE","sha256":String(repeating:"a",count:64),"sampleRate":8000,"frameCount":8000,"cues":[["anchorId":"Passage.ONE","startFrame":1,"endFrame":8000]]] as [String:Any];XCTAssertThrowsError(try PlanetChildReadingPosition.anchors(gap,"One"))
        var write:[String:Any]=["version":2,"requestId":String(repeating:"1",count:32),"contextToken":String(repeating:"2",count:32),"reference":reference,"expectedRevision":0,"position":record.dto];XCTAssertEqual(try PlanetChildLocalV2Wire.decode("rememberReadingPosition",write).readingPosition,record)
        for key in ["profileId","approved","url","locale","anchorMap"] { var extra=write;extra[key]=true;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("rememberReadingPosition",extra)) };for value:Any in [true,-1,0.5,9007199254740990] { write["expectedRevision"]=value;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("rememberReadingPosition",write)) }
    }

    // AUTHORED_NOT_COMPILED_NOT_RUN: pure contracts never mint native admission.
    func testNarrationResumeWireRejectsCallerFramesMapsAndUnsafeReadingRevision() throws {
        let resume:[String:Any]=["version":2,"requestId":String(repeating:"1",count:32),"contextToken":String(repeating:"2",count:32),"owner":["kind":"work","id":"Work.ONE","contentChecksum":String(repeating:"a",count:64)],"assetId":"Audio.ONE","layout":["x":0,"y":0,"width":320,"height":240,"viewportWidth":320,"viewportHeight":640],"expectedReadingRevision":1]
        let decoded=try PlanetChildLocalV2Wire.decode("resumeNarration",resume);XCTAssertEqual(decoded.expectedRevision,1);XCTAssertEqual(decoded.assetId,"Audio.ONE");XCTAssertNil(decoded.readingPosition)
        for key in ["position","anchorMap","sha256","startFrame","seconds","url","approved","profileId"]{var bad=resume;bad[key]=true;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("resumeNarration",bad))}
        for value:Any in [true,-1,-0.0,0.5,9007199254740990]{var bad=resume;bad["expectedReadingRevision"]=value;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("resumeNarration",bad))}
    }
    func testNarrationCueRequiresKnownStoredAnchorExactTranscriptDigestAndFullPcmHeader() throws {
        for name in ["valid","unknown","asset","digest","transcript","sample-rate","full-frame-count","outside"]{XCTAssertTrue(try PlanetChildLocalV2SDKRuntimeFixture.narrationCue(name),name)}
    }
    func testRenderedNarrationFramesApplySignedStartOnceAndNeverCreateCompletionIdentity() throws {
        XCTAssertEqual(try PlanetChildLocalV2MediaCodec.sourceFrame(8,4,0),4);XCTAssertEqual(try PlanetChildLocalV2MediaCodec.sourceFrame(8,4,3),7);XCTAssertEqual(try PlanetChildLocalV2MediaCodec.sourceFrame(8,4,4),7);XCTAssertEqual(try PlanetChildLocalV2MediaCodec.sourceFrame(8,0,0),0)
        XCTAssertThrowsError(try PlanetChildLocalV2MediaCodec.sourceFrame(8,4,5));XCTAssertThrowsError(try PlanetChildLocalV2MediaCodec.sourceFrame(8,4,-1));XCTAssertThrowsError(try PlanetChildLocalV2MediaCodec.sourceFrame(8,8,0));XCTAssertThrowsError(try PlanetChildLocalV2MediaCodec.sourceFrame(0,0,0))
    }

    func testFirstNarrationMapStartsAtSignedFirstCueWithOptionalExactPrior()throws {
        for name in ["empty","existing","zero-with-prior","positive-without-prior","stale-version","wrong-entity","unknown-anchor"]{XCTAssertTrue(try PlanetChildLocalV2SDKRuntimeFixture.narrationBeginning(name),name)}
    }
    func testDelayedNarrationCasDrainsLastRenderedCueBeforeTerminalRetirement() throws { XCTAssertTrue(try PlanetChildLocalV2SDKRuntimeFixture.narrationDelayedTerminal()) }

}
