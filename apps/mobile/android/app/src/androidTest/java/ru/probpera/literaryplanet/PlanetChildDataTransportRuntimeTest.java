package ru.probpera.literaryplanet;

import android.content.Context;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Actual direct private transport fixture; synthetic scope only. Explicit
 * owned run/phase, no default invocation or native admission/OS PASS claim.
 * Existing PlanetChildDataStoreRuntimeTest clear phase owns scoped cleanup. */
@RunWith(AndroidJUnit4.class)
public class PlanetChildDataTransportRuntimeTest {
    private static final String HASH="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static String id(){return UUID.randomUUID().toString().replace("-","");}
    private static Map<String,Object> fields(Object... values){Map<String,Object> out=new LinkedHashMap<>();for(int i=0;i<values.length;i+=2)out.put((String)values[i],values[i+1]);return out;}
    private static Map<String,Object> header(){return fields("version",1,"requestId",id(),"timeoutMs",15000);}
    private static Map<String,Object> scope(){return fields("schemaVersion",1,"namespace","child","profileId","synthetic-wire-child","profileRevision",1,"exactAge",9,"locale","ru",
        "policyVersion","synthetic-policy","policyChecksum",HASH,"packageId","synthetic-package","packageVersion",1,"packageChecksum",HASH);}
    private static PlanetChildDataStore.Scope nativeScope() throws Exception{return new PlanetChildDataStore.Scope("synthetic-wire-child",1,9,"ru","synthetic-policy",HASH,"synthetic-package",1,HASH);}
    private static String key(PlanetChildDataStore.Purpose purpose) throws Exception {
        PlanetChildDataStore.Scope scope=nativeScope();return purpose==PlanetChildDataStore.Purpose.cache||purpose==PlanetChildDataStore.Purpose.offline
            ?scope.itemKey(purpose,purpose==PlanetChildDataStore.Purpose.offline?"offline-package":"work","synthetic-owned-item"):scope.key(purpose);
    }
    private static byte[] value(PlanetChildDataStore.Purpose purpose) throws Exception {
        JSONObject object=new JSONObject().put("schemaVersion",1).put("scope",new JSONObject(scope()));
        if(purpose==PlanetChildDataStore.Purpose.search||purpose==PlanetChildDataStore.Purpose.history)object.put("references",new JSONArray());
        else object.put("entries",new JSONArray().put(new JSONObject().put("reference",new JSONObject().put("kind",purpose==PlanetChildDataStore.Purpose.offline?"offline-package":"work").put("id","synthetic-owned-item").put("contentChecksum",HASH))
            .put("payload",new JSONObject().put("title","Synthetic private wire").put("text","Owned fixture only; no reviewed child content.").put("terms",new JSONArray()).put("references",new JSONArray()))));
        return object.toString().getBytes(StandardCharsets.UTF_8);
    }
    private static String sha(byte[] bytes) throws Exception {
        byte[] hash=MessageDigest.getInstance("SHA-256").digest(bytes);try{StringBuilder out=new StringBuilder();for(byte b:hash)out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();}finally{Arrays.fill(hash,(byte)0);}
    }
    private static Map<String,Object> invoke(PlanetChildDataTransport transport,String method,Map<String,Object> request) throws Exception {
        CountDownLatch done=new CountDownLatch(1);AtomicReference<Map<String,Object>> answer=new AtomicReference<>();
        transport.dispatch(method,request,reply->{assertTrue(answer.compareAndSet(null,reply));done.countDown();});
        assertTrue("Actual private dispatch never completed",done.await(30,TimeUnit.SECONDS));Map<String,Object> reply=answer.get();assertNotNull(reply);
        assertEquals(1,reply.get("version"));assertEquals(request.get("requestId"),reply.get("requestId"));return reply;
    }
    private static Map<String,Object> binding(Map<String,Object> partition){Map<String,Object> request=header();for(String name:new String[]{"ownerToken","leaseToken","scope","generation","nonce"})request.put(name,partition.get(name));return request;}
    private static List<Object> reads() throws Exception {List<Object> out=new ArrayList<>();for(PlanetChildDataStore.Purpose purpose:PlanetChildDataStore.Purpose.values())out.add(fields("purpose",purpose.name(),"key",key(purpose)));return out;}
    private static List<Object> writes(long expected) throws Exception {List<Object> out=new ArrayList<>();for(PlanetChildDataStore.Purpose purpose:PlanetChildDataStore.Purpose.values()){
        byte[] bytes=value(purpose);try{out.add(fields("purpose",purpose.name(),"key",key(purpose),"expectedRevision",expected,"base64",Base64.encodeToString(bytes,Base64.NO_WRAP),"checksum",sha(bytes)));}finally{Arrays.fill(bytes,(byte)0);}}return out;}
    private static Map<String,Object> batch(Map<String,Object> partition,List<Object> reads,List<Object> writes){Map<String,Object> out=binding(partition);out.put("reads",reads);out.put("writes",writes);return out;}
    private static void absent(PlanetChildDataTransport transport,Map<String,Object> partition) throws Exception {
        Map<String,Object> read=invoke(transport,"transact",batch(partition,reads(),Collections.emptyList()));assertEquals("committed",read.get("status"));
        for(Object raw:(List<?>)read.get("slots")){Map<?,?> slot=(Map<?,?>)raw;assertEquals(0L,((Number)slot.get("revision")).longValue());assertNull(slot.get("base64"));assertNull(slot.get("checksum"));}
    }
    @Test public void privateTransportPhase() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();assertEquals("ru.probpera.literaryplanet.dev",context.getPackageName());
        String runId=InstrumentationRegistry.getArguments().getString("literaryRunId"),phase=InstrumentationRegistry.getArguments().getString("literaryChildTransportPhase");
        assertTrue(runId!=null&&runId.matches("[a-f0-9]{32}"));assertEquals("wire",phase);
        PlanetChildDataStore initial=PlanetChildDataStore.synthetic(context,runId);
        // The native lock must reject an already expired absolute deadline;
        // waiting to acquire that lock never renews a transport request budget.
        PlanetChildDataTransport transport;
        try{
            PlanetChildDataStore.Lease expired=initial.activate(nativeScope());boolean deadlineDenied=false;
            try{initial.operationUntil(expired,SystemClock.elapsedRealtime());}catch(PlanetChildDataStore.Unavailable expected){deadlineDenied=true;}
            assertTrue(deadlineDenied);initial.retire(expired);transport=new PlanetChildDataTransport(initial);
        }catch(Exception|AssertionError failure){try{initial.close();}catch(Exception cleanup){failure.addSuppressed(cleanup);}throw failure;}
        Map<String,Object> partition=null;boolean closed=false;
        try{
            Map<String,Object> opening=header();opening.put("ownerToken",null);opening.put("scope",scope());partition=invoke(transport,"activate",opening);
            assertEquals("partitioned",partition.get("status"));assertTrue(((Number)partition.get("generation")).longValue()>0);
            assertTrue(((String)partition.get("nonce")).matches("[a-f0-9]{32}"));assertTrue(((String)partition.get("leaseToken")).matches("[a-f0-9]{32}"));
            // Same-owner activation replacement is supported by the private TS
            // transport. It advances the actual native generation atomically.
            Map<String,Object> replaced=partition,replacement=header();replacement.put("ownerToken",partition.get("ownerToken"));replacement.put("scope",scope());
            partition=invoke(transport,"activate",replacement);assertEquals("partitioned",partition.get("status"));assertNotEquals(replaced.get("generation"),partition.get("generation"));
            assertEquals("unavailable",invoke(transport,"transact",batch(replaced,reads(),Collections.emptyList())).get("status"));absent(transport,partition);
            assertEquals("unavailable",invoke(transport,"transact",batch(partition,Collections.emptyList(),Collections.emptyList())).get("status"));
            Map<String,Object> extra=batch(partition,reads(),Collections.emptyList());extra.put("adultFallback",true);assertEquals("unavailable",invoke(transport,"transact",extra).get("status"));
            Map<String,Object> wrong=binding(partition);wrong.put("nonce","bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");wrong.put("reads",reads());wrong.put("writes",Collections.emptyList());assertEquals("unavailable",invoke(transport,"transact",wrong).get("status"));
            for(String invalid:new String[]{"AB==","AAAA=","A A=","!!!!"}){
                List<Object> writes=writes(0);Map<String,Object> write=new LinkedHashMap<>((Map<String,Object>)writes.get(0));write.put("base64",invalid);writes.set(0,write);
                assertEquals("unavailable",invoke(transport,"transact",batch(partition,Collections.emptyList(),writes)).get("status"));}
            List<Object> mixed=writes(0);Map<String,Object> last=new LinkedHashMap<>((Map<String,Object>)mixed.get(3));last.put("checksum","bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");mixed.set(3,last);
            assertEquals("unavailable",invoke(transport,"transact",batch(partition,Collections.emptyList(),mixed)).get("status"));absent(transport,partition);
            Map<String,Object> writing=batch(partition,Collections.emptyList(),writes(0));assertEquals("committed",invoke(transport,"transact",writing).get("status"));
            assertEquals("unavailable",invoke(transport,"transact",writing).get("status")); // Replay cannot repeat the durable write.
            Map<String,Object> read=invoke(transport,"transact",batch(partition,reads(),Collections.emptyList()));assertEquals("committed",read.get("status"));assertEquals(4,((List<?>)read.get("slots")).size());
            for(Object raw:(List<?>)read.get("slots")){Map<?,?> slot=(Map<?,?>)raw;assertEquals(1L,((Number)slot.get("revision")).longValue());
                byte[] bytes=Base64.decode((String)slot.get("base64"),Base64.NO_WRAP),expected=value(PlanetChildDataStore.Purpose.valueOf((String)slot.get("purpose")));
                try{assertEquals(slot.get("checksum"),sha(bytes));assertArrayEquals(expected,bytes);}finally{Arrays.fill(bytes,(byte)0);Arrays.fill(expected,(byte)0);}}
            String cancelled=id();assertEquals("cancellation-requested",invoke(transport,"cancel",fields("version",1,"requestId",id(),"targetRequestId",cancelled)).get("status"));
            Map<String,Object> cancelledBatch=batch(partition,reads(),Collections.emptyList());cancelledBatch.put("requestId",cancelled);assertEquals("unavailable",invoke(transport,"transact",cancelledBatch).get("status"));
            Map<String,Object> old=partition;assertEquals("retired",invoke(transport,"retire",binding(partition)).get("status"));
            Map<String,Object> reopening=header();reopening.put("ownerToken",old.get("ownerToken"));reopening.put("scope",scope());partition=invoke(transport,"activate",reopening);assertEquals("partitioned",partition.get("status"));
            assertNotEquals(old.get("generation"),partition.get("generation"));assertNotEquals(old.get("nonce"),partition.get("nonce"));assertEquals("unavailable",invoke(transport,"transact",batch(old,reads(),Collections.emptyList())).get("status"));
            // Another actual native instance supersedes the opaque durable lease.
            // Correct wire owner/token/nonce aliases cannot bypass the store lock.
            PlanetChildDataStore competing=PlanetChildDataStore.synthetic(context,runId);try{competing.activate(nativeScope());assertEquals("unavailable",invoke(transport,"transact",batch(partition,reads(),Collections.emptyList())).get("status"));}finally{competing.close();}
            // Exhaust ordinary correlation IDs with no new native data tasks.
            // The separately retained terminal-close slot must remain available.
            String target=id();int accepted=0;
            for(int index=0;index<4097;index++){Map<String,Object> reply=invoke(transport,"cancel",fields("version",1,"requestId",id(),"targetRequestId",target));if("unavailable".equals(reply.get("status")))break;accepted++;}
            assertTrue(accepted>0&&accepted<=4096);
            Map<String,Object> close=header();close.put("ownerToken",partition.get("ownerToken"));assertEquals("closed",invoke(transport,"close",close).get("status"));closed=true;
            assertEquals("unavailable",invoke(transport,"transact",batch(partition,reads(),Collections.emptyList())).get("status"));
        }finally{if(!closed){Map<String,Object> close=header();close.put("ownerToken",partition==null?null:partition.get("ownerToken"));invoke(transport,"close",close);}}
    }
}
