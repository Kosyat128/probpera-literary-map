import Foundation
import Security
import CryptoKit
import Darwin
import CommonCrypto
import UIKit
import LocalAuthentication

/** Native-only SPI. The sole factory below admits no implementation. Neither
 * Keychain, a JS flag nor a mock constructor witness proves this guarantee.
 * A future genuine adapter must authenticate installed-vault identity/current
 * nonrollback full-record digest and consume native action permission durably. */
fileprivate protocol PlanetChildCheckpoint: AnyObject {
    func verifyCurrent(vaultIdentity: String, digest: String) throws
    func advance(permission: PlanetChildVault.NativeMutationPermission) throws
}

/** Fixed dedicated Keychain full-record candidate, not ParentPinSecureStore.
 * Serializes cooperating native clients with an actual cross-process flock.
 * App/content rollback stays unadmitted without the separate genuine checkpoint.
 * No Capacitor registration, Auth-key extension, enrollment, clear or recovery. */
final class PlanetChildVault {
    /** Pure structural codec, unused by every candidate/protected IO path.
     * An action enum, digest, timestamp argument or decoded envelope establishes
     * no native permission, checkpoint, trusted time, PIN proof or admission. */
    enum PinLifecycleAction: String { case enroll, replace, recover }
    final class ProtectedEnvelope {
        private static let maximumEpoch: UInt64 = 8640000000000000
        private final class Storage {
            private var bytes: [UInt8]
            init(_ input: Data) { bytes = Array(input) } // Own even bytesNoCopy input.
            var count: Int { bytes.count }
            func byte(_ index: Int) -> UInt8 { bytes[index] }
            func copy(_ range: Range<Int>? = nil) -> Data { range.map { Data(bytes[$0]) } ?? Data(bytes) }
            func wipe() { bytes.withUnsafeMutableBytes { _ = $0.initializeMemory(as: UInt8.self, repeating: 0) } }
            deinit { wipe() }
        }
        private struct Pin {
            var revision: UInt64 = 0, iterations: UInt64 = 0, count: UInt64 = 0
            var blockedUntilMs: UInt64 = 0, lastObservedMs: UInt64 = 0
            var credential: Range<Int> = 0..<0, salt: Range<Int> = 0..<0
            var pending = false
        }
        private let lock = NSLock()
        private let storage: Storage
        private var disposed = false
        private let revision: UInt64, pin: Pin?, logicalAnchorMs: UInt64
        private let revisionEnd: Int, pinStart: Int, pinEnd: Int
        private let policyVersion: String, policyChecksum: String, maxIterations: UInt64
        let checksum: String // Identity only, never checkpoint or authorization.
        private init(_ storage: Storage, revision: UInt64, pin: Pin?, logical: UInt64,
                     revisionEnd: Int, pinStart: Int, pinEnd: Int, version: String, policy: String,
                     maximum: UInt64, checksum: String) {
            self.storage = storage; self.revision = revision; self.pin = pin; logicalAnchorMs = logical
            self.revisionEnd = revisionEnd; self.pinStart = pinStart; self.pinEnd = pinEnd
            policyVersion = version; policyChecksum = policy; maxIterations = maximum; self.checksum = checksum
        }
        private static func require(_ valid: Bool) throws { if !valid { throw Failure.unavailable } }
        /** Ordered schema grammar checks the exact TS JSON.stringify bytes.
         * No JSONSerialization, Unicode repair or platform key reserialization.
         * Missing/corrupt data never becomes an unenrolled seed. */
        static func decode(_ input: Data, policyVersion version: String, policyChecksum policy: String,
                           maxIterations maximum: UInt64) throws -> ProtectedEnvelope {
            try require(!input.isEmpty && input.count <= PlanetChildVault.maxBytes && identifier(version)
                        && hash(policy) && maximum >= 600000 && maximum <= 0xffffffff)
            let owned = Storage(input), p = Cursor(owned); var accepted = false
            defer { if !accepted { owned.wipe() } }
            try p.field("schemaVersion", first: true); _ = try p.number(1, 1)
            try p.field("revision"); let revision = try p.number(1, PlanetChildVault.maximumSafe), revisionEnd = p.index
            try p.field("mode"); let mode = try p.asciiString(); try require(mode == "adult" || mode == "child")
            try p.field("selectionRevision"); _ = try p.number(1, PlanetChildVault.maximumSafe)
            try p.field("profileRevision"); _ = try p.number(1, PlanetChildVault.maximumSafe)
            try p.field("policyChecksum"); try require(p.asciiString() == policy)
            try p.field("registryChecksum"); let registryChecksum = try p.asciiString(); try require(hash(registryChecksum))
            try p.field("registry"); let registryStart = p.index
            let active = try registry(p, version: version), registryEnd = p.index
            var registryBytes = owned.copy(registryStart..<registryEnd)
            defer { registryBytes.resetBytes(in: 0..<registryBytes.count) }
            try require(PlanetChildVault.digest(registryBytes) == registryChecksum)
            try p.field("pin"); let pinStart = p.index
            let pin: Pin?
            if p.take("null") { pin = nil } else { pin = try readPin(p, version: version, maximum: maximum) }
            let pinEnd = p.index
            try p.field("clock"); let logical = try clock(p)
            try p.token("}")
            try require(p.index == owned.count && (pin != nil || mode == "adult")
                        && (mode != "child" || active != nil) && (pin == nil || pin!.lastObservedMs >= logical))
            var fullBytes = owned.copy(); defer { fullBytes.resetBytes(in: 0..<fullBytes.count) }
            let result = ProtectedEnvelope(owned, revision: revision, pin: pin, logical: logical,
                revisionEnd: revisionEnd, pinStart: pinStart, pinEnd: pinEnd, version: version, policy: policy,
                maximum: maximum, checksum: PlanetChildVault.digest(fullBytes))
            accepted = true; return result
        }
        /** Read-only coordinates from this already strict canonical envelope.
         * These scalars are structural metadata, never trusted time/authority. */
        fileprivate func pinSessionMetadata() throws -> PinEnvelopeMetadata {
            lock.lock(); defer { lock.unlock() }; try Self.require(!disposed)
            var suffix = storage.copy(pinEnd..<storage.count)
            defer { suffix.resetBytes(in: 0..<suffix.count) }
            let owned = Storage(suffix); defer { owned.wipe() }; let p = Cursor(owned)
            try p.field("clock"); try p.field("schemaVersion", first: true); _ = try p.number(1, 1)
            try p.field("bootId"); let boot = try p.asciiString()
            try p.field("uptimeAnchorMs"); let uptime = try p.number(0, PlanetChildVault.maximumSafe)
            return PinEnvelopeMetadata(revision: revision, pinRevision: pin?.revision ?? 0,
                iterations: pin?.iterations ?? 0, enrolled: pin != nil,
                bootId: boot, uptimeAnchorMs: uptime, logicalAnchorMs: logicalAnchorMs,
                lastObservedMs: pin?.lastObservedMs ?? logicalAnchorMs)
        }
        func isUnenrolled() throws -> Bool { lock.lock(); defer { lock.unlock() }; try Self.require(!disposed); return pin == nil }
        func copyCanonicalBytes() throws -> Data { lock.lock(); defer { lock.unlock() }; try Self.require(!disposed); return storage.copy() }
        func close() { lock.lock(); defer { lock.unlock() }; disposed = true; storage.wipe() }
        deinit { close() }
        /** PIN-only structural comparison. A future owned provider separately
         * authenticates permission/time and calibrated KDF policy under its lock.
         * Neither validation nor this sampledLogicalMs parameter creates them. */
        static func validateTransition(_ before: ProtectedEnvelope, _ after: ProtectedEnvelope,
                                       action: PinLifecycleAction, sampledLogicalMs: UInt64) throws {
            var oldBytes = try before.copyCanonicalBytes(); defer { oldBytes.resetBytes(in: 0..<oldBytes.count) }
            var nextBytes = try after.copyCanonicalBytes(); defer { nextBytes.resetBytes(in: 0..<nextBytes.count) }
            try require(sampledLogicalMs <= PlanetChildVault.maximumSafe && before.policyVersion == after.policyVersion
                && before.policyChecksum == after.policyChecksum && before.maxIterations == after.maxIterations
                && before.revision < PlanetChildVault.maximumSafe && after.revision == before.revision + 1)
            guard let nextPin = after.pin else { throw Failure.unavailable }
            try require(action == .enroll ? before.pin == nil : before.pin != nil)
            if let oldPin = before.pin {
                try require(oldPin.revision < PlanetChildVault.maximumSafe && nextPin.revision == oldPin.revision + 1
                    && !equalRange(oldBytes, oldPin.credential, nextBytes, nextPin.credential)
                    && !equalRange(oldBytes, oldPin.salt, nextBytes, nextPin.salt)
                    && sampledLogicalMs >= oldPin.lastObservedMs)
            } else { try require(nextPin.revision == 1) }
            try require(nextPin.count == 0 && nextPin.blockedUntilMs == 0 && !nextPin.pending
                && nextPin.lastObservedMs == sampledLogicalMs && sampledLogicalMs >= before.logicalAnchorMs
                && equalRange(oldBytes, before.revisionEnd..<before.pinStart, nextBytes, after.revisionEnd..<after.pinStart)
                && equalRange(oldBytes, before.pinEnd..<oldBytes.count, nextBytes, after.pinEnd..<nextBytes.count))
        }
        private static func equalRange(_ left: Data, _ a: Range<Int>, _ right: Data, _ b: Range<Int>) -> Bool {
            if a.count != b.count { return false }; var different: UInt8 = 0
            for offset in 0..<a.count { different |= left[a.lowerBound + offset] ^ right[b.lowerBound + offset] }; return different == 0
        }
        private static func identifier(_ value: String) -> Bool {
            let bytes = Array(value.utf8)
            let alphanumeric: (UInt8) -> Bool = { $0 >= 48 && $0 <= 57 || $0 >= 65 && $0 <= 90 || $0 >= 97 && $0 <= 122 }
            return !bytes.isEmpty && bytes.count <= 96 && alphanumeric(bytes[0])
                && bytes.allSatisfy { alphanumeric($0) || $0 == 46 || $0 == 95 || $0 == 45 }
        }
        private static func hash(_ value: String) -> Bool {
            let bytes = Array(value.utf8); return bytes.count == 64 && bytes.allSatisfy { $0 >= 48 && $0 <= 57 || $0 >= 97 && $0 <= 102 }
        }
        private static func registry(_ p: Cursor, version: String) throws -> String? {
            try p.field("schemaVersion", first: true); _ = try p.number(1, 1)
            try p.field("policyVersion"); try require(p.asciiString() == version)
            try p.field("activeProfileId"); let active = try p.nullableString(); try require(active == nil || identifier(active!))
            try p.field("profiles"); try p.token("["); var ids = Set<String>()
            if !p.take("]") { repeat { try require(ids.count < 4); let id = try profile(p); try require(ids.insert(id).inserted) } while p.take(","); try p.token("]") }
            try p.token("}"); try require(active == nil || ids.contains(active!)); return active
        }
        private static func profile(_ p: Cursor) throws -> String {
            try p.field("id", first: true); let id = try p.asciiString(); try require(identifier(id))
            try p.field("label"); var label = try p.stringUnits()
            defer { label.withUnsafeMutableBytes { _ = $0.initializeMemory(as: UInt8.self, repeating: 0) } }
            try require(!label.isEmpty && label.count <= 80 && !ecmaSpace(label[0]) && !ecmaSpace(label[label.count - 1])
                        && label.allSatisfy { $0 > 31 && $0 != 127 })
            try p.field("exactAge"); let age = try p.number(3, 17)
            try p.field("ageBand"); let band = try p.asciiString()
            try require(band == (age <= 5 ? "3-5" : age <= 8 ? "6-8" : age <= 11 ? "9-11" : age <= 14 ? "12-14" : "15-17"))
            try p.field("locale"); let locale = try p.asciiString(); try require(locale == "ru" || locale == "en")
            try p.field("ageConfirmedAt"); try date(p.asciiString())
            try p.field("readingLevel"); let level = try p.nullableString(); try require(level == nil || ["plain", "developing", "fluent"].contains(level!))
            try p.field("allowedTopics"); if !p.take("null") { try topics(p) }
            try p.field("blockedTopics"); try topics(p)
            try p.field("soundEnabled"); _ = try p.bool()
            try p.field("motion"); let motion = try p.asciiString(); try require(motion == "calm" || motion == "system")
            try p.field("narrationEnabled"); _ = try p.bool(); if p.take(",\"localeLocked\":") { _ = try p.bool() }; try p.token("}"); return id
        }
        private static func ecmaSpace(_ value: UInt16) -> Bool {
            return [9, 10, 11, 12, 13, 32, 160, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff].contains(value)
                || value >= 0x2000 && value <= 0x200a
        }
        private static func date(_ value: String) throws {
            let bytes = Array(value.utf8), punctuation: [Int: UInt8] = [4:45, 7:45, 10:84, 13:58, 16:58, 19:46, 23:90]
            try require(bytes.count == 24 && bytes.enumerated().allSatisfy { offset, byte in
                punctuation[offset].map { $0 == byte } ?? (byte >= 48 && byte <= 57) })
            let decimal: (Range<Int>) -> Int = { range in range.reduce(0) { $0 * 10 + Int(bytes[$1] - 48) } }
            let year = decimal(0..<4), month = decimal(5..<7), day = decimal(8..<10)
            try require(month >= 1 && month <= 12); var days = [31,28,31,30,31,30,31,31,30,31,30,31]
            if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) { days[1] = 29 }
            try require(day >= 1 && day <= days[month - 1] && decimal(11..<13) <= 23 && decimal(14..<16) <= 59 && decimal(17..<19) <= 59)
            // Four-digit proleptic Gregorian years, including year0000, all
            // precede TS's maximum epoch bound. No Foundation Date rollover.
        }
        private static func topics(_ p: Cursor) throws {
            try p.token("["); var values = Set<String>()
            if !p.take("]") { repeat {
                try require(values.count < 64); let value = try p.asciiString(), bytes = Array(value.utf8)
                try require(!bytes.isEmpty && bytes.count <= 64 && (bytes[0] >= 48 && bytes[0] <= 57 || bytes[0] >= 97 && bytes[0] <= 122)
                    && bytes.allSatisfy { $0 >= 48 && $0 <= 57 || $0 >= 97 && $0 <= 122 || $0 == 46 || $0 == 95 || $0 == 45 }
                    && values.insert(value).inserted)
            } while p.take(","); try p.token("]") }
        }
        private static func readPin(_ p: Cursor, version: String, maximum: UInt64) throws -> Pin {
            var pin = Pin(); try p.field("schemaVersion", first: true); _ = try p.number(1, 1)
            try p.field("policyVersion"); try require(p.asciiString() == version)
            try p.field("revision"); pin.revision = try p.number(1, PlanetChildVault.maximumSafe)
            try p.field("credentialId"); pin.credential = try p.hashRange()
            try p.field("verifier"); try p.field("algorithm", first: true); try require(p.asciiString() == "PBKDF2-HMAC-SHA256")
            try p.field("iterations"); pin.iterations = try p.number(600000, maximum)
            try p.field("saltHex"); pin.salt = try p.hashRange()
            try p.field("hashHex"); _ = try p.hashRange(); try p.token("}")
            try p.field("attempts"); try p.field("count", first: true); pin.count = try p.number(0, PlanetChildVault.maximumSafe)
            try p.field("blockedUntilMs"); pin.blockedUntilMs = try p.number(0, PlanetChildVault.maximumSafe)
            try p.field("lastObservedMs"); pin.lastObservedMs = try p.number(0, PlanetChildVault.maximumSafe)
            try p.field("pendingAttemptId"); if !p.take("null") { _ = try p.hashRange(); pin.pending = true }
            try p.token("}"); try p.token("}")
            try require(pin.count == 0 ? pin.blockedUntilMs == 0 && !pin.pending : pin.blockedUntilMs >= pin.lastObservedMs); return pin
        }
        private static func clock(_ p: Cursor) throws -> UInt64 {
            try p.field("schemaVersion", first: true); _ = try p.number(1, 1)
            try p.field("bootId"); try require(PlanetChildVault.validBoot(p.asciiString()))
            try p.field("uptimeAnchorMs"); _ = try p.number(0, PlanetChildVault.maximumSafe)
            try p.field("logicalAnchorMs"); let logical = try p.number(0, PlanetChildVault.maximumSafe)
            try p.field("epochAnchor"); if !p.take("null") {
                try p.field("epochAnchorMs", first: true); let epoch = try p.number(0, maximumEpoch)
                try p.field("validUntilEpochMs"); try require(p.number(0, maximumEpoch) > epoch)
                try p.field("proofChecksum"); _ = try p.hashRange(); try p.token("}")
            }; try p.token("}"); return logical
        }
        /** Byte offsets are native UTF8 offsets, not Swift Character indexes.
         * Values retain UTF16 code units so escaped lone surrogates survive
         * exactly as JS strings; malformed UTF8 never enters a Swift String. */
        private final class Cursor {
            private let storage: Storage
            private(set) var index = 0
            init(_ storage: Storage) { self.storage = storage }
            func field(_ name: String, first: Bool = false) throws { try token((first ? "{" : ",") + "\"" + name + "\":") }
            func token(_ value: String) throws { try ProtectedEnvelope.require(take(value)) }
            func take(_ value: String) -> Bool {
                let bytes = Array(value.utf8); if index + bytes.count > storage.count { return false }
                for offset in bytes.indices { if storage.byte(index + offset) != bytes[offset] { return false } }
                index += bytes.count; return true
            }
            private func byte() throws -> UInt8 { try ProtectedEnvelope.require(index < storage.count); let value = storage.byte(index); index += 1; return value }
            func number(_ minimum: UInt64, _ maximum: UInt64) throws -> UInt64 {
                try ProtectedEnvelope.require(index < storage.count && storage.byte(index) >= 48 && storage.byte(index) <= 57); var value: UInt64 = 0
                if storage.byte(index) == 48 { index += 1 } else {
                    while index < storage.count && storage.byte(index) >= 48 && storage.byte(index) <= 57 {
                        let digit = UInt64(storage.byte(index) - 48); index += 1
                        try ProtectedEnvelope.require(value <= (PlanetChildVault.maximumSafe - digit) / 10); value = value * 10 + digit
                    }
                }; try ProtectedEnvelope.require(value >= minimum && value <= maximum); return value
            }
            func bool() throws -> Bool { if take("true") { return true }; try token("false"); return false }
            func nullableString() throws -> String? { if take("null") { return nil }; return try asciiString() }
            func asciiString() throws -> String {
                var units = try stringUnits(); defer { units.withUnsafeMutableBytes { _ = $0.initializeMemory(as: UInt8.self, repeating: 0) } }
                try ProtectedEnvelope.require(units.allSatisfy { $0 < 128 }); return String(bytes: units.map { UInt8($0) }, encoding: .ascii)!
            }
            func hashRange() throws -> Range<Int> { let start = index; try ProtectedEnvelope.require(ProtectedEnvelope.hash(asciiString())); return start..<index }
            func stringUnits() throws -> [UInt16] {
                let start = index; try token("\""); var units: [UInt16] = [], ended = false, accepted = false
                defer { if !accepted { units.withUnsafeMutableBytes { _ = $0.initializeMemory(as: UInt8.self, repeating: 0) } } }
                while index < storage.count {
                    let next = try byte(); if next == 34 { ended = true; break }; try ProtectedEnvelope.require(next >= 32)
                    if next == 92 {
                        let escaped = try byte()
                        switch escaped {
                        case 34, 92, 47: units.append(UInt16(escaped))
                        case 98: units.append(8)
                        case 102: units.append(12)
                        case 110: units.append(10)
                        case 114: units.append(13)
                        case 116: units.append(9)
                        case 117:
                            var unit: UInt16 = 0
                            for _ in 0..<4 { let digit = try byte(); let value: UInt16
                                if digit >= 48 && digit <= 57 { value = UInt16(digit - 48) }
                                else if digit >= 97 && digit <= 102 { value = UInt16(digit - 97 + 10) }
                                else if digit >= 65 && digit <= 70 { value = UInt16(digit - 65 + 10) }
                                else { throw Failure.unavailable }; unit = unit * 16 + value
                            }; units.append(unit)
                        default: throw Failure.unavailable
                        }
                    } else if next < 128 { units.append(UInt16(next)) } else {
                        let count: Int, minimum: UInt32; var scalar: UInt32
                        if next >= 0xc2 && next <= 0xdf { count = 1; minimum = 0x80; scalar = UInt32(next & 0x1f) }
                        else if next >= 0xe0 && next <= 0xef { count = 2; minimum = 0x800; scalar = UInt32(next & 0x0f) }
                        else if next >= 0xf0 && next <= 0xf4 { count = 3; minimum = 0x10000; scalar = UInt32(next & 0x07) }
                        else { throw Failure.unavailable }
                        for _ in 0..<count { let continuation = try byte(); try ProtectedEnvelope.require(continuation >= 0x80 && continuation <= 0xbf); scalar = scalar * 64 + UInt32(continuation & 0x3f) }
                        try ProtectedEnvelope.require(scalar >= minimum && scalar <= 0x10ffff && !(scalar >= 0xd800 && scalar <= 0xdfff))
                        if scalar <= 0xffff { units.append(UInt16(scalar)) }
                        else { let adjusted = scalar - 0x10000; units.append(UInt16(0xd800 + (adjusted >> 10))); units.append(UInt16(0xdc00 + (adjusted & 0x3ff))) }
                    }; try ProtectedEnvelope.require(units.count <= 96)
                }
                try ProtectedEnvelope.require(ended); var quoted = quote(units)
                defer { quoted.withUnsafeMutableBytes { _ = $0.initializeMemory(as: UInt8.self, repeating: 0) } }
                try ProtectedEnvelope.require(quoted.count == index - start && quoted.indices.allSatisfy { quoted[$0] == storage.byte(start + $0) })
                accepted = true; return units
            }
            private func quote(_ units: [UInt16]) -> [UInt8] {
                var result: [UInt8] = [34], at = 0; let hex = Array("0123456789abcdef".utf8)
                let shortEscapes: [UInt16: UInt8] = [8:98, 9:116, 10:110, 12:102, 13:114]
                func scalar(_ value: UInt32) {
                    if value < 0x80 { result.append(UInt8(value)) }
                    else if value < 0x800 { result.append(UInt8(0xc0 | (value >> 6))); result.append(UInt8(0x80 | (value & 0x3f))) }
                    else if value < 0x10000 { result.append(UInt8(0xe0 | (value >> 12))); result.append(UInt8(0x80 | ((value >> 6) & 0x3f))); result.append(UInt8(0x80 | (value & 0x3f))) }
                    else { result.append(UInt8(0xf0 | (value >> 18))); result.append(UInt8(0x80 | ((value >> 12) & 0x3f))); result.append(UInt8(0x80 | ((value >> 6) & 0x3f))); result.append(UInt8(0x80 | (value & 0x3f))) }
                }
                while at < units.count {
                    let value = units[at]; at += 1
                    if value == 34 || value == 92 { result.append(92); result.append(UInt8(value)) }
                    else if let short = shortEscapes[value] { result.append(92); result.append(short) }
                    else if value >= 0xd800 && value <= 0xdbff && at < units.count && units[at] >= 0xdc00 && units[at] <= 0xdfff {
                        scalar(0x10000 + (UInt32(value - 0xd800) << 10) + UInt32(units[at] - 0xdc00)); at += 1
                    } else if value < 32 || value >= 0xd800 && value <= 0xdfff {
                        result += [92,117,hex[Int(value >> 12)],hex[Int((value >> 8) & 15)],hex[Int((value >> 4) & 15)],hex[Int(value & 15)]]
                    } else { scalar(UInt32(value)) }
                }; result.append(34); return result
            }
        }
    }
    static let maxBytes = 131072
    /** No genuine checkpoint/host/action/time/input/calibration/recovery factory
     * has been supplied. Private session mechanics do not fill those dependencies. */
    private static func actualSDKPinSessions(_ vault: PlanetChildVault) -> NativePinSessions? { nil }
    private final class PinVaultTransaction: PinSessionTransaction {
        private unowned let vault: PlanetChildVault
        init(_ vault: PlanetChildVault) { self.vault = vault }
        func read() throws -> Data { try vault.readExact() }
        func write(_ next: Data, boundary: () throws -> Void) throws {
            try vault.writeExact(next, checkAtCommit: boundary)
        }
    }
    private final class PinVaultIO: PinSessionIO {
        private let vault: PlanetChildVault
        init(_ vault: PlanetChildVault) { self.vault = vault }
        func locked<T>(_ task: (PinSessionTransaction) throws -> T) throws -> T {
            // Existing locked() erases errors. Carry only a typed known refusal
            // as an owned value through that wrapper; every other error seals.
            let result: PinLockedResult<T> = try vault.locked {
                do { return .value(try task(PinVaultTransaction(vault))) }
                catch is PinKnownRefusal { return .refusal }
            }
            switch result { case .value(let value): return value; case .refusal: throw PinKnownRefusal() }
        }
    }
    private func ownedPinSessionIO() -> PinSessionIO { PinVaultIO(self) }
    private static let maximumSafe: UInt64 = 9007199254740991
    private static let processLock = NSLock()
    enum Failure: Error { case unavailable }
    struct BootSample { let bootId: String; let uptimeMs: UInt64 }
    struct CandidateSnapshot { let record: Data; let checksum: String; let sample: BootSample }
    fileprivate struct OwnedRequest {
        var expected: Data; var next: Data
        let expectedChecksum: String; let nextChecksum: String; let bootId: String; let deadlineUptimeMs: UInt64
        mutating func wipe() { expected.resetBytes(in: 0..<expected.count); next.resetBytes(in: 0..<next.count) }
    }
    final class CasRequest {
        private let lock = NSLock()
        private var expected: Data; private var next: Data; private var disposed = false
        private let expectedChecksum: String; private let nextChecksum: String
        private let bootId: String; private let deadlineUptimeMs: UInt64
        init(expected: Data, next: Data, expectedChecksum: String, nextChecksum: String,
             bootId: String, deadlineUptimeMs: UInt64) throws {
            guard !expected.isEmpty, expected.count <= PlanetChildVault.maxBytes,
                  !next.isEmpty, next.count <= PlanetChildVault.maxBytes else { throw Failure.unavailable }
            // Force owned bytes even if a caller supplied Data(bytesNoCopy:...).
            var expectedCopy = Data(Array(expected)), nextCopy = Data(Array(next))
            defer { expectedCopy.resetBytes(in: 0..<expectedCopy.count); nextCopy.resetBytes(in: 0..<nextCopy.count) }
            guard PlanetChildVault.validRecord(expectedCopy), PlanetChildVault.validRecord(nextCopy),
                  PlanetChildVault.digest(expectedCopy) == expectedChecksum, PlanetChildVault.digest(nextCopy) == nextChecksum,
                  PlanetChildVault.validBoot(bootId), deadlineUptimeMs <= PlanetChildVault.maximumSafe else { throw Failure.unavailable }
            self.expected = Data(Array(expectedCopy)); self.next = Data(Array(nextCopy))
            self.expectedChecksum = expectedChecksum; self.nextChecksum = nextChecksum
            self.bootId = bootId; self.deadlineUptimeMs = deadlineUptimeMs
        }
        fileprivate func claim() throws -> OwnedRequest {
            lock.lock(); defer { lock.unlock() }
            guard !disposed else { throw Failure.unavailable }
            let result = OwnedRequest(expected: Data(Array(expected)), next: Data(Array(next)),
                expectedChecksum: expectedChecksum, nextChecksum: nextChecksum, bootId: bootId, deadlineUptimeMs: deadlineUptimeMs)
            disposed = true; expected.resetBytes(in: 0..<expected.count); next.resetBytes(in: 0..<next.count)
            return result
        }
        func dispose() { lock.lock(); defer { lock.unlock() }; disposed = true; expected.resetBytes(in: 0..<expected.count); next.resetBytes(in: 0..<next.count) }
    }
    final class NativeMutationPermission {
        private let lock = NSLock()
        private var consumed = false; private var cancelled = false
        private let owner: PlanetChildCheckpoint
        private let vaultIdentity: String; private let expectedChecksum: String; private let nextChecksum: String
        private let action: String; private let bootId: String; private let deadlineUptimeMs: UInt64
        fileprivate init(owner: PlanetChildCheckpoint, vaultIdentity: String, expectedChecksum: String,
            nextChecksum: String, action: String, bootId: String, deadlineUptimeMs: UInt64) {
            self.owner = owner; self.vaultIdentity = vaultIdentity; self.expectedChecksum = expectedChecksum
            self.nextChecksum = nextChecksum; self.action = action; self.bootId = bootId; self.deadlineUptimeMs = deadlineUptimeMs
        }
        func cancel() { lock.lock(); cancelled = true; lock.unlock() } // Revocation only.
        fileprivate func claim(owner: PlanetChildCheckpoint, vaultIdentity: String, request: OwnedRequest) throws {
            lock.lock(); defer { lock.unlock() }; let used = consumed; consumed = true
            guard !used, !cancelled, self.owner === owner, self.vaultIdentity == vaultIdentity,
                  expectedChecksum == request.expectedChecksum, nextChecksum == request.nextChecksum,
                  bootId == request.bootId, deadlineUptimeMs == request.deadlineUptimeMs,
                  action.range(of: "\\A[a-z][a-z0-9-]{0,63}\\z", options: .regularExpression) != nil else { throw Failure.unavailable }
        }
        fileprivate func requireLive() throws { lock.lock(); defer { lock.unlock() }; guard consumed, !cancelled else { throw Failure.unavailable } }
    }
    private let service: String
    private let vaultIdentity: String
    private let checkpoint: PlanetChildCheckpoint?
    private static func actualSDKCheckpoint() -> PlanetChildCheckpoint? {
        // Public Keychain confidentiality does not establish a nonrollback
        // checkpoint/action authority. No device/SDK guarantee has been admitted.
        return nil
    }
    init() throws {
        guard let bundle = Bundle.main.bundleIdentifier, bundle == "ru.probpera.literaryplanet" else { throw Failure.unavailable }
        service = bundle + ".literary-planet-child-vault-v1"
        vaultIdentity = bundle + ".literary-planet-child-full-record-v1"
        checkpoint = Self.actualSDKCheckpoint()
    }
    private static func validBoot(_ value: String) -> Bool { value.range(of: "\\A[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\z", options: .regularExpression) != nil }
    private static func validRecord(_ value: Data) -> Bool { !value.isEmpty && value.count <= maxBytes && String(data: value, encoding: .utf8) != nil }
    private static func digest(_ value: Data) -> String { SHA256.hash(data: value).map { String(format: "%02x", $0) }.joined() }
    private static func uptime() throws -> UInt64 {
        var scale = mach_timebase_info_data_t()
        guard mach_timebase_info(&scale) == KERN_SUCCESS, scale.numer > 0, scale.denom > 0 else { throw Failure.unavailable }
        let product = mach_continuous_time().multipliedFullWidth(by: UInt64(scale.numer))
        let denominator = UInt64(scale.denom) * 1_000_000
        guard product.high < denominator else { throw Failure.unavailable }
        let value = denominator.dividingFullWidth(product).quotient
        guard value <= maximumSafe else { throw Failure.unavailable }
        return value // Exact integer floor; same-boot continuous time includes sleep.
    }
    private static func bootSample() throws -> BootSample {
        // Apple documents that apps cannot use kern.bootsessionuuid on iOS 18+.
        // Unsupported boot identity denies; never substitute wall time or UUID.
        if #available(iOS 18.0, *) { throw Failure.unavailable }
        var size: size_t = 0
        guard sysctlbyname("kern.bootsessionuuid", nil, &size, nil, 0) == 0, size > 1, size <= 64 else { throw Failure.unavailable }
        var bytes = [UInt8](repeating: 0, count: size)
        defer { _ = bytes.withUnsafeMutableBytes { buffer in buffer.initializeMemory(as: UInt8.self, repeating: 0) } }
        let status = bytes.withUnsafeMutableBytes { sysctlbyname("kern.bootsessionuuid", $0.baseAddress, &size, nil, 0) }
        guard status == 0, size > 1, size <= bytes.count, bytes[size - 1] == 0,
              let token = String(bytes: bytes.prefix(size - 1), encoding: .ascii) else { throw Failure.unavailable }
        let boot = token.lowercased(); guard validBoot(boot) else { throw Failure.unavailable }
        return BootSample(bootId: boot, uptimeMs: try uptime())
        // Unsupported/restricted kernel source denies; no per-process UUID,
        // kern.boottime, Date or fabricated epoch/rights/backoff anchor.
    }
    private func query() -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
         kSecAttrAccount as String: "child-full-record-v1", kSecAttrSynchronizable as String: false]
    }
    private func readExact() throws -> Data {
        var request = query(); request[kSecReturnData as String] = true
        request[kSecReturnAttributes as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(request as CFDictionary, &result) == errSecSuccess,
              let item = result as? [String: Any], let data = item[kSecValueData as String] as? Data,
              (item[kSecAttrAccessible as String] as? String) == (kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String),
              Self.validRecord(data) else { throw Failure.unavailable }
        return Data(Array(data)) // Missing/corrupt/locked does not create a record.
    }
    private func writeExact(_ next: Data, checkAtCommit: () throws -> Void) throws {
        guard Self.validRecord(next) else { throw Failure.unavailable }
        try checkAtCommit()
        let changes: [String: Any] = [kSecValueData as String: next,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        // Update existing item only. Enrollment/Add/reset is a separate native
        // authenticated flow and is deliberately unavailable in this foundation.
        guard SecItemUpdate(query() as CFDictionary, changes as CFDictionary) == errSecSuccess else { throw Failure.unavailable }
        var actual = try readExact(); defer { actual.resetBytes(in: 0..<actual.count) }
        guard actual == next else { throw Failure.unavailable }
        try checkAtCommit() // A late abort/lost ack cannot publish parent proof.
        // SecItem success+readback are candidate semantics. Actual durable
        // checkpoint guarantees require the separately admitted SDK authority.
    }
    private func directory() throws -> URL {
        let manager = FileManager.default
        let parent = try manager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).resolvingSymlinksInPath().standardizedFileURL
        var directory = parent.appendingPathComponent("literary-planet-child-vault-v1", isDirectory: true)
        if !manager.fileExists(atPath: directory.path) { try manager.createDirectory(at: directory, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700]) }
        guard directory.resolvingSymlinksInPath().standardizedFileURL == directory.standardizedFileURL else { throw Failure.unavailable }
        var values = URLResourceValues(); values.isExcludedFromBackup = true; try directory.setResourceValues(values)
        return directory
    }
    private func locked<T>(_ work: () throws -> T) throws -> T {
        let started = try Self.uptime()
        while !Self.processLock.try() {
            let now = try Self.uptime()
            guard !Thread.current.isCancelled, now >= started, now - started < 1500 else { throw Failure.unavailable }
            Thread.sleep(forTimeInterval: 0.01)
        }
        defer { Self.processLock.unlock() }
        do {
            let acquiredAt = try Self.uptime()
            guard !Thread.current.isCancelled, acquiredAt >= started, acquiredAt - started < 1500 else { throw Failure.unavailable }
            let directory = try directory(), file = directory.appendingPathComponent("transaction.lock")
            guard file.resolvingSymlinksInPath().standardizedFileURL == file.standardizedFileURL else { throw Failure.unavailable }
            let fd = Darwin.open(file.path, O_RDWR | O_CREAT | O_NOFOLLOW | O_CLOEXEC, mode_t(S_IRUSR | S_IWUSR))
            guard fd >= 0 else { throw Failure.unavailable }; defer { Darwin.close(fd) }
            var obtained = false
            defer { if obtained { _ = Darwin.flock(fd, LOCK_UN) } }
            while !obtained {
                if Darwin.flock(fd, LOCK_EX | LOCK_NB) == 0 { obtained = true; break }
                let now = try Self.uptime()
                guard errno == EWOULDBLOCK || errno == EAGAIN, now >= started, now - started < 1500 else { throw Failure.unavailable }
                Thread.sleep(forTimeInterval: 0.01)
            }
            let acquiredFileAt = try Self.uptime()
            guard !Thread.current.isCancelled, acquiredFileAt >= started, acquiredFileAt - started < 1500 else { throw Failure.unavailable }
            var opened = stat(), named = stat()
            guard fstat(fd, &opened) == 0, lstat(file.path, &named) == 0,
                  (opened.st_mode & mode_t(S_IFMT)) == mode_t(S_IFREG), opened.st_ino == named.st_ino,
                  opened.st_dev == named.st_dev else { throw Failure.unavailable }
            return try work()
        } catch { throw Failure.unavailable }
    }
    private static func requireDeadline(_ request: OwnedRequest) throws {
        let sample = try bootSample(); guard sample.bootId == request.bootId, sample.uptimeMs < request.deadlineUptimeMs else { throw Failure.unavailable }
    }
    func readCandidate() throws -> CandidateSnapshot {
        try locked { var record = try readExact(); defer { record.resetBytes(in: 0..<record.count) }
            return CandidateSnapshot(record: Data(Array(record)), checksum: Self.digest(record), sample: try Self.bootSample()) }
    }
    func compareAndSetCandidate(_ request: CasRequest) throws -> String {
        var owned = try request.claim(); defer { owned.wipe() }
        return try locked { var actual = try readExact(); defer { actual.resetBytes(in: 0..<actual.count) }
            guard actual == owned.expected else { throw Failure.unavailable }; try Self.requireDeadline(owned)
            try writeExact(owned.next) { try Self.requireDeadline(owned) }; return owned.nextChecksum }
    }
    func readProtected() throws -> CandidateSnapshot {
        guard let checkpoint else { throw Failure.unavailable }
        return try locked { var record = try readExact(); defer { record.resetBytes(in: 0..<record.count) }
            try checkpoint.verifyCurrent(vaultIdentity: vaultIdentity, digest: Self.digest(record))
            return CandidateSnapshot(record: Data(Array(record)), checksum: Self.digest(record), sample: try Self.bootSample()) }
    }
    func compareAndSetProtected(_ request: CasRequest, permission: NativeMutationPermission) throws -> String {
        guard let checkpoint else { throw Failure.unavailable }
        var owned = try request.claim(); defer { owned.wipe() }
        return try locked {
            try permission.claim(owner: checkpoint, vaultIdentity: vaultIdentity, request: owned)
            var actual = try readExact(); defer { actual.resetBytes(in: 0..<actual.count) }
            guard actual == owned.expected else { throw Failure.unavailable }; try Self.requireDeadline(owned)
            try checkpoint.verifyCurrent(vaultIdentity: vaultIdentity, digest: owned.expectedChecksum)
            try permission.requireLive(); try Self.requireDeadline(owned)
            try checkpoint.advance(permission: permission) // Actual checkpoint precedes record publication.
            try checkpoint.verifyCurrent(vaultIdentity: vaultIdentity, digest: owned.nextChecksum)
            try writeExact(owned.next) { try permission.requireLive(); try Self.requireDeadline(owned) }
            try checkpoint.verifyCurrent(vaultIdentity: vaultIdentity, digest: owned.nextChecksum)
            try permission.requireLive(); try Self.requireDeadline(owned); return owned.nextChecksum
        }
    }
}

/** Private full-record credential lifecycle mechanics, intentionally unavailable
 * from production. No public SPI constructor, caller flag, JS brand, generic
 * key/value writer or synthetic factory may replace the actual nil factory.
 * A future admitted private host must retain original coordinator identity and
 * authenticate capture/current/action/reset/recovery under this same IO lock. */
fileprivate struct PinEnvelopeMetadata {
    let revision: UInt64, pinRevision: UInt64, iterations: UInt64
    let enrolled: Bool, bootId: String
    let uptimeAnchorMs: UInt64, logicalAnchorMs: UInt64, lastObservedMs: UInt64
}
fileprivate struct PinSessionPolicy {
    let version: String, checksum: String
    let maximumIterations: UInt64, iterations: UInt64
    init(version: String, checksum: String, maximumIterations: UInt64, iterations: UInt64) throws {
        try NativePinSessions.require(version.range(of: "\\A[A-Za-z0-9][A-Za-z0-9._-]{0,95}\\z", options: .regularExpression) != nil
            && NativePinSessions.hash(checksum) && maximumIterations >= 600000 && maximumIterations <= 0xffffffff
            && iterations >= 600000 && iterations <= maximumIterations)
        self.version = version; self.checksum = checksum
        self.maximumIterations = maximumIterations; self.iterations = iterations
    }
}
fileprivate struct PinKnownRefusal: Error {}
fileprivate enum PinLockedResult<T> { case value(T), refusal }
fileprivate enum PinSessionPhase { case reserved, beginning, begun, committing, committed, denied, cancelled, closing, sealed, closed }
fileprivate enum PinReplyDelivery { case known, uncertain }
fileprivate enum PinNativeReplyKind { case unenrolled, enrolled, committed, primitive, ownerPermission, closed }
fileprivate protocol PinSessionTransaction: AnyObject {
    func read() throws -> Data
    func write(_ next: Data, boundary: () throws -> Void) throws
}
fileprivate protocol PinSessionIO: AnyObject {
    func locked<T>(_ task: (PinSessionTransaction) throws -> T) throws -> T
}
/** Actual native authority SPI, never implemented by a production flag here.
 * capture/current authenticate complete bytes/revision, epoch, host/account/
 * profile/lifecycle scope and supported continuous time. The original native
 * inspection must come from the real original-coordinator identity registry.
 * authorizeMutation binds exact whole old/new bytes+digests/revisions, action,
 * session, epoch/host/boot/original deadline and captured attempt-reset time,
 * and authenticates real input/calibration prerequisites. advance validates and
 * durably consumes that exact one-use permission before checkpoint publication.
 * Its current() after advance authenticates the authorized next checkpoint;
 * no in-memory consumed flag or Keychain ciphertext supplies that guarantee.
 * cancel/retire join their actual work. retire is whole-request terminal
 * permission retirement, covering cancellation after retirementFenced.
 * Callbacks receive disposable copies; retaining native secrets requires their
 * own owned wiping and actual retirement. No adapter is supplied. */
fileprivate protocol PinSessionAuthority: AnyObject {
    func capture(_ inspection: OwnedPinInspection, bytes: Data, checksum: String, revision: UInt64) throws -> PinNativeCoordinates
    func current(_ session: OwnedPinSession, bytes: Data, checksum: String, revision: UInt64) throws -> PinNativeCoordinates
    func authorizeMutation(_ session: OwnedPinSession, next: Data, checksum: String, revision: UInt64) throws -> AnyObject
    func advance(_ session: OwnedPinSession, resetPermission: AnyObject, recoveryPermission: AnyObject?, nextChecksum: String, nextRevision: UInt64) throws
    func cancel(_ inspection: OwnedPinInspection) throws
    func retire(_ inspection: OwnedPinInspection) throws
}
fileprivate protocol PinRecoveryAuthority: AnyObject {
    // Distinct genuine native/system/account recovery proof. Authenticate this
    // exact session and all old/new coordinates under the publication lock.
    func verify(_ session: OwnedPinSession, next: Data, checksum: String, revision: UInt64, permission: AnyObject) throws
}
fileprivate final class PinNativeCoordinates {
    let owner: PinSessionAuthority, epoch: String, bootId: String, checksum: String
    let revision: UInt64, hostGeneration: UInt64, uptimeMs: UInt64, logicalMs: UInt64
    init(owner: PinSessionAuthority, epoch: String, bootId: String, checksum: String, revision: UInt64,
         hostGeneration: UInt64, uptimeMs: UInt64, logicalMs: UInt64) {
        self.owner=owner; self.epoch=epoch; self.bootId=bootId; self.checksum=checksum
        self.revision=revision; self.hostGeneration=hostGeneration; self.uptimeMs=uptimeMs; self.logicalMs=logicalMs
    }
}
fileprivate final class OwnedPinInspection {
    let owner: NativePinSessions, wireId: String, action: PlanetChildVault.PinLifecycleAction, timeoutMs: UInt64
    var phase: PinSessionPhase = .reserved, cancelled=false, sealed=false, retiring=false, retirementFenced=false
    var workers=0, transfers=0, threads: [ObjectIdentifier:Int] = [:], session: OwnedPinSession?
    var pendingReplies: [ObjectIdentifier:PinNativeReply] = [:], terminalReply: PinNativeReply?
    var primitiveWorker: PinPrimitiveWork?, primitiveMaterial: PinPrimitiveMaterial?
    var nativeInput: PinNativeInputSession?, nativeInputHandoff=false
    var ownerAuthorization: PinNativeOwnerRequest?
    init(owner: NativePinSessions, wireId: String, action: PlanetChildVault.PinLifecycleAction, timeoutMs: UInt64) {
        self.owner=owner; self.wireId=wireId; self.action=action; self.timeoutMs=timeoutMs
    }
}
fileprivate final class PinOwnedBytes {
    private let lock=NSLock()
    private var bytes: [UInt8], disposed=false
    init(_ input: Data) { bytes=Array(input) } // Own bytesNoCopy inputs too.
    func copy() throws -> Data {
        lock.lock(); defer { lock.unlock() }; try NativePinSessions.require(!disposed)
        return Data(bytes)
    }
    func close() { lock.lock(); defer { lock.unlock() }; disposed=true; bytes.withUnsafeMutableBytes { _=$0.initializeMemory(as: UInt8.self,repeating:0) } }
    deinit { close() }
}
fileprivate final class OwnedPinSession {
    let owner: NativePinSessions, inspection: OwnedPinInspection, policy: PinSessionPolicy
    let expected: PinOwnedBytes, checksum: String, revision: UInt64, pinRevision: UInt64
    let epoch: String, hostGeneration: UInt64, bootId: String, capturedUptimeMs: UInt64, capturedLogicalMs: UInt64
    let clockUptimeMs: UInt64, clockLogicalMs: UInt64, deadlineUptimeMs: UInt64
    var disposed=false
    init(owner: NativePinSessions, inspection: OwnedPinInspection, policy: PinSessionPolicy, bytes: Data,
         checksum: String, metadata: PinEnvelopeMetadata, point: PinNativeCoordinates, deadline: UInt64) {
        self.owner=owner; self.inspection=inspection; self.policy=policy; expected=PinOwnedBytes(bytes)
        self.checksum=checksum; revision=metadata.revision; pinRevision=metadata.pinRevision
        epoch=point.epoch; hostGeneration=point.hostGeneration; bootId=point.bootId
        capturedUptimeMs=point.uptimeMs; capturedLogicalMs=point.logicalMs
        clockUptimeMs=metadata.uptimeAnchorMs; clockLogicalMs=metadata.logicalAnchorMs; deadlineUptimeMs=deadline
    }
    func close() { disposed=true; expected.close() }
}
/** Native-owned one-use envelope. Its opaque witness still requires genuine
 * locked native authentication; constructing this envelope grants none. */
fileprivate final class OwnedPinMutation {
    let owner: NativePinSessions, session: OwnedPinSession
    let reset: AnyObject, recovery: AnyObject?, checksum: String, revision: UInt64, capturedResetLogicalMs: UInt64
    var consumed=false
    init(owner: NativePinSessions, session: OwnedPinSession, reset: AnyObject, recovery: AnyObject?, checksum: String, revision: UInt64) {
        self.owner=owner; self.session=session; self.reset=reset; self.recovery=recovery
        self.checksum=checksum; self.revision=revision; capturedResetLogicalMs=session.capturedLogicalMs
    }
}
fileprivate final class PinNativeReply {
    let owner: NativePinSessions, inspection: OwnedPinInspection, session: OwnedPinSession?
    let kind: PinNativeReplyKind, checksum: String?
    private let bytes: PinOwnedBytes?
    var settled=false
    init(owner: NativePinSessions, inspection: OwnedPinInspection, session: OwnedPinSession?,
         kind: PinNativeReplyKind, bytes: Data?, checksum: String?) {
        self.owner=owner; self.inspection=inspection; self.session=session; self.kind=kind
        self.bytes=bytes.map(PinOwnedBytes.init); self.checksum=checksum
    }
    func copyBytes() throws -> Data? { try bytes?.copy() }
    // Wiping a transfer never proves delivery/work settlement or frees a lane.
    func close() { bytes?.close() }
    deinit { close() }
}
fileprivate final class NativePinSessions {
    private static let maximumSafe: UInt64=9007199254740991
    private let condition=NSCondition(), io: PinSessionIO, authority: PinSessionAuthority
    private let recovery: PinRecoveryAuthority?, policy: PinSessionPolicy
    private var usedWireIds=Set<String>(), usedPermissions: [ObjectIdentifier:AnyObject]=[:]
    private var active: OwnedPinInspection?
    fileprivate init(io: PinSessionIO, authority: PinSessionAuthority, recovery: PinRecoveryAuthority?, policy: PinSessionPolicy) {
        self.io=io; self.authority=authority; self.recovery=recovery; self.policy=policy
    }
    static func require(_ value: Bool) throws { if !value { throw PlanetChildVault.Failure.unavailable } }
    static func hash(_ value: String) -> Bool { value.range(of:"\\A[a-f0-9]{64}\\z",options:.regularExpression) != nil }
    private static func boot(_ value: String) -> Bool { value.range(of:"\\A[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\z",options:.regularExpression) != nil }
    private static func digest(_ bytes: Data) -> String { SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() }
    private static func add(_ left: UInt64,_ right: UInt64) throws -> UInt64 {
        try require(left<=maximumSafe && right<=maximumSafe-left); return left+right
    }
    /** Private trusted-host registration only, before the first SPI callback.
     * No JSON/UI/JS structural object can call or replace the missing factory.
     * Wire IDs are unique for this owner, bounded2048 and never evicted. */
    func inspection(wireId: String, action: PlanetChildVault.PinLifecycleAction, timeoutMs: UInt64) throws -> OwnedPinInspection {
        condition.lock(); defer { condition.unlock() }
        try Self.require(Self.hash(wireId) && timeoutMs>=1 && timeoutMs<=60000 && usedWireIds.count<2048 && usedWireIds.insert(wireId).inserted)
        try Self.require(active==nil)
        let result=OwnedPinInspection(owner:self,wireId:wireId,action:action,timeoutMs:timeoutMs); active=result; return result
    }
    private func ownLocked(_ inspection: OwnedPinInspection) throws {
        try Self.require(inspection.owner === self && active === inspection && inspection.phase != .closed)
    }
    private func liveLocked(_ inspection: OwnedPinInspection) throws {
        try ownLocked(inspection); if inspection.cancelled || inspection.sealed { throw PinKnownRefusal() }
    }
    private func live(_ inspection: OwnedPinInspection) throws {
        condition.lock(); defer { condition.unlock() }; try liveLocked(inspection)
    }
    private func workerLocked(_ inspection: OwnedPinInspection) {
        inspection.workers+=1; let thread=ObjectIdentifier(Thread.current); inspection.threads[thread]=(inspection.threads[thread] ?? 0)+1
    }
    private func settleWorker(_ inspection: OwnedPinInspection) {
        condition.lock(); defer { condition.unlock() }
        let thread=ObjectIdentifier(Thread.current), remaining=(inspection.threads[thread] ?? 0)-1
        if inspection.workers<=0 || remaining<0 { inspection.sealed=true; inspection.phase = .sealed }
        else { inspection.workers-=1; if remaining==0 { inspection.threads.removeValue(forKey:thread) } else { inspection.threads[thread]=remaining } }
        wipeSealedLocked(inspection); condition.broadcast()
    }
    private func claim(_ inspection: OwnedPinInspection,_ expected: PinSessionPhase,_ next: PinSessionPhase) throws {
        condition.lock(); defer { condition.unlock() }; try liveLocked(inspection)
        try Self.require(!inspection.retiring && inspection.phase==expected && inspection.workers==0 && inspection.nativeInput==nil); inspection.phase=next; workerLocked(inspection)
    }
    private func failed(_ inspection: OwnedPinInspection,_ error: Error,_ publicationEntered: Bool) {
        condition.lock(); defer { condition.unlock() }
        if inspection.sealed || publicationEntered || !(error is PinKnownRefusal) { inspection.sealed=true; inspection.phase = .sealed }
        else { inspection.phase=inspection.cancelled ? .cancelled:.denied }
        wipeSealedLocked(inspection); condition.broadcast()
    }
    private func coordinates(_ point: PinNativeCoordinates,_ checksum: String,_ revision: UInt64) throws {
        try Self.require(point.owner === authority && Self.hash(point.epoch) && Self.boot(point.bootId)
            && point.checksum==checksum && point.revision==revision && point.hostGeneration<=Self.maximumSafe
            && point.uptimeMs<=Self.maximumSafe && point.logicalMs<=Self.maximumSafe)
    }
    private func byteFence(_ bytes: Data,_ checksum: String) throws {
        try Self.require(!bytes.isEmpty && bytes.count<=PlanetChildVault.maxBytes && Self.hash(checksum) && Self.digest(bytes)==checksum)
    }
    private func bounded(_ bytes: Data) throws { try Self.require(!bytes.isEmpty && bytes.count<=PlanetChildVault.maxBytes) }
    /** Separate owned callback allocation, even for bytesNoCopy input. Reject
     * changes before using callback results and wipe after actual settlement. */
    private func isolated<T>(_ bytes: Data,_ task: (Data) throws -> T) throws -> T {
        try bounded(bytes); var disposable=Data(Array(bytes)); defer { disposable.resetBytes(in:0..<disposable.count) }
        let result=try task(disposable)
        try Self.require(disposable==bytes && Self.digest(disposable)==Self.digest(bytes)); return result
    }
    private func sessionFence(_ session: OwnedPinSession) throws {
        condition.lock()
        let valid=session.owner === self && active === session.inspection && session.inspection.session === session && !session.disposed
            && session.policy.version==policy.version && session.policy.checksum==policy.checksum
            && session.policy.maximumIterations==policy.maximumIterations && session.policy.iterations==policy.iterations
        condition.unlock(); try Self.require(valid); try live(session.inspection)
        var retained=try session.expected.copy(); defer { retained.resetBytes(in:0..<retained.count) }; try byteFence(retained,session.checksum)
        try live(session.inspection)
    }
    private func mutationFence(_ session: OwnedPinSession,_ before: Data,_ after: Data,_ checksum: String,_ revision: UInt64) throws {
        try sessionFence(session); var retained=try session.expected.copy(); defer { retained.resetBytes(in:0..<retained.count) }
        try Self.require(before==retained && session.revision<Self.maximumSafe && revision==session.revision+1)
        try byteFence(before,session.checksum); try byteFence(after,checksum)
    }
    private func advanceMutation(_ mutation: OwnedPinMutation) throws {
        try sessionFence(mutation.session)
        try Self.require(mutation.owner === self && !mutation.consumed && mutation.capturedResetLogicalMs==mutation.session.capturedLogicalMs
            && mutation.revision==mutation.session.revision+1 && Self.hash(mutation.checksum))
        mutation.consumed=true
        try authority.advance(mutation.session,resetPermission:mutation.reset,recoveryPermission:mutation.recovery,
            nextChecksum:mutation.checksum,nextRevision:mutation.revision)
    }
    /** Wiping owns no delivery/cleanup authority. An unknown outcome retains
     * the lane and transfer counts; late worker buffers wipe on actual return. */
    private func wipeSealedLocked(_ inspection: OwnedPinInspection) {
        guard inspection.sealed else { return }
        for reply in inspection.pendingReplies.values { reply.close() }
        if inspection.workers==0 { inspection.session?.close() }
    }
    private func current(_ session: OwnedPinSession,_ bytes: Data,_ checksum: String,_ revision: UInt64) throws -> PinNativeCoordinates {
        try sessionFence(session); try byteFence(bytes,checksum)
        let point=try isolated(bytes) { try authority.current(session,bytes:$0,checksum:checksum,revision:revision) }
        try sessionFence(session); try byteFence(bytes,checksum); try coordinates(point,checksum,revision)
        try Self.require(point.epoch==session.epoch && point.hostGeneration==session.hostGeneration && point.bootId==session.bootId
            && point.uptimeMs>=session.capturedUptimeMs && point.uptimeMs<session.deadlineUptimeMs
            && point.uptimeMs>=session.clockUptimeMs
            && point.logicalMs == (try Self.add(session.clockLogicalMs,point.uptimeMs-session.clockUptimeMs)))
        try live(session.inspection); return point
    }
    private func reply(_ session: OwnedPinSession,_ bytes: Data,_ checksum: String,_ kind: PinNativeReplyKind,_ phase: PinSessionPhase) throws -> PinNativeReply {
        condition.lock(); defer { condition.unlock() }; try liveLocked(session.inspection)
        let result=PinNativeReply(owner:self,inspection:session.inspection,session:session,kind:kind,bytes:bytes,checksum:checksum)
        session.inspection.pendingReplies[ObjectIdentifier(result)]=result
        session.inspection.transfers+=1; session.inspection.phase=phase; return result
    }
    func begin(_ inspection: OwnedPinInspection) throws -> PinNativeReply {
        try claim(inspection,.reserved,.beginning); defer { settleWorker(inspection) }
        do { return try io.locked { transaction in
            try live(inspection)
            var delivered=try transaction.read(); defer { delivered.resetBytes(in:0..<delivered.count) }
            try bounded(delivered); var bytes=Data(Array(delivered)); defer { bytes.resetBytes(in:0..<bytes.count) }
            let before=try PlanetChildVault.ProtectedEnvelope.decode(bytes,policyVersion:policy.version,policyChecksum:policy.checksum,maxIterations:policy.maximumIterations); defer { before.close() }
            let metadata=try before.pinSessionMetadata()
            if (inspection.action == .enroll) == metadata.enrolled || inspection.action == .recover && recovery==nil { throw PinKnownRefusal() }
            let point=try isolated(bytes) { try authority.capture(inspection,bytes:$0,checksum:before.checksum,revision:metadata.revision) }
            try live(inspection); try byteFence(bytes,before.checksum); try coordinates(point,before.checksum,metadata.revision)
            try Self.require(point.bootId==metadata.bootId && point.uptimeMs>=metadata.uptimeAnchorMs
                && point.logicalMs == (try Self.add(metadata.logicalAnchorMs,point.uptimeMs-metadata.uptimeAnchorMs))
                && point.logicalMs>=metadata.lastObservedMs)
            let deadline=try Self.add(point.uptimeMs,inspection.timeoutMs)
            condition.lock()
            let session: OwnedPinSession
            do { try liveLocked(inspection); session=OwnedPinSession(owner:self,inspection:inspection,policy:policy,bytes:bytes,
                checksum:before.checksum,metadata:metadata,point:point,deadline:deadline); inspection.session=session; condition.unlock() }
            catch { condition.unlock(); throw error }
            _=try current(session,bytes,before.checksum,metadata.revision)
            return try reply(session,bytes,before.checksum,metadata.enrolled ? .enrolled:.unenrolled,.begun)
        } } catch { failed(inspection,error,false); throw error }
    }
    private func reservePermission(_ permission: AnyObject) throws {
        condition.lock(); defer { condition.unlock() }; let id=ObjectIdentifier(permission)
        try Self.require(usedPermissions[id]==nil && usedPermissions.count<4096); usedPermissions[id]=permission
        // Local identity replay fence only. Genuine durable one-use validation
        // belongs to authority.advance/recovery under the IO transaction lock.
    }
    func commit(_ inspection: OwnedPinInspection, session: OwnedPinSession, expected: Data, next: Data,
                expectedChecksum: String, nextChecksum: String, expectedRevision: UInt64, nextRevision: UInt64,
                nativeEpoch: String, hostGeneration: UInt64, bootId: String, deadlineUptimeMs: UInt64,
                recoveryPermission: AnyObject?) throws -> PinNativeReply {
        try claim(inspection,.begun,.committing); defer { settleWorker(inspection) }
        var old=Data(),fresh=Data(),publicationEntered=false
        defer { old.resetBytes(in:0..<old.count); fresh.resetBytes(in:0..<fresh.count) }
        do {
            try bounded(expected); try bounded(next); old=Data(Array(expected)); fresh=Data(Array(next))
            try Self.require(session.owner === self && session.inspection === inspection && inspection.session === session && !session.disposed
                && !old.isEmpty && old.count<=PlanetChildVault.maxBytes && !fresh.isEmpty && fresh.count<=PlanetChildVault.maxBytes
                && expectedChecksum==session.checksum && expectedRevision==session.revision && expectedRevision<Self.maximumSafe
                && nextRevision==expectedRevision+1 && nativeEpoch==session.epoch && hostGeneration==session.hostGeneration
                && bootId==session.bootId && deadlineUptimeMs==session.deadlineUptimeMs)
            try byteFence(old,expectedChecksum); try byteFence(fresh,nextChecksum)
            var retained=try session.expected.copy(); defer { retained.resetBytes(in:0..<retained.count) }; try Self.require(old==retained)
            return try io.locked { transaction in
                try live(inspection); var delivered=try transaction.read(); defer { delivered.resetBytes(in:0..<delivered.count) }
                try bounded(delivered); var actual=Data(Array(delivered)); defer { actual.resetBytes(in:0..<actual.count) }; try Self.require(actual==old)
                let before=try PlanetChildVault.ProtectedEnvelope.decode(old,policyVersion:policy.version,policyChecksum:policy.checksum,maxIterations:policy.maximumIterations); defer { before.close() }
                let after=try PlanetChildVault.ProtectedEnvelope.decode(fresh,policyVersion:policy.version,policyChecksum:policy.checksum,maxIterations:policy.maximumIterations); defer { after.close() }
                _=try current(session,old,expectedChecksum,expectedRevision)
                try PlanetChildVault.ProtectedEnvelope.validateTransition(before,after,action:inspection.action,sampledLogicalMs:session.capturedLogicalMs)
                try Self.require((try after.pinSessionMetadata()).iterations==policy.iterations)
                if inspection.action == .recover {
                    guard let recovery,let recoveryPermission else { throw PinKnownRefusal() }
                    try reservePermission(recoveryPermission)
                    try isolated(fresh) { try recovery.verify(session,next:$0,checksum:nextChecksum,revision:nextRevision,permission:recoveryPermission) }
                    try mutationFence(session,old,fresh,nextChecksum,nextRevision)
                } else if recoveryPermission != nil { throw PinKnownRefusal() }
                let permission=try isolated(fresh) { try authority.authorizeMutation(session,next:$0,checksum:nextChecksum,revision:nextRevision) }
                try reservePermission(permission); try mutationFence(session,old,fresh,nextChecksum,nextRevision)
                _=try current(session,old,expectedChecksum,expectedRevision)
                try mutationFence(session,old,fresh,nextChecksum,nextRevision)
                let mutation=OwnedPinMutation(owner:self,session:session,reset:permission,recovery:recoveryPermission,checksum:nextChecksum,revision:nextRevision)
                publicationEntered=true; try advanceMutation(mutation)
                try mutationFence(session,old,fresh,nextChecksum,nextRevision)
                var writeBytes=Data(Array(fresh)); defer { writeBytes.resetBytes(in:0..<writeBytes.count) }
                let boundary: () throws -> Void = {
                    try self.mutationFence(session,old,fresh,nextChecksum,nextRevision); try self.byteFence(writeBytes,nextChecksum)
                    try Self.require(writeBytes==fresh)
                    _=try self.current(session,fresh,nextChecksum,nextRevision)
                    try self.mutationFence(session,old,fresh,nextChecksum,nextRevision); try self.byteFence(writeBytes,nextChecksum)
                    try Self.require(writeBytes==fresh); try self.live(inspection)
                }
                try boundary(); try transaction.write(writeBytes,boundary:boundary)
                var readbackDelivered=try transaction.read(); defer { readbackDelivered.resetBytes(in:0..<readbackDelivered.count) }
                try bounded(readbackDelivered); var readback=Data(Array(readbackDelivered)); defer { readback.resetBytes(in:0..<readback.count) }
                try Self.require(readback==fresh); try boundary()
                return try reply(session,fresh,nextChecksum,.committed,.committed)
            }
        } catch { failed(inspection,error,publicationEntered); throw error }
    }
    func cancel(_ inspection: OwnedPinInspection) throws {
        condition.lock()
        do {
            try ownLocked(inspection)
            if inspection.cancelled { condition.unlock(); return }
            inspection.cancelled=true
            // Whole-request genuine retirement atomically covers later cancels;
            // after this fence cancellation creates no new unjoined callback.
            if inspection.retirementFenced { condition.unlock(); return }
            workerLocked(inspection); condition.unlock()
        } catch { condition.unlock(); throw error }
        defer { settleWorker(inspection) }
        do { try io.locked { _ in try authority.cancel(inspection) } }
        catch { failed(inspection,error,false); throw error }
    }
    /** Only the missing genuine private host can settle the actual transfer.
     * Original object identity, not a serialized bool/ACK, is required. */
    func settleReply(_ reply: PinNativeReply, delivery: PinReplyDelivery) throws {
        condition.lock(); defer { condition.unlock() }
        try Self.require(reply.owner === self); try ownLocked(reply.inspection)
        try Self.require(!reply.settled && reply.session === reply.inspection.session
            && reply.inspection.pendingReplies[ObjectIdentifier(reply)] === reply && reply.inspection.transfers>0)
        if reply.kind == .closed {
            try Self.require(reply.inspection.terminalReply === reply && reply.inspection.retirementFenced
                && reply.inspection.workers==0 && reply.inspection.transfers==1)
        }
        if reply.kind == .primitive {
            guard let material=reply.inspection.primitiveMaterial else { throw PlanetChildVault.Failure.unavailable }
            try Self.require(material.owner === self && material.reply === reply && material.published && !material.settled
                && reply.inspection.workers==0 && reply.inspection.nativeInput==nil
                && material.context.session === reply.session && material.context.inspection === reply.inspection)
            material.settled=true; reply.inspection.primitiveMaterial=nil
        }
        if reply.kind == .ownerPermission {
            guard let request=reply.inspection.ownerAuthorization else { throw PlanetChildVault.Failure.unavailable }
            try Self.require(reply.inspection.workers==0 && request.owner.transferFence(request,reply:reply,delivery:delivery))
            request.owner.transferSettled(request,delivery:delivery)
        }
        reply.settled=true; reply.close(); reply.inspection.pendingReplies.removeValue(forKey:ObjectIdentifier(reply)); reply.inspection.transfers-=1
        if delivery == .uncertain || reply.kind != .closed && reply.inspection.cancelled {
            reply.inspection.sealed=true; reply.inspection.phase = .sealed
        }
        if reply.kind == .closed && !reply.inspection.sealed {
            reply.inspection.session?.close(); reply.inspection.session=nil; reply.inspection.terminalReply=nil
            reply.inspection.phase = .closed; active=nil
        }
        wipeSealedLocked(reply.inspection); condition.broadcast()
    }
    func sealUnknown(_ inspection: OwnedPinInspection) throws {
        condition.lock(); defer { condition.unlock() }; try ownLocked(inspection)
        inspection.sealed=true; inspection.phase = .sealed; wipeSealedLocked(inspection); condition.broadcast()
    }
    /** Join actual work and reply transfers, then genuine whole-request
     * permission retirement. A terminal close transfer still holds capacity
     * until the private host's real known delivery; unknown ACK retains/seals. */
    func retire(_ inspection: OwnedPinInspection) throws -> PinNativeReply {
        condition.lock()
        do {
            try ownLocked(inspection)
            try Self.require(!inspection.retiring && inspection.threads[ObjectIdentifier(Thread.current)]==nil)
            inspection.retiring=true
            while inspection.workers != 0 || inspection.transfers != 0 || inspection.nativeInput != nil { condition.wait() }
            inspection.retirementFenced=true; condition.unlock()
        } catch { condition.unlock(); throw error }
        do { try io.locked { _ in try authority.retire(inspection) } }
        catch { condition.lock(); inspection.sealed=true; inspection.phase = .sealed; wipeSealedLocked(inspection); condition.broadcast(); condition.unlock(); throw error }
        condition.lock(); defer { condition.unlock() }
        try Self.require(inspection.workers==0 && inspection.transfers==0); inspection.session?.close()
        let reply=PinNativeReply(owner:self,inspection:inspection,session:inspection.session,kind:.closed,bytes:nil,checksum:nil)
        inspection.terminalReply=reply; inspection.pendingReplies[ObjectIdentifier(reply)]=reply; inspection.transfers=1
        if !inspection.sealed { inspection.phase = .closing }; condition.broadcast(); return reply
    }
}

/** Native primitive work is part of the original request's actual worker set.
 * Identity/byte checks below are mechanics. Only the existing genuine authority
 * SPI authenticates boot, host and nonrollback state; its factory is still nil. */
fileprivate final class PinPrimitiveWork {
    let owner: NativePinSessions, session: OwnedPinSession
    var finished = false
    init(owner: NativePinSessions, session: OwnedPinSession) { self.owner=owner; self.session=session }
}
fileprivate extension NativePinSessions {
    func startPrimitiveWork(_ session: OwnedPinSession, inputHandoff: PinNativeInputSession?=nil) throws -> PinPrimitiveWork {
        condition.lock()
        let work: PinPrimitiveWork
        do {
            try liveLocked(session.inspection)
            try Self.require(session.owner === self && session.inspection.session === session && !session.disposed
                && !session.inspection.retiring && session.inspection.phase == .begun
                && session.inspection.workers == 0 && session.inspection.transfers == 0
                && session.inspection.primitiveWorker == nil && session.inspection.primitiveMaterial == nil
                && ((session.inspection.nativeInput == nil && inputHandoff == nil)
                    || (session.inspection.nativeInput === inputHandoff && session.inspection.nativeInputHandoff
                        && inputHandoff?.matchesSession(session) == true)))
            work=PinPrimitiveWork(owner:self,session:session)
            session.inspection.primitiveWorker=work; workerLocked(session.inspection)
        } catch { condition.unlock(); throw error }
        condition.unlock()
        do { try sessionFence(session); return work }
        catch { failed(session.inspection,error,false); _=finishPrimitiveWork(work); throw error }
    }
    func currentPrimitiveWork(_ work: PinPrimitiveWork) throws -> PinNativeCoordinates {
        let session=work.session
        condition.lock()
        let owned=work.owner === self && session.inspection.primitiveWorker === work && !work.finished
        condition.unlock(); try Self.require(owned)
        do { return try io.locked { transaction in
            try sessionFence(session)
            var returned=try transaction.read(); defer { returned.resetBytes(in:0..<returned.count) }; try bounded(returned)
            var bytes=Data(Array(returned)); defer { bytes.resetBytes(in:0..<bytes.count) }
            var expected=try session.expected.copy(); defer { expected.resetBytes(in:0..<expected.count) }
            try Self.require(bytes == expected); try byteFence(bytes,session.checksum)
            let point=try current(session,bytes,session.checksum,session.revision)
            try sessionFence(session); return point
        } } catch { failed(session.inspection,error,false); throw error }
    }
    @discardableResult
    func finishPrimitiveWork(_ work: PinPrimitiveWork) -> Bool {
        condition.lock()
        let inspection=work.session.inspection
        let valid=work.owner === self && inspection.primitiveWorker === work && !work.finished
        let publishable=valid && active === inspection && inspection.session === work.session
            && !work.session.disposed && !inspection.cancelled && !inspection.sealed && !inspection.retiring
        if valid { work.finished=true; inspection.primitiveWorker=nil }
        else { inspection.sealed=true; inspection.phase = .sealed }
        condition.unlock()
        if valid { settleWorker(inspection) }; return publishable
    }
    func primitiveMaterial(_ work: PinPrimitiveWork, context: PinPrimitiveContext, bytes: Data,
                           iterations: UInt32) throws -> PinPrimitiveMaterial {
        condition.lock(); defer { condition.unlock() }
        let session=work.session, inspection=session.inspection
        try liveLocked(inspection)
        try Self.require(work.owner === self && inspection.primitiveWorker === work && !work.finished
            && context.owner === self && context.session === session && context.inspection === inspection
            && !inspection.retiring && inspection.primitiveMaterial == nil && bytes.count==96
            && UInt64(iterations)==session.policy.iterations)
        let reply=PinNativeReply(owner:self,inspection:inspection,session:session,
            kind:.primitive,bytes:bytes,checksum:session.checksum)
        let material=PinPrimitiveMaterial(owner:self,context:context,iterations:iterations,reply:reply)
        inspection.primitiveMaterial=material
        inspection.pendingReplies[ObjectIdentifier(reply)]=reply; inspection.transfers+=1
        return material
    }
    func publishPrimitiveMaterial(_ material: PinPrimitiveMaterial) throws {
        condition.lock(); defer { condition.unlock() }; let inspection=material.context.inspection
        try liveLocked(inspection)
        try Self.require(material.owner === self && inspection.primitiveMaterial === material
            && !material.published && !material.settled && inspection.primitiveWorker == nil
            && !inspection.retiring && inspection.session === material.context.session
            && inspection.pendingReplies[ObjectIdentifier(material.reply)] === material.reply)
        material.published=true
    }
    /** Internal construction can be discarded only before actual host handoff.
     * This is known non-delivery, not a reconstructed ACK or timeout release. */
    func discardUnpublishedMaterial(_ material: PinPrimitiveMaterial) {
        condition.lock(); defer { condition.unlock() }; let inspection=material.context.inspection
        if material.owner === self && inspection.primitiveMaterial === material && !material.published
            && !material.settled && inspection.pendingReplies[ObjectIdentifier(material.reply)] === material.reply
            && inspection.transfers>0 {
            material.settled=true; material.reply.settled=true; material.close()
            inspection.pendingReplies.removeValue(forKey:ObjectIdentifier(material.reply)); inspection.transfers-=1
            inspection.primitiveMaterial=nil; condition.broadcast()
        } else { inspection.sealed=true; inspection.phase = .sealed; wipeSealedLocked(inspection) }
    }
    /** Private actual-host boundary, original material/reply identities only.
     * close() only wipes. Lost/malformed delivery is .uncertain and seals.
     * No bridge or genuine host delivery adapter is supplied here. */
    func settleMaterial(_ material: PinPrimitiveMaterial, delivery: PinReplyDelivery) throws {
        condition.lock(); let inspection=material.context.inspection
        let valid=material.owner === self && inspection.primitiveMaterial === material && material.published
            && !material.settled && material.reply.owner === self && material.reply.kind == .primitive
            && material.reply.session === material.context.session && inspection.workers==0
        condition.unlock(); try Self.require(valid)
        try settleReply(material.reply,delivery:delivery)
    }

}
fileprivate enum PinPrimitiveFailure: Error { case unavailable, denied, cancelled, busy }
fileprivate enum PinPrimitiveMeasurementSource { case applePlatform, synthetic }
fileprivate protocol PinPrimitiveDisposable: AnyObject { func close() }
/** Dedicated allocated native buffers avoid String/PIN copies and Swift Array
 * copy-on-write aliases. Borrowed pointers never outlive their synchronous call.
 * Clearing our buffers cannot promise erasure of OS/provider internal memory. */
fileprivate final class PinPrimitiveBytes: PinPrimitiveDisposable {
    private let lock=NSLock(), pointer: UnsafeMutableRawPointer
    let count: Int
    private var disposed=false
    init(count: Int) throws {
        guard count>0 && count<=128 else { throw PinPrimitiveFailure.unavailable }
        self.count=count; pointer=UnsafeMutableRawPointer.allocate(byteCount:count,alignment:1)
        pointer.initializeMemory(as:UInt8.self,repeating:0,count:count)
    }
    convenience init(_ input: Data) throws {
        guard !input.isEmpty && input.count<=128 else { throw PinPrimitiveFailure.denied }
        try self.init(count:input.count)
        input.withUnsafeBytes { source in pointer.copyMemory(from:source.baseAddress!,byteCount:count) }
    }
    func read<T>(_ task: (UnsafeRawBufferPointer) throws -> T) throws -> T {
        lock.lock(); defer { lock.unlock() }
        guard !disposed else { throw PinPrimitiveFailure.unavailable }
        return try task(UnsafeRawBufferPointer(start:pointer,count:count))
    }
    func write<T>(_ task: (UnsafeMutableRawBufferPointer) throws -> T) throws -> T {
        lock.lock(); defer { lock.unlock() }
        guard !disposed else { throw PinPrimitiveFailure.unavailable }
        return try task(UnsafeMutableRawBufferPointer(start:pointer,count:count))
    }
    func copy() throws -> Data { try read { Data($0) } }
    func independentCopy() throws -> PinPrimitiveBytes {
        let result=try PinPrimitiveBytes(count:count)
        do { try read { source in try result.write { target in
            target.baseAddress!.copyMemory(from:source.baseAddress!,byteCount:count)
        } }; return result } catch { result.close(); throw error }
    }
    func equals(_ other: PinPrimitiveBytes) throws -> Bool {
        guard count==other.count && self !== other else { return false }
        return try read { left in try other.read { right in
            var difference: UInt8=0
            for index in left.indices { difference |= left[index]^right[index] }; return difference==0
        } }
    }
    func close() { lock.lock(); defer { lock.unlock() }; disposed=true; _ = memset_s(pointer,count,0,count) }
    deinit { _ = memset_s(pointer,count,0,count); pointer.deallocate() }
}
/** The future real native secure-input UI transfers each entry into a different
 * owned object and clears its own OS/UI backing. No UI/JS input adapter is
 * supplied here; creating a buffer does not authenticate a user's interaction. */
fileprivate final class PinPrimitiveInput: PinPrimitiveDisposable {
    private let lock=NSLock()
    private var storage: PinPrimitiveBytes?
    init(_ bytes: Data) throws { storage=try PinPrimitiveBytes(bytes) }
    init(owned: PinPrimitiveBytes) { storage=owned }
    func take() throws -> PinPrimitiveBytes {
        lock.lock(); defer { lock.unlock() }
        guard let result=storage else { throw PinPrimitiveFailure.denied }
        storage=nil; return result
    }
    func close() { lock.lock(); defer { lock.unlock() }; storage?.close(); storage=nil }
    deinit { close() }
}
fileprivate protocol PinPrimitiveEngine: AnyObject {
    func random(_ output: UnsafeMutableRawBufferPointer) throws
    func derive(pin: UnsafeRawBufferPointer, salt: UnsafeRawBufferPointer,
                iterations: UInt32, output: UnsafeMutableRawBufferPointer) throws
}
fileprivate protocol PinPrimitiveClock: AnyObject { func nanoseconds() throws -> UInt64 }
/** Fixed real Apple APIs. No Password String, JS secret, logging, persistent PIN
 * or CCCalibratePBKDF estimate. CCKeyDerivationPBKDF uses the exact ASCII octets.
 * Its synchronous call cannot be interrupted; cancellation discards and wipes
 * the late output while retaining both primitive and native worker ownership. */
fileprivate final class ApplePinPrimitiveEngine: PinPrimitiveEngine {
    func random(_ output: UnsafeMutableRawBufferPointer) throws {
        guard let pointer=output.baseAddress, !output.isEmpty, output.count<=128,
              SecRandomCopyBytes(kSecRandomDefault,output.count,pointer)==errSecSuccess
        else { throw PinPrimitiveFailure.unavailable }
    }
    func derive(pin: UnsafeRawBufferPointer, salt: UnsafeRawBufferPointer,
                iterations: UInt32, output: UnsafeMutableRawBufferPointer) throws {
        guard let password=pin.baseAddress, let saltPointer=salt.baseAddress, let key=output.baseAddress,
              pin.count>=4 && pin.count<=128 && pin.allSatisfy({ $0>=48 && $0<=57 })
              && salt.count==32 && output.count==32 && iterations>=600000 else { throw PinPrimitiveFailure.unavailable }
        let status=CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2),
            password.assumingMemoryBound(to:CChar.self),pin.count,
            saltPointer.assumingMemoryBound(to:UInt8.self),salt.count,
            CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),iterations,
            key.assumingMemoryBound(to:UInt8.self),output.count)
        guard status==kCCSuccess else { throw PinPrimitiveFailure.unavailable }
    }
}
fileprivate final class ApplePinPrimitiveClock: PinPrimitiveClock {
    func nanoseconds() throws -> UInt64 {
        // Apple documents MONOTONIC_RAW as the ns equivalent of continuous Mach
        // time, including sleep. The genuine authority must use this domain.
        let result=clock_gettime_nsec_np(CLOCK_MONOTONIC_RAW)
        guard result>0 else { throw PinPrimitiveFailure.unavailable }; return result
    }
}
fileprivate final class PinPrimitiveContext {
    let session: OwnedPinSession, inspection: OwnedPinInspection, owner: NativePinSessions
    let checksum: String, revision: UInt64, epoch: String, bootId: String, hostGeneration: UInt64
    let deadlineUptimeMs: UInt64, capturedUptimeMs: UInt64
    init(_ session: OwnedPinSession) {
        self.session=session; inspection=session.inspection; owner=session.owner
        checksum=session.checksum; revision=session.revision; epoch=session.epoch; bootId=session.bootId
        hostGeneration=session.hostGeneration; deadlineUptimeMs=session.deadlineUptimeMs
        capturedUptimeMs=session.capturedUptimeMs
    }
    func matches(_ other: PinPrimitiveContext) -> Bool {
        self === other && owner === other.owner && session === other.session && inspection === other.inspection
            && checksum==other.checksum && revision==other.revision && epoch==other.epoch
            && bootId==other.bootId && hostGeneration==other.hostGeneration
            && deadlineUptimeMs==other.deadlineUptimeMs && capturedUptimeMs==other.capturedUptimeMs
    }
}
/** An original measurement receipt is a one-use native-owned cost observation,
 * not Parent Gate permission, platform installation proof or trusted identity.
 * Synthetic engine/clock results remain explicitly synthetic. A future host
 * must validate actual installed-device calibration before native commit. */
fileprivate final class PinPrimitiveCalibration: PinPrimitiveDisposable {
    private let lock=NSLock()
    weak var owner: PinNativePrimitives?
    let context: PinPrimitiveContext, iterations: UInt32, samplesNs: [UInt64]
    let source: PinPrimitiveMeasurementSource, maximumDerivationMs: UInt64
    private var consumed=false
    init(owner: PinNativePrimitives, context: PinPrimitiveContext, iterations: UInt32,
         samples: [UInt64], source: PinPrimitiveMeasurementSource, maximum: UInt64) {
        self.owner=owner; self.context=context; self.iterations=iterations; samplesNs=samples
        self.source=source; maximumDerivationMs=maximum
    }
    func consume(owner candidate: PinNativePrimitives, context candidateContext: PinPrimitiveContext,
                 iterations count: UInt64, maximum: UInt64) -> Bool {
        lock.lock(); defer { lock.unlock() }
        let valid=owner === candidate && !consumed && context.matches(candidateContext)
            && UInt64(iterations)==count && maximumDerivationMs==maximum && samplesNs.count==3
        if valid { consumed=true }; return valid
    }
    func close() { lock.lock(); defer { lock.unlock() }; consumed=true }
}
fileprivate final class PinPrimitiveMaterial: PinPrimitiveDisposable {
    let owner: NativePinSessions, context: PinPrimitiveContext, iterations: UInt32, reply: PinNativeReply
    // Only the core monitor reads/writes these ownership fields.
    var published=false, settled=false
    init(owner: NativePinSessions, context: PinPrimitiveContext, iterations: UInt32, reply: PinNativeReply) {
        self.owner=owner; self.context=context; self.iterations=iterations; self.reply=reply
    }
    private func slice(_ range: Range<Int>) throws -> Data {
        guard var bytes=try reply.copyBytes(), bytes.count==96 else { throw PinPrimitiveFailure.unavailable }
        defer { bytes.resetBytes(in:0..<bytes.count) }
        return bytes.withUnsafeBytes { raw in Data(UnsafeRawBufferPointer(rebasing:raw[range])) }
    }
    // Every returned copy is owned by the native caller and must be wiped.
    func copySalt() throws -> Data { try slice(0..<32) }
    func copyCredential() throws -> Data { try slice(32..<64) }
    func copyVerifier() throws -> Data { try slice(64..<96) }
    // Retains the original pending transfer and native capacity until actual
    // private-host settlement; wiping is never a delivery/retirement ACK.
    func close() { reply.close() }
    deinit { close() }
}

fileprivate final class PinPrimitiveJob {
    let context: PinPrimitiveContext
    var cancelled=false, sealed=false, lastNs: UInt64?
    init(_ context: PinPrimitiveContext) { self.context=context }
}
/** Private real primitives, unused by App/bridge and by the nil factory.
 * Same original native session/expected record/epoch/boot/deadline throughout.
 * Native worker accounting joins actual KDF, current checks and secret wiping.
 * No timer, close request or cancellation receipt frees actual running work. */
fileprivate final class PinNativePrimitives {
    private let lock=NSLock(), owner: NativePinSessions, engine: PinPrimitiveEngine, clock: PinPrimitiveClock
    private let source: PinPrimitiveMeasurementSource, minDigits: Int, maxDigits: Int, maximumDerivationMs: UInt64
    private var active: PinPrimitiveJob?, calibration: PinPrimitiveCalibration?, disposed=false
    init(owner: NativePinSessions, minDigits: Int, maxDigits: Int, maximumDerivationMs: UInt64) throws {
        guard minDigits>=4 && maxDigits>=minDigits && maxDigits<=128
            && maximumDerivationMs>=1 && maximumDerivationMs<=5000 else { throw PinPrimitiveFailure.unavailable }
        self.owner=owner; self.minDigits=minDigits; self.maxDigits=maxDigits; self.maximumDerivationMs=maximumDerivationMs
        engine=ApplePinPrimitiveEngine(); clock=ApplePinPrimitiveClock(); source = .applePlatform
    }
    // Separate same-file fixture seam. It is never selected by production.
    private init(owner: NativePinSessions, engine: PinPrimitiveEngine, clock: PinPrimitiveClock,
                 minDigits: Int, maxDigits: Int, maximumDerivationMs: UInt64) throws {
        guard minDigits>=4 && maxDigits>=minDigits && maxDigits<=128
            && maximumDerivationMs>=1 && maximumDerivationMs<=5000 else { throw PinPrimitiveFailure.unavailable }
        self.owner=owner; self.engine=engine; self.clock=clock; self.minDigits=minDigits; self.maxDigits=maxDigits
        self.maximumDerivationMs=maximumDerivationMs; source = .synthetic
    }
    fileprivate static func synthetic(owner: NativePinSessions, engine: PinPrimitiveEngine, clock: PinPrimitiveClock,
                                      minDigits: Int=4, maxDigits: Int=128, maximumDerivationMs: UInt64=5000) throws -> PinNativePrimitives {
        try PinNativePrimitives(owner:owner,engine:engine,clock:clock,minDigits:minDigits,maxDigits:maxDigits,maximumDerivationMs:maximumDerivationMs)
    }
    private func live(_ job: PinPrimitiveJob) throws {
        lock.lock(); defer { lock.unlock() }
        guard active === job && !disposed && !job.cancelled && !job.sealed else { throw PinPrimitiveFailure.cancelled }
    }
    private func sample(_ job: PinPrimitiveJob) throws -> UInt64 {
        try live(job); let ns=try clock.nanoseconds()
        lock.lock(); defer { lock.unlock() }
        guard active === job && !disposed && !job.cancelled && !job.sealed else { throw PinPrimitiveFailure.cancelled }
        let ms=ns/1000000
        guard ns>0 && ms<=9007199254740991 && ms>=job.context.capturedUptimeMs
            && ms<job.context.deadlineUptimeMs && (job.lastNs == nil || ns>=job.lastNs!)
        else { throw PinPrimitiveFailure.unavailable }
        job.lastNs=ns; return ns
    }
    private func current(_ job: PinPrimitiveJob,_ work: PinPrimitiveWork) throws {
        try live(job)
        let point=try owner.currentPrimitiveWork(work)
        try live(job); let ns=try sample(job)
        // Domain matching is an actual authority adapter requirement, never
        // inferred from this numeric comparison or from monotonicity alone.
        guard point.uptimeMs<=ns/1000000 else { throw PinPrimitiveFailure.unavailable }
    }
    private func perform<T: PinPrimitiveDisposable>(_ context: PinPrimitiveContext, inputHandoff: PinNativeInputSession?=nil,
                                                     _ task: (PinPrimitiveJob,PinPrimitiveWork) throws -> T) throws -> T {
        lock.lock()
        guard active==nil && !disposed && context.owner === owner else { lock.unlock(); throw PinPrimitiveFailure.busy }
        let job=PinPrimitiveJob(context); active=job; lock.unlock() // Before every injected callback.
        var work: PinPrimitiveWork?, result: T?
        do {
            let lease=try owner.startPrimitiveWork(context.session,inputHandoff:inputHandoff); work=lease
            try current(job,lease); result=try task(job,lease); try current(job,lease)
            _=try sample(job)
            // All actual clock/current/engine callbacks have returned before
            // native worker settlement. The local cancellation lock prevents
            // a late primitive cancel from racing the internal handoff.
            lock.lock()
            let valid=active === job && !disposed && !job.cancelled && !job.sealed
            let nativeValid=owner.finishPrimitiveWork(lease); work=nil
            lock.unlock()
            guard valid && nativeValid, let output=result else { throw PinPrimitiveFailure.cancelled }
            if let material=output as? PinPrimitiveMaterial { try owner.publishPrimitiveMaterial(material) }
            lock.lock()
            let stillValid=active === job && !disposed && !job.cancelled && !job.sealed
            if stillValid { active=nil }; lock.unlock()
            guard stillValid else {
                if let material=output as? PinPrimitiveMaterial {
                    // Handoff is now uncertain: retain/seal original transfer.
                    try? owner.sealUnknown(context.inspection)
                }
                throw PinPrimitiveFailure.cancelled
            }
            result=nil; return output
        } catch {
            result?.close()
            if let material=result as? PinPrimitiveMaterial, !material.published { owner.discardUnpublishedMaterial(material) }
            if let lease=work { _=owner.finishPrimitiveWork(lease); work=nil }
            lock.lock()
            // Native unknown failures have their own sticky sealed lane.
            // Do not retain plaintext or a KDF result to hold capacity.
            if active === job && !job.sealed { active=nil }
            lock.unlock(); throw error
        }
    }
    private func fill(_ buffer: PinPrimitiveBytes,_ job: PinPrimitiveJob,_ work: PinPrimitiveWork) throws {
        try current(job,work); try buffer.write { try engine.random($0) }; try current(job,work)
    }
    private func pin(_ bytes: PinPrimitiveBytes) throws {
        guard bytes.count>=minDigits && bytes.count<=maxDigits else { throw PinPrimitiveFailure.denied }
        try bytes.read { data in
            guard data.allSatisfy({ $0>=48 && $0<=57 }) else { throw PinPrimitiveFailure.denied }
        }
    }
    private func measured(_ pin: PinPrimitiveBytes,_ salt: PinPrimitiveBytes,_ output: PinPrimitiveBytes,
                          iterations: UInt32,_ job: PinPrimitiveJob,_ work: PinPrimitiveWork) throws -> UInt64 {
        try current(job,work)
        let originalPin=try pin.independentCopy(), originalSalt=try salt.independentCopy()
        defer { originalPin.close(); originalSalt.close() }
        let before=try sample(job)
        try pin.read { password in try salt.read { saltBytes in
            try output.write { key in try engine.derive(pin:password,salt:saltBytes,iterations:iterations,output:key) }
        } }
        let after=try sample(job); try current(job,work)
        guard try pin.equals(originalPin), try salt.equals(originalSalt) else { throw PinPrimitiveFailure.unavailable }
        guard after>before && after-before<=maximumDerivationMs*1000000 else { throw PinPrimitiveFailure.unavailable }
        return after-before
    }
    func calibrate(_ context: PinPrimitiveContext) throws -> PinPrimitiveCalibration {
        try perform(context) { job,work in
            let iterations=context.session.policy.iterations
            guard iterations>=600000 && iterations<=context.session.policy.maximumIterations
                && iterations<=UInt64(UInt32.max) else { throw PinPrimitiveFailure.unavailable }
            let dummy=try PinPrimitiveBytes(count:maxDigits); defer { dummy.close() }
            try fill(dummy,job,work)
            try dummy.write { bytes in for index in bytes.indices { bytes[index]=48+bytes[index]%10 } }
            var samples: [UInt64]=[]
            for _ in 0..<3 {
                let salt=try PinPrimitiveBytes(count:32), output=try PinPrimitiveBytes(count:32)
                defer { salt.close(); output.close() }
                try fill(salt,job,work)
                samples.append(try measured(dummy,salt,output,iterations:UInt32(iterations),job,work))
            }
            let receipt=PinPrimitiveCalibration(owner:self,context:context,iterations:UInt32(iterations),
                samples:samples,source:source,maximum:maximumDerivationMs)
            lock.lock(); calibration?.close(); calibration=receipt; lock.unlock(); return receipt
        }
    }
    func prepare(_ context: PinPrimitiveContext, first: PinPrimitiveInput, confirmation: PinPrimitiveInput,
                 calibration receipt: PinPrimitiveCalibration) throws -> PinPrimitiveMaterial {
        try prepareOwned(context,first:first,confirmation:confirmation,calibration:receipt,inputHandoff:nil)
    }
    func prepareFromInput(_ input: PinNativeInputSession, context: PinPrimitiveContext,
                          first: PinPrimitiveInput, confirmation: PinPrimitiveInput,
                          calibration receipt: PinPrimitiveCalibration) throws -> PinPrimitiveMaterial {
        guard input.matchesPreparation(self,context:context,receipt:receipt) else {
            first.close(); confirmation.close(); throw PinPrimitiveFailure.denied
        }
        return try prepareOwned(context,first:first,confirmation:confirmation,calibration:receipt,inputHandoff:input)
    }
    private func prepareOwned(_ context: PinPrimitiveContext, first: PinPrimitiveInput, confirmation: PinPrimitiveInput,
                              calibration receipt: PinPrimitiveCalibration,inputHandoff: PinNativeInputSession?) throws -> PinPrimitiveMaterial {
        defer { first.close(); confirmation.close() }
        return try perform(context,inputHandoff:inputHandoff) { job,work in
            lock.lock()
            let valid=calibration === receipt && receipt.consume(owner:self,context:context,
                iterations:context.session.policy.iterations,maximum:maximumDerivationMs)
            if valid { calibration=nil }; lock.unlock()
            guard valid && first !== confirmation else { throw PinPrimitiveFailure.denied }
            let entered=try first.take(); defer { entered.close() }
            let repeated=try confirmation.take(); defer { repeated.close() }
            try pin(entered); try pin(repeated)
            guard entered.count==repeated.count else { throw PinPrimitiveFailure.denied }
            let difference=try entered.read { left in try repeated.read { right -> UInt8 in
                var diff: UInt8=0; for index in left.indices { diff |= left[index]^right[index] }; return diff
            } }
            guard difference==0 else { throw PinPrimitiveFailure.denied }
            repeated.close(); try current(job,work)
            let salt=try PinPrimitiveBytes(count:32), credential=try PinPrimitiveBytes(count:32), output=try PinPrimitiveBytes(count:32)
            defer { salt.close(); credential.close(); output.close() }
            try fill(salt,job,work); try fill(credential,job,work)
            _=try measured(entered,salt,output,iterations:receipt.iterations,job,work)
            var bytes=Data(count:96); defer { bytes.resetBytes(in:0..<bytes.count) }
            try bytes.withUnsafeMutableBytes { packed in
                try salt.read { packed.baseAddress!.copyMemory(from:$0.baseAddress!,byteCount:32) }
                try credential.read { packed.baseAddress!.advanced(by:32).copyMemory(from:$0.baseAddress!,byteCount:32) }
                try output.read { packed.baseAddress!.advanced(by:64).copyMemory(from:$0.baseAddress!,byteCount:32) }
            }
            return try owner.primitiveMaterial(work,context:context,bytes:bytes,iterations:receipt.iterations)
        }
    }
    func revokeInput(_ context: PinPrimitiveContext) {
        lock.lock()
        if let job=active, job.context.matches(context) { job.cancelled=true }
        if let receipt=calibration, receipt.context.matches(context) { receipt.close(); calibration=nil }
        lock.unlock()
    }
    func cancel(_ context: PinPrimitiveContext) throws {
        revokeInput(context)
        // Existing core revokes immediately, before its actual cancel callback;
        // both callbacks and KDF still count as actual workers until they settle.
        try owner.cancel(context.inspection)
    }
    func close() {
        lock.lock(); defer { lock.unlock() }; disposed=true; active?.cancelled=true
        calibration?.close(); calibration=nil
    }
    deinit { close() }
}


/** Native UIKit PIN entry mechanics only. No App/bridge/factory caller is wired.
 * The original genuine host/session/action/current/recovery admission is still
 * unavailable. A keypad tap is an input event, never Parent Gate permission.
 * Owned raw digit buffers are ephemeral; UIKit receives only public keypad
 * labels and masked length. UIKit/accessibility/OS memory erasure is not claimed. */
fileprivate enum PinNativeInputLocale { case ru, en }
fileprivate enum PinNativeInputFailure: Error { case cancelled, unavailable }
fileprivate final class PinNativeDigitBuffer {
    private let lock=NSLock(), storage: PinPrimitiveBytes
    private(set) var count=0
    let maximum: Int
    init(maximum: Int) throws {
        guard maximum>=4 && maximum<=128 else { throw PinNativeInputFailure.unavailable }
        self.maximum=maximum; storage=try PinPrimitiveBytes(count:128)
    }
    func append(_ digit: UInt8) throws {
        lock.lock(); defer { lock.unlock() }
        guard digit>=48 && digit<=57 && count<maximum else { throw PinNativeInputFailure.unavailable }
        try storage.write { $0[count]=digit }; count+=1
    }
    func removeLast() throws {
        lock.lock(); defer { lock.unlock() }
        guard count>0 else { return }; count-=1; try storage.write { $0[count]=0 }
    }
    func clear() {
        lock.lock(); defer { lock.unlock() }; count=0
        try? storage.write { _=memset_s($0.baseAddress!,128,0,128) }
    }
    func move(minimum: Int) throws -> PinPrimitiveInput {
        lock.lock(); defer { lock.unlock() }
        guard count>=minimum && count<=maximum else { throw PinNativeInputFailure.unavailable }
        let owned=try PinPrimitiveBytes(count:count)
        do {
            try storage.read { source in try owned.write { destination in
                destination.baseAddress!.copyMemory(from:source.baseAddress!,byteCount:count)
            } }
            try storage.write { _=memset_s($0.baseAddress!,128,0,128) }; count=0
            return PinPrimitiveInput(owned:owned)
        } catch { owned.close(); throw error }
    }
    deinit { storage.close() }
}
fileprivate extension PinPrimitiveCalibration {
    func validatesInput(owner candidate: PinNativePrimitives, context candidateContext: PinPrimitiveContext,
                        iterations count: UInt64, maximum: UInt64) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return owner === candidate && !consumed && context.matches(candidateContext)
            && UInt64(iterations)==count && maximumDerivationMs==maximum && samplesNs.count==3
    }
}
fileprivate extension PinNativePrimitives {
    func inputLimits() -> (Int,Int) { (minDigits,maxDigits) }
    // Original receipt identity is checked without consuming it; prepare owns
    // the actual one-use consume. UI input creates no calibration authority.
    func validateInputOriginals(_ context: PinPrimitiveContext,_ receipt: PinPrimitiveCalibration) throws {
        lock.lock(); defer { lock.unlock() }
        guard !disposed && active==nil && context.owner === owner && calibration === receipt
            && receipt.validatesInput(owner:self,context:context,iterations:context.session.policy.iterations,maximum:maximumDerivationMs)
        else { throw PinNativeInputFailure.unavailable }
    }
}
fileprivate extension NativePinSessions {
    // Denial-only local observation. It neither authenticates host-current nor
    // grants permission; actual IO/current authority fences remain mandatory.
    func inputStillLive(_ session: OwnedPinSession,input: PinNativeInputSession) -> Bool {
        condition.lock(); defer { condition.unlock() }
        let inspection=session.inspection
        return session.owner === self && active === inspection && inspection.session === session
            && !session.disposed && !inspection.cancelled && !inspection.sealed && !inspection.retiring
            && inspection.phase == .begun && inspection.nativeInput === input
    }
    func startInputWork(_ session: OwnedPinSession, input: PinNativeInputSession) throws -> PinPrimitiveWork {
        condition.lock()
        let work: PinPrimitiveWork
        do {
            try liveLocked(session.inspection)
            try Self.require(session.owner === self && session.inspection.session === session && !session.disposed
                && !session.inspection.retiring && session.inspection.phase == .begun
                && session.inspection.workers==0 && session.inspection.transfers==0
                && session.inspection.primitiveWorker==nil && session.inspection.primitiveMaterial==nil
                && session.inspection.nativeInput==nil)
            work=PinPrimitiveWork(owner:self,session:session)
            session.inspection.nativeInput=input; session.inspection.primitiveWorker=work; workerLocked(session.inspection)
        } catch { condition.unlock(); throw error }
        condition.unlock()
        do { try sessionFence(session); return work }
        catch { failed(session.inspection,error,false); _=finishInputWork(work,input:input); throw error }
    }
    func deliverInputMaterial(_ material: PinPrimitiveMaterial,_ task: () throws -> Void) throws {
        let session=material.context.session, inspection=session.inspection
        condition.lock()
        do {
            try liveLocked(inspection)
            try Self.require(material.owner === self && inspection.primitiveMaterial === material
                && material.published && !material.settled && inspection.pendingReplies[ObjectIdentifier(material.reply)] === material.reply
                && inspection.workers==0 && inspection.nativeInput?.matchesContext(material.context) == true && inspection.nativeInputHandoff && inspection.primitiveWorker==nil)
            workerLocked(inspection)
        } catch { condition.unlock(); throw error }
        condition.unlock()
        defer { settleWorker(inspection) } // The same actual delivery executor.
        func fence() throws {
            try io.locked { transaction in
                try sessionFence(session)
                var returned=try transaction.read(); defer { returned.resetBytes(in:0..<returned.count) }; try bounded(returned)
                var expected=try session.expected.copy(); defer { expected.resetBytes(in:0..<expected.count) }
                try Self.require(returned==expected); try byteFence(returned,session.checksum)
                _=try current(session,returned,session.checksum,session.revision); try sessionFence(session)
            }
        }
        do { try fence(); try task(); try fence() }
        catch { failed(inspection,error,false); material.close(); throw error }
    }
    func deliverInputFailure(_ session: OwnedPinSession,_ task: () throws -> Void) throws {
        let inspection=session.inspection
        condition.lock()
        do {
            try ownLocked(inspection)
            // A denial callback has no PIN/material/permission payload. It still
            // joins actual native work; no callback starts past retirement fence.
            try Self.require(session.owner === self && inspection.session === session && !inspection.retirementFenced)
            workerLocked(inspection)
        } catch { condition.unlock(); throw error }
        condition.unlock(); defer { settleWorker(inspection) }
        do { try task() } catch { failed(inspection,error,false); throw error }
    }
    func releaseInput(_ session: OwnedPinSession,input: PinNativeInputSession) {
        condition.lock(); defer { condition.unlock() }
        let inspection=session.inspection
        if inspection.nativeInput === input { inspection.nativeInput=nil; inspection.nativeInputHandoff=false; condition.broadcast() }
    }
    @discardableResult
    func finishInputWork(_ work: PinPrimitiveWork,input: PinNativeInputSession) -> Bool {
        condition.lock()
        let inspection=work.session.inspection
        let valid=work.owner === self && inspection.nativeInput === input && inspection.primitiveWorker === work
        if valid { inspection.nativeInputHandoff=true }
        condition.unlock()
        if !valid { try? sealUnknown(inspection); return false }
        return finishPrimitiveWork(work) // The same dedicated executor thread.
    }
}
/** One native input request owns one dedicated executor and one original core
 * worker. That executor performs IO/cancel and joins all main UI callbacks.
 * Main does no protected IO, KDF, worker settlement or native retirement.
 * Completion may hand off original material to a future private native host;
 * no implementation or successful transport ACK is supplied here. */
fileprivate final class PinNativeInputSession {
    private let condition=NSCondition()
    private let primitives: PinNativePrimitives, context: PinPrimitiveContext, receipt: PinPrimitiveCalibration
    private let locale: PinNativeInputLocale, minimum: Int, maximum: Int, clock: PinPrimitiveClock
    private let delivered: (Result<PinPrimitiveMaterial,PinNativeInputFailure>) throws -> Void
    private weak var host: UIViewController?
    private weak var window: UIWindow?
    private weak var scene: UIWindowScene?
    private weak var originalRoot: UIViewController?
    private let digits: PinNativeDigitBuffer
    private var controller: PinNativePinViewController?
    private var timer: Timer?, observers=[NSObjectProtocol]()
    // Every state field below is read/written under condition; only UIKit
    // objects, digits and observer/timer registrations are main-thread owned.
    private var started=false, terminal=false, cancelled=false, submitted=false, uiClean=false, finished=false
    private var queuedUI=0, executingUI=0, completions=0, presentationRequested=false, presentationReturned=false
    private var dismissRequested=false, cancellationStarted=false, cancellationPending=0, lastNs: UInt64?
    private var first: PinPrimitiveInput?, confirmation: PinPrimitiveInput?
    init(primitives: PinNativePrimitives, context: PinPrimitiveContext, calibration: PinPrimitiveCalibration,
         host: UIViewController, locale: PinNativeInputLocale, minimum: Int, maximum: Int,
         delivered: @escaping (Result<PinPrimitiveMaterial,PinNativeInputFailure>) throws -> Void) throws {
        guard Thread.isMainThread, minimum>=4, maximum>=minimum, maximum<=128,
            let window=host.viewIfLoaded?.window, let scene=window.windowScene,
            scene.activationState == .foregroundActive, UIApplication.shared.applicationState == .active,
            !window.isHidden, !host.isBeingDismissed, host.presentedViewController==nil,
            let root=window.rootViewController else { throw PinNativeInputFailure.unavailable }
        let limits=primitives.inputLimits()
        guard minimum==limits.0 && maximum==limits.1 else { throw PinNativeInputFailure.unavailable }
        try primitives.validateInputOriginals(context,calibration)
        self.primitives=primitives; self.context=context; receipt=calibration; self.host=host
        self.window=window; self.scene=scene; originalRoot=root; self.locale=locale
        self.minimum=minimum; self.maximum=maximum; self.delivered=delivered
        clock=ApplePinPrimitiveClock(); digits=try PinNativeDigitBuffer(maximum:maximum)
    }
    func matchesContext(_ candidate: PinPrimitiveContext) -> Bool { context.matches(candidate) }
    func matchesSession(_ session: OwnedPinSession) -> Bool { context.session === session && context.owner === session.owner }
    func matchesPreparation(_ candidate: PinNativePrimitives,context candidateContext: PinPrimitiveContext,
                            receipt candidateReceipt: PinPrimitiveCalibration) -> Bool {
        primitives === candidate && context.matches(candidateContext) && receipt === candidateReceipt
    }
    func start() throws {
        guard Thread.isMainThread else { throw PinNativeInputFailure.unavailable }
        condition.lock()
        guard !started else { condition.unlock(); throw PinNativeInputFailure.unavailable }
        started=true; condition.unlock()
        // No injected executor, new deadline, stored PIN or JS callback.
        Thread { [self] in run() }.start()
    }
    private func postUI(_ task: @escaping () -> Void) {
        condition.lock(); queuedUI+=1; condition.unlock()
        DispatchQueue.main.async { [self] in
            condition.lock(); queuedUI-=1; executingUI+=1; condition.unlock()
            defer { condition.lock(); executingUI-=1; condition.broadcast(); condition.unlock() }
            task()
        }
    }
    private func event(_ task: () -> Void) {
        precondition(Thread.isMainThread)
        condition.lock(); executingUI+=1; condition.unlock()
        defer { condition.lock(); executingUI-=1; condition.broadcast(); condition.unlock() }; task()
    }
    private func localDeadline() throws {
        let ns=try clock.nanoseconds()
        guard context.owner.inputStillLive(context.session,input:self) else {
            throw PinNativeInputFailure.cancelled
        }
        condition.lock(); defer { condition.unlock() }
        guard ns>0, ns/1000000>=context.capturedUptimeMs, ns/1000000<context.deadlineUptimeMs,
            lastNs==nil || ns>=lastNs! else { throw PinNativeInputFailure.unavailable }
        lastNs=ns
    }
    private func hostCurrent(showing: Bool) -> Bool {
        guard Thread.isMainThread, let host=host, let window=window, let scene=scene,
            window.windowScene === scene, window.rootViewController === originalRoot, !window.isHidden,
            scene.activationState == .foregroundActive, UIApplication.shared.applicationState == .active,
            !host.isBeingDismissed else { return false }
        if !showing { return host.viewIfLoaded?.window === window && host.presentedViewController==nil }
        // A modal legitimately changes host focus/topmost visibility. Bind its
        // exact original presentation chain/window/scene, not host viewDidAppear.
        guard let controller=controller, host.presentedViewController === controller,
            controller.presentingViewController === host else { return false }
        condition.lock(); let returned=presentationReturned; condition.unlock()
        return !returned || controller.viewIfLoaded?.window === window
    }
    private func installLifecycle() {
        let center=NotificationCenter.default
        for name in [UIApplication.willResignActiveNotification,UIApplication.didEnterBackgroundNotification] {
            observers.append(center.addObserver(forName:name,object:nil,queue:.main) { [weak self] _ in self?.cancel() })
        }
        if let scene=scene {
            for name in [UIScene.willDeactivateNotification,UIScene.didEnterBackgroundNotification,UIScene.didDisconnectNotification] {
                observers.append(center.addObserver(forName:name,object:scene,queue:.main) { [weak self] _ in self?.cancel() })
            }
        }
        timer=Timer.scheduledTimer(withTimeInterval:0.05,repeats:true) { [weak self] _ in
            guard let input=self else { return }
            input.event {
                input.condition.lock()
                let stopped=input.cancelled || input.finished
                let cleaned=input.uiClean
                let transitioning=input.terminal && !cleaned
                input.condition.unlock()
                if stopped { return }
                do { try input.localDeadline()
                    if transitioning { return } // Deadline still revokes/wipes during an owned transition.
                    guard input.hostCurrent(showing:!cleaned) else { input.cancel(); return }
                } catch { input.cancel() }
            }
        }
        if let timer=timer { RunLoop.main.add(timer,forMode:.common) }
    }
    private func show() {
        precondition(Thread.isMainThread)
        condition.lock(); let stopped=terminal; condition.unlock()
        if stopped { clearUI(); return }
        do { try localDeadline(); guard hostCurrent(showing:false),let host=host else { cancel(); return }
            let view=PinNativePinViewController(owner:self,locale:locale,minimum:minimum,maximum:maximum)
            controller=view; view.modalPresentationStyle = .overFullScreen; view.isModalInPresentation=true
            installLifecycle()
            condition.lock(); presentationRequested=true; completions+=1; condition.unlock()
            host.present(view,animated:false) { [self] in event {
                condition.lock(); presentationReturned=true; completions-=1; let stopped=terminal; condition.broadcast(); condition.unlock()
                if stopped { requestDismiss() }
                else if !hostCurrent(showing:true) { cancel() }
            } }
        } catch { cancel() }
    }
    private func clearUI() {
        precondition(Thread.isMainThread)
        digits.clear(); controller?.disableAndClear()
        requestDismiss()
    }
    private func removeLifecycle() {
        precondition(Thread.isMainThread)
        timer?.invalidate(); timer=nil
        let center=NotificationCenter.default; observers.forEach { center.removeObserver($0) }; observers.removeAll()
    }
    private func requestDismiss() {
        precondition(Thread.isMainThread)
        condition.lock()
        if dismissRequested { condition.unlock(); return }
        if presentationRequested && !presentationReturned { condition.unlock(); return } // Join actual presentation completion.
        guard let view=controller else { uiClean=true; condition.broadcast(); condition.unlock(); return }
        dismissRequested=true
        let presented=view.presentingViewController != nil
        if presented { completions+=1 }; condition.unlock()
        if presented {
            // UIKit's concrete original presenter owns this dismissal. A lost
            // completion remains pending even if the visible modal disappears.
            let presenter=view.presentingViewController!
            presenter.dismiss(animated:false) { [self] in event {
                condition.lock(); completions-=1; uiClean=true; condition.broadcast(); condition.unlock()
            } }
        } else {
            // Actual presentation completion returned and UIKit owns no modal.
            condition.lock(); uiClean=true; condition.broadcast(); condition.unlock()
        }
    }
    func cancel() {
        precondition(Thread.isMainThread)
        event {
            condition.lock()
            let already=cancelled; terminal=true; cancelled=true
            first?.close(); first=nil; confirmation?.close(); confirmation=nil
            condition.broadcast(); condition.unlock()
            if !already {
                clearUI()
                // Pure immediate revocation on main; protected cancellation IO
                // runs on its own actual counted native worker, never main.
                primitives.revokeInput(context)
                beginCancellation()
            }
        }
    }
    private func beginCancellation() {
        condition.lock()
        if cancellationStarted { condition.unlock(); return }
        cancellationStarted=true; cancellationPending+=1; condition.unlock()
        Thread { [self] in
            do { try primitives.cancel(context) } catch { try? context.owner.sealUnknown(context.inspection) }
            condition.lock(); cancellationPending-=1; condition.broadcast(); condition.unlock()
        }.start()
    }
    func disappeared() {
        precondition(Thread.isMainThread)
        condition.lock(); let expected=terminal && dismissRequested; condition.unlock()
        if !expected { cancel() }
    }
    func tapDigit(_ digit: UInt8) {
        event {
            condition.lock(); let stopped=terminal; condition.unlock(); guard !stopped else { return }
            do { try localDeadline(); guard hostCurrent(showing:true) else { cancel(); return }
                if digits.count>=maximum { return }
                try digits.append(digit); controller?.update(count:digits.count)
            } catch { cancel() }
        }
    }
    func deleteDigit() {
        event {
            condition.lock(); let stopped=terminal; condition.unlock(); guard !stopped else { return }
            do { try localDeadline(); guard hostCurrent(showing:true) else { cancel(); return }
                try digits.removeLast(); controller?.update(count:digits.count)
            } catch { cancel() }
        }
    }
    func next() {
        event {
            condition.lock(); let stopped=terminal; let confirming=first != nil; condition.unlock(); guard !stopped else { return }
            do {
                try localDeadline(); guard hostCurrent(showing:true) else { cancel(); return }
                let input=try digits.move(minimum:minimum)
                condition.lock()
                if terminal { condition.unlock(); input.close(); return }
                if !confirming { first=input; condition.unlock(); controller?.confirm(); controller?.update(count:0) }
                else {
                    let previous=first; first=nil; condition.unlock()
                    guard let previous=previous else { input.close(); throw PinNativeInputFailure.unavailable }
                    var left: PinPrimitiveBytes?, right: PinPrimitiveBytes?
                    do {
                        left=try previous.take(); right=try input.take()
                        guard try left!.equals(right!) else {
                            left?.close(); right?.close(); controller?.restartAfterMismatch(); controller?.update(count:0); return
                        }
                        condition.lock()
                        if terminal { condition.unlock(); left?.close(); right?.close(); return }
                        first=PinPrimitiveInput(owned:left!); confirmation=PinPrimitiveInput(owned:right!)
                        left=nil; right=nil; terminal=true; submitted=true; condition.broadcast(); condition.unlock(); clearUI()
                    } catch { left?.close(); right?.close(); throw error }
                }
            } catch { cancel() }
        }
    }
    private func run() {
        var work: PinPrimitiveWork?, output: PinPrimitiveMaterial?
        var deliveryEntered=false
        do {
            try primitives.validateInputOriginals(context,receipt)
            work=try context.owner.startInputWork(context.session,input:self) // Same executor settles it.
            _=try context.owner.currentPrimitiveWork(work!)
            postUI { [self] in show() }
            condition.lock()
            while true {
                if terminal && uiClean && queuedUI==0 && executingUI==0 && completions==0 && cancellationPending==0 { break }
                condition.wait()
            }
            let accepted=submitted && !cancelled
            let ownedFirst=first, ownedConfirmation=confirmation; first=nil; confirmation=nil
            condition.unlock()
            let nativeValid=context.owner.finishInputWork(work!,input:self); work=nil
            defer { ownedFirst?.close(); ownedConfirmation?.close() }
            guard accepted && nativeValid,let first=ownedFirst,let confirmation=ownedConfirmation else { throw PinNativeInputFailure.cancelled }
            // Actual UIKit work has settled. Existing prepare registers its own
            // synchronous worker; late cancel/retire/host-current/deadline denies.
            output=try primitives.prepareFromInput(self,context:context,first:first,confirmation:confirmation,calibration:receipt)
            try context.owner.deliverInputMaterial(output!) {
                condition.lock(); let accepted = !cancelled; condition.unlock()
                guard accepted else { throw PinNativeInputFailure.cancelled }
                deliveryEntered=true; try delivered(.success(output!))
            }
            output=nil
        } catch {
            output?.close()
            if output != nil { try? context.owner.sealUnknown(context.inspection) } // Unknown original material handoff.
            if let owned=work {
                postUI { [self] in cancel() }
                condition.lock()
                while !uiClean || queuedUI != 0 || executingUI != 0 || completions != 0 || cancellationPending != 0 { condition.wait() }
                first?.close(); first=nil; confirmation?.close(); confirmation=nil; condition.unlock()
                _=context.owner.finishInputWork(owned,input:self); work=nil
            }
            if !deliveryEntered {
                try? context.owner.deliverInputFailure(context.session) {
                    try delivered(.failure(error is PinNativeInputFailure ? .cancelled:.unavailable))
                }
            }
        }
        postUI { [self] in removeLifecycle(); controller=nil }
        condition.lock()
        while queuedUI != 0 || executingUI != 0 || completions != 0 || cancellationPending != 0 { condition.wait() }
        condition.unlock()
        context.owner.releaseInput(context.session,input:self)
        condition.lock(); finished=true; condition.broadcast(); condition.unlock()
    }
    deinit { timer?.invalidate(); observers.forEach { NotificationCenter.default.removeObserver($0) }; first?.close(); confirmation?.close() }
}
/** Actual UIKit digit keypad; no UITextField, keyboard, paste, String PIN,
 * restoration identifier, screenshot cache or native/JS serialization path.
 * Public digit button labels are not entered PIN values. VoiceOver exposes
 * action names and masked length; system-managed speech memory is out of scope. */
fileprivate final class PinNativePinViewController: UIViewController {
    private weak var owner: PinNativeInputSession?
    private let locale: PinNativeInputLocale, minimum: Int, maximum: Int
    private let titleLabel=UILabel(), countLabel=UILabel(), hintLabel=UILabel(), continueButton=UIButton(type:.system)
    private var inputButtons=[UIButton]()
    init(owner: PinNativeInputSession,locale: PinNativeInputLocale,minimum: Int,maximum: Int) {
        self.owner=owner; self.locale=locale; self.minimum=minimum; self.maximum=maximum; super.init(nibName:nil,bundle:nil)
    }
    required init?(coder: NSCoder) { return nil }
    private func text(_ ru: String,_ en: String) -> String { locale == .ru ? ru:en }
    override func viewDidLoad() {
        super.viewDidLoad()
        let navy=UIColor(red:0.025,green:0.06,blue:0.12,alpha:1), gold=UIColor(red:0.84,green:0.72,blue:0.46,alpha:1)
        view.backgroundColor=navy; view.tintColor=gold; view.accessibilityViewIsModal=true
        let scroll=UIScrollView(), stack=UIStackView(); scroll.translatesAutoresizingMaskIntoConstraints=false
        stack.translatesAutoresizingMaskIntoConstraints=false; stack.axis = .vertical; stack.spacing=16
        view.addSubview(scroll); scroll.addSubview(stack)
        NSLayoutConstraint.activate([
            scroll.leadingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.trailingAnchor),
            scroll.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),
            scroll.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo:scroll.contentLayoutGuide.leadingAnchor,constant:24),
            stack.trailingAnchor.constraint(equalTo:scroll.contentLayoutGuide.trailingAnchor,constant:-24),
            stack.topAnchor.constraint(equalTo:scroll.contentLayoutGuide.topAnchor,constant:24),
            stack.bottomAnchor.constraint(equalTo:scroll.contentLayoutGuide.bottomAnchor,constant:-24),
            stack.widthAnchor.constraint(equalTo:scroll.frameLayoutGuide.widthAnchor,constant:-48)
        ])
        for label in [titleLabel,countLabel,hintLabel] { label.numberOfLines=0; label.textAlignment = .center; label.adjustsFontForContentSizeCategory=true; label.textColor = .white; stack.addArrangedSubview(label) }
        titleLabel.textColor=gold; titleLabel.font = .preferredFont(forTextStyle:.title2); titleLabel.accessibilityTraits.insert(.header)
        titleLabel.text=text("Создайте PIN","Create PIN")
        countLabel.font = .preferredFont(forTextStyle:.title1)
        hintLabel.font = .preferredFont(forTextStyle:.body)
        hintLabel.text=text("От \(minimum) до \(maximum) цифр","\(minimum) to \(maximum) digits")
        let labels=[["1","2","3"],["4","5","6"],["7","8","9"],["⌫","0",""]]
        for row in labels {
            let line=UIStackView(); line.axis = .horizontal; line.spacing=12; line.distribution = .fillEqually
            for label in row {
                let button=UIButton(type:.system); button.setTitle(label,for:.normal)
                button.titleLabel?.font = .preferredFont(forTextStyle:.title1); button.titleLabel?.adjustsFontForContentSizeCategory=true
                button.setTitleColor(.white,for:.normal); button.tintColor=gold
                button.backgroundColor=UIColor(red:0.065,green:0.12,blue:0.20,alpha:1); button.layer.cornerRadius=12
                button.heightAnchor.constraint(greaterThanOrEqualToConstant:56).isActive=true
                if let digit=Int(label) { button.tag=digit; button.addTarget(self,action:#selector(digitTap(_:)),for:.touchUpInside) }
                else if label=="⌫" { button.accessibilityLabel=text("Удалить последнюю цифру","Delete last digit"); button.addTarget(self,action:#selector(deleteTap),for:.touchUpInside) }
                else { button.isEnabled=false; button.isHidden=true }
                line.addArrangedSubview(button); inputButtons.append(button)
            }
            stack.addArrangedSubview(line)
        }
        continueButton.setTitle(text("Продолжить","Continue"),for:.normal)
        continueButton.backgroundColor=gold; continueButton.setTitleColor(navy,for:.normal); continueButton.layer.cornerRadius=12
        continueButton.titleLabel?.font = .preferredFont(forTextStyle:.headline); continueButton.titleLabel?.adjustsFontForContentSizeCategory=true
        continueButton.heightAnchor.constraint(greaterThanOrEqualToConstant:48).isActive=true
        continueButton.addTarget(self,action:#selector(nextTap),for:.touchUpInside); stack.addArrangedSubview(continueButton)
        let cancel=UIButton(type:.system); cancel.setTitle(text("Отмена","Cancel"),for:.normal)
        cancel.titleLabel?.font = .preferredFont(forTextStyle:.body); cancel.titleLabel?.adjustsFontForContentSizeCategory=true
        cancel.heightAnchor.constraint(greaterThanOrEqualToConstant:48).isActive=true
        cancel.addTarget(self,action:#selector(cancelTap),for:.touchUpInside); stack.addArrangedSubview(cancel); update(count:0)
    }
    override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated); owner?.disappeared() }
    func confirm() { titleLabel.text=text("Повторите PIN","Confirm PIN"); UIAccessibility.post(notification:.screenChanged,argument:titleLabel) }
    func restartAfterMismatch() {
        titleLabel.text=text("Создайте PIN","Create PIN")
        hintLabel.text=text("PIN не совпали. Введите заново.","PINs did not match. Enter again.")
        UIAccessibility.post(notification:.screenChanged,argument:titleLabel)
    }
    func update(count: Int) {
        // Only length is rendered/announced; never format entered digit bytes.
        countLabel.text=String(repeating:"•",count:min(count,12))
        countLabel.accessibilityLabel=text("Введено цифр: \(count)","Digits entered: \(count)")
        continueButton.isEnabled=count>=minimum && count<=maximum
    }
    func disableAndClear() {
        inputButtons.forEach { $0.isEnabled=false }; continueButton.isEnabled=false
        countLabel.text=""; countLabel.accessibilityLabel=text("Ввод закрыт","Input closed")
    }
    @objc private func digitTap(_ sender: UIButton) { guard sender.tag>=0 && sender.tag<=9 else { return }; owner?.tapDigit(UInt8(sender.tag)+48) }
    @objc private func deleteTap() { owner?.deleteDigit() }
    @objc private func nextTap() { owner?.next() }
    @objc private func cancelTap() { owner?.cancel() }
}
// Genuine host construction/admission and native recovery remain unavailable.
// This UI has no bridge/plugin registration and is never selected by App flags.

/** Closed canonical attempt planner only. It supplies no native checkpoint,
 * durable pre-KDF reservation, trusted time, PIN comparison or Parent Gate proof.
 * A future verification provider must durably CAS both exact full-record plans
 * under genuine authority; cancellation/crash can never refund a charged record. */
fileprivate struct PinAttemptMetadata {
    let revision: UInt64, pinRevision: UInt64, count: UInt64
    let blockedUntilMs: UInt64, lastObservedMs: UInt64, logicalAnchorMs: UInt64
    let pendingAttemptId: String?
    let rootRevision: Range<Int>, pinRevisionBytes: Range<Int>, attemptsBytes: Range<Int>
}
fileprivate extension PlanetChildVault.ProtectedEnvelope {
    /** Reuse the already validated ordered envelope. Parse only its bounded PIN
     * slice to locate numeric/attempt bytes; credential/verifier bytes are copied
     * verbatim, including the original fixed algorithm/salt/hash/iteration value. */
    func attemptMetadata() throws -> PinAttemptMetadata {
        lock.lock(); defer { lock.unlock() }; try Self.require(!disposed && pin != nil)
        var pinBytes=storage.copy(pinStart..<pinEnd); defer { pinBytes.resetBytes(in:0..<pinBytes.count) }
        let owned=Storage(pinBytes); defer { owned.wipe() }; let cursor=Cursor(owned)
        try cursor.field("schemaVersion",first:true); _=try cursor.number(1,1)
        try cursor.field("policyVersion"); try Self.require(cursor.asciiString()==policyVersion)
        try cursor.field("revision"); let pinRevisionStart=cursor.index
        let pinRevision=try cursor.number(1,9007199254740991), pinRevisionEnd=cursor.index
        try cursor.field("credentialId"); _=try cursor.hashRange()
        try cursor.field("verifier"); try cursor.field("algorithm",first:true)
        try Self.require(cursor.asciiString()=="PBKDF2-HMAC-SHA256")
        try cursor.field("iterations"); _=try cursor.number(600000,maxIterations)
        try cursor.field("saltHex"); _=try cursor.hashRange()
        try cursor.field("hashHex"); _=try cursor.hashRange(); try cursor.token("}")
        try cursor.field("attempts"); let attemptsStart=cursor.index
        try cursor.field("count",first:true); let count=try cursor.number(0,9007199254740991)
        try cursor.field("blockedUntilMs"); let blocked=try cursor.number(0,9007199254740991)
        try cursor.field("lastObservedMs"); let observed=try cursor.number(0,9007199254740991)
        try cursor.field("pendingAttemptId"); let pending=try cursor.nullableString()
        try cursor.token("}"); let attemptsEnd=cursor.index; try cursor.token("}")
        try Self.require(cursor.index==owned.count && (pending==nil || Self.hash(pending!)))
        let rootStart=Array("{\"schemaVersion\":1,\"revision\":".utf8).count
        return PinAttemptMetadata(revision:revision,pinRevision:pinRevision,count:count,
            blockedUntilMs:blocked,lastObservedMs:observed,logicalAnchorMs:logicalAnchorMs,pendingAttemptId:pending,
            rootRevision:rootStart..<revisionEnd,pinRevisionBytes:(pinStart+pinRevisionStart)..<(pinStart+pinRevisionEnd),
            attemptsBytes:(pinStart+attemptsStart)..<(pinStart+attemptsEnd))
    }
    func planAttempt(_ metadata: PinAttemptMetadata, rootRevision: UInt64, pinRevision: UInt64,
                     count: UInt64, blockedUntilMs: UInt64, observedMs: UInt64, pendingId: String?) throws -> Data {
        lock.lock(); defer { lock.unlock() }; try Self.require(!disposed && pin != nil)
        try Self.require(rootRevision>=1 && rootRevision<=9007199254740991 && pinRevision>=1 && pinRevision<=9007199254740991
            && count<=9007199254740991 && blockedUntilMs<=9007199254740991 && observedMs<=9007199254740991
            && (pendingId==nil || Self.hash(pendingId!)))
        try Self.require(metadata.revision==revision && metadata.pinRevision==pin?.revision
            && metadata.rootRevision.lowerBound>=0 && metadata.rootRevision.upperBound==revisionEnd
            && metadata.pinRevisionBytes.lowerBound>=pinStart && metadata.pinRevisionBytes.upperBound<=pinEnd
            && metadata.attemptsBytes.lowerBound>=metadata.pinRevisionBytes.upperBound && metadata.attemptsBytes.upperBound<=pinEnd)
        var original=storage.copy(); defer { original.resetBytes(in:0..<original.count) }
        let pending=pendingId.map { "\"" + $0 + "\"" } ?? "null"
        // Decimal UInt64 values and validated lowercase hex identifiers only.
        // No entered PIN, JSON parser/serializer or unrelated record field is reconstructed.
        let attempts="{\"count\":\(count),\"blockedUntilMs\":\(blockedUntilMs),\"lastObservedMs\":\(observedMs),\"pendingAttemptId\":\(pending)}"
        var result=Data(); var accepted=false
        defer { if !accepted { result.resetBytes(in:0..<result.count) } }
        result.append(original[0..<metadata.rootRevision.lowerBound]); result.append(contentsOf:String(rootRevision).utf8)
        result.append(original[metadata.rootRevision.upperBound..<metadata.pinRevisionBytes.lowerBound])
        result.append(contentsOf:String(pinRevision).utf8)
        result.append(original[metadata.pinRevisionBytes.upperBound..<metadata.attemptsBytes.lowerBound])
        result.append(contentsOf:attempts.utf8); result.append(original[metadata.attemptsBytes.upperBound..<original.count])
        try Self.require(!result.isEmpty && result.count<=131072)
        let decoded=try Self.decode(result,policyVersion:policyVersion,policyChecksum:policyChecksum,maxIterations:maxIterations)
        defer { decoded.close() }
        accepted=true; return result
    }
}
fileprivate enum PinAttemptComparison { case match, mismatch }
fileprivate final class PinAttemptReservation {
    fileprivate weak var owner: PinAttemptJournal?
    let challengeId: String, count: UInt64, delayMs: UInt64, reservedLogicalMs: UInt64
    let rootRevision: UInt64, pinRevision: UInt64, checksum: String
    private let lock=NSLock(), expected: PinOwnedBytes, reserved: PinOwnedBytes
    private var disposed=false, consumed=false
    fileprivate init(owner: PinAttemptJournal, expected: Data, reserved: Data,
                     challengeId: String, count: UInt64, delayMs: UInt64, logicalMs: UInt64,
                     rootRevision: UInt64, pinRevision: UInt64, checksum: String) {
        self.owner=owner; self.expected=PinOwnedBytes(expected); self.reserved=PinOwnedBytes(reserved)
        self.challengeId=challengeId; self.count=count; self.delayMs=delayMs; reservedLogicalMs=logicalMs
        self.rootRevision=rootRevision; self.pinRevision=pinRevision; self.checksum=checksum
    }
    func copyExpectedBytes() throws -> Data { lock.lock(); defer { lock.unlock() }; try NativePinSessions.require(!disposed); return try expected.copy() }
    func copyReservedBytes() throws -> Data { lock.lock(); defer { lock.unlock() }; try NativePinSessions.require(!disposed); return try reserved.copy() }
    fileprivate func consume(_ journal: PinAttemptJournal) throws -> Data {
        lock.lock(); defer { lock.unlock() }; let used=consumed; consumed=true
        try NativePinSessions.require(owner === journal && !used && !disposed)
        return try reserved.copy()
    }
    func close() { lock.lock(); defer { lock.unlock() }; disposed=true; expected.close(); reserved.close() }
    deinit { close() }
}
fileprivate final class PinAttemptFinalization {
    fileprivate weak var owner: PinAttemptJournal?
    private let lock=NSLock(), expected: PinOwnedBytes, next: PinOwnedBytes
    let checksum: String, rootRevision: UInt64, pinRevision: UInt64
    private var disposed=false
    fileprivate init(owner: PinAttemptJournal, expected: Data, next: Data, checksum: String, rootRevision: UInt64, pinRevision: UInt64) {
        self.owner=owner; self.expected=PinOwnedBytes(expected); self.next=PinOwnedBytes(next)
        self.checksum=checksum; self.rootRevision=rootRevision; self.pinRevision=pinRevision
    }
    // All copies first join the original owner's lifetime and identity gate.
    // Lock order is journal -> result -> byte backing; close never calls upward.
    func copyExpectedBytes() throws -> Data {
        guard let original=owner else { throw PlanetChildVault.Failure.unavailable }
        return try original.copyFinalization(self,expected:true)
    }
    func copyNextBytes() throws -> Data {
        guard let original=owner else { throw PlanetChildVault.Failure.unavailable }
        return try original.copyFinalization(self,expected:false)
    }
    fileprivate func copyOwnedBytes(expected takeExpected: Bool) throws -> Data {
        lock.lock(); defer { lock.unlock() }; try NativePinSessions.require(!disposed)
        return try (takeExpected ? expected : next).copy()
    }
    func close() { lock.lock(); defer { lock.unlock() }; disposed=true; expected.close(); next.close() }
    deinit { close() }
}
fileprivate final class PinAttemptJournal {
    private static let maximum: UInt64=9007199254740991
    private let lock=NSLock(), version: String, policyChecksum: String, maximumIterations: UInt64, delays: [UInt64]
    private var reserveEntered=false, finalizeEntered=false, disposed=false, active: PinAttemptReservation?
    private var finalization: PinAttemptFinalization?
    init(policyVersion: String, policyChecksum: String, maxIterations: UInt64, backoffDelaysMs: [UInt64]) throws {
        let versionBytes=Array(policyVersion.utf8)
        let alphanumeric: (UInt8)->Bool = { $0>=48 && $0<=57 || $0>=65 && $0<=90 || $0>=97 && $0<=122 }
        try NativePinSessions.require(!versionBytes.isEmpty && versionBytes.count<=96 && alphanumeric(versionBytes[0])
            && versionBytes.allSatisfy { alphanumeric($0) || $0==46 || $0==95 || $0==45 }
            && NativePinSessions.hash(policyChecksum) && maxIterations>=600000 && maxIterations<=0xffffffff
            && !backoffDelaysMs.isEmpty && backoffDelaysMs.count<=64)
        var previous: UInt64=0
        for delay in backoffDelaysMs { try NativePinSessions.require(delay>previous && delay<=Self.maximum); previous=delay }
        version=policyVersion; self.policyChecksum=policyChecksum; maximumIterations=maxIterations; delays=backoffDelaysMs
    }
    private static func add(_ left: UInt64,_ right: UInt64) throws -> UInt64 {
        try NativePinSessions.require(left<=maximum && right<=maximum-left); return left+right
    }
    private static func digest(_ value: Data) -> String { SHA256.hash(data:value).map { String(format:"%02x",$0) }.joined() }
    private static func bounded(_ bytes: Data) throws { try NativePinSessions.require(!bytes.isEmpty && bytes.count<=131072) }
    private func envelope(_ bytes: Data) throws -> PlanetChildVault.ProtectedEnvelope {
        try PlanetChildVault.ProtectedEnvelope.decode(bytes,policyVersion:version,policyChecksum:policyChecksum,maxIterations:maximumIterations)
    }
    /** Reserve exactly once for this closed owner, including rejected input.
     * Returned bytes are a structural CAS plan, not evidence of durable charge. */
    func reserve(_ current: Data, originalChallengeId: String, sampledLogicalMs: UInt64) throws -> PinAttemptReservation {
        lock.lock()
        let available = !disposed && !reserveEntered; if available { reserveEntered=true }
        lock.unlock(); try NativePinSessions.require(available)
        try Self.bounded(current); try NativePinSessions.require(NativePinSessions.hash(originalChallengeId) && sampledLogicalMs<=Self.maximum)
        var owned=Data(Array(current)); defer { owned.resetBytes(in:0..<owned.count) }
        let before=try envelope(owned); defer { before.close() }; let meta=try before.attemptMetadata()
        try NativePinSessions.require(sampledLogicalMs>=meta.logicalAnchorMs && sampledLogicalMs>=meta.lastObservedMs
            && sampledLogicalMs>=meta.blockedUntilMs)
        let count=try Self.add(meta.count,1), revision=try Self.add(meta.revision,1), pinRevision=try Self.add(meta.pinRevision,1)
        let delay=delays[Int(min(count-1,UInt64(delays.count-1)))], blocked=try Self.add(sampledLogicalMs,delay)
        var next=try before.planAttempt(meta,rootRevision:revision,pinRevision:pinRevision,count:count,
            blockedUntilMs:blocked,observedMs:sampledLogicalMs,pendingId:originalChallengeId)
        defer { next.resetBytes(in:0..<next.count) }
        let result=PinAttemptReservation(owner:self,expected:owned,reserved:next,challengeId:originalChallengeId,count:count,
            delayMs:delay,logicalMs:sampledLogicalMs,rootRevision:revision,pinRevision:pinRevision,checksum:Self.digest(next))
        lock.lock(); defer { lock.unlock() }
        guard !disposed && active==nil else { result.close(); throw PlanetChildVault.Failure.unavailable }
        active=result; return result
    }
    /** Burn the exact original reservation before current bytes/time/outcome
     * validation. Neither close, cancellation nor malformed finalization refunds it. */
    func finalize(_ reservation: PinAttemptReservation, currentExactBytes: Data,
                  comparison: PinAttemptComparison, sampledLogicalMs: UInt64) throws -> PinAttemptFinalization {
        lock.lock()
        let owned = !disposed && !finalizeEntered && active === reservation && reservation.owner === self
        if owned { finalizeEntered=true }
        lock.unlock(); try NativePinSessions.require(owned)
        var expected=try reservation.consume(self); defer { expected.resetBytes(in:0..<expected.count); reservation.close() }
        try Self.bounded(currentExactBytes)
        var current=Data(Array(currentExactBytes)); defer { current.resetBytes(in:0..<current.count) }
        try NativePinSessions.require(current==expected && Self.digest(current)==reservation.checksum && sampledLogicalMs<=Self.maximum)
        let before=try envelope(expected); defer { before.close() }; let meta=try before.attemptMetadata()
        try NativePinSessions.require(meta.pendingAttemptId==reservation.challengeId && meta.count==reservation.count
            && meta.revision==reservation.rootRevision && meta.pinRevision==reservation.pinRevision
            && meta.lastObservedMs==reservation.reservedLogicalMs && sampledLogicalMs>=meta.lastObservedMs
            && sampledLogicalMs>=meta.logicalAnchorMs)
        let revision=try Self.add(meta.revision,1), pinRevision=try Self.add(meta.pinRevision,1)
        let count: UInt64, blocked: UInt64
        switch comparison {
        case .match: count=0; blocked=0
        case .mismatch: count=meta.count; blocked=max(meta.blockedUntilMs,try Self.add(sampledLogicalMs,reservation.delayMs))
        }
        var next=try before.planAttempt(meta,rootRevision:revision,pinRevision:pinRevision,count:count,
            blockedUntilMs:blocked,observedMs:sampledLogicalMs,pendingId:nil)
        defer { next.resetBytes(in:0..<next.count) }
        let result=PinAttemptFinalization(owner:self,expected:expected,next:next,checksum:Self.digest(next),rootRevision:revision,pinRevision:pinRevision)
        lock.lock(); defer { lock.unlock() }
        guard !disposed && finalization==nil else { result.close(); throw PlanetChildVault.Failure.unavailable }
        finalization=result; return result
    }
    fileprivate func copyFinalization(_ original: PinAttemptFinalization, expected: Bool) throws -> Data {
        lock.lock(); defer { lock.unlock() }
        try NativePinSessions.require(!disposed && finalization === original && original.owner === self)
        return try original.copyOwnedBytes(expected:expected)
    }
    func close() { lock.lock(); defer { lock.unlock() }; disposed=true; active?.close(); finalization?.close() }
    deinit { close() }
}

/** Closed verification math only. A future genuine verifier must durably charge
 * the original challenge BEFORE this work, hold its actual native worker until
 * return, and authenticate current full-record/deadline coordinates at both
 * caller fences. No extractor, callback, match or fixture grants that authority,
 * refunds a malformed/cancelled attempt, writes state or creates Parent Gate. */
fileprivate struct PinVerifierIdentity: Equatable {
    let recordChecksum: String, recordRevision: UInt64, pinRevision: UInt64
    let iterations: UInt32, policyVersion: String, policyChecksum: String
}
fileprivate final class PinVerifierMaterial: PinPrimitiveDisposable {
    let identity: PinVerifierIdentity
    private let lock=NSLock()
    private var salt: PinPrimitiveBytes?, hash: PinPrimitiveBytes?, consumed=false, disposed=false
    fileprivate init(identity: PinVerifierIdentity, salt: PinPrimitiveBytes, hash: PinPrimitiveBytes) {
        self.identity=identity; self.salt=salt; self.hash=hash
    }
    static func extract(_ canonical: Data, policyVersion: String, policyChecksum: String,
                        maxIterations: UInt64) throws -> PinVerifierMaterial {
        // The existing strict decoder owns a bounded copy, rejects seeds/corrupt
        // or noncanonical records, and checks the registry and complete schema.
        let envelope=try PlanetChildVault.ProtectedEnvelope.decode(canonical,policyVersion:policyVersion,
            policyChecksum:policyChecksum,maxIterations:maxIterations)
        defer { envelope.close() }; return try envelope.verificationMaterial()
    }
    fileprivate func take() throws -> (salt: PinPrimitiveBytes, hash: PinPrimitiveBytes) {
        lock.lock(); defer { lock.unlock() }
        guard !disposed && !consumed, let salt=salt, let hash=hash else { throw PinPrimitiveFailure.denied }
        consumed=true; self.salt=nil; self.hash=nil; return (salt,hash)
    }
    fileprivate func isOpen() -> Bool { lock.lock(); defer { lock.unlock() }; return !disposed }
    func close() {
        lock.lock(); defer { lock.unlock() }; disposed=true
        // Moved storage belongs to the live job and is wiped only after its
        // synchronous crypto and actual callbacks settle, never under its reads.
        salt?.close(); hash?.close(); salt=nil; hash=nil
    }
    deinit { close() }
}
fileprivate extension PlanetChildVault.ProtectedEnvelope {
    func verificationMaterial() throws -> PinVerifierMaterial {
        lock.lock(); defer { lock.unlock() }; try Self.require(!disposed && pin != nil)
        var raw=storage.copy(pinStart..<pinEnd); defer { raw.resetBytes(in:0..<raw.count) }
        let owned=Storage(raw); defer { owned.wipe() }; let cursor=Cursor(owned)
        try cursor.field("schemaVersion",first:true); _=try cursor.number(1,1)
        try cursor.field("policyVersion"); try Self.require(cursor.asciiString()==policyVersion)
        try cursor.field("revision"); let pinRevision=try cursor.number(1,9007199254740991)
        try cursor.field("credentialId"); _=try cursor.hashRange()
        try cursor.field("verifier"); try cursor.field("algorithm",first:true)
        try Self.require(cursor.asciiString()=="PBKDF2-HMAC-SHA256")
        try cursor.field("iterations"); let iterations=try cursor.number(600000,maxIterations)
        try cursor.field("saltHex"); let saltRange=try cursor.hashRange()
        try cursor.field("hashHex"); let hashRange=try cursor.hashRange(); try cursor.token("}")
        try Self.require(pinRevision==pin?.revision && iterations==pin?.iterations && iterations<=UInt64(UInt32.max))
        let salt=try PinPrimitiveBytes(count:32); var hash: PinPrimitiveBytes?
        var accepted=false; defer { if !accepted { salt.close(); hash?.close() } }
        hash=try PinPrimitiveBytes(count:32)
        // Lowercase hex was validated by the strict cursor. Decode octets in
        // owned pointers; no entered PIN or verifier is converted to String.
        func decode(_ range: Range<Int>, into output: PinPrimitiveBytes) throws {
            try Self.require(range.count==66)
            func nibble(_ byte: UInt8) -> UInt8 { byte<=57 ? byte-48 : byte-87 }
            try output.write { target in
                for index in 0..<32 {
                    let offset=range.lowerBound+1+index*2
                    target[index]=(nibble(owned.byte(offset))<<4)|nibble(owned.byte(offset+1))
                }
            }
        }
        try decode(saltRange,into:salt); try decode(hashRange,into:hash!)
        let identity=PinVerifierIdentity(recordChecksum:checksum,recordRevision:revision,pinRevision:pinRevision,
            iterations:UInt32(iterations),policyVersion:policyVersion,policyChecksum:policyChecksum)
        let result=PinVerifierMaterial(identity:identity,salt:salt,hash:hash!); accepted=true; return result
    }
}
fileprivate protocol PinVerificationEngine: AnyObject {
    func derive(pin: UnsafeRawBufferPointer, salt: UnsafeRawBufferPointer,
                iterations: UInt32, output: UnsafeMutableRawBufferPointer) throws
}
/** Verification has its own 1-digit technical floor. Enrollment's existing
 * ApplePinPrimitiveEngine remains byte-exact with its 4-digit creation floor.
 * Only the fixed platform PBKDF2-HMAC-SHA256 implementation is used. */
fileprivate final class ApplePinVerificationEngine: PinVerificationEngine {
    func derive(pin: UnsafeRawBufferPointer, salt: UnsafeRawBufferPointer,
                iterations: UInt32, output: UnsafeMutableRawBufferPointer) throws {
        guard let password=pin.baseAddress, let saltPointer=salt.baseAddress, let key=output.baseAddress,
              pin.count>=1 && pin.count<=128 && pin.allSatisfy({ $0>=48 && $0<=57 })
              && salt.count==32 && output.count==32 && iterations>=600000 else { throw PinPrimitiveFailure.denied }
        let status=CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2),
            password.assumingMemoryBound(to:CChar.self),pin.count,
            saltPointer.assumingMemoryBound(to:UInt8.self),salt.count,
            CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),iterations,
            key.assumingMemoryBound(to:UInt8.self),output.count)
        guard status==kCCSuccess else { throw PinPrimitiveFailure.unavailable }
    }
}
fileprivate enum PinVerificationMathSource { case platform, synthetic }
fileprivate struct PinVerificationMathResult {
    let identity: PinVerifierIdentity, comparison: PinAttemptComparison, source: PinVerificationMathSource
}
fileprivate final class PinVerificationMath: PinPrimitiveDisposable {
    private final class Job {
        let material: PinVerifierMaterial
        var cancelled=false
        var pin: PinPrimitiveBytes?, salt: PinPrimitiveBytes?, hash: PinPrimitiveBytes?, derived: PinPrimitiveBytes?
        var pinSnapshot: PinPrimitiveBytes?, saltSnapshot: PinPrimitiveBytes?
        init(_ material: PinVerifierMaterial) { self.material=material }
        func wipe() {
            pin?.close(); salt?.close(); hash?.close(); derived?.close(); pinSnapshot?.close(); saltSnapshot?.close()
        }
    }
    private let lock=NSLock(), engine: PinVerificationEngine, source: PinVerificationMathSource
    private var active: Job?, disposed=false, used=false, cancelled=false
    init() { engine=ApplePinVerificationEngine(); source = .platform }
    private init(synthetic engine: PinVerificationEngine) { self.engine=engine; source = .synthetic }
    // Explicit source-only fixture seam. No production flag/factory selects it.
    fileprivate static func syntheticFixture(_ engine: PinVerificationEngine) -> PinVerificationMath {
        PinVerificationMath(synthetic:engine)
    }
    private func live(_ original: Job) throws {
        lock.lock(); defer { lock.unlock() }
        guard !disposed && !cancelled && active === original && !original.cancelled && original.material.isOpen()
        else { throw PinPrimitiveFailure.denied }
    }
    /** The accepted job consumes original material and input once. Busy calls
     * leave caller-owned objects untouched. check is mandatory, before and after
     * actual KDF: the caller must enforce its original cancellation/deadline and
     * exact authenticated record identity; this local closure is no authority. */
    func compare(_ original: PinVerifierMaterial, input: PinPrimitiveInput,
                 check: (PinVerifierIdentity) throws -> Void) throws -> PinVerificationMathResult {
        lock.lock()
        guard !disposed && !cancelled && !used && active==nil else { lock.unlock(); throw PinPrimitiveFailure.denied }
        used=true; let job=Job(original); active=job; lock.unlock() // Burn/reserve before any callback.
        do {
            job.pin=try input.take(); let verifier=try original.take()
            job.salt=verifier.salt; job.hash=verifier.hash; job.derived=try PinPrimitiveBytes(count:32)
            job.pinSnapshot=try job.pin!.independentCopy(); job.saltSnapshot=try job.salt!.independentCopy()
            try live(job); try check(original.identity); try live(job)
            guard try job.pin!.equals(job.pinSnapshot!) && job.salt!.equals(job.saltSnapshot!)
            else { throw PinPrimitiveFailure.denied }
            let valid=try job.pin!.read { $0.count>=1 && $0.count<=128 && $0.allSatisfy { $0>=48 && $0<=57 } }
            guard valid else { throw PinPrimitiveFailure.denied }
            try job.pin!.read { pin in try job.salt!.read { salt in try job.derived!.write { output in
                try engine.derive(pin:pin,salt:salt,iterations:original.identity.iterations,output:output)
            } } }
            // No cancellation/preemption promise while CCKeyDerivationPBKDF is
            // synchronous. Late output is denied and wiped when it really returns.
            try live(job)
            guard try job.pin!.equals(job.pinSnapshot!) && job.salt!.equals(job.saltSnapshot!)
            else { throw PinPrimitiveFailure.denied }
            try check(original.identity); try live(job)
            guard try job.pin!.equals(job.pinSnapshot!) && job.salt!.equals(job.saltSnapshot!)
            else { throw PinPrimitiveFailure.denied }
            let comparison: PinAttemptComparison=try job.derived!.equals(job.hash!) ? .match : .mismatch
            job.wipe() // Actual crypto/callbacks settled; capacity still held.
            lock.lock(); defer { lock.unlock() }
            guard !disposed && !cancelled && active === job && !job.cancelled && original.isOpen()
            else { throw PinPrimitiveFailure.denied }
            active=nil
            return PinVerificationMathResult(identity:original.identity,comparison:comparison,source:source)
        } catch {
            job.wipe()
            lock.lock(); if active === job { active=nil }; lock.unlock()
            throw error
        }
    }
    func cancel() { lock.lock(); defer { lock.unlock() }; cancelled=true; active?.cancelled=true }
    func close() { lock.lock(); defer { lock.unlock() }; disposed=true; active?.cancelled=true }
    deinit { close() }
}

/** Private verification transaction mechanics; no factory/host/authority is
 * activated. A constructor-injected fixture is not a replay-resistant ledger.
 * All work/IO/recipient methods run off main; revoke is immediate and local. */
fileprivate struct PinGateContext: Equatable {
    let profileId: String, policyVersion: String, profileRevision: UInt64, routeRevision: UInt64
    let mode: String, visibility: String
}
fileprivate final class PinGateRequest {
    let originalHostChallenge: AnyObject, id: String, action: String, targetChecksum: String
    let context: PinGateContext, generation: UInt64, deadlineUptimeMs: UInt64
    init(originalHostChallenge: AnyObject, id: String, action: String, targetChecksum: String,
         context: PinGateContext, generation: UInt64, deadlineUptimeMs: UInt64) {
        self.originalHostChallenge=originalHostChallenge; self.id=id; self.action=action
        self.targetChecksum=targetChecksum; self.context=context; self.generation=generation
        self.deadlineUptimeMs=deadlineUptimeMs
    }
}
fileprivate struct PinVerificationPolicy {
    let version: String, checksum: String, maxIterations: UInt64, backoffDelaysMs: [UInt64]
    init(version: String, checksum: String, maxIterations: UInt64, backoffDelaysMs: [UInt64]) throws {
        let validator=try PinAttemptJournal(policyVersion:version,policyChecksum:checksum,
            maxIterations:maxIterations,backoffDelaysMs:backoffDelaysMs); validator.close()
        self.version=version; self.checksum=checksum; self.maxIterations=maxIterations
        self.backoffDelaysMs=backoffDelaysMs
    }
}
fileprivate enum PinVerificationTransition { case reserve, finalize }
fileprivate enum PinVerificationPhase { case beginning, ready, verifying, finalized, blocked, denied, sealed, closing, closed }
fileprivate enum PinVerificationReplyKind { case match, mismatch, closed }
fileprivate enum PinVerificationDelivery { case known, uncertain }
fileprivate struct PinVerificationRefusal: Error {
    let blocked: Bool
    init(blocked: Bool=false) { self.blocked=blocked }
}
fileprivate protocol PinVerificationAuthority: AnyObject {
    // Genuine adapter must authenticate original host challenge/action/target/
    // context and real supported epoch/boot/continuous time, not these JS fields.
    func capture(_ original: PinGateRequest, bytes: Data, checksum: String, revision: UInt64) throws -> PinVerificationCoordinates
    func current(_ original: OwnedPinVerification, bytes: Data, checksum: String, revision: UInt64) throws -> PinVerificationCoordinates
    // Bind exact whole old/next bytes/digests/revisions, transition and every
    // original lease coordinate. Permissions are real native one-use authority.
    func authorizeTransition(_ original: OwnedPinVerification, kind: PinVerificationTransition,
        expected: Data, next: Data, expectedChecksum: String, nextChecksum: String,
        expectedRevision: UInt64, nextRevision: UInt64) throws -> AnyObject
    // Durable checkpoint permission is consumed BEFORE storage publication.
    // Subsequent current(next) authenticates it; exact storage readback is separate.
    func advance(_ original: OwnedPinVerification, permission: AnyObject, kind: PinVerificationTransition,
                 nextChecksum: String, nextRevision: UInt64) throws
    // Original raw gate is available even while capture has not yielded a lease.
    func cancel(_ original: PinGateRequest, owned: OwnedPinVerification?) throws
    // Whole-request terminal retirement also covers later local revocations.
    func retire(_ original: PinGateRequest, owned: OwnedPinVerification?) throws
}
fileprivate final class PinVerificationCoordinates {
    let owner: PinVerificationAuthority, checksum: String, revision: UInt64
    let epoch: String, bootId: String, hostGeneration: UInt64, uptimeMs: UInt64, logicalMs: UInt64
    init(owner: PinVerificationAuthority, checksum: String, revision: UInt64, epoch: String,
         bootId: String, hostGeneration: UInt64, uptimeMs: UInt64, logicalMs: UInt64) {
        self.owner=owner; self.checksum=checksum; self.revision=revision; self.epoch=epoch
        self.bootId=bootId; self.hostGeneration=hostGeneration; self.uptimeMs=uptimeMs; self.logicalMs=logicalMs
    }
}
fileprivate struct PinVerificationRecordContext {
    let mode: String, profileId: String?, profileRevision: UInt64, policyVersion: String
}
fileprivate extension PlanetChildVault.ProtectedEnvelope {
    func verificationContext() throws -> PinVerificationRecordContext {
        lock.lock(); defer { lock.unlock() }; try Self.require(!disposed && pin != nil)
        let cursor=Cursor(storage)
        try cursor.field("schemaVersion",first:true); _=try cursor.number(1,1)
        try cursor.field("revision"); _=try cursor.number(1,9007199254740991)
        try cursor.field("mode"); let mode=try cursor.asciiString()
        try cursor.field("selectionRevision"); _=try cursor.number(1,9007199254740991)
        try cursor.field("profileRevision"); let profileRevision=try cursor.number(1,9007199254740991)
        try cursor.field("policyChecksum"); try Self.require(cursor.asciiString()==policyChecksum)
        try cursor.field("registryChecksum"); _=try cursor.hashRange()
        try cursor.field("registry"); let active=try Self.registry(cursor,version:policyVersion)
        return PinVerificationRecordContext(mode:mode,profileId:active,profileRevision:profileRevision,policyVersion:policyVersion)
    }
}
fileprivate final class OwnedPinVerification {
    let owner: NativePinVerification, original: PinGateRequest, policy: PinVerificationPolicy
    let expected: PinOwnedBytes, checksum: String, revision: UInt64, pinRevision: UInt64
    let epoch: String, bootId: String, hostGeneration: UInt64, capturedUptimeMs: UInt64, capturedLogicalMs: UInt64
    let clockUptimeMs: UInt64, clockLogicalMs: UInt64, deadlineUptimeMs: UInt64
    fileprivate init(owner: NativePinVerification, original: PinGateRequest, policy: PinVerificationPolicy,
         bytes: Data, metadata: PinEnvelopeMetadata, point: PinVerificationCoordinates) {
        self.owner=owner; self.original=original; self.policy=policy; expected=PinOwnedBytes(bytes)
        checksum=point.checksum; revision=metadata.revision; pinRevision=metadata.pinRevision
        epoch=point.epoch; bootId=point.bootId; hostGeneration=point.hostGeneration
        capturedUptimeMs=point.uptimeMs; capturedLogicalMs=point.logicalMs
        clockUptimeMs=metadata.uptimeAnchorMs; clockLogicalMs=metadata.logicalAnchorMs
        deadlineUptimeMs=original.deadlineUptimeMs
    }
    fileprivate func close() { expected.close() }
}
fileprivate final class OwnedPinVerificationInput: PinPrimitiveDisposable {
    let owner: NativePinVerification, request: OwnedPinVerification
    private let lock=NSLock(), raw: PinPrimitiveInput
    private var consumed=false, disposed=false
    fileprivate init(owner: NativePinVerification, request: OwnedPinVerification, raw: PinPrimitiveInput) {
        self.owner=owner; self.request=request; self.raw=raw
    }
    fileprivate func take() throws -> PinPrimitiveBytes {
        lock.lock(); defer { lock.unlock() }
        guard !disposed && !consumed else { throw PinVerificationRefusal() }
        consumed=true; return try raw.take()
    }
    func close() { lock.lock(); defer { lock.unlock() }; disposed=true; raw.close() }
    deinit { close() }
}
fileprivate final class PinVerificationReply {
    let owner: NativePinVerification, request: OwnedPinVerification?, original: PinGateRequest
    let kind: PinVerificationReplyKind, checksum: String?, revision: UInt64?
    fileprivate var settled=false, deliveryStarted=false, delivered=false
    fileprivate init(owner: NativePinVerification, request: OwnedPinVerification?, original: PinGateRequest,
                     kind: PinVerificationReplyKind, checksum: String?, revision: UInt64?) {
        self.owner=owner; self.request=request; self.original=original; self.kind=kind
        self.checksum=checksum; self.revision=revision
    }
    // A reply holds no entered PIN. Closing never acknowledges host delivery.
    func close() {}
}
fileprivate final class NativePinVerification {
    private final class Ticket {
        let gate: PinGateRequest
        var owned: OwnedPinVerification?, phase: PinVerificationPhase = .beginning
        var cancelled=false, sealed=false, retiring=false, retirementFenced=false, cancelStarted=false
        var workers=0, threads=[ObjectIdentifier:Int](), replies=[ObjectIdentifier:PinVerificationReply]()
        var terminal: PinVerificationReply?, entry: OwnedPinVerificationInput?, inputIssued=false
        var math: PinVerificationMath?, finalBytes: PinOwnedBytes?
        var nativeInput: PinVerificationNativeInput?, inputWork: PinVerificationInputWork?, inputThread: Thread?
        var inputHandoff=false
        var lastUptime: UInt64=0, lastLogical: UInt64=0
        init(_ gate: PinGateRequest) { self.gate=gate }
    }
    private enum LockedOutcome<T> { case value(T), refused(PinVerificationRefusal) }
    private let condition=NSCondition(), io: PinSessionIO, authority: PinVerificationAuthority, policy: PinVerificationPolicy
    private let fixtureEngine: PinVerificationEngine?
    private var active: Ticket?, usedIds=Set<String>(), usedHosts=[ObjectIdentifier:AnyObject]()
    private var permissions=[ObjectIdentifier:AnyObject]()
    private static let safe: UInt64=9007199254740991
    private static let actions=Set(["exit-child-mode","switch-adult-profile","change-exact-age","change-blocked-topics",
        "open-adult-store","initiate-purchase","restore-purchases","open-external","share","account-change",
        "export-child-data","delete-child-data","diagnostics","expand-access-settings","enable-licensed-pack","view-legal-commercial"])
    init(io: PinSessionIO, authority: PinVerificationAuthority, policy: PinVerificationPolicy) {
        self.io=io; self.authority=authority; self.policy=policy; fixtureEngine=nil
    }
    private init(io: PinSessionIO, authority: PinVerificationAuthority, policy: PinVerificationPolicy,
                 fixtureEngine: PinVerificationEngine) {
        self.io=io; self.authority=authority; self.policy=policy; self.fixtureEngine=fixtureEngine
    }
    fileprivate static func syntheticFixture(io: PinSessionIO, authority: PinVerificationAuthority,
         policy: PinVerificationPolicy, engine: PinVerificationEngine) -> NativePinVerification {
        NativePinVerification(io:io,authority:authority,policy:policy,fixtureEngine:engine)
    }

    private static func require(_ valid: Bool) throws { if !valid { throw PlanetChildVault.Failure.unavailable } }
    private static func deny(_ valid: Bool) throws { if !valid { throw PinVerificationRefusal() } }
    private static func hex(_ value: String) -> Bool { value.range(of:"\\A[a-f0-9]{64}\\z",options:.regularExpression) != nil }
    private static func identifier(_ value: String) -> Bool { value.range(of:"\\A[A-Za-z0-9][A-Za-z0-9._-]{0,95}\\z",options:.regularExpression) != nil }
    private static func digest(_ bytes: Data) -> String { SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() }
    private static func copy(_ bytes: Data) throws -> Data {
        try require(!bytes.isEmpty && bytes.count<=131072); return Data(Array(bytes))
    }
    private static func fence(_ bytes: Data,_ checksum: String) throws {
        try require(!bytes.isEmpty && bytes.count<=131072 && Self.hex(checksum) && digest(bytes)==checksum)
    }
    private func isolated<T>(_ bytes: Data,_ task: (Data) throws -> T) throws -> T {
        var disposable=try Self.copy(bytes); defer { disposable.resetBytes(in:0..<disposable.count) }
        let checksum=Self.digest(bytes), result=try task(disposable)
        try Self.require(disposable==bytes); try Self.fence(disposable,checksum); return result
    }
    private func locked<T>(_ task: (PinSessionTransaction) throws -> T) throws -> T {
        // Carry known prepublication refusals as values through existing IO's
        // generic error wrapper; every unclassified exception stays uncertain.
        let result: LockedOutcome<T> = try io.locked { transaction in
            do { return .value(try task(transaction)) }
            catch let refusal as PinVerificationRefusal { return .refused(refusal) }
        }
        switch result { case .value(let result): return result; case .refused(let error): throw error }
    }
    private func inspect(_ bytes: Data) throws -> (metadata: PinEnvelopeMetadata, context: PinVerificationRecordContext) {
        let envelope=try PlanetChildVault.ProtectedEnvelope.decode(bytes,policyVersion:policy.version,
            policyChecksum:policy.checksum,maxIterations:policy.maxIterations)
        defer { envelope.close() }; return (try envelope.pinSessionMetadata(),try envelope.verificationContext())
    }
    private func ownLocked(_ gate: PinGateRequest) throws -> Ticket {
        guard let ticket=active, ticket.gate === gate, ticket.phase != .closed else { throw PinVerificationRefusal() }
        return ticket
    }
    private func inputAllowedLocked(_ ticket: Ticket,_ supplied: PinVerificationNativeInput?) -> Bool {
        if let original=ticket.nativeInput {
            return supplied === original && ticket.inputThread === Thread.current && ticket.inputWork==nil && ticket.inputHandoff
        }
        return supplied==nil
    }
    private func live(_ ticket: Ticket) throws {
        condition.lock(); defer { condition.unlock() }
        try Self.deny(active === ticket && !ticket.cancelled && !ticket.sealed && !ticket.retiring && !ticket.retirementFenced)
    }
    private func addWorkerLocked(_ ticket: Ticket) throws {
        try Self.require(ticket.workers<4096)
        ticket.workers+=1; let thread=ObjectIdentifier(Thread.current)
        ticket.threads[thread]=(ticket.threads[thread] ?? 0)+1
    }
    private func wipeSealedLocked(_ ticket: Ticket) {
        if ticket.sealed && ticket.workers==0 {
            ticket.entry?.close(); ticket.math?.close(); ticket.owned?.close(); ticket.finalBytes?.close()
        }
    }
    private func settleWorker(_ ticket: Ticket) {
        condition.lock(); defer { condition.unlock() }; let thread=ObjectIdentifier(Thread.current)
        let remaining=(ticket.threads[thread] ?? 0)-1
        if ticket.workers<=0 || remaining<0 { ticket.sealed=true; ticket.phase = .sealed }
        else { ticket.workers-=1; if remaining==0 { ticket.threads.removeValue(forKey:thread) } else { ticket.threads[thread]=remaining } }
        wipeSealedLocked(ticket); condition.broadcast()
    }
    private func failed(_ ticket: Ticket,_ error: Error,publication: Bool) {
        condition.lock(); defer { condition.unlock() }
        if ticket.sealed || publication || !(error is PinVerificationRefusal) { ticket.sealed=true; ticket.phase = .sealed }
        else if (error as? PinVerificationRefusal)?.blocked == true { ticket.phase = .blocked }
        else { ticket.phase = .denied }
        wipeSealedLocked(ticket); condition.broadcast()
    }
    private func validatePoint(_ ticket: Ticket,_ owned: OwnedPinVerification?,_ point: PinVerificationCoordinates,
                               bytes: Data) throws {
        try live(ticket); let record=try inspect(bytes), meta=record.metadata, context=record.context, gate=ticket.gate
        try Self.require(point.owner === authority && Self.hex(point.epoch) && point.checksum==Self.digest(bytes)
            && point.revision==meta.revision && meta.enrolled && point.hostGeneration<=Self.safe
            && point.uptimeMs<=Self.safe && point.logicalMs<=Self.safe && point.bootId==meta.bootId
            && point.uptimeMs>=meta.uptimeAnchorMs && point.logicalMs>=meta.lastObservedMs)
        let delta=point.uptimeMs-meta.uptimeAnchorMs
        try Self.require(delta<=Self.safe-meta.logicalAnchorMs && point.logicalMs==meta.logicalAnchorMs+delta)
        try Self.deny(point.uptimeMs<gate.deadlineUptimeMs && context.mode=="child"
            && context.profileId==gate.context.profileId && context.policyVersion==gate.context.policyVersion
            && context.profileRevision==gate.context.profileRevision)
        if let owned=owned {
            try Self.require(owned.owner === self && owned.original === gate && point.epoch==owned.epoch
                && point.bootId==owned.bootId && point.hostGeneration==owned.hostGeneration
                && gate.deadlineUptimeMs==owned.deadlineUptimeMs
                && meta.uptimeAnchorMs==owned.clockUptimeMs && meta.logicalAnchorMs==owned.clockLogicalMs)
        }
        condition.lock(); defer { condition.unlock() }
        try Self.deny(active === ticket && !ticket.cancelled && !ticket.sealed && !ticket.retiring && !ticket.retirementFenced)
        try Self.require(point.uptimeMs>=ticket.lastUptime && point.logicalMs>=ticket.lastLogical)
        ticket.lastUptime=point.uptimeMs; ticket.lastLogical=point.logicalMs
    }
    private func current(_ ticket: Ticket,_ owned: OwnedPinVerification,_ bytes: Data) throws -> PinVerificationCoordinates {
        try live(ticket); let checksum=Self.digest(bytes), metadata=try inspect(bytes).metadata
        let point=try isolated(bytes) { try authority.current(owned,bytes:$0,checksum:checksum,revision:metadata.revision) }
        try Self.fence(bytes,checksum); try validatePoint(ticket,owned,point,bytes:bytes); return point
    }
    func begin(_ original: PinGateRequest) throws -> OwnedPinVerification {
        try Self.deny(!Thread.isMainThread)
        let context=original.context
        try Self.deny(Self.hex(original.id) && Self.actions.contains(original.action) && Self.hex(original.targetChecksum)
            && Self.identifier(context.profileId) && context.policyVersion==policy.version
            && context.profileRevision>=1 && context.profileRevision<=Self.safe && context.routeRevision<=Self.safe
            && context.mode=="child" && context.visibility=="active" && original.generation<=Self.safe
            && original.deadlineUptimeMs>0 && original.deadlineUptimeMs<=Self.safe)
        condition.lock()
        let ticket: Ticket
        do {
            let host=ObjectIdentifier(original.originalHostChallenge)
            try Self.deny(active==nil && usedIds.count<2048 && !usedIds.contains(original.id) && usedHosts[host]==nil)
            usedIds.insert(original.id); usedHosts[host]=original.originalHostChallenge
            ticket=Ticket(original); active=ticket; try addWorkerLocked(ticket); condition.unlock()
        } catch { condition.unlock(); throw error }
        defer { settleWorker(ticket) }
        do { return try locked { transaction in
            try live(ticket); var returned=try transaction.read(); defer { returned.resetBytes(in:0..<returned.count) }
            var bytes=try Self.copy(returned); defer { bytes.resetBytes(in:0..<bytes.count) }
            let info=try inspect(bytes), checksum=Self.digest(bytes)
            let point=try isolated(bytes) { try authority.capture(original,bytes:$0,checksum:checksum,revision:info.metadata.revision) }
            try Self.fence(bytes,checksum); try validatePoint(ticket,nil,point,bytes:bytes)
            if point.logicalMs<info.metadata.lastObservedMs { throw PlanetChildVault.Failure.unavailable }
            // Charged pending records stay charged; begin never resets them.
            let envelope=try PlanetChildVault.ProtectedEnvelope.decode(bytes,policyVersion:policy.version,
                policyChecksum:policy.checksum,maxIterations:policy.maxIterations); defer { envelope.close() }
            if point.logicalMs<(try envelope.attemptMetadata()).blockedUntilMs { throw PinVerificationRefusal(blocked:true) }
            let owned=OwnedPinVerification(owner:self,original:original,policy:policy,bytes:bytes,metadata:info.metadata,point:point)
            condition.lock(); defer { condition.unlock() }
            try Self.deny(active === ticket && !ticket.cancelled && !ticket.sealed && !ticket.retiring)
            ticket.owned=owned; ticket.phase = .ready; return owned
        } } catch { failed(ticket,error,publication:false); throw error }
    }
    /** Mechanical one-use receipt only. The missing native UI/host must bind
     * what the parent actually saw and transfer it after all UI cleanup. */
    func bindInput(_ original: OwnedPinVerification, raw: PinPrimitiveInput,
                   inputHandoff: PinVerificationNativeInput?=nil) throws -> OwnedPinVerificationInput {
        condition.lock(); defer { condition.unlock() }; let ticket=try ownLocked(original.original)
        try Self.deny(original.owner === self && ticket.owned === original && ticket.phase == .ready
            && !ticket.cancelled && !ticket.sealed && !ticket.retiring && ticket.workers==0 && !ticket.inputIssued
            && inputAllowedLocked(ticket,inputHandoff))
        ticket.inputIssued=true // Accepted slot is burned before owned buffer transfer.
        let moved=try raw.take(), detached=PinPrimitiveInput(owned:moved)
        let result=OwnedPinVerificationInput(owner:self,request:original,raw:detached)
        ticket.entry=result; return result
    }

    private func readExact(_ transaction: PinSessionTransaction,_ expected: Data) throws {
        var returned=try transaction.read(); defer { returned.resetBytes(in:0..<returned.count) }
        var actual=try Self.copy(returned); defer { actual.resetBytes(in:0..<actual.count) }
        try Self.deny(actual==expected); try Self.fence(actual,Self.digest(expected))
    }
    private func commit(_ ticket: Ticket,_ owned: OwnedPinVerification,_ transaction: PinSessionTransaction,
                        kind: PinVerificationTransition, expected: Data, next: Data, publication: inout Bool) throws {
        let oldChecksum=Self.digest(expected), nextChecksum=Self.digest(next)
        let old=try inspect(expected).metadata, fresh=try inspect(next).metadata
        try Self.require(old.revision<Self.safe && fresh.revision==old.revision+1
            && old.pinRevision<Self.safe && fresh.pinRevision==old.pinRevision+1)
        try readExact(transaction,expected); _=try current(ticket,owned,expected)
        var oldCopy=try Self.copy(expected), nextCopy=try Self.copy(next)
        defer { oldCopy.resetBytes(in:0..<oldCopy.count); nextCopy.resetBytes(in:0..<nextCopy.count) }
        let permission=try authority.authorizeTransition(owned,kind:kind,expected:oldCopy,next:nextCopy,
            expectedChecksum:oldChecksum,nextChecksum:nextChecksum,expectedRevision:old.revision,nextRevision:fresh.revision)
        try Self.require(oldCopy==expected && nextCopy==next); try Self.fence(expected,oldChecksum); try Self.fence(next,nextChecksum)
        try live(ticket); try readExact(transaction,expected); _=try current(ticket,owned,expected)
        condition.lock()
        let admitted=active === ticket && ticket.owned === owned && !ticket.cancelled && !ticket.sealed
            && !ticket.retiring && !ticket.retirementFenced
        let unique=permissions.count<4096 && permissions[ObjectIdentifier(permission)]==nil
        if admitted && unique { permissions[ObjectIdentifier(permission)]=permission }; condition.unlock()
        try Self.deny(admitted); try Self.require(unique)
        publication=true
        try authority.advance(owned,permission:permission,kind:kind,nextChecksum:nextChecksum,nextRevision:fresh.revision)
        // After advance the authority checkpoint is NEXT, though storage is
        // still EXPECTED until publication. Never call current(expected) here.
        try Self.fence(expected,oldChecksum); try Self.fence(next,nextChecksum); try live(ticket)
        try readExact(transaction,expected)
        var writeBytes=try Self.copy(next); defer { writeBytes.resetBytes(in:0..<writeBytes.count) }
        let boundary: () throws -> Void = {
            try self.live(ticket); try Self.fence(expected,oldChecksum); try Self.fence(next,nextChecksum)
            try Self.require(writeBytes==next); try Self.fence(writeBytes,nextChecksum)
            _=try self.current(ticket,owned,next)
            try self.live(ticket); try Self.require(writeBytes==next); try Self.fence(writeBytes,nextChecksum)
        }
        try boundary(); try transaction.write(writeBytes,boundary:boundary)
        try readExact(transaction,next); try boundary()
        publication=false // Known complete write+exact readback+current fence.
    }
    func verify(_ original: OwnedPinVerification, input: OwnedPinVerificationInput,
                inputHandoff: PinVerificationNativeInput?=nil) throws -> PinVerificationReply {
        try Self.deny(!Thread.isMainThread)
        condition.lock()
        let ticket: Ticket
        do {
            ticket=try ownLocked(original.original)
            // Foreign/busy/replayed receipts are not consumed or wiped.
            try Self.deny(original.owner === self && ticket.owned === original && input.owner === self
                && input.request === original && ticket.entry === input && ticket.phase == .ready
                && !ticket.cancelled && !ticket.sealed && !ticket.retiring && ticket.workers==0
                && inputAllowedLocked(ticket,inputHandoff))
            ticket.phase = .verifying; try addWorkerLocked(ticket); condition.unlock()
        } catch { condition.unlock(); throw error }
        var pin: PinPrimitiveBytes?, expected=Data(), charged=Data(), final=Data(), publication=false
        var journal: PinAttemptJournal?, material: PinVerifierMaterial?, math: PinVerificationMath?
        defer {
            pin?.close(); input.close(); material?.close(); math?.close(); journal?.close()
            expected.resetBytes(in:0..<expected.count); charged.resetBytes(in:0..<charged.count); final.resetBytes(in:0..<final.count)
            settleWorker(ticket)
        }
        do {
            pin=try input.take(); try live(ticket)
            expected=try original.expected.copy(); try Self.fence(expected,original.checksum)
            let owner=try PinAttemptJournal(policyVersion:policy.version,policyChecksum:policy.checksum,
                maxIterations:policy.maxIterations,backoffDelaysMs:policy.backoffDelaysMs); journal=owner
            let reservation: PinAttemptReservation=try locked { transaction in
                try readExact(transaction,expected); let point=try current(ticket,original,expected)
                let reservation=try owner.reserve(expected,originalChallengeId:original.original.id,sampledLogicalMs:point.logicalMs)
                var next=try reservation.copyReservedBytes(); defer { next.resetBytes(in:0..<next.count) }
                try commit(ticket,original,transaction,kind:.reserve,expected:expected,next:next,publication:&publication)
                return reservation
            }
            charged=try reservation.copyReservedBytes(); try live(ticket)
            // Bounded malformed nonempty input was charged above, as TS requires.
            let digits=try pin!.read { $0.count>=1 && $0.count<=128 && $0.allSatisfy { $0>=48 && $0<=57 } }
            let comparison: PinAttemptComparison
            if digits {
                let verifier=try PinVerifierMaterial.extract(charged,policyVersion:policy.version,
                    policyChecksum:policy.checksum,maxIterations:policy.maxIterations); material=verifier
                let worker=fixtureEngine.map(PinVerificationMath.syntheticFixture) ?? PinVerificationMath(); math=worker
                condition.lock()
                let valid=active === ticket && !ticket.cancelled && !ticket.sealed && !ticket.retiring && !ticket.retirementFenced
                if valid { ticket.math=worker }; condition.unlock()
                try Self.deny(valid)
                let moved=PinPrimitiveInput(owned:pin!); pin=nil; defer { moved.close() }
                let result=try worker.compare(verifier,input:moved) { identity in
                    try Self.require(identity==verifier.identity && identity.recordChecksum==reservation.checksum
                        && identity.recordRevision==reservation.rootRevision && identity.pinRevision==reservation.pinRevision)
                    try self.live(ticket)
                    try self.locked { transaction in
                        try self.readExact(transaction,charged); _=try self.current(ticket,original,charged)
                    }
                }
                comparison=result.comparison
            } else { pin?.close(); pin=nil; comparison = .mismatch }
            try live(ticket)
            let finished: PinAttemptFinalization=try locked { transaction in
                try readExact(transaction,charged); let point=try current(ticket,original,charged)
                let finished=try owner.finalize(reservation,currentExactBytes:charged,comparison:comparison,sampledLogicalMs:point.logicalMs)
                var next=try finished.copyNextBytes(); defer { next.resetBytes(in:0..<next.count) }
                try commit(ticket,original,transaction,kind:.finalize,expected:charged,next:next,publication:&publication)
                return finished
            }
            final=try finished.copyNextBytes(); try live(ticket)
            let kind: PinVerificationReplyKind
            switch comparison { case .match: kind = .match; case .mismatch: kind = .mismatch }
            condition.lock(); defer { condition.unlock() }
            try Self.deny(active === ticket && !ticket.cancelled && !ticket.sealed && !ticket.retiring && !ticket.retirementFenced)
            let reply=PinVerificationReply(owner:self,request:original,original:original.original,
                kind:kind,checksum:finished.checksum,revision:finished.rootRevision)
            ticket.finalBytes=PinOwnedBytes(final); ticket.phase = .finalized; ticket.math=nil
            ticket.replies[ObjectIdentifier(reply)]=reply; condition.broadcast(); return reply
        } catch { failed(ticket,error,publication:publication); throw error }
    }
    /** Any-thread local revocation. The host schedules actual cancel off main;
     * this call never waits on IO/KDF/retirement or wipes active pointer reads. */
    func revoke(_ original: PinGateRequest) throws {
        condition.lock()
        let ticket: Ticket, entry: OwnedPinVerificationInput?
        do {
            ticket=try ownLocked(original); ticket.cancelled=true; entry=ticket.entry
            condition.broadcast(); condition.unlock()
        } catch { condition.unlock(); throw error }
        entry?.close() // Mandatory math fences observe the revoked ticket after real return.
    }
    func cancel(_ original: PinGateRequest) throws {
        try revoke(original); try Self.deny(!Thread.isMainThread)
        condition.lock()
        let ticket: Ticket, owned: OwnedPinVerification?
        do {
            ticket=try ownLocked(original)
            if ticket.retirementFenced || ticket.cancelStarted { condition.unlock(); return }
            try Self.deny(ticket.threads[ObjectIdentifier(Thread.current)]==nil)
            ticket.cancelStarted=true; owned=ticket.owned; try addWorkerLocked(ticket); condition.unlock()
        } catch { condition.unlock(); throw error }
        defer { settleWorker(ticket) }
        do { try locked { _ in try authority.cancel(original,owned:owned) } }
        catch { failed(ticket,error,publication:false); throw error }
    }
    /** Count the actual recipient callback; acknowledging inside it is denied.
     * No callback result is translated into a ParentGate capability here. */
    func deliver(_ original: PinVerificationReply, inputHandoff: PinVerificationNativeInput?=nil,
                 recipient: (PinVerificationReply) throws -> Void) throws {
        try Self.deny(!Thread.isMainThread)
        condition.lock(); let ticket: Ticket
        do {
            ticket=try ownLocked(original.original)
            try Self.deny(original.owner === self && original.request === ticket.owned && !original.settled
                && ticket.replies[ObjectIdentifier(original)] === original && !original.deliveryStarted && ticket.workers==0
                && inputAllowedLocked(ticket,inputHandoff))
            if original.kind != .closed { try Self.deny(!ticket.cancelled && !ticket.sealed && !ticket.retiring && !ticket.retirementFenced) }
            original.deliveryStarted=true; try addWorkerLocked(ticket); condition.unlock()
        } catch { condition.unlock(); throw error }
        var final=Data(), recipientEntered=false
        defer { final.resetBytes(in:0..<final.count); settleWorker(ticket) }
        do {
            if original.kind != .closed, let owned=ticket.owned, let bytes=ticket.finalBytes {
                final=try bytes.copy()
                try locked { transaction in try readExact(transaction,final); _=try current(ticket,owned,final) }
            }
            recipientEntered=true; try recipient(original)
            if original.kind != .closed, let owned=ticket.owned {
                try live(ticket)
                try locked { transaction in try readExact(transaction,final); _=try current(ticket,owned,final) }
            }
            condition.lock(); defer { condition.unlock() }
            try Self.deny(active === ticket && (original.kind == .closed || !ticket.cancelled && !ticket.sealed && !ticket.retiring))
            original.delivered=true
        } catch { failed(ticket,error,publication:recipientEntered); throw error }
    }
    /** Revocable mathematical data only. The missing genuine host must still
     * authenticate and settle the exact original Gate challenge separately. */
    func mathematicalOutcome(_ original: PinVerificationReply) throws -> PinAttemptComparison {
        condition.lock(); defer { condition.unlock() }; let ticket=try ownLocked(original.original)
        try Self.deny(original.owner === self && original.request === ticket.owned && !original.settled
            && ticket.replies[ObjectIdentifier(original)] === original && original.deliveryStarted
            && !ticket.cancelled && !ticket.sealed && !ticket.retiring && original.kind != .closed)
        return original.kind == .match ? .match : .mismatch
    }
    func settleReply(_ original: PinVerificationReply, delivery: PinVerificationDelivery) throws {
        condition.lock(); defer { condition.unlock() }; let ticket=try ownLocked(original.original)
        try Self.deny(original.owner === self && original.request === ticket.owned && !original.settled
            && ticket.replies[ObjectIdentifier(original)] === original && ticket.workers==0 && ticket.nativeInput==nil
            && (delivery == .uncertain || original.delivered))
        if original.kind == .closed {
            try Self.deny(ticket.terminal === original && ticket.retirementFenced && ticket.replies.count==1)
        }
        original.settled=true; ticket.replies.removeValue(forKey:ObjectIdentifier(original)); original.close()
        if delivery == .uncertain || original.kind != .closed && ticket.cancelled {
            ticket.sealed=true; ticket.phase = .sealed
        }
        if original.kind == .closed && !ticket.sealed {
            ticket.entry?.close(); ticket.owned?.close(); ticket.finalBytes?.close()
            ticket.phase = .closed; active=nil
        }
        wipeSealedLocked(ticket); condition.broadcast()
    }
    func retire(_ original: PinGateRequest) throws -> PinVerificationReply {
        try Self.deny(!Thread.isMainThread)
        condition.lock(); let ticket: Ticket, owned: OwnedPinVerification?
        do {
            ticket=try ownLocked(original)
            try Self.deny(!ticket.retiring && ticket.threads[ObjectIdentifier(Thread.current)]==nil
                && ticket.inputThread !== Thread.current)
            ticket.retiring=true
            // No timer frees real work or unknown host transfers. The input
            // gap is closed atomically by retiring before any new verify claim.
            while ticket.workers != 0 || !ticket.replies.isEmpty || ticket.nativeInput != nil { condition.wait() }
            ticket.retirementFenced=true; owned=ticket.owned; condition.unlock()
        } catch { condition.unlock(); throw error }
        do { try locked { _ in try authority.retire(original,owned:owned) } }
        catch { failed(ticket,error,publication:true); throw error }
        condition.lock(); defer { condition.unlock() }
        try Self.require(ticket.workers==0 && ticket.replies.isEmpty)
        ticket.entry?.close(); ticket.owned?.close(); ticket.finalBytes?.close()
        let result=PinVerificationReply(owner:self,request:owned,original:original,kind:.closed,checksum:nil,revision:nil)
        ticket.terminal=result; ticket.replies[ObjectIdentifier(result)]=result
        if !ticket.sealed { ticket.phase = .closing }; condition.broadcast(); return result
    }
}

/** Original UI work identity. Only the core-registering actual Thread can settle
 * its worker or use the retained slot; fields are not host/action authority. */
fileprivate final class PinVerificationInputWork {
    let owner: NativePinVerification, request: OwnedPinVerification, input: PinVerificationNativeInput, thread: Thread
    fileprivate var finished=false
    fileprivate init(owner: NativePinVerification, request: OwnedPinVerification, input: PinVerificationNativeInput) {
        self.owner=owner; self.request=request; self.input=input; thread=Thread.current
    }
}
fileprivate extension NativePinVerification {
    func inputStillLive(_ request: OwnedPinVerification,input: PinVerificationNativeInput) -> Bool {
        condition.lock(); defer { condition.unlock() }
        guard let ticket=active else { return false }
        return request.owner === self && ticket.owned === request && ticket.gate === request.original
            && ticket.nativeInput === input && !ticket.cancelled && !ticket.sealed
            && !ticket.retiring && !ticket.retirementFenced
    }
    func reserveInput(_ request: OwnedPinVerification,input: PinVerificationNativeInput,thread: Thread) throws {
        try Self.deny(Thread.isMainThread && input.workerThread === thread)
        condition.lock(); defer { condition.unlock() }; let ticket=try ownLocked(request.original)
        try Self.deny(request.owner === self && ticket.owned === request && ticket.phase == .ready
            && !ticket.cancelled && !ticket.sealed && !ticket.retiring && !ticket.retirementFenced
            && ticket.workers==0 && ticket.replies.isEmpty && !ticket.inputIssued && ticket.nativeInput==nil)
        ticket.nativeInput=input; ticket.inputThread=thread; ticket.inputHandoff=false
    }
    func startInputWork(_ request: OwnedPinVerification,input: PinVerificationNativeInput) throws -> PinVerificationInputWork {
        try Self.deny(!Thread.isMainThread)
        condition.lock(); defer { condition.unlock() }; let ticket=try ownLocked(request.original)
        // A reserved actual Thread must still register/join cleanup after a
        // local revoke/retire; mandatory current checks deny any useful work.
        try Self.deny(request.owner === self && ticket.owned === request && ticket.nativeInput === input
            && ticket.inputThread === Thread.current && ticket.inputWork==nil && !ticket.inputHandoff
            && !ticket.retirementFenced)
        let work=PinVerificationInputWork(owner:self,request:request,input:input)
        ticket.inputWork=work
        try addWorkerLocked(ticket); return work
    }
    func currentInputWork(_ work: PinVerificationInputWork) throws {
        try Self.deny(!Thread.isMainThread && work.thread === Thread.current)
        condition.lock()
        let ticket: Ticket
        do {
            ticket=try ownLocked(work.request.original)
            try Self.deny(work.owner === self && ticket.owned === work.request && ticket.inputWork === work
                && ticket.nativeInput === work.input && ticket.inputThread === Thread.current && !work.finished)
            condition.unlock()
        } catch { condition.unlock(); throw error }
        var expected=try work.request.expected.copy(); defer { expected.resetBytes(in:0..<expected.count) }
        do {
            try Self.fence(expected,work.request.checksum)
            try locked { transaction in try readExact(transaction,expected); _=try current(ticket,work.request,expected) }
        } catch { failed(ticket,error,publication:false); throw error }
    }
    @discardableResult
    func finishInputWork(_ work: PinVerificationInputWork) -> Bool {
        condition.lock()
        guard let ticket=active, work.owner === self, ticket.owned === work.request,
            ticket.nativeInput === work.input, ticket.inputWork === work,
            ticket.inputThread === Thread.current, work.thread === Thread.current, !work.finished
        else { condition.unlock(); return false }
        work.finished=true; ticket.inputWork=nil; ticket.inputHandoff=true
        let valid = !ticket.cancelled && !ticket.sealed && !ticket.retiring && !ticket.retirementFenced
        condition.unlock(); settleWorker(ticket); return valid
    }
    func deliverInputFailure(_ request: OwnedPinVerification,input: PinVerificationNativeInput,
                             recipient: () throws -> Void) throws {
        try Self.deny(!Thread.isMainThread)
        condition.lock(); let ticket: Ticket
        do {
            ticket=try ownLocked(request.original)
            // Denial completion carries no comparison/permission. It still
            // joins actual host code and cannot start after whole retirement.
            try Self.deny(request.owner === self && ticket.owned === request && ticket.nativeInput === input
                && ticket.inputThread === Thread.current && ticket.inputWork==nil && ticket.workers==0
                && !ticket.retirementFenced)
            try addWorkerLocked(ticket); condition.unlock()
        } catch { condition.unlock(); throw error }
        defer { settleWorker(ticket) }
        do { try recipient() } catch { failed(ticket,error,publication:true); throw error }
    }
    func sealInputUnknown(_ request: OwnedPinVerification,input: PinVerificationNativeInput) {
        condition.lock(); defer { condition.unlock() }
        guard let ticket=active, ticket.owned === request, ticket.nativeInput === input else { return }
        ticket.sealed=true; ticket.phase = .sealed; wipeSealedLocked(ticket); condition.broadcast()
    }
    func releaseInput(_ request: OwnedPinVerification,input: PinVerificationNativeInput) throws {
        try Self.deny(!Thread.isMainThread && input.cleanupReturned)
        condition.lock(); defer { condition.unlock() }; let ticket=try ownLocked(request.original)
        try Self.deny(request.owner === self && ticket.owned === request && ticket.nativeInput === input
            && ticket.inputThread === Thread.current && ticket.inputWork==nil && ticket.workers==0)
        ticket.nativeInput=nil; ticket.inputThread=nil; ticket.inputHandoff=false; condition.broadcast()
    }
}

/** Concrete private UIKit input. It owns public keypad labels and bounded digit
 * bytes only; genuine host/checkpoint authority and App wiring are unavailable. */
fileprivate final class PinVerificationNativeInput {
    private let condition=NSCondition(), owner: NativePinVerification, request: OwnedPinVerification
    private let locale: PinNativeInputLocale, clock: PinPrimitiveClock, digits: PinNativeDigitBuffer
    private let delivered: (Result<PinVerificationReply,PinNativeInputFailure>) throws -> Void
    private weak var host: UIViewController?
    private weak var window: UIWindow?
    private weak var scene: UIWindowScene?
    private weak var originalRoot: UIViewController?
    private var controller: PinVerificationPinViewController?, timer: Timer?, observers=[NSObjectProtocol]()
    private var started=false, terminal=false, cancelled=false, submitted=false, uiClean=false
    private var eventsClosed=false, cleaned=false, finished=false
    private var queuedUI=0, executingUI=0, completions=0, cancellationPending=0
    private var presentationRequested=false, presentationReturned=false, dismissRequested=false, cancellationStarted=false
    private var lastNs: UInt64?, entered: PinPrimitiveInput?, originalReply: PinVerificationReply?
    private weak var thread: Thread?
    init(owner: NativePinVerification, request: OwnedPinVerification, host: UIViewController, locale: PinNativeInputLocale,
         delivered: @escaping (Result<PinVerificationReply,PinNativeInputFailure>) throws -> Void) throws {
        guard Thread.isMainThread, request.owner === owner,
            PinVerificationActionCopy.caption(request.original.action,locale:locale) != nil,
            let window=host.viewIfLoaded?.window, let scene=window.windowScene,
            scene.activationState == .foregroundActive, UIApplication.shared.applicationState == .active,
            !window.isHidden, !host.isBeingDismissed, host.presentedViewController==nil,
            let root=window.rootViewController else { throw PinNativeInputFailure.unavailable }
        self.owner=owner; self.request=request; self.host=host; self.window=window; self.scene=scene
        originalRoot=root; self.locale=locale; self.delivered=delivered
        clock=ApplePinPrimitiveClock(); digits=try PinNativeDigitBuffer(maximum:128)
    }
    fileprivate var workerThread: Thread? { condition.lock(); defer { condition.unlock() }; return thread }
    fileprivate var cleanupReturned: Bool {
        condition.lock(); defer { condition.unlock() }
        return cleaned && uiClean && eventsClosed && queuedUI==0 && executingUI==0 && completions==0 && cancellationPending==0
    }
    // The missing private host may retrieve only this original after cleanup.
    // Its known/uncertain ACK still passes the core's existing identity guards.
    func replyAfterCleanup() throws -> PinVerificationReply? {
        condition.lock(); defer { condition.unlock() }
        guard finished else { throw PinNativeInputFailure.unavailable }; return originalReply
    }
    func start() throws {
        guard Thread.isMainThread else { throw PinNativeInputFailure.unavailable }
        condition.lock()
        guard !started else { condition.unlock(); throw PinNativeInputFailure.unavailable }
        started=true; let worker=Thread { [self] in run() }; thread=worker; condition.unlock()
        // Reservation and actual Thread start are one owned call. A UI object
        // that was merely constructed never reserves or strands the core lane.
        try owner.reserveInput(request,input:self,thread:worker); worker.start()
    }
    private func postUI(_ task: @escaping () -> Void) {
        condition.lock(); queuedUI+=1; condition.unlock()
        DispatchQueue.main.async { [self] in
            condition.lock(); queuedUI-=1; executingUI+=1; condition.unlock()
            defer { condition.lock(); executingUI-=1; condition.broadcast(); condition.unlock() }
            task()
        }
    }
    private func event(_ task: () -> Void) {
        precondition(Thread.isMainThread)
        condition.lock()
        guard !eventsClosed else { condition.unlock(); return }
        executingUI+=1; condition.unlock()
        defer { condition.lock(); executingUI-=1; condition.broadcast(); condition.unlock() }; task()
    }
    private func localDeadline() throws {
        let ns=try clock.nanoseconds()
        guard owner.inputStillLive(request,input:self) else { throw PinNativeInputFailure.cancelled }
        condition.lock(); defer { condition.unlock() }
        guard ns>0, ns/1000000>=request.capturedUptimeMs, ns/1000000<request.deadlineUptimeMs,
            lastNs==nil || ns>=lastNs! else { throw PinNativeInputFailure.unavailable }
        lastNs=ns
    }
    private func hostCurrent(showing: Bool) -> Bool {
        guard Thread.isMainThread, let host=host, let window=window, let scene=scene,
            window.windowScene === scene, window.rootViewController === originalRoot, !window.isHidden,
            scene.activationState == .foregroundActive, UIApplication.shared.applicationState == .active,
            !host.isBeingDismissed else { return false }
        if !showing { return host.viewIfLoaded?.window === window && host.presentedViewController==nil }
        guard let controller=controller, host.presentedViewController === controller,
            controller.presentingViewController === host else { return false }
        condition.lock(); let returned=presentationReturned; condition.unlock()
        return !returned || controller.viewIfLoaded?.window === window
    }
    private func installLifecycle() {
        precondition(Thread.isMainThread)
        let center=NotificationCenter.default
        for name in [UIApplication.willResignActiveNotification,UIApplication.didEnterBackgroundNotification] {
            observers.append(center.addObserver(forName:name,object:nil,queue:.main) { [weak self] _ in self?.cancel() })
        }
        if let scene=scene {
            for name in [UIScene.willDeactivateNotification,UIScene.didEnterBackgroundNotification,UIScene.didDisconnectNotification] {
                observers.append(center.addObserver(forName:name,object:scene,queue:.main) { [weak self] _ in self?.cancel() })
            }
        }
        timer=Timer.scheduledTimer(withTimeInterval:0.05,repeats:true) { [weak self] _ in
            guard let input=self else { return }
            input.event {
                input.condition.lock()
                let stopped=input.cancelled || input.finished, cleaned=input.uiClean
                let transitioning=input.terminal && !cleaned
                input.condition.unlock()
                if stopped { return }
                do {
                    try input.localDeadline() // Also during held presentation/dismissal.
                    if transitioning { return }
                    guard input.hostCurrent(showing:!cleaned) else { input.cancel(); return }
                } catch { input.cancel() }
            }
        }
        if let timer=timer { RunLoop.main.add(timer,forMode:.common) }
    }
    private func show() {
        precondition(Thread.isMainThread)
        condition.lock(); let stopped=terminal; condition.unlock()
        if stopped { clearUI(); return }
        do {
            try localDeadline()
            guard hostCurrent(showing:false),let host=host else { cancel(); return }
            let view=PinVerificationPinViewController(owner:self,locale:locale,action:request.original.action)
            controller=view; view.modalPresentationStyle = .overFullScreen; view.isModalInPresentation=true
            installLifecycle()
            condition.lock(); presentationRequested=true; completions+=1; condition.unlock()
            host.present(view,animated:false) { [self] in event {
                condition.lock(); presentationReturned=true; completions-=1; let stopped=terminal
                condition.broadcast(); condition.unlock()
                if stopped { requestDismiss() } else if !hostCurrent(showing:true) { cancel() }
            } }
        } catch { cancel() }
    }
    private func clearUI() {
        precondition(Thread.isMainThread); digits.clear(); controller?.disableAndClear(); requestDismiss()
    }
    private func requestDismiss() {
        precondition(Thread.isMainThread); condition.lock()
        if dismissRequested { condition.unlock(); return }
        if presentationRequested && !presentationReturned { condition.unlock(); return }
        guard let view=controller else { uiClean=true; condition.broadcast(); condition.unlock(); return }
        dismissRequested=true
        let presented=view.presentingViewController != nil
        if presented { completions+=1 }; condition.unlock()
        if presented {
            let presenter=view.presentingViewController!
            presenter.dismiss(animated:false) { [self] in event {
                condition.lock(); completions-=1; uiClean=true; condition.broadcast(); condition.unlock()
            } }
        } else {
            // Actual presentation completion returned and UIKit owns no modal.
            condition.lock(); uiClean=true; condition.broadcast(); condition.unlock()
        }
    }
    private func removeLifecycle() {
        precondition(Thread.isMainThread)
        timer?.invalidate(); timer=nil
        observers.forEach { NotificationCenter.default.removeObserver($0) }; observers.removeAll()
        controller?.detach(); controller=nil
        condition.lock(); eventsClosed=true; condition.broadcast(); condition.unlock()
    }
    func cancel() {
        precondition(Thread.isMainThread)
        event {
            condition.lock(); let already=cancelled; terminal=true; cancelled=true
            entered?.close(); entered=nil; condition.broadcast(); condition.unlock()
            if !already {
                clearUI(); try? owner.revoke(request.original); beginCancellation()
            }
        }
    }
    private func beginCancellation() {
        condition.lock()
        if cancellationStarted { condition.unlock(); return }
        cancellationStarted=true; cancellationPending+=1; condition.unlock()
        Thread { [self] in
            do { try owner.cancel(request.original) }
            catch { owner.sealInputUnknown(request,input:self) }
            condition.lock(); cancellationPending-=1; condition.broadcast(); condition.unlock()
        }.start()
    }
    func disappeared() {
        event {
            condition.lock(); let expected=terminal && dismissRequested; condition.unlock()
            if !expected { cancel() }
        }
    }
    func tapDigit(_ digit: UInt8) {
        event {
            condition.lock(); let stopped=terminal; condition.unlock(); guard !stopped else { return }
            do {
                try localDeadline(); guard hostCurrent(showing:true) else { cancel(); return }
                if digits.count>=128 { return }
                try digits.append(digit); controller?.update(count:digits.count)
            } catch { cancel() }
        }
    }
    func deleteDigit() {
        event {
            condition.lock(); let stopped=terminal; condition.unlock(); guard !stopped else { return }
            do {
                try localDeadline(); guard hostCurrent(showing:true) else { cancel(); return }
                try digits.removeLast(); controller?.update(count:digits.count)
            } catch { cancel() }
        }
    }
    func submit() {
        event {
            condition.lock(); let stopped=terminal; condition.unlock(); guard !stopped else { return }
            do {
                try localDeadline(); guard hostCurrent(showing:true) else { cancel(); return }
                let input=try digits.move(minimum:1)
                condition.lock()
                if terminal { condition.unlock(); input.close(); return }
                entered=input; terminal=true; submitted=true; condition.broadcast(); condition.unlock(); clearUI()
            } catch { cancel() }
        }
    }
    private func waitForUI() {
        condition.lock(); defer { condition.unlock() }
        while !uiClean || queuedUI != 0 || executingUI != 0 || completions != 0 || cancellationPending != 0 { condition.wait() }
    }
    private func run() {
        var work: PinVerificationInputWork?, deliveryEntered=false
        do {
            work=try owner.startInputWork(request,input:self)
            try owner.currentInputWork(work!)
            postUI { [self] in show() }
            condition.lock()
            while !terminal || !uiClean || queuedUI != 0 || executingUI != 0 || completions != 0 || cancellationPending != 0 {
                condition.wait()
            }
            let accepted=submitted && !cancelled
            let raw=entered; entered=nil; condition.unlock()
            defer { raw?.close() }
            guard accepted,let raw=raw else { throw PinNativeInputFailure.cancelled }
            try owner.currentInputWork(work!)
            let nativeValid=owner.finishInputWork(work!); work=nil
            guard nativeValid else { throw PinNativeInputFailure.cancelled }
            // The visible UI and its callbacks truly joined. The exact original
            // slot/Thread remains reserved while ordinary workers0 rules hold.
            let entry=try owner.bindInput(request,raw:raw,inputHandoff:self)
            let reply=try owner.verify(request,input:entry,inputHandoff:self)
            condition.lock(); originalReply=reply; condition.unlock()
            try owner.deliver(reply,inputHandoff:self) { [self] original in
                condition.lock(); let accepted = !cancelled; condition.unlock()
                guard accepted else { throw PinVerificationRefusal() }
                deliveryEntered=true; try delivered(.success(original))
            }
        } catch {
            postUI { [self] in cancel() }; waitForUI()
            condition.lock(); entered?.close(); entered=nil; condition.unlock()
            if let original=work { _=owner.finishInputWork(original); work=nil }
            if !deliveryEntered {
                try? owner.deliverInputFailure(request,input:self) {
                    try delivered(.failure(error is PinNativeInputFailure || error is PinVerificationRefusal ? .cancelled:.unavailable))
                }
            }
        }
        postUI { [self] in removeLifecycle() }
        condition.lock()
        while queuedUI != 0 || executingUI != 0 || completions != 0 || cancellationPending != 0 { condition.wait() }
        entered?.close(); entered=nil; cleaned=true; condition.unlock()
        do {
            try owner.releaseInput(request,input:self)
            condition.lock(); finished=true; condition.broadcast(); condition.unlock()
        } catch { owner.sealInputUnknown(request,input:self) } // Never invent cleanup/ACK or release unknown capacity.
    }
    deinit { digits.clear(); entered?.close() }
}

/** Fixed root-authored public action copy, never a caller-supplied caption. */
fileprivate enum PinVerificationActionCopy {
    private static let captions: [String:(String,String)] = [
        "exit-child-mode":("Выйти из детского режима","Exit child mode"),
        "switch-adult-profile":("Переключиться на взрослый профиль","Switch to an adult profile"),
        "change-exact-age":("Изменить возраст","Change age"),
        "change-blocked-topics":("Изменить заблокированные темы","Change blocked topics"),
        "open-adult-store":("Открыть магазин","Open the store"),
        "initiate-purchase":("Начать покупку","Start a purchase"),
        "restore-purchases":("Восстановить покупки","Restore purchases"),
        "open-external":("Открыть внешнюю ссылку","Open an external link"),
        "share":("Поделиться материалом","Share content"),
        "account-change":("Сменить аккаунт","Change account"),
        "export-child-data":("Экспортировать данные ребёнка","Export child data"),
        "delete-child-data":("Удалить данные ребёнка","Delete child data"),
        "diagnostics":("Открыть диагностику","Open diagnostics"),
        "expand-access-settings":("Расширить доступ","Expand access"),
        "enable-licensed-pack":("Включить набор материалов","Enable a content pack"),
        "view-legal-commercial":("Открыть правовую и коммерческую информацию","View legal and commercial information")
    ]
    static func caption(_ action: String,locale: PinNativeInputLocale) -> String? {
        guard let pair=captions[action] else { return nil }; return locale == .ru ? pair.0:pair.1
    }
}

/** Premium accessible single-entry keypad. Render public labels/length only;
 * no UITextField, entered-PIN String, clipboard, JS or restoration payload. */
fileprivate final class PinVerificationPinViewController: UIViewController {
    private weak var owner: PinVerificationNativeInput?
    private let locale: PinNativeInputLocale, action: String
    private let titleLabel=UILabel(), actionLabel=UILabel(), countLabel=UILabel(), hintLabel=UILabel()
    private let continueButton=UIButton(type:.system)
    private var inputButtons=[UIButton]()
    init(owner: PinVerificationNativeInput,locale: PinNativeInputLocale,action: String) {
        self.owner=owner; self.locale=locale; self.action=action; super.init(nibName:nil,bundle:nil)
    }
    required init?(coder: NSCoder) { return nil }
    private func text(_ ru: String,_ en: String) -> String { locale == .ru ? ru:en }
    override func viewDidLoad() {
        super.viewDidLoad()
        let navy=UIColor(red:0.025,green:0.06,blue:0.12,alpha:1), gold=UIColor(red:0.84,green:0.72,blue:0.46,alpha:1)
        view.backgroundColor=navy; view.tintColor=gold; view.accessibilityViewIsModal=true
        let scroll=UIScrollView(), stack=UIStackView(); scroll.translatesAutoresizingMaskIntoConstraints=false
        stack.translatesAutoresizingMaskIntoConstraints=false; stack.axis = .vertical; stack.spacing=16
        view.addSubview(scroll); scroll.addSubview(stack)
        NSLayoutConstraint.activate([
            scroll.leadingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.trailingAnchor),
            scroll.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),
            scroll.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo:scroll.contentLayoutGuide.leadingAnchor,constant:24),
            stack.trailingAnchor.constraint(equalTo:scroll.contentLayoutGuide.trailingAnchor,constant:-24),
            stack.topAnchor.constraint(equalTo:scroll.contentLayoutGuide.topAnchor,constant:24),
            stack.bottomAnchor.constraint(equalTo:scroll.contentLayoutGuide.bottomAnchor,constant:-24),
            stack.widthAnchor.constraint(equalTo:scroll.frameLayoutGuide.widthAnchor,constant:-48)
        ])
        for label in [titleLabel,actionLabel,countLabel,hintLabel] {
            label.numberOfLines=0; label.textAlignment = .center; label.adjustsFontForContentSizeCategory=true
            label.textColor = .white; stack.addArrangedSubview(label)
        }
        titleLabel.textColor=gold; titleLabel.font = .preferredFont(forTextStyle:.title2)
        titleLabel.accessibilityTraits.insert(.header); titleLabel.text=text("Родительский PIN","Parent PIN")
        actionLabel.font = .preferredFont(forTextStyle:.headline)
        actionLabel.text=PinVerificationActionCopy.caption(action,locale:locale)
        hintLabel.font = .preferredFont(forTextStyle:.body)
        hintLabel.text=text("Введите PIN, чтобы подтвердить действие.","Enter your PIN to confirm this action.")
        countLabel.font = .preferredFont(forTextStyle:.title1)
        let labels=[["1","2","3"],["4","5","6"],["7","8","9"],["⌫","0",""]]
        for row in labels {
            let line=UIStackView(); line.axis = .horizontal; line.spacing=12; line.distribution = .fillEqually
            for label in row {
                let button=UIButton(type:.system); button.setTitle(label,for:.normal)
                button.titleLabel?.font = .preferredFont(forTextStyle:.title1)
                button.titleLabel?.adjustsFontForContentSizeCategory=true; button.setTitleColor(.white,for:.normal)
                button.tintColor=gold; button.backgroundColor=UIColor(red:0.065,green:0.12,blue:0.20,alpha:1)
                button.layer.cornerRadius=12; button.heightAnchor.constraint(greaterThanOrEqualToConstant:56).isActive=true
                if let digit=Int(label) { button.tag=digit; button.addTarget(self,action:#selector(digitTap(_:)),for:.touchUpInside) }
                else if label=="⌫" {
                    button.accessibilityLabel=text("Удалить последнюю цифру","Delete last digit")
                    button.addTarget(self,action:#selector(deleteTap),for:.touchUpInside)
                } else { button.isEnabled=false; button.isHidden=true }
                line.addArrangedSubview(button); inputButtons.append(button)
            }
            stack.addArrangedSubview(line)
        }
        continueButton.setTitle(text("Продолжить","Continue"),for:.normal)
        continueButton.backgroundColor=gold; continueButton.setTitleColor(navy,for:.normal); continueButton.layer.cornerRadius=12
        continueButton.titleLabel?.font = .preferredFont(forTextStyle:.headline)
        continueButton.titleLabel?.adjustsFontForContentSizeCategory=true
        continueButton.heightAnchor.constraint(greaterThanOrEqualToConstant:48).isActive=true
        continueButton.addTarget(self,action:#selector(submitTap),for:.touchUpInside); stack.addArrangedSubview(continueButton)
        let cancel=UIButton(type:.system); cancel.setTitle(text("Отмена","Cancel"),for:.normal)
        cancel.titleLabel?.font = .preferredFont(forTextStyle:.body); cancel.titleLabel?.adjustsFontForContentSizeCategory=true
        cancel.heightAnchor.constraint(greaterThanOrEqualToConstant:48).isActive=true
        cancel.addTarget(self,action:#selector(cancelTap),for:.touchUpInside); stack.addArrangedSubview(cancel)
        update(count:0)
    }
    override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated); owner?.disappeared() }
    func update(count: Int) {
        countLabel.text=String(repeating:"•",count:min(count,12))
        countLabel.accessibilityLabel=text("Введено цифр: \(count)","Digits entered: \(count)")
        continueButton.isEnabled=count>=1 && count<=128
    }
    func disableAndClear() {
        inputButtons.forEach { $0.isEnabled=false }; continueButton.isEnabled=false
        countLabel.text=""; countLabel.accessibilityLabel=text("Ввод закрыт","Input closed")
    }
    func detach() { disableAndClear(); owner=nil }
    @objc private func digitTap(_ sender: UIButton) { guard sender.tag>=0 && sender.tag<=9 else { return }; owner?.tapDigit(UInt8(sender.tag)+48) }
    @objc private func deleteTap() { owner?.deleteDigit() }
    @objc private func submitTap() { owner?.submit() }
    @objc private func cancelTap() { owner?.cancel() }
}
// App/scene/plugin registration and genuine private Gate settlement remain absent.

/** Local OS-owner permission prerequisite only. No checkpoint, antirollback,
 * trusted-time, initial seed, legal-guardian or App admission is minted here.
 * Actual factories remain nil. The private host must retain original objects,
 * settle the exact transfer, and invoke consume inside the existing commit lock. */
fileprivate enum PinOwnerKeySource { case secureEnclave, synthetic }
fileprivate final class PinOwnerKey {
    let privateKey: SecKey, publicKey: SecKey, publicBytes: Data, source: PinOwnerKeySource
    init(privateKey: SecKey, publicKey: SecKey, publicBytes: Data, source: PinOwnerKeySource) {
        self.privateKey=privateKey; self.publicKey=publicKey; self.publicBytes=Data(Array(publicBytes)); self.source=source
    }
}
fileprivate protocol PinOwnerKeys: AnyObject {
    var source: PinOwnerKeySource { get }
    func acquire(enroll: Bool, context: LAContext, prompt: String) throws -> PinOwnerKey
    func current(_ original: PinOwnerKey) throws
    func sign(_ original: PinOwnerKey, message: Data) throws -> Data
}
fileprivate final class ApplePinOwnerKeys: PinOwnerKeys {
    let source: PinOwnerKeySource = .secureEnclave
    private let tag=Data("ru.probpera.literaryplanet.child.pin.owner.passcode.v1".utf8)
    private func access() throws -> SecAccessControl {
        var error: Unmanaged<CFError>?
        guard let control=SecAccessControlCreateWithFlags(nil,kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            [.privateKeyUsage,.devicePasscode],&error) else { throw PlanetChildVault.Failure.unavailable }
        return control
    }
    private func load(context: LAContext?, prompt: String?) throws -> PinOwnerKey? {
        var query: [CFString:Any]=[kSecClass:kSecClassKey,kSecAttrApplicationTag:tag,kSecAttrKeyType:kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeyClass:kSecAttrKeyClassPrivate,kSecReturnRef:true,kSecReturnAttributes:true,kSecMatchLimit:kSecMatchLimitOne]
        if let context { query[kSecUseAuthenticationContext]=context }
        if let prompt { query[kSecUseOperationPrompt]=prompt }
        if context == nil { query[kSecUseAuthenticationUI]=kSecUseAuthenticationUIFail }
        var result: CFTypeRef?
        let status=SecItemCopyMatching(query as CFDictionary,&result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let item=result as? [String:Any], let ref=item[kSecValueRef as String],
            CFGetTypeID(ref as CFTypeRef)==SecKeyGetTypeID(), let acl=item[kSecAttrAccessControl as String],
            CFGetTypeID(acl as CFTypeRef)==SecAccessControlGetTypeID(), CFEqual(acl as CFTypeRef,try access()),
            (item[kSecAttrAccessible as String] as? String)==(kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly as String)
        else { throw PlanetChildVault.Failure.unavailable }
        let key=ref as! SecKey
        guard let attributes=SecKeyCopyAttributes(key) as? [String:Any],
            (attributes[kSecAttrTokenID as String] as? String)==(kSecAttrTokenIDSecureEnclave as String),
            (attributes[kSecAttrKeyType as String] as? String)==(kSecAttrKeyTypeECSECPrimeRandom as String),
            (attributes[kSecAttrKeySizeInBits as String] as? NSNumber)?.intValue==256,
            let publicKey=SecKeyCopyPublicKey(key), SecKeyIsAlgorithmSupported(key,.sign,.ecdsaSignatureMessageX962SHA256),
            SecKeyIsAlgorithmSupported(publicKey,.verify,.ecdsaSignatureMessageX962SHA256)
        else { throw PlanetChildVault.Failure.unavailable }
        var error: Unmanaged<CFError>?
        guard let bytes=SecKeyCopyExternalRepresentation(publicKey,&error) as Data?, bytes.count==65 else {
            throw PlanetChildVault.Failure.unavailable
        }
        return PinOwnerKey(privateKey:key,publicKey:publicKey,publicBytes:bytes,source:source)
    }
    func acquire(enroll: Bool, context: LAContext, prompt: String) throws -> PinOwnerKey {
        if let existing=try load(context:context,prompt:prompt) { return existing }
        // Recover never repairs a missing/invalidated key. Other lookup failures
        // also deny; no delete/recreate, ambiguous-create retry or fallback.
        guard enroll else { throw PinKnownRefusal() }
        var error: Unmanaged<CFError>?
        let attributes: [CFString:Any]=[kSecAttrKeyType:kSecAttrKeyTypeECSECPrimeRandom,kSecAttrKeySizeInBits:256,
            kSecAttrTokenID:kSecAttrTokenIDSecureEnclave,kSecPrivateKeyAttrs:[
                kSecAttrIsPermanent:true,kSecAttrApplicationTag:tag,kSecAttrAccessControl:try access(),kSecAttrIsExtractable:false]]
        guard let created=SecKeyCreateRandomKey(attributes as CFDictionary,&error), let createdPublic=SecKeyCopyPublicKey(created),
            let createdBytes=SecKeyCopyExternalRepresentation(createdPublic,&error) as Data?,
            let loaded=try load(context:context,prompt:prompt), loaded.publicBytes==createdBytes
        else { throw PlanetChildVault.Failure.unavailable }
        return loaded
    }
    func current(_ original: PinOwnerKey) throws {
        guard original.source == source, let persisted=try load(context:nil,prompt:nil),
            persisted.publicBytes==original.publicBytes else { throw PinKnownRefusal() }
    }
    func sign(_ original: PinOwnerKey, message: Data) throws -> Data {
        try current(original); var error: Unmanaged<CFError>?
        // The original fresh authentication context was attached to this exact
        // key reference. Successful LA callbacks/availability never grant proof.
        guard let signature=SecKeyCreateSignature(original.privateKey,.ecdsaSignatureMessageX962SHA256,message as CFData,&error) as Data?,
            !signature.isEmpty, signature.count<=144 else { throw PinKnownRefusal() }
        try current(original); return Data(Array(signature))
    }
}
fileprivate final class PinOwnerOriginalHost {
    private weak var host: UIViewController?, window: UIWindow?, scene: UIWindowScene?, root: UIViewController?
    init(_ host: UIViewController) throws {
        guard Thread.isMainThread, let window=host.viewIfLoaded?.window, let scene=window.windowScene,
            let root=window.rootViewController, scene.activationState == .foregroundActive,
            UIApplication.shared.applicationState == .active, !window.isHidden, !host.isBeingDismissed,
            host.presentedViewController==nil else { throw PinKnownRefusal() }
        self.host=host; self.window=window; self.scene=scene; self.root=root
    }
    func current() throws {
        // Dedicated signing/consume workers join the actual main-thread check.
        // Never block main waiting for signing/cancel/retire.
        let check: () -> Bool = { [self] in
            guard let host,let window,let scene,let root else { return false }
            return host.viewIfLoaded?.window === window && window.windowScene === scene && window.rootViewController === root
                && !window.isHidden && !host.isBeingDismissed && host.presentedViewController==nil
                && scene.activationState == .foregroundActive && UIApplication.shared.applicationState == .active
        }
        let valid=Thread.isMainThread ? check():DispatchQueue.main.sync(execute:check)
        guard valid else { throw PinKnownRefusal() }
    }
    func disconnected(_ note: Notification) -> Bool { (note.object as? UIWindowScene) === scene }
}
fileprivate final class PinNativeOwnerRequest {
    let owner: NativePinOwnerPermissionProvider, session: OwnedPinSession, old: PinOwnedBytes, next: PinOwnedBytes
    let nextChecksum: String, nextRevision: UInt64, locale: PinNativeInputLocale, host: PinOwnerOriginalHost?, nonce: Data
    // All mutable fields are protected by owner.condition. Counts are actual
    // unsettled invocations, not timeout or reconstructed callback receipts.
    var started=false, cancelled=false, finished=false, cleanupFenced=false, retirementFenced=false, worker=0, watcher=0, cancelling=0, consuming=0
    var context: LAContext?, workerThread: ObjectIdentifier?, consumeThread: ObjectIdentifier?, permission: PinNativeOwnerPermission?
    var deliveryCompleted=false, deliverySettled=false, deliveryKnown=false, lastNs: UInt64?
    var observers=[NSObjectProtocol](), events=0
    init(owner: NativePinOwnerPermissionProvider, session: OwnedPinSession, expected: Data, next: Data, checksum: String, revision: UInt64,
         locale: PinNativeInputLocale, host: PinOwnerOriginalHost?, nonce: Data) throws {
        self.owner=owner; self.session=session; old=PinOwnedBytes(expected); self.next=PinOwnedBytes(next)
        nextChecksum=checksum; nextRevision=revision; self.locale=locale; self.host=host; self.nonce=Data(Array(nonce))
    }
    func close() { old.close(); next.close(); permission?.close() }
    deinit { close() }
}
fileprivate final class PinNativeOwnerPermission {
    let owner: NativePinOwnerPermissionProvider, request: PinNativeOwnerRequest, key: PinOwnerKey, reply: PinNativeReply
    let message: PinOwnedBytes, signature: PinOwnedBytes
    var consumed=false
    init(owner: NativePinOwnerPermissionProvider,request: PinNativeOwnerRequest,key: PinOwnerKey,reply: PinNativeReply,message: Data,signature: Data) {
        self.owner=owner; self.request=request; self.key=key; self.reply=reply; self.message=PinOwnedBytes(message); self.signature=PinOwnedBytes(signature)
    }
    func close() { message.close(); signature.close() }
    deinit { close() }
}
fileprivate extension NativePinSessions {
    func reserveOwnerRequest(_ request: PinNativeOwnerRequest) throws {
        condition.lock(); defer { condition.unlock() }; let session=request.session,inspection=session.inspection
        try liveLocked(inspection)
        try Self.require(session.owner === self && inspection.session === session && !session.disposed && !inspection.retiring
            && inspection.phase == .begun && inspection.workers==0 && inspection.transfers==0 && inspection.nativeInput==nil
            && inspection.primitiveWorker==nil && inspection.primitiveMaterial==nil && inspection.ownerAuthorization==nil)
        inspection.ownerAuthorization=request
    }
    func ownerPermissionReply(_ request: PinNativeOwnerRequest,work: PinPrimitiveWork) throws -> PinNativeReply {
        condition.lock(); defer { condition.unlock() }; let inspection=request.session.inspection
        try liveLocked(inspection)
        try Self.require(inspection.ownerAuthorization === request && work.owner === self && work.session === request.session
            && inspection.primitiveWorker === work && !work.finished && !inspection.retiring && inspection.transfers==0)
        let reply=PinNativeReply(owner:self,inspection:inspection,session:request.session,kind:.ownerPermission,bytes:nil,checksum:request.session.checksum)
        inspection.pendingReplies[ObjectIdentifier(reply)]=reply; inspection.transfers+=1; return reply
    }
    func ownerMutationFence(_ request: PinNativeOwnerRequest,next: Data,checksum: String,revision: UInt64) throws {
        let session=request.session,inspection=session.inspection
        condition.lock()
        let thread=ObjectIdentifier(Thread.current)
        let valid=inspection.ownerAuthorization === request && inspection.phase == .committing && inspection.workers==1
            && inspection.threads[thread]==1 && inspection.transfers==0 && inspection.primitiveWorker==nil
        condition.unlock(); try Self.require(valid)
        var old=try request.old.copy(), retainedNext=try request.next.copy()
        defer { old.resetBytes(in:0..<old.count); retainedNext.resetBytes(in:0..<retainedNext.count) }
        try Self.require(next==retainedNext && checksum==request.nextChecksum && revision==request.nextRevision)
        try mutationFence(session,old,next,checksum,revision)
        // Caller already holds the original durable IO/publication lock and
        // exact-read old record; reacquiring nonrecursive IO here would deadlock.
        _=try current(session,old,session.checksum,session.revision)
        try mutationFence(session,old,next,checksum,revision)
    }
    func ownerFinalStateFence(_ request: PinNativeOwnerRequest) throws {
        condition.lock();defer { condition.unlock() };let session=request.session,inspection=session.inspection
        try liveLocked(inspection)
        try Self.require(inspection.ownerAuthorization === request && inspection.session === session && session.owner === self
            && !session.disposed && !inspection.retiring && inspection.phase == .committing && inspection.workers==1
            && inspection.threads[ObjectIdentifier(Thread.current)]==1 && inspection.transfers==0 && inspection.primitiveWorker==nil)
    }
}
fileprivate final class NativePinOwnerPermissionProvider: PinRecoveryAuthority {
    fileprivate let condition=NSCondition()
    private let core: NativePinSessions, keys: PinOwnerKeys, clock: PinPrimitiveClock
    private let synthetic: Bool
    private var active: PinNativeOwnerRequest?
    init(core: NativePinSessions) {
        self.core=core; keys=ApplePinOwnerKeys(); clock=ApplePinPrimitiveClock(); synthetic=false
    }
    #if DEBUG
    fileprivate init(syntheticCore core: NativePinSessions,keys: PinOwnerKeys,clock: PinPrimitiveClock) throws {
        guard keys.source == .synthetic else { throw PlanetChildVault.Failure.unavailable }
        self.core=core; self.keys=keys; self.clock=clock; synthetic=true
    }
    #endif
    private func copy(_ request: PinNativeOwnerRequest) -> (String,String) {
        let ru=request.locale == .ru
        let title=request.session.inspection.action == .enroll
            ? (ru ? "Подтвердите создание родительского PIN":"Confirm Parent PIN setup")
            : (ru ? "Подтвердите восстановление родительского PIN":"Confirm Parent PIN recovery")
        return (title,ru ? "Подтвердите действие кодом блокировки устройства.":"Use your device screen lock to confirm this action.")
    }
    func request(_ session: OwnedPinSession,next: Data,checksum: String,revision: UInt64,host: UIViewController,locale: PinNativeInputLocale) throws -> PinNativeOwnerRequest {
        guard !synthetic else { throw PlanetChildVault.Failure.unavailable }
        return try makeRequest(session,next:next,checksum:checksum,revision:revision,host:PinOwnerOriginalHost(host),locale:locale)
    }
    private func makeRequest(_ session: OwnedPinSession,next: Data,checksum: String,revision: UInt64,host: PinOwnerOriginalHost?,locale: PinNativeInputLocale) throws -> PinNativeOwnerRequest {
        guard session.owner === core, session.inspection.action == .enroll || session.inspection.action == .recover,
            !next.isEmpty, next.count<=PlanetChildVault.maxBytes, NativePinSessions.hash(checksum),
            session.revision<9007199254740991,revision==session.revision+1 else { throw PinKnownRefusal() }
        var ownedNext=Data(Array(next)),old=try session.expected.copy(); defer { ownedNext.resetBytes(in:0..<ownedNext.count);old.resetBytes(in:0..<old.count) }
        guard Self.digest(ownedNext)==checksum else { throw PinKnownRefusal() }
        let before=try PlanetChildVault.ProtectedEnvelope.decode(old,policyVersion:session.policy.version,policyChecksum:session.policy.checksum,maxIterations:session.policy.maximumIterations)
        let after=try PlanetChildVault.ProtectedEnvelope.decode(ownedNext,policyVersion:session.policy.version,policyChecksum:session.policy.checksum,maxIterations:session.policy.maximumIterations)
        defer { before.close();after.close() }
        try PlanetChildVault.ProtectedEnvelope.validateTransition(before,after,action:session.inspection.action,sampledLogicalMs:session.capturedLogicalMs)
        try NativePinSessions.require((try after.pinSessionMetadata()).iterations==session.policy.iterations)
        var nonce=Data(count:32)
        let status=nonce.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault,$0.count,$0.baseAddress!) }
        guard status==errSecSuccess else { throw PlanetChildVault.Failure.unavailable }
        let request=try PinNativeOwnerRequest(owner:self,session:session,expected:old,next:ownedNext,checksum:checksum,revision:revision,locale:locale,host:host,nonce:nonce)
        condition.lock(); let free=active==nil; if free { active=request };condition.unlock()
        guard free else { request.close();throw PinKnownRefusal() }
        do {
            try core.reserveOwnerRequest(request)
            if host != nil {
                let center=NotificationCenter.default
                for name in [UIApplication.didEnterBackgroundNotification,UIScene.didDisconnectNotification] {
                    let observer=center.addObserver(forName:name,object:nil,queue:.main) { [weak self,weak request] note in
                        guard let self,let request else { return }
                        self.hostEvent(request,note:note)
                    }
                    condition.lock();request.observers.append(observer);condition.unlock()
                }
            }
            return request
        }
        catch { condition.lock();if active === request { active=nil };condition.unlock();request.close();throw error }
    }
    private static func digest(_ bytes: Data) -> String { SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() }
    private func hostEvent(_ request: PinNativeOwnerRequest,note: Notification) {
        condition.lock();let admitted=active === request && !request.retirementFenced
        if admitted { request.events+=1 };condition.unlock()
        guard admitted else { return }
        defer { condition.lock();request.events-=1;condition.broadcast();condition.unlock() }
        if note.name == UIApplication.didEnterBackgroundNotification || request.host?.disconnected(note)==true { cancel(request) }
    }
    private func local(_ request: PinNativeOwnerRequest) throws {
        let ns=try clock.nanoseconds()
        condition.lock();defer { condition.unlock() }
        guard active === request,!request.cancelled,!request.finished,ns>0,
            ns/1000000>=request.session.capturedUptimeMs,ns/1000000<request.session.deadlineUptimeMs,
            request.lastNs==nil || ns>=request.lastNs! else { throw PinKnownRefusal() }
        request.lastNs=ns
    }
    private func fence(_ request: PinNativeOwnerRequest,_ work: PinPrimitiveWork) throws {
        try local(request);try request.host?.current();_=try core.currentPrimitiveWork(work)
        var old=try request.old.copy(),next=try request.next.copy(),expected=try request.session.expected.copy()
        defer { old.resetBytes(in:0..<old.count);next.resetBytes(in:0..<next.count);expected.resetBytes(in:0..<expected.count) }
        guard old==expected,Self.digest(old)==request.session.checksum,Self.digest(next)==request.nextChecksum else { throw PinKnownRefusal() }
        try local(request)
    }
    private func message(_ request: PinNativeOwnerRequest,key: PinOwnerKey) throws -> Data {
        let s=request.session
        let fields=["literary-planet/local-os-owner-pin/v1",s.inspection.wireId,s.inspection.action.rawValue,
            s.checksum,String(s.revision),request.nextChecksum,String(request.nextRevision),s.policy.version,s.policy.checksum,
            String(s.policy.iterations),s.epoch,String(s.hostGeneration),s.bootId,String(s.capturedUptimeMs),String(s.capturedLogicalMs),
            String(s.clockUptimeMs),String(s.clockLogicalMs),String(s.deadlineUptimeMs),request.locale == .ru ? "ru":"en",
            request.nonce.map { String(format:"%02x",$0) }.joined(),Self.digest(key.publicBytes),synthetic ? "synthetic":"secure-enclave"]
        // Length-prefix exact immutable fields, with an explicit local domain.
        // No full record, PIN, cloud, action reinterpretation or new deadline.
        let bytes=Data(fields.map { "\($0.utf8.count):\($0)" }.joined().utf8)
        guard bytes.count<=4096 else { throw PlanetChildVault.Failure.unavailable };return bytes
    }
    private func verified(_ permission: PinNativeOwnerPermission) throws {
        var bytes=try permission.message.copy(),signature=try permission.signature.copy()
        defer { bytes.resetBytes(in:0..<bytes.count);signature.resetBytes(in:0..<signature.count) }
        guard bytes == (try message(permission.request,key:permission.key)),permission.key.source==keys.source else { throw PinKnownRefusal() }
        var error: Unmanaged<CFError>?
        guard SecKeyVerifySignature(permission.key.publicKey,.ecdsaSignatureMessageX962SHA256,bytes as CFData,signature as CFData,&error) else { throw PinKnownRefusal() }
    }
    func authorize(_ request: PinNativeOwnerRequest,recipient: @escaping (Result<PinNativeOwnerPermission,Error>) throws -> Void) throws {
        condition.lock()
        guard request.owner === self,active === request,!request.started,!request.cancelled else { condition.unlock();throw PinKnownRefusal() }
        request.started=true;request.worker=1;condition.unlock()
        Thread { [self] in run(request,recipient:recipient) }.start()
    }
    private func watch(_ request: PinNativeOwnerRequest) {
        condition.lock();request.watcher+=1;condition.unlock()
        Thread { [self] in
            defer { condition.lock();request.watcher-=1;condition.broadcast();condition.unlock() }
            while true {
                condition.lock()
                let stop=request.finished || request.cancelled || request.cleanupFenced
                if !stop { _=condition.wait(until:Date(timeIntervalSinceNow:0.05)) }
                condition.unlock();if stop { return }
                do { try local(request) } catch { cancel(request);return }
            }
        }.start()
    }
    private func run(_ request: PinNativeOwnerRequest,recipient: (Result<PinNativeOwnerPermission,Error>) throws -> Void) {
        condition.lock();request.workerThread=ObjectIdentifier(Thread.current);condition.unlock()
        var work: PinPrimitiveWork?,permission: PinNativeOwnerPermission?,failure: Error?,recipientCalled=false,successEntered=false
        do {
            let counted=try core.startPrimitiveWork(request.session);work=counted;try fence(request,counted)
            let context=LAContext();context.touchIDAuthenticationAllowableReuseDuration=0
            let text=copy(request),prompt=text.0+"\n"+text.1
            condition.lock()
            guard !request.cancelled else { condition.unlock();context.invalidate();throw PinKnownRefusal() }
            request.context=context;condition.unlock();watch(request)
            let key=try keys.acquire(enroll:request.session.inspection.action == .enroll,context:context,prompt:prompt)
            try fence(request,counted);let bytes=try message(request,key:key)
            let signature=try keys.sign(key,message:bytes);try fence(request,counted);try keys.current(key)
            var signatureError: Unmanaged<CFError>?
            guard SecKeyVerifySignature(key.publicKey,.ecdsaSignatureMessageX962SHA256,bytes as CFData,signature as CFData,&signatureError)
            else { throw PinKnownRefusal() }
            let reply=try core.ownerPermissionReply(request,work:counted)
            let proof=PinNativeOwnerPermission(owner:self,request:request,key:key,reply:reply,message:bytes,signature:signature)
            permission=proof;condition.lock();request.permission=proof;condition.unlock()
            try verified(proof);try fence(request,counted)
            recipientCalled=true;successEntered=true;try recipient(.success(proof));try fence(request,counted);try keys.current(key)
        } catch { failure=error;if permission != nil && recipientCalled { try? core.sealUnknown(request.session.inspection) } }
        if !recipientCalled {
            recipientCalled=true
            do { try recipient(.failure(failure ?? PinKnownRefusal())) }
            catch { failure=error;try? core.sealUnknown(request.session.inspection) }
        }
        // Join context and deadline-watch cleanup before handoff. Background and
        // original-scene observers remain live for the entire unused grant, so
        // foreground return cannot resurrect an old owner permission.
        condition.lock();request.cleanupFenced=true;let context=request.context;condition.broadcast();condition.unlock()
        context?.invalidate()
        condition.lock();while request.watcher != 0 || request.cancelling != 0 || request.events != 0 { condition.wait() };condition.unlock()
        if failure == nil,let counted=work {
            do { try request.host?.current();_=try core.currentPrimitiveWork(counted)
                let ns=try clock.nanoseconds();condition.lock()
                let valid=active === request && !request.cancelled && ns>0 && ns/1000000>=request.session.capturedUptimeMs
                    && ns/1000000<request.session.deadlineUptimeMs && (request.lastNs==nil || ns>=request.lastNs!)
                if valid { request.lastNs=ns };condition.unlock();guard valid else { throw PinKnownRefusal() }
            } catch { failure=error }
        }
        if let counted=work,!core.finishPrimitiveWork(counted) { failure=PinKnownRefusal() }
        condition.lock()
        if failure != nil { request.cancelled=true;permission?.consumed=true;permission?.close() }
        request.context=nil;request.worker=0;request.finished=true;condition.broadcast();condition.unlock()
        if let permission,!successEntered {
            // Never exposed to a success recipient: actual known non-delivery,
            // after all native work has settled. This is not a fabricated ACK.
            try? core.settleReply(permission.reply,delivery:.uncertain)
        }
        // A minted but uncertain delivery retains its original transfer until
        // actual host settlement. No exception/timer frees that pending reply.
    }
    func cancel(_ request: PinNativeOwnerRequest) {
        condition.lock()
        guard request.owner === self,active === request,!request.cancelled else { condition.unlock();return }
        request.cancelled=true;request.permission?.consumed=true;request.cancelling+=1;let context=request.context;condition.broadcast();condition.unlock()
        Thread { [self] in
            context?.invalidate();try? core.cancel(request.session.inspection)
            condition.lock();request.cancelling-=1;condition.broadcast();condition.unlock()
        }.start()
    }
    func settle(_ permission: PinNativeOwnerPermission,delivery: PinReplyDelivery) throws {
        condition.lock();let request=permission.request
        let exact=permission.owner === self && active === request && request.permission === permission && request.finished
            && request.worker==0 && request.watcher==0 && request.cancelling==0 && request.events==0 && request.consuming==0 && request.cleanupFenced
            && !request.deliverySettled
        if exact && delivery == .known { request.deliveryCompleted=true };condition.unlock()
        guard exact else { throw PinKnownRefusal() };try core.settleReply(permission.reply,delivery:delivery)
    }
    func transferFence(_ request: PinNativeOwnerRequest,reply: PinNativeReply,delivery: PinReplyDelivery) -> Bool {
        condition.lock();defer { condition.unlock() }
        return active === request && request.owner === self && request.permission?.reply === reply && request.finished && request.cleanupFenced
            && request.worker==0 && request.watcher==0 && request.cancelling==0 && request.events==0 && request.consuming==0
            && !request.deliverySettled && (delivery == .uncertain || request.deliveryCompleted)
    }
    func transferSettled(_ request: PinNativeOwnerRequest,delivery: PinReplyDelivery) {
        condition.lock();defer { condition.unlock() };request.deliverySettled=true
        request.deliveryKnown=delivery == .known && !request.cancelled
        if !request.deliveryKnown { request.cancelled=true;request.permission?.consumed=true;request.permission?.close() };condition.broadcast()
    }
    func consume(_ permission: PinNativeOwnerPermission,session: OwnedPinSession,next: Data,checksum: String,revision: UInt64) throws {
        guard !Thread.isMainThread else { throw PinKnownRefusal() }
        condition.lock();let request=permission.request
        let exact=permission.owner === self && request.owner === self && active === request && request.permission === permission
            && request.session === session && !permission.consumed && request.finished && request.cleanupFenced && request.deliveryKnown
            && request.deliverySettled && !request.cancelled && request.worker==0 && request.watcher==0 && request.cancelling==0 && request.events==0 && request.consuming==0
        // Burn the original permission before any current/host/key/crypto call.
        if permission.owner === self && request.permission === permission { permission.consumed=true }
        if exact { request.consuming+=1;request.consumeThread=ObjectIdentifier(Thread.current) };condition.unlock()
        guard exact else { throw PinKnownRefusal() }
        defer { condition.lock();request.consuming-=1;request.consumeThread=nil;condition.broadcast();condition.unlock() }
        guard !next.isEmpty,next.count<=PlanetChildVault.maxBytes,NativePinSessions.hash(checksum),revision==request.nextRevision else { throw PinKnownRefusal() }
        var ownedNext=Data(Array(next));defer { ownedNext.resetBytes(in:0..<ownedNext.count) }
        try core.ownerMutationFence(request,next:ownedNext,checksum:checksum,revision:revision)
        try request.host?.current();try keys.current(permission.key);try verified(permission)
        try core.ownerMutationFence(request,next:ownedNext,checksum:checksum,revision:revision)
        let ns=try clock.nanoseconds();try core.ownerFinalStateFence(request);condition.lock();defer { condition.unlock() }
        guard active === request,!request.cancelled,request.deliveryKnown,request.events==0,ns>0,ns/1000000>=session.capturedUptimeMs,
            ns/1000000<session.deadlineUptimeMs,request.lastNs==nil || ns>=request.lastNs! else { throw PinKnownRefusal() }
        request.lastNs=ns
    }
    func verify(_ session: OwnedPinSession,next: Data,checksum: String,revision: UInt64,permission: AnyObject) throws {
        guard let original=permission as? PinNativeOwnerPermission else { throw PinKnownRefusal() }
        try consume(original,session:session,next:next,checksum:checksum,revision:revision)
    }
    func retire(_ request: PinNativeOwnerRequest) throws {
        guard !Thread.isMainThread else { throw PinKnownRefusal() }
        condition.lock();let exact=request.owner === self && active === request && request.workerThread != ObjectIdentifier(Thread.current)
            && request.consumeThread != ObjectIdentifier(Thread.current);condition.unlock()
        guard exact else { throw PinKnownRefusal() }
        condition.lock();request.retirementFenced=true;let observers=request.observers;request.observers.removeAll();condition.unlock()
        cancel(request)
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
        condition.lock()
        while request.worker != 0 || request.watcher != 0 || request.cancelling != 0 || request.events != 0 || request.consuming != 0
            || request.permission != nil && !request.deliverySettled { condition.wait() }
        request.close();active=nil;condition.broadcast();condition.unlock()
        // Core's original ownerAuthorization remains an identity tombstone for
        // this inspection. Only its original host closes the whole core request.
    }
}

#if DEBUG
/** Explicitly synthetic DEBUG-only fixture. Software SecKey signatures exercise
 * mechanics, never Secure Enclave/passcode/device or genuine authority acceptance.
 * It exposes scalar observations only; no original session/permission/key escapes. */
enum PlanetChildOwnerPermissionRuntimeScenario: String {
    case enroll, recover, malformedDigest, unsupportedReplace, ownedNext, replayAuthorize, earlyTransfer, directCoreTransfer
    case earlyConsume, expiryAfterSign, rollbackAfterSign, expiryAfterRecipient, cancellationDuringSign, missingRecoveryKey
    case signatureMismatch, persistedKeyChanged, recipientThrows, uncertainDelivery, consumeReplay, expiryAtConsume
    case changedStoredRecord, hostGenerationChanged, retireWaitsForActualSign, backgroundBeforeACK, backgroundAfterACK, foregroundCannotResurrect
}
struct PlanetChildOwnerPermissionRuntimeObservation {
    var registrationDenied=false, completionDenied=false, committed=false, earlyDenied=false, replayDenied=false
    var retireWaited=false, retired=false, signatureVerified=false, backgroundLatched=false, cleanupJoined=false
    var recipientCalls=0, signCalls=0, acquireCalls=0, transferCount=0
}
fileprivate extension NativePinOwnerPermissionProvider {
    func syntheticRequest(_ session: OwnedPinSession,next: Data,checksum: String,revision: UInt64) throws -> PinNativeOwnerRequest {
        guard synthetic,keys.source == .synthetic else { throw PlanetChildVault.Failure.unavailable }
        return try makeRequest(session,next:next,checksum:checksum,revision:revision,host:nil,locale:.en)
    }
    func fixtureJoin(_ request: PinNativeOwnerRequest) throws {
        condition.lock();defer { condition.unlock() };let bound=Date(timeIntervalSinceNow:5)
        while !request.finished || request.worker != 0 || request.watcher != 0 || request.cancelling != 0 {
            guard condition.wait(until:bound) else { throw PlanetChildVault.Failure.unavailable }
        }
    }
    func fixtureBackground(_ request: PinNativeOwnerRequest,foregroundReturn: Bool) {
        guard synthetic else { return }
        hostEvent(request,note:Notification(name:UIApplication.didEnterBackgroundNotification))
        if foregroundReturn { hostEvent(request,note:Notification(name:UIApplication.didBecomeActiveNotification)) }
    }
}
fileprivate extension NativePinSessions {
    func fixtureTransfers(_ inspection: OwnedPinInspection) -> Int { condition.lock();defer { condition.unlock() };return inspection.transfers }
}
enum PlanetChildOwnerPermissionRuntimeFixture {
    private final class Clock: PinPrimitiveClock {
        private let lock=NSLock();private var value: UInt64=110000000
        func nanoseconds() throws -> UInt64 { lock.lock();defer { lock.unlock() };return value }
        func set(_ value: UInt64) { lock.lock();self.value=value;lock.unlock() }
    }
    private final class IO: PinSessionIO,PinSessionTransaction {
        private let lock=NSLock();var bytes: Data
        init(_ bytes: Data) { self.bytes=Data(Array(bytes)) }
        func locked<T>(_ task: (PinSessionTransaction) throws -> T) throws -> T { lock.lock();defer { lock.unlock() };return try task(self) }
        func read() throws -> Data { Data(Array(bytes)) }
        func write(_ next: Data,boundary: () throws -> Void) throws { try boundary();bytes=Data(Array(next));try boundary() }
        func corrupt() { lock.lock();bytes=Data("changed stored record".utf8);lock.unlock() }
        func close() { lock.lock();bytes.resetBytes(in:0..<bytes.count);lock.unlock() }
    }
    private final class Authority: PinSessionAuthority,PinRecoveryAuthority {
        let clock: Clock;var generation: UInt64=1,provider: NativePinOwnerPermissionProvider?,permission: PinNativeOwnerPermission?
        var consumedOnce=false,replayDenied=false,askReplay=false
        init(_ clock: Clock) { self.clock=clock }
        func point(_ checksum: String,_ revision: UInt64) throws -> PinNativeCoordinates {
            let uptime=try clock.nanoseconds()/1000000
            guard uptime>=100 else { throw PinKnownRefusal() }
            return PinNativeCoordinates(owner:self,epoch:String(repeating:"b",count:64),bootId:"00000000-0000-4000-8000-000000000001",
                checksum:checksum,revision:revision,hostGeneration:generation,uptimeMs:uptime,logicalMs:1000+uptime-100)
        }
        func capture(_ inspection: OwnedPinInspection,bytes: Data,checksum: String,revision: UInt64) throws -> PinNativeCoordinates { try point(checksum,revision) }
        func current(_ session: OwnedPinSession,bytes: Data,checksum: String,revision: UInt64) throws -> PinNativeCoordinates { try point(checksum,revision) }
        func authorizeMutation(_ session: OwnedPinSession,next: Data,checksum: String,revision: UInt64) throws -> AnyObject {
            if session.inspection.action == .enroll {
                guard let provider,let permission else { throw PinKnownRefusal() }
                try provider.consume(permission,session:session,next:next,checksum:checksum,revision:revision);consumedOnce=true
                if askReplay { do { try provider.consume(permission,session:session,next:next,checksum:checksum,revision:revision) }
                    catch { replayDenied=true };guard replayDenied else { throw PlanetChildVault.Failure.unavailable } }
            }
            return NSObject()
        }
        func advance(_ session: OwnedPinSession,resetPermission: AnyObject,recoveryPermission: AnyObject?,nextChecksum: String,nextRevision: UInt64) throws {}
        func cancel(_ inspection: OwnedPinInspection) throws {}
        func retire(_ inspection: OwnedPinInspection) throws {}
        func verify(_ session: OwnedPinSession,next: Data,checksum: String,revision: UInt64,permission: AnyObject) throws {
            guard let provider else { throw PinKnownRefusal() };try provider.verify(session,next:next,checksum:checksum,revision:revision,permission:permission);consumedOnce=true
        }
    }
    private final class Keys: PinOwnerKeys {
        let source: PinOwnerKeySource = .synthetic
        let key: PinOwnerKey;var present=true,changed=false,badSignature=false,acquired=0,signed=0,onSign: (() -> Void)?
        init() throws {
            var error: Unmanaged<CFError>?
            guard let privateKey=SecKeyCreateRandomKey([kSecAttrKeyType:kSecAttrKeyTypeECSECPrimeRandom,kSecAttrKeySizeInBits:256] as CFDictionary,&error),
                let publicKey=SecKeyCopyPublicKey(privateKey),let bytes=SecKeyCopyExternalRepresentation(publicKey,&error) as Data?
            else { throw PlanetChildVault.Failure.unavailable }
            key=PinOwnerKey(privateKey:privateKey,publicKey:publicKey,publicBytes:bytes,source:.synthetic)
        }
        func acquire(enroll: Bool,context: LAContext,prompt: String) throws -> PinOwnerKey {
            acquired+=1;guard present || enroll else { throw PinKnownRefusal() };present=true;return key
        }
        func current(_ original: PinOwnerKey) throws { guard present,!changed,original === key else { throw PinKnownRefusal() } }
        func sign(_ original: PinOwnerKey,message: Data) throws -> Data {
            signed+=1;onSign?();var error: Unmanaged<CFError>?
            if badSignature { return Data(repeating:0,count:72) }
            guard let signature=SecKeyCreateSignature(original.privateKey,.ecdsaSignatureMessageX962SHA256,message as CFData,&error) as Data?
            else { throw PlanetChildVault.Failure.unavailable };return signature
        }
    }
    private static func digest(_ bytes: Data) -> String { SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() }
    private static func record(enrolled: Bool,next: Bool) -> Data {
        let version="synthetic-codec-v1",policy=String(repeating:"a",count:64)
        let registry=#"{"schemaVersion":1,"policyVersion":"\#(version)","activeProfileId":"synthetic-child","profiles":[{"id":"synthetic-child","label":"Synthetic Reader","exactAge":9,"ageBand":"9-11","locale":"en","ageConfirmedAt":"2026-10-01T12:00:00.000Z","readingLevel":null,"allowedTopics":null,"blockedTopics":["violence"],"soundEnabled":false,"motion":"calm","narrationEnabled":false}]}"#
        let pin: String
        if !enrolled && !next { pin="null" }
        else {
            let revision=next ? (enrolled ? 6:1):5,credential=String(repeating:next ? "e":"b",count:64),salt=String(repeating:next ? "f":"c",count:64)
            pin=#"{"schemaVersion":1,"policyVersion":"\#(version)","revision":\#(revision),"credentialId":"\#(credential)","verifier":{"algorithm":"PBKDF2-HMAC-SHA256","iterations":600000,"saltHex":"\#(salt)","hashHex":"\#(String(repeating:"d",count:64))"},"attempts":{"count":\#(next ? 0:2),"blockedUntilMs":\#(next ? 0:1050),"lastObservedMs":\#(next ? 1010:1000),"pendingAttemptId":null}}"#
        }
        return Data(#"{"schemaVersion":1,"revision":\#(next ? 8:7),"mode":"adult","selectionRevision":3,"profileRevision":2,"policyChecksum":"\#(policy)","registryChecksum":"\#(digest(Data(registry.utf8)))","registry":\#(registry),"pin":\#(pin),"clock":{"schemaVersion":1,"bootId":"00000000-0000-4000-8000-000000000001","uptimeAnchorMs":100,"logicalAnchorMs":1000,"epochAnchor":null}}"#.utf8)
    }
    static func run(_ scenario: PlanetChildOwnerPermissionRuntimeScenario) throws -> PlanetChildOwnerPermissionRuntimeObservation {
        var observed=PlanetChildOwnerPermissionRuntimeObservation()
        let recover=scenario == .recover || scenario == .missingRecoveryKey
        let action: PlanetChildVault.PinLifecycleAction=scenario == .unsupportedReplace ? .replace:(recover ? .recover:.enroll)
        let clock=Clock(),old=record(enrolled:recover || action == .replace,next:false),next=record(enrolled:recover || action == .replace,next:true)
        let io=IO(old),authority=Authority(clock),keys=try Keys()
        let policy=try PinSessionPolicy(version:"synthetic-codec-v1",checksum:String(repeating:"a",count:64),maximumIterations:600000,iterations:600000)
        let core=NativePinSessions(io:io,authority:authority,recovery:authority,policy:policy)
        let inspection=try core.inspection(wireId:String(repeating:"c",count:64),action:action,timeoutMs:60000)
        let opened=try core.begin(inspection);guard let session=opened.session else { throw PlanetChildVault.Failure.unavailable }
        try core.settleReply(opened,delivery:.known)
        let provider=try NativePinOwnerPermissionProvider(syntheticCore:core,keys:keys,clock:clock);authority.provider=provider
        var originalRequest: PinNativeOwnerRequest?
        func cleanup() throws {
            let cleaned=DispatchSemaphore(value:0),cleanupLock=NSLock();var cleanupFailed=false
            Thread {
                do {
                    if let originalRequest,scenario != .retireWaitsForActualSign { try provider.retire(originalRequest) }
                    let terminal=try core.retire(inspection);try core.settleReply(terminal,delivery:.known)
                } catch { cleanupLock.lock();cleanupFailed=true;cleanupLock.unlock() }
                authority.provider=nil;authority.permission=nil;io.close();cleaned.signal()
            }.start()
            guard cleaned.wait(timeout:.now()+5) == .success else { throw PlanetChildVault.Failure.unavailable }
            cleanupLock.lock();let failed=cleanupFailed;cleanupLock.unlock()
            guard !failed else { throw PlanetChildVault.Failure.unavailable };observed.cleanupJoined=true
        }
        var supplied=Data(Array(next));let pointer=UnsafeMutableRawPointer.allocate(byteCount:next.count,alignment:1)
        defer { pointer.initializeMemory(as:UInt8.self,repeating:0,count:next.count);pointer.deallocate() }
        next.copyBytes(to:pointer.assumingMemoryBound(to:UInt8.self),count:next.count)
        if scenario == .ownedNext { supplied=Data(bytesNoCopy:pointer,count:next.count,deallocator:.none) }
        let request: PinNativeOwnerRequest
        do { request=try provider.syntheticRequest(session,next:supplied,checksum:scenario == .malformedDigest ? String(repeating:"0",count:64):digest(next),revision:8) }
        catch { observed.registrationDenied=true;observed.acquireCalls=keys.acquired;observed.signCalls=keys.signed;try cleanup();return observed }
        originalRequest=request
        if scenario == .ownedNext { pointer.initializeMemory(as:UInt8.self,repeating:0,count:next.count) }
        if scenario == .missingRecoveryKey { keys.present=false }
        keys.badSignature=scenario == .signatureMismatch
        let signingStarted=DispatchSemaphore(value:0),releaseSign=DispatchSemaphore(value:0),retireStarted=DispatchSemaphore(value:0),retireFinished=DispatchSemaphore(value:0)
        let resultLock=NSLock();var proof: PinNativeOwnerPermission?,callbackFailure=false,callbackCalls=0,earlyDenied=false
        keys.onSign={
            if scenario == .expiryAfterSign { clock.set(session.deadlineUptimeMs*1000000) }
            if scenario == .rollbackAfterSign { clock.set(109000000) }
            if scenario == .hostGenerationChanged { authority.generation+=1 }
            if scenario == .persistedKeyChanged { keys.changed=true }
            if scenario == .cancellationDuringSign || scenario == .retireWaitsForActualSign {
                signingStarted.signal();_=releaseSign.wait(timeout:.now()+5)
            }
        }
        try provider.authorize(request) { result in
            resultLock.lock();callbackCalls+=1;resultLock.unlock()
            switch result {
            case .failure: resultLock.lock();callbackFailure=true;resultLock.unlock()
            case .success(let permission):
                resultLock.lock();proof=permission;resultLock.unlock()
                if scenario == .earlyTransfer || scenario == .directCoreTransfer {
                    do { if scenario == .directCoreTransfer { try core.settleReply(permission.reply,delivery:.known) }
                        else { try provider.settle(permission,delivery:.known) } }
                    catch { resultLock.lock();earlyDenied=true;resultLock.unlock() }
                }
                if scenario == .earlyConsume {
                    do { try provider.consume(permission,session:session,next:next,checksum:digest(next),revision:8) }
                    catch { resultLock.lock();earlyDenied=true;resultLock.unlock() }
                }
                if scenario == .expiryAfterRecipient { clock.set(session.deadlineUptimeMs*1000000) }
                if scenario == .recipientThrows { throw PinKnownRefusal() }
            }
        }
        if scenario == .replayAuthorize {
            do { try provider.authorize(request) { _ in } } catch { observed.replayDenied=true }
        }
        if scenario == .cancellationDuringSign || scenario == .retireWaitsForActualSign {
            guard signingStarted.wait(timeout:.now()+5) == .success else { throw PlanetChildVault.Failure.unavailable }
            if scenario == .cancellationDuringSign { provider.cancel(request) }
            else {
                Thread {
                    retireStarted.signal();do { try provider.retire(request) } catch {}
                    retireFinished.signal()
                }.start()
                guard retireStarted.wait(timeout:.now()+5) == .success else { throw PlanetChildVault.Failure.unavailable }
                // Sign is genuinely still blocked. Refusal must not release its
                // lane; observation is made outside the provider's callbacks.
                observed.retireWaited=retireFinished.wait(timeout:.now()+0.05) == .timedOut
            }
            releaseSign.signal()
        }
        try provider.fixtureJoin(request)
        resultLock.lock();let returnedProof=proof;observed.recipientCalls=callbackCalls;observed.earlyDenied=earlyDenied;observed.completionDenied=callbackFailure;resultLock.unlock()
        provider.condition.lock();observed.completionDenied=observed.completionDenied || request.cancelled;provider.condition.unlock()
        observed.signCalls=keys.signed;observed.acquireCalls=keys.acquired
        if scenario == .retireWaitsForActualSign {
            observed.retired=retireFinished.wait(timeout:.now()+5) == .success;observed.transferCount=core.fixtureTransfers(inspection);try cleanup();return observed
        }
        if let returnedProof {
            if scenario == .backgroundBeforeACK { provider.fixtureBackground(request,foregroundReturn:false);try provider.fixtureJoin(request) }
            try provider.settle(returnedProof,delivery:scenario == .uncertainDelivery ? .uncertain:.known)
            observed.signatureVerified = !observed.completionDenied && scenario != .signatureMismatch
            authority.permission=returnedProof;authority.askReplay=scenario == .consumeReplay
            if scenario == .backgroundAfterACK || scenario == .foregroundCannotResurrect {
                provider.fixtureBackground(request,foregroundReturn:scenario == .foregroundCannotResurrect);try provider.fixtureJoin(request)
            }
            provider.condition.lock();observed.backgroundLatched=request.cancelled;provider.condition.unlock()
            if scenario == .expiryAtConsume { clock.set(session.deadlineUptimeMs*1000000) }
            if scenario == .changedStoredRecord { io.corrupt() }
            let committed=DispatchSemaphore(value:0);var didCommit=false
            Thread {
                defer { committed.signal() }
                do {
                    let reply=try core.commit(inspection,session:session,expected:old,next:next,expectedChecksum:digest(old),nextChecksum:digest(next),
                        expectedRevision:7,nextRevision:8,nativeEpoch:session.epoch,hostGeneration:session.hostGeneration,bootId:session.bootId,
                        deadlineUptimeMs:session.deadlineUptimeMs,recoveryPermission:recover ? returnedProof:nil)
                    try core.settleReply(reply,delivery:.known);resultLock.lock();didCommit=true;resultLock.unlock()
                } catch {}
            }.start()
            guard committed.wait(timeout:.now()+5) == .success else { throw PlanetChildVault.Failure.unavailable }
            resultLock.lock();observed.committed=didCommit;resultLock.unlock();observed.replayDenied=observed.replayDenied || authority.replayDenied
        }
        observed.transferCount=core.fixtureTransfers(inspection)
        try cleanup();return observed
    }
}
#endif

// Explicit local first-install V2 prerequisite. V1 factories/clock/storage stay
// unchanged and unavailable. This add-only seed is not nonrollback authority,
// trusted epoch/boot time, guardian status, AES-data provisioning or App admission.
extension PlanetChildVault {
    struct LocalEmptySeedV2 {
        static func canonicalBytes(policyVersion: String, policyChecksum: String) throws -> Data {
            guard policyVersion.range(of:"\\A[A-Za-z0-9][A-Za-z0-9._-]{0,95}\\z",options:.regularExpression) != nil,
                NativePinSessions.hash(policyChecksum) else { throw Failure.unavailable }
            let registry=Data("{\"schemaVersion\":1,\"policyVersion\":\"\(policyVersion)\",\"activeProfileId\":null,\"profiles\":[]}".utf8)
            let registryHash=PlanetChildVault.digest(registry)
            return Data(("{\"schemaVersion\":2,\"revision\":1,\"mode\":\"adult\",\"selectionRevision\":1,\"profileRevision\":1,\"policyChecksum\":\"\(policyChecksum)\",\"registryChecksum\":\"\(registryHash)\",\"registry\":"
                + String(decoding:registry,as:UTF8.self) + ",\"pin\":null,\"clock\":{\"schemaVersion\":2,\"logicalMs\":0}}").utf8)
        }
        static func validate(_ input: Data, policyVersion: String, policyChecksum: String) throws -> String {
            guard !input.isEmpty,input.count<=PlanetChildVault.maxBytes else { throw Failure.unavailable }
            var owned=Data(Array(input)),canonical=try canonicalBytes(policyVersion:policyVersion,policyChecksum:policyChecksum)
            defer { owned.resetBytes(in:0..<owned.count);canonical.resetBytes(in:0..<canonical.count) }
            guard owned==canonical else { throw Failure.unavailable };return PlanetChildVault.digest(owned)
        }
    }
    fileprivate final class FirstInstallStoreV2: PinFirstInstallStoreV2, PinFirstInstallTransactionV2 {
        private let vault: PlanetChildVault
        init(_ vault: PlanetChildVault) { self.vault=vault }
        private func query() -> [String:Any] {
            [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"ru.probpera.literaryplanet.literary-planet-child-vault-v2",
             kSecAttrAccount as String:"child-full-record-v2",kSecAttrSynchronizable as String:false]
        }
        private func absent(_ query: [String:Any]) throws {
            var all=query;all[kSecAttrSynchronizable as String]=kSecAttrSynchronizableAny
            all[kSecUseAuthenticationUI as String]=kSecUseAuthenticationUIFail
            guard SecItemCopyMatching(all as CFDictionary,nil)==errSecItemNotFound else { throw Failure.unavailable }
        }
        func requireAbsent() throws {
            try absent(vault.query());try absent(query())
            try absent([kSecClass as String:kSecClassGenericPassword,
                kSecAttrService as String:"ru.probpera.literaryplanet.literary-planet-child-data-v1",kSecAttrAccount as String:"child-data-aes-v1"])
            // lstat distinguishes genuine absence from locked/unreadable state;
            // the entire old data directory is a footprint, even an empty one.
            let parent=try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:false).resolvingSymlinksInPath().standardizedFileURL
            let data=parent.appendingPathComponent("literary-planet-child-data-v1",isDirectory:true)
            guard parent.resolvingSymlinksInPath().standardizedFileURL==parent.standardizedFileURL else { throw Failure.unavailable }
            var named=stat();guard lstat(data.path,&named) != 0,errno==ENOENT else { throw Failure.unavailable }
        }
        func locked<T>(_ work: (PinFirstInstallTransactionV2) throws -> T) throws -> T { try vault.locked { try work(self) } }
        func create(_ seed: Data,boundary: () throws -> Void) throws {
            try requireAbsent();try boundary()
            var item=query();item[kSecValueData as String]=seed;item[kSecAttrAccessible as String]=kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            // No update/delete/reset/retry. Any ambiguous/late add leaves its item
            // sealed; the next explicit request observes that footprint and denies.
            guard SecItemAdd(item as CFDictionary,nil)==errSecSuccess else { throw Failure.unavailable }
            var read=query();read[kSecReturnData as String]=true;read[kSecReturnAttributes as String]=true;read[kSecMatchLimit as String]=kSecMatchLimitOne
            var result: CFTypeRef?
            guard SecItemCopyMatching(read as CFDictionary,&result)==errSecSuccess,let actual=result as? [String:Any],
                var bytes=actual[kSecValueData as String] as? Data,
                actual[kSecAttrAccessible as String] as? String == kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String
                else { throw Failure.unavailable }
            defer { bytes.resetBytes(in:0..<bytes.count) };guard bytes==seed else { throw Failure.unavailable };try boundary()
            // OS add acknowledgement + exact readback only, not a power-loss or
            // nonrollback checkpoint guarantee. Durable receipt has this scope.
        }
    }
}
fileprivate protocol PinFirstInstallTransactionV2: AnyObject {
    func requireAbsent() throws
    func create(_ seed: Data,boundary: () throws -> Void) throws
}
fileprivate protocol PinFirstInstallStoreV2: AnyObject {
    func locked<T>(_ work: (PinFirstInstallTransactionV2) throws -> T) throws -> T
}
fileprivate extension ApplePinOwnerKeys {
    func firstInstallAcquire(context: LAContext,prompt: String) throws -> PinOwnerKey {
        func loadWithoutPrompt() throws -> PinOwnerKey? {
            // Attaching the fresh context preserves the actual subsequent sign
            // prompt. Key lookup under the native IO lock itself must never show UI.
            let query: [CFString:Any]=[kSecClass:kSecClassKey,kSecAttrApplicationTag:tag,kSecAttrKeyType:kSecAttrKeyTypeECSECPrimeRandom,
                kSecAttrKeyClass:kSecAttrKeyClassPrivate,kSecReturnRef:true,kSecReturnAttributes:true,kSecMatchLimit:kSecMatchLimitOne,
                kSecUseAuthenticationContext:context,kSecUseOperationPrompt:prompt]
            var result: CFTypeRef?;let status=SecItemCopyMatching(query as CFDictionary,&result)
            if status==errSecItemNotFound { return nil }
            guard status==errSecSuccess,let item=result as? [String:Any],let ref=item[kSecValueRef as String],
                CFGetTypeID(ref as CFTypeRef)==SecKeyGetTypeID(),let acl=item[kSecAttrAccessControl as String],
                CFGetTypeID(acl as CFTypeRef)==SecAccessControlGetTypeID(),CFEqual(acl as CFTypeRef,try access()),
                item[kSecAttrAccessible as String] as? String == kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly as String
                else { throw PlanetChildVault.Failure.unavailable }
            let key=ref as! SecKey
            guard let attributes=SecKeyCopyAttributes(key) as? [String:Any],
                attributes[kSecAttrTokenID as String] as? String == kSecAttrTokenIDSecureEnclave as String,
                attributes[kSecAttrKeyType as String] as? String == kSecAttrKeyTypeECSECPrimeRandom as String,
                (attributes[kSecAttrKeySizeInBits as String] as? NSNumber)?.intValue==256,
                let publicKey=SecKeyCopyPublicKey(key),SecKeyIsAlgorithmSupported(key,.sign,.ecdsaSignatureMessageX962SHA256),
                SecKeyIsAlgorithmSupported(publicKey,.verify,.ecdsaSignatureMessageX962SHA256) else { throw PlanetChildVault.Failure.unavailable }
            var error: Unmanaged<CFError>?
            guard let bytes=SecKeyCopyExternalRepresentation(publicKey,&error) as Data?,bytes.count==65 else { throw PlanetChildVault.Failure.unavailable }
            return PinOwnerKey(privateKey:key,publicKey:publicKey,publicBytes:bytes,source:source)
        }
        if let key=try loadWithoutPrompt() { return key }
        var error: Unmanaged<CFError>?
        let attributes: [CFString:Any]=[kSecAttrKeyType:kSecAttrKeyTypeECSECPrimeRandom,kSecAttrKeySizeInBits:256,
            kSecAttrTokenID:kSecAttrTokenIDSecureEnclave,kSecPrivateKeyAttrs:[kSecAttrIsPermanent:true,kSecAttrApplicationTag:tag,
                kSecAttrAccessControl:try access(),kSecAttrIsExtractable:false]]
        guard let created=SecKeyCreateRandomKey(attributes as CFDictionary,&error),let publicKey=SecKeyCopyPublicKey(created),
            let bytes=SecKeyCopyExternalRepresentation(publicKey,&error) as Data?,let key=try loadWithoutPrompt(),key.publicBytes==bytes
            else { throw PlanetChildVault.Failure.unavailable };return key
    }
}
fileprivate final class AppleFirstInstallOwnerKeysV2: PinOwnerKeys {
    let source: PinOwnerKeySource = .secureEnclave
    private let keys=ApplePinOwnerKeys()
    private func alias() throws {
        // The alias probe deliberately does not narrow algorithm/key class. A
        // conflicting public/RSA/duplicate item must not look like missing P256.
        let query: [CFString:Any]=[kSecClass:kSecClassKey,kSecAttrApplicationTag:Data("ru.probpera.literaryplanet.child.pin.owner.passcode.v1".utf8),
            kSecReturnAttributes:true,kSecMatchLimit:kSecMatchLimitAll,kSecAttrSynchronizable:kSecAttrSynchronizableAny,kSecUseAuthenticationUI:kSecUseAuthenticationUIFail]
        var result: CFTypeRef?;let status=SecItemCopyMatching(query as CFDictionary,&result)
        if status==errSecItemNotFound { return }
        guard status==errSecSuccess,let rows=result as? [[String:Any]],rows.count==1,
            rows[0][kSecAttrKeyType as String] as? String == kSecAttrKeyTypeECSECPrimeRandom as String,
            rows[0][kSecAttrKeyClass as String] as? String == kSecAttrKeyClassPrivate as String else { throw PlanetChildVault.Failure.unavailable }
    }
    func acquire(enroll: Bool,context: LAContext,prompt: String) throws -> PinOwnerKey {
        guard enroll else { throw PinKnownRefusal() };try alias();let original=try keys.firstInstallAcquire(context:context,prompt:prompt)
        try alias();try keys.current(original);return original
    }
    func current(_ original: PinOwnerKey) throws { try alias();try keys.current(original) }
    func sign(_ original: PinOwnerKey,message: Data) throws -> Data { try alias();return try keys.sign(original,message:message) }
}
fileprivate final class OriginalFirstInstallV2 {
    let owner: NativeChildFirstInstallV2,wireId: String,seed: PinOwnedBytes,checksum: String,policy: PinSessionPolicy
    let host: PinOwnerOriginalHost?,hostScope: String,generation: UInt64,locale: PinNativeInputLocale,nonce: Data
    let capturedNs: UInt64,deadlineNs: UInt64
    var started=false,cancelled=false,finished=false,cleanupFenced=false,retirementFenced=false,retired=false,spent=false,prompting=false
    var worker=0,watcher=0,cancelling=0,events=0,provisioning=0,settling=0,cleanup=0,stopWatch=false
    var workerThread: ObjectIdentifier?,provisionThread: ObjectIdentifier?,settleThread: ObjectIdentifier?,context: LAContext?,lastNs: UInt64
    var proof: FirstInstallOwnerProofV2?,receipt: FirstInstallSeedReceiptV2?,observers=[NSObjectProtocol]()
    var proofSettled=false,proofKnown=false,receiptSettled=false,receiptKnown=false
    #if DEBUG
    var syntheticCleanup: (() -> Void)?
    #endif
    init(owner: NativeChildFirstInstallV2,wireId: String,seed: Data,checksum: String,policy: PinSessionPolicy,host: PinOwnerOriginalHost?,hostScope: String,
         generation: UInt64,locale: PinNativeInputLocale,nonce: Data,capturedNs: UInt64,deadlineNs: UInt64) {
        self.owner=owner;self.wireId=wireId;self.seed=PinOwnedBytes(seed);self.checksum=checksum;self.policy=policy;self.host=host;self.hostScope=hostScope
        self.generation=generation;self.locale=locale;self.nonce=Data(Array(nonce));self.capturedNs=capturedNs;self.deadlineNs=deadlineNs;lastNs=capturedNs
    }
    func close() { seed.close();proof?.close();proof=nil;receipt=nil } // After actual joins; break owned backing cycles.
    deinit { close() }
}
fileprivate final class FirstInstallOwnerProofV2 {
    let owner: NativeChildFirstInstallV2,request: OriginalFirstInstallV2,key: PinOwnerKey,message: PinOwnedBytes,signature: PinOwnedBytes
    init(owner: NativeChildFirstInstallV2,request: OriginalFirstInstallV2,key: PinOwnerKey,message: Data,signature: Data) {
        self.owner=owner;self.request=request;self.key=key;self.message=PinOwnedBytes(message);self.signature=PinOwnedBytes(signature)
    }
    func close() { message.close();signature.close() }
    deinit { close() }
}
fileprivate final class FirstInstallSeedReceiptV2 {
    let owner: NativeChildFirstInstallV2,request: OriginalFirstInstallV2,checksum: String
    init(owner: NativeChildFirstInstallV2,request: OriginalFirstInstallV2) { self.owner=owner;self.request=request;checksum=request.checksum }
}
/** No public constructor/wire/factory. Only the actual original native host can
 * settle the exact backing objects. Callback return, LA success or a JS boolean
 * cannot mark delivery known. A timeout revokes; it never releases actual work. */
fileprivate final class NativeChildFirstInstallV2 {
    private let condition=NSCondition(),store: PinFirstInstallStoreV2,keys: PinOwnerKeys,clock: PinPrimitiveClock,policy: PinSessionPolicy,synthetic: Bool
    private var active: OriginalFirstInstallV2?,usedIds=Set<String>(),generation: UInt64=0
    init(vault: PlanetChildVault,policy: PinSessionPolicy) {
        store=PlanetChildVault.FirstInstallStoreV2(vault);keys=AppleFirstInstallOwnerKeysV2();clock=ApplePinPrimitiveClock();self.policy=policy;synthetic=false
    }
    #if DEBUG
    fileprivate init(store: PinFirstInstallStoreV2,keys: PinOwnerKeys,clock: PinPrimitiveClock,policy: PinSessionPolicy) throws {
        guard keys.source == .synthetic else { throw PlanetChildVault.Failure.unavailable };self.store=store;self.keys=keys;self.clock=clock;self.policy=policy;synthetic=true
    }
    #endif
    private static func digest(_ bytes: Data) -> String { SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() }
    func request(wireId: String,host: UIViewController,locale: PinNativeInputLocale,timeoutMs: UInt64) throws -> OriginalFirstInstallV2 {
        guard !synthetic else { throw PinKnownRefusal() }
        let captured=try clock.nanoseconds() // Before any external host/storage call.
        return try makeRequest(wireId:wireId,host:PinOwnerOriginalHost(host),hostScope:String(describing:ObjectIdentifier(host)),locale:locale,timeoutMs:timeoutMs,captured:captured)
    }
    private func makeRequest(wireId: String,host: PinOwnerOriginalHost?,hostScope: String,locale: PinNativeInputLocale,timeoutMs: UInt64,captured: UInt64) throws -> OriginalFirstInstallV2 {
        guard NativePinSessions.hash(wireId),timeoutMs>=1,timeoutMs<=60000,captured>0,
            captured<=UInt64.max-timeoutMs*1000000 else { throw PinKnownRefusal() }
        var seed=try PlanetChildVault.LocalEmptySeedV2.canonicalBytes(policyVersion:policy.version,policyChecksum:policy.checksum)
        defer { seed.resetBytes(in:0..<seed.count) }
        let checksum=try PlanetChildVault.LocalEmptySeedV2.validate(seed,policyVersion:policy.version,policyChecksum:policy.checksum)
        var nonce=Data(count:32);defer { nonce.resetBytes(in:0..<nonce.count) }
        guard nonce.withUnsafeMutableBytes({ SecRandomCopyBytes(kSecRandomDefault,$0.count,$0.baseAddress!) })==errSecSuccess else { throw PlanetChildVault.Failure.unavailable }
        condition.lock()
        guard active==nil,usedIds.count<2048,generation<9007199254740991,usedIds.insert(wireId).inserted else { condition.unlock();throw PinKnownRefusal() }
        generation+=1;let request=OriginalFirstInstallV2(owner:self,wireId:wireId,seed:seed,checksum:checksum,policy:policy,host:host,hostScope:hostScope,
            generation:generation,locale:locale,nonce:nonce,capturedNs:captured,deadlineNs:captured+timeoutMs*1000000)
        active=request;condition.unlock()
        do {
            if host != nil {
                for name in [UIApplication.didEnterBackgroundNotification,UIApplication.willResignActiveNotification,UIScene.didDisconnectNotification] {
                    let observer=NotificationCenter.default.addObserver(forName:name,object:nil,queue:.main) { [weak self,weak request] note in
                        guard let self,let request else { return };self.hostEvent(request,note:note)
                    };condition.lock();request.observers.append(observer);condition.unlock()
                }
            }
            try fence(request);try store.locked { try $0.requireAbsent();try localFence(request) };try fence(request);return request
        } catch { discardUnstarted(request);throw error }
    }
    private func discardUnstarted(_ request: OriginalFirstInstallV2) {
        // Failed registration started no SDK/worker/transfer. Main can remove its
        // own observers directly; it must never wait for a main-bound worker.
        condition.lock();request.cancelled=true;request.retirementFenced=true;request.cleanup=1
        let observers=request.observers;request.observers=[];condition.unlock()
        let remove={ for observer in observers { NotificationCenter.default.removeObserver(observer) } }
        if Thread.isMainThread { remove() } else if !observers.isEmpty { DispatchQueue.main.sync(execute:remove) }
        condition.lock();while request.events != 0 || request.cancelling != 0 { condition.wait() }
        request.cleanup=0;request.retired=true;request.close();if active === request { active=nil };condition.broadcast();condition.unlock()
    }
    private func fence(_ request: OriginalFirstInstallV2,allowSpent: Bool=false) throws {
        try request.host?.current();try localFence(request,allowSpent:allowSpent)
    }
    private func localFence(_ request: OriginalFirstInstallV2,allowSpent: Bool=false) throws {
        // Safe under durable IO lock: no UIKit/main dispatch, recipient or prompt.
        // The last clock callback is followed only by owned-state comparisons.
        let now=try clock.nanoseconds()
        condition.lock();defer { condition.unlock() }
        guard active === request,request.owner === self,!request.cancelled,!request.retirementFenced,!request.retired,
            allowSpent || !request.spent,now>=request.capturedNs,now>=request.lastNs,now<request.deadlineNs else { throw PinKnownRefusal() }
        request.lastNs=now // Final clock callback followed by callback-free identity fence.
    }
    private func hostEvent(_ request: OriginalFirstInstallV2,note: Notification) {
        condition.lock();let live=active === request && !request.retired,ownedPrompt=request.prompting;if live { request.events+=1 };condition.unlock();guard live else { return }
        defer { condition.lock();request.events-=1;condition.broadcast();condition.unlock() }
        if note.name == UIApplication.didEnterBackgroundNotification || request.host?.disconnected(note)==true
            || note.name == UIApplication.willResignActiveNotification && !ownedPrompt { cancel(request) }
    }
    private func message(_ request: OriginalFirstInstallV2,key: PinOwnerKey) -> Data {
        let fields=["literary-planet/local-first-install/v2","first-install-v2",request.wireId,request.checksum,"2","1","adult","1","1",
            request.policy.version,request.policy.checksum,request.hostScope,String(request.generation),String(request.capturedNs),String(request.deadlineNs),
            request.locale == .ru ? "ru":"en",request.nonce.map { String(format:"%02x",$0) }.joined(),Self.digest(key.publicBytes),synthetic ? "synthetic":"secure-enclave"]
        return Data(fields.map { "\($0.utf8.count):\($0)" }.joined().utf8)
    }
    private func verify(_ proof: FirstInstallOwnerProofV2) throws {
        var bytes=try proof.message.copy(),signature=try proof.signature.copy();defer { bytes.resetBytes(in:0..<bytes.count);signature.resetBytes(in:0..<signature.count) }
        guard bytes.count<=4096,bytes==message(proof.request,key:proof.key),proof.key.source==keys.source else { throw PinKnownRefusal() }
        var error: Unmanaged<CFError>?
        guard SecKeyVerifySignature(proof.key.publicKey,.ecdsaSignatureMessageX962SHA256,bytes as CFData,signature as CFData,&error) else { throw PinKnownRefusal() }
    }
    func authorize(_ request: OriginalFirstInstallV2,recipient: @escaping (Result<FirstInstallOwnerProofV2,Error>) throws -> Void) throws {
        condition.lock();guard active === request,request.owner === self,!request.started,!request.cancelled,!request.retirementFenced,!request.retired else { condition.unlock();throw PinKnownRefusal() }
        request.started=true;request.worker=1;condition.unlock();Thread { [self] in run(request,recipient:recipient) }.start()
    }
    private func watch(_ request: OriginalFirstInstallV2) {
        condition.lock();request.watcher=1;condition.unlock()
        Thread { [self] in
            defer { condition.lock();request.watcher=0;condition.broadcast();condition.unlock() }
            while true {
                condition.lock();let stop=request.stopWatch || request.cancelled
                if !stop { _=condition.wait(until:Date(timeIntervalSinceNow:0.05)) };condition.unlock();if stop { return }
                do { try localFence(request) } catch { cancel(request);return }
            }
        }.start()
    }
    private func run(_ request: OriginalFirstInstallV2,recipient: (Result<FirstInstallOwnerProofV2,Error>) throws -> Void) {
        condition.lock();request.workerThread=ObjectIdentifier(Thread.current);condition.unlock()
        var failure: Error?,delivered=false,successEntered=false
        do {
            try fence(request);let context=LAContext();context.touchIDAuthenticationAllowableReuseDuration=0;context.interactionNotAllowed=true
            let ru=request.locale == .ru,prompt=(ru ? "Подтвердите создание родительского PIN":"Confirm Parent PIN setup")+"\n"
                +(ru ? "Подтвердите действие кодом блокировки устройства.":"Use your device screen lock to confirm this action.")
            condition.lock();request.context=context;condition.unlock();watch(request)
            let key=try store.locked { transaction in
                try transaction.requireAbsent();try localFence(request)
                let original=try keys.acquire(enroll:true,context:context,prompt:prompt)
                try transaction.requireAbsent();try localFence(request);return original
            }
            // The same fresh context permits its first real passcode interaction
            // only after the IO lock is released; no cached owner boolean exists.
            context.interactionNotAllowed=false
            try fence(request);let bytes=message(request,key:key);guard bytes.count<=4096 else { throw PinKnownRefusal() }
            let signature=try sign(request,key:key,bytes:bytes);try keys.current(key);try fence(request)
            let proof=FirstInstallOwnerProofV2(owner:self,request:request,key:key,message:bytes,signature:signature);try verify(proof)
            condition.lock();request.proof=proof;condition.unlock();try fence(request)
            delivered=true;successEntered=true;try recipient(.success(proof));try keys.current(key);try fence(request)
        } catch { failure=error }
        if !delivered { do { delivered=true;try recipient(.failure(failure ?? PinKnownRefusal())) } catch { failure=error } }
        condition.lock();request.stopWatch=true;let context=request.context;condition.broadcast();condition.unlock();context?.invalidate()
        condition.lock();while request.watcher != 0 || request.cancelling != 0 || request.events != 0 { condition.wait() };condition.unlock()
        if failure==nil { do { try fence(request) } catch { failure=error } }
        condition.lock();request.context=nil;request.cleanupFenced=true;request.worker=0;request.finished=true
        if failure != nil { request.cancelled=true;request.proof?.close() }
        if request.proof != nil && !successEntered { request.proofSettled=true;request.proofKnown=false }
        condition.broadcast();condition.unlock()
    }
    private func sign(_ request: OriginalFirstInstallV2,key: PinOwnerKey,bytes: Data) throws -> Data {
        condition.lock();guard active === request,!request.cancelled,!request.retirementFenced else { condition.unlock();throw PinKnownRefusal() }
        request.prompting=true;condition.unlock()
        defer { condition.lock();request.prompting=false;condition.broadcast();condition.unlock() }
        // Only the actual original SecKey private operation owns this temporary
        // inactive window. Background/disconnect always revoke. No SDK callback
        // boolean or prompt-availability test can substitute for its signature.
        return try keys.sign(key,message:bytes)
    }
    func settle(_ proof: FirstInstallOwnerProofV2,delivery: PinReplyDelivery) throws {
        let request=proof.request
        condition.lock();let exact=proof.owner === self && active === request && request.proof === proof && request.finished && request.cleanupFenced
            && request.worker==0 && request.watcher==0 && request.cancelling==0 && request.events==0 && request.provisioning==0 && request.settling==0 && !request.proofSettled
        if exact { request.settling=1;request.settleThread=ObjectIdentifier(Thread.current) }
        condition.unlock();guard exact else { throw PinKnownRefusal() }
        defer { condition.lock();request.settling=0;request.settleThread=nil;condition.broadcast();condition.unlock() }
        if delivery == .known { do { try verify(proof);try keys.current(proof.key);try fence(request) } catch { cancel(request);throw error } }
        condition.lock();defer { condition.unlock() }
        guard active === request,!request.proofSettled,request.proof === proof,request.worker==0,request.cancelling==0,request.events==0,request.provisioning==0,
            request.settling==1,request.settleThread==ObjectIdentifier(Thread.current),
            delivery != .known || !request.cancelled && !request.retirementFenced && !request.spent else { throw PinKnownRefusal() }
        request.proofSettled=true;request.proofKnown=delivery == .known && !request.cancelled
        if !request.proofKnown { request.cancelled=true;proof.close() };condition.broadcast()
    }
    func provision(_ proof: FirstInstallOwnerProofV2) throws -> FirstInstallSeedReceiptV2 {
        guard !Thread.isMainThread else { throw PinKnownRefusal() };let request=proof.request
        condition.lock();let exact=proof.owner === self && active === request && request.proof === proof && request.proofKnown && request.proofSettled
            && request.finished && request.cleanupFenced && !request.spent && !request.cancelled && request.provisioning==0 && request.settling==0
        if exact { request.spent=true;request.provisioning=1;request.provisionThread=ObjectIdentifier(Thread.current) };condition.unlock()
        guard exact else { throw PinKnownRefusal() }
        defer { condition.lock();request.provisioning=0;request.provisionThread=nil;condition.broadcast();condition.unlock() }
        do {
            try verify(proof);try keys.current(proof.key);try fence(request,allowSpent:true)
            var seed=try request.seed.copy();defer { seed.resetBytes(in:0..<seed.count) }
            guard try PlanetChildVault.LocalEmptySeedV2.validate(seed,policyVersion:policy.version,policyChecksum:policy.checksum)==request.checksum else { throw PinKnownRefusal() }
            try store.locked { transaction in
                try transaction.requireAbsent();try localFence(request,allowSpent:true)
                try transaction.create(seed) { try verify(proof);try keys.current(proof.key);try localFence(request,allowSpent:true) }
                try localFence(request,allowSpent:true)
            }
            try keys.current(proof.key);try fence(request,allowSpent:true)
            condition.lock();defer { condition.unlock() };guard active === request,!request.cancelled,!request.retirementFenced else { throw PinKnownRefusal() }
            let receipt=FirstInstallSeedReceiptV2(owner:self,request:request);request.receipt=receipt;return receipt
        } catch { cancel(request);throw error }
    }
    func settle(_ receipt: FirstInstallSeedReceiptV2,delivery: PinReplyDelivery) throws {
        let request=receipt.request
        condition.lock();let exact=receipt.owner === self && active === request && request.receipt === receipt && request.provisioning==0
            && request.worker==0 && request.cancelling==0 && request.events==0 && request.settling==0 && !request.receiptSettled
        if exact { request.settling=1;request.settleThread=ObjectIdentifier(Thread.current) };condition.unlock();guard exact else { throw PinKnownRefusal() }
        defer { condition.lock();request.settling=0;request.settleThread=nil;condition.broadcast();condition.unlock() }
        if delivery == .known { do { try fence(request,allowSpent:true) } catch { cancel(request);throw error } }
        condition.lock();defer { condition.unlock() };guard active === request,!request.receiptSettled,request.receipt === receipt,
            request.provisioning==0,request.cancelling==0,request.events==0,
            request.settling==1,request.settleThread==ObjectIdentifier(Thread.current),
            delivery != .known || !request.cancelled && !request.retirementFenced else { throw PinKnownRefusal() }
        request.receiptSettled=true;request.receiptKnown=delivery == .known && !request.cancelled;condition.broadcast()
    }
    func cancel(_ request: OriginalFirstInstallV2) {
        condition.lock();guard active === request,request.owner === self,!request.cancelled else { condition.unlock();return }
        request.cancelled=true;request.cancelling+=1;let context=request.context;condition.broadcast();condition.unlock()
        Thread { [self] in context?.invalidate();condition.lock();request.cancelling-=1;condition.broadcast();condition.unlock() }.start()
    }
    func retire(_ request: OriginalFirstInstallV2) throws {
        guard !Thread.isMainThread else { throw PinKnownRefusal() }
        condition.lock();guard active === request,request.owner === self,!request.retirementFenced,!request.retired,
            (request.worker==0 || request.workerThread != ObjectIdentifier(Thread.current)),
            (request.provisioning==0 || request.provisionThread != ObjectIdentifier(Thread.current)),
            (request.settling==0 || request.settleThread != ObjectIdentifier(Thread.current))
            else { condition.unlock();throw PinKnownRefusal() }
        request.retirementFenced=true;condition.broadcast();condition.unlock();cancel(request)
        condition.lock()
        while request.worker != 0 || request.watcher != 0 || request.cancelling != 0 || request.events != 0 || request.provisioning != 0 || request.settling != 0
            || request.proof != nil && !request.proofSettled || request.receipt != nil && !request.receiptSettled { condition.wait() }
        request.cleanup=1;let observers=request.observers;request.observers=[];condition.unlock()
        #if DEBUG
        condition.lock();let heldCleanup=request.syntheticCleanup;request.syntheticCleanup=nil;condition.unlock()
        heldCleanup?() // Actual counted invocation; no synthetic authority/admission.
        #endif
        let remove={ for observer in observers { NotificationCenter.default.removeObserver(observer) } }
        if !observers.isEmpty { DispatchQueue.main.sync(execute:remove) }
        condition.lock();while request.events != 0 || request.cancelling != 0 { condition.wait() }
        request.cleanup=0;request.retired=true;request.close();if active === request { active=nil };condition.broadcast();condition.unlock()
    }
    #if DEBUG
    fileprivate func syntheticRequest(wireId: String,timeoutMs: UInt64=1000) throws -> OriginalFirstInstallV2 {
        guard synthetic else { throw PinKnownRefusal() };return try makeRequest(wireId:wireId,host:nil,hostScope:"synthetic",locale:.en,timeoutMs:timeoutMs,captured:clock.nanoseconds())
    }
    fileprivate func awaitFinished(_ request: OriginalFirstInstallV2) { condition.lock();while request.worker != 0 || request.cancelling != 0 { condition.wait() };condition.unlock() }
    fileprivate func syntheticBackground(_ request: OriginalFirstInstallV2) { guard synthetic else { return };hostEvent(request,note:Notification(name:UIApplication.didEnterBackgroundNotification)) }
    fileprivate func syntheticInactive(_ request: OriginalFirstInstallV2) { guard synthetic else { return };hostEvent(request,note:Notification(name:UIApplication.willResignActiveNotification)) }
    fileprivate func syntheticCleanup(_ request: OriginalFirstInstallV2,_ work: @escaping () -> Void) throws {
        condition.lock();defer { condition.unlock() }
        guard synthetic,active === request,!request.started,!request.retirementFenced,!request.retired else { throw PinKnownRefusal() }
        request.syntheticCleanup=work
    }
    fileprivate func awaitRetirementFence(_ request: OriginalFirstInstallV2) -> Bool {
        condition.lock();defer { condition.unlock() };let until=Date(timeIntervalSinceNow:2)
        while !request.retirementFenced && !request.retired { if !condition.wait(until:until) { return false } };return request.retirementFenced
    }
    fileprivate func fixtureState(_ request: OriginalFirstInstallV2?) -> (joined:Bool,retired:Bool,proofPending:Bool,receiptPending:Bool,workers:Int) {
        condition.lock();defer { condition.unlock() };guard let request else { return (active==nil,true,false,false,0) }
        return (request.worker==0 && request.watcher==0 && request.cancelling==0 && request.events==0 && request.provisioning==0 && request.settling==0 && request.cleanup==0,
            request.retired,request.proof != nil && !request.proofSettled,request.receipt != nil && !request.receiptSettled,request.worker+request.provisioning+request.settling)
    }
    #endif
}

#if DEBUG
/** Only synthetic scalar observations escape. Actual software SecKey signing
 * exercises original-object/cleanup mechanics; it is NOT Secure Enclave, LA,
 * Keychain durability, native host admission or installed-device acceptance. */
enum PlanetChildFirstInstallV2RuntimeScenario: String {
    case firstInstall, existingV1, existingV2, existingAES, existingSnapshot, unreadableFootprint
    case earlyProofACK, earlyProvision, duplicateWire, badSignature, changedSigningKey
    case expireAfterSign, rollbackAfterSign, expireAfterRecipient, recipientThrows, cancelDuringSign
    case unknownProofDelivery, backgroundAfterACK, foregroundCannotResurrect, ambiguousAdd, readbackMismatch
    case expireAfterAdd, expireAfterStoreReturn, clockReentryAfterStoreReturn, provisionReplay, receiptReplay, wrongProofObject, retryBeforeSeed
    case ownedPromptInactive, inactiveAfterACK, backgroundDuringSign
    case expireBeforeReceiptACK, backgroundBeforeReceiptACK, retirementWaitsForActualSign, retirementWaitsForReceiptACK, retirementWaitsForActualProvision, retirementWaitsForActualSettlement
    case concurrentRetireDuringActualCleanup
}
struct PlanetChildFirstInstallV2RuntimeObservation {
    var registrationDenied=false,proofDenied=false,provisionDenied=false,earlyDenied=false,replayDenied=false
    var committed=false,receiptKnown=false,signatureVerified=false,cleanupJoined=false,retired=false,retireWaited=false
    var seedBeforeProof=false,seedExists=false,seedExact=false,signCalls=0,acquireCalls=0,createCalls=0,recipientCalls=0
    var clockReentryObserved=false,secondRequestDenied=false,sameSigningKey=false,originalSpent=false,preProofObservations=0,receiptDenied=false
    var duplicateRetireDenied=false,authorizeAfterRetireDenied=false,newerRequestPreserved=false
}
enum PlanetChildFirstInstallV2RuntimeFixture {
    private final class Clock: PinPrimitiveClock {
        private let lock=NSLock();private var now: UInt64=1000000,hook: (() -> Void)?
        func nanoseconds() throws -> UInt64 { lock.lock();let value=now,callback=hook;hook=nil;lock.unlock();callback?();return value }
        func set(_ value: UInt64) { lock.lock();now=value;lock.unlock() }
        func arm(_ callback: @escaping () -> Void) { lock.lock();hook=callback;lock.unlock() }
    }
    private final class Store: PinFirstInstallStoreV2,PinFirstInstallTransactionV2 {
        private let lock=NSRecursiveLock();var seed: Data?,footprint=false,unreadable=false,ambiguous=false,badReadback=false
        var createCalls=0,onAdd: (() -> Void)?,onReturn: (() -> Void)?
        func locked<T>(_ work: (PinFirstInstallTransactionV2) throws -> T) throws -> T { lock.lock();defer { lock.unlock() };return try work(self) }
        func requireAbsent() throws { guard !footprint,!unreadable,seed==nil else { throw PlanetChildVault.Failure.unavailable } }
        func create(_ seed: Data,boundary: () throws -> Void) throws {
            try requireAbsent();try boundary();createCalls+=1;self.seed=Data(Array(seed));onAdd?()
            if ambiguous { throw PlanetChildVault.Failure.unavailable }
            if badReadback { throw PlanetChildVault.Failure.unavailable }
            guard self.seed==seed else { throw PlanetChildVault.Failure.unavailable };try boundary();onReturn?()
        }
    }
    private final class Keys: PinOwnerKeys {
        let source: PinOwnerKeySource = .synthetic,key: PinOwnerKey
        var acquireCalls=0,signCalls=0,changed=false,badSignature=false,onSign: (() -> Void)?
        init() throws {
            var error: Unmanaged<CFError>?
            guard let privateKey=SecKeyCreateRandomKey([kSecAttrKeyType:kSecAttrKeyTypeECSECPrimeRandom,kSecAttrKeySizeInBits:256] as CFDictionary,&error),
                let publicKey=SecKeyCopyPublicKey(privateKey),let bytes=SecKeyCopyExternalRepresentation(publicKey,&error) as Data? else { throw PlanetChildVault.Failure.unavailable }
            key=PinOwnerKey(privateKey:privateKey,publicKey:publicKey,publicBytes:bytes,source:.synthetic)
        }
        func acquire(enroll: Bool,context: LAContext,prompt: String) throws -> PinOwnerKey { guard enroll else { throw PinKnownRefusal() };acquireCalls+=1;return key }
        func current(_ original: PinOwnerKey) throws { guard original === key,!changed else { throw PinKnownRefusal() } }
        func sign(_ original: PinOwnerKey,message: Data) throws -> Data {
            try current(original);signCalls+=1;var error: Unmanaged<CFError>?
            guard let signature=SecKeyCreateSignature(key.privateKey,.ecdsaSignatureMessageX962SHA256,message as CFData,&error) as Data? else { throw PinKnownRefusal() }
            onSign?();return badSignature ? Data(repeating:0,count:signature.count):signature
        }
    }
    static func run(_ scenario: PlanetChildFirstInstallV2RuntimeScenario) throws -> PlanetChildFirstInstallV2RuntimeObservation {
        // The synthetic host is nil. Waiting here never blocks a genuine main-
        // thread host/LA worker. Production request/provision/retire stay private.
        let joined=NSCondition();var completed=false,result: Result<PlanetChildFirstInstallV2RuntimeObservation,Error>?
        Thread {
            let value=Result { try runOffMain(scenario) };joined.lock();result=value;completed=true;joined.broadcast();joined.unlock()
        }.start()
        joined.lock();while !completed { joined.wait() };let value=result;joined.unlock()
        guard let value else { throw PlanetChildVault.Failure.unavailable };return try value.get()
    }
    private static func runOffMain(_ scenario: PlanetChildFirstInstallV2RuntimeScenario) throws -> PlanetChildFirstInstallV2RuntimeObservation {
        let store=Store(),keys=try Keys(),clock=Clock(),policy=try PinSessionPolicy(version:"synthetic-local-v2",checksum:String(repeating:"a",count:64),maximumIterations:600000,iterations:600000)
        if scenario == .retryBeforeSeed || scenario == .duplicateWire { return try cancelledRetry(policy:policy,testReplay:scenario == .duplicateWire) }
        if scenario == .retirementWaitsForActualProvision { return try provisionRetirement(policy:policy) }
        if scenario == .retirementWaitsForActualSettlement { return try settlementRetirement(policy:policy) }
        if scenario == .concurrentRetireDuringActualCleanup { return try cleanupRetirement(policy:policy) }
        let provider=try NativeChildFirstInstallV2(store:store,keys:keys,clock:clock,policy:policy)
        var observation=PlanetChildFirstInstallV2RuntimeObservation(),request: OriginalFirstInstallV2?,proof: FirstInstallOwnerProofV2?,receipt: FirstInstallSeedReceiptV2?
        let wire=String(repeating:"c",count:64),signEntered=DispatchSemaphore(value:0),signRelease=DispatchSemaphore(value:0)
        if [.existingV1,.existingAES,.existingSnapshot].contains(scenario) { store.footprint=true }
        if scenario == .existingV2 { store.seed=Data([0]) };if scenario == .unreadableFootprint { store.unreadable=true }
        do { request=try provider.syntheticRequest(wireId:wire) } catch { observation.registrationDenied=true }
        guard let original=request else {
            observation.cleanupJoined=provider.fixtureState(nil).joined;observation.retired=true;observation.seedExists=store.seed != nil
            observation.acquireCalls=keys.acquireCalls;observation.signCalls=keys.signCalls;observation.createCalls=store.createCalls;return observation
        }
        func discardPending() throws {
            provider.awaitFinished(original)
            if provider.fixtureState(original).proofPending,let proof { try provider.settle(proof,delivery:.uncertain) }
            if provider.fixtureState(original).receiptPending,let receipt { try provider.settle(receipt,delivery:.uncertain) }
            if !provider.fixtureState(original).retired { try provider.retire(original) }
        }
        keys.badSignature=scenario == .badSignature
        if scenario == .retirementWaitsForActualSign {
            keys.onSign={ observation.preProofObservations+=1;observation.seedBeforeProof=store.seed != nil;signEntered.signal();signRelease.wait() }
        } else {
            keys.onSign={
                observation.preProofObservations+=1
                observation.seedBeforeProof=store.seed != nil
                if scenario == .expireAfterSign { clock.set(original.deadlineNs) }
                if scenario == .rollbackAfterSign { clock.set(original.capturedNs-1) }
                if scenario == .changedSigningKey { keys.changed=true }
                if scenario == .cancelDuringSign { provider.cancel(original) }
                if scenario == .ownedPromptInactive { provider.syntheticInactive(original) }
                if scenario == .backgroundDuringSign { provider.syntheticBackground(original) }
            }
        }
        try provider.authorize(original) { value in
            observation.recipientCalls+=1
            switch value {
            case .failure: observation.proofDenied=true
            case .success(let received):
                proof=received;observation.signatureVerified=true;observation.seedBeforeProof=store.seed != nil
                if scenario == .earlyProofACK { do { try provider.settle(received,delivery:.known) } catch { observation.earlyDenied=true } }
                if scenario == .earlyProvision { do { _=try provider.provision(received) } catch { observation.earlyDenied=true } }
                if scenario == .expireAfterRecipient { clock.set(original.deadlineNs) }
                if scenario == .recipientThrows { throw PinKnownRefusal() }
            }
        }
        if scenario == .retirementWaitsForActualSign {
            signEntered.wait();let done=DispatchSemaphore(value:0);var retirementError: Error?
            Thread { do { try provider.retire(original) } catch { retirementError=error };done.signal() }.start()
            let fenced=provider.awaitRetirementFence(original),state=provider.fixtureState(original)
            observation.retireWaited=fenced && state.workers==1 && !state.retired
            signRelease.signal();done.wait();if let retirementError { throw retirementError }
        } else {
            provider.awaitFinished(original)
            if let received=proof {
                if scenario == .unknownProofDelivery {
                    try provider.settle(received,delivery:.uncertain)
                    do { receipt=try provider.provision(received);observation.committed=true } catch { observation.provisionDenied=true }
                } else {
                    do { try provider.settle(received,delivery:.known) } catch { observation.proofDenied=true }
                    if !observation.proofDenied {
                        if scenario == .backgroundAfterACK || scenario == .foregroundCannotResurrect { provider.syntheticBackground(original);provider.awaitFinished(original) }
                        if scenario == .inactiveAfterACK { provider.syntheticInactive(original);provider.awaitFinished(original) }
                        if scenario == .wrongProofObject {
                            var bytes=try received.message.copy(),signature=try received.signature.copy()
                            let other=FirstInstallOwnerProofV2(owner:provider,request:original,key:received.key,message:bytes,signature:signature)
                            bytes.resetBytes(in:0..<bytes.count);signature.resetBytes(in:0..<signature.count)
                            do { _=try provider.provision(other) } catch { observation.earlyDenied=true };other.close()
                        }
                        store.ambiguous=scenario == .ambiguousAdd;store.badReadback=scenario == .readbackMismatch
                        if scenario == .expireAfterAdd { store.onAdd={ clock.set(original.deadlineNs) } }
                        if scenario == .expireAfterStoreReturn { store.onReturn={ clock.set(original.deadlineNs) } }
                        if scenario == .clockReentryAfterStoreReturn { store.onReturn={ clock.arm { observation.clockReentryObserved=true;provider.cancel(original) } } }
                        do { receipt=try provider.provision(received);observation.committed=true } catch { observation.provisionDenied=true }
                        if let receipt {
                            if scenario == .retirementWaitsForReceiptACK {
                                let done=DispatchSemaphore(value:0);var retirementError: Error?
                                Thread { do { try provider.retire(original) } catch { retirementError=error };done.signal() }.start()
                                let fenced=provider.awaitRetirementFence(original),state=provider.fixtureState(original)
                                observation.retireWaited=fenced && state.receiptPending && state.workers==0 && !state.retired
                                provider.awaitFinished(original);try provider.settle(receipt,delivery:.uncertain);done.wait();if let retirementError { throw retirementError }
                            } else {
                                if scenario == .expireBeforeReceiptACK { clock.set(original.deadlineNs) }
                                if scenario == .backgroundBeforeReceiptACK { provider.syntheticBackground(original);provider.awaitFinished(original) }
                                do { try provider.settle(receipt,delivery:.known);observation.receiptKnown=true } catch { observation.receiptDenied=true }
                                if scenario == .receiptReplay { do { try provider.settle(receipt,delivery:.known) } catch { observation.replayDenied=true } }
                                if scenario == .provisionReplay { do { _=try provider.provision(received) } catch { observation.replayDenied=true } }
                            }
                        }
                    }
                }
            }
        }
        try discardPending()
        if [.ambiguousAdd,.readbackMismatch,.expireAfterAdd,.expireAfterStoreReturn,.clockReentryAfterStoreReturn].contains(scenario) {
            var unexpected: OriginalFirstInstallV2?
            do { unexpected=try provider.syntheticRequest(wireId:String(repeating:"f",count:64)) } catch { observation.secondRequestDenied=true }
            if let unexpected { try provider.retire(unexpected) }
        }
        let state=provider.fixtureState(original)
        observation.cleanupJoined=state.joined && provider.fixtureState(nil).joined;observation.retired=state.retired
        observation.signCalls=keys.signCalls;observation.acquireCalls=keys.acquireCalls;observation.createCalls=store.createCalls
        observation.seedExists=store.seed != nil
        observation.originalSpent=original.spent
        if let seed=store.seed { observation.seedExact=(try? PlanetChildVault.LocalEmptySeedV2.validate(seed,policyVersion:policy.version,policyChecksum:policy.checksum)) != nil }
        return observation
    }
    private static func cancelledRetry(policy: PinSessionPolicy,testReplay: Bool) throws -> PlanetChildFirstInstallV2RuntimeObservation {
        let store=Store(),keys=try Keys(),clock=Clock(),provider=try NativeChildFirstInstallV2(store:store,keys:keys,clock:clock,policy:policy)
        var preProof=[Bool](),replayDenied=false;keys.onSign={ preProof.append(store.seed==nil) }
        let original=try provider.syntheticRequest(wireId:String(repeating:"d",count:64));var first: FirstInstallOwnerProofV2?
        try provider.authorize(original) { if case .success(let value)=$0 { first=value } };provider.awaitFinished(original)
        guard let first else { throw PinKnownRefusal() };try provider.settle(first,delivery:.uncertain);try provider.retire(original)
        guard store.seed==nil else { throw PinKnownRefusal() }
        if testReplay { do { _=try provider.syntheticRequest(wireId:String(repeating:"d",count:64)) } catch { replayDenied=true } }
        let next=try provider.syntheticRequest(wireId:String(repeating:"e",count:64));var second: FirstInstallOwnerProofV2?
        try provider.authorize(next) { if case .success(let value)=$0 { second=value } };provider.awaitFinished(next)
        guard let second else { throw PinKnownRefusal() };try provider.settle(second,delivery:.known)
        let receipt=try provider.provision(second);try provider.settle(receipt,delivery:.known);try provider.retire(next)
        var observation=PlanetChildFirstInstallV2RuntimeObservation();observation.committed=true;observation.receiptKnown=true;observation.signatureVerified=true
        observation.signCalls=keys.signCalls;observation.acquireCalls=keys.acquireCalls;observation.createCalls=store.createCalls;observation.recipientCalls=2
        observation.sameSigningKey=first.key.publicBytes==second.key.publicBytes
        observation.preProofObservations=preProof.count;observation.seedBeforeProof=preProof.contains(false);observation.replayDenied=replayDenied;observation.originalSpent=next.spent
        observation.seedExists=store.seed != nil
        if let seed=store.seed { observation.seedExact=(try? PlanetChildVault.LocalEmptySeedV2.validate(seed,policyVersion:policy.version,policyChecksum:policy.checksum)) != nil }
        let state=provider.fixtureState(next)
        observation.cleanupJoined=state.joined;observation.retired=state.retired;return observation
    }
    private static func provisionRetirement(policy: PinSessionPolicy) throws -> PlanetChildFirstInstallV2RuntimeObservation {
        let store=Store(),keys=try Keys(),clock=Clock(),provider=try NativeChildFirstInstallV2(store:store,keys:keys,clock:clock,policy:policy)
        let original=try provider.syntheticRequest(wireId:String(repeating:"b",count:64));var proof: FirstInstallOwnerProofV2?
        var observation=PlanetChildFirstInstallV2RuntimeObservation();keys.onSign={ observation.seedBeforeProof=store.seed != nil;observation.preProofObservations+=1 }
        try provider.authorize(original) { observation.recipientCalls+=1;if case .success(let value)=$0 { proof=value;observation.signatureVerified=true } }
        provider.awaitFinished(original);guard let proof else { throw PinKnownRefusal() };try provider.settle(proof,delivery:.known)
        let entered=DispatchSemaphore(value:0),release=DispatchSemaphore(value:0),provisionDone=DispatchSemaphore(value:0),retireDone=DispatchSemaphore(value:0)
        store.onAdd={ entered.signal();release.wait() };var provisionError: Error?,retireError: Error?
        Thread { do { _=try provider.provision(proof);observation.committed=true } catch { provisionError=error };provisionDone.signal() }.start()
        entered.wait()
        Thread { do { try provider.retire(original) } catch { retireError=error };retireDone.signal() }.start()
        let fenced=provider.awaitRetirementFence(original),during=provider.fixtureState(original)
        observation.retireWaited=fenced && during.workers==1 && !during.retired
        clock.set(original.deadlineNs);release.signal();provisionDone.wait();retireDone.wait();if let retireError { throw retireError }
        observation.provisionDenied=provisionError != nil;observation.originalSpent=original.spent
        observation.signCalls=keys.signCalls;observation.acquireCalls=keys.acquireCalls;observation.createCalls=store.createCalls
        observation.seedExists=store.seed != nil
        if let seed=store.seed { observation.seedExact=(try? PlanetChildVault.LocalEmptySeedV2.validate(seed,policyVersion:policy.version,policyChecksum:policy.checksum)) != nil }
        let state=provider.fixtureState(original)
        observation.cleanupJoined=state.joined && provider.fixtureState(nil).joined;observation.retired=state.retired;return observation
    }
    private static func cleanupRetirement(policy: PinSessionPolicy) throws -> PlanetChildFirstInstallV2RuntimeObservation {
        let store=Store(),keys=try Keys(),clock=Clock(),provider=try NativeChildFirstInstallV2(store:store,keys:keys,clock:clock,policy:policy)
        let original=try provider.syntheticRequest(wireId:String(repeating:"1",count:64))
        let entered=DispatchSemaphore(value:0),release=DispatchSemaphore(value:0),done=DispatchSemaphore(value:0)
        try provider.syntheticCleanup(original) { entered.signal();release.wait() }
        var retirementError: Error?,observation=PlanetChildFirstInstallV2RuntimeObservation()
        Thread { do { try provider.retire(original) } catch { retirementError=error };done.signal() }.start();entered.wait()
        do { try provider.retire(original) } catch { observation.duplicateRetireDenied=true }
        do { try provider.authorize(original) { _ in } } catch { observation.authorizeAfterRetireDenied=true }
        let during=provider.fixtureState(original)
        observation.retireWaited = !during.joined && !during.retired
        var premature: OriginalFirstInstallV2?
        do { premature=try provider.syntheticRequest(wireId:String(repeating:"2",count:64)) } catch { observation.secondRequestDenied=true }
        release.signal();done.wait();if let retirementError { throw retirementError }
        if let premature { try provider.retire(premature) }
        let next=try provider.syntheticRequest(wireId:String(repeating:"3",count:64))
        do { try provider.retire(original) } catch { observation.replayDenied=true }
        var retained=try next.seed.copy();observation.newerRequestPreserved = !provider.fixtureState(nil).joined && !retained.isEmpty
        retained.resetBytes(in:0..<retained.count);try provider.retire(next)
        let state=provider.fixtureState(original)
        observation.cleanupJoined=state.joined && provider.fixtureState(nil).joined;observation.retired=state.retired
        observation.signCalls=keys.signCalls;observation.acquireCalls=keys.acquireCalls;observation.createCalls=store.createCalls
        observation.seedExists=store.seed != nil;return observation
    }
    private static func settlementRetirement(policy: PinSessionPolicy) throws -> PlanetChildFirstInstallV2RuntimeObservation {
        let store=Store(),keys=try Keys(),clock=Clock(),provider=try NativeChildFirstInstallV2(store:store,keys:keys,clock:clock,policy:policy)
        let original=try provider.syntheticRequest(wireId:String(repeating:"a",count:64));var proof: FirstInstallOwnerProofV2?
        var observation=PlanetChildFirstInstallV2RuntimeObservation()
        try provider.authorize(original) { observation.recipientCalls+=1;if case .success(let value)=$0 { proof=value;observation.signatureVerified=true } }
        provider.awaitFinished(original);guard let proof else { throw PinKnownRefusal() }
        let entered=DispatchSemaphore(value:0),release=DispatchSemaphore(value:0),settleDone=DispatchSemaphore(value:0),retireDone=DispatchSemaphore(value:0)
        clock.arm { entered.signal();release.wait() };var settleError: Error?,retireError: Error?
        Thread { do { try provider.settle(proof,delivery:.known) } catch { settleError=error };settleDone.signal() }.start();entered.wait()
        Thread { do { try provider.retire(original) } catch { retireError=error };retireDone.signal() }.start()
        let fenced=provider.awaitRetirementFence(original),during=provider.fixtureState(original)
        observation.retireWaited=fenced && during.workers==1 && during.proofPending && !during.retired
        release.signal();settleDone.wait();provider.awaitFinished(original)
        try provider.settle(proof,delivery:.uncertain);retireDone.wait();if let retireError { throw retireError }
        observation.proofDenied=settleError != nil;observation.signCalls=keys.signCalls;observation.acquireCalls=keys.acquireCalls
        observation.createCalls=store.createCalls;observation.seedExists=store.seed != nil;let state=provider.fixtureState(original)
        observation.cleanupJoined=state.joined && provider.fixtureState(nil).joined;observation.retired=state.retired;return observation
    }
}
#endif

/** Separately versioned LOCAL v2 wire/storage mechanics. These private types do
 * not implement a v1 checkpoint, owner authorization, PIN proof or Gate. No
 * production constructor/bridge selects the writer until a genuine V2 native
 * host/input/owner adapter is implemented; existing factories remain unchanged. */
fileprivate struct LocalSnapshotV2Policy {
    let version: String,checksum: String,maximum: UInt64,delays: [UInt64]
    init(version: String,checksum: String,maximum: UInt64,delays: [UInt64]) throws {
        let id=Array(version.utf8),hex=Array(checksum.utf8)
        let alnum: (UInt8) -> Bool={ $0>=48 && $0<=57 || $0>=65 && $0<=90 || $0>=97 && $0<=122 }
        guard !id.isEmpty,id.count<=96,alnum(id[0]),id.allSatisfy({ alnum($0) || $0==46 || $0==95 || $0==45 }),
            hex.count==64,hex.allSatisfy({ $0>=48 && $0<=57 || $0>=97 && $0<=102 }),
            maximum>=600000,maximum<=0xffffffff,!delays.isEmpty,delays.count<=64,
            delays.enumerated().allSatisfy({ $0.element>0 && $0.element<=9007199254740991 && ($0.offset==0 || $0.element>delays[$0.offset-1]) })
            else { throw PlanetChildVault.Failure.unavailable }
        self.version=version;self.checksum=checksum;self.maximum=maximum;self.delays=delays
    }
    func delay(_ count: UInt64) -> UInt64 { count==0 ? 0:delays[Int(min(count-1,UInt64(delays.count-1)))] }
}

/** The only production storage adapter updates the existing explicit V2 item.
 * No add/delete, reset, v1 lookup or data-AES claim. Keychain success and exact
 * readback are local publication semantics, not rollback/power-loss authority. */
fileprivate protocol LocalV2Transaction: AnyObject {
    func read() throws -> Data
    func update(_ expected: Data,_ next: Data,boundary: () throws -> Void) throws
}
fileprivate protocol LocalV2Storage: AnyObject {
    func locked<T>(_ work: (LocalV2Transaction) throws -> T) throws -> T
}
fileprivate extension PlanetChildVault {
    final class LocalV2KeychainStorage: LocalV2Storage,LocalV2Transaction {
        private let vault: PlanetChildVault
        init(_ vault: PlanetChildVault) { self.vault=vault }
        private func query() -> [String:Any] {
            [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"ru.probpera.literaryplanet.literary-planet-child-vault-v2",
             kSecAttrAccount as String:"child-full-record-v2",kSecAttrSynchronizable as String:kSecAttrSynchronizableAny,
             kSecUseAuthenticationUI as String:kSecUseAuthenticationUIFail]
        }
        func read() throws -> Data {
            var q=query();q[kSecReturnData as String]=true;q[kSecReturnAttributes as String]=true;q[kSecMatchLimit as String]=kSecMatchLimitAll
            var value: CFTypeRef?
            guard SecItemCopyMatching(q as CFDictionary,&value)==errSecSuccess,let rows=value as? [[String:Any]],rows.count==1,
                let row=rows.first,var bytes=row[kSecValueData as String] as? Data,
                row[kSecAttrSynchronizable as String] as? Bool == false,
                row[kSecAttrAccessible as String] as? String == kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String
                else { throw PlanetChildVault.Failure.unavailable }
            defer { bytes.resetBytes(in:0..<bytes.count) }
            guard !bytes.isEmpty,bytes.count<=131072 else { throw PlanetChildVault.Failure.unavailable };return Data(Array(bytes))
        }
        func update(_ expected: Data,_ next: Data,boundary: () throws -> Void) throws {
            guard !expected.isEmpty,expected.count<=131072,!next.isEmpty,next.count<=131072 else { throw PinKnownRefusal() }
            var current=try read();defer { current.resetBytes(in:0..<current.count) }
            guard current==expected else { throw PinKnownRefusal() };try boundary()
            // Read above denies cloud/duplicate/wrong-accessibility items. The
            // update itself addresses ONLY the original non-synchronizable item.
            var q=query();q[kSecAttrSynchronizable as String]=false
            guard SecItemUpdate(q as CFDictionary,[kSecValueData as String:next] as CFDictionary)==errSecSuccess
                else { throw PlanetChildVault.Failure.unavailable }
            var actual=try read();defer { actual.resetBytes(in:0..<actual.count) }
            guard actual==next else { throw PlanetChildVault.Failure.unavailable };try boundary()
        }
        func locked<T>(_ work: (LocalV2Transaction) throws -> T) throws -> T {
            // Preserve a typed known refusal across the unchanged v1 flock's
            // generic catch, without changing any existing lock behavior.
            let result: Result<T,Error> = try vault.locked { Result { try work(self) } }
            return try result.get()
        }
    }
}
fileprivate final class LocalV2EnrollmentSample {
    fileprivate weak var request: LocalV2Request?
    fileprivate let owner: LocalV2Writer
    let continuousNs: UInt64,logicalMs: UInt64,checksum: String
    fileprivate let seed: PinOwnedBytes
    fileprivate var consumed=false,closed=false
    fileprivate init(_ request: LocalV2Request,_ bytes: Data,_ ns: UInt64,_ logical: UInt64) {
        self.request=request;owner=request.owner;seed=PinOwnedBytes(bytes);continuousNs=ns;logicalMs=logical;checksum=LocalSnapshotV2.hash(bytes)
    }
    func close() { owner.condition.lock();defer { owner.condition.unlock() };closed=true;seed.close() }
}
fileprivate final class LocalV2StorageReceipt {
    fileprivate weak var request: LocalV2Request?
    fileprivate let owner: LocalV2Writer
    let checksum: String,revision: UInt64,charged: Bool
    fileprivate let bytes: PinOwnedBytes
    fileprivate var completed=false,settled=false,known=false,closed=false
    fileprivate init(_ request: LocalV2Request,_ next: Data,_ snapshot: LocalSnapshotV2,_ charged: Bool) {
        self.request=request;owner=request.owner;bytes=PinOwnedBytes(next);checksum=snapshot.checksum;revision=snapshot.fields.revision;self.charged=charged
    }
    func copyCanonicalBytes() throws -> Data {
        guard let request else { throw PinKnownRefusal() }
        owner.condition.lock();guard !closed,owner.active === request,request.receipt === self,completed,settled,known,request.workers==0,
            !request.cancelled,!request.sealed,!request.retiring,!request.retired
            else { owner.condition.unlock();throw PinKnownRefusal() }
        request.workers=1;request.workerThread=ObjectIdentifier(Thread.current);owner.condition.unlock();defer { owner.finish(request) }
        _ = try owner.current(request)
        var copy=try bytes.copy();var adopted=false
        defer { if !adopted { copy.resetBytes(in:0..<copy.count) } };_ = try owner.current(request)
        owner.condition.lock();defer { owner.condition.unlock() }
        guard owner.active === request,request.receipt === self,!closed,completed,settled,known,
            !request.cancelled,!request.sealed,!request.retiring,!request.retired else { throw PinKnownRefusal() }
        adopted=true;return copy
    }
    func close() { owner.condition.lock();defer { owner.condition.unlock() };closed=true;bytes.close() }
}
fileprivate final class LocalV2ChargedReservation {
    let attemptId: String,logicalMs: UInt64,checksum: String
    fileprivate let before: PinOwnedBytes,charged: PinOwnedBytes
    init(_ before: Data,_ after: Data,_ id: String,_ logical: UInt64) {
        self.before=PinOwnedBytes(before);charged=PinOwnedBytes(after);attemptId=id;logicalMs=logical;checksum=LocalSnapshotV2.hash(after)
    }
    func close() { before.close();charged.close() }
    deinit { close() }
}
fileprivate final class LocalV2Request {
    fileprivate let owner: LocalV2Writer
    fileprivate let host: PinOwnerOriginalHost?,process: pid_t,began: UInt64,deadline: UInt64
    fileprivate var last: UInt64
    fileprivate var expected: PinOwnedBytes?,sample: LocalV2EnrollmentSample?,receipt: LocalV2StorageReceipt?
    fileprivate var chargeStarted=false,reservation: LocalV2ChargedReservation?
    fileprivate var pinOperation: LocalV2PinOperation?
    fileprivate var profileOperation: LocalV2ProfileOperation?
    fileprivate var mutationUnacknowledged=false
    fileprivate var opened=false,cancelled=false,sealed=false,retiring=false,retired=false,workers=0,events=0,cleanup=0
    fileprivate var workerThread: ObjectIdentifier?
    fileprivate var observers=[NSObjectProtocol]()
    fileprivate init(_ owner: LocalV2Writer,_ host: PinOwnerOriginalHost?,_ ns: UInt64,_ deadline: UInt64) {
        self.owner=owner;self.host=host;process=getpid();began=ns;last=ns;self.deadline=deadline
    }
    fileprivate func wipe() { expected?.close();sample?.seed.close();receipt?.bytes.close();reservation?.close() }
}
/** Private mechanical writer. There is no production-selected constructor or
 * V2 owner/input/Gate bridge. Request/sample/receipt identities are bookkeeping,
 * never authorization. P2 mutation requires the connected V2 owner/input/KDF
 * producer below; plain storage receipts grant no permission. */
fileprivate final class LocalV2Writer {
    fileprivate let processClock: LocalV2ProcessClock
    fileprivate var condition: NSCondition { processClock.condition }
    fileprivate var active: LocalV2Request? { get { processClock.active } set { processClock.active=newValue } }
    fileprivate let storage: LocalV2Storage,policy: LocalSnapshotV2Policy,clock: PinPrimitiveClock
    private var preparing: Bool {
        get { processClock.preparingOwner != nil }
        set { if newValue { processClock.preparingOwner=self } else if processClock.preparingOwner === self { processClock.preparingOwner=nil } }
    }
    private init(vault: PlanetChildVault,policy: LocalSnapshotV2Policy) throws {
        let scope=try LocalV2ProcessClock.production(policy)
        storage=PlanetChildVault.LocalV2KeychainStorage(vault);self.policy=policy;processClock=scope;clock=scope.clock
    }
    #if DEBUG
    fileprivate init(fixtureStorage: LocalV2Storage,policy: LocalSnapshotV2Policy,clock: PinPrimitiveClock,processClock: LocalV2ProcessClock?=nil) {
        storage=fixtureStorage;self.policy=policy;self.processClock=processClock ?? LocalV2ProcessClock(fixturePolicy:policy,clock:clock);self.clock=self.processClock.clock
    }
    #endif
    /** Private future native adapter only; no public App/JS call selects this. */
    func request(host: UIViewController,timeoutMs: UInt64,originalDeadlineNs: UInt64?=nil) throws -> LocalV2Request {
        guard Thread.isMainThread,timeoutMs>0,timeoutMs<=60000 else { throw PinKnownRefusal() }
        condition.lock();guard active==nil,!preparing,!processClock.invalidated,processClock.matches(policy) else { condition.unlock();throw PinKnownRefusal() };preparing=true;condition.unlock()
        var accepted=false;defer { if !accepted { condition.lock();preparing=false;condition.unlock() } }
        let original=try PinOwnerOriginalHost(host),now=try preparationSample()
        guard now<=UInt64.max-timeoutMs*1000000 else { throw PinKnownRefusal() }
        let deadline=originalDeadlineNs ?? now+timeoutMs*1000000
        guard deadline>now,deadline-now<=60000000000 else { throw PinKnownRefusal() }
        let request=LocalV2Request(self,original,now,deadline)
        condition.lock();guard active==nil,processClock.preparingOwner === self,!processClock.invalidated else { condition.unlock();throw PinKnownRefusal() }
        do { try processClock.observe(now) } catch { condition.unlock();throw error }
        active=request;preparing=false;condition.unlock()
        // Original lifecycle latch remains installed through known ACK until
        // actual exclusive retire; a later return cannot resurrect this request.
        let center=NotificationCenter.default
        for name in [UIApplication.willResignActiveNotification,UIApplication.didEnterBackgroundNotification,UIScene.didDisconnectNotification] {
            let observer=center.addObserver(forName:name,object:nil,queue:nil) { [weak self,weak request] note in
                guard let self,let request else { return }
                if name==UIScene.didDisconnectNotification,!original.disconnected(note) { return }
                self.condition.lock();guard self.active === request,!request.retired,!request.retiring else { self.condition.unlock();return }
                if !self.pinLifecycleWillRevokeLocked(request,name:name) { self.condition.unlock();return }
                request.events+=1;request.cancelled=true;request.pinOperation?.revokeLocked();request.profileOperation?.revokeLocked()
                if request.mutationUnacknowledged { self.processClock.invalidate(request);request.sealed=true }
                self.condition.broadcast();self.condition.unlock()
                self.condition.lock();request.events-=1;if request.workers==0 { request.wipe() };self.condition.broadcast();self.condition.unlock()
            }
            request.observers.append(observer)
        }
        accepted=true;return request
    }
    private func preparationSample() throws -> UInt64 {
        do { return try clock.nanoseconds() } catch {
            condition.lock();processClock.invalidatePreparing(self);condition.unlock();throw error
        }
    }
    private func local(_ request: LocalV2Request) throws -> UInt64 {
        let now: UInt64
        do { now=try clock.nanoseconds() } catch {
            condition.lock();if active === request,request.owner === self { processClock.invalidate(request);request.sealed=true };condition.unlock();throw error
        }
        condition.lock();defer { condition.unlock() }
        guard active === request,request.owner === self,request.process==getpid(),!processClock.invalidated else { throw PinKnownRefusal() }
        do { try processClock.observe(now) } catch { request.sealed=true;throw error }
        guard !request.cancelled,!request.sealed,!request.retiring,!request.retired,now>=request.last,now>=request.began,now<request.deadline else { throw PinKnownRefusal() }
        request.last=now;return now
    }
    fileprivate func current(_ request: LocalV2Request) throws -> UInt64 {
        _ = try local(request);condition.lock();let ui=request.pinOperation?.input?.controller ?? request.profileOperation?.controller,prompt=(request.pinOperation?.ownedPrompt ?? false) || (request.profileOperation?.ownedPrompt ?? false);condition.unlock()
        try request.host?.localV2Current(ownedInput:ui,ownedPrompt:prompt);return try local(request)
    }
    private func start(_ request: LocalV2Request,opened: Bool) throws {
        guard !Thread.isMainThread else { throw PinKnownRefusal() }
        condition.lock();defer { condition.unlock() }
        guard active === request,request.owner === self,!processClock.invalidated,processClock.matches(policy),!request.cancelled,!request.sealed,!request.retiring,!request.retired,request.workers==0,
            request.opened==opened,request.receipt==nil || request.receipt!.settled && request.receipt!.known else { throw PinKnownRefusal() }
        request.workers=1;request.workerThread=ObjectIdentifier(Thread.current)
    }
    fileprivate func finish(_ request: LocalV2Request) {
        condition.lock();defer { condition.unlock() };request.workers-=1;request.workerThread=nil
        if request.cancelled || request.sealed { request.wipe() };condition.broadcast()
    }
    private func fail(_ request: LocalV2Request,_ error: Error,publication: Bool) {
        condition.lock();defer { condition.unlock() }
        guard active === request,request.owner === self else { return }
        if publication || request.mutationUnacknowledged || !(error is PinKnownRefusal) {
            request.sealed=true;processClock.invalidate(request)
        }
        if request.workers==0 { request.wipe() };condition.broadcast()
    }
    private func exact(_ transaction: LocalV2Transaction,_ request: LocalV2Request) throws -> Data {
        var read=try transaction.read();var adopted=false
        defer { if !adopted { read.resetBytes(in:0..<read.count) } }
        guard !read.isEmpty,read.count<=131072,let expected=request.expected else { throw PlanetChildVault.Failure.unavailable }
        var original=try expected.copy();defer { original.resetBytes(in:0..<original.count) }
        guard read==original else {
            condition.lock();processClock.invalidate(request);request.sealed=true;condition.unlock();throw PlanetChildVault.Failure.unavailable
        }
        condition.lock();defer { condition.unlock() }
        try processClock.requireBound(request,read);adopted=true;return read
    }
    private func write(_ transaction: LocalV2Transaction,_ request: LocalV2Request,_ expected: Data,_ next: Data,permission: (() throws -> Void)?=nil) throws {
        let old=PinOwnedBytes(expected),new=PinOwnedBytes(next);defer { old.close();new.close() }
        var borrowedOld=try old.copy(),borrowedNext=try new.copy()
        defer { borrowedOld.resetBytes(in:0..<borrowedOld.count);borrowedNext.resetBytes(in:0..<borrowedNext.count) }
        func fence() throws {
            var a=try old.copy(),b=try new.copy();defer { a.resetBytes(in:0..<a.count);b.resetBytes(in:0..<b.count) }
            guard borrowedOld==a,borrowedNext==b else { throw PlanetChildVault.Failure.unavailable }
            _ = try local(request);try permission?()
            guard borrowedOld==a,borrowedNext==b else { throw PlanetChildVault.Failure.unavailable }
        }
        try fence();try transaction.update(borrowedOld,borrowedNext,boundary:fence);try fence()
        var actual=try transaction.read(),canonical=try new.copy()
        defer { actual.resetBytes(in:0..<actual.count);canonical.resetBytes(in:0..<canonical.count) }
        guard actual.count<=131072,actual==canonical else { throw PlanetChildVault.Failure.unavailable }
        try fence();guard actual==canonical else { throw PlanetChildVault.Failure.unavailable }
    }
    @discardableResult func open(_ request: LocalV2Request) throws -> LocalV2StorageReceipt? {
        try start(request,opened:false);defer { finish(request) };var publication=false
        var originalReceipt: LocalV2StorageReceipt?
        do {
            _ = try current(request)
            try storage.locked { transaction in
                _ = try local(request);var bytes=try transaction.read();defer { bytes.resetBytes(in:0..<bytes.count) }
                guard !bytes.isEmpty,bytes.count<=131072 else { throw PlanetChildVault.Failure.unavailable }
                condition.lock();let bound=processClock.known != nil;condition.unlock()
                if bound {
                    condition.lock()
                    do { try processClock.requireBound(request,bytes);request.expected=PinOwnedBytes(bytes);condition.unlock() }
                    catch { condition.unlock();throw error }
                    // Exact known bytes/policy retain the original process ns
                    // origin and fractional remainder; no J rewrite or credit reset.
                } else if bytes.count<=4096,(try? PlanetChildVault.LocalEmptySeedV2.validate(bytes,policyVersion:policy.version,policyChecksum:policy.checksum)) != nil {
                    let now=try local(request);condition.lock()
                    do { try processClock.adoptFirst(request,bytes,nil,now);request.expected=PinOwnedBytes(bytes);condition.unlock() }
                    catch { condition.unlock();throw error }
                } else {
                    let old=try LocalSnapshotV2.decode(bytes,policy:policy);defer { old.close() }
                    let next=try old.reanchorCandidate();defer { next.close() }
                    var after=try next.copyCanonicalBytes();defer { after.resetBytes(in:0..<after.count) }
                    _ = try local(request);publication=true;condition.lock();request.mutationUnacknowledged=true;condition.unlock()
                    try write(transaction,request,bytes,after)
                    let now=try local(request);condition.lock()
                    do { try processClock.adoptFirst(request,after,next,now,pendingDelivery:true);request.expected=PinOwnedBytes(after)
                        let receipt=LocalV2StorageReceipt(request,after,next,false);request.receipt=receipt;originalReceipt=receipt;condition.unlock() }
                    catch { condition.unlock();throw error };publication=false
                }
                _ = try local(request)
            }
            _ = try current(request);condition.lock()
            guard active === request,!request.cancelled,!request.retiring,!request.sealed,!processClock.invalidated else { condition.unlock();throw PinKnownRefusal() }
            request.opened=true;originalReceipt?.completed=true
            if originalReceipt==nil { request.mutationUnacknowledged=false };condition.unlock();return originalReceipt
        } catch { fail(request,error,publication:publication);throw error }
    }
    func sampleEnrollment(_ request: LocalV2Request) throws -> LocalV2EnrollmentSample {
        try start(request,opened:true);defer { finish(request) }
        do {
            condition.lock();let fresh=request.sample==nil;condition.unlock();guard fresh else { throw PinKnownRefusal() }
            _ = try current(request)
            let sample=try storage.locked { transaction -> LocalV2EnrollmentSample in
                var seed=try exact(transaction,request);defer { seed.resetBytes(in:0..<seed.count) }
                _ = try PlanetChildVault.LocalEmptySeedV2.validate(seed,policyVersion:policy.version,policyChecksum:policy.checksum)
                let now=try local(request);condition.lock();let logical: UInt64
                do { logical=try processClock.logical(now);condition.unlock() } catch { condition.unlock();throw error }
                return LocalV2EnrollmentSample(request,seed,now,logical)
            }
            _ = try current(request);condition.lock();request.sample=sample;condition.unlock();return sample
        } catch { fail(request,error,publication:false);throw error }
    }
    private func commitEnrollment(_ request: LocalV2Request,sample: LocalV2EnrollmentSample,next input: Data,
                permission: (() throws -> Void)?=nil,recipient: (LocalV2StorageReceipt) throws -> Void) throws {
        // Foreign/busy refusal leaves the other owner's sample untouched.
        condition.lock();guard active === request,request.sample === sample,sample.request === request,!sample.consumed,!sample.closed,
            request.workers==0,!request.cancelled,!request.sealed,!request.retiring else { condition.unlock();throw PinKnownRefusal() }
        guard !Thread.isMainThread else { condition.unlock();throw PinKnownRefusal() }
        request.workers=1;request.workerThread=ObjectIdentifier(Thread.current);sample.consumed=true;condition.unlock();defer { finish(request) }
        var publication=false
        do {
            guard !input.isEmpty,input.count<=131072 else { throw PinKnownRefusal() }
            var nextBytes=Data(Array(input));defer { nextBytes.resetBytes(in:0..<nextBytes.count) }
            let next=try LocalSnapshotV2.decode(nextBytes,policy:policy);defer { next.close() }
            var seed=try sample.seed.copy();defer { seed.resetBytes(in:0..<seed.count) }
            try LocalSnapshotV2.validateEnrollment(seed:seed,next:next,logical:sample.logicalMs,policy:policy)
            _ = try current(request)
            try storage.locked { transaction in
                var actual=try exact(transaction,request);defer { actual.resetBytes(in:0..<actual.count) }
                guard actual==seed,LocalSnapshotV2.hash(actual)==sample.checksum,try local(request)>=sample.continuousNs else { throw PinKnownRefusal() }
                publication=true;condition.lock();request.mutationUnacknowledged=true;condition.unlock()
                try write(transaction,request,actual,nextBytes,permission:permission)
                condition.lock()
                do { try processClock.stage(request,nextBytes,next);request.expected?.close();request.expected=PinOwnedBytes(nextBytes);condition.unlock() }
                catch { condition.unlock();throw error };publication=false
            }
            _ = try current(request);try publish(request,next,nextBytes,false,recipient)
        } catch { fail(request,error,publication:publication);throw error }
    }
    func charge(_ request: LocalV2Request,recipient: (LocalV2StorageReceipt) throws -> Void) throws {
        condition.lock()
        guard let operation=request.pinOperation,operation.owner.writer === self,operation.challenge.kind == .verify,
            operation.opened,operation.used,operation.inputJoined,!operation.cancelled,
            operation.workerThread==ObjectIdentifier(Thread.current),let entry=operation.entry,entry.operation === operation,
            entry.consumed else { condition.unlock();throw PinKnownRefusal() }
        condition.unlock();try pinFence(operation,readback:true);try commitCharge(request,recipient:recipient)
    }
    private func commitCharge(_ request: LocalV2Request,recipient: (LocalV2StorageReceipt) throws -> Void) throws {
        try start(request,opened:true);defer { finish(request) };var publication=false
        do {
            condition.lock();guard !request.chargeStarted else { condition.unlock();throw PinKnownRefusal() }
            request.chargeStarted=true;condition.unlock()
            _ = try current(request)
            var random=Data(count:32);defer { random.resetBytes(in:0..<random.count) }
            let status=random.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault,32,$0.baseAddress!) }
            guard status==errSecSuccess else { throw PlanetChildVault.Failure.unavailable }
            let id=random.map { String(format:"%02x",$0) }.joined()
            try storage.locked { transaction in
                var before=try exact(transaction,request);defer { before.resetBytes(in:0..<before.count) }
                let old=try LocalSnapshotV2.decode(before,policy:policy);defer { old.close() }
                let now=try local(request);condition.lock();let logical: UInt64
                do { logical=try processClock.logical(now);condition.unlock() } catch { condition.unlock();throw error }
                let next=try old.chargeCandidate(id:id,logical:logical);defer { next.close() }
                var after=try next.copyCanonicalBytes();defer { after.resetBytes(in:0..<after.count) }
                publication=true;condition.lock();request.mutationUnacknowledged=true;condition.unlock()
                try write(transaction,request,before,after)
                condition.lock()
                do { try processClock.stage(request,after,next);request.expected?.close();request.expected=PinOwnedBytes(after)
                    request.reservation=LocalV2ChargedReservation(before,after,id,logical);condition.unlock() }
                catch { condition.unlock();throw error };publication=false
                // Recipient is invoked after releasing the durable flock below.
            }
            _ = try current(request);var after=try request.expected!.copy();defer { after.resetBytes(in:0..<after.count) }
            let next=try LocalSnapshotV2.decode(after,policy:policy);defer { next.close() };try publish(request,next,after,true,recipient)
        } catch { fail(request,error,publication:publication);throw error }
    }
    private func publish(_ request: LocalV2Request,_ next: LocalSnapshotV2,_ bytes: Data,_ charged: Bool,
                         _ recipient: (LocalV2StorageReceipt) throws -> Void) throws {
        _ = try current(request);let receipt=LocalV2StorageReceipt(request,bytes,next,charged)
        condition.lock();guard active === request,!request.cancelled,!request.retiring,!request.sealed else { condition.unlock();receipt.bytes.close();throw PinKnownRefusal() }
        request.receipt=receipt;condition.unlock()
        do { try recipient(receipt);_ = try current(request)
            try storage.locked { transaction in var read=try exact(transaction,request);defer { read.resetBytes(in:0..<read.count) };_ = try local(request) }
            _ = try current(request);condition.lock();guard !request.cancelled,!request.retiring,!request.sealed else { condition.unlock();throw PinKnownRefusal() }
            receipt.completed=true;condition.unlock()
        } catch { condition.lock();request.sealed=true;condition.unlock();throw error }
    }
    func settle(_ receipt: LocalV2StorageReceipt,known: Bool) throws {
        guard let request=receipt.request,receipt.owner === self else { throw PinKnownRefusal() }
        guard !known || !Thread.isMainThread else { throw PinKnownRefusal() }
        condition.lock()
        guard active === request,request.receipt === receipt,!receipt.settled,request.workers==0,
            !known || !receipt.closed && receipt.completed && !request.cancelled && !request.retiring && !request.retired && !request.sealed
            else { condition.unlock();throw PinKnownRefusal() }
        if !known { receipt.settled=true;request.sealed=true;processClock.invalidate(request);request.wipe();condition.broadcast();condition.unlock();return }
        request.workers=1;request.workerThread=ObjectIdentifier(Thread.current);condition.unlock();defer { finish(request) }
        do {
            _ = try current(request)
            try storage.locked { transaction in
                var exactRead=try exact(transaction,request);defer { exactRead.resetBytes(in:0..<exactRead.count) };_ = try local(request)
            }
            _ = try current(request)
            condition.lock()
            guard active === request,request.receipt === receipt,!receipt.settled,!receipt.closed,receipt.completed,
                !request.cancelled,!request.sealed,!request.retiring,!request.retired else { condition.unlock();throw PinKnownRefusal() }
            do { try processClock.commitPending(request);receipt.settled=true;receipt.known=true;request.mutationUnacknowledged=false
                condition.broadcast();condition.unlock() } catch { condition.unlock();throw error }
        } catch { fail(request,error,publication:request.mutationUnacknowledged);throw error }
    }
    func cancel(_ request: LocalV2Request) {
        condition.lock();defer { condition.unlock() };guard active === request,request.owner === self,!request.retired else { return }
        if request.mutationUnacknowledged { processClock.invalidate(request);request.sealed=true }
        request.cancelled=true;request.pinOperation?.revokeLocked();request.profileOperation?.revokeLocked();if request.workers==0 { request.wipe() };condition.broadcast()
    }
    func retire(_ request: LocalV2Request) throws {
        guard !Thread.isMainThread else { throw PinKnownRefusal() }
        condition.lock();guard active === request,request.owner === self,!request.retiring,!request.retired,
            request.workerThread != ObjectIdentifier(Thread.current),request.pinOperation?.workerThread != ObjectIdentifier(Thread.current),
            request.pinOperation?.deliveryThread != ObjectIdentifier(Thread.current),request.profileOperation?.worker.map(ObjectIdentifier.init) != ObjectIdentifier(Thread.current) else { condition.unlock();throw PinKnownRefusal() }
        if let operation=request.pinOperation {
            operation.closedKnownCandidate=operation.reply?.known==true && operation.reply?.settled==true && !operation.cancelled
                && !request.cancelled && !request.sealed && !operation.closedRevoked
        }
        request.retiring=true;request.cancelled=true;request.pinOperation?.revokeLocked();request.profileOperation?.revokeLocked()
        if request.mutationUnacknowledged { processClock.invalidate(request);request.sealed=true }
        condition.broadcast()
        while request.workers>0 || request.events>0 || request.receipt != nil && !request.receipt!.settled
            || request.pinOperation?.busy == true || request.profileOperation?.busy == true || request.pinOperation?.reply != nil && request.pinOperation!.reply!.settled == false { condition.wait() }
        request.cleanup=1;condition.unlock()
        // Real main cleanup returns before capacity is reconsidered. No timer
        // substitutes for observer removal, callback/worker or delivery ACK.
        DispatchQueue.main.sync { for observer in request.observers { NotificationCenter.default.removeObserver(observer) };request.observers.removeAll() }
        condition.lock();request.cleanup=0;request.wipe();request.retired=true;condition.broadcast()
        guard active === request,request.owner === self,request.workers==0,request.events==0 else { condition.unlock();throw PlanetChildVault.Failure.unavailable }
        let unavailable=request.sealed || processClock.invalidated
        do { try processClock.detachRetired(request);request.expected=nil;request.sample=nil;request.receipt=nil;request.reservation=nil;condition.unlock() }
        catch { condition.unlock();throw error }
        if unavailable { throw PlanetChildVault.Failure.unavailable }
    }
}
/** One fixed production V2 Keychain/flock namespace owns this RAM-only clock
 * for the actual process. No caller namespace, wall time, serialized process
 * nonce/boot or v1 checkpoint is accepted. Policy is bound in full by value.
 * All mutable methods below run under condition; no external callbacks occur
 * under it. Continuous ns origin/remainder survives request/ACK/mutation. */
fileprivate final class LocalV2ProcessClock {
    private static let registryLock=NSLock()
    private static var productionScope: LocalV2ProcessClock?
    fileprivate let condition=NSCondition(),clock: PinPrimitiveClock,policy: LocalSnapshotV2Policy
    fileprivate var active: LocalV2Request?,preparingOwner: LocalV2Writer?
    fileprivate var pinUsedIds=Set<String>(),pinUsedChallenges=[ObjectIdentifier:AnyObject]()
    fileprivate private(set) var invalidated=false,known: LocalV2ProcessBinding?
    private var pending: LocalV2ProcessBinding?,pendingOwner: LocalV2Request?
    private let process: pid_t
    private var originNs: UInt64?,originLogical: UInt64=0,lastNs: UInt64=0
    private init(_ policy: LocalSnapshotV2Policy,_ clock: PinPrimitiveClock) { self.policy=policy;self.clock=clock;process=getpid() }
    fileprivate static func production(_ policy: LocalSnapshotV2Policy) throws -> LocalV2ProcessClock {
        registryLock.lock();defer { registryLock.unlock() }
        if let original=productionScope { guard original.matches(policy) else { throw PinKnownRefusal() };return original }
        // Namespace is the fixed LocalV2KeychainStorage service/account and the
        // existing application flock; every vault/writer instance shares it.
        let original=LocalV2ProcessClock(policy,ApplePinPrimitiveClock());productionScope=original;return original
    }
    #if DEBUG
    fileprivate convenience init(fixturePolicy: LocalSnapshotV2Policy,clock: PinPrimitiveClock) { self.init(fixturePolicy,clock) }
    #endif
    fileprivate func matches(_ other: LocalSnapshotV2Policy) -> Bool {
        policy.version==other.version && policy.checksum==other.checksum && policy.maximum==other.maximum && policy.delays==other.delays
    }
    private func poison() { invalidated=true;known?.close();pending?.close();condition.broadcast() }
    fileprivate func invalidate(_ request: LocalV2Request) {
        // A stale owner's late cancellation/cleanup cannot poison a new lease.
        guard active === request,request.owner.processClock === self else { return };poison()
    }
    fileprivate func invalidatePreparing(_ owner: LocalV2Writer) {
        guard active==nil,preparingOwner === owner else { return };poison()
    }
    fileprivate func observe(_ ns: UInt64) throws {
        guard !invalidated else { throw PinKnownRefusal() }
        guard process==getpid(),ns>0,ns>=lastNs else { poison();throw PlanetChildVault.Failure.unavailable }
        lastNs=ns
        if originNs != nil { _ = try logical(ns) }
    }
    fileprivate func logical(_ ns: UInt64) throws -> UInt64 {
        guard !invalidated,let origin=originNs else { throw PinKnownRefusal() }
        guard ns>=origin,(ns-origin)/1000000<=LocalSnapshotV2.maximum-originLogical else {
            poison();throw PlanetChildVault.Failure.unavailable
        }
        return originLogical+(ns-origin)/1000000
    }
    fileprivate func requireBound(_ request: LocalV2Request,_ bytes: Data) throws {
        guard active === request,request.owner.processClock === self,!invalidated else { throw PinKnownRefusal() }
        let binding=pendingOwner === request ? pending:known
        guard let binding else { throw PinKnownRefusal() }
        var original=try binding.bytes.copy();defer { original.resetBytes(in:0..<original.count) }
        guard bytes==original,LocalSnapshotV2.hash(bytes)==binding.checksum else { poison();request.sealed=true;throw PlanetChildVault.Failure.unavailable }
    }
    fileprivate func adoptFirst(_ request: LocalV2Request,_ bytes: Data,_ snapshot: LocalSnapshotV2?,_ ns: UInt64,pendingDelivery: Bool=false) throws {
        guard active === request,request.owner.processClock === self,!invalidated,known==nil,pending==nil,originNs==nil else { throw PinKnownRefusal() }
        try observe(ns);let binding=LocalV2ProcessBinding(bytes,snapshot)
        if pendingDelivery { pending=binding;pendingOwner=request } else { known=binding }
        originNs=ns;originLogical=snapshot?.journal.logical ?? 0
        _ = try logical(ns)
    }
    fileprivate func stage(_ request: LocalV2Request,_ bytes: Data,_ snapshot: LocalSnapshotV2) throws {
        guard active === request,request.owner.processClock === self,!invalidated,known != nil,pending==nil,matches(snapshot.policy),
            snapshot.fields.pin.observed<=(try logical(lastNs)) else { throw PinKnownRefusal() }
        pending=LocalV2ProcessBinding(bytes,snapshot);pendingOwner=request
        // Record anchor fields are independent of process ns origin: never
        // rebase on charge, enrollment, request reopen or later ACK time.
    }
    fileprivate func commitPending(_ request: LocalV2Request) throws {
        guard active === request,request.owner.processClock === self,!invalidated,pendingOwner === request,let pending else { throw PinKnownRefusal() }
        known?.close();known=pending;self.pending=nil;pendingOwner=nil
    }
    fileprivate func detachRetired(_ request: LocalV2Request) throws {
        guard active === request,request.owner.processClock === self,request.retired,request.workers==0,request.events==0,request.cleanup==0,
            request.receipt==nil || request.receipt!.settled else { throw PinKnownRefusal() }
        if pendingOwner === request { pending?.close();pending=nil;pendingOwner=nil }
        if invalidated { known?.close();known=nil }
        active=nil // invalidated stays true: releasing the graph never revives a lane.
    }
}
fileprivate final class LocalV2ProcessBinding {
    let checksum: String,rootRevision: UInt64,pinRevision: UInt64?,journalRevision: UInt64?,credential: String?
    let bytes: PinOwnedBytes
    init(_ bytes: Data,_ snapshot: LocalSnapshotV2?) {
        self.bytes=PinOwnedBytes(bytes);checksum=LocalSnapshotV2.hash(bytes);rootRevision=snapshot?.fields.revision ?? 1
        pinRevision=snapshot?.fields.pin.revision;journalRevision=snapshot?.journal.revision;credential=snapshot?.fields.pin.credential
    }
    func close() { bytes.close() }
    deinit { close() }
}
fileprivate struct LocalV2PinFields {
    let revision: UInt64,credential: String,count: UInt64,blocked: UInt64,observed: UInt64,pending: String?
    let revisionStart: Int,revisionEnd: Int,attemptsStart: Int
}
fileprivate struct LocalV2RecordFields {
    let revision: UInt64,clock: UInt64,pin: LocalV2PinFields
    let revisionStart: Int,revisionEnd: Int,pinStart: Int,pinEnd: Int
}
fileprivate struct LocalV2JournalFields {
    let revision: UInt64,protectedChecksum: String,protectedRevision: UInt64,pinRevision: UInt64,credential: String
    let count: UInt64,pending: String?,cooldown: UInt64,logical: UInt64
}
fileprivate struct LocalV2Decoded {
    let fields: LocalV2RecordFields,journal: LocalV2JournalFields
    var protectedBytes: Data
}
fileprivate extension PlanetChildVault.ProtectedEnvelope {
    static func localV2Decode(_ input: Data,policy: LocalSnapshotV2Policy) throws -> LocalV2Decoded {
        try require(!input.isEmpty && input.count<=131072)
        let storage=Storage(input);defer { storage.wipe() };let p=Cursor(storage)
        try p.field("schemaVersion",first:true);_ = try p.number(2,2)
        try p.field("protectedRecord");let begin=p.index
        try p.field("schemaVersion",first:true);_ = try p.number(2,2)
        try p.field("revision");let revisionStart=p.index-begin,revision=try p.number(1,9007199254740991),revisionEnd=p.index-begin
        try p.field("mode");let mode=try p.asciiString();try require(mode=="adult" || mode=="child")
        try p.field("selectionRevision");_ = try p.number(1,9007199254740991)
        try p.field("profileRevision");_ = try p.number(1,9007199254740991)
        try p.field("policyChecksum");try require(p.asciiString()==policy.checksum)
        try p.field("registryChecksum");let registryChecksum=try p.asciiString();try require(hash(registryChecksum))
        try p.field("registry");let registryStart=p.index,active=try registry(p,version:policy.version),registryEnd=p.index
        var registryBytes=storage.copy(registryStart..<registryEnd);defer { registryBytes.resetBytes(in:0..<registryBytes.count) }
        try require(localV2Hash(registryBytes)==registryChecksum)
        try p.field("pin");let pinStart=p.index-begin
        _ = try readPin(p,version:policy.version,maximum:policy.maximum) // Reuse the strict enrolled PIN grammar.
        let pinEnd=p.index-begin
        var pinBytes=storage.copy((begin+pinStart)..<(begin+pinEnd));defer { pinBytes.resetBytes(in:0..<pinBytes.count) }
        let pinStorage=Storage(pinBytes);defer { pinStorage.wipe() };let q=Cursor(pinStorage)
        try q.field("schemaVersion",first:true);_ = try q.number(1,1)
        try q.field("policyVersion");try require(q.asciiString()==policy.version)
        try q.field("revision");let pinRevisionStart=q.index,pinRevision=try q.number(1,9007199254740991),pinRevisionEnd=q.index
        try q.field("credentialId");let credential=try q.asciiString()
        try q.field("verifier");try q.field("algorithm",first:true);try require(q.asciiString()=="PBKDF2-HMAC-SHA256")
        try q.field("iterations");_ = try q.number(600000,policy.maximum)
        try q.field("saltHex");_ = try q.hashRange();try q.field("hashHex");_ = try q.hashRange();try q.token("}")
        try q.field("attempts");let attemptsStart=q.index
        try q.field("count",first:true);let count=try q.number(0,9007199254740991)
        try q.field("blockedUntilMs");let blocked=try q.number(0,9007199254740991)
        try q.field("lastObservedMs");let observed=try q.number(0,9007199254740991)
        try q.field("pendingAttemptId");let pending=try q.nullableString();try q.token("}");try q.token("}")
        try require(q.index==pinStorage.count && hash(credential) && (pending==nil || hash(pending!)))
        try p.field("clock");try p.field("schemaVersion",first:true);_ = try p.number(2,2)
        try p.field("logicalMs");let clock=try p.number(0,9007199254740991);try p.token("}");try p.token("}")
        let end=p.index;try require(clock<=observed && (mode != "child" || active != nil))
        var protectedBytes=storage.copy(begin..<end);var adopted=false
        defer { if !adopted { protectedBytes.resetBytes(in:0..<protectedBytes.count) } }
        let checksum=localV2Hash(protectedBytes)
        try p.field("restartJournal");let journalStart=p.index
        try p.field("schemaVersion",first:true);_ = try p.number(2,2)
        try p.field("policyVersion");try require(p.asciiString()==policy.version)
        try p.field("policyChecksum");try require(p.asciiString()==policy.checksum)
        try p.field("revision");let journalRevision=try p.number(1,9007199254740991)
        try p.field("protected");try p.field("checksum",first:true);let boundChecksum=try p.asciiString()
        try p.field("revision");let boundRevision=try p.number(1,9007199254740991)
        try p.field("pinRevision");let boundPin=try p.number(1,9007199254740991)
        try p.field("credentialId");let boundCredential=try p.asciiString();try p.token("}")
        try p.field("attempts");try p.field("count",first:true);let boundCount=try p.number(0,9007199254740991)
        try p.field("pendingAttemptId");let boundPending=try p.nullableString()
        try p.field("savedCooldownMs");let cooldown=try p.number(0,9007199254740991);try p.token("}")
        try p.field("anchor");try p.field("logicalMs",first:true);let logical=try p.number(0,9007199254740991)
        try p.token("}");try p.token("}");let journalEnd=p.index;try p.token("}")
        try require(p.index==storage.count && journalEnd-journalStart<=4096 && boundChecksum==checksum
            && boundRevision==revision && boundPin==pinRevision && boundCredential==credential
            && boundCount==count && boundPending==pending && logical==observed && cooldown==policy.delay(count)
            && logical<=9007199254740991-cooldown && (count==0 ? blocked==0 && pending==nil:blocked==logical+cooldown))
        let pin=LocalV2PinFields(revision:pinRevision,credential:credential,count:count,blocked:blocked,observed:observed,pending:pending,
            revisionStart:pinRevisionStart,revisionEnd:pinRevisionEnd,attemptsStart:attemptsStart)
        let fields=LocalV2RecordFields(revision:revision,clock:clock,pin:pin,revisionStart:revisionStart,revisionEnd:revisionEnd,pinStart:pinStart,pinEnd:pinEnd)
        let journal=LocalV2JournalFields(revision:journalRevision,protectedChecksum:checksum,protectedRevision:revision,pinRevision:pinRevision,
            credential:credential,count:count,pending:pending,cooldown:cooldown,logical:logical)
        adopted=true;return LocalV2Decoded(fields:fields,journal:journal,protectedBytes:protectedBytes)
    }
    private static func localV2Hash(_ bytes: Data) -> String { SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() }
}
fileprivate final class LocalSnapshotV2 {
    static let maximum: UInt64=9007199254740991
    let policy: LocalSnapshotV2Policy,fields: LocalV2RecordFields,journal: LocalV2JournalFields,checksum: String
    private let lock=NSLock(),bytes: PinOwnedBytes,protectedBytes: PinOwnedBytes
    private var disposed=false
    private init(_ input: Data,_ decoded: LocalV2Decoded,_ policy: LocalSnapshotV2Policy) {
        self.policy=policy;fields=decoded.fields;journal=decoded.journal;bytes=PinOwnedBytes(input);protectedBytes=PinOwnedBytes(decoded.protectedBytes)
        checksum=Self.hash(input)
    }
    static func hash(_ bytes: Data) -> String { SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() }
    static func decode(_ input: Data,policy: LocalSnapshotV2Policy) throws -> LocalSnapshotV2 {
        guard !input.isEmpty,input.count<=131072 else { throw PlanetChildVault.Failure.unavailable }
        var owned=Data(Array(input));defer { owned.resetBytes(in:0..<owned.count) }
        var decoded=try PlanetChildVault.ProtectedEnvelope.localV2Decode(owned,policy:policy)
        defer { decoded.protectedBytes.resetBytes(in:0..<decoded.protectedBytes.count) }
        return LocalSnapshotV2(owned,decoded,policy)
    }
    func copyCanonicalBytes() throws -> Data { lock.lock();defer { lock.unlock() };guard !disposed else { throw PinKnownRefusal() };return try bytes.copy() }
    func copyProtectedBytes() throws -> Data { lock.lock();defer { lock.unlock() };guard !disposed else { throw PinKnownRefusal() };return try protectedBytes.copy() }
    func close() { lock.lock();defer { lock.unlock() };disposed=true;bytes.close();protectedBytes.close() }
    deinit { close() }
    static func samePolicy(_ a: LocalSnapshotV2,_ b: LocalSnapshotV2) -> Bool {
        a.policy.version==b.policy.version && a.policy.checksum==b.policy.checksum && a.policy.maximum==b.policy.maximum && a.policy.delays==b.policy.delays
    }
    static func wrapper(_ protectedBytes: Data,policy: LocalSnapshotV2Policy,rootRevision: UInt64,journalRevision: UInt64,pin: LocalV2PinFields) throws -> LocalSnapshotV2 {
        guard !protectedBytes.isEmpty,protectedBytes.count<=131072,rootRevision>0,rootRevision<=maximum,
            journalRevision>0,journalRevision<=maximum else { throw PinKnownRefusal() }
        let cooldown=policy.delay(pin.count),pending=pin.pending.map { "\"\($0)\"" } ?? "null"
        let journal="{\"schemaVersion\":2,\"policyVersion\":\"\(policy.version)\",\"policyChecksum\":\"\(policy.checksum)\",\"revision\":\(journalRevision),\"protected\":{\"checksum\":\"\(hash(protectedBytes))\",\"revision\":\(rootRevision),\"pinRevision\":\(pin.revision),\"credentialId\":\"\(pin.credential)\"},\"attempts\":{\"count\":\(pin.count),\"pendingAttemptId\":\(pending),\"savedCooldownMs\":\(cooldown)},\"anchor\":{\"logicalMs\":\(pin.observed)}}"
        var j=Data(journal.utf8);defer { j.resetBytes(in:0..<j.count) }
        guard j.count<=4096,protectedBytes.count<=131072-j.count-57 else { throw PinKnownRefusal() }
        var full=Data("{\"schemaVersion\":2,\"protectedRecord\":".utf8);full.append(protectedBytes)
        full.append(Data(",\"restartJournal\":".utf8));full.append(j);full.append(125);defer { full.resetBytes(in:0..<full.count) }
        return try decode(full,policy:policy)
    }
    func reanchorCandidate() throws -> LocalSnapshotV2 {
        guard journal.revision<Self.maximum else { throw PinKnownRefusal() }
        var p=try copyProtectedBytes();defer { p.resetBytes(in:0..<p.count) }
        return try Self.wrapper(p,policy:policy,rootRevision:fields.revision,journalRevision:journal.revision+1,pin:fields.pin)
    }
    func chargeCandidate(id: String,logical: UInt64) throws -> LocalSnapshotV2 {
        guard fields.revision<Self.maximum,fields.pin.revision<Self.maximum,journal.revision<Self.maximum,fields.pin.count<Self.maximum,
            logical>=fields.pin.observed,logical>=fields.pin.blocked,logical<=Self.maximum else { throw PinKnownRefusal() }
        let count=fields.pin.count+1,delay=policy.delay(count)
        guard logical<=Self.maximum-delay else { throw PinKnownRefusal() }
        var p=try copyProtectedBytes();defer { p.resetBytes(in:0..<p.count) }
        let f=fields.pin;var raw=p.subdata(in:fields.pinStart..<fields.pinEnd);defer { raw.resetBytes(in:0..<raw.count) }
        var pin=Data(raw.prefix(f.revisionStart));pin.append(Data(String(f.revision+1).utf8))
        pin.append(raw.subdata(in:f.revisionEnd..<f.attemptsStart))
        pin.append(Data("{\"count\":\(count),\"blockedUntilMs\":\(logical+delay),\"lastObservedMs\":\(logical),\"pendingAttemptId\":\"\(id)\"}}".utf8))
        defer { pin.resetBytes(in:0..<pin.count) }
        var next=Data(p.prefix(fields.revisionStart));next.append(Data(String(fields.revision+1).utf8))
        next.append(p.subdata(in:fields.revisionEnd..<fields.pinStart));next.append(pin);next.append(p.suffix(from:fields.pinEnd))
        defer { next.resetBytes(in:0..<next.count) }
        let changed=LocalV2PinFields(revision:f.revision+1,credential:f.credential,count:count,blocked:logical+delay,observed:logical,pending:id,
            revisionStart:0,revisionEnd:0,attemptsStart:0)
        return try Self.wrapper(next,policy:policy,rootRevision:fields.revision+1,journalRevision:journal.revision+1,pin:changed)
    }
    static func validateEnrollment(seed input: Data,next: LocalSnapshotV2,logical: UInt64,policy: LocalSnapshotV2Policy) throws {
        guard !input.isEmpty,input.count<=4096 else { throw PinKnownRefusal() }
        var seed=Data(Array(input));defer { seed.resetBytes(in:0..<seed.count) }
        _ = try PlanetChildVault.LocalEmptySeedV2.validate(seed,policyVersion:policy.version,policyChecksum:policy.checksum)
        guard logical<=maximum,next.fields.revision==2,next.fields.pin.revision==1,next.journal.revision==1,
            next.fields.pin.count==0,next.fields.pin.blocked==0,next.fields.pin.pending==nil,next.fields.pin.observed==logical,
            next.policy.version==policy.version,next.policy.checksum==policy.checksum,next.policy.maximum==policy.maximum,next.policy.delays==policy.delays
            else { throw PinKnownRefusal() }
        var p=try next.copyProtectedBytes();defer { p.resetBytes(in:0..<p.count) }
        let pinMarker=Data("\"pin\":null".utf8)
        guard let range=seed.range(of:pinMarker),p.starts(with:Data("{\"schemaVersion\":2,\"revision\":2".utf8)) else { throw PinKnownRefusal() }
        var expected=Data("{\"schemaVersion\":2,\"revision\":2".utf8)
        let rootPrefix=Data("{\"schemaVersion\":2,\"revision\":1".utf8).count
        expected.append(seed.subdata(in:rootPrefix..<range.lowerBound));expected.append(Data("\"pin\":".utf8))
        expected.append(p.subdata(in:next.fields.pinStart..<next.fields.pinEnd));expected.append(seed.suffix(from:range.upperBound))
        defer { expected.resetBytes(in:0..<expected.count) };guard expected==p else { throw PinKnownRefusal() }
    }
    /** Structural classification only, NEVER a mathematical outcome/permission.
     * The connected producer alone supplies its owned comparison to finalize. */
    static func validateFinalization(charged: LocalSnapshotV2,next: LocalSnapshotV2) throws {
        guard samePolicy(charged,next),charged.fields.pin.pending != nil,charged.fields.revision<maximum,
            charged.fields.pin.revision<maximum,charged.journal.revision<maximum,next.fields.revision==charged.fields.revision+1,
            next.fields.pin.revision==charged.fields.pin.revision+1,next.journal.revision==charged.journal.revision+1,
            next.fields.pin.pending==nil,next.fields.pin.observed>=charged.fields.pin.observed,
            next.fields.pin.count==0 || next.fields.pin.count==charged.fields.pin.count else { throw PinKnownRefusal() }
        var old=try charged.copyProtectedBytes(),after=try next.copyProtectedBytes()
        defer { old.resetBytes(in:0..<old.count);after.resetBytes(in:0..<after.count) }
        let a=charged.fields,b=next.fields
        guard old.subdata(in:a.revisionEnd..<a.pinStart)==after.subdata(in:b.revisionEnd..<b.pinStart),
            old.suffix(from:a.pinEnd)==after.suffix(from:b.pinEnd) else { throw PinKnownRefusal() }
        var oldPin=old.subdata(in:a.pinStart..<a.pinEnd),newPin=after.subdata(in:b.pinStart..<b.pinEnd)
        defer { oldPin.resetBytes(in:0..<oldPin.count);newPin.resetBytes(in:0..<newPin.count) }
        guard oldPin.prefix(a.pin.revisionStart)==newPin.prefix(b.pin.revisionStart),
            oldPin.subdata(in:a.pin.revisionEnd..<a.pin.attemptsStart)==newPin.subdata(in:b.pin.revisionEnd..<b.pin.attemptsStart)
            else { throw PinKnownRefusal() }
        // decode already checked new count/blocked/pending/full-delay binding.
    }
}

#if DEBUG
/** Explicit synthetic closed-wire/storage observations only. No Keychain/OS
 * owner, admission, nonrollback, genuine host or installed-device acceptance. */
fileprivate final class LocalV2FixtureClock: PinPrimitiveClock {
    var now: UInt64=1000000000
    var callback: (() -> Void)?
    func nanoseconds() throws -> UInt64 { callback?();return now }
}
fileprivate final class LocalV2FixtureStorage: LocalV2Storage,LocalV2Transaction {
    private let lock=NSRecursiveLock()
    var value: Data,updates=0,corruptReadback=false
    var duringUpdate: (() -> Void)?
    init(_ bytes: Data) { value=Data(Array(bytes)) }
    func locked<T>(_ work: (LocalV2Transaction) throws -> T) throws -> T { lock.lock();defer { lock.unlock() };return try work(self) }
    func read() throws -> Data { Data(Array(value)) }
    func update(_ expected: Data,_ next: Data,boundary: () throws -> Void) throws {
        guard expected==value else { throw PinKnownRefusal() };try boundary();updates+=1;value=Data(Array(next))
        if corruptReadback { value.append(32) };duringUpdate?();try boundary()
    }
}
fileprivate extension LocalV2Writer {
    func fixtureCharge(_ request: LocalV2Request,recipient: (LocalV2StorageReceipt) throws -> Void) throws {
        guard request.pinOperation==nil,request.host==nil else { throw PinKnownRefusal() };try commitCharge(request,recipient:recipient)
    }
    func fixtureEnroll(_ request: LocalV2Request,sample: LocalV2EnrollmentSample,next: Data,recipient: (LocalV2StorageReceipt) throws -> Void) throws {
        guard request.pinOperation==nil else { throw PinKnownRefusal() };try commitEnrollment(request,sample:sample,next:next,recipient:recipient)
    }
    func fixtureRequest(timeoutMs: UInt64=1000) throws -> LocalV2Request {
        condition.lock();guard active==nil,!preparing,!processClock.invalidated,processClock.matches(policy),timeoutMs>0,timeoutMs<=60000 else { condition.unlock();throw PinKnownRefusal() }
        preparing=true;condition.unlock();var accepted=false
        defer { if !accepted { condition.lock();preparing=false;condition.unlock() } };let now=try preparationSample()
        guard now<=UInt64.max-timeoutMs*1000000 else { throw PinKnownRefusal() }
        condition.lock();defer { condition.unlock() }
        guard active==nil,processClock.preparingOwner === self,!processClock.invalidated else { throw PinKnownRefusal() };try processClock.observe(now)
        let request=LocalV2Request(self,nil,now,now+timeoutMs*1000000);active=request;preparing=false;accepted=true;return request
    }
}
enum PlanetChildLocalSnapshotV2Scenario: String {
    case enrollment,crossBinding,canonicalBounds,lowerBound,separateSeed,charge,reanchor,finalization,overflow
    case originalSample,earlyAck,cancelAndCAS,unknownReadback,copyJoinsRetire
}
struct PlanetChildLocalSnapshotV2Observation { let pass: Bool,operations: Int,qualification: String }
enum PlanetChildLocalSnapshotV2RuntimeFixture {
    private static let safe: UInt64=9007199254740991
    private static func policy() throws -> LocalSnapshotV2Policy {
        try LocalSnapshotV2Policy(version:"synthetic-local-v2",checksum:String(repeating:"a",count:64),maximum:600000,delays:[100,200,400])
    }
    private static func build(_ policy: LocalSnapshotV2Policy,count: UInt64=0,logical: UInt64=0,clock: UInt64=0,
                              root: UInt64=2,pinRevision: UInt64=1,journal: UInt64=1,pending: String?=nil,
                              credential: String=String(repeating:"b",count:64)) throws -> LocalSnapshotV2 {
        let seed=try PlanetChildVault.LocalEmptySeedV2.canonicalBytes(policyVersion:policy.version,policyChecksum:policy.checksum)
        let pin="{\"schemaVersion\":1,\"policyVersion\":\"\(policy.version)\",\"revision\":\(pinRevision),\"credentialId\":\"\(credential)\",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":600000,\"saltHex\":\"\(String(repeating:"c",count:64))\",\"hashHex\":\"\(String(repeating:"d",count:64))\"},\"attempts\":{\"count\":\(count),\"blockedUntilMs\":\(count==0 ? 0:logical+policy.delay(count)),\"lastObservedMs\":\(logical),\"pendingAttemptId\":\(pending.map { "\"\($0)\"" } ?? "null")}}"
        let text=String(decoding:seed,as:UTF8.self).replacingOccurrences(of:"\"revision\":1",with:"\"revision\":\(root)")
            .replacingOccurrences(of:"\"pin\":null",with:"\"pin\":\(pin)").replacingOccurrences(of:"\"logicalMs\":0",with:"\"logicalMs\":\(clock)")
        let fields=LocalV2PinFields(revision:pinRevision,credential:credential,count:count,blocked:count==0 ? 0:logical+policy.delay(count),observed:logical,pending:pending,
            revisionStart:0,revisionEnd:0,attemptsStart:0)
        return try LocalSnapshotV2.wrapper(Data(text.utf8),policy:policy,rootRevision:root,journalRevision:journal,pin:fields)
    }
    private static func denied(_ body: () throws -> Void) -> Bool { do { try body();return false } catch { return true } }
    static func run(_ scenario: PlanetChildLocalSnapshotV2Scenario) throws -> PlanetChildLocalSnapshotV2Observation {
        guard !Thread.isMainThread else { throw PlanetChildVault.Failure.unavailable }
        let p=try policy();var pass=false,operations=0
        switch scenario {
        case .enrollment:
            var seed=try PlanetChildVault.LocalEmptySeedV2.canonicalBytes(policyVersion:p.version,policyChecksum:p.checksum)
            defer { seed.resetBytes(in:0..<seed.count) };let next=try build(p,logical:17);defer { next.close() }
            try LocalSnapshotV2.validateEnrollment(seed:seed,next:next,logical:17,policy:p)
            var bytes=try next.copyCanonicalBytes();defer { bytes.resetBytes(in:0..<bytes.count) };let copy=try LocalSnapshotV2.decode(bytes,policy:p);defer { copy.close() }
            pass=copy.fields.clock==0 && copy.journal.logical==17 && copy.fields.revision==2 && copy.fields.pin.count==0
        case .crossBinding:
            let original=try build(p,count:1,logical:17,pending:String(repeating:"e",count:64));defer { original.close() }
            var bytes=try original.copyCanonicalBytes();defer { bytes.resetBytes(in:0..<bytes.count) }
            let text=String(decoding:bytes,as:UTF8.self)
            let bad=text.replacingOccurrences(of:original.journal.protectedChecksum,with:String(repeating:"0",count:64))
            let wrongCount=text.replacingOccurrences(of:"\"savedCooldownMs\":100",with:"\"savedCooldownMs\":200")
            pass=denied { let x=try LocalSnapshotV2.decode(Data(bad.utf8),policy:p);x.close() }
                && denied { let x=try LocalSnapshotV2.decode(Data(wrongCount.utf8),policy:p);x.close() }
        case .canonicalBounds:
            let original=try build(p);defer { original.close() };var bytes=try original.copyCanonicalBytes();defer { bytes.resetBytes(in:0..<bytes.count) }
            pass=denied { let x=try LocalSnapshotV2.decode(Data([0xff]),policy:p);x.close() }
                && denied { let x=try LocalSnapshotV2.decode(bytes+Data([32]),policy:p);x.close() }
                && denied { let x=try LocalSnapshotV2.decode(Data(repeating:32,count:131073),policy:p);x.close() }
                && denied { let x=try LocalSnapshotV2.decode(Data(String(decoding:bytes,as:UTF8.self).replacingOccurrences(of:"\"algorithm\":\"PBKDF2-HMAC-SHA256\"",with:"\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"extra\":0").utf8),policy:p);x.close() }
        case .lowerBound:
            let okay=try build(p,logical:19,clock:18);defer { okay.close() }
            pass=okay.fields.clock<okay.fields.pin.observed && denied { let x=try build(p,logical:19,clock:20);x.close() }
        case .separateSeed:
            var seed=try PlanetChildVault.LocalEmptySeedV2.canonicalBytes(policyVersion:p.version,policyChecksum:p.checksum);defer { seed.resetBytes(in:0..<seed.count) }
            pass=denied { let x=try LocalSnapshotV2.decode(seed,policy:p);x.close() }
                && denied { let x=try LocalSnapshotV2.decode(Data(("{\"schemaVersion\":2,\"protectedRecord\":"+String(decoding:seed,as:UTF8.self)+",\"restartJournal\":null}").utf8),policy:p);x.close() }
        case .charge:
            let old=try build(p,count:1,logical:10,pending:String(repeating:"e",count:64));defer { old.close() }
            let refused=denied { let x=try old.chargeCandidate(id:String(repeating:"f",count:64),logical:109);x.close() }
            let next=try old.chargeCandidate(id:String(repeating:"f",count:64),logical:110);defer { next.close() }
            var before=try old.copyProtectedBytes(),after=try next.copyProtectedBytes();defer { before.resetBytes(in:0..<before.count);after.resetBytes(in:0..<after.count) }
            pass=refused && next.fields.pin.count==2 && next.fields.pin.blocked==310 && next.fields.pin.pending==String(repeating:"f",count:64)
                && before.suffix(from:old.fields.pinEnd)==after.suffix(from:next.fields.pinEnd) && next.fields.pin.credential==old.fields.pin.credential
        case .reanchor:
            let old=try build(p,count:2,logical:20,pending:String(repeating:"e",count:64));defer { old.close() }
            let next=try old.reanchorCandidate();defer { next.close() }
            var a=try old.copyProtectedBytes(),b=try next.copyProtectedBytes();defer { a.resetBytes(in:0..<a.count);b.resetBytes(in:0..<b.count) }
            pass=a==b && next.journal.revision==old.journal.revision+1 && next.journal.cooldown==200 && next.journal.pending==old.journal.pending
        case .finalization:
            let old=try build(p,count:1,logical:10,root:3,pinRevision:2,journal:2,pending:String(repeating:"e",count:64));defer { old.close() }
            let reset=try build(p,logical:11,root:4,pinRevision:3,journal:3);defer { reset.close() }
            let mismatch=try build(p,count:1,logical:11,root:4,pinRevision:3,journal:3);defer { mismatch.close() }
            let foreign=try build(p,logical:11,root:4,pinRevision:3,journal:3,credential:String(repeating:"f",count:64));defer { foreign.close() }
            try LocalSnapshotV2.validateFinalization(charged:old,next:reset);try LocalSnapshotV2.validateFinalization(charged:old,next:mismatch)
            pass=denied { try LocalSnapshotV2.validateFinalization(charged:old,next:foreign) } && mismatch.fields.pin.count==1 && reset.fields.pin.count==0
        case .overflow:
            let old=try build(p,root:safe,pinRevision:safe,journal:safe);defer { old.close() }
            pass=denied { let x=try old.reanchorCandidate();x.close() }
                && denied { let x=try old.chargeCandidate(id:String(repeating:"f",count:64),logical:0);x.close() }
                && denied { _ = try LocalSnapshotV2Policy(version:p.version,checksum:p.checksum,maximum:599999,delays:[100]) }
        case .originalSample,.earlyAck,.cancelAndCAS,.unknownReadback,.copyJoinsRetire:
            var seed=try PlanetChildVault.LocalEmptySeedV2.canonicalBytes(policyVersion:p.version,policyChecksum:p.checksum);defer { seed.resetBytes(in:0..<seed.count) }
            let io=LocalV2FixtureStorage(seed),clock=LocalV2FixtureClock(),writer=LocalV2Writer(fixtureStorage:io,policy:p,clock:clock)
            let request=try writer.fixtureRequest();try writer.open(request);clock.now+=10000000
            let sample=try writer.sampleEnrollment(request),next=try build(p,logical:sample.logicalMs);defer { next.close() }
            var bytes=try next.copyCanonicalBytes();defer { bytes.resetBytes(in:0..<bytes.count) }
            var receipt: LocalV2StorageReceipt?,early=false,earlyCopy=false,selfRetire=false
            if scenario == .unknownReadback { io.corruptReadback=true }
            if scenario == .cancelAndCAS { io.duringUpdate={ writer.cancel(request) } }
            clock.now+=70000000
            let enrollmentDenied=denied {
                try writer.fixtureEnroll(request,sample:sample,next:bytes) { value in
                    receipt=value
                    early=denied { try writer.settle(value,known:true) }
                    earlyCopy=denied { _ = try value.copyCanonicalBytes() }
                    selfRetire=denied { try writer.retire(request) }
                }
            }
            operations=io.updates
            if scenario == .originalSample {
                guard let first=receipt else { throw PlanetChildVault.Failure.unavailable };try writer.settle(first,known:true)
                var charged: LocalV2StorageReceipt?;try writer.fixtureCharge(request) { charged=$0 }
                guard let second=charged else { throw PlanetChildVault.Failure.unavailable };try writer.settle(second,known:true)
                clock.now+=200000000;let repeated=denied { try writer.fixtureCharge(request) { _ in } }
                pass = !enrollmentDenied && sample.logicalMs==10 && repeated && io.updates==2 && request.reservation?.attemptId.count==64
                    && request.reservation?.logicalMs==80 && request.reservation?.checksum==second.checksum
                try writer.retire(request);first.close();second.close();sample.close();operations=io.updates
            } else if scenario == .earlyAck {
                guard let receipt else { throw PlanetChildVault.Failure.unavailable };receipt.close()
                let closed=denied { try writer.settle(receipt,known:true) };try writer.settle(receipt,known:false)
                let retired=denied { try writer.retire(request) }
                pass=early && earlyCopy && selfRetire && closed && retired && writer.active==nil && writer.processClock.invalidated && request.sealed && denied { _ = try receipt.copyCanonicalBytes() }
                sample.close();receipt.close()
            } else if scenario == .cancelAndCAS {
                let stored=try LocalSnapshotV2.decode(io.value,policy:p);defer { stored.close() }
                pass=enrollmentDenied && request.cancelled && stored.fields.revision==2 && io.updates==1
                // Independent stale full-record refusal before any update.
                let otherIO=LocalV2FixtureStorage(seed),other=LocalV2Writer(fixtureStorage:otherIO,policy:p,clock:LocalV2FixtureClock())
                let owned=try other.fixtureRequest();try other.open(owned);let original=try other.sampleEnrollment(owned)
                let staleNext=try build(p,logical:original.logicalMs);defer { staleNext.close() }
                var staleBytes=try staleNext.copyCanonicalBytes();defer { staleBytes.resetBytes(in:0..<staleBytes.count) }
                otherIO.value=io.value
                let stale=denied { try other.fixtureEnroll(owned,sample:original,next:staleBytes) { _ in } }
                pass=pass && stale && otherIO.updates==0;try other.retire(owned);original.close()
                let sealedRetirement=denied { try writer.retire(request) }
                pass=pass && sealedRetirement && writer.active==nil && writer.processClock.invalidated && request.sealed;sample.close()
            } else if scenario == .copyJoinsRetire {
                guard let receipt else { throw PlanetChildVault.Failure.unavailable };try writer.settle(receipt,known:true)
                let entered=DispatchSemaphore(value:0),release=DispatchSemaphore(value:0),copied=DispatchSemaphore(value:0),retired=DispatchSemaphore(value:0)
                defer { release.signal() }
                let results=NSLock();var copyDenied=false,retireReturned=false,called=false
                clock.callback={
                    results.lock();let first = !called;called=true;results.unlock()
                    if first { entered.signal();_ = release.wait(timeout:.now()+3) }
                }
                Thread { let refused=denied { var data=try receipt.copyCanonicalBytes();data.resetBytes(in:0..<data.count) }
                    results.lock();copyDenied=refused;results.unlock();copied.signal() }.start()
                guard entered.wait(timeout:.now()+2) == .success else { throw PlanetChildVault.Failure.unavailable }
                Thread { do { try writer.retire(request);results.lock();retireReturned=true;results.unlock() } catch {};retired.signal() }.start()
                writer.condition.lock()
                while !request.retiring { if !writer.condition.wait(until:Date(timeIntervalSinceNow:2)) { writer.condition.unlock();throw PlanetChildVault.Failure.unavailable } }
                let held=writer.active === request && request.workers==1 && !request.retired;writer.condition.unlock()
                release.signal();guard copied.wait(timeout:.now()+2) == .success,retired.wait(timeout:.now()+2) == .success else { throw PlanetChildVault.Failure.unavailable }
                results.lock();let joined=copyDenied && retireReturned;results.unlock();clock.callback=nil
                pass=held && joined && writer.active==nil && earlyCopy;receipt.close();sample.close()
            } else {
                pass=enrollmentDenied && request.sealed && io.updates==1 && denied { _ = try writer.fixtureRequest() }
                    && denied { try writer.retire(request) } && writer.active==nil && writer.processClock.invalidated
                sample.close()
            }
        }
        return PlanetChildLocalSnapshotV2Observation(pass:pass,operations:operations,
            qualification:"Synthetic local V2 codec/closed storage mechanics only; Keychain, Swift compilation, genuine host/owner/input/Gate and installed device acceptance NOT_RUN.")
    }
}
#endif

#if DEBUG
fileprivate extension PlanetChildLocalSnapshotV2RuntimeFixture {
    static func processPolicy(_ delays: [UInt64]) throws -> LocalSnapshotV2Policy {
        let original=try policy()
        return try LocalSnapshotV2Policy(version:original.version,checksum:original.checksum,maximum:original.maximum,delays:delays)
    }
    static func processRecord(_ policy: LocalSnapshotV2Policy,count: UInt64=1,logical: UInt64=5) throws -> LocalSnapshotV2 {
        try build(policy,count:count,logical:logical,pending:count>0 ? String(repeating:"e",count:64):nil)
    }
}
enum PlanetChildLocalProcessClockScenario: String {
    case longCooldown,competingWriters,fractionalOrigin,processReplacement,unknownReadback,unexpectedBytes
    case regression,overflow,prewriteCancel,policyMismatch,lostColdACK,ACKReadbackMismatch
}
struct PlanetChildLocalProcessClockObservation { let pass: Bool,updates: Int,qualification: String }
enum PlanetChildLocalProcessClockRuntimeFixture {
    private static func denied(_ body: () throws -> Void) -> Bool { do { try body();return false } catch { return true } }
    private static func open(_ writer: LocalV2Writer) throws -> LocalV2Request {
        let request=try writer.fixtureRequest()
        if let receipt=try writer.open(request) { try writer.settle(receipt,known:true) }
        return request
    }
    private static func charge(_ writer: LocalV2Writer,_ request: LocalV2Request) throws {
        var receipt: LocalV2StorageReceipt?
        try writer.fixtureCharge(request) { receipt=$0 }
        guard let receipt else { throw PlanetChildVault.Failure.unavailable };try writer.settle(receipt,known:true)
    }
    static func run(_ scenario: PlanetChildLocalProcessClockScenario) throws -> PlanetChildLocalProcessClockObservation {
        guard !Thread.isMainThread else { throw PlanetChildVault.Failure.unavailable }
        let small=scenario == .fractionalOrigin
        let policy=try PlanetChildLocalSnapshotV2RuntimeFixture.processPolicy(small ? [100,200]:[70000,140000])
        let limit: UInt64=9007199254740991
        let initial=try PlanetChildLocalSnapshotV2RuntimeFixture.processRecord(policy,count:small || scenario == .overflow ? 0:1,
            logical:scenario == .overflow ? limit:(small ? 0:5));defer { initial.close() }
        var bytes=try initial.copyCanonicalBytes();defer { bytes.resetBytes(in:0..<bytes.count) }
        let io=LocalV2FixtureStorage(bytes),clock=LocalV2FixtureClock()
        let scope=LocalV2ProcessClock(fixturePolicy:policy,clock:clock)
        func writer(_ p: LocalSnapshotV2Policy?=nil) -> LocalV2Writer {
            LocalV2Writer(fixtureStorage:io,policy:p ?? policy,clock:clock,processClock:scope)
        }
        var pass=false
        switch scenario {
        case .longCooldown:
            let first=writer(),one=try open(first);try first.retire(one)
            clock.now+=60000000000
            let second=writer(),two=try open(second)
            let early=denied { try charge(second,two) };try second.retire(two)
            clock.now+=10000000000
            let third=writer(),three=try open(third);try charge(third,three)
            let stored=try LocalSnapshotV2.decode(io.value,policy:policy);defer { stored.close() }
            pass=early && io.updates==2 && stored.fields.pin.observed==70005 && stored.fields.pin.count==2
                && stored.fields.pin.blocked==210005
            try third.retire(three)
        case .competingWriters:
            let first=writer(),one=try open(first),second=writer()
            var other: LocalV2Request?
            let refused=denied { other=try second.fixtureRequest() }
            scope.condition.lock();let original=scope.active === one;scope.condition.unlock()
            pass=refused && original && io.updates==1
            try first.retire(one);if let other { try second.retire(other) }
            let fresh=try open(second);try second.retire(fresh)
        case .fractionalOrigin:
            let first=writer(),one=try open(first);clock.now+=600000;try first.retire(one)
            let second=writer(),two=try open(second);clock.now+=600000;try charge(second,two);try second.retire(two)
            // 101ms from the ORIGINAL origin, including the 0.2ms remainder
            // present at first charge; a charge/ACK-time rebase would give 100ms.
            clock.now=1101000000
            let third=writer(),three=try open(third);try charge(third,three)
            let stored=try LocalSnapshotV2.decode(io.value,policy:policy);defer { stored.close() }
            pass=io.updates==3 && stored.fields.pin.count==2 && stored.fields.pin.observed==101
            try third.retire(three)
        case .processReplacement:
            let first=writer(),one=try open(first);try first.retire(one);clock.now+=120000000000
            // Explicit synthetic replacement models empty RAM after process loss;
            // it never selects/resets the fixed production singleton.
            let replacement=LocalV2ProcessClock(fixturePolicy:policy,clock:clock)
            let second=LocalV2Writer(fixtureStorage:io,policy:policy,clock:clock,processClock:replacement),two=try open(second)
            let noOutsideCredit=denied { try charge(second,two) };try second.retire(two)
            clock.now+=70000000000
            let third=LocalV2Writer(fixtureStorage:io,policy:policy,clock:clock,processClock:replacement),three=try open(third)
            try charge(third,three)
            let stored=try LocalSnapshotV2.decode(io.value,policy:policy);defer { stored.close() }
            pass=noOutsideCredit && io.updates==3 && stored.fields.pin.count==2 && stored.fields.pin.observed==70005
            try third.retire(three)
        case .unknownReadback:
            let first=writer(),one=try open(first);try first.retire(one);clock.now+=70000000000
            let second=writer(),two=try open(second);io.corruptReadback=true
            let unknown=denied { try charge(second,two) },retired=denied { try second.retire(two) }
            let fresh=writer(),refused=denied { _ = try fresh.fixtureRequest() }
            scope.condition.lock();let detached=scope.active==nil && scope.invalidated;scope.condition.unlock()
            pass=unknown && retired && refused && detached && io.updates==2
        case .unexpectedBytes:
            let first=writer(),one=try open(first);try first.retire(one)
            let foreign=try PlanetChildLocalSnapshotV2RuntimeFixture.processRecord(policy,count:2,logical:8);defer { foreign.close() }
            var changed=try foreign.copyCanonicalBytes();defer { changed.resetBytes(in:0..<changed.count) };io.value=changed
            let second=writer(),two=try second.fixtureRequest(),refused=denied { _ = try second.open(two) }
            let retired=denied { try second.retire(two) };io.value=bytes
            pass=refused && retired && io.updates==1 && denied { _ = try writer().fixtureRequest() }
        case .regression:
            let first=writer(),one=try open(first);clock.now+=1;_ = try first.current(one);try first.retire(one)
            clock.now-=1
            pass=denied { _ = try writer().fixtureRequest() } && scope.invalidated && io.updates==1
        case .overflow:
            let first=writer(),one=try open(first);try first.retire(one);clock.now+=500000
            let second=writer(),two=try open(second);try second.retire(two);clock.now+=500000
            pass=denied { _ = try writer().fixtureRequest() } && scope.invalidated && io.updates==1
        case .prewriteCancel:
            let first=writer(),one=try open(first);try first.retire(one);clock.now+=60000000000
            let second=writer(),two=try open(second);second.cancel(two);try second.retire(two);clock.now+=10000000000
            let third=writer(),three=try open(third)
            // A stale original cannot cancel/retire the newer lease or its clock.
            second.cancel(two);let stale=denied { try second.retire(two) };try charge(third,three)
            let stored=try LocalSnapshotV2.decode(io.value,policy:policy);defer { stored.close() }
            pass=stale && !scope.invalidated && stored.fields.pin.observed==70005 && io.updates==2
            try third.retire(three)
        case .policyMismatch:
            let first=writer(),one=try open(first);try first.retire(one)
            let other=try PlanetChildLocalSnapshotV2RuntimeFixture.processPolicy([70001,140000])
            let refused=denied { _ = try writer(other).fixtureRequest() };clock.now+=70000000000
            let second=writer(),two=try open(second);try charge(second,two)
            pass=refused && !scope.invalidated && io.updates==2;try second.retire(two)
        case .lostColdACK,.ACKReadbackMismatch:
            let first=writer(),one=try first.fixtureRequest()
            guard let receipt=try first.open(one) else { throw PlanetChildVault.Failure.unavailable }
            defer { try? first.settle(receipt,known:false) }
            if scenario == .ACKReadbackMismatch {
                io.value=bytes
                let refused=denied { try first.settle(receipt,known:true) };try first.settle(receipt,known:false)
                pass=refused && denied { try first.retire(one) } && scope.invalidated && scope.active==nil
                    && denied { _ = try writer().fixtureRequest() } && io.updates==1
            } else {
                let started=DispatchSemaphore(value:0),done=DispatchSemaphore(value:0),lock=NSLock();var refused=false
                Thread { started.signal();let deniedRetire=denied { try first.retire(one) };lock.lock();refused=deniedRetire;lock.unlock();done.signal() }.start()
                guard started.wait(timeout:.now()+2) == .success else { throw PlanetChildVault.Failure.unavailable }
                scope.condition.lock()
                while !one.retiring { if !scope.condition.wait(until:Date(timeIntervalSinceNow:2)) { scope.condition.unlock();throw PlanetChildVault.Failure.unavailable } }
                let held=scope.active === one && scope.invalidated && !one.retired;scope.condition.unlock()
                let otherDenied=denied { _ = try writer().fixtureRequest() }
                try first.settle(receipt,known:false)
                guard done.wait(timeout:.now()+2) == .success else { throw PlanetChildVault.Failure.unavailable }
                lock.lock();let finished=refused;lock.unlock()
                pass=held && otherDenied && finished && scope.active==nil && scope.invalidated && io.updates==1
            }
            receipt.close()
        }
        return PlanetChildLocalProcessClockObservation(pass:pass,updates:io.updates,
            qualification:"Connected private writer with explicit synthetic process scope/storage/clock; Swift compilation, real Keychain/UIKit/OS restart/owner/input/KDF/Gate acceptance NOT_RUN. Production clock source remains fixed Apple continuous time.")
    }
}
#endif

/** Connected LOCAL v2 only. No backend account, boot UUID, rollback witness or
 * v1 authority is assumed. This private coordinator is still unselected by all
 * factories; the genuine GateHost and App admission remain separate work. */
fileprivate enum LocalV2PinKind { case enroll,verify }
fileprivate enum LocalV2PinReplyKind { case enrolled,match,mismatch }
fileprivate final class LocalV2PinChallenge {
    let original: AnyObject,id: String,kind: LocalV2PinKind,action: String,target: String,generation: UInt64,deadlineNs: UInt64
    let gate: PinGateRequest?,rootRevision: UInt64,profileRevision: UInt64,selectionRevision: UInt64
    init(enrollmentOriginal: AnyObject,id: String,seedChecksum: String,generation: UInt64,deadlineNs: UInt64) {
        original=enrollmentOriginal;self.id=id;kind = .enroll;action="enroll-local-pin";target=seedChecksum
        self.generation=generation;self.deadlineNs=deadlineNs;gate=nil;rootRevision=1;profileRevision=1;selectionRevision=1
    }
    init(verificationOriginal: PinGateRequest,rootRevision: UInt64,selectionRevision: UInt64,deadlineNs: UInt64) {
        let gate=verificationOriginal;original=gate.originalHostChallenge;id=gate.id;kind = .verify;action=gate.action;target=gate.targetChecksum
        generation=gate.generation;self.deadlineNs=deadlineNs;self.gate=gate;self.rootRevision=rootRevision
        profileRevision=gate.context.profileRevision;self.selectionRevision=selectionRevision
    }
}
fileprivate final class LocalV2PinOperation {
    let owner: LocalV2PinOperations,request: LocalV2Request,challenge: LocalV2PinChallenge,locale: PinNativeInputLocale,iterations: UInt32
    var opened=false,used=false,cancelled=false,inputJoined=false,uiWorkers=0,watchers=0,cancels=0,recipients=0,settlements=0,ownerWorkers=0
    var input: LocalV2PinNativeInput?,entry: LocalV2PinEntry?,reply: LocalV2PinReply?,comparison: LocalV2PinComparison?
    var context: LAContext?,workerThread: ObjectIdentifier?,deliveryThread: ObjectIdentifier?,receipt: LocalV2StorageReceipt?
    var nativeInputThread: Thread?
    var closedKnown=false,closedKnownCandidate=false,closedRevoked=false,closedObservers=[NSObjectProtocol]()
    var busy: Bool { uiWorkers>0 || watchers>0 || cancels>0 || recipients>0 || settlements>0 || ownerWorkers>0 }
    var ownedPrompt: Bool { ownerWorkers==1 && context != nil && request.workers==1 && challenge.kind == .enroll
        && used && inputJoined && !cancelled && !request.cancelled && !request.retiring }
    init(_ owner: LocalV2PinOperations,_ request: LocalV2Request,_ challenge: LocalV2PinChallenge,_ locale: PinNativeInputLocale,_ iterations: UInt32) {
        self.owner=owner;self.request=request;self.challenge=challenge;self.locale=locale;self.iterations=iterations
    }
    // Called only under the original process monitor. Native cleanup callbacks
    // retain counted ownership and return before retirement releases capacity.
    func revokeLocked() {
        guard !cancelled else { return };cancelled=true;input?.revokeLocked()
        if let context { cancels+=1;Thread { [self] in
            context.invalidate();owner.writer.condition.lock();cancels-=1;owner.writer.condition.broadcast();owner.writer.condition.unlock()
        }.start() }
    }
}
fileprivate final class LocalV2PinEntry {
    let operation: LocalV2PinOperation,producer: LocalV2PinNativeInput?,first: PinPrimitiveInput,confirmation: PinPrimitiveInput?
    var consumed=false
    fileprivate init(_ operation: LocalV2PinOperation,_ producer: LocalV2PinNativeInput?,_ first: PinPrimitiveInput,_ confirmation: PinPrimitiveInput?) {
        self.operation=operation;self.producer=producer;self.first=first;self.confirmation=confirmation
    }
    func close() { first.close();confirmation?.close() }
    deinit { close() }
}
fileprivate final class LocalV2PinComparison {
    let operation: LocalV2PinOperation,reservation: LocalV2ChargedReservation,identity: PinVerifierIdentity,comparison: PinAttemptComparison
    let source: PinVerificationMathSource
    let charged: PinOwnedBytes
    var consumed=false
    fileprivate init(_ operation: LocalV2PinOperation,_ reservation: LocalV2ChargedReservation,_ result: PinVerificationMathResult,_ bytes: Data) {
        self.operation=operation;self.reservation=reservation;identity=result.identity;comparison=result.comparison;source=result.source;charged=PinOwnedBytes(bytes)
    }
    deinit { charged.close() }
}
fileprivate final class LocalV2PinEnrollment {
    let operation: LocalV2PinOperation,sample: LocalV2EnrollmentSample,key: PinOwnerKey,next: PinOwnedBytes,message: PinOwnedBytes,signature: PinOwnedBytes
    var consumed=false
    fileprivate init(_ operation: LocalV2PinOperation,_ sample: LocalV2EnrollmentSample,_ key: PinOwnerKey,_ next: Data,_ message: Data,_ signature: Data) {
        self.operation=operation;self.sample=sample;self.key=key;self.next=PinOwnedBytes(next);self.message=PinOwnedBytes(message);self.signature=PinOwnedBytes(signature)
    }
    func close() { next.close();message.close();signature.close() }
    deinit { close() }
}
fileprivate final class LocalV2PinReply {
    let operation: LocalV2PinOperation,receipt: LocalV2StorageReceipt,kind: LocalV2PinReplyKind
    var completed=false,settled=false,known=false,consumed=false
    fileprivate init(_ operation: LocalV2PinOperation,_ receipt: LocalV2StorageReceipt,_ kind: LocalV2PinReplyKind) {
        self.operation=operation;self.receipt=receipt;self.kind=kind
    }
}
/** A one-use exact original native completion, not a public boolean or Gate
 * capability. Enrollment completion cannot be consumed as a PIN match. */
fileprivate final class LocalV2PinCompletion {
    let original: LocalV2PinChallenge,receiptChecksum: String,receiptRevision: UInt64
    fileprivate init(_ reply: LocalV2PinReply) {
        original=reply.operation.challenge;receiptChecksum=reply.receipt.checksum;receiptRevision=reply.receipt.revision
    }
}
fileprivate extension PlanetChildVault.ProtectedEnvelope {
    static func localV2Verifier(_ snapshot: LocalSnapshotV2) throws -> PinVerifierMaterial {
        var p=try snapshot.copyProtectedBytes();defer { p.resetBytes(in:0..<p.count) }
        var raw=p.subdata(in:snapshot.fields.pinStart..<snapshot.fields.pinEnd);defer { raw.resetBytes(in:0..<raw.count) }
        let storage=Storage(raw);defer { storage.wipe() };let cursor=Cursor(storage)
        try cursor.field("schemaVersion",first:true);_ = try cursor.number(1,1)
        try cursor.field("policyVersion");try require(cursor.asciiString()==snapshot.policy.version)
        try cursor.field("revision");try require(cursor.number(1,9007199254740991)==snapshot.fields.pin.revision)
        try cursor.field("credentialId");try require(cursor.asciiString()==snapshot.fields.pin.credential)
        try cursor.field("verifier");try cursor.field("algorithm",first:true);try require(cursor.asciiString()=="PBKDF2-HMAC-SHA256")
        try cursor.field("iterations");let iterations=try cursor.number(600000,snapshot.policy.maximum)
        try require(iterations<=UInt64(UInt32.max));try cursor.field("saltHex");let saltRange=try cursor.hashRange()
        try cursor.field("hashHex");let hashRange=try cursor.hashRange();try cursor.token("}")
        let salt=try PinPrimitiveBytes(count:32),hash=try PinPrimitiveBytes(count:32);var accepted=false
        defer { if !accepted { salt.close();hash.close() } }
        func decode(_ range: Range<Int>,_ output: PinPrimitiveBytes) throws {
            try require(range.count==66)
            func nibble(_ byte: UInt8) -> UInt8 { byte<=57 ? byte-48:byte-87 }
            try output.write { target in for index in 0..<32 {
                let start=range.lowerBound+1+index*2;target[index]=(nibble(storage.byte(start))<<4)|nibble(storage.byte(start+1))
            } }
        }
        try decode(saltRange,salt);try decode(hashRange,hash)
        let identity=PinVerifierIdentity(recordChecksum:snapshot.checksum,recordRevision:snapshot.fields.revision,pinRevision:snapshot.fields.pin.revision,
            iterations:UInt32(iterations),policyVersion:snapshot.policy.version,policyChecksum:snapshot.policy.checksum)
        accepted=true;return PinVerifierMaterial(identity:identity,salt:salt,hash:hash)
    }
    static func localV2Context(_ snapshot: LocalSnapshotV2) throws -> (mode: String,profile: String?,profileRevision: UInt64,selectionRevision: UInt64) {
        var bytes=try snapshot.copyProtectedBytes();defer { bytes.resetBytes(in:0..<bytes.count) }
        let storage=Storage(bytes);defer { storage.wipe() };let p=Cursor(storage)
        try p.field("schemaVersion",first:true);_ = try p.number(2,2);try p.field("revision");_ = try p.number(1,9007199254740991)
        try p.field("mode");let mode=try p.asciiString();try p.field("selectionRevision");let selection=try p.number(1,9007199254740991)
        try p.field("profileRevision");let revision=try p.number(1,9007199254740991)
        try p.field("policyChecksum");try require(p.asciiString()==snapshot.policy.checksum)
        try p.field("registryChecksum");_ = try p.hashRange();try p.field("registry");let profile=try registry(p,version:snapshot.policy.version)
        return (mode,profile,revision,selection)
    }
}
fileprivate extension LocalSnapshotV2 {
    func finalizeComparedCandidate(_ comparison: PinAttemptComparison,_ logical: UInt64) throws -> LocalSnapshotV2 {
        let f=fields.pin
        guard f.pending != nil,fields.revision<Self.maximum,f.revision<Self.maximum,journal.revision<Self.maximum,
            logical>=f.observed,logical<=Self.maximum else { throw PinKnownRefusal() }
        let count=comparison == .match ? 0:f.count,delay=policy.delay(count)
        guard logical<=Self.maximum-delay else { throw PinKnownRefusal() }
        var p=try copyProtectedBytes();defer { p.resetBytes(in:0..<p.count) }
        var raw=p.subdata(in:fields.pinStart..<fields.pinEnd);defer { raw.resetBytes(in:0..<raw.count) }
        var pin=Data(raw.prefix(f.revisionStart));pin.append(Data(String(f.revision+1).utf8));pin.append(raw.subdata(in:f.revisionEnd..<f.attemptsStart))
        pin.append(Data("{\"count\":\(count),\"blockedUntilMs\":\(count==0 ? 0:logical+delay),\"lastObservedMs\":\(logical),\"pendingAttemptId\":null}}".utf8))
        defer { pin.resetBytes(in:0..<pin.count) }
        var next=Data(p.prefix(fields.revisionStart));next.append(Data(String(fields.revision+1).utf8));next.append(p.subdata(in:fields.revisionEnd..<fields.pinStart))
        next.append(pin);next.append(p.suffix(from:fields.pinEnd));defer { next.resetBytes(in:0..<next.count) }
        let changed=LocalV2PinFields(revision:f.revision+1,credential:f.credential,count:count,blocked:count==0 ? 0:logical+delay,observed:logical,pending:nil,
            revisionStart:0,revisionEnd:0,attemptsStart:0)
        let result=try Self.wrapper(next,policy:policy,rootRevision:fields.revision+1,journalRevision:journal.revision+1,pin:changed)
        do { try Self.validateFinalization(charged:self,next:result);return result } catch { result.close();throw error }
    }
}
fileprivate extension LocalV2Writer {
    static func pinRuntime(vault: PlanetChildVault,policy: LocalSnapshotV2Policy) throws -> LocalV2Writer { try LocalV2Writer(vault:vault,policy:policy) }
    func pinLifecycleWillRevokeLocked(_ request: LocalV2Request,name: Notification.Name) -> Bool {
        !(name==UIApplication.willResignActiveNotification && (request.pinOperation?.ownedPrompt == true || request.profileOperation?.ownedPrompt == true))
    }
    func closedPinReadback(_ operation: LocalV2PinOperation,reply: LocalV2PinReply) throws {
        let request=operation.request
        func fence(_ ns: UInt64) throws {
            condition.lock();defer { condition.unlock() }
            guard active==nil,request.owner === self,request.pinOperation === operation,request.retired,request.workers==0,!request.sealed,
                operation.closedKnown,!operation.closedRevoked,operation.reply === reply,reply.known,reply.settled,
                processClock.matches(policy),!processClock.invalidated,request.process==getpid(),
                let binding=processClock.known,binding.checksum==reply.receipt.checksum,binding.rootRevision==reply.receipt.revision else { throw PinKnownRefusal() }
            try processClock.observe(ns)
            guard ns>=request.last,ns>=request.began,ns<request.deadline else { throw PinKnownRefusal() };request.last=ns
        }
        func sample() throws -> UInt64 {
            do { return try clock.nanoseconds() } catch { condition.lock();processClock.poisonClosed(operation);condition.unlock();throw error }
        }
        try fence(sample());try request.host?.localV2Current(ownedInput:nil,ownedPrompt:false)
        do { try storage.locked { transaction in
            var actual=try transaction.read();defer { actual.resetBytes(in:0..<actual.count) }
            condition.lock();let binding=processClock.known;condition.unlock()
            guard let binding else { throw PinKnownRefusal() };var expected=try binding.bytes.copy();defer { expected.resetBytes(in:0..<expected.count) }
            guard actual==expected,LocalSnapshotV2.hash(actual)==reply.receipt.checksum else { throw PlanetChildVault.Failure.unavailable }
            try fence(sample())
        } } catch {
            condition.lock();operation.closedKnown=false;operation.closedRevoked=true
            processClock.poisonClosed(operation);condition.unlock();throw error
        }
        try request.host?.localV2Current(ownedInput:nil,ownedPrompt:false);try fence(sample())
    }
    func pinFence(_ operation: LocalV2PinOperation,readback: Bool=false) throws {
        let request=operation.request;_ = try current(request)
        condition.lock();let valid=active === request && request.pinOperation === operation && operation.owner.writer === self
            && !operation.cancelled && operation.challenge.deadlineNs==request.deadline && operation.challenge.kind == (operation.challenge.gate==nil ? .enroll:.verify)
        condition.unlock();guard valid else { throw PinKnownRefusal() }
        if readback { try storage.locked { transaction in
            var bytes=try exact(transaction,request);defer { bytes.resetBytes(in:0..<bytes.count) };_ = try local(request)
        } }
        _ = try current(request)
    }
    func pinWorker(_ operation: LocalV2PinOperation) throws {
        try start(operation.request,opened:true)
        do { try pinFence(operation,readback:true) } catch { finish(operation.request);throw error }
    }
    func finalize(_ operation: LocalV2PinOperation,comparison: LocalV2PinComparison,recipient: (LocalV2StorageReceipt) throws -> Void) throws {
        let request=operation.request
        condition.lock()
        guard request.pinOperation === operation,operation.comparison === comparison,comparison.operation === operation,!comparison.consumed,
            comparison.source==operation.owner.mathSource,
            request.reservation === comparison.reservation,request.receipt?.known==true,request.receipt?.settled==true,request.receipt?.charged==true,
            request.workers==0,!operation.cancelled else { condition.unlock();throw PinKnownRefusal() }
        comparison.consumed=true;condition.unlock();try start(request,opened:true);defer { finish(request) };var publication=false
        do {
            try pinFence(operation,readback:true)
            var result: LocalSnapshotV2?,after=Data();defer { result?.close();after.resetBytes(in:0..<after.count) }
            try storage.locked { transaction in
                var actual=try exact(transaction,request),charged=try comparison.charged.copy(),reserved=try comparison.reservation.charged.copy()
                defer { actual.resetBytes(in:0..<actual.count);charged.resetBytes(in:0..<charged.count);reserved.resetBytes(in:0..<reserved.count) }
                guard actual==charged,actual==reserved,LocalSnapshotV2.hash(actual)==comparison.identity.recordChecksum,
                    comparison.reservation.attemptId==request.reservation?.attemptId else { throw PinKnownRefusal() }
                let old=try LocalSnapshotV2.decode(actual,policy:policy);defer { old.close() }
                guard old.fields.revision==comparison.identity.recordRevision,old.fields.pin.revision==comparison.identity.pinRevision,
                    old.fields.pin.pending==comparison.reservation.attemptId,comparison.identity.policyVersion==policy.version,
                    comparison.identity.policyChecksum==policy.checksum else { throw PinKnownRefusal() }
                let now=try local(request);condition.lock();let logical: UInt64
                do { logical=try processClock.logical(now);condition.unlock() } catch { condition.unlock();throw error }
                let next=try old.finalizeComparedCandidate(comparison.comparison,logical);result=next;after=try next.copyCanonicalBytes()
                publication=true;condition.lock();request.mutationUnacknowledged=true;condition.unlock();try write(transaction,request,actual,after)
                condition.lock()
                do { try processClock.stage(request,after,next);request.expected?.close();request.expected=PinOwnedBytes(after);condition.unlock() }
                catch { condition.unlock();throw error };publication=false
            }
            guard let result else { throw PlanetChildVault.Failure.unavailable };try pinFence(operation);try publish(request,result,after,true,recipient)
        } catch { fail(request,error,publication:publication);throw error }
    }
    func enroll(_ operation: LocalV2PinOperation,material: LocalV2PinEnrollment,recipient: (LocalV2StorageReceipt) throws -> Void) throws {
        let request=operation.request
        condition.lock();let valid=request.pinOperation === operation && material.operation === operation && operation.challenge.kind == .enroll
            && request.sample === material.sample && !material.consumed && operation.inputJoined && !operation.cancelled && operation.ownerWorkers==0
        if valid { material.consumed=true };condition.unlock();guard valid else { throw PinKnownRefusal() }
        try pinFence(operation,readback:true);try operation.owner.verifyEnrollment(material)
        var bytes=try material.next.copy();defer { bytes.resetBytes(in:0..<bytes.count) }
        try commitEnrollment(request,sample:material.sample,next:bytes,permission:{ try operation.owner.verifyEnrollment(material,storageLocked:true) },recipient:recipient)
    }
}
fileprivate extension LocalV2ProcessClock {
    func poisonClosed(_ operation: LocalV2PinOperation) {
        guard operation.request.retired,operation.request.owner.processClock === self,active==nil,preparingOwner==nil,
            known?.checksum==operation.receipt?.checksum else { return };poison()
    }
}
fileprivate final class LocalV2PinOperations {
    let writer: LocalV2Writer
    private let keys: PinOwnerKeys,engine: PinPrimitiveEngine,verificationEngine: PinVerificationEngine?,iterations: UInt32,synthetic: Bool
    fileprivate var mathSource: PinVerificationMathSource { synthetic ? .synthetic:.platform }

    // Private construction only. Nothing selects this from the bridge/App.
    fileprivate init(vault: PlanetChildVault,policy: LocalSnapshotV2Policy,iterations: UInt32) throws {
        guard iterations>=600000,UInt64(iterations)<=policy.maximum else { throw PinKnownRefusal() }
        writer=try LocalV2Writer.pinRuntime(vault:vault,policy:policy);keys=ApplePinOwnerKeys();engine=ApplePinPrimitiveEngine();verificationEngine=nil
        self.iterations=iterations;synthetic=false
    }
    #if DEBUG
    fileprivate init(fixtureWriter: LocalV2Writer,keys: PinOwnerKeys,engine: PinPrimitiveEngine,verificationEngine: PinVerificationEngine,iterations: UInt32=600000) throws {
        guard keys.source == .synthetic,iterations>=600000,UInt64(iterations)<=fixtureWriter.policy.maximum else { throw PinKnownRefusal() }
        writer=fixtureWriter;self.keys=keys;self.engine=engine;self.verificationEngine=verificationEngine;self.iterations=iterations;synthetic=true
    }
    #endif
    private static func hex(_ value: String) -> Bool { value.utf8.count==64 && value.utf8.allSatisfy { $0>=48 && $0<=57 || $0>=97 && $0<=102 } }
    private func bind(_ request: LocalV2Request,_ challenge: LocalV2PinChallenge,_ locale: PinNativeInputLocale) throws -> LocalV2PinOperation {
        guard Self.hex(challenge.id),Self.hex(challenge.target),challenge.generation<=9007199254740991,challenge.deadlineNs==request.deadline,
            challenge.kind == .enroll ? challenge.gate==nil && challenge.action=="enroll-local-pin":challenge.gate != nil && PinVerificationActionCopy.caption(challenge.action,locale:locale) != nil
            else { throw PinKnownRefusal() }
        if let gate=challenge.gate {
            guard gate.originalHostChallenge === challenge.original,gate.id==challenge.id,gate.action==challenge.action,gate.targetChecksum==challenge.target,
                gate.generation==challenge.generation,gate.context.visibility=="active",gate.context.mode=="child",gate.context.policyVersion==writer.policy.version,
                gate.deadlineUptimeMs<=UInt64.max/1000000,gate.deadlineUptimeMs*1000000==request.deadline else { throw PinKnownRefusal() }
        }
        writer.condition.lock();defer { writer.condition.unlock() }
        let identity=ObjectIdentifier(challenge.original)
        guard writer.active === request,request.pinOperation==nil,writer.processClock.pinUsedIds.count<2048,!writer.processClock.pinUsedIds.contains(challenge.id),writer.processClock.pinUsedChallenges[identity]==nil else { throw PinKnownRefusal() }
        writer.processClock.pinUsedIds.insert(challenge.id);writer.processClock.pinUsedChallenges[identity]=challenge.original
        let operation=LocalV2PinOperation(self,request,challenge,locale,iterations);request.pinOperation=operation;return operation
    }
    func begin(_ challenge: LocalV2PinChallenge,host: UIViewController,locale: PinNativeInputLocale) throws -> LocalV2PinOperation {
        guard !synthetic,Thread.isMainThread else { throw PinKnownRefusal() }
        let request=try writer.request(host:host,timeoutMs:60000,originalDeadlineNs:challenge.deadlineNs)
        do { return try bind(request,challenge,locale) } catch {
            writer.cancel(request);Thread { [writer] in try? writer.retire(request) }.start();throw error
        }
    }
    func open(_ operation: LocalV2PinOperation) throws {
        let request=operation.request;guard operation.owner === self else { throw PinKnownRefusal() }
        if let receipt=try writer.open(request) { try writer.settle(receipt,known:true) }
        try writer.pinWorker(operation);defer { writer.finish(request) }
        var bytes=try request.expected!.copy();defer { bytes.resetBytes(in:0..<bytes.count) }
        let c=operation.challenge
        if c.kind == .enroll {
            _ = try PlanetChildVault.LocalEmptySeedV2.validate(bytes,policyVersion:writer.policy.version,policyChecksum:writer.policy.checksum)
            guard c.target==LocalSnapshotV2.hash(bytes),c.rootRevision==1,c.profileRevision==1,c.selectionRevision==1 else { throw PinKnownRefusal() }
        } else {
            let snapshot=try LocalSnapshotV2.decode(bytes,policy:writer.policy);defer { snapshot.close() }
            let scope=try PlanetChildVault.ProtectedEnvelope.localV2Context(snapshot)
            guard let gate=c.gate,snapshot.fields.revision==c.rootRevision,scope.mode==gate.context.mode,scope.profile==gate.context.profileId,
                scope.profileRevision==c.profileRevision,scope.selectionRevision==c.selectionRevision else { throw PinKnownRefusal() }
            // A currently blocked attempt is refused before opening its keypad.
            let now=try writer.current(request);writer.condition.lock();let logical: UInt64
            do { logical=try writer.processClock.logical(now);writer.condition.unlock() } catch { writer.condition.unlock();throw error }
            guard logical>=snapshot.fields.pin.blocked else { throw PinVerificationRefusal(blocked:true) }
        }
        try writer.pinFence(operation,readback:true);writer.condition.lock();operation.opened=true;writer.condition.unlock()
    }
    func input(_ operation: LocalV2PinOperation,host: UIViewController,recipient: @escaping (Result<LocalV2PinReply,Error>) throws -> Void) throws -> LocalV2PinNativeInput {
        guard !synthetic,Thread.isMainThread,operation.owner === self else { throw PinKnownRefusal() }
        try writer.pinFence(operation);let input=try LocalV2PinNativeInput(operation,host,recipient)
        writer.condition.lock()
        guard operation.opened,operation.input==nil,!operation.used,!operation.cancelled,operation.request.workers==0 else { writer.condition.unlock();throw PinKnownRefusal() }
        operation.input=input;operation.uiWorkers=1;writer.condition.unlock()
        do { try input.start();return input } catch { writer.cancel(operation.request);throw error }
    }
    fileprivate func process(_ operation: LocalV2PinOperation,entry: LocalV2PinEntry) throws -> LocalV2PinReply {
        guard !Thread.isMainThread,operation.owner === self else { throw PinKnownRefusal() }
        writer.condition.lock()
        guard operation.opened,!operation.used,operation.entry === entry,entry.operation === operation,!entry.consumed,operation.inputJoined,
            !operation.cancelled,(synthetic && entry.producer==nil || entry.producer === operation.input) else { writer.condition.unlock();throw PinKnownRefusal() }
        operation.used=true;entry.consumed=true;operation.workerThread=ObjectIdentifier(Thread.current);writer.condition.unlock()
        defer { entry.close();writer.condition.lock();operation.workerThread=nil;writer.condition.broadcast();writer.condition.unlock() }
        try writer.pinFence(operation,readback:true)
        let receipt: LocalV2StorageReceipt,kind: LocalV2PinReplyKind
        if operation.challenge.kind == .enroll {
            let sample=try writer.sampleEnrollment(operation.request)
            let material=try produceEnrollment(operation,sample,entry);defer { material.close() };var captured: LocalV2StorageReceipt?
            try writer.enroll(operation,material:material) { captured=$0 };guard let captured else { throw PlanetChildVault.Failure.unavailable }
            receipt=captured;kind = .enrolled
        } else {
            // Nonempty input was obtained before charge; no grammar/KDF occurs
            // before this exact full-record durable write and original ACK.
            var charged: LocalV2StorageReceipt?
            try writer.charge(operation.request) { charged=$0 };guard let charged else { throw PlanetChildVault.Failure.unavailable }
            try writer.settle(charged,known:true)
            let comparison=try produceComparison(operation,entry)
            writer.condition.lock();operation.comparison=comparison;writer.condition.unlock();var captured: LocalV2StorageReceipt?
            try writer.finalize(operation,comparison:comparison) { captured=$0 };guard let captured else { throw PlanetChildVault.Failure.unavailable }
            receipt=captured;kind=comparison.comparison == .match ? .match:.mismatch
        }
        try writer.settle(receipt,known:true);try writer.pinFence(operation,readback:true)
        let reply=LocalV2PinReply(operation,receipt,kind);writer.condition.lock()
        guard !operation.cancelled,operation.reply==nil else { writer.condition.unlock();throw PinKnownRefusal() }
        operation.receipt=receipt;operation.reply=reply;writer.condition.unlock();return reply
    }
    private func produceComparison(_ operation: LocalV2PinOperation,_ entry: LocalV2PinEntry) throws -> LocalV2PinComparison {
        try writer.pinWorker(operation);defer { writer.finish(operation.request) }
        guard let reservation=operation.request.reservation else { throw PinKnownRefusal() }
        var charged=try reservation.charged.copy();defer { charged.resetBytes(in:0..<charged.count) }
        let snapshot=try LocalSnapshotV2.decode(charged,policy:writer.policy);defer { snapshot.close() }
        let verifier=try PlanetChildVault.ProtectedEnvelope.localV2Verifier(snapshot);defer { verifier.close() }
        let math=verificationEngine.map { PinVerificationMath.syntheticFixture($0) } ?? PinVerificationMath();defer { math.close() }
        let result=try math.compare(verifier,input:entry.first) { identity in
            guard identity.recordChecksum==snapshot.checksum,identity.recordRevision==snapshot.fields.revision,
                identity.pinRevision==snapshot.fields.pin.revision,operation.request.reservation === reservation,
                operation.request.receipt?.known==true,operation.request.receipt?.settled==true else { throw PinKnownRefusal() }
            try self.writer.pinFence(operation,readback:true)
        }
        guard result.source == (synthetic ? .synthetic:.platform) else { throw PinKnownRefusal() }
        try writer.pinFence(operation,readback:true);return LocalV2PinComparison(operation,reservation,result,charged)
    }
    private func hex(_ bytes: PinPrimitiveBytes) throws -> String { try bytes.read { $0.map { String(format:"%02x",$0) }.joined() } }
    private func enrollmentBytes(_ sample: LocalV2EnrollmentSample,_ salt: PinPrimitiveBytes,_ credential: PinPrimitiveBytes,_ hash: PinPrimitiveBytes,_ iterations: UInt32) throws -> Data {
        let policy=writer.policy,logical=sample.logicalMs,id=try hex(credential)
        let pin="{\"schemaVersion\":1,\"policyVersion\":\"\(policy.version)\",\"revision\":1,\"credentialId\":\"\(id)\",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":\(iterations),\"saltHex\":\"\(try hex(salt))\",\"hashHex\":\"\(try hex(hash))\"},\"attempts\":{\"count\":0,\"blockedUntilMs\":0,\"lastObservedMs\":\(logical),\"pendingAttemptId\":null}}"
        var seed=try sample.seed.copy();defer { seed.resetBytes(in:0..<seed.count) }
        let marker=Data("\"pin\":null".utf8),prefix=Data("{\"schemaVersion\":2,\"revision\":1".utf8)
        guard seed.starts(with:prefix),let range=seed.range(of:marker) else { throw PinKnownRefusal() }
        var p=Data("{\"schemaVersion\":2,\"revision\":2".utf8);p.append(seed.subdata(in:prefix.count..<range.lowerBound));p.append(Data("\"pin\":\(pin)".utf8));p.append(seed.suffix(from:range.upperBound))
        defer { p.resetBytes(in:0..<p.count) }
        let fields=LocalV2PinFields(revision:1,credential:id,count:0,blocked:0,observed:logical,pending:nil,revisionStart:0,revisionEnd:0,attemptsStart:0)
        let next=try LocalSnapshotV2.wrapper(p,policy:policy,rootRevision:2,journalRevision:1,pin:fields);defer { next.close() }
        try LocalSnapshotV2.validateEnrollment(seed:seed,next:next,logical:logical,policy:policy);return try next.copyCanonicalBytes()
    }
    private func ownerMessage(_ operation: LocalV2PinOperation,_ sample: LocalV2EnrollmentSample,_ next: Data,_ key: PinOwnerKey) -> Data {
        let c=operation.challenge,p=writer.policy
        let fields=["literary-planet/local-pin-operation/v2",c.id,c.action,c.target,String(ObjectIdentifier(c.original).hashValue),String(operation.request.process),String(c.generation),String(c.deadlineNs),String(operation.request.began),
            String(c.rootRevision),String(c.profileRevision),String(c.selectionRevision),sample.checksum,String(sample.logicalMs),LocalSnapshotV2.hash(next),
            p.version,p.checksum,String(p.maximum),p.delays.map(String.init).joined(separator:","),String(operation.iterations),operation.locale == .ru ? "ru":"en",LocalSnapshotV2.hash(key.publicBytes)]
        return Data(fields.map { "\($0.utf8.count):\($0)" }.joined().utf8)
    }
    private func produceEnrollment(_ operation: LocalV2PinOperation,_ sample: LocalV2EnrollmentSample,_ entry: LocalV2PinEntry) throws -> LocalV2PinEnrollment {
        try writer.pinWorker(operation);defer { writer.finish(operation.request) }
        guard let confirmation=entry.confirmation else { throw PinKnownRefusal() }
        let first=try entry.first.take(),second=try confirmation.take();defer { first.close();second.close() }
        let valid=try first.read { $0.count>=4 && $0.count<=128 && $0.allSatisfy { $0>=48 && $0<=57 } }
        guard valid,try first.equals(second) else { throw PinKnownRefusal() }
        let frozen=try first.independentCopy(),salt=try PinPrimitiveBytes(count:32),credential=try PinPrimitiveBytes(count:32),hash=try PinPrimitiveBytes(count:32)
        defer { frozen.close();salt.close();credential.close();hash.close() }
        try salt.write { try engine.random($0) };try credential.write { try engine.random($0) };try writer.pinFence(operation,readback:true)
        let frozenSalt=try salt.independentCopy(),frozenCredential=try credential.independentCopy();defer { frozenSalt.close();frozenCredential.close() }
        let began=try writer.current(operation.request)
        try first.read { pin in try salt.read { salt in try hash.write { output in try engine.derive(pin:pin,salt:salt,iterations:operation.iterations,output:output) } } }
        let ended=try writer.current(operation.request)
        guard ended>=began,ended-began<=5000000000,try first.equals(frozen),try salt.equals(frozenSalt),try credential.equals(frozenCredential) else { throw PinKnownRefusal() }
        var next=try enrollmentBytes(sample,salt,credential,hash,operation.iterations);defer { next.resetBytes(in:0..<next.count) }
        let context=LAContext();context.touchIDAuthenticationAllowableReuseDuration=0
        writer.condition.lock();guard !operation.cancelled else { writer.condition.unlock();context.invalidate();throw PinKnownRefusal() }
        operation.context=context;operation.ownerWorkers=1;writer.condition.unlock()
        defer { context.invalidate();writer.condition.lock();operation.context=nil;operation.ownerWorkers=0;writer.condition.broadcast();writer.condition.unlock() }
        let prompt=operation.locale == .ru ? "Подтвердите создание родительского PIN кодом блокировки устройства.":"Confirm Parent PIN setup using your device screen lock."
        let key=try keys.acquire(enroll:true,context:context,prompt:prompt);try writer.pinFence(operation,readback:true)
        var message=ownerMessage(operation,sample,next,key),signature=try keys.sign(key,message:message)
        defer { message.resetBytes(in:0..<message.count);signature.resetBytes(in:0..<signature.count) }
        try writer.pinFence(operation,readback:true);try keys.current(key)
        var error: Unmanaged<CFError>?
        guard key.source==keys.source,SecKeyVerifySignature(key.publicKey,.ecdsaSignatureMessageX962SHA256,message as CFData,signature as CFData,&error) else { throw PinKnownRefusal() }
        return LocalV2PinEnrollment(operation,sample,key,next,message,signature)
    }
    fileprivate func verifyEnrollment(_ material: LocalV2PinEnrollment,storageLocked: Bool=false) throws {
        let operation=material.operation;try keys.current(material.key);try writer.pinFence(operation,readback:!storageLocked)
        var next=try material.next.copy(),message=try material.message.copy(),signature=try material.signature.copy()
        defer { next.resetBytes(in:0..<next.count);message.resetBytes(in:0..<message.count);signature.resetBytes(in:0..<signature.count) }
        var error: Unmanaged<CFError>?
        guard operation.owner === self,material.key.source==keys.source,message==ownerMessage(operation,material.sample,next,material.key),
            SecKeyVerifySignature(material.key.publicKey,.ecdsaSignatureMessageX962SHA256,message as CFData,signature as CFData,&error) else { throw PinKnownRefusal() }
        try writer.pinFence(operation,readback:!storageLocked)
    }
    fileprivate func deliver(_ operation: LocalV2PinOperation,_ reply: LocalV2PinReply,recipient: (Result<LocalV2PinReply,Error>) throws -> Void) throws {
        writer.condition.lock();guard operation.reply === reply,!reply.completed,!reply.settled else { writer.condition.unlock();throw PinKnownRefusal() }
        operation.recipients+=1;operation.deliveryThread=ObjectIdentifier(Thread.current);writer.condition.unlock()
        defer { writer.condition.lock();operation.recipients-=1;operation.deliveryThread=nil;writer.condition.broadcast();writer.condition.unlock() }
        do { try writer.pinFence(operation,readback:true);try recipient(.success(reply));try writer.pinFence(operation,readback:true)
            writer.condition.lock();reply.completed=true;writer.condition.unlock()
        } catch { writer.cancel(operation.request);throw error }
    }
    func settle(_ reply: LocalV2PinReply,known: Bool) throws {
        let operation=reply.operation,request=operation.request
        guard !Thread.isMainThread,operation.owner === self else { throw PinKnownRefusal() }
        writer.condition.lock()
        guard request.pinOperation === operation,operation.reply === reply,!reply.settled,!operation.busy,request.workers==0,
            !known || reply.completed && !operation.cancelled && operation.inputJoined && operation.receipt === reply.receipt && reply.receipt.known && reply.receipt.settled
            else { writer.condition.unlock();throw PinKnownRefusal() }
        if !known { reply.settled=true;reply.consumed=true;operation.cancelled=true;writer.condition.broadcast();writer.condition.unlock();writer.cancel(request);return }
        operation.settlements=1;writer.condition.unlock()
        defer { writer.condition.lock();operation.settlements=0;writer.condition.broadcast();writer.condition.unlock() }
        try writer.pinWorker(operation);defer { writer.finish(request) };try writer.pinFence(operation,readback:true)
        writer.condition.lock();defer { writer.condition.unlock() }
        guard !operation.cancelled,request.pinOperation === operation,!reply.settled,!request.retiring else { throw PinKnownRefusal() }
        reply.settled=true;reply.known=true;writer.condition.broadcast()
    }
    func consumeMatch(_ reply: LocalV2PinReply,original: LocalV2PinChallenge) throws -> LocalV2PinCompletion {
        let operation=reply.operation
        guard !Thread.isMainThread,operation.owner === self else { throw PinKnownRefusal() }
        writer.condition.lock()
        guard operation.reply === reply,operation.challenge === original,reply.kind == .match,original.kind == .verify,
            reply.completed,reply.settled,reply.known,!reply.consumed,!operation.busy,operation.request.workers==0,
            operation.request.retired,operation.closedKnown,!operation.closedRevoked,!operation.request.sealed
            else { writer.condition.unlock();throw PinKnownRefusal() }
        reply.consumed=true;operation.settlements=1;writer.condition.unlock()
        defer {
            writer.condition.lock();operation.settlements=0;operation.entry=nil;operation.comparison=nil;operation.input=nil
            operation.reply=nil;operation.request.pinOperation=nil;writer.condition.broadcast();writer.condition.unlock();removeClosedObservers(operation)
        }
        try writer.closedPinReadback(operation,reply:reply)
        writer.condition.lock();defer { writer.condition.unlock() }
        guard operation.closedKnown,!operation.closedRevoked,!writer.processClock.invalidated,operation.request.retired else { throw PinKnownRefusal() }
        return LocalV2PinCompletion(reply)
    }
    func retire(_ operation: LocalV2PinOperation) throws {
        guard !Thread.isMainThread,operation.owner === self,operation.workerThread != ObjectIdentifier(Thread.current),operation.deliveryThread != ObjectIdentifier(Thread.current) else { throw PinKnownRefusal() }
        writer.condition.lock();let known=operation.reply?.known==true && operation.reply?.settled==true && !operation.cancelled;writer.condition.unlock()
        if known,!synthetic {
            DispatchQueue.main.sync { [self] in
                let center=NotificationCenter.default
                for name in [UIApplication.willResignActiveNotification,UIApplication.didEnterBackgroundNotification,UIScene.didDisconnectNotification] {
                    let observer=center.addObserver(forName:name,object:nil,queue:nil) { [weak operation] note in
                        guard let operation,name != UIScene.didDisconnectNotification || operation.request.host?.disconnected(note)==true else { return }
                        self.writer.condition.lock();operation.closedRevoked=true;operation.closedKnown=false;self.writer.condition.broadcast();self.writer.condition.unlock()
                    }
                    writer.condition.lock();operation.closedObservers.append(observer);writer.condition.unlock()
                }
            }
        }
        do { try writer.retire(operation.request)
            writer.condition.lock();operation.closedKnown=operation.closedKnownCandidate && !operation.closedRevoked && !writer.processClock.invalidated
            operation.entry=nil;operation.comparison=nil;operation.input=nil
            let retain=operation.closedKnown && operation.reply?.kind == .match
            if !retain { operation.reply=nil;operation.request.pinOperation=nil };writer.condition.unlock()
            if !retain { removeClosedObservers(operation) }
        } catch {
            writer.condition.lock();if operation.request.retired { operation.entry=nil;operation.comparison=nil;operation.input=nil;operation.reply=nil;operation.request.pinOperation=nil };writer.condition.unlock()
            removeClosedObservers(operation);throw error
        }
        if !known { removeClosedObservers(operation) }
    }
    fileprivate func removeClosedObservers(_ operation: LocalV2PinOperation) {
        writer.condition.lock();let observers=operation.closedObservers;operation.closedObservers.removeAll();writer.condition.unlock()
        DispatchQueue.main.sync { for observer in observers { NotificationCenter.default.removeObserver(observer) } }
    }
    fileprivate func closeInternalUnknown(_ operation: LocalV2PinOperation) {
        // These storage receipts were delivered only to the synchronous private
        // coordinator. On its joined failure, actual uncertain ACK closes them.
        // An externally exposed terminal reply still needs its original ACK.
        writer.condition.lock();let receipt=operation.reply==nil ? operation.request.receipt:nil;writer.condition.unlock()
        if let receipt,!receipt.settled { try? writer.settle(receipt,known:false) }
    }
}

/** Same native keypad/digit-buffer implementation as v1. Input ownership,
 * dismiss/clear, actual watchdog, callback, cancel and synchronous KDF joins
 * all belong to the original V2 operation and absolute deadline. */
fileprivate final class LocalV2PinNativeInput {
    let operation: LocalV2PinOperation
    private weak var host: UIViewController?
    fileprivate var controller: LocalV2PinViewController?
    private let digits: PinNativeDigitBuffer,recipient: (Result<LocalV2PinReply,Error>) throws -> Void
    private var first: PinPrimitiveInput?,started=false,closing=false,finished=false,confirming=false
    init(_ operation: LocalV2PinOperation,_ host: UIViewController,_ recipient: @escaping (Result<LocalV2PinReply,Error>) throws -> Void) throws {
        self.operation=operation;self.host=host;self.recipient=recipient;digits=try PinNativeDigitBuffer(maximum:128)
    }
    func start() throws {
        guard Thread.isMainThread,let host,!started else { throw PinKnownRefusal() };started=true
        let writer=operation.owner.writer;writer.condition.lock();operation.watchers=1;writer.condition.unlock()
        let view=LocalV2PinViewController(owner:self,locale:operation.locale,action:operation.challenge.action,minimum:operation.challenge.kind == .enroll ? 4:1)
        view.modalPresentationStyle = .fullScreen;view.isModalInPresentation=true;controller=view
        host.present(view,animated:false) { [self] in
            do { try operation.owner.writer.pinFence(operation) } catch { cancel() }
        }
        Thread { [self] in
            defer { writer.condition.lock();operation.watchers=0;writer.condition.broadcast();writer.condition.unlock() }
            while true {
                writer.condition.lock();let stop=closing || finished || operation.cancelled
                if !stop { _ = writer.condition.wait(until:Date(timeIntervalSinceNow:0.05)) };writer.condition.unlock()
                if stop { return }
                do { try writer.pinFence(operation) } catch { writer.cancel(operation.request);return }
            }
        }.start()
    }
    func tapDigit(_ digit: UInt8) {
        guard Thread.isMainThread,!closing else { return }
        do { try operation.owner.writer.pinFence(operation);try digits.append(digit);controller?.update(count:digits.count) } catch { cancel() }
    }
    func deleteDigit() {
        guard Thread.isMainThread,!closing else { return }
        do { try operation.owner.writer.pinFence(operation);try digits.removeLast();controller?.update(count:digits.count) } catch { cancel() }
    }
    func submit() {
        guard Thread.isMainThread,!closing else { return }
        do {
            try operation.owner.writer.pinFence(operation)
            let input=try digits.move(minimum:operation.challenge.kind == .enroll ? 4:1)
            if operation.challenge.kind == .enroll,!confirming { first=input;confirming=true;controller?.confirmEntry();return }
            let original=operation.challenge.kind == .enroll ? first:input
            guard let original else { input.close();throw PinKnownRefusal() };first=nil
            let entry=LocalV2PinEntry(operation,self,original,operation.challenge.kind == .enroll ? input:nil)
            operation.owner.writer.condition.lock()
            guard !closing,!operation.cancelled else { operation.owner.writer.condition.unlock();entry.close();throw PinKnownRefusal() }
            closing=true;operation.owner.writer.condition.broadcast();operation.owner.writer.condition.unlock();controller?.disableAndClear()
            let nativeWorker=Thread { [self] in run(entry) };let condition=operation.owner.writer.condition
            condition.lock();operation.nativeInputThread=nativeWorker;condition.unlock();nativeWorker.start()
        } catch { cancel() }
    }
    func disappeared() { if !closing { cancel() } }
    func cancel() { operation.owner.writer.cancel(operation.request) }
    fileprivate func revokeLocked() {
        guard !closing else { return };closing=true;operation.owner.writer.condition.broadcast()
        let nativeWorker=Thread { [self] in run(nil) };operation.nativeInputThread=nativeWorker;nativeWorker.start()
    }
    private func run(_ entry: LocalV2PinEntry?) {
        let writer=operation.owner.writer
        writer.condition.lock();while operation.watchers>0 { writer.condition.wait() };writer.condition.unlock()
        // A real UIKit dismissal completion, not async scheduling or a timeout,
        // is the input boundary. The retained uiWorker joins through callbacks.
        let dismissed=DispatchSemaphore(value:0)
        DispatchQueue.main.async { [self] in
            digits.clear();first?.close();first=nil
            if let view=controller { view.detach();view.dismiss(animated:false) { [self] in controller=nil;dismissed.signal() } }
            else { dismissed.signal() }
        }
        dismissed.wait()
        writer.condition.lock()
        operation.inputJoined=true;if let entry { operation.entry=entry };writer.condition.unlock()
        var success=false
        do {
            guard let entry else { throw PinNativeInputFailure.cancelled }
            let reply=try operation.owner.process(operation,entry:entry)
            try operation.owner.deliver(operation,reply,recipient:recipient);success=true
        } catch {
            entry?.close()
            operation.owner.closeInternalUnknown(operation)
            if operation.reply==nil {
                writer.condition.lock();operation.recipients+=1;operation.deliveryThread=ObjectIdentifier(Thread.current);writer.condition.unlock()
                do { try recipient(.failure(error)) } catch { writer.cancel(operation.request) }
                writer.condition.lock();operation.recipients-=1;operation.deliveryThread=nil;writer.condition.broadcast();writer.condition.unlock()
            }
            writer.cancel(operation.request)
        }
        writer.condition.lock();finished=true;operation.uiWorkers=0;operation.entry=nil;operation.input=nil
        if !success { operation.cancelled=true };writer.condition.broadcast();writer.condition.unlock()
    }
}

fileprivate extension PinOwnerOriginalHost {
    func localV2Current(ownedInput: UIViewController?,ownedPrompt: Bool) throws {
        let check: () -> Bool = { [self] in
            guard let host,let window,let scene,let root else { return false }
            let originalWindow=host.viewIfLoaded?.window === window
            let ownedWindow=ownedInput?.presentingViewController === host && ownedInput?.viewIfLoaded?.window === window
            return (originalWindow || ownedWindow) && window.windowScene === scene && window.rootViewController === root
                && !window.isHidden && !host.isBeingDismissed
                && (ownedInput == nil ? host.presentedViewController==nil:host.presentedViewController === ownedInput)
                && (scene.activationState == .foregroundActive || ownedPrompt && scene.activationState == .foregroundInactive)
                && (UIApplication.shared.applicationState == .active || ownedPrompt && UIApplication.shared.applicationState == .inactive)
        }
        guard (Thread.isMainThread ? check():DispatchQueue.main.sync(execute:check)) else { throw PinKnownRefusal() }
    }
}

fileprivate final class LocalV2PinViewController: UIViewController {
    private weak var owner: LocalV2PinNativeInput?
    private let locale: PinNativeInputLocale, action: String
    private let minimum: Int
    private let titleLabel=UILabel(), actionLabel=UILabel(), countLabel=UILabel(), hintLabel=UILabel()
    private let continueButton=UIButton(type:.system)
    private var inputButtons=[UIButton]()
    init(owner: LocalV2PinNativeInput,locale: PinNativeInputLocale,action: String,minimum: Int=1) {
        self.owner=owner; self.locale=locale; self.action=action;self.minimum=minimum; super.init(nibName:nil,bundle:nil)
    }
    required init?(coder: NSCoder) { return nil }
    private func text(_ ru: String,_ en: String) -> String { locale == .ru ? ru:en }
    override func viewDidLoad() {
        super.viewDidLoad()
        let navy=UIColor(red:0.025,green:0.06,blue:0.12,alpha:1), gold=UIColor(red:0.84,green:0.72,blue:0.46,alpha:1)
        view.backgroundColor=navy; view.tintColor=gold; view.accessibilityViewIsModal=true
        let scroll=UIScrollView(), stack=UIStackView(); scroll.translatesAutoresizingMaskIntoConstraints=false
        stack.translatesAutoresizingMaskIntoConstraints=false; stack.axis = .vertical; stack.spacing=16
        view.addSubview(scroll); scroll.addSubview(stack)
        NSLayoutConstraint.activate([
            scroll.leadingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.trailingAnchor),
            scroll.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),
            scroll.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo:scroll.contentLayoutGuide.leadingAnchor,constant:24),
            stack.trailingAnchor.constraint(equalTo:scroll.contentLayoutGuide.trailingAnchor,constant:-24),
            stack.topAnchor.constraint(equalTo:scroll.contentLayoutGuide.topAnchor,constant:24),
            stack.bottomAnchor.constraint(equalTo:scroll.contentLayoutGuide.bottomAnchor,constant:-24),
            stack.widthAnchor.constraint(equalTo:scroll.frameLayoutGuide.widthAnchor,constant:-48)
        ])
        for label in [titleLabel,actionLabel,countLabel,hintLabel] {
            label.numberOfLines=0; label.textAlignment = .center; label.adjustsFontForContentSizeCategory=true
            label.textColor = .white; stack.addArrangedSubview(label)
        }
        titleLabel.textColor=gold; titleLabel.font = .preferredFont(forTextStyle:.title2)
        titleLabel.accessibilityTraits.insert(.header); titleLabel.text=text("Родительский PIN","Parent PIN")
        actionLabel.font = .preferredFont(forTextStyle:.headline)
        actionLabel.text=action=="enroll-local-pin" ? text("Создать родительский PIN","Create Parent PIN"):PinVerificationActionCopy.caption(action,locale:locale)
        hintLabel.font = .preferredFont(forTextStyle:.body)
        hintLabel.text=text("Введите PIN, чтобы подтвердить действие.","Enter your PIN to confirm this action.")
        countLabel.font = .preferredFont(forTextStyle:.title1)
        let labels=[["1","2","3"],["4","5","6"],["7","8","9"],["⌫","0",""]]
        for row in labels {
            let line=UIStackView(); line.axis = .horizontal; line.spacing=12; line.distribution = .fillEqually
            for label in row {
                let button=UIButton(type:.system); button.setTitle(label,for:.normal)
                button.titleLabel?.font = .preferredFont(forTextStyle:.title1)
                button.titleLabel?.adjustsFontForContentSizeCategory=true; button.setTitleColor(.white,for:.normal)
                button.tintColor=gold; button.backgroundColor=UIColor(red:0.065,green:0.12,blue:0.20,alpha:1)
                button.layer.cornerRadius=12; button.heightAnchor.constraint(greaterThanOrEqualToConstant:56).isActive=true
                if let digit=Int(label) { button.tag=digit; button.addTarget(self,action:#selector(digitTap(_:)),for:.touchUpInside) }
                else if label=="⌫" {
                    button.accessibilityLabel=text("Удалить последнюю цифру","Delete last digit")
                    button.addTarget(self,action:#selector(deleteTap),for:.touchUpInside)
                } else { button.isEnabled=false; button.isHidden=true }
                line.addArrangedSubview(button); inputButtons.append(button)
            }
            stack.addArrangedSubview(line)
        }
        continueButton.setTitle(text("Продолжить","Continue"),for:.normal)
        continueButton.backgroundColor=gold; continueButton.setTitleColor(navy,for:.normal); continueButton.layer.cornerRadius=12
        continueButton.titleLabel?.font = .preferredFont(forTextStyle:.headline)
        continueButton.titleLabel?.adjustsFontForContentSizeCategory=true
        continueButton.heightAnchor.constraint(greaterThanOrEqualToConstant:48).isActive=true
        continueButton.addTarget(self,action:#selector(submitTap),for:.touchUpInside); stack.addArrangedSubview(continueButton)
        let cancel=UIButton(type:.system); cancel.setTitle(text("Отмена","Cancel"),for:.normal)
        cancel.titleLabel?.font = .preferredFont(forTextStyle:.body); cancel.titleLabel?.adjustsFontForContentSizeCategory=true
        cancel.heightAnchor.constraint(greaterThanOrEqualToConstant:48).isActive=true
        cancel.addTarget(self,action:#selector(cancelTap),for:.touchUpInside); stack.addArrangedSubview(cancel)
        update(count:0)
    }
    override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated); owner?.disappeared() }
    func update(count: Int) {
        countLabel.text=String(repeating:"•",count:min(count,12))
        countLabel.accessibilityLabel=text("Введено цифр: \(count)","Digits entered: \(count)")
        continueButton.isEnabled=count>=minimum && count<=128
    }
    func confirmEntry() { hintLabel.text=text("Повторите новый PIN.","Enter the new PIN again.");update(count:0) }
    func disableAndClear() {
        inputButtons.forEach { $0.isEnabled=false }; continueButton.isEnabled=false
        countLabel.text=""; countLabel.accessibilityLabel=text("Ввод закрыт","Input closed")
    }
    func detach() { disableAndClear(); owner=nil }
    @objc private func digitTap(_ sender: UIButton) { guard sender.tag>=0 && sender.tag<=9 else { return }; owner?.tapDigit(UInt8(sender.tag)+48) }
    @objc private func deleteTap() { owner?.deleteDigit() }
    @objc private func submitTap() { owner?.submit() }
    @objc private func cancelTap() { owner?.cancel() }
}

#if DEBUG
fileprivate extension LocalV2PinOperations {
    func fixtureOperation(_ challenge: LocalV2PinChallenge,_ request: LocalV2Request) throws -> LocalV2PinOperation {
        guard synthetic else { throw PinKnownRefusal() };return try bind(request,challenge,.en)
    }
    func fixtureEntry(_ operation: LocalV2PinOperation,_ bytes: Data,_ confirmation: Data?=nil) throws -> LocalV2PinEntry {
        guard synthetic,operation.owner === self else { throw PinKnownRefusal() }
        let input=try PinPrimitiveInput(bytes),confirm=try confirmation.map { try PinPrimitiveInput($0) }
        let entry=LocalV2PinEntry(operation,nil,input,confirm)
        writer.condition.lock();operation.entry=entry;operation.inputJoined=true;writer.condition.unlock();return entry
    }
    func fixtureLifecycleEvent(_ operation: LocalV2PinOperation,_ name: Notification.Name) throws {
        guard synthetic else { throw PinKnownRefusal() }
        writer.condition.lock();let revoke=writer.pinLifecycleWillRevokeLocked(operation.request,name:name);writer.condition.unlock()
        if revoke { writer.cancel(operation.request) }
    }
}
enum PlanetChildLocalPinOperationScenario: String {
    case enrollment,match,mismatch,malformed,empty,confirmationMismatch,badOwnerSignature,ownerChanged,ownerCancelled
    case chargeReadbackMismatch,chargedBeforeKDF,kdfFailure,cancelDuringKDF,expireDuringKDF,mutationDuringKDF
    case finalizationReadbackMismatch,earlyReplyACK,unknownReplyACK,replyReplay,foreignChallenge,scopeMismatch,replayOperation
    case forgedComparison,recipientThrows,retirementWaitsForKDF,retirementWaitsForRecipient,changedKeyAtWrite
    case expiredAfterRetirement,changedAfterRetirement,lifecycleAfterRetirement
    case ownedPromptInactive,backgroundDuringOwner,expireDuringOwner
}
struct PlanetChildLocalPinOperationObservation {
    var passed=false,updates=0,deriveCalls=0,signCalls=0,chargedBeforeKDF=false,count: UInt64=0,pending=false,replyKnown=false
    var denied=false,earlyDenied=false,matched=false,retirementJoined=false,sealed=false
    let qualification="synthetic native storage/input/owner scope; no installed Keychain, Secure Enclave, UIKit or Gate acceptance"
}
enum PlanetChildLocalPinOperationRuntimeFixture {
    private final class Engine: PinPrimitiveEngine,PinVerificationEngine {
        var randomCalls=0,deriveCalls=0,beforeDerive: (() throws -> Void)?,failure=false
        func random(_ output: UnsafeMutableRawBufferPointer) throws {
            randomCalls+=1;for i in output.indices { output[i]=randomCalls==1 ? 0xcc:0xbb }
        }
        func derive(pin: UnsafeRawBufferPointer,salt: UnsafeRawBufferPointer,iterations: UInt32,output: UnsafeMutableRawBufferPointer) throws {
            deriveCalls+=1;try beforeDerive?();if failure { throw PinPrimitiveFailure.unavailable }
            let match=pin.count==4 && pin[0]==49 && pin[1]==50 && pin[2]==51 && pin[3]==52
            for i in output.indices { output[i]=match ? 0xdd:0xee }
        }
    }
    private final class Keys: PinOwnerKeys {
        let source: PinOwnerKeySource = .synthetic,key: PinOwnerKey
        var signCalls=0,bad=false,changed=false,onSign: (() -> Void)?
        init() throws {
            var error: Unmanaged<CFError>?
            guard let key=SecKeyCreateRandomKey([kSecAttrKeyType:kSecAttrKeyTypeECSECPrimeRandom,kSecAttrKeySizeInBits:256] as CFDictionary,&error),
                let publicKey=SecKeyCopyPublicKey(key),let bytes=SecKeyCopyExternalRepresentation(publicKey,&error) as Data? else { throw PinKnownRefusal() }
            self.key=PinOwnerKey(privateKey:key,publicKey:publicKey,publicBytes:bytes,source:.synthetic)
        }
        func acquire(enroll: Bool,context: LAContext,prompt: String) throws -> PinOwnerKey { guard enroll else { throw PinKnownRefusal() };return key }
        func current(_ original: PinOwnerKey) throws { guard original === key,!changed else { throw PinKnownRefusal() } }
        func sign(_ original: PinOwnerKey,message: Data) throws -> Data {
            signCalls+=1;onSign?();if bad { return Data(repeating:0,count:72) };var error: Unmanaged<CFError>?
            guard let signature=SecKeyCreateSignature(original.privateKey,.ecdsaSignatureMessageX962SHA256,message as CFData,&error) as Data? else { throw PinKnownRefusal() }
            return signature
        }
    }
    private static func policy() throws -> LocalSnapshotV2Policy {
        try LocalSnapshotV2Policy(version:"synthetic-local-pin-v2",checksum:String(repeating:"a",count:64),maximum:600000,delays:[100,200,400])
    }
    private static func record(_ p: LocalSnapshotV2Policy) throws -> Data {
        let registry=#"{"schemaVersion":1,"policyVersion":"\#(p.version)","activeProfileId":"reader","profiles":[{"id":"reader","label":"Synthetic Reader","exactAge":9,"ageBand":"9-11","locale":"en","ageConfirmedAt":"2026-10-01T12:00:00.000Z","readingLevel":null,"allowedTopics":null,"blockedTopics":["violence"],"soundEnabled":false,"motion":"calm","narrationEnabled":false}]}"#
        let pin=#"{"schemaVersion":1,"policyVersion":"\#(p.version)","revision":1,"credentialId":"\#(String(repeating:"b",count:64))","verifier":{"algorithm":"PBKDF2-HMAC-SHA256","iterations":600000,"saltHex":"\#(String(repeating:"c",count:64))","hashHex":"\#(String(repeating:"d",count:64))"},"attempts":{"count":0,"blockedUntilMs":0,"lastObservedMs":0,"pendingAttemptId":null}}"#
        let bytes=Data(#"{"schemaVersion":2,"revision":2,"mode":"child","selectionRevision":3,"profileRevision":2,"policyChecksum":"\#(p.checksum)","registryChecksum":"\#(LocalSnapshotV2.hash(Data(registry.utf8)))","registry":\#(registry),"pin":\#(pin),"clock":{"schemaVersion":2,"logicalMs":0}}"#.utf8)
        let fields=LocalV2PinFields(revision:1,credential:String(repeating:"b",count:64),count:0,blocked:0,observed:0,pending:nil,revisionStart:0,revisionEnd:0,attemptsStart:0)
        let snapshot=try LocalSnapshotV2.wrapper(bytes,policy:p,rootRevision:2,journalRevision:1,pin:fields);defer { snapshot.close() };return try snapshot.copyCanonicalBytes()
    }
    private static func denied(_ task: () throws -> Void) -> Bool { do { try task();return false } catch { return true } }
    static func run(_ scenario: PlanetChildLocalPinOperationScenario) throws -> PlanetChildLocalPinOperationObservation {
        guard !Thread.isMainThread else { throw PinKnownRefusal() }
        if scenario == .retirementWaitsForKDF || scenario == .retirementWaitsForRecipient { return try held(scenario) }
        let p=try policy(),enrollment=[PlanetChildLocalPinOperationScenario.enrollment,.confirmationMismatch,.badOwnerSignature,.ownerChanged,.ownerCancelled,.changedKeyAtWrite,
            .ownedPromptInactive,.backgroundDuringOwner,.expireDuringOwner].contains(scenario)
        let bytes: Data
        if enrollment { bytes=try PlanetChildVault.LocalEmptySeedV2.canonicalBytes(policyVersion:p.version,policyChecksum:p.checksum) }
        else { bytes=try record(p) }
        let io=LocalV2FixtureStorage(bytes),clock=LocalV2FixtureClock(),engine=Engine(),keys=try Keys()
        let scope=LocalV2ProcessClock(fixturePolicy:p,clock:clock),writer=LocalV2Writer(fixtureStorage:io,policy:p,clock:clock,processClock:scope)
        let operations=try LocalV2PinOperations(fixtureWriter:writer,keys:keys,engine:engine,verificationEngine:engine)
        let request=try writer.fixtureRequest(timeoutMs:1000)
        // Explicit warm fixture binding avoids re-testing the retained cold
        // reanchor family; production always opens via actual durable readback.
        let snapshot: LocalSnapshotV2?=enrollment ? nil:(try LocalSnapshotV2.decode(bytes,policy:p));defer { snapshot?.close() }
        writer.condition.lock()
        do { try scope.adoptFirst(request,bytes,snapshot,clock.now);writer.condition.unlock() } catch { writer.condition.unlock();throw error }
        let original=NSObject(),gate=PinGateRequest(originalHostChallenge:original,id:String(repeating:"1",count:64),action:"exit-child",
            targetChecksum:String(repeating:"2",count:64),context:PinGateContext(profileId:scenario == .scopeMismatch ? "wrong":"reader",policyVersion:p.version,
                profileRevision:2,routeRevision:7,mode:"child",visibility:"active"),generation:4,deadlineUptimeMs:request.deadline/1000000)
        let challenge=enrollment ? LocalV2PinChallenge(enrollmentOriginal:original,id:String(repeating:"1",count:64),seedChecksum:LocalSnapshotV2.hash(bytes),generation:4,deadlineNs:request.deadline)
            :LocalV2PinChallenge(verificationOriginal:gate,rootRevision:2,selectionRevision:3,deadlineNs:request.deadline)
        let operation=try operations.fixtureOperation(challenge,request);var observation=PlanetChildLocalPinOperationObservation()
        if scenario == .scopeMismatch {
            observation.denied=denied { try operations.open(operation) };observation.passed=observation.denied && io.updates==0 && engine.deriveCalls==0
            writer.cancel(request);try? operations.retire(operation);return observation
        }
        try operations.open(operation)
        var input=Data("1234".utf8)
        if scenario == .mismatch || scenario == .forgedComparison { input=Data("9".utf8) }
        if scenario == .malformed { input=Data([0xc3,0xa9]) }
        if scenario == .empty { input=Data() }
        if scenario == .badOwnerSignature { keys.bad=true }
        if scenario == .ownerChanged { keys.onSign={ keys.changed=true } }
        if scenario == .ownerCancelled { keys.onSign={ writer.cancel(request) } }
        if scenario == .ownedPromptInactive { keys.onSign={ try? operations.fixtureLifecycleEvent(operation,UIApplication.willResignActiveNotification) } }
        if scenario == .backgroundDuringOwner { keys.onSign={ try? operations.fixtureLifecycleEvent(operation,UIApplication.didEnterBackgroundNotification) } }
        if scenario == .expireDuringOwner { keys.onSign={ clock.now=request.deadline } }
        if scenario == .changedKeyAtWrite { io.duringUpdate={ keys.changed=true } }
        if scenario == .chargeReadbackMismatch { io.corruptReadback=true }
        if scenario == .finalizationReadbackMismatch { io.duringUpdate={ if io.updates==2 { io.value.append(32) } } }
        engine.beforeDerive={
            if !enrollment {
                let durable=try LocalSnapshotV2.decode(io.value,policy:p);defer { durable.close() }
                observation.chargedBeforeKDF=io.updates==1 && durable.fields.pin.count==1 && durable.fields.pin.pending==request.reservation?.attemptId
                    && request.receipt?.known==true && request.receipt?.settled==true
            }
            if scenario == .kdfFailure { engine.failure=true }
            if scenario == .cancelDuringKDF { writer.cancel(request) }
            if scenario == .expireDuringKDF { clock.now=request.deadline }
            if scenario == .mutationDuringKDF { io.value.append(32) }
        }
        var reply: LocalV2PinReply?
        observation.denied=denied {
            let confirmation=enrollment ? Data(scenario == .confirmationMismatch ? "4321".utf8:"1234".utf8):nil
            let entry=try operations.fixtureEntry(operation,input,confirmation)
            reply=try operations.process(operation,entry:entry)
        }
        if let reply {
            if scenario == .forgedComparison,let actual=operation.comparison {
                let falseResult=PinVerificationMathResult(identity:actual.identity,comparison:.match,source:.synthetic)
                var charged=try actual.charged.copy();defer { charged.resetBytes(in:0..<charged.count) }
                let forged=LocalV2PinComparison(operation,actual.reservation,falseResult,charged)
                observation.earlyDenied=denied { try writer.finalize(operation,comparison:forged) { _ in } }
            }
            observation.denied=denied {
                try operations.deliver(operation,reply) { _ in
                    if scenario == .earlyReplyACK { observation.earlyDenied=denied { try operations.settle(reply,known:true) } }
                    if scenario == .recipientThrows { throw PinKnownRefusal() }
                }
            }
            if scenario == .recipientThrows { try operations.settle(reply,known:false) }
            else if scenario == .unknownReplyACK { try operations.settle(reply,known:false) }
            else {
                try operations.settle(reply,known:true);observation.replyKnown=reply.known
                if scenario == .foreignChallenge {
                    let foreign=LocalV2PinChallenge(verificationOriginal:gate,rootRevision:2,selectionRevision:3,deadlineNs:request.deadline)
                    observation.earlyDenied=denied { _ = try operations.consumeMatch(reply,original:foreign) }
                }
                let beforeRetirement=denied { _ = try operations.consumeMatch(reply,original:challenge) }
                if scenario == .match { observation.earlyDenied=beforeRetirement }
                try operations.retire(operation)
                if scenario == .expiredAfterRetirement { clock.now=request.deadline }
                if scenario == .changedAfterRetirement { io.value.append(32) }
                if scenario == .lifecycleAfterRetirement { writer.condition.lock();operation.closedRevoked=true;operation.closedKnown=false;writer.condition.unlock() }
                if scenario == .expiredAfterRetirement || scenario == .changedAfterRetirement || scenario == .lifecycleAfterRetirement {
                    observation.denied=denied { _ = try operations.consumeMatch(reply,original:challenge) }
                } else if reply.kind == .match { observation.matched=(try operations.consumeMatch(reply,original:challenge)).original === challenge }
                if scenario == .replyReplay { observation.earlyDenied=denied { try operations.settle(reply,known:true) }
                    && denied { _ = try operations.consumeMatch(reply,original:challenge) } }
            }
        } else { operations.closeInternalUnknown(operation) }
        observation.updates=io.updates;observation.deriveCalls=engine.deriveCalls;observation.signCalls=keys.signCalls;observation.sealed=request.sealed || scope.invalidated
        if let durable=try? LocalSnapshotV2.decode(io.value,policy:p) { observation.count=durable.fields.pin.count;observation.pending=durable.fields.pin.pending != nil;durable.close() }
        writer.cancel(request);try? operations.retire(operation)
        if scenario == .replayOperation {
            let next=try writer.fixtureRequest();observation.earlyDenied=denied { _ = try operations.fixtureOperation(challenge,next) };writer.cancel(next);try? writer.retire(next)
        }
        switch scenario {
        case .enrollment,.ownedPromptInactive: observation.passed = !observation.denied && observation.updates==1 && observation.deriveCalls==1 && observation.signCalls==1 && observation.replyKnown && observation.count==0
        case .match,.chargedBeforeKDF: observation.passed=observation.matched && observation.chargedBeforeKDF && observation.updates==2 && observation.count==0 && !observation.pending
        case .mismatch: observation.passed = !observation.denied && !observation.matched && observation.replyKnown && observation.updates==2 && observation.count==1 && !observation.pending
        case .malformed: observation.passed=observation.denied && observation.updates==1 && observation.deriveCalls==0 && observation.count==1 && observation.pending
        case .empty,.confirmationMismatch: observation.passed=observation.denied && observation.updates==0 && observation.deriveCalls==0 && observation.signCalls==0
        case .badOwnerSignature,.ownerChanged,.ownerCancelled,.backgroundDuringOwner,.expireDuringOwner: observation.passed=observation.denied && observation.updates==0 && observation.signCalls==1
        case .changedKeyAtWrite: observation.passed=observation.denied && observation.updates==1 && observation.sealed && !observation.replyKnown
        case .chargeReadbackMismatch: observation.passed=observation.denied && observation.updates==1 && observation.deriveCalls==0 && observation.sealed
        case .kdfFailure,.cancelDuringKDF,.expireDuringKDF: observation.passed=observation.denied && observation.updates==1 && observation.count==1 && observation.pending && observation.chargedBeforeKDF
        case .mutationDuringKDF: observation.passed=observation.denied && observation.updates==1 && observation.sealed && !observation.replyKnown
        case .finalizationReadbackMismatch: observation.passed=observation.denied && observation.updates==2 && observation.sealed && !observation.replyKnown
        case .earlyReplyACK,.replyReplay,.foreignChallenge,.replayOperation: observation.passed=observation.earlyDenied && observation.matched && observation.replyKnown && observation.updates==2
        case .forgedComparison: observation.passed=observation.earlyDenied && !observation.matched && observation.count==1 && observation.replyKnown && observation.updates==2
        case .unknownReplyACK: observation.passed = !observation.replyKnown && !observation.matched && observation.updates==2
        case .recipientThrows: observation.passed=observation.denied && !observation.replyKnown && !observation.matched && observation.updates==2
        case .expiredAfterRetirement,.changedAfterRetirement,.lifecycleAfterRetirement: observation.passed=observation.denied && !observation.matched && observation.replyKnown && observation.updates==2
        case .scopeMismatch: break
        case .retirementWaitsForKDF,.retirementWaitsForRecipient: return try held(scenario)
        }
        return observation
    }
    private static func held(_ scenario: PlanetChildLocalPinOperationScenario) throws -> PlanetChildLocalPinOperationObservation {
        // The blocked callbacks retain the actual original native work, so the
        // test releases them only after seeing the retirement fence installed.
        let p=try policy(),bytes=try record(p),io=LocalV2FixtureStorage(bytes),clock=LocalV2FixtureClock(),engine=Engine(),keys=try Keys()
        let writer=LocalV2Writer(fixtureStorage:io,policy:p,clock:clock),operations=try LocalV2PinOperations(fixtureWriter:writer,keys:keys,engine:engine,verificationEngine:engine)
        let request=try writer.fixtureRequest(),snapshot=try LocalSnapshotV2.decode(bytes,policy:p);defer { snapshot.close() }
        writer.condition.lock();do { try writer.processClock.adoptFirst(request,bytes,snapshot,clock.now);writer.condition.unlock() } catch { writer.condition.unlock();throw error }
        let gate=PinGateRequest(originalHostChallenge:NSObject(),id:String(repeating:"3",count:64),action:"exit-child",targetChecksum:String(repeating:"4",count:64),
            context:PinGateContext(profileId:"reader",policyVersion:p.version,profileRevision:2,routeRevision:7,mode:"child",visibility:"active"),generation:4,deadlineUptimeMs:request.deadline/1000000)
        let challenge=LocalV2PinChallenge(verificationOriginal:gate,rootRevision:2,selectionRevision:3,deadlineNs:request.deadline),op=try operations.fixtureOperation(challenge,request)
        try operations.open(op);let entry=try operations.fixtureEntry(op,Data("1234".utf8))
        let entered=DispatchSemaphore(value:0),release=DispatchSemaphore(value:0),finished=DispatchSemaphore(value:0),retired=DispatchSemaphore(value:0)
        var reply: LocalV2PinReply?,retireReturned=false
        if scenario == .retirementWaitsForKDF { engine.beforeDerive={ entered.signal();release.wait() } }
        Thread {
            do { let value=try operations.process(op,entry:entry);reply=value
                try operations.deliver(op,value) { _ in if scenario == .retirementWaitsForRecipient { entered.signal();release.wait() } }
            } catch { operations.closeInternalUnknown(op) };finished.signal()
        }.start();entered.wait()
        Thread { try? operations.retire(op);writer.condition.lock();retireReturned=true;writer.condition.unlock();retired.signal() }.start()
        writer.condition.lock();while !request.retiring { writer.condition.wait() }
        let joined = !retireReturned && (scenario == .retirementWaitsForKDF ? request.workers==1:op.recipients==1);writer.condition.unlock()
        release.signal();finished.wait();if let reply { try operations.settle(reply,known:false) };retired.wait()
        var result=PlanetChildLocalPinOperationObservation();result.retirementJoined=joined && request.retired;result.passed=result.retirementJoined
        result.updates=io.updates;result.deriveCalls=engine.deriveCalls;return result
    }
}
#endif

/** Native-only LOCAL v2 scope extracted after the strict canonical decoder.
 * JSON here reads only the already authenticated selected registry profile;
 * no caller dictionary supplies profile, locale, revisions or child mode. */
fileprivate final class LocalV2GateScope {
    let context: PinGateContext,locale: PinNativeInputLocale,registryChecksum: String,protectedChecksum: String,credential: String
    let rootRevision: UInt64,pinRevision: UInt64,selectionRevision: UInt64
    init(_ snapshot: LocalSnapshotV2) throws {
        let exact=try PlanetChildVault.ProtectedEnvelope.localV2Context(snapshot)
        var bytes=try snapshot.copyProtectedBytes();defer { bytes.resetBytes(in:0..<bytes.count) }
        guard exact.mode=="child",let active=exact.profile,
            let record=try JSONSerialization.jsonObject(with:bytes) as? [String:Any],let registry=record["registry"] as? [String:Any],
            let checksum=record["registryChecksum"] as? String,let profiles=registry["profiles"] as? [[String:Any]],
            let selected=profiles.first(where:{ $0["id"] as? String == active }),let language=selected["locale"] as? String,
            language=="ru" || language=="en" else { throw PinKnownRefusal() }
        context=PinGateContext(profileId:active,policyVersion:snapshot.policy.version,profileRevision:exact.profileRevision,
            routeRevision:exact.selectionRevision,mode:"child",visibility:"active")
        locale=language=="ru" ? .ru:.en;registryChecksum=checksum;protectedChecksum=LocalSnapshotV2.hash(bytes)
        rootRevision=snapshot.fields.revision;pinRevision=snapshot.fields.pin.revision;credential=snapshot.fields.pin.credential;selectionRevision=exact.selectionRevision
    }
    func initial(_ current: LocalSnapshotV2) throws {
        var bytes=try current.copyProtectedBytes();defer { bytes.resetBytes(in:0..<bytes.count) }
        guard current.fields.revision==rootRevision,current.fields.pin.revision==pinRevision,LocalSnapshotV2.hash(bytes)==protectedChecksum else { throw PinKnownRefusal() }
        try same(current)
    }
    func same(_ current: LocalSnapshotV2) throws {
        let actual=try LocalV2GateScope(current)
        guard context==actual.context,registryChecksum==actual.registryChecksum,locale==actual.locale,credential==actual.credential else { throw PinKnownRefusal() }
    }
}
/** Internally minted exact original challenge and owned target. Its single
 * exclusive deadline starts at the native control event, including capture,
 * PIN, every real join and dispatch. Completion never renews that deadline. */
fileprivate final class LocalV2GateInvocation {
    let id: String,action: String,targetChecksum: String,generation: UInt64,began: UInt64,deadline: UInt64
    private let target: PinOwnedBytes,lock=NSLock()
    private(set) var original: LocalV2PinChallenge?,scope: LocalV2GateScope?
    private var spent=false,revoked=false
    private var transferredReply: LocalV2PinReply?
    private var last: UInt64
    init(action: String,target: Data,generation: UInt64,beganNs: UInt64,verificationMs: UInt64,capabilityMs: UInt64) throws {
        guard target.count<=131072,generation<=9007199254740991,verificationMs>0,verificationMs<=60000,capabilityMs>0,capabilityMs<=2147483647,
            PinVerificationActionCopy.caption(action,locale:.en) != nil else { throw PinKnownRefusal() }
        let duration=min(verificationMs,capabilityMs),base=beganNs/1000000
        guard base<=9007199254740991-duration,base+duration<=UInt64.max/1000000 else { throw PinKnownRefusal() }
        let deadline=(base+duration)*1000000;guard deadline>beganNs else { throw PinKnownRefusal() }
        var nonce=[UInt8](repeating:0,count:32);defer { nonce.withUnsafeMutableBytes { $0.initializeMemory(as:UInt8.self,repeating:0) } }
        guard SecRandomCopyBytes(kSecRandomDefault,nonce.count,&nonce)==errSecSuccess else { throw PlanetChildVault.Failure.unavailable }
        id=nonce.map { String(format:"%02x",$0) }.joined();self.action=action;self.target=PinOwnedBytes(target);targetChecksum=LocalSnapshotV2.hash(target)
        self.generation=generation;began=beganNs;last=beganNs;self.deadline=deadline
    }
    private func current(_ ns: UInt64) throws {
        guard !spent,!revoked,ns>=last,ns<deadline else { revoked=true;throw PinKnownRefusal() };last=ns
    }
    func live(_ ns: UInt64) throws { lock.lock();defer { lock.unlock() };try current(ns) }
    func capture(_ exact: LocalV2GateScope,_ ns: UInt64) throws -> LocalV2PinChallenge {
        lock.lock();defer { lock.unlock() };try current(ns);guard scope==nil,original==nil else { throw PinKnownRefusal() };scope=exact
        let gate=PinGateRequest(originalHostChallenge:self,id:id,action:action,targetChecksum:targetChecksum,context:exact.context,generation:generation,deadlineUptimeMs:deadline/1000000)
        let challenge=LocalV2PinChallenge(verificationOriginal:gate,rootRevision:exact.rootRevision,selectionRevision:exact.selectionRevision,deadlineNs:deadline)
        original=challenge;return challenge
    }
    func transfer(_ completion: LocalV2PinCompletion?,reply: LocalV2PinReply?,now: UInt64) throws -> Data {
        lock.lock();defer { lock.unlock() };let available = !spent && !revoked && now>=last && now<deadline;spent=true;if available { last=now }
        guard available,let original,let completion,let reply,completion.original === original,original.original === self,
            reply.operation.challenge === original,original.kind == .verify,reply.kind == .match,reply.completed,reply.settled,reply.known,reply.consumed,
            reply.operation.closedKnown,!reply.operation.closedRevoked,reply.operation.request.retired,!reply.operation.request.sealed,
            completion.receiptChecksum==reply.receipt.checksum,completion.receiptRevision==reply.receipt.revision else { throw PinKnownRefusal() }
        var bytes=try target.copy();guard LocalSnapshotV2.hash(bytes)==targetChecksum else { bytes.resetBytes(in:0..<bytes.count);throw PinKnownRefusal() };transferredReply=reply;return bytes
    }
    func execution(_ reply: LocalV2PinReply?,_ ns: UInt64) throws { lock.lock();defer { lock.unlock() };guard spent,let reply,transferredReply === reply,!revoked,ns>=last,ns<deadline else { revoked=true;throw PinKnownRefusal() };last=ns }
    func hostCurrent(_ ns: UInt64) throws { lock.lock();let reply=transferredReply;lock.unlock();if let reply { try execution(reply,ns) } else { try live(ns) } }
    func revoke() { lock.lock();revoked=true;lock.unlock() }
    func close() { lock.lock();spent=true;transferredReply=nil;target.close();lock.unlock() }
}
/** Real child VC observes original parent route disappearance/Back/pop and
 * reparenting. Only this operation's exact native PIN presentation may hide
 * the original route temporarily. No lifecycle boolean is supplied by JS. */
fileprivate final class LocalV2GateRouteWitness: UIViewController {
    weak var owner: LocalV2GateHost?
    override func viewWillDisappear(_ animated: Bool) { super.viewWillDisappear(animated);owner?.routeDisappearing() }
    override func didMove(toParent parent: UIViewController?) { super.didMove(toParent:parent);owner?.witnessMoved(parent) }
    override func loadView() { let view=UIView(frame:.zero);view.isUserInteractionEnabled=false;self.view=view }
}
/** Concrete private native-control host. The exact existing VC/window/scene
 * and UIButton are retained through final canonical readback and native
 * action delivery. Production App/admitted AES factories remain nil. */
fileprivate final class LocalV2GateHost: NSObject {
    fileprivate let operations: LocalV2PinOperations,host: UIViewController,route: UIView,control: UIButton,window: UIWindow,scene: UIWindowScene,root: UIViewController
    private let policy: LocalSnapshotV2Policy,action: String,target: PinOwnedBytes,verificationMs: UInt64,capabilityMs: UInt64
    fileprivate let dispatch: (String,Data) throws -> Void,ancestry: [UIView],controllers: [UIViewController],presenter: UIViewController?
    fileprivate let lock=NSLock(),witness=LocalV2GateRouteWitness()
    fileprivate var invocation: LocalV2GateInvocation?,operation: LocalV2PinOperation?,input: LocalV2PinNativeInput?,worker: Thread?,generation: UInt64=0
    fileprivate var revoked=false,closed=false,observers=[NSObjectProtocol](),expiry: DispatchWorkItem?
    private var mutation: LocalV2GateMutation?
    fileprivate var retirement: Thread?
    fileprivate static func originalWindow(host: UIViewController,control: UIButton) throws -> UIWindow {
        guard Thread.isMainThread,let route=host.viewIfLoaded,let window=route.window,let scene=window.windowScene,
            window.rootViewController != nil,control.isDescendant(of:route),control.allTargets.isEmpty,control.allControlEvents.isEmpty,
            window.isKeyWindow,!window.isHidden,scene.activationState == .foregroundActive,UIApplication.shared.applicationState == .active,
            host.presentedViewController==nil,!host.isBeingDismissed,!host.isMovingFromParent,!control.isHidden,!route.isHidden else { throw PinKnownRefusal() }
        return window
    }
    init(vault: PlanetChildVault,host: UIViewController,control: UIButton,policy: LocalSnapshotV2Policy,iterations: UInt32,
        action: String,target: Data,verificationMs: UInt64,capabilityMs: UInt64,dispatch: @escaping (String,Data) throws -> Void) throws {
        let originalWindow=try Self.originalWindow(host:host,control:control)
        guard Thread.isMainThread,let route=host.viewIfLoaded,let window=route.window,let scene=window.windowScene,let root=window.rootViewController,
            control.isDescendant(of:route),control.allTargets.isEmpty,!control.isHidden,!route.isHidden,window.isKeyWindow,!window.isHidden,
            scene.activationState == .foregroundActive,UIApplication.shared.applicationState == .active,host.presentedViewController==nil,
            !host.isBeingDismissed,!host.isMovingFromParent,verificationMs>0,verificationMs<=60000,
            capabilityMs>0,capabilityMs<=2147483647,target.count<=131072,window === originalWindow,
            PinVerificationActionCopy.caption(action,locale:.en) != nil else { throw PinKnownRefusal() }
        self.host=host;self.route=route;self.control=control;self.window=window;self.scene=scene;self.root=root;self.policy=policy
        self.action=action;self.target=PinOwnedBytes(target);self.verificationMs=verificationMs;self.capabilityMs=capabilityMs;self.dispatch=dispatch
        operations=try LocalV2PinOperations(vault:vault,policy:policy,iterations:iterations)
        var parents=[UIView](),parent=control.superview;while let value=parent { parents.append(value);if value === route { break };parent=value.superview }
        guard parents.last === route else { throw PinKnownRefusal() };ancestry=parents
        var controllers=[UIViewController](),controller=host.parent;while let value=controller { controllers.append(value);controller=value.parent }
        self.controllers=controllers;presenter=host.presentingViewController;super.init()
        witness.owner=self;host.addChild(witness);route.addSubview(witness.view);witness.didMove(toParent:host)
        let center=NotificationCenter.default
        for name in [UIApplication.willResignActiveNotification,UIApplication.didEnterBackgroundNotification,UIScene.didDisconnectNotification,UIWindow.didResignKeyNotification] {
            observers.append(center.addObserver(forName:name,object:nil,queue:.main) { [weak self] note in
                guard let self else { return }
                if name==UIScene.didDisconnectNotification,(note.object as? UIWindowScene) !== self.scene { return }
                if name==UIWindow.didResignKeyNotification,(note.object as? UIWindow) !== self.window { return };self.revoke()
            })
        }
        control.addTarget(self,action:#selector(begin),for:.touchUpInside)
    }
    fileprivate func sample() throws -> UInt64 { try operations.writer.clock.nanoseconds() }
    private func ownedInput() -> UIViewController? {
        guard let operation,let input,operation.owner === operations,operation.input === input,let view=input.controller,
            operation.challenge.kind == .verify,view.presentingViewController === host,host.presentedViewController === view,
            view.viewIfLoaded?.window === window else { return nil };return view
    }
    fileprivate func current(allowInput: Bool) throws {
        guard Thread.isMainThread else { throw PinKnownRefusal() };lock.lock();let denied=revoked || closed,original=invocation;lock.unlock()
        let owned=allowInput ? ownedInput():nil
        guard !denied,host.viewIfLoaded === route,window.rootViewController === root,window.windowScene === scene,window.isKeyWindow,!window.isHidden,
            scene.activationState == .foregroundActive,UIApplication.shared.applicationState == .active,!host.isBeingDismissed,!host.isMovingFromParent,
            route.window === window || owned != nil,host.presentedViewController==nil || host.presentedViewController === owned,
            witness.parent === host,!control.isHidden,!route.isHidden else { throw PinKnownRefusal() }
        var parent=control.superview;for exact in ancestry { guard parent === exact else { throw PinKnownRefusal() };parent=parent?.superview }
        var controller=host;for exact in controllers {
            guard controller.parent === exact else { throw PinKnownRefusal() }
            if let navigation=exact as? UINavigationController, navigation.topViewController !== controller { throw PinKnownRefusal() }
            if let tabs=exact as? UITabBarController,tabs.selectedViewController !== controller { throw PinKnownRefusal() };controller=exact
        }
        guard controller.parent==nil,host.presentingViewController === presenter else { throw PinKnownRefusal() }
        if let original { try original.hostCurrent(sample()) }
    }
    fileprivate func routeDisappearing() {
        // Presentation may call disappearance before its completion; accept
        // only the exact input controller already owned by the same request.
        if let operation,let controller=operation.input?.controller,operation.challenge.kind == .verify,
            host.presentedViewController === controller,controller.presentingViewController === host { return };revoke()
    }
    fileprivate func witnessMoved(_ parent: UIViewController?) { if parent !== host { revoke() } }
    /** Native router must call before reusing the original route view. */
    func routeWillChange() { revoke() }
    private func revoke() {
        lock.lock();revoked=true;let original=invocation,native=operation;lock.unlock();original?.revoke()
        if let native,!native.request.retired { operations.writer.cancel(native.request) }
        if let request=mutation?.request,!request.retired { operations.writer.cancel(request) }
    }
    @objc private func begin() {
        do { try current(allowInput:false);lock.lock();let ready=invocation==nil && worker==nil && generation<9007199254740991
            if ready { generation+=1 };let sequence=generation;lock.unlock();guard ready else { throw PinKnownRefusal() }
            var bytes=try target.copy();defer { bytes.resetBytes(in:0..<bytes.count) }
            let original=try LocalV2GateInvocation(action:action,target:bytes,generation:sequence,beganNs:sample(),verificationMs:verificationMs,capabilityMs:capabilityMs)
            lock.lock();invocation=original;lock.unlock()
            let expiry=DispatchWorkItem { [weak self] in self?.revoke() };self.expiry=expiry
            let now=try sample();guard now<original.deadline,original.deadline-now<=UInt64(Int.max) else { throw PinKnownRefusal() }
            DispatchQueue.main.asyncAfter(deadline: .now() + .nanoseconds(Int(original.deadline-now)),execute:expiry)
            let worker=Thread { [self] in run(original) };lock.lock();self.worker=worker;lock.unlock();worker.start()
        } catch { revoke();if worker==nil { detach();target.close() } }
    }
    private func run(_ original: LocalV2GateInvocation) {
        var native: LocalV2PinOperation?,reply: LocalV2PinReply?,retired=false
        defer {
            if let native,!retired,!native.request.retired { operations.writer.cancel(native.request);joinInput(native)
                if let terminal=native.reply,!terminal.settled { try? operations.settle(terminal,known:false) };try? operations.retire(native)
            }
            if let mutation {
                let retirement=Thread { [self] in
                    while let worker=self.worker,!worker.isFinished { let condition=operations.writer.condition;condition.lock();_ = condition.wait(until:Date(timeIntervalSinceNow:0.01));condition.unlock() }
                    if let native { operations.removeClosedObservers(native) }
                    do { try mutation.publishRetired() } catch { revoke() }
                    DispatchQueue.main.sync { detach() }
                    do { try mutation.retirement();original.close();target.close() }
                    catch { revoke();if let request=mutation.request { let writer=operations.writer;writer.condition.lock();writer.processClock.invalidate(request);writer.condition.unlock() } }
                };self.retirement=retirement;retirement.start()
            } else { if let native { operations.removeClosedObservers(native) };DispatchQueue.main.sync { [self] in detach();original.close();target.close() } }
        }
        do {
            try DispatchQueue.main.sync { try current(allowInput:false) }
            let scope=try operations.writer.storage.locked { transaction -> LocalV2GateScope in
                try original.live(sample());var bytes=try transaction.read();defer { bytes.resetBytes(in:0..<bytes.count) }
                let record=try LocalSnapshotV2.decode(bytes,policy:policy);defer { record.close() };return try LocalV2GateScope(record)
            }
            let challenge=try original.capture(scope,sample())
            native=try DispatchQueue.main.sync { try current(allowInput:false);let value=try operations.begin(challenge,host:host,locale:scope.locale)
                lock.lock();operation=value;lock.unlock();return value }
            guard let native else { throw PinKnownRefusal() };try operations.open(native)
            var expected=try native.request.expected!.copy();defer { expected.resetBytes(in:0..<expected.count) }
            let captured=try LocalSnapshotV2.decode(expected,policy:policy);defer { captured.close() };try scope.initial(captured)
            let terminalLock=NSLock(),terminalReady=DispatchSemaphore(value:0)
            try DispatchQueue.main.sync { try current(allowInput:false)
                let value=try operations.input(native,host:host) { result in
                    try original.live(self.sample());let delivered=try result.get()
                    guard delivered.operation === native,delivered.operation.challenge === challenge else { throw PinKnownRefusal() }
                    terminalLock.lock();reply=delivered;terminalLock.unlock();terminalReady.signal()
                };input=value
            }
            // A watchdog observes actual scope until a real terminal recipient
            // returns. Timeout cancels, but never substitutes for native joins.
            while terminalReady.wait(timeout:.now()) == .timedOut {
                do { try original.live(sample());try DispatchQueue.main.sync { try current(allowInput:true) } }
                catch { revoke() }
                operations.writer.condition.lock();let done=native.inputJoined && native.uiWorkers==0 && native.recipients==0
                if !done { _ = operations.writer.condition.wait(until:Date(timeIntervalSinceNow:0.05)) };operations.writer.condition.unlock()
                if done { break }
            }
            joinInput(native);terminalLock.lock();let terminal=reply;terminalLock.unlock();guard let terminal else { throw PinKnownRefusal() }
            try original.live(sample());try operations.settle(terminal,known:true);try operations.retire(native);retired=true
            let completion=try operations.consumeMatch(terminal,original:challenge);try original.live(sample())
            do { try operations.writer.storage.locked { transaction in
                var actual=try transaction.read();defer { actual.resetBytes(in:0..<actual.count) }
                let record=try LocalSnapshotV2.decode(actual,policy:policy);defer { record.close() }
                guard record.checksum==completion.receiptChecksum,record.fields.revision==completion.receiptRevision else { throw PlanetChildVault.Failure.unavailable }
                try scope.same(record);try original.live(sample())
            } } catch { if !(error is PinKnownRefusal) { let writer=operations.writer;writer.condition.lock();writer.processClock.poisonClosed(native);writer.condition.unlock() };throw error }
            try DispatchQueue.main.sync { try current(allowInput:false);guard invocation === original,operation === native else { throw PinKnownRefusal() }
                let writer=operations.writer,now=try sample();writer.condition.lock()
                do { guard writer.active==nil,writer.processClock.preparingOwner==nil,!writer.processClock.invalidated,
                        writer.processClock.matches(policy),writer.processClock.known?.checksum==completion.receiptChecksum else { throw PinKnownRefusal() }
                    try writer.processClock.observe(now);writer.condition.unlock()
                } catch { writer.condition.unlock();throw error }
                var payload=try original.transfer(completion,reply:terminal,now:now);defer { payload.resetBytes(in:0..<payload.count) }
                if LocalV2CanonicalTransition.handles(original.action) { mutation=try LocalV2GateMutation(self,original,terminal,completion,payload) } else { try dispatch(original.action,payload) }
            }
            if let mutation { try mutation.perform() }
        } catch { revoke() }
    }
    private func joinInput(_ original: LocalV2PinOperation) {
        let condition=operations.writer.condition
        condition.lock();while original.busy || original.request.workers>0 { condition.wait() };condition.unlock()
        // Thread.isFinished is the actual owned input/recipient invocation,
        // beyond the final counted callback; no synthetic join is inferred.
        condition.lock();let worker=original.nativeInputThread;condition.unlock()
        while let worker,!worker.isFinished { condition.lock();_ = condition.wait(until:Date(timeIntervalSinceNow:0.01));condition.unlock() }
    }
    private func detach() {
        guard Thread.isMainThread else { return };control.removeTarget(self,action:#selector(begin),for:.touchUpInside)
        expiry?.cancel();expiry=nil;for observer in observers { NotificationCenter.default.removeObserver(observer) };observers.removeAll()
        witness.owner=nil;witness.willMove(toParent:nil);witness.view.removeFromSuperview();witness.removeFromParent()
        lock.lock();closed=true;lock.unlock()
    }
    func close() { guard Thread.isMainThread else { return };revoke();if worker==nil { detach();target.close() } }
}
/** Prepared structural bytes carry no permission. Profile/access expansion
 * requires a real independently reviewed installed compatible package; until
 * that producer exists the original safe full snapshot stays unchanged. */
fileprivate final class LocalV2CanonicalTransition {
    let action: String,bytes: PinOwnedBytes,requiresPackage: Bool
    init(_ action: String,_ bytes: Data,_ requiresPackage: Bool) { self.action=action;self.bytes=PinOwnedBytes(bytes);self.requiresPackage=requiresPackage }
    static func handles(_ action: String) -> Bool { ["exit-child-mode","switch-adult-profile","change-exact-age","change-blocked-topics","expand-access-settings"].contains(action) }
    func requireAdultExit() throws { guard !requiresPackage,action=="exit-child-mode" || action=="switch-adult-profile" else { throw PinKnownRefusal() } }
    func close() { bytes.close() }
    deinit { close() }
}
fileprivate extension PlanetChildVault.ProtectedEnvelope {
    static func localV2PrepareCanonical(_ before: LocalSnapshotV2,action: String,target: Data) throws -> LocalV2CanonicalTransition {
        try require(LocalV2CanonicalTransition.handles(action) && target.count<=65536 && before.fields.revision<9007199254740991 && before.journal.revision<9007199254740991)
        var raw=try before.copyProtectedBytes();defer { raw.resetBytes(in:0..<raw.count) };let storage=Storage(raw);defer { storage.wipe() };let p=Cursor(storage)
        try p.field("schemaVersion",first:true);_ = try p.number(2,2);try p.field("revision");try require(p.number(1,9007199254740991)==before.fields.revision)
        try p.field("mode");try require(p.asciiString()=="child");try p.field("selectionRevision");let selection=try p.number(1,9007199254740991)
        try p.field("profileRevision");let revision=try p.number(1,9007199254740991);try require(selection<9007199254740991)
        try p.field("policyChecksum");try require(p.asciiString()==before.policy.checksum);try p.field("registryChecksum");let oldSum=try p.asciiString()
        try p.field("registry");let registryStart=p.index;guard let current=try registry(p,version:before.policy.version) else { throw PinKnownRefusal() };let registryEnd=p.index
        var oldRegistry=raw.subdata(in:registryStart..<registryEnd);defer { oldRegistry.resetBytes(in:0..<oldRegistry.count) }
        let registryStorage=Storage(oldRegistry);defer { registryStorage.wipe() };let r=Cursor(registryStorage)
        try r.field("schemaVersion",first:true);_ = try r.number(1,1);try r.field("policyVersion");_ = try r.asciiString();try r.field("activeProfileId");_ = try r.asciiString()
        try r.field("profiles");try r.token("[");var profiles=[Data](),ids=[String](),selected: Int?
        defer { for index in profiles.indices { profiles[index].resetBytes(in:0..<profiles[index].count) } }
        repeat { let start=r.index,id=try profile(r);if current==id { selected=profiles.count };ids.append(id);profiles.append(oldRegistry.subdata(in:start..<r.index)) } while r.take(",")
        try r.token("]");try r.token("}");guard let selected else { throw PinKnownRefusal() }
        var active=current,changed=false;let adult=action=="exit-child-mode" || action=="switch-adult-profile"
        if adult { try require(target.isEmpty) }
        else if action=="expand-access-settings",String(decoding:target,as:UTF8.self).hasPrefix("{\"profileId\":") {
            let selectionStorage=Storage(target);defer { selectionStorage.wipe() };let t=Cursor(selectionStorage)
            try t.field("profileId",first:true);let id=try t.asciiString();try t.token("}");try require(t.index==target.count && ids.contains(id) && id != active);active=id;changed=true
        } else {
            try require(localV2ProfileId(target)==active)
            guard let oldFields=try JSONSerialization.jsonObject(with:profiles[selected]) as? [String:Any],let nextFields=try JSONSerialization.jsonObject(with:target) as? [String:Any] else { throw PinKnownRefusal() }
            let permitted: Set<String>
            if action=="change-exact-age" { permitted=["exactAge","ageBand","ageConfirmedAt"] }
            else if action=="change-blocked-topics" { permitted=["blockedTopics"] }
            else { permitted=["readingLevel","allowedTopics","locale","soundEnabled","motion","narrationEnabled","localeLocked"] }
            for key in Set(oldFields.keys).union(nextFields.keys) {
                let equal: Bool
                if let a=oldFields[key] as? NSObject,let b=nextFields[key] as? NSObject { equal=a.isEqual(b) } else { equal=oldFields[key]==nil && nextFields[key]==nil }
                if !equal { try require(permitted.contains(key));changed=true }
            }
            try require(changed);profiles[selected].resetBytes(in:0..<profiles[selected].count);profiles[selected]=Data(Array(target))
        }
        var nextRegistry=Data(Array(oldRegistry));defer { nextRegistry.resetBytes(in:0..<nextRegistry.count) }
        if changed { try require(revision<9007199254740991);nextRegistry.resetBytes(in:0..<nextRegistry.count)
            nextRegistry=Data("{\"schemaVersion\":1,\"policyVersion\":\"\(before.policy.version)\",\"activeProfileId\":\"\(active)\",\"profiles\":[".utf8)
            for index in profiles.indices { if index>0 { nextRegistry.append(44) };nextRegistry.append(profiles[index]) };nextRegistry.append(Data("]}".utf8))
        }
        let checksum=LocalSnapshotV2.hash(nextRegistry);try require(changed || checksum==oldSum)
        var protectedBytes=Data("{\"schemaVersion\":2,\"revision\":\(before.fields.revision+1),\"mode\":\"\(adult ? "adult":"child")\",\"selectionRevision\":\(selection+1),\"profileRevision\":\(revision+(changed ? 1:0)),\"policyChecksum\":\"\(before.policy.checksum)\",\"registryChecksum\":\"\(checksum)\",\"registry\":".utf8)
        protectedBytes.append(nextRegistry);protectedBytes.append(Data(",\"pin\":".utf8));protectedBytes.append(raw.suffix(from:before.fields.pinStart));defer { protectedBytes.resetBytes(in:0..<protectedBytes.count) }
        let next=try LocalSnapshotV2.wrapper(protectedBytes,policy:before.policy,rootRevision:before.fields.revision+1,journalRevision:before.journal.revision+1,pin:before.fields.pin);defer { next.close() }
        var bytes=try next.copyCanonicalBytes();defer { bytes.resetBytes(in:0..<bytes.count) };return LocalV2CanonicalTransition(action,bytes,!adult)
    }
    static func localV2ValidateCanonical(_ before: LocalSnapshotV2,_ after: LocalSnapshotV2,action: String,target: Data) throws {
        try require(LocalSnapshotV2.samePolicy(before,after));let exact=try localV2PrepareCanonical(before,action:action,target:target);defer { exact.close() }
        var expected=try exact.bytes.copy(),actual=try after.copyCanonicalBytes();defer { expected.resetBytes(in:0..<expected.count);actual.resetBytes(in:0..<actual.count) };try require(expected==actual)
    }
}

/** This concrete handoff retains the exact original consumed terminal and
 * native control. No boolean, P1 receipt or recreated challenge enters it. */
fileprivate final class LocalV2GateMutation {
    let host: LocalV2GateHost,original: LocalV2GateInvocation,reply: LocalV2PinReply,completion: LocalV2PinCompletion,target: PinOwnedBytes
    private(set) var request: LocalV2Request?
    fileprivate var next: PinOwnedBytes?,wrote=false,known=false
    private var recipientJoined=false,retired=false
    init(_ host: LocalV2GateHost,_ original: LocalV2GateInvocation,_ reply: LocalV2PinReply,_ completion: LocalV2PinCompletion,_ target: Data) throws {
        self.host=host;self.original=original;self.reply=reply;self.completion=completion;self.target=PinOwnedBytes(target);try proof()
    }
    func proof() throws {
        host.lock.lock();let exact=host.invocation === original && host.operation === reply.operation && !host.revoked && !host.closed;host.lock.unlock()
        guard exact,!retired,completion.original === original.original,reply.operation.challenge === original.original,original.original?.original === original,
            reply.kind == .match,reply.completed,reply.settled,reply.known,reply.consumed,reply.operation.closedKnown,!reply.operation.closedRevoked,
            reply.operation.request.retired,!reply.operation.request.sealed,completion.receiptChecksum==reply.receipt.checksum,completion.receiptRevision==reply.receipt.revision,
            LocalV2CanonicalTransition.handles(original.action) else { throw PinKnownRefusal() }
        var bytes=try target.copy();defer { bytes.resetBytes(in:0..<bytes.count) };guard LocalSnapshotV2.hash(bytes)==original.targetChecksum else { throw PinKnownRefusal() }
        try original.execution(reply,host.sample())
    }
    func boundary() throws {
        guard let worker=host.worker,ObjectIdentifier(Thread.current)==ObjectIdentifier(worker)
            || known && worker.isFinished && host.retirement.map(ObjectIdentifier.init)==ObjectIdentifier(Thread.current) else { throw PinKnownRefusal() }
        try proof();guard let request else { throw PinKnownRefusal() };_ = try host.operations.writer.gateMutationLocal(request)
    }
    func perform() throws {
        guard host.worker.map(ObjectIdentifier.init)==ObjectIdentifier(Thread.current) else { throw PinKnownRefusal() }
        try proof();let writer=host.operations.writer
        let request=try DispatchQueue.main.sync { try host.current(allowInput:false);try proof()
            let value=try writer.request(host:host.host,timeoutMs:1,originalDeadlineNs:original.deadline);self.request=value;return value }
        do {
            try writer.performGateMutation(self,request)
        } catch {
            if let receipt=request.receipt,!receipt.settled { try? writer.settle(receipt,known:false) }
            if wrote { writer.condition.lock();writer.processClock.invalidate(request);request.sealed=true;writer.condition.unlock() };throw error
        }
    }
    func publishRetired() throws {
        guard let worker=host.worker,worker.isFinished,host.retirement.map(ObjectIdentifier.init)==ObjectIdentifier(Thread.current) else { throw PinKnownRefusal() };if !known { return }
        guard let request else { throw PinKnownRefusal() };let writer=host.operations.writer
        do {
            try DispatchQueue.main.sync { try host.current(allowInput:false) }
            try writer.storage.locked { transaction in try boundary();var actual=try transaction.read(),expected=try next!.copy();defer { actual.resetBytes(in:0..<actual.count);expected.resetBytes(in:0..<expected.count) }
                guard actual==expected else { throw PlanetChildVault.Failure.unavailable };writer.condition.lock();defer { writer.condition.unlock() };try writer.processClock.requireBound(request,actual)
            }
            // Thread.isFinished above is the original canonical worker, not a
            // counted completion flag. Only then may the native recipient run.
            try DispatchQueue.main.sync { try host.current(allowInput:false);try proof();_ = try writer.gateMutationLocal(request)
                var bytes=try target.copy();defer { bytes.resetBytes(in:0..<bytes.count) }
                defer { recipientJoined=true };try host.dispatch(original.action,bytes)
            }
            try writer.storage.locked { transaction in try boundary();var actual=try transaction.read(),expected=try next!.copy();defer { actual.resetBytes(in:0..<actual.count);expected.resetBytes(in:0..<expected.count) }
                guard known,recipientJoined,actual==expected else { throw PlanetChildVault.Failure.unavailable }
                writer.condition.lock();defer { writer.condition.unlock() };try writer.processClock.requireBound(request,actual)
            }
        } catch {
            writer.condition.lock();writer.processClock.invalidate(request);request.sealed=true;writer.condition.unlock();throw error
        }
    }
    func retirement() throws {
        guard let worker=host.worker,worker.isFinished,host.retirement.map(ObjectIdentifier.init)==ObjectIdentifier(Thread.current) else { throw PinKnownRefusal() }
        defer { retired=true;next?.close();target.close() }
        if known { do { guard recipientJoined,!host.revoked else { throw PinKnownRefusal() };try original.execution(reply,host.sample());guard let request else { throw PinKnownRefusal() };let writer=host.operations.writer;_ = try writer.gateMutationLocal(request)
                try writer.storage.locked { transaction in var actual=try transaction.read(),expected=try next!.copy();defer { actual.resetBytes(in:0..<actual.count);expected.resetBytes(in:0..<expected.count) }
                    guard actual==expected else { throw PlanetChildVault.Failure.unavailable };writer.condition.lock();do { try writer.processClock.requireBound(request,actual);writer.condition.unlock() } catch { writer.condition.unlock();throw error };try original.execution(reply,host.sample()) }
            }
            catch { if let request { let writer=host.operations.writer;writer.condition.lock();writer.processClock.invalidate(request);request.sealed=true;writer.condition.unlock() } } }
        if let request { try host.operations.writer.retire(request) }
    }
}
fileprivate extension LocalV2Writer {
    func gateMutationLocal(_ request: LocalV2Request) throws -> UInt64 { try local(request) }
    func performGateMutation(_ mutation: LocalV2GateMutation,_ request: LocalV2Request) throws {
        guard mutation.request === request,request.owner === self,request.deadline==mutation.original.deadline else { throw PinKnownRefusal() }
        try start(request,opened:false);var publication=false
        do {
            _ = try current(request);try mutation.proof()
            try storage.locked { transaction in
                try mutation.boundary();var before=try transaction.read();defer { before.resetBytes(in:0..<before.count) }
                condition.lock();do { try processClock.requireBound(request,before);condition.unlock() } catch { condition.unlock();throw error }
                guard LocalSnapshotV2.hash(before)==mutation.completion.receiptChecksum else { throw PinKnownRefusal() }
                let old=try LocalSnapshotV2.decode(before,policy:policy);defer { old.close() };try mutation.original.scope!.same(old)
                condition.lock();do { try processClock.requireBound(request,before);request.expected=PinOwnedBytes(before);request.opened=true;condition.unlock() } catch { condition.unlock();throw error }
                var payload=try mutation.target.copy();defer { payload.resetBytes(in:0..<payload.count) }
                let prepared=try PlanetChildVault.ProtectedEnvelope.localV2PrepareCanonical(old,action:mutation.original.action,target:payload);defer { prepared.close() }
                try prepared.requireAdultExit()
                var after=try prepared.bytes.copy();defer { after.resetBytes(in:0..<after.count) };let next=try LocalSnapshotV2.decode(after,policy:policy);defer { next.close() }
                try PlanetChildVault.ProtectedEnvelope.localV2ValidateCanonical(old,next,action:mutation.original.action,target:payload)
                condition.lock();request.mutationUnacknowledged=true;condition.unlock();publication=true;mutation.wrote=true
                try write(transaction,request,before,after,permission:mutation.boundary)
                condition.lock();do { try processClock.stage(request,after,next);request.expected?.close();request.expected=PinOwnedBytes(after);mutation.next=PinOwnedBytes(after);condition.unlock() } catch { condition.unlock();throw error }
            }
            finish(request)
        } catch { fail(request,error,publication:publication);finish(request);throw error }
        // Existing native receipt delivery + exact readback/known ACK are used
        // here; a prepared transition is never promoted into permission.
        var after=try mutation.next!.copy();defer { after.resetBytes(in:0..<after.count) };let next=try LocalSnapshotV2.decode(after,policy:policy);defer { next.close() }
        var receipt: LocalV2StorageReceipt?
        try publish(request,next,after,false) { original in try mutation.boundary();guard original.request === request else { throw PinKnownRefusal() };receipt=original }
        guard let receipt else { throw PlanetChildVault.Failure.unavailable };try settle(receipt,known:true);mutation.known=true;try mutation.boundary()
    }
}

#if DEBUG
/** Explicit fixture-only canonical/control refusal observations. No synthetic
 * completion is constructed and no fixture can activate the native Gate. */
enum PlanetChildLocalGateScenario: String,CaseIterable {
    case selectedContext,contextSubstitution,targetOwnership,exclusiveDeadline,failedTransfer,actions,adultContext,initialRevision
}
struct PlanetChildLocalGateObservation { var passed=false,deadline: UInt64=0,profileRevision: UInt64=0,selectionRevision: UInt64=0,actionCount=0 }
enum PlanetChildLocalGateRuntimeFixture {
    private static func policy() throws -> LocalSnapshotV2Policy {
        try LocalSnapshotV2Policy(version:"synthetic-local-gate-v2",checksum:String(repeating:"a",count:64),maximum:600000,delays:[100,250])
    }
    private static func record(_ p: LocalSnapshotV2Policy,profile: UInt64=2,selection: UInt64=3,locale: String="en",mode: String="child",root: UInt64=2) throws -> LocalSnapshotV2 {
        let registry=#"{"schemaVersion":1,"policyVersion":"\#(p.version)","activeProfileId":"reader","profiles":[{"id":"reader","label":"Native Reader","exactAge":9,"ageBand":"9-11","locale":"\#(locale)","ageConfirmedAt":"2026-10-01T12:00:00.000Z","readingLevel":null,"allowedTopics":null,"blockedTopics":[],"soundEnabled":false,"motion":"calm","narrationEnabled":false}]}"#
        let pin=#"{"schemaVersion":1,"policyVersion":"\#(p.version)","revision":1,"credentialId":"\#(String(repeating:"b",count:64))","verifier":{"algorithm":"PBKDF2-HMAC-SHA256","iterations":600000,"saltHex":"\#(String(repeating:"c",count:64))","hashHex":"\#(String(repeating:"d",count:64))"},"attempts":{"count":0,"blockedUntilMs":0,"lastObservedMs":0,"pendingAttemptId":null}}"#
        var bytes=Data(#"{"schemaVersion":2,"revision":\#(root),"mode":"\#(mode)","selectionRevision":\#(selection),"profileRevision":\#(profile),"policyChecksum":"\#(p.checksum)","registryChecksum":"\#(LocalSnapshotV2.hash(Data(registry.utf8)))","registry":\#(registry),"pin":\#(pin),"clock":{"schemaVersion":2,"logicalMs":0}}"#.utf8)
        defer { bytes.resetBytes(in:0..<bytes.count) }
        let fields=LocalV2PinFields(revision:1,credential:String(repeating:"b",count:64),count:0,blocked:0,observed:0,pending:nil,revisionStart:0,revisionEnd:0,attemptsStart:0)
        return try LocalSnapshotV2.wrapper(bytes,policy:p,rootRevision:root,journalRevision:1,pin:fields)
    }
    private static func denied(_ work: () throws -> Void) -> Bool { do { try work();return false } catch { return true } }
    static func run(_ scenario: PlanetChildLocalGateScenario) throws -> PlanetChildLocalGateObservation {
        let p=try policy(),snapshot=try record(p);defer { snapshot.close() };let scope=try LocalV2GateScope(snapshot)
        var result=PlanetChildLocalGateObservation()
        switch scenario {
        case .selectedContext:
            let selected=try record(p,profile:4,selection:7,locale:"ru");defer { selected.close() };let exact=try LocalV2GateScope(selected)
            result.profileRevision=exact.context.profileRevision;result.selectionRevision=exact.selectionRevision
            result.passed=exact.context.profileId=="reader" && exact.context.policyVersion==p.version && exact.locale == .ru && result.profileRevision==4 && result.selectionRevision==7
        case .contextSubstitution:
            let changed=[try record(p,profile:3),try record(p,selection:4),try record(p,locale:"ru")];defer { for item in changed { item.close() } }
            result.passed=changed.allSatisfy { current in denied { try scope.same(current) } }
        case .targetOwnership:
            var caller=Data([1,2,3]);let expected=LocalSnapshotV2.hash(caller)
            let original=try LocalV2GateInvocation(action:"share",target:caller,generation:4,beganNs:100000001,verificationMs:5000,capabilityMs:3000);defer { original.close() }
            caller.resetBytes(in:0..<caller.count);let challenge=try original.capture(scope,101000000);result.deadline=original.deadline
            result.passed=challenge.original === original && challenge.target==expected && challenge.gate?.context==scope.context && result.deadline==3100000000
                && denied { _ = try original.capture(scope,102000000) }
        case .exclusiveDeadline:
            let original=try LocalV2GateInvocation(action:"diagnostics",target:Data(),generation:1,beganNs:100000001,verificationMs:100,capabilityMs:200);defer { original.close() }
            try original.live(199999999);result.passed=denied { try original.live(200000000) } && denied { try original.live(101000000) }
            let revoked=try LocalV2GateInvocation(action:"share",target:Data(),generation:2,beganNs:100000001,verificationMs:100,capabilityMs:100);defer { revoked.close() };revoked.revoke()
            result.passed = result.passed && denied { try revoked.live(101000000) }
            let regressed=try LocalV2GateInvocation(action:"share",target:Data(),generation:3,beganNs:100000000,verificationMs:100,capabilityMs:100);defer { regressed.close() }
            try regressed.live(150000000);result.passed = result.passed && denied { try regressed.live(149000000) } && denied { try regressed.live(151000000) }
        case .failedTransfer:
            let original=try LocalV2GateInvocation(action:"share",target:Data([1]),generation:1,beganNs:100000000,verificationMs:1000,capabilityMs:1000);defer { original.close() }
            _ = try original.capture(scope,101000000)
            result.passed=denied { _ = try original.transfer(nil,reply:nil,now:102000000) } && denied { try original.live(103000000) }
                && denied { _ = try original.transfer(nil,reply:nil,now:103000000) }
        case .actions:
            let actions=["exit-child-mode","switch-adult-profile","change-exact-age","change-blocked-topics","open-adult-store","initiate-purchase","restore-purchases","open-external","share","account-change","export-child-data","delete-child-data","diagnostics","expand-access-settings","enable-licensed-pack","view-legal-commercial"]
            for action in actions { let original=try LocalV2GateInvocation(action:action,target:Data([1]),generation:1,beganNs:100000000,verificationMs:1000,capabilityMs:1000)
                let challenge=try original.capture(scope,101000000);if challenge.action==action { result.actionCount+=1 };original.close() }
            result.passed=result.actionCount==16 && denied { _ = try LocalV2GateInvocation(action:"unlock-anything",target:Data(),generation:1,beganNs:100000000,verificationMs:1000,capabilityMs:1000) }
        case .adultContext:
            let adult=try record(p,mode:"adult");defer { adult.close() };result.passed=denied { _ = try LocalV2GateScope(adult) }
        case .initialRevision:
            let newer=try record(p,root:3);defer { newer.close() };try scope.same(newer);result.passed=denied { try scope.initial(newer) }
        }
        return result
    }
    static func unattachedUIKitHostIsRefused() throws -> Bool {
        guard Thread.isMainThread else { throw PinKnownRefusal() };let host=UIViewController();host.loadViewIfNeeded();let control=UIButton(type:.system);host.view.addSubview(control)
        return denied { _ = try LocalV2GateHost.originalWindow(host:host,control:control) }
    }
}
#endif

fileprivate extension PlanetChildVault.ProtectedEnvelope {
    static func localV2ProfileId(_ bytes: Data) throws -> String {
        try require(!bytes.isEmpty && bytes.count<=65536);let storage=Storage(bytes);defer { storage.wipe() };let p=Cursor(storage)
        let id=try profile(p);try require(p.index==bytes.count);return id
    }
    static func localV2NativeProfile(_ proposal: Data,id: String) throws -> Data {
        _ = try localV2ProfileId(proposal);let storage=Storage(proposal);defer { storage.wipe() };let p=Cursor(storage)
        try p.field("id",first:true);let start=p.index;_ = try p.asciiString();let end=p.index
        var result=Data(proposal.prefix(start));result.append(Data("\"\(id)\"".utf8));result.append(proposal.suffix(from:end));_ = try localV2ProfileId(result);return result
    }
    static func localV2FirstProfile(_ before: LocalSnapshotV2,profile bytes: Data) throws -> LocalSnapshotV2 {
        let id=try localV2ProfileId(bytes);var raw=try before.copyProtectedBytes();defer { raw.resetBytes(in:0..<raw.count) }
        let storage=Storage(raw);defer { storage.wipe() };let p=Cursor(storage),max=UInt64(9007199254740991)
        try p.field("schemaVersion",first:true);_ = try p.number(2,2);try p.field("revision");try require(p.number(1,max)==before.fields.revision && before.fields.revision<max)
        try p.field("mode");try require(p.asciiString()=="adult");try p.field("selectionRevision");try require(p.number(1,max)==1)
        try p.field("profileRevision");try require(p.number(1,max)==1);try p.field("policyChecksum");try require(p.asciiString()==before.policy.checksum)
        try p.field("registryChecksum");_ = try p.hashRange();try p.field("registry");let start=p.index;try require(registry(p,version:before.policy.version)==nil)
        let empty=Data("{\"schemaVersion\":1,\"policyVersion\":\"\(before.policy.version)\",\"activeProfileId\":null,\"profiles\":[]}".utf8)
        try require(raw.subdata(in:start..<p.index)==empty && before.journal.revision<max)
        var registry=Data("{\"schemaVersion\":1,\"policyVersion\":\"\(before.policy.version)\",\"activeProfileId\":\"\(id)\",\"profiles\":[".utf8)
        registry.append(bytes);registry.append(Data("]}".utf8));defer { registry.resetBytes(in:0..<registry.count) }
        var next=Data("{\"schemaVersion\":2,\"revision\":\(before.fields.revision+1),\"mode\":\"child\",\"selectionRevision\":2,\"profileRevision\":2,\"policyChecksum\":\"\(before.policy.checksum)\",\"registryChecksum\":\"\(LocalSnapshotV2.hash(registry))\",\"registry\":".utf8)
        next.append(registry);next.append(Data(",\"pin\":".utf8));next.append(raw.suffix(from:before.fields.pinStart));defer { next.resetBytes(in:0..<next.count) }
        // Exact original verifier/count/pending/debt/clock bytes survive. The
        // shared process origin is never reconstructed from this new journal.
        return try LocalSnapshotV2.wrapper(next,policy:before.policy,rootRevision:before.fields.revision+1,journalRevision:before.journal.revision+1,pin:before.fields.pin)
    }
    static func localV2ValidateFirstProfile(_ before: LocalSnapshotV2,_ after: LocalSnapshotV2) throws {
        try require(LocalSnapshotV2.samePolicy(before,after))
        var raw=try after.copyProtectedBytes();defer { raw.resetBytes(in:0..<raw.count) };let storage=Storage(raw);defer { storage.wipe() };let p=Cursor(storage)
        try p.field("schemaVersion",first:true);_ = try p.number(2,2);try p.field("revision");_ = try p.number(1,9007199254740991);try p.field("mode");try require(p.asciiString()=="child")
        try p.field("selectionRevision");_ = try p.number(1,9007199254740991);try p.field("profileRevision");_ = try p.number(1,9007199254740991)
        try p.field("policyChecksum");_ = try p.asciiString();try p.field("registryChecksum");_ = try p.hashRange();try p.field("registry")
        try p.field("schemaVersion",first:true);_ = try p.number(1,1);try p.field("policyVersion");try require(p.asciiString()==before.policy.version)
        try p.field("activeProfileId");let id=try p.asciiString();try p.field("profiles");try p.token("[");let start=p.index;try require(profile(p)==id);let end=p.index;try p.token("]");try p.token("}")
        let expected=try localV2FirstProfile(before,profile:raw.subdata(in:start..<end));defer { expected.close() }
        var a=try expected.copyCanonicalBytes(),b=try after.copyCanonicalBytes();defer { a.resetBytes(in:0..<a.count);b.resetBytes(in:0..<b.count) };try require(a==b)
    }
}
fileprivate enum LocalV2ProfilePhase: Equatable { case captured,confirming,owner,signed,dataPublishing,dataKnown,profilePublishing,profileKnown,closed,failed }
/** This concrete permit is created only by the original fresh Secure Enclave
 * signing operation. The separate store cannot construct or reconstruct it. */
final class LocalV2ProfileDataBirthPermit {
    fileprivate let original: LocalV2ProfileOperation
    fileprivate init(_ original: LocalV2ProfileOperation) { self.original=original }
    private func exact(identity: String,nonce: String,checksum: String) throws {
        try original.boundary();guard let plan=original.dataPlan,plan.identity==identity,plan.nonce==nonce,plan.checksum==checksum else { throw PinKnownRefusal() }
    }
    func consumeDataBirth(identity: String,nonce: String,checksum: String) throws {
        try exact(identity:identity,nonce:nonce,checksum:checksum)
        guard original.phase == .signed,!original.dataSpent else { throw PinKnownRefusal() };original.dataSpent=true;original.phase = .dataPublishing
    }
    func dataMarker(identity: String,nonce: String,checksum: String) throws -> Data {
        try exact(identity:identity,nonce:nonce,checksum:checksum);guard original.phase == .dataPublishing else { throw PinKnownRefusal() }
        return Data("LP-LOCAL-V2-DATA-BIRTH\n\(identity)\n\(nonce)\n\(checksum)\n\(LocalSnapshotV2.hash(original.payload))\n".utf8)
    }
    func dataBoundary(identity: String,nonce: String,checksum: String) throws {
        try exact(identity:identity,nonce:nonce,checksum:checksum);guard original.phase == .dataPublishing else { throw PinKnownRefusal() }
    }
    func dataBirthKnown(identity: String,nonce: String,checksum: String) throws {
        try dataBoundary(identity:identity,nonce:nonce,checksum:checksum);original.phase = .dataKnown
    }
    func dataReadback(identity: String,nonce: String,checksum: String) throws {
        try exact(identity:identity,nonce:nonce,checksum:checksum)
        guard [.dataKnown,.profilePublishing,.profileKnown,.closed].contains(original.phase) else { throw PinKnownRefusal() }
    }
    func dataBirthUnknown() { original.phase = .failed;original.writer.profileUnknown(original.request) }
}
/** Mutation metadata only. This result cannot grant ParentGate or child-data
 * admission. Its producer has joined UI, signing, recipient, cancel and retire. */
fileprivate final class LocalV2ProfileCompletion {
    let profileId: String,snapshotChecksum: String,dataChecksum: String,revision: UInt64
    fileprivate init(_ original: LocalV2ProfileOperation) throws {
        guard original.phase == .closed,original.delivered,original.request.retired,!original.request.sealed,!original.cancelled,
            original.worker?.isFinished==true,original.cancelThread==nil,let snapshot=original.nextSnapshot,let data=original.dataPlan else { throw PinKnownRefusal() }
        profileId=original.profileId;snapshotChecksum=snapshot.checksum;dataChecksum=data.checksum;revision=snapshot.fields.revision
    }
}
fileprivate final class LocalV2ProfileConfirmation: UIViewController {
    weak var original: LocalV2ProfileOperation?
    private let profile: Data
    fileprivate var closing=false
    init(_ original: LocalV2ProfileOperation,_ profile: Data) { self.original=original;self.profile=Data(Array(profile));super.init(nibName:nil,bundle:nil);modalPresentationStyle = .fullScreen;isModalInPresentation=true }
    required init?(coder: NSCoder) { nil }
    override func viewDidLoad() {
        super.viewDidLoad();view.backgroundColor = .systemBackground
        let stack=UIStackView();stack.axis = .vertical;stack.spacing=18;stack.translatesAutoresizingMaskIntoConstraints=false
        let scroll=UIScrollView();scroll.translatesAutoresizingMaskIntoConstraints=false;view.addSubview(scroll);scroll.addSubview(stack)
        let heading=UILabel();heading.numberOfLines=0;heading.text=original?.locale=="ru" ? "Подтвердите первый локальный профиль и детский режим":"Confirm first local profile and child mode";stack.addArrangedSubview(heading)
        // Render the exact proposed decisions without exposing transport fields.
        let ru=original?.locale=="ru"
        guard let values=(try? JSONSerialization.jsonObject(with:profile)) as? [String:Any] else { original?.revoke();return }
        let fields=[("label","Имя","Label"),("exactAge","Точный возраст","Exact age"),("ageBand","Возрастная группа","Age band"),("locale","Язык","Language"),("ageConfirmedAt","Подтверждение возраста","Age confirmation"),("readingLevel","Уровень чтения","Reading level"),("allowedTopics","Разрешённые темы","Allowed topics"),("blockedTopics","Закрытые темы","Blocked topics"),("soundEnabled","Звук","Sound"),("motion","Движение","Motion"),("narrationEnabled","Озвучивание","Narration"),("localeLocked","Фиксация языка","Language lock")]
        do { for field in fields { let label=UILabel();label.numberOfLines=0;label.text=(ru ? field.1:field.2)+": "+(try Self.confirmationValue(values[field.0],field:field.0,ru:ru));stack.addArrangedSubview(label) } }
        catch { original?.revoke();return }
        let accept=UIButton(type:.system);accept.setTitle(original?.locale=="ru" ? "Подтвердить":"Confirm",for:.normal);accept.addTarget(self,action:#selector(confirm),for:.touchUpInside);stack.addArrangedSubview(accept)
        let cancel=UIButton(type:.system);cancel.setTitle(original?.locale=="ru" ? "Отмена":"Cancel",for:.normal);cancel.addTarget(self,action:#selector(cancelled),for:.touchUpInside);stack.addArrangedSubview(cancel)
        NSLayoutConstraint.activate([scroll.leadingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.leadingAnchor,constant:20),scroll.trailingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.trailingAnchor,constant:-20),scroll.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),scroll.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor),stack.leadingAnchor.constraint(equalTo:scroll.contentLayoutGuide.leadingAnchor),stack.trailingAnchor.constraint(equalTo:scroll.contentLayoutGuide.trailingAnchor),stack.topAnchor.constraint(equalTo:scroll.contentLayoutGuide.topAnchor,constant:20),stack.bottomAnchor.constraint(equalTo:scroll.contentLayoutGuide.bottomAnchor,constant:-20),stack.widthAnchor.constraint(equalTo:scroll.frameLayoutGuide.widthAnchor)])
    }
    private static func confirmationValue(_ value: Any?,field: String,ru: Bool) throws -> String {
        guard let value else { return ru ? "не задано":"not set" }
        if value is NSNull { return field=="allowedTopics" ? (ru ? "Все темы, кроме запрещённых":"All topics except blocked topics"):(ru ? "не задано":"not set") }
        if let number=value as? NSNumber,CFGetTypeID(number)==CFBooleanGetTypeID() { return number.boolValue ? (ru ? "Включено":"On"):(ru ? "Выключено":"Off") }
        if let topics=value as? [String] { if topics.isEmpty { return ru ? "Нет":"None" };return try topics.map { try topicText($0,ru:ru) }.joined(separator:", ") }
        let raw=String(describing:value)
        if field=="locale" { return raw=="ru" ? (ru ? "Русский":"Russian"):(ru ? "Английский":"English") }
        if field=="readingLevel" { if raw=="plain" { return ru ? "Простой текст":"Simple text" };if raw=="developing" { return ru ? "Учится читать":"Developing reader" };return ru ? "Свободно читает":"Fluent reader" }
        if field=="motion" { return raw=="calm" ? (ru ? "Спокойное движение":"Calm motion"):(ru ? "Как в настройках устройства":"Use device settings") }
        if field=="ageConfirmedAt" { return raw.replacingOccurrences(of:"T",with:" ").replacingOccurrences(of:"Z",with:" UTC") };return raw
    }
    private static func topicText(_ topic: String,ru: Bool) throws -> String {
        let names=[("nature","Природа","Nature"),("horror","Ужасы","Horror"),("adventure","Приключения","Adventure"),("violence","Насилие","Violence")]
        if let item=names.first(where:{ $0.0==topic }) { return ru ? item.1:item.2 };throw PinKnownRefusal()
    }
    @objc private func confirm() { guard Thread.isMainThread,view.window?.isKeyWindow==true else { original?.revoke();return };original?.confirmed(self) }
    @objc private func cancelled() { original?.revoke() }
    override func viewWillDisappear(_ animated: Bool) { super.viewWillDisappear(animated);if !closing { original?.revoke() } }
}
fileprivate final class LocalV2ProfileRouteWitness: UIViewController {
    weak var original: LocalV2ProfileOperation?
    override func loadView() { let view=UIView(frame:.zero);view.isUserInteractionEnabled=false;self.view=view }
    override func viewWillDisappear(_ animated: Bool) { super.viewWillDisappear(animated);original?.routeDisappearing() }
    override func didMove(toParent parent: UIViewController?) { super.didMove(toParent:parent);if parent==nil { original?.revoke() } }
}
/** Private, usable native first-profile operation. Enrollment must already
 * exist; P1 receipts, caller booleans and raw partitions never authorize it. */
fileprivate final class LocalV2ProfileOperation {
    let writer: LocalV2Writer,request: LocalV2Request,host: UIViewController,window: UIWindow,scene: UIWindowScene,root: UIViewController,profileId: String,locale: String
    let keys=ApplePinOwnerKeys(),context=LAContext(),nonce: Data
    var profile: Data,before=Data(),next=Data(),payload=Data(),signature=Data()
    private var beforeChecksum=""
    var key: PinOwnerKey?,nextSnapshot: LocalSnapshotV2?,dataPlan: PlanetChildDataStore.LocalV2BirthPlan?,dataReceipt: PlanetChildDataStore.LocalV2BirthReceipt?
    private let stateLock=NSRecursiveLock()
    private var nativePhase: LocalV2ProfilePhase = .captured,nativeCancelled=false,nativeOwnerPending=false,nativeOwnerReturned=false,nativeConfirmed=false,nativeFinished=false,nativeDelivered=false,nativeUIJoined=false,nativeClosedCandidate=false
    private var nativeController: LocalV2ProfileConfirmation?
    var phase: LocalV2ProfilePhase { get { stateLock.lock();defer { stateLock.unlock() };return nativePhase } set { stateLock.lock();nativePhase=newValue;stateLock.unlock() } }
    var cancelled: Bool { get { stateLock.lock();defer { stateLock.unlock() };return nativeCancelled } set { stateLock.lock();nativeCancelled=newValue;stateLock.unlock() } }
    var ownerPending: Bool { get { stateLock.lock();defer { stateLock.unlock() };return nativeOwnerPending } set { stateLock.lock();nativeOwnerPending=newValue;stateLock.unlock() } }
    var ownerReturned: Bool { get { stateLock.lock();defer { stateLock.unlock() };return nativeOwnerReturned } set { stateLock.lock();nativeOwnerReturned=newValue;stateLock.unlock() } }
    var confirmedValue: Bool { get { stateLock.lock();defer { stateLock.unlock() };return nativeConfirmed } set { stateLock.lock();nativeConfirmed=newValue;stateLock.unlock() } }
    var finished: Bool { get { stateLock.lock();defer { stateLock.unlock() };return nativeFinished } set { stateLock.lock();nativeFinished=newValue;stateLock.unlock() } }
    var delivered: Bool { get { stateLock.lock();defer { stateLock.unlock() };return nativeDelivered } set { stateLock.lock();nativeDelivered=newValue;stateLock.unlock() } }
    var uiJoined: Bool { get { stateLock.lock();defer { stateLock.unlock() };return nativeUIJoined } set { stateLock.lock();nativeUIJoined=newValue;stateLock.unlock() } }
    var closedKnownCandidate: Bool { get { stateLock.lock();defer { stateLock.unlock() };return nativeClosedCandidate } set { stateLock.lock();nativeClosedCandidate=newValue;stateLock.unlock() } }
    var controller: LocalV2ProfileConfirmation? { get { stateLock.lock();defer { stateLock.unlock() };return nativeController } set { stateLock.lock();nativeController=newValue;stateLock.unlock() } }
    var dataSpent=false,completionConsumed=false
    var worker: Thread?,settler: Thread?,cancelThread: Thread?,publicationThread: ObjectIdentifier?
    private let routeWitness=LocalV2ProfileRouteWitness(),recipient: (LocalV2ProfileOperation) throws -> Void
    private var closingTokens=[NSObjectProtocol](),keyObserver: NSObjectProtocol?,closedResult: LocalV2ProfileCompletion?
    var ownedPrompt: Bool { phase == .owner && ownerPending && !ownerReturned && !cancelled && !finished }
    var busy: Bool { !finished || controller != nil || cancelThread != nil }
    private init(_ writer: LocalV2Writer,_ request: LocalV2Request,_ host: UIViewController,_ proposal: Data,_ recipient: @escaping (LocalV2ProfileOperation) throws -> Void) throws {
        self.writer=writer;self.request=request;self.host=host;self.recipient=recipient
        guard Thread.isMainThread,let window=host.viewIfLoaded?.window,let scene=window.windowScene,let root=window.rootViewController,window.isKeyWindow else { throw PinKnownRefusal() };self.window=window;self.scene=scene;self.root=root
        var random=Data(count:32);guard random.withUnsafeMutableBytes({ SecRandomCopyBytes(kSecRandomDefault,32,$0.baseAddress!) })==errSecSuccess else { throw PlanetChildVault.Failure.unavailable }
        nonce=random;profileId="child-"+random.prefix(16).map { String(format:"%02x",$0) }.joined();profile=try PlanetChildVault.ProtectedEnvelope.localV2NativeProfile(proposal,id:profileId)
        guard let value=try JSONSerialization.jsonObject(with:profile) as? [String:Any],let locale=value["locale"] as? String else { throw PinKnownRefusal() };self.locale=locale
        writer.condition.lock();defer { writer.condition.unlock() }
        let id=random.map { String(format:"%02x",$0) }.joined(),identity=ObjectIdentifier(self)
        guard writer.active === request,request.profileOperation==nil,request.pinOperation==nil,writer.processClock.pinUsedIds.count<2048,!writer.processClock.pinUsedIds.contains(id),writer.processClock.pinUsedChallenges[identity]==nil else { throw PinKnownRefusal() }
        writer.processClock.pinUsedIds.insert(id);writer.processClock.pinUsedChallenges[identity]=self;request.profileOperation=self
    }
    static func begin(vault: PlanetChildVault,policy: LocalSnapshotV2Policy,host: UIViewController,proposal: Data,timeoutMs: UInt64,recipient: @escaping (LocalV2ProfileOperation) throws -> Void) throws -> LocalV2ProfileOperation {
        guard Thread.isMainThread else { throw PinKnownRefusal() };let writer=try LocalV2Writer.pinRuntime(vault:vault,policy:policy),request=try writer.request(host:host,timeoutMs:timeoutMs)
        do {
            let original=try LocalV2ProfileOperation(writer,request,host,Data(Array(proposal)),recipient)
            original.keyObserver=NotificationCenter.default.addObserver(forName:UIWindow.didResignKeyNotification,object:original.window,queue:nil) { [weak original] _ in guard let original,!original.ownedPrompt else { return };original.revoke() }
            original.routeWitness.original=original;host.addChild(original.routeWitness);host.view.addSubview(original.routeWitness.view);original.routeWitness.didMove(toParent:host)
            let worker=Thread { original.run() };original.worker=worker;worker.start()
            let settler=Thread { original.closeAfterJoin() };original.settler=settler;settler.start();return original
        } catch { writer.cancel(request);Thread { try? writer.retire(request) }.start();throw error }
    }
    func revokeLocked() {
        if closedKnownCandidate { return } // retire is mechanical; closing observers remain live.
        cancelled=true
        guard !finished,ownerPending else { writer.condition.broadcast();return }
        if cancelThread==nil { let thread=Thread { [self] in context.invalidate();writer.condition.lock();writer.condition.broadcast();writer.condition.unlock() };cancelThread=thread;thread.start() }
        writer.condition.broadcast()
    }
    func revoke() { writer.condition.lock();closedKnownCandidate=false;revokeLocked();writer.condition.unlock();writer.cancel(request) }
    func routeDisappearing() { guard Thread.isMainThread else { revoke();return };if host.presentedViewController !== controller || controller==nil { revoke() } }
    func confirmed(_ native: LocalV2ProfileConfirmation) {
        writer.condition.lock();defer { writer.condition.unlock() }
        guard Thread.isMainThread,controller === native,phase == .confirming,!cancelled,!confirmedValue else { revokeLocked();return };confirmedValue=true;writer.condition.broadcast()
    }
    fileprivate func currentWindow() throws {
        let valid=DispatchQueue.main.sync { self.window.isKeyWindow && self.window.windowScene === self.scene && self.window.rootViewController === self.root && !self.window.isHidden };guard valid else { throw PinKnownRefusal() }
    }
    private func currentHost() throws { _ = try writer.current(request);try currentWindow() }
    private func confirm() throws {
        try currentHost();phase = .confirming
        try DispatchQueue.main.sync { guard host.presentedViewController==nil else { throw PinKnownRefusal() };let native=LocalV2ProfileConfirmation(self,profile);controller=native;host.present(native,animated:false) }
        while true { try currentHost();writer.condition.lock();let ready=confirmedValue,denied=cancelled;writer.condition.unlock();if denied { throw PinKnownRefusal() };if ready { break };Thread.sleep(forTimeInterval:0.01) }
        try dismissConfirmation();try currentHost()
    }
    private func dismissConfirmation() throws {
        let joined=DispatchSemaphore(value:0)
        DispatchQueue.main.sync { if let native=controller { native.closing=true;native.dismiss(animated:false) { joined.signal() } } else { joined.signal() } }
        joined.wait() // actual UIKit completion joins, never a timeout substitution.
        DispatchQueue.main.sync { controller?.original=nil;controller=nil };uiJoined=true
    }
    private func message() throws -> Data {
        guard let key,let plan=dataPlan else { throw PinKnownRefusal() };let policy=writer.policy
        return Data(["LP-LOCAL-V2-FIRST-PROFILE-v2","create-initial-local-profile",nonce.map { String(format:"%02x",$0) }.joined(),LocalSnapshotV2.hash(before),LocalSnapshotV2.hash(next),LocalSnapshotV2.hash(profile),plan.identity,plan.nonce,plan.checksum,policy.version,policy.checksum,String(policy.maximum),policy.delays.map(String.init).joined(separator:","),String(request.began),String(request.deadline),String(describing:ObjectIdentifier(host)),String(describing:ObjectIdentifier(window)),String(describing:ObjectIdentifier(scene)),String(describing:ObjectIdentifier(root)),"ru.probpera.literaryplanet.child.pin.owner.passcode.v1",LocalSnapshotV2.hash(key.publicBytes)].joined(separator:"\n").utf8)
    }
    private func owner() throws {
        guard uiJoined,keys.source == .secureEnclave else { throw PinKnownRefusal() };try currentHost()
        context.touchIDAuthenticationAllowableReuseDuration=0;context.localizedCancelTitle=locale=="ru" ? "Отмена":"Cancel"
        writer.condition.lock();phase = .owner;ownerPending=true;ownerReturned=false;writer.condition.unlock()
        defer { writer.condition.lock();ownerPending=false;ownerReturned=true;writer.condition.broadcast();writer.condition.unlock() }
        key=try keys.acquire(enroll:false,context:context,prompt:locale=="ru" ? "Подтвердите первый локальный профиль":"Confirm first local profile")
        payload=try message();signature=try keys.sign(key!,message:payload)
        writer.condition.lock();ownerPending=false;ownerReturned=true;writer.condition.unlock()
        try currentHost();phase = .signed;try verifyOwner()
    }
    private func verifyOwner() throws {
        guard let key,key.source == .secureEnclave,!signature.isEmpty,signature.count<=144 else { throw PinKnownRefusal() }
        try keys.current(key);var expected=try message();defer { expected.resetBytes(in:0..<expected.count) };guard expected==payload else { throw PinKnownRefusal() }
        var error: Unmanaged<CFError>?;guard SecKeyVerifySignature(key.publicKey,.ecdsaSignatureMessageX962SHA256,payload as CFData,signature as CFData,&error) else { throw PinKnownRefusal() }
    }
    func boundary() throws {
        guard publicationThread==ObjectIdentifier(Thread.current),!cancelled,!request.sealed,request.profileOperation === self else { throw PinKnownRefusal() }
        if phase == .closed { try writer.closedProfileFence(self) } else { _ = try writer.profileLocal(request) }
        try verifyOwner();guard LocalSnapshotV2.hash(before)==beforeChecksum else { throw PinKnownRefusal() }
    }
    private func run() {
        do {
            if let receipt=try writer.open(request) { try writer.settle(receipt,known:true) }
            guard let expected=request.expected else { throw PinKnownRefusal() };before=try expected.copy();beforeChecksum=LocalSnapshotV2.hash(before)
            let snapshot=try LocalSnapshotV2.decode(before,policy:writer.policy);defer { snapshot.close() };nextSnapshot=try PlanetChildVault.ProtectedEnvelope.localV2FirstProfile(snapshot,profile:profile);next=try nextSnapshot!.copyCanonicalBytes()
            dataPlan=try PlanetChildDataStore.localV2BirthPlan(nonce:nonce.prefix(16).map { String(format:"%02x",$0) }.joined())
            try confirm();try owner();try currentHost();publicationThread=ObjectIdentifier(Thread.current)
            let receipt=try writer.profileCommit(self);try writer.settle(receipt,known:true);phase = .profileKnown
            guard let dataReceipt else { throw PinKnownRefusal() };try dataReceipt.readback(LocalV2ProfileDataBirthPermit(self));try currentHost()
            try recipient(self);try currentHost();delivered=true
        } catch { if dataSpent || request.mutationUnacknowledged { writer.profileUnknown(request) };phase = .failed;revoke() }
        // These joins are part of the operation, not merely state flags.
        try? dismissConfirmation();joinCancel();writer.condition.lock();finished=true;writer.condition.broadcast();writer.condition.unlock()
    }
    private func joinCancel() {
        while true { writer.condition.lock();let thread=cancelThread;writer.condition.unlock();guard let thread else { return };while !thread.isFinished { Thread.sleep(forTimeInterval:0.001) }
            writer.condition.lock();if cancelThread === thread { cancelThread=nil };writer.condition.broadcast();writer.condition.unlock() }
    }
    private func closingObservers(_ install: Bool) {
        DispatchQueue.main.sync {
            if install {
                for name in [UIApplication.willResignActiveNotification,UIApplication.didEnterBackgroundNotification,UIScene.didDisconnectNotification] {
                    closingTokens.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:nil) { [weak self] note in
                        guard let self else { return };if name==UIScene.didDisconnectNotification,self.request.host?.disconnected(note) != true { return };self.revoke()
                    })
                }
            } else { for token in closingTokens { NotificationCenter.default.removeObserver(token) };closingTokens.removeAll() }
        }
    }
    private func closeAfterJoin() {
        guard let worker else { return };while !worker.isFinished { Thread.sleep(forTimeInterval:0.001) };joinCancel()
        do {
            guard delivered,phase == .profileKnown,!cancelled,request.receipt?.known==true,request.receipt?.settled==true,!request.mutationUnacknowledged else { throw PinKnownRefusal() }
            try currentHost();publicationThread=ObjectIdentifier(Thread.current);try dataReceipt!.readback(LocalV2ProfileDataBirthPermit(self));closingObservers(true)
            writer.condition.lock();closedKnownCandidate=true;writer.condition.unlock();try writer.retire(request)
            phase = .closed;try writer.closedProfileReadback(self);closedResult=try LocalV2ProfileCompletion(self)
        } catch { closedResult=nil;revoke();if !request.retired { try? writer.retire(request) } else { writer.poisonClosedProfile(self) } }
        closingObservers(false)
        DispatchQueue.main.sync { if let keyObserver { NotificationCenter.default.removeObserver(keyObserver);self.keyObserver=nil };routeWitness.original=nil;routeWitness.willMove(toParent:nil);routeWitness.view.removeFromSuperview();routeWitness.removeFromParent() }
        dataPlan?.close();nextSnapshot?.close();profile.resetBytes(in:0..<profile.count);before.resetBytes(in:0..<before.count);next.resetBytes(in:0..<next.count);payload.resetBytes(in:0..<payload.count);signature.resetBytes(in:0..<signature.count)
    }
    func completion() throws -> LocalV2ProfileCompletion {
        guard !Thread.isMainThread,let settler,ObjectIdentifier(Thread.current) != ObjectIdentifier(settler),ObjectIdentifier(Thread.current) != worker.map(ObjectIdentifier.init) else { throw PinKnownRefusal() }
        while !settler.isFinished { Thread.sleep(forTimeInterval:0.001) };writer.condition.lock();defer { writer.condition.unlock() }
        let available = !completionConsumed;completionConsumed=true
        guard available,!cancelled,!request.sealed,writer.active==nil,writer.processClock.preparingOwner==nil,let result=closedResult,
            writer.processClock.known?.checksum==result.snapshotChecksum else { throw PinKnownRefusal() }
        let now: UInt64;do { now=try writer.clock.nanoseconds() } catch { writer.processClock.poisonProfileClosed();throw error };try writer.processClock.observe(now)
        guard now>=request.last,now<request.deadline else { throw PinKnownRefusal() };return result
    }
}
fileprivate extension LocalV2Writer {
    func profileLocal(_ request: LocalV2Request) throws -> UInt64 { try local(request) }
    func profileUnknown(_ request: LocalV2Request) { fail(request,PlanetChildVault.Failure.unavailable,publication:true) }
    func profileCommit(_ original: LocalV2ProfileOperation) throws -> LocalV2StorageReceipt {
        let request=original.request;guard request.profileOperation === original,original.phase == .signed,original.uiJoined else { throw PinKnownRefusal() }
        _ = try current(request);try start(request,opened:true);defer { finish(request) };var publication=false,captured: LocalV2StorageReceipt?
        do {
            try storage.locked { transaction in
                var before=try exact(transaction,request);defer { before.resetBytes(in:0..<before.count) };guard before==original.before,let next=original.nextSnapshot,let plan=original.dataPlan else { throw PinKnownRefusal() }
                let old=try LocalSnapshotV2.decode(before,policy:policy);defer { old.close() };try PlanetChildVault.ProtectedEnvelope.localV2ValidateFirstProfile(old,next)
                try original.boundary();let permit=LocalV2ProfileDataBirthPermit(original);publication=true
                // Fixed lock order: Vault process/flock -> DataStore process/flock.
                // Permit fences perform no recursive Vault IO or main UI wait.
                original.dataReceipt=try PlanetChildDataStore.localV2Birth(plan,permit:permit);try original.dataReceipt!.readback(permit)
                original.phase = .profilePublishing;condition.lock();request.mutationUnacknowledged=true;condition.unlock()
                try write(transaction,request,before,original.next,permission:{ try original.boundary() })
                condition.lock();defer { condition.unlock() };try processClock.stage(request,original.next,next);request.expected?.close();request.expected=PinOwnedBytes(original.next)
            }
            guard let next=original.nextSnapshot else { throw PlanetChildVault.Failure.unavailable };try publish(request,next,original.next,false) { captured=$0 }
            guard let captured else { throw PlanetChildVault.Failure.unavailable };return captured
        } catch { fail(request,error,publication:publication || request.mutationUnacknowledged);throw error }
    }
    func closedProfileFence(_ original: LocalV2ProfileOperation) throws {
        let request=original.request,now=try clock.nanoseconds();condition.lock();defer { condition.unlock() }
        guard active==nil,processClock.preparingOwner==nil,request.retired,!request.sealed,!original.cancelled,original.closedKnownCandidate,
            request.profileOperation === original,processClock.matches(policy),!processClock.invalidated,let next=original.nextSnapshot,
            processClock.known?.checksum==next.checksum,processClock.known?.rootRevision==next.fields.revision,request.process==getpid() else { throw PinKnownRefusal() }
        try processClock.observe(now);guard now>=request.last,now>=request.began,now<request.deadline else { throw PinKnownRefusal() };request.last=now
    }
    func poisonClosedProfile(_ original: LocalV2ProfileOperation) {
        condition.lock();defer { condition.unlock() };guard active==nil,processClock.preparingOwner==nil,original.request.retired,
            original.nextSnapshot?.checksum==processClock.known?.checksum else { return };processClock.poisonProfileClosed()
    }
    func closedProfileReadback(_ original: LocalV2ProfileOperation) throws {
        try closedProfileFence(original);try original.request.host?.current();try original.currentWindow()
        try storage.locked { transaction in
            try original.boundary();var actual=try transaction.read();defer { actual.resetBytes(in:0..<actual.count) };guard actual==original.next else { throw PlanetChildVault.Failure.unavailable }
            try original.dataReceipt!.readback(LocalV2ProfileDataBirthPermit(original));try original.boundary()
        }
        try original.request.host?.current();try original.currentWindow();try closedProfileFence(original)
    }
}
fileprivate extension LocalV2ProcessClock { func poisonProfileClosed() { poison() } }
#if DEBUG
/** Structural production-leaf fixtures only; no fabricated owner permit. */
enum PlanetChildLocalProfileRuntimeFixture {
    static let version="first-profile-fixture-v2",checksum=String(repeating:"a",count:64)
    private static func policy() throws -> LocalSnapshotV2Policy { try LocalSnapshotV2Policy(version:version,checksum:checksum,maximum:1200000,delays:[100,250]) }
    static func seed() throws -> Data { try PlanetChildVault.LocalEmptySeedV2.canonicalBytes(policyVersion:version,policyChecksum:checksum) }
    static func enrolled(root: UInt64=5,journal: UInt64=4,count: UInt64=2,observed: UInt64=17,pending: String?=String(repeating:"f",count:64)) throws -> Data {
        let p=try policy(),delay=p.delay(count),credential=String(repeating:"c",count:64)
        var source=try seed();defer { source.resetBytes(in:0..<source.count) }
        let pin="{\"schemaVersion\":1,\"policyVersion\":\"\(version)\",\"revision\":4,\"credentialId\":\"\(credential)\",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":600000,\"saltHex\":\"\(String(repeating:"d",count:64))\",\"hashHex\":\"\(String(repeating:"e",count:64))\"},\"attempts\":{\"count\":\(count),\"blockedUntilMs\":\(count==0 ? 0:observed+delay),\"lastObservedMs\":\(observed),\"pendingAttemptId\":\(pending.map { "\"\($0)\"" } ?? "null")}}"
        let text=String(decoding:source,as:UTF8.self).replacingOccurrences(of:"\"schemaVersion\":2,\"revision\":1",with:"\"schemaVersion\":2,\"revision\":\(root)").replacingOccurrences(of:"\"pin\":null",with:"\"pin\":"+pin)
        var protectedBytes=Data(text.utf8);defer { protectedBytes.resetBytes(in:0..<protectedBytes.count) }
        let fields=LocalV2PinFields(revision:4,credential:credential,count:count,blocked:count==0 ? 0:observed+delay,observed:observed,pending:pending,revisionStart:0,revisionEnd:0,attemptsStart:0)
        let record=try LocalSnapshotV2.wrapper(protectedBytes,policy:p,rootRevision:root,journalRevision:journal,pin:fields);defer { record.close() };return try record.copyCanonicalBytes()
    }
    static func transition(_ before: Data,profile: Data) throws -> Data {
        let old=try LocalSnapshotV2.decode(before,policy:policy());defer { old.close() };let next=try PlanetChildVault.ProtectedEnvelope.localV2FirstProfile(old,profile:profile);defer { next.close() }
        try PlanetChildVault.ProtectedEnvelope.localV2ValidateFirstProfile(old,next);return try next.copyCanonicalBytes()
    }
    static func validate(_ before: Data,_ after: Data) throws {
        let old=try LocalSnapshotV2.decode(before,policy:policy()),next=try LocalSnapshotV2.decode(after,policy:policy());defer { old.close();next.close() };try PlanetChildVault.ProtectedEnvelope.localV2ValidateFirstProfile(old,next)
    }
    static func profileId(_ profile: Data) throws -> String { try PlanetChildVault.ProtectedEnvelope.localV2ProfileId(profile) }
    static func nativeProfile(_ proposal: Data,id: String) throws -> Data { try PlanetChildVault.ProtectedEnvelope.localV2NativeProfile(proposal,id:id) }
    static func pinTail(_ bytes: Data) throws -> Data { let record=try LocalSnapshotV2.decode(bytes,policy:policy());defer { record.close() };var raw=try record.copyProtectedBytes();defer { raw.resetBytes(in:0..<raw.count) };return raw.suffix(from:record.fields.pinStart) }
    static func inspect(_ bytes: Data) throws -> (root: UInt64,pin: UInt64,journal: UInt64,count: UInt64,debt: UInt64,observed: UInt64,pending: String?,profile: String?,locale: String) {
        let record=try LocalSnapshotV2.decode(bytes,policy:policy());defer { record.close() };let scope=try LocalV2GateScope(record)
        return (record.fields.revision,record.fields.pin.revision,record.journal.revision,record.fields.pin.count,record.journal.cooldown,record.fields.pin.observed,record.fields.pin.pending,scope.context.profileId,scope.locale == .ru ? "ru":"en")
    }
    static func refunded(_ after: Data) throws -> Data { let record=try LocalSnapshotV2.decode(after,policy:policy());defer { record.close() };let next=try record.finalizeComparedCandidate(.match,17);defer { next.close() };return try next.copyCanonicalBytes() }
}
#endif

#if DEBUG
/** Production structural/refusal leaves only. Synthetic snapshots and an
 * absent terminal certify no owner, Keychain, lifecycle or admitted content. */
enum PlanetChildLocalCanonicalRuntimeFixture {
    private static func policy() throws -> LocalSnapshotV2Policy { try LocalSnapshotV2Policy(version:PlanetChildLocalProfileRuntimeFixture.version,checksum:PlanetChildLocalProfileRuntimeFixture.checksum,maximum:1200000,delays:[100,250]) }
    static func child(_ profile: Data) throws -> Data { try PlanetChildLocalProfileRuntimeFixture.transition(PlanetChildLocalProfileRuntimeFixture.enrolled(),profile:profile) }
    static func prepare(_ before: Data,action: String,target: Data) throws -> Data {
        let record=try LocalSnapshotV2.decode(before,policy:policy());defer { record.close() };let prepared=try PlanetChildVault.ProtectedEnvelope.localV2PrepareCanonical(record,action:action,target:target);defer { prepared.close() };return try prepared.bytes.copy()
    }
    static func withoutPackage(_ before: Data,action: String,target: Data) throws {
        let record=try LocalSnapshotV2.decode(before,policy:policy());defer { record.close() };let prepared=try PlanetChildVault.ProtectedEnvelope.localV2PrepareCanonical(record,action:action,target:target);defer { prepared.close() };try prepared.requireAdultExit()
    }
    static func validate(_ before: Data,_ after: Data,action: String,target: Data) throws {
        let old=try LocalSnapshotV2.decode(before,policy:policy()),next=try LocalSnapshotV2.decode(after,policy:policy());defer { old.close();next.close() };try PlanetChildVault.ProtectedEnvelope.localV2ValidateCanonical(old,next,action:action,target:target)
    }
    static func protectedText(_ before: Data) throws -> String { let record=try LocalSnapshotV2.decode(before,policy:policy());defer { record.close() };var bytes=try record.copyProtectedBytes();defer { bytes.resetBytes(in:0..<bytes.count) };return String(decoding:bytes,as:UTF8.self) }
    static func repack(_ before: Data,protectedText: String) throws -> Data {
        let old=try LocalSnapshotV2.decode(before,policy:policy());defer { old.close() };let next=try LocalSnapshotV2.wrapper(Data(protectedText.utf8),policy:policy(),rootRevision:old.fields.revision,journalRevision:old.journal.revision,pin:old.fields.pin);defer { next.close() };return try next.copyCanonicalBytes()
    }
    static func inspect(_ before: Data) throws -> (root: UInt64,journal: UInt64,pin: UInt64,count: UInt64,debt: UInt64,observed: UInt64,pending: String?,mode: String,selection: UInt64,profile: UInt64) {
        let record=try LocalSnapshotV2.decode(before,policy:policy());defer { record.close() };let context=try PlanetChildVault.ProtectedEnvelope.localV2Context(record)
        return (record.fields.revision,record.journal.revision,record.fields.pin.revision,record.fields.pin.count,record.journal.cooldown,record.fields.pin.observed,record.fields.pin.pending,context.mode,context.selectionRevision,context.profileRevision)
    }
    static func originalExecutionRefusesAbsentTerminal(_ before: Data) throws -> Bool {
        let record=try LocalSnapshotV2.decode(before,policy:policy());defer { record.close() };let scope=try LocalV2GateScope(record)
        let original=try LocalV2GateInvocation(action:"exit-child-mode",target:Data(),generation:1,beganNs:100000000,verificationMs:1000,capabilityMs:1000);defer { original.close() }
        _ = try original.capture(scope,101000000)
        do { try original.execution(nil,102000000);return false } catch { }
        do { _ = try original.transfer(nil,reply:nil,now:103000000);return false } catch { }
        do { try original.execution(nil,104000000);return false } catch { }
        do { try original.hostCurrent(1100000000);return false } catch { }
        let fresh=try LocalV2GateInvocation(action:"exit-child-mode",target:Data(),generation:1,beganNs:100000000,verificationMs:1000,capabilityMs:1000);defer { fresh.close() }
        _ = try fresh.capture(scope,101000000)
        do { _ = try fresh.transfer(nil,reply:nil,now:102000000);return false } catch { }
        do { try fresh.execution(nil,103000000);return false } catch { };return true
    }
}
#endif

/** Bounded strict data, independent of UI/OS authority. Tuple objects retain
 * payload order; duplicate decoded spellings are refused before interpretation. */
fileprivate indirect enum LocalV2PackageValue {
    case null,bool(Bool),integer(Int64),string(String),array([LocalV2PackageValue]),object([(String,LocalV2PackageValue)])
    var isNull: Bool { if case .null=self { return true };return false }
    func json(sorted: Bool) throws -> String {
        switch self { case .null:return "null";case .bool(let v):return v ? "true":"false";case .integer(let v):return String(v);case .string(let v):return Self.quote(v)
        case .array(let a):return "[" + (try a.map { try $0.json(sorted:sorted) }).joined(separator:",") + "]"
        case .object(let a):let rows=sorted ? a.sorted { $0.0.utf16.lexicographicallyPrecedes($1.0.utf16) }:a
            return "{" + (try rows.map { Self.quote($0.0) + ":" + (try $0.1.json(sorted:sorted)) }).joined(separator:",") + "}"
        }
    }
    static func quote(_ value: String) -> String { var result="\"";for scalar in value.unicodeScalars { switch scalar.value {
        case 34:result+="\\\"";case 92:result+="\\\\";case 8:result+="\\b";case 12:result+="\\f";case 10:result+="\\n";case 13:result+="\\r";case 9:result+="\\t"
        case 0..<32:result+=String(format:"\\u%04x",scalar.value);default:result+=String(scalar) } };return result + "\"" }
    static func object(_ value: Self?,_ keys: [String]=[]) throws -> [String:Self] { guard case .object(let rows)?=value else { throw PinKnownRefusal() };var result=[String:Self]()
        for (key,value) in rows { guard result[key]==nil else { throw PinKnownRefusal() };result[key]=value };if !keys.isEmpty { guard result.count==keys.count,keys.allSatisfy({ result[$0] != nil }) else { throw PinKnownRefusal() } };return result }
    static func array(_ value: Self?,_ maximum: Int) throws -> [Self] { guard case .array(let a)?=value,a.count<=maximum else { throw PinKnownRefusal() };return a }
    static func text(_ value: Self?) throws -> String { guard case .string(let s)?=value else { throw PinKnownRefusal() };return s }
    static func number(_ value: Self?,_ minimum: Int64,_ maximum: Int64) throws -> Int64 { guard case .integer(let n)?=value,n>=minimum,n<=maximum else { throw PinKnownRefusal() };return n }
    static func bool(_ value: Self?) throws -> Bool { guard case .bool(let b)?=value else { throw PinKnownRefusal() };return b }
    static func matches(_ value: String,_ pattern: String) -> Bool { guard let range=value.range(of:"^(?:"+pattern+")$",options:.regularExpression) else { return false };return range==value.startIndex..<value.endIndex }
    static func identifier(_ value: Self?) throws -> String { let s=try text(value);guard matches(s,"[A-Za-z0-9][A-Za-z0-9._-]{0,95}") else { throw PinKnownRefusal() };return s }
    static func hash(_ value: Self?) throws -> String { let s=try text(value);guard matches(s,"[a-f0-9]{64}") else { throw PinKnownRefusal() };return s }
    static func strings(_ value: Self?,_ maximum: Int,_ pattern: String) throws -> Set<String> { var result=Set<String>();for v in try array(value,maximum) { let s=try text(v);guard matches(s,pattern),result.insert(s).inserted else { throw PinKnownRefusal() } };return result }
}
fileprivate final class LocalV2PackageJson {
    private var bytes: [UInt8],offset=0,nodes=0
    private init(_ input: Data,_ limit: Int) throws { guard !input.isEmpty,input.count<=limit,String(data:input,encoding:.utf8) != nil else { throw PinKnownRefusal() };bytes=Array(input) }
    deinit { bytes.withUnsafeMutableBytes { $0.initializeMemory(as:UInt8.self,repeating:0) } }
    static func read(_ input: Data,_ limit: Int) throws -> LocalV2PackageValue { let p=try Self(input,limit),value=try p.value(0);p.white();guard p.offset==p.bytes.count else { throw PinKnownRefusal() };return value }
    private func white() { while offset<bytes.count,[9,10,13,32].contains(bytes[offset]) { offset+=1 } }
    private func take(_ byte: UInt8) -> Bool { white();if offset<bytes.count,bytes[offset]==byte { offset+=1;return true };return false }
    private func value(_ depth: Int) throws -> LocalV2PackageValue { nodes+=1;white();guard depth<=16,nodes<=600000,offset<bytes.count else { throw PinKnownRefusal() }
        if bytes[offset]==34 { return .string(try string()) }
        if take(123) { var rows=[(String,LocalV2PackageValue)](),keys=Set<String>();if take(125) { return .object(rows) }
            repeat { white();let key=try string();guard keys.insert(key).inserted,take(58) else { throw PinKnownRefusal() };rows.append((key,try value(depth+1))) } while take(44);guard take(125) else { throw PinKnownRefusal() };return .object(rows) }
        if take(91) { var rows=[LocalV2PackageValue]();if take(93) { return .array(rows) };repeat { rows.append(try value(depth+1)) } while take(44);guard take(93) else { throw PinKnownRefusal() };return .array(rows) }
        for (word,result) in [("true",LocalV2PackageValue.bool(true)),("false",.bool(false)),("null",.null)] { let wordBytes=Array(word.utf8);if offset+wordBytes.count<=bytes.count,Array(bytes[offset..<offset+wordBytes.count])==wordBytes { offset+=wordBytes.count;return result } }
        let start=offset;if bytes[offset]==45 { offset+=1 };guard offset<bytes.count else { throw PinKnownRefusal() };if bytes[offset]==48 { offset+=1 } else { guard bytes[offset]>=49,bytes[offset]<=57 else { throw PinKnownRefusal() };while offset<bytes.count,bytes[offset]>=48,bytes[offset]<=57 { offset+=1 } }
        let source=String(decoding:bytes[start..<offset],as:UTF8.self);guard source != "-0",let n=Int64(source),n>=(-9007199254740991),n<=9007199254740991 else { throw PinKnownRefusal() };return .integer(n)
    }
    private func string() throws -> String { guard offset<bytes.count,bytes[offset]==34 else { throw PinKnownRefusal() };let start=offset;offset+=1;var end=false
        while offset<bytes.count { let byte=bytes[offset];offset+=1;if byte==34 { end=true;break };guard byte>=32 else { throw PinKnownRefusal() };if byte==92 { guard offset<bytes.count else { throw PinKnownRefusal() };offset+=1 } }
        guard end else { throw PinKnownRefusal() };var at=start+1
        func hex(_ from: Int) throws -> UInt16 { guard from+4<=offset-1 else { throw PinKnownRefusal() };var result: UInt16=0;for i in from..<from+4 { let byte=bytes[i],digit: UInt16;if byte>=48,byte<=57 { digit=UInt16(byte-48) } else if byte>=65,byte<=70 { digit=UInt16(byte-55) } else if byte>=97,byte<=102 { digit=UInt16(byte-87) } else { throw PinKnownRefusal() };result=result*16+digit };return result }
        while at<offset-1 { if bytes[at] != 92 { at+=1;continue };at+=1;guard at<offset-1,[34,92,47,98,102,110,114,116,117].contains(bytes[at]) else { throw PinKnownRefusal() }
            if bytes[at]==117 { let scalar=try hex(at+1);at+=5;if scalar>=0xd800,scalar<=0xdbff { guard at+6<=offset-1,bytes[at]==92,bytes[at+1]==117 else { throw PinKnownRefusal() };let low=try hex(at+2);guard low>=0xdc00,low<=0xdfff else { throw PinKnownRefusal() };at+=6 } else if scalar>=0xdc00,scalar<=0xdfff { throw PinKnownRefusal() } } else { at+=1 }
        }
        guard let result=try JSONSerialization.jsonObject(with:Data(bytes[start..<offset]),options:.fragmentsAllowed) as? String else { throw PinKnownRefusal() };return result
    }
}
fileprivate final class LocalV2PackageProfile {
    let recordChecksum: String,id: String,locale: String,policyVersion: String,policyChecksum: String,reading: String?
    let revision: Int64,selectionRevision: Int64,exactAge: Int64,allowed: Set<String>?,blocked: Set<String>,profile: [String:LocalV2PackageValue]
    init(_ saved: LocalSnapshotV2) throws { var bytes=try saved.copyCanonicalBytes();defer { bytes.resetBytes(in:0..<bytes.count) }
        let root=try LocalV2PackageValue.object(LocalV2PackageJson.read(bytes,131072)),p=try LocalV2PackageValue.object(root["protectedRecord"])
        guard try LocalV2PackageValue.text(p["mode"])=="child" else { throw PinKnownRefusal() };recordChecksum=LocalSnapshotV2.hash(bytes);policyVersion=saved.policy.version;policyChecksum=saved.policy.checksum
        revision=try LocalV2PackageValue.number(p["profileRevision"],1,9007199254740991);selectionRevision=try LocalV2PackageValue.number(p["selectionRevision"],1,9007199254740991)
        let registry=try LocalV2PackageValue.object(p["registry"]);id=try LocalV2PackageValue.identifier(registry["activeProfileId"]);var selected: [String:LocalV2PackageValue]?
        for value in try LocalV2PackageValue.array(registry["profiles"],4) { let row=try LocalV2PackageValue.object(value);if try LocalV2PackageValue.text(row["id"])==id { guard selected==nil else { throw PinKnownRefusal() };selected=row } }
        guard let selected else { throw PinKnownRefusal() };profile=selected;exactAge=try LocalV2PackageValue.number(selected["exactAge"],3,17);locale=try LocalV2PackageValue.text(selected["locale"]);guard locale=="ru" || locale=="en" else { throw PinKnownRefusal() }
        reading=selected["readingLevel"]?.isNull == true ? nil:try LocalV2PackageValue.text(selected["readingLevel"]);guard reading==nil || ["plain","developing","fluent"].contains(reading!) else { throw PinKnownRefusal() }
        allowed=selected["allowedTopics"]?.isNull == true ? nil:try LocalV2PackageValue.strings(selected["allowedTopics"],64,"[a-z0-9][a-z0-9._-]{0,63}");blocked=try LocalV2PackageValue.strings(selected["blockedTopics"],64,"[a-z0-9][a-z0-9._-]{0,63}")
    }
    func same(_ current: LocalSnapshotV2) throws { var bytes=try current.copyCanonicalBytes();defer { bytes.resetBytes(in:0..<bytes.count) };guard recordChecksum==LocalSnapshotV2.hash(bytes) else { throw PinKnownRefusal() } }
}
/** Private owned data only; admission/transport/JS cannot construct this index. */
fileprivate final class LocalV2CompiledPackage {
    let profile: LocalV2PackageProfile,packageId: String,version: Int64,checksum: String,reviewChecksum: String,platform: String,territory: String,home: String,until: Int64
    private var payloads: [String:PinOwnedBytes],closed=false;private let lock=NSLock()
    init(_ profile: LocalV2PackageProfile,_ id: String,_ version: Int64,_ checksum: String,_ review: String,_ platform: String,_ territory: String,_ home: String,_ until: Int64,_ payloads: [String:PinOwnedBytes]) {
        self.profile=profile;packageId=id;self.version=version;self.checksum=checksum;reviewChecksum=review;self.platform=platform;self.territory=territory;self.home=home;self.until=until;self.payloads=payloads
    }
    func copy(_ key: String,_ now: Int64) throws -> Data { lock.lock();defer { lock.unlock() };guard !closed,now>=0,now<until,let payload=payloads[key] else { throw PinKnownRefusal() };return try payload.copy() }
    func close() { lock.lock();closed=true;for payload in payloads.values { payload.close() };payloads.removeAll();lock.unlock() }
    deinit { close() }
}
fileprivate enum LocalV2PackageCompiler {
    typealias V=LocalV2PackageValue
    static let kinds=Set(["country","writer","biography","work","character","storyworld","fact","quote","activity","quiz","search-result","recommendation","favorite","recent","offline-package","deep-link"])
    private static let rootFields=["schemaVersion","namespace","packageId","packageVersion","locale","exactAge","policyVersion","policyChecksum","validFromEpochMs","validUntilEpochMs","home","entities"]
    private static let policyFields=["id","kind","sourceVersion","policyVersion","minAge","maxAge","reviewStatus","localizedContent","topics","topicTagsComplete","commercialAvailability","rights"]
    private static let reviewFields=["schemaVersion","kind","keyId","reviewerId","packageId","packageVersion","packageChecksum","policyVersion","policyChecksum","locale","exactAge","readingLevels","platforms","territories","reviewedAtEpochMs","validFromEpochMs","validUntilEpochMs","entityPolicyChecksums","signatureHex"]
    private static func epoch(_ value: V?) throws -> Int64 { try V.number(value,0,8640000000000000) }
    private static func window(_ row: [String:V],_ from: String,_ until: String,_ now: Int64) throws { let a=try epoch(row[from]),b=try epoch(row[until]);guard a<b,a<=now,now<b else { throw PinKnownRefusal() } }
    private static func ref(_ value: V?) throws -> String { let row=try V.object(value,["kind","id","contentChecksum"]),kind=try V.text(row["kind"]);guard kinds.contains(kind) else { throw PinKnownRefusal() };_ = try V.hash(row["contentChecksum"]);return kind+"/"+(try V.identifier(row["id"])) }
    private static func clean(_ value: String,_ maximum: Int,_ multiline: Bool,_ nonempty: Bool) -> Bool { guard value.utf16.count<=maximum,(!nonempty || !value.isEmpty) else { return false }
        let whitespace=CharacterSet(charactersIn:"\u{0009}\u{000a}\u{000b}\u{000c}\u{000d}\u{0020}\u{00a0}\u{1680}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200a}\u{2028}\u{2029}\u{202f}\u{205f}\u{3000}\u{feff}")
        if !multiline,value.trimmingCharacters(in:whitespace) != value { return false };return value.unicodeScalars.allSatisfy { $0.value>=32 && $0.value != 127 || multiline && [9,10,13].contains($0.value) } }
    private static func payload(_ value: V?) throws -> Data { let row=try V.object(value,["title","text","terms","references"]),title=try V.text(row["title"]),text=try V.text(row["text"])
        guard clean(title,240,false,true),clean(text,32768,true,false) else { throw PinKnownRefusal() };var terms=Set<String>();for value in try V.array(row["terms"],64) { let term=try V.text(value);guard clean(term,80,false,true),terms.insert(term).inserted else { throw PinKnownRefusal() } }
        var refs=[V](),seen=Set<String>();for value in try V.array(row["references"],64) { let key=try ref(value),entry=try V.object(value);guard seen.insert(key).inserted else { throw PinKnownRefusal() };refs.append(.object([("kind",entry["kind"]!),("id",entry["id"]!),("contentChecksum",entry["contentChecksum"]!)])) }
        return Data(try V.object([("title",.string(title)),("text",.string(text)),("terms",row["terms"]!),("references",.array(refs))]).json(sorted:false).utf8)
    }
    private static func policy(_ value: V?,_ profile: LocalV2PackageProfile,_ platform: String,_ territory: String,_ now: Int64,_ checksum: String) throws -> Int64? {
        let row=try V.object(value,policyFields),kind=try V.text(row["kind"]);_ = try V.identifier(row["id"]);_ = try V.identifier(row["sourceVersion"])
        guard kinds.contains(kind),try V.text(row["policyVersion"])==profile.policyVersion,try V.text(row["reviewStatus"])=="approved",try V.bool(row["topicTagsComplete"]),try V.text(row["commercialAvailability"])=="included-in-base" else { throw PinKnownRefusal() }
        let min=try V.number(row["minAge"],3,17),max=try V.number(row["maxAge"],3,17);guard min<=max,min<=profile.exactAge,profile.exactAge<=max else { throw PinKnownRefusal() }
        for topic in try V.strings(row["topics"],64,"[a-z0-9][a-z0-9._-]{0,63}") { guard !profile.blocked.contains(topic),profile.allowed==nil || profile.allowed!.contains(topic) else { throw PinKnownRefusal() } }
        let localized=try V.array(row["localizedContent"],1);guard localized.count==1 else { throw PinKnownRefusal() };let language=try V.object(localized[0],["locale","contentChecksum","reviewStatus","available","reviewerId","reviewedAt"])
        _ = try V.identifier(language["reviewerId"]);guard try V.text(language["locale"])==profile.locale,try V.hash(language["contentChecksum"])==checksum,try V.text(language["reviewStatus"])=="approved",try V.bool(language["available"]),try epoch(language["reviewedAt"])<=now else { throw PinKnownRefusal() }
        let rights=try V.object(row["rights"],["status","basis","platforms","territories","validFrom","expiresAt"]);guard try V.text(rights["status"])=="approved",["original","public-domain"].contains(try V.text(rights["basis"])),try V.strings(rights["platforms"],4,"web-pwa|android-google|android-rustore|ios-ipados").contains(platform),try V.strings(rights["territories"],676,"[A-Z]{2}").contains(territory) else { throw PinKnownRefusal() }
        let start=try epoch(rights["validFrom"]);guard start<=now else { throw PinKnownRefusal() };if rights["expiresAt"]?.isNull == true { return nil };let end=try epoch(rights["expiresAt"]);guard start<end,now<end else { throw PinKnownRefusal() };return end
    }
    private static func iso(_ value: String) throws -> Int64 { guard V.matches(value,"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z") else { throw PinKnownRefusal() };let f=DateFormatter();f.locale=Locale(identifier:"en_US_POSIX");f.timeZone=TimeZone(secondsFromGMT:0);f.dateFormat="yyyy-MM-dd'T'HH:mm:ss.SSS'Z'";f.isLenient=false
        guard let date=f.date(from:value),f.string(from:date)==value,date.timeIntervalSince1970>=0 else { throw PinKnownRefusal() };return Int64((date.timeIntervalSince1970*1000).rounded()) }
    private static func unhex(_ value: String,_ count: Int) throws -> Data { guard V.matches(value,"[a-f0-9]{\(count*2)}") else { throw PinKnownRefusal() };var bytes=[UInt8](),index=value.startIndex;for _ in 0..<count { let end=value.index(index,offsetBy:2);guard let byte=UInt8(value[index..<end],radix:16) else { throw PinKnownRefusal() };bytes.append(byte);index=end };return Data(bytes) }
    private static func signature(_ review: V,_ keys: [V]) throws { let row=try V.object(review);var selected: [String:V]?
        for value in keys { let key=try V.object(value,["keyId","reviewerId","publicKeyX963Hex"]);if try V.text(key["keyId"])==V.text(row["keyId"]),try V.text(key["reviewerId"])==V.text(row["reviewerId"]) { guard selected==nil else { throw PinKnownRefusal() };selected=key } }
        guard let selected,case .object(let fields)=review else { throw PinKnownRefusal() };var point=try unhex(V.text(selected["publicKeyX963Hex"]),65),raw=try unhex(V.text(row["signatureHex"]),64)
        defer { point.resetBytes(in:0..<point.count);raw.resetBytes(in:0..<raw.count) };guard point.first==4 else { throw PinKnownRefusal() };let key=try P256.Signing.PublicKey(x963Representation:point),signature=try P256.Signing.ECDSASignature(rawRepresentation:raw)
        var message=Data(("LP-CHILD-RELEASE-REVIEW\0v1\0"+(try V.object(fields.filter { $0.0 != "signatureHex" }).json(sorted:true))).utf8);defer { message.resetBytes(in:0..<message.count) }
        guard key.x963Representation==point,key.isValidSignature(signature,for:message) else { throw PinKnownRefusal() }
    }
    static func compile(_ bytes: Data,_ reviewBytes: Data,_ pinValue: V,_ keys: [V],_ profile: LocalV2PackageProfile,_ platform: String,_ territory: String,_ now: Int64,_ fence: () throws -> Void) throws -> LocalV2CompiledPackage {
        guard ["android-google","android-rustore","ios-ipados"].contains(platform),V.matches(territory,"[A-Z]{2}"),now>=0,now<=8640000000000000,try iso(V.text(profile.profile["ageConfirmedAt"]))<=now else { throw PinKnownRefusal() };try fence()
        let pin=try V.object(pinValue,["packageId","packageVersion","packageChecksum","reviewChecksum"]),checksum=try V.hash(pin["packageChecksum"]),reviewChecksum=try V.hash(pin["reviewChecksum"])
        guard checksum==LocalSnapshotV2.hash(bytes),reviewChecksum==LocalSnapshotV2.hash(reviewBytes) else { throw PinKnownRefusal() };let package=try LocalV2PackageJson.read(bytes,8388608),root=try V.object(package,rootFields),review=try LocalV2PackageJson.read(reviewBytes,524288),approval=try V.object(review,reviewFields)
        let id=try V.identifier(root["packageId"]),version=try V.number(root["packageVersion"],1,9007199254740991)
        guard try V.number(root["schemaVersion"],1,1)==1,try V.text(root["namespace"])=="child",try V.text(pin["packageId"])==id,try V.number(pin["packageVersion"],1,9007199254740991)==version,try V.text(root["locale"])==profile.locale,try V.number(root["exactAge"],3,17)==profile.exactAge,try V.text(root["policyVersion"])==profile.policyVersion,try V.hash(root["policyChecksum"])==profile.policyChecksum else { throw PinKnownRefusal() };try window(root,"validFromEpochMs","validUntilEpochMs",now)
        guard try V.number(approval["schemaVersion"],1,1)==1,try V.text(approval["kind"])=="literary-planet-child-release-review-v1",try V.text(approval["packageId"])==id,try V.number(approval["packageVersion"],1,9007199254740991)==version,try V.hash(approval["packageChecksum"])==checksum,try V.text(approval["policyVersion"])==profile.policyVersion,try V.hash(approval["policyChecksum"])==profile.policyChecksum,try V.text(approval["locale"])==profile.locale,try V.number(approval["exactAge"],3,17)==profile.exactAge,try epoch(approval["reviewedAtEpochMs"])<=now,V.matches(try V.text(approval["keyId"]),"child-release-review-[A-Za-z0-9_-]{1,48}") else { throw PinKnownRefusal() };_ = try V.identifier(approval["reviewerId"]);try window(approval,"validFromEpochMs","validUntilEpochMs",now)
        var readings=Set<String>();for value in try V.array(approval["readingLevels"],4) { let reading=value.isNull ? "<null>":try V.text(value);guard ["<null>","plain","developing","fluent"].contains(reading),readings.insert(reading).inserted else { throw PinKnownRefusal() } }
        guard readings.contains(profile.reading ?? "<null>"),try V.strings(approval["platforms"],3,"android-google|android-rustore|ios-ipados").contains(platform),try V.strings(approval["territories"],676,"[A-Z]{2}").contains(territory) else { throw PinKnownRefusal() };try signature(review,keys);try fence()
        var approved=[String:[String:V]]();for value in try V.array(approval["entityPolicyChecksums"],4096) { let row=try V.object(value,["kind","id","payloadChecksum","policyChecksum"]),kind=try V.text(row["kind"]),key=kind+"/"+(try V.identifier(row["id"]));guard kinds.contains(kind),approved[key]==nil else { throw PinKnownRefusal() };_ = try V.hash(row["payloadChecksum"]);_ = try V.hash(row["policyChecksum"]);approved[key]=row }
        var owned=[String:PinOwnedBytes](),hashes=[String:String](),references=[String:[V]](),adopted=false;defer { if !adopted { for payload in owned.values { payload.close() } };references.removeAll();hashes.removeAll();approved.removeAll() }
        let entities=try V.array(root["entities"],4096);guard !entities.isEmpty,entities.count==approved.count else { throw PinKnownRefusal() };var until=min(try epoch(root["validUntilEpochMs"]),try epoch(approval["validUntilEpochMs"]))
        for value in entities { try fence();let row=try V.object(value,["policy","payload"]),entityPolicy=try V.object(row["policy"]),kind=try V.text(entityPolicy["kind"]),key=kind+"/"+(try V.identifier(entityPolicy["id"]));guard owned[key]==nil else { throw PinKnownRefusal() }
            var data=try payload(row["payload"]);defer { data.resetBytes(in:0..<data.count) };let payloadHash=LocalSnapshotV2.hash(data);if let expiry=try policy(row["policy"],profile,platform,territory,now,payloadHash) { until=min(until,expiry) }
            guard let entry=approved[key],try V.hash(entry["payloadChecksum"])==payloadHash,let policyValue=row["policy"] else { throw PinKnownRefusal() };var policyBytes=Data(try policyValue.json(sorted:true).utf8);defer { policyBytes.resetBytes(in:0..<policyBytes.count) };guard try V.hash(entry["policyChecksum"])==LocalSnapshotV2.hash(policyBytes) else { throw PinKnownRefusal() }
            let refs=try V.array(V.object(row["payload"])["references"],64);if ["search-result","recommendation","favorite","recent","deep-link"].contains(kind),refs.count != 1 { throw PinKnownRefusal() };if kind=="offline-package",refs.isEmpty { throw PinKnownRefusal() }
            owned[key]=PinOwnedBytes(data);hashes[key]=payloadHash;references[key]=refs
        }
        for refs in references.values { for value in refs { try fence();let key=try ref(value),row=try V.object(value);guard try V.hash(row["contentChecksum"])==hashes[key] else { throw PinKnownRefusal() } } }
        let home=try ref(root["home"]),homeRow=try V.object(root["home"]);guard home.hasPrefix("activity/"),try V.hash(homeRow["contentChecksum"])==hashes[home],now<until else { throw PinKnownRefusal() };try fence()
        let result=LocalV2CompiledPackage(profile,id,version,checksum,reviewChecksum,platform,territory,home,until,owned);adopted=true;return result
    }
}
fileprivate final class LocalV2PackageCatalog {
    typealias V=LocalV2PackageValue
    let platform: String,keys: [V],pins: [V];private var inventory=[String:[String:V]]()
    init(_ catalogBytes: Data,_ artifactBytes: Data,_ expectedPlatform: String) throws {
        let artifact=try V.object(LocalV2PackageJson.read(artifactBytes,2097152));guard try V.number(artifact["schemaVersion"],1,1)==1,try V.text(artifact["kind"])=="literary-planet-bundled-native-preparation",try V.text(artifact["platform"])==expectedPlatform else { throw PinKnownRefusal() }
        let channel=try V.text(artifact["channel"]);if expectedPlatform=="ios",channel=="appStore" { platform="ios-ipados" } else if expectedPlatform=="android",channel=="googlePlay" { platform="android-google" } else if expectedPlatform=="android",channel=="ruStore" { platform="android-rustore" } else { throw PinKnownRefusal() }
        let catalog=try V.object(LocalV2PackageJson.read(catalogBytes,65536),["schemaVersion","kind","platform","pinSourceChecksum","reviewKeys","packages"])
        guard try V.number(catalog["schemaVersion"],1,1)==1,try V.text(catalog["kind"])=="literary-planet-child-native-assets-v1",try V.text(catalog["platform"])==platform else { throw PinKnownRefusal() }
        let sourceHash=try V.hash(catalog["pinSourceChecksum"]),inputs=try V.object(artifact["sourceInputs"]);var sources=0
        for value in try V.array(inputs["files"],20000) { let row=try V.object(value,["path","sha256"]);if try V.text(row["path"])=="src/child/childNativeReleasePins.json" { guard try V.hash(row["sha256"])==sourceHash else { throw PinKnownRefusal() };sources+=1 } };guard sources==1 else { throw PinKnownRefusal() }
        for value in try V.array(artifact["inventory"],20000) { let row=try V.object(value,["path","bytes","sha256"]),name=try V.text(row["path"]);_ = try V.number(row["bytes"],1,9007199254740991);_ = try V.hash(row["sha256"]);guard inventory[name]==nil else { throw PinKnownRefusal() };inventory[name]=row }
        keys=try V.array(catalog["reviewKeys"],16);pins=try V.array(catalog["packages"],32);try verify("child-native/catalog-v1.json",catalogBytes,65536)
        var keyIds=Set<String>(),points=Set<String>(),ids=Set<String>(),checksums=Set<String>()
        for value in keys { let row=try V.object(value,["keyId","reviewerId","publicKeyX963Hex"]),id=try V.text(row["keyId"]),point=try V.text(row["publicKeyX963Hex"]);_ = try V.identifier(row["reviewerId"])
            guard V.matches(id,"child-release-review-[A-Za-z0-9_-]{1,48}"),V.matches(point,"04[a-f0-9]{128}"),keyIds.insert(id).inserted,points.insert(point).inserted else { throw PinKnownRefusal() } }
        for value in pins { let row=try V.object(value,["packageId","packageVersion","packageChecksum","reviewChecksum"]),id=try V.identifier(row["packageId"]),version=try V.number(row["packageVersion"],1,9007199254740991),sum=try V.hash(row["packageChecksum"]),review=try V.hash(row["reviewChecksum"])
            guard ids.insert(id+"/"+String(version)).inserted,checksums.insert(sum).inserted,inventory["child-native/packages/"+sum+".json"] != nil,inventory["child-native/reviews/"+review+".json"] != nil else { throw PinKnownRefusal() } }
    }
    func verify(_ fixedPath: String,_ bytes: Data,_ maximum: Int) throws { guard let row=inventory[fixedPath],!bytes.isEmpty,bytes.count<=maximum,try V.number(row["bytes"],1,Int64(maximum))==Int64(bytes.count),try V.hash(row["sha256"])==LocalSnapshotV2.hash(bytes) else { throw PinKnownRefusal() } }
}
/** Fresh canonical record stays on the real original process-owned lease.
 * Main checks occur outside the native file lock; no recursive lock acquisition. */
fileprivate extension LocalV2Writer {
    func packageLocal(_ request: LocalV2Request) throws -> UInt64 { try local(request) }
    func packageFresh(_ request: LocalV2Request,_ original: LocalV2PackageProfile?) throws -> LocalV2PackageProfile {
        try start(request,opened:true);defer { finish(request) };_ = try current(request)
        do { return try storage.locked { transaction in var actual=try exact(transaction,request);defer { actual.resetBytes(in:0..<actual.count) };_ = try local(request)
            let saved=try LocalSnapshotV2.decode(actual,policy:policy);defer { saved.close() };try original?.same(saved);return try LocalV2PackageProfile(saved) } }
        catch { fail(request,error,publication:false);throw error }
    }
}
/** One original delivery of data. It grants no AES admission, and every copy
 * rereads the full canonical record and current actual native host. */
/** The outgoing-copy registry never holds its lock across a main/UI join. */
fileprivate final class LocalV2PackageCopies {
    private let compiled: LocalV2CompiledPackage,lock=NSLock();private var closed=false,borrowed=[PinOwnedBytes]()
    init(_ compiled: LocalV2CompiledPackage) { self.compiled=compiled }
    func copy(_ key: String,_ clock: () throws -> Int64,_ fence: () throws -> Void) throws -> PinOwnedBytes {
        lock.lock();let available = !closed && borrowed.count<64;lock.unlock();guard available else { throw PinKnownRefusal() }
        try fence();var bytes=try compiled.copy(key,clock());defer { bytes.resetBytes(in:0..<bytes.count) };let result=PinOwnedBytes(bytes);var published=false;defer { if !published { result.close() } }
        try fence();let now=try clock();guard now>=0,now<compiled.until else { throw PinKnownRefusal() }
        lock.lock();defer { lock.unlock() };guard !closed,borrowed.count<64 else { throw PinKnownRefusal() };borrowed.append(result);published=true;return result
    }
    func close() { lock.lock();closed=true;for copy in borrowed { copy.close() };borrowed.removeAll();compiled.close();lock.unlock() }
    deinit { close() }
}
fileprivate final class LocalV2OwnedPackageDelivery {
    let owner: LocalV2NativePackageLoader,compiled: LocalV2CompiledPackage;private let copies: LocalV2PackageCopies
    init(_ owner: LocalV2NativePackageLoader,_ compiled: LocalV2CompiledPackage) { self.owner=owner;self.compiled=compiled;copies=LocalV2PackageCopies(compiled) }
    private func fence() throws { do { guard owner.delivery === self,ObjectIdentifier(Thread.current)==owner.worker.map(ObjectIdentifier.init) else { throw PinKnownRefusal() };try owner.fresh(compiled.profile);try owner.live() } catch { owner.revoke();throw error } }
    func copyHome() throws -> PinOwnedBytes { do { return try copies.copy(compiled.home,owner.wall,fence) } catch { owner.revoke();throw error } }
    func copyEntity(kind: String,id: String) throws -> PinOwnedBytes { guard LocalV2PackageCompiler.kinds.contains(kind),LocalV2PackageValue.matches(id,"[A-Za-z0-9][A-Za-z0-9._-]{0,95}") else { throw PinKnownRefusal() };do { return try copies.copy(kind+"/"+id,owner.wall,fence) } catch { owner.revoke();throw error } }
    func close() { copies.close() }
}
/** Actual child VC receives native disappearance/pop/reparent callbacks. A
 * simulated callback is not acceptance of this OS Back/lifecycle mechanism. */
fileprivate final class LocalV2PackageRouteWitness: UIViewController {
    weak var owner: LocalV2NativePackageLoader?
    override func viewWillDisappear(_ animated: Bool) { super.viewWillDisappear(animated);owner?.revoke() }
    override func didMove(toParent parent: UIViewController?) { super.didMove(toParent:parent);if parent !== owner?.host { owner?.revoke() } }
    override func loadView() { let view=UIView(frame:.zero);view.isUserInteractionEnabled=false;self.view=view }
}
/** Fixed Bundle producer over the original actual VC/window/scene. Empty
 * production pins deny; there is no JS scope, account, URL or QA-key fallback. */
fileprivate final class LocalV2NativePackageLoader {
    let writer: LocalV2Writer,request: LocalV2Request,host: UIViewController,route: UIView,window: UIWindow,scene: UIWindowScene,root: UIViewController,territory: String
    private let parents: [UIViewController],presenter: UIViewController?,ancestry: [UIView],recipient: (LocalV2OwnedPackageDelivery) throws -> Void
    private let lock=NSLock(),witness=LocalV2PackageRouteWitness();private var revoked=false,closed=false,sent=false,wallLast: Int64 = -1
    fileprivate var worker: Thread?,retirement: Thread?,delivery: LocalV2OwnedPackageDelivery?;private var observers=[NSObjectProtocol](),expiry: DispatchWorkItem?,watch: DispatchWorkItem?
    private static func isWebView(_ view: UIView) -> Bool { guard let type=NSClassFromString("WKWebView") else { return false };return view.isKind(of:type) }
    init(vault: PlanetChildVault,host: UIViewController,policy: LocalSnapshotV2Policy,timeoutMs: UInt64,recipient: @escaping (LocalV2OwnedPackageDelivery) throws -> Void) throws {
        guard Thread.isMainThread,let route=host.viewIfLoaded,let window=route.window,let scene=window.windowScene,let root=window.rootViewController,let territory=Locale.current.regionCode,
            LocalV2PackageValue.matches(territory,"[A-Z]{2}"),window.isKeyWindow,!window.isHidden,scene.activationState == .foregroundActive,UIApplication.shared.applicationState == .active,
            host.presentedViewController==nil,!host.isBeingDismissed,!host.isMovingFromParent,!route.isHidden,!Self.isWebView(route) else { throw PinKnownRefusal() }
        self.host=host;self.route=route;self.window=window;self.scene=scene;self.root=root;self.territory=territory;self.recipient=recipient;presenter=host.presentingViewController
        var controllers=[UIViewController](),controller=host.parent;while let value=controller { controllers.append(value);controller=value.parent };parents=controllers
        var views=[UIView](),view=route.superview;while let value=view { guard !Self.isWebView(value) else { throw PinKnownRefusal() };views.append(value);view=value.superview };ancestry=views
        writer=try LocalV2Writer.pinRuntime(vault:vault,policy:policy);request=try writer.request(host:host,timeoutMs:timeoutMs)
        witness.owner=self;host.addChild(witness);route.addSubview(witness.view);witness.didMove(toParent:host)
        let center=NotificationCenter.default;for name in [UIApplication.willResignActiveNotification,UIApplication.didEnterBackgroundNotification,UIScene.didDisconnectNotification,UIWindow.didResignKeyNotification] {
            observers.append(center.addObserver(forName:name,object:nil,queue:.main) { [weak self] note in guard let self else { return };if name==UIScene.didDisconnectNotification,(note.object as? UIWindowScene) !== self.scene { return };if name==UIWindow.didResignKeyNotification,(note.object as? UIWindow) !== self.window { return };self.revoke() })
        }
        let expiry=DispatchWorkItem { [weak self] in self?.revoke() };self.expiry=expiry
        do { try current();let now=try writer.clock.nanoseconds();guard request.deadline>now,request.deadline-now<=UInt64(Int.max) else { throw PinKnownRefusal() };DispatchQueue.main.asyncAfter(deadline:.now()+.nanoseconds(Int(request.deadline-now)),execute:expiry);watchOriginal() }
        catch { revoke();startRetirement();throw error }
    }
    private func watchOriginal() { lock.lock();let done=closed || revoked;lock.unlock();if done { return };do { try current();_ = try writer.packageLocal(request);if let original=delivery { guard try wall()<original.compiled.until else { throw PinKnownRefusal() } };let next=DispatchWorkItem { [weak self] in self?.watchOriginal() };watch=next;DispatchQueue.main.asyncAfter(deadline:.now()+.milliseconds(10),execute:next) } catch { revoke() } }
    private func current() throws { guard Thread.isMainThread else { throw PinKnownRefusal() };lock.lock();let denied=revoked || closed;lock.unlock()
        guard !denied,host.viewIfLoaded === route,route.window === window,window.rootViewController === root,window.windowScene === scene,window.isKeyWindow,!window.isHidden,scene.activationState == .foregroundActive,
            UIApplication.shared.applicationState == .active,host.presentedViewController==nil,!host.isBeingDismissed,!host.isMovingFromParent,!route.isHidden,route.alpha>0,witness.parent === host,Locale.current.regionCode==territory,host.presentingViewController === presenter else { throw PinKnownRefusal() }
        var view=route.superview;for exact in ancestry { guard view === exact,!exact.isHidden,exact.alpha>0,exact.window === window else { throw PinKnownRefusal() };view=view?.superview };guard view==nil else { throw PinKnownRefusal() }
        var controller=host;for exact in parents { guard controller.parent === exact else { throw PinKnownRefusal() };if let navigation=exact as? UINavigationController,navigation.topViewController !== controller { throw PinKnownRefusal() };if let tabs=exact as? UITabBarController,tabs.selectedViewController !== controller { throw PinKnownRefusal() };controller=exact };guard controller.parent==nil else { throw PinKnownRefusal() }
    }
    fileprivate func live() throws { lock.lock();let denied=revoked || closed,original=worker;lock.unlock();guard !denied,ObjectIdentifier(Thread.current)==original.map(ObjectIdentifier.init) else { throw PinKnownRefusal() };_ = try writer.packageLocal(request) }
    fileprivate func wall() throws -> Int64 { let seconds=Date().timeIntervalSince1970;guard seconds.isFinite,seconds>=0,seconds*1000<=8640000000000000 else { throw PinKnownRefusal() };let now=Int64((seconds*1000).rounded(.down));lock.lock();defer { lock.unlock() };guard now>=wallLast else { revoked=true;throw PinKnownRefusal() };wallLast=now;return now }
    private func mainCurrent() throws { guard !Thread.isMainThread else { throw PinKnownRefusal() };var failure: Error?;DispatchQueue.main.sync { do { try current() } catch { failure=error } };if let failure { throw failure };try live() }
    fileprivate func fresh(_ original: LocalV2PackageProfile?) throws { try live();try mainCurrent();_ = try writer.packageFresh(request,original) }
    private func fixedAsset(_ fixed: String,_ limit: Int) throws -> Data { try live();guard fixed=="artifact.json" || fixed=="child-native/catalog-v1.json" || LocalV2PackageValue.matches(fixed,"child-native/(packages|reviews)/[a-f0-9]{64}\\.json"),let resources=Bundle.main.resourceURL else { throw PinKnownRefusal() }
        let manager=FileManager.default;var current=resources;for part in (["public"]+fixed.split(separator:"/").map(String.init)) { current.appendPathComponent(part);let values=try current.resourceValues(forKeys:[.isSymbolicLinkKey]);guard values.isSymbolicLink != true,current.resolvingSymlinksInPath().standardizedFileURL==current.standardizedFileURL else { throw PinKnownRefusal() } }
        let values=try current.resourceValues(forKeys:[.isRegularFileKey,.fileSizeKey]);guard values.isRegularFile==true,let size=values.fileSize,size>0,size<=limit,let stream=InputStream(url:current) else { throw PinKnownRefusal() }
        var owned=[UInt8](repeating:0,count:limit),used=0;stream.open();defer { stream.close();owned.withUnsafeMutableBytes { $0.initializeMemory(as:UInt8.self,repeating:0) } }
        while used<limit { try live();let n=owned.withUnsafeMutableBufferPointer { stream.read($0.baseAddress!.advanced(by:used),maxLength:min(8192,limit-used)) };guard n>=0 else { throw PinKnownRefusal() };if n==0 { break };used+=n }
        if used==limit { var extra: UInt8=0;guard stream.read(&extra,maxLength:1)==0 else { throw PinKnownRefusal() } };try live();guard used==size else { throw PinKnownRefusal() };return Data(owned[0..<used])
    }
    func start() throws { guard Thread.isMainThread else { throw PinKnownRefusal() };try current();lock.lock();guard worker==nil,!sent,!closed,!revoked else { lock.unlock();throw PinKnownRefusal() };let thread=Thread { [self] in run() };worker=thread;lock.unlock();thread.start() }
    private func run() { var catalogBytes=Data(),artifactBytes=Data(),result: LocalV2CompiledPackage?
        defer { delivery?.close();result?.close();catalogBytes.resetBytes(in:0..<catalogBytes.count);artifactBytes.resetBytes(in:0..<artifactBytes.count);startRetirement() }
        do { try live();try mainCurrent();if let receipt=try writer.open(request) { try writer.settle(receipt,known:true) };let profile=try writer.packageFresh(request,nil);try mainCurrent()
            catalogBytes=try fixedAsset("child-native/catalog-v1.json",65536);artifactBytes=try fixedAsset("artifact.json",2097152);let catalog=try LocalV2PackageCatalog(catalogBytes,artifactBytes,"ios");guard !catalog.pins.isEmpty else { throw PinKnownRefusal() }
            for pinValue in catalog.pins { try live();try fresh(profile);let pin=try LocalV2PackageValue.object(pinValue),sum=try LocalV2PackageValue.hash(pin["packageChecksum"]),reviewSum=try LocalV2PackageValue.hash(pin["reviewChecksum"]);var bytes=try fixedAsset("child-native/packages/"+sum+".json",8388608),review=Data();var candidate: LocalV2CompiledPackage?
                defer { candidate?.close();bytes.resetBytes(in:0..<bytes.count);review.resetBytes(in:0..<review.count) };review=try fixedAsset("child-native/reviews/"+reviewSum+".json",524288);try catalog.verify("child-native/packages/"+sum+".json",bytes,8388608);try catalog.verify("child-native/reviews/"+reviewSum+".json",review,524288)
                let audience=try LocalV2PackageValue.object(LocalV2PackageJson.read(bytes,8388608));if try LocalV2PackageValue.text(audience["locale"]) != profile.locale || LocalV2PackageValue.number(audience["exactAge"],3,17) != profile.exactAge || LocalV2PackageValue.text(audience["policyVersion"]) != profile.policyVersion || LocalV2PackageValue.hash(audience["policyChecksum"]) != profile.policyChecksum { continue }
                try fresh(profile);candidate=try LocalV2PackageCompiler.compile(bytes,review,pinValue,catalog.keys,profile,catalog.platform,territory,wall(),live);guard result==nil else { throw PinKnownRefusal() };result=candidate;candidate=nil
            }
            guard let compiled=result else { throw PinKnownRefusal() };try fresh(profile);guard try wall()<compiled.until else { throw PinKnownRefusal() };try mainCurrent();try live();lock.lock();guard !revoked,!closed,!sent,delivery==nil else { lock.unlock();throw PinKnownRefusal() };sent=true;let original=LocalV2OwnedPackageDelivery(self,compiled);delivery=original;result=nil;lock.unlock()
            try recipient(original);try live();try fresh(profile);guard try wall()<compiled.until else { throw PinKnownRefusal() }
        } catch { revoke() }
    }
    /** Actual native route owner invokes before reusing a still-attached view. */
    func routeWillChange() { revoke() }
    fileprivate func revoke() { lock.lock();revoked=true;let original=delivery;lock.unlock();original?.close();writer.cancel(request);startRetirement() }
    private func startRetirement() { lock.lock();guard retirement==nil else { lock.unlock();return };let original=worker
        let thread=Thread { [self] in if let original { while !original.isFinished { let condition=writer.condition;condition.lock();_ = condition.wait(until:Date(timeIntervalSinceNow:0.01));condition.unlock() } }
            DispatchQueue.main.sync { detach() };do { try writer.retire(request);lock.lock();closed=true;lock.unlock() } catch { writer.condition.lock();writer.processClock.invalidate(request);request.sealed=true;writer.condition.unlock() }
        };retirement=thread;lock.unlock();thread.start()
    }
    private func detach() { expiry?.cancel();expiry=nil;watch?.cancel();watch=nil;let center=NotificationCenter.default;for observer in observers { center.removeObserver(observer) };observers.removeAll();witness.owner=nil;witness.willMove(toParent:nil);witness.view.removeFromSuperview();witness.removeFromParent() }
    func close() { guard Thread.isMainThread else { return };revoke();startRetirement() }
}

#if DEBUG
/** Isolated software signing fixtures call the actual compiler. No fixture
 * material can reach the Bundle loader or source-owned production pin JSON. */
enum PlanetChildNativePackageRuntimeFixture {
    private static func check(_ value: Bool) throws { guard value else { throw PinKnownRefusal() } }
    private static func denied(_ body: () throws -> Void) throws { var failed=false;do { try body() } catch { failed=true };try check(failed) }
    private static func bytes(_ value: Any,sorted: Bool=false) throws -> Data { try JSONSerialization.data(withJSONObject:value,options:sorted ? [.sortedKeys,.withoutEscapingSlashes]:[.withoutEscapingSlashes]) }
    private final class Fixture {
        let now: Int64=1791115200000,signer=P256.Signing.PrivateKey(),saved: Data,profile: LocalV2PackageProfile
        var payload: [String:Any],policy: [String:Any],root: [String:Any],review: [String:Any],pin: [String:Any],key: [String:Any],keys: [[String:Any]]
        var packageBytes=Data(),reviewBytes=Data()
        init() throws {
            let profileBytes=Data(#"{"id":"reader","label":"Native Reader","exactAge":9,"ageBand":"9-11","locale":"en","ageConfirmedAt":"2026-10-01T12:00:00.000Z","readingLevel":null,"allowedTopics":["nature"],"blockedTopics":["horror"],"soundEnabled":false,"motion":"calm","narrationEnabled":false,"localeLocked":true}"#.utf8)
            saved=try PlanetChildLocalCanonicalRuntimeFixture.child(profileBytes);let record=try LocalSnapshotV2.decode(saved,policy:LocalSnapshotV2Policy(version:PlanetChildLocalProfileRuntimeFixture.version,checksum:PlanetChildLocalProfileRuntimeFixture.checksum,maximum:1200000,delays:[100,250]));defer { record.close() };profile=try LocalV2PackageProfile(record)
            payload=["title":"Nature","text":"A tree.","terms":["tree"],"references":[]];let hash=LocalSnapshotV2.hash(try Self.payloadBytes(payload))
            policy=["id":"start","kind":"activity","sourceVersion":"source.v1","policyVersion":profile.policyVersion,"minAge":3,"maxAge":17,"reviewStatus":"approved",
                "localizedContent":[["locale":"en","contentChecksum":hash,"reviewStatus":"approved","available":true,"reviewerId":"isolated-editor","reviewedAt":now-1000]],"topics":["nature"],"topicTagsComplete":true,"commercialAvailability":"included-in-base",
                "rights":["status":"approved","basis":"original","platforms":["android-google","ios-ipados"],"territories":["RU"],"validFrom":now-2000,"expiresAt":NSNull()]]
            root=["schemaVersion":1,"namespace":"child","packageId":"isolated-package","packageVersion":1,"locale":"en","exactAge":9,"policyVersion":profile.policyVersion,"policyChecksum":profile.policyChecksum,"validFromEpochMs":now-2000,"validUntilEpochMs":now+5000,"home":["kind":"activity","id":"start","contentChecksum":hash],"entities":[]]
            review=["schemaVersion":1,"kind":"literary-planet-child-release-review-v1","keyId":"child-release-review-isolated-fixture","reviewerId":"isolated-editor","packageId":"isolated-package","packageVersion":1,"packageChecksum":"","policyVersion":profile.policyVersion,"policyChecksum":profile.policyChecksum,"locale":"en","exactAge":9,"readingLevels":[NSNull()],"platforms":["android-google","ios-ipados"],"territories":["RU"],"reviewedAtEpochMs":now-1000,"validFromEpochMs":now-2000,"validUntilEpochMs":now+4000,"entityPolicyChecksums":[]]
            key=["keyId":"child-release-review-isolated-fixture","reviewerId":"isolated-editor","publicKeyX963Hex":signer.publicKey.x963Representation.map { String(format:"%02x",$0) }.joined()];keys=[key]
            pin=["packageId":"isolated-package","packageVersion":1,"packageChecksum":"","reviewChecksum":""];try refresh()
        }
        private static func payloadBytes(_ row: [String:Any]) throws -> Data { let value=try LocalV2PackageJson.read(bytes(row),131072),m=try LocalV2PackageValue.object(value)
            return Data(try LocalV2PackageValue.object([("title",m["title"]!),("text",m["text"]!),("terms",m["terms"]!),("references",m["references"]!)]).json(sorted:false).utf8) }
        func refresh(closure: Bool=true,entities: [[String:Any]]?=nil) throws {
            if closure { let hash=LocalSnapshotV2.hash(try Self.payloadBytes(payload));var localized=policy["localizedContent"] as! [[String:Any]];localized[0]["contentChecksum"]=hash;policy["localizedContent"]=localized;root["home"]=["kind":"activity","id":"start","contentChecksum":hash]
                review["entityPolicyChecksums"]=[["kind":policy["kind"]!,"id":policy["id"]!,"payloadChecksum":hash,"policyChecksum":LocalSnapshotV2.hash(try bytes(policy,sorted:true))]] }
            root["entities"]=entities ?? [["policy":policy,"payload":payload]];packageBytes.resetBytes(in:0..<packageBytes.count);reviewBytes.resetBytes(in:0..<reviewBytes.count);packageBytes=try bytes(root);let hash=LocalSnapshotV2.hash(packageBytes);review["packageChecksum"]=hash;pin["packageChecksum"]=hash;review.removeValue(forKey:"signatureHex")
            var message=Data("LP-CHILD-RELEASE-REVIEW\0v1\0".utf8);message.append(try bytes(review,sorted:true));defer { message.resetBytes(in:0..<message.count) };review["signatureHex"]=try signer.signature(for:message).rawRepresentation.map { String(format:"%02x",$0) }.joined();reviewBytes=try bytes(review);pin["reviewChecksum"]=LocalSnapshotV2.hash(reviewBytes)
        }
        func compile(platform: String="ios-ipados",territory: String="RU",at: Int64?=nil,stop: Int=0) throws -> LocalV2CompiledPackage {
            let pin=try LocalV2PackageJson.read(bytes(self.pin),65536),keys=try self.keys.map { try LocalV2PackageJson.read(bytes($0),65536) };var calls=0
            return try LocalV2PackageCompiler.compile(packageBytes,reviewBytes,pin,keys,profile,platform,territory,at ?? now) { calls+=1;if stop>0,calls==stop { throw PinKnownRefusal() } }
        }
        deinit { packageBytes.resetBytes(in:0..<packageBytes.count);reviewBytes.resetBytes(in:0..<reviewBytes.count) }
    }
    static func run(_ name: String) throws -> Bool {
        if name=="catalog" {
            let sourceHash=String(repeating:"a",count:64),catalog: [String:Any]=["schemaVersion":1,"kind":"literary-planet-child-native-assets-v1","platform":"ios-ipados","pinSourceChecksum":sourceHash,"reviewKeys":[],"packages":[]],catalogBytes=try bytes(catalog)
            var source: [String:Any]=["path":"src/child/childNativeReleasePins.json","sha256":sourceHash],row: [String:Any]=["path":"child-native/catalog-v1.json","bytes":catalogBytes.count,"sha256":LocalSnapshotV2.hash(catalogBytes)]
            var artifact: [String:Any]=["schemaVersion":1,"kind":"literary-planet-bundled-native-preparation","platform":"ios","channel":"appStore","sourceInputs":["files":[source]],"inventory":[row]]
            let parsed=try LocalV2PackageCatalog(catalogBytes,bytes(artifact),"ios");try check(parsed.keys.isEmpty && parsed.pins.isEmpty)
            artifact["channel"]="dev";try denied { _ = try LocalV2PackageCatalog(catalogBytes,bytes(artifact),"ios") };artifact["channel"]="appStore";source["sha256"]=String(repeating:"f",count:64);artifact["sourceInputs"]=["files":[source]];try denied { _ = try LocalV2PackageCatalog(catalogBytes,bytes(artifact),"ios") }
            source["sha256"]=sourceHash;artifact["sourceInputs"]=["files":[source]];row["sha256"]=String(repeating:"f",count:64);artifact["inventory"]=[row];try denied { _ = try LocalV2PackageCatalog(catalogBytes,bytes(artifact),"ios") };row["sha256"]=LocalSnapshotV2.hash(catalogBytes);artifact["inventory"]=[row];artifact["sourceInputs"]=["files":[source,source]];try denied { _ = try LocalV2PackageCatalog(catalogBytes,bytes(artifact),"ios") };return true
        }
        if name=="json" {
            for value in [Data(#"{"key":1,"\u006bey":2}"#.utf8),Data([0xc3,0x28]),Data("9007199254740992".utf8),Data("-0".utf8),Data("1.0".utf8),Data((String(repeating:"[",count:18)+"0"+String(repeating:"]",count:18)).utf8)] { try denied { _ = try LocalV2PackageJson.read(value,1024) } }
            let canonical=try LocalV2PackageJson.read(Data(#"{"z":"/Природа","a":[null,true,7]}"#.utf8),1024).json(sorted:true);try check(canonical == #"{"a":[null,true,7],"z":"/Природа"}"#);return true
        }
        let f=try Fixture()
        switch name {
        case "valid":let compiled=try f.compile();defer { compiled.close() };try check(compiled.packageId=="isolated-package" && compiled.version==1 && compiled.checksum==LocalSnapshotV2.hash(f.packageBytes) && compiled.reviewChecksum==LocalSnapshotV2.hash(f.reviewBytes) && compiled.until==f.now+4000)
            var payload=try compiled.copy("activity/start",f.now);defer { payload.resetBytes(in:0..<payload.count) };try check(String(decoding:payload,as:UTF8.self)==#"{"title":"Nature","text":"A tree.","terms":["tree"],"references":[]}"#);compiled.close();try denied { _ = try compiled.copy("activity/start",f.now) }
        case "delivery":let compiled=try f.compile(),copies=LocalV2PackageCopies(compiled);defer { copies.close() };var checks=0
            let first=try copies.copy("activity/start",{ f.now },{ checks+=1 }),second=try copies.copy("activity/start",{ f.now },{ checks+=1 });try check(checks==4);copies.close();try denied { _ = try first.copy() };try denied { _ = try second.copy() };try denied { _ = try copies.copy("activity/start",{ f.now },{}) }
            let expiring=LocalV2PackageCopies(try f.compile());defer { expiring.close() };var times=0;try denied { _ = try expiring.copy("activity/start",{ times+=1;return times==1 ? f.now:f.now+4000 },{}) };try check(times==2)
            let cancelling=LocalV2PackageCopies(try f.compile());defer { cancelling.close() };checks=0;try denied { _ = try cancelling.copy("activity/start",{ f.now },{ checks+=1;if checks==2 { cancelling.close() } }) };try check(checks==2)
        case "binding":let state=try PlanetChildLocalProfileRuntimeFixture.inspect(f.saved);try check(f.profile.id=="reader" && f.profile.revision==2 && f.profile.exactAge==9 && f.profile.locale=="en" && state.count==2 && state.debt==250 && state.observed==17)
            let p=try LocalSnapshotV2Policy(version:f.profile.policyVersion,checksum:f.profile.policyChecksum,maximum:1200000,delays:[100,250]),adultBytes=try PlanetChildLocalCanonicalRuntimeFixture.prepare(f.saved,action:"exit-child-mode",target:Data()),adult=try LocalSnapshotV2.decode(adultBytes,policy:p);defer { adult.close() };try denied { _ = try LocalV2PackageProfile(adult) }
        case "audience":try denied { _ = try f.compile(territory:"US") };try denied { _ = try f.compile(platform:"android-rustore") }
            for (key,value) in [("locale","ru" as Any),("exactAge",8 as Any),("policyChecksum",String(repeating:"b",count:64) as Any),("readingLevels",["fluent"] as Any)] { let original=f.review[key];f.review[key]=value;try f.refresh(closure:false);try denied { _ = try f.compile() };f.review[key]=original }
            f.policy["topics"]=["horror"];try f.refresh();try denied { _ = try f.compile() }
        case "trust":f.keys=[];try denied { _ = try f.compile() };f.keys=[f.key];f.keys[0]["reviewerId"]="foreign";try denied { _ = try f.compile() };f.keys=[f.key]
            let hash=f.pin["reviewChecksum"];f.pin["reviewChecksum"]=String(repeating:"f",count:64);try denied { _ = try f.compile() };f.pin["reviewChecksum"]=hash;f.review["signatureHex"]=String(repeating:"0",count:128);f.reviewBytes=try bytes(f.review);f.pin["reviewChecksum"]=LocalSnapshotV2.hash(f.reviewBytes);try denied { _ = try f.compile() }
            f.review["keyId"]="local-qa-1";try f.refresh(closure:false);try denied { _ = try f.compile() }
        case "closure":f.payload["references"]=[["kind":"writer","id":"missing","contentChecksum":String(repeating:"b",count:64)]];try f.refresh();try denied { _ = try f.compile() };f.payload["references"]=[];try f.refresh()
            try f.refresh(entities:[["policy":f.policy,"payload":f.payload],["policy":f.policy,"payload":f.payload]]);try denied { _ = try f.compile() };try f.refresh();f.review["entityPolicyChecksums"]=[];try f.refresh(closure:false);try denied { _ = try f.compile() }
            try f.refresh();f.policy["sourceVersion"]="source.v2";try f.refresh(closure:false);try denied { _ = try f.compile() }
        case "rights":var rights=f.policy["rights"] as! [String:Any];rights["basis"]="licensed";f.policy["rights"]=rights;try f.refresh();try denied { _ = try f.compile() };rights["basis"]="original";f.policy["rights"]=rights;f.policy["commercialAvailability"]="optional";try f.refresh();try denied { _ = try f.compile() }
            f.policy["commercialAvailability"]="included-in-base";rights["expiresAt"]=f.now;f.policy["rights"]=rights;try f.refresh();try denied { _ = try f.compile() };rights["expiresAt"]=NSNull();f.policy["rights"]=rights;f.policy["reviewStatus"]="not-reviewed";try f.refresh();try denied { _ = try f.compile() }
            f.policy["reviewStatus"]="approved";var locale=f.policy["localizedContent"] as! [[String:Any]];locale[0]["reviewedAt"]=f.now+1;f.policy["localizedContent"]=locale;try f.refresh();try denied { _ = try f.compile() }
        case "escalation":f.root["assets"]=["../../outside"];try f.refresh();try denied { _ = try f.compile() };f.root.removeValue(forKey:"assets");f.policy["kind"]="image";try f.refresh();try denied { _ = try f.compile() };f.policy["kind"]="activity"
            f.payload["references"]=[["kind":"external-link","id":"adult","contentChecksum":String(repeating:"b",count:64)]];try f.refresh();try denied { _ = try f.compile() };f.payload["references"]=[];f.payload["text"]="bad\0payload";try f.refresh();try denied { _ = try f.compile() }
            f.payload["text"]=String(repeating:"a",count:32769);try f.refresh();try denied { _ = try f.compile() };f.payload["text"]="A tree.";f.payload["title"]="\u{00a0}Nature";try f.refresh();try denied { _ = try f.compile() }
        case "expiry":let original=f.packageBytes;try denied { _ = try f.compile(stop:4) };try check(original==f.packageBytes);try denied { _ = try f.compile(at:f.now+4000) };let compiled=try f.compile();defer { compiled.close() };try denied { _ = try compiled.copy("activity/start",f.now+4000) }
        default:throw PinKnownRefusal()
        };return true
    }
}
#endif
