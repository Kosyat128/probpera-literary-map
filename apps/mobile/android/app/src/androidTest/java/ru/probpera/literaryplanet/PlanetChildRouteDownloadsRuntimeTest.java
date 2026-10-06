package ru.probpera.literaryplanet;

import android.content.Context;
import android.os.Bundle;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.*;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;

/** AUTHORED_NOT_RUN. Actual encrypted storage leaves are isolated to this
 * explicit debuggable run. They never mint original child/profile admission. */
public final class PlanetChildRouteDownloadsRuntimeTest {
    private final Bundle args=InstrumentationRegistry.getArguments();
    private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    @Before public void ownRun(){assertEquals("local-v2-child-bilingual-offline",args.getString("literaryChildRouteDownloadPhase"));assertTrue(args.getString("literaryRunId","").matches("[a-f0-9]{32}"));}
    private String run(){return UUID.randomUUID().toString().replace("-","");}
    private interface Checked {void call()throws Exception;}
    private static void denied(Checked call)throws Exception {boolean denied=false;try{call.call();}catch(Exception unavailable){denied=true;}assertTrue("expected closed refusal",denied);}
    private static Map<String,Object> request(boolean revision){Map<String,Object> row=new LinkedHashMap<>();row.put("version",2L);row.put("requestId","1".repeat(32));row.put("contextToken","2".repeat(32));row.put("journeyId","journey-one");if(revision)row.put("expectedRevision",7L);return row;}
    @Test public void newWireOwnsNoProfileLocaleBytesAuthorityOrPaths()throws Exception {for(String method:Arrays.asList("readJourneyRouteDownload","saveJourneyRoute","resumeJourneyRoute","cancelJourneyRoute")){boolean mutation=!method.startsWith("read");Map<String,Object> value=request(mutation);assertEquals("journey-one",PlanetChildDataTransport.decodeV2(method,value).journeyId);for(String field:Arrays.asList("url","bytes","base64","sha256","profileId","locale","approved","reviewKey","policyGrant","path","offset","generation","installId")){Map<String,Object> extra=new LinkedHashMap<>(value);extra.put(field,"caller");denied(()->PlanetChildDataTransport.decodeV2(method,extra));}if(mutation){value.put("expectedRevision",9007199254740990L);denied(()->PlanetChildDataTransport.decodeV2(method,value));}}}
    @Test public void prefixAndLocaleStagesSurviveEncryptedReopen()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadPersistence(context,run(),"reopen"));}
    @Test public void fullOriginal32MiBRasterIsDurableOutsideCompactManifest()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadPersistence(context,run(),"full-bound"));}
    @Test public void encryptedObjectTamperingCannotBecomeDownloaded()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadPersistence(context,run(),"tamper"));}
    @Test public void copiedSiblingCiphertextCannotCrossProfileAAD()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadPersistence(context,run(),"wrong-profile-aad"));}
    @Test public void unindexedInterruptedFileIsUnreadableAndOwnOrphanPrunePreservesSibling()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadPersistence(context,run(),"orphan"));}
    @Test public void stagedCancellationLeavesExactActivePriorAndSibling()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadPersistence(context,run(),"cancel-prior"));}
    @Test public void parentDownloadClearPhysicallyRemovesOwnObjectsAndStagesOnly()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadPersistence(context,run(),"downloads-clear"));}
    @Test public void parentProfileClearPreservesSiblingRevisionAndObject()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadPersistence(context,run(),"profile-clear"));}
    @Test public void originalHistoryClearAlsoRetiresOwnDownloads()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadPersistence(context,run(),"history-clear"));}
    @Test public void ruEnManifestIdentityDiffersButCommonBinaryHasOneOwnCatalogObject()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadPersistence(context,run(),"locale-dedup"));}
    @Test public void corruptDurableCatalogIsDeniedWithoutEmptyReset()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadPersistence(context,run(),"catalog-corrupt"));}
    @Test public void unknownFinalActivationMarkerNeverBecomesResumeAcknowledgement()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadPersistence(context,run(),"uncertain-final-deny"));}
    @Test public void lateCancellationAfterCompleteRetainsCommittedRouteAndTerminalReadyFacts()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadPersistence(context,run(),"late-cancel-completed"));}
    @Test public void originalObjectBoundsAndUnsupportedFormatRemainClosed()throws Exception {String hash="a".repeat(64);assertEquals(33554432,new PlanetChildRouteDownload.ObjectRef("fixture-reader-one",hash,"image/png",33554432).bytes);assertEquals(25165824,new PlanetChildRouteDownload.ObjectRef("fixture-reader-one",hash,"audio/wav",25165824).bytes);denied(()->new PlanetChildRouteDownload.ObjectRef("fixture-reader-one",hash,"image/png",33554433));denied(()->new PlanetChildRouteDownload.ObjectRef("fixture-reader-one",hash,"audio/wav",25165825));for(String mime:Arrays.asList("video/mp4","model/gltf-binary","audio/mpeg"))denied(()->new PlanetChildRouteDownload.ObjectRef("fixture-reader-one",hash,mime,100));}
    @Test public void absentAndCancelledAreZeroAndNeverAutoplay()throws Exception {for(String status:Arrays.asList("absent","cancelled")){Map<String,Object> value=PlanetChildRouteDownload.empty(status,"journey-one","en");assertEquals("en",value.get("locale"));for(String field:Arrays.asList("completedItems","totalItems","downloadedBytes","totalBytes","sharedItems","reusedItems"))assertEquals(0L,value.get(field));assertFalse(value.containsKey("play"));assertFalse(value.containsKey("narration"));}}
    @Test public void originalPinsRemainEmptyDeny()throws Exception {assertTrue(PlanetChildVault.fixturePassportPinsDeny(context));}
    @Test public void authenticatedBeforeSnapshotDiscardsOnlyInterruptedStageTemporary()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadRecovery(context,run(),"before-partial"));}
    @Test public void authenticatedBeforeSnapshotHandlesZeroByteStageTemporary()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadRecovery(context,run(),"before-zero"));}
    @Test public void authenticatedAfterSnapshotRetainsCompletedObjectPrefix()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadRecovery(context,run(),"after"));}
    @Test public void interruptedRecoveryCanReopenExactAfterSnapshot()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadRecovery(context,run(),"after-partial"));}
    @Test public void recoveryWrongMarkerRetainsClosedFiles()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadRecovery(context,run(),"wrong-marker"));}
    @Test public void recoveryReceiptTamperingCannotAuthorizeCleanup()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadRecovery(context,run(),"receipt-tamper"));}
    @Test public void recoveryRequiresOriginalCurrentProfileBinding()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadRecovery(context,run(),"wrong-current"));}
    @Test public void terminalActivationCannotCreateStageRecoveryReceipt()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadRecovery(context,run(),"terminal"));}
    @Test public void unreceiptedTemporaryFileRemainsDenied()throws Exception {assertTrue(PlanetChildDataStore.fixtureRouteDownloadRecovery(context,run(),"unreceipted"));}
}
