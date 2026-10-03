package ru.probpera.literaryplanet;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/** B-only synthetic native-core fixture plus actual JVM platform KDF vectors.
 * Uses the unchanged old39 driver's private synthetic Scenario by reflection;
 * never constructs a vault, App, native input UI, checkpoint/recovery provider
 * or authenticated host. Injected time/entropy/derive is explicitly synthetic.
 * The one argument is root's independent Node oracle for the PUBLIC fixture
 * ASCII bytes49..56, salt00..1f, iterations600000, derivedBytes32.
 * No actual parent PIN is converted to a String or crosses Node/JS/files.
 * NOT_RUN until root compiles once and records both separate driver mains. */
public final class PlanetChildNativePinPrimitivesJvmDriver {
    private interface Checked { void run() throws Exception; }
    private interface Call { void run(Object[] args) throws Exception; }
    private static final List<String> cases=new ArrayList<>();
    private static final AtomicInteger assertions=new AtomicInteger();
    private static void check(boolean ok,String label){if(!ok)throw new AssertionError(label);assertions.incrementAndGet();}
    private static void run(String name,Checked body)throws Exception{body.run();cases.add(name);System.out.println("PRIVATE_PIN_PRIMITIVE_CASE "+name);}
    private static void denied(Checked body)throws Exception{boolean no=false;try{body.run();}catch(Exception expected){no=true;}check(no,"expected checked denial");}
    private static boolean zero(byte[] bytes){for(byte b:bytes)if(b!=0)return false;return true;}
    private static byte[] ascii(String publicFixture){return publicFixture.getBytes(StandardCharsets.US_ASCII);}
    private static byte[] hex(String value){check(value!=null&&value.matches("[0-9a-f]{64}"),"public 32-byte oracle");byte[] out=new byte[32];
        for(int i=0;i<32;i++)out[i]=(byte)((Character.digit(value.charAt(i*2),16)<<4)|Character.digit(value.charAt(i*2+1),16));return out;}
    private static String id(int n){return String.format(java.util.Locale.ROOT,"%064x",n);}
    private static Class<?> nested(String name)throws Exception{return Class.forName("ru.probpera.literaryplanet.PlanetChildVault$"+name);}
    private static Object value(String type,String name)throws Exception{@SuppressWarnings({"rawtypes","unchecked"}) Object v=Enum.valueOf((Class)nested(type),name);return v;}
    private static Exception cause(InvocationTargetException e){Throwable c=e.getCause();if(c instanceof Error)throw(Error)c;return c instanceof Exception?(Exception)c:new Exception(c);}
    private static boolean compatible(Class<?>[] types,Object[] args){for(int i=0;i<types.length;i++){Class<?> t=types[i];Object a=args[i];
        if(a==null){if(t.isPrimitive())return false;}else if(t.isPrimitive()){
            if(t==int.class&&!(a instanceof Integer)||t==long.class&&!(a instanceof Long)||t==boolean.class&&!(a instanceof Boolean))return false;
        }else if(!t.isInstance(a))return false;}return true;}
    private static Object construct(Class<?> type,Object...args)throws Exception{for(Constructor<?> c:type.getDeclaredConstructors())
        if(c.getParameterCount()==args.length&&compatible(c.getParameterTypes(),args)){c.setAccessible(true);try{return c.newInstance(args);}catch(InvocationTargetException e){throw cause(e);}}
        throw new AssertionError("missing compatible private constructor "+type.getSimpleName());}
    private static Object create(String name,Object...args)throws Exception{return construct(nested(name),args);}
    private static Object invoke(Object owner,String name,Object...args)throws Exception{Class<?> type=owner instanceof Class<?>?(Class<?>)owner:owner.getClass();
        for(Method m:type.getDeclaredMethods())if(m.getName().equals(name)&&m.getParameterCount()==args.length&&compatible(m.getParameterTypes(),args)){
            m.setAccessible(true);try{return m.invoke(owner instanceof Class<?>?null:owner,args);}catch(InvocationTargetException e){throw cause(e);}}
        throw new AssertionError("missing compatible private method "+name);}
    private static Object field(Object owner,String name)throws Exception{Field f=owner.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(owner);}
    private static void set(Object owner,String name,Object value)throws Exception{Field f=owner.getClass().getDeclaredField(name);f.setAccessible(true);f.set(owner,value);}
    private static Object objectMethod(Object proxy,Method m,Object[] args){switch(m.getName()){
        case "equals":return proxy==args[0];case "hashCode":return System.identityHashCode(proxy);case "toString":return "EXPLICIT_SYNTHETIC_PRIMITIVE_ONLY";default:throw new AssertionError(m);}}
    private static Object proxy(String type,Call call)throws Exception{Class<?> t=nested(type);return Proxy.newProxyInstance(t.getClassLoader(),new Class<?>[]{t},(p,m,a)->{
        if(m.getDeclaringClass()==Object.class)return objectMethod(p,m,a);call.run(a);return null;});}
    private static Object oldStatic(String name,Object...args)throws Exception{return invoke(PlanetChildNativePinSessionsJvmDriver.class,name,args);}
    private static Object checkProxy(Checked body)throws Exception{return proxy("PinPrimitiveCheck",args->body.run());}
    private static void platformKdf(byte[] pin,byte[] salt,long iterations,byte[] output,Object fence)throws Exception{
        invoke(nested("PinPlatformKdf"),"derive32",pin,salt,iterations,output,fence);}

