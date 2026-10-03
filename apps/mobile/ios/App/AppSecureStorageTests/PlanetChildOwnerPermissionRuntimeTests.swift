import Foundation
import XCTest
@testable import App

/** Authored synthetic runtime cases, NOT_COMPILED/NOT_RUN on Windows.
 * DEBUG-only fixture uses actual software SecKey signatures and original core
 * mechanics. It cannot mint Secure Enclave/passcode/device/guardian acceptance.
 * All assertions occur outside native, recipient and SPI callbacks. */
final class PlanetChildOwnerPermissionRuntimeTests: XCTestCase {
    private func outcome(_ scenario: PlanetChildOwnerPermissionRuntimeScenario) throws -> PlanetChildOwnerPermissionRuntimeObservation {
        let value=try PlanetChildOwnerPermissionRuntimeFixture.run(scenario)
        XCTAssertTrue(value.cleanupJoined,"Actual synthetic workers/transfers/retirement must settle")
        return value
    }
    private func signedControl(_ value: PlanetChildOwnerPermissionRuntimeObservation,file: StaticString=#filePath,line: UInt=#line) {
        XCTAssertFalse(value.registrationDenied,file:file,line:line)
        XCTAssertFalse(value.completionDenied,file:file,line:line)
        XCTAssertTrue(value.committed,file:file,line:line)
        XCTAssertEqual(value.recipientCalls,1,file:file,line:line)
        XCTAssertEqual(value.signCalls,1,file:file,line:line)
        XCTAssertEqual(value.acquireCalls,1,file:file,line:line)
        XCTAssertEqual(value.transferCount,0,file:file,line:line)
    }
    private func refusedAfterRealSign(_ value: PlanetChildOwnerPermissionRuntimeObservation,file: StaticString=#filePath,line: UInt=#line) {
        XCTAssertFalse(value.registrationDenied,file:file,line:line)
        XCTAssertTrue(value.completionDenied,file:file,line:line)
        XCTAssertFalse(value.committed,file:file,line:line)
        XCTAssertEqual(value.recipientCalls,1,file:file,line:line)
        XCTAssertEqual(value.signCalls,1,file:file,line:line)
        XCTAssertEqual(value.acquireCalls,1,file:file,line:line)
        XCTAssertEqual(value.transferCount,0,file:file,line:line)
    }
    func testEnrollmentOriginalFullRecordAndActualSignatureControl() throws { signedControl(try outcome(.enroll)) }
    func testRecoveryOriginalFullRecordAndActualSignatureControl() throws { signedControl(try outcome(.recover)) }
    func testMalformedDigestDeniedBeforeKeyAcquisitionOrSigning() throws {
        let value=try outcome(.malformedDigest)
        XCTAssertTrue(value.registrationDenied);XCTAssertFalse(value.committed);XCTAssertEqual(value.acquireCalls,0);XCTAssertEqual(value.signCalls,0)
    }
    func testReplaceActionCannotAcquireOwnerRecoveryPermission() throws {
        let value=try outcome(.unsupportedReplace)
        XCTAssertTrue(value.registrationDenied);XCTAssertEqual(value.acquireCalls,0);XCTAssertEqual(value.signCalls,0)
    }
    func testNextBytesOwnBytesNoCopyInputBeforeAnyCallback() throws { signedControl(try outcome(.ownedNext)) }
    func testAuthorizeOriginalRequestExactlyOnce() throws {
        let value=try outcome(.replayAuthorize);signedControl(value);XCTAssertTrue(value.replayDenied)
    }
    func testReceiverCannotSettleTransferWhileActualWorkerIsRunning() throws {
        let value=try outcome(.earlyTransfer);signedControl(value);XCTAssertTrue(value.earlyDenied)
    }
    func testDirectCoreReplyCannotBypassOwnerTransferGuard() throws {
        let value=try outcome(.directCoreTransfer);signedControl(value);XCTAssertTrue(value.earlyDenied)
    }
    func testConsumeBeforeOriginalCommitBurnsPermission() throws {
        let value=try outcome(.earlyConsume)
        XCTAssertTrue(value.earlyDenied);XCTAssertFalse(value.committed);XCTAssertEqual(value.signCalls,1);XCTAssertEqual(value.transferCount,0)
    }
    func testExpiryAfterActualSignatureDeniesOriginalDeadline() throws { refusedAfterRealSign(try outcome(.expiryAfterSign)) }
    func testContinuousClockRollbackAfterSignatureDenies() throws { refusedAfterRealSign(try outcome(.rollbackAfterSign)) }
    func testRecipientCrossingExclusiveDeadlineCannotPublishPermission() throws { refusedAfterRealSign(try outcome(.expiryAfterRecipient)) }
    func testCancelDuringActualSigningRetainsWorkerUntilReturn() throws { refusedAfterRealSign(try outcome(.cancellationDuringSign)) }
    func testRecoveryMissingFixedKeyNeverCreatesOrSigns() throws {
        let value=try outcome(.missingRecoveryKey)
        XCTAssertFalse(value.registrationDenied);XCTAssertTrue(value.completionDenied);XCTAssertFalse(value.committed)
        XCTAssertEqual(value.acquireCalls,1);XCTAssertEqual(value.signCalls,0);XCTAssertEqual(value.recipientCalls,1);XCTAssertEqual(value.transferCount,0)
    }
    func testSuccessfulSignerCallbackWithInvalidSignatureNeverGrants() throws { refusedAfterRealSign(try outcome(.signatureMismatch)) }
    func testPersistedKeyIdentityChangeAfterSignatureDenies() throws { refusedAfterRealSign(try outcome(.persistedKeyChanged)) }
    func testThrownReceiverLeavesPermissionUnusableAndOriginalTransferSettles() throws { refusedAfterRealSign(try outcome(.recipientThrows)) }
    func testUncertainOriginalDeliverySealsAndCannotConsume() throws {
        let value=try outcome(.uncertainDelivery)
        XCTAssertFalse(value.committed);XCTAssertEqual(value.signCalls,1);XCTAssertEqual(value.recipientCalls,1);XCTAssertEqual(value.transferCount,0)
    }
    func testPermissionIsBurnedBeforeReplayFromSameOriginalCommit() throws {
        let value=try outcome(.consumeReplay);signedControl(value);XCTAssertTrue(value.replayDenied)
    }
    func testOriginalDeadlineCannotRenewAtConsume() throws {
        let value=try outcome(.expiryAtConsume)
        XCTAssertFalse(value.committed);XCTAssertFalse(value.completionDenied);XCTAssertEqual(value.signCalls,1);XCTAssertEqual(value.transferCount,0)
    }
    func testWholeStoredRecordChangeAfterAuthorizationDeniesCommit() throws {
        let value=try outcome(.changedStoredRecord)
        XCTAssertFalse(value.committed);XCTAssertEqual(value.signCalls,1);XCTAssertEqual(value.recipientCalls,1);XCTAssertEqual(value.transferCount,0)
    }
    func testOriginalHostGenerationChangeAfterSignatureDenies() throws { refusedAfterRealSign(try outcome(.hostGenerationChanged)) }
    func testRetirementDoesNotReleaseCapacityWhileActualSignIsBlocked() throws {
        let value=try outcome(.retireWaitsForActualSign)
        XCTAssertTrue(value.retireWaited);XCTAssertTrue(value.retired);XCTAssertTrue(value.completionDenied)
        XCTAssertEqual(value.signCalls,1);XCTAssertEqual(value.recipientCalls,1);XCTAssertEqual(value.transferCount,0)
    }
    func testBackgroundAfterSignatureBeforeACKPermanentlyRevokesOriginalGrant() throws {
        let value=try outcome(.backgroundBeforeACK)
        XCTAssertTrue(value.backgroundLatched);XCTAssertFalse(value.committed);XCTAssertEqual(value.signCalls,1);XCTAssertEqual(value.transferCount,0)
    }
    func testBackgroundAfterKnownACKStillRevokesUnusedOriginalGrant() throws {
        let value=try outcome(.backgroundAfterACK)
        XCTAssertTrue(value.backgroundLatched);XCTAssertFalse(value.committed);XCTAssertEqual(value.recipientCalls,1);XCTAssertEqual(value.transferCount,0)
    }
    func testForegroundReturnAfterKnownACKCannotResurrectOriginalGrant() throws {
        let value=try outcome(.foregroundCannotResurrect)
        XCTAssertTrue(value.backgroundLatched);XCTAssertFalse(value.committed);XCTAssertEqual(value.signCalls,1);XCTAssertEqual(value.transferCount,0)
    }
}
