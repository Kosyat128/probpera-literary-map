import Foundation
import CryptoKit
import Security
import XCTest
@testable import App

/** Direct native data candidate and explicit synthetic scope. Each selected
 * phase requires an isolated32-hex run ID; omission fails. write/read may run in
 * separate installed test processes. No simulator/device/authority result is
 * inferred from these sources or from App compilation. */
final class PlanetChildDataStoreRuntimeTests: XCTestCase {
    private let hash = String(repeating:"a",count:64)
    private func scope(_ locale: String) throws -> PlanetChildDataStore.Scope {
        try PlanetChildDataStore.Scope(profileId:"synthetic-child",profileRevision:1,exactAge:9,locale:locale,policyVersion:"synthetic-policy",
            policyChecksum:hash,packageId:"synthetic-package",packageVersion:1,packageChecksum:hash)
    }
    private func key(_ scope: PlanetChildDataStore.Scope, _ purpose: PlanetChildDataStore.Purpose) throws -> String {
        if purpose == .cache || purpose == .offline { return try scope.itemKey(purpose,kind:purpose == .offline ? "offline-package" : "work",id:"synthetic-owned-item") }; return scope.key(purpose)
    }
    private func value(_ purpose: PlanetChildDataStore.Purpose, locale: String) throws -> Data {
        let scope: [String:Any] = ["schemaVersion":1,"namespace":"child","profileId":"synthetic-child","profileRevision":1,"exactAge":9,"locale":locale,
            "policyVersion":"synthetic-policy","policyChecksum":hash,"packageId":"synthetic-package","packageVersion":1,"packageChecksum":hash]
        var object: [String:Any] = ["schemaVersion":1,"scope":scope]
        if purpose == .search || purpose == .history { object["references"] = [Any]() }
        else { object["entries"] = [["reference":["kind":purpose == .offline ? "offline-package" : "work","id":"synthetic-owned-item","contentChecksum":hash],
            "payload":["title":"Synthetic owned data","text":"RU/EN synthetic bytes; no actual editorial approval.","terms":[Any](),"references":[Any]()]]] }
        return try JSONSerialization.data(withJSONObject:object,options:.sortedKeys)
    }
    private func reads(_ scope: PlanetChildDataStore.Scope) throws -> [PlanetChildDataStore.ReadKey] {
        try PlanetChildDataStore.Purpose.allCases.map { PlanetChildDataStore.ReadKey(purpose:$0,key:try key(scope,$0)) }
    }
    private func writes(_ scope: PlanetChildDataStore.Scope, revision: UInt64) throws -> [PlanetChildDataStore.Mutation] {
        try PlanetChildDataStore.Purpose.allCases.map { try PlanetChildDataStore.Mutation(purpose:$0,key:key(scope,$0),expectedRevision:revision,value:value($0,locale:scope.locale)) }
    }
    private func assertAll(_ store: PlanetChildDataStore, _ lease: PlanetChildDataStore.Lease, _ scope: PlanetChildDataStore.Scope, revision: UInt64) throws {
        let result = try store.transact(lease,reads:reads(scope),writes:[],cancellation:store.operation(lease,timeoutMs:15000)); defer { result.dispose() }
        for purpose in PlanetChildDataStore.Purpose.allCases { let slot = try XCTUnwrap(result.get(purpose,key:key(scope,purpose))); XCTAssertEqual(slot.revision,revision)
            var actual = try slot.copyValue(); defer { if actual != nil { let count = actual!.count; actual!.resetBytes(in:0..<count) } }
            if revision == 0 { XCTAssertNil(actual) } else { XCTAssertEqual(actual,try value(purpose,locale:scope.locale)); XCTAssertNotNil(slot.checksum) } }
    }
    func testDurableDataPhase() throws {
        let environment = ProcessInfo.processInfo.environment, runId = try XCTUnwrap(environment["LITERARY_PLANET_CHILD_DATA_TEST_RUN_ID"]), phase = try XCTUnwrap(environment["LITERARY_PLANET_CHILD_DATA_TEST_PHASE"])
        guard runId.range(of:"\\A[a-f0-9]{32}\\z",options:.regularExpression) != nil else { XCTFail("Unowned native child-data fixture"); return }
        let manager = FileManager.default, parent = try manager.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true).resolvingSymlinksInPath().standardizedFileURL
        let name = "literary-planet-child-data-v1-synthetic-" + runId, directory = parent.appendingPathComponent(name,isDirectory:true), record = directory.appendingPathComponent("snapshot-v1")
        let bundle = try XCTUnwrap(Bundle.main.bundleIdentifier); XCTAssertEqual(bundle,"ru.probpera.literaryplanet")
        let keyQuery: [String:Any] = [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:bundle + "." + name,kSecAttrAccount as String:"child-data-aes-v1",kSecAttrSynchronizable as String:false]
        if phase == "clear" {
            XCTAssertEqual(directory.resolvingSymlinksInPath().standardizedFileURL,directory.standardizedFileURL); XCTAssertEqual(directory.deletingLastPathComponent(),parent)
            if manager.fileExists(atPath:directory.path) { for child in ["snapshot-v1","snapshot-v1.new","transaction.lock"] {
                let file = directory.appendingPathComponent(child); XCTAssertEqual(file.resolvingSymlinksInPath().standardizedFileURL,file.standardizedFileURL)
                if manager.fileExists(atPath:file.path) { try manager.removeItem(at:file) } }; try manager.removeItem(at:directory) }
            let status = SecItemDelete(keyQuery as CFDictionary); XCTAssertTrue(status == errSecSuccess || status == errSecItemNotFound); return
        }
        let store = try PlanetChildDataStore.synthetic(runId:runId); defer { do { try store.close() } catch { if !["corrupt","missing-key","missing-cipher"].contains(phase) { XCTFail("Owned candidate cleanup failed") } } }
        let ru = try scope("ru"), lease = try store.activate(ru)
        switch phase {
        case "write":
            // Literal independently generated with JavaScript JSON.stringify full tuple.
            XCTAssertEqual(ru.key(.search),"probpera-child-v1/search/5b312c226368696c64222c2273796e7468657469632d6368696c64222c312c392c227275222c2273796e7468657469632d706f6c696379222c2261616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161222c2273796e7468657469632d7061636b616765222c312c2261616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161225d")
            try assertAll(store,lease,ru,revision:0); let mutations = try writes(ru,revision:0); defer { mutations.forEach { $0.dispose() } }
            let result = try store.transact(lease,reads:[],writes:mutations,cancellation:store.operation(lease,timeoutMs:15000)); result.dispose(); try assertAll(store,lease,ru,revision:1)
            var encrypted = try Data(contentsOf:record); defer { encrypted.resetBytes(in:0..<encrypted.count) }; XCTAssertEqual(encrypted.first,1); XCTAssertGreaterThan(encrypted.count,29)
            XCTAssertFalse(String(decoding:encrypted,as:UTF8.self).contains("Synthetic owned data"))
        case "read": try assertAll(store,lease,ru,revision:1)
        case "atomic":
            try assertAll(store,lease,ru,revision:1); var wrong = try writes(ru,revision:1); wrong[3].dispose(); wrong[3] = try PlanetChildDataStore.Mutation(purpose:.offline,key:key(ru,.offline),expectedRevision:0,value:value(.offline,locale:"ru"))
            defer { wrong.forEach { $0.dispose() } }; XCTAssertThrowsError(try store.transact(lease,reads:[],writes:wrong,cancellation:store.operation(lease,timeoutMs:15000))); try assertAll(store,lease,ru,revision:1)
            let cancelled = try store.operation(lease,timeoutMs:15000); try store.cancel(cancelled); let unchanged = try writes(ru,revision:1); defer { unchanged.forEach { $0.dispose() } }
            XCTAssertThrowsError(try store.transact(lease,reads:[],writes:unchanged,cancellation:cancelled)); try assertAll(store,lease,ru,revision:1)
            let text = String(data:try value(.search,locale:"ru"),encoding:.utf8)!.replacingOccurrences(of:"\"schemaVersion\":1",with:"\"schemaVersion\":1,\"\\u0073chemaVersion\":1")
            let malformed = try PlanetChildDataStore.Mutation(purpose:.search,key:key(ru,.search),expectedRevision:1,value:Data(text.utf8)); defer { malformed.dispose() }
            XCTAssertThrowsError(try store.transact(lease,reads:[],writes:[malformed],cancellation:store.operation(lease,timeoutMs:15000)))
            let invalidUtf8 = try PlanetChildDataStore.Mutation(purpose:.search,key:key(ru,.search),expectedRevision:1,value:Data([0xc3,0x28])); defer { invalidUtf8.dispose() }
            XCTAssertThrowsError(try store.transact(lease,reads:[],writes:[invalidUtf8],cancellation:store.operation(lease,timeoutMs:15000))); try assertAll(store,lease,ru,revision:1)
            let group = DispatchGroup(), lock = NSLock(); var winners = 0, unexpected = false
            for _ in 0..<2 { group.enter(); DispatchQueue.global().async {
                do { let mutations = try self.writes(ru,revision:1); defer { mutations.forEach { $0.dispose() } }; let result = try store.transact(lease,reads:[],writes:mutations,cancellation:store.operation(lease,timeoutMs:15000)); result.dispose(); lock.lock(); winners += 1; lock.unlock() }
                catch PlanetChildDataStore.Failure.unavailable {} catch { lock.lock(); unexpected = true; lock.unlock() }; group.leave()
            } }; XCTAssertEqual(group.wait(timeout:.now()+30),.success); lock.lock(); let count = winners, failed = unexpected; lock.unlock(); XCTAssertFalse(failed); XCTAssertEqual(count,1); try assertAll(store,lease,ru,revision:2)
        case "retire":
            let old = try store.operation(lease,timeoutMs:15000); try store.retire(lease); let enScope = try scope("en"), en = try store.activate(enScope)
            XCTAssertThrowsError(try store.transact(lease,reads:reads(ru),writes:[],cancellation:old)); try assertAll(store,en,enScope,revision:0)
            let again = try store.activate(ru); XCTAssertThrowsError(try store.operation(lease,timeoutMs:15000))
            let second = try PlanetChildDataStore.synthetic(runId:runId), external = try second.activate(ru); defer { try? second.close() }
            XCTAssertThrowsError(try store.operation(again,timeoutMs:15000)); try second.close(); XCTAssertThrowsError(try second.operation(external,timeoutMs:15000))
        case "corrupt":
            var bytes = try Data(contentsOf:record); bytes[bytes.count-1] ^= 1; defer { bytes.resetBytes(in:0..<bytes.count) }; try bytes.write(to:record,options:.completeFileProtection)
            XCTAssertThrowsError(try store.operation(lease,timeoutMs:15000)); XCTAssertThrowsError(try PlanetChildDataStore.synthetic(runId:runId))
        case "missing-key":
            XCTAssertEqual(SecItemDelete(keyQuery as CFDictionary),errSecSuccess); XCTAssertThrowsError(try store.operation(lease,timeoutMs:15000)); XCTAssertThrowsError(try PlanetChildDataStore.synthetic(runId:runId))
        case "missing-cipher":
            try manager.removeItem(at:record); XCTAssertThrowsError(try PlanetChildDataStore.synthetic(runId:runId))
        default: XCTFail("Unknown explicitly selected native child-data phase")
        }
        if !["corrupt","missing-key","missing-cipher"].contains(phase) { try store.close(); XCTAssertThrowsError(try store.operation(lease,timeoutMs:15000)) }
    }
    private func bootstrapRunId(_ suffix: String) throws -> String {
        let environment=ProcessInfo.processInfo.environment,runId=try XCTUnwrap(environment["LITERARY_PLANET_CHILD_DATA_TEST_RUN_ID"])
        guard environment["LITERARY_PLANET_CHILD_DATA_TEST_PHASE"]=="local-v2-bootstrap",runId.range(of:"\\A[a-f0-9]{32}\\z",options:.regularExpression) != nil else { throw PlanetChildDataStore.Failure.unavailable };return String(runId.prefix(30))+suffix
    }
    private func bootstrapFiles(_ runId: String) throws -> (directory: URL,record: URL,query: [String:Any]) {
        let parent=try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true).resolvingSymlinksInPath().standardizedFileURL
        let name="literary-planet-child-data-v1-synthetic-"+runId,directory=parent.appendingPathComponent(name,isDirectory:true),bundle=try XCTUnwrap(Bundle.main.bundleIdentifier);XCTAssertEqual(bundle,"ru.probpera.literaryplanet")
        return (directory,directory.appendingPathComponent("snapshot-v1"),[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:bundle+"."+name,kSecAttrAccount as String:"child-data-aes-v1",kSecAttrSynchronizable as String:kSecAttrSynchronizableAny])
    }
    func testLocalV2DataBirthWithoutOriginalOwnerPermitHasNoKeyOrRecordFootprint() throws {
        let id=try bootstrapRunId("b1"),files=try bootstrapFiles(id);XCTAssertFalse(FileManager.default.fileExists(atPath:files.directory.path));XCTAssertEqual(SecItemCopyMatching(files.query as CFDictionary,nil),errSecItemNotFound)
        let plan=try PlanetChildDataStore.fixtureLocalV2BirthPlan(runId:id,nonce:id);defer { plan.close() };XCTAssertThrowsError(try PlanetChildDataStore.localV2Birth(plan,permit:nil))
        XCTAssertFalse(FileManager.default.fileExists(atPath:files.directory.path));XCTAssertEqual(SecItemCopyMatching(files.query as CFDictionary,nil),errSecItemNotFound)
    }
    func testLocalV2ExistingOnlyMissingStoreCannotCreateAesKeyOrSnapshot() throws {
        let id=try bootstrapRunId("b2"),files=try bootstrapFiles(id);XCTAssertFalse(FileManager.default.fileExists(atPath:files.directory.path));XCTAssertEqual(SecItemCopyMatching(files.query as CFDictionary,nil),errSecItemNotFound)
        XCTAssertThrowsError(try PlanetChildDataStore.fixtureLocalV2ExistingOnly(runId:id));XCTAssertFalse(FileManager.default.fileExists(atPath:files.record.path));XCTAssertEqual(SecItemCopyMatching(files.query as CFDictionary,nil),errSecItemNotFound)
    }
    func testLocalV2ExistingOnlyOrphanBirthClaimRemainsFailClosedAndUnmodified() throws {
        let id=try bootstrapRunId("b3"),files=try bootstrapFiles(id);XCTAssertFalse(FileManager.default.fileExists(atPath:files.directory.path));try FileManager.default.createDirectory(at:files.directory,withIntermediateDirectories:false)
        let claim=files.directory.appendingPathComponent("local-v2-birth.claim"),original=Data("unknown-original-key-birth-claim-retained".utf8);try original.write(to:claim,options:.withoutOverwriting)
        XCTAssertThrowsError(try PlanetChildDataStore.fixtureLocalV2ExistingOnly(runId:id));XCTAssertEqual(try Data(contentsOf:claim),original);XCTAssertFalse(FileManager.default.fileExists(atPath:files.record.path));XCTAssertEqual(SecItemCopyMatching(files.query as CFDictionary,nil),errSecItemNotFound)
    }
    func testLocalV2ExistingOnlyMissingAesDoesNotRebirthOrReplaceOriginalCipher() throws {
        let id=try bootstrapRunId("b4"),files=try bootstrapFiles(id);XCTAssertFalse(FileManager.default.fileExists(atPath:files.directory.path));let fixture=try PlanetChildDataStore.synthetic(runId:id);try fixture.close()
        let original=try Data(contentsOf:files.record);XCTAssertEqual(SecItemDelete(files.query as CFDictionary),errSecSuccess)
        XCTAssertThrowsError(try PlanetChildDataStore.fixtureLocalV2ExistingOnly(runId:id));XCTAssertEqual(SecItemCopyMatching(files.query as CFDictionary,nil),errSecItemNotFound);XCTAssertEqual(try Data(contentsOf:files.record),original)
    }

}

