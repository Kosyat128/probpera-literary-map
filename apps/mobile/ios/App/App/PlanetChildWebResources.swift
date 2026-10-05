import Foundation
import UIKit
import WebKit

/** Unique native scheme registered before the original WKWebView is created.
 * The private original SDK output owns bytes; a URI or a caller task is never
 * authority. Callback reservations and workers join before zeroization. */
final class PlanetChildWebResources: NSObject, WKURLSchemeHandler {
    static let scheme="planet-child-resource",origin="capacitor://localhost"
    private let condition=NSCondition(),workers=DispatchQueue(label:"ru.probpera.literaryplanet.child.web-resources-v2")
    private weak var host: PlanetBridgeViewController?,web: WKWebView?,owner: PlanetChildLocalV2SDKOwner?
    private var outputs=[String:Output](),tasks=[ObjectIdentifier:TaskRecord](),navigation: UInt64=0
    private var loading: NSKeyValueObservation?
    private static func refused() -> Error { NSError(domain:"ru.probpera.literaryplanet.child.web-resource",code:403,userInfo:nil) }
    static func token(_ uri: String) throws -> String {
        guard uri.range(of:"\\Aplanet-child-resource://local/[a-f0-9]{32}\\z",options:.regularExpression) != nil else { throw refused() };return String(uri.suffix(32))
    }
    var epoch: UInt64 { condition.lock();defer { condition.unlock() };return navigation }
    func bindWebView(_ original: WKWebView,host: PlanetBridgeViewController) {
        guard Thread.isMainThread,original.configuration.urlSchemeHandler(forURLScheme:Self.scheme) === self else { return }
        condition.lock();guard web==nil || web === original else { condition.unlock();return };web=original;self.host=host;condition.unlock()
        if loading==nil { loading=original.observe(\.isLoading,options:[.new]) { [weak self] _,change in if change.newValue==true { self?.navigationChanged() } } }
    }
    func bindOwner(_ original: PlanetChildLocalV2SDKOwner,web originalWeb: WKWebView) throws {
        guard Thread.isMainThread else { throw Self.refused() };condition.lock();let matches=web === originalWeb && (owner==nil || owner === original);if matches { owner=original };condition.unlock();guard matches,host?.bridge?.webView === originalWeb,originalWeb.configuration.urlSchemeHandler(forURLScheme:Self.scheme) === self else { throw Self.refused() }
    }
    private func navigationChanged() {
        guard Thread.isMainThread else { DispatchQueue.main.async { [weak self] in self?.navigationChanged() };return }
        condition.lock();if navigation<9007199254740991 { navigation+=1 };let rows=Array(outputs.values),original=owner;condition.unlock();for row in rows { row.revoke() };original?.routeWillChange()
    }
    func currentMain(_ original: WKWebView,_ expected: UInt64) throws {
        guard Thread.isMainThread else { throw Self.refused() };condition.lock();let valid=web === original && navigation==expected;let controller=host;condition.unlock()
        guard valid,let controller,controller.bridge?.webView === original,controller.childResources === self,
              original.configuration.urlSchemeHandler(forURLScheme:Self.scheme) === self,let window=original.window,window.isKeyWindow,
              window.windowScene?.activationState == .foregroundActive,UIApplication.shared.applicationState == .active,
              let page=original.url,page.absoluteString==Self.origin || page.absoluteString.hasPrefix(Self.origin+"/") else { throw Self.refused() }
    }
    func adopt(_ permit: PlanetChildLocalV2WebOutputPermit,_ bytes: Data) throws -> Output {
        try permit.transferCurrent(bytes);guard permit.handler === self else { throw Self.refused() };let output=Output(self,permit,bytes)
        do {
            condition.lock();guard outputs.count<3,outputs[output.token]==nil else { condition.unlock();throw Self.refused() };condition.unlock()
            try permit.adopt(output);condition.lock();guard outputs[output.token]==nil else { condition.unlock();throw Self.refused() };outputs[output.token]=output;condition.unlock();return output
        } catch {
            let original=error;output.revoke();try output.closeJoined();guard output.knownClosed else { throw PlanetChildLocalV2ResourceError.cleanupUnknown };throw original
        }
    }
    func forget(_ output: Output) throws {
        guard output.knownClosed else { throw Self.refused() };condition.lock();defer { condition.unlock() };guard outputs[output.token] === output else { throw Self.refused() };outputs.removeValue(forKey:output.token)
    }
    private final class TaskRecord {
        let task: WKURLSchemeTask,web: WKWebView,output: Output,epoch: UInt64,id: ObjectIdentifier
        var stopped=false,revoked=false,terminal=false,finished=false,callbacks=0
        init(_ task: WKURLSchemeTask,_ web: WKWebView,_ output: Output,_ epoch: UInt64) { self.task=task;self.web=web;self.output=output;self.epoch=epoch;id=ObjectIdentifier(task as AnyObject) }
    }
    func webView(_ original: WKWebView,start task: WKURLSchemeTask) {
        do {
            guard let url=task.request.url,task.request.httpMethod=="GET",let document=task.request.mainDocumentURL,document != url,
                  document.absoluteString==Self.origin || document.absoluteString.hasPrefix(Self.origin+"/") else { throw Self.refused() }
            if let origin=task.request.value(forHTTPHeaderField:"Origin"),origin != Self.origin { throw Self.refused() }
            let token=try Self.token(url.absoluteString);condition.lock();let output=outputs[token],expected=navigation,bound=web === original;condition.unlock()
            guard bound,let output else { throw Self.refused() };try output.permit.outputCurrent(output,original,expected)
            let record=TaskRecord(task,original,output,expected);condition.lock();guard tasks[record.id]==nil else { condition.unlock();throw Self.refused() };tasks[record.id]=record;condition.unlock()
            do { try output.reserve(record.id) } catch { condition.lock();tasks.removeValue(forKey:record.id);condition.unlock();throw error }
            workers.async { [self] in run(record) }
        } catch { task.didFailWithError(Self.refused()) }
    }
    func webView(_ original: WKWebView,stop task: WKURLSchemeTask) {
        condition.lock();if let record=tasks[ObjectIdentifier(task as AnyObject)],record.task === task,record.web === original { record.stopped=true;condition.broadcast() };condition.unlock()
    }
    private func current(_ record: TaskRecord) throws {
        condition.lock();let valid=tasks[record.id] === record && !record.stopped && !record.revoked && !record.terminal && !record.finished;condition.unlock();guard valid else { throw Self.refused() };try record.output.permit.outputCurrent(record.output,record.web,record.epoch)
    }
    private func callback(_ record: TaskRecord,terminal: Bool=false,_ body: () -> Void) throws {
        try current(record)
        try DispatchQueue.main.sync {
            try current(record);condition.lock();guard tasks[record.id] === record,!record.stopped,!record.revoked,!record.terminal,!record.finished else { condition.unlock();throw Self.refused() };if terminal { record.terminal=true };record.callbacks+=1;condition.unlock()
            defer { condition.lock();record.callbacks-=1;condition.broadcast();condition.unlock() };body()
        };if !terminal { try current(record) }
    }
    private func run(_ record: TaskRecord) {
        defer { condition.lock();record.finished=true;if tasks[record.id] === record { tasks.removeValue(forKey:record.id) };condition.broadcast();condition.unlock();record.output.complete(record.id) }
        do {
            try current(record);guard let url=record.task.request.url else { throw Self.refused() }
            let headers=["Content-Type":record.output.permit.mime,"Content-Length":String(record.output.permit.bytes),"Cache-Control":"no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Access-Control-Allow-Origin":Self.origin,"Vary":"Origin"]
            guard let response=HTTPURLResponse(url:url,statusCode:200,httpVersion:"HTTP/1.1",headerFields:headers) else { throw Self.refused() };try callback(record) { record.task.didReceive(response) }
            var at=0
            while at<record.output.permit.bytes {
                try current(record);var bytes=try record.output.chunk(at);defer { bytes.resetBytes(in:0..<bytes.count) }
                guard !bytes.isEmpty,bytes.count<=8192,bytes.count<=record.output.permit.bytes-at else { throw Self.refused() };try callback(record) { record.task.didReceive(bytes) };at+=bytes.count;try current(record)
            }
            try current(record);try callback(record,terminal:true) { record.task.didFinish() }
        } catch {
            DispatchQueue.main.sync { condition.lock();let active=tasks[record.id] === record && !record.stopped && !record.terminal && !record.finished;if active { record.terminal=true;record.callbacks+=1 };condition.unlock()
                if active { record.task.didFailWithError(Self.refused());condition.lock();record.callbacks-=1;condition.broadcast();condition.unlock() }
            }
        }
    }
    private func revoke(_ output: Output) { condition.lock();for task in tasks.values where task.output === output { task.revoked=true };condition.broadcast();condition.unlock() }
    /** Its real task records, serial workers and callback reservations are
     * retained until their final native return. Framework copies are borrowed;
     * every owned encoded/chunk buffer is wiped after those returns. */
    final class Output {
        let permit: PlanetChildLocalV2WebOutputPermit,token: String,uri: String
        private let handler: PlanetChildWebResources,condition=NSCondition()
        private var encoded: Data,revoked=false,closed=false,jobs=Set<ObjectIdentifier>()
        fileprivate init(_ handler: PlanetChildWebResources,_ permit: PlanetChildLocalV2WebOutputPermit,_ bytes: Data) { self.handler=handler;self.permit=permit;token=permit.token;uri=PlanetChildWebResources.scheme+"://local/"+token;encoded=bytes }
        var admits: Bool { condition.lock();defer { condition.unlock() };return !revoked && !closed && encoded.count==permit.bytes }
        fileprivate func reserve(_ job: ObjectIdentifier) throws { condition.lock();defer { condition.unlock() };guard !revoked,!closed,jobs.count<4,jobs.insert(job).inserted else { throw PlanetChildWebResources.refused() } }
        fileprivate func complete(_ job: ObjectIdentifier) { condition.lock();jobs.remove(job);condition.broadcast();condition.unlock() }
        fileprivate func chunk(_ at: Int) throws -> Data { condition.lock();defer { condition.unlock() };guard !revoked,!closed,at>=0,at<encoded.count,encoded.count==permit.bytes else { throw PlanetChildWebResources.refused() };return Data(encoded[at..<min(encoded.count,at+8192)]) }
        func revoke() { condition.lock();revoked=true;condition.unlock();handler.revoke(self) }
        func closeJoined() throws {
            guard !Thread.isMainThread else { throw PlanetChildLocalV2ResourceError.cleanupUnknown };revoke();let began=clock_gettime_nsec_np(CLOCK_MONOTONIC_RAW);condition.lock()
            while !jobs.isEmpty { let now=clock_gettime_nsec_np(CLOCK_MONOTONIC_RAW);guard began>0,now>=began,now-began<5_000_000_000 else { condition.unlock();throw PlanetChildLocalV2ResourceError.cleanupUnknown };_ = condition.wait(until:Date(timeIntervalSinceNow:0.01)) }
            encoded.resetBytes(in:0..<encoded.count);encoded.removeAll(keepingCapacity:false);closed=true;condition.unlock()
        }
        var knownClosed: Bool { condition.lock();defer { condition.unlock() };return revoked && closed && jobs.isEmpty && encoded.isEmpty }
    }
}
#if DEBUG
extension PlanetChildWebResources {
    /** Read-only actual native observations. No counters supplied by the test
     * can approve a command return, buffer/task join or native output owner. */
    func runtimeObservation() throws -> [String:Int] {
        guard Thread.isMainThread else { throw Self.refused() };condition.lock();let rows=Array(outputs.values),jobCount=tasks.count,originalWeb=web,epoch=navigation;condition.unlock()
        if !rows.isEmpty { guard let originalWeb else { throw Self.refused() };for output in rows { try output.permit.outputCurrent(output,originalWeb,epoch) } }
        return ["outputs":rows.count,"tasks":jobCount,"encodedBytes":rows.reduce(0) { $0+$1.permit.bytes }]
    }
}
#endif
