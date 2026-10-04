import Foundation
import CryptoKit
import XCTest
@testable import App

/** Authored only: NOT_COMPILED/NOT_RUN on Windows. Software SecKey + memory
 * transaction fixtures establish no Secure Enclave/passcode/Keychain/host/device
 * acceptance. All negative/result assertions occur outside swallowed callbacks. */
final class PlanetChildFirstInstallV2RuntimeTests: XCTestCase {
    private let version="synthetic-local-v2",policy=String(repeating:"a",count:64)
    private func digest(_ bytes: Data) -> String { SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() }
    private func seed() throws -> Data { try PlanetChildVault.LocalEmptySeedV2.canonicalBytes(policyVersion:version,policyChecksum:policy) }
    private func outcome(_ scenario: PlanetChildFirstInstallV2RuntimeScenario) throws -> PlanetChildFirstInstallV2RuntimeObservation {
        let value=try PlanetChildFirstInstallV2RuntimeFixture.run(scenario)
        XCTAssertTrue(value.cleanupJoined);XCTAssertTrue(value.retired);return value
    }
    private func control(_ value: PlanetChildFirstInstallV2RuntimeObservation,file: StaticString=#filePath,line: UInt=#line) {
        XCTAssertFalse(value.registrationDenied,file:file,line:line);XCTAssertFalse(value.proofDenied,file:file,line:line)
        XCTAssertFalse(value.provisionDenied,file:file,line:line);XCTAssertTrue(value.signatureVerified,file:file,line:line)
        XCTAssertTrue(value.committed,file:file,line:line);XCTAssertTrue(value.receiptKnown,file:file,line:line)
        XCTAssertTrue(value.seedExists,file:file,line:line);XCTAssertTrue(value.seedExact,file:file,line:line)
        XCTAssertFalse(value.seedBeforeProof,file:file,line:line);XCTAssertEqual(value.preProofObservations,1,file:file,line:line)
        XCTAssertEqual(value.signCalls,1,file:file,line:line);XCTAssertEqual(value.acquireCalls,1,file:file,line:line)
        XCTAssertEqual(value.createCalls,1,file:file,line:line);XCTAssertEqual(value.recipientCalls,1,file:file,line:line)
        XCTAssertTrue(value.originalSpent,file:file,line:line)
    }
    private func refusedSign(_ scenario: PlanetChildFirstInstallV2RuntimeScenario,exposed: Bool=false,file: StaticString=#filePath,line: UInt=#line) throws {
        let value=try outcome(scenario)
        XCTAssertFalse(value.registrationDenied,file:file,line:line);XCTAssertTrue(value.proofDenied,file:file,line:line)
        XCTAssertEqual(value.signatureVerified,exposed,file:file,line:line);XCTAssertFalse(value.committed,file:file,line:line)
        XCTAssertFalse(value.seedExists,file:file,line:line);XCTAssertFalse(value.seedBeforeProof,file:file,line:line)
        XCTAssertEqual(value.signCalls,1,file:file,line:line);XCTAssertEqual(value.createCalls,0,file:file,line:line)
        XCTAssertEqual(value.recipientCalls,1,file:file,line:line)
    }
    private func sealedMutation(_ scenario: PlanetChildFirstInstallV2RuntimeScenario,file: StaticString=#filePath,line: UInt=#line) throws -> PlanetChildFirstInstallV2RuntimeObservation {
        let value=try outcome(scenario)
        XCTAssertTrue(value.signatureVerified,file:file,line:line);XCTAssertTrue(value.provisionDenied,file:file,line:line)
        XCTAssertFalse(value.committed,file:file,line:line);XCTAssertFalse(value.receiptKnown,file:file,line:line)
        XCTAssertTrue(value.seedExists,file:file,line:line);XCTAssertTrue(value.originalSpent,file:file,line:line)
        XCTAssertTrue(value.secondRequestDenied,file:file,line:line);XCTAssertEqual(value.createCalls,1,file:file,line:line)
        XCTAssertEqual(value.signCalls,1,file:file,line:line);return value
    }
    func testSyntheticCanonicalVector() throws {
        let bytes=try seed(),text=String(decoding:bytes,as:UTF8.self)
        XCTAssertTrue(text.contains("\"registryChecksum\":\"3bcb6774320bf9e7732200baf02422037aa055377d427a6b4d272ac78f462420\""))
        XCTAssertEqual(digest(bytes),"bcf1edf94a54e3e55eca07c78fb820dd33ac9943e219959d6d4309145cdc92cf")
        XCTAssertEqual(try PlanetChildVault.LocalEmptySeedV2.validate(bytes,policyVersion:version,policyChecksum:policy),digest(bytes))
    }
    func testSharedCanonicalVector() throws {
        let bytes=try PlanetChildVault.LocalEmptySeedV2.canonicalBytes(policyVersion:"shared-policy.2026-10",policyChecksum:String(repeating:"b",count:64))
        XCTAssertTrue(String(decoding:bytes,as:UTF8.self).contains("43731657467908109f159c6a5aa77929ede7bf339f3322eb57e060fc78961336"))
        XCTAssertEqual(digest(bytes),"8938bfcd08cbeb669d7216ed47f71704bb16249b06e47cd8847a1f580f91e03d")
    }
    func testExactCanonicalOrderWhitespaceUnknownAndDuplicateFieldsDenied() throws {
        let text=String(decoding:try seed(),as:UTF8.self)
        for changed in [" "+text,text+"\n",text.replacingOccurrences(of:"\"schemaVersion\":2,\"revision\":1",with:"\"revision\":1,\"schemaVersion\":2"),
            text.replacingOccurrences(of:"\"pin\":null",with:"\"pin\":null,\"unexpected\":false"),text.replacingOccurrences(of:"\"revision\":1",with:"\"revision\":1,\"revision\":1")] {
            XCTAssertThrowsError(try PlanetChildVault.LocalEmptySeedV2.validate(Data(changed.utf8),policyVersion:version,policyChecksum:policy))
        }
    }
    func testV1ClockNonzeroLogicalAndNonemptyProfilesNeverBecomeV2FirstInstall() throws {
        let text=String(decoding:try seed(),as:UTF8.self)
        for changed in [text.replacingOccurrences(of:"\"logicalMs\":0",with:"\"logicalMs\":1"),
            text.replacingOccurrences(of:"\"clock\":{\"schemaVersion\":2,\"logicalMs\":0}",with:"\"clock\":{\"schemaVersion\":1,\"bootId\":\"11111111-1111-1111-1111-111111111111\",\"uptimeAnchorMs\":0,\"logicalAnchorMs\":0,\"epochAnchor\":null}"),
            text.replacingOccurrences(of:"\"profiles\":[]",with:"\"profiles\":[{}]"),text.replacingOccurrences(of:"\"revision\":1",with:"\"revision\":2")] {
            XCTAssertThrowsError(try PlanetChildVault.LocalEmptySeedV2.validate(Data(changed.utf8),policyVersion:version,policyChecksum:policy))
        }
    }
    func testStrictASCIIIdentifierAndLowercasePolicyDigestBeforeSeedCreation() throws {
        for invalid in ["",String(repeating:"a",count:97),"x\"", "x\n","политика"] {
            XCTAssertThrowsError(try PlanetChildVault.LocalEmptySeedV2.canonicalBytes(policyVersion:invalid,policyChecksum:policy))
        }
        for invalid in [String(repeating:"A",count:64),String(repeating:"a",count:63),String(repeating:"g",count:64)] {
            XCTAssertThrowsError(try PlanetChildVault.LocalEmptySeedV2.canonicalBytes(policyVersion:version,policyChecksum:invalid))
        }
    }
    func testOwnedByteComparisonPrimitiveDigestAndRegistryHashRemainExact() throws {
        var bytes=try seed();let original=digest(bytes),validated=try PlanetChildVault.LocalEmptySeedV2.validate(bytes,policyVersion:version,policyChecksum:policy)
        bytes[bytes.startIndex]=0;XCTAssertEqual(validated,original)
        XCTAssertThrowsError(try PlanetChildVault.LocalEmptySeedV2.validate(bytes,policyVersion:version,policyChecksum:policy))
        var wrong=String(decoding:try seed(),as:UTF8.self)
        wrong=wrong.replacingOccurrences(of:"3bcb6774320bf9e7732200baf02422037aa055377d427a6b4d272ac78f462420",with:String(repeating:"0",count:64))
        XCTAssertThrowsError(try PlanetChildVault.LocalEmptySeedV2.validate(Data(wrong.utf8),policyVersion:version,policyChecksum:policy))
    }
    func testFirstInstallSignsOriginalTemplateBeforeSingleAddAndKnownReceipt() throws { control(try outcome(.firstInstall)) }
    func testAllExistingAndUnreadableChildFootprintsRefuseBeforeSigningOrAdd() throws {
        for scenario in [PlanetChildFirstInstallV2RuntimeScenario.existingV1,.existingV2,.existingAES,.existingSnapshot,.unreadableFootprint] {
            let value=try outcome(scenario);XCTAssertTrue(value.registrationDenied)
            XCTAssertEqual(value.signCalls,0);XCTAssertEqual(value.acquireCalls,0);XCTAssertEqual(value.createCalls,0)
            XCTAssertEqual(value.seedExists,scenario == .existingV2);XCTAssertFalse(value.committed)
        }
    }
    func testProofACKInsideRecipientCannotBypassActualWorkerCleanup() throws { let value=try outcome(.earlyProofACK);XCTAssertTrue(value.earlyDenied);control(value) }
    func testProvisionInsideRecipientCannotBypassKnownOriginalProofACK() throws { let value=try outcome(.earlyProvision);XCTAssertTrue(value.earlyDenied);control(value) }
    func testBadActualSignatureNeverEntersSuccessRecipient() throws { try refusedSign(.badSignature) }
    func testChangedPersistedSigningKeyNeverEntersSuccessRecipient() throws { try refusedSign(.changedSigningKey) }
    func testExclusiveOriginalExpiryAfterActualSignRefusesBeforeSeed() throws { try refusedSign(.expireAfterSign) }
    func testContinuousClockRollbackAfterActualSignRefusesBeforeSeed() throws { try refusedSign(.rollbackAfterSign) }
    func testOriginalExpiryConsumedBySuccessRecipientRefusesKnownProofACK() throws { try refusedSign(.expireAfterRecipient,exposed:true) }
    func testThrowingSuccessRecipientRemainsUnknownAndCannotProvision() throws { try refusedSign(.recipientThrows,exposed:true) }
    func testCancellationDuringActualSignJoinsWithoutSeed() throws { try refusedSign(.cancelDuringSign) }
    func testUnknownOriginalProofDeliveryCannotProvision() throws {
        let value=try outcome(.unknownProofDelivery);XCTAssertTrue(value.provisionDenied);XCTAssertFalse(value.committed)
        XCTAssertEqual(value.signCalls,1);XCTAssertEqual(value.createCalls,0);XCTAssertFalse(value.seedExists)
    }
    func testOriginalBackgroundAfterKnownProofACKPermanentlyRefusesProvision() throws {
        let value=try outcome(.backgroundAfterACK);XCTAssertTrue(value.provisionDenied);XCTAssertFalse(value.committed);XCTAssertEqual(value.createCalls,0)
    }
    func testForegroundReturnWithValidClockCannotResurrectBackgroundRevokedOriginal() throws {
        let value=try outcome(.foregroundCannotResurrect);XCTAssertTrue(value.provisionDenied);XCTAssertFalse(value.committed);XCTAssertEqual(value.createCalls,0)
    }
    func testAmbiguousAddLeavesOriginalItemSealedAndNeverRecreatesIt() throws { _=try sealedMutation(.ambiguousAdd) }
    func testReadbackMismatchLeavesOriginalItemSealedAndNeverResetsIt() throws { _=try sealedMutation(.readbackMismatch) }
    func testExpiryAfterActualAddCannotMintDurableReceiptOrRenewDeadline() throws { _=try sealedMutation(.expireAfterAdd) }
    func testExpiryAfterLastStorageReturnCannotMintDurableReceipt() throws { _=try sealedMutation(.expireAfterStoreReturn) }
    func testLastClockCallbackCancellationUnderIOLockCannotPublishReceipt() throws {
        let value=try sealedMutation(.clockReentryAfterStoreReturn);XCTAssertTrue(value.clockReentryObserved)
    }
    func testOnceConsumedOriginalProofCannotCreateSecondSeed() throws { let value=try outcome(.provisionReplay);control(value);XCTAssertTrue(value.replayDenied) }
    func testOriginalDurableReceiptCanBeAcknowledgedOnlyOnce() throws { let value=try outcome(.receiptReplay);control(value);XCTAssertTrue(value.replayDenied) }
    func testManufacturedProofWrapperCannotConsumeGenuineOriginal() throws { let value=try outcome(.wrongProofObject);XCTAssertTrue(value.earlyDenied);control(value) }
    func testCancelledBeforeSeedMayExplicitlyRetryWithSameValidatedSigningKey() throws {
        let value=try outcome(.retryBeforeSeed);XCTAssertTrue(value.committed);XCTAssertTrue(value.receiptKnown);XCTAssertTrue(value.sameSigningKey)
        XCTAssertEqual(value.signCalls,2);XCTAssertEqual(value.acquireCalls,2);XCTAssertEqual(value.createCalls,1);XCTAssertEqual(value.recipientCalls,2)
        XCTAssertEqual(value.preProofObservations,2);XCTAssertFalse(value.seedBeforeProof);XCTAssertTrue(value.originalSpent)
    }
    func testWireTombstoneSurvivesCancelledOperationWithNoChildState() throws {
        let value=try outcome(.duplicateWire);XCTAssertTrue(value.replayDenied);XCTAssertTrue(value.sameSigningKey)
        XCTAssertTrue(value.committed);XCTAssertEqual(value.signCalls,2);XCTAssertEqual(value.createCalls,1)
    }
    func testReceiptACKAfterOriginalExpiryRefusesWithoutDeletingWrittenSeed() throws {
        let value=try outcome(.expireBeforeReceiptACK);XCTAssertTrue(value.committed);XCTAssertTrue(value.receiptDenied)
        XCTAssertFalse(value.receiptKnown);XCTAssertTrue(value.seedExists);XCTAssertEqual(value.createCalls,1)
    }
    func testBackgroundBeforeOriginalReceiptACKRefusesWithoutResettingSeed() throws {
        let value=try outcome(.backgroundBeforeReceiptACK);XCTAssertTrue(value.committed);XCTAssertTrue(value.receiptDenied)
        XCTAssertFalse(value.receiptKnown);XCTAssertTrue(value.seedExists);XCTAssertEqual(value.createCalls,1)
    }
    func testRetirementWaitsForActualBlockedSigningInvocation() throws {
        let value=try outcome(.retirementWaitsForActualSign);XCTAssertTrue(value.retireWaited);XCTAssertFalse(value.committed)
        XCTAssertEqual(value.signCalls,1);XCTAssertEqual(value.createCalls,0)
    }
    func testRetirementWaitsForActualBlockedProvisionDespiteCancellationAndExpiry() throws {
        let value=try outcome(.retirementWaitsForActualProvision);XCTAssertTrue(value.retireWaited);XCTAssertTrue(value.provisionDenied)
        XCTAssertFalse(value.committed);XCTAssertTrue(value.originalSpent);XCTAssertTrue(value.seedExists);XCTAssertEqual(value.createCalls,1)
    }
    func testRetirementRetainsOriginalReceiptUntilActualUnknownSettlement() throws {
        let value=try outcome(.retirementWaitsForReceiptACK);XCTAssertTrue(value.retireWaited);XCTAssertTrue(value.committed)
        XCTAssertFalse(value.receiptKnown);XCTAssertTrue(value.seedExists);XCTAssertEqual(value.createCalls,1)
    }
    func testActualOwnedPrivateOperationMayTemporarilyMakeApplicationInactive() throws { control(try outcome(.ownedPromptInactive)) }
    func testInactivityOutsideOwnedPrivateOperationPermanentlyRevokesOriginal() throws {
        let value=try outcome(.inactiveAfterACK);XCTAssertTrue(value.provisionDenied);XCTAssertFalse(value.committed);XCTAssertEqual(value.createCalls,0)
    }
    func testBackgroundDuringOwnedPrivateOperationStillAlwaysRevokes() throws { try refusedSign(.backgroundDuringSign) }
    func testRetirementJoinsActualInFlightKnownSettlementCallback() throws {
        let value=try outcome(.retirementWaitsForActualSettlement);XCTAssertTrue(value.retireWaited);XCTAssertTrue(value.proofDenied)
        XCTAssertTrue(value.signatureVerified);XCTAssertFalse(value.committed);XCTAssertEqual(value.createCalls,0)
    }
    func testConcurrentOriginalRetireCannotReleaseHeldActualCleanupOrClearNewerRequest() throws {
        let value=try outcome(.concurrentRetireDuringActualCleanup)
        XCTAssertTrue(value.retireWaited);XCTAssertTrue(value.duplicateRetireDenied);XCTAssertTrue(value.secondRequestDenied)
        XCTAssertTrue(value.authorizeAfterRetireDenied);XCTAssertTrue(value.replayDenied);XCTAssertTrue(value.newerRequestPreserved)
        XCTAssertFalse(value.seedExists);XCTAssertEqual(value.signCalls,0);XCTAssertEqual(value.acquireCalls,0);XCTAssertEqual(value.createCalls,0)
    }
}

