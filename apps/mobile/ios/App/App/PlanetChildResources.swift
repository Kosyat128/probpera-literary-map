import Foundation
import Security
import CryptoKit

/** Fixed source descriptors are data, never authority. Only the Vault's
 * privately constructed original claim can enter this actual reader. */
struct PlanetChildLocalV2ResourceHTTPS {
    let url: URL, origin: String, keyChecksums: Set<String>
}
enum PlanetChildLocalV2ResourceError: Error { case refused, revoked, cleanupUnknown }
enum PlanetChildLocalV2ResourceRules {
    static func origin(_ raw: String) throws -> URL {
        guard raw.utf8.count <= 512, raw.range(of: "^https://[a-z0-9.-]+$", options: .regularExpression) != nil,
              let url = URL(string: raw), url.absoluteString == raw, url.scheme == "https",
              let host = url.host, host.utf8.count <= 253, url.port == nil,
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              url.path.isEmpty else { throw PlanetChildLocalV2ResourceError.refused }
        let labels = host.split(separator: ".", omittingEmptySubsequences: false)
        guard labels.count >= 2, host.range(of: "^[0-9.]+$", options: .regularExpression) == nil,
              !["localhost", "local", "internal", "lan", "home"].contains(String(labels.last!)),
              labels.allSatisfy({ $0.range(of: "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$", options: .regularExpression) != nil })
        else { throw PlanetChildLocalV2ResourceError.refused }
        return url
    }
    static func path(_ checksum: String, _ mime: String) throws -> String {
        guard checksum.utf8.count == 64, checksum.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
              let ext = ["image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "audio/wav": "wav"][mime]
        else { throw PlanetChildLocalV2ResourceError.refused }
        return "/objects/" + checksum + "." + ext
    }
    static func response(_ response: HTTPURLResponse, _ location: PlanetChildLocalV2ResourceHTTPS,
                         _ mime: String, _ bytes: Int) throws {
        guard response.url?.absoluteString == location.url.absoluteString, response.statusCode == 200,
              response.value(forHTTPHeaderField: "Content-Type") == mime,
              response.value(forHTTPHeaderField: "Content-Length") == String(bytes),
              response.expectedContentLength == Int64(bytes),
              response.value(forHTTPHeaderField: "Content-Encoding") == nil || response.value(forHTTPHeaderField: "Content-Encoding") == "identity",
              response.value(forHTTPHeaderField: "Content-Range") == nil else { throw PlanetChildLocalV2ResourceError.refused }
    }
    static func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    static func lifetime(_ deadline: UInt64,_ now: UInt64,_ wall: Int64,_ until: Int64) throws {
        guard now>0,now<deadline,deadline-now<=60000000000,wall>=0,wall<until else { throw PlanetChildLocalV2ResourceError.revoked }
    }
    static func encoded(_ data: Data, _ count: Int, _ checksum: String) throws {
        guard data.count == count, digest(data) == checksum else { throw PlanetChildLocalV2ResourceError.refused }
    }
}


/** Owns bounded encoded bytes until one transfer or definite retirement. This
 * storage object grants no media permission; the reader still requires its
 * original private claim at every acquisition and presentation boundary. */
final class PlanetChildLocalV2ResourceBuffer {
    private let limit: Int,lock=NSLock()
    private var bytes=Data(),closed=false
    init(_ limit: Int) { self.limit=limit }
    var count: Int { lock.lock();defer { lock.unlock() };return bytes.count }
    func append(_ chunk: Data) throws {
        lock.lock();defer { lock.unlock() }
        guard !closed,limit>0,limit<=33554432,chunk.count<=limit-bytes.count else { throw PlanetChildLocalV2ResourceError.refused };bytes.append(chunk)
    }
    func transfer(_ checksum: String) throws -> Data {
        lock.lock();defer { lock.unlock() };guard !closed else { throw PlanetChildLocalV2ResourceError.revoked }
        try PlanetChildLocalV2ResourceRules.encoded(bytes,limit,checksum)
        closed=true;let result=bytes;bytes.resetBytes(in:0..<bytes.count);bytes.removeAll(keepingCapacity:false);return result
    }
    func close() { lock.lock();defer { lock.unlock() };closed=true;bytes.resetBytes(in:0..<bytes.count);bytes.removeAll(keepingCapacity:false) }
}

/** Owns a single bounded acquisition. The original loader worker polls full
 * Root/profile checks while this serial delegate checks fast native revocation.
 * Invalidation and its final delegate callback are joined before bytes transfer.
 * No cookie, shared cache, ambient credential, redirect or caller URL is used. */
final class PlanetChildLocalV2ResourceReader: NSObject, URLSessionDataDelegate {
    private let claim: PlanetChildLocalV2ResourceClaim
    private let condition = NSCondition()
    private let delegates = OperationQueue()
    private var session: URLSession?, task: URLSessionDataTask?, bundleStream: InputStream?
    private let encoded: PlanetChildLocalV2ResourceBuffer
    private var started = false, cancelled = false, completed = false, invalidated = false, joined = false, transferred = false
    private var responseAccepted = false, trustAccepted = false, failure: Error?
    // Reservations precede dropping condition: cancellation/retirement cannot
    // report joined while a captured native task is still being resumed or cancelled.
    private var nativeCalls = 0
    init(_ claim: PlanetChildLocalV2ResourceClaim) {
        self.claim = claim;encoded=PlanetChildLocalV2ResourceBuffer(claim.bytes)
        super.init()
        delegates.name = "ru.probpera.literaryplanet.child.resource.delegate-v2"
        delegates.maxConcurrentOperationCount = 1
    }
    private func refuse(_ error: Error) {
        condition.lock(); if failure == nil { failure = error }; cancelled = true
        let owned = session, original = task, calls = session != nil || task != nil
        if calls { nativeCalls += 1 }; condition.broadcast(); condition.unlock()
        // The fixed regular-file stream belongs to its reader thread. Closing
        // InputStream concurrently with read/open is not a cancellation join.
        if calls {
            original?.cancel(); owned?.invalidateAndCancel()
            condition.lock(); nativeCalls -= 1; condition.broadcast(); condition.unlock()
        }
    }
    func cancel() { refuse(PlanetChildLocalV2ResourceError.revoked) }
    private func current() throws {
        condition.lock(); let denied = cancelled; condition.unlock()
        guard !denied else { throw PlanetChildLocalV2ResourceError.revoked }
        try claim.transportCurrent()
    }
    private func original(_ session: URLSession, _ task: URLSessionTask? = nil) throws {
        condition.lock(); let matches = self.session === session && (task == nil || self.task === task) && !joined
        condition.unlock(); guard matches else { throw PlanetChildLocalV2ResourceError.revoked }
        try current()
    }
    func read() throws -> Data {
        try claim.workerCurrent()
        condition.lock(); guard !started, !cancelled else { condition.unlock(); throw PlanetChildLocalV2ResourceError.revoked }
        started = true; condition.unlock()
        do {
            if let location = claim.https {
                let seconds = try claim.remainingSeconds()
                let configuration = URLSessionConfiguration.ephemeral
                configuration.urlCache = nil; configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
                configuration.httpCookieStorage = nil; configuration.httpShouldSetCookies = false
                configuration.urlCredentialStorage = nil; configuration.httpMaximumConnectionsPerHost = 1
                configuration.timeoutIntervalForRequest = seconds; configuration.timeoutIntervalForResource = seconds
                configuration.waitsForConnectivity = false; configuration.httpAdditionalHeaders = [:]
                var request = URLRequest(url: location.url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: seconds)
                request.httpMethod = "GET"; request.httpShouldHandleCookies = false
                request.setValue(claim.mime, forHTTPHeaderField: "Accept")
                request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
                condition.lock()
                guard !cancelled, !joined else { condition.unlock(); throw PlanetChildLocalV2ResourceError.revoked }
                let owned = URLSession(configuration: configuration, delegate: self, delegateQueue: delegates)
                let original = owned.dataTask(with: request)
                session = owned; task = original; invalidated = false; nativeCalls += 1; condition.unlock()
                original.resume()
                condition.lock(); nativeCalls -= 1; condition.broadcast(); condition.unlock()
                while true {
                    try claim.workerCurrent()
                    condition.lock(); let done = completed || failure != nil
                    if !done { _ = condition.wait(until: Date(timeIntervalSinceNow: 0.02)) }
                    condition.unlock(); if done { break }
                }
                condition.lock(); let error = failure; condition.unlock(); if let error { throw error }
            } else {
                var bytes = try readBundle(); defer { bytes.resetBytes(in: 0..<bytes.count) }
                try claim.workerCurrent(); condition.lock()
                guard !cancelled else { condition.unlock(); throw PlanetChildLocalV2ResourceError.revoked }
                do { try encoded.append(bytes) } catch { condition.unlock();throw error }
                completed = true; invalidated = true; condition.unlock()
            }
            try claim.workerCurrent(); try closeJoined(preserveEncoded: true); try claim.workerCurrent()
            condition.lock(); defer { condition.unlock() }
            guard !cancelled, completed, joined, !transferred, failure == nil else { throw PlanetChildLocalV2ResourceError.revoked }
            let result=try encoded.transfer(claim.checksum);transferred = true;return result
        } catch {
            let original = error; cancel()
            do { try closeJoined() } catch { throw PlanetChildLocalV2ResourceError.cleanupUnknown }
            throw original
        }
    }
    private func readBundle() throws -> Data {
        try claim.workerCurrent();let url=try claim.fixedBundleURL()
        guard let stream=InputStream(url:url) else { throw PlanetChildLocalV2ResourceError.refused }
        condition.lock();guard !cancelled,!joined else { condition.unlock();throw PlanetChildLocalV2ResourceError.revoked }
        bundleStream=stream;condition.unlock();stream.open()
        var bytes=[UInt8](repeating:0,count:claim.bytes),at=0
        defer { stream.close();condition.lock();bundleStream=nil;if session==nil && task==nil { invalidated=true };condition.broadcast();condition.unlock();bytes.withUnsafeMutableBytes { $0.initializeMemory(as:UInt8.self,repeating:0) } }
        while at<bytes.count {
            try current();try claim.workerCurrent()
            let count=bytes.withUnsafeMutableBufferPointer { stream.read($0.baseAddress!.advanced(by:at),maxLength:min(8192,bytes.count-at)) }
            guard count>0 else { throw PlanetChildLocalV2ResourceError.refused };at+=count
        }
        var extra: UInt8=0;guard stream.read(&extra,maxLength:1)==0 else { throw PlanetChildLocalV2ResourceError.refused }
        try current();try claim.workerCurrent();return Data(bytes)
    }
    /** Called outside Vault/DataStore locks. Unknown cleanup keeps the lane
     * sealed; completion is the actual final session/delegate join. */
    func closeJoined(preserveEncoded: Bool = false) throws {
        guard !Thread.isMainThread, OperationQueue.current !== delegates else { throw PlanetChildLocalV2ResourceError.cleanupUnknown }
        condition.lock()
        if joined { if !preserveEncoded { encoded.close() }; condition.unlock(); return }
        let owned = session, original = task, calls = session != nil || task != nil
        if calls { nativeCalls += 1 }
        if session == nil && task == nil && bundleStream == nil { completed = true; invalidated = true }
        condition.unlock()
        if calls {
            original?.cancel(); owned?.invalidateAndCancel()
            condition.lock(); nativeCalls -= 1; condition.broadcast(); condition.unlock()
        }
        let began = clock_gettime_nsec_np(CLOCK_MONOTONIC_RAW)
        condition.lock()
        // Final invalidation is delivered after the session's task callbacks.
        // Drain the actual serial delegate operations AND every reserved native
        // call under the same finite wait; an unknown result keeps the lane sealed.
        while !invalidated || bundleStream != nil || nativeCalls != 0 || delegates.operationCount != 0 {
            let now = clock_gettime_nsec_np(CLOCK_MONOTONIC_RAW)
            guard began > 0, now >= began, now - began < 5_000_000_000 else { condition.unlock(); throw PlanetChildLocalV2ResourceError.cleanupUnknown }
            _ = condition.wait(until: Date(timeIntervalSinceNow: 0.02))
        }
        task = nil; session = nil; joined = true
        if !preserveEncoded { encoded.close() }
        condition.unlock()
    }
    var knownClosed: Bool { condition.lock(); defer { condition.unlock() }; return joined && invalidated && nativeCalls == 0 && task == nil && session == nil && bundleStream == nil && delegates.operationCount == 0 }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil); refuse(PlanetChildLocalV2ResourceError.refused)
    }
    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        authenticate(session, nil, challenge, completionHandler)
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        authenticate(session, task, challenge, completionHandler)
    }
    private func authenticate(_ session: URLSession, _ task: URLSessionTask?, _ challenge: URLAuthenticationChallenge,
                              _ completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        do {
            try original(session, task)
            guard let location = claim.https, challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
                  challenge.protectionSpace.host == location.url.host, challenge.protectionSpace.protocol == "https",
                  challenge.protectionSpace.port == 443, let trust = challenge.protectionSpace.serverTrust,
                  SecTrustSetPolicies(trust, SecPolicyCreateSSL(true, location.url.host! as CFString)) == errSecSuccess,
                  SecTrustSetNetworkFetchAllowed(trust, false) == errSecSuccess,
                  SecTrustEvaluateWithError(trust, nil), let key = SecTrustCopyKey(trust),
                  let attributes = SecKeyCopyAttributes(key) as? [String: Any],
                  attributes[kSecAttrKeyType as String] as? String == kSecAttrKeyTypeECSECPrimeRandom as String,
                  (attributes[kSecAttrKeySizeInBits as String] as? NSNumber)?.intValue == 256,
                  var point = SecKeyCopyExternalRepresentation(key, nil) as Data?, point.count == 65, point.first == 4
            else { throw PlanetChildLocalV2ResourceError.refused }
            defer { point.resetBytes(in: 0..<point.count) }
            guard location.keyChecksums.contains(PlanetChildLocalV2ResourceRules.digest(point)) else { throw PlanetChildLocalV2ResourceError.refused }
            try current(); condition.lock(); trustAccepted = true; condition.unlock()
            completionHandler(.useCredential, URLCredential(trust: trust))
        } catch { completionHandler(.cancelAuthenticationChallenge, nil); refuse(error) }
    }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        do {
            try original(session, dataTask)
            guard let location = claim.https, let response = response as? HTTPURLResponse else { throw PlanetChildLocalV2ResourceError.refused }
            try PlanetChildLocalV2ResourceRules.response(response, location, claim.mime, claim.bytes)
            condition.lock(); let accepted = trustAccepted && !responseAccepted && !cancelled
            if accepted { responseAccepted = true }; condition.unlock()
            guard accepted else { throw PlanetChildLocalV2ResourceError.refused }; completionHandler(.allow)
        } catch { completionHandler(.cancel); refuse(error) }
    }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        do {
            try original(session, dataTask); condition.lock()
            guard responseAccepted, !cancelled, !completed, data.count <= claim.bytes - encoded.count else { condition.unlock(); throw PlanetChildLocalV2ResourceError.refused }
            do { try encoded.append(data) } catch { condition.unlock();throw error };condition.unlock();try current()
        } catch { refuse(error) }
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        do {
            if let error { throw error }; try original(session, task); condition.lock()
            let accepted = responseAccepted && trustAccepted && encoded.count == claim.bytes && !cancelled
            condition.unlock(); guard accepted else { throw PlanetChildLocalV2ResourceError.refused }
        } catch { condition.lock(); if failure == nil { failure = error }; condition.unlock() }
        condition.lock(); completed = true; condition.broadcast(); condition.unlock(); session.finishTasksAndInvalidate()
    }
    func urlSession(_ session: URLSession, didBecomeInvalidWithError error: Error?) {
        condition.lock()
        guard self.session === session, !joined else { condition.unlock(); return }
        if let error, failure == nil { failure = error }; invalidated = true; condition.broadcast(); condition.unlock()
    }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, willCacheResponse proposedResponse: CachedURLResponse,
                    completionHandler: @escaping (CachedURLResponse?) -> Void) { completionHandler(nil) }
}