/** AUTHORED_NOT_RUN. These codec/ownership refusals do not manufacture opaque
 * admission, original native PIN transfer, hardware key or durable known birth. */
extension PlanetChildDataStoreRuntimeTests {
    func testProfileEntryPreservesOtherProfileKeyValueRevisionAndSealBytes() throws { XCTAssertTrue(try PlanetChildDataStore.fixtureProfileEntrySeals("retained")) }
    func testProfileEntryRejectsOrphanSealContentSubstitutionAndUnsealedRegistryProfile() throws { XCTAssertTrue(try PlanetChildDataStore.fixtureProfileEntrySeals("orphan")) }
    func testProfileEntryRequiresOwnExistingSealAndNeverReusesItForCreation() throws { XCTAssertTrue(try PlanetChildDataStore.fixtureProfileEntrySeals("nonreuse")) }
    func testProfileEntryPendingMigrationSurvivesCodecWithoutDeletingOriginalData() throws {
        XCTAssertTrue(try PlanetChildDataStore.fixtureProfileEntrySeals("pending"))
        let id=try bootstrapRunId("b7"),files=try bootstrapFiles(id),store=try PlanetChildDataStore.synthetic(runId:id);try store.close()
        let original=try Data(contentsOf:files.record),pending=files.directory.appendingPathComponent("local-v2-migration.pending"),bytes=Data("unknown-migration-cannot-be-adopted".utf8);try bytes.write(to:pending,options:.withoutOverwriting)
        XCTAssertThrowsError(try PlanetChildDataStore.fixtureLocalV2ExistingOnly(runId:id));XCTAssertEqual(try Data(contentsOf:pending),bytes);XCTAssertEqual(try Data(contentsOf:files.record),original)
    }
    func testLocalV2ClaimOnlyCannotReopenOrAdoptExistingEncryptedDataStore() throws {
        let id=try bootstrapRunId("b5"),files=try bootstrapFiles(id),store=try PlanetChildDataStore.synthetic(runId:id);try store.close()
        let original=try Data(contentsOf:files.record),claim=files.directory.appendingPathComponent("local-v2-birth.claim"),marker=Data("unknown-birth-claim-does-not-prove-original-terminal".utf8);try marker.write(to:claim,options:.withoutOverwriting)
        XCTAssertThrowsError(try PlanetChildDataStore.fixtureLocalV2KnownExistingOnly(runId:id));XCTAssertEqual(try Data(contentsOf:claim),marker);XCTAssertEqual(try Data(contentsOf:files.record),original)
    }
    func testLocalV2PendingKnownReceiptRemainsFailClosedAndBytePreserved() throws {
        let id=try bootstrapRunId("b6"),files=try bootstrapFiles(id),store=try PlanetChildDataStore.synthetic(runId:id);try store.close()
        let original=try Data(contentsOf:files.record),pending=files.directory.appendingPathComponent("local-v2-birth.receipt.new"),bytes=Data("pending-original-known-terminal-must-not-be-adopted".utf8);try bytes.write(to:pending,options:.withoutOverwriting)
        XCTAssertThrowsError(try PlanetChildDataStore.fixtureLocalV2KnownExistingOnly(runId:id));XCTAssertEqual(try Data(contentsOf:pending),bytes);XCTAssertEqual(try Data(contentsOf:files.record),original)
    }
}


