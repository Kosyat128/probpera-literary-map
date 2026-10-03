package ru.probpera.literaryplanet;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;

/** B-only connected-property fixture, authored NOT_RUN. Synthetic locked IO,
 * checkpoint/host/time/cleanup callbacks and KDF explicitly confer no genuine
 * authority. NO real PBKDF2/oracle derivation, UI/vault construction, Gate
 * admission, native worker/clock or installed OS is exercised. Root alone
 * compiles/runs this exact new driver against the integrated actual classes. */
public final class PlanetChildPinHostReplayJvmDriver {
    private static final String VERSION="synthetic-verification-core-v1",POLICY=repeat('a'),HASH=repeat('d'),EPOCH=repeat('e');
    private static final String BOOT="00000000-0000-4000-8000-000000000001";
    private static final AtomicInteger assertions=new AtomicInteger();private static final List<String> cases=new ArrayList<>();
    private interface Checked {void run() throws Exception;}
    private static void check(boolean ok,String label){if(!ok)throw new AssertionError(label);assertions.incrementAndGet();}
    private static void run(String name,Checked body)throws Exception{body.run();cases.add(name);System.out.println("PRIVATE_PIN_HOST_REPLAY_CASE "+name);}
    private static void denied(Checked body)throws Exception{boolean rejected=false;try{body.run();}catch(Exception expected){rejected=true;}check(rejected,"checked refusal");}
    private static void await(CountDownLatch latch,String label)throws Exception{check(latch.await(3,TimeUnit.SECONDS),label);}
    private static String repeat(char value){char[] bytes=new char[64];Arrays.fill(bytes,value);return new String(bytes);}
    private static String id(int value){return String.format(Locale.ROOT,"%064x",value);}
    private static boolean zero(byte[] bytes){for(byte value:bytes)if(value!=0)return false;return true;}
    private static byte[] hex(String value){byte[] bytes=new byte[value.length()/2];for(int i=0;i<bytes.length;i++)bytes[i]=(byte)Integer.parseInt(value.substring(i*2,i*2+2),16);return bytes;}
    private static String sha(byte[] bytes)throws Exception{byte[] hash=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder result=new StringBuilder();
        try{for(byte value:hash)result.append(String.format(Locale.ROOT,"%02x",value&255));return result.toString();}finally{Arrays.fill(hash,(byte)0);}}
    private static Class<?> nested(String name)throws Exception{return Class.forName("ru.probpera.literaryplanet.PlanetChildVault$"+name);}
    private static Exception cause(InvocationTargetException error){Throwable value=error.getCause();if(value instanceof Error)throw(Error)value;return value instanceof Exception?(Exception)value:new Exception(value);}
    private static Object create(String name,Object...arguments)throws Exception{for(Constructor<?> method:nested(name).getDeclaredConstructors())if(method.getParameterCount()==arguments.length){
        method.setAccessible(true);try{return method.newInstance(arguments);}catch(InvocationTargetException error){throw cause(error);}}throw new AssertionError("missing constructor "+name);}
    private static Object invoke(Object owner,String name,Object...arguments)throws Exception{Class<?> type=owner instanceof Class<?>?(Class<?>)owner:owner.getClass();
        for(Method method:type.getDeclaredMethods())if(method.getName().equals(name)&&method.getParameterCount()==arguments.length){method.setAccessible(true);
            try{return method.invoke(owner instanceof Class<?>?null:owner,arguments);}catch(InvocationTargetException error){throw cause(error);}}throw new AssertionError("missing method "+name);}
    private static Object field(Object owner,String name)throws Exception{Field f=owner.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(owner);}
    private static Object enumeration(String type,String value)throws Exception{@SuppressWarnings({"rawtypes","unchecked"})Object result=Enum.valueOf((Class)nested(type),value);return result;}
    private static Object proxy(String type,java.lang.reflect.InvocationHandler callback)throws Exception{return Proxy.newProxyInstance(nested(type).getClassLoader(),new Class<?>[]{nested(type)},callback);}
    private static void close(Object value)throws Exception{if(value!=null)((AutoCloseable)value).close();}
    private static String registry(){return "{\"schemaVersion\":1,\"policyVersion\":\""+VERSION+"\",\"activeProfileId\":\"synthetic-child\",\"profiles\":["
        +"{\"id\":\"synthetic-child\",\"label\":\"Ребёнок😀\\ud800\",\"exactAge\":9,\"ageBand\":\"9-11\",\"locale\":\"ru\","
        +"\"ageConfirmedAt\":\"2026-10-01T12:00:00.000Z\",\"readingLevel\":null,\"allowedTopics\":null,\"blockedTopics\":[\"violence\"],"
        +"\"soundEnabled\":false,\"motion\":\"calm\",\"narrationEnabled\":false}]}";}
    private static byte[] record(long root,long pin,long count,long blocked,long observed,String pending)throws Exception{String registry=registry();byte[] bytes=registry.getBytes(StandardCharsets.UTF_8);String digest;
        try{digest=sha(bytes);}finally{Arrays.fill(bytes,(byte)0);}return ("{\"schemaVersion\":1,\"revision\":"+root+",\"mode\":\"child\",\"selectionRevision\":3,\"profileRevision\":2,"
        +"\"policyChecksum\":\""+POLICY+"\",\"registryChecksum\":\""+digest+"\",\"registry\":"+registry+",\"pin\":{\"schemaVersion\":1,\"policyVersion\":\""+VERSION+"\","
        +"\"revision\":"+pin+",\"credentialId\":\""+repeat('b')+"\",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":600000,\"saltHex\":\""+repeat('c')+"\","
        +"\"hashHex\":\""+HASH+"\"},\"attempts\":{\"count\":"+count+",\"blockedUntilMs\":"+blocked+",\"lastObservedMs\":"+observed+",\"pendingAttemptId\":"+(pending==null?"null":"\""+pending+"\"")+"}},"
        +"\"clock\":{\"schemaVersion\":1,\"bootId\":\""+BOOT+"\",\"uptimeAnchorMs\":100,\"logicalAnchorMs\":1000,\"epochAnchor\":null}}").getBytes(StandardCharsets.UTF_8);}
    private static byte[] replace(byte[] bytes,String old,String next){String text=new String(bytes,StandardCharsets.UTF_8);check(text.contains(old),"fixture replacement exists");return text.replace(old,next).getBytes(StandardCharsets.UTF_8);}
    private static Object policy(long[] delays)throws Exception{return create("PinVerificationPolicy",VERSION,POLICY,600000L,delays);}
    private static Object gate(int id,long deadline)throws Exception{return create("PinGateRequest",new Object(),id(id),"exit-child-mode",repeat('f'),
        create("PinGateContext","synthetic-child",VERSION,2L,7L,"child","active"),3L,deadline);}
    private static final class Job {
        final CountDownLatch done=new CountDownLatch(1);final AtomicReference<Throwable> error=new AtomicReference<>();final AtomicReference<Object> result=new AtomicReference<>();
        Job(Checked body){Thread thread=new Thread(()->{try{body.run();}catch(Throwable failure){error.set(failure);}finally{done.countDown();}},"synthetic-private-verification-core-only");thread.setDaemon(true);thread.start();}
        void finish(boolean rejected)throws Exception{await(done,"actual fixture job returned");if(rejected)check(error.get() instanceof Exception,"expected operation refused");
            else if(error.get()!=null)throw new AssertionError("unexpected fixture job failure",error.get());}
    }
    private static final class Fixture implements AutoCloseable {
        final ReentrantLock lock=new ReentrantLock();final Object io,authority,engine,policy,core;Object gate;
        final List<String> events=new ArrayList<>();final List<Job> jobs=new ArrayList<>();
        final AtomicInteger writes=new AtomicInteger(),derives=new AtomicInteger(),cancelCalls=new AtomicInteger(),retireCalls=new AtomicInteger(),currentCalls=new AtomicInteger(),readCalls=new AtomicInteger(),captureCalls=new AtomicInteger();
        final CountDownLatch captureEntered=new CountDownLatch(1),captureRelease=new CountDownLatch(1),engineEntered=new CountDownLatch(1),engineRelease=new CountDownLatch(1),retireEntered=new CountDownLatch(1),retireRelease=new CountDownLatch(1);
        final AtomicReference<byte[]> pinAlias=new AtomicReference<>(),saltAlias=new AtomicReference<>(),outputAlias=new AtomicReference<>();
        byte[] stored;String checkpoint,epoch=EPOCH,boot=BOOT;long revision=7,uptime=100,host=11,afterDeriveUptime=-1;Object expectedGate;
        boolean match=true,blockCapture,blockEngine,blockRetire,changeAfterDerive,reusePermission,failCapture,failRead;int failBeforeWrite,failAfterWrite,wrongReadbackStage,preDeliverFailure;
        String mutate;Object owned,input,reply,terminal;final Object repeatedPermission=new Object();
        Fixture()throws Exception{this(record(7,5,0,0,1000,null));}
        Fixture(byte[] initial)throws Exception{stored=initial.clone();Arrays.fill(initial,(byte)0);checkpoint=sha(stored);gate=gate(1,10000);expectedGate=gate;policy=policy(new long[]{10,100,1000});
            authority=proxy("PinVerificationAuthority",(self,method,args)->{switch(method.getName()){
                case "capture":check(args[0]==expectedGate,"capture exact original gate");event("capture");captureCalls.incrementAndGet();if(failCapture)throw new Exception("synthetic capture failure");captureEntered.countDown();if(blockCapture)await(captureRelease,"bounded synthetic capture return");
                    if("capture".equals(mutate))((byte[])args[1])[0]^=1;return point(self,(String)args[2],(Long)args[3]);
                case "current":currentCalls.incrementAndGet();if(preDeliverFailure>0)throw new Exception("synthetic delivery current failure");
                    check(args[0]==owned||owned==null,"same original lease for current");check(args[2].equals(checkpoint)&&(Long)args[3]==revision,"selected checkpoint matches current argument");
                    event("current-"+revision);if("current".equals(mutate))((byte[])args[1])[0]^=1;return point(self,(String)args[2],(Long)args[3]);
                case "authorizeTransition":check(args[0]==owned,"transition original lease");event("authorize-"+args[1]);
                    check(args[4].equals(sha((byte[])args[2]))&&args[5].equals(sha((byte[])args[3])),"exact transition hashes");
                    if("expected".equals(mutate))((byte[])args[2])[0]^=1;if("next".equals(mutate))((byte[])args[3])[0]^=1;return reusePermission?repeatedPermission:new Object();
                case "advance":check(args[0]==owned,"advance original lease");event("advance-"+args[2]);checkpoint=(String)args[3];revision=(Long)args[4];return null;
                case "cancel":check(args[0]==expectedGate&&args[1]==owned,"cleanup gate plus nullable original lease");cancelCalls.incrementAndGet();event("cancel");return null;
                case "retire":check(args[0]==expectedGate&&args[1]==owned,"retirement gate plus nullable original lease");retireCalls.incrementAndGet();retireEntered.countDown();event("retire");if(blockRetire)await(retireRelease,"bounded synthetic authority retirement");return null;
                default:throw new AssertionError("unexpected authority callback");}});
            Object transaction=proxy("PinSessionTransaction",(self,method,args)->{switch(method.getName()){
                case "read":readCalls.incrementAndGet();if(failRead)throw new Exception("synthetic read failure");event("read-"+revision);byte[] result=stored.clone();if(wrongReadbackStage==writes.get()&&wrongReadbackStage>0)result[0]^=1;return result;
                case "write":int stage=writes.incrementAndGet();byte[] next=(byte[])args[0];event("write-"+stage);
                    check(checkpoint.equals(sha(next)),"checkpoint advanced BEFORE record publication");invoke(args[1],"check");if(failBeforeWrite==stage)throw new Exception("synthetic before-persist fault");
                    Arrays.fill(stored,(byte)0);stored=next.clone();event("persist-"+stage);invoke(args[1],"check");if(failAfterWrite==stage)throw new Exception("synthetic after-persist fault");return null;
                default:throw new AssertionError("unexpected transaction callback");}});
            io=proxy("PinSessionIO",(self,method,args)->{check(method.getName().equals("locked"),"scoped locked IO");lock.lock();try{return invoke(args[0],"run",transaction);}finally{lock.unlock();}});
            engine=proxy("PinVerificationEngine",(self,method,args)->{check(method.getName().equals("derive"),"synthetic engine only");derives.incrementAndGet();event("derive");
                byte[] pin=(byte[])args[0],salt=(byte[])args[1],output=(byte[])args[3];pinAlias.set(pin);saltAlias.set(salt);outputAlias.set(output);
                check(writes.get()==1&&sha(stored).equals(checkpoint),"charged write plus exact persisted reservation precedes KDF");engineEntered.countDown();if(blockEngine)await(engineRelease,"bounded synthetic engine actual return");
                byte[] hash=hex(HASH);try{if(match)System.arraycopy(hash,0,output,0,32);}finally{Arrays.fill(hash,(byte)0);}if(changeAfterDerive){lock.lock();try{byte[] changed=replace(stored,"\"selectionRevision\":3","\"selectionRevision\":4");Arrays.fill(stored,(byte)0);stored=changed;}finally{lock.unlock();}}
                if(afterDeriveUptime>=0)uptime=afterDeriveUptime;
                invoke(args[4],"check");return null;});
            core=invoke(nested("NativePinVerification"),"syntheticFixture",io,authority,policy,engine);
        }
        void event(String value){synchronized(events){events.add(value);}}
        Object point(Object owner,String checksum,long revision)throws Exception{return create("PinVerificationCoordinates",owner,epoch,boot,checksum,revision,host,uptime,1000+uptime-100);}
        Object begin()throws Exception{owned=invoke(core,"begin",gate);return owned;}
        Object begin(Object original)throws Exception{gate=original;expectedGate=original;owned=null;return begin();}
        Object entry(byte[] bytes)throws Exception{Object raw=create("PinVerificationInput",bytes);try{input=invoke(core,"bindInput",owned,raw);return input;}catch(Exception failure){PlanetChildPinHostReplayJvmDriver.close(raw);throw failure;}}
        Object verify(byte[] bytes)throws Exception{entry(bytes);reply=invoke(core,"verify",owned,input);return reply;}
        String outcome()throws Exception{return invoke(reply,"mathematicalOutcome").toString();}
        void deliver(Object original,Checked callback)throws Exception{Object recipient=proxy("PinVerificationRecipient",(self,method,args)->{check(args[0]==original,"recipient exact original reply");callback.run();return null;});invoke(core,"deliver",original,recipient);}
        void settle(Object original,String delivery)throws Exception{invoke(core,"settleReply",original,enumeration("PinVerificationDelivery",delivery));}
        void knownReply()throws Exception{deliver(reply,()->{});settle(reply,"known");}
        Object retire()throws Exception{terminal=invoke(core,"retire",gate);return terminal;}
        void knownTerminal()throws Exception{retire();deliver(terminal,()->{});settle(terminal,"known");}
        Job job(Checked body){Job job=new Job(body);synchronized(jobs){jobs.add(job);}return job;}
        boolean sealed()throws Exception{synchronized(core){return(Boolean)field(field(core,"active"),"sealed");}}
        int workers()throws Exception{synchronized(core){return(Integer)field(field(core,"active"),"workers");}}
        boolean retiring()throws Exception{synchronized(core){return(Boolean)field(field(core,"active"),"retiring");}}
        byte[] snapshot(){lock.lock();try{return stored.clone();}finally{lock.unlock();}}
        public void close()throws Exception{captureRelease.countDown();engineRelease.countDown();retireRelease.countDown();
            List<Job> pending;synchronized(jobs){pending=new ArrayList<>(jobs);}for(Job job:pending)await(job.done,"fixture cleanup joins actual callbacks");
            Object active=field(core,"active");if(active!=null)invoke(core,"sealUnknown",field(active,"gate"));
            PlanetChildPinHostReplayJvmDriver.close(input);PlanetChildPinHostReplayJvmDriver.close(reply);
            PlanetChildPinHostReplayJvmDriver.close(terminal);lock.lock();try{Arrays.fill(stored,(byte)0);}finally{lock.unlock();}}
    }
    private static void waitRetiring(Fixture f)throws Exception{long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(3);while(!f.retiring()&&System.nanoTime()<deadline)Thread.yield();check(f.retiring(),"retire ownership fence observed under monitor");}
    private static void equalRecord(Fixture f,byte[] expected,String label)throws Exception{byte[] actual=f.snapshot();try{check(Arrays.equals(actual,expected),label);}finally{Arrays.fill(actual,(byte)0);Arrays.fill(expected,(byte)0);}}
    private static Object gate(Object host,int number)throws Exception{return create("PinGateRequest",host,id(number),"exit-child-mode",repeat('f'),
        create("PinGateContext","synthetic-child",VERSION,2L,7L,"child","active"),3L,10000L);}
    private static java.util.Set<?> ids(Fixture f)throws Exception{return(java.util.Set<?>)field(f.core,"usedIds");}
    private static java.util.Set<?> hosts(Fixture f)throws Exception{return(java.util.Set<?>)field(f.core,"usedHosts");}
    private static final class EqualHost {
        public boolean equals(Object other){return other instanceof EqualHost;}
        public int hashCode(){return 1;}
    }
    private static void acceptedFailure(boolean read)throws Exception{try(Fixture f=new Fixture()){
        Object host=field(f.gate,"originalHostChallenge");f.failRead=read;f.failCapture=!read;denied(f::begin);
        Object ticket=field(f.core,"active");check(ticket!=null&&f.sealed()&&f.workers()==0,"accepted failure keeps a settled-worker sticky lane");
        check(ids(f).size()==1&&ids(f).contains(id(1))&&hosts(f).size()==1&&hosts(f).contains(host),"accepted identity pair remains spent after failure");
        int reads=f.readCalls.get(),captures=f.captureCalls.get();Object alias=gate(host,2);denied(()->invoke(f.core,"begin",alias));
        check(field(f.core,"active")==ticket&&ids(f).size()==1&&!ids(f).contains(id(2))&&hosts(f).size()==1,"rejected replay never reserves a second pair or replaces the sealed lane");
        check(f.readCalls.get()==reads&&f.captureCalls.get()==captures&&reads==1&&captures==(read?0:1)&&f.writes.get()==0&&f.derives.get()==0,"failure and replay cause no extra IO, write or math");
    }}
    public static void main(String[] args)throws Exception {
        check(args.length==0,"no PIN/oracle/runtime arguments");
        run("same-original-host-new-id-after-known-terminal-is-rejected",()->{try(Fixture f=new Fixture()){
            Object host=field(f.gate,"originalHostChallenge");f.begin();f.knownTerminal();check(field(f.core,"active")==null,"actual known terminal delivery released the lane");
            int reads=f.readCalls.get(),captures=f.captureCalls.get();Object alias=gate(host,2);f.expectedGate=alias;f.owned=null;denied(()->invoke(f.core,"begin",alias));
            check(ids(f).size()==1&&!ids(f).contains(id(2))&&hosts(f).size()==1&&hosts(f).contains(host),"same original host cannot be renamed by a fresh request id");
            check(field(f.core,"active")==null&&f.readCalls.get()==reads&&f.captureCalls.get()==captures,"closed-host replay is refused before reserving a lane or entering IO");
        }});
        run("same-host-active-and-busy-distinct-host-do-not-burn-unused-id-or-host",()->{try(Fixture f=new Fixture()){
            Object originalHost=field(f.gate,"originalHostChallenge");f.begin();Object ticket=field(f.core,"active");Object freshHost=new Object();
            Object alias=gate(originalHost,2),busy=gate(freshHost,2);int reads=f.readCalls.get(),captures=f.captureCalls.get();
            denied(()->invoke(f.core,"begin",alias));denied(()->invoke(f.core,"begin",busy));
            check(ids(f).size()==1&&!ids(f).contains(id(2))&&hosts(f).size()==1&&!hosts(f).contains(freshHost),"active replay and ordinary busy refusal leave fresh id and host unspent");
            check(field(f.core,"active")==ticket&&f.workers()==0&&f.readCalls.get()==reads&&f.captureCalls.get()==captures,"busy refusal retains the exact active lane and enters no callback");
            f.knownTerminal();Object owned=f.begin(busy);check(field(owned,"gate")==busy&&ids(f).size()==2&&hosts(f).size()==2,"same previously busy original pair can begin after known terminal delivery");
            f.knownTerminal();
        }});
        run("equal-but-distinct-hosts-use-reference-identity",()->{try(Fixture f=new Fixture()){
            EqualHost first=new EqualHost(),second=new EqualHost();check(first!=second&&first.equals(second)&&first.hashCode()==second.hashCode(),"fixture hosts are equal values with distinct identity");
            f.begin(gate(first,1));f.knownTerminal();Object secondGate=gate(second,2);Object owned=f.begin(secondGate);
            check(field(owned,"gate")==secondGate&&hosts(f).size()==2&&hosts(f).contains(first)&&hosts(f).contains(second),"equal-but-distinct hosts retain independent strong identity entries");
            f.knownTerminal();Object replay=gate(first,3);f.expectedGate=replay;f.owned=null;denied(()->invoke(f.core,"begin",replay));check(!ids(f).contains(id(3))&&hosts(f).size()==2,"first exact identity remains spent after distinct-host acceptance");
        }});
        run("spent-id-new-host-refusal-does-not-burn-the-new-host",()->{try(Fixture f=new Fixture()){
            f.begin();f.knownTerminal();Object freshHost=new Object();denied(()->invoke(f.core,"begin",gate(freshHost,1)));
            check(ids(f).size()==1&&hosts(f).size()==1&&!hosts(f).contains(freshHost)&&field(f.core,"active")==null,"spent id rejects before consuming a distinct host or reserving a lane");
            Object accepted=gate(freshHost,2);Object owned=f.begin(accepted);check(field(owned,"gate")==accepted&&ids(f).size()==2&&hosts(f).size()==2,"previously rejected new host accepts a fresh id");f.knownTerminal();
        }});
        run("accepted-capture-failure-retains-spent-original-host-and-id",()->acceptedFailure(false));
        run("accepted-read-failure-retains-spent-original-host-and-id",()->acceptedFailure(true));
        run("original-host-registries-are-coordinator-local",()->{try(Fixture first=new Fixture();Fixture second=new Fixture()){
            Object sharedHost=new Object(),firstGate=gate(sharedHost,1),secondGate=gate(sharedHost,1);Object firstOwned=first.begin(firstGate),secondOwned=second.begin(secondGate);
            check(field(firstOwned,"owner")==first.core&&field(secondOwned,"owner")==second.core&&first.core!=second.core,"one exact host object can be owned independently by different coordinators");
            check(hosts(first).size()==1&&hosts(second).size()==1&&hosts(first).contains(sharedHost)&&hosts(second).contains(sharedHost),"each coordinator stores its own exact host identity");
            first.knownTerminal();second.knownTerminal();Object replay=gate(sharedHost,2);first.expectedGate=replay;first.owned=null;denied(()->invoke(first.core,"begin",replay));
            check(!ids(first).contains(id(2))&&ids(second).size()==1&&field(second.core,"active")==null,"local replay refusal does not mutate the other coordinator");
        }});
        run("exact-2048-id-and-host-budget-rejects-2049-before-lane-or-io",()->{try(Fixture f=new Fixture()){
            for(int number=1;number<=2048;number++){Object original=gate(new Object(),number);Object owned=f.begin(original);
                check(field(owned,"gate")==original&&ids(f).size()==number&&hosts(f).size()==number,"accepted original identity pair consumes exactly one bounded slot");f.knownTerminal();}
            check(field(f.core,"active")==null&&f.retireCalls.get()==2048&&ids(f).size()==2048&&hosts(f).size()==2048,"all 2048 accepted lanes closed through actual original terminal delivery");
            Object nextHost=new Object(),overflow=gate(nextHost,2049);int reads=f.readCalls.get(),captures=f.captureCalls.get(),retires=f.retireCalls.get();denied(()->invoke(f.core,"begin",overflow));
            check(ids(f).size()==2048&&hosts(f).size()==2048&&!ids(f).contains(id(2049))&&!hosts(f).contains(nextHost),"budget refusal atomically reserves neither id nor host 2049");
            check(field(f.core,"active")==null&&reads==2048&&captures==2048&&f.readCalls.get()==reads&&f.captureCalls.get()==captures&&f.retireCalls.get()==retires&&f.writes.get()==0&&f.derives.get()==0,"no overflow lane, IO, retirement, write or math is started");
        }});
        check(cases.size()==8,"exact new replay and bounded-budget case count");
        System.out.println("PRIVATE_PIN_HOST_REPLAY_OK cases=8 assertions="+assertions.get());
        System.out.println("PRIVATE_PIN_HOST_REPLAY_SCOPE synthetic-connected=true platform-kdf=false durable-store-proof=false native-ui=false genuine-provider=false installed-os=false parent-gate=false");
    }
}
