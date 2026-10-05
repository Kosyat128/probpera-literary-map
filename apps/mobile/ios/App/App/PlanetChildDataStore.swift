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
        fileprivate let admission: PlanetChildLocalV2DataAdmission?
        // Partition metadata only; owner and constructor remain fileprivate.
        var partitionGeneration: UInt64 { generation }
        var partitionNonce: String { nonce }
        fileprivate init(owner: PlanetChildDataStore, scope: Scope, generation: UInt64, nonce: String, admission: PlanetChildLocalV2DataAdmission?=nil) { self.owner = owner; self.scope = scope; self.generation = generation; self.nonce = nonce;self.admission=admission }
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
    private struct Seal {let scope: Scope,contentBinding: String}
    private final class State {
        var generation: UInt64 = 0, nonce = "", scope: Scope?, admissionBinding: String?,pendingMigration: String?;var seals=[String:Seal]()
        var entries: [String: Stored] = [:]
        var sdkAppearance=false,appearances=[String:AppearanceEntry]()
        var sdkJourney=false,journeys=[String:JourneyEntry]()
        var sdkPassport=false,passports=[String:PassportEntry]()
        var sdkCollections=false,collectionRevisions=[String:UInt64](),tombstones=[String:UInt64](),sdkUnboundBirth: String?,sdkUnboundContent: String?
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
    private static func validateSeals(_ state: State) throws {if state.admissionBinding==nil { try Self.require(state.seals.isEmpty && state.pendingMigration==nil);return };try Self.require((state.pendingMigration==nil || Self.checksum(state.pendingMigration!)) && Self.checksum(state.admissionBinding!) && (!state.seals.isEmpty || state.sdkUnboundBirth != nil || state.sdkPassport && state.entries.isEmpty && state.appearances.isEmpty && state.journeys.isEmpty && state.passports.isEmpty) && state.seals.count<=4);for (id,seal) in state.seals { try Self.require(id==seal.scope.profileId && Self.checksum(seal.contentBinding)) };if let scope=state.scope { try Self.require(state.seals[scope.profileId]?.scope.tuple==scope.tuple) };for id in state.entries.keys { let pair=id.components(separatedBy:"\n");guard pair.count==2,let purpose=Purpose(rawValue:pair[0]) else { throw Failure.unavailable };let scope=try Self.keyScope(purpose,key:pair[1]);try Self.require(state.seals[scope.profileId]?.scope.tuple==scope.tuple) } }
    private static func encode(_ state: State) throws -> Data {try validateSeals(state);
        let writer = Writer(); try writer.number(0x4c504431,bytes:4); try writer.number(state.generation,bytes:8); try writer.text(state.nonce); try writer.byte(state.scope == nil ? 0 : 1)
        if let scope = state.scope { try writer.text(scope.tuple) }; try PlanetChildDataStore.require(state.entries.count <= PlanetChildDataStore.maxSlots); try writer.number(UInt64(state.entries.count),bytes:4)
        for id in state.entries.keys.sorted() { let pieces = id.components(separatedBy:"\n"); try PlanetChildDataStore.require(pieces.count == 2); guard let purpose = Purpose(rawValue:pieces[0]), let slot = state.entries[id] else { throw Failure.unavailable }
            let scope = try PlanetChildDataStore.keyScope(purpose,key:pieces[1]); try PlanetChildDataStore.envelope(purpose,key:pieces[1],scope:scope,bytes:slot.value); try PlanetChildDataStore.require(PlanetChildDataStore.positive(slot.revision) && slot.revision < PlanetChildDataStore.maxSafe)
            try writer.text(purpose.rawValue); try writer.text(pieces[1]); try writer.number(slot.revision,bytes:8); try writer.text(PlanetChildDataStore.digest(slot.value)); try writer.number(UInt64(slot.value.count),bytes:4); try writer.data(slot.value) }
        if let binding=state.admissionBinding { try writer.number(0x4c504133,bytes:4);try writer.text(binding);try writer.byte(state.pendingMigration==nil ? 0:1);if let pending=state.pendingMigration { try writer.text(pending) };try writer.number(UInt64(state.seals.count),bytes:4);for id in state.seals.keys.sorted() { let seal=state.seals[id]!;try writer.text(seal.scope.tuple);try writer.text(seal.contentBinding) } }
        try encodeCollections(state,writer);try encodeAppearance(state,writer);try encodeJourney(state,writer);try encodePassport(state,writer);return writer.result()
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
        };if reader.position<bytes.count { try Self.require(try reader.number(4)==0x4c504133);state.admissionBinding=try reader.text(64);try Self.require(Self.checksum(state.admissionBinding!));let pending=try reader.number(1);try Self.require(pending<=1);if pending==1 { state.pendingMigration=try reader.text(64);try Self.require(Self.checksum(state.pendingMigration!)) };let count=try reader.number(4);try Self.require(count<=4);for _ in 0..<count { let scope=try Scope.decode(reader.text(2048)),content=try reader.text(64);try Self.require(Self.checksum(content) && state.seals[scope.profileId]==nil);state.seals[scope.profileId]=Seal(scope:scope,contentBinding:content) } };if reader.position<bytes.count { try decodeCollections(state,&reader) };if reader.position<bytes.count { try decodeAppearance(state,&reader) };if reader.position<bytes.count { try decodeJourney(state,&reader) };if reader.position<bytes.count { try decodePassport(state,&reader) };try validatePassport(state);try validateSeals(state);try validateCollections(state);try validateAppearance(state);try validateJourney(state); try PlanetChildDataStore.require(reader.position == bytes.count); success = true; return state
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
    private func live(_ lease: Lease, state: State) throws { try Self.require(!closed && active === lease && lease.admission==nil && lease.owner === self && state.generation == lease.generation && state.nonce == lease.nonce && state.scope?.tuple == lease.scope.tuple) }
    func activate(_ scope: Scope) throws -> Lease {
        try locked { directory in try Self.require(!closed); active = nil; let state = try read(directory); defer { state.wipe() }; try Self.require(state.admissionBinding==nil && state.seals.isEmpty && state.generation < Self.maxSafe-1)
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
        if lease.admission != nil { try existingOnly(directory) };let state = try read(directory); defer { state.wipe() }; if state.scope != nil && state.generation == lease.generation && state.nonce == lease.nonce {
            try Self.require(state.generation < Self.maxSafe-1); state.generation += 1; state.nonce = try Self.nonce(); state.scope = nil; try write(directory,state:state) {} } } } }

    /** Caller is the opaque Vault producer holding the actual canonical lock.
     * These methods acquire only DataStore. check() never joins main or opens
     * another Vault transaction; all byte and readback fences keep this order. */
    private static func knownProfiles(_ state: State,_ profiles: [String:String]) throws {
        if let id=state.sdkUnboundBirth { try require(state.sdkCollections && state.seals.isEmpty && profiles.count==1 && profiles[id]==state.sdkUnboundContent);return }
        try require(state.admissionBinding != nil && Set(state.seals.keys)==Set(profiles.keys))
        for (id,seal) in state.seals { try require(profiles[id]==seal.contentBinding && id==seal.scope.profileId) }
    }
    private static func targetSeal(_ state: State,id: String,creating: Bool,previous: [String:String]) throws {
        if creating { try require(state.sdkUnboundBirth==nil && previous[id]==nil && state.seals[id]==nil && state.seals.count<4) }
        else { if state.sdkUnboundBirth==id { try require(previous[id]==state.sdkUnboundContent && previous.count==1 && state.seals.isEmpty);return };guard let seal=state.seals[id] else { throw Failure.unavailable };try require(previous[id]==seal.contentBinding) }
    }
    private static func retainedEntries(_ state: State) -> [String:Stored] {
        var result=[String:Stored]();for (id,stored) in state.entries { result[id]=Stored(revision:stored.revision,value:Data(Array(stored.value))) };return result
    }
    private func admittedState(_ admission: PlanetChildLocalV2DataAdmission,_ state: State) throws {
        try admission.check();try Self.require(try state.admissionBinding==admission.binding());try Self.knownProfiles(state,admission.futureProfiles());try Self.validateAppearance(state)
        if let scope=try admission.migrationScope() { guard let seal=state.seals[scope.profileId] else { throw Failure.unavailable };try Self.require(try seal.contentBinding==admission.contentBinding() && seal.scope.tuple==scope.tuple) }
        else { try Self.require(state.scope==nil) }
        if let pending=state.pendingMigration { try Self.require(try pending==admission.migrationIdentity()) }
    }
    private func admittedLive(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,_ state: State) throws { try admittedState(admission,state);try Self.require(state.pendingMigration==nil && !closed && active === lease && lease.owner === self && lease.admission === admission && state.scope != nil && state.generation==lease.generation && state.nonce==lease.nonce && state.scope?.tuple==lease.scope.tuple) }
    func admit(_ admission: PlanetChildLocalV2DataAdmission) throws -> Lease { try locked { directory in
        try admission.check();try existingOnly(directory);let birth=try knownBirth(directory);try admission.knownBirth(birth)
        try Self.require(!closed && active==nil);let state=try read(directory);defer { state.wipe() };try Self.require(state.scope==nil && state.pendingMigration==nil)
        let current=try admission.scope()
        if state.admissionBinding==nil {
            try Self.require(try state.seals.isEmpty && state.generation==0 && state.entries.isEmpty && admission.initialProfileId()==birth.profileId && current.profileId==birth.profileId && admission.contentBinding()==birth.profileContentBinding)
            try Self.require(state.nonce==birth.nonce);try birth.emptyState(Self.encode(state));state.admissionBinding=try admission.binding();state.seals[current.profileId]=Seal(scope:current,contentBinding:try admission.contentBinding())
        } else {
            try Self.require(try state.admissionBinding==admission.binding());try Self.knownProfiles(state,admission.futureProfiles());try Self.validateAppearance(state);try Self.targetSeal(state,id:current.profileId,creating:false,previous:admission.futureProfiles())
            if state.sdkUnboundBirth==current.profileId { try Self.require(try birth.profileId==current.profileId && birth.profileContentBinding==admission.contentBinding() && state.sdkUnboundContent==birth.profileContentBinding);state.seals[current.profileId]=Seal(scope:current,contentBinding:try admission.contentBinding());state.sdkUnboundBirth=nil;state.sdkUnboundContent=nil }
        }
        try admittedState(admission,state)
        for (id,stored) in state.entries { let pair=id.components(separatedBy:"\n");guard pair.count==2,let purpose=Purpose(rawValue:pair[0]) else { throw Failure.unavailable };if try Self.keyScope(purpose,key:pair[1]).profileId==current.profileId { try admission.validate(purpose,pair[1],stored.value) } }
        try Self.require(state.generation<Self.maxSafe-1);state.generation+=1;state.nonce=try Self.nonce();state.scope=current;try write(directory,state:state,check:admission.check);try admittedState(admission,state);let lease=Lease(owner:self,scope:current,generation:state.generation,nonce:state.nonce,admission:admission);active=lease;return lease
    } }
    func admittedOperation(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease) throws -> Cancellation { try locked { directory in try admission.check();try existingOnly(directory);let state=try read(directory);defer { state.wipe() };try admittedLive(admission,lease,state);let now=try Self.now(),deadline=try admission.deadlineMs();try Self.require(now<deadline && deadline-now<=60000);return Cancellation(owner:self,lease:lease,deadline:deadline) } }
    func admittedQuery(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,_ original: Result,_ purpose: Purpose,_ key: String) throws -> Slot { try locked { directory in try admission.check();try existingOnly(directory);let state=try read(directory);defer { state.wipe() };try admittedLive(admission,lease,state);try Self.require(try Self.keyScope(purpose,key:key).tuple==lease.scope.tuple);guard let captured=original.get(purpose,key:key) else { throw Failure.unavailable };let saved=state.entries[purpose.rawValue+"\n"+key];try Self.require(captured.revision==(saved?.revision ?? state.tombstones[purpose.rawValue+"\n"+key] ?? 0) && captured.checksum==saved.map { Self.digest($0.value) });if let saved { try admission.validate(purpose,key,saved.value) };let copied=Slot(revision:saved?.revision ?? state.tombstones[purpose.rawValue+"\n"+key] ?? 0,value:saved?.value);do { try admission.check();return copied } catch { copied.dispose();throw error } } }
    private func admittedCheck(_ admission: PlanetChildLocalV2DataAdmission,_ cancellation: Cancellation,_ lease: Lease,_ state: State) throws { try admittedLive(admission,lease,state);try Self.require(try cancellation.owner === self && cancellation.lease === lease && cancellation.used && !cancellation.cancelled && !Thread.current.isCancelled && Self.now()<cancellation.deadline && cancellation.deadline==admission.deadlineMs()) }
    func admittedTransact(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,reads: [ReadKey],writes: [Mutation],cancellation: Cancellation) throws -> Result { try Self.require(reads.count<=Self.maxBatch && writes.count<=Self.maxBatch);var values=[Data]();defer { while !values.isEmpty { var value=values.removeLast();value.resetBytes(in:0..<value.count) } };var size=0;for write in writes { let value=try write.copy(remainingBytes:Self.maxSnapshotBytes-size);values.append(value);size+=value.count }
        return try locked { directory in try admission.check();try existingOnly(directory);let state=try read(directory);defer { state.wipe() };try Self.require(!cancellation.used);cancellation.used=true;try admittedCheck(admission,cancellation,lease,state);var readIds=Set<String>(),writeIds=Set<String>(),result=[String:Slot](),handed=false;defer { if !handed { for slot in result.values { slot.dispose() } } }
            for read in reads { let id=read.purpose.rawValue+"\n"+read.key;try Self.require(try Self.keyScope(read.purpose,key:read.key).tuple==lease.scope.tuple && readIds.insert(id).inserted);if let saved=state.entries[id] { try admission.validate(read.purpose,read.key,saved.value) } }
            for (i,write) in writes.enumerated() { let id=write.purpose.rawValue+"\n"+write.key;try Self.require(try Self.keyScope(write.purpose,key:write.key).tuple==lease.scope.tuple && writeIds.insert(id).inserted && (state.entries[id]?.revision ?? state.tombstones[id] ?? 0)==write.expectedRevision);try Self.envelope(write.purpose,key:write.key,scope:lease.scope,bytes:values[i]);try admission.validate(write.purpose,write.key,values[i]) }
            for read in reads { let id=read.purpose.rawValue+"\n"+read.key;result[id]=Slot(revision:state.entries[id]?.revision ?? state.tombstones[id] ?? 0,value:state.entries[id]?.value) }
            for (i,write) in writes.enumerated() { let id=write.purpose.rawValue+"\n"+write.key;if var old=state.entries.removeValue(forKey:id) { old.value.resetBytes(in:0..<old.value.count) };state.tombstones.removeValue(forKey:id);state.entries[id]=Stored(revision:write.expectedRevision+1,value:Data(Array(values[i]))) }
            try admittedCheck(admission,cancellation,lease,state);if !writes.isEmpty { try write(directory,state:state) { try self.admittedCheck(admission,cancellation,lease,state) } };try admittedCheck(admission,cancellation,lease,state)
            let actual=try read(directory);defer { actual.wipe() };try admittedLive(admission,lease,actual);for (i,write) in writes.enumerated() { guard let saved=actual.entries[write.purpose.rawValue+"\n"+write.key] else { throw Failure.unavailable };try Self.require(saved.revision==write.expectedRevision+1 && saved.value==values[i]);try admission.validate(write.purpose,write.key,saved.value) }
            try admittedCheck(admission,cancellation,lease,state);handed=true;return Result(reads:result)
        }
    }
    /** Actual previous namespace has retired; future data is sealed before
     * the canonical CAS. Unknown partial publication cannot match old binding
     * and is never repaired, reopened or adopted into a fresh namespace. */
    func migrate(_ admission: PlanetChildLocalV2DataAdmission) throws { try locked { directory in
        try admission.check();try existingOnly(directory);let birth=try knownBirth(directory);try admission.knownBirth(birth)
        try Self.require(!closed && active==nil);let state=try read(directory);defer { state.wipe() };try Self.require(state.scope==nil && state.pendingMigration==nil)
        let previous=try admission.previousProfiles()
        if state.admissionBinding==nil { try Self.require(try admission.migrationScope()==nil && admission.creatingProfileId()==nil);try Self.knownUnboundOrigin(state,id:birth.profileId,nonce:birth.nonce,content:birth.profileContentBinding,empty:birth.emptyChecksum,profiles:previous);try birth.emptyState(Self.encode(state));state.sdkCollections=true;state.sdkUnboundBirth=birth.profileId;state.sdkUnboundContent=birth.profileContentBinding;state.admissionBinding=try admission.previousBinding() }
        try Self.require(try state.admissionBinding != nil && state.admissionBinding==admission.previousBinding());try Self.knownProfiles(state,previous)
        let future=try admission.migrationScope(),created=try admission.creatingProfileId()
        if let future { try Self.targetSeal(state,id:future.profileId,creating:created != nil,previous:previous);if let created { try Self.require(created==future.profileId) } }
        else { try Self.require(created==nil) }
        var next=[String:Stored](),adopted=false;defer { if !adopted { for id in Array(next.keys) { if var stored=next.removeValue(forKey:id) { stored.value.resetBytes(in:0..<stored.value.count) } } } }
        if let future {
            for (id,stored) in state.entries {
                try admission.check();let pair=id.components(separatedBy:"\n");guard pair.count==2,let purpose=Purpose(rawValue:pair[0]) else { throw Failure.unavailable }
                let oldScope=try Self.keyScope(purpose,key:pair[1]);guard let oldSeal=state.seals[oldScope.profileId] else { throw Failure.unavailable };try Self.require(oldScope.tuple==oldSeal.scope.tuple)
                guard let value=try admission.partition(purpose,pair[1],stored.value) else { continue };defer { value.close() }
                try Self.envelope(purpose,key:value.key,scope:value.changed ? future:oldScope,bytes:value.bytes);if value.changed { try admission.validate(purpose,value.key,value.bytes) }
                let compound=purpose.rawValue+"\n"+value.key;try Self.require((!value.changed || stored.revision<Self.maxSafe-1) && next[compound]==nil);next[compound]=Stored(revision:stored.revision+(value.changed ? 1:0),value:Data(Array(value.bytes)))
            }
            state.seals[future.profileId]=Seal(scope:future,contentBinding:try admission.contentBinding());state.sdkUnboundBirth=nil;state.sdkUnboundContent=nil
        } else { next=Self.retainedEntries(state) }
        if let removal=try admission.childRemoval() { try Self.removeChildData(state,&next,removal) }
        try Self.require(state.generation<Self.maxSafe-1);state.generation+=1;state.nonce=try Self.nonce();state.admissionBinding=try admission.binding();state.pendingMigration=try admission.migrationIdentity()
        try Self.migrateTombstones(state,future);try Self.migrateAppearance(state,admission.futureProfiles());try Self.migrateJourney(state,admission.futureProfiles());try Self.migratePassport(state,admission.futureProfiles());state.wipe();state.entries=next;adopted=true;var prepared=try Self.encode(state);defer { prepared.resetBytes(in:0..<prepared.count) };try admission.markDataWrite();try stageMigrationMarker(directory,admission);try write(directory,state:state,check:admission.check);try redactKnownBirth(directory,admission);try admission.commitCanonical();try admittedState(admission,state)
    } }
    func migrationReadback(_ admission: PlanetChildLocalV2DataAdmission) throws { try locked { directory in
        try admission.check();try existingOnly(directory,migration:admission);let birth=try knownBirth(directory);try admission.knownBirth(birth)
        let state=try read(directory);defer { state.wipe() };try Self.require(try !closed && active==nil && state.scope==nil && state.pendingMigration==admission.migrationIdentity());try admittedState(admission,state)
        if let future=try admission.migrationScope() { for (id,stored) in state.entries { let pair=id.components(separatedBy:"\n");guard pair.count==2,let purpose=Purpose(rawValue:pair[0]) else { throw Failure.unavailable };if try Self.keyScope(purpose,key:pair[1]).profileId==future.profileId { try admission.validate(purpose,pair[1],stored.value) } } }
        try admission.acknowledgeCanonical() // Durable pending remains until the original native retirement joins.
    } }

    /** The external deny marker stays through final ciphertext/readback and
     * actual original retirement. Unknown migration cannot be adopted. */
    func migrationComplete(_ admission: PlanetChildLocalV2DataAdmission) throws { try locked { directory in
        try admission.check();try existingOnly(directory,migration:admission);let birth=try knownBirth(directory);try admission.knownBirth(birth)
        let state=try read(directory);defer { state.wipe() };try Self.require(try !closed && active==nil && state.scope==nil && state.pendingMigration==admission.migrationIdentity());try admittedState(admission,state)
        try admission.requireMigrationRetirement();try admission.acknowledgeCanonical()
        if let future=try admission.migrationScope() { for (id,stored) in state.entries { let pair=id.components(separatedBy:"\n");guard pair.count==2,let purpose=Purpose(rawValue:pair[0]) else { throw Failure.unavailable };if try Self.keyScope(purpose,key:pair[1]).profileId==future.profileId { try admission.validate(purpose,pair[1],stored.value) } } }
        let marker=try migrationMarker(directory);var bytes=try migrationMarkerBytes(admission);defer { bytes.resetBytes(in:0..<bytes.count) };var clearing=false
        do {
            state.pendingMigration=nil;try write(directory,state:state,check:admission.check);try admittedState(admission,state);try exactMigrationMarker(directory,admission)
            try admission.acknowledgeCanonical();try admission.prepareMigrationRelease();closed=true
            // Native observers/UI/worker/recipient and original retirement have
            // completed. Removal is the last fallible publication operation.
            clearing=true;try Self.require(Darwin.unlink(marker.path)==0);try syncDirectory(directory)
        } catch {
            if clearing && !FileManager.default.fileExists(atPath:marker.path) { try? exclusiveReceiptFile(marker,bytes) {};try? syncDirectory(directory) }
            closed=true;admission.migrationUnknown();throw error
        }
    } }
    private func migrationMarker(_ directory: URL) throws -> URL {
        let file=directory.appendingPathComponent("local-v2-migration.pending");try Self.require(file.resolvingSymlinksInPath().standardizedFileURL==file.standardizedFileURL);return file
    }
    private func migrationMarkerBytes(_ admission: PlanetChildLocalV2DataAdmission) throws -> Data { Data(("LP-LOCAL-V2-DATA-MIGRATION\n"+identity+"\n"+(try admission.migrationIdentity())+"\n").utf8) }
    private func exactMigrationMarker(_ directory: URL,_ admission: PlanetChildLocalV2DataAdmission) throws {
        var actual=try boundedFile(migrationMarker(directory),4096),expected=try migrationMarkerBytes(admission);defer { actual.resetBytes(in:0..<actual.count);expected.resetBytes(in:0..<expected.count) };try Self.require(actual==expected)
    }
    private func stageMigrationMarker(_ directory: URL,_ admission: PlanetChildLocalV2DataAdmission) throws {
        var bytes=try migrationMarkerBytes(admission);defer { bytes.resetBytes(in:0..<bytes.count) };try exclusiveReceiptFile(migrationMarker(directory),bytes,admission.check);try syncDirectory(directory);try exactMigrationMarker(directory,admission)
    }

    /** LOCAL-only reopen validates the durable native terminal before any
     * new admission. It never calls initialize or provisions a missing key. */
    static func localV2ExistingOnly() throws -> PlanetChildDataStore {
        let store=try PlanetChildDataStore(runId:nil,deferredBirth:true);try store.locked { directory in try store.existingOnly(directory);_ = try store.knownBirth(directory) };return store
    }
    static func fixtureLocalV2KnownExistingOnly(runId: String) throws -> PlanetChildDataStore {
        #if DEBUG
        let store=try PlanetChildDataStore(runId:runId,deferredBirth:true);try store.locked { directory in try store.existingOnly(directory);_ = try store.knownBirth(directory) };return store
        #else
        throw Failure.unavailable
        #endif
    }
    private func knownBirthFile(_ directory: URL,staged: Bool=false) throws -> URL {
        let file=directory.appendingPathComponent("local-v2-birth.receipt"+(staged ? ".new":""));try Self.require(file.resolvingSymlinksInPath().standardizedFileURL==file.standardizedFileURL);return file
    }
    private func boundedFile(_ file: URL,_ limit: Int) throws -> Data {
        let fd=Darwin.open(file.path,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);try Self.require(fd>=0);defer { Darwin.close(fd) };var opened=stat(),named=stat()
        try Self.require(fstat(fd,&opened)==0 && lstat(file.path,&named)==0 && opened.st_mode & mode_t(S_IFMT)==mode_t(S_IFREG) && opened.st_ino==named.st_ino && opened.st_dev==named.st_dev && opened.st_size>0 && opened.st_size<=off_t(limit))
        var bytes=Data(count:Int(opened.st_size)),handed=false;defer { if !handed { bytes.resetBytes(in:0..<bytes.count) } }
        try bytes.withUnsafeMutableBytes { raw in var at=0;while at<raw.count { let count=Darwin.read(fd,raw.baseAddress!.advanced(by:at),raw.count-at);try Self.require(count>0);at+=count } };var extra: UInt8=0;try Self.require(Darwin.read(fd,&extra,1)==0);handed=true;return bytes
    }
    private func knownBirth(_ directory: URL,staged: Bool=false,allowPending: Bool=false) throws -> PlanetChildLocalV2KnownBirth {
        if !staged && !allowPending { try Self.require(!FileManager.default.fileExists(atPath:try knownBirthFile(directory,staged:true).path)) }
        var encrypted=try boundedFile(knownBirthFile(directory,staged:staged),262144),claim=try boundedFile(birthMarker(directory),4096);defer { encrypted.resetBytes(in:0..<encrypted.count);claim.resetBytes(in:0..<claim.count) }
        try Self.require(encrypted.first==1);var plain=try AES.GCM.open(AES.GCM.SealedBox(combined:Data(encrypted.dropFirst())),using:key(create:false,directory:directory),authenticating:Data((identity+"\nLP-LOCAL-V2-KNOWN-BIRTH-v1").utf8));defer { plain.resetBytes(in:0..<plain.count) }
        return try PlanetChildLocalV2KnownBirth.verify(plain,identity:identity,claim:claim)
    }
    private func stageBirth(_ original: LocalV2BirthPlan,_ marker: Data,_ permit: LocalV2ProfileDataBirthPermit) throws {
        try locked { directory in
            try exactBirth(directory,plan:original,marker:marker);var plain=try permit.knownBirthReceipt(identity:original.identity,nonce:original.nonce,checksum:original.checksum);defer { plain.resetBytes(in:0..<plain.count) }
            _ = try PlanetChildLocalV2KnownBirth.verify(plain,identity:identity,claim:marker)
            let file=try knownBirthFile(directory,staged:true);try Self.require(!FileManager.default.fileExists(atPath:file.path) && !FileManager.default.fileExists(atPath:try knownBirthFile(directory).path))
            let box=try AES.GCM.seal(plain,using:key(create:false,directory:directory),authenticating:Data((identity+"\nLP-LOCAL-V2-KNOWN-BIRTH-v1").utf8));guard let combined=box.combined else { throw Failure.unavailable }
            var encrypted=Data([1]);encrypted.append(combined);defer { encrypted.resetBytes(in:0..<encrypted.count) }
            let fd=Darwin.open(file.path,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,mode_t(S_IRUSR|S_IWUSR));try Self.require(fd>=0)
            do { try FileManager.default.setAttributes([.protectionKey:FileProtectionType.complete],ofItemAtPath:file.path)
                try encrypted.withUnsafeBytes { raw in var at=0;while at<raw.count { try permit.knownBirthBoundary(identity:original.identity,nonce:original.nonce,checksum:original.checksum);let count=Darwin.write(fd,raw.baseAddress!.advanced(by:at),raw.count-at);try Self.require(count>0);at+=count } };try Self.require(Darwin.fsync(fd)==0);Darwin.close(fd)
            } catch { Darwin.close(fd);permit.dataBirthUnknown();closed=true;throw error }
            let parent=Darwin.open(directory.path,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);try Self.require(parent>=0);let sync=Darwin.fsync(parent);Darwin.close(parent);try Self.require(sync==0)
            try permit.knownBirthBoundary(identity:original.identity,nonce:original.nonce,checksum:original.checksum);let known=try knownBirth(directory,staged:true);try Self.require(try known.profileId==permit.knownBirthProfileId());try exactBirth(directory,plan:original,marker:marker)
        }
    }
    private func exclusiveReceiptFile(_ file: URL,_ bytes: Data,_ check: () throws -> Void) throws {
        let fd=Darwin.open(file.path,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,mode_t(S_IRUSR|S_IWUSR));try Self.require(fd>=0)
        do { try FileManager.default.setAttributes([.protectionKey:FileProtectionType.complete],ofItemAtPath:file.path)
            try bytes.withUnsafeBytes { raw in var at=0;while at<raw.count { try check();let count=Darwin.write(fd,raw.baseAddress!.advanced(by:at),raw.count-at);try Self.require(count>0);at+=count } };try Self.require(Darwin.fsync(fd)==0);Darwin.close(fd)
        } catch { Darwin.close(fd);throw error }
    }
    private func syncDirectory(_ directory: URL) throws { let parent=Darwin.open(directory.path,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);try Self.require(parent>=0);let result=Darwin.fsync(parent);Darwin.close(parent);try Self.require(result==0) }
    private func completeBirth(_ original: LocalV2BirthPlan,_ marker: Data,_ permit: LocalV2ProfileDataBirthPermit) throws {
        try locked { directory in
            try permit.knownBirthPublishBoundary(identity:original.identity,nonce:original.nonce,checksum:original.checksum);try exactBirth(directory,plan:original,marker:marker)
            let staged=try knownBirthFile(directory,staged:true),final=try knownBirthFile(directory);try Self.require(!FileManager.default.fileExists(atPath:final.path))
            var pending=try boundedFile(staged,262144);defer { pending.resetBytes(in:0..<pending.count) };var clearing=false
            do {
                let known=try knownBirth(directory,staged:true);try Self.require(try known.profileId==permit.knownBirthProfileId())
                // The pending marker remains durable until final ciphertext,
                // original canonical record and native terminal ACK are known.
                try exclusiveReceiptFile(final,pending) { try permit.knownBirthPublishBoundary(identity:original.identity,nonce:original.nonce,checksum:original.checksum) };try syncDirectory(directory)
                _ = try knownBirth(directory,allowPending:true);try exactBirth(directory,plan:original,marker:marker);try permit.acknowledgeKnownBirth(identity:original.identity,nonce:original.nonce,checksum:original.checksum)
                try permit.prepareKnownBirthRelease(identity:original.identity,nonce:original.nonce,checksum:original.checksum);clearing=true;try Self.require(Darwin.unlink(staged.path)==0);try syncDirectory(directory)
            } catch {
                // Restoring this original pending marker only preserves deny.
                // It never repairs/adopts a receipt or creates another key.
                if clearing && !FileManager.default.fileExists(atPath:staged.path) { try? exclusiveReceiptFile(staged,pending) {};try? syncDirectory(directory) }
                closed=true;permit.dataBirthUnknown();throw error
            }
        }
    }
    #if DEBUG
    /** Codec-only fixtures cannot mint opaque admission or provision AES. */
    static func fixtureAdmittedSealCodec() throws -> Bool { let hash=String(repeating:"a",count:64),scope=try Scope(profileId:"reader",profileRevision:2,exactAge:9,locale:"en",policyVersion:"first-install-fixture-v2",policyChecksum:hash,packageId:"isolated-package",packageVersion:1,packageChecksum:hash),state=State();defer { state.wipe() };state.nonce=String(repeating:"b",count:32);state.admissionBinding=hash;state.pendingMigration=String(repeating:"c",count:64);state.seals[scope.profileId]=Seal(scope:scope,contentBinding:hash);var bytes=try encode(state);defer { bytes.resetBytes(in:0..<bytes.count) };let actual=try decode(bytes);defer { actual.wipe() };var copy=try encode(actual);defer { copy.resetBytes(in:0..<copy.count) };try require(bytes==copy && actual.seals.count==1 && actual.pendingMigration==String(repeating:"c",count:64))
        for missing in [1,32,64,100] { var truncated=Data(bytes.dropLast(missing));defer { truncated.resetBytes(in:0..<truncated.count) };var denied=false;do { let bad=try decode(truncated);bad.wipe() } catch { denied=true };try require(denied) };var extra=bytes;extra.append(0);var denied=false;do { let bad=try decode(extra);bad.wipe() } catch { denied=true };extra.resetBytes(in:0..<extra.count);try require(denied)
        state.scope=try Scope(profileId:"sibling",profileRevision:2,exactAge:9,locale:"en",policyVersion:"first-install-fixture-v2",policyChecksum:hash,packageId:"isolated-package",packageVersion:1,packageChecksum:hash);denied=false;do { var bad=try encode(state);bad.resetBytes(in:0..<bad.count) } catch { denied=true };try require(denied);return true
    }
    #endif

    #if DEBUG
    static func fixtureProfileEntrySeals(_ scenario: String) throws -> Bool {
        let hash=String(repeating:"a",count:64),other=String(repeating:"b",count:64)
        let a=try Scope(profileId:"reader",profileRevision:2,exactAge:9,locale:"en",policyVersion:"first-profile-fixture-v2",policyChecksum:hash,packageId:"isolated-package",packageVersion:1,packageChecksum:hash)
        let state=State();defer { state.wipe() };state.nonce=String(repeating:"c",count:32);state.admissionBinding=hash;state.seals[a.profileId]=Seal(scope:a,contentBinding:hash)
        let key=Purpose.history.rawValue+"\n"+a.key(.history),scope: [String:Any]=["schemaVersion":1,"namespace":"child","profileId":a.profileId,"profileRevision":a.profileRevision,"exactAge":a.exactAge,"locale":a.locale,"policyVersion":a.policyVersion,"policyChecksum":a.policyChecksum,"packageId":a.packageId,"packageVersion":a.packageVersion,"packageChecksum":a.packageChecksum]
        let original=try JSONSerialization.data(withJSONObject:["schemaVersion":1,"scope":scope,"references":[]] as [String:Any],options:.sortedKeys);state.entries[key]=Stored(revision:7,value:original)
        func refused(_ work: () throws -> Void) -> Bool { do { try work();return false } catch { return true } }
        switch scenario {
        case "retained":try knownProfiles(state,["reader":hash]);let retained=retainedEntries(state);try require(retained.count==1 && retained[key]?.revision==7 && retained[key]?.value==original && state.seals["reader"]?.scope.tuple==a.tuple);return true
        case "orphan":try require(refused { try knownProfiles(state,["other":hash]) } && refused { try knownProfiles(state,["reader":other]) } && refused { try knownProfiles(state,["reader":hash,"unknown":other]) });return true
        case "nonreuse":try targetSeal(state,id:"reader",creating:false,previous:["reader":hash]);try require(refused { try targetSeal(state,id:"reader",creating:true,previous:["reader":hash]) } && refused { try targetSeal(state,id:"missing",creating:false,previous:["reader":hash]) });try targetSeal(state,id:"fresh",creating:true,previous:["reader":hash]);return true
        case "pending":state.pendingMigration=other;var bytes=try encode(state);defer { bytes.resetBytes(in:0..<bytes.count) };let decoded=try decode(bytes);defer { decoded.wipe() };try require(decoded.pendingMigration==other && decoded.entries[key]?.revision==7 && decoded.entries[key]?.value==original && decoded.seals["reader"]?.contentBinding==hash);return true
        default:throw Failure.unavailable
        }
    }
    #endif
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
        func stage(_ permit: LocalV2ProfileDataBirthPermit) throws { try original.store.stageBirth(original,marker,permit) }
        func complete(_ permit: LocalV2ProfileDataBirthPermit) throws { try original.store.completeBirth(original,marker,permit) }
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
    private func existingOnly(_ directory: URL,migration: PlanetChildLocalV2DataAdmission?=nil) throws {
        try Self.require(!FileManager.default.fileExists(atPath:try collectionMarker(directory).path) && !FileManager.default.fileExists(atPath:try appearanceMarker(directory).path) && !FileManager.default.fileExists(atPath:try journeyMarker(directory).path) && !FileManager.default.fileExists(atPath:try passportMarker(directory).path) && !FileManager.default.fileExists(atPath:try originRedactionFile(directory).path))
        let pending=try migrationMarker(directory)
        if FileManager.default.fileExists(atPath:pending.path) { guard let migration else { throw Failure.unavailable };try exactMigrationMarker(directory,migration) } else { try Self.require(migration==nil) }
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


/** Closed LOCAL SDK collection extension. It appends LPC2 only after a real
 * admitted collection CAS; older LPD1/LPA3 snapshots are never upgraded on read. */
extension PlanetChildDataStore {
    final class LocalV2Collection {
        let revision: UInt64
        private let lock=NSLock();private var closed=false
        fileprivate var values: [String:Data]
        fileprivate init(_ revision: UInt64,_ values: [String:Data]) { self.revision=revision;self.values=values }
        func ownedValues() throws -> [String:Data] { lock.lock();defer { lock.unlock() };try PlanetChildDataStore.require(!closed);return values.mapValues { Data(Array($0)) } }
        var closedForSDK: Bool { lock.lock();defer { lock.unlock() };return closed }
        func close() { lock.lock();defer { lock.unlock() };closed=true;for key in Array(values.keys) { if var value=values.removeValue(forKey:key) { value.resetBytes(in:0..<value.count) } } }
        deinit { close() }
    }
    fileprivate static func collectionId(_ scope: Scope,_ purpose: Purpose) -> String { scope.profileId+"\n"+purpose.rawValue }
    fileprivate static func collectionMember(_ purpose: Purpose,_ key: String,_ scope: Scope) throws -> Bool {
        let saved=try keyScope(purpose,key:key);guard saved.tuple==scope.tuple else { return false }
        if purpose == .history { return key==scope.key(.history) }
        guard purpose == .cache || purpose == .offline else { throw Failure.unavailable }
        return key.hasPrefix(scope.key(purpose)+"/item/"+(purpose == .cache ? "favorite/":"offline-package/"))
    }
    private static func validateCollections(_ state: State) throws {
        try require(state.collectionRevisions.count<=12 && state.tombstones.count<=maxSlots && (!state.sdkCollections || state.admissionBinding != nil));if let id=state.sdkUnboundBirth { try require(state.sdkCollections && state.seals.isEmpty && identifier(id) && state.sdkUnboundContent.map(checksum)==true && state.scope==nil && state.entries.isEmpty && state.collectionRevisions.isEmpty && state.tombstones.isEmpty) } else { try require(state.sdkUnboundContent==nil) }
        if !state.sdkCollections { try require(state.collectionRevisions.isEmpty && state.tombstones.isEmpty);return }
        for (id,revision) in state.collectionRevisions { let pair=id.components(separatedBy:"\n");try require(pair.count==2 && state.seals[pair[0]] != nil && [.history,.cache,.offline].contains(Purpose(rawValue:pair[1]) ?? .search) && positive(revision) && revision<maxSafe) }
        for (id,revision) in state.tombstones { let pair=id.components(separatedBy:"\n");guard pair.count==2,let purpose=Purpose(rawValue:pair[0]),purpose == .cache || purpose == .offline else { throw Failure.unavailable };let scope=try keyScope(purpose,key:pair[1]);try require(state.entries[id]==nil && state.seals[scope.profileId]?.scope.tuple==scope.tuple && positive(revision) && revision<maxSafe && collectionMember(purpose,pair[1],scope)) }
    }
    private static func encodeCollections(_ state: State,_ writer: Writer) throws {
        try validateCollections(state);guard state.sdkCollections else { return }
        try writer.number(0x4c504332,bytes:4);try writer.byte(state.sdkUnboundBirth==nil ? 0:1);if let id=state.sdkUnboundBirth { try writer.text(id);try writer.text(state.sdkUnboundContent!) };try writer.number(UInt64(state.collectionRevisions.count),bytes:4)
        for id in state.collectionRevisions.keys.sorted() { try writer.text(id);try writer.number(state.collectionRevisions[id]!,bytes:8) }
        try writer.number(UInt64(state.tombstones.count),bytes:4);for id in state.tombstones.keys.sorted() { try writer.text(id);try writer.number(state.tombstones[id]!,bytes:8) }
    }
    private static func decodeCollections(_ state: State,_ reader: inout Reader) throws {
        try require(try reader.number(4)==0x4c504332 && state.admissionBinding != nil);state.sdkCollections=true;let flag=try reader.number(1);try require(flag<=1);if flag==1 { state.sdkUnboundBirth=try reader.text(96);state.sdkUnboundContent=try reader.text(64) }
        let counters=try reader.number(4);try require(counters<=12);for _ in 0..<counters { let id=try reader.text(128),revision=try reader.number(8);try require(state.collectionRevisions[id]==nil);state.collectionRevisions[id]=revision }
        let tombs=try reader.number(4);try require(tombs<=UInt64(maxSlots));for _ in 0..<tombs { let id=try reader.text(4120),revision=try reader.number(8);try require(state.tombstones[id]==nil);state.tombstones[id]=revision };try validateCollections(state)
    }
    private func collectionMarker(_ directory: URL) throws -> URL { let file=directory.appendingPathComponent("local-v2-collection.pending");try Self.require(file.resolvingSymlinksInPath().standardizedFileURL==file.standardizedFileURL);return file }
    /** Native admission owns every byte in replacement. No public scope, raw
     * JSON delete, rebirth or caller success flag can reach this primitive. */
    func admittedCollection(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,_ purpose: Purpose,
        expectedRevision: UInt64?,replacement: [String:Data]?,commandId: String) throws -> LocalV2Collection {
        try Self.require([.history,.cache,.offline].contains(purpose) && (replacement==nil)==(expectedRevision==nil) && commandId.range(of:"\\A[a-f0-9]{32}\\z",options:.regularExpression) != nil)
        return try locked { directory in
            try admission.check();try existingOnly(directory);let state=try read(directory);defer { state.wipe() };try admittedLive(admission,lease,state)
            let id=Self.collectionId(lease.scope,purpose),revision=state.collectionRevisions[id] ?? 0
            var old=[String:Stored]();for (compound,stored) in state.entries { let pair=compound.components(separatedBy:"\n");guard pair.count==2 else { throw Failure.unavailable };if pair[0]==purpose.rawValue && (try Self.collectionMember(purpose,pair[1],lease.scope)) { try admission.validate(purpose,pair[1],stored.value);old[pair[1]]=stored } }
            try Self.require(old.count<=64)
            guard let replacement,let expectedRevision else { let copied=LocalV2Collection(revision,old.mapValues { Data(Array($0.value)) });do { try admission.check();return copied } catch { copied.close();throw error } }
            try Self.require(revision==expectedRevision && revision<Self.maxSafe-1 && replacement.count<=64)
            for (key,value) in replacement { try Self.require(try Self.collectionMember(purpose,key,lease.scope));try Self.envelope(purpose,key:key,scope:lease.scope,bytes:value);try admission.validate(purpose,key,value) }
            let marker=try collectionMarker(directory),markerBytes=Data(("LP-LOCAL-V2-COLLECTION\n"+identity+"\n"+commandId+"\n"+(try admission.binding())+"\n"+id+"\n"+String(revision+1)+"\n").utf8)
            // Exclusive pending survives any uncertain write/readback/recipient.
            var markerAttempted=false
            do {
                markerAttempted=true;try exclusiveReceiptFile(marker,markerBytes,admission.check);try syncDirectory(directory)
                state.sdkCollections=true;state.collectionRevisions[id]=revision+1
                for key in Set(old.keys).union(replacement.keys) {
                    let compound=purpose.rawValue+"\n"+key,prior=state.entries[compound]?.revision ?? state.tombstones[compound] ?? 0
                    let nextRevision=try Self.collectionNext(prior)
                    if var removed=state.entries.removeValue(forKey:compound) { removed.value.resetBytes(in:0..<removed.value.count) }
                    if let value=replacement[key] { state.tombstones.removeValue(forKey:compound);state.entries[compound]=Stored(revision:nextRevision,value:Data(Array(value))) }
                    else { try Self.require(purpose != .history);state.tombstones[compound]=nextRevision }
                }
                try Self.validateCollections(state);try write(directory,state:state,check:admission.check)
                let actual=try read(directory);defer { actual.wipe() };try admittedLive(admission,lease,actual);try Self.require(actual.collectionRevisions[id]==revision+1)
                for key in Set(old.keys).union(replacement.keys) { let compound=purpose.rawValue+"\n"+key;if let value=replacement[key] { try Self.require(actual.entries[compound]?.value==value && actual.tombstones[compound]==nil);try admission.validate(purpose,key,value) } else { try Self.require(actual.entries[compound]==nil && actual.tombstones[compound]==state.tombstones[compound]) } }
                var pending=try boundedFile(marker,4096);defer { pending.resetBytes(in:0..<pending.count) };try Self.require(pending==markerBytes);try admission.collectionCommandKnown(commandId)
                // Only preparation is ready here. The actual original SDK body
                // must return and close its result before the terminal marker clears.
                let result=LocalV2Collection(revision+1,replacement.mapValues { Data(Array($0)) });do { try admission.collectionCommandReady(commandId);return result } catch { result.close();throw error }
            } catch { if markerAttempted { admission.collectionUnknown() };throw error }
        }
    }
    func collectionComplete(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,_ commandId: String) throws {
        try locked { directory in
            try admission.check();let state=try read(directory);defer { state.wipe() };try admittedLive(admission,lease,state);try admission.collectionCommandJoined(commandId)
            let marker=try collectionMarker(directory);var bytes=try boundedFile(marker,4096);defer { bytes.resetBytes(in:0..<bytes.count) };let fields=String(decoding:bytes,as:UTF8.self).components(separatedBy:"\n")
            try Self.require(fields.count==8 && fields[0]=="LP-LOCAL-V2-COLLECTION" && fields[1]==identity && fields[2]==commandId && fields[3]==(try admission.binding()) && fields[4]==lease.scope.profileId && ["history","cache","offline"].contains(fields[5]) && fields[7].isEmpty);guard let revision=UInt64(fields[6]),revision>0,revision<Self.maxSafe,String(revision)==fields[6],state.collectionRevisions[fields[4]+"\n"+fields[5]]==revision else { throw Failure.unavailable }
            var clearing=false;do { try admission.check();clearing=true;try Self.require(Darwin.unlink(marker.path)==0);try syncDirectory(directory) }
            catch { if clearing && !FileManager.default.fileExists(atPath:marker.path) { try? exclusiveReceiptFile(marker,bytes) {};try? syncDirectory(directory) };admission.collectionUnknown();throw error }
        }
    }
    fileprivate static func migrateTombstones(_ state: State,_ future: Scope?) throws {
        guard let future else { return };var next=[String:UInt64]()
        for (compound,revision) in state.tombstones { let pair=compound.components(separatedBy:"\n");guard pair.count==2,let purpose=Purpose(rawValue:pair[0]) else { throw Failure.unavailable };let old=try keyScope(purpose,key:pair[1]);if old.profileId != future.profileId { next[compound]=revision;continue }
            let segments=pair[1].components(separatedBy:"/");try require(segments.count>=4 && revision<maxSafe-1);let key=try future.itemKey(purpose,kind:segments[segments.count-2],id:segments.last!);let id=purpose.rawValue+"\n"+key;try require(next[id]==nil);next[id]=revision+1
        };state.tombstones=next
    }
}

extension PlanetChildDataStore {
    static func localV2ValidateCanonicalBirth(ids: Set<String>,policyVersion: String,policyChecksum: String,maximum: UInt64,delays: [UInt64]) throws {
        let store=try localV2ExistingOnly();try store.locked { directory in let birth=try store.knownBirth(directory);try Self.require(ids.contains(birth.profileId) && birth.policyVersion==policyVersion && birth.policyChecksum==policyChecksum && birth.maximum==maximum && birth.delays==delays) }
    }
}


extension PlanetChildDataStore {
    fileprivate static func collectionNext(_ previous: UInt64) throws -> UInt64 { try require(previous<maxSafe-1);return previous+1 }
}


extension PlanetChildDataStore {
    private static func knownUnboundOrigin(_ state: State,id: String,nonce: String,content: String,empty: String,profiles: [String:String]) throws {
        try require(state.admissionBinding==nil && state.scope==nil && state.pendingMigration==nil && profiles.count==1 && profiles[id]==content && state.generation==0 && state.nonce==nonce && state.entries.isEmpty && state.seals.isEmpty && !state.sdkCollections && state.tombstones.isEmpty && state.collectionRevisions.isEmpty && digest(encode(state))==empty)
    }
    #if DEBUG
    static func fixtureSDKUnboundOrigin(_ scenario: String) throws -> Bool {
        let state=State();state.nonce=String(repeating:"c",count:32);defer { state.wipe() };let id="child-"+state.nonce,content=String(repeating:"a",count:64);var bytes=try encode(state);defer { bytes.resetBytes(in:0..<bytes.count) };let empty=digest(bytes)
        if scenario=="known-shape" { try knownUnboundOrigin(state,id:id,nonce:state.nonce,content:content,empty:empty,profiles:[id:content]);return try encode(state)==bytes }
        var ids=[id:content],nonce=state.nonce,checksum=empty
        switch scenario { case "foreign-uid":ids=["foreign":content];case "foreign-content":ids[id]=String(repeating:"b",count:64);case "foreign-nonce":nonce=String(repeating:"b",count:32);case "foreign-empty":checksum=String(repeating:"b",count:64);case "extra-profile":ids["sibling"]=content;case "already-bound":state.admissionBinding=content;case "advanced":state.generation=1;default:throw Failure.unavailable }
        do { try knownUnboundOrigin(state,id:id,nonce:nonce,content:content,empty:checksum,profiles:ids);return false } catch { return true }
    }
    static func fixtureSDKCollections(_ scenario: String) throws -> Bool {
        let hash=String(repeating:"a",count:64),other=String(repeating:"b",count:64)
        func scope(_ id: String) throws -> Scope { try Scope(profileId:id,profileRevision:2,exactAge:9,locale:"en",policyVersion:"first-profile-fixture-v2",policyChecksum:hash,packageId:"isolated-package",packageVersion:1,packageChecksum:hash) }
        let a=try scope("reader"),b=try scope("sibling"),state=State();defer { state.wipe() };state.nonce=String(repeating:"c",count:32);state.admissionBinding=hash;state.seals[a.profileId]=Seal(scope:a,contentBinding:hash);state.seals[b.profileId]=Seal(scope:b,contentBinding:other)
        let scopeRow: [String:Any]=["schemaVersion":1,"namespace":"child","profileId":b.profileId,"profileRevision":b.profileRevision,"exactAge":b.exactAge,"locale":b.locale,"policyVersion":b.policyVersion,"policyChecksum":b.policyChecksum,"packageId":b.packageId,"packageVersion":b.packageVersion,"packageChecksum":b.packageChecksum]
        let untouched=try JSONSerialization.data(withJSONObject:["schemaVersion":1,"scope":scopeRow,"references":[]] as [String:Any],options:.sortedKeys),sibling=Purpose.history.rawValue+"\n"+b.key(.history),deleted=Purpose.cache.rawValue+"\n"+(try a.itemKey(.cache,kind:"favorite",id:"one"))
        state.entries[sibling]=Stored(revision:7,value:untouched);var legacy=try encode(state);defer { legacy.resetBytes(in:0..<legacy.count) };let old=try decode(legacy);defer { old.wipe() };try require(!old.sdkCollections && old.collectionRevisions.isEmpty && old.tombstones.isEmpty && encode(old)==legacy)
        state.sdkCollections=true;state.collectionRevisions[collectionId(a,.cache)]=2;state.collectionRevisions[collectionId(b,.history)]=9;state.tombstones[deleted]=2
        var extended=try encode(state);defer { extended.resetBytes(in:0..<extended.count) };try require(extended.prefix(legacy.count)==legacy)
        let copy=try decode(extended);defer { copy.wipe() };try require(copy.entries[sibling]?.revision==7 && copy.entries[sibling]?.value==untouched && copy.seals[b.profileId]?.contentBinding==other && copy.collectionRevisions[collectionId(b,.history)]==9 && copy.tombstones[deleted]==2)
        if scenario=="trailer" { try require(encode(copy)==extended);for count in [1,8,32] { do { let bad=try decode(Data(extended.dropLast(count)));bad.wipe();return false } catch {} };return true }
        if scenario=="tombstone" { let removed=try collectionNext(1),again=try collectionNext(removed);try require(removed==2 && again==3 && copy.entries[deleted]==nil && copy.tombstones[deleted]==removed && (copy.entries[deleted]?.revision ?? copy.tombstones[deleted] ?? 0)==2);do { _=try collectionNext(maxSafe-1);return false } catch {};return true }
        throw Failure.unavailable
    }
    #endif
}


extension PlanetChildDataStore {
    /** No namespace creation for an empty parent registry; read inspection
     * neither mints a lease nor adopts a missing/orphan/partially born store. */
    static func sdkInspectOriginal(_ permit: PlanetChildLocalV2SDKReadPermit) throws {
        try permit.check()
        if try permit.emptyProfiles() && permit.emptyMayBeAbsent() {
            guard let bundle=Bundle.main.bundleIdentifier,bundle=="ru.probpera.literaryplanet" else { throw Failure.unavailable };let parent=try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:false).resolvingSymlinksInPath().standardizedFileURL,name="literary-planet-child-data-v1",directory=parent.appendingPathComponent(name,isDirectory:true);var state=stat();try require(Darwin.lstat(directory.path,&state) != 0 && errno==ENOENT)
            let query: [String:Any]=[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:bundle+"."+name,kSecAttrAccount as String:"child-data-aes-v1",kSecAttrSynchronizable as String:kSecAttrSynchronizableAny,kSecUseAuthenticationUI as String:kSecUseAuthenticationUIFail];try require(SecItemCopyMatching(query as CFDictionary,nil)==errSecItemNotFound);try permit.check();return
        }
        let store=try localV2ExistingOnly();try store.locked { directory in try permit.check();try store.existingOnly(directory);let birth=try store.knownBirth(directory);try permit.retainedBirth(birth);let state=try store.read(directory);defer { state.wipe() };try require(state.scope==nil && state.pendingMigration==nil)
            let profiles=try permit.profiles();if state.admissionBinding==nil { try knownUnboundOrigin(state,id:birth.profileId,nonce:birth.nonce,content:birth.profileContentBinding,empty:birth.emptyChecksum,profiles:profiles) }
            else { try require(try state.admissionBinding==permit.binding());try knownProfiles(state,profiles) };try permit.check()
        }
    }
}

