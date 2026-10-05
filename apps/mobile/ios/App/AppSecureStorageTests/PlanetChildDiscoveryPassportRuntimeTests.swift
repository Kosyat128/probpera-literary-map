import XCTest
import Foundation
import UIKit
import WebKit
@testable import App

/** AUTHORED_NOT_RUN. Pure/signer/codec fixtures establish mechanics only.
 * The final two cases require an operator-owned installed genuine child setup
 * and real original native controls/PIN. Environment flags supply no authority. */
final class PlanetChildDiscoveryPassportRuntimeTests: XCTestCase {
    private func credit(_ version: UInt64=2,node: String="node-one",kind: String="writer",entity: String="writer-one") throws -> PlanetChildPassport.Learning {
        try PlanetChildPassport.Learning(journeyId:"journey-one",nodeId:node,kind:kind,entityId:entity,journeyVersion:version,contentVersion:version)
    }
    private func golden() throws -> PlanetChildPassport.Ledger {
        var ledger=PlanetChildPassport.Ledger();try ledger.openCountry("country-one");try ledger.complete(credit(),nil)
        try ledger.complete(credit(node:"node-two",kind:"work",entity:"work-one"),PlanetChildPassport.CompletedJourney(journeyId:"journey-one",journeyVersion:2,contentVersion:2,nodeIds:["node-one","node-two"]));return ledger
    }
    func testSharedSemanticGoldenHasExplicitCountryAndVersionedWriterWorkFacts() throws {
        let ledger=try golden(),decoded=try PlanetChildPassport.Ledger.decode(ledger.encoded())
        XCTAssertEqual(decoded,ledger);XCTAssertEqual(decoded.countries,["country-one"]);XCTAssertEqual(decoded.learning.map { $0.kind },["writer","work"]);XCTAssertEqual(decoded.learning.map { $0.journeyVersion },[2,2]);XCTAssertEqual(decoded.completedJourneys.first?.nodeIds,["node-one","node-two"])
    }
    func testMigratedExplicitCompletionPreservesOldAndAppendsCurrentVersionEvidence() throws {
        var ledger=try golden();let old=ledger.learning[0];try ledger.complete(credit(3),nil)
        XCTAssertEqual(ledger.learning.count,3);XCTAssertEqual(ledger.learning[0],old);XCTAssertEqual(ledger.learning.last?.contentVersion,3)
        try ledger.complete(credit(3),nil);XCTAssertEqual(ledger.learning.count,3)
        XCTAssertEqual(try PlanetChildPassport.Ledger.decode(ledger.encoded()),ledger)
    }
    func testConflictingKindOrEntityForSameVersionedNodeIsDenied() throws {
        var ledger=try golden()
        XCTAssertThrowsError(try ledger.complete(credit(kind:"work",entity:"work-one"),nil));XCTAssertEqual(ledger.learning.count,2)
        XCTAssertThrowsError(try ledger.complete(credit(entity:"writer-two"),nil));XCTAssertEqual(ledger.learning.count,2)
        XCTAssertThrowsError(try PlanetChildPassport.Learning(journeyId:"journey-one",nodeId:"node-one",kind:"country",entityId:"country-one",journeyVersion:2,contentVersion:2))
    }
    func testCountryLedgerBound2048AndDuplicateOpenAreConservative() throws {
        var ledger=PlanetChildPassport.Ledger();for index in 0..<2048 { try ledger.openCountry("country-"+String(index)) }
        try ledger.openCountry("country-0");XCTAssertEqual(ledger.countries.count,2048)
        XCTAssertThrowsError(try ledger.openCountry("country-overflow"));XCTAssertEqual(ledger.countries.count,2048)
        XCTAssertEqual(try PlanetChildPassport.Ledger.decode(ledger.encoded()),ledger)
    }
    func testPassportCodecRejectsTrailingAndTruncatedBytes() throws {
        let bytes=try golden().encoded();for count in [1,4,16] { XCTAssertThrowsError(try PlanetChildPassport.Ledger.decode(Data(bytes.dropLast(count)))) }
        var extra=bytes;extra.append(0);XCTAssertThrowsError(try PlanetChildPassport.Ledger.decode(extra))
    }
    func testRestartRetainsCompletedJourneyReceiptWithoutCreditingCursor() throws {
        let ledger=try golden();let saved=try PlanetChildJourney.Progress(journeyId:"journey-one",journeyVersion:2,contentVersion:2,currentNodeId:nil,completedNodeIds:["node-one","node-two","archived-node"],selectedCountryId:"country-one",selectedWriterId:"writer-one",selectedWorkId:"work-one",lastSafeRoute:"journey")
        let restart=try PlanetChildJourney.migrate(saved,journeyId:"journey-one",version:3,nodeIds:["node-one","node-three"],kinds:["writer","work"],restart:true)
        XCTAssertEqual(restart.completedNodeIds,saved.completedNodeIds);XCTAssertEqual(restart.currentNodeId,"node-one");XCTAssertEqual(ledger.completedJourneys.count,1);XCTAssertEqual(ledger.learning.count,2)
    }
    func testCompletedJourneyVersionsAppendAndSameVersionConflictsDeny() throws {
        var ledger=try golden();let archived=ledger.completedJourneys[0]
        let current=try PlanetChildPassport.CompletedJourney(journeyId:"journey-one",journeyVersion:3,contentVersion:3,nodeIds:["node-one","node-three"])
        try ledger.complete(nil,current);try ledger.complete(nil,current)
        XCTAssertEqual(ledger.completedJourneys,[archived,current]);XCTAssertEqual(try PlanetChildPassport.Ledger.decode(ledger.encoded()),ledger)
        let prior=ledger,conflict=try PlanetChildPassport.CompletedJourney(journeyId:"journey-one",journeyVersion:3,contentVersion:3,nodeIds:["node-three","node-one"])
        XCTAssertThrowsError(try ledger.complete(credit(3),conflict));XCTAssertEqual(ledger,prior)
    }
    func testFullJourneyArchiveRefusesNewCompletionWithoutPartialLearning() throws {
        var ledger=PlanetChildPassport.Ledger()
        for version in 1...32 { try ledger.complete(nil,PlanetChildPassport.CompletedJourney(journeyId:"journey-one",journeyVersion:UInt64(version),contentVersion:UInt64(version),nodeIds:["node-one"])) }
        let prior=ledger,newJourney=try PlanetChildPassport.CompletedJourney(journeyId:"journey-one",journeyVersion:33,contentVersion:33,nodeIds:["node-one"])
        XCTAssertThrowsError(try ledger.complete(credit(33),newJourney));XCTAssertEqual(ledger,prior)
        let repeated=ledger.completedJourneys[0];try ledger.complete(nil,repeated);XCTAssertEqual(ledger,prior)
        XCTAssertEqual(try PlanetChildPassport.Ledger.decode(ledger.encoded()),ledger)
    }
    private func base() -> [String:Any] { ["version":2,"requestId":String(repeating:"1",count:32),"contextToken":String(repeating:"2",count:32)] }
    func testDiscoveryPassportWireIsClosedAndCorrelated() throws {
        for shelf in ["writers","books","collections"] { var request=base();request["shelf"]=shelf;XCTAssertEqual(try PlanetChildLocalV2Wire.decode("listDiscovery",request).shelf,shelf) }
        XCTAssertNotNil(try PlanetChildLocalV2Wire.decode("readPassport",base()))
        var country=base();country["reference"]=["kind":"country","id":"country-one","contentChecksum":String(repeating:"a",count:64)];XCTAssertNotNil(try PlanetChildLocalV2Wire.decode("recordCountryOpen",country))
        let refused=PlanetChildLocalV2Wire.refusal("readPassport",base(),reason:"unavailable",generation:7);XCTAssertEqual(Set(refused.keys),Set(["version","requestId","status","contextToken","generation","value"]));XCTAssertEqual(refused["generation"] as? UInt64,7);XCTAssertTrue(refused["value"] is NSNull)
    }
    func testCallerCannotSupplyPassportFactsScopePolicyOrApproval() throws {
        for field in ["profileId","locale","generation","countries","credits","journeys","approval","receipt","rights","exactAge"] { var row=base();row[field]=true;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("readPassport",row),field) }
        var wrong=base();wrong["shelf"]="adult";XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("listDiscovery",wrong))
        wrong=base();wrong["reference"]=["kind":"writer","id":"writer-one","contentChecksum":String(repeating:"a",count:64)];XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("recordCountryOpen",wrong))
    }
    func testDeletionWireRequiresExactNativeTargetAndScope() throws {
        var row=base();row["action"]="delete-child-data";row["target"]=["profileId":"reader","scope":"history"];XCTAssertNotNil(try PlanetChildLocalV2Wire.decode("perform",row))
        row["target"]=["profileId":"reader","scope":"profile"];XCTAssertNotNil(try PlanetChildLocalV2Wire.decode("perform",row))
        for target in [NSNull(),["scope":"history"],["profileId":"reader","scope":"all"],["profileId":"reader","scope":"profile","approval":true],["profileId":"../../reader","scope":"profile"]] as [Any] { row["target"]=target;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("perform",row)) }
    }
    func testNewPluginMethodsAreActuallyRegistered() {
        let names=Set(PlanetChildPlugin().pluginMethods.map { $0.name });for name in ["listDiscovery","readPassport","recordCountryOpen"] { XCTAssertTrue(names.contains(name),name) }
    }
    func testEmptyReviewedPackageProducesNeutralEmptyShelves() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.discoveryPassportGraph("empty")) }
    func testEligibleWriterDoesNotImplicitlySupplyWorks() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.discoveryPassportGraph("writer-only")) }
    func testShelfOrderIsDeterministicAndBounded64() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.discoveryPassportGraph("bound")) }
    func testGenuineRecommendationAndItsTargetAreIndependentlyAdmitted() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.discoveryPassportGraph("valid")) }
    func testEveryWriterIndependentlyRequiresAgeTopicRightsReviewAndPolicy() throws { for scenario in ["writer-age","writer-topic","writer-rights","writer-review","writer-policy"] { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.discoveryPassportGraph(scenario),scenario) } }
    func testEveryWorkIndependentlyRequiresAgeTopicRightsAndReview() throws { for scenario in ["work-age","work-topic","work-rights","work-review","work-policy"] { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.discoveryPassportGraph(scenario),scenario) } }
    func testExpiredAndAbsentRecommendationTargetsRemainDenied() throws { for scenario in ["expiry","bad-target"] { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.discoveryPassportGraph(scenario),scenario) } }
    func testLegacyCompletedIdsAreRetainedWithoutInventedTypedFacts() throws { XCTAssertTrue(try PlanetChildDataStore.fixturePassportScenario("legacy")) }
    func testProtectedPassportRetainsSameProfileMigrationAndSiblingIsolation() throws { for scenario in ["migration","isolation"] { XCTAssertTrue(try PlanetChildDataStore.fixturePassportScenario(scenario),scenario) } }
    func testAll32JourneysAnd64OrderedCompletedIdsSurviveProtectedRoundtrip() throws { XCTAssertTrue(try PlanetChildDataStore.fixturePassportScenario("capacity"));XCTAssertTrue(try PlanetChildDataStore.fixturePassportScenario("corrupt")) }
    func testHistoryRemovalClearsOnlyHistoryPassportJourneysAndSearchState() throws { XCTAssertTrue(try PlanetChildDataStore.fixturePassportScenario("history")) }
    func testProfileRemovalClearsOwnedDataAndPreservesSiblingPartition() throws { XCTAssertTrue(try PlanetChildDataStore.fixturePassportScenario("profile")) }
    func testUnknownCountryCompletionRetainsPendingWithoutReplayOrSnapshotChange() throws {
        let run=try XCTUnwrap(ProcessInfo.processInfo.environment["LITERARY_PLANET_SECURE_RUN_ID"]);XCTAssertEqual(run.count,32)
        XCTAssertTrue(try PlanetChildDataStore.fixturePassportUnknown(runId:run))
    }
    func testOriginalDeletionInvocationBindsExactTargetAndCancellation() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.discoveryPassportRemoval("pending"));XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.discoveryPassportRemoval("target"));XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.discoveryPassportRemoval("unknown")) }
    func testCanonicalDeletionPreservesPinAndUsesCorrectActiveSiblingOrNull() throws { for scenario in ["history","active","sibling","last"] { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.discoveryPassportRemoval(scenario),scenario) } }
    func testLastProfileRemovalCanRecreateOnlyThroughOriginalCanonicalAdditionalProfilePath() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.discoveryPassportRemoval("recreate")) }
    @MainActor private func nativeHost() throws -> (WKWebView,PlanetChildPlugin) {
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.first(where:{ $0.activationState == .foregroundActive }) as? UIWindowScene),controller=try XCTUnwrap(scene.windows.first(where:{ $0.isKeyWindow })?.rootViewController as? PlanetBridgeViewController)
        return (try XCTUnwrap(controller.bridge?.webView),try XCTUnwrap(controller.bridge?.plugin(withName:"PlanetChild") as? PlanetChildPlugin))
    }
    private func nativeBase(_ token: String) -> [String:Any] { ["version":2,"requestId":UUID().uuidString.replacingOccurrences(of:"-",with:"").lowercased(),"contextToken":token] }
    @MainActor private func native(_ web: WKWebView,_ method: String,_ request: [String:Any],timeout: TimeInterval=10) async throws -> [String:Any] {
        let json=String(decoding:try JSONSerialization.data(withJSONObject:request,options:[.sortedKeys,.withoutEscapingSlashes]),as:UTF8.self)
        _=try await web.evaluateJavaScript("window.__lpPassportReply=null;window.Capacitor.nativePromise('PlanetChild','\(method)',\(json)).then(value=>window.__lpPassportReply=JSON.stringify(value)).catch(()=>window.__lpPassportReply='{}');'scheduled'")
        let began=Date();while Date().timeIntervalSince(began)<timeout { if let text=try await web.evaluateJavaScript("window.__lpPassportReply") as? String { _=try await web.evaluateJavaScript("delete window.__lpPassportReply");return try XCTUnwrap(JSONSerialization.jsonObject(with:Data(text.utf8)) as? [String:Any]) };try await Task.sleep(nanoseconds:20_000_000) };XCTFail("Original native callback did not settle");throw PlanetChildJourney.Failure.unavailable
    }
    @MainActor private func nativeContext(_ web: WKWebView,_ plugin: PlanetChildPlugin) async throws -> (String,[String:Any]) {
        let boot: [String:Any]
        if let token=plugin.runtimeOriginalContextToken() { boot=try await native(web,"readContext",nativeBase(token)) }
        else { boot=try await native(web,"bootstrap",["version":2,"requestId":UUID().uuidString.replacingOccurrences(of:"-",with:"").lowercased()]) }
        guard boot["status"] as? String=="child" else { throw XCTSkip("NOT_RUN: genuine installed protected child context and reviewed package required") }
        let context=try XCTUnwrap(boot["context"] as? [String:Any]);return (try XCTUnwrap(context["token"] as? String),context)
    }
    @MainActor func testGenuineCountryReadIsNoncreditAndExplicitOpenPersistsAfterRetirement() async throws {
        guard ProcessInfo.processInfo.environment["LITERARY_PLANET_DISCOVERY_PASSPORT_FIXTURE_AVAILABLE"]=="true" else { throw XCTSkip("NOT_RUN: genuine reviewed local child package required") }
        let (web,plugin)=try nativeHost(),(token,context)=try await nativeContext(web,plugin),before=try await native(web,"readPassport",nativeBase(token)),prior=try XCTUnwrap(before["value"] as? [String:Any])
        var home=nativeBase(token);home["reference"]=context["home"];let read=try await native(web,"readEntity",home),payload=try XCTUnwrap((read["value"] as? [String:Any])?["payload"] as? [String:Any]),refs=try XCTUnwrap(payload["references"] as? [[String:Any]])
        guard let country=refs.first(where:{ $0["kind"] as? String=="country" }) else { throw XCTSkip("NOT_RUN: reviewed Home must supply an explicit country reference") }
        var entity=nativeBase(token);entity["reference"]=country;_=try await native(web,"readEntity",entity);let ordinary=try await native(web,"readPassport",nativeBase(token)),unchanged=try XCTUnwrap(ordinary["value"] as? [String:Any])
        XCTAssertEqual((unchanged["revision"] as? NSNumber)?.uint64Value,(prior["revision"] as? NSNumber)?.uint64Value)
        var explicit=nativeBase(token);explicit["reference"]=country
        let opened=try await native(web,"recordCountryOpen",explicit),value=try XCTUnwrap(opened["value"] as? [String:Any]);XCTAssertEqual(opened["status"] as? String,"ok");XCTAssertEqual(value["profileId"] as? String,context["profileId"] as? String);XCTAssertEqual(value["locale"] as? String,context["locale"] as? String)
        XCTAssertEqual((value["revision"] as? NSNumber)?.uint64Value,try XCTUnwrap(prior["revision"] as? NSNumber).uint64Value+1)
        let retired=try await native(web,"retire",nativeBase(token));XCTAssertEqual(retired["status"] as? String,"retired")
        let (fresh,_)=try await nativeContext(web,plugin),reread=try await native(web,"readPassport",nativeBase(fresh)),protected=try XCTUnwrap(reread["value"] as? [String:Any]);XCTAssertNotEqual(fresh,token);XCTAssertEqual((protected["revision"] as? NSNumber)?.uint64Value,(value["revision"] as? NSNumber)?.uint64Value)
        let countries=try XCTUnwrap(protected["countries"] as? [[String:Any]]);XCTAssertTrue(countries.contains(where:{ ($0["reference"] as? [String:Any])?["id"] as? String==country["id"] as? String }));XCTAssertEqual((protected["badges"] as? [String:Any])?["status"] as? String,"unavailable");XCTAssertEqual((protected["downloadedRoutes"] as? [String:Any])?["status"] as? String,"ready")
    }
    @MainActor func testGenuineOriginalParentGateRemovesDedicatedFixtureProfileAndRedactsOrigin() async throws {
        guard ProcessInfo.processInfo.environment["LITERARY_PLANET_DISCOVERY_REMOVAL_OPERATOR_FIXTURE_AVAILABLE"]=="true" else { throw XCTSkip("NOT_RUN: explicit operator-owned expendable fixture and actual original native PIN controls required") }
        let (web,plugin)=try nativeHost(),(token,context)=try await nativeContext(web,plugin),profile=try XCTUnwrap(context["profileId"] as? String),current=try await native(web,"readContext",nativeBase(token)),profiles=try XCTUnwrap(current["profiles"] as? [[String:Any]]),selected=try XCTUnwrap(profiles.first(where:{ $0["id"] as? String==profile }))
        guard (selected["label"] as? String)?.hasPrefix("Native discovery fixture ")==true,try PlanetChildDataStore.fixtureProductionOrigin(profileId:profile,expectRedacted:false) else { throw XCTSkip("NOT_RUN: only a dedicated original-birth fixture profile may be removed by this case") }
        var removal=nativeBase(token);removal["action"]="delete-child-data";removal["target"]=["profileId":profile,"scope":"profile"]
        // Operator must touch Continue and enter the original native Parent PIN.
        // The original absolute deadline remains unchanged; no fake proof/retry.
        let result=try await native(web,"perform",removal,timeout:35);XCTAssertEqual(result["status"] as? String,"adult")
        let retained=try XCTUnwrap(result["profiles"] as? [[String:Any]]);XCTAssertFalse(retained.contains(where:{ $0["id"] as? String==profile }));XCTAssertEqual(Set(retained.compactMap { $0["id"] as? String }),Set(profiles.compactMap { $0["id"] as? String }.filter { $0 != profile }))
        XCTAssertTrue(try PlanetChildDataStore.fixtureProductionOrigin(profileId:nil,expectRedacted:true))
    }
}


