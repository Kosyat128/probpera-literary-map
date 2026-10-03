import Foundation
import Security
import CryptoKit
import Darwin
import CommonCrypto
import UIKit

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
            try p.field("narrationEnabled"); _ = try p.bool(); try p.token("}"); return id
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
fileprivate enum PinNativeReplyKind { case unenrolled, enrolled, committed, primitive, closed }
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