/** AUTHORED_NOT_RUN. LPC2 codec and isolated native file refusal mechanics;
 * no synthetic fixture provides a production birth receipt or admission. */
extension PlanetChildDataStoreRuntimeTests {
    func testLocalV2AppCollectionTrailerKeepsLegacyBytesAndInactiveProfiles() throws { XCTAssertTrue(try PlanetChildDataStore.fixtureSDKCollections("trailer")) }
    func testLocalV2AppCollectionTombstonesAdvanceRemovalAndReAddCAS() throws { XCTAssertTrue(try PlanetChildDataStore.fixtureSDKCollections("tombstone")) }
    func testLocalV2AppCollectionPendingDeniesUnknownReopen() throws {
        let id=try bootstrapRunId("c1"),files=try bootstrapFiles(id),store=try PlanetChildDataStore.synthetic(runId:id);try store.close();let original=try Data(contentsOf:files.record),pending=files.directory.appendingPathComponent("local-v2-collection.pending"),bytes=Data("unknown-original-command-retirement-retained".utf8);try bytes.write(to:pending,options:.withoutOverwriting)
        XCTAssertThrowsError(try PlanetChildDataStore.fixtureLocalV2ExistingOnly(runId:id));XCTAssertEqual(try Data(contentsOf:pending),bytes);XCTAssertEqual(try Data(contentsOf:files.record),original)
    }
}