/** Authored synthetic LOCAL v2 codec/closed storage observations. These cases
 * are not installed Keychain/owner, trusted clock, input/KDF or Gate acceptance.
 * The existing forty first-install case bodies remain byte-exact above. */
final class PlanetChildLocalSnapshotV2RuntimeTests: XCTestCase {
    private final class Box {
        private let lock=NSLock()
        private var value: Result<PlanetChildLocalSnapshotV2Observation,Error>?
        func put(_ result: Result<PlanetChildLocalSnapshotV2Observation,Error>) { lock.lock();value=result;lock.unlock() }
        func get() throws -> PlanetChildLocalSnapshotV2Observation {
            lock.lock();defer { lock.unlock() }
            guard let value else { throw NSError(domain:"LocalSnapshotV2Fixture",code:1) };return try value.get()
        }
    }
    private func observe(_ scenario: PlanetChildLocalSnapshotV2Scenario) throws -> PlanetChildLocalSnapshotV2Observation {
        let done=expectation(description:scenario.rawValue),box=Box()
        Thread { box.put(Result { try PlanetChildLocalSnapshotV2RuntimeFixture.run(scenario) });done.fulfill() }.start()
        wait(for:[done],timeout:10);return try box.get()
    }
    func testV2PositiveLogicalEnrollmentRetainsSeedClockLowerBound() throws { XCTAssertTrue(try observe(.enrollment).pass) }
    func testV2IndependentProtectedDigestAndSavedDebtCrossBinding() throws { XCTAssertTrue(try observe(.crossBinding).pass) }
    func testV2MalformedUTF8ExtraFieldNoncanonicalAndWholeLimitDeny() throws { XCTAssertTrue(try observe(.canonicalBounds).pass) }
    func testV2ClockIsLowerBoundAndMayNotExceedPINAnchor() throws { XCTAssertTrue(try observe(.lowerBound).pass) }
    func testBareUnjournalledNullPINSeedNeverDecodesAsEnrolledWrapper() throws { XCTAssertTrue(try observe(.separateSeed).pass) }
    func testV2ChargeRequiresCooldownBoundaryAndPreservesNonPINBytes() throws { XCTAssertTrue(try observe(.charge).pass) }
    func testV2ReanchorKeepsProtectedBytesPendingAndFullSavedDebt() throws { XCTAssertTrue(try observe(.reanchor).pass) }
    func testV2FinalizationClassificationCannotChangeCredentialOrGrantMatch() throws { XCTAssertTrue(try observe(.finalization).pass) }
    func testV2RevisionOverflowAndWeakKDFPolicyDeny() throws { XCTAssertTrue(try observe(.overflow).pass) }
    func testWriterOriginalEnrollmentSampleAndOneChargedReservation() throws {
        let result=try observe(.originalSample);XCTAssertTrue(result.pass);XCTAssertEqual(result.operations,2)
    }
    func testWriterEarlyACKCopyAndSameWorkerRetirementDenyClosedUnknownSeals() throws {
        let result=try observe(.earlyAck);XCTAssertTrue(result.pass);XCTAssertEqual(result.operations,1)
    }
    func testWriterCancelledPublishedRecordPersistsAndStaleWholeCASDoesNotWrite() throws {
        let result=try observe(.cancelAndCAS);XCTAssertTrue(result.pass);XCTAssertEqual(result.operations,1)
    }
    func testWriterUnknownReadbackRetainsSealedCapacity() throws {
        let result=try observe(.unknownReadback);XCTAssertTrue(result.pass);XCTAssertEqual(result.operations,1)
    }
    func testOriginalKnownReceiptCopyJoinsActualCallbackBeforeRetirement() throws { XCTAssertTrue(try observe(.copyJoinsRetire).pass) }
}

