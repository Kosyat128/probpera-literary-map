package ru.probpera.literaryplanet;

import android.os.SystemClock;
import android.util.Base64;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.*;

/** PRIVATE typed-DTO dispatcher, not a plugin or admitted child factory.
 * The constructor transfers exclusive ownership of an actual data store.
 * The injected host must marshal own-data dictionaries, not coalesced raw JSON.
 * Wrapper duplicate JSON keys cannot be observed in a Map; raw envelope JSON
 * duplicate keys/UTF8/shape are validated by the store under its commit lock.
 * One native data job, one cancel side-call and one queued close are bounded.
 * At most 2048 data jobs and 4096 ordinary correlation IDs are retained without
 * eviction. A separate terminal close slot permits the 4097th ID to clean up.
 * Native Lease generation/nonce remain the actual immutable store values;
 * owner/lease tokens merely correlate the same constructor-owned instance.
 * JS current/callbacks/PIN/review/rights are never native commit authority.
 * Data CAS uses the original absolute elapsedRealtime deadline in operationUntil
 * under the durable store lock. Existing activate/retire controls can publish
 * before unavailable/cancellation: no control-commit deadline or rollback claim.
 * Controls have no cancellable store overload: a late created Lease is really
 * retired before unavailable; close cleanup runs even after its caller budget.
 * Strings handed to the host cannot be wiped; all owned byte copies are wiped.
 */
