import Foundation
import Security
import CryptoKit
import XCTest
@testable import App

/** Explicit installed native candidate test, never a default synthetic PASS.
 * Requires a fresh owned fixture nonce and phase=wire. This source is not proof
 * of native execution, a process restart, protected admission or App wiring.
 */
final class PlanetChildDataTransportRuntimeTests: XCTestCase {
    private let hash = String(repeating: "a", count: 64)
    private final class ReplyBox {
        private let lock = NSLock(); private var value: [String: Any]?
        func set(_ value: [String: Any]) { lock.lock(); self.value = value; lock.unlock() }
        func get() -> [String: Any]? { lock.lock(); defer { lock.unlock() }; return value }
    }
    private func call(_ transport: PlanetChildDataTransport, _ method: String, _ request: [String: Any]) throws -> [String: Any] {
        let done = expectation(description: method), box = ReplyBox()
        let reply: PlanetChildDataTransport.Reply = { box.set($0); done.fulfill() }
        switch method {
        case "activate": transport.activate(request, reply: reply)
        case "transact": transport.transact(request, reply: reply)
        case "retire": transport.retire(request, reply: reply)
        case "cancel": transport.cancel(request, reply: reply)
        case "close": transport.close(request, reply: reply)
        default: XCTFail("Unknown private native wire method")
        }
        wait(for: [done], timeout: 30); return try XCTUnwrap(box.get())
    }
    private func digest(_ bytes: Data) -> String { SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined() }
    private func scopeDTO() -> [String: Any] {
        ["schemaVersion": 1, "namespace": "child", "profileId": "synthetic-child", "profileRevision": 1, "exactAge": 9, "locale": "ru",
         "policyVersion": "synthetic-policy", "policyChecksum": hash, "packageId": "synthetic-package", "packageVersion": 1, "packageChecksum": hash]
    }
    private func scope() throws -> PlanetChildDataStore.Scope {
        try PlanetChildDataStore.Scope(profileId: "synthetic-child", profileRevision: 1, exactAge: 9, locale: "ru", policyVersion: "synthetic-policy",
            policyChecksum: hash, packageId: "synthetic-package", packageVersion: 1, packageChecksum: hash)
    }
    private func key(_ purpose: PlanetChildDataStore.Purpose, id: String = "synthetic-owned-item") throws -> String {
        let scope = try scope()
        if purpose == .search || purpose == .history { return scope.key(purpose) }
        return try scope.itemKey(purpose, kind: purpose == .offline ? "offline-package" : "work", id: id)
    }
    private func payload(_ purpose: PlanetChildDataStore.Purpose, id: String = "synthetic-owned-item") throws -> Data {
        var object: [String: Any] = ["schemaVersion": 1, "scope": scopeDTO()]
        if purpose == .search || purpose == .history { object["references"] = [Any]() }
        else { object["entries"] = [["reference": ["kind": purpose == .offline ? "offline-package" : "work", "id": id, "contentChecksum": hash],
            "payload": ["title": "Owned native wire fixture", "text": "Synthetic RU/EN bytes; no editorial approval.", "terms": [Any](), "references": [Any]()]]] }
        return try JSONSerialization.data(withJSONObject: object, options: .sortedKeys)
    }
    private func write(_ purpose: PlanetChildDataStore.Purpose, revision: Int = 0, id: String = "synthetic-owned-item") throws -> [String: Any] {
        var bytes = try payload(purpose, id: id); defer { bytes.resetBytes(in: 0..<bytes.count) }
        return ["purpose": purpose.rawValue, "key": try key(purpose, id: id), "expectedRevision": revision, "base64": bytes.base64EncodedString(), "checksum": digest(bytes)]
    }
    private func bound(_ activation: [String: Any], id: String) throws -> [String: Any] {
        var row = activation; row.removeValue(forKey: "status"); row["requestId"] = id; row["timeoutMs"] = 15000
        XCTAssertEqual(Set(row.keys), Set(["version", "requestId", "timeoutMs", "ownerToken", "leaseToken", "scope", "generation", "nonce"])); return row
    }
    private func assertUnavailable(_ response: [String: Any], id: String) {
        XCTAssertEqual(Set(response.keys), Set(["version", "requestId", "status"])); XCTAssertEqual(response["requestId"] as? String, id); XCTAssertEqual(response["status"] as? String, "unavailable")
    }
    func testPrivateTransportPhase() throws {
        let environment = ProcessInfo.processInfo.environment
        let runId = try XCTUnwrap(environment["LITERARY_PLANET_CHILD_TRANSPORT_TEST_RUN_ID"])
        XCTAssertEqual(environment["LITERARY_PLANET_CHILD_TRANSPORT_TEST_PHASE"], "wire")
        guard environment["LITERARY_PLANET_CHILD_TRANSPORT_TEST_PHASE"] == "wire", runId.range(of: "\\A[a-f0-9]{32}\\z", options: .regularExpression) != nil else { XCTFail("Unowned native transport fixture"); return }
        let manager = FileManager.default, parent = try manager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).resolvingSymlinksInPath().standardizedFileURL
        let name = "literary-planet-child-data-v1-synthetic-" + runId, directory = parent.appendingPathComponent(name, isDirectory: true)
        let bundle = try XCTUnwrap(Bundle.main.bundleIdentifier); XCTAssertEqual(bundle, "ru.probpera.literaryplanet")
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: bundle + "." + name,
            kSecAttrAccount as String: "child-data-aes-v1", kSecAttrSynchronizable as String: false]
        guard directory.resolvingSymlinksInPath().standardizedFileURL == directory.standardizedFileURL, directory.deletingLastPathComponent() == parent,
              !manager.fileExists(atPath: directory.path), SecItemCopyMatching(query as CFDictionary, nil) == errSecItemNotFound else { XCTFail("Native fixture is not fresh and owned"); return }
        var cleanupAllowed = false
        defer {
            // Cleanup only after actual final closed ACK. A timeout preserves the
            // fixture for inspection; it never deletes files of a held native job.
            if cleanupAllowed {
                do {
                    guard directory.resolvingSymlinksInPath().standardizedFileURL == directory.standardizedFileURL else { throw PlanetChildDataStore.Failure.unavailable }
                    let allowed = Set(["snapshot-v1", "snapshot-v1.new", "transaction.lock"])
                    guard Set(try manager.contentsOfDirectory(atPath: directory.path)).isSubset(of: allowed) else { throw PlanetChildDataStore.Failure.unavailable }
                    for child in ["snapshot-v1", "snapshot-v1.new", "transaction.lock"] {
                        let file = directory.appendingPathComponent(child)
                        guard file.resolvingSymlinksInPath().standardizedFileURL == file.standardizedFileURL else { throw PlanetChildDataStore.Failure.unavailable }
                        if manager.fileExists(atPath: file.path) {
                            guard try manager.attributesOfItem(atPath: file.path)[.type] as? FileAttributeType == .typeRegular else { throw PlanetChildDataStore.Failure.unavailable }
                            try manager.removeItem(at: file)
                        }
                    }
                    try manager.removeItem(at: directory); let status = SecItemDelete(query as CFDictionary); XCTAssertTrue(status == errSecSuccess || status == errSecItemNotFound)
                } catch { XCTFail("Exact owned native transport cleanup failed") }
            }
        }
        var counter: UInt64 = 0
        func nextId() -> String { counter += 1; return String(format: "%032llx", counter) }
        let transport = try PlanetChildDataTransport(store: PlanetChildDataStore.synthetic(runId: runId))
        let activationId = nextId(), activate: [String: Any] = ["version": 1, "requestId": activationId, "timeoutMs": 15000, "ownerToken": NSNull(), "scope": scopeDTO()]
        let activation = try call(transport, "activate", activate); XCTAssertEqual(activation["status"] as? String, "partitioned")
        XCTAssertNotNil((activation["ownerToken"] as? String)?.range(of: "\\A[a-f0-9]{32}\\z", options: .regularExpression))
        XCTAssertNotNil((activation["nonce"] as? String)?.range(of: "\\A[a-f0-9]{32}\\z", options: .regularExpression))
        var replay = activate; replay["ownerToken"] = activation["ownerToken"]; assertUnavailable(try call(transport, "activate", replay), id: activationId)
        var invalid = activate; let boolId = nextId(); invalid["requestId"] = boolId; invalid["version"] = true
        assertUnavailable(try call(transport, "activate", invalid), id: boolId)
        let unknownId = nextId(); invalid = activate; invalid["requestId"] = unknownId; invalid["unexpected"] = 1
        assertUnavailable(try call(transport, "activate", invalid), id: unknownId)
        let purposes = PlanetChildDataStore.Purpose.allCases, reads = try purposes.map { ["purpose": $0.rawValue, "key": try key($0)] }
        let overtakenId = nextId(), cancelId = nextId()
        let cancellation = try call(transport, "cancel", ["version": 1, "requestId": cancelId, "targetRequestId": overtakenId])
        XCTAssertEqual(cancellation["status"] as? String, "cancellation-requested"); XCTAssertEqual(cancellation["targetRequestId"] as? String, overtakenId)
        var request = try bound(activation, id: overtakenId); request["reads"] = [Any](); request["writes"] = try purposes.map { try write($0) }
        assertUnavailable(try call(transport, "transact", request), id: overtakenId)
        let writeId = nextId(); request = try bound(activation, id: writeId); request["reads"] = [Any](); request["writes"] = try purposes.map { try write($0) }
        XCTAssertEqual(try call(transport, "transact", request)["status"] as? String, "committed")
        XCTAssertEqual(try call(transport, "cancel", ["version": 1, "requestId": nextId(), "targetRequestId": writeId])["status"] as? String, "cancellation-requested")
        let deniedId = nextId(); request = try bound(activation, id: deniedId); request["reads"] = [Any](); request["writes"] = [try write(.search)]
        assertUnavailable(try call(transport, "transact", request), id: deniedId) // actual CAS revision0 vs1
        let checksumId = nextId(); request = try bound(activation, id: checksumId); request["reads"] = [Any](); var bad = try write(.search, revision: 1); bad["checksum"] = hash; request["writes"] = [bad]
        assertUnavailable(try call(transport, "transact", request), id: checksumId)
        let base64Id = nextId(); request = try bound(activation, id: base64Id); request["reads"] = [Any](); bad = try write(.search, revision: 1); bad["base64"] = "YQ"; request["writes"] = [bad]
        assertUnavailable(try call(transport, "transact", request), id: base64Id)
        let scopeId = nextId(); request = try bound(activation, id: scopeId); var wrongScope = scopeDTO(); wrongScope["locale"] = "en"; request["scope"] = wrongScope; request["reads"] = reads; request["writes"] = [Any]()
        assertUnavailable(try call(transport, "transact", request), id: scopeId)
        let oversizedId = nextId(); request = try bound(activation, id: oversizedId)
        request["reads"] = try (0..<33).map { ["purpose": "cache", "key": try key(.cache, id: "synthetic-read-\($0)")] }
        request["writes"] = try (0..<32).map { try write(.cache, id: "synthetic-write-\($0)") }
        assertUnavailable(try call(transport, "transact", request), id: oversizedId)
        request = try bound(activation, id: nextId()); request["reads"] = reads; request["writes"] = [Any]()
        let roundtrip = try call(transport, "transact", request), slots = try XCTUnwrap(roundtrip["slots"] as? [[String: Any]])
        XCTAssertEqual(roundtrip["status"] as? String, "committed"); XCTAssertEqual(slots.count, 4)
        for (index, purpose) in purposes.enumerated() {
            XCTAssertEqual((slots[index]["revision"] as? NSNumber)?.intValue, 1)
            let encoded = try XCTUnwrap(slots[index]["base64"] as? String); var bytes = try XCTUnwrap(Data(base64Encoded: encoded)); defer { bytes.resetBytes(in: 0..<bytes.count) }
            XCTAssertEqual(bytes, try payload(purpose)); XCTAssertEqual(slots[index]["checksum"] as? String, digest(bytes))
        }
        let retired = try call(transport, "retire", bound(activation, id: nextId())); XCTAssertEqual(retired["status"] as? String, "retired")
        let staleId = nextId(); request = try bound(activation, id: staleId); request["reads"] = reads; request["writes"] = [Any](); assertUnavailable(try call(transport, "transact", request), id: staleId)
        XCTAssertEqual(try call(transport, "close", ["version": 1, "requestId": nextId(), "timeoutMs": 15000, "ownerToken": NSNull()])["status"] as? String, "closed")
        // A fresh native owner reads actual protected OS bytes from the same
        // exact fixture. This is not a process-restart or production profile test.
        let reopened = try PlanetChildDataTransport(store: PlanetChildDataStore.synthetic(runId: runId))
        let again = try call(reopened, "activate", ["version": 1, "requestId": nextId(), "timeoutMs": 15000, "ownerToken": NSNull(), "scope": scopeDTO()])
        request = try bound(again, id: nextId()); request["reads"] = reads; request["writes"] = [Any]()
        let persisted = try call(reopened, "transact", request), persistedSlots = try XCTUnwrap(persisted["slots"] as? [[String: Any]])
        XCTAssertEqual(persistedSlots.count, 4); for slot in persistedSlots { XCTAssertEqual((slot["revision"] as? NSNumber)?.intValue, 1) }
        let final = try call(reopened, "close", ["version": 1, "requestId": nextId(), "timeoutMs": 1, "ownerToken": NSNull()])
        XCTAssertEqual(final["status"] as? String, "closed"); cleanupAllowed = final["status"] as? String == "closed"
    }
}