/** Connected process clock fixtures use explicit synthetic scopes. They do not
 * establish real Keychain/OS restart, owner, input/KDF or Parent Gate acceptance. */
final class PlanetChildLocalProcessClockRuntimeTests: XCTestCase {
    private final class Box {
        private let lock=NSLock()
        private var value: Result<PlanetChildLocalProcessClockObservation,Error>?
        func put(_ result: Result<PlanetChildLocalProcessClockObservation,Error>) { lock.lock();value=result;lock.unlock() }
        func get() throws -> PlanetChildLocalProcessClockObservation {
            lock.lock();defer { lock.unlock() }
            guard let value else { throw NSError(domain:"LocalProcessClockFixture",code:1) };return try value.get()
        }
    }
    private func observe(_ scenario: PlanetChildLocalProcessClockScenario) throws -> PlanetChildLocalProcessClockObservation {
        let done=expectation(description:scenario.rawValue),box=Box()
        Thread { box.put(Result { try PlanetChildLocalProcessClockRuntimeFixture.run(scenario) });done.fulfill() }.start()
        wait(for:[done],timeout:15);return try box.get()
    }
    func testCooldownLongerThanSixtySecondsAccruesAcrossOriginalRequests() throws {
        let result=try observe(.longCooldown);XCTAssertTrue(result.pass);XCTAssertEqual(result.updates,2)
    }
    func testTwoWritersShareOneOriginalProcessLane() throws { XCTAssertTrue(try observe(.competingWriters).pass) }
    func testOriginalNanosecondRemainderSurvivesChargeACKAndReopen() throws {
        let result=try observe(.fractionalOrigin);XCTAssertTrue(result.pass);XCTAssertEqual(result.updates,3)
    }
    func testReplacementProcessReappliesFullDebtWithoutOutsideTimeCredit() throws {
        let result=try observe(.processReplacement);XCTAssertTrue(result.pass);XCTAssertEqual(result.updates,3)
    }
    func testUnknownReadbackPoisonsFreshWriterAndReleasesOnlyJoinedGraph() throws { XCTAssertTrue(try observe(.unknownReadback).pass) }
    func testDifferentDurableBytesCannotBeWarmAdoptedOrRestoredToRecoverCredit() throws { XCTAssertTrue(try observe(.unexpectedBytes).pass) }
    func testNativeContinuousRegressionAcrossRequestsInvalidatesProcessScope() throws { XCTAssertTrue(try observe(.regression).pass) }
    func testSafeLogicalOverflowKeepsFractionAndDeniesFutureRequests() throws { XCTAssertTrue(try observe(.overflow).pass) }
    func testKnownPrewriteCancelKeepsCreditAndStaleCleanupCannotPoisonNewLease() throws { XCTAssertTrue(try observe(.prewriteCancel).pass) }
    func testSamePolicyChecksumWithDifferentDelayTupleCannotCreateParallelClock() throws { XCTAssertTrue(try observe(.policyMismatch).pass) }
    func testLostColdReanchorACKInvalidatesBeforeActualOriginalRetirementJoins() throws { XCTAssertTrue(try observe(.lostColdACK).pass) }
    func testKnownACKRequiresFreshFullReadbackAndMismatchIsSticky() throws { XCTAssertTrue(try observe(.ACKReadbackMismatch).pass) }
}

