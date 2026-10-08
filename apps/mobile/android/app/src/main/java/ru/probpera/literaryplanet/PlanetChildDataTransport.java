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

    /** Separately typed LOCAL2 App input. Parsing cannot manufacture native
     * admission, PIN proof, clock samples, package pins, UID or write receipts. */
    static final class V2Request {
        final String method,id,contextToken,action,collection,query,shelf;
        final Map<String,Object> target,reference,owner,layout;final String assetId,presentationToken;
        final String sceneId,sceneToken,slotId,resourceToken,journeyId,currentNodeId,tier;
        final List<Map<String,Object>> references;
        final PlanetChildReadingPosition.Record readingPosition;final long expectedRevision,offset,childLocaleGeneration;final String childLocaleProfileId,childLocale;final int byteLength;
        private V2Request(String method,String id,String token,String action,Map<String,Object> target,
            Map<String,Object> reference,String collection,String query,long revision,List<Map<String,Object>> refs,Map<String,Object> owner,Map<String,Object> layout,String assetId,String presentationToken,String sceneId,String sceneToken,String slotId,String resourceToken,String journeyId,String currentNodeId,String shelf,String tier,long offset,int byteLength,long childLocaleGeneration,String childLocaleProfileId,String childLocale,PlanetChildReadingPosition.Record readingPosition) {
            this.method=method;this.id=id;contextToken=token;this.action=action;this.target=target;this.reference=reference;
            this.collection=collection;this.query=query;expectedRevision=revision;references=refs;this.owner=owner;this.layout=layout;this.assetId=assetId;this.presentationToken=presentationToken;this.sceneId=sceneId;this.sceneToken=sceneToken;this.slotId=slotId;this.resourceToken=resourceToken;this.journeyId=journeyId;this.currentNodeId=currentNodeId;this.shelf=shelf;this.tier=tier;this.offset=offset;this.byteLength=byteLength;this.childLocaleGeneration=childLocaleGeneration;this.childLocaleProfileId=childLocaleProfileId;this.childLocale=childLocale;this.readingPosition=readingPosition;
        }
    }
    private static long v2Integer(Object value,long min,long max) throws Exception {
        require(value instanceof Integer||value instanceof Long||value instanceof Double);
        double n=((Number)value).doubleValue();
        require(Double.isFinite(n)&&n==Math.rint(n)&&n>=min&&n<=max&&Double.doubleToRawLongBits(n)!=Double.doubleToRawLongBits(-0.0d));
        return ((Number)value).longValue();
    }
    private static final Set<String> V2_TEXT_KINDS=Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
        "country","writer","biography","work","character","storyworld","fact","quote","activity","quiz",
        "search-result","recommendation","favorite","recent","offline-package","deep-link")));
    private static final Set<String> V2_ACTIONS=Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
        "first-install","enroll-pin","replace-pin","recover-pin","create-profile","enter-child",
        "exit-child-mode","switch-adult-profile","change-exact-age","change-blocked-topics","open-adult-store","initiate-purchase","restore-purchases",
        "open-external","share","account-change","export-child-data","delete-child-data","diagnostics","expand-access-settings","enable-licensed-pack","view-legal-commercial")));
    private static Map<String,Object> v2Reference(Object value) throws Exception {
        Map<String,Object> ref=record(value,"kind","id","contentChecksum");
        String kind=string(ref.get("kind"),32),id=string(ref.get("id"),96),sum=string(ref.get("contentChecksum"),64);
        require(V2_TEXT_KINDS.contains(kind)&&id.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,95}")&&sum.matches("[a-f0-9]{64}"));
        return immutable(ref);
    }
    private static Object v2Copy(Object value,int depth,int[] nodes) throws Exception {
        require(depth<=12&&++nodes[0]<=4096);
        if(value==null||value instanceof Boolean)return value;
        if(value instanceof String){String text=(String)value;require(text.length()<=32768&&!text.matches("(?s).*[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f].*"));return text;}
        if(value instanceof Number)return v2Integer(value,0,MAX_SAFE-1);
        if(value instanceof List){List<?> values=(List<?>)value;require(values.size()<=64);List<Object> out=new ArrayList<>();for(Object item:values)out.add(v2Copy(item,depth+1,nodes));return Collections.unmodifiableList(out);}
        require(value instanceof Map);Map<?,?> values=(Map<?,?>)value;require(values.size()<=64);Map<String,Object> out=new LinkedHashMap<>();
        for(Map.Entry<?,?> item:values.entrySet()){require(item.getKey() instanceof String);String key=(String)item.getKey();require(key.matches("[A-Za-z][A-Za-z0-9]{0,63}")&&!out.containsKey(key));out.put(key,v2Copy(item.getValue(),depth+1,nodes));}
        return immutable(out);
    }
    @SuppressWarnings("unchecked")
    static V2Request decodeV2(String method,Map<String,?> value) throws Exception {
        String id=correlation(value==null?null:value.get("requestId")),token=null,action=null,collection=null,query=null;
        Map<String,Object> target=null,reference=null,owner=null,layout=null;String assetId=null,presentationToken=null,sceneId=null,sceneToken=null,slotId=null,resourceToken=null,journeyId=null,currentNodeId=null,shelf=null,tier=null;List<Map<String,Object>> references=null;long revision=0,offset=0;int byteLength=0;
        Map<String,Object> row;
        if("bootstrap".equals(method))row=record(value,"version","requestId");
        else if("retire".equals(method)||"readContext".equals(method))row=record(value,"version","requestId","contextToken");
        else if("perform".equals(method))row=record(value,"version","requestId","contextToken","action","target");
        else if("changeChildLocale".equals(method))row=record(value,"version","requestId","contextToken","generation","profileId","expectedProfileRevision","locale");
        else if("readEntity".equals(method)||"recordCountryOpen".equals(method))row=record(value,"version","requestId","contextToken","reference");
        else if("readPassport".equals(method))row=record(value,"version","requestId","contextToken");
        else if("listDiscovery".equals(method))row=record(value,"version","requestId","contextToken","shelf");
        else if("search".equals(method))row=record(value,"version","requestId","contextToken","query");else if("listMedia".equals(method))row=record(value,"version","requestId","contextToken","owner");else if("presentMedia".equals(method))row=record(value,"version","requestId","contextToken","owner","assetId","layout");else if("resumeNarration".equals(method))row=record(value,"version","requestId","contextToken","owner","assetId","layout","expectedReadingRevision");else if("releaseMedia".equals(method))row=record(value,"version","requestId","contextToken","presentationToken");
        else if(Arrays.asList("listJourneys","readJourneyProgress","closeJourney").contains(method))row=record(value,"version","requestId","contextToken");
        else if("readJourneyRouteDownload".equals(method))row=record(value,"version","requestId","contextToken","journeyId");
        else if(Arrays.asList("openJourney","saveJourneyRoute","resumeJourneyRoute","cancelJourneyRoute").contains(method))row=record(value,"version","requestId","contextToken","journeyId","expectedRevision");
        else if("advanceJourney".equals(method))row=record(value,"version","requestId","contextToken","journeyId","expectedRevision","currentNodeId","action");
        else if("readSceneSelection".equals(method))row=record(value,"version","requestId","contextToken");
        else if("rememberSceneSelection".equals(method)||"rollbackSceneSelection".equals(method))row=record(value,"version","requestId","contextToken","sceneToken","expectedRevision");
        else if("restoreSceneSelection".equals(method))row=record(value,"version","requestId","contextToken","expectedRevision");
        else if("listScenes".equals(method))row=record(value,"version","requestId","contextToken","owner");
        else if("openScene".equals(method))row=record(value,"version","requestId","contextToken","owner","sceneId");
        else if("releaseScene".equals(method))row=record(value,"version","requestId","contextToken","sceneToken");
        else if("acquireWebResource".equals(method))row=value!=null&&value.containsKey("assetId")?record(value,"version","requestId","contextToken","sceneToken","slotId","assetId","tier"):record(value,"version","requestId","contextToken","sceneToken","slotId");
        else if("releaseWebResource".equals(method))row=record(value,"version","requestId","contextToken","resourceToken");
        else if("readWebResourceChunk".equals(method))row=record(value,"version","requestId","contextToken","sceneToken","resourceToken","offset","byteLength");
        else if("readReadingPosition".equals(method))row=record(value,"version","requestId","contextToken","reference");
        else if("rememberReadingPosition".equals(method))row=record(value,"version","requestId","contextToken","reference","expectedRevision","position");
        else if("readCollection".equals(method))row=record(value,"version","requestId","contextToken","collection");
        else if("writeCollection".equals(method))row=record(value,"version","requestId","contextToken","collection","expectedRevision","references");
        else throw new PlanetChildDataStore.Unavailable();
        require(v2Integer(row.get("version"),2,2)==2);
        if(!"bootstrap".equals(method)){
            Object raw=row.get("contextToken");require(raw!=null||"perform".equals(method)||"retire".equals(method));if(raw!=null)token=correlation(raw);
        }
        if("perform".equals(method)){
            action=string(row.get("action"),32);require(V2_ACTIONS.contains(action));Object raw=row.get("target");
            require(!"first-install".equals(action)||token==null);if(Arrays.asList("first-install","enroll-pin","replace-pin","recover-pin").contains(action))require(raw==null);
            require(raw==null||raw instanceof Map);if(raw!=null)target=(Map<String,Object>)v2Copy(raw,0,new int[]{0});
            if(target!=null){byte[] bytes=new org.json.JSONObject(target).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);try{require(bytes.length<=65536);}finally{Arrays.fill(bytes,(byte)0);}}
        }else if("readEntity".equals(method)||"recordCountryOpen".equals(method)){reference=v2Reference(row.get("reference"));require(!"recordCountryOpen".equals(method)||"country".equals(reference.get("kind")));}
        else if("listDiscovery".equals(method)){shelf=string(row.get("shelf"),11);require(Arrays.asList("writers","books","collections").contains(shelf));}
        else if("search".equals(method)){query=string(row.get("query"),240);require(!query.matches("(?s).*[\\x00-\\x1f\\x7f].*"));}
        else if("readCollection".equals(method)||"writeCollection".equals(method)){
            collection=string(row.get("collection"),9);require(Arrays.asList("favorites","recent","offline").contains(collection));
            if("writeCollection".equals(method)){
                revision=v2Integer(row.get("expectedRevision"),0,MAX_SAFE-1);Object raw=row.get("references");require(raw instanceof List&&((List<?>)raw).size()<=64);
                List<Map<String,Object>> copied=new ArrayList<>();Set<String> ids=new HashSet<>();
                String expected="favorites".equals(collection)?"favorite":"recent".equals(collection)?"recent":"offline-package";
                for(Object item:(List<?>)raw){Map<String,Object> ref=v2Reference(item);require(expected.equals(ref.get("kind"))&&ids.add(expected+"/"+ref.get("id")));copied.add(ref);}
                references=Collections.unmodifiableList(copied);
            }
        }
        if("listMedia".equals(method)||"presentMedia".equals(method)||"resumeNarration".equals(method))owner=v2Reference(row.get("owner"));if("resumeNarration".equals(method))revision=v2Integer(row.get("expectedReadingRevision"),0,MAX_SAFE-2);if("presentMedia".equals(method)||"resumeNarration".equals(method)){assetId=string(row.get("assetId"),96);require(assetId.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,95}"));layout=v2MediaLayout(row.get("layout"));}if("releaseMedia".equals(method)&&row.get("presentationToken")!=null)presentationToken=correlation(row.get("presentationToken"));if("listScenes".equals(method)||"openScene".equals(method))owner=v2Reference(row.get("owner"));
        if("openScene".equals(method)){sceneId=string(row.get("sceneId"),96);require(sceneId.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,95}"));}
        if("rememberSceneSelection".equals(method)||"rollbackSceneSelection".equals(method)||"restoreSceneSelection".equals(method)){revision=v2Integer(row.get("expectedRevision"),0,"restoreSceneSelection".equals(method)?MAX_SAFE-1:"rollbackSceneSelection".equals(method)?MAX_SAFE-2:MAX_SAFE-3);if(!"restoreSceneSelection".equals(method))sceneToken=correlation(row.get("sceneToken"));}
        if("releaseScene".equals(method)&&row.get("sceneToken")!=null)sceneToken=correlation(row.get("sceneToken"));
        if("acquireWebResource".equals(method)){sceneToken=correlation(row.get("sceneToken"));slotId=string(row.get("slotId"),10);if(row.containsKey("assetId")){require(Arrays.asList("model","buffer","texture").contains(slotId));assetId=PlanetChildJourney.identifier(string(row.get("assetId"),96));tier=string(row.get("tier"),8);require(Arrays.asList("high","balanced","economy").contains(tier));}else require(Arrays.asList("skin","stand","background").contains(slotId));}
        if("releaseWebResource".equals(method)&&row.get("resourceToken")!=null)resourceToken=correlation(row.get("resourceToken"));
        if("readWebResourceChunk".equals(method)){sceneToken=correlation(row.get("sceneToken"));resourceToken=correlation(row.get("resourceToken"));offset=v2Integer(row.get("offset"),0,33554431);byteLength=(int)v2Integer(row.get("byteLength"),1,65536);}
        if("readJourneyRouteDownload".equals(method))journeyId=PlanetChildJourney.identifier(string(row.get("journeyId"),96));
        if(Arrays.asList("openJourney","advanceJourney","saveJourneyRoute","resumeJourneyRoute","cancelJourneyRoute").contains(method)){journeyId=PlanetChildJourney.identifier(string(row.get("journeyId"),96));revision=v2Integer(row.get("expectedRevision"),0,"openJourney".equals(method)?MAX_SAFE-1:MAX_SAFE-2);}
        if("advanceJourney".equals(method)){action=string(row.get("action"),8);require(Arrays.asList("complete","restart").contains(action));Object current=row.get("currentNodeId");if(current!=null)currentNodeId=PlanetChildJourney.identifier(string(current,96));require(currentNodeId!=null||"restart".equals(action));}
        PlanetChildReadingPosition.Record readingPosition=null;if("readReadingPosition".equals(method)||"rememberReadingPosition".equals(method)){reference=v2Reference(row.get("reference"));if("rememberReadingPosition".equals(method)){revision=v2Integer(row.get("expectedRevision"),0,MAX_SAFE-2);readingPosition=PlanetChildReadingPosition.decode(v2Copy(row.get("position"),0,new int[]{0}));require(readingPosition.kind.equals(reference.get("kind"))&&readingPosition.id.equals(reference.get("id")));}}
        long childGeneration=0;String childProfile=null,childLocale=null;if("changeChildLocale".equals(method)){childGeneration=v2Integer(row.get("generation"),1,MAX_SAFE-1);revision=v2Integer(row.get("expectedProfileRevision"),1,MAX_SAFE-1);childProfile=PlanetChildJourney.identifier(string(row.get("profileId"),96));childLocale=string(row.get("locale"),2);require(Arrays.asList("ru","en").contains(childLocale));}
        return new V2Request(method,id,token,action,target,reference,collection,query,revision,references,owner,layout,assetId,presentationToken,sceneId,sceneToken,slotId,resourceToken,journeyId,currentNodeId,shelf,tier,offset,byteLength,childGeneration,childProfile,childLocale,readingPosition);
    }
    private static Map<String,Object> v2MediaLayout(Object value)throws Exception {
        Map<String,Object> raw=record(value,"x","y","width","height","viewportWidth","viewportHeight"),out=new LinkedHashMap<>();
        for(String name:Arrays.asList("x","y","width","height","viewportWidth","viewportHeight"))out.put(name,v2Integer(raw.get(name),name.equals("x")||name.equals("y")?0:1,8192));
        require((Long)out.get("x")+(Long)out.get("width")<=(Long)out.get("viewportWidth")&&(Long)out.get("y")+(Long)out.get("height")<=(Long)out.get("viewportHeight"));return immutable(out);
    }
    /** Capacitor's already-decoded own dictionaries are copied before enqueue.
     * No JSONObject getter/coercion may run during the actual native operation. */
    static Map<String,Object> ownV2DTO(org.json.JSONObject object) throws Exception {
        require(object!=null&&object.length()<=64);return immutable(v2JsonObject(object,0,new int[]{0}));
    }
    private static Map<String,Object> v2JsonObject(org.json.JSONObject object,int depth,int[] nodes) throws Exception {
        require(depth<=12&&object.length()<=64);Map<String,Object> out=new LinkedHashMap<>();Iterator<String> keys=object.keys();
        while(keys.hasNext()){String key=keys.next();require(key.matches("[A-Za-z][A-Za-z0-9]{0,63}")&&!out.containsKey(key));out.put(key,v2JsonValue(object.get(key),depth+1,nodes));}return out;
    }
    private static Object v2JsonValue(Object value,int depth,int[] nodes) throws Exception {
        require(depth<=12&&++nodes[0]<=16384);if(value==org.json.JSONObject.NULL)return null;
        if(value instanceof org.json.JSONObject)return immutable(v2JsonObject((org.json.JSONObject)value,depth,nodes));
        if(value instanceof org.json.JSONArray){org.json.JSONArray array=(org.json.JSONArray)value;require(array.length()<=4096);List<Object> out=new ArrayList<>();for(int i=0;i<array.length();i++)out.add(v2JsonValue(array.get(i),depth+1,nodes));return Collections.unmodifiableList(out);}
        require(value instanceof String||value instanceof Number||value instanceof Boolean);return value;
    }

}
