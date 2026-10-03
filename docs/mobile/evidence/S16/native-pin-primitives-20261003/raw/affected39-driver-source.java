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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;

/** B-only, explicit reflection factory for synthetic private-core mechanics.
 * NEVER constructs PlanetChildVault, Android storage, a production provider,
 * native PIN input/KDF, genuine checkpoint/action/recovery/time or host ACK.
 * Full frozen Java source is compiled separately against android.jar by root.
 * This source and its execution are NOT an installed-OS/authority acceptance.
 * NOT_RUN until an actual root receipt records compilation and this main. */
public final class PlanetChildNativePinSessionsJvmDriver {
    private static final String VERSION="synthetic-session-v1", POLICY=repeat('a',64), EPOCH=repeat('1',64);
    private static final String BOOT="00000000-0000-4000-8000-000000000001";
    private static final String CLOCK="{\"schemaVersion\":1,\"bootId\":\""+BOOT+"\",\"uptimeAnchorMs\":100,\"logicalAnchorMs\":1000,\"epochAnchor\":null}";
    private static final List<String> cases=new ArrayList<>(); private static int assertions;
    private interface Checked { void run() throws Exception; }
    private static void check(boolean yes,String label){if(!yes)throw new AssertionError(label);assertions++;}
    private static void run(String name,Checked body)throws Exception{body.run();cases.add(name);}
    private static void denied(Checked body)throws Exception{boolean no=false;try{body.run();}catch(Exception expected){no=true;}check(no,"expected denial");}
    private static String repeat(char c,int count){char[] chars=new char[count];Arrays.fill(chars,c);return new String(chars);}
    private static String sha(byte[] bytes)throws Exception{byte[] hash=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder out=new StringBuilder();
        try{for(byte b:hash)out.append("0123456789abcdef".charAt((b&255)>>>4)).append("0123456789abcdef".charAt(b&15));return out.toString();}finally{Arrays.fill(hash,(byte)0);}}
    private static byte[] utf8(String text){return text.getBytes(StandardCharsets.UTF_8);}
    private static boolean zero(byte[] bytes){for(byte b:bytes)if(b!=0)return false;return true;}
    private static String id(int n){return String.format(java.util.Locale.ROOT,"%064x",n);}
    private static Class<?> nested(String name)throws Exception{return Class.forName("ru.probpera.literaryplanet.PlanetChildVault$"+name);}
    private static Object create(String name,Object...args)throws Exception{for(Constructor<?> c:nested(name).getDeclaredConstructors())if(c.getParameterCount()==args.length){
        c.setAccessible(true);try{return c.newInstance(args);}catch(InvocationTargetException e){throw cause(e);}}throw new AssertionError("missing constructor "+name);}
    private static Exception cause(InvocationTargetException e){Throwable cause=e.getCause();if(cause instanceof Error)throw (Error)cause;return cause instanceof Exception?(Exception)cause:new Exception(cause);}
    private static Object invoke(Object owner,String name,Object...args)throws Exception{Class<?> type=owner instanceof Class<?>?(Class<?>)owner:owner.getClass();
        for(Method method:type.getDeclaredMethods())if(method.getName().equals(name)&&method.getParameterCount()==args.length){method.setAccessible(true);
            try{return method.invoke(owner instanceof Class<?>?null:owner,args);}catch(InvocationTargetException e){throw cause(e);}}
        throw new AssertionError("missing method "+name);}
    private static Object field(Object owner,String name)throws Exception{Field f=owner.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(owner);}
    @SuppressWarnings({"rawtypes","unchecked"}) private static Object enumValue(String type,String name)throws Exception{return Enum.valueOf((Class)nested(type),name);}
    private static Object objectMethod(Object proxy,Method method,Object[] args){switch(method.getName()){
        case "equals":return proxy==args[0];case "hashCode":return System.identityHashCode(proxy);case "toString":return "EXPLICIT_SYNTHETIC_PRIVATE_CORE_ONLY";default:throw new AssertionError(method);}}
    private static String pin(long revision,char credential,char salt,boolean reset){return "{\"schemaVersion\":1,\"policyVersion\":\""+VERSION+"\",\"revision\":"+revision
        +",\"credentialId\":\""+repeat(credential,64)+"\",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":600000,\"saltHex\":\""+repeat(salt,64)
        +"\",\"hashHex\":\""+repeat('d',64)+"\"},\"attempts\":{\"count\":"+(reset?0:2)+",\"blockedUntilMs\":"+(reset?0:1050)
        +",\"lastObservedMs\":1000,\"pendingAttemptId\":"+(reset?"null":"\""+repeat('9',64)+"\"")+"}}";}
    private static byte[] full(boolean seed,boolean next)throws Exception{String registry="{\"schemaVersion\":1,\"policyVersion\":\""+VERSION+"\",\"activeProfileId\":null,\"profiles\":[]}";
        return utf8("{\"schemaVersion\":1,\"revision\":"+(next?8:7)+",\"mode\":\"adult\",\"selectionRevision\":3,\"profileRevision\":2,\"policyChecksum\":\""+POLICY
            +"\",\"registryChecksum\":\""+sha(utf8(registry))+"\",\"registry\":"+registry+",\"pin\":"+(seed&&!next?"null":pin(next?(seed?1:6):5,next?'e':'b',next?'f':'c',next))+",\"clock\":"+CLOCK+"}");}