/** New connected LOCAL v2 mechanics. Synthetic owned input/storage/key/clock
 * seams are explicit; these are authored tests, not installed native evidence. */
final class PlanetChildLocalPinOperationRuntimeTests: XCTestCase {
    private final class Box {
        private let lock=NSLock()
        private var result: Result<PlanetChildLocalPinOperationObservation,Error>?
        func put(_ value: Result<PlanetChildLocalPinOperationObservation,Error>) { lock.lock();result=value;lock.unlock() }
        func get() throws -> PlanetChildLocalPinOperationObservation {
            lock.lock();defer { lock.unlock() };guard let result else { throw NSError(domain:"LocalPinOperationFixture",code:1) };return try result.get()
        }
    }
    private func observe(_ scenario: PlanetChildLocalPinOperationScenario,file: StaticString=#filePath,line: UInt=#line) throws -> PlanetChildLocalPinOperationObservation {
        let done=expectation(description:scenario.rawValue),box=Box()
        Thread { box.put(Result { try PlanetChildLocalPinOperationRuntimeFixture.run(scenario) });done.fulfill() }.start()
        wait(for:[done],timeout:15);let value=try box.get();XCTAssertTrue(value.passed,file:file,line:line);return value
    }
    func testEnrollmentNeedsConfirmedOwnedInputActualKDFAndExactSignedOwnerOperation() throws {
        let value=try observe(.enrollment);XCTAssertEqual(value.updates,1);XCTAssertEqual(value.deriveCalls,1);XCTAssertEqual(value.signCalls,1);XCTAssertTrue(value.replyKnown)
    }
    func testChargeOriginalJournalAndKnownReadbackPrecedeKDF() throws {
        let value=try observe(.chargedBeforeKDF);XCTAssertTrue(value.chargedBeforeKDF);XCTAssertEqual(value.updates,2);XCTAssertTrue(value.matched)
    }
    func testOnlyMatchedOriginalReservationMayResetCountAfterFinalizationACKAndRetirement() throws {
        let value=try observe(.match);XCTAssertEqual(value.count,0);XCTAssertFalse(value.pending);XCTAssertTrue(value.matched);XCTAssertTrue(value.earlyDenied)
    }
    func testWrongOneDigitInputStaysChargedAndReceivesNoMatchCompletion() throws {
        let value=try observe(.mismatch);XCTAssertEqual(value.count,1);XCTAssertFalse(value.pending);XCTAssertFalse(value.matched)
    }
    func testMalformedNonemptyInputKeepsPersistentPendingDebtWithoutKDF() throws {
        let value=try observe(.malformed);XCTAssertEqual(value.count,1);XCTAssertTrue(value.pending);XCTAssertEqual(value.deriveCalls,0);XCTAssertEqual(value.updates,1)
    }
    func testEmptyInputCannotReserveAttempt() throws { let value=try observe(.empty);XCTAssertEqual(value.updates,0);XCTAssertEqual(value.deriveCalls,0) }
    func testDifferentConfirmationRefusesOwnerSignatureAndStorage() throws { let value=try observe(.confirmationMismatch);XCTAssertEqual(value.signCalls,0);XCTAssertEqual(value.updates,0) }
    func testBadActualOwnerSignatureCannotEnroll() throws { let value=try observe(.badOwnerSignature);XCTAssertEqual(value.signCalls,1);XCTAssertEqual(value.updates,0) }
    func testChangedPersistedOwnerKeyCannotEnroll() throws { let value=try observe(.ownerChanged);XCTAssertEqual(value.updates,0) }
    func testCancellationDuringOwnerSigningCannotEnroll() throws { let value=try observe(.ownerCancelled);XCTAssertEqual(value.updates,0) }
    func testOwnerKeyStillCheckedInsideActualPublicationBoundary() throws { let value=try observe(.changedKeyAtWrite);XCTAssertTrue(value.sealed);XCTAssertFalse(value.replyKnown) }
    func testUnknownChargeReadbackNeverEntersKDFAndPoisonsScope() throws { let value=try observe(.chargeReadbackMismatch);XCTAssertEqual(value.deriveCalls,0);XCTAssertTrue(value.sealed) }
    func testKDFErrorDoesNotRefundOriginalPendingAttempt() throws { let value=try observe(.kdfFailure);XCTAssertEqual(value.count,1);XCTAssertTrue(value.pending) }
    func testCancellationDuringActualKDFDoesNotRefund() throws { let value=try observe(.cancelDuringKDF);XCTAssertEqual(value.updates,1);XCTAssertTrue(value.pending) }
    func testOriginalExclusiveDeadlineDuringKDFDoesNotRefund() throws { let value=try observe(.expireDuringKDF);XCTAssertEqual(value.count,1);XCTAssertTrue(value.pending) }
    func testDifferentDurableBytesDuringKDFCannotFinalizeOrGrantMatch() throws { let value=try observe(.mutationDuringKDF);XCTAssertTrue(value.sealed);XCTAssertFalse(value.replyKnown) }
    func testUnknownFinalReadbackSealsDespiteCompletedKDF() throws { let value=try observe(.finalizationReadbackMismatch);XCTAssertTrue(value.sealed);XCTAssertFalse(value.replyKnown) }
    func testReplyACKInsideActualRecipientCannotBypassItsJoin() throws { XCTAssertTrue(try observe(.earlyReplyACK).earlyDenied) }
    func testUnknownTerminalACKNeverGrantsMatch() throws { XCTAssertFalse(try observe(.unknownReplyACK).matched) }
    func testOriginalReplyAndMatchedCompletionAreBothOneUse() throws { XCTAssertTrue(try observe(.replyReplay).earlyDenied) }
    func testEqualFieldForeignChallengeCannotTakeOriginalCompletion() throws { XCTAssertTrue(try observe(.foreignChallenge).earlyDenied) }
    func testWrongOriginalProfileScopeRefusesBeforeCharge() throws { let value=try observe(.scopeMismatch);XCTAssertEqual(value.updates,0);XCTAssertTrue(value.denied) }
    func testOriginalOperationIdentityCannotBeReusedByLaterLease() throws { XCTAssertTrue(try observe(.replayOperation).earlyDenied) }
    func testManufacturedComparisonCannotConsumeOriginalFinalization() throws { XCTAssertTrue(try observe(.forgedComparison).earlyDenied) }
    func testThrowingActualTerminalRecipientRetainsUnknownACKAndNoMatch() throws { let value=try observe(.recipientThrows);XCTAssertTrue(value.denied);XCTAssertFalse(value.matched) }
    func testRetirementWaitsForBlockedActualKDFInvocation() throws { let value=try observe(.retirementWaitsForKDF);XCTAssertTrue(value.retirementJoined);XCTAssertEqual(value.updates,1) }
    func testRetirementWaitsForBlockedActualTerminalRecipientAndOriginalACK() throws { XCTAssertTrue(try observe(.retirementWaitsForRecipient).retirementJoined) }
    func testRetiredKnownCompletionCannotRenewOriginalDeadline() throws { let value=try observe(.expiredAfterRetirement);XCTAssertTrue(value.denied);XCTAssertFalse(value.matched) }
    func testRetiredKnownCompletionRequiresFreshExactFullReadback() throws { let value=try observe(.changedAfterRetirement);XCTAssertTrue(value.denied);XCTAssertFalse(value.matched) }
    func testClosedLifecycleLatchCannotBeResurrectedByForegroundReturn() throws { let value=try observe(.lifecycleAfterRetirement);XCTAssertTrue(value.denied);XCTAssertFalse(value.matched) }
    func testOnlyOriginalPendingNativeOwnerPromptMayTemporarilyResignActive() throws { let value=try observe(.ownedPromptInactive);XCTAssertTrue(value.replyKnown);XCTAssertEqual(value.signCalls,1) }
    func testRealBackgroundDuringOwnedPromptAlwaysRevokesOriginal() throws { let value=try observe(.backgroundDuringOwner);XCTAssertTrue(value.denied);XCTAssertEqual(value.updates,0) }
    func testOwnedPromptCannotBypassOriginalExclusiveDeadline() throws { let value=try observe(.expireDuringOwner);XCTAssertTrue(value.denied);XCTAssertEqual(value.updates,0) }
}

