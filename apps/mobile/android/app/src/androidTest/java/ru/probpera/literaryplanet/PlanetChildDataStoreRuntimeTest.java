package ru.probpera.literaryplanet;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Direct native data candidate, explicit synthetic partition only. Not PIN,
 * human review, child App activation, installed authority or hardware evidence.
 * Requires a fresh per-run nonce and an explicit phase; never a default PASS.
 * write/read can run in separate instrument processes to test actual restart. */
@RunWith(AndroidJUnit4.class)
public class PlanetChildDataStoreRuntimeTest {
    private static final String HASH="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static byte[] boundedFile(File file) throws Exception {
        long length=file.length(); assertTrue(length>=30 && length<=PlanetChildDataStore.MAX_SNAPSHOT_BYTES+29); byte[] bytes=new byte[(int)length];
        try(FileInputStream input=new FileInputStream(file)) { int position=0; while(position<bytes.length) { int count=input.read(bytes,position,bytes.length-position); assertTrue(count>0); position+=count; } assertEquals(-1,input.read()); }
        return bytes;
    }
    private static PlanetChildDataStore.Scope scope(String locale) throws Exception {
        return new PlanetChildDataStore.Scope("synthetic-child",1,9,locale,"synthetic-policy",HASH,"synthetic-package",1,HASH);
    }
    private static JSONObject scopeObject(String locale) throws Exception {
        return new JSONObject().put("schemaVersion",1).put("namespace","child").put("profileId","synthetic-child").put("profileRevision",1)
            .put("exactAge",9).put("locale",locale).put("policyVersion","synthetic-policy").put("policyChecksum",HASH)
            .put("packageId","synthetic-package").put("packageVersion",1).put("packageChecksum",HASH);
    }
    private static String key(PlanetChildDataStore.Scope scope,PlanetChildDataStore.Purpose purpose) throws Exception {
        return purpose==PlanetChildDataStore.Purpose.cache || purpose==PlanetChildDataStore.Purpose.offline
            ? scope.itemKey(purpose,purpose==PlanetChildDataStore.Purpose.offline?"offline-package":"work","synthetic-owned-item") : scope.key(purpose);
    }
    private static byte[] value(PlanetChildDataStore.Purpose purpose,String locale) throws Exception {
        JSONObject object=new JSONObject().put("schemaVersion",1).put("scope",scopeObject(locale));
        if(purpose==PlanetChildDataStore.Purpose.search || purpose==PlanetChildDataStore.Purpose.history) object.put("references",new JSONArray());
        else object.put("entries",new JSONArray().put(new JSONObject().put("reference",new JSONObject().put("kind",purpose==PlanetChildDataStore.Purpose.offline?"offline-package":"work").put("id","synthetic-owned-item").put("contentChecksum",HASH))
            .put("payload",new JSONObject().put("title","Synthetic owned data").put("text","RU/EN synthetic bytes; no actual editorial approval.").put("terms",new JSONArray()).put("references",new JSONArray()))));
        return object.toString().getBytes(StandardCharsets.UTF_8);
    }
    private static List<PlanetChildDataStore.ReadKey> reads(PlanetChildDataStore.Scope scope) throws Exception {
        List<PlanetChildDataStore.ReadKey> reads=new ArrayList<>(); for(PlanetChildDataStore.Purpose purpose:PlanetChildDataStore.Purpose.values()) reads.add(new PlanetChildDataStore.ReadKey(purpose,key(scope,purpose))); return reads;
    }
    private static List<PlanetChildDataStore.Mutation> writes(PlanetChildDataStore.Scope scope,long revision) throws Exception {
        List<PlanetChildDataStore.Mutation> writes=new ArrayList<>(); for(PlanetChildDataStore.Purpose purpose:PlanetChildDataStore.Purpose.values()) writes.add(new PlanetChildDataStore.Mutation(purpose,key(scope,purpose),revision,value(purpose,scope.locale))); return writes;
    }
    private interface Attempt { void run() throws Exception; }
    private static void denied(Attempt attempt) throws Exception { boolean denied=false; try { attempt.run(); } catch(PlanetChildDataStore.Unavailable expected) { denied=true; } assertTrue(denied); }
    private static void assertAll(PlanetChildDataStore store,PlanetChildDataStore.Lease lease,PlanetChildDataStore.Scope scope,long revision) throws Exception {
        try(PlanetChildDataStore.Result result=store.transact(lease,reads(scope),Collections.emptyList(),store.operation(lease,15000))) {
            for(PlanetChildDataStore.Purpose purpose:PlanetChildDataStore.Purpose.values()) { PlanetChildDataStore.Slot slot=result.get(purpose,key(scope,purpose)); assertNotNull(slot); assertEquals(revision,slot.revision);
                byte[] actual=slot.copyValue(); if(revision==0) assertNull(actual); else { assertArrayEquals(value(purpose,scope.locale),actual); assertNotNull(slot.checksum); Arrays.fill(actual,(byte)0); } }
        }
    }
    @Test public void durableDataPhase() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext(); assertEquals("ru.probpera.literaryplanet.dev",context.getPackageName());
        assertTrue((context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE)!=0);
        String runId=InstrumentationRegistry.getArguments().getString("literaryRunId"),phase=InstrumentationRegistry.getArguments().getString("literaryChildDataPhase");
        assertTrue(runId!=null && runId.matches("[a-f0-9]{32}")); assertNotNull(phase);
        String name="literary-planet-child-data-v1-synthetic-"+runId; File privateRoot=context.getNoBackupFilesDir().getCanonicalFile(),directory=new File(privateRoot,name),record=new File(directory,"snapshot-v1");
        if("clear".equals(phase)) {
            assertEquals(context.getNoBackupFilesDir().getCanonicalFile(),directory.getCanonicalFile().getParentFile());
            if(directory.exists()) { for(String child:new String[]{"snapshot-v1","snapshot-v1.bak","snapshot-v1.new","transaction.lock"}) { File file=new File(directory,child); assertEquals(file.getAbsoluteFile(),file.getCanonicalFile()); assertTrue(!file.exists() || file.delete()); } assertTrue(directory.delete()); }
            KeyStore keys=KeyStore.getInstance("AndroidKeyStore"); keys.load(null); keys.deleteEntry(context.getPackageName()+"."+name+".aes"); return;
        }
        PlanetChildDataStore store=PlanetChildDataStore.synthetic(context,runId);
        try { PlanetChildDataStore.Scope ru=scope("ru"); PlanetChildDataStore.Lease lease=store.activate(ru);
        if("write".equals(phase)) {
            // Literal independently generated with JavaScript JSON.stringify full tuple.
            assertEquals("probpera-child-v1/search/5b312c226368696c64222c2273796e7468657469632d6368696c64222c312c392c227275222c2273796e7468657469632d706f6c696379222c2261616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161222c2273796e7468657469632d7061636b616765222c312c2261616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161225d",ru.key(PlanetChildDataStore.Purpose.search));
            assertAll(store,lease,ru,0); List<PlanetChildDataStore.Mutation> writes=writes(ru,0);
            try(PlanetChildDataStore.Result ignored=store.transact(lease,Collections.emptyList(),writes,store.operation(lease,15000))) {} finally { for(PlanetChildDataStore.Mutation write:writes) write.close(); }
            assertAll(store,lease,ru,1); byte[] encrypted=boundedFile(record); assertTrue(encrypted[0]==1 && encrypted.length>29);
            assertFalse(new String(encrypted,StandardCharsets.UTF_8).contains("Synthetic owned data")); Arrays.fill(encrypted,(byte)0);
        } else if("read".equals(phase)) { assertAll(store,lease,ru,1); }
        else if("atomic".equals(phase)) {
            assertAll(store,lease,ru,1); List<PlanetChildDataStore.Mutation> wrong=writes(ru,1);
            PlanetChildDataStore.Mutation finalWrong=new PlanetChildDataStore.Mutation(PlanetChildDataStore.Purpose.offline,key(ru,PlanetChildDataStore.Purpose.offline),0,value(PlanetChildDataStore.Purpose.offline,"ru")); wrong.get(3).close(); wrong.set(3,finalWrong);
            denied(()->store.transact(lease,Collections.emptyList(),wrong,store.operation(lease,15000))); for(PlanetChildDataStore.Mutation write:wrong) write.close(); assertAll(store,lease,ru,1);
            PlanetChildDataStore.Cancellation cancelled=store.operation(lease,15000); store.cancel(cancelled); List<PlanetChildDataStore.Mutation> unchanged=writes(ru,1);
            denied(()->store.transact(lease,Collections.emptyList(),unchanged,cancelled)); for(PlanetChildDataStore.Mutation write:unchanged) write.close(); assertAll(store,lease,ru,1);
            String duplicate=new String(value(PlanetChildDataStore.Purpose.search,"ru"),StandardCharsets.UTF_8).replace("\"schemaVersion\":1","\"schemaVersion\":1,\"schemaVersion\":1");
            try(PlanetChildDataStore.Mutation malformed=new PlanetChildDataStore.Mutation(PlanetChildDataStore.Purpose.search,key(ru,PlanetChildDataStore.Purpose.search),1,duplicate.getBytes(StandardCharsets.UTF_8))) {
                denied(()->store.transact(lease,Collections.emptyList(),Collections.singletonList(malformed),store.operation(lease,15000))); }
            assertAll(store,lease,ru,1);
            CountDownLatch start=new CountDownLatch(1),done=new CountDownLatch(2); AtomicInteger winners=new AtomicInteger(); AtomicReference<Throwable> unexpected=new AtomicReference<>();
            for(int index=0;index<2;index++) new Thread(()->{ List<PlanetChildDataStore.Mutation> mutations=null; try { mutations=writes(ru,1); start.await();
                try(PlanetChildDataStore.Result ignored=store.transact(lease,Collections.emptyList(),mutations,store.operation(lease,15000))) { winners.incrementAndGet(); }
            } catch(PlanetChildDataStore.Unavailable conflict) {} catch(Throwable error) { unexpected.compareAndSet(null,error); } finally { if(mutations!=null) for(PlanetChildDataStore.Mutation write:mutations) write.close(); done.countDown(); } }).start();
            start.countDown(); assertTrue(done.await(30,TimeUnit.SECONDS)); assertNull(unexpected.get()); assertEquals(1,winners.get()); assertAll(store,lease,ru,2);
        } else if("retire".equals(phase)) {
            PlanetChildDataStore.Cancellation old=store.operation(lease,15000); store.retire(lease); PlanetChildDataStore.Lease en=store.activate(scope("en"));
            denied(()->store.transact(lease,reads(ru),Collections.emptyList(),old)); assertAll(store,en,scope("en"),0);
            PlanetChildDataStore.Lease again=store.activate(ru); denied(()->store.operation(lease,15000));
            PlanetChildDataStore second=PlanetChildDataStore.synthetic(context,runId); PlanetChildDataStore.Lease external=second.activate(ru);
            denied(()->store.operation(again,15000)); second.close(); denied(()->second.operation(external,15000));
        } else if("corrupt".equals(phase)) {
            byte[] encrypted=boundedFile(record); encrypted[encrypted.length-1]^=1;
            try(FileOutputStream output=new FileOutputStream(record)) { output.write(encrypted); output.getFD().sync(); } Arrays.fill(encrypted,(byte)0);
            denied(()->store.operation(lease,15000)); denied(()->PlanetChildDataStore.synthetic(context,runId)); return;
        } else if("missing-key".equals(phase)) {
            KeyStore keys=KeyStore.getInstance("AndroidKeyStore"); keys.load(null); keys.deleteEntry(context.getPackageName()+"."+name+".aes");
            denied(()->store.operation(lease,15000)); denied(()->PlanetChildDataStore.synthetic(context,runId)); return;
        } else if("missing-cipher".equals(phase)) {
            assertTrue(record.delete()); denied(()->PlanetChildDataStore.synthetic(context,runId)); return;
        } else fail("Unknown explicitly selected child-data phase");
        store.close(); denied(()->store.operation(lease,15000));
        } finally { try { store.close(); } catch(PlanetChildDataStore.Unavailable unavailable) {
            if(!Arrays.asList("corrupt","missing-key","missing-cipher").contains(phase)) throw unavailable;
        } }
    }
    private static String bootstrapRunId(String suffix){String original=InstrumentationRegistry.getArguments().getString("literaryRunId","");
        assertTrue("explicit isolated data bootstrap phase","local-v2-bootstrap".equals(InstrumentationRegistry.getArguments().getString("literaryChildDataPhase"))&&original.matches("[a-f0-9]{32}"));return original.substring(0,30)+suffix;}
    private static File bootstrapDirectory(Context context,String runId)throws Exception{return new File(context.getNoBackupFilesDir().getCanonicalFile(),"literary-planet-child-data-v1-synthetic-"+runId);}
    @Test public void localV2DataBirthWithoutOriginalOwnerPermitHasNoKeyOrRecordFootprint()throws Exception{
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();String runId=bootstrapRunId("b1");File directory=bootstrapDirectory(context,runId);KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);
        assertFalse(directory.exists());String alias=context.getPackageName()+"."+directory.getName()+".aes";assertFalse(keys.containsAlias(alias));
        try(PlanetChildDataStore.LocalV2BirthPlan plan=PlanetChildDataStore.fixtureLocalV2BirthPlan(context,runId,runId)){denied(()->PlanetChildDataStore.localV2Birth(plan,null));assertFalse(directory.exists());assertFalse(keys.containsAlias(alias));}
    }
    @Test public void localV2ExistingOnlyMissingStoreCannotCreateAnAesKeyOrSnapshot()throws Exception{
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();String runId=bootstrapRunId("b2");File directory=bootstrapDirectory(context,runId);KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);
        assertFalse(directory.exists());String alias=context.getPackageName()+"."+directory.getName()+".aes";assertFalse(keys.containsAlias(alias));
        denied(()->PlanetChildDataStore.fixtureLocalV2ExistingOnly(context,runId));assertFalse(new File(directory,"snapshot-v1").exists());assertFalse(keys.containsAlias(alias));
    }
    @Test public void localV2ExistingOnlyOrphanBirthClaimRemainsFailClosedAndUnmodified()throws Exception{
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();String runId=bootstrapRunId("b3");File directory=bootstrapDirectory(context,runId);assertFalse(directory.exists());assertTrue(directory.mkdir());
        File marker=new File(directory,"local-v2-birth.claim");byte[] original="unknown-original-key-birth-claim-retained".getBytes(StandardCharsets.US_ASCII);try(FileOutputStream output=new FileOutputStream(marker)){output.write(original);output.getFD().sync();}
        denied(()->PlanetChildDataStore.fixtureLocalV2ExistingOnly(context,runId));assertArrayEquals(original,boundedFile(marker));assertFalse(new File(directory,"snapshot-v1").exists());
        KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);assertFalse(keys.containsAlias(context.getPackageName()+"."+directory.getName()+".aes"));
    }
    @Test public void localV2ExistingOnlyMissingAesDoesNotRebirthOrReplaceOriginalCipher()throws Exception{
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();String runId=bootstrapRunId("b4");File directory=bootstrapDirectory(context,runId);assertFalse(directory.exists());
        PlanetChildDataStore fixture=PlanetChildDataStore.synthetic(context,runId);fixture.close();File record=new File(directory,"snapshot-v1");byte[] original=boundedFile(record);
        KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);String alias=context.getPackageName()+"."+directory.getName()+".aes";assertTrue(keys.containsAlias(alias));keys.deleteEntry(alias);
        denied(()->PlanetChildDataStore.fixtureLocalV2ExistingOnly(context,runId));assertFalse(keys.containsAlias(alias));assertArrayEquals(original,boundedFile(record));Arrays.fill(original,(byte)0);
    }
    /** AUTHORED_NOT_RUN. These refusal cases never manufacture a native owner
     * signature/receipt and never delete protected keys or reset saved data. */
    @Test public void localV2UnknownBirthClaimWithExistingCipherCannotBeAdopted()throws Exception{
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();String runId=bootstrapRunId("b5");File directory=bootstrapDirectory(context,runId);assertFalse(directory.exists());
        PlanetChildDataStore fixture=PlanetChildDataStore.synthetic(context,runId);fixture.close();File record=new File(directory,"snapshot-v1");byte[] cipher=boundedFile(record);
        File claim=new File(directory,"local-v2-birth.claim");byte[] raw=("LP-LOCAL-V2-DATA-BIRTH\n"+context.getPackageName()+"."+directory.getName()+"\n"+runId+"\n"+HASH+"\n"+HASH+"\n").getBytes(StandardCharsets.US_ASCII);
        try{try(FileOutputStream out=new FileOutputStream(claim)){out.write(raw);out.getFD().sync();}denied(()->PlanetChildDataStore.fixtureLocalV2ExistingOnly(context,runId));
            assertArrayEquals(cipher,boundedFile(record));assertArrayEquals(raw,boundedFile(claim));assertFalse(new File(directory,"local-v2-birth.known").exists());
            KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);assertTrue(keys.containsAlias(context.getPackageName()+"."+directory.getName()+".aes"));
        }finally{Arrays.fill(cipher,(byte)0);Arrays.fill(raw,(byte)0);}}
    @Test public void localV2PartialKnownBirthPendingCannotAdoptAnEncryptedSnapshotAsReceipt()throws Exception{
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();String runId=bootstrapRunId("b6");File directory=bootstrapDirectory(context,runId);assertFalse(directory.exists());
        PlanetChildDataStore fixture=PlanetChildDataStore.synthetic(context,runId);fixture.close();File record=new File(directory,"snapshot-v1");byte[] cipher=boundedFile(record),pending=HASH.getBytes(StandardCharsets.US_ASCII);
        File marker=new File(directory,"local-v2-birth.known.pending"),known=new File(directory,"local-v2-birth.known");
        try{try(FileOutputStream out=new FileOutputStream(marker)){out.write(pending);out.getFD().sync();}try(FileOutputStream out=new FileOutputStream(known)){out.write(cipher);out.getFD().sync();}
            denied(()->PlanetChildDataStore.fixtureLocalV2ExistingOnly(context,runId));assertArrayEquals(cipher,boundedFile(record));assertArrayEquals(cipher,boundedFile(known));assertArrayEquals(pending,boundedFile(marker));
        }finally{Arrays.fill(cipher,(byte)0);Arrays.fill(pending,(byte)0);}}
    @Test public void localV2BirthCompletionWithoutOriginalRetiredPermitCannotCreateKnownReceipt()throws Exception{
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();String runId=bootstrapRunId("b7");File directory=bootstrapDirectory(context,runId);assertFalse(directory.exists());
        try(PlanetChildDataStore.LocalV2BirthPlan plan=PlanetChildDataStore.fixtureLocalV2BirthPlan(context,runId,runId)){
            java.lang.reflect.Constructor<?> constructor=PlanetChildDataStore.LocalV2BirthReceipt.class.getDeclaredConstructors()[0];constructor.setAccessible(true);
            PlanetChildDataStore.LocalV2BirthReceipt receipt=(PlanetChildDataStore.LocalV2BirthReceipt)constructor.newInstance(plan,new byte[0]);denied(()->receipt.complete(null));
            assertFalse(directory.exists());KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);assertFalse(keys.containsAlias(context.getPackageName()+"."+directory.getName()+".aes"));
        }}

}
