package ru.probpera.literaryplanet;

import android.os.Build;
import android.os.SystemClock;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.concurrent.locks.ReentrantLock;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** AUTHORED, NOT_COMPILED / NOT_RUN. Actual platform keys/prompts are not mocked.
 * Host/checkpoint/full-record storage is explicitly SYNTHETIC and never opens a
 * vault. Device credential success is an interactive owned DEV-target condition,
 * not automated PIN entry, JS data, guardian status, checkpoint or App admission.
 * No key/alias deletion, replacement, App data clearing or factory activation.
 * Opt-in: literaryOwnerPermissionPhase=owner-proof; literaryRunId=32lowerhex.
 * Interactive cases additionally require literaryOwnerInteractive=true and a
 * real owner answering the OS prompt. Missing input records SKIP, never PASS.
 * Run only on an explicitly owned isolated .dev installation. A first successful
 * enroll leaves its genuine fixed key; tests never replace it to obtain coverage.
 */
@RunWith(AndroidJUnit4.class)
public final class PlanetChildNativeOwnerPermissionRuntimeTest {
    private ActivityScenario<MainActivity> scenario;private MainActivity activity;private Fixture fixture;
    @Before public void isolatedOwnedActivity() throws Exception {
        android.os.Bundle arguments=InstrumentationRegistry.getArguments();
        Assume.assumeTrue("explicit owned owner-proof phase", "owner-proof".equals(arguments.getString("literaryOwnerPermissionPhase"))
            && arguments.getString("literaryRunId","").matches("[a-f0-9]{32}"));
        Assume.assumeTrue("isolated dev application only",InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName().endsWith(".dev"));
        scenario=ActivityScenario.launch(MainActivity.class);scenario.onActivity(a->activity=a);
        long end=SystemClock.elapsedRealtime()+5000;while(!activity.hasWindowFocus()&&SystemClock.elapsedRealtime()<end)Thread.sleep(20);
        assertTrue("actual resumed native Activity",activity.hasWindowFocus());
    }
    @After public void joinOnlyOwnedWork() throws Exception {
        if(fixture!=null){fixture.releaseRecipient.countDown();fixture.close();}
        if(scenario!=null)scenario.close();
    }
    private interface Checked {void run() throws Exception;}
    private static Class<?> type(String name)throws Exception{return Class.forName("ru.probpera.literaryplanet.PlanetChildVault$"+name);}
    private static Object create(String name,Object...args)throws Exception{
        for(Constructor<?> c:type(name).getDeclaredConstructors())if(c.getParameterCount()==args.length){c.setAccessible(true);
            try{return c.newInstance(args);}catch(InvocationTargetException e){throw cause(e);}}
        throw new AssertionError("private fixture constructor "+name);
    }
    private static Exception cause(InvocationTargetException e){Throwable value=e.getCause();if(value instanceof Error)throw(Error)value;
        return value instanceof Exception?(Exception)value:new Exception(value);}
    private static Object call(Object owner,String name,Object...args)throws Exception{
        Class<?> c=owner instanceof Class<?>?(Class<?>)owner:owner.getClass();
        for(Method m:c.getDeclaredMethods())if(m.getName().equals(name)&&m.getParameterCount()==args.length){m.setAccessible(true);
            try{return m.invoke(owner instanceof Class<?>?null:owner,args);}catch(InvocationTargetException e){throw cause(e);}}
        throw new AssertionError("private fixture method "+name);
    }
    private static Object field(Object owner,String name)throws Exception{Field f=owner.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(owner);}
    @SuppressWarnings({"unchecked","rawtypes"})private static Object kind(String name,String value)throws Exception{return Enum.valueOf((Class)type(name),value);}
    private static void denied(Checked body)throws Exception{boolean refused=false;try{body.run();}catch(Exception expected){refused=true;}assertTrue("refusal observed outside callback",refused);}
    private static String repeated(char c){char[] value=new char[64];Arrays.fill(value,c);return new String(value);}
    private static String sha(byte[] bytes)throws Exception{byte[] digest=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder result=new StringBuilder();
        try{for(byte value:digest)result.append(String.format(Locale.ROOT,"%02x",value&255));return result.toString();}finally{Arrays.fill(digest,(byte)0);}}
    private static boolean zero(byte[] value){for(byte b:value)if(b!=0)return false;return true;}
    private static Object objectMethod(Object p,Method m,Object[] a){switch(m.getName()){case"equals":return p==a[0];case"hashCode":return System.identityHashCode(p);
        case"toString":return "EXPLICIT_SYNTHETIC_HOST_CHECKPOINT_ONLY";default:throw new AssertionError(m);}}
    private static String pin(long revision,long observed,char credential,char salt){return "{\"schemaVersion\":1,\"revision\":"+revision+",\"credentialId\":\""+repeated(credential)
        +"\",\"verifier\":{\"algorithm\":\"pbkdf2-sha256\",\"saltHex\":\""+repeated(salt)+"\",\"iterations\":600000,\"hashHex\":\""+repeated('c')
        +"\"},\"attempts\":{\"count\":0,\"blockedUntilMs\":0,\"lastObservedMs\":"+observed+",\"pendingAttemptId\":null}}";}
    private static byte[] record(boolean enrolled)throws Exception{
        String registry="{\"schemaVersion\":1,\"policyVersion\":\"synthetic-native-owner-v1\",\"activeProfileId\":null,\"profiles\":[]}";
        return ("{\"schemaVersion\":1,\"revision\":7,\"mode\":\"adult\",\"selectionRevision\":3,\"profileRevision\":2,\"policyChecksum\":\""+repeated('a')
            +"\",\"registryChecksum\":\""+sha(registry.getBytes(StandardCharsets.UTF_8))+"\",\"registry\":"+registry+",\"pin\":"+(enrolled?pin(1,1000,'d','e'):"null")
            +",\"clock\":{\"schemaVersion\":1,\"bootId\":\"00000000-0000-4000-8000-000000000001\",\"uptimeAnchorMs\":100,\"logicalAnchorMs\":1000,\"epochAnchorMs\":null}}")
            .getBytes(StandardCharsets.UTF_8);
    }
    private final class Fixture implements AutoCloseable {
        final Object core,inspection,session,owner;final byte[] before,next;final String nextHash;
        final AtomicInteger recipients=new AtomicInteger();final AtomicReference<Object> delivered=new AtomicReference<>();
        final CountDownLatch recipientEntered=new CountDownLatch(1),releaseRecipient=new CountDownLatch(1);
        volatile Object request;volatile boolean holdRecipient,throwRecipient;volatile int reads,writes;
        Fixture(String action,long timeout)throws Exception{
            before=record(!"enroll".equals(action));String checksum=sha(before);ReentrantLock lock=new ReentrantLock();
            Class<?> authority=type("PinSessionAuthority");Object actualHostFixture=Proxy.newProxyInstance(authority.getClassLoader(),new Class<?>[]{authority},(p,m,a)->{
                if(m.getDeclaringClass()==Object.class)return objectMethod(p,m,a);
                if(m.getName().equals("capture")||m.getName().equals("current")){
                    assertEquals(checksum,a[2]);assertArrayEquals(before,(byte[])a[1]);long now=SystemClock.elapsedRealtime();
                    return create("PinNativeCoordinates",p,repeated('1'),"00000000-0000-4000-8000-000000000001",checksum,7L,4L,now,900L+now);}
                if(m.getName().equals("cancel")||m.getName().equals("retire"))return null;
                throw new AssertionError("OS-owner proof cannot publish/checkpoint "+m.getName());
            });
            Class<?> recovery=type("PinRecoveryAuthority");Object recoveryFixture=Proxy.newProxyInstance(recovery.getClassLoader(),new Class<?>[]{recovery},(p,m,a)->{
                if(m.getDeclaringClass()==Object.class)return objectMethod(p,m,a);throw new AssertionError("synthetic recovery not admitted");});
            Class<?> io=type("PinSessionIO");Object storageFixture=Proxy.newProxyInstance(io.getClassLoader(),new Class<?>[]{io},(p,m,a)->{
                if(m.getDeclaringClass()==Object.class)return objectMethod(p,m,a);lock.lock();try{Class<?> tx=type("PinSessionTransaction");
                    Object transaction=Proxy.newProxyInstance(tx.getClassLoader(),new Class<?>[]{tx},(t,n,b)->{
                        if(n.getDeclaringClass()==Object.class)return objectMethod(t,n,b);if(n.getName().equals("read")){reads++;return before.clone();}
                        writes++;throw new AssertionError("OS proof alone cannot write full record");});return call(a[0],"run",transaction);
                }finally{lock.unlock();}});
            Object policy=create("PinSessionPolicy","synthetic-native-owner-v1",repeated('a'),600000L,600000L);
            core=create("NativePinSessions",storageFixture,actualHostFixture,recoveryFixture,policy);
            inspection=call(core,"inspection",repeated('7'),kind("PinLifecycleAction",action),timeout);
            Object reply=call(core,"begin",inspection);session=field(reply,"session");call(core,"settleReply",reply,kind("PinReplyDelivery","known"));
            owner=create("PinNativeOwnerAuthority",core);long logical=(Long)field(session,"capturedLogicalMs");
            String raw=new String(before,StandardCharsets.UTF_8).replace("\"revision\":7,\"mode\"","\"revision\":8,\"mode\"");
            raw=raw.replace("\"pin\":"+("enroll".equals(action)?"null":pin(1,1000,'d','e')),
                "\"pin\":"+pin("enroll".equals(action)?1:2,logical,'f','b'));
            next=raw.getBytes(StandardCharsets.UTF_8);nextHash=sha(next);
        }
        Object request(String locale)throws Exception{
            AtomicReference<Object> value=new AtomicReference<>();AtomicReference<Exception> error=new AtomicReference<>();
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{value.set(call(owner,"request",session,next,nextHash,8L,activity,locale));}catch(Exception e){error.set(e);}});
            if(error.get()!=null)throw error.get();request=value.get();return request;
        }
        void authenticate()throws Exception{Class<?> recipient=type("PinOwnerRecipient");Object consumer=Proxy.newProxyInstance(recipient.getClassLoader(),new Class<?>[]{recipient},(p,m,a)->{
            if(m.getDeclaringClass()==Object.class)return objectMethod(p,m,a);recipients.incrementAndGet();delivered.set(a[0]);recipientEntered.countDown();
            if(holdRecipient)assertTrue("bounded original recipient",releaseRecipient.await(20,TimeUnit.SECONDS));if(throwRecipient)throw new Exception("synthetic lost original recipient");return null;});
            call(owner,"authenticate",request,consumer);}
        void finished()throws Exception{long end=SystemClock.elapsedRealtime()+12000;boolean done;
            for(;;){synchronized(core){done=(Boolean)field(request,"finished");}if(done||SystemClock.elapsedRealtime()>=end)break;Thread.sleep(20);}
            assertTrue("actual handlers/worker/cancel cleanup completed",done);synchronized(core){assertEquals(0,field(inspection,"workers"));}}
        void consume(Object permission)throws Exception{call(core,"claim",inspection,kind("PinSessionPhase","begun"),kind("PinSessionPhase","committing"));
            try{call(owner,"consume",permission,session,next,nextHash,8L);}finally{call(core,"settleWorker",inspection);}}
        String alias(){return activity.getPackageName()+".literary-planet-child-device-owner-sign-v1";}
        boolean keyPresent()throws Exception{KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);return keys.containsAlias(alias());}
        public void close()throws Exception{
            if(request==null){call(session,"close");Arrays.fill(before,(byte)0);Arrays.fill(next,(byte)0);return;}
            call(owner,"cancel",request);if((Boolean)field(request,"started"))finished();
            Object permission=field(request,"permission");if(permission!=null&&!(Boolean)field(permission,"settled"))call(owner,"settle",permission,kind("PinReplyDelivery","uncertain"));
            ExecutorService executor=Executors.newSingleThreadExecutor();try{Future<?> joined=executor.submit(()->{try{call(owner,"retire",request);}catch(Exception e){throw new RuntimeException(e);}});
                joined.get(5,TimeUnit.SECONDS);}finally{executor.shutdown();Arrays.fill(before,(byte)0);Arrays.fill(next,(byte)0);}
        }
    }
    private void supported(){Assume.assumeTrue("API30 credential CryptoObject",Build.VERSION.SDK_INT>=30);}
    private void interactive(){supported();Assume.assumeTrue("actual OS credential supplied by owned target", "true".equals(InstrumentationRegistry.getArguments().getString("literaryOwnerInteractive")));}
    private Object realPermission()throws Exception{interactive();fixture=new Fixture("enroll",60000);fixture.request("en");fixture.authenticate();
        assertTrue("answer owned system credential prompt",fixture.recipientEntered.await(45,TimeUnit.SECONDS));fixture.finished();Object value=fixture.delivered.get();
        assertNotNull("only actual keystore Signature success yields original proof",value);assertTrue((Boolean)field(fixture.request,"deliveryCompleted"));return value;}

    @Test public void apiBelow30DeniesBeforeOwnedKeyOrPrompt()throws Exception{Assume.assumeTrue(Build.VERSION.SDK_INT<30);fixture=new Fixture("enroll",60000);
        boolean key=fixture.keyPresent();denied(()->fixture.request("en"));assertEquals(key,fixture.keyPresent());assertEquals(0,fixture.recipients.get());}
    @Test public void ordinaryRotationCannotRequestOwnerProof()throws Exception{supported();fixture=new Fixture("replace",60000);boolean key=fixture.keyPresent();
        denied(()->fixture.request("en"));assertEquals(key,fixture.keyPresent());assertEquals(0,fixture.writes);}
    @Test public void invalidLocaleDeniesBeforePlatformIO()throws Exception{supported();fixture=new Fixture("enroll",60000);boolean key=fixture.keyPresent();
        denied(()->fixture.request("de"));assertEquals(key,fixture.keyPresent());assertEquals(0,fixture.recipients.get());}
    @Test public void secondOwnerCannotMintRequestForSameInspection()throws Exception{supported();fixture=new Fixture("enroll",60000);Object original=fixture.request("ru");Object second=create("PinNativeOwnerAuthority",fixture.core);
        AtomicBoolean refused=new AtomicBoolean();InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{call(second,"request",fixture.session,fixture.next,fixture.nextHash,8L,activity,"ru");}catch(Exception expected){refused.set(true);}});
        assertTrue("second original denied outside main callback",refused.get());assertSame(original,field(fixture.inspection,"ownerAuthorization"));}
    @Test public void cancellationBeforeStartNeverCreatesKey()throws Exception{supported();fixture=new Fixture("enroll",60000);fixture.request("en");boolean key=fixture.keyPresent();
        call(fixture.owner,"cancel",fixture.request);denied(()->fixture.authenticate());assertEquals(key,fixture.keyPresent());assertEquals(0,fixture.recipients.get());}
    @Test public void originalDeadlineIsNotRenewedByAuthenticate()throws Exception{supported();fixture=new Fixture("enroll",100);fixture.request("en");long deadline=(Long)field(fixture.session,"deadlineUptimeMs");
        while(SystemClock.elapsedRealtime()<deadline)Thread.sleep(10);boolean key=fixture.keyPresent();denied(()->fixture.authenticate());assertEquals(deadline,field(fixture.session,"deadlineUptimeMs"));assertEquals(key,fixture.keyPresent());}
    @Test public void recoveryMissingFixedKeyNeverCreatesIt()throws Exception{supported();fixture=new Fixture("recover",60000);Assume.assumeFalse("fresh isolated existing-key absence",fixture.keyPresent());
        fixture.request("ru");fixture.authenticate();assertTrue(fixture.recipientEntered.await(10,TimeUnit.SECONDS));fixture.finished();assertNull(fixture.delivered.get());assertFalse(fixture.keyPresent());assertEquals(0,fixture.writes);}
    @Test public void actualOwnerSignatureIsNotUsableBeforeKnownOriginalACK()throws Exception{Object permission=realPermission();assertFalse((Boolean)field(permission,"settled"));
        denied(()->fixture.consume(permission));assertFalse("premature consume did not burn original",(Boolean)field(permission,"consumed"));assertEquals(0,fixture.writes);}
    @Test public void originalKnownACKThenConsumeVerifiesAndBurnsOnce()throws Exception{Object permission=realPermission();byte[] originalSignature=(byte[])field(permission,"signature");assertFalse(zero(originalSignature));
        call(fixture.owner,"settle",permission,kind("PinReplyDelivery","known"));assertTrue((Boolean)field(permission,"knownDelivery"));assertFalse("known ACK retains proof",zero(originalSignature));
        fixture.consume(permission);assertTrue((Boolean)field(permission,"consumed"));assertTrue("actual consume wipes owned signature",zero(originalSignature));
        denied(()->call(fixture.owner,"consume",permission,fixture.session,fixture.next,fixture.nextHash,8L));assertEquals(0,fixture.writes);}
    @Test public void directBackingACKDeniedWhileActualRecipientIsExecuting()throws Exception{interactive();fixture=new Fixture("enroll",60000);fixture.request("en");fixture.holdRecipient=true;
        try{fixture.authenticate();assertTrue("answer actual device credential prompt",fixture.recipientEntered.await(45,TimeUnit.SECONDS));Object permission=fixture.delivered.get();assertNotNull(permission);Object backing=field(permission,"backing");
            denied(()->call(fixture.core,"settleReply",backing,kind("PinReplyDelivery","known")));assertFalse((Boolean)field(backing,"settled"));
            assertFalse((Boolean)field(fixture.request,"finished"));synchronized(fixture.core){assertTrue((Integer)field(fixture.inspection,"workers")>0);}
        }finally{fixture.releaseRecipient.countDown();}}
    @Test public void nativeActivityPauseAfterKnownACKPermanentlyRevokesOriginalPermission()throws Exception{Object permission=realPermission();
        call(fixture.owner,"settle",permission,kind("PinReplyDelivery","known"));
        assertTrue("original lifecycle latch survives auth worker and known ACK",(Boolean)field(fixture.owner,"observerRegistered"));
        assertFalse((Boolean)field(fixture.request,"retired"));
        scenario.moveToState(Lifecycle.State.CREATED);synchronized(fixture.core){assertTrue("actual Activity pause/stop latches revoke",(Boolean)field(fixture.request,"revoked"));}
        scenario.moveToState(Lifecycle.State.RESUMED);denied(()->fixture.consume(permission));
        assertTrue("resume cannot restore original permission",(Boolean)field(fixture.request,"revoked"));assertTrue(zero((byte[])field(permission,"signature")));assertEquals(0,fixture.writes);}
    @Test public void uncertainOriginalACKSealsAndWipesNeverGrantsConsume()throws Exception{Object permission=realPermission();byte[] signature=(byte[])field(permission,"signature");
        call(fixture.owner,"settle",permission,kind("PinReplyDelivery","uncertain"));assertTrue(zero(signature));assertTrue((Boolean)field(fixture.inspection,"sealed"));
        denied(()->fixture.consume(permission));assertFalse((Boolean)field(permission,"consumed"));assertEquals(0,fixture.writes);}
    @Test public void acceptedOriginalWrongTupleBurnsBeforeValidationAndCannotRetry()throws Exception{Object permission=realPermission();
        call(fixture.owner,"settle",permission,kind("PinReplyDelivery","known"));byte[] signature=(byte[])field(permission,"signature");
        call(fixture.core,"claim",fixture.inspection,kind("PinSessionPhase","begun"),kind("PinSessionPhase","committing"));
        try{denied(()->call(fixture.owner,"consume",permission,fixture.session,fixture.next,fixture.nextHash,9L));
            assertTrue("wrong original tuple is permanently spent",(Boolean)field(permission,"consumed"));assertTrue(zero(signature));
            denied(()->call(fixture.owner,"consume",permission,fixture.session,fixture.next,fixture.nextHash,8L));
            assertEquals(0,fixture.writes);
        }finally{call(fixture.core,"settleWorker",fixture.inspection);}}
}
