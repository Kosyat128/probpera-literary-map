package ru.probpera.literaryplanet;

import android.os.Build;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.lifecycle.Lifecycle;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** AUTHORED, NOT_COMPILED/NOT_RUN. Isolated owned .dev target only. No key
 * deletion, data reset, automatic prompt answering or synthesized OS proof.
 * Pure codec/refusal cases do not authenticate a parent or a checkpoint.
 * Interactive first install is opt-in and leaves the real fixed key/seed;
 * subsequent positive execution on that same installation MUST be skipped.
 * Args literaryRunId=32lowerhex, literaryFirstInstallPhase=first-install-v2.
 * Interactive case additionally requires literaryFirstInstallInteractive=true
 * and a real device owner answering the ORIGINAL system credential prompt. */
@RunWith(AndroidJUnit4.class)
public final class PlanetChildFirstInstallRuntimeTest {
    private static final String VERSION="first-install-fixture-v2",POLICY=repeat('a');
    private ActivityScenario<MainActivity> scenario;private MainActivity activity;
    private Object owner,request;private final CountDownLatch releaseRecipient=new CountDownLatch(1);
    private final AtomicReference<Object> delivered=new AtomicReference<>();
    private final AtomicInteger recipientCalls=new AtomicInteger();
    private final AtomicReference<Throwable> recipientFailure=new AtomicReference<>();
    private interface Checked {void run() throws Exception;}
    @Before public void ownedTargetOnly() throws Exception {
        android.os.Bundle args=InstrumentationRegistry.getArguments();
        Assume.assumeTrue("explicit owned first-install phase","first-install-v2".equals(args.getString("literaryFirstInstallPhase"))
            && args.getString("literaryRunId","").matches("[a-f0-9]{32}"));
        Assume.assumeTrue("isolated dev target only",InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName().equals("ru.probpera.literaryplanet.dev"));
    }
    @After public void cleanupOnlyOwnedNativeWork() throws Exception {
        releaseRecipient.countDown();
        if(owner!=null && request!=null){call(owner,"cancel",request);boolean started=(Boolean)field(request,"started");
            if(started)finished();Object receipt=field(request,"receipt");if(receipt!=null && !(Boolean)field(receipt,"settled"))
                call(owner,"settle",receipt,kind("PinReplyDelivery","uncertain"));
            ExecutorService cleanup=Executors.newSingleThreadExecutor();try{Future<?> result=cleanup.submit(()->{try{call(owner,"retire",request);}catch(Exception failure){throw new RuntimeException(failure);}});
                result.get(10,TimeUnit.SECONDS);}finally{cleanup.shutdown();}}
        if(scenario!=null)scenario.close();
        Throwable failure=recipientFailure.get();if(failure!=null)throw new AssertionError("actual recipient assertion failed",failure);
    }
    private static Class<?> type(String name)throws Exception{return Class.forName("ru.probpera.literaryplanet.PlanetChildVault$"+name);}
    private static Exception cause(InvocationTargetException value){Throwable cause=value.getCause();if(cause instanceof Error)throw(Error)cause;
        return cause instanceof Exception?(Exception)cause:new Exception(cause);}
    private static Object create(String name,Object...args)throws Exception{for(Constructor<?> constructor:type(name).getDeclaredConstructors())if(constructor.getParameterCount()==args.length){
            constructor.setAccessible(true);try{return constructor.newInstance(args);}catch(InvocationTargetException failure){throw cause(failure);}}throw new AssertionError("constructor "+name);}
    private static Object call(Object target,String name,Object...args)throws Exception{Class<?> definition=target instanceof Class<?>?(Class<?>)target:target.getClass();
        for(Method method:definition.getDeclaredMethods())if(method.getName().equals(name)&&method.getParameterCount()==args.length){method.setAccessible(true);
            try{return method.invoke(target instanceof Class<?>?null:target,args);}catch(InvocationTargetException failure){throw cause(failure);}}throw new AssertionError("method "+name);}
    private static Object field(Object target,String name)throws Exception{Field field=target.getClass().getDeclaredField(name);field.setAccessible(true);return field.get(target);}
    @SuppressWarnings({"unchecked","rawtypes"})private static Object kind(String type,String name)throws Exception{return Enum.valueOf((Class)type(type),name);}
    private static void denied(Checked body)throws Exception{boolean failed=false;try{body.run();}catch(Exception expected){failed=true;}assertTrue("denial observed outside caught call",failed);}
    private static String repeat(char c){char[] chars=new char[64];Arrays.fill(chars,c);return new String(chars);}
    private static String sha(byte[] bytes)throws Exception{byte[] hash=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder result=new StringBuilder();
        try{for(byte b:hash)result.append(String.format(Locale.ROOT,"%02x",b&255));return result.toString();}finally{Arrays.fill(hash,(byte)0);}}
    private static boolean zero(byte[] bytes){for(byte value:bytes)if(value!=0)return false;return true;}
    private static byte[] seed()throws Exception{return(byte[])call(type("LocalEmptySeedV2"),"canonical",VERSION,POLICY);}
    private static String canonical()throws Exception{return new String(seed(),StandardCharsets.US_ASCII);}
    private void activity()throws Exception{scenario=ActivityScenario.launch(MainActivity.class);scenario.onActivity(value->activity=value);
        long limit=SystemClock.elapsedRealtime()+5000;while(!activity.hasWindowFocus()&&SystemClock.elapsedRealtime()<limit)Thread.sleep(10);assertTrue(activity.hasWindowFocus());}
    private Object newOwner()throws Exception{return create("NativeChildFirstInstall",new PlanetChildVault(activity.getApplicationContext()));}
    private Object request(String locale,long timeout)throws Exception{if(activity==null)activity();if(owner==null)owner=newOwner();
        AtomicReference<Object> result=new AtomicReference<>();AtomicReference<Exception> error=new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{result.set(call(owner,"request",activity,locale,VERSION,POLICY,timeout));}catch(Exception failure){error.set(failure);}});
        if(error.get()!=null)throw error.get();request=result.get();return request;}
    private void supported(){Assume.assumeTrue("API30 auth-per-use device credential",Build.VERSION.SDK_INT>=30);}
    private String alias(){return InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName()+".literary-planet-child-full-record-v1.aes";}
    private String ownerAlias(){return InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName()+".literary-planet-child-device-owner-sign-v1";}
    private boolean key(String alias)throws Exception{KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);return keys.containsAlias(alias);}
    private File directory(){return new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getNoBackupFilesDir(),"literary-planet-child-vault-v1");}
    private boolean childFootprint()throws Exception{File directory=directory();if(key(alias()))return true;
        for(String name:new String[]{"full-record-v1","full-record-v1.bak","full-record-v1.new","first-install-v2","first-install-v2.bak","first-install-v2.new"})if(new File(directory,name).exists())return true;
        return new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getNoBackupFilesDir(),"literary-planet-child-data-v1").exists();}
    private void authenticate(boolean hold)throws Exception{Class<?> recipient=type("FirstInstallRecipient");Object consumer=Proxy.newProxyInstance(recipient.getClassLoader(),new Class<?>[]{recipient},(proxy,method,args)->{
            if(method.getDeclaringClass()==Object.class){if(method.getName().equals("equals"))return proxy==args[0];if(method.getName().equals("hashCode"))return System.identityHashCode(proxy);return "OWNED_FIRST_INSTALL_RECIPIENT";}
            try{recipientCalls.incrementAndGet();delivered.set(args[0]);if(hold)assertTrue("bounded recipient",releaseRecipient.await(20,TimeUnit.SECONDS));return null;}
            catch(Throwable failure){recipientFailure.set(failure);throw failure;}});call(owner,"authenticate",request,consumer);}
    private void finished()throws Exception{long end=SystemClock.elapsedRealtime()+65000;for(;;){boolean done;
            synchronized(owner){done=(Boolean)field(request,"finished");}if(done)return;if(SystemClock.elapsedRealtime()>=end)throw new AssertionError("original prompt/worker cleanup did not settle");Thread.sleep(20);}}

    @Test public void exactEmptySeedHasOnlyLocalZeroClockAndRealRegistryHash()throws Exception{byte[] bytes=seed();String registry="{\"schemaVersion\":1,\"policyVersion\":\""+VERSION+"\",\"activeProfileId\":null,\"profiles\":[]}";
        String expected="{\"schemaVersion\":2,\"revision\":1,\"mode\":\"adult\",\"selectionRevision\":1,\"profileRevision\":1,\"policyChecksum\":\""+POLICY
            +"\",\"registryChecksum\":\""+sha(registry.getBytes(StandardCharsets.UTF_8))+"\",\"registry\":"+registry+",\"pin\":null,\"clock\":{\"schemaVersion\":2,\"logicalMs\":0}}";
        assertArrayEquals(expected.getBytes(StandardCharsets.UTF_8),bytes);
        String[][] vectors={{"synthetic-local-v2",repeat('a'),"3bcb6774320bf9e7732200baf02422037aa055377d427a6b4d272ac78f462420","bcf1edf94a54e3e55eca07c78fb820dd33ac9943e219959d6d4309145cdc92cf"},
            {"shared-policy.2026-10",repeat('b'),"43731657467908109f159c6a5aa77929ede7bf339f3322eb57e060fc78961336","8938bfcd08cbeb669d7216ed47f71704bb16249b06e47cd8847a1f580f91e03d"}};
        for(String[] vector:vectors){byte[] actual=(byte[])call(type("LocalEmptySeedV2"),"canonical",vector[0],vector[1]);
            try{assertEquals("independent public OpenSSL full vector",vector[3],sha(actual));assertTrue(new String(actual,StandardCharsets.US_ASCII).contains("\"registryChecksum\":\""+vector[2]+"\""));}
            finally{Arrays.fill(actual,(byte)0);}}
        Object value=call(type("LocalEmptySeedV2"),"decode",bytes,VERSION,POLICY);
        assertEquals(sha(bytes),field(value,"checksum"));call(value,"close");Arrays.fill(bytes,(byte)0);}
    @Test public void noncanonicalOrderUnknownFieldAndNonemptyRegistryAreRejected()throws Exception{String raw=canonical();
        String[] values={raw.replace("\"schemaVersion\":2,\"revision\":1","\"revision\":1,\"schemaVersion\":2"),raw.replace("\"logicalMs\":0","\"logicalMs\":0,\"bootId\":\"fake\""),
            raw.replace("\"profiles\":[]","\"profiles\":[{}]"),raw+" ",raw.replace("\"mode\":\"adult\"","\"mode\":\"child\"")};
        for(String value:values)denied(()->call(type("LocalEmptySeedV2"),"decode",value.getBytes(StandardCharsets.UTF_8),VERSION,POLICY));}
    @Test public void seedRejectsPinRevisionPolicyRegistryAndClockSubstitution()throws Exception{String raw=canonical();
        for(String value:new String[]{raw.replace("\"pin\":null","\"pin\":{}"),raw.replace("\"revision\":1","\"revision\":2"),raw.replace(POLICY,repeat('b')),
            raw.replace("\"registryChecksum\":\"","\"registryChecksum\":\"f"),raw.replace("\"logicalMs\":0","\"logicalMs\":1")})
            denied(()->call(type("LocalEmptySeedV2"),"decode",value.getBytes(StandardCharsets.UTF_8),VERSION,POLICY));}
    @Test public void oldV1DecoderNeverAdmitsNewLocalSeed()throws Exception{byte[] raw=seed();denied(()->PlanetChildVault.ProtectedEnvelope.decode(raw,VERSION,POLICY,600000));assertArrayEquals(seed(),raw);Arrays.fill(raw,(byte)0);}
    @Test public void decodeOwnsCopiesAndCloseWipesActualBacking()throws Exception{byte[] raw=seed();Object value=call(type("LocalEmptySeedV2"),"decode",raw,VERSION,POLICY);
        byte[] backing=(byte[])field(value,"bytes"),copy=(byte[])call(value,"copy");Arrays.fill(raw,(byte)7);Arrays.fill(copy,(byte)8);assertFalse(zero(backing));
        assertArrayEquals(seed(),(byte[])call(value,"copy"));call(value,"close");assertTrue(zero(backing));denied(()->call(value,"copy"));Arrays.fill(raw,(byte)0);Arrays.fill(copy,(byte)0);}
    @Test public void malformedPolicyDoesNotCreateAnySetupRequest()throws Exception{supported();activity();owner=newOwner();boolean aes=key(alias()),sign=key(ownerAlias());
        AtomicBoolean denied=new AtomicBoolean();InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{call(owner,"request",activity,"en","bad\"id",POLICY,1000L);}catch(Exception expected){denied.set(true);}});
        assertTrue(denied.get());assertNull(field(owner,"active"));assertEquals(aes,key(alias()));assertEquals(sign,key(ownerAlias()));}
    @Test public void apiBelow30RefusesBeforeKeysOrRecord()throws Exception{Assume.assumeTrue(Build.VERSION.SDK_INT<30);activity();owner=newOwner();boolean aes=key(alias()),sign=key(ownerAlias());
        denied(()->request("en",1000));assertNull(field(owner,"active"));assertEquals(aes,key(alias()));assertEquals(sign,key(ownerAlias()));}
    @Test public void invalidLocaleCannotReserveOriginalRequest()throws Exception{supported();activity();owner=newOwner();boolean aes=key(alias()),sign=key(ownerAlias());
        denied(()->request("de",1000));assertNull(field(owner,"active"));assertEquals(aes,key(alias()));assertEquals(sign,key(ownerAlias()));}
    @Test public void secondRequestCannotOvertakeOriginalHostOrDeadline()throws Exception{supported();Object original=request("ru",5000);long deadline=(Long)field(original,"deadlineUptimeMs");
        denied(()->request("en",60000));assertSame(original,field(owner,"active"));assertEquals(deadline,field(original,"deadlineUptimeMs"));request=original;}
    @Test public void prestartCancelLeavesStorageUntouchedAndExplicitRetryPossible()throws Exception{supported();Object original=request("en",5000);boolean aes=key(alias()),sign=key(ownerAlias()),footprint=childFootprint();
        scenario.moveToState(Lifecycle.State.CREATED);scenario.moveToState(Lifecycle.State.RESUMED);assertTrue("request-time lifecycle loss remains latched",(Boolean)field(original,"cancelled"));
        call(owner,"cancel",original);denied(()->authenticate(false));call(owner,"retire",original);request=null;
        assertEquals(aes,key(alias()));assertEquals(sign,key(ownerAlias()));assertEquals(footprint,childFootprint());Object retry=request("ru",1000);assertNotSame(original,retry);assertFalse((Boolean)field(retry,"mutationStarted"));}
    @Test public void originalExpiryCannotRenewOrStartPlatformWork()throws Exception{supported();request("en",20);long deadline=(Long)field(request,"deadlineUptimeMs");
        while(SystemClock.elapsedRealtime()<deadline)Thread.sleep(5);boolean aes=key(alias()),sign=key(ownerAlias());denied(()->authenticate(false));
        assertEquals(deadline,field(request,"deadlineUptimeMs"));assertFalse((Boolean)field(request,"started"));assertEquals(aes,key(alias()));assertEquals(sign,key(ownerAlias()));}
    @Test public void concurrentOriginalRetireCannotOvertakeHeldCleanupOrClearFreshRequest()throws Exception{supported();Object original=request("en",60000);
        boolean aes=key(alias()),sign=key(ownerAlias()),footprint=childFootprint();CountDownLatch mainEntered=new CountDownLatch(1),releaseMain=new CountDownLatch(1);
        ExecutorService workers=Executors.newFixedThreadPool(2);Future<?> first=null;Future<Boolean> second=null;
        try{assertTrue(new android.os.Handler(android.os.Looper.getMainLooper()).post(()->{mainEntered.countDown();
                try{if(!releaseMain.await(10,TimeUnit.SECONDS))recipientFailure.set(new AssertionError("owned main cleanup hold exceeded"));}
                catch(InterruptedException failure){Thread.currentThread().interrupt();recipientFailure.set(failure);}}));
            assertTrue(mainEntered.await(2,TimeUnit.SECONDS));first=workers.submit(()->{try{call(owner,"retire",original);}catch(Exception failure){throw new RuntimeException(failure);}});
            long limit=SystemClock.elapsedRealtime()+2000;boolean held=false;while(SystemClock.elapsedRealtime()<limit){synchronized(owner){held=(Boolean)field(original,"retirementClaimed")
                    && (Integer)field(original,"cleanupCalls")==1 && (Integer)field(original,"mainCalls")>0;}if(held)break;Thread.sleep(5);}
            assertTrue("actual original main cleanup is held",held);assertFalse(first.isDone());denied(()->call(owner,"live",original));
            second=workers.submit(()->{try{call(owner,"retire",original);return false;}catch(Exception expected){return true;}});
            assertTrue("duplicate retire refuses while first cleanup is actually held",second.get(1,TimeUnit.SECONDS));assertFalse(first.isDone());
            assertSame(original,field(owner,"active"));assertFalse((Boolean)field(original,"retired"));releaseMain.countDown();first.get(5,TimeUnit.SECONDS);
            assertTrue((Boolean)field(original,"retired"));assertNull(field(owner,"active"));request=null;Object fresh=request("ru",5000);
            denied(()->call(owner,"retire",original));assertSame(fresh,field(owner,"active"));assertFalse((Boolean)field(fresh,"retirementClaimed"));
            assertEquals(aes,key(alias()));assertEquals(sign,key(ownerAlias()));assertEquals(footprint,childFootprint());
        }finally{releaseMain.countDown();try{if(first!=null)first.get(10,TimeUnit.SECONDS);if(second!=null)second.get(10,TimeUnit.SECONDS);}
            finally{workers.shutdown();if((Boolean)field(original,"retired")&&request==original)request=null;}}}
    @Test public void foreignOriginalCannotUseOwnerLaneOrClaimSettlement()throws Exception{supported();request("en",5000);Object foreign=newOwner();
        denied(()->call(foreign,"live",request));denied(()->call(owner,"settle",null,kind("PinReplyDelivery","known")));assertFalse((Boolean)field(request,"mutationStarted"));}
    @Test public void operationDomainBindsLocaleSeedNonceAndOriginalDeadline()throws Exception{supported();request("ru",5000);byte[] payload=(byte[])field(request,"payload"),actual=(byte[])call(type("NativeChildFirstInstall"),"operation",request);
        assertArrayEquals(payload,actual);assertTrue(new String(payload,0,26,StandardCharsets.US_ASCII).startsWith("LP-LOCAL-FIRST-INSTALL\0v2"));
        assertTrue(new String(payload,StandardCharsets.US_ASCII).contains(sha(seed())));byte[] nonce=(byte[])field(request,"nonce");byte saved=nonce[0];nonce[0]^=1;
        try{denied(()->call(owner,"live",request));}finally{nonce[0]=saved;Arrays.fill(actual,(byte)0);}assertFalse((Boolean)field(request,"permissionConsumed"));}
    @Test public void existingAnyChildFootprintNeverBecomesImplicitSeed()throws Exception{supported();Assume.assumeTrue("retained real child footprint required; never create/reset it for coverage",childFootprint());
        request("en",1000);boolean aes=key(alias());authenticate(false);finished();assertNull(delivered.get());assertEquals(1,recipientCalls.get());
        assertFalse((Boolean)field(request,"mutationStarted"));assertFalse((Boolean)field(request,"permissionConsumed"));assertEquals(aes,key(alias()));}
    @Test public void isolatedOrphanAndCorruptFootprintClassifierRejectsEveryKnownSuffix()throws Exception{supported();
        Assume.assumeFalse("fresh actual child namespace; never erase it",childFootprint());activity();owner=newOwner();KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);
        File parent=InstrumentationRegistry.getInstrumentation().getTargetContext().getNoBackupFilesDir().getCanonicalFile();
        File owned=new File(parent,"first-install-footprints-synthetic-"+InstrumentationRegistry.getArguments().getString("literaryRunId"));
        assertEquals(parent,owned.getCanonicalFile().getParentFile());assertTrue("new exclusively owned fixture directory",owned.mkdir());
        String[] names={"full-record-v1","full-record-v1.bak","full-record-v1.new","first-install-v2","first-install-v2.bak","first-install-v2.new","unclassified-child-state"};
        try{call(owner,"empty",owned,keys);for(String name:names){File file=new File(owned,name);assertTrue(file.createNewFile());
                try{try(java.io.FileOutputStream output=new java.io.FileOutputStream(file)){output.write(new byte[]{0,1,2});output.getFD().sync();}
                    denied(()->call(owner,"empty",owned,keys));assertFalse((Boolean)field(owner,"sealed"));assertNull(field(owner,"active"));
                }finally{assertTrue("remove only known owned synthetic leaf",file.delete());}call(owner,"empty",owned,keys);}
        }finally{assertEquals(0,Objects.requireNonNull(owned.list()).length);assertTrue("remove only newly owned empty directory",owned.delete());}}
    private Object interactiveReceipt(String selected)throws Exception{supported();Assume.assumeTrue("explicit interactive owner response", "true".equals(InstrumentationRegistry.getArguments().getString("literaryFirstInstallInteractive")));
        Assume.assumeTrue("one interactive scenario per fresh installation",selected.equals(InstrumentationRegistry.getArguments().getString("literaryFirstInstallInteractiveCase","success")));
        Assume.assumeFalse("fresh isolated installation; no reset/reinstall in fixture",childFootprint());request("en",60000);authenticate(false);finished();
        Object receipt=delivered.get();assertNotNull("actual OS Signature success only",receipt);assertEquals(1,recipientCalls.get());assertTrue((Boolean)field(request,"permissionConsumed"));
        assertTrue((Boolean)field(request,"deliveryCompleted"));assertTrue(key(alias()));assertTrue(new File(directory(),"first-install-v2").isFile());
        assertFalse("native observer latch stays until actual retirement",(Boolean)field(request,"detached"));return receipt;}
    @Test public void actualInteractiveOwnerCreatesExactDurableSeedOnlyOnce()throws Exception{Object receipt=interactiveReceipt("success");
        PlanetChildVault vault=new PlanetChildVault(activity.getApplicationContext());byte[] raw=(byte[])call(owner,"readInstalledSeed",receipt);
        try{assertArrayEquals(seed(),raw);assertEquals(sha(raw),field(receipt,"checksum"));denied(vault::readProtected);
            Object forged=create("FirstInstallReceipt",owner,request);denied(()->call(owner,"settle",forged,kind("PinReplyDelivery","known")));call(forged,"close");
            call(owner,"settle",receipt,kind("PinReplyDelivery","known"));denied(()->call(owner,"settle",receipt,kind("PinReplyDelivery","known")));assertTrue((Boolean)field(receipt,"disposed"));
        }finally{Arrays.fill(raw,(byte)0);}}
    @Test public void actualInteractiveReceiptCannotKnownAckAfterExclusiveExpiry()throws Exception{Object receipt=interactiveReceipt("late-ack");
        long deadline=(Long)field(request,"deadlineUptimeMs");while(SystemClock.elapsedRealtime()<deadline)Thread.sleep(20);
        denied(()->call(owner,"settle",receipt,kind("PinReplyDelivery","known")));assertFalse((Boolean)field(receipt,"settled"));
        assertTrue("durable setup is never rolled back/refunded",(Boolean)field(request,"mutationStarted"));assertTrue(key(alias()));
        call(owner,"settle",receipt,kind("PinReplyDelivery","uncertain"));}
    @Test public void actualInteractiveBackgroundResumeCannotReviveOriginalReceipt()throws Exception{Object receipt=interactiveReceipt("lifecycle");
        scenario.moveToState(Lifecycle.State.CREATED);scenario.moveToState(Lifecycle.State.RESUMED);
        assertTrue("sticky original host cancellation",(Boolean)field(request,"cancelled"));denied(()->call(owner,"settle",receipt,kind("PinReplyDelivery","known")));
        assertFalse((Boolean)field(receipt,"settled"));assertTrue((Boolean)field(request,"mutationStarted"));
        call(owner,"settle",receipt,kind("PinReplyDelivery","uncertain"));}
}