/** New LOCAL Gate provenance/refusal mechanics, authored NOT_COMPILED/NOT_RUN.
 * Canonical fixtures authenticate no parent and admit no child data. */
final class PlanetChildLocalGateHostRuntimeTests: XCTestCase {
    private func observe(_ scenario: PlanetChildLocalGateScenario,file: StaticString=#filePath,line: UInt=#line) throws -> PlanetChildLocalGateObservation {
        let value=try PlanetChildLocalGateRuntimeFixture.run(scenario);XCTAssertTrue(value.passed,file:file,line:line);return value
    }
    func testGateDerivesExactSelectedProfileLocaleAndRevisionsFromCanonicalRecord() throws {
        let value=try observe(.selectedContext);XCTAssertEqual(value.profileRevision,4);XCTAssertEqual(value.selectionRevision,7)
    }
    func testGateRejectsProfileRouteAndSelectedRegistrySubstitution() throws { _ = try observe(.contextSubstitution) }
    func testGateOwnsOriginalTargetAndCannotReconstructOriginalChallenge() throws { XCTAssertEqual(try observe(.targetOwnership).deadline,3100000000) }
    func testGatePreservesOriginalExclusiveDeadlineAndStickyRevocation() throws { _ = try observe(.exclusiveDeadline) }
    func testMissingOriginalCompletionSpendsTransferWithoutAnyRetry() throws { _ = try observe(.failedTransfer) }
    func testAllSixteenExistingActionsRemainExactAndUnknownActionIsRefused() throws { XCTAssertEqual(try observe(.actions).actionCount,16) }
    func testAdultRecordCannotProduceChildGateContext() throws { _ = try observe(.adultContext) }
    func testChangedInitialCanonicalRevisionCannotStartOriginalGate() throws { _ = try observe(.initialRevision) }
    func testActualUIKitControllerWithoutOriginalWindowCannotCreateGateHost() throws {
        let value=try (Thread.isMainThread ? PlanetChildLocalGateRuntimeFixture.unattachedUIKitHostIsRefused():DispatchQueue.main.sync { try PlanetChildLocalGateRuntimeFixture.unattachedUIKitHostIsRefused() })
        XCTAssertTrue(value)
    }
}

/** First-profile transition leaves. Authored NOT_COMPILED/NOT_RUN; these
 * canonical data cases establish no OS owner or child-data admission. */
final class PlanetChildLocalProfileBootstrapRuntimeTests: XCTestCase {
    private func profile(_ locale: String="en") -> Data { Data("{\"id\":\"reader\",\"label\":\"Native Reader\",\"exactAge\":9,\"ageBand\":\"9-11\",\"locale\":\"\(locale)\",\"ageConfirmedAt\":\"2026-10-01T12:00:00.000Z\",\"readingLevel\":null,\"allowedTopics\":[\"nature\"],\"blockedTopics\":[\"horror\"],\"soundEnabled\":false,\"motion\":\"calm\",\"narrationEnabled\":false,\"localeLocked\":true}".utf8) }
    func testFirstProfilePreservesOriginalVerifierPendingCountWholeDebtAndClock() throws {
        let old=try PlanetChildLocalProfileRuntimeFixture.enrolled(),next=try PlanetChildLocalProfileRuntimeFixture.transition(old,profile:profile("ru"))
        XCTAssertEqual(try PlanetChildLocalProfileRuntimeFixture.pinTail(old),try PlanetChildLocalProfileRuntimeFixture.pinTail(next))
        let value=try PlanetChildLocalProfileRuntimeFixture.inspect(next);XCTAssertEqual(value.root,6);XCTAssertEqual(value.pin,4);XCTAssertEqual(value.journal,5)
        XCTAssertEqual(value.count,2);XCTAssertEqual(value.debt,250);XCTAssertEqual(value.observed,17);XCTAssertEqual(value.pending,String(repeating:"f",count:64));XCTAssertEqual(value.profile,"reader");XCTAssertEqual(value.locale,"ru")
    }
    func testUnenrolledSeedAndAlreadySelectedRegistryCannotCreateFirstProfile() throws {
        let seed=try PlanetChildLocalProfileRuntimeFixture.seed();XCTAssertThrowsError(try PlanetChildLocalProfileRuntimeFixture.transition(seed,profile:profile()))
        let first=try PlanetChildLocalProfileRuntimeFixture.transition(PlanetChildLocalProfileRuntimeFixture.enrolled(),profile:profile());XCTAssertThrowsError(try PlanetChildLocalProfileRuntimeFixture.transition(first,profile:profile()))
    }
    func testMismatchedAgeUnknownDuplicateAndInvalidUtf8CannotEnterProfileTransition() throws {
        let text=String(decoding:profile(),as:UTF8.self)
        for invalid in [text.replacingOccurrences(of:"\"9-11\"",with:"\"6-8\""),text.replacingOccurrences(of:"\"locale\":\"en\"",with:"\"locale\":\"de\""),text.replacingOccurrences(of:"\"label\":",with:"\"extra\":true,\"label\":"),text.replacingOccurrences(of:"\"exactAge\":9",with:"\"exactAge\":9,\"exactAge\":9")] { XCTAssertThrowsError(try PlanetChildLocalProfileRuntimeFixture.profileId(Data(invalid.utf8))) }
        XCTAssertThrowsError(try PlanetChildLocalProfileRuntimeFixture.profileId(Data([0xc3,0x28])))
    }
    func testRevisionOverflowAndOtherwiseValidRefundedPinSnapshotCannotPublish() throws {
        let edge=try PlanetChildLocalProfileRuntimeFixture.enrolled(root:9007199254740991);XCTAssertThrowsError(try PlanetChildLocalProfileRuntimeFixture.transition(edge,profile:profile()))
        let old=try PlanetChildLocalProfileRuntimeFixture.enrolled(),next=try PlanetChildLocalProfileRuntimeFixture.transition(old,profile:profile()),refund=try PlanetChildLocalProfileRuntimeFixture.refunded(next)
        XCTAssertThrowsError(try PlanetChildLocalProfileRuntimeFixture.validate(old,refund));XCTAssertEqual(try PlanetChildLocalProfileRuntimeFixture.inspect(next).count,2)
    }
    func testNativeGeneratedIdReplacesProposalIdWithoutChangingParentConfirmedSettings() throws {
        let original=profile("ru"),id="child-0123456789abcdef0123456789abcdef",native=try PlanetChildLocalProfileRuntimeFixture.nativeProfile(original,id:id)
        XCTAssertEqual(try PlanetChildLocalProfileRuntimeFixture.profileId(native),id)
        XCTAssertEqual(String(decoding:native,as:UTF8.self),String(decoding:original,as:UTF8.self).replacingOccurrences(of:"\"id\":\"reader\"",with:"\"id\":\"\(id)\""))
    }
}