extension PlanetChildDiscoveryPassportRuntimeTests {
    func testReviewedProgramUsesSignedExactAudienceAndConfirmedNativeFacts() throws {
        for scenario in ["valid","incomplete","read-only"] { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.passportProgramScenario(scenario),scenario) }
    }
    func testProgramSignatureDomainAndIndependentKeyAdmissionDenyUnknown() throws {
        for scenario in ["wrong-domain","changed-review","unpinned"] { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.passportProgramScenario(scenario),scenario) }
    }
    func testRulesBindExactJourneyGraphOrderedCompletionAndUniqueBadge() throws {
        for scenario in ["subset-rule","duplicate-rule","unknown-node"] { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.passportProgramScenario(scenario),scenario) }
    }
    func testCurrentProgramAgeAndTimeRemainIndependentAdmissionGates() throws {
        for scenario in ["wrong-age","expired-program","award-expiry"] { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.passportProgramScenario(scenario),scenario) }
    }
    func testActualRouteSnapshotContainsFullNestedPayloadClosureAndOpensStoredBytes() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.passportProgramScenario("snapshot")) }
    func testSavedRouteExpiredOrChangedPackageNeverAdvertisesAvailability() throws {
        for scenario in ["expired-route","stale-route"] { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.passportProgramScenario(scenario),scenario) }
    }
    func testSavedSnapshotRejectsCorruptedPayloadAndOrphanGraphRows() throws {
        for scenario in ["tamper","orphan"] { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.passportProgramScenario(scenario),scenario) }
    }
    func testSavedSnapshotRejectsReorderedClosureAndCallerApprovalField() throws {
        for scenario in ["reordered","unknown-snapshot-field"] { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.passportProgramScenario(scenario),scenario) }
    }
    func testOriginalLedgerBytesStayExactBeforeFirstSchema2Mutation() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.passportProgramScenario("legacy")) }
    func testAll32RouteReceiptsRetainArchiveAndDenyAtomicOverflow() throws { XCTAssertTrue(try PlanetChildPassportFixtureBytes.capacity(false));XCTAssertTrue(try PlanetChildPassportFixtureBytes.capacity(true)) }
    func testDownloadsRemovalPreservesLearnedFactsAwardsAndExactSiblingBytes() throws {
        XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.passportProgramScenario("download-clear"));XCTAssertTrue(try PlanetChildDataStore.fixturePassportDownloadsIsolation())
    }
    func testSaveWireAcceptsOnlyNativeResolvedJourneyIdAndPassportRevision() throws {
        let request: [String:Any]=["version":2,"requestId":String(repeating:"1",count:32),"contextToken":String(repeating:"2",count:32),"journeyId":"route-one","expectedRevision":7]
        let decoded=try PlanetChildLocalV2Wire.decode("saveJourneyRoute",request);XCTAssertEqual(decoded.journeyId,"route-one");XCTAssertEqual(decoded.expectedRevision,7)
        for field in ["bytes","base64","url","approved","badgeId","fullRecords"] { var forged=request;forged[field]="caller-value";XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("saveJourneyRoute",forged),field) }
    }
    func testDownloadsRemovalUsesOriginalDeleteChildDataParentActionOnly() throws {
        let request: [String:Any]=["version":2,"requestId":String(repeating:"1",count:32),"contextToken":String(repeating:"2",count:32),"action":"delete-child-data","target":["profileId":"reader","scope":"downloads"]]
        XCTAssertEqual(try PlanetChildLocalV2Wire.decode("perform",request).action,"delete-child-data")
        var forged=request;forged["action"]="delete-downloaded-route";XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("perform",forged))
    }
}

