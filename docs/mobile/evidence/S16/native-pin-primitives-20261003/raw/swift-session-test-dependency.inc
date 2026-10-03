// B-only, unregistered XCTest fragment. NOT_RUN / NOT_COMPILED.
// A future reviewed Swift test action must append this to an owned COPY of the
// exact frozen PlanetChildVault.swift so its fileprivate core stays private.
// Never add it to the App, never call a vault factory, never treat these
// synthetic in-memory callbacks as native input/checkpoint/time/recovery.
import XCTest

fileprivate final class SyntheticPinSessionIO: PinSessionIO {
    private let lock=NSRecursiveLock()
    var bytes: Data, reads=0, writes=0
    init(_ bytes: Data) { self.bytes=Data(Array(bytes)) }
    func locked<T>(_ task: (PinSessionTransaction) throws -> T) throws -> T {
        lock.lock(); defer { lock.unlock() }; return try task(SyntheticPinTransaction(self))
    }
    private final class SyntheticPinTransaction: PinSessionTransaction {
        private let io: SyntheticPinSessionIO
        init(_ io: SyntheticPinSessionIO) { self.io=io }
        func read() throws -> Data { io.reads+=1; return Data(Array(io.bytes)) }
        func write(_ next: Data, boundary: () throws -> Void) throws {
            try boundary(); io.bytes=Data(Array(next)); io.writes+=1; try boundary()
        }
    }
}
fileprivate final class SyntheticPinSessionAuthority: PinSessionAuthority {
    let epoch=String(repeating:"1",count:64), boot="00000000-0000-4000-8000-000000000001"
    var uptime: UInt64=110, captureMutation=false, authorizationMutation=false, cancelKnownRefusal=false
    var captures=0, authorizations=0, advances=0, cancellations=0, retirements=0
    var onCapture: (() throws -> Void)?
    // Deliberate unsafe synthetic adversary: writable mutation of a callback's
    // disposable bytes must be rejected; it never receives core-owned backing.
    private func mutate(_ bytes: Data) {
        bytes.withUnsafeBytes { raw in
            if let pointer=raw.baseAddress { UnsafeMutableRawPointer(mutating:pointer).storeBytes(of:UInt8(0),as:UInt8.self) }
        }
    }
    private func point(_ checksum: String,_ revision: UInt64) -> PinNativeCoordinates {
        PinNativeCoordinates(owner:self,epoch:epoch,bootId:boot,checksum:checksum,revision:revision,
            hostGeneration:1,uptimeMs:uptime,logicalMs:1000+uptime-100)
    }
    func capture(_ inspection: OwnedPinInspection, bytes: Data, checksum: String, revision: UInt64) throws -> PinNativeCoordinates {
        captures+=1; try onCapture?(); if captureMutation { mutate(bytes) }; return point(checksum,revision)
    }
    func current(_ session: OwnedPinSession, bytes: Data, checksum: String, revision: UInt64) throws -> PinNativeCoordinates { point(checksum,revision) }
    func authorizeMutation(_ session: OwnedPinSession, next: Data, checksum: String, revision: UInt64) throws -> AnyObject {
        authorizations+=1; if authorizationMutation { mutate(next) }; return NSObject()
    }
    func advance(_ session: OwnedPinSession, resetPermission: AnyObject, recoveryPermission: AnyObject?, nextChecksum: String, nextRevision: UInt64) throws { advances+=1 }
    func cancel(_ inspection: OwnedPinInspection) throws { cancellations+=1; if cancelKnownRefusal { throw PinKnownRefusal() } }
    func retire(_ inspection: OwnedPinInspection) throws { retirements+=1 }
}
final class PlanetChildNativePinSessionSyntheticTests: XCTestCase {
    private let version="synthetic-codec-v1", checksum=String(repeating:"a",count:64)
    private func sha(_ bytes: Data) -> String { SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() }
    private func envelope(_ enrolled: Bool) -> Data {
        let registry="{\"schemaVersion\":1,\"policyVersion\":\"\(version)\",\"activeProfileId\":null,\"profiles\":[]}"
        let registrySHA=sha(Data(registry.utf8))
        let pin=enrolled ? "{\"schemaVersion\":1,\"policyVersion\":\"\(version)\",\"revision\":1,\"credentialId\":\"\(String(repeating:"e",count:64))\",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":600000,\"saltHex\":\"\(String(repeating:"f",count:64))\",\"hashHex\":\"\(String(repeating:"d",count:64))\"},\"attempts\":{\"count\":0,\"blockedUntilMs\":0,\"lastObservedMs\":1010,\"pendingAttemptId\":null}}" : "null"
        return Data("{\"schemaVersion\":1,\"revision\":\(enrolled ? 8:7),\"mode\":\"adult\",\"selectionRevision\":3,\"profileRevision\":2,\"policyChecksum\":\"\(checksum)\",\"registryChecksum\":\"\(registrySHA)\",\"registry\":\(registry),\"pin\":\(pin),\"clock\":{\"schemaVersion\":1,\"bootId\":\"00000000-0000-4000-8000-000000000001\",\"uptimeAnchorMs\":100,\"logicalAnchorMs\":1000,\"epochAnchor\":null}}".utf8)
    }
    private func core() throws -> (NativePinSessions,SyntheticPinSessionIO,SyntheticPinSessionAuthority) {
        let io=SyntheticPinSessionIO(envelope(false)), authority=SyntheticPinSessionAuthority()
        let policy=try PinSessionPolicy(version:version,checksum:checksum,maximumIterations:600000,iterations:600000)
        return (NativePinSessions(io:io,authority:authority,recovery:nil,policy:policy),io,authority)
    }
    private func inspection(_ core: NativePinSessions,_ id: String="2") throws -> OwnedPinInspection {
        try core.inspection(wireId:String(repeating:id,count:64),action:.enroll,timeoutMs:1000)
    }
    private func commit(_ core: NativePinSessions,_ inspection: OwnedPinInspection,_ session: OwnedPinSession,
                        epoch: String?=nil, deadline: UInt64?=nil, next: Data?=nil) throws -> PinNativeReply {
        let old=envelope(false), fresh=next ?? envelope(true)
        return try core.commit(inspection,session:session,expected:old,next:fresh,expectedChecksum:sha(old),nextChecksum:sha(fresh),
            expectedRevision:7,nextRevision:8,nativeEpoch:epoch ?? session.epoch,hostGeneration:session.hostGeneration,
            bootId:session.bootId,deadlineUptimeMs:deadline ?? session.deadlineUptimeMs,recoveryPermission:nil)
    }
    func testCapturedResetTimeSurvivesLaterCurrentSamplesAndExactReadback() throws {
        let (core,io,authority)=try core(), request=try inspection(core), started=try core.begin(request)
        let session=try XCTUnwrap(started.session); try core.settleReply(started,delivery:.known)
        authority.uptime=120 // Real-current synthetic sample later than begin.
        let committed=try commit(core,request,session); XCTAssertEqual(io.bytes,envelope(true))
        XCTAssertEqual(authority.advances,1); XCTAssertEqual(io.writes,1)
        XCTAssertEqual(try committed.copyBytes(),envelope(true)); try core.settleReply(committed,delivery:.known)
        let terminal=try core.retire(request); XCTAssertThrowsError(try inspection(core,"3"))
        try core.settleReply(terminal,delivery:.known); XCTAssertNoThrow(try inspection(core,"4"))
    }
    func testCaptureCallbackMutationAndReentrantReservationAreDenied() throws {
        let (core,io,authority)=try core(), request=try inspection(core)
        authority.onCapture={ XCTAssertThrowsError(try self.inspection(core,"3")) }
        authority.captureMutation=true; XCTAssertThrowsError(try core.begin(request))
        XCTAssertEqual(authority.captures,1); XCTAssertEqual(io.bytes,envelope(false)); XCTAssertTrue(request.sealed)
        XCTAssertEqual(request.workers,0); XCTAssertThrowsError(try inspection(core,"4"))
    }
    func testAuthorizationMutationCannotAdvanceOrPublish() throws {
        let (core,io,authority)=try core(), request=try inspection(core), started=try core.begin(request)
        let session=try XCTUnwrap(started.session); try core.settleReply(started,delivery:.known)
        authority.authorizationMutation=true; XCTAssertThrowsError(try commit(core,request,session))
        XCTAssertEqual(authority.authorizations,1); XCTAssertEqual(authority.advances,0); XCTAssertEqual(io.writes,0)
        XCTAssertEqual(io.bytes,envelope(false)); XCTAssertTrue(request.sealed); XCTAssertThrowsError(try session.expected.copy())
    }
    func testOnlyOriginalTerminalReplyCanReleaseAndUncertainCloseKeepsLane() throws {
        for uncertain in [false,true] {
            let (core,_,_)=try core(), request=try inspection(core), started=try core.begin(request)
            try core.settleReply(started,delivery:.known); let terminal=try core.retire(request)
            let forged=PinNativeReply(owner:core,inspection:request,session:request.session,kind:.closed,bytes:nil,checksum:nil)
            XCTAssertThrowsError(try core.settleReply(forged,delivery:.known)); XCTAssertEqual(request.transfers,1)
            terminal.close(); XCTAssertThrowsError(try inspection(core,"3")); XCTAssertEqual(request.transfers,1)
            try core.settleReply(terminal,delivery:uncertain ? .uncertain:.known)
            if uncertain { XCTAssertTrue(request.sealed); XCTAssertThrowsError(try inspection(core,"4")) }
            else { XCTAssertNoThrow(try inspection(core,"4")) }
        }
    }
    func testLostTransferWipesOwnedBytesWithoutPromotingDelivery() throws {
        let (core,_,_)=try core(), request=try inspection(core), started=try core.begin(request)
        let session=try XCTUnwrap(started.session); try core.sealUnknown(request)
        XCTAssertThrowsError(try started.copyBytes()); XCTAssertThrowsError(try session.expected.copy())
        XCTAssertEqual(request.transfers,1); XCTAssertTrue(request.pendingReplies[ObjectIdentifier(started)] === started)
        XCTAssertThrowsError(try inspection(core,"3"))
        try core.settleReply(started,delivery:.uncertain); XCTAssertEqual(request.transfers,0)
        let terminal=try core.retire(request); try core.settleReply(terminal,delivery:.known)
        XCTAssertThrowsError(try inspection(core,"4")); XCTAssertTrue(request.sealed)
    }
    func testKnownCancelRefusalCannotEraseAnExistingSeal() throws {
        let (core,_,authority)=try core(), request=try inspection(core), started=try core.begin(request)
        try core.settleReply(started,delivery:.known); try core.sealUnknown(request)
        authority.cancelKnownRefusal=true; XCTAssertThrowsError(try core.cancel(request))
        XCTAssertTrue(request.sealed); XCTAssertTrue(request.phase == .sealed); XCTAssertEqual(request.workers,0)
    }
    func testExactEpochDeadlineAndSizeDenyBeforePublication() throws {
        for variant in 0..<3 {
            let (core,io,authority)=try core(), request=try inspection(core), started=try core.begin(request)
            let session=try XCTUnwrap(started.session); try core.settleReply(started,delivery:.known)
            if variant==0 { XCTAssertThrowsError(try commit(core,request,session,epoch:String(repeating:"9",count:64))) }
            else if variant==1 { XCTAssertThrowsError(try commit(core,request,session,deadline:session.deadlineUptimeMs+1)) }
            else { XCTAssertThrowsError(try commit(core,request,session,next:Data(repeating:0,count:PlanetChildVault.maxBytes+1))) }
            XCTAssertEqual(io.writes,0); XCTAssertEqual(authority.advances,0); XCTAssertEqual(io.bytes,envelope(false))
        }
    }
    func testEqualityAtOriginalContinuousDeadlineIsDenied() throws {
        let (core,io,authority)=try core(), request=try inspection(core), started=try core.begin(request)
        let session=try XCTUnwrap(started.session); try core.settleReply(started,delivery:.known)
        authority.uptime=session.deadlineUptimeMs; XCTAssertThrowsError(try commit(core,request,session))
        XCTAssertEqual(io.writes,0); XCTAssertEqual(authority.advances,0); XCTAssertTrue(request.sealed)
    }
}