/** Authored NOT_COMPILED/NOT_RUN. These tests call actual canonical transition
 * and refusal leaves; they supply no fabricated closed successful terminal. */
final class PlanetChildLocalCanonicalMutationTests: XCTestCase {
    private func profile() -> Data { Data(#"{"id":"reader","label":"Native Reader","exactAge":9,"ageBand":"9-11","locale":"en","ageConfirmedAt":"2026-10-01T12:00:00.000Z","readingLevel":null,"allowedTopics":["nature"],"blockedTopics":["horror"],"soundEnabled":false,"motion":"calm","narrationEnabled":false,"localeLocked":true}"#.utf8) }
    private func changed(_ from: String,_ to: String) -> Data { Data(String(decoding:profile(),as:UTF8.self).replacingOccurrences(of:from,with:to).utf8) }
    private func child() throws -> Data { try PlanetChildLocalCanonicalRuntimeFixture.child(profile()) }
    private func digest(_ bytes: Data) -> String { SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() }
    func testAdultExitPreservesSelectedRegistryPinWholeDebtAndClock() throws {
        let before=try child(),after=try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"exit-child-mode",target:Data())
        try PlanetChildLocalCanonicalRuntimeFixture.withoutPackage(before,action:"exit-child-mode",target:Data());try PlanetChildLocalCanonicalRuntimeFixture.validate(before,after,action:"exit-child-mode",target:Data())
        XCTAssertEqual(try PlanetChildLocalProfileRuntimeFixture.pinTail(before),try PlanetChildLocalProfileRuntimeFixture.pinTail(after))
        let value=try PlanetChildLocalCanonicalRuntimeFixture.inspect(after);XCTAssertEqual(value.mode,"adult");XCTAssertEqual(value.root,7);XCTAssertEqual(value.journal,6);XCTAssertEqual(value.selection,3);XCTAssertEqual(value.profile,2)
        XCTAssertEqual(value.pin,4);XCTAssertEqual(value.count,2);XCTAssertEqual(value.debt,250);XCTAssertEqual(value.observed,17);XCTAssertEqual(value.pending,String(repeating:"f",count:64))
        XCTAssertTrue(try PlanetChildLocalCanonicalRuntimeFixture.protectedText(after).contains("\"activeProfileId\":\"reader\""))
    }
    func testSwitchAdultRetainsExactActionAndRejectsTargetOrSeventeenthAction() throws {
        let before=try child();try PlanetChildLocalCanonicalRuntimeFixture.withoutPackage(before,action:"switch-adult-profile",target:Data())
        XCTAssertEqual(try PlanetChildLocalCanonicalRuntimeFixture.inspect(PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"switch-adult-profile",target:Data())).mode,"adult")
        for action in ["exit-child-mode","switch-adult-profile"] { XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:action,target:Data(#"{"profileId":"reader"}"#.utf8))) }
        for action in ["enter-child-mode","share"] { XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:action,target:Data())) }
    }
    func testAgePreparationRetainsPreviousSafeRecordUntilReviewedPackage() throws {
        let before=try child(),saved=before,target=changed("\"exactAge\":9,\"ageBand\":\"9-11\"","\"exactAge\":8,\"ageBand\":\"6-8\"")
        let next=try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"change-exact-age",target:target);XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.withoutPackage(before,action:"change-exact-age",target:target))
        XCTAssertEqual(before,saved);let value=try PlanetChildLocalCanonicalRuntimeFixture.inspect(next);XCTAssertEqual(value.selection,3);XCTAssertEqual(value.profile,3)
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"change-exact-age",target:Data(String(decoding:target,as:UTF8.self).replacingOccurrences(of:"\"soundEnabled\":false",with:"\"soundEnabled\":true").utf8)))
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"change-exact-age",target:changed("\"exactAge\":9","\"exactAge\":8")))
    }
    func testTopicsAndSettingsCannotSmuggleIdAgeOrOtherFields() throws {
        let before=try child(),topics=changed("[\"horror\"]","[\"horror\",\"violence\"]"),settings=changed("\"soundEnabled\":false","\"soundEnabled\":true")
        _ = try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"change-blocked-topics",target:topics);_ = try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"expand-access-settings",target:settings)
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.withoutPackage(before,action:"change-blocked-topics",target:topics));XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.withoutPackage(before,action:"expand-access-settings",target:settings))
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"change-blocked-topics",target:settings));XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"expand-access-settings",target:changed("\"id\":\"reader\"","\"id\":\"other\"")))
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"expand-access-settings",target:changed("\"exactAge\":9,\"ageBand\":\"9-11\"","\"exactAge\":8,\"ageBand\":\"6-8\"")));XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"expand-access-settings",target:profile()))
    }
    func testSelectionRequiresExistingExactProfileAndRealAdmission() throws {
        let before=try child(),text=try PlanetChildLocalCanonicalRuntimeFixture.protectedText(before),profile=String(decoding:profile(),as:UTF8.self),second=profile.replacingOccurrences(of:"\"id\":\"reader\"",with:"\"id\":\"second\"").replacingOccurrences(of:"\"locale\":\"en\"",with:"\"locale\":\"ru\"")
        let registry="{\"schemaVersion\":1,\"policyVersion\":\"\(PlanetChildLocalProfileRuntimeFixture.version)\",\"activeProfileId\":\"reader\",\"profiles\":[\(profile)]}",nextRegistry=registry.replacingOccurrences(of:profile,with:profile+","+second)
        let two=try PlanetChildLocalCanonicalRuntimeFixture.repack(before,protectedText:text.replacingOccurrences(of:registry,with:nextRegistry).replacingOccurrences(of:digest(Data(registry.utf8)),with:digest(Data(nextRegistry.utf8))))
        let target=Data(#"{"profileId":"second"}"#.utf8),next=try PlanetChildLocalCanonicalRuntimeFixture.prepare(two,action:"expand-access-settings",target:target)
        XCTAssertTrue(try PlanetChildLocalCanonicalRuntimeFixture.protectedText(next).contains("\"activeProfileId\":\"second\""));XCTAssertEqual(try PlanetChildLocalCanonicalRuntimeFixture.inspect(next).profile,3)
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.withoutPackage(two,action:"expand-access-settings",target:target))
        for invalid in [#"{"profileId":"missing"}"#,#"{"profileId":"second","mode":"adult"}"#] { XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(two,action:"expand-access-settings",target:Data(invalid.utf8))) }
    }
    func testOtherwiseValidRefundAndUncoupledRevisionCannotPassCanonicalValidation() throws {
        let before=try child(),after=try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"exit-child-mode",target:Data()),refund=try PlanetChildLocalProfileRuntimeFixture.refunded(after)
        let uncoupled=try PlanetChildLocalCanonicalRuntimeFixture.repack(after,protectedText:PlanetChildLocalCanonicalRuntimeFixture.protectedText(after).replacingOccurrences(of:"\"profileRevision\":2",with:"\"profileRevision\":3"))
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.validate(before,refund,action:"exit-child-mode",target:Data()));XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.validate(before,uncoupled,action:"exit-child-mode",target:Data()))
        XCTAssertEqual(try PlanetChildLocalCanonicalRuntimeFixture.inspect(before).count,2);XCTAssertEqual(try PlanetChildLocalCanonicalRuntimeFixture.inspect(before).debt,250)
    }
    func testSpentOrMissingTerminalCannotMintOriginalExecution() throws { XCTAssertTrue(try PlanetChildLocalCanonicalRuntimeFixture.originalExecutionRefusesAbsentTerminal(child())) }
    func testOverflowAdultReentryAndMalformedInputRemainClosed() throws {
        let before=try child(),edge=try PlanetChildLocalCanonicalRuntimeFixture.repack(before,protectedText:PlanetChildLocalCanonicalRuntimeFixture.protectedText(before).replacingOccurrences(of:"\"selectionRevision\":2",with:"\"selectionRevision\":9007199254740991"))
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(edge,action:"exit-child-mode",target:Data()))
        let adult=try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"exit-child-mode",target:Data());XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(adult,action:"expand-access-settings",target:profile()))
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"change-exact-age",target:Data([0xc3,0x28])))
    }
}

