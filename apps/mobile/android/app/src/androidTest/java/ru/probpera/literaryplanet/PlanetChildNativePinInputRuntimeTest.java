package ru.probpera.literaryplanet;

import android.app.Dialog;
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
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Android instrumentation source authored under B; eligible-device NOT_RUN.
 * Exercises actual native widgets/lifecycle on an eligible owned target only.
 * Reflection constructs an explicitly SYNTHETIC private record/session/time
 * authority and synthetic KDF; never constructs a vault or genuine provider.
 * Fixture PINs are public constant digit button labels, never JS payloads.
 * Real Dialog evidence would not establish checkpoint/recovery/App admission,
 * genuine platform KDF performance, or installed release acceptance.
 * No App factory activation, fixture-plan registration or author execution. */
@RunWith(AndroidJUnit4.class)
public final class PlanetChildNativePinInputRuntimeTest {
    private ActivityScenario<MainActivity> scenario;private MainActivity activity;private Fixture fixture;
    @Before public void activity() throws Exception {
        scenario=ActivityScenario.launch(MainActivity.class);scenario.onActivity(a->activity=a);
        long end=SystemClock.elapsedRealtime()+5000;
        while(!activity.hasWindowFocus()&&SystemClock.elapsedRealtime()<end)Thread.sleep(20);
        assertTrue("resumed real fixture Activity",activity.hasWindowFocus());
    }
    @After public void cleanup() throws Exception {
        if(fixture!=null){fixture.releaseCurrent.countDown();fixture.releaseDerive.countDown();fixture.close();}
        if(scenario!=null)scenario.close();
    }
    private interface Checked { void run() throws Exception; }
    private static Class<?> nested(String name)throws Exception{return Class.forName("ru.probpera.literaryplanet.PlanetChildVault$"+name);}
    @SuppressWarnings({"unchecked","rawtypes"}) private static Object kind(String type,String name)throws Exception{return Enum.valueOf((Class)nested(type),name);}
    private static Object field(Object owner,String name)throws Exception{Field f=owner.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(owner);}
    private static Object create(String name,Object...args)throws Exception{
        for(Constructor<?> c:nested(name).getDeclaredConstructors())if(c.getParameterCount()==args.length){c.setAccessible(true);
            try{return c.newInstance(args);}catch(InvocationTargetException e){throw cause(e);}}
        throw new AssertionError("private fixture constructor "+name);
    }
    private static Exception cause(InvocationTargetException e){Throwable t=e.getCause();if(t instanceof Error)throw(Error)t;return t instanceof Exception?(Exception)t:new Exception(t);}
    private static Object invoke(Object owner,String name,Object...args)throws Exception{
        Class<?> c=owner instanceof Class<?>?(Class<?>)owner:owner.getClass();
        for(Method m:c.getDeclaredMethods())if(m.getName().equals(name)&&m.getParameterCount()==args.length){m.setAccessible(true);
            try{return m.invoke(owner instanceof Class<?>?null:owner,args);}catch(InvocationTargetException e){throw cause(e);}}
        throw new AssertionError("private fixture method "+name);
    }
    private static void denied(Checked body)throws Exception{try{body.run();fail("expected private refusal");}catch(Exception expected){}}
    private static boolean zero(byte[] bytes){for(byte b:bytes)if(b!=0)return false;return true;}
    private static String repeated(char c){char[] x=new char[64];Arrays.fill(x,c);return new String(x);}
    private static String sha(byte[] bytes)throws Exception{byte[] digest=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder text=new StringBuilder();
        try{for(byte b:digest)text.append(String.format(Locale.ROOT,"%02x",b&255));return text.toString();}finally{Arrays.fill(digest,(byte)0);}}
    private static Object obj(Object proxy,Method m,Object[] a){switch(m.getName()){case "equals":return proxy==a[0];
        case "hashCode":return System.identityHashCode(proxy);case "toString":return "EXPLICIT_SYNTHETIC_NATIVE_UI_ONLY";default:throw new AssertionError(m);}}
    private static byte[] seed()throws Exception{
        String registry="{\"schemaVersion\":1,\"policyVersion\":\"synthetic-native-input-v1\",\"activeProfileId\":null,\"profiles\":[]}";
        String value="{\"schemaVersion\":1,\"revision\":7,\"mode\":\"adult\",\"selectionRevision\":3,\"profileRevision\":2,\"policyChecksum\":\""+repeated('a')
            +"\",\"registryChecksum\":\""+sha(registry.getBytes(StandardCharsets.UTF_8))+"\",\"registry\":"+registry+",\"pin\":null,\"clock\":{\"schemaVersion\":1,"
            +"\"bootId\":\"00000000-0000-4000-8000-000000000001\",\"uptimeAnchorMs\":100,\"logicalAnchorMs\":1000,\"epochAnchorMs\":null}}";
        return value.getBytes(StandardCharsets.UTF_8);
    }
    private final class Fixture implements AutoCloseable {
        final byte[] record=seed();final ReentrantLock ioLock=new ReentrantLock();final List<byte[]> copies=Collections.synchronizedList(new ArrayList<>());
        final CountDownLatch currentEntered=new CountDownLatch(1),releaseCurrent=new CountDownLatch(1),completion=new CountDownLatch(1);
        final CountDownLatch deriveEntered=new CountDownLatch(1),releaseDerive=new CountDownLatch(1);
        final AtomicInteger completionCalls=new AtomicInteger();
        final AtomicReference<Object> result=new AtomicReference<>();final Object core,inspection,session,primitives,context,request,input;
        volatile boolean blockCurrent,blockDerive,throwCompletion,denyEarlyBackingSettlement;volatile int cancels;volatile byte[] borrowedPin;
        Fixture(String locale)throws Exception{this(locale,60000);}
        Fixture(String locale,long timeout)throws Exception{
            String checksum=sha(record);
            Class<?> authorityType=nested("PinSessionAuthority");
            Object authority=Proxy.newProxyInstance(authorityType.getClassLoader(),new Class<?>[]{authorityType},(p,m,a)->{
                if(m.getDeclaringClass()==Object.class)return obj(p,m,a);
                if(m.getName().equals("capture")||m.getName().equals("current")){
                    byte[] owned=(byte[])a[1];copies.add(owned);assertEquals(checksum,a[2]);assertEquals(checksum,sha(owned));
                    if(m.getName().equals("current")&&blockCurrent){currentEntered.countDown();assertTrue("bounded actual callback",releaseCurrent.await(5,TimeUnit.SECONDS));}
                    long now=SystemClock.elapsedRealtime();return create("PinNativeCoordinates",p,repeated('1'),"00000000-0000-4000-8000-000000000001",checksum,7L,4L,now,900L+now);}
                if(m.getName().equals("cancel")){cancels++;return null;}if(m.getName().equals("retire"))return null;
                throw new AssertionError("native UI must not publish or grant "+m.getName());
            });
            Class<?> ioType=nested("PinSessionIO");Object io=Proxy.newProxyInstance(ioType.getClassLoader(),new Class<?>[]{ioType},(p,m,a)->{
                if(m.getDeclaringClass()==Object.class)return obj(p,m,a);ioLock.lock();
                try{Class<?> tx=nested("PinSessionTransaction");Object transaction=Proxy.newProxyInstance(tx.getClassLoader(),new Class<?>[]{tx},(t,n,b)->{
                    if(n.getDeclaringClass()==Object.class)return obj(t,n,b);if(n.getName().equals("read"))return record.clone();
                    throw new AssertionError("input alone cannot write vault");});return invoke(a[0],"run",transaction);}
                finally{ioLock.unlock();}
            });
            Object policy=create("PinSessionPolicy","synthetic-native-input-v1",repeated('a'),600000L,600000L);
            core=create("NativePinSessions",io,authority,null,policy);
            inspection=invoke(core,"inspection",repeated('7'),kind("PinLifecycleAction","enroll"),timeout);
            Object begin=invoke(core,"begin",inspection);session=field(begin,"session");
            // Explicit synthetic host settlement solely for this fixture.
            invoke(core,"settleReply",begin,kind("PinReplyDelivery","known"));
            Class<?> platform=nested("PinPrimitivePlatform");int[] random={0};Object synthetic=Proxy.newProxyInstance(platform.getClassLoader(),new Class<?>[]{platform},(p,m,a)->{
                if(m.getDeclaringClass()==Object.class)return obj(p,m,a);
                if(m.getName().equals("continuousNanos"))return SystemClock.elapsedRealtimeNanos();
                if(m.getName().equals("random")){Arrays.fill((byte[])a[0],(byte)(17+ ++random[0]));return null;}
                if(m.getName().equals("derive")){assertEquals(600000L,a[2]);invoke(a[4],"check");
                    if(blockDerive){borrowedPin=(byte[])a[0];deriveEntered.countDown();assertTrue("bounded actual engine callback",releaseDerive.await(5,TimeUnit.SECONDS));}
                    Arrays.fill((byte[])a[3],(byte)90);invoke(a[4],"check");return null;}
                throw new AssertionError(m);
            });
            primitives=invoke(nested("PinNativePrimitives"),"syntheticFixture",core,4,128,5000L,synthetic);context=invoke(primitives,"context",session);
            Object calibration=invoke(primitives,"calibrate",context);request=create("PinNativeInputRequest",context,calibration,locale);
            Class<?> completed=nested("PinNativeInputCompletion");Object callback=Proxy.newProxyInstance(completed.getClassLoader(),new Class<?>[]{completed},(p,m,a)->{
                if(m.getDeclaringClass()==Object.class)return obj(p,m,a);completionCalls.incrementAndGet();result.set(a[0]);completion.countDown();
                if(denyEarlyBackingSettlement&&a[0]!=null){Object backing=field(field(a[0],"material"),"backing");
                    denied(()->invoke(core,"settleReply",backing,kind("PinReplyDelivery","known")));
                    synchronized(core){assertFalse((Boolean)field(backing,"settled"));assertEquals(1,field(inspection,"transfers"));}}
                if(throwCompletion)throw new Exception("synthetic lost private recipient");return null;
            });
            input=create("PinNativeInput",request,activity,callback);invoke(input,"start");
        }
        Dialog dialog()throws Exception{return(Dialog)field(input,"dialog");}
        void shown()throws Exception{
            long end=SystemClock.elapsedRealtime()+5000;
            while(SystemClock.elapsedRealtime()<end){AtomicReference<Boolean> visible=new AtomicReference<>(false);
                InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{Dialog d=dialog();visible.set(d!=null&&d.isShowing()&&d.getWindow().getDecorView().hasWindowFocus());}catch(Exception e){throw new AssertionError(e);}});
                if(visible.get())return;Thread.sleep(20);}fail("real native Dialog focus");
        }
        void finished()throws Exception{long end=SystemClock.elapsedRealtime()+6000;
            for(;;){synchronized(core){if((Boolean)field(input,"finished"))break;}if(SystemClock.elapsedRealtime()>=end)fail("actual input worker/cleanup join");Thread.sleep(20);}
            assertTrue(completion.await(1,TimeUnit.SECONDS));synchronized(core){assertEquals(0,field(inspection,"workers"));}
        }
        int transfers()throws Exception{synchronized(core){return(Integer)field(inspection,"transfers");}}
        Button digit(View view,String publicLabel){if(view instanceof Button&&publicLabel.contentEquals(((Button)view).getText()))return(Button)view;
            if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++){Button found=digit(group.getChildAt(i),publicLabel);if(found!=null)return found;}}return null;}
        void enter(String publicDigits,boolean next)throws Exception{
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{for(char ch:publicDigits.toCharArray()){
                    Button key=digit(dialog().getWindow().getDecorView(),String.valueOf(ch));assertNotNull(key);assertTrue(key.performClick());}
                if(next)assertTrue(((Button)field(input,"next")).performClick());}catch(Exception e){throw new AssertionError(e);}});
        }
        void prepared()throws Exception{shown();enter("1234",true);enter("1234",true);finished();assertNotNull(result.get());}
        void cancel()throws Exception{InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{invoke(input,"cancel");}catch(Exception e){throw new AssertionError(e);}});}
        void noEdit(View view){assertFalse("no raw/IME input field",view instanceof EditText);if(view instanceof ViewGroup){ViewGroup g=(ViewGroup)view;for(int i=0;i<g.getChildCount();i++)noEdit(g.getChildAt(i));}}
        public void close()throws Exception{
            releaseCurrent.countDown();releaseDerive.countDown();synchronized(core){if(!(Boolean)field(input,"finished"))invoke(input,"cancel");}finished();
            Object receipt=result.get();if(receipt!=null&&transfers()==1)invoke(receipt,"settle",kind("PinReplyDelivery",
                (Boolean)field(inspection,"sealed")?"uncertain":"known"));
            // Actual fixture retirement/known synthetic host close are separate
            // from Dialog.close, timers or a production admission flag.
            if(transfers()==0){Object terminal=invoke(core,"retire",inspection);invoke(core,"settleReply",terminal,kind("PinReplyDelivery","known"));}
            synchronized(copies){for(byte[] copy:copies)assertTrue("settled isolated record copy wiped",zero(copy));}
            Arrays.fill(record,(byte)0);
        }
    }
    @Test public void productionInputFactoryUnsupported()throws Exception{assertNull(invoke(PlanetChildVault.class,"actualSdkPinInput",new Object[]{null}));}
    @Test public void englishNativeKeypadExplicitLocaleAndTargets()throws Exception{fixture=new Fixture("en");fixture.shown();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{Dialog dialog=fixture.dialog();
            assertEquals("Parent PIN",((TextView)field(fixture.input,"title")).getText().toString());fixture.noEdit(dialog.getWindow().getDecorView());
            assertTrue((dialog.getWindow().getAttributes().flags&android.view.WindowManager.LayoutParams.FLAG_SECURE)!=0);
            Button key=fixture.digit(dialog.getWindow().getDecorView(),"1");assertTrue(key.getHeight()>=48*activity.getResources().getDisplayMetrics().density);
            assertEquals("1",key.getContentDescription().toString());}catch(Exception e){throw new AssertionError(e);}});
        fixture.enter("12",false);assertEquals(2,field(fixture.input,"length"));fixture.cancel();fixture.finished();assertNull(fixture.result.get());}
    @Test public void russianNativeKeypadExplicitLocale()throws Exception{fixture=new Fixture("ru");fixture.shown();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{assertEquals("Родительский PIN",((TextView)field(fixture.input,"title")).getText().toString());}
            catch(Exception e){throw new AssertionError(e);}});fixture.cancel();fixture.finished();}
    @Test public void freshConfirmationSeparateAndOnlyOwnedMaterialReturned()throws Exception{fixture=new Fixture("en");fixture.shown();fixture.enter("1234",true);
        synchronized(fixture.core){assertEquals(1,field(fixture.input,"stage"));assertTrue(zero((byte[])field(fixture.input,"edit")));assertEquals(4,((byte[])field(fixture.input,"first")).length);}
        fixture.enter("1234",true);fixture.finished();Object receipt=fixture.result.get();assertNotNull(receipt);assertEquals(1,fixture.transfers());
        assertTrue(zero((byte[])field(fixture.input,"first")));assertTrue(zero((byte[])field(fixture.input,"second")));
        assertEquals(96,((byte[])field(field(field(receipt,"material"),"backing"),"bytes")).length);}
    @Test public void backRevokesAndWipesWithoutAdmission()throws Exception{fixture=new Fixture("en");fixture.shown();fixture.enter("12",false);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{fixture.dialog().dispatchKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN,KeyEvent.KEYCODE_BACK));
            fixture.dialog().dispatchKeyEvent(new KeyEvent(KeyEvent.ACTION_UP,KeyEvent.KEYCODE_BACK));}catch(Exception e){throw new AssertionError(e);}});
        fixture.finished();assertTrue(zero((byte[])field(fixture.input,"edit")));assertNull(fixture.result.get());assertTrue(fixture.cancels>=1);}
    @Test public void actualActivityStopRevokesExactOwner()throws Exception{fixture=new Fixture("en");fixture.shown();fixture.enter("12",false);
        scenario.moveToState(Lifecycle.State.CREATED);fixture.finished();assertNull(fixture.result.get());assertTrue(zero((byte[])field(fixture.input,"edit")));}
    @Test public void obscuredNativeTouchCancels()throws Exception{fixture=new Fixture("en");fixture.shown();fixture.enter("12",false);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{MotionEvent.PointerProperties property=new MotionEvent.PointerProperties();property.id=0;property.toolType=MotionEvent.TOOL_TYPE_FINGER;
            MotionEvent.PointerCoords coordinates=new MotionEvent.PointerCoords();coordinates.x=10;coordinates.y=10;coordinates.pressure=1;coordinates.size=1;
            long now=SystemClock.uptimeMillis();MotionEvent event=MotionEvent.obtain(now,now,MotionEvent.ACTION_DOWN,1,new MotionEvent.PointerProperties[]{property},
                new MotionEvent.PointerCoords[]{coordinates},0,0,1,1,0,0,android.view.InputDevice.SOURCE_TOUCHSCREEN,MotionEvent.FLAG_WINDOW_IS_OBSCURED);
            try{assertFalse(fixture.digit(fixture.dialog().getWindow().getDecorView(),"1").onFilterTouchEventForSecurity(event));}finally{event.recycle();}
        }catch(Exception e){throw new AssertionError(e);}});fixture.finished();assertNull(fixture.result.get());assertTrue(zero((byte[])field(fixture.input,"edit")));}
    @Test public void closeCannotAcknowledgeOriginalInputReceipt()throws Exception{fixture=new Fixture("en");fixture.prepared();Object receipt=fixture.result.get();
        invoke(receipt,"close");assertEquals(1,fixture.transfers());invoke(receipt,"settle",kind("PinReplyDelivery","known"));assertEquals(0,fixture.transfers());
        denied(()->invoke(receipt,"settle",kind("PinReplyDelivery","known")));}
    @Test public void confirmationMismatchRetriesWithSameDeadlineAndCalibration()throws Exception{fixture=new Fixture("en");fixture.shown();
        Object calibration=field(fixture.request,"calibration");long deadline=(Long)field(fixture.session,"deadlineUptimeMs");fixture.enter("1234",true);
        byte[] discarded=(byte[])field(fixture.input,"first");fixture.enter("1235",true);
        synchronized(fixture.core){assertTrue(zero(discarded));assertTrue(zero((byte[])field(fixture.input,"edit")));assertNull(field(fixture.input,"first"));
            assertNull(field(fixture.input,"second"));assertEquals(0,field(fixture.input,"stage"));assertFalse((Boolean)field(fixture.input,"finished"));}
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{assertEquals("PINs do not match. Create a new PIN and try again.",
            ((TextView)field(fixture.input,"subtitle")).getText().toString());assertTrue(fixture.dialog().isShowing());}catch(Exception e){throw new AssertionError(e);}});
        assertNull(fixture.result.get());assertEquals(0,fixture.completionCalls.get());assertEquals(0,fixture.transfers());
        assertSame(calibration,field(fixture.request,"calibration"));assertEquals(deadline,field(fixture.session,"deadlineUptimeMs"));
        fixture.enter("5678",true);fixture.enter("5678",true);fixture.finished();assertNotNull(fixture.result.get());assertEquals(1,fixture.completionCalls.get());}
    @Test public void russianMismatchFeedbackUsesOriginalRequestLocale()throws Exception{fixture=new Fixture("ru");fixture.shown();
        fixture.enter("1234",true);fixture.enter("1235",true);InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{
            assertEquals("PIN-коды не совпадают. Создайте новый PIN и повторите ввод.",((TextView)field(fixture.input,"subtitle")).getText().toString());
        }catch(Exception e){throw new AssertionError(e);}});fixture.cancel();fixture.finished();assertNull(fixture.result.get());}
    @Test public void genericBackingReplyCannotSettleDuringOriginalInputCallback()throws Exception{fixture=new Fixture("en");fixture.denyEarlyBackingSettlement=true;
        fixture.prepared();Object receipt=fixture.result.get();assertEquals(1,fixture.transfers());invoke(receipt,"settle",kind("PinReplyDelivery","known"));assertEquals(0,fixture.transfers());}
    @Test public void originalDeadlineDismissesWithoutAdmission()throws Exception{fixture=new Fixture("en",1500);long deadline=(Long)field(fixture.session,"deadlineUptimeMs");
        fixture.finished();assertNull(fixture.result.get());assertEquals(deadline,field(fixture.session,"deadlineUptimeMs"));assertEquals(0,fixture.transfers());}
    @Test public void blockedCurrentRetainsActualWorkerUntilReturn()throws Exception{fixture=new Fixture("en");fixture.shown();fixture.blockCurrent=true;
        fixture.enter("1234",true);fixture.enter("1234",true);assertTrue(fixture.currentEntered.await(3,TimeUnit.SECONDS));fixture.cancel();
        synchronized(fixture.core){assertTrue((Integer)field(fixture.inspection,"workers")>0);assertFalse(zero((byte[])field(fixture.context,"expected")));}
        fixture.releaseCurrent.countDown();fixture.finished();assertNull(fixture.result.get());assertTrue(zero((byte[])field(fixture.context,"expected")));}
    @Test public void enteredRecipientThrowsExactlyOnceAndRetainsOriginalTransfer()throws Exception{fixture=new Fixture("en");fixture.throwCompletion=true;
        fixture.shown();fixture.enter("1234",true);fixture.enter("1234",true);fixture.finished();
        assertEquals(1,fixture.completionCalls.get());assertNotNull(fixture.result.get());assertEquals(1,fixture.transfers());
        synchronized(fixture.core){assertTrue((Boolean)field(fixture.inspection,"sealed"));}
        Object receipt=fixture.result.get();assertTrue(zero((byte[])field(field(field(receipt,"material"),"backing"),"bytes")));
        denied(()->invoke(receipt,"settle",kind("PinReplyDelivery","known")));}
    @Test public void originalExpiryRevokesDuringSynchronousDerivation()throws Exception{fixture=new Fixture("en",2000);fixture.shown();fixture.blockDerive=true;
        fixture.enter("1234",true);fixture.enter("1234",true);assertTrue(fixture.deriveEntered.await(3,TimeUnit.SECONDS));
        long until=SystemClock.elapsedRealtime()+4000;boolean cancelled=false;
        while(SystemClock.elapsedRealtime()<until){synchronized(fixture.core){cancelled=(Boolean)field(fixture.request,"cancelled");}
            if(cancelled)break;Thread.sleep(20);}assertTrue("original deadline revokes while platform call remains actual",cancelled);
        synchronized(fixture.core){assertTrue((Integer)field(fixture.inspection,"workers")>0);}assertFalse(zero(fixture.borrowedPin));
        fixture.releaseDerive.countDown();fixture.finished();assertNull(fixture.result.get());assertTrue(zero(fixture.borrowedPin));}
}