/** Authored local synthetic codec/retirement tests, never installed OS acceptance. */
extension PlanetChildDataStoreRuntimeTests {
    func testParentExportEmptySelectedSnapshotHasSharedAndroidGolden() throws {
        var bytes=try PlanetChildDataStore.fixtureParentExportBytes(populated:false);defer { bytes.resetBytes(in:0..<bytes.count) }
        let golden=#"{"appearance":{"revision":0,"selection":null},"collections":{"favorites":{"references":[],"revision":0},"offline":{"references":[],"revision":0},"recent":{"references":[],"revision":0},"search":{"references":[],"revision":0}},"downloads":{"objects":[],"routes":[]},"format":"literary-planet-child-personal-data","journeys":{"activeJourneyId":null,"progress":[],"revision":0},"passport":{"awards":[],"completedJourneys":[],"countries":[],"credits":[],"revision":0,"routes":[]},"profile":{"ageBand":"9-11","ageConfirmedAt":"2026-10-01T00:00:00.000Z","allowedTopics":null,"blockedTopics":[],"exactAge":9,"id":"fixture-reader-one","label":"Читатель","locale":"ru","localeLocked":false,"motion":"calm","narrationEnabled":false,"readingLevel":"plain","soundEnabled":false},"schemaVersion":1}"#;XCTAssertEqual(String(decoding:bytes,as:UTF8.self),golden);XCTAssertEqual(bytes.count,793)
        XCTAssertEqual(SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined(),"d33055e464252f3ac33b17592291bec577872139a194e3e776ce25642de20331")
    }
    func testParentExportProjectionIncludesSemanticsAndExcludesSiblingAndLicensedBody() throws {
        var bytes=try PlanetChildDataStore.fixtureParentExportBytes(populated:true),again=try PlanetChildDataStore.fixtureParentExportBytes(populated:true);defer { bytes.resetBytes(in:0..<bytes.count);again.resetBytes(in:0..<again.count) };XCTAssertEqual(bytes,again)
        let root=try JSONSerialization.jsonObject(with:bytes) as! [String:Any],collections=root["collections"] as! [String:Any],favorites=collections["favorites"] as! [String:Any];XCTAssertEqual(root.count,8);XCTAssertEqual((root["profile"] as! [String:Any])["id"] as? String,"fixture-reader-one");XCTAssertEqual(favorites["revision"] as? Int,5);XCTAssertEqual((favorites["references"] as! [[String:Any]])[0]["id"] as? String,"favorite-one")
        XCTAssertEqual((root["appearance"] as! [String:Any])["revision"] as? Int,5);XCTAssertEqual((root["journeys"] as! [String:Any])["revision"] as? Int,7);let passport=root["passport"] as! [String:Any];XCTAssertEqual(passport["revision"] as? Int,3);XCTAssertEqual((passport["credits"] as! [Any]).count,2);XCTAssertEqual((passport["completedJourneys"] as! [Any]).count,1);let route=(passport["routes"] as! [[String:Any]])[0];XCTAssertEqual(route.count,6);XCTAssertGreaterThan(route["bytes"] as! Int,0);XCTAssertEqual((route["sha256"] as! String).count,64);XCTAssertNil(route["snapshot"]);XCTAssertNil(route["url"])
        let text=String(decoding:bytes,as:UTF8.self);for forbidden in ["fixture-reader-two","LICENSED-BODY-SENTINEL","\"pin\"","\"verifier\"","\"salt\"","\"kdf\"","\"attemptJournal\"","\"contextToken\"","http://","https://","\"payload\""] { XCTAssertFalse(text.contains(forbidden),forbidden) }
    }
    func testParentExportSiblingWritesKeepDigestButSelectedRevisionChangesIt() throws {
        XCTAssertTrue(try PlanetChildDataStore.fixtureParentExportScenario("isolation"));XCTAssertTrue(try PlanetChildDataStore.fixtureParentExportScenario("revision-digest"))
    }
    func testParentExportCorruptSnapshotAndProfileSecretsHaveNoEmptyFallback() throws {
        XCTAssertTrue(try PlanetChildDataStore.fixtureParentExportScenario("corrupt"));XCTAssertTrue(try PlanetChildDataStore.fixtureParentExportScenario("no-secret-profile"))
    }
    func testParentExportReadbackRejectsPartialExtraChangedCancelledAndRetiredOriginal() throws {
        for scenario in ["complete","partial","extra","digest","cancel","zero-read","expiry-replay","readonly-action"] { XCTAssertTrue(try PlanetChildParentExportCodec.fixtureReadback(scenario),scenario) }
    }
    func testParentExportWrongPINRetainsNativeAttemptDebtWithoutPermission() {
        let joined=expectation(description:"synthetic original mismatch terminal joined")
        DispatchQueue.global().async { defer { joined.fulfill() };do { let value=try PlanetChildLocalPinOperationRuntimeFixture.run(.mismatch);XCTAssertTrue(value.passed);XCTAssertFalse(value.matched);XCTAssertTrue(value.replyKnown);XCTAssertEqual(value.count,1);XCTAssertFalse(value.pending) } catch { XCTFail(String(describing:error)) } };wait(for:[joined],timeout:10)
    }
    func testParentExportCrashResidueRetiresFixedFileAndDeniesUnknownSiblingFile() {
        let joined=expectation(description:"native fixed-file residue cleanup joined")
        DispatchQueue.global().async { defer { joined.fulfill() };do {
            let root=FileManager.default.temporaryDirectory.appendingPathComponent("synthetic-parent-export-"+UUID().uuidString,isDirectory:true);try FileManager.default.createDirectory(at:root,withIntermediateDirectories:false);defer { try? FileManager.default.removeItem(at:root) }
            let owned=root.appendingPathComponent("literary-planet-child-export-"+String(repeating:"a",count:32),isDirectory:true);try FileManager.default.createDirectory(at:owned,withIntermediateDirectories:false);try Data("synthetic-private-bytes".utf8).write(to:owned.appendingPathComponent("child-personal-data.json"));try PlanetChildParentExportFiles.cleanResidue(root);XCTAssertFalse(FileManager.default.fileExists(atPath:owned.path))
            try FileManager.default.createDirectory(at:owned,withIntermediateDirectories:false);let other=owned.appendingPathComponent("unexpected-file");try Data("preserve-unknown".utf8).write(to:other);XCTAssertThrowsError(try PlanetChildParentExportFiles.cleanResidue(root));XCTAssertEqual(try Data(contentsOf:other),Data("preserve-unknown".utf8))
        } catch { XCTFail(String(describing:error)) } };wait(for:[joined],timeout:10)
    }
    func testParentExportCrashResidueExcessIsNotPartiallySwept() {
        let joined=expectation(description:"bounded residue refusal joined")
        DispatchQueue.global().async { defer { joined.fulfill() };do {
            let root=FileManager.default.temporaryDirectory.appendingPathComponent("synthetic-parent-export-bound-"+UUID().uuidString,isDirectory:true);try FileManager.default.createDirectory(at:root,withIntermediateDirectories:false);defer { try? FileManager.default.removeItem(at:root) }
            for index in 0..<33 { let name="literary-planet-child-export-"+String(format:"%032x",index);try FileManager.default.createDirectory(at:root.appendingPathComponent(name,isDirectory:true),withIntermediateDirectories:false) }
            XCTAssertThrowsError(try PlanetChildParentExportFiles.cleanResidue(root));XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath:root.path).count,33)
        } catch { XCTFail(String(describing:error)) } };wait(for:[joined],timeout:10)
    }
}