    private static final class Fixture implements AutoCloseable {
        final Object scenario,core,inspection,session,primitives,context;final Platform platform;
        Fixture()throws Exception{this(true);}
        Fixture(boolean seed)throws Exception{
            scenario=construct(Class.forName(PlanetChildNativePinSessionsJvmDriver.class.getName()+"$Synthetic"),seed,true);
            core=field(scenario,"core");inspection=invoke(core,"inspection",id(301),value("PinLifecycleAction",seed?"enroll":"replace"),60000L);
            set(scenario,"inspection",inspection);Object reply=invoke(core,"begin",inspection);set(scenario,"beginReply",reply);
            session=field(reply,"session");set(scenario,"session",session);invoke(scenario,"settleBegin");
            platform=new Platform(this);primitives=invoke(nested("PinNativePrimitives"),"syntheticFixture",core,4,128,5000L,platform.proxy);
            context=invoke(primitives,"context",session);
        }
        Object entry(String kind,byte[] owned)throws Exception{return invoke(primitives,"entry",context,value("PinPrimitiveEntry",kind),owned);}
        Object calibrate()throws Exception{return invoke(primitives,"calibrate",context);}
        Object prepare(Object proof,Object first,Object confirmation)throws Exception{return invoke(primitives,"prepare",context,proof,first,confirmation);}
        Object prepared()throws Exception{Object proof=calibrate();return prepare(proof,entry("fresh",ascii("12345678")),entry("confirmation",ascii("12345678")));}
        int workers()throws Exception{synchronized(core){return (Integer)field(inspection,"workers");}}
        int transfers()throws Exception{synchronized(core){return (Integer)field(inspection,"transfers");}}
        boolean flag(String name)throws Exception{synchronized(core){return(Boolean)field(inspection,name);}}
        byte[] expected()throws Exception{synchronized(core){return(byte[])field(context,"expected");}}
        void held()throws Exception{synchronized(core){check(field(core,"active")==inspection,"capacity retained");}}
        void settle(Object material,String delivery)throws Exception{invoke(primitives,"settleMaterial",material,value("PinReplyDelivery",delivery));}
        void retireKnown()throws Exception{Object terminal=invoke(core,"retire",inspection);held();invoke(core,"settleReply",terminal,value("PinReplyDelivery","known"));}
        int callbacks()throws Exception{return ((List<?>)field(scenario,"callbackCopies")).size();}
        public void close()throws Exception{invoke(context,"close");invoke(scenario,"close");}
    }
    private static final class Platform {
        final Fixture f;final Object proxy;final List<byte[]> aliases=new ArrayList<>();
        long nanos=100000000L,step=100000L;int clockCalls,randomCalls,deriveCalls,polls=2;
        String mutation,throwAt;Call onClock,onRandom,onDerive;
        Platform(Fixture f)throws Exception{this.f=f;Class<?> t=nested("PinPrimitivePlatform");
            proxy=Proxy.newProxyInstance(t.getClassLoader(),new Class<?>[]{t},(p,m,a)->{
                if(m.getDeclaringClass()==Object.class)return objectMethod(p,m,a);
                if(m.getName().equals("continuousNanos")){clockCalls++;if(onClock!=null)onClock.run(a);
                    if("clock".equals(throwAt))throw new Exception("synthetic clock fault");
                    nanos+=step;set(f.scenario,"uptime",nanos/1000000L);return nanos;}
                if(m.getName().equals("random")){randomCalls++;byte[] out=(byte[])a[0];aliases.add(out);
                    if(onRandom!=null)onRandom.run(a);for(int i=0;i<out.length;i++)out[i]=(byte)(17+randomCalls+i);
                    if("random".equals(throwAt))throw new Exception("synthetic random fault");return null;}
                if(m.getName().equals("derive")){deriveCalls++;byte[] pin=(byte[])a[0],salt=(byte[])a[1],out=(byte[])a[3];
                    aliases.add(pin);aliases.add(salt);aliases.add(out);check(((Long)a[2])==600000L,"synthetic exact production floor");
                    if(onDerive!=null)onDerive.run(a);for(int i=0;i<polls;i++)invoke(a[4],"check");
                    if("pin".equals(mutation))pin[0]^=1;if("salt".equals(mutation))salt[0]^=1;
                    Arrays.fill(out,(byte)(65+deriveCalls));if("unavailable".equals(throwAt))throw new java.security.NoSuchAlgorithmException("synthetic absent fixed platform algorithm");
                    if("derive".equals(throwAt))throw new Exception("synthetic KDF fault");return null;}
                throw new AssertionError(m.getName());
            });}
        void wiped(){for(byte[] bytes:aliases)check(zero(bytes),"app-owned callback aliases wiped after return");}
    }
    private static void await(CountDownLatch latch)throws Exception{check(latch.await(3,TimeUnit.SECONDS),"bounded synthetic callback entered");}
    private static Thread thread(Checked body,AtomicReference<Throwable> error){Thread t=new Thread(()->{try{body.run();}catch(Throwable e){error.set(e);}},"synthetic-private-primitive");
        t.setDaemon(true);t.start();return t;}
    private static void join(Thread t,AtomicReference<Throwable> error)throws Exception{t.join(3000);check(!t.isAlive(),"actual worker joined");if(error.get()!=null)throw new AssertionError("fixture worker failed",error.get());}
    private static void waitFlag(Fixture f,String flag)throws Exception{long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(3);
        while(!f.flag(flag)&&System.nanoTime()<end)Thread.yield();check(f.flag(flag),"synchronized terminal flag visible");}
    private static byte[] materialBytes(Object material)throws Exception{return(byte[])field(field(material,"backing"),"bytes");}

