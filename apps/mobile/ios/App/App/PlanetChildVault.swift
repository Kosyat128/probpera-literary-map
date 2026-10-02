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
    static let maxBytes = 131072
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