    private static final class Synthetic implements AutoCloseable {
        final ReentrantLock lock=new ReentrantLock(); final List<byte[]> callbackCopies=new ArrayList<>();
        final Object authority,recovery,io; Object core; final Object resetWitness=new Object(),recoveryWitness=new Object();
        byte[] record; String checkpoint; long checkpointRevision=7,uptime=100,host=4;
        String epoch=EPOCH,boot=BOOT,mutation,throwAt; boolean refuseAuthorize,nullReset,cancelAtWrite,corruptReadback;
        int writes,advances,cancels,retires; Object inspection,session,beginReply;
        CountDownLatch retireEntered,releaseRetire,captureEntered,releaseCapture,currentEntered,releaseCurrent;
        Synthetic(boolean seed,boolean recoveryAvailable)throws Exception{
            record=full(seed,false);checkpoint=sha(record);
            Class<?> authorityType=nested("PinSessionAuthority"),recoveryType=nested("PinRecoveryAuthority"),ioType=nested("PinSessionIO");
            authority=Proxy.newProxyInstance(authorityType.getClassLoader(),new Class<?>[]{authorityType},(proxy,method,args)->{
                if(method.getDeclaringClass()==Object.class)return objectMethod(proxy,method,args);
                String name=method.getName();if(name.equals(throwAt))throw new Exception("synthetic dependency fault");
                if(name.equals("capture")||name.equals("current")){
                    byte[] copy=(byte[])args[1];callbackCopies.add(copy);check(sha(copy).equals(args[2]),"callback digest");
                    check(checkpoint.equals(args[2])&&checkpointRevision==((Long)args[3]),"synthetic full checkpoint");
                    if(name.equals("capture")&&captureEntered!=null){captureEntered.countDown();await(releaseCapture);}
                    if(name.equals("current")&&currentEntered!=null){currentEntered.countDown();await(releaseCurrent);}
                    if(name.equals(mutation))copy[0]^=1;
                    return create("PinNativeCoordinates",proxy,epoch,boot,args[2],args[3],host,uptime,900+uptime);
                }
                if(name.equals("authorizeMutation")){
                    byte[] copy=(byte[])args[1];callbackCopies.add(copy);check(sha(copy).equals(args[2]),"reset exact next digest");
                    if(name.equals(mutation))copy[0]^=1;
                    if(refuseAuthorize)throw (Exception)create("PinKnownRefusal");return nullReset?null:resetWitness;
                }
                if(name.equals("advance")){check(args[1]==resetWitness,"original opaque reset witness");
                    check(args[2]==null||args[2]==recoveryWitness,"distinct recovery identity");check(advances==0,"synthetic one-use permission");
                    advances++;checkpoint=(String)args[3];checkpointRevision=(Long)args[4];return null;}
                if(name.equals("cancel")){cancels++;return null;}
                if(name.equals("retire")){retires++;if(retireEntered!=null){retireEntered.countDown();await(releaseRetire);}return null;}
                throw new AssertionError(name);
            });
            recovery=recoveryAvailable?Proxy.newProxyInstance(recoveryType.getClassLoader(),new Class<?>[]{recoveryType},(proxy,method,args)->{
                if(method.getDeclaringClass()==Object.class)return objectMethod(proxy,method,args);
                check(args[4]==recoveryWitness,"distinct original recovery witness");byte[] copy=(byte[])args[1];callbackCopies.add(copy);
                check(sha(copy).equals(args[2]),"recovery exact next digest");if("recovery".equals(mutation))copy[0]^=1;return null;
            }):null;
            io=Proxy.newProxyInstance(ioType.getClassLoader(),new Class<?>[]{ioType},(proxy,method,args)->{
                if(method.getDeclaringClass()==Object.class)return objectMethod(proxy,method,args);
                lock.lock();try{
                    Class<?> transactionType=nested("PinSessionTransaction");
                    Object transaction=Proxy.newProxyInstance(transactionType.getClassLoader(),new Class<?>[]{transactionType},(p,m,a)->{
                        if(m.getDeclaringClass()==Object.class)return objectMethod(p,m,a);
                        if(m.getName().equals("read")){byte[] result=record.clone();if(corruptReadback&&writes>0)result[0]^=1;return result;}
                        if(m.getName().equals("write")){
                            byte[] copy=(byte[])a[0];callbackCopies.add(copy);if("write".equals(mutation))copy[0]^=1;
                            invoke(a[1],"check");if(cancelAtWrite)invoke(core,"cancel",inspection);invoke(a[1],"check");
                            byte[] previous=record;record=copy.clone();Arrays.fill(previous,(byte)0);writes++;invoke(a[1],"check");return null;
                        }throw new AssertionError(m.getName());
                    });return invoke(args[0],"run",transaction);
                }finally{lock.unlock();}
            });
            Object policy=create("PinSessionPolicy",VERSION,POLICY,600000L,600000L);
            core=create("NativePinSessions",io,authority,recovery,policy);
        }
        Object inspect(String action)throws Exception{inspection=invoke(core,"inspection",id(1),enumValue("PinLifecycleAction",action),50L);return inspection;}
        void begin(String action)throws Exception{inspect(action);beginReply=invoke(core,"begin",inspection);session=field(beginReply,"session");}
        void settled(Object reply,String delivery)throws Exception{invoke(core,"settleReply",reply,enumValue("PinReplyDelivery",delivery));}
        void settleBegin()throws Exception{settled(beginReply,"known");}
        Object commit(byte[] next,Object recoveryPermission)throws Exception{return commitWith(next,recoveryPermission,EPOCH,4,BOOT,150);}
        Object commitWith(byte[] next,Object recoveryPermission,String suppliedEpoch,long suppliedHost,String suppliedBoot,long suppliedDeadline)throws Exception{
            byte[] expected=full(field(session,"revision").equals(7L)&&new String((byte[])field(session,"expected"),StandardCharsets.UTF_8).contains("\"pin\":null"),false);
            try{return invoke(core,"commit",inspection,session,expected,next,sha(expected),sha(next),7L,8L,suppliedEpoch,suppliedHost,suppliedBoot,suppliedDeadline,recoveryPermission);}
            finally{Arrays.fill(expected,(byte)0);}
        }
        Object retire()throws Exception{return invoke(core,"retire",inspection);}
        void closeKnown()throws Exception{Object reply=retire();check(field(core,"active")==inspection,"close transfer retains lane");settled(reply,"known");}
        void held()throws Exception{check(field(core,"active")==inspection,"exclusive lane held");denied(()->invoke(core,"inspection",id(2),enumValue("PinLifecycleAction","enroll"),50L));}
        void sealed()throws Exception{check((Boolean)field(inspection,"sealed"),"sticky sealed");held();}
        void wiped(){for(byte[] bytes:callbackCopies){boolean zero=true;for(byte b:bytes)zero&=b==0;check(zero,"dependency copy wiped after settlement");}}
        public void close(){Arrays.fill(record,(byte)0);}
    }
    private static void await(CountDownLatch latch)throws Exception{check(latch!=null&&latch.await(2,TimeUnit.SECONDS),"bounded synthetic latch");}
    private static Thread thread(Checked body,AtomicReference<Throwable> error){Thread t=new Thread(()->{try{body.run();}catch(Throwable e){error.set(e);}},"synthetic-pin-mechanics");t.setDaemon(true);t.start();return t;}
    private static void joined(Thread thread,AtomicReference<Throwable> error)throws Exception{thread.join(2000);check(!thread.isAlive(),"synthetic worker joined");if(error.get()!=null)throw new AssertionError("worker failed",error.get());}
    private static boolean inspectionFlag(Synthetic s,String name)throws Exception{synchronized(s.core){return (Boolean)field(s.inspection,name);}}
    private static void waitRetiring(Synthetic s)throws Exception{long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(2);while(!inspectionFlag(s,"retiring")&&System.nanoTime()<end)Thread.yield();check(inspectionFlag(s,"retiring"),"retirement entered");}
    public static void main(String[] args)throws Exception{
        run("production-factories-remain-unsupported",()->{check(invoke(PlanetChildVault.class,"actualSdkPinSessions",new Object[]{null})==null,"actual sessions absent");
            check(invoke(PlanetChildVault.class,"actualSdkCheckpoint",new Object[]{null})==null,"actual checkpoint absent");});
        for(String action:new String[]{"enroll","replace","recover"})run(action+"-captured-reset-later-time",()->{boolean seed=action.equals("enroll");try(Synthetic s=new Synthetic(seed,true)){
            s.begin(action);byte[] next=full(seed,true);try{byte[] caller=(byte[])invoke(s.beginReply,"copyBytes");caller[0]^=1;Arrays.fill(caller,(byte)0);
                s.settleBegin();s.uptime=110;Object reply=s.commit(next,action.equals("recover")?s.recoveryWitness:null);
                check(Arrays.equals(s.record,next)&&s.writes==1&&s.advances==1,"exact next published once");s.settled(reply,"known");s.closeKnown();check(field(s.core,"active")==null,"known close released");s.wiped();
            }finally{Arrays.fill(next,(byte)0);}}});
        for(String changed:new String[]{"epoch","host","boot","deadline"})run("caller-"+changed+"-denied",()->{try(Synthetic s=new Synthetic(false,true)){
            s.begin("replace");s.settleBegin();byte[] next=full(false,true);try{denied(()->s.commitWith(next,null,changed.equals("epoch")?repeat('2',64):EPOCH,
                changed.equals("host")?5:4,changed.equals("boot")?"00000000-0000-4000-8000-000000000002":BOOT,changed.equals("deadline")?151:150));
                check(s.writes==0&&s.advances==0,"changed coordinates did not publish");s.sealed();}finally{Arrays.fill(next,(byte)0);}}});
        run("whole-record-race-denied",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");s.settleBegin();s.record[0]^=1;byte[] next=full(false,true);
            try{denied(()->s.commit(next,null));check(s.writes==0&&s.advances==0,"whole record CAS race");s.sealed();}finally{Arrays.fill(next,(byte)0);}}});
        for(String change:new String[]{"epoch","host","boot","deadline","regression"})run("actual-"+change+"-denied",()->{try(Synthetic s=new Synthetic(false,true)){
            s.begin("replace");s.settleBegin();if(change.equals("epoch"))s.epoch=repeat('2',64);if(change.equals("host"))s.host=5;
            if(change.equals("boot"))s.boot="00000000-0000-4000-8000-000000000002";if(change.equals("deadline"))s.uptime=150;if(change.equals("regression"))s.uptime=99;
            byte[] next=full(false,true);try{denied(()->s.commit(next,null));check(s.writes==0&&s.advances==0,"actual coordinate denied before advance");s.sealed();}finally{Arrays.fill(next,(byte)0);}}});
        run("known-refusal-retires-through-close",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");s.settleBegin();s.refuseAuthorize=true;byte[] next=full(false,true);
            try{denied(()->s.commit(next,null));check(!(Boolean)field(s.inspection,"sealed"),"known prepublication refusal");s.closeKnown();check(field(s.core,"active")==null,"known refusal genuine retirement");}finally{Arrays.fill(next,(byte)0);}}});
        run("ordinary-reset-not-recovery",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("recover");s.settleBegin();byte[] next=full(false,true);
            try{denied(()->s.commit(next,null));check(s.advances==0&&s.writes==0,"missing distinct recovery denied");s.closeKnown();}finally{Arrays.fill(next,(byte)0);}}});
        run("recovery-dependency-missing",()->{try(Synthetic s=new Synthetic(false,false)){s.inspect("recover");denied(()->invoke(s.core,"begin",s.inspection));s.closeKnown();check(s.writes==0,"missing recovery unavailable");}});
        run("null-reset-witness-seals",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");s.settleBegin();s.nullReset=true;byte[] next=full(false,true);
            try{denied(()->s.commit(next,null));s.sealed();check(s.advances==0&&s.writes==0,"no permission publication");}finally{Arrays.fill(next,(byte)0);}}});
        for(String callback:new String[]{"capture","current","authorizeMutation","recovery","write"})run("mutating-"+callback+"-denied",()->{try(Synthetic s=new Synthetic(false,true)){
            if(callback.equals("capture")){s.mutation=callback;s.inspect("replace");denied(()->invoke(s.core,"begin",s.inspection));}
            else{s.begin(callback.equals("recovery")?"recover":"replace");s.settleBegin();s.mutation=callback;byte[] next=full(false,true);
                try{denied(()->s.commit(next,callback.equals("recovery")?s.recoveryWitness:null));}finally{Arrays.fill(next,(byte)0);}}
            check(s.writes==0,"mutated callback never published");s.sealed();s.wiped();}});
        run("close-does-not-settle-transfer",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");invoke(s.beginReply,"close");check((Integer)field(s.inspection,"transfers")==1,"close kept transfer");
            AtomicReference<Throwable> error=new AtomicReference<>();AtomicReference<Object> terminal=new AtomicReference<>();Thread t=thread(()->terminal.set(s.retire()),error);waitRetiring(s);
            check(t.isAlive()&&field(s.core,"active")==s.inspection,"retire awaits actual transfer");s.settleBegin();joined(t,error);s.held();s.settled(terminal.get(),"known");check(field(s.core,"active")==null,"terminal close known");}});
        run("unknown-close-sticky-capacity",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");s.settleBegin();Object terminal=s.retire();invoke(terminal,"close");s.held();
            s.settled(terminal,"uncertain");s.sealed();denied(()->s.settled(terminal,"known"));s.held();}});
        run("unknown-data-transfer-sticky-capacity",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");s.settled(s.beginReply,"uncertain");
            check((Boolean)field(s.session,"disposed"),"settled workers permit secret wipe");check(zero((byte[])field(s.session,"expected")),"unknown delivery wipes owned expected");
            Object terminal=s.retire();s.settled(terminal,"known");s.sealed();}});
        run("lost-transfer-wipes-keeps-pending-identity",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");invoke(s.core,"sealUnknown",s.inspection);
            check((Boolean)field(s.beginReply,"disposed")&&zero((byte[])field(s.beginReply,"bytes")),"lost reply owned bytes wiped");
            check((Integer)field(s.inspection,"transfers")==1&&((java.util.Set<?>)field(s.inspection,"pendingReplies")).contains(s.beginReply),"wiping preserves real pending transfer identity");
            denied(()->invoke(s.beginReply,"copyBytes"));s.held();s.settled(s.beginReply,"uncertain");Object terminal=s.retire();s.settled(terminal,"known");s.sealed();}});
        run("sealed-secret-wipe-waits-actual-worker",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");s.settleBegin();s.currentEntered=new CountDownLatch(1);s.releaseCurrent=new CountDownLatch(1);
            byte[] next=full(false,true);try{AtomicReference<Throwable> error=new AtomicReference<>();Thread committing=thread(()->denied(()->s.commit(next,null)),error);await(s.currentEntered);
                invoke(s.core,"sealUnknown",s.inspection);synchronized(s.core){check(!(Boolean)field(s.session,"disposed")&&!zero((byte[])field(s.session,"expected")),"actual worker keeps needed owned bytes");}
                check(s.record.length>0&&s.writes==0,"no publication on seal");s.releaseCurrent.countDown();joined(committing,error);
                check((Boolean)field(s.session,"disposed")&&zero((byte[])field(s.session,"expected")),"owned bytes wiped after actual worker settlement");s.sealed();s.wiped();
            }finally{Arrays.fill(next,(byte)0);}}});
        run("late-cancel-fenced-until-close",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");s.settleBegin();s.retireEntered=new CountDownLatch(1);s.releaseRetire=new CountDownLatch(1);
            AtomicReference<Throwable> error=new AtomicReference<>();AtomicReference<Object> terminal=new AtomicReference<>();Thread t=thread(()->terminal.set(s.retire()),error);await(s.retireEntered);
            invoke(s.core,"cancel",s.inspection);check(s.cancels==0&&(Integer)field(s.inspection,"workers")==0,"late cancel adds no unfenced work");s.held();s.releaseRetire.countDown();joined(t,error);
            s.held();s.settled(terminal.get(),"known");check(field(s.core,"active")==null&&s.retires==1,"whole-request retirement and close joined");}});
        run("cancel-before-begin-terminal",()->{try(Synthetic s=new Synthetic(true,true)){s.inspect("enroll");invoke(s.core,"cancel",s.inspection);denied(()->invoke(s.core,"begin",s.inspection));
            s.closeKnown();check(s.cancels==1&&field(s.core,"active")==null,"cancel terminal after known retirement");}});
        run("cancel-during-capture-owned-settlement",()->{try(Synthetic s=new Synthetic(false,true)){s.inspect("replace");s.captureEntered=new CountDownLatch(1);s.releaseCapture=new CountDownLatch(1);
            AtomicReference<Throwable> beginError=new AtomicReference<>();Thread beginning=thread(()->denied(()->invoke(s.core,"begin",s.inspection)),beginError);await(s.captureEntered);
            AtomicReference<Throwable> cancelError=new AtomicReference<>();Thread cancelling=thread(()->invoke(s.core,"cancel",s.inspection),cancelError);
            long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(2);while(!inspectionFlag(s,"cancelled")&&System.nanoTime()<end)Thread.yield();check(inspectionFlag(s,"cancelled"),"cancel entered while actual callback outstanding");
            check(field(s.core,"active")==s.inspection,"callback ownership retained");s.releaseCapture.countDown();joined(beginning,beginError);joined(cancelling,cancelError);s.closeKnown();s.wiped();}});
        run("cancel-after-advance-seals-no-repair",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");s.settleBegin();s.cancelAtWrite=true;byte[] next=full(false,true);
            try{denied(()->s.commit(next,null));check(s.advances==1&&s.writes==0,"checkpoint advance before cancelled publication");s.sealed();Object terminal=s.retire();s.settled(terminal,"known");s.sealed();}finally{Arrays.fill(next,(byte)0);}}});
        run("generic-dependency-fault-seals",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");s.settleBegin();s.throwAt="authorizeMutation";byte[] next=full(false,true);
            try{denied(()->s.commit(next,null));s.sealed();check(s.writes==0,"generic fault did not publish");}finally{Arrays.fill(next,(byte)0);}}});
        run("readback-mismatch-seals",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");s.settleBegin();s.corruptReadback=true;byte[] next=full(false,true);
            try{denied(()->s.commit(next,null));check(s.advances==1&&s.writes==1,"synthetic readback divergence after publication");s.sealed();}finally{Arrays.fill(next,(byte)0);}}});
        run("retirement-fault-retains-lane",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");s.settleBegin();s.throwAt="retire";denied(s::retire);s.sealed();
            check((Boolean)field(s.session,"disposed")&&zero((byte[])field(s.session,"expected")),"retirement failure wipes after joined workers");check((Integer)field(s.inspection,"transfers")==0,"no fabricated close receipt");}});
        run("original-inspection-and-session-only",()->{try(Synthetic a=new Synthetic(false,true);Synthetic b=new Synthetic(false,true)){a.begin("replace");b.begin("replace");
            denied(()->invoke(a.core,"cancel",b.inspection));check(!(Boolean)field(a.inspection,"cancelled"),"foreign cancellation cannot touch owner");
            byte[] next=full(false,true);try{byte[] expected=full(false,false);try{denied(()->invoke(a.core,"commit",a.inspection,b.session,expected,next,sha(expected),sha(next),7L,8L,EPOCH,4L,BOOT,150L,null));}
                finally{Arrays.fill(expected,(byte)0);}check(a.writes==0&&b.writes==0,"foreign original session denied");}finally{Arrays.fill(next,(byte)0);}}});
        run("constructor-lookalike-reply-not-pending",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");byte[] bytes=full(false,false);
            try{Object lookalike=create("PinNativeReply",s.core,s.session,bytes,sha(bytes));denied(()->s.settled(lookalike,"known"));
                check((Integer)field(s.inspection,"transfers")==1,"lookalike did not settle original transfer");invoke(lookalike,"close");s.settleBegin();s.closeKnown();}
            finally{Arrays.fill(bytes,(byte)0);}}});
        run("commit-original-session-one-use",()->{try(Synthetic s=new Synthetic(false,true)){s.begin("replace");s.settleBegin();byte[] next=full(false,true);
            try{Object reply=s.commit(next,null);s.settled(reply,"known");denied(()->s.commit(next,null));check(s.writes==1&&s.advances==1,"commit replay did not repeat publication");s.closeKnown();}
            finally{Arrays.fill(next,(byte)0);}}});
        run("no-eviction-capacity-and-replay",()->{try(Synthetic s=new Synthetic(true,true)){s.inspect("enroll");for(int n=2;n<=2048;n++){final int fresh=n;denied(()->invoke(s.core,"inspection",id(fresh),enumValue("PinLifecycleAction","enroll"),50L));}
            check(((java.util.Set<?>)field(s.core,"usedWireIds")).size()==2048,"bounded burned IDs retained");s.closeKnown();
            denied(()->invoke(s.core,"inspection",id(1),enumValue("PinLifecycleAction","enroll"),50L));denied(()->invoke(s.core,"inspection",id(2049),enumValue("PinLifecycleAction","enroll"),50L));check(field(s.core,"active")==null,"capacity denies rather than evicts");}});
        System.out.println("PIN_SESSION_SYNTHETIC_CASES="+cases.size());
        System.out.println("PIN_SESSION_SYNTHETIC_ASSERTIONS="+assertions);
        for(String name:cases)System.out.println("PIN_SESSION_CASE_PASS="+name);
        System.out.println("PIN_SESSION_MECHANICS=PASS_PURE_JVM_SYNTHETIC");
        System.out.println("GENUINE_NATIVE_PROVIDER=NOT_IMPLEMENTED;VAULT_CONSTRUCTION=NOT_RUN;INSTALLED_OS=NOT_RUN");
    }
}
