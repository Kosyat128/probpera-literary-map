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
