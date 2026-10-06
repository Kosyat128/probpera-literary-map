import Foundation
import CoreFoundation
import Security
import CryptoKit
import Darwin

/** Constructor-owned private endpoint, deliberately unregistered with App or
 * Capacitor. Its tokens refer only to this store's native data lease. They do
 * not grant PIN, host-current, profile/package review, rights or child admission.
 * The supplying native constructor must exclusively transfer the store here.
 * An outer bridge may pass typed JSON-safe dictionaries, never raw wrapper JSON.
 * A durable error is unknown acknowledgement, never rollback. Completed denials
 * retain a live partition for native readback/retry; late/cancelled work seals it.
 */
final class PlanetChildDataTransport {
    typealias Reply = ([String: Any]) -> Void
    private typealias Store = PlanetChildDataStore
    private static let maxSafe: UInt64 = 9007199254740991
    private static let scopeKeys: Set<String> = ["schemaVersion", "namespace", "profileId", "profileRevision", "exactAge", "locale", "policyVersion", "policyChecksum", "packageId", "packageVersion", "packageChecksum"]
    private static let bindingKeys: Set<String> = ["version", "requestId", "timeoutMs", "ownerToken", "leaseToken", "scope", "generation", "nonce"]
    private static let zeroId = String(repeating: "0", count: 32)
    private let store: Store, ownerToken: String
    private let condition = NSCondition()
    private var ownerRevealed = false, sealed = false, closeRunning = false
    private var closeSucceeded: Bool?, context: Context?, current: Job?, queuedClose: Close?
    // No eviction: at most 2048 data requests and one cancellation per request.
    // The single terminal close has a separately reserved ID even at exhaustion.
    private var seen = Set<String>(), cancelledTargets = Set<String>(), dataRequests = 0, terminalCloseId: String?

    private struct Context {
        let lease: Store.Lease, scope: Store.Scope, leaseToken: String
    }
    private struct Write {
        let purpose: Store.Purpose, key: String, revision: UInt64, encoded: String, checksum: String
    }
    private final class Job {
        let id: String, deadline: UInt64, reply: Reply
        var thread: Thread?, cancellation: Store.Cancellation?
        var cancelled = false, cancelStarted = false, cancelPending = false, bodyDone = false
        init(id: String, deadline: UInt64, reply: @escaping Reply) { self.id = id; self.deadline = deadline; self.reply = reply }
    }
    private struct Close { let id: String, reply: Reply }

    init(store: PlanetChildDataStore) throws {
        self.store = store; ownerToken = try Self.token()
    }