/** Independently versioned LOCAL2 appearance extension. The base and LPC2
 * bytes remain identical when absent; read never upgrades or provisions state. */
extension PlanetChildDataStore {
    private struct AppearanceEntry { let revision: UInt64,selection: PlanetChildAppearance.Selection? }
    final class LocalV2Appearance {
        let profileId: String,revision: UInt64,selection: PlanetChildAppearance.Selection?
        private let lock=NSLock();private var closed=false
        fileprivate init(_ profileId: String,_ revision: UInt64,_ selection: PlanetChildAppearance.Selection?) { self.profileId=profileId;self.revision=revision;self.selection=selection }
        func dto() throws -> [String:Any] { lock.lock();defer { lock.unlock() };try PlanetChildDataStore.require(!closed);return ["profileId":profileId,"revision":revision,"selection":selection?.dto as Any? ?? NSNull()] }
        var closedForSDK: Bool { lock.lock();defer { lock.unlock() };return closed }
        func close() { lock.lock();closed=true;lock.unlock() }
        deinit { close() }
    }
    /** The pending file stays durable through native command return AND the
     * actual channel consumer handoff. Only its private owner can finish it.
     * Process death before native handoff leaves the original deny marker intact. */
    final class LocalV2AppearanceCompletion {
        private let lock=NSLock();private var marker: Data,closed=false,finished=false
        private let store: PlanetChildDataStore
        fileprivate init(_ store: PlanetChildDataStore,_ marker: Data) { self.store=store;self.marker=Data(Array(marker)) }
        func finish() throws {
            lock.lock();defer { lock.unlock() };try PlanetChildDataStore.require(!closed && !finished)
            do { try store.locked { directory in
                try PlanetChildDataStore.require(!store.closed)
                let file=try store.appearanceMarker(directory)
                var actual=try store.boundedFile(file,4096);defer { actual.resetBytes(in:0..<actual.count) }
                try PlanetChildDataStore.require(actual==marker)
                // The native result consumer owns the completed command and all
                // dispatch/canonical fences have returned.
                // No authority check follows this durable completion boundary.
                try PlanetChildDataStore.require(Darwin.unlink(file.path)==0);try store.syncDirectory(directory)
            } } catch {
                // Exact-marker restoration after an I/O failure is conservative;
                // a partial/existing marker is never removed or overwritten.
                do { try store.locked { directory in
                    let file=try store.appearanceMarker(directory)
                    if !FileManager.default.fileExists(atPath:file.path) { try store.exclusiveReceiptFile(file,marker) {};try store.syncDirectory(directory) }
                    store.closed=true
                } } catch { store.closed=true }
                throw error
            }
            finished=true
        }
        func retainUnknown() {
            lock.lock();defer { lock.unlock() };guard !closed else { return }
            do { try store.locked { directory in
                let file=try store.appearanceMarker(directory)
                // Preserve an existing or partial unknown marker exactly.
                if !FileManager.default.fileExists(atPath:file.path) { try store.exclusiveReceiptFile(file,marker) {};try store.syncDirectory(directory) }
                store.closed=true
            } } catch { store.closed=true }
        }
        func close() { lock.lock();defer { lock.unlock() };if !closed { closed=true;marker.resetBytes(in:0..<marker.count) } }
        deinit { close() }
    }
    private static func validateAppearance(_ state: State) throws {
        if !state.sdkAppearance { try require(state.appearances.isEmpty);return }
        try require(state.sdkCollections && state.admissionBinding != nil && state.sdkUnboundBirth==nil && state.appearances.count<=4 && Set(state.appearances.keys).isSubset(of:Set(state.seals.keys)))
        for (profile,entry) in state.appearances { _=try PlanetChildAppearance.identifier(profile);try require(entry.revision>0);try PlanetChildAppearance.revision(entry.revision)
            if let selection=entry.selection { var bytes=try selection.encoded();defer { bytes.resetBytes(in:0..<bytes.count) };try require(try PlanetChildAppearance.Selection.decode(bytes)==selection) }
        }
    }
    private static func encodeAppearance(_ state: State,_ writer: Writer) throws {
        try validateAppearance(state);guard state.sdkAppearance else { return };try writer.number(0x4c505031,bytes:4);try writer.number(1,bytes:1);try writer.number(UInt64(state.appearances.count),bytes:1)
        for profile in state.appearances.keys.sorted() { let entry=state.appearances[profile]!;try writer.text(profile);try writer.number(entry.revision,bytes:8);try writer.byte(entry.selection==nil ? 0:1)
            if let selection=entry.selection { var bytes=try selection.encoded();defer { bytes.resetBytes(in:0..<bytes.count) };try writer.number(UInt64(bytes.count),bytes:4);try writer.data(bytes) }
        }
    }
    private static func decodeAppearance(_ state: State,_ reader: inout Reader) throws {
        try require(try reader.number(4)==0x4c505031 && reader.number(1)==1 && state.sdkCollections);state.sdkAppearance=true;let count=try reader.number(1);try require(count<=4)
        for _ in 0..<count { let profile=try reader.text(96),revision=try reader.number(8),flag=try reader.number(1);try require(flag<=1 && state.appearances[profile]==nil);var selection: PlanetChildAppearance.Selection?
            if flag==1 { let length=try reader.number(4);try require(length>0 && length<=UInt64(PlanetChildAppearance.maximumBytes));var bytes=try reader.data(Int(length));defer { bytes.resetBytes(in:0..<bytes.count) };selection=try PlanetChildAppearance.Selection.decode(bytes) };state.appearances[profile]=AppearanceEntry(revision:revision,selection:selection)
        };try validateAppearance(state)
    }
    private func appearanceMarker(_ directory: URL) throws -> URL { let file=directory.appendingPathComponent("local-v2-appearance.pending");try Self.require(file.resolvingSymlinksInPath().standardizedFileURL==file.standardizedFileURL);return file }
    private func appearanceMarkerBytes(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,_ commandId: String,_ revision: UInt64,_ selection: PlanetChildAppearance.Selection) throws -> Data {
        var stable=try selection.encoded();defer { stable.resetBytes(in:0..<stable.count) }
        return Data(("LP-LOCAL-V2-APPEARANCE\n"+identity+"\n"+commandId+"\n"+(try admission.binding())+"\n"+lease.scope.profileId+"\n"+String(lease.generation)+"\n"+lease.nonce+"\n"+String(revision)+"\n"+Self.digest(stable)+"\n").utf8)
    }
    func admittedAppearance(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,expectedRevision: UInt64?,permit: PlanetChildLocalV2SceneSelectionPermit?,commandId: String) throws -> LocalV2Appearance {
        try Self.require((expectedRevision==nil)==(permit==nil) && commandId.range(of:"\\A[a-f0-9]{32}\\z",options:.regularExpression) != nil)
        return try locked { directory in
            try admission.check();try existingOnly(directory);let state=try read(directory);defer { state.wipe() };try admittedLive(admission,lease,state);try Self.validateAppearance(state)
            let profile=lease.scope.profileId,prior=state.appearances[profile],revision=prior?.revision ?? 0
            guard let expectedRevision,let permit else { let result=LocalV2Appearance(profile,revision,prior?.selection);do { try admission.check();return result } catch { result.close();throw error } }
            let next=try Self.appearanceNext(revision,expectedRevision),selection=try permit.selection(admission)
            try Self.require(try permit.profileId(admission)==profile);let marker=try appearanceMarker(directory);var markerBytes=try appearanceMarkerBytes(admission,lease,commandId,next,selection);defer { markerBytes.resetBytes(in:0..<markerBytes.count) };var markerAttempted=false
            do {
                markerAttempted=true;try exclusiveReceiptFile(marker,markerBytes) { try permit.check(admission) };try syncDirectory(directory)
                state.sdkCollections=true;state.sdkAppearance=true;state.appearances[profile]=AppearanceEntry(revision:next,selection:selection);try Self.validateAppearance(state)
                try write(directory,state:state) { try permit.check(admission) }
                let actual=try read(directory);defer { actual.wipe() };try admittedLive(admission,lease,actual);try permit.check(admission);try Self.require(actual.appearances[profile]?.revision==next && actual.appearances[profile]?.selection==selection)
                // Exact native whole-state readback additionally binds every
                // inactive namespace/selection/revision; no sibling reset.
                var before=try Self.encode(state),after=try Self.encode(actual);defer { before.resetBytes(in:0..<before.count);after.resetBytes(in:0..<after.count) };try Self.require(before==after)
                var pending=try boundedFile(marker,4096);defer { pending.resetBytes(in:0..<pending.count) };try Self.require(pending==markerBytes);try admission.appearanceCommandKnown(commandId)
                let result=LocalV2Appearance(profile,next,selection);do { try admission.appearanceCommandReady(commandId);return result } catch { result.close();throw error }
            // Native revocation/UI joins are deferred to the admission caller
            // after both DataStore and the canonical Vault locks unwind.
            } catch { if markerAttempted { closed=true };throw error }
        }
    }
    func appearanceComplete(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,_ commandId: String) throws -> LocalV2AppearanceCompletion {
        return try locked { directory in
            try admission.check();let state=try read(directory);defer { state.wipe() };try admittedLive(admission,lease,state);try Self.validateAppearance(state);try admission.appearanceCommandJoined(commandId)
            guard let entry=state.appearances[lease.scope.profileId],let selection=entry.selection else { throw Failure.unavailable };let marker=try appearanceMarker(directory)
            var actual=try boundedFile(marker,4096),expected=try appearanceMarkerBytes(admission,lease,commandId,entry.revision,selection);defer { actual.resetBytes(in:0..<actual.count);expected.resetBytes(in:0..<expected.count) };try Self.require(actual==expected)
            // Preparation validates but NEVER unlinks. The exact marker stays
            // durable through writer fences and actual command consumer handoff.
            #if DEBUG
            try PlanetChildAppearanceRuntimeDelay.hold(commandId,phase:"completion")
            #endif
            try admission.check();return LocalV2AppearanceCompletion(self,expected)
        }
    }
}
extension PlanetChildDataStore {
    fileprivate static func appearanceNext(_ current: UInt64,_ expected: UInt64) throws -> UInt64 { try require(current==expected);return try PlanetChildAppearance.next(current) }
    fileprivate static func migrateAppearance(_ state: State,_ authenticatedProfiles: [String:String]) throws {
        try validateAppearance(state);try require(Set(state.appearances.keys).isSubset(of:Set(authenticatedProfiles.keys)))
        // The authenticated migration changes current seals/content namespaces.
        // Stable IDs and per-profile revisions stay byte-equivalent; destination
        // locale/package approval is checked only by a genuinely fresh restore.
    }
}
#if DEBUG
extension PlanetChildDataStore {
    private static func fixtureAppearanceSelection(_ suffix: String="one") throws -> PlanetChildAppearance.Selection {
        try PlanetChildAppearance.Selection(sceneId:"fixture-scene-"+suffix,owner:PlanetChildAppearance.Owner(kind:"writer",id:"fixture-writer"),skin:PlanetChildAppearance.Slot(assetId:"fixture-skin-"+suffix,entityId:"fixture-skin-entity"),stand:PlanetChildAppearance.Geometry(geometryId:"stand.base.child-book-cloud",assetId:"fixture-stand",entityId:"fixture-stand-entity"),background:PlanetChildAppearance.Geometry(geometryId:"background.base.library",assetId:"fixture-background",entityId:"fixture-background-entity"))
    }
    private static func fixtureAppearanceState() throws -> State {
        let state=State(),hash=String(repeating:"a",count:64)
        state.nonce=String(repeating:"1",count:32);state.admissionBinding=hash;state.sdkCollections=true
        for id in ["fixture-reader-one","fixture-reader-two"] { let scope=try Scope(profileId:id,profileRevision:1,exactAge:7,locale:"ru",policyVersion:"fixture-policy",policyChecksum:hash,packageId:"fixture-package",packageVersion:1,packageChecksum:hash);state.seals[id]=Seal(scope:scope,contentBinding:hash) };return state
    }
    /** Pure snapshot/codec mechanics only, no native admission or protected
     * parent authority. Uses the exact production extension encoder/decoder. */
    static func fixtureAppearanceScenario(_ name: String) throws -> Bool {
        func denied(_ work: () throws -> Void) -> Bool { do { try work();return false } catch { return true } }
        if name=="legacy" {
            let state=State();state.nonce=String(repeating:"1",count:32);defer { state.wipe() };var before=try encode(state);defer { before.resetBytes(in:0..<before.count) };let decoded=try decode(before);defer { decoded.wipe() };var after=try encode(decoded);defer { after.resetBytes(in:0..<after.count) };try require(!decoded.sdkAppearance && decoded.appearances.isEmpty && before==after);return true
        }
        if name=="cas" { try require(try appearanceNext(7,7)==8);try require(denied { _=try appearanceNext(7,6) } && denied { _=try appearanceNext(9007199254740990,9007199254740990) });return true }
        let state=try fixtureAppearanceState();defer { state.wipe() };var legacy=try encode(state);defer { legacy.resetBytes(in:0..<legacy.count) };state.sdkAppearance=true
        let first=try fixtureAppearanceSelection(),second=try fixtureAppearanceSelection("two");state.appearances["fixture-reader-one"]=AppearanceEntry(revision:3,selection:first);state.appearances["fixture-reader-two"]=AppearanceEntry(revision:9,selection:second)
        if name=="tombstone" { state.appearances["fixture-reader-one"]=AppearanceEntry(revision:4,selection:nil) }
        if name=="migration" {
            let hash=String(repeating:"b",count:64),scope=try Scope(profileId:"fixture-reader-one",profileRevision:2,exactAge:7,locale:"en",policyVersion:"fixture-policy",policyChecksum:hash,packageId:"fixture-package-en",packageVersion:2,packageChecksum:hash)
            state.seals[scope.profileId]=Seal(scope:scope,contentBinding:hash);state.admissionBinding=hash;try migrateAppearance(state,[scope.profileId:hash,"fixture-reader-two":String(repeating:"a",count:64)])
            try require(state.appearances[scope.profileId]?.revision==3 && state.appearances[scope.profileId]?.selection==first && state.appearances["fixture-reader-two"]?.revision==9 && state.appearances["fixture-reader-two"]?.selection==second)
            try require(denied { try migrateAppearance(state,[scope.profileId:hash]) })
        }
        var encoded=try encode(state);defer { encoded.resetBytes(in:0..<encoded.count) }
        if name=="corrupt" { var changed=encoded;defer { changed.resetBytes(in:0..<changed.count) };changed[legacy.count+4]=2;try require(denied { let decoded=try decode(changed);decoded.wipe() });changed=encoded;changed.append(0);try require(denied { let decoded=try decode(changed);decoded.wipe() });return true }
        let decoded=try decode(encoded);defer { decoded.wipe() };var exact=try encode(decoded);defer { exact.resetBytes(in:0..<exact.count) };try require(exact==encoded && decoded.appearances["fixture-reader-two"]?.revision==9 && decoded.appearances["fixture-reader-two"]?.selection==second)
        if name=="tombstone" { try require(decoded.appearances["fixture-reader-one"]?.revision==4 && decoded.appearances["fixture-reader-one"]?.selection==nil) }
        else { try require(decoded.appearances["fixture-reader-one"]?.revision==3 && decoded.appearances["fixture-reader-one"]?.selection==first) }
        if name != "migration" { try require(encoded.starts(with:legacy)) };return true
    }
    /** Real isolated per-run AES/file/Keychain storage. This synthetic namespace
     * establishes persistence mechanics only, never genuine LOCAL2 admission. */
    static func fixtureAppearancePersistence(runId: String,phase: String) throws -> Bool {
        let store=try synthetic(runId:runId)
        return try store.locked { directory in
            if phase=="write" { let state=try fixtureAppearanceState();defer { state.wipe() };state.sdkAppearance=true;state.appearances["fixture-reader-one"]=AppearanceEntry(revision:5,selection:try fixtureAppearanceSelection());state.appearances["fixture-reader-two"]=AppearanceEntry(revision:11,selection:try fixtureAppearanceSelection("two"));try store.write(directory,state:state) {};return true }
            let state=try store.read(directory);defer { state.wipe() }
            if phase=="read" { try require(state.appearances["fixture-reader-one"]?.revision==5 && state.appearances["fixture-reader-one"]?.selection==fixtureAppearanceSelection() && state.appearances["fixture-reader-two"]?.revision==11 && state.appearances["fixture-reader-two"]?.selection==fixtureAppearanceSelection("two"));return true }
            if phase=="pending" { try store.existingOnly(directory);let marker=try store.appearanceMarker(directory);var bytes=Data(("LP-SOFTWARE-APPEARANCE-PENDING\n"+runId+"\n").utf8);defer { bytes.resetBytes(in:0..<bytes.count) };try store.exclusiveReceiptFile(marker,bytes) {};try store.syncDirectory(directory);var denied=false;do { try store.existingOnly(directory) } catch { denied=true };try require(denied && FileManager.default.fileExists(atPath:marker.path));return true }
            if phase=="pending-reopen" { let marker=try store.appearanceMarker(directory);try require(FileManager.default.fileExists(atPath:marker.path));var denied=false;do { try store.existingOnly(directory) } catch { denied=true };try require(denied);return true }
            throw Failure.unavailable
        }
    }
}
#endif
#if DEBUG
extension PlanetChildDataStore {
    /** Isolated software receipt fixture. No admission factory is exposed. */
    static func fixtureAppearanceCompletionUnknown(runId: String) throws -> Bool {
        let store=try synthetic(runId:runId)
        let prepared=try store.locked { directory -> (LocalV2AppearanceCompletion,Data,String) in
            try store.existingOnly(directory);let marker=try store.appearanceMarker(directory)
            let bytes=Data(("LP-SOFTWARE-APPEARANCE-COMPLETION\n"+runId+"\n").utf8),snapshot=try store.record(directory)
            let digest=Self.digest(try Data(contentsOf:snapshot));try store.exclusiveReceiptFile(marker,bytes) {};try store.syncDirectory(directory)
            let receipt=LocalV2AppearanceCompletion(store,bytes)
            // Merely preparing/owning a receipt cannot remove the crash marker.
            try require(try store.boundedFile(marker,4096)==bytes)
            // Explicit synthetic I/O-loss injection exercises exact re-arming.
            try require(Darwin.unlink(marker.path)==0);try store.syncDirectory(directory)
            return (receipt,bytes,digest)
        }
        defer { prepared.0.close() };prepared.0.retainUnknown()
        return try store.locked { directory in
            let marker=try store.appearanceMarker(directory);var actual=try store.boundedFile(marker,4096);defer { actual.resetBytes(in:0..<actual.count) }
            try require(actual==prepared.1 && Self.digest(try Data(contentsOf:store.record(directory)))==prepared.2)
            var denied=false;do { try store.existingOnly(directory) } catch { denied=true };try require(denied)
            return true
        }
    }
    static func fixtureProductionPendingObserved(commandId: String) throws -> Bool {
        try require(commandId.range(of:"\\A[a-f0-9]{32}\\z",options:.regularExpression) != nil)
        let root=try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:false).appendingPathComponent("literary-planet-child-data-v1",isDirectory:true),file=root.appendingPathComponent("local-v2-appearance.pending")
        try require(root.resolvingSymlinksInPath().standardizedFileURL==root.standardizedFileURL && file.resolvingSymlinksInPath().standardizedFileURL==file.standardizedFileURL)
        if !FileManager.default.fileExists(atPath:file.path) { return false }
        let info=try file.resourceValues(forKeys:[.isRegularFileKey,.isSymbolicLinkKey,.fileSizeKey]);try require(info.isRegularFile==true && info.isSymbolicLink != true && (info.fileSize ?? 4097)>0 && (info.fileSize ?? 4097)<=4096)
        var bytes=try Data(contentsOf:file);defer { bytes.resetBytes(in:0..<bytes.count) };let fields=String(decoding:bytes,as:UTF8.self).components(separatedBy:"\n");return fields.count==10 && fields[0]=="LP-LOCAL-V2-APPEARANCE" && fields[2]==commandId
    }
}
#endif

