import Foundation
import Security
import CryptoKit
import Darwin

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
fileprivate enum PinNativeReplyKind { case unenrolled, enrolled, committed, closed }
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
        try Self.require(!inspection.retiring && inspection.phase==expected); inspection.phase=next; workerLocked(inspection)
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
            while inspection.workers != 0 || inspection.transfers != 0 { condition.wait() }
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