    public static void main(String[] args)throws Exception{
        check(args.length==1&&args[0].matches("[0-9a-f]{64}"),"one public independent oracle argument");
        run("platform-malformed-native-pin-rejected",()->{
            byte[] salt=new byte[32],out=new byte[32];int[] callbacks={0};Object fence=checkProxy(()->callbacks[0]++);
            for(byte[] invalid:new byte[][]{ascii("123"),new byte[129],ascii("12a4"),new byte[]{49,50,51,0},new byte[]{49,50,51,(byte)255}}){
                try{denied(()->platformKdf(invalid,salt,600000L,out,fence));}
                finally{Arrays.fill(invalid,(byte)0);}}
            check(callbacks[0]==0,"malformed native PIN rejected before platform callbacks");Arrays.fill(salt,(byte)0);Arrays.fill(out,(byte)0);});
        run("independent-node-600000-oracle",()->{
            byte[] pin={49,50,51,52,53,54,55,56},salt=new byte[32],out=new byte[32],want=hex(args[0]);int[] polls={0};
            for(int i=0;i<32;i++)salt[i]=(byte)i;
            try{platformKdf(pin,salt,600000L,out,checkProxy(()->polls[0]++));
                check(Arrays.equals(out,want),"actual fixed platform KDF matches independent public oracle");
                check(polls[0]==2,"synchronous platform boundary checks without projected internal cancellation");}
            finally{Arrays.fill(pin,(byte)0);Arrays.fill(salt,(byte)0);Arrays.fill(out,(byte)0);Arrays.fill(want,(byte)0);}});
        run("platform-input-and-signed-iteration-bounds",()->{
            Object poll=checkProxy(()->{});byte[] good=ascii("1234"),salt=new byte[32],out=new byte[32];
            try{denied(()->platformKdf(null,salt,600000L,out,poll));denied(()->platformKdf(new byte[0],salt,600000L,out,poll));
                denied(()->platformKdf(good,null,600000L,out,poll));denied(()->platformKdf(good,new byte[33],600000L,out,poll));
                denied(()->platformKdf(good,new byte[0],600000L,out,poll));denied(()->platformKdf(good,salt,0L,out,poll));
                denied(()->platformKdf(good,salt,2147483648L,out,poll));denied(()->platformKdf(good,salt,600000L,new byte[31],poll));
                denied(()->platformKdf(good,salt,599999L,out,poll));denied(()->platformKdf(good,new byte[31],600000L,out,poll));}
            finally{Arrays.fill(good,(byte)0);Arrays.fill(salt,(byte)0);Arrays.fill(out,(byte)0);}});
        run("platform-cancel-after-return-wipes-output",()->{
            byte[] pin=ascii("1234"),salt=new byte[32],out=new byte[32];Arrays.fill(out,(byte)9);int[] polls={0};
            try{denied(()->platformKdf(pin,salt,600000L,out,checkProxy(()->{if(++polls[0]==2)throw new Exception("synthetic cancellation");})));
                check(polls[0]==2&&zero(out),"no late synchronous platform output after cancellation");}
            finally{Arrays.fill(pin,(byte)0);Arrays.fill(salt,(byte)0);Arrays.fill(out,(byte)0);}});
        run("production-primitives-factory-unsupported",()->{
            check(invoke(PlanetChildVault.class,"actualSdkPinPrimitives",new Object[]{null})==null,"actual native primitive admission absent");
            check(invoke(PlanetChildVault.class,"actualSdkPinSessions",new Object[]{null})==null,"actual checkpoint/action session factory absent");});
        run("original-context-worker-before-first-callback",()->{try(Fixture f=new Fixture()){
            f.platform.onClock=a->{check(f.workers()==1,"worker registered before clock");check((Integer)field(f.context,"workers")==1,"context original worker registered");};
            Object proof=f.calibrate();check(field(proof,"context")==f.context,"constructor original calibration context");
            check(f.workers()==0&&f.transfers()==0,"actual callbacks finish before worker settlement");f.platform.wiped();}});
        run("three-exact-measured-calibration-samples",()->{try(Fixture f=new Fixture()){
            Object proof=f.calibrate();long[] measured=(long[])field(proof,"elapsedNanos");check(measured.length==3&&f.platform.deriveCalls==3,"three actual synthetic calls");
            for(long elapsed:measured)check(elapsed>0&&elapsed<=5000000000L,"positive exact measured bounded sample");
            check(field(proof,"iterations").equals(600000L),"no projected lower iteration calibration");f.platform.wiped();}});
        run("production-policy-digit-budget-guards",()->{try(Fixture f=new Fixture()){
            denied(()->create("PinNativePrimitives",f.core,3,128,5000L,f.platform.proxy));denied(()->create("PinNativePrimitives",f.core,4,129,5000L,f.platform.proxy));
            denied(()->create("PinNativePrimitives",f.core,4,128,0L,f.platform.proxy));denied(()->create("PinNativePrimitives",f.core,4,128,5001L,f.platform.proxy));
            denied(()->create("PinSessionPolicy","synthetic-session-v1",id(10),600000L,599999L));}});
        run("native-ascii-entry-owned-wipe-and-confirmation",()->{try(Fixture f=new Fixture()){
            byte[] bad={49,50,51,0};denied(()->f.entry("fresh",bad));check(zero(bad),"rejected bounded input wiped");
            byte[] shortPin=ascii("123");denied(()->f.entry("fresh",shortPin));check(zero(shortPin),"short bounded input wiped");
            Object proof=f.calibrate();byte[] a=ascii("1234"),b=ascii("1235");Object first=f.entry("fresh",a),second=f.entry("confirmation",b);
            check(zero(a)&&zero(b),"caller native owned entries consumed without String");
            denied(()->f.prepare(proof,first,second));check(!(Boolean)field(f.inspection,"sealed"),"known confirmation mismatch can retire");
            check(zero((byte[])field(first,"bytes"))&&zero((byte[])field(second,"bytes")),"independent confirmation internal bytes wiped");f.platform.wiped();}});
        run("material-one-use-and-original-transfer",()->{try(Fixture f=new Fixture()){
            Object proof=f.calibrate(),first=f.entry("fresh",ascii("1234")),second=f.entry("confirmation",ascii("1234")),material=f.prepare(proof,first,second);
            check(f.workers()==0&&f.transfers()==1&&materialBytes(material).length==96,"owned96B salt credential hash pending transfer");
            check((Boolean)field(proof,"consumed")&&field(f.context,"material")==material,"original proof consumed and wrapper bound");
            denied(()->f.prepare(proof,first,second));f.settle(material,"known");check(f.transfers()==0,"genuine fixture settlement alone consumes transfer");
            check(zero(materialBytes(material))&&zero(f.expected()),"material and context owned bytes wiped");f.retireKnown();f.platform.wiped();}});
        run("foreign-and-reconstructed-originals-denied",()->{try(Fixture a=new Fixture();Fixture b=new Fixture()){
            Object otherPrimitives=create("PinNativePrimitives",a.core,4,128,5000L,a.platform.proxy);
            denied(()->invoke(otherPrimitives,"context",a.session));check(field(a.inspection,"primitiveContext")==a.context,"one original context in core inspection");
            Object lookalike=create("PinPrimitiveContext",a.primitives,a.session,(byte[])field(a.session,"expected"),null,null);
            byte[] digits=ascii("1234");denied(()->invoke(a.primitives,"entry",lookalike,value("PinPrimitiveEntry","fresh"),digits));check(zero(digits),"lookalike rejection owns bounded input");
            denied(()->invoke(a.primitives,"calibrate",b.context));Object proof=a.calibrate(),foreign=b.calibrate();
            Object first=a.entry("fresh",ascii("1234")),second=a.entry("confirmation",ascii("1234"));
            denied(()->a.prepare(foreign,first,second));check(a.transfers()==0,"foreign receipt cannot publish material");invoke(proof,"close");invoke(lookalike,"close");}});
        run("mutating-pin-and-salt-callbacks-denied",()->{for(String mutation:new String[]{"pin","salt"})try(Fixture f=new Fixture()){
            f.platform.mutation=mutation;denied(f::calibrate);check(f.flag("sealed")&&f.workers()==0,"mutating actual callback denied before transfer");
            check(f.transfers()==0&&zero(f.expected()),"no mutated PIN/salt result retained");f.platform.wiped();}});
        run("whole-record-change-during-kdf-denied",()->{try(Fixture f=new Fixture()){
            f.platform.onDerive=a->{byte[] record=(byte[])field(f.scenario,"record");record[0]^=1;};
            denied(f::calibrate);check(f.flag("sealed")&&f.transfers()==0,"full record final-current detects change");f.platform.wiped();}});
        run("checkpoint-host-change-during-kdf-denied",()->{for(String change:new String[]{"epoch","host"})try(Fixture f=new Fixture()){
            f.platform.onDerive=a->set(f.scenario,change,change.equals("epoch")?id(333):5L);
            denied(f::calibrate);check(f.flag("sealed")&&f.transfers()==0,"authenticated coordinate change detected");f.platform.wiped();}});
        run("exclusive-deadline-and-clock-regression-denied",()->{
            try(Fixture f=new Fixture()){f.platform.onDerive=a->f.platform.nanos=60100000000L;denied(f::calibrate);check(f.transfers()==0,"original absolute deadline retained");f.platform.wiped();}
            try(Fixture f=new Fixture()){f.platform.onDerive=a->f.platform.step=-1000000L;denied(f::calibrate);check(f.transfers()==0,"native clock regression denied");f.platform.wiped();}});
        run("measured-budget-and-zero-progress-denied",()->{
            try(Fixture f=new Fixture()){f.platform.onDerive=a->f.platform.nanos+=5001000000L;denied(f::calibrate);check(f.platform.deriveCalls==1,"overbudget stops first actual sample");f.platform.wiped();}
            try(Fixture f=new Fixture()){f.platform.onDerive=a->f.platform.step=0;denied(f::calibrate);check(f.transfers()==0,"zero elapsed cannot calibrate");f.platform.wiped();}});
        run("cancel-blocked-kdf-retains-worker-and-buffers",()->{try(Fixture f=new Fixture()){
            CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);f.platform.onDerive=a->{entered.countDown();await(release);};
            AtomicReference<Throwable> error=new AtomicReference<>();Thread work=thread(()->denied(f::calibrate),error);await(entered);
            byte[] borrowed=f.platform.aliases.get(f.platform.aliases.size()-3);check(!zero(borrowed),"actual callback still owns PIN bytes");
            invoke(f.primitives,"cancel",f.context);check(f.workers()==1&&!zero(borrowed),"cancel revokes while real work remains");f.held();
            release.countDown();join(work,error);check(f.workers()==0&&zero(borrowed)&&zero(f.expected()),"wipe waits actual KDF return");f.platform.wiped();}});
        run("retire-blocked-clock-joins-actual-worker",()->{try(Fixture f=new Fixture()){
            CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);f.platform.onClock=a->{entered.countDown();await(release);};
            AtomicReference<Throwable> workError=new AtomicReference<>(),retireError=new AtomicReference<>();AtomicReference<Object> terminal=new AtomicReference<>();
            Thread work=thread(()->denied(f::calibrate),workError);await(entered);Thread retirement=thread(()->terminal.set(invoke(f.core,"retire",f.inspection)),retireError);
            waitFlag(f,"retiring");check(retirement.isAlive()&&f.workers()==1,"retire awaits real clock callback");f.held();
            release.countDown();join(work,workError);join(retirement,retireError);check(f.workers()==0&&f.transfers()==1,"only terminal close remains");
            int actualClocks=f.platform.clockCalls;invoke(f.core,"settleReply",terminal.get(),value("PinReplyDelivery","known"));
            check(f.platform.clockCalls==actualClocks,"no clock callback after actual worker settlement");}});
        run("commit-denied-while-primitive-worker-live",()->{try(Fixture f=new Fixture()){
            CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);f.platform.onDerive=a->{entered.countDown();await(release);};
            AtomicReference<Throwable> error=new AtomicReference<>();Thread work=thread(()->f.calibrate(),error);await(entered);
            byte[] next=(byte[])oldStatic("full",true,true);
            try{denied(()->invoke(f.scenario,"commitWith",next,null,field(f.session,"epoch"),field(f.session,"hostGeneration"),
                    field(f.session,"bootId"),field(f.session,"deadlineUptimeMs")));
                check(f.workers()==1&&field(f.inspection,"phase")==value("PinSessionPhase","begun"),"claim refusal preserves actual primitive worker/phase");
            }finally{Arrays.fill(next,(byte)0);release.countDown();}
            join(work,error);check(f.workers()==0&&(Integer)field(f.scenario,"writes")==0,"KDF settles without concurrent publication");f.platform.wiped();}});
        run("material-close-keeps-real-transfer-pending",()->{try(Fixture f=new Fixture()){
            Object material=f.prepared();invoke(material,"close");check(zero(materialBytes(material))&&f.transfers()==1,"close wipes but cannot acknowledge delivery");
            AtomicReference<Throwable> error=new AtomicReference<>();AtomicReference<Object> terminal=new AtomicReference<>();
            Thread retirement=thread(()->terminal.set(invoke(f.core,"retire",f.inspection)),error);waitFlag(f,"retiring");check(retirement.isAlive(),"retire waits original material transfer");f.held();
            f.settle(material,"known");join(retirement,error);f.held();invoke(f.core,"settleReply",terminal.get(),value("PinReplyDelivery","known"));}});
        run("material-original-identity-and-settlement-fence",()->{try(Fixture f=new Fixture()){
            Object material=f.prepared(),fake=create("PinPrimitiveMaterial",f.context,field(material,"backing"));denied(()->f.settle(fake,"known"));
            Object task=proxy("PinPrimitiveMaterialTask",a->{check(((byte[])a[0]).length==96,"private disposable material");
                denied(()->f.settle(material,"known"));check(f.workers()==1&&f.transfers()==1,"settlement refuses actual private callback worker");});
            invoke(material,"withBytes",task);f.settle(material,"known");denied(()->f.settle(material,"known"));check(f.transfers()==0,"original settlement one use");}});
        run("production-platform-fixed-and-policy-floor",()->{try(Fixture f=new Fixture()){
            Object real=create("PinNativePrimitives",f.core,4,128,5000L);check(field(real,"platform").getClass()==nested("RealPinPrimitivePlatform"),"real constructor fixed platform methods");
            check(field(field(f.context,"policy"),"iterations").equals(600000L),"production core floor unchanged");
            Object high=create("PinSessionPolicy","synthetic-session-v1",id(10),4294967295L,2147483648L);
            Object highCore=create("NativePinSessions",field(f.scenario,"io"),field(f.scenario,"authority"),field(f.scenario,"recovery"),high);
            denied(()->create("PinNativePrimitives",highCore,4,128,5000L,f.platform.proxy));
            f.platform.throwAt="unavailable";denied(f::calibrate);check(f.transfers()==0&&f.workers()==0,"absent fixed platform KDF fails closed without fallback");f.platform.wiped();}});
        run("callback-fault-and-material-mutation-wipes",()->{
            for(String fault:new String[]{"random","derive"})try(Fixture f=new Fixture()){f.platform.throwAt=fault;denied(f::calibrate);
                check(f.workers()==0&&f.transfers()==0&&zero(f.expected()),"fault settles and wipes no result");f.platform.wiped();}
            try(Fixture f=new Fixture()){Object material=f.prepared();AtomicReference<byte[]> alias=new AtomicReference<>();
                Object task=proxy("PinPrimitiveMaterialTask",a->{byte[] bytes=(byte[])a[0];alias.set(bytes);bytes[0]^=1;});
                denied(()->invoke(material,"withBytes",task));check(zero(alias.get())&&zero(materialBytes(material))&&f.transfers()==1,"mutating consumer wipes retains unknown transfer");f.held();}});
        run("local-callback-fence-and-final-full-record-check",()->{try(Fixture f=new Fixture()){
            f.platform.polls=1000;int[] callbackCounts={0,0};f.platform.onDerive=a->{callbackCounts[0]=f.callbacks();
                for(int i=0;i<64;i++)invoke(a[4],"check");callbackCounts[1]=f.callbacks();check(callbackCounts[0]==callbackCounts[1],"synthetic local checks never reread/decrypt full record");};
            f.calibrate();check(f.platform.deriveCalls==3&&f.callbacks()>callbackCounts[1],"final full native current still occurs");
            check(f.platform.clockCalls>3000,"real check callbacks accounted");f.platform.wiped();}});
        check(cases.size()==24,"exact focused primitive case scope");
        System.out.println("PRIVATE_PIN_PRIMITIVES_OK cases=24 assertions="+assertions.get());
        System.out.println("PRIVATE_PIN_PRIMITIVES_SCOPE synthetic-core=true platform-kdf=true native-input=false genuine-provider=false installed-os=false");
    }
}