/** Independent protected semantic journey extension. Absent legacy bytes are
 * preserved; all state is bound to authenticated native profile seals. */
extension PlanetChildDataStore {
    private struct JourneyEntry { let revision: UInt64,activeJourneyId: String;var progress: [String:PlanetChildJourney.Progress] }
    final class LocalV2Journey {
        let profileId: String,revision: UInt64,progress: PlanetChildJourney.Progress?,activeJourneyId: String?
        private let lock=NSLock();private var closed=false
        fileprivate init(_ profileId: String,_ revision: UInt64,_ progress: PlanetChildJourney.Progress?,_ activeJourneyId: String?) { self.profileId=profileId;self.revision=revision;self.progress=progress;self.activeJourneyId=activeJourneyId }
        func dto() throws -> [String:Any] { lock.lock();defer { lock.unlock() };try PlanetChildDataStore.require(!closed);return ["profileId":profileId,"revision":revision,"progress":progress?.dto as Any? ?? NSNull()] }
        var closedForSDK: Bool { lock.lock();defer { lock.unlock() };return closed }
        func close() { lock.lock();closed=true;lock.unlock() }
        deinit { close() }
    }
    final class LocalV2JourneyCompletion {
        private let lock=NSLock();private var marker: Data,closed=false,finished=false
        private let store: PlanetChildDataStore
        fileprivate init(_ store: PlanetChildDataStore,_ marker: Data) { self.store=store;self.marker=Data(Array(marker)) }
        func finish() throws {
            lock.lock();defer { lock.unlock() };try PlanetChildDataStore.require(!closed && !finished)
            do { try store.locked { directory in
                try PlanetChildDataStore.require(!store.closed)
                let file=try store.journeyMarker(directory)
                var actual=try store.boundedFile(file,4096);defer { actual.resetBytes(in:0..<actual.count) }
                try PlanetChildDataStore.require(actual==marker)
                // The native result consumer owns the completed command and all
                // dispatch/canonical fences have returned.
                // No authority check follows this durable completion boundary.
                try PlanetChildDataStore.require(Darwin.unlink(file.path)==0);try store.syncDirectory(directory)
            } } catch {
                // Exact-marker restoration after an I/O failure is conservative;
                // a partial/existing marker is never removed or overwritten.
                do { try store.locked { directory in
                    let file=try store.journeyMarker(directory)
                    if !FileManager.default.fileExists(atPath:file.path) { try store.exclusiveReceiptFile(file,marker) {};try store.syncDirectory(directory) }
                    store.closed=true
                } } catch { store.closed=true }
                throw error
            }
            finished=true
        }
        func retainUnknown() {
            lock.lock();defer { lock.unlock() };guard !closed else { return }
            do { try store.locked { directory in
                let file=try store.journeyMarker(directory)
                // Preserve an existing or partial unknown marker exactly.
                if !FileManager.default.fileExists(atPath:file.path) { try store.exclusiveReceiptFile(file,marker) {};try store.syncDirectory(directory) }
                store.closed=true
            } } catch { store.closed=true }
        }
        func close() { lock.lock();defer { lock.unlock() };if !closed { closed=true;marker.resetBytes(in:0..<marker.count) } }
        deinit { close() }
    }
    private static func validateJourney(_ state: State) throws {
        if !state.sdkJourney { try require(state.journeys.isEmpty);return }
        try require(state.sdkCollections && state.sdkAppearance && state.admissionBinding != nil && state.sdkUnboundBirth==nil && state.journeys.count<=4 && Set(state.journeys.keys).isSubset(of:Set(state.seals.keys)))
        for (profile,entry) in state.journeys { _=try PlanetChildJourney.identifier(profile);try require(entry.revision>0 && entry.revision<maxSafe && !entry.progress.isEmpty && entry.progress.count<=32 && entry.progress[entry.activeJourneyId] != nil)
            for (id,value) in entry.progress { try require(id==value.journeyId);var bytes=try value.encoded();defer { bytes.resetBytes(in:0..<bytes.count) };try require(try PlanetChildJourney.Progress.decode(bytes)==value) }
        }
    }
    private static func encodeJourney(_ state: State,_ writer: Writer) throws {
        try validateJourney(state);guard state.sdkJourney else { return };try writer.number(0x4c504a32,bytes:4);try writer.number(1,bytes:1);try writer.number(UInt64(state.journeys.count),bytes:1)
        for profile in state.journeys.keys.sorted() { let entry=state.journeys[profile]!;try writer.text(profile);try writer.number(entry.revision,bytes:8);try writer.text(entry.activeJourneyId);try writer.number(UInt64(entry.progress.count),bytes:1)
            for id in entry.progress.keys.sorted() { var bytes=try entry.progress[id]!.encoded();defer { bytes.resetBytes(in:0..<bytes.count) };try writer.number(UInt64(bytes.count),bytes:4);try writer.data(bytes) }
        }
    }
    private static func decodeJourney(_ state: State,_ reader: inout Reader) throws {
        try require(try reader.number(4)==0x4c504a32 && reader.number(1)==1 && state.sdkAppearance);state.sdkJourney=true;let count=try reader.number(1);try require(count<=4)
        for _ in 0..<count { let profile=try reader.text(96),revision=try reader.number(8),active=try reader.text(96),entries=try reader.number(1);try require(entries>0 && entries<=32 && state.journeys[profile]==nil);var values=[String:PlanetChildJourney.Progress]()
            for _ in 0..<entries { let size=try reader.number(4);try require(size>0 && size<=UInt64(PlanetChildJourney.maximumBytes));var bytes=try reader.data(Int(size));defer { bytes.resetBytes(in:0..<bytes.count) };let value=try PlanetChildJourney.Progress.decode(bytes);try require(values[value.journeyId]==nil);values[value.journeyId]=value };state.journeys[profile]=JourneyEntry(revision:revision,activeJourneyId:active,progress:values)
        };try validateJourney(state)
    }
    private func journeyMarker(_ directory: URL) throws -> URL { let file=directory.appendingPathComponent("local-v2-journey.pending");try Self.require(file.resolvingSymlinksInPath().standardizedFileURL==file.standardizedFileURL);return file }
    private func journeyMarkerBytes(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,_ commandId: String,_ revision: UInt64,_ progress: PlanetChildJourney.Progress) throws -> Data {
        var stable=try progress.encoded();defer { stable.resetBytes(in:0..<stable.count) }
        return Data(("LP-LOCAL-V2-JOURNEY\n"+identity+"\n"+commandId+"\n"+(try admission.binding())+"\n"+lease.scope.profileId+"\n"+String(lease.generation)+"\n"+lease.nonce+"\n"+String(revision)+"\n"+Self.digest(stable)+"\n").utf8)
    }
    func admittedJourney(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,journeyId: String?,expectedRevision: UInt64?,permit: PlanetChildLocalV2JourneyPermit?,commandId: String) throws -> LocalV2Journey {
        try Self.require((expectedRevision==nil)==(permit==nil) && commandId.range(of:#"\A[a-f0-9]{32}\z"#,options:.regularExpression) != nil)
        return try locked { directory in
            try admission.check();try existingOnly(directory);let state=try read(directory);defer { state.wipe() };try admittedLive(admission,lease,state);try Self.validateJourney(state)
            let profile=lease.scope.profileId,prior=state.journeys[profile],revision=prior?.revision ?? 0,selected=journeyId ?? prior?.activeJourneyId
            guard let expectedRevision,let permit else { let result=LocalV2Journey(profile,revision,selected.flatMap { prior?.progress[$0] },prior?.activeJourneyId);do { try admission.check();return result } catch { result.close();throw error } }
            try Self.require(revision==expectedRevision);let next=try PlanetChildJourney.next(revision),progress=try permit.progress(admission);try Self.require(try permit.profileId(admission)==profile && journeyId==progress.journeyId)
            var values=prior?.progress ?? [:];values[progress.journeyId]=progress;try Self.require(values.count<=32)
            state.sdkCollections=true;state.sdkAppearance=true;state.sdkJourney=true;state.journeys[profile]=JourneyEntry(revision:next,activeJourneyId:progress.journeyId,progress:values)
            try Self.recordLearning(state,profile,permit.passportCredit(admission))
            // Validate every retained partition and the whole snapshot size before
            // publishing an unknown-write marker. A deterministic capacity refusal
            // must not turn unchanged durable history into a cold-denied store.
            var prepared=try Self.encode(state);defer { prepared.resetBytes(in:0..<prepared.count) }
            let marker=try journeyMarker(directory);var markerBytes=try journeyMarkerBytes(admission,lease,commandId,next,progress);defer { markerBytes.resetBytes(in:0..<markerBytes.count) };var attempted=false
            do {
                attempted=true;try exclusiveReceiptFile(marker,markerBytes) { try permit.check(admission) };try syncDirectory(directory)
                try write(directory,state:state) { try permit.check(admission) };let actual=try read(directory);defer { actual.wipe() };try admittedLive(admission,lease,actual);try permit.check(admission)
                try Self.require(actual.journeys[profile]?.revision==next && actual.journeys[profile]?.activeJourneyId==progress.journeyId && actual.journeys[profile]?.progress==values)
                var after=try Self.encode(actual);defer { after.resetBytes(in:0..<after.count) };try Self.require(prepared==after)
                var pending=try boundedFile(marker,4096);defer { pending.resetBytes(in:0..<pending.count) };try Self.require(pending==markerBytes);try admission.journeyCommandKnown(commandId)
                let result=LocalV2Journey(profile,next,progress,progress.journeyId);do { try admission.journeyCommandReady(commandId);return result } catch { result.close();throw error }
            } catch { if attempted { closed=true };throw error }
        }
    }
    func journeyComplete(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,_ commandId: String) throws -> LocalV2JourneyCompletion {
        try locked { directory in
            try admission.check();let state=try read(directory);defer { state.wipe() };try admittedLive(admission,lease,state);try Self.validateJourney(state);try admission.journeyCommandJoined(commandId)
            guard let entry=state.journeys[lease.scope.profileId],let progress=entry.progress[entry.activeJourneyId] else { throw Failure.unavailable }
            var actual=try boundedFile(journeyMarker(directory),4096),expected=try journeyMarkerBytes(admission,lease,commandId,entry.revision,progress);defer { actual.resetBytes(in:0..<actual.count);expected.resetBytes(in:0..<expected.count) };try Self.require(actual==expected);try admission.check();return LocalV2JourneyCompletion(self,expected)
        }
    }
    fileprivate static func migrateJourney(_ state: State,_ authenticatedProfiles: [String:String]) throws { try validateJourney(state);try require(Set(state.journeys.keys).isSubset(of:Set(authenticatedProfiles.keys))) }
}
#if DEBUG
extension PlanetChildDataStore {
    static func fixtureJourneyScenario(_ name: String) throws -> Bool {
        let state=try fixtureAppearanceState();defer { state.wipe() }
        if name=="legacy" { var before=try encode(state);defer { before.resetBytes(in:0..<before.count) };let decoded=try decode(before);defer { decoded.wipe() };var after=try encode(decoded);defer { after.resetBytes(in:0..<after.count) };try require(!decoded.sdkJourney && decoded.journeys.isEmpty && before==after);return true }
        let first=try PlanetChildJourney.Progress(journeyId:"route-one",journeyVersion:1,contentVersion:1,currentNodeId:"node-one",completedNodeIds:["removed-node"],selectedCountryId:nil,selectedWriterId:nil,selectedWorkId:nil,lastSafeRoute:"journey")
        let second=try PlanetChildJourney.Progress(journeyId:"route-two",journeyVersion:2,contentVersion:2,currentNodeId:nil,completedNodeIds:["node-two"],selectedCountryId:nil,selectedWriterId:nil,selectedWorkId:nil,lastSafeRoute:"journey")
        state.sdkAppearance=true;state.sdkJourney=true;state.journeys["fixture-reader-one"]=JourneyEntry(revision:7,activeJourneyId:first.journeyId,progress:[first.journeyId:first,second.journeyId:second]);state.journeys["fixture-reader-two"]=JourneyEntry(revision:11,activeJourneyId:second.journeyId,progress:[second.journeyId:second])
        if name=="capacity" {
            var values=[String:PlanetChildJourney.Progress]()
            for index in 0..<32 {
                let id="route-"+String(index)
                values[id]=try PlanetChildJourney.Progress(journeyId:id,journeyVersion:1,contentVersion:1,currentNodeId:"node-one",completedNodeIds:["archived-node"],selectedCountryId:nil,selectedWriterId:nil,selectedWorkId:nil,lastSafeRoute:"journey")
            }
            state.journeys["fixture-reader-one"]=JourneyEntry(revision:32,activeJourneyId:"route-31",progress:values)
            var bounded=try encode(state);defer { bounded.resetBytes(in:0..<bounded.count) }
            let retained=try decode(bounded);defer { retained.wipe() }
            try require(retained.journeys["fixture-reader-one"]?.progress.count==32 && retained.journeys["fixture-reader-two"]?.progress[second.journeyId]==second)
            values[first.journeyId]=first;state.journeys["fixture-reader-one"]=JourneyEntry(revision:33,activeJourneyId:first.journeyId,progress:values)
            var refused=false;do { var invalid=try encode(state);invalid.resetBytes(in:0..<invalid.count) } catch { refused=true };try require(refused)
            var exact=try encode(retained);defer { exact.resetBytes(in:0..<exact.count) };try require(exact==bounded)
            return true
        }
        if name=="migration" { try migrateJourney(state,["fixture-reader-one":String(repeating:"a",count:64),"fixture-reader-two":String(repeating:"a",count:64)]) }
        var bytes=try encode(state);defer { bytes.resetBytes(in:0..<bytes.count) };let decoded=try decode(bytes);defer { decoded.wipe() };var exact=try encode(decoded);defer { exact.resetBytes(in:0..<exact.count) };try require(bytes==exact && decoded.journeys["fixture-reader-one"]?.progress.count==2 && decoded.journeys["fixture-reader-two"]?.revision==11)
        if name=="corrupt" { bytes.append(0);var refused=false;do { _=try decode(bytes) } catch { refused=true };try require(refused);return true }
        try require(["isolation","migration","switch"].contains(name));return true
    }
}
#endif

#if DEBUG
extension PlanetChildDataStore {
    static func fixtureJourneyCompletionUnknown(runId: String) throws -> Bool {
        let store=try synthetic(runId:runId)
        let prepared=try store.locked { directory -> (LocalV2JourneyCompletion,Data,String) in
            try store.existingOnly(directory);let marker=try store.journeyMarker(directory)
            let bytes=Data(("LP-SOFTWARE-JOURNEY-COMPLETION\n"+runId+"\n").utf8),snapshot=try store.record(directory)
            let digest=Self.digest(try Data(contentsOf:snapshot));try store.exclusiveReceiptFile(marker,bytes) {};try store.syncDirectory(directory)
            let receipt=LocalV2JourneyCompletion(store,bytes)
            // Merely preparing/owning a receipt cannot remove the crash marker.
            try require(try store.boundedFile(marker,4096)==bytes)
            // Explicit synthetic I/O-loss injection exercises exact re-arming.
            try require(Darwin.unlink(marker.path)==0);try store.syncDirectory(directory)
            return (receipt,bytes,digest)
        }
        defer { prepared.0.close() };prepared.0.retainUnknown()
        return try store.locked { directory in
            let marker=try store.journeyMarker(directory);var actual=try store.boundedFile(marker,4096);defer { actual.resetBytes(in:0..<actual.count) }
            try require(actual==prepared.1 && Self.digest(try Data(contentsOf:store.record(directory)))==prepared.2)
            var denied=false;do { try store.existingOnly(directory) } catch { denied=true };try require(denied)
            return true
        }
    }
}
#endif

/** Protected LPP2 extension. Ordinary reads never append it or create facts.
 * The same whole encrypted snapshot/CAS and original command fences own the
 * ledger and every retained journey. Legacy bytes remain exact until mutation. */
extension PlanetChildDataStore {
    private struct PassportEntry { let revision: UInt64;var ledger: PlanetChildPassport.Ledger }
    final class LocalV2Passport {
        let profileId: String,revision: UInt64,ledger: PlanetChildPassport.Ledger,journeys: [String:PlanetChildJourney.Progress]
        private let lock=NSLock();private var closed=false
        fileprivate init(_ profile: String,_ revision: UInt64,_ ledger: PlanetChildPassport.Ledger,_ journeys: [String:PlanetChildJourney.Progress]) { profileId=profile;self.revision=revision;self.ledger=ledger;self.journeys=journeys }
        var closedForSDK: Bool { lock.lock();defer { lock.unlock() };return closed }
        func close() { lock.lock();closed=true;lock.unlock() }
        deinit { close() }
    }
    final class LocalV2PassportCompletion {
        private let lock=NSLock(),store: PlanetChildDataStore;private var marker: Data,closed=false,finished=false
        fileprivate init(_ store: PlanetChildDataStore,_ marker: Data) { self.store=store;self.marker=Data(Array(marker)) }
        func finish() throws {
            lock.lock();defer { lock.unlock() };try PlanetChildDataStore.require(!closed && !finished)
            do { try store.locked { directory in
                try PlanetChildDataStore.require(!store.closed);let file=try store.passportMarker(directory)
                var actual=try store.boundedFile(file,4096);defer { actual.resetBytes(in:0..<actual.count) };try PlanetChildDataStore.require(actual==marker)
                try PlanetChildDataStore.require(Darwin.unlink(file.path)==0);try store.syncDirectory(directory)
            } } catch { retainMarker();throw error }
            finished=true
        }
        private func retainMarker() {
            do { try store.locked { directory in let file=try store.passportMarker(directory);if !FileManager.default.fileExists(atPath:file.path) { try store.exclusiveReceiptFile(file,marker) {};try store.syncDirectory(directory) };store.closed=true } } catch { store.closed=true }
        }
        func retainUnknown() { lock.lock();defer { lock.unlock() };guard !closed else { return };retainMarker() }
        func close() { lock.lock();defer { lock.unlock() };if !closed { closed=true;marker.resetBytes(in:0..<marker.count) } }
        deinit { close() }
    }
    private static func validatePassport(_ state: State) throws {
        if !state.sdkPassport { try require(state.passports.isEmpty);return }
        try require(state.sdkJourney && state.sdkAppearance && state.sdkCollections && state.admissionBinding != nil && state.sdkUnboundBirth==nil && state.passports.count<=4 && Set(state.passports.keys).isSubset(of:Set(state.seals.keys)))
        for (profile,entry) in state.passports {
            _=try PlanetChildJourney.identifier(profile);try require(entry.revision>0 && entry.revision<maxSafe);try entry.ledger.validate()
            let journeys=state.journeys[profile]?.progress ?? [:]
            for row in entry.ledger.learning { guard let saved=journeys[row.journeyId] else { throw Failure.unavailable };try require(saved.completedNodeIds.contains(row.nodeId)) }
            for row in entry.ledger.completedJourneys { guard let saved=journeys[row.journeyId] else { throw Failure.unavailable };try require(row.nodeIds.allSatisfy({ saved.completedNodeIds.contains($0) })) }
        }
    }
    private static func encodePassport(_ state: State,_ writer: Writer) throws {
        try validatePassport(state);guard state.sdkPassport else { return };try writer.number(0x4c505032,bytes:4);try writer.number(1,bytes:1);try writer.number(UInt64(state.passports.count),bytes:1)
        for profile in state.passports.keys.sorted() { let entry=state.passports[profile]!;try writer.text(profile);try writer.number(entry.revision,bytes:8);var bytes=try entry.ledger.encoded();defer { bytes.resetBytes(in:0..<bytes.count) };try writer.number(UInt64(bytes.count),bytes:4);try writer.data(bytes) }
    }
    private static func decodePassport(_ state: State,_ reader: inout Reader) throws {
        try require(try reader.number(4)==0x4c505032 && reader.number(1)==1 && state.sdkJourney);state.sdkPassport=true;let count=try reader.number(1);try require(count<=4)
        for _ in 0..<count { let profile=try reader.text(96),revision=try reader.number(8),size=try reader.number(4);try require(state.passports[profile]==nil && size>0 && size<=UInt64(PlanetChildPassport.maximumBytes));var bytes=try reader.data(Int(size));defer { bytes.resetBytes(in:0..<bytes.count) };state.passports[profile]=PassportEntry(revision:revision,ledger:try PlanetChildPassport.Ledger.decode(bytes)) };try validatePassport(state)
    }
    private static func recordLearning(_ state: State,_ profile: String,_ credit: (PlanetChildPassport.Learning?,PlanetChildPassport.CompletedJourney?)?) throws {
        guard let credit,credit.0 != nil || credit.1 != nil else { return }
        let previous=state.passports[profile];var ledger=previous?.ledger ?? PlanetChildPassport.Ledger();try ledger.complete(credit.0,credit.1)
        state.sdkPassport=true;state.passports[profile]=PassportEntry(revision:try PlanetChildJourney.next(previous?.revision ?? 0),ledger:ledger);try validatePassport(state)
    }
    private func passportMarker(_ directory: URL) throws -> URL { let file=directory.appendingPathComponent("local-v2-passport.pending");try Self.require(file.resolvingSymlinksInPath().standardizedFileURL==file.standardizedFileURL);return file }
    private func passportMarkerBytes(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,_ commandId: String,_ revision: UInt64,_ ledger: PlanetChildPassport.Ledger) throws -> Data {
        var bytes=try ledger.encoded();defer { bytes.resetBytes(in:0..<bytes.count) }
        return Data(("LP-LOCAL-V2-PASSPORT\n"+identity+"\n"+commandId+"\n"+(try admission.binding())+"\n"+lease.scope.profileId+"\n"+String(lease.generation)+"\n"+lease.nonce+"\n"+String(revision)+"\n"+Self.digest(bytes)+"\n").utf8)
    }
    func admittedPassport(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,expectedRevision: UInt64?,permit: PlanetChildLocalV2PassportPermit?,commandId: String) throws -> LocalV2Passport {
        try Self.require((expectedRevision==nil)==(permit==nil) && commandId.range(of:#"\A[a-f0-9]{32}\z"#,options:.regularExpression) != nil)
        return try locked { directory in
            try admission.check();try existingOnly(directory);let state=try read(directory);defer { state.wipe() };try admittedLive(admission,lease,state);try Self.validatePassport(state)
            let profile=lease.scope.profileId,prior=state.passports[profile],revision=prior?.revision ?? 0
            guard let expectedRevision,let permit else { try admission.check();return LocalV2Passport(profile,revision,prior?.ledger ?? PlanetChildPassport.Ledger(),state.journeys[profile]?.progress ?? [:]) }
            try Self.require(revision==expectedRevision);let next=try PlanetChildJourney.next(revision);var ledger=prior?.ledger ?? PlanetChildPassport.Ledger();try ledger.openCountry(permit.countryId(admission));try Self.require(try permit.profileId(admission)==profile)
            state.sdkCollections=true;state.sdkAppearance=true;state.sdkJourney=true;state.sdkPassport=true;state.passports[profile]=PassportEntry(revision:next,ledger:ledger)
            var prepared=try Self.encode(state);defer { prepared.resetBytes(in:0..<prepared.count) };let marker=try passportMarker(directory);var expected=try passportMarkerBytes(admission,lease,commandId,next,ledger);defer { expected.resetBytes(in:0..<expected.count) };var attempted=false
            do {
                attempted=true;try exclusiveReceiptFile(marker,expected) { try permit.check(admission) };try syncDirectory(directory);try write(directory,state:state) { try permit.check(admission) }
                let actual=try read(directory);defer { actual.wipe() };try admittedLive(admission,lease,actual);try permit.check(admission)
                var after=try Self.encode(actual),pending=try boundedFile(marker,4096);defer { after.resetBytes(in:0..<after.count);pending.resetBytes(in:0..<pending.count) }
                try Self.require(prepared==after && actual.passports[profile]?.revision==next && actual.passports[profile]?.ledger==ledger && pending==expected);try admission.passportCommandKnown(commandId)
                let result=LocalV2Passport(profile,next,ledger,actual.journeys[profile]?.progress ?? [:]);do { try admission.passportCommandReady(commandId);return result } catch { result.close();throw error }
            } catch { if attempted { closed=true };throw error }
        }
    }
    func passportComplete(_ admission: PlanetChildLocalV2DataAdmission,_ lease: Lease,_ commandId: String) throws -> LocalV2PassportCompletion {
        try locked { directory in try admission.check();let state=try read(directory);defer { state.wipe() };try admittedLive(admission,lease,state);try Self.validatePassport(state);try admission.passportCommandJoined(commandId)
            guard let entry=state.passports[lease.scope.profileId] else { throw Failure.unavailable }
            var actual=try boundedFile(passportMarker(directory),4096),expected=try passportMarkerBytes(admission,lease,commandId,entry.revision,entry.ledger);defer { actual.resetBytes(in:0..<actual.count);expected.resetBytes(in:0..<expected.count) };try Self.require(actual==expected);try admission.check();return LocalV2PassportCompletion(self,expected)
        }
    }
    private static func removeChildData(_ state: State,_ next: inout [String:Stored],_ target: PlanetChildLocalV2RemovalTarget) throws {
        try require(state.seals[target.profileId] != nil || state.sdkUnboundBirth==target.profileId)
        for compound in Array(next.keys) {
            let pair=compound.components(separatedBy:"\n");guard pair.count==2,let purpose=Purpose(rawValue:pair[0]) else { throw Failure.unavailable }
            let scope=try keyScope(purpose,key:pair[1])
            if scope.profileId==target.profileId && (target.scope=="profile" || purpose == .history || purpose == .search) { if var stored=next.removeValue(forKey:compound) { stored.value.resetBytes(in:0..<stored.value.count) } }
        }
        state.journeys.removeValue(forKey:target.profileId);state.passports.removeValue(forKey:target.profileId)
        for key in Array(state.collectionRevisions.keys) { let pair=key.components(separatedBy:"\n");try require(pair.count==2);if pair[0]==target.profileId && (target.scope=="profile" || pair[1]==Purpose.history.rawValue) { state.collectionRevisions.removeValue(forKey:key) } }
        if target.scope=="profile" {
            state.appearances.removeValue(forKey:target.profileId);state.seals.removeValue(forKey:target.profileId)
            if state.sdkUnboundBirth==target.profileId { state.sdkUnboundBirth=nil;state.sdkUnboundContent=nil }
            for key in Array(state.tombstones.keys) { let pair=key.components(separatedBy:"\n");guard pair.count==2,let purpose=Purpose(rawValue:pair[0]) else { throw Failure.unavailable };if try keyScope(purpose,key:pair[1]).profileId==target.profileId { state.tombstones.removeValue(forKey:key) } }
        }
        state.sdkCollections=true
        if state.sdkUnboundBirth==nil { state.sdkAppearance=true;state.sdkJourney=true;state.sdkPassport=true }
    }
    private static func migratePassport(_ state: State,_ profiles: [String:String]) throws { try validatePassport(state);try require(Set(state.passports.keys).isSubset(of:Set(profiles.keys))) }
}

extension PlanetChildDataStore {
    private func originRedactionFile(_ directory: URL) throws -> URL { let file=directory.appendingPathComponent("local-v2-origin.redaction.new");try Self.require(file.resolvingSymlinksInPath().standardizedFileURL==file.standardizedFileURL);return file }
    /** Original Gate migration marker is already durable before this write.
     * Exact reduced receipt replaces the old encrypted full profile copy; an
     * uncertain outcome preserves pending and cannot be replayed/adopted. */
    private func redactKnownBirth(_ directory: URL,_ admission: PlanetChildLocalV2DataAdmission) throws {
        guard let target=try admission.childRemoval(),target.scope=="profile" else { return };try admission.check()
        let birth=try knownBirth(directory);guard !birth.redacted,birth.profileId==target.profileId else { return }
        var encrypted=try boundedFile(knownBirthFile(directory),262144),claim=try boundedFile(birthMarker(directory),4096);defer { encrypted.resetBytes(in:0..<encrypted.count);claim.resetBytes(in:0..<claim.count) }
        try Self.require(encrypted.first==1);var original=try AES.GCM.open(AES.GCM.SealedBox(combined:Data(encrypted.dropFirst())),using:key(create:false,directory:directory),authenticating:Data((identity+"\nLP-LOCAL-V2-KNOWN-BIRTH-v1").utf8)),reduced=Data();defer { original.resetBytes(in:0..<original.count);reduced.resetBytes(in:0..<reduced.count) }
        reduced=try PlanetChildLocalV2KnownBirth.redactedReceipt(original,identity:identity,claim:claim)
        let sealed=try AES.GCM.seal(reduced,using:key(create:false,directory:directory),authenticating:Data((identity+"\nLP-LOCAL-V2-KNOWN-BIRTH-v1").utf8));guard let combined=sealed.combined else { throw Failure.unavailable };var replacement=Data([1]);replacement.append(combined);defer { replacement.resetBytes(in:0..<replacement.count) }
        let staged=try originRedactionFile(directory),base=try knownBirthFile(directory);try admission.check();try exclusiveReceiptFile(staged,replacement,admission.check);try syncDirectory(directory);try admission.check()
        try Self.require(Darwin.rename(staged.path,base.path)==0);try syncDirectory(directory);try admission.check()
        var actual=try boundedFile(base,262144);defer { actual.resetBytes(in:0..<actual.count) };try Self.require(actual==replacement)
        let result=try knownBirth(directory);try Self.require(result.redacted && result.profileId.isEmpty && result.profileContentBinding.isEmpty && result.nonce==birth.nonce && result.emptyChecksum==birth.emptyChecksum);try admission.knownBirth(result);try admission.check()
    }
}

#if DEBUG
extension PlanetChildDataStore {
    /** Pure original codec/mutation leaves: no fixture admission producer. */
    static func fixturePassportScenario(_ name: String) throws -> Bool {
        let state=try fixtureAppearanceState();defer { state.wipe() }
        let first="fixture-reader-one",second="fixture-reader-two",route="journey-one"
        let progress=try PlanetChildJourney.Progress(journeyId:route,journeyVersion:2,contentVersion:2,currentNodeId:nil,completedNodeIds:["node-one","node-two","archived-node"],selectedCountryId:nil,selectedWriterId:nil,selectedWorkId:nil,lastSafeRoute:"journey")
        state.sdkAppearance=true;state.sdkJourney=true;state.journeys[first]=JourneyEntry(revision:7,activeJourneyId:route,progress:[route:progress]);state.journeys[second]=JourneyEntry(revision:11,activeJourneyId:route,progress:[route:progress])
        var legacy=try encode(state);defer { legacy.resetBytes(in:0..<legacy.count) }
        if name=="legacy" {
            let decoded=try decode(legacy);defer { decoded.wipe() };var exact=try encode(decoded);defer { exact.resetBytes(in:0..<exact.count) }
            try require(exact==legacy && !decoded.sdkPassport && decoded.passports.isEmpty && decoded.journeys[first]?.progress[route]?.completedNodeIds==["node-one","node-two","archived-node"]);return true
        }
        var ledger=PlanetChildPassport.Ledger();try ledger.openCountry("country-one")
        try ledger.complete(PlanetChildPassport.Learning(journeyId:route,nodeId:"node-one",kind:"writer",entityId:"writer-one",journeyVersion:2,contentVersion:2),nil)
        try ledger.complete(PlanetChildPassport.Learning(journeyId:route,nodeId:"node-two",kind:"work",entityId:"work-one",journeyVersion:2,contentVersion:2),PlanetChildPassport.CompletedJourney(journeyId:route,journeyVersion:2,contentVersion:2,nodeIds:["node-one","node-two"]))
        state.sdkPassport=true;state.passports[first]=PassportEntry(revision:5,ledger:ledger);state.passports[second]=PassportEntry(revision:13,ledger:ledger)
        state.appearances[first]=AppearanceEntry(revision:3,selection:try fixtureAppearanceSelection());state.appearances[second]=AppearanceEntry(revision:9,selection:try fixtureAppearanceSelection("two"))
        let scope=state.seals[first]!.scope,sibling=state.seals[second]!.scope
        func entry(_ purpose: Purpose,_ scope: Scope,_ id: String) throws -> String {
            let key=purpose == .history || purpose == .search ? scope.key(purpose):try scope.itemKey(purpose,kind:purpose == .cache ? "favorite":"offline-package",id:id)
            let parts=scope.tuple.components(separatedBy:"\n")
            let dto: [String:Any]=["schemaVersion":1,"namespace":"child","profileId":scope.profileId,"profileRevision":scope.profileRevision,"exactAge":scope.exactAge,"locale":scope.locale,"policyVersion":scope.policyVersion,"policyChecksum":scope.policyChecksum,"packageId":scope.packageId,"packageVersion":scope.packageVersion,"packageChecksum":scope.packageChecksum]
            _=parts
            let raw: [String:Any]=["schemaVersion":1,"scope":dto,purpose == .history || purpose == .search ? "references":"entries":[]]
            state.entries[purpose.rawValue+"\n"+key]=Stored(revision:7,value:try JSONSerialization.data(withJSONObject:raw,options:.sortedKeys));return purpose.rawValue+"\n"+key
        }
        // Existing envelope validators require a genuine content entry for cache/
        // offline. Owned partition mutation itself is exercised before encode.
        let history=try entry(.history,scope,"history"),siblingHistory=try entry(.history,sibling,"history")
        let favorite=try scope.itemKey(.cache,kind:"favorite",id:"favorite-one"),offline=try scope.itemKey(.offline,kind:"offline-package",id:"offline-one")
        state.entries["cache\n"+favorite]=Stored(revision:6,value:Data([1,2,3]));state.entries["offline\n"+offline]=Stored(revision:8,value:Data([4,5,6]))
        var next=retainedEntries(state);defer { for stored in next.values { var bytes=stored.value;bytes.resetBytes(in:0..<bytes.count) } }
        if name=="history" || name=="profile" {
            try removeChildData(state,&next,PlanetChildLocalV2RemovalTarget(profileId:first,scope:name))
            try require(next[history]==nil && next[siblingHistory]?.revision==7 && state.journeys[first]==nil && state.passports[first]==nil && state.journeys[second]?.revision==11 && state.passports[second]?.revision==13 && state.appearances[second]?.revision==9 && state.seals[second] != nil)
            if name=="history" { try require(next["cache\n"+favorite]?.value==Data([1,2,3]) && next["offline\n"+offline]?.value==Data([4,5,6]) && state.appearances[first]?.revision==3 && state.seals[first] != nil) }
            else { try require(next["cache\n"+favorite]==nil && next["offline\n"+offline]==nil && state.appearances[first]==nil && state.seals[first]==nil) }
            return true
        }
        state.entries.removeAll()
        if name=="migration" { try migrateJourney(state,[first:String(repeating:"a",count:64),second:String(repeating:"a",count:64)]);try migratePassport(state,[first:String(repeating:"a",count:64),second:String(repeating:"a",count:64)]) }
        if name=="capacity" {
            var values=[String:PlanetChildJourney.Progress]()
            for index in 0..<32 { let id="journey-"+String(index);values[id]=try PlanetChildJourney.Progress(journeyId:id,journeyVersion:2,contentVersion:2,currentNodeId:nil,completedNodeIds:(0..<64).map { "archived-"+String(index)+"-"+String($0) },selectedCountryId:nil,selectedWriterId:nil,selectedWorkId:nil,lastSafeRoute:"journey") }
            state.journeys[first]=JourneyEntry(revision:32,activeJourneyId:"journey-31",progress:values);state.passports[first]=PassportEntry(revision:9,ledger:PlanetChildPassport.Ledger())
        }
        var bytes=try encode(state);defer { bytes.resetBytes(in:0..<bytes.count) };let decoded=try decode(bytes);defer { decoded.wipe() };var exact=try encode(decoded);defer { exact.resetBytes(in:0..<exact.count) }
        try require(bytes==exact && decoded.passports[second]?.revision==13)
        if name=="capacity" { try require(decoded.journeys[first]?.progress.count==32 && decoded.journeys[first]!.progress.values.reduce(0,{ $0+$1.completedNodeIds.count })==2048);return true }
        if name=="corrupt" { var extra=bytes;defer { extra.resetBytes(in:0..<extra.count) };extra.append(0);var denied=false;do { let invalid=try decode(extra);invalid.wipe() } catch { denied=true };try require(denied);return true }
        try require(["isolation","migration"].contains(name) && decoded.passports[first]?.ledger==ledger && decoded.journeys[first]?.progress[route]?.completedNodeIds.last=="archived-node");return true
    }
    static func fixturePassportUnknown(runId: String) throws -> Bool {
        let store=try synthetic(runId:runId)
        let prepared=try store.locked { directory -> (LocalV2PassportCompletion,Data,String) in
            try store.existingOnly(directory);let file=try store.passportMarker(directory),bytes=Data(("LP-SOFTWARE-PASSPORT-COMPLETION\n"+runId+"\n").utf8)
            let hash=Self.digest(try Data(contentsOf:store.record(directory)));try store.exclusiveReceiptFile(file,bytes) {};try store.syncDirectory(directory)
            let receipt=LocalV2PassportCompletion(store,bytes);try require(try store.boundedFile(file,4096)==bytes);try require(Darwin.unlink(file.path)==0);try store.syncDirectory(directory);return (receipt,bytes,hash)
        }
        defer { prepared.0.close() };prepared.0.retainUnknown()
        return try store.locked { directory in var pending=try store.boundedFile(store.passportMarker(directory),4096);defer { pending.resetBytes(in:0..<pending.count) };try require(pending==prepared.1 && Self.digest(try Data(contentsOf:store.record(directory)))==prepared.2);var denied=false;do { try store.existingOnly(directory) } catch { denied=true };try require(denied);return true }
    }
}
#endif

#if DEBUG
extension PlanetChildDataStore {
    /** Observation only of the real protected receipt. No fixture signer,
     * birth/admission producer or plaintext profile leaves this native method. */
    static func fixtureProductionOrigin(profileId: String?,expectRedacted: Bool) throws -> Bool {
        let store=try localV2ExistingOnly()
        return try store.locked { directory in
            try store.existingOnly(directory);let birth=try store.knownBirth(directory)
            if !expectRedacted { return !birth.redacted && birth.profileId==profileId }
            guard birth.redacted,birth.profileId.isEmpty,birth.profileContentBinding.isEmpty else { return false }
            var encrypted=try store.boundedFile(store.knownBirthFile(directory),262144);defer { encrypted.resetBytes(in:0..<encrypted.count) }
            var plain=try AES.GCM.open(AES.GCM.SealedBox(combined:Data(encrypted.dropFirst())),using:store.key(create:false,directory:directory),authenticating:Data((store.identity+"\nLP-LOCAL-V2-KNOWN-BIRTH-v1").utf8));defer { plain.resetBytes(in:0..<plain.count) }
            let row=try object(JSONSerialization.jsonObject(with:plain),keys:["schemaVersion","kind","identity","nonce","emptyChecksum","claimChecksum","payload","signature","publicKey"])
            return row["profile"]==nil && row["before"]==nil && row["after"]==nil && row["profileId"]==nil
        }
    }
}
#endif