extension PlanetChildDiscoveryPassportRuntimeTests {
    /** AUTHORED_NOT_COMPILED_NOT_RUN. This invokes the production permit path,
     * which pure signed-program and codec fixtures cannot exercise. It needs an
     * operator-owned expendable profile and genuinely admitted installed package. */
    @MainActor func testGenuineEmptyProgramPinsDoNotBlockExplicitLearningCompletion() async throws {
        guard ProcessInfo.processInfo.environment["LITERARY_PLANET_BADGES_DOWNLOADS_OPERATOR_FIXTURE_AVAILABLE"]=="true" else {
            throw XCTSkip("NOT_RUN: dedicated operator-owned installed native badges/downloads fixture required")
        }
        let (web,plugin)=try nativeHost(),(token,context)=try await nativeContext(web,plugin)
        let profile=try XCTUnwrap(context["profileId"] as? String),current=try await native(web,"readContext",nativeBase(token))
        let profiles=try XCTUnwrap(current["profiles"] as? [[String:Any]])
        guard profiles.contains(where:{ $0["id"] as? String==profile && ($0["label"] as? String)?.hasPrefix("Native badges downloads fixture ")==true }) else {
            throw XCTSkip("NOT_RUN: explicit completion may only mutate a dedicated expendable fixture profile")
        }
        let passportReply=try await native(web,"readPassport",nativeBase(token)),passport=try XCTUnwrap(passportReply["value"] as? [String:Any])
        let badges=try XCTUnwrap(passport["badges"] as? [String:Any])
        guard badges["status"] as? String=="unavailable" else { throw XCTSkip("NOT_RUN: this regression requires independently unavailable program admission") }
        let beforePassportRevision=try XCTUnwrap(passport["revision"] as? NSNumber).uint64Value
        let list=try await native(web,"listJourneys",nativeBase(token)),routes=try XCTUnwrap(list["value"] as? [[String:Any]])
        guard let first=routes.first,let journey=first["journeyId"] as? String else { throw XCTSkip("NOT_RUN: current native-reviewed route required") }
        let read=try await native(web,"readJourneyProgress",nativeBase(token)),prior=try XCTUnwrap(read["value"] as? [String:Any])
        var open=nativeBase(token);open["journeyId"]=journey;open["expectedRevision"]=try XCTUnwrap(prior["revision"] as? NSNumber).uint64Value
        let opened=try await native(web,"openJourney",open),value=try XCTUnwrap(opened["value"] as? [String:Any])
        let progress=try PlanetChildJourney.Progress.decodeDTO(try XCTUnwrap(value["progress"]))
        let node=try XCTUnwrap(value["node"] as? [String:Any]),reference=try XCTUnwrap(node["reference"] as? [String:Any])
        guard let currentNode=progress.currentNodeId,let kind=reference["kind"] as? String,["writer","work"].contains(kind) else {
            throw XCTSkip("NOT_RUN: fixture route must have a current writer/work node for explicit learning")
        }
        let revision=try XCTUnwrap(value["revision"] as? NSNumber).uint64Value
        var complete=nativeBase(token);complete["journeyId"]=journey;complete["expectedRevision"]=revision;complete["currentNodeId"]=currentNode;complete["action"]="complete"
        let completed=try await native(web,"advanceJourney",complete)
        XCTAssertEqual(completed["status"] as? String,"ok")
        let result=try XCTUnwrap(completed["value"] as? [String:Any]),confirmed=try PlanetChildJourney.Progress.decodeDTO(try XCTUnwrap(result["progress"]))
        XCTAssertEqual((result["revision"] as? NSNumber)?.uint64Value,revision+1)
        XCTAssertTrue(confirmed.completedNodeIds.contains(currentNode))
        let retired=try await native(web,"retire",nativeBase(token));XCTAssertEqual(retired["status"] as? String,"retired")
        let (fresh,_)=try await nativeContext(web,plugin);XCTAssertNotEqual(fresh,token)
        let restored=try await native(web,"readJourneyProgress",nativeBase(fresh)),stored=try XCTUnwrap(restored["value"] as? [String:Any])
        XCTAssertEqual(try PlanetChildJourney.Progress.decodeDTO(try XCTUnwrap(stored["progress"])),confirmed)
        let reread=try await native(web,"readPassport",nativeBase(fresh)),retained=try XCTUnwrap(reread["value"] as? [String:Any])
        XCTAssertEqual((retained["revision"] as? NSNumber)?.uint64Value,beforePassportRevision+1)
        let facts=try XCTUnwrap(retained[kind=="writer" ? "writers":"works"] as? [[String:Any]])
        XCTAssertTrue(facts.contains(where:{ ($0["reference"] as? [String:Any])?["id"] as? String==currentNode }))
        let unavailable=try XCTUnwrap(retained["badges"] as? [String:Any])
        XCTAssertEqual(unavailable["status"] as? String,"unavailable")
        XCTAssertTrue(try XCTUnwrap(unavailable["items"] as? [[String:Any]]).isEmpty)
    }
}

extension PlanetChildDiscoveryPassportRuntimeTests {
    func testPassportResultCloseDeniesFurtherReadsAndPreservesDetachedRouteBytes() throws {
        XCTAssertTrue(try PlanetChildDataStore.fixturePassportResultLifetime())
    }
}

extension PlanetChildDiscoveryPassportRuntimeTests {
    func testDistinctSignedRereviewPreservesPriorAwardAndCanEarnCurrentReview() throws {
        XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.passportProgramScenario("re-reviewed-program"))
    }
}
