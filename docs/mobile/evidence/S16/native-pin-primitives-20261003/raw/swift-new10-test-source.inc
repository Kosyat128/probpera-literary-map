// B-only, unregistered XCTest fragment: NOT_COMPILED / NOT_RUN.
// Append to an owned COPY of the frozen candidate and the existing frozen
// NativePinSessionSyntheticTests.swift.inc (SHA75f8a4cc0083ced08b5a105694aff246a90f2d4a2b538283ccbeebf04cf97fd4).
// Existing synthetic IO/authority are fixture dependencies, never production.
// No App/vault factory is constructed. New tests cover only primitive changes.
import XCTest

fileprivate final class SyntheticPrimitiveClock: PinPrimitiveClock {
    var now: UInt64=110000000, step: UInt64=1000000
    var onSample: (() throws -> Void)?
    func nanoseconds() throws -> UInt64 {
        try onSample?(); let result=now; now+=step; return result
    }
}
fileprivate final class SyntheticPrimitiveEngine: PinPrimitiveEngine {
    var randomCalls=0, derivations=0, observedIterations: [UInt32]=[]
    var onDerive: (() throws -> Void)?, mutatePin=false
    func random(_ output: UnsafeMutableRawBufferPointer) throws {
        randomCalls+=1; for index in output.indices { output[index]=UInt8(randomCalls%200) }
    }
    func derive(pin: UnsafeRawBufferPointer, salt: UnsafeRawBufferPointer,
                iterations: UInt32, output: UnsafeMutableRawBufferPointer) throws {
        derivations+=1; observedIterations.append(iterations); try onDerive?()
        if mutatePin { UnsafeMutableRawPointer(mutating:pin.baseAddress!).storeBytes(of:UInt8(57),as:UInt8.self) }
        for index in output.indices { output[index]=UInt8(derivations%200) }
    }
}
final class PlanetChildNativePinPrimitiveSyntheticTests: XCTestCase {
    private let version="synthetic-codec-v1", policy=String(repeating:"a",count:64)
    private func digest(_ bytes: Data) -> String { SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() }
    private func envelope(_ enrolled: Bool=false) -> Data {
        let registry="{\"schemaVersion\":1,\"policyVersion\":\"\(version)\",\"activeProfileId\":null,\"profiles\":[]}"
        let pin=enrolled ? "{\"schemaVersion\":1,\"policyVersion\":\"\(version)\",\"revision\":1,\"credentialId\":\"\(String(repeating:"e",count:64))\",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":600000,\"saltHex\":\"\(String(repeating:"f",count:64))\",\"hashHex\":\"\(String(repeating:"d",count:64))\"},\"attempts\":{\"count\":0,\"blockedUntilMs\":0,\"lastObservedMs\":1010,\"pendingAttemptId\":null}}" : "null"
        return Data("{\"schemaVersion\":1,\"revision\":\(enrolled ? 8:7),\"mode\":\"adult\",\"selectionRevision\":3,\"profileRevision\":2,\"policyChecksum\":\"\(policy)\",\"registryChecksum\":\"\(digest(Data(registry.utf8)))\",\"registry\":\(registry),\"pin\":\(pin),\"clock\":{\"schemaVersion\":1,\"bootId\":\"00000000-0000-4000-8000-000000000001\",\"uptimeAnchorMs\":100,\"logicalAnchorMs\":1000,\"epochAnchor\":null}}".utf8)
    }
    private func fixture() throws -> (NativePinSessions,OwnedPinInspection,PinPrimitiveContext,PinNativePrimitives,SyntheticPrimitiveEngine,SyntheticPrimitiveClock,SyntheticPinSessionIO) {
        let io=SyntheticPinSessionIO(envelope()), authority=SyntheticPinSessionAuthority()
        let rules=try PinSessionPolicy(version:version,checksum:policy,maximumIterations:600000,iterations:600000)
        let core=NativePinSessions(io:io,authority:authority,recovery:nil,policy:rules)
        let request=try core.inspection(wireId:String(repeating:"2",count:64),action:.enroll,timeoutMs:60000)
        let started=try core.begin(request), session=try XCTUnwrap(started.session)
        try core.settleReply(started,delivery:.known)
        let engine=SyntheticPrimitiveEngine(), clock=SyntheticPrimitiveClock()
        let primitives=try PinNativePrimitives.synthetic(owner:core,engine:engine,clock:clock)
        return (core,request,PinPrimitiveContext(session),primitives,engine,clock,io)
    }
    private func entry(_ bytes: [UInt8]=[49,50,51,52]) throws -> PinPrimitiveInput { try PinPrimitiveInput(Data(bytes)) }
    private func material(_ context: PinPrimitiveContext,_ primitives: PinNativePrimitives,
                          _ receipt: PinPrimitiveCalibration) throws -> PinPrimitiveMaterial {
        try primitives.prepare(context,first:entry(),confirmation:entry(),calibration:receipt)
    }
    func testExactSamplesAndOwnedMaterialTransferRetainsUntilKnownSettlement() throws {
        let (core,request,context,primitives,engine,_,io)=try fixture()
        let receipt=try primitives.calibrate(context)
        XCTAssertEqual(receipt.samplesNs.count,3); XCTAssertTrue(receipt.samplesNs.allSatisfy { $0>0 && $0<=5000000000 })
        XCTAssertTrue(receipt.source == .synthetic); XCTAssertEqual(engine.observedIterations,[600000,600000,600000])
        let output=try material(context,primitives,receipt)
        var salt=try output.copySalt(), credential=try output.copyCredential(), verifier=try output.copyVerifier()
        defer { salt.resetBytes(in:0..<salt.count); credential.resetBytes(in:0..<credential.count); verifier.resetBytes(in:0..<verifier.count) }
        XCTAssertEqual(salt.count,32); XCTAssertEqual(credential.count,32); XCTAssertEqual(verifier.count,32)
        XCTAssertNotEqual(salt,credential); XCTAssertEqual(engine.derivations,4); XCTAssertEqual(request.workers,0)
        XCTAssertEqual(io.writes,0); XCTAssertEqual(request.transfers,1)
        output.close(); XCTAssertThrowsError(try output.copyVerifier()); XCTAssertEqual(request.transfers,1)
        XCTAssertTrue(request.pendingReplies[ObjectIdentifier(output.reply)] === output.reply)
        try core.settleMaterial(output,delivery:.known); XCTAssertEqual(request.transfers,0)
        XCTAssertThrowsError(try core.settleMaterial(output,delivery:.known))
        let terminal=try core.retire(request); try core.settleReply(terminal,delivery:.known)
        XCTAssertNoThrow(try core.inspection(wireId:String(repeating:"3",count:64),action:.enroll,timeoutMs:1000))
    }
    func testUnknownMaterialDeliverySealsAndWipesWithoutReleasingLane() throws {
        let (core,request,context,primitives,_,_,_)=try fixture()
        let output=try material(context,primitives,primitives.calibrate(context))
        let forged=PinPrimitiveMaterial(owner:core,context:context,iterations:600000,reply:output.reply)
        XCTAssertThrowsError(try core.settleMaterial(forged,delivery:.known)); XCTAssertEqual(request.transfers,1)
        try core.settleMaterial(output,delivery:.uncertain)
        XCTAssertTrue(request.sealed); XCTAssertTrue(request.phase == .sealed)
        XCTAssertThrowsError(try output.copyVerifier()); XCTAssertThrowsError(try context.session.expected.copy())
        let terminal=try core.retire(request); try core.settleReply(terminal,delivery:.known)
        XCTAssertThrowsError(try core.inspection(wireId:String(repeating:"3",count:64),action:.enroll,timeoutMs:1000))
    }
    func testCalibrationContextIdentityAndOneUse() throws {
        let (core,_,context,primitives,engine,_,_)=try fixture(), receipt=try primitives.calibrate(context)
        let reconstructed=PinPrimitiveContext(context.session)
        XCTAssertThrowsError(try material(reconstructed,primitives,receipt))
        XCTAssertEqual(engine.derivations,3)
        let output=try material(context,primitives,receipt); try core.settleMaterial(output,delivery:.known)
        XCTAssertThrowsError(try material(context,primitives,receipt)); XCTAssertEqual(engine.derivations,4)
    }
    func testMalformedAsciiConfirmationAndBoundsConsumeNoKdf() throws {
        let vectors: [[UInt8]]=[[49,50,51],[49,50,51,0],[49,50,51,0xff],[49,50,51,53]]
        for bytes in vectors {
            let (_,request,context,primitives,engine,_,_)=try fixture(), receipt=try primitives.calibrate(context)
            let first=try entry(), confirmation=try entry(bytes)
            XCTAssertThrowsError(try primitives.prepare(context,first:first,confirmation:confirmation,calibration:receipt))
            XCTAssertEqual(engine.derivations,3); XCTAssertEqual(request.workers,0); XCTAssertEqual(request.transfers,0)
            XCTAssertThrowsError(try first.take()); XCTAssertThrowsError(try confirmation.take())
        }
        XCTAssertThrowsError(try PinPrimitiveInput(Data(repeating:49,count:129)))
        let (core,_,_,_,engine,clock,_)=try fixture()
        XCTAssertThrowsError(try PinNativePrimitives.synthetic(owner:core,engine:engine,clock:clock,minDigits:3))
        XCTAssertThrowsError(try PinNativePrimitives.synthetic(owner:core,engine:engine,clock:clock,maxDigits:129))
        XCTAssertThrowsError(try PinNativePrimitives.synthetic(owner:core,engine:engine,clock:clock,maximumDerivationMs:5001))
    }
    func testZeroElapsedClockRegressionAndDeadlineEqualityCannotCalibrate() throws {
        do {
            let (_,request,context,primitives,_,clock,_)=try fixture(); clock.step=0
            XCTAssertThrowsError(try primitives.calibrate(context)); XCTAssertEqual(request.workers,0); XCTAssertEqual(request.transfers,0)
        }
        do {
            let (_,request,context,primitives,engine,clock,_)=try fixture()
            engine.onDerive={ clock.now=110000000 }
            XCTAssertThrowsError(try primitives.calibrate(context)); XCTAssertEqual(engine.derivations,1); XCTAssertEqual(request.workers,0)
        }
        do {
            let (_,request,context,primitives,engine,clock,_)=try fixture()
            clock.now=context.deadlineUptimeMs*1000000
            XCTAssertThrowsError(try primitives.calibrate(context)); XCTAssertEqual(engine.randomCalls,0); XCTAssertEqual(request.workers,0)
        }
    }
    func testReentrantClockCannotStartAnotherJob() throws {
        let (_,request,context,primitives,engine,clock,_)=try fixture(); var attempted=false
        clock.onSample={
            if !attempted { attempted=true; XCTAssertThrowsError(try primitives.calibrate(context)); XCTAssertEqual(request.workers,1) }
        }
        let receipt=try primitives.calibrate(context)
        XCTAssertTrue(attempted); XCTAssertEqual(receipt.samplesNs.count,3); XCTAssertEqual(engine.derivations,3)
        XCTAssertEqual(request.workers,0)
    }
    func testKdfCallbackPinMutationRejected() throws {
        let (_,request,context,primitives,engine,_,_)=try fixture(); engine.mutatePin=true
        XCTAssertThrowsError(try primitives.calibrate(context))
        XCTAssertEqual(engine.derivations,1); XCTAssertEqual(request.workers,0); XCTAssertEqual(request.transfers,0)
    }
    func testNativeCommitCannotOverlapActualKdfAndCancelWaitsForReturn() throws {
        let (core,request,context,primitives,engine,_,io)=try fixture(), receipt=try primitives.calibrate(context)
        let entered=DispatchSemaphore(value:0), release=DispatchSemaphore(value:0), finished=expectation(description:"actual KDF returned")
        engine.onDerive={ entered.signal(); XCTAssertEqual(release.wait(timeout:.now()+5),.success) }
        DispatchQueue.global().async {
            defer { finished.fulfill() }
            XCTAssertThrowsError(try self.material(context,primitives,receipt))
        }
        XCTAssertEqual(entered.wait(timeout:.now()+5),.success); XCTAssertEqual(request.workers,1)
        let next=envelope(true), old=envelope()
        XCTAssertThrowsError(try core.commit(request,session:context.session,expected:old,next:next,
            expectedChecksum:digest(old),nextChecksum:digest(next),expectedRevision:7,nextRevision:8,
            nativeEpoch:context.epoch,hostGeneration:context.hostGeneration,bootId:context.bootId,
            deadlineUptimeMs:context.deadlineUptimeMs,recoveryPermission:nil))
        XCTAssertEqual(io.writes,0); try primitives.cancel(context)
        XCTAssertTrue(request.cancelled); XCTAssertEqual(request.workers,1)
        release.signal(); wait(for:[finished],timeout:5)
        XCTAssertEqual(request.workers,0); XCTAssertEqual(request.transfers,0); XCTAssertEqual(io.writes,0)
    }
    func testChangedFullRecordDuringKdfSealsNativeCapacity() throws {
        let (core,request,context,primitives,engine,_,io)=try fixture(), receipt=try primitives.calibrate(context)
        engine.onDerive={ io.bytes=Data([0]) }
        XCTAssertThrowsError(try material(context,primitives,receipt))
        XCTAssertTrue(request.sealed); XCTAssertTrue(request.phase == .sealed)
        XCTAssertEqual(request.workers,0); XCTAssertEqual(request.transfers,0)
        XCTAssertThrowsError(try context.session.expected.copy())
        XCTAssertThrowsError(try core.inspection(wireId:String(repeating:"3",count:64),action:.enroll,timeoutMs:1000))
    }
    // Root must supply its independently executed Node600k oracle. This new
    // CommonCrypto floor comparison is authored only; no Swift/device PASS.
    func testAppleCommonCrypto600kMatchesSuppliedIndependentOracle() throws {
        let path=try XCTUnwrap(ProcessInfo.processInfo.environment["PLANET_PIN_ORACLE_JSON"])
        let json=try XCTUnwrap(try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:path))) as? [String:Any])
        let expected=try XCTUnwrap(json["expectedHashHex"] as? String)
        XCTAssertEqual(expected.count,64); XCTAssertTrue(expected.allSatisfy { $0.isHexDigit && !$0.isUppercase })
        let password=try PinPrimitiveBytes(Data([49,50,51,52,53,54,55,56]))
        let salt=try PinPrimitiveBytes(Data((0..<32).map { UInt8($0) })), output=try PinPrimitiveBytes(count:32)
        defer { password.close(); salt.close(); output.close() }
        try password.read { pin in try salt.read { saltBytes in try output.write { key in
            try ApplePinPrimitiveEngine().derive(pin:pin,salt:saltBytes,iterations:600000,output:key)
        } } }
        var bytes=try output.copy(); defer { bytes.resetBytes(in:0..<bytes.count) }
        XCTAssertEqual(bytes.map { String(format:"%02x",$0) }.joined(),expected)
    }
}