    private static func require(_ value: Bool) throws { if !value { throw Store.Failure.unavailable } }
    private static func object(_ value: Any, keys: Set<String>) throws -> [String: Any] {
        guard let row = value as? [String: Any], row.count == keys.count, Set(row.keys) == keys else { throw Store.Failure.unavailable }; return row
    }
    private static func text(_ value: Any?, maximum: Int) throws -> String {
        guard let value = value as? String, value.utf8.count <= maximum else { throw Store.Failure.unavailable }; return value
    }
    private static func integer(_ value: Any?, minimum: UInt64, maximum: UInt64) throws -> UInt64 {
        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { throw Store.Failure.unavailable }
        let value = number.doubleValue
        try require(value.isFinite && value.rounded(.towardZero) == value && value >= Double(minimum) && value <= Double(maximum))
        return UInt64(value)
    }
    private static func hex(_ value: Any?, bytes: Int) throws -> String {
        let value = try text(value, maximum: bytes * 2)
        try require(value.utf8.count == bytes * 2 && value.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }); return value
    }
    private static func token() throws -> String {
        var bytes = Data(count: 16); defer { bytes.resetBytes(in: 0..<bytes.count) }
        let result = bytes.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, $0.count, $0.baseAddress!) }
        try require(result == errSecSuccess); return bytes.map { String(format: "%02x", $0) }.joined()
    }
    private static func now() throws -> UInt64 {
        try Store.partitionNowMs()
    }
    private static func header(_ request: [String: Any], keys: Set<String>) throws -> (String, UInt64) {
        _ = try object(request, keys: keys); _ = try integer(request["version"], minimum: 1, maximum: 1)
        let id = try hex(request["requestId"], bytes: 16), budget = try integer(request["timeoutMs"], minimum: 1, maximum: 60000)
        let started = try now(); try require(started <= maxSafe - budget); return (id, started + budget)
    }
    private static func idOrZero(_ request: [String: Any]) -> String { (try? hex(request["requestId"], bytes: 16)) ?? zeroId }
    private static func unavailable(_ id: String) -> [String: Any] { ["version": 1, "requestId": id, "status": "unavailable"] }
    private static func scope(_ raw: Any?) throws -> Store.Scope {
        guard let raw = raw else { throw Store.Failure.unavailable }; let row = try object(raw, keys: scopeKeys)
        _ = try integer(row["schemaVersion"], minimum: 1, maximum: 1); try require(try text(row["namespace"], maximum: 5) == "child")
        return try Store.Scope(profileId: text(row["profileId"], maximum: 96), profileRevision: integer(row["profileRevision"], minimum: 1, maximum: maxSafe),
            exactAge: Int(integer(row["exactAge"], minimum: 3, maximum: 17)), locale: text(row["locale"], maximum: 2),
            policyVersion: text(row["policyVersion"], maximum: 96), policyChecksum: hex(row["policyChecksum"], bytes: 32),
            packageId: text(row["packageId"], maximum: 96), packageVersion: integer(row["packageVersion"], minimum: 1, maximum: maxSafe), packageChecksum: hex(row["packageChecksum"], bytes: 32))
    }
    private static func scopeDTO(_ scope: Store.Scope) -> [String: Any] {
        ["schemaVersion": 1, "namespace": "child", "profileId": scope.profileId, "profileRevision": scope.profileRevision, "exactAge": scope.exactAge,
         "locale": scope.locale, "policyVersion": scope.policyVersion, "policyChecksum": scope.policyChecksum, "packageId": scope.packageId,
         "packageVersion": scope.packageVersion, "packageChecksum": scope.packageChecksum]
    }
    private static func sameScope(_ a: Store.Scope, _ b: Store.Scope) -> Bool {
        a.profileId == b.profileId && a.profileRevision == b.profileRevision && a.exactAge == b.exactAge && a.locale == b.locale &&
        a.policyVersion == b.policyVersion && a.policyChecksum == b.policyChecksum && a.packageId == b.packageId &&
        a.packageVersion == b.packageVersion && a.packageChecksum == b.packageChecksum
    }
    private func ownerMatches(_ raw: Any?) -> Bool {
        if raw is NSNull { return !ownerRevealed }
        return (try? Self.hex(raw, bytes: 16)) == ownerToken
    }
    private func boundContext(_ request: [String: Any]) throws -> Context {
        let scope = try Self.scope(request["scope"]), owner = try Self.hex(request["ownerToken"], bytes: 16)
        let leaseToken = try Self.hex(request["leaseToken"], bytes: 16), generation = try Self.integer(request["generation"], minimum: 1, maximum: Self.maxSafe - 1)
        let nonce = try Self.hex(request["nonce"], bytes: 16)
        condition.lock(); defer { condition.unlock() }
        guard !sealed, ownerRevealed, owner == ownerToken, let context = context else { throw Store.Failure.unavailable }
        try Self.require(context.leaseToken == leaseToken && context.lease.partitionGeneration == generation && context.lease.partitionNonce == nonce && Self.sameScope(context.scope, scope)); return context
    }
    private func binding(_ context: Context, id: String, status: String) -> [String: Any] {
        ["version": 1, "requestId": id, "status": status, "ownerToken": ownerToken, "leaseToken": context.leaseToken,
         "scope": Self.scopeDTO(context.scope), "generation": context.lease.partitionGeneration, "nonce": context.lease.partitionNonce]
    }
    private func remaining(_ job: Job) throws -> UInt64 {
        let now = try Self.now(); condition.lock(); let allowed = current === job && !sealed && !job.cancelled; condition.unlock()
        try Self.require(allowed && !Thread.current.isCancelled && now < job.deadline); return job.deadline - now
    }
    private func submit(id: String, deadline: UInt64, owner: Any?, reply: @escaping Reply, work: @escaping (Job) throws -> [String: Any]) {
        condition.lock()
        guard !sealed, current == nil, ownerMatches(owner), !seen.contains(id), !cancelledTargets.contains(id), seen.count < 4096, dataRequests < 2048 else {
            let exhausted = seen.count >= 4096 || dataRequests >= 2048
            let job = exhausted ? current : nil, token = job.flatMap { cancelJobLocked($0) }
            if exhausted { sealed = true }; condition.unlock()
            if let job = job, let token = token { cancelStore(token, job: job) }
            if exhausted { drainClose() }; reply(Self.unavailable(id)); return
        }
        seen.insert(id); dataRequests += 1
        let job = Job(id: id, deadline: deadline, reply: reply); current = job
        // A dedicated Thread permits actual native Thread cancellation without
        // contaminating a shared DispatchQueue worker's sticky cancelled state.
        let thread = Thread {
            var response = Self.unavailable(id)
            do { _ = try self.remaining(job); response = try work(job); _ = try self.remaining(job) } catch {}
            self.condition.lock(); job.bodyDone = true; self.condition.unlock()
            // Cleanup uses an uncancelled thread and waits for the actual cancel
            // side-call. The original reply never acknowledges an unfinished job.
            Thread { self.finish(job, response: response) }.start()
        }
        job.thread = thread; condition.unlock(); thread.start()
    }
    private func installCancellation(_ token: Store.Cancellation, job: Job) {
        condition.lock(); job.cancellation = token; let start = job.cancelled && !job.cancelStarted
        if start { job.cancelStarted = true; job.cancelPending = true }; condition.unlock()
        if start { cancelStore(token, job: job) }
    }
    private func cancelStore(_ token: Store.Cancellation, job: Job) {
        Thread {
            // cancel() takes the real store lock; Thread.cancel() also interrupts
            // the actual transaction checks while this call is waiting for it.
            try? self.store.cancel(token)
            self.condition.lock(); job.cancelPending = false; self.condition.broadcast(); self.condition.unlock()
        }.start()
    }
    private func cancelJobLocked(_ job: Job) -> Store.Cancellation? {
        job.cancelled = true; job.thread?.cancel()
        if !job.bodyDone, let token = job.cancellation, !job.cancelStarted { job.cancelStarted = true; job.cancelPending = true; return token }; return nil
    }
    private func finish(_ job: Job, response proposed: [String: Any]) {
        condition.lock(); while job.cancelPending { condition.wait() }
        let now = try? Self.now(), success = ["partitioned", "committed", "retired"].contains((proposed["status"] as? String) ?? "")
        let boundaryValid = current === job && !sealed && !job.cancelled && now != nil && now! < job.deadline
        let publish = boundaryValid && success
        if !boundaryValid { sealed = true }; condition.unlock()
        var response = proposed
        if !boundaryValid {
            // activate/retire do not offer atomic cancellation in the store.
            // Retire any late-created lease through actual owner close, and deny
            // every later operation. Durable commit errors remain unknown ACKs.
            do { try store.close(); condition.lock(); closeSucceeded = true; context = nil; condition.unlock() }
            catch { condition.lock(); closeSucceeded = false; condition.unlock() }
            response = Self.unavailable(job.id)
        }
        // This native response decision is ordered before subsequent close.
        // It is not an atomic host-current/App render fence.
        condition.lock()
        if publish && response["status"] as? String == "partitioned" { ownerRevealed = true }
        while job.cancelPending { condition.wait() }
        if current === job { current = nil }; job.thread = nil; job.cancellation = nil; condition.unlock()
        job.reply(response); drainClose()
    }

    func activate(_ request: [String: Any], reply: @escaping Reply) {
        do {
            let header = try Self.header(request, keys: ["version", "requestId", "timeoutMs", "ownerToken", "scope"]), scope = try Self.scope(request["scope"])
            submit(id: header.0, deadline: header.1, owner: request["ownerToken"], reply: reply) { job in
                _ = try self.remaining(job); let lease = try self.store.activate(scope)
                let context = Context(lease: lease, scope: scope, leaseToken: try Self.token()); _ = try self.remaining(job)
                _ = try self.store.operationUntil(lease, deadlineMs: job.deadline)
                self.condition.lock(); self.context = context; self.condition.unlock()
                return self.binding(context, id: job.id, status: "partitioned")
            }
        } catch { reply(Self.unavailable(Self.idOrZero(request))) }
    }
    private static func readKeys(_ value: Any?) throws -> [Store.ReadKey] {
        guard let rows = value as? [Any], rows.count <= Store.maxBatch else { throw Store.Failure.unavailable }
        var result: [Store.ReadKey] = [], seen = Set<String>()
        for raw in rows {
            let row = try object(raw, keys: ["purpose", "key"]), key = try text(row["key"], maximum: 4096)
            guard let purpose = Store.Purpose(rawValue: try text(row["purpose"], maximum: 7)) else { throw Store.Failure.unavailable }
            try require(!key.isEmpty && seen.insert(purpose.rawValue + "\n" + key).inserted); result.append(Store.ReadKey(purpose: purpose, key: key))
        }; return result
    }
    private static func writes(_ value: Any?) throws -> [Write] {
        guard let rows = value as? [Any], rows.count <= Store.maxBatch else { throw Store.Failure.unavailable }
        var result: [Write] = [], seen = Set<String>(), total = 0
        for raw in rows {
            let row = try object(raw, keys: ["purpose", "key", "expectedRevision", "base64", "checksum"]), key = try text(row["key"], maximum: 4096)
            guard let purpose = Store.Purpose(rawValue: try text(row["purpose"], maximum: 7)) else { throw Store.Failure.unavailable }
            try require(!key.isEmpty && seen.insert(purpose.rawValue + "\n" + key).inserted)
            let encoded = try text(row["base64"], maximum: ((Store.maxValueBytes + 2) / 3) * 4), size = try decodedSize(encoded)
            try require(size <= Store.maxSnapshotBytes - total); total += size
            result.append(Write(purpose: purpose, key: key, revision: try integer(row["expectedRevision"], minimum: 0, maximum: maxSafe - 2),
                encoded: encoded, checksum: try hex(row["checksum"], bytes: 32)))
        }; return result
    }
    private static func decodedSize(_ encoded: String) throws -> Int {
        let count = encoded.utf8.count; try require(count > 0 && count % 4 == 0 && count <= ((Store.maxValueBytes + 2) / 3) * 4)
        var padding = 0, lastSextet: UInt8 = 0
        for (index, byte) in encoded.utf8.enumerated() {
            if byte == 61 { padding += 1; try require(index >= count - 2 && padding <= 2) }
            else {
                try require(padding == 0)
                if (65...90).contains(byte) { lastSextet = byte - 65 }
                else if (97...122).contains(byte) { lastSextet = byte - 97 + 26 }
                else if (48...57).contains(byte) { lastSextet = byte - 48 + 52 }
                else if byte == 43 { lastSextet = 62 }
                else if byte == 47 { lastSextet = 63 }
                else { throw Store.Failure.unavailable }
            }
        }
        try require(padding != 2 || lastSextet & 15 == 0); try require(padding != 1 || lastSextet & 3 == 0)
        let decoded = (count / 4) * 3 - padding; try require(decoded > 0 && decoded <= Store.maxValueBytes); return decoded
    }
    func transact(_ request: [String: Any], reply: @escaping Reply) {
        do {
            let header = try Self.header(request, keys: Self.bindingKeys.union(["reads", "writes"])), context = try boundContext(request)
            let reads = try Self.readKeys(request["reads"]), writes = try Self.writes(request["writes"])
            try Self.require(reads.count + writes.count > 0 && reads.count + writes.count <= Store.maxBatch)
            submit(id: header.0, deadline: header.1, owner: request["ownerToken"], reply: reply) { job in
                var total = 0, lengths: [Int] = []
                for write in writes { _ = try self.remaining(job); let size = try Self.decodedSize(write.encoded); try Self.require(size <= Store.maxSnapshotBytes - total); total += size; lengths.append(size) }
                var mutations: [Store.Mutation] = []; defer { mutations.forEach { $0.dispose() } }
                for (index, write) in writes.enumerated() {
                    _ = try self.remaining(job)
                    guard var bytes = Data(base64Encoded: write.encoded, options: []) else { throw Store.Failure.unavailable }
                    defer { bytes.resetBytes(in: 0..<bytes.count) }
                    try Self.require(bytes.count == lengths[index] && bytes.base64EncodedString() == write.encoded && Self.digest(bytes) == write.checksum)
                    mutations.append(try Store.Mutation(purpose: write.purpose, key: write.key, expectedRevision: write.revision, value: bytes))
                }
                _ = try self.remaining(job)
                let cancellation = try self.store.operationUntil(context.lease, deadlineMs: job.deadline); self.installCancellation(cancellation, job: job)
                _ = try self.remaining(job)
                let result = try self.store.transact(context.lease, reads: reads, writes: mutations, cancellation: cancellation); defer { result.dispose() }
                var slots: [[String: Any]] = [], copied = 0
                for read in reads {
                    _ = try self.remaining(job); guard let slot = result.get(read.purpose, key: read.key) else { throw Store.Failure.unavailable }
                    var bytes = try slot.copyValue(); defer { if bytes != nil { let count = bytes!.count; bytes!.resetBytes(in: 0..<count) } }
                    var row: [String: Any] = ["purpose": read.purpose.rawValue, "key": read.key, "revision": slot.revision, "base64": NSNull(), "checksum": NSNull()]
                    if let value = bytes {
                        try Self.require(value.count <= Store.maxSnapshotBytes - copied && value.count <= Store.maxValueBytes && !value.isEmpty && slot.revision > 0)
                        copied += value.count; let checksum = Self.digest(value); try Self.require(checksum == slot.checksum)
                        row["base64"] = value.base64EncodedString(); row["checksum"] = checksum
                    } else { try Self.require(slot.revision == 0 && slot.checksum == nil) }; slots.append(row)
                }
                // Actual native lease reread follows response copying/encoding.
                _ = try self.store.operationUntil(context.lease, deadlineMs: job.deadline); _ = try self.remaining(job)
                var response = self.binding(context, id: job.id, status: "committed"); response["slots"] = slots; return response
            }
        } catch { reply(Self.unavailable(Self.idOrZero(request))) }
    }
    private static func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    func retire(_ request: [String: Any], reply: @escaping Reply) {
        do {
            let header = try Self.header(request, keys: Self.bindingKeys), context = try boundContext(request)
            submit(id: header.0, deadline: header.1, owner: request["ownerToken"], reply: reply) { job in
                _ = try self.remaining(job); try self.store.retire(context.lease); _ = try self.remaining(job)
                self.condition.lock(); self.context = nil; self.condition.unlock(); return self.binding(context, id: job.id, status: "retired")
            }
        } catch { reply(Self.unavailable(Self.idOrZero(request))) }
    }
    func cancel(_ request: [String: Any], reply: @escaping Reply) {
        do {
            _ = try Self.object(request, keys: ["version", "requestId", "targetRequestId"]); _ = try Self.integer(request["version"], minimum: 1, maximum: 1)
            let id = try Self.hex(request["requestId"], bytes: 16), target = try Self.hex(request["targetRequestId"], bytes: 16)
            condition.lock()
            guard !seen.contains(id), terminalCloseId != id, seen.count < 4096, cancelledTargets.contains(target) || cancelledTargets.count < 2048 else {
                let exhausted = seen.count >= 4096 || (!cancelledTargets.contains(target) && cancelledTargets.count >= 2048)
                let job = exhausted ? current : nil, token = job.flatMap { cancelJobLocked($0) }
                if exhausted { sealed = true }; condition.unlock()
                if let job = job, let token = token { cancelStore(token, job: job) }
                if exhausted { drainClose() }; reply(Self.unavailable(id)); return
            }
            seen.insert(id); cancelledTargets.insert(target)
            let job = current?.id == target ? current : nil, token = job.flatMap { cancelJobLocked($0) }
            condition.unlock(); if let job = job, let token = token { cancelStore(token, job: job) }
            reply(["version": 1, "requestId": id, "status": "cancellation-requested", "targetRequestId": target])
        } catch { reply(Self.unavailable(Self.idOrZero(request))) }
    }
    func close(_ request: [String: Any], reply: @escaping Reply) {
        do {
            // The budget constrains receipt/validation, not factual completion
            // ACK. A late closed reply only proves actual native cleanup finished.
            let header = try Self.header(request, keys: ["version", "requestId", "timeoutMs", "ownerToken"])
            condition.lock()
            // A lost/malformed first activation reply leaves JS with no owner
            // token. Null can only close this constructor-owned native instance;
            // it cannot activate or operate any partition or another owner.
            let owned = request["ownerToken"] is NSNull || ownerMatches(request["ownerToken"])
            guard terminalCloseId == nil, !seen.contains(header.0), owned else { condition.unlock(); reply(Self.unavailable(header.0)); return }
            terminalCloseId = header.0; sealed = true; queuedClose = Close(id: header.0, reply: reply)
            let job = current; let token: Store.Cancellation? = job.flatMap { cancelJobLocked($0) }; condition.unlock()
            if let job = job, let token = token { cancelStore(token, job: job) }; drainClose()
        } catch { reply(Self.unavailable(Self.idOrZero(request))) }
    }
    private func drainClose() {
        condition.lock(); guard sealed, current == nil, !closeRunning, queuedClose != nil || closeSucceeded == nil else { condition.unlock(); return }
        closeRunning = true; condition.unlock()
        Thread {
            self.condition.lock(); let prior = self.closeSucceeded; self.condition.unlock()
            var success = prior == true
            // A failed durable close is unknown; do not turn a later no-op close
            // into evidence that the earlier lease retirement was committed.
            if prior == nil { do { try self.store.close(); success = true } catch {} }
            self.condition.lock(); self.closeSucceeded = success; self.context = nil
            let request = self.queuedClose; self.queuedClose = nil; self.closeRunning = false; self.condition.unlock()
            if let request = request { request.reply(success ? ["version": 1, "requestId": request.id, "status": "closed", "ownerToken": self.ownerToken] : Self.unavailable(request.id)) }
        }.start()
    }
}


