import Foundation
import Security
import CryptoKit
import Darwin

/** Private native CHILD data coordinator; no Capacitor registration or App wire.
 * A Lease is a data partition, never PIN/profile/package/current-rights admission.
 * Four purposes share one protected AES.GCM snapshot and process+flock ordering.
 * Ordinary Keychain/crypto/file protection does not establish anti-rollback or
 * restart-stable parent authority. A failure after rename is an unknown ack;
 * only a pre-publication failure can discard the entire staged batch. */
final class PlanetChildDataStore {
    static let maxValueBytes = 8 * 1024 * 1024, maxSnapshotBytes = 32 * 1024 * 1024
    static let maxSlots = 4096, maxBatch = 64
    private static let maxSafe: UInt64 = 9007199254740991
    private static let processLock = NSLock()
    enum Failure: Error { case unavailable }
    enum Purpose: String, CaseIterable { case search, history, cache, offline }
    struct Scope {
        let profileId: String, profileRevision: UInt64, exactAge: Int, locale: String
        let policyVersion: String, policyChecksum: String, packageId: String, packageVersion: UInt64, packageChecksum: String
        fileprivate let tuple: String
        init(profileId: String, profileRevision: UInt64, exactAge: Int, locale: String, policyVersion: String,
             policyChecksum: String, packageId: String, packageVersion: UInt64, packageChecksum: String) throws {
            try PlanetChildDataStore.require(PlanetChildDataStore.identifier(profileId) && PlanetChildDataStore.positive(profileRevision) && (3...17).contains(exactAge) && ["ru", "en"].contains(locale)
                && PlanetChildDataStore.identifier(policyVersion) && PlanetChildDataStore.checksum(policyChecksum) && PlanetChildDataStore.identifier(packageId) && PlanetChildDataStore.positive(packageVersion) && PlanetChildDataStore.checksum(packageChecksum))
            self.profileId = profileId; self.profileRevision = profileRevision; self.exactAge = exactAge; self.locale = locale
            self.policyVersion = policyVersion; self.policyChecksum = policyChecksum; self.packageId = packageId
            self.packageVersion = packageVersion; self.packageChecksum = packageChecksum
            let bytes = try JSONSerialization.data(withJSONObject: [1, "child", profileId, profileRevision, exactAge, locale,
                policyVersion, policyChecksum, packageId, packageVersion, packageChecksum])
            guard let encoded = String(data: bytes, encoding: .utf8) else { throw Failure.unavailable }; tuple = encoded
        }
        func key(_ purpose: Purpose) -> String { "probpera-child-v1/" + purpose.rawValue + "/" + Data(tuple.utf8).map { String(format: "%02x", $0) }.joined() }
        func itemKey(_ purpose: Purpose, kind: String, id: String) throws -> String {
            try PlanetChildDataStore.require((purpose == .cache || purpose == .offline) && PlanetChildDataStore.entityKind(kind) && PlanetChildDataStore.identifier(id) && (purpose != .offline || kind == "offline-package"))
            return key(purpose) + "/item/" + kind + "/" + id
        }
        fileprivate static func decode(_ tuple: String) throws -> Scope {
            try StrictJSON.validate(Data(tuple.utf8)); guard let row = try JSONSerialization.jsonObject(with: Data(tuple.utf8)) as? [Any], row.count == 11 else { throw Failure.unavailable }
            try PlanetChildDataStore.require(try PlanetChildDataStore.integer(row[0], min: 1, max: 1) == 1 && PlanetChildDataStore.text(row[1]) == "child")
            let scope = try Scope(profileId: PlanetChildDataStore.text(row[2]), profileRevision: PlanetChildDataStore.integer(row[3], min: 1, max: PlanetChildDataStore.maxSafe), exactAge: Int(PlanetChildDataStore.integer(row[4], min: 3, max: 17)),
                locale: PlanetChildDataStore.text(row[5]), policyVersion: PlanetChildDataStore.text(row[6]), policyChecksum: PlanetChildDataStore.text(row[7]), packageId: PlanetChildDataStore.text(row[8]), packageVersion: PlanetChildDataStore.integer(row[9], min: 1, max: PlanetChildDataStore.maxSafe), packageChecksum: PlanetChildDataStore.text(row[10]))
            try PlanetChildDataStore.require(scope.tuple == tuple); return scope
        }
    }
    /** Opaque native object. Scope JSON, a UI boolean or JS lease cannot mint it. */
    final class Lease {
        fileprivate weak var owner: PlanetChildDataStore?
        fileprivate let scope: Scope, generation: UInt64, nonce: String
        // Partition metadata only; owner and constructor remain fileprivate.
        var partitionGeneration: UInt64 { generation }
        var partitionNonce: String { nonce }
        fileprivate init(owner: PlanetChildDataStore, scope: Scope, generation: UInt64, nonce: String) { self.owner = owner; self.scope = scope; self.generation = generation; self.nonce = nonce }
    }
    final class Cancellation {
        fileprivate weak var owner: PlanetChildDataStore?
        fileprivate let lease: Lease, deadline: UInt64
        fileprivate var cancelled = false, used = false
        fileprivate init(owner: PlanetChildDataStore, lease: Lease, deadline: UInt64) { self.owner = owner; self.lease = lease; self.deadline = deadline }
    }
    struct ReadKey { let purpose: Purpose, key: String }
    final class Mutation {
        let purpose: Purpose, key: String, expectedRevision: UInt64
        private let lock = NSLock(); private var bytes: Data, disposed = false
        init(purpose: Purpose, key: String, expectedRevision: UInt64, value: Data) throws {
            try PlanetChildDataStore.require(key.utf8.count <= 4096 && expectedRevision < PlanetChildDataStore.maxSafe-1 && !value.isEmpty && value.count <= PlanetChildDataStore.maxValueBytes)
            self.purpose = purpose; self.key = key; self.expectedRevision = expectedRevision; bytes = Data(Array(value))
        }
        fileprivate func copy(remainingBytes: Int) throws -> Data { lock.lock(); defer { lock.unlock() }; try PlanetChildDataStore.require(!disposed && remainingBytes >= 0 && bytes.count <= remainingBytes); return bytes.withUnsafeBytes { Data(bytes:$0.baseAddress!,count:$0.count) } }
        func dispose() { lock.lock(); defer { lock.unlock() }; disposed = true; bytes.resetBytes(in: 0..<bytes.count) }
        deinit { bytes.resetBytes(in: 0..<bytes.count) }
    }
    final class Slot {
        let revision: UInt64, checksum: String?
        private let lock = NSLock(); private var bytes: Data?, disposed = false
        fileprivate init(revision: UInt64, value: Data?) { self.revision = revision; bytes = value.map { Data(Array($0)) }; checksum = value.map(PlanetChildDataStore.digest) }
        func copyValue() throws -> Data? { lock.lock(); defer { lock.unlock() }; try PlanetChildDataStore.require(!disposed); return bytes.map { Data(Array($0)) } }
        func dispose() { lock.lock(); defer { lock.unlock() }; disposed = true; if bytes != nil { let count = bytes!.count; bytes!.resetBytes(in: 0..<count) } }
        deinit { if bytes != nil { let count = bytes!.count; bytes!.resetBytes(in: 0..<count) } }
    }
    final class Result {
        private let reads: [String: Slot]
        fileprivate init(reads: [String: Slot]) { self.reads = reads }
        func get(_ purpose: Purpose, key: String) -> Slot? { reads[purpose.rawValue + "\n" + key] }
        func dispose() { for slot in reads.values { slot.dispose() } }
        deinit { dispose() }
    }
    private struct Stored { let revision: UInt64; var value: Data }
    private final class State {
        var generation: UInt64 = 0, nonce = "", scope: Scope?
        var entries: [String: Stored] = [:]
        func wipe() { for key in Array(entries.keys) { if var stored = entries.removeValue(forKey:key) { stored.value.resetBytes(in: 0..<stored.value.count) } } }
        deinit { wipe() }
    }
    private let name: String, identity: String
    private var active: Lease?, closed = false
    convenience init() throws { try self.init(runId: nil) }
    static func synthetic(runId: String) throws -> PlanetChildDataStore {
        #if DEBUG
        try PlanetChildDataStore.require(runId.range(of: "\\A[a-f0-9]{32}\\z", options: .regularExpression) != nil); return try PlanetChildDataStore(runId: runId)
        #else
        throw Failure.unavailable
        #endif
    }
    private init(runId: String?) throws {
        guard let bundle = Bundle.main.bundleIdentifier, bundle == "ru.probpera.literaryplanet" else { throw Failure.unavailable }
        name = "literary-planet-child-data-v1" + (runId.map { "-synthetic-" + $0 } ?? ""); identity = bundle + "." + name
        try locked { if runId==nil { try existingOnly($0) } else { try initialize($0) } }
    }
    private static func require(_ value: Bool) throws { guard value else { throw Failure.unavailable } }
    private static func identifier(_ value: String) -> Bool { value.range(of: "\\A[A-Za-z0-9][A-Za-z0-9._-]{0,95}\\z", options: .regularExpression) != nil }
    private static func checksum(_ value: String) -> Bool { value.range(of: "\\A[a-f0-9]{64}\\z", options: .regularExpression) != nil }
    private static func positive(_ value: UInt64) -> Bool { value >= 1 && value <= PlanetChildDataStore.maxSafe }
    private static func text(_ value: Any) throws -> String { guard let value = value as? String else { throw Failure.unavailable }; return value }
    private static func integer(_ value: Any, min: UInt64, max: UInt64) throws -> UInt64 {
        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(), number.doubleValue.isFinite,
              number.doubleValue >= Double(min), number.doubleValue <= Double(max), number.doubleValue.rounded(.towardZero) == number.doubleValue else { throw Failure.unavailable }
        let exact = number.uint64Value; try PlanetChildDataStore.require(exact >= min && exact <= max); return exact
    }
    private static func digest(_ value: Data) -> String { SHA256.hash(data: value).map { String(format: "%02x", $0) }.joined() }
    private static func random(_ count: Int) throws -> Data { var bytes = Data(count: count); let status = bytes.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, count, $0.baseAddress!) }; guard status == errSecSuccess else { bytes.resetBytes(in: 0..<bytes.count); throw Failure.unavailable }; return bytes }
    private static func nonce() throws -> String { var bytes = try PlanetChildDataStore.random(16); defer { bytes.resetBytes(in: 0..<bytes.count) }; return bytes.map { String(format: "%02x", $0) }.joined() }
    private static func now() throws -> UInt64 {
        var scale = mach_timebase_info_data_t(); try PlanetChildDataStore.require(mach_timebase_info(&scale) == KERN_SUCCESS && scale.numer > 0 && scale.denom > 0)
        let product = mach_continuous_time().multipliedFullWidth(by: UInt64(scale.numer)), denominator = UInt64(scale.denom) * 1_000_000
        try PlanetChildDataStore.require(product.high < denominator); let value = denominator.dividingFullWidth(product).quotient; try PlanetChildDataStore.require(value <= PlanetChildDataStore.maxSafe); return value
    }
    private static func entityKind(_ kind: String) -> Bool { ["country","writer","biography","work","character","storyworld","fact","quote","activity","quiz","narration","image","animation","background","skin","stand","accessory","search-result","recommendation","favorite","recent","offline-package","deep-link","external-link","store-preview"].contains(kind) }
    private static func object(_ value: Any, keys: [String]) throws -> [String: Any] { guard let object = value as? [String: Any], Set(object.keys) == Set(keys) else { throw Failure.unavailable }; return object }
    private static func objectScope(_ value: Any) throws -> Scope {
        let row = try PlanetChildDataStore.object(value, keys: ["schemaVersion","namespace","profileId","profileRevision","exactAge","locale","policyVersion","policyChecksum","packageId","packageVersion","packageChecksum"])
        try PlanetChildDataStore.require(try PlanetChildDataStore.integer(row["schemaVersion"]!, min: 1, max: 1) == 1 && PlanetChildDataStore.text(row["namespace"]!) == "child")
        return try Scope(profileId: PlanetChildDataStore.text(row["profileId"]!), profileRevision: PlanetChildDataStore.integer(row["profileRevision"]!, min: 1, max: PlanetChildDataStore.maxSafe), exactAge: Int(PlanetChildDataStore.integer(row["exactAge"]!, min: 3, max: 17)),
            locale: PlanetChildDataStore.text(row["locale"]!), policyVersion: PlanetChildDataStore.text(row["policyVersion"]!), policyChecksum: PlanetChildDataStore.text(row["policyChecksum"]!), packageId: PlanetChildDataStore.text(row["packageId"]!), packageVersion: PlanetChildDataStore.integer(row["packageVersion"]!, min: 1, max: PlanetChildDataStore.maxSafe), packageChecksum: PlanetChildDataStore.text(row["packageChecksum"]!))
    }
    private static func keyScope(_ purpose: Purpose, key: String) throws -> Scope {
        let prefix = "probpera-child-v1/" + purpose.rawValue + "/"; try PlanetChildDataStore.require(key.utf8.count <= 4096 && key.hasPrefix(prefix))
        let remainder = String(key.dropFirst(prefix.count)), parts = remainder.components(separatedBy: "/"), encoded = parts[0]
        try PlanetChildDataStore.require(encoded.count >= 2 && encoded.count % 2 == 0 && encoded.range(of: "\\A[a-f0-9]+\\z", options: .regularExpression) != nil)
        let characters = Array(encoded.utf8); var bytes = Data(); defer { bytes.resetBytes(in: 0..<bytes.count) }
        for index in stride(from: 0, to: characters.count, by: 2) { guard let byte = UInt8(String(bytes: characters[index..<index+2], encoding: .ascii)!, radix: 16) else { throw Failure.unavailable }; bytes.append(byte) }
        guard let tuple = String(data: bytes, encoding: .utf8) else { throw Failure.unavailable }; let scope = try Scope.decode(tuple)
        if purpose == .search || purpose == .history { try PlanetChildDataStore.require(key == scope.key(purpose)) }
        else { try PlanetChildDataStore.require(parts.count == 4 && parts[1] == "item"); try PlanetChildDataStore.require(key == scope.itemKey(purpose, kind: parts[2], id: parts[3])) }; return scope
    }
    private static func reference(_ value: Any) throws -> (String, String, String) {
        let row = try PlanetChildDataStore.object(value, keys: ["kind","id","contentChecksum"]), kind = try PlanetChildDataStore.text(row["kind"]!), id = try PlanetChildDataStore.text(row["id"]!), hash = try PlanetChildDataStore.text(row["contentChecksum"]!)
        try PlanetChildDataStore.require(PlanetChildDataStore.entityKind(kind) && PlanetChildDataStore.identifier(id) && PlanetChildDataStore.checksum(hash)); return (kind, id, hash)
    }
    private static func payload(_ value: Any) throws -> [(String,String,String)] {
        let row = try PlanetChildDataStore.object(value, keys: ["title","text","terms","references"]), title = try PlanetChildDataStore.text(row["title"]!), body = try PlanetChildDataStore.text(row["text"]!)
        try PlanetChildDataStore.require(!title.isEmpty && title.utf16.count <= 240 && body.utf16.count <= 32768
            && title.range(of: "[\\x00-\\x1f\\x7f]", options: .regularExpression) == nil && body.range(of: "[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]", options: .regularExpression) == nil)
        guard let terms = row["terms"] as? [Any], terms.count <= 64, let rawReferences = row["references"] as? [Any], rawReferences.count <= 64 else { throw Failure.unavailable }
        var seen = Set<String>(); for raw in terms { let term = try PlanetChildDataStore.text(raw); try PlanetChildDataStore.require(!term.isEmpty && term.utf16.count <= 80 && term.range(of: "[\\x00-\\x1f\\x7f]", options: .regularExpression) == nil && seen.insert(term).inserted) }
        seen.removeAll(); let references = try rawReferences.map(PlanetChildDataStore.reference); for ref in references { try PlanetChildDataStore.require(seen.insert(ref.0 + "/" + ref.1).inserted) }; return references
    }
    /** Structural storage envelope. Current compiled index/review still owns
     * semantic content/rights checks; successful parsing grants no admission. */
    private static func envelope(_ purpose: Purpose, key: String, scope: Scope, bytes: Data) throws {
        try PlanetChildDataStore.require(!bytes.isEmpty && bytes.count <= PlanetChildDataStore.maxValueBytes); try StrictJSON.validate(bytes)
        let isList = purpose == .search || purpose == .history, row = try PlanetChildDataStore.object(JSONSerialization.jsonObject(with: bytes), keys: ["schemaVersion","scope", isList ? "references" : "entries"])
        try PlanetChildDataStore.require(try PlanetChildDataStore.integer(row["schemaVersion"]!, min: 1, max: 1) == 1 && PlanetChildDataStore.objectScope(row["scope"]!).tuple == scope.tuple)
        guard let rows = row[isList ? "references" : "entries"] as? [Any], rows.count <= PlanetChildDataStore.maxSlots else { throw Failure.unavailable }
        if isList { var seen = Set<String>(); for raw in rows { let ref = try PlanetChildDataStore.reference(raw); try PlanetChildDataStore.require(ref.0 == (purpose == .search ? "search-result" : "recent") && seen.insert(ref.0 + "/" + ref.1).inserted) } }
        else { try PlanetChildDataStore.require(!rows.isEmpty); var hashes: [String:String] = [:], references: [[(String,String,String)]] = []
            for (index, raw) in rows.enumerated() { let entry = try PlanetChildDataStore.object(raw, keys: ["reference","payload"]), ref = try PlanetChildDataStore.reference(entry["reference"]!), id = ref.0 + "/" + ref.1
                try PlanetChildDataStore.require(hashes[id] == nil); hashes[id] = ref.2; if index == 0 { try PlanetChildDataStore.require(key == scope.itemKey(purpose, kind: ref.0, id: ref.1)) }; references.append(try PlanetChildDataStore.payload(entry["payload"]!)) }
            for refs in references { for ref in refs { try PlanetChildDataStore.require(hashes[ref.0 + "/" + ref.1] == ref.2) } }
        }
    }
    private func query() -> [String: Any] { [kSecClass as String:kSecClassGenericPassword, kSecAttrService as String:identity, kSecAttrAccount as String:"child-data-aes-v1", kSecAttrSynchronizable as String:false] }
    private func key(create: Bool, directory: URL) throws -> SymmetricKey {
        var request = query(); request[kSecAttrSynchronizable as String] = kSecAttrSynchronizableAny; request[kSecReturnData as String] = true; request[kSecReturnAttributes as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitAll
        var result: CFTypeRef?; let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecSuccess {
            guard !create, let rows = result as? [[String:Any]], rows.count == 1, let item=rows.first, (item[kSecAttrSynchronizable as String] as? Bool) != true, var bytes = item[kSecValueData as String] as? Data, bytes.count == 32,
                  item[kSecAttrAccessible as String] as? String == kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String else { throw Failure.unavailable }
            defer { bytes.resetBytes(in: 0..<bytes.count) }; return SymmetricKey(data: bytes)
        }
        try PlanetChildDataStore.require(status == errSecItemNotFound && create && !FileManager.default.fileExists(atPath: directory.appendingPathComponent("snapshot-v1").path)
            && !FileManager.default.fileExists(atPath: directory.appendingPathComponent("snapshot-v1.new").path))
        var bytes = try Self.random(32); defer { bytes.resetBytes(in: 0..<bytes.count) }; var add = query(); add[kSecValueData as String] = bytes; add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        try PlanetChildDataStore.require(SecItemAdd(add as CFDictionary, nil) == errSecSuccess); return SymmetricKey(data: bytes)
    }
    private func directory() throws -> URL {
        let manager = FileManager.default, parent = try manager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).resolvingSymlinksInPath().standardizedFileURL
        var directory = parent.appendingPathComponent(name, isDirectory: true)
        if !manager.fileExists(atPath: directory.path) { try manager.createDirectory(at: directory, withIntermediateDirectories: false, attributes: [.posixPermissions:0o700,.protectionKey:FileProtectionType.complete]) }
        try Self.require(directory.resolvingSymlinksInPath().standardizedFileURL == directory.standardizedFileURL)
        var values = URLResourceValues(); values.isExcludedFromBackup = true; try directory.setResourceValues(values); return directory
    }
    private func record(_ directory: URL, suffix: String = "") throws -> URL {
        let file = directory.appendingPathComponent("snapshot-v1" + suffix); try Self.require(file.resolvingSymlinksInPath().standardizedFileURL == file.standardizedFileURL)
        var named = stat(); if lstat(file.path, &named) == 0 { try Self.require(named.st_mode & mode_t(S_IFMT) == mode_t(S_IFREG) && named.st_size >= 0 && named.st_size <= off_t(Self.maxSnapshotBytes + 29)) }
        else { try Self.require(errno == ENOENT) }; return file
    }
    private func initialize(_ directory: URL) throws {
        try Self.require(!FileManager.default.fileExists(atPath:birthMarker(directory).path))
        let file = try record(directory), staged = try record(directory, suffix: ".new"), hasFile = FileManager.default.fileExists(atPath:file.path), hasStaged = FileManager.default.fileExists(atPath:staged.path)
        var request = query(); request[kSecReturnData as String] = false; let status = SecItemCopyMatching(request as CFDictionary, nil)
        if hasFile || hasStaged || status != errSecItemNotFound {
            try Self.require(hasFile && status == errSecSuccess); let state = try read(directory); defer { state.wipe() }
            // Base is the actual committed snapshot. A validated, regular .new
            // is a pre-rename crash artifact; discard only after base admission.
            if hasStaged { try Self.require(Darwin.unlink(staged.path) == 0) }; return
        }
        _ = try key(create: true, directory: directory); let state = State(); state.nonce = try Self.nonce(); defer { state.wipe() }
        try write(directory, state: state) { try Self.require(!self.closed) }
    }
    private final class Writer {
        private let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: PlanetChildDataStore.maxSnapshotBytes)
        private var count = 0
        init() { buffer.initialize(repeating: 0, count: PlanetChildDataStore.maxSnapshotBytes) }
        deinit { buffer.update(repeating: 0, count: PlanetChildDataStore.maxSnapshotBytes); buffer.deinitialize(count: PlanetChildDataStore.maxSnapshotBytes); buffer.deallocate() }
        func byte(_ value: UInt8) throws { try PlanetChildDataStore.require(count < PlanetChildDataStore.maxSnapshotBytes); buffer[count] = value; count += 1 }
        func number(_ value: UInt64, bytes: Int) throws { for shift in stride(from: (bytes-1)*8, through: 0, by: -8) { try byte(UInt8(truncatingIfNeeded:value >> shift)) } }
        func data(_ bytes: Data) throws { try PlanetChildDataStore.require(bytes.count <= PlanetChildDataStore.maxSnapshotBytes-count); bytes.withUnsafeBytes { raw in if !bytes.isEmpty { buffer.advanced(by:count).update(from:raw.bindMemory(to:UInt8.self).baseAddress!, count:bytes.count) } }; count += bytes.count }
        func text(_ text: String) throws { var bytes = Data(text.utf8); defer { bytes.resetBytes(in:0..<bytes.count) }; try number(UInt64(bytes.count),bytes:4); try data(bytes) }
        func result() -> Data { Data(bytes:buffer,count:count) }
    }
    private struct Reader {
        let bytes: Data; var position = 0
        mutating func number(_ count: Int) throws -> UInt64 { try PlanetChildDataStore.require(count <= bytes.count-position); var value: UInt64 = 0; for _ in 0..<count { value = (value << 8) | UInt64(bytes[position]); position += 1 }; return value }
        mutating func data(_ count: Int) throws -> Data { try PlanetChildDataStore.require(count >= 0 && count <= bytes.count-position); defer { position += count }; return Data(Array(bytes[position..<position+count])) }
        mutating func text(_ max: Int) throws -> String { let count = try number(4); try PlanetChildDataStore.require(count <= UInt64(max)); var data = try self.data(Int(count)); defer { data.resetBytes(in:0..<data.count) }; guard let value = String(data:data,encoding:.utf8) else { throw Failure.unavailable }; return value }
    }
    private static func encode(_ state: State) throws -> Data {
        let writer = Writer(); try writer.number(0x4c504431,bytes:4); try writer.number(state.generation,bytes:8); try writer.text(state.nonce); try writer.byte(state.scope == nil ? 0 : 1)
        if let scope = state.scope { try writer.text(scope.tuple) }; try PlanetChildDataStore.require(state.entries.count <= PlanetChildDataStore.maxSlots); try writer.number(UInt64(state.entries.count),bytes:4)
        for id in state.entries.keys.sorted() { let pieces = id.components(separatedBy:"\n"); try PlanetChildDataStore.require(pieces.count == 2); guard let purpose = Purpose(rawValue:pieces[0]), let slot = state.entries[id] else { throw Failure.unavailable }
            let scope = try PlanetChildDataStore.keyScope(purpose,key:pieces[1]); try PlanetChildDataStore.envelope(purpose,key:pieces[1],scope:scope,bytes:slot.value); try PlanetChildDataStore.require(PlanetChildDataStore.positive(slot.revision) && slot.revision < PlanetChildDataStore.maxSafe)
            try writer.text(purpose.rawValue); try writer.text(pieces[1]); try writer.number(slot.revision,bytes:8); try writer.text(PlanetChildDataStore.digest(slot.value)); try writer.number(UInt64(slot.value.count),bytes:4); try writer.data(slot.value) }
        return writer.result()
    }
    private static func decode(_ bytes: Data) throws -> State {
        let state = State(); var success = false; defer { if !success { state.wipe() } }; var reader = Reader(bytes:bytes)
        try PlanetChildDataStore.require(try reader.number(4) == 0x4c504431); state.generation = try reader.number(8); try PlanetChildDataStore.require(state.generation < PlanetChildDataStore.maxSafe); state.nonce = try reader.text(32)
        try PlanetChildDataStore.require(state.nonce.range(of:"\\A[a-f0-9]{32}\\z",options:.regularExpression) != nil); let flag = try reader.number(1); try PlanetChildDataStore.require(flag <= 1); if flag == 1 { state.scope = try Scope.decode(reader.text(2048)) }
        let count = try reader.number(4); try PlanetChildDataStore.require(count <= UInt64(PlanetChildDataStore.maxSlots)); for _ in 0..<Int(count) {
            guard let purpose = Purpose(rawValue:try reader.text(16)) else { throw Failure.unavailable }; let key = try reader.text(4096), scope = try PlanetChildDataStore.keyScope(purpose,key:key)
            let revision = try reader.number(8), hash = try reader.text(64), length = try reader.number(4); try PlanetChildDataStore.require(PlanetChildDataStore.positive(revision) && revision < PlanetChildDataStore.maxSafe && PlanetChildDataStore.checksum(hash) && length > 0 && length <= UInt64(PlanetChildDataStore.maxValueBytes))
            var value = try reader.data(Int(length)); defer { value.resetBytes(in:0..<value.count) }; try PlanetChildDataStore.require(PlanetChildDataStore.digest(value) == hash); try PlanetChildDataStore.envelope(purpose,key:key,scope:scope,bytes:value)
            let id = purpose.rawValue + "\n" + key; try PlanetChildDataStore.require(state.entries[id] == nil); state.entries[id] = Stored(revision:revision,value:Data(Array(value)))
        }; try PlanetChildDataStore.require(reader.position == bytes.count); success = true; return state
    }
    private func read(_ directory: URL) throws -> State {
        let file = try record(directory), fd = Darwin.open(file.path,O_RDONLY|O_NOFOLLOW|O_CLOEXEC); try Self.require(fd >= 0); defer { Darwin.close(fd) }
        var stat = Darwin.stat(); try Self.require(fstat(fd,&stat) == 0 && stat.st_mode & mode_t(S_IFMT) == mode_t(S_IFREG) && stat.st_size >= 30 && stat.st_size <= off_t(Self.maxSnapshotBytes+29))
        var encoded = Data(count:Int(stat.st_size)); defer { encoded.resetBytes(in:0..<encoded.count) }
        try encoded.withUnsafeMutableBytes { raw in var position = 0; while position < raw.count { let count = Darwin.read(fd,raw.baseAddress!.advanced(by:position),raw.count-position); try Self.require(count > 0); position += count } }
        var extra: UInt8 = 0; try Self.require(Darwin.read(fd,&extra,1) == 0 && encoded.first == 1)
        let box = try AES.GCM.SealedBox(combined:Data(encoded.dropFirst())); var plain = try AES.GCM.open(box,using:key(create:false,directory:directory),authenticating:Data(identity.utf8))
        defer { plain.resetBytes(in:0..<plain.count) }; try Self.require(!plain.isEmpty && plain.count <= Self.maxSnapshotBytes); return try Self.decode(plain)
    }
    private func write(_ directory: URL, state: State, check: () throws -> Void) throws {
        var plain = try Self.encode(state); defer { plain.resetBytes(in:0..<plain.count) }
        let box = try AES.GCM.seal(plain,using:key(create:false,directory:directory),authenticating:Data(identity.utf8)); guard let combined = box.combined else { throw Failure.unavailable }
        var encoded = Data([1]); encoded.append(combined); defer { encoded.resetBytes(in:0..<encoded.count) }
        let base = try record(directory), staged = try record(directory,suffix:".new"); try check(); let fd = Darwin.open(staged.path,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,mode_t(S_IRUSR|S_IWUSR)); try Self.require(fd >= 0)
        var published = false; defer { Darwin.close(fd); if !published { _ = Darwin.unlink(staged.path) } }
        try FileManager.default.setAttributes([.protectionKey:FileProtectionType.complete],ofItemAtPath:staged.path)
        try encoded.withUnsafeBytes { raw in var position = 0; while position < raw.count { try check(); let count = Darwin.write(fd,raw.baseAddress!.advanced(by:position),min(65536,raw.count-position)); try Self.require(count > 0); position += count } }
        try Self.require(Darwin.fsync(fd) == 0); try check(); try Self.require(Darwin.rename(staged.path,base.path) == 0); published = true
        let directoryFD = Darwin.open(directory.path,O_RDONLY|O_NOFOLLOW|O_CLOEXEC); try Self.require(directoryFD >= 0); defer { Darwin.close(directoryFD) }
        var directoryStat = Darwin.stat(); try Self.require(fstat(directoryFD,&directoryStat) == 0 && directoryStat.st_mode & mode_t(S_IFMT) == mode_t(S_IFDIR) && Darwin.fsync(directoryFD) == 0)
        let actual = try read(directory); defer { actual.wipe() }; var readback = try Self.encode(actual); defer { readback.resetBytes(in:0..<readback.count) }; try Self.require(readback == plain); try check()
        // Any error after rename is unknown acknowledgement, never rollback.
    }
    private func locked<T>(_ work: (URL) throws -> T) throws -> T {
        let started = try Self.now(); while !Self.processLock.try() { let now = try Self.now(); try Self.require(!Thread.current.isCancelled && now >= started && now-started < 1500); Thread.sleep(forTimeInterval:0.01) }
        defer { Self.processLock.unlock() }; do {
            let directory = try directory(), file = directory.appendingPathComponent("transaction.lock"); try Self.require(file.resolvingSymlinksInPath().standardizedFileURL == file.standardizedFileURL)
            let fd = Darwin.open(file.path,O_RDWR|O_CREAT|O_NOFOLLOW|O_CLOEXEC,mode_t(S_IRUSR|S_IWUSR)); try Self.require(fd >= 0); defer { Darwin.close(fd) }; var obtained = false
            defer { if obtained { _ = Darwin.flock(fd,LOCK_UN) } }; while !obtained {
                if Darwin.flock(fd,LOCK_EX|LOCK_NB) == 0 { obtained = true } else { try Self.require(errno == EWOULDBLOCK || errno == EAGAIN); Thread.sleep(forTimeInterval:0.01) }
                let now = try Self.now(); try Self.require(!Thread.current.isCancelled && now >= started && now-started < 1500)
            }
            var opened = Darwin.stat(), named = Darwin.stat(); try Self.require(fstat(fd,&opened) == 0 && lstat(file.path,&named) == 0 && opened.st_mode & mode_t(S_IFMT) == mode_t(S_IFREG) && opened.st_ino == named.st_ino && opened.st_dev == named.st_dev)
            return try work(directory)
        } catch { throw Failure.unavailable }
    }
    private func live(_ lease: Lease, state: State) throws { try Self.require(!closed && active === lease && lease.owner === self && state.generation == lease.generation && state.nonce == lease.nonce && state.scope?.tuple == lease.scope.tuple) }
    func activate(_ scope: Scope) throws -> Lease {
        try locked { directory in try Self.require(!closed); active = nil; let state = try read(directory); defer { state.wipe() }; try Self.require(state.generation < Self.maxSafe-1)
            state.generation += 1; state.nonce = try Self.nonce(); state.scope = scope; try write(directory,state:state) { try Self.require(!self.closed) }
            let lease = Lease(owner:self,scope:scope,generation:state.generation,nonce:state.nonce); active = lease; return lease }
    }
    func operation(_ lease: Lease, timeoutMs: UInt64) throws -> Cancellation {
        try Self.require(timeoutMs > 0 && timeoutMs <= 60000); return try locked { directory in let state = try read(directory); defer { state.wipe() }; try live(lease,state:state)
            let now = try Self.now(); try Self.require(now <= Self.maxSafe-timeoutMs); return Cancellation(owner:self,lease:lease,deadline:now+timeoutMs) }
    }
    // Native continuous operation budget only; never trusted review/PIN time.
    static func partitionNowMs() throws -> UInt64 { try now() }
    func operationUntil(_ lease: Lease, deadlineMs: UInt64) throws -> Cancellation {
        try Self.require(deadlineMs > 0 && deadlineMs <= Self.maxSafe)
        return try locked { directory in
            let state = try read(directory); defer { state.wipe() }; try live(lease,state:state)
            let now = try Self.now(); try Self.require(now < deadlineMs && deadlineMs - now <= 60000)
            return Cancellation(owner:self,lease:lease,deadline:deadlineMs)
        }
    }
    func cancel(_ cancellation: Cancellation) throws { try Self.require(cancellation.owner === self); try locked { _ in cancellation.cancelled = true } }
    private func check(_ cancellation: Cancellation, lease: Lease, state: State) throws { try live(lease,state:state); try Self.require(try cancellation.owner === self && cancellation.lease === lease && cancellation.used && !cancellation.cancelled && !Thread.current.isCancelled && Self.now() < cancellation.deadline) }
    func transact(_ lease: Lease, reads: [ReadKey], writes: [Mutation], cancellation: Cancellation) throws -> Result {
        try Self.require(reads.count <= Self.maxBatch && writes.count <= Self.maxBatch); var values: [Data] = []; defer { while !values.isEmpty { var owned = values.removeLast(); owned.resetBytes(in:0..<owned.count) } }
        var copiedBytes = 0; for mutation in writes { let owned = try mutation.copy(remainingBytes:Self.maxSnapshotBytes-copiedBytes); values.append(owned); copiedBytes += owned.count }
        return try locked { directory in let state = try read(directory); defer { state.wipe() }; try Self.require(!cancellation.used); cancellation.used = true; try check(cancellation,lease:lease,state:state)
            var readIds = Set<String>(), writeIds = Set<String>(), result: [String:Slot] = [:], handed = false; defer { if !handed { for slot in result.values { slot.dispose() } } }
            for read in reads { try Self.require(try Self.keyScope(read.purpose,key:read.key).tuple == lease.scope.tuple && readIds.insert(read.purpose.rawValue + "\n" + read.key).inserted) }
            for (index, mutation) in writes.enumerated() { let id = mutation.purpose.rawValue + "\n" + mutation.key
                try Self.require(try Self.keyScope(mutation.purpose,key:mutation.key).tuple == lease.scope.tuple && writeIds.insert(id).inserted && (state.entries[id]?.revision ?? 0) == mutation.expectedRevision)
                try Self.envelope(mutation.purpose,key:mutation.key,scope:lease.scope,bytes:values[index]) }
            // Validate the entire batch before changing any purpose.
            for read in reads { let id = read.purpose.rawValue + "\n" + read.key; result[id] = Slot(revision:state.entries[id]?.revision ?? 0,value:state.entries[id]?.value) }
            for (index, mutation) in writes.enumerated() { let id = mutation.purpose.rawValue + "\n" + mutation.key
                if var replaced = state.entries.removeValue(forKey:id) { replaced.value.resetBytes(in:0..<replaced.value.count) }; state.entries[id] = Stored(revision:mutation.expectedRevision+1,value:Data(Array(values[index]))) }
            try check(cancellation,lease:lease,state:state); if !writes.isEmpty { try write(directory,state:state) { try self.check(cancellation,lease:lease,state:state) } }; try check(cancellation,lease:lease,state:state)
            handed = true; return Result(reads:result)
        }
    }
    func retire(_ lease: Lease) throws { try locked { directory in let state = try read(directory); defer { state.wipe() }; try live(lease,state:state); active = nil
        try Self.require(state.generation < Self.maxSafe-1); state.generation += 1; state.nonce = try Self.nonce(); state.scope = nil; try write(directory,state:state) { try Self.require(!self.closed) } } }
    func close() throws { try locked { directory in let lease = active; active = nil; closed = true; if let lease {
        let state = try read(directory); defer { state.wipe() }; if state.scope != nil && state.generation == lease.generation && state.nonce == lease.nonce {
            try Self.require(state.generation < Self.maxSafe-1); state.generation += 1; state.nonce = try Self.nonce(); state.scope = nil; try write(directory,state:state) {} } } } }

    /** Syntax validator with decoded-key duplicate detection, bounded depth and
     * node count. Foundation JSON alone is not the duplicate-key boundary. */
    private final class StrictJSON {
        var bytes: [UInt8]; var position = 0, nodes = 0
        init(_ data: Data) throws { try PlanetChildDataStore.require(String(data:data,encoding:.utf8) != nil); bytes = Array(data) }
        deinit { _ = bytes.withUnsafeMutableBytes { $0.initializeMemory(as:UInt8.self,repeating:0) } }
        static func validate(_ data: Data) throws { let parser = try StrictJSON(data); try parser.value(0); parser.space(); try PlanetChildDataStore.require(parser.position == parser.bytes.count) }
        func space() { while position < bytes.count && [9,10,13,32].contains(bytes[position]) { position += 1 } }
        func take() throws -> UInt8 { try PlanetChildDataStore.require(position < bytes.count); defer { position += 1 }; return bytes[position] }
        func value(_ depth: Int) throws { nodes += 1; try PlanetChildDataStore.require(depth <= 64 && nodes <= 100000); space(); try PlanetChildDataStore.require(position < bytes.count)
            let ch = bytes[position]; if ch == 123 { position += 1; space(); var keys = Set<String>(); if position < bytes.count && bytes[position] == 125 { position += 1; return }
                while true { space(); let key = try string(); try PlanetChildDataStore.require(keys.insert(key).inserted); space(); try PlanetChildDataStore.require(take() == 58); try value(depth+1); space(); let separator = try take(); if separator == 125 { return }; try PlanetChildDataStore.require(separator == 44) } }
            if ch == 91 { position += 1; space(); if position < bytes.count && bytes[position] == 93 { position += 1; return }
                while true { try value(depth+1); space(); let separator = try take(); if separator == 93 { return }; try PlanetChildDataStore.require(separator == 44) } }
            if ch == 34 { _ = try string(); return }
            for literal in ["true","false","null"] { let raw = Array(literal.utf8); if position+raw.count <= bytes.count && Array(bytes[position..<position+raw.count]) == raw { position += raw.count; return } }
            let start = position; while position < bytes.count && Array("-+0123456789.eE".utf8).contains(bytes[position]) { position += 1 }; let number = String(bytes:bytes[start..<position],encoding:.ascii) ?? ""
            try PlanetChildDataStore.require(number.count <= 128 && number.range(of:"\\A-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?\\z",options:.regularExpression) != nil && Double(number)?.isFinite == true)
        }
        func code() throws -> UInt16 { try PlanetChildDataStore.require(position+4 <= bytes.count); let text = String(bytes:bytes[position..<position+4],encoding:.ascii) ?? ""; guard let code = UInt16(text,radix:16), text.range(of:"\\A[a-fA-F0-9]{4}\\z",options:.regularExpression) != nil else { throw Failure.unavailable }; position += 4; return code }
        func string() throws -> String { let start = position; try PlanetChildDataStore.require(take() == 34); while true { let ch = try take(); if ch == 34 { break }; try PlanetChildDataStore.require(ch >= 32)
                if ch == 92 { let escape = try take(); if escape == 117 { let scalar = try code(); if (0xd800...0xdbff).contains(scalar) { try PlanetChildDataStore.require(take() == 92 && take() == 117); try PlanetChildDataStore.require((0xdc00...0xdfff).contains(code())) } else { try PlanetChildDataStore.require(!(0xdc00...0xdfff).contains(scalar)) } }
                    else { try PlanetChildDataStore.require(Array("\"\\/bfnrt".utf8).contains(escape)) } } }
            var encoded = Data(bytes[start..<position]); defer { encoded.resetBytes(in:0..<encoded.count) }
            guard let text = try JSONSerialization.jsonObject(with:encoded,options:.fragmentsAllowed) as? String else { throw Failure.unavailable }; return text
        }
    }
    /** Concrete native separate-key birth metadata, never a partition or
     * content/package admission. Only the fresh owner permit can consume it. */
    final class LocalV2BirthPlan {
        let identity: String,nonce: String,checksum: String
        fileprivate let store: PlanetChildDataStore
        fileprivate var plain: Data
        fileprivate var used=false,closed=false
        fileprivate init(_ store: PlanetChildDataStore,_ nonce: String) throws {
            try PlanetChildDataStore.require(nonce.range(of:"\\A[a-f0-9]{32}\\z",options:.regularExpression) != nil);self.store=store;identity=store.identity;self.nonce=nonce
            let state=State();state.nonce=nonce;defer { state.wipe() };plain=try PlanetChildDataStore.encode(state);checksum=PlanetChildDataStore.digest(plain)
        }
        func close() { closed=true;plain.resetBytes(in:0..<plain.count) }
    }
    final class LocalV2BirthReceipt {
        private let original: LocalV2BirthPlan,marker: Data
        fileprivate init(_ original: LocalV2BirthPlan,_ marker: Data) { self.original=original;self.marker=Data(Array(marker)) }
        func readback(_ permit: LocalV2ProfileDataBirthPermit) throws {
            try original.store.locked { directory in try permit.dataReadback(identity:original.identity,nonce:original.nonce,checksum:original.checksum)
                try original.store.exactBirth(directory,plan:original,marker:marker) }
        }
    }
    static func localV2BirthPlan(nonce: String) throws -> LocalV2BirthPlan { try LocalV2BirthPlan(PlanetChildDataStore(runId:nil,deferredBirth:true),nonce) }
    static func fixtureLocalV2BirthPlan(runId: String,nonce: String) throws -> LocalV2BirthPlan {
        #if DEBUG
        try require(runId.range(of:"\\A[a-f0-9]{32}\\z",options:.regularExpression) != nil);return try LocalV2BirthPlan(PlanetChildDataStore(runId:runId,deferredBirth:true),nonce)
        #else
        throw Failure.unavailable
        #endif
    }
    static func fixtureLocalV2ExistingOnly(runId: String) throws -> PlanetChildDataStore {
        let plan=try fixtureLocalV2BirthPlan(runId:runId,nonce:runId);defer { plan.close() };try plan.store.locked { try plan.store.existingOnly($0) };return plan.store
    }
    private init(runId: String?,deferredBirth: Bool) throws {
        guard deferredBirth,let bundle=Bundle.main.bundleIdentifier,bundle=="ru.probpera.literaryplanet" else { throw Failure.unavailable }
        if runId != nil {
            #if DEBUG
            try Self.require(runId!.range(of:"\\A[a-f0-9]{32}\\z",options:.regularExpression) != nil)
            #else
            throw Failure.unavailable
            #endif
        }
        name="literary-planet-child-data-v1"+(runId.map { "-synthetic-"+$0 } ?? "");identity=bundle+"."+name
    }
    private func existingOnly(_ directory: URL) throws {
        let base=try record(directory),staged=try record(directory,suffix:".new")
        try Self.require(FileManager.default.fileExists(atPath:base.path) && !FileManager.default.fileExists(atPath:staged.path))
        _ = try key(create:false,directory:directory);let state=try read(directory);defer { state.wipe() }
    }
    private func birthMarker(_ directory: URL) throws -> URL {
        let file=directory.appendingPathComponent("local-v2-birth.claim");try Self.require(file.resolvingSymlinksInPath().standardizedFileURL==file.standardizedFileURL);return file
    }
    private func exactBirth(_ directory: URL,plan: LocalV2BirthPlan,marker: Data) throws {
        try existingOnly(directory);let file=try birthMarker(directory),fd=Darwin.open(file.path,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);try Self.require(fd>=0);defer { Darwin.close(fd) }
        var opened=stat(),named=stat();try Self.require(fstat(fd,&opened)==0 && lstat(file.path,&named)==0 && opened.st_mode & mode_t(S_IFMT)==mode_t(S_IFREG)
            && opened.st_ino==named.st_ino && opened.st_dev==named.st_dev && opened.st_size==off_t(marker.count) && marker.count<=4096)
        var actual=Data(count:marker.count);defer { actual.resetBytes(in:0..<actual.count) }
        try actual.withUnsafeMutableBytes { raw in var at=0;while at<raw.count { let count=Darwin.read(fd,raw.baseAddress!.advanced(by:at),raw.count-at);try Self.require(count>0);at+=count } }
        try Self.require(actual==marker);let state=try read(directory);defer { state.wipe() };var bytes=try Self.encode(state);defer { bytes.resetBytes(in:0..<bytes.count) }
        try Self.require(state.generation==0 && state.scope==nil && state.entries.isEmpty && state.nonce==plan.nonce && bytes==plan.plain && Self.digest(bytes)==plan.checksum)
    }
    static func localV2Birth(_ original: LocalV2BirthPlan,permit: LocalV2ProfileDataBirthPermit?) throws -> LocalV2BirthReceipt {
        guard let permit else { throw Failure.unavailable }
        let store=original.store
        return try store.locked { directory in
            try Self.require(!original.closed && !original.used && Self.digest(original.plain)==original.checksum);original.used=true
            try permit.consumeDataBirth(identity:original.identity,nonce:original.nonce,checksum:original.checksum)
            var marker=try permit.dataMarker(identity:original.identity,nonce:original.nonce,checksum:original.checksum);defer { marker.resetBytes(in:0..<marker.count) }
            do {
                var query=store.query();query[kSecAttrSynchronizable as String]=kSecAttrSynchronizableAny
                let status=SecItemCopyMatching(query as CFDictionary,nil),base=try store.record(directory),staged=try store.record(directory,suffix:".new"),claim=try store.birthMarker(directory)
                try Self.require(status==errSecItemNotFound && !FileManager.default.fileExists(atPath:base.path) && !FileManager.default.fileExists(atPath:staged.path) && !FileManager.default.fileExists(atPath:claim.path))
                // Durable exclusive claim precedes SecItemAdd. Any unknown add,
                // key/readback/file outcome remains spent without repair.
                let fd=Darwin.open(claim.path,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,mode_t(S_IRUSR|S_IWUSR));try Self.require(fd>=0)
                do { try FileManager.default.setAttributes([.protectionKey:FileProtectionType.complete],ofItemAtPath:claim.path)
                    try marker.withUnsafeBytes { raw in var at=0;while at<raw.count { try permit.dataBoundary(identity:original.identity,nonce:original.nonce,checksum:original.checksum)
                        let count=Darwin.write(fd,raw.baseAddress!.advanced(by:at),raw.count-at);try Self.require(count>0);at+=count } };try Self.require(Darwin.fsync(fd)==0);Darwin.close(fd)
                } catch { Darwin.close(fd);throw error }
                let parent=Darwin.open(directory.path,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);try Self.require(parent>=0)
                let sync=Darwin.fsync(parent);Darwin.close(parent);try Self.require(sync==0)
                try permit.dataBoundary(identity:original.identity,nonce:original.nonce,checksum:original.checksum);_ = try store.key(create:true,directory:directory)
                try permit.dataBoundary(identity:original.identity,nonce:original.nonce,checksum:original.checksum)
                let state=try Self.decode(original.plain);defer { state.wipe() };try store.write(directory,state:state) { try permit.dataBoundary(identity:original.identity,nonce:original.nonce,checksum:original.checksum) }
                try store.exactBirth(directory,plan:original,marker:marker);try permit.dataBirthKnown(identity:original.identity,nonce:original.nonce,checksum:original.checksum)
                return LocalV2BirthReceipt(original,marker)
            } catch { store.closed=true;permit.dataBirthUnknown();throw error }
        }
    }
}