/** AUTHORED NOT_COMPILED/NOT_RUN. Software key/time mechanics only, no actual
 * window/Back/Bundle, human editorial approval, storage or release acceptance. */
final class PlanetChildNativePackageCompilerTests: XCTestCase {
    func testStrictJsonRefusesDuplicateEscapesUtf8DepthAndUnsafeNumbers() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("json")) }
    func testIndependentReviewCompilesExactOwnedPayloadAndRetiresIndex() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("valid")) }
    func testSavedCanonicalProfilePreservesPinJournalAndRefusesAdultMode() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("binding")) }
    func testSignedAudienceCannotSubstituteReadingAgeLocalePlatformTerritory() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("audience")) }
    func testFlagsCannotReplaceIndependentPinnedReviewerAndExactReviewBytes() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("trust")) }
    func testMissingDuplicateOrUnreviewedReferencePolicyClosureFails() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("closure")) }
    func testPaidUnreviewedFutureAndExpiredRightsFail() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("rights")) }
    func testUnknownAssetsMediaUrlsAndPayloadQuotasCannotEscalate() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("escalation")) }
    func testOriginalCancellationAndExclusiveExpiryCannotPublishPayload() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("expiry")) }
    func testDeliveryCopiesRecheckAfterCloneAndRetireEveryBorrowedValue() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("delivery")) }
    func testCatalogRequiresExactOriginalPinSourceInventoryAndNativeChannel() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("catalog")) }
}


/** Authored native production-leaf mechanics; no OS storage/host acceptance. */
final class PlanetChildNativeAdmittedDataTests: XCTestCase {
    func testOwnedPayloadClosureSupportsOriginalFourDurablePurposes() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("admittedOwned")) }
    func testEveryScopeCoordinateRejectsSubstitution() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("admittedScope")) }
    func testStructuralChecksumsCannotAuthorizeForgedPayloadOrClosure() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("admittedPayload")) }
    func testHistoryAndSearchRequireCurrentReviewedWrapperReferences() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("admittedRefs")) }
    func testPreparedMigrationUsesFutureScopeAndPreservesPinJournalDebt() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("admittedMigration")) }
    func testExpiryAndRetiredIndexRefuseValidationAndMigration() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("admittedExpiry")) }
    func testSelectionKeepsOtherChildHistoryAndFavoritesWithOverlappingEntities() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("admittedIsolation")) }
    func testDurableSealRefusesTruncationUnknownTrailerAndForeignActiveScope() throws { XCTAssertTrue(try PlanetChildDataStore.fixtureAdmittedSealCodec()) }
    func testPublicationRechecksExpiryAfterFreshAndClosedIndex() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.run("admittedPublication")) }
}

/** AUTHORED_NOT_RUN. Production structural/native ownership leaves only.
 * No fabricated native terminal, owner key, package admission or App activation. */
