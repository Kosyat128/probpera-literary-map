package ru.probpera.literaryplanet;

import android.app.Dialog;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.concurrent.locks.ReentrantLock;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** New Android verification keypad instrumentation source, authored NOT_RUN.
 * Real Dialog/Activity callbacks require an eligible owned Android target.
 * Reflection constructs explicitly synthetic IO/checkpoint/action authority
 * and KDF. No vault, genuine provider, device performance proof, bridge,
 * factory activation or Parent Gate admission is supplied by this fixture.
 * Public constant keypad digits are used only inside native owned buffers.
 * Compilation/device execution is performed only by root when eligible. */
@RunWith(AndroidJUnit4.class)
public final class PlanetChildNativePinVerificationInputRuntimeTest {
    private ActivityScenario<MainActivity> scenario;private MainActivity activity;private Fixture fixture;
    private static final String VERSION="synthetic-verification-input-v1",BOOT="00000000-0000-4000-8000-000000000001";
    private interface Checked {void run() throws Exception;}
    @Before public void activity() throws Exception {android.os.Bundle args=InstrumentationRegistry.getArguments();
        String runId=args.getString("literaryRunId");assertTrue("owned explicit run metadata",runId!=null&&runId.matches("[a-f0-9]{32}"));
        assertEquals("input",args.getString("literaryPinVerificationInputPhase"));
        scenario=ActivityScenario.launch(MainActivity.class);scenario.onActivity(a->activity=a);
        long end=SystemClock.elapsedRealtime()+5000;while(!activity.hasWindowFocus()&&SystemClock.elapsedRealtime()<end)Thread.sleep(20);assertTrue(activity.hasWindowFocus());}
    @After public void cleanup() throws Exception {if(fixture!=null)fixture.close();if(scenario!=null)scenario.close();}
    private static Class<?> nested(String name)throws Exception{return Class.forName("ru.probpera.literaryplanet.PlanetChildVault$"+name);}
    private static Object field(Object owner,String name)throws Exception{Field f=owner.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(owner);}
    private static Exception cause(InvocationTargetException e){Throwable t=e.getCause();if(t instanceof Error)throw(Error)t;return t instanceof Exception?(Exception)t:new Exception(t);}
    private static Object create(String name,Object...args)throws Exception {for(Constructor<?> c:nested(name).getDeclaredConstructors())if(c.getParameterCount()==args.length){c.setAccessible(true);
            try{return c.newInstance(args);}catch(InvocationTargetException e){throw cause(e);}}throw new AssertionError("private constructor "+name);}
    private static Object invoke(Object owner,String name,Object...args)throws Exception {Class<?> type=owner instanceof Class<?>?(Class<?>)owner:owner.getClass();
        for(Method m:type.getDeclaredMethods())if(m.getName().equals(name)&&m.getParameterCount()==args.length){m.setAccessible(true);
            try{return m.invoke(owner instanceof Class<?>?null:owner,args);}catch(InvocationTargetException e){throw cause(e);}}throw new AssertionError("private method "+name);}
    @SuppressWarnings({"unchecked","rawtypes"}) private static Object kind(String name)throws Exception{return Enum.valueOf((Class)nested("PinVerificationDelivery"),name);}
    private static Object proxy(String name,InvocationHandler body)throws Exception{return Proxy.newProxyInstance(nested(name).getClassLoader(),new Class<?>[]{nested(name)},body);}
    private static void denied(Checked body)throws Exception{try{body.run();fail("expected private refusal");}catch(Exception expected){}}
    private static boolean zero(byte[] bytes){for(byte b:bytes)if(b!=0)return false;return true;}
    private static String repeated(char c){char[] x=new char[64];Arrays.fill(x,c);return new String(x);}
    private static String sha(byte[] bytes)throws Exception{byte[] hash=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder result=new StringBuilder();
        try{for(byte b:hash)result.append(String.format(Locale.ROOT,"%02x",b&255));return result.toString();}finally{Arrays.fill(hash,(byte)0);}}
    private static void main(Checked body){InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{body.run();}catch(Exception e){throw new AssertionError(e);}});}
    private static void noEdit(View view){assertFalse(view instanceof EditText);if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;
            for(int i=0;i<group.getChildCount();i++)noEdit(group.getChildAt(i));}}
    private static byte[] record(long anchor)throws Exception {String registry="{\"schemaVersion\":1,\"policyVersion\":\""+VERSION+"\",\"activeProfileId\":\"synthetic-child\",\"profiles\":[{"
        +"\"id\":\"synthetic-child\",\"label\":\"Ребёнок\",\"exactAge\":9,\"ageBand\":\"9-11\",\"locale\":\"ru\",\"ageConfirmedAt\":\"2026-10-01T12:00:00.000Z\","
        +"\"readingLevel\":null,\"allowedTopics\":null,\"blockedTopics\":[\"violence\"],\"soundEnabled\":false,\"motion\":\"calm\",\"narrationEnabled\":false}]}";
        byte[] bytes=registry.getBytes(StandardCharsets.UTF_8);String digest;try{digest=sha(bytes);}finally{Arrays.fill(bytes,(byte)0);}return ("{\"schemaVersion\":1,\"revision\":7,\"mode\":\"child\","
        +"\"selectionRevision\":3,\"profileRevision\":2,\"policyChecksum\":\""+repeated('a')+"\",\"registryChecksum\":\""+digest+"\",\"registry\":"+registry+",\"pin\":{\"schemaVersion\":1,"
        +"\"policyVersion\":\""+VERSION+"\",\"revision\":5,\"credentialId\":\""+repeated('b')+"\",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":600000,"
        +"\"saltHex\":\""+repeated('c')+"\",\"hashHex\":\""+repeated('d')+"\"},\"attempts\":{\"count\":0,\"blockedUntilMs\":0,\"lastObservedMs\":1000,\"pendingAttemptId\":null}},"
        +"\"clock\":{\"schemaVersion\":1,\"bootId\":\""+BOOT+"\",\"uptimeAnchorMs\":"+anchor+",\"logicalAnchorMs\":1000,\"epochAnchor\":null}}").getBytes(StandardCharsets.UTF_8);}
    private final class Fixture implements AutoCloseable {
        final long anchor=SystemClock.elapsedRealtime();final ReentrantLock ioLock=new ReentrantLock();final Object core,gate,owned,request,input;
        final AtomicInteger writes=new AtomicInteger(),derives=new AtomicInteger(),cancels=new AtomicInteger(),completionCalls=new AtomicInteger();
        final AtomicReference<Object> result=new AtomicReference<>(),terminal=new AtomicReference<>();final AtomicReference<Throwable> retirementError=new AtomicReference<>(),asyncFailure=new AtomicReference<>();
        final List<byte[]> callbackCopies=Collections.synchronizedList(new ArrayList<>());
        final CountDownLatch currentEntered=new CountDownLatch(1),releaseCurrent=new CountDownLatch(1),deriveEntered=new CountDownLatch(1),releaseDerive=new CountDownLatch(1);
        final CountDownLatch completionEntered=new CountDownLatch(1),releaseCompletion=new CountDownLatch(1),retirementDone=new CountDownLatch(1);
        final CountDownLatch mainBlocked=new CountDownLatch(1),releaseMain=new CountDownLatch(1);
        volatile boolean blockCurrent,blockDerive,throwCompletion,blockCompletion,denyEarlySettlement,failDeliveryCurrent;
        volatile byte[] borrowedPin;byte[] stored=record(anchor);String checkpoint=sha(stored);long revision=7;
        Fixture(String locale)throws Exception{this(locale,"exit-child-mode",60000);}
        Fixture(String locale,String action,long timeout)throws Exception {
            Object policy=create("PinVerificationPolicy",VERSION,repeated('a'),600000L,new long[]{10,100,1000});
            gate=create("PinGateRequest",new Object(),repeated('7'),action,repeated('f'),create("PinGateContext","synthetic-child",VERSION,2L,7L,"child","active"),3L,anchor+timeout);
            Object authority=fixtureProxy("PinVerificationAuthority",(self,m,args)->{assertNotSame("authority IO never runs on main",Looper.getMainLooper(),Looper.myLooper());
                switch(m.getName()){case "capture":assertSame(gate,args[0]);return point(self,(String)args[2],(Long)args[3]);
                    case "current":byte[] copy=(byte[])args[1];callbackCopies.add(copy);assertEquals(checkpoint,args[2]);assertEquals(checkpoint,sha(copy));assertEquals(revision,args[3]);
                        if(failDeliveryCurrent&&writes.get()==2&&field(field(args[0],"ticket"),"phase").toString().equals("finalized"))throw new Exception("synthetic final delivery fence refused");
                        if(blockCurrent){currentEntered.countDown();assertTrue(releaseCurrent.await(6,TimeUnit.SECONDS));}return point(self,(String)args[2],(Long)args[3]);
                    case "authorizeTransition":callbackCopies.add((byte[])args[2]);callbackCopies.add((byte[])args[3]);return new Object();
                    case "advance":checkpoint=(String)args[3];revision=(Long)args[4];return null;
                    case "cancel":assertSame(gate,args[0]);cancels.incrementAndGet();return null;
                    case "retire":assertSame(gate,args[0]);return null;default:throw new AssertionError(m);}});
            Object transaction=fixtureProxy("PinSessionTransaction",(self,m,args)->{if(m.getName().equals("read"))return stored.clone();
                if(m.getName().equals("write")){assertEquals(checkpoint,sha((byte[])args[0]));invoke(args[1],"check");Arrays.fill(stored,(byte)0);stored=((byte[])args[0]).clone();writes.incrementAndGet();invoke(args[1],"check");return null;}
                throw new AssertionError(m);});
            Object io=fixtureProxy("PinSessionIO",(self,m,args)->{assertNotSame(Looper.getMainLooper(),Looper.myLooper());ioLock.lock();try{return invoke(args[0],"run",transaction);}finally{ioLock.unlock();}});
            Object engine=fixtureProxy("PinVerificationEngine",(self,m,args)->{assertNotSame(Looper.getMainLooper(),Looper.myLooper());assertEquals(1,writes.get());derives.incrementAndGet();borrowedPin=(byte[])args[0];
                if(blockDerive){deriveEntered.countDown();assertTrue(releaseDerive.await(6,TimeUnit.SECONDS));}Arrays.fill((byte[])args[3],(byte)0xdd);invoke(args[4],"check");return null;});
            core=invoke(nested("NativePinVerification"),"syntheticFixture",io,authority,policy,engine);owned=invoke(core,"begin",gate);
            request=create("PinVerificationNativeInputRequest",owned,locale);
            Object completed=fixtureProxy("PinVerificationNativeInputCompletion",(self,m,args)->{assertNotSame(Looper.getMainLooper(),Looper.myLooper());completionCalls.incrementAndGet();result.set(args[0]);completionEntered.countDown();
                if(denyEarlySettlement&&args[0]!=null)denied(()->invoke(core,"settleReply",args[0],kind("known")));
                if(blockCompletion)assertTrue(releaseCompletion.await(6,TimeUnit.SECONDS));if(throwCompletion)throw new Exception("synthetic lost recipient");return null;});
            input=create("PinVerificationNativeInput",request,activity,completed);
        }
        Object fixtureProxy(String name,InvocationHandler body)throws Exception{return proxy(name,(self,m,args)->{try{return body.invoke(self,m,args);}catch(Error failure){asyncFailure.compareAndSet(null,failure);throw failure;}});}
        Object point(Object owner,String hash,long root)throws Exception{long now=SystemClock.elapsedRealtime();return create("PinVerificationCoordinates",owner,repeated('e'),BOOT,hash,root,11L,now,1000+now-anchor);}
        Dialog dialog()throws Exception{return(Dialog)field(input,"dialog");}
        Button key(View view,String publicLabel){if(view instanceof Button&&publicLabel.contentEquals(((Button)view).getText()))return(Button)view;
            if(view instanceof ViewGroup){ViewGroup g=(ViewGroup)view;for(int i=0;i<g.getChildCount();i++){Button found=key(g.getChildAt(i),publicLabel);if(found!=null)return found;}}return null;}
        void shown()throws Exception {long end=SystemClock.elapsedRealtime()+5000;while(SystemClock.elapsedRealtime()<end){AtomicBoolean visible=new AtomicBoolean();main(()->{Dialog d=dialog();visible.set(d!=null&&d.isShowing()&&d.getWindow().getDecorView().hasWindowFocus());});
                if(visible.get())return;Thread.sleep(20);}fail("real owned Dialog focus");}
        void press(int amount,boolean submit){main(()->{Button seven=key(dialog().getWindow().getDecorView(),"7");assertNotNull(seven);for(int i=0;i<amount;i++)assertTrue(seven.performClick());
                if(submit)assertTrue(((Button)field(input,"next")).performClick());});}
        void cancel(){main(()->invoke(input,"cancel"));}
        void finished()throws Exception {long end=SystemClock.elapsedRealtime()+8000;for(;;){synchronized(core){if((Boolean)field(input,"finished"))break;}if(SystemClock.elapsedRealtime()>=end)fail("actual UI/cancel/recipient cleanup join");Thread.sleep(20);}
            assertTrue(completionEntered.await(1,TimeUnit.SECONDS));synchronized(core){assertEquals(0,field(field(owned,"ticket"),"workers"));}if(asyncFailure.get()!=null)throw new AssertionError("actual fixture callback assertion failed",asyncFailure.get());}
        int transfers()throws Exception{synchronized(core){return(Integer)field(field(owned,"ticket"),"transfers");}}
        boolean sealed()throws Exception{synchronized(core){return(Boolean)field(field(owned,"ticket"),"sealed");}}
        void retireAsync(){Thread t=new Thread(()->{try{terminal.set(invoke(core,"retire",gate));}catch(Throwable error){retirementError.set(error);}finally{retirementDone.countDown();}},"synthetic-ui-retirement-only");t.setDaemon(true);t.start();}
        void blockMainCleanup(){assertTrue(new Handler(Looper.getMainLooper()).post(()->{mainBlocked.countDown();try{if(!releaseMain.await(6,TimeUnit.SECONDS))asyncFailure.compareAndSet(null,new AssertionError("bounded main fixture callback"));}
                catch(InterruptedException e){Thread.currentThread().interrupt();asyncFailure.compareAndSet(null,e);}}));}
        void settle(Object original,String delivery)throws Exception{invoke(core,"settleReply",original,kind(delivery));}
        void terminalDelivery(Object original)throws Exception{Object recipient=proxy("PinVerificationRecipient",(self,m,args)->{assertSame(original,args[0]);return null;});invoke(core,"deliver",original,recipient);settle(original,"known");}
        public void close()throws Exception {releaseCurrent.countDown();releaseDerive.countDown();releaseCompletion.countDown();releaseMain.countDown();
            synchronized(core){if(!(Boolean)field(input,"finished"))invoke(input,"cancel");}finished();Object pending=field(input,"reply");
            if(pending!=null&&!(Boolean)field(pending,"settled"))settle(pending,!sealed()&&(Boolean)field(pending,"deliveryCompleted")?"known":"uncertain");
            Object active=field(core,"active");if(active!=null){Object close=terminal.get();if(close==null){boolean retiring;synchronized(core){retiring=(Boolean)field(active,"retiring");}if(retiring){
                            assertTrue(retirementDone.await(6,TimeUnit.SECONDS));if(retirementError.get()!=null)throw new AssertionError(retirementError.get());close=terminal.get();}
                    if(close==null)close=invoke(core,"retire",gate);}if(close!=null&&!(Boolean)field(close,"settled"))terminalDelivery(close);}
            synchronized(callbackCopies){for(byte[] copy:callbackCopies)assertTrue("settled disposable callback bytes wiped",zero(copy));}Arrays.fill(stored,(byte)0);}
    }
    @Test public void oneDigitOriginalEnglishActionAndReply()throws Exception{fixture=new Fixture("en");fixture.denyEarlySettlement=true;fixture.shown();
        main(()->{Dialog d=fixture.dialog();noEdit(d.getWindow().getDecorView());assertEquals("Parent PIN",((TextView)field(fixture.input,"title")).getText().toString());
            assertEquals("Exit child mode",((TextView)field(fixture.input,"actionCaption")).getText().toString());assertTrue((d.getWindow().getAttributes().flags&android.view.WindowManager.LayoutParams.FLAG_SECURE)!=0);
            Button seven=fixture.key(d.getWindow().getDecorView(),"7");assertFalse(seven.isSaveEnabled());assertFalse(((View)field(fixture.input,"mask")).isSaveEnabled());
            assertTrue(seven.getHeight()>=48*activity.getResources().getDisplayMetrics().density);assertEquals("7",seven.getContentDescription().toString());});
        fixture.press(1,true);fixture.finished();assertNotNull(fixture.result.get());assertSame(field(fixture.input,"reply"),fixture.result.get());assertEquals(2,fixture.writes.get());assertEquals(1,fixture.derives.get());
        assertEquals("match",invoke(fixture.result.get(),"mathematicalOutcome").toString());assertFalse((Boolean)field(fixture.result.get(),"platformMath"));assertEquals(1,fixture.transfers());}
    @Test public void explicitRussianLocaleAndAllSixteenFixedCaptions()throws Exception{fixture=new Fixture("ru");fixture.shown();main(()->{assertEquals("Родительский PIN",((TextView)field(fixture.input,"title")).getText().toString());
            assertEquals("Выйти из детского режима",((TextView)field(fixture.input,"actionCaption")).getText().toString());});
        String[] actions={"exit-child-mode","switch-adult-profile","change-exact-age","change-blocked-topics","open-adult-store","initiate-purchase","restore-purchases","open-external","share","account-change",
            "export-child-data","delete-child-data","diagnostics","expand-access-settings","enable-licensed-pack","view-legal-commercial"};Set<Object> ids=new HashSet<>();
        for(String action:actions)assertTrue(ids.add(invoke(nested("PinVerificationNativeInput"),"actionResource",action)));assertEquals(16,ids.size());denied(()->invoke(nested("PinVerificationNativeInput"),"actionResource","caller-caption"));fixture.cancel();fixture.finished();}
    @Test public void emptyMaximumDeletionAndOwnedBufferWipe()throws Exception{fixture=new Fixture("en");fixture.shown();main(()->assertFalse(((Button)field(fixture.input,"next")).isEnabled()));fixture.press(128,false);fixture.press(1,false);
        synchronized(fixture.core){assertEquals(128,field(fixture.input,"length"));}main(()->invoke(fixture.input,"backspace"));synchronized(fixture.core){assertEquals(127,field(fixture.input,"length"));assertEquals(0,((byte[])field(fixture.input,"edit"))[127]);}
        fixture.cancel();fixture.finished();assertTrue(zero((byte[])field(fixture.input,"edit")));assertEquals(0,fixture.writes.get());assertNull(fixture.result.get());}
    @Test public void backRevokesWithoutChargeOrAdmission()throws Exception{fixture=new Fixture("en");fixture.shown();fixture.press(3,false);main(()->{fixture.dialog().dispatchKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN,KeyEvent.KEYCODE_BACK));
            fixture.dialog().dispatchKeyEvent(new KeyEvent(KeyEvent.ACTION_UP,KeyEvent.KEYCODE_BACK));});fixture.finished();assertNull(fixture.result.get());assertEquals(0,fixture.writes.get());assertTrue(fixture.cancels.get()>0);assertTrue(zero((byte[])field(fixture.input,"edit")));}
    @Test public void actualActivityPauseRevokesOriginalHost()throws Exception{fixture=new Fixture("en");fixture.shown();fixture.press(2,false);scenario.moveToState(Lifecycle.State.CREATED);fixture.finished();
        assertNull(fixture.result.get());assertEquals(0,fixture.writes.get());assertTrue(zero((byte[])field(fixture.input,"edit")));}
    @Test public void obscuredTouchRejectsAndWipes()throws Exception{fixture=new Fixture("en");fixture.shown();fixture.press(2,false);main(()->{MotionEvent.PointerProperties p=new MotionEvent.PointerProperties();p.id=0;p.toolType=MotionEvent.TOOL_TYPE_FINGER;
            MotionEvent.PointerCoords c=new MotionEvent.PointerCoords();c.x=10;c.y=10;c.pressure=1;c.size=1;long now=SystemClock.uptimeMillis();MotionEvent event=MotionEvent.obtain(now,now,MotionEvent.ACTION_DOWN,1,
                new MotionEvent.PointerProperties[]{p},new MotionEvent.PointerCoords[]{c},0,0,1,1,0,0,android.view.InputDevice.SOURCE_TOUCHSCREEN,MotionEvent.FLAG_WINDOW_IS_OBSCURED);
            try{assertFalse(fixture.key(fixture.dialog().getWindow().getDecorView(),"7").onFilterTouchEventForSecurity(event));}finally{event.recycle();}});fixture.finished();assertNull(fixture.result.get());assertTrue(zero((byte[])field(fixture.input,"edit")));}
    @Test public void blockedCurrentRetainsActualInputWorkerUntilReturn()throws Exception{fixture=new Fixture("en");fixture.shown();fixture.blockCurrent=true;fixture.press(1,true);assertTrue(fixture.currentEntered.await(3,TimeUnit.SECONDS));fixture.cancel();
        synchronized(fixture.core){assertTrue((Integer)field(field(fixture.owned,"ticket"),"workers")>0);assertFalse((Boolean)field(fixture.input,"finished"));}
        fixture.releaseCurrent.countDown();fixture.finished();assertNull(fixture.result.get());assertEquals(0,fixture.writes.get());}
    @Test public void originalExpiryDuringSynchronousKdfNeverRefunds()throws Exception{fixture=new Fixture("en","exit-child-mode",2500);fixture.shown();fixture.blockDerive=true;fixture.press(1,true);assertTrue(fixture.deriveEntered.await(3,TimeUnit.SECONDS));
        long until=SystemClock.elapsedRealtime()+4500;while(!(Boolean)field(fixture.request,"cancelled")&&SystemClock.elapsedRealtime()<until)Thread.sleep(20);assertTrue((Boolean)field(fixture.request,"cancelled"));
        synchronized(fixture.core){assertTrue((Integer)field(field(fixture.owned,"ticket"),"workers")>0);assertFalse((Boolean)field(fixture.input,"finished"));}assertFalse(zero(fixture.borrowedPin));
        fixture.releaseDerive.countDown();fixture.finished();assertNull(fixture.result.get());assertEquals(1,fixture.writes.get());assertTrue(zero(fixture.borrowedPin));assertTrue(new String(fixture.stored,StandardCharsets.UTF_8).contains("\"pendingAttemptId\":\""+repeated('7')+"\""));}
    @Test public void throwingRecipientNeverReceivesSecondCompletion()throws Exception{fixture=new Fixture("en");fixture.throwCompletion=true;fixture.shown();fixture.press(1,true);fixture.finished();
        assertEquals(1,fixture.completionCalls.get());assertNotNull(fixture.result.get());assertTrue(fixture.sealed());assertEquals(1,fixture.transfers());assertTrue(zero((byte[])field(fixture.result.get(),"bytes")));denied(()->fixture.settle(fixture.result.get(),"known"));}
    @Test public void completedRecipientStillCannotAckBeforeFinalObserverCleanup()throws Exception{fixture=new Fixture("en");fixture.blockCompletion=true;fixture.shown();fixture.press(1,true);assertTrue(fixture.completionEntered.await(3,TimeUnit.SECONDS));
        fixture.blockMainCleanup();assertTrue(fixture.mainBlocked.await(3,TimeUnit.SECONDS));try{fixture.releaseCompletion.countDown();long until=SystemClock.elapsedRealtime()+2000;boolean complete=false;
            while(SystemClock.elapsedRealtime()<until){synchronized(fixture.core){complete=(Boolean)field(fixture.result.get(),"deliveryCompleted");}if(complete)break;Thread.sleep(10);}assertTrue(complete);
            synchronized(fixture.core){assertFalse((Boolean)field(fixture.input,"finished"));assertEquals(0,field(field(fixture.owned,"ticket"),"workers"));}denied(()->fixture.settle(fixture.result.get(),"known"));}
        finally{fixture.releaseMain.countDown();}fixture.finished();fixture.settle(fixture.result.get(),"known");assertEquals(0,fixture.transfers());}
    @Test public void retirementJoinsVisibleOriginalInputAndCleanup()throws Exception{fixture=new Fixture("en");fixture.shown();fixture.press(2,false);fixture.retireAsync();assertTrue(fixture.retirementDone.await(7,TimeUnit.SECONDS));
        if(fixture.retirementError.get()!=null)throw new AssertionError(fixture.retirementError.get());fixture.finished();assertNotNull(fixture.terminal.get());assertNull(fixture.result.get());assertEquals(0,fixture.writes.get());
        synchronized(fixture.core){assertTrue((Boolean)field(fixture.input,"finished"));assertNotNull(field(fixture.core,"active"));}fixture.terminalDelivery(fixture.terminal.get());assertNull(field(fixture.core,"active"));}
    @Test public void foreignThreadCannotBindThroughOriginalVisibleSlot()throws Exception{fixture=new Fixture("en");fixture.shown();byte[] caller={55};Object raw=create("PinVerificationInput",caller);byte[] alias=(byte[])field(raw,"bytes");
        try{denied(()->invoke(fixture.core,"bindInput",fixture.owned,raw));assertFalse(zero(alias));assertEquals(0,fixture.writes.get());denied(()->create("PinVerificationNativeInputRequest",fixture.owned,"en"));}
        finally{((AutoCloseable)raw).close();}fixture.cancel();fixture.finished();}
    @Test public void failureBeforeRecipientRetainsOriginalUncertainTransfer()throws Exception{fixture=new Fixture("en");fixture.shown();fixture.failDeliveryCurrent=true;fixture.press(1,true);fixture.finished();
        assertNull(fixture.result.get());assertEquals(1,fixture.completionCalls.get());Object abandoned=invoke(fixture.input,"abandonedOriginalReply");assertSame(field(fixture.input,"reply"),abandoned);
        assertFalse((Boolean)field(abandoned,"deliveryCompleted"));denied(()->fixture.settle(abandoned,"known"));fixture.settle(abandoned,"uncertain");assertTrue(fixture.sealed());assertEquals(0,fixture.transfers());}
}