final class PlanetChildDataTransport {
    interface Completion { void complete(Map<String,Object> reply); }
    private static final long MAX_SAFE=9007199254740991L;
    private static final SecureRandom RANDOM=new SecureRandom();
    private final PlanetChildDataStore store;
    private final String ownerToken=token();
    private final Set<String> requests=new HashSet<>(), cancellations=new HashSet<>(), leaseTokens=new HashSet<>();
    private Job current; private Partition active; private Close pendingClose;
    private boolean identified,closing,closed,closeStarted,closeFinished,closeSucceeded;private int dataJobs;
    private static final class Partition {
        final PlanetChildDataStore.Lease lease; final PlanetChildDataStore.Scope scope; final Map<String,Object> scopeDTO;
        final String token,nonce; final long generation;
        Partition(PlanetChildDataStore.Lease lease,PlanetChildDataStore.Scope scope,Map<String,Object> scopeDTO,String token) {
            this.lease=lease;this.scope=scope;this.scopeDTO=scopeDTO;this.token=token;
            generation=lease.partitionGeneration();nonce=lease.partitionNonce();
        }
    }
    private static final class Job {
        final String method,id; final long deadline; final Completion completion;
        final Map<String,Object> input; final List<PlanetChildDataStore.ReadKey> reads=new ArrayList<>();
        final List<PlanetChildDataStore.Mutation> writes=new ArrayList<>();
        PlanetChildDataStore.Scope scope; Map<String,Object> scopeDTO; Partition partition;
        PlanetChildDataStore.Lease created; PlanetChildDataStore.Cancellation nativeCancellation;
        Thread thread; boolean cancelled,cancelSent,cancelInFlight,writesClosed,bodyDone;
        Job(String method,String id,long deadline,Map<String,Object> input,Completion completion) {
            this.method=method;this.id=id;this.deadline=deadline;this.input=input;this.completion=completion;
        }
    }
    private static final class Close {
        final String id;final long deadline;final Completion completion;
        Close(String id,long deadline,Completion completion){this.id=id;this.deadline=deadline;this.completion=completion;}
    }
    PlanetChildDataTransport(PlanetChildDataStore ownedStore) {
        if(ownedStore==null)throw new IllegalArgumentException("Explicit owned native partition store required");store=ownedStore;
    }
    private static void require(boolean value) throws PlanetChildDataStore.Unavailable {if(!value)throw new PlanetChildDataStore.Unavailable();}
    private static String token(){byte[] bytes=new byte[16];RANDOM.nextBytes(bytes);try{return hex(bytes);}finally{Arrays.fill(bytes,(byte)0);}}
    private static String hex(byte[] bytes){StringBuilder out=new StringBuilder(bytes.length*2);for(byte b:bytes)out.append("0123456789abcdef".charAt((b&255)>>>4)).append("0123456789abcdef".charAt(b&15));return out.toString();}
    private static String string(Object value,int maximum) throws Exception {require(value instanceof String && ((String)value).length()<=maximum);return(String)value;}
    private static String correlation(Object value) throws Exception {String text=string(value,32);require(text.matches("[a-f0-9]{32}"));return text;}
    private static long integer(Object value,long min,long max) throws Exception {
        require(value instanceof Integer || value instanceof Long || value instanceof Double);double number=((Number)value).doubleValue();
        require(!Double.isNaN(number)&&!Double.isInfinite(number)&&number==Math.rint(number)&&number>=min&&number<=max);return((Number)value).longValue();
    }
    private static Map<String,Object> record(Object value,String... fields) throws Exception {
        require(value instanceof Map);Map<?,?> input=(Map<?,?>)value;require(input.size()==fields.length);
        Set<String> allowed=new HashSet<>(Arrays.asList(fields));Map<String,Object> copy=new LinkedHashMap<>();int count=0;
        for(Map.Entry<?,?> entry:input.entrySet()){require(++count<=fields.length&&entry.getKey() instanceof String&&allowed.contains(entry.getKey())&&!copy.containsKey(entry.getKey()));copy.put((String)entry.getKey(),entry.getValue());}
        require(copy.size()==fields.length);return copy;
    }
    private static List<Object> array(Object value) throws Exception {
        require(value instanceof List && ((List<?>)value).size()<=PlanetChildDataStore.MAX_BATCH);List<Object> copy=new ArrayList<>();
        for(Object item:(List<?>)value){require(copy.size()<PlanetChildDataStore.MAX_BATCH);copy.add(item);}return copy;
    }
    private static Map<String,Object> response(String id,String status){Map<String,Object> out=new LinkedHashMap<>();out.put("version",1);out.put("requestId",id);out.put("status",status);return out;}
    private static Map<String,Object> immutable(Map<String,Object> input){return Collections.unmodifiableMap(input);}
    private static Map<String,Object> unavailable(String id){return immutable(response(id,"unavailable"));}
    private static void deliver(Completion completion,Map<String,Object> reply){try{completion.complete(reply);}catch(RuntimeException ignored){/* Lost host acknowledgement, never rollback. */}}
    private static long deadline(Object value) throws Exception {long timeout=integer(value,1,60000),now=SystemClock.elapsedRealtime();require(now>=0&&now<=MAX_SAFE-timeout);return now+timeout;}
    private static long remaining(long deadline) throws Exception {long now=SystemClock.elapsedRealtime();require(now>=0&&now<deadline);return deadline-now;}
    private void sealLocked(){closing=true;if(current!=null){current.cancelled=true;if(current.thread!=null)current.thread.interrupt();startCancel(current);}}
    private boolean fresh(String id){if(requests.size()>=4096){sealLocked();return false;}return requests.add(id);}
    private void owner(Object value,boolean unbound) throws Exception {require(value==null?unbound:ownerToken.equals(string(value,32)));}
    private static PlanetChildDataStore.Scope scope(Map<String,Object> dto) throws Exception {
        require(integer(dto.get("schemaVersion"),1,1)==1&&"child".equals(dto.get("namespace")));
        return new PlanetChildDataStore.Scope(string(dto.get("profileId"),96),integer(dto.get("profileRevision"),1,MAX_SAFE),(int)integer(dto.get("exactAge"),3,17),string(dto.get("locale"),2),
            string(dto.get("policyVersion"),96),string(dto.get("policyChecksum"),64),string(dto.get("packageId"),96),integer(dto.get("packageVersion"),1,MAX_SAFE),string(dto.get("packageChecksum"),64));
    }
    private static Map<String,Object> scopeDTO(Object value) throws Exception {return immutable(record(value,"schemaVersion","namespace","profileId","profileRevision","exactAge","locale","policyVersion","policyChecksum","packageId","packageVersion","packageChecksum"));}
    private Map<String,Object> bound(String id,String status,Partition partition){Map<String,Object> out=response(id,status);out.put("ownerToken",ownerToken);out.put("leaseToken",partition.token);out.put("scope",partition.scopeDTO);out.put("generation",partition.generation);out.put("nonce",partition.nonce);return out;}
    private static PlanetChildDataStore.Purpose purpose(Object value) throws Exception {String text=string(value,7);for(PlanetChildDataStore.Purpose purpose:PlanetChildDataStore.Purpose.values())if(purpose.name().equals(text))return purpose;throw new PlanetChildDataStore.Unavailable();}
    private static int sextet(char ch){if(ch>='A'&&ch<='Z')return ch-'A';if(ch>='a'&&ch<='z')return ch-'a'+26;if(ch>='0'&&ch<='9')return ch-'0'+52;if(ch=='+')return 62;if(ch=='/')return 63;return-1;}
    /** Validate exact encoded/decoded limits and padding bits BEFORE allocation. */
    private static int decodedSize(String encoded,int remaining) throws Exception {
        int length=encoded.length();require(length>=4&&length%4==0&&length<=4*((PlanetChildDataStore.MAX_VALUE_BYTES+2)/3));
        int padding=encoded.charAt(length-1)=='='?(encoded.charAt(length-2)=='='?2:1):0;
        for(int index=0;index<length-padding;index++)require(sextet(encoded.charAt(index))>=0);
        for(int index=length-padding;index<length;index++)require(encoded.charAt(index)=='=');
        require(padding!=2||(sextet(encoded.charAt(length-3))&15)==0);require(padding!=1||(sextet(encoded.charAt(length-2))&3)==0);
        int bytes=(length/4)*3-padding;require(bytes>0&&bytes<=PlanetChildDataStore.MAX_VALUE_BYTES&&bytes<=remaining);return bytes;
    }
    private void prepare(Job job) throws Exception {
        Map<String,Object> input=job.input;job.scopeDTO=scopeDTO(input.get("scope"));job.scope=scope(job.scopeDTO);remaining(job.deadline);
        synchronized(this){require(!job.cancelled&&!closing);if(job.method.equals("activate")){owner(input.get("ownerToken"),!identified);}
            else {owner(input.get("ownerToken"),false);Partition partition=active;require(partition!=null&&partition.token.equals(correlation(input.get("leaseToken")))
                &&partition.generation==integer(input.get("generation"),1,MAX_SAFE-1)&&partition.nonce.equals(correlation(input.get("nonce")))
                &&partition.scope.key(PlanetChildDataStore.Purpose.search).equals(job.scope.key(PlanetChildDataStore.Purpose.search)));job.partition=partition;}}
        if(!job.method.equals("transact"))return;
        List<Object> reads=array(input.get("reads")),writes=array(input.get("writes"));
        require(reads.size()+writes.size()>0&&reads.size()+writes.size()<=PlanetChildDataStore.MAX_BATCH);
        Set<String> readKeys=new HashSet<>(),writeKeys=new HashSet<>();
        for(Object raw:reads){Map<String,Object> row=record(raw,"purpose","key");PlanetChildDataStore.Purpose purpose=purpose(row.get("purpose"));String key=string(row.get("key"),4096);
            require(readKeys.add(purpose.name()+"\n"+key));job.reads.add(new PlanetChildDataStore.ReadKey(purpose,key));}
        int ownedBytes=0;
        for(Object raw:writes){remaining(job.deadline);Map<String,Object> row=record(raw,"purpose","key","expectedRevision","base64","checksum");
            PlanetChildDataStore.Purpose purpose=purpose(row.get("purpose"));String key=string(row.get("key"),4096),checksum=string(row.get("checksum"),64);
            require(checksum.matches("[a-f0-9]{64}")&&writeKeys.add(purpose.name()+"\n"+key));long revision=integer(row.get("expectedRevision"),0,MAX_SAFE-2);
            String encoded=string(row.get("base64"),4*((PlanetChildDataStore.MAX_VALUE_BYTES+2)/3));int size=decodedSize(encoded,PlanetChildDataStore.MAX_SNAPSHOT_BYTES-ownedBytes);
            byte[] bytes=Base64.decode(encoded,Base64.NO_WRAP),digest=null;
            try{require(bytes.length==size);digest=MessageDigest.getInstance("SHA-256").digest(bytes);require(checksum.equals(hex(digest)));
                synchronized(this){require(!job.cancelled&&!closing);}job.writes.add(new PlanetChildDataStore.Mutation(purpose,key,revision,bytes));ownedBytes+=size;
            }finally{Arrays.fill(bytes,(byte)0);if(digest!=null)Arrays.fill(digest,(byte)0);}}
    }
    /** Typed DTO entry only. Invalid correlation throws before scheduling. */
    void dispatch(String method,Map<String,?> input,Completion completion) throws Exception {
        if(completion==null)throw new IllegalArgumentException("Explicit owned completion required");
        String id=correlation(input==null?null:input.get("requestId"));Map<String,Object> dto;
        try{
            if("cancel".equals(method)){dto=record(input,"version","requestId","targetRequestId");require(integer(dto.get("version"),1,1)==1);cancel(id,correlation(dto.get("targetRequestId")),completion);return;}
            if("close".equals(method)){dto=record(input,"version","requestId","timeoutMs","ownerToken");require(integer(dto.get("version"),1,1)==1);enqueueClose(id,deadline(dto.get("timeoutMs")),dto.get("ownerToken"),completion);return;}
            if("activate".equals(method))dto=record(input,"version","requestId","timeoutMs","ownerToken","scope");
            else if("transact".equals(method))dto=record(input,"version","requestId","timeoutMs","ownerToken","leaseToken","scope","generation","nonce","reads","writes");
            else if("retire".equals(method))dto=record(input,"version","requestId","timeoutMs","ownerToken","leaseToken","scope","generation","nonce");
            else throw new PlanetChildDataStore.Unavailable();
            require(integer(dto.get("version"),1,1)==1);Job job=new Job(method,id,deadline(dto.get("timeoutMs")),dto,completion);
            synchronized(this){if(dataJobs>=2048)sealLocked();require(!closing&&!closed&&current==null&&fresh(id)&&!cancellations.contains(id));dataJobs++;current=job;}
            try{prepare(job);Thread worker=new Thread(()->work(job),"LiteraryPlanet-child-partition");boolean cancelled;
                synchronized(this){job.thread=worker;cancelled=job.cancelled||closing;if(!cancelled)worker.start();}
                if(cancelled)finish(job,unavailable(id));}
            catch(Exception failure){finish(job,unavailable(id));}
        }catch(Exception malformed){deliver(completion,unavailable(id));startClose();}
    }
    private void cancel(String id,String target,Completion completion) throws Exception {
        Job job; synchronized(this){if(!cancellations.contains(target)&&cancellations.size()>=2048)sealLocked();require(!closed&&fresh(id)&&(cancellations.contains(target)||cancellations.size()<2048));cancellations.add(target);job=current;
            if(job!=null&&job.id.equals(target)){job.cancelled=true;if(job.thread!=null)job.thread.interrupt();startCancel(job);}}
        Map<String,Object> reply=response(id,"cancellation-requested");reply.put("targetRequestId",target);deliver(completion,immutable(reply));
    }
    /** At most one native cancellation call; it never acknowledges completion. */
    private void startCancel(Job job){
        if(job.bodyDone||job.nativeCancellation==null||job.cancelSent)return;job.cancelSent=true;job.cancelInFlight=true;
        new Thread(()->{try{store.cancel(job.nativeCancellation);}catch(Exception ignored){/* Original work remains latched cancelled. */}
            finally{synchronized(PlanetChildDataTransport.this){job.cancelInFlight=false;PlanetChildDataTransport.this.notifyAll();}}},"LiteraryPlanet-child-cancel").start();
    }
    private void live(Job job) throws Exception {remaining(job.deadline);synchronized(this){require(current==job&&!job.cancelled&&!closing);}}
    private void work(Job job){Map<String,Object> reply=unavailable(job.id);
        try{
            live(job);
            if(job.method.equals("activate")){
                job.created=store.activate(job.scope);live(job);String leaseToken;
                synchronized(this){leaseToken=token();for(int tries=0;leaseTokens.contains(leaseToken)&&tries<16;tries++)leaseToken=token();require(leaseTokens.size()<4096&&leaseTokens.add(leaseToken));}
                Partition partition=new Partition(job.created,job.scope,job.scopeDTO,leaseToken);require(partition.generation>0&&partition.generation<MAX_SAFE&&partition.nonce.matches("[a-f0-9]{32}"));
                synchronized(this){require(!closing&&!job.cancelled);active=partition;identified=true;}reply=immutable(bound(job.id,"partitioned",partition));
            }else if(job.method.equals("retire")){
                synchronized(this){require(active==job.partition);active=null;}store.retire(job.partition.lease);live(job);reply=immutable(bound(job.id,"retired",job.partition));
            }else{
                PlanetChildDataStore.Cancellation operation=store.operationUntil(job.partition.lease,job.deadline);
                synchronized(this){job.nativeCancellation=operation;if(job.cancelled||closing)startCancel(job);}live(job);
                try(PlanetChildDataStore.Result result=store.transact(job.partition.lease,job.reads,job.writes,operation)){
                    live(job);List<Object> slots=new ArrayList<>();int ownedBytes=0;
                    for(PlanetChildDataStore.ReadKey read:job.reads){PlanetChildDataStore.Slot slot=result.get(read.purpose,read.key);require(slot!=null&&slot.revision>=0&&slot.revision<MAX_SAFE);
                        byte[] bytes=slot.copyValue();try{Map<String,Object> dto=new LinkedHashMap<>();dto.put("purpose",read.purpose.name());dto.put("key",read.key);dto.put("revision",slot.revision);
                            if(bytes==null){require(slot.revision==0&&slot.checksum==null);dto.put("base64",null);dto.put("checksum",null);}
                            else{require(slot.revision>0&&bytes.length>0&&bytes.length<=PlanetChildDataStore.MAX_VALUE_BYTES&&bytes.length<=PlanetChildDataStore.MAX_SNAPSHOT_BYTES-ownedBytes);ownedBytes+=bytes.length;
                                dto.put("base64",Base64.encodeToString(bytes,Base64.NO_WRAP));dto.put("checksum",slot.checksum);}slots.add(immutable(dto));
                        }finally{if(bytes!=null)Arrays.fill(bytes,(byte)0);}}
                    // Recheck the actual native generation/nonce under its lock
                    // after reply encoding, while preserving the original deadline.
                    store.operationUntil(job.partition.lease,job.deadline);live(job);Map<String,Object> out=bound(job.id,"committed",job.partition);out.put("slots",Collections.unmodifiableList(slots));reply=immutable(out);
                }
            }
        }catch(Exception denied){reply=unavailable(job.id);}
        finally{Thread.interrupted();finish(job,reply);}
    }
    private void finish(Job job,Map<String,Object> reply){
        synchronized(this){job.bodyDone=true;}
        if(!job.writesClosed){for(PlanetChildDataStore.Mutation write:job.writes)write.close();job.writesClosed=true;}
        boolean allowed,cleanup;
        synchronized(this){while(job.cancelInFlight){try{wait();}catch(InterruptedException ignored){/* Wait for the actual owned cancel call. */}}
            try{live(job);allowed=!"unavailable".equals(reply.get("status"));}catch(Exception expired){allowed=false;}
            cleanup=!allowed&&job.created!=null;if(!cleanup&&current==job)current=null;}
        if(cleanup){Thread.interrupted();try{store.retire(job.created);}catch(Exception unknown){synchronized(this){closing=true;}}
            synchronized(this){if(active!=null&&active.lease==job.created)active=null;job.created=null;if(current==job)current=null;}}
        deliver(job.completion,allowed?reply:unavailable(job.id));startClose();
    }
    private void enqueueClose(String id,long deadline,Object owner,Completion completion) throws Exception {
        Close immediate=null;
        synchronized(this){owner(owner,true);require(pendingClose==null&&requests.size()<=4096&&requests.add(id));pendingClose=new Close(id,deadline,completion);sealLocked();if(closeFinished)immediate=pendingClose;}
        if(immediate!=null){deliverClose(immediate);return;}
        startClose();
    }
    private void deliverClose(Close close){Map<String,Object> reply=unavailable(close.id);synchronized(this){if(closeSucceeded){Map<String,Object> out=response(close.id,"closed");out.put("ownerToken",ownerToken);reply=immutable(out);}}deliver(close.completion,reply);}
    private void startClose(){synchronized(this){if(!closing||closeStarted||current!=null)return;closeStarted=true;}
        new Thread(()->{boolean success=false;Close close;
            try{store.close();success=true;}catch(Exception denied){/* Retain the first durable close failure; a later no-op must not promote it. */}
            synchronized(PlanetChildDataTransport.this){active=null;closed=true;closeFinished=true;closeSucceeded=success;close=pendingClose;}
            // Exhaustion closes the real owner even before a terminal request.
            // A later reserved close reuses the factual first cleanup outcome.
            // A late success never changes the outer caller's expired result.
            if(close!=null)deliverClose(close);
        },"LiteraryPlanet-child-close").start();
    }
}