final class PlanetChildNativeProfileEntryTests: XCTestCase {
    private func profile() -> Data { Data(#"{"id":"reader","label":"Native Reader","exactAge":9,"ageBand":"9-11","locale":"en","ageConfirmedAt":"2026-10-01T12:00:00.000Z","readingLevel":null,"allowedTopics":["nature"],"blockedTopics":["horror"],"soundEnabled":false,"motion":"calm","narrationEnabled":false,"localeLocked":true}"#.utf8) }
    private func child() throws -> Data { try PlanetChildLocalCanonicalRuntimeFixture.child(profile()) }
    private func adult() throws -> Data { try PlanetChildLocalCanonicalRuntimeFixture.prepare(child(),action:"exit-child-mode",target:Data()) }
    private func draft() -> Data { Data(("{\"createProfile\":"+String(decoding:profile(),as:UTF8.self).replacingOccurrences(of:"\"id\":\"reader\",",with:"")+"}").utf8) }
    func testAdultReentryKeepsExistingUidAndExactPinDebtJournalCoordinates() throws {
        let before=try adult(),target=Data(#"{"profileId":"reader"}"#.utf8),next=try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"expand-access-settings",target:target)
        try PlanetChildLocalCanonicalRuntimeFixture.validate(before,next,action:"expand-access-settings",target:target)
        let a=try PlanetChildLocalCanonicalRuntimeFixture.inspect(before),b=try PlanetChildLocalCanonicalRuntimeFixture.inspect(next)
        XCTAssertEqual(b.mode,"child");XCTAssertEqual(b.root,a.root+1);XCTAssertEqual(b.journal,a.journal+1);XCTAssertEqual(b.selection,a.selection+1);XCTAssertEqual(b.profile,a.profile)
        XCTAssertEqual(try PlanetChildLocalProfileRuntimeFixture.pinTail(before),try PlanetChildLocalProfileRuntimeFixture.pinTail(next));XCTAssertEqual(b.count,a.count);XCTAssertEqual(b.debt,a.debt);XCTAssertEqual(b.pending,a.pending)
        XCTAssertEqual(try PlanetChildLocalCanonicalRuntimeFixture.retainedProfileJson(before,id:"reader"),try PlanetChildLocalCanonicalRuntimeFixture.retainedProfileJson(next,id:"reader"))
    }
    func testAdultExitAndReentryHaveDistinctFullCanonicalBindings() throws {
        let before=try child(),exit=try adult(),reentry=try PlanetChildLocalCanonicalRuntimeFixture.prepare(exit,action:"expand-access-settings",target:Data(#"{"profileId":"reader"}"#.utf8))
        XCTAssertNotEqual(try PlanetChildLocalCanonicalRuntimeFixture.contextBinding(before),try PlanetChildLocalCanonicalRuntimeFixture.contextBinding(exit));XCTAssertNotEqual(try PlanetChildLocalCanonicalRuntimeFixture.contextBinding(exit),try PlanetChildLocalCanonicalRuntimeFixture.contextBinding(reentry))
    }
    func testRawNativeCreationMintsUidAndRejectsCallerIdBeforeChecksum() throws {
        let a=try PlanetChildLocalCanonicalRuntimeFixture.nativeCreationTarget(draft()),b=try PlanetChildLocalCanonicalRuntimeFixture.nativeCreationTarget(draft())
        XCTAssertNotEqual(a.id,b.id);XCTAssertNotNil(a.id.range(of:"\\Aprofile-[a-f0-9]{32}\\z",options:.regularExpression));XCTAssertTrue(String(decoding:a.bytes,as:UTF8.self).contains("\"id\":\""+a.id+"\""))
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.nativeCreationTarget(Data(("{\"createProfile\":"+String(decoding:profile(),as:UTF8.self)+"}").utf8)))
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.nativeCreationTarget(Data(#"{"createProfile":{"label":"Incomplete"}}"#.utf8)))
    }
    func testOriginalNativeCreationOwnsEffectiveTargetAndCannotTransferAbsentPinTerminal() throws { XCTAssertTrue(try PlanetChildLocalCanonicalRuntimeFixture.nativeInvocationOwnsCreation(draft(),adult())) }
    func testAdditionalCreationPreservesAAndOriginalPinWhileAddingOnlyNewProfile() throws {
        let before=try adult(),target=try PlanetChildLocalCanonicalRuntimeFixture.nativeCreationTarget(draft()),next=try PlanetChildLocalCanonicalRuntimeFixture.prepare(before,action:"expand-access-settings",target:target.bytes)
        try PlanetChildLocalCanonicalRuntimeFixture.validate(before,next,action:"expand-access-settings",target:target.bytes)
        XCTAssertEqual(try PlanetChildLocalCanonicalRuntimeFixture.retainedProfileJson(before,id:"reader"),try PlanetChildLocalCanonicalRuntimeFixture.retainedProfileJson(next,id:"reader"));XCTAssertEqual(try PlanetChildLocalProfileRuntimeFixture.pinTail(before),try PlanetChildLocalProfileRuntimeFixture.pinTail(next))
        XCTAssertTrue(try PlanetChildLocalCanonicalRuntimeFixture.protectedText(next).contains("\"activeProfileId\":\""+target.id+"\""));XCTAssertEqual(try PlanetChildLocalCanonicalRuntimeFixture.inspect(next).profile,3)
    }
    func testCreationBoundedFourAndEffectiveUidCannotReuseExistingProfile() throws {
        var current=try adult(),last=Data()
        for _ in 0..<3 { let target=try PlanetChildLocalCanonicalRuntimeFixture.nativeCreationTarget(draft());last=target.bytes;current=try PlanetChildLocalCanonicalRuntimeFixture.prepare(current,action:"expand-access-settings",target:target.bytes) }
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(current,action:"expand-access-settings",target:last))
        let fifth=try PlanetChildLocalCanonicalRuntimeFixture.nativeCreationTarget(draft());XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(current,action:"expand-access-settings",target:fifth.bytes))
        XCTAssertNotNil(try PlanetChildLocalCanonicalRuntimeFixture.retainedProfileJson(current,id:"reader"))
    }
    func testAdultScopeAllowsOnlyOriginalExpansionAndUnknownReentryNeverAdopts() throws {
        let saved=try adult();try PlanetChildLocalCanonicalRuntimeFixture.adultGateAction(saved,action:"expand-access-settings")
        for action in ["exit-child-mode","switch-adult-profile","change-exact-age","share","enter-child-mode"] { XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.adultGateAction(saved,action:action)) }
        for target in [#"{"profileId":"unknown"}"#,#"{"profileId":"reader","mode":"child"}"#] { XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(saved,action:"expand-access-settings",target:Data(target.utf8))) }
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.prepare(child(),action:"expand-access-settings",target:Data(#"{"profileId":"reader"}"#.utf8)))
    }
    func testPreparedReentryAndCreationCannotSubstituteForRealReviewedPackageAdmission() throws {
        let saved=try adult(),target=try PlanetChildLocalCanonicalRuntimeFixture.nativeCreationTarget(draft())
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.withoutPackage(saved,action:"expand-access-settings",target:Data(#"{"profileId":"reader"}"#.utf8)))
        XCTAssertThrowsError(try PlanetChildLocalCanonicalRuntimeFixture.withoutPackage(saved,action:"expand-access-settings",target:target.bytes))
    }
}


/** AUTHORED_NOT_RUN. SDK parser/codec/native construction mechanics only;
 * these tests confer no hardware acceptance or authenticated child readiness. */
final class PlanetChildLocalV2AppFirstInstallTests: XCTestCase {
    private func draft() -> Data { Data(#"{"label":"Native Reader","exactAge":9,"locale":"en","readingLevel":null,"allowedTopics":["nature"],"blockedTopics":["horror"],"soundEnabled":false,"motion":"calm","narrationEnabled":false}"#.utf8) }
    func testLocalV2AppPolicyIsFixedAndFactorySelectsNativeOwner() throws { XCTAssertEqual(PlanetChildLocalV2SDKPolicy.checksum,"2a9fb86861697ae053d0af87b40bdd53e2454700520a96d36a456414b9014d8c");XCTAssertFalse(PlanetChildLocalV2SDKPolicy.canonical.hasSuffix("\n"));XCTAssertTrue(try PlanetChildLocalV2SDKRuntimeFixture.factorySelected()) }
    func testLocalV2AppBootstrapRejectsUnknownSeedWithoutSignedInstallTerminal() throws {
        let seed=try PlanetChildVault.LocalEmptySeedV2.canonicalBytes(policyVersion:"child-local-v2.1",policyChecksum:PlanetChildLocalV2SDKPolicy.checksum);XCTAssertTrue(try PlanetChildLocalV2SDKRuntimeFixture.rejectsUnknownTerminal(seed))
        XCTAssertTrue(try PlanetChildLocalV2SDKRuntimeFixture.rejectsUnknownTerminal(Data(#"{"schemaVersion":2,"kind":"LP-LOCAL-V2-FIRST-INSTALL-KNOWN","seed":"YQ==","payload":"YQ==","signature":"YQ==","publicKey":"YQ==","known":true}"#.utf8)))
    }
    func testLocalV2AppWireKeepsOriginalV2ClockAndActionVocabulary() throws { XCTAssertTrue(try PlanetChildLocalV2SDKRuntimeFixture.originalDeadline());XCTAssertEqual(PlanetChildLocalV2Wire.gateActions.count,16);XCTAssertFalse(PlanetChildLocalV2Wire.gateActions.contains("enter-child"));XCTAssertTrue(PlanetChildLocalV2Wire.actions.contains("first-install"));XCTAssertFalse(PlanetChildLocalV2Wire.actions.contains("initial-install")) }
    func testLocalV2AppProfileDraftOwnsBirthFieldsAndRejectsCallerId() throws {
        let original=draft(),profile=try PlanetChildLocalV2SDKRuntimeFixture.profile(original),row=try XCTUnwrap(JSONSerialization.jsonObject(with:profile) as? [String:Any]);XCTAssertEqual(row["id"] as? String,"native-pending");XCTAssertEqual(row["ageBand"] as? String,"9-11");XCTAssertNotNil(row["ageConfirmedAt"] as? String)
        for key in ["id","ageConfirmedAt","ageBand","known","ownerToken"] { var bad=try XCTUnwrap(JSONSerialization.jsonObject(with:original) as? [String:Any]);bad[key]="caller-owned";XCTAssertThrowsError(try PlanetChildLocalV2SDKRuntimeFixture.profile(JSONSerialization.data(withJSONObject:bad))) }
    }
    func testLocalV2AppPinSuccessorKeepsSavedDebtAndNonPinBytes() throws { XCTAssertTrue(try PlanetChildLocalV2SDKRuntimeFixture.pinSuccessor()) }
    func testLocalV2AppKnownUnboundBirthExitRequiresExactSignedEmptyOrigin() throws { for scenario in ["known-shape","foreign-uid","foreign-content","foreign-nonce","foreign-empty","extra-profile","already-bound","advanced"] { XCTAssertTrue(try PlanetChildDataStore.fixtureSDKUnboundOrigin(scenario),scenario) } }
}
