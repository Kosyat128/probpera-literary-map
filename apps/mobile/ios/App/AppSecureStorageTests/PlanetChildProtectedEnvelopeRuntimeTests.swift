import Foundation
import CryptoKit
import XCTest
@testable import App

/** Synthetic structural vectors shared with the Android codec tests.
 * These never construct a vault or grant a native checkpoint, permission,
 * trusted clock, installed PIN/recovery proof or child admission. NOT_RUN.
 * Test-target registration and actual iOS execution are separate pending work. */
final class PlanetChildProtectedEnvelopeRuntimeTests: XCTestCase {
    private typealias Envelope = PlanetChildVault.ProtectedEnvelope
    private typealias Action = PlanetChildVault.PinLifecycleAction
    private let version = "synthetic-codec-v1"
    private var policy: String { String(repeating: "a", count: 64) }
    private let boot = "00000000-0000-4000-8000-000000000001"
    private var clock: String {
        #"{"schemaVersion":1,"bootId":"\#(boot)","uptimeAnchorMs":100,"logicalAnchorMs":1000,"epochAnchor":null}"#
    }
    private func sha(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
    private func registry(_ labelToken: String = #""Synthetic Reader""#, _ locale: String = "en") -> String {
        #"{"schemaVersion":1,"policyVersion":"\#(version)","activeProfileId":"synthetic-child","profiles":[{"id":"synthetic-child","label":\#(labelToken),"exactAge":9,"ageBand":"9-11","locale":"\#(locale)","ageConfirmedAt":"2026-10-01T12:00:00.000Z","readingLevel":null,"allowedTopics":null,"blockedTopics":["violence"],"soundEnabled":false,"motion":"calm","narrationEnabled":false}]}"#
    }
    private func pin(_ revision: UInt64, _ credential: String = "e", _ salt: String = "f",
                     _ count: UInt64 = 0, _ blocked: UInt64 = 0, _ observed: UInt64 = 1010,
                     _ pending: String = "null") -> String {
        #"{"schemaVersion":1,"policyVersion":"\#(version)","revision":\#(revision),"credentialId":"\#(String(repeating: credential, count: 64))","verifier":{"algorithm":"PBKDF2-HMAC-SHA256","iterations":600000,"saltHex":"\#(String(repeating: salt, count: 64))","hashHex":"\#(String(repeating: "d", count: 64))"},"attempts":{"count":\#(count),"blockedUntilMs":\#(blocked),"lastObservedMs":\#(observed),"pendingAttemptId":\#(pending)}}"#
    }
    private func envelope(_ revision: UInt64 = 7, _ mode: String = "adult", _ registry: String,
                          _ pin: String = "null", _ clock: String? = nil) -> String {
        #"{"schemaVersion":1,"revision":\#(revision),"mode":"\#(mode)","selectionRevision":3,"profileRevision":2,"policyChecksum":"\#(policy)","registryChecksum":"\#(sha(registry))","registry":\#(registry),"pin":\#(pin),"clock":\#(clock ?? self.clock)}"#
    }
    private func seed(_ locale: String = "en") -> String {
        envelope(7, "adult", registry(locale == "ru" ? #""Синтетический читатель""# : #""Synthetic Reader""#, locale))
    }
    private func record() -> String {
        envelope(7, "adult", registry(), pin(5, "b", "c", 2, 1050, 1000, #""\#(String(repeating: "f", count: 64))""#))
    }
    private func decode(_ bytes: Data, maximum: UInt64 = 600000) throws -> Envelope {
        try Envelope.decode(bytes, policyVersion: version, policyChecksum: policy, maxIterations: maximum)
    }
    private func decode(_ text: String) throws -> Envelope { try decode(Data(text.utf8)) }
    private func rejected(_ text: String, file: StaticString = #filePath, line: UInt = #line) {
        rejected(Data(text.utf8), file: file, line: line)
    }
    private func rejected(_ bytes: Data, file: StaticString = #filePath, line: UInt = #line) {
        do { let parsed = try decode(bytes); parsed.close(); XCTFail("Malformed structural vector accepted", file: file, line: line) }
        catch PlanetChildVault.Failure.unavailable { }
        catch { XCTFail("Unexpected failure: \(error)", file: file, line: line) }
    }
    private func transition(_ old: String, _ next: String, _ action: Action = .replace,
                            _ logical: UInt64 = 1010, expected: Bool = false,
                            file: StaticString = #filePath, line: UInt = #line) throws {
        let before = try decode(old), after = try decode(next); defer { before.close(); after.close() }
        do { try Envelope.validateTransition(before, after, action: action, sampledLogicalMs: logical)
            XCTAssertTrue(expected, "Transition should have been refused", file: file, line: line)
        } catch PlanetChildVault.Failure.unavailable {
            XCTAssertFalse(expected, "Transition should have been valid", file: file, line: line)
        }
    }

    func testCanonicalRuEnSeedAndEnrolledOwnBytesNoCopyInput() throws {
        for value in [seed("ru"), seed(), record()] {
            let expected = Data(value.utf8)
            let pointer = UnsafeMutableRawPointer.allocate(byteCount: expected.count, alignment: 1)
            defer { pointer.initializeMemory(as: UInt8.self, repeating: 0, count: expected.count); pointer.deallocate() }
            expected.copyBytes(to: pointer.assumingMemoryBound(to: UInt8.self), count: expected.count)
            let supplied = Data(bytesNoCopy: pointer, count: expected.count, deallocator: .none)
            let parsed = try decode(supplied); defer { parsed.close() }
            XCTAssertEqual(parsed.checksum, sha(value))
            XCTAssertEqual(try parsed.isUnenrolled(), value.contains(#""pin":null"#))
            pointer.initializeMemory(as: UInt8.self, repeating: 0, count: expected.count)
            var first = try parsed.copyCanonicalBytes(); XCTAssertEqual(first, expected)
            first.resetBytes(in: 0..<first.count); XCTAssertEqual(try parsed.copyCanonicalBytes(), expected)
            parsed.close(); parsed.close()
            XCTAssertThrowsError(try parsed.copyCanonicalBytes())
            XCTAssertThrowsError(try parsed.isUnenrolled())
        }
    }

    func testExactEnrollReplaceRecoverPinOnlyTransitions() throws {
        for locale in ["ru", "en"] {
            let label = locale == "ru" ? #""Синтетический читатель""# : #""Synthetic Reader""#
            try transition(seed(locale), envelope(8, "adult", registry(label, locale), pin(1)), .enroll, expected: true)
        }
        let rotated = envelope(8, "adult", registry(), pin(6))
        try transition(record(), rotated, .replace, expected: true)
        try transition(record(), rotated, .recover, expected: true)
        try transition(record(), rotated, .enroll)
        try transition(seed(), envelope(8, "adult", registry(), pin(1)), .replace)
        try transition(seed(), envelope(8, "adult", registry(), pin(1)), .recover)
        let childOld = record().replacingOccurrences(of: #""mode":"adult""#, with: #""mode":"child""#)
        let childNext = rotated.replacingOccurrences(of: #""mode":"adult""#, with: #""mode":"child""#)
        try transition(childOld, childNext, .replace, expected: true)
        try transition(childOld, childNext, .recover, expected: true)
        let emptyRegistry = #"{"schemaVersion":1,"policyVersion":"\#(version)","activeProfileId":null,"profiles":[]}"#
        try transition(envelope(7, "adult", emptyRegistry), envelope(8, "adult", emptyRegistry, pin(1)), .enroll, expected: true)
        rejected(envelope(7, "child", emptyRegistry, pin(5)))
        let before = try decode(record()), after = try decode(rotated); defer { before.close(); after.close() }
        before.close(); XCTAssertThrowsError(try Envelope.validateTransition(before, after, action: .replace, sampledLogicalMs: 1010))
    }

    func testRevisionsFreshCredentialSaltAndExactAttemptReset() throws {
        for next in [envelope(7, "adult", registry(), pin(6)), envelope(9, "adult", registry(), pin(6)),
                     envelope(8, "adult", registry(), pin(5)), envelope(8, "adult", registry(), pin(6, "b", "f")),
                     envelope(8, "adult", registry(), pin(6, "e", "c")), envelope(8, "adult", registry(), pin(6, "e", "f", 0, 0, 1009)),
                     envelope(8, "adult", registry(), pin(6, "e", "f", 1, 1050, 1010))] { try transition(record(), next) }
        let rotated = envelope(8, "adult", registry(), pin(6))
        try transition(record(), rotated, .replace, 999)
        try transition(record(), rotated, .replace, 9007199254740992)
        try transition(record().replacingOccurrences(of: #""revision":7,"#, with: #""revision":9007199254740991,"#), rotated)
        try transition(record().replacingOccurrences(of: #""revision":5,"#, with: #""revision":9007199254740991,"#), rotated)
        try transition(seed(), envelope(8, "adult", registry(), pin(2)), .enroll)
    }

    func testAllNonPinFieldsRemainByteExactAndPoliciesMatch() throws {
        let next = envelope(8, "adult", registry(), pin(6))
        for changed in [next.replacingOccurrences(of: #""mode":"adult""#, with: #""mode":"child""#),
                        next.replacingOccurrences(of: #""selectionRevision":3"#, with: #""selectionRevision":4"#),
                        next.replacingOccurrences(of: #""profileRevision":2"#, with: #""profileRevision":3"#),
                        envelope(8, "adult", registry(#""Changed Reader""#), pin(6)),
                        next.replacingOccurrences(of: #""uptimeAnchorMs":100"#, with: #""uptimeAnchorMs":101"#)] { try transition(record(), changed) }
        let before = try decode(record()), after = try decode(Data(next.utf8), maximum: 600001)
        defer { before.close(); after.close() }
        XCTAssertThrowsError(try Envelope.validateTransition(before, after, action: .replace, sampledLogicalMs: 1010))
        let changedPolicy = String(repeating: "f", count: 64)
        let policyNext = try Envelope.decode(Data(next.replacingOccurrences(of: policy, with: changedPolicy).utf8),
            policyVersion: version, policyChecksum: changedPolicy, maxIterations: 600000)
        defer { policyNext.close() }
        XCTAssertThrowsError(try Envelope.validateTransition(before, policyNext, action: .replace, sampledLogicalMs: 1010))
    }

    func testMissingExtraOrderWhitespaceAndNumericAlternativesRejected() {
        let value = seed()
        for bad in ["", "null", value.replacingOccurrences(of: #""pin":null,"#, with: ""),
                    value.replacingOccurrences(of: #""pin":null"#, with: #""pin":{}"#),
                    value.replacingOccurrences(of: #""mode":"adult""#, with: #""mode":"child""#), " " + value, value + "\n",
                    value.replacingOccurrences(of: #""revision":7"#, with: #""revision":7.0"#),
                    value.replacingOccurrences(of: #""revision":7"#, with: #""revision":7e0"#),
                    value.replacingOccurrences(of: #""revision":7"#, with: #""revision":07"#),
                    value.replacingOccurrences(of: #""revision":7"#, with: #""revision":-0"#),
                    value.replacingOccurrences(of: #""revision":7"#, with: #""revision":9007199254740992"#),
                    value.replacingOccurrences(of: #""schemaVersion":1,"#, with: #""schemaVersion":1,"schemaVersion":1,"#),
                    String(value.dropLast()) + #","parentApproved":true}"#,
                    value.replacingOccurrences(of: #""revision":7,"mode":"adult""#, with: #""mode":"adult","revision":7"#)] { rejected(bad) }
        rejected(Data(repeating: 0, count: 131073))
        for scalar in [[UInt8(0xc3), 0x28], [0xed, 0xa0, 0x80], [0xc0, 0xaf], [0xf4, 0x90, 0x80, 0x80]] {
            var malformed = Data(value.utf8)
            let range = malformed.range(of: Data("Synthetic Reader".utf8))!
            malformed.replaceSubrange(range, with: scalar); rejected(malformed)
        }
    }

    func testRegistryShaProfilesDatesTopicsAndAgeBand() throws {
        let single = registry()
        rejected(seed().replacingOccurrences(of: sha(single), with: String(repeating: "f", count: 64)))
        for malformed in [single.replacingOccurrences(of: #""ageBand":"9-11""#, with: #""ageBand":"6-8""#),
                          single.replacingOccurrences(of: #""ageBand":"9-11","#, with: ""),
                          single.replacingOccurrences(of: "2026-10-01", with: "2026-02-30"),
                          single.replacingOccurrences(of: "T12:00:00", with: "T24:00:00"),
                          single.replacingOccurrences(of: #""violence""#, with: #""violence","violence""#),
                          single.replacingOccurrences(of: #""readingLevel":null"#, with: #""readingLevel":"invented""#),
                          single.replacingOccurrences(of: #""activeProfileId":"synthetic-child""#, with: #""activeProfileId":"missing""#),
                          single.replacingOccurrences(of: #""label":"Synthetic Reader""#, with: #""label":" Synthetic Reader""#),
                          single.replacingOccurrences(of: #""label":"Synthetic Reader""#, with: #""label":"Synthetic Reader\t""#),
                          single.replacingOccurrences(of: #""exactAge":9"#, with: #""exactAge":2"#)] { rejected(envelope(7, "adult", malformed)) }
        let leapYearZero = try decode(envelope(7, "adult", single.replacingOccurrences(of: "2026-10-01", with: "0000-02-29")))
        defer { leapYearZero.close() }; XCTAssertTrue(try leapYearZero.isUnenrolled())
    }

    func testCanonicalEcmaStringEscapesAndUtf16Surrogates() throws {
        for label in [#""Читатель😀""#, #""Reader\"\\""#, #""Reader\ud800""#, #""Reader\udfff""#, "\"A\u{2028}B\""] {
            let value = envelope(7, "adult", registry(label, "ru")), parsed = try decode(value)
            defer { parsed.close() }; XCTAssertEqual(try parsed.copyCanonicalBytes(), Data(value.utf8))
        }
        for label in [#""Reader\u0061""#, #""Reader\/""#, #""Reader\uD800""#, #""Reader\ud83d\ude00""#, #""Reader\u2028B""#,
                      #""Reader\ud800\udfff""#, #""Reader\u007f""#] { rejected(envelope(7, "adult", registry(label, "ru"))) }
    }

    func testProfileTopicAndUtf16LabelBounds() throws {
        let single = registry(), first = single.range(of: "[{")!, last = single.range(of: "]}", options: .backwards)!
        let profileStart = single.index(after: first.lowerBound)
        let profile = String(single[profileStart..<last.lowerBound])
        let header = String(single[..<profileStart])
        var profiles: [String] = []
        for index in 0..<5 {
            profiles.append(profile.replacingOccurrences(of: #""id":"synthetic-child""#, with: #""id":"child-\#(index)""#))
            let registry = header.replacingOccurrences(of: #""activeProfileId":"synthetic-child""#, with: #""activeProfileId":"child-0""#)
                + profiles.joined(separator: ",") + "]}"
            if index < 4 { let parsed = try decode(envelope(7, "adult", registry)); parsed.close() }
            else { rejected(envelope(7, "adult", registry)) }
        }
        rejected(envelope(7, "adult", header + profile + "," + profile + "]}"))
        let tooManyTopics = "[" + (0..<65).map { #""topic-\#($0)""# }.joined(separator: ",") + "]"
        rejected(envelope(7, "adult", single.replacingOccurrences(of: #"["violence"]"#, with: tooManyTopics)))
        let maxTopics = "[" + (0..<64).map { #""topic-\#($0)""# }.joined(separator: ",") + "]"
        let atTopicLimit = try decode(envelope(7, "adult", single.replacingOccurrences(of: #"["violence"]"#, with: maxTopics)))
        atTopicLimit.close()
        for label in [String(repeating: "r", count: 80), String(repeating: "😀", count: 40)] {
            let parsed = try decode(envelope(7, "adult", registry("\"" + label + "\""))); parsed.close()
        }
        for label in [String(repeating: "r", count: 81), String(repeating: "😀", count: 41)] {
            rejected(envelope(7, "adult", registry("\"" + label + "\"")))
        }
    }

    func testPinJournalKdfAndClockBounds() throws {
        let value = record()
        for bad in [value.replacingOccurrences(of: "600000", with: "599999"), value.replacingOccurrences(of: "600000", with: "600001"),
                    value.replacingOccurrences(of: "PBKDF2-HMAC-SHA256", with: "SHA256"),
                    value.replacingOccurrences(of: #""lastObservedMs":1000"#, with: #""lastObservedMs":999"#),
                    value.replacingOccurrences(of: #""blockedUntilMs":1050"#, with: #""blockedUntilMs":999"#),
                    value.replacingOccurrences(of: #""count":2"#, with: #""count":0"#), value.replacingOccurrences(of: boot, with: "invalid-boot"),
                    value.replacingOccurrences(of: #""uptimeAnchorMs":100"#, with: #""uptimeAnchorMs":9007199254740992"#),
                    value.replacingOccurrences(of: #""epochAnchor":null"#, with: #""epochAnchor":{"epochAnchorMs":100,"validUntilEpochMs":100,"proofChecksum":"\#(policy)"}"#),
                    value.replacingOccurrences(of: #""epochAnchor":null"#, with: #""epochAnchor":{"epochAnchorMs":8640000000000001,"validUntilEpochMs":8640000000000002,"proofChecksum":"\#(policy)"}"#)] { rejected(bad) }
        XCTAssertThrowsError(try decode(Data(seed().utf8), maximum: 599999))
        XCTAssertThrowsError(try decode(Data(seed().utf8), maximum: 0x100000000))
        let epochRecord = value.replacingOccurrences(of: #""epochAnchor":null"#,
            with: #""epochAnchor":{"epochAnchorMs":100,"validUntilEpochMs":101,"proofChecksum":"\#(policy)"}"#)
        let parsed = try decode(epochRecord); defer { parsed.close() }
        XCTAssertFalse(try parsed.isUnenrolled())
    }
    func testLocaleLockDraftPreservesPinSiblingAndOtherProfileFields() throws {
        for scenario in ["lock","unlock","legacy","parent-language"] { XCTAssertTrue(try PlanetChildLocalV2SDKRuntimeFixture.localeLockDraft(scenario)) }
    }
    func testLocaleLockDraftRejectsNSNumberOneStringNullAndSiblingTargets() throws {
        for scenario in ["number","string","null","sibling"] { XCTAssertTrue(try PlanetChildLocalV2SDKRuntimeFixture.localeLockDraft(scenario)) }
    }
    func testLocaleLockSummaryKeepsLegacyUnknownAndRejectsCorruptTypes() throws {
        XCTAssertTrue(try PlanetChildLocalV2SDKRuntimeFixture.localeLockDraft("summary"))
    }
}
