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

    /** New LOCAL v2 cases only. Scalar comparisons do not grant permission;
     * lifecycle cases use a real original Activity but never open/write vault IO.
     * All are authored NOT_RUN; existing nineteen methods stay byte-exact. */
    private static Object snapshotPolicy(long... delays)throws Exception{return create("LocalSnapshotV2Policy",VERSION,POLICY,1200000L,delays);}
    private static String localPin(long revision,long count,long blocked,long at,String pending){return "{\"schemaVersion\":1,\"policyVersion\":\""+VERSION
        +"\",\"revision\":"+revision+",\"credentialId\":\""+repeat('c')+"\",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":600000,\"saltHex\":\""
        +repeat('d')+"\",\"hashHex\":\""+repeat('e')+"\"},\"attempts\":{\"count\":"+count+",\"blockedUntilMs\":"+blocked+",\"lastObservedMs\":"+at
        +",\"pendingAttemptId\":"+(pending==null?"null":"\""+pending+"\"")+"}}";}
    private static byte[] localWrapper(long root,long pin,long jr,long count,long at,long delay,String pending)throws Exception{
        String protectedRecord=canonical().replace("\"schemaVersion\":2,\"revision\":1","\"schemaVersion\":2,\"revision\":"+root)
            .replace("\"pin\":null","\"pin\":"+localPin(pin,count,count==0?0:at+delay,at,pending));
        String journal="{\"schemaVersion\":2,\"policyVersion\":\""+VERSION+"\",\"policyChecksum\":\""+POLICY+"\",\"revision\":"+jr
            +",\"protected\":{\"checksum\":\""+sha(protectedRecord.getBytes(StandardCharsets.UTF_8))+"\",\"revision\":"+root+",\"pinRevision\":"+pin
            +",\"credentialId\":\""+repeat('c')+"\"},\"attempts\":{\"count\":"+count+",\"pendingAttemptId\":"+(pending==null?"null":"\""+pending+"\"")
            +",\"savedCooldownMs\":"+delay+"},\"anchor\":{\"logicalMs\":"+at+"}}";
        return ("{\"schemaVersion\":2,\"protectedRecord\":"+protectedRecord+",\"restartJournal\":"+journal+"}").getBytes(StandardCharsets.UTF_8);}
    private static Object localDecode(byte[] bytes,Object policy)throws Exception{return call(type("LocalSnapshotV2"),"decode",bytes,policy);}
    private static void localSet(Object target,String name,Object value)throws Exception{Field field=target.getClass().getDeclaredField(name);field.setAccessible(true);field.set(target,value);}
    private static String localProtected(byte[] wrapper){String text=new String(wrapper,StandardCharsets.UTF_8);int start=text.indexOf("\"protectedRecord\":")+18;
        return text.substring(start,text.indexOf(",\"restartJournal\":"));}
    private Object localRequest(Object localOwner,long timeout)throws Exception{AtomicReference<Object> original=new AtomicReference<>();AtomicReference<Exception> error=new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{original.set(call(localOwner,"request",activity,snapshotPolicy(100L,250L),timeout));}catch(Exception failure){error.set(failure);}});
        if(error.get()!=null)throw error.get();return original.get();}
    private static void localRetire(Object localOwner,Object original)throws Exception{if(original!=null&&!(Boolean)field(original,"retired"))call(localOwner,"retire",original);}

    // Every historical host fixture owns an isolated coordinator. A sealed
    // case cannot poison another JUnit method or reset the production singleton.
    private static Object localClock(Object policy,java.util.function.LongSupplier now)throws Exception{Class<?> elapsed=type("LocalV2ElapsedClock");
        Object source=Proxy.newProxyInstance(elapsed.getClassLoader(),new Class<?>[]{elapsed},(proxy,method,args)->{
            if(method.getName().equals("now"))return now.getAsLong();throw new UnsupportedOperationException(method.getName());});
        return create("LocalV2ProcessClock","isolated-dev-fixture-"+UUID.randomUUID(),policy,source);}
    private Object localOwner()throws Exception{return localOwner(localClock(snapshotPolicy(100L,250L),SystemClock::elapsedRealtime));}
    private Object localOwner(Object clock)throws Exception{return create("LocalV2Writer",new PlanetChildVault(activity.getApplicationContext()),clock);}
    private Object localRequest(Object owner,Object policy,long timeout)throws Exception{AtomicReference<Object> result=new AtomicReference<>();AtomicReference<Exception> error=new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{result.set(call(owner,"request",activity,policy,timeout));}catch(Exception failure){error.set(failure);}});
        if(error.get()!=null)throw error.get();return result.get();}
    private static Object localLease(Object clock,long timeout)throws Exception{return call(clock,"claim",new Object(),timeout);}
    private static byte[] localCold(Object clock,Object policy,byte[] before)throws Exception{Object lease=localLease(clock,50000),sample=call(clock,"sampleReanchor",lease,before),receipt=new Object();
        Object record=localDecode(before,policy);byte[] after;try{after=(byte[])call(type("LocalSnapshotV2"),"reanchor",record);}finally{call(record,"close");}
        call(clock,"stage",lease,receipt,before,after,sample,kind("LocalV2ClockAction","reanchor"));call(clock,"acknowledge",lease,receipt,after);call(clock,"release",lease);return after;}

    @Test public void localV2IndependentWholeProtectedAndRegistryChecksums()throws Exception{Object policy=snapshotPolicy(100L,250L);byte[] bytes=localWrapper(2,1,1,0,17,0,null);
        Object value=localDecode(bytes,policy);try{assertEquals(sha(bytes),field(value,"checksum"));assertEquals(sha(localProtected(bytes).getBytes(StandardCharsets.UTF_8)),field(value,"protectedChecksum"));
            assertEquals(0L,field(value,"clockMs"));assertEquals(17L,field(value,"lastObservedMs"));call(type("LocalSnapshotV2"),"validateEnrollment",seed(),value,17L);
            denied(()->call(type("LocalSnapshotV2"),"validateEnrollment",seed(),value,0L));}finally{call(value,"close");Arrays.fill(bytes,(byte)0);}}
    @Test public void localV2BareSeedAndAllJournalCrossCoordinateSubstitutionsDeny()throws Exception{Object policy=snapshotPolicy(100L,250L);denied(()->localDecode(seed(),policy));
        String raw=new String(localWrapper(3,2,2,1,17,100,repeat('f')),StandardCharsets.UTF_8);
        for(String altered:new String[]{raw.replace("\"anchor\":{\"logicalMs\":17}","\"anchor\":{\"logicalMs\":18}"),raw.replace("\"savedCooldownMs\":100","\"savedCooldownMs\":99"),
            raw.replace("\"pinRevision\":2","\"pinRevision\":3"),raw.replace("\"credentialId\":\""+repeat('c')+"\"},\"attempts\"","\"credentialId\":\""+repeat('b')+"\"},\"attempts\""),
            raw.replace("\"clock\":{\"schemaVersion\":2,\"logicalMs\":0}","\"clock\":{\"schemaVersion\":2,\"logicalMs\":18}")})denied(()->localDecode(altered.getBytes(StandardCharsets.UTF_8),policy));}
    @Test public void localV2CanonicalOrderDuplicateUnknownAndInvalidUtf8Deny()throws Exception{Object policy=snapshotPolicy(100L);String raw=new String(localWrapper(2,1,1,0,0,0,null),StandardCharsets.UTF_8);
        for(String altered:new String[]{" "+raw,raw+"\n",raw.replace("\"schemaVersion\":2,\"protectedRecord\":","\"protectedRecord\":{} ,\"schemaVersion\":2,\"protectedRecord\":"),
            raw.replace("\"logicalMs\":0","\"logicalMs\":0,\"bootId\":\"fake\""),raw.replace("\"logicalMs\":0","\"logicalMs\":0.0"),raw.replace("\"revision\":2","\"revision\":2,\"revision\":2")})
            denied(()->localDecode(altered.getBytes(StandardCharsets.UTF_8),policy));byte[] malformed=raw.getBytes(StandardCharsets.UTF_8);malformed[0]=(byte)0xff;denied(()->localDecode(malformed,policy));}
    @Test public void localV2ReanchorPreservesProtectedAndReappliesWholeSavedDebt()throws Exception{Object policy=snapshotPolicy(100L,250L);byte[] initial=localWrapper(3,2,2,1,17,100,repeat('f'));
        Object before=localDecode(initial,policy),after=null;byte[] next=null;try{next=(byte[])call(type("LocalSnapshotV2"),"reanchor",before);after=localDecode(next,policy);
            assertEquals(localProtected(initial),localProtected(next));assertEquals(3L,field(after,"journalRevision"));assertEquals(17L,field(after,"lastObservedMs"));
            assertEquals(100L,field(after,"savedCooldownMs"));assertEquals(117L,field(after,"blockedUntilMs"));assertEquals(repeat('f'),field(after,"pendingAttemptId"));
        }finally{call(before,"close");if(after!=null)call(after,"close");if(next!=null)Arrays.fill(next,(byte)0);Arrays.fill(initial,(byte)0);}}
    @Test public void localV2ChargeChangesOnlyPinDebtAndOriginalCoordinates()throws Exception{Object policy=snapshotPolicy(100L,250L);Object before=localDecode(localWrapper(2,1,1,0,17,0,null),policy),after=null;
        byte[] charged=null;try{charged=(byte[])call(type("LocalSnapshotV2"),"charge",before,repeat('f'),18L);after=localDecode(charged,policy);
            assertEquals(3L,field(after,"revision"));assertEquals(2L,field(after,"pinRevision"));assertEquals(2L,field(after,"journalRevision"));assertEquals(1L,field(after,"count"));
            assertEquals(118L,field(after,"blockedUntilMs"));assertEquals(18L,field(after,"lastObservedMs"));assertEquals(0L,field(after,"clockMs"));
            assertEquals(repeat('f'),field(after,"pendingAttemptId"));assertTrue(localProtected(charged).contains("\"saltHex\":\""+repeat('d')+"\",\"hashHex\":\""+repeat('e')+"\""));
        }finally{call(before,"close");if(after!=null)call(after,"close");if(charged!=null)Arrays.fill(charged,(byte)0);}}
    @Test public void localV2ChargeRejectsEarlyTimeInvalidAttemptAndRevisionOverflow()throws Exception{Object policy=snapshotPolicy(100L);Object charged=localDecode(localWrapper(3,2,2,1,17,100,repeat('f')),policy);
        try{denied(()->call(type("LocalSnapshotV2"),"charge",charged,repeat('b'),116L));denied(()->call(type("LocalSnapshotV2"),"charge",charged,"not-an-original-id",117L));}
        finally{call(charged,"close");}Object exhausted=localDecode(localWrapper(9007199254740991L,1,1,0,0,0,null),policy);
        try{denied(()->call(type("LocalSnapshotV2"),"charge",exhausted,repeat('f'),0L));}finally{call(exhausted,"close");}
        denied(()->localDecode(localWrapper(3,2,2,1,9007199254740991L,100,repeat('f')),policy));}
    @Test public void localV2FinalizeDataClearsPendingWithExactMatchOrMismatchShape()throws Exception{Object policy=snapshotPolicy(100L,250L);Object charged=localDecode(localWrapper(3,2,2,1,17,100,repeat('f')),policy);
        Object match=localDecode(localWrapper(4,3,3,0,18,0,null),policy),mismatch=localDecode(localWrapper(4,3,3,1,18,100,null),policy);
        try{call(type("LocalSnapshotV2"),"validateFinalization",charged,match);call(type("LocalSnapshotV2"),"validateFinalization",charged,mismatch);
            assertEquals(0L,field(match,"blockedUntilMs"));assertEquals(118L,field(mismatch,"blockedUntilMs"));assertEquals(0L,field(mismatch,"clockMs"));
        }finally{call(charged,"close");call(match,"close");call(mismatch,"close");}}
    @Test public void localV2FinalizeRejectsUnchargedRollbackForeignVerifierAndWrongCount()throws Exception{Object policy=snapshotPolicy(100L,250L);Object charged=localDecode(localWrapper(3,2,2,1,17,100,repeat('f')),policy);
        Object uncharged=localDecode(localWrapper(2,1,1,0,17,0,null),policy),rollback=localDecode(localWrapper(4,3,3,0,16,0,null),policy),wrongCount=localDecode(localWrapper(4,3,3,2,18,250,null),policy);
        try{denied(()->call(type("LocalSnapshotV2"),"validateFinalization",uncharged,rollback));denied(()->call(type("LocalSnapshotV2"),"validateFinalization",charged,rollback));
            denied(()->call(type("LocalSnapshotV2"),"validateFinalization",charged,wrongCount));byte[] foreign=localWrapper(4,3,3,0,18,0,null);
            String record=localProtected(foreign).replace(repeat('d'),repeat('b')),raw=new String(foreign,StandardCharsets.UTF_8);
            String oldHash=sha(localProtected(foreign).getBytes(StandardCharsets.UTF_8));raw=raw.replace(localProtected(foreign),record).replace(oldHash,sha(record.getBytes(StandardCharsets.UTF_8)));
            Object altered=localDecode(raw.getBytes(StandardCharsets.UTF_8),policy);try{denied(()->call(type("LocalSnapshotV2"),"validateFinalization",charged,altered));}finally{call(altered,"close");}
        }finally{call(charged,"close");call(uncharged,"close");call(rollback,"close");call(wrongCount,"close");}}
    @Test public void localV2OwnedCanonicalCopiesAndCloseWipeOnlyOriginalOwnedBuffer()throws Exception{Object policy=snapshotPolicy(100L);byte[] input=localWrapper(2,1,1,0,0,0,null),expected=input.clone();
        Object original=localDecode(input,policy);byte[] retained=(byte[])field(original,"canonical"),copy=(byte[])call(original,"copy");
        try{Arrays.fill(input,(byte)7);assertArrayEquals(expected,copy);copy[0]^=1;assertArrayEquals(expected,(byte[])call(original,"copy"));call(original,"close");
            assertTrue(zero(retained));denied(()->call(original,"copy"));assertFalse("caller-owned input is untouched by close",zero(input));
        }finally{call(original,"close");Arrays.fill(input,(byte)0);Arrays.fill(expected,(byte)0);Arrays.fill(copy,(byte)0);}}
    @Test public void localV2BackgroundAndExclusiveDeadlineNeverReviveOriginalHost()throws Exception{activity();Object localOwner=localOwner();Object original=localRequest(localOwner,5000);
        try{scenario.moveToState(Lifecycle.State.CREATED);scenario.moveToState(Lifecycle.State.RESUMED);assertTrue((Boolean)field(original,"cancelled"));denied(()->call(localOwner,"live",original));}
        finally{localRetire(localOwner,original);}Object next=localRequest(localOwner,30);try{long deadline=(Long)field(next,"deadline");while(SystemClock.elapsedRealtime()<deadline)Thread.sleep(5);
            denied(()->call(localOwner,"live",next));assertTrue((Boolean)field(next,"cancelled")||SystemClock.elapsedRealtime()>=deadline);}finally{localRetire(localOwner,next);}}
    @Test public void localV2HeldMainRetirementIsExclusiveAndCannotClearFreshOriginal()throws Exception{activity();Object localOwner=localOwner(),original=localRequest(localOwner,5000);
        CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);ExecutorService workers=Executors.newFixedThreadPool(2);Future<?> first=null;
        try{new android.os.Handler(android.os.Looper.getMainLooper()).post(()->{entered.countDown();try{if(!release.await(5,TimeUnit.SECONDS))throw new AssertionError("bounded owned hold");}
                catch(InterruptedException failure){Thread.currentThread().interrupt();throw new AssertionError(failure);}});assertTrue(entered.await(2,TimeUnit.SECONDS));
            first=workers.submit(()->{try{call(localOwner,"retire",original);}catch(Exception failure){throw new RuntimeException(failure);}});
            long limit=SystemClock.elapsedRealtime()+2000;boolean held=false;while(SystemClock.elapsedRealtime()<limit){synchronized(localOwner){held=(Boolean)field(original,"retiring")&&(Integer)field(original,"mainCalls")>0;}if(held)break;Thread.sleep(5);}
            assertTrue(held);assertFalse(first.isDone());denied(()->call(localOwner,"retire",original));assertSame(original,field(localOwner,"active"));release.countDown();first.get(5,TimeUnit.SECONDS);
            assertTrue((Boolean)field(original,"retired"));Object fresh=localRequest(localOwner,5000);try{denied(()->call(localOwner,"retire",original));assertSame(fresh,field(localOwner,"active"));}
            finally{localRetire(localOwner,fresh);}
        }finally{release.countDown();try{if(first!=null)first.get(10,TimeUnit.SECONDS);else localRetire(localOwner,original);}finally{workers.shutdown();}}}
    @Test public void localV2CancelKeepsActualHostWorkerUntilReturnThenWipesOwnedBytes()throws Exception{activity();Object localOwner=localOwner(),original=localRequest(localOwner,5000);
        byte[] owned={1,2,3};localSet(original,"currentBytes",owned);localSet(original,"currentChecksum",sha(owned));CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);
        ExecutorService worker=Executors.newSingleThreadExecutor();Future<Boolean> actual=null;boolean begun=false;
        try{call(localOwner,"begin",original);begun=true;new android.os.Handler(android.os.Looper.getMainLooper()).post(()->{entered.countDown();try{if(!release.await(5,TimeUnit.SECONDS))throw new AssertionError("bounded original host hold");}
                catch(InterruptedException failure){Thread.currentThread().interrupt();throw new AssertionError(failure);}});assertTrue(entered.await(2,TimeUnit.SECONDS));
            actual=worker.submit(()->{try{call(localOwner,"host",original);return false;}catch(Exception expected){return true;}finally{try{call(localOwner,"finish",original);}catch(Exception failure){throw new RuntimeException(failure);}}});
            long limit=SystemClock.elapsedRealtime()+2000;boolean held=false;while(SystemClock.elapsedRealtime()<limit){synchronized(localOwner){held=(Integer)field(original,"mainCalls")>0;}if(held)break;Thread.sleep(5);}
            assertTrue(held);call(localOwner,"cancel",original);assertFalse("worker data cannot wipe before actual main return",zero(owned));assertEquals(1,field(original,"workers"));release.countDown();
            assertTrue(actual.get(5,TimeUnit.SECONDS));assertEquals(0,field(original,"workers"));assertTrue("actual owned return permits wiping",zero(owned));
        }finally{release.countDown();try{if(actual!=null)actual.get(10,TimeUnit.SECONDS);else if(begun)call(localOwner,"finish",original);localRetire(localOwner,original);}finally{worker.shutdown();}}}
    @Test public void localV2StorageReceiptIsOriginalDataOnlyAndCancellationWipesWithoutAck()throws Exception{activity();Object localOwner=localOwner(),original=localRequest(localOwner,5000);
        byte[] raw={1,2,3};Object receipt=create("LocalV2StorageReceipt",localOwner,original,raw);localSet(original,"receipt",receipt);
        try{assertArrayEquals(raw,(byte[])call(receipt,"copy"));Object foreign=create("LocalV2StorageReceipt",localOwner,original,new byte[]{1,2,3});
            try{denied(()->call(localOwner,"acknowledge",foreign));}finally{call(foreign,"close");}
            byte[] seedBytes=seed();Object sample=create("LocalV2EnrollmentSample",localOwner,original,seedBytes);localSet(original,"enrollmentSample",sample);
            long retained=(Long)field(sample,"logicalMs"),sampled=(Long)field(sample,"continuousMs");Thread.sleep(5);assertTrue(SystemClock.elapsedRealtime()>=sampled);
            Object next=localDecode(localWrapper(2,1,1,0,retained,0,null),snapshotPolicy(100L,250L));
            try{call(type("LocalSnapshotV2"),"validateEnrollment",seedBytes,next,retained);assertArrayEquals(seedBytes,(byte[])call(sample,"copySeed"));
                Object forged=create("LocalV2EnrollmentSample",localOwner,original,seed());denied(()->call(localOwner,"enroll",original,forged,(byte[])call(next,"copy")));
                call(forged,"wipe");assertFalse((Boolean)field(sample,"consumed"));}finally{call(next,"close");}
            call(localOwner,"cancel",original);assertTrue(zero(raw));assertTrue(zero(seedBytes));denied(()->call(sample,"copySeed"));
            denied(()->call(receipt,"copy"));denied(()->call(localOwner,"acknowledge",receipt));assertSame(original,field(localOwner,"active"));assertFalse((Boolean)field(original,"mutationStarted"));
            Method factory=PlanetChildVault.class.getDeclaredMethod("actualSdkLocalV2Writer",PlanetChildVault.class);factory.setAccessible(true);assertNull(factory.invoke(null,new PlanetChildVault(activity.getApplicationContext())));
            denied(()->call(localOwner,"retire",original));assertTrue((Boolean)field(original,"retired"));assertNull(field(localOwner,"active"));
        }finally{localRetire(localOwner,original);}}

    /** New mechanical process-coordinator cases use isolated synthetic clocks.
     * Real-host cases exercise actual Activity/handler joins without vault IO.
     * No case installs a synthetic clock into the production singleton. NOT_RUN. */
    @Test public void localV2ProcessClockAccrues120SecondsAcrossShortOriginals()throws Exception{AtomicLong now=new AtomicLong(1000);Object policy=snapshotPolicy(120000L),clock=localClock(policy,now::get);
        byte[] raw=localCold(clock,policy,localWrapper(3,2,2,1,17,120000,repeat('f')));try{now.set(31000);Object a=localLease(clock,30000);
            assertTrue((Boolean)call(clock,"inspect",a,raw));assertEquals(30017L,call(clock,"logical",a,raw));long deadline=(Long)field(a,"deadline");call(clock,"release",a);
            now.set(61000);Object b=localLease(clock,30000);assertEquals(60017L,call(clock,"logical",b,raw));call(clock,"release",b);
            now.set(121000);Object c=localLease(clock,30000);assertEquals(120017L,call(clock,"logical",c,raw));assertEquals(deadline,field(a,"deadline"));
            denied(()->call(clock,"current",a));call(clock,"release",c);}finally{Arrays.fill(raw,(byte)0);}}
    @Test public void localV2FreshSimulatedProcessReappliesFullDebtWithoutOutsideCredit()throws Exception{Object policy=snapshotPolicy(120000L);AtomicLong firstTime=new AtomicLong(1000),newTime=new AtomicLong(900000);
        Object first=localClock(policy,firstTime::get),fresh=localClock(policy,newTime::get);byte[] before=localCold(first,policy,localWrapper(3,2,2,1,17,120000,repeat('f'))),after=localCold(fresh,policy,before);
        try{Object lease=localLease(fresh,30000),record=localDecode(after,policy);try{assertEquals(17L,call(fresh,"logical",lease,after));assertEquals(120000L,field(record,"savedCooldownMs"));
            assertEquals(120017L,field(record,"blockedUntilMs"));assertEquals(4L,field(record,"journalRevision"));assertEquals(localProtected(before),localProtected(after));}
            finally{call(record,"close");call(fresh,"release",lease);}}finally{Arrays.fill(before,(byte)0);Arrays.fill(after,(byte)0);}}
    @Test public void localV2LostAckAndForeignFullBytesSealOriginalSharedClock()throws Exception{Object policy=snapshotPolicy(100L);AtomicLong now=new AtomicLong(1000);Object clock=localClock(policy,now::get),lease=localLease(clock,30000);
        byte[] before=localWrapper(2,1,1,0,17,0,null);Object sample=call(clock,"sampleReanchor",lease,before),record=localDecode(before,policy);byte[] after;
        try{after=(byte[])call(type("LocalSnapshotV2"),"reanchor",record);}finally{call(record,"close");}call(clock,"stage",lease,new Object(),before,after,sample,kind("LocalV2ClockAction","reanchor"));
        call(clock,"release",lease);assertTrue((Boolean)field(clock,"invalid"));assertNull(field(clock,"active"));assertNull(field(clock,"pendingReceipt"));denied(()->localLease(clock,30000));
        Object other=localClock(policy,now::get);byte[] known=localCold(other,policy,before);String protectedBytes=localProtected(known),foreignProtected=protectedBytes.replace(repeat('d'),repeat('b'));
        byte[] foreign=new String(known,StandardCharsets.UTF_8).replace(protectedBytes,foreignProtected).replace(sha(protectedBytes.getBytes(StandardCharsets.UTF_8)),sha(foreignProtected.getBytes(StandardCharsets.UTF_8))).getBytes(StandardCharsets.UTF_8);
        Object checked=localDecode(foreign,policy);call(checked,"close");Object original=localLease(other,30000);denied(()->call(other,"inspect",original,foreign));assertTrue((Boolean)field(other,"invalid"));
        call(other,"release",original);denied(()->localLease(other,30000));for(byte[] owned:new byte[][]{before,after,known,foreign})Arrays.fill(owned,(byte)0);}
    @Test public void localV2GlobalBackwardAndSafeIntegerOverflowNeverResetCredit()throws Exception{AtomicLong now=new AtomicLong(1000);Object policy=snapshotPolicy(100L),clock=localClock(policy,now::get);
        byte[] raw=localCold(clock,policy,localWrapper(2,1,1,0,17,0,null));now.set(1100);Object lease=localLease(clock,30000);call(clock,"logical",lease,raw);call(clock,"release",lease);
        now.set(1099);denied(()->localLease(clock,30000));assertTrue((Boolean)field(clock,"invalid"));now.set(2000);denied(()->localLease(clock,30000));
        AtomicLong edge=new AtomicLong(1000);Object full=localClock(policy,edge::get);byte[] maximum=localCold(full,policy,localWrapper(2,1,1,0,9007199254740991L,0,null));
        edge.set(1001);denied(()->localLease(full,30000));assertTrue((Boolean)field(full,"invalid"));Arrays.fill(raw,(byte)0);Arrays.fill(maximum,(byte)0);}
    @Test public void localV2SharedWritersCleanCancelAndOriginalPolicyMutationPreserveClock()throws Exception{activity();Object supplied=snapshotPolicy(100L,250L),clock=localClock(supplied,SystemClock::elapsedRealtime),a=localOwner(clock),b=localOwner(clock);
        Object original=localRequest(a,supplied,5000);byte[] raw=seed();try{call(clock,"sampleSeed",field(original,"processLease"),raw);long origin=(Long)field(clock,"originContinuous");
            ((long[])field(supplied,"delays"))[0]=1;Object retained=field(original,"policy");assertArrayEquals(new long[]{100L,250L},(long[])field(retained,"delays"));
            call(a,"live",original);Object record=localDecode(localWrapper(2,1,1,0,0,0,null),retained),charged=null;byte[] derived=null;
            try{derived=(byte[])call(type("LocalSnapshotV2"),"charge",record,repeat('f'),0L);charged=localDecode(derived,retained);assertEquals(100L,field(charged,"savedCooldownMs"));}
            finally{call(record,"close");if(charged!=null)call(charged,"close");if(derived!=null)Arrays.fill(derived,(byte)0);}
            denied(()->localRequest(b,5000));call(a,"cancel",original);localRetire(a,original);assertFalse((Boolean)field(clock,"invalid"));assertNull(field(clock,"active"));
            Object next=localRequest(b,5000);try{assertEquals(origin,field(clock,"originContinuous"));assertTrue((Boolean)call(clock,"inspect",field(next,"processLease"),raw));
                call(clock,"invalidate",field(original,"processLease"));call(b,"live",next);assertFalse((Boolean)field(clock,"invalid"));}
            finally{localRetire(b,next);}}finally{localRetire(a,original);Arrays.fill(raw,(byte)0);}}
    @Test public void localV2AttachFailureOwnsCleanupUntilActualMainReturn()throws Exception{activity();Object clock=localClock(snapshotPolicy(100L,250L),SystemClock::elapsedRealtime),owner=localOwner(clock);
        AtomicBoolean rejectFirst=new AtomicBoolean(true);android.os.Handler injected=new android.os.Handler(android.os.Looper.getMainLooper()){
            @Override public boolean sendMessageAtTime(android.os.Message message,long uptime){if(rejectFirst.compareAndSet(true,false))return false;return super.sendMessageAtTime(message,uptime);}};
        localSet(owner,"main",injected);CountDownLatch threw=new CountDownLatch(1),release=new CountDownLatch(1),returned=new CountDownLatch(1);
        AtomicReference<Throwable> observed=new AtomicReference<>();Thread cleanupWorker=null;
        assertTrue(new android.os.Handler(android.os.Looper.getMainLooper()).post(()->{
            try{call(owner,"request",activity,snapshotPolicy(100L,250L),5000L);}catch(Throwable failure){observed.set(failure);}
            finally{threw.countDown();try{if(!release.await(5,TimeUnit.SECONDS))throw new AssertionError("bounded attach-failure main hold");}
                catch(InterruptedException failure){Thread.currentThread().interrupt();throw new AssertionError(failure);}finally{returned.countDown();}}}));
        try{assertTrue(threw.await(2,TimeUnit.SECONDS));assertNotNull("original request failed before returning a handle",observed.get());
            Object original=field(owner,"active");assertNotNull(original);Future<?> cleanup=(Future<?>)field(owner,"attachCleanup");cleanupWorker=(Thread)field(owner,"attachCleanupWorker");
            assertNotNull(cleanup);assertNotNull(cleanupWorker);long limit=SystemClock.elapsedRealtime()+2000;boolean held=false;
            while(SystemClock.elapsedRealtime()<limit){synchronized(owner){held=(Boolean)field(original,"retiring")&&(Integer)field(original,"mainCalls")>0;}if(held)break;Thread.sleep(5);}
            assertTrue("owned cleanup waits for actual main",held);assertFalse(cleanup.isDone());assertSame(field(original,"processLease"),field(clock,"active"));
            assertTrue((Boolean)field(clock,"invalid"));release.countDown();assertTrue(returned.await(2,TimeUnit.SECONDS));
            try{cleanup.get(5,TimeUnit.SECONDS);fail("sealed retirement must remain unavailable");}catch(ExecutionException expected){assertNotNull(expected.getCause());}
            cleanupWorker.join(5000);assertFalse(cleanupWorker.isAlive());assertTrue((Boolean)field(original,"retired"));assertTrue((Boolean)field(original,"detached"));
            assertNull(field(owner,"active"));assertNull(field(clock,"active"));assertTrue((Boolean)field(clock,"invalid"));denied(()->localLease(clock,5000));
        }finally{release.countDown();assertTrue(returned.await(5,TimeUnit.SECONDS));if(cleanupWorker!=null){cleanupWorker.join(5000);assertFalse(cleanupWorker.isAlive());}}}
    @Test public void localV2FailedActualCleanupInvalidatesBeforeOriginalLaneRelease()throws Exception{activity();Object clock=localClock(snapshotPolicy(100L,250L),SystemClock::elapsedRealtime),owner=localOwner(clock),original=localRequest(owner,5000);
        android.content.BroadcastReceiver registered=(android.content.BroadcastReceiver)field(original,"screen");InstrumentationRegistry.getInstrumentation().runOnMainSync(()->activity.getApplicationContext().unregisterReceiver(registered));
        localSet(original,"screen",new android.content.BroadcastReceiver(){public void onReceive(android.content.Context context,android.content.Intent intent){}});
        try{denied(()->call(owner,"retire",original));assertTrue((Boolean)field(original,"retired"));assertFalse((Boolean)field(original,"detached"));assertNull(field(owner,"active"));
            assertTrue((Boolean)field(clock,"invalid"));assertNull(field(clock,"active"));assertFalse(((android.os.Handler)field(owner,"main")).hasCallbacks((Runnable)field(original,"expiry")));
            Object nextOwner=localOwner(clock);denied(()->localRequest(nextOwner,5000));}
        finally{android.os.Handler handler=(android.os.Handler)field(owner,"main");Runnable expiry=(Runnable)field(original,"expiry");
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->handler.removeCallbacks(expiry));localRetire(owner,original);}}

    /** New V2 operations source fixtures. Explicit reflection-built synthetic
     * owners below have NO native signature/KDF/write authority. Positive
     * installed owner/keypad/KDF/recipient scenarios remain NOT_RUN. */
    private Object localEnrollmentFixture(Object localOwner,Object original)throws Exception{
        byte[] seedBytes=seed();Object sample=create("LocalV2EnrollmentSample",localOwner,original,seedBytes);localSet(original,"enrollmentSample",sample);
        Object operation=create("LocalV2PinOperation",localOwner,original,kind("LocalV2PinKind","enroll"),null,new Object(),repeat('f'),"enroll-local-pin",sha(seedBytes),0L,"en",600000L,seedBytes,sample);
        localSet(original,"pinOperation",operation);return operation;
    }
    @Test public void localV2RawEnrollmentCannotUseEvenOriginalSampleWithoutNativeOwnerKdf()throws Exception{
        activity();Object localOwner=localOwner(),original=localRequest(localOwner,5000);byte[] seedBytes=seed();Object sample=create("LocalV2EnrollmentSample",localOwner,original,seedBytes);localSet(original,"enrollmentSample",sample);
        Object next=localDecode(localWrapper(2,1,1,0,(Long)field(sample,"logicalMs"),0,null),snapshotPolicy(100L,250L));boolean footprint=childFootprint();
        try{byte[] candidate=(byte[])call(next,"copy");try{denied(()->call(localOwner,"enroll",original,sample,candidate));assertFalse((Boolean)field(sample,"consumed"));assertFalse((Boolean)field(original,"mutationStarted"));assertEquals(footprint,childFootprint());}
            finally{Arrays.fill(candidate,(byte)0);}}finally{call(next,"close");localRetire(localOwner,original);Arrays.fill(seedBytes,(byte)0);}}
    @Test public void localV2RawChargeCannotMutateFromAnchoredBooleanOrP1Receipt()throws Exception{
        activity();Object localOwner=localOwner(),original=localRequest(localOwner,5000);byte[] raw=localWrapper(2,1,1,0,17,0,null);localSet(original,"anchored",true);localSet(original,"currentBytes",raw);localSet(original,"currentChecksum",sha(raw));boolean footprint=childFootprint();
        try{denied(()->call(localOwner,"charge",original));assertFalse((Boolean)field(original,"charged"));assertFalse((Boolean)field(original,"mutationStarted"));assertNull(field(original,"reservation"));assertEquals(footprint,childFootprint());}
        finally{localRetire(localOwner,original);Arrays.fill(raw,(byte)0);}}
    @Test public void localV2SyntheticOutcomeFlagsCannotAuthorizeEnrollmentMutation()throws Exception{
        activity();Object localOwner=localOwner(),original=localRequest(localOwner,5000),operation=localEnrollmentFixture(localOwner,original),sample=field(operation,"enrollment");
        byte[] candidate=localWrapper(2,1,1,0,(Long)field(sample,"logicalMs"),0,null);boolean footprint=childFootprint();
        try{localSet(operation,"started",true);localSet(operation,"worker",Thread.currentThread());localSet(operation,"phase",kind("LocalV2PinPhase","finalizing"));localSet(operation,"uiJoined",true);
            localSet(operation,"ownerConsumed",true);localSet(operation,"platformEnrolled",true);localSet(operation,"enrollmentCandidate",candidate);localSet(operation,"ownerNextChecksum",sha(candidate));
            denied(()->call(localOwner,"enroll",original,sample,candidate));assertFalse((Boolean)field(sample,"consumed"));assertFalse((Boolean)field(original,"mutationStarted"));assertEquals(footprint,childFootprint());
        }finally{localSet(operation,"worker",null);localSet(operation,"finished",true);localRetire(localOwner,original);Arrays.fill(candidate,(byte)0);}}
    @Test public void localV2CanonicalAdultSnapshotCannotMasqueradeAsOriginalChildGate()throws Exception{
        activity();Object localOwner=localOwner(),original=localRequest(localOwner,5000),context=create("PinGateContext","profile-fixture",VERSION,1L,1L,"child","active");
        Object gate=create("PinGateRequest",new Object(),repeat('f'),"exit-child-mode",repeat('b'),context,0L,field(original,"deadline"));byte[] bytes=localWrapper(2,1,1,0,17,0,null);
        try{denied(()->create("LocalV2PinOperation",localOwner,original,kind("LocalV2PinKind","verify"),gate,field(gate,"originalHostChallenge"),repeat('f'),"exit-child-mode",repeat('b'),0L,"en",600000L,bytes,null));
            assertNull(field(original,"pinOperation"));assertFalse((Boolean)field(original,"mutationStarted"));}
        finally{localRetire(localOwner,original);Arrays.fill(bytes,(byte)0);}}
    @Test public void localV2OriginalOwnerTargetLocaleAndIterationSubstitutionAreRefused()throws Exception{
        activity();Object localOwner=localOwner(),original=localRequest(localOwner,5000);byte[] bytes=seed();Object sample=create("LocalV2EnrollmentSample",localOwner,original,bytes);localSet(original,"enrollmentSample",sample);
        try{for(String locale:new String[]{"ru-RU","fr"})denied(()->create("LocalV2PinOperation",localOwner,original,kind("LocalV2PinKind","enroll"),null,new Object(),repeat('f'),"enroll-local-pin",sha(bytes),0L,locale,600000L,bytes,sample));
            denied(()->create("LocalV2PinOperation",localOwner,original,kind("LocalV2PinKind","enroll"),null,new Object(),repeat('f'),"enroll-local-pin",repeat('b'),0L,"en",600000L,bytes,sample));
            denied(()->create("LocalV2PinOperation",localOwner,original,kind("LocalV2PinKind","enroll"),null,new Object(),repeat('f'),"enroll-local-pin",sha(bytes),0L,"en",599999L,bytes,sample));assertFalse((Boolean)field(original,"mutationStarted"));}
        finally{localRetire(localOwner,original);Arrays.fill(bytes,(byte)0);}}
    @Test public void localV2RetirementJoinsActualPinWorkerAfterCounterDrain()throws Exception{
        activity();Object localOwner=localOwner(),original=localRequest(localOwner,5000),operation=localEnrollmentFixture(localOwner,original);
        CountDownLatch first=new CountDownLatch(1),drain=new CountDownLatch(1),returnWorker=new CountDownLatch(1);AtomicReference<Throwable> error=new AtomicReference<>();
        Thread actual=new Thread(()->{first.countDown();try{assertTrue(drain.await(5,TimeUnit.SECONDS));synchronized(localOwner){try{localSet(original,"pinWorkers",0);}catch(Exception failure){throw new RuntimeException(failure);}localOwner.notifyAll();}
                assertTrue(returnWorker.await(5,TimeUnit.SECONDS));}catch(Throwable failure){error.set(failure);}},"explicit-synthetic-held-v2-pin-worker");
        localSet(original,"pinWorkers",1);localSet(operation,"worker",actual);localSet(operation,"started",true);actual.start();assertTrue(first.await(5,TimeUnit.SECONDS));ExecutorService retiring=Executors.newSingleThreadExecutor();Future<?> closed=null;
        try{closed=retiring.submit(()->{try{call(localOwner,"retire",original);}catch(Exception failure){throw new RuntimeException(failure);}});long limit=SystemClock.elapsedRealtime()+2000;
            while(!(Boolean)field(original,"retiring")&&SystemClock.elapsedRealtime()<limit)Thread.sleep(5);assertTrue((Boolean)field(original,"retiring"));assertFalse(closed.isDone());drain.countDown();
            limit=SystemClock.elapsedRealtime()+2000;while((Integer)field(original,"pinWorkers")!=0&&SystemClock.elapsedRealtime()<limit)Thread.sleep(5);assertEquals(0,field(original,"pinWorkers"));
            assertFalse("counter drain cannot fake actual worker return",closed.isDone());assertSame(field(original,"processLease"),field(field(original,"processClock"),"active"));returnWorker.countDown();closed.get(5,TimeUnit.SECONDS);
            assertTrue((Boolean)field(original,"retired"));assertFalse(actual.isAlive());assertNull(field(field(original,"processClock"),"active"));assertNull(error.get());
        }finally{drain.countDown();returnWorker.countDown();actual.join(6000);try{if(closed!=null)closed.get(10,TimeUnit.SECONDS);else localRetire(localOwner,original);}finally{retiring.shutdown();}}}
    @Test public void localV2StaleNativeOperationCannotTouchFreshLeaseAfterRetirement()throws Exception{
        activity();Object localOwner=localOwner(),original=localRequest(localOwner,5000),operation=localEnrollmentFixture(localOwner,original);localSet(operation,"finished",true);localRetire(localOwner,original);
        Object fresh=localRequest(localOwner,5000);try{denied(()->call(operation,"live"));call(operation,"inputCancel");assertSame(fresh,field(localOwner,"active"));assertFalse((Boolean)field(fresh,"cancelled"));assertFalse((Boolean)field(field(fresh,"processClock"),"invalid"));}
        finally{localRetire(localOwner,fresh);}}
    @Test public void localV2OwnedPromptPauseIsNarrowAndActualBackgroundStillLatches()throws Exception{
        activity();Object localOwner=localOwner(),original=localRequest(localOwner,5000),operation=localEnrollmentFixture(localOwner,original);java.security.Signature signing=java.security.Signature.getInstance("SHA256withECDSA");
        // Explicit synthetic UI ownership coordinates ONLY; software Signature
        // and flags cannot authorize a write or replace AndroidKeyStore proof.
        localSet(operation,"phase",kind("LocalV2PinPhase","owner"));localSet(operation,"promptOutstanding",true);localSet(operation,"signing",signing);
        localSet(operation,"crypto",new android.hardware.biometrics.BiometricPrompt.CryptoObject(signing));localSet(operation,"signal",new android.os.CancellationSignal());
        try{call(localOwner,"paused",original);assertFalse((Boolean)field(original,"cancelled"));assertFalse((Boolean)field(original,"mutationStarted"));
            localSet(operation,"crypto",new android.hardware.biometrics.BiometricPrompt.CryptoObject(java.security.Signature.getInstance("SHA256withECDSA")));
            assertFalse((Boolean)call(operation,"ownedOwnerPause"));localSet(operation,"crypto",new android.hardware.biometrics.BiometricPrompt.CryptoObject(signing));
            scenario.moveToState(Lifecycle.State.CREATED);assertTrue((Boolean)field(original,"cancelled"));scenario.moveToState(Lifecycle.State.RESUMED);denied(()->call(operation,"live"));
            assertFalse((Boolean)field(original,"mutationStarted"));
        }finally{localSet(operation,"promptOutstanding",false);localSet(operation,"finished",true);call(operation,"joinCancel");localRetire(localOwner,original);}}

    @Test public void localV2ClosedResultLatchesBackgroundUntilActualObserverCleanup()throws Exception{
        activity();Object localOwner=localOwner(),original=localRequest(localOwner,5000),operation=localEnrollmentFixture(localOwner,original);
        try{call(operation,"closedObservers",true);assertFalse((Boolean)field(operation,"closedRevoked"));
            localSet(operation,"finished",true);localRetire(localOwner,original);scenario.moveToState(Lifecycle.State.CREATED);
            assertTrue((Boolean)field(operation,"closedRevoked"));scenario.moveToState(Lifecycle.State.RESUMED);denied(()->call(operation,"closedHost"));
        }finally{call(operation,"closedObservers",false);localSet(operation,"finished",true);localRetire(localOwner,original);}
        assertNull(field(operation,"closedLifecycle"));assertNull(field(operation,"closedScreen"));assertNull(field(operation,"closedExpiry"));
    }

    /** New private Gate boundary mechanics; no automatic PIN/owner input or
     * installed storage/child admission is implied by these fixtures. */
    private static byte[] gateRecord(long profileRevision,long selection,String locale)throws Exception{
        byte[] base=localWrapper(2,1,1,0,0,0,null);String raw=new String(base,StandardCharsets.UTF_8),before=localProtected(base);
        String oldRegistry="{\"schemaVersion\":1,\"policyVersion\":\""+VERSION+"\",\"activeProfileId\":null,\"profiles\":[]}";
        String registry="{\"schemaVersion\":1,\"policyVersion\":\""+VERSION+"\",\"activeProfileId\":\"reader\",\"profiles\":[{\"id\":\"reader\",\"label\":\"Native Reader\",\"exactAge\":9,\"ageBand\":\"9-11\",\"locale\":\""+locale
            +"\",\"ageConfirmedAt\":\"2026-10-01T12:00:00.000Z\",\"readingLevel\":null,\"allowedTopics\":null,\"blockedTopics\":[],\"soundEnabled\":false,\"motion\":\"calm\",\"narrationEnabled\":false}]}";
        String after=before.replace("\"mode\":\"adult\"","\"mode\":\"child\"").replace("\"profileRevision\":1","\"profileRevision\":"+profileRevision)
            .replace("\"selectionRevision\":1","\"selectionRevision\":"+selection).replace(oldRegistry,registry)
            .replace(sha(oldRegistry.getBytes(StandardCharsets.UTF_8)),sha(registry.getBytes(StandardCharsets.UTF_8)));
        Arrays.fill(base,(byte)0);return raw.replace(before,after).replace(sha(before.getBytes(StandardCharsets.UTF_8)),sha(after.getBytes(StandardCharsets.UTF_8))).getBytes(StandardCharsets.UTF_8);
    }
    private static Object gateScope(byte[] bytes)throws Exception{Object record=localDecode(bytes,snapshotPolicy(100L,250L));try{return create("LocalV2GateScope",record);}finally{call(record,"close");}}
    @Test public void localV2GateCanonicalSelectedProfileLocaleAndRevisionsComeFromRecord()throws Exception{
        byte[] bytes=gateRecord(4,7,"ru");try{Object scope=gateScope(bytes),context=field(scope,"context");assertEquals("reader",field(context,"profileId"));
            assertEquals(VERSION,field(context,"policyVersion"));assertEquals(4L,field(context,"profileRevision"));assertEquals(7L,field(context,"routeRevision"));
            assertEquals("ru",field(scope,"locale"));assertEquals(2L,field(scope,"rootRevision"));Object adult=localDecode(localWrapper(2,1,1,0,0,0,null),snapshotPolicy(100L));
            try{denied(()->create("LocalV2GateScope",adult));}finally{call(adult,"close");}}finally{Arrays.fill(bytes,(byte)0);}}
    @Test public void localV2GateCapturedContextRejectsProfileRouteAndSelectedRegistrySubstitution()throws Exception{
        Object scope=gateScope(gateRecord(2,3,"en"));for(byte[] bytes:new byte[][]{gateRecord(3,3,"en"),gateRecord(2,4,"en"),gateRecord(2,3,"ru")}){
            Object current=localDecode(bytes,snapshotPolicy(100L,250L));try{denied(()->call(scope,"same",current));}finally{call(current,"close");Arrays.fill(bytes,(byte)0);}}}
    @Test public void localV2GateTargetIsOwnedAndOriginalChallengeCannotBeReconstructed()throws Exception{
        byte[] caller={1,2,3};Object invocation=create("LocalV2GateInvocation","share",caller,4L,100L,5000L,3000L);String checksum=sha(caller);Arrays.fill(caller,(byte)9);
        Object original=call(invocation,"capture",gateScope(gateRecord(2,3,"en")),101L);assertEquals(checksum,field(original,"targetChecksum"));
        assertSame(invocation,field(original,"originalHostChallenge"));assertEquals(3100L,field(original,"deadlineUptimeMs"));
        denied(()->call(invocation,"capture",gateScope(gateRecord(2,3,"en")),102L));call(invocation,"close");assertTrue(zero((byte[])field(invocation,"target")));}
    @Test public void localV2GateExclusiveDeadlineAndRevocationStaySpentAfterTimeReturns()throws Exception{
        Object invocation=create("LocalV2GateInvocation","diagnostics",new byte[0],1L,100L,100L,200L);call(invocation,"live",199L);
        denied(()->call(invocation,"live",200L));denied(()->call(invocation,"live",101L));Object next=create("LocalV2GateInvocation","diagnostics",new byte[0],2L,100L,100L,200L);
        call(next,"revoke");denied(()->call(next,"live",101L));denied(()->create("LocalV2GateInvocation","share",new byte[0],1L,9007199254740990L,2L,2L));}
    @Test public void localV2GateNullOrBooleanProofCannotTransferAndFailedAttemptIsOneUse()throws Exception{
        Object invocation=create("LocalV2GateInvocation","share",new byte[]{1},1L,100L,1000L,1000L);call(invocation,"capture",gateScope(gateRecord(2,3,"en")),101L);
        denied(()->call(invocation,"transfer",null,102L));assertTrue((Boolean)field(invocation,"spent"));denied(()->call(invocation,"transfer",Boolean.TRUE,103L));
        denied(()->call(invocation,"live",103L));call(invocation,"close");}
    private Object actualGateHost(AtomicInteger callbacks)throws Exception{
        AtomicReference<Object> result=new AtomicReference<>();AtomicReference<Exception> failure=new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{android.widget.LinearLayout root=new android.widget.LinearLayout(activity);
            android.widget.Button button=new android.widget.Button(activity);button.setText("Private native Gate fixture");root.addView(button);activity.setContentView(root);
            Class<?> actionType=type("LocalV2NativeProtectedAction");Object nativeAction=Proxy.newProxyInstance(actionType.getClassLoader(),new Class<?>[]{actionType},(proxy,method,args)->{callbacks.incrementAndGet();return null;});
            result.set(create("LocalV2GateHost",new PlanetChildVault(activity.getApplicationContext()),activity,root,button,snapshotPolicy(100L,250L),"share",new byte[]{1},5000L,3000L,nativeAction));
        }catch(Exception error){failure.set(error);}});if(failure.get()!=null)throw failure.get();return result.get();}
    private void closeGate(Object host)throws Exception{AtomicReference<Exception> failure=new AtomicReference<>();InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
        try{call(host,"close");}catch(Exception error){failure.set(error);}});if(failure.get()!=null)throw failure.get();}
    @Test public void localV2GateActualOwnedBackDispatcherRevokesWithoutDeliveringAction()throws Exception{activity();AtomicInteger calls=new AtomicInteger();Object host=actualGateHost(calls);
        try{InstrumentationRegistry.getInstrumentation().runOnMainSync(()->activity.getOnBackPressedDispatcher().onBackPressed());assertTrue((Boolean)field(host,"revoked"));assertEquals(0,calls.get());}
        finally{closeGate(host);}}
    @Test public void localV2GateActualNativeRouteRootReplacementRevokesOriginalControl()throws Exception{activity();AtomicInteger calls=new AtomicInteger();Object host=actualGateHost(calls);
        try{InstrumentationRegistry.getInstrumentation().runOnMainSync(()->activity.setContentView(new android.widget.LinearLayout(activity)));
            assertTrue((Boolean)field(host,"revoked"));assertEquals(0,calls.get());}finally{closeGate(host);}}
    @Test public void localV2GateActualBackgroundCannotReviveOriginalNativeControl()throws Exception{activity();AtomicInteger calls=new AtomicInteger();Object host=actualGateHost(calls);
        try{scenario.moveToState(Lifecycle.State.CREATED);scenario.moveToState(Lifecycle.State.RESUMED);assertTrue((Boolean)field(host,"revoked"));assertEquals(0,calls.get());}
        finally{closeGate(host);}}

    @Test public void localV2GateReentryKeepsOriginalControlUntilOwnedWorkerReturns()throws Exception{
        activity();AtomicInteger calls=new AtomicInteger();Object host=actualGateHost(calls);CountDownLatch released=new CountDownLatch(1),started=new CountDownLatch(1);
        Thread held=new Thread(()->{started.countDown();try{released.await();}catch(InterruptedException failure){Thread.currentThread().interrupt();}},"explicit-synthetic-owned-gate-worker");
        held.start();assertTrue(started.await(5,TimeUnit.SECONDS));localSet(host,"worker",held);
        try{InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{call(host,"begin");}catch(Exception failure){throw new RuntimeException(failure);}});
            assertTrue((Boolean)field(host,"revoked"));assertFalse((Boolean)field(host,"closed"));assertNotNull(field(host,"lifecycle"));
            assertTrue(((android.widget.Button)field(host,"control")).hasOnClickListeners());assertEquals(0,calls.get());
        }finally{released.countDown();held.join(6000);assertFalse(held.isAlive());localSet(host,"worker",null);closeGate(host);}
        assertTrue((Boolean)field(host,"closed"));assertNull(field(host,"lifecycle"));
    }

    private static byte[] firstProfile(String locale){return ("{\"id\":\"reader\",\"label\":\"Native Reader\",\"exactAge\":9,\"ageBand\":\"9-11\",\"locale\":\""+locale
        +"\",\"ageConfirmedAt\":\"2026-10-01T12:00:00.000Z\",\"readingLevel\":null,\"allowedTopics\":[\"nature\"],\"blockedTopics\":[\"horror\"],\"soundEnabled\":false,\"motion\":\"calm\",\"narrationEnabled\":false,\"localeLocked\":true}").getBytes(StandardCharsets.UTF_8);}
    @Test public void localV2FirstProfilePreservesOriginalVerifierPendingCountWholeDebtAndClock()throws Exception{
        Object policy=snapshotPolicy(100L,250L),old=localDecode(localWrapper(5,4,4,2,17,250,repeat('f')),policy);byte[] before=(byte[])call(old,"copy"),next=null;
        try{next=(byte[])call(type("LocalV2InitialProfile"),"create",old,firstProfile("ru"));Object after=localDecode(next,policy);
            try{call(type("LocalV2InitialProfile"),"validate",old,after);String a=localProtected(before),b=localProtected(next);assertEquals(a.substring(a.indexOf(",\"pin\":")),b.substring(b.indexOf(",\"pin\":")));
                assertEquals(6L,field(after,"revision"));assertEquals(4L,field(after,"pinRevision"));assertEquals(5L,field(after,"journalRevision"));assertEquals(2L,field(after,"count"));
                assertEquals(250L,field(after,"savedCooldownMs"));assertEquals(17L,field(after,"lastObservedMs"));assertEquals(repeat('f'),field(after,"pendingAttemptId"));
                Object scope=create("LocalV2GateScope",after);assertEquals("reader",field(field(scope,"context"),"profileId"));assertEquals("ru",field(scope,"locale"));
            }finally{call(after,"close");}
        }finally{call(old,"close");Arrays.fill(before,(byte)0);if(next!=null)Arrays.fill(next,(byte)0);}}
    @Test public void localV2FirstProfileRejectsUnenrolledSeedAndExistingRegistry()throws Exception{
        Object policy=snapshotPolicy(100L,250L);denied(()->localDecode(seed(),policy));Object already=localDecode(gateRecord(2,2,"en"),policy);
        try{denied(()->call(type("LocalV2InitialProfile"),"create",already,firstProfile("en")));}finally{call(already,"close");}}
    @Test public void localV2FirstProfileRejectsMismatchedAgeUnknownDuplicateAndInvalidUtf8()throws Exception{
        String profile=new String(firstProfile("en"),StandardCharsets.UTF_8);
        for(String wrong:new String[]{profile.replace("\"9-11\"","\"6-8\""),profile.replace("\"locale\":\"en\"","\"locale\":\"de\""),profile.replace("\"label\":","\"extra\":true,\"label\":"),profile.replace("\"exactAge\":9","\"exactAge\":9,\"exactAge\":9")})
            denied(()->call(type("LocalV2InitialProfile"),"profileId",wrong.getBytes(StandardCharsets.UTF_8)));
        denied(()->call(type("LocalV2InitialProfile"),"profileId",new byte[]{(byte)0xc3,0x28}));}
    @Test public void localV2FirstProfileRejectsRevisionOverflowAndRefundedValidSnapshot()throws Exception{
        Object policy=snapshotPolicy(100L,250L),edge=localDecode(localWrapper(9007199254740991L,1,1,0,0,0,null),policy),old=localDecode(localWrapper(5,4,4,2,17,250,repeat('f')),policy);
        try{denied(()->call(type("LocalV2InitialProfile"),"create",edge,firstProfile("en")));byte[] valid=(byte[])call(type("LocalV2InitialProfile"),"create",old,firstProfile("en"));Object after=localDecode(valid,policy),refund=null;
            try{byte[] lowered=(byte[])call(type("LocalSnapshotV2"),"attempt",after,0L,null,17L);try{refund=localDecode(lowered,policy);Object substituted=refund;
                denied(()->call(type("LocalV2InitialProfile"),"validate",old,substituted));assertEquals(2L,field(old,"count"));assertEquals(250L,field(old,"savedCooldownMs"));}finally{Arrays.fill(lowered,(byte)0);}}
            finally{call(after,"close");if(refund!=null)call(refund,"close");Arrays.fill(valid,(byte)0);}
        }finally{call(edge,"close");call(old,"close");}}
    @Test public void localV2FirstProfileClockPublicationRetainsOriginalContinuousOriginAndPendingAck()throws Exception{
        Object policy=snapshotPolicy(100L,250L);AtomicLong now=new AtomicLong(1000);Object clock=localClock(policy,now::get);
        byte[] before=localCold(clock,policy,localWrapper(5,4,4,2,17,250,repeat('f'))),next=null;Object lease=localLease(clock,30000),old=localDecode(before,policy);
        try{now.set(1070);Object sample=call(clock,"sample",lease,before),receipt=new Object();long origin=(Long)field(clock,"originContinuous");next=(byte[])call(type("LocalV2InitialProfile"),"create",old,firstProfile("en"));
            call(clock,"stage",lease,receipt,before,next,sample,kind("LocalV2ClockAction","profile"));assertEquals(origin,field(clock,"originContinuous"));assertSame(receipt,field(clock,"pendingReceipt"));
            byte[] selected=next;denied(()->call(clock,"acknowledge",lease,new Object(),selected));call(clock,"acknowledge",lease,receipt,next);assertNull(field(clock,"pendingReceipt"));assertEquals(origin,field(clock,"originContinuous"));
            assertEquals(87L,call(clock,"logical",lease,next));
        }finally{call(old,"close");call(clock,"release",lease);Arrays.fill(before,(byte)0);if(next!=null)Arrays.fill(next,(byte)0);}}
}