/** Version 2 bridge data only. Opaque tokens correlate a retained native owner;
 * parsed dictionaries never supply PIN, clock, profile UID or package authority. */
enum PlanetChildLocalV2Wire {
    enum Failure: Error { case invalid }
    static let methods = Set(["bootstrap","readContext","perform","retire","readEntity","search","readCollection","writeCollection","listMedia","presentMedia","releaseMedia","listScenes","openScene","releaseScene","acquireWebResource","releaseWebResource","readSceneSelection","rememberSceneSelection","restoreSceneSelection","listJourneys","readJourneyProgress","openJourney","advanceJourney","closeJourney","listDiscovery","readPassport","recordCountryOpen","saveJourneyRoute","readJourneyRouteDownload","resumeJourneyRoute","cancelJourneyRoute"])
    static let gateActions = Set(["exit-child-mode","switch-adult-profile","change-exact-age","change-blocked-topics","open-adult-store","initiate-purchase","restore-purchases","open-external","share","account-change","export-child-data","delete-child-data","diagnostics","expand-access-settings","enable-licensed-pack","view-legal-commercial"])
    static let actions = gateActions.union(["first-install","enroll-pin","replace-pin","recover-pin","create-profile","enter-child"])
    static let collections = Set(["favorites","recent","offline"])
    struct Request {
        let method: String, id: String, token: String?, action: String?, target: Data?
        let reference: [String:Any]?, query: String?, collection: String?, expectedRevision: UInt64?, references: [[String:Any]]?
        let mediaOwner: [String:Any]?,assetId: String?,mediaLayout: PlanetChildLocalV2MediaLayout?,presentationToken: String?
        let sceneId: String?,sceneToken: String?,slotId: String?,resourceToken: String?
        let journeyId: String?,currentNodeId: String?,shelf: String?
        init(method: String,id: String,token: String?,action: String?,target: Data?,reference: [String:Any]?,query: String?,collection: String?,expectedRevision: UInt64?,references: [[String:Any]]?,mediaOwner: [String:Any]?,assetId: String?,mediaLayout: PlanetChildLocalV2MediaLayout?,presentationToken: String?,sceneId: String?=nil,sceneToken: String?=nil,slotId: String?=nil,resourceToken: String?=nil,journeyId: String?=nil,currentNodeId: String?=nil,shelf: String?=nil) {
            self.method=method;self.id=id;self.token=token;self.action=action;self.target=target;self.reference=reference;self.query=query;self.collection=collection;self.expectedRevision=expectedRevision;self.references=references;self.mediaOwner=mediaOwner;self.assetId=assetId;self.mediaLayout=mediaLayout;self.presentationToken=presentationToken;self.sceneId=sceneId;self.sceneToken=sceneToken;self.slotId=slotId;self.resourceToken=resourceToken;self.journeyId=journeyId;self.currentNodeId=currentNodeId;self.shelf=shelf
        }
    }
    static func require(_ condition: Bool) throws { if !condition { throw Failure.invalid } }
    static func hex(_ value: Any?, count: Int) throws -> String { guard let value=value as? String,value.utf8.count==count,value.range(of:"\\A[a-f0-9]+\\z",options:.regularExpression) != nil else { throw Failure.invalid };return value }
    static func integer(_ value: Any?, minimum: UInt64=0, maximum: UInt64=9007199254740991) throws -> UInt64 {
        guard let n=value as? NSNumber,CFGetTypeID(n) != CFBooleanGetTypeID(),n.doubleValue.isFinite,!(n.doubleValue==0 && n.doubleValue.sign == .minus),n.doubleValue.rounded(.towardZero)==n.doubleValue,n.doubleValue>=Double(minimum),n.doubleValue<=Double(maximum) else { throw Failure.invalid };return n.uint64Value
    }
    static func ref(_ value: Any?) throws -> [String:Any] {
        guard let row=value as? [String:Any],Set(row.keys)==Set(["kind","id","contentChecksum"]),let kind=row["kind"] as? String,let id=row["id"] as? String,
            ["country","writer","biography","work","character","storyworld","fact","quote","activity","quiz","search-result","recommendation","favorite","recent","offline-package","deep-link"].contains(kind),id.range(of:"\\A[A-Za-z0-9][A-Za-z0-9._-]{0,95}\\z",options:.regularExpression) != nil else { throw Failure.invalid }
        _ = try hex(row["contentChecksum"],count:64);return row
    }
    static func decode(_ method: String,_ input: [String:Any]) throws -> Request {
        try require(methods.contains(method));var keys=Set(["version","requestId"])
        if method != "bootstrap" { keys.insert("contextToken") }
        switch method { case "perform":keys.formUnion(["action","target"]);case "readEntity","recordCountryOpen":keys.insert("reference");case "listDiscovery":keys.insert("shelf");case "search":keys.insert("query");case "readCollection":keys.insert("collection");case "writeCollection":keys.formUnion(["collection","expectedRevision","references"]);case "listMedia":keys.insert("owner");case "presentMedia":keys.formUnion(["owner","assetId","layout"]);case "releaseMedia":keys.insert("presentationToken");case "listScenes":keys.insert("owner");case "openScene":keys.formUnion(["owner","sceneId"]);case "releaseScene":keys.insert("sceneToken");case "acquireWebResource":keys.formUnion(["sceneToken","slotId"]);case "releaseWebResource":keys.insert("resourceToken");case "rememberSceneSelection":keys.formUnion(["sceneToken","expectedRevision"]);case "restoreSceneSelection":keys.insert("expectedRevision");case "openJourney","saveJourneyRoute","resumeJourneyRoute","cancelJourneyRoute":keys.formUnion(["journeyId","expectedRevision"]);case "readJourneyRouteDownload":keys.insert("journeyId");case "advanceJourney":keys.formUnion(["journeyId","expectedRevision","currentNodeId","action"]);default:break }
        try require(Set(input.keys)==keys);_ = try integer(input["version"],minimum:2,maximum:2);let id=try hex(input["requestId"],count:32)
        let token: String?;if method=="bootstrap" || (method=="perform" || method=="retire") && input["contextToken"] is NSNull { token=nil } else { token=try hex(input["contextToken"],count:32) }
        var action: String?,target: Data?,reference: [String:Any]?,query: String?,collection: String?,revision: UInt64?,references: [[String:Any]]?
        if method=="perform" {
            guard let name=input["action"] as? String,actions.contains(name) else { throw Failure.invalid };action=name
            if !(input["target"] is NSNull) { guard let draft=input["target"],JSONSerialization.isValidJSONObject(draft) else { throw Failure.invalid };let bytes=try JSONSerialization.data(withJSONObject:draft,options:[.sortedKeys,.withoutEscapingSlashes]);try require(bytes.count<=65536);target=Data(Array(bytes)) }
            if name=="first-install" { try require(token==nil && target==nil) } else { try require(token != nil) }
            if ["enroll-pin","replace-pin","recover-pin"].contains(name) { try require(target==nil) }
            if name=="delete-child-data" { guard let target else { throw Failure.invalid };let raw=try JSONSerialization.jsonObject(with:target);guard let row=raw as? [String:Any],Set(row.keys)==Set(["profileId","scope"]),let profile=row["profileId"] as? String,profile.range(of:#"\A[A-Za-z0-9][A-Za-z0-9._-]{0,95}\z"#,options:.regularExpression) != nil,let scope=row["scope"] as? String,["history","profile","downloads"].contains(scope) else { throw Failure.invalid } }
        }
        if method=="readEntity" || method=="recordCountryOpen" { reference=try ref(input["reference"]);if method=="recordCountryOpen" { try require(reference?["kind"] as? String=="country") } }
        var shelf: String?;if method=="listDiscovery" { guard let value=input["shelf"] as? String,["writers","books","collections"].contains(value) else { throw Failure.invalid };shelf=value }
        if method=="search" { guard let text=input["query"] as? String,text.utf16.count<=120,text.range(of:"[\\x00-\\x1f\\x7f]",options:.regularExpression)==nil else { throw Failure.invalid };query=text }
        if method=="readCollection" || method=="writeCollection" { guard let name=input["collection"] as? String,collections.contains(name) else { throw Failure.invalid };collection=name }
        if method=="writeCollection" { revision=try integer(input["expectedRevision"]);guard let values=input["references"] as? [Any],values.count<=64 else { throw Failure.invalid };references=try values.map(ref);let identities=references!.map { ($0["kind"] as! String)+"/"+($0["id"] as! String) };try require(Set(identities).count==identities.count) }
        var mediaOwner: [String:Any]?,assetId: String?,layout: PlanetChildLocalV2MediaLayout?,presentationToken: String?
        if ["listMedia","presentMedia","listScenes","openScene"].contains(method) { mediaOwner=try ref(input["owner"]) }
        if method=="presentMedia" { guard let asset=input["assetId"] as? String,asset.range(of:"\\A[A-Za-z0-9][A-Za-z0-9._-]{0,95}\\z",options:.regularExpression) != nil else { throw Failure.invalid };assetId=asset;layout=try PlanetChildLocalV2MediaLayout.decode(input["layout"]) }
        if method=="releaseMedia",!(input["presentationToken"] is NSNull) { presentationToken=try hex(input["presentationToken"],count:32) }
        var sceneId: String?,sceneToken: String?,slotId: String?,resourceToken: String?
        if method=="openScene" { guard let id=input["sceneId"] as? String,id.range(of:"\\A[A-Za-z0-9][A-Za-z0-9._-]{0,95}\\z",options:.regularExpression) != nil else { throw Failure.invalid };sceneId=id }
        if method=="releaseScene",!(input["sceneToken"] is NSNull) { sceneToken=try hex(input["sceneToken"],count:32) }
        if method=="rememberSceneSelection" { sceneToken=try hex(input["sceneToken"],count:32);revision=try integer(input["expectedRevision"],maximum:9007199254740989) }
        if method=="restoreSceneSelection" { revision=try integer(input["expectedRevision"],maximum:9007199254740990) }
        if method=="acquireWebResource" { sceneToken=try hex(input["sceneToken"],count:32);guard let slot=input["slotId"] as? String,["skin","stand","background"].contains(slot) else { throw Failure.invalid };slotId=slot }
        if method=="releaseWebResource",!(input["resourceToken"] is NSNull) { resourceToken=try hex(input["resourceToken"],count:32) }
        var journeyId: String?,currentNodeId: String?
        if method=="openJourney" || method=="advanceJourney" || ["saveJourneyRoute","resumeJourneyRoute","cancelJourneyRoute","readJourneyRouteDownload"].contains(method) { guard let value=input["journeyId"] as? String else { throw Failure.invalid };journeyId=try PlanetChildJourney.identifier(value);if method != "readJourneyRouteDownload" { revision=try integer(input["expectedRevision"],maximum:method=="openJourney" ? 9007199254740990:9007199254740989) } }
        if method=="advanceJourney" { guard let value=input["action"] as? String,["complete","restart"].contains(value) else { throw Failure.invalid };action=value
            if !(input["currentNodeId"] is NSNull) { guard let node=input["currentNodeId"] as? String else { throw Failure.invalid };currentNodeId=try PlanetChildJourney.identifier(node) };try require(value=="restart" || currentNodeId != nil)
        }
        return Request(method:method,id:id,token:token,action:action,target:target,reference:reference,query:query,collection:collection,expectedRevision:revision,references:references,mediaOwner:mediaOwner,assetId:assetId,mediaLayout:layout,presentationToken:presentationToken,sceneId:sceneId,sceneToken:sceneToken,slotId:slotId,resourceToken:resourceToken,journeyId:journeyId,currentNodeId:currentNodeId,shelf:shelf)
    }
}

/** Actual V2 dispatcher retains the SDK owner; the v1 structural data endpoint
 * above remains separate and supplies no authority to this endpoint. */
final class PlanetChildLocalV2DataTransport {
    typealias Reply = ([String:Any]) -> Void
    private let owner: PlanetChildLocalV2SDKOwner
    init(owner: PlanetChildLocalV2SDKOwner) { self.owner=owner }
    func invoke(_ method: String,_ input: [String:Any],reply: @escaping Reply) {
        do { let captured=try PlanetChildLocalV2Wire.decode(method,input);owner.execute(captured,reply:reply) }
        catch { owner.malformed(method,input,reply:reply) }
    }
    func routeWillChange() { owner.routeWillChange() }
}

extension PlanetChildLocalV2Wire {
    static func refusal(_ method: String,_ input: [String:Any],reason: String,generation: UInt64=0) -> [String:Any] {
        let id=(try? hex(input["requestId"],count:32)) ?? String(repeating:"0",count:32),token=(try? hex(input["contextToken"],count:32))
        if method=="retire" { return ["version":2,"requestId":id,"status":"unavailable","contextToken":token as Any? ?? NSNull()] }
        if ["readEntity","search","readCollection","writeCollection","listMedia","presentMedia","releaseMedia","listScenes","openScene","releaseScene","acquireWebResource","releaseWebResource","readSceneSelection","rememberSceneSelection","restoreSceneSelection","listJourneys","readJourneyProgress","openJourney","advanceJourney","closeJourney","listDiscovery","readPassport","recordCountryOpen","saveJourneyRoute","readJourneyRouteDownload","resumeJourneyRoute","cancelJourneyRoute"].contains(method) { return ["version":2,"requestId":id,"status":"unavailable","contextToken":token ?? String(repeating:"0",count:32),"generation":generation,"value":NSNull()] }
        return ["version":2,"requestId":id,"status":"unavailable","reason":reason,"context":NSNull(),"profiles":[]]
    }
}
